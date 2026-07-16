import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

import { detectRestrictedData } from "../packages/privacy-gateway/src/index.ts";

export const ENTITY_TYPES = [
  "EMAIL",
  "IPV4",
  "PHONE",
  "CUSTOMER",
  "PROJECT",
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];
export type EntityCandidateName =
  "STANDARD_SYNTAX" | "EXACT_ALIAS" | "COMBINED";

export type EntityCandidateItem = Readonly<{
  id: string;
  content: string;
}>;
export type EntityAlias = Readonly<{
  entityType: "CUSTOMER" | "PROJECT";
  alias: string;
}>;
export type EntityCandidate = Readonly<{
  itemId: string;
  entityType: EntityType;
  byteStart: number;
  byteEnd: number;
  contentSha256: string;
  reasonCode: "STANDARD_SYNTAX" | "EXACT_CONFIGURED_ALIAS";
}>;

type GroundTruth = Readonly<{
  itemId: string;
  entityType: EntityType;
  byteStart: number;
  byteEnd: number;
}>;

type Score = Readonly<{
  truePositive: number;
  falsePositive: number;
  falseNegative: number;
  precisionPercent: number;
  recallPercent: number;
}>;

export type EntityCandidateMeasurement = Readonly<{
  candidate: EntityCandidateName;
  applicableTypes: readonly EntityType[];
  counts: Readonly<{
    proposed: number;
    groundTruth: number;
    truePositive: number;
    falsePositive: number;
    falseNegative: number;
  }>;
  precisionPercent: number;
  recallPercent: number;
  perType: Readonly<Record<EntityType, Score | null>>;
  candidateSetSha256: string;
  structuralGates: Readonly<{
    validUtf8Boundaries: boolean;
    deterministicPermutation: boolean;
    completeReconciliation: boolean;
    noDuplicateIdentity: boolean;
    invalidMatrixRejected: boolean;
    invalidMatrixNoEcho: boolean;
    restrictedDetectorRegression: boolean;
    productionEffects: 0;
  }>;
  decision: "ADOPT_FOR_REVIEW" | "REFINE" | "NO_CHANGE";
}>;

export type EntityCandidateRun = Readonly<{
  schemaVersion: 1;
  corpusId: "SPRINT_28_SYNTHETIC_V1";
  itemCount: 8;
  groundTruthCount: 12;
  groundTruthSha256: string;
  invalidCases: 5;
  measurements: readonly EntityCandidateMeasurement[];
  effect: "DEVELOPMENT_ONLY_NO_PRODUCTION_CONSUMER";
}>;

const MAX_ITEMS = 64;
const MAX_ITEM_BYTES = 1_000_000;
const MAX_TOTAL_BYTES = 4 * 1_024 * 1_024;
const MAX_ALIASES = 1_000;
const MAX_ALIAS_BYTES = 256;
const MAX_ID_BYTES = 128;
const STANDARD_TYPES = Object.freeze(["EMAIL", "IPV4", "PHONE"] as const);
const ALIAS_TYPES = Object.freeze(["CUSTOMER", "PROJECT"] as const);
const EMAIL =
  /[A-Za-z0-9][A-Za-z0-9._%+-]{0,63}@[A-Za-z0-9][A-Za-z0-9.-]{0,189}\.[A-Za-z]{2,24}/gu;
const IPV4 = /(?:\d{1,3}\.){3}\d{1,3}/gu;
const PHONE = /\+[1-9]\d{7,14}/gu;

const ITEMS = Object.freeze([
  {
    id: "english-prose",
    content:
      "Contact maria.rossi@example.invalid or +390255501234 for the Asteria Demo account.",
  },
  {
    id: "italian-unicode",
    content:
      "Il progetto Résumé Δ usa il nodo 192.0.2.44; scrivere a luca.bianchi@example.invalid.",
  },
  {
    id: "structured-text",
    content:
      '{"customer":"ASTERIA_DEMO","endpoint":"198.51.100.8","owner":"qa@example.invalid"}',
  },
  {
    id: "invalid-lookalikes",
    content:
      "Invalidi user@example, 999.12.0.1 e +0123456789 restano testo sintetico.",
  },
  {
    id: "alias-boundaries",
    content: "preASTERIA_DEMOpost ASTERIA_DEMO.",
  },
  {
    id: "repeated-email",
    content:
      "Inviare a repeat@example.invalid e poi ancora repeat@example.invalid.",
  },
  {
    id: "public-and-placeholder",
    content: "Example pubblico e [[PSEUDO_CUSTOMER_ABC123]] restano invariati.",
  },
  {
    id: "code-shaped-phone",
    content: 'const sample = "+390255501234"; // fictional test literal',
  },
] satisfies readonly EntityCandidateItem[]);

