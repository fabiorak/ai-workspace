import assert from "node:assert/strict";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
} from "node:crypto";
import test from "node:test";
import type { ExpandedContextPackPreview } from "@ai-workspace/context-builder";
import {
  pseudonymizeContextPack,
  pseudonymizeContextPackV2,
  restorePseudonymizedItems,
  restorePseudonymizedItemsV2,
  validatePseudonymMapping,
  validatePseudonymMappingV2,
  validatePseudonymReview,
  validatePseudonymReviewV2,
} from "../src/index.ts";

const KEY = Buffer.alloc(32, 7);
const NONCE = Buffer.alloc(12, 9);
const V1_CONTENT = "Customer Cedar uses marker Amber.";
const V2_CONTENT = "Customer Maple works on Project Quartz.";
const V2_HASH =
  "298f8353a76b53ce25eaa03b808dc696af1ff9db9da9dd3b96b828420b011f6d";
const V1_TRANSFORMED =
  "[[AW_CUSTOMER_69B9E18A2CD807BD]] uses marker [[AW_OTHER_D8E53989761E21C0]].";
const V2_TRANSFORMED =
  "[[AW_CUSTOMER_597E6EBB56A31C29]] works on [[AW_PROJECT_FDA57C1D32C37F7F]].";

const V1_REVIEW_BYTES =
  '{"schemaVersion":1,"mappingSetId":"mapping-v1-synthetic","projectId":"project-synthetic","workItemId":"work-synthetic","handoffId":"handoff-synthetic","modelId":"model-synthetic","attribution":"USER_REVIEWED","selections":[{"itemId":"handoff:objective","contentSha256":"7a9853f9b2e6f54fe260b9cfe237d2bdb375096eabe0851c5f3bb01b4934e58a","byteStart":0,"byteEnd":14,"entityType":"CUSTOMER"},{"itemId":"handoff:objective","contentSha256":"7a9853f9b2e6f54fe260b9cfe237d2bdb375096eabe0851c5f3bb01b4934e58a","byteStart":27,"byteEnd":32,"entityType":"OTHER"}]}\n';
const V1_MAPPING_BYTES =
  '{"schemaVersion":1,"mappingSetId":"mapping-v1-synthetic","projectId":"project-synthetic","workItemId":"work-synthetic","handoffId":"handoff-synthetic","modelId":"model-synthetic","entries":[{"itemId":"handoff:objective","originalContentSha256":"7a9853f9b2e6f54fe260b9cfe237d2bdb375096eabe0851c5f3bb01b4934e58a","originalByteStart":0,"originalByteEnd":14,"transformedByteStart":0,"transformedByteEnd":32,"entityType":"CUSTOMER","pseudonym":"[[AW_CUSTOMER_69B9E18A2CD807BD]]","originalBase64":"Q3VzdG9tZXIgQ2VkYXI=","transformedContentSha256":"011532bb4e6c619e3029c8a91a618c290afc3434cc6eaf899cbf8f82381e58d1"},{"itemId":"handoff:objective","originalContentSha256":"7a9853f9b2e6f54fe260b9cfe237d2bdb375096eabe0851c5f3bb01b4934e58a","originalByteStart":27,"originalByteEnd":32,"transformedByteStart":45,"transformedByteEnd":74,"entityType":"OTHER","pseudonym":"[[AW_OTHER_D8E53989761E21C0]]","originalBase64":"QW1iZXI=","transformedContentSha256":"011532bb4e6c619e3029c8a91a618c290afc3434cc6eaf899cbf8f82381e58d1"}]}\n';
const V2_REVIEW_BYTES =
  '{"schemaVersion":2,"mappingSetId":"mapping-v2-synthetic","projectId":"project-synthetic","workItemId":"work-synthetic","handoffId":"handoff-synthetic","modelId":"model-synthetic","attribution":"USER_REVIEWED","selections":[{"itemId":"handoff:objective","contentSha256":"298f8353a76b53ce25eaa03b808dc696af1ff9db9da9dd3b96b828420b011f6d","byteStart":0,"byteEnd":14,"entityType":"CUSTOMER"},{"itemId":"handoff:objective","contentSha256":"298f8353a76b53ce25eaa03b808dc696af1ff9db9da9dd3b96b828420b011f6d","byteStart":24,"byteEnd":38,"entityType":"PROJECT"}]}\n';
