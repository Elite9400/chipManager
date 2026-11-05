# Piano — chipManager 2.2: dashboard di gestione del lavoro

Stato: **in corso**. F0, F1 e F2 sono consegnate sul ramo di sviluppo e aspettano la fusione. Il 5 novembre 2026 il
committente ha chiesto anche una board di progetto in HTML e viste di lavoro che mostrino solo ciò che è
configurato: quel piano lo scrive a parte la sessione master. Qui c'è la legenda per chi è nuovo (B10, §6).
Sviluppo in una sessione aperta su questa cartella, non da un progetto che usa la mod: le chip del lavoro sulla
mod restano di questo repository.

Fonti del metodo: impeccable (`shape`, modo *Operate*), design-taste-frontend (`references/app-screens.md`),
ui-ux-pro-max (accessibilità, interazione, form). Il mondo visivo **non** si inventa: il pannello vive dentro
Claude Code e ne eredita tema, caratteri ed elementi. Il torneo di direzioni visive di impeccable quindi non
si applica; il lavoro è sulla struttura, sulle informazioni e sui comportamenti.

## 1. Cosa non va oggi (con le prove)

| # | Problema | Causa nel codice |
|---|---|---|
| D1 | **Chip estranee al progetto.** Due chip «DEMO» delle prove comparivano in ogni progetto. | `pannello.tsx:106` mostra anche le azioni **senza** `repo` («scritte dalla versione precedente»). In più la cartella dei dati (`cartella` in `config.json`) è **una sola per tutti i progetti**: la separazione è solo un filtro in lettura. |
| D2 | **La soglia di Claude non si vede, quella di Codex sì.** | `usoDesktop` (`hooks/risorse.ts`) cerca `rate_limits.five_hour` / `seven_day`, ma `get_usage` dell'app oggi risponde `plan.windows[{ label, percentUsed, resetsAt }]` + `extraUsage`: il parser scarta tutto e resta il ripiego `statusline.json`, che senza un hook manuale non esiste → «fonte non disponibile». Codex invece si legge da solo dalle sessioni locali. |
| D3 | **Pesi vuoti e difficili.** | Nessun predefinito (`pesi: []`). Le impostazioni chiedono due numeri («incremento %», «incremento assoluto») per ogni fornitore, modello ed effort: circa 26 campi e una formula da leggere. Nessun adattamento al progetto o ai limiti, nessuno strumento per la master. |
| D4 | **Impostazioni in un blocco unico.** | Politica, chiavi, Docker, pesi e note stanno in un solo riquadro dentro il flusso del pannello; i budget manuali si scrivono solo nel JSON; nessuna procedura guidata; nessun popup. |
| D5 | **Grafica piatta e rumorosa.** | Tutto è una colonna di schede con fino a 6 etichette colorate ciascuna (stato, motore, modello, effort, revisore, milestone: sei tinte per scheda). Prima delle chip, cinque limiti su due righe spingono il lavoro fuori schermo. Le sessioni aperte a mano non compaiono. Nel terminale ogni scheda ha il suo bordo arrotondato. |

## 2. Decisioni prese

- **Prima vista**: «chi fa cosa adesso».
- **Pesi della master**: la master **propone**, la persona **conferma** in un popup.
- **Sessioni mostrate**: **tutte** quelle del progetto, anche quelle aperte a mano.

## 3. Brief

- **Chi e quando.** Una persona che coordina più agenti sullo stesso progetto. Pannello aperto per ore,
  guardato a colpo d'occhio; usato davvero per decidere.
- **La domanda della schermata**: *chi sta lavorando su cosa, adesso, e dove c'è margine?*
  La risposta è il blocco più grande. Sotto il titolo, **una riga di sintesi** calcolata, ad esempio:
  «3 al lavoro · 1 aspetta te · Claude settimanale 49% · Codex 41%».
