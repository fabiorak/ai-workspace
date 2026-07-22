import { createHash } from "node:crypto";
import {
  validatePseudonymMapping,
  validatePseudonymMappingV2,
  type OutputRestorationCorpusCase,
  type OutputRestorationScope,
  type PseudonymMapping,
  type PseudonymMappingV2,
} from "../src/index.ts";

export const V1_CUSTOMER = "[[AW_CUSTOMER_1111111111111111]]";
export const V1_PERSON = "[[AW_PERSON_2222222222222222]]";
export const V2_PROJECT = "[[AW_PROJECT_3333333333333333]]";
export const V2_CUSTOMER = "[[AW_CUSTOMER_4444444444444444]]";
export const UNKNOWN = "[[AW_CUSTOMER_FFFFFFFFFFFFFFFF]]";

const commonScope = Object.freeze({
  projectId: "synthetic-project",
  workItemId: "synthetic-work",
  handoffId: "synthetic-handoff",
  modelId: "synthetic-model",
});

export const V1_SCOPE: OutputRestorationScope = Object.freeze({
  ...commonScope,
  mappingSetId: "synthetic-output-v1",
});
export const V2_SCOPE: OutputRestorationScope = Object.freeze({
  ...commonScope,
  mappingSetId: "synthetic-output-v2",
});

export const V1_MAPPING: PseudonymMapping = validatePseudonymMapping({
  schemaVersion: 1,
  ...V1_SCOPE,
  entries: [
    entry("item-v1", "Customer Cedar", V1_CUSTOMER, "CUSTOMER", 0),
    entry("item-v1", "Person Violet", V1_PERSON, "PERSON", 100),
  ],
});

export const V2_MAPPING: PseudonymMappingV2 = validatePseudonymMappingV2({
  schemaVersion: 2,
  ...V2_SCOPE,
  entries: [
    entry("item-v2", "Project Aurora", V2_PROJECT, "PROJECT", 0),
    entry("item-v2", "Customer Indigo", V2_CUSTOMER, "CUSTOMER", 100),
  ],
});

export function frozenOutputRestorationCorpus(): readonly OutputRestorationCorpusCase[] {
  return Object.freeze([
    valid(
      "01-v1-english",
      V1_MAPPING,
      V1_SCOPE,
      `Review ${V1_CUSTOMER}.`,
      "Review Customer Cedar.",
    ),
    valid(
      "02-v1-repeat-reorder",
      V1_MAPPING,
      V1_SCOPE,
      `${V1_PERSON}; ${V1_CUSTOMER}; ${V1_PERSON}`,
      "Person Violet; Customer Cedar; Person Violet",
    ),
    valid(
      "03-v2-unicode",
      V2_MAPPING,
      V2_SCOPE,
      `È pronto ${V2_PROJECT}, poi ${V2_CUSTOMER}.`,
      "È pronto Project Aurora, poi Customer Indigo.",
    ),
    expected(
      "04-no-token",
      V1_MAPPING,
      V1_SCOPE,
      "Synthetic output without placeholders.",
      "NO_PSEUDONYMS",
      null,
    ),
    blocked("05-unknown", V1_MAPPING, V1_SCOPE, `Review ${UNKNOWN}.`),
    blocked("06-cross-mapping", V1_MAPPING, V1_SCOPE, `Review ${V2_PROJECT}.`),
    blocked(
      "07-truncated",
      V1_MAPPING,
      V1_SCOPE,
      "Review [[AW_CUSTOMER_1111111111111111].",
    ),
    blocked(
      "08-case-altered",
      V1_MAPPING,
      V1_SCOPE,
      "Review [[aw_customer_1111111111111111]].",
    ),
    blocked(
      "09-wrong-entity",
      V1_MAPPING,
      V1_SCOPE,
      "Review [[AW_PROJECT_1111111111111111]].",
    ),
    blocked(
      "10-extra-bracket",
      V1_MAPPING,
      V1_SCOPE,
      `Review ${V1_CUSTOMER}].`,
    ),
    blocked(
      "11-mixed-known-unknown",
      V1_MAPPING,
      V1_SCOPE,
      `${V1_CUSTOMER} and ${UNKNOWN}`,
    ),
    blocked("12-nested", V1_MAPPING, V1_SCOPE, `[[AW_CUSTOMER_${V1_CUSTOMER}`),
    blocked(
      "13-split",
      V1_MAPPING,
      V1_SCOPE,
      "[[AW_CUSTOMER_11111111 11111111]]",
    ),
  ]);
}

export function permutedOutputRestorationCorpus(): readonly OutputRestorationCorpusCase[] {
  const v1 = validatePseudonymMapping({
    ...V1_MAPPING,
    entries: [...V1_MAPPING.entries].reverse(),
  });
  const v2 = validatePseudonymMappingV2({
    ...V2_MAPPING,
    entries: [...V2_MAPPING.entries].reverse(),
  });
  return Object.freeze(
    [...frozenOutputRestorationCorpus()].reverse().map((entry) =>
      Object.freeze({
        ...entry,
        mapping: entry.mapping.schemaVersion === 1 ? v1 : v2,
      }),
    ),
  );
}

function entry(
  itemId: string,
  original: string,
  pseudonym: string,
  entityType: string,
  originalByteStart: number,
) {
  const originalBytes = Buffer.from(original, "utf8");
  return {
    itemId,
    originalContentSha256: sha256(`original-${itemId}`),
    transformedContentSha256: sha256(`transformed-${itemId}`),
    originalByteStart,
    originalByteEnd: originalByteStart + originalBytes.length,
    transformedByteStart: originalByteStart,
    transformedByteEnd: originalByteStart + Buffer.byteLength(pseudonym),
    entityType,
    pseudonym,
    originalBase64: originalBytes.toString("base64"),
  };
}

function valid(
  id: string,
  mapping: PseudonymMapping | PseudonymMappingV2,
  scope: OutputRestorationScope,
  output: string,
  restored: string,
) {
  return expected(
    id,
    mapping,
    scope,
    output,
    "RESTORABLE_LOCAL_EVIDENCE",
    sha256(restored),
  );
}
function blocked(
  id: string,
  mapping: PseudonymMapping | PseudonymMappingV2,
  scope: OutputRestorationScope,
  output: string,
) {
  return expected(
    id,
    mapping,
    scope,
    output,
    "BLOCKED_INTEGRITY_FAILURE",
    null,
  );
}
function expected(
  id: string,
  mapping: PseudonymMapping | PseudonymMappingV2,
  scope: OutputRestorationScope,
  output: string,
  expectedStrictDecision: OutputRestorationCorpusCase["expectedStrictDecision"],
  expectedStrictRestoredSha256: string | null,
): OutputRestorationCorpusCase {
  return Object.freeze({
    id,
    mapping,
    scope,
    output,
    expectedStrictDecision,
    expectedStrictRestoredSha256,
  });
}

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
