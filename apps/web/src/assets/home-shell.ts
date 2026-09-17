import { RESTART_POINT_BLOCK } from "./restart-point-shell.ts";

/**
 * The primary navigation follows the approved conversation mockup. Search has a
 * dedicated destination and never occupies the message composer.
 */
export const HOME_SIDEBAR = `
      <button id="home-new-conversation" class="new-conversation" type="button" data-i18n="homeNewConversation">New chat</button>
      <a class="conversation-search-link" href="#/history" data-route="history"><span aria-hidden="true">⌕</span><span data-i18n="homeSearchNavigation">Search history</span></a>
      <nav class="conversation-nav" data-i18n-label="homeListLabel" aria-label="Your conversations">
        <p class="nav-label" data-i18n="homeListLabel">Your conversations</p>
        <div id="conversation-status" class="inline-status" role="status" aria-live="polite" data-i18n="homeLoading">Reading your work...</div>
        <div id="conversation-groups"></div>
        <p id="conversation-count" class="help"></p>
      </nav>
      <nav class="primary-nav" data-i18n-label="navLabel" aria-label="Workspace">
        <a href="#/projects" data-route="projects"><span aria-hidden="true">◇</span><span data-i18n="navProjects">Projects</span></a>
        <a href="#/settings" data-route="settings"><span aria-hidden="true">⚙</span><span data-i18n="navSettings">Settings</span></a>
        <a href="#/technical" data-route="technical"><span aria-hidden="true">⌗</span><span data-i18n="homeTechnicalHeading">Technical view</span></a>
      </nav>`;

/** The ordinary conversation surface. No model or network capability lives here. */
export const HOME_SECTION = `
    <section aria-labelledby="home-heading" id="home" class="conversation-page">
      <h2 id="home-heading" class="visually-hidden" tabindex="-1" data-i18n="navHome">Conversations</h2>
      <div id="home-empty" class="conversation-empty" hidden>
        <p><strong data-i18n="homeEmpty">Nothing here yet.</strong></p>
        <p data-i18n="homeEmptyDetail">Start a new chat or add a project to bring in conversations you already had.</p>
      </div>
      <div id="home-conversation-status" class="inline-status conversation-opening" role="status" aria-live="polite"></div>
      <div id="home-conversation" class="conversation-workspace" hidden>
        <header class="conversation-header">
          <div>
            <p id="home-conversation-meta" class="conversation-project"></p>
            <h2 id="home-conversation-heading" tabindex="-1"></h2>
          </div>
          <div class="conversation-actions">
            <label class="visually-hidden" for="home-conversation-model" data-i18n="homeModelLabel">Model for the next message</label>
            <select id="home-conversation-model" data-i18n-label="homeModelLabel" aria-label="Model for the next message">
              <option value="" data-i18n="modelTargetChoose">Choose a configured model</option>
            </select>
            <button type="button" id="home-context-open" class="panel-button" aria-expanded="false" aria-controls="home-conversation-panel" data-i18n="homeContextOpen">Context</button>
          </div>
        </header>
        <ol id="home-conversation-moments" class="moments conversation-feed moments-scroll" tabindex="0" data-i18n-label="homeConversationMomentsLabel" aria-label="The messages in this conversation"></ol>
        <p id="home-conversation-count" class="help conversation-count"></p>
        <form id="home-composer" class="conversation-composer">
          <div class="composer-box">
            <label class="visually-hidden" for="home-message" data-i18n="homeMessageLabel">Write a message</label>
            <textarea id="home-message" rows="2" data-i18n-label="homeMessageLabel" data-i18n-placeholder="homeMessagePlaceholder" aria-label="Write a message" placeholder="Write a message..." aria-describedby="home-composer-status home-composer-error"></textarea>
            <div class="composer-actions">
              <button type="button" id="home-protection-preview-toggle" class="panel-button" aria-expanded="false" aria-controls="home-protection-preview" data-i18n="homeProtectionPreviewAction">Show protections</button>
              <button type="submit" id="home-send" class="send-button" disabled data-i18n="homeSend">Send</button>
            </div>
          </div>
          <div id="home-protection-preview" class="protection-preview composer-protection-preview" hidden>
            <p data-i18n="homeProtectionPreviewIntro">Check the current draft locally before sending. Nothing is sent.</p>
            <p id="home-protection-preview-status" role="status" aria-live="polite"></p>
            <p id="home-protection-preview-output" class="protection-preview-output"></p>
            <button type="button" id="home-protection-manage" class="panel-button" aria-expanded="false" aria-controls="home-conversation-panel" data-i18n="homeProtectionPreviewManage">Manage protected terms</button>
          </div>
          <p id="home-composer-status" class="help composer-status" role="status" aria-live="polite" data-i18n="homeTurnReady">Context updated. Ready to send one coordinated turn.</p>
          <p id="home-composer-error" class="error" role="alert"></p>
        </form>
        <aside id="home-conversation-panel" class="conversation-panel" hidden aria-labelledby="home-panel-heading">
          <div class="conversation-panel-header">
            <h3 id="home-panel-heading" tabindex="-1"></h3>
            <button type="button" id="home-panel-close" data-i18n-label="homePanelClose" aria-label="Close details">×</button>
          </div>
          <div id="home-panel-body"></div>
        </aside>
        <div class="legacy-continuation" hidden>
          <button type="button" id="home-conversation-close" data-i18n="homeConversationClose">Close this conversation</button>
          ${RESTART_POINT_BLOCK}
        </div>
      </div>
    </section>`;

/** Existing lexical search remains available, now as a separate destination. */
export const HOME_SEARCH_SECTION = `
    <section aria-labelledby="history-search-heading" id="history-search">
      <h2 id="history-search-heading" tabindex="-1" data-i18n="homeSearchHeading">Search history</h2>
      <p data-i18n="homeSearchIntro">Search conversations and notes already stored on this computer.</p>
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
