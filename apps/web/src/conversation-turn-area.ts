import { createHash, randomUUID } from "node:crypto";

import {
  CONVERSATION_TURN_EFFECT,
  CONVERSATION_TURN_SCHEMA_VERSION,
  ConversationTurn,
  ConversationTurnConflictError,
  type ConversationTurnIdempotency,
  type ConversationTurnResult,
  type ResolvedConversationTurn,
} from "@ai-workspace/conversation-turn";
import type { ActiveMemory } from "@ai-workspace/active-memory";
import type { GeneralConversations } from "@ai-workspace/general-conversation";
import type { GeneralProjectLinks } from "@ai-workspace/general-project-link";
import type { Handoffs } from "@ai-workspace/handoff";
import { readCanonicalPayload } from "@ai-workspace/historical-search";
import { JsonModelAttemptStore } from "@ai-workspace/local-model-attempts";
import { LocalModelDataPolicyReader } from "@ai-workspace/local-privacy-policy";
import {
  ModelDelivery,
  type DeliveryTransport,
} from "@ai-workspace/model-delivery";
import { ModelAttempts } from "@ai-workspace/model-attempts";
import type {
  ModelTargets,
  ResolvedModelTarget,
} from "@ai-workspace/model-targets";
import {
  type PiiDetector,
  type PiiEntityType,
  type StablePseudonymMap,
  detectRestrictedData,
  evaluatePrivacyPreflight,
} from "@ai-workspace/privacy-gateway";
import {
  digestCanonical,
  type PrivacyDecisionAudit,
} from "@ai-workspace/privacy-audit";

import type { ConversationSources } from "./conversations.ts";
import { continuationSources } from "./continuation-facade.ts";
import {
  continuationPrivacyInput,
  serializeContinuation,
  textDigest,
} from "./continuation-payload.ts";
import {
  prepareContinuation,
  type ContinuationTarget,
} from "./continuation-preparation.ts";
import type { ModelConversationWriter } from "./model-conversation.ts";
import { AutomaticPrivacyProtection } from "./automatic-privacy.ts";
import { projectTurnPayload } from "./turn-payload-preview.ts";

type Dependencies = Readonly<{
  home: string;
  conversations: ConversationSources;
  general: Pick<GeneralConversations, "show" | "appendTurn">;
  generalLinks: Pick<GeneralProjectLinks, "list">;
  memory: Pick<ActiveMemory, "list">;
  handoffs: Pick<Handoffs, "list" | "show" | "validateRepository">;
  targets: Pick<ModelTargets, "resolve">;
  audit: Pick<PrivacyDecisionAudit, "record">;
  writer: Pick<ModelConversationWriter, "storeTurn">;
  transport?: DeliveryTransport;
  ids?: () => string;
  clock?: () => Date;
  piiDetector?: PiiDetector;
}>;

type Scope = ResolvedConversationTurn["scope"];
type Context = Readonly<{
  text: string;
  bindingDigest: string;
  privacyDigest: string;
  auditEventHash: string;
  mapping: StablePseudonymMap;
  replacements: number;
}>;
const sha256 = (value: string) =>
  createHash("sha256").update(value, "utf8").digest("hex");

