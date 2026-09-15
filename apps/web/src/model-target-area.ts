import { JsonModelTargetStore } from "@ai-workspace/local-model-targets";
import { ModelTargets } from "@ai-workspace/model-targets";

export function modelTargetArea(workspaceHome: string) {
  return new ModelTargets(new JsonModelTargetStore(workspaceHome));
}
