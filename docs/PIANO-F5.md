# F5 — Rifinitura, legenda, misure, immagini (chiude la 2.2.0)

Base: `main` dopo la fusione del multilingua. F5 aggiunge solo ciò che manca alla release pubblica:
nessuna funzione nuova oltre la legenda.

## F5.1 — Legenda per chi è nuovo (B10)

**Una sola fonte.** Il testo della legenda vive nei dizionari di `hooks/lingua.ts`, nelle sei lingue, in
un gruppo `legenda.*`. Il pannello e la board lo leggono da lì. I README lo ricopiano a mano in en e it,
e un test di prova-disco controlla che ogni voce del README inglese corrisponda alla voce `en` del
dizionario, così i due non si contraddicono.

**Voci.**
- Corsie R0–R5: che cosa vuol dire ciascuna, chi la esegue, perché R4 e R5 restano a Claude.
- Termini:
  - effort, worktree, fork, fusione, registro, MCP, PII;
  - soglie di attenzione e di critica;
  - contesto, token, cartella condivisa, cloud.
- Le fasi F0–F5 e i blocchi B1–B10 NON entrano nel pannello: sono storia dello sviluppo. Stanno solo nel
  piano.

**Dove.**
- Impostazioni: una sezione «Legenda», ultima, chiusa per default, una voce per riga, larghezza ≤ 60
  colonne nel terminale.
- La sigla di corsia nella chip e il livello di effort hanno un rimando breve alla voce:
  - sul desktop un tooltip, se l'host lo offre (`title`/`tooltip` dell'elemento, da verificare nel `.d.ts`);
  - altrimenti nessun rimando: non si inventano pulsanti nuovi sulla riga.
- Board: una sezione «Legenda» in fondo, chiusa (`<details>`), testo escapato.
- README e README.it: sezione «Legend» / «Legenda».

**Test.**
- Completezza nelle sei lingue: lo assicura già il controllo stretto dei dizionari.
- Resa a 60 colonne della sezione in de e fr.
- Corrispondenza README en ↔ dizionario en.

## F5.2 — Stile developer e revisione grafica (richiesta del committente, 6 novembre 2026)

**Direzione.** Il pannello deve sembrare uno strumento da sviluppatore, non un modulo di ufficio: denso,
allineato, leggibile a colpo d'occhio, come `git log --oneline`, `htop` o la barra di stato di un editor.
Si resta dentro gli elementi dell'host, senza colori o caratteri inventati.

- **Carattere monospazio.** Si usa `Text mono` (esiste nell'host: «the surface's monospaced face»; il
  terminale lo è già) per tutto ciò che è un dato:
  - id;
  - SHA corti;
  - rami;
  - modelli;
  - corsie;
  - effort;
  - percentuali;
  - token;
  - durate;
  - orari.

  Le etichette e le frasi restano nel carattere normale.
- **Righe compatte e allineate.** Una chip è una riga «stato · titolo · meta», con la meta in colonne fisse:
  `● R3 opus-5.5 xhigh  claude/i18n  4119b6a  12m`. Dove la larghezza non basta la meta va a capo sotto il
  titolo, già allineata (le regole di a capo di C1 restano).
- **Glifi di stato al posto delle parole.** `●` attiva, `○` in coda, `✓` consegnata, `✗` errore, `⏸` in
  pausa. C'è sempre anche il testo per chi usa lo screen reader: il colore non è mai l'unico segnale.
- **Numeri.** Unità brevi (`12m`, `3h`, `48k tok`, `72%`), senza frasi intorno. Tempi relativi; l'ora esatta
  sta nel dettaglio.
