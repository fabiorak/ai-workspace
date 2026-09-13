# Synthetic continuation GUI check

This check uses a temporary home and invented content. It exercises the current
local preview; provider delivery is not enabled in the GUI.

1. From the repository root, run `npm run build`, then
   `npm run demo:continuation`.
2. Copy and run the exact `start` command printed by the demo. It sets
   `AI_WORKSPACE_HOME` to the temporary home. Keep that terminal open.
3. Open the one-time loopback URL printed by the server. Open the imported
   conversation titled "Add a fictional greeting and verify it.".
4. Read the work summary and open its kept snapshot. Check that the snapshot
   date and the recorded next action are understandable.
5. Choose "Continue with another assistant" (or the equivalent Italian label).
   Open recipient setup. Enter "Synthetic assistant" as the recipient name,
   the printed `model`, the `profile.path`, the `policy.path`, and each of the
   three `bundles[].path` values on a separate instruction-file line. Leave
   the optional task empty. Apply these settings.
6. Ask "Ask Synthetic Customer which failure to inspect next.". Enter
   "Synthetic Customer" in the names field and prepare the review.
7. Select the proposed customer-name substitutions. Enter a synthetic
   passphrase of at least four words and create the protected version.
   Check that the original name is absent from the final text. This is the
   current end of the GUI path; a provider response is not expected.
8. Repeat the labels/navigation check after switching language in Settings.
   Use Tab and Enter to check that the controls remain reachable.
9. Stop the server with Ctrl+C. The temporary home is deliberately retained
   for investigation; rerunning the demo creates another isolated home.

Report the step number and what differed from the expected result. No real
transcript, account, key or paid request is needed for this check. The automated
quality report separately records whether critical source evidence reaches the
proposal; seeing a preview alone does not establish continuity quality.

## Complete journey with a simulated response

Run `npm run build`, then `npm run demo:continuation-journey`. This starts the
server in a new synthetic home and prints its one-time URL and configuration
paths. The simulated recipient is already configured. Follow steps 3-7 above,
skipping recipient setup in step 5; do not reuse paths from an earlier demo. After the protected preview, choose "Confirm and send once". The passphrase entered during review remains only in memory for this request. The reply visibly begins "SIMULATED RESPONSE"
and says that no model was called. Check that the original customer name has
been restored in the saved response.

Write a second question and prepare another privacy review. Check that the prior
simulated answer appears in the current linked-session evidence. Reopen the
conversation to see its added assistant moment. Each new question requires its
own review and confirmation. The normal `npm run gui` startup still has no
transport enabled. Ctrl+C stops the demo server; its temporary home is retained.
