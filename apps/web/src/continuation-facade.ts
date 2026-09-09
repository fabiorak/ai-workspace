import { ContinuationWorkflow } from "./continuation-workflow.ts";
import type { PrivacyDecisionAudit } from "@ai-workspace/privacy-audit";
import type { Handoffs } from "@ai-workspace/handoff";
import type { ConversationSources } from "./conversations.ts";
import { composeHandoffProfile } from "./profile-context.ts";
import {
  prepareContinuation,
  type ContinuationQuery,
  type ContinuationTarget,
} from "./continuation-preparation.ts";

export function continuationArea(
  conversations: ConversationSources,
  handoffs: Handoffs,
  home: string,
  audit: PrivacyDecisionAudit,
) {
  const sources = {
    sessions: conversations.sessions,
    workItems: conversations.workItems,
    handoffs: {
      list: handoffs.list.bind(handoffs),
      show: handoffs.show.bind(handoffs),
      validateRepository: handoffs.validateRepository.bind(handoffs),
    },
    compose: composeHandoffProfile,
  };
  const workflow = new ContinuationWorkflow(sources, home, audit);
  return Object.freeze({
    open: workflow.open.bind(workflow),
    configure: workflow.configure.bind(workflow),
    propose: workflow.propose.bind(workflow),
    protect: workflow.protect.bind(workflow),
    prepare: (query: ContinuationQuery, target: ContinuationTarget | null) =>
      prepareContinuation(sources, query, target),
  });
}
