# F6 — Dove eseguire: locale, cloud, crediti API, modelli esterni (dentro la 2.2.0)

Richiesta del committente (6 novembre 2026), in tre parti:
1. ha dei crediti Claude e vuole usarli quando lavora nel cloud;
2. vuole avviare una o più chip nel cloud o con chiamate API;
3. se attivato, vuole che la mod lo aiuti a scegliere dove far girare ogni lavoro: locale, cloud, API o modelli esterni.

Si parte da `main` dopo la fusione di F5. F6 tocca gli stessi file, quindi viene dopo.

## 0. Fatti accertati (documentazione ufficiale, 6 novembre 2026)

- **Cloud Claude Code** (`claude.ai/code`):
  - richiede un piano Pro, Max, Ultra, Team o Enterprise idoneo, il login claude.ai, un repository GitHub collegato e un ambiente cloud;
  - consuma gli **stessi limiti del piano**, senza costo separato per la VM;
  - usa **sempre** le credenziali dell'abbonamento: una `ANTHROPIC_API_KEY` impostata nell'ambiente cloud non le sostituisce;
  - che i **crediti di utilizzo extra** valgano anche nel cloud **non è documentato**: l'articolo dice «conversazioni Claude e uso di Claude Code nel terminale». Va provato, non promesso.
  - Fonti: `code.claude.com/docs/en/claude-code-on-the-web.md`, `authentication.md`, `support.claude.com/.../12429409`.
- **Esecuzione a crediti API**:
  - `claude -p` in locale, con `ANTHROPIC_API_KEY` sull'ambiente del solo processo figlio, usa la chiave al posto dell'abbonamento. In `-p` la chiave vince sempre; `--bare` non legge OAuth né keychain.
  - `--output-format json` restituisce `total_cost_usd`, che è una **stima** lato client.
  - Claude Desktop e il cloud **non** leggono la chiave.
  - Fonti: `authentication.md`, `headless.md`.
- **Codex**:
  - `codex exec` può usare `CODEX_API_KEY` (fatturazione OpenAI Platform);
  - `codex cloud exec --env ENV_ID "…"` esiste ma richiede il login ChatGPT, non una chiave;
  - `codex apply TASK_ID` porta il diff in locale.
  - Fonti: `learn.chatgpt.com/docs/non-interactive-mode`, `/auth`, `/developer-commands`.
- **Modelli non Anthropic dentro Claude Code** tramite gateway: **non supportati** (`llm-gateway.md`). I modelli esterni restano quindi esecutori a sé (FreeLLMAPI già esistente), limitati a compiti testuali.
- **Saldi**:
  - né il saldo dei crediti extra né quello dei crediti API si leggono da CLI o dall'API documentata;
  - la statusline dà le percentuali dei limiti (Pro/Max/Ultra) e un costo stimato di sessione.
  - Quindi la mod **non mostra saldi inventati**: mostra la spesa che lei stessa ha avviato contro un budget in denaro scritto dall'utente.

## 1. Cosa c'è oggi e perché il committente non riesce

- `destinazione: cloud` esiste:
  - conferma del testo a ogni versione (`register.tsx:594`);
  - blocchi per fork, Codex e dati da LAN, con il limite `CLOUD_MAX` (`logica.ts:389-466`).
- Però:
  - la destinazione la sceglie **solo l'agente che propone**: dal pannello non si può dire «questa nel cloud»;
  - il ripiego manuale rifiuta il cloud (`v.cloudManuale`);
  - non c'è nessun percorso «a crediti API»: gli esecutori sono `claude`, `codex` e `freellmapi`;
  - DeepSeek è solo un saldo.

## 2. Cosa si fa

### F6.1 — Destinazione scelta dal pannello

- **Cambio di destinazione.** Ogni chip in `proposta`, `accodata` o `fallita` ha un'azione «Dove» con le scelte ammesse per quella chip: Locale · Cloud · API Claude · API Codex · Esterno. Una scelta non ammessa **non compare** e si spiega con il motivo, cioè con il primo blocco di `violazioniAvvio` per quella destinazione.
- **Scrittura.** Il cambio è una scrittura CAS del record: `versione+1`, campo `destinazione` esteso, nuovo `esecutoreVia` se serve. Ogni conferma precedente decade perché legata alla versione.
- **Selezione multipla.** «Selezionate → Dove…» applica la stessa destinazione a più chip; quelle non ammesse restano dove sono e lo si dice.
- **Avvio nel cloud.**
  - Resta per chip una conferma con il testo intero di ogni chip.
  - Per più chip insieme, un popup per chip **in sequenza**; il rifiuto di una non ferma le altre.
  - Il blocco `v.cloudManuale` resta per il ripiego manuale; il pulsante Avvia del pannello basta.
