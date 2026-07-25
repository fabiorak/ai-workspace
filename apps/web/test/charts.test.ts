import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  arcPath,
  chartTotal,
  donutSvg,
  escapeMarkup,
  meterSvg,
  percentage,
  polarPoint,
  stackedBarSvg,
} from "../src/charts.ts";

describe("chart geometry", () => {
  it("starts at the top and turns clockwise", () => {
    assert.deepEqual(polarPoint(60, 46, 0), { x: 60, y: 14 });
    assert.deepEqual(polarPoint(60, 46, 0.25), { x: 106, y: 60 });
    assert.deepEqual(polarPoint(60, 46, 0.5), { x: 60, y: 106 });
    assert.deepEqual(polarPoint(60, 46, 0.75), { x: 14, y: 60 });
  });

  it("produces the same path for the same input", () => {
    assert.equal(arcPath(60, 46, 0, 0.25), arcPath(60, 46, 0, 0.25));
    assert.equal(arcPath(60, 46, 0, 0.25), "M 60 14 A 46 46 0 0 1 106 60");
  });

  it("marks an arc longer than half a turn as a large arc", () => {
    assert.match(arcPath(60, 46, 0, 0.4), /A 46 46 0 0 1/);
    assert.match(arcPath(60, 46, 0, 0.6), /A 46 46 0 1 1/);
  });

  it("treats a zero total, a negative value and a non-finite value as no progress", () => {
    assert.equal(percentage(3, 0), 0);
    assert.equal(percentage(-3, 10), 0);
    assert.equal(percentage(Number.NaN, 10), 0);
    assert.equal(percentage(Number.POSITIVE_INFINITY, 10), 0);
  });

  it("clamps a value above its total to a full chart", () => {
    assert.equal(percentage(11, 10), 100);
  });

  it("sums only usable segment values", () => {
    assert.equal(
      chartTotal([
        { label: "a", value: 4, tone: "good" },
        { label: "b", value: -2, tone: "blocked" },
        { label: "c", value: Number.NaN, tone: "neutral" },
      ]),
      4,
    );
  });
});

