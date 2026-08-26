/**
 * Browser behaviour for ADR-0034's proposal-first privacy preparation.
 *
 * This fragment runs inside the one served IIFE and deliberately uses only the
 * DOM, Web Crypto, and helpers declared by `client.ts`. Exact spans are derived
 * from reviewed text selection and never shown as a form field.
 */
export const PRIVACY_BEHAVIOUR = `
  const privacyProposalForm = document.getElementById("privacy-proposal-form");
  const privacyProposalStatus = document.getElementById("privacy-proposal-status");
  const privacyProposalError = document.getElementById("privacy-proposal-error");
  const privacyReviewError = document.getElementById("privacy-review-error");
  const privacyProposalReview = document.getElementById("privacy-proposal-review");
  const privacyReviewForm = document.getElementById("privacy-review-form");
  const privacySelectionsList = document.getElementById("privacy-proposal-selections");
  const privacyItemsContainer = document.getElementById("privacy-proposal-items");
  const privacyTransformed = document.getElementById("privacy-transformed");
  const privacyTransformedItems = document.getElementById("privacy-transformed-items");
  const privacyEncoder = new TextEncoder();
  const privacyDecoder = new TextDecoder("utf-8", { fatal: true });
  const privacyEntityTypes = ["PERSON", "CUSTOMER", "EMAIL", "BUSINESS_IDENTIFIER", "PROJECT", "OTHER"];
  let privacyRequest = null;
  let privacyItems = new Map();
  let privacySelections = [];

  const privacyLines = (id) => document.getElementById(id).value
    .split(/\\r?\\n/u)
    .map((value) => value.trim())
    .filter(Boolean);

  const privacyCommonInput = () => {
    const task = document.getElementById("privacy-proposal-task").value.trim();
    return {
      profile: { path: document.getElementById("privacy-proposal-profile").value.trim() },
      policy: { path: document.getElementById("privacy-proposal-policy").value.trim() },
      bundles: privacyLines("privacy-proposal-bundles").map((path) => ({ path })),
      model: document.getElementById("privacy-proposal-model").value.trim(),
      ...(task ? { task } : {}),
    };
  };

  const privacyDigest = async (content) => {
    const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", privacyEncoder.encode(content)));
    return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
  };

  const privacySample = (selection) => {
    const item = privacyItems.get(selection.itemId);
    if (!item) return "";
    const bytes = privacyEncoder.encode(item.content);
    return privacyDecoder.decode(bytes.slice(selection.byteStart, selection.byteEnd));
  };

  const privacyAppliedSelections = () => privacySelections.filter((selection) => selection.enabled);

  const privacyOverlaps = (left, right) =>
    left.itemId === right.itemId &&
    left.byteStart < right.byteEnd &&
    left.byteEnd > right.byteStart;

  const privacyUnicodeRange = (content, start, end) => {
    let safeStart = start;
    let safeEnd = end;
    if (safeStart > 0 && safeStart < content.length &&
      /[\\uD800-\\uDBFF]/u.test(content[safeStart - 1]) && /[\\uDC00-\\uDFFF]/u.test(content[safeStart])) {
      safeStart -= 1;
    }
    if (safeEnd > 0 && safeEnd < content.length &&
      /[\\uD800-\\uDBFF]/u.test(content[safeEnd - 1]) && /[\\uDC00-\\uDFFF]/u.test(content[safeEnd])) {
      safeEnd += 1;
    }
    return { start: safeStart, end: safeEnd };
  };

  const renderPrivacySelections = () => {
    privacySelectionsList.replaceChildren();
    privacySelections.forEach((selection, index) => {
      const item = document.createElement("li");
      const label = document.createElement("label");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = selection.enabled;
      checkbox.addEventListener("change", () => {
        if (checkbox.checked && privacyAppliedSelections().some((candidate) =>
          candidate !== selection && privacyOverlaps(candidate, selection))) {
          checkbox.checked = false;
          say(privacyReviewError, "privacyManualOverlap");
          return;
        }
        text(privacyReviewError, "");
        selection.enabled = checkbox.checked;
      });
      const description = document.createElement("span");
      say(description, "privacyProposalSelection", {
        origin: message(selection.origin === "PROPOSED" ? "privacyOriginProposed" : "privacyOriginManual"),
        type: message("privacyType" + selection.entityType),
        text: privacySample(selection),
        item: String(selection.itemNumber),
      });
      label.append(checkbox, document.createTextNode(" "), description);
      item.append(label);
      privacySelectionsList.append(item);
      selection.index = index;
    });
  };

  const addPrivacySelection = async (item, itemNumber, textarea, select) => {
    text(privacyReviewError, "");
    const selectedStart = Math.min(textarea.selectionStart, textarea.selectionEnd);
    const selectedEnd = Math.max(textarea.selectionStart, textarea.selectionEnd);
    if (selectedStart === selectedEnd) {
      say(privacyReviewError, "privacySelectText");
      textarea.focus();
      return;
    }
    const { start, end } = privacyUnicodeRange(item.content, selectedStart, selectedEnd);
    const byteStart = privacyEncoder.encode(item.content.slice(0, start)).byteLength;
    const byteEnd = privacyEncoder.encode(item.content.slice(0, end)).byteLength;
    const candidate = { itemId: item.id, byteStart, byteEnd };
    if (privacyAppliedSelections().some((selection) => privacyOverlaps(selection, candidate))) {
      say(privacyReviewError, "privacyManualOverlap");
      textarea.focus();
      return;
    }
    privacySelections.push({
      itemId: item.id,
      itemNumber,
      contentSha256: await privacyDigest(item.content),
      byteStart,
      byteEnd,
      entityType: select.value,
      origin: "MANUAL",
      enabled: true,
    });
    renderPrivacySelections();
    privacySelectionsList.focus();
  };

  const renderPrivacyItems = (items) => {
    privacyItemsContainer.replaceChildren();
    items.forEach((item, index) => {
      const itemNumber = index + 1;
      const article = document.createElement("article");
      article.className = "work-card";
      const heading = document.createElement("h4");
      say(heading, "privacyItemHeading", { item: String(itemNumber) });
      const details = document.createElement("details");
      const summary = document.createElement("summary");
      say(summary, "privacyItemSource");
      const source = document.createElement("code");
      text(source, item.id);
      details.append(summary, source);
      const textarea = document.createElement("textarea");
      textarea.readOnly = true;
      textarea.rows = Math.min(12, Math.max(4, item.content.split(/\\r?\\n/u).length + 1));
      textarea.value = item.content;
      textarea.setAttribute("aria-label", message("privacyOriginalText", { item: String(itemNumber) }));
      const label = document.createElement("label");
      const selectId = "privacy-manual-type-" + itemNumber;
      label.htmlFor = selectId;
      say(label, "privacyManualType");
      const select = document.createElement("select");
      select.id = selectId;
      privacyEntityTypes.forEach((entityType) => {
        const option = document.createElement("option");
        option.value = entityType;
        say(option, "privacyType" + entityType);
        select.append(option);
      });
      const add = document.createElement("button");
      add.type = "button";
      say(add, "privacyAddSelection");
      add.addEventListener("click", () => {
        void addPrivacySelection(item, itemNumber, textarea, select);
      });
      article.append(heading, details, textarea, label, select, add);
      privacyItemsContainer.append(article);
    });
  };

  privacyProposalForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    text(privacyProposalError, "");
    text(privacyReviewError, "");
    privacyProposalReview.hidden = true;
    privacyReviewForm.hidden = true;
    privacyTransformed.hidden = true;
    privacySelections = [];
    privacyItems = new Map();
    if (!selectedProject || !selectedWork || !selectedHandoff) {
      say(privacyProposalError, "privacyNeedsHandoff");
      return;
    }
    privacyRequest = privacyCommonInput();
    const declaredDictionary = [
      ...privacyLines("privacy-customer-aliases").map((alias) => ({ entityType: "CUSTOMER", alias })),
      ...privacyLines("privacy-project-aliases").map((alias) => ({ entityType: "PROJECT", alias })),
    ];
    say(privacyProposalStatus, "privacyProposalPreparing");
    try {
      const projects = await api("/api/projects");
      const project = projects.find((candidate) => candidate.id === selectedProject);
      const dictionary = [
        ...(project?.name ? [{ entityType: "PROJECT", alias: project.name }] : []),
        ...declaredDictionary,
      ];
      const uniqueDictionary = [...new Map(
        dictionary.map((entry) => [entry.entityType + "\\u0000" + entry.alias, entry]),
      ).values()];
      const base = workPath() + "/" + encodeURIComponent(selectedWork) + "/handoffs/" + encodeURIComponent(selectedHandoff);
      const contextPromise = api(base + "/profile-context/preview", {
        method: "POST",
        body: JSON.stringify({
          profile: privacyRequest.profile,
          bundles: privacyRequest.bundles,
          model: privacyRequest.model,
          ...(privacyRequest.task ? { task: privacyRequest.task } : {}),
        }),
      });
      const suggestionsPromise = uniqueDictionary.length === 0
        ? Promise.resolve({ suggestions: { suggestions: [] } })
        : api(base + "/entity-alias-suggestions/preview", {
            method: "POST",
            body: JSON.stringify({ ...privacyRequest, dictionary: uniqueDictionary }),
          });
      const [suggestions, context] = await Promise.all([suggestionsPromise, contextPromise]);
      const items = context.contextPack.included;
      privacyItems = new Map(items.map((item) => [item.id, item]));
      const itemNumbers = new Map(items.map((item, index) => [item.id, index + 1]));
      const proposedSpans = new Set();
      privacySelections = suggestions.suggestions.suggestions
        .filter((selection) => {
          const key = selection.itemId + "\\u0000" + selection.byteStart + "\\u0000" + selection.byteEnd;
          if (proposedSpans.has(key)) return false;
          proposedSpans.add(key);
          return true;
        })
        .map((selection) => ({
          itemId: selection.itemId,
          itemNumber: itemNumbers.get(selection.itemId),
          contentSha256: selection.contentSha256,
          byteStart: selection.byteStart,
          byteEnd: selection.byteEnd,
          entityType: selection.entityType,
          origin: "PROPOSED",
          enabled: true,
        }));
      renderPrivacySelections();
      renderPrivacyItems(items);
      privacyProposalReview.hidden = false;
      privacyReviewForm.hidden = false;
      say(privacyProposalStatus, "privacyProposalReady", {
        count: number(privacySelections.length),
        items: number(items.length),
      });
      document.getElementById("privacy-proposal-review-heading").focus();
    } catch (cause) {
      privacyRequest = null;
      detail(privacyProposalError, cause);
      document.getElementById("privacy-proposal-profile").focus();
    }
  });

  const appendProtectedText = (container, content) => {
    const token = /(\\[\\[AW_(?:PERSON|CUSTOMER|EMAIL|BUSINESS_IDENTIFIER|PROJECT|OTHER)_[A-F0-9]{16}\\]\\])/gu;
    content.split(token).filter((part) => part.length > 0).forEach((part) => {
      if (token.test(part)) {
        token.lastIndex = 0;
        const mark = document.createElement("mark");
        text(mark, part);
        container.append(mark);
      } else {
        container.append(document.createTextNode(part));
      }
      token.lastIndex = 0;
    });
  };

  privacyReviewForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    text(privacyReviewError, "");
    if (!privacyRequest || !selectedProject || !selectedWork || !selectedHandoff) {
      say(privacyReviewError, "privacyNeedsHandoff");
      return;
    }
    const selections = privacyAppliedSelections().map(({ itemId, contentSha256, byteStart, byteEnd, entityType }) => ({
      itemId, contentSha256, byteStart, byteEnd, entityType,
    }));
    if (selections.length === 0) {
      say(privacyReviewError, "privacyNeedsSelection");
      return;
    }
    const passphrase = document.getElementById("privacy-passphrase");
    const mappingSetId = "privacy-" + crypto.randomUUID();
    const schemaVersion = selections.some((selection) => selection.entityType === "PROJECT") ? 2 : 1;
    say(privacyProposalStatus, "privacyCreating");
    try {
      const value = await api(
        workPath() + "/" + encodeURIComponent(selectedWork) + "/handoffs/" + encodeURIComponent(selectedHandoff) + "/pseudonymization/preview",
        {
          method: "POST",
          body: JSON.stringify({
            ...privacyRequest,
            review: {
              schemaVersion,
              mappingSetId,
              projectId: selectedProject,
              workItemId: selectedWork,
              handoffId: selectedHandoff,
              modelId: privacyRequest.model,
              attribution: "USER_REVIEWED",
              selections,
            },
            keyCustody: { mode: "PASSPHRASE_WRAPPING", passphrase: passphrase.value },
          }),
        },
      );
      privacyTransformedItems.replaceChildren();
      const transformedByItem = new Map(
        value.transformation.items.map((item) => [item.itemId, item.transformedContent]),
      );
      [...privacyItems.values()].forEach((item, index) => {
        const article = document.createElement("article");
        article.className = "work-card";
        const heading = document.createElement("h4");
        say(heading, "privacyProtectedItem", { item: String(index + 1) });
        const content = document.createElement("pre");
        appendProtectedText(content, transformedByItem.get(item.id) ?? item.content);
        article.append(heading, content);
        privacyTransformedItems.append(article);
      });
      const counts = value.transformation.accounting;
      say(privacyProposalStatus, "privacyProtectedReady", {
        count: number(counts.reviewedSelections),
        items: number(counts.transformedItems),
      });
      say(document.getElementById("privacy-mapping-result"), "privacyMappingResult", {
        mapping: value.mapping.mappingSetId,
        schema: String(value.mapping.schemaVersion),
      });
      const restorationMapping = document.getElementById("output-restoration-mapping-id");
      if (restorationMapping) restorationMapping.value = value.mapping.mappingSetId;
      document.getElementById("privacy-coverage").hidden = false;
      privacyTransformed.hidden = false;
      document.getElementById("privacy-transformed-heading").focus();
    } catch (cause) {
      detail(privacyReviewError, cause);
    } finally {
      passphrase.value = "";
    }
  });

  [
    "customer-alias-heading",
    "customer-alias-form",
    "customer-alias-status",
    "customer-alias-results",
    "customer-alias-confirm",
    "customer-alias-error",
    "pseudonymization-heading",
    "pseudonymization-form",
    "pseudonymization-status",
    "pseudonymization-content",
    "pseudonymization-error",
  ].forEach((id) => {
    const element = document.getElementById(id);
    if (element) element.hidden = true;
  });
  ["customer-alias-heading", "pseudonymization-heading"].forEach((id) => {
    const notice = document.getElementById(id)?.nextElementSibling;
    if (notice) notice.hidden = true;
  });`;
