# Piano — chipManager: solo ciò che è configurato + board di progetto (v2)

Stato: **v2 della master, dopo la revisione di Codex astra (giro 1)**. Il ramo di partenza è
`claude/piano-2-2-88e0a2` @ `2b6fbe2`, con F0–F2 già fatte: 2.1.1, 2.2.0, 2.3.0.

## 0. Richieste del committente

1. «Nella parte di lavoro mostra solo i limiti dei piani in uso, non quelli non disponibili. Dashboard
   operativa: solo quello che serve davvero; ciò che non è configurato non si mostra finché non è
   configurato correttamente.»
2. «Una board in HTML semplice, fatta al minor consumo di token dal modello più leggero disponibile,
   attivabile e disattivabile dalle impostazioni. Tutto sotto controllo: una linea dello sviluppo, i
   prossimi lavori. Cliccando un task si apre il piano, il prompt, il processo di sviluppo, a chi è
   affidato, con quale effort, come viene revisionato, ecc.»

## Esito del giro 1 (rilievi di astra → decisione)

| # | Rilievo | Decisione |
|---|---|---|
| 1 | La revisione non è autenticata. | **Accolto, semplificato.** La board non dichiara una revisione «verificata». L'esito è sempre «riferito da <chi>»: si registra la sessione che lo scrive e la si mostra. Possono scriverlo solo il titolare del tentativo corrente e il proponente. Vedi B.3. |
| 2 | Il percorso del piano può uscire dal repo con link e junction; il tetto in righe non limita i byte. | **Accolto.** Controllo sul percorso reale, rifiuto dei percorsi speciali di Windows, tetto in byte. Vedi B.3. |
| 3 | «Fuori dal repository» non è garantito. | **Accolto.** La board si genera solo se la cartella dati è fuori da ogni working tree git; altrimenti è spenta, con il motivo. Vedi B.7. |
| 4 | `configurato` confonde misure e capacità di lavorare. | **Accolto.** La regola A riguarda solo **i limiti mostrati**. Esecutore e revisore restano filtrati dalla sola politica (`fornitori`), come oggi. |
| 5 | «Letto almeno una volta» non esiste; `margine()` non filtra i vietati; due regole sulla freschezza. | **Accolto.** Nuovo atomo con l'ultima misura valida per id, filtro dei vietati anche nella sintesi, una sola regola sulla freschezza. Vedi A.2. |
| 6 | Mancano i passaggi di persistenza: `risorseDa`, `configura` dell'helper, comando di scrittura, `normalizza`. | **Accolto.** Elencati in B.9. |
| 7 | Manca `fallita`; brief ≠ mandato inviato; i gate non sono in `Regole`; mancano le date. | **Accolto.** Tutto in B.2 e B.3. I gate escono: il processo si ricava da corsia, esecutore, revisore e fasi del registro. |
| 8 | Cache e tetto non reggono più pannelli. | **Accolto.** Generazione sotto mutex dell'helper; prenotazione di impronta e budget prima della chiamata; riassunti fuori dal giro. Vedi B.4. |
| 9 | Costo dei riassunti indeterminato. | **Accolto.** Tetto sull'input; riassunto solo quando cambia il testo, non lo stato; gestione di `isAnswered: false`; stima esplicita. Vedi B.4. |
| 10 | `file://` non si apre su Desktop e VS Code. | **Accolto.** Pulsante «Apri board» con l'apriprogramma del sistema, argv fisso, niente shell; in più il percorso in chiaro. Vedi B.6. |
| 11 | Invalidazione, spegnimento e test incompleti; i test 1117/1130 vogliono i segnaposto. | **Accolto.** Vedi B.4, B.5 e B.8. |

## 1. Parte A — Mostrare solo i limiti configurati (versione 2.3.1)

### A.1 Diagnosi

