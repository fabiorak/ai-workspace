import assert from "node:assert/strict";
import { writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { GuiApplication } from "../src/application.ts";
import { continuationFixture } from "./continuation-fixture.ts";

export async function measureContinuationQuality() {
  const fixture = await continuationFixture();
  const { project, root, target } = fixture;
  let app = fixture.app;
  const rows: {
    scenario: string;
    required: string[];
    missing: string[];
    forbidden: string[];
    passed: boolean;
  }[] = [];
  let serial = 0;
  const seen = new Set([fixture.query.conversationId]);
  async function session(texts: string[]) {
    const marker = `continuityprobe${++serial}`;
    const path = join(root, `${marker}.jsonl`);
    await writeFile(
      path,
      [
        JSON.stringify({
          schemaVersion: 1,
          recordType: "session",
          sessionId: marker,
          agent: "codex",
          model: "synthetic-model",
          timestamp: "2026-01-15T09:00:00.000Z",
        }),
        ...texts.map((text, index) =>
          JSON.stringify({
            recordType: "event",
            eventType: "agent_message",
            timestamp: new Date(
              Date.UTC(2026, 0, 15, 9, 0, index + 1),
            ).toISOString(),
            payload: { text: `${marker} ${text}` },
          }),
        ),
      ].join("\n") + "\n",
    );
    const importer = new GuiApplication({
      workspaceHome: fixture.home,
      sampleSessionPath: path,
    });
    await importer.importSample(project.id);
    app = importer;
    const events = (
      await app.search({ projectId: project.id, text: marker })
    ).results.filter((event) => !seen.has(event.sessionId));
    for (const event of events) seen.add(event.sessionId);
    assert.equal(
      events.length,
      texts.length,
      "Every synthetic source must be searchable",
    );
    return { id: events[0]!.sessionId, events };
  }
  async function prepare(
    name: string,
    texts: string[],
    required: string[],
    otherTexts: string[] = [],
    forbidden: string[] = [],
  ) {
    const current = await session(texts);
    const other = otherTexts.length ? await session(otherTexts) : null;
    await app.workItems.create({
      projectId: project.id,
      objective: `Synthetic ${name}`,
      sourceEventIds: [...current.events, ...(other?.events ?? [])].map(
        (e) => e.eventId,
      ),
    });
    const query = { projectId: project.id, conversationId: current.id };
    const point = await app.restartPoints.open(query);
    assert.ok(point && "composition" in point);
    const fixed = await app.restartPoints.fix({
      ...query,
      composition: point.composition,
      nextAction: "Review the source evidence before continuing.",
    });
    assert.ok(fixed && "fixed" in fixed && fixed.fixed);
    assert.equal(
      (await app.continuations.configure(query, target)).ready,
      true,
    );
    const proposal = await app.continuations.propose(
      query,
      "Where were we, why, and what should be checked next?",
      [{ entityType: "CUSTOMER", alias: "Synthetic Customer" }],
    );
    assert.ok(proposal.ready);
    const text = proposal.items.map((i) => i.text).join("\n");
    const missing = required.filter((value) => !text.includes(value));
    const leaked = forbidden.filter((value) => text.includes(value));
    rows.push({
      scenario: name,
      required,
      missing,
      forbidden: leaked,
      passed: missing.length === 0 && leaked.length === 0,
    });
    return { query, proposal };
  }
  try {
    const filler = Array.from(
      { length: 6 },
      (_, i) => `Routine observation ${i}.`,
    );
    await prepare(
      "interrupted-diagnosis",
      [
        "Retrying the synthetic socket failed twice; inspect the lock owner next.",
        ...filler,
      ],
      ["inspect the lock owner"],
    );
    await prepare(
      "remote-decision",
      [
        "Keep the synthetic queue local because offline operation is required.",
        ...filler,
      ],
      ["offline operation is required"],
    );
    await prepare(
      "two-linked-sessions",
      ["The second session checks the queue."],
      ["checksum mismatch"],
      ["First session identified a checksum mismatch."],
    );
    const unrelated = await session([
      "Unrelated work requires the ORANGE_ONLY deployment constraint.",
    ]);
    await app.workItems.create({
      projectId: project.id,
      objective: "Unrelated deployment",
      sourceEventIds: unrelated.events.map((e) => e.eventId),
    });
    await prepare(
      "two-works-same-project",
      ["This work uses the BLUE_ONLY deployment constraint."],
      ["BLUE_ONLY"],
      [],
      ["ORANGE_ONLY"],
    );
    const stale = await prepare(
      "stale-photograph",
      ["The synthetic check was previously pending."],
      ["previously pending"],
    );
    await writeFile(
      join(fixture.repository, "README.md"),
      "Changed after the kept photograph\n",
    );
    const reopened = await app.continuations.open(stale.query);
    assert.ok(reopened.ready && reopened.changed);
    const repositoryChangeDetected = reopened.changed;
    const long = await prepare(
      "long-text-privacy",
      [
        "Synthetic Customer ".repeat(400) +
          "The decisive condition is VIOLET_CHECKSUM.",
      ],
      ["VIOLET_CHECKSUM"],
    );
    const review = await app.continuations.propose(
      long.query,
      "Ask Synthetic Customer about VIOLET_CHECKSUM.",
      [{ entityType: "CUSTOMER", alias: "Synthetic Customer" }],
    );
    assert.ok(review.ready && review.suggestions.length > 0);
    const protectedText = await app.continuations.protect(long.query, {
      proposal: review.proposal,
      selected: review.suggestions.map((s) => s.index),
      manual: [],
      passphrase: "synthetic-local-review-passphrase",
    });
    assert.ok(protectedText.ready);
    assert.ok(!protectedText.text.includes("Synthetic Customer"));
    assert.ok(protectedText.text.includes("VIOLET_CHECKSUM"));
    return {
      schemaVersion: 1,
      synthetic: true,
      gate: rows.every((r) => r.passed) ? "PASS" : "FAIL",
      scenarios: rows,
      repositoryChangeDetected,
      privacyOriginalAbsent: !protectedText.text.includes("Synthetic Customer"),
      providerCalls: 0,
      limitation:
        "Evidence-presence checks through the GUI application path; no model response quality or live utility measurement.",
    };
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
