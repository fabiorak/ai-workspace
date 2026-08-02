import {
  TolerantRetrievalIndex,
  readCanonicalPayload,
  type RetrievalRecord,
} from "@ai-workspace/tolerant-retrieval";

import {
  HistoricalEventNotFoundError,
  HistoricalSearchError,
} from "./errors.ts";
import type {
  HistoricalEvent,
  GlobalHistoricalSearchQuery,
  GlobalHistoricalSearchReport,
  HistoricalSearchQuery,
  HistoricalSearchReport,
  HistoricalSearchResult,
  ScopedHistoricalSearchQuery,
  ScopedHistoricalSearchReport,
  ScopedHistoricalSearchResult,
  OpenedArtifact,
} from "./model.ts";
import type { HistoricalSearchDependencies } from "./ports.ts";
import { assertProject, decodeArtifact, requiredValue } from "./shared.ts";
import {
  TolerantHistoricalIndex,
  eventProvenance,
} from "./tolerant-historical-index.ts";
import type { TolerantHistoricalReport } from "./model.ts";
import { snippetOf } from "./snippet.ts";

type MatchedIn = HistoricalSearchResult["matchedIn"];

type GeneralEvent = Awaited<
  ReturnType<NonNullable<HistoricalSearchDependencies["general"]>["list"]>
>[number]["events"][number];

/**
 * Where a ranked all-scope result came from. The engine returns positions in
 * the record list it was given, so the two scopes are put back together here
 * rather than being told apart by inspecting a result.
 */
type ScopedOrigin =
  | Readonly<{
      scope: "PROJECT";
      listed: HistoricalEvent;
      text: string;
      matchedIn: MatchedIn;
    }>
  | Readonly<{ scope: "GENERAL"; event: GeneralEvent }>;

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MAX_ARTIFACT_DISPLAY_BYTES = 64 * 1024;
const MAX_GLOBAL_PROJECTS = 100;
const MAX_GLOBAL_EVENTS = 10_000;

export class HistoricalSearch {
  readonly #dependencies: HistoricalSearchDependencies;
  #index: TolerantHistoricalIndex | null = null;
  #indexedProjects: string | null = null;

  public constructor(dependencies: HistoricalSearchDependencies) {
    this.#dependencies = dependencies;
  }

  /**
   * Drops the cached index, so the next search rebuilds it from the canonical
   * sources. Ingestion calls this: an index is derived data, and an instance
   * that outlives a write would otherwise answer from sources that have moved.
   *
   * A command-line process that never searches pays nothing for this, because
   * nothing is built until the first search asks for it.
   */
  public invalidate(): void {
    this.#index = null;
    this.#indexedProjects = null;
  }

