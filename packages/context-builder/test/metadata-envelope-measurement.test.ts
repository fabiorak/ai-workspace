import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import {
  buildContextPack,
  CONTINUITY_SECTION_ORDER,
  expandMetadataEnvelope,
  measureMetadataEnvelopeCorpus,
  MetadataEnvelopeError,
  projectMetadataEnvelope,
  type MetadataEnvelopeCorpusCase,
  type MetadataEnvelopeItemKind,
  type MetadataEnvelopePacket,
} from "../src/index.ts";
import {
  buildSyntheticContinuityBudgets,
  buildSyntheticContinuityHandoff,
  SYNTHETIC_CONTINUITY_PROFILES,
} from "./synthetic-context-corpus.ts";

type MutablePacket = {
  -readonly [Key in keyof MetadataEnvelopePacket]: Key extends "items"
    ? Array<{ id: string; kind: MetadataEnvelopeItemKind; content: string }>
    : MetadataEnvelopePacket[Key];
};

function corpus(): readonly MetadataEnvelopeCorpusCase[] {
  return Object.freeze(
    Object.keys(SYNTHETIC_CONTINUITY_PROFILES).map((profile) =>
      Object.freeze({
        label: profile,
        handoff: buildSyntheticContinuityHandoff(
          profile as keyof typeof SYNTHETIC_CONTINUITY_PROFILES,
        ),
        budgets: buildSyntheticContinuityBudgets(),
      }),
    ),
  );
}

function report() {
  return measureMetadataEnvelopeCorpus(corpus());
}

function mutable(packet: MetadataEnvelopePacket): MutablePacket {
  return structuredClone(packet) as MutablePacket;
}

function table(packet: MutablePacket, index: number) {
  return JSON.parse(packet.items[index]!.content) as {
    projectId: string;
    workItemId: string;
    handoffId: string;
    entries: Array<Record<string, unknown>>;
  };
}

function replaceTable(
  packet: MutablePacket,
  index: number,
  value: ReturnType<typeof table>,
) {
  packet.items[index]!.content = JSON.stringify(value);
}

