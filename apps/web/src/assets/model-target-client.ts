export const MODEL_TARGET_BEHAVIOUR = `
  const modelTargetSelect = document.getElementById("home-conversation-model");
  const modelTargetStatus = document.getElementById("model-target-status");
  const modelTargetList = document.getElementById("model-target-list");
  const modelTargetDefault = document.getElementById("model-target-default");
  let modelTargetRevision = 0;
  const privacyProtectionStatus = document.getElementById("privacy-protection-status");
  const legacyMigrationForm = document.getElementById("legacy-migration-form");
  const legacyMigrationSummary = document.getElementById("legacy-migration-summary");
  const legacyMigrationError = document.getElementById("legacy-migration-error");
  const loadPrivacyProtection = async () => {
    try {
      const state = await api("/api/privacy-protection");
      say(privacyProtectionStatus, "automaticProtectionReady");
      legacyMigrationForm.hidden = state.legacyMappings === 0;
      say(legacyMigrationSummary, state.legacyMappings === 0 ? "legacyNone" : "legacyFound", { count: number(state.legacyMappings), threat: { key: "automaticProtectionThreat" } });
      text(legacyMigrationError, "");
    } catch (cause) { detail(legacyMigrationError, cause); }
  };
  const modelTargetOption = (value, label) => { const option = document.createElement("option"); option.value = value; text(option, label); return option; };
  const modelTargetMessageOption = (value, key) => { const option = document.createElement("option"); option.value = value; say(option, key); return option; };
  const renderModelTargetChoices = (view) => {
    modelTargetRevision = view.revision;
    const current = modelTargetSelect.value;
    modelTargetSelect.replaceChildren(modelTargetMessageOption("", "modelTargetChoose"));
    modelTargetDefault.replaceChildren(modelTargetMessageOption("", "modelTargetNoDefault"));
    for (const target of view.targets) {
      if (!target.enabled) continue;
      modelTargetSelect.append(modelTargetOption(target.targetId, target.displayName));
      modelTargetDefault.append(modelTargetOption(target.targetId, target.displayName));
    }
    modelTargetDefault.value = view.defaultTargetId || "";
    if ([...modelTargetSelect.options].some((option) => option.value === current)) modelTargetSelect.value = current;
    modelTargetSelect.disabled = view.targets.every((target) => !target.enabled);
  };
  const renderModelTargetConfiguration = (configuration) => {
    modelTargetRevision = configuration.revision;
    modelTargetList.replaceChildren();
    if (configuration.targets.length === 0) { const empty = document.createElement("p"); empty.className = "help"; say(empty, "modelTargetEmpty"); modelTargetList.append(empty); return; }
    for (const target of configuration.targets) {
      const article = document.createElement("article"); article.className = "setting-card model-target-row";
      const body = document.createElement("div"); const heading = document.createElement("h4"); text(heading, target.displayName);
      const detailLine = document.createElement("p"); detailLine.className = "help"; text(detailLine, target.providerKind + " · " + target.modelId + " · " + target.boundary);
      const state = document.createElement("span"); state.className = "setting-value"; say(state, target.enabled ? "modelTargetEnabled" : "modelTargetDisabled");
      body.append(heading, detailLine); article.append(body, state); modelTargetList.append(article);
    }
  };
  const loadModelTargets = async () => {
    try {
      const [view, configuration] = await Promise.all([api("/api/model-targets"), api("/api/model-targets/configuration")]);
      renderModelTargetChoices(view); renderModelTargetConfiguration(configuration); text(modelTargetStatus, "");
    } catch (cause) { detail(document.getElementById("model-target-error"), cause); }
  };
  const loadConversationTarget = async (conversation) => {
    const project = conversation.projectId ? "?project=" + encodeURIComponent(conversation.projectId) : "";
    const value = await api("/api/conversations/" + encodeURIComponent(conversation.id) + "/model-target" + project);
    modelTargetRevision = value.revision; modelTargetSelect.value = value.selected ? value.selected.targetId : "";
    return value.selected;
  };
  const selectConversationTarget = async (conversationId, projectId, targetId) => {
    const project = projectId ? "?project=" + encodeURIComponent(projectId) : "";
    const value = await api("/api/conversations/" + encodeURIComponent(conversationId) + "/model-target" + project, { method: "POST", body: JSON.stringify({ targetId, expectedRevision: modelTargetRevision }) });
    modelTargetRevision = value.revision; return value.selected;
  };
  document.getElementById("model-target-form").addEventListener("submit", async (event) => {
    event.preventDefault(); text(document.getElementById("model-target-error"), ""); const value = (id) => document.getElementById(id).value.trim();
    const target = { targetId: value("model-target-id"), displayName: value("model-target-name"), providerKind: value("model-target-provider"), modelId: value("model-target-model"), boundary: value("model-target-boundary"), profileRef: value("model-target-profile"), policyRef: value("model-target-policy"), instructionRefs: value("model-target-instructions").split(/\\r?\\n/u).map((entry) => entry.trim()).filter(Boolean), maxInputBytes: Number(value("model-target-input-limit")), maxOutputBytes: Number(value("model-target-output-limit")), enabled: document.getElementById("model-target-enabled").checked };
    try {
      const configuration = await api("/api/model-targets", { method: "POST", body: JSON.stringify({ target, expectedRevision: modelTargetRevision }) });
      renderModelTargetConfiguration(configuration); renderModelTargetChoices({ revision: configuration.revision, defaultTargetId: configuration.defaultTargetId, targets: configuration.targets.map(({ targetId, displayName, enabled }) => ({ targetId, displayName, enabled })) }); say(modelTargetStatus, "modelTargetSaved", { name: target.displayName });
    } catch (cause) { detail(document.getElementById("model-target-error"), cause); document.getElementById("model-target-id").focus(); }
  });
  document.getElementById("model-target-default-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const configuration = await api("/api/model-targets/default", { method: "POST", body: JSON.stringify({ targetId: modelTargetDefault.value || null, expectedRevision: modelTargetRevision }) });
      renderModelTargetConfiguration(configuration); renderModelTargetChoices({ revision: configuration.revision, defaultTargetId: configuration.defaultTargetId, targets: configuration.targets.map(({ targetId, displayName, enabled }) => ({ targetId, displayName, enabled })) }); say(modelTargetStatus, "modelTargetDefaultSaved");
    } catch (cause) { detail(document.getElementById("model-target-error"), cause); modelTargetDefault.focus(); }
  });
  legacyMigrationForm.addEventListener("submit", async (event) => {
    event.preventDefault(); text(legacyMigrationError, "");
    const mappingSetId = document.getElementById("legacy-mapping-id").value.trim();
    const passphrase = document.getElementById("legacy-passphrase").value;
    try {
      const result = await api("/api/privacy-protection/migrate", { method: "POST", body: JSON.stringify({ mappingSetId, passphrase }) });
      say(legacyMigrationSummary, "legacyMigrated", { count: number(result.importedEntries), project: result.projectId });
      document.getElementById("legacy-mapping-id").value = "";
    } catch (cause) { detail(legacyMigrationError, cause); }
    finally { document.getElementById("legacy-passphrase").value = ""; }
  });
`;
