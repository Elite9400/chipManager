# Piano — chipManager: sobrietà con più sessioni aperte (v1)

Stato: **bozza della master**, da far rivedere a Codex astra.
Base: `main` dopo la fusione della 2.3.1 e della 2.4.0. Corre in parallelo a C0 di PIANO-grafica: i file
sono quasi tutti diversi (vedi §5).

## 0. Richiesta del committente

«Fai in modo che questa mod, se avviata su più sessioni, non vada a saturare RAM o risorse: deve essere
un gestionale che aiuta. Cerchiamo dei modi per limitare al minimo il consumo di risorse e di token che
potrebbero servire.»

Contesto: oggi, 2026-11-05, la macchina ha esaurito la memoria. Erano aperte più sessioni Claude con la
mod, più Codex. La causa non è dimostrata, ma la mod moltiplica il suo lavoro per ogni sessione aperta.

## 1. Diagnosi: cosa fa oggi ogni pannello, per ogni sessione

Riferimento: `hooks/register.tsx:1066-1076`, `strumenti/fornitori.cjs`.

| Ciclo | Ogni | Cosa costa |
|---|---|---|
| `giro` | 20 s | Elenco e lettura di tutti i file `a-*.json` della cartella, compresi i completati di sempre. Legge `registro.json`. Avvia `node disco.cjs` per ogni scrittura CAS. |
| `leggiSessioni` | 20 s | `list_sessions` (limite 50). Fino a 8 `get_session`, con cache di 60 s. `get_usage` per ogni sessione attiva. Avvia **un processo `node fornitori.cjs sessioni`**, che scorre `~/.codex/sessions` e legge fino a **40 file**: 256 KB di testa più 512 KB di coda ciascuno, cioè fino a circa **30 MB letti e analizzati come JSON ogni 20 s**. |
| `aggiornaRisorse` | 5 min | Un altro `node fornitori.cjs`, con `codexLocale`: 30 file da 512 KB, **senza filtro di età**. |
| `leggiTraguardi` | 5 min | Processi `gh`. |

Con **N sessioni aperte sullo stesso progetto** tutto si moltiplica per N:

- N processi Node ogni 20 s, ognuno da circa 40–60 MB residenti finché vive;
- N × 30 MB di letture al minuto per tre;
- N volte le stesse chiamate all'app.

Il risultato è identico per tutti: le sessioni Codex e Claude della macchina sono le stesse.

**Token.** Ogni sessione porta nel contesto la descrizione dei tre strumenti
(`register.tsx:1028-1066`):

- `suggerisci_azione`, con 22 proprietà descritte;
- `risorse_agenti` e `aggiorna_azione`, entrambi `isDeferred: false`.

Lo stesso prezzo si paga in ogni sessione, anche dove la mod non serve.

**Memoria nel processo.**

- L'atomo `azioni` tiene tutte le azioni di sempre, con brief fino a 20.000 caratteri.
- La mappa `dettagli` (`register.tsx:290`) non viene mai potata.

## 2. Principi

1. **Il lavoro di sorveglianza lo fa una sola sessione per macchina.** Le altre leggono il suo risultato.
2. **Senza nessuno che guarda, si rallenta.** Senza lavoro in corso, si rallenta ancora.
3. **Si legge solo ciò che è cambiato.**
4. **Nessun token speso dalla mod senza una scelta esplicita** (i riassunti della board sono già opt-in).
5. **La mod misura e mostra il proprio consumo.** Un gestionale che aiuta non può essere una scatola nera.

## 3. Interventi

### D1 — Una sentinella per macchina, gli altri leggono l'istantanea

**Lease.** Il file `~/.claude/chipmanager/sentinella.json` contiene
`{ sessione, scade, versione }`, con scadenza a 60 s. Si scrive e si rinnova con `$.fs` (niente processi):

1. Si legge il file.
2. Se è scaduto, oppure appartiene a questa sessione, si scrive il proprio contenuto.
3. Si rilegge: se il contenuto riletto è il proprio, questa sessione è la sentinella.

Due sentinelle per pochi secondi sono innocue, perché lavoro doppio non vuol dire lavoro sbagliato.

