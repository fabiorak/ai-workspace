# Inspect portable agent and skill profiles

Sprint 18 adds a read-only inspection boundary for one explicit local JSON
bundle. The bundle describes one versioned agent and exactly the skill profiles
it enables. It is `USER_CONFIGURED` descriptive data: preview does not install,
select, activate, enforce, deliver to, or execute an agent, model, skill, tool,
instruction source, input, confirmation, or output format.

## GUI workflow

1. Register or select a local project.
2. Open **Inspect an agent and skill profile**.
3. Enter the explicit path of one reviewed synthetic schema-v1 JSON bundle.
4. Optionally enter its lowercase SHA-256 digest to pin the reviewed bytes.
5. Choose **Inspect profile read-only**.
6. Review agent and skill identity/version, models, tools, instruction-source
   IDs, context selectors and exact-byte budgets, risks, destructive actions,
   confirmations, inputs, output formats, author/license, source digest, source
   bytes, canonical bytes, and canonical encoding.

The result shows only the safe source filename, not its full local path. Values
are rendered as inert text. A digest proves that bytes match the reviewed file;
it is not a signature, trust decision, permission, or proof that declared
models, tools, and instruction sources exist.

## Schema boundary

The project-scoped bundle contains exactly these top-level fields:

```text
schemaVersion, projectId, trust, agent, skills, effect
```

The agent declares enabled skill IDs, instruction-source IDs, preferred and
allowed models, allowed and forbidden tools, context include/exclude selectors,
continuity and instruction byte budgets, autonomy, output format, confirmation
rules, author, and license.

Each skill declares instruction-source IDs, required and forbidden tools,
inputs, risk, destructive actions, required confirmations, output format,
author, and license. Every enabled skill must be present exactly once. Required
skill tools must be agent-allowed and never agent-forbidden. Every destructive
action must appear in that skill's confirmation list.

Set-like lists and skills are sorted canonically. Preferred model order remains
meaningful and is preserved. Semantic versions are validated, but no range or
dependency resolver exists. Canonical JSON is pretty-printed deterministically
and newline terminated; re-import produces identical logical values and bytes.

## Failure and recovery

Unreadable, changed, invalid UTF-8, malformed JSON, unknown keys, unsupported
versions, cross-project values, missing or extra skills, duplicate identities,
model/tool/context conflicts, missing destructive confirmations, and oversized
files fail closed without echoing bundle content or full paths.

Review or regenerate the synthetic file, select the owning registered project,
and update an expected digest only after reviewing the new bytes. Profile
discovery, authoring, persistence, installation, signing, availability checks,
instruction composition, Context Pack wiring, and execution remain future work.
