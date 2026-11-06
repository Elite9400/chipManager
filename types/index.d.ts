export type Motore = 'claude' | 'codex' | 'freellmapi'
export type Revisore = 'claude' | 'codex' | 'nessuno'
export type Fornitore = Motore | 'deepseek'
export type Peso = { tipo: 'fornitore' | 'modello' | 'effort'; nome: string; percentuale: number; assoluto: number }
export type Limite = {
  id: string
  fornitore: Fornitore
  nome: string
  fonte: string
  letto?: string
  percentuale?: number
  valore?: number
  /** Il tetto di un credito nella stessa unità di `valore` («1 EUR di 4 EUR»); mai convertito in percentuale. */
  tetto?: number
  unita?: '%' | 'USD' | 'CNY' | 'EUR' | 'richieste' | 'token'
  reset?: string
  manuale?: boolean
  errore?: string
}
export type RisorseProgetto = {
  fornitori: Fornitore[]
  soloLocale: boolean
  /** GitHub è un servizio esterno: le milestone richiedono consenso distinto dai fornitori LLM. */
  milestoneGithub: boolean
  pesi: Peso[]
  limitiManuali: Limite[]
  freellmapi: { livello: 'niente' | 'R1' | 'R2'; endpoint: string }
  /** Soglie di attenzione e critica per fornitore, in percentuale di quota; null = nessuna. */
  soglie: Record<Fornitore, Soglia | null>
  /** Board di progetto in HTML: `generazione` cresce a ogni cambio di `modo` (lo incrementa l'helper sotto il lock del config). */
  board: BoardProgetto
  /** F6.2: crediti API di Claude. Assente = non configurata. Budget del mese e tetto per tentativo, in USD. */
  apiClaude?: { budgetUsd: number; tetto: number }
  /** F6.5: il consigliere di destinazione. Assente = spento. */
  consigliere?: 'suggerisci' | 'applica'
  /** Profilo di bilanciamento scelto nelle Impostazioni: tocca solo i pesi di motori ed effort. Assente = nessuna scelta. */
  profilo?: 'automatico' | 'risparmio' | 'qualita' | 'velocita' | 'personalizzato'
  /** Cresce a ogni scrittura di profilo o pesi (la incrementa l'helper). Assente = 0. */
  pesiRevisione?: number
  /** Chi ha fatto l'ultima scrittura di profilo o pesi. Assente = manuale. */
  pesiOrigine?: { tipo: 'proposta' | 'annullamento' | 'manuale'; id?: string; voce?: string; versione?: number }
}
export type PesiProfilo = { profilo: NonNullable<RisorseProgetto['profilo']> | null; pesi: Peso[] }
/** Una regolazione proposta: una delle cinque posizioni (0–4) su una voce ammessa dalle regole. */
export type Regolazione = { tipo: Peso['tipo']; nome: string; posizione: number }
/** Una proposta di pesi in `<cartella dati>/proposte-pesi.json`: la scrive solo l'helper, la decide il committente. */
export type PropostaPesi = {
  id: string
  versione: number
  progetto: string
  /** Id e titolo della sessione che propone, presi dalla sessione e mai dagli argomenti: nessuna autorità dal nome. */
  proponente: { id: string; titolo: string }
  quando: string
  motivo: string
  profilo?: NonNullable<RisorseProgetto['profilo']>
  regolazioni?: Regolazione[]
  partenza: PesiProfilo & { revisione: number }
  risultato: PesiProfilo
  stato: 'attesa' | 'applicata' | 'rifiutata' | 'scaduta' | 'annullata'
  decisione?: { id: string; esito: 'applica' | 'rifiuta'; quando: string; revisione?: number }
  annullamento?: { id: string; quando: string; revisione: number }
  nota?: string
}
export type BoardProgetto = { modo: 'spenta' | 'accesa' | 'riassunti'; generazione: number }
/** Esito di revisione riferito da una sessione: la board scrive «riferita da», mai «verificata». */
export type Revisione = {
  esito: 'in-corso' | 'approvata' | 'da-correggere'
  nota?: string
  /** Id della sessione che l'ha scritta, da `$.session.id()`, mai dagli argomenti. */
  riferitaDa: string
  quando: string
  /** Il tentativo a cui si riferisce: con un tentativo nuovo non vale più. */
  tentativo?: string
}
export type Soglia = { attenzione: number; critica: number }
export type Risorse = {
  limiti: Limite[]
  proxy: string
  chiavi: { anthropic: boolean; deepseek: boolean; freellmapi: boolean }
  /** Gruppi di limiti (vedi conUltime) letti con esito positivo anche senza nessuna misura: le loro misure precedenti escono. */
  letti?: string[]
}
export type Corsia = 'R0' | 'R1' | 'R2' | 'R3' | 'R4' | 'R5'
/**
 * Ciclo di una proposta:
 * proposta → (accodata) → in-avvio → avviata → consegnata → completata
 *                                  ↘ fallita (riprova)          scartata da proposta/accodata/fallita.
 * «consegnata» = la sessione dice di aver finito (ramo pushato, rapporto): NON sblocca le dipendenze.
 * «completata» = fusa secondo il registro dell'orchestratore, sessione archiviata o conferma del committente.
 */
