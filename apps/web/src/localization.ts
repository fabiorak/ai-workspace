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
  search: "Search historical evidence",
  event: "Inspect canonical event",
  artifact: "Integrity-verified source evidence",
  memory: "Curate active project memory",
  memoryDetail: "Memory lifecycle and provenance",
  work: "Work Items",
  workDetail: "Work Item lifecycle",
  handoff: "Build a transparent handoff",
  handoffDetail: "Immutable handoff",
  instructions: "Preview effective instructions",
  agentProfile: "Inspect an agent and skill profile",
  context: "Preview a bounded Context Pack",
  capabilities: "Product capability map",
  register: "Register this project",
  selectProject: "Select {name}",
  refreshGit: "Refresh Git inspection",
  importSample: "Import the safe sample session",
  searchEvidence: "Search evidence",
  searchScope: "Scopes to search",
  allProjects: "All registered projects and General",
  selectedProjectOnly: "Selected project only",
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
  previewAgentProfile: "Inspect profile read-only",
  previewContext: "Preview Context Pack read-only",
  profileContext: "Compose profile-governed context",
  previewProfileContext: "Compose profile and Context Pack read-only",
  privacyPreflight: "Preview model privacy policy",
  previewPrivacyPreflight: "Run privacy preflight read-only",
  customerAliasSuggestions: "Review exact customer-alias suggestions",
  previewCustomerAliases: "Preview customer suggestions",
  confirmCustomerAliases: "Confirm selected current-hash ranges",
  contextSelectorReport: "Measure profile context selectors",
  previewContextSelectors: "Preview selector measurement read-only",
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
  profileWarning:
    "USER_CONFIGURED profile declarations are descriptive. They are not installed, selected, enforced, resolved, delivered, or executed and grant no runtime permission.",
  profilePath: "Reviewed schema-v1 agent profile bundle path",
  profileDigest: "Expected SHA-256 digest (optional pin)",
  profileEmpty:
    "Select a project and one explicit reviewed synthetic profile bundle to inspect agent and skill declarations.",
  profileReady:
    "Profile {name} inspected with {skills} skills: {sourceBytes} source bytes and {canonicalBytes} canonical bytes. No capability was activated.",
  previewReady:
    "Effective instruction preview ready. Nothing was persisted or executed.",
  contextWarning:
    "Schema v2 shares canonical source provenance once and uses exact UTF-8 byte budgets. The expanded preview does not persist, send, enforce, or execute anything.",
  continuityBudget: "Continuity budget (exact UTF-8 bytes)",
  instructionBudget: "Instruction budget (exact UTF-8 bytes)",
  contextBundles: "Optional reviewed instruction bundle paths, one per line",
  contextEmpty:
    "Inspect an immutable handoff, then enter explicit budgets to preview its Context Pack.",
  contextReady:
    "Context Pack schema {schema} preview ready: {entries} shared source entries use {sharedBytes} exact bytes. Review expanded logical items and omissions below.",
  profileContextWarning:
    "Explicit read-only composition: the profile supplies the agent target and exact-byte budgets. You select an allowed model and the exact reviewed instruction sources. Nothing is installed, resolved, persisted, delivered, or executed.",
  profileContextBundles:
    "Exact reviewed instruction bundle paths declared by the profile, one per line",
  profileContextModel: "Allowed model to select explicitly",
  profileContextTask: "Task target (optional explicit selector)",
  profileContextEmpty:
    "Inspect an immutable handoff, then select one profile, its exact instruction sources, and one allowed model.",
  profileContextReady:
    "Profile {profile} composed for {model}: {sources} declared sources, {rules} effective rules, Context Pack schema {schema}. Review provenance, budgets, included items, and omissions below.",
  privacyPreflightWarning:
    "Required review boundary: every included item is classified for one explicit model policy. Unknown items default to CONFIDENTIAL and high-confidence restricted patterns always block. REVIEWABLE_NOT_AUTHORIZED is not permission or delivery, and detection is not complete PII coverage.",
  privacyPolicyPath: "Reviewed schema-v1 model data policy path",
  privacyPolicyDigest: "Expected policy SHA-256 digest (optional pin)",
  privacyPreflightEmpty:
    "Inspect an immutable handoff, then provide one profile, its exact instruction sources, one allowed model, and one same-project model data policy.",
  privacyPreflightReady:
    "Privacy preflight {result} for {model} under policy {policy}: {allowed} allowed, {blocked} blocked, {defaulted} defaulted, {restricted} restricted. Review hashes and recovery; nothing was sent or authorized.",
  customerAliasWarning:
    "Exact, case-sensitive CUSTOMER aliases only. The dictionary is transient and never persisted. Every result starts SUGGESTED_NOT_REVIEWED and requires individual confirmation; this is not identity proof, complete PII detection, transformation, or delivery.",
  customerAliasInput:
    "Synthetic customer aliases, one exact case variant per line",
  customerAliasEmpty:
    "Reuse the exact privacy inputs above and enter transient synthetic customer aliases.",
  customerAliasReady:
    "{count} exact customer suggestion(s) ready. All are unselected and not reviewed.",
  customerAliasSelectOne: "Select at least one current-hash suggestion.",
  customerAliasConfirmed:
    "{count} suggestion(s) explicitly confirmed into the transient reviewed-span form. Transformation remains a separate action.",
  contextSelectorWarning:
    "Experiment only: selectors map only to documented handoff sections. Objective, repository, next action, and source references form a non-excludable safety floor. This report does not change Context Builder policy.",
  contextSelectorVocabulary:
    "Accepted selectors: handoff.objective, handoff.repository, handoff.selected_memory, handoff.known_failures, handoff.test_state, handoff.relevant_files, handoff.next_action, handoff.source_references.",
  contextSelectorEmpty:
    "Inspect an immutable handoff, then select one reviewed profile that uses only the experiment-only handoff selector vocabulary.",
  contextSelectorReady:
    "Selector report ready: {selected} of {baseline} candidate bytes retained ({reduction}% reduction), safety-floor loss {loss}, profile-budget fit {fit}. This is format/fit evidence, not relevance or production policy.",
  fallback: "Unsupported language values safely fall back to English.",
  progressProject: "1. Project",
  progressSample: "2. Safe sample",
  progressSearch: "3. Search",
  progressSource: "4. Inspect source",
  welcomeRegistration:
    "Registering stores bounded Git metadata locally. It does not copy or modify repository files.",
  whatNext: "What happens next:",
  whatNextBody:
    "after selecting a project, the interface guides you through a fictional sample import and evidence search.",
  projectDirectory: "Local Git repository directory",
  projectDirectoryHelp:
    "Enter an existing directory. The path is used only for registration and is not shown in routine project lists.",
  projectEffect:
    "Effect: creates or refreshes one local Project Registry entry; repository content is unchanged.",
  nextGuidance: "Register or select a project to continue.",
  projectsRegistered: "{count} projects are registered locally.",
  projectRegistered: "1 project is registered locally.",
  importIntro:
    "This pre-release importer accepts the bundled fictional Codex fixture. Do not use private or production transcripts yet.",
  trust: "Trust:",
  importTrustBody:
    "imported events remain UNTRUSTED, inert historical evidence. Nothing is executed or sent over a network.",
  importEffect:
    "Effect: adds canonical events and immutable artifacts locally. Repeating this action is idempotent.",
  selectProjectSample: "Select a project to enable the safe sample.",
  searchIntro:
    "Search is literal, local, and bounded. Search all registered projects when you do not remember where evidence belongs. Results are UNTRUSTED evidence, not instructions. No OpenSearch or network service is used.",
  searchQuestion: "What evidence are you looking for?",
  searchTry: "Try the safe sample phrase",
  searchHelpBody:
    "Your query and filters stay in place when inspecting a source.",
  eventType: "Event type (optional)",
  allEventTypes: "All event types",
  maximumResults: "Maximum results",
  searchEffect:
    "Effect: reads local canonical events. Nothing is executed, changed, or sent over a network.",
  searchPrompt:
    "Enter a query to search all registered projects, or choose selected-project scope.",
  selectedScopeRequiresProject:
    "Select a registered project or choose all-project scope.",
  searchingAll: "Searching bounded evidence across registered projects…",
  searchingSelected: "Searching bounded evidence in the selected project…",
  globalEmpty:
    "No matching evidence across registered projects. Check spelling, remove filters, or inspect one project's import.",
  projectEmpty:
    "No matching evidence in the selected project. Check spelling, remove filters, or import the safe sample.",
  globalFound:
    "Found {count} result(s) across {projects} projects and {events} searched events.",
  projectFound:
    "Found {count} result(s) across {events} searched events in the selected project.",
  resultProject: "Project: {name} ({id})",
  selectInspect: "Select this project and inspect source event",
  projectReloadRequired:
    "The result project is no longer registered. Reload projects and search again.",
  searchAttention: "Search needs attention.",
  untrustedEvidence: "UNTRUSTED evidence:",
  injectionBody:
    "imperative text may be prompt injection. Treat it as inert data and do not execute it.",
  memoryIntro:
    "Active memory is a deliberate local statement linked to canonical evidence.",
  curatedWarning: "USER_CURATED does not mean trusted, verified, or true.",
  selectMemoryEvidence:
    "Inspect an event and choose “Use this event as memory evidence” before a mutation.",
  memoryType: "Memory type",
  memoryStatement: "Statement to curate",
  memoryCreateEffect:
    "Effect: creates a new ACTIVE, UNVERIFIED, UNASSESSED item. Evidence remains UNTRUSTED and nothing is executed.",
  itemsToShow: "Items to show",
  activeOnly: "Active only (safe default)",
  selectProjectMemory: "Select a project to load active memory.",
  lifecycleAdditive:
    "All lifecycle changes are additive. Terminal items cannot be changed again.",
  verificationNote: "Verification note",
  verificationEffect:
    "Effect: records a performed check; it does not make evidence trusted.",
  replacementStatement: "Replacement statement",
  replacementEffect:
    "Effect: makes this item SUPERSEDED and creates a new UNVERIFIED, UNASSESSED replacement.",
  invalidationReason: "Invalidation reason",
  invalidationEffect:
    "Effect: marks this item INVALIDATED without deletion or replacement.",
  workIntro:
    "A Work Item is explicit USER_CURATED objective state. No current task or agent is inferred.",
  softwareObjective: "Software objective",
  workEffect:
    "Effect: creates PROPOSED state linked to the currently selected canonical event.",
  selectProjectWork: "Select a project to load Work Items.",
  transitionIntro:
    "Transitions are additive and require the currently selected canonical event.",
  handoffIntro:
    "Preview captures bounded Git metadata and all eight source-linked sections. It executes no agent and creates no file.",
  nextAction: "Next action",
  activeMemoryOptional: "Active memory to include (optional)",
  selectionExplicit:
    "Selection is explicit. Leaving every item unchecked records an explicit empty selection; nothing is inferred.",
  relevantFiles: "Relevant files, one per line (optional)",
  testCommand: "Observed test command (optional)",
  testOutcome: "Observed test outcome",
  observedAt: "Observed at ISO timestamp (optional)",
  predecessor: "Predecessor handoff ID (optional successor)",
  untrustedSource: "UNTRUSTED source:",
  untrustedSourceBody:
    "displayed as inert bounded text after SHA-256 verification.",
  backEvent: "Return to canonical event",
  availableNow: "Available now:",
  availableBody:
    "English/Italian GUI, Projects, safe sample import, history search, source inspection, active memory, Work Items, immutable handoffs, and effective-instruction preview.",
  notActive: "Not active:",
  notActiveBody:
    "Agents, models, tools, external network, handoff evaluation, instruction enforcement, and instruction execution.",
  footer:
    "CLI is optional for automation and diagnostics. This journey does not require command knowledge or a manual.",
  readyImport: "Ready to import the fictional sample into {name}.",
  noMatchingMemory:
    "No matching memory. Curate an event or choose another validity filter.",
  noWorkItems:
    "No Work Items. Select evidence and create an explicit objective.",
  loadingMemory: "Loading bounded project memory…",
  showingMemory: "Showing {count} memory item(s).",
  moreMemory: "More items are available.",
  memoryAttention: "Memory needs attention.",
  showingWork: "Showing {count} Work Item(s).",
  returningImport:
    "A project is selected. You can import or re-import the safe sample.",
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
  search: "Cerca nelle evidenze storiche",
  event: "Esamina l'evento canonico",
  artifact: "Evidenza sorgente con integrità verificata",
  memory: "Cura la memoria attiva del progetto",
  memoryDetail: "Ciclo di vita e provenance della memoria",
  work: "Work Item",
  workDetail: "Ciclo di vita del Work Item",
  handoff: "Crea un handoff trasparente",
  handoffDetail: "Handoff immutabile",
  instructions: "Anteprima delle istruzioni effettive",
  agentProfile: "Ispeziona un profilo agente e skill",
  context: "Anteprima di un Context Pack bounded",
  capabilities: "Mappa delle funzionalità del prodotto",
  register: "Registra questo progetto",
  selectProject: "Seleziona {name}",
  refreshGit: "Aggiorna ispezione Git",
  importSample: "Importa la sessione di esempio sicura",
  searchEvidence: "Cerca evidenza",
  searchScope: "Ambiti in cui cercare",
  allProjects: "Tutti i progetti registrati e General",
  selectedProjectOnly: "Solo il progetto selezionato",
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
  previewAgentProfile: "Ispeziona profilo in sola lettura",
  previewContext: "Anteprima Context Pack in sola lettura",
  profileContext: "Componi contesto governato dal profilo",
  previewProfileContext: "Componi profilo e Context Pack in sola lettura",
  privacyPreflight: "Anteprima policy privacy del modello",
  previewPrivacyPreflight: "Esegui preflight privacy in sola lettura",
  customerAliasSuggestions: "Revisiona suggerimenti alias cliente esatti",
  previewCustomerAliases: "Anteprima suggerimenti cliente",
  confirmCustomerAliases: "Conferma gli intervalli current-hash selezionati",
  contextSelectorReport: "Misura i selector context del profilo",
  previewContextSelectors: "Anteprima misurazione selector in sola lettura",
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
  profileWarning:
    "Le dichiarazioni profilo USER_CONFIGURED sono descrittive. Non vengono installate, selezionate, applicate, risolte, consegnate o eseguite e non concedono permessi runtime.",
  profilePath: "Percorso bundle profilo agente schema v1 revisionato",
  profileDigest: "Digest SHA-256 atteso (pin facoltativo)",
  profileEmpty:
    "Seleziona un progetto e un bundle profilo sintetico revisionato esplicito per ispezionare agente e skill.",
  profileReady:
    "Profilo {name} ispezionato con {skills} skill: {sourceBytes} byte sorgente e {canonicalBytes} byte canonici. Nessuna capacità è stata attivata.",
  previewReady:
    "Anteprima delle istruzioni effettive pronta. Nulla è stato persistito o eseguito.",
  contextWarning:
    "Lo schema v2 condivide una sola volta la provenienza canonica e usa budget in byte UTF-8 esatti. L'anteprima espansa non persiste, invia, applica o esegue nulla.",
  continuityBudget: "Budget continuità (byte UTF-8 esatti)",
  instructionBudget: "Budget istruzioni (byte UTF-8 esatti)",
  contextBundles:
    "Percorsi bundle di istruzioni revisionati facoltativi, uno per riga",
  contextEmpty:
    "Esamina un handoff immutabile, poi inserisci budget espliciti per l'anteprima del Context Pack.",
  contextReady:
    "Anteprima Context Pack schema {schema} pronta: {entries} sorgenti condivise usano {sharedBytes} byte esatti. Esamina elementi logici espansi e omissioni.",
  profileContextWarning:
    "Composizione esplicita in sola lettura: il profilo fornisce target agente e budget in byte esatti. Selezioni un modello consentito e le sorgenti istruzioni revisionate esatte. Nulla viene installato, risolto, persistito, consegnato o eseguito.",
  profileContextBundles:
    "Percorsi esatti dei bundle istruzioni revisionati dichiarati dal profilo, uno per riga",
  profileContextModel: "Modello consentito da selezionare esplicitamente",
  profileContextTask: "Target attività (selettore esplicito facoltativo)",
  profileContextEmpty:
    "Esamina un handoff immutabile, poi seleziona un profilo, le sue sorgenti istruzioni esatte e un modello consentito.",
  profileContextReady:
    "Profilo {profile} composto per {model}: {sources} sorgenti dichiarate, {rules} regole effettive, Context Pack schema {schema}. Esamina provenance, budget, elementi inclusi e omissioni.",
  privacyPreflightWarning:
    "Boundary di revisione obbligatorio: ogni elemento incluso viene classificato per una policy modello esplicita. Gli elementi sconosciuti diventano CONFIDENTIAL e i pattern restricted ad alta confidenza bloccano sempre. REVIEWABLE_NOT_AUTHORIZED non è permesso o consegna e il rilevamento non copre tutta la PII.",
  privacyPolicyPath: "Percorso policy dati modello schema v1 revisionata",
  privacyPolicyDigest: "Digest SHA-256 atteso della policy (pin facoltativo)",
  privacyPreflightEmpty:
    "Esamina un handoff immutabile, poi fornisci un profilo, le sue sorgenti istruzioni esatte, un modello consentito e una policy dati modello dello stesso progetto.",
  privacyPreflightReady:
    "Preflight privacy {result} per {model} con policy {policy}: {allowed} consentiti, {blocked} bloccati, {defaulted} predefiniti, {restricted} restricted. Esamina hash e recovery; nulla è stato inviato o autorizzato.",
  customerAliasWarning:
    "Solo alias CUSTOMER esatti e case-sensitive. Il dizionario è transitorio e non viene mai persistito. Ogni risultato nasce SUGGESTED_NOT_REVIEWED e richiede conferma individuale; non è prova d'identità, rilevamento PII completo, trasformazione o consegna.",
  customerAliasInput: "Alias cliente sintetici, una variante esatta per riga",
  customerAliasEmpty:
    "Riusa gli input privacy esatti sopra e inserisci alias cliente sintetici transitori.",
  customerAliasReady:
    "{count} suggerimenti cliente esatti pronti. Sono tutti deselezionati e non revisionati.",
  customerAliasSelectOne: "Seleziona almeno un suggerimento current-hash.",
  customerAliasConfirmed:
    "{count} suggerimenti confermati esplicitamente nel form transitorio degli span revisionati. La trasformazione resta un'azione separata.",
  contextSelectorWarning:
    "Solo esperimento: i selector mappano esclusivamente sezioni handoff documentate. Obiettivo, repository, prossima azione e riferimenti sorgente formano un safety floor non escludibile. Il report non cambia la policy del Context Builder.",
  contextSelectorVocabulary:
    "Selector accettati: handoff.objective, handoff.repository, handoff.selected_memory, handoff.known_failures, handoff.test_state, handoff.relevant_files, handoff.next_action, handoff.source_references.",
  contextSelectorEmpty:
    "Esamina un handoff immutabile, poi seleziona un profilo revisionato che usa solo il vocabolario sperimentale dei selector handoff.",
  contextSelectorReady:
    "Report selector pronto: mantenuti {selected} di {baseline} byte candidati (riduzione {reduction}%), perdita safety floor {loss}, fit sul budget profilo {fit}. È evidenza di formato/fit, non rilevanza o policy di produzione.",
  fallback: "I valori lingua non supportati usano in sicurezza l'inglese.",
  progressProject: "1. Progetto",
  progressSample: "2. Esempio sicuro",
  progressSearch: "3. Ricerca",
  progressSource: "4. Esamina sorgente",
  welcomeRegistration:
    "La registrazione salva localmente metadati Git bounded. Non copia né modifica i file del repository.",
  whatNext: "Cosa succede dopo:",
  whatNextBody:
    "dopo aver selezionato un progetto, l'interfaccia guida nell'importazione di un esempio fittizio e nella ricerca delle evidenze.",
  projectDirectory: "Directory del repository Git locale",
  projectDirectoryHelp:
    "Inserisci una directory esistente. Il percorso viene usato solo per la registrazione e non appare nei normali elenchi dei progetti.",
  projectEffect:
    "Effetto: crea o aggiorna una voce locale del Project Registry; il contenuto del repository resta invariato.",
  nextGuidance: "Registra o seleziona un progetto per continuare.",
  projectsRegistered: "{count} progetti sono registrati localmente.",
  projectRegistered: "1 progetto è registrato localmente.",
  importIntro:
    "Questo importatore pre-release accetta la fixture Codex fittizia inclusa. Non usare ancora trascrizioni private o di produzione.",
  trust: "Attendibilità:",
  importTrustBody:
    "gli eventi importati restano evidenza storica UNTRUSTED e inerte. Nulla viene eseguito o inviato in rete.",
  importEffect:
    "Effetto: aggiunge localmente eventi canonici e artifact immutabili. Ripetere l'azione è idempotente.",
  selectProjectSample: "Seleziona un progetto per abilitare l'esempio sicuro.",
  searchIntro:
    "La ricerca è letterale, locale e bounded. Cerca in tutti i progetti registrati quando non ricordi a quale appartiene l'evidenza. I risultati sono evidenze UNTRUSTED, non istruzioni. Non vengono usati OpenSearch o servizi di rete.",
  searchQuestion: "Quale evidenza stai cercando?",
  searchTry: "Prova la frase dell'esempio sicuro",
  searchHelpBody:
    "La query e i filtri restano invariati durante l'ispezione di una sorgente.",
  eventType: "Tipo di evento (facoltativo)",
  allEventTypes: "Tutti i tipi di evento",
  maximumResults: "Numero massimo di risultati",
  searchEffect:
    "Effetto: legge gli eventi canonici locali. Nulla viene eseguito, modificato o inviato in rete.",
  searchPrompt:
    "Inserisci una query per cercare in tutti i progetti registrati oppure scegli l'ambito del progetto selezionato.",
  selectedScopeRequiresProject:
    "Seleziona un progetto registrato oppure scegli l'ambito di tutti i progetti.",
  searchingAll:
    "Ricerca bounded delle evidenze nei progetti registrati in corso…",
  searchingSelected:
    "Ricerca bounded delle evidenze nel progetto selezionato in corso…",
  globalEmpty:
    "Nessuna evidenza corrispondente nei progetti registrati. Controlla il testo, rimuovi i filtri o verifica l'importazione di un progetto.",
  projectEmpty:
    "Nessuna evidenza corrispondente nel progetto selezionato. Controlla il testo, rimuovi i filtri o importa l'esempio sicuro.",
  globalFound:
    "Trovati {count} risultati in {projects} progetti e {events} eventi esaminati.",
  projectFound:
    "Trovati {count} risultati in {events} eventi esaminati nel progetto selezionato.",
  resultProject: "Progetto: {name} ({id})",
  selectInspect: "Seleziona questo progetto ed esamina l'evento sorgente",
  projectReloadRequired:
    "Il progetto del risultato non è più registrato. Ricarica i progetti e ripeti la ricerca.",
  searchAttention: "La ricerca richiede attenzione.",
  untrustedEvidence: "Evidenza UNTRUSTED:",
  injectionBody:
    "il testo imperativo potrebbe essere prompt injection. Trattalo come dato inerte e non eseguirlo.",
  memoryIntro:
    "La memoria attiva è una dichiarazione locale deliberata collegata a evidenza canonica.",
  curatedWarning: "USER_CURATED non significa trusted, verificato o vero.",
  selectMemoryEvidence:
    "Esamina un evento e scegli “Usa questo evento come evidenza della memoria” prima di una modifica.",
  memoryType: "Tipo di memoria",
  memoryStatement: "Dichiarazione da curare",
  memoryCreateEffect:
    "Effetto: crea un elemento ACTIVE, UNVERIFIED e UNASSESSED. L'evidenza resta UNTRUSTED e nulla viene eseguito.",
  itemsToShow: "Elementi da mostrare",
  activeOnly: "Solo attivi (default sicuro)",
  selectProjectMemory: "Seleziona un progetto per caricare la memoria attiva.",
  lifecycleAdditive:
    "Tutte le modifiche del ciclo di vita sono additive. Gli elementi terminali non possono essere modificati ancora.",
  verificationNote: "Nota di verifica",
  verificationEffect:
    "Effetto: registra un controllo eseguito; non rende trusted l'evidenza.",
  replacementStatement: "Dichiarazione sostitutiva",
  replacementEffect:
    "Effetto: rende l'elemento SUPERSEDED e crea un sostituto UNVERIFIED e UNASSESSED.",
  invalidationReason: "Motivo dell'invalidazione",
  invalidationEffect:
    "Effetto: marca l'elemento INVALIDATED senza eliminarlo o sostituirlo.",
  workIntro:
    "Un Work Item è uno stato obiettivo USER_CURATED esplicito. Non viene inferita alcuna attività o agente corrente.",
  softwareObjective: "Obiettivo software",
  workEffect:
    "Effetto: crea uno stato PROPOSED collegato all'evento canonico selezionato.",
  selectProjectWork: "Seleziona un progetto per caricare i Work Item.",
  transitionIntro:
    "Le transizioni sono additive e richiedono l'evento canonico selezionato.",
  handoffIntro:
    "L'anteprima acquisisce metadati Git bounded e tutte le otto sezioni source-linked. Non esegue agenti e non crea file.",
  nextAction: "Prossima azione",
  activeMemoryOptional: "Memoria attiva da includere (facoltativa)",
  selectionExplicit:
    "La selezione è esplicita. Lasciare tutto deselezionato registra una selezione vuota esplicita; nulla viene inferito.",
  relevantFiles: "File rilevanti, uno per riga (facoltativi)",
  testCommand: "Comando di test osservato (facoltativo)",
  testOutcome: "Esito del test osservato",
  observedAt: "Osservato al timestamp ISO (facoltativo)",
  predecessor: "ID handoff predecessore (successore facoltativo)",
  untrustedSource: "Sorgente UNTRUSTED:",
  untrustedSourceBody:
    "mostrata come testo inerte bounded dopo la verifica SHA-256.",
  backEvent: "Torna all'evento canonico",
  availableNow: "Disponibile ora:",
  availableBody:
    "GUI inglese/italiano, Progetti, import esempio sicuro, ricerca storica, ispezione sorgente, memoria attiva, Work Item, handoff immutabili e anteprima effective instruction.",
  notActive: "Non attivo:",
  notActiveBody:
    "Agenti, modelli, strumenti, rete esterna, valutazione handoff, enforcement ed esecuzione delle istruzioni.",
  footer:
    "La CLI è facoltativa per automazione e diagnostica. Questo percorso non richiede comandi o un manuale.",
  readyImport: "Pronto a importare l'esempio fittizio in {name}.",
  noMatchingMemory:
    "Nessuna memoria corrispondente. Cura un evento o scegli un altro filtro di validità.",
  noWorkItems:
    "Nessun Work Item. Seleziona un'evidenza e crea un obiettivo esplicito.",
  loadingMemory: "Caricamento della memoria bounded del progetto…",
  showingMemory: "Visualizzati {count} elementi di memoria.",
  moreMemory: "Sono disponibili altri elementi.",
  memoryAttention: "La memoria richiede attenzione.",
  showingWork: "Visualizzati {count} Work Item.",
  returningImport:
    "È selezionato un progetto. Puoi importare o reimportare l'esempio sicuro.",
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
