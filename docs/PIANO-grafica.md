# Piano — chipManager: grafica responsive, chip leggibili e Impostazioni a sezioni (v1)

**Stato**: bozza della master, da far rivedere a Codex astra.
**Base**: `main` dopo la fusione di 2.3.1 (Parte A) e 2.4.0 (board). Questa parte non parte prima, perché
tocca gli stessi file.
**Metodo**: impeccable *Operate*, ui-ux-pro-max (accessibilità, interazione, form), design-taste-frontend
(app-screens). Il mondo visivo resta quello dell'host: lavoriamo su struttura, gerarchia, colore
semantico e comportamenti.

## 0. Richieste del committente

1. «Nella parte di mod, nella dashboard di Claude desktop e da terminale, va gestita meglio la grafica,
   crearla più responsive con possibilità di andare a capo se la linea è troppo piccola, usare meglio i
   colori per una miglior esperienza utente, gestire meglio le informazioni delle chip ed aver la
   possibilità di avviarne anche una singola con facilità.»
2. «La parte di impostazioni va completamente rivista: è pessima graficamente, non ha sezioni per cosa
   viene configurato e la parte di bilanciamento è davvero pessima. Sfrutta le Chips (Bootstrap 6
   forms/chips) ed i range (Bootstrap 6 forms/range) così da migliorare e facilitare l'utilizzo.»

L'host non ha HTML. Chips e range si **ricostruiscono** con gli elementi della mod (`Box`, `Text`,
`Button`, più `Svg` sul desktop), conservando il loro comportamento:

- **Chip di scelta**: una sola attiva.
- **Chip filtro**: più chip attive insieme.
- **Chip rimovibile**: con il pulsante ×.
- **Range**: valori discreti, sempre visibili, regolabili da tastiera.

## 1. Diagnosi (con le prove)

| # | Problema | Causa |
|---|---|---|
| G1 | **Il pannello non è mai responsive.** | `register.tsx:1182` chiama `disegna(...)` senza il parametro `colonne`, che vale sempre 100 (`pannello.tsx:103`). Lo stato `stretto` del terminale non scatta mai. Sul desktop la larghezza non si legge affatto. L'host la dà: `e.viewport.columns` (`RenderViewport`). |
| G2 | **Le righe tagliano invece di andare a capo.** | Titoli con `wrap="truncate-end"` (`rigaCoda`, `rigaAttesa`, `rigaFondere`, tabella sessioni); righe `justifyContent="space-between"` senza `flexWrap`, con i pulsanti sulla stessa riga del titolo. Colonne della tabella in percentuale fissa anche quando lo spazio non basta. |
| G3 | **Colore rumoroso e poco informativo.** | Mappe `COLORE_MODELLO` e `COLORE_EFFORT` (una tinta per modello e per effort) e veli colorati sotto ogni etichetta. La seconda riga delle chip (`chiLavora`) è tutta grigia, quindi chi lavora, con che modello ed effort non si distingue a colpo d'occhio. Colori esadecimali sparsi in `pannello.tsx` e `logica.ts`. |
| G4 | **Le informazioni delle chip sono povere da chiuse e pesanti da aperte.** | Da chiusa: titolo e una riga grigia; niente brief, issue, corsia, età. Da aperta: la scheda completa ha fino a sei etichette colorate più l'editor. Manca un livello intermedio. |
| G5 | **Avviare una sola chip è scomodo.** | «Avvia» c'è solo su `proposta` senza blocchi, accanto a «Dettagli», ed è secondario. Se è bloccata, sparisce senza dire perché: i motivi stanno solo nella scheda aperta. Il primario «Avvia tutte» (tasto `a`) è l'unica scorciatoia. |
| G6 | **Le Impostazioni sono un elenco unico.** | `impostazioniUi` (`pannello.tsx:1031-1053`): Select, Input e testi in fila, senza sezioni né stato. Il bilanciamento chiede due numeri liberi per ogni fornitore, modello ed effort (circa 26 campi), con una formula da leggere. Soglie e budget manuali si cambiano solo nel JSON. |

## 2. Fondamenta comuni (fase C0, versione 2.4.1, nessun cambio visibile)

### C0.1 Larghezza reale

- `disegna` riceve `e.viewport?.columns ?? 100` su ogni superficie.
- Tre classi di larghezza, calcolate una volta:
  - `larga`: 110 colonne o più;
  - `media`: da 70 a 109;
  - `stretta`: sotto 70.
