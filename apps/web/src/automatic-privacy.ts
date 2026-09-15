import { createHash } from "node:crypto";

import { AppManagedKeyCustody } from "@ai-workspace/local-key-custody";
import {
  EncryptedStablePrivacyMappingStore,
  StablePrivacyMappingStoreError,
} from "@ai-workspace/local-privacy-mapping";
import {
  BuiltInPiiDetector,
  PII_ENTITY_TYPES,
  protectWithStablePseudonyms,
  restoreStablePseudonyms,
  type PiiDetector,
  type PiiEntityType,
  type PiiSpan,
  type StablePseudonymMap,
} from "@ai-workspace/privacy-gateway";

export type ProtectedConversationContext = Readonly<{
  text: string;
  mapping: StablePseudonymMap;
  mappingDigest: string;
  replacements: number;
}>;

export type ProtectedTerm = Readonly<{
  pseudonym: string;
  added: boolean;
  terms: number;
}>;

/** One character would replace every occurrence of a letter in the context. */
const MIN_TERM_CHARACTERS = 2;
const MAX_TERM_BYTES = 256;

export class AutomaticPrivacyProtection {
  readonly #home: string;
  readonly #detector: PiiDetector;

  public constructor(
    home: string,
    detector: PiiDetector = new BuiltInPiiDetector(),
  ) {
    this.#home = home;
    this.#detector = detector;
  }

  public async protect(
    scopeId: string,
    text: string,
  ): Promise<ProtectedConversationContext> {
    const key = await new AppManagedKeyCustody(this.#home).getOrCreate(scopeId);
    try {
      const store = new EncryptedStablePrivacyMappingStore(this.#home, key);
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const current = await store.load(scopeId);
        const detected = await this.#detector.detect(text);
        const spans = mergeSpans(knownSpans(text, current), detected);
        const protectedValue = protectWithStablePseudonyms({
          text,
          spans,
          mapping: current,
        });
        let mapping = protectedValue.mapping;
        if (mapping.revision !== current.revision) {
          try {
            mapping = await store.replace(current.revision, mapping);
          } catch (error) {
            if (error instanceof StablePrivacyMappingStoreError && attempt < 2)
              continue;
            throw error;
          }
        }
        return Object.freeze({
          text: protectedValue.text,
          mapping,
          mappingDigest: sha256(JSON.stringify(mapping)),
          replacements: protectedValue.replacements,
        });
      }
      throw new Error("AUTOMATIC_PRIVACY_CONFLICT");
    } finally {
      key.fill(0);
    }
  }

  /**
   * The stable map receives values from detection or legacy migration only, and
   * the built-in detector has no recall for names, companies or addresses. A
   * reviewed term is therefore the remaining way to protect one of those before
   * it leaves, and it must survive restarts and model changes like any other
   * entry. Adding the same value twice returns the existing placeholder instead
   * of allocating a second one.
   */
  public async addTerm(
    scopeId: string,
    term: string,
    type: PiiEntityType,
  ): Promise<ProtectedTerm> {
    if (typeof term !== "string" || !term.isWellFormed())
      throw new Error("PROTECTED_TERM_INVALID");
    const value = term.trim();
    if (
      value.length < MIN_TERM_CHARACTERS ||
      Buffer.byteLength(value, "utf8") > MAX_TERM_BYTES ||
      /\p{Cc}/u.test(value) ||
      value.includes("[[") ||
      value.includes("]]") ||
      !PII_ENTITY_TYPES.includes(type)
    )
      throw new Error("PROTECTED_TERM_INVALID");
    const key = await new AppManagedKeyCustody(this.#home).getOrCreate(scopeId);
    try {
      const store = new EncryptedStablePrivacyMappingStore(this.#home, key);
      const originalBase64 = Buffer.from(value, "utf8").toString("base64");
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const current = await store.load(scopeId);
        const existing = current.entries.find(
          (entry) => entry.originalBase64 === originalBase64,
        );
        if (existing) {
          if (existing.type !== type)
            throw new Error("PROTECTED_TERM_TYPE_CONFLICT");
          return Object.freeze({
            pseudonym: existing.pseudonym,
            added: false as const,
            terms: current.entries.length,
          });
        }
        const protectedValue = protectWithStablePseudonyms({
          text: value,
          spans: [
            Object.freeze({
              startUtf8: 0,
              endUtf8: Buffer.byteLength(value, "utf8"),
              type,
              confidence: 1,
              detector: "USER_REVIEWED_TERM_V1",
            }),
          ],
          mapping: current,
        });
        try {
          const mapping = await store.replace(
            current.revision,
            protectedValue.mapping,
          );
          return Object.freeze({
            pseudonym: protectedValue.text,
            added: true as const,
            terms: mapping.entries.length,
          });
        } catch (error) {
          if (error instanceof StablePrivacyMappingStoreError && attempt < 2)
            continue;
          throw error;
        }
      }
      throw new Error("AUTOMATIC_PRIVACY_CONFLICT");
    } finally {
      key.fill(0);
    }
  }

  public restore(mapping: StablePseudonymMap, output: string): string {
    return restoreStablePseudonyms(output, mapping);
  }
}

function knownSpans(
  text: string,
  mapping: StablePseudonymMap,
): readonly PiiSpan[] {
  const candidates: PiiSpan[] = [];
  for (const entry of mapping.entries) {
    const original = Buffer.from(entry.originalBase64, "base64").toString(
      "utf8",
    );
    let from = 0;
    while (from <= text.length) {
      const index = text.indexOf(original, from);
      if (index < 0) break;
      candidates.push(
        Object.freeze({
          startUtf8: Buffer.byteLength(text.slice(0, index), "utf8"),
          endUtf8: Buffer.byteLength(
            text.slice(0, index + original.length),
            "utf8",
          ),
          type: entry.type,
          confidence: 1,
          detector: "STABLE_MAP_V1",
        }),
      );
      from = index + original.length;
    }
  }
  return candidates;
}

function mergeSpans(known: readonly PiiSpan[], detected: readonly PiiSpan[]) {
  const candidates = [...known, ...detected].sort(
    (left, right) =>
      left.startUtf8 - right.startUtf8 ||
      right.endUtf8 - left.endUtf8 ||
      right.confidence - left.confidence,
  );
  const result: PiiSpan[] = [];
  for (const candidate of candidates) {
    const previous = result.at(-1);
    if (previous && candidate.startUtf8 < previous.endUtf8) {
      if (
        candidate.startUtf8 === previous.startUtf8 &&
        candidate.endUtf8 === previous.endUtf8 &&
        candidate.type === previous.type
      )
        continue;
      if (previous.detector === "STABLE_MAP_V1") continue;
      throw new Error("PII_DETECTION_OVERLAP");
    }
    result.push(candidate);
  }
  return Object.freeze(result);
}

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
