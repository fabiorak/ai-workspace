/**
 * Composes the dashboard presentation fragment from a read-only aggregate.
 *
 * The fragment is built here, on the server, and delivered by a presentation
 * endpoint so that the client never has to assemble markup from data. It is a
 * pure function of the aggregate plus the locale: no store access, no clock, no
 * user input, so nothing untrusted can reach the markup.
 *
 * Two things carry the meaning. `dashboardFocus` answers "what should I do now"
 * with a deterministic priority order rather than leaving four equal cards to
 * the reader. And every chart is followed by a legend and a full table, so the
 * numbers are readable without seeing colour or shape.
 */
import type { GuiDashboard } from "./application.ts";
import {
  chartTotal,
  donutSvg,
  escapeMarkup,
  percentage,
  stackedBarSvg,
  type ChartSegment,
  type ChartTone,
} from "./charts.ts";
import {
  formatGuiDateTime,
  formatGuiNumber,
  guiMessage,
  type GuiLocale,
  type GuiMessageKey,
} from "./localization.ts";

export type DashboardFocusPriority =
  | "FIRST_RUN"
  | "BLOCKED_WORK"
  | "PROJECT_ATTENTION"
  | "UNVERIFIED_MEMORY"
  | "CLEAR";

export type DashboardFocus = Readonly<{
  priority: DashboardFocusPriority;
  tone: ChartTone;
  titleKey: GuiMessageKey;
  bodyKey: GuiMessageKey;
  /** Raw counts for the body template; the renderer localizes them. */
  bodyCounts: Readonly<Record<string, number>>;
  actionKey: GuiMessageKey;
  /** Hash route the action opens, already carrying the filter it promises. */
  href: string;
}>;

/**
 * The single most urgent thing to do, in a fixed priority order: no project at
 * all, then blocked work, then uncommitted repository changes, then unverified
 * memory, then nothing.
 *
 * The order is by cost of ignoring it. Blocked work stops other work; a dirty
 * working tree makes captured evidence describe a state that is committed
 * nowhere; unverified memory is only a claim. A first run outranks all of them
 * because every other count is trivially zero when nothing is registered.
 */
export function dashboardFocus(dashboard: GuiDashboard): DashboardFocus {
  const workTotal = totalWorkItems(dashboard);
  if (dashboard.projects.total === 0) {
    return {
      priority: "FIRST_RUN",
      tone: "info",
      titleKey: "focusFirstRunTitle",
      bodyKey: "focusFirstRunBody",
      bodyCounts: {},
      actionKey: "focusFirstRunAction",
      href: "#/projects",
    };
  }
  if (dashboard.workItems.blocked > 0) {
    return {
      priority: "BLOCKED_WORK",
      tone: "blocked",
      titleKey: "focusBlockedTitle",
      bodyKey: "focusBlockedBody",
      bodyCounts: { count: dashboard.workItems.blocked, total: workTotal },
      actionKey: "focusBlockedAction",
      href: "#/work?state=BLOCKED",
    };
  }
  if (dashboard.projects.attention > 0) {
    return {
      priority: "PROJECT_ATTENTION",
      tone: "attention",
      titleKey: "focusAttentionTitle",
      bodyKey: "focusAttentionBody",
      bodyCounts: {
        count: dashboard.projects.attention,
        total: dashboard.projects.total,
      },
      actionKey: "focusAttentionAction",
      href: "#/projects?filter=attention",
    };
  }
  if (dashboard.memory.unverified > 0) {
    return {
      priority: "UNVERIFIED_MEMORY",
      tone: "active",
      titleKey: "focusUnverifiedTitle",
      bodyKey: "focusUnverifiedBody",
      bodyCounts: {
        count: dashboard.memory.unverified,
        total: dashboard.memory.sampled,
      },
      actionKey: "focusUnverifiedAction",
      href: "#/memory",
    };
  }
  return {
    priority: "CLEAR",
    tone: "good",
    titleKey: "focusClearTitle",
    bodyKey: "focusClearBody",
    bodyCounts: {},
    actionKey: "focusClearAction",
    href: "#/projects",
  };
}

/** Sum of the four Work Item states, which the aggregate reports separately. */
export function totalWorkItems(dashboard: GuiDashboard): number {
  const items = dashboard.workItems;
  return items.proposed + items.active + items.blocked + items.completed;
}

/** The whole dashboard presentation fragment, ready to be inserted as markup. */
export function dashboardFragmentHtml(
  dashboard: GuiDashboard,
  locale: GuiLocale,
): string {
  const cards = dashboardCards(dashboard);
  return [
    focusHtml(dashboard, locale),
    `<div class="chart-grid">${cards.map((card) => cardHtml(card, locale)).join("")}</div>`,
    tableHtml(cards, locale),
    `<p id="dashboard-coverage" class="help">${escapeMarkup(coverageText(dashboard, locale))}</p>`,
  ].join("");
}