export type StatoAzione =
  | 'proposta'
  | 'accodata'
  | 'in-avvio'
  | 'avviata'
  | 'consegnata'
  | 'fallita'
  | 'completata'
  | 'scartata'
/** Le opzioni della chip di sessione dell'app (start_session). */
export type Permessi = 'default' | 'acceptEdits' | 'plan' | 'auto' | 'bypassPermissions'
export type Contesto = 'fresh' | 'fork'
/** Dove gira un'azione (F6, 2.2.0): sulla macchina, nel cloud di Claude Code, o qui a crediti API di Claude. */
export type Destinazione = 'local' | 'cloud' | 'api-claude'

/** Una riga del pannello: un file JSON in `<dir azioni>/<id>.json`, scritto solo con CAS atomico. */
export type Azione = {
  id: string
  /** Contatore di scrittura: il CAS dell'helper rifiuta chi scrive su una versione vecchia. */
  versione: number
  /** Il progetto: `owner/name` del remote GitHub, o la radice del repo. Altri progetti non la vedono. */
  repo?: string
  titolo: string
  /** Il mandato che la sessione avviata riceve come prompt. */
  brief: string
  background?: string
  ordine: number
  /** Id di azioni che devono essere COMPLETATE (fuse) prima di avviare questa. */
  dipende: string[]
  esecutore: Motore
  revisore: Revisore
  modello?: string
  effort?: string
  issue?: number
  /** Corsia del processo (R0–R5). Assente: R4 se il testo tocca superfici sensibili. */
  corsia?: Corsia
  /** Solo `true` conta: un `false` non spegne l'evidenza trovata nel testo. */
  sensibile?: boolean
  /** Assente = la modalità della sessione che avvia (sulle sensibili: «accetta modifiche»). */
  permessi?: Permessi
  /** Assente = true: ogni azione nel proprio worktree. */
  worktree?: boolean
  contesto?: Contesto
  destinazione?: Destinazione
  /** Nome breve del ramo del worktree (l'app aggiunge prefisso e suffisso). */
  ramo?: string
  /** Ramo locale da cui tagliare il worktree. */
  base?: string
  /** Risveglia la sessione che avvia anche se il mandato non arriva alla nuova sessione. */
  sveglia?: boolean
  /** Id della sessione che l'ha suggerita. */
  proponente?: string
  stato: StatoAzione
  /** Stato prima dello scarto, per «Annulla». */
  statoPrima?: StatoAzione
  /** Perché è in coda: dipendenze, corsia Codex, limite di parallelismo. La frase in inglese (i record vecchi: com'era). */
  motivoCoda?: string
  /** Lo stesso motivo come codice del dizionario e parametri: il pannello lo traduce. */
  motivoCodice?: string
  motivoParametri?: Record<string, unknown>
  /**
   * Fork accodato: la sessione la cui conversazione va copiata. Solo lei lo fa ripartire (un altro pannello
   * copierebbe la SUA conversazione).
   */
  origineFork?: string
  /** Titolo leggibile della sessione d'origine del fork, per ritrovarla nella barra laterale. */
  origineNome?: string
  /** `local_…` della sessione desktop avviata. */
  sessione?: string
  /** Eseguita nella sessione del pannello («Fallo qui») invece che in una nuova. */
  qui?: boolean
  /** Sessione (id del transcript) che l'ha avviata: solo lei può affiancarla con «Apri». */
  lanciataDa?: string
  /**
   * Gettone dell'ultimo tentativo di avvio (`az-…`): va alla sessione come `name` di start_session e nel
   * mandato. Riconcilia un esito incerto e autentica gli aggiornamenti di quella sessione.
   */
  tentativo?: string
  /** Istante dell'ultimo tentativo. */
  tentatoIl?: string
  /** Ramo della sessione avviata (da get_session): lega l'azione al task del registro. */
  ramoSessione?: string
  /** Id del task del registro associato a questa azione: una volta trovato, lo si segue per id. */
  taskId?: string
  /** Esito dell'avvio non noto (errore di trasporto): il giro cerca la sessione prima di dichiararlo fallito. */
  incerto?: boolean
  /**
   * Avvio chiesto al modello di questa sessione («Chiedi a questa sessione»): il prompt può restare in coda
   * a lungo, quindi non scade da solo; lo chiudono la conferma della sessione, il ritrovamento per gettone
   * o l'annullamento esplicito del committente.
   */
  manuale?: boolean
  /** Il ripiego manuale ha preso il gettone (sta per chiamare start_session): da qui non si annulla più. */
  presa?: boolean
  /** Oltre questo istante un avvio senza sessione diventa «fallita». */
  avvioScade?: string
  avviataIl?: string
  creata: string
  aggiornata: string
  /** L'errore dell'ultimo tentativo: frase inglese o diagnostica esterna (i record vecchi: com'era). */
  errore?: string
  /** Lo stesso errore come codice e parametri, se è un messaggio proprio della mod. */
  erroreCodice?: string
  erroreParametri?: Record<string, unknown>
  /** Esecuzione CLI/proxy: il gettone identifica il record privato nell'helper. */
  lanciatore?: 'cli' | 'freellmapi' | 'api-claude'
  /** F6.2: costo stimato in USD dell'esecuzione a crediti API (`total_cost_usd`); null = ignoto (conta il tetto). */
  costoApi?: number | null
  /** F7.3: l'auditor (advisor) richiesto: alias `sonnet`, `opus`, `fable` o un id completo; assente = nessuno. */
  auditor?: string
  /** F7.3: gli avvii `api-claude` spengono l'advisor (`CLAUDE_CODE_DISABLE_ADVISOR_TOOL=1` sul solo figlio). */
  senzaAuditor?: boolean
  /** F7.3: l'advisor nell'ultima esecuzione `api-claude`, come lo ha visto il supervisore sul worktree reale. */
  advisorEsito?: { stato: 'applicato' | 'ereditato' | 'nessuno' | 'disattivato' | 'incerto'; modello?: string }
  /** F7.3: l'esecuzione è uscita subito perché l'advisor non era disponibile, e perché. */
  advisorNonDisponibile?: 'consenso' | 'escluso' | 'rifiutato'
  /** F7.3: la fonte di impostazioni che impedisce «Riavvia senza auditor» (un `env` che sovrascrive, o illeggibile). */
  senzaAuditorBloccato?: string
  /** Risultato testuale del proxy, mai eseguito; da approvare e rivedere localmente. */
  risultato?: string
  /** Piano del lavoro: percorso relativo alla radice del repo (`.md` o `.txt`), letto dall'helper. */
  piano?: string
  revisione?: Revisione
  consegnataIl?: string
  completataIl?: string
}

