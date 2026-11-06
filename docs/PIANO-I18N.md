# Piano — chipManager: interfaccia multilingua, inglese predefinito (v1)

Stato: **bozza della master**, da far rivedere a Codex astra.
Base: `main` dopo la F4. Questa fase tocca tutte le viste, quindi parte dopo la F4.
Rientra nella release pubblica **2.2.0**: nessun numero di versione nuovo.

## 0. Richiesta del committente

«Aggiungi anche il multilingua della UI, almeno inglese e le lingue principali. Il default diventerà l'inglese.»

## 1. Ambito

**Cosa si traduce**

- Tutto il testo che la persona legge:
  - viste Lavoro, Carico e Impostazioni;
  - intestazione e sintesi;
  - etichette dei pulsanti (comprese quelle accessibili);
  - popup `$.ui.ask`, toast, errori mostrati, note;
  - comando `/chipmanager` (descrizione);
  - board HTML (testi fissi, legenda, date).
- Le date e i numeri seguono la lingua: `toLocaleString` con il codice della lingua, nessuna stringa di mese scritta
  a mano. Oggi `MESI` è in italiano in `pannello.tsx`.

**Cosa resta com'è**

- **Il testo per i modelli** (descrizioni degli strumenti MCP, messaggi di rifiuto agli agenti, blocchi fissi del
  mandato) passa in **inglese**, una lingua sola. Non è interfaccia, e una lingua unica tiene stabile il contratto con
  gli agenti. Il contenuto scritto dalle persone (titoli, brief, motivi) non si traduce mai.
- I dati: titoli e brief delle chip, nomi dei modelli, percorsi, rami.

**Lingue**

| Codice | Lingua | Ruolo |
|---|---|---|
| `en` | inglese | predefinita |
| `it` | italiano | |
| `es` | spagnolo | |
| `fr` | francese | |
| `de` | tedesco | |
| `pt` | portoghese | |

Sono tutte in alfabeto latino, a larghezza singola nel terminale. Cinese, giapponese e coreano restano fuori da
questa fase: i caratteri a doppia larghezza romperebbero le colonne del terminale e la tabella va prima resa sicura.
Si possono aggiungere dopo, con un piano a parte.

## 2. Come funziona

**Il modulo `hooks/lingua.ts`**

- `type Lingua = 'en' | 'it' | 'es' | 'fr' | 'de' | 'pt'`.
- `t(lingua, chiave, parametri?)`: cerca la chiave nel dizionario della lingua; se manca, ripiega sull'inglese; se
  manca anche lì, restituisce la chiave e il test fallisce.
- Parametri per nome, scritti `{n}` e `{titolo}`.
- Plurali con `Intl.PluralRules` della lingua. La chiave ha le forme `{ one, other }` (più `few`/`many` dove la lingua
  li usa): niente `n === 1 ? … : …` sparsi nel codice.
- Un file di dizionario per lingua: `hooks/lingue/en.ts`, `it.ts`, …. L'inglese è la fonte; il tipo delle chiavi si
  deriva da `en.ts`, così una chiave mancante in un'altra lingua è un errore di `tsc`. Niente JSON: il validatore
  della mod legge i moduli TypeScript, e i tipi danno il controllo gratis.

**La scelta della lingua**

- È un'impostazione **dell'utente**, non del progetto: `lingua` al primo livello di
  `~/.claude/chipmanager/config.json`, validata (solo i codici ammessi, altrimenti `en`).
- Si sceglie in Impostazioni con una nuova sezione **Lingua** (chip di scelta) oppure con
  `/chipmanager lingua <codice>`.
- Valore assente = `en`. Nessun rilevamento automatico: l'host non espone una lingua e le variabili d'ambiente non
  sono affidabili su Windows. È una regola semplice e prevedibile.
- **Salvataggio.** Va in `configura` con un campo di primo livello. La whitelist di `disco.cjs` si estende con una
  regola distinta: `lingua` è globale, non del progetto.
- **Quando cambia.** Il pannello si ridisegna subito. La board si rigenera al giro successivo: la lingua entra
  nell'impronta.

**Dove si chiama `t`**

- Ogni vista riceve `lingua` nei dati comuni (`comuni()` in `pannello.tsx`).
- Le funzioni pure che oggi restituiscono frasi (`rigaConsumo`, `violazioniAvvio`, motivi dei blocchi, spiegazioni
  della simulazione) restituiscono **chiave e parametri**, non testo; la vista traduce. Le guardie restano identiche:
  cambia solo come si scrive il motivo.
