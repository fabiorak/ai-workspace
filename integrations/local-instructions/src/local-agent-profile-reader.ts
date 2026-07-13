import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import {
  AgentProfileError,
  encodeAgentProfileBundle,
  type AgentProfileBundle,
  validateAgentProfileBundle,
} from "@ai-workspace/instruction-manager";

const MAX_PROFILE_BYTES = 256 * 1_024;
const DIGEST = /^[a-f0-9]{64}$/u;

export type LocalAgentProfileInput = Readonly<{
  path: string;
  expectedDigest?: string;
}>;
export type LocalAgentProfileInspection = Readonly<{
  bundle: AgentProfileBundle;
  sourceName: string;
  sourceDigest: string;
  sourceBytes: number;
  canonicalBytes: number;
  canonicalEncoding: string;
  effect: "DESCRIPTIVE_NOT_INSTALLED_SELECTED_ENFORCED_OR_EXECUTED";
}>;

export class LocalAgentProfileReader {
  public async read(
    projectId: string,
    input: LocalAgentProfileInput,
  ): Promise<LocalAgentProfileInspection> {
    if (
      !projectId.trim() ||
      projectId.length > 256 ||
      !input.path.trim() ||
      input.path.includes("\0") ||
      (input.expectedDigest !== undefined && !DIGEST.test(input.expectedDigest))
    )
      throw rejected();
    let source: Buffer;
    try {
      source = await readFile(input.path);
    } catch (error) {
      throw rejected(error);
    }
    if (source.byteLength < 1 || source.byteLength > MAX_PROFILE_BYTES)
      throw rejected();
    const digest = createHash("sha256").update(source).digest("hex");
    if (input.expectedDigest !== undefined && input.expectedDigest !== digest)
      throw new AgentProfileError();
    let parsed: unknown;
    try {
      parsed = JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(source),
      );
    } catch (error) {
      throw rejected(error);
    }
    const bundle = validateAgentProfileBundle(parsed);
    if (bundle.projectId !== projectId) throw rejected();
    const canonicalEncoding = encodeAgentProfileBundle(bundle);
    const roundTrip = encodeAgentProfileBundle(
      JSON.parse(canonicalEncoding) as unknown,
    );
    if (roundTrip !== canonicalEncoding) throw rejected();
    return Object.freeze({
      bundle,
      sourceName: safeName(basename(input.path)),
      sourceDigest: digest,
      sourceBytes: source.byteLength,
      canonicalBytes: Buffer.byteLength(canonicalEncoding, "utf8"),
      canonicalEncoding,
      effect: "DESCRIPTIVE_NOT_INSTALLED_SELECTED_ENFORCED_OR_EXECUTED",
    });
  }
}

function safeName(value: string) {
  const result = [...value]
    .map((character) => {
      const code = character.codePointAt(0)!;
      return code <= 31 || code === 127 ? "�" : character;
    })
    .join("");
  return result.slice(0, 256) || "profile.json";
}

function rejected(cause?: unknown): AgentProfileError {
  return new AgentProfileError(cause === undefined ? undefined : { cause });
}