  /**
   * The cached index, built on first use. One selection of projects is held at
   * a time: asking about a different selection replaces the previous index
   * rather than keeping both, so what an instance holds stays bounded by the
   * same declared record bound that bounds a single index.
   *
   * A stale index is dropped rather than queried. Invalidation fails closed in
   * the engine, and rebuilding here is the honest reading of it: the caller
   * asked a question about the present, not about the state the index froze.
   */
  async #indexFor(
    projectIds: readonly string[],
  ): Promise<TolerantHistoricalIndex> {
    const key = [...projectIds].sort((left, right) =>
      left.localeCompare(right, "en"),
    );
    const identity = JSON.stringify(key);
    const cached = this.#index;
    if (
      cached !== null &&
      this.#indexedProjects === identity &&
      !cached.isStale
    )
      return cached;
    const built = await TolerantHistoricalIndex.build(
      this.#dependencies,
      projectIds,
    );
    this.#index = built;
    this.#indexedProjects = identity;
    return built;
  }

  /**
   * The event results of a tolerant report, in the shape this API has always
   * published. Active memory is ranked in the same list by the surface, but
   * these reports are typed for events and their consumers render events, so
   * widening them here would change what a caller receives without any caller
   * asking for it.
   */
  #eventResults(report: TolerantHistoricalReport): HistoricalSearchResult[] {
    const results: HistoricalSearchResult[] = [];
    for (const found of report.results) {
      if (found.store !== "SESSION_EVENTS") continue;
      results.push(
        Object.freeze({
          eventId: found.eventId,
          projectId: found.projectId,
          sessionId: found.sessionId,
          sequence: found.sequence,
          type: found.type,
          occurredAt: found.occurredAt,
          trust: found.trust,
          snippet: found.snippet,
          matchedIn: found.matchedIn,
          source: found.source,
          score: found.score,
          reasons: found.reasons,
        }),
      );
    }
    return results;
  }

  public async search(
    query: HistoricalSearchQuery,
  ): Promise<HistoricalSearchReport> {
    const projectId = requiredValue(query.projectId, "Project ID");
    const text = requiredValue(query.text, "Search text");
    const limit = query.limit ?? DEFAULT_LIMIT;

    if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
      throw new HistoricalSearchError(
        `Search limit must be an integer from 1 to ${MAX_LIMIT}. Omit --limit to use ${DEFAULT_LIMIT}.`,
      );
    }

    await assertProject(this.#dependencies.projects, projectId);
    const index = await this.#indexFor([projectId]);
    const filter = Object.freeze({
      store: "SESSION_EVENTS" as const,
      projectId,
      ...(query.sessionId === undefined ? {} : { sessionId: query.sessionId }),
      ...(query.type === undefined ? {} : { type: query.type }),
    });
    const results = this.#eventResults(index.search(text, { limit, filter }));

    return Object.freeze({
      query: Object.freeze({
        projectId,
        text,
        sessionId: query.sessionId ?? null,
        type: query.type ?? null,
        limit,
      }),
      searchedEvents: index.countIndexedEvents(filter),
      results: Object.freeze(results),
    });
  }

  public async searchAcrossProjects(
    query: GlobalHistoricalSearchQuery,
  ): Promise<GlobalHistoricalSearchReport> {
    const text = requiredValue(query.text, "Search text");
    const limit = searchLimit(query.limit);
    if (
      !Array.isArray(query.projectIds) ||
      query.projectIds.length < 1 ||
      query.projectIds.length > MAX_GLOBAL_PROJECTS
    )
      throw new HistoricalSearchError(
        `Global search requires from 1 to ${MAX_GLOBAL_PROJECTS} registered project IDs. Select one project or migrate to an indexed adapter when this bound is exceeded.`,
      );
    const projectIds = query.projectIds.map((projectId) =>
      requiredValue(projectId, "Project ID"),
    );
    if (new Set(projectIds).size !== projectIds.length)
      throw new HistoricalSearchError(
        "Global search project IDs must be unique. Reload registered projects and retry.",
      );
    projectIds.sort((left, right) => left.localeCompare(right, "en"));
    for (const projectId of projectIds)
      await assertProject(this.#dependencies.projects, projectId);

    let index: TolerantHistoricalIndex;
    try {
      index = await this.#indexFor(projectIds);
    } catch (error) {
      /**
       * A refusal is an answer this method already gives, so it is passed
       * through as it stands: it names the bound that was exceeded and what to
       * do about it. Anything else is a read that did not complete, and no
       * partial result is built from it.
       */
      if (error instanceof HistoricalSearchError) throw error;
      throw new HistoricalSearchError(
        "Global history could not be read safely. Preserve local state, select one project to diagnose it, and retry without using partial results.",
        { cause: error },
      );
    }

    const filter = Object.freeze({
      store: "SESSION_EVENTS" as const,
      ...(query.type === undefined ? {} : { type: query.type }),
    });
    let results: HistoricalSearchResult[];
    try {
      results = this.#eventResults(index.search(text, { limit, filter }));
    } catch (error) {
      throw new HistoricalSearchError(
        "Global historical evidence could not be searched safely. Preserve local state, select one project to diagnose it, and retry without using partial results.",
        { cause: error },
      );
    }
    return Object.freeze({
      query: Object.freeze({
        projectIds: Object.freeze(projectIds),
        text,
        type: query.type ?? null,
        limit,
      }),
      searchedProjects: projectIds.length,
      searchedEvents: index.countIndexedEvents(filter),
      results: Object.freeze(results),
    });
  }

  public async searchAcrossScopes(
    query: ScopedHistoricalSearchQuery,
  ): Promise<ScopedHistoricalSearchReport> {
    const text = requiredValue(query.text, "Search text");
    const limit = searchLimit(query.limit);
    const associatedProjectId =
      query.associatedProjectId === undefined
        ? null
        : requiredValue(query.associatedProjectId, "Associated project ID");
    if (query.scope !== "GENERAL_ONLY" && query.scope !== "ALL_SCOPES")
      throw new HistoricalSearchError(
        "Search scope must be GENERAL_ONLY or ALL_SCOPES.",
      );
    if (
      !Array.isArray(query.projectIds) ||
      query.projectIds.length > MAX_GLOBAL_PROJECTS
    )
      throw new HistoricalSearchError(
        `All-scope search accepts at most ${MAX_GLOBAL_PROJECTS} registered project IDs.`,
      );
    const projectIds = query.projectIds.map((id) =>
      requiredValue(id, "Project ID"),
    );
    if (new Set(projectIds).size !== projectIds.length)
      throw new HistoricalSearchError("All-scope project IDs must be unique.");
    projectIds.sort((left, right) => left.localeCompare(right, "en"));
    if (query.scope === "GENERAL_ONLY" && projectIds.length !== 0)
      throw new HistoricalSearchError(
        "GENERAL_ONLY search cannot include project IDs.",
      );
    if (this.#dependencies.general === undefined)
      throw new HistoricalSearchError(
        "General conversation search is not configured in this application.",
      );
    if (associatedProjectId !== null && this.#dependencies.links === undefined)
      throw new HistoricalSearchError(
        "Associated-project search is not configured in this application.",
      );
    if (
      associatedProjectId !== null &&
      !(await this.#dependencies.projects.exists(associatedProjectId))
    )
      throw new HistoricalSearchError(
        "The associated-project filter must name a registered project.",
      );

    try {
      const projectEvents: HistoricalEvent[] = [];
      if (query.scope === "ALL_SCOPES") {
        for (const projectId of projectIds) {
          await assertProject(this.#dependencies.projects, projectId);
          const events = await this.#dependencies.events.list(projectId);
          if (events.some((event) => event.projectId !== projectId))
            throw new Error("cross-scope project event");
          projectEvents.push(...events);
        }
      }
      const conversations = await this.#dependencies.general.list();
      const generalEvents = conversations.flatMap((conversation) => {
        if (
          conversation.scope !== "GENERAL" ||
          conversation.events.some(
            (event) =>
              event.conversationId !== conversation.id ||
              event.scope !== "GENERAL",
          )
        )
          throw new Error("cross-scope General event");
        return conversation.events;
      });
      const links =
        this.#dependencies.links === undefined
          ? []
          : await this.#dependencies.links.list();
      const eventsById = new Map(
        generalEvents.map((event) => [event.id, event] as const),
      );
      if (eventsById.size !== generalEvents.length)
        throw new Error("duplicate cross-conversation General event ID");
      const linksByEvent = new Map<string, (typeof links)[number][]>();
      for (const link of links) {
        const event = eventsById.get(link.generalEventId);
        if (
          link.sourceScope !== "GENERAL" ||
          link.targetScope !== "PROJECT" ||
          link.effect !== "LINK_ONLY" ||
          event === undefined ||
          event.conversationId !== link.generalConversationId ||
          event.contentSha256 !== link.generalContentSha256 ||
          !(await this.#dependencies.projects.exists(link.targetProjectId))
        )
          throw new Error("invalid General project link");
        const existing = linksByEvent.get(link.generalEventId) ?? [];
        existing.push(link);
        linksByEvent.set(link.generalEventId, existing);
      }
      if (projectEvents.length > MAX_GLOBAL_EVENTS)
        throw new HistoricalSearchError(
          `Global history exceeds ${MAX_GLOBAL_EVENTS} canonical events. Select one project or migrate to an indexed search adapter.`,
        );
      const filteredProjectEvents =
        query.type === undefined
          ? projectEvents
          : projectEvents.filter(({ event }) => event.type === query.type);
      const typeFilteredGeneralEvents =
        query.type === undefined || query.type === "USER_MESSAGE"
          ? generalEvents
          : [];
      const filteredGeneralEvents =
        associatedProjectId === null
          ? typeFilteredGeneralEvents
          : typeFilteredGeneralEvents.filter((event) =>
              (linksByEvent.get(event.id) ?? []).some(
                (link) => link.targetProjectId === associatedProjectId,
              ),
            );
      if (
        filteredProjectEvents.length + filteredGeneralEvents.length >
        MAX_GLOBAL_EVENTS
      )
        throw new HistoricalSearchError(
          `All-scope history exceeds ${MAX_GLOBAL_EVENTS} canonical events. Narrow the scope or adopt an indexed adapter through an ADR.`,
        );

      /**
       * Both scopes are ranked as one list. The engine sees text that carries
       * its own location and nothing else, so the two scopes compete on the
       * same terms and a reader gets one order instead of two lists stapled
       * together. Validation stays above this line: what a General link must
       * satisfy is not a retrieval question, and the engine never learns it.
       */
      const records: RetrievalRecord[] = [];
      const origins: ScopedOrigin[] = [];
      if (query.scope === "ALL_SCOPES")
        for (const listed of filteredProjectEvents) {
          const { event } = listed;
          const found = await this.#eventText(event);
          records.push(
            Object.freeze({
              id: String(records.length),
              text: found.text,
              location: Object.freeze({
                store: "SESSION_EVENTS",
                path: event.sessionId,
                declaredName: null,
                position: event.sequence,
              }),
              occurredAt: event.occurredAt ?? "",
              admissibility: "CURRENT" as const,
              provenance: eventProvenance(event.source),
            }),
          );
          origins.push(
            Object.freeze({
              scope: "PROJECT" as const,
              listed,
              text: found.text,
              matchedIn: found.matchedIn,
            }),
          );
        }
      for (const event of filteredGeneralEvents) {
        records.push(
          Object.freeze({
            id: String(records.length),
            text: event.content,
            location: Object.freeze({
              store: "GENERAL",
              path: event.conversationId,
              declaredName: null,
              position: event.sequence,
            }),
            occurredAt: event.occurredAt ?? "",
            admissibility: "CURRENT" as const,
            provenance: `GENERAL ${event.id}`,
          }),
        );
        origins.push(Object.freeze({ scope: "GENERAL" as const, event }));
      }

      const results: ScopedHistoricalSearchResult[] = [];
      for (const found of TolerantRetrievalIndex.build(records).search(text, {
        limit,
      })) {
        const origin = origins[Number(found.id)];
        if (origin === undefined) continue;
        if (origin.scope === "PROJECT") {
          const { event } = origin.listed;
          results.push(
            Object.freeze({
              scope: "PROJECT" as const,
              projectId: origin.listed.projectId,
              conversationId: event.sessionId,
              eventId: event.id,
              sequence: event.sequence,
              type: event.type,
              occurredAt: event.occurredAt,
              trust: event.trust,
              snippet: snippetOf(origin.text, found.reasons),
              matchedIn: origin.matchedIn,
              source: event.source,
              score: found.score,
              reasons: found.reasons,
            }),
          );
          continue;
        }
        const event = origin.event;
        results.push(
          Object.freeze({
            scope: "GENERAL" as const,
            conversationId: event.conversationId,
            eventId: event.id,
            sequence: event.sequence,
            type: event.type,
            occurredAt: event.occurredAt,
            trust: event.verification,
            origin: event.origin,
            dataClass: event.dataClass,
            exactBytes: event.exactBytes,
            contentSha256: event.contentSha256,
            snippet: snippetOf(event.content, found.reasons),
            matchedIn: "INLINE_PAYLOAD" as const,
            source: event.provenance,
            score: found.score,
            reasons: found.reasons,
            links: Object.freeze(
              (linksByEvent.get(event.id) ?? []).map((link) =>
                Object.freeze({
                  id: link.id,
                  targetProjectId: link.targetProjectId,
                  rationale: link.rationale,
                  createdAt: link.createdAt,
                  actor: link.actor,
                  verification: link.verification,
                  effect: link.effect,
                }),
              ),
            ),
          }),
        );
      }
      return Object.freeze({
        query: Object.freeze({
          scope: query.scope,
          projectIds: Object.freeze(projectIds),
          text,
          type: query.type ?? null,
          limit,
          associatedProjectId,
        }),
        searchedProjects: query.scope === "ALL_SCOPES" ? projectIds.length : 0,
        searchedConversations: conversations.length,
        searchedEvents:
          filteredProjectEvents.length + filteredGeneralEvents.length,
        scannedGeneralBytes: generalEvents.reduce(
          (sum, event) => sum + event.exactBytes,
          0,
        ),
        results: Object.freeze(results.slice(0, limit)),
      });
    } catch (error) {
      if (error instanceof HistoricalSearchError) throw error;
      throw new HistoricalSearchError(
        "All-scope historical evidence could not be validated and searched safely. Preserve local state and retry without using partial results.",
        { cause: error },
      );
    }
  }

  /**
   * The text of one canonical event, reduced the way the engine's reader
   * reduces it, together with where it was found.
   */
  async #eventText(
    event: HistoricalEvent["event"],
  ): Promise<Readonly<{ text: string; matchedIn: MatchedIn }>> {
    if (event.payload.kind === "INLINE_TEXT")
      return Object.freeze({
        text: readCanonicalPayload(event.payload.text).text,
        matchedIn: "INLINE_PAYLOAD" as const,
      });
    const content = await this.#dependencies.artifacts.read(
      event.payload.artifact.id,
    );
    return Object.freeze({
      text: readCanonicalPayload(
        decodeArtifact(content, event.payload.artifact.id),
      ).text,
      matchedIn: "ARTIFACT_PAYLOAD" as const,
    });
  }

  public async showEvent(
    projectIdValue: string,
    eventIdValue: string,
  ): Promise<HistoricalEvent> {
    const projectId = requiredValue(projectIdValue, "Project ID");
    const eventId = requiredValue(eventIdValue, "Event ID");
    await assertProject(this.#dependencies.projects, projectId);
    const result = await this.#dependencies.events.find(projectId, eventId);

    if (result === null) {
      throw new HistoricalEventNotFoundError(eventId, projectId);
    }

    return result;
  }

  public async openArtifact(artifactIdValue: string): Promise<OpenedArtifact> {
    const id = requiredValue(artifactIdValue, "Artifact ID");
    const bytes = await this.#dependencies.artifacts.read(id);

    if (bytes.byteLength > MAX_ARTIFACT_DISPLAY_BYTES) {
      throw new HistoricalSearchError(
        `Artifact '${id}' is ${bytes.byteLength} bytes and exceeds the ${MAX_ARTIFACT_DISPLAY_BYTES} byte display limit. Use a smaller source artifact or inspect the local store with an appropriate trusted tool.`,
      );
    }

    return Object.freeze({
      id,
      byteLength: bytes.byteLength,
      content: decodeArtifact(bytes, id),
    });
  }
}

function searchLimit(value: number | undefined) {
  const limit = value ?? DEFAULT_LIMIT;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT)
    throw new HistoricalSearchError(
      `Search limit must be an integer from 1 to ${MAX_LIMIT}. Omit it to use ${DEFAULT_LIMIT}.`,
    );
  return limit;
}
