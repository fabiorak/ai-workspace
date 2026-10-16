import type { IncomingMessage, ServerResponse } from "node:http";

import { TargetConfigurationError } from "@ai-workspace/target-configuration";

import type { GuiApplication } from "./application.ts";
import { json, readJson, record, reject } from "./http-plumbing.ts";

type MutationGuard = (request: IncomingMessage) => boolean;

const SAVE_PATH = "/api/target-configurations";
const TARGET_PATH = /^\/api\/target-configurations\/([^/]+)$/u;

/**
 * Guided target configuration (ADR-0052). Saving writes immutable files and
 * returns their references; the target itself is saved through the unchanged
 * model-target route, so a failed target save never touches files in use.
 */
export async function handleTargetConfigurationRoute(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  application: GuiApplication,
  authorizeWrite: MutationGuard,
): Promise<boolean> {
  const targetPath = TARGET_PATH.exec(url.pathname);
  if (url.pathname !== SAVE_PATH && !targetPath) return false;
  try {
    if (targetPath && request.method === "GET") {
      const targetId = decodeURIComponent(targetPath[1]!);
      const target = (await application.modelTargets.inspect()).targets.find(
        (candidate) => candidate.targetId === targetId,
      );
      if (target === undefined) {
        reject(
          response,
          404,
          "That model target is no longer here.",
          "Reload model settings and choose a saved target.",
        );
        return true;
      }
      json(response, 200, {
        configuration:
          await application.modelTargets.configurations.recognize(target),
      });
      return true;
    }
    if (url.pathname !== SAVE_PATH || request.method !== "POST") return false;
    if (!authorizeWrite(request)) {
      reject(
        response,
        403,
        "The local request failed origin or CSRF validation.",
      );
      return true;
    }
    const body = await readJson(request);
    if (
      record(body) &&
      record(body.scope) &&
      body.scope.kind === "PROJECT" &&
      !(await application.listProjects()).some(
        (project) =>
          project.id === (body.scope as { projectId?: unknown }).projectId,
      )
    ) {
      reject(
        response,
        400,
        "Choose a registered project as the configuration scope.",
        "Register the project first, or choose General.",
      );
      return true;
    }
    const saved = await application.modelTargets.configurations.save(body);
    json(response, 200, {
      profileRef: saved.profileRef,
      policyRef: saved.policyRef,
      instructionRefs: saved.instructionRefs,
    });
    return true;
  } catch (error) {
    if (error instanceof TargetConfigurationError)
      reject(
        response,
        400,
        error.message,
        "Correct the guided configuration and retry.",
      );
    else
      reject(
        response,
        500,
        "The guided configuration could not be read or saved.",
        "Check local workspace permissions, then retry.",
      );
    return true;
  }
}
