# F9 — Due grafiche distinte: desktop ricco, terminale developer (prima della 2.2.0)

Richiesta del committente (7 novembre 2026):
- lo stile delle immagini e della GIF del README (`docs/img/hero.png`, `desktop-panel.png`, `desktop-settings.png`, `demo.gif`) è molto migliore di quello sviluppato;
- servono **due grafiche separate e differenti** per desktop e terminale;
- vanno migliorate **senza toccare le funzionalità**;
- vanno sfruttati meglio colori e stile;
- titolo e logo sono pessimi.

Si parte da `main` dopo il ramo del README e della release (o dal suo stesso ramo), prima del rilascio.

## 0. Riferimento visivo (fonte: le immagini del README 2.1.0)

Il **desktop** segue `desktop-panel.png` e `hero.png`:
- Ogni chip è una **scheda** su fondo leggermente più chiaro, con angoli arrotondati, numero d'ordine attenuato e titolo in grassetto.
- **Pillole colorate per attributo**, una per riga e con il proprio velo tinto:
  - stato, con un punto colorato;
  - motore: ◆ Claude arancio, ◆ Codex verde;
  - modello, con un punto colorato per famiglia;
  - effort, con 4 blocchi colorati dal blu al rosso e la parola accanto;
  - revisore (↺).
- Le **sensibili R4** hanno il bordo della scheda e la pillola ▲ in rosso.
- Un'**attesa o una dipendenza** compare come fascia ambra dentro la scheda, con l'icona ◔.
- **Azioni.** Il primario («Avvia») è pieno, in azzurro; i secondari sono contornati; ↑ ↓ Scarta stanno a destra e sono attenuati.
- **Limiti.** Ogni limite ha una barra spessa colorata per livello, l'etichetta «Codex piano · primaria: 32% usato» e sotto la riga grigia con fonte, età e reset.
- **Intestazioni.** Ogni sezione ha un'intestazione in maiuscoletto attenuato («DA AVVIARE») con il conteggio a destra.
- **Milestone.** Scheda finale con barra di avanzamento.

Il **terminale** resta nello stile developer di F5.2/F8, ripulito come `terminal.png`:
- riga per chip in monospazio, `[ Avvia ]` primario in accento;
- glifi colorati e testo nell'inchiostro del terminale;
- barre a blocchi `▕████▌   ▏`;
- larghezza 60/100/120 come oggi.

## F9.1 — Separazione per superficie, senza toccare la logica

- **Componenti per superficie.** In `hooks/ui.tsx` le primitive (`Chip`, `Pillola`, `Scheda`, `Barra`, `Intestazione`, `Pulsante`) hanno **due rese**, scelte da `surface`:
  - `desktop` (e `vscode`, `mobile` come desktop);
  - `terminal`.
- **Cosa resta uguale nelle due rese:**
  - stessi dati, stesse azioni con stessa chiave e stesso `onPress`;
  - stesso ordine logico;
  - stesse etichette accessibili (`label`).

  Cambia solo la presentazione.
- **Viste.** `vista-lavoro.tsx`, `vista-carico.tsx`, `vista-impostazioni.tsx` e `pannello.tsx` non cambiano struttura dati né comportamento: usano le primitive. Non spostano né aggiungono azioni.
- **Garanzia di non regressione.** Per ogni vista e per ciascuna superficie, l'**insieme delle azioni** (chiave, `label`, `onPress` presente) dell'albero disegnato prima e dopo F9 è **identico**. È un test nuovo, eseguito sulle fixture esistenti. Tutti i test di comportamento restano verdi senza modifiche alle asserzioni.

## F9.2 — Colori

- **Palette semantica estesa in `tema.ts`**, sempre unica fonte:
  - **Motore:** Claude arancio, Codex verde, FreeLLMAPI magenta (esistono già).
  - **Famiglia di modello:** Opus, Sonnet, Haiku, Fable e GPT. Sono punti colorati distinti, separati dal colore del motore.
  - **Scala dell'effort:** low, medium, high, xhigh, max, dal blu al rosso; colora i 4 blocchi.
  - **Stati:** quelli che esistono già. **Livelli:** ok, attenzione, critico.
  - **Veli per le pillole:** la stessa tinta a bassa opacità, dalla scala `VELO`.