export function conversationTurnArea(dependencies: Dependencies) {
  const ids = dependencies.ids ?? randomUUID;
  const clock = dependencies.clock ?? (() => new Date());
  const delivery = new ModelDelivery({
    attempts: new ModelAttempts(new JsonModelAttemptStore(dependencies.home)),
    transport: dependencies.transport ?? simulatedConversationTransport(ids),
    ids,
  });
  const idempotency = memoryIdempotency();
  const continuation = continuationSources(
    dependencies.conversations,
    dependencies.handoffs,
  );
  const automaticPrivacy = new AutomaticPrivacyProtection(
    dependencies.home,
    dependencies.piiDetector,
  );

  const resolveScope = async (conversationId: string): Promise<Scope> => {
    const [general, projects] = await Promise.all([
      dependencies.conversations.notes
        .list()
        .then(
          (conversations) =>
            conversations.find(
              (conversation) => conversation.id === conversationId,
            ) ?? null,
        ),
      dependencies.conversations.projects(),
    ]);
    const matches = (
      await Promise.all(
        projects.map(async (project) => {
          const session = (
            await dependencies.conversations.sessions.list(project.id)
          ).find((candidate) => candidate.id === conversationId);
          return session ? project.id : null;
        }),
      )
    ).filter((projectId): projectId is string => projectId !== null);
    if ((general === null ? 0 : 1) + matches.length !== 1)
      throw new Error("CONVERSATION_SCOPE_UNAVAILABLE_OR_AMBIGUOUS");
    if (general !== null)
      return Object.freeze({
        conversationId,
        projectId: null,
        workItemId: null,
        handoffId: null,
      });
    const projectId = matches[0]!;
    const work = (await dependencies.conversations.workItems.list(projectId))
      .filter((item) =>
        item.sources.some((source) => source.sessionId === conversationId),
      )
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
    const handoff = work
      ? (await dependencies.handoffs.list(projectId, work.id))[0]
      : undefined;
    return Object.freeze({
      conversationId,
      projectId,
      workItemId: work?.id ?? null,
      handoffId: handoff?.id ?? null,
    });
  };

  const compose = async (
    turn: ResolvedConversationTurn,
    target: ResolvedModelTarget,
    recordAudit: boolean,
  ): Promise<Context> => {
    const configured: ContinuationTarget = {
      destinationId: target.target.targetId,
      model: target.target.modelId,
      profile: { path: target.target.profileRef },
      bundles: target.target.instructionRefs.map((path) => ({ path })),
    };
    const prepared = await prepareContinuation(
      continuation,
      {
        conversationId: turn.scope.conversationId,
        projectId: turn.scope.projectId,
      },
      configured,
    );
    if (prepared.prepared) {
      const packet = continuationPrivacyInput(
        prepared.expandedContextPack,
        turn.request.userText,
        prepared.evidence,
      );
      const policy = await new LocalModelDataPolicyReader().read(
        prepared.projectId,
        { path: target.target.policyRef },
      );
      const preflight = evaluatePrivacyPreflight({
        policy: policy.policy,
        modelId: target.target.modelId,
        contextPack: packet,
      });
      if (preflight.overallResult === "BLOCKED")
        throw new Error("PRIVACY_BLOCKED");
      const privacyDigest = digestCanonical({
        policy: policy.sourceDigest,
        report: preflight,
      });
      const auditEventHash = recordAudit
        ? (
            await dependencies.audit.record({
              projectId: prepared.projectId,
              workItemId: prepared.workItemId,
              handoffId: prepared.handoffId,
              modelId: target.target.modelId,
              policyId: policy.policy.id,
              policyVersion: policy.policy.version,
              policyDigest: policy.sourceDigest,
              contextPackSchemaVersion: packet.schemaVersion,
              decision: preflight.overallResult,
              counts: preflight.accounting,
              preflightReportDigest: digestCanonical(preflight),
            })
          ).eventHash
        : privacyDigest;
      const protectedContext = await automaticPrivacy.protect(
        stableScopeId(turn.scope),
        serializeContinuation(packet.included),
      );
      const text = protectedContext.text;
      boundedContext(text, target.target.maxInputBytes);
      return Object.freeze({
        text,
        bindingDigest: digestCanonical({
          prepared,
          privacyDigest,
          mappingDigest: protectedContext.mappingDigest,
          text: textDigest(text),
        }),
        privacyDigest,
        auditEventHash,
        mapping: protectedContext.mapping,
        replacements: protectedContext.replacements,
      });
    }
    if (
      !["NO_LINKED_WORK", "NO_HANDOFF", "NOT_A_WORK_CONVERSATION"].includes(
        prepared.reason,
      )
    )
      throw new Error("CONTEXT_UNAVAILABLE");
    const originalText = await reducedContext(dependencies, turn, target);
    if (detectRestrictedData(originalText) !== null)
      throw new Error("PRIVACY_BLOCKED");
    const protectedContext = await automaticPrivacy.protect(
      stableScopeId(turn.scope),
      originalText,
    );
    const text = protectedContext.text;
    const privacyDigest = digestCanonical({
      mode: "LOCAL_RESTRICTED_DATA_SCREEN",
      result: "ALLOWED",
      textDigest: textDigest(text),
    });
    return Object.freeze({
      text,
      bindingDigest: digestCanonical({
        scope: turn.scope,
        privacyDigest,
        mappingDigest: protectedContext.mappingDigest,
        text: textDigest(text),
      }),
      privacyDigest,
      auditEventHash: privacyDigest,
      mapping: protectedContext.mapping,
      replacements: protectedContext.replacements,
    });
  };

  const executor = {
    execute: async (
      turn: ResolvedConversationTurn,
    ): Promise<ConversationTurnResult> => {
      let target: ResolvedModelTarget | null;
      try {
        target = await dependencies.targets.resolve({
          conversationId: turn.scope.conversationId,
          projectId: turn.scope.projectId,
        });
      } catch {
        return {
          kind: "REFUSED_BEFORE_EXPOSURE",
          reason: "TARGET_UNAVAILABLE",
        };
      }
      if (
        target === null ||
        target.target.targetId !== turn.request.targetId ||
        target.target.boundary !== "EXTERNAL_SERVICE" ||
        target.target.providerKind !== "OPENAI_RESPONSES"
      )
        return {
          kind: "REFUSED_BEFORE_EXPOSURE",
          reason: "TARGET_UNAVAILABLE",
        };
      let context: Context;
      try {
        context = await compose(turn, target, true);
      } catch (error) {
        return {
          kind: "REFUSED_BEFORE_EXPOSURE",
          reason:
            error instanceof Error && error.message === "PRIVACY_BLOCKED"
              ? "PRIVACY_BLOCKED"
              : "CONTEXT_UNAVAILABLE",
        };
      }
      const projectId =
        turn.scope.projectId ?? `general-${sha256(turn.scope.conversationId)}`;
      const workItemId =
        turn.scope.workItemId ??
        `conversation-${sha256(turn.scope.conversationId)}`;
      const handoffId =
        turn.scope.handoffId ?? `context-${sha256(JSON.stringify(turn.scope))}`;
      try {
        await delivery.initialize(projectId);
        const prepared = delivery.prepare({
          projectId,
          workItemId,
          handoffId,
          model: target.target.modelId,
          text: context.text,
          bindingDigest: context.bindingDigest,
          preflightAuditEventHash: context.auditEventHash,
          destination: "EXTERNAL",
          providerKind: "OPENAI_RESPONSES",
          maxOutputTokens: 512,
          timeoutMs: 30_000,
        });
        const delivered = await delivery.confirm(
          prepared.authorizationId,
          { projectId, workItemId, handoffId },
          async () => (await compose(turn, target!, false)).bindingDigest,
        );
        if (delivered.kind === "REFUSED_BEFORE_EXPOSURE")
          return {
            kind: "REFUSED_BEFORE_EXPOSURE",
            reason:
              delivered.reason === "LOCAL_EVIDENCE_UNAVAILABLE"
                ? "LOCAL_EVIDENCE_UNAVAILABLE"
                : "CONTEXT_UNAVAILABLE",
          };
        if (delivered.kind === "UNKNOWN_AFTER_EXPOSURE")
          return {
            kind: "UNKNOWN_AFTER_EXPOSURE",
            attemptId: delivered.attemptId,
          };
        if (delivered.kind === "TERMINAL_REJECTED")
          return {
            kind: "RESPONSE_WITHHELD",
            attemptId: delivered.attemptId,
            reason: "CONTENT_BLOCKED",
          };
        if (delivered.kind !== "COMPLETED")
          return {
            kind: "UNKNOWN_AFTER_EXPOSURE",
            attemptId: delivered.attemptId,
          };
        let restoredText: string;
        try {
          restoredText = automaticPrivacy.restore(
            context.mapping,
            delivered.text,
          );
        } catch {
          return {
            kind: "RESPONSE_WITHHELD",
            attemptId: delivered.attemptId,
            reason: "RESTORATION_FAILED",
          };
        }
        if (
          Buffer.byteLength(restoredText, "utf8") >
            target.target.maxOutputBytes ||
          detectRestrictedData(restoredText) !== null
        )
          return {
            kind: "RESPONSE_WITHHELD",
            attemptId: delivered.attemptId,
            reason: "CONTENT_BLOCKED",
          };
        const occurredAt = clock().toISOString();
        let stored: Readonly<{ eventId: string }>;
        try {
          stored =
            turn.scope.projectId === null
              ? await storeGeneralTurn(dependencies, turn, target, {
                  attemptId: delivered.attemptId,
                  text: restoredText,
                })
              : await dependencies.writer.storeTurn({
                  projectId: turn.scope.projectId,
                  conversationId: turn.scope.conversationId,
                  attemptId: delivered.attemptId,
                  model: target.target.modelId,
                  targetId: target.target.targetId,
                  displayName: target.target.displayName,
                  userText: turn.request.userText,
                  text: restoredText,
                  occurredAt,
                });
        } catch {
          return {
            kind: "RESPONSE_WITHHELD",
            attemptId: delivered.attemptId,
            reason: "SAVE_FAILED",
          };
        }
        return {
          kind: "COMPLETED",
          assistantMessageId: stored.eventId,
          effectiveModel: target.target.displayName,
          text: restoredText,
          occurredAt,
          protection: Object.freeze({
            automatic: true,
            replacements: context.replacements,
          }),
        };
      } catch {
        return {
          kind: "REFUSED_BEFORE_EXPOSURE",
          reason: "LOCAL_EVIDENCE_UNAVAILABLE",
        };
      }
    },
  };
  const service = new ConversationTurn({
    scopes: { resolve: resolveScope },
    idempotency,
    executor,
  });

  /** Shares the turn's scope resolution, so a term cannot land in a map the
   * next message would not use. */
  const addProtectedTerm = async (
    input: Readonly<{
      conversationId?: string;
      term: string;
      type: PiiEntityType;
    }>,
  ) =>
    automaticPrivacy.addTerm(
      input.conversationId === undefined
        ? "GENERAL"
        : stableScopeId(await resolveScope(input.conversationId)),
      input.term,
      input.type,
    );

  /** Produces the exact protected form of the current draft without composing
   * context, recording an audit event or reaching the delivery boundary. The
   * stable map is intentionally reused and extended, so the later turn keeps
   * the placeholders the person reviewed here. */
  const previewProtection = async (
    input: Readonly<{ conversationId?: string; text: string }>,
  ) => {
    if (
      typeof input.text !== "string" ||
      !input.text.isWellFormed() ||
      !input.text.trim() ||
      Buffer.byteLength(input.text, "utf8") > 64 * 1024
    )
      throw new Error("PROTECTION_PREVIEW_INVALID");
    const protectedValue = await automaticPrivacy.protect(
      input.conversationId === undefined
        ? "GENERAL"
        : stableScopeId(await resolveScope(input.conversationId)),
      input.text,
    );
    return Object.freeze({
      text: protectedValue.text,
      replacements: protectedValue.replacements,
      effect: "LOCAL_PREVIEW_NOT_AUDITED_AUTHORIZED_OR_SENT" as const,
    });
  };

  /**
   * The exact payload the next turn would deliver, protected and grouped for
   * reading, without composing an audit event, a durable attempt or a delivery.
   *
   * It reuses the turn's own composition rather than reproducing it, so what a
   * person reads here and what would leave are the same bytes. They are the same
   * bytes as of now: the turn recomposes and re-verifies before claiming, and a
   * source that changed in between refuses the send instead of exposing it.
   */
  const previewTurnPayload = async (
    input: Readonly<{
      conversationId: string;
      targetId: string;
      userText: string;
    }>,
  ) => {
    if (
      typeof input.userText !== "string" ||
      !input.userText.isWellFormed() ||
      !input.userText.trim() ||
      Buffer.byteLength(input.userText, "utf8") > 64 * 1024 ||
      typeof input.targetId !== "string" ||
      !input.targetId.trim()
    )
      throw new Error("TURN_PREVIEW_INVALID");
    const scope = await resolveScope(input.conversationId);
    const target = await dependencies.targets
      .resolve({
        conversationId: scope.conversationId,
        projectId: scope.projectId,
      })
      .catch(() => null);
    // The same acceptance the executor applies, so a preview never shows a
    // payload the send would refuse to compose.
    if (
      target === null ||
      target.target.targetId !== input.targetId ||
      target.target.boundary !== "EXTERNAL_SERVICE" ||
      target.target.providerKind !== "OPENAI_RESPONSES"
    )
      return blockedPreview("TARGET_UNAVAILABLE");
    const turn: ResolvedConversationTurn = Object.freeze({
      schemaVersion: CONVERSATION_TURN_SCHEMA_VERSION,
      request: Object.freeze({
        conversationId: scope.conversationId,
        projectId: scope.projectId,
        targetId: input.targetId,
        userText: input.userText,
        // Never claimed and never stored: this composition reaches no attempt.
        clientRequestId: `local-preview-${ids()}`,
      }),
      scope,
      effect: CONVERSATION_TURN_EFFECT,
    });
    let context: Context;
    try {
      context = await compose(turn, target, false);
    } catch (error) {
      return blockedPreview(
        error instanceof Error && error.message === "PRIVACY_BLOCKED"
          ? "PRIVACY_BLOCKED"
          : "CONTEXT_UNAVAILABLE",
      );
    }
    return Object.freeze({
      kind: "READY" as const,
      model: target.target.displayName,
      ...projectTurnPayload(context.text),
      totalBytes: Buffer.byteLength(context.text, "utf8"),
      replacements: context.replacements,
      effect: "LOCAL_PREVIEW_NOT_AUDITED_AUTHORIZED_OR_SENT" as const,
    });
  };

  return Object.freeze({
    run: service.run.bind(service),
    addProtectedTerm,
    previewProtection,
    previewTurnPayload,
  });
}

