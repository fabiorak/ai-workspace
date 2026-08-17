import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";

import { LocalTranscriptSourceStore } from "@ai-workspace/local-session-ingestion";

import { transcriptArea } from "../src/transcript-facade.ts";

/**
 * What the product may read without being asked, which is the whole question this
 * area raises. The rule it has to keep is narrow and testable: a directory is read
 * again only because somebody named it and successfully imported from it. Nothing is
 * guessed, no location is probed, and an untouched workspace is never read from.
 */
describe("transcripts that arrive on their own", () => {
  let home: string;
  beforeEach(async () => {
    home = await mkdtemp(join(tmpdir(), "ai-workspace-arrived-"));
  });
  afterEach(async () => {
    await rm(home, { recursive: true, force: true });
  });

  const candidate = (
    directory: string,
    fileName: string,
    byteLength = 100,
    modifiedAt = "2026-08-17T09:00:00.000Z",
  ) => ({
    filePath: join(directory, fileName),
    fileName,
    byteLength,
    modifiedAt,
  });

  /** Records every directory it was asked to read, so a test can assert what was touched. */
  const discoveryOver = (
    contents: Readonly<Record<string, ReturnType<typeof candidate>[]>>,
  ) => {
    const looked: string[] = [];
    return {
      looked,
      discover: async (directory: string) => {
        looked.push(directory);
        const found = contents[directory];
        if (found === undefined) throw new Error("no such directory");
        return found;
      },
    };
  };

  const ingestionOver = (added: Readonly<Record<string, number>>) => {
    const imported: string[] = [];
    return {
      imported,
      import: async (projectId: string, filePath: string) => {
        imported.push(`${projectId}:${filePath}`);
        return {
          session: { id: `session-${imported.length}` },
          addedEvents: added[filePath] ?? 0,
          existingEvents: 0,
          totalEvents: added[filePath] ?? 0,
          skippedRecords: [],
        };
      },
    };
  };

  const areaOver = (
    discovery: ReturnType<typeof discoveryOver>,
    ingestion: ReturnType<typeof ingestionOver>,
  ) =>
    transcriptArea({
      discovery,
      ingestion,
      sources: new LocalTranscriptSourceStore(home),
      guard: async (operation) => operation(),
    });

  it("reads nothing at all when nobody ever pointed at a directory", async () => {
    const discovery = discoveryOver({});
    const ingestion = ingestionOver({});
    const report = await areaOver(discovery, ingestion).arrived();
    assert.deepEqual(discovery.looked, []);
    assert.deepEqual(ingestion.imported, []);
    assert.deepEqual(report, {
      sessions: 0,
      moments: 0,
      directories: 0,
      unreadable: 0,
    });
  });

  it("remembers a directory only after an import from it succeeded", async () => {
    const directory = join(home, "own-transcripts");
    const first = candidate(directory, "one.jsonl");
    const discovery = discoveryOver({ [directory]: [first] });
    const ingestion = ingestionOver({ [first.filePath]: 10 });
    const area = areaOver(discovery, ingestion);

    // Listing alone is not permission: it reads names, not content.
    await area.discover(directory);
    assert.deepEqual(
      await new LocalTranscriptSourceStore(home).list(),
      [],
      "listing a directory must not make it a remembered source",
    );

    await area.import("project-1", first.filePath);
    const remembered = await new LocalTranscriptSourceStore(home).list();
    assert.equal(remembered.length, 1);
    assert.equal(remembered[0]?.projectId, "project-1");
    assert.equal(remembered[0]?.directory, directory);
  });

  it("brings in a file that appeared since, and leaves the unchanged ones alone", async () => {
    const directory = join(home, "own-transcripts");
    const known = candidate(directory, "one.jsonl");
    const discovery = discoveryOver({ [directory]: [known] });
    const ingestion = ingestionOver({ [known.filePath]: 10 });
    await areaOver(discovery, ingestion).import("project-1", known.filePath);

    const fresh = candidate(directory, "two.jsonl", 200);
    const second = discoveryOver({ [directory]: [known, fresh] });
    const secondIngestion = ingestionOver({
      [known.filePath]: 10,
      [fresh.filePath]: 4,
    });
    const report = await areaOver(second, secondIngestion).arrived();
    assert.deepEqual(report, {
      sessions: 2,
      moments: 14,
      directories: 1,
      unreadable: 0,
    });

    // Now both signatures are known, so a third pass imports nothing at all.
    const third = discoveryOver({ [directory]: [known, fresh] });
    const thirdIngestion = ingestionOver({});
    const quiet = await areaOver(third, thirdIngestion).arrived();
    assert.deepEqual(thirdIngestion.imported, []);
    assert.equal(quiet.sessions, 0);
    assert.equal(quiet.directories, 1);
  });

  it("re-reads the directory of every project, not only the last one worked on", async () => {
    const first = join(home, "first-project");
    const second = join(home, "second-project");
    const one = candidate(first, "one.jsonl");
    const two = candidate(second, "two.jsonl");
    const discovery = discoveryOver({ [first]: [one], [second]: [two] });
    const ingestion = ingestionOver({ [one.filePath]: 3, [two.filePath]: 5 });
    const area = areaOver(discovery, ingestion);
    await area.import("project-1", one.filePath);
    await area.import("project-2", two.filePath);

    const later = discoveryOver({
      [first]: [one, candidate(first, "three.jsonl", 300)],
      [second]: [two, candidate(second, "four.jsonl", 400)],
    });
    const laterIngestion = ingestionOver({
      [join(first, "three.jsonl")]: 2,
      [join(second, "four.jsonl")]: 7,
    });
    const report = await areaOver(later, laterIngestion).arrived();
    assert.deepEqual([...later.looked].sort(), [first, second]);
    assert.equal(report.directories, 2);
    assert.equal(report.sessions, 2);
    assert.equal(report.moments, 9);
  });

  it("counts a directory it can no longer read instead of failing the whole start", async () => {
    const present = join(home, "present");
    const moved = join(home, "moved-away");
    const here = candidate(present, "one.jsonl");
    const gone = candidate(moved, "two.jsonl");
    const discovery = discoveryOver({ [present]: [here], [moved]: [gone] });
    const ingestion = ingestionOver({
      [here.filePath]: 1,
      [gone.filePath]: 1,
    });
    const area = areaOver(discovery, ingestion);
    await area.import("project-1", here.filePath);
    await area.import("project-2", gone.filePath);

    const later = discoveryOver({
      [present]: [here, candidate(present, "new.jsonl", 500)],
    });
    const report = await areaOver(
      later,
      ingestionOver({ [join(present, "new.jsonl")]: 6 }),
    ).arrived();
    assert.equal(report.unreadable, 1);
    assert.equal(report.sessions, 1);
    assert.equal(report.moments, 6);
  });
});
