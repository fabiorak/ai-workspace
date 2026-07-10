# Project Registry

The Project Registry remembers local Git repositories and refreshes their
current state. Sprint 1 supports non-bare repositories and linked worktrees.
It never clones, fetches, checks out, or modifies a repository.

## Prerequisites

- Node.js 24 and npm 11;
- Git available on `PATH`;
- a local non-bare Git repository.

## Build

```bash
npm ci
npm run build
```

## Register a repository

```bash
npm run cli -- project register /path/to/repository
```

The path may point to a nested directory. AI Workspace asks Git for the
repository root and resolves the filesystem's canonical path. Registering that
same root again refreshes its metadata without creating a second project.

The command reports:

- opaque project ID;
- canonical local path and name;
- repository profile;
- current branch or detached/unborn state;
- HEAD revision when present;
- sanitized `origin` URL when configured;
- clean or dirty worktree state;
- last inspection time.

## List projects

```bash
npm run cli -- project list
```

## Refresh a project

Copy the ID shown during registration or listing:

```bash
npm run cli -- project inspect <project-id>
```

The command re-reads the repository and updates mutable Git metadata while
preserving project identity and registration time.

## JSON output

Add `--json` to `register`, `list`, or `inspect`:

```bash
npm run cli -- project list --json
```

Standard output contains only JSON on success, making the command suitable for
scripts. Errors are written to standard error and return a non-zero exit code.

## Local storage

The default registry location is:

```text
~/.ai-workspace/projects.json
```

Use an isolated directory when experimenting:

```bash
AI_WORKSPACE_HOME=/tmp/ai-workspace-demo npm run cli -- project register .
```

The registry contains confidential local metadata, including filesystem paths.
AI Workspace requests directory mode `0700` and file mode `0600` where the
platform supports POSIX permissions. Writes use a temporary file and atomic
rename.

## Current limitations

- bare repositories are rejected;
- the repository profile defaults to `SOFTWARE`;
- repository discovery and removal commands are not implemented;
- concurrent CLI writers are not coordinated;
- there is no background refresh, database, API, or graphical interface;
- moving a repository creates a new canonical path and currently requires a
  new registration.
