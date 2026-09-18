# ADR-0046: Keep the local GUI session across restarts

**Status:** accepted
**Date:** 2026-09-18

## Context

ADR-0015 mints a session token per process and hands it to the browser through
a one-time bootstrap URL. The link proves one thing, and proves it well:
whoever opens it can read the terminal that started the host. Loopback alone
cannot prove that, because any page the person has open, and any process
running as them, may also speak to `127.0.0.1`.

Charging that proof once per process, however, was never the goal; it was a
side effect of holding the token in memory. Restarting the host — after a
build, a crash, a laptop suspend, or simply closing the window — invalidated a
session that nothing had compromised, and cost a trip to the terminal, a fresh
link, and a reloaded tab. Observed use during the 18 September 2026 acceptance
round made the cost concrete: a restart in the middle of a review discarded a
session and the link already spent, and the round could not continue until the
host was started again by hand.

The two proofs are separable. "This browser was authorised by someone at the
terminal" is a fact about a browser, not about a process, and it does not stop
being true because the host exited.

## Decision

Store the session token in the workspace home, at `session/session.json`, and
reuse it when a later start finds it valid. The stored document holds the
schema version, the token, and the instants it was created and expires, and
nothing else. Sessions last thirty days from creation; the bootstrap cookie
declares the time remaining rather than a fixed eight hours, so a browser stops
sending a value the host would refuse.

The stored session is refused, and a new one minted, when the file is missing,
expired, unparseable, or readable by accounts other than the owner. Permissions
are `0600` inside a `0700` directory, created narrow rather than widened and
corrected, and a widened file is discarded rather than tightened: a token other
accounts could have read no longer proves anything. Writing is atomic through a
temporary file and a rename, and a session that cannot be written is still
served for the life of the process, with the terminal saying so.

Everything else in ADR-0015 stands unchanged: loopback-only binding, exact
`Host` validation, constant-time cookie comparison, `HttpOnly`,
`SameSite=Strict`, same-origin `Origin` plus CSRF token on every mutation, the
restrictive CSP, and the one-time, single-use bootstrap path. The CSRF token
stays per process, because it defends a different thing and costs nothing to
recreate.

The terminal message follows the state instead of always printing the link: the
plain address when a session was reused, the bootstrap link when one was
created, with the reason it was created.

## Consequences

- restarting the host no longer costs a trip to the terminal, which is the
  whole point of the change;
- the session outlives the process, so revoking it means deleting
  `session/session.json` — a fact the user guide has to state, because "stop the
  program" no longer means "end the session";
- a token now exists at rest. An adversary who can read the workspace home can
  use it, but that same adversary can already read the conversations, the
  handoffs and the pseudonym maps stored beside it, so the marginal loss is the
  ability to act through the GUI rather than access to new material. This is the
  residual risk the Settings screen already names for app-managed keys;
- cookies ignore ports, so the stored session is sent to any server answering on
  `127.0.0.1`, for thirty days instead of eight hours. `HttpOnly` keeps page
  scripts from reading it, but a local server the person visits in the same
  browser can collect it and then act as them against this host. Binding the
  session to a fixed port, or to a per-start nonce checked on every request,
  would close this and is deliberately deferred until a packaged deployment
  makes a fixed port acceptable;
- the eight-hour window is gone, so an unattended browser stays authorised far
  longer. This is accepted for a single-user local alpha and must be revisited
  together with non-loopback serving, which remains forbidden.
