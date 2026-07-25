/**
 * Pure SVG chart generators for the local GUI.
 *
 * The GUI ships no runtime dependency and executes no remote code, so charts are
 * strings produced here and inserted as markup. Every generator is a pure
 * function of numbers plus already-localized labels: no locale logic, no clock,
 * no randomness, so the output of a given input is stable and testable.
 *
 * Two rules hold everywhere in this module. A chart is never decorative: it
 * carries `role="img"` with a title and a description, so it is announced rather
 * than hidden. And a chart never contains text: Italian labels run 15-25% longer
 * than English ones, and text inside a fixed viewBox cannot reflow, so labels
 * live in the surrounding HTML where the browser can wrap them.
 */

/** Semantic tone of a segment. Mapped to a CSS custom property, never to a literal colour. */
export type ChartTone =
  "neutral" | "good" | "attention" | "blocked" | "active" | "proposed" | "info";

export type ChartSegment = Readonly<{
  label: string;
  value: number;
  tone: ChartTone;
}>;

export type ChartPoint = Readonly<{ x: number; y: number }>;

const DONUT_SIZE = 120;
const DONUT_CENTRE = DONUT_SIZE / 2;
const DONUT_RADIUS = 46;
const DONUT_STROKE = 18;
const BAR_WIDTH = 100;
const BAR_HEIGHT = 12;
const BAR_RADIUS = 6;
/** A full circle drawn as a single arc is degenerate, so the last hair of it is left out. */
const FULL_TURN_EPSILON = 0.0005;

/**
 * Point on a circle for a fraction of a turn, measured clockwise from the top.
 *
 * Zero is 12 o'clock rather than the mathematical 3 o'clock because a reader
 * expects a donut to start at the top.
 */
export function polarPoint(
  centre: number,
  radius: number,
  fraction: number,
): ChartPoint {
  const angle = 2 * Math.PI * fraction;
  return {
    x: round(centre + radius * Math.sin(angle)),
    y: round(centre - radius * Math.cos(angle)),
  };
}

