import { catalogues, type TextEntries } from "./catalog.ts";
export const CONTINUATION_TEXT = {
  continueSendLimits: {
    en: "One request, at most 512 output tokens, 30 second timeout. The passphrase protects the local name mapping for this request. Review the prepared text before confirming. A retry needs a new review and may duplicate cost.",
    it: "Una richiesta, massimo 512 token di risposta, timeout di 30 secondi. La passphrase protegge la mappatura locale dei nomi per questa richiesta. Rileggi il testo preparato prima di confermare. Riprovare richiede una nuova revisione e può duplicare il costo.",
  },
  continueSend: {
    en: "Confirm and send once",
    it: "Conferma e invia una volta",
  },
  continueResponse: { en: "Saved response", it: "Risposta conservata" },
  continueSending: {
    en: "Request in progress. Do not send again.",
    it: "Richiesta in corso. Non inviare di nuovo.",
  },
  continueSaved: {
    en: "Response saved in this conversation. You can prepare the next question.",
    it: "Risposta conservata in questa conversazione. Puoi preparare la prossima domanda.",
  },
  continueDeliveryProblem: {
    en: "Delivery or local saving did not complete: {reason}. No automatic retry. Check the attempt before preparing another request; data may already have been sent.",
    it: "Invio o salvataggio locale non completato: {reason}. Nessun tentativo automatico. Controlla il tentativo prima di preparare una nuova richiesta: i dati potrebbero essere già stati inviati.",
  },
  continueOpen: {
    en: "Continue with another assistant",
    it: "Continua con un altro assistente",
  },
  continueHeading: {
    en: "Prepare the continuation",
    it: "Prepara la continuazione",
  },
  continueLocal: {
    en: "Preparation is local. A separate confirmation is available only when the host has a configured transport.",
    it: "La preparazione è locale. La conferma di invio è disponibile solo quando il server ha un trasporto configurato.",
  },
  continueBack: { en: "Back to the summary", it: "Torna al riepilogo" },
  continueQuestion: {
    en: "What would you like to ask next?",
    it: "Che cosa vuoi chiedere adesso?",
  },
  continueNames: {
    en: "Names to protect, one per line",
    it: "Nomi da proteggere, uno per riga",
  },
  continuePrepare: {
    en: "Prepare the privacy review",
    it: "Prepara la revisione privacy",
  },
  continueSetup: {
    en: "Set up the recipient",
    it: "Configura il destinatario",
  },
  continueSetupHelp: {
    en: "Choose a name and the model identifier, then select the local profile, privacy policy and instruction files you have reviewed. These settings last until the application restarts. They do not verify an account or a key.",
    it: "Scegli un nome e l'identificativo del modello, poi indica i file locali di profilo, policy privacy e istruzioni che hai verificato. Le impostazioni durano fino al riavvio dell'applicazione. Non verificano un account o una chiave.",
  },
  continueLabel: { en: "Recipient name", it: "Nome del destinatario" },
  continueModel: { en: "Model identifier", it: "Identificativo del modello" },
  continueProfile: {
    en: "Reviewed profile file",
    it: "File del profilo verificato",
  },
  continuePolicy: {
    en: "Reviewed privacy policy file",
    it: "File della policy privacy verificata",
  },
  continueInstructions: {
    en: "Reviewed instruction files, one per line",
    it: "File delle istruzioni verificate, uno per riga",
  },
  continueTask: {
    en: "Task name, if required by the profile",
    it: "Nome dell'attività, se richiesto dal profilo",
  },
  continueConfigure: {
    en: "Use these local settings",
    it: "Usa queste impostazioni locali",
  },
  continueLoading: {
    en: "Preparing locally...",
    it: "Preparazione locale in corso...",
  },
  continueReady: {
    en: "{label} / {model}. Starting from the summary kept on {date}.",
    it: "{label} / {model}. Punto di partenza: riepilogo conservato il {date}.",
  },
  continueChanged: {
    en: "The repository has changed since this summary. You can return to it and keep a successor; your question stays here.",
    it: "Il repository è cambiato dopo questo riepilogo. Puoi tornare al riepilogo e conservarne uno successivo; la domanda resta qui.",
  },
  continueOmitted: {
    en: "Some content did not fit the selected budgets. Review the omissions before continuing.",
    it: "Parte del contenuto non rientra nei limiti scelti. Controlla le omissioni prima di continuare.",
  },
  continueLimit: {
    en: "Automatic detection can miss a name. Review the text and proposed substitutions before making the protected version.",
    it: "Il rilevamento automatico può non trovare un nome. Controlla il testo e le sostituzioni proposte prima di creare la versione protetta.",
  },
  continueProtectSelection: {
    en: "Protect selected words",
    it: "Proteggi le parole selezionate",
  },
  continuePassphrase: {
    en: "Passphrase for local name protection",
    it: "Passphrase per proteggere i nomi in locale",
  },
  continuePassphraseHelp: {
    en: "Enter it once. It stays only in memory until this request finishes and is needed to restore protected names in the saved answer.",
    it: "Inseriscila una volta. Resta solo in memoria fino alla fine di questa richiesta e serve a ripristinare i nomi protetti nella risposta conservata.",
  },
  continueProtect: {
    en: "Create the protected local version",
    it: "Crea la versione protetta locale",
  },
  continuePreview: { en: "Exact prepared text", it: "Testo esatto preparato" },
  continueReview: {
    en: "Review the text and substitutions",
    it: "Rivedi il testo e le sostituzioni",
  },
  continueFailed: {
    en: "Preparation failed. Review the current summary and local settings, then try again. Nothing was sent.",
    it: "Preparazione non riuscita. Controlla il riepilogo attuale e le impostazioni locali, poi riprova. Non è stato inviato nulla.",
  },
  continueMissing: {
    en: "First declare this conversation as work and keep its summary using the existing controls below.",
    it: "Prima dichiara questa conversazione come lavoro e conserva il riepilogo con i comandi già presenti qui sotto.",
  },
  continueBlocked: {
    en: "The privacy policy blocks this content. Review the source and policy before preparing again.",
    it: "La policy privacy blocca questo contenuto. Controlla la fonte e la policy prima di preparare nuovamente.",
  },
  continueExpired: {
    en: "The proposal expired, was used, or its sources changed. Prepare it again with your question below.",
    it: "La proposta è scaduta, è già stata usata oppure le fonti sono cambiate. Preparala nuovamente con la domanda qui sotto.",
  },
} satisfies TextEntries;
export const CONTINUATION_CATALOGUES = catalogues(CONTINUATION_TEXT);
