/**
 * The few checks both the literal scan and the tolerant index have to make.
 * They live here rather than in either of them so the two surfaces refuse the
 * same input for the same reason, and so a caller cannot tell which one it
 * reached from the error it gets back.
 */

import { TextDecoder } from "node:util";

import { HistoricalSearchError } from "./errors.ts";
import type { ProjectLookup } from "@ai-workspace/session-ingestion";

const decoder = new TextDecoder("utf8", { fatal: true });

export function requiredValue(value: string, label: string): string {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new HistoricalSearchError(`${label} cannot be empty.`);
  }

  return normalized;
}

export function decodeArtifact(
  content: Uint8Array,
  artifactId: string,
): string {
  try {
    return decoder.decode(content);
  } catch (error) {
    throw new HistoricalSearchError(
      `Artifact '${artifactId}' is not valid UTF-8 text and cannot be searched or displayed by this CLI.`,
      { cause: error },
    );
  }
}

export async function assertProject(
  projects: ProjectLookup,
  projectId: string,
): Promise<void> {
  if (!(await projects.exists(projectId))) {
    throw new HistoricalSearchError(
      `Project '${projectId}' is not registered. Run 'ai-workspace project list' to find an ID or 'ai-workspace project register <path>' to create one.`,
    );
  }
}
