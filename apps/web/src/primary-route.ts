import type { IncomingMessage, ServerResponse } from "node:http";

import type { GuiApplication } from "./application.ts";
import { handleConversationRoute } from "./conversation-route.ts";
import { handleModelTargetRoute } from "./model-target-route.ts";
import { handlePrivacyProtectionRoute } from "./privacy-protection-route.ts";

type MutationGuard = (request: IncomingMessage) => boolean;

/** Conversation reads and their server-owned target selection share one dispatch slot. */
export async function handlePrimaryRoute(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  application: GuiApplication,
  authorizeWrite: MutationGuard,
) {
  return (
    (await handlePrivacyProtectionRoute(
      request,
      response,
      url,
      application,
      authorizeWrite,
    )) ||
    (await handleModelTargetRoute(
      request,
      response,
      url,
      application,
      authorizeWrite,
    )) ||
    handleConversationRoute(request, response, url, application, authorizeWrite)
  );
}