- **Gerarchia.** Pochi titoli, in minuscolo stile sezione (`work`, `load`, `settings`, nella lingua
  dell'utente); separatori sottili, niente riquadri dentro riquadri.
- **Colore.**
  - Resta l'accento di C0. Rosso e giallo compaiono solo per errore e attenzione; il resto è neutro.
  - Le barre di carico usano blocchi da terminale (`▕████▌   ▏ 72%`), uguali sul desktop e nel terminale.
- **Comandi.** Etichette brevi e verbali (`run`, `run all`, `open board`, `retry`), nella lingua dell'utente.
  Accanto, la scorciatoia da tastiera dove l'host la offre.
- **Board HTML.** Stessa direzione:
  - carattere monospazio di sistema (`ui-monospace`, senza font esterni) per i dati;
  - tabella densa;
  - tema scuro di default che segue `prefers-color-scheme`.
- **Limiti.**
  - Le traduzioni non si accorciano a scapito del senso.
  - La resa a 60 colonne resta il vincolo del terminale.
  - Si cambia la presentazione, non la struttura delle viste (quella l'hanno decisa C1/C2).

**Revisione sulle catture (impeccable critique + audit).**

- **Catture.** Dal banco di cattura dei test, con dati d'esempio, in inglese:
  - Lavoro, Carico, Impostazioni (con la Legenda aperta) e board;
  - terminale a 60 e 100 colonne.
  - Più una cattura reale dell'app desktop, sempre con dati d'esempio: un progetto vuoto di prova, mai
    questo repository né progetti con dati.
- **Revisione.** `impeccable critique` e `audit` sulle catture.
  - Si correggono i rilievi Alti e Medi che non cambiano struttura.
  - Un rilievo strutturale si annota e non si fa in F5.
- **Vincolo.** Le catture restano in locale fino al passo F5.4.

## F5.3 — Misura D7 (sobrietà), in versione prudente

La macchina ha già avuto due esaurimenti di memoria: il banco a 4 sessioni da 10 minuti è rischioso.
Si fa così:

- **Sessioni.** 1 e poi 3 sessioni sullo stesso progetto di prova, pannello a schermo, 5 minuti ciascuna.
- **Campionamento.**
  - `Get-Process` ogni 10 s su `claude` e figli: picco e media della memoria di lavoro;
  - contatori D6 dei processi figli;
  - byte letti dall'helper.
- **Latenza.** Tra «Avvia» e sessione avviata, su 3 avvii.
- **Arresto.** Se la memoria libera scende sotto 2 GB, si ferma il banco e si annota.
- **Esito.** Una tabella nel CHANGELOG della 2.2.0, sezione «Resources». Se le misure mostrano un
  problema, si apre una issue: non si interviene dentro F5.

## F5.4 — README e immagini

- **Immagini e GIF.** Si rifanno in inglese con dati d'esempio, dalle catture di F5.2 dopo le correzioni.
- **README.** I README en/it descrivono la 2.2.0. Le Features sono ordinate per uso; la sezione Languages
  c'è già; si aggiunge Legend.
- **Controllo prima del commit.** Nessun nome di progetto reale, percorso personale o dato reale nelle
  immagini; `scan_secrets` sui file nuovi.

## F5.5 — Release 2.2.0 (la fa la master)

- **CHANGELOG.** Le voci [2.4.1]–[2.6.0], F4, multilingua e F5 confluiscono in **[2.2.0]**, con la data
  del rilascio. Le versioni interne spariscono.
- **Versione.** `plugin.json` passa a 2.2.0. Poi si reinstalla la mod: 2.2.0 è minore della 2.6.0
  installata.
- **Verifiche.** validate, plugin test, prova-disco, tsc.
- **Pubblicazione.** Push, tag `v2.2.0` e release su GitHub **solo dopo il sì esplicito del committente**.

## Esecuzione

- **Chi.** Sviluppa F5.1, F5.2 e F5.4 una sessione Claude (Opus 5.5) con il contesto di Impostazioni e
  viste.
- **Revisione.** Codex (gpt-6-astra) rivede il diff.
- **F5.3.** La esegue la master, perché richiede finestre e sessioni reali.
- **Verifiche.** Una alla volta.

## Correzioni del giro 1 (prevalgono su tutto quanto sopra)

1. **Glifi (Alta) — accolto.** `Text` non ha aria-label né tooltip, e PIANO-grafica chiede segno + parola visibile. Lo stato resta **glifo + parola tradotta breve** (`● running`, `○ queued`, `✓ delivered`, `✗ error`, più `◐ starting` e `? uncertain` per avvio in corso/incerto). Le scorciatoie usano `Button.hotkey` e si dichiarano «col pannello a fuoco»; nessuna promessa oltre.
2. **Catture (Alta) — accolto.** Il kit di test non dipinge. Le catture vengono dall'host reale:
   - terminale: `claude --plugin-dir <worktree>` in una scheda di terminale, su un progetto demo (cartella vuota con `git init` e azioni d'esempio caricate da fixture), testo catturato e reso in SVG da uno script locale; larghezze 60, 100 e 120 colonne (la 120 esercita la classe larga ≥ 110). Richiede il login della CLI: se è scaduto, lo chiede il committente con `claude /login` e la fase aspetta.
   - desktop: una sola cattura fatta dal committente sullo stesso progetto demo al collaudo, con le istruzioni passo per passo.
   - Il test di resa esistente si estende alle **sei lingue** con la Legenda aperta: contenuto ≤ 58 colonne a 60, più righe per voce ammesse.
3. **Dati reali (Alta) — accolto.** Per le catture si usa una configurazione isolata: `CLAUDE_CONFIG_DIR` e home di prova, nessun fornitore configurato, `get_usage` e letture di `fornitori.cjs` disattivate tramite la config di prova (i limiti non configurati non si mostrano già per regola). Ogni immagine e **ogni frame** della GIF si guarda a occhio prima del commit, oltre a `scan_secrets`.
4. **D7 sicurezza (Alta) — accolto, ridotto.** Si misura **una sola sessione**, prima (2.1.0 dal tag `v2.1.0` in un worktree) e dopo (ramo F5), regime visibile e nascosto, 5 minuti ciascuno. Prima di avviare si controlla la memoria libera (≥ 4 GB, altrimenti si salta); un sorvegliante PowerShell indipendente campiona ogni 2 s e chiude **solo** i processi del banco se scende sotto 2 GB. La prova a più sessioni **non si fa** e il CHANGELOG la dichiara non misurata.
5. **D7 completezza (Media) — accolto.** La tabella riporta prima/dopo, visibile/nascosto, latenza Avvia→avviata e consegna→«consegnata», e separa i figli di raccolta (helper) da quelli di orchestrazione (`gh`, Explorer), che il contatore D6 somma.
6. **Release (Media) — accolto.** Tutto ciò che segue la release pubblica 2.1.0 (comprese le voci interne 2.2.0–2.6.0 e la vecchia [2.2.0]) confluisce in una sola **[2.2.0]**; si correggono link di confronto in fondo al CHANGELOG, badge e didascalie dei README.
7. **Collaudo funzionale (Media) — accolto.** Dopo la reinstallazione: la master chiama `risorse_agenti` e `proponi_pesi` da una sessione reale; il committente verifica riga pendente, «Rivedi», Applica/Annulla e il popup. Esito annotato nel rapporto di F5.
8. **B10 (Media) — accolto.** Il requisito si aggiorna così: fasi F0–F5 e blocchi B1–B10 stanno nei README in una breve sezione «Development history» che rimanda ai piani in `docs/`; nel pannello non compaiono. Il rimando dalla riga è testuale e solo nella sezione Impostazioni dei pesi («R0–R5: see Legend»). I dizionari sono `hooks/lingue/*.ts`; il test di corrispondenza copre README inglese **e** italiano.

## Correzioni del giro 2 (prevalgono sul giro 1 per D7)

- **Strumento di misura comparabile (Media) — accolto.** Per entrambe le versioni si usano gli **stessi** due strumenti esterni, indipendenti dal codice della mod:
  - memoria: campionamento `Get-Process` ogni 2 s dell'albero dei processi della sessione di banco (picco e media);
  - processi: un registratore PowerShell che interroga `Get-CimInstance Win32_Process` ogni 500 ms e annota i PID figli nuovi della sessione di banco con la riga di comando. I processi più brevi di 500 ms possono sfuggire: la tabella lo dichiara, e lo stesso limite vale per le due versioni, quindi il confronto resta omogeneo.
  - I **byte letti** dall'helper non si confrontano con la 2.1.0 (non ha contatori): si riportano solo per la versione nuova, dai contatori D6, dichiarati come tali.
- **Classificazione (Media) — accolto.** I processi del registratore si classificano per **riga di comando**, non per "helper sì/no":
  - raccolta: helper con comando `stato`, letture dei fornitori, cache Codex;
  - orchestrazione: helper con `occupata`, `prenota`, `stato-cli`, `configura*`, `pesi-*`, più `gh`, Explorer, `codex`, avvii di sessione.
  - In F5 il contatore D6 si divide per comando (mappa `comando → numero`, al più ~20 chiavi, con la stessa finestra a minuti), così la diagnostica della versione nuova usa le stesse classi.

## Correzioni del giro 3

- **Classificazione completa — accolto.** Raccolta: `stato`, letture fornitori, cache Codex, `git-log`, `leggi-piano`, `board-*` di sola lettura e generazione. Orchestrazione: `occupata`, `prenota`, `stato-cli`, `cas`, `configura*`, `pesi-*`, `gh`, Explorer, `codex`, avvii di sessione. Ogni comando non elencato finisce in **«non classificati»**, che compare sempre in tabella (anche a zero). La stessa mappa vale per il registratore esterno e per D6.
- **Comparabilità — accolto.** I conteggi del registratore si riportano come **«processi osservati (limite inferiore)»**; la tabella non ne deduce riduzioni certe del totale. Le conclusioni su risorse si basano sulla memoria (picco e media) e, per la versione nuova, sui contatori D6 che contano ogni avvio.

## F5.6 — Interventi dalla verifica di risorse e token (rapporto `docs/VERIFICA-RISORSE.md`, ramo `claude/verifica-risorse-299dcb` @ efeef67)

Entrano in F5, ciascuno con un test che fallisce prima e passa dopo:

- **R1 board:** `git-log` al più ogni 5 minuti o subito se cambiano `registro.json` o le azioni; i `git` figli contati nel consumo (classe raccolta).
- **R4 scrivi-se-cambia:** un solo helper che confronta prima dell'`update` (stesso schema di `leggiLingua`), applicato ai punti elencati nel rapporto; `consumo` confrontato senza `da`; `giroVero` riusa le azioni lette dal battito.
- **R5 capacità in cache:** `$.tool.list()` e `get_session self` al più ogni 60 s (10 minuti per la capacità desktop/cli, subito se `ignoto`); prima di un avvio o di una decisione si rilegge come oggi.
- **R7 board indipendente dalla sessione:** impronta senza `chi`; «aspetta te» diventa «aspetta il committente», senza `io`.
- **R9 `stato-cli` via `$.fs.read`** del file di esecuzione, percorso costruito dal tentativo già validato.
- **R10 cadenza:** il giro veloce solo per `accodata`, `in-avvio`, `avviata`; `consegnata` a 60 s. Test che nessuna transizione automatica parta da `proposta`.
- **R11 istantanea `sessioni.json`** con età ≤ 20 s letta con `$.fs`, altrimenti helper.
- **R3 Risparmio:** i pesi d'effort non penalizzano un effort imposto dalla corsia Codex; test con la matrice profilo×corsia del rapporto.
- **R6 archivio:** l'helper sposta sotto mutex in `azioni/archivio/` le `completata`/`scartata` più vecchie di 30 giorni; `valida` e `dipende` trattano un archiviato come completato; `aggiorna` dopo un conflitto rilegge solo il proprio file. Test su archivio, dipendenze e conflitto.
- **R16:** via `MODELLI` non usato.
- **R2 modello per corsia:** solo se il committente lo approva (vedi decisione); il modello esplicito resta intoccabile e `violazioniAvvio` resta la guardia.

Fuori da F5, con issue nel repo della mod: **R8** (GraphQL non provata contro l'API), **R12** (solo con chiavi), **R14** (`import()` dinamico non verificato), **R15** (cambio porte solo a versione maggiore). **R13** resta com'è (scelta motivata in D5).

La misura D7 di F5.3 si fa **dopo** questi interventi.

### Decisione R2 (committente, 6 novembre 2026): «Sì, più economico»

Quando una chip non indica il modello, nelle corsie **R0–R1**, a parità di punteggio vince il modello di **rango più basso** fra quelli ammessi (`RANGO`, `logica.ts`), con tutti i profili. Con Risparmio e Velocità la stessa regola vale su tutte le corsie. Sulle corsie R2–R5 con Automatico e Qualità non cambia niente. Il modello indicato esplicitamente non si tocca mai; `violazioniAvvio` resta la guardia; R4 e R5 restano a Claude come oggi. Supera la regola 2.6.0 «i profili non toccano i modelli», limitatamente a questo spareggio. Test: la matrice profilo×corsia del rapporto, prima e dopo.

### Correzioni del giro 1 su F5.6 (prevalgono sulla lista F5.6)

1–2. **R6 esce da F5 — accolto, con ripiego.** La crescita è lenta e l'archivio tocca unicità dei task, dipendenze scartate, `prenota` e `decidi`: troppo rischio per la release. Diventa una issue del repo della mod con i requisiti del revisore (stato originale conservato, solo le completate soddisfano le dipendenze, archivio assente/corrotto blocca, metadati minimi nella verifica atomica di `prenota`, stesso mutex della cartella azioni, compatibilità con versioni vecchie e rollback, fuori dal percorso di Avvia). In F5 resta solo la parte innocua: dopo un conflitto `aggiorna` rilegge il proprio file; `decidi` continua a rileggere tutto.
3. **R9 — accolto.** Prima di `$.fs.read` si verifica `/^az-[a-z0-9]{6,20}$/` sul tentativo, oltre a id, stato e gestione degli errori di oggi. Test con `../../outside`: rifiutato, nessuna lettura.
4. **R7 — accolto.** Tutti i blocchi della board diventano indipendenti dal chiamante: `violazioniAvvio` nella board si calcola senza `d.chi` (contro le regole di progetto, non contro il modello di chi genera) oppure si toglie dalla scheda. Test: stessi dati, generatore Opus e Haiku → HTML e impronta identici.
5. **R3 — accolto.** Con Risparmio, a parità di punteggio vince Codex quando è ammesso (spareggio esplicito, non l'ordine di visita). L'effort di corsia resta un **minimo**: si neutralizza la penalità d'effort solo per il valore esattamente imposto dalla corsia Codex, non per effort superiori né per i pesi personalizzati. Modelli e opzioni esplicite non cambiano. Test sulla matrice.
6. **R11 — accolto.** `sessioni.json` versionato (`v: 1`), scritto in modo atomico (file temporaneo + rename), valido se `0 ≤ età ≤ 20 s`; validazione e filtro per progetto invariati; su qualunque errore si avvia l'helper come oggi. I contatori del produttore non si attribuiscono a chi legge. Non si promette un solo processo: alla scadenza più sessioni possono avviarlo.
7. **R5 — accolto.** La rilettura forzata vale anche prima del filtro delle code (`register.tsx:995`), così un avvio non aspetta la finestra di cache.
8. **R1 — accolto.** Si contano gli avvii effettivi di `git` (3–5 per chiamata), non una costante.
9. **R2 — precisato.** `RANGO` vale solo fra candidati Claude; un candidato Codex non entra nello spareggio per rango e la sua scelta resta quella di oggi (salvo lo spareggio di Risparmio al punto 5). R15 resta rinviato e la issue dirà che serve una migrazione coordinata del mutex, non solo una versione maggiore.
