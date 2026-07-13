# Sprint 18 — Inspect Portable Agent and Skill Profiles

**Primary epics:** E0 — Product foundation; E5 — Instruction, Agent, and Skill Management

**Milestone:** M4 controlled context beta, profile-contract increment

**Status:** completed

**Cadence:** two-week timebox

**Dependency:** Sprint 17 completed

## Sprint goal

Let a user explicitly select, validate, and inspect one portable versioned
agent profile and its enabled skill profiles through the primary bilingual GUI,
with canonical round-trip encoding, source integrity, and transparent model,
tool, context, confirmation, and provenance declarations—without installing,
selecting, delivering to, or executing an agent.

## Evidence and problem statement

Sprint 7 made instruction composition deterministic and Sprint 11 exposed it
as a read-only GUI preview. E5 still lacks the portable agent and skill
definitions required to describe which instruction sources, models, tools,
context budgets, inputs, confirmations, and output expectations an eventual
execution would use.

Adding execution now would conflate descriptive configuration with runtime
authority. Sprint 18 therefore freezes a provider-neutral package boundary and
proves import, validation, canonical export, integrity, and GUI inspection over
explicit reviewed local JSON. It does not add discovery, registry persistence,
permissions, model access, tool execution, or automatic selection.

## User story

As a user preparing reusable agent behavior, I want to inspect one versioned
agent and all of its enabled skills before activation so that I can identify
missing relationships, incompatible models, forbidden tools, risky
confirmations, context budgets, and source provenance without granting any
runtime capability.

## Committed backlog

### S18-01 — Freeze portable schema-v1 contracts and bounds

- define one project-scoped bundle containing exactly one agent profile and the
  complete unique set of skill profiles it enables;
- require bounded IDs, names, descriptions, semantic versions, author,
  license, instruction-source IDs, model lists, tool lists, context selectors,
  exact-byte budgets, inputs, confirmations, and output format;
- distinguish agent, skill, tool, instruction source, and confirmation rule;
- require stable canonical ordering, exact keys, immutable validated values,
  and a deterministic newline-terminated JSON encoding;
- retain `USER_CONFIGURED` as source attribution, not trust or permission;
- expose profile effect as descriptive, not installed, selected, enforced, or
  executable.

### S18-02 — Validate relationships and compatibility fail closed

- require preferred models to be an ordered subset of allowed models;
- reject overlapping allowed/forbidden agent tools;
- require every enabled skill exactly once and reject missing, duplicate, or
  unreferenced skill definitions;
- require every enabled skill tool to be agent-allowed and not agent-forbidden;
- reject duplicate inputs, confirmation rules, instruction sources, models,
  tools, and skill IDs after canonical normalization;
- require confirmation declarations for every skill action marked destructive;
- enforce bounded bundle bytes and list counts;
- reject unknown keys, unsupported versions, malformed Unicode/JSON,
  cross-project content, noncanonical values, conflicts, and oversized input
  with a generic non-echoing error.

### S18-03 — Add controlled local import and canonical round trip

- extend the existing local-instructions integration with an explicit path and
  optional expected SHA-256 digest reader;
- read at most one reviewed local JSON bundle with a strict byte bound;
- never discover files, follow declarations as paths, load instruction text,
  install a package, or persist a registry entry;
- return the complete validated logical bundle, safe source filename, digest,
  exact source bytes, and canonical encoding bytes;
- prove canonical encode → validate → encode identity and logical equality
  after re-import;
- fail if reviewed bytes change and provide recovery without exposing content
  or full local paths.

### S18-04 — Deliver the bilingual inspection journey

- add a typed facade method and authenticated read-only preview route scoped to
  one registered project;
- accept one explicit bundle path and optional expected digest with current
  authentication, Origin/CSRF, body, and method controls;
- show identity, versions, enabled skills, model compatibility, tool
  allow/forbid/required sets, risk levels, confirmations, context selectors,
  exact budgets, output format, author/license, digest, source bytes, and
  canonical bytes in English and Italian;
- label instruction-source IDs and tools as declarations whose availability is
  not resolved in this increment;
- label the whole preview as `USER_CONFIGURED` descriptive data that grants no
  runtime permission;
- preserve keyboard, semantic, narrow-viewport, inert rendering, and recovery
  contracts.

### S18-05 — Prove acceptance and close the increment

- cover deterministic validation/encoding, permutation normalization,
  canonical re-import, digest pinning, Unicode byte accounting, and all bounds;
