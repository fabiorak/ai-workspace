/**
 * The one line of a stored moment, wherever the moment keeps its text.
 *
 * Ingestion inlines a payload up to `INLINE_PAYLOAD_LIMIT` — four kilobytes — and
 * keeps anything longer as a separate artifact. Until now no screen opened those, so
 * on a real transcript the interface went quiet exactly where it mattered: measured
 * on 2026-08-29, a real session averaged 4,267 bytes per moment, which puts the long
 * replies — the ones carrying the reasoning — on the far side of that bound. Both the
 * conversation and the restart point showed "the text is kept elsewhere" for them.
 *
 * The old objection was sound as long as it held: quoting a file the view never
 * opened would be a claim about bytes nobody checked. Opening it answers the
 * objection rather than ignoring it — the bytes are checked, they are local, and they
 * are already this workspace's own.
 *
 * What is read is bounded. A line is at most `MOMENT_TEXT_LIMIT` characters, so
 * reading more than the opening of an artifact would be paying for text that gets cut
 * anyway. An artifact that cannot be read is said out loud rather than passed off as
 * an empty moment: silence and failure must not look the same.
 */
import { readCanonicalPayload } from "@ai-workspace/historical-search";
import type { ImportedSession } from "@ai-workspace/session-ingestion";

/**
 * How much of an artifact is read for one line. It is far more than a bounded line
 * needs, because a canonical payload is JSON and the readable text sits inside it,
 * behind provenance fields that come first.
 */
export const ARTIFACT_READ_BYTES = 16_384;

/** Reads a stored artifact's text. Bounded reading is the caller's to apply. */
export type ArtifactReader = (artifactId: string) => Promise<string>;

export type MomentText = Readonly<{
  text: string;
  fromCanonicalPayload: boolean;
  /**
   * True when the line came from an artifact this view opened. The interface says so:
   * a reader deciding how much to trust a quotation is told where it was read from,
   * exactly as with a payload that was not the canonical envelope.
   */
  fromArtifact: boolean;
}>;

const EMPTY: MomentText = Object.freeze({
  text: "",
  fromCanonicalPayload: false,
  fromArtifact: false,
});

/**
 * One readable line: line breaks collapsed, and a marked tail when it did not fit.
 * Nothing is rewritten or summarised — the text is the stored text, cut where the
 * bound falls.
 */
export function oneLine(value: string, limit: number): string {
  const collapsed = value.replace(/\s+/gu, " ").trim();
  return collapsed.length <= limit
    ? collapsed
    : `${collapsed.slice(0, limit - 1)}…`;
}

export async function momentTextOf(
  event: ImportedSession["events"][number],
  limit: number,
  readArtifact: ArtifactReader | null,
): Promise<MomentText> {
  if (event.payload.kind === "INLINE_TEXT") {
    const read = readCanonicalPayload(event.payload.text);
    return Object.freeze({
      text: oneLine(read.text, limit),
      fromCanonicalPayload: read.parsed,
      fromArtifact: false,
    });
  }
  if (readArtifact === null) return EMPTY;
  try {
    const content = await readArtifact(event.payload.artifact.id);
    const read = readCanonicalPayload(content.slice(0, ARTIFACT_READ_BYTES));
    return Object.freeze({
      text: oneLine(read.text, limit),
      fromCanonicalPayload: read.parsed,
      fromArtifact: true,
    });
  } catch {
    /**
     * The artifact is gone or unreadable. An empty line would read as a moment that
     * held nothing, so the caller is told it came from an artifact and carries no
     * text, and the interface says which of the two it is.
     */
    return Object.freeze({
      text: "",
      fromCanonicalPayload: false,
      fromArtifact: true,
    });
  }
}