const ALIASES = Object.freeze([
  { entityType: "CUSTOMER", alias: "Asteria Demo" },
  { entityType: "CUSTOMER", alias: "ASTERIA_DEMO" },
  { entityType: "PROJECT", alias: "Résumé Δ" },
] satisfies readonly EntityAlias[]);

const GROUND_TRUTH = Object.freeze([
  truth("english-prose", "EMAIL", "maria.rossi@example.invalid"),
  truth("english-prose", "PHONE", "+390255501234"),
  truth("english-prose", "CUSTOMER", "Asteria Demo"),
  truth("italian-unicode", "PROJECT", "Résumé Δ"),
  truth("italian-unicode", "IPV4", "192.0.2.44"),
  truth("italian-unicode", "EMAIL", "luca.bianchi@example.invalid"),
  truth("structured-text", "CUSTOMER", "ASTERIA_DEMO"),
  truth("structured-text", "IPV4", "198.51.100.8"),
  truth("structured-text", "EMAIL", "qa@example.invalid"),
  truth("alias-boundaries", "CUSTOMER", "ASTERIA_DEMO", 1),
  truth("repeated-email", "EMAIL", "repeat@example.invalid", 0),
  truth("repeated-email", "EMAIL", "repeat@example.invalid", 1),
]);

export class EntityCandidateError extends Error {
  public constructor(options?: ErrorOptions) {
    super(
      "Entity candidate input is malformed, ambiguous, conflicting, or oversized.",
      options,
    );
    this.name = "EntityCandidateError";
  }
}

export function proposeStandardSyntaxCandidates(
  input: readonly EntityCandidateItem[],
): readonly EntityCandidate[] {
  const items = validateItems(input);
  const candidates: EntityCandidate[] = [];
  for (const item of items) {
    collectPattern(item, "EMAIL", EMAIL, candidates, () => true);
    collectPattern(item, "IPV4", IPV4, candidates, validIpv4);
    collectPattern(item, "PHONE", PHONE, candidates, () => true);
  }
  return finalizeCandidates(candidates);
}

export function proposeExactAliasCandidates(
  input: readonly EntityCandidateItem[],
  dictionary: readonly EntityAlias[],
): readonly EntityCandidate[] {
  const items = validateItems(input);
  const aliases = validateAliases(dictionary);
  const candidates: EntityCandidate[] = [];
  for (const item of items) {
    for (const entry of aliases) {
      let cursor = 0;
      while (cursor <= item.content.length - entry.alias.length) {
        const characterStart = item.content.indexOf(entry.alias, cursor);
        if (characterStart < 0) break;
        const characterEnd = characterStart + entry.alias.length;
        if (hasTokenBoundaries(item.content, characterStart, characterEnd))
          candidates.push(
            candidate(
              item,
              entry.entityType,
              characterStart,
              characterEnd,
              "EXACT_CONFIGURED_ALIAS",
            ),
          );
        cursor = characterStart + entry.alias.length;
      }
    }
  }
  return finalizeCandidates(candidates);
}

export function proposeCombinedCandidates(
  input: readonly EntityCandidateItem[],
  dictionary: readonly EntityAlias[],
): readonly EntityCandidate[] {
  return finalizeCandidates([
    ...proposeStandardSyntaxCandidates(input),
    ...proposeExactAliasCandidates(input, dictionary),
  ]);
}