- `violazioniAvvio` è usata anche per rifiutare gli strumenti degli agenti: lì i motivi si rendono in inglese.

## 3. Traduzioni

- Le scrive la sessione di sviluppo, dall'inglese di riferimento, in registro da interfaccia: frasi brevi, imperativi
  per i pulsanti, nessun gergo, termini coerenti fra le viste.
- Un **glossario** in testa a ogni dizionario fissa i termini ricorrenti (chip, corsia, effort, revisore, soglia,
  board), così non cambiano da una vista all'altra.
- I termini tecnici diffusi restano in inglese in tutte le lingue: «effort», «worktree», «fork», «token». È lo stesso
  uso dell'app ospite.
- **Revisione.** Codex rivede le traduzioni insieme al diff: cerca errori, incoerenze, testi troppo lunghi e
  placeholder persi.
- **Larghezza.** Tedesco e francese sono più lunghi. Il test responsive (60, 90, 130 colonne) gira in **tutte** le
  lingue.

## 4. Test

- **Completezza:** ogni chiave di `en` esiste in ogni lingua (anche `tsc` lo garantisce) e ogni stringa ha gli
  stessi placeholder dell'inglese.
- **Plurali:** forme corrette per 0, 1, 2 e 5 in ogni lingua.
- **Ripiego:** una lingua non valida nel config dà `en`.
- **Test esistenti:** molti cercano frasi italiane. L'ambiente di test fissa `lingua: 'it'` come predefinita delle
  prove, così restano validi. In più, una serie di test fa il giro delle viste in `en`.
- **Responsive:** le tre larghezze in tutte e sei le lingue. Nessun pulsante perso, nessuna etichetta duplicata.
- **Nessun testo fuori dal dizionario.** Un test con espressione regolare cerca in `hooks/vista-*.tsx` e in
  `pannello.tsx` letterali con parole fra i tag JSX e nelle `label`. Le eccezioni dichiarate sono segni e numeri.
- **Board:** l'HTML in `en` e in `it`, con la lingua anche nell'attributo `lang` della pagina.
- **Verifiche standard,** una alla volta: validate, plugin test, prova-disco, tsc.

## 5. Documentazione

- `README.md` (inglese) diventa la pagina principale ed elenca le lingue e come cambiarle. `README.it.md` resta.
- Il CHANGELOG lo scrive la master nella release.

## 6. Rischi

- **Diff molto grande.** Tocca tutte le viste. Si fa per vista in commit separati: prima `lingua.ts` e i dizionari,
  poi Lavoro, Carico, Impostazioni, board, popup e toast. I test restano verdi a ogni commit.
- **Qualità delle traduzioni.** Sono scritte da un modello: la revisione Codex e un controllo della persona su
  italiano e inglese. Le altre lingue sono dichiarate «tradotte automaticamente, correzioni benvenute» nel README.
- **Lunghezze.** Coperte dal test responsive in tutte le lingue.

## 7. Versione 2 — dopo il giro 1 di astra (prevale sulle sezioni 1–6)

