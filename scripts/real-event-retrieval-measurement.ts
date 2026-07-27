/**
 * Measures retrieval over the real canonical events held in a local workspace
 * home, to settle the two questions ADR-0031 left open at the place the product
 * actually lives: what the record unit for an event must be, and whether one
 * record needs both token sets.
 *
 * A third axis was added after the first run, because the corpus answered a
 * question that had not been asked: a canonical payload is not prose. Every
 * payload this repository's adapters produce is a serialized JSON object
 * carrying provenance fields and the text inside one of them, so an engine that
 * indexes the payload indexes field names and a per-record UUID alongside the
 * words, and paragraph structure survives only as escape sequences. Measuring
 * the payload shape is therefore a precondition for the other two questions
 * rather than a separate curiosity.
 *
 * The store it reads is private. Nothing it reads is emitted: the report carries
 * counts, rates, and byte quantiles, and probe text — which is derived from real
 * content — exists only in memory for the duration of the run. There is no dense
 * path here, because a model answers none of the three questions.
 *
 * Development-only. No production consumer reads this file.
 */

import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import {
  PROVENANCE_FIELDS,
  contentTerms,
  normalizeTokens,
  readCanonicalPayload,
  stem,
} from "../packages/tolerant-retrieval/src/index.ts";
import {
  buildCodeIndex,
  searchCode,
  type CodeRecord,
} from "./code-retrieval-measurement.ts";

export class RealEventRetrievalMeasurementError extends Error {}

export const REAL_EVENT_CORPUS_ID = "REAL_EVENT_RETRIEVAL_LOCAL_V1";
export const SCHEMA_VERSION = 1;

/** Same interactive budget as every other retrieval measurement. */
const INTERACTIVE_BUDGET_MILLISECONDS = 150;

/** Below this a unit cannot be separated from noise. */
const MINIMUM_EVENTS = 30;
const MINIMUM_MULTI_BLOCK_EVENTS = 10;
/** Below this the shape is reported but no verdict may be cited as settled. */
const INDICATIVE_EVENTS = 300;

/** Declared split point for the third record unit. */
const EVENT_BYTE_THRESHOLD = 2_048;

const MAX_PROBES_PER_FAMILY = 400;
const MAX_ARTIFACT_BYTES = 64 * 1024;
const RESULT_LIMIT = 10;

/** A block gain below this is not worth an index entry per paragraph. */
const BYTES_TO_READ_GAIN_PERCENT = 30;

/**
 * Vocabulary the raw payload adds over its own content, above which the payload
 * shape is spending the index on field names rather than on what a person wrote.
 */
const VOCABULARY_INFLATION_PERCENT = 20;

const SESSION_FILE_PATTERN = /^(session_[a-f0-9]{64})\.json$/u;
const ARTIFACT_ID_PATTERN = /^artifact:\/\/sha256\/([a-f0-9]{64})$/u;

/** Identifier shapes a person would type back: camelCase, snake_case, dotted. */
const CODE_SHAPED =
  /^(?=.*[a-z])(?:[A-Za-z][A-Za-z0-9]*(?:[._][A-Za-z0-9]+)+|[a-z][a-z0-9]*[A-Z][A-Za-z0-9]*)$/u;
const IDENTIFIER_CANDIDATE = /[A-Za-z_$][A-Za-z0-9_$.]*/gu;

const PUNCTUATION_SEQUENCES = Object.freeze([
  "??",
  "===",
  "!==",
  "=>",
  "?.",
  "...",
  "&&",
  "||",
]);

export const PROBE_FAMILIES = Object.freeze([
  "UNIQUE_PROSE_TERM",
  "UNIQUE_IDENTIFIER",
  "UNIQUE_PUNCTUATION",
  "INFLECTED_PROSE_TERM",
  "TRANSPOSED_TERM",
  "TWO_TERM_CONJUNCTION",
  "PROSE_AND_CODE_CONJUNCTION",
] as const);
export type ProbeFamily = (typeof PROBE_FAMILIES)[number];

export const RECORD_UNITS = Object.freeze([
  "EVENT",
  "BLOCK",
  "EVENT_ABOVE_THRESHOLD",
] as const);
export type RecordUnit = (typeof RECORD_UNITS)[number];

export const RECORD_SHAPES = Object.freeze([
  "RAW_PAYLOAD",
  "EXTRACTED_TEXT",
] as const);
export type RecordShape = (typeof RECORD_SHAPES)[number];

export const TOKENIZATIONS = Object.freeze([
  "PROSE_ONLY",
  "CODE_ONLY",
  "MODE_PER_QUERY",
  "BOTH_SETS_MERGED",
] as const);
export type Tokenization = (typeof TOKENIZATIONS)[number];

export const SHAPE_VERDICTS = Object.freeze([
  "UNDECIDED_CORPUS_TOO_SMALL",
  "TEXT_EXTRACTION_REQUIRED_BEFORE_INDEXING",
  "RAW_PAYLOAD_INDEXABLE_AS_IS",
] as const);
export type ShapeVerdict = (typeof SHAPE_VERDICTS)[number];

export const UNIT_VERDICTS = Object.freeze([
  "UNDECIDED_CORPUS_TOO_SMALL",
  "BLOCK_UNIT_REQUIRED",
  "EVENT_UNIT_WITH_THRESHOLD",
  "EVENT_UNIT_SUFFICIENT",
] as const);
export type UnitVerdict = (typeof UNIT_VERDICTS)[number];

export const TOKENIZATION_VERDICTS = Object.freeze([
  "UNDECIDED_CORPUS_TOO_SMALL",
  "BOTH_TOKEN_SETS_REQUIRED_PER_RECORD",
  "MODE_SELECTION_SUFFICIENT",
  "PROSE_ONLY_SUFFICIENT",
] as const);
export type TokenizationVerdict = (typeof TOKENIZATION_VERDICTS)[number];

/**
 * One real canonical event, reduced to what retrieval needs. `text` never leaves
 * the process.
 */