export function measureEntityCandidateDiscovery(): EntityCandidateRun {
  const invalid = evaluateInvalidMatrix();
  const restrictedDetectorRegression = verifyRestrictedDetector();
  const definitions = Object.freeze([
    {
      name: "STANDARD_SYNTAX" as const,
      types: STANDARD_TYPES,
      run: (
        items: readonly EntityCandidateItem[],
        aliases: readonly EntityAlias[],
      ) => {
        void aliases;
        return proposeStandardSyntaxCandidates(items);
      },
    },
    {
      name: "EXACT_ALIAS" as const,
      types: ALIAS_TYPES,
      run: proposeExactAliasCandidates,
    },
    {
      name: "COMBINED" as const,
      types: ENTITY_TYPES,
      run: proposeCombinedCandidates,
    },
  ]);
  const measurements = definitions.map((definition) => {
    const candidates = definition.run(ITEMS, ALIASES);
    const permuted = definition.run(
      [...ITEMS].reverse(),
      [...ALIASES].reverse(),
    );
    return scoreCandidate({
      name: definition.name,
      applicableTypes: definition.types,
      candidates,
      deterministicPermutation:
        canonicalDigest(candidates) === canonicalDigest(permuted),
      invalid,
      restrictedDetectorRegression,
    });
  });
  return Object.freeze({
    schemaVersion: 1 as const,
    corpusId: "SPRINT_28_SYNTHETIC_V1" as const,
    itemCount: 8 as const,
    groundTruthCount: 12 as const,
    groundTruthSha256: canonicalDigest(GROUND_TRUTH),
    invalidCases: 5 as const,
    measurements: Object.freeze(measurements),
    effect: "DEVELOPMENT_ONLY_NO_PRODUCTION_CONSUMER" as const,
  });
}

export function evaluateEntityCandidateDiscovery(): Readonly<{
  schemaVersion: 1;
  runs: readonly EntityCandidateRun[];
  deterministic: boolean;
  decisions: Readonly<
    Record<EntityCandidateName, "ADOPT_FOR_REVIEW" | "REFINE" | "NO_CHANGE">
  >;
  effect: "DEVELOPMENT_ONLY_NO_PRODUCTION_CONSUMER";
}> {
  const first = measureEntityCandidateDiscovery();
  const second = measureEntityCandidateDiscovery();
  const runs = Object.freeze([first, second] as const);
  const deterministic = canonicalDigest(first) === canonicalDigest(second);
  const decisions = Object.fromEntries(
    first.measurements.map((measurement) => [
      measurement.candidate,
      deterministic ? measurement.decision : "NO_CHANGE",
    ]),
  ) as Record<EntityCandidateName, "ADOPT_FOR_REVIEW" | "REFINE" | "NO_CHANGE">;
  return Object.freeze({
    schemaVersion: 1 as const,
    runs,
    deterministic,
    decisions: Object.freeze(decisions),
    effect: "DEVELOPMENT_ONLY_NO_PRODUCTION_CONSUMER" as const,
  });
}

function collectPattern(
  item: EntityCandidateItem,
  entityType: "EMAIL" | "IPV4" | "PHONE",
  pattern: RegExp,
  output: EntityCandidate[],
  validate: (value: string) => boolean,
): void {
  for (const match of item.content.matchAll(pattern)) {
    const value = match[0];
    const characterStart = match.index;
    const characterEnd = characterStart + value.length;
    if (
      validate(value) &&
      hasTokenBoundaries(item.content, characterStart, characterEnd)
    )
      output.push(
        candidate(
          item,
          entityType,
          characterStart,
          characterEnd,
          "STANDARD_SYNTAX",
        ),
      );
  }
}

function candidate(
  item: EntityCandidateItem,
  entityType: EntityType,
  characterStart: number,
  characterEnd: number,
  reasonCode: EntityCandidate["reasonCode"],
): EntityCandidate {
  return Object.freeze({
    itemId: item.id,
    entityType,
    byteStart: Buffer.byteLength(item.content.slice(0, characterStart), "utf8"),
    byteEnd: Buffer.byteLength(item.content.slice(0, characterEnd), "utf8"),
    contentSha256: sha256(item.content),
    reasonCode,
  });
}

