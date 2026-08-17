/**
 * The opening screen's markup: three zones and no form to fill in.
 *
 * ADR-0035 makes this the page a reader lands on, so it carries only what
 * answering "where was I" needs — the list of conversations, one field, and the
 * answer. The sidebar list is a real `<nav>` with a real list inside, because a
 * person moving by keyboard or screen reader navigates by landmark and by list,
 * and a pile of links is neither.
 *
 * Both live regions are polite: the list and the answer arrive while the reader is
 * still reading, and interrupting them is worse than being late.
 */

/** Replaces the nine-entry menu: the work itself, then the two things that are not work. */
export const HOME_SIDEBAR = `
      <nav class="conversation-nav" data-i18n-label="homeListLabel" aria-label="Your conversations">
        <p class="nav-label" data-i18n="homeListLabel">Your conversations</p>
        <div id="conversation-status" class="inline-status" role="status" aria-live="polite" data-i18n="homeLoading">Reading your work…</div>
        <div id="conversation-groups"></div>
        <p id="conversation-count" class="help"></p>
      </nav>
      <nav class="primary-nav" data-i18n-label="navLabel" aria-label="Workspace">
        <a href="#/projects" data-route="projects"><span aria-hidden="true">◇</span><span data-i18n="navProjects">Projects</span></a>
        <a href="#/settings" data-route="settings"><span aria-hidden="true">⚙</span><span data-i18n="navSettings">Settings</span></a>
        <a href="#/technical" data-route="technical"><span aria-hidden="true">⌗</span><span data-i18n="homeTechnicalHeading">Technical view</span></a>
      </nav>`;

export const HOME_SECTION = `
    <section aria-labelledby="home-heading" id="home">
      <h2 id="home-heading" tabindex="-1" data-i18n="navHome">Your work</h2>
      <p data-i18n="homeIntro">Everything you have worked on, most recent first. Ask a question to search it.</p>
      <form id="home-ask-form">
        <label for="home-ask" data-i18n="homeAskLabel">Search your history</label>
        <p id="home-ask-help" class="help" data-i18n="homeAskHelp">Answers are composed from what is already on this computer. Nothing is sent anywhere.</p>
        <input id="home-ask" name="q" required aria-describedby="home-ask-help home-ask-error" autocomplete="off">
        <button type="submit" data-i18n="homeAskSubmit">Search</button>
        <p id="home-ask-error" class="error" role="alert"></p>
      </form>
      <div id="home-answer">
        <h3 id="home-answer-heading" tabindex="-1" data-i18n="homeAnswerHeading" hidden>What I found</h3>
        <div id="home-answer-status" class="inline-status" role="status" aria-live="polite"></div>
        <div id="home-answer-results" data-i18n-label="homeAnswerHeading" aria-label="What I found"></div>
      </div>
      <div id="home-restart" hidden>
        <h3 id="home-restart-heading" tabindex="-1" data-i18n="restartTitle">Carry this to another assistant</h3>
        <p class="help" data-i18n="homeRestartHelp">Composed from what is already stored. It is never saved and never leaves this computer.</p>
        <button type="button" id="home-restart-prepare" data-i18n="restartPrepare">Prepare the summary</button>
        <div id="home-restart-status" class="inline-status" role="status" aria-live="polite"></div>
        <pre id="home-restart-text"></pre>
        <button type="button" id="home-restart-copy" data-i18n="restartCopy" hidden>Copy the summary</button>
        <p id="home-restart-omissions" class="help"></p>
        <p id="home-restart-error" class="error" role="alert"></p>
      </div>
      <div id="home-empty" hidden>
        <p><strong data-i18n="homeEmpty">Nothing here yet.</strong></p>
        <p data-i18n="homeEmptyDetail">Write a question below and it is kept, or add a project to bring in the sessions you have already had.</p>
      </div>
    </section>
    <section aria-labelledby="technical-heading" id="technical">
      <h2 id="technical-heading" tabindex="-1" data-i18n="homeTechnicalHeading">Technical view</h2>
      <p data-i18n="homeTechnicalIntro">Provenance, integrity checks, exact states and the original vocabulary. Some of these screens are still in their old shape and are being rebuilt.</p>
      <nav class="technical-nav" data-i18n-label="homeTechnicalHeading" aria-label="Technical view">
        <a href="#/dashboard" data-i18n="navDashboard">Dashboard</a>
        <a href="#/evidence" data-i18n="navEvidence">Evidence</a>
        <a href="#/memory" data-i18n="navMemory">Active memory</a>
        <a href="#/work" data-i18n="navContinuity">Work &amp; handoffs</a>
        <a href="#/privacy" data-i18n="navPrivacy">Privacy</a>
        <a href="#/system" data-i18n="navSystem">System status</a>
        <a href="#/scripts" data-i18n="navScripts">Scripts</a>
      </nav>
    </section>`;