- `pannello.tsx:822-829` aggiunge righe segnaposto `mancanti` per ogni fornitore senza misura.
- `pannello.tsx:909` mostra sempre la riga FreeLLMAPI.
- `pannello.tsx:899` non filtra i fornitori per `regoleOra.risorse.fornitori`.
- `margine()`, a `pannello.tsx:1056`, non filtra i fornitori vietati.
- Il filtro delle finestre senza percentuale e dell'uso extra disattivato esiste già (`risorse.ts:76`,
  `:83`) e si riusa.

### A.2 Regola: una sola, sui limiti

- **Misura.** Un limite ha una misura se `percentuale !== undefined || valore !== undefined`.
- **Fresca.** Una misura è fresca se vale `limiteFresco()`, la regola che c'è già.
- **Valori manuali.** Un limite manuale si mostra sempre, ma non è «fresco» ai fini delle scelte (come oggi).
- **Ultima misura.** Nuovo atomo di sessione `ultimeMisure: Record<idLimite, Limite>`, aggiornato solo con
  limiti che hanno una misura. Un giro che fallisce non lo svuota.
- **Fornitore visibile.** È visibile nelle viste operative se è in `fornitori` **e** ha almeno una misura
  in `ultimeMisure` o un limite manuale.

### A.3 Dove si applica

**Vista Lavoro, riga di sintesi.** `margine()` considera solo i fornitori ammessi e le misure fresche.

- Se un fornitore visibile non ha più una misura fresca, la sintesi aggiunge un solo segno grigio:
  «Claude: limiti non letti da 12 min».
- Non compare nulla per i fornitori mai misurati.

**Vista Carico, «Limiti e budget».**

- Spariscono `mancanti` e la riga FreeLLMAPI.
- Si mostrano solo i fornitori visibili e, per ognuno, solo i limiti con misura:
  - con una misura fresca: la barra;
  - con una misura vecchia: una riga grigia senza barra, con l'età (regola già esistente);
  - con un errore e nessuna misura: non si mostrano.
- Se nessun fornitore è visibile: una riga sola, «Nessun limite collegato · vai a Impostazioni».

**Restano invariati.**

- Le scelte di esecutore e revisore nell'editor seguono solo la politica.
- La vista Impostazioni mostra tutti i fornitori con il loro stato: è il posto dove si configurano.

### A.4 Test

**Da aggiornare.** `tests/azioni.test.tsx:1110-1135` (test «2.0»). Oggi si aspettano «Claude API: non
disponibile». Diventano:

- con l'helper rotto, «Limiti e budget» mostra «Nessun limite collegato» e la riga che spiega l'errore
  dell'helper resta (è uno stato reale);
- gli altri controlli invariati.

**Nuovi.**

- Un solo fornitore misurato: nessuna riga «non disponibile», nessuna riga FreeLLMAPI.
- Fornitore vietato con una misura in memoria: assente dalla vista Carico e dalla sintesi.
- Misura che diventa vecchia: segno grigio nella sintesi, riga senza barra nella vista Carico.
- Un giro fallito dopo uno riuscito: `ultimeMisure` resta.

## 2. Parte B — Board di progetto in HTML (versione 2.4.0)

### B.1 Cosa è

Un **file HTML statico e autonomo**: `<cartella dati del progetto>/board/index.html`. È **spenta per
difetto**.

- **Nessuna risorsa esterna.** Niente script, font o immagini remote. CSS in linea.
- **CSP.** `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">`.
- **Nessun JavaScript.** Le schede dei task sono `<details id="t-<id>">`: si aprono al clic e con
  l'ancora.
- **Mai pubblicata.** Il pannello non ha azioni di pubblicazione o condivisione.
- **Aspetto.** Tema chiaro e scuro con `prefers-color-scheme`, unico accento `#00BFFF`. Il colore non è mai
  l'unico segnale: segno più parola, come nel pannello.

### B.2 Contenuto