/** La sessione che avvia: start_session non concede modello, effort o permessi sopra i suoi. */
export type Chiamante = { io: string; repo: string | null; modello: string; effort?: string; permessi?: string; ramo?: string; titolo?: string; lanciatore?: 'desktop' | 'cli' | 'ignoto' }

/** Quello che il pannello sa, dal vivo, di una sessione avviata. */
export type Vita = {
  stato: 'in-corso' | 'ferma'
  ultimaAttivita?: string
  ramo?: string
  /** Fase nel registro dell'orchestratore: pronto, avviato, rapporto, revisione, fuso, pubblicato. */
  fase?: string
}

/** Le regole di routing.json che il pannello applica. */
/** Un messaggio della mod come codice del dizionario e parametri (si traduce), oppure testo esterno mostrato com'è. */
export type Messaggio = { k: string; p?: Record<string, unknown> } | string

export type Regole = {
  /** false: routing.json non letto → nessun avvio (mai regole allentate in silenzio). */
  lette: boolean
  modelli: { claude: string[]; codex: string[]; freellmapi: string[] }
  effort: string[]
  tetto: Record<string, string>
  /** autore → revisori ammessi (`motore:codex` per Codex). */
  revisori: Record<string, string[]>
  /** routing.json → corsia_codex: dove Codex esegue, con che effort, chi lo rivede. */
  corsiaCodex: { corsie: string[]; effort: Record<string, string>; rivistoDa: Record<string, string> }
  /** Termini (espressioni regolari) che rendono sensibile un'azione oltre a quelli generici: dalla configurazione locale. */
  sensibili: string[]
  /** Contesto fisso del mandato locale per questo progetto (il cloud riceve sempre quello generico). */
  background: string
  /** Da dove vengono le regole lette («routing.json v3»); vuota se non lette. */
  fonte: string
  /** Perché le regole non si leggono: codice del dizionario o testo esterno. */
  motivo?: Messaggio
  risorse: RisorseProgetto
  /** F6.2: la chiave API di Claude è nelle opzioni sensibili della mod (solo la presenza, mai il valore). */
  chiaveApi?: boolean
}

