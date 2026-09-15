import { createHash } from "node:crypto";
import type {
  ArtifactStore,
  ImportedSession,
  SessionEvent,
} from "@ai-workspace/session-ingestion";
import type { SessionStore } from "@ai-workspace/session-ingestion";

export type ModelConversationResponse = Readonly<{
  projectId: string;
  conversationId: string;
  attemptId: string;
  model: string;
  text: string;
  occurredAt: string;
}>;
export type ModelConversationWriter = Readonly<{
  store(
    response: ModelConversationResponse,
  ): Promise<
    Readonly<{ sessionId: string; eventId: string; duplicate: boolean }>
  >;
  storeTurn(
    turn: ModelConversationTurn,
  ): Promise<
    Readonly<{ sessionId: string; eventId: string; duplicate: boolean }>
  >;
}>;
export type ModelConversationTurn = ModelConversationResponse &
  Readonly<{ userText: string; targetId: string; displayName: string }>;
const digest = (value: string) =>
  createHash("sha256").update(value, "utf8").digest("hex");
const recordHash = (response: ModelConversationResponse) =>
  digest(
    JSON.stringify({
      attemptId: response.attemptId,
      text: response.text,
      model: response.model,
    }),
  );

/** Stores one generated turn as its own imported-session source. Repeating the
 * same attempt is idempotent; a different payload under that identity is refused. */
export function modelConversationWriter(
  dependencies: Readonly<{
    sessions: SessionStore;
    artifacts: ArtifactStore;
    clock?: () => Date;
  }>,
): ModelConversationWriter {
  return {
    store: async (response) => {
      if (
        !response.projectId.trim() ||
        !response.conversationId.trim() ||
        !response.attemptId.trim() ||
        !response.model.trim() ||
        !response.text.trim() ||
        !response.text.isWellFormed() ||
        Buffer.byteLength(response.text) > 1024 * 1024
      )
        throw new Error("Invalid generated conversation response.");
      const existing = await dependencies.sessions.load(
        response.conversationId,
      );
      if (!existing || existing.projectId !== response.projectId)
        throw new Error("The continuation conversation is unavailable.");
      const previous = existing.events.find(
        (event) =>
          event.source.sourceType === "MODEL_CONVERSATION" &&
          event.source.sourceSessionId === response.attemptId,
      );
      if (previous) {
        if (previous.source.recordHash !== recordHash(response))
          throw new Error(
            "Generated conversation identity is already used by different content.",
          );
        return Object.freeze({
          sessionId: existing.id,
          eventId: previous.id,
          duplicate: true,
        });
      }
      const raw = Buffer.from(response.text, "utf8");
      const artifact = await dependencies.artifacts.put(raw);
      const eventId = `event_${digest(`${existing.id}:${existing.events.length + 1}:${response.attemptId}`)}`;
      const source = Object.freeze({
        artifactId: artifact.id,
        sourceType: "MODEL_CONVERSATION",
        sourceSessionId: response.attemptId,
        position: existing.events.length + 1,
        recordHash: recordHash(response),
      });
      const event: SessionEvent = Object.freeze({
        id: eventId,
        sessionId: existing.id,
        sequence: existing.events.length + 1,
        type: "AGENT_MESSAGE",
        occurredAt: response.occurredAt,
        trust: "UNTRUSTED",
        payload: Object.freeze({
          kind: "ARTIFACT",
          artifact,
          mediaType: "text/plain",
        }),
        source,
      });
      const now = (dependencies.clock ?? (() => new Date()))().toISOString();
      const candidate: ImportedSession = Object.freeze({
        ...existing,
        lastImportedAt: now,
        latestSourceArtifact: artifact,
        events: Object.freeze([...existing.events, event]),
      });
      await dependencies.sessions.append(candidate, existing.events.length);
      return Object.freeze({
        sessionId: existing.id,
        eventId,
        duplicate: false,
      });
    },
    storeTurn: async (turn) => {
      if (
        !turn.projectId.trim() ||
        !turn.conversationId.trim() ||
        !turn.attemptId.trim() ||
        !turn.model.trim() ||
        !turn.targetId.trim() ||
        !turn.displayName.trim() ||
        !turn.userText.trim() ||
        !turn.text.trim() ||
        !turn.userText.isWellFormed() ||
        !turn.text.isWellFormed() ||
        Buffer.byteLength(turn.userText) > 64 * 1024 ||
        Buffer.byteLength(turn.text) > 1024 * 1024
      )
        throw new Error("Invalid generated conversation turn.");
      const existing = await dependencies.sessions.load(turn.conversationId);
      if (!existing || existing.projectId !== turn.projectId)
        throw new Error("The conversation is unavailable.");
      const previous = existing.events.find(
        (event) =>
          event.source.sourceType.startsWith("MODEL_CONVERSATION") &&
          event.source.sourceSessionId === turn.attemptId,
      );
      const turnHash = digest(
        JSON.stringify({
          attemptId: turn.attemptId,
          userText: turn.userText,
          text: turn.text,
          model: turn.model,
          targetId: turn.targetId,
          displayName: turn.displayName,
        }),
      );
      if (previous) {
        if (previous.source.recordHash !== turnHash)
          throw new Error(
            "Generated conversation identity is already used by different content.",
          );
        return Object.freeze({
          sessionId: existing.id,
          eventId: previous.id,
          duplicate: true,
        });
      }
      const artifact = await dependencies.artifacts.put(
        Buffer.from(turn.text, "utf8"),
      );
      const position = existing.events.length + 1;
      const userEvent: SessionEvent = Object.freeze({
        id: `event_${digest(`${existing.id}:${position}:${turn.attemptId}:user`)}`,
        sessionId: existing.id,
        sequence: position,
        type: "USER_MESSAGE",
        occurredAt: turn.occurredAt,
        trust: "UNTRUSTED",
        payload: Object.freeze({ kind: "INLINE_TEXT", text: turn.userText }),
        source: Object.freeze({
          artifactId: existing.latestSourceArtifact.id,
          sourceType: "CONVERSATION_TURN",
          sourceSessionId: turn.attemptId,
          position,
          recordHash: digest(turn.userText),
        }),
      });
      const assistantEvent: SessionEvent = Object.freeze({
        id: `event_${digest(`${existing.id}:${position + 1}:${turn.attemptId}:assistant`)}`,
        sessionId: existing.id,
        sequence: position + 1,
        type: "AGENT_MESSAGE",
        occurredAt: turn.occurredAt,
        trust: "UNTRUSTED",
        payload: Object.freeze({ kind: "INLINE_TEXT", text: turn.text }),
        source: Object.freeze({
          artifactId: artifact.id,
          sourceType: `MODEL_CONVERSATION:${turn.displayName}`,
          sourceSessionId: turn.attemptId,
          position: position + 1,
          recordHash: turnHash,
        }),
      });
      const now = (dependencies.clock ?? (() => new Date()))().toISOString();
      const candidate: ImportedSession = Object.freeze({
        ...existing,
        lastImportedAt: now,
        latestSourceArtifact: artifact,
        events: Object.freeze([...existing.events, userEvent, assistantEvent]),
      });
      await dependencies.sessions.append(candidate, existing.events.length);
      return Object.freeze({
        sessionId: existing.id,
        eventId: assistantEvent.id,
        duplicate: false,
      });
    },
  };
}
