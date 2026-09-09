import { ContinuationSending } from "./continuation-sending.ts";
import type { DeliveryTransport } from "@ai-workspace/model-delivery";
import { randomUUID } from "node:crypto";
import type { ExpandedContextPackPreview } from "@ai-workspace/context-builder";
import {
  LocalModelDataPolicyReader,
  type LocalModelDataPolicyInput,
} from "@ai-workspace/local-privacy-policy";
import { PassphraseKeyCustody } from "@ai-workspace/local-key-custody";
import { EncryptedPrivacyMappingStore } from "@ai-workspace/local-privacy-mapping";
import {
  digestCanonical,
  type PrivacyDecisionAudit,
} from "@ai-workspace/privacy-audit";
import {
  evaluatePrivacyPreflight,
  suggestEntityAliases,
  pseudonymizeContextPack,
  restorePseudonymizedItems,
  pseudonymizeContextPackV2,
  restorePseudonymizedItemsV2,
  type EntityAliasEntry,
  type ReviewedSpanV2,
  type PseudonymReviewV2,
} from "@ai-workspace/privacy-gateway";
import type { ModelConversationWriter } from "./model-conversation.ts";
import {
  prepareContinuation,
  type ContinuationQuery,
  type ContinuationSources,
  type ContinuationTarget,
} from "./continuation-preparation.ts";
import {
  continuationPrivacyInput,
  serializeContinuation,
  textDigest,
} from "./continuation-payload.ts";

type Prepared = Extract<
  Awaited<ReturnType<typeof prepareContinuation>>,
  { prepared: true }
>;
export type ContinuationConfiguration = ContinuationTarget &
  Readonly<{ label: string; policy: LocalModelDataPolicyInput }>;
type Draft = {
  query: ContinuationQuery;
  target: ContinuationConfiguration;
  prepared: Prepared;
  packet: ExpandedContextPackPreview;
  question: string;
  binding: string;
  expires: number;
  suggestions: readonly ReviewedSpanV2[];
  auditHash: string;
};
export type ContinuationReviewInput = Readonly<{
  proposal: string;
  selected: readonly number[];
  manual: readonly Readonly<{ item: number; start: number; end: number }>[];
  passphrase: string;
}>;
const fail = (reason: string) => ({ ready: false as const, reason });
const binding = (prepared: Prepared, target: ContinuationConfiguration) =>
  digestCanonical({ prepared, target });

/** Per-application transient state. Restart loses configuration and proposals;
 * retained encrypted mappings and privacy audit use their existing stores. */
