import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  InstructionError,
  type InstructionBundle,
  validateInstructionBundle,
} from "@ai-workspace/instruction-manager";

const MAX_BUNDLES = 50;
const MAX_BUNDLE_BYTES = 256 * 1_024;
const DIGEST = /^[a-f0-9]{64}$/u;
const BUNDLE_KEYS = ["projectId", "schemaVersion", "source"];
const SOURCE_KEYS = ["id", "projectId", "rules", "scope", "target", "trust"];
const RULE_KEYS = ["content", "id", "kind", "overridable", "position"];

export type LocalInstructionBundleInput = Readonly<{
  path: string;
  expectedDigest?: string;
}>;

export class LocalInstructionBundleReader {
  public async read(
    projectId: string,
    inputs: readonly LocalInstructionBundleInput[],
  ): Promise<InstructionBundle> {
    if (
      !projectId.trim() ||
      projectId.length > 256 ||
      inputs.length < 1 ||
      inputs.length > MAX_BUNDLES
    )
      throw rejected();
    const sources: unknown[] = [];
    for (const input of inputs) {
      if (!input.path.trim() || input.path.includes("\0")) throw rejected();
      if (
        input.expectedDigest !== undefined &&
        !DIGEST.test(input.expectedDigest)
      )
        throw rejected();
      let bytes: Buffer;
      try {
        bytes = await readFile(input.path);
      } catch (error) {
        throw rejected(error);
      }
      if (bytes.byteLength < 1 || bytes.byteLength > MAX_BUNDLE_BYTES)
        throw rejected();
      const digest = createHash("sha256").update(bytes).digest("hex");
      if (input.expectedDigest !== undefined && input.expectedDigest !== digest)
        throw new InstructionError(
          "An explicitly selected instruction bundle changed. Recalculate its digest only after reviewing the synthetic source bytes.",
        );
      let value: unknown;
      try {
        value = JSON.parse(
          new TextDecoder("utf-8", { fatal: true }).decode(bytes),
        );
      } catch (error) {
        throw rejected(error);
      }
      if (
        !isRecord(value) ||
        !exactKeys(value, BUNDLE_KEYS) ||
        value.schemaVersion !== 1 ||
        value.projectId !== projectId ||
        !isRecord(value.source) ||
        !exactKeys(value.source, SOURCE_KEYS) ||
        value.source.projectId !== projectId ||
        !Array.isArray(value.source.rules) ||
        value.source.rules.some(
          (rule) => !isRecord(rule) || !exactKeys(rule, RULE_KEYS),
        )
      )
        throw rejected();
      sources.push({ ...value.source, sourceDigest: digest });
    }
    return validateInstructionBundle({
      schemaVersion: 1,
      projectId,
      sources,
    });
  }
}

function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
) {
  const actual = Object.keys(value).sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}
function rejected(cause?: unknown): InstructionError {
  return new InstructionError(
    "The explicit local instruction bundle is unreadable, malformed, restricted, oversized, or cross-project. Use a reviewed synthetic schema-v1 bundle and retry.",
    cause === undefined ? undefined : { cause },
  );
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
