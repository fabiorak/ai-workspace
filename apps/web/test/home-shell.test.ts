import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { APP_CSS, APP_JS, shellHtml } from "../src/assets.ts";
import { GUI_CATALOGS, SUPPORTED_LOCALES } from "../src/index.ts";
import { mergeCatalogues } from "../src/text/catalog.ts";
import { HOME_CATALOGUES, HOME_TEXT } from "../src/text/home.ts";

const html = shellHtml("csrf-token");
const catalogues = mergeCatalogues(GUI_CATALOGS, HOME_CATALOGUES);
const homeSection = (() => {
  const start = html.indexOf('<section aria-labelledby="home-heading"');
  return html.slice(start, html.indexOf("</section>", start));
})();

describe("the opening screen", () => {
  it("is what a reader lands on, by address and by title", () => {
    assert.match(APP_JS, /replaceState\(null, "", "#\/home"\)/u);
    assert.match(APP_JS, /home: \["home"\]/u);
    assert.match(html, /<h1 id="page-title" data-i18n="navHome">/u);
  });

  it("asks one question and needs no form filled in first", () => {
    assert.match(homeSection, /<input id="home-ask" name="q" required/u);
    assert.equal((homeSection.match(/<input /gu) ?? []).length, 1);
    assert.equal((homeSection.match(/<select /gu) ?? []).length, 0);
    assert.equal((homeSection.match(/<textarea/gu) ?? []).length, 0);
  });

  it("names the field with a visible label bound to its control", () => {
    assert.match(homeSection, /<label for="home-ask"/u);
    assert.match(
      homeSection,
      /aria-describedby="home-ask-help home-ask-error"/u,
    );
  });

  /**
   * The list used to be empty until somebody imported by hand, which made the first
   * screen of the product a screen with nothing on it. Sessions now arrive from the
   * folders already pointed at — after the stored list is drawn, so the page answers
   * immediately — and the arrival is announced rather than done quietly.
   */
  it("brings in what arrived, behind the list it already had", () => {
    assert.match(APP_JS, /loadConversations\(\)\.then\(loadArrived\)/u);
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

  /**
   * A row used to be a link to a screen that showed no particular conversation, so
   * the list was a catalogue: every row present, none of them openable. It opens in
   * place now, which is why it is a button — a link that changes no address lies to
   * whoever reads where it goes.
   */
  it("makes a row open its own conversation, in place", () => {
    assert.match(APP_JS, /showConversation\(row\)/u);
    assert.match(APP_JS, /"\/api\/conversations\/"/u);
    assert.doesNotMatch(APP_JS, /link\.href = row\.kind/u);
    assert.match(html, /id="home-conversation-moments"/u);
    // The open row is named for assistive technology, not only shaded.
    assert.match(APP_JS, /setAttribute\("aria-current", "true"\)/u);
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
    // A second click closes what is open only from the screen that shows it.
    assert.match(body, /showing && openConversation === row\.id/u);
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
    // with no background at all, which is exactly the screen nobody tests on.
    assert.equal((APP_CSS.match(/--yours:/gu) ?? []).length, 2);
  });

  /**
   * Reachability was asserted; leaving was not. The menu offered three ways in and
   * no way back, so whoever opened one of them had the browser's back button and
   * nothing else — and the opening screen is the one place this shell promises.
   */
  it("offers a way back to the opening screen, not only ways into the others", () => {
    const start = html.indexOf('class="primary-nav"');
    assert.notEqual(start, -1);
    const nav = html.slice(start, html.indexOf("</nav>", start));
    assert.match(nav, /href="#\/home"/u);
    assert.match(nav, /data-i18n="navHome"/u);
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

  it("promises no assistant, in either language", () => {
    /**
     * The prohibition is about implying that something here answers. Carrying the
     * work onward names an assistant on purpose — it is the recipient elsewhere,
     * not an interlocutor in this product — so those two sentences are the only
     * place the word belongs.
     */
    const recipients = new Set(["homeRestartFor"]);
    for (const [key, entry] of Object.entries(HOME_TEXT))
      if (!recipients.has(key))
        for (const locale of SUPPORTED_LOCALES)
          assert.doesNotMatch(
            entry[locale],
            /\b(assistant|assistente|chat|model|modello|ask me|chiedimi)\b/iu,
            `${locale}.${key}: "${entry[locale]}" must not imply something answers`,
          );
    assert.match(HOME_TEXT.homeAskHelp.it, /già su questo computer/u);
    assert.match(HOME_TEXT.homeRestartFor.it, /un altro assistente/u);
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