- **Guardie invariate.** Corsie R4/R5 e moduli sensibili mai fuori dalla macchina; cloud solo `fresh`; niente Codex nel cloud di Claude; filtro dei dati LAN; `CLOUD_MAX`.

### F6.2 — Corsia «API» (Claude e Codex in locale, pagati a crediti)

- **Esecuzione.** Riusa la corsia CLI già esistente (esecuzioni in `esecuzioni/<tentativo>.json`, `stato-cli`, `esitoCli`):
  - **API Claude:** `claude -p --output-format json --model <m> --effort <e>` nel worktree della chip. `ANTHROPIC_API_KEY` sta sull'ambiente del **solo** processo figlio, letta dal campo segreto delle impostazioni della mod (`userConfig` sensibile, come DeepSeek).
  - **API Codex:** `codex exec` con `CODEX_API_KEY` sul solo figlio.
- **Segreti.** La chiave non va mai in record, log, mandato, board o argomenti della riga di comando, e non si eredita dall'ambiente della sessione.
- **Concorrenza.** Al più **1** esecuzione API alla volta per macchina, come la corsia Codex di oggi: protegge memoria e spesa. La si alza solo dalle Impostazioni, con un massimo di 3.
- **Spesa.**
  - Ogni esecuzione registra `costoStimato` da `total_cost_usd` (Claude) o il conteggio di token disponibile (Codex), con la dicitura **stimato**.
  - La spesa del giorno e del mese si somma per fornitore contro un budget in denaro scritto dall'utente (USD/EUR, budget manuali già esistenti).
  - Oltre la soglia critica l'avvio si blocca con il motivo.
- **Consegna.** Come la corsia CLI: diff nel worktree e ramo; revisione con l'altro motore come oggi.
- **Corsie ammesse.** Le stesse dell'esecutore locale: è sempre la macchina dell'utente e nessun dato esce oltre quanto fa già Claude Code. Nei moduli sensibili vale la regola del progetto, e il revisore resta obbligatorio.

### F6.3 — Codex cloud (facoltativo, solo se configurato)

- **Requisito.** Si attiva solo se l'utente scrive l'id dell'ambiente Codex cloud nelle Impostazioni e il login ChatGPT di Codex risulta attivo.
- **Avvio.** `codex cloud exec --env <id> --attempts 1 "<titolo+mandato>"` con le stesse guardie del cloud Claude: niente R4/R5, filtro dei dati LAN, `CLOUD_MAX`, conferma del testo.
- **Esito.** La chip diventa `avviata` con l'id del task. «Applica» usa `codex apply TASK_ID` nel worktree della chip, poi segue la revisione normale.
- **Ripiego.** Se l'id del task non si può leggere in modo affidabile dall'output, F6.3 **non** si consegna: si annota e resta fuori dalla 2.2.0.

### F6.4 — Crediti e risorse nella vista Carico

- **Limiti dei piani.** Le percentuali di Claude e Codex seguono la convenzione F5.7 (utilizzo da 0 a 100).
- **Righe in denaro**, solo se configurate:
  - «Claude API: 3,20 USD di 20 USD (stimato, questo mese)», «Codex API: …»;
  - «Crediti extra Claude: budget N USD», spesa non leggibile e scritto così.
- **Cloud Claude.** Una nota che dice che consuma i limiti del piano come il locale, quindi la sua percentuale è quella del piano.
- **Crediti extra nel cloud.** Nessuna promessa sul loro uso nel cloud. Nella procedura guidata del cloud c'è il testo «non documentato: verifica sul tuo account».

### F6.5 — Consigliere di destinazione (attivabile)

