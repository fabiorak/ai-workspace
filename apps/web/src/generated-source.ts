/**
 * The source label of an answer stored in a project conversation. Model
 * deliveries keep the label they always had; agent answers are labelled by
 * their class (ADR-0049), so the class survives in the canonical history.
 * `MODEL_CONVERSATION` without a name is the earlier continuation label.
 */
const PREFIXES = Object.freeze({
  MODEL_DELIVERY: "MODEL_CONVERSATION:",
  AGENT_EXECUTION: "AGENT_EXECUTION:",
} as const);

export type GeneratedExecutionClass = keyof typeof PREFIXES;

export function generatedSourceType(
  executionClass: GeneratedExecutionClass,
  displayName: string,
): string {
  return `${PREFIXES[executionClass]}${displayName}`;
}

/** A generated answer's class and speaker, or null for imported material. */
export function generatedSource(sourceType: string): Readonly<{
  executionClass: GeneratedExecutionClass;
  speaker: string | null;
}> | null {
  if (sourceType === "MODEL_CONVERSATION")
    return { executionClass: "MODEL_DELIVERY", speaker: null };
  for (const [executionClass, prefix] of Object.entries(PREFIXES))
    if (sourceType.startsWith(prefix))
      return {
        executionClass: executionClass as GeneratedExecutionClass,
        speaker: sourceType.slice(prefix.length),
      };
  return null;
}
