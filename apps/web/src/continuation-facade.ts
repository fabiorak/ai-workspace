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
  return Object.freeze({
    prepare: (query: ContinuationQuery, target: ContinuationTarget | null) =>
      prepareContinuation(sources, query, target),
  });
}