async function reducedContext(
  dependencies: Dependencies,
  turn: ResolvedConversationTurn,
  target: ResolvedModelTarget,
): Promise<string> {
  const readings: Readonly<{
    type: string;
    text: string;
    occurredAt: string | null;
  }>[] = [];
  if (turn.scope.projectId === null) {
    const conversation = await dependencies.general.show(
      turn.scope.conversationId,
    );
    for (const event of conversation.events.slice(-128))
      readings.push({
        type: event.type,
        text: event.content,
        occurredAt: event.occurredAt,
      });
  } else {
    const session = (
      await dependencies.conversations.sessions.list(turn.scope.projectId)
    ).find((candidate) => candidate.id === turn.scope.conversationId);
    if (!session) throw new Error("CONTEXT_UNAVAILABLE");
    for (const event of session.events.slice(-128)) {
      try {
        const raw =
          event.payload.kind === "INLINE_TEXT"
            ? event.payload.text
            : await dependencies.conversations.artifact?.(
                event.payload.artifact.id,
              );
        if (raw === undefined) continue;
        readings.push({
          type: event.type,
          text: event.source.sourceType.startsWith("MODEL_CONVERSATION")
            ? raw
            : readCanonicalPayload(raw).text,
          occurredAt: event.occurredAt,
        });
      } catch {
        /* A bounded reduced context omits an unreadable event instead of inventing it. */
      }
    }
  }
  const linkedProjects =
    turn.scope.projectId === null
      ? [
          ...new Set(
            (await dependencies.generalLinks.list())
              .filter(
                (link) =>
                  link.generalConversationId === turn.scope.conversationId,
              )
              .map((link) => link.targetProjectId),
          ),
        ].sort()
      : [turn.scope.projectId];
  const memory = (
    await Promise.all(
      linkedProjects.map((projectId) =>
        dependencies.memory
          .list({ projectId, validity: "ACTIVE", limit: 20 })
          .then((page) =>
            page.items.map((item) => ({
              projectId,
              type: item.type,
              content: item.content,
            })),
          )
          .catch(() => []),
      ),
    )
  ).flat();
  const envelope = {
    schemaVersion: 1,
    effect: "BOUNDED_REDUCED_CONVERSATION_CONTEXT",
    scope: turn.scope,
    target: {
      targetId: target.target.targetId,
      modelId: target.target.modelId,
    },
    readings,
    linkedProjectMemory: memory,
    userText: turn.request.userText,
  };
  while (
    Buffer.byteLength(JSON.stringify(envelope), "utf8") >
    target.target.maxInputBytes
  ) {
    if (envelope.readings.length > 0) envelope.readings.shift();
    else if (envelope.linkedProjectMemory.length > 0)
      envelope.linkedProjectMemory.pop();
    else throw new Error("CONTEXT_UNAVAILABLE");
  }
  const text = JSON.stringify(envelope);
  boundedContext(text, target.target.maxInputBytes);
  return text;
}