1. **Testata.** Progetto, istante di generazione, versione della mod, la stessa riga di sintesi del
   pannello.
2. **Linea dello sviluppo**, in quattro gruppi:
   - **Aspettano te**: `fallita`, ferme, tentativi annullabili. Sono le stesse chip della vista Lavoro.
   - **In corso**: `in-avvio`, `avviata`, `consegnata`, con le fasi del registro (`FASI`) come passi.
   - **Prossimi**: `proposta` e `accodata`, nell'ordine di avvio, con le dipendenze e i blocchi
     (`violazioniAvvio`).
   - **Fatto**: le `completata` degli ultimi 30 giorni, più le ultime 15 voci di `git log --first-parent`
     del ramo base (letto dall'helper, solo l'oggetto del commit, la data e lo SHA corto). Le più vecchie
     di 30 giorni si riassumono in una riga di conteggio.

   Le milestone compaiono solo se `milestoneGithub` è attivo, con una barra al rapporto vero.
3. **Scheda del task** (`<details>`), con:
   - **Piano**: il contenuto di `azione.piano` (B.3), escapato, fino al tetto in byte.
   - **Mandato inviato**: il testo di `mandato()` (`logica.ts:646`) ricostruito per la chip, con il gettone
     del tentativo **oscurato**. Sotto, distinti, il brief e il background originali.
   - **Processo**:
     - la corsia;
     - i passi derivati: esecuzione (esecutore) → revisione (revisore o «senza revisione») → fusione;
     - la fase attuale del registro, se c'è.

     Nessun gate inventato: `Regole` non ne ha.
   - **Chi**: esecutore, modello, effort (con le tacche), permessi, contesto, worktree e ramo, destinazione.
   - **Revisione**: il revisore previsto, più l'ultimo esito riferito (B.3): esito, chi lo ha riferito
     (titolo o id della sessione), quando, nota.
   - **Tempi**: creata, avviata, consegnata, completata. Per i record vecchi senza data: «ignoto».
   - **Legami**: issue, dipendenze, chip che sblocca, sessione.
   - **Riassunto**: solo se i riassunti sono attivi (B.4).
   - **Errore**: per le fallite.
4. **Piede**: la legenda dei segni e il percorso del file.

### B.3 Dati nuovi sulla chip

Facoltativi; la forma diventa `azioni-5`; `normalizza` accetta e valida ogni campo nuovo.

**`piano?: string`** — percorso relativo alla radice del repo.