**La sentinella** esegue `leggiSessioni` (Claude e Codex) e la parte comune di `aggiornaRisorse` (limiti
di piano). Scrive l'istantanea `~/.claude/chipmanager/istantanea.json`:

- con `{ letto, sessioni (tutte le sessioni della macchina, solo metadati), limiti, versione }`;
- in modo atomico (file temporaneo e rinomina) con l'helper esistente, una sola chiamata per giro.

**Gli altri pannelli** leggono l'istantanea con `$.fs.read`:

- ogni pannello filtra le sessioni del **proprio** progetto (per `cwd`, come oggi `sessioniClaude`);
- nessuna chiamata all'app e nessun processo;
- se l'istantanea ha più di 90 s, il pannello prova a diventare sentinella.

**Cosa resta per progetto.** Le milestone (`gh`) le legge una sessione per progetto, con lo stesso
schema: lease e istantanea nella cartella dati del progetto, ogni 5 minuti come oggi.

**Il `giro` resta per sessione**, perché riconcilia anche gli avvii di quella sessione (`lanciataDa`). Per
gli altri pannelli diventa più leggero con D3.

### D2 — Cadenza adattiva

| Situazione | Sentinella | Altri pannelli |
|---|---|---|
| Pannello visto di recente (ultimo `ui.render` sotto i 2 minuti) e lavoro in corso (sessioni attive, chip `in-avvio` o `avviata`) | 20 s | lettura dell'istantanea ogni 20 s |
| Pannello visto, nessun lavoro in corso | 60 s | 60 s |
| Nessun pannello visto da più di 5 minuti | 5 min | il `giro` passa a 2 min; nessuna lettura dell'istantanea finché non si ridisegna |

- Un `ui.render`, il pulsante «Aggiorna» o una chiamata a uno strumento della mod riportano subito alla
  cadenza viva, con una lettura immediata.
- Si usa un solo `$.clock.every(20_000)` che decide a ogni battito se lavorare. Questo sostituisce i
  quattro timer.

### D3 — Leggere solo ciò che è cambiato

**Azioni.** `carica` tiene in memoria `{ nome → mtime, dimensione, azione }`. Rilegge solo i file con
data o dimensione cambiate, senza processi.

- Le azioni `completata` e `scartata` più vecchie di 30 giorni non si caricano nell'atomo.
- Restano su disco: la board le conta dal solo elenco dei file.

**Registro.** `registro.json` si rilegge solo se cambia la data di modifica.

**Sessioni Codex** (helper). La cache sta in `~/.claude/chipmanager/cache/codex.json`, con
`{ percorso → dimensione, data, offset letto, metadati estratti }`.

- La testa del file (`session_meta`, il primo `turn_context`) si legge **una volta**.
- Della coda si leggono solo i byte aggiunti dall'ultimo offset, al massimo 512 KB.
- Un file con dimensione e data invariate non si apre.

**Limiti Codex.** `codexLocale` usa la stessa cache e considera solo i file degli ultimi 7 giorni.

**Dettagli delle sessioni.** La mappa `dettagli` si pota a ogni giro: escono le voci non più nell'elenco.

### D4 — Un processo per giro, non uno per lettura

**Un comando unico.** L'helper `fornitori.cjs` riceve il comando `giro-sentinella`, che in un solo
processo fa:

- le sessioni Codex;
- i limiti Codex;
- i limiti della status line;
- la scrittura atomica dell'istantanea.

**Obiettivo misurato.** Al massimo **1 processo Node al minuto per macchina** a regime, con il pannello
visto e del lavoro in corso. **Zero** processi dai pannelli che non sono sentinella, salvo le scritture
CAS che l'utente provoca.

### D5 — Token: il minimo nel contesto di ogni sessione

**Descrizioni.** Si accorciano le descrizioni dei tre strumenti, senza perdere vincoli.

- Le descrizioni delle proprietà di `suggerisci_azione` scendono a una riga ciascuna; i dettagli vanno nel
  testo dei rifiuti, cioè negli errori restituiti quando l'agente sbaglia.
- Obiettivo: **meno della metà dei token** di oggi, misurati con il conteggio dei caratteri prima e dopo e
  scritti nel CHANGELOG.

