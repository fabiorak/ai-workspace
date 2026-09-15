import type { DeliveryTransport } from "@ai-workspace/model-delivery";
import { continuationEvidence } from "./continuation-evidence.ts";
import { ContinuationWorkflow } from "./continuation-workflow.ts";
import type { PrivacyDecisionAudit } from "@ai-workspace/privacy-audit";
import type { ModelConversationWriter } from "./model-conversation.ts";
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
  conversationWriter?: ModelConversationWriter,
  transport?: DeliveryTransport,
) {
  const sources = continuationSources(conversations, handoffs);
  const workflow = new ContinuationWorkflow(
    sources,
    home,
    audit,
    conversationWriter,
    transport,
  );
  return Object.freeze({
    open: workflow.open.bind(workflow),
    send: workflow.send.bind(workflow),
    configure: workflow.configure.bind(workflow),
    propose: workflow.propose.bind(workflow),
    protect: workflow.protect.bind(workflow),
    recordResponse: workflow.recordResponse.bind(workflow),
    prepare: (query: ContinuationQuery, target: ContinuationTarget | null) =>
      prepareContinuation(sources, query, target),
  });
}

export function continuationSources(
  conversations: ConversationSources,
  handoffs: Pick<Handoffs, "list" | "show" | "validateRepository">,
) {
  return Object.freeze({
    sessions: conversations.sessions,
    workItems: conversations.workItems,
    handoffs: {
      list: handoffs.list.bind(handoffs),
      show: handoffs.show.bind(handoffs),
      validateRepository: handoffs.validateRepository.bind(handoffs),
    },
    compose: composeHandoffProfile,
    evidence: (work: Parameters<typeof continuationEvidence>[1]) =>
      continuationEvidence(conversations, work),
  });
}