const V2_MAPPING_BYTES =
  '{"schemaVersion":2,"mappingSetId":"mapping-v2-synthetic","projectId":"project-synthetic","workItemId":"work-synthetic","handoffId":"handoff-synthetic","modelId":"model-synthetic","entries":[{"itemId":"handoff:objective","originalContentSha256":"298f8353a76b53ce25eaa03b808dc696af1ff9db9da9dd3b96b828420b011f6d","originalByteStart":0,"originalByteEnd":14,"transformedByteStart":0,"transformedByteEnd":32,"entityType":"CUSTOMER","pseudonym":"[[AW_CUSTOMER_597E6EBB56A31C29]]","originalBase64":"Q3VzdG9tZXIgTWFwbGU=","transformedContentSha256":"82c6cb8612047fc31eea3eec24cb372866f36907d73f49ab3af5fcf34c9e3cfc"},{"itemId":"handoff:objective","originalContentSha256":"298f8353a76b53ce25eaa03b808dc696af1ff9db9da9dd3b96b828420b011f6d","originalByteStart":24,"originalByteEnd":38,"transformedByteStart":42,"transformedByteEnd":73,"entityType":"PROJECT","pseudonym":"[[AW_PROJECT_FDA57C1D32C37F7F]]","originalBase64":"UHJvamVjdCBRdWFydHo=","transformedContentSha256":"82c6cb8612047fc31eea3eec24cb372866f36907d73f49ab3af5fcf34c9e3cfc"}]}\n';

type V2Entity =
  "PERSON" | "CUSTOMER" | "PROJECT" | "EMAIL" | "BUSINESS_IDENTIFIER" | "OTHER";
type CandidateMapping = Readonly<{
  schemaVersion: 1 | 2;
  mappingSetId: string;
  projectId: string;
  workItemId: string;
  handoffId: string;
  modelId: string;
  entries: readonly CandidateEntry[];
}>;
type CandidateEntry = Readonly<{
  itemId: string;
  originalContentSha256: string;
  originalByteStart: number;
  originalByteEnd: number;
  transformedByteStart: number;
  transformedByteEnd: number;
  entityType: V2Entity;
  pseudonym: string;
  originalBase64: string;
  transformedContentSha256: string;
}>;

function packet(content: string): ExpandedContextPackPreview {
  const exactBytes = Buffer.byteLength(content);
  return {
    schemaVersion: 2,
    projectId: "project-synthetic",
    workItemId: "work-synthetic",
    handoffId: "handoff-synthetic",
    budgets: { CONTINUITY: 4_096, INSTRUCTIONS: 4_096 },
    usedBytes: { CONTINUITY: exactBytes, INSTRUCTIONS: 0 },
    included: [
      {
        id: "handoff:objective",
        category: "CONTINUITY",
        sourceType: "HANDOFF_SECTION",
        sourceId: "handoff-synthetic",
        trust: "MIXED",
        content,
        exactBytes,
      },
    ],
    omitted: [],
    measurement: {
      exactIncludedBytes: exactBytes,
      estimatedTokens: Math.ceil(exactBytes / 4),
      estimateMethod: "CEIL_EXACT_INCLUDED_BYTES_DIVIDED_BY_4",
    },
    effect: "READ_ONLY_NOT_PERSISTED_OR_EXECUTED",
    sourceTableSummary: null,
  };
}

function v1Review() {
  return validatePseudonymReview(JSON.parse(V1_REVIEW_BYTES));
}

