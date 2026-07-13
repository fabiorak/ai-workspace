# AI Workspace Control Plane

## Design Document

**Status:** evolving product vision  
**License:** Apache License 2.0  
**Note:** all examples use fictional names and identifiers.

This document describes the long-term direction, not current product state or
a commitment to implement every component named here. Accepted architecture
decisions live in ADRs, implemented behavior is recorded in architecture and
sprint documents, and the current operational plan is [`ROADMAP.md`](../ROADMAP.md).
Technologies, services, and interfaces remain candidates until selected by an
evidence-led ADR.

---

## 1. Vision

The project aims to build an open-source, local-first control plane for AI-assisted work.

Users increasingly work with multiple coding agents and frontier LLMs such as Codex, Claude Code, Gemini CLI, IDE-integrated assistants, local models, and API-based agents. A task may start with one agent and continue with another because of token limits, cost, availability, model specialization, or user preference.

Today, switching agents usually requires rebuilding the project context. This wastes time and tokens and often causes the loss of:

- decisions made during previous sessions;
- unresolved issues;
- failed attempts;
- relevant files and symbols;
- test results;
- scripts created for recurring tasks;
- historical conversations;
- document analysis and critical notes.

The platform is not intended to be another coding agent. It is a coordination layer that manages:

- projects and repositories;
- agents, models, skills, and tools;
- active memory and historical knowledge;
- context construction;
- privacy and reversible, best-effort pseudonymization;
- global search;
- handoffs;
- reusable automation;
- document analysis;
- token and cost analytics.

The expected outcome is a **local-first AI workbench for continuous work across agents, models, codebases, and document repositories**.

---

## 2. Guiding Principles

### 2.1 Local-first

The default deployment must keep user data local.

At minimum, the following should remain local unless explicitly configured otherwise:

- repository index;
- session transcripts;
- memory;
- anonymization mappings;
- original documents;
- generated artifacts;
- scripts and recipes;
- configuration;
- usage metrics.

### 2.2 Agent-agnostic

The platform must not depend on a single provider, agent, or model.

It should support:

- CLI agents;
- API-based agents;
- local models;
- cloud models;
- MCP-compatible tools;
- model gateways;
- future adapters.

### 2.3 Minimal sufficient context

The system must not send everything it knows to a model.

It should build the smallest context package that is sufficient for the current task.

### 2.4 Verifiable memory

Persistent knowledge should include:

- source;
- timestamp;
- validity;
- confidence;
- status;
- version;
- relationship to newer decisions;
- evidence of verification.

### 2.5 Privacy by design

Anonymization, policy enforcement, auditability, and data inspection must be architectural concerns, not optional add-ons.

### 2.6 GUI-first and self-guiding

The graphical interface is the primary surface for routine onboarding and
daily use. Users should be able to become productive through documented
buttons, inline explanations, examples, progress, empty states, and actionable
recovery without reading a manual first or memorizing CLI commands.

The CLI remains available for automation, diagnostics, tests, and advanced
workflows. Documentation provides depth but cannot substitute for discoverable
behavior in the product. New user-facing capabilities require a GUI delivery
plan or an explicit temporary exception.

### 2.7 Open formats and composability

The project should prefer:

- open-source components;
- open protocols;
- portable files;
- replaceable storage engines;
- plugin systems;
- documented APIs;
- versioned schemas.

---

## 3. Problems Addressed

### 3.1 Cross-agent continuity

A task started with one agent must be resumable by another without loading the complete previous conversation.

The receiving agent should get:

- the current objective;
- work already completed;
- active constraints;
- relevant decisions;
- relevant files and symbols;
- current branch and commit;
- tests executed;
- unresolved errors;
- next actions.

### 3.2 Historical knowledge retrieval

Users must be able to find anything previously discussed or produced:

- chat questions;
- model answers;
- shell commands;
- stack traces;
- decisions;
- rejected approaches;
- files;
- commits;
- scripts;
- documents;
- annotations;
- reports.

### 3.3 Token reduction

The platform should reduce token usage through:

- selective retrieval;
- compression;
- deduplication;
- caching;
- structured code navigation;
- structured document retrieval;
- progressive disclosure;
- tool output summarization;
- reuse of verified scripts;
- routing simple work to smaller or local models.

### 3.4 Persistent decisions

Important information established in chat must not disappear when a session ends.

It should be converted into durable objects such as:

- facts;
- decisions;
- constraints;
- open tasks;
- procedures;
- failure records;
- handoffs;
- project instructions;
- document annotations.

### 3.5 Sensitive data protection

Inputs intended for external models should be able to pass through reversible,
best-effort pseudonymization plus independent policy and secret-detection
controls.

### 3.6 Reusable automation

Scripts and procedures created during sessions should be cataloged and reused instead of regenerated through new model calls.

---

## 4. Product Positioning

A possible description:

> A local-first AI workspace for cross-agent memory, context optimization, privacy-preserving model access, global project search, document analysis, and reusable automation.

The product should be viewed as an **AI work control plane**, not merely as a memory layer.

---

## 5. Core Conceptual Model

The platform must distinguish between:

1. active memory;
2. historical evidence;
3. artifacts;
4. search indexes;
5. temporary context;
6. operational work state.

```text
Projects, sessions, files, documents, logs, scripts, commits
                              |
                              v
                    Historical archive
                              |
                 +------------+------------+
                 |                         |
                 v                         v
            OpenSearch                Memory Store
       complete searchable         consolidated and
       historical evidence          currently valid data
                 |                         |
                 +------------+------------+
                              |
                              v
                       Context Builder
                              |
                    selection and compression
                              |
                              v
                           AI Agent
```

OpenSearch stores anything that may be useful later.

The Memory Store contains consolidated, active knowledge.

The Context Builder decides what should enter the current model context.

---

## 6. Memory Model

### 6.1 Project memory

Relatively stable project information:

- technology stack;
- runtime and dependency versions;
- architecture;
- coding conventions;
- build and test commands;
- repository structure;
- deployment constraints;
- security policies;
- compatibility limitations.

The platform should support standard files such as `AGENTS.md`.

```text
project/
├── AGENTS.md
├── .ai-workspace/
│   ├── HANDOFF.md
│   ├── DECISIONS.md
│   ├── TASKS.md
│   ├── SESSIONS/
│   └── INDEX.json
└── ...
```

### 6.2 Operational memory

Operational memory describes the exact point where work stopped.

Suggested file: `.ai-workspace/HANDOFF.md`.

```markdown
# Current handoff

## Objective
Implement automatic OAuth2 token refresh.

## Current state
The service client works, but retry after HTTP 401 is not implemented.

## Files involved
- src/services/ExternalServiceClient.ts
- src/services/AuthService.ts

## Decisions
- Do not use async/await.
- Retry only once.
- Do not change the public interface.

## Next actions
1. Intercept HTTP 401.
2. Invalidate the cached token.
3. Retry the request.
4. Add tests.

## Verification
npm test -- ExternalServiceClient
```

### 6.3 Episodic memory