type SourceEvent = Readonly<{
  id: string;
  type: string;
  occurredAt: string;
  /** The canonical payload exactly as stored. */
  raw: string;
  /** The content fields of the payload, provenance removed. */
  extracted: string;
  rawBlocks: readonly string[];
  extractedBlocks: readonly string[];
  parsedAsJson: boolean;
  fromArtifact: boolean;
  truncated: boolean;
}>;

function textFor(event: SourceEvent, shape: RecordShape): string {
  return shape === "RAW_PAYLOAD" ? event.raw : event.extracted;
}

function blocksFor(event: SourceEvent, shape: RecordShape): readonly string[] {
  return shape === "RAW_PAYLOAD" ? event.rawBlocks : event.extractedBlocks;
}

type Probe = Readonly<{
  family: ProbeFamily;
  text: string;
  /** The event the answer must land in, fixed by construction. */
  expectedEventId: string;
  /** Whether the probe reads as code rather than prose, for mode selection. */
  codeShaped: boolean;
}>;

/** The part of the fingerprint that depends on which shape is indexed. */
export type ShapeFingerprint = Readonly<{
  shape: RecordShape;
  multiBlockEvents: number;
  eventsAboveByteThreshold: number;
  blocks: number;
  bytesTotal: number;
  bytesMedian: number;
  bytesP95: number;
  bytesMax: number;
  distinctProseTerms: number;
  distinctCodeTerms: number;
}>;

export type CorpusFingerprint = Readonly<{
  projects: number;
  sessionDocuments: number;
  canonicalEvents: number;
  eventsByType: Readonly<Record<string, number>>;
  eventsFromArtifacts: number;
  truncatedArtifacts: number;
  eventsWithTimestamp: number;
  /** Payloads that were the expected serialized JSON object. */
  eventsParsedAsJson: number;
  /** How many of the declared provenance keys the payloads actually carry. */
  provenanceFieldsObserved: number;
  proseOnlyEvents: number;
  codeOnlyEvents: number;
  mixedEvents: number;
  shapes: readonly ShapeFingerprint[];
}>;

export type FamilyReachability = Readonly<{
  family: ProbeFamily;
  probes: number;
  precisionAtOnePercent: number;
  recallAtTenPercent: number;
  unreachableProbes: number;
}>;

export type CellMeasurement = Readonly<{
  shape: RecordShape;
  unit: RecordUnit;
  tokenization: Tokenization;
  records: number;
  distinctTerms: number;
  probes: number;
  precisionAtOnePercent: number;
  recallAtTenPercent: number;
  unreachableProbes: number;
  bytesToReadMedian: number;
  bytesToReadP95: number;
  families: readonly FamilyReachability[];
  buildMilliseconds: number;
  queryP95Milliseconds: number;
  withinBudget: boolean;
}>;

export type RealEventRetrievalReport = Readonly<{
  schemaVersion: 1;
  corpusId: string;
  declaredConsumer: "DEVELOPMENT_ONLY_NO_PRODUCTION_CONSUMER";
  homeReadable: boolean;
  fingerprint: CorpusFingerprint;
  probesByFamily: Readonly<Record<ProbeFamily, number>>;
  bounds: Readonly<{
    minimumEvents: number;
    minimumMultiBlockEvents: number;
    indicativeEvents: number;
    eventByteThreshold: number;
    maxProbesPerFamily: number;
    resultLimit: number;
    interactiveBudgetMilliseconds: number;
    bytesToReadGainPercent: number;
    vocabularyInflationPercent: number;
  }>;
  cells: readonly CellMeasurement[];
  shape: Readonly<{
    verdict: ShapeVerdict;
    indicativeOnly: boolean;
    /** Payloads that were the serialized JSON object the adapter writes. */
    payloadsParsedAsJsonPercent: number;
    /** Provenance keys observed across payloads, of the eight declared. */
    provenanceFieldsObserved: number;
    multiBlockEventsRaw: number;
    multiBlockEventsExtracted: number;
    vocabularyInflationPercent: number;
    bytesInflationPercent: number;
    precisionAtOneLossPercentagePoints: number;
  }>;
  unit: Readonly<{
    verdict: UnitVerdict;
    indicativeOnly: boolean;
    precisionAtOneGainPercentagePoints: number;
    bytesToReadReductionPercent: number;
    recallLostPercentagePoints: number;
    gainConfinedToLargeEvents: boolean;
  }>;
  tokenization: Readonly<{
    verdict: TokenizationVerdict;
    indicativeOnly: boolean;
    familiesReachedByProseOnly: number;
    familiesReachedByCodeOnly: number;
    familiesReachedByModePerQuery: number;
    familiesReachedByBothSetsMerged: number;
    mixedFamilyProbes: number;
    mixedFamilyReachableUnderModePerQuery: boolean;
  }>;
}>;

export function resolveWorkspaceHome(override?: string): string {
  return (
    override ??
    process.env["AI_WORKSPACE_HOME"] ??
    join(homedir(), ".ai-workspace")
  );
}

/**
 * Blank-line delimited blocks. Declared as not a Markdown parse: a fenced code
 * block containing a blank line splits, and that limit is reported rather than
 * hidden behind a parser this measurement does not have.
 */
export function splitBlocks(text: string): readonly string[] {
  const blocks = text
    .split(/\n[ \t]*\n+/u)
    .map((block) => block.trim())
    .filter((block) => block.length > 0);
  return Object.freeze(blocks.length > 0 ? blocks : [text.trim()]);
}

/**
 * A block reads as code when it is fenced, indented as a listing, or carries
 * more code-shaped identifiers and punctuation than prose words.
 */