**Strumenti differiti.** `risorse_agenti` e `aggiorna_azione` diventano `isDeferred: true`: si caricano
solo quando servono.

- `aggiorna_azione` lo chiama solo una sessione avviata dal pannello, e il suo mandato glielo nomina già.
- `suggerisci_azione` resta caricato, perché è il motivo della mod. Va però verificato che l'host lo
  richieda (rischio §6).

**Mandato.** `mandato()`: il blocco fisso del background non si ripete se è già nel brief.

**Riassunti della board.** Restano spenti per difetto (piano board, B.4). Non si aggiunge nessun'altra
chiamata al modello.

### D6 — La mod mostra il proprio consumo

Nella vista Carico, in fondo, una riga grigia:

> Consumo di chipManager: sentinella in «<titolo sessione>» · 0,8 processi/min · 3 chiamate all'app/min ·
> istantanea di 12 s fa

Su questo pannello i contatori sono in memoria, a finestra mobile di 10 minuti. La riga si vede solo se la
mod è attiva da più di un minuto.

## 4. Test e misura

- **Banco di misura.**
  - Il test monta 1 sentinella e 3 pannelli simulati (stessa cartella, stesso orologio finto) e conta
    `$.process.run` e `$.mcp.call` in 10 minuti simulati.
  - Atteso: gli altri pannelli fanno 0 processi e 0 chiamate all'app; la sentinella fa al massimo 10
    processi.
- **Lease.**
  - Scadenza e subentro.
  - Due pretendenti in contemporanea: al massimo per un giro sono sentinelle entrambi.
  - Istantanea vecchia: subentro.
- **Cadenza.** Le tre righe della tabella D2, con orologio finto.
- **Cache Codex** (`prova-disco`).
  - Un file invariato non viene riaperto: si conta con `fs.openSync` spiato.
  - Un file cresciuto viene letto solo dalla coda nuova.
  - Un file troncato o sostituito viene riletto da capo.
- **Azioni.**
  - I file invariati non si rileggono.
  - Le terminali vecchie restano fuori dall'atomo.
- **Token.** Un test fissa un tetto alla lunghezza totale delle descrizioni degli strumenti, come guardia
  di regressione.
- **Prima e dopo sulla macchina reale.** Su Windows, con 4 sessioni aperte sullo stesso progetto e dati
  d'esempio, per 10 minuti, si misurano:
  - i processi `node` avviati;
  - il picco di memoria dei processi della mod;
  - i byte letti sotto `.codex`.

  I numeri vanno nel rapporto.

## 5. Collocazione

| Fase | Versione | Parte da | File |
|---|---|---|---|
| D | 2.4.2 | main con 2.3.1 e 2.4.0 | `register.tsx` (cicli, lease, `carica`, strumenti), `strumenti/fornitori.cjs`, `strumenti/disco.cjs` (scrittura dell'istantanea), `logica.ts` (funzioni pure: cadenza, filtro dell'istantanea), `vista-carico` o `pannello.tsx` (solo la riga D6) |

**In parallelo con C0.** C0 tocca `pannello.tsx` (divisione), `tema.ts`, `ui.tsx` e una riga di
`register.tsx`: la chiamata a `disegna` con `viewport.columns`.

- D non tocca quella riga.
- D aggiunge la riga D6 **dopo** la fusione di C0, nel file `vista-carico.tsx`.
- Ordine di fusione: C0, poi D (con merge di main).

## 6. Rischi

- **Strumento differito.** Va verificato che l'host accetti `isDeferred: true` per uno strumento di una
  mod e che l'agente lo trovi con ToolSearch. Se `aggiorna_azione` differito facesse perdere le consegne,
  resta caricato e se ne accorcia solo la descrizione.
- **Istantanea comune a più progetti.** Contiene i metadati delle sessioni di tutti i progetti della
  macchina: titoli, percorsi, rami. Resta in `~/.claude/chipmanager/` sulla stessa macchina e ogni
  pannello filtra il proprio progetto. Nessun testo delle conversazioni, come oggi.
- **Sentinella in una sessione che si chiude.** La lease scade in 60 s e un altro pannello subentra. Per
  quel tempo l'istantanea è un po' più vecchia ed è dichiarata con la sua età.
