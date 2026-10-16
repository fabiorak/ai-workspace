import { createHash, randomUUID } from "node:crypto";

import {
  CONVERSATION_TURN_EFFECT,
  CONVERSATION_TURN_SCHEMA_VERSION,
  ConversationTurn,
  type ConversationTurnExecution,
  type ConversationTurnResult,
  type ResolvedConversationTurn,
} from "@ai-workspace/conversation-turn";
import type { ActiveMemory } from "@ai-workspace/active-memory";
import {
  generalMessageContent,
  type GeneralConversations,
} from "@ai-workspace/general-conversation";
import type { GeneralProjectLinks } from "@ai-workspace/general-project-link";
import type { Handoffs } from "@ai-workspace/handoff";
import {
  AgentAttempts,
  AgentExecution,
  type AgentExecutor,
} from "@ai-workspace/agent-execution";
import { JsonAgentAttemptStore } from "@ai-workspace/local-agent-attempts";
import {
  LOCAL_MODEL_PROTECTION,
  LocalModelAttempts,
  LocalModelExecution,
  type LocalModelExecutor,
} from "@ai-workspace/local-model-execution";
import { JsonLocalModelAttemptStore } from "@ai-workspace/local-model-run-attempts";
import { JsonModelAttemptStore } from "@ai-workspace/local-model-attempts";
import { JsonConversationTurnRegistry } from "@ai-workspace/local-conversation-turns";
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
  emptyStablePseudonymMap,
  evaluatePrivacyPreflight,
  planModelPrivacyPath,
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
import { composeReducedTurnContext } from "./reduced-turn-context.ts";
import { conversationTurnRecovery } from "./conversation-turn-recovery.ts";
import { TurnReviews } from "./turn-review.ts";

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
  /** Injected agent executors; absent kinds stay unavailable (ADR-0049/0050). */
  agentExecutors?: readonly AgentExecutor[];
  /** Injected only when the process received a loopback address (ADR-0051). */
  localModelExecutor?: LocalModelExecutor;
  ids?: () => string;
  clock?: () => Date;
  piiDetector?: PiiDetector;
}>;

type Scope = ResolvedConversationTurn["scope"];
type Context = Readonly<{
  text: string;
  bindingDigest: string;
  privacyDigest: string;
  auditEventHash: string | null;
  mapping: StablePseudonymMap;
  replacements: number;
}>;
/** An agent answer may take longer than a model delivery; still bounded. */
const AGENT_TIMEOUT_MS = 60_000;
const sha256 = (value: string) =>
  createHash("sha256").update(value, "utf8").digest("hex");