- cover missing/unreferenced skills, model mismatch, tool conflicts, missing
  destructive confirmation, duplicate/noncanonical data, unknown keys,
  unsupported version, cross-project, corrupt UTF-8/JSON, changed digest,
  unreadable file, and oversized input without content/path echo;
- cover facade and authenticated HTTP behavior, project isolation, English and
  Italian copy, semantic labels, inert rendering, and no-manual inspection;
- update architecture, threat model, user guide, public design, README,
  roadmap, project plan, sprint index, and local handoff only after behavior
  and acceptance gates pass;
- run clean install, clean composite build, full check, audit, diff check,
  public scan, canonical round-trip demo, and isolated GUI/HTTP acceptance;
- create one final Sprint 18 commit and perform no push.

## Out of scope

- profile discovery, registry persistence, installation, update, disable,
  removal, editor/authoring, clone, signing, marketplace, or remote packages;
- agent/model/tool execution, permission enforcement, sandbox configuration,
  orchestration, automatic agent/skill selection, suggestions, or activation;
- resolving instruction source IDs, tool availability, model availability,
  skill implementation files, inputs, output schemas, or behavioral tests;
- wiring profiles into instruction composition or Context Pack selection;
- YAML/Markdown parsing, schema migration beyond v1, CodeGraph, OpenSearch,
  semantic search, privacy gateway, telemetry, or network access;
- new runtime, framework, database, service, cloud dependency, or external
  package.

## Architecture decision

No ADR is planned. The slice adds provider-neutral value contracts to the
existing instruction-management package and a controlled local JSON reader to
the existing local-instructions integration. If implementation requires
persistence, discovery, signing, execution, permission enforcement, a new
runtime/dependency, or a network boundary, stop and write a separate ADR.

## Verification plan

```bash
npm ci --ignore-scripts
npx tsc -b tsconfig.build.json --clean
npm run check
npm audit --audit-level=high
git diff --check
```

The HTTP acceptance requires loopback permission because it opens only
`127.0.0.1`. All fixtures and demos must be synthetic, use temporary state, and
leave no local profile, registry, or generated artifact behind.

## Definition of done

- a user can explicitly select and inspect one portable agent/skill JSON bundle
  from the bilingual GUI;
- schema validation and canonical encoding are deterministic and bounded;
- canonical export re-imports to the same logical value and bytes;
- source digest, source bytes, canonical bytes, provenance, versions, models,
  tools, skills, context, confirmations, and output declarations are visible;
- relationship, compatibility, integrity, corruption, scope, and size failures
  fail closed without content or full-path echo;
- the preview clearly grants no runtime permission and performs no install,
  selection, persistence, delivery, or execution;
- no dependency, runtime, framework, database, service, or network access is
  added;
- clean-build, quality, audit, public-safety, round-trip, and GUI/HTTP gates
  pass;
- one final implementation commit is created and no push is performed.

## Dependencies and sequencing

```text
Sprint 17 complete
  -> S18-01 schema and bounds
       -> S18-02 relationships and compatibility
            -> S18-03 controlled local round trip
                 -> S18-04 facade and bilingual GUI
                      -> S18-05 acceptance and closure
```

## Risks and mitigations

| Risk                                         | Mitigation                                                                      |
| -------------------------------------------- | ------------------------------------------------------------------------------- |
| Descriptive tools imply runtime permission   | Explicit non-executable effect and no tool/model adapter or activation path     |
| Profile references unavailable capabilities  | Label declarations unresolved; validate only internal bundle relationships      |
| Local file leaks path or content             | Return safe basename/digest/bytes only; generic non-echoing failures            |
| Skill requirements bypass agent restrictions | Require every required tool to be allowed and never forbidden                   |
| Canonical export rewrites meaning            | Validate, normalize, freeze, encode, re-import, and prove exact round-trip      |
| Scope expands into a registry/editor         | One explicit read-only bundle; no discovery, persistence, authoring, or install |

## Planning decisions

- Sprint 18 advances the remaining M4 agent/skill profile boundary before
  CodeGraph or broader retrieval because deterministic instructions and Context
  Packs already exist but have no portable role/capability contract;
- one bundle contains one agent and exactly its enabled skills, avoiding a
  registry or dependency resolver in the first slice;
- JSON is selected because the repository already has strict dependency-free
  JSON readers; YAML/Markdown remain future import adapters;
- semantic version strings are validated and preserved but no version-range
  resolver is introduced;
