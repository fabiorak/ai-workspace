import { randomUUID } from "node:crypto";
import {
  chmod,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, isAbsolute } from "node:path";

import type {
  ProjectRegistryStore,
  RegisteredProject,
} from "@ai-workspace/project-registry";

const SCHEMA_VERSION = 1;

export class ProjectRegistryStorageError extends Error {
  public constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ProjectRegistryStorageError";
  }
}

export class JsonProjectRegistryStore implements ProjectRegistryStore {
  readonly #filePath: string;

  public constructor(filePath: string) {
    this.#filePath = filePath;
  }

  public async load(): Promise<readonly RegisteredProject[]> {
    let content: string;

    try {
      content = await readFile(this.#filePath, "utf8");
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        return [];
      }

      throw new ProjectRegistryStorageError(
        `Cannot read the project registry at '${this.#filePath}'`,
        { cause: error },
      );
    }

    try {
      const document: unknown = JSON.parse(content);
      return validateRegistryDocument(document);
    } catch (error) {
      if (error instanceof ProjectRegistryStorageError) {
        throw error;
      }

      throw new ProjectRegistryStorageError(
        `The project registry at '${this.#filePath}' is not valid JSON`,
        { cause: error },
      );
    }
  }

  public async save(projects: readonly RegisteredProject[]): Promise<void> {
    const directory = dirname(this.#filePath);
    const temporaryPath = `${this.#filePath}.${randomUUID()}.tmp`;
    const content = `${JSON.stringify(
      { schemaVersion: SCHEMA_VERSION, projects },
      null,
      2,
    )}\n`;

    try {
      await mkdir(directory, { recursive: true, mode: 0o700 });
      await chmod(directory, 0o700);
      await writeFile(temporaryPath, content, {
        encoding: "utf8",
        mode: 0o600,
        flag: "wx",
      });
      await rename(temporaryPath, this.#filePath);
      await chmod(this.#filePath, 0o600);
    } catch (error) {
      await rm(temporaryPath, { force: true }).catch(() => undefined);
      throw new ProjectRegistryStorageError(
        `Cannot write the project registry at '${this.#filePath}'`,
        { cause: error },
      );
    }
  }
}

function validateRegistryDocument(
  document: unknown,
): readonly RegisteredProject[] {
  if (!isRecord(document)) {
    throw invalidRegistry("root value must be an object");
  }

  if (document.schemaVersion !== SCHEMA_VERSION) {
    throw invalidRegistry(
      `unsupported schema version '${String(document.schemaVersion)}'`,
    );
  }

  if (!Array.isArray(document.projects)) {
    throw invalidRegistry("projects must be an array");
  }

  const projects = document.projects.map((project, index) =>
    validateProject(project, index),
  );
  assertUniqueProjects(projects);
  return projects;
}

function validateProject(value: unknown, index: number): RegisteredProject {
  if (!isRecord(value)) {
    throw invalidRegistry(`project at index ${index} must be an object`);
  }

  const id = requiredString(value, "id", index);
  const canonicalPath = requiredString(value, "canonicalPath", index);
  const name = requiredString(value, "name", index);
  const registeredAt = requiredString(value, "registeredAt", index);
  const lastInspectedAt = requiredString(value, "lastInspectedAt", index);

  if (!isAbsolute(canonicalPath)) {
    throw invalidRegistry(
      `project at index ${index} has a non-absolute 'canonicalPath'`,
    );
  }

  for (const [field, timestamp] of [
    ["registeredAt", registeredAt],
    ["lastInspectedAt", lastInspectedAt],
  ] as const) {
    if (Number.isNaN(Date.parse(timestamp))) {
      throw invalidRegistry(`project at index ${index} has invalid '${field}'`);
    }
  }

  if (
    value.repositoryType !== "SOFTWARE" &&
    value.repositoryType !== "DOCUMENTS" &&
    value.repositoryType !== "MIXED"
  ) {
    throw invalidRegistry(
      `project at index ${index} has invalid 'repositoryType'`,
    );
  }

  const branch = nullableString(value, "branch", index);
  const headCommit = nullableString(value, "headCommit", index);
  const remoteUrl = nullableString(value, "remoteUrl", index);

  if (typeof value.isDirty !== "boolean") {
    throw invalidRegistry(`project at index ${index} has invalid 'isDirty'`);
  }

  return Object.freeze({
    id,
    canonicalPath,
    name,
    repositoryType: value.repositoryType,
    branch,
    headCommit,
    remoteUrl,
    isDirty: value.isDirty,
    registeredAt,
    lastInspectedAt,
  });
}

function requiredString(
  value: Record<string, unknown>,
  field: string,
  index: number,
): string {
  const candidate = value[field];

  if (typeof candidate !== "string" || candidate.length === 0) {
    throw invalidRegistry(`project at index ${index} has invalid '${field}'`);
  }

  return candidate;
}

function assertUniqueProjects(projects: readonly RegisteredProject[]): void {
  const identifiers = new Set<string>();
  const canonicalPaths = new Set<string>();

  for (const project of projects) {
    if (identifiers.has(project.id)) {
      throw invalidRegistry(`duplicate project id '${project.id}'`);
    }

    if (canonicalPaths.has(project.canonicalPath)) {
      throw invalidRegistry(
        `duplicate canonical path '${project.canonicalPath}'`,
      );
    }

    identifiers.add(project.id);
    canonicalPaths.add(project.canonicalPath);
  }
}

function nullableString(
  value: Record<string, unknown>,
  field: string,
  index: number,
): string | null {
  const candidate = value[field];

  if (candidate !== null && typeof candidate !== "string") {
    throw invalidRegistry(`project at index ${index} has invalid '${field}'`);
  }

  return candidate;
}

function invalidRegistry(details: string): ProjectRegistryStorageError {
  return new ProjectRegistryStorageError(
    `The project registry is invalid: ${details}`,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
