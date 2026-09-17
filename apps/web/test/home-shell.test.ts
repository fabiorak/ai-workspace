import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { APP_CSS, APP_JS, shellHtml } from "../src/assets.ts";
import { GUI_CATALOGS, SUPPORTED_LOCALES } from "../src/index.ts";
import { mergeCatalogues } from "../src/text/catalog.ts";
import { HOME_CATALOGUES, HOME_TEXT } from "../src/text/home.ts";
import { PRIVACY_CATALOGUES } from "../src/text/privacy.ts";
import { RESTART_POINT_CATALOGUES } from "../src/text/restart-point.ts";

const html = shellHtml("csrf-token");
const catalogues = mergeCatalogues(
  GUI_CATALOGS,
  HOME_CATALOGUES,
  PRIVACY_CATALOGUES,
  RESTART_POINT_CATALOGUES,
);
const homeSection = (() => {
  const start = html.indexOf('<section aria-labelledby="home-heading"');
  return html.slice(start, html.indexOf("</section>", start));
})();

describe("the opening screen", () => {
  it("uses the work-history promise in its untranslated fallback", () => {
    assert.equal(
      (html.match(/Your work history, on this computer/gu) ?? []).length,
      2,
    );
    assert.doesNotMatch(html, /Local-first control plane/u);
  });

  it("is what a reader lands on, by address and by title", () => {
    assert.match(APP_JS, /replaceState\(null, "", "#\/home"\)/u);
    assert.match(APP_JS, /home: \["home"\]/u);
    assert.match(html, /<h1 id="page-title" data-i18n="navHome">/u);
  });

  it("lands on one conversation composer with one primary send action", () => {
    assert.match(homeSection, /<form id="home-composer"/u);
    assert.match(homeSection, /<textarea id="home-message"/u);
    assert.match(homeSection, /<select id="home-conversation-model"/u);
    assert.equal((homeSection.match(/class="send-button"/gu) ?? []).length, 1);
    assert.doesNotMatch(homeSection, /id="home-ask"/u);
  });

  it("closes mobile navigation when a new conversation starts", () => {
    assert.match(
      APP_JS,
      /startNewConversation[\s\S]*classList\.remove\("menu-open"\)[\s\S]*aria-expanded", "false"/u,
    );
  });

  it("closes mobile navigation with Escape and returns focus to its toggle", () => {
    assert.match(
      APP_JS,
      /event\.key === "Escape"[\s\S]*classList\.contains\("menu-open"\)[\s\S]*closeMobileMenu\(true\)/u,
    );
    assert.match(
      APP_JS,
      /const closeMobileMenu[\s\S]*classList\.remove\("menu-open"\)[\s\S]*aria-expanded", "false"[\s\S]*restoreFocus && wasOpen[\s\S]*toggle\.focus\(\)/u,
    );
  });

  it("loads configured targets and persists a conversation choice by target ID", () => {
    assert.doesNotMatch(homeSection, /value="model-a"|value="model-b"/u);
    assert.match(html, /id="model-target-form"/u);
    assert.match(APP_JS, /api\("\/api\/model-targets"\)/u);
    assert.match(
      APP_JS,
      /selectConversationTarget\(openConversation, openConversationProject, targetId\)/u,
    );
    assert.match(APP_JS, /expectedRevision: modelTargetRevision/u);
    assert.doesNotMatch(html, /id="continuation-configure"/u);
  });

  it("keeps dynamic Settings choices and privacy guidance localized after a language change", () => {
    assert.match(
      APP_JS,
      /modelTargetMessageOption\("", "modelTargetChoose"\)/u,
    );
    assert.match(
      APP_JS,
      /modelTargetMessageOption\("", "modelTargetNoDefault"\)/u,
    );
    assert.match(APP_JS, /threat: \{ key: "automaticProtectionThreat" \}/u);
  });

  it("names the field with a visible label bound to its control", () => {
    assert.match(homeSection, /for="home-message"/u);
    assert.match(
      homeSection,
      /aria-describedby="home-composer-status home-composer-error"/u,
    );
    assert.match(
      homeSection,
      /data-i18n-placeholder="homeMessagePlaceholder"/u,
    );
  });

  /**
   * The list used to be empty until somebody imported by hand, which made the first
   * screen of the product a screen with nothing on it. Sessions now arrive from the
   * folders already pointed at — after the stored list is drawn, so the page answers
   * immediately — and the arrival is announced rather than done quietly.
   */
  it("brings in what arrived, behind the list it already had", () => {
    assert.match(
      APP_JS,
      /loadModelTargets\(\)\.then\(loadConversations\)\.then\(loadArrived\)/u,
    );
    assert.match(
      APP_JS,
      /"\/api\/transcripts\/arrived",\s*\{\s*method: "POST"/u,
    );
    assert.match(APP_JS, /"homeArrivedLooking"/u);
    assert.match(APP_JS, /"homeArrivedUnreadable"/u);
  });

  /**
   * The day group narrows a row to a day, which is not enough to tell two sessions of
   * the same day apart. The row states its own time and what ran it, and a row with
   * no readable time says nothing rather than borrowing one.
   */
  it("states the time of a row and the model that ran it", () => {
    assert.match(APP_JS, /rowMoment\(row\.lastMomentAt\)/u);
    assert.match(APP_JS, /const ran = row\.model \|\| row\.agent/u);
    assert.match(APP_JS, /timeStyle: "short"/u);
  });

  it("states why a restart summary is suggested without showing byte counts", () => {
    const start = APP_JS.indexOf("const renderConversationRow");
    const end = APP_JS.indexOf("const renderConversations", start);
    const render = APP_JS.slice(start, end);
    assert.match(render, /row\.restartSignal/u);
    assert.match(render, /homeRestartSignal/u);
    assert.match(render, /conversation-signal/u);
    assert.doesNotMatch(render, /byte/u);
    assert.match(APP_CSS, /\.conversation-signal \{[^}]*border-inline-start/u);
  });

  /**
   * A row used to be a link to a screen that showed no particular conversation, so
   * the list was a catalogue: every row present, none of them openable. It opens in
   * place now, which is why it is a button — a link that changes no address lies to
   * whoever reads where it goes.
   */
  it("makes a row open its own conversation, in place", () => {
    assert.match(APP_JS, /showConversation\(row, true\)/u);
    assert.match(APP_JS, /"\/api\/conversations\/"/u);
    assert.doesNotMatch(APP_JS, /link\.href = row\.kind/u);
    assert.match(html, /id="home-conversation-moments"/u);
    // The open row is named for assistive technology, not only shaded.
    assert.match(APP_JS, /setAttribute\("aria-current", "true"\)/u);
  });

  it("opens a separately stored moment only through its conversation", () => {
    const start = APP_JS.indexOf("const renderMoment");
    const end = APP_JS.indexOf("const renderConversation", start);
    assert.notEqual(start, -1);
    assert.notEqual(end, -1);
    const render = APP_JS.slice(start, end);
    assert.match(render, /moment\.textStoredSeparately/u);
    assert.match(render, /"\/api\/conversations\/"/u);
    assert.match(render, /"\/moments\/"/u);
    assert.match(render, /encodeURIComponent\(moment\.id\)/u);
    assert.doesNotMatch(render, /artifactId/u);
    assert.match(render, /open\.disabled = true/u);
    assert.match(render, /open\.focus\(\)/u);
  });

  /**
   * The list is on the left of every screen, so a row is clickable from a screen the
   * conversation does not open on. Without this the click appears to do nothing, and
   * the way to what was asked for is a menu entry a person has to find for themselves.
   */
  it("takes a reader to the screen the conversation opens on", () => {
    const start = APP_JS.indexOf("const showConversation");
    assert.notEqual(start, -1);
    const body = APP_JS.slice(
      start,
      APP_JS.indexOf(
        'document.getElementById("home-conversation-close")',
        start,
      ),
    );
    assert.match(body, /currentPage\(\) === "home"/u);
    assert.match(body, /openPage\("home", false\)/u);
    // Selecting the open row again is idempotent and leaves the conversation open.
    assert.match(body, /showing && openConversation === row\.id/u);
    assert.doesNotMatch(
      body.slice(
        body.indexOf("showing && openConversation"),
        body.indexOf("if (!showing)"),
      ),
      /closeConversation/u,
    );
  });

  /**
   * A long conversation is mostly reply, and what a reader scrolls back through it for
   * is their own question. Those moments carry a surface of their own — and a rule as
   * well as a colour, because a mark made only of colour is no mark on some screens.
   */
  it("marks the moments the person wrote themselves", () => {
    assert.match(
      APP_JS,
      /moment\.type === "USER_MESSAGE" \? "moment moment-yours"/u,
    );
    assert.match(APP_CSS, /\.moment-yours \{[^}]*background: var\(--yours\)/u);
    assert.match(APP_CSS, /\.moment-yours \{[^}]*border-inline-start/u);
    // Both themes declare that surface: a variable defined in one leaves the other
    // with no background at all, which is exactly the screen nobody tests on. The
    // dark values are now applied twice — by the system and by an explicit choice —
    // from one constant, so the two blocks are compared instead of counted.
    assert.match(APP_CSS, /:root \{[^}]*--yours: #e6edfd/u);
    const dark = APP_CSS.match(/--canvas: #0d1422[^}]*/gu) ?? [];
    assert.equal(dark.length, 2, "the dark values are applied twice");
    assert.equal(
      new Set(
        dark.map((block) => block.replace(/color-scheme: dark;/u, "").trim()),
      ).size,
      1,
      "the two dark blocks drifted apart",
    );
    for (const block of dark) assert.match(block, /--yours:/u);
  });

  /**
   * Reachability was asserted; leaving was not. The menu offered three ways in and
   * no way back, so whoever opened one of them had the browser's back button and
   * nothing else — and the opening screen is the one place this shell promises.
   */
  it("offers a way back to the opening screen, not only ways into the others", () => {
    assert.match(html, /class="brand" href="#\/home"[^>]*data-route="home"/u);
  });

  /**
   * The list is drawn once, when the page loads. A write that adds to it and does
   * not ask for a redraw leaves a person looking at the same emptiness they had
   * before, which reads as an import that did nothing. Behaviour lives in a string,
   * so this asserts the served source: it proves the call is written where it
   * belongs, not that a browser ran it.
   */
  it("redraws the list after every write that adds to it", () => {
    const handlerOf = (marker: string) => {
      const start = APP_JS.indexOf(marker);
      assert.notEqual(start, -1, `no write found for ${marker}`);
      const end = APP_JS.indexOf("catch (cause)", start);
      return APP_JS.slice(start, end === -1 ? undefined : end);
    };
    for (const write of [
      'import-transcript"',
      'import-sample"',
      '"/api/general/conversations", { method: "POST"',
      '/events", { method: "POST"',
    ])
      assert.match(handlerOf(write), /await loadConversations\(\)/u, write);
  });

  it("offers the conversation list as a real list inside a landmark", () => {
    assert.match(
      html,
      /<nav class="conversation-nav"[^>]*aria-label="Your conversations"/u,
    );
    assert.match(APP_JS, /document\.createElement\("ul"\)/u);
    assert.match(APP_JS, /document\.createElement\("li"\)/u);
  });

  it("announces the list and the answer politely, never assertively", () => {
    for (const id of ["conversation-status", "home-answer-status"]) {
      const region = html.slice(html.indexOf(`id="${id}"`));
      assert.match(region.slice(0, 120), /aria-live="polite"/u);
    }
    assert.doesNotMatch(homeSection, /aria-live="assertive"/u);
  });

  it("says how many conversations there are, not merely that loading finished", () => {
    assert.match(APP_JS, /say\(conversationCount, "homeCounted"/u);
    assert.match(APP_JS, /say\(conversationCount, "homeAllShown"/u);
    assert.match(APP_JS, /say\(homeAnswerStatus, "homeAnswerComposed"/u);
  });

  it("moves focus only where the reader asked for something", () => {
    // The answer heading is focused after a submitted question, and nothing focuses
    // when the list arrives on its own.
    assert.match(APP_JS, /homeAnswerHeading\.focus\(\)/u);
    assert.doesNotMatch(
      APP_JS,
      /renderConversations[\s\S]{0,400}?\.focus\(\)/u,
    );
  });

  it("offers to carry the work onward only when the answer names a project", () => {
    // The summary is per project by construction, so an answer composed only from
    // project-free notes has no project to summarise and must not offer one.
    assert.match(html, /<div id="home-restart" hidden>/u);
    assert.match(APP_JS, /homeRestart\.hidden = homeRestartProject === null/u);
    assert.match(APP_JS, /restart-summary\?q=/u);
    assert.match(APP_JS, /say\(homeRestartStatus, "homeRestartFor"/u);
  });

  it("keeps the technical view reachable and says it is being rebuilt", () => {
    assert.match(
      html,
      /<section aria-labelledby="technical-heading" id="technical">/u,
    );
    assert.match(html, /data-i18n="homeTechnicalIntro"/u);
    for (const locale of SUPPORTED_LOCALES)
      assert.match(
        catalogues[locale].homeTechnicalIntro ?? "",
        locale === "it" ? /rifacimento/u : /rebuilt/u,
      );
  });

  it("names the model that ran a session, falling back to the agent", () => {
    assert.match(APP_JS, /const ran = row\.model \|\| row\.agent/u);
    // Shown verbatim: no translation key wraps it, because a model name is a proper name.
    assert.doesNotMatch(APP_JS, /message\("homeModel/u);
  });

  it("shows a linked work state as a word, never as the constant that stores it", () => {
    assert.doesNotMatch(homeSection, /\b[A-Z][A-Z_]{3,}\b/u);
    assert.equal(HOME_TEXT.homeStateBLOCKED.it, "bloccato");
    assert.equal(HOME_TEXT.homeStatePROPOSED.it, "da iniziare");
  });

  it("labels the standard U4 transport as a local simulation in both languages", () => {
    assert.match(HOME_TEXT.homeTurnSaved.en, /no model was called/u);
    assert.match(HOME_TEXT.homeTurnSaved.it, /nessun modello/u);
    assert.match(HOME_TEXT.homeProtectionFake.en, /local simulated/u);
    assert.match(HOME_TEXT.homeProtectionFake.it, /locale simulato/u);
  });

  it("carries no legacy continuation control into the ordinary path", () => {
    /** Settings keeps one legacy passphrase for migration, and the technical
     * view keeps the advanced privacy forms. Neither belongs to this screen. */
    for (const legacy of [/passphrase/iu, /names to protect/iu, /exact/iu])
      assert.doesNotMatch(
        homeSection,
        legacy,
        `${legacy} is still on the conversation screen.`,
      );
    for (const legacy of [
      /id="continuation-/u,
      /continuation-passphrase/u,
      /continuation-names/u,
      /continuation-protect/u,
      /continuation-send/u,
    ])
      assert.doesNotMatch(html, legacy, `${legacy} is still served.`);
    for (const legacy of [
      /setContinuationConversation/u,
      /continuationElement/u,
      /continuationPath/u,
    ])
      assert.doesNotMatch(APP_JS, legacy, `${legacy} is still shipped.`);
  });

  /** The secondary actions must remain readable and not compete with Send. */
  it("shows the context and protection actions as readable secondary buttons", () => {
    assert.match(homeSection, /id="home-context-open" class="panel-button"/u);
    assert.match(
      homeSection,
      /id="home-protection-preview-toggle" class="panel-button"/u,
    );
    assert.equal((homeSection.match(/class="send-button"/gu) ?? []).length, 1);
    assert.match(APP_CSS, /\.panel-button \{[^}]*border:/u);
    assert.match(
      APP_CSS,
      /\.panel-button \{[^}]*background: var\(--surface\)/u,
    );
    /** Stated here, so the shared hover cannot leave a label on its own accent. */
    const hover = APP_CSS.match(/\.panel-button:hover \{[^}]*\}/u)?.[0];
    assert.ok(hover, "the panel buttons declare no hover of their own");
    assert.match(hover, /background:/u);
    assert.match(hover, /color: var\(--ink\)/u);
    assert.match(APP_CSS, /\.panel-button\[aria-expanded="true"\]/u);
  });

  /** At 200% zoom the model selector collapsed to its arrows: min-width 0 let a
   * flex item shrink past its own content, so the chosen model became invisible. */
  it("keeps the model selector readable when the viewport shrinks", () => {
    assert.match(
      APP_CSS,
      /\.conversation-actions select \{[^}]*min-width: 10rem/u,
    );
    assert.doesNotMatch(
      APP_CSS,
      /\.conversation-actions select \{[^}]*min-width: 0/u,
    );
    assert.match(
      APP_CSS,
      /\.conversation-actions select \{[^}]*text-overflow: ellipsis/u,
    );
  });

  /**
   * Settings promised the appearance beside the language and offered only the
   * language, so the light theme could not be reached at all on a dark desktop.
   */
  it("lets a person choose the appearance without leaving the system behind", () => {
    assert.match(html, /id="gui-theme"/u);
    for (const value of ["system", "light", "dark"])
      assert.match(html, new RegExp(`<option value="${value}"`, "u"));
    for (const key of [
      "appearance",
      "appearanceHelp",
      "appearanceSystem",
      "appearanceLight",
      "appearanceDark",
    ]) {
      assert.ok(catalogues.en[key]?.trim(), `${key} has no English text.`);
      assert.ok(catalogues.it[key]?.trim(), `${key} has no Italian text.`);
    }
    /** The choice is presentation, so it stays in this browser like the locale. */
    assert.match(APP_JS, /const themeKey = "aiw-theme"/u);
    assert.match(APP_JS, /localStorage\.setItem\(themeKey, theme\)/u);
    /** "system" removes the attribute instead of freezing today's value. */
    assert.match(
      APP_JS,
      /theme === "system"\s*\)?\s*delete document\.documentElement\.dataset\.theme/u,
    );
    assert.match(APP_CSS, /:root\[data-theme="dark"\][^}]*--canvas: #0d1422/u);
    assert.match(APP_CSS, /:root\[data-theme="dark"\][^}]*color-scheme: dark/u);
    assert.match(
      APP_CSS,
      /:root\[data-theme="light"\] \{ color-scheme: light; \}/u,
    );
    /** A chosen light theme must survive a dark desktop. */
    assert.match(
      APP_CSS,
      /@media \(prefers-color-scheme: dark\) \{ :root:not\(\[data-theme="light"\]\)/u,
    );
  });

  /**
   * The sidebar was dark in both themes, and its hovers, rules and raised
   * surfaces were hardcoded white — legible only over a dark panel. Choosing the
   * light theme left the left column dark, and simply lightening it would have
   * painted white on white. Every one of those states is now a variable.
   */
  it("gives the sidebar a surface and states that follow the chosen theme", () => {
    const sidebarStates = [
      "--sidebar",
      "--sidebar-ink",
      "--sidebar-muted",
      "--sidebar-label",
      "--sidebar-hover",
      "--sidebar-active",
      "--sidebar-line",
      "--sidebar-raised",
      "--sidebar-glow",
      "--sidebar-current-ink",
      "--sidebar-current-back",
      "--sidebar-current-rule",
    ];
    // Declared for the light theme and for both dark blocks: a state defined in
    // one theme only is the state that disappears in the other.
    for (const name of sidebarStates)
      assert.equal(
        APP_CSS.split(`${name}:`).length - 1,
        3,
        `${name} is not declared in every theme`,
      );
    // The rules inside the sidebar read those variables instead of naming white.
    const sidebarRules = APP_CSS.split("\n").filter((rule) =>
      /^\.(sidebar|primary-nav|conversation-nav|nav-label|nav-badge|new-conversation|locality-card)/u.test(
        rule,
      ),
    );
    assert.ok(sidebarRules.length > 5);
    for (const rule of sidebarRules)
      assert.doesNotMatch(
        rule,
        /rgba\(255,\s*255,\s*255/u,
        `a sidebar rule still hardcodes white: ${rule.slice(0, 60)}`,
      );
  });

  /**
   * A moment used to state its record number and content fingerprint on every
   * line. That is what makes the screen checkable and also exactly what the
   * ordinary path forbids, so it moved one gesture away instead of vanishing.
   */
  it("keeps record numbers and fingerprints one gesture away from a moment", () => {
    const start = APP_JS.indexOf("const renderMoment");
    const render = APP_JS.slice(
      start,
      APP_JS.indexOf("const renderConversation", start),
    );
    assert.match(render, /createElement\("details"\)/u);
    assert.match(render, /moment-source/u);
    assert.match(render, /homeMomentSourceSummary/u);
    // The fingerprint is appended to the disclosure, never to the moment itself.
    assert.match(render, /source\.append\(sourceSummary, provenance\)/u);
    assert.doesNotMatch(render, /item\.append\([^)]*provenance/u);
    for (const key of ["homeMomentSourceSummary"]) {
      assert.ok(catalogues.en[key]?.trim());
      assert.ok(catalogues.it[key]?.trim());
    }
  });

  /**
   * The route answers in English because it answers machines. Showing its wording
   * put an English sentence inside an Italian interface, so the outcome is read
   * from the status and said in the reader's own language.
   */
  it("says the outcome of a protected term in the reader's language", () => {
    assert.match(APP_JS, /response\.status === 409/u);
    assert.match(APP_JS, /homeProtectionTermConflict/u);
    assert.match(APP_JS, /homeProtectionTermRefused/u);
    for (const key of [
      "homeProtectionTermConflict",
      "homeProtectionTermRefused",
    ]) {
      assert.ok(catalogues.en[key]?.trim(), `${key} has no English text.`);
      assert.ok(catalogues.it[key]?.trim(), `${key} has no Italian text.`);
    }
    // The server's own wording never reaches the panel.
    const form = APP_JS.slice(
      APP_JS.indexOf("const protectionTermForm"),
      APP_JS.indexOf("const openConversationPanel"),
    );
    assert.doesNotMatch(form, /detail\(status, cause\)/u);
  });

  it("offers one reviewed way to protect a value the detector cannot find", () => {
    assert.match(APP_JS, /protectionTermForm/u);
    assert.match(APP_JS, /\/protected-terms/u);
    assert.match(APP_JS, /home-term-value/u);
    assert.match(APP_CSS, /\.protection-term /u);
    for (const key of [
      "homeProtectionTermLabel",
      "homeProtectionTermKind",
      "homeProtectionTermAdd",
      "homeProtectionTermAdded",
      "homeProtectionTermKnown",
      "homeProtectionTermInvalid",
      "homeProtectionTermUnavailable",
      "homeProtectionKindPERSON",
      "homeProtectionKindORGANIZATION",
      "homeProtectionKindCUSTOMER",
      "homeProtectionKindPROJECT",
      "homeProtectionKindADDRESS",
      "homeProtectionKindOTHER",
    ]) {
      assert.ok(catalogues.en[key]?.trim(), `${key} has no English text.`);
      assert.ok(catalogues.it[key]?.trim(), `${key} has no Italian text.`);
    }
  });

  it("offers an optional highlighted protection preview before sending", () => {
    assert.match(APP_JS, /\/protection-preview/u);
    assert.match(APP_JS, /createElement\("mark"\)/u);
    assert.match(APP_JS, /clearProtectionPreview/u);
    assert.match(homeSection, /id="home-protection-preview-toggle"/u);
    assert.match(homeSection, /id="home-protection-preview"/u);
    assert.match(homeSection, /id="home-protection-manage"/u);
    assert.match(APP_JS, /homeProtectionPreviewReady/u);
    assert.match(APP_CSS, /\.protection-preview-output mark/u);
    for (const key of [
      "homeProtectionPreviewIntro",
      "homeProtectionPreviewAction",
      "homeProtectionPreviewHide",
      "homeProtectionPreviewManage",
      "homeProtectionPreviewEmpty",
      "homeProtectionPreviewReady",
      "homeProtectionPreviewFailed",
    ]) {
      assert.ok(catalogues.en[key]?.trim(), `${key} has no English text.`);
      assert.ok(catalogues.it[key]?.trim(), `${key} has no Italian text.`);
    }
  });

  it("keeps history search on a dedicated sidebar destination", () => {
    assert.match(html, /href="#\/history"[^>]*data-route="history"/u);
    assert.match(html, /id="history-search"/u);
    assert.match(APP_JS, /history: \["history-search"\]/u);
  });

  it("groups technical moments behind one disclosed activity", () => {
    assert.match(APP_JS, /const technicalMoment/u);
    assert.match(APP_JS, /renderTechnicalActivity/u);
    assert.match(APP_JS, /homeTechnicalActivity/u);
    assert.match(APP_CSS, /\.technical-activity summary/u);
  });

  it("submits one conversation-scoped turn and reloads retained moments", () => {
    const start = APP_JS.indexOf('document.getElementById("home-composer")');
    const handler = APP_JS.slice(start, APP_JS.indexOf("// The answer", start));
    assert.match(handler, /homeTurnPreparing/u);
    assert.match(handler, /homeTurnIncoming/u);
    assert.match(handler, /\/turn/u);
    assert.match(handler, /clientRequestId: crypto\.randomUUID\(\)/u);
    assert.match(handler, /outcome\.result\.kind === "COMPLETED"/u);
    assert.match(handler, /showConversation\([^)]*false, true\)/u);
    assert.match(handler, /homeTurnRefused/u);
    const refused = handler.slice(
      handler.indexOf('outcome.result.kind === "REFUSED_BEFORE_EXPOSURE"'),
      handler.indexOf('outcome.result.kind === "UNKNOWN_AFTER_EXPOSURE"'),
    );
    assert.doesNotMatch(refused, /homeMessage\.value = ""/u);
  });

  it("supports Ctrl+Enter while plain Enter remains textarea input", () => {
    assert.match(
      APP_JS,
      /event\.key === "Enter" && event\.ctrlKey[\s\S]*?requestSubmit/u,
    );
    assert.doesNotMatch(APP_JS, /event\.key === "Enter" && !event\.shiftKey/u);
  });

  it("keeps the conversation region named while empty or populated", () => {
    assert.match(
      homeSection,
      /<h2 id="home-heading" class="visually-hidden"[^>]*data-i18n="navHome"/u,
    );
    const empty = homeSection.slice(homeSection.indexOf('id="home-empty"'));
    assert.doesNotMatch(empty, /id="home-heading"/u);
  });

  it("closes conversation details with Escape and restores the opener", () => {
    assert.match(APP_JS, /event\.key === "Escape" && !homePanel\.hidden/u);
    assert.match(APP_JS, /homePanelOpener\.focus\(\)/u);
    assert.match(
      APP_JS,
      /homePanelOpener !== opener[\s\S]*?aria-expanded", "false"/u,
    );
  });

  it("localizes the composer's placeholder", () => {
    assert.match(APP_JS, /querySelectorAll\("\[data-i18n-placeholder\]"\)/u);
    assert.match(
      APP_JS,
      /setAttribute\("placeholder", message\(element\.dataset\.i18nPlaceholder\)\)/u,
    );
  });
});

describe("the served script", () => {
  it("parses, so a broken fragment fails here instead of in a browser", () => {
    /**
     * ADR-0035 splits client behaviour per zone, and those pieces are spliced in as
     * source text. A syntax error in one of them would leave every assertion above
     * passing while the whole interface stayed dead, because nothing else in this
     * suite ever parses what is served. Constructing the function parses it without
     * running it: there is no DOM here, and none is needed to catch this.
     */

    assert.doesNotThrow(() => new Function(APP_JS));
  });

  it("assigns no markup, on any zone", () => {
    assert.doesNotMatch(APP_JS, /innerHTML|outerHTML|insertAdjacentHTML/u);
  });
});

describe("shell text keys", () => {
  it("resolves every key the served markup asks for, in both languages", () => {
    const keys = new Set(
      [...html.matchAll(/data-i18n(?:-label)?="([^"]+)"/gu)].map(
        (match) => match[1] as string,
      ),
    );
    assert.ok(keys.size > 40);
    const missing = [...keys].flatMap((key) =>
      SUPPORTED_LOCALES.filter(
        (locale) => typeof catalogues[locale][key] !== "string",
      ).map((locale) => `${locale}.${key}`),
    );
    assert.deepEqual(
      missing,
      [],
      `The shell asks for keys no catalogue defines: ${missing.join(", ")}`,
    );
  });

  it("refuses two areas that claim one key, instead of letting merge order decide", () => {
    assert.throws(
      () => mergeCatalogues(GUI_CATALOGS, HOME_CATALOGUES, HOME_CATALOGUES),
      /both define/u,
    );
  });

  it("keeps every home sentence present and free of placeholders in both languages", () => {
    for (const [key, entry] of Object.entries(HOME_TEXT))
      for (const locale of SUPPORTED_LOCALES) {
        assert.ok(entry[locale]?.trim(), `${locale}.${key} is empty`);
        assert.doesNotMatch(entry[locale], /TODO|TBD/u);
      }
  });
});

/**
 * Hiding something has to hide it.
 *
 * Found by looking, on 2026-08-29: the stylesheet sets `display` on `button`, on
 * `input` and on several classes, and every one of those rules beats the browser's
 * own `[hidden] { display: none }`. Six buttons across this interface are marked
 * hidden — among them the ones that create a handoff, confirm aliases and load older
 * audit events — and all six stayed on screen, reachable by keyboard and clickable.
 * A control nobody meant to offer is worse than a missing one, so this is measured
 * rather than left to the next person to rediscover.
 */
describe("what is marked hidden", () => {
  it("is hidden however else it is styled", () => {
    assert.match(APP_CSS, /\[hidden\] \{ display: none !important; \}/u);
    const rule = APP_CSS.lastIndexOf("[hidden] { display: none !important; }");
    for (const earlier of [
      "button {",
      "input, select, textarea {",
      ".model-target-settings form {",
    ])
      assert.ok(
        APP_CSS.indexOf(earlier) < rule,
        `${earlier} sets display after the hidden rule, which would show hidden elements again`,
      );
  });

  /** Every control the interface hides, so a new one cannot quietly rely on nothing. */
  it("covers the controls this interface hides", () => {
    const hidden = [
      ...shellHtml("csrf-token").matchAll(/<button[^>]*hidden/gu),
    ];
    assert.ok(hidden.length >= 5);
  });
});
