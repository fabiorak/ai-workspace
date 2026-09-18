import type { IncomingMessage, ServerResponse } from "node:http";

import type { GuiApplication } from "./application.ts";
import { json, readJson, record } from "./http-plumbing.ts";

type MutationGuard = (request: IncomingMessage) => boolean;
const PATH = /^\/api\/conversations\/([^/]+)\/turn-preview$/u;

/**
 * Shows the exact payload the next turn would deliver, already protected.
 *
 * It is a write-guarded POST although it sends nothing, because composing the
 * preview may extend the local stable map: the placeholders a person reviews
 * here are the placeholders the later turn reuses. It records no audit event,
 * claims no attempt and reaches no transport. The browser names the conversation
 * and the selected target and nothing else; scope, key, map and paths stay here.
 */
export const TURN_PREVIEW_REFUSALS = Object.freeze([
  "LOCAL_GUARD",
  "REQUEST_INVALID",
  "SCOPE_UNAVAILABLE",
  "NOT_COMPOSED",
] as const);
export type TurnPreviewRefusal = (typeof TURN_PREVIEW_REFUSALS)[number];

function refuse(
  response: ServerResponse,
  status: number,
  reason: TurnPreviewRefusal,
  message: string,
  recovery: string,
) {
  return json(response, status, { reason, message, recovery });
}

export async function handleTurnPreviewRoute(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  application: GuiApplication,
  authorizeWrite: MutationGuard,
): Promise<boolean> {
  const match = PATH.exec(url.pathname);
  if (match === null || request.method !== "POST") return false;
  if (!authorizeWrite(request)) {
    refuse(
      response,
      403,
      "LOCAL_GUARD",
      "The local request failed origin or CSRF validation.",
      "Reload the local page, then preview the message again.",
    );
    return true;
  }
  const body = await readJson(request);
  if (
    !record(body) ||
    Object.keys(body).some((key) => !["targetId", "userText"].includes(key)) ||
    typeof body.targetId !== "string" ||
    typeof body.userText !== "string"
  ) {
    refuse(
      response,
      400,
      "REQUEST_INVALID",
      "Preview one bounded draft against one selected target.",
      "Keep the draft, choose a configured model, and retry.",
    );
    return true;
  }
  try {
    json(
      response,
      200,
      await application.conversationTurns.previewTurnPayload({
        conversationId: decodeURIComponent(match[1]!),
        targetId: body.targetId,
        userText: body.userText,
      }),
    );
  } catch (error) {
    const failure = error instanceof Error ? error.message : "";
    if (failure === "TURN_PREVIEW_INVALID")
      refuse(
        response,
        400,
        "REQUEST_INVALID",
        "Preview one bounded draft against one selected target.",
        "Keep the draft, choose a configured model, and retry.",
      );
    else if (failure === "CONVERSATION_SCOPE_UNAVAILABLE_OR_AMBIGUOUS")
      refuse(
        response,
        409,
        "SCOPE_UNAVAILABLE",
        "This conversation does not resolve to one local scope.",
        "Reopen the conversation from the list, then preview it again.",
      );
    else
      refuse(
        response,
        500,
        "NOT_COMPOSED",
        "The payload preview is unavailable, so nothing was shown or sent.",
        "Keep the draft, check local sources, and try again.",
      );
  }
  return true;
}
