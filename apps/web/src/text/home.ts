/**
 * Every sentence the opening screen says, in both languages.
 *
 * Two rules shaped this vocabulary. Nothing here promises an assistant: the field
 * asks to search your history and the answer says it was composed from what is
 * already stored, because no model is connected and implying one would be the
 * largest expectation this product can fail. And nothing here is a domain
 * constant: the ordinary view carries no upper-case identifier, so a state
 * arrives as a word a person uses.
 */
import { catalogues } from "./catalog.ts";

export const HOME_TEXT = Object.freeze({
  navHome: { en: "Your work", it: "Il tuo lavoro" },
  homeIntro: {
    en: "Everything you have worked on, most recent first. Ask a question to search it.",
    it: "Tutto ciò su cui hai lavorato, dal più recente. Fai una domanda per cercarci dentro.",
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
    en: "Write a question below and it is kept, or add a project to bring in the sessions you have already had.",
    it: "Scrivi una domanda qui sotto e viene conservata, oppure aggiungi un progetto per portare dentro le sessioni che hai già fatto.",
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
  homeConversationShown: {
    en: "The first {shown} moments of {total}.",
    it: "I primi {shown} momenti su {total}.",
  },
  homeConversationAll: {
    en: "{count} moments, in the order they happened.",
    it: "{count} momenti, nell'ordine in cui sono avvenuti.",
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
  homeMomentSource: {
    en: "Record {position} of the imported transcript · fingerprint {hash}",
    it: "Record {position} del transcript importato · impronta {hash}",
  },
  homeMomentOwnSource: {
    en: "Written here · fingerprint {hash}",
    it: "Scritto qui · impronta {hash}",
  },
  homeMomentElsewhere: {
    en: "Kept as a separate file, and not shown here.",
    it: "Conservato come file a parte, e non mostrato qui.",
  },
  homeMomentAsStored: {
    en: "Shown exactly as it was stored.",
    it: "Mostrato esattamente come è stato conservato.",
  },
});

export const HOME_CATALOGUES = catalogues(HOME_TEXT);
