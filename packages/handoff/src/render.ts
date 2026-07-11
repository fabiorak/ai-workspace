import type { Handoff } from "./model.ts";
export function encodeHandoff(handoff: Handoff): string {
  return `${JSON.stringify(handoff, null, 2)}\n`;
}
export function renderHandoff(handoff: Handoff): string {
  const safe = (value: string) =>
    [...value]
      .map((character) => {
        const point = character.codePointAt(0) ?? 0;
        return (point < 32 && point !== 9 && point !== 10 && point !== 13) ||
          (point >= 127 && point <= 159)
          ? "�"
          : character;
      })
      .join("");
  const lines = [
    `Handoff ${handoff.id}`,
    `Project: ${handoff.projectId}`,
    `Work Item: ${handoff.workItemId}`,
    `Created: ${handoff.createdAt}`,
    "",
    `Objective [${handoff.sections.objective.metadata.trust}]:`,
    handoff.sections.objective.value,
    "",
    `Next action [${handoff.sections.nextAction.metadata.trust}]:`,
    handoff.sections.nextAction.value,
    "",
    `Selected memory: ${handoff.sections.selectedMemory.value.length}`,
    `Known failures: ${handoff.sections.knownFailures.value.length}`,
    `Relevant files: ${handoff.sections.relevantFiles.value.length}`,
    "",
    "Inspect sources:",
    ...handoff.sections.sourceReferences.value.map(
      (source) =>
        `ai-workspace history show --project ${JSON.stringify(handoff.projectId)} --session ${JSON.stringify(source.sessionId)} --event ${JSON.stringify(source.eventId)}`,
    ),
  ];
  return `${safe(lines.join("\n"))}\n`;
}
