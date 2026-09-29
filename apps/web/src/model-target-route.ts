import type { IncomingMessage, ServerResponse } from "node:http";

import {
  ModelTargetError,
  type ClassifiedModelTarget,
} from "@ai-workspace/model-targets";

import type { GuiApplication } from "./application.ts";
import { json, readJson, record, reject } from "./http-plumbing.ts";

type MutationGuard = (request: IncomingMessage) => boolean;

const CONVERSATION_TARGET = /^\/api\/conversations\/([^/]+)\/model-target$/u;

export async function handleModelTargetRoute(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  application: GuiApplication,
  authorizeWrite: MutationGuard,
): Promise<boolean> {
  const conversation = CONVERSATION_TARGET.exec(url.pathname);
  const targetPath = url.pathname === "/api/model-targets";
  const configurationPath = url.pathname === "/api/model-targets/configuration";
  const defaultPath = url.pathname === "/api/model-targets/default";
  if (!conversation && !targetPath && !configurationPath && !defaultPath)
    return false;
  try {
    if (request.method === "GET") {
      if (conversation) {
        const scope = await requireConversation(
          application,
          conversation[1]!,
          url.searchParams.get("project"),
        );
        const [view, resolved] = await Promise.all([
          application.modelTargets.view(),
          application.modelTargets.resolve(scope),
        ]);
        json(response, 200, {
          revision: view.revision,
          selected:
            resolved === null
              ? null
              : {
                  targetId: resolved.target.targetId,
                  displayName: resolved.target.displayName,
                  selectedBy: resolved.selectedBy,
                },
        });
      } else if (configurationPath)
        json(response, 200, await application.modelTargets.inspect());
      else if (targetPath)
        json(response, 200, await application.modelTargets.view());
      else return false;
      return true;
    }
    if (request.method !== "POST") return false;
    if (!authorizeWrite(request)) {
      reject(
        response,
        403,
        "The local request failed origin or CSRF validation.",
      );
      return true;
    }
    const body = await readJson(request);
    if (!record(body) || !Number.isSafeInteger(body.expectedRevision)) {
      reject(
        response,
        400,
        "Reload model settings and retry the bounded change.",
      );
      return true;
    }
    if (conversation) {
      if (
        typeof body.targetId !== "string" ||
        Object.keys(body).some(
          (key) => !["targetId", "expectedRevision"].includes(key),
        )
      ) {
        reject(response, 400, "Choose one available model target.");
        return true;
      }
      const scope = await requireConversation(
        application,
        conversation[1]!,
        url.searchParams.get("project"),
      );
      await application.modelTargets.selectConversation(
        scope.conversationId,
        scope.projectId,
        body.targetId,
        Number(body.expectedRevision),
      );
      const resolved = await application.modelTargets.resolve(scope);
      json(response, 200, {
        revision: (await application.modelTargets.view()).revision,
        selected:
          resolved === null
            ? null
            : {
                targetId: resolved.target.targetId,
                displayName: resolved.target.displayName,
                selectedBy: resolved.selectedBy,
              },
      });
      return true;
    }
    if (defaultPath) {
      if (
        (body.targetId !== null && typeof body.targetId !== "string") ||
        Object.keys(body).some(
          (key) => !["targetId", "expectedRevision"].includes(key),
        )
      ) {
        reject(response, 400, "Choose one enabled default model target.");
        return true;
      }
      const updated = await application.modelTargets.selectDefault(
        body.targetId,
        Number(body.expectedRevision),
      );
      json(response, 200, updated);
      return true;
    }
    if (targetPath) {
      if (
        !record(body.target) ||
        Object.keys(body).some(
          (key) => !["target", "expectedRevision"].includes(key),
        )
      ) {
        reject(
          response,
          400,
          "Complete the bounded model target configuration.",
        );
        return true;
      }
      const updated = await application.modelTargets.configure(
        body.target as unknown as ClassifiedModelTarget,
        Number(body.expectedRevision),
      );
      json(response, 200, updated);
      return true;
    }
  } catch (error) {
    if (error instanceof ModelTargetError)
      reject(
        response,
        400,
        error.message,
        "Reload model settings, correct the selected target, and retry.",
      );
    else
      reject(
        response,
        500,
        "Model targets could not be read or changed.",
        "Check local workspace permissions and configuration integrity, then retry.",
      );
    return true;
  }
  return false;
}

async function requireConversation(
  application: GuiApplication,
  encodedId: string,
  projectId: string | null,
) {
  const id = decodeURIComponent(encodedId);
  const value = await application.conversations.open({ id, projectId });
  if (value === null)
    throw new ModelTargetError("That conversation is no longer here.");
  return { conversationId: value.id, projectId: value.projectId };
}
