export const INSTRUCTION_BUNDLE_SCHEMA_VERSION = 1;
export type InstructionScope =
  "GLOBAL" | "WORKSPACE" | "PROJECT" | "MODEL" | "AGENT" | "TASK";
export type InstructionRuleKind = "CONSTRAINT" | "PREFERENCE";
export type InstructionSourceTrust = "USER_CONFIGURED";

export type InstructionRule = Readonly<{
  id: string;
  kind: InstructionRuleKind;
  overridable: boolean;
  content: string;
  position: number;
}>;
export type InstructionSource = Readonly<{
  id: string;
  projectId: string;
  scope: InstructionScope;
  target: string | null;
  trust: InstructionSourceTrust;
  sourceDigest: string;
  rules: readonly InstructionRule[];
}>;
export type InstructionBundle = Readonly<{
  schemaVersion: 1;
  projectId: string;
  sources: readonly InstructionSource[];
}>;
export type CompositionTarget = Readonly<{
  projectId: string;
  model?: string;
  agent?: string;
  task?: string;
}>;

export class InstructionError extends Error {
  public constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "InstructionError";
  }
}

const MAX_SOURCES = 50;
const MAX_RULES_PER_SOURCE = 100;
const MAX_ID = 256;
const MAX_CONTENT = 8_192;
const DIGEST = /^[a-f0-9]{64}$/u;
const SCOPES = new Set<InstructionScope>([
  "GLOBAL",
  "WORKSPACE",
  "PROJECT",
  "MODEL",
  "AGENT",
  "TASK",
]);

export function validateInstructionBundle(value: unknown): InstructionBundle {
  if (
    !isRecord(value) ||
    value.schemaVersion !== INSTRUCTION_BUNDLE_SCHEMA_VERSION ||
    !bounded(value.projectId, MAX_ID) ||
    !Array.isArray(value.sources) ||
    value.sources.length < 1 ||
    value.sources.length > MAX_SOURCES
  )
    throw malformed();
  const sourceIds = new Set<string>();
  const sources = value.sources.map((candidate) => {
    if (
      !isRecord(candidate) ||
      !bounded(candidate.id, MAX_ID) ||
      sourceIds.has(candidate.id) ||
      candidate.projectId !== value.projectId ||
      !SCOPES.has(candidate.scope as InstructionScope) ||
      candidate.trust !== "USER_CONFIGURED" ||
      typeof candidate.sourceDigest !== "string" ||
      !DIGEST.test(candidate.sourceDigest) ||
      !validTarget(candidate.scope, candidate.target) ||
      !Array.isArray(candidate.rules) ||
      candidate.rules.length < 1 ||
      candidate.rules.length > MAX_RULES_PER_SOURCE
    )
      throw malformed();
    sourceIds.add(candidate.id);
    const positions = new Set<number>();
    const rules = candidate.rules.map((rule) => {
      if (
        !isRecord(rule) ||
        !bounded(rule.id, MAX_ID) ||
        (rule.kind !== "CONSTRAINT" && rule.kind !== "PREFERENCE") ||
        rule.overridable !== (rule.kind === "PREFERENCE") ||
        !bounded(rule.content, MAX_CONTENT) ||
        !Number.isSafeInteger(rule.position) ||
        Number(rule.position) < 0 ||
        positions.has(Number(rule.position))
      )
        throw malformed();
      positions.add(Number(rule.position));
      return Object.freeze({
        id: rule.id,
        kind: rule.kind,
        overridable: rule.overridable,
        content: rule.content,
        position: rule.position,
      }) as InstructionRule;
    });
    return Object.freeze({
      id: candidate.id,
      projectId: candidate.projectId,
      scope: candidate.scope,
      target: candidate.target,
      trust: candidate.trust,
      sourceDigest: candidate.sourceDigest,
      rules: Object.freeze(rules),
    }) as InstructionSource;
  });
  return Object.freeze({
    schemaVersion: INSTRUCTION_BUNDLE_SCHEMA_VERSION,
    projectId: value.projectId,
    sources: Object.freeze(sources),
  });
}

function validTarget(scope: unknown, target: unknown): boolean {
  return scope === "MODEL" || scope === "AGENT" || scope === "TASK"
    ? bounded(target, MAX_ID)
    : target === null;
}
function bounded(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= max;
}
function malformed(): InstructionError {
  return new InstructionError(
    "The instruction bundle is malformed, unsupported, oversized, or cross-project. Fix the explicit synthetic bundle and retry.",
  );
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