| # | Rilievo | Decisione |
|---|---|---|
| 1 | Censimento incompleto dei produttori di testo. | **Accolto.** Il censimento conta i **produttori** di testo, non solo il JSX: `ui.tsx` («selezionato», «Diminuisci», «Aumenta»), `risorse.ts` (nomi dei limiti ed errori), `strumenti/fornitori.cjs` e `disco.cjs` (nomi ed errori che arrivano al pannello), `logica.ts`, `bilanciamento.ts`, `board.ts`, `register.tsx` (toast, `ask`, note), il manifest (`plugin.json`, descrizioni → inglese). Due classi. **Messaggi propri:** l'helper restituisce un **codice** e dei parametri, che il pannello traduce. **Diagnostica esterna** (testo di errore di git, di un'API, del sistema): si mostra così com'è, dentro una frase tradotta («Errore dalla fonte: …»). |
| 2 | Contratti e persistenza non definiti (`motivoCoda` salvato come frase). | **Accolto.** I campi salvati che oggi contengono frasi (`motivoCoda`, `errore` delle azioni, voci di registro) passano a `{ codice, parametri }`, ad esempio `motivoCodice` e `motivoParametri`. **Compatibilità:** un record vecchio con la sola stringa si mostra com'è, senza traduzione, e non si riscrive. Identificatori, enum e stati non cambiano. **Ai confini:** gli strumenti degli agenti rendono in inglese, il pannello e la board nella lingua scelta. |
| 3 | Fissare l'italiano come lingua dei test non basta. | **Accolto.** Si aggiornano al nuovo contratto i test che confrontano frasi di funzioni pure: `violazioniAvvio(...).join()` (`azioni.test.tsx:275`), `rigaConsumo` (`:2329`) e simili. Confrontano i **codici**; le prove di traduzione sono separate. Si aggiornano anche i mock di `configura` e le risposte di `ask`. Test esplicito: config assente → inglese. |
| 4 | L'impostazione globale resta legata al progetto (`chi.repo`, helper con `repo` obbligatorio). | **Accolto.** Nuovo comando dell'helper `configura-utente`: stesso file e **stesso mutex e CAS** di `configura`, nessun `repo`, scrive solo i campi di primo livello ammessi (oggi solo `lingua`). Funziona anche in una sessione fuori da un repository. **Altri pannelli aperti:** il battito rilegge il config se è cambiato (data di modifica) e ridisegna quando cambia la lingua. Test con due pannelli. |
| 5 | Va dimostrato che `Intl` e `toLocaleString` funzionano nel runtime della mod. | **Accolto, risolto alla radice: niente `Intl`.** Plurali e date si fanno con un'implementazione propria, minima e deterministica per le sei lingue. **Plurali:** `one`/`other`, con la regola del francese, dove 0 e 1 sono `one`. **Date e ore:** nome del mese e formato dal dizionario, ore `HH:MM` su 24 ore per tutte le lingue tranne `en`, che usa `h:MM am/pm`, e il fuso è quello locale come oggi. **Numeri:** separatore decimale per lingua, nessun separatore delle migliaia sotto 10.000. È testabile senza l'host e non dipende dal runtime. |
| 6 | Responsive sovrastimato; «latino = larghezza singola» è falso per i contenuti personali. | **Accolto.** Si toglie l'affermazione. Si aggiunge un test di **resa reale nel terminale**: il pannello disegnato a 60 colonne con le etichette più lunghe di ogni lingua (tedesco e francese), controllando che nessuna riga superi la larghezza e che nessuna azione sparisca. I contenuti personali con emoji o CJK sono un **limite noto e dichiarato**: si accorciano e vanno a capo come oggi, senza garanzia di allineamento delle colonne. |
| 7 | Base e perimetro superati. | **Accolto in parte.** **Base:** `main` dopo la F4. I numeri 2.3.1–2.6.0 sono **interni**: la release pubblica sarà la 2.2.0 per decisione del committente, e il CHANGELOG si unifica in quel momento. **README:** quello principale è già in inglese; si aggiungono solo la sezione Lingue e l'aggiornamento di `README.it.md`. **Glossario:** uno solo, comune, in `hooks/lingue/glossario.md`. **Comando `/chipmanager lingua`:** esce, basta la sezione in Impostazioni. **Testi per gli agenti in inglese:** restano nella fase, come **ultimo commit separato**, perché la release pubblica è in inglese. Si toccano solo descrizioni degli strumenti, messaggi di rifiuto e blocchi fissi del mandato; la sostanza e le guardie non cambiano. I test del mandato confrontano i codici e le parti strutturali. |

**Ordine dei commit** (test verdi a ogni passo):

1. `lingua.ts`, dizionari, glossario, plurali e date propri.
2. `configura-utente`, sezione Lingua, rilettura nel battito.
3. Codici al posto delle frasi in `logica`, `bilanciamento`, `risorse` e helper, con la compatibilità dei record.
4. Viste Lavoro, Carico e Impostazioni, poi `ui.tsx`.
5. Board.
6. Popup, toast e note.
7. Manifest e testi per gli agenti in inglese.

## 8. Correzioni del giro 2

**N1 — Budget manuali: unità tradotte.** Accolto.

- Il parser dei budget (`budgetDa`) accetta gli **alias delle sei lingue** e li normalizza nell'enum salvato, che
  resta `richieste`, `token`, `%` e le valute. Esempi: `requests`, `richieste`, `solicitudes`, `requêtes`,
  `Anfragen`, `requisições`.
- Gli alias stanno in **una sola tabella**, accanto ai dizionari. L'esempio mostrato nella procedura guidata viene
  dal dizionario della lingua scelta.
- Test: per ogni lingua, l'esempio tradotto passa il parser e produce lo stesso valore salvato.

**N2 — Plurale portoghese.** Accolto.

- `pt` vuol dire **portoghese brasiliano**: la variante più diffusa, e quella che ICU tratta come `pt`. Lo zero
  vale `one`, come in francese.
- Nella sezione Lingua la voce si chiama «Português (Brasil)».
- I test fissano 0, 1, 2 e 5 per `fr` e `pt` con la stessa regola.