/** F6.2: perché il lock della corsia API resta tenuto: uscita non registrata, discendenti, file-chiave, cache della chiave. */
export type LockApi = { motivo: 'in-corso' | 'senza-pid' | 'discendenti' | 'chiave' | 'cache' | 'illeggibile' | 'mutex'; tentativo?: string; discendenti?: string[]; restaMs?: number }

/** F6.7: il controllo della sezione Esecuzione. Solo stati sì/no, metodo e host: mai email, nomi o identificativi. */
export type ControlloEsecuzione = {
  claude: { trovato: boolean; loggedIn?: boolean; metodo?: string }
  github: { trovato: boolean; loggedIn: boolean; remote: boolean; host?: string }
  /**
   * Le fonti che bloccano `api-claude`, dallo stesso controllo dell'avvio (file dell'helper e fonti dell'host): il file, le
   * chiavi di impostazione responsabili (mai i valori), o `illeggibile`. `ambiente` è la variabile ANTHROPIC_API_KEY.
   */
  fonti: { nome: 'utente' | 'progetto' | 'locale' | 'gestite' | 'flag' | 'ambiente'; file?: string; chiavi?: string[]; illeggibile?: boolean }[]
}
export type TipoAccesso = 'claude' | 'gh'
export type PassoEsecuzione = 'claude' | 'github' | 'chiave' | 'fonti' | 'budget'
/** F6.7: l'ultimo controllo, i login avviati da qui (fino a quando si ricontrolla), la riga da copiare, la procedura guidata. */
export type StatoEsecuzione = {
  controllo?: ControlloEsecuzione
  fallito?: boolean
  inCorso?: boolean
  accessi?: Partial<Record<TipoAccesso, { fino: number; codice?: string }>>
  copia?: { tipo: TipoAccesso; riga: string }
  guida?: { saltati: PassoEsecuzione[] }
}

