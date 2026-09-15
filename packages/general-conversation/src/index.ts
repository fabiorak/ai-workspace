import { createHash } from "node:crypto";

import { detectRestrictedData } from "@ai-workspace/privacy-gateway";

export const GENERAL_LIMITS = Object.freeze({
  titleBytes: 200,
  contentBytes: 64 * 1024,
  eventsPerConversation: 1_000,
});

export class GeneralConversationError extends Error {
  public constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "GeneralConversationError";
  }
}

export class GeneralConversationConflictError extends GeneralConversationError {
  public constructor() {
    super(
      "General conversation changed concurrently. Reload its immutable events and retry with the current event count.",
    );
    this.name = "GeneralConversationConflictError";
  }
}

type GeneralEventBase = Readonly<{
  id: string;
  conversationId: string;
  sequence: number;
  scope: "GENERAL";
  occurredAt: string;
  verification: "UNVERIFIED";
  dataClass: "CONFIDENTIAL";
  content: string;
  exactBytes: number;
  contentSha256: string;
}>;

export type GeneralEvent =
  | (GeneralEventBase &
      Readonly<{
        type: "USER_MESSAGE";
        actor: "LOCAL_USER";
        origin: "USER_AUTHORED";
        provenance: Readonly<{
          kind: "LOCAL_GENERAL_CAPTURE";
          capturedAt: string;
        }>;
      }>)
  | (GeneralEventBase &
      Readonly<{
        type: "AGENT_MESSAGE";
        actor: "MODEL";
        origin: "MODEL_GENERATED";
        provenance: Readonly<{
          kind: "MODEL_CONVERSATION";
          attemptId: string;
          displayName: string;
          model: string;
          targetId: string;
        }>;
      }>);

export type GeneralConversation = Readonly<{
  id: string;
  scope: "GENERAL";
  title: string;
  createdAt: string;
  events: readonly GeneralEvent[];
}>;

export type GeneralConversationStore = Readonly<{
  list(): Promise<readonly GeneralConversation[]>;
  find(id: string): Promise<GeneralConversation | null>;
  create(conversation: GeneralConversation): Promise<GeneralConversation>;
  append(
    id: string,
    expectedEventCount: number,
    event: GeneralEvent,
  ): Promise<GeneralConversation>;
  appendMany(
    id: string,
    expectedEventCount: number,
    events: readonly GeneralEvent[],
  ): Promise<GeneralConversation>;
}>;

export type GeneralConversationDependencies = Readonly<{
  store: GeneralConversationStore;
  ids: () => string;
  clock: () => Date;
}>;

export class GeneralConversations {
  readonly #dependencies: GeneralConversationDependencies;

  public constructor(dependencies: GeneralConversationDependencies) {
    this.#dependencies = dependencies;
  }

  public list(): Promise<readonly GeneralConversation[]> {
    return this.#dependencies.store.list();
  }

  public async show(idValue: string): Promise<GeneralConversation> {
    const id = requiredText(idValue, "Conversation ID", 256);
    const conversation = await this.#dependencies.store.find(id);
    if (conversation === null)
      throw new GeneralConversationError(
        "General conversation was not found. Return to the General Inbox and reload the immutable list.",
      );
    return conversation;
  }