- **Attivazione.** Impostazioni → «Consiglia dove eseguire»: Spento (predefinito) / Suggerisci / Applica in automatico alle chip senza destinazione esplicita.
- **Regole.** Pure, in `logica.ts`, testate a tabella, in quest'ordine:
  1. una sensibile (R4/R5 o modulo sensibile) va **sempre** in Locale;
  2. una chip `fork`, o con dati da LAN, o oltre `CLOUD_MAX`, esclude cloud ed esterni;
  3. si scartano le destinazioni non configurate o oltre la soglia critica: limiti del piano, budget API, saldo esterno;
  4. fra le restanti si sceglie, con preferenza fissa:
     - **Locale** se il piano è sotto la soglia di attenzione;
     - altrimenti **Cloud** quando il lavoro è lungo o parallelo e il repo è su GitHub. Il cloud consuma lo stesso piano, quindi aiuta il parallelismo e la macchina, non il limite;
     - **API** quando il piano è oltre la soglia di attenzione e c'è budget;
     - **Esterno** solo per R0–R1 testuali e solo se il livello lo ammette.
- **Spiegazione.** Ogni consiglio ha un motivo di una riga, tradotto, e si mostra nella chip come «→ API Claude · plan 82% used, API budget 3/20 USD».
- **Bilanciamento.** I pesi e i profili di F4 continuano a scegliere modello ed effort; il consigliere sceglie solo **dove**.
- **Agenti.** `risorse_agenti` aggiunge le destinazioni configurate e i loro margini, in inglese, dentro il tetto dei 4000 caratteri. `suggerisci_azione` accetta i nuovi valori di `destinazione`.

### F6.6 — Impostazioni (sezione «Esecuzione»)

- **Procedure guidate**, con popup e senza JSON:
  - Cloud Claude: verifica del remote GitHub e istruzioni per l'ambiente;
  - Chiave API Claude e chiave API Codex: campo segreto e prova con una chiamata minima, solo se l'utente la chiede;
  - Codex cloud: id dell'ambiente;
  - budget in denaro.
- **Salvataggio.** Tutto passa per la bozza e «Applica» di F5.9.
- **Visibilità.** Quello che non è configurato non compare nelle viste di lavoro: è la regola della 2.3.1.

## 3. Test e verifiche

- **Tabella del consigliere:** corsia × sensibilità × configurazione × soglie → destinazione e motivo.
- **Guardie:**
  - nessuna destinazione esterna o cloud per R4/R5;
  - la chiave non compare mai in record, argomenti o testi;
  - il cambio di destinazione fa decadere la conferma.
- **Corsia API con eseguibili finti:** script che stampano il JSON di `-p` per ambiente, argomenti, costo, esito, concorrenza 1 e blocco oltre il budget.
- **Multilingua:** sei lingue complete; resa a 60 colonne della riga «Dove» e del motivo.
- **Verifiche:** una alla volta (tsc, plugin test, prova-disco, validate).
- **Collaudo reale, dal committente:**
  - una chip nel cloud su un repo di prova;
  - una chip a crediti API con budget piccolo;
  - la prova se i crediti extra valgono nel cloud, annotata nel README come «verificato il …» oppure «non verificato».

## 4. Fuori da F6

- I modelli non Anthropic dentro Claude Code via gateway non sono supportati dalla documentazione.
- Nessuna lettura di saldi tramite API non documentate.
- Niente cloud per FreeLLMAPI.

## 5. Correzioni del giro 1 (prevalgono su tutto quanto sopra)

**Perimetro ridotto per la 2.2.0.**
- **Entrano:**
  - F6.1, esteso a partire dal percorso esistente;
  - F6.2, **solo per l'API di Claude**;
  - F6.4, F6.5, F6.6.
- **Escono, e diventano issue per la 2.3:**
  - **API Codex**: non c'è un tetto di spesa per tentativo verificato;
  - **F6.3, Codex cloud**: manca il contratto di riconciliazione (id cloud separato, stato remoto, invio incerto, apply concorrente).
- **Destinazioni della 2.2.0:** `local`, `cloud`, `api-claude`. Per «Esterno» resta l'esecutore `freellmapi` di oggi.

1. **Segreti (Alta) — accolto.**
   - La chiave API di Claude si inserisce **solo** come opzione `userConfig` sensibile nativa, nel secure storage dell'host, come la chiave DeepSeek.
   - La procedura guidata spiega dove inserirla e ne verifica solo la presenza.
   - Mai `ui.ask`, mai la bozza di F5.9, mai JSON.
