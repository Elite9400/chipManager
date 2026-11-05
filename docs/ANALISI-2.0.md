# Analisi avversaria — chipManager 2.0

## Il problema utile

La 1.0 sa impedire avvii doppi e chiusure false, ma non sa distinguere capacità disponibile,
credito e budget; presume il desktop per avviare; lascia al committente ogni scelta ripetitiva.
Su un progetto nuovo servono prima regole leggibili, una politica dei dati esplicita e numeri
di provenienza controllabile. Il miglior sviluppatore guadagna da meno decisioni ripetitive,
meno attese sulla corsia unica e risultati verificabili, non da più agenti contemporanei.

## Invarianti e superficie del cambiamento

- `logica.ts`: configurazione, matrice, sensibilità, pianificazione e normalizzazione dei record.
- `register.tsx`: suggerimenti, tutti gli avvii (singolo, massivo, coda, qui, manuale), sorveglianza,
  lettura delle fonti e salvataggio delle impostazioni del progetto.
- `pannello.tsx`: stesso albero accessibile sulle due superfici, limiti prima delle azioni,
  impostazioni e conferme; contratto in `types/index.d.ts`, manifest, README e test finti.
- Helper Node: riuso di mutex OS, CAS e corsia Codex; aggiunta di I/O con risposte minimali,
  lancio CLI e prove isolate. Nessun indebolimento delle guardie della 1.0.

## Scelte per i punti 1–5

1. **Limiti**: osservazioni separate per conto/finestra, con fonte, istante, unità e disponibilità.
   Percentuale solo con numeratore e denominatore confrontabili; saldo non è percentuale di piano.
   Dato assente, schema ignoto o vecchio: dichiarato e non usato come capacità fresca. Soglie 70/90%.
   Fonti: `get_usage` desktop quando riconoscibile; snapshot esplicito della status line Claude;
   eventi `token_count/rate_limits` Codex letti localmente; balance DeepSeek; cost report Anthropic
   con Admin key; `/v1/usage` FreeLLMAPI (consumo, non promessa di quota gratuita totale).
   Piano e budget manuali restano marcati manuali, senza conversioni monetarie inventate.
2. **Pesi**: base 100, incremento percentuale o assoluto per fornitore/modello/effort. Si enumerano
   solo candidati della matrice e si filtrano con le guardie esistenti, inclusi revisori e effort.
   Punteggio con margine fresco e carico attivo; pareggi conservano l'ordine. Le scelte esplicite
   non si sovrascrivono. Il massivo cambia priorità, non dipendenze, approvazioni o prenotazioni.
3. **FreeLLMAPI**: opt-in per progetto e livello niente/R0–R1/R0–R2; endpoint solo loopback,
   nessun redirect. È comunque un inoltro esterno: vietato in modalità solo LAN. Compiti terzi
   come trasformazioni testuali senza strumenti, accesso al repo o esecuzione del risultato:
   il testo completo viene confermato, il risultato resta una consegna da rivedere. Scartato
   il reindirizzamento di un agente con accesso al repository: potrebbe leggere `.env` dopo
   aver superato il controllo del prompt. Scartati anche pin legacy, `auto` e `fusion`: possono
   ripiegare su modelli fuori matrice. Si accettano solo gruppi unificati disponibili, verificati
   su `/v1/models/<id>`; l'amministratore deve mantenerne stabile la configurazione durante l'invio.
   Installazione Docker guidata, commit upstream fissato,
   comando completo e consenso ad ogni passo, nessun privilegio elevato o aggiornamento automatico.
4. **Terminale**: scelta della capacità prima dell'effetto, mai fallback dopo un avvio desktop
   incerto. Stessa prenotazione e gettone; processo Claude CLI in worktree proprio, con lo stesso
   mandato (anche coordinamento Codex attraverso il mutex esistente), modello/effort/permessi
   espliciti. Niente emulazione silenziosa di fork/cloud. Stato persistente per tentativo;
   crash o risposta persa conservano l'incertezza, non autorizzano un secondo avvio.
5. **Grafica**: righe limiti sempre presenti anche senza azioni, barra + numero + stato testuale;
   fonte ed età visibili, impostazioni richiudibili, pesi per elemento e stato proxy/chiave.
   Nessuna dipendenza grafica; riuso degli elementi `Box`, `Text`, `Input`, `Select`, `Button`.

## Chiusura dei rischi

- Segreti: i tipi della piattaforma dichiarano `userConfig` sensibili in secure storage.
  Valori soltanto nella closure e nel trasporto all'helper; ambiente come ripiego. Mai nello stato,
  nel config del progetto, negli argv, nei mandati o nei messaggi di errore. UI: impostata/mancante.
