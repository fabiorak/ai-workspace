import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { APP_CSS, APP_JS, shellHtml } from "./assets.ts";
import { GuiApplication, GuiApplicationError } from "./application.ts";
import { dashboardFragmentHtml } from "./dashboard-view.ts";
import { handleConversationRoute } from "./conversation-route.ts";
import { handleHandoffPreviewRoute } from "./handoff-preview-route.ts";
import { handleTranscriptRoute } from "./transcript-route.ts";
import { resolveGuiLocale } from "./localization.ts";
import {
  COOKIE,
  authenticated,
  denied,
  json,
  loopback,
  optionalEnum,
  optionalLimit,
  optionalString,
  optionalStringArray,
  readJson,
  record,
  reject,
  secureHeaders,
  send,
  stringArray,
  validHost,
  validMutation,
} from "./http-plumbing.ts";
import {
  SESSION_EVENT_TYPES,
  type SessionEventType,
} from "@ai-workspace/session-ingestion";
import {
  MEMORY_ITEM_TYPES,
  MEMORY_VALIDITIES,
  MEMORY_VERIFICATIONS,
  type MemoryItemType,
  type MemoryValidity,
  type MemoryVerification,
} from "@ai-workspace/active-memory";

export type GuiServer = Readonly<{
  bootstrapUrl: string;
  origin: string;
  close(): Promise<void>;
}>;

