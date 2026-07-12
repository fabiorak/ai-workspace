export const SUPPORTED_LOCALES = ["en", "it"] as const;
export type GuiLocale = (typeof SUPPORTED_LOCALES)[number];

const EN = {
  language: "Language / Lingua",
  english: "English",
  italian: "Italiano",
  headerTagline: "Local-first control plane",
  headerPrivacy:
    "Your project data stays on this computer. This guided alpha makes no external requests.",
  skip: "Skip to the guided workflow",
  projects: "Projects",
  welcome: "Start with one local project",
  next: "Next recommended action",
  import: "Import safe sample evidence",
  search: "Search project history",
  event: "Inspect canonical event",
  artifact: "Integrity-verified source evidence",
  memory: "Curate active project memory",
  memoryDetail: "Memory lifecycle and provenance",
  work: "Work Items",
  workDetail: "Work Item lifecycle",
  handoff: "Build a transparent handoff",
  handoffDetail: "Immutable handoff",
  instructions: "Preview effective instructions",
  capabilities: "Product capability map",
  register: "Register this project",
  selectProject: "Select {name}",
  refreshGit: "Refresh Git inspection",
  importSample: "Import the safe sample session",
  searchEvidence: "Search evidence",
  inspectEvent: "Inspect source event",
  openSource: "Open integrity-verified source",
  useMemorySource: "Use this event as memory evidence",
  backResults: "Return to search results",
  createMemory: "Create source-linked memory",
  refreshMemory: "Refresh memory list",
  inspectMemory: "Inspect memory lifecycle",
  verifyMemory: "Record one verification",
  supersedeMemory: "Supersede with replacement",
  invalidateMemory: "Invalidate this item",
  backMemory: "Return to memory list",
  createWork: "Create proposed Work Item",
  inspectWork: "Inspect Work Item lifecycle",
  activateWork: "Activate Work Item",
  blockWork: "Block Work Item",
  completeWork: "Complete Work Item",
  reopenWork: "Reopen Work Item",
  backWork: "Return to Work Items",
  previewHandoff: "Preview immutable handoff",
  createHandoff: "Create reviewed immutable handoff",
  inspectHandoff: "Inspect handoff {id}",
  validateHandoff: "Validate current Git state",
  successor: "Prepare successor",
  backHandoff: "Return to handoff builder",
  previewInstructions: "Preview instructions read-only",
  noExecution:
    "Configured instruction text and precedence are descriptive. The GUI does not enforce or execute them.",
  bundlePaths: "Reviewed instruction bundle paths, one per line",
  model: "Model target (optional)",
  agent: "Agent target (optional)",
  task: "Task target (optional)",
  originalContent:
    "Imported evidence and user-authored content remain in their original language. No translation service is used.",
  loadingProjects: "Loading local projects…",
  noProjects: "No projects yet. Enter a local Git repository directory below.",
  selectedProject:
    "Project selected. Continue to evidence, memory, continuity, or instruction inspection below.",
  instructionEmpty:
    "Select a project and explicit reviewed synthetic bundle paths to preview effective instructions.",
  instructionWarning:
    "Read-only preview: nothing is persisted or executed. USER_CONFIGURED does not mean runtime permission.",
  previewReady:
    "Effective instruction preview ready. Nothing was persisted or executed.",
  fallback: "Unsupported language values safely fall back to English.",
} as const;

export type GuiMessageKey = keyof typeof EN;
type Catalog = Readonly<Record<GuiMessageKey, string>>;

