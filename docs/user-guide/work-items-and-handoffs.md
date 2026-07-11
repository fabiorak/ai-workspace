# Work Items and handoffs

Work Items make objective state explicit within one registered project. No
command infers a current task. Creation and every lifecycle transition require
canonical source-event IDs from the same project.

```bash
npm run cli -- work create --project <project-id> \
  --objective-stdin --source-event <event-id>
npm run cli -- work activate <work-item-id> --project <project-id> \
  --source-event <event-id>
npm run cli -- work show <work-item-id> --project <project-id>
```

Lifecycle actions are additive: `activate`, `block`, `complete`, and `reopen`
append attributed transitions. Objectives and history are not edited in place.

```bash
npm run cli -- handoff create --project <project-id> \
  --work-item <work-item-id> --memory <active-memory-id> \
  --next-action-stdin --source-event <event-id> \
  --relevant-file README.md
```

Memory selection is optional, explicit, and active-only. The packet captures
branch, HEAD, dirty state, and bounded changed path names; never patches, file
contents, remote URLs, or credentials. Creation does not execute an agent or
mutate evidence, memory, repository files, or older handoffs.

Preview the exact prospective persisted size before immutable creation with
the same creation options:

```bash
npm run cli -- handoff preview --project <project-id> \
  --work-item <work-item-id> --memory <active-memory-id> \
  --next-action-stdin --source-event <event-id>
```

The preview performs the same bounded repository capture and validation but
does not persist a handoff. It reports exact UTF-8 bytes for the schema-v2 JSON
that would be written. Token counts are secondary estimates labeled
`CEIL_UTF8_BYTES_DIVIDED_BY_4`. Repository state, generated ID, and clock are
prospective, so rerun preview if state changes before creation.

A full-session comparison appears only when its canonical session is named:

```bash
npm run cli -- handoff preview --project <project-id> \
  --work-item <work-item-id> --next-action-stdin \
  --source-event <event-id> --baseline-session <session-id>
```

The result identifies the session and labels the comparison `SAVINGS`,
`NEGATIVE_SAVINGS`, or `EQUAL_SIZE`. Preview never removes selected memory,
sources, failures, tests, or section trust metadata to improve the result.

```bash
npm run cli -- handoff show <handoff-id> --project <project-id> \
  --work-item <work-item-id>
npm run cli -- handoff validate <handoff-id> --project <project-id> \
  --work-item <work-item-id>
```

Validation is read-only. Drift directs the user to create a successor rather
than refreshing the immutable snapshot. Use `--json` for stable machine output.
Objective and next-action support stdin to stay out of shell history.

Evaluate a predeclared first action after importing the synthetic resume:

```bash
npm run cli -- handoff evaluate <handoff-id> --project <project-id> \
  --work-item <work-item-id> --resume-session <session-id> \
  --expected-event <event-id>
```

The command compares the expected ID with the first canonical action event. It
reports exact UTF-8 bytes first; token counts are labeled `ceil(bytes / 4)`
estimates. Synthetic timestamp intervals are not productivity measurements.

Claude Code import is pre-release, narrow, synthetic-only:

```bash
npm run cli -- session import --project <project-id> \
  --source claude-code \
  --file integrations/claude-code/test/fixtures/synthetic-session.jsonl
```

It never discovers provider state, invokes an agent, or accesses a network.