- **Al confine** (`suggerisci_azione` ed editor):
  - lunghezza fino a 300;
  - niente `..`, niente percorsi assoluti;
  - niente prefissi `\\?\`, `\\.\` o UNC, niente `:` (flussi alternativi NTFS e lettere di unità);
  - estensione `.md` o `.txt`.
- **Alla lettura.** Lo fa l'helper, con un comando nuovo `leggi-piano <radice> <relativo>`:
  - `realpath` di radice e file; il file deve stare sotto la radice reale (link e junction compresi);
  - deve essere un file regolare;
  - si leggono al massimo 200 KB e si segnala il troncamento.
  - La radice è quella del checkout della sessione o di un suo worktree (`git worktree list` già usato).

**`revisione?: { esito: 'in-corso' | 'approvata' | 'da-correggere'; nota?: string; riferitaDa: string; quando: string }`**

- La scrive `aggiorna_azione` con un argomento nuovo, `revisione`, e senza cambiare lo stato.
- Ammessi: chi porta il `tentativo` corrente, cioè la sessione avviata, oppure il proponente (la master).
- `riferitaDa` è l'id della sessione chiamante, preso da `$.session.id()`, mai dagli argomenti.
- La `nota` arriva al massimo a 300 caratteri.
- La board scrive «riferita da …», mai «verificata».

**Date.** `consegnataIl?` e `completataIl?` si scrivono in tutte le transizioni verso quegli stati:

- da `aggiorna_azione`;
- da `chiudi` del giro;
- da «Segna completata» nel pannello.

**Mandato standard** (`mandato()`): una riga in più chiede alla sessione avviata di riferire l'esito della
revisione con `aggiorna_azione` (`revisione`).

### B.4 Costo in token

**L'HTML si genera senza modello.** Lo fa una funzione pura `board(dati): string` in `hooks/board.ts`.
Costo in token: zero, e nessuno stato inventato.

**Riassunti facoltativi**, con il modello più leggero.

- È un'impostazione distinta (B.5), spenta per difetto.
- Si fanno solo se `claude` è tra i fornitori ammessi e `soloLocale` è falso.
- La chiamata: `$.model.complete({ model: 'haiku', effort: 'low', maxTokens: 120, timeoutMs: 15000 })`.
  - Se l'host rifiuta l'alias, i riassunti si spengono con un motivo visibile in Impostazioni. Nessun
    ripiego su modelli più grandi.
  - Il prompt è fisso. Il testo della chip arriva come dato, tra delimitatori, troncato a 2.000 caratteri:
    `titolo` + `brief` + i titoli delle dipendenze.
- **Quando si rifà.** Solo se cambia l'impronta di quel testo, quindi mai per un cambio di stato.
- **Stima.** Circa 700 token in ingresso e 120 in uscita per chip cambiata. La stima è scritta accanto
  all'interruttore.
- **Tetti.** Al massimo 5 chiamate per giro di riassunti, ogni 60 s, e 100 al giorno.
- **Concorrenza tra pannelli.** Prima di ogni chiamata, sotto il mutex `board` dell'helper:
  - si prenotano l'impronta e un'unità del budget del giorno in `board/riassunti.json` (CAS);
  - una prenotazione fallita o senza risposta (`isAnswered: false`) **conta** nel budget e non si ritenta
    finché il testo non cambia.
- Il ciclo dei riassunti è un `clock.every(60_000)` a parte, **fuori** dal `giro` che riconcilia e avvia.

**Rigenerazione dell'HTML.** In un ciclo proprio, ogni 30 s.

- Si calcola l'impronta degli ingressi: le chip del progetto (senza `aggiornata`), il percorso, la
  dimensione e la data di modifica di ogni piano, la data di modifica di `registro.json`, l'HEAD del ramo
  base, le milestone, i riassunti, la data di oggi (per la finestra di 30 giorni). L'istante di
  generazione **non** entra nell'impronta.
- Se l'impronta cambia, un solo pannello, quello che prende il mutex `board`, scrive con il comando
  `scrivi-board` dell'helper: file temporaneo e rinomina, nella sola `<cartella>/board/`.

### B.5 Impostazioni

Nella sezione «Progetto» c'è un `Select` «Board di progetto», con tre voci:

- **Spenta.**
- **Accesa.**
- **Accesa con riassunti (modello leggero).** Accanto si mostra il costo stimato.

Il valore si salva in `progetti[repo].board`. Questo comporta:

- aggiungerlo alla whitelist di `configura` in `disco.cjs:268`;
- aggiungerlo a `risorseDa` in `logica.ts:181`;
- aggiungerlo ai tipi.

**Spegnimento.** L'helper cancella `<cartella>/board/` (HTML e cache dei riassunti). Un riassunto già in
volo, al ritorno, trova la board spenta e scarta il risultato.

**Nella vista Lavoro**, con la board spenta, non compaiono né il pulsante né i riferimenti (regola A).

### B.6 Apertura dal pannello

**Pulsante «Apri board».** Sta nell'intestazione del pannello e compare solo se la board è accesa e il file
esiste.

- Esegue l'apriprogramma del sistema con `$.process.run` e argv fisso, senza shell:
  - Windows: `explorer.exe <file>`;
  - macOS: `open <file>`;
  - Linux: `xdg-open <file>`.
- Il percorso è quello calcolato dal pannello, e solo `<cartella>/board/index.html`.
- Sotto c'è il percorso in chiaro, selezionabile, come ripiego.

**Su ogni chip** c'è «Nella board». Apre lo stesso file: l'ancora non si passa all'apriprogramma, per non
costruire URL.

### B.7 Sicurezza e privacy

**Escape.** Una sola funzione `esc()` per ogni testo che viene da chip, piani, git, riassunti e regole. È
coperta da test con `<script>`, `"onx=`, `javascript:` e `</details>`.

