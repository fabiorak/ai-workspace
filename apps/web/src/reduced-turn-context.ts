import { randomUUID } from "node:crypto";
import { composeScopedProfileInstructions } from "@ai-workspace/instruction-manager";
import {
  LocalAgentProfileReader,
  LocalInstructionBundleReader,
} from "@ai-workspace/local-instructions";
import { LocalModelDataPolicyReader } from "@ai-workspace/local-privacy-policy";
import { JsonTurnPrivacyAuditStore } from "@ai-workspace/local-privacy-audit";
import {
  digestCanonical,
  TurnPrivacyDecisionAudit,
} from "@ai-workspace/privacy-audit";
import {
  detectRestrictedData,
  evaluateScopedPrivacyPreflight,
} from "@ai-workspace/privacy-gateway";
import type { ResolvedConversationTurn } from "@ai-workspace/conversation-turn";
import type { ResolvedModelTarget } from "@ai-workspace/model-targets";
import {
  collectReducedTurnEvidence,
  type ReducedTurnEvidenceDependencies,
} from "./reduced-turn-evidence.ts";
import type { AutomaticPrivacyProtection } from "./automatic-privacy.ts";

export async function composeReducedTurnContext(
  dependencies: ReducedTurnEvidenceDependencies &
    Readonly<{ home: string; ids?: () => string; clock?: () => Date }>,
  turn: ResolvedConversationTurn,
  target: ResolvedModelTarget,
  protection: AutomaticPrivacyProtection,
  recordAudit: boolean,
) {
  const scope =
    turn.scope.projectId === null
      ? { kind: "GENERAL" as const }
      : { kind: "PROJECT" as const, projectId: turn.scope.projectId };
  const [profile, bundle, policy] = await Promise.all([
    new LocalAgentProfileReader().readScoped(scope, {
      path: target.target.profileRef,
    }),
    new LocalInstructionBundleReader().readScoped(
      scope,
      target.target.instructionRefs.map((path) => ({ path })),
    ),
    new LocalModelDataPolicyReader().readScoped(scope, {
      path: target.target.policyRef,
    }),
  ]);
  const instructions = composeScopedProfileInstructions(
    profile.bundle,
    bundle,
    { model: target.target.modelId },
  );
  bound(
    JSON.stringify(instructions),
    instructions.selection.budgets.INSTRUCTIONS,
  );
  const evidence = await collectReducedTurnEvidence(dependencies, turn.scope);
  bound(JSON.stringify(evidence), instructions.selection.budgets.CONTINUITY);
  const envelope = {
    schemaVersion: 2,
    effect: "BOUNDED_REDUCED_CONVERSATION_CONTEXT",
    scope: turn.scope,
    target: {
      targetId: target.target.targetId,
      modelId: target.target.modelId,
    },
    instructions,
    ...evidence,
    userText: turn.request.userText,
  };
  // JSON escaping must not hide a quoted credential in a source string.
  screenStrings(envelope);
  const originalText = JSON.stringify(envelope);
  bound(originalText, target.target.maxInputBytes);
  // Evaluate the entire envelope: metadata, instructions and the new question
  // are not an implicit public channel around source classification.
  const report = evaluateScopedPrivacyPreflight({
    scope,
    policy: policy.policy,
    modelId: target.target.modelId,
    items: [
      {
        id: "conversation.payload",
        content: originalText,
        category: "REDUCED_CONTEXT",
        trust: "MIXED_UNVERIFIED",
        sourceType: "CONVERSATION",
        sourceId: turn.scope.conversationId,
        exactBytes: Buffer.byteLength(originalText, "utf8"),
      },
    ],
    omitted: evidence.omissions.map((omission, index) => ({
      id: `omission.${index}`,
      reason: omission.reason,
      count: omission.count,
      exactBytes: omission.bytes,
    })),
  });
  const privacyDigest = digestCanonical({
    policy: policy.sourceDigest,
    report,
  });
  const audit = new TurnPrivacyDecisionAudit({
    store: new JsonTurnPrivacyAuditStore(dependencies.home),
    ids: dependencies.ids ?? randomUUID,
    clock: dependencies.clock ?? (() => new Date()),
  });
  if (report.overallResult === "BLOCKED") {
    if (recordAudit)
      await audit.record({
        scope,
        conversationId: turn.scope.conversationId,
        modelId: target.target.modelId,
        policyId: policy.policy.id,
        policyVersion: policy.policy.version,
        policyDigest: policy.sourceDigest,
        decision: report.overallResult,
        counts: report.accounting,
        preflightReportDigest: digestCanonical(report),
        payloadDigest: digestCanonical(originalText),
      });
    throw new Error("PRIVACY_BLOCKED");
  }
  const protectedContext = await protection.protect(
    scope.kind === "GENERAL" ? "GENERAL" : `PROJECT:${scope.projectId}`,
    originalText,
  );
  bound(protectedContext.text, target.target.maxInputBytes);
  const bindingDigest = digestCanonical({
    scope,
    profile: profile.sourceDigest,
    instructions,
    privacyDigest,
    mappingDigest: protectedContext.mappingDigest,
    text: protectedContext.text,
  });
  const auditEventHash = recordAudit
    ? (
        await audit.record({
          scope,
          conversationId: turn.scope.conversationId,
          modelId: target.target.modelId,
          policyId: policy.policy.id,
          policyVersion: policy.policy.version,
          policyDigest: policy.sourceDigest,
          decision: report.overallResult,
          counts: report.accounting,
          preflightReportDigest: digestCanonical(report),
          payloadDigest: digestCanonical(protectedContext.text),
        })
      ).eventHash
    : null;
  return Object.freeze({
    text: protectedContext.text,
    bindingDigest,
    privacyDigest,
    auditEventHash,
    mapping: protectedContext.mapping,
    replacements: protectedContext.replacements,
  });
}

function bound(text: string, maximum: number) {
  if (Buffer.byteLength(text, "utf8") > maximum)
    throw new Error("CONTEXT_UNAVAILABLE");
}

function screenStrings(value: unknown): void {
  if (typeof value === "string") {
    if (detectRestrictedData(value) !== null)
      throw new Error("PRIVACY_BLOCKED");
  } else if (Array.isArray(value)) {
    for (const item of value) screenStrings(item);
  } else if (typeof value === "object" && value !== null) {
    for (const item of Object.values(value)) screenStrings(item);
  }
}