describe("donut chart", () => {
  const segments = [
    { label: "Clean", value: 3, tone: "good" as const },
    { label: "Needs attention", value: 1, tone: "attention" as const },
  ];

  it("announces itself with a title and a description instead of hiding", () => {
    const svg = donutSvg({
      idPrefix: "chart-projects",
      title: "Projects",
      description: "3 clean of 4",
      segments,
      emptyDescription: "No project yet",
    });
    assert.match(svg, /role="img"/);
    assert.match(
      svg,
      /aria-labelledby="chart-projects-title chart-projects-desc"/,
    );
    assert.match(svg, /<title id="chart-projects-title">Projects<\/title>/);
    assert.match(svg, /<desc id="chart-projects-desc">3 clean of 4<\/desc>/);
    assert.ok(!svg.includes("aria-hidden"));
    assert.ok(!svg.includes("<text"));
  });

  it("draws one arc per positive segment", () => {
    const svg = donutSvg({
      idPrefix: "chart-projects",
      title: "Projects",
      description: "3 clean of 4",
      segments,
      emptyDescription: "No project yet",
    });
    assert.equal(svg.match(/class="chart-arc/g)?.length, 2);
    assert.match(svg, /chart-tone-good/);
    assert.match(svg, /chart-tone-attention/);
  });

  it("draws only the track and the empty description when every segment is zero", () => {
    const svg = donutSvg({
      idPrefix: "chart-projects",
      title: "Projects",
      description: "3 clean of 4",
      segments: [
        { label: "Clean", value: 0, tone: "good" },
        { label: "Needs attention", value: 0, tone: "attention" },
      ],
      emptyDescription: "No project yet",
    });
    assert.ok(!svg.includes("chart-arc"));
    assert.match(svg, /class="chart chart-donut chart-empty"/);
    assert.match(svg, /<desc id="chart-projects-desc">No project yet<\/desc>/);
  });

  it("keeps a single full segment drawable as an arc", () => {
    const svg = donutSvg({
      idPrefix: "chart-projects",
      title: "Projects",
      description: "4 clean of 4",
      segments: [
        { label: "Clean", value: 4, tone: "good" },
        { label: "Needs attention", value: 0, tone: "attention" },
      ],
      emptyDescription: "No project yet",
    });
    assert.equal(svg.match(/class="chart-arc/g)?.length, 1);
    // A 100% arc that ended exactly where it started would render as nothing.
    assert.ok(!svg.includes('d="M 60 14 A 46 46 0 1 1 60 14"'));
    assert.match(svg, /A 46 46 0 1 1/);
  });

  it("escapes a label instead of letting it close an attribute", () => {
    const svg = donutSvg({
      idPrefix: "chart-projects",
      title: 'Projects "&" <more>',
      description: "3 clean of 4",
      segments: [{ label: '" onload="x', value: 1, tone: "good" }],
      emptyDescription: "No project yet",
    });
    assert.ok(!svg.includes('onload="x'));
    assert.match(svg, /&quot; onload=&quot;x/);
    assert.match(svg, /Projects &quot;&amp;&quot; &lt;more&gt;/);
  });
});

describe("stacked bar chart", () => {
  it("fills the whole track when there is data", () => {
    const svg = stackedBarSvg({
      idPrefix: "chart-work",
      title: "Work items",
      description: "2 proposed, 1 blocked",
      segments: [
        { label: "Proposed", value: 2, tone: "proposed" },
        { label: "Blocked", value: 1, tone: "blocked" },
      ],
      emptyDescription: "No work item yet",
    });
    const widths = [
      ...svg.matchAll(/class="chart-slice[^"]*"[^>]*width="([\d.]+)"/g),
    ].map((match) => Number(match[1]));
    assert.equal(widths.length, 2);
    assert.equal(
      widths.reduce((total, width) => total + width, 0),
      100,
    );
  });

  it("renders no slice for a zero total", () => {
    const svg = stackedBarSvg({
      idPrefix: "chart-work",
      title: "Work items",
      description: "2 proposed, 1 blocked",
      segments: [{ label: "Proposed", value: 0, tone: "proposed" }],
      emptyDescription: "No work item yet",
    });
    assert.ok(!svg.includes("chart-slice"));
    assert.match(svg, /chart-empty/);
    assert.match(svg, /No work item yet/);
  });

  it("ignores a negative segment rather than drawing backwards", () => {
    const svg = stackedBarSvg({
      idPrefix: "chart-work",
      title: "Work items",
      description: "1 proposed",
      segments: [
        { label: "Proposed", value: 1, tone: "proposed" },
        { label: "Blocked", value: -5, tone: "blocked" },
      ],
      emptyDescription: "No work item yet",
    });
    assert.equal(svg.match(/class="chart-slice/g)?.length, 1);
    assert.ok(!svg.includes('width="-'));
  });
});

describe("meter chart", () => {
  it("fills nothing at 0% and the whole track at 100%", () => {
    const empty = meterSvg({
      idPrefix: "chart-memory",
      title: "Memory",
      description: "0 of 4 verified",
      value: 0,
      total: 4,
      tone: "good",
      emptyDescription: "No memory yet",
    });
    assert.ok(!empty.includes("chart-slice"));
    const full = meterSvg({
      idPrefix: "chart-memory",
      title: "Memory",
      description: "4 of 4 verified",
      value: 4,
      total: 4,
      tone: "good",
      emptyDescription: "No memory yet",
    });
    assert.match(
      full,
      /class="chart-slice chart-tone-good" x="0" y="0" width="100"/,
    );
  });

  it("uses the empty description when there is no total", () => {
    const svg = meterSvg({
      idPrefix: "chart-memory",
      title: "Memory",
      description: "0 of 0 verified",
      value: 0,
      total: 0,
      tone: "good",
      emptyDescription: "No memory yet",
    });
    assert.match(svg, /chart-empty/);
    assert.match(svg, /No memory yet/);
  });
});

describe("markup escaping", () => {
  it("neutralizes every character that could break out of markup", () => {
    assert.equal(
      escapeMarkup(`<a href="x" title='y'>&</a>`),
      "&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;",
    );
  });
});
