import { Buffer } from "node:buffer";

import {
  PII_ENTITY_TYPES,
  type PiiEntityType,
  type PiiSpan,
} from "./pii-detector.ts";

export type StablePseudonymEntry = Readonly<{
  type: PiiEntityType;
  pseudonym: string;
  originalBase64: string;
}>;

export type StablePseudonymMap = Readonly<{
  schemaVersion: 1;
  scopeId: string;
  revision: number;
  entries: readonly StablePseudonymEntry[];
}>;

export type StablePseudonymizationResult = Readonly<{
  text: string;
  mapping: StablePseudonymMap;
  replacements: number;
}>;

const MAX_TEXT_BYTES = 1024 * 1024;
const MAX_ENTRIES = 10_000;
const BASE64 =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;
const LABELS: Readonly<Record<PiiEntityType, string>> = Object.freeze({
  PERSON: "PERSONA",
  ORGANIZATION: "AZIENDA",
  CUSTOMER: "CLIENTE",
  PROJECT: "PROGETTO",
  EMAIL: "EMAIL",
  PHONE: "TELEFONO",
  TAX_ID: "CODICE_FISCALE",
  VAT_ID: "PARTITA_IVA",
  IBAN: "IBAN",
  ADDRESS: "INDIRIZZO",
  DATE: "DATA",
  PATH: "PERCORSO",
  URL: "URL",
  BUSINESS_IDENTIFIER: "IDENTIFICATIVO",
  OTHER: "VALORE",
});
const TOKEN =
  /^\[\[(?:PERSONA|AZIENDA|CLIENTE|PROGETTO|EMAIL|TELEFONO|CODICE_FISCALE|PARTITA_IVA|IBAN|INDIRIZZO|DATA|PERCORSO|URL|IDENTIFICATIVO|VALORE)_[1-9]\d*\]\]$/u;
const TOKEN_CANDIDATE =
  /\[\[(?:PERSONA|AZIENDA|CLIENTE|PROGETTO|EMAIL|TELEFONO|CODICE_FISCALE|PARTITA_IVA|IBAN|INDIRIZZO|DATA|PERCORSO|URL|IDENTIFICATIVO|VALORE)_[^\]]+\]\]/gu;

export class StablePseudonymizationError extends Error {
  public constructor() {
    super(
      "Stable pseudonym state, detected spans, or provider placeholders are invalid, conflicting, oversized, or cross-scoped.",
    );
    this.name = "StablePseudonymizationError";
  }
}

export function emptyStablePseudonymMap(scopeId: string): StablePseudonymMap {
  return validateStablePseudonymMap({
    schemaVersion: 1,
    scopeId,
    revision: 0,
    entries: [],
  });
}

export function validateStablePseudonymMap(value: unknown): StablePseudonymMap {
  try {
    if (
      !record(value) ||
      !exactKeys(value, ["entries", "revision", "schemaVersion", "scopeId"]) ||
      value.schemaVersion !== 1 ||
      !validText(value.scopeId) ||
      !Number.isSafeInteger(value.revision) ||
      Number(value.revision) < 0 ||
      !Array.isArray(value.entries) ||
      value.entries.length > MAX_ENTRIES
    )
      throw invalid();
    const entries = value.entries.map((candidate) => {
      if (
        !record(candidate) ||
        !exactKeys(candidate, ["originalBase64", "pseudonym", "type"]) ||
        !PII_ENTITY_TYPES.includes(candidate.type as PiiEntityType) ||
        typeof candidate.pseudonym !== "string" ||
        !TOKEN.test(candidate.pseudonym) ||
        typeof candidate.originalBase64 !== "string" ||
        !BASE64.test(candidate.originalBase64)
      )
        throw invalid();
      const original = Buffer.from(candidate.originalBase64, "base64");
      if (
        original.length < 1 ||
        original.length > MAX_TEXT_BYTES ||
        original.toString("base64") !== candidate.originalBase64 ||
        !original.toString("utf8").isWellFormed() ||
        candidate.pseudonym !==
          expectedPrefix(candidate.type as PiiEntityType, candidate.pseudonym)
      )
        throw invalid();
      return Object.freeze({
        type: candidate.type as PiiEntityType,
        pseudonym: candidate.pseudonym,
        originalBase64: candidate.originalBase64,
      });
    });
    if (
      new Set(entries.map((entry) => entry.pseudonym)).size !==
        entries.length ||
      new Set(entries.map((entry) => entry.originalBase64)).size !==
        entries.length
    )
      throw invalid();
    return Object.freeze({
      schemaVersion: 1 as const,
      scopeId: value.scopeId,
      revision: Number(value.revision),
      entries: Object.freeze(entries),
    });
  } catch (error) {
    if (error instanceof StablePseudonymizationError) throw error;
    throw invalid();
  }
}

