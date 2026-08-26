import { catalogues } from "./catalog.ts";

export const PRIVACY_TEXT = Object.freeze({
  privacyGuideHeading: {
    en: "Protect what may leave this computer",
    it: "Proteggi ciò che potrebbe uscire dal computer",
  },
  privacyGuideIntro: {
    en: "AI Workspace prepares the protected version. You review words, not byte coordinates or hashes. Nothing is sent or executed here.",
    it: "AI Workspace prepara la versione protetta. Tu controlli le parole, non coordinate o impronte tecniche. Qui non viene inviato né eseguito nulla.",
  },
  privacyNeedsWork: {
    en: "First choose a project, an active work item, and one handoff to protect.",
    it: "Prima scegli un progetto, un'attività in corso e il passaggio da proteggere.",
  },
  privacyGoWork: { en: "Choose the work", it: "Scegli il lavoro" },
  privacyProposalHeading: {
    en: "Prepare the proposal",
    it: "Prepara la proposta",
  },
  privacyProposalHelp: {
    en: "The selected project name and the other names you provide are matched exactly. You can remove any proposal or select missed text before creating the protected local version.",
    it: "Il nome del progetto scelto e gli altri nomi che indichi vengono cercati esattamente. Puoi togliere una proposta o selezionare un testo sfuggito prima di creare la versione protetta locale.",
  },
  privacyProfilePath: {
    en: "Reviewed agent profile file",
    it: "File revisionato del profilo dell'agente",
  },
  privacyGuidePolicyPath: {
    en: "Reviewed model privacy policy file",
    it: "File revisionato della policy privacy del modello",
  },
  privacyBundles: {
    en: "Reviewed instruction files declared by the profile, one per line",
    it: "File di istruzioni revisionati dichiarati dal profilo, uno per riga",
  },
  privacyModel: {
    en: "Model named by the policy",
    it: "Modello indicato dalla policy",
  },
  privacyTask: {
    en: "Task name, when the profile requires one",
    it: "Nome dell'attività, quando il profilo lo richiede",
  },
  privacyCustomerNames: {
    en: "Customer names to protect, one per line",
    it: "Nomi dei clienti da proteggere, uno per riga",
  },
  privacyProjectNames: {
    en: "Other project names to protect, one per line",
    it: "Altri nomi di progetto da proteggere, uno per riga",
  },
  privacyTechnicalSources: {
    en: "Reviewed local sources",
    it: "Sorgenti locali revisionate",
  },
  privacyTechnicalSourcesHelp: {
    en: "These files determine what enters the protected text. They stay local and are not model execution settings.",
    it: "Questi file determinano ciò che entra nel testo protetto. Restano locali e non sono impostazioni di esecuzione di un modello.",
  },
  privacyProposalSubmit: {
    en: "Prepare protected-text proposal",
    it: "Prepara la proposta di testo protetto",
  },
  privacyProposalIdle: {
    en: "Choose the work and provide the reviewed local files.",
    it: "Scegli il lavoro e indica i file locali revisionati.",
  },
  privacyProposalPreparing: {
    en: "Preparing the proposal locally…",
    it: "Sto preparando la proposta in locale…",
  },
  privacyProposalReady: {
    en: "Proposal ready: {count} substitutions across {items} items.",
    it: "Proposta pronta: {count} sostituzioni in {items} elementi.",
  },
  privacyReviewHeading: {
    en: "Review the proposed substitutions",
    it: "Controlla le sostituzioni proposte",
  },
  privacyReviewHelp: {
    en: "Every proposal is applied. Clear one to keep those words, or select text in an item and add a missed substitution.",
    it: "Ogni proposta è applicata. Deselezionane una per conservare quelle parole, oppure seleziona un testo nell'elemento e aggiungi una sostituzione sfuggita.",
  },
  privacyProposalSelection: {
    en: "{origin}: protect {type} “{text}” in item {item}",
    it: "{origin}: proteggi {type} «{text}» nell'elemento {item}",
  },
  privacyOriginProposed: { en: "Proposed", it: "Proposta" },
  privacyOriginManual: { en: "Added by you", it: "Aggiunta da te" },
  privacyItemHeading: { en: "Item {item}", it: "Elemento {item}" },
  privacyItemSource: { en: "Source details", it: "Dettagli della fonte" },
  privacyOriginalText: {
    en: "Original text of item {item}",
    it: "Testo originale dell'elemento {item}",
  },
  privacyManualType: {
    en: "What the selected text represents",
    it: "Che cosa rappresenta il testo selezionato",
  },
  privacyAddSelection: {
    en: "Protect selected text",
    it: "Proteggi il testo selezionato",
  },
  privacySelectText: {
    en: "Select some text in the item first.",
    it: "Prima seleziona del testo nell'elemento.",
  },
  privacyManualOverlap: {
    en: "That selection overlaps another applied substitution. Remove the other one first.",
    it: "La selezione si sovrappone a un'altra sostituzione applicata. Prima togli l'altra.",
  },
  privacyTypePERSON: { en: "person", it: "persona" },
  privacyTypeCUSTOMER: { en: "customer", it: "cliente" },
  privacyTypeEMAIL: { en: "email address", it: "indirizzo email" },
  privacyTypeBUSINESS_IDENTIFIER: {
    en: "business identifier",
    it: "identificativo aziendale",
  },
  privacyTypePROJECT: { en: "project", it: "progetto" },
  privacyTypeOTHER: { en: "other sensitive text", it: "altro testo sensibile" },
  privacyPassphrase: {
    en: "Passphrase protecting the local recovery mapping",
    it: "Passphrase che protegge il mapping locale di ripristino",
  },
  privacyCreateProtected: {
    en: "Create the protected version locally",
    it: "Crea la versione protetta in locale",
  },
  privacyCreating: {
    en: "Creating and verifying the protected version locally…",
    it: "Sto creando e verificando la versione protetta in locale…",
  },
  privacyNeedsHandoff: {
    en: "Choose a project, active work item, and handoff before preparing privacy.",
    it: "Scegli un progetto, un'attività in corso e un passaggio prima di preparare la privacy.",
  },
  privacyNeedsSelection: {
    en: "Keep at least one substitution, or add a missed one.",
    it: "Conserva almeno una sostituzione oppure aggiungine una sfuggita.",
  },
  privacyTransformedHeading: { en: "Protected text", it: "Testo protetto" },
  privacyCoverage: {
    en: "This proposal can miss personal or secret data. Review the complete text before it is ever sent.",
    it: "Questa proposta può non riconoscere tutti i dati personali o segreti. Controlla il testo completo prima di qualsiasi invio.",
  },
  privacyProtectedItem: {
    en: "Protected item {item}",
    it: "Elemento protetto {item}",
  },
  privacyProtectedReady: {
    en: "Protected version created and verified locally: {count} substitutions in {items} items. Nothing was sent.",
    it: "Versione protetta creata e verificata in locale: {count} sostituzioni in {items} elementi. Non è stato inviato nulla.",
  },
  privacyMappingDetails: {
    en: "Local recovery details",
    it: "Dettagli locali di ripristino",
  },
  privacyMappingResult: {
    en: "Mapping {mapping}, schema {schema}. Stored encrypted and verified for complete local restoration.",
    it: "Mapping {mapping}, schema {schema}. Conservato cifrato e verificato per il ripristino locale completo.",
  },
});

export const PRIVACY_CATALOGUES = catalogues(PRIVACY_TEXT);