function finalizeCandidates(
  input: readonly EntityCandidate[],
): readonly EntityCandidate[] {
  const candidates = [...input].sort(compareCandidate);
  for (let index = 0; index < candidates.length; index += 1) {
    const current = candidates[index]!;
    const previous = candidates[index - 1];
    if (
      previous !== undefined &&
      previous.itemId === current.itemId &&
      current.byteStart < previous.byteEnd
    )
      throw invalid();
  }
  return Object.freeze(candidates);
}

function validateItems(
  input: readonly EntityCandidateItem[],
): readonly EntityCandidateItem[] {
  try {
    if (!Array.isArray(input) || input.length === 0 || input.length > MAX_ITEMS)
      throw invalid();
    let totalBytes = 0;
    const ids = new Set<string>();
    const items = input.map((entry) => {
      if (
        typeof entry !== "object" ||
        entry === null ||
        typeof entry.id !== "string" ||
        typeof entry.content !== "string" ||
        entry.id.length === 0 ||
        !isWellFormedUtf8(entry.id) ||
        !isWellFormedUtf8(entry.content) ||
        /\p{Cc}/u.test(entry.id) ||
        Buffer.byteLength(entry.id, "utf8") > MAX_ID_BYTES ||
        ids.has(entry.id)
      )
        throw invalid();
      const bytes = Buffer.byteLength(entry.content, "utf8");
      if (bytes > MAX_ITEM_BYTES) throw invalid();
      ids.add(entry.id);
      totalBytes += bytes;
      return Object.freeze({ id: entry.id, content: entry.content });
    });
    if (totalBytes > MAX_TOTAL_BYTES) throw invalid();
    return Object.freeze(items);
  } catch (error) {
    if (error instanceof EntityCandidateError) throw error;
    throw invalid(error);
  }
}

function validateAliases(
  input: readonly EntityAlias[],
): readonly EntityAlias[] {
  try {
    if (
      !Array.isArray(input) ||
      input.length === 0 ||
      input.length > MAX_ALIASES
    )
      throw invalid();
    const seen = new Set<string>();
    const aliases = input.map((entry) => {
      if (
        typeof entry !== "object" ||
        entry === null ||
        !ALIAS_TYPES.includes(entry.entityType) ||
        typeof entry.alias !== "string" ||
        entry.alias.length === 0 ||
        !isWellFormedUtf8(entry.alias) ||
        /\p{Cc}/u.test(entry.alias) ||
        Buffer.byteLength(entry.alias, "utf8") > MAX_ALIAS_BYTES ||
        seen.has(entry.alias)
      )
        throw invalid();
      seen.add(entry.alias);
      return Object.freeze({
        entityType: entry.entityType,
        alias: entry.alias,
      });
    });
    return Object.freeze(
      aliases.sort((left, right) => compareText(left.alias, right.alias)),
    );
  } catch (error) {
    if (error instanceof EntityCandidateError) throw error;
    throw invalid(error);
  }
}

