import type { SessionEvent } from "@ai-workspace/session-ingestion";

import { ActiveMemoryError, MemoryItemNotFoundError } from "./errors.ts";
import {
  MEMORY_ITEM_TYPES,
  MEMORY_VALIDITIES,
  MEMORY_VERIFICATIONS,
  type AddMemoryInput,
  type InvalidateMemoryInput,
  type ListMemoryQuery,
  type MemoryItem,
  type MemoryItemType,
  type MemoryPage,
  type MemorySourceLink,
  type MemoryValidity,
  type MemoryVerification,
  type SupersedeMemoryInput,
  type SupersededMemory,
  type VerifyMemoryInput,
} from "./model.ts";
import type { ActiveMemoryDependencies } from "./ports.ts";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MAX_CONTENT_LENGTH = 4_096;
const MAX_NOTE_LENGTH = 1_024;
const MAX_REASON_LENGTH = 1_024;
const MAX_SOURCE_EVENTS = 20;
const MAX_CURSOR_LENGTH = 2_048;
const CURSOR_SCHEMA_VERSION = 1;

export class ActiveMemory {
  readonly #dependencies: ActiveMemoryDependencies;

  public constructor(dependencies: ActiveMemoryDependencies) {
    this.#dependencies = dependencies;
  }

  public async add(input: AddMemoryInput): Promise<MemoryItem> {
    const projectId = requiredValue(input.projectId, "Project ID");
    const type = allowedValue(input.type, MEMORY_ITEM_TYPES, "Memory type");
    const content = boundedValue(
      input.content,
      "Memory content",
      MAX_CONTENT_LENGTH,
    );
    await this.#assertProject(projectId);
    const sources = await this.#resolveSources(projectId, input.sourceEventIds);
    const occurredAt = this.#now();
    const item = freezeItem({
      id: this.#id("Memory item ID"),
      projectId,
      type,
      content,
      curation: "USER_CURATED",
      validity: "ACTIVE",
      verification: "UNVERIFIED",
      confidence: "UNASSESSED",
      version: 1,
      sources,
      creationOperationId: this.#id("Creation operation ID"),
      createdBy: "LOCAL_USER",
      createdAt: occurredAt,
      updatedAt: occurredAt,
      supersedes: null,
      supersession: null,
      verifications: Object.freeze([]),
      invalidation: null,
    });
    return this.#dependencies.store.create(item);
  }

  public async list(query: ListMemoryQuery): Promise<MemoryPage> {
    const projectId = requiredValue(query.projectId, "Project ID");
    const type = optionalAllowedValue(
      query.type,
      MEMORY_ITEM_TYPES,
      "Memory type",
    );
    const validity = optionalAllowedValue(
      query.validity,
      MEMORY_VALIDITIES,
      "Memory validity",
    );
    const verification = optionalAllowedValue(
      query.verification,
      MEMORY_VERIFICATIONS,
      "Memory verification",
    );
    const limit = query.limit ?? DEFAULT_LIMIT;

    if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
      throw new ActiveMemoryError(
        `Memory limit must be an integer from 1 to ${MAX_LIMIT}. Omit the limit to use ${DEFAULT_LIMIT}.`,
      );
    }

    await this.#assertProject(projectId);
    const resolvedValidity = validity ?? "ACTIVE";
    const cursor =
      query.cursor === undefined
        ? null
        : decodeCursor(query.cursor, {
            projectId,
            type,
            validity: resolvedValidity,
            verification,
          });
    const items = await this.#dependencies.store.list(projectId);
    const candidates = items
      .filter(
        (item) =>
          item.projectId === projectId &&
          item.validity === resolvedValidity &&
          (type === undefined || item.type === type) &&
          (verification === undefined || item.verification === verification),
      )
      .sort(compareItems)
      .filter((item) => cursor === null || isAfterCursor(item, cursor))
      .slice(0, limit + 1);
    const pageItems = Object.freeze(candidates.slice(0, limit));
    const lastItem = pageItems.at(-1);
    const nextCursor =
      candidates.length > limit && lastItem !== undefined
        ? encodeCursor(lastItem, {
            projectId,
            type,
            validity: resolvedValidity,
            verification,
          })
        : null;

