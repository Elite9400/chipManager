# Piano — chipManager F4: pesi che si adattano, proposte della master, token (v1)

Stato: **bozza della master**, da far rivedere a Codex astra.
Base: `main` @ `1b6becf`, che contiene già 2.3.1–2.6.0 (versioni interne). Tutto confluisce nella release pubblica
**2.2.0**: in questa fase **nessun numero di versione nuovo**.

## 0. Richiesta del committente (punto 4 della richiesta originale)

«I pesi devono avere delle impostazioni predefinite; di default dev'essere più semplice impostarli e si devono
adattare in base al progetto. La sessione master o la sessione principale deve poterli impostare al meglio, anche in
base ai token.»

Decisione già presa con il committente: **la master propone, il committente conferma in un popup**.

## 1. Cosa c'è già

- **Profili fissi** in `hooks/bilanciamento.ts`: Automatico (nessun peso), Risparmio, Qualità, Velocità,
  Personalizzato. Ci sono le regolazioni a cinque posizioni.
- **`punteggio` (`logica.ts:247`)** già si adatta in parte:
  - moltiplica il peso per il margine libero del fornitore (misure fresche);
  - porta il margine quasi a zero oltre la soglia critica;
  - divide per `1 + sessioni attive` dello stesso motore e modello.
- **`bilancia` (`logica.ts:264`)** sceglie solo alla creazione di una proposta, fra le combinazioni che superano
  `violazioniAvvio`.
- **`risorse_agenti`** (strumento differito) restituisce limiti, pesi, fornitori, modelli ed effort. Non restituisce:
  sessioni al lavoro, token di contesto, profilo attivo, soglie.

## 2. Interventi

### F4.1 — Automatico che si adatta davvero (funzione pura)

Nuova funzione `pesiEffettivi(r: Regole, limiti, sessioni, azione)` in `bilanciamento.ts`. Restituisce i
moltiplicatori che `punteggio` applica **sopra** i pesi salvati, solo con il profilo Automatico. Gli altri profili
restano fissi, come scelto dalla persona.

1. **Avvicinamento alla soglia**, lineare. Fra `attenzione` e `critica` del fornitore il moltiplicatore scende da 1
   a 0,3. Oggi sotto la critica non c'è nessuna attenuazione, oltre la critica sì (resta il comportamento attuale).
2. **Corsia leggera, effort basso.** Per le azioni in corsia R0–R1, gli effort `high` e `xhigh` valgono ×0,5 e
   `low`/`medium` ×1. Per R4 e R5 non cambia nulla: lì decide la persona.
3. **Token di contesto.** Un modello le cui sessioni al lavoro hanno in media più del 70% della finestra di
   contesto usata vale ×0,7. Segnala sessioni lunghe e costose: meglio aprirne altrove. Fonte: le sessioni del
   progetto (`sessioni` atomo, campo `contesto`).
4. **Nessun dato fresco = nessun aggiustamento.** Ogni regola si applica solo con misure fresche (`limiteFresco`) o
   sessioni lette meno di 2 minuti fa. Un numero vecchio non decide.

Ogni moltiplicatore è una costante unica in `bilanciamento.ts`, con test.

La **simulazione** delle Impostazioni (C2) mostra anche la spiegazione, per esempio «Automatico: Codex preferito
perché Claude settimanale è al 78% (attenzione da 70)». La spiegazione è restituita dalla stessa funzione.

### F4.2 — `proponi_pesi`: la master propone, la persona conferma

Nuovo strumento MCP `proponi_pesi`, `isDeferred: true`. Argomenti:

- `profilo` facoltativo, uno dei cinque;
- `regolazioni` facoltativo: un elenco di `{ tipo, nome, posizione: 0–4 }`, solo voci ammesse dalle regole;
- `motivo`, obbligatorio, fino a 300 caratteri.