- **Più versioni della mod sulla macchina.** La `versione` nella lease e nell'istantanea fa sì che un
  pannello ignori l'istantanea di una versione diversa e lavori da solo.

## 7. Versione 2: dopo il giro 1 di astra (sostituisce le sezioni 3–6)

Accolgo l'indicazione principale: **partire dagli interventi semplici e misurati**. La sentinella unica con
istantanea condivisa (vecchio D1) esce da questa fase. Ha problemi aperti:

- esclusione;
- ordine delle pubblicazioni;
- contenuti non identici fra sessioni;
- privacy;
- capacità diverse fra Desktop e CLI.

Torna solo se le misure di D7 mostrano che, dopo gli interventi qui sotto, serve ancora.

**Diagnosi corretta (rilievi 7 e 8).**

- Il massimo teorico di `leggiSessioni` lato Codex è **30,72 MB a giro**, solo con 40 file recenti e
  grandi.
- `codexLocale` arriva a **15,36 MB ogni 5 minuti**.
- `get_usage` segue la cache dei dettagli: massimo 8 sessioni, ognuna al massimo ogni 60 s.
- Sono **massimi**, non consumi osservati. La causa dell'esaurimento di memoria resta **non dimostrata**.
- Lo schema di `suggerisci_azione` ha 19 proprietà, 18 descritte.
- `aggiorna_azione` è già differito per difetto.

### D1 — Cache incrementale delle sessioni Codex (nell'helper)

**File e chiavi.**

- Cache in `~/.claude/chipmanager/cache/codex.json`.
- Una voce per percorso: `{ dimensione, mtimeMs, ino (se disponibile), offsetCompleto, testa: { meta, primoTurno }, ultimo: { modello, effort, token, finestra, aperto } }`.

**Righe incomplete.**

- `offsetCompleto` è sempre la posizione **subito dopo l'ultimo `\n`** letto.
- Una riga senza `\n` finale non si consuma: si rilegge al giro dopo.

**Identità e troncamento.** Il file si rilegge da capo se cambia uno di questi:

- `ino`;
- la dimensione scende sotto `offsetCompleto`;
- la data di modifica torna indietro.

**Arretrato oltre 512 KB.**

- Si salta a `dimensione − 512 KB` e si riallinea al primo `\n`.
- Servono solo gli **ultimi** stati (modello, effort, token, turno aperto), che stanno in coda.
- Il salto si conta nella diagnostica.

**Stato nel tempo.** `inCorso` si ricalcola **sempre** con `aperto && adesso − mtimeMs ≤ 10 min`. Un file
invariato diventa inattivo da solo.

**File invariato.** Si fa solo `stat`, senza aprirlo.

**Scrittura della cache.**

- Sotto il mutex esistente di `disco.cjs` (`conMutex('codex-cache')`), con scrittura atomica.
- La cache è un dato derivato. Se illeggibile o non valida, si scarta e si ricostruisce. Il risultato non
  cambia; cambia solo il costo.

**Limiti.** `codexLocale` usa la stessa cache, solo con i file degli ultimi 7 giorni.

**Test (`prova-disco`):**

- riga scritta in due tempi;
- file troncato;
- file sostituito con la stessa dimensione (altro `ino` o data);
- arretrato oltre 512 KB;
- inattività dopo 10 minuti senza modifiche;
- cache corrotta;
- due processi concorrenti: nessuna eccezione e risultato corretto;
- un file invariato non viene aperto (`fs.openSync` spiato).

### D2 — Cadenza: l'orchestrazione resta pronta, le osservazioni accessorie rallentano

- **Il `giro` non rallenta** finché esiste lavoro pendente: `proposta` in coda, `accodata`, `in-avvio`,
  `avviata`, `consegnata`, esecuzioni CLI. Senza lavoro pendente passa a 60 s.
- **`leggiSessioni`** (sessioni e contesti, solo per la vista) lavora così:
  - ogni 20 s se `$.ui.panes()` dice che il pannello di questa sessione è `isShown`;
  - altrimenti ogni 2 minuti, e subito quando torna `isShown` o si preme «Aggiorna».
  - `isShown` dice che il pannello è a schermo, non che qualcuno lo guarda. È il segnale migliore che
    l'host offre, e lo dichiariamo così.
