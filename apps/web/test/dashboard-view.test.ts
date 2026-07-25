import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { GuiDashboard } from "../src/application.ts";
import {
  coverageText,
  dashboardFocus,
  dashboardFragmentHtml,
  totalWorkItems,
} from "../src/dashboard-view.ts";
import { formatGuiDateTime, formatGuiNumber } from "../src/localization.ts";

function dashboard(overrides: Partial<GuiDashboard> = {}): GuiDashboard {
  return {
    schemaVersion: 1,
    asOf: "2026-07-25T09:30:00.000Z",
    projects: { total: 4, clean: 4, attention: 0 },
    general: { conversations: 0, questions: 0 },
    memory: {
      active: 6,
      verified: 6,
      unverified: 0,
      sampled: 6,
      truncated: false,
    },
    workItems: { proposed: 1, active: 2, blocked: 0, completed: 3 },
    privacy: { reviewable: 2, blocked: 1, total: 3 },
    coverage: {
      availableProjects: 4,
      unavailableProjects: 0,
      memoryLimitPerProject: 100,
      privacyLimitPerProject: 100,
    },
    modelDelivery: {
      status: "UNAVAILABLE",
      reason: "NO_PROVIDER_DELIVERY_SURFACE",
    },
    effect: "READ_ONLY_LOCAL_AGGREGATE_NO_TELEMETRY_OR_MODEL_ACCESS",
    ...overrides,
  };
}

describe("dashboard focus", () => {
  it("asks for a first project before anything else", () => {
    const focus = dashboardFocus(
      dashboard({ projects: { total: 0, clean: 0, attention: 0 } }),
    );
    assert.equal(focus.priority, "FIRST_RUN");
    assert.equal(focus.href, "#/projects");
  });

  it("puts blocked work ahead of every other signal", () => {
    const focus = dashboardFocus(
      dashboard({
        projects: { total: 4, clean: 1, attention: 3 },
        memory: {
          active: 6,
          verified: 1,
          unverified: 5,
          sampled: 6,
          truncated: false,
        },
        workItems: { proposed: 1, active: 2, blocked: 2, completed: 3 },
      }),
    );
    assert.equal(focus.priority, "BLOCKED_WORK");
    assert.equal(focus.href, "#/work?state=BLOCKED");
    assert.deepEqual(focus.bodyCounts, { count: 2, total: 8 });
  });

  it("falls back to uncommitted repository changes when nothing is blocked", () => {
    const focus = dashboardFocus(
      dashboard({
        projects: { total: 4, clean: 1, attention: 3 },
        memory: {
          active: 6,
          verified: 1,
          unverified: 5,
          sampled: 6,
          truncated: false,
        },
      }),
    );
    assert.equal(focus.priority, "PROJECT_ATTENTION");
    assert.equal(focus.href, "#/projects?filter=attention");
    assert.deepEqual(focus.bodyCounts, { count: 3, total: 4 });
  });

  it("falls back to unverified memory when the repositories are clean", () => {
    const focus = dashboardFocus(
      dashboard({
        memory: {
          active: 6,
          verified: 1,
          unverified: 5,
          sampled: 6,
          truncated: false,
        },
      }),
    );
    assert.equal(focus.priority, "UNVERIFIED_MEMORY");
    assert.equal(focus.href, "#/memory");
    assert.deepEqual(focus.bodyCounts, { count: 5, total: 6 });
  });

  it("says so plainly when nothing needs attention", () => {
    const focus = dashboardFocus(dashboard());
    assert.equal(focus.priority, "CLEAR");
    assert.equal(focus.tone, "good");
  });

  it("sums the four Work Item states", () => {
    assert.equal(totalWorkItems(dashboard()), 6);
  });
});