export function readsAsCode(text: string): boolean {
  if (/```|^ {4}\S|^\t\S/mu.test(text)) return true;
  const words = normalizeTokens(text).length;
  if (words === 0) return true;
  const identifiers = [...text.matchAll(IDENTIFIER_CANDIDATE)].filter((match) =>
    CODE_SHAPED.test(match[0]),
  ).length;
  const punctuation = PUNCTUATION_SEQUENCES.reduce(
    (sum, sequence) => sum + text.split(sequence).length - 1,
    0,
  );
  return (identifiers + punctuation) * 4 >= words;
}

/**
 * The text reduction moved to `@ai-workspace/tolerant-retrieval`, ported
 * unchanged, and is re-exported here under the name this measurement published
 * it under, so the figures below and the package describe one reduction.
 */
export { readCanonicalPayload as extractText };

async function readArtifactText(
  home: string,
  artifactId: string,
): Promise<Readonly<{ text: string; truncated: boolean }>> {
  const digest = ARTIFACT_ID_PATTERN.exec(artifactId)?.[1];
  if (digest === undefined)
    return Object.freeze({ text: "", truncated: false });
  const path = join(home, "artifacts", "sha256", digest.slice(0, 2), digest);
  let content: Buffer;
  try {
    content = await readFile(path);
  } catch {
    return Object.freeze({ text: "", truncated: false });
  }
  const truncated = content.byteLength > MAX_ARTIFACT_BYTES;
  return Object.freeze({
    text: content.subarray(0, MAX_ARTIFACT_BYTES).toString("utf8"),
    truncated,
  });
}

/**
 * Reads canonical events from the local home. Missing, unreadable, or malformed
 * documents are skipped rather than thrown on: a private store measured for
 * shape must not fail the whole run because one document is not what this
 * script expects.
 */
export async function readCanonicalEvents(home: string): Promise<
  Readonly<{
    readable: boolean;
    projects: number;
    sessionDocuments: number;
    events: readonly SourceEvent[];
  }>
> {
  let projects: number;
  try {
    const registry: unknown = JSON.parse(
      await readFile(join(home, "projects.json"), "utf8"),
    );
    projects = countRegistered(registry);
  } catch {
    return Object.freeze({
      readable: false,
      projects: 0,
      sessionDocuments: 0,
      events: Object.freeze([]),
    });
  }

  let entries: readonly string[];
  try {
    entries = await readdir(join(home, "sessions"));
  } catch {
    return Object.freeze({
      readable: true,
      projects,
      sessionDocuments: 0,
      events: Object.freeze([]),
    });
  }

  const sessionIds = entries
    .map((entry) => SESSION_FILE_PATTERN.exec(entry)?.[0])
    .filter((value): value is string => value !== undefined)
    .sort();

  const events: SourceEvent[] = [];

  for (const file of sessionIds) {
    let document: unknown;
    try {
      document = JSON.parse(
        await readFile(join(home, "sessions", file), "utf8"),
      );
    } catch {
      continue;
    }
    const session = (document as { session?: unknown }).session;
    const list = (session as { events?: unknown } | undefined)?.events;
    if (!Array.isArray(list)) continue;

    for (const entry of list) {
      const event = entry as {
        id?: unknown;
        type?: unknown;
        occurredAt?: unknown;
        payload?: {
          kind?: unknown;
          text?: unknown;
          artifact?: { id?: unknown };
        };
      };
      if (typeof event.id !== "string" || typeof event.type !== "string")
        continue;

      let text: string;
      let fromArtifact = false;
      let truncated = false;

      if (event.payload?.kind === "INLINE_TEXT") {
        if (typeof event.payload.text !== "string") continue;
        text = event.payload.text;
      } else if (event.payload?.kind === "ARTIFACT") {
        const artifactId = event.payload.artifact?.id;
        if (typeof artifactId !== "string") continue;
        const read = await readArtifactText(home, artifactId);
        text = read.text;
        truncated = read.truncated;
        fromArtifact = true;
      } else {
        continue;
      }

      if (text.trim().length === 0) continue;

      const extraction = readCanonicalPayload(text);

      events.push(
        Object.freeze({
          id: event.id,
          type: event.type,
          occurredAt:
            typeof event.occurredAt === "string" ? event.occurredAt : "",
          raw: text,
          extracted: extraction.text,
          rawBlocks: splitBlocks(text),
          extractedBlocks: splitBlocks(extraction.text),
          parsedAsJson: extraction.parsed,
          fromArtifact,
          truncated,
        }),
      );
    }
  }

  return Object.freeze({
    readable: true,
    projects,
    sessionDocuments: sessionIds.length,
    events: Object.freeze(events),
  });
}

function countRegistered(registry: unknown): number {
  if (Array.isArray(registry)) return registry.length;
  if (registry !== null && typeof registry === "object") {
    const projects = (registry as { projects?: unknown }).projects;
    if (Array.isArray(projects)) return projects.length;
    return Object.keys(registry).length;
  }
  return 0;
}

/**
 * Whether an event carries prose, code, or both. Judged on content rather than
 * on blocks: a record with one block can still be a sentence about a symbol, and
 * classifying by block would make `mixed` unreachable by construction.
 */
function classifyContent(
  text: string,
): Readonly<{ prose: boolean; code: boolean }> {
  const identifiers = [...text.matchAll(IDENTIFIER_CANDIDATE)]
    .map((match) => match[0])
    .filter((identifier) => CODE_SHAPED.test(identifier));
  const identifierParts = new Set(
    identifiers.flatMap((identifier) => normalizeTokens(identifier)),
  );
  const proseWords = normalizeTokens(text).filter(
    (token) => token.length >= 4 && !identifierParts.has(token),
  );
  const punctuation = PUNCTUATION_SEQUENCES.some((sequence) =>
    text.includes(sequence),
  );
  return Object.freeze({
    prose: proseWords.length >= 5,
    code: identifiers.length > 0 || punctuation,
  });
}

/**
 * Which declared provenance keys a payload carries. Only key names are read, and
 * only their count leaves the process; no value is touched.
 */
function provenanceKeysOf(event: SourceEvent): readonly string[] {
  if (!event.parsedAsJson) return Object.freeze([]);
  let document: unknown;
  try {
    document = JSON.parse(event.raw);
  } catch {
    return Object.freeze([]);
  }
  if (document === null || typeof document !== "object")
    return Object.freeze([]);
  const keys = new Set(Object.keys(document as Record<string, unknown>));
  return Object.freeze(PROVENANCE_FIELDS.filter((field) => keys.has(field)));
}

function shapeFingerprint(
  events: readonly SourceEvent[],
  shape: RecordShape,
): ShapeFingerprint {
  const sizes: number[] = [];
  let blocks = 0;
  const proseTerms = new Set<string>();
  const codeTerms = new Set<string>();

  for (const event of events) {
    const text = textFor(event, shape);
    sizes.push(Buffer.byteLength(text, "utf8"));
    blocks += blocksFor(event, shape).length;
    for (const token of normalizeTokens(text)) proseTerms.add(stem(token));
    for (const match of text.matchAll(IDENTIFIER_CANDIDATE))
      if (CODE_SHAPED.test(match[0])) codeTerms.add(match[0].toLowerCase());
  }

  return Object.freeze({
    shape,
    multiBlockEvents: events.filter(
      (event) => blocksFor(event, shape).length > 1,
    ).length,
    eventsAboveByteThreshold: sizes.filter(
      (size) => size > EVENT_BYTE_THRESHOLD,
    ).length,
    blocks,
    bytesTotal: sizes.reduce((sum, size) => sum + size, 0),
    bytesMedian: quantile(sizes, 0.5),
    bytesP95: quantile(sizes, 0.95),
    bytesMax: sizes.length === 0 ? 0 : Math.max(...sizes),
    distinctProseTerms: proseTerms.size,
    distinctCodeTerms: codeTerms.size,
  });
}

export function fingerprint(
  projects: number,
  sessionDocuments: number,
  events: readonly SourceEvent[],
): CorpusFingerprint {
  const byType = new Map<string, number>();
  const provenanceKeys = new Set<string>();
  let proseOnly = 0;
  let codeOnly = 0;
  let mixed = 0;

  for (const event of events) {
    byType.set(event.type, (byType.get(event.type) ?? 0) + 1);
    /** Classified on the extracted text, which is what a person saw. */
    const kind = classifyContent(event.extracted);
    if (kind.prose && kind.code) mixed += 1;
    else if (kind.code) codeOnly += 1;
    else proseOnly += 1;
    for (const field of provenanceKeysOf(event)) provenanceKeys.add(field);
  }

  return Object.freeze({
    projects,
    sessionDocuments,
    canonicalEvents: events.length,
    eventsByType: Object.freeze(Object.fromEntries([...byType].sort())),
    eventsFromArtifacts: events.filter((event) => event.fromArtifact).length,
    truncatedArtifacts: events.filter((event) => event.truncated).length,
    eventsWithTimestamp: events.filter((event) => event.occurredAt !== "")
      .length,
    eventsParsedAsJson: events.filter((event) => event.parsedAsJson).length,
    provenanceFieldsObserved: provenanceKeys.size,
    proseOnlyEvents: proseOnly,
    codeOnlyEvents: codeOnly,
    mixedEvents: mixed,
    shapes: Object.freeze(
      RECORD_SHAPES.map((shape) => shapeFingerprint(events, shape)),
    ),
  });
}

/**
 * Records for one unit. `path` carries the owning event identifier so that a
 * result can be attributed to an event whatever the unit, which is what makes
 * the three units comparable on the same probes.
 */
export function buildUnitRecords(
  events: readonly SourceEvent[],
  unit: RecordUnit,
  shape: RecordShape,
): readonly CodeRecord[] {
  const records: CodeRecord[] = [];
  for (const event of events) {
    const text = textFor(event, shape);
    const split =
      unit === "BLOCK" ||
      (unit === "EVENT_ABOVE_THRESHOLD" &&
        Buffer.byteLength(text, "utf8") > EVENT_BYTE_THRESHOLD);
    if (!split) {
      records.push(
        Object.freeze({
          id: event.id,
          path: event.id,
          symbol: null,
          unit: "FILE" as const,
          body: text,
          startLine: 1,
        }),
      );
      continue;
    }
    blocksFor(event, shape).forEach((block, position) => {
      records.push(
        Object.freeze({
          id: `${event.id}#${position}`,
          path: event.id,
          symbol: null,
          unit: "SYMBOL" as const,
          body: block,
          startLine: position + 1,
        }),
      );
    });
  }
  return Object.freeze(records);
}