/** Coverage sentence, kept public so the client can reuse the exact wording. */
export function coverageText(
  dashboard: GuiDashboard,
  locale: GuiLocale,
): string {
  return guiMessage(locale, "dashboardCoverageText", {
    available: formatGuiNumber(locale, dashboard.coverage.availableProjects),
    total: formatGuiNumber(locale, dashboard.projects.total),
    memoryLimit: formatGuiNumber(
      locale,
      dashboard.coverage.memoryLimitPerProject,
    ),
    privacyLimit: formatGuiNumber(
      locale,
      dashboard.coverage.privacyLimitPerProject,
    ),
    updated: formatGuiDateTime(locale, dashboard.asOf),
  });
}

type DashboardCard = Readonly<{
  id: string;
  kind: "donut" | "bar";
  kickerKey: GuiMessageKey;
  titleKey: GuiMessageKey;
  segments: readonly ChartSegment[];
  descriptionKey: GuiMessageKey;
  descriptionCounts: Readonly<Record<string, number>>;
  emptyKey: GuiMessageKey;
  /** Headline figure, which is not always the segment total: memory is sampled. */
  total: number;
  totalLabelKey: GuiMessageKey;
  linkKey: GuiMessageKey;
  href: string;
  notice?: Readonly<{
    key: GuiMessageKey;
    counts: Readonly<Record<string, number>>;
  }>;
}>;

function dashboardCards(dashboard: GuiDashboard): readonly DashboardCard[] {
  const work = dashboard.workItems;
  const memory = dashboard.memory;
  // A filtered link is offered only when it would land on something: a filter
  // guaranteed to match nothing is worse than no filter at all.
  const projectsLink: Pick<DashboardCard, "linkKey" | "href"> =
    dashboard.projects.attention > 0
      ? { linkKey: "focusAttentionAction", href: "#/projects?filter=attention" }
      : { linkKey: "openProjects", href: "#/projects" };
  const workLink: Pick<DashboardCard, "linkKey" | "href"> =
    work.blocked > 0
      ? { linkKey: "focusBlockedAction", href: "#/work?state=BLOCKED" }
      : { linkKey: "openWork", href: "#/work" };
  return [
    {
      id: "chart-projects",
      kind: "donut",
      kickerKey: "dashboardProjectsKicker",
      titleKey: "dashboardProjects",
      segments: [
        { label: "legendClean", value: dashboard.projects.clean, tone: "good" },
        {
          label: "legendAttention",
          value: dashboard.projects.attention,
          tone: "attention",
        },
      ],
      descriptionKey: "chartProjectsDesc",
      descriptionCounts: {
        clean: dashboard.projects.clean,
        total: dashboard.projects.total,
        attention: dashboard.projects.attention,
      },
      emptyKey: "chartProjectsEmpty",
      total: dashboard.projects.total,
      totalLabelKey: "chartProjectsTotal",
      ...projectsLink,
    },
    {
      id: "chart-work",
      kind: "bar",
      kickerKey: "dashboardWorkKicker",
      titleKey: "dashboardWork",
      segments: [
        { label: "legendProposed", value: work.proposed, tone: "proposed" },
        { label: "legendActive", value: work.active, tone: "active" },
        { label: "legendBlocked", value: work.blocked, tone: "blocked" },
        { label: "legendCompleted", value: work.completed, tone: "good" },
      ],
      descriptionKey: "chartWorkDesc",
      descriptionCounts: {
        total: totalWorkItems(dashboard),
        proposed: work.proposed,
        active: work.active,
        blocked: work.blocked,
        completed: work.completed,
      },
      emptyKey: "chartWorkEmpty",
      total: totalWorkItems(dashboard),
      totalLabelKey: "chartWorkTotal",
      ...workLink,
    },
    {
      id: "chart-memory",
      kind: "bar",
      kickerKey: "dashboardMemoryKicker",
      titleKey: "dashboardMemory",
      segments: [
        { label: "legendVerified", value: memory.verified, tone: "good" },
        {
          label: "legendUnverified",
          value: memory.unverified,
          tone: "attention",
        },
      ],
      descriptionKey: "chartMemoryDesc",
      descriptionCounts: {
        verified: memory.verified,
        sampled: memory.sampled,
        unverified: memory.unverified,
      },
      emptyKey: "chartMemoryEmpty",
      total: memory.active,
      totalLabelKey: "chartMemoryTotal",
      linkKey: "openMemory",
      href: "#/memory",
      ...(memory.truncated
        ? {
            notice: {
              key: "chartMemoryTruncated" as const,
              counts: { sampled: memory.sampled, active: memory.active },
            },
          }
        : {}),
    },
    {
      id: "chart-privacy",
      kind: "donut",
      kickerKey: "dashboardPrivacyKicker",
      titleKey: "dashboardPrivacy",
      segments: [
        {
          label: "legendReviewable",
          value: dashboard.privacy.reviewable,
          tone: "attention",
        },
        {
          label: "legendBlocked",
          value: dashboard.privacy.blocked,
          tone: "blocked",
        },
      ],
      descriptionKey: "chartPrivacyDesc",
      descriptionCounts: {
        total: dashboard.privacy.total,
        reviewable: dashboard.privacy.reviewable,
        blocked: dashboard.privacy.blocked,
      },
      emptyKey: "chartPrivacyEmpty",
      total: dashboard.privacy.total,
      totalLabelKey: "chartPrivacyTotal",
      linkKey: "openPrivacy",
      href: "#/privacy",
    },
  ];
}

