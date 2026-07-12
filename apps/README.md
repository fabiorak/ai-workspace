# Applications

Runnable entry points live here:

- `server/` — local control-plane API and background processing;
- `web/` — implemented foreground loopback GUI for the first guided journey;
- `desktop/` — optional desktop wrapper;
- `cli/` — implemented command-line interface and automation entry point;

The standalone server and desktop stacks remain intentionally undecided. The
first web alpha uses the Node built-in HTTP host accepted by ADR-0015.