- Il terminale stretto di oggi (`< 80`) diventa `stretta` o `media`.
- Un test monta il pannello con `columns` 60, 90 e 130, su desktop e su terminale, e verifica che la
  classe cambi (regressione di G1).

### C0.2 Gettoni di colore in un solo file: `hooks/tema.ts`

- **Accento**: `#00BFFF`. Si usa per la selezione, la chip attiva, il primario e il focus dei range.
  Nient'altro.
- **Stato**:
  - `inCorso` verde;
  - `attesa` ambra, per ferma e «aspetta te»;
  - `errore` rosso, per fallita e blocchi;
  - `coda` grigio-blu, per proposta e accodata;
  - `consegnata` viola tenue.

  Il colore va sempre su un segno (`●`, `◐`, `▲`, `◔`, `✓`) seguito da una parola nell'inchiostro del tema.
- **Motore**: Claude e Codex hanno ciascuno un colore, usato solo sul segno `◆`.
- **Livello di soglia**: `ok` (nessun colore), `attenzione` ambra, `critica` rosso.
- **Grigio** per didascalie e velo neutro.
- Escono `COLORE_MODELLO` e `COLORE_EFFORT`. Modello ed effort stanno nell'inchiostro; l'effort si legge
  dalle tacche `▰▰▱▱`.
- Il contrasto si verifica sul chiaro e sullo scuro per ogni tinta di stato usata come segno (≥ 3:1
  contro lo sfondo).
- Un test con grep: nessun `#xxxxxx` fuori da `tema.ts`.

### C0.3 Componenti in `hooks/ui.tsx`

Funzioni pure che restituiscono alberi, con la stessa API per desktop e terminale:

| Componente | Desktop | Terminale |
|---|---|---|
| `Chip({ testo, segno?, colore?, attiva?, onPress?, onRimuovi?, chiave })` | `Box` a bordo arrotondato. Attiva: bordo e velo dell'accento e segno `●`. Non attiva: bordo grigio e segno `○`. Con `onPress` è un `Button` con figli `Text`; con `onRimuovi` aggiunge un `Button` `×` con etichetta «Rimuovi <testo>». | `[● testo]` o `[○ testo]`, senza bordo. La scelta si legge dal segno, non dal colore. |
| `GruppoChip({ etichetta, voci, modo: 'scelta' \| 'filtro', valore, onCambia })` | Le chip in una riga con `flexWrap="wrap"`, più un'etichetta. Con `scelta` la nuova attiva spegne la precedente. | Uguale, una chip per riga se lo spazio non basta. |
| `Gamma({ etichetta, valori: string[] \| {min,max,passo}, valore, onCambia, formato })` (il range) | Una traccia di celle (`Box`) per i valori discreti. Ogni cella è un `Button` premibile, la cella attiva ha l'accento e il valore sta scritto a destra. Ai lati ci sono i pulsanti `−` e `+`, con etichette «Diminuisci» e «Aumenta» per tastiera e lettori. | `− ───●──── + 70%` con le stesse etichette. |
| `Sezione({ titolo, descrizione, stato?, figli })` | Titolo, una riga che dice cosa configura e lo stato sintetico a destra. | Lo stato va a capo sotto il titolo. |
| `Riga({ principale, azioni, classe })` | Su `larga` e `media` principale e azioni stanno sulla stessa riga con `flexWrap="wrap"`, e le azioni vanno a capo se non c'è spazio. Su `stretta` le azioni stanno sempre sotto. | Uguale. |

- I titoli usano `wrap="wrap"`.
- Il troncamento resta solo per rami e percorsi, con `truncate-middle`.

### C0.4 Divisione di `pannello.tsx`

Oggi sono 1215 righe. Diventano:

- `hooks/vista-lavoro.tsx`;
- `hooks/vista-carico.tsx`;
- `hooks/vista-impostazioni.tsx`;
- `pannello.tsx`, che tiene intestazione, viste e dati comuni.

Nessun cambio di comportamento: i test esistenti passano invariati. Questa divisione permette a C1 e C2 di
lavorare in parallelo su file diversi.

## 3. C1 — Lavoro e Carico (versione 2.5.0)

### C1.1 Scheda compatta della chip

Un solo componente per le chip da avviare, in coda, che aspettano te o da fondere. Sostituisce
`rigaCoda`, `rigaAttesa` e `rigaFondere`.

