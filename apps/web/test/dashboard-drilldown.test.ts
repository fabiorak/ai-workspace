import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { GuiDashboard } from "../src/application.ts";
import { APP_JS } from "../src/assets.ts";
import { dashboardFragmentHtml } from "../src/dashboard-view.ts";

/**
 * A drill-down is only real if the link the chart offers and the parser the browser runs
 * agree. The client is shipped as one string, so the route parser is lifted out of that
 * exact string and executed here: a rename or a regression in the shipped code makes this
 * test fail rather than pass against a copy that nobody serves.
 */
function shippedRoute(hash: string): {
  page: string;
  parameters: URLSearchParams;
} {
  const sections =
    /const pageSections = Object\.freeze\(\{[\s\S]*?\n {2}\}\);/u.exec(APP_JS);
  const parser = /const currentRoute = \(\) => \{[\s\S]*?\n {2}\};/u.exec(
    APP_JS,
  );
  assert.ok(sections, "the client must still declare pageSections");
  assert.ok(parser, "the client must still declare currentRoute");
  const run = new Function(
    "location",
    `${sections[0]}\n${parser[0]}\nreturn currentRoute();`,
  ) as (location: { hash: string }) => {
    page: string;
    parameters: URLSearchParams;
  };
  return run({ hash });
}

function dashboard(): GuiDashboard {
  return {
    schemaVersion: 1,
    asOf: "2026-07-25T09:30:00.000Z",
    projects: { total: 4, clean: 1, attention: 3 },
    general: { conversations: 0, questions: 0 },
    memory: {
      active: 6,
      verified: 6,
      unverified: 0,
      sampled: 6,
      truncated: false,
    },
    workItems: { proposed: 1, active: 2, blocked: 2, completed: 3 },
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
  };
}

describe("dashboard drill-down", () => {
  it("resolves every filtered link the fragment offers to a real page and filter", () => {
    const html = dashboardFragmentHtml(dashboard(), "en");
    const hrefs = [...html.matchAll(/href="(#\/[^"]+)"/gu)].map(
      (match) => match[1]!,
    );
    assert.ok(
      hrefs.includes("#/projects?filter=attention"),
      "three projects need attention, so the projects drill-down must be offered",
    );
    assert.ok(
      hrefs.includes("#/work?state=BLOCKED"),
      "two Work Items are blocked, so the blocked drill-down must be offered",
    );
    for (const href of hrefs) {
      const route = shippedRoute(href);
      assert.notEqual(
        href.slice(2).split(/[?/]/u)[0],
        "",
        `${href} must name a page`,
      );
      assert.equal(
        route.page,
        href.slice(2).split(/[?/]/u)[0],
        `${href} must open its own page, not the dashboard fallback`,
      );
    }
    assert.equal(
      shippedRoute("#/projects?filter=attention").parameters.get("filter"),
      "attention",
    );
    assert.equal(
      shippedRoute("#/work?state=BLOCKED").parameters.get("state"),
      "BLOCKED",
    );
  });

  it("keeps the query out of the page name and falls back on an unknown page", () => {
    assert.equal(shippedRoute("#/work?state=BLOCKED").page, "work");
    assert.equal(shippedRoute("#/nowhere?state=BLOCKED").page, "dashboard");
    assert.equal(shippedRoute("").page, "dashboard");
    assert.equal(shippedRoute("#/projects").parameters.get("filter"), null);
  });

  it("applies the filter to the data the destination page already holds", () => {
    // The counted subsets are dirty projects and Work Items in one status; the client must
    // filter on exactly those fields, or the destination would show a different number
    // from the chart the user clicked.
    assert.match(
      APP_JS,
      /projects\.filter\(\(project\) => project\.isDirty\)/u,
    );
    assert.match(
      APP_JS,
      /workItems\.filter\(\(item\) => item\.status === filter\)/u,
    );
    assert.match(APP_JS, /say\(status, "noMatchingProjects"\)/u);
    assert.match(APP_JS, /say\(.*, "noMatchingWork"\)/u);
    assert.match(APP_JS, /say\(clear, "filterClear"\)/u);
  });

  it("ignores a status the Work Item lifecycle does not define", () => {
    assert.match(
      APP_JS,
      /WORK_STATES = new Set\(\["PROPOSED", "ACTIVE", "BLOCKED", "COMPLETED"\]\)/u,
    );
    assert.match(APP_JS, /WORK_STATES\.has\(state\)/u);
  });
});