- **Il lavoro più frequente a un clic**: avviare la prossima chip, oppure sbloccare quella ferma.
- **Anti-obiettivi.** Nessun cruscotto «da template» (tessere di KPI con icone, sparkline, arcobaleni).
  Nessun gradiente, bagliore o emoji. Nessun dato inventato: ciò che manca è un trattino grigio con il motivo.
  Le guardie (R4, cloud, registro, segreti) non si toccano. Il nome del plugin non cambia ancora.

## 4. Struttura

Tre viste nello stesso pannello, scelte da una riga di pulsanti in alto. La vista attiva ha l'etichetta
in inchiostro e semibold, le altre in grigio. Tasti `1` `2` `3`. La vista scelta resta in un atomo di stato.

### 4.1 Lavoro (predefinita)

Ordine di lettura:

1. **Intestazione.** «chipManager · <owner/repo>», la riga di sintesi, «Aggiorna» con l'ora dell'ultima lettura.
2. **Aspettano te** (solo se non è vuota). Una riga per chip ferma o fallita, con l'azione che la sblocca
   sulla riga stessa. Viene prima della tabella perché scade.
3. **Al lavoro adesso.** Tabella delle sessioni del progetto: quelle delle chip più quelle aperte a mano,
   Claude e Codex. Colonne:
   - **Lavoro**: titolo della chip o della sessione; su una seconda riga grigia il ramo;
   - **Chi**: segno del motore e nome;
   - **Modello**;
   - **Effort**: `▰▰▰▱` e la parola;
   - **Stato**: un pallino e una parola, un solo segno di stato per riga;
   - **Contesto**: token usati sulla finestra, in percentuale, numeri allineati a destra;
   - **Attività**: tempo relativo.

   Al massimo 6 righe, poi «Mostra tutte · N».
4. **Da avviare e in coda.** Righe compatte numerate per ordine di avvio. Riga 1: titolo e dipendenza.
   Riga 2, grigia: «Codex · GPT-6 Astra · xhigh · rivede Claude». Azioni sulla riga: «Avvia» (secondario)
   e «Dettagli», che apre l'editor in linea. Nell'intestazione della sezione c'è **l'unico primario del
   pannello**, «Avvia tutte · N».
5. **Da fondere.** Le consegnate, con «Apri» e «Segna completata».
6. **Verso il rilascio.** Le milestone: una riga con la barra al rapporto vero, entrambi gli estremi
   etichettati, la stima di arrivo.

### 4.2 Carico

Questa vista risponde a «quale modello fa cosa, con quale effort, e quanto ne resta».

- **Matrice modello × effort.** Ogni cella conta le sessioni al lavoro in inchiostro e quelle in coda in
  grigio. Un solo colore, a intensità diverse. Sul desktop è una griglia `Svg`, nel terminale una tabella
  di testo.
- **Limiti per fornitore.** Una barra al rapporto vero per ogni finestra:
  - Claude: 5 ore, settimanale, settimanale per modello, uso extra;
  - Codex: finestra primaria e secondaria;
  - saldi e budget manuali.

  Ogni barra ha una riga grigia con fonte, età e reset. Le soglie sono colorate per fornitore.
  Un dato vecchio diventa grigio e dice perché.
- **Token.** Una barra sottile per ogni sessione attiva, con la percentuale della finestra di contesto
  usata. Accanto il totale per modello.
- **Pesi in uso.** Il profilo attivo detto a parole («Automatico: preferisce Codex finché Claude
  settimanale supera il 70%»). Sotto, per ogni fornitore, la quota prevista e la quota effettiva delle
  ultime 24 ore.

### 4.3 Impostazioni

Ogni sezione è una riga: titolo e descrizione a sinistra, controlli a destra; sul terminale si impilano.
**Un solo modello di salvataggio**: ogni controllo salva da sé e conferma con un toast «Salvato».