**Niente URL nell'HTML.** La board non contiene link costruiti da dati (né `href` da issue o percorsi): i
percorsi sono testo.

**La cartella dati deve stare fuori da ogni working tree.** Prima della prima scrittura l'helper esegue
`git -C <cartella> rev-parse --is-inside-work-tree`.

- Se la cartella è dentro un working tree, la board resta spenta. L'Impostazione dice perché e come
  cambiare `cartella`.
- Lo stesso vale con `CHIPMANAGER_DIR`.

**Cosa esce dalla macchina.** Esce solo l'input dei riassunti, verso il fornitore Claude già ammesso, e
solo se l'utente li attiva.

### B.8 Test

**`board()`**:

- struttura: quattro gruppi e un `<details>` per ogni chip;
- `fallita` presente;
- escape;
- nessun `<script>` e nessun `href` esterno;
- CSP;
- gettone oscurato nel mandato;
- «ignoto» per le date mancanti.

**Gate**:

- board spenta: nessuna scrittura e nessuna chiamata al modello;
- spegnimento: cartella cancellata;
- cartella dentro un working tree: board rifiutata.

**Riassunti**:

- cache per impronta;
- cambio di stato senza chiamate;
- tetto giornaliero;
- `isAnswered: false` contato;
- `soloLocale`: zero chiamate;
- due pannelli simulati: una sola chiamata per impronta.

**`piano`**:

