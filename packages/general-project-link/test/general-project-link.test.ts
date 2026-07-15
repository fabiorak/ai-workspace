import assert from "node:assert/strict";
import test from "node:test";

import type { GeneralConversation } from "@ai-workspace/general-conversation";
import {
  GeneralProjectLinkConflictError,
  GeneralProjectLinkError,
  GeneralProjectLinks,
  type GeneralProjectLink,
} from "../src/index.ts";

const contentHash = "a".repeat(64);
const conversation: GeneralConversation = Object.freeze({
  id: "general-a",
  scope: "GENERAL",
  title: "Fictional",
  createdAt: "2026-07-15T10:00:00.000Z",
  events: Object.freeze([
    {
      id: "event-a",
      conversationId: "general-a",
      sequence: 0,
      scope: "GENERAL",
      type: "USER_MESSAGE",
      occurredAt: "2026-07-15T10:00:00.000Z",
      actor: "LOCAL_USER",
      origin: "USER_AUTHORED",
      verification: "UNVERIFIED",
      dataClass: "CONFIDENTIAL",
      content: "fictional",
      exactBytes: 9,
      contentSha256: contentHash,
      provenance: {
        kind: "LOCAL_GENERAL_CAPTURE",
        capturedAt: "2026-07-15T10:00:00.000Z",
      },
    } as const,
  ]),
});

test("creates an explicit immutable link bound to the exact General hash", async () => {
  const links: GeneralProjectLink[] = [];
  const service = fixture(links);
  const link = await service.create({
    generalConversationId: "general-a",
    generalEventId: "event-a",
    generalContentSha256: contentHash,
    targetProjectId: "project-a",
    rationale: "Relevant to the fictional parser",
  });
  assert.deepEqual(
    {
      source: link.sourceScope,
      target: link.targetScope,
      effect: link.effect,
      actor: link.actor,
      verification: link.verification,
    },
    {
      source: "GENERAL",
      target: "PROJECT",
      effect: "LINK_ONLY",
      actor: "LOCAL_USER",
      verification: "UNVERIFIED",
    },
  );
  assert.equal(links.length, 1);
});

test("rejects stale hashes, missing projects, duplicates, and restricted rationale without echo", async () => {
  const links: GeneralProjectLink[] = [];
  const service = fixture(links);
  await assert.rejects(
    () =>
      service.create({
        generalConversationId: "general-a",
        generalEventId: "event-a",
        generalContentSha256: "b".repeat(64),
        targetProjectId: "project-a",
        rationale: "Fictional relevance",
      }),
    /stale/u,
  );
  await assert.rejects(
    () =>
      service.create({
        generalConversationId: "general-a",
        generalEventId: "event-a",
        generalContentSha256: contentHash,
        targetProjectId: "missing",
        rationale: "Fictional relevance",
      }),
    /not registered/u,
  );
  const secret = "sk-abcdefghijklmnopqrstuvwxyz123456";
  await assert.rejects(
    () =>
      service.create({
        generalConversationId: "general-a",
        generalEventId: "event-a",
        generalContentSha256: contentHash,
        targetProjectId: "project-a",
        rationale: secret,
      }),
    (error: unknown) =>
      error instanceof GeneralProjectLinkError &&
      !error.message.includes(secret),
  );
  assert.equal(links.length, 0);
});

function fixture(links: GeneralProjectLink[]) {
  return new GeneralProjectLinks({
    general: {
      find: async (id) => (id === conversation.id ? conversation : null),
    },
    projects: { exists: async (id) => id === "project-a" },
    ids: () => "link-a",
    clock: () => new Date("2026-07-15T11:00:00.000Z"),
    store: {
      list: async () => links,
      create: async (link) => {
        if (
          links.some(
            (item) =>
              item.generalEventId === link.generalEventId &&
              item.generalContentSha256 === link.generalContentSha256 &&
              item.targetProjectId === link.targetProjectId,
          )
        )
          throw new GeneralProjectLinkConflictError();
        links.push(link);
        return link;
      },
    },
  });
}