1. **Connessioni e soglie.** Una riga per fornitore con lo stato:
   - **Collegato**, con la fonte e l'età;
   - **Da collegare**, con il pulsante «Collega…»;
   - **Non disponibile qui**, con il motivo.

   «Collega…» apre una **procedura guidata a popup** (`$.ui.ask`) con un passo per volta:
   - **Claude desktop**: automatico, niente da fare.
   - **Claude da terminale**: si propone di aggiungere la riga della status line, mostrando il comando
     e chiedendo conferma prima di scrivere le impostazioni.
   - **DeepSeek e Anthropic Admin**: la chiave va nel campo segreto di `/config`. Il popup lo dice e poi
     verifica il collegamento.
   - **FreeLLMAPI**: i passi Docker esistenti.

   **Soglie per fornitore**: scelte da `Select` con preset (60/80, 70/90, 80/95, nessuna), non numeri
   liberi. **Budget manuali**: un popup guidato (fornitore → tipo → valore) al posto del JSON.
2. **Bilanciamento.** Un `Select` di profilo, poi «Regolazioni avanzate» chiuse per difetto. I profili:
   - **Automatico (consigliato)**;
   - **Risparmio**;
   - **Qualità**;
   - **Velocità**;
   - **Personalizzato**.

   Nelle avanzate ogni fornitore, modello ed effort ha un `Select` a cinque gradi (Evita · Meno ·
   Normale · Più · Preferisci) invece di due campi numerici.

   **Anteprima del risultato** accanto al controllo: «Con questo profilo la prossima chip andrebbe a:
   Codex · GPT-6 Astra · high».
3. **Progetto.**
   - Fornitori ammessi.
   - Solo rete locale.
   - Milestone GitHub.
   - Cartella dei dati di questo progetto.
   - Termini sensibili e contesto: solo lettura, con il percorso del file da cui vengono.
4. **FreeLLMAPI.** Sezione chiusa per difetto: livello d'uso, endpoint, installazione.

### 4.4 Popup: quando sì e quando no

Si usa `$.ui.ask` (da 2 a 4 scelte più «Altro») **solo** per:

- confermare una proposta di pesi della master;
- i passi delle procedure guidate;
- un «Avvia tutte» che supererebbe una soglia critica o manderebbe lavoro al cloud;
- la pulizia una tantum delle chip senza progetto.

Mai per navigare. Lo scarto resta com'è oggi: si fa subito e si annulla dal toast.
Se `ask` viene rifiutato (chiuso, o esecuzione `-p`), si ricade su una richiesta in linea nel pannello.

## 5. Le due superfici

**Desktop**

- Colore sui dati, non sulla cornice:
  - stato: pallino più parola;
  - motore: solo il segno, nel colore del fornitore;
  - modello ed effort: in inchiostro, con le tacche dell'effort piene in inchiostro e vuote in grigio.

  Spariscono i veli colorati sotto ogni etichetta e la mappa di sei colori per modello.
- Cifre sempre tabulari, allineate a destra.
- `Svg` solo per barre e matrice.
- Bordo acceso **solo** sulla riga che aspetta una decisione.
- Densità media: righe da 44 a 56 px, didascalie grigie.

**Terminale**

- Stesse viste e stessi tasti: `1` `2` `3`, `a` avvia tutte, `r` aggiorna.
- Niente bordo per scheda: le righe sono separate dallo spazio, le colonne allineate con larghezze fisse.
- Barre `█░` da 20 celle con entrambi gli estremi etichettati.
- Sotto 80 colonne cadono «Contesto» e «Attività», e modello ed effort si uniscono in una colonna.
- Il colore non è mai l'unico segnale: ogni stato ha il suo segno e la sua parola.

