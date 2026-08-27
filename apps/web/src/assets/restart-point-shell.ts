/**
 * The restart point's markup, at the end of the open conversation.
 *
 * ADR-0037 says it is shown expanded rather than collapsed, so there is no control
 * to open it and none to close it: it is either composed for this conversation or it
 * says why it is not. Its own status region is polite, because it recomposes while
 * the reader is still reading the conversation above it.
 *
 * It is a labelled region rather than a `<section>` on purpose: the routing rule in
 * the client hides and shows the direct `<section>` children of `main`, and a nested
 * one inside a conversation would read as a page of its own to that rule.
 */
export const RESTART_POINT_BLOCK = `
        <div id="restart-point" class="result-card" role="region" aria-labelledby="restart-point-heading" hidden>
          <h4 id="restart-point-heading" data-i18n="pointHeading">To pick this up again</h4>
          <p class="help" data-i18n="pointHelp">Composed just now from what is already stored here. It is not saved, and it does not leave this computer.</p>
          <div id="restart-point-status" class="inline-status" role="status" aria-live="polite"></div>
          <div id="restart-point-body"></div>
          <div id="restart-point-omissions" class="help"></div>
          <p id="restart-point-error" class="error" role="alert"></p>
        </div>`;