Session events should be stored in an append-only log:

- user messages;
- agent messages;
- tool calls;
- commands;
- file reads;
- file modifications;
- test results;
- errors;
- commits;
- detected decisions.

```json
{"type":"user_message","session":"s123","timestamp":"...","content":"..."}
{"type":"tool_call","tool":"grep","args":{},"result_ref":"blob:abc"}
{"type":"decision","content":"Do not use async/await","confidence":1}
{"type":"file_modified","path":"src/service-client.ts","git_diff_ref":"blob:def"}
```

### 6.4 Semantic memory

Reusable knowledge across sessions or projects:

- technical patterns;
- solved errors;
- procedures;
- snippets;
- configurations;
- recurring constraints;
- reusable tools.

```yaml
type: solution
title: Restore a PostgreSQL dump with a missing owner
problem: pg_restore fails because the original role does not exist
solution:
  - use --no-owner
  - or temporarily create the missing role
tags:
  - postgres
  - pg_restore
verified: true
last_verified: 2026-07-09
```

### 6.5 Failure memory

Failed approaches must also be preserved.

```yaml
attempt:
  action: Upgrade a dependency to the latest version
  result: failed
  reason: Incompatible with the supported runtime
  do_not_repeat: true
```

### 6.6 Memory data model

```typescript
interface MemoryItem {
    id: string;
    workspaceId?: string;
    projectId?: string;
    sessionId?: string;
    taskId?: string;

    type:
        | "fact"
        | "decision"
        | "procedure"
        | "task"
        | "summary"
        | "preference"
        | "failure"
        | "constraint";

    content: string;
    sourceRefs: string[];
    confidence: number;

    status:
        | "active"
        | "historical"
        | "superseded"
        | "invalidated";

    validFrom: string;
    validUntil?: string;
    supersededBy?: string;

    createdAt: string;
    updatedAt: string;
}
```

The model must support relationships such as:

```text
decision B SUPERSEDES decision A
```

---

## 7. Global Historical Search

Historical retrieval is exposed through a replaceable port. The first
implemented adapter performs a bounded literal scan of validated canonical
events. A lightweight local index or OpenSearch may be selected later through
an ADR based on corpus measurements, performance, and operational cost.

The implemented global GUI composition enumerates registered projects only,
normalizes up to 100 explicit project IDs, scans at most 10,000 canonical
events, merges matches before one 1–100 result limit, and identifies the owning
project without exposing its path. Any included project failure aborts the
report rather than returning misleading partial results. Event/source
inspection remains project-scoped after explicit user selection. This closes
the unknown-project usability gap without selecting an index.

Its purpose is not to become active agent memory, but to make all previous evidence searchable.

### 7.1 Indexed content

The platform should index:

- user messages;
- agent responses;
- conversations;
- tool calls;
- summarized tool outputs;
- errors and stack traces;
- commands;
- files and code chunks;
- diffs and commits;
- decisions;
- failed attempts;
- scripts;
- documents;
- annotations;
- summaries;
- handoffs;
- test results.

### 7.2 Example indexed document

```json
{
  "id": "session-message-123",
  "documentType": "chat_message",
  "workspaceId": "default",
  "projectId": "sample-api",
  "sessionId": "session-2026-06-29",
  "agent": "codex",
  "model": "model-name",
  "role": "assistant",
  "content": "Use pg_restore with --no-owner...",
  "contentAnonymized": "Use pg_restore with --no-owner...",
  "timestamp": "2026-06-29T10:42:00Z",
  "tags": ["postgresql", "pg_restore", "docker"],
  "entities": ["pg_restore", "PostgreSQL"],
  "sourceRefs": ["artifact://session/session-2026-06-29"],
  "git": {
    "repository": "sample-api",
    "branch": "main",
    "commit": "3ab21fc"
  },
  "status": "historical",
  "confidence": 1.0
}
```

### 7.3 Search document types

```text
chat_message
session_summary
decision
solution
failure
error
command
artifact
script
code_chunk
file
commit
handoff
task
document
document_chunk
annotation
requirement
generated_document
```

### 7.4 Ranking evolution

The long-term design may combine:

- BM25/full-text;
- phrase matching;
- semantic similarity;
- metadata filters;
- project affinity;
- verification status;
- source quality;
- recency;
- usage frequency.

```text
score =
    lexical_score
  + semantic_score
  + project_affinity
  + verification_score
  + source_quality
  + recency_score
  + usage_score
```

Recency must not automatically outrank an older but verified solution.

The formula is illustrative, not an implementation contract. Initial ranking
should start with lexical retrieval, mandatory filters, and at most one
evidence-backed boost. Additional signals require a versioned golden query set
with expected results and before/after quality measurements.

### 7.5 Search filters

```text
project:sample-api
agent:claude
type:error
after:2026-01-01
language:typescript
verified:true
status:active
```

### 7.6 Knowledge trail

Results should reconstruct the sequence of work:

```text
Query:
"pg_restore missing role"

1. Original problem
2. Failed attempt
3. Verified solution
4. Generated script
5. Related commit
```

Available actions:

```text
[Open conversation]
[Open project]
[Show source]
[Use as context]
[Run script]
[Create handoff]
```

### 7.7 Index layout

Possible index groups:

```text
ai-chat-*
ai-code-*
ai-documents-*
ai-decisions-*
ai-artifacts-*
ai-tools-*
ai-sessions-*
```

Common alias:

```text
ai-global-search
```

---

## 8. Artifact Storage

OpenSearch should not be the only storage for large or original content.

A separate artifact store should keep:

```text
artifacts/
├── raw transcripts
├── tool outputs
├── patches
├── git diffs
├── source documents
├── converted documents
├── generated files
├── test reports
└── encrypted anonymization maps
```

Artifacts may be addressed by content hash:

```text
artifact://sha256/abc123
```

---

## 9. Context Builder

The Context Builder is the central runtime component.

### 9.1 Responsibilities

Given a task, it should:

1. identify the workspace, project, repository, and branch;
2. load global and project instructions;
3. read the current handoff;
4. retrieve active decisions;
5. query OpenSearch;
6. query the code or document graph;
7. select relevant files, symbols, sections, or annotations;
8. discard obsolete material;
9. deduplicate;
10. apply a token budget;
11. compress;
12. anonymize if required;
13. produce a context pack;
14. send it to the selected agent.

### 9.2 Example context pack

```yaml
context_pack:
  objective: Implement OAuth2 retry
  token_budget: 12000

  mandatory:
    - project_constraints
    - current_handoff
    - related_decisions

  code_context:
    symbols:
      - ExternalServiceClient.call
      - AuthService.getToken
    max_tokens: 5000

  previous_work:
    max_items: 5
    max_tokens: 2000
```

### 9.3 Progressive disclosure

```text
Level 0: project card
Level 1: handoff and decisions
Level 2: symbol signatures or document metadata
Level 3: selected code or document fragments
Level 4: complete files
Level 5: full historical evidence
```

---

## 10. Cross-Agent Handoff

