import { createHash, randomUUID } from "node:crypto";
import { chmod, mkdir, open, readFile, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import {
  WorkItemConflictError,
  WorkItemError,
  type WorkItem,
  type WorkItemStore,
  type WorkItemTransition,
} from "@ai-workspace/core";

type CreateOperation = Readonly<{
  kind: "CREATE";
  revision: number;
  projectId: string;
  item: WorkItem;
}>;
type TransitionOperation = Readonly<{
  kind: "TRANSITION";
  revision: number;
  projectId: string;
  itemId: string;
  expectedVersion: number;
  transition: WorkItemTransition;
}>;
type Operation = CreateOperation | TransitionOperation;
type Document = Readonly<{
  schemaVersion: 1;
  projectId: string;
  revision: number;
  operations: readonly Operation[];
}>;
const MAX_OPERATIONS = 10_000;

export class JsonWorkItemStore implements WorkItemStore {
  readonly #directory: string;
  public constructor(workspaceHome: string) {
    this.#directory = join(workspaceHome, "work-items");
  }
  public async list(projectId: string) {
    return [...(await this.#load(projectId)).values()];
  }
  public async find(projectId: string, id: string) {
    return (await this.#load(projectId)).get(id) ?? null;
  }
  public async create(item: WorkItem) {
    return this.#mutate(item.projectId, (document, items) => {
      if (items.has(item.id)) throw new WorkItemConflictError(item.id);
      return {
        document: append(document, {
          kind: "CREATE",
          revision: document.revision + 1,
          projectId: item.projectId,
          item,
        }),
        id: item.id,
      };
    });
  }
  public async transition(item: WorkItem, transition: WorkItemTransition) {
    return this.#mutate(item.projectId, (document, items) => {
      const current = items.get(item.id);
      if (current === undefined || current.version !== item.version - 1)
        throw new WorkItemConflictError(item.id);
      return {
        document: append(document, {
          kind: "TRANSITION",
          revision: document.revision + 1,
          projectId: item.projectId,
          itemId: item.id,
          expectedVersion: item.version - 1,
          transition,
        }),
        id: item.id,
      };
    });
  }
  async #mutate(
    projectId: string,
    change: (
      document: Document,
      items: Map<string, WorkItem>,
    ) => { document: Document; id: string },
  ): Promise<WorkItem> {
    const path = this.#path(projectId);
    const lockPath = `${path}.lock`;
    const token = randomUUID();
    let owns = false;
    try {
      await mkdir(this.#directory, { recursive: true, mode: 0o700 });
      await chmod(this.#directory, 0o700);
      const lock = await open(lockPath, "wx", 0o600).catch((error: unknown) => {
        throw new WorkItemError(
          "Another process holds the Work Item lock. Retry after it finishes; remove the lock only after confirming its owner is inactive.",
          { cause: error },
        );
      });
      owns = true;
      try {
        await lock.writeFile(
          `${JSON.stringify({ schemaVersion: 1, ownerToken: token, pid: process.pid, createdAt: new Date().toISOString() })}\n`,
        );
        await lock.sync();
      } finally {
        await lock.close();
      }
      const document = await this.#document(projectId);
      const result = change(document, reduce(document));
      const items = reduce(result.document);
      const item = items.get(result.id);
      if (item === undefined)
        throw new WorkItemError(
          "Work Item commit could not reconstruct its result. Move the document aside and rebuild it from canonical evidence.",
        );
      await this.#commit(path, `${JSON.stringify(result.document, null, 2)}\n`);
      return item;
    } catch (error) {
      if (error instanceof WorkItemError) throw error;
      throw new WorkItemError(
        "Cannot update local Work Items. Check workspace permissions and storage integrity, then retry.",
        { cause: error },
      );
    } finally {
      if (owns) await release(lockPath, token);
    }
  }
  async #load(projectId: string) {
    try {
      return reduce(await this.#document(projectId));
    } catch (error) {
      if (error instanceof WorkItemError) throw error;
      throw new WorkItemError(
        "Cannot read local Work Items. Move corrupt state aside and rebuild it from canonical evidence.",
        { cause: error },
      );
    }
  }
  async #document(projectId: string): Promise<Document> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(await readFile(this.#path(projectId), "utf8"));
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT")
        return { schemaVersion: 1, projectId, revision: 0, operations: [] };
      throw error;
    }
    if (
      !isRecord(parsed) ||
      parsed.schemaVersion !== 1 ||
      parsed.projectId !== projectId ||
      !Number.isSafeInteger(parsed.revision) ||
      !Array.isArray(parsed.operations)
    )
      throw new WorkItemError(
        "Work Item document is malformed, unsupported, or belongs to another project. Move it aside and rebuild it from canonical evidence.",
      );
    return parsed as unknown as Document;
  }
  async #commit(path: string, content: string) {
    const temp = `${path}.${randomUUID()}.tmp`;
    try {
      const file = await open(temp, "wx", 0o600);
      try {
        await file.writeFile(content);
        await file.sync();
      } finally {
        await file.close();
      }
      await rename(temp, path);
    } finally {
      await rm(temp, { force: true }).catch(() => undefined);
    }
  }
  #path(projectId: string) {
    const id = projectId.trim();
    if (!id || id.length > 256)
      throw new WorkItemError(
        "Project ID must contain from 1 to 256 characters.",
      );
    return join(
      this.#directory,
      `project_${createHash("sha256").update(id).digest("hex")}.json`,
    );
  }
}