2. **Ambiente del figlio (Alta) — accolto.** Il lanciatore costruisce un ambiente **controllato**:
   - si parte da quello ereditato;
   - si **tolgono** `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_BASE_URL`, `CLAUDE_CODE_USE_BEDROCK`, `CLAUDE_CODE_USE_VERTEX`, `CLAUDE_CODE_USE_FOUNDRY`, `CLAUDE_CODE_OAUTH_TOKEN` e `CLAUDECODE`;
   - si aggiunge solo `ANTHROPIC_API_KEY`.

   Inoltre:
   - Se le policy gestite impongono il login (`forceLoginMethod`/`forceLoginOrgUUID`), la destinazione `api-claude` non è disponibile e la mod lo dice.
   - Niente `$.env.set`, niente `--bare`.
   - Gli errori del figlio si rendono generici e si filtrano come in `risorse.ts:43`: nessuna riga che contenga la chiave o `sk-ant-`.
3. **Processi lunghi ed esito (Alta) — accolto.**
   - **Supervisore.** Si estende il supervisore distaccato di `disco.cjs`. Non si usano `process.run`, che chiude a 10 minuti, né `process.spawn`, che muore con il modulo.
   - **Lettura dell'esito.**
     - Il supervisore cattura stdout con un tetto di 1 MiB.
     - Ne estrae solo il JSON finale di `-p`: `result`, `total_cost_usd`, `is_error`, `num_turns`.
     - Scrive in modo atomico i soli campi ammessi in `esecuzioni/<tentativo>.json`.
   - **Casi anomali.** Crash, output troncato o JSON illeggibile danno esito `incerto` e costo `ignoto`, **senza riavvio automatico**.
4. **Spesa (Critica) — accolto.**
   - **Tetto per tentativo obbligatorio:** `--max-budget-usd <tetto>`.
     - Predefinito 2 USD, modificabile, mai oltre il residuo prenotato.
     - Le Impostazioni dichiarano che il tetto può essere superato.
   - **Prenotazione atomica nell'helper, sotto mutex.** Prima dell'avvio si prenota il tetto sul budget del periodo. Se il residuo non basta, l'avvio si blocca con il motivo.
   - **Contabilizzazione idempotente per tentativo.**
     - A fine esecuzione la prenotazione diventa il costo stimato.
     - Costo `ignoto` o esito `incerto` contano come **tetto intero**.
     - Un fallimento conta quanto riportato o, se ignoto, il tetto.
   - **Budget solo in USD** per l'API di Claude, l'unità di `total_cost_usd`: niente conversioni in EUR. I token senza tariffa non diventano denaro.
5. **Concorrenza e memoria (Alta) — accolto.**
   - **Limite:** al massimo **1** esecuzione `api-claude` per **macchina**.
   - **Lock dedicato** nell'helper:
     - vale per tutti i progetti;
     - è separato dal mutex di Codex e si aggiunge a esso;
     - resiste ai processi orfani, perché registra il PID e ne verifica che sia vivo.
   - **Nessuna opzione** per alzare il limite nella 2.2.0.
6. **Guardie (Alta) — accolto.**
   - **Una sola funzione.** Le guardie dipendono dalla **modalità effettiva**: `local`, `cloud`, `api-claude` o esecutore esterno. La funzione è una sola e la usano pannello, strumenti e coda.
   - **Regole per `api-claude`:**
     - niente `fork`, perché è un processo nuovo senza conversazione;
     - worktree obbligatorio;
     - il filtro dei dati LAN **non** serve, perché il lavoro resta sulla macchina come Claude Code locale;
     - ammessa solo nelle corsie in cui il progetto ammette l'esecutore Claude locale.
   - **Contraddizione risolta.** Le chip sensibili (R4/R5 o modulo sensibile) vanno **solo** in `local` interattivo, con revisione umana. `api-claude` le esclude, coerente con F6.5.
   - **Mandato.** Per `api-claude` il mandato è distinto, senza frasi da coordinatore di sessione.
7. **Consigliere (Alta) — accolto.**
   - **Cosa sceglie.** Solo la **destinazione**, fra quelle compatibili con l'esecutore e il modello già scelti da `bilancia` (F4 più R2 di F5). Le scelte esplicite non si toccano.
   - **Margini separati.** Per `local` e `cloud` conta il margine del **piano** Claude; per `api-claude` il residuo del **budget API**.
   - **Cloud.** Non promette modello ed effort, perché `parametriAvvio` non li trasmette. Nel motivo si scrive «modello scelto dal cloud».
