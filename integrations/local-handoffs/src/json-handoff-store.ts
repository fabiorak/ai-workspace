import { createHash } from "node:crypto";
import { chmod, mkdir, open, readFile, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import {
  decodePersistedHandoff,
  encodePersistedHandoff,
  HandoffError,
  type Handoff,
  type HandoffStore,
} from "@ai-workspace/handoff";

export class JsonHandoffStore implements HandoffStore {
  readonly #directory: string;
  public constructor(workspaceHome: string) {
    this.#directory = join(workspaceHome, "handoffs");
  }
  public async create(handoff: Handoff): Promise<Handoff> {
    const path = this.#path(handoff.projectId, handoff.workItemId, handoff.id);
    try {
      await mkdir(this.#directory, { recursive: true, mode: 0o700 });
      await chmod(this.#directory, 0o700);
      const file = await open(path, "wx", 0o600);
      try {
        await file.writeFile(encodePersistedHandoff(handoff), "utf8");
        await file.sync();
      } finally {
        await file.close();
      }
      return handoff;
    } catch (error) {
      if (isNodeError(error) && error.code === "EEXIST")
        throw new HandoffError(
          `Handoff '${handoff.id}' already exists and is immutable. Generate a new ID or create a successor.`,
          { cause: error },
        );
      await rm(path, { force: true }).catch(() => undefined);
      if (error instanceof HandoffError) throw error;
      throw new HandoffError(
        "Cannot persist the immutable handoff. Check workspace permissions and retry.",
        { cause: error },
      );
    }
  }
  public async list(
    projectId: string,
    workItemId: string,
  ): Promise<readonly Handoff[]> {
    let names: string[];
    try {
      names = await readdir(this.#directory);
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT")
        return Object.freeze([]);
      throw new HandoffError(
        "Cannot list local handoffs. Check workspace permissions and retry.",
        { cause: error },
      );
    }
    const candidates = names
      .filter((name) => /^handoff_[a-f0-9]{64}\.json$/u.test(name))
      .sort();
    if (candidates.length > 1_000)
      throw new HandoffError(
        "More than 1,000 local handoffs require an indexed history adapter before listing.",
      );
    const result: Handoff[] = [];
    for (const name of candidates) {
      let value: unknown;
      try {
        value = JSON.parse(await readFile(join(this.#directory, name), "utf8"));
      } catch (error) {
        throw new HandoffError(
          "Cannot read local handoff history. Move corrupt state aside and retry.",
          { cause: error },
        );
      }
      const handoff = decodePersistedHandoff(value);
      if (handoff.projectId === projectId && handoff.workItemId === workItemId)
        result.push(handoff);
    }
    return Object.freeze(result);
  }
  public async find(
    projectId: string,
    workItemId: string,
    handoffId: string,
  ): Promise<Handoff | null> {
    const path = this.#path(projectId, workItemId, handoffId);
    let value: unknown;
    try {
      value = JSON.parse(await readFile(path, "utf8"));
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") return null;
      throw new HandoffError(
        "Cannot read the local handoff. Move corrupt state aside and recreate a successor from canonical sources.",
        { cause: error },
      );
    }
    const handoff = decodePersistedHandoff(value);
    if (
      handoff.projectId !== projectId ||
      handoff.workItemId !== workItemId ||
      handoff.id !== handoffId
    )
      throw corrupt();
    return handoff;
  }
  #path(projectId: string, workItemId: string, handoffId: string) {
    for (const [label, value] of [
      ["Project ID", projectId],
      ["Work Item ID", workItemId],
      ["Handoff ID", handoffId],
    ] as const)
      if (!value.trim() || value.length > 256)
        throw new HandoffError(
          `${label} must contain from 1 to 256 characters.`,
        );
    const digest = createHash("sha256")
      .update(`${projectId}\0${workItemId}\0${handoffId}`)
      .digest("hex");
    return join(this.#directory, `handoff_${digest}.json`);
  }
}
function corrupt() {
  return new HandoffError(
    "The local handoff is malformed, unsupported, or cross-scoped. Move it aside and create a successor from canonical sources.",
  );
}
function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
