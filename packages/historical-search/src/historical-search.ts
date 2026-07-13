import { TextDecoder } from "node:util";

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
  OpenedArtifact,
} from "./model.ts";
import type { HistoricalSearchDependencies } from "./ports.ts";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MAX_ARTIFACT_DISPLAY_BYTES = 64 * 1024;
const MAX_GLOBAL_PROJECTS = 100;
const MAX_GLOBAL_EVENTS = 10_000;
const SNIPPET_CONTEXT = 72;
const decoder = new TextDecoder("utf8", { fatal: true });

export class HistoricalSearch {
  readonly #dependencies: HistoricalSearchDependencies;

  public constructor(dependencies: HistoricalSearchDependencies) {
    this.#dependencies = dependencies;
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

    await this.#assertProject(projectId);
    const events = await this.#dependencies.events.list(
      projectId,
      query.sessionId,
    );
    const filtered =
      query.type === undefined
        ? events
        : events.filter(({ event }) => event.type === query.type);
    const ordered = [...filtered].sort(compareEvents);
    const needle = text.toLowerCase();
    const results: HistoricalSearchResult[] = [];

    for (const historicalEvent of ordered) {
      if (results.length >= limit) {
        break;
      }

      const { event } = historicalEvent;
      let payload: string;
      let matchedIn: HistoricalSearchResult["matchedIn"];

      if (event.payload.kind === "INLINE_TEXT") {
        payload = event.payload.text;
        matchedIn = "INLINE_PAYLOAD";
      } else {
        const bytes = await this.#dependencies.artifacts.read(
          event.payload.artifact.id,
        );
        payload = decodeArtifact(bytes, event.payload.artifact.id);
        matchedIn = "ARTIFACT_PAYLOAD";
      }

      const matchIndex = payload.toLowerCase().indexOf(needle);

      if (matchIndex < 0) {
        continue;
      }

      results.push(
        Object.freeze({
          eventId: event.id,
          projectId,
          sessionId: event.sessionId,
          sequence: event.sequence,
          type: event.type,
          occurredAt: event.occurredAt,
          trust: event.trust,
          snippet: snippet(payload, matchIndex, text.length),
          matchedIn,
          source: event.source,
        }),
      );
    }

    return Object.freeze({
      query: Object.freeze({
        projectId,
        text,
        sessionId: query.sessionId ?? null,
        type: query.type ?? null,
        limit,
      }),
      searchedEvents: filtered.length,
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
    const events: HistoricalEvent[] = [];
    for (const projectId of projectIds) {
      await this.#assertProject(projectId);
      let projectEvents: readonly HistoricalEvent[];
      try {
        projectEvents = await this.#dependencies.events.list(projectId);
      } catch (error) {
        throw new HistoricalSearchError(
          "Global history could not be read safely. Preserve local state, select one project to diagnose it, and retry without using partial results.",
          { cause: error },
        );
      }
      if (projectEvents.some((event) => event.projectId !== projectId))
        throw new HistoricalSearchError(
          "Global history returned inconsistent project scope. Preserve local state, repair the adapter, and retry without using partial results.",
        );
      events.push(...projectEvents);
      if (events.length > MAX_GLOBAL_EVENTS)
        throw new HistoricalSearchError(
          `Global history exceeds ${MAX_GLOBAL_EVENTS} canonical events. Select one project or migrate to an indexed search adapter.`,
        );
    }
    const filtered =
      query.type === undefined
        ? events
        : events.filter(({ event }) => event.type === query.type);
    const ordered = [...filtered].sort(compareEvents);
    let results: HistoricalSearchResult[];
    try {
      results = await this.#match(ordered, text);
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
      searchedEvents: filtered.length,
      results: Object.freeze(results.slice(0, limit)),
    });
  }

  async #match(
    ordered: readonly HistoricalEvent[],
    text: string,
  ): Promise<HistoricalSearchResult[]> {
    const needle = text.toLowerCase();
    const results: HistoricalSearchResult[] = [];
    for (const historicalEvent of ordered) {
      const { event } = historicalEvent;
      let payload: string;
      let matchedIn: HistoricalSearchResult["matchedIn"];
      if (event.payload.kind === "INLINE_TEXT") {
        payload = event.payload.text;
        matchedIn = "INLINE_PAYLOAD";
      } else {
        const content = await this.#dependencies.artifacts.read(
          event.payload.artifact.id,
        );
        payload = decodeArtifact(content, event.payload.artifact.id);
        matchedIn = "ARTIFACT_PAYLOAD";
      }
      const matchIndex = payload.toLowerCase().indexOf(needle);
      if (matchIndex < 0) continue;
      results.push(
        Object.freeze({
          eventId: event.id,
          projectId: historicalEvent.projectId,
          sessionId: event.sessionId,
          sequence: event.sequence,
          type: event.type,
          occurredAt: event.occurredAt,
          trust: event.trust,
          snippet: snippet(payload, matchIndex, text.length),
          matchedIn,
          source: event.source,
        }),
      );
    }
    return results;
  }

  public async showEvent(
    projectIdValue: string,
    eventIdValue: string,
  ): Promise<HistoricalEvent> {
    const projectId = requiredValue(projectIdValue, "Project ID");
    const eventId = requiredValue(eventIdValue, "Event ID");
    await this.#assertProject(projectId);
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

  async #assertProject(projectId: string): Promise<void> {
    if (!(await this.#dependencies.projects.exists(projectId))) {
      throw new HistoricalSearchError(
        `Project '${projectId}' is not registered. Run 'ai-workspace project list' to find an ID or 'ai-workspace project register <path>' to create one.`,
      );
    }
  }
}

function compareEvents(left: HistoricalEvent, right: HistoricalEvent): number {
  const leftTimestamp = left.event.occurredAt ?? "9999";
  const rightTimestamp = right.event.occurredAt ?? "9999";
  const timestampOrder = leftTimestamp.localeCompare(rightTimestamp);

  if (timestampOrder !== 0) {
    return timestampOrder;
  }

  const projectOrder = left.projectId.localeCompare(right.projectId, "en");
  if (projectOrder !== 0) return projectOrder;

  const sessionOrder = left.event.sessionId.localeCompare(
    right.event.sessionId,
  );
  return sessionOrder === 0
    ? left.event.sequence - right.event.sequence
    : sessionOrder;
}

function searchLimit(value: number | undefined) {
  const limit = value ?? DEFAULT_LIMIT;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT)
    throw new HistoricalSearchError(
      `Search limit must be an integer from 1 to ${MAX_LIMIT}. Omit it to use ${DEFAULT_LIMIT}.`,
    );
  return limit;
}

function snippet(
  content: string,
  matchIndex: number,
  matchLength: number,
): string {
  const start = Math.max(0, matchIndex - SNIPPET_CONTEXT);
  const end = Math.min(
    content.length,
    matchIndex + matchLength + SNIPPET_CONTEXT,
  );
  const body = content.slice(start, end).replace(/\s+/gu, " ").trim();
  return `${start > 0 ? "…" : ""}${body}${end < content.length ? "…" : ""}`;
}

function requiredValue(value: string, label: string): string {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new HistoricalSearchError(`${label} cannot be empty.`);
  }

  return normalized;
}

function decodeArtifact(content: Uint8Array, artifactId: string): string {
  try {
    return decoder.decode(content);
  } catch (error) {
    throw new HistoricalSearchError(
      `Artifact '${artifactId}' is not valid UTF-8 text and cannot be searched or displayed by this CLI.`,
      { cause: error },
    );
  }
}