function focusHtml(dashboard: GuiDashboard, locale: GuiLocale): string {
  const focus = dashboardFocus(dashboard);
  return [
    `<div class="dashboard-focus chart-tone-${focus.tone}" data-focus="${focus.priority}">`,
    `<p class="card-kicker">${text(locale, "dashboardFocusKicker")}</p>`,
    `<h3>${text(locale, focus.titleKey)}</h3>`,
    `<p>${text(locale, focus.bodyKey, focus.bodyCounts)}</p>`,
    `<a class="button-link" href="${escapeMarkup(focus.href)}">${text(locale, focus.actionKey)}</a>`,
    "</div>",
  ].join("");
}

function cardHtml(card: DashboardCard, locale: GuiLocale): string {
  const localized = card.segments.map((segment) => ({
    ...segment,
    label: guiMessage(locale, segment.label as GuiMessageKey),
  }));
  const options = {
    idPrefix: card.id,
    title: guiMessage(locale, card.titleKey),
    description: guiMessage(
      locale,
      card.descriptionKey,
      counts(locale, card.descriptionCounts),
    ),
    segments: localized,
    emptyDescription: guiMessage(locale, card.emptyKey),
  };
  const chart =
    card.kind === "donut" ? donutSvg(options) : stackedBarSvg(options);
  const figureClass =
    card.kind === "donut" ? "chart-figure chart-figure-donut" : "chart-figure";
  return [
    '<article class="chart-card">',
    `<div class="chart-card-heading"><p class="card-kicker">${text(locale, card.kickerKey)}</p><h3>${text(locale, card.titleKey)}</h3></div>`,
    `<div class="${figureClass}">`,
    chart,
    `<p class="chart-total"><strong>${escapeMarkup(formatGuiNumber(locale, card.total))}</strong><span>${text(locale, card.totalLabelKey)}</span></p>`,
    "</div>",
    legendHtml(localized, locale),
    card.notice
      ? `<p class="notice">${text(locale, card.notice.key, card.notice.counts)}</p>`
      : "",
    `<a class="card-link" href="${escapeMarkup(card.href)}">${text(locale, card.linkKey)}</a>`,
    "</article>",
  ].join("");
}

function legendHtml(
  segments: readonly ChartSegment[],
  locale: GuiLocale,
): string {
  const total = chartTotal(segments);
  const entries = segments
    .map((segment) =>
      [
        '<li class="chart-legend-item">',
        `<span class="chart-swatch chart-tone-${segment.tone}" aria-hidden="true"></span>`,
        `<span class="chart-legend-label">${escapeMarkup(segment.label)}</span>`,
        `<span class="chart-legend-value">${escapeMarkup(
          guiMessage(locale, "legendValue", {
            value: formatGuiNumber(locale, segment.value),
            share: formatGuiNumber(locale, percentage(segment.value, total)),
          }),
        )}</span>`,
        "</li>",
      ].join(""),
    )
    .join("");
  return `<ul class="chart-legend">${entries}</ul>`;
}

function tableHtml(cards: readonly DashboardCard[], locale: GuiLocale): string {
  const rows = cards
    .flatMap((card) => {
      const total = chartTotal(card.segments);
      return card.segments.map((segment, index) =>
        [
          "<tr>",
          index === 0
            ? `<th scope="row" rowspan="${card.segments.length}">${text(locale, card.titleKey)}</th>`
            : "",
          `<td>${text(locale, segment.label as GuiMessageKey)}</td>`,
          `<td>${escapeMarkup(formatGuiNumber(locale, segment.value))}</td>`,
          `<td>${escapeMarkup(
            formatGuiNumber(locale, percentage(segment.value, total)),
          )}%</td>`,
          "</tr>",
        ].join(""),
      );
    })
    .join("");
  return [
    '<details class="chart-table">',
    `<summary>${text(locale, "chartTableSummary")}</summary>`,
    "<table>",
    `<caption>${text(locale, "chartTableCaption")}</caption>`,
    `<thead><tr><th scope="col">${text(locale, "chartTableMeasure")}</th><th scope="col">${text(locale, "chartTableGroup")}</th><th scope="col">${text(locale, "chartTableValue")}</th><th scope="col">${text(locale, "chartTableShare")}</th></tr></thead>`,
    `<tbody>${rows}</tbody>`,
    "</table>",
    "</details>",
  ].join("");
}

/** Localizes a message and escapes it, because the result is interpolated into markup. */
function text(
  locale: GuiLocale,
  key: GuiMessageKey,
  numbers: Readonly<Record<string, number>> = {},
): string {
  return escapeMarkup(guiMessage(locale, key, counts(locale, numbers)));
}

function counts(
  locale: GuiLocale,
  numbers: Readonly<Record<string, number>>,
): Readonly<Record<string, string>> {
  return Object.fromEntries(
    Object.entries(numbers).map(([name, value]) => [
      name,
      formatGuiNumber(locale, value),
    ]),
  );
}