/** Arc path from one fraction of a turn to another, clockwise. */
export function arcPath(
  centre: number,
  radius: number,
  startFraction: number,
  endFraction: number,
): string {
  const start = polarPoint(centre, radius, startFraction);
  const end = polarPoint(centre, radius, endFraction);
  const largeArc = endFraction - startFraction > 0.5 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

/** Whole percentage of a total, clamped to 0-100. A zero total is 0%, not a division by zero. */
export function percentage(value: number, total: number): number {
  const safeValue = safeNumber(value);
  const safeTotal = safeNumber(total);
  if (safeTotal <= 0) {
    return 0;
  }
  return Math.min(100, Math.round((safeValue / safeTotal) * 100));
}

/** Sum of the segment values, with unusable values counted as zero. */
export function chartTotal(segments: readonly ChartSegment[]): number {
  return segments.reduce(
    (total, segment) => total + safeNumber(segment.value),
    0,
  );
}

export type DonutOptions = Readonly<{
  /** Stable prefix for the generated element ids; must be unique within the page. */
  idPrefix: string;
  title: string;
  description: string;
  segments: readonly ChartSegment[];
  /** Description used instead of `description` when every segment is zero. */
  emptyDescription: string;
}>;

/** Donut chart: one arc per positive segment, over a full-circle track. */
export function donutSvg(options: DonutOptions): string {
  const total = chartTotal(options.segments);
  const arcs: string[] = [];
  let cursor = 0;
  for (const segment of options.segments) {
    const value = safeNumber(segment.value);
    if (total <= 0 || value <= 0) {
      continue;
    }
    const fraction = value / total;
    const end = Math.min(1 - FULL_TURN_EPSILON, cursor + fraction);
    arcs.push(
      `<path class="chart-arc chart-tone-${segment.tone}" d="${arcPath(
        DONUT_CENTRE,
        DONUT_RADIUS,
        cursor,
        end,
      )}" data-chart-label="${escapeMarkup(segment.label)}" data-chart-value="${value}" />`,
    );
    cursor += fraction;
  }
  const body = [
    `<circle class="chart-track" cx="${DONUT_CENTRE}" cy="${DONUT_CENTRE}" r="${DONUT_RADIUS}" />`,
    ...arcs,
  ].join("");
  return svgElement({
    idPrefix: options.idPrefix,
    className:
      total > 0 ? "chart chart-donut" : "chart chart-donut chart-empty",
    viewBox: `0 0 ${DONUT_SIZE} ${DONUT_SIZE}`,
    extraAttributes: `stroke-width="${DONUT_STROKE}"`,
    title: options.title,
    description: total > 0 ? options.description : options.emptyDescription,
    body,
  });
}

export type StackedBarOptions = Readonly<{
  idPrefix: string;
  title: string;
  description: string;
  segments: readonly ChartSegment[];
  emptyDescription: string;
}>;

/** Stacked bar: one rectangle per positive segment, filling a rounded track. */
export function stackedBarSvg(options: StackedBarOptions): string {
  const total = chartTotal(options.segments);
  const rectangles: string[] = [];
  let cursor = 0;
  const positive = options.segments.filter(
    (segment) => total > 0 && safeNumber(segment.value) > 0,
  );
  positive.forEach((segment, index) => {
    const value = safeNumber(segment.value);
    const width =
      index === positive.length - 1
        ? round(BAR_WIDTH - cursor)
        : round((value / total) * BAR_WIDTH);
    rectangles.push(
      `<rect class="chart-slice chart-tone-${segment.tone}" x="${round(cursor)}" y="0" width="${width}" height="${BAR_HEIGHT}" data-chart-label="${escapeMarkup(
        segment.label,
      )}" data-chart-value="${value}" />`,
    );
    cursor += width;
  });
  const body = [
    `<rect class="chart-track" x="0" y="0" width="${BAR_WIDTH}" height="${BAR_HEIGHT}" rx="${BAR_RADIUS}" />`,
    rectangles.length > 0
      ? `<g clip-path="url(#${escapeMarkup(options.idPrefix)}-clip)">${rectangles.join("")}</g>`
      : "",
    `<clipPath id="${escapeMarkup(options.idPrefix)}-clip"><rect x="0" y="0" width="${BAR_WIDTH}" height="${BAR_HEIGHT}" rx="${BAR_RADIUS}" /></clipPath>`,
  ].join("");
  return svgElement({
    idPrefix: options.idPrefix,
    className: total > 0 ? "chart chart-bar" : "chart chart-bar chart-empty",
    viewBox: `0 0 ${BAR_WIDTH} ${BAR_HEIGHT}`,
    extraAttributes: 'preserveAspectRatio="none"',
    title: options.title,
    description: total > 0 ? options.description : options.emptyDescription,
    body,
  });
}

export type MeterOptions = Readonly<{
  idPrefix: string;
  title: string;
  description: string;
  value: number;
  total: number;
  tone: ChartTone;
  emptyDescription: string;
}>;

/** Meter: one value against a total, as a proportion of a rounded track. */
export function meterSvg(options: MeterOptions): string {
  const filled = percentage(options.value, options.total);
  const body = [
    `<rect class="chart-track" x="0" y="0" width="${BAR_WIDTH}" height="${BAR_HEIGHT}" rx="${BAR_RADIUS}" />`,
    filled > 0
      ? `<rect class="chart-slice chart-tone-${options.tone}" x="0" y="0" width="${round(
          (filled / 100) * BAR_WIDTH,
        )}" height="${BAR_HEIGHT}" rx="${BAR_RADIUS}" data-chart-value="${safeNumber(
          options.value,
        )}" />`
      : "",
  ].join("");
  return svgElement({
    idPrefix: options.idPrefix,
    className:
      safeNumber(options.total) > 0
        ? "chart chart-meter"
        : "chart chart-meter chart-empty",
    viewBox: `0 0 ${BAR_WIDTH} ${BAR_HEIGHT}`,
    extraAttributes: 'preserveAspectRatio="none"',
    title: options.title,
    description:
      safeNumber(options.total) > 0
        ? options.description
        : options.emptyDescription,
    body,
  });
}

/** Escapes text for interpolation into markup, including both quote characters. */
export function escapeMarkup(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function svgElement(
  parts: Readonly<{
    idPrefix: string;
    className: string;
    viewBox: string;
    extraAttributes: string;
    title: string;
    description: string;
    body: string;
  }>,
): string {
  const prefix = escapeMarkup(parts.idPrefix);
  const titleId = `${prefix}-title`;
  const descriptionId = `${prefix}-desc`;
  return [
    `<svg class="${parts.className}" viewBox="${parts.viewBox}" role="img"`,
    ` aria-labelledby="${titleId} ${descriptionId}" focusable="false" ${parts.extraAttributes}>`,
    `<title id="${titleId}">${escapeMarkup(parts.title)}</title>`,
    `<desc id="${descriptionId}">${escapeMarkup(parts.description)}</desc>`,
    parts.body,
    "</svg>",
  ].join("");
}

/** Non-finite and negative values would break the geometry, so they count as zero. */
function safeNumber(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
