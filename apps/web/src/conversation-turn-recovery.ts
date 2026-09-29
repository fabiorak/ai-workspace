import { createHash } from "node:crypto";
import type {
  ConversationTurnResult,
  ConversationTurnScope,
} from "@ai-workspace/conversation-turn";
import type { AgentAttempts } from "@ai-workspace/agent-execution";
import type { ConversationTurnAttempt } from "@ai-workspace/conversation-turn";
import type { GeneralConversations } from "@ai-workspace/general-conversation";
import type { ModelAttempts } from "@ai-workspace/model-attempts";
import type { TurnRecovery } from "@ai-workspace/local-conversation-turns";
import type { ConversationSources } from "./conversations.ts";
import { generatedSource } from "./generated-source.ts";

type Sources = Readonly<{
  conversations: ConversationSources;
  general: Pick<GeneralConversations, "show">;
}>;
const digest = (value: string) =>
  createHash("sha256").update(value, "utf8").digest("hex");

/** What recovery needs from either attempt store, and nothing more. */
type Evidence = Readonly<{
  authorizationId: string;
  state: "COMPLETED" | "REJECTED" | "NOT_STARTED" | "UNCERTAIN";
}>;

/**
 * The reference names its store (ADR-0049). An agent reference is never read
 * from the model-delivery store, and without an agent store it stays unknown.
 */
async function evidenceFor(
  reference: ConversationTurnAttempt,
  attempts: Pick<ModelAttempts, "inspect">,
  agentAttempts: Pick<AgentAttempts, "inspect"> | undefined,
): Promise<Evidence> {
  if (reference.executionClass === "AGENT_EXECUTION") {
    if (agentAttempts === undefined) throw new Error("NO_AGENT_ATTEMPTS");
    const record = await agentAttempts.inspect(
      reference.projectId,
      reference.attemptId,
    );
    return {
      authorizationId: record.authorizationId,
      state:
        record.state === "COMPLETED"
          ? "COMPLETED"
          : record.state === "PREPARED" ||
              record.state === "REFUSED_BEFORE_EXECUTION"
            ? "NOT_STARTED"
            : "UNCERTAIN",
    };
  }
  const record = await attempts.inspect(
    reference.projectId,
    reference.attemptId,
  );
  return {
    authorizationId: record.authorizationId,
    state:
      record.state === "COMPLETED"
        ? "COMPLETED"
        : record.state === "TERMINAL_REJECTED"
          ? "REJECTED"
          : record.state === "PREPARED"
            ? "NOT_STARTED"
            : "UNCERTAIN",
  };
}

/** Reads executor evidence and the canonical conversation; never sends/appends. */
export function conversationTurnRecovery(
  sources: Sources,
  attempts: Pick<ModelAttempts, "inspect">,
  agentAttempts?: Pick<AgentAttempts, "inspect">,
): TurnRecovery {
  return async (claim, reference, receipt) => {
    if (reference === null)
      return receipt?.kind === "REFUSED_BEFORE_EXPOSURE"
        ? receipt
        : {
            kind: "REFUSED_BEFORE_EXPOSURE",
            reason: "LOCAL_EVIDENCE_UNAVAILABLE",
          };
    const unknown = {
      kind: "UNKNOWN_AFTER_EXPOSURE",
      attemptId: reference.attemptId,
    } as const;
    const withheld = {
      kind: "RESPONSE_WITHHELD",
      attemptId: reference.attemptId,
      reason: "SAVE_FAILED",
    } as const;
    try {
      const expectedProject =
        claim.scope.projectId ??
        `general-${digest(claim.scope.conversationId)}`;
      if (reference.projectId !== expectedProject) return unknown;
      const evidence = await evidenceFor(reference, attempts, agentAttempts);
      if (evidence.authorizationId !== reference.authorizationId)
        return unknown;
      if (receipt?.kind === "REFUSED_BEFORE_EXPOSURE") return receipt;
      if (receipt?.kind === "UNKNOWN_AFTER_EXPOSURE") return unknown;
      if (
        receipt?.kind === "RESPONSE_WITHHELD" &&
        receipt.reason !== "SAVE_FAILED"
      )
        return receipt;
      if (evidence.state === "COMPLETED") {
        const stored = await canonicalTurn(
          sources,
          claim.scope,
          reference.attemptId,
        );
        if (
          stored === null ||
          (receipt?.kind === "COMPLETED" &&
            (stored.assistantMessageId !== receipt.assistantMessageId ||
              digest(stored.text) !== receipt.responseDigest))
        )
          return withheld;
        return {
          ...stored,
          ...(receipt?.kind === "COMPLETED" && receipt.protection !== null
            ? { protection: receipt.protection }
            : {}),
        };
      }
      if (evidence.state === "REJECTED")
        return {
          kind: "RESPONSE_WITHHELD",
          attemptId: reference.attemptId,
          reason: "CONTENT_BLOCKED",
        };
      if (evidence.state === "NOT_STARTED")
        return {
          kind: "REFUSED_BEFORE_EXPOSURE",
          reason: "LOCAL_EVIDENCE_UNAVAILABLE",
        };
      return unknown;
    } catch {
      return receipt?.kind === "COMPLETED" ? withheld : unknown;
    }
  };
}

async function canonicalTurn(
  sources: Sources,
  scope: ConversationTurnScope,
  attemptId: string,
): Promise<Extract<ConversationTurnResult, { kind: "COMPLETED" }> | null> {
  if (scope.projectId === null) {
    const conversation = await sources.general.show(scope.conversationId);
    if (
      conversation.id !== scope.conversationId ||
      conversation.scope !== "GENERAL"
    )
      return null;
    const matches = conversation.events.filter(
      (event) =>
        event.type === "AGENT_MESSAGE" &&
        event.provenance.attemptId === attemptId,
    );
    const event = matches[0];
    if (
      matches.length !== 1 ||
      event?.type !== "AGENT_MESSAGE" ||
      event.conversationId !== scope.conversationId ||
      digest(event.content) !== event.contentSha256
    )
      return null;
    return {
      kind: "COMPLETED",
      assistantMessageId: event.id,
      text: event.content,
      effectiveModel: event.provenance.displayName,
      occurredAt: event.occurredAt,
    };
  }
  const sessions = await sources.conversations.sessions.list(scope.projectId);
  const conversation = sessions.find(
    (session) =>
      session.id === scope.conversationId &&
      session.projectId === scope.projectId,
  );
  const matches =
    conversation?.events.filter(
      (event) =>
        event.type === "AGENT_MESSAGE" &&
        generatedSource(event.source.sourceType)?.speaker != null &&
        event.source.sourceSessionId === attemptId,
    ) ?? [];
  const event = matches[0];
  if (
    matches.length !== 1 ||
    !event ||
    event.sessionId !== scope.conversationId ||
    event.payload.kind !== "INLINE_TEXT" ||
    !event.occurredAt ||
    event.source.artifactId !==
      `artifact://sha256/${digest(event.payload.text)}`
  )
    return null;
  return {
    kind: "COMPLETED",
    assistantMessageId: event.id,
    text: event.payload.text,
    effectiveModel: generatedSource(event.source.sourceType)!.speaker!,
    occurredAt: event.occurredAt,
  };
}
