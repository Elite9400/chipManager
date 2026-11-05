# chipManager

Mod di Claude Code: un pannello nell'app desktop e nel terminale che raccoglie le azioni suggerite dalle
sessioni al posto delle chip in chat. Una sessione (di solito la master) propone un'azione con lo strumento MCP
`suggerisci_azione`; chi usa il pannello la rivede — ordine, esecutore Claude/Codex, revisore, modello, effort,
corsia, contesto, cartella, permessi — e la avvia, singola o in massa nell'ordine delle dipendenze. Il pannello
mostra lo stato dal vivo, toglie le azioni completate e in fondo l'avanzamento delle milestone GitHub.
Comando: `/chipmanager`. Il pannello si apre anche senza azioni per mostrare limiti, fonti e stato del proxy.

## Installazione (a livello utente)

Al prompt di una sessione Claude Code nel terminale:

```bash
/plugin install chipManager --marketplace Elite9400/chipManager
```

Da una shell:

```bash
claude plugin install chipManager --marketplace Elite9400/chipManager
```

Nell'app desktop, dove `/plugin` non è disponibile: **+** accanto al campo del prompt → **Plugins** → **Add
marketplace** con `Elite9400/chipManager` → **Add plugin**. Un plugin installato dal terminale a livello utente
compare anche nelle sessioni dell'app desktop.

Da una cartella locale (sviluppo):

```bash
claude plugin marketplace add <cartella di chipManager>
```

```bash
claude plugin install chipManager@chipmanager --scope user
```

