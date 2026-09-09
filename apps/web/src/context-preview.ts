import {
  buildContextPack,
  expandContextPack,
} from "@ai-workspace/context-builder";
import type { Handoff, Handoffs } from "@ai-workspace/handoff";
import type { EffectiveInstructions } from "@ai-workspace/instruction-manager";
import type { GuiContextPreviewInput } from "./view-models.ts";

export function contextPreview(
  handoff: Handoff,
  instructions: EffectiveInstructions | undefined,
  input: GuiContextPreviewInput,
) {
  return expandContextPack(
    buildContextPack({
      handoff,
      ...(instructions === undefined ? {} : { instructions }),
      budgets: {
        CONTINUITY: input.continuityBudget,
        INSTRUCTIONS: input.instructionBudget,
      },
    }),
  );
}

export async function readContextPreview(
  handoffs: Pick<Handoffs, "show">,
  instructions: (
    input: GuiContextPreviewInput,
  ) => Promise<EffectiveInstructions>,
  input: GuiContextPreviewInput,
) {
  const handoff = await handoffs.show(
    input.projectId,
    input.workItemId,
    input.handoffId,
  );
  return contextPreview(
    handoff,
    input.bundles.length === 0 ? undefined : await instructions(input),
    input,
  );
}
