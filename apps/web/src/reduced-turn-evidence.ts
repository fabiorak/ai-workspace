/**
 * Bounded, source-addressable evidence for turns that do not use a handoff.
 *
 * The existing project, General-link, conversation, and active-memory ports
 * load whole documents; they do not currently offer field projections. The
 * collector limits what it retains from those established contracts, then never
 * follows an unlisted relationship. Artifact content has a stricter boundary:
 * it is read only through an explicitly bounded reader after its declared size
 * has passed the per-source gate.
 */
import { createHash } from "node:crypto";

import type { ActiveMemory, MemoryItem } from "@ai-workspace/active-memory";
import type {
  GeneralConversation,
  GeneralConversations,
  GeneralEvent,
} from "@ai-workspace/general-conversation";
import type {
  GeneralProjectLink,
  GeneralProjectLinks,
} from "@ai-workspace/general-project-link";
import { readCanonicalPayload } from "@ai-workspace/historical-search";
import type { ResolvedConversationTurn } from "@ai-workspace/conversation-turn";
import type {
  ImportedSession,
  SessionEvent,
} from "@ai-workspace/session-ingestion";

import type { ConversationSources } from "./conversations.ts";
import { generatedSource } from "./generated-source.ts";

export const REDUCED_TURN_EVIDENCE_LIMITS = Object.freeze({
  events: 128,
  sourceTextBytes: 16 * 1024,
  serializedReadingsBytes: 64 * 1024,
  linkedProjects: 16,
  activeMemoryPerProject: 20,
  activeMemoryTotal: 64,
  serializedMemoryBytes: 64 * 1024,
  sources: 192,
  serializedMetadataBytes: 32 * 1024,
});

export type ReducedTurnEvidenceDependencies = Readonly<{
  conversations: Pick<ConversationSources, "projects" | "sessions">;
  /** Required at runtime for artifact events; unbounded readers are not used. */
  boundedArtifact?: (artifactId: string, maxBytes: number) => Promise<string>;
  general: Pick<GeneralConversations, "show">;
  generalLinks: Pick<GeneralProjectLinks, "list">;
  activeMemory: Pick<ActiveMemory, "list">;
}>;

export type ReducedTurnOmissionReason =
  | "EVENT_LIMIT"
  | "SOURCE_TEXT_LIMIT"
  | "SERIALIZED_READING_LIMIT"
  | "LINKED_PROJECT_LIMIT"
  | "ACTIVE_MEMORY_PER_PROJECT_LIMIT"
  | "ACTIVE_MEMORY_TOTAL_LIMIT"
  | "SERIALIZED_MEMORY_LIMIT"
  | "SOURCE_METADATA_LIMIT";

export type ReducedTurnOmission = Readonly<{
  reason: ReducedTurnOmissionReason;
  /** Exact when `atLeast` is false; otherwise the observed lower bound. */
  count: number;
  /** Null means the store disclosed that material was omitted but not its size. */
  bytes: number | null;
  atLeast: boolean;
}>;

export type ReducedTurnReading = Readonly<{
  type: string;
  text: string;
  occurredAt: string | null;
  eventId: string;
  sessionId: string | null;
  trust: "UNTRUSTED" | "UNVERIFIED";
  provenance: GeneralEvent["provenance"] | SessionEvent["source"];
}>;

export type ReducedTurnMemory = Readonly<{
  id: string;
  projectId: string;
  type: MemoryItem["type"];
  content: string;
  provenance: MemoryItem["sources"];
}>;

export type ReducedTurnEvidenceSource =
  | Readonly<{
      kind: "GENERAL_EVENT";
      eventId: string;
      sessionId: null;
      trust: "UNVERIFIED";
      provenance: GeneralEvent["provenance"];
      contentSha256: string;
    }>
  | Readonly<{
      kind: "SESSION_EVENT";
      eventId: string;
      sessionId: string;
      trust: "UNTRUSTED";
      provenance: SessionEvent["source"];
    }>
  | Readonly<{
      kind: "ACTIVE_MEMORY";
      memoryId: string;
      projectId: string;
      provenance: MemoryItem["sources"];
    }>;

export type ReducedTurnEvidence = Readonly<{
  readings: readonly ReducedTurnReading[];
  linkedProjectMemory: readonly ReducedTurnMemory[];
  omissions: readonly ReducedTurnOmission[];
  sources: readonly ReducedTurnEvidenceSource[];
  accounting: Readonly<{
    selectedEvents: number;
    readingBytes: number;
    linkedProjects: number;
    memoryItems: number;
    memoryBytes: number;
    sourceMetadataBytes: number;
  }>;
}>;

