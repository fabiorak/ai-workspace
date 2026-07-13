import type { Handoff } from "@ai-workspace/handoff";
import type { EffectiveInstructions } from "@ai-workspace/instruction-manager";
import { CONTINUITY_SECTION_ORDER } from "./sections.ts";

export { CONTINUITY_SECTION_ORDER } from "./sections.ts";

export const CONTEXT_PACK_SCHEMA_VERSION = 1;
export type ContextCategory = "CONTINUITY" | "INSTRUCTIONS";
export type ContextItem = Readonly<{
  id: string;
  category: ContextCategory;
  sourceType: "HANDOFF_SECTION" | "INSTRUCTION_RULE";
  sourceId: string;
  trust: "MIXED" | "USER_CONFIGURED";
  content: string;
  exactBytes: number;
}>;
export type ContextOmission = Readonly<{
  id: string;
  category: ContextCategory;
  sourceId: string;
  exactBytes: number;
  reason: "BUDGET_EXCEEDED";
}>;
export type ContextPackPreview = Readonly<{
  schemaVersion: 1;
  projectId: string;
  workItemId: string;
  handoffId: string;
  budgets: Readonly<Record<ContextCategory, number>>;
  usedBytes: Readonly<Record<ContextCategory, number>>;
  included: readonly ContextItem[];
  omitted: readonly ContextOmission[];
  measurement: Readonly<{
    exactIncludedBytes: number;
    estimatedTokens: number;
    estimateMethod: "CEIL_EXACT_INCLUDED_BYTES_DIVIDED_BY_4";
  }>;
  effect: "READ_ONLY_NOT_PERSISTED_OR_EXECUTED";
}>;
export type BuildContextPackInput = Readonly<{
  handoff: Handoff;
  instructions?: EffectiveInstructions;
  budgets: Readonly<Record<ContextCategory, number>>;
}>;

const MAX_BUDGET = 1_000_000;
export class ContextBuilderError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ContextBuilderError";
  }
}

export function buildContextPack(
  input: BuildContextPackInput,
): ContextPackPreview {
  validateBudget(input.budgets.CONTINUITY, "CONTINUITY");
  validateBudget(input.budgets.INSTRUCTIONS, "INSTRUCTIONS");
  if (
    input.instructions !== undefined &&
    input.instructions.projectId !== input.handoff.projectId
  )
    throw new ContextBuilderError(
      "Context inputs must belong to the same explicit project.",
    );
  const candidates: Omit<ContextItem, "exactBytes">[] =
    CONTINUITY_SECTION_ORDER.map((section) => ({
      id: `handoff:${section}`,
      category: "CONTINUITY",
      sourceType: "HANDOFF_SECTION",
      sourceId: input.handoff.id,
      trust: "MIXED",
      content: JSON.stringify(input.handoff.sections[section]),
    }));
  for (const rule of input.instructions?.rules ?? [])
    candidates.push({
      id: `instruction:${rule.sourceId}:${rule.position}:${rule.ruleId}`,
      category: "INSTRUCTIONS",
      sourceType: "INSTRUCTION_RULE",
      sourceId: `${rule.sourceId}@sha256:${rule.sourceDigest}`,
      trust: "USER_CONFIGURED",
      content: JSON.stringify(rule),
    });
  const ids = new Set<string>();
  const used = { CONTINUITY: 0, INSTRUCTIONS: 0 };
  const included: ContextItem[] = [];
  const omitted: ContextOmission[] = [];
  for (const candidate of candidates) {
    if (ids.has(candidate.id))
      throw new ContextBuilderError("Context item identities must be unique.");
    ids.add(candidate.id);
    const exactBytes = Buffer.byteLength(candidate.content, "utf8");
    const item = Object.freeze({ ...candidate, exactBytes });
    if (
      used[candidate.category] + exactBytes <=
      input.budgets[candidate.category]
    ) {
      used[candidate.category] += exactBytes;
      included.push(item);
    } else
      omitted.push(
        Object.freeze({
          id: candidate.id,
          category: candidate.category,
          sourceId: candidate.sourceId,
          exactBytes,
          reason: "BUDGET_EXCEEDED" as const,
        }),
      );
  }
  const exactIncludedBytes = used.CONTINUITY + used.INSTRUCTIONS;
  return Object.freeze({
    schemaVersion: CONTEXT_PACK_SCHEMA_VERSION,
    projectId: input.handoff.projectId,
    workItemId: input.handoff.workItemId,
    handoffId: input.handoff.id,
    budgets: Object.freeze({ ...input.budgets }),
    usedBytes: Object.freeze(used),
    included: Object.freeze(included),
    omitted: Object.freeze(omitted),
    measurement: Object.freeze({
      exactIncludedBytes,
      estimatedTokens: Math.ceil(exactIncludedBytes / 4),
      estimateMethod: "CEIL_EXACT_INCLUDED_BYTES_DIVIDED_BY_4",
    }),
    effect: "READ_ONLY_NOT_PERSISTED_OR_EXECUTED",
  });
}

function validateBudget(value: number, category: ContextCategory) {
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_BUDGET)
    throw new ContextBuilderError(
      `${category} budget must be an integer from 1 to ${MAX_BUDGET} exact UTF-8 bytes.`,
    );
}

export * from "./measurement.ts";
export * from "./continuity-disclosure.ts";
