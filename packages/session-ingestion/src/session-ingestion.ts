import { createHash } from "node:crypto";
import { TextEncoder } from "node:util";

import { SessionImportError, SessionNotFoundError } from "./errors.ts";
import type {
  EventPayload,
  ImportedSession,
  SessionEvent,
  SessionImportReport,
  SessionSource,
  SourceEvent,
} from "./model.ts";
import type {
  ArtifactStore,
  Clock,
  ProjectLookup,
  RestrictedDataScreen,
  SessionSourceAdapter,
  SessionStore,
} from "./ports.ts";

const INLINE_PAYLOAD_LIMIT = 4_096;
const encoder = new TextEncoder();

export type SessionIngestionDependencies = Readonly<{
  sourceAdapter: SessionSourceAdapter;
  screen: RestrictedDataScreen;
  artifactStore: ArtifactStore;
  sessionStore: SessionStore;
  projects: ProjectLookup;
  clock?: Clock;
}>;

export class SessionIngestion {
  readonly #sourceAdapter: SessionSourceAdapter;
  readonly #screen: RestrictedDataScreen;
  readonly #artifactStore: ArtifactStore;
  readonly #sessionStore: SessionStore;
  readonly #projects: ProjectLookup;
  readonly #clock: Clock;

  public constructor(dependencies: SessionIngestionDependencies) {
    this.#sourceAdapter = dependencies.sourceAdapter;
    this.#screen = dependencies.screen;
    this.#artifactStore = dependencies.artifactStore;
    this.#sessionStore = dependencies.sessionStore;
    this.#projects = dependencies.projects;
    this.#clock = dependencies.clock ?? (() => new Date());
  }

  public async import(
    projectId: string,
    filePath: string,
  ): Promise<SessionImportReport> {
    if (!(await this.#projects.exists(projectId))) {
      throw new SessionImportError(`Project '${projectId}' is not registered`);
    }

    const source = await this.#sourceAdapter.read(filePath);
    this.#validateSource(source);
    this.#screen.assertAllowed(source.rawContent, "session source");

    for (const event of source.events) {
      this.#screen.assertAllowed(
        encoder.encode(event.payload),
        `source record ${event.position}`,
      );
    }

    const sessionId = stableId(
      "session",
      source.sourceType,
      source.sourceSessionId,
    );
    const existing = await this.#sessionStore.load(sessionId);
    this.#validateExisting(existing, projectId, source);
    this.#validatePrefix(existing, source);

    const sourceArtifact = await this.#artifactStore.put(source.rawContent);
    const existingCount = existing?.events.length ?? 0;
    const newEvents: SessionEvent[] = [];

    for (const sourceEvent of source.events.slice(existingCount)) {
      newEvents.push(
        await this.#createEvent(
          sessionId,
          source,
          sourceEvent,
          sourceArtifact.id,
        ),
      );
    }

    const importedAt = this.#clock().toISOString();
    const session: ImportedSession = Object.freeze({
      id: sessionId,
      projectId,
      sourceType: source.sourceType,
      sourceSessionId: source.sourceSessionId,
      agent: source.agent,
      model: source.model,
      startedAt: source.startedAt,
      createdAt: existing?.createdAt ?? importedAt,
      lastImportedAt: importedAt,
      latestSourceArtifact: sourceArtifact,
      events: Object.freeze([...(existing?.events ?? []), ...newEvents]),
    });

    await this.#sessionStore.append(session, existingCount);

    return Object.freeze({
      session,
      addedEvents: newEvents.length,
      existingEvents: existingCount,
      totalEvents: session.events.length,
    });
  }

  public async inspect(sessionId: string): Promise<ImportedSession> {
    const session = await this.#sessionStore.load(sessionId);

    if (session === null) {
      throw new SessionNotFoundError(sessionId);
    }

    return session;
  }

  async #createEvent(
    sessionId: string,
    source: SessionSource,
    sourceEvent: SourceEvent,
    sourceArtifactId: string,
  ): Promise<SessionEvent> {
    const recordHash = hash(sourceEvent.rawRecord);
    const payloadBytes = encoder.encode(sourceEvent.payload);
    let payload: EventPayload;

    if (payloadBytes.byteLength <= INLINE_PAYLOAD_LIMIT) {
      payload = Object.freeze({
        kind: "INLINE_TEXT" as const,
        text: sourceEvent.payload,
      });
    } else {
      const artifact = await this.#artifactStore.put(payloadBytes);
      payload = Object.freeze({
        kind: "ARTIFACT" as const,
        artifact,
        mediaType: "application/json" as const,
      });
    }

    return Object.freeze({
      id: stableId(
        "event",
        sessionId,
        String(sourceEvent.position),
        recordHash,
      ),
      sessionId,
      sequence: sourceEvent.position,
      type: sourceEvent.type,
      occurredAt: sourceEvent.occurredAt,
      trust: "UNTRUSTED" as const,
      payload,
      source: Object.freeze({
        artifactId: sourceArtifactId,
        sourceType: source.sourceType,
        sourceSessionId: source.sourceSessionId,
        position: sourceEvent.position,
        recordHash,
      }),
    });
  }

  #validateSource(source: SessionSource): void {
    if (source.sourceType !== this.#sourceAdapter.sourceType) {
      throw new SessionImportError(
        "The source adapter returned a different source type",
      );
    }

    if (
      source.sourceSessionId.trim().length === 0 ||
      source.agent.trim().length === 0
    ) {
      throw new SessionImportError("The session source identity is incomplete");
    }

    for (const [index, event] of source.events.entries()) {
      if (event.position !== index + 1) {
        throw new SessionImportError(
          `The session source has invalid ordering at record ${index + 1}`,
        );
      }
    }
  }

  #validateExisting(
    existing: ImportedSession | null,
    projectId: string,
    source: SessionSource,
  ): void {
    if (existing === null) {
      return;
    }

    if (
      existing.projectId !== projectId ||
      existing.sourceType !== source.sourceType ||
      existing.sourceSessionId !== source.sourceSessionId ||
      existing.agent !== source.agent ||
      existing.model !== source.model ||
      existing.startedAt !== source.startedAt
    ) {
      throw new SessionImportError(
        "The imported session identity conflicts with stored metadata",
      );
    }
  }

  #validatePrefix(
    existing: ImportedSession | null,
    source: SessionSource,
  ): void {
    if (existing === null) {
      return;
    }

    if (source.events.length < existing.events.length) {
      throw new SessionImportError(
        "The session source was truncated after its previous import",
      );
    }

    for (const existingEvent of existing.events) {
      const sourceEvent = source.events[existingEvent.sequence - 1];

      if (
        sourceEvent === undefined ||
        hash(sourceEvent.rawRecord) !== existingEvent.source.recordHash
      ) {
        throw new SessionImportError(
          `The session source changed at record ${existingEvent.sequence}`,
        );
      }
    }
  }
}

function stableId(prefix: string, ...parts: readonly string[]): string {
  return `${prefix}_${hash(encoder.encode(parts.join("\u0000")))}`;
}

function hash(content: Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}
