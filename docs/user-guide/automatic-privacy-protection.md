# Automatic privacy protection

The ordinary conversation flow protects supported personal-data patterns before
the configured transport receives a turn. It maintains one encrypted stable map
for each project and a separate map for General, so the same value and type reuse
the same readable placeholder across turns, model changes, and application
restarts. Provider output is restored locally with an all-or-nothing check before
it is saved.

The built-in deterministic detector currently recognizes email addresses, phone
numbers, Italian tax and VAT identifiers, and IBAN-like values. Previously known
values in the stable map are also replaced. Detection is best effort, not proof
that a message contains no personal or confidential data. Restricted-secret
screening and model policy checks remain separate boundaries.

It does not recognize a person name, a company name or an address. Those are
protected only once you name the value yourself, as described below.

## Preview the current draft

For an existing conversation, write the message and open **Automatic
protection** before sending. Select **Preview this draft** to see the local
protected form. Placeholders such as `[[EMAIL_1]]` are highlighted, the number
of replacements is stated, and unchanged text remains visible so you can decide
whether to add a term the detector missed.

The preview is optional. It sends nothing, composes no conversation context and
records no delivery audit event. It uses and may extend the same encrypted
stable map as the later turn, so the placeholders shown in the preview are
reused when the message is sent. A brand-new chat has no durable conversation
scope until its first message; preview is available before subsequent messages.

## Protect a value the detector does not find

Open **Automatic protection** beside the composer, write the value in
**Also protect this value**, choose the kind of data, and select **Protect it**.
From the next message the value leaves as a readable placeholder, such as
`[[AZIENDA_1]]`, and comes back as itself in the answer.

The value joins the stable map of the conversation's project, or the separate
General map, and stays there across model changes and restarts. Adding the same
value again reports the placeholder it already has instead of allocating a
second one. The same value cannot be recorded as two kinds of data: change the
value, or keep the kind it already has.

The browser sends the value and its kind and nothing else. The server decides
which map owns it, and never returns the key, the map, an original value or a
local path. A value shorter than two characters, longer than 256 bytes, shaped
like a placeholder or containing control characters is refused, and nothing is
written.

Routine messages require no passphrase, manual name list, mandatory preview, or
separate confirmation. Open **Automatic protection** beside the composer to
preview the current draft, add a reviewed term, see a short explanation and read
the number of replacements in the last completed message. Open **Settings** to
inspect whether protection is active and to read its residual threat.

The application stores the random mapping key and encrypted map in separate local
files with restrictive permissions. This prevents accidental plaintext exposure
and detects corruption, but it does not protect against a process or operating
system account that can read the complete `AI_WORKSPACE_HOME` directory.

## Import an earlier mapping

Settings shows a migration form only when passphrase-protected legacy custody
records exist. Enter the exact earlier mapping identity and its passphrase. A
successful import:

- derives the destination project from the authenticated legacy mapping;
- adds the reviewed original values to that project's stable map;
- verifies restoration before and after the atomic save;
- clears the passphrase field; and
- preserves the legacy custody envelope and encrypted mapping unchanged.

A wrong passphrase, corrupt state, unsafe permissions, conflicting value type, or
unknown response placeholder fails closed. Legacy files are never removed by
migration; deletion requires a separate future explicit operation.
