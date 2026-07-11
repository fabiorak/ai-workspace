import {
  InstructionError,
  type CompositionTarget,
  type InstructionBundle,
  type InstructionRule,
  type InstructionScope,
  type InstructionSource,
  validateInstructionBundle,
} from "./model.ts";

export type EffectiveRuleStatus =
  "ACTIVE" | "OVERRIDDEN" | "REJECTED" | "EXCLUDED";
export type EffectiveRuleReason =
  | "HIGHEST_PRECEDENCE"
  | "NON_OVERRIDABLE_CONSTRAINT"
  | "OVERRIDDEN_BY_HIGHER_SCOPE"
  | "DUPLICATE_CONSTRAINT"
  | "FORBIDDEN_CONSTRAINT_OVERRIDE"
  | "TARGET_NOT_SELECTED"
  | "TARGET_MISMATCH";
export type RuleReference = Readonly<{
  sourceId: string;
  ruleId: string;
  position: number;
}>;
export type EffectiveInstructionRule = Readonly<{
  sourceId: string;
  sourceDigest: string;
  sourceTrust: "USER_CONFIGURED";
  scope: InstructionScope;
  target: string | null;
  ruleId: string;
  kind: InstructionRule["kind"];
  overridable: boolean;
  content: string;
  position: number;
  status: EffectiveRuleStatus;
  reason: EffectiveRuleReason;
  supersedingRule: RuleReference | null;
}>;
export type EffectiveInstructions = Readonly<{
  schemaVersion: 1;
  projectId: string;
  target: Readonly<{
    model: string | null;
    agent: string | null;
    task: string | null;
  }>;
  enforcement: "DESCRIPTIVE_INSTRUCTIONS_NOT_RUNTIME_POLICY";
  rules: readonly EffectiveInstructionRule[];
}>;

const RANK: Readonly<Record<InstructionScope, number>> = {
  GLOBAL: 0,
  WORKSPACE: 1,
  PROJECT: 2,
  MODEL: 3,
  AGENT: 4,
  TASK: 5,
};

type Candidate = Readonly<{
  source: InstructionSource;
  rule: InstructionRule;
  included: boolean;
  excludedReason: "TARGET_NOT_SELECTED" | "TARGET_MISMATCH" | null;
}>;

export function composeInstructions(
  bundleValue: unknown,
  targetValue: CompositionTarget,
): EffectiveInstructions {
  const bundle = validateInstructionBundle(bundleValue);
  const target = validateTarget(targetValue, bundle);
  const candidates = orderedCandidates(bundle, target);
  const included = candidates.filter((candidate) => candidate.included);
  const kinds = new Map<string, InstructionRule["kind"]>();
  for (const candidate of included) {
    const existing = kinds.get(candidate.rule.id);
    if (existing !== undefined && existing !== candidate.rule.kind)
      throw new InstructionError(
        `Instruction rule '${candidate.rule.id}' conflicts between CONSTRAINT and PREFERENCE. Rename the rules or fix the explicit bundle.`,
      );
    kinds.set(candidate.rule.id, candidate.rule.kind);
  }
  const decisions = new Map<Candidate, EffectiveInstructionRule>();
  for (const candidate of candidates)
    if (!candidate.included)
      decisions.set(
        candidate,
        effective(candidate, "EXCLUDED", candidate.excludedReason!, null),
      );
  decideConstraints(included, decisions);
  decidePreferences(included, decisions);
  return Object.freeze({
    schemaVersion: 1,
    projectId: bundle.projectId,
    target: Object.freeze({
      model: target.model ?? null,
      agent: target.agent ?? null,
      task: target.task ?? null,
    }),
    enforcement: "DESCRIPTIVE_INSTRUCTIONS_NOT_RUNTIME_POLICY",
    rules: Object.freeze(
      candidates.map((candidate) => decisions.get(candidate)!),
    ),
  });
}

export function encodeEffectiveInstructions(value: EffectiveInstructions) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function decideConstraints(
  candidates: readonly Candidate[],
  decisions: Map<Candidate, EffectiveInstructionRule>,
) {
  const groups = group(
    candidates.filter((candidate) => candidate.rule.kind === "CONSTRAINT"),
  );
  for (const values of groups.values()) {
    const active = values[0]!;
    decisions.set(
      active,
      effective(active, "ACTIVE", "NON_OVERRIDABLE_CONSTRAINT", null),
    );
    for (const candidate of values.slice(1))
      decisions.set(
        candidate,
        effective(
          candidate,
          "REJECTED",
          candidate.rule.content === active.rule.content
            ? "DUPLICATE_CONSTRAINT"
            : "FORBIDDEN_CONSTRAINT_OVERRIDE",
          reference(active),
        ),
      );
  }
}