- Privacy: default Claude/Codex; controlli anche sul revisore. `soloLocale` blocca ogni esecuzione
  LLM e sonda esterna (Claude/Codex inclusi: processo locale non significa inferenza locale).
  Le milestone GitHub richiedono opt-in separato e sono vietate in quel modo. Per terzi si verifica
  anche il background, pur non inviandolo.
- Costi: nessun carico di lavoro nelle sonde, timeout e dimensioni limitati, niente retry automatico
  di inferenza; un proxy gratuito non garantisce costo zero sui fornitori configurati dal suo gestore.
- Fiducia: formato non riconosciuto significa non disponibile; timestamp originale, mai aggiornato
  leggendo di nuovo un vecchio log. Nessun budget in euro confuso con spesa API in dollari.
- Concorrenza: CAS prima dell'effetto; aggiornamenti legati al tentativo; worktree mai eliminati
  automaticamente; uscita processo non equivale a fusione. Errori e risultati non eseguiti come codice.

## Prove e limiti dell'ambiente (prima del codice)

Letti README, contratto engine locale, logica, pannello, register e tutti i test. Context7 consultato
per Claude Code, Codex e FreeLLMAPI; endpoint e versione verificati anche sulle fonti upstream.
`claude plugin validate .` passa con avvisi già presenti (nome, licenza/catalogo, icona).
I 47 test esistenti passano con `claude plugin test --file tests/azioni.test.tsx .`.
Il comando aggregato e `node --test` incontrano `spawn EPERM` nel sandbox; il resolver `npx --offline`
non trova TypeScript 5.6.3. Le prove mancanti saranno dichiarate, non trasformate in successi.

## Esito del collaudo 2.0

- `claude plugin validate .`: codice 0, avvisi preesistenti. Il profilo catalogo segnala anche
  licenza mancante: non è stato scelto un regime di licenza al posto dell'autore.
- Motore finto, `claude plugin test --file tests/azioni.test.tsx .`: **66/66**, inclusi tutti i 47
  originali. Copre le due superfici, CAS, revoca durante la conferma, policy, pesi, segreti e fonti rotte.
- `node --test --test-isolation=none --test-name-pattern="2.0" strumenti/prova-disco.cjs`: **11/11**.
  Le 15 prove native originali con processi figli non sono state certificate qui: runner aggregati
  ancora bloccati da `spawn EPERM`. Nessuna richiesta HTTP reale nei test.
- Individuato il binario TypeScript **5.6.3** già presente nella cache locale ed eseguito direttamente
  con `-p . --noEmit`: restano **TS2589 ×2**; risolti TS2367 ×2 e TS2344. Nessun errore nuovo.
- Lettura locale effettiva dei log Codex verificata: percentuale, istante e reset della finestra
  primaria, senza testo delle conversazioni. Lo snapshot Claude non era presente.
- Non verificati dal vivo: `get_usage` desktop, Admin API, saldo DeepSeek, proxy autenticato,
  build Docker e lavoro CLI reale. I rispettivi contratti sono testati con sostituti locali.
  Per Admin API la guida ufficiale conferma centesimi USD: conversione `/100` coperta da test.
- Nessun push, installazione globale o installazione reale del proxy. Il sandbox dell'autore non poteva
  scrivere i metadati git del worktree: il commit l'ha fatto il revisore, che ha poi rieseguito tutte le
  suite (comprese le 15 prove native con processi veri).

Rischi residui: il proxy e i suoi gruppi di modelli restano sotto il controllo dell'amministratore;
il pin applicativo non congela ogni digest delle dipendenze Docker. Le bozze richiedono revisione
esplicita; i processi CLI senza esito certo richiedono ispezione del worktree, mai riavvio automatico.
L'endpoint costi Anthropic è legacy: va migrato prima del suo ritiro. Il collaudo dei processi reali
resta necessario in un ambiente che ne consenta l'avvio.

Fonti: [Claude CLI](https://code.claude.com/docs/en/cli-reference),
[status line](https://code.claude.com/docs/en/statusline),
[Codex exec](https://github.com/openai/codex/blob/main/sdk/typescript/src/exec.ts),
[FreeLLMAPI API](https://github.com/tashfeenahmed/freellmapi/blob/main/docs/en/api/01-rest-api.md),
[unità monetarie Anthropic](https://platform.claude.com/docs/en/build-with-claude/usage-cost-api),
[saldo DeepSeek](https://api-docs.deepseek.com/api/get-user-balance).
