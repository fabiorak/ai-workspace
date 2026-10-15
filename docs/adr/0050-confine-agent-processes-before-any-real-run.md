# ADR-0050: Confine agent processes before any real run

Status: proposed
Date: 2026-09-28

## Context

ADR-0045 requires agent processes to run in a new bounded workspace with an
allowlisted environment, a process-tree timeout and the product's own managed
login. The dormant Codex and Claude Code runners forwarded `HOME`, the product
configuration directory, proxies, certificates and XDG paths from the parent,
ran in a directory the caller named, and started whatever `codex` or `claude`
the search path resolved. Refusing tool events in the parser happens after the
process has run, so it cannot prevent an effect that preceded it. Current
Claude Code documentation also states that `-p` without `--bare` loads hooks,
MCP servers and context from the working directory and the configuration
directory, even for an untrusted folder, while `--bare` disables the
subscription login.

## Decision

Add `integrations/agent-process`, shared by both adapters, and remove their
duplicated runners. No sandbox, runtime or dependency is added.

**Workspace.** Each run gets a new directory under a private root: `home`,
`work` and `tmp`, all 0700, owned by this account, with no link anywhere on
their path. The process runs in `work`, with `HOME` at `home` and `TMPDIR` at
`tmp`. Release removes directories one at a time only when empty and never
recursively, so anything a run leaves stays for inspection.

**Environment.** Nothing is inherited. The process receives exactly `PATH`
from explicit absolute directories, `HOME`, `TMPDIR`, `LANG`, `LC_ALL`, the XDG
directories inside the run home, and one product variable, `CODEX_HOME` or
`CLAUDE_CONFIG_DIR`. No provider key, proxy, certificate override or unrelated
variable can cross.

**Managed login.** The product variable points to a directory dedicated to AI
Workspace, in which the person signs in to the product themselves, outside AI
Workspace. AI Workspace checks only its metadata: it must be private, owned,
free of links, and neither the personal home, the product's default directory
in it, nor inside the run. It never lists, reads, copies or returns what is
inside. Without such a directory the target stays unavailable; token copying
and `--bare` remain excluded.

**Executable.** The adapter locates its program on the explicit search path,
resolves it to one canonical file, rejects a file or directory others can
write, and records the file's SHA-256. The process is started from that path,
never by name, after the digest is checked again. An installation is qualified
only when its parsed version and its digest both appear on the reviewed list
shipped with the adapter. The lists are empty: no installed release has been
checked against the frozen flags, so every real installation is unavailable.
Reading the version of a real executable is itself a separate authorized step.

**Cancellation and after-the-fact checks.** The runner starts the leader in a
new process group, sends SIGTERM to the group, waits, sends SIGKILL and proves
the group is gone. A descendant still alive after the leader exits, or still
holding the streams, is recorded as lingering and killed with the group. A
process that left the group and holds the streams cannot be proven terminated;
the observation says so. Files left in `work` or `tmp` are recorded as written.
The adapters turn a lingering process, a written workspace or an unproven
termination into an unknown outcome, never an answer.

## Capability boundary

| Dimension           | Enforced before the run                     | Checked after the run                    | Not controlled                              |
| ------------------- | ------------------------------------------- | ---------------------------------------- | ------------------------------------------- |
| Working directory   | New private run tree, no links              | Entries left in `work` and `tmp`         | Absolute paths the process chooses to open  |
| Home and config     | Synthetic `HOME`, dedicated login directory | -                                        | What the product reads inside its login dir |
| Environment         | Built from nothing, no inherited variable   | -                                        | -                                           |
| Executable          | Canonical file, digest, reviewed version    | -                                        | Behaviour of a reviewed release             |
| Tools, MCP, plugins | Product flags in argv                       | Init event and tool events in the stream | Product-internal behaviour the flags permit |
| Network             | No proxy or key forwarded                   | -                                        | The product's own service connection        |
| Internal retries    | Product flags where they exist              | Retry events fail closed                 | Retries the product does not report         |
| Output              | 2 MiB per stream                            | Strict parser, one final answer          | -                                           |
| Cancellation        | Process group, SIGTERM then SIGKILL         | Group absence, lingering descendants     | A process that escaped the group            |

Filesystem reads outside the run are not prevented: the process runs as the
same account. This is the residual risk accepted for answer-only runs; a
stronger boundary requires a sandbox or separate account and its own ADR.
Cloud agents need their service connection, so zero network is never claimed.

## Consequences

- Neither agent can run until its installed release is reviewed, recorded by
  version and digest, and a dedicated login directory exists.
- The duplication recorded for the Claude Code qualification is resolved: both adapters share one
  confinement and cancellation implementation.
- Before any live run, the frozen flags must be confirmed on the installed release. On
  2026-09-28 the Claude Code CLI reference did not show `--safe-mode`,
  `--setting-sources` or `--strict-mcp-config` in the part that loaded, and
  names the retry event `system/api_retry`, which the parser already refuses.
- A person who signs in to the dedicated directory creates a second login
  state for the product; its lifetime and revocation belong to the product.

## Implementation status

The module and its qualification functions exist, tested with synthetic
executables: canaries in the parent environment, links, shared
directories, changed executables, a leader ignoring SIGTERM, descendants that
outlive the leader, a process that leaves the group and files left behind. The
reviewed lists are described in the amendment below.

## Amendment: the first reviewed Codex release

Date: 2026-10-15. The ADR remains proposed.

The Codex list now holds one entry: the standalone release `0.160.0` for
`x86_64-unknown-linux-musl`, a static binary, with its file digest. It was
reviewed without running a task: `--version`, `--help` and `exec --help` in an
empty environment with a temporary `HOME` and `CODEX_HOME`, then the complete
frozen argv followed by `--help`, which validates every flag and value before
printing help. Every frozen flag is still present in that release.

That release has a shared local app-server daemon. The Codex invocation now
starts with `--no-daemon`, so a run never attaches to a daemon already running
or leaves one behind; the lingering-process check remains the second line.
Even `--version` writes helper files under `CODEX_HOME`, so the dedicated login
directory is written by the product on every run; the run tree workspace check
is unchanged.

The official non-interactive documentation lists reasoning among the item
types and shows `item.started` lines. The adapter now discards reasoning items
unread, never storing or showing them, as for the local model, and accepts
`item.started` only for an answer or reasoning item. Any command, file change,
tool call, web search, plan, `turn.failed`, `error` or unknown event still voids
the answer.

The invocation also turns off, with `--disable`, the product features an
answer-only run does not need: shell and snapshot, image viewing, account apps
and connectors, plugins, hooks, skills and dependency installation, browser and
computer use, sub-agents, image generation, tool suggestions, sleep, goals,
daemon auto-start and unbounded connection retries. `features list` with those
options, on the reviewed release, reports all 23 off. `unified_exec`, a second
command path, stays on despite `--disable`, so it is not listed. It is an
accepted residual risk: the model can still run a command, which can read files
the account can read and reach the service before its event voids the answer.
Disabling is the product's own promise; the event check remains the boundary
AI Workspace enforces. Bounded network retries inside the product remain and
are transport retries, not application retries: one send is still one turn.

An automatic update changes the canonical file and its digest, so the updated
installation is unavailable until it is reviewed the same way. The Claude Code
list stays empty. Listing a release is not an authorization for a live run.