async function storeGeneralTurn(
  dependencies: Dependencies,
  turn: ResolvedConversationTurn,
  target: ResolvedModelTarget,
  delivered: Readonly<{ attemptId: string; text: string }>,
) {
  const conversation = await dependencies.general.show(
    turn.scope.conversationId,
  );
  const updated = await dependencies.general.appendTurn({
    conversationId: conversation.id,
    expectedEventCount: conversation.events.length,
    userText: turn.request.userText,
    assistantText: delivered.text,
    attemptId: delivered.attemptId,
    displayName: target.target.displayName,
    model: target.target.modelId,
    targetId: target.target.targetId,
  });
  return { eventId: updated.events.at(-1)!.id };
}

/** A refusal is a result of the preview, not a failure of it: knowing the send
 * would be blocked is exactly what a person opened this to find out. */
function blockedPreview(
  reason: "TARGET_UNAVAILABLE" | "PRIVACY_BLOCKED" | "CONTEXT_UNAVAILABLE",
) {
  return Object.freeze({
    kind: "BLOCKED" as const,
    reason,
    effect: "LOCAL_PREVIEW_NOT_AUDITED_AUTHORIZED_OR_SENT" as const,
  });
}

function stableScopeId(scope: Scope): string {
  return scope.projectId === null ? "GENERAL" : `PROJECT:${scope.projectId}`;
}

