import { createHash } from "node:crypto";
import { chmod, mkdir, open, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import {
  encodeHandoff,
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
        await file.writeFile(encodeHandoff(handoff), "utf8");
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
    return validate(value, projectId, workItemId, handoffId);
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
function validate(
  value: unknown,
  projectId: string,
  workItemId: string,
  handoffId: string,
): Handoff {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    value.projectId !== projectId ||
    value.workItemId !== workItemId ||
    value.id !== handoffId ||
    value.createdBy !== "LOCAL_USER" ||
    typeof value.createdAt !== "string" ||
    !isRecord(value.sections)
  )
    throw corrupt();
  const required = [
    "objective",
    "repository",
    "selectedMemory",
    "knownFailures",
    "testState",
    "relevantFiles",
    "nextAction",
    "sourceReferences",
  ];
  for (const name of required) {
    const section = value.sections[name];
    if (
      !isRecord(section) ||
      !isRecord(section.metadata) ||
      !("value" in section)
    )
      throw corrupt();
  }
  return value as unknown as Handoff;
}
function corrupt() {
  return new HandoffError(
    "The local handoff is malformed, unsupported, or cross-scoped. Move it aside and create a successor from canonical sources.",
  );
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
