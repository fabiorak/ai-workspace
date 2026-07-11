# ADR-0014: Compose structured instructions with explicit precedence

**Status:** accepted
**Date:** 2026-07-11

## Context

E5 needs an inspectable answer to which configured instructions would apply
before any agent or model execution exists. The public design names global,
workspace, project, model, agent, and task scopes; non-overridable constraints;
and overridable preferences. It does not yet fix source identity, conflict
semantics, or a first controlled input format.

Three initial boundaries were considered:

1. concatenate opaque Markdown or prompt text in precedence order;
2. make provider-native instruction files the canonical model;
3. compose provider-neutral structured rules and adapt explicit inputs at the
   boundary.

Opaque concatenation cannot explain rule identity, overrides, or forbidden
constraint replacement. Provider-native files would leak provider semantics
into the core contract and require broad discovery before its privacy boundary
is understood. Structured rules make the limited first composition behavior
deterministic and testable without choosing the eventual authoring ecosystem.

Prompt text and precedence cannot enforce filesystem, tool, network, privacy,
deployment, or destructive-action policy. Those controls require separate
runtime boundaries.

## Decision

Use a provider-neutral schema-versioned instruction bundle containing bounded
sources and ordered structured rules. The initial local adapter accepts only
explicitly selected JSON schema-v1 bundles. JSON uses the existing runtime and
adds no parser dependency. Native Markdown, YAML, provider, IDE, MCP, home, and
recursive repository discovery remain outside this decision.

Each source has a caller-independent source ID, complete SHA-256 digest of the
exact selected bytes, explicit project ID, scope, optional scope target, and
ordered rules. Absolute paths are adapter input only and never enter the
provider-neutral model or preview. Each rule has an ID, kind, overridability,
content, and source-relative position. Local selection labels the source
`USER_CONFIGURED`; this means selected configuration, not verified truth,
trusted code, or enforceable policy.

Scopes have ascending preference precedence:

```text
GLOBAL < WORKSPACE < PROJECT < MODEL < AGENT < TASK
```

Precedence applies only to `PREFERENCE` rules sharing the same rule ID. The
single highest-scope rule is active and lower-scope rules are overridden. Two
different values for the same preference ID at the same highest scope are
ambiguous and fail the entire composition closed. Identical duplicate rule
identity within or across sources is malformed and also fails closed.

`CONSTRAINT` rules must declare `overridable: false`; `PREFERENCE` rules must
declare `overridable: true`. The first constraint for a rule ID in canonical
scope/source/position order remains active. A later constraint with the same
ID and identical content is a rejected duplicate; one with different content
is a rejected forbidden override. Both remain visible with their reason and
the active constraint ID. A preference cannot share a rule ID with a
constraint; that kind conflict fails composition closed.

Composition targets one explicit project plus optional model, agent, and task
selectors. Project sources must match that project. Targeted sources apply
only when their target equals the explicit selector; nonmatching targeted
sources are excluded visibly rather than silently composed. Global and
workspace sources are still explicitly selected and carry the target project
in the bundle to prevent cross-project reuse by accident.

Canonical source ordering is scope rank, scope target, source ID, then digest.
Rule ordering is source order then rule position and ID. Stable JSON output
preserves active, overridden, rejected, and excluded status, reason, source
identity, source digest, and superseding rule identity. Bounds and schema
validation fail closed before partial output or persistence.

The Sprint 7 preview is read-only. It never persists instruction state,
executes imported content, invokes an agent/model/tool, or promotes historical
evidence or active memory into instructions.

## Consequences

- effective rules and conflicts become deterministic and source-linked;
- non-overridable configured constraints cannot be silently replaced;
- provider formats and eventual Markdown/YAML authoring remain adapter
  concerns rather than canonical contracts;
- equal-scope ambiguity and kind conflicts reject composition instead of
  relying on input order;
- explicit bundle selection avoids broad private configuration discovery;
- `USER_CONFIGURED` and prompt precedence remain descriptive, not a security
  enforcement claim;
- agent/skill registries, persistence, runtime permissions, prompt assembly,
  E6 context packs, and execution require later decisions.
