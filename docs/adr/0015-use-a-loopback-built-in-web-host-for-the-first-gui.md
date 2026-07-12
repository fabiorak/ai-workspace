# ADR-0015: Use a loopback built-in web host for the first GUI

**Status:** accepted
**Date:** 2026-07-11

## Context

AI Workspace is GUI-first for routine onboarding and daily workflows. Sprint 8
must deliver a no-manual project registration, synthetic import, search, and
source-inspection journey. The repository has no selected GUI framework,
desktop runtime, HTTP API, daemon, or browser security boundary.

Three first-alpha options were compared:

1. a persistent local daemon plus browser UI;
2. a packaged desktop runtime;
3. one foreground Node.js process using the built-in HTTP server and a local
   browser UI with no external assets.

A daemon introduces lifecycle, upgrade, authentication, and background access
before evidence requires them. A desktop runtime provides native folder/file
pickers and future packaging advantages, but adds a large runtime and framework
decision before the interaction contract is validated. A foreground built-in
host reuses the accepted Node runtime, adds no dependency, stays reversible,
and is sufficient for the first local synthetic journey.

Loopback HTTP is still a security boundary. Other local pages and processes may
attempt CSRF, DNS rebinding, framing, or access to imported content. Untrusted
historical evidence may contain active markup or terminal/browser controls.

## Decision

Implement the first GUI in `apps/web` as one foreground Node.js process using
`node:http`, server-rendered semantic HTML, local CSS, and minimal local
JavaScript. Bind only to `127.0.0.1`; never bind all interfaces. Use an
ephemeral port by default and print only a bootstrap URL intended for the local
user. Do not open a browser automatically in tests.

Create a cryptographically random session token and a separate CSRF token for
each process. The one-time bootstrap path sets an opaque `HttpOnly`,
`SameSite=Strict`, `Path=/` session cookie and redirects to `/`. The token is
invalidated after successful bootstrap and must not appear in subsequent URLs,
logs, HTML, referrers, or API responses. Because the first host is plain
loopback HTTP, the cookie cannot claim `Secure`; this is accepted only for the
foreground loopback alpha and must be revisited before non-loopback or packaged
deployment.

Validate every request before routing:

- remote address must be loopback;
- `Host` must exactly match the active `127.0.0.1:<port>` or
  `localhost:<port>` authority;
- authenticated routes require the constant-time-checked session cookie;
- state-changing requests require the session cookie, an exact same-origin
  `Origin`, and the CSRF token in `X-AI-Workspace-CSRF`;
- only declared methods, content types, routes, and bounded bodies are accepted;
- responses set a restrictive CSP, `frame-ancestors 'none'`, no-sniff,
  no-referrer, no-store for private data, and a restrictive permissions policy.

Serve scripts and styles as separate local resources. CSP uses `default-src
'none'` and explicit same-origin script/style/connect directives; no inline
script, inline event handler, remote font, CDN, telemetry, or external request
is permitted. Render imported payload and artifact content only with text
escaping or `textContent`, never `innerHTML`.

The presentation layer calls a typed in-process GUI application facade over
existing domain use cases and adapters. It must not spawn, scrape, or import CLI
command handlers and must not import persistence internals directly. The facade
returns bounded view models with explicit trust, effect, recovery, and next
actions. Absolute paths are accepted only in the active project-registration
field and are not returned in routine project lists or logs.

The first alpha uses an explained text path field for project registration and
a bundled “Import safe sample” action. Native folder/file pickers, advanced
private file selection, persistent background operation, application packaging,
and OS integration are deferred. Reconsider a desktop wrapper when observed
users are blocked by path entry, when distribution requires a packaged app, or
when native permission and update integration outweigh the runtime cost.

Automated tests cover the facade, HTML semantics, interaction state machine,
HTTP routing, authentication, CSRF, Host/Origin validation, headers, body
bounds, inert rendering, focus targets, labels, and the complete synthetic
journey. A real-browser accessibility and usability pass is still required
before a supported release; static and HTTP acceptance are not claimed as full
WCAG certification.

## Consequences

- Sprint 8 can deliver an operational GUI without a framework or new runtime
  dependency;
- foreground process lifetime and explicit bootstrap reduce hidden background
  access;
- browser security controls become tested architecture rather than incidental
  middleware defaults;
- native chooser and production packaging quality are deliberately limited in
  the first alpha;
- GUI application contracts remain reusable if a later desktop shell replaces
  the transport;
- CLI remains available for automation and diagnostics but is not invoked by
  GUI workflows;
- non-loopback serving, remote access, HTTPS, persistent daemon operation,
  external assets, and production distribution require a new ADR.