8. **F6.3 (Alta) — accolto.** Escluso dalla 2.2.0 (vedi il perimetro), con una issue che riporta i requisiti del revisore.
9. **F6.1 (Media) — accolto.**
   - **Percorso esistente.** Modifica → Dove → Locale/Cloud c'è già (`vista-lavoro.tsx:128`, `:357`, CAS in `register.tsx:259`) e si estende quello.
   - **Aggiunte:**
     - la voce `API Claude`;
     - le opzioni non ammesse, mostrate disattivate con il motivo;
     - la selezione multipla «Dove…» per più chip;
     - un accesso rapido «Dove» sulla riga della chip.
   - **Cloud.** Resta confermato chip per chip.
10. **Test (Alta) — accolto.** Si aggiungono a quelli della sezione 3:
    - due pannelli o progetti che avviano insieme `api-claude`: ne parte uno solo;
    - crash dopo lo spawn e dopo l'invio;
    - esito duplicato o troncato;
    - chiave riflessa in stdout, stderr o errori: mai salvata né mostrata;
    - ambiente contaminato: con `ANTHROPIC_BASE_URL` e `ANTHROPIC_AUTH_TOKEN` presenti, vengono tolti;
    - revoca durante la conferma;
    - cambio di destinazione contro un avvio concorrente (CAS);
    - prenotazione e contabilizzazione idempotenti;
    - le prove CLI esistenti (`prova-disco.cjs:598`) restano verdi.

**Sezione 0 precisata.**
- **La chiave.** «La chiave vince» vale rispetto all'abbonamento, non rispetto ad altre credenziali di priorità maggiore, che il punto 2 toglie.
- **GitHub.** Il cloud da CLI supporta anche i bundle locali. La mod mantiene comunque il vincolo GitHub, perché `start_session` cloud parte dal ramo pushato.

## 6. Correzioni del giro 2 (prevalgono sulla sezione 5 per i punti 2, 5 e 7)

- **§5.2 Ambiente ripristinato dalle impostazioni (Alta) — accolto.**
  - **Controllo prima di ogni avvio.** L'helper rilegge tutte le fonti di configurazione del figlio:
    - le impostazioni gestite, attraverso le fonti che l'host espone (`SettingsSource`);
    - le impostazioni utente, di progetto e locali del worktree.
  - **Cosa cerca.** In quelle fonti cerca `env.ANTHROPIC_BASE_URL`, `env.ANTHROPIC_AUTH_TOKEN`, `env.CLAUDE_CODE_USE_*`, `apiKeyHelper`, un gateway imposto e `forceLoginMethod`/`forceLoginOrgUUID`.
  - **Esito.** Se ne trova anche solo uno, `api-claude` **non è disponibile**. Il motivo nomina la fonte, non il valore. Nessun aggiramento: niente `--settings` per sovrascrivere e nessuna modifica dei file dell'utente.
  - **Fonte illeggibile.** Una fonte che non si riesce a leggere blocca: il controllo è fail-closed.
  - **Test.** Contaminazione da ciascuna fonte di impostazioni, oltre che dall'ambiente.
- **§5.5 Orfani (Alta) — accolto.** Si riusa lo schema della corsia Codex (`disco.cjs:116` e `:568`).
  1. **Prenotazione prima dello spawn.** Sotto lock si scrive una prenotazione globale persistente `api-claude.json` con tentativo, istante e stato `in-avvio`.
  2. **Registrazione.** Dopo lo spawn si registrano PID e identità temporale del processo (orario di avvio), come per Codex.
  3. **PID non registrato.** Se il PID non risulta registrato, per un crash fra spawn e registrazione, la prenotazione resta e **blocca**. Si libera solo se:
     - la verifica dell'albero dei processi non trova superstiti con la riga di comando del tentativo;
     - oppure l'utente sceglie «Libera» da un popup che spiega il rischio.
  4. **Fine dell'esecuzione.** Una prenotazione con PID vivo e identità coerente blocca. Con PID morto e nessun discendente vivo, si libera e il costo si contabilizza come `ignoto`, cioè al tetto intero.
  5. **Test.** Crash fra prenotazione e spawn, fra spawn e registrazione, durante l'esecuzione, e PID riusato da un altro processo.
- **§5.7 Margine per Locale con Codex (Media) — accolto.**
  - **Locale con esecutore Codex.** Il consigliere guarda **sia** il limite Codex **sia** quello del piano Claude del coordinatore. Basta che uno dei due sia oltre la soglia critica per escludere la destinazione.
  - **Locale con Claude.** Solo il piano Claude.
  - **`api-claude`.** Solo il budget API.
  - **Test:** il caso «Claude disponibile, Codex esaurito» non consiglia Locale con Codex.

## 7. Correzioni del giro 3 (prevalgono sulla sezione 6 per i punti 5.2 e 5.5)

