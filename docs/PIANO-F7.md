# F7 — Sessioni ↔ mod, auditor, «Chi lavora» (dentro la 2.2.0)

Richiesta del committente, 6 novembre 2026:
1. Le sessioni di lavoro, su indicazione dell'utente, devono poter impostare al meglio la mod, e la mod le sessioni.
2. Si deve poter usare la funzione auditor di Claude: un modello X lavora con Fable, Opus o un altro come auditor.
3. La parte «Chi lavora» va migliorata nell'interfaccia.

Si parte da `main` dopo F6, perché i file sono gli stessi.

## 0. Fatti accertati (documentazione ufficiale, 6 novembre 2026)

- **Advisor.** In Claude Code la funzione si chiama **advisor** (sperimentale, `code.claude.com/docs/en/advisor`).
  - **Come lavora.** Il modello che esegue consulta un modello più forte quando lo ritiene utile. L'advisor riceve tutta la conversazione e gira sul server.
  - **Come si attiva.** In tre modi:
    - `/advisor <fable|opus|sonnet|id>` dentro la sessione: viene salvato nelle impostazioni utente come `advisorModel`;
    - la chiave `advisorModel` nelle impostazioni;
    - il flag `claude --advisor <modello>`, che vale per una sola sessione e funziona anche con `-p`.
  - **Come si spegne.** Con `CLAUDE_CODE_DISABLE_ADVISOR_TOOL=1`.
  - **Abbinamenti.** L'advisor deve essere di rango pari o superiore al modello che esegue, secondo la tabella della documentazione. Per esempio Opus 5/5.5 accetta Fable o Opus 5+, e Sonnet 5.5 accetta Fable, Opus 5+ o Sonnet 5.5. Se l'abbinamento non è valido, Claude Code **ignora l'advisor senza avvisare**.
  - **Costi.** Con l'abbonamento l'uso conta nei limiti del piano. Fable come advisor, dove previsto, è fatturato ai crediti di utilizzo. Con l'API si pagano le tariffe dell'advisor.
  - **Dove non c'è.** Non è disponibile su Bedrock, Vertex e Foundry. I subagenti ereditano l'advisor.
- **Mod.**
  - Non esiste un metodo documentato per **scrivere** modello, effort, permessi o advisor di una sessione.
  - In lettura ci sono `$.session.model` e `$.settings.read`.
  - `turn.step` può cambiare il modello o l'effort di **una** richiesta.
  - `$.config.set` cambia le righe di `/config`, ma quali chiavi accetti non è documentato.
- **Desktop.** L'app espone gli strumenti `ccd_session_mgmt` `set_session_model`, `set_session_effort` e `set_session_permission_mode`. La sessione master li ha nel suo elenco differito. Se una mod li possa chiamare con `$.mcp.call` va **verificato a runtime**, come già si fa per `start_session`. `start_session` non ha un parametro per l'advisor.

## F7.1 — Dalle sessioni alla mod: proposte di impostazioni

- **Strumento `proponi_impostazioni`.** È differito, come `proponi_pesi`, e ha descrizione e risposte in inglese. Una sessione di lavoro lo usa **solo su indicazione esplicita dell'utente**, e la descrizione lo dice.
  - **Cosa riceve.** Un insieme di campi della **stessa whitelist della bozza di F5.9**: profilo, soglie, budget in percentuale o in USD, fornitori ammessi, board, consigliere, tetto per tentativo, lingua.
  - **Cosa non accetta mai:** chiavi e segreti, guardie (corsie R4/R5, sensibili, cloud), permessi, destinazioni non ammesse, campi sconosciuti. Ognuno viene rifiutato con il motivo.
- **Proposta.** Si riusa il meccanismo delle proposte di pesi di F4:
  - file delle proposte sotto mutex, versione, chiave di decisione idempotente;
  - scadenza a 24 ore, al massimo 3 in attesa;
  - `pesiRevisione` generalizzato in `impostazioniRevisione`, con origine `proposta`.

  Nel pannello compare una riga «Una sessione propone N impostazioni · Rivedi». Il popup mostra prima e dopo per ogni campo e offre **Applica**, **Rifiuta** e, dopo l'applicazione, **Annulla**, alle stesse condizioni di F4: revisione e origine invariate.