- rifiuto di `..`, percorsi assoluti, UNC, `\\?\`, `:` ed estensioni non ammesse;
- `prova-disco`: junction o link fuori dalla radice rifiutati, file oltre 200 KB troncato.

**`aggiorna_azione` con `revisione`**:

- rifiuto con un gettone vecchio;
- rifiuto da una sessione estranea;
- `riferitaDa` uguale al chiamante.

**Date** scritte in tutte e tre le transizioni.

### B.9 Lavori di persistenza (da non dimenticare)

| Dove | Cosa cambia |
|---|---|
| `types/index.d.ts` | `Azione` (`piano`, `revisione`, `consegnataIl`, `completataIl`), `RisorseProgetto.board`, forma `azioni-5`. |
| `logica.ts` | `normalizza`, `risorseDa`, `mandato()` (riga sulla revisione), `board.ts` nuovo. |
| `disco.cjs` | Comandi `leggi-piano`, `scrivi-board`, `cancella-board`, `git-log`; whitelist di `configura`; mutex `board`. |
| `register.tsx` | Argomenti di `suggerisci_azione` (`piano`) e di `aggiorna_azione` (`revisione`); cicli `board` e `riassunti`; date nelle transizioni. |
| `pannello.tsx` | Parte A; «Apri board»; campo «Piano» nell'editor; Select «Board di progetto». |
| Documentazione | README in italiano e inglese, CHANGELOG, `PIANO-2.2.md` (fasi aggiornate). |

## 3. Collocazione nelle fasi

| Fase | Versione | Contenuto |
|---|---|---|
| F2b | 2.3.1 | Parte A |
| F2c | 2.4.0 | Parte B |
| F3 | 2.5.0 | Impostazioni riprogettate, con la sezione Board già al suo posto |
| F4 | 2.6.0 | Pesi a profili, `proponi_pesi`, `risorse_agenti` con i token |

**Verifica di ogni fase:**

- validate, test, prova-disco e tsc;
- catture con dati d'esempio;
- revisione del diff da parte del motore concorrente.

## 4. Rischi residui

- **Alias `haiku`.** Va verificato all'avvio della F2c su questa build. Se non è ammesso, i riassunti
  restano spenti, con il motivo.
- **Apriprogramma su Windows.** Con un percorso che contiene spazi: argv, non stringa. Va verificato con il
  file reale.
- **Esito della revisione.** Dipende dalle sessioni che lo riferiscono. Senza, la board mostra il solo
  revisore previsto.

## 5. Correzioni del giro 2 (valgono SOPRA le sezioni precedenti)

Base: main @ `2b6fbe2`. La Parte A è chiusa e va in sviluppo; questa sezione riguarda solo la Parte B.

| # | Rilievo del giro 2 | Decisione |
|---|---|---|
| 3 | `board` può essere una junction. | **Accolto.** L'helper crea e controlla la cartella di destinazione. Usa `lstat` su ogni componente da `<cartella>` in giù e rifiuta link e junction. Richiede `realpath(dest) === realpath(<cartella>) + /board/<progetto>`. Ripete il controllo «fuori da ogni working tree» sul percorso reale della destinazione, non su `<cartella>`. |
| 7 | Il mandato ricostruito non prova cosa fu inviato; mancano alcune transizioni. | **Accolto.** La scheda lo intitola «Mandato (ricostruito con le regole attuali)». Non si salva il mandato inviato: costerebbe spazio su ogni chip per un dato che serve solo alla lettura. Le date passano da un'unica funzione pura, `transizione(a, stato, ora)`, in `logica.ts`, usata da tutti i punti che cambiano lo stato: `register.tsx:541`, `:719`, `:795`, `aggiorna_azione`, `chiudi`, «Segna completata». Un test enumera i punti con grep e fallisce se uno scrive `stato:` senza passare da lì. |
| 8 | Manca l'operazione dell'helper per prenotare. | **Accolto.** I nuovi comandi di `disco.cjs` lavorano tutti sotto il mutex `board:<dest>`. Ognuno rilegge sotto mutex la voce `board` del config e si rifiuta se non vale ancora quella attesa. I comandi: `board-prenota <dest> <impronta>`, `board-finalizza <dest> <impronta>` (testo da stdin), `board-scrivi <dest> <atteso>` (HTML da stdin), `board-spegni <dest>`. |
| 11 | All'impronta mancano `vive`, le risorse e le regole; la freschezza scade a 5 minuti. | **Accolto, semplificato.** La board **non mostra i limiti**: niente sintesi dei margini, solo i conteggi (al lavoro, aspettano te, da avviare), che stanno nella vista Carico del pannello. Così non c'è nessuna scadenza a 5 minuti da inseguire. L'impronta comprende: chip, `vive` (stato, fase, ramo, ultima attività arrotondata al minuto), `regole.fonte` e la versione delle regole, piani, registro, HEAD, milestone, riassunti e data. Test: spegnimento durante la generazione e durante una chiamata. |
| 12 | Board e cancellazione non sono isolate per progetto. | **Accolto.** La destinazione diventa `<cartella>/board/<progetto>/`, con lo stesso nome sicuro di `cartellaDati` (`owner__repo` più impronta se lungo). Alla creazione si scrive il marcatore `.chipmanager-board`. `board-spegni` cancella solo `index.html` e `riassunti.json`, solo se il marcatore c'è, senza seguire link. Non cancella cartelle né altri file. |
| 13 | Spegnere e riaccendere azzera il tetto giornaliero. | **Accolto.** Il budget sta in `budget.json` nella stessa destinazione. `board-spegni` non lo tocca. Test sul ciclo spento → acceso nello stesso giorno. |
| 14 | `revisione` senza `stato` non passa lo schema. | **Accolto.** `stato` diventa facoltativo se c'è `revisione`, e almeno uno dei due è obbligatorio. Il ramo «sola revisione» è esplicito e autorizzato dentro il CAS: gettone corrente, oppure il proponente. Test: lo stato resta invariato. |
| 15 | La revisione sopravvive al nuovo tentativo. | **Accolto.** Alla prenotazione di ogni nuovo avvio (`register.tsx:433`) la revisione si azzera nello stesso CAS. In più, `revisione.tentativo` registra il tentativo a cui si riferisce, e la board la mostra solo se coincide con quello corrente. |
| 16 | Il gettone ricompare nei nomi di worktree e ramo. | **Accolto.** Si oscura **l'HTML finale intero**, non campo per campo: `html.replace(/\baz-[a-z0-9]{6,}/gi, 'az-•••')`. Il formato è quello di `gettone()` in `register.tsx:114`. Test: l'HTML completo, generato con chip che hanno gettoni in mandato, ramo, worktree ed errore, non contiene nessuna corrispondenza di `/\baz-[a-z0-9]{6,}/i`. |

## 6. Correzioni del giro 3 (valgono SOPRA le sezioni 2 e 5)

| # | Rilievo del giro 3 | Decisione |
|---|---|---|
| 8 | Spento → acceso ritrova lo stesso valore; `configura` usa un altro mutex. | **Accolto.** La voce del config diventa `progetti[repo].board = { modo: 'spenta' \| 'accesa' \| 'riassunti', generazione: number }`. Ogni cambio di `modo` incrementa `generazione` dentro il CAS di `configura`. Tutti i comandi `board-*` prendono **lo stesso mutex di `configura`** (`<dir>:config`, `disco.cjs:271`), un lock solo, e ricevono la `generazione` attesa. Se la generazione sotto lock è diversa, rifiutano: niente prenotazione, niente finalizzazione, niente scrittura. Così il lavoro avviato prima di uno spento → acceso non si pubblica mai. Test: una generazione avviata, poi spento e acceso, poi la finalizzazione viene rifiutata. |
| 11 | Fonte e versione non coprono le regole effettive. | **Accolto.** L'impronta comprende un hash dei valori effettivi di `Regole` usati dalla board: `modelli`, `effort`, `tetto`, `revisori`, `corsiaCodex`, `sensibili`, `background`, più `risorse` senza i limiti misurati. |
| 12 | `cartellaDati` produce lo stesso nome per progetti diversi. | **Accolto.** La destinazione diventa `<cartella>/board/<pulito>-<hash dell'identità completa del progetto>`, con l'hash sempre presente. Il marcatore `.chipmanager-board` contiene l'identità completa (la stringa `repo` esatta). `board-scrivi`, `board-finalizza` e `board-spegni` leggono il marcatore e si rifiutano se l'identità non coincide. Test con due identità che collidevano: `C:/work/a b` e `C:/work/a_b`. |
| 16 | La regex lascia passare gettoni preceduti da lettere, cifre o `_`. | **Accolto.** Si oscura in due passi. Primo: si sostituisce ogni occorrenza **letterale** di ogni gettone noto (il `tentativo` attuale di tutte le chip del progetto) con `split`/`join`. Secondo: la regex senza confine di parola `/az-[a-z0-9]{10}/gi`, perché il formato di `gettone()` è di 10 caratteri. Test indipendente dalla regex: per ogni chip con `tentativo`, `html.includes(tentativo) === false`, e i gettoni sono annidati in testo (`token_az-…`, `xaz-…`). |

## 7. Correzione del giro 4

**11, chiuso così.** L'impronta comprende l'hash dell'**intero oggetto `Regole` effettivo**, compresi `lette`
e `fonte`. Restano fuori solo i limiti misurati dentro `risorse`. Un elenco di campi non serve più.

Test: si toglie `corsia_codex.modelli` da `routing.json`. `lette` diventa `false`, quindi l'impronta cambia
e la board si rigenera con i blocchi di avvio.
