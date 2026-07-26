# Product Definition

## Product goal

AI Workspace enables people who use more than one AI agent to resume work with
the right verified context, without replaying complete conversations and
without surrendering control of local project data.

## Primary persona

The persona is anyone who works with more than one AI assistant and who is **not
an insider**. They:

- keep their work in local folders, which may hold source code, documents, or
  both;
- use at least two assistants or model providers, and switch between them;
- regularly lose time re-explaining decisions, failed attempts, and the state of
  the work to a new assistant;
- want local control over conversations, files, and sensitive data;
- can use a program with a familiar graphical interface, do not know the domain
  vocabulary, and will not read a manual first.

This persona is the target of every interface decision, and is described in full
in [`EXPERIENCE_VISION_EN.md`](EXPERIENCE_VISION_EN.md) with its Italian
counterpart. The graphical interface is the surface that must serve it; the CLI
stays available for automation, diagnostics, and advanced use.

Teams and multi-user workflows remain a later audience, and must not widen the
first MVP before cross-agent continuity is validated. Document repositories are
designed but not yet in the delivery horizon; even so, no interface may assume a
project contains code.

## Primary job to be done

> When I stop working with one AI agent, I want another agent to understand the
> current objective, verified decisions, relevant changes, failures, and next
> action, so that it can continue correctly without reading the full previous
> transcript.

## MVP hypothesis

If AI Workspace imports agent evidence, separates active knowledge from
history, and produces a source-linked handoff, then a second agent can perform
the first correct action faster and with less context than a full-session
replay.

## MVP workflow

1. Register two or more local Git repositories.
2. Import a representative session from the first supported agent.
3. Search for a previous decision, error, command, or solution.
4. Consolidate the active objective, decisions, constraints, and repository
   state.
5. Generate a neutral handoff with source references.
6. Resume the task with a second supported agent.
7. Compare time and context use with a documented full-session baseline.

## MVP success criteria

- a known historical item can be found and opened at its source;
- importing the same session twice does not duplicate evidence;
- the handoff identifies verified facts and unverified claims;
- a second agent performs the expected first action without the full prior
  transcript;
- context and time savings are reported with their measurement method;
- no project data is sent to an external model without explicit execution and
  an applicable policy.

## Non-goals for the first MVP

- autonomous multi-agent task execution;
- a community marketplace;
- production Kubernetes deployment;
- complete document-analysis workflows;
- support for every agent or transcript format;
- a general-purpose vector database abstraction;
- a polished desktop application;
- automatic execution of imported commands or scripts.

## Product principles

- local-first behavior is the default, not an installation option;
- evidence is retained, active memory is curated, and the two are not
  interchangeable;
- project-free questions retain first-class `GENERAL` provenance and are never
  attributed to a selected project implicitly; exact events may receive an
  explicit immutable `LINK_ONLY` association without moving, copying,
  promoting, or reclassifying evidence;
- provenance is part of the data model;
- context selection must be inspectable;
- provider-specific behavior remains behind adapters;
- savings claims require explicit baselines;
- unsafe or uncertain actions remain visible to the user.
- every interface is self-guiding: first-run paths, contextual help, actionable
  errors, examples, and recovery instructions must let a new user complete the
  supported workflow without reading the full project documentation first.