function v2Candidate() {
  const review = JSON.parse(V2_REVIEW_BYTES) as {
    schemaVersion: 2;
    mappingSetId: string;
    projectId: string;
    workItemId: string;
    handoffId: string;
    modelId: string;
    selections: readonly Readonly<{
      itemId: string;
      contentSha256: string;
      byteStart: number;
      byteEnd: number;
      entityType: V2Entity;
    }>[];
  };
  const source = Buffer.from(V2_CONTENT);
  const chunks: Buffer[] = [];
  const pending: Omit<CandidateEntry, "transformedContentSha256">[] = [];
  let originalCursor = 0;
  let transformedCursor = 0;
  for (const selection of review.selections) {
    assert.equal(selection.contentSha256, V2_HASH);
    const prefix = source.subarray(originalCursor, selection.byteStart);
    chunks.push(prefix);
    transformedCursor += prefix.length;
    const original = source.subarray(selection.byteStart, selection.byteEnd);
    const pseudonym = alias(2, selection.entityType, original);
    const replacement = Buffer.from(pseudonym);
    chunks.push(replacement);
    pending.push({
      itemId: selection.itemId,
      originalContentSha256: selection.contentSha256,
      originalByteStart: selection.byteStart,
      originalByteEnd: selection.byteEnd,
      transformedByteStart: transformedCursor,
      transformedByteEnd: transformedCursor + replacement.length,
      entityType: selection.entityType,
      pseudonym,
      originalBase64: original.toString("base64"),
    });
    transformedCursor += replacement.length;
    originalCursor = selection.byteEnd;
  }
  chunks.push(source.subarray(originalCursor));
  const transformedContent = Buffer.concat(chunks).toString("utf8");
  const transformedContentSha256 = sha256(transformedContent);
  const mapping: CandidateMapping = Object.freeze({
    schemaVersion: 2,
    mappingSetId: review.mappingSetId,
    projectId: review.projectId,
    workItemId: review.workItemId,
    handoffId: review.handoffId,
    modelId: review.modelId,
    entries: Object.freeze(
      pending.map((entry) =>
        Object.freeze({ ...entry, transformedContentSha256 }),
      ),
    ),
  });
  return Object.freeze({ mapping, transformedContent });
}

function restoreCandidate(mapping: CandidateMapping, transformed: string) {
  let bytes = Buffer.from(transformed);
  for (const entry of [...mapping.entries].sort(
    (left, right) => right.transformedByteStart - left.transformedByteStart,
  )) {
    const actual = bytes.subarray(
      entry.transformedByteStart,
      entry.transformedByteEnd,
    );
    assert.equal(actual.toString("utf8"), entry.pseudonym);
    bytes = Buffer.concat([
      bytes.subarray(0, entry.transformedByteStart),
      Buffer.from(entry.originalBase64, "base64"),
      bytes.subarray(entry.transformedByteEnd),
    ]);
  }
  return bytes.toString("utf8");
}

function alias(version: 1 | 2, entityType: V2Entity, value: Buffer) {
  const digest = createHmac("sha256", KEY)
    .update(`ai-workspace/pseudonym/v${version}`, "utf8")
    .update(Buffer.from([0]))
    .update(entityType, "utf8")
    .update(Buffer.from([0]))
    .update(value)
    .digest("hex")
    .slice(0, 16)
    .toUpperCase();
  return `[[AW_${entityType}_${digest}]]`;
}

function seal(mapping: CandidateMapping) {
  const metadata =
    mapping.schemaVersion === 1
      ? {
          schemaVersion: 1,
          algorithm: "AES-256-GCM",
          mappingSetId: mapping.mappingSetId,
          projectId: mapping.projectId,
          workItemId: mapping.workItemId,
          handoffId: mapping.handoffId,
          modelId: mapping.modelId,
        }
      : {
          schemaVersion: 1,
          mappingSchemaVersion: 2,
          algorithm: "AES-256-GCM",
          mappingSetId: mapping.mappingSetId,
          projectId: mapping.projectId,
          workItemId: mapping.workItemId,
          handoffId: mapping.handoffId,
          modelId: mapping.modelId,
        };
  const cipher = createCipheriv("aes-256-gcm", KEY, NONCE);
  cipher.setAAD(Buffer.from(JSON.stringify(metadata)));
  const ciphertext = Buffer.concat([
    cipher.update(canonical(mapping)),
    cipher.final(),
  ]);
  return { metadata, ciphertext, tag: cipher.getAuthTag() };
}

function open(sealed: ReturnType<typeof seal>): CandidateMapping {
  const decipher = createDecipheriv("aes-256-gcm", KEY, NONCE);
  decipher.setAAD(Buffer.from(JSON.stringify(sealed.metadata)));
  decipher.setAuthTag(sealed.tag);
  const plaintext = Buffer.concat([
    decipher.update(sealed.ciphertext),
    decipher.final(),
  ]).toString("utf8");
  const parsed = JSON.parse(plaintext) as CandidateMapping;
  const declared =
    "mappingSchemaVersion" in sealed.metadata
      ? sealed.metadata.mappingSchemaVersion
      : 1;
  if (parsed.schemaVersion !== declared || canonical(parsed) !== plaintext)
    throw new Error("incompatible synthetic mapping");
  return parsed;
}

