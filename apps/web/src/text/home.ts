/**
 * Every sentence the opening screen says, in both languages.
 *
 * One server-side turn is coordinated through a simulated local transport by
 * default. No text may imply real provider access or credential storage.
 */
import { catalogues } from "./catalog.ts";

export const HOME_TEXT = Object.freeze({
  navHome: { en: "Conversations", it: "Conversazioni" },
  homeIntro: {
    en: "Choose a conversation and continue from its latest message.",
    it: "Scegli una conversazione e continua dal messaggio più recente.",
  },
  homeNewConversation: { en: "New chat", it: "Nuova chat" },
  homeNewConversationTitle: {
    en: "New conversation",
    it: "Nuova conversazione",
  },
  homeSearchNavigation: { en: "Search history", it: "Cerca nella storia" },
  homeSearchHeading: { en: "Search history", it: "Cerca nella storia" },
  homeSearchIntro: {
    en: "Search conversations and notes already stored on this computer.",
    it: "Cerca nelle conversazioni e negli appunti già conservati su questo computer.",
  },
  homeModelLabel: {
    en: "Model for the next message",
    it: "Modello per il prossimo messaggio",
  },
  modelTargetChoose: {
    en: "Choose a configured model",
    it: "Scegli un modello configurato",
  },
  modelTargetHeading: { en: "Model targets", it: "Target dei modelli" },
  modelTargetIntro: {
    en: "Named target metadata is stored locally. Credentials and provider access are not stored or enabled here. Without the explicit transport opt-in, answers are simulated; agents and local models are not connected yet.",
    it: "I metadati dei target sono conservati localmente. Credenziali e accesso ai provider non vengono conservati né abilitati qui. Senza l'attivazione esplicita del trasporto le risposte sono simulate; agenti e modelli locali non sono ancora collegati.",
  },
  modelTargetId: { en: "Target ID", it: "ID target" },
  modelTargetName: { en: "Display name", it: "Nome visualizzato" },
  modelTargetKind: { en: "Target kind", it: "Tipo di target" },
  modelTargetKindResponses: {
    en: "OpenAI Responses - direct model delivery (API)",
    it: "OpenAI Responses - consegna diretta al modello (API)",
  },
  modelTargetKindCodex: {
    en: "Codex CLI - subscription agent",
    it: "Codex CLI - agente in abbonamento",
  },
  modelTargetKindClaude: {
    en: "Claude Code - subscription agent",
    it: "Claude Code - agente in abbonamento",
  },
  modelTargetKindLocal: {
    en: "llama-server on loopback - local model",
    it: "llama-server su loopback - modello locale",
  },
  modelTargetClassDelivery: {
    en: "Direct model delivery",
    it: "Consegna diretta al modello",
  },
  modelTargetClassAgent: {
    en: "Subscription agent",
    it: "Agente in abbonamento",
  },
  modelTargetClassLocal: { en: "Local model", it: "Modello locale" },
  modelTargetClassNone: { en: "No kind", it: "Senza tipo" },
  modelTargetDetail: {
    en: "{class} · {kind} · {model} · {boundary}",
    it: "{class} · {kind} · {model} · {boundary}",
  },
  modelTargetModel: { en: "Model identifier", it: "Identificativo modello" },
  modelTargetBoundary: {
    en: "Execution boundary",
    it: "Confine di esecuzione",
  },
  modelTargetProfile: {
    en: "Reviewed profile reference",
    it: "Riferimento al profilo revisionato",
  },
  modelTargetPolicy: {
    en: "Reviewed policy reference",
    it: "Riferimento alla policy revisionata",
  },
  modelTargetInstructions: {
    en: "Instruction references, one per line",
    it: "Riferimenti alle istruzioni, uno per riga",
  },
  modelTargetInputLimit: {
    en: "Maximum input bytes",
    it: "Byte massimi in ingresso",
  },
  modelTargetOutputLimit: {
    en: "Maximum output bytes",
    it: "Byte massimi in uscita",
  },
  modelTargetEnabledLabel: {
    en: "Enabled for selection",
    it: "Abilitato per la selezione",
  },
  modelTargetSave: { en: "Save local target", it: "Salva target locale" },
  modelTargetDefault: {
    en: "Default model target",
    it: "Target modello predefinito",
  },
  modelTargetNoDefault: { en: "No default", it: "Nessun predefinito" },
  modelTargetSaveDefault: { en: "Save default", it: "Salva predefinito" },
  modelTargetEmpty: {
    en: "No model target is configured.",
    it: "Nessun target modello è configurato.",
  },
  modelTargetEnabled: { en: "Available", it: "Disponibile" },
  modelTargetDisabled: { en: "Disabled", it: "Disabilitato" },
  modelTargetSimulated: {
    en: "Available, simulated answers",
    it: "Disponibile, risposte simulate",
  },
  modelTargetUnclassified: {
    en: "No kind: save it again choosing a kind",
    it: "Senza tipo: salvalo di nuovo scegliendo un tipo",
  },
  modelTargetNotQualified: {
    en: "Adapter not qualified yet",
    it: "Adattatore non ancora qualificato",
  },
  modelTargetNotConnected: {
    en: "Qualified offline, not connected yet",
    it: "Qualificato offline, non ancora collegato",
  },
  modelTargetOptionSimulated: {
    en: "{name} - simulated",
    it: "{name} - simulato",
  },
  modelTargetOptionUnavailable: {
    en: "{name} - unavailable",
    it: "{name} - non disponibile",
  },
  modelTargetSaved: {
    en: "{name} was saved locally. No credential or provider was activated.",
    it: "{name} è stato salvato localmente. Nessuna credenziale o provider è stato attivato.",
  },
  modelTargetDefaultSaved: {
    en: "The local default was saved.",
    it: "Il predefinito locale è stato salvato.",
  },
  homeContextOpen: { en: "Context", it: "Contesto" },
  homeContextHeading: { en: "Conversation context", it: "Contesto" },
  homeContextSummary: {
    en: "Context follows this conversation and is prepared automatically immediately before each turn.",
    it: "Il contesto segue questa conversazione e viene preparato automaticamente subito prima di ogni turno.",
  },
  homeContextMaterial: {
    en: "Material currently visible in the conversation: {count} grouped entries.",
    it: "Materiale attualmente visibile nella conversazione: {count} elementi raggruppati.",
  },
  homeProtectionOpen: {
    en: "Automatic protection",
    it: "Protezione automatica",
  },
  homeProtectionHeading: {
    en: "Automatic protection",
    it: "Protezione automatica",
  },
  homeProtectionSummary: {
    en: "External turns are protected automatically before delivery with a stable map for this project or General.",
    it: "I turni esterni vengono protetti automaticamente prima dell'invio con una mappa stabile per questo progetto o Generale.",
  },
  homeProtectionFake: {
    en: "The built-in detector uses an app-managed local key. The standard server still uses a local simulated transport and makes no provider or network call. Replacements in the last message: {count}.",
    it: "Il rilevatore integrato usa una chiave locale gestita dall'app. Il server standard usa ancora un trasporto locale simulato e non chiama provider o rete. Sostituzioni nell'ultimo messaggio: {count}.",
  },
  homeProtectionPreviewIntro: {
    en: "This preview stays local and sends nothing. To keep placeholders consistent when you send, new associations remain in the protected local map.",
    it: "Questa anteprima resta locale e non invia nulla. Per mantenere gli stessi segnaposto al momento dell'invio, le nuove associazioni restano nella mappa locale protetta.",
  },
  homeProtectionPreviewAction: {
    en: "Show protections",
    it: "Mostra protezioni",
  },
  homeReviewRequired: {
    en: "Send only the content shown here",
    it: "Invia solo il contenuto mostrato qui",
  },
  homeReviewReady: {
    en: "Send will use exactly this content for {model}, until {expires}. A change to sources or settings will stop it. Nothing has been sent.",
    it: "Invia userà esattamente questo contenuto per {model}, fino alle {expires}. Se fonti o impostazioni cambiano, l'invio si fermerà. Non è stato inviato nulla.",
  },
  homeReviewInvalid: {
    en: "The review is no longer valid. Keep the draft and reopen Show protections to review it again. Nothing was sent.",
    it: "La revisione non è più valida. Conserva la bozza e riapri Mostra protezioni per rivederla. Non è stato inviato nulla.",
  },
  homeReviewRefresh: {
    en: "Open Show protections to review this draft before sending, or turn off sending only the reviewed content.",
    it: "Apri Mostra protezioni per rivedere questa bozza prima dell'invio, oppure disattiva l'invio del solo contenuto revisionato.",
  },
  homeReviewUnavailable: {
    en: "A reviewed send cannot be prepared right now. Keep the draft and try the preview again in a few minutes.",
    it: "Non è possibile preparare ora un invio revisionato. Conserva la bozza e riprova l'anteprima fra pochi minuti.",
  },
  homeReviewExactText: {
    en: "Exact text prepared for sending",
    it: "Testo esatto preparato per l'invio",
  },
  homeProtectionPreviewHide: {
    en: "Hide protections",
    it: "Nascondi protezioni",
  },
  homeProtectionPreviewManage: {
    en: "Manage protected terms",
    it: "Gestisci termini protetti",
  },
  homeProtectionPreviewEmpty: {
    en: "Write a message first, then preview its protection here.",
    it: "Prima scrivi un messaggio, poi controlla qui la sua protezione.",
  },
  homeProtectionPreviewUnavailable: {
    en: "Send the first message to create this conversation; protection can be previewed before later messages.",
    it: "Invia il primo messaggio per creare questa conversazione; dai messaggi successivi potrai controllare prima la protezione.",
  },
  homeProtectionPreviewReady: {
    en: "Preview of the draft alone. Replacements: {count}. Unchanged values were not recognized automatically; add them to protected terms if needed.",
    it: "Anteprima della sola bozza. Sostituzioni: {count}. I valori rimasti invariati non sono stati riconosciuti automaticamente; aggiungili ai termini protetti se serve.",
  },
  /**
   * Counted values are named rather than counted into the sentence: "1 sezioni"
   * is wrong in Italian, and one key per grammatical number, multiplied by the
   * three counts this sentence carries, would be eight sentences to keep in step.
   */
  homeProtectionPayloadReady: {
    en: "Preview of everything that would be sent to {model}. Sections: {sections}. Bytes: {bytes}. Replacements: {count}. Open a section to read it. Unchanged values were not recognized automatically; add them to protected terms if needed.",
    it: "Anteprima di tutto ciò che verrebbe inviato a {model}. Sezioni: {sections}. Byte: {bytes}. Sostituzioni: {count}. Apri una sezione per leggerla. I valori rimasti invariati non sono stati riconosciuti automaticamente; aggiungili ai termini protetti se serve.",
  },
  homeProtectionPayloadPreamble: {
    en: "Context heading",
    it: "Intestazione del contesto",
  },
  homeProtectionPayloadEnvelope: {
    en: "Scope, instructions, sources and omissions",
    it: "Ambito, istruzioni, fonti e omissioni",
  },
  homeProtectionPayloadReadings: {
    en: "Earlier messages included",
    it: "Messaggi precedenti inclusi",
  },
  homeProtectionPayloadMemory: {
    en: "Memory of linked projects",
    it: "Memoria dei progetti collegati",
  },
  homeProtectionPayloadQuestion: {
    en: "Your message",
    it: "Il tuo messaggio",
  },
  homeProtectionPayloadSectionMeta: {
    en: "items: {items} · placeholders: {placeholders}",
    it: "elementi: {items} · segnaposto: {placeholders}",
  },
  homeProtectionPayloadSectionPlaceholders: {
    en: "placeholders: {placeholders}",
    it: "segnaposto: {placeholders}",
  },
  /**
   * Reached only with a model already chosen, because a draft without one never
   * composes a payload at all: the sentence names the obstacle that is actually
   * there — a destination this send cannot use — instead of asking for a choice
   * the status line beside it says was already made.
   */
  homeProtectionPayloadBlockedTarget: {
    en: "This model is not a destination an external send can use, so there is nothing to compose. Nothing was sent and the draft is still here.",
    it: "Questo modello non è una destinazione utilizzabile per un invio esterno, quindi non c'è nulla da comporre. Nulla è stato inviato e la bozza è ancora qui.",
  },
  homeProtectionPayloadBlockedPrivacy: {
    en: "This send would be refused: the composed context holds data your local rule does not let out. Nothing was sent and the draft is still here.",
    it: "Questo invio verrebbe rifiutato: il contesto composto contiene dati che la tua regola locale non lascia uscire. Nulla è stato inviato e la bozza è ancora qui.",
  },
  homeProtectionPayloadBlockedContext: {
    en: "The context could not be composed locally, so there is nothing to show. Nothing was sent and the draft is still here.",
    it: "Non è stato possibile comporre il contesto in locale, quindi non c'è nulla da mostrare. Nulla è stato inviato e la bozza è ancora qui.",
  },
  homeProtectionPreviewFailed: {
    en: "The protected preview is unavailable. Nothing was sent and the draft is still here.",
    it: "L'anteprima protetta non è disponibile. Nulla è stato inviato e la bozza è ancora qui.",
  },
  appearance: { en: "Appearance", it: "Aspetto" },
  appearanceHelp: {
    en: "Stays in this browser, like the language. Following the system also follows it when it changes; reduced motion always follows the operating system.",
    it: "Resta in questo browser, come la lingua. Seguire il sistema significa seguirlo anche quando cambia; il movimento ridotto segue sempre il sistema operativo.",
  },
  appearanceSystem: { en: "Follow the system", it: "Segui il sistema" },
  appearanceLight: { en: "Light", it: "Chiaro" },
  appearanceDark: { en: "Dark", it: "Scuro" },
  homeProtectionTermLabel: {
    en: "Also protect this value",
    it: "Proteggi anche questo valore",
  },
  homeProtectionTermKind: {
    en: "Kind of data",
    it: "Tipo di dato",
  },
  homeProtectionTermAdd: {
    en: "Protect it",
    it: "Proteggilo",
  },
  homeProtectionTermAdded: {
    en: "From the next message, {term} leaves as {placeholder} and comes back as itself.",
    it: "Dal prossimo messaggio, {term} esce come {placeholder} e torna con il suo nome.",
  },
  homeProtectionTermKnown: {
    en: "{term} was already protected as {placeholder}.",
    it: "{term} era già protetto come {placeholder}.",
  },
  homeProtectionTermConflict: {
    en: "{term} is already protected as another kind of data. Keep that kind, or protect a different value.",
    it: "{term} è già protetto come un altro tipo di dato. Tieni quel tipo, oppure proteggi un valore diverso.",
  },
  homeProtectionTermRefused: {
    en: "{term} was not protected, and nothing changed. Check the value and try again.",
    it: "{term} non è stato protetto e nulla è cambiato. Controlla il valore e riprova.",
  },
  homeProtectionTermValueInvalid: {
    en: "{term} cannot be protected as written, and nothing changed. Use at least two characters, keep the value short, and avoid square brackets.",
    it: "{term} non può essere protetto così com'è e nulla è cambiato. Usa almeno due caratteri, tieni il valore corto ed evita le parentesi quadre.",
  },
  homeProtectionTermGuard: {
    en: "This page is no longer in step with the local application, so {term} was not protected and nothing changed. Copy your draft, reload the page, and name the value again.",
    it: "Questa pagina non è più allineata con l'applicazione locale, quindi {term} non è stato protetto e nulla è cambiato. Copia la bozza, ricarica la pagina e indica di nuovo il valore.",
  },
  homeProtectionTermScope: {
    en: "This conversation is no longer recognised locally, so {term} was not protected and nothing changed. Reopen it from the list, then name the value again.",
    it: "Questa conversazione non è più riconosciuta in locale, quindi {term} non è stato protetto e nulla è cambiato. Riaprila dall'elenco e indica di nuovo il valore.",
  },
  homeProtectionTermNotStored: {
    en: "The local protected map could not be written, so {term} was not protected and nothing changed. Your draft is still here; try again.",
    it: "Non è stato possibile scrivere la mappa protetta locale, quindi {term} non è stato protetto e nulla è cambiato. La bozza è ancora qui: riprova.",
  },
  homeProtectionTermUnreachable: {
    en: "The local application did not answer, so {term} was not protected and nothing changed. Your draft is still here; try again.",
    it: "L'applicazione locale non ha risposto, quindi {term} non è stato protetto e nulla è cambiato. La bozza è ancora qui: riprova.",
  },
  homeProtectionTermInvalid: {
    en: "Write at least two characters of the value to protect.",
    it: "Scrivi almeno due caratteri del valore da proteggere.",
  },
  homeProtectionTermUnavailable: {
    en: "Open a conversation, or start a new one, then name the values to protect here.",
    it: "Apri una conversazione, oppure iniziane una nuova, poi indica qui i valori da proteggere.",
  },
  homeProtectionKindPERSON: { en: "Person", it: "Persona" },
  homeProtectionKindORGANIZATION: { en: "Company", it: "Azienda" },
  homeProtectionKindCUSTOMER: { en: "Customer", it: "Cliente" },
  homeProtectionKindPROJECT: { en: "Project", it: "Progetto" },
  homeProtectionKindADDRESS: { en: "Address", it: "Indirizzo" },
  homeProtectionKindOTHER: { en: "Other value", it: "Altro valore" },
  automaticProtectionSettingsTitle: {
    en: "Automatic protection",
    it: "Protezione automatica",
  },
  automaticProtectionSettingsBody: {
    en: "External messages are protected with a stable project or General map before delivery. No daily passphrase or preview is required.",
    it: "I messaggi esterni vengono protetti prima dell'invio con una mappa stabile del progetto o Generale. Non servono passphrase o anteprime quotidiane.",
  },
  automaticProtectionLoading: {
    en: "Checking locally...",
    it: "Verifica locale...",
  },
  automaticProtectionReady: {
    en: "Active - app-managed local key",
    it: "Attiva - chiave locale gestita dall'app",
  },
  automaticProtectionThreat: {
    en: "Residual threat: a process that can read the complete workspace home can read both managed keys and encrypted mappings.",
    it: "Rischio residuo: un processo che può leggere l'intera cartella del workspace può leggere sia le chiavi gestite sia le mappe cifrate.",
  },
  legacyMigrationTitle: {
    en: "Import earlier privacy mappings",
    it: "Importa mappe privacy precedenti",
  },
  legacyMigrationBody: {
    en: "Import a passphrase-protected mapping once into automatic protection. Original encrypted files are preserved.",
    it: "Importa una sola volta una mappa protetta da passphrase nella protezione automatica. I file cifrati originali vengono conservati.",
  },
  legacyMappingId: {
    en: "Earlier mapping identity",
    it: "Identità della mappa precedente",
  },
  legacyPassphrase: {
    en: "Earlier mapping passphrase",
    it: "Passphrase della mappa precedente",
  },
  legacyMigrate: {
    en: "Import into automatic protection",
    it: "Importa nella protezione automatica",
  },
  legacyNone: {
    en: "No earlier passphrase-protected mappings were found. {threat}",
    it: "Non sono state trovate mappe precedenti protette da passphrase. {threat}",
  },
  legacyFound: {
    en: "{count} earlier mapping files are available for one-time import. {threat}",
    it: "Sono disponibili {count} file di mappe precedenti per l'importazione una tantum. {threat}",
  },
  legacyMigrated: {
    en: "Imported {count} entries for project {project}. The original files were preserved.",
    it: "Importate {count} voci per il progetto {project}. I file originali sono stati conservati.",
  },
  homePanelClose: { en: "Close details", it: "Chiudi dettagli" },
  homeMessageLabel: { en: "Write a message", it: "Scrivi un messaggio" },
  homeMessagePlaceholder: {
    en: "Write a message...",
    it: "Scrivi un messaggio...",
  },
  homeSend: { en: "Send", it: "Invia" },
  homeTurnReady: {
    en: "Context updated. Ready to send one coordinated turn.",
    it: "Contesto aggiornato. Pronto per un turno coordinato.",
  },
  homeTurnEmpty: {
    en: "Write a message before sending.",
    it: "Scrivi un messaggio prima di inviare.",
  },
  homeTurnPreparing: {
    en: "Preparing context...",
    it: "Preparazione del contesto...",
  },
  homeTurnIncoming: {
    en: "Response incoming...",
    it: "Risposta in arrivo...",
  },
  homeTurnSaved: {
    en: "Response from {model} saved in this conversation. The standard server used the local simulation; no model was called.",
    it: "Risposta di {model} salvata in questa conversazione. Il server standard ha usato la simulazione locale; nessun modello è stato chiamato.",
  },
  homeTurnSavedLive: {
    en: "Response from {model} saved in this conversation.",
    it: "Risposta di {model} salvata in questa conversazione.",
  },
  homeTurnSavedAgent: {
    en: "Answer from the agent {model} saved in this conversation. It ran without tools in a separate, empty workspace.",
    it: "Risposta dell'agente {model} salvata in questa conversazione. È stato eseguito senza strumenti in uno spazio di lavoro separato e vuoto.",
  },
  homeProtectionAgentNote: {
    en: "This target is an agent. What you see is exactly the input AI Workspace supplies; the agent product adds its own instructions, which are not shown here.",
    it: "Questo target è un agente. Qui vedi esattamente l'input che AI Workspace fornisce; il prodotto agente aggiunge istruzioni proprie, che qui non compaiono.",
  },
  homeTurnDuplicate: {
    en: "The duplicate request reused the first result; it was not exposed twice.",
    it: "La richiesta duplicata ha riutilizzato il primo risultato; non è stata esposta due volte.",
  },
  homeTurnRefused: {
    en: "Nothing was exposed. The draft is still here: reload local context or target settings and retry.",
    it: "Niente è stato esposto. La bozza è ancora qui: ricarica il contesto locale o il target e riprova.",
  },
  homeTurnTargetUnavailable: {
    en: "The chosen target cannot answer in this version, so nothing was sent and the draft is still here. Settings shows what each target is missing; choose an available one to send.",
    it: "Il target scelto non può rispondere in questa versione, quindi nulla è stato inviato e la bozza è ancora qui. Le Impostazioni mostrano che cosa manca a ciascun target; scegline uno disponibile per inviare.",
  },
  homeTurnUnknown: {
    en: "Exposure may have happened, but the outcome is unknown. The draft was cleared and no automatic retry will run.",
    it: "L'esposizione potrebbe essere avvenuta, ma l'esito è ignoto. La bozza è stata rimossa e non partirà alcun nuovo tentativo automatico.",
  },
  homeTurnWithheld: {
    en: "A response arrived but was withheld or could not be saved. No automatic retry will run.",
    it: "Una risposta è arrivata ma è stata trattenuta o non è stato possibile salvarla. Non partirà alcun nuovo tentativo automatico.",
  },
  homeModelChanged: {
    en: "The next message will use {model}. Context follows the conversation.",
    it: "Il prossimo messaggio userà {model}. Il contesto segue la conversazione.",
  },
  homeModelLoaded: {
    en: "{model} is selected for this conversation.",
    it: "{model} è selezionato per questa conversazione.",
  },
  homeTargetRequired: {
    en: "Configure and choose a model target in Settings before sending.",
    it: "Configura e scegli un target modello nelle Impostazioni prima di inviare.",
  },
  homeTechnicalActivity: {
    en: "Technical activity ({count})",
    it: "Attività tecnica ({count})",
  },
  homeTechnicalActivityOne: {
    en: "Technical activity (1)",
    it: "Attività tecnica (1)",
  },
  homeAskLabel: { en: "Search your history", it: "Cerca nella tua storia" },
  homeAskHelp: {
    en: "Answers are composed from what is already on this computer. Nothing is sent anywhere.",
    it: "Le risposte sono composte da ciò che è già su questo computer. Niente viene inviato da nessuna parte.",
  },
  homeAskSubmit: { en: "Search", it: "Cerca" },
  homeListLabel: { en: "Your conversations", it: "Le tue conversazioni" },
  homeGroupTODAY: { en: "Today", it: "Oggi" },
  homeGroupYESTERDAY: { en: "Yesterday", it: "Ieri" },
  homeGroupEARLIER: { en: "Earlier", it: "Prima" },
  homeGroupUNDATED: { en: "Without a date", it: "Senza data" },
  homeLoading: { en: "Reading your work…", it: "Sto leggendo il tuo lavoro…" },
  homeEmpty: {
    en: "Nothing here yet.",
    it: "Qui non c'è ancora niente.",
  },
  homeEmptyDetail: {
    en: "Start a new chat or add a project to bring in conversations you already had.",
    it: "Avvia una nuova chat oppure aggiungi un progetto per portare dentro le conversazioni che hai già avuto.",
  },
  homeCounted: {
    en: "{shown} of {total} conversations.",
    it: "{shown} conversazioni su {total}.",
  },
  homeAllShown: {
    en: "{count} conversations.",
    it: "{count} conversazioni.",
  },
  homeUntitled: { en: "Untitled session", it: "Sessione senza titolo" },
  homeKindNOTES: { en: "Notes", it: "Appunti" },
  homeMoments: { en: "{count} moments", it: "{count} momenti" },
  homeOneMoment: { en: "1 moment", it: "1 momento" },
  homeNoMoments: { en: "still empty", it: "ancora vuota" },
  homeStatePROPOSED: { en: "to start", it: "da iniziare" },
  homeStateACTIVE: { en: "in progress", it: "in corso" },
  homeStateBLOCKED: { en: "blocked", it: "bloccato" },
  homeStateCOMPLETED: { en: "done", it: "concluso" },
  homeAnswerHeading: { en: "What I found", it: "Che cosa ho trovato" },
  homeAnswerComposed: {
    en: "Composed from {count} moments already stored here. Each one says where it comes from and why it came up.",
    it: "Composta da {count} momenti già conservati qui. Ognuno dice da dove viene e perché è comparso.",
  },
  homeAnswerNone: {
    en: "Nothing in your history matches that.",
    it: "Niente nella tua storia corrisponde.",
  },
  homeAnswerNoneDetail: {
    en: "Try fewer words, or words you would have written at the time.",
    it: "Prova con meno parole, o con le parole che avresti scritto allora.",
  },
  homeAnswerSearching: { en: "Searching…", it: "Sto cercando…" },
  homeAnswerFailed: {
    en: "That search could not be completed.",
    it: "Non è stato possibile completare la ricerca.",
  },
  homeFromNotes: { en: "From your notes", it: "Dai tuoi appunti" },
  homeFromProject: { en: "From {name}", it: "Da {name}" },
  homeOpenMoment: { en: "See the original", it: "Vedi l'originale" },
  homeTechnicalHeading: { en: "Technical view", it: "Vista tecnica" },
  homeTechnicalIntro: {
    en: "Provenance, integrity checks, exact states and the original vocabulary. Some of these screens are still in their old shape and are being rebuilt.",
    it: "Provenienza, verifiche di integrità, stati esatti e vocabolario originale. Alcune di queste schermate sono ancora nella forma vecchia e sono in corso di rifacimento.",
  },
  homeRestartHelp: {
    en: "Composed from what is already stored. It is never saved and never leaves this computer.",
    it: "Composto da ciò che è già conservato. Non viene mai salvato e non lascia mai questo computer.",
  },
  homeRestartFor: {
    en: "Carry the work on {name} to another assistant.",
    it: "Porta il lavoro su {name} a un altro assistente.",
  },
  homeAskEmpty: {
    en: "Write what you are looking for first.",
    it: "Scrivi prima che cosa stai cercando.",
  },
  /**
   * A conversation a row opened. The words below name who spoke, because the
   * stored constants are the domain's vocabulary and not a reader's.
   */
  homeConversationOpening: {
    en: "Opening that conversation…",
    it: "Sto aprendo quella conversazione…",
  },
  homeConversationGone: {
    en: "That conversation is no longer here.",
    it: "Quella conversazione non è più qui.",
  },
  homeConversationFailed: {
    en: "That conversation could not be opened.",
    it: "Non è stato possibile aprire quella conversazione.",
  },
  homeConversationClose: {
    en: "Close this conversation",
    it: "Chiudi questa conversazione",
  },
  /**
   * The scrolling box the moments live in. It is named because a reader who arrives
   * by keyboard lands on it, and "list" alone would not say which list.
   */
  homeConversationMomentsLabel: {
    en: "The moments of this conversation",
    it: "I momenti di questa conversazione",
  },
  homeConversationShown: {
    en: "The first {shown} moments of {total}.",
    it: "I primi {shown} momenti su {total}.",
  },
  homeConversationAll: {
    en: "{count} moments, in the order they happened.",
    it: "{count} momenti, nell'ordine in cui sono avvenuti.",
  },
  homeRestartSignalCONTEXT_PRESSURE: {
    en: "Restart summary suggested: estimated context pressure.",
    it: "Riepilogo per ripartire consigliato: pressione del contesto stimata.",
  },
  homeRestartSignalNEW_MATERIAL: {
    en: "Restart summary suggested: new moments since the kept summary.",
    it: "Riepilogo per ripartire consigliato: nuovi momenti dopo quello conservato.",
  },
  homeRestartSignalCONTEXT_PRESSURE_AND_NEW_MATERIAL: {
    en: "Restart summary suggested: estimated context pressure and new moments since the kept summary.",
    it: "Riepilogo per ripartire consigliato: pressione del contesto stimata e nuovi momenti dopo quello conservato.",
  },
  homeMomentUSER_MESSAGE: { en: "You wrote", it: "Hai scritto" },
  /**
   * The reply, named without naming who gave it: this screen may not promise an
   * interlocutor, and a moment that already happened does not need one to be read.
   */
  homeMomentAGENT_MESSAGE: { en: "The reply", it: "La risposta" },
  homeMomentTOOL_CALL: {
    en: "A tool was used",
    it: "È stato usato uno strumento",
  },
  homeMomentTOOL_RESULT: {
    en: "A tool answered",
    it: "Uno strumento ha risposto",
  },
  homeMomentCOMMAND_RESULT: {
    en: "A command ran",
    it: "È stato eseguito un comando",
  },
  homeMomentFILE_CHANGE: { en: "A file changed", it: "Un file è cambiato" },
  homeMomentTEST_RESULT: {
    en: "Tests ran",
    it: "Sono stati eseguiti dei test",
  },
  homeMomentERROR: { en: "Something failed", it: "Qualcosa è andato storto" },
  homeMomentUNKNOWN: { en: "A moment", it: "Un momento" },
  /**
   * The source a moment came from. It is the whole reason this screen can be
   * believed, so it is stated on every moment rather than hidden behind a control.
   */
  homeMomentSourceSummary: {
    en: "Where this came from",
    it: "Da dove viene",
  },
  homeMomentSource: {
    en: "Record {position} of the imported transcript · fingerprint {hash}",
    it: "Record {position} del transcript importato · impronta {hash}",
  },
  homeMomentOwnSource: {
    en: "Written here · fingerprint {hash}",
    it: "Scritto qui · impronta {hash}",
  },
  homeMomentElsewhere: {
    en: "Kept as a separate local file.",
    it: "Conservato come file locale separato.",
  },
  homeMomentOpen: {
    en: "Read this moment",
    it: "Leggi questo momento",
  },
  homeMomentOpening: {
    en: "Reading and verifying its local file…",
    it: "Sto leggendo e verificando il file locale…",
  },
  homeMomentOpened: {
    en: "A bounded excerpt was read from its integrity-verified local file.",
    it: "È stato letto un estratto limitato del file locale verificato nella sua integrità.",
  },
  homeMomentUnavailable: {
    en: "Its local file could not be read and verified, so no text is shown.",
    it: "Non è stato possibile leggere e verificare il file locale, quindi il testo non viene mostrato.",
  },
  homeMomentAsStored: {
    en: "Shown exactly as it was stored.",
    it: "Mostrato esattamente come è stato conservato.",
  },
  /**
   * What arrived without being asked for. It is said out loud because work appearing
   * by itself is only reassuring when the product admits it did it.
   */
  homeArrivedLooking: {
    en: "Looking for new sessions in the folders you brought in before…",
    it: "Sto cercando sessioni nuove nelle cartelle che hai già portato dentro…",
  },
  homeArrived: {
    en: "{sessions} new sessions arrived on their own, with {moments} moments.",
    it: "Sono arrivate da sole {sessions} sessioni nuove, con {moments} momenti.",
  },
  homeArrivedOne: {
    en: "One new session arrived on its own, with {moments} moments.",
    it: "È arrivata da sola una sessione nuova, con {moments} momenti.",
  },
  homeArrivedUnreadable: {
    en: "{count} folders you imported from could not be read this time.",
    it: "{count} cartelle da cui avevi importato non sono leggibili questa volta.",
  },
});

export const HOME_CATALOGUES = catalogues(HOME_TEXT);