/** A store inconsistency or unavailable authorized source must stop exposure. */
export class ReducedTurnEvidenceError extends Error {
  public constructor(message = "Reduced-turn evidence is unavailable.") {
    super(message);
    this.name = "ReducedTurnEvidenceError";
  }
}

type Scope = ResolvedConversationTurn["scope"];
type OmissionCounts = Map<
  ReducedTurnOmissionReason,
  { count: number; bytes: number | null; atLeast: boolean }
>;

/**
 * Collect the newest admissible conversation evidence and explicitly linked
 * project memory. Intentional budget exclusions are counted; integrity and
 * access failures throw rather than being represented as an empty result.
 */
export async function collectReducedTurnEvidence(
  dependencies: ReducedTurnEvidenceDependencies,
  scope: Scope,
): Promise<ReducedTurnEvidence> {
  assertScope(scope);
  const omissions: OmissionCounts = new Map();
  const readings: ReducedTurnReading[] = [];
  const memory: ReducedTurnMemory[] = [];
  const sources: ReducedTurnEvidenceSource[] = [];
  let readingBytes = 2;
  let memoryBytes = 2;
  let metadataBytes = 2;

  const addOmission = (
    reason: ReducedTurnOmissionReason,
    count: number,
    bytes: number | null,
    atLeast = false,
  ): void => {
    const previous = omissions.get(reason) ?? {
      count: 0,
      bytes: 0,
      atLeast: false,
    };
    omissions.set(reason, {
      count: previous.count + count,
      bytes:
        previous.bytes === null || bytes === null
          ? null
          : previous.bytes + bytes,
      atLeast: previous.atLeast || atLeast,
    });
  };
  const addSource = (source: ReducedTurnEvidenceSource): boolean => {
    const nextBytes = serializedArrayBytes(sources, source);
    if (
      sources.length >= REDUCED_TURN_EVIDENCE_LIMITS.sources ||
      nextBytes > REDUCED_TURN_EVIDENCE_LIMITS.serializedMetadataBytes
    )
      return false;
    sources.push(Object.freeze(source));
    metadataBytes = nextBytes;
    return true;
  };
  const addReading = (
    reading: ReducedTurnReading,
    source: ReducedTurnEvidenceSource,
  ): void => {
    const nextBytes = serializedArrayBytes(readings, reading);
    if (nextBytes > REDUCED_TURN_EVIDENCE_LIMITS.serializedReadingsBytes) {
      addOmission("SERIALIZED_READING_LIMIT", 1, utf8Bytes(reading.text));
      return;
    }
    if (!addSource(source)) {
      addOmission("SOURCE_METADATA_LIMIT", 1, utf8Bytes(reading.text));
      return;
    }
    readings.push(Object.freeze(reading));
    readingBytes = nextBytes;
  };

  const projects = await dependencies.conversations.projects();
  const registeredProjectIds = registeredProjectIdsOf(projects);
  let linkedProjectIds: readonly string[];

  if (scope.projectId === null) {
    const [conversation, links] = await Promise.all([
      dependencies.general.show(scope.conversationId),
      dependencies.generalLinks.list(),
    ]);
    validateGeneralConversation(conversation, scope.conversationId);
    assertUniqueEventIds(conversation.events);
    const selected = newest(conversation.events, omissions);
    for (const event of selected) {
      validateGeneralEvent(event, conversation.id);
      const bytes = utf8Bytes(event.content);
      if (bytes > REDUCED_TURN_EVIDENCE_LIMITS.sourceTextBytes) {
        addOmission("SOURCE_TEXT_LIMIT", 1, bytes);
        continue;
      }
      addReading(
        Object.freeze({
          type: event.type,
          text: event.content,
          occurredAt: event.occurredAt,
          eventId: event.id,
          sessionId: null,
          trust: event.verification,
          provenance: event.provenance,
        }),
        Object.freeze({
          kind: "GENERAL_EVENT",
          eventId: event.id,
          sessionId: null,
          trust: event.verification,
          provenance: event.provenance,
          contentSha256: event.contentSha256,
        }),
      );
    }
    linkedProjectIds = linkedProjectsOf(
      links,
      conversation,
      registeredProjectIds,
      addOmission,
    );
  } else {
    if (!registeredProjectIds.has(scope.projectId))
      throw new ReducedTurnEvidenceError(
        "The project scope is not registered.",
      );
    const sessions = await dependencies.conversations.sessions.list(
      scope.projectId,
    );
    const matches = sessions.filter(
      (candidate) => candidate.id === scope.conversationId,
    );
    if (matches.length === 0)
      throw new ReducedTurnEvidenceError("The scoped session was not found.");
    if (matches.length !== 1)
      throw new ReducedTurnEvidenceError("The scoped session is ambiguous.");
    const [session] = matches;
    if (session === undefined)
      throw new ReducedTurnEvidenceError("The scoped session was not found.");
    validateSession(session, scope);
    assertUniqueEventIds(session.events);
    const selected = newest(session.events, omissions);
    for (const event of selected) {
      validateSessionEvent(event, session);
      const text = await sessionText(
        dependencies.boundedArtifact,
        event,
        addOmission,
      );
      if (text === null) continue;
      addReading(
        Object.freeze({
          type: event.type,
          text,
          occurredAt: event.occurredAt,
          eventId: event.id,
          sessionId: event.sessionId,
          trust: event.trust,
          provenance: event.source,
        }),
        Object.freeze({
          kind: "SESSION_EVENT",
          eventId: event.id,
          sessionId: event.sessionId,
          trust: event.trust,
          provenance: event.source,
        }),
      );
    }
    linkedProjectIds = Object.freeze([scope.projectId]);
  }

  let totalMemory = 0;
  for (const projectId of linkedProjectIds) {
    const page = await dependencies.activeMemory.list({
      projectId,
      validity: "ACTIVE",
      limit: REDUCED_TURN_EVIDENCE_LIMITS.activeMemoryPerProject,
    });
    if (!Array.isArray(page.items))
      throw new ReducedTurnEvidenceError(
        "Active memory returned an invalid page.",
      );
    if (page.items.length > REDUCED_TURN_EVIDENCE_LIMITS.activeMemoryPerProject)
      throw new ReducedTurnEvidenceError(
        "Active memory ignored the requested bound.",
      );
    if (page.nextCursor !== null && typeof page.nextCursor !== "string")
      throw new ReducedTurnEvidenceError(
        "Active memory returned an invalid cursor.",
      );
    if (page.nextCursor !== null)
      addOmission("ACTIVE_MEMORY_PER_PROJECT_LIMIT", 1, null, true);
    for (const item of page.items) {
      validateMemory(item, projectId);
      if (totalMemory >= REDUCED_TURN_EVIDENCE_LIMITS.activeMemoryTotal) {
        addOmission("ACTIVE_MEMORY_TOTAL_LIMIT", 1, utf8Bytes(item.content));
        continue;
      }
      const entry: ReducedTurnMemory = Object.freeze({
        id: item.id,
        projectId,
        type: item.type,
        content: item.content,
        provenance: item.sources,
      });
      const nextMemoryBytes = serializedArrayBytes(memory, entry);
      if (
        nextMemoryBytes > REDUCED_TURN_EVIDENCE_LIMITS.serializedMemoryBytes
      ) {
        addOmission("SERIALIZED_MEMORY_LIMIT", 1, utf8Bytes(item.content));
        continue;
      }
      const source: ReducedTurnEvidenceSource = Object.freeze({
        kind: "ACTIVE_MEMORY",
        memoryId: item.id,
        projectId,
        provenance: item.sources,
      });
      if (!addSource(source)) {
        addOmission("SOURCE_METADATA_LIMIT", 1, utf8Bytes(item.content));
        continue;
      }
      memory.push(entry);
      memoryBytes = nextMemoryBytes;
      totalMemory += 1;
    }
  }

  return Object.freeze({
    readings: Object.freeze(readings),
    linkedProjectMemory: Object.freeze(memory),
    omissions: freezeOmissions(omissions),
    sources: Object.freeze(sources),
    accounting: Object.freeze({
      selectedEvents: readings.length,
      readingBytes,
      linkedProjects: linkedProjectIds.length,
      memoryItems: memory.length,
      memoryBytes,
      sourceMetadataBytes: metadataBytes,
    }),
  });
}

