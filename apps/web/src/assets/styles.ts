/**
 * The single stylesheet served at `/app.css`.
 *
 * Colour lives in custom properties so that a rule never names a literal, which
 * is what lets the dark theme be a short override block instead of a second
 * sheet. Nothing here depends on a font, icon, or stylesheet fetched over a
 * network: the content security policy forbids it and the workspace is offline.
 */
export const APP_CSS = `
:root {
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  line-height: 1.5;
  color-scheme: light dark;
  --canvas: #f4f7fb;
  --surface: #ffffff;
  --surface-soft: #f7f9fc;
  --ink: #132238;
  --muted: #617086;
  --border: #dce3ed;
  --accent: #3468f5;
  --accent-strong: #234dcc;
  --cyan: #19a9c5;
  --violet: #8758df;
  --amber: #e59b28;
  --good: #23a36d;
  --danger: #ca4459;
  --yours: #e6edfd;
  --sidebar: #101a2d;
  --sidebar-ink: #f3f6fb;
  --sidebar-muted: #98a8c0;
  --shadow: 0 18px 45px rgba(33, 48, 76, .08);
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body { margin: 0; min-width: 20rem; background: var(--canvas); color: var(--ink); }
button, input, select, textarea { font: inherit; }
a { color: var(--accent-strong); }
.app-shell { min-height: 100vh; display: grid; grid-template-columns: 17.5rem minmax(0, 1fr); }
.sidebar { position: sticky; inset-block-start: 0; height: 100vh; display: flex; flex-direction: column; gap: 1.5rem; padding: 1.35rem 1rem; overflow-y: auto; color: var(--sidebar-ink); background: radial-gradient(circle at 10% 0%, #20365e 0, transparent 30%), var(--sidebar); }
.brand { display: flex; align-items: center; gap: .75rem; padding: .3rem .5rem; color: inherit; text-decoration: none; }
.brand-mark { display: grid; place-items: center; inline-size: 2.5rem; block-size: 2.5rem; border: 1px solid rgba(255,255,255,.22); border-radius: .8rem; background: linear-gradient(135deg, #608cff, #7554e8); box-shadow: 0 9px 24px rgba(52,104,245,.3); font-size: .78rem; font-weight: 900; letter-spacing: .04em; }
.brand strong, .brand small { display: block; }
.brand strong { font-size: 1.02rem; letter-spacing: -.02em; }
.brand small { color: var(--sidebar-muted); font-size: .72rem; }
.primary-nav { display: grid; gap: .24rem; }
.primary-nav a { min-height: 2.75rem; display: grid; grid-template-columns: 1.35rem 1fr auto; align-items: center; gap: .65rem; padding: .62rem .72rem; border-radius: .72rem; color: var(--sidebar-muted); text-decoration: none; font-size: .9rem; font-weight: 650; transition: color .18s ease, background .18s ease, transform .18s ease; }
.primary-nav a:hover { color: var(--sidebar-ink); background: rgba(255,255,255,.07); transform: translateX(.12rem); }
.primary-nav a[aria-current="page"] { color: #fff; background: linear-gradient(100deg, rgba(82,125,250,.28), rgba(82,125,250,.08)); box-shadow: inset 3px 0 #6f96ff; }
.primary-nav a > span:first-child { font-size: 1.05rem; text-align: center; }
.nav-label { margin: 1rem .72rem .25rem; color: #71829c; font-size: .68rem; font-weight: 800; letter-spacing: .13em; text-transform: uppercase; }
/**
 * The conversation list. It scrolls on its own and keeps the two entries that are
 * not work — projects and settings — reachable at the bottom without scrolling
 * past the whole history to find them.
 */
.conversation-nav { min-height: 0; flex: 1 1 auto; overflow-y: auto; display: grid; align-content: start; gap: .1rem; }
.conversation-nav ul { margin: 0 0 .5rem; padding: 0; list-style: none; display: grid; gap: .1rem; }
/** A row is a button, because opening a conversation changes this page instead of leaving it. */
.conversation-nav a, .conversation-nav button { min-height: 2.75rem; display: grid; gap: .1rem; padding: .5rem .72rem; border-radius: .72rem; color: var(--sidebar-muted); text-decoration: none; width: 100%; text-align: start; background: none; border: 0; font: inherit; cursor: pointer; }
.conversation-nav a:hover, .conversation-nav button:hover { color: var(--sidebar-ink); background: rgba(255,255,255,.07); }
/** The open row is marked by more than colour, so the mark survives on a screen that shows none. */
.conversation-nav button[aria-current] { color: var(--sidebar-ink); background: rgba(255,255,255,.1); box-shadow: inset .18rem 0 0 currentColor; }
.moments { margin: 0; padding: 0 0 0 1.2rem; display: grid; gap: .9rem; }
/**
 * A conversation can hold hundreds of moments, and whatever follows it would then be
 * reachable only by scrolling past all of them — which is the same as not being there.
 * The moments scroll inside their own box, so what comes after stays in view.
 *
 * The box is focusable and named, because an area only a pointer can scroll is an
 * area some readers cannot read at all. Its own focus ring is declared here: the
 * shared rule covers controls, and this is not one.
 */
.moments-scroll { max-height: 60vh; overflow-y: auto; overscroll-behavior: contain; padding: .6rem .6rem .6rem 1.6rem; border: 1px solid var(--border); border-radius: .75rem; background: var(--surface-soft); }
.moments-scroll:focus-visible { outline: 3px solid #f0a500; outline-offset: 3px; }
.moment { padding: .1rem 0; }
/**
 * The moments the person wrote. A long conversation is mostly reply, so what a reader
 * scrolls back to find is their own question: it gets a surface of its own and a rule
 * down the side. The mark is not colour alone — each moment already says who spoke, and
 * the rule survives a screen that shows no colour at all.
 */
.moment-yours { padding: .45rem .75rem; border-inline-start: .2rem solid var(--accent); border-radius: .45rem; background: var(--yours); }
/** Line breaks a person typed are part of what they wrote, so they survive here. */
.moment-text { margin: .15rem 0; white-space: pre-wrap; overflow-wrap: anywhere; max-width: 72ch; }
.conversation-title { color: var(--sidebar-ink); font-size: .87rem; font-weight: 650; }
/** Italian runs longer than English, so the row wraps rather than being clipped to a fixed width. */
.conversation-meta { color: var(--sidebar-muted); font-size: .7rem; overflow-wrap: anywhere; }
.conversation-nav .help { margin: .2rem .72rem; color: var(--sidebar-muted); font-size: .68rem; }
.conversation-nav .inline-status { margin: .2rem .72rem; color: var(--sidebar-muted); font-size: .72rem; }
.technical-nav { display: grid; gap: .3rem; max-width: 32rem; }
.nav-label:first-child { margin-block-start: 0; }
.nav-badge { padding: .12rem .4rem; border: 1px solid rgba(255,255,255,.14); border-radius: 999px; font-size: .62rem; font-weight: 800; text-transform: uppercase; }
.locality-card { margin-block-start: auto; display: flex; align-items: center; gap: .7rem; padding: .85rem; border: 1px solid rgba(255,255,255,.09); border-radius: .8rem; background: rgba(255,255,255,.04); }
.locality-card strong, .locality-card small { display: block; }
.locality-card strong { font-size: .8rem; }
.locality-card small { color: var(--sidebar-muted); font-size: .68rem; }
.locality-dot, .status-dot { inline-size: .56rem; block-size: .56rem; flex: 0 0 auto; border-radius: 50%; background: var(--good); box-shadow: 0 0 0 .25rem rgba(35,163,109,.13); }
.workspace-shell { min-width: 0; }
.topbar { min-height: 5.4rem; display: flex; align-items: center; gap: 1rem; padding: 1rem clamp(1rem, 3vw, 3rem); border-block-end: 1px solid var(--border); background: color-mix(in srgb, var(--surface) 92%, transparent); }
.topbar h1 { margin: 0; font-size: clamp(1.35rem, 2.5vw, 1.8rem); letter-spacing: -.035em; }
.eyebrow, .card-kicker { margin: 0 0 .22rem; color: var(--accent); font-size: .7rem; font-weight: 850; letter-spacing: .13em; text-transform: uppercase; }
.topbar .eyebrow { color: var(--muted); font-size: .62rem; }
.topbar-state { margin-inline-start: auto; display: flex; align-items: center; gap: .55rem; padding: .45rem .75rem; border: 1px solid var(--border); border-radius: 999px; background: var(--surface); color: var(--muted); font-size: .75rem; font-weight: 700; }
.menu-toggle { display: none; }
main { width: min(100%, 94rem); margin-inline: auto; padding: clamp(1rem, 3vw, 3rem); }
section { margin-block: 0 1.5rem; padding: clamp(1rem, 2.6vw, 2rem); border: 1px solid var(--border); border-radius: 1rem; background: var(--surface); box-shadow: var(--shadow); }
section.route-hidden { display: none !important; }
section > h2 { margin-block-start: 0; font-size: clamp(1.45rem, 3vw, 2rem); letter-spacing: -.035em; }
.dashboard-hero { display: flex; align-items: end; justify-content: space-between; gap: 2rem; padding-block-end: 1.25rem; }
.dashboard-hero h2 { margin: 0; font-size: clamp(2rem, 5vw, 3.35rem); line-height: 1.05; letter-spacing: -.06em; }
.dashboard-hero p:not(.eyebrow) { max-width: 46rem; margin-block-end: 0; color: var(--muted); }
.inline-status { margin-block: .25rem 1.25rem; color: var(--muted); font-size: .82rem; }
.chart-tone-neutral { --chart-tone: var(--muted); }
.chart-tone-good { --chart-tone: var(--good); }
.chart-tone-attention { --chart-tone: var(--amber); }
.chart-tone-blocked { --chart-tone: var(--danger); }
.chart-tone-active { --chart-tone: var(--cyan); }
.chart-tone-proposed { --chart-tone: var(--violet); }
.chart-tone-info { --chart-tone: var(--accent); }
.dashboard-focus { display: grid; justify-items: start; gap: .3rem; margin-block-end: 1.25rem; padding: 1.25rem 1.4rem; border: 1px solid var(--border); border-inline-start: .32rem solid var(--chart-tone, var(--accent)); border-radius: .9rem; background: linear-gradient(120deg, color-mix(in srgb, var(--chart-tone, var(--accent)) 9%, var(--surface)), var(--surface)); }
.dashboard-focus h3 { margin: 0; font-size: clamp(1.15rem, 2.4vw, 1.5rem); letter-spacing: -.03em; }
.dashboard-focus p:not(.card-kicker) { max-width: 60ch; margin: 0; color: var(--muted); font-size: .88rem; }
.button-link { margin-block-start: .55rem; padding: .58rem .95rem; border-radius: .62rem; background: var(--accent); color: #fff; font-size: .82rem; font-weight: 780; text-decoration: none; }
.button-link:hover { background: var(--accent-strong); }
.chart-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
.chart-card { display: flex; flex-direction: column; gap: .7rem; margin: 0; padding: 1.25rem; border: 1px solid var(--border); border-radius: .9rem; background: linear-gradient(145deg, var(--surface), var(--surface-soft)); box-shadow: 0 9px 25px rgba(38,54,85,.045); }
.chart-card-heading h3 { margin: 0; font-size: 1rem; letter-spacing: -.02em; }
.chart-figure { display: grid; gap: .5rem; }
.chart-figure-donut { position: relative; justify-items: center; }
.chart { inline-size: 100%; }
.chart-donut { inline-size: 7.5rem; max-inline-size: 100%; block-size: auto; }
.chart-donut .chart-track { fill: none; stroke: color-mix(in srgb, var(--border) 78%, transparent); }
.chart-donut .chart-arc { fill: none; stroke: var(--chart-tone, var(--accent)); }
.chart-bar, .chart-meter { block-size: .78rem; }
.chart-bar .chart-track, .chart-meter .chart-track { fill: color-mix(in srgb, var(--border) 78%, transparent); }
.chart-slice { fill: var(--chart-tone, var(--accent)); }
.chart-empty .chart-track { opacity: .55; }
.chart-total { margin: 0; display: grid; justify-items: center; text-align: center; line-height: 1.15; }
.chart-total strong { font-size: 1.6rem; font-weight: 850; letter-spacing: -.05em; }
.chart-total span { color: var(--muted); font-size: .68rem; font-weight: 750; letter-spacing: .04em; text-transform: uppercase; }
.chart-figure-donut .chart-total { position: absolute; inset-block-start: 50%; max-inline-size: 4.4rem; transform: translateY(-50%); overflow-wrap: anywhere; }
.chart-legend { display: grid; gap: .3rem; margin: 0; padding: 0; list-style: none; }
.chart-legend-item { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: baseline; gap: .5rem; font-size: .8rem; }
.chart-swatch { inline-size: .62rem; block-size: .62rem; align-self: center; border-radius: .2rem; background: var(--chart-tone, var(--accent)); }
.chart-legend-value { color: var(--muted); font-variant-numeric: tabular-nums; }
.chart-card .notice { margin-block: 0; font-size: .78rem; }
.chart-table { margin-block: 1rem; }
.chart-table summary { padding: .5rem 0; color: var(--accent-strong); font-size: .82rem; font-weight: 780; cursor: pointer; }
.chart-table table { width: 100%; border-collapse: collapse; font-size: .82rem; }
.chart-table caption { padding-block-end: .5rem; color: var(--muted); font-size: .78rem; text-align: start; }
.chart-table th, .chart-table td { padding: .45rem .6rem; border-block-end: 1px solid var(--border); text-align: start; vertical-align: top; }
.chart-table thead th { color: var(--muted); font-size: .72rem; letter-spacing: .06em; text-transform: uppercase; }
.chart-table tbody th { font-weight: 780; }
.chart-table td:nth-child(n+3) { font-variant-numeric: tabular-nums; text-align: end; }
.filter-chip { display: flex; flex-wrap: wrap; align-items: center; gap: .6rem; margin-block: .75rem; padding: .55rem .85rem; border: 1px solid color-mix(in srgb, var(--accent) 35%, var(--border)); border-radius: 999px; background: color-mix(in srgb, var(--accent) 8%, var(--surface)); font-size: .8rem; }
.filter-chip button { margin: 0; padding: .28rem .7rem; font-size: .75rem; }
.card-link { align-self: flex-start; margin-block-start: auto; font-size: .78rem; font-weight: 800; text-decoration: none; }
.card-link::after { content: " →"; }
.boundary-card { display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 1rem; margin-block-start: 1rem; padding: 1.25rem; border: 1px solid var(--border); border-radius: .9rem; background: linear-gradient(120deg, color-mix(in srgb, var(--accent) 8%, var(--surface)), var(--surface)); }
.boundary-card h3 { margin: 0; font-size: 1rem; letter-spacing: -.02em; }
.boundary-icon, .empty-state-icon { display: grid; place-items: center; inline-size: 3rem; block-size: 3rem; border-radius: .8rem; color: var(--accent); background: color-mix(in srgb, var(--accent) 10%, var(--surface)); font-size: 1.3rem; }
.status-unavailable { margin-block-end: 0; color: var(--muted); }
.button-secondary, button { display: inline-block; margin-block: .75rem; padding: .68rem 1rem; border: 0; border-radius: .62rem; background: var(--accent); color: #fff; font-weight: 780; cursor: pointer; transition: background .18s ease, transform .18s ease; }
button:hover { background: var(--accent-strong); transform: translateY(-1px); }
.button-secondary { border: 1px solid var(--border); background: var(--surface); color: var(--ink); }
.button-secondary:hover { background: var(--surface-soft); }
label { display: block; margin-block-start: .7rem; font-weight: 750; }
input, select, textarea { width: min(100%, 48rem); display: block; margin-block: .28rem .75rem; padding: .72rem .82rem; border: 1px solid var(--border); border-radius: .6rem; background: var(--surface); color: var(--ink); }
textarea { min-height: 6rem; resize: vertical; }
input[type="checkbox"] { display: inline-block; width: auto; margin-inline-end: .5rem; }
/* Every rule above that sets \`display\` on an element or a class beats the browser's
   own \`[hidden] { display: none }\`, so a button, an input or a labelled block marked
   hidden stayed on screen: visible, reachable by keyboard, and clickable. This is
   placed after them, and matches on the attribute, so hiding something means it is
   hidden whatever else it is. */
[hidden] { display: none; }
fieldset { max-width: 48rem; margin-block: .75rem; border: 1px solid var(--border); border-radius: .7rem; }
button:focus-visible, a:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible, [tabindex="-1"]:focus { outline: 3px solid #f0a500; outline-offset: 3px; }
.help, .effect { max-width: 70ch; color: var(--muted); }
.notice { padding: .8rem 1rem; border-inline-start: .3rem solid var(--accent); border-radius: 0 .55rem .55rem 0; background: color-mix(in srgb, var(--accent) 7%, var(--surface)); }
.error { color: var(--danger); font-weight: 750; }
.project-card, .result-card { margin-block: .8rem; padding: 1rem; border: 1px solid var(--border); border-radius: .75rem; background: var(--surface-soft); }
.settings-grid { display: grid; gap: .8rem; }
.setting-card { display: grid; grid-template-columns: minmax(0, 1fr) minmax(10rem, 16rem); align-items: center; gap: 1rem; padding: 1.1rem; border: 1px solid var(--border); border-radius: .8rem; }
.setting-card h3, .setting-card p { margin-block: 0 .25rem; }
.setting-card select { margin: 0; width: 100%; }
.setting-value { justify-self: end; padding: .4rem .65rem; border-radius: 999px; background: var(--surface-soft); color: var(--muted); font-size: .78rem; font-weight: 750; }
#scripts { min-height: 28rem; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
#scripts.route-hidden { display: none; }
#scripts .notice { max-width: 42rem; text-align: start; }
.system-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .8rem; }
.system-grid article { display: flex; align-items: flex-start; gap: .75rem; padding: 1rem; border: 1px solid var(--border); border-radius: .8rem; background: var(--surface-soft); }
.system-grid h3, .system-grid p { margin: 0; }
.system-grid h3 { font-size: .9rem; }
.system-grid p { margin-block-start: .25rem; color: var(--muted); font-size: .78rem; }
.health-dot { inline-size: .62rem; block-size: .62rem; flex: 0 0 auto; margin-block-start: .3rem; border-radius: 50%; }
.health-good { background: var(--good); box-shadow: 0 0 0 .23rem rgba(35,163,109,.12); }
.health-muted { background: var(--muted); box-shadow: 0 0 0 .23rem color-mix(in srgb, var(--muted) 12%, transparent); }
pre { max-height: 30rem; overflow: auto; padding: .9rem; border: 1px solid var(--border); border-radius: .6rem; background: var(--surface-soft); white-space: pre-wrap; overflow-wrap: anywhere; }
footer { padding: 0 clamp(1rem, 3vw, 3rem) 2rem; color: var(--muted); font-size: .75rem; }
.skip-link { position: fixed; z-index: 100; inset-block-start: .5rem; inset-inline-start: .5rem; transform: translateY(-200%); padding: .6rem; border-radius: .4rem; background: var(--surface); }
.skip-link:focus { transform: none; }
.visually-hidden { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
@media (prefers-color-scheme: dark) {
  :root { --canvas: #0d1422; --surface: #151f30; --surface-soft: #192538; --ink: #edf2fa; --muted: #9dacc1; --border: #2b3a50; --accent: #7095ff; --accent-strong: #9ab4ff; --yours: #1d2b45; --sidebar: #0a101c; --shadow: 0 18px 45px rgba(0,0,0,.2); }
  /* The chart palette is lightened here: the light-theme hues sit too close to the dark canvas to stay legible as shapes. */
  :root { --cyan: #4cc9e2; --violet: #ad8bf0; --amber: #f2b552; --good: #48c98d; --danger: #f2788a; }
}
@media (max-width: 64rem) {
  .app-shell { grid-template-columns: 1fr; }
  .sidebar { position: fixed; z-index: 50; inset: 0 auto 0 0; inline-size: min(18rem, 86vw); transform: translateX(-105%); box-shadow: 1rem 0 3rem rgba(0,0,0,.3); transition: transform .22s ease; }
  body.menu-open .sidebar { transform: translateX(0); }
  .menu-toggle { display: inline-grid; place-items: center; inline-size: 2.7rem; block-size: 2.7rem; margin: 0; padding: 0; }
  .topbar { position: sticky; z-index: 40; inset-block-start: 0; }
}
@media (max-width: 44rem) {
  main { padding: .75rem; }
  .topbar { padding: .8rem; }
  .topbar-state { display: none; }
  .dashboard-hero { align-items: stretch; flex-direction: column; gap: .5rem; }
  .chart-grid, .system-grid { grid-template-columns: 1fr; }
  .setting-card { grid-template-columns: 1fr; }
  .filter-chip button { width: auto; }
  .setting-value { justify-self: start; }
  button { width: 100%; }
}
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { scroll-behavior: auto !important; transition: none !important; animation: none !important; } }
`;