function eventDocumentFrequency(events: readonly SourceEvent[]): Readonly<{
  proseTerms: ReadonlyMap<string, readonly string[]>;
  codeTerms: ReadonlyMap<string, readonly string[]>;
  punctuation: ReadonlyMap<string, readonly string[]>;
}> {
  const prose = new Map<string, Set<string>>();
  const code = new Map<string, Set<string>>();
  const punctuation = new Map<string, Set<string>>();

  for (const event of events) {
    /**
     * Probes are drawn from the extracted text, because a probe must be a term a
     * person could have read. Drawing them from the raw payload would invent
     * questions about field names nobody typed.
     */
    const text = event.extracted;
    for (const token of new Set(normalizeTokens(text))) {
      if (token.length < 5) continue;
      const owners = prose.get(token) ?? new Set<string>();
      owners.add(event.id);
      prose.set(token, owners);
    }
    for (const match of text.matchAll(IDENTIFIER_CANDIDATE)) {
      const identifier = match[0];
      if (identifier.length < 5 || !CODE_SHAPED.test(identifier)) continue;
      const owners = code.get(identifier) ?? new Set<string>();
      owners.add(event.id);
      code.set(identifier, owners);
    }
    for (const sequence of PUNCTUATION_SEQUENCES) {
      if (!text.includes(sequence)) continue;
      const owners = punctuation.get(sequence) ?? new Set<string>();
      owners.add(event.id);
      punctuation.set(sequence, owners);
    }
  }

  const freeze = (source: Map<string, Set<string>>) =>
    new Map([...source].map(([term, owners]) => [term, [...owners]] as const));

  return Object.freeze({
    proseTerms: freeze(prose),
    codeTerms: freeze(code),
    punctuation: freeze(punctuation),
  });
}

function uniqueOwners(
  frequencies: ReadonlyMap<string, readonly string[]>,
): readonly Readonly<{ term: string; eventId: string }>[] {
  return Object.freeze(
    [...frequencies]
      .filter(([, owners]) => owners.length === 1)
      .map(([term, owners]) =>
        Object.freeze({ term, eventId: owners[0] ?? "" }),
      )
      .sort((left, right) => left.term.localeCompare(right.term, "en")),
  );
}