async function sessionText(
  boundedArtifact: ReducedTurnEvidenceDependencies["boundedArtifact"],
  event: SessionEvent,
  addOmission: (
    reason: ReducedTurnOmissionReason,
    count: number,
    bytes: number | null,
    atLeast?: boolean,
  ) => void,
): Promise<string | null> {
  if (event.payload.kind === "INLINE_TEXT") {
    const bytes = utf8Bytes(event.payload.text);
    if (bytes > REDUCED_TURN_EVIDENCE_LIMITS.sourceTextBytes) {
      addOmission("SOURCE_TEXT_LIMIT", 1, bytes);
      return null;
    }
    return generatedSource(event.source.sourceType)
      ? event.payload.text
      : readCanonicalPayload(event.payload.text).text;
  }
  const declaredBytes = event.payload.artifact.byteLength;
  if (
    !Number.isSafeInteger(declaredBytes) ||
    declaredBytes < 0 ||
    declaredBytes > REDUCED_TURN_EVIDENCE_LIMITS.sourceTextBytes
  ) {
    addOmission(
      "SOURCE_TEXT_LIMIT",
      1,
      Number.isSafeInteger(declaredBytes) ? Math.max(0, declaredBytes) : null,
    );
    return null;
  }
  if (boundedArtifact === undefined)
    throw new ReducedTurnEvidenceError(
      "A scoped artifact reader is unavailable.",
    );
  let raw: string;
  try {
    raw = await boundedArtifact(
      event.payload.artifact.id,
      REDUCED_TURN_EVIDENCE_LIMITS.sourceTextBytes,
    );
  } catch (error) {
    throw unavailable("The authorized artifact could not be read.", error);
  }
  if (typeof raw !== "string")
    throw new ReducedTurnEvidenceError(
      "The artifact reader returned invalid content.",
    );
  if (utf8Bytes(raw) > REDUCED_TURN_EVIDENCE_LIMITS.sourceTextBytes)
    throw new ReducedTurnEvidenceError(
      "Artifact content exceeded its declared read bound.",
    );
  return generatedSource(event.source.sourceType)
    ? raw
    : readCanonicalPayload(raw).text;
}

