import type { IncomingMessage, ServerResponse } from "node:http";
import type { GuiApplication } from "./application.ts";
import { json, readJson, record, reject } from "./http-plumbing.ts";
import type { MutationGuard } from "./restart-point-route.ts";
import type {
  ContinuationConfiguration,
  ContinuationReviewInput,
} from "./continuation-workflow.ts";
import type { EntityAliasEntry } from "@ai-workspace/privacy-gateway";

const source = (value: unknown) =>
  record(value) &&
  typeof value.path === "string" &&
  (value.expectedDigest === undefined ||
    typeof value.expectedDigest === "string");
export async function handleContinuationRoute(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  app: GuiApplication,
  authorizeWrite: MutationGuard,
): Promise<boolean> {
  const match =
    /^\/api\/conversations\/([^/]+)\/continuation(?:\/(configure|propose|protect|response))?$/u.exec(
      url.pathname,
    );
  if (!match) return false;
  const query = {
    conversationId: decodeURIComponent(match[1]!),
    projectId: url.searchParams.get("project"),
  };
  try {
    if (request.method === "GET" && !match[2]) {
      json(response, 200, await app.continuations.open(query));
      return true;
    }
    if (request.method !== "POST" || !match[2]) return false;
    if (!authorizeWrite(request)) {
      reject(
        response,
        403,
        "The local request failed origin or CSRF validation.",
      );
      return true;
    }
    const body = await readJson(request);
    if (!record(body)) throw new Error("INVALID_INPUT");
    if (match[2] === "configure") {
      if (
        Object.keys(body).some(
          (key) =>
            ![
              "label",
              "model",
              "profile",
              "policy",
              "bundles",
              "task",
            ].includes(key),
        ) ||
        typeof body.label !== "string" ||
        typeof body.model !== "string" ||
        !source(body.profile) ||
        !source(body.policy) ||
        !Array.isArray(body.bundles) ||
        !body.bundles.every(source) ||
        (body.task !== undefined && typeof body.task !== "string")
      )
        throw new Error("INVALID_INPUT");
      json(
        response,
        200,
        await app.continuations.configure(query, {
          ...body,
          destinationId: "configured-external-recipient",
        } as ContinuationConfiguration),
      );
    } else if (match[2] === "propose") {
      if (
        Object.keys(body).some(
          (key) => !["question", "aliases"].includes(key),
        ) ||
        typeof body.question !== "string" ||
        !Array.isArray(body.aliases) ||
        !body.aliases.every(
          (entry) =>
            record(entry) &&
            typeof entry.alias === "string" &&
            ["CUSTOMER", "PROJECT"].includes(String(entry.entityType)),
        )
      )
        throw new Error("INVALID_INPUT");
      json(
        response,
        200,
        await app.continuations.propose(
          query,
          body.question,
          body.aliases as readonly EntityAliasEntry[],
        ),
      );
    } else {
      if (
        Object.keys(body).some(
          (key) =>
            !["proposal", "selected", "manual", "passphrase"].includes(key),
        ) ||
        typeof body.proposal !== "string" ||
        !Array.isArray(body.selected) ||
        !body.selected.every(Number.isInteger) ||
        !Array.isArray(body.manual) ||
        !body.manual.every(
          (entry) =>
            record(entry) &&
            Number.isInteger(entry.item) &&
            Number.isInteger(entry.start) &&
            Number.isInteger(entry.end),
        ) ||
        typeof body.passphrase !== "string"
      )
        throw new Error("INVALID_INPUT");
      json(
        response,
        200,
        await app.continuations.protect(query, body as ContinuationReviewInput),
      );
    }
  } catch {
    reject(
      response,
      400,
      "The local continuation could not be prepared.",
      "Review the configuration and current summary, then prepare again. Nothing was sent.",
    );
  }
  return true;
}