```
 3  Filtro di ricerca per le liste lunghe, con paginazione            ● Da avviare
    ◆ Codex · GPT-6 Astra · ▰▰▰▱ xhigh · ↺ rivede Claude · R2 · #123 · dopo «Indici»
    Aggiungere il filtro alla lista delle pratiche e la paginazione lato server…
    [▶ Avvia]  Dettagli  ↑ ↓  Scarta
```

- **Riga 1.** Numero d'ordine, titolo (va a capo, mai troncato), chip di stato a destra. Su `stretta`
  la chip di stato va sotto il titolo.
- **Riga 2.** Le informazioni di lavoro come frammenti in inchiostro separati da `·`. Il colore sta solo
  sul `◆` del motore e sul segno della corsia sensibile (`▲ R4`). La riga va a capo per frammenti.
- **Riga 3, grigia.** Prima riga del brief, al massimo due righe a schermo, con `…`.
- **Riga 4: azioni.** «▶ Avvia», oppure «▶ Accoda» se le dipendenze sono aperte: variante `secondary`,
  sempre nello stesso punto, primo pulsante della riga. Seguono «Dettagli», `↑` `↓` e «Scarta».
- **Chip bloccata.** Al posto di «Avvia» compare «▲ Non può partire: <primo motivo>», con il bordo della
  riga in colore `errore`. «Perché» apre la lista completa (`violazioniAvvio`) in linea, senza aprire
  l'editor.
- **«Dettagli»** apre la scheda completa (editor), come oggi.

### C1.2 Avviare una chip sola, subito

- «▶ Avvia» su ogni riga avviabile, come in C1.1.
- **«Avvia la prossima»** nell'intestazione della sezione «Da avviare», tasto `n`. Avvia la prima chip
  avviabile nell'ordine. Ha variante `secondary` e sta accanto al primario «Avvia tutte · N» (tasto `a`).
  Il pulsante dice quale chip partirà: «Avvia la prossima: Filtro di ricerca».
- Le guardie di avvio esistenti (R4, cloud, fork, registro) restano quelle di `avvia()`. Nessun nuovo
  popup.

### C1.3 «Al lavoro adesso» responsive

- **`larga`**: la tabella di oggi.
- **`media`**: due righe per sessione.
  - Riga 1: titolo (va a capo) e stato.
  - Riga 2: `◆ Claude · Opus 5.5 · ▰▰▰▱ high · contesto 34% · 2 min`.
- **`stretta`**: come `media`, con il ramo su una terza riga grigia.
- Nessuna colonna a percentuale fissa sotto `larga`.

### C1.4 Vista Carico

- Barre dei limiti con il colore del livello, non del fornitore.
- **Matrice modello × effort**:
  - su `stretta` diventa un elenco «Opus 5.5: high 2 · xhigh 1 (+1 in coda)»;
  - su `media` e `larga` resta griglia, con il velo dell'accento a intensità crescente.

### C1.5 Intestazione

- Riga 1: titolo; a destra «Aggiorna», «Board» (se accesa) e le viste come `GruppoChip` di scelta, con i
  tasti `1` `2` `3`.
- Riga 2: la sintesi va a capo per frammenti.

## 4. C2 — Impostazioni a sezioni (versione 2.6.0, sostituisce la F3 di PIANO-2.2)

### C2.1 Navigazione

In cima un `GruppoChip` di scelta con le sezioni:

- **Connessioni**
- **Soglie**
- **Bilanciamento**
- **Progetto**
- **Board**
- **Avanzate**

Si vede una sezione alla volta, tenuta in un atomo. Ogni sezione è una `Sezione`: titolo, una riga su che
cosa configura e lo stato sintetico (ad esempio «2 collegati · 1 da collegare»).

**Salvataggio**: ogni controllo salva da sé e conferma con il toast «Salvato». Un errore va in linea sotto
il controllo, con la causa e il modo per rimediare.

### C2.2 Connessioni

Una riga per fornitore (`Riga`):

- nome;
- chip di stato:
  - `● Collegato` con fonte ed età;
  - `○ Da collegare`;
  - `✕ Vietato per questo progetto`.
- `GruppoChip` filtro «Ammessi per questo progetto»: le chip dei fornitori, attive se ammessi.
  Sostituisce i quattro Select «Vietato / Abilitato».