Almeno uno fra `profilo` e `regolazioni`. Validazione al confine: valori noti, voci esistenti in `routing.json`,
niente pesi grezzi.

**Flusso.**

1. La proposta si salva in `<cartella dati>/proposta-pesi.json`, scritta in CAS con l'helper. Contiene: id,
   proponente (id e titolo della sessione, presi da `$.session.id()`, mai dagli argomenti), istante, motivo, profilo
   o regolazioni, e il **risultato atteso** (i pesi finali calcolati).
   - Una proposta nuova sostituisce la precedente non ancora decisa, e lo dice.
2. Il pannello di ogni sessione del progetto, al giro, vede la proposta. **Uno solo** apre il popup `$.ui.ask`:
   - è quello di questa sessione, se il pannello è a schermo;
   - la scelta passa da un gettone `presentata` in CAS nel file, così due pannelli non chiedono due volte.

   Il testo del popup: «La sessione «X» propone: profilo Risparmio · Codex Più · effort xhigh Meno. Motivo: … Applico?».
   Scelte: **Applica**, **Rifiuta**, **Rivedi nelle impostazioni**.
3. **Applica.** Una sola chiamata `configura` con `profilo` e `pesi`, CAS sul config, poi la proposta passa a
   `applicata` con l'istante.
   - Si conserva la configurazione precedente per **Annulla**.
4. **Rifiuta.** La proposta passa a `rifiutata`.
5. **Rivedi nelle impostazioni.** Apre la sezione Bilanciamento con la proposta in evidenza e i pulsanti «Applica»
   e «Rifiuta».
6. **`ask` rifiutato** (popup chiuso, `-p`, nessun pannello a schermo). La proposta resta `in attesa` e si vede:
   - nella vista Lavoro, sotto la sintesi, con una riga «1 proposta di pesi da decidere · Rivedi»;
   - in Impostazioni → Bilanciamento.
7. **Scadenza.** Una proposta in attesa scade dopo 24 ore e lo dice.
8. **Senza conferma non cambia nulla.** Il risultato dello strumento dice «Proposta registrata: la decide il
   committente» e non attende la decisione.

**Registro.** Nella vista Carico, sotto «Pesi in uso», l'ultima decisione: «Applicata il 6 nov 18:02, proposta da
«Master»: Risparmio · Annulla». L'annullamento è possibile finché la configurazione non è cambiata nel frattempo
(CAS).

**Guardie.**

- Lo strumento non può cambiare `fornitori`, `soloLocale`, soglie, budget né corsie: solo profilo e pesi.
- I pesi restano preferenze, mai autorizzazioni. `violazioniAvvio` non cambia.

### F4.3 — `risorse_agenti` con i dati per decidere

