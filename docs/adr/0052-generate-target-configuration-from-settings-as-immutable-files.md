# ADR-0052: Generate target configuration from Settings as immutable files

Status: proposed
Date: 2026-10-16

## Context

ADR-0044 stores a model target with three references: `profileRef`,
`policyRef`, and `instructionRefs`. ADR-0047 reads those files on every reduced
turn and checks that their scope matches the conversation. The references are
the only way to give a target its configuration, so a person using Settings has
to write three JSON documents by hand, in the exact schema described in the
reduced-turn configuration guide, before the first turn can run. Both
subscription-agent acceptance runs could save a target only after generating
those files with a test helper.

Most of what the three documents contain does not change a reduced turn. The
turn depends on the allowed model, the declared instruction sources, the two
context budgets, the policy model, the policy ceiling and assertions, and the
rule text. Skills, tools, autonomy and output format are descriptive.

The policy has a further constraint. A reduced turn evaluates the whole
conversation envelope as one item. Without an assertion that item is
`CONFIDENTIAL`, and an assertion cannot be written in advance, because it must
carry the digest of an envelope that differs on every turn. A ceiling of
`PUBLIC` or `INTERNAL` therefore blocks every reduced turn.

## Decision

Settings offers a guided configuration beside the existing references. The
person chooses a scope (General or one registered project) and writes the
instruction rules, one per line, and may change the two context budgets. The
server builds the three documents, writes them as immutable files, and returns
their references; the target is then saved with those references through the
unchanged target API. The target schema, the readers and the turn composition
do not change, and a person can still point a target at files of their own.

**Modules.** `packages/target-configuration` builds the three documents from the
guided input, validates them with the existing scoped validators, and
recognizes a guided configuration from file contents.
`integrations/local-target-configuration` writes and reads the files. No
runtime, dependency or service is added.

**Generated content.**

| Document     | Set from the form                    | Fixed                                                             |
| ------------ | ------------------------------------ | ----------------------------------------------------------------- |
| Profile      | Scope, model, both context budgets   | One agent, one skill, one descriptive tool, `ADVISORY` autonomy   |
| Policy       | Scope, model                         | Ceiling `CONFIDENTIAL`, no assertions                             |
| Instructions | Scope, rules (one `CONSTRAINT` each) | One source; precedence `WORKSPACE` for General, `PROJECT` for one |

The ceiling is fixed because any lower value blocks every reduced turn, as
explained above; it is shown and documented, not offered as a choice. The rules
are the person's content and keep `USER_CONFIGURED` trust; the fixed descriptive
values name AI Workspace Settings as their author. The builder composes the
result once and refuses rules that do not fit the instruction budget, so a
configuration that cannot compose is never written.

**Immutable files.** The three files are written to
`<home>/target-configurations/<digest>/`, where the digest is the SHA-256 of the
three canonical file texts together. The directory is `0700` and the files
`0600`. A file is written to a temporary name created exclusively for that call,
synchronized, and renamed. An existing file with the same bytes is kept; an
existing file with different bytes stops the save and is never overwritten. If
a write fails, only the temporary file created by that call is removed. Saving
the same configuration twice reuses the same directory.

The consequence is that a target only moves to new files when its own save
succeeds: a failed or conflicting target save leaves the configuration in use
untouched, and a reference always names the same content, which keeps the source
digests recorded by turns verifiable. Earlier directories are not removed
automatically; they are small and removing them is left to the person.

**Recognition.** A target is shown as guided only when its three references are
exactly the three files of one managed directory and their contents rebuild to
the same bytes and digest. Anything else, including a managed file edited by
hand, is shown as files of the person's own. Recognition reads only the managed
directory and returns the guided fields, never file paths outside it.

**Interface.** `POST /api/target-configurations` takes the guided input and
returns the three references; it requires the usual local write authorization,
and a project scope must name a registered project. `GET
/api/target-configurations/<targetId>` returns the guided fields of a saved
target, or none. A target still belongs to one scope; a project conversation
uses a target selected for that project.

## Consequences

- A target can be configured completely from Settings, for General and for each
  registered project, without writing JSON by hand.
- The guided form cannot express skills, tools, a lower data ceiling or policy
  assertions; files of one's own remain the way to do that.
- Configuration directories accumulate, one per distinct configuration saved.
- Changing the model of a guided target requires saving the configuration again,
  because the model is part of the profile and the policy; the form does this on
  every save.

## Alternatives considered

- **An editor for every field of the three documents.** Rejected for now: most
  of the work would go into fields that do not change a reduced turn.
- **Storing the configuration inside the target.** Rejected: it changes the
  target schema and the contracts of ADR-0044 and ADR-0047, needs a migration,
  and mixes model selection with the privacy policy.
- **One directory per target, overwritten on save.** Rejected: a failed target
  save would leave the target pointing at changed files, and the same path would
  name different content over time.