    return Object.freeze({ items: pageItems, nextCursor });
  }

  public async show(
    projectIdValue: string,
    memoryIdValue: string,
  ): Promise<MemoryItem> {
    const projectId = requiredValue(projectIdValue, "Project ID");
    const memoryId = requiredValue(memoryIdValue, "Memory item ID");
    await this.#assertProject(projectId);
    return this.#findItem(projectId, memoryId);
  }

  public async verify(input: VerifyMemoryInput): Promise<MemoryItem> {
    const projectId = requiredValue(input.projectId, "Project ID");
    const memoryId = requiredValue(input.memoryId, "Memory item ID");
    const note = boundedValue(input.note, "Verification note", MAX_NOTE_LENGTH);
    await this.#assertProject(projectId);
    const current = await this.#findItem(projectId, memoryId);
    assertActive(current, "verify");

    if (current.verification === "VERIFIED") {
      throw new ActiveMemoryError(
        `Memory item '${memoryId}' is already VERIFIED. Verification is recorded once; supersede or invalidate the item if current knowledge changed.`,
      );
    }

    const sources = await this.#resolveSources(projectId, input.sourceEventIds);
    return this.#dependencies.store.verify(
      projectId,
      memoryId,
      current.version,
      Object.freeze({
        id: this.#id("Verification operation ID"),
        actor: "LOCAL_USER",
        occurredAt: this.#now(),
        note,
        sources,
      }),
    );
  }

  public async supersede(
    input: SupersedeMemoryInput,
  ): Promise<SupersededMemory> {
    const projectId = requiredValue(input.projectId, "Project ID");
    const memoryId = requiredValue(input.memoryId, "Memory item ID");
    const content = boundedValue(
      input.content,
      "Replacement content",
      MAX_CONTENT_LENGTH,
    );
    await this.#assertProject(projectId);
    const current = await this.#findItem(projectId, memoryId);
    assertActive(current, "supersede");
    const sources = await this.#resolveSources(projectId, input.sourceEventIds);
    const occurredAt = this.#now();
    const replacementId = this.#id("Replacement memory item ID");
    const replacement = freezeItem({
      id: replacementId,
      projectId,
      type: current.type,
      content,
      curation: "USER_CURATED",
      validity: "ACTIVE",
      verification: "UNVERIFIED",
      confidence: "UNASSESSED",
      version: 1,
      sources,
      creationOperationId: this.#id("Creation operation ID"),
      createdBy: "LOCAL_USER",
      createdAt: occurredAt,
      updatedAt: occurredAt,
      supersedes: current.id,
      supersession: null,
      verifications: Object.freeze([]),
      invalidation: null,
    });

    return this.#dependencies.store.supersede(
      projectId,
      memoryId,
      current.version,
      replacement,
      Object.freeze({
        id: this.#id("Supersession operation ID"),
        actor: "LOCAL_USER",
        occurredAt,
        replacementId,
        sources,
      }),
    );
  }

  public async invalidate(input: InvalidateMemoryInput): Promise<MemoryItem> {
    const projectId = requiredValue(input.projectId, "Project ID");
    const memoryId = requiredValue(input.memoryId, "Memory item ID");
    const reason = boundedValue(
      input.reason,
      "Invalidation reason",
      MAX_REASON_LENGTH,
    );
    await this.#assertProject(projectId);
    const current = await this.#findItem(projectId, memoryId);
    assertActive(current, "invalidate");
    const sources = await this.#resolveSources(projectId, input.sourceEventIds);
    return this.#dependencies.store.invalidate(
      projectId,
      memoryId,
      current.version,
      Object.freeze({
        id: this.#id("Invalidation operation ID"),
        actor: "LOCAL_USER",
        occurredAt: this.#now(),
        reason,
        sources,
      }),
    );
  }

  async #assertProject(projectId: string): Promise<void> {
    if (!(await this.#dependencies.projects.exists(projectId))) {
      throw new ActiveMemoryError(
        `Project '${projectId}' is not registered. Run 'ai-workspace project list' to find an ID or 'ai-workspace project register <path>' to create one.`,
      );
    }
  }

  async #findItem(projectId: string, memoryId: string): Promise<MemoryItem> {
    const item = await this.#dependencies.store.find(projectId, memoryId);

    if (item === null || item.projectId !== projectId) {
      throw new MemoryItemNotFoundError(memoryId, projectId);
    }

    return item;
  }

  async #resolveSources(
    projectId: string,
    eventIdValues: readonly string[],
  ): Promise<readonly MemorySourceLink[]> {
    if (eventIdValues.length < 1 || eventIdValues.length > MAX_SOURCE_EVENTS) {
      throw new ActiveMemoryError(
        `Provide from 1 to ${MAX_SOURCE_EVENTS} source event IDs from the same project.`,
      );
    }

    const eventIds = eventIdValues.map((value) =>
      requiredValue(value, "Source event ID"),
    );

    if (new Set(eventIds).size !== eventIds.length) {
      throw new ActiveMemoryError("Source event IDs must be unique.");
    }

    const sources: MemorySourceLink[] = [];

    for (const eventId of eventIds) {
      const event = await this.#dependencies.sourceEvents.find(
        projectId,
        eventId,
      );

      if (event === null) {
        throw new ActiveMemoryError(
          `Source event '${eventId}' was not found in project '${projectId}'. Run history search for that project and use an event ID from its results.`,
        );
      }

      sources.push(sourceLink(event));
    }

    return Object.freeze(sources);
  }

  #id(label: string): string {
    return requiredValue(this.#dependencies.ids(), label);
  }

  #now(): string {
    const value = this.#dependencies.clock();

    if (Number.isNaN(value.getTime())) {
      throw new ActiveMemoryError("Memory clock returned an invalid date.");
    }

    return value.toISOString();
  }
}