- **§5.2 — accolto.** L'elenco delle impostazioni vietate include anche `env.ANTHROPIC_API_KEY`, in qualunque fonte di impostazioni: utente, progetto, locale o gestita. Se è presente, `api-claude` non è disponibile, perché la spesa finirebbe sull'account sbagliato. Lo stesso vale se l'ambiente ereditato contiene già `ANTHROPIC_API_KEY`: non si sovrascrive, si blocca con il motivo. Test: chiave presente in ciascuna fonte e nell'ambiente.
- **§5.5 — accolto.** Senza un PID registrato, **nessuna** verifica automatica libera la prenotazione: non trovare la riga di comando non dimostra che il processo sia finito. Per liberarla serve un «Libera» esplicito dell'utente, dopo un popup che spiega il rischio. Con il PID registrato, la liberazione automatica richiede **due condizioni insieme**:
  - il PID è morto oppure ha un'identità temporale diversa;
  - nessun discendente censito è vivo.

  Altrimenti la prenotazione resta e blocca. Test: padre morto con un discendente vivo senza l'identificativo del tentativo, che resta bloccato fino al «Libera».

## 8. Correzioni del giro 4 (prevalgono sulla sezione 7 per §5.5)

**§5.5 — accolto in parte, con confutazione motivata.**

- **Liberazione automatica: un solo caso.** Si libera da sola solo se il **supervisore distaccato** ha registrato l'uscita del processo `claude -p`. Il supervisore ne è il padre: attende il figlio e ne scrive il codice d'uscita e l'istante in modo atomico nel file dell'esecuzione. Non basta più un censimento esterno dei processi.
- **Tutti gli altri casi bloccano** finché l'utente non preme «Libera», dopo un popup che spiega il rischio:
  - PID non registrato;
  - supervisore morto prima di registrare l'uscita;
  - uscita non registrata;
  - identità del PID dubbia.
- **Confutazione.** Il lock `api-claude` protegge due cose: la **spesa API** e la memoria del processo `claude -p`. La spesa avviene solo dentro quel processo. Una volta che il supervisore ne ha registrato l'uscita, la spesa è ferma.
  - Un eventuale discendente mai censito, per esempio un server avviato da uno strumento, non spende crediti API. Per questo non deve tenere il lock.
  - Se il censimento dopo l'uscita trova discendenti vivi, la chip lo segnala: «processi rimasti: N, PID …», con l'azione «Termina» che li chiude solo su conferma.
  - Il lock però si libera lo stesso.
- **Test:**
  - uscita registrata dal supervisore: il lock si libera;
  - uscita registrata e un discendente censito vivo: il lock si libera e compare l'avviso;
  - supervisore ucciso prima dell'uscita, con o senza discendenti, censiti o no: resta bloccato fino a «Libera»;
  - PID riusato: resta bloccato.

## 9. Correzioni del giro 5 (prevalgono su §5.2 e §8 dove contrastano)

**Rilievo accolto: un discendente non deve poter spendere dopo la fine.** Si sceglie l'isolamento della chiave invece del blocco a oltranza.

- **La chiave non sta più nell'ambiente del figlio.** Al posto di `ANTHROPIC_API_KEY` il supervisore passa a `claude -p` un `--settings` di sessione che contiene solo `apiKeyHelper`.
  - **Il comando.** È un piccolo script della mod che stampa il contenuto di un **file-chiave** del tentativo.
  - **Il file-chiave.**
    - Lo scrive il supervisore subito prima dello spawn, nella cartella dati della mod, con i soli permessi dell'utente.
    - Lo **cancella appena registra l'uscita** di `claude -p`.
    - Lo cancella anche all'avvio successivo, se ne trova uno rimasto da un crash.
  - **Ambiente del figlio.** Non contiene nessuna chiave: i discendenti non la ereditano.
  - **Dopo la cancellazione.** Il comando non ha più niente da stampare, quindi nessun processo superstite può ottenere la chiave dalla mod.
