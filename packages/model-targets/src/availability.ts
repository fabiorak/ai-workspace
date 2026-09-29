import type { ModelTarget, ModelTargetKind } from "./model.ts";

/**
 * What the running host can actually do for each kind. The host declares it;
 * configuration never does. `SIMULATED` names a wired path whose answers are
 * produced locally, so a target called like a real model stays recognisable.
 */
export type ModelTargetCapabilities = Readonly<{
  qualifiedOffline: readonly ModelTargetKind[];
  launch: Readonly<Partial<Record<ModelTargetKind, "AVAILABLE" | "SIMULATED">>>;
}>;

export const NO_MODEL_TARGET_CAPABILITIES: ModelTargetCapabilities =
  Object.freeze({
    qualifiedOffline: Object.freeze([]),
    launch: Object.freeze({}),
  });

export type ModelTargetLaunch = "AVAILABLE" | "SIMULATED" | "UNAVAILABLE";

export type ModelTargetUnavailableReason =
  "UNCLASSIFIED" | "DISABLED" | "NOT_QUALIFIED" | "NOT_CONNECTED";

/**
 * Configured, enabled, qualified offline and available for explicit launch
 * are separate facts. Only `enabled` is stored; the rest is derived on every
 * read without a login, a probe or a process.
 */
export type ModelTargetAvailability = Readonly<{
  enabled: boolean;
  qualifiedOffline: boolean;
  launch: ModelTargetLaunch;
  reason: ModelTargetUnavailableReason | null;
}>;

export function modelTargetAvailability(
  target: ModelTarget,
  capabilities: ModelTargetCapabilities,
): ModelTargetAvailability {
  const qualifiedOffline =
    target.kind !== null && capabilities.qualifiedOffline.includes(target.kind);
  const unavailable = (reason: ModelTargetUnavailableReason) =>
    Object.freeze({
      enabled: target.enabled,
      qualifiedOffline,
      launch: "UNAVAILABLE" as const,
      reason,
    });
  if (target.kind === null) return unavailable("UNCLASSIFIED");
  if (!target.enabled) return unavailable("DISABLED");
  if (!qualifiedOffline) return unavailable("NOT_QUALIFIED");
  const launch = capabilities.launch[target.kind];
  if (launch === undefined) return unavailable("NOT_CONNECTED");
  return Object.freeze({
    enabled: true,
    qualifiedOffline: true,
    launch,
    reason: null,
  });
}