- **Mai automatico.** Nessuna impostazione proposta si applica senza il clic dell'utente.
- **Lettura.** `risorse_agenti` aggiunge un riassunto delle impostazioni correnti in inglese, dentro il tetto, senza segreti, così l'agente propone a partire dai valori reali.

## F7.2 — Dalla mod alle sessioni: modello, effort, permessi

- **Desktop.** In «Chi lavora», nella vista Lavoro, ogni sessione **avviata dalla mod e ancora al lavoro** ha l'azione «Cambia» per modello, effort e permessi.
  - **Come.** Passa da `$.mcp.call('ccd_session_mgmt', 'set_session_model' | 'set_session_effort' | 'set_session_permission_mode')`, solo se lo strumento risulta disponibile.
  - **Conferma.** Ogni cambio ha un popup di conferma.
  - **Limiti.** Si applicano le stesse guardie dell'avvio: una sessione sensibile non scende sotto i minimi di corsia; i permessi non diventano mai `bypassPermissions` né `auto` su corsie sensibili. L'host può comunque chiedere approvazione per conto suo.
  - **Registro.** L'esito si annota nel record della chip.
- **CLI, o strumenti assenti.** L'azione non compare.
- **Nessuna scrittura** di file di impostazioni dell'utente: è la regola di F6.

## F7.3 — Auditor (advisor) per chip

- **Campo nuovo `auditor`** nella chip: `nessuno` | `sonnet` | `opus` | `fable` | id completo.
  - È validato con una **tabella degli abbinamenti** presa dalla documentazione. Gli abbinamenti non validi non si possono scegliere e il motivo si vede, perché Claude Code li ignorerebbe in silenzio.
  - La tabella sta in un solo punto (`logica.ts`), con la data della fonte.
- **Come si applica, per modalità di avvio:**
  - **`api-claude` di F6:** con `--advisor <modello>` sulla riga di comando di `claude -p`. Funziona sempre.
  - **Desktop e CLI interattiva:** nessun meccanismo per sessione documentato.
    - La mod **non** scrive `advisorModel` nelle impostazioni dell'utente, perché varrebbe per tutte le sessioni.
    - Il mandato dice all'utente, e non all'agente, che serve `/advisor <modello>` all'inizio della sessione.
    - La chip mostra «auditor: da attivare con /advisor opus», con il pulsante «Copia».
    - Se a runtime `$.config.list()` espone una riga advisor che si può impostare **per sessione**, la mod la usa. Altrimenti resta l'istruzione.
- **Bilanciamento e pesi.**
  - **Suggerimento.** Il profilo può suggerire un auditor nelle corsie alte (R3 e oltre) quando il modello che esegue è di rango più basso, per esempio Sonnet con Opus come auditor.
  - **Scelte esplicite.** Il suggerimento non tocca mai una scelta esplicita.
  - **Costo.** Si dichiara: Fable passa ai crediti di utilizzo, dove previsto.
  - **Opzione.** «Suggerisci auditor» nelle Impostazioni, spenta di default.
- **Visibilità.** L'auditor compare in «Chi lavora», nella riga della chip e in `risorse_agenti`.

## F7.4 — «Chi lavora» riprogettato

- **Riga riassuntiva in stile developer** in cima all'editor, sempre visibile:
  `Claude · opus-5.5 · xhigh · auditor fable · rev Codex · R3`
  - **Accanto:** il motivo della scelta automatica, preso da `bilancia`, per esempio «auto: R3 · piano 42% used».
  - **Se cambi qualcosa a mano:** un segno «modificato», con «Ripristina consigliato».
- **Preset rapidi.** Chip di scelta di F5.8: **Consigliato** (scelta di `bilancia`), **Economico**, **Qualità**. Calcolano esecutore, modello, effort e auditor secondo le regole di F4, R2 e F7.3, e mostrano l'anteprima nella riga riassuntiva prima di essere applicati.
- **Dettagli.** Sotto «Dettagli», chiuso per default, ci sono esecutore, modello, effort, auditor, revisore e corsia.
  - Le opzioni non ammesse non si possono scegliere e il motivo si vede.
  - L'effort è mostrato con le barre a blocchi.
  - La corsia si vede con la sua legenda.
