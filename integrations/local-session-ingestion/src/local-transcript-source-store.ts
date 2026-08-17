import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

/**
 * The transcript directories a person has already pointed at, one set per project.
 *
 * Nothing here is guessed. A directory is remembered only because somebody named it
 * and imported from it, which is the same explicit act the interface already asks
 * for — it simply stops being asked again at every start. That is the whole of the
 * permission this store holds: it can re-read what it was shown, never find more.
 *
 * A file signature is kept beside each name so an unchanged transcript is skipped
 * rather than re-imported. Import is idempotent, so skipping is an economy and not
 * a correctness measure: getting the signature wrong costs time, never truth.
 */

/** One directory a project imports from, and what was seen in it last time. */
export type TranscriptSource = Readonly<{
  projectId: string;
  directory: string;
  /** File name to `bytes:modifiedAt`, the cheapest honest statement that a file is unchanged. */
  seen: Readonly<Record<string, string>>;
}>;

type StoredDocument = Readonly<{
  schemaVersion: 1;
  sources: readonly TranscriptSource[];
}>;

/**
 * The bound is generous but present: a workspace that accumulated thousands of
 * remembered directories would turn every start into a directory sweep.
 */
const MAX_SOURCES = 200;

export const TRANSCRIPT_SOURCE_FILE = "transcript-sources.json";

export function signatureOf(
  file: Readonly<{ byteLength: number; modifiedAt: string }>,
): string {
  return `${file.byteLength}:${file.modifiedAt}`;
}

export class LocalTranscriptSourceStore {
  readonly #path: string;

  public constructor(workspaceHome: string) {
    this.#path = join(workspaceHome, TRANSCRIPT_SOURCE_FILE);
  }

  /**
   * Everything remembered so far.
   *
   * An unreadable or malformed file yields nothing rather than throwing: this is a
   * convenience store, and losing it must degrade the product to the explicit path
   * it already had instead of stopping it.
   */
  public async list(): Promise<readonly TranscriptSource[]> {
    let raw: string;
    try {
      raw = await readFile(this.#path, "utf8");
    } catch {
      return Object.freeze([]);
    }
    try {
      const document = JSON.parse(raw) as StoredDocument;
      if (document.schemaVersion !== 1 || !Array.isArray(document.sources))
        return Object.freeze([]);
      return Object.freeze(
        document.sources.filter(
          (source) =>
            typeof source?.projectId === "string" &&
            typeof source?.directory === "string",
        ),
      );
    } catch {
      return Object.freeze([]);
    }
  }

  /**
   * Remembers one directory for one project, merging what was seen in it.
   *
   * Writing goes through a temporary file and a rename, like every other local
   * write here, so an interrupted start never leaves half a document behind.
   */
  public async remember(
    entry: Readonly<{
      projectId: string;
      directory: string;
      seen?: Readonly<Record<string, string>> | undefined;
    }>,
  ): Promise<void> {
    const existing = await this.list();
    const kept = existing.filter(
      (source) =>
        source.projectId !== entry.projectId ||
        source.directory !== entry.directory,
    );
    const previous = existing.find(
      (source) =>
        source.projectId === entry.projectId &&
        source.directory === entry.directory,
    );
    const merged: TranscriptSource = Object.freeze({
      projectId: entry.projectId,
      directory: entry.directory,
      seen: Object.freeze({ ...(previous?.seen ?? {}), ...(entry.seen ?? {}) }),
    });
    const document: StoredDocument = Object.freeze({
      schemaVersion: 1,
      sources: Object.freeze([merged, ...kept].slice(0, MAX_SOURCES)),
    });
    await mkdir(dirname(this.#path), { recursive: true });
    const temporary = `${this.#path}.tmp`;
    await writeFile(
      temporary,
      `${JSON.stringify(document, null, 2)}\n`,
      "utf8",
    );
    await rename(temporary, this.#path);
  }
}
