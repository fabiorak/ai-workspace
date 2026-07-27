/**
 * The reader of ADR-0032, decision A. It sits between a store and the engine
 * and is the only place that knows what a canonical payload looks like, so the
 * engine can stay a text engine and be reused where no payload exists.
 *
 * A stored payload is `JSON.stringify({...provenance, blockIndex, blockType,
 * ...value})`: provenance fields around the content, one of them unique per
 * record, and a line break that survives only as the two characters `\n`.
 * Indexing that as stored was measured to add 37% of vocabulary and 30% of
 * bytes over the content itself and to flatten paragraph structure, while
 * costing a single point of precision — BM25 discounts a field that is
 * identical across every record, so rank hides the damage that structure shows.
 *
 * This is the measured reduction, ported unchanged from the harness that
 * produced those figures: change it and the numbers ADR-0032 publishes stop
 * describing what the package does.
 */

/**
 * Payload fields that carry provenance rather than content. They are identical
 * in shape across every record and one of them is unique per record, so an index
 * that keeps them spends its vocabulary on them.
 */
export const PROVENANCE_FIELDS: readonly string[] = Object.freeze([
  "recordUuid",
  "recordType",
  "isSidechain",
  "isMeta",
  "blockIndex",
  "blockType",
  "toolUseId",
  "isError",
]);

/** Payload fields that carry what a person actually saw, in reading order. */
export const CONTENT_FIELDS: readonly string[] = Object.freeze([
  "text",
  "name",
  "input",
  "content",
  "block",
]);

export type ExtractedText = Readonly<{
  text: string;
  /**
   * False when the payload was not the expected JSON object. The raw payload is
   * then indexed as it stands and counted, so a corpus produced by a different
   * adapter degrades to the raw shape instead of being silently emptied.
   */
  parsed: boolean;
}>;

function rendered(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return typeof value === "string" ? value : JSON.stringify(value);
}

/**
 * The content fields of a canonical payload, in declared reading order, with
 * provenance dropped. Parsing also turns the two characters `\n` back into the
 * line breaks whoever wrote the text put there.
 */
export function readCanonicalPayload(payload: string): ExtractedText {
  let document: unknown;
  try {
    document = JSON.parse(payload);
  } catch {
    return Object.freeze({ text: payload, parsed: false });
  }
  if (
    document === null ||
    typeof document !== "object" ||
    Array.isArray(document)
  )
    return Object.freeze({ text: payload, parsed: false });

  const record = document as Record<string, unknown>;
  const known = new Set([...PROVENANCE_FIELDS, ...CONTENT_FIELDS]);
  const parts: string[] = [];

  for (const field of CONTENT_FIELDS) {
    if (!(field in record)) continue;
    const part = rendered(record[field]);
    if (part !== null) parts.push(part);
  }

  /**
   * An unexpected field is content until proven otherwise: dropping it would
   * make a future adapter's text invisible to retrieval without any signal.
   */
  for (const [field, value] of Object.entries(record)) {
    if (known.has(field)) continue;
    const part = rendered(value);
    if (part !== null) parts.push(part);
  }

  const text = parts.join("\n\n").trim();
  return Object.freeze({
    text: text.length > 0 ? text : payload,
    parsed: true,
  });
}