export function protectWithStablePseudonyms(
  input: Readonly<{
    text: string;
    spans: readonly PiiSpan[];
    mapping: StablePseudonymMap;
  }>,
): StablePseudonymizationResult {
  try {
    const mapping = validateStablePseudonymMap(input.mapping);
    const bytes = validBytes(input.text);
    const spans = validateSpans(input.spans, bytes);
    const entries = [...mapping.entries];
    const replacements: Readonly<{
      start: number;
      end: number;
      pseudonym: string;
    }>[] = spans.map((span) => {
      const original = bytes.subarray(span.startUtf8, span.endUtf8);
      const originalBase64 = original.toString("base64");
      const existing = entries.find(
        (entry) => entry.originalBase64 === originalBase64,
      );
      if (existing && existing.type !== span.type) throw invalid();
      const pseudonym =
        existing?.pseudonym ?? nextPseudonym(entries, span.type);
      if (!existing) {
        if (entries.length >= MAX_ENTRIES) throw invalid();
        entries.push(
          Object.freeze({ type: span.type, pseudonym, originalBase64 }),
        );
      }
      return Object.freeze({
        start: span.startUtf8,
        end: span.endUtf8,
        pseudonym,
      });
    });
    const chunks: Buffer[] = [];
    let cursor = 0;
    for (const replacement of replacements) {
      chunks.push(bytes.subarray(cursor, replacement.start));
      chunks.push(Buffer.from(replacement.pseudonym, "utf8"));
      cursor = replacement.end;
    }
    chunks.push(bytes.subarray(cursor));
    const changed = entries.length !== mapping.entries.length;
    const next = validateStablePseudonymMap({
      ...mapping,
      revision: changed ? mapping.revision + 1 : mapping.revision,
      entries,
    });
    return Object.freeze({
      text: Buffer.concat(chunks).toString("utf8"),
      mapping: next,
      replacements: replacements.length,
    });
  } catch (error) {
    if (error instanceof StablePseudonymizationError) throw error;
    throw invalid();
  }
}

export function restoreStablePseudonyms(
  output: string,
  mappingValue: StablePseudonymMap,
): string {
  try {
    validBytes(output);
    const mapping = validateStablePseudonymMap(mappingValue);
    const byToken = new Map(
      mapping.entries.map((entry) => [
        entry.pseudonym,
        Buffer.from(entry.originalBase64, "base64").toString("utf8"),
      ]),
    );
    for (const candidate of output.matchAll(TOKEN_CANDIDATE))
      if (!byToken.has(candidate[0])) throw invalid();
    return output.replace(TOKEN_CANDIDATE, (candidate) => {
      const original = byToken.get(candidate);
      if (original === undefined) throw invalid();
      return original;
    });
  } catch (error) {
    if (error instanceof StablePseudonymizationError) throw error;
    throw invalid();
  }
}

function validateSpans(spansValue: unknown, bytes: Buffer): readonly PiiSpan[] {
  if (!Array.isArray(spansValue) || spansValue.length > 10_000) throw invalid();
  const result = spansValue.map((span): PiiSpan => {
    if (
      !record(span) ||
      typeof span.startUtf8 !== "number" ||
      typeof span.endUtf8 !== "number" ||
      !Number.isSafeInteger(span.startUtf8) ||
      !Number.isSafeInteger(span.endUtf8) ||
      span.startUtf8 < 0 ||
      span.endUtf8 <= span.startUtf8 ||
      span.endUtf8 > bytes.length ||
      !PII_ENTITY_TYPES.includes(span.type as PiiEntityType) ||
      typeof span.confidence !== "number" ||
      span.confidence < 0 ||
      span.confidence > 1 ||
      !validText(span.detector)
    )
      throw invalid();
    const original = bytes.subarray(span.startUtf8, span.endUtf8);
    if (!original.toString("utf8").isWellFormed()) throw invalid();
    return Object.freeze({
      startUtf8: span.startUtf8,
      endUtf8: span.endUtf8,
      type: span.type as PiiEntityType,
      confidence: span.confidence,
      detector: span.detector,
    });
  });
  result.sort((left, right) => left.startUtf8 - right.startUtf8);
  for (let index = 1; index < result.length; index += 1)
    if (result[index]!.startUtf8 < result[index - 1]!.endUtf8) throw invalid();
  return Object.freeze(result);
}

function nextPseudonym(
  entries: readonly StablePseudonymEntry[],
  type: PiiEntityType,
) {
  const prefix = LABELS[type];
  const used = entries
    .filter((entry) => entry.type === type)
    .map((entry) => Number(entry.pseudonym.slice(prefix.length + 2, -2)))
    .filter(Number.isSafeInteger);
  return `[[${prefix}_${Math.max(0, ...used) + 1}]]`;
}

function expectedPrefix(type: PiiEntityType, pseudonym: string) {
  return pseudonym.startsWith(`[[${LABELS[type]}_`) ? pseudonym : "";
}

function validBytes(text: string) {
  if (
    typeof text !== "string" ||
    !text.isWellFormed() ||
    Buffer.byteLength(text, "utf8") > MAX_TEXT_BYTES
  )
    throw invalid();
  return Buffer.from(text, "utf8");
}

function validText(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 256 &&
    !/\p{Cc}/u.test(value)
  );
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}

function invalid() {
  return new StablePseudonymizationError();
}