function decidePreferences(
  candidates: readonly Candidate[],
  decisions: Map<Candidate, EffectiveInstructionRule>,
) {
  const groups = group(
    candidates.filter((candidate) => candidate.rule.kind === "PREFERENCE"),
  );
  for (const [id, values] of groups) {
    const highestRank = Math.max(
      ...values.map((value) => RANK[value.source.scope]),
    );
    const highest = values.filter(
      (value) => RANK[value.source.scope] === highestRank,
    );
    if (highest.length !== 1)
      throw new InstructionError(
        `Instruction preference '${id}' is ambiguous at the same highest scope. Remove the duplicate or choose one explicit source.`,
      );
    const active = highest[0]!;
    decisions.set(
      active,
      effective(active, "ACTIVE", "HIGHEST_PRECEDENCE", null),
    );
    for (const candidate of values)
      if (candidate !== active)
        decisions.set(
          candidate,
          effective(
            candidate,
            "OVERRIDDEN",
            "OVERRIDDEN_BY_HIGHER_SCOPE",
            reference(active),
          ),
        );
  }
}

function orderedCandidates(
  bundle: InstructionBundle,
  target: CompositionTarget,
): readonly Candidate[] {
  const sources = [...bundle.sources].sort(
    (a, b) =>
      RANK[a.scope] - RANK[b.scope] ||
      (a.target ?? "").localeCompare(b.target ?? "") ||
      a.id.localeCompare(b.id) ||
      a.sourceDigest.localeCompare(b.sourceDigest),
  );
  return sources.flatMap((source) => {
    const excludedReason = targetReason(source, target);
    return [...source.rules]
      .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
      .map((rule) => ({
        source,
        rule,
        included: excludedReason === null,
        excludedReason,
      }));
  });
}

function targetReason(
  source: InstructionSource,
  target: CompositionTarget,
): Candidate["excludedReason"] {
  const selected =
    source.scope === "MODEL"
      ? target.model
      : source.scope === "AGENT"
        ? target.agent
        : source.scope === "TASK"
          ? target.task
          : source.target;
  if (source.target === null) return null;
  if (selected === undefined) return "TARGET_NOT_SELECTED";
  return selected === source.target ? null : "TARGET_MISMATCH";
}

function validateTarget(
  value: CompositionTarget,
  bundle: InstructionBundle,
): CompositionTarget {
  if (value.projectId !== bundle.projectId)
    throw new InstructionError(
      "Composition target and instruction bundle must use the same explicit project.",
    );
  for (const selected of [value.model, value.agent, value.task])
    if (selected !== undefined && (!selected.trim() || selected.length > 256))
      throw new InstructionError(
        "Composition target selectors must contain from 1 to 256 characters.",
      );
  return value;
}
function group(candidates: readonly Candidate[]) {
  const result = new Map<string, Candidate[]>();
  for (const candidate of candidates)
    result.set(candidate.rule.id, [
      ...(result.get(candidate.rule.id) ?? []),
      candidate,
    ]);
  return result;
}
function reference(candidate: Candidate): RuleReference {
  return Object.freeze({
    sourceId: candidate.source.id,
    ruleId: candidate.rule.id,
    position: candidate.rule.position,
  });
}
function effective(
  candidate: Candidate,
  status: EffectiveRuleStatus,
  reason: EffectiveRuleReason,
  supersedingRule: RuleReference | null,
): EffectiveInstructionRule {
  return Object.freeze({
    sourceId: candidate.source.id,
    sourceDigest: candidate.source.sourceDigest,
    sourceTrust: candidate.source.trust,
    scope: candidate.source.scope,
    target: candidate.source.target,
    ruleId: candidate.rule.id,
    kind: candidate.rule.kind,
    overridable: candidate.rule.overridable,
    content: candidate.rule.content,
    position: candidate.rule.position,
    status,
    reason,
    supersedingRule,
  });
}