L'installazione da cartella legge dalla cartella: non spostarla. Dopo una modifica: `claude plugin marketplace
update chipmanager`; le sessioni aperte la ricaricano al riavvio.

## Configurazione

Tutto ciò che è proprio di un progetto sta in un file locale, fuori da ogni repo:
`~/.claude/chipmanager/config.json` (`CHIPMANAGER_CONFIG` per spostarlo). Senza file valgono i valori generici.

```json
{
  "cartella": "~/.claude/chipmanager",
  "progetti": {
    "owner/repo": {
      "routing": ".claude/routing.json",
      "sensibili": ["anagrafica", "gestione[ _-]?paghe"],
      "background": "Webapp interna: segui CLAUDE.md, lavora nel worktree, riferisci al coordinatore.",
      "fornitori": ["claude", "codex"],
      "soloLocale": false,
      "milestoneGithub": false,
      "freellmapi": { "livello": "niente", "endpoint": "http://localhost:3001/v1" },
      "pesi": [
        { "tipo": "modello", "nome": "gpt-6-astra", "percentuale": 30, "assoluto": 0 },
        { "tipo": "fornitore", "nome": "claude", "percentuale": 0, "assoluto": 20 },
        { "tipo": "effort", "nome": "high", "percentuale": 10, "assoluto": 0 }
      ],
      "limitiManuali": [
        { "id": "piano-claude", "fornitore": "claude", "nome": "Claude piano Max", "percentuale": 70, "unita": "%", "letto": "2026-11-05T08:00:00Z" },
        { "id": "budget-api", "fornitore": "claude", "nome": "Claude API budget", "valore": 200, "unita": "EUR", "letto": "2026-11-05T08:00:00Z" }
      ]
    }
  }
}
```

| Campo | Che cosa | Predefinito |
|---|---|---|
| `cartella` | dati del pannello (`azioni/`) e registro dell'orchestratore (`registro.json`, facoltativo); `CHIPMANAGER_DIR` vince | `~/.claude/chipmanager` |
| `progetti.<owner/repo>.routing` | percorso **relativo alla radice del repo** del `routing.json`: modelli, effort, revisori, corsia Codex | `.claude/routing.json` |
| `progetti.<owner/repo>.sensibili` | espressioni regolari che rendono sensibile (R4) un'azione, oltre a auth/login/password/permessi/PII | nessuna |
| `progetti.<owner/repo>.background` | contesto fisso del mandato locale (il cloud riceve sempre quello generico) | testo generico |
| `fornitori` nel progetto | `claude`, `codex`, `deepseek`, `freellmapi`; vale anche per il revisore | solo Claude/Codex |
| `soloLocale` nel progetto | vieta ogni nuovo avvio LLM e ogni sonda esterna della mod, proxy locale incluso | `false` |
| `milestoneGithub` nel progetto | autorizza `gh api` per le milestone; `soloLocale` lo disabilita comunque | `false` |
| `freellmapi` nel progetto | livello `niente`, `R1` (R0–R1), `R2` (R0–R2); endpoint HTTP loopback con porta esplicita e `/v1` | niente, localhost:3001 |
| `pesi` nel progetto | incremento percentuale e/o assoluto per fornitore esecutore, modello o effort | nessun incremento |
| `limitiManuali` nel progetto | piano, budget o percentuale dichiarati dall'utente, con istante originale e unità | nessuno |

Il pannello rilegge configurazione e `routing.json` prima di ogni decisione: uno dei due illeggibile o non valido =
nessun avvio, con il motivo nel pannello. Le impostazioni si modificano anche da «Impostazioni e pesi»;
il salvataggio usa CAS sul config completo, preserva gli altri progetti e rifiuta un editor diventato vecchio.
Piani e budget manuali si inseriscono nel config. Gli esempi di percentuali sopra sono manuali, non misurazioni.

In un repo senza `routing.json` il pannello si apre ma non avvia niente.

## Guardie (non allentarle)

- **Sensibile (R4/R5)**: testo che tocca auth, permessi, PII o moduli sensibili → autore Opus/Fable,
  revisore Claude obbligatorio, effort almeno high; mai Codex, proxy, cloud o bypass.
- **Avvio unico**: prenotazione atomica sotto un mutex del sistema operativo (`strumenti/disco.cjs`, socket su
  127.0.0.1 liberato alla morte del processo); due pannelli non avviano mai la stessa azione.
- **Corsia Codex unica**: occupata finché vive il comando Codex o un suo discendente; le revisioni in attesa hanno
  la precedenza e provano di essere vive con un battito ogni 2 s.
- **Cloud**: solo titolo e mandato, mai il background, mai su corsie sensibili o con riferimenti a dati locali.
- **Chiusura**: solo dal task del registro legato per ramo **e** issue, mai in cartella condivisa. Se il legame non
  si dimostra, l'azione resta «consegnata» e la chiude l'utente con «Segna completata».

## Limiti e bilanciamento

Ogni riga mostra fonte, età e unità. Le barre segnalano attenzione al 70% e quasi esaurimento al 90%.
Dopo cinque minuti, dopo il reset o in caso di errore, il dato non è capacità fresca. Le osservazioni
manuali sono separate e non entrano nel margine automatico. «Non disponibile» non significa zero uso.
Saldo DeepSeek, spesa API in USD e budget manuale in EUR non vengono convertiti o confusi con una quota.

| Fonte | Che cosa legge davvero | Limiti |
|---|---|---|
| Desktop `ccd_session_mgmt.get_usage` | finestre JSON `five_hour` / `seven_day`, `utilization` o `used_percentage` | schema non documentato dal contratto engine: altri formati restano non disponibili |
| Claude CLI status line | snapshot numerico delle finestre `rate_limits` | richiede il collegamento esplicito indicato sotto; costo della sessione non è quota del piano |
| Codex `~/.codex/sessions` | ultimi eventi `event_msg` → `token_count` → `rate_limits`, finestre primaria/secondaria | lettura limitata a 30 file e 512 KiB per coda; timestamp dell'evento, non mtime del file |
| DeepSeek `GET /user/balance` | saldo in USD o CNY | non pubblica percentuale di utilizzo; integrazione di monitoraggio, non esecutore |
| Anthropic Admin `cost_report` | costi del mese UTC, centesimi API convertiti in USD, fino a 31 bucket | endpoint legacy; richiede Admin key; report paginato/incompleto non viene mostrato come totale |
| FreeLLMAPI `GET /v1/usage` | richieste del mese dal registro del proxy | non è la quota gratuita residua totale; il dashboard ha osservazioni ulteriori con autenticazione diversa |

Le sonde sono sostituibili nei test (`$.process.run`, `$.mcp.call` e trasporto dell'helper); nessuna usa
testi o file del progetto. HTTP: 4 secondi, niente redirect, risposta limitata a 512 KiB. Aggiornamento
all'apertura, ogni cinque minuti e con «Aggiorna». I log Codex e lo snapshot Claude restano letture locali.

Per raccogliere la status line Claude, passa il suo JSON su stdin al comando seguente dal tuo script di
status line, mantenendo il rendering che già usi. La mod non modifica le tue impostazioni Claude:

```bash
node /percorso/chipManager/strumenti/fornitori.cjs statusline
```

Scrive soltanto istante e finestre numeriche in `~/.claude/chipmanager/statusline.json`, mai il JSON
originale della sessione. Senza questo collegamento la fonte resta non disponibile.

Ogni peso parte da 100: `100 × (1 + percentuale / 100) + assoluto`, minimo zero. I fattori corrispondenti
a fornitore, modello ed effort si moltiplicano; il risultato viene moltiplicato per il margine fresco e
diviso per `1 + azioni attive dello stesso modello`. Capacità ignota: coefficiente prudente 0,25.
Il motore completa solo i campi omessi dei nuovi suggerimenti, provando la matrice e le guardie su ogni
candidato. Non modifica le scelte esplicite o le azioni già riviste. Senza pesi configurati il massivo e
la coda seguono l'ordine manuale; con almeno un peso usano lo stesso punteggio e i pareggi seguono l'ordine
manuale. Dipendenze, revisori, effort minimo e mutex prevalgono sempre.

Il modello che propone le azioni legge gli stessi dati con lo strumento `risorse_agenti` (sola lettura:
limiti con fonte ed età, pesi, fornitori ammessi, livello FreeLLMAPI; delle chiavi solo se sono impostate)
e può scegliere esecutore, modello ed effort in base al lavoro: le sue scelte esplicite non vengono toccate.

## Segreti

I tipi dell'engine dichiarano i campi `userConfig` sensibili in secure storage. In `/config` trovi
`chipManager.anthropicAdminKey`, `chipManager.deepseekKey`, `chipManager.freellmapiKey`, tutti con
`sensitive: true`. In alternativa, imposta nell'ambiente del processo che avvia Claude:

| Campo | Variabile di ripiego |
|---|---|
| Anthropic Admin | `ANTHROPIC_ADMIN_KEY` |
| DeepSeek | `DEEPSEEK_API_KEY` |
| FreeLLMAPI | `FREELLMAPI_KEY` |

Non inserirle in questo repository o nel config del progetto. Le chiavi passano all'helper solo
nell'ambiente, senza argv; stato, pannello e messaggi mostrano soltanto impostata/mancante. I corpi
d'errore remoti non vengono mostrati. Le credenziali dei singoli fornitori FreeLLMAPI si gestiscono nel
suo dashboard, non in chipManager.

## FreeLLMAPI

1. Abilita `freellmapi` nei fornitori **del progetto** e scegli il livello. L'opt-in autorizza l'inoltro
   ai fornitori che il gestore ha configurato nel proxy; localhost non rende l'inferenza locale.
2. «Aggiorna» sonda il loopback (`/api/ping` e, con chiave, `/v1/usage`). Nessuna installazione automatica.
3. Se manca, «Prepara immagine Docker…» e «Avvia container…» mostrano e richiedono conferma del comando
   completo, separatamente. Docker deve essere già disponibile; nessuna installazione globale o sudo.
   Il sorgente è fissato al commit `fb07845faf7cf986ea9f3692e055076035dd8739` del progetto MIT
   [FreeLLMAPI](https://github.com/tashfeenahmed/freellmapi/tree/fb07845faf7cf986ea9f3692e055076035dd8739).
   Il container usa UID 1000, senza capability, porta esposta solo su 127.0.0.1 e volume nominato
   `chipmanager-freellmapi-data`. Nessun container/volume preesistente viene rimosso. La build scarica
   le dipendenze dell'upstream; il commit applicativo è fissato, non tutti i digest delle immagini base.
4. Nel dashboard locale configura fornitori e chiave unificata. Mantieni **Model unification** attivo:
   il pin legacy può fare fallback su modelli diversi. La mod verifica prima di ogni invio che
   `/v1/models/<id>` sia un gruppo unificato (`owned_by: freellmapi`) disponibile. `auto`, `fusion` e
   alias Claude non sono ammessi. Il gestore non deve cambiare unificazione durante le richieste.
5. Aggiungi al `routing.json` i gruppi espliciti ammessi e le righe di revisione, ad esempio (frammento
   da integrare nelle sezioni esistenti; sostituisci il modello con un id reale del tuo catalogo):

```json
{
  "freellmapi": { "modelli": ["modello-del-catalogo"] },
  "revisione": {
    "revisori_ammessi_per_autore": {
      "modello-del-catalogo": ["claude-opus-5-5"]
    }
  }
}
```

Le azioni FreeLLMAPI sono trasformazioni testuali brevi, effort `low`: titolo + mandato entro 1500
caratteri, confermati per intero per quella versione. Non ricevono background, repository, strumenti,
conversazione o file. Il controllo privacy considera anche il background non inviato. R4/R5, dati
locali, fork e cartella condivisa sono bloccati. Il risultato viene mostrato come **bozza consegnata**,
mai eseguito o applicato automaticamente: la revisione Claude prevista e l'approvazione dell'utente
restano necessarie prima dell'uso. Un timeout conserva l'esito incerto e non ripete la richiesta.

«Free» non è una garanzia di spesa zero: limiti e fatturazione dei fornitori dipendono dal gestore del
proxy. Installazione e credenziali non abilitano altri progetti. La build Docker e le API autenticate
non sono state provate dal vivo nell'ambiente di sviluppo di questa modifica.

## Terminale

Gli stessi elementi e comandi funzionano su `terminal`: barre a celle, colori accompagnati da testo,
tasti `r` aggiorna, `i` impostazioni, `a` avvio massivo e navigazione del pane offerta da Claude Code.
La capacità viene verificata con `tool.list` **prima** di prenotare: dove `start_session` esiste si usa
il desktop; dove manca si usa la CLI. Un errore o una risposta persa del desktop non causano mai un
fallback che possa duplicare il lavoro.

La CLI richiede `node`, `git`, `claude` sul PATH (e `codex` per le azioni che lo usano). Crea un worktree
proprio in `<repo>/.claude/worktrees/chipmanager-<tentativo>`, ramo `chipmanager/<tentativo>`, da `base`
se indicato o dall'HEAD della sessione. Non promette il ramo base implicito del desktop. Nessun fork,
cloud o cartella condivisa: il pannello segnala le combinazioni non supportate. Il nome breve `ramo`
del desktop non modifica il nome generato dalla CLI.

Claude gira con `-p`, modello/effort espliciti e prompt su stdin, senza shell. Default dei permessi:
`default` (`acceptEdits` sulle sensibili); scegli `acceptEdits` nell'editor per autorizzare le modifiche
non interattive. `auto` e bypass sono rifiutati. Le operazioni che richiedono un'interazione possono
fermarsi: controlla il worktree. Per Codex viene riusato lo stesso mandato di coordinamento Claude e
lo stesso helper `corsia-codex` della 1.0; non nasce una corsia concorrente.

Un record per tentativo in `azioni/esecuzioni/` nasce prima dello spawn. La sorveglianza riconcilia
avvio e uscita; uscita significa consegna, mai fusione. Il processo prosegue senza pane aperto.
Una caduta senza stato finale resta occupata/incerta: controlla processo e worktree, poi chiudi dal
pannello quando il lavoro è realmente finito. Nessun worktree è eliminato automaticamente. La policy
governa i nuovi effetti della mod; non revoca processi o richieste già partiti né sostituisce un firewall.

## Struttura

| File | Che cosa |
|---|---|
| `hooks/register.tsx` | eventi, strumenti MCP, avvio delle sessioni, giro di sorveglianza |
| `hooks/pannello.tsx` | disegno del pannello |
| `hooks/logica.ts` | funzioni pure: regole, pianificazione, transizioni, colori |
| `strumenti/disco.cjs` | helper Node: mutex, CAS su file, corsia Codex |
| `hooks/risorse.ts`, `strumenti/fornitori.cjs` | adattatori delle fonti, trasporto limitato, installazione guidata e proxy testuale |
| `types/index.d.ts` | contratto dei tipi e dello stato |

## Collaudo

```bash
claude plugin validate .
```

```bash
claude plugin test .
```

```bash
node --test strumenti/prova-disco.cjs
```

I 66 test del modulo comprendono i 47 originali e le nuove prove di policy, pesi, interfaccia sulle due
superfici, conferme, segreti e CLI. L'helper conserva le 15 prove con processi veri e aggiunge parser,
trasporto HTTP finto, CAS delle impostazioni e ciclo CLI con runner sostituibile (11 prove nuove). Nessuna chiamata HTTP
reale nei test. I file temporanei delle prove stanno in `.cache/` nel worktree.

Il sandbox di sviluppo rifiuta lo spawn dei figli dei runner (`EPERM`). In questo ambiente i controlli
eseguibili, senza cambiare le restrizioni, sono:

```bash
claude plugin test --file tests/azioni.test.tsx .
node --test --test-isolation=none --test-name-pattern="2.0" strumenti/prova-disco.cjs
```

Questi non sostituiscono il collaudo dei processi reali fuori dal sandbox. TypeScript 5.6.3: restano
soltanto i due TS2589 preesistenti; nessun errore nuovo. Per prove e limiti osservati vedi
[ANALISI-2.0.md](docs/ANALISI-2.0.md). I 17 giri di revisione avversariale della 1.0 non sono una
certificazione della 2.0.