- **Sessioni al lavoro.** Lo stesso blocco, in sola lettura, nella riga della sessione avviata, più «Cambia» di F7.2 dove disponibile.
- **Salvataggio.** Le modifiche della chip seguono il CAS e la decadenza delle conferme di oggi.
- **Resa.** Sei lingue, 60 colonne, desktop e terminale.

## Test e verifiche

- **F7.1:**
  - campi vietati rifiutati, con il motivo;
  - Applica, Rifiuta e Annulla idempotenti;
  - la revisione impedisce di annullare dopo modifiche intermedie;
  - nessuna applicazione senza clic;
  - nessun segreto in `risorse_agenti`.
- **F7.2:**
  - strumenti assenti: l'azione non compare;
  - un cambio non ammesso su una sensibile viene rifiutato;
  - con conferma rifiutata non si chiama niente.
- **F7.3:**
  - la tabella degli abbinamenti, con ogni coppia della documentazione;
  - `--advisor` presente solo per `api-claude`;
  - nessuna scrittura di `advisorModel`;
  - un abbinamento non valido non si può scegliere.
- **F7.4:**
  - preset deterministici;
  - anteprima prima di applicare;
  - «modificato» e «Ripristina»;
  - 60 colonne nelle sei lingue.
- **Verifiche:** una alla volta (tsc, plugin test, prova-disco, validate).
- **Collaudo reale:**
  - un auditor via `api-claude`;
  - `/advisor` in una sessione desktop;
  - «Cambia» modello su una sessione desktop.

## Fuori da F7

- Nessuna scrittura delle impostazioni dell'utente per l'advisor.
- Nessun avvio automatico di `/advisor` da parte dell'agente: i comandi slash li digita l'utente.

## Correzioni del giro 1 (prevalgono su tutto quanto sopra)

1. **`config.list()` senza scope — accolto.** Il ripiego di F7.3 basato su `$.config.list()` viene **eliminato**. In §0: le chiavi disponibili si possono interrogare, lo scope (sessione o utente) no.
2. **Advisor: richiesto, applicato, effettivo — accolto.**
   - **Tre stati distinti nella chip.**
     - **Richiesto:** il campo `auditor`.
     - **Applicato:** solo `api-claude`, con `--advisor` sulla riga di comando.
     - **Manuale:** desktop e CLI interattiva.
   - **Non si promette mai «effettivo».** L'advisor dipende anche dai flag di funzionalità e da `CLAUDE_CODE_DISABLE_ADVISOR_TOOL`, che la mod **non** toglie: è una scelta dell'utente. Se quella variabile è presente nell'ambiente o nelle impostazioni, lo stato diventa «disattivato dall'utente» e l'avvio prosegue senza advisor, dicendolo.
   - **Advisor ereditato.** Se le impostazioni dell'utente contengono `advisorModel` (letto con `$.settings.read`), la chip mostra «advisor ereditato: X». Omettere `--advisor` non significa «nessuno». Per `api-claude` con auditor `nessuno` la mod passa `--advisor off` solo se il flag lo accetta come documentato; altrimenti mostra l'advisor ereditato.
   - **Attivazione manuale.** Il testo dice in chiaro che `/advisor <modello>` **cambia il default dell'utente per tutte le sessioni**, tranne nei casi documentati come Remote Control e worker remoti. Consiglia `/advisor off` a fine lavoro. Nessun isolamento per chip promesso.
