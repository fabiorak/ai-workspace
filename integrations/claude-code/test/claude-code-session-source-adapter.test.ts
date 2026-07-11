import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  SessionIngestion,
  type ImportedSession,
} from "@ai-workspace/session-ingestion";
import { ClaudeCodeSessionSourceAdapter } from "../src/index.ts";

const fixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "synthetic-session.jsonl",
);
describe("ClaudeCodeSessionSourceAdapter", () => {
  it("expands the reviewed synthetic subset deterministically and preserves raw line bytes", async () => {
    const source = await new ClaudeCodeSessionSourceAdapter().read(fixturePath);
    assert.equal(source.sourceType, "claude-code");
    assert.equal(source.sourceSessionId, "synthetic-claude-session-001");
    assert.equal(source.model, "synthetic-claude-model");
    assert.deepEqual(
      source.events.map((event) => event.type),
      [
        "USER_MESSAGE",
        "AGENT_MESSAGE",
        "TOOL_CALL",
        "TOOL_RESULT",
        "AGENT_MESSAGE",
      ],
    );
    assert.deepEqual(
      source.events.map((event) => event.position),
      [1, 2, 3, 4, 5],
    );
    assert.deepEqual(source.events[1]?.rawRecord, source.events[2]?.rawRecord);
    assert.equal(JSON.parse(source.events[2]!.payload).blockIndex, 1);
    assert.deepEqual(source.rawContent, await readFile(fixturePath));
  });
  it("rejects unsupported blocks without echoing content", async () =>
    withFile(
      '{"type":"assistant","uuid":"u","sessionId":"s","timestamp":"2026-07-10T08:00:00.000Z","message":{"role":"assistant","model":"m","content":[{"type":"future_private_marker"}]}}\n',
      async (path) => {
        await assert.rejects(
          new ClaudeCodeSessionSourceAdapter().read(path),
          (error: unknown) => {
            assert.ok(error instanceof Error);
            assert.match(error.message, /unsupported content block/u);
            assert.equal(
              error.message.includes("future_private_marker"),
              false,
            );
            return true;
          },
        );
      },
    ));
  it("rejects malformed, inconsistent, and truncated structural inputs", async () => {
    await withFile("{private_marker\n", async (path) =>
      assert.rejects(
        new ClaudeCodeSessionSourceAdapter().read(path),
        /not valid JSON/u,
      ),
    );
    const first =
      '{"type":"user","uuid":"u1","sessionId":"s1","timestamp":"2026-07-10T08:00:00.000Z","message":{"role":"user","content":"one"}}';
    const second =
      '{"type":"user","uuid":"u2","sessionId":"s2","timestamp":"2026-07-10T08:00:01.000Z","message":{"role":"user","content":"two"}}';
    await withFile(`${first}\n${second}\n`, async (path) =>
      assert.rejects(
        new ClaudeCodeSessionSourceAdapter().read(path),
        /sessionId changes/u,
      ),
    );
  });
  it("inherits stable idempotency, truncation, and changed-prefix checks", async () =>
    withFile(await readFile(fixturePath, "utf8"), async (path) => {
      let stored: ImportedSession | null = null;
      const ingestion = new SessionIngestion({
        sourceAdapter: new ClaudeCodeSessionSourceAdapter(),
        screen: { assertAllowed: () => undefined },
        artifactStore: {
          put: async (content) => ({
            id: createHash("sha256").update(content).digest("hex"),
            byteLength: content.byteLength,
          }),
        },
        sessionStore: {
          load: async () => stored,
          append: async (session, expected) => {
            assert.equal(stored?.events.length ?? 0, expected);
            stored = session;
          },
        },
        projects: { exists: async () => true },
        clock: () => new Date("2026-07-11T12:00:00.000Z"),
      });
      const first = await ingestion.import("project", path);
      const repeat = await ingestion.import("project", path);
      assert.equal(first.addedEvents, 5);
      assert.equal(repeat.addedEvents, 0);
      const lines = (await readFile(path, "utf8")).trimEnd().split("\n");
      await writeFile(path, `${lines.slice(0, 2).join("\n")}\n`);
      await assert.rejects(ingestion.import("project", path), /truncated/u);
      await writeFile(
        path,
        `${lines.map((line, index) => (index === 0 ? line.replace("Inspect", "Review") : line)).join("\n")}\n`,
      );
      await assert.rejects(
        ingestion.import("project", path),
        /changed at record 1/u,
      );
    }));
  it("does not write when restricted-data screening rejects", async () => {
    let artifactWrites = 0;
    let storeWrites = 0;
    const ingestion = new SessionIngestion({
      sourceAdapter: new ClaudeCodeSessionSourceAdapter(),
      screen: {
        assertAllowed: () => {
          throw new Error("synthetic restricted-data rejection");
        },
      },
      artifactStore: {
        put: async () => {
          artifactWrites += 1;
          return { id: "unused", byteLength: 0 };
        },
      },
      sessionStore: {
        load: async () => null,
        append: async () => {
          storeWrites += 1;
        },
      },
      projects: { exists: async () => true },
    });
    await assert.rejects(ingestion.import("project", fixturePath));
    assert.equal(artifactWrites, 0);
    assert.equal(storeWrites, 0);
  });
});
async function withFile(
  content: string,
  run: (path: string) => Promise<unknown>,
) {
  const directory = await mkdtemp(join(tmpdir(), "ai-workspace-claude-code-"));
  const path = join(directory, "synthetic.jsonl");
  try {
    await writeFile(path, content);
    await run(path);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
