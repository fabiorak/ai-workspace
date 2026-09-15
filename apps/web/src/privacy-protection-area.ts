import {
  AppManagedKeyCustody,
  listLegacyCustodyEnvelopes,
  PassphraseKeyCustody,
} from "@ai-workspace/local-key-custody";
import {
  EncryptedPrivacyMappingStore,
  EncryptedStablePrivacyMappingStore,
} from "@ai-workspace/local-privacy-mapping";
import {
  protectWithStablePseudonyms,
  restoreStablePseudonyms,
  type PiiEntityType,
  type PiiSpan,
} from "@ai-workspace/privacy-gateway";

export function privacyProtectionArea(workspaceHome: string) {
  return Object.freeze({
    inspect: async () => ({
      automaticProtection: true as const,
      detector: "BUILT_IN_DETERMINISTIC_V1" as const,
      managedKey: true as const,
      legacyMappings: (await listLegacyCustodyEnvelopes(workspaceHome)).length,
      residualThreat:
        "A process that can read the complete local workspace home can read both managed keys and encrypted mappings." as const,
    }),
    migrateLegacy: async (input: unknown) => {
      if (
        !record(input) ||
        Object.keys(input).sort().join("\0") !==
          ["mappingSetId", "passphrase"].sort().join("\0") ||
        !valid(input.mappingSetId, 256) ||
        !valid(input.passphrase, 1_024) ||
        Buffer.byteLength(input.passphrase, "utf8") < 16
      )
        throw new Error("LEGACY_MIGRATION_INPUT_INVALID");
      const legacyKey = await new PassphraseKeyCustody(workspaceHome).unlock(
        input.mappingSetId,
        input.passphrase,
      );
      try {
        const legacy = await new EncryptedPrivacyMappingStore(
          workspaceHome,
          legacyKey,
        ).read(input.mappingSetId);
        const scopeId = `PROJECT:${legacy.projectId}`;
        const managedKey = await new AppManagedKeyCustody(
          workspaceHome,
        ).getOrCreate(scopeId);
        try {
          const store = new EncryptedStablePrivacyMappingStore(
            workspaceHome,
            managedKey,
          );
          const current = await store.load(scopeId);
          const source = legacy.entries.map((entry) => ({
            original: Buffer.from(entry.originalBase64, "base64").toString(
              "utf8",
            ),
            type: entry.entityType as PiiEntityType,
          }));
          const joined = source.map((entry) => entry.original).join("\n");
          let offset = 0;
          const spans: PiiSpan[] = source.map((entry) => {
            const length = Buffer.byteLength(entry.original, "utf8");
            const span = Object.freeze({
              startUtf8: offset,
              endUtf8: offset + length,
              type: entry.type,
              confidence: 1,
              detector: "LEGACY_USER_REVIEWED_IMPORT",
            });
            offset += length + 1;
            return span;
          });
          const imported = protectWithStablePseudonyms({
            text: joined,
            spans,
            mapping: current,
          });
          if (
            restoreStablePseudonyms(imported.text, imported.mapping) !== joined
          )
            throw new Error("LEGACY_MIGRATION_ROUND_TRIP_FAILED");
          const persisted =
            imported.mapping.revision === current.revision
              ? current
              : await store.replace(current.revision, imported.mapping);
          if (restoreStablePseudonyms(imported.text, persisted) !== joined)
            throw new Error("LEGACY_MIGRATION_REREAD_FAILED");
          return Object.freeze({
            migrated: true as const,
            projectId: legacy.projectId,
            importedEntries: legacy.entries.length,
            stableEntries: persisted.entries.length,
            sourcePreserved: true as const,
          });
        } finally {
          managedKey.fill(0);
        }
      } finally {
        legacyKey.fill(0);
      }
    },
  });
}

function valid(value: unknown, maximum: number): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    Buffer.byteLength(value, "utf8") <= maximum &&
    !/\p{Cc}/u.test(value)
  );
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