Handoffs should use a provider-neutral task packet.

```json
{
  "task": "Implement OAuth2 retry",
  "acceptanceCriteria": [
    "Retry only once",
    "Add automated tests",
    "Do not change public APIs"
  ],
  "constraints": [
    "Legacy runtime",
    "No async/await"
  ],
  "relevantFiles": [
    "src/service-client.ts",
    "src/auth.ts"
  ],
  "decisions": [
    "Use the existing promise abstraction"
  ],
  "changesAlreadyMade": [],
  "tests": {
    "passed": [],
    "failed": []
  },
  "nextAction": "Handle HTTP 401"
}
```

Possible role allocation:

```text
Planner: Codex
Implementer: Claude
Reviewer: Codex
Test analyst: local model
```

Separate Git worktrees may be used to isolate concurrent agents.

---

## 11. Code Graph Integration

The platform should support a synchronized code graph for structural retrieval.

Suggested operations:

```text
find_symbol
find_references
find_callers
find_callees
find_implementations
find_routes
impact_analysis
architecture_summary
```

Synchronization sources:

```text
Git repository
     |
     +-- file watcher
     +-- git diff watcher
     +-- periodic consistency check
             |
             v
         Code index
```

The retrieval engine should choose among:

- lexical search;
- semantic search;
- code graph;
- Git history;
- memory;
- artifact retrieval.

---

## 12. Reversible Best-effort Pseudonymization

Pseudonymization is a mitigation, not a guarantee of anonymity or secret
removal. Entity detection can miss sensitive values, models can alter
placeholders, and renaming identifiers can change code semantics. Sensitive
workflows therefore also require human inspection, outbound data policy, and
secret detection independent of text transformation.

### 12.1 Pipeline

```text
input
  -> parsing
  -> entity detection
  -> custom recognizers
  -> anonymization
  -> context building
  -> agent
  -> model
  -> agent output
  -> deanonymization
  -> validation
  -> output
```

### 12.2 Entity classes

- people;
- email addresses;
- phone numbers;
- tax identifiers;
- IBANs;
- addresses;
- coordinates;
- credentials;
- tokens;
- IP addresses;
- internal hostnames;
- customer names;
- project names;
- business identifiers.

### 12.3 Custom dictionary

```yaml
entities:
  - canonical: CUSTOMER_001
    aliases:
      - Customer Alpha
      - Customer Alpha Ltd.
      - CUSTOMER_ALPHA
    replacement: "[[CUSTOMER_001]]"

  - canonical: PROJECT_003
    aliases:
      - MyProject
      - myproject
    replacement: "[[PROJECT_003]]"
```

### 12.4 Mapping requirements

Mappings must be:

- local;
- encrypted;
- reversible;
- deterministic;
- workspace-aware;
- project-aware where necessary;
- separated from ordinary logs.

### 12.5 Modes

```text
OFF
PII_ONLY
PII_AND_SECRETS
STRICT_BUSINESS_DATA
CUSTOM
```

### 12.6 Privacy Inspector

The UI should display:

```text
Original | Anonymized | Deanonymized response
```

Users should be able to:

- accept a transformation;
- correct it;
- create a rule;
- mark a false positive;
- declare a term public.

### 12.7 Indexing policy

```yaml
indexing:
  mode: anonymized
  store_original: encrypted
  index_secrets: false
  index_tool_outputs: summarized
```

---

## 13. Script and Automation Catalog

Scripts generated during work sessions should become reusable tools.

### 13.1 Tool manifest

```yaml
name: markdown-to-pdf
version: 1.2.0
description: Convert Markdown to PDF using Pandoc
runtime: python
entrypoint: main.py

inputs:
  - name: source
    type: file
    extensions: [md]

outputs:
  - name: pdf
    type: file

dependencies:
  system:
    - pandoc

security:
  network: false
  filesystem:
    read:
      - "${input}"
    write:
      - "${outputDirectory}"

tags:
  - markdown
  - pdf
  - conversion

verified:
  last_run: 2026-07-10
  test_status: passed
```

### 13.2 Tool functions

- search;
- preview;
- execution;
- versioning;
- history;
- tests;
- sandboxing;
- deduplication;
- tagging;
- recommendation;
- promotion from ad-hoc script to verified tool.

### 13.3 Recipes

```yaml
name: publish-technical-document
steps:
  - run: markdown-lint
  - run: markdown-to-pdf
  - run: generate-checksum
  - run: copy-to-release-directory
```

The system should suggest existing tools when it detects repeated procedures.

---

## 14. Token Reduction Strategies

### 14.1 Compression

Compress:

- CLI output;
- logs;
- stack traces;
- test output;
- transcripts;
- diffs;
- documentation.

### 14.2 Deduplication

Before dispatching a model request, the system should detect:

- repeated context;
- obsolete decisions;
- logs already represented by summaries;
- irrelevant lock files;
- duplicated tool output.

### 14.3 Prompt and response caching

Cache fingerprints should include:

```text
prompt
+ commit hash
+ relevant file hashes
+ tool version
+ model
+ system instructions
```

### 14.4 Smaller or local models

Use smaller models for:

- classification;
- tagging;
- embeddings;
- decision extraction;
- deduplication;
- summarization;
- routing;
- PII detection;
- context selection.

### 14.5 Diff-first context

For resumed work, the system may only need:

- base commit;
- current diff;
- active handoff;
- decisions;
- tests;
- current errors.

### 14.6 Referenceable tool output

```text
[Test output omitted: artifact://sha256/abc123]

Summary:
- 238 tests passed
- 2 tests failed
- failures in AuthService.spec.ts
```

### 14.7 Category budgets

```yaml
budget:
  total: 20000
  instructions: 2000
  handoff: 1500
  decisions: 1500
  code: 10000
  history: 2500
  tool_results: 2500
```

---

## 15. Instruction Management

The platform must manage composable instructions across models and agents.

### 15.1 Hierarchy

```text
Global instructions
        ↓
Workspace instructions
        ↓
Project instructions
        ↓
Model-specific instructions
        ↓
Agent-specific instructions
        ↓
Task-specific instructions
```

Possible global structure:

```text
~/.ai-workspace/
├── instructions/
│   ├── GLOBAL.md
│   ├── workspace.md
│   ├── models/
│   │   ├── claude.md
│   │   ├── codex.md
│   │   └── gemini.md
│   └── agents/
│       ├── architect.md
│       ├── developer.md
│       ├── reviewer.md
│       └── tester.md
```

Project-level structure:

```text
project/
├── AGENTS.md
├── CLAUDE.md
├── CODEX.md
└── .ai-workspace/
    ├── instructions.md
    ├── HANDOFF.md
    ├── DECISIONS.md
    └── skills/
```

### 15.2 Native file compatibility

The platform should understand and normalize:

- `AGENTS.md`;
- `CLAUDE.md`;
- Codex-specific files;
- IDE instruction files;
- MCP configuration;
- platform-native instruction files.

