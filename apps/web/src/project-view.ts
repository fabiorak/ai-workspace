import type { RegisteredProject } from "@ai-workspace/project-registry";
import type { GuiProject } from "./view-models.ts";

export function projectView(project: RegisteredProject): GuiProject {
  return Object.freeze({
    id: project.id,
    name: project.name,
    repositoryType: project.repositoryType,
    branch: project.branch,
    headCommit: project.headCommit,
    isDirty: project.isDirty,
    registeredAt: project.registeredAt,
    lastInspectedAt: project.lastInspectedAt,
  });
}
