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
 *
 * The draft of what to do next is a field rather than a paragraph because it exists
 * to be revised: ADR-0037 prefills it from local text the person already wrote and
 * requires the review obligation to stay visible, which a sentence beside an
 * editable field says better than a read-only line would.
 *
 * The summary already kept is the one part here that does open and close. Two
 * summaries visible at once is the risk of this screen, so the photograph is asked
 * for, carries its date in its own heading, and is a nested labelled region of its
 * own: the composed summary stays what ADR-0037 made it, always open and speaking in
 * the present.
 */
export const RESTART_POINT_BLOCK = `
        <div id="restart-point" class="result-card" role="region" aria-labelledby="restart-point-heading" hidden>
          <h4 id="restart-point-heading" data-i18n="pointHeading">To pick this up again</h4>
          <p class="help" data-i18n="pointHelp">Composed just now from what is already stored here. It is not saved, and it does not leave this computer.</p>
          <div id="restart-point-status" class="inline-status" role="status" aria-live="polite"></div>
          <div id="restart-point-body"></div>
          <div id="restart-point-omissions" class="help"></div>
          <div id="restart-point-start" hidden>
            <label for="restart-point-objective" data-i18n="startObjective">What is this work</label>
            <p id="restart-point-start-help" class="help" data-i18n="startHelp">Written by you, in your own words. It will cite the most recent moments of this conversation, the ones shown above.</p>
            <textarea id="restart-point-objective" rows="2" aria-describedby="restart-point-start-help"></textarea>
            <button type="button" id="restart-point-start-button" data-i18n="startButton">Declare this work</button>
            <p id="restart-point-start-effect" class="effect" data-i18n="startEffect">Effect: creates the work and marks it as in progress. Nothing is sent anywhere.</p>
            <div id="restart-point-start-status" class="inline-status" role="status" aria-live="polite"></div>
          </div>
          <div id="restart-point-draft" hidden>
            <label for="restart-point-next" data-i18n="pointNextAction">What to do next</label>
            <p id="restart-point-draft-review" class="help" data-i18n="pointDraftReview">A draft, put together from what you already wrote. Read it and change it as you like: nothing is saved.</p>
            <textarea id="restart-point-next" rows="4" aria-describedby="restart-point-draft-review restart-point-draft-source"></textarea>
            <p id="restart-point-draft-source" class="help"></p>
            <label for="restart-point-test-command" data-i18n="pointTestCommand">Test command</label>
            <input id="restart-point-test-command" type="text" aria-describedby="restart-point-tests-optional">
            <label for="restart-point-test-outcome" data-i18n="pointTestOutcome">How it went</label>
            <select id="restart-point-test-outcome" aria-describedby="restart-point-tests-optional">
              <option value="" data-i18n="pointTestOutcomeNone">not stated</option>
              <option value="passed" data-i18n="pointTestPassed">passed</option>
              <option value="failed" data-i18n="pointTestFailed">failed</option>
              <option value="not-run" data-i18n="pointTestNotRun">not run</option>
            </select>
            <label for="restart-point-test-at" data-i18n="pointTestWhen">When it ran</label>
            <input id="restart-point-test-at" type="datetime-local" aria-describedby="restart-point-tests-optional">
            <p id="restart-point-tests-optional" class="help" data-i18n="pointTestsOptional">Optional. Left empty, nothing about the tests is recorded — and nothing is guessed either.</p>
            <p id="restart-point-follows" class="help"></p>
            <button type="button" id="restart-point-fix" data-i18n="pointFix">Keep this summary</button>
            <p id="restart-point-fix-effect" class="effect" data-i18n="pointFixEffect">Effect: writes one summary that is never changed again. Everything else on this screen stays as it is.</p>
            <div id="restart-point-fix-status" class="inline-status" role="status" aria-live="polite"></div>
          </div>
          <button type="button" id="restart-point-kept-toggle" aria-expanded="false" aria-controls="restart-point-kept" hidden></button>
          <div id="restart-point-kept" class="result-card" role="region" aria-labelledby="restart-point-kept-heading" hidden>
            <h5 id="restart-point-kept-heading"></h5>
            <p class="help" data-i18n="keptHelp">How things stood that day, as it was kept. It never changes, and it is not the state of now.</p>
            <div id="restart-point-kept-status" class="inline-status" role="status" aria-live="polite"></div>
            <div id="restart-point-kept-body"></div>
            <div id="restart-point-kept-omissions" class="help"></div>
          </div>
          <p id="restart-point-error" class="error" role="alert"></p>
        </div>`;
