/**
 * Local adapters behind the conversational facade.
 *
 * Handoffs are resolved lazily because the composition root constructs that
 * domain service after the stores used by both areas. The rest of the app sees
 * the narrow read contract and cannot reach unrelated handoff operations.
 */
import type { ArtifactReader } from "./moment-text.ts";
import type { ConversationSources } from "./conversations.ts";

import { LocalSessionReader } from "@ai-workspace/local-session-ingestion";

type LocalConversationSourceDependencies = Readonly<{
  workspaceHome: string;
  artifact: ArtifactReader;
  projects: Readonly<{
    load(): Promise<readonly Readonly<{ id: string; name: string }>[]>;
  }>;
  notes: ConversationSources["notes"];
  workItems: ConversationSources["workItems"];
  handoffs(): NonNullable<ConversationSources["handoffs"]>;
}>;

export function localConversationSources(
  dependencies: LocalConversationSourceDependencies,
): ConversationSources {
  return Object.freeze({
    artifact: dependencies.artifact,
    projects: async () =>
      (await dependencies.projects.load()).map((project) =>
        Object.freeze({ id: project.id, name: project.name }),
      ),
    sessions: new LocalSessionReader(dependencies.workspaceHome),
    notes: dependencies.notes,
    workItems: dependencies.workItems,
    handoffs: {
      list: (projectId, workItemId) =>
        dependencies.handoffs().list(projectId, workItemId),
    },
  });
}