```typescript
interface InstructionSource {
    id: string;

    scope:
        | "global"
        | "workspace"
        | "project"
        | "model"
        | "agent"
        | "task";

    target?: string;
    path?: string;
    priority: number;
    rules: InstructionRule[];
}
```

### 15.3 Constraints and preferences

Non-overridable constraints:

- never send secrets;
- do not operate outside the project;
- confirm destructive commands;
- confirm deployment;
- comply with legal and license policies.

Overridable preferences:

- preferred language;
- coding style;
- framework;
- commit format;
- response detail;
- testing style.

```yaml
rules:
  - id: security.no-secrets
    type: constraint
    overridable: false
    content: Never send credentials to external models.

  - id: coding.preferred-language
    type: preference
    overridable: true
    content: Prefer TypeScript.
```

Precedence prevents lower-level configuration from replacing a constraint; it
does not make prompt text a security boundary. Tool, filesystem, network,
destructive-action, and external-model permissions must be enforced by
deterministic runtime boundaries. Prompts may carry preferences and defensive
instructions, but cannot provide those guarantees.

### 15.4 Precedence

```text
task
> agent
> model
> project
> workspace
> global
```

This precedence applies only to overridable rules.

### 15.5 Prompt Composer

The Prompt Composer should produce a deterministic, traceable, versioned instruction set.

```text
GLOBAL.md
+ workspace.md
+ AGENTS.md
+ CLAUDE.md
+ reviewer.md
+ task instructions
```

### 15.6 Effective prompt preview

The UI should show the final composed instructions, grouped by source:

```text
Global
Workspace
Project
Model
Agent
Task
```

Each rule should display:

- source;
- scope;
- priority;
- active status;
- override status;
- superseding rule.

---

## 16. Agent Registry

The UI should expose a catalog of configurable agents.

Examples:

```text
Architect
Planner
Developer
Reviewer
Tester
Security Reviewer
Documentation Writer
Database Specialist
DevOps Engineer
Document Analyst
Requirements Analyst
```

An agent is not just a prompt. It is a versioned configuration.

```yaml
id: security-reviewer
name: Security Reviewer
description: Review code and configuration for security issues.

instructions: agents/security-reviewer.md

allowed_tools:
  - code_search
  - read_file
  - git_diff
  - dependency_scan

forbidden_tools:
  - shell_write
  - deploy
  - delete_file

preferred_models:
  - claude
  - codex

context_profile:
  include:
    - git_diff
    - dependencies
    - security_decisions
  exclude:
    - unrelated_history

output_schema:
  type: security-review
```

Agent definitions should include:

- name and description;
- version;
- instructions;
- preferred and allowed models;
- enabled skills;
- allowed and forbidden tools;
- context policy;
- token budget;
- autonomy level;
- output format;
- confirmation rules;
- tests;
- author;
- license;
- provenance;
- checksum or signature.

---

## 17. Skill Registry

The platform must distinguish:

- **agent**: a role that interprets objectives and coordinates work;
- **skill**: a reusable domain capability;
- **tool**: an executable operation;
- **recipe**: a sequence of tools or skills.

```text
Agent: Backend Developer

Skills:
- TypeScript refactoring
- PostgreSQL migration
- API design
- Unit test generation

Tools:
- read_file
- write_file
- run_tests
- codegraph_find_references
```

Example skill:

```yaml
id: postgres-restore
name: PostgreSQL Restore
description: Restore a PostgreSQL dump while handling missing owners and roles.

instructions: skills/postgres-restore.md

required_tools:
  - shell
  - docker
  - artifact_store

inputs:
  - dump_file
  - database
  - container

risk_level: medium

requires_confirmation:
  - drop_database
  - overwrite_existing_data
```

Selecting a skill may alter:

- available tools;
- retrieved context;
- token budget;
- security policy;
- required input;
- expected output;
- validation rules.

---

## 18. Visual Editor for Agents and Skills

The UI should allow users to create, edit, clone, import, export, and test agents and skills.

Suggested sections:

```text
General
Instructions
Models
Tools
Skills
Context
Permissions
Output
Tests
Versioning
```

Editing modes:

```text
[Form] [Markdown] [YAML] [Effective Prompt] [Test]
```

Validation should detect:

- missing tools;
- missing skills;
- permission conflicts;
- unavailable models;
- invalid output schemas;
- contradictory instructions;
- forbidden overrides;
- cyclic dependencies;
- version incompatibility.

---

## 19. Agent and Skill Testing

Agent packages should include behavioral and security tests.

```yaml
tests:
  - name: does not modify files during review
    input: Review this patch
    expected:
      forbidden_tool_calls:
        - write_file

  - name: detects SQL injection
    fixture: fixtures/sql-injection.ts
    expected_contains:
      - SQL injection
```

Test categories:

- allowed tool usage;
- forbidden tool usage;
- output conformance;
- policy compliance;
- context usage;
- malicious input handling;
- prompt injection resistance;
- token usage;
- regression testing.

---

## 20. Task Setup UI

Before starting a task, the user should be able to select:

- project;
- model;
- agent;
- skills;
- tools;
- privacy mode;
- instruction sources;
- token budget;
- context profile.

```text
Project: sample-api
Task: Restore the development database

Model:
[Codex ▼]

Agent:
[PostgreSQL Specialist ▼]

Skills:
[x] PostgreSQL Restore
[x] Docker Management
[ ] Schema Migration

Instructions:
✓ Global
✓ Project
✓ Codex
✓ PostgreSQL Specialist

Privacy:
PII_AND_SECRETS

Context:
8,420 tokens
```

Actions:

```text
[Preview instructions]
[Preview context]
[Preview anonymization]
[Start]
```

The system may suggest suitable agents and skills, but sensitive actions must still require confirmation.

---

## 21. Community Package Registry

Agents and skills may later be distributed as packages.

```text
@workspace/security-reviewer
@workspace/java-legacy-specialist
@workspace/angular-migration
@workspace/kubernetes-deployer
```

Package structure:

```text
agent-package/
├── agent.yaml
├── instructions.md
├── skills/
├── tests/
├── fixtures/
├── README.md
├── LICENSE
└── SIGNATURE
```

Possible commands:

```bash
workspace agent install github:user/security-reviewer
workspace skill install ./skills/postgres-restore
workspace agent validate security-reviewer
workspace agent test security-reviewer
```

Security requirements:

- checksum;
- signature;
- provenance;
- declared permissions;
- dependency metadata;
- compatibility metadata;
- sandboxing;
- trust levels.

---

## 22. Document Repositories

The platform should treat document repositories as first-class workspaces.

A document repository may be:

- a local folder;
- a Git repository;
- an exported document management archive;
- a collection of PDFs, DOCX files, spreadsheets, presentations, email, and attachments;
- a mixed repository containing both code and documents.

Repository profiles:

```text
SOFTWARE
DOCUMENTS
MIXED
LEGAL
TECHNICAL
RESEARCH
TENDER
QUALITY
POLICY
```

### 22.1 Code and document parallels