describe("dashboard fragment", () => {
  it("renders one accessible chart per measure with no decorative chart", () => {
    const html = dashboardFragmentHtml(dashboard(), "en");
    assert.equal(html.match(/role="img"/g)?.length, 4);
    for (const id of [
      "chart-projects",
      "chart-work",
      "chart-memory",
      "chart-privacy",
    ]) {
      assert.ok(html.includes(`<title id="${id}-title">`), id);
      assert.ok(html.includes(`<desc id="${id}-desc">`), id);
    }
    assert.ok(!html.includes('class="chart chart-donut" aria-hidden'));
    assert.ok(!html.includes("<text"));
  });

  it("gives every chart a textual equivalent in the legend and the table", () => {
    const html = dashboardFragmentHtml(dashboard(), "en");
    assert.match(html, /<ul class="chart-legend">/);
    assert.equal(html.match(/class="chart-legend-label"/g)?.length, 10);
    assert.match(html, /<details class="chart-table">/);
    assert.match(html, /<summary>Show the same numbers as a table<\/summary>/);
    // Ten legend entries means ten table rows: nothing visual is table-only.
    assert.equal(html.match(/<tr>/g)?.length, 11);
  });

  it("marks the focus card with its priority and links where it promises", () => {
    const blocked = dashboardFragmentHtml(
      dashboard({
        workItems: { proposed: 1, active: 2, blocked: 2, completed: 3 },
      }),
      "en",
    );
    assert.match(blocked, /data-focus="BLOCKED_WORK"/);
    assert.match(blocked, /href="#\/work\?state=BLOCKED"/);
  });

  it("offers a filtered link only when the filter would match something", () => {
    const clean = dashboardFragmentHtml(dashboard(), "en");
    assert.ok(!clean.includes("#/projects?filter=attention"));
    assert.ok(!clean.includes("#/work?state=BLOCKED"));
    assert.match(clean, /href="#\/projects"/);
    const dirty = dashboardFragmentHtml(
      dashboard({ projects: { total: 4, clean: 1, attention: 3 } }),
      "en",
    );
    assert.match(dirty, /href="#\/projects\?filter=attention"/);
  });

  it("warns that a truncated memory chart describes only the sample", () => {
    const html = dashboardFragmentHtml(
      dashboard({
        memory: {
          active: 320,
          verified: 90,
          unverified: 10,
          sampled: 100,
          truncated: true,
        },
      }),
      "en",
    );
    assert.match(html, /class="notice">The sample is bounded: 100 of 320/);
    const complete = dashboardFragmentHtml(dashboard(), "en");
    assert.ok(!complete.includes("The sample is bounded"));
  });

  it("localizes labels and numbers instead of formatting them once for English", () => {
    const italian = dashboardFragmentHtml(
      dashboard({
        projects: { total: 12000, clean: 12000, attention: 0 },
        coverage: {
          availableProjects: 12000,
          unavailableProjects: 0,
          memoryLimitPerProject: 100,
          privacyLimitPerProject: 100,
        },
      }),
      "it",
    );
    assert.match(italian, /Cosa fare adesso/);
    assert.match(italian, /Richiede attenzione/);
    assert.match(italian, /<strong>12\.000<\/strong>/);
    assert.ok(!italian.includes("<strong>12,000</strong>"));
  });

  it("escapes the markup it produces even though every value is a number", () => {
    const html = dashboardFragmentHtml(dashboard(), "it");
    // Italian copy contains apostrophes, which must not survive raw in markup.
    assert.ok(!/l'audit/u.test(html));
    assert.match(html, /&#39;/u);
  });

  it("states coverage with a localized timestamp", () => {
    const value = coverageText(dashboard(), "it");
    assert.match(value, /^Copertura: 4 progetti disponibili su 4;/u);
    assert.ok(
      value.includes(formatGuiDateTime("it", "2026-07-25T09:30:00.000Z")),
    );
    assert.ok(!value.includes("2026-07-25T09:30:00.000Z"));
  });
});

describe("locale-aware formatting", () => {
  it("groups thousands the way each language does", () => {
    assert.equal(formatGuiNumber("en", 12000), "12,000");
    // Italian groups from five digits up, so a four-digit count stays ungrouped.
    assert.equal(formatGuiNumber("it", 12000), "12.000");
    assert.equal(formatGuiNumber("it", 1200), "1200");
  });

  it("does not print a non-finite count as a number", () => {
    assert.equal(formatGuiNumber("en", Number.NaN), "—");
  });

  it("returns an unparsable timestamp verbatim", () => {
    assert.equal(formatGuiDateTime("en", "not a timestamp"), "not a timestamp");
  });

  it("renders a stored timestamp as local text rather than as ISO", () => {
    const value = formatGuiDateTime("en", "2026-07-25T09:30:00.000Z");
    assert.notEqual(value, "2026-07-25T09:30:00.000Z");
    assert.match(value, /2026/u);
  });
});
