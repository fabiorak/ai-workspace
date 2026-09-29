import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { basename } from "node:path";
import { InstructionError } from "@ai-workspace/instruction-manager";

const MAX_BYTES = 256 * 1_024;
export async function readScopedConfiguration(
  input: Readonly<{ path: string; expectedDigest?: string }>,
) {
  try {
    if (
      !input.path.trim() ||
      input.path.includes("\0") ||
      (input.expectedDigest !== undefined &&
        !/^[a-f0-9]{64}$/u.test(input.expectedDigest))
    )
      throw new Error();
    const handle = await open(
      input.path,
      constants.O_RDONLY | constants.O_NONBLOCK,
    );
    let bytes: Buffer;
    try {
      const stat = await handle.stat();
      if (!stat.isFile() || stat.size < 1 || stat.size > MAX_BYTES)
        throw new Error();
      const buffer = Buffer.alloc(MAX_BYTES + 1);
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
      if (length < 1 || length > MAX_BYTES) throw new Error();
      bytes = buffer.subarray(0, length);
    } finally {
      await handle.close();
    }
    const sourceDigest = createHash("sha256").update(bytes).digest("hex");
    if (
      input.expectedDigest !== undefined &&
      input.expectedDigest !== sourceDigest
    )
      throw new Error();
    return {
      value: JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      ) as unknown,
      sourceDigest,
      sourceBytes: bytes.byteLength,
      sourceName:
        basename(input.path)
          .replace(/\p{Cc}/gu, "�")
          .slice(0, 256) || "configuration.json",
    };
  } catch (cause) {
    throw new InstructionError(
      "The explicit scoped configuration is unreadable, changed, malformed, or exceeds the 256 KiB read limit.",
      { cause },
    );
  }
}