/** Italian ending alteration, by rule: singular to plural and back. */
function inflect(term: string): string | null {
  if (term.endsWith("zione")) return `${term.slice(0, -5)}zioni`;
  if (term.endsWith("o")) return `${term.slice(0, -1)}i`;
  if (term.endsWith("a")) return `${term.slice(0, -1)}e`;
  if (term.endsWith("e")) return `${term.slice(0, -1)}i`;
  if (term.endsWith("i")) return `${term.slice(0, -1)}o`;
  return null;
}

function transpose(term: string): string | null {
  const middle = Math.floor(term.length / 2);
  if (term.length < 6) return null;
  const left = term[middle];
  const right = term[middle + 1];
  if (left === undefined || right === undefined || left === right) return null;
  return `${term.slice(0, middle)}${right}${left}${term.slice(middle + 2)}`;
}

/**
 * Probes generated from the corpus by rule. Every probe is a known-item question
 * whose one correct answer is the event it was drawn from. Probe text is derived
 * from private content and is never part of the report.
 */
export function generateProbes(
  events: readonly SourceEvent[],
): readonly Probe[] {
  const frequencies = eventDocumentFrequency(events);
  const uniqueProse = uniqueOwners(frequencies.proseTerms);
  const uniqueCode = uniqueOwners(frequencies.codeTerms);
  const uniquePunctuation = uniqueOwners(frequencies.punctuation);

  const probes: Probe[] = [];
  const take = <T>(items: readonly T[]) =>
    items.slice(0, MAX_PROBES_PER_FAMILY);

  for (const { term, eventId } of take(uniqueProse))
    probes.push(
      Object.freeze({
        family: "UNIQUE_PROSE_TERM" as const,
        text: term,
        expectedEventId: eventId,
        codeShaped: false,
      }),
    );

  for (const { term, eventId } of take(uniqueCode))
    probes.push(
      Object.freeze({
        family: "UNIQUE_IDENTIFIER" as const,
        text: term,
        expectedEventId: eventId,
        codeShaped: true,
      }),
    );

  for (const { term, eventId } of take(uniquePunctuation))
    probes.push(
      Object.freeze({
        family: "UNIQUE_PUNCTUATION" as const,
        text: term,
        expectedEventId: eventId,
        codeShaped: true,
      }),
    );

  for (const { term, eventId } of take(uniqueProse)) {
    const inflected = inflect(term);
    if (inflected === null || inflected === term) continue;
    probes.push(
      Object.freeze({
        family: "INFLECTED_PROSE_TERM" as const,
        text: inflected,
        expectedEventId: eventId,
        codeShaped: false,
      }),
    );
  }

  for (const { term, eventId } of take(uniqueProse)) {
    const transposed = transpose(term);
    if (transposed === null) continue;
    probes.push(
      Object.freeze({
        family: "TRANSPOSED_TERM" as const,
        text: transposed,
        expectedEventId: eventId,
        codeShaped: false,
      }),
    );
  }

  const proseByEvent = new Map<string, string[]>();
  for (const { term, eventId } of uniqueProse) {
    const terms = proseByEvent.get(eventId) ?? [];
    terms.push(term);
    proseByEvent.set(eventId, terms);
  }
  const conjunctions: Probe[] = [];
  for (const [eventId, terms] of [...proseByEvent].sort((left, right) =>
    left[0].localeCompare(right[0], "en"),
  )) {
    if (terms.length < 2) continue;
    conjunctions.push(
      Object.freeze({
        family: "TWO_TERM_CONJUNCTION" as const,
        text: `${terms[0]} ${terms[1]}`,
        expectedEventId: eventId,
        codeShaped: false,
      }),
    );
  }
  probes.push(...take(conjunctions));

  const codeByEvent = new Map<string, string[]>();
  for (const { term, eventId } of uniqueCode) {
    const terms = codeByEvent.get(eventId) ?? [];
    terms.push(term);
    codeByEvent.set(eventId, terms);
  }
  const mixedProbes: Probe[] = [];
  for (const [eventId, identifiers] of [...codeByEvent].sort((left, right) =>
    left[0].localeCompare(right[0], "en"),
  )) {
    const prose = proseByEvent.get(eventId);
    if (prose === undefined || prose.length === 0) continue;
    mixedProbes.push(
      Object.freeze({
        family: "PROSE_AND_CODE_CONJUNCTION" as const,
        text: `${prose[0]} ${identifiers[0]}`,
        expectedEventId: eventId,
        codeShaped: true,
      }),
    );
  }
  probes.push(...take(mixedProbes));

  return Object.freeze(probes);
}

/**
 * The merged token set is obtained by giving a code-mode index the normalized
 * prose form of the text alongside the text itself, so that both token sets live
 * on the same record without reimplementing the index this repository already
 * measures. The query is prepared the same way.
 */
export function mergedBody(text: string): string {
  return `${normalizeTokens(text).map(stem).join(" ")}\n${text}`;
}

export function mergedQuery(text: string): string {
  return `${contentTerms(text).map(stem).join(" ")} ${text}`;
}

type BuiltIndex = Readonly<{
  distinctTerms: number;
  buildMilliseconds: number;
  run: (probe: Probe) => readonly Readonly<{ path: string; bytes: number }>[];
}>;

