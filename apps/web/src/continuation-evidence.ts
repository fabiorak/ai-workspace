import { readCanonicalPayload } from "@ai-workspace/historical-search";
import type { WorkItem } from "@ai-workspace/core";
import type { ConversationSources } from "./conversations.ts";

/** Current source readings, not amendments to the user's kept photograph. */
export async function continuationEvidence(
  sources: ConversationSources,
  work: WorkItem,
) {
  const linked = new Set(work.sources.map((source) => source.sessionId));
  const sessions = (await sources.sessions.list(work.projectId)).filter(
    (session) => {
      if (session.projectId !== work.projectId)
        throw new Error("INCOHERENT_DATA");
      return linked.has(session.id);
    },
  );
  const events = sessions
    .flatMap((session) => session.events)
    .sort(
      (a, b) =>
        (b.occurredAt ?? "").localeCompare(a.occurredAt ?? "") ||
        b.sequence - a.sequence ||
        a.id.localeCompare(b.id),
    );
  const readings: {
    eventId: string;
    sessionId: string;
    occurredAt: string | null;
    type: string;
    trust: "UNTRUSTED";
    text: string;
  }[] = [];
  const omitted: { eventId: string; reason: string }[] = [];
  let bytes = 0;
  for (const [index, event] of events.entries()) {
    if (index >= 128) {
      omitted.push({ eventId: event.id, reason: "EVENT_LIMIT" });
      continue;
    }
    if (
      event.payload.kind === "ARTIFACT" &&
      event.payload.artifact.byteLength > 16384
    ) {
      omitted.push({ eventId: event.id, reason: "ARTIFACT_LIMIT" });
      continue;
    }
    let text: string;
    try {
      const raw =
        event.payload.kind === "INLINE_TEXT"
          ? event.payload.text
          : await sources.artifact?.(event.payload.artifact.id);
      if (raw === undefined) throw new Error("UNAVAILABLE");
      text = event.source.sourceType.startsWith("MODEL_CONVERSATION")
        ? raw
        : readCanonicalPayload(raw).text;
    } catch {
      omitted.push({ eventId: event.id, reason: "UNREADABLE" });
      continue;
    }
    const reading = {
      eventId: event.id,
      sessionId: event.sessionId,
      occurredAt: event.occurredAt,
      type: event.type,
      trust: "UNTRUSTED" as const,
      text,
    };
    const size = Buffer.byteLength(JSON.stringify(reading));
    if (bytes + size > 65536) {
      omitted.push({ eventId: event.id, reason: "EVIDENCE_BUDGET" });
      continue;
    }
    bytes += size;
    readings.push(reading);
  }
  return {
    provenance: "CURRENT_LINKED_SESSION_READINGS_NOT_REVIEWED_HANDOFF",
    readings,
    omitted,
    bytes,
  };
}
