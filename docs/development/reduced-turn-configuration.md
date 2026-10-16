# Reduced-turn configuration

This guide describes the explicit configuration used when a conversation has no
kept handoff. The reduced-turn path is used by General conversations and by a
project conversation without a handoff. It composes a bounded context from the
conversation and explicitly linked project memory, then evaluates that complete
envelope against the selected model policy.

The examples below are synthetic and local. They use `model-b` and do not call a
provider. A preview is consultative: it reads and composes configuration, but it
does not deliver a model request and does not create a privacy audit event.

This scoped composition is implemented and qualified offline for General and
project conversations without a handoff. It does not change the legacy handoff
configuration contract: the handoff path still requires matching project-owned
schema 1 configuration. The schema 2 project examples in this guide describe
the reduced-turn path only; they do not claim a handoff schema 2 migration.

## Guided configuration from Settings

Settings can write the three files instead of asking for paths (ADR-0052). The
person chooses the scope, the model of the target, the instruction rules (one
per line) and the two context budgets. The server builds the documents, checks
them with the same scoped validators and composition the turn uses, refuses
rules that do not fit the instruction budget or look like a credential, and
writes them to:

```text
<home>/target-configurations/<sha256 of the three files>/profile.json
<home>/target-configurations/<sha256 of the three files>/policy.json
<home>/target-configurations/<sha256 of the three files>/instructions.json
```

The directory is `0700` and the files `0600`. They are never overwritten: the
same configuration reuses its directory, a different one gets a new directory,
and a file changed by hand stops the save. The target is then saved with those
references through the usual target route, so a failed target save leaves the
configuration in use untouched.

The guided documents fix everything a reduced turn does not use: one agent, one
skill, one descriptive tool, and `ADVISORY` autonomy. The policy ceiling is
`CONFIDENTIAL` with no assertions, because a reduced turn evaluates its whole
envelope as one item that defaults to `CONFIDENTIAL`, and an assertion would need
the digest of an envelope that changes on every turn; a lower ceiling would block
every turn. Each rule is a non-overridable `CONSTRAINT`; the source precedence is
`WORKSPACE` for General and `PROJECT` for a project.

A target is shown as guided when its three references are exactly the files of
one such directory and their contents rebuild to the same bytes. Anything else,
including a guided file edited by hand, is treated as files of one's own and
read exactly as described below.

## Configuration files and scope

Three explicit files are selected by the model target:

- `profileRef` points to an agent profile;
- `policyRef` points to a model data policy;
- `instructionRefs` points to one or more instruction source files.

For General, all three files use the General scope:

```json
{
  "kind": "GENERAL"
}
```

For a project, the scope is explicit and includes the registered project ID:

```json
{
  "kind": "PROJECT",
  "projectId": "project-42"
}
```

There are two related but different ownership fields:

| Field          | Meaning                                                               | Used by               |
| -------------- | --------------------------------------------------------------------- | --------------------- |
| `scope`        | The scope selected for a profile or policy, and the scope of the turn | Profile, policy, turn |
| `ownerScope`   | The scope that owns an instruction bundle or instruction source       | Instruction files     |
| `source.scope` | Instruction precedence category, not storage ownership                | Instruction sources   |

`ownerScope` does not replace instruction precedence. Within one valid owner
scope, instruction categories are ordered from lower to higher precedence as
`GLOBAL`, `WORKSPACE`, `PROJECT`, `MODEL`, `AGENT`, and `TASK`. A General
configuration must not smuggle in a project-owned source: a General bundle with
a `PROJECT` source is rejected.

## Complete General profile (schema 2)

This is a complete profile file accepted by the scoped profile reader. The
profile declares every enabled skill and every instruction source used by those
declarations.