- declared instruction sources, tools, models, inputs, outputs, and tests are
  inspectable but not resolved or executed;
- this commitment is preserved; execution evidence, review, and retrospective
  are appended without rewriting the planned claims.

## Execution log

### 2026-07-13

- S18-01 added provider-neutral schema v1 to the instruction-management
  package. One project-scoped bundle contains exactly one agent and its complete
  enabled skill set with `USER_CONFIGURED` attribution and an explicit
  descriptive/non-executable effect.
- Agent contracts cover versions, instruction-source IDs, preferred/allowed
  models, allowed/forbidden tools, context include/exclude selectors, separate
  exact-byte budgets, autonomy, output format, confirmations, author, and
  license. Skill contracts cover versions, instruction sources, required/
  forbidden tools, inputs, risk, destructive actions, confirmations, output,
  author, and license.
- S18-02 normalizes set-like lists and skill ordering, preserves preferred-model
  order, freezes validated values, and rejects missing/extra/duplicate skills,
  unavailable preferred models, tool conflicts, disallowed skill tools,
  missing destructive confirmations, duplicates, unknown keys, bad semantic
  versions, unsupported versions, control text, and bounds with one non-echoing
  error.
- S18-03 added `LocalAgentProfileReader` to the existing local-instructions
  integration. It reads one explicit file up to 256 KiB, supports optional
  lowercase SHA-256 pinning, uses fatal UTF-8 decoding, enforces project scope,
  returns only a safe basename, and proves encode/re-import byte identity.
- The synthetic two-skill fixture canonically encodes to 2,504 UTF-8 bytes and
  re-imports to identical bytes and logical values. This is a format result,
  not a token, quality, compatibility, availability, or execution claim.
- S18-04 added the typed facade and authenticated
  `POST /api/projects/:projectId/agent-profile/preview`. The English/Italian GUI
  shows the complete inert bundle, digest, source/canonical bytes, and explicit
  non-activation effect without exposing the full path.
- S18-05 acceptance covers domain relationships, canonical normalization,
  digest pinning, changed/cross-project/corrupt/unreadable/oversized files,
  facade path privacy, localization, semantic interaction contracts, inert DOM
  rendering, HTTP project isolation, and no-manual inspection.
- Final gates passed after clean install and clean composite build: format,
  lint, typecheck, build, 38 test files, 15-case loopback HTTP acceptance, audit
  with zero vulnerabilities, canonical demo, diff check, and public
  path/credential scan.

## Sprint review

Sprint 18 delivers the first executable-independent agent/skill profile
contract. A user can inspect a portable role and its capabilities with enough
structure to detect internal model, tool, skill, context, and confirmation
problems before any future activation boundary exists.

The bundle is deliberately self-contained: exactly one agent and its enabled
skills. That proves portability and canonical round trip without introducing a
registry, package resolver, installation lifecycle, or missing-dependency
lookup. Instruction-source, model, and tool identifiers remain declarations;
the UI states that their availability is unresolved.

Digest pinning binds the inspected local bytes, while canonical encoding gives
a stable portable representation. Neither is a signature or permission. The
facade exposes the safe filename and inert content but never the selected full
path, and failure responses echo neither content nor path.

## Retrospective

What worked:

- locating profile value contracts beside instruction composition kept E5
  provider-neutral while reusing the controlled local-input integration;
- one-agent/exact-skill closure made relationship validation deterministic and
  avoided premature dependency resolution;
- an explicit non-installed/non-selected/non-executed effect prevented tool and
  model declarations from reading as runtime authority;
- canonical re-import and digest-pinned HTTP acceptance tested portability and
  integrity at separate boundaries.

What changed during implementation:

- set-like lists are normalized, while preferred model order is preserved
  because it represents priority rather than membership only;
- destructive actions and confirmation requirements are separate declarations,
  with validation requiring the destructive set to be covered;
- the successful facade result includes canonical encoding for inspection and
  export, but source paths remain adapter-local and never cross the boundary.

Next-increment recommendation:

- measure and plan profile-to-effective-instruction/Context-Pack selection as a
  separate read-only composition slice before any registry or execution;
- require an ADR before profile persistence, installation, signing,
  permissions, model/tool resolution, or execution;
- keep CodeGraph separate until a concrete Context Builder or navigation
  consumer and scale baseline are selected;
- keep OpenSearch and fuzzy/semantic discovery governed by the Sprint 16
  measurement triggers.