export function conversationTurnArea(dependencies: Dependencies) {
  const ids = dependencies.ids ?? randomUUID;
  const clock = dependencies.clock ?? (() => new Date());
  const reviews = new TurnReviews(() => clock().getTime());
  const attempts = new ModelAttempts(
    new JsonModelAttemptStore(dependencies.home),
  );
  const delivery = new ModelDelivery({
    attempts,
    transport: dependencies.transport ?? simulatedConversationTransport(ids),
    ids,
  });
  const agentAttempts = new AgentAttempts(
    new JsonAgentAttemptStore(dependencies.home),
  );
  const agentExecutors = dependencies.agentExecutors ?? [];
  const agents = new AgentExecution({
    attempts: agentAttempts,
    executors: agentExecutors,
    ids,
    clock: () => clock().getTime(),
  });
  const agentKinds = new Set(agentExecutors.map((executor) => executor.kind));
  // The store is always readable, so recovery works after a start without the
  // local model; execution exists only with an injected executor.
  const localModelAttempts = new LocalModelAttempts(
    new JsonLocalModelAttemptStore(dependencies.home),
  );
  const localModel = dependencies.localModelExecutor
    ? new LocalModelExecution({
        attempts: localModelAttempts,
        executor: dependencies.localModelExecutor,
        ids,
        clock: () => clock().getTime(),
      })
    : null;
  const idempotency = new JsonConversationTurnRegistry(
    dependencies.home,
    conversationTurnRecovery(
      dependencies,
      attempts,
      agentAttempts,
      localModelAttempts,
    ),
  );
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

  const readSelection = async (conversationId: string) => {
    const scope = await resolveScope(conversationId);
    const resolved = await dependencies.targets.resolve({
      conversationId,
      projectId: scope.projectId,
    });
    // Each class goes only to its own boundary. An agent kind without an
    // injected executor, or a local model without one or without a declared
    // LOCAL_ONLY boundary, is refused here, never delivered elsewhere instead.
    const external = resolved?.target.boundary === "EXTERNAL_SERVICE";
    const deliverable =
      external &&
      resolved?.target.executionClass === "MODEL_DELIVERY" &&
      resolved.target.kind === "OPENAI_RESPONSES";
    const executable =
      external &&
      resolved?.target.executionClass === "AGENT_EXECUTION" &&
      agentKinds.has(resolved.target.kind);
    const local =
      localModel !== null &&
      resolved?.target.executionClass === "LOCAL_MODEL" &&
      resolved.target.kind === "LLAMA_SERVER_LOOPBACK" &&
      resolved.target.boundary === "LOCAL_ONLY";
    if (
      !resolved ||
      !resolved.target.enabled ||
      !(deliverable || executable || local)
    )
      throw new Error("TARGET_UNAVAILABLE");
    // Do not retain mutable configuration supplied by an adapter.
    const target = structuredClone(resolved);
    const relationships =
      scope.projectId === null
        ? (await dependencies.generalLinks.list())
            .filter((link) => link.generalConversationId === conversationId)
            .map((link) => JSON.stringify(link))
            .sort()
        : (
            await dependencies.conversations.workItems.list(scope.projectId)
          ).filter((work) => work.id === scope.workItemId);
    return {
      scope,
      target,
      digest: digestCanonical({
        scope,
        target,
        relationships,
        executionClass: target.target.executionClass,
        maxOutputTokens: 512,
        timeoutMs: 30_000,
      }),
    };
  };
  const boundDigest = (
    selection: Awaited<ReturnType<typeof readSelection>>,
    context: Context,
  ) =>
    digestCanonical({
      selection: selection.digest,
      context: context.bindingDigest,
    });

  const compose = async (
    turn: ResolvedConversationTurn,
    target: ResolvedModelTarget,
    recordAudit: boolean,
  ): Promise<Context> => {
    const protection = protectionFor(target, automaticPrivacy);
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
        : null;
      const protectedContext = await protection.protect(
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
    return composeReducedTurnContext(
      {
        ...dependencies,
        activeMemory: dependencies.memory,
        ...(dependencies.conversations.boundedArtifact === undefined
          ? {}
          : { boundedArtifact: dependencies.conversations.boundedArtifact }),
      },
      turn,
      target,
      protection,
      recordAudit,
    );
  };

  const executor = {
    execute: async (
      turn: ResolvedConversationTurn,
      execution: ConversationTurnExecution,
    ): Promise<ConversationTurnResult> => {
      let reviewed: ReturnType<TurnReviews["consume"]> | undefined;
      if (turn.request.reviewId !== undefined) {
        try {
          reviewed = reviews.consume(turn.request.reviewId, turn.request);
        } catch {
          return { kind: "REFUSED_BEFORE_EXPOSURE", reason: "REVIEW_INVALID" };
        }
      }
      let selection: Awaited<ReturnType<typeof readSelection>>;
      try {
        selection = await readSelection(turn.scope.conversationId);
        if (
          selection.target.target.targetId !== turn.request.targetId ||
          digestCanonical(selection.scope) !== digestCanonical(turn.scope)
        )
          throw new Error("TARGET_UNAVAILABLE");
      } catch {
        return {
          kind: "REFUSED_BEFORE_EXPOSURE",
          reason: reviewed ? "REVIEW_INVALID" : "TARGET_UNAVAILABLE",
        };
      }
      const target = selection.target;
      // A General conversation stores the message after exposure, so a message
      // it could not store is refused before anything leaves.
      if (turn.scope.projectId === null)
        try {
          generalMessageContent(turn.request.userText, "Question");
        } catch {
          return {
            kind: "REFUSED_BEFORE_EXPOSURE",
            reason: reviewed ? "REVIEW_INVALID" : "CONTEXT_UNAVAILABLE",
          };
        }
      let context: Context;
      try {
        context = await compose(turn, target, true);
      } catch (error) {
        return {
          kind: "REFUSED_BEFORE_EXPOSURE",
          reason: reviewed
            ? "REVIEW_INVALID"
            : error instanceof Error && error.message === "PRIVACY_BLOCKED"
              ? "PRIVACY_BLOCKED"
              : "CONTEXT_UNAVAILABLE",
        };
      }
      const bindingDigest = boundDigest(selection, context);
      if (
        reviewed &&
        (reviewed.expiresAt <= clock().getTime() ||
          reviewed.bindingDigest !== bindingDigest ||
          reviewed.text !== context.text)
      )
        return { kind: "REFUSED_BEFORE_EXPOSURE", reason: "REVIEW_INVALID" };
      const revalidate = async () => {
        if (reviewed && reviewed.expiresAt <= clock().getTime())
          return "REVIEW_INVALID";
        const current = await readSelection(turn.scope.conversationId);
        if (current.digest !== selection.digest) return "SELECTION_CHANGED";
        const fresh = await compose(
          { ...turn, scope: current.scope },
          current.target,
          false,
        );
        // The reads/composition above can await while selection or links change.
        const after = await readSelection(turn.scope.conversationId);
        if (
          after.digest !== current.digest ||
          (reviewed && reviewed.expiresAt <= clock().getTime())
        )
          return "SELECTION_CHANGED";
        return boundDigest(current, fresh);
      };
      const projectId =
        turn.scope.projectId ?? `general-${sha256(turn.scope.conversationId)}`;
      const workItemId =
        turn.scope.workItemId ??
        `conversation-${sha256(turn.scope.conversationId)}`;
      const handoffId =
        turn.scope.handoffId ?? `context-${sha256(JSON.stringify(turn.scope))}`;
      try {
        if (context.auditEventHash === null)
          throw new Error("CONTEXT_UNAVAILABLE");
        const text = reviewed?.text ?? context.text;
        const refused = (reason: string): ConversationTurnResult => ({
          kind: "REFUSED_BEFORE_EXPOSURE",
          reason: reviewed
            ? "REVIEW_INVALID"
            : reason === "LOCAL_EVIDENCE_UNAVAILABLE"
              ? "LOCAL_EVIDENCE_UNAVAILABLE"
              : "CONTEXT_UNAVAILABLE",
        });
        let generated: Readonly<{
          attemptId: string;
          text: string;
          reportedModel: string | null;
        }>;
        if (target.target.executionClass === "AGENT_EXECUTION") {
          const prepared = agents.prepare({
            scopeId: projectId,
            targetId: target.target.targetId,
            kind: target.target.kind,
            model: target.target.modelId,
            text,
            bindingDigest,
            preflightAuditEventHash: context.auditEventHash,
            timeoutMs: AGENT_TIMEOUT_MS,
          });
          const ran = await agents.confirm(
            prepared.authorizationId,
            projectId,
            revalidate,
            execution.bindAttempt,
          );
          if (ran.kind === "REFUSED_BEFORE_EXECUTION")
            return refused(ran.reason);
          if (ran.kind === "UNKNOWN_AFTER_EXECUTION")
            return { kind: "UNKNOWN_AFTER_EXPOSURE", attemptId: ran.attemptId };
          generated = ran;
        } else if (target.target.executionClass === "LOCAL_MODEL") {
          if (localModel === null || target.target.boundary !== "LOCAL_ONLY")
            return refused("CONTEXT_UNAVAILABLE");
          let prepared: ReturnType<LocalModelExecution["prepare"]>;
          try {
            prepared = localModel.prepare({
              scopeId: projectId,
              targetId: target.target.targetId,
              model: target.target.modelId,
              text,
              boundary: "LOCAL_ONLY",
              bindingDigest,
              preflightAuditEventHash: context.auditEventHash,
            });
          } catch {
            // A request over the fixed limits is refused, never truncated.
            return refused("CONTEXT_UNAVAILABLE");
          }
          const ran = await localModel.confirm(
            prepared.authorizationId,
            projectId,
            revalidate,
            execution.bindAttempt,
          );
          if (ran.kind === "REFUSED_BEFORE_EXECUTION")
            return refused(ran.reason);
          if (ran.kind === "UNKNOWN_AFTER_EXECUTION")
            return { kind: "UNKNOWN_AFTER_EXPOSURE", attemptId: ran.attemptId };
          generated = ran;
        } else {
          const prepared = delivery.prepare({
            projectId,
            workItemId,
            handoffId,
            model: target.target.modelId,
            text,
            bindingDigest,
            preflightAuditEventHash: context.auditEventHash,
            destination: "EXTERNAL",
            providerKind: "OPENAI_RESPONSES",
            maxOutputTokens: 512,
            timeoutMs: 30_000,
          });
          const delivered = await delivery.confirm(
            prepared.authorizationId,
            { projectId, workItemId, handoffId },
            revalidate,
            execution.bindAttempt,
          );
          if (delivered.kind === "REFUSED_BEFORE_EXPOSURE")
            return refused(delivered.reason);
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
          generated = { ...delivered, reportedModel: null };
        }
        const exempt = localOnly(target);
        let restoredText: string;
        try {
          // Nothing was replaced on the way in, so nothing is restored: a
          // local answer that merely looks like a placeholder stays as written.
          restoredText = exempt
            ? generated.text
            : automaticPrivacy.restore(context.mapping, generated.text);
        } catch {
          return {
            kind: "RESPONSE_WITHHELD",
            attemptId: generated.attemptId,
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
            attemptId: generated.attemptId,
            reason: "CONTENT_BLOCKED",
          };
        const occurredAt = clock().toISOString();
        let stored: Readonly<{ eventId: string; occurredAt?: string }>;
        try {
          stored =
            turn.scope.projectId === null
              ? await storeGeneralTurn(dependencies, turn, target, {
                  attemptId: generated.attemptId,
                  text: restoredText,
                  reportedModel: generated.reportedModel,
                })
              : await dependencies.writer.storeTurn({
                  projectId: turn.scope.projectId,
                  conversationId: turn.scope.conversationId,
                  attemptId: generated.attemptId,
                  model: target.target.modelId,
                  targetId: target.target.targetId,
                  displayName: target.target.displayName,
                  executionClass: generatedClass(target),
                  userText: turn.request.userText,
                  text: restoredText,
                  occurredAt,
                });
        } catch {
          return {
            kind: "RESPONSE_WITHHELD",
            attemptId: generated.attemptId,
            reason: "SAVE_FAILED",
          };
        }
        return {
          kind: "COMPLETED",
          assistantMessageId: stored.eventId,
          effectiveModel: target.target.displayName,
          text: restoredText,
          occurredAt: stored.occurredAt ?? occurredAt,
          // A local answer carries no automatic protection to report.
          ...(exempt
            ? {}
            : {
                protection: Object.freeze({
                  automatic: true as const,
                  replacements: context.replacements,
                }),
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
   * bytes as of now. Optional bindReview adds a short-lived, monouse preparation;
   * only that mode links this preview to the later send. Ordinary sends recompose.
   */
  const previewTurnPayload = async (
    input: Readonly<{
      conversationId: string;
      targetId: string;
      userText: string;
      bindReview?: boolean;
    }>,
  ) => {
    if (
      (input.bindReview !== undefined &&
        typeof input.bindReview !== "boolean") ||
      typeof input.userText !== "string" ||
      !input.userText.isWellFormed() ||
      !input.userText.trim() ||
      Buffer.byteLength(input.userText, "utf8") > 64 * 1024 ||
      typeof input.targetId !== "string" ||
      !input.targetId.trim()
    )
      throw new Error("TURN_PREVIEW_INVALID");
    let selection: Awaited<ReturnType<typeof readSelection>>;
    try {
      selection = await readSelection(input.conversationId);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "CONVERSATION_SCOPE_UNAVAILABLE_OR_AMBIGUOUS"
      )
        throw error;
      return blockedPreview("TARGET_UNAVAILABLE");
    }
    const { scope, target } = selection;
    if (target.target.targetId !== input.targetId)
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
    const exempt = localOnly(target);
    let review: ReturnType<TurnReviews["prepare"]> | undefined;
    if (input.bindReview) {
      // Reviews hold protected payloads only; a local payload is the original.
      if (exempt) return blockedPreview("REVIEW_UNAVAILABLE");
      try {
        if (
          (await readSelection(input.conversationId)).digest !==
          selection.digest
        )
          return blockedPreview("CONTEXT_UNAVAILABLE");
        review = reviews.prepare(
          turn.request,
          boundDigest(selection, context),
          context.text,
        );
      } catch {
        return blockedPreview("REVIEW_UNAVAILABLE");
      }
    }
    return Object.freeze({
      kind: "READY" as const,
      model: target.target.displayName,
      ...projectTurnPayload(context.text),
      totalBytes: Buffer.byteLength(context.text, "utf8"),
      replacements: context.replacements,
      ...(exempt ? { protection: LOCAL_MODEL_PROTECTION } : {}),
      ...(review ? { review, protectedText: context.text } : {}),
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

async function storeGeneralTurn(
  dependencies: Dependencies,
  turn: ResolvedConversationTurn,
  target: ResolvedModelTarget,
  delivered: Readonly<{
    attemptId: string;
    text: string;
    reportedModel: string | null;
  }>,
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
    executionClass: generatedClass(target),
    reportedModel: delivered.reportedModel,
  });
  return {
    eventId: updated.events.at(-1)!.id,
    occurredAt: updated.events.at(-1)!.occurredAt,
  };
}

/** The class written into provenance; see `readSelection` for what runs. */
function generatedClass(target: ResolvedModelTarget) {
  return target.target.executionClass === "AGENT_EXECUTION" ||
    target.target.executionClass === "LOCAL_MODEL"
    ? target.target.executionClass
    : ("MODEL_DELIVERY" as const);
}

/**
 * ADR-0051. True only for a local model whose target declares LOCAL_ONLY. The
 * decision is the privacy gateway's, never a name, an address or a UI choice.
 */
function localOnly(target: ResolvedModelTarget): boolean {
  return (
    target.target.executionClass === "LOCAL_MODEL" &&
    planModelPrivacyPath(target.target.boundary).pseudonymization ===
      "NOT_REQUIRED"
  );
}

/**
 * Pseudonymization is skipped only where `localOnly` holds. The policy
 * preflight and the restricted-data block run either way, and every other
 * class is protected again from the original text on each composition, so a
 * later switch of target never reuses this unprotected form.
 */
function protectionFor(
  target: ResolvedModelTarget,
  automaticPrivacy: AutomaticPrivacyProtection,
): Pick<AutomaticPrivacyProtection, "protect"> {
  if (!localOnly(target)) return automaticPrivacy;
  return {
    protect: async (scopeId: string, text: string) =>
      Object.freeze({
        text,
        mapping: emptyStablePseudonymMap(scopeId),
        mappingDigest: sha256(LOCAL_MODEL_PROTECTION),
        replacements: 0,
      }),
  };
}

/** A refusal is a result of the preview, not a failure of it: knowing the send
 * would be blocked is exactly what a person opened this to find out. */
function blockedPreview(
  reason:
    | "TARGET_UNAVAILABLE"
    | "PRIVACY_BLOCKED"
    | "CONTEXT_UNAVAILABLE"
    | "REVIEW_UNAVAILABLE",
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
