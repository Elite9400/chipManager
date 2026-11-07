# F10 — Installazione per progetto o globale; account globali, gestione per progetto (prima della 2.2.0)

Richiesta del committente (7 novembre 2026): la mod si deve poter installare per progetto o globalmente. Se è globale, la gestione resta legata alla sessione da cui si avvia, cioè al suo progetto. Abbonamenti, percentuali e configurazioni dei piani invece sono **globali per gli account collegati**.

## 0. Stato attuale

- **Installazione.** L'host supporta tre ambiti: `claude plugin install --scope user | project | local`. Con `project` il plugin si abilita in `.claude/settings.json` del repository, condivisibile con il team. La mod oggi è installata con `--scope user`, ma non dipende dall'ambito.
- **Configurazione.** Il config della mod ha:
  - uno strato **utente**, che oggi contiene solo `lingua` ed è scritto da `configura-utente`;
  - lo strato **`progetti[repo]`** (`RisorseProgetto`), che contiene tutto il resto: fornitori ammessi, soglie, limiti manuali (budget), `apiClaude` (budget e tetto in USD), `freellmapi` (livello ed endpoint), pesi e profilo, board, consigliere, `soloLocale`, `milestoneGithub`.
- **Chiavi e registri.**
  - Le chiavi (Anthropic, DeepSeek, FreeLLMAPI, API Claude) sono già **utente**, nella `userConfig` sensibile.
  - Il registro della spesa `api-claude` e il lock per macchina stanno nella cartella dati del progetto: un budget «del mese» oggi è per progetto, non per account.

## F10.1 — Due strati: Account (globale) e Progetto

