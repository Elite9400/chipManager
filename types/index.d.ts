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
export type Risorse = { limiti: Limite[]; proxy: string; chiavi: { anthropic: boolean; deepseek: boolean; freellmapi: boolean } }
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
export type Destinazione = 'local' | 'cloud'

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
  /** Perché è in coda: dipendenze, corsia Codex, limite di parallelismo. */
  motivoCoda?: string
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
  errore?: string
  /** Esecuzione CLI/proxy: il gettone identifica il record privato nell'helper. */
  lanciatore?: 'cli' | 'freellmapi'
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
  fonte: string
  risorse: RisorseProgetto
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
  parziale?: string
}

/** Una sessione del progetto, aperta da una chip o a mano: solo metadati, mai testo della conversazione. */
export type SessioneProgetto = {
  id: string
  motore: 'claude' | 'codex'
  titolo: string
  ramo?: string
  modello?: string
  effort?: string
  stato: 'in-corso' | 'ferma'
  /** Percentuale della finestra di contesto usata, se letta. */
  contesto?: number
  /** Token nella finestra di contesto, se letti. */
  token?: number
  attivita?: string
  /** La sessione del pannello. */
  qui?: boolean
}
export type Sessioni = { lista: SessioneProgetto[]; letto?: string; nota?: string }
export type Vista = 'lavoro' | 'carico' | 'impostazioni'

declare module 'claude-code' {
  interface PluginState {
    'chip-manager': {
      azioni: Shaped<Azione[]>
      aperta: string | null
      vive: Shaped<Record<string, Vita>>
      avviso: string | null
      traguardi: Shaped<Traguardi | null>
      regole: Shaped<Regole | null>
      /** Ultimo scarto annullabile; `altri` quando lo scarto era di più azioni insieme. */
      annullabile: { id: string; titolo: string; altri?: string[] } | null
      filtro: string
      /** File di azioni che esistono ma non si leggono (nome e motivo). */
      illeggibili: Shaped<{ nome: string; motivo: string }[]>
      /** Questa sessione: id del transcript, progetto, modello, effort e modalità permessi effettivi. */
      contesto: Shaped<Chiamante | null>
      risorse: Shaped<Risorse>
      sessioni: Shaped<Sessioni>
      vista: Vista
      /** «Mostra tutte» nella tabella delle sessioni. */
      tutteSessioni: boolean
    }
  }
}