```json
{
  "schemaVersion": 2,
  "scope": {
    "kind": "GENERAL"
  },
  "trust": "USER_CONFIGURED",
  "agent": {
    "id": "review-agent",
    "name": "Synthetic Review Agent",
    "description": "Reviews fictional changes without executing tools.",
    "version": "1.2.0",
    "instructionSourceIds": ["general-rules"],
    "skillIds": ["dependency-review", "test-review"],
    "preferredModels": ["model-b"],
    "allowedModels": ["model-b"],
    "allowedTools": ["read_file", "run_tests"],
    "forbiddenTools": ["deploy", "write_file"],
    "context": {
      "include": ["git_diff", "test_state"],
      "exclude": ["unrelated_history"],
      "continuityBudgetBytes": 65536,
      "instructionBudgetBytes": 16384
    },
    "autonomy": "ADVISORY",
    "outputFormat": "synthetic-review-v1",
    "confirmationRules": ["run_tests"],
    "author": "AI Workspace synthetic fixtures",
    "license": "Apache-2.0"
  },
  "skills": [
    {
      "id": "dependency-review",
      "name": "Dependency review",
      "description": "Inspects fictional dependency declarations.",
      "version": "1.0.0",
      "instructionSourceIds": ["general-rules"],
      "requiredTools": ["read_file"],
      "forbiddenTools": ["deploy"],
      "inputs": ["dependency_manifest"],
      "riskLevel": "LOW",
      "destructiveActions": [],
      "requiresConfirmation": [],
      "outputFormat": "dependency-findings-v1",
      "author": "AI Workspace synthetic fixtures",
      "license": "Apache-2.0"
    },
    {
      "id": "test-review",
      "name": "Test review",
      "description": "Runs a fictional reviewed test command.",
      "version": "2.1.0-beta.1",
      "instructionSourceIds": ["general-rules"],
      "requiredTools": ["run_tests"],
      "forbiddenTools": ["write_file"],
      "inputs": ["test_command"],
      "riskLevel": "MEDIUM",
      "destructiveActions": ["run_tests"],
      "requiresConfirmation": ["run_tests"],
      "outputFormat": "test-findings-v1",
      "author": "AI Workspace synthetic fixtures",
      "license": "Apache-2.0"
    }
  ],
  "effect": "DESCRIPTIVE_NOT_INSTALLED_SELECTED_ENFORCED_OR_EXECUTED"
}
```

The profile is descriptive configuration. It does not install, select,
authorize, deliver, or execute an agent or tool.

## Complete General policy (schema 2)

The policy is scoped to General and selects the same model as the profile. An
empty `assertions` array is valid: items without a matching assertion receive
the default `CONFIDENTIAL` classification.

```json
{
  "schemaVersion": 2,
  "scope": {
    "kind": "GENERAL"
  },
  "id": "general-policy",
  "version": "1.0.0",
  "modelId": "model-b",
  "maximumDataClass": "CONFIDENTIAL",
  "assertions": [],
  "attribution": "USER_CONFIGURED",
  "author": "Synthetic fixtures",
  "license": "Apache-2.0"
}
```

`maximumDataClass` is a data-class ceiling, not permission to send data. The
preflight result is review evidence. A later explicit turn still requires the
normal confirmation and delivery boundaries.

## Complete General instruction source (schema 2)

The local instruction reader accepts one source per selected file. For schema 2,
the file wrapper and its source both carry `ownerScope`. The reader computes the
source digest from the exact file bytes; `sourceDigest` is therefore not written
in this file format.

```json
{
  "schemaVersion": 2,
  "ownerScope": {
    "kind": "GENERAL"
  },
  "source": {
    "id": "general-rules",
    "ownerScope": {
      "kind": "GENERAL"
    },
    "scope": "WORKSPACE",
    "target": null,
    "trust": "USER_CONFIGURED",
    "rules": [
      {
        "id": "general.evidence",
        "kind": "CONSTRAINT",
        "overridable": false,
        "content": "Use the supplied synthetic evidence and state when context is incomplete.",
        "position": 0
      }
    ]
  }
}
```