export class ContinuationWorkflow {
  readonly #sending: ContinuationSending | undefined;
  readonly #sources: ContinuationSources;
  readonly #home: string;
  readonly #audit: PrivacyDecisionAudit;
  readonly #conversationWriter: ModelConversationWriter | undefined;
  readonly #targets = new Map<string, ContinuationConfiguration>();
  readonly #drafts = new Map<string, Draft>();
  constructor(
    sources: ContinuationSources,
    home: string,
    audit: PrivacyDecisionAudit,
    conversationWriter?: ModelConversationWriter,
    transport?: DeliveryTransport,
  ) {
    this.#sending =
      transport && conversationWriter
        ? new ContinuationSending(home, transport, conversationWriter)
        : undefined;
    this.#sources = sources;
    this.#home = home;
    this.#audit = audit;
    this.#conversationWriter = conversationWriter;
  }
  async open(query: ContinuationQuery) {
    const target =
      query.projectId === null
        ? null
        : (this.#targets.get(query.projectId) ?? null);
    const answer = await prepareContinuation(this.#sources, query, target);
    if (!answer.prepared) return fail(answer.reason);
    return {
      ready: true as const,
      label: target!.label,
      model: answer.model,
      keptAt: answer.handoffCreatedAt,
      changed: !answer.repository.matches,
      omitted:
        answer.contextPack.omitted.length +
        (answer.evidence?.omitted.length ?? 0),
      localOnly: true,
    };
  }
  async configure(query: ContinuationQuery, target: ContinuationConfiguration) {
    if (!target.label?.trim() || target.label.length > 120)
      return fail("INVALID_TARGET");
    const result = await prepareContinuation(this.#sources, query, target);
    if (!result.prepared) return fail(result.reason);
    const policy = await new LocalModelDataPolicyReader().read(
      result.projectId,
      target.policy,
    );
    if (policy.policy.modelId !== target.model) return fail("INVALID_TARGET");
    // Configuration itself performs no audit and never declares network availability.
    if (this.#targets.size >= 100 && !this.#targets.has(result.projectId))
      return fail("CAPACITY");
    this.#targets.set(result.projectId, structuredClone(target));
    for (const [id, draft] of this.#drafts)
      if (draft.query.projectId === result.projectId) this.#drafts.delete(id);
    return this.open(query);
  }
  async propose(
    query: ContinuationQuery,
    question: string,
    aliases: readonly EntityAliasEntry[],
  ) {
    const target =
      query.projectId === null ? undefined : this.#targets.get(query.projectId);
    if (!target) return fail("TARGET_NOT_CONFIGURED");
    const prepared = await prepareContinuation(this.#sources, query, target);
    if (!prepared.prepared) return fail(prepared.reason);
    const packet = continuationPrivacyInput(
      prepared.expandedContextPack,
      question,
      prepared.evidence,
    );
    const policy = await new LocalModelDataPolicyReader().read(
      prepared.projectId,
      target.policy,
    );
    const preflight = evaluatePrivacyPreflight({
      policy: policy.policy,
      modelId: target.model,
      contextPack: packet,
    });
    const audit = await this.#audit.record({
      projectId: prepared.projectId,
      workItemId: prepared.workItemId,
      handoffId: prepared.handoffId,
      modelId: target.model,
      policyId: policy.policy.id,
      policyVersion: policy.policy.version,
      policyDigest: policy.sourceDigest,
      contextPackSchemaVersion: packet.schemaVersion,
      decision: preflight.overallResult,
      counts: preflight.accounting,
      preflightReportDigest: digestCanonical(preflight),
    });
    if (preflight.overallResult === "BLOCKED") return fail("PRIVACY_BLOCKED");
    const suggestions = aliases.length
      ? suggestEntityAliases({
          modelId: target.model,
          contextPack: packet,
          dictionary: aliases,
        }).suggestions
      : [];
    for (const [id, draft] of this.#drafts)
      if (draft.expires <= Date.now()) this.#drafts.delete(id);
    if (this.#drafts.size >= 20) return fail("CAPACITY");
    const proposal = randomUUID();
    this.#drafts.set(proposal, {
      query: { ...query },
      target: structuredClone(target),
      prepared,
      packet,
      question,
      binding: digestCanonical({
        preparation: binding(prepared, target),
        policy: policy.sourceDigest,
      }),
      expires: Date.now() + 10 * 60_000,
      suggestions,
      auditHash: audit.eventHash,
    });
    return {
      ready: true as const,
      proposal,
      items: packet.included.map((item) => ({ text: item.content })),
      suggestions: suggestions.map((selection, index) => {
        const item = packet.included.find(
          (item) => item.id === selection.itemId,
        )!;
        return {
          index,
          text: Buffer.from(item.content)
            .subarray(selection.byteStart, selection.byteEnd)
            .toString("utf8"),
        };
      }),
      label: target.label,
      model: target.model,
      keptAt: prepared.handoffCreatedAt,
      changed: !prepared.repository.matches,
      omitted:
        prepared.contextPack.omitted.length +
        (prepared.evidence?.omitted.length ?? 0),
      localOnly: true,
    };
  }
  async send(
    query: ContinuationQuery,
    authorizationId: string,
    passphrase: string,
  ) {
    if (!this.#sending) return fail("DELIVERY_NOT_CONFIGURED");
    return this.#sending.send(query, authorizationId, passphrase);
  }
  async recordResponse(
    query: ContinuationQuery,
    input: Readonly<{
      attemptId: string;
      model: string;
      text: string;
      occurredAt: string;
    }>,
  ) {
    if (!this.#conversationWriter || !query.projectId)
      return fail("LOCAL_EVIDENCE_UNAVAILABLE");
    const target = this.#targets.get(query.projectId);
    if (!target || target.model !== input.model)
      return fail("PREPARATION_CHANGED");
    const stored = await this.#conversationWriter.store({
      projectId: query.projectId,
      conversationId: query.conversationId,
      attemptId: input.attemptId,
      model: input.model,
      text: input.text,
      occurredAt: input.occurredAt,
    });
    return { ready: true as const, ...stored, localOnly: true };
  }
  async protect(query: ContinuationQuery, input: ContinuationReviewInput) {
    const draft = this.#drafts.get(input.proposal);
    if (
      !draft ||
      draft.expires <= Date.now() ||
      draft.query.projectId !== query.projectId ||
      draft.query.conversationId !== query.conversationId
    )
      return fail("PREPARATION_EXPIRED");
    // Consumed before asynchronous work: duplicate submissions cannot create mappings twice.
    this.#drafts.delete(input.proposal);
    const currentTarget = this.#targets.get(query.projectId!);
    if (!currentTarget) return fail("PREPARATION_CHANGED");
    const prepared = await prepareContinuation(
      this.#sources,
      query,
      currentTarget,
    );
    if (!prepared.prepared) return fail("PREPARATION_CHANGED");
    const policy = await new LocalModelDataPolicyReader().read(
      prepared.projectId,
      currentTarget.policy,
    );
    if (
      draft.binding !==
      digestCanonical({
        preparation: binding(prepared, currentTarget),
        policy: policy.sourceDigest,
      })
    )
      return fail("PREPARATION_CHANGED");
    if (
      input.selected.length > 1000 ||
      input.manual.length > 1000 ||
      new Set(input.selected).size !== input.selected.length
    )
      return fail("INVALID_REVIEW");
    const selections: ReviewedSpanV2[] = input.selected.map((index) => {
      const value = draft.suggestions[index];
      if (!Number.isInteger(index) || !value) throw new Error("INVALID_REVIEW");
      const { itemId, contentSha256, entityType, byteStart, byteEnd } = value;
      return { itemId, contentSha256, entityType, byteStart, byteEnd };
    });
    for (const manual of input.manual) {
      const item = draft.packet.included[manual.item];
      if (
        !Number.isInteger(manual.item) ||
        !item ||
        !Number.isInteger(manual.start) ||
        !Number.isInteger(manual.end) ||
        manual.start < 0 ||
        manual.end <= manual.start ||
        manual.end > item.content.length ||
        !item.content.slice(0, manual.start).isWellFormed() ||
        !item.content.slice(manual.start, manual.end).isWellFormed()
      )
        return fail("INVALID_REVIEW");
      selections.push({
        itemId: item.id,
        contentSha256: textDigest(item.content),
        byteStart: Buffer.byteLength(item.content.slice(0, manual.start)),
        byteEnd: Buffer.byteLength(item.content.slice(0, manual.end)),
        entityType: "OTHER",
      });
    }
    let mappingId: string | null = null;
    let items: readonly { id: string; content: string }[] =
      draft.packet.included;
    if (selections.length > 0) {
      const review: PseudonymReviewV2 = {
        schemaVersion: 2,
        mappingSetId: randomUUID(),
        projectId: prepared.projectId,
        workItemId: prepared.workItemId,
        handoffId: prepared.handoffId,
        modelId: prepared.model,
        attribution: "USER_REVIEWED",
        selections,
      };
      mappingId = review.mappingSetId;
      const transform = (key: Uint8Array) =>
        selections.some((selection) => selection.entityType === "PROJECT")
          ? pseudonymizeContextPackV2({
              review,
              contextPack: draft.packet,
              key,
            })
          : pseudonymizeContextPack({
              review: {
                ...review,
                schemaVersion: 1,
                selections: selections.map((selection) => {
                  if (selection.entityType === "PROJECT")
                    throw new Error("INVALID_REVIEW");
                  return { ...selection, entityType: selection.entityType };
                }),
              },
              contextPack: draft.packet,
              key,
            });
      const validationKey = crypto.getRandomValues(new Uint8Array(32));
      try {
        transform(validationKey);
      } finally {
        validationKey.fill(0);
      }
      const custody = new PassphraseKeyCustody(this.#home);
      const key = await custody.create(review.mappingSetId, input.passphrase);
      try {
        const transformed = transform(key);
        const store = new EncryptedPrivacyMappingStore(this.#home, key);
        await store.save(transformed.mapping);
        const unlocked = await custody.unlock(
          review.mappingSetId,
          input.passphrase,
        );
        try {
          const reread = await new EncryptedPrivacyMappingStore(
            this.#home,
            unlocked,
          ).read(review.mappingSetId);
          const restored =
            reread.schemaVersion === 2
              ? restorePseudonymizedItemsV2({
                  items: transformed.preview.items,
                  mapping: reread,
                })
              : restorePseudonymizedItems({
                  items: transformed.preview.items,
                  mapping: reread,
                });
          if (
            restored.some(
              (item) =>
                item.content !==
                draft.packet.included.find(
                  (source) => source.id === item.itemId,
                )?.content,
            )
          )
            throw new Error("INVALID_MAPPING");
        } finally {
          unlocked.fill(0);
        }
        items = draft.packet.included.map((item) => ({
          id: item.id,
          content:
            transformed.preview.items.find(
              (changed) => changed.itemId === item.id,
            )?.transformedContent ?? item.content,
        }));
      } finally {
        key.fill(0);
      }
    }
    const serialized = serializeContinuation(items);
    if (Buffer.byteLength(serialized) > 256 * 1024)
      return fail("PAYLOAD_TOO_LARGE");
    const authorizationId = this.#sending
      ? await this.#sending.prepare({
          query,
          mappingId,
          input: {
            projectId: prepared.projectId,
            workItemId: prepared.workItemId,
            handoffId: prepared.handoffId,
            model: prepared.model,
            text: serialized,
            bindingDigest: draft.binding,
            preflightAuditEventHash: draft.auditHash,
            providerKind: "OPENAI_RESPONSES",
            destination: "EXTERNAL",
            maxOutputTokens: 512,
            timeoutMs: 30000,
          },
          current: async () => {
            const target = this.#targets.get(query.projectId!);
            if (!target) return "changed";
            const current = await prepareContinuation(
              this.#sources,
              query,
              target,
            );
            if (!current.prepared) return "changed";
            const currentPolicy = await new LocalModelDataPolicyReader().read(
              current.projectId,
              target.policy,
            );
            return digestCanonical({
              preparation: binding(current, target),
              policy: currentPolicy.sourceDigest,
            });
          },
        })
      : null;
    return {
      ready: true as const,
      text: serialized,
      authorizationId,
      maxOutputTokens: 512,
      timeoutMs: 30000,
      label: draft.target.label,
      model: prepared.model,
      keptAt: prepared.handoffCreatedAt,
      localOnly: true,
      authorized: false,
    };
  }
}
