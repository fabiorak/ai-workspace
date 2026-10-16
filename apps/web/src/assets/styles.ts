/**
 * The single stylesheet served at `/app.css`.
 *
 * Colour lives in custom properties so that a rule never names a literal, which
 * is what lets the dark theme be a short override block instead of a second
 * sheet. Nothing here depends on a font, icon, or stylesheet fetched over a
 * network: the content security policy forbids it and the workspace is offline.
 */
/**
 * The dark values, named once and applied twice: when the system asks for dark
 * and the person has not chosen otherwise, and when they chose dark themselves.
 * Interpolating one constant keeps a single source for the colours.
 */
const DARK_TOKENS = `
  --canvas: #0d1422; --surface: #151f30; --surface-soft: #192538; --ink: #edf2fa; --muted: #9dacc1; --border: #2b3a50; --accent: #7095ff; --accent-strong: #9ab4ff; --yours: #1d2b45; --shadow: 0 18px 45px rgba(0,0,0,.2);
  --sidebar: #0a101c; --sidebar-ink: #f3f6fb; --sidebar-muted: #98a8c0; --sidebar-label: #71829c;
  --sidebar-hover: rgba(255,255,255,.07); --sidebar-active: rgba(255,255,255,.1); --sidebar-line: rgba(255,255,255,.16);
  --sidebar-raised: rgba(255,255,255,.05); --sidebar-glow: #20365e; --sidebar-current-ink: #fff;
  --sidebar-current-back: rgba(82,125,250,.28); --sidebar-current-rule: #6f96ff;
  /* The chart palette is lightened here: the light-theme hues sit too close to the dark canvas to stay legible as shapes. */
  --cyan: #4cc9e2; --violet: #ad8bf0; --amber: #f2b552; --good: #48c98d; --danger: #f2788a;`;

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
  --sidebar: #e9eef6;
  --sidebar-ink: #132238;
  --sidebar-muted: #4d5b73;
  --sidebar-label: #56657e;
  --sidebar-hover: rgba(19, 34, 56, .07);
  --sidebar-active: rgba(19, 34, 56, .12);
  --sidebar-line: rgba(19, 34, 56, .14);
  --sidebar-raised: rgba(255, 255, 255, .72);
  --sidebar-glow: transparent;
  --sidebar-current-ink: #1b3f9e;
  --sidebar-current-back: rgba(52, 104, 245, .14);
  --sidebar-current-rule: #3468f5;
  --shadow: 0 18px 45px rgba(33, 48, 76, .08);
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body { margin: 0; min-width: 20rem; background: var(--canvas); color: var(--ink); }
button, input, select, textarea { font: inherit; }
a { color: var(--accent-strong); }
.app-shell { min-height: 100vh; display: grid; grid-template-columns: 17.5rem minmax(0, 1fr); }
.sidebar { position: sticky; inset-block-start: 0; height: 100vh; display: flex; flex-direction: column; gap: 1.5rem; padding: 1.35rem 1rem; overflow-y: auto; color: var(--sidebar-ink); background: radial-gradient(circle at 10% 0%, var(--sidebar-glow) 0, transparent 30%), var(--sidebar); border-inline-end: 1px solid var(--sidebar-line); }
.brand { display: flex; align-items: center; gap: .75rem; padding: .3rem .5rem; color: inherit; text-decoration: none; }
.brand-mark { display: grid; place-items: center; inline-size: 2.5rem; block-size: 2.5rem; border: 1px solid rgba(255,255,255,.22); border-radius: .8rem; background: linear-gradient(135deg, #608cff, #7554e8); box-shadow: 0 9px 24px rgba(52,104,245,.3); font-size: .78rem; font-weight: 900; letter-spacing: .04em; }
.brand strong, .brand small { display: block; }
.brand strong { font-size: 1.02rem; letter-spacing: -.02em; }
.brand small { color: var(--sidebar-muted); font-size: .72rem; }
.primary-nav { display: grid; gap: .24rem; }
.primary-nav a { min-height: 2.75rem; display: grid; grid-template-columns: 1.35rem 1fr auto; align-items: center; gap: .65rem; padding: .62rem .72rem; border-radius: .72rem; color: var(--sidebar-muted); text-decoration: none; font-size: .9rem; font-weight: 650; transition: color .18s ease, background .18s ease, transform .18s ease; }
.primary-nav a:hover { color: var(--sidebar-ink); background: var(--sidebar-hover); transform: translateX(.12rem); }
.primary-nav a[aria-current="page"] { color: var(--sidebar-current-ink); background: var(--sidebar-current-back); box-shadow: inset 3px 0 var(--sidebar-current-rule); }
.primary-nav a > span:first-child { font-size: 1.05rem; text-align: center; }
.nav-label { margin: 1rem .72rem .25rem; color: var(--sidebar-label); font-size: .68rem; font-weight: 800; letter-spacing: .13em; text-transform: uppercase; }
/**
 * The conversation list. It scrolls on its own and keeps the two entries that are
 * not work — projects and settings — reachable at the bottom without scrolling
 * past the whole history to find them.
 */
.conversation-nav { min-height: 0; flex: 1 1 auto; overflow-y: auto; display: grid; align-content: start; gap: .1rem; }
.conversation-nav ul { margin: 0 0 .5rem; padding: 0; list-style: none; display: grid; gap: .1rem; }
/** A row is a button, because opening a conversation changes this page instead of leaving it. */
.conversation-nav a, .conversation-nav button { min-height: 2.75rem; display: grid; gap: .1rem; padding: .5rem .72rem; border-radius: .72rem; color: var(--sidebar-muted); text-decoration: none; width: 100%; text-align: start; background: none; border: 0; font: inherit; cursor: pointer; }
.conversation-nav a:hover, .conversation-nav button:hover { color: var(--sidebar-ink); background: var(--sidebar-hover); }
/** The open row is marked by more than colour, so the mark survives on a screen that shows none. */
.conversation-nav button[aria-current] { color: var(--sidebar-ink); background: var(--sidebar-active); box-shadow: inset .18rem 0 0 currentColor; }
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
.conversation-signal { color: var(--sidebar-ink); border-inline-start: .18rem solid #f0a500; padding-inline-start: .45rem; font-size: .7rem; line-height: 1.35; }
.conversation-nav .help { margin: .2rem .72rem; color: var(--sidebar-muted); font-size: .68rem; }
.conversation-nav .inline-status { margin: .2rem .72rem; color: var(--sidebar-muted); font-size: .72rem; }
.new-conversation, .conversation-search-link { min-height: 2.65rem; width: 100%; display: flex; align-items: center; gap: .55rem; padding: .58rem .72rem; border: 1px solid var(--sidebar-line); border-radius: .72rem; color: var(--sidebar-ink); background: var(--sidebar-raised); text-decoration: none; font-weight: 720; }
.new-conversation:hover, .conversation-search-link:hover { background: var(--sidebar-active); }
.conversation-search-link { border-color: transparent; color: var(--sidebar-muted); background: transparent; }
.technical-nav { display: grid; gap: .3rem; max-width: 32rem; }
.nav-label:first-child { margin-block-start: 0; }
.nav-badge { padding: .12rem .4rem; border: 1px solid var(--sidebar-line); border-radius: 999px; font-size: .62rem; font-weight: 800; text-transform: uppercase; }
.locality-card { margin-block-start: auto; display: flex; align-items: center; gap: .7rem; padding: .85rem; border: 1px solid var(--sidebar-line); border-radius: .8rem; background: var(--sidebar-raised); }
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
.conversation-page { position: relative; min-height: calc(100vh - 9.5rem); padding: 0; overflow: hidden; }
.conversation-empty { max-width: 42rem; margin: auto; padding: clamp(2rem, 8vw, 6rem) clamp(1rem, 4vw, 3rem); text-align: center; }
.conversation-opening { margin: 0; padding: .5rem 1.5rem; }
.conversation-opening:empty { display: none; }
.conversation-workspace { min-height: calc(100vh - 9.5rem); display: flex; flex-direction: column; }
.conversation-header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1rem clamp(1rem, 3vw, 2rem); border-block-end: 1px solid var(--border); }
.conversation-header h2, .conversation-project { margin: 0; }
.conversation-header h2 { font-size: 1.15rem; letter-spacing: -.02em; }
.conversation-project { color: var(--muted); font-size: .75rem; }
.conversation-actions, .composer-actions { display: flex; align-items: center; gap: .5rem; flex-wrap: wrap; }
/* A flex item shrinks below its content, and a select that shrinks all the way
   is a pair of arrows with the model name gone. It keeps a readable floor and
   truncates instead, which is what zooming to 200% used to break. */
.conversation-actions select, .conversation-actions button { width: auto; margin: 0; }
.conversation-actions select { min-width: 10rem; max-width: 100%; text-overflow: ellipsis; }
.conversation-feed { min-height: 12rem; flex: 1 1 20rem; overflow-y: auto; overscroll-behavior: contain; padding: 1.5rem clamp(1rem, 5vw, 4rem); list-style: none; }
.conversation-feed > .moment { width: min(100%, 46rem); margin-inline: auto; padding-block: .55rem; }
.conversation-feed > .moment-yours { width: min(calc(100% - 2rem), 38rem); margin-inline-end: max(0rem, calc((100% - 46rem) / 2)); padding: .8rem 1rem; border-inline-start: 0; border-radius: .8rem; }
.conversation-feed .card-kicker { color: var(--muted); letter-spacing: .04em; text-transform: none; }
.technical-activity { width: min(100%, 46rem); margin: .4rem auto; color: var(--muted); }
.technical-activity summary { cursor: pointer; font-size: .8rem; font-weight: 720; }
.technical-activity-list { margin-block-start: .6rem; padding-inline-start: 1.5rem; }
.conversation-count { margin: 0; padding-inline: clamp(1rem, 5vw, 4rem); text-align: center; }
.conversation-composer { position: sticky; inset-block-end: 0; z-index: 2; margin: 0; padding: .7rem clamp(1rem, 3vw, 2rem) 1rem; border: 0; background: linear-gradient(transparent, var(--surface) 20%); }
.composer-box { width: min(100%, 48rem); margin-inline: auto; padding: .7rem; border: 1px solid var(--accent); border-radius: .9rem; background: var(--surface); box-shadow: 0 .5rem 1.5rem rgba(20,40,80,.08); }
.composer-box textarea { width: 100%; min-height: 4rem; margin: 0; padding: .35rem; border: 0; background: transparent; resize: vertical; }
.composer-box textarea:focus { outline: 0; }
.composer-actions { justify-content: space-between; }
.composer-actions button { width: auto; margin: 0; }
/* Reads as a button on its own, and keeps its own hover: the shared button:hover
   repaints the background with the accent, which left this muted label nearly
   invisible on it, and unreadable in the dark theme. */
.panel-button { border: 1px solid var(--border); background: var(--surface); color: var(--ink); font-weight: 700; }
.panel-button:hover { border-color: color-mix(in srgb, var(--accent) 40%, var(--border)); background: var(--surface-soft); color: var(--ink); }
.panel-button[aria-expanded="true"] { border-color: color-mix(in srgb, var(--accent) 45%, var(--border)); background: color-mix(in srgb, var(--accent) 10%, var(--surface)); color: var(--ink); }
.send-button { background: var(--accent); color: #fff; }
.send-button:hover { background: var(--accent-strong); }
.send-button:disabled { opacity: .45; cursor: default; }
.composer-status { min-height: 1.25rem; margin: .35rem auto 0; width: min(100%, 48rem); font-size: .72rem; }
.conversation-panel { position: absolute; z-index: 5; inset: 0 0 0 auto; width: min(24rem, 100%); padding: 1.25rem; overflow-y: auto; border-inline-start: 1px solid var(--border); background: var(--surface); box-shadow: -.8rem 0 2rem rgba(20,35,60,.12); }
.conversation-panel-header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.conversation-panel-header h3 { margin: 0; }
.conversation-panel-header button { width: auto; margin: 0; font-size: 1.35rem; }
.protection-term { display: grid; gap: .35rem; margin-block-start: 1.25rem; padding-block-start: 1rem; border-block-start: 1px solid var(--border); }
.protection-term label { font-size: .82rem; color: var(--muted); }
.protection-term input, .protection-term select { width: 100%; margin: 0; }
.protection-term .protection-term-add { width: auto; justify-self: start; margin-block-start: .35rem; }
.protection-term-status:empty { display: none; }
.protection-term-status { margin: 0; font-size: .82rem; color: var(--muted); }
.protection-preview { display: grid; gap: .55rem; margin-block: 1rem; padding: .8rem; border: 1px solid var(--border); border-radius: .7rem; background: var(--surface-soft); }
.composer-protection-preview { width: min(100%, 48rem); margin: .6rem auto 0; }
.protection-preview p { margin: 0; font-size: .82rem; }
.protection-preview button { width: auto; justify-self: start; margin: 0; }
.protection-preview-output { white-space: pre-wrap; overflow-wrap: anywhere; }
.protection-preview-output:empty { display: none; }
.protection-preview-output mark { padding: .08rem .22rem; border-radius: .25rem; background: color-mix(in srgb, var(--amber) 30%, var(--surface)); color: var(--ink); font-weight: 760; }
.protection-preview-sections { display: grid; gap: .4rem; }
.protection-preview-sections:empty { display: none; }
.protection-preview-section { border: 1px solid var(--border); border-radius: .5rem; background: var(--surface); }
.protection-preview-section > summary { padding: .4rem .55rem; cursor: pointer; font-size: .82rem; font-weight: 640; }
.protection-preview-section > summary:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }
.protection-preview-section-count { color: var(--muted); font-weight: 400; }
.protection-preview-section .protection-preview-output { max-block-size: 22rem; overflow: auto; padding: 0 .55rem .55rem; }
.legacy-continuation[hidden] { display: none; }
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
   matched with explicit priority at the end of the sheet, so hiding something
   means it is hidden whatever else it is. */
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
.model-target-settings { margin-block-start: 1.5rem; padding-block-start: 1.5rem; border-block-start: 1px solid var(--border); }
.model-target-settings form { display: grid; grid-template-columns: minmax(10rem, 14rem) minmax(0, 1fr); gap: .65rem 1rem; align-items: center; margin-block: 1rem; }
.model-target-settings form button { grid-column: 2; justify-self: start; width: auto; }
.model-target-settings form .form-fields { display: contents; }
.model-target-settings form .form-wide { grid-column: 1 / -1; margin: 0; }
.model-target-row { display: flex; flex-wrap: wrap; gap: .75rem 1rem; align-items: center; }
.model-target-row > div { flex: 1 1 14rem; }
.model-target-row { margin-block: .5rem; }
.model-target-row h4 { margin: 0; }
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
/* The system decides unless the person chose, and their choice narrows
   color-scheme too, so native controls follow the page instead of the desktop. */
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { ${DARK_TOKENS} } }
:root[data-theme="dark"] { ${DARK_TOKENS} color-scheme: dark; }
:root[data-theme="light"] { color-scheme: light; }
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
  .model-target-settings form { grid-template-columns: 1fr; }
  .model-target-settings form button { grid-column: 1; }
  button { width: 100%; }
  .conversation-page, .conversation-workspace { min-height: calc(100vh - 7rem); }
  .conversation-header { align-items: flex-start; flex-direction: column; }
  .conversation-actions { width: 100%; }
  .conversation-actions select { flex: 1 1 12rem; min-width: 10rem; }
  .conversation-actions button, .composer-actions button { width: auto; }
  .conversation-feed { padding: 1rem; }
  .conversation-feed > .moment-yours { width: calc(100% - 1rem); margin-inline-end: 0; margin-inline-start: 1rem; }
  .conversation-composer { padding-inline: .65rem; }
}
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { scroll-behavior: auto !important; transition: none !important; animation: none !important; } }
[hidden] { display: none !important; }
`;
