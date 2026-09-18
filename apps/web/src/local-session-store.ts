/**
 * Keeps the browser session across restarts of the local host.
 *
 * ADR-0015 gave every process its own session token, which made the one-time
 * bootstrap link the only way in. That is correct for the token that proves
 * "whoever opened this link can read the terminal that started the program",
 * but it charged that proof again after every restart: closing the host and
 * starting it once more cost a trip to the terminal, a fresh link, and a lost
 * tab. ADR-0046 keeps the proof and stores its result, so the link is needed
 * when there is no living session rather than once per process.
 *
 * What is stored is exactly the session cookie value and nothing else: no
 * project, conversation or map content, and no credential for anything outside
 * this machine. It lives inside the workspace home, so a person who moves or
 * deletes that folder moves or deletes the session with it.
 *
 * The file is refused rather than trusted when its permissions would let
 * another account read it, because a token others could have read is a token
 * that no longer proves anything. The same holds for a file that cannot be
 * parsed: the safe reading of a damaged session is "there is none".
 */
import { randomBytes } from "node:crypto";
import { chmod, mkdir, open, readFile, rename, stat } from "node:fs/promises";
import { join } from "node:path";

/** Thirty days: long enough that restarting is not a ceremony, short enough
 * that an abandoned workspace stops answering on its own. */
export const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
const SCHEMA_VERSION = 1;
const MAX_DOCUMENT_BYTES = 4 * 1024;
const TOKEN_PATTERN = /^[0-9a-f]{64}$/u;

/** Why the stored session could not be reused, when it could not. A person who
 * has to open the link again is owed the reason, and "expired" and "readable by
 * others" are very different reasons. */
export type SessionRenewalReason =
  "MISSING" | "EXPIRED" | "UNREADABLE" | "UNSAFE_PERMISSIONS";

export type LocalSession = Readonly<{
  token: string;
  expiresAt: Date;
  /** What the cookie should claim, so the browser forgets it when the stored
   * session ends instead of holding a value the host already refuses. */
  maxAgeSeconds: number;
  reused: boolean;
  /** Null exactly when the session was reused. */
  renewedBecause: SessionRenewalReason | null;
  /** False when a new session was minted but could not be written down: the
   * host still works, and the next restart will ask for the link again. */
  stored: boolean;
}>;

export class LocalSessionStore {
  readonly #directory: string;
  readonly #path: string;
  readonly #clock: () => Date;
  readonly #lifetimeMs: number;

  public constructor(
    workspaceHome: string,
    options: Readonly<{ clock?: () => Date; lifetimeMs?: number }> = {},
  ) {
    this.#directory = join(workspaceHome, "session");
    this.#path = join(this.#directory, "session.json");
    this.#clock = options.clock ?? (() => new Date());
    this.#lifetimeMs = options.lifetimeMs ?? SESSION_LIFETIME_MS;
  }

  public async establish(): Promise<LocalSession> {
    const now = this.#clock();
    const kept = await this.#read(now);
    return typeof kept === "string" ? this.#create(now, kept) : kept;
  }

  /**
   * Answers with the living session, or with the one reason it cannot be used.
   * One pass over the file: asking twice would let it change in between and
   * report a reason that no longer matches what was refused.
   */
  async #read(now: Date): Promise<LocalSession | SessionRenewalReason> {
    let metadata;
    try {
      metadata = await stat(this.#path);
    } catch {
      return "MISSING";
    }
    if ((metadata.mode & 0o077) !== 0) return "UNSAFE_PERMISSIONS";
    let document;
    try {
      const content = await readFile(this.#path);
      if (content.byteLength > MAX_DOCUMENT_BYTES) return "UNREADABLE";
      document = parse(content);
    } catch {
      return "UNREADABLE";
    }
    if (document === null) return "UNREADABLE";
    const remaining = document.expiresAt.getTime() - now.getTime();
    if (remaining <= 0) return "EXPIRED";
    return Object.freeze({
      token: document.token,
      expiresAt: document.expiresAt,
      maxAgeSeconds: Math.floor(remaining / 1000),
      reused: true,
      renewedBecause: null,
      stored: true,
    });
  }

  async #create(
    now: Date,
    renewedBecause: SessionRenewalReason,
  ): Promise<LocalSession> {
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(now.getTime() + this.#lifetimeMs);
    const stored = await this.#write(token, now, expiresAt);
    return Object.freeze({
      token,
      expiresAt,
      maxAgeSeconds: Math.floor(this.#lifetimeMs / 1000),
      reused: false,
      renewedBecause,
      stored,
    });
  }

  /**
   * Written beside its destination and renamed over it, so a reader never sees
   * half a session, and created with 0600 from the first byte rather than
   * widened and narrowed afterwards.
   */
  async #write(token: string, now: Date, expiresAt: Date): Promise<boolean> {
    const temporaryPath = `${this.#path}.${randomBytes(8).toString("hex")}.tmp`;
    try {
      await mkdir(this.#directory, { recursive: true, mode: 0o700 });
      await chmod(this.#directory, 0o700);
      const file = await open(temporaryPath, "wx", 0o600);
      try {
        await file.writeFile(
          `${JSON.stringify(
            {
              schemaVersion: SCHEMA_VERSION,
              token,
              createdAt: now.toISOString(),
              expiresAt: expiresAt.toISOString(),
            },
            null,
            2,
          )}\n`,
          "utf8",
        );
      } finally {
        await file.close();
      }
      await rename(temporaryPath, this.#path);
      return true;
    } catch {
      return false;
    }
  }
}

function parse(
  content: Buffer,
): Readonly<{ token: string; expiresAt: Date }> | null {
  let value: unknown;
  try {
    value = JSON.parse(content.toString("utf8"));
  } catch {
    return null;
  }
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    (value as Record<string, unknown>).schemaVersion !== SCHEMA_VERSION
  )
    return null;
  const document = value as Record<string, unknown>;
  const token = document.token;
  const expires = document.expiresAt;
  if (
    typeof token !== "string" ||
    !TOKEN_PATTERN.test(token) ||
    typeof expires !== "string"
  )
    return null;
  const expiresAt = new Date(expires);
  return Number.isNaN(expiresAt.getTime())
    ? null
    : Object.freeze({ token, expiresAt });
}