function buildIndexFor(
  records: readonly CodeRecord[],
  tokenization: Tokenization,
): BuiltIndex {
  const sizeOf = new Map(
    records.map((record) => [
      record.id,
      Buffer.byteLength(record.body, "utf8"),
    ]),
  );
  const asResults = (
    results: readonly Readonly<{ id: string; path: string }>[],
  ) =>
    Object.freeze(
      results.map((result) =>
        Object.freeze({
          path: result.path,
          bytes: sizeOf.get(result.id) ?? 0,
        }),
      ),
    );

  const started = performance.now();

  if (tokenization === "BOTH_SETS_MERGED") {
    const merged = records.map((record) =>
      Object.freeze({ ...record, body: mergedBody(record.body) }),
    );
    const index = buildCodeIndex(merged, "CODE");
    const build = performance.now() - started;
    return Object.freeze({
      distinctTerms: index.terms.length,
      buildMilliseconds: build,
      run: (probe) =>
        asResults(
          searchCode(index, mergedQuery(probe.text), RESULT_LIMIT, true),
        ),
    });
  }

  if (tokenization === "MODE_PER_QUERY") {
    const prose = buildCodeIndex(records, "PROSE");
    const code = buildCodeIndex(records, "CODE");
    const build = performance.now() - started;
    return Object.freeze({
      distinctTerms: new Set([...prose.terms, ...code.terms]).size,
      buildMilliseconds: build,
      run: (probe) =>
        asResults(
          searchCode(
            probe.codeShaped ? code : prose,
            probe.text,
            RESULT_LIMIT,
            !probe.codeShaped,
          ),
        ),
    });
  }

  const mode = tokenization === "CODE_ONLY" ? "CODE" : "PROSE";
  const index = buildCodeIndex(records, mode);
  const build = performance.now() - started;
  return Object.freeze({
    distinctTerms: index.terms.length,
    buildMilliseconds: build,
    run: (probe) =>
      asResults(searchCode(index, probe.text, RESULT_LIMIT, mode === "PROSE")),
  });
}

function measureCell(
  events: readonly SourceEvent[],
  probes: readonly Probe[],
  shape: RecordShape,
  unit: RecordUnit,
  tokenization: Tokenization,
): CellMeasurement {
  const records = buildUnitRecords(events, unit, shape);
  const index = buildIndexFor(records, tokenization);

  const timings: number[] = [];
  const bytesToRead: number[] = [];
  let firstCorrect = 0;
  let anyCorrect = 0;
  let unreachable = 0;
  const perFamily = new Map<
    ProbeFamily,
    { probes: number; first: number; any: number; unreachable: number }
  >();

  for (const probe of probes) {
    const started = performance.now();
    const results = index.run(probe);
    timings.push(performance.now() - started);

    const family = perFamily.get(probe.family) ?? {
      probes: 0,
      first: 0,
      any: 0,
      unreachable: 0,
    };
    family.probes += 1;

    if (results.length === 0) {
      unreachable += 1;
      family.unreachable += 1;
      perFamily.set(probe.family, family);
      continue;
    }

    const top = results[0];
    if (top !== undefined && top.path === probe.expectedEventId) {
      firstCorrect += 1;
      family.first += 1;
      bytesToRead.push(top.bytes);
    }
    if (results.some((result) => result.path === probe.expectedEventId)) {
      anyCorrect += 1;
      family.any += 1;
    }
    perFamily.set(probe.family, family);
  }

  const families = PROBE_FAMILIES.filter((family) => perFamily.has(family)).map(
    (family) => {
      const scores = perFamily.get(family);
      return Object.freeze({
        family,
        probes: scores?.probes ?? 0,
        precisionAtOnePercent: percent(scores?.first ?? 0, scores?.probes ?? 0),
        recallAtTenPercent: percent(scores?.any ?? 0, scores?.probes ?? 0),
        unreachableProbes: scores?.unreachable ?? 0,
      });
    },
  );

  const queryP95 = quantile(timings, 0.95);

  return Object.freeze({
    shape,
    unit,
    tokenization,
    records: records.length,
    distinctTerms: index.distinctTerms,
    probes: probes.length,
    precisionAtOnePercent: percent(firstCorrect, probes.length),
    recallAtTenPercent: percent(anyCorrect, probes.length),
    unreachableProbes: unreachable,
    bytesToReadMedian: quantile(bytesToRead, 0.5),
    bytesToReadP95: quantile(bytesToRead, 0.95),
    families: Object.freeze(families),
    buildMilliseconds: milliseconds(index.buildMilliseconds),
    queryP95Milliseconds: queryP95,
    withinBudget: queryP95 <= INTERACTIVE_BUDGET_MILLISECONDS,
  });
}

export async function measureRealEventRetrieval(
  homeOverride?: string,
): Promise<RealEventRetrievalReport> {
  const home = resolveWorkspaceHome(homeOverride);
  const read = await readCanonicalEvents(home);
  const print = fingerprint(read.projects, read.sessionDocuments, read.events);
  const probes = generateProbes(read.events);

  /**
   * Block count is read from the extracted shape. The raw payload is serialized
   * JSON and has no blank lines by construction, so measuring the corpus size
   * against it would report every home as too small whatever it contains.
   */
  const tooSmall =
    print.canonicalEvents < MINIMUM_EVENTS ||
    shapeOf(print, "EXTRACTED_TEXT").multiBlockEvents <
      MINIMUM_MULTI_BLOCK_EVENTS;
  const indicativeOnly = print.canonicalEvents < INDICATIVE_EVENTS;

  const cells = tooSmall
    ? Object.freeze([])
    : Object.freeze(
        RECORD_SHAPES.flatMap((shape) =>
          RECORD_UNITS.flatMap((unit) =>
            TOKENIZATIONS.map((tokenization) =>
              measureCell(read.events, probes, shape, unit, tokenization),
            ),
          ),
        ),
      );

  const probesByFamily = Object.fromEntries(
    PROBE_FAMILIES.map((family) => [
      family,
      probes.filter((probe) => probe.family === family).length,
    ]),
  ) as Record<ProbeFamily, number>;

  return Object.freeze({
    schemaVersion: SCHEMA_VERSION,
    corpusId: REAL_EVENT_CORPUS_ID,
    declaredConsumer: "DEVELOPMENT_ONLY_NO_PRODUCTION_CONSUMER" as const,
    homeReadable: read.readable,
    fingerprint: print,
    probesByFamily: Object.freeze(probesByFamily),
    bounds: Object.freeze({
      minimumEvents: MINIMUM_EVENTS,
      minimumMultiBlockEvents: MINIMUM_MULTI_BLOCK_EVENTS,
      indicativeEvents: INDICATIVE_EVENTS,
      eventByteThreshold: EVENT_BYTE_THRESHOLD,
      maxProbesPerFamily: MAX_PROBES_PER_FAMILY,
      resultLimit: RESULT_LIMIT,
      interactiveBudgetMilliseconds: INTERACTIVE_BUDGET_MILLISECONDS,
      bytesToReadGainPercent: BYTES_TO_READ_GAIN_PERCENT,
      vocabularyInflationPercent: VOCABULARY_INFLATION_PERCENT,
    }),
    cells,
    shape: decideShape(cells, print, tooSmall, indicativeOnly),
    unit: decideUnit(cells, tooSmall, indicativeOnly),
    tokenization: decideTokenization(
      cells,
      probesByFamily,
      tooSmall,
      indicativeOnly,
    ),
  });
}