- «Collega…» su chi è da collegare apre la procedura guidata a popup (`$.ui.ask`), come in PIANO-2.2 §4.3:
  - Claude desktop: automatico;
  - Claude da terminale: riga della status line con conferma;
  - DeepSeek e Anthropic Admin: chiave nel campo segreto di `/config`, poi verifica;
  - FreeLLMAPI: i passi Docker esistenti.
- Le chiavi si mostrano solo come stato: «impostata» o «mancante».

### C2.3 Soglie

Per ogni fornitore **visibile** (regola della Parte A):

- `GruppoChip` di scelta con i preset: «60/80», «70/90 (predefinita)», «80/95», «Nessuna».
- Due `Gamma` da 50 a 100 con passo 5, «Attenzione da» e «Critica da». Il vincolo
  `attenzione < critica` vale nei controlli:
  - il `+` di attenzione si ferma a critica − 5;
  - il `−` di critica si ferma ad attenzione + 5.
- Sotto, una barra d'anteprima con l'uso attuale e i due segni di soglia, così si vede dove cade oggi.
- Si salva in `risorse.soglie` (forma esistente, F2).

### C2.4 Bilanciamento: profili a chip + regolazioni a range

**Profilo**: `GruppoChip` di scelta. Ogni chip ha sotto una riga che dice cosa fa.

| Profilo | Cosa fa |
|---|---|
| **Automatico** (predefinito) | Nessuna preferenza fissa: decide il margine dei limiti, come oggi con i pesi vuoti. |
| **Risparmio** | Preferisce Codex e i modelli più leggeri, effort più bassi. |
| **Qualità** | Preferisce i modelli più capaci ed effort alti. |
| **Velocità** | Preferisce effort bassi e modelli rapidi. |
| **Personalizzato** | Si attiva da solo appena si tocca una regolazione. |

I profili sono **insiemi fissi di pesi**, scritti in `logica.ts` come costanti e coperti da test. Scrivono
il campo esistente `risorse.pesi`; il nome del profilo si salva in `progetti[repo].profilo`.

- La logica adattiva dell'Automatico (B4 di PIANO-2.2) resta in F4.
- I modelli dei profili si scelgono tra quelli **ammessi da `routing.json`**. Nessun nome di modello è
  scritto nel codice: «più leggero» e «più capace» si ricavano dall'ordine in cui `routing.json` elenca i
  modelli. Se l'ordine non basta a decidere, il profilo tocca solo motore ed effort.

**Anteprima** sotto il profilo: «Con questo profilo la prossima chip andrebbe a: Codex · GPT-6 Astra ·
high». Si calcola con la logica esistente di scelta (`bilancia` / `punteggio`) sulla prima chip in coda,
oppure su una chip d'esempio se la coda è vuota.

**Regolazioni**: un blocco chiuso per difetto, «Regola a mano».

- Per ogni fornitore ammesso, poi per ogni modello ammesso e per ogni effort ammesso, una `Gamma` a cinque
  posizioni: Evita · Meno · Normale · Più · Preferisci. Le posizioni corrispondono a
  `percentuale` −90, −40, 0, +40, +100, con `assoluto` 0. I valori stanno in una sola costante, con un
  test.
- Le voci sono raggruppate in tre `GruppoChip` di intestazione: Fornitori, Modelli, Effort.
- Un peso esistente con valori fuori dalle cinque posizioni si mostra come «personalizzato (+37%)». Resta
  così finché non lo si tocca: nessuna conversione silenziosa.
- Spariscono i 26 campi numerici e la formula.

### C2.5 Progetto

- **Rete**: `GruppoChip` di scelta, «Fornitori abilitati» o «Solo rete locale». Sotto, una riga su cosa
  blocca.
- **Milestone GitHub**: chip singola attivabile.
- **Cartella dati**: percorso in sola lettura (`truncate-middle`).
- **Termini sensibili**: chip in sola lettura, con il file da cui vengono.
- **Budget manuali**: una chip rimovibile per voce, ad esempio «Claude · settimanale · 40% ×».
  «Aggiungi…» apre un popup guidato (fornitore → tipo → valore, con un `Input` in linea per il valore).
  Scrive `limitiManuali` (forma esistente).

### C2.6 Board

`GruppoChip` di scelta con «Spenta», «Accesa» e «Con riassunti». Usa la forma che la 2.4.0 avrà fuso
(`progetti[repo].board`). Accanto: il costo stimato e il percorso del file.