describe("Context Pack metadata envelope measurement", () => {
  it("keeps EMBEDDED byte-identical to current Context Builder candidates", () => {
    for (const value of corpus()) {
      const embedded = projectMetadataEnvelope(value.handoff).EMBEDDED;
      const preview = buildContextPack({
        handoff: value.handoff,
        budgets: { CONTINUITY: 100_000, INSTRUCTIONS: 1 },
      });
      assert.deepEqual(
        embedded.packet.items.map((item) => item.content),
        preview.included.map((item) => item.content),
      );
      assert.equal(
        embedded.exactBytes,
        preview.included.reduce((total, item) => total + item.exactBytes, 0),
      );
    }
  });

  it("expands every alternative losslessly with section trust and navigation intact", () => {
    for (const value of corpus()) {
      const representations = projectMetadataEnvelope(value.handoff);
      for (const representation of Object.values(representations)) {
        const expanded = expandMetadataEnvelope(representation.packet);
        assert.deepEqual(expanded, value.handoff.sections);
        for (const sectionName of CONTINUITY_SECTION_ORDER) {
          const section = expanded[sectionName];
          const original = value.handoff.sections[sectionName];
          assert.equal(Object.isFrozen(section.metadata), true);
          assert.equal(Object.isFrozen(section.metadata.sources), true);
          assert.deepEqual(
            original.metadata.sources.map((source) => ({
              eventId: source.eventId,
              sessionId: source.sessionId,
              artifactId: source.sourceArtifactId,
              position: source.sourcePosition,
              recordHash: source.sourceRecordHash,
            })),
            section.metadata.sources.map((source) => ({
              eventId: source.eventId,
              sessionId: source.sessionId,
              artifactId: source.sourceArtifactId,
              position: source.sourcePosition,
              recordHash: source.sourceRecordHash,
            })),
          );
        }
      }
    }
  });

  it("preserves section-specific trust while sharing sources and metadata", () => {
    const handoff = buildSyntheticContinuityHandoff("working");
    const representation = projectMetadataEnvelope(handoff).METADATA_TABLE;
    assert.equal(representation.tableCounts.sources, 1);
    assert.ok(representation.tableCounts.metadata > 1);
    const expanded = expandMetadataEnvelope(representation.packet);
    assert.equal(expanded.objective.metadata.trust, "USER_CURATED");
    assert.equal(expanded.repository.metadata.trust, "OBSERVED");
    assert.equal(expanded.sourceReferences.metadata.trust, "UNTRUSTED");
  });

  it("uses deterministic IDs and canonical ordering under permuted occurrences", () => {
    const original = buildSyntheticContinuityHandoff("compact");
    const first = original.sections.objective.metadata.sources[0]!;
    const second = Object.freeze({
      ...first,
      eventId: "synthetic-event-0002",
      sessionId: "synthetic-session-0002",
      sourcePosition: 1,
      sourceRecordHash: "d".repeat(64),
    });
    const withSources = (sources: readonly (typeof first)[]) =>
      ({
        ...original,
        sections: Object.fromEntries(
          Object.entries(original.sections).map(([name, section]) => [
            name,
            {
              ...section,
              metadata: { ...section.metadata, sources },
            },
          ]),
        ),
      }) as typeof original;
    const forward = projectMetadataEnvelope(withSources([first, second]));
    const reversed = projectMetadataEnvelope(withSources([second, first]));
    assert.deepEqual(forward, reversed);
    for (const representation of Object.values(forward))
      assert.deepEqual(
        expandMetadataEnvelope(representation.packet),
        expandMetadataEnvelope(
          projectMetadataEnvelope(withSources([second, first]))[
            representation.alternative
          ].packet,
        ),
      );
  });

  it("reports three profiles, nine observations, exact reconciliation, and stable ordering", () => {
    const measured = report();
    assert.equal(measured.profileCount, 3);
    assert.equal(measured.budgetObservationCount, 9);
    assert.deepEqual(measured, report());
    for (const profile of measured.profiles)
      for (const alternative of Object.values(profile.alternatives))
        assert.equal(
          alternative.exactBytes,
          alternative.byteCategories.sourceTable +
            alternative.byteCategories.metadataTable +
            alternative.byteCategories.sections,
        );
    const permuted = [...corpus()].reverse().map((value) => ({
      ...value,
      budgets: [...value.budgets].reverse(),
    }));
    assert.deepEqual(report(), measureMetadataEnvelopeCorpus(permuted));
  });

  it("rejects dangling, duplicate, unreferenced, noncanonical, malformed, cross-scope, and inconsistent data", () => {
    const representation = projectMetadataEnvelope(
      buildSyntheticContinuityHandoff("compact"),
    ).SOURCE_TABLE;

    const dangling = mutable(representation.packet);
    const danglingSection = JSON.parse(dangling.items[1]!.content) as {
      metadata: { sourceIds: string[] };
    };
    danglingSection.metadata.sourceIds[0] = `source:sha256:${"0".repeat(64)}`;
    dangling.items[1]!.content = JSON.stringify(danglingSection);
    assert.throws(
      () => expandMetadataEnvelope(dangling),
      MetadataEnvelopeError,
    );

    const duplicateReference = mutable(representation.packet);
    const duplicateSection = JSON.parse(
      duplicateReference.items[1]!.content,
    ) as {
      metadata: { sourceIds: string[] };
    };
    duplicateSection.metadata.sourceIds.push(
      duplicateSection.metadata.sourceIds[0]!,
    );
    duplicateReference.items[1]!.content = JSON.stringify(duplicateSection);
    assert.throws(
      () => expandMetadataEnvelope(duplicateReference),
      MetadataEnvelopeError,
    );

    const duplicateEntry = mutable(representation.packet);
    const duplicateSourceTable = table(duplicateEntry, 0);
    duplicateSourceTable.entries.push(duplicateSourceTable.entries[0]!);
    replaceTable(duplicateEntry, 0, duplicateSourceTable);
    assert.throws(
      () => expandMetadataEnvelope(duplicateEntry),
      MetadataEnvelopeError,
    );

    const noncanonical = mutable(representation.packet);
    [noncanonical.items[1], noncanonical.items[2]] = [
      noncanonical.items[2]!,
      noncanonical.items[1]!,
    ];
    assert.throws(
      () => expandMetadataEnvelope(noncanonical),
      MetadataEnvelopeError,
    );

    const unreferenced = mutable(representation.packet);
    const unreferencedTable = table(unreferenced, 0);
    const source = structuredClone(
      unreferencedTable.entries[0]!.source,
    ) as Record<string, unknown>;
    source.eventId = "unreferenced-event";
    source.sourcePosition = 99;
    const key = JSON.stringify([
      source.eventId,
      source.sessionId,
      source.eventType,
      source.trust,
      source.sourceArtifactId,
      source.sourcePosition,
      source.sourceRecordHash,
    ]);
    unreferencedTable.entries.push({
      id: `source:sha256:${createHash("sha256").update(key).digest("hex")}`,
      source,
    });
    unreferencedTable.entries.sort((left, right) =>
      String(left.id).localeCompare(String(right.id), "en"),
    );
    replaceTable(unreferenced, 0, unreferencedTable);
    assert.throws(
      () => expandMetadataEnvelope(unreferenced),
      MetadataEnvelopeError,
    );

    const malformed = mutable(representation.packet);
    const malformedTable = table(malformed, 0);
    delete (malformedTable.entries[0]!.source as Record<string, unknown>)
      .sourceRecordHash;
    replaceTable(malformed, 0, malformedTable);
    assert.throws(
      () => expandMetadataEnvelope(malformed),
      MetadataEnvelopeError,
    );

    const crossScope = mutable(representation.packet);
    const crossScopeTable = table(crossScope, 0);
    crossScopeTable.projectId = "foreign-project";
    replaceTable(crossScope, 0, crossScopeTable);
    assert.throws(
      () => expandMetadataEnvelope(crossScope),
      MetadataEnvelopeError,
    );

    const inconsistent = mutable(
      projectMetadataEnvelope(buildSyntheticContinuityHandoff("compact"))
        .METADATA_TABLE.packet,
    );
    const inconsistentSection = JSON.parse(inconsistent.items[2]!.content) as {
      metadataId: string;
    };
    inconsistentSection.metadataId = `metadata:sha256:${"0".repeat(64)}`;
    inconsistent.items[2]!.content = JSON.stringify(inconsistentSection);
    assert.throws(
      () => expandMetadataEnvelope(inconsistent),
      MetadataEnvelopeError,
    );

    const oversizedReferences = mutable(representation.packet);
    const oversizedSection = JSON.parse(
      oversizedReferences.items[1]!.content,
    ) as { metadata: { sourceIds: string[] } };
    oversizedSection.metadata.sourceIds = Array.from(
      { length: 101 },
      (_, index) => `source:sha256:${index.toString(16).padStart(64, "0")}`,
    );
    oversizedReferences.items[1]!.content = JSON.stringify(oversizedSection);
    assert.throws(
      () => expandMetadataEnvelope(oversizedReferences),
      MetadataEnvelopeError,
    );

    const oversizedTable = mutable(representation.packet);
    const oversizedSourceTable = table(oversizedTable, 0);
    oversizedSourceTable.entries = Array.from(
      { length: 101 },
      () => oversizedSourceTable.entries[0]!,
    );
    replaceTable(oversizedTable, 0, oversizedSourceTable);
    assert.throws(
      () => expandMetadataEnvelope(oversizedTable),
      MetadataEnvelopeError,
    );
  });

  it("rejects oversized packets and fails without echoing content", () => {
    const canary = "PRIVATE-SYNTHETIC-METADATA-ENVELOPE-CANARY";
    const packet = mutable(
      projectMetadataEnvelope(buildSyntheticContinuityHandoff("compact"))
        .SOURCE_TABLE.packet,
    );
    packet.items[1]!.content = JSON.stringify({
      metadata: { sourceIds: [] },
      value: `${canary}${"x".repeat(1_000_001)}`,
    });
    assert.throws(
      () => expandMetadataEnvelope(packet),
      (error: unknown) =>
        error instanceof MetadataEnvelopeError &&
        !error.message.includes(canary),
    );
  });
});

if (process.env.AI_WORKSPACE_METADATA_ENVELOPE_REPORT === "1")
  process.stdout.write(`${JSON.stringify(report(), null, 2)}\n`);
