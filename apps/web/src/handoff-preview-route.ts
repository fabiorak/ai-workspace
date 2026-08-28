/**
 * The authenticated preview routes that hang under one packet.
 *
 * ADR-0035 keeps routing in modules of its own, one per area, so the host stays a
 * host. These seven paths share one area — what would be assembled, screened or
 * pseudonymized for a packet before anything is delivered — and they share one
 * shape: a bounded body, a refusal that names what to select, and a preview that
 * persists nothing and delivers nothing.
 *
 * The host asks for this module inside its own write block, after the origin and
 * CSRF check, so every route here is already authorized when it is reached. There
 * is deliberately no try/catch of its own: the host wraps the whole exchange and
 * turns a failure into a message with its recovery, and a second catch here would
 * answer the same failure with different words.
 */
import type { IncomingMessage, ServerResponse } from "node:http";

import type { GuiApplication } from "./application.ts";
import {
  json,
  optionalString,
  readJson,
  record,
  reject,
} from "./http-plumbing.ts";

const CONTEXT =
  /^\/api\/projects\/([^/]+)\/work-items\/([^/]+)\/handoffs\/([^/]+)\/context\/preview$/u;
const PROFILE_CONTEXT =
  /^\/api\/projects\/([^/]+)\/work-items\/([^/]+)\/handoffs\/([^/]+)\/profile-context\/preview$/u;
const PRIVACY_PREFLIGHT =
  /^\/api\/projects\/([^/]+)\/work-items\/([^/]+)\/handoffs\/([^/]+)\/privacy-preflight\/preview$/u;
const ALIAS_SUGGESTIONS =
  /^\/api\/projects\/([^/]+)\/work-items\/([^/]+)\/handoffs\/([^/]+)\/(?:customer|entity)-alias-suggestions\/preview$/u;
const PSEUDONYMIZATION =
  /^\/api\/projects\/([^/]+)\/work-items\/([^/]+)\/handoffs\/([^/]+)\/pseudonymization\/preview$/u;
const OUTPUT_RESTORATION =
  /^\/api\/projects\/([^/]+)\/work-items\/([^/]+)\/handoffs\/([^/]+)\/output-restoration\/preview$/u;
const CONTEXT_SELECTORS =
  /^\/api\/projects\/([^/]+)\/work-items\/([^/]+)\/handoffs\/([^/]+)\/context-selectors\/preview$/u;

/** The three path segments every route here shares, decoded as they were stored. */
function packetOf(match: RegExpExecArray) {
  return {
    projectId: decodeURIComponent(match[1]!),
    workItemId: decodeURIComponent(match[2]!),
    handoffId: decodeURIComponent(match[3]!),
  };
}

type Source = Readonly<{ path: string; expectedDigest?: string }>;

/** A digest-pinned source: a path, and optionally the exact bytes expected at it. */
function source(value: unknown): boolean {
  return (
    record(value) &&
    typeof value.path === "string" &&
    (value.expectedDigest === undefined ||
      typeof value.expectedDigest === "string")
  );
}

function sources(value: unknown, atLeastOne = false): boolean {
  return (
    Array.isArray(value) &&
    (!atLeastOne || value.length >= 1) &&
    value.every((entry) => source(entry))
  );
}

