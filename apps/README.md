# Applications

Runnable entry points live here:

- `web/` — implemented foreground loopback GUI for the first guided journey;
- `cli/` — implemented command-line interface and automation entry point;

Only implemented applications have a directory. A standalone background server
and a desktop wrapper are anticipated by the long-term design but remain
intentionally undecided; their directories will be created by the increment that
implements them, not reserved in advance. The first web alpha uses the Node
built-in HTTP host accepted by ADR-0015.