| Software repository | Document repository |
|---|---|
| source files | documents |
| symbols and functions | sections, paragraphs, tables, concepts |
| module dependencies | references and document relationships |
| commits and diffs | revisions and changes |
| errors and tests | inconsistencies, gaps, verification |
| code review | critical review |
| patch | proposed revision |
| handoff | analysis state |
| architecture decisions | observations and conclusions |

---

## 23. Document Processing Pipeline

```text
Document folder
        ↓
File discovery
        ↓
Parsing and normalization
        ↓
Anonymization
        ↓
Structural chunking
        ↓
Metadata extraction
        ↓
OpenSearch indexing
        ↓
Relationship extraction
        ↓
Agent analysis
        ↓
Annotations and derived documents
```

### 23.1 Supported formats

Initial support should include:

- PDF;
- DOCX;
- ODT;
- Markdown;
- TXT;
- HTML;
- CSV;
- XLSX;
- PPTX;
- email;
- images;
- scanned PDFs through optional OCR.

### 23.2 Structural parsing

Documents must not be reduced to plain text.

Where available, preserve:

- document;
- version;
- page;
- section;
- heading;
- paragraph;
- table;
- note;
- attachment;
- author;
- date;
- references;
- original position;
- bounding box;
- content hash;
- language;
- validity status.

```json
{
  "documentType": "document_chunk",
  "repositoryId": "sample-tender-2026",
  "documentId": "technical-specification",
  "file": "Technical-Specification.pdf",
  "page": 17,
  "section": "4.2 Security Requirements",
  "content": "The supplier must guarantee...",
  "contentHash": "sha256:...",
  "version": "2026-06-14",
  "sourceRef": "artifact://sha256/..."
}
```

### 23.3 Structural chunking

Chunk boundaries should follow:

- section;
- subsection;
- paragraph;
- table;
- list;
- note;
- attachment;
- regulatory clause;
- requirement.

Every chunk must preserve source provenance.

---

## 24. Document Search and Annotations

OpenSearch should retrieve:

- exact phrases;
- concepts;
- sections;
- requirements;
- references;
- notes;
- observations;
- previous versions;
- related documents.

Example filters:

```text
"maximum recovery time"
type:requirement
repository:sample-tender-2026
section:"security"
status:open
severity:high
```

### 24.1 Persistent annotations

Annotations should be stored outside the chat and linked to precise document locations.

```typescript
interface DocumentAnnotation {
    id: string;
    repositoryId: string;
    documentId: string;
    versionId: string;

    location: {
        page?: number;
        section?: string;
        paragraph?: string;
        textRange?: string;
        boundingBox?: number[];
    };

    type:
        | "note"
        | "issue"
        | "question"
        | "contradiction"
        | "requirement"
        | "suggestion"
        | "risk";

    content: string;

    severity?:
        | "low"
        | "medium"
        | "high"
        | "critical";

    sourceRefs: string[];

    status:
        | "open"
        | "resolved"
        | "obsolete";

    createdBy: string;
    createdAt: string;
    updatedAt: string;
}
```

Suggested project files:

```text
.ai-workspace/
├── HANDOFF.md
├── ANALYSIS.md
├── OBSERVATIONS.md
├── QUESTIONS.md
├── SOURCES.md
├── DECISIONS.md
└── TRACEABILITY.csv
```

---

## 25. Document Agents and Skills

Possible agents:

```text
Document Analyst
Critical Reviewer
Legal Reviewer
Technical Reviewer
Requirements Analyst
Consistency Checker
Evidence Collector
Report Writer
Executive Summary Writer
Compliance Reviewer
```

Possible skills:

```text
Compare documents
Extract requirements
Detect contradictions
Find missing information
Build traceability matrix
Summarize sections
Extract obligations
Generate critical observations
Produce revision comments
Draft final report
```

Example:

```yaml
id: requirements-analyst
name: Requirements Analyst
description: Extract and normalize requirements from technical documents.

instructions: agents/requirements-analyst.md

skills:
  - requirement-extraction
  - document-comparison
  - traceability-matrix

allowed_tools:
  - document_search
  - document_read
  - annotation_create
  - traceability_link_create

context_profile:
  include:
    - active_documents
    - document_versions
    - previous_observations
    - project_constraints

output_schema:
  type: requirement-analysis
```

---

## 26. Document Workflows

### 26.1 Requirements coverage analysis

Example repository:

```text
/projects/sample-tender/
├── tender-rules.pdf
├── Technical-Specification.pdf
├── clarifications.pdf
├── Technical-Proposal.docx
└── internal-notes.md
```

Work Item:

```text
Analyze the specification and verify whether the technical
proposal covers all mandatory requirements.
```

The system should:

1. index all documents;
2. extract requirements;
3. assign a stable identifier to each requirement;
4. connect requirements to proposal sections;
5. flag missing coverage;
6. flag ambiguous coverage;
7. generate a traceability matrix;
8. produce an observations report;
9. preserve provenance.

```text
REQUIREMENT-042
Source: specification, § 6.3, page 28
Status: partially covered

Evidence:
Technical-Proposal.docx, § 4.1

Observation:
The proposal describes daily backups but does not specify
the required maximum recovery time.
```

### 26.2 Critical review

The system should detect:

- unsupported claims;
- contradictions;
- inconsistent terminology;
- missing information;
- unclear obligations;
- unresolved assumptions.

### 26.3 Comparative analysis

Compare:

- offers;
- versions;
- specifications;
- policies;
- contracts;
- manuals;
- reports;
- project proposals.

### 26.4 Work resumption

When reopening an analysis, restore:

- current state;
- active document versions;
- open observations;
- decisions;
- questions;
- generated outputs;
- cited sources;
- next actions.

---

## 27. Document Version Comparison

The system should detect:

- added sections;
- removed sections;
- changed requirements;
- changed values;
- changed deadlines;
- replaced attachments;
- updated references;
- impact on previous analysis.

It must support semantic differences, not only textual diffs.

```text
Version 2 reduces the maximum recovery time from 8 hours to 4 hours.
```

When a source changes, the platform should identify:

- potentially obsolete annotations;
- changed requirements;
- observations requiring review;
- derived documents requiring regeneration;
- decisions based on superseded content.

---

## 28. Document Graph

The document equivalent of a code graph should model:

### Nodes

- repositories;
- documents;
- versions;
- sections;
- requirements;
- people;
- organizations;
- regulations;
- systems;
- decisions;
- observations;
- risks;
- questions;
- generated outputs.

### Relationships

```text
DOCUMENT CONTAINS SECTION
SECTION CONTAINS REQUIREMENT
DOCUMENT REFERENCES DOCUMENT
DOCUMENT REFERENCES REGULATION
OFFER_SECTION SATISFIES REQUIREMENT
OBSERVATION CRITICIZES SECTION
ANNOTATION REFERS_TO DOCUMENT_VERSION
VERSION SUPERSEDES VERSION
DECISION BASED_ON DOCUMENT
GENERATED_DOCUMENT DERIVED_FROM SOURCE
```

Example queries:

```text
Which observations depend on a requirement changed in the latest version?
```

```text
Which mandatory requirements still lack supporting evidence?
```

---

## 29. Derived Document Generation

The platform should generate:

- critical reports;
- compliance reports;
- requirement coverage matrices;
- executive summaries;
- gap lists;
- clarification questions;
- meeting minutes;
- revised documents;
- tender responses;
- remediation plans;
- alternative comparisons.

Every generated claim should preserve provenance.

```markdown
## Observation 12

The document does not specify the service availability requirement.

Sources:

- Technical Specification, § 8.2, page 41
- Technical Proposal, § 5.4, page 33
```

Supported outputs:

- Markdown;
- DOCX;
- PDF;
- HTML;
- CSV;
- XLSX;
- structured JSON.

---

## 30. Document Context Builder

```yaml
context_pack:
  objective: Verify coverage of security requirements

  repository:
    type: DOCUMENTS
    id: sample-tender-2026

  mandatory:
    - active_requirements
    - current_observations
    - latest_document_versions

  retrieve:
    - type: document_section
      query: security
      limit: 12

    - type: requirement
      status: active
      limit: 50

    - type: observation
      status: open
      limit: 20

  token_budget:
    total: 20000
    sources: 12000
    observations: 3000
    instructions: 2500
    output_constraints: 2500
```

The system must not resend the complete document repository for every task.

---

## 31. Unified Work Item

The Work Item is the central aggregate.

```text
Work Item
├── objective
├── repository
├── repository type
├── branch or document version
├── sources
├── agents
├── skills
├── instructions
├── context
├── annotations
├── evidence
├── outputs
├── verification
├── costs
└── handoff
```

Possible types:

```text
CODE_CHANGE
CODE_REVIEW
DOCUMENT_ANALYSIS
DOCUMENT_COMPARISON
REQUIREMENT_EXTRACTION
CRITICAL_REVIEW
REPORT_GENERATION
COMPLIANCE_CHECK
MIXED_ANALYSIS
```

The unified shape above is a later extensibility direction, not the Core MVP
acceptance boundary. The first cross-agent handoff supports only an explicit
software Work Item containing bounded objective state and additive handoff
snapshots. Document analysis, mixed repositories, Context Builder budgets,
skills, cost accounting, and orchestration remain later increments and cannot
be required to complete the Core MVP alpha.

Main flow:

```text
SEARCH
  -> RESUME
  -> BUILD CONTEXT
  -> SELECT AGENT
  -> EXECUTE
  -> VERIFY
  -> CONSOLIDATE
  -> REUSE
```

---

## 32. User Interface

### 32.1 Home

- current project;
- active agents;
- open work items;
- recent handoffs;
- token usage;
- cost;
- suggested tools;
- indexing status;
- privacy status.

### 32.2 Project Explorer

- repository;
- branch;
- worktree;
- instructions;
- handoff;
- decisions;
- sessions;
- documents;
- tasks;
- tools;
- graphs.

### 32.3 Universal Search

```text
Ctrl+K

> postgres owner restore
> @project:myproject oauth retry
> type:script markdown pdf
> decision:"no async/await"
```

### 32.4 Session Cockpit

```text
Project: sample-backend
Branch: feature/oauth-retry
Agent: Claude Code
Privacy: PII_AND_SECRETS
Context budget: 14,200 / 20,000

Context included:
✓ AGENTS.md
✓ HANDOFF.md
✓ 3 decisions
✓ 6 code symbols
✓ 1 previous error
```

### 32.5 Document Explorer

- folder tree;
- documents;
- versions;
- sections;
- requirements;
- annotations;
- relationships;
- generated outputs.

### 32.6 Document Viewer

- page and section navigation;
- highlighted evidence;
- annotations;
- cross-document links;
- version comparison;
- search result navigation.

### 32.7 Privacy Inspector

```text
Original | Anonymized | Deanonymized
```

### 32.8 Token Analytics

- estimated original tokens;
- tokens sent;
- tokens saved;
- cache hits;
- compressed output;
- cost;
- usage by model;
- usage by project;
- time to resume.

---

## 33. Observability and Metrics

Suggested metrics:

```text
token_input_original_estimated
token_input_sent
compression_ratio
retrieval_tokens
cache_hit_tokens
tool_output_tokens_avoided
context_reconstruction_tokens_avoided
cost_actual
cost_baseline
time_to_first_useful_change
number_of_repeated_attempts
handoff_success_rate
context_precision
```

### 33.1 Time to resume

Time between opening a project and the first correct agent action.

### 33.2 Baseline transparency

Every savings estimate must state its baseline.

```text
Estimated savings compared with:
full uncompressed session
```

---

## 34. Security

### 34.1 Threat model

Consider:

- unauthorized local disk access;
- stolen anonymization mappings;
- prompt injection;
- malicious scripts;
- network-capable tools;
- credential leakage;
- secrets in logs;
- unauthorized cloud models;
- untrusted plugins;
- malicious repositories;
- incorrect deanonymization.

### 34.2 Security requirements

- encryption for sensitive data;
- secret store;
- script sandboxing;
- capability-based permissions;
- file and network policies;
- audit logs;
- per-model policy;
- confirmation for destructive actions;
- artifact signatures or checksums;
- workspace isolation;
- log redaction.

### 34.3 Model policy

```yaml
models:
  local:
    allowed_data:
      - all

  enterprise_cloud:
    allowed_data:
      - source_code
      - pseudonymized_business_data

  public_cloud:
    allowed_data:
      - anonymized_text
    forbidden:
      - credentials
      - customer_documents
```

---

## 35. Logical Architecture

```text
┌──────────────────────────────────────────────────────────┐
│                    Web / Desktop UI                      │
│ projects · search · sessions · privacy · costs · tools  │
└──────────────────────────┬───────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────┐
│                    Control Plane API                     │
│                                                          │
│ Project Registry        Context Builder                  │
│ Session Manager         Work Item / Handoff Manager      │
│ Search Service          Agent / Skill Registry           │
│ Document Services       Script / Recipe Registry         │
│ Privacy Policy          Cost and Token Analytics         │
│ Model Router            Adapter Manager                  │
└───────┬──────────┬────────────┬─────────────┬────────────┘
        │          │            │             │
        ▼          ▼            ▼             ▼
  Memory Layer  Presidio   Code/Doc Graph   Model Gateway
        │          │            │             │
        └──────────┴──────┬─────┴─────────────┘
                          ▼
             Claude · Codex · Gemini · Local
```

---

## 36. Persistence

### 36.1 PostgreSQL

Indicative tables:

```text
workspaces
projects
repositories
sessions
events
work_items
tasks
handoffs
memories
decisions
failures
agents
skills
tools
recipes
executions
instruction_sources
instruction_rules
anonymization_rules
anonymization_maps
usage_metrics
model_policies
artifacts
documents
document_versions
document_sections
document_chunks
document_annotations
requirements
traceability_links
document_relations
generated_documents
```

### 36.2 OpenSearch

Responsibilities:

- full-text search;
- hybrid search;
- filtering;
- aggregation;
- historical indexing;
- code and document retrieval.

### 36.3 Vector search

For the MVP:

- OpenSearch vector search;
- or PostgreSQL with pgvector.

Avoid redundant storage engines until there is a demonstrated need.

### 36.4 Object storage or filesystem

Store:

- transcripts;
- source files;
- logs;
- diffs;
- reports;
- generated outputs;
- OCR output;
- encrypted mappings.

---

## 37. Initial Technology Architecture

### Backend

- TypeScript;
- Node.js;
- REST and/or GraphQL;
- WebSocket or SSE;
- MCP server;
- plugin system.

### Frontend

- Angular or React;
- local web application;
- optional Tauri wrapper.

### Candidate services

- PostgreSQL;
- OpenSearch;
- Python anonymization service;
- code graph service;
- document graph service;
- model gateway;
- local daemon.

None of these services is required by the Core MVP merely because it appears
in this vision. The accepted baseline is a modular monolith with local files
and replaceable ports; each runtime, database, listener, framework, or external
service requires a vertical need and an ADR.

### Deployment

- Docker Compose for development;
- native installer later;
- versioned container images;
- YAML and environment-based configuration.

---

## 38. Candidate Integrations

| Need | Candidate |
|---|---|
| Cross-agent memory and compression | Headroom |
| Reduced CLI output | RTK |
| Multi-model gateway | LiteLLM |
| Code graph | CodeGraph |
| Project instruction standard | AGENTS.md |
| Anonymization | Microsoft Presidio |
| General memory layer | Mem0 / OpenMemory |
| Tool protocol | MCP |
| Tracing | OpenTelemetry / Langfuse |
| Search | bounded local scan / lightweight local index / OpenSearch |
| Vector search | OpenSearch / pgvector |
| Local models | Ollama / llama.cpp |

All integrations should use adapters to avoid rigid coupling.

---

## 39. Proposed Repository Structure

```text
ai-workspace/
├── apps/
│   ├── server/
│   ├── web/
│   ├── desktop/
│   └── cli/
│
├── packages/
│   ├── core/
│   ├── project-registry/
│   ├── session-manager/
│   ├── context-builder/
│   ├── search/
│   ├── memory/
│   ├── privacy/
│   ├── instruction-manager/
│   ├── prompt-composer/
│   ├── agent-registry/
│   ├── skill-registry/
│   ├── policy-engine/
│   ├── tool-registry/
│   ├── package-registry/
│   ├── artifact-store/
│   ├── document-registry/
│   ├── document-parser/
│   ├── document-indexer/
│   ├── document-graph/
│   ├── annotation-manager/
│   ├── requirement-manager/
│   ├── traceability/
│   ├── document-diff/
│   ├── document-generator/
│   ├── telemetry/
│   └── shared/
│
├── services/
│   ├── presidio/
│   └── codegraph/
│
├── integrations/
│   ├── headroom/
│   ├── codex/
│   ├── claude-code/
│   ├── litellm/
│   └── mcp/
│
├── deploy/
│   ├── docker-compose/
│   ├── docker/
│   └── kubernetes/
│
├── docs/
│   ├── architecture/
│   ├── adr/
│   ├── security/
│   ├── development/
│   └── user-guide/
│
├── examples/
├── scripts/
├── AGENTS.md
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── SECURITY.md
├── LICENSE
└── README.md
```

A modular monolith is preferable for the initial MVP.

---

## 40. Architecture Decision Records

Suggested ADRs:

```text
ADR-001 Local-first architecture
ADR-002 OpenSearch for historical retrieval
ADR-003 PostgreSQL as transactional store
ADR-004 Separation between memory and historical index
ADR-005 Artifact store for large payloads
ADR-006 Agent adapters
ADR-007 Reversible anonymization
ADR-008 Work Item as aggregate root
ADR-009 Modular monolith for MVP
ADR-010 MCP as tool integration protocol
ADR-011 Hierarchical instruction composition
ADR-012 Non-overridable global constraints
ADR-013 Agent as versioned configuration
ADR-014 Separation of agents, skills, tools, and recipes
ADR-015 Visual editor with YAML portability
ADR-016 Agent and skill testing
ADR-017 Signed community packages
ADR-018 Context policy bound to agents and skills
ADR-019 Documents as first-class repositories
ADR-020 Structural document chunking
ADR-021 Persistent annotations
ADR-022 Document Graph
ADR-023 Semantic version comparison
ADR-024 Provenance for generated documents
ADR-025 Requirement traceability
ADR-026 Unified Work Item for code and documents
```

---

## 41. Roadmap

This is a long-term product horizon, not the operational sprint plan in
`ROADMAP.md`. The Core MVP alpha remains software-only: Project Registry,
controlled ingestion, bounded historical search, curated active memory, Work
Items, and verifiable handoffs. The implemented foreground loopback GUI now
covers the complete Core MVP journey, English/Italian localization,
effective-instruction preview, and a first read-only exact-byte-budgeted Context
Pack preview over explicit inputs; ADR-0015 records its local browser boundary.
The implemented developer measurement now reports exact candidate, included,
and omitted content bytes across a deterministic synthetic Context Pack corpus;
it changes no selection policy and makes no relevance or production claim.
An experiment-only granularity comparison retains full section metadata and
immutable resolution identity across reference, outline, and full levels. Its
negative standard-budget result enables none of those levels in the production
builder. A subsequent exact comparison expands source-table and full
metadata-table alternatives losslessly to the same logical sections.
ADR-0016 accepts the source table as a versioned Context Pack direction: it
creates the only new compact standard-budget fit and is smaller than the full
metadata table in every profile. Sprint 17 implements it as schema v2 with
explicit schema-v1 compatibility, deterministic marginal shared-byte
accounting, lossless expansion, and bilingual GUI inspection. Persistence,
delivery, and execution remain absent.
Sprint 18 adds the first portable agent/skill schema-v1 boundary: one explicit
project-scoped JSON bundle contains one agent and exactly its enabled skills,
validates versions, model/tool/context/confirmation relationships, and
round-trips through canonical JSON. The bilingual GUI inspects digest-pinned
local synthetic input as `USER_CONFIGURED` descriptive data. No registry,
installation, availability resolution, selection, permission, delivery, or
execution is enabled.
Sprint 19 adds the next read-only composition boundary. The user explicitly
selects one reviewed profile, its exact declared instruction-source set, one
allowed model, and one immutable handoff. The profile supplies the AGENT target
and continuity/instruction exact-byte budgets; the existing deterministic
composer and unchanged Context Pack schema-v2 builder produce a transient
inspection envelope with profile digest, declaration ownership, effective-rule
provenance, included items, omissions, and accounting. Context include/exclude
selectors remain descriptive and unresolved. No registry, automatic
selection, availability lookup, persistence, permission, delivery, or
execution is enabled.
Sprint 20 measures, but does not activate, a one-to-one mapping from eight
`handoff.*` profile selectors to existing continuity sections. A
non-excludable objective/repository/next-action/source-reference floor retains
task identity and provenance. Across nine policy/profile cases and 27 budgets,
fit rises from 9 to 12 and repeated historical candidate bytes fall 49.89%
with zero floor loss. Decision `adapt` keeps projection and bilingual report
measurement-only because no relevance/resume-quality evidence or schema-v2
source-table accounting justifies production semantics. Arbitrary selectors,
retrieval, permissions, and Context Builder behavior remain unchanged.
Indexed backends, model access, broader Context Builder retrieval, and
orchestration still require dedicated vertical slices and ADRs.

