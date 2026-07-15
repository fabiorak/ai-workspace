# Product Definition

## Product goal

AI Workspace enables people who use more than one AI agent to resume work with
the right verified context, without replaying complete conversations and
without surrendering control of local project data.

## Primary persona

The initial persona is an independent software developer or technical lead who:

- works on multiple local Git repositories;
- uses at least two coding agents or model providers;
- regularly loses time reconstructing decisions, failed attempts, changed
  files, and test state;
- wants local control over transcripts, source code, and sensitive data;
- can run a local service and is comfortable with a CLI-first early product.

This persona is intentionally narrow. Teams, document-heavy workflows, and
non-technical users remain important later audiences, but they must not widen
the first MVP before cross-agent continuity is validated.

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
  attributed to a selected project implicitly;
- provenance is part of the data model;
- context selection must be inspectable;
- provider-specific behavior remains behind adapters;
- savings claims require explicit baselines;
- unsafe or uncertain actions remain visible to the user.
- every interface is self-guiding: first-run paths, contextual help, actionable
  errors, examples, and recovery instructions must let a new user complete the
  supported workflow without reading the full project documentation first.
