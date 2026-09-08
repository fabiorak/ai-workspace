import {
  buildContextPack,
  expandContextPack,
} from "@ai-workspace/context-builder";
import type { Handoff } from "@ai-workspace/handoff";
import { composeProfileInstructions } from "@ai-workspace/instruction-manager";
import {
  LocalAgentProfileReader,
  LocalInstructionBundleReader,
} from "@ai-workspace/local-instructions";
import type { GuiProfileContextPreviewInput } from "./view-models.ts";

export type ProfileContextTarget = Omit<
  GuiProfileContextPreviewInput,
  "projectId" | "workItemId" | "handoffId"
>;

/** Compose the same reviewed profile for technical previews and continuation. */
export async function composeHandoffProfile(
  handoff: Handoff,
  target: ProfileContextTarget,
) {
  const [profile, bundle] = await Promise.all([
    new LocalAgentProfileReader().read(handoff.projectId, target.profile),
    new LocalInstructionBundleReader().read(handoff.projectId, target.bundles),
  ]);
  const composition = composeProfileInstructions(profile.bundle, bundle, {
    model: target.model,
    ...(target.task === undefined ? {} : { task: target.task }),
  });
  const contextPack = buildContextPack({
    handoff,
    instructions: composition.instructions,
    budgets: composition.selection.budgets,
  });
  return Object.freeze({
    profile,
    ...composition,
    contextPack,
    expandedContextPack: expandContextPack(contextPack),
  });
}