const IT = {
  language: "Language / Lingua",
  english: "English",
  italian: "Italiano",
  headerTagline: "Piano di controllo local-first",
  headerPrivacy:
    "I dati del progetto restano su questo computer. Questa alpha guidata non effettua richieste esterne.",
  skip: "Vai al flusso guidato",
  projects: "Progetti",
  welcome: "Inizia con un progetto locale",
  next: "Prossima azione consigliata",
  import: "Importa evidenza di esempio sicura",
  search: "Cerca nella cronologia del progetto",
  event: "Esamina l'evento canonico",
  artifact: "Evidenza sorgente con integrità verificata",
  memory: "Cura la memoria attiva del progetto",
  memoryDetail: "Ciclo di vita e provenance della memoria",
  work: "Work Item",
  workDetail: "Ciclo di vita del Work Item",
  handoff: "Crea un handoff trasparente",
  handoffDetail: "Handoff immutabile",
  instructions: "Anteprima delle istruzioni effettive",
  capabilities: "Mappa delle funzionalità del prodotto",
  register: "Registra questo progetto",
  selectProject: "Seleziona {name}",
  refreshGit: "Aggiorna ispezione Git",
  importSample: "Importa la sessione di esempio sicura",
  searchEvidence: "Cerca evidenza",
  inspectEvent: "Esamina evento sorgente",
  openSource: "Apri sorgente con integrità verificata",
  useMemorySource: "Usa questo evento come evidenza della memoria",
  backResults: "Torna ai risultati della ricerca",
  createMemory: "Crea memoria collegata alla sorgente",
  refreshMemory: "Aggiorna elenco memoria",
  inspectMemory: "Esamina ciclo di vita della memoria",
  verifyMemory: "Registra una verifica",
  supersedeMemory: "Sostituisci con una nuova versione",
  invalidateMemory: "Invalida questo elemento",
  backMemory: "Torna all'elenco memoria",
  createWork: "Crea Work Item proposto",
  inspectWork: "Esamina ciclo di vita del Work Item",
  activateWork: "Attiva Work Item",
  blockWork: "Blocca Work Item",
  completeWork: "Completa Work Item",
  reopenWork: "Riapri Work Item",
  backWork: "Torna ai Work Item",
  previewHandoff: "Anteprima handoff immutabile",
  createHandoff: "Crea handoff immutabile revisionato",
  inspectHandoff: "Esamina handoff {id}",
  validateHandoff: "Valida stato Git corrente",
  successor: "Prepara successore",
  backHandoff: "Torna al builder handoff",
  previewInstructions: "Anteprima istruzioni in sola lettura",
  noExecution:
    "Testo e precedenza delle istruzioni configurate sono descrittivi. La GUI non li applica né li esegue.",
  bundlePaths: "Percorsi dei bundle revisionati, uno per riga",
  model: "Target modello (facoltativo)",
  agent: "Target agente (facoltativo)",
  task: "Target attività (facoltativo)",
  originalContent:
    "Evidenza importata e contenuti scritti dall'utente restano nella lingua originale. Non viene usato alcun servizio di traduzione.",
  loadingProjects: "Caricamento progetti locali…",
  noProjects:
    "Nessun progetto presente. Inserisci qui sotto una directory Git locale.",
  selectedProject:
    "Progetto selezionato. Continua con evidenza, memoria, continuità o ispezione delle istruzioni.",
  instructionEmpty:
    "Seleziona un progetto e i percorsi espliciti di bundle sintetici revisionati per vedere le istruzioni effettive.",
  instructionWarning:
    "Anteprima in sola lettura: nulla viene persistito o eseguito. USER_CONFIGURED non indica un permesso runtime.",
  previewReady:
    "Anteprima delle istruzioni effettive pronta. Nulla è stato persistito o eseguito.",
  fallback: "I valori lingua non supportati usano in sicurezza l'inglese.",
} as const satisfies Catalog;

export const GUI_CATALOGS: Readonly<Record<GuiLocale, Catalog>> = Object.freeze(
  {
    en: Object.freeze(EN),
    it: Object.freeze(IT),
  },
);

export function resolveGuiLocale(
  explicit: string | null | undefined,
  browserLanguages: readonly string[] = [],
): GuiLocale {
  for (const candidate of [explicit, ...browserLanguages]) {
    const locale = candidate?.trim().toLowerCase().split("-", 1)[0];
    if (locale === "en" || locale === "it") return locale;
  }
  return "en";
}

export function guiMessage(
  locale: GuiLocale,
  key: GuiMessageKey,
  parameters: Readonly<Record<string, string>> = {},
): string {
  const template = GUI_CATALOGS[locale][key];
  const expected = [...template.matchAll(/\{([a-zA-Z][a-zA-Z0-9]*)\}/gu)].map(
    (match) => match[1]!,
  );
  if (
    Object.keys(parameters).length !== expected.length ||
    expected.some((name) => !(name in parameters))
  )
    throw new Error(`Invalid localization parameters for '${key}'.`);
  return template.replace(/\{([a-zA-Z][a-zA-Z0-9]*)\}/gu, (_, name: string) =>
    [...parameters[name]!]
      .map((character) => {
        const point = character.codePointAt(0) ?? 0;
        return point < 32 || (point >= 127 && point <= 159) ? "�" : character;
      })
      .join(""),
  );
}
