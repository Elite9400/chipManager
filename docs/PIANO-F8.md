# F8 — Revisione grafica completa in stile developer (dentro la 2.2.0)

Richiesta del committente, 6 novembre 2026. Nella 2.2.0 entrano anche:
- una sistemazione grafica completa in modalità developer;
- la sistemazione dei pulsanti con la scritta «selezionato / non selezionato»;
- la grafica dei pulsanti al passaggio del puntatore (hover);
- colori e stile;
- la grafica della parte «Chi lavora».

Si parte da `main` dopo F7, perché la vista «Chi lavora» la ridisegna F7.4. F5.2 (stile developer) e F5.8 (scelte a solo colore) sono già in `main`: F8 li porta a termine su **tutte** le viste e li verifica sulle catture reali.

## F8.0 — Prima le catture, poi le correzioni

- **Catture.** Si fanno sull'host reale, con la configurazione di prova (`demo-config`, login già fatto) e dati d'esempio:
  - **desktop:** Lavoro, Carico, Impostazioni (con ogni sezione aperta), Esecuzione, board;
  - **terminale:** le stesse viste a 60, 100 e 120 colonne, con tema chiaro e scuro dove l'host li offre.
- **Revisione.** `impeccable critique` e `audit` (modo *Operate*) sulle catture, più `ui-ux-pro-max` per contrasto, stati, interazione e densità. Ne esce un elenco di rilievi con la cattura di riferimento.
- **Approvazione.** Le catture «prima» e «dopo» si mandano al committente, che approva prima della fusione.

## F8.1 — Pulsanti: nessuna dicitura di stato

- **Censimento.** Si cercano, in **ogni** vista e nelle sei lingue, le etichette che dicono lo stato di un controllo («selezionato», «non selezionato», «attivo», «sì/no» nel testo dei toggle e simili) e si tolgono.
- **Come si mostra lo stato.**
  - Il controllo dice **solo il suo nome**.
  - Lo stato si vede dalla variante d'accento e dall'attenuazione (regola di F5.8), estesa a toggle, select e filtri.
  - Gli stati delle **azioni** (in coda, avviata, errore…) restano glifo più parola: sono informazione, non stato di un pulsante.
- **Test.** Nessuna voce dei dizionari usata come etichetta di un controllo contiene una parola di stato. È un controllo in prova-disco con un elenco chiuso di parole per lingua.

## F8.2 — Hover

L'host lo offre senza far girare codice della mod: `Box.hover` e `Button`/`Text.hover` (stili sotto il puntatore, legati a un `Box` con chiave o a uno `scope`).

