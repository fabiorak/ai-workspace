import {
  ModelDelivery,
  type DeliveryInput,
  type DeliveryTransport,
} from "@ai-workspace/model-delivery";
import { ModelAttempts } from "@ai-workspace/model-attempts";
import { JsonModelAttemptStore } from "@ai-workspace/local-model-attempts";
import { PassphraseKeyCustody } from "@ai-workspace/local-key-custody";
import { EncryptedPrivacyMappingStore } from "@ai-workspace/local-privacy-mapping";
import {
  inspectPseudonymizedOutput,
  detectRestrictedData,
} from "@ai-workspace/privacy-gateway";
import type { ModelConversationWriter } from "./model-conversation.ts";
import type { ContinuationQuery } from "./continuation-preparation.ts";

type Pending = {
  query: ContinuationQuery;
  input: DeliveryInput;
  mappingId: string | null;
  expires: number;
  current: () => Promise<string>;
};
export class ContinuationSending {
  readonly home: string;
  readonly writer: ModelConversationWriter;
  readonly #delivery: ModelDelivery;
  readonly #pending = new Map<string, Pending>();
  constructor(
    home: string,
    transport: DeliveryTransport,
    writer: ModelConversationWriter,
  ) {
    this.home = home;
    this.writer = writer;
    this.#delivery = new ModelDelivery({
      attempts: new ModelAttempts(new JsonModelAttemptStore(home)),
      transport,
    });
  }
  async prepare(pending: Omit<Pending, "expires">) {
    for (const [id, value] of this.#pending)
      if (value.expires <= Date.now()) this.#pending.delete(id);
    if (this.#pending.size >= 20) throw new Error("CAPACITY");
    await this.#delivery.initialize(pending.input.projectId);
    const prepared = this.#delivery.prepare(pending.input);
    this.#pending.set(prepared.authorizationId, {
      ...pending,
      expires: Date.now() + 300000,
    });
    return prepared.authorizationId;
  }
  async send(
    query: ContinuationQuery,
    authorizationId: string,
    passphrase: string,
  ) {
    const pending = this.#pending.get(authorizationId);
    if (
      !pending ||
      pending.query.projectId !== query.projectId ||
      pending.query.conversationId !== query.conversationId ||
      pending.expires <= Date.now()
    )
      return { ready: false as const, reason: "PREPARATION_EXPIRED" };
    // Scope verified, consume before awaiting; retry requires another exact-text review.
    this.#pending.delete(authorizationId);
    let key: Uint8Array | undefined;
    let deliveryStarted = false;
    try {
      const mapping = pending.mappingId
        ? await (async () => {
            key = await new PassphraseKeyCustody(this.home).unlock(
              pending.mappingId!,
              passphrase,
            );
            return new EncryptedPrivacyMappingStore(this.home, key).read(
              pending.mappingId!,
            );
          })()
        : null;
      deliveryStarted = true;
      const result = await this.#delivery.confirm(
        authorizationId,
        pending.input,
        pending.current,
      );
      if (result.kind !== "COMPLETED")
        return { ready: false as const, reason: result.kind };
      let text = result.text;
      if (mapping) {
        const restored = inspectPseudonymizedOutput({
          mapping,
          scope: {
            mappingSetId: mapping.mappingSetId,
            projectId: pending.input.projectId,
            workItemId: pending.input.workItemId,
            handoffId: pending.input.handoffId,
            modelId: pending.input.model,
          },
          output: text,
        });
        if (restored.restoredContent === null)
          return {
            ready: false as const,
            reason: "OUTPUT_RESTORATION_FAILED",
            attemptId: result.attemptId,
          };
        text = restored.restoredContent;
      } else if (/\[\[AW/iu.test(text))
        return {
          ready: false as const,
          reason: "OUTPUT_RESTORATION_FAILED",
          attemptId: result.attemptId,
        };
      if (detectRestrictedData(text) !== null)
        return {
          ready: false as const,
          reason: "OUTPUT_BLOCKED",
          attemptId: result.attemptId,
        };
      try {
        await this.writer.store({
          projectId: pending.input.projectId,
          conversationId: query.conversationId,
          attemptId: result.attemptId,
          model: pending.input.model,
          text,
          occurredAt: new Date().toISOString(),
        });
      } catch {
        return {
          ready: false as const,
          reason: "RESPONSE_NOT_STORED",
          attemptId: result.attemptId,
        };
      }
      return {
        ready: true as const,
        text,
        attemptId: result.attemptId,
        usage: result.usage,
      };
    } catch {
      return {
        ready: false as const,
        reason: deliveryStarted
          ? "RESPONSE_UNAVAILABLE_OR_UNKNOWN"
          : "MAPPING_UNAVAILABLE",
      };
    } finally {
      key?.fill(0);
    }
  }
}
