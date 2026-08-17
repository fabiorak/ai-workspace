# AI Workspace — Visione dell'esperienza d'uso

**Stato:** bersaglio dell'esperienza d'uso, non ancora realizzato
**Versione inglese:** [`EXPERIENCE_VISION_EN.md`](EXPERIENCE_VISION_EN.md) — le due
devono restare allineate; una modifica a una sola delle due è un difetto.
**Nota:** gli esempi usano nomi e contenuti inventati.

Questo documento fissa **come si deve sentire chi usa AI Workspace**, e serve da
bersaglio per ogni sprint successivo che tocchi l'interfaccia. Non descrive
un'architettura e non sostituisce nessun ADR: descrive l'esperienza che
l'architettura deve permettere.

---

## 1. Il punto di partenza

L'interfaccia attuale è **lo specchio fedele del modello interno**. Ogni concetto
del motore ha una schermata, un'etichetta e una casella da riempire. Tre misure
del problema, prese dal codice e dalla documentazione di oggi:

- i due file che producono ciò che l'utente legge (`apps/web/src/assets/shell.ts`
  e `apps/web/src/localization.ts`) contengono **373 occorrenze** di termini di
  dominio non ambigui come `UNTRUSTED`, `Context Pack`, `handoff`, `UNVERIFIED`,
  `SHA-256`, `UNASSESSED`, `LINK_ONLY`, `REVIEWABLE_NOT_AUTHORIZED`;
- il percorso di primo uso documentato in
  [`docs/user-guide/gui-first-journey.md`](../user-guide/gui-first-journey.md) ha
  **sedici passaggi**;
- per fare la prima azione utile — cercare qualcosa — bisogna impostare **cinque
  controlli** (ambito, progetto associato, testo, tipo di evento, numero massimo
  di risultati), e il campo del testo arriva perfino precompilato con la frase di
  prova `test failed`.

Nessuna di queste è una svista. Sono conseguenze coerenti di una disciplina che il
progetto si è dato — _non dichiarare mai più di quello che il prodotto fa davvero_
— applicata però **alla superficie visibile** invece che al comportamento. Il
risultato è un'interfaccia che parla al revisore di sicurezza invece che alla
persona che deve lavorare.

Il principio da correggere si enuncia in una riga:

> Una garanzia non va **stampata**, va **mantenuta**. Deve essere vera nel
> comportamento e consultabile a richiesta, non occupare permanentemente lo
> schermo.

---

## 2. Chi apre il prodotto

**Persona di riferimento:** una persona che lavora con uno o più assistenti basati
su modelli linguistici e che **non è addetta ai lavori**. Sa usare un programma
con un'interfaccia grafica familiare. Non conosce il vocabolario del dominio, non
ha letto il manuale, non lo leggerà, e non ha nessun motivo per sapere che dentro
il prodotto esistono eventi canonici, pacchetti di contesto o intervalli di byte.

Questa persona non vuole «amministrare la propria memoria di lavoro». Vuole
ritrovare una cosa e riprendere a lavorare.

Non è necessariamente una persona che scrive software: come dice il § 3, il
prodotto è generale, quindi la persona di riferimento può essere chi analizza
capitolati, chi confronta versioni di un contratto o chi tiene insieme la
documentazione di qualità di un'azienda. Nessuna di queste persone ha motivo di
sapere che cos'è un repository Git.

[`PRODUCT.md`](PRODUCT.md) contiene già il principio che questo lavoro realizza:
_«ogni interfaccia è autoguidante: percorsi di primo avvio, aiuto contestuale,
errori azionabili, esempi e istruzioni di recupero devono permettere a un nuovo
utente di completare il flusso senza leggere prima la documentazione del
progetto»_. L'interfaccia attuale non rispetta un principio che il prodotto si era
già dato.

---

## 3. Non è un prodotto per il codice: è un prodotto generale

### 3.1 Il documentale è già progettato, ma è fuori dall'orizzonte di consegna

AI Workspace è nato come prodotto **general purpose**, non come strumento per
repository di codice. La parte documentale è progettata in modo esteso, e si trova
in
[`AI_WORKSPACE_VISION_LONG_TERM_IT.md`](../AI_WORKSPACE_VISION_LONG_TERM_IT.md)
§§ 4–16. Comprende:

- i **tipi di repository** `SOFTWARE`, `DOCUMENTS`, `MIXED`, `LEGAL`, `TECHNICAL`,
  `RESEARCH`, `TENDER`, `QUALITY`, `POLICY`;
- la tabella di **equivalenza fra codice e documenti** (file sorgenti ↔ documenti,
  simboli ↔ sezioni e concetti, dipendenze fra moduli ↔ riferimenti fra documenti,
  errori e test ↔ incongruenze e lacune, revisione del codice ↔ revisione
  critica);
- la **pipeline documentale**: rilevamento file → parsing e normalizzazione →
  anonimizzazione → suddivisione strutturale → estrazione metadati →
  indicizzazione → estrazione relazioni → analisi → annotazioni e documenti
  derivati;
- i **formati**: PDF, DOCX, ODT, Markdown, TXT, HTML, CSV, XLSX, PPTX, email,
  immagini e PDF scansionati con riconoscimento ottico opzionale;
- il **Document Graph**, equivalente documentale del grafo del codice;
- una sezione intera sul **risparmio dei token** nei repository documentali;
- i tipi di attività documentali `DOCUMENT_ANALYSIS`, `DOCUMENT_COMPARISON`,
  `REQUIREMENT_EXTRACTION`, `CRITICAL_REVIEW`, `REPORT_GENERATION`,
  `COMPLIANCE_CHECK`, `MIXED_ANALYSIS`;
- un **Document Explorer** per l'interfaccia.

Quel documento dichiara di sé _«orizzonte esplorativo, non impegno di consegna»_,
e mette l'analisi documentale e i repository misti fra gli _«incrementi successivi
non richiesti per completare il Core MVP alpha»_.

**Conseguenza sul prodotto di oggi:** il vincolo al codice non è teorico. Per
registrare un progetto l'interfaccia chiede una _«Local Git repository
directory»_, l'importazione legge trascrizioni di assistenti per il codice, e il
tipo di repository non esiste da nessuna parte. Una persona con una cartella di
capitolati non può nemmeno cominciare.

### 3.2 Che cosa comporta per l'esperienza d'uso

1. la casella di ricerca deve trovare **documenti** allo stesso titolo delle
   conversazioni: una clausola in un capitolato è un risultato come una decisione
   presa tre giorni fa;
2. «riprendi da dove eri» vale per **un'analisi documentale interrotta** esattamente
   come per un lavoro sul codice;
3. la parola «progetto» nell'interfaccia **non deve implicare «repository Git»**.
   Si sceglie **una cartella**, e il prodotto capisce da sé cosa contiene;
4. il **tipo di repository è informazione interna**: la persona non lo dichiara, e
   nella vista normale non lo vede.

Questo documento non riporta il documentale nell'orizzonte di consegna: quella è
una decisione di scope, registrata fra i punti aperti del § 11. Fissa però un
vincolo per tutto ciò che si costruirà da qui in avanti: **nessuna nuova schermata
deve dare per scontato che dentro un progetto ci sia del codice.**

### 3.3 I prodotti di riferimento

Cinque prodotti open source sono il riferimento di questa visione, accomunati da
una cosa sola: **fanno un lavoro complesso dietro le quinte e non lo fanno pesare
a chi li usa.**

| Prodotto                                | Cosa se ne prende                                                               | Dove tocca AI Workspace                      |
| --------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------- |
| **OpenSearch**                          | una ricerca che trova, invece di una ricerca letterale                          | la casella del § 5.1                         |
| **Grafo dei sorgenti / Document Graph** | le relazioni fra le fonti ricostruite da sole, senza che l'utente le dichiari   | «da dove viene» e il riepilogo per ripartire |
| **TokenSave**                           | risparmiare contesto senza che l'utente debba pensare al risparmio              | preparazione automatica del contesto (§ 6.1) |
| **Presidio**                            | rilevamento automatico dei dati personali                                       | la proposta di anonimizzazione (§ 6.3)       |
| **Headroom**                            | intermediazione verso il modello con un pannello di controllo bello e leggibile | la conferma di uscita (§ 6.2) e il cruscotto |