/** Una milestone GitHub aperta del repo della sessione. */
export type Traguardo = {
  numero: number
  titolo: string
  aperte: number
  chiuse: number
  scadenza: string | null
  /** Issue chiuse negli ultimi 14 giorni: il ritmo per stimare l'arrivo. */
  chiuseRecenti?: number
}
export type Traguardi = {
  repo: string
  lista: Traguardo[]
  /** issue → numero di milestone (null: nessuna), riletto a ogni aggiornamento per le azioni attive. */
  milestoneDi: Record<string, number | null>
  letto: string
  errore?: string
  /** Rotazione sulle issue quando sono più di quante se ne leggono a giro. */
  cursore?: number
  /** Copertura parziale dichiarata (troppe milestone o issue per un giro). */
  parziale?: Messaggio
}

/** Una sessione del progetto, aperta da una chip o a mano: solo metadati, mai testo della conversazione. */
export type SessioneProgetto = {
  id: string
  motore: 'claude' | 'codex'
  titolo: string
  ramo?: string
  modello?: string
  effort?: string
  /** `ignota`: turno non noto (Codex dopo un salto d'arretrato senza eventi di turno): né in corso né ferma, si mostra «—». */
  stato: 'in-corso' | 'ferma' | 'ignota'
  /** Percentuale della finestra di contesto usata, se letta. */
  contesto?: number
  /** Istante dell'ultima misura RIUSCITA del contesto (distinto dalla lettura della sessione). */
  contestoIl?: string
  /** Token nella finestra di contesto, se letti. */
  token?: number
  attivita?: string
  /** La sessione del pannello. */
  qui?: boolean
}
export type Sessioni = { lista: SessioneProgetto[]; letto?: string; nota?: string }
/** Il consumo di QUESTA sessione negli ultimi 10 minuti (D6): processi, chiamate all'app, byte letti dall'helper Codex, salti. */
/** Il consumo di questa sessione negli ultimi 10 minuti; `comandi` divide i processi per comando (D6). */
export type Consumo = { processi: number; app: number; byte: number; byteLimiti: number; salti: number; comandi?: Record<string, number>; da: number }
export type Vista = 'lavoro' | 'carico' | 'impostazioni'
/** Ciò che il pannello sa della board: il file scritto dall'helper, perché non si scrive, stato dei riassunti. */
export type StatoBoard = { percorso?: string; motivo?: string; riassunti?: string }
/**
 * F7.1: una proposta di impostazioni di una sessione, come la scrive l'helper dopo averla rivalidata. Solo i campi dello
 * schema; parziale: la bozza la completa con i valori correnti.
 */
export type PropostaImpostazioni = {
  motivo: string
  profilo?: NonNullable<RisorseProgetto['profilo']>
  soglie?: Partial<Record<Fornitore, Soglia | null>>
  board?: { modo: BoardProgetto['modo'] }
  consigliere?: 'spento' | 'suggerisci' | 'applica'
  apiClaude?: { budgetUsd?: number; tetto?: number }
  lingua?: 'en' | 'it' | 'es' | 'fr' | 'de' | 'pt'
}
export type VoceImpostazioni = { id: string; quando: string; proponente: { id: string; titolo: string }; proposta: PropostaImpostazioni }