### MVP 1 — Project Memory and Search

- repository discovery;
- Git detection;
- session acquisition;
- replaceable historical-search backend;
- global search;
- `AGENTS.md`;
- `HANDOFF.md`;
- session summaries;
- decision log;
- minimal UI;
- MCP search tools.

Goal:

> Find previous work and resume it with a different agent.

### MVP 2 — Instructions, Agents, and Skills

- global instruction file;
- workspace and project instructions;
- model-specific extensions;
- Prompt Composer;
- effective prompt preview;
- Agent Registry;
- Skill Registry;
- visual selection;
- Markdown/YAML editor;
- permissions;
- versioned configuration.

### MVP 3 — Context Optimization

- Context Builder;
- token budgets;
- progressive disclosure;
- deduplication;
- compression;
- code graph;
- artifact store;
- usage metrics.

### MVP 4 — Privacy Proxy

- Presidio integration;
- custom recognizers;
- reversible mappings;
- encryption;
- Privacy Inspector;
- model policies.

### MVP 5 — Tool Registry

- script catalog;
- manifests;
- execution;
- sandboxing;
- recipes;
- tests;
- suggestions.

### MVP 6 — Document Repositories

- document folder registration;
- PDF, DOCX, Markdown, and TXT parsing;
- OpenSearch indexing;
- full-text search;
- viewer;
- annotations;
- provenance.

### MVP 7 — Advanced Document Analysis

- semantic search;
- requirements extraction;
- document agents;
- citation-based reports;
- document Context Builder;
- version comparison;
- Document Graph;
- traceability matrices.

### MVP 8 — Multi-Agent Orchestration

- planner;
- implementer;
- reviewer;
- agent adapters;
- worktrees;
- routing;
- fallback;
- automatic handoff.

### MVP 9 — Community Registry

- agent packages;
- skill packages;
- signing;
- trust metadata;
- package installation;
- updates and compatibility checks.

---

## 42. Non-Functional Requirements

### Performance

- interactive search latency;
- incremental indexing;
- incremental graph updates;
- context construction within seconds;
- no user blocking during background indexing.

### Reliability

- append-only event log;
- idempotent processing;
- retry policies;
- crash recovery;
- schema versioning;
- backups;
- reindexing.

### Portability

- Linux first;
- macOS and Windows later;
- containerized services;
- configurable storage.

### Extensibility

- plugins;
- adapters;
- hooks;
- APIs;
- MCP;
- manifests;
- events.

### Maintainability

- modular monolith initially;
- clear boundaries;
- migrations;
- automated tests;
- documentation;
- observability.

---

## 43. Open Source Strategy

### 43.1 Goals

- local installation;
- self-hosting;
- community integrations;
- no provider lock-in;
- transparent formats;
- sustainable governance.

### 43.2 License

The project uses the **Apache License 2.0**. Its permissive terms and explicit
patent grant support broad adoption, commercial use, and integration with
agent, model, and plugin ecosystems.

### 43.3 Initial repository files

- `README.md`;
- `LICENSE`;
- `CONTRIBUTING.md`;
- `CODE_OF_CONDUCT.md`;
- `SECURITY.md`;
- `GOVERNANCE.md`;
- `ROADMAP.md`;
- `ARCHITECTURE.md`;
- `CHANGELOG.md`;
- issue templates;
- pull request template;
- ADR directory;
- threat model.

### 43.4 Governance

Define:

- maintainers;
- approval process;
- release process;
- breaking-change policy;
- security response;
- plugin acceptance;
- compatibility guarantees;
- supported versions.

---

## 44. Open Questions

Open questions become ADRs or time-boxed spikes when they enter the active
roadmap. Session ingestion, handoff validation, and bounded measurement already
have implemented first answers; backend search, UI packaging, sandboxing, and
model access remain deliberately undecided.

1. How can sessions be captured reliably from different agents?
2. Which agents expose hooks or reusable transcripts?
3. Should Headroom be the primary proxy or an optional adapter?
4. Should OpenSearch also store embeddings?
5. Should sensitive originals ever be indexed, or only encrypted?
6. Which sandbox model should be used for scripts?
7. How should facts, decisions, and hypotheses be distinguished?
8. When should active memory be invalidated?
9. How should handoff accuracy be verified?
10. How should token savings be measured credibly?
11. How much support is possible for opaque CLI agents?
12. Should the MVP be a local daemon plus web UI or a desktop application?
13. How should historical conversations be imported?
14. How should retrieval-time prompt injection be mitigated?
15. Which document parsers provide sufficient structural fidelity?
16. How should annotations survive document version changes?
18. Should the Document Graph use a graph database or relational storage?
19. How should community agent packages be reviewed and trusted?
20. Which features belong in the core and which should remain optional plugins?

---

## 45. MVP Success Criteria

These criteria describe the broader first useful product horizon, not the
current Core MVP alpha acceptance boundary. The alpha proves the software-only
continuity path first; context packs, UI, a second provider, document workflows,
and measured provider-token savings are later increments.

The first useful release should allow users to:

1. register multiple local repositories;
2. acquire sessions from at least two different agents;
3. search previous conversations and solutions;
4. open the correct project;
5. generate a handoff;
6. build a context pack;
7. resume with a different agent;
8. avoid loading the complete previous session;
9. display estimated token savings;
10. preserve source provenance;
11. register a document repository;
12. search document content;
13. create persistent annotations;
14. generate a cited analysis report.

---

## 46. Naming Direction

The name should be:

- memorable;
- provider-neutral;
- compatible with code and document use cases;
- free of conflicts with existing projects;
- suitable for an open-source community.

Semantic directions:

```text
handoff
relay
continuity
workspace
context
memory
bridge
compass
nexus
atlas
loom
switchboard
```

Availability and trademark checks must be completed before publication.

---

## 47. Conclusion

The platform addresses a broader problem than agent memory.

Its purpose is to create operational continuity across:

- projects;
- repositories;
- sessions;
- agents;
- models;
- tools;
- documents;
- decisions;
- annotations;
- automation.

The key distinction is:

> Memory stores what is active and consolidated.  
> OpenSearch stores and retrieves historical evidence.  
> The Context Builder decides what should be sent to the model.

The resulting product is a local-first AI workbench with:

- verifiable memory;
- universal search;
- cross-agent handoff;
- automatic context engineering;
- privacy-preserving model access;
- reusable automation;
- document analysis;
- provenance;
- cost and token analytics.
