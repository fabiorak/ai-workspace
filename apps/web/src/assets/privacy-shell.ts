/**
 * The ordinary privacy-preparation surface decided by ADR-0034.
 *
 * Exact hashes and UTF-8 coordinates remain protocol details. The reader names
 * known aliases, reviews proposals over the source text, can add a missed span,
 * and sees the transformed text. The older diagnostic forms remain in the
 * technical Context Pack section until their own redesign, but this is the
 * route people enter.
 */
export const PRIVACY_SECTION = `
    <section aria-labelledby="privacy-heading" id="privacy">
      <h2 id="privacy-heading" tabindex="-1" data-i18n="privacyGuideHeading">Protect what may leave this computer</h2>
      <p data-i18n="privacyGuideIntro">AI Workspace prepares the protected version. You review words, not byte coordinates or hashes. Nothing is sent or executed here.</p>
      <p class="notice"><span data-i18n="privacyNeedsWork">First choose a project, an active work item, and one handoff to protect.</span> <a href="#/work" data-i18n="privacyGoWork">Choose the work</a></p>

      <h3 data-i18n="privacyProposalHeading">Prepare the proposal</h3>
      <p class="help" data-i18n="privacyProposalHelp">Known customer and project names are matched exactly. You can remove any proposal or select missed text before creating the protected local version.</p>
      <form id="privacy-proposal-form">
        <label for="privacy-customer-aliases" data-i18n="privacyCustomerNames">Customer names to protect, one per line</label>
        <textarea id="privacy-customer-aliases" spellcheck="false"></textarea>
        <label for="privacy-project-aliases" data-i18n="privacyProjectNames">Other project names to protect, one per line</label>
        <textarea id="privacy-project-aliases" spellcheck="false"></textarea>
        <details id="privacy-proposal-sources">
          <summary data-i18n="privacyTechnicalSources">Reviewed local sources</summary>
          <p class="help" data-i18n="privacyTechnicalSourcesHelp">These files determine what enters the protected text. They stay local and are not model execution settings.</p>
          <label for="privacy-proposal-profile" data-i18n="privacyProfilePath">Reviewed agent profile file</label>
          <input id="privacy-proposal-profile" required autocomplete="off" spellcheck="false">
          <label for="privacy-proposal-policy" data-i18n="privacyGuidePolicyPath">Reviewed model privacy policy file</label>
          <input id="privacy-proposal-policy" required autocomplete="off" spellcheck="false">
          <label for="privacy-proposal-bundles" data-i18n="privacyBundles">Reviewed instruction files declared by the profile, one per line</label>
          <textarea id="privacy-proposal-bundles" required spellcheck="false"></textarea>
          <label for="privacy-proposal-model" data-i18n="privacyModel">Model named by the policy</label>
          <input id="privacy-proposal-model" required autocomplete="off">
          <label for="privacy-proposal-task" data-i18n="privacyTask">Task name, when the profile requires one</label>
          <input id="privacy-proposal-task" autocomplete="off">
        </details>
        <button type="submit" data-i18n="privacyProposalSubmit">Prepare protected-text proposal</button>
      </form>
      <div id="privacy-proposal-status" class="inline-status" role="status" aria-live="polite" data-i18n="privacyProposalIdle">Choose the work and provide the reviewed local files.</div>
      <p id="privacy-proposal-error" class="error" role="alert"></p>

      <div id="privacy-proposal-review" hidden>
        <h3 id="privacy-proposal-review-heading" tabindex="-1" data-i18n="privacyReviewHeading">Review the proposed substitutions</h3>
        <p class="help" data-i18n="privacyReviewHelp">Every proposal is applied. Clear one to keep those words, or select text in an item and add a missed substitution.</p>
        <ol id="privacy-proposal-selections" tabindex="-1"></ol>
        <div id="privacy-proposal-items"></div>
        <form id="privacy-review-form" hidden>
          <label for="privacy-passphrase" data-i18n="privacyPassphrase">Passphrase protecting the local recovery mapping</label>
          <input id="privacy-passphrase" type="password" required minlength="16" maxlength="1024" autocomplete="new-password" spellcheck="false">
          <button type="submit" data-i18n="privacyCreateProtected">Create the protected version locally</button>
        </form>
      </div>

      <div id="privacy-transformed" hidden>
        <h3 id="privacy-transformed-heading" tabindex="-1" data-i18n="privacyTransformedHeading">Protected text</h3>
        <p id="privacy-coverage" class="notice" data-i18n="privacyCoverage" hidden>This proposal can miss personal or secret data. Review the complete text before it is ever sent.</p>
        <div id="privacy-transformed-items"></div>
        <details>
          <summary data-i18n="privacyMappingDetails">Local recovery details</summary>
          <p id="privacy-mapping-result" class="help"></p>
        </details>
      </div>
      <p id="privacy-review-error" class="error" role="alert"></p>
    </section>`;