/** La vista Impostazioni: sezione aperta, ultimo errore in linea e procedure guidate fatte in linea (popup rifiutato). */
export type StatoImpostazioni = {
  sezione: 'connessioni' | 'soglie' | 'bilanciamento' | 'progetto' | 'board' | 'avanzate' | 'esecuzione' | 'lingua' | 'legenda'
  errore?: { dove: string; testo: Messaggio }
  guida?: Fornitore
  bozza?: { fornitore?: Fornitore; tipo?: string }
  regola?: boolean
  gruppo?: 'fornitore' | 'modello' | 'effort'
  /** F5.9: le modifiche non ancora applicate; solo in memoria della sessione, mai su disco. */
  pendenti?: Pendenti
  /** Vero mentre «Applica» scrive: la barra dice «Salvataggio in corso…» e la bozza è ferma. */
  applicando?: boolean
  /** Cresce a ogni modifica della bozza e a ogni «Applica» avviato e concluso: un'azione dopo un'attesa la confronta. */
  epoca?: number
  /** F7.1: la proposta di una sessione presa dal file, in attesa che la bozza si svuoti (al più una). */
  propostaInCoda?: VoceImpostazioni
  /** F7.1: la proposta che ha riempito la bozza (la fascia la mostra finché la bozza ha campi suoi). */
  proposta?: { id: string; da: string; motivo: string }
}
/**
 * La bozza delle Impostazioni: campi del progetto come li scrive `configura`, il loro valore al primo tocco, i controlli
 * toccati, la lingua (pendente solo se diversa da quella salvata quando la si sceglie). Ferma mentre «Applica» scrive.
 */
export type Pendenti = {
  campi: Record<string, unknown>
  base: Record<string, unknown>
  dove: string[]
  lingua?: 'en' | 'it' | 'es' | 'fr' | 'de' | 'pt'
  /** F7.1: la lingua salvata quando una proposta l'ha messa in bozza; se intanto è cambiata altrove, Apply lo dice. */
  linguaBase?: 'en' | 'it' | 'es' | 'fr' | 'de' | 'pt'
}

declare module 'claude-code' {
  interface PluginState {
    'chip-manager': {
      azioni: Shaped<Azione[]>
      aperta: string | null
      /** F6.1: le chip scelte per «Dove…» su più chip insieme (id). */
      selezionate: Shaped<string[]>
      /** F6.2: il lock della corsia API della macchina, se resta tenuto (null = libero). */
      lockApi: Shaped<LockApi | null>
      /** F6.7: lo stato della sezione Esecuzione (controllo ✓/✗, login in corso, procedura guidata). */
      esecuzione: Shaped<StatoEsecuzione>
      /** F6.4: la spesa a crediti API del mese (stimata), dal registro dell'helper; null = non configurata o illeggibile. */
      spesaApi: Shaped<{ mese: string; speso: number | null } | null>
      vive: Shaped<Record<string, Vita>>
      /** L'ultimo errore di un pulsante: codice del dizionario (si traduce) o testo esterno. */
      avviso: Messaggio | null
      traguardi: Shaped<Traguardi | null>
      regole: Shaped<Regole | null>
      /** Ultimo scarto annullabile; `altri` quando lo scarto era di più azioni insieme. */
      annullabile: { id: string; titolo: string; altri?: string[] } | null
      filtro: string
      /** File di azioni che esistono ma non si leggono (nome e motivo). */
      illeggibili: Shaped<{ nome: string; motivo: Messaggio }[]>
      /** Questa sessione: id del transcript, progetto, modello, effort e modalità permessi effettivi. */
      contesto: Shaped<Chiamante | null>
      risorse: Shaped<Risorse>
      /** Ultima misura valida per id di limite: un giro fallito non la cancella. */
      ultimeMisure: Shaped<Record<string, Limite>>
      sessioni: Shaped<Sessioni>
      vista: Vista
      /** «Mostra tutte» nella tabella delle sessioni. */
      tutteSessioni: boolean
      board: Shaped<StatoBoard>
      consumo: Shaped<Consumo>
      impostazioni: Shaped<StatoImpostazioni>
      /** Le proposte di pesi di questo progetto, lette dal file dell'helper. */
      proposte: Shaped<PropostaPesi[]>
      /** La lingua dell'interfaccia: dell'utente (primo livello del config), non del progetto. */
      lingua: 'en' | 'it' | 'es' | 'fr' | 'de' | 'pt'
    }
  }
}