function append(document: Document, operation: Operation): Document {
  if (document.operations.length >= MAX_OPERATIONS)
    throw new WorkItemError(
      `Work Item log reached its ${MAX_OPERATIONS}-operation bound. Archive it before continuing.`,
    );
  return Object.freeze({
    ...document,
    revision: operation.revision,
    operations: Object.freeze([...document.operations, operation]),
  });
}
function reduce(document: Document): Map<string, WorkItem> {
  const items = new Map<string, WorkItem>();
  if (document.operations.length !== document.revision) throw corrupt();
  for (let index = 0; index < document.operations.length; index++) {
    const op = document.operations[index];
    if (
      !isRecord(op) ||
      op.revision !== index + 1 ||
      op.projectId !== document.projectId
    )
      throw corrupt();
    if (op.kind === "CREATE") {
      const item = op.item as WorkItem;
      if (
        !validItem(item, document.projectId) ||
        item.version !== 1 ||
        item.status !== "PROPOSED" ||
        items.has(item.id)
      )
        throw corrupt();
      items.set(item.id, Object.freeze(item));
      continue;
    }
    if (op.kind !== "TRANSITION") throw corrupt();
    const transition = op.transition as WorkItemTransition;
    const current = items.get(String(op.itemId));
    if (
      current === undefined ||
      current.version !== op.expectedVersion ||
      !validTransition(current, transition)
    )
      throw corrupt();
    items.set(
      current.id,
      Object.freeze({
        ...current,
        status: transition.to,
        version: current.version + 1,
        updatedAt: transition.occurredAt,
        transitions: Object.freeze([
          ...current.transitions,
          Object.freeze(transition),
        ]),
      }),
    );
  }
  return items;
}
function validItem(item: WorkItem, projectId: string): boolean {
  return (
    isRecord(item) &&
    item.projectId === projectId &&
    typeof item.id === "string" &&
    item.id.length > 0 &&
    typeof item.objective === "string" &&
    item.objective.length > 0 &&
    item.createdBy === "LOCAL_USER" &&
    Array.isArray(item.sources) &&
    item.sources.length > 0 &&
    Array.isArray(item.transitions) &&
    item.transitions.length === 0
  );
}
function validTransition(item: WorkItem, value: WorkItemTransition): boolean {
  if (
    !isRecord(value) ||
    value.from !== item.status ||
    value.actor !== "LOCAL_USER" ||
    !Array.isArray(value.sources) ||
    value.sources.length < 1
  )
    return false;
  return (
    (value.from === "PROPOSED" &&
      (value.to === "ACTIVE" || value.to === "BLOCKED")) ||
    (value.from === "ACTIVE" &&
      (value.to === "BLOCKED" || value.to === "COMPLETED")) ||
    (value.from === "BLOCKED" && value.to === "COMPLETED") ||
    (value.from === "COMPLETED" && value.to === "ACTIVE")
  );
}
function corrupt() {
  return new WorkItemError(
    "Work Item operation log is corrupt or unsupported. Move it aside and rebuild it from canonical evidence.",
  );
}
async function release(path: string, token: string) {
  try {
    const value: unknown = JSON.parse(await readFile(path, "utf8"));
    if (isRecord(value) && value.ownerToken === token) await rm(path);
  } catch {
    /* Never remove a lock we cannot prove we own. */
  }
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