The profile's agent and both skills declare `general-rules`, so the source set
matches exactly. `WORKSPACE` determines precedence; it does not turn the source
into a project-owned file.

## Legacy project v1 matching

Schema 1 remains a readable compatibility format for a real project only. A
schema 1 profile, policy, or instruction bundle must carry the exact
`projectId` of the project being read. For example, a project-scoped reader for
`project-42` may accept:

```text
schemaVersion: 1
projectId: project-42
remaining schema-1 fields: unchanged and complete for that file type
```

This is a matching check, not a migration instruction. The reader normalizes a
matching v1 value in memory for the scoped composition; it does not rewrite the
file, create a General copy, or upgrade bytes on disk. A v1 value for another
project, or any v1 value used as General configuration, fails closed.

For clarity, this compatibility rule belongs to the legacy handoff path as well:
its project profile, policy, and instruction configuration must remain schema 1
and must match the handoff's project ID. A schema 2 project configuration is
currently a reduced-turn configuration, not a promise that the handoff path has
been migrated.

## The privacy item is the complete conversation envelope

Reduced-turn privacy preflight does not classify only the latest evidence line
or only the user's question. It serializes the entire bounded envelope as one
item with ID `conversation.payload`. That envelope includes the schema/effect,
turn scope, selected target, composed instructions, evidence readings, linked
memory, source metadata, omission records, accounting, and `userText`.

The item can be represented with a complete envelope before its exact UTF-8
length is calculated:

```ts
const envelope = JSON.stringify({
  schemaVersion: 2,
  effect: "BOUNDED_REDUCED_CONVERSATION_CONTEXT",
  scope: {
    conversationId: "general-001",
    projectId: null,
    workItemId: null,
    handoffId: null,
  },
  target: {
    targetId: "synthetic-b",
    modelId: "model-b",
  },
  instructions: {
    selection: {
      schemaVersion: 2,
      scope: { kind: "GENERAL" },
      profile: {
        id: "review-agent",
        version: "1.2.0",
        trust: "USER_CONFIGURED",
      },
      target: { model: "model-b", agent: "review-agent", task: null },
      enabledSkillIds: ["dependency-review", "test-review"],
      instructionSources: [
        {
          sourceId: "general-rules",
          declaredBy: [
            "AGENT:review-agent",
            "SKILL:dependency-review",
            "SKILL:test-review",
          ],
        },
      ],
      context: {
        include: ["git_diff", "test_state"],
        exclude: ["unrelated_history"],
        selectorEffect: "DESCRIPTIVE_NOT_RESOLVED_AS_RETRIEVAL_OR_PERMISSION",
      },
      budgets: { CONTINUITY: 65536, INSTRUCTIONS: 16384 },
      effect: "READ_ONLY_PROFILE_SELECTION_NOT_INSTALLED_DELIVERED_OR_EXECUTED",
    },
    instructions: {
      schemaVersion: 2,
      scope: { kind: "GENERAL" },
      target: { model: "model-b", agent: "review-agent", task: null },
      enforcement: "DESCRIPTIVE_INSTRUCTIONS_NOT_RUNTIME_POLICY",
      rules: [],
    },
  },
  readings: [],
  linkedProjectMemory: [],
  omissions: [],
  sources: [],
  accounting: {
    selectedEvents: 0,
    readingBytes: 0,
    linkedProjects: 0,
    memoryItems: 0,
    memoryBytes: 0,
    sourceMetadataBytes: 0,
  },
  userText: "Question without a project",
});

const item = {
  id: "conversation.payload",
  content: envelope,
  category: "REDUCED_CONTEXT",
  trust: "MIXED_UNVERIFIED",
  sourceType: "CONVERSATION",
  sourceId: "general-001",
  exactBytes: Buffer.byteLength(envelope, "utf8"),
};
```