- **Righe di chip, sessioni e voci delle Impostazioni.** Sotto il puntatore lo sfondo si schiarisce di poco (velo d'accento basso) e il bordo prende l'accento.
- **Azioni secondarie della riga** (Modifica, Dove, Cambia…).
  - **Desktop:** restano attenuate a riposo e diventano piene sotto il puntatore o con il fuoco.
  - **Terminale:** sempre visibili, perché l'hover non esiste. Nessuna azione è raggiungibile **solo** con l'hover.
- **Pulsante primario.** Ha un unico stile hover/premuto coerente, quello dell'host, senza colori inventati.
- **Test.** Le proprietà `hover` sono presenti sui `Box` con chiave, e nessun `hover` è fuori da un `Box` con chiave o da uno `scope` (l'host lo rifiuterebbe). Nel terminale le azioni sono visibili senza hover.

## F8.3 — Colori e stile

- **Gettoni semantici in `tema.ts`, una sola fonte:**
  - accento Azzurro (`#0A86C9` con il velo `1F` di C0);
  - ok / attenzione / critico / informazione;
  - testo, testo attenuato, bordo, velo;
  - ciascuno con variante chiara e scura dove l'host distingue il tema.
- **Nessun colore scritto direttamente** nelle viste. Un controllo in prova-disco lo verifica.
- **Contrasto.** Testo almeno 4,5:1 e elementi grafici almeno 3:1 sullo sfondo dell'host, in chiaro e in scuro. Lo verifica uno script sui gettoni.
- **Coerenza di stile.**
  - Il carattere monospazio vale per tutti i dati (F5.2).
  - Gli spazi seguono una scala unica.
  - Le barre a blocchi sono identiche in tutte le viste.
  - I titoli di sezione in minuscolo stile developer sono uguali ovunque.
  - Rosso e giallo compaiono solo per critico e attenzione.
- **Board HTML.** Usa gli stessi gettoni come variabili CSS, segue `prefers-color-scheme` e ha lo stesso contrasto verificato.

## F8.4 — «Chi lavora»

Dopo F7.4 si fa una rifinitura visiva sulle catture: allineamento del riepilogo su più righe, preset come chip di scelta (F8.1), effort a barre, corsia con la legenda, hover sulla riga (F8.2). La struttura decisa in F7.4 non cambia.

## F8.5 — Verifica

- **Test.** Resa a 60 colonne nelle sei lingue; i controlli di F8.1, F8.2 e F8.3; i test esistenti verdi.
- **Catture «dopo».** Stesse viste e larghezze di F8.0, controllate a occhio una per una perché non contengano dati dell'account. Vengono mandate al committente.
- **Revisione del diff.** La fa Codex.
- **README.** Le immagini e la GIF del README si rifanno da queste catture «dopo» (F5.4).

## Correzioni del giro 1 (prevalgono su tutto quanto sopra)

1. **Perimetro di F8.1 — accolto.**
   - **Dove vale il solo colore.** L'eccezione resta quella di F5.8: chip di scelta o filtro e schede delle viste.
   - **Cosa toglie F8.1.** Solo i **suffissi di stato** che ripetono uno stato già visibile («, selezionato», «, non selezionato» e i loro equivalenti nelle sei lingue), dovunque siano rimasti.
   - **Cosa non tocca:**
     - i valori mostrati dai `Select`, perché `SelectProps` non ha né `variant` né `hover`, e il valore scelto è informazione;
     - le opzioni con un significato proprio, come «Spenta», «Accesa», «Spento»;
     - le etichette contestuali che distinguono controlli con lo stesso nome;
     - i segni «modificato», i motivi e gli stati dell'advisor di F7.
   - **Primario non vuol dire selezionato.** `Button.variant="primary"` resta il modo di segnare la scelta nelle chip di F5.8, ma il piano dice in chiaro che è un **limite di accessibilità accettato dal committente**, non uno stato accessibile verificato.
2. **Hover — accolto.**
   - **Righe.** Cambia solo lo **sfondo**: un velo d'accento basso, applicato con `Box.hover`. Non si usano `borderStyle` in hover dove la riga non ha un bordo a riposo.
   - **Azioni secondarie.** Si usa `Button.dimColor`, che l'host porta a piena intensità sotto il puntatore **o con il fuoco**.
   - **Vietato.** Nascondere azioni con `display: none` e farle comparire solo con l'hover.
   - **Test sull'albero disegnato:**
     - ogni `hover` sta su un `Box` con chiave unica fra i fratelli, oppure dentro uno `scope`;
     - nessuna chiave duplicata;
     - nessun `display: none` su un nodo che contiene un `Button`;
     - ogni azione è presente nell'albero senza hover, quindi raggiungibile da tastiera.
3. **Contrasto — accolto.**
   - **Grafica e testo separati.**
     - L'accento `#0A86C9` resta per la grafica: bordi, barre, glifi, velo. Lì basta 3:1.
     - Il **testo** usa l'inchiostro dell'host (colore predefinito o `dimColor`), oppure un gettone **«accento-testo»** separato e più scuro, scelto perché superi 4,5:1 sugli sfondi di riferimento chiaro e scuro.
   - **Cosa si misura.** Le coppie e le composizioni effettive: testo su velo, testo attenuato, hover.
   - **Cosa non si promette.** Il contrasto universale: la palette dell'host non si può leggere. Il piano lo dice, e il collaudo lo verifica a occhio sui due temi.
   - **Test esistente.** Il test a 3:1 si sdoppia in due: grafica a 3:1 e testo a 4,5:1.
4. **Catture — accolto.**
   - **Chi fa cosa:**
     - **terminale:** la sessione di sviluppo, con lo strumento di terminale dell'app (`run_in_terminal` e lettura dello schermo) nella `demo-config` isolata, con il progetto demo, `fornitori: []` e le letture reali spente (F5.4, punto 3);
     - **board:** la sessione, nel browser integrato dell'app, sul file HTML generato dal progetto demo;
     - **desktop:** il **committente**, seguendo un elenco passo per passo con viste, sezioni aperte e larghezza della finestra, sullo stesso progetto demo. Lo prepara la sessione.
   - **Prima di usarle.** Ogni immagine e **ogni frame** della GIF si controlla a occhio, senza email, id dell'account o percorsi personali.
   - **Login.** Il login nella configurazione di prova non basta a garantire l'isolamento: prima delle catture la sessione verifica, e annota, che le letture reali siano spente.
5. **Controllo delle parole — accolto.** Niente elenco globale di parole vietate. Il test controlla le **chiavi e i componenti**: le chip con `attiva` e le schede delle viste hanno come etichetta il solo nome, in tutte e sei le lingue. Le chiavi `ui.selezionato`, `ui.nonSelezionato` e `vista.etichettaScelta` non esistono più.
6. **Censimento dei colori — accolto.**
   - **Cosa si censisce:** viste, helper, opacità locali (per esempio `vista-carico.tsx:121`) e **CSS della board**, con la sua palette, il rosso, gli RGBA e `#00BFFF`, che va solo all'icona.
   - **Due serie di gettoni.** Quelli per l'host in `tema.ts` e i valori CSS concreti della board in un blocco solo di variabili CSS, generato dagli stessi valori di base.
   - **Test.** Nessun colore e nessuna opacità scritti a mano fuori da queste due fonti.
7. **Resa — accolto.**
   - **Test strutturale.** Il test a 60 colonne resta com'è e si dichiara strutturale.
   - **Collaudo reale in più.** Si aggiunge, al terminale, con:
     - stringhe lunghe nelle sei lingue e id lunghi;
     - navigazione da tastiera su tutte le azioni;
     - il desktop a due larghezze di finestra (stretta e larga);
     - la board a 375 px e a 1280 px.

## Correzione del giro 2

- **§3 Contrasto — accolto, con la scelta più semplice.**
  - **Niente gettone «accento-testo».** Nel pannello il **testo** usa **solo l'inchiostro dell'host**: colore predefinito, `dimColor` e i colori semantici di stato dell'host dove esistono. L'accento non colora mai il testo, ma solo la grafica: bordi, barre, glifi e velo.
  - **Coppie verificate dallo script.** Lo script misura solo valori concreti:
    - l'accento grafico sugli sfondi di riferimento chiaro (`#FFFFFF`) e scuro (`#262624`), almeno 3:1 su ciascuno, con una variante per tema se serve;
    - le coppie della **board**, testo e sfondo per ogni tema CSS: almeno 4,5:1 per il testo e 3:1 per la grafica.
  - **Stati dell'host, solo al collaudo.** L'attenuazione di `dimColor`, l'hover e il fuoco li risolve il tema dell'host. Si verificano **a occhio al collaudo**, in tema chiaro e scuro, e lo script non li certifica. Il piano e il CHANGELOG lo dicono.