3. **Whitelist — accolto, con approccio semplificato.**
   - **La proposta è una bozza.** `proponi_impostazioni` **non** ha più un proprio meccanismo di applicazione: la proposta valida riempie la **bozza delle Impostazioni di F5.9**, con la fascia «Proposta da una sessione: rivedi e premi Apply, oppure Scarta».
   - **Si applica con Apply.** L'applicazione passa dall'Apply esistente, con le sue validazioni, il CAS, i conflitti, il congelamento e l'epoca. Si scarta con «Annulla modifiche».
   - **Se c'è già una bozza aperta,** la proposta non la tocca: resta in coda (al massimo 1) e la fascia lo dice.
   - **Schema esplicito e restrittivo**, anche nei campi annidati:
     - campi ammessi: `profilo`, `soglie.<fornitore>`, `board`, `consigliere`, `apiClaude.budgetUsd`, `apiClaude.tetto`, `lingua`;
     - **mai** `soloLocale`, `fornitori`, `freellmapi`, corsie, permessi, destinazioni o chiavi;
     - un campo sconosciuto o vietato, anche annidato, **rifiuta l'intera proposta** con il nome del campo, senza ripulirla, salvarla o riecheggiarne il valore;
     - l'helper la rivalida al momento della scrittura.
4. **Revisione generalizzata — non serve più.** Con il punto 3 la proposta di impostazioni usa la bozza e Apply, che hanno già conflitti, congelamento ed epoca. La revisione e l'annullamento di F4 restano **solo** per profilo e pesi, come oggi. Le proposte di pesi di F4 non cambiano.
5. **«Cambia» — accolto, con perimetro ristretto.**
   - **Bersagli.** Solo sessioni **desktop** avviate dalla mod con esecutore **Claude**, quindi né coordinatori Codex, né cloud, né `api-claude`, e solo per **modello ed effort**. Il cambio dei permessi esce da F7.
   - **Dopo la conferma** si rivalidano:
     - identità della sessione e tentativo;
     - regole di corsia, con il minimo di effort e i modelli ammessi;
     - configurazione corrente.
   - **Revisore.** Un cambio che modificherebbe il revisore obbligatorio, per esempio un passaggio a Fable che esige un altro revisore, viene **rifiutato**: il mandato già consegnato non si riscrive.
   - **Esito.** Dopo la chiamata si rilegge la sessione con `get_session`.
     - Successo verificato: si annota.
     - Errore o timeout: esito «incerto», annotato, con «Ricontrolla».
     - Nessun nuovo tentativo automatico.
   - **Conferma dell'utente.** L'host non chiede permessi per `mcp.call`: la conferma della mod è l'unica, ed è obbligatoria.
6. **Tabella dell'advisor — accolto.**
   - **Struttura.** È una tabella di **coppie** separata da `rangoModello`, con versione e data della fonte, e con la risoluzione degli alias documentata (`opus`, `sonnet`, `fable` → id correnti).
   - **ID sconosciuti.** Né esecutore né advisor si possono scegliere, con il motivo.
   - **Cambio dell'esecutore.** Si rivalida l'auditor; se non è più valido torna a «nessuno» e lo si dice.
   - **Preset Economico.** Usa lo spareggio R2 di `bilancia` e **non aggiunge mai** un advisor.
   - **Preset Qualità.** Può proporlo, con il costo dichiarato.
7. **60 colonne — accolto.**
   - **Vista stretta.** Il riepilogo va su più righe:
     1. esecutore · modello · effort;
     2. auditor · revisore · corsia;
     3. il motivo, attenuato.

     Le azioni restano sempre raggiungibili.
   - **Test.** Resa reale dell'albero a 60 colonne nelle sei lingue e con id lunghi, non solo larghezza minima.
8. **Test — accolto.**
   - **Proposte:**
     - proposta con campo vietato annidato rifiutata per intero;
     - proposta mentre una bozza è aperta;
     - Apply in conflitto;
     - lingua cambiata in un altro progetto durante la proposta;
     - impronta della board invariata dopo una proposta che non la riguarda.
   - **«Cambia»:**
     - conferma obsoleta (sessione finita o tentativo diverso);
     - errore MCP;
     - esito incerto con successo remoto.
   - **Advisor:** ereditato, disattivato dall'utente, alias e id ignoti.
   - **Scelte e preset:** scelte esplicite preservate dai preset; Economico senza advisor.
   - **`risorse_agenti`:** tetto rispettato con il riassunto delle impostazioni.

## Correzioni del giro 2 (prevalgono sulla correzione 2 del giro 1)

