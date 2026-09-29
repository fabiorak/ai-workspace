import type { IncomingMessage, ServerResponse } from "node:http";

import {
  ConversationTurnConflictError,
  ConversationTurnError,
} from "@ai-workspace/conversation-turn";

import type { GuiApplication } from "./application.ts";
import { json, readJson, record, reject } from "./http-plumbing.ts";

type MutationGuard = (request: IncomingMessage) => boolean;
const PATH = /^\/api\/conversations\/([^/]+)\/turn$/u;

/** The ordinary composer has one mutation. Scope enrichment stays server-side. */
export async function handleConversationTurnRoute(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  application: GuiApplication,
  authorizeWrite: MutationGuard,
): Promise<boolean> {
  const match = PATH.exec(url.pathname);
  if (match === null || request.method !== "POST") return false;
  if (!authorizeWrite(request)) {
    reject(
      response,
      403,
      "The local request failed origin or CSRF validation.",
    );
    return true;
  }
  try {
    const body = await readJson(request);
    if (
      !record(body) ||
      Object.keys(body).some(
        (key) =>
          !["clientRequestId", "targetId", "userText", "reviewId"].includes(
            key,
          ),
      ) ||
      typeof body.clientRequestId !== "string" ||
      typeof body.targetId !== "string" ||
      typeof body.userText !== "string"
    ) {
      reject(response, 400, "Send one bounded message to the selected target.");
      return true;
    }
    json(
      response,
      200,
      await application.conversationTurns.run({
        conversationId: decodeURIComponent(match[1]!),
        projectId: url.searchParams.get("project"),
        targetId: body.targetId,
        userText: body.userText,
        clientRequestId: body.clientRequestId,
        ...(Object.hasOwn(body, "reviewId") ? { reviewId: body.reviewId } : {}),
      }),
    );
  } catch (error) {
    if (error instanceof ConversationTurnConflictError)
      reject(
        response,
        409,
        error.message,
        "Keep the current draft and send it with a new request identity.",
      );
    else if (error instanceof ConversationTurnError)
      reject(
        response,
        400,
        error.message,
        "Reload the conversation and target, then retry the unchanged draft.",
      );
    else
      reject(
        response,
        500,
        "The conversation turn could not be coordinated locally.",
        "Keep the draft, check local state integrity, and retry only before exposure.",
      );
  }
  return true;
}