export async function handleHandoffPreviewRoute(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  application: GuiApplication,
): Promise<boolean> {
  const contextPreview = CONTEXT.exec(url.pathname);
  if (contextPreview !== null) {
    const body = await readJson(request);
    if (
      !record(body) ||
      !sources(body.bundles) ||
      !optionalString(body.model) ||
      !optionalString(body.agent) ||
      !optionalString(body.task) ||
      typeof body.continuityBudget !== "number" ||
      typeof body.instructionBudget !== "number"
    )
      reject(
        response,
        400,
        "Select an explicit handoff and enter documented exact-byte budgets.",
      );
    else
      json(
        response,
        200,
        await application.previewContext({
          ...packetOf(contextPreview),
          bundles: body.bundles as readonly Source[],
          continuityBudget: body.continuityBudget,
          instructionBudget: body.instructionBudget,
          ...(body.model === undefined ? {} : { model: body.model }),
          ...(body.agent === undefined ? {} : { agent: body.agent }),
          ...(body.task === undefined ? {} : { task: body.task }),
        }),
      );
    return true;
  }
  const profileContextPreview = PROFILE_CONTEXT.exec(url.pathname);
  if (profileContextPreview !== null) {
    const body = await readJson(request);
    if (
      !record(body) ||
      !source(body.profile) ||
      !sources(body.bundles, true) ||
      typeof body.model !== "string" ||
      !body.model.trim() ||
      !optionalString(body.task)
    )
      reject(
        response,
        400,
        "Select one reviewed profile, its exact instruction bundles, and one allowed model.",
      );
    else
      json(
        response,
        200,
        await application.previewProfileContext({
          ...packetOf(profileContextPreview),
          profile: body.profile as Source,
          bundles: body.bundles as readonly Source[],
          model: body.model,
          ...(body.task === undefined ? {} : { task: body.task }),
        }),
      );
    return true;
  }
  const privacyPreflightPreview = PRIVACY_PREFLIGHT.exec(url.pathname);
  if (privacyPreflightPreview !== null) {
    const body = await readJson(request);
    if (
      !record(body) ||
      !source(body.profile) ||
      !source(body.policy) ||
      !sources(body.bundles, true) ||
      typeof body.model !== "string" ||
      !body.model.trim() ||
      !optionalString(body.task)
    )
      reject(
        response,
        400,
        "Select one reviewed profile, its exact instruction bundles, one allowed model, and one explicit digest-pinned model data policy.",
      );
    else
      json(
        response,
        200,
        await application.previewPrivacyPreflight({
          ...packetOf(privacyPreflightPreview),
          profile: body.profile as Source,
          policy: body.policy as Source,
          bundles: body.bundles as readonly Source[],
          model: body.model,
          ...(body.task === undefined ? {} : { task: body.task }),
        }),
      );
    return true;
  }
  const customerAliasPreview = ALIAS_SUGGESTIONS.exec(url.pathname);
  if (customerAliasPreview !== null) {
    const body = await readJson(request);
    if (
      !record(body) ||
      !source(body.profile) ||
      !source(body.policy) ||
      !sources(body.bundles, true) ||
      typeof body.model !== "string" ||
      !body.model.trim() ||
      !optionalString(body.task) ||
      !Array.isArray(body.dictionary) ||
      body.dictionary.length < 1 ||
      !body.dictionary.every(
        (entry) =>
          record(entry) &&
          (entry.entityType === "CUSTOMER" || entry.entityType === "PROJECT") &&
          typeof entry.alias === "string",
      )
    )
      reject(
        response,
        400,
        "Select the exact profile, instruction sources, policy, model, and at least one typed transient synthetic customer or project alias.",
      );
    else
      json(
        response,
        200,
        await application.previewCustomerAliasSuggestions({
          ...packetOf(customerAliasPreview),
          profile: body.profile as Source,
          policy: body.policy as Source,
          bundles: body.bundles as readonly Source[],
          model: body.model,
          ...(body.task === undefined ? {} : { task: body.task as string }),
          dictionary: body.dictionary as readonly {
            entityType: "CUSTOMER" | "PROJECT";
            alias: string;
          }[],
        }),
      );
    return true;
  }
  const pseudonymizationPreview = PSEUDONYMIZATION.exec(url.pathname);
  if (pseudonymizationPreview !== null) {
    const body = await readJson(request);
    if (
      !record(body) ||
      !record(body.profile) ||
      typeof body.profile.path !== "string" ||
      !record(body.policy) ||
      typeof body.policy.path !== "string" ||
      !Array.isArray(body.bundles) ||
      body.bundles.length < 1 ||
      !body.bundles.every(
        (bundle) => record(bundle) && typeof bundle.path === "string",
      ) ||
      typeof body.model !== "string" ||
      !body.model.trim() ||
      !record(body.review) ||
      !record(body.keyCustody) ||
      body.keyCustody.mode !== "PASSPHRASE_WRAPPING" ||
      typeof body.keyCustody.passphrase !== "string"
    )
      reject(
        response,
        400,
        "Select the exact profile, instruction sources, policy, model, reviewed span plan, and local passphrase-wrapping custody.",
      );
    else
      json(
        response,
        201,
        await application.previewPseudonymization({
          ...packetOf(pseudonymizationPreview),
          profile: body.profile as Source,
          policy: body.policy as Source,
          bundles: body.bundles as readonly Source[],
          model: body.model,
          ...(body.task === undefined ? {} : { task: body.task as string }),
          review: body.review as never,
          keyCustody: {
            mode: "PASSPHRASE_WRAPPING",
            passphrase: body.keyCustody.passphrase,
          },
        }),
      );
    return true;
  }
  const outputRestorationPreview = OUTPUT_RESTORATION.exec(url.pathname);
  if (outputRestorationPreview !== null) {
    const body = await readJson(request);
    if (
      !record(body) ||
      typeof body.mappingSetId !== "string" ||
      !body.mappingSetId.trim() ||
      typeof body.passphrase !== "string" ||
      typeof body.output !== "string" ||
      !body.output
    )
      reject(
        response,
        400,
        "Select one existing mapping-set identity, its local custody passphrase, and bounded pseudonymized output.",
      );
    else
      json(
        response,
        200,
        await application.inspectPseudonymizedOutput({
          ...packetOf(outputRestorationPreview),
          mappingSetId: body.mappingSetId,
          passphrase: body.passphrase,
          output: body.output,
        }),
      );
    return true;
  }
  const contextSelectorPreview = CONTEXT_SELECTORS.exec(url.pathname);
  if (contextSelectorPreview !== null) {
    const body = await readJson(request);
    if (!record(body) || !source(body.profile))
      reject(
        response,
        400,
        "Select one reviewed profile using only documented experiment-only handoff selectors.",
      );
    else
      json(
        response,
        200,
        await application.previewContextSelectors({
          ...packetOf(contextSelectorPreview),
          profile: body.profile as Source,
        }),
      );
    return true;
  }
  return false;
}