- **Strato Account**, nuovo campo `account` nella radice del config, uguale per tutti i progetti:
  - **Soglie** di attenzione e critica per fornitore (`soglie`).
  - **Budget e limiti manuali** degli account (`limitiManuali`): la quota di un piano o un budget in denaro appartengono all'account, non al progetto.
  - **API Claude:** `apiClaude.budgetUsd` (mensile, dell'account) e `apiClaude.tetto` (predefinito per tentativo).
  - **FreeLLMAPI:** `freellmapi.endpoint`. Il `livello`, cioè le corsie ammesse, resta di progetto.
  - **Lingua**, già utente: si sposta sotto `account` con migrazione e lettura compatibile.
- **Strato Progetto** (`progetti[repo]`), la gestione legata al progetto della sessione: fornitori **ammessi**, `soloLocale`, `milestoneGithub`, `freellmapi.livello`, pesi e profilo, board, consigliere, cartella dati, termini sensibili e regole.
- **Il progetto può solo restringere** l'account, mai allargarlo:
  - un fornitore non connesso a livello di account non è ammissibile;
  - un progetto può avere un budget API **più basso** (`apiClaude.tettoProgetto`) e soglie **più severe**, opzionali;
  - nessun progetto può superare il budget dell'account.
- **Valori efficaci.** Si calcolano in un solo punto, `regoleEfficaci(account, progetto)` in `logica.ts`, usato da pannello, helper, strumenti e board. Tutti i consumatori leggono da lì.

## F10.2 — Registri e lock dell'account

- **Registro della spesa `api-claude`.** Si sposta nella cartella dati **dell'account** (`~/.claude/chipmanager/account/`), sotto lo stesso mutex di oggi: la spesa di tutti i progetti si somma contro il budget dell'account.
- **Lock per macchina.** Resta per macchina, come già oggi, e si sposta nella stessa cartella.
- **Budget del progetto.** Se c'è un `tettoProgetto`, una prenotazione deve stare **sia** nel residuo dell'account **sia** in quello del progetto. Per questo il registro conserva il progetto di ogni voce.
- **Migrazione dei registri esistenti.** Avviene al primo uso, sotto mutex, ed è idempotente: le voci dei registri dei progetti vengono accorpate nel registro dell'account senza duplicati, con chiave per tentativo, e i file vecchi si rinominano `.migrato`. Un errore blocca la corsia API: nel dubbio si blocca.

## F10.3 — Migrazione del config

- **Quando e come.** Una volta sola, sotto il mutex `configura`, idempotente e marcata con `account.migrazione = 1`.
- **Regole:**
  - un campo che diventa di account e ha lo stesso valore in tutti i progetti passa all'account e sparisce dai progetti;
  - se i valori differiscono tra progetti, l'account prende il valore **meno restrittivo comune**: per i budget il massimo, per le soglie la più permissiva. Ogni progetto che era più severo **conserva il suo valore come restrizione di progetto**, così il comportamento di ogni progetto resta identico a prima. Lo verifica un test: le regole efficaci di ogni progetto prima e dopo sono uguali;
  - `lingua` passa sotto `account`; la lettura del vecchio campo resta per compatibilità.
- **Sicurezza della scrittura.** La migrazione non perde mai campi sconosciuti e scrive con CAS. Se il config è illeggibile, non migra e lo dice.

## F10.4 — Interfaccia

- **Impostazioni in due gruppi:**
  - **Account**, con la pillola «tutti i progetti»: Connessioni, Soglie, Budget, Esecuzione (chiave e budget API), Lingua;
  - **Progetto**, con il nome `owner/repo`: Fornitori ammessi, Bilanciamento, Board, Consigliere, Avanzate.
- **Restrizioni del progetto.** Nelle sezioni del progetto le restrizioni compaiono come «più severo dell'account», con «Rimuovi restrizione».
- **Bozza e Applica (F5.9).** La bozza contiene campi di entrambi gli strati. «Applica» scrive prima il progetto, poi l'account con `configura-account`, che sostituisce `configura-utente` sotto lo stesso mutex. Il salvataggio parziale va dichiarato, con lo stesso schema già usato per la lingua.
- **Vista Carico.** Le percentuali dei piani e i budget sono quelli dell'account, uguali in ogni progetto. La spesa API mostra la parte del progetto e il totale dell'account: «3,20 USD questo progetto · 7,80 USD di 20 USD account».
- **`proponi_impostazioni` (F7.1).** Una proposta che tocca campi dell'account mostra nella fascia «cambia le impostazioni di **tutti i progetti**», e l'applicazione resta solo su clic.
- **`risorse_agenti`.** Distingue account e progetto, entro il tetto, senza segreti.

## F10.5 — Installazione per progetto o globale (documentazione e comportamento)

- **Il comportamento non dipende dall'ambito di installazione.** Account e chiavi sono sempre dell'utente; la gestione delle chip è sempre del progetto della sessione che avvia. Con l'installazione per progetto, la mod è attiva solo nelle sessioni di quel repository.
- **README in inglese e in italiano.** Una sezione «Install for one project or globally» con:
  - `claude plugin install chip-manager@chipmanager --scope user` per installare su tutti i progetti;
  - `--scope project` per un repository, condivisibile con il team tramite `.claude/settings.json`;
  - `--scope local` per un solo progetto, senza commit.

  Accanto ai comandi va spiegato che gli account restano personali anche quando la mod è installata per il team. **Prima di scriverli si verificano sintassi e ambiti** sulla documentazione ufficiale.
- **Nessun dato di account nel repository.** Con l'installazione per progetto, la mod non scrive mai nel repository: il config resta in `~/.claude/chipmanager`. Lo verifica un test.

## Test e verifiche

- **Migrazione:**
  - valori uguali tra progetti;
  - valori diversi, con restrizioni conservate;
  - regole efficaci uguali prima e dopo per ogni progetto;
  - idempotenza;
  - config illeggibile;
  - campi sconosciuti conservati.
- **Registro di account:**
  - due progetti sommano la spesa contro un unico budget;
  - il budget del progetto limita;
  - migrazione dei registri senza duplicati;
  - errore che blocca.
- **Restrizioni:** il progetto non può allargare l'account, e il tentativo viene rifiutato con il motivo.
- **Applica:**
  - entrambi gli strati;
  - conflitto;
  - salvataggio parziale dichiarato.
- **Interfaccia:** sei lingue, 60 colonne.
- **Verifiche di sempre:** una alla volta; Codex rivede il piano e poi il diff.

## Correzioni del giro 1 (prevalgono su tutto quanto sopra; il piano diventa **additivo**)

**Fatto che semplifica.** La versione pubblica è la 2.1.0. Il suo config di progetto ha solo:
- `fornitori`, `soloLocale` e `milestoneGithub`;
- `pesi`, `limitiManuali` e `freellmapi {livello, endpoint}`.

Soglie, `apiClaude`, consigliere, profilo, board, registro della spesa e lock della corsia API **non sono mai stati rilasciati**: esistono solo nei build di sviluppo. Gli utenti reali quindi non hanno né registri della spesa né campi F4–F8 da migrare.

1. **Versioni concorrenti — accolto, con il cambio d'impianto.**
   - **Nessuna migrazione distruttiva.** Nessun campo viene spostato o tolto da `progetti[repo]`: si **aggiunge** soltanto `account` nella radice del config.
   - **Chi legge cosa.**
     - Le versioni vecchie continuano a leggere i campi di progetto di sempre e ignorano `account`.
     - Le versioni nuove combinano i due strati (punto 5).
   - **Test di compatibilità.** Il `configura` di `f196d1b`, eseguito su un file nel nuovo formato, **conserva** `account` e gli altri campi della radice.
     - Se non li conservasse, F10 aggiunge prima un commit a parte che lo garantisce, e lo dichiara.
     - Nel README e nel CHANGELOG: «dopo l'aggiornamento ricarica tutte le sessioni (`/reload-plugins`)»: finché non le ricarichi, una sessione vecchia applica solo le regole di progetto.
2. **Lock e registri — accolto.**
   - **Lock.** Resta **dove è oggi**, canonico e globale (`~/.claude/chipmanager/api-claude.json`), con PID, discendenti e TTL invariati.
   - **Registro dell'account.** È **uno solo e globale**, accanto al lock (`~/.claude/chipmanager/spesa-api.json`). Ogni voce porta il **progetto**, cioè l'id del repository, e il **tentativo**.
   - **Mutex.** Prenotazione e contabilizzazione restano sotto lo **stesso mutex** del lock per macchina: un solo mutex, nessun ordine di acquisizione da definire.
   - **Registri vecchi.** I registri per cartella dei build di sviluppo **non si importano**: per gli utenti reali non possono esistere. Se ne viene trovato uno, la corsia API si blocca con «registro di un build di sviluppo trovato in <cartella>: archivialo» (nel dubbio si blocca), finché l'utente non lo sposta.
   - **Crash.** Il recupero dopo un crash resta quello di F6 (§4, §8, §10 e §11).
3. **Valori campo per campo — accolto.** Si combinano in una funzione sola, `regoleEfficaci(account, progetto)`, con un gemello CJS per l'helper e un test di parità fra i due:
   - **Soglie, per fornitore.** Se i due strati hanno entrambi un valore, vale il più severo: il minimo per l'attenzione e il minimo per il livello critico. Se uno solo ha un valore, vale quello. `null` o un campo assente significa «nessuna soglia da questo strato».
   - **`apiClaude`.**
     - **Budget del mese e tetto per tentativo** stanno nell'account. Senza `account.apiClaude` la corsia API è **spenta**.
     - **Limiti del progetto.** Il progetto può avere `apiClaude.limiteMeseUsd` (al massimo pari al budget dell'account) e `apiClaude.tetto` (al massimo pari a quello dell'account).
     - **Dati dei build di sviluppo.** Un `apiClaude` di progetto rimasto da quei build si legge come restrizione del progetto.
   - **`limitiManuali`.**
     - **Cosa sono.** Sono misure dichiarate, con unità, percentuale e timestamp, non tetti di spesa.
     - **Dove vanno.** Le nuove si scrivono nell'**account**.
     - **Come si combinano.** Quelle di progetto, anche quelle della 2.1.0, restano e si mostrano con la pillola «progetto». A parità di id prevale quella di progetto. Le altre si sommano.
   - **`freellmapi.endpoint`.** Vale quello dell'account. Un endpoint di progetto (della 2.1.0) lo **sostituisce**: è un'eccezione dichiarata, non una restrizione. `livello` resta di progetto.
   - **`lingua`.** Non si sposta: resta dov'è.
   - **JSON grezzo e campi sconosciuti.** Ogni scrittura lavora sul JSON grezzo e conserva i campi sconosciuti, anche annidati. Un JSON rotto viene rifiutato senza scrivere, come oggi.
4. **Promesse — accolto.**
   - **Equivalenza garantita** solo per le **impostazioni**: le regole efficaci di ogni progetto, prima e dopo, sono uguali.
   - **La contabilità condivisa è nuova** e non ha un «prima» da eguagliare.
   - **Nessuna promessa di un limite assoluto alla fatturazione.** Si garantisce solo il controllo delle prenotazioni: un tentativo parte solo se entra **sia** nel residuo dell'account **sia** in quello del progetto. Esiti incerti e costi ignoti contano il tetto intero, e il tetto può essere superato, come dichiarato in F6.
5. **Il progetto può solo restringere, controllato nell'helper — accolto.**
   - **Al momento della prenotazione** l'helper **rilegge** il config e calcola `regoleEfficaci` dal gemello CJS. Controlla insieme, sotto il mutex, i due residui (account e progetto) e il tetto effettivo. Budget e tetto mandati dal pannello non contano: il pannello li mostra soltanto.
   - **Ordinamento delle soglie:** più severo vuol dire valore più basso.
   - **«Rimuovi restrizione»:** cancella il campo dal progetto.
   - **«Connesso»:** login o chiave presente. La chiave Admin è distinta e serve solo per la lettura dei costi.
   - **Chi usa `regoleEfficaci`:** pannello, `risorse_agenti`, consigliere, `bilancia`, board, helper CJS e strumenti. `bilancia` riceve i margini della spesa API dal registro dell'account, separati per progetto e account.
   - **Guardie.** Restano tutte quelle esistenti.
6. **Applica — accolto: una sola scrittura atomica.**
   - **Un solo comando.** `configura` accetta insieme una patch di progetto, una patch dell'account e la lingua, e le scrive in **un solo CAS** sullo stesso file, sotto lo stesso mutex. Niente scritture in sequenza, quindi niente allentamenti intermedi e niente salvataggio parziale.
   - **La bozza conserva le basi separate per strato:**
     - il conflitto si rileva sul valore **grezzo** di ogni campo toccato, non su quello efficace, così una modifica all'account nascosta da una restrizione del progetto non sfugge;
     - congelamento ed epoca restano unici, come in F5.9;
     - i campi non toccati si conservano esattamente.
7. **`proponi_impostazioni` — accolto.**
   - **Patch per strato.** Lo schema separa `progetto` e `account`, ciascuno con la sua whitelist, e le basi restano separate per strato.
   - **Nessun campo derivato.** Proporre solo il tetto non genera un budget e viceversa: i campi derivati non si compilano mai.
   - **Da aggiornare insieme:** schema dello strumento, validatori TS e CJS, tipi, coda, bozza e `risorse_agenti`.
   - **Regole invariate.** L'applicazione avviene solo su clic, con la whitelist che esclude chiavi, permessi e guardie. La fascia avvisa «tutti i progetti» quando c'è una patch dell'account.
8. **Dati fuori dal repository — accolto.**
   - **Dove vale il controllo.** Il config (`CHIPMANAGER_CONFIG`), la cartella dati dell'account e il registro della spesa vengono **rifiutati** se il percorso reale sta dentro un albero di lavoro git o passa per un link o una junction. È lo stesso controllo che la board fa già, e lo usano anche il percorso della cartella e `CHIPMANAGER_DIR`.
   - **Promessa nel README.** I dati della mod restano nella cartella utente. Se li configuri dentro un repository, la mod si rifiuta e lo dice.
   - **Sintassi verificata.** `claude plugin install chip-manager@chipmanager --scope user|project|local`: con `project` si scrive in `.claude/settings.json`, con `local` in `.claude/settings.local.json`.

## Correzioni del giro 2

- **Soglie predefinite — accolto.** In ciascuno strato si distinguono tre casi:
  - **assente:** eredita;
  - **`null`:** disattivazione esplicita da quello strato;
  - **valore:** la soglia.

  **Come si combinano:**

  | Account | Progetto | Risultato |
  |---|---|---|
  | assente | assente | **70/90** come oggi |
  | assente | valore | il valore |
  | assente | `null` | nessuna soglia, come oggi |
  | `null` | assente | nessuna soglia |
  | valore | assente | il valore |
  | valore | valore | il più severo per ciascun livello |
  | `null` | valore | il valore del progetto, che è più severo di «nessuna» |
  | valore | `null` | il valore dell'account: il progetto non può allentare |
  | `null` | `null` | nessuna soglia |

  Test di equivalenza: per ogni config della 2.1.0 e dei build di sviluppo, senza `account`, le soglie efficaci sono identiche a prima.
- **Leggibilità per le versioni vecchie — accolto.** Le restrizioni del progetto **non riusano** campi che il vecchio parser conosce con un'altra forma. Vanno in un campo **nuovo**, `progetti[repo].restrizioni = { soglie?, apiLimiteMeseUsd?, apiTetto? }`, che il vecchio parser ignora: oggi `risorseDa` scarta i campi sconosciuti in lettura e `configura` li conserva in scrittura, ed entrambe le cose vanno verificate con un test su `f196d1b`.
  - **Campi esistenti.** Il campo `apiClaude` già presente in un progetto, che viene dai build di sviluppo, si legge come restrizione ma **non si riscrive mai** in una forma nuova.
  - **Effetto dichiarato prima del reload.** Una sessione non ancora ricaricata vede solo i campi di progetto di prima e ignora account e restrizioni. Non si blocca, ma non applica le regole dell'account finché non la ricarichi. Il README e il CHANGELOG lo dicono.
- **Link lungo tutta la catena — accolto.** Prima di usare un percorso del config, della cartella dati dell'account o del registro della spesa, il controllo verifica:
  - con `lstat` **ogni antenato** dalla radice del volume fino al file finale: nessun link simbolico e nessuna junction;
  - che il **percorso reale** (`realpath`) coincida con quello dichiarato;
  - che nessun antenato del percorso reale contenga `.git`, cartella o file.

  In caso di errore di lettura si blocca. Lo stesso controllo, esteso a tutta la catena, si applica anche alla board e ne sostituisce l'uso attuale di `senzaLink`. Test con una junction sopra la base che porta fuori da git e con un `.git` come file.
- **Versioni rilasciate — accolto, con precisazione.**
  - **Pubblicate su `main` e taggate:** solo 2.0.0 e 2.1.0. Lo confermano `git ls-remote` (`origin/main` = 2.1.0, tag v2.0.0 e v2.1.0).
  - **Interne:** le versioni da 2.2.0 a 2.6.0 del CHANGELOG non sono mai state pushate.
  - **Ramo `dev/2.2.0`.** Dal 6 novembre 2026 esiste come ramo pubblico di **pre-release**: chi ne ha installato una copia ha dati di sviluppo. La regola del blocco sui registri per cartella (correzione 2) protegge anche quel caso.
  - **Alla release** il CHANGELOG consolida tutto in [2.2.0] (lavoro già in corso).

## Correzione del giro 3

- **Formulazione sulle versioni — accolto.** Al posto di «non sono mai state pushate» si legge: «le versioni interne 2.2.0–2.6.0 del CHANGELOG **non sono state rilasciate su `main` né taggate**; il loro codice è nel ramo pubblico di pre-release `dev/2.2.0`».

## Decisione della master (revisione del diff, 7 novembre 2026)

Modifica esplicita della specifica sul requisito «un fornitore non connesso a livello di account non è ammissibile».

- **Connessione solo dove è verificabile.** DeepSeek, FreeLLMAPI e API Claude richiedono la chiave presente (opzioni
  della mod o variabile d'ambiente). I piani Claude e Codex si considerano connessi: il loro login non è leggibile in
  modo affidabile a runtime.
- **Effetto.** Un fornitore ammesso nel progetto ma non connesso compare in Connessioni con la pillola «non connesso»,
  è escluso dalle scelte automatiche di `bilancia` e del consigliere, e un avvio con una scelta esplicita su di lui si
  blocca con il motivo.
- **Equivalenza.** Le regole efficaci dei progetti esistenti restano equivalenti per Claude e Codex. Per gli altri
  fornitori senza chiave il cambiamento è dichiarato nel CHANGELOG: prima fallivano all'avvio, ora sono esclusi prima.