The production envelope contains the complete composed instruction rules and all
selected evidence; the empty `rules` and evidence arrays above are a valid
minimal shape for illustrating the item contract. In a real preflight,
`exactBytes` is the UTF-8 byte length of the complete `content` string.
The policy evaluator assigns `CONFIDENTIAL` by default when no assertion
matches `conversation.payload`. This is a classification result, not an
authorization, delivery receipt, or claim that PII and secrets were completely
detected. Restricted-pattern detection and the configured policy can still
block the item.

Original string values are also screened before JSON serialization so escaped
quotes cannot hide an assigned credential. An early restricted-string rejection
creates no policy audit event, like malformed configuration; it still prevents
delivery. Valid policy preflight decisions use the scoped audit below.

Omissions are separate accounting records. An omission with an unknown byte
size uses `exactBytes: null`; this contributes to `unknownByteOmissions` in the
turn audit input. An omitted item is never silently treated as evaluated.

## Scope and fail-closed rules

The reduced-turn composer refuses configuration before protected context or a
transport can be used when any of these relationships is invalid:

- a General turn reads a project-scoped profile or policy;
- a project turn reads General configuration;
- project `project-42` reads profile, policy, or instruction ownership for
  `project-43`;
- an instruction source's `ownerScope` differs from its bundle `ownerScope`;
- a General bundle contains a `PROJECT` instruction source;
- the policy model ID differs from the selected target model ID;
- the profile does not allow the selected model;
- the profile declarations and instruction source IDs do not match exactly;
- a project conversation is not registered or its session is missing or
  ambiguous;
- an authorized source, artifact, or integrity check cannot be read.

Scope is resolved by the server from the conversation and is not supplied as
trusted authority by the browser. A caller cannot turn a General conversation
into a project conversation by changing a request field.

## Limits and omission accounting

The path is bounded before delivery. Important limits are:

- conversation identifiers and other turn identifiers: 256 bytes;
- user text: 64 KiB;
- profile, policy, and instruction source files: 256 KiB each;
- profile context budgets: at most 1,000,000 bytes each;
- instruction files: at most 50 selected files, 50 sources in a bundle, 100
  rules per source, and 8,192 characters per rule;
- policy assertions: at most 1,000;
- reduced evidence: 128 events, 16 KiB per source text, 64 KiB serialized
  readings, 16 linked projects, 20 active-memory items per project, 64 active-
  memory items total, 64 KiB serialized memory, 192 sources, and 32 KiB source
  metadata;
- privacy preflight: at most 1,000 evaluated items and 1,000 omissions, with
  at most 1,000,000 bytes for evaluated item text plus shared source metadata;
- the selected model target's `maxInputBytes` bounds both the original envelope
  and the protected envelope;
- the separate turn privacy audit retains at most 1,000 events per scope.

When a bounded source is intentionally excluded, the reduced evidence contains
an omission reason such as `EVENT_LIMIT`, `SOURCE_TEXT_LIMIT`,
`SERIALIZED_READING_LIMIT`, `ACTIVE_MEMORY_TOTAL_LIMIT`, or
`SOURCE_METADATA_LIMIT`. When a source is unavailable, malformed, ambiguous, or
fails integrity validation, the operation fails closed instead of converting the
error into an empty context.

## Preview, turn, and audit boundaries

Preview composes and displays the local result, including policy decisions,
source provenance, byte counts, and omissions. It does not authorize a model,
protect or deliver content, or write a privacy audit event.

An explicitly confirmed turn repeats the authoritative composition immediately
before any delivery boundary. The default host uses a simulated transport. An
OpenAI Responses path is available only through explicit process opt-in; no
provider call is implied by these examples.

When audit recording is enabled for the actual turn, the audit stores only
non-content fields and digests in the separate local namespace:

```text
<workspace-home>/turn-privacy-audit/
  scope_<sha256(canonical scope)>.json
```

The audit event records the scope, conversation/model/policy identities,
decision, bounded counts, preflight report digest, protected payload digest, and
the hash-chain fields. It does not store the envelope, the original question,
the protected text, mappings, or provider responses. The legacy v1 project
privacy-audit namespace remains separate.