### C2.7 Avanzate

FreeLLMAPI: livello d'uso con chip di scelta, endpoint, installazione. È chiusa per difetto.

### C2.8 Popup

Si usa `$.ui.ask` solo per le procedure guidate («Collega…», «Aggiungi budget…») e le conferme esistenti.
Mai per navigare. Se viene rifiutato (finestra chiusa o `-p`), si ricade su una richiesta in linea.

## 5. Accessibilità e invarianti (C0–C2)

- Il colore non è mai l'unico segnale:
  - stato: segno più parola;
  - chip attiva: `●` contro `○`;
  - range: valore scritto.
- Ogni `Button` ha un'etichetta che dice l'azione e l'oggetto («Avvia Filtro di ricerca», «Aumenta
  Critica da»), ed è unica in un elenco (`key`).
- Tastiera:
  - tutto si raggiunge con il focus;
  - tasti globali: `1` `2` `3` (viste), `a` (avvia tutte), `n` (avvia la prossima), `r` (aggiorna), `u`
    (annulla scarto).
  - Nessun nuovo tasto che si scontri con questi.
- Stesse informazioni sul desktop e nel terminale (principio 5 di PRODUCT.md).
- Le guardie R4, cloud, fork, registro e segreti non cambiano.

## 6. Test e prove

**Larghezze.** Desktop e terminale a 60, 90 e 130 colonne:

- i titoli lunghi compaiono interi;
- «▶ Avvia» è presente e premibile;
- nessuna riga di azioni sparisce.

**Avvio.**

- `n` avvia la prima avviabile, e solo quella.
- Una chip bloccata mostra il primo motivo; «Perché» elenca tutti i motivi.

**Componenti.**

- `Gamma`: limiti, passo, vincolo attenzione < critica, etichette accessibili.
- `GruppoChip`: scelta e filtro.

**Bilanciamento.**

- Ogni profilo scrive esattamente i suoi pesi.
- Un peso personalizzato fuori scala resta intatto.
- L'anteprima corrisponde a `bilancia`.

**Impostazioni.**

- Navigazione fra le sezioni.
- Salvataggio con toast.
- Errore in linea.
- Ripiego quando `ask` viene rifiutato.

**Altro.**

- Il grep del C0.2 sui colori.
- I test esistenti passano dopo la divisione di C0.

**Verifiche e consegna.**

- Catture prima e dopo, con dati d'esempio: desktop e terminale, tre larghezze, vista per vista.
- `impeccable critique` sulle catture prima di consegnare la C2.
- Verifiche standard: validate, test, prova-disco, tsc.

## 7. Fasi e parallelismo

| Fase | Versione | Parte da | Chi |
|---|---|---|---|
| C0 | 2.4.1 | main con 2.3.1 e 2.4.0 fuse | una sessione |
| C1 | 2.5.0 | main con C0 | una sessione |
| C2 | 2.6.0 | main con C0 | una sessione, **in parallelo a C1**: file diversi (`vista-lavoro.tsx` e `vista-carico.tsx` contro `vista-impostazioni.tsx`); `ui.tsx` e `tema.ts` restano di C0, e chi ha bisogno di cambiarli lo chiede alla master |
| F4 | 2.7.0 | Pesi adattivi, `proponi_pesi`, `risorse_agenti` con i token (PIANO-2.2) | — |

## 8. Rischi

- **`e.viewport.columns` sul desktop.** Se il desktop non lo riporta, si ricade su 100 e la classe è
  `media`. Il test lo copre.
- **Range con molte celle sul terminale stretto.** Con valori da 50 a 100 e passo 5 sono 11 celle, che
  stanno anche a 60 colonne. Le regolazioni a cinque posizioni non hanno problemi.
- **Conflitti con le sessioni in corso.** C0 parte solo dopo la fusione della 2.3.1 e della 2.4.0.

## 9. Esito del giro 1 (prevale sulle sezioni 1–8)

