import { constants } from "node:fs";
import { link, lstat, mkdir, open, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname } from "node:path";

export const MAX_BYTES = 16 * 1024;
export const unavailable = () => new Error("TURN_REGISTRY_UNAVAILABLE");
export const missing = (error: unknown) =>
  error instanceof Error && "code" in error && error.code === "ENOENT";
export const exists = (error: unknown) =>
  error instanceof Error && "code" in error && error.code === "EEXIST";

export async function directory(path: string, create = false): Promise<void> {
  if (create) await mkdir(path, { recursive: true, mode: 0o700 });
  const info = await lstat(path);
  if (!info.isDirectory() || (info.mode & 0o777) !== 0o700) throw unavailable();
}

export async function syncDirectory(path: string): Promise<void> {
  const handle = await open(
    path,
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_DIRECTORY,
  );
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

/** Open once, bound before allocation and while reading, reject symlinks. */
export async function read(path: string): Promise<unknown | null> {
  let handle;
  try {
    handle = await open(
      path,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
  } catch (error) {
    if (missing(error)) return null;
    throw unavailable();
  }
  try {
    const info = await handle.stat();
    if (
      !info.isFile() ||
      (info.mode & 0o777) !== 0o600 ||
      info.size > MAX_BYTES
    )
      throw unavailable();
    const bytes = Buffer.alloc(MAX_BYTES + 1);
    let size = 0;
    while (size < bytes.length) {
      const part = await handle.read(bytes, size, bytes.length - size, null);
      if (part.bytesRead === 0) break;
      size += part.bytesRead;
    }
    if (size > MAX_BYTES) throw unavailable();
    return JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, size)),
    );
  } finally {
    await handle.close();
  }
}

/** Publish once without replacing existing evidence, then sync and reread it. */
export async function publish(path: string, value: unknown): Promise<void> {
  const content = JSON.stringify(value);
  if (Buffer.byteLength(content) > MAX_BYTES) throw unavailable();
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    const handle = await open(temporary, "wx", 0o600);
    try {
      await handle.writeFile(content);
      await handle.sync();
    } finally {
      await handle.close();
    }
    await link(temporary, path);
    await unlink(temporary);
    await syncDirectory(dirname(path));
    if (JSON.stringify(await read(path)) !== content) throw unavailable();
  } finally {
    await unlink(temporary).catch(() => undefined);
  }
}