Abbozzo della prima schermata (desktop, dati d'esempio):

```
chipManager · owner/repo                                            Aggiorna · 17:02
3 al lavoro · 1 aspetta te · Claude settimanale 49% · Codex 41%
[ Lavoro ]  Carico   Impostazioni

Aspettano te  1
  ▲ Migrazione indici: avvio fallito (worktree occupato)            Riprova   Dettagli

Al lavoro adesso  3                                                      Mostra tutte
  Lavoro                       Chi       Modello        Effort        Stato      Contesto  Attività
  Guida delle API              ◆ Claude  Sonnet 5.5     ▰▰▱▱ medium   ● In corso     34%    2 min
    docs-api
  Filtro di ricerca            ◆ Codex   GPT-6 Astra    ▰▰▰▰ xhigh    ● In corso     61%    adesso
    fix-ricerca
  Revisione sessione (a mano)  ◆ Claude  Opus 5.5       ▰▰▰▱ high     ◐ Ferma        12%    18 min

Da avviare  2                                                       [ Avvia tutte · 2 ]
  1  Test per il filtro · dopo «Filtro di ricerca»                       Avvia  Dettagli
     Codex · GPT-6.1 Sol · high · rivede Claude
```

## 6. Dati e logica (cosa cambia sotto)

- **B1. Separazione dei progetti.**
  - **Cartella per progetto.** Si cerca in questo ordine: `CHIPMANAGER_DIR`, poi
    `progetti[repo].cartella`, poi la `cartella` globale (per compatibilità), poi
    `~/.claude/chipmanager/progetti/<owner>__<repo>`.
  - **Chip senza progetto**: non si mostrano più da nessuna parte. All'apertura, una volta sola, un popup
    chiede se assegnarle al progetto corrente o scartarle. Lo scarto è reversibile.
  - **Configurazione locale**: si sposta la `cartella` globale nella sezione del progetto che la usa.
    È una modifica a `~/.claude/chipmanager/config.json`, non al repository; prima si fa una copia di
    sicurezza.
- **B2. Limiti Claude dall'app.**
  - `usoDesktop` legge `plan.windows[]`: un limite per finestra, con `id` ricavato dall'etichetta,
    percentuale e reset; più `extraUsage` (speso / tetto, in EUR).
  - `status: not_applicable | unavailable` diventa un errore con la nota.
  - Il vecchio formato resta accettato.
  - I test usano la forma reale, con valori finti.
- **B3. Sessioni del progetto.**
  - Claude: `list_sessions` filtrato per `cwd` dentro la radice del repo o dei suoi worktree; poi
    `get_session` (modello, effort, ramo) e `get_usage(session_id)` (contesto), solo sulle sessioni
    attive.
  - Codex: dai file locali di `~/.codex/sessions`, che hanno `cwd`, `model`, `effort`, `token_count` e
    `context_window`. Lo legge l'helper Node, con risposte minimali e nessun testo della conversazione.
  - Lettura ogni 20 s per lo stato, ogni 60 s per i token, con cache.
- **B4. Pesi a profili.**
  - Funzione pura `pesiEffettivi(profilo, regolazioni, regole, limiti, sessioni)` in `logica.ts`.
  - **Automatico** si adatta al progetto e al momento:
    - modelli ed effort ammessi da `routing.json`;
    - penalità proporzionale vicino alla soglia del fornitore, esclusione oltre la soglia critica salvo
      scelta esplicita;
    - effort più basso sulle corsie leggere;
    - preferenza per i modelli con meno sessioni e meno token in uso.
  - In `config.json` si salvano `profilo` e `regolazioni`. I `pesi` esistenti diventano «Personalizzato».
- **B5. Strumento `proponi_pesi`** per la master.
  - Argomenti: profilo oppure regolazioni, più il motivo.
  - Il pannello apre il popup, ad esempio: «La sessione «Master» propone: Codex Più, Opus Meno.
    Motivo: Claude settimanale 49%. Applico?», con «Applica», «Rifiuta» e «Rivedi nelle impostazioni».
  - Dopo l'applicazione resta una riga di registro nella vista Carico, con chi e quando, e «Annulla».
  - Senza conferma non cambia nulla.
- **B6. `risorse_agenti` più ricco.** Aggiunge sessioni al lavoro per modello ed effort, token di
  contesto, profilo e soglie: la master decide anche in base ai token.
- **B7. Soglie per fornitore** (predefinite 70/90). Le usano i colori, la sintesi, la conferma di
  «Avvia tutte» e il bilanciamento.
- **B10. Legenda per chi è nuovo** (richiesta del 5 novembre 2026, nella revisione grafica). Ogni sigla e ogni
  termine tecnico ha una spiegazione in parole semplici, dove serve:
  - **corsie** R0–R5: che cosa vuol dire ciascuna, chi le esegue e perché R4 e R5 restano a Claude;
  - **fasi** del piano (F0–F5) e **blocchi** di lavoro (B1–B10), nel README e nel piano;
  - **termini**: effort, worktree, fork, fusione, registro, MCP, PII, soglia di attenzione e critica, contesto,
    token, cartella condivisa, cloud;
  - **dove**: una voce «Legenda» nel pannello (vista Impostazioni, e un rimando breve dalla riga che usa la
    sigla), una sezione «Legenda» in README italiano e inglese, e la stessa legenda nella board di progetto quando ci sarà;
  - una sola fonte per il testo, così pannello, README e board non si contraddicono.

## 7. Fasi e rilasci

Ogni fase è un rilascio con la sua voce nel CHANGELOG, i test e le immagini aggiornate con dati d'esempio.

| Fase | Versione | Contenuto | Fatto quando |
|---|---|---|---|
| F0 | 2.1.1 | B2 (limiti Claude) e la parte di B1 che nasconde le chip senza progetto | Claude piano visibile sul desktop; nessuna chip senza progetto in vista; test sul nuovo formato. |
| F1 | 2.2.0 | B1 completo, B3, vista **Lavoro**, layout del terminale | Tabella con le sessioni anche aperte a mano; prima schermata come l'abbozzo, desktop e terminale. |
| F2 | 2.3.0 | Vista **Carico**, B7 | Matrice e limiti al rapporto vero; soglie per fornitore in uso. |
| F2b | 2.3.1 | Limiti: solo ciò che è configurato (`PIANO-board.md`, parte A) | Nelle viste operative nessuna riga per fornitori vietati o mai misurati. |
| F2c | 2.4.0 | **Board di progetto** in HTML (`PIANO-board.md`, parte B) | Board accesa da Impostazioni, «Apri board», schede con piano, mandato, processo e revisione. |
| F3 | 2.5.0 | **Impostazioni** riprogettate, procedure guidate, popup | Ogni connessione si collega senza toccare JSON; budget manuali da popup. |
| F4 | 2.6.0 | B4, B5, B6 | Profilo Automatico predefinito; proposta della master confermata in popup; `risorse_agenti` con i token. |
| F5 | — | Rifinitura e revisione grafica; **B10** legenda | `impeccable critique` e `audit` sulle catture, README e GIF aggiornati; un neofita trova il significato di ogni sigla senza uscire dal pannello. |

**Verifica di ogni fase**:

- `claude plugin validate .`;
- `claude plugin test .`;
- `node --test strumenti/prova-disco.cjs`;
- `tsc -p .`;
- catture desktop e terminale con dati d'esempio, mai dati reali di un progetto;
- una revisione indipendente del diff prima del rilascio.

## 8. Rischi e decisioni aperte

- **`get_usage` non ha un contratto tipizzato.** Il parser accetta solo forme note e, nel dubbio, mostra
  «non disponibile» con il motivo. Non inventa mai una percentuale.
- **Costo delle letture per sessione.** Si interrogano solo le sessioni attive, con un tetto e la cache.
- **Il pannello non ha schede né finestre native.** Le viste sono pulsanti; i popup sono `$.ui.ask`,
  con 4 scelte al massimo.
- **`Svg` c'è solo sul desktop e in VS Code.** Il terminale ha il suo disegno di testo, non un ripiego
  povero.
- **Il repository è pubblico.** Documenti, test e immagini non nominano progetti o dati reali di chi
  usa la mod.
- **Da decidere in F4**: i valori esatti dei profili (Risparmio, Qualità, Velocità) si tarano sui
  dati di una settimana d'uso, non a tavolino.