- `aggiornaRisorse` e `leggiTraguardi` restano a 5 minuti.
- Un solo battito da 20 s decide cosa fare, al posto dei quattro timer.

### D3 — Meno processi nel giro

- `codexOccupato` (un processo a ogni giro, `register.tsx:123`) si chiama **solo se** c'è un'azione Codex
  pronta a partire in questo giro.
- `stato-cli` si chiama solo per le esecuzioni CLI ancora aperte, come oggi.
- **Obiettivo, scritto con onestà:**
  - a riposo (niente pendente, pannello non a schermo): al massimo 1 processo ogni 2 minuti per sessione,
    cioè la sola lettura Codex;
  - al lavoro con pannello a schermo: al massimo 3 processi al minuto per sessione (lettura Codex ogni
    20 s), più le scritture CAS e le esecuzioni che l'utente provoca.

  Il banco D7 lo verifica.

### D4 — Letture delle azioni e memoria nel processo

- `carica` conserva `{ nome → mtime, dimensione }` dell'ultima lettura e rilegge **solo i file cambiati**,
  sempre con `$.fs`. L'atomo resta **completo**: dipendenze, `taskId` e pianificazione hanno bisogno anche
  delle terminali.
- `registro.json` si rilegge solo se cambia la data di modifica.
- La mappa `dettagli` si pota: escono le sessioni non più presenti nell'ultimo elenco.
- La memoria dei brief delle azioni terminali **non** si taglia ora. Si interviene solo se D7 la mostra
  significativa.

### D5 — Contesto degli agenti

- Descrizioni di `suggerisci_azione` e `risorse_agenti` più brevi, senza perdere vincoli. Il dettaglio va
  nei messaggi di rifiuto, che l'agente legge quando sbaglia.
- Si misura in **caratteri** prima e dopo e si dichiara così: non sono token.
- `risorse_agenti` diventa `isDeferred: true`. Va verificato nell'host reale che una sessione lo trovi con
  ToolSearch e lo chiami.
- `aggiorna_azione` resta com'è: è già differito.
- Un test fissa il tetto dei caratteri delle descrizioni.

### D6 — Diagnostica onesta

Nella vista Carico, una riga grigia: «Questa sessione, ultimi 10 minuti: N processi · M chiamate all'app ·
X MB letti dall'helper Codex · K salti d'arretrato».

- Si contano solo i dati di **questa** sessione, e la riga lo dice.
- L'helper restituisce byte letti e salti nella risposta.

### D7 — Misura prima e dopo (decide se serve altro)

Macchina reale, Windows, dati d'esempio. Due situazioni: 1 sessione e 4 sessioni sullo stesso progetto,
pannello a schermo, 10 minuti ciascuna, prima e dopo.

Si misurano:

- processi `node` figli avviati, dai contatori D6 sommati fra le sessioni;
- memoria di lavoro aggregata dei processi `claude` e dei loro figli, campionata ogni 10 s con
  `Get-Process` (picco e media);
- byte letti dall'helper;
- latenza fra «Avvia» e sessione avviata, e fra consegna e stato «consegnata» (non deve peggiorare).

I numeri vanno nel rapporto alla master. Se la memoria aggregata con 4 sessioni resta alta per colpa della
mod, si apre la fase della sentinella condivisa, con un piano a parte.

### Collocazione

Fase D, versione 2.4.2.

- **File:** `strumenti/fornitori.cjs` e `strumenti/disco.cjs` (cache e mutex); `hooks/register.tsx`
  (battito unico, `codexOccupato`, `carica`, `dettagli`, descrizioni); `hooks/logica.ts` (funzione pura
  della cadenza). La riga D6 va in `vista-carico.tsx` dopo C0.
- **In parallelo a C0:** C0 tocca `register.tsx` solo nella chiamata a `disegna`, che D non tocca.

## 8. Esito del giro 2 (prevale sulla sezione 7)

### Rilievo 4 (cache Codex): accolto

**Salto dell'arretrato.** Dopo un salto, `aperto` e lo stato di turno si **ricalcolano dalla sola coda letta**:

- c'è un `task_started` senza un `task_complete` successivo → aperto;
- c'è un `task_complete` → chiuso;
- non c'è nessuno dei due → stato **ignoto**. La sessione non è «in corso», e il pannello mostra «—» come
  per i dati mancanti.

Lo stato di prima del salto non si eredita mai.

**Riscrittura senza crescita.** Se `mtimeMs` cambia e la dimensione è **uguale o minore** di quella in
cache, il file si rilegge da capo. I file `.jsonl` crescono solo in coda: una modifica senza crescita è una
riscrittura.

### Nuovo rilievo (limiti di piano nella cache): accolto

Ogni voce della cache tiene anche `limiti`: le ultime osservazioni **normalizzate** di `finestreCodex`,
ognuna con id, percentuale, reset e **timestamp originale dell'evento**.

- Per ogni id si tiene l'osservazione con il timestamp più recente.
- Un evento senza `rate_limits` non cancella l'ultima misura valida.
- `codexLocale` ricostruisce i limiti dalla cache, con la stessa selezione per id di oggi
  (`fornitori.cjs:106`).
- Test: a cache fredda e a cache calda il risultato è identico, e un evento successivo senza `rate_limits`
  lascia intatta la misura.

### Rilievo 9, residuo (campi della cache): accolto

La cache conserva **solo** questi campi, validati con la stessa funzione `testo()` di oggi e con le stesse
lunghezze massime:

- `meta`: `id`, `cwd`, `ramo`, `figlia` (booleano, al posto di `parent_thread_id`);
- `primoTurno`: `modello`, `effort`;
- `ultimo`: `modello`, `effort`, `token`, `finestra`, `stato`;
- `limiti`: come sopra.

Nessun payload integrale e nessun testo della conversazione. Un file con dati non validi non entra nella
cache.

### Rilievo 6 (budget dei processi): accolto, tetti corretti

Si distingue la **raccolta** (letture per la vista e per i limiti) dall'**orchestrazione** (avvii, CAS,
`stato-cli`, controlli della corsia Codex, che dipendono dal lavoro dell'utente).

| Situazione | Raccolta |
|---|---|
| A riposo, pannello non a schermo | Lettura Codex ogni 2 min (0,5/min) più `aggiornaRisorse` ogni 5 min (0,2/min) = **0,7 processi/min per sessione** |
| Pannello a schermo | 3/min più 0,2/min = **3,2 processi/min per sessione** |

L'orchestrazione si conta a parte, in D6 e D7, e non ha un tetto. Il suo obiettivo è non chiamare
`codexOccupato` quando non c'è un'azione Codex pronta (D3).

### Rilievo 10 (misure): accolto

D7 aggiunge:

- **regime nascosto**: 4 sessioni con il pannello non a schermo per 10 minuti, con il tetto di 0,7/min
  ciascuna;
- **test di cadenza a tempo simulato** (orologio iniettato nella funzione pura della cadenza e nel battito):
  - passaggio a schermo / non a schermo;
  - lavoro pendente che compare e sparisce;
  - sospensione della macchina, cioè un salto in avanti dell'orologio: un solo giro di recupero, non una
    raffica;
  - errore di lettura: il giro successivo riprova alla cadenza normale, senza ripetizioni ravvicinate.

## 9. Esito del giro 3

**Limiti nella cache e salto: accolto con la correzione proposta da astra.**

- Per i **limiti**, l'intervallo saltato non si perde: si scorre a blocchi da 64 KB, con memoria limitata.
- Si analizzano come JSON solo le righe che contengono la sottostringa `rate_limits`.
- Per stato e turno vale ancora la sola coda (sezione 8).
- **A cache fredda** la prima lettura scorre tutto il file a blocchi, una sola volta, con la stessa
  pre-selezione.
- I byte letti di questo tipo si contano a parte in D6 e D7.

Test di equivalenza: un limite al 10% in cache; dopo si aggiungono un limite all'80% e oltre 512 KB di righe
senza limiti. Cache calda e cache fredda devono dare entrambe 80%.

I processi `gh` delle milestone restano fuori dai tetti dei processi Node. Si contano in D6.