Il risultato aggiunge, in forma compatta (un JSON breve, senza ripetere quello che c'è già):

- `profilo` attivo e `soglie` per fornitore;
- `alLavoro`: per modello ed effort, quante sessioni del progetto sono al lavoro e quante in coda;
- `contesto`: per modello, la media e il massimo della percentuale di finestra usata dalle sessioni al lavoro,
  con l'istante della lettura;
- `consumo` della mod in questa sessione (i contatori D6);
- `proposta`: lo stato dell'ultima proposta di pesi (in attesa / applicata / rifiutata e quando).

La descrizione resta corta e si misura in caratteri: il test della D5 con il tetto vale ancora. Lo strumento resta
differito.

### F4.4 — Status line di Claude da terminale: scrittura con conferma

Oggi la mod si limita a mostrare il comando. Il nuovo flusso, in Impostazioni → Connessioni → Claude → «Collega…»,
quando la sessione è da terminale:

1. Si legge `~/.claude/settings.json`.
2. **Nessuna `statusLine`.** Popup «Aggiungo la status line di chipManager? Comando: … Il file viene salvato con una
   copia `.bak`». Su **Aggiungi**: CAS del file (rilettura e confronto prima della scrittura), copia di sicurezza,
   aggiunta del solo campo `statusLine` con il comando della mod; tutto il resto resta invariato.
3. **`statusLine` già presente.** Nessuna scrittura. Si mostrano le istruzioni per aggiungere la chiamata alla mod
   nello script esistente, come oggi.
4. **File illeggibile o non valido.** Nessuna scrittura, con il motivo.

Test con un file d'esempio, in ogni caso. Il file reale dell'utente non si tocca nei test.

## 3. Test

**`pesiEffettivi`:**

- fra le soglie;
- corsia leggera;
- contesto oltre il 70%;
- dati vecchi senza effetto;
- profili non automatici invariati.

**`proponi_pesi`:**

- validazione;
- proponente preso dalla sessione e non dagli argomenti;
- due pannelli: un solo popup;
- Applica, Rifiuta, Rivedi;
- `ask` rifiutato: riga in Lavoro e in Impostazioni;
- scadenza;
- Annulla con CAS;
- tentativo di cambiare `fornitori` o soglie: rifiutato.

**`risorse_agenti`:** campi nuovi presenti e compatti, tetto di caratteri della descrizione.

**Status line:** assente → aggiunta con `.bak`; presente → nessuna scrittura; file non valido → nessuna scrittura;
CAS con modifica concorrente.

**Verifiche standard,** una alla volta: validate, plugin test, prova-disco, tsc.

## 4. Fuori da questa fase

- **Rifinitura grafica e documentazione (F5):**
  - verifica nell'app reale;
  - critique e audit di impeccable sulle catture;
  - legenda dei segni;
  - immagini e GIF del README con dati d'esempio;
  - misure reali con 4 sessioni.
- **Release 2.2.0:** CHANGELOG unico, versione, tag, GitHub. Solo con il sì del committente.

## 5. Rischi

- **Popup e pannelli multipli.** La scelta di chi presenta il popup passa dal file in CAS; se il pannello che l'ha
  presentato si chiude senza risposta, dopo 2 minuti un altro pannello può ripresentarla.
- **Moltiplicatori arbitrari.** Sono costanti dichiarate e semplici, e si tarano con l'uso. La simulazione mostra
  sempre il perché.
- **`settings.json` dell'utente.** Si scrive solo un campo, solo se assente, con conferma, copia e CAS.

## 6. Versione 2 — dopo il giro 1 di astra (prevale sulle sezioni 2–5)

Indicazione accolta: **più semplice**. Niente popup automatici, niente moltiplicatori senza una relazione
verificabile con il costo, niente scritture in `settings.json` in questa fase.

| # | Rilievo | Decisione |
|---|---|---|
| 1 | Il CAS è incompleto fra proposta e configurazione; mutex diversi. | **Accolto.** Un'unica autorità: l'helper, sotto **il mutex di `configura`**. Comandi nuovi: `pesi-proponi`, `pesi-decidi`, `pesi-annulla`. Ognuno lavora in una sola sezione critica nello stesso processo. Per i dettagli vedi F4.2 v2. |
| 2 | Il timeout non garantisce un popup solo; `ask` dentro il giro lo blocca. | **Accolto, con l'alternativa semplice di astra.** Nessun popup aperto dal giro. La proposta compare come **riga in attesa** nella vista Lavoro e in Impostazioni → Bilanciamento. Il popup `$.ui.ask` si apre **solo** quando la persona preme «Rivedi», dentro il gestore del pulsante. La risposta vale solo se la proposta ha ancora la stessa `versione`; altrimenti viene rifiutata, con il messaggio «la proposta è cambiata, rivedi». |
| 3 | Identità della sessione ≠ ruolo di master; applicazione troppo ampia. | **Accolto.** Può proporre **qualsiasi sessione del progetto**: decide comunque la persona. Si mostrano id e titolo della sessione, come «proposta da «titolo» (id breve)», senza attribuire autorità al nome. Una proposta nuova con un'altra ancora in attesa **non sostituisce in silenzio**: le due restano visibili, ognuna con la sua versione, fino a un massimo di 3 in attesa (oltre, la più vecchia scade e lo dice). Il percorso di applicazione costruisce **solo** `{ profilo, pesi }` validati: il comando dell'helper rifiuta ogni altro campo. |
| 4 | Freschezza solo apparente dei token. | **Accolto.** Per ogni sessione si tiene l'istante dell'**ultima misura riuscita** del contesto, distinto dall'istante della lettura. I dati ignoti o più vecchi di 5 minuti si escludono dalla media, e `risorse_agenti` dichiara la copertura (per esempio «3 sessioni su 4 misurate»). Test: fallimenti ripetuti dopo una misura valida. |
| 5 | L'attenuazione sotto la critica c'è già; il contesto non dice nulla sul costo di una sessione nuova. | **Accolto.** Escono la regola 1 (attenuazione: c'è già in `punteggio`) e la regola 3 (contesto come penalità). Il contesto resta **informazione** per la master in `risorse_agenti` e nella spiegazione. L'adattamento **automatico** al progetto resta uno solo, concreto e verificabile: **la corsia**. Per le azioni R0–R1, `high` vale ×0,6 e `xhigh` ×0,4. R2–R3 non cambiano; su R4–R5 decide la persona. Esempio: una chip di documentazione in R1, senza effort indicato, va a `medium` invece che a `high`. «In base ai token» passa dalla master: legge contesto e limiti in `risorse_agenti` e propone pesi motivati, che la persona conferma. |
| 6 | Integrazione: il massivo usa `punteggio`; ci sarebbe un ciclo d'import; non è definita la precedenza. | **Accolto.** Il moltiplicatore di corsia sta in `logica.ts`, dentro `punteggio`: niente ciclo d'import. Vale solo con il profilo Automatico (`profilo` assente o `automatico`), letto da `risorse`. **Precedenza:** pesi salvati (comprese le regolazioni dei modelli) × moltiplicatore di corsia × margine dei limiti ÷ carico. Scelta e simulazione ricevono lo stesso insieme di dati. Test sull'ordine del massivo con corsie diverse. |
| 7 | Scrittura di `settings.json` troppo ottimistica. | **Accolto: F4.4 esce dalla fase.** Restano le istruzioni di oggi, che mostrano il comando senza scriverlo. Si ripianifica a parte, se servirà. |
| 8 | `risorse_agenti` duplica dati; nessun tetto sulla risposta; test scarsi. | **Accolto.** Profilo e soglie sono già in `politica`: non si duplicano. Si aggiungono solo `alLavoro` (per modello ed effort), `contesto` (media, massimo, copertura, istante dell'ultima misura riuscita) e `proposte` (stato delle ultime 3). **Tetto verificato:** risposta sotto i 4.000 caratteri con un caso d'esempio grande (20 sessioni, 50 chip); oltre, si tronca con una nota. Test di concorrenza in `prova-disco` (vedi sotto). |

### F4.2 v2 — Proposte di pesi

**Record**

Il file è `<cartella dati>/proposte-pesi.json`, sotto il mutex di `configura`. Contiene `{ versione, voci: [...] }`.
Ogni voce ha questi campi:

| Campo | Contenuto |
|---|---|
| `id` | identificativo della proposta |
| `versione` | intero, si incrementa a ogni cambio della voce |
| `progetto` | il `repo` |
| `proponente` | `{ id, titolo }`, presi dalla sessione |
| `quando` | istante della proposta |
| `motivo` | il motivo dato dal proponente |
| `profilo?` | il profilo proposto, se c'è |
| `regolazioni?` | le regolazioni proposte, se ci sono |
| `partenza` | `{ profilo, pesi }` letti dal config al momento della proposta |
| `risultato` | `{ profilo, pesi }` calcolati |
| `stato` | `attesa`, `applicata`, `rifiutata` o `scaduta` |
| `applicazione?` | `{ id, quando }`, presente dopo l'applicazione |

**`pesi-decidi <id> <versione> applica|rifiuta`**

Tutto avviene in una sezione critica:

1. Rilegge il file e il config.
2. Rifiuta se la versione è cambiata o la voce non è in `attesa`.
3. Con **applica**:
   - se il `{ profilo, pesi }` attuale del progetto è diverso da `partenza`, rifiuta («la configurazione è cambiata
     dalla proposta: rivedi»);
   - altrimenti scrive nel config **solo** `profilo` e `pesi` del progetto e segna la voce `applicata` con
     `applicazione.id`.
4. È **idempotente**: se trova la voce già `applicata` con lo stesso id di decisione, risponde ok senza riscrivere.
5. Recupero dopo un arresto: config e proposte si scrivono in quell'ordine, ognuno in modo atomico. Al riavvio, una
   voce ancora `attesa` il cui `risultato` coincide già con il config viene segnata `applicata`.

**`pesi-annulla <id>`**

- Ripristina `partenza` solo se il config del progetto è ancora uguale al `risultato` di quella applicazione.
  Altrimenti rifiuta («la configurazione è cambiata dopo l'applicazione»).

**Scadenza**

- Le voci in `attesa` scadono dopo 24 ore.
- Si tengono al massimo 10 voci in totale; le più vecchie decise escono.

**Strumento `proponi_pesi`** (`isDeferred: true`)

- Valida gli argomenti, calcola `risultato`, chiama `pesi-proponi`.
- Risponde «Proposta registrata (id …): la decide il committente».

**Interfaccia**

- **Riga in attesa nella vista Lavoro**, sotto la sintesi: «Proposta di pesi da «titolo»: Risparmio · Codex Più ·
  Rivedi».
- **«Rivedi»** apre il popup con il riepilogo `partenza → risultato` e il motivo. Le scelte:
  - Applica;
  - Rifiuta;
  - Apri le impostazioni.

  Se il popup viene rifiutato, i pulsanti «Applica» e «Rifiuta» restano sulla riga.
- **Registro nella vista Carico:** l'ultima decisione, con chi ha proposto, quando e **Annulla** se ancora possibile.

**Test in `prova-disco`, con l'helper vero**

- due processi che decidono la stessa voce: una sola applicazione;
- risposta tardiva su una versione vecchia: rifiutata;
- proposta nuova mentre un'altra è in revisione: entrambe visibili, decisioni indipendenti;
- arresto simulato fra la scrittura del config e quella delle proposte: recupero;
- annulla dopo una modifica manuale: rifiutato;
- un campo diverso da `profilo` o `pesi` nel comando: rifiutato.

### Prova reale

Alla fine della F4 la sessione di sviluppo carica la mod dal suo worktree con `--plugin-dir` in una sessione da
terminale e prova:

- `proponi_pesi`;
- la riga in attesa;
- «Rivedi» con il popup;
- `risorse_agenti` differito, trovato con ToolSearch.

Se non ci riesce, lo dichiara. La prova completa resta in F5.

## 7. Correzioni del giro 2 (prevalgono sulla sezione 6)

### Identità dell'applicazione, non uguaglianza dei valori (residuo 1, alta) — accolto

Nella sezione del progetto, nel config, ci sono due campi nuovi:

- `pesiRevisione`: un intero. **Ogni** scrittura di `profilo` o `pesi`, da qualsiasi percorso (Impostazioni,
  `configura`, `pesi-*`), lo incrementa nello stesso CAS. La whitelist di `configura` lo aggiorna da sola: non è
  un campo che si può scrivere da fuori.
- `pesiOrigine`: `{ tipo: 'proposta' | 'annullamento' | 'manuale', id? }`. Dice chi ha fatto l'ultima scrittura.

#### Applicazione

Nella stessa scrittura del config:

- `pesiRevisione` = R + 1;
- `pesiOrigine` = `{ tipo: 'proposta', id: decisione.id }`.

Poi, nel file delle proposte, la voce diventa `applicata` con `{ decisione.id, revisione: R + 1 }`.

#### Recupero dopo un arresto

Una voce ancora `attesa` diventa `applicata` **solo se** `pesiOrigine.id` nel config è uguale a quel
`decisione.id`. L'uguaglianza dei valori non conta più. Una modifica manuale che arriva per caso allo stesso
risultato non attribuisce nessuna conferma.

#### Annulla

È possibile solo se nel config:

- `pesiRevisione` è uguale alla revisione registrata dall'applicazione;
- `pesiOrigine.id` è uguale alla decisione.

Una sequenza `risultato → altro → risultato` ha una revisione diversa, quindi viene rifiutata.

L'annullamento scrive nel config:

- `partenza`;
- revisione + 1;
- `pesiOrigine` = `{ tipo: 'annullamento', id: annullamento.id }`.

Poi segna la voce come `annullata`. Il recupero di un annullamento interrotto è simmetrico: si guarda
`pesiOrigine.id`.

#### Compatibilità

Un config senza questi campi vale revisione 0 e origine `manuale`.

### Idempotenza definita (residuo 1, media) — accolto

La **chiave della decisione** (`decisione.id`) la genera il pannello quando la persona preme Applica o Rifiuta.
Passa a `pesi-decidi <id voce> <versione> <applica|rifiuta> <decisione.id>`.

Il **primo** controllo dell'helper è questo: se la voce porta già una decisione con lo stesso id, risponde ok con
l'esito registrato. Solo dopo vengono i controlli su stato e versione.

Test:

- la risposta va persa e si ritenta: un'applicazione sola;
- un'altra chiave sulla stessa versione già decisa: rifiutata.

### Una sola risoluzione del profilo (nuovo, media) — accolto

`profiloDi` si sposta in `logica.ts` e resta l'unica fonte: `profilo` salvato, altrimenti Personalizzato se ci sono
pesi, Automatico se non ce ne sono. `bilanciamento.ts` lo riesporta. Così non ci sono cicli di import.

Il moltiplicatore di corsia vale **solo se `profiloDi(...)` è `automatico`**. Un config precedente, senza
`profilo` ma con pesi, resta Personalizzato e non riceve penalità nuove.

Test con quel config.

## 8. Correzione del giro 3 (recupero dopo un arresto)

Accolta la correzione di astra: il collegamento fra operazione e proposta entra nel config **nella stessa
scrittura** che cambia i pesi.

- Il config tiene `pesiOrigine = { tipo, id, voce, versione }`:
  - `tipo` è `'proposta'` oppure `'annullamento'`;
  - `voce` è l'id della proposta;
  - `versione` è la versione della voce nel momento della decisione.
- **Recupero.** All'inizio di ogni comando `pesi-*` e di ogni `configura` che tocca `profilo` o `pesi`, sotto lo
  stesso mutex e prima di qualsiasi altra scrittura, l'helper legge `pesiOrigine`. Se la voce indicata non riporta
  ancora quell'operazione, la completa: `applicata` o `annullata`, con `decisione.id` e revisione presi dal config.
  Solo dopo esegue il comando. Così un `pesiOrigine` non può essere sovrascritto prima che il suo esito sia
  registrato.
- Il recupero non deduce mai nulla dai valori dei pesi. Due proposte con lo stesso risultato restano distinte.
- **Test:**
  - arresto dopo la scrittura del config per un'applicazione;
  - arresto dopo la scrittura del config per un annullamento;
  - in entrambi i casi, una `configura` successiva che recupera prima di scrivere;
  - due proposte con lo stesso risultato: si recupera solo quella indicata in `pesiOrigine`.