function linkedProjectsOf(
  links: readonly GeneralProjectLink[],
  conversation: GeneralConversation,
  registeredProjectIds: ReadonlySet<string>,
  addOmission: (
    reason: ReducedTurnOmissionReason,
    count: number,
    bytes: number | null,
    atLeast?: boolean,
  ) => void,
): readonly string[] {
  const eventById = new Map(
    conversation.events.map((event) => [event.id, event]),
  );
  const projects = new Set<string>();
  for (const link of links) {
    if (link.generalConversationId !== conversation.id) continue;
    validateLink(link, conversation, eventById, registeredProjectIds);
    projects.add(link.targetProjectId);
  }
  const ordered = [...projects].sort((left, right) =>
    left.localeCompare(right, "en"),
  );
  if (ordered.length > REDUCED_TURN_EVIDENCE_LIMITS.linkedProjects)
    addOmission(
      "LINKED_PROJECT_LIMIT",
      ordered.length - REDUCED_TURN_EVIDENCE_LIMITS.linkedProjects,
      null,
    );
  return Object.freeze(
    ordered.slice(0, REDUCED_TURN_EVIDENCE_LIMITS.linkedProjects),
  );
}

function newest<T>(
  events: readonly T[],
  omissions: OmissionCounts,
): readonly T[] {
  const omitted = Math.max(
    0,
    events.length - REDUCED_TURN_EVIDENCE_LIMITS.events,
  );
  if (omitted > 0)
    omissions.set("EVENT_LIMIT", {
      count: omitted,
      bytes: null,
      atLeast: false,
    });
  return events.slice(-REDUCED_TURN_EVIDENCE_LIMITS.events);
}

function validateGeneralConversation(
  conversation: GeneralConversation,
  expectedId: string,
): void {
  if (conversation.id !== expectedId || conversation.scope !== "GENERAL")
    throw new ReducedTurnEvidenceError(
      "General evidence crossed its declared scope.",
    );
}

function validateGeneralEvent(
  event: GeneralEvent,
  conversationId: string,
): void {
  assertIdentifier(event.id, "General event ID");
  if (event.scope !== "GENERAL" || event.conversationId !== conversationId)
    throw new ReducedTurnEvidenceError(
      "General event crossed its declared scope.",
    );
  if (event.verification !== "UNVERIFIED")
    throw new ReducedTurnEvidenceError(
      "General event verification is invalid.",
    );
  if (
    event.exactBytes !== utf8Bytes(event.content) ||
    event.contentSha256 !== sha256(event.content)
  )
    throw new ReducedTurnEvidenceError(
      "General event integrity verification failed.",
    );
}

function validateLink(
  link: GeneralProjectLink,
  conversation: GeneralConversation,
  eventById: ReadonlyMap<string, GeneralEvent>,
  registeredProjectIds: ReadonlySet<string>,
): void {
  const event = eventById.get(link.generalEventId);
  if (
    link.sourceScope !== "GENERAL" ||
    link.targetScope !== "PROJECT" ||
    link.generalConversationId !== conversation.id ||
    event === undefined ||
    event.conversationId !== conversation.id ||
    link.generalContentSha256 !== event.contentSha256 ||
    !registeredProjectIds.has(link.targetProjectId)
  )
    throw new ReducedTurnEvidenceError(
      "A General project link is stale or cross-scope.",
    );
}