- **Coerenza con §5.2.** Il controllo che vieta `apiKeyHelper` resta valido per le impostazioni **dell'utente**: utente, progetto, locale e gestite. Quello passato dalla mod con `--settings` è l'unico ammesso. Secondo la precedenza documentata vince sull'abbonamento, perché `ANTHROPIC_AUTH_TOKEN` e `ANTHROPIC_API_KEY` sono assenti per costruzione, oppure l'avvio si blocca.
- **Cintura in più.** Dopo l'uscita registrata, il lock si libera solo se il censimento non trova discendenti vivi. Il censimento cerca per `ParentProcessId` a partire dal PID, con orario di creazione successivo all'avvio.
  - Se li trova, resta bloccato e mostra «Termina», che li chiude su conferma, oppure «Libera».
  - Anche se un discendente sfuggisse al censimento, non potrebbe spendere, perché il file-chiave non c'è più.
- **Residuo dichiarato.** Un processo che durante l'esecuzione legge e copia la chiave di proposito può riusarla. È lo stesso rischio di qualunque chiave data a un agente. Va scritto nelle Impostazioni, accanto al campo della chiave.
- **Test:**
  - ambiente del figlio senza chiave;
  - comando che restituisce la chiave durante l'esecuzione e niente dopo l'uscita;
  - file-chiave rimosso dopo un crash del supervisore, al giro successivo;
  - discendente vivo dopo l'uscita: bloccato fino a «Termina» o «Libera»;
  - discendente che chiama il comando dopo l'uscita: nessuna chiave.

## 10. Correzioni del giro 6 (prevalgono sulla §9 dove contrastano)

- **Acquisizione impedita ai discendenti — accolto.** Lo script `apiKeyHelper` della mod consegna la chiave **solo** se il processo che lo chiama ha come padre il PID di `claude -p` registrato dal supervisore. Il controllo usa `ParentProcessId` del proprio processo e l'identità temporale di quel PID, cioè l'orario di creazione registrato.
  - In ogni altro caso esce con errore senza stampare niente: un discendente, anche se fosse un altro Claude, non ottiene mai la chiave e non può averla in cache.
  - Il passaggio di `--settings` avviene sulla riga di comando del solo `claude -p` e non è nell'ambiente. Un Claude discendente non lo riceve, a meno che qualcuno non lo ricostruisca di proposito: è il residuo deliberato già dichiarato.
- **Finestra di cache — accolto come cintura.** Il lock si libera solo quando sono vere tutte e quattro le condizioni:
  1. l'uscita è registrata dal supervisore;
  2. il file-chiave è **cancellato con successo**;
  3. il censimento non trova discendenti vivi;
  4. sono passati **5 minuti** dall'ultima consegna della chiave. Lo script registra l'istante di ogni consegna nel file dell'esecuzione. Cinque minuti è il TTL predefinito della cache di `apiKeyHelper`.
- **Cancellazione prima della liberazione — accolto.** Se la cancellazione del file-chiave fallisce, il lock resta e la chip lo dice. «Libera» la ritenta: solo se riesce si libera, altrimenti il popup spiega come cancellare a mano e il blocco resta.
- **Residuo dichiarato, aggiornato.** La spesa dopo la fine è possibile solo se un processo copia la chiave di proposito durante l'esecuzione. Va dichiarato accanto al campo della chiave.
- **Test:**
  - lo script chiamato dal `claude -p` registrato consegna la chiave;
  - chiamato da un altro processo, figlio di un figlio o PID riusato, non consegna niente;
  - cancellazione fallita: bloccato;
  - liberazione solo dopo 5 minuti dall'ultima consegna;
  - discendente vivo: bloccato fino a «Termina» o «Libera».

## 11. Correzioni del giro 7 (prevalgono sulla §10 dove contrastano)

- **Catena effettiva del helper — accolto.** `apiKeyHelper` viene eseguito attraverso una shell. Lo script consegna la chiave solo se una di queste due catene di antenati è **esatta**:
  - `script ← claude -p registrato`;
  - `script ← shell ← claude -p registrato`. La shell deve essere `cmd.exe`, `sh`, `bash`, `powershell` o `pwsh` ed essere nata dopo l'avvio di `claude -p`.

  Il `claude -p` registrato si riconosce dal PID e dall'identità temporale. Ogni catena più lunga viene rifiutata, così come ogni intermedio che non sia una shell o un PID di identità diversa. Un discendente di `claude -p`, per esempio uno strumento Bash che avvia un altro processo il quale chiama lo script, ha almeno due anelli in più e quindi è respinto.
  - **Test:** catena diretta e catena con una shell accettate; catena con due livelli intermedi, con un intermedio che non è una shell e con un PID riusato rifiutate.