- **N1 — Valore della variabile — accolto.**
  - **Lettura.** `CLAUDE_CODE_DISABLE_ADVISOR_TOOL` si interpreta con la semantica booleana documentata:
    - solo un valore vero disattiva (`1`, `true` e gli equivalenti documentati);
    - `0`, `false` o l'assenza no.
  - **Fonti.** Si rispetta la precedenza documentata fra l'ambiente e il campo `env` delle impostazioni.
  - **Test.** `1`, `0`, `true`, `false`, assenza, e valori diversi fra le fonti.
- **N2 — Eredità nel contesto del figlio — accolto.**
  - **Per `api-claude`.** L'advisor ereditato e la disattivazione si verificano **dentro `eseguiApi`, sul worktree reale**, con le stesse fonti già rilette lì per §6/§7: utente, progetto, locale e gestite. Il risultato si scrive nel record dell'esecuzione: `ereditato: X`, oppure `nessuno`, oppure `disattivato`.
  - **Per il desktop e la CLI interattiva** la sessione destinataria non si può ispezionare prima dell'avvio, quindi la chip mostra **«eredità non verificata»**.
  - **Nessuna deduzione.** `$.settings.read()` della sessione che avvia non si usa per dedurre l'eredità di un'altra sessione.
  - **Test.** Padre e worktree con impostazioni diverse.
- **N3 — Advisor che impedisce l'avvio — accolto.**
  - **Niente promessa.** «Funziona sempre» si toglie.
  - **Stderr del figlio.** Il supervisore di F6 smette di scartarlo: lo cattura con un tetto di 16 KiB e lo **filtra** prima di salvarlo. Il filtro toglie la chiave, `sk-ant-…`, email e percorsi della home, come in `risorse.ts:43`. Se l'uscita è anticipata e lo stderr cita l'advisor, `availableModels` o il consenso a Fable, l'esito diventa **«advisor non disponibile»** con un motivo comprensibile. In quel caso il costo si contabilizza secondo §4 di F6.
  - **Prerequisito di Fable.** La scelta di Fable come auditor spiega prima dell'avvio che, su alcuni piani, serve un consenso una tantum dato a mano con `/model fable` in una sessione interattiva. La mod non lo dà mai al posto dell'utente.
  - **Nessun nuovo tentativo automatico senza advisor.** La chip offre «Riavvia senza auditor», che cambia il record con CAS e fa decadere le conferme.
  - **Test.**
    - Figlio finto che esce con un messaggio sull'advisor: esito e motivo corretti, nessun segreto nello stderr salvato.
    - Fable senza consenso: solo l'avviso.

## Correzione del giro 3

- **«Riavvia senza auditor»: disattivazione garantita, accolto.** Il nuovo avvio imposta `CLAUDE_CODE_DISABLE_ADVISOR_TOOL=1` nell'ambiente del **solo** processo figlio `api-claude`. È il meccanismo di spegnimento documentato e vale sopra `advisorModel` ereditato da qualunque fonte. La chip mostra «auditor: disattivato per questo avvio». Nel desktop e nella CLI interattiva l'azione non è disponibile, perché lì la mod non controlla l'ambiente della sessione. Test: con il figlio che eredita `advisorModel`, nel nuovo avvio la variabile è presente con valore `1` e non c'è `--advisor`.

## Correzione del giro 4

- **Conflitto con il campo `env` delle impostazioni: accolto.** Prima del nuovo avvio senza auditor, `eseguiApi` rilegge sul worktree reale le fonti di impostazioni, cioè utente, progetto, locale e gestite, con la precedenza documentata. Se una di esse definisce `env.CLAUDE_CODE_DISABLE_ADVISOR_TOOL` con un valore falso, che sovrascriverebbe quello del figlio, l'azione «Riavvia senza auditor» **non è disponibile**. Il motivo nomina la fonte, non il valore, e la mod non modifica mai i file dell'utente. Una fonte illeggibile blocca allo stesso modo. Test: `0` e `false` in ciascuna fonte rendono l'azione non disponibile; in assenza o con `1` resta disponibile.