function shapeOf(
  print: CorpusFingerprint,
  shape: RecordShape,
): ShapeFingerprint {
  const found = print.shapes.find((entry) => entry.shape === shape);
  if (found !== undefined) return found;
  return Object.freeze({
    shape,
    multiBlockEvents: 0,
    eventsAboveByteThreshold: 0,
    blocks: 0,
    bytesTotal: 0,
    bytesMedian: 0,
    bytesP95: 0,
    bytesMax: 0,
    distinctProseTerms: 0,
    distinctCodeTerms: 0,
  });
}

function cellFor(
  cells: readonly CellMeasurement[],
  shape: RecordShape,
  unit: RecordUnit,
  tokenization: Tokenization,
): CellMeasurement | undefined {
  return cells.find(
    (cell) =>
      cell.shape === shape &&
      cell.unit === unit &&
      cell.tokenization === tokenization,
  );
}

/**
 * Whether the payload has to be reduced to its content before it is indexed. The
 * fingerprint-derived figures are reported whatever the corpus size, because they
 * describe the stored shape rather than a retrieval score; only the verdict waits
 * for a corpus large enough to carry one.
 */
function decideShape(
  cells: readonly CellMeasurement[],
  print: CorpusFingerprint,
  tooSmall: boolean,
  indicativeOnly: boolean,
): RealEventRetrievalReport["shape"] {
  const raw = shapeOf(print, "RAW_PAYLOAD");
  const extracted = shapeOf(print, "EXTRACTED_TEXT");

  const rawVocabulary = raw.distinctProseTerms + raw.distinctCodeTerms;
  const extractedVocabulary =
    extracted.distinctProseTerms + extracted.distinctCodeTerms;
  const vocabularyInflation =
    extractedVocabulary === 0
      ? 0
      : round(
          ((rawVocabulary - extractedVocabulary) / extractedVocabulary) * 100,
        );
  const bytesInflation =
    extracted.bytesTotal === 0
      ? 0
      : round(
          ((raw.bytesTotal - extracted.bytesTotal) / extracted.bytesTotal) *
            100,
        );

  const rawCell = cellFor(cells, "RAW_PAYLOAD", "EVENT", "MODE_PER_QUERY");
  const extractedCell = cellFor(
    cells,
    "EXTRACTED_TEXT",
    "EVENT",
    "MODE_PER_QUERY",
  );
  const precisionLoss =
    rawCell === undefined || extractedCell === undefined
      ? 0
      : round(
          extractedCell.precisionAtOnePercent - rawCell.precisionAtOnePercent,
        );

  const structureLost = raw.multiBlockEvents < extracted.multiBlockEvents;
  const verdict: ShapeVerdict = tooSmall
    ? "UNDECIDED_CORPUS_TOO_SMALL"
    : structureLost ||
        precisionLoss > 0 ||
        vocabularyInflation >= VOCABULARY_INFLATION_PERCENT
      ? "TEXT_EXTRACTION_REQUIRED_BEFORE_INDEXING"
      : "RAW_PAYLOAD_INDEXABLE_AS_IS";

  return Object.freeze({
    verdict,
    indicativeOnly,
    payloadsParsedAsJsonPercent: percent(
      print.eventsParsedAsJson,
      print.canonicalEvents,
    ),
    provenanceFieldsObserved: print.provenanceFieldsObserved,
    multiBlockEventsRaw: raw.multiBlockEvents,
    multiBlockEventsExtracted: extracted.multiBlockEvents,
    vocabularyInflationPercent: vocabularyInflation,
    bytesInflationPercent: bytesInflation,
    precisionAtOneLossPercentagePoints: precisionLoss,
  });
}

function decideUnit(
  cells: readonly CellMeasurement[],
  tooSmall: boolean,
  indicativeOnly: boolean,
): RealEventRetrievalReport["unit"] {
  const empty = Object.freeze({
    verdict: "UNDECIDED_CORPUS_TOO_SMALL" as const,
    indicativeOnly,
    precisionAtOneGainPercentagePoints: 0,
    bytesToReadReductionPercent: 0,
    recallLostPercentagePoints: 0,
    gainConfinedToLargeEvents: false,
  });
  if (tooSmall) return empty;

  /**
   * The units are compared under the tokenization ADR-0031 accepted, and over
   * the extracted shape: comparing units over serialized JSON would compare a
   * whole event against itself, since that shape has no blocks to split on.
   */
  const event = cellFor(cells, "EXTRACTED_TEXT", "EVENT", "MODE_PER_QUERY");
  const block = cellFor(cells, "EXTRACTED_TEXT", "BLOCK", "MODE_PER_QUERY");
  const threshold = cellFor(
    cells,
    "EXTRACTED_TEXT",
    "EVENT_ABOVE_THRESHOLD",
    "MODE_PER_QUERY",
  );
  if (event === undefined || block === undefined || threshold === undefined)
    return empty;

  const precisionGain = round(
    block.precisionAtOnePercent - event.precisionAtOnePercent,
  );
  const recallLost = round(block.recallAtTenPercent - event.recallAtTenPercent);
  const reduction =
    event.bytesToReadMedian === 0
      ? 0
      : round(
          ((event.bytesToReadMedian - block.bytesToReadMedian) /
            event.bytesToReadMedian) *
            100,
        );
  const thresholdReduction =
    event.bytesToReadMedian === 0
      ? 0
      : round(
          ((event.bytesToReadMedian - threshold.bytesToReadMedian) /
            event.bytesToReadMedian) *
            100,
        );
  const confined =
    thresholdReduction >= BYTES_TO_READ_GAIN_PERCENT &&
    threshold.precisionAtOnePercent >= block.precisionAtOnePercent;

  const worthwhile =
    (precisionGain > 0 || reduction >= BYTES_TO_READ_GAIN_PERCENT) &&
    recallLost >= 0;

  const verdict: UnitVerdict = !worthwhile
    ? "EVENT_UNIT_SUFFICIENT"
    : confined
      ? "EVENT_UNIT_WITH_THRESHOLD"
      : "BLOCK_UNIT_REQUIRED";

  return Object.freeze({
    verdict,
    indicativeOnly,
    precisionAtOneGainPercentagePoints: precisionGain,
    bytesToReadReductionPercent: reduction,
    recallLostPercentagePoints: recallLost,
    gainConfinedToLargeEvents: confined,
  });
}