export async function startGuiServer(
  application: GuiApplication,
  options: Readonly<{
    port?: number;
    bootstrapToken?: string;
    sessionToken?: string;
    csrfToken?: string;
  }> = {},
): Promise<GuiServer> {
  const bootstrapToken =
    options.bootstrapToken ?? randomBytes(32).toString("hex");
  const sessionToken = options.sessionToken ?? randomBytes(32).toString("hex");
  const csrfToken = options.csrfToken ?? randomBytes(32).toString("hex");
  let bootstrapAvailable = true;
  let authority = "";
  let origin = "";
  const server = createServer(async (request, response) => {
    secureHeaders(response);
    try {
      if (
        !loopback(request.socket.remoteAddress) ||
        !validHost(request.headers.host, authority)
      )
        return denied(
          request,
          response,
          403,
          "originBlockedMessage",
          "originBlockedRecovery",
        );
      const url = new URL(request.url ?? "/", origin);
      if (
        request.method === "GET" &&
        url.pathname === `/bootstrap/${bootstrapToken}`
      ) {
        if (!bootstrapAvailable)
          return denied(
            request,
            response,
            410,
            "bootstrapUsedMessage",
            "bootstrapUsedRecovery",
          );
        bootstrapAvailable = false;
        response.statusCode = 303;
        response.setHeader(
          "Set-Cookie",
          `${COOKIE}=${sessionToken}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`,
        );
        response.setHeader("Location", "/");
        return response.end();
      }
      if (!authenticated(request, sessionToken))
        return denied(
          request,
          response,
          401,
          "sessionMissingMessage",
          "sessionMissingRecovery",
        );
      if (request.method === "GET" && url.pathname === "/")
        return send(response, "text/html; charset=utf-8", shellHtml(csrfToken));
      if (request.method === "GET" && url.pathname === "/app.css")
        return send(response, "text/css; charset=utf-8", APP_CSS);
      if (request.method === "GET" && url.pathname === "/app.js")
        return send(response, "text/javascript; charset=utf-8", APP_JS);
      if (await handleConversationRoute(request, response, url, application))
        return;
      if (request.method === "GET" && url.pathname === "/api/projects")
        return json(response, 200, await application.listProjects());
      if (request.method === "GET" && url.pathname === "/api/dashboard")
        return json(response, 200, await application.dashboard());
      // Presentation endpoint, not an API: it returns a rendered fragment so the
      // client never assembles markup from data. An unsupported locale falls
      // back to English rather than failing the request.
      if (
        request.method === "GET" &&
        url.pathname === "/view/dashboard-charts"
      ) {
        const locale = resolveGuiLocale(
          url.searchParams.get("locale") ?? undefined,
          [],
        );
        return send(
          response,
          "text/html; charset=utf-8",
          dashboardFragmentHtml(await application.dashboard(), locale),
        );
      }
      if (request.method === "GET") {
        const privacyAuditEvent =
          /^\/api\/projects\/([^/]+)\/privacy-audit\/([^/]+)$/u.exec(
            url.pathname,
          );
        if (privacyAuditEvent !== null)
          return json(
            response,
            200,
            await application.showPrivacyAuditEvent(
              decodeURIComponent(privacyAuditEvent[1]!),
              decodeURIComponent(privacyAuditEvent[2]!),
            ),
          );
        const privacyAuditList =
          /^\/api\/projects\/([^/]+)\/privacy-audit$/u.exec(url.pathname);
        if (privacyAuditList !== null) {
          const limit = optionalLimit(
            url.searchParams.get("limit"),
            "Privacy audit page",
          );
          const cursor = url.searchParams.get("cursor");
          return json(
            response,
            200,
            await application.listPrivacyAudit(
              decodeURIComponent(privacyAuditList[1]!),
              {
                ...(limit === undefined ? {} : { limit }),
                ...(cursor === null ? {} : { cursor }),
              },
            ),
          );
        }
      }
      if (
        request.method === "GET" &&
        url.pathname === "/api/general/conversations"
      )
        return json(
          response,
          200,
          await application.listGeneralConversations(),
        );
      if (
        request.method === "GET" &&
        url.pathname === "/api/general/project-links"
      )
        return json(response, 200, await application.listGeneralProjectLinks());
      if (request.method === "GET") {
        if (url.pathname === "/api/scoped-search") {
          const scope = url.searchParams.get("scope");
          if (scope !== "GENERAL_ONLY" && scope !== "ALL_SCOPES")
            return reject(
              response,
              400,
              "Choose GENERAL_ONLY or ALL_SCOPES search.",
            );
          const typeValue = url.searchParams.get("type");
          if (
            typeValue !== null &&
            !SESSION_EVENT_TYPES.includes(typeValue as SessionEventType)
          )
            return reject(
              response,
              400,
              "Choose a documented canonical event type.",
            );
          const limitValue = url.searchParams.get("limit");
          return json(
            response,
            200,
            await application.searchScopes({
              scope,
              text: url.searchParams.get("q") ?? "",
              ...(typeValue === null
                ? {}
                : { type: typeValue as SessionEventType }),
              ...(limitValue === null ? {} : { limit: Number(limitValue) }),
              ...(url.searchParams.get("associatedProjectId") === null
                ? {}
                : {
                    associatedProjectId: url.searchParams.get(
                      "associatedProjectId",
                    )!,
                  }),
            }),
          );
        }
        if (url.pathname === "/api/search") {
          const typeValue = url.searchParams.get("type");
          if (
            typeValue !== null &&
            !SESSION_EVENT_TYPES.includes(typeValue as SessionEventType)
          )
            return reject(
              response,
              400,
              "Choose a documented canonical event type.",
            );
          const limitValue = url.searchParams.get("limit");
          return json(
            response,
            200,
            await application.searchAllProjects({
              text: url.searchParams.get("q") ?? "",
              ...(typeValue === null
                ? {}
                : { type: typeValue as SessionEventType }),
              ...(limitValue === null ? {} : { limit: Number(limitValue) }),
            }),
          );
        }
        const workList = /^\/api\/projects\/([^/]+)\/work-items$/u.exec(
          url.pathname,
        );
        if (workList !== null)
          return json(
            response,
            200,
            await application.listWorkItems(decodeURIComponent(workList[1]!)),
          );
        const handoffList =
          /^\/api\/projects\/([^/]+)\/work-items\/([^/]+)\/handoffs$/u.exec(
            url.pathname,
          );
        if (handoffList !== null)
          return json(
            response,
            200,
            await application.listHandoffs(
              decodeURIComponent(handoffList[1]!),
              decodeURIComponent(handoffList[2]!),
            ),
          );
        const validation =
          /^\/api\/projects\/([^/]+)\/work-items\/([^/]+)\/handoffs\/([^/]+)\/validate$/u.exec(
            url.pathname,
          );
        if (validation !== null)
          return json(
            response,
            200,
            await application.validateHandoff(
              decodeURIComponent(validation[1]!),
              decodeURIComponent(validation[2]!),
              decodeURIComponent(validation[3]!),
            ),
          );
        const handoffItem =
          /^\/api\/projects\/([^/]+)\/work-items\/([^/]+)\/handoffs\/([^/]+)$/u.exec(
            url.pathname,
          );
        if (handoffItem !== null)
          return json(
            response,
            200,
            await application.showHandoff(
              decodeURIComponent(handoffItem[1]!),
              decodeURIComponent(handoffItem[2]!),
              decodeURIComponent(handoffItem[3]!),
            ),
          );
        const workItem =
          /^\/api\/projects\/([^/]+)\/work-items\/([^/]+)$/u.exec(url.pathname);
        if (workItem !== null)
          return json(
            response,
            200,
            await application.showWorkItem(
              decodeURIComponent(workItem[1]!),
              decodeURIComponent(workItem[2]!),
            ),
          );
        const memoryList = /^\/api\/projects\/([^/]+)\/memory$/u.exec(
          url.pathname,
        );
        if (memoryList !== null) {
          const type = optionalEnum(
            url.searchParams.get("type"),
            MEMORY_ITEM_TYPES,
            "memory type",
          ) as MemoryItemType | undefined;
          const validity = optionalEnum(
            url.searchParams.get("validity"),
            MEMORY_VALIDITIES,
            "memory validity",
          ) as MemoryValidity | undefined;
          const verification = optionalEnum(
            url.searchParams.get("verification"),
            MEMORY_VERIFICATIONS,
            "memory verification",
          ) as MemoryVerification | undefined;
          const limit = optionalLimit(url.searchParams.get("limit"));
          const cursor = url.searchParams.get("cursor");
          return json(
            response,
            200,
            await application.listMemory({
              projectId: decodeURIComponent(memoryList[1]!),
              ...(type === undefined ? {} : { type }),
              ...(validity === undefined ? {} : { validity }),
              ...(verification === undefined ? {} : { verification }),
              ...(limit === undefined ? {} : { limit }),
              ...(cursor === null ? {} : { cursor }),
            }),
          );
        }
        const memoryItem = /^\/api\/projects\/([^/]+)\/memory\/([^/]+)$/u.exec(
          url.pathname,
        );
        if (memoryItem !== null)
          return json(
            response,
            200,
            await application.showMemory(
              decodeURIComponent(memoryItem[1]!),
              decodeURIComponent(memoryItem[2]!),
            ),
          );
        const restart = /^\/api\/projects\/([^/]+)\/restart-summary$/u.exec(
          url.pathname,
        );
        if (restart !== null) {
          const question = url.searchParams.get("q");
          return json(
            response,
            200,
            await application.restartSummary({
              projectId: decodeURIComponent(restart[1]!),
              ...(question === null ? {} : { question }),
            }),
          );
        }
        const search = /^\/api\/projects\/([^/]+)\/search$/u.exec(url.pathname);
        if (search !== null) {
          const typeValue = url.searchParams.get("type");
          if (
            typeValue !== null &&
            !SESSION_EVENT_TYPES.includes(typeValue as SessionEventType)
          )
            return reject(
              response,
              400,
              "Choose a documented canonical event type.",
            );
          const limitValue = url.searchParams.get("limit");
          return json(
            response,
            200,
            await application.search({
              projectId: decodeURIComponent(search[1]!),
              text: url.searchParams.get("q") ?? "",
              ...(typeValue === null
                ? {}
                : { type: typeValue as SessionEventType }),
              ...(limitValue === null ? {} : { limit: Number(limitValue) }),
            }),
          );
        }
        const source =
          /^\/api\/projects\/([^/]+)\/events\/([^/]+)\/source$/u.exec(
            url.pathname,
          );
        if (source !== null)
          return json(
            response,
            200,
            await application.openEventSource(
              decodeURIComponent(source[1]!),
              decodeURIComponent(source[2]!),
            ),
          );
        const event = /^\/api\/projects\/([^/]+)\/events\/([^/]+)$/u.exec(
          url.pathname,
        );
        if (event !== null)
          return json(
            response,
            200,
            await application.showEvent(
              decodeURIComponent(event[1]!),
              decodeURIComponent(event[2]!),
            ),
          );
      }
      if (request.method === "POST") {
        if (!validMutation(request, origin, csrfToken))
          return reject(
            response,
            403,
            "The local request failed origin or CSRF validation.",
          );
        if (url.pathname === "/api/general/conversations") {
          const body = await readJson(request);
          if (!record(body) || typeof body.title !== "string")
            return reject(
              response,
              400,
              "Enter a bounded General conversation title.",
            );
          return json(
            response,
            201,
            await application.createGeneralConversation(body.title),
          );
        }
        if (url.pathname === "/api/general/project-links") {
          const body = await readJson(request);
          if (
            !record(body) ||
            typeof body.generalConversationId !== "string" ||
            typeof body.generalEventId !== "string" ||
            typeof body.generalContentSha256 !== "string" ||
            typeof body.targetProjectId !== "string" ||
            typeof body.rationale !== "string"
          )
            return reject(
              response,
              400,
              "Choose an exact General event and registered target project, then enter a reviewed rationale.",
            );
          return json(
            response,
            201,
            await application.createGeneralProjectLink({
              generalConversationId: body.generalConversationId,
              generalEventId: body.generalEventId,
              generalContentSha256: body.generalContentSha256,
              targetProjectId: body.targetProjectId,
              rationale: body.rationale,
            }),
          );
        }
        const generalAppend =
          /^\/api\/general\/conversations\/([^/]+)\/events$/u.exec(
            url.pathname,
          );
        if (generalAppend !== null) {
          const body = await readJson(request);
          if (
            !record(body) ||
            typeof body.content !== "string" ||
            typeof body.expectedEventCount !== "number"
          )
            return reject(
              response,
              400,
              "Enter one question and the current immutable event count.",
            );
          return json(
            response,
            201,
            await application.appendGeneralQuestion({
              conversationId: decodeURIComponent(generalAppend[1]!),
              expectedEventCount: body.expectedEventCount,
              content: body.content,
            }),
          );
        }
        if (url.pathname === "/api/projects") {
          const body = await readJson(request);
          if (!record(body) || typeof body.path !== "string")
            return reject(
              response,
              400,
              "Enter a local Git repository directory.",
            );
          return json(
            response,
            201,
            await application.registerProject(body.path),
          );
        }
        const instructionPreview =
          /^\/api\/projects\/([^/]+)\/instructions\/preview$/u.exec(
            url.pathname,
          );
        if (instructionPreview !== null) {
          const body = await readJson(request);
          if (
            !record(body) ||
            !Array.isArray(body.bundles) ||
            body.bundles.length < 1 ||
            !body.bundles.every(
              (bundle) =>
                record(bundle) &&
                typeof bundle.path === "string" &&
                (bundle.expectedDigest === undefined ||
                  typeof bundle.expectedDigest === "string"),
            ) ||
            !optionalString(body.model) ||
            !optionalString(body.agent) ||
            !optionalString(body.task)
          )
            return reject(
              response,
              400,
              "Select at least one explicit reviewed instruction bundle and valid optional targets.",
            );
          return json(
            response,
            200,
            await application.previewInstructions({
              projectId: decodeURIComponent(instructionPreview[1]!),
              bundles: body.bundles as readonly {
                path: string;
                expectedDigest?: string;
              }[],
              ...(body.model === undefined ? {} : { model: body.model }),
              ...(body.agent === undefined ? {} : { agent: body.agent }),
              ...(body.task === undefined ? {} : { task: body.task }),
            }),
          );
        }
        const agentProfilePreview =
          /^\/api\/projects\/([^/]+)\/agent-profile\/preview$/u.exec(
            url.pathname,
          );
        if (agentProfilePreview !== null) {
          const body = await readJson(request);
          if (
            !record(body) ||
            typeof body.path !== "string" ||
            (body.expectedDigest !== undefined &&
              typeof body.expectedDigest !== "string")
          )
            return reject(
              response,
              400,
              "Select one explicit reviewed schema-v1 agent profile bundle.",
            );
          return json(
            response,
            200,
            await application.previewAgentProfile({
              projectId: decodeURIComponent(agentProfilePreview[1]!),
              profile: {
                path: body.path,
                ...(body.expectedDigest === undefined
                  ? {}
                  : { expectedDigest: body.expectedDigest }),
              },
            }),
          );
        }
        if (
          await handleHandoffPreviewRoute(request, response, url, application)
        )
          return;
        const createWork = /^\/api\/projects\/([^/]+)\/work-items$/u.exec(
          url.pathname,
        );
        if (createWork !== null) {
          const body = await readJson(request);
          if (
            !record(body) ||
            typeof body.objective !== "string" ||
            !stringArray(body.sourceEventIds)
          )
            return reject(
              response,
              400,
              "Enter an objective and select canonical source evidence.",
            );
          return json(
            response,
            201,
            await application.createWorkItem({
              projectId: decodeURIComponent(createWork[1]!),
              objective: body.objective,
              sourceEventIds: body.sourceEventIds,
            }),
          );
        }
        const workTransition =
          /^\/api\/projects\/([^/]+)\/work-items\/([^/]+)\/(activate|block|complete|reopen)$/u.exec(
            url.pathname,
          );
        if (workTransition !== null) {
          const body = await readJson(request);
          if (!record(body) || !stringArray(body.sourceEventIds))
            return reject(
              response,
              400,
              "Select canonical transition evidence.",
            );
          return json(
            response,
            200,
            await application.transitionWorkItem(
              workTransition[3] as "activate" | "block" | "complete" | "reopen",
              {
                projectId: decodeURIComponent(workTransition[1]!),
                workItemId: decodeURIComponent(workTransition[2]!),
                sourceEventIds: body.sourceEventIds,
              },
            ),
          );
        }
        const handoffMutation =
          /^\/api\/projects\/([^/]+)\/work-items\/([^/]+)\/handoffs\/(preview|create)$/u.exec(
            url.pathname,
          );
        if (handoffMutation !== null) {
          const body = await readJson(request);
          if (
            !record(body) ||
            typeof body.nextAction !== "string" ||
            !stringArray(body.sourceEventIds) ||
            !optionalStringArray(body.memoryIds) ||
            !optionalStringArray(body.relevantFiles) ||
            (body.predecessorId !== undefined &&
              typeof body.predecessorId !== "string")
          )
            return reject(
              response,
              400,
              "Review the bounded handoff builder fields.",
            );
          const input = {
            projectId: decodeURIComponent(handoffMutation[1]!),
            workItemId: decodeURIComponent(handoffMutation[2]!),
            nextAction: body.nextAction,
            sourceEventIds: body.sourceEventIds,
            memoryIds: body.memoryIds ?? [],
            relevantFiles: body.relevantFiles ?? [],
            ...(body.predecessorId === undefined
              ? {}
              : { predecessorId: body.predecessorId }),
          };
          return json(
            response,
            handoffMutation[3] === "create" ? 201 : 200,
            handoffMutation[3] === "create"
              ? await application.createHandoff(input)
              : await application.previewHandoff(input),
          );
        }
        const addMemory = /^\/api\/projects\/([^/]+)\/memory$/u.exec(
          url.pathname,
        );
        if (addMemory !== null) {
          const body = await readJson(request);
          if (
            !record(body) ||
            typeof body.type !== "string" ||
            !MEMORY_ITEM_TYPES.includes(body.type as MemoryItemType) ||
            typeof body.content !== "string" ||
            !stringArray(body.sourceEventIds)
          )
            return reject(
              response,
              400,
              "Enter a documented memory type, content, and canonical source events.",
            );
          return json(
            response,
            201,
            await application.addMemory({
              projectId: decodeURIComponent(addMemory[1]!),
              type: body.type as MemoryItemType,
              content: body.content,
              sourceEventIds: body.sourceEventIds,
            }),
          );
        }
        const transition =
          /^\/api\/projects\/([^/]+)\/memory\/([^/]+)\/(verify|supersede|invalidate)$/u.exec(
            url.pathname,
          );
        if (transition !== null) {
          const body = await readJson(request);
          if (!record(body) || !stringArray(body.sourceEventIds))
            return reject(
              response,
              400,
              "Select at least one canonical source event.",
            );
          const base = {
            projectId: decodeURIComponent(transition[1]!),
            memoryId: decodeURIComponent(transition[2]!),
            sourceEventIds: body.sourceEventIds,
          };
          if (transition[3] === "verify" && typeof body.note === "string")
            return json(
              response,
              200,
              await application.verifyMemory({ ...base, note: body.note }),
            );
          if (transition[3] === "supersede" && typeof body.content === "string")
            return json(
              response,
              201,
              await application.supersedeMemory({
                ...base,
                content: body.content,
              }),
            );
          if (transition[3] === "invalidate" && typeof body.reason === "string")
            return json(
              response,
              200,
              await application.invalidateMemory({
                ...base,
                reason: body.reason,
              }),
            );
          return reject(response, 400, "Enter the documented lifecycle value.");
        }
        const inspect = /^\/api\/projects\/([^/]+)\/inspect$/u.exec(
          url.pathname,
        );
        if (inspect !== null)
          return json(
            response,
            200,
            await application.inspectProject(decodeURIComponent(inspect[1]!)),
          );
        const sample = /^\/api\/projects\/([^/]+)\/import-sample$/u.exec(
          url.pathname,
        );
        if (sample !== null)
          return json(
            response,
            200,
            await application.importSample(decodeURIComponent(sample[1]!)),
          );
        if (await handleTranscriptRoute(request, response, url, application))
          return;
      }
      return reject(response, 404, "This GUI route does not exist.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "The local GUI operation failed.";
      const recovery =
        error instanceof GuiApplicationError
          ? error.recovery
          : "Return to the previous step, keep safe input, and retry.";
      return json(response, 400, { message, recovery });
    }
  });
  await new Promise<void>((resolve, rejectStart) => {
    server.once("error", rejectStart);
    server.listen(options.port ?? 0, "127.0.0.1", () => {
      server.off("error", rejectStart);
      resolve();
    });
  });
  const address = server.address();
  if (address === null || typeof address === "string")
    throw new Error("GUI server did not receive a loopback TCP address.");
  authority = `127.0.0.1:${address.port}`;
  origin = `http://${authority}`;
  return Object.freeze({
    origin,
    bootstrapUrl: `${origin}/bootstrap/${bootstrapToken}`,
    close: () =>
      new Promise<void>((resolve, rejectClose) =>
        server.close((error) =>
          error === undefined ? resolve() : rejectClose(error),
        ),
      ),
  });
}