function scoreCandidate(
  input: Readonly<{
    name: EntityCandidateName;
    applicableTypes: readonly EntityType[];
    candidates: readonly EntityCandidate[];
    deterministicPermutation: boolean;
    invalid: Readonly<{ rejected: boolean; noEcho: boolean }>;
    restrictedDetectorRegression: boolean;
  }>,
): EntityCandidateMeasurement {
  const applicable = new Set<EntityType>(input.applicableTypes);
  const expected = GROUND_TRUTH.filter((entry) =>
    applicable.has(entry.entityType),
  );
  const actualKeys = new Set(input.candidates.map(candidateKey));
  const expectedKeys = new Set(expected.map(truthKey));
  const truePositive = [...actualKeys].filter((key) =>
    expectedKeys.has(key),
  ).length;
  const falsePositive = actualKeys.size - truePositive;
  const falseNegative = expectedKeys.size - truePositive;
  const overall = score(truePositive, falsePositive, falseNegative);
  const perType = Object.fromEntries(
    ENTITY_TYPES.map((entityType) => {
      if (!applicable.has(entityType)) return [entityType, null];
      const actual = new Set(
        input.candidates
          .filter((entry) => entry.entityType === entityType)
          .map(candidateKey),
      );
      const truth = new Set(
        expected
          .filter((entry) => entry.entityType === entityType)
          .map(truthKey),
      );
      const matched = [...actual].filter((key) => truth.has(key)).length;
      return [
        entityType,
        score(matched, actual.size - matched, truth.size - matched),
      ];
    }),
  ) as Record<EntityType, Score | null>;
  const structuralGates = Object.freeze({
    validUtf8Boundaries: candidatesHaveValidBoundaries(input.candidates),
    deterministicPermutation: input.deterministicPermutation,
    completeReconciliation:
      truePositive + falsePositive === input.candidates.length &&
      truePositive + falseNegative === expected.length,
    noDuplicateIdentity: actualKeys.size === input.candidates.length,
    invalidMatrixRejected: input.invalid.rejected,
    invalidMatrixNoEcho: input.invalid.noEcho,
    restrictedDetectorRegression: input.restrictedDetectorRegression,
    productionEffects: 0 as const,
  });
  const structuralPass = Object.values(structuralGates).every(
    (value) => value === true || value === 0,
  );
  const perTypePass = Object.values(perType).every(
    (value) =>
      value === null ||
      (value.precisionPercent >= 80 && value.recallPercent >= 80),
  );
  const decision = !structuralPass
    ? ("NO_CHANGE" as const)
    : overall.precisionPercent >= 90 &&
        overall.recallPercent >= 90 &&
        perTypePass
      ? ("ADOPT_FOR_REVIEW" as const)
      : overall.precisionPercent >= 50 && overall.recallPercent >= 50
        ? ("REFINE" as const)
        : ("NO_CHANGE" as const);
  return Object.freeze({
    candidate: input.name,
    applicableTypes: Object.freeze([...input.applicableTypes]),
    counts: Object.freeze({
      proposed: input.candidates.length,
      groundTruth: expected.length,
      truePositive,
      falsePositive,
      falseNegative,
    }),
    precisionPercent: overall.precisionPercent,
    recallPercent: overall.recallPercent,
    perType: Object.freeze(perType),
    candidateSetSha256: canonicalDigest(input.candidates),
    structuralGates,
    decision,
  });
}

function evaluateInvalidMatrix(): Readonly<{
  rejected: boolean;
  noEcho: boolean;
}> {
  const canary = "PRIVATE_SYNTHETIC_CANARY";
  const cases: readonly (() => unknown)[] = [
    () => proposeStandardSyntaxCandidates([ITEMS[0]!, ITEMS[0]!]),
    () =>
      proposeExactAliasCandidates(ITEMS, [
        ...ALIASES,
        { entityType: "PROJECT", alias: "Asteria Demo" },
      ]),
    () =>
      proposeExactAliasCandidates(ITEMS, [
        { entityType: "CUSTOMER", alias: `${canary}\n` },
      ]),
    () =>
      proposeStandardSyntaxCandidates([
        { id: "oversized", content: "x".repeat(MAX_ITEM_BYTES + 1) },
      ]),
    () =>
      proposeCombinedCandidates(ITEMS, [
        ...ALIASES,
        { entityType: "CUSTOMER", alias: "maria.rossi@example.invalid" },
      ]),
  ];
  let rejected = 0;
  let echo = 0;
  for (const invalidCase of cases) {
    try {
      invalidCase();
    } catch (error) {
      if (error instanceof EntityCandidateError) rejected += 1;
      if (error instanceof Error && error.message.includes(canary)) echo += 1;
    }
  }
  return Object.freeze({
    rejected: rejected === cases.length,
    noEcho: echo === 0,
  });
}

function verifyRestrictedDetector(): boolean {
  return (
    detectRestrictedData("-----BEGIN PRIVATE KEY-----") === "private-key" &&
    detectRestrictedData("AKIAABCDEFGHIJKLMNOP") === "aws-access-key" &&
    detectRestrictedData(`ghp_${"A".repeat(30)}`) === "github-token" &&
    detectRestrictedData(`sk-${"a".repeat(20)}`) === "provider-api-key" &&
    detectRestrictedData("api_key=fictional_value_1234") ===
      "assigned-credential" &&
    detectRestrictedData("ordinary synthetic text") === null
  );
}