function v1OnlyRead(value: unknown) {
  const mapping = validatePseudonymMapping(value);
  for (const entry of mapping.entries)
    if (!entry.pseudonym.startsWith(`[[AW_${entry.entityType}_`))
      throw new Error("incoherent synthetic v1 entry");
  return mapping;
}

function canonical(value: CandidateMapping) {
  return `${JSON.stringify(value)}\n`;
}

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

test("freezes current schema-v1 canonical bytes and byte-exact restore", () => {
  const review = v1Review();
  assert.equal(`${JSON.stringify(review)}\n`, V1_REVIEW_BYTES);
  const result = pseudonymizeContextPack({
    review,
    contextPack: packet(V1_CONTENT),
    key: KEY,
  });
  assert.equal(canonical(result.mapping), V1_MAPPING_BYTES);
  assert.equal(result.preview.items[0]!.transformedContent, V1_TRANSFORMED);
  assert.equal(
    restorePseudonymizedItems({
      mapping: validatePseudonymMapping(JSON.parse(V1_MAPPING_BYTES)),
      items: result.preview.items,
    })[0]!.content,
    V1_CONTENT,
  );
});

test("freezes deterministic schema-v2 project mapping candidate bytes", () => {
  const candidate = v2Candidate();
  assert.equal(
    `${JSON.stringify(JSON.parse(V2_REVIEW_BYTES))}\n`,
    V2_REVIEW_BYTES,
  );
  assert.equal(canonical(candidate.mapping), V2_MAPPING_BYTES);
  assert.equal(candidate.transformedContent, V2_TRANSFORMED);
  assert.equal(restoreCandidate(candidate.mapping, V2_TRANSFORMED), V2_CONTENT);
});

test("production schema-v2 writer and reader satisfy the frozen candidate", () => {
  const review = validatePseudonymReviewV2(JSON.parse(V2_REVIEW_BYTES));
  const result = pseudonymizeContextPackV2({
    review,
    contextPack: packet(V2_CONTENT),
    key: KEY,
  });
  assert.equal(canonical(result.mapping), V2_MAPPING_BYTES);
  assert.equal(result.preview.items[0]!.transformedContent, V2_TRANSFORMED);
  assert.equal(
    restorePseudonymizedItemsV2({
      mapping: validatePseudonymMappingV2(JSON.parse(V2_MAPPING_BYTES)),
      items: result.preview.items,
    })[0]!.content,
    V2_CONTENT,
  );
});

test("requires PROJECT meaning for schema v2 instead of upgrading customer-only state", () => {
  const review = JSON.parse(V2_REVIEW_BYTES) as {
    selections: { entityType: string }[];
  };
  review.selections = review.selections
    .filter((entry) => entry.entityType === "CUSTOMER")
    .map((entry) => ({ ...entry }));
  assert.throws(() => validatePseudonymReviewV2(review));
  const mapping = JSON.parse(V2_MAPPING_BYTES) as {
    entries: { entityType: string }[];
  };
  mapping.entries = mapping.entries.filter(
    (entry) => entry.entityType === "CUSTOMER",
  );
  assert.throws(() => validatePseudonymMappingV2(mapping));
});

test("coexists through explicit version dispatch and rejects downgrade paths", () => {
  const v1 = JSON.parse(V1_MAPPING_BYTES) as CandidateMapping;
  const v2 = v2Candidate().mapping;
  assert.equal(open(seal(v1)).mappingSetId, "mapping-v1-synthetic");
  assert.equal(open(seal(v2)).mappingSetId, "mapping-v2-synthetic");
  assert.notEqual(v1.mappingSetId, v2.mappingSetId);
  assert.throws(() => v1OnlyRead(v2));
  assert.throws(() =>
    v1OnlyRead({
      ...v2,
      schemaVersion: 1,
      entries: v2.entries.map((entry) =>
        entry.entityType === "PROJECT"
          ? { ...entry, entityType: "OTHER" }
          : entry,
      ),
    }),
  );
  assert.throws(() => open(seal({ ...v2, schemaVersion: 3 as 2 })));
});

test("authenticates the exact mapping schema and scope", () => {
  const sealed = seal(v2Candidate().mapping);
  assert.equal(open(sealed).schemaVersion, 2);
  assert.throws(() =>
    open({
      ...sealed,
      metadata: { ...sealed.metadata, mappingSchemaVersion: 1 },
    }),
  );
  assert.throws(() =>
    open({
      ...sealed,
      metadata: { ...sealed.metadata, projectId: "other-synthetic" },
    }),
  );
});
