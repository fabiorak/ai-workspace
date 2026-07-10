import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { CodexSessionSourceAdapter } from "../src/index.ts";

const fixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "session.jsonl",
);

test("parses the controlled Codex fixture and preserves unknown records", async () => {
  const source = await new CodexSessionSourceAdapter().read(fixturePath);

  assert.equal(source.sourceType, "codex");
  assert.equal(source.sourceSessionId, "synthetic-session-001");
  assert.equal(source.events.length, 9);
  assert.deepEqual(
    source.events.map((event) => event.type),
    [
      "USER_MESSAGE",
      "AGENT_MESSAGE",
      "TOOL_CALL",
      "TOOL_RESULT",
      "COMMAND_RESULT",
      "FILE_CHANGE",
      "TEST_RESULT",
      "ERROR",
      "UNKNOWN",
    ],
  );
  assert.match(source.events[8]?.payload ?? "", /future_record/u);
});

test("reports malformed records without including their raw content", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ai-workspace-codex-"));
  const sourcePath = join(directory, "malformed.jsonl");
  const privateMarker = "fictional-private-payload";

  try {
    await writeFile(
      sourcePath,
      `{"schemaVersion":1,"recordType":"session","sessionId":"synthetic","agent":"codex","model":null,"timestamp":null}\n{${privateMarker}\n`,
    );

    await assert.rejects(
      new CodexSessionSourceAdapter().read(sourcePath),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /line 2.*not valid JSON/u);
        assert.doesNotMatch(error.message, new RegExp(privateMarker, "u"));
        return true;
      },
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("explains how to recover when the source file does not exist", async () => {
  const missingPath = join(tmpdir(), "synthetic-missing-session.jsonl");

  await assert.rejects(
    new CodexSessionSourceAdapter().read(missingPath),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /file not found/u);
      assert.match(error.message, /Check the path/u);
      assert.match(
        error.message,
        /integrations\/codex\/test\/fixtures\/session\.jsonl/u,
      );
      return true;
    },
  );
});

test("explains that --file requires a regular file", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ai-workspace-codex-dir-"));

  try {
    await assert.rejects(
      new CodexSessionSourceAdapter().read(directory),
      /not a regular file.*Pass an existing JSONL file with --file/u,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
