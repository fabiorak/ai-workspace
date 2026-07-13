# Compose profile-governed instructions and context

Sprint 19 connects the portable profile inspection boundary to the existing
effective-instruction composer and Context Builder in one read-only preview.
It does not install or select an agent for execution, resolve model or tool
availability, persist a Context Pack, deliver data, or execute anything.

## GUI workflow

1. Register or select the profile's local project.
2. Create or select an ACTIVE Work Item and inspect one persisted immutable
   handoff.
3. Under **Compose profile-governed context**, enter the explicit path of the
   reviewed schema-v1 profile and optionally pin its lowercase SHA-256 digest.
4. Enter every reviewed instruction bundle path declared by the profile,
   exactly once and one per line.
5. Enter one model explicitly. It must be in the profile's allowed-model set;
   preferred-model order is visible but never selects automatically.
6. Optionally enter an explicit task target and choose **Compose profile and
   Context Pack read-only**.
7. Review profile identity/version/digest, selected model and derived agent,
   enabled skills, source declaration ownership, descriptive context selectors,
   profile budgets, effective-rule provenance/status, shared-source summary,
   included items, omissions, and exact-byte accounting.

The agent target and continuity/instruction budgets cannot be entered or
overridden in this workflow: they come only from the validated reviewed
profile. The Context Pack remains schema v2 and uses the existing deterministic
whole-item selection order.

## Exact source closure

The preview computes the unique union of instruction-source IDs declared by
the agent and every enabled skill. The explicitly selected local instruction
bundles must contain exactly that set. A source may be shared by several
declarations; the result records every declaring agent or skill once.

Missing sources fail because the configuration is incomplete. Extra sources
fail because undeclared instructions must not influence the result. Duplicate,
foreign-project, changed, malformed, unreadable, or oversized inputs also fail
closed without echoing content or full local paths.

## Descriptive boundaries

`USER_CONFIGURED` is attribution, not trust or runtime authority. The selected
model is checked only against the profile declaration; its availability is not
resolved. Tools, skills, confirmations, input/output formats, and instruction
sources are not installed or executed. Profile context `include` and `exclude`
selectors are displayed but are not interpreted as paths, retrieval queries,
permissions, policies, or sandbox configuration.

The final envelope exists only for the current response. It contains the safe
profile filename/digest and logical preview values, never the full selected
paths, and is not persisted or delivered to a model.