Due di questi sono già citati nei documenti di progetto: OpenSearch compare nel
documento di progettazione come _«possibile adapter futuro, non una dipendenza»_,
e il Document Graph come equivalente documentale del grafo del codice. Presidio e
Headroom non compaiono affatto.

Da questi prodotti si prende **il modo di stare al mondo, non necessariamente il
codice.** Adottarne uno come dipendenza vera è una decisione strutturale che
richiede un ADR e non è decisa qui: resta in vigore la regola «nessuna dipendenza
esterna senza ADR», e per la GUI resta in vigore anche «zero dipendenze a
runtime».

Una lezione però si può prendere subito, e non costa niente: **Headroom dimostra
che un pannello di controllo può essere bello e leggibile senza spiegare la
propria architettura a chi lo guarda.** È esattamente il bersaglio del cruscotto.

---

## 4. I primi dieci secondi

All'apertura la persona vede **una cosa sola**, e capisce cosa fare senza leggere
niente:

```text
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│                        AI Workspace                          │
│                                                              │
│     ┌────────────────────────────────────────────────┐       │
│     │  Cerca una conversazione, un documento,     🔍 │       │
│     │  una decisione…                                │       │
│     └────────────────────────────────────────────────┘       │
│                                                              │
│   Riprendi da dove eri                                       │
│                                                              │
│   ┌──────────────────┐ ┌──────────────────┐ ┌─────────────┐  │
│   │ Rifacimento del  │ │ Perché non usare │ │ Capitolato  │  │
│   │ carrello         │ │ Redis            │ │ Comune di X │  │
│   │                  │ │                  │ │             │  │
│   │ ieri · 2 ore     │ │ 3 giorni fa      │ │ la settimana│  │
│   │ 12 test falliti  │ │ una decisione    │ │ scorsa      │  │
│   │ da sistemare     │ │ presa e motivata │ │ 4 lacune    │  │
│   └──────────────────┘ └──────────────────┘ └─────────────┘  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

Nessuna barra laterale con nove voci. Nessun riquadro di avvertimento. Nessun
gergo. Le date in forma naturale («ieri», «3 giorni fa»), i titoli in italiano
corrente, una riga di riassunto per capire di cosa si trattava. La terza scheda
non è un repository di codice, e questo non richiede nessuna spiegazione
all'utente.

Il primo avvio, quando non c'è ancora niente da riprendere, mostra **una sola
proposta**: le cartelle di lavoro che il prodotto ha trovato sul computer, da
scegliere in un elenco. Non un campo dove scrivere a mano il percorso di una
cartella, e non la parola «Git».

---

## 5. Le tre azioni fondamentali

Tutto il prodotto deve poter essere usato con tre azioni. Se una funzione non
serve a una di queste tre, non compare nella vista normale.

### 5.1 «Dov'era quella cosa?»

Si scrive nella casella in linguaggio naturale e si ottengono risultati leggibili,
mescolati e ordinati per pertinenza e per quanto sono recenti: conversazioni,
progetti, documenti, decisioni, momenti di lavoro. Un risultato si presenta così —
«_la volta che abbiamo deciso di non usare Redis_, progetto Carrello, 3 giorni fa»
— e si apre con un clic sul punto esatto.

Non c'è un ambito da scegliere prima: si cerca sempre dappertutto, e i filtri
compaiono **dopo**, sui risultati, se servono a restringere.

Questa è la parte più esigente della visione, e il vincolo va detto senza
ambiguità: oggi la ricerca è dichiaratamente letterale — _«non trova parafrasi,
errori di battitura, sinonimi o radici delle parole»_ — quindi una casella di
ricerca al centro dello schermo è una promessa che il motore attuale non mantiene.
Renderla tollerante è lavoro di motore, non di interfaccia, va pianificato come
sprint proprio, ed è il punto in cui la lezione di OpenSearch conta davvero.

### 5.2 «Riprendiamo da dove eravamo», anche con un altro assistente

Si apre una scheda di «riprendi da dove eri» e si ottiene, già pronto, il
riepilogo di dove si era arrivati: obiettivo, decisioni prese, cosa non
funzionava, prossimo passo.

La persona non costruisce il riepilogo, non seleziona quali memorie includere, non
sceglie un budget in byte e non chiede un'anteprima prima di creare. Il riepilogo
**c'è già**: si legge, si corregge se è sbagliato, si usa.

#### Cambiare assistente senza ricominciare da capo

Questa è la ragione per cui AI Workspace esiste, e nell'interfaccia deve essere
un'azione sola.

Oggi, quando si cambia modello — perché il precedente ha esaurito il contesto,
perché un altro costa meno, perché uno è più bravo su questo compito, o
semplicemente perché il fornitore ha ritirato una versione — si ricomincia da
zero. Si riespiega il progetto, si riraccontano le decisioni già prese, si
riscoprono gli errori già fatti. Il lavoro accumulato resta nella conversazione
vecchia, che il nuovo assistente non può leggere.

Il bersaglio è: **si sceglie il nuovo assistente da un elenco e si continua a
parlare.** Il nuovo assistente sa già di che progetto si tratta, che cosa è stato
deciso e perché, che cosa è stato provato e non ha funzionato, e a che punto si
era. La persona non incolla niente, non riassume niente, non riespiega niente.

Dietro quel singolo comando il prodotto fa da sé, senza chiedere e senza
mostrarlo, tutto quello che serve:

1. **raccoglie ciò che conta** dalla storia del progetto: le decisioni prese con
   la loro motivazione, i vincoli da rispettare, gli errori da non ripetere, lo
   stato attuale e il prossimo passo. Non l'intera cronologia, che sarebbe
   inutilizzabile: ciò che serve per continuare;
2. **ordina per importanza e taglia su misura** del nuovo assistente. Ogni
   modello ha una capacità di contesto diversa, e il prodotto la conosce: quel
   che entra, entra intero; quel che non entra viene lasciato fuori
   consapevolmente, privilegiando le decisioni ancora valide sui dettagli
   superati;
3. **comprime senza perdere il senso**, perché un contesto più corto costa meno e
   lascia più spazio al lavoro vero;
4. **anonimizza ciò che deve restare qui**, con la proposta già pronta descritta
   al § 6.3;
5. **traduce nella forma che il nuovo assistente si aspetta**, perché ogni
   famiglia di modelli vuole le istruzioni in una forma sua. È un problema del
   prodotto, non della persona;
6. **fa vedere una volta sola che cosa sta per uscire** e chiede il sì, come
   previsto dal § 6.2.

Da questo momento la conversazione continua con il nuovo assistente, e quello che
succede lì rientra a sua volta nella memoria del progetto: se più avanti si
cambierà ancora, il passaggio successivo partirà da lì.

Il prodotto **non promette** che il nuovo assistente si comporti come il
precedente: modelli diversi danno risposte diverse, e questo non è un difetto da
nascondere. Promette che non debba **ripartire ignorante**.

### 5.3 «Ricordati questo»

Si scrive una cosa da non perdere e finisce a posto. Una sola casella. Il prodotto
decide da sé se è una domanda senza progetto, una decisione, un vincolo o un
errore da non rifare, lo collega alla conversazione o al documento da cui nasce e
lo rende ritrovabile.

Oggi questa singola azione richiede: creare prima una conversazione, confermare la
destinazione, salvare la domanda, poi separatamente ispezionare un evento,
dichiarare di volerlo usare come prova, scegliere un tipo fra tre costanti e
creare la memoria. Sono sette passaggi per «ricordati questo».

---

## 6. Il principio: automatico tutto, tranne ciò che esce

Le azioni del prodotto si dividono in due categorie, e oggi sono trattate tutte
allo stesso modo.

### 6.1 Categoria A — locale e reversibile: nessuna domanda

Tutto ciò che **resta su questo computer** e **non distrugge niente** accade da sé,
senza chiedere e senza spiegarsi. Rientrano qui: salvare, indicizzare, riassumere,
comprimere per risparmiare contesto, collegare una cosa alla sua fonte, ricostruire
le relazioni fra le fonti, tenere aggiornato ciò che si trova sul computer,
preparare il riepilogo per ripartire, recuperare il contesto lasciato da un
assistente precedente, verificare l'integrità di ciò che si legge, **e proporre
l'anonimizzazione già fatta**.

Il prodotto può sbagliare in queste azioni senza conseguenze irreversibili, e
l'utente non ha modo di fare meglio del prodotto: chiedergli di decidere è solo un
costo.

### 6.2 Categoria B — irreversibile o in uscita: una conferma, in italiano

Resta una conferma esplicita **solo** per ciò che fa uscire dati da questo
computer o che non si può disfare. La conferma va chiesta in italiano
comprensibile, **al momento giusto e una volta sola**, mai come modulo da
compilare.

Le conferme che restano sono quattro:

1. **mandare qualcosa a un modello esterno.** Si vede _esattamente il testo che
   uscirà_, già anonimizzato, in chiaro e scorrevole, con evidenziato ciò che è
   stato sostituito. Una sola domanda: «lo mando?»;
2. **cancellare definitivamente** qualcosa che non si può recuperare;
3. **impostare e annotare la passphrase di custodia**, perché perderla è
   irreversibile. Chiesta una volta, con detto chiaramente cosa succede se la si
   perde;
4. **sostituire un dato di un altro** in modo non reversibile, se e quando questa
   possibilità esisterà.

Fuori da queste quattro, nessuna conferma.

### 6.3 Il ribaltamento sull'anonimizzazione

Questo è il punto in cui la visione cambia una postura registrata, e va detto
senza ambiguità.

Oggi ADR-0021 e ADR-0023 stabiliscono che **l'utente** indica gli esatti intervalli
di byte da sostituire e conferma ogni suggerimento uno per uno; nella GUI questo si
traduce in una casella dove scrivere a mano un array JSON con `itemId`,
`contentSha256` in 64 caratteri esadecimali, `byteStart` e `byteEnd`.

Il nuovo bersaglio è: **il prodotto propone l'anonimizzazione già fatta, l'utente
la guarda e dice sì.** La preoccupazione originale resta soddisfatta — niente esce
senza che una persona abbia visto cosa esce — ma si sposta la fatica dal costruire
al controllare, che è ciò che un essere umano sa fare bene. È il modello di
Presidio: il rilevamento lo fa la macchina, la responsabilità resta della persona.

Ciò che **non** cambia: la sostituzione resta locale, la corrispondenza resta
cifrata, il ripristino resta rigoroso e tutto-o-niente, e il rilevamento resta
dichiaratamente **non** una garanzia di copertura completa dei dati personali. Il
prodotto propone; non promette di aver visto tutto. La frase che lo dice deve
comparire **una volta, accanto al testo da approvare**, non in ogni schermata.

[ADR-0034](../adr/0034-propose-a-complete-local-anonymization-for-one-approval.md)
registra questo emendamento a ADR-0021 e ADR-0023: la proposta la compone il
software, le sostituzioni sono applicate per default e una sola approvazione
riguarda l'esatto testo trasformato.

---

## 7. Le conferme e i moduli che spariscono

Elenco esplicito, così che nessuno lo reintroduca per abitudine. Ognuna di queste
oggi esiste nell'interfaccia.

| Oggi                                                      | Domani                                      |
| --------------------------------------------------------- | ------------------------------------------- |
| «Crea una conversazione generale» prima di poter scrivere | si scrive e basta                           |
| «Salva la domanda in GENERAL»                             | tutto è già salvato                         |
| «Usa questo evento come prova per la memoria»             | il collegamento alla fonte è automatico     |
| percorso del repository Git da scrivere a mano            | elenco delle cartelle trovate, da scegliere |
| «Elenca i transcript» poi «importa un file»               | ciò che si trova è già aggiornato           |
| budget di continuità e istruzioni «in byte UTF-8 esatti»  | non esistono più nell'interfaccia           |
| array JSON con `byteStart` e `byteEnd`                    | il prodotto propone, l'utente approva       |
| digest SHA-256 da incollare come «blocco» facoltativo     | verifica automatica, esito in una parola    |
| «Anteprima del riepilogo» prima di «Crea riepilogo»       | il riepilogo si legge e si corregge         |
| menù a tendina della custodia con **una sola voce**       | scompare                                    |
| «Aggiorna» su cruscotto, memoria e registro               | si aggiorna da sé                           |
| righe «Effect: …» e riquadri «Trust: …» su ogni modulo    | comportamento vero, dettaglio a richiesta   |

---

## 8. Come si dice in italiano ciò che oggi è gergo

Tabella di resa. «Non mostrare» significa: **nella vista normale non compare
affatto**, e resta disponibile nella vista tecnica di cui al § 9.

| Oggi a schermo                                     | Vista normale                    | Vista tecnica                     |
| -------------------------------------------------- | -------------------------------- | --------------------------------- |
| `handoff`                                          | riepilogo per ripartire          | `handoff`                         |
| `Work Item`                                        | attività                         | `Work Item`                       |
| `Context Pack`                                     | non mostrare                     | `Context Pack`                    |
| `canonical event`                                  | momento della conversazione      | `canonical event`                 |
| `artifact`                                         | testo originale                  | `artifact`                        |
| `UNTRUSTED`                                        | non mostrare                     | contenuto importato, mai eseguito |
| `USER_CURATED`, `USER_AUTHORED`, `USER_CONFIGURED` | non mostrare                     | invariati                         |
| `UNASSESSED`                                       | non mostrare                     | invariato                         |
| `UNVERIFIED`                                       | da confermare                    | `UNVERIFIED`                      |
| `ACTIVE`                                           | non mostrare (è il caso normale) | `ACTIVE`                          |
| `SUPERSEDED`                                       | sostituito                       | `SUPERSEDED`                      |
| `INVALIDATED`                                      | annullato                        | `INVALIDATED`                     |
| `PROPOSED`                                         | da iniziare                      | `PROPOSED`                        |
| `BLOCKED`                                          | bloccato                         | `BLOCKED`                         |
| `GENERAL`                                          | appunti (senza progetto)         | `GENERAL`                         |
| `PROJECT`                                          | progetto                         | `PROJECT`                         |
| `LINK_ONLY`                                        | collegato, non spostato          | `LINK_ONLY`                       |
| `CONFIDENTIAL`                                     | riservato                        | `CONFIDENTIAL`                    |
| `REVIEWABLE_NOT_AUTHORIZED`                        | pronto: manca il tuo sì          | `REVIEWABLE_NOT_AUTHORIZED`       |
| `SUGGESTED_NOT_REVIEWED`                           | proposto, da confermare          | `SUGGESTED_NOT_REVIEWED`          |
| `BUDGET_EXCEEDED`                                  | non ci stava tutto               | `BUDGET_EXCEEDED`                 |
| `PASSPHRASE_WRAPPING`                              | non mostrare                     | invariato                         |
| `SHA-256`, `digest`                                | verificato                       | invariati                         |
| `UTF-8 bytes`                                      | non mostrare                     | invariato                         |
| `provenance`                                       | da dove viene                    | `provenance`                      |
| `SOFTWARE`, `DOCUMENTS`, `MIXED`, `LEGAL`, …       | non mostrare                     | tipo di repository                |
| `USER_MESSAGE`                                     | tu                               | `USER_MESSAGE`                    |
| `AGENT_MESSAGE`                                    | l'assistente                     | `AGENT_MESSAGE`                   |
| `TOOL_CALL`, `TOOL_RESULT`                         | uno strumento usato              | invariati                         |
| `COMMAND_RESULT`                                   | un comando eseguito              | `COMMAND_RESULT`                  |
| `FILE_CHANGE`                                      | un file cambiato                 | `FILE_CHANGE`                     |
| `TEST_RESULT`                                      | un test                          | `TEST_RESULT`                     |
| `ERROR`                                            | un errore                        | `ERROR`                           |
| `DECISION`                                         | una decisione                    | `DECISION`                        |
| `CONSTRAINT`                                       | un vincolo                       | `CONSTRAINT`                      |
| `FAILURE`                                          | un errore da non rifare          | `FAILURE`                         |
| `PASS` / `FAIL` / `NOT_RUN`                        | passati / falliti / non eseguiti | invariati                         |

Regola generale: **nella vista normale non compare nessuna parola tutta in
maiuscolo con il trattino basso.** È una regola verificabile da un test
automatico, come il progetto già fa per altre invarianti.

---

## 9. Che cosa non cambia

Questo lavoro non indebolisce niente. In particolare:

- **le garanzie restano vere.** Nessun dato esce senza approvazione, niente viene
  eseguito, non c'è telemetria, il server sta solo sull'interfaccia locale. Non
  vengono più _ripetute a schermo_, il che è diverso da non valerle più;
- **la vista tecnica resta, completa.** Ogni schermata ha un modo per vedere
  provenienza, verifica di integrità, stato esatto e vocabolario originale. È
  esplicita, raggiungibile e non nascosta; semplicemente non è la vista
  predefinita. Serve a chi fa un controllo, non a chi lavora;
- **la riga di comando resta**, con tutte le sue capacità;
- **i limiti dichiarati restano dichiarati.** Il rilevamento dei dati personali non
  è completo; la ricerca ha limiti; un riepilogo non è una verità verificata.
  Queste frasi vanno dette **una volta, dove servono**, non in ogni riquadro.

---

## 10. Come si misura se il bersaglio è stato raggiunto

Criteri osservabili, non impressioni:

1. una persona che non ha letto nulla ritrova una cosa vissuta in una sessione
   precedente **senza aprire nessun menù** e senza fare domande;
2. i controlli da impostare per la prima azione utile passano da **cinque a uno**;
3. i passaggi del percorso di primo uso passano da **sedici a tre**;
4. nella vista normale ci sono **zero** costanti di dominio in maiuscolo,
   verificato da un test automatico sul testo effettivamente servito;
5. le conferme richieste all'utente in un percorso completo — dall'apertura al
   passaggio di consegne a un altro assistente — sono **al massimo una**, e
   riguarda ciò che esce;
6. una persona che parte da **una cartella di documenti**, non da un repository di
   codice, arriva alla prima ricerca utile **senza incontrare la parola «Git»**;
7. cambiare assistente in corsa non richiede **nessun copia-incolla e nessuna
   rispiegazione**: la persona sceglie il nuovo assistente e continua, e il nuovo
   assistente risponde correttamente a «a che punto eravamo?» e «perché avevamo
   deciso così?» senza che glielo si sia raccontato;
8. la persona sa dire, dopo l'uso e senza aiuto, che cosa il prodotto ha fatto per
   lei. Se l'esperienza è magica ma inspiegabile, il bersaglio è mancato:
   trasparente non vuol dire invisibile.

---

## 11. Che cosa questo documento **non** decide

Ognuno di questi punti richiede il proprio sprint e, dove serve, il proprio ADR:

- **il motore di ricerca tollerante** (normalizzazione, radici delle parole,
  tolleranza agli errori di battitura, ordinamento per pertinenza e recenza,
  raggruppamento per conversazione). È il lavoro più grande e va misurato prima di
  prometterlo nell'interfaccia;
- **se e quando riportare il documentale nell'orizzonte di consegna.** Il § 3
  registra che è progettato e che è fuori dall'orizzonte, e vincola le schermate
  future a non dare per scontato il codice; non lo riapre come impegno;
- **l'adozione di uno dei prodotti di riferimento come dipendenza vera**
  (OpenSearch, Presidio, un grafo dei sorgenti, un intermediario verso il
  modello). Richiede un ADR ciascuno e va confrontata con le regole «nessuna
  dipendenza esterna senza ADR» e «zero dipendenze a runtime nella GUI»;
- **il destino della barra laterale a nove voci** e la forma della vista tecnica;
- **il disegno grafico** vero e proprio: colori, caratteri, illustrazioni;
- **la dimensione tempo nel cruscotto**, che oggi mostra soltanto lo stato
  istantaneo;
- **la riscrittura di
  [`gui-first-journey.md`](../user-guide/gui-first-journey.md)**, che sarà la
  conseguenza e non la causa del nuovo percorso.
