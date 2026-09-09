export const CONTINUATION_BLOCK = `
<button type="button" id="continuation-open" data-i18n="continueOpen" hidden>Continue with another assistant</button>
<div id="continuation-panel" class="result-card" role="region" aria-labelledby="continuation-heading" hidden>
  <h4 id="continuation-heading" tabindex="-1" data-i18n="continueHeading">Prepare the continuation</h4>
  <p class="help" data-i18n="continueLocal">Local preparation. Nothing is sent. Sending and saving the assistant's answer are not available yet.</p>
  <div id="continuation-status" role="status" aria-live="polite"></div>
  <p id="continuation-changed" class="notice" data-i18n="continueChanged" hidden></p>
  <p id="continuation-omitted" class="notice" data-i18n="continueOmitted" hidden></p>
  <button type="button" id="continuation-back" data-i18n="continueBack">Back to the summary</button>
  <details id="continuation-setup"><summary data-i18n="continueSetup">Set up the recipient</summary>
    <p data-i18n="continueSetupHelp"></p>
    <form id="continuation-configure">
      <label for="continuation-label" data-i18n="continueLabel">Recipient name</label><input id="continuation-label" required maxlength="120">
      <label for="continuation-model" data-i18n="continueModel">Model identifier</label><input id="continuation-model" required maxlength="256">
      <label for="continuation-profile" data-i18n="continueProfile">Reviewed profile file</label><input id="continuation-profile" required autocomplete="off">
      <label for="continuation-policy" data-i18n="continuePolicy">Reviewed privacy policy file</label><input id="continuation-policy" required autocomplete="off">
      <label for="continuation-instructions" data-i18n="continueInstructions">Reviewed instruction files, one per line</label><textarea id="continuation-instructions" required></textarea>
      <label for="continuation-task" data-i18n="continueTask">Task name, if required by the profile</label><input id="continuation-task">
      <button type="submit" data-i18n="continueConfigure">Use these local settings</button>
    </form>
  </details>
  <form id="continuation-propose">
    <label for="continuation-question" data-i18n="continueQuestion">What would you like to ask next?</label><textarea id="continuation-question" required maxlength="8192" rows="4"></textarea>
    <label for="continuation-names" data-i18n="continueNames">Names to protect, one per line</label><textarea id="continuation-names"></textarea>
    <button type="submit" data-i18n="continuePrepare">Prepare the privacy review</button>
  </form>
  <div id="continuation-review" hidden>
    <h5 tabindex="-1" id="continuation-review-heading" data-i18n="continueReview">Review the text and substitutions</h5>
    <p data-i18n="continueLimit"></p>
    <div id="continuation-items"></div><div id="continuation-suggestions"></div>
    <label for="continuation-passphrase" data-i18n="continuePassphrase">Passphrase for restoring protected names (required when replacing words)</label><input id="continuation-passphrase" type="password" autocomplete="new-password">
    <button type="button" id="continuation-protect" data-i18n="continueProtect">Create the protected local version</button>
  </div>
  <div id="continuation-final" hidden><label for="continuation-text" data-i18n="continuePreview">Exact prepared text</label><textarea id="continuation-text" readonly rows="16"></textarea></div>
  <div id="continuation-delivery" hidden><p data-i18n="continueSendLimits"></p><button type="button" id="continuation-send" data-i18n="continueSend">Confirm and send once</button></div>
  <div id="continuation-response" hidden><label for="continuation-response-text" data-i18n="continueResponse">Saved response</label><textarea id="continuation-response-text" readonly rows="12"></textarea></div>
  <p id="continuation-error" class="error" role="alert"></p>
</div>`;