  public async create(titleValue: string): Promise<GeneralConversation> {
    const title = requiredText(titleValue, "Title", GENERAL_LIMITS.titleBytes);
    const createdAt = timestamp(this.#dependencies.clock());
    return this.#dependencies.store.create(
      Object.freeze({
        id: requiredText(this.#dependencies.ids(), "Conversation ID", 256),
        scope: "GENERAL" as const,
        title,
        createdAt,
        events: Object.freeze([]),
      }),
    );
  }

  public async append(
    input: Readonly<{
      conversationId: string;
      expectedEventCount: number;
      content: string;
    }>,
  ): Promise<GeneralConversation> {
    const conversationId = requiredText(
      input.conversationId,
      "Conversation ID",
      256,
    );
    if (
      !Number.isSafeInteger(input.expectedEventCount) ||
      input.expectedEventCount < 0 ||
      input.expectedEventCount >= GENERAL_LIMITS.eventsPerConversation
    )
      throw new GeneralConversationError(
        "Expected event count is invalid or the bounded conversation is full. Start a new General conversation.",
      );
    const content = requiredText(
      input.content,
      "Question",
      GENERAL_LIMITS.contentBytes,
    );
    const restricted = detectRestrictedData(content);
    if (restricted !== null)
      throw new GeneralConversationError(
        `Restricted data category '${restricted}' detected; capture was blocked. Remove the sensitive value and retry.`,
      );
    const occurredAt = timestamp(this.#dependencies.clock());
    const event: GeneralEvent = Object.freeze({
      id: requiredText(this.#dependencies.ids(), "Event ID", 256),
      conversationId,
      sequence: input.expectedEventCount,
      scope: "GENERAL",
      type: "USER_MESSAGE",
      occurredAt,
      actor: "LOCAL_USER",
      origin: "USER_AUTHORED",
      verification: "UNVERIFIED",
      dataClass: "CONFIDENTIAL",
      content,
      exactBytes: Buffer.byteLength(content, "utf8"),
      contentSha256: createHash("sha256").update(content, "utf8").digest("hex"),
      provenance: Object.freeze({
        kind: "LOCAL_GENERAL_CAPTURE",
        capturedAt: occurredAt,
      }),
    });
    return this.#dependencies.store.append(
      conversationId,
      input.expectedEventCount,
      event,
    );
  }

  public async appendTurn(
    input: Readonly<{
      conversationId: string;
      expectedEventCount: number;
      userText: string;
      assistantText: string;
      attemptId: string;
      displayName: string;
      model: string;
      targetId: string;
    }>,
  ): Promise<GeneralConversation> {
    const conversationId = requiredText(
      input.conversationId,
      "Conversation ID",
      256,
    );
    if (
      !Number.isSafeInteger(input.expectedEventCount) ||
      input.expectedEventCount < 0 ||
      input.expectedEventCount + 2 > GENERAL_LIMITS.eventsPerConversation
    )
      throw new GeneralConversationError(
        "Expected event count is invalid or the bounded conversation cannot hold another turn. Start a new General conversation.",
      );
    const userText = safeContent(input.userText, "Question");
    const assistantText = safeContent(input.assistantText, "Model response");
    const attemptId = requiredText(input.attemptId, "Attempt ID", 256);
    const displayName = requiredText(input.displayName, "Display name", 120);
    const model = requiredText(input.model, "Model", 256);
    const targetId = requiredText(input.targetId, "Target ID", 256);
    const occurredAt = timestamp(this.#dependencies.clock());
    const event = (
      sequence: number,
      content: string,
      details:
        | Readonly<{
            type: "USER_MESSAGE";
            actor: "LOCAL_USER";
            origin: "USER_AUTHORED";
            provenance: Readonly<{
              kind: "LOCAL_GENERAL_CAPTURE";
              capturedAt: string;
            }>;
          }>
        | Readonly<{
            type: "AGENT_MESSAGE";
            actor: "MODEL";
            origin: "MODEL_GENERATED";
            provenance: Readonly<{
              kind: "MODEL_CONVERSATION";
              attemptId: string;
              displayName: string;
              model: string;
              targetId: string;
            }>;
          }>,
    ): GeneralEvent =>
      Object.freeze({
        id: requiredText(this.#dependencies.ids(), "Event ID", 256),
        conversationId,
        sequence,
        scope: "GENERAL" as const,
        occurredAt,
        verification: "UNVERIFIED" as const,
        dataClass: "CONFIDENTIAL" as const,
        content,
        exactBytes: Buffer.byteLength(content, "utf8"),
        contentSha256: createHash("sha256")
          .update(content, "utf8")
          .digest("hex"),
        ...details,
      });
    return this.#dependencies.store.appendMany(
      conversationId,
      input.expectedEventCount,
      Object.freeze([
        event(input.expectedEventCount, userText, {
          type: "USER_MESSAGE",
          actor: "LOCAL_USER",
          origin: "USER_AUTHORED",
          provenance: { kind: "LOCAL_GENERAL_CAPTURE", capturedAt: occurredAt },
        }),
        event(input.expectedEventCount + 1, assistantText, {
          type: "AGENT_MESSAGE",
          actor: "MODEL",
          origin: "MODEL_GENERATED",
          provenance: {
            kind: "MODEL_CONVERSATION",
            attemptId,
            displayName,
            model,
            targetId,
          },
        }),
      ]),
    );
  }
}

function safeContent(value: string, label: string): string {
  const content = requiredText(value, label, GENERAL_LIMITS.contentBytes);
  const restricted = detectRestrictedData(content);
  if (restricted !== null)
    throw new GeneralConversationError(
      `Restricted data category '${restricted}' detected; ${label.toLowerCase()} storage was blocked. Remove the sensitive value and retry.`,
    );
  return content;
}

function requiredText(
  value: string,
  label: string,
  maximumBytes: number,
): string {
  const text = value.trim();
  if (
    text.length === 0 ||
    Buffer.byteLength(text, "utf8") > maximumBytes ||
    /\p{Cc}/u.test(text)
  )
    throw new GeneralConversationError(
      `${label} must be non-empty text without control characters and at most ${maximumBytes} UTF-8 bytes.`,
    );
  return text;
}

function timestamp(value: Date): string {
  if (Number.isNaN(value.getTime()))
    throw new GeneralConversationError(
      "The local clock did not provide a valid capture timestamp.",
    );
  return value.toISOString();
}
