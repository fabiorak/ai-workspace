# Synthetic conversation GUI check

This check uses a temporary home and invented content. It exercises the ordinary
conversation turn with the local simulated transport; no provider is enabled in
the GUI.

The earlier "Continue with another assistant" panel is gone. Its manual name
list, passphrase, exact-text preview and separate confirmation were replaced by
one message and one **Send**. Steps that referred to those controls no longer
apply; see the migration window below for what remains behind the HTTP API.

1. From the repository root, run `npm run build`, then
   `npm run demo:continuation-journey`. It starts the server in a new synthetic
   home, configures the simulated recipient, and prints a one-time URL.
2. Open the printed URL and select the imported conversation. The most recent
   messages are shown without scrolling the page.
3. Check the header: the conversation title, its project, and the model selector
   for the next message. Changing the model must not change the conversation.
4. Open **Automatic protection** beside the composer. With an email or telephone
   in the draft, select **Preview this draft**. Check that the outgoing form is
   shown locally with highlighted placeholders and that nothing has been sent.
5. Write `Synthetic Customer`
   in **Also protect this value**, choose **Customer**, and select **Protect it**.
   The panel reports the placeholder that value now has.
6. Close the panel and write `Ask Synthetic Customer which failure to inspect
next.` in the composer. Send it with the button or with `Ctrl+Enter`.
7. Check that the answer appears below your message without scrolling, that it
   begins `SIMULATED RESPONSE`, that it says no model was called, and that
   `Synthetic Customer` is restored in the visible text.
8. Reopen **Automatic protection** and check the number of replacements in the
   last message.
9. Switch from **Demo A** to **Demo B**, write and send a second message, and
   check that the previous answer remains in the same conversation and that the
   new answer is attributed to Demo B.
10. Select **Demo esito incerto** and send an invented message. Check that the
    interface says the outcome is unknown, clears the draft and starts no retry.
    Return to Demo A or Demo B before continuing.
11. Write another message and check that the previous answer is part of the
    conversation. Reopen the conversation and check that both moments are kept.
12. Repeat the labels and navigation check after switching language in Settings.
    Use Tab, Enter and Escape to check that the composer, the model selector and
    the panel remain reachable and that Escape returns focus.
13. At 200% zoom the desktop sidebar intentionally becomes the mobile menu.
    Check that the menu button opens **Your conversations**, rather than expecting
    the sidebar to remain fixed beside the conversation.
14. Stop the server with Ctrl+C. The temporary home is deliberately retained for
    investigation; rerunning the demo creates another isolated home.

Report the step number and what differed from the expected result. No real
transcript, account, key or paid request is needed for this check. Seeing an
answer alone does not establish continuity quality: the automated quality report
separately records whether critical source evidence reaches the request.

## Legacy continuation API migration window

The conversation screen no longer serves any continuation control, and the
browser no longer ships its behaviour. The HTTP routes under
`/api/conversations/:id/continuation` and the workflow behind them are retained
for one documented migration window, so an existing local integration keeps
working while it moves to `POST /api/conversations/:id/turn`.

Within that window the legacy routes are API-only: they are not reachable from
the GUI, they gain no new capability, and they keep their own passphrase-based
mapping custody. New work uses the conversation turn, the app-managed key and
the reviewed-term route `POST /api/conversations/:id/protected-terms`. Removing
the legacy routes is a separate, explicit change.