| # | Rilievo di astra | Decisione |
|---|---|---|
| 1 | Si usa `e.props.bodyColumns`, non `viewport.columns`. | **Accolto, e correggo la diagnosi G1.** `register.tsx:1251` passa già `e.props.bodyColumns`. Il difetto vero è un altro: `stretto` vale solo per `surface === 'terminal'` (`pannello.tsx:110`), quindi **il desktop non si adatta mai**. C1 usa `bodyColumns` su tutte le superfici, con 100 come ripiego. Test: finestra larga con pannello stretto, ridimensionamento (rimontaggio con `bodyColumns` diverso), sia desktop sia terminale. |
| 2 | Chip e Gamma promettono più di quello che l'host offre. | **Accolto.** La chip è un `Box` esterno (bordo e velo sul desktop) con uno o due `Button` a figli `Text`: la chip e la ×. Lo stato selezionato sta nel segno (`●`/`○`) **e** nell'etichetta («Automatico, selezionato»). La **Gamma** non imita uno slider: è un valore scritto con `−` e `+`, quindi due sole fermate di tastiera, più una traccia disegnata **non interattiva** e, dove servono, chip di preset per i salti. Nessuna promessa di equivalenza con un range nativo. |
| 3 | Mancano navigazione e sezioni delle Impostazioni. | **Respinto nel merito: ci sono già** (§4, C2.1–C2.8, righe 159–261 della v1). **Accolta la parte utile:** la tabella C2.9 qui sotto collega ogni controllo di oggi al suo posto nuovo, così nulla si perde. |
| 4 | La persistenza non funziona così com'è. | **Accolto.** <br>• Whitelist di `configura` (`disco.cjs:268`) estesa a `soglie` e `profilo`. <br>• `profilo` entra in `RisorseProgetto`, `risorseDa` e nei tipi, con validazione. <br>• **Profilo e pesi si salvano nella stessa chiamata `configura`**, con un solo CAS. <br>• Budget manuali: in scrittura si generano `id`, `nome`, `unita` e `letto`. Il prefisso `manuale-` che la lettura aggiunge (`logica.ts:164`) si toglie prima di riscrivere, così non si raddoppia. <br>• Prove su `prova-disco` con l'helper vero. |
| 5 | Anteprima ingannevole; l'ordine dei modelli non dice niente sulle capacità. | **Accolto.** L'anteprima diventa «Simulazione: una nuova proposta senza scelte andrebbe a …». `bilancia` agisce alla creazione (`register.tsx:1095`) e le chip già salvate non cambiano: la riga lo dice. I **profili toccano solo motori ed effort**, mai i modelli: nessuna deduzione dall'ordine di `routing.json`. I modelli si regolano solo a mano. |
| 6 | La scheda unica deve conservare le azioni per stato; «la prossima» deve seguire `pianifica`. | **Accolto.** Matrice in C1.6 qui sotto. «Avvia la prossima» sceglie con **la stessa funzione di pianificazione** di «Avvia tutte» (dipendenze, posti, corsia Codex), limitata alla prima chip che partirebbe adesso. L'avvio resta verificato in modo atomico come oggi. Se non può partire nessuna, il pulsante non c'è e la riga dice perché («tutte aspettano dipendenze», «posti finiti: 3/3»). |
| 7 | Soglie e pesi personalizzati rischiano conversioni sbagliate. | **Accolto.** <br>**Soglie:** i valori originali (anche sotto 50 o non multipli di 5) e `null` restano tali e si mostrano così. `−` e `+` si muovono di 5 entro 1–100 partendo dal valore attuale. Il vincolo `attenzione < critica` si valida su **ogni** percorso (preset, `−`/`+`, lettura) e un valore invalido non si salva. <br>**Pesi:** un peso fuori dalle cinque posizioni mostra **entrambi** i componenti («+37% · +5») e resta intatto finché non si tocca. «Evita» si chiama «Molto meno (non esclude)». |
| 8 | Accessibilità e verifiche insufficienti; contrasto dell'accento. | **Accolto.** <br>• Le scorciatoie valgono «con il pannello a fuoco» e non sono globali: lo dice anche la legenda. <br>• Due sole fermate per ogni Gamma. <br>• `#00BFFF` resta solo il colore dell'icona. In `tema.ts` l'accento d'interfaccia deve superare 3:1 sia sul chiaro sia sullo scuro, con un test che calcola il rapporto. Il testo resta sempre nell'inchiostro del tema. <br>• Test da aggiornare: `azioni.test.tsx:113` (mappe colore), `:1132` (impostazioni), `:1626` (matrice). <br>• Prove reali di layout e tastiera su desktop e terminale. |
| 9 | C0 non è senza cambi visibili e il parallelismo è ottimistico. | **Accolto.** <br>**C0 diventa sola estrazione:** divisione dei file, più `tema.ts` e `ui.tsx` creati ma non ancora usati. Nessun cambio visibile, test esistenti invariati. Colore e responsive del desktop vanno in C1. <br>**Proprietà dei file condivisi:** <br>• i test nuovi della C1 vanno in `tests/lavoro.test.tsx`, quelli della C2 in `tests/impostazioni.test.tsx`; `tests/azioni.test.tsx` lo modifica solo la C1, nei punti elencati; <br>• le funzioni nuove della C2 vanno in `hooks/bilanciamento.ts`, non in `logica.ts`; <br>• `plugin.json`, CHANGELOG, README e versione li aggiorna **la master alla fusione**; <br>• in `types/index.d.ts` la C2 aggiunge solo campi a `RisorseProgetto`, la C1 non lo tocca. <br>Dopo le due fusioni la master fa la verifica d'integrazione completa. Il grep sui colori vale per `hooks/*.ts*`, esclusi `tema.ts` e i test. |