- **«Libera» e le quattro condizioni — accolto.** «Libera» non salta le garanzie sulla spesa.
  - **Cosa sostituisce.** Prende il posto solo della **condizione 1**, l'uscita registrata, quando il supervisore non l'ha potuta registrare. Ci vuole la dichiarazione esplicita dell'utente nel popup.
  - **Condizioni 2 e 4 obbligatorie.** Il file-chiave deve essere cancellato con successo e devono essere passati 5 minuti dall'ultima consegna.
  - **Condizione 3.** Se il censimento trova discendenti vivi, «Libera» non è disponibile e si offre «Termina». Dopo la terminazione si ricontrolla.
  - **Test corretti:**
    - con un discendente vivo «Libera» non c'è, c'è «Termina»;
    - con l'uscita non registrata, il file-chiave cancellato, 5 minuti passati e nessun discendente, «Libera» si può usare e libera;
    - con la cancellazione fallita o i 5 minuti non passati, «Libera» non libera e lo dice.

## 12. Correzioni del giro 8: modello di minaccia esplicito (prevale su §10 e §11 per l'helper)

**Rilievo accolto nel merito, e soluzione cambiata.** Codex ha ragione: la catena dei processi non autentica chi chiede la chiave, perché una shell dello strumento Bash produce la stessa catena. Più a fondo, durante l'esecuzione **qualunque** processo dell'utente può leggere il file-chiave, che sta in una cartella dell'utente, e può leggere la riga di comando di `claude -p`. Un controllo sul padre è quindi solo apparenza, e lo togliamo invece di complicarlo.

**Modello di minaccia dichiarato**
- **Durante l'esecuzione.** La chiave è accessibile all'agente e ai suoi strumenti, come una qualunque `ANTHROPIC_API_KEY` data a un agente. Non si promette altro.
- **Dopo l'esecuzione.** Garanzie verificabili:
  1. il file-chiave viene cancellato; se fallisce, il lock resta;
  2. la cache di `apiKeyHelper` si esaurisce: il lock si libera solo dopo 5 minuti dall'ultima consegna;
  3. il censimento non trova discendenti vivi; se ce ne sono, si offre «Termina»;
  4. la chiave non sta mai nell'ambiente: i discendenti non la ereditano.
- **Residuo.** Un processo che durante l'esecuzione copia la chiave e sfugge al censimento può spendere dopo.
- **Contenimento reale del residuo, lato Anthropic.** La procedura guidata **raccomanda in modo esplicito** di creare per la mod una **chiave dedicata**, in un workspace della Console con un **limite di spesa mensile** basso. È l'unico tetto che nessun processo locale può superare.
  - La mod non può verificarlo e lo dice.
  - Il testo accanto al campo della chiave lo ripete.
- **Helper semplificato.** Lo script stampa il file-chiave se esiste e non ne verifica il padre. Restano:
  - il file creato subito prima dello spawn, con i soli permessi dell'utente;
  - la cancellazione all'uscita e al giro successivo dopo un crash;
  - la registrazione dell'istante di ogni consegna.
- **Test:**
  - nessuna chiave nell'ambiente del figlio;
  - file assente: lo script non stampa niente;
  - cancellazione fallita: bloccato;
  - liberazione solo dopo 5 minuti dall'ultima consegna, con il file cancellato e nessun discendente vivo;
  - la procedura guidata mostra la raccomandazione sulla chiave dedicata con limite di spesa.

## 13. Correzioni del giro 9: dichiarazioni corrette (prevalgono sulla §12)

- **I cinque minuti non sono una revoca.** Il supervisore imposta **in modo esplicito** `CLAUDE_CODE_API_KEY_HELPER_TTL_MS=300000` nell'ambiente del solo `claude -p`, così il TTL è noto e non dipende da impostazioni altrui. L'attesa di 5 minuti dopo l'ultima consegna serve solo a far scadere la cache **di quel processo**. Il testo all'utente non dice più «la chiave scade»: dice «la copia in memoria di Claude scade; questo non revoca la chiave».
- **Una copia della chiave resta utilizzabile fino alla revoca,** anche senza processi superstiti e anche da un'altra macchina.
  - Il limite mensile del workspace contiene la spesa, ma si rinnova ogni mese.
  - Accanto al campo della chiave e nella procedura guidata va scritto: «Se pensi che la chiave sia stata copiata, revocala dalla Console e creane una nuova. Con una chiave dedicata alla mod puoi farlo senza toccare le altre».
  - Le garanzie «dopo l'esecuzione» della §12 valgono per **questa macchina e questa mod**, non per le copie della chiave.
