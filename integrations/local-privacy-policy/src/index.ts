import { createHash } from "node:crypto";
import { readFile, open } from "node:fs/promises";
import { constants } from "node:fs";
import { basename } from "node:path";
import {
  encodeModelDataPolicy,
  PrivacyGatewayError,
  type ModelDataPolicy,
  validateModelDataPolicy,
  validateScopedModelDataPolicy,
  type PrivacyPolicyScope,
} from "@ai-workspace/privacy-gateway";

const MAX_POLICY_BYTES = 256 * 1_024;
const DIGEST = /^[a-f0-9]{64}$/u;

export type LocalModelDataPolicyInput = Readonly<{
  path: string;
  expectedDigest?: string;
}>;
export type LocalModelDataPolicyInspection = Readonly<{
  policy: ModelDataPolicy;
  sourceName: string;
  sourceDigest: string;
  sourceBytes: number;
  canonicalBytes: number;
  canonicalEncoding: string;
  effect: "READ_ONLY_POLICY_NOT_PERSISTED_AUTHORIZED_OR_DELIVERED";
}>;

export class LocalModelDataPolicyReader {
  public async readScoped(
    scope: PrivacyPolicyScope,
    input: LocalModelDataPolicyInput,
  ) {
    try {
      if (
        !input.path.trim() ||
        input.path.includes("\0") ||
        (input.expectedDigest !== undefined &&
          !DIGEST.test(input.expectedDigest))
      )
        throw rejected();
      const handle = await open(
        input.path,
        constants.O_RDONLY | constants.O_NONBLOCK,
      );
      let bytes: Buffer;
      try {
        const stat = await handle.stat();
        if (!stat.isFile() || stat.size < 1 || stat.size > MAX_POLICY_BYTES)
          throw rejected();
        const buffer = Buffer.alloc(MAX_POLICY_BYTES + 1);
        let length = 0;
        while (length < buffer.length) {
          const result = await handle.read(
            buffer,
            length,
            buffer.length - length,
            null,
          );
          if (result.bytesRead === 0) break;
          length += result.bytesRead;
        }
        if (length < 1 || length > MAX_POLICY_BYTES) throw rejected();
        bytes = buffer.subarray(0, length);
      } finally {
        await handle.close();
      }
      const sourceDigest = createHash("sha256").update(bytes).digest("hex");
      if (
        input.expectedDigest !== undefined &&
        input.expectedDigest !== sourceDigest
      )
        throw rejected();
      const policy = validateScopedModelDataPolicy(
        JSON.parse(
          new TextDecoder("utf-8", { fatal: true }).decode(bytes),
        ) as unknown,
        scope,
      );
      const canonicalEncoding = `${JSON.stringify(policy, null, 2)}\n`;
      return Object.freeze({
        policy,
        sourceName: safeName(basename(input.path)),
        sourceDigest,
        sourceBytes: bytes.byteLength,
        canonicalBytes: Buffer.byteLength(canonicalEncoding, "utf8"),
        canonicalEncoding,
        effect:
          "READ_ONLY_POLICY_NOT_PERSISTED_AUTHORIZED_OR_DELIVERED" as const,
      });
    } catch (error) {
      throw rejected(error);
    }
  }

  public async read(
    projectId: string,
    input: LocalModelDataPolicyInput,
  ): Promise<LocalModelDataPolicyInspection> {
    if (
      !bounded(projectId) ||
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
    if (source.byteLength < 1 || source.byteLength > MAX_POLICY_BYTES)
      throw rejected();
    const sourceDigest = createHash("sha256").update(source).digest("hex");
    if (
      input.expectedDigest !== undefined &&
      input.expectedDigest !== sourceDigest
    )
      throw rejected();
    let parsed: unknown;
    try {
      parsed = JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(source),
      );
    } catch (error) {
      throw rejected(error);
    }
    const policy = validateModelDataPolicy(parsed);
    if (policy.projectId !== projectId) throw rejected();
    const canonicalEncoding = encodeModelDataPolicy(policy);
    if (
      encodeModelDataPolicy(JSON.parse(canonicalEncoding) as unknown) !==
      canonicalEncoding
    )
      throw rejected();
    return Object.freeze({
      policy,
      sourceName: safeName(basename(input.path)),
      sourceDigest,
      sourceBytes: source.byteLength,
      canonicalBytes: Buffer.byteLength(canonicalEncoding, "utf8"),
      canonicalEncoding,
      effect: "READ_ONLY_POLICY_NOT_PERSISTED_AUTHORIZED_OR_DELIVERED" as const,
    });
  }
}

function bounded(value: string): boolean {
  return value.length >= 1 && value.length <= 256 && !/\p{Cc}/u.test(value);
}
function safeName(value: string): string {
  const result = [...value]
    .map((character) => {
      const code = character.codePointAt(0)!;
      return code <= 31 || code === 127 ? "�" : character;
    })
    .join("");
  return result.slice(0, 256) || "model-data-policy.json";
}
function rejected(cause?: unknown): PrivacyGatewayError {
  return new PrivacyGatewayError(cause === undefined ? undefined : { cause });
}
