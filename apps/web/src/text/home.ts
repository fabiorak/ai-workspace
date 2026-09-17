/**
 * Every sentence the opening screen says, in both languages.
 *
 * U3 coordinates one server-side turn through a simulated local transport by
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
    en: "Named target metadata is stored locally. Credentials and provider access are not stored or enabled here.",
    it: "I metadati dei target sono conservati localmente. Credenziali e accesso ai provider non vengono conservati né abilitati qui.",
  },
  modelTargetId: { en: "Target ID", it: "ID target" },
  modelTargetName: { en: "Display name", it: "Nome visualizzato" },
  modelTargetProvider: { en: "Provider kind", it: "Tipo di provider" },
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
  modelTargetEnabled: { en: "Enabled", it: "Abilitato" },
  modelTargetDisabled: { en: "Disabled", it: "Disabilitato" },
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
    en: "Check the current draft before sending. Highlighted placeholders are the values that would leave this computer. This local preview is optional and sends nothing.",
    it: "Controlla la bozza corrente prima dell'invio. I segnaposto evidenziati sono i valori che uscirebbero da questo computer. L'anteprima locale è facoltativa e non invia nulla.",
  },
  homeProtectionPreviewAction: {
    en: "Preview this draft",
    it: "Controlla questa bozza",
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
    en: "Protected preview ready. Replacements: {count}. Unchanged text was not recognized automatically.",
    it: "Anteprima protetta pronta. Sostituzioni: {count}. Il testo rimasto invariato non è stato riconosciuto automaticamente.",
  },
  homeProtectionPreviewFailed: {
    en: "The protected preview is unavailable. Nothing was sent and the draft is still here.",
    it: "L'anteprima protetta non è disponibile. Nulla è stato inviato e la bozza è ancora qui.",
  },
  appearance: { en: "Appearance", it: "Aspetto" },
  appearanceHelp: {
    en: "Stays in this browser, like the language. Following the system also follows it when it changes.",
    it: "Resta in questo browser, come la lingua. Seguire il sistema significa seguirlo anche quando cambia.",
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
  homeProtectionTermInvalid: {
    en: "Write at least two characters of the value to protect.",
    it: "Scrivi almeno due caratteri del valore da proteggere.",
  },
  homeProtectionTermUnavailable: {
    en: "Send a first message, then this conversation can protect named values.",
    it: "Invia un primo messaggio: da quel momento questa conversazione può proteggere valori indicati da te.",
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
  homeTurnDuplicate: {
    en: "The duplicate request reused the first result; it was not exposed twice.",
    it: "La richiesta duplicata ha riutilizzato il primo risultato; non è stata esposta due volte.",
  },
  homeTurnRefused: {
    en: "Nothing was exposed. The draft is still here: reload local context or target settings and retry.",
    it: "Niente è stato esposto. La bozza è ancora qui: ricarica il contesto locale o il target e riprova.",
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