function boundedContext(text: string, maximum: number): void {
  if (
    !text.trim() ||
    !text.isWellFormed() ||
    Buffer.byteLength(text, "utf8") > maximum
  )
    throw new Error("CONTEXT_UNAVAILABLE");
}

function simulatedConversationTransport(ids: () => string): DeliveryTransport {
  return {
    send: async () => ({
      kind: "COMPLETED",
      text: "SIMULATED RESPONSE: I continued from the current local conversation context. No model was called.",
      requestId: `simulated-request-${ids()}`,
      responseId: `simulated-response-${ids()}`,
      usage: { inputTokens: null, cachedInputTokens: null, outputTokens: null },
    }),
  };
}

function memoryIdempotency(): ConversationTurnIdempotency {
  const claims = new Map<
    string,
    Readonly<{ digest: string; result: Promise<ConversationTurnResult> }>
  >();
  return {
    execute: async (claim, operation) => {
      const existing = claims.get(claim.idempotencyKey);
      if (existing) {
        if (existing.digest !== claim.requestDigest)
          throw new ConversationTurnConflictError();
        return { duplicate: true, result: await existing.result };
      }
      if (claims.size >= 10_000) throw new Error("TURN_IDEMPOTENCY_CAPACITY");
      const result = operation();
      claims.set(claim.idempotencyKey, {
        digest: claim.requestDigest,
        result,
      });
      return { duplicate: false, result: await result };
    },
  };
}