function sourceLink(event: SessionEvent): MemorySourceLink {
  return Object.freeze({
    eventId: event.id,
    sessionId: event.sessionId,
    eventType: event.type,
    trust: event.trust,
    sourceArtifactId: event.source.artifactId,
    sourcePosition: event.source.position,
    sourceRecordHash: event.source.recordHash,
  });
}

function assertActive(item: MemoryItem, action: string): void {
  if (item.validity !== "ACTIVE") {
    throw new ActiveMemoryError(
      `Cannot ${action} memory item '${item.id}' because it is ${item.validity}. Terminal items remain inspectable but cannot transition again.`,
    );
  }
}

function compareItems(left: MemoryItem, right: MemoryItem): number {
  const timeOrder = right.createdAt.localeCompare(left.createdAt);
  return timeOrder === 0 ? left.id.localeCompare(right.id) : timeOrder;
}

type CursorQuery = Readonly<{
  projectId: string;
  type: MemoryItemType | undefined;
  validity: MemoryValidity;
  verification: MemoryVerification | undefined;
}>;

type MemoryCursor = Readonly<{
  createdAt: string;
  id: string;
}>;

function encodeCursor(item: MemoryItem, query: CursorQuery): string {
  return Buffer.from(
    JSON.stringify({
      schemaVersion: CURSOR_SCHEMA_VERSION,
      projectId: query.projectId,
      type: query.type ?? null,
      validity: query.validity,
      verification: query.verification ?? null,
      createdAt: item.createdAt,
      id: item.id,
    }),
    "utf8",
  ).toString("base64url");
}

function decodeCursor(value: string, query: CursorQuery): MemoryCursor {
  try {
    if (
      typeof value !== "string" ||
      value.length < 1 ||
      value.length > MAX_CURSOR_LENGTH ||
      value.trim() !== value ||
      !/^[A-Za-z0-9_-]+$/u.test(value) ||
      Buffer.from(value, "base64url").toString("base64url") !== value
    ) {
      throw new Error("invalid encoding");
    }

    const parsed: unknown = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    );

    if (
      !isRecord(parsed) ||
      parsed.schemaVersion !== CURSOR_SCHEMA_VERSION ||
      parsed.projectId !== query.projectId ||
      parsed.type !== (query.type ?? null) ||
      parsed.validity !== query.validity ||
      parsed.verification !== (query.verification ?? null) ||
      typeof parsed.createdAt !== "string" ||
      !isCanonicalTimestamp(parsed.createdAt) ||
      typeof parsed.id !== "string" ||
      parsed.id.length < 1 ||
      parsed.id.length > MAX_CONTENT_LENGTH
    ) {
      throw new Error("invalid cursor payload");
    }

    return Object.freeze({ createdAt: parsed.createdAt, id: parsed.id });
  } catch (error) {
    throw new ActiveMemoryError(
      "Memory cursor is invalid or does not match this project and filter set. Restart listing without a cursor.",
      { cause: error },
    );
  }
}

function isAfterCursor(item: MemoryItem, cursor: MemoryCursor): boolean {
  return (
    item.createdAt < cursor.createdAt ||
    (item.createdAt === cursor.createdAt && item.id > cursor.id)
  );
}

function isCanonicalTimestamp(value: string): boolean {
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toISOString() === value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boundedValue(value: string, label: string, maximum: number): string {
  const normalized = requiredValue(value, label);

  if (normalized.length > maximum) {
    throw new ActiveMemoryError(
      `${label} must be at most ${maximum} characters; received ${normalized.length}.`,
    );
  }

  return normalized;
}

function requiredValue(value: string, label: string): string {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new ActiveMemoryError(`${label} cannot be empty.`);
  }

  return normalized;
}

function allowedValue<T extends string>(
  value: string,
  allowed: readonly T[],
  label: string,
): T {
  if (!allowed.includes(value as T)) {
    throw new ActiveMemoryError(
      `${label} must be one of: ${allowed.join(", ")}.`,
    );
  }

  return value as T;
}

function optionalAllowedValue<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
  label: string,
): T | undefined {
  return value === undefined ? undefined : allowedValue(value, allowed, label);
}

function freezeItem(item: MemoryItem): MemoryItem {
  return Object.freeze(item);
}