- **Regola sul testo e sui colori.** Il testo resta nell'inchiostro dell'host (decisione di F8): sono colorati solo **punti, ◆, blocchi, barre, bordi e veli**.
- **Contrasto e significato.**
  - Ogni tinta usata come segno regge 3:1 sugli sfondi di riferimento, chiari e scuri, e sul proprio velo. Il test esistente si estende alle tinte nuove.
  - Nessuna informazione solo nel colore: ogni pillola ha la parola.

## F9.3 — Titolo e logo

- **Intestazione del pannello.** Il **marchio** «chip**Manager**» ha «chip» nell'inchiostro e «Manager» nell'azzurro dell'icona, usato solo come grafica grande come in `hero.png`.
  - **Desktop:** a sinistra il marchio in grassetto con un piccolo segno grafico (una chip stilizzata ◧ o ▣ nel colore dell'icona). Accanto, attenuati, il progetto (`owner/repo`) e la versione. A destra «↻ Refresh» e «Open board».
  - **Terminale:** una riga `▣ chipManager · owner/repo · 2.2.0` con il glifo in azzurro, più `r: Refresh` a destra.
- **Riga di sintesi.** Sotto il titolo una riga con pillole sul desktop e testo semplice nel terminale: «4 to start · 1 waiting for you · Claude 70% used».
- **Il logo grafico per il README** (`hero.png`, intestazione dell'icona) si rifà con lo stesso marchio. Il campo `icon` del manifest non cambia.
- **Board HTML.** Stesso marchio nell'intestazione, con le variabili CSS di F8.

## F9.4 — Viste

- **Lavoro, desktop:**
  - schede delle chip come in `desktop-panel.png`, con pillole, fascia d'attesa, bordo rosso per R4 e azioni come sopra;
  - sessioni al lavoro in schede compatte con pillole;
  - «Chi lavora» (F7.4): riepilogo in pillole, preset come chip di scelta, «modificato» come pillola ambra.
- **Lavoro, terminale:** righe compatte come oggi, con le pillole rese come `◆ Claude · ● Opus 5.5 · ▮▮▯▯ medium · ↺ Codex`.
- **Carico.** Barre spesse colorate per livello, matrice modello × effort con celle velate e righe in denaro di F6.
- **Impostazioni.** Sezioni in schede con intestazione, chip di scelta (F5.8) colorate d'accento e barra «Applica» in evidenza. Sul desktop c'è più spazio verticale fra le sezioni.
- **Hover di F8.** Resta: velo sulle schede e sulle righe.

## F9.5 — Verifica e approvazione

- **Test:**
  - insieme delle azioni identico per vista e superficie (F9.1);
  - contrasto delle tinte nuove;
  - 60 colonne nel terminale nelle sei lingue;
  - nessun colore fuori da `tema.ts`;
  - tutti i test esistenti verdi.
- **Anteprima per il committente prima delle catture reali.**
  - Una pagina HTML statica generata dagli alberi disegnati con le fixture d'esempio, desktop chiaro e scuro, che **approssima** la resa dell'host.
  - Il terminale reso dal kit.
  - Si mandano al committente con la dicitura «anteprima, non cattura dell'host».
- **Collaudo vero.** Il committente fa le catture reali con `D:\cm-demo\avvia.ps1` e l'elenco già pronto. Da quelle si rifanno le immagini e la GIF del README, e le schede del README vengono aggiornate.
- **Revisione.** Codex rivede il diff, con attenzione alle regressioni funzionali.

## Correzioni del giro 1 (prevalgono su tutto quanto sopra)

1. **Marchio e colori riservati — accolto, con una deroga dichiarata.**
   - **Marchio.** Il committente chiede esplicitamente un titolo migliore, come in `hero.png`. Si **supera** quindi la regola di F8 («testo solo nell'inchiostro dell'host») **solo per il marchio**: «Manager» in **grassetto** nell'`ACCENTO` (`#0A86C9`), mai nell'`ICONA` `#00BFFF`.
     - Contrasto misurato: 3,99:1 sul chiaro e 4,74:1 sullo scuro. Basta per un marchio in grassetto, che si tratta come elemento grafico, e non vale come testo corrente.
     - «chip» resta nell'inchiostro.
     - Il glifo ▣ è nell'`ACCENTO`.
     - La deroga si scrive in `tema.ts` e nel piano. Nessun altro testo entra nella deroga.
   - **Scala dell'effort.** È **monocroma, dal blu all'indaco/viola**: nessun rosso o giallo, che restano riservati ad attenzione e critico (F8). Il livello si legge anche dal numero di blocchi pieni e dalla parola.
2. **Garanzia sul comportamento — accolto.**
   - **Cosa estrae il test.** Per ogni vista e **per ciascuna superficie, prima e dopo F9**, l'**elenco ordinato** dei controlli: tipo (`Button`, `Select`, `Input` e ogni elemento con `onPress`, `onSelect`, `onInput`, `onSubmit`), chiave, `label`, `hotkey`, `variant` quando ha valore funzionale, opzioni e valore dei `Select`.
   - **Cosa verifica.** Uguaglianza dell'elenco, **unicità** delle chiavi e delle scorciatoie, e, nelle fixture pertinenti, gli **effetti** dei callback.
     - **Avvia, Scarta, Cambia, Dove e Applica:** ogni callback viene invocato su un `$` registrato e si confrontano le chiamate prodotte (helper, `update`, `mcp`) prima e dopo.
     - **Cosa resta confrontato separatamente.** Le capacità per superficie: mobile senza `Input` e `Select`, e `puoCambiare` legato al lanciatore. Si confronta prima/dopo **per superficie**, senza imporre uguaglianza fra superfici.
3. **Fedeltà all'illustrazione — accolto.**
   - **Cosa si promette.** Una **traduzione nelle primitive native dell'host**: veli, bordi `round`, padding, barre composte da `Box`, grassetto.
   - **Cosa non si promette.** La somiglianza esatta a `desktop-panel.png`. `Button.variant` delega all'host l'aspetto del primario e del secondario.
   - **Come si verifica.** La resa si verifica sulle catture reali del desktop.
   - **Il piano distingue due elenchi.** Le capacità supportate (verificate dai tipi) e la somiglianza all'illustrazione, giudicata dal committente.
4. **Veli e contrasto — accolto.**
   - **Opacità delle pillole.** È fissata in `VELO.pillola` = `14`, più bassa di `1F`.
   - **Il test si estende a tutte le composizioni effettive:**
     - ogni segno (motore, famiglia, effort, stati, livelli) sul **proprio velo sopra la scheda** (`VELO.riquadro`), sopra ciascuno sfondo di riferimento, chiaro e scuro;
     - le stesse composizioni con il velo di hover.
   - **Soglia.** Ogni composizione regge almeno 3:1. Le tinte che oggi non la reggono sul velo, come Codex sul chiaro ed errore sullo scuro, si ritoccano finché la reggono, e i valori finali vanno nel piano.
5. **Test visivi superati — accolto.**
   - **Nessuna asserzione comportamentale cambia.**
   - **Asserzioni visive che F9 supera.** Si aggiornano **nominando l'eccezione**: per esempio `ui.test.tsx:194`, «stessa barra testuale su desktop e terminale», diventa «barra a `Box` sul desktop, barra a blocchi nel terminale» per decisione F9, che supera F5.2 e F8 per il solo desktop.
   - **Elenco.** L'elenco delle asserzioni aggiornate va nel rapporto.
6. **Resa reale — accolto.**
   - **Il requisito di F8 resta:** collaudo reale nelle sei lingue, con id lunghi e navigazione da tastiera, desktop a due larghezze, terminale a 60, 100 e 120 colonne.
   - **L'anteprima HTML.**
     - È dichiarata come anteprima.
     - È generata **solo** dalle proprietà presenti nell'albero, senza stili aggiunti.
     - Non certifica contrasto, fuoco o resa dell'host.

## Correzioni del giro 2

- **Valori degli `Input` — accolto.** L'elenco dei controlli confrontato include anche `value` degli `Input`, per esempio il filtro di `vista-lavoro.tsx`, oltre a opzioni e valore dei `Select`.
- **Anteprima del terminale — accolto.** Il kit non dipinge, quindi l'anteprima del terminale è una **simulazione testuale dichiarata**, ricavata dall'albero disegnato a larghezza fissa e marcata in chiaro come «simulazione, non resa dell'host». La resa vera del terminale viene solo dalle catture reali del committente.
- **Dato di contrasto — accolto.** I valori corretti di `ACCENTO` sono: 3,99:1 su `#FFFFFF`, **3,80:1 su `#262624`**, 5,27:1 su `#000000`. La soglia grafica 3:1 resta soddisfatta e il marchio in grassetto la rispetta su tutti e tre gli sfondi.
