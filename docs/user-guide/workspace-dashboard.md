# Workspace dashboard

The GUI homepage opens with a read-only graphical overview of the local
workspace. It is designed to answer “what needs attention?” before you enter a
specific workflow.

The dashboard shows:

- registered projects, clean Git snapshots, and projects with uncommitted
  changes at their last inspection;
- Work Items grouped by lifecycle state;
- active-memory verification within the displayed bounded sample;
- privacy-preflight audit decisions;
- explicit model-delivery unavailability.

Every card uses an authoritative local store. The dashboard is calculated on
demand and is not persisted as a second source of truth. It sends no telemetry
and makes no model or network request.

## Read the bars and totals

Bars are visual summaries only. The same values are always printed as text, so
color or graphics are not required to understand the state.

- Project attention is the proportion of registered projects whose last Git
  inspection recorded a dirty worktree.
- Work Item attention combines active and blocked items; the text lists every
  lifecycle count.
- Memory verification compares verified items with the bounded memory sample.
- Privacy attention shows blocked decisions within the displayed audit window.

The coverage line states how many projects were readable and the fixed
per-project limits. A card that cannot read its authoritative store is not
silently treated as zero.

## Limitations

The dashboard does not claim complete PII detection, provider availability,
model completion, or state outside AI Workspace. Model delivery remains
explicitly unavailable until its separately approved boundaries and complete
GUI workflow exist.

No charting service or remote asset is used. The visuals use repository-native
HTML, CSS, and local SVG-compatible primitives under the existing restrictive
content security policy.
