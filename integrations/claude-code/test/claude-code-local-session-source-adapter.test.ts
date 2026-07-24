import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { appendFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  SessionIngestion,
  type ImportedSession,
} from "@ai-workspace/session-ingestion";
import {
  ClaudeCodeLocalSessionDiscovery,
  ClaudeCodeLocalSessionSourceAdapter,
} from "../src/index.ts";

const fixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "synthetic-local-session.jsonl",
);

describe("ClaudeCodeLocalSessionSourceAdapter", () => {
  it("converts every real-transcript shape the narrow adapter rejects", async () => {
    const source = await new ClaudeCodeLocalSessionSourceAdapter().read(
      fixturePath,
    );

    assert.equal(source.sourceType, "claude-code-local");
    assert.equal(source.sourceSessionId, "synthetic-local-session-001");
    assert.equal(source.agent, "claude-code");
    assert.equal(source.model, "claude-fictional-1");
    assert.equal(source.startedAt, "2026-07-20T09:00:01.000Z");
    assert.deepEqual(
      source.events.map((event) => event.type),
      [
        "USER_MESSAGE",
        "AGENT_MESSAGE",
        "AGENT_MESSAGE",
        "TOOL_CALL",
        "TOOL_RESULT",
        "AGENT_MESSAGE",
        "USER_MESSAGE",
        "ERROR",
        "UNKNOWN",
        "AGENT_MESSAGE",
      ],
    );
    assert.deepEqual(
      source.events.map((event) => event.position),
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    );
    assert.deepEqual(source.rawContent, await readFile(fixturePath));
  });

  it("keeps reasoning, sidechain, meta, and untimed records distinguishable", async () => {
    const source = await new ClaudeCodeLocalSessionSourceAdapter().read(
      fixturePath,
    );
    const payloads = source.events.map(
      (event) => JSON.parse(event.payload) as Record<string, unknown>,
    );

    assert.equal(payloads[1]?.blockType, "thinking");
    assert.equal(payloads[2]?.blockType, "text");
    assert.equal(payloads[5]?.isSidechain, true);
    assert.equal(payloads[6]?.isMeta, true);
    assert.equal(payloads[8]?.blockType, "image");
    assert.equal(
      payloads[9]?.recordUuid,
      "88888888-8888-4888-8888-888888888888",
    );
    assert.equal(source.events[9]?.occurredAt, null);
    assert.equal(source.events[0]?.occurredAt, "2026-07-20T09:00:01.000Z");
  });

  it("accounts for every record it does not convert", async () => {
    const source = await new ClaudeCodeLocalSessionSourceAdapter().read(
      fixturePath,
    );

    assert.deepEqual(source.skippedRecords, [
      { reason: "BLANK_LINE", count: 1 },
      { reason: "NON_MESSAGE_RECORD_TYPE:attachment", count: 1 },
      { reason: "NON_MESSAGE_RECORD_TYPE:file-history-snapshot", count: 1 },
      { reason: "NON_MESSAGE_RECORD_TYPE:mode", count: 1 },
      { reason: "NON_MESSAGE_RECORD_TYPE:queue-operation", count: 1 },
    ]);
  });

  it("never echoes an unexpected record type into the skip accounting", async () =>
    withFile(
      `{"type":"leaked-marker-value-that-is-far-too-long-to-be-a-token","sessionId":"s"}\n{"type":"user","sessionId":"s","message":{"role":"user","content":"kept"}}\n`,
      async (path) => {
        const source = await new ClaudeCodeLocalSessionSourceAdapter().read(
          path,
        );

        assert.deepEqual(source.skippedRecords, [
          { reason: "NON_MESSAGE_RECORD_TYPE:other", count: 1 },
        ]);
      },
    ));

  it("tolerates an incomplete trailing record of a session still being written", async () =>
    withFile(
      `{"type":"user","sessionId":"s","message":{"role":"user","content":"complete"}}\n{"type":"assistant","sessionId":"s","mess`,
      async (path) => {
        const source = await new ClaudeCodeLocalSessionSourceAdapter().read(
          path,
        );

        assert.equal(source.events.length, 1);
        assert.deepEqual(source.skippedRecords, [
          { reason: "INCOMPLETE_TRAILING_RECORD", count: 1 },
        ]);
      },
    ));

  it("still fails closed on corruption anywhere but the last record", async () =>
    withFile(
      `{"type":"user","sessionId":"s","mess\n{"type":"user","sessionId":"s","message":{"role":"user","content":"later"}}\n`,
      async (path) =>
        assert.rejects(
          new ClaudeCodeLocalSessionSourceAdapter().read(path),
          /line 1: record is not valid JSON/u,
        ),
    ));

  it("accepts CRLF transcripts and rejects unusable ones with actionable messages", async () => {
    await withFile(
      `{"type":"user","sessionId":"s","message":{"role":"user","content":"crlf"}}\r\n`,
      async (path) => {
        const source = await new ClaudeCodeLocalSessionSourceAdapter().read(
          path,
        );

        assert.equal(source.events.length, 1);
      },
    );
    await withFile(`{"type":"mode","sessionId":"s"}\n`, async (path) =>
      assert.rejects(
        new ClaudeCodeLocalSessionSourceAdapter().read(path),
        /no convertible conversation record/u,
      ),
    );
    await withFile(
      `{"type":"user","message":{"role":"user","content":"anonymous"}}\n`,
      async (path) =>
        assert.rejects(
          new ClaudeCodeLocalSessionSourceAdapter().read(path),
          /declares no sessionId/u,
        ),
    );
    await withFile(
      `{"type":"user","sessionId":"a","message":{"role":"user","content":"one"}}\n{"type":"user","sessionId":"b","message":{"role":"user","content":"two"}}\n`,
      async (path) =>
        assert.rejects(
          new ClaudeCodeLocalSessionSourceAdapter().read(path),
          /mixes several sessionId values/u,
        ),
    );
  });

  it("imports incrementally as a live transcript grows and reports the skip accounting", async () =>
    withFile(await readFile(fixturePath, "utf8"), async (path) => {
      let stored: ImportedSession | null = null;
      const ingestion = new SessionIngestion({
        sourceAdapter: new ClaudeCodeLocalSessionSourceAdapter(),
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
        clock: () => new Date("2026-07-24T12:00:00.000Z"),
      });

      const first = await ingestion.import("project", path);

      assert.equal(first.addedEvents, 10);
      assert.equal(first.skippedRecords.length, 5);

      const repeat = await ingestion.import("project", path);

      assert.equal(repeat.addedEvents, 0);
      assert.equal(repeat.totalEvents, 10);

      await appendFile(
        path,
        `{"type":"user","sessionId":"synthetic-local-session-001","message":{"role":"user","content":"appended after the first import"}}\n`,
      );

      const grown = await ingestion.import("project", path);

      assert.equal(grown.addedEvents, 1);
      assert.equal(grown.totalEvents, 11);
    }));

  it("fails closed when an already-imported record is rewritten", async () =>
    withFile(await readFile(fixturePath, "utf8"), async (path) => {
      let stored: ImportedSession | null = null;
      const ingestion = new SessionIngestion({
        sourceAdapter: new ClaudeCodeLocalSessionSourceAdapter(),
        screen: { assertAllowed: () => undefined },
        artifactStore: {
          put: async (content) => ({
            id: createHash("sha256").update(content).digest("hex"),
            byteLength: content.byteLength,
          }),
        },
        sessionStore: {
          load: async () => stored,
          append: async (session) => {
            stored = session;
          },
        },
        projects: { exists: async () => true },
      });

      await ingestion.import("project", path);

      const lines = (await readFile(path, "utf8")).split("\n");

      await writeFile(
        path,
        lines
          .map((line, index) =>
            index === 1 ? line.replace("Summarise", "Explain") : line,
          )
          .join("\n"),
      );
      await assert.rejects(
        ingestion.import("project", path),
        /changed at record/u,
      );
    }));

  it("writes nothing when restricted-data screening rejects a real transcript", async () => {
    let artifactWrites = 0;
    let storeWrites = 0;
    const ingestion = new SessionIngestion({
      sourceAdapter: new ClaudeCodeLocalSessionSourceAdapter(),
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

describe("ClaudeCodeLocalSessionDiscovery", () => {
  it("lists transcripts newest first from filesystem metadata only", async () => {
    const directory = await mkdtemp(
      join(tmpdir(), "ai-workspace-claude-discovery-"),
    );

    try {
      await writeFile(join(directory, "older.jsonl"), "{}\n");
      await writeFile(join(directory, "newer.jsonl"), "{}\n");
      await writeFile(join(directory, "notes.txt"), "ignored\n");

      const candidates = await new ClaudeCodeLocalSessionDiscovery().discover(
        directory,
      );

      assert.deepEqual(
        candidates.map((candidate) => candidate.fileName).sort(),
        ["newer.jsonl", "older.jsonl"],
      );
      assert.equal(candidates.length, 2);
      assert.equal(candidates[0]?.filePath.startsWith(directory), true);
      assert.equal(candidates[0]?.byteLength, 3);
      assert.match(
        candidates[0]!.modifiedAt,
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u,
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("refuses an empty, missing, or non-directory location", async () => {
    const discovery = new ClaudeCodeLocalSessionDiscovery();

    await assert.rejects(discovery.discover("   "), /Name the directory/u);
    await assert.rejects(
      discovery.discover(join(tmpdir(), "ai-workspace-absent-directory")),
      /does not exist/u,
    );
    await withFile("{}\n", async (path) =>
      assert.rejects(discovery.discover(path), /must be a directory/u),
    );
  });
});

async function withFile(
  content: string,
  run: (path: string) => Promise<unknown>,
) {
  const directory = await mkdtemp(
    join(tmpdir(), "ai-workspace-claude-code-local-"),
  );
  const path = join(directory, "synthetic-local.jsonl");

  try {
    await writeFile(path, content);
    await run(path);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