function validateSession(session: ImportedSession, scope: Scope): void {
  if (
    scope.projectId === null ||
    session.id !== scope.conversationId ||
    session.projectId !== scope.projectId
  )
    throw new ReducedTurnEvidenceError(
      "Session evidence crossed its declared scope.",
    );
  assertIdentifier(session.id, "Session ID");
}

function validateSessionEvent(
  event: SessionEvent,
  session: ImportedSession,
): void {
  assertIdentifier(event.id, "Session event ID");
  if (event.sessionId !== session.id || event.trust !== "UNTRUSTED")
    throw new ReducedTurnEvidenceError(
      "Session event integrity verification failed.",
    );
  assertIdentifier(event.source.artifactId, "Source artifact ID");
  assertIdentifier(event.source.sourceSessionId, "Source session ID");
  if (
    typeof event.source.sourceType !== "string" ||
    event.source.sourceType.length === 0 ||
    !Number.isSafeInteger(event.source.position) ||
    event.source.position < 0 ||
    !isSha256(event.source.recordHash)
  )
    throw new ReducedTurnEvidenceError("Session source provenance is invalid.");
  if (event.payload.kind === "ARTIFACT")
    assertIdentifier(event.payload.artifact.id, "Event artifact ID");
}

function validateMemory(item: MemoryItem, projectId: string): void {
  assertIdentifier(item.id, "Memory ID");
  if (
    item.projectId !== projectId ||
    item.validity !== "ACTIVE" ||
    !Array.isArray(item.sources)
  )
    throw new ReducedTurnEvidenceError(
      "Active memory crossed its declared project scope.",
    );
  for (const source of item.sources) {
    assertIdentifier(source.eventId, "Memory source event ID");
    assertIdentifier(source.sessionId, "Memory source session ID");
    assertIdentifier(source.sourceArtifactId, "Memory source artifact ID");
    if (
      source.trust !== "UNTRUSTED" ||
      !Number.isSafeInteger(source.sourcePosition) ||
      source.sourcePosition < 0 ||
      !isSha256(source.sourceRecordHash)
    )
      throw new ReducedTurnEvidenceError(
        "Active memory provenance is invalid.",
      );
  }
}

function registeredProjectIdsOf(
  projects: readonly Readonly<{ id: string; name: string }>[],
): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const project of projects) {
    assertIdentifier(project.id, "Project ID");
    if (ids.has(project.id))
      throw new ReducedTurnEvidenceError(
        "Registered projects contain a duplicate ID.",
      );
    ids.add(project.id);
  }
  return ids;
}

function assertScope(scope: Scope): void {
  assertIdentifier(scope.conversationId, "Conversation ID");
  if (scope.projectId !== null) assertIdentifier(scope.projectId, "Project ID");
  if (scope.workItemId !== null)
    assertIdentifier(scope.workItemId, "Work item ID");
  if (scope.handoffId !== null) assertIdentifier(scope.handoffId, "Handoff ID");
}

function assertUniqueEventIds(
  events: readonly Readonly<{ id: string }>[],
): void {
  const ids = new Set<string>();
  for (const event of events) {
    assertIdentifier(event.id, "Event ID");
    if (ids.has(event.id))
      throw new ReducedTurnEvidenceError(
        "Evidence contains a duplicate event ID.",
      );
    ids.add(event.id);
  }
}

function assertIdentifier(value: string, label: string): void {
  if (typeof value !== "string" || value.length === 0 || utf8Bytes(value) > 256)
    throw new ReducedTurnEvidenceError(`${label} is invalid.`);
}

function freezeOmissions(
  omissions: OmissionCounts,
): readonly ReducedTurnOmission[] {
  return Object.freeze(
    [...omissions.entries()]
      .sort(([left], [right]) => left.localeCompare(right, "en"))
      .map(([reason, value]) => Object.freeze({ reason, ...value })),
  );
}

function serializedArrayBytes<T>(items: readonly T[], next: T): number {
  return utf8Bytes(JSON.stringify([...items, next]));
}

function utf8Bytes(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function isSha256(value: string): boolean {
  return /^[a-f0-9]{64}$/u.test(value);
}

function unavailable(
  message: string,
  cause: unknown,
): ReducedTurnEvidenceError {
  const error = new ReducedTurnEvidenceError(message);
  error.cause = cause;
  return error;
}