function familiesReached(cell: CellMeasurement | undefined): number {
  return (
    cell?.families.filter((family) => family.recallAtTenPercent > 0).length ?? 0
  );
}

function decideTokenization(
  cells: readonly CellMeasurement[],
  probesByFamily: Readonly<Record<ProbeFamily, number>>,
  tooSmall: boolean,
  indicativeOnly: boolean,
): RealEventRetrievalReport["tokenization"] {
  const mixedProbes = probesByFamily["PROSE_AND_CODE_CONJUNCTION"];
  const empty = Object.freeze({
    verdict: "UNDECIDED_CORPUS_TOO_SMALL" as const,
    indicativeOnly,
    familiesReachedByProseOnly: 0,
    familiesReachedByCodeOnly: 0,
    familiesReachedByModePerQuery: 0,
    familiesReachedByBothSetsMerged: 0,
    mixedFamilyProbes: mixedProbes,
    mixedFamilyReachableUnderModePerQuery: false,
  });
  if (tooSmall) return empty;

  /** Tokenizations are compared on the unit an engine would build first. */
  const prose = cellFor(cells, "EXTRACTED_TEXT", "EVENT", "PROSE_ONLY");
  const code = cellFor(cells, "EXTRACTED_TEXT", "EVENT", "CODE_ONLY");
  const perQuery = cellFor(cells, "EXTRACTED_TEXT", "EVENT", "MODE_PER_QUERY");
  const merged = cellFor(cells, "EXTRACTED_TEXT", "EVENT", "BOTH_SETS_MERGED");
  if (
    prose === undefined ||
    code === undefined ||
    perQuery === undefined ||
    merged === undefined
  )
    return empty;

  const byProse = familiesReached(prose);
  const byCode = familiesReached(code);
  const byPerQuery = familiesReached(perQuery);
  const byMerged = familiesReached(merged);

  const mixedReachable =
    (perQuery.families.find(
      (family) => family.family === "PROSE_AND_CODE_CONJUNCTION",
    )?.recallAtTenPercent ?? 0) > 0;

  const eachModeMissesWhatTheOtherReaches =
    byProse < byMerged && byCode < byMerged;

  const verdict: TokenizationVerdict =
    byCode <= byProse && byMerged <= byProse
      ? "PROSE_ONLY_SUFFICIENT"
      : eachModeMissesWhatTheOtherReaches && mixedProbes > 0 && !mixedReachable
        ? "BOTH_TOKEN_SETS_REQUIRED_PER_RECORD"
        : byPerQuery >= byMerged
          ? "MODE_SELECTION_SUFFICIENT"
          : "BOTH_TOKEN_SETS_REQUIRED_PER_RECORD";

  return Object.freeze({
    verdict,
    indicativeOnly,
    familiesReachedByProseOnly: byProse,
    familiesReachedByCodeOnly: byCode,
    familiesReachedByModePerQuery: byPerQuery,
    familiesReachedByBothSetsMerged: byMerged,
    mixedFamilyProbes: mixedProbes,
    mixedFamilyReachableUnderModePerQuery: mixedReachable,
  });
}

/**
 * The report without machine-dependent readings, for a determinism assertion
 * that does not fail because a second run was faster.
 */
export function withoutElapsed(report: RealEventRetrievalReport) {
  return Object.freeze({
    schemaVersion: report.schemaVersion,
    corpusId: report.corpusId,
    homeReadable: report.homeReadable,
    fingerprint: report.fingerprint,
    probesByFamily: report.probesByFamily,
    cells: Object.freeze(
      report.cells.map((cell) =>
        Object.freeze({
          shape: cell.shape,
          unit: cell.unit,
          tokenization: cell.tokenization,
          records: cell.records,
          distinctTerms: cell.distinctTerms,
          precisionAtOnePercent: cell.precisionAtOnePercent,
          recallAtTenPercent: cell.recallAtTenPercent,
          unreachableProbes: cell.unreachableProbes,
          bytesToReadMedian: cell.bytesToReadMedian,
          families: cell.families,
        }),
      ),
    ),
    shapeVerdict: report.shape.verdict,
    unitVerdict: report.unit.verdict,
    tokenizationVerdict: report.tokenization.verdict,
  });
}

/** A stable identity for a corpus that must not be printed. */
export function fingerprintDigest(print: CorpusFingerprint): string {
  return createHash("sha256")
    .update(JSON.stringify(print), "utf8")
    .digest("hex")
    .slice(0, 8);
}

function quantile(values: readonly number[], fraction: number): number {
  if (values.length === 0) return 0;
  const ordered = [...values].sort((left, right) => left - right);
  const position = Math.max(0, Math.ceil(ordered.length * fraction) - 1);
  return milliseconds(ordered[position] ?? 0);
}

function percent(value: number, total: number): number {
  return total === 0 ? 0 : round((value / total) * 100);
}

function round(value: number): number {
  return Number(value.toFixed(2));
}

function milliseconds(value: number): number {
  return Number(value.toFixed(3));
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const report = await measureRealEventRetrieval(process.argv[2]);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