function candidatesHaveValidBoundaries(
  candidates: readonly EntityCandidate[],
): boolean {
  const items = new Map(ITEMS.map((item) => [item.id, item.content]));
  return candidates.every((entry) => {
    const content = items.get(entry.itemId);
    if (content === undefined || entry.contentSha256 !== sha256(content))
      return false;
    const boundaries = utf8Boundaries(content);
    return (
      entry.byteStart >= 0 &&
      entry.byteStart < entry.byteEnd &&
      entry.byteEnd <= Buffer.byteLength(content, "utf8") &&
      boundaries.has(entry.byteStart) &&
      boundaries.has(entry.byteEnd)
    );
  });
}

function utf8Boundaries(value: string): ReadonlySet<number> {
  const result = new Set<number>([0]);
  let bytes = 0;
  for (const character of value) {
    bytes += Buffer.byteLength(character, "utf8");
    result.add(bytes);
  }
  return result;
}

function validIpv4(value: string): boolean {
  return value.split(".").every((part) => {
    const numeric = Number(part);
    return Number.isInteger(numeric) && numeric >= 0 && numeric <= 255;
  });
}

function hasTokenBoundaries(
  value: string,
  characterStart: number,
  characterEnd: number,
): boolean {
  const selected = value.slice(characterStart, characterEnd);
  const first = Array.from(selected)[0];
  const last = Array.from(selected).at(-1);
  const previous = Array.from(value.slice(0, characterStart)).at(-1);
  const next = Array.from(value.slice(characterEnd))[0];
  return !(
    (first !== undefined &&
      token(first) &&
      previous !== undefined &&
      token(previous)) ||
    (last !== undefined && token(last) && next !== undefined && token(next))
  );
}

function token(value: string): boolean {
  return /[\p{L}\p{M}\p{N}_]/u.test(value);
}

function isWellFormedUtf8(value: string): boolean {
  return Buffer.from(value, "utf8").toString("utf8") === value;
}

function truth(
  itemId: string,
  entityType: EntityType,
  selected: string,
  occurrence = 0,
): GroundTruth {
  const item = ITEMS.find((entry) => entry.id === itemId);
  if (item === undefined) throw new Error("Invalid frozen corpus item.");
  let characterStart = -1;
  let cursor = 0;
  for (let index = 0; index <= occurrence; index += 1) {
    characterStart = item.content.indexOf(selected, cursor);
    cursor = characterStart + selected.length;
  }
  if (characterStart < 0) throw new Error("Invalid frozen corpus selection.");
  const characterEnd = characterStart + selected.length;
  return Object.freeze({
    itemId,
    entityType,
    byteStart: Buffer.byteLength(item.content.slice(0, characterStart), "utf8"),
    byteEnd: Buffer.byteLength(item.content.slice(0, characterEnd), "utf8"),
  });
}

function score(
  truePositive: number,
  falsePositive: number,
  falseNegative: number,
): Score {
  return Object.freeze({
    truePositive,
    falsePositive,
    falseNegative,
    precisionPercent: percentage(truePositive, truePositive + falsePositive),
    recallPercent: percentage(truePositive, truePositive + falseNegative),
  });
}

function percentage(numerator: number, denominator: number): number {
  return denominator === 0
    ? 0
    : Number(((numerator / denominator) * 100).toFixed(2));
}

function candidateKey(value: EntityCandidate): string {
  return `${value.itemId}\u0000${value.entityType}\u0000${value.byteStart}\u0000${value.byteEnd}`;
}

function truthKey(value: GroundTruth): string {
  return `${value.itemId}\u0000${value.entityType}\u0000${value.byteStart}\u0000${value.byteEnd}`;
}

function compareCandidate(
  left: EntityCandidate,
  right: EntityCandidate,
): number {
  return (
    compareText(left.itemId, right.itemId) ||
    left.byteStart - right.byteStart ||
    left.byteEnd - right.byteEnd ||
    compareText(left.entityType, right.entityType) ||
    compareText(left.reasonCode, right.reasonCode)
  );
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonicalDigest(value: unknown): string {
  return sha256(JSON.stringify(value));
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function invalid(cause?: unknown): EntityCandidateError {
  return new EntityCandidateError(cause === undefined ? undefined : { cause });
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const report = evaluateEntityCandidateDiscovery();
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