### C1.6 Matrice stato → azioni della scheda compatta (nessuna azione di oggi si perde)

| Stato | Azioni sulla riga | In «Dettagli» |
|---|---|---|
| proposta, avviabile | ▶ Avvia (oppure ▶ Accoda, con dipendenze aperte) · Fallo qui (se ammesso, come oggi) · Dettagli · ↑ ↓ · Scarta | Editor |
| proposta, bloccata | ▲ Non può partire: <motivo> · Perché · Dettagli · ↑ ↓ · Scarta | Editor |
| accodata | Togli dalla coda · Dettagli · ↑ ↓ · Scarta | Editor |
| in-avvio | Annulla il tentativo (se `tentativoAnnullabile`) · Dettagli | — |
| avviata | Apri (se `mia`) · Segna completata · Dettagli; se ferma, bordo `attesa` | Fasi del registro |
| fallita | Riprova · Chiedi a questa sessione (come oggi) · Dettagli · ↑ ↓ · Scarta | Editor |
| consegnata | Apri (se `mia`) · Segna completata · Dettagli | Fasi del registro |

### C2.9 Mappa dei controlli di oggi → posto nuovo

| Oggi (`pannello.tsx:1031-1053`) | Domani |
|---|---|
| Select «Rete» | Progetto → chip di scelta «Fornitori abilitati / Solo rete locale» |
| Select «Milestone GitHub» | Progetto → chip attivabile |
| 4 Select «Fornitore X» | Connessioni → chip filtro «Ammessi per questo progetto» |
| Testo «Admin Anthropic / DeepSeek: impostata/mancante» | Connessioni → stato della riga del fornitore, più «Collega…» |
| Select «Compiti FreeLLMAPI» | Avanzate → chip di scelta |
| Input «Endpoint FreeLLMAPI» | Avanzate → Input invariato |
| Pulsanti di installazione Docker | Avanzate e «Collega…» di FreeLLMAPI → stessi comandi, stessa conferma |
| Input «Incremento %» e «Incremento assoluto» × N | Bilanciamento → profili più Gamma a cinque posizioni (i personalizzati si mostrano interi) |
| Nota «limitiManuali nel config» | Progetto → Budget manuali (chip rimovibili e «Aggiungi…») |
| (nuovo nella 2.3.0) soglie solo nel JSON | Soglie → preset più Gamma |
| (nuovo nella 2.4.0) Select «Board di progetto» | Board → chip di scelta |

## 10. Esito del giro 2

**Rilievo 6, residuo: accolto.** Nella riga «proposta, bloccata», «Fallo qui» resta disponibile quando lo
consente la sua guardia: `violazioniAvvio(..., true)` vuota e dipendenze chiuse. Così la riga si comporta
come oggi (`pannello.tsx:508-509`).

Per la riga bloccata della matrice C1.6, la colonna «Azioni sulla riga» diventa:

▲ Non può partire: <motivo> · Fallo qui (se la sua guardia lo consente) · Perché · Dettagli · ↑ ↓ · Scarta

**Simulazione senza candidati validi: accolto.** Il risultato di `bilancia` passa anche da
`violazioniAvvio`. Se è vietato, l'anteprima dice «Nessuna combinazione avviabile con queste regole»,
seguito dai motivi.

Test: con `soloLocale: true`, l'anteprima non propone Claude e mostra quei motivi.
