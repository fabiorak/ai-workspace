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

```bash
npm run cli -- handoff show <handoff-id> --project <project-id> \
  --work-item <work-item-id>
npm run cli -- handoff validate <handoff-id> --project <project-id> \
  --work-item <work-item-id>
```

Validation is read-only. Drift directs the user to create a successor rather
than refreshing the immutable snapshot. Use `--json` for stable machine output.
Objective and next-action support stdin to stay out of shell history.

Claude Code import is pre-release, narrow, synthetic-only:

```bash
npm run cli -- session import --project <project-id> \
  --source claude-code \
  --file integrations/claude-code/test/fixtures/synthetic-session.jsonl
```

It never discovers provider state, invokes an agent, or accesses a network.
