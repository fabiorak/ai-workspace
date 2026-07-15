import { createHash } from "node:crypto";

import type { GeneralConversationStore } from "@ai-workspace/general-conversation";
import { detectRestrictedData } from "@ai-workspace/privacy-gateway";

export const GENERAL_PROJECT_LINK_LIMITS = Object.freeze({
  rationaleBytes: 2_000,
  links: 10_000,
});

export class GeneralProjectLinkError extends Error {
  public constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "GeneralProjectLinkError";
  }
}

export class GeneralProjectLinkConflictError extends GeneralProjectLinkError {
  public constructor(
    message = "This exact General evidence is already linked to the target project. Reload immutable links and do not create a duplicate.",
  ) {
    super(message);
    this.name = "GeneralProjectLinkConflictError";
  }
}

export type GeneralProjectLink = Readonly<{
  id: string;
  sourceScope: "GENERAL";
  generalConversationId: string;
  generalEventId: string;
  generalContentSha256: string;
  targetScope: "PROJECT";
  targetProjectId: string;
  rationale: string;
  rationaleExactBytes: number;
  rationaleSha256: string;
  createdAt: string;
  actor: "LOCAL_USER";
  origin: "USER_AUTHORED";
  verification: "UNVERIFIED";
  dataClass: "CONFIDENTIAL";
  effect: "LINK_ONLY";
}>;

export type GeneralProjectLinkStore = Readonly<{
  list(): Promise<readonly GeneralProjectLink[]>;
  create(link: GeneralProjectLink): Promise<GeneralProjectLink>;
}>;

export type GeneralProjectLinksDependencies = Readonly<{
  store: GeneralProjectLinkStore;
  general: Pick<GeneralConversationStore, "find">;
  projects: Readonly<{ exists(projectId: string): Promise<boolean> }>;
  ids: () => string;
  clock: () => Date;
}>;

export class GeneralProjectLinks {
  readonly #dependencies: GeneralProjectLinksDependencies;

  public constructor(dependencies: GeneralProjectLinksDependencies) {
    this.#dependencies = dependencies;
  }

  public list(): Promise<readonly GeneralProjectLink[]> {
    return this.#dependencies.store.list();
  }

  public async create(
    input: Readonly<{
      generalConversationId: string;
      generalEventId: string;
      generalContentSha256: string;
      targetProjectId: string;
      rationale: string;
    }>,
  ): Promise<GeneralProjectLink> {
    const conversationId = requiredText(
      input.generalConversationId,
      "General conversation ID",
      256,
    );
    const eventId = requiredText(input.generalEventId, "General event ID", 256);
    const expectedHash = digest(
      input.generalContentSha256,
      "General content hash",
    );
    const projectId = requiredText(
      input.targetProjectId,
      "Target project ID",
      256,
    );
    const rationale = requiredText(
      input.rationale,
      "Rationale",
      GENERAL_PROJECT_LINK_LIMITS.rationaleBytes,
    );
    const restricted = detectRestrictedData(rationale);
    if (restricted !== null)
      throw new GeneralProjectLinkError(
        `Restricted data category '${restricted}' detected; link creation was blocked. Remove the sensitive value and retry.`,
      );

    const [conversation, projectExists] = await Promise.all([
      this.#dependencies.general.find(conversationId),
      this.#dependencies.projects.exists(projectId),
    ]);
    if (conversation === null || conversation.scope !== "GENERAL")
      throw new GeneralProjectLinkError(
        "The explicit General conversation or event was not found. Reload General evidence and retry.",
      );
    const event = conversation.events.find(
      (candidate) => candidate.id === eventId,
    );
    if (
      event === undefined ||
      event.conversationId !== conversationId ||
      event.scope !== "GENERAL"
    )
      throw new GeneralProjectLinkError(
        "The explicit General conversation or event was not found. Reload General evidence and retry.",
      );
    if (event.contentSha256 !== expectedHash)
      throw new GeneralProjectLinkError(
        "The General content hash is stale. Reload the immutable event, review it again, and retry.",
      );
    if (!projectExists)
      throw new GeneralProjectLinkError(
        "The explicit target project is not registered. Register or reload the project and retry.",
      );

    const createdAt = timestamp(this.#dependencies.clock());
    const link: GeneralProjectLink = Object.freeze({
      id: requiredText(this.#dependencies.ids(), "Link ID", 256),
      sourceScope: "GENERAL",
      generalConversationId: conversationId,
      generalEventId: eventId,
      generalContentSha256: expectedHash,
      targetScope: "PROJECT",
      targetProjectId: projectId,
      rationale,
      rationaleExactBytes: Buffer.byteLength(rationale, "utf8"),
      rationaleSha256: sha256(rationale),
      createdAt,
      actor: "LOCAL_USER",
      origin: "USER_AUTHORED",
      verification: "UNVERIFIED",
      dataClass: "CONFIDENTIAL",
      effect: "LINK_ONLY",
    });
    return this.#dependencies.store.create(link);
  }
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
    throw new GeneralProjectLinkError(
      `${label} must be non-empty text without control characters and at most ${maximumBytes} UTF-8 bytes.`,
    );
  return text;
}
function digest(value: string, label: string): string {
  const normalized = value.trim();
  if (!/^[a-f0-9]{64}$/u.test(normalized))
    throw new GeneralProjectLinkError(
      `${label} must be an exact lowercase SHA-256 digest.`,
    );
  return normalized;
}
function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
function timestamp(value: Date): string {
  if (Number.isNaN(value.getTime()))
    throw new GeneralProjectLinkError(
      "The local clock did not provide a valid link timestamp.",
    );
  return value.toISOString();
}
