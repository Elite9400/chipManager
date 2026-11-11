// Logica pura delle Impostazioni (piano grafica, C2 con §9 righe 4, 5 e 7 e §10): profili di bilanciamento, regolazioni
// a cinque posizioni, soglie, budget manuali e simulazione della scelta. Niente `$`: i test la provano senza engine.
import type { Azione, Chiamante, Fornitore, Limite, Pendenti, Peso, PesiProfilo, PropostaImpostazioni, PropostaPesi, Regolazione, Regole, RisorseProgetto, SessioneProgetto, Soglia } from '../types'
import { ALIAS_UNITA, data, eMsg, errore, LINGUE, msg, t } from './lingua'
import type { Chiave, Lingua, Msg } from './lingua'
import { bilancia, corsiaDi, effortDi, FORNITORI, idAuditor, modelloDi, modoNonValido, motivoAuditor, nomeModello, pesoValido, profiloDi, rangoModello, restrizioneLarga, restrizioniDa, risorseDa, violazioni, violazioniAvvio } from './logica'

export type Profilo = NonNullable<RisorseProgetto['profilo']>

// --- regolazioni a cinque posizioni --------------------------------------------------------------------

/** Le cinque posizioni di una regolazione: `percentuale` del peso, `assoluto` sempre 0. «Molto meno» non esclude. */
export const POSIZIONI = [
  { nome: 'pos.moltoMeno', percentuale: -90 },
  { nome: 'pos.meno', percentuale: -40 },
  { nome: 'pos.normale', percentuale: 0 },
  { nome: 'pos.piu', percentuale: 40 },
  { nome: 'pos.preferisci', percentuale: 100 },
] as const satisfies readonly { nome: Chiave; percentuale: number }[]
const NORMALE = 2

/** La posizione di un peso, -1 se è fuori dalle cinque (personalizzato: si mostra intero e resta intatto). Assente = Normale. */
export function posizioneDi(p: Peso | undefined) {
  if (!p) return NORMALE
  return p.assoluto === 0 ? POSIZIONI.findIndex(x => x.percentuale === p.percentuale) : -1
}

/** Come si legge un peso fuori dalle cinque posizioni: entrambi i componenti, con il segno. */
export const pesoScritto = (p: Peso, l: Lingua) =>
  t(l, 'pos.personalizzato', { valore: `${p.percentuale >= 0 ? '+' : ''}${p.percentuale}% · ${p.assoluto >= 0 ? '+' : ''}${p.assoluto}` })

/** I pesi con la voce `tipo:nome` alla posizione `i`; Normale toglie la voce. Le altre voci restano come sono. */
export function conPosizione(pesi: readonly Peso[], tipo: Peso['tipo'], nome: string, i: number): Peso[] {
  const pos = POSIZIONI[i]
  if (!pos) throw errore('pos.nonValida')
  const altri = pesi.filter(p => p.tipo !== tipo || p.nome !== nome)
  return i === NORMALE ? altri : [...altri, { tipo, nome, percentuale: pos.percentuale, assoluto: 0 }]
}

// --- profili ------------------------------------------------------------------------------------------

const peso = (tipo: Peso['tipo'], nome: string, i: number): Peso => ({ tipo, nome, percentuale: POSIZIONI[i]!.percentuale, assoluto: 0 })

/**
 * Insiemi fissi di pesi su motori ed effort, mai sui modelli: l'ordine di routing.json non dice nulla sulle capacità.
 * Automatico = nessuna preferenza fissa, decide il margine dei limiti. Personalizzato non ha pesi propri.
 */
export const PROFILI: readonly { id: Profilo; nome: Chiave; descrizione: Chiave; pesi?: readonly Peso[] }[] = [
  { id: 'automatico', nome: 'profilo.automatico', descrizione: 'profilo.automatico.descrizione', pesi: [] },
  {
    id: 'risparmio', nome: 'profilo.risparmio', descrizione: 'profilo.risparmio.descrizione',
    pesi: [peso('fornitore', 'codex', 3), peso('effort', 'low', 3), peso('effort', 'high', 1), peso('effort', 'xhigh', 0)],
  },
  {
    id: 'qualita', nome: 'profilo.qualita', descrizione: 'profilo.qualita.descrizione',
    pesi: [peso('effort', 'xhigh', 4), peso('effort', 'high', 3), peso('effort', 'medium', 1), peso('effort', 'low', 0)],
  },
  {
    id: 'velocita', nome: 'profilo.velocita', descrizione: 'profilo.velocita.descrizione',
    pesi: [peso('effort', 'low', 4), peso('effort', 'medium', 3), peso('effort', 'high', 1), peso('effort', 'xhigh', 0)],
  },
  { id: 'personalizzato', nome: 'profilo.personalizzato', descrizione: 'profilo.personalizzato.descrizione' },
]

/** I pesi dopo la scelta di un profilo: quelli di motori ed effort diventano i suoi, quelli dei modelli restano intatti. */
export function conProfilo(pesi: readonly Peso[], profilo: Profilo): Peso[] {
  const p = PROFILI.find(x => x.id === profilo)
  if (!p) throw errore('profilo.nonValido')
  if (!p.pesi) return [...pesi]
  return [...pesi.filter(x => x.tipo === 'modello'), ...p.pesi]
}

// Una sola risoluzione del profilo: sta in logica (la usa `punteggio`), qui solo riesportata.
export { profiloDi }

// --- soglie -------------------------------------------------------------------------------------------

export const SOGLIE_PRESET: readonly { valore: string; testo: Chiave; soglia: Soglia | null }[] = [
  { valore: '60/80', testo: 'soglia.6080', soglia: { attenzione: 60, critica: 80 } },
  { valore: '70/90', testo: 'soglia.7090', soglia: { attenzione: 70, critica: 90 } },
  { valore: '80/95', testo: 'soglia.8095', soglia: { attenzione: 80, critica: 95 } },
  { valore: 'nessuna', testo: 'soglia.nessuna', soglia: null },
]

/** Il preset di una soglia, '' se è personale (resta così com'è). */
export const presetDi = (s: Soglia | null) =>
  SOGLIE_PRESET.find(p => (p.soglia === null ? s === null : !!s && p.soglia.attenzione === s.attenzione && p.soglia.critica === s.critica))?.valore ?? ''

/** Le soglie con quella di `f` cambiata. Vale lo stesso vincolo della lettura: numeri finiti da 1 a 100, attenzione sotto la critica. */
export function conSoglia(soglie: RisorseProgetto['soglie'], f: Fornitore, s: Soglia | null): RisorseProgetto['soglie'] {
  const ok = (n: number) => typeof n === 'number' && Number.isFinite(n) && n >= 1 && n <= 100
  if (s && (!ok(s.attenzione) || !ok(s.critica))) throw errore('soglia.fuoriScala')
  if (s && s.attenzione >= s.critica) throw errore('soglia.ordine', { attenzione: s.attenzione, critica: s.critica })
  return { ...soglie, [f]: s }
}

// --- budget manuali -----------------------------------------------------------------------------------

/** I tipi di budget: identificatori salvati nel config (il nome del limite), mostrati con la chiave `budget.<tipo>`. */
export const TIPI_BUDGET = ['giornaliero', 'settimanale', 'mensile'] as const
/** La parola «usato» nelle sei lingue, dall'etichetta «{pct}% usato» dei dizionari. */
const USATO = new Set(LINGUE.map(l => t(l, 'car.usato', { pct: 0 }).replace(/^0%\s*/, '').toLowerCase()))
/** Il nome di un limite: un tipo di budget si traduce, ogni altro nome (dei fornitori) resta com'è. */
export const nomeLimite = (nome: string, l: Lingua) => ((TIPI_BUDGET as readonly string[]).includes(nome) ? t(l, `budget.${nome as (typeof TIPI_BUDGET)[number]}`) : nome)

/**
 * «40», «40%» o «40% usato» (la parola «usato» di una delle sei lingue) = quota usata; «12 USD», «500 richieste», «1000 token» = valore. Le unità si scrivono in una qualunque delle
 * sei lingue (`ALIAS_UNITA`) e si salvano sempre con lo stesso nome. Restituisce il motivo se non si legge.
 */
export function budgetDa(testo: string): Pick<Limite, 'percentuale' | 'valore' | 'unita'> | Msg {
  // F5.7: dopo «%» può seguire solo la parola «usato» dell'esempio; un residuo o un'altra parola non è un utilizzo.
  const m = testo.trim().replace(',', '.').match(/^(\d+(?:\.\d+)?)\s*(?:%\s*(\p{L}+)?|(\p{L}+))?$/iu)
  if (!m || (m[2] && !USATO.has(m[2].toLowerCase()))) return msg('budget.formato')
  const n = Number(m[1])
  if (!m[3]) return n <= 100 ? { percentuale: n, unita: '%' } : msg('budget.percentuale')
  const unita = ALIAS_UNITA[m[3].toLowerCase()]
  if (!unita) return msg('budget.unita', { unita: m[3] })
  return n <= 1e12 ? { valore: n, unita } : msg('budget.grande')
}

/** Il budget manuale nuovo, nella forma del config. `adesso` in ms. */
export function nuovoBudget(f: Fornitore, tipo: string, misura: Pick<Limite, 'percentuale' | 'valore' | 'unita'>, adesso: number) {
  return { id: `${f}-${tipo}-${adesso.toString(36)}`.slice(0, 60), fornitore: f, nome: tipo, letto: new Date(adesso).toISOString(), ...misura }
}

/** I budget letti, riportati alla forma del config: senza il prefisso `manuale-` che aggiunge la lettura e senza i campi derivati. */
export const manualiDaScrivere = (limiti: readonly Limite[]) =>
  limiti.map(l => ({
    id: l.id.replace(/^manuale-/, ''), fornitore: l.fornitore, nome: l.nome, letto: l.letto, unita: l.unita,
    ...(l.percentuale !== undefined && { percentuale: l.percentuale }),
    ...(l.valore !== undefined && { valore: l.valore }),
  }))

// --- bozza delle Impostazioni (F5.9) -------------------------------------------------------------------
// Le modifiche restano nella bozza della sessione finché non si preme «Applica»: una sola scrittura CAS. Ogni campo
// tiene il valore che aveva quando lo si è toccato (`base`), così all'Applica si vede se un'altra sessione l'ha cambiato.

/**
 * F10: i campi dello strato Account nella bozza, con il prefisso `account.` (lo toglie la scrittura): così base, conflitti
 * e «Riapplica» funzionano uguali per i due strati, e una modifica all'account nascosta da una restrizione non sfugge.
 */
export const CAMPI_ACCOUNT = ['account.soglie', 'account.apiClaude', 'account.freellmapi', 'account.modoLavoro', 'account.compatibili']
/**
 * I campi che stanno nella bozza; i budget manuali no: si scrivono subito, e Applica non li tocca mai. Del progetto, `soglie`
 * e `apiClaude` (dei build di sviluppo) e `restrizioni` sono restrizioni: la bozza le toglie o le restringe soltanto.
 */
export const CAMPI_BOZZA = ['fornitori', 'soloLocale', 'milestoneGithub', 'pesi', 'freellmapi', 'board', 'soglie', 'profilo', 'apiClaude', 'consigliere', 'restrizioni', 'modoLavoro', 'compatibili', ...CAMPI_ACCOUNT]
/** Il valore GREZZO di un campo (mai quello efficace) nella forma che scrive `configura`; null = assente. */
export function valoreConfig(r: RisorseProgetto, k: string): unknown {
  switch (k) {
    case 'board': return { modo: r.board.modo }
    case 'soglie': return r.strato.soglie
    case 'apiClaude': return r.strato.apiClaude ?? null
    case 'freellmapi': return r.strato.freellmapi
    case 'restrizioni': return Object.keys(r.strato.restrizioni).length ? r.strato.restrizioni : null
    case 'account.soglie': return r.account.soglie
    case 'account.apiClaude': return r.account.apiClaude ?? null
    case 'account.freellmapi': return r.account.freellmapi ?? null
    case 'account.modoLavoro': return r.account.modoLavoro ?? null
    case 'account.compatibili': return r.account.compatibili ?? null
    case 'compatibili': return Object.keys(r.compatibili ?? {}).length ? r.compatibili : null
    case 'modoLavoro': return r.strato.modoLavoro ?? null
    case 'account.limitiManuali': return manualiDaScrivere(r.account.limitiManuali)
    case 'limitiManuali': return manualiDaScrivere(r.limitiManuali.filter(l => l.progetto))
    default: return (r as Record<string, unknown>)[k]
  }
}

/** F10: i campi (forma della bozza) divisi nei due strati della scrittura; i valori null tolgono il campo. */
export function perStrato(campi: Record<string, unknown>) {
  const progetto: Record<string, unknown> = {}
  const account: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(campi)) {
    if (k.startsWith('account.')) account[k.slice('account.'.length)] = v
    else progetto[k] = v
  }
  return { progetto, account }
}

/** F10: il progetto e l'account grezzi come li riscriverebbe il config, ricostruiti dalle risorse lette (solo campi noti). */
export function grezzi(r: RisorseProgetto) {
  const progetto: Record<string, unknown> = {
    fornitori: r.fornitori, soloLocale: r.soloLocale, milestoneGithub: r.milestoneGithub, pesi: r.pesi, freellmapi: r.strato.freellmapi,
    soglie: r.strato.soglie, board: r.board, limitiManuali: valoreConfig(r, 'limitiManuali'),
    ...(r.strato.apiClaude && { apiClaude: r.strato.apiClaude }), ...(r.consigliere && { consigliere: r.consigliere }), ...(r.profilo && { profilo: r.profilo }),
    ...(Object.keys(r.strato.restrizioni).length && { restrizioni: r.strato.restrizioni }),
    ...(r.strato.modoLavoro && { modoLavoro: r.strato.modoLavoro }),
    ...(Object.keys(r.compatibili ?? {}).length && { compatibili: r.compatibili }),
  }
  const account: Record<string, unknown> = {
    ...(r.account.compatibili && { compatibili: r.account.compatibili }),
    soglie: r.account.soglie, limitiManuali: valoreConfig(r, 'account.limitiManuali'),
    ...(r.account.apiClaude && { apiClaude: r.account.apiClaude }), ...(r.account.freellmapi && { freellmapi: r.account.freellmapi }),
    ...(r.account.modoLavoro && { modoLavoro: r.account.modoLavoro }),
  }
  return { progetto, account }
}
const senzaNull = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null))
const piano = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const VIETATE = new Set(['__proto__', 'constructor', 'prototype'])

/**
 * Gemello di `applicaPatch` in strumenti/regole.cjs (test di parità): un campo a null si cancella, un oggetto si fonde in
 * profondità (un null annidato è un valore), i percorsi di `togli` cancellano chiavi annidate dei campi nominati; tutto il
 * resto resta, null preesistenti e campi sconosciuti compresi. Lancia se la patch o un percorso non valgono.
 */
export function applicaPatch(prima: Record<string, unknown>, patch: Record<string, unknown>, togli: readonly string[] = []): Record<string, unknown> {
  if (!piano(prima) || !piano(patch) || !Array.isArray(togli)) throw new Error('patch')
  const fondi = (a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> => {
    const o = { ...a }
    for (const [k, v] of Object.entries(b)) {
      if (VIETATE.has(k)) throw new Error('patch')
      o[k] = piano(v) && piano(a[k]) ? fondi(a[k] as Record<string, unknown>, v) : v
    }
    return o
  }
  const out: Record<string, unknown> = { ...prima }
  for (const [k, v] of Object.entries(patch)) {
    if (VIETATE.has(k)) throw new Error('patch')
    if (v === null) delete out[k]
    else out[k] = piano(v) && piano(out[k]) ? fondi(out[k] as Record<string, unknown>, v) : v
  }
  for (const p of togli) {
    const s = typeof p === 'string' ? p.split('.') : []
    if (s.length < 2 || s.length > 5 || !s.every(x => /^[A-Za-z0-9_-]{1,60}$/.test(x) && !VIETATE.has(x)) || !Object.hasOwn(patch, s[0]!)) throw new Error('togli')
    let o: Record<string, unknown> | null = out
    for (const x of s.slice(0, -1)) {
      if (!piano(o[x])) {
        o = null
        break
      }
      o[x] = { ...(o[x] as Record<string, unknown>) }
      o = o[x] as Record<string, unknown>
    }
    if (o) delete o[s[s.length - 1]!]
  }
  return out
}

/**
 * Le chiavi annidate che un valore nuovo non ha più rispetto a quello di prima (`campo.chiave…`), per `togli`: solo fra
 * chiavi note (il valore di prima è quello normalizzato letto), così una chiave sconosciuta nel file non si cancella mai.
 */
export function percorsiTolti(campo: string, prima: unknown, dopo: unknown): string[] {
  if (!piano(prima) || !piano(dopo)) return []
  return Object.keys(prima).flatMap(k => (!(k in dopo) ? [`${campo}.${k}`] : percorsiTolti(`${campo}.${k}`, prima[k], dopo[k])))
}

/** Aggiunge alla bozza i `campi` toccati da un controllo (`dove`); la base di un campo è quella del primo tocco. */
export function conPendente(p: Pendenti | undefined, r: RisorseProgetto, dove: string, campi: Record<string, unknown>): Pendenti {
  // I budget manuali scrivono subito (procedura guidata e ×): un campo fuori dallo schema della bozza è un errore di chi chiama.
  const fuori = Object.keys(campi).filter(k => !CAMPI_BOZZA.includes(k))
  if (fuori.length) throw new Error(`not a draft field: ${fuori.join(', ')}`)
  const base = { ...p?.base }
  for (const k of Object.keys(campi)) if (!(k in base)) base[k] = valoreConfig(r, k)
  return { ...p, campi: { ...p?.campi, ...campi }, base, dove: [...new Set([...(p?.dove ?? []), dove])] }
}

const oggetto = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)
/**
 * La bozza come la lascia uno stato conservato (anche da un modulo precedente): la forma di oggi, oppure null se non lo
 * è. I campi del progetto che `configura` non conosce si tolgono; `perso` dice se si è tolto qualcosa.
 */
export function pendentiDa(x: unknown): { pendenti: Pendenti | undefined; perso: boolean } {
  if (x === undefined) return { pendenti: undefined, perso: false }
  if (!oggetto(x) || !oggetto(x.campi) || !oggetto(x.base) || !Array.isArray(x.dove) || !x.dove.every(d => typeof d === 'string') ||
      (x.lingua !== undefined && !(LINGUE as readonly unknown[]).includes(x.lingua)))
    return { pendenti: undefined, perso: true }
  const noti = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([k]) => CAMPI_BOZZA.includes(k)))
  const campi = noti(x.campi)
  const linguaBase = (LINGUE as readonly unknown[]).includes(x.linguaBase) ? { linguaBase: x.linguaBase as Lingua } : {}
  const pendenti = piena({ campi, base: noti(x.base), dove: x.dove as string[], ...(x.lingua !== undefined && { lingua: x.lingua as Lingua, ...linguaBase }) })
  return { pendenti, perso: Object.keys(campi).length !== Object.keys(x.campi).length }
}

/** Una bozza senza campi né lingua non c'è. */
export const piena = (p: Pendenti | undefined) => (p && (Object.keys(p.campi).length || p.lingua) ? p : undefined)

/**
 * Le risorse come le vedrà il config con la bozza applicata (i due strati); il motivo se la bozza non passa la validazione
 * di oggi, o se le restrizioni toccate allargherebbero l'account.
 */
export function conBozza(r: RisorseProgetto, campi: Record<string, unknown>) {
  const g = grezzi(r)
  const { progetto, account } = perStrato(campi)
  // F11.1: un modo di lavoro che viola le guardie o non ha la forma si rifiuta in scrittura, con il nome del campo.
  for (const m of [progetto.modoLavoro, account.modoLavoro]) {
    const campo = modoNonValido(m)
    if (campo) return msg('cfg.modoLavoro', { campo })
  }
  const nuove = risorseDa(senzaNull({ ...g.progetto, ...progetto }), senzaNull({ ...g.account, ...account }))
  if (eMsg(nuove) || progetto.restrizioni === undefined || progetto.restrizioni === null) return nuove
  const restrizioni = restrizioniDa(progetto.restrizioni)
  return (restrizioni && restrizioneLarga(nuove.account, restrizioni)) ?? nuove
}

/** I campi della bozza che un'altra sessione ha cambiato dopo il primo tocco. */
export const cambiatiAltrove = (p: Pendenti, r: RisorseProgetto) => Object.keys(p.campi).filter(k => JSON.stringify(p.base[k]) !== JSON.stringify(valoreConfig(r, k)))

/** Dove sta un campo, per dire all'utente che cosa è cambiato. */
export const SEZIONE_DI: Record<string, Chiave> = {
  fornitori: 'imp.sezione.progetto', soglie: 'imp.sezione.soglie', profilo: 'imp.sezione.bilanciamento', pesi: 'imp.sezione.bilanciamento',
  soloLocale: 'imp.sezione.progetto', milestoneGithub: 'imp.sezione.progetto', board: 'imp.sezione.board', restrizioni: 'imp.sezione.progetto',
  freellmapi: 'imp.sezione.avanzate', apiClaude: 'imp.sezione.esecuzione', consigliere: 'imp.sezione.esecuzione', lingua: 'imp.sezione.lingua',
  'account.soglie': 'imp.sezione.soglie', 'account.apiClaude': 'imp.sezione.esecuzione', 'account.freellmapi': 'imp.sezione.avanzate',
  'account.modoLavoro': 'imp.sezione.modo', modoLavoro: 'imp.sezione.modo',
}

// --- proposte di impostazioni (F7.1) -----------------------------------------------------------------------
// Una sessione propone, su indicazione esplicita dell'utente, alcuni campi delle Impostazioni. Schema esplicito e chiuso a
// ogni livello: un campo sconosciuto o vietato rifiuta TUTTA la proposta, col nome del campo e mai col valore. La proposta
// valida riempie la bozza di F5.9 e passa per «Applica». La stessa regola di forma la ricontrolla l'helper.

/** I campi che nessuna proposta tocca mai: chiavi, guardie, permessi, destinazioni, fornitori ammessi e pesi. */
const VIETATI = /^(soloLocale|fornitori|freellmapi|pesi|pesiRevisione|pesiOrigine|milestoneGithub|limitiManuali|corsi[ae]|permessi|destinazion[ei]|sensibil[ei]|cloud|chiav[ei].*|.*(key|token|secret|password).*)$/i
const PROFILI_PROPONIBILI = ['automatico', 'risparmio', 'qualita', 'velocita', 'personalizzato']
/** Il nome di un campo come si può ripetere: solo caratteri da identificatore, corto. */
const nomeCampo = (s: string) => s.replace(/[^A-Za-z0-9_.-]/g, '?').slice(0, 60)
const numeroIn = (x: unknown, min: number, max: number, intero = false) => typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max && (!intero || Number.isInteger(x))

/**
 * La forma di una proposta: la proposta normalizzata, o perché no (in inglese, per lo strumento). F10: una patch per strato,
 * `progetto` (profilo, board, consigliere, restrizioni) e `account` (soglie, crediti API), ciascuna con la sua whitelist.
 */
export function propostaImpostazioniDa(x: unknown): { proposta: PropostaImpostazioni } | { errore: string } {
  const o = oggetto
  const no = (campo: string, come: 'sconosciuto' | 'vietato' | 'valore') => ({
    errore: come === 'vietato' ? `field "${nomeCampo(campo)}" can never be proposed (keys, guards, permissions, providers and destinations stay with the owner): the whole proposal is rejected`
      : come === 'sconosciuto' ? `field "${nomeCampo(campo)}" is not a settings field this tool accepts: the whole proposal is rejected`
      : `field "${nomeCampo(campo)}" has a value the panel does not accept: the whole proposal is rejected`,
  })
  const chiavi = (v: Record<string, unknown>, ammesse: readonly string[], dove: string) => {
    for (const k of Object.keys(v)) if (!ammesse.includes(k)) return no(dove ? `${dove}.${k}` : k, VIETATI.test(k) ? 'vietato' : 'sconosciuto')
    return undefined
  }
  /** Soglie per fornitore: valori interi, attenzione sotto la critica; null = nessuna soglia. */
  const soglie = (v: unknown, dove: string): { soglie: Partial<Record<Fornitore, Soglia | null>> } | { errore: string } => {
    if (!o(v) || !Object.keys(v).length) return no(dove, 'valore')
    const f = chiavi(v, FORNITORI, dove)
    if (f) return f
    const fuori: Partial<Record<Fornitore, Soglia | null>> = {}
    for (const [k, s] of Object.entries(v)) {
      if (s !== null) {
        if (!o(s)) return no(`${dove}.${k}`, 'valore')
        const g = chiavi(s, ['attenzione', 'critica'], `${dove}.${k}`)
        if (g) return g
        if (!numeroIn(s.attenzione, 1, 100, true) || !numeroIn(s.critica, 1, 100, true) || (s.attenzione as number) >= (s.critica as number)) return no(`${dove}.${k}`, 'valore')
      }
      fuori[k as Fornitore] = s === null ? null : { attenzione: (s as Soglia).attenzione, critica: (s as Soglia).critica }
    }
    return { soglie: fuori }
  }
  if (!o(x)) return { errore: 'the proposal must be an object' }
  const fuori = chiavi(x, ['motivo', 'progetto', 'account', 'lingua'], '')
  if (fuori) return fuori
  const p: PropostaImpostazioni = { motivo: '' }
  if (typeof x.motivo !== 'string' || !x.motivo.trim() || x.motivo.length > 300) return no('motivo', 'valore')
  p.motivo = x.motivo.trim()
  if (x.progetto !== undefined) {
    const q = x.progetto
    if (!o(q) || !Object.keys(q).length) return no('progetto', 'valore')
    const g = chiavi(q, ['profilo', 'board', 'consigliere', 'restrizioni', 'modoLavoro'], 'progetto')
    if (g) return g
    const pr: NonNullable<PropostaImpostazioni['progetto']> = {}
    if (q.profilo !== undefined) {
      if (!PROFILI_PROPONIBILI.includes(q.profilo as string)) return no('progetto.profilo', 'valore')
      pr.profilo = q.profilo as NonNullable<PropostaImpostazioni['progetto']>['profilo']
    }
    if (q.board !== undefined) {
      if (!o(q.board)) return no('progetto.board', 'valore')
      const h = chiavi(q.board, ['modo'], 'progetto.board')
      if (h) return h
      if (!['spenta', 'accesa', 'riassunti'].includes(q.board.modo as string)) return no('progetto.board.modo', 'valore')
      pr.board = { modo: q.board.modo as 'spenta' | 'accesa' | 'riassunti' }
    }
    if (q.consigliere !== undefined) {
      if (!['spento', 'suggerisci', 'applica'].includes(q.consigliere as string)) return no('progetto.consigliere', 'valore')
      pr.consigliere = q.consigliere as NonNullable<PropostaImpostazioni['progetto']>['consigliere']
    }
    if (q.restrizioni !== undefined) {
      const rz = q.restrizioni
      if (!o(rz) || !Object.keys(rz).length) return no('progetto.restrizioni', 'valore')
      const h = chiavi(rz, ['soglie', 'apiLimiteMeseUsd', 'apiTetto'], 'progetto.restrizioni')
      if (h) return h
      const restrizioni: NonNullable<NonNullable<PropostaImpostazioni['progetto']>['restrizioni']> = {}
      if (rz.soglie !== undefined) {
        const sg = soglie(rz.soglie, 'progetto.restrizioni.soglie')
        if ('errore' in sg) return sg
        restrizioni.soglie = sg.soglie
      }
      if (rz.apiLimiteMeseUsd !== undefined) {
        if (!numeroIn(rz.apiLimiteMeseUsd, 0.01, 100_000)) return no('progetto.restrizioni.apiLimiteMeseUsd', 'valore')
        restrizioni.apiLimiteMeseUsd = rz.apiLimiteMeseUsd as number
      }
      if (rz.apiTetto !== undefined) {
        if (!numeroIn(rz.apiTetto, 0.01, 1_000)) return no('progetto.restrizioni.apiTetto', 'valore')
        restrizioni.apiTetto = rz.apiTetto as number
      }
      pr.restrizioni = restrizioni
    }
    if (q.modoLavoro !== undefined) {
      const campo = q.modoLavoro === null ? 'modoLavoro' : modoNonValido(q.modoLavoro)
      if (campo || !Object.keys(q.modoLavoro as object).length) return no(`progetto.${campo ?? 'modoLavoro'}`, 'valore')
      pr.modoLavoro = q.modoLavoro as NonNullable<PropostaImpostazioni['progetto']>['modoLavoro']
    }
    p.progetto = pr
  }
  if (x.account !== undefined) {
    const a = x.account
    if (!o(a) || !Object.keys(a).length) return no('account', 'valore')
    const g = chiavi(a, ['soglie', 'apiClaude', 'modoLavoro'], 'account')
    if (g) return g
    const ac: NonNullable<PropostaImpostazioni['account']> = {}
    if (a.soglie !== undefined) {
      const sg = soglie(a.soglie, 'account.soglie')
      if ('errore' in sg) return sg
      ac.soglie = sg.soglie
    }
    if (a.apiClaude !== undefined) {
      if (!o(a.apiClaude) || !Object.keys(a.apiClaude).length) return no('account.apiClaude', 'valore')
      const h = chiavi(a.apiClaude, ['budgetUsd', 'tetto'], 'account.apiClaude')
      if (h) return h
      if (a.apiClaude.budgetUsd !== undefined && !numeroIn(a.apiClaude.budgetUsd, 0.01, 100_000)) return no('account.apiClaude.budgetUsd', 'valore')
      if (a.apiClaude.tetto !== undefined && !numeroIn(a.apiClaude.tetto, 0.01, 1_000)) return no('account.apiClaude.tetto', 'valore')
      ac.apiClaude = { ...(a.apiClaude.budgetUsd !== undefined && { budgetUsd: a.apiClaude.budgetUsd as number }), ...(a.apiClaude.tetto !== undefined && { tetto: a.apiClaude.tetto as number }) }
    }
    if (a.modoLavoro !== undefined) {
      const campo = a.modoLavoro === null ? 'modoLavoro' : modoNonValido(a.modoLavoro)
      if (campo || !Object.keys(a.modoLavoro as object).length) return no(`account.${campo ?? 'modoLavoro'}`, 'valore')
      ac.modoLavoro = a.modoLavoro as NonNullable<PropostaImpostazioni['account']>['modoLavoro']
    }
    p.account = ac
  }
  if (x.lingua !== undefined) {
    if (!(LINGUE as readonly unknown[]).includes(x.lingua)) return no('lingua', 'valore')
    p.lingua = x.lingua as Lingua
  }
  if (Object.keys(p).length < 2) return { errore: 'the proposal has no settings field besides the reason' }
  return { proposta: p }
}

/**
 * I campi della bozza (forma di `configura`, account con il prefisso) che una proposta riempie, completati con i valori
 * GREZZI correnti dello stesso strato. Nessun campo derivato: un tetto proposto da solo non crea un budget, e viceversa.
 */
export function campiDaProposta(p: PropostaImpostazioni, r: RisorseProgetto): Record<string, unknown> {
  const campi: Record<string, unknown> = {}
  const q = p.progetto ?? {}
  // Profilo e pesi sono una coppia: il profilo proposto porta i suoi pesi (i modelli restano), e i conflitti li vedono entrambi.
  if (q.profilo) {
    campi.profilo = q.profilo
    campi.pesi = conProfilo(r.pesi, q.profilo)
  }
  if (q.board) campi.board = { modo: q.board.modo }
  if (q.consigliere) campi.consigliere = q.consigliere === 'spento' ? null : q.consigliere
  if (q.restrizioni) {
    const ora = r.strato.restrizioni
    campi.restrizioni = { ...ora, ...q.restrizioni, ...((ora.soglie || q.restrizioni.soglie) && { soglie: { ...ora.soglie, ...q.restrizioni.soglie } }) }
  }
  // F11.1: il modo di lavoro proposto si fonde con quello scritto dello stesso strato (effort per corsia compreso).
  const modo = (ora: Record<string, unknown> | undefined, nuovo: Record<string, unknown>) => ({ ...ora, ...nuovo,
    ...(ora?.effortPredefinito || nuovo.effortPredefinito ? { effortPredefinito: { ...(ora?.effortPredefinito as object), ...(nuovo.effortPredefinito as object) } } : {}) })
  if (q.modoLavoro) campi.modoLavoro = modo(r.strato.modoLavoro, q.modoLavoro)
  const a = p.account ?? {}
  if (a.modoLavoro) campi['account.modoLavoro'] = modo(r.account.modoLavoro, a.modoLavoro)
  if (a.soglie) campi['account.soglie'] = { ...r.account.soglie, ...a.soglie }
  if (a.apiClaude) campi['account.apiClaude'] = { ...r.account.apiClaude, ...a.apiClaude }
  return campi
}

/** Il primo campo che, applicato alle impostazioni di adesso, non passerebbe la validazione della bozza (mai il valore). */
export function campoNonValido(p: PropostaImpostazioni, r: RisorseProgetto): string | undefined {
  const tutti = campiDaProposta(p, r)
  for (const [k, v] of Object.entries(tutti)) if (eMsg(conBozza(r, { [k]: v }))) return k
  return eMsg(conBozza(r, tutti)) ? Object.keys(tutti).join(', ') : undefined
}

/** F10: una proposta (o una bozza) che tocca lo strato Account cambia le impostazioni di tutti i progetti. */
export const toccaAccount = (campi: Record<string, unknown>) => Object.keys(campi).some(k => k.startsWith('account.'))

/**
 * Le impostazioni proponibili come le vede l'agente in `risorse_agenti`, per strato e con i valori efficaci: nessun segreto.
 * I valori dello strato sono quelli scritti (assente = eredita); gli efficaci sono quelli che il pannello applica.
 */
export const impostazioniCorrenti = (r: RisorseProgetto, lingua: Lingua) => ({
  project: { profilo: profiloDi(r), board: r.board.modo, consigliere: r.consigliere ?? 'spento', restrizioni: r.strato.restrizioni, modoLavoro: r.strato.modoLavoro ?? {} },
  account: { soglie: r.account.soglie, apiClaude: r.account.apiClaude ?? null, modoLavoro: r.account.modoLavoro ?? {}, appliesTo: 'all projects' },
  effective: { soglie: r.soglie, apiClaude: r.apiClaude ?? null, modoLavoro: r.modoLavoro },
  lingua,
})

// --- «Chi lavora»: preset (F7.4) ---------------------------------------------------------------------------------

export type PresetChi = 'consigliato' | 'economico' | 'qualita'
export const PRESET_CHI: readonly PresetChi[] = ['consigliato', 'economico', 'qualita']
const CAMPI_CHI = ['esecutore', 'modello', 'effort', 'auditor'] as const

/**
 * Esecutore, modello, effort e auditor di un preset. Consigliato è `bilancia` con il profilo del progetto; Economico usa il
 * profilo Risparmio (lo spareggio R2: a parità il Claude di rango più basso) e non aggiunge mai un auditor; Qualità usa il
 * profilo Qualità e può aggiungerne uno sulle corsie alte. Corsia, revisore e destinazione restano quelli della chip;
 * l'auditor scelto resta, e torna a «nessuno» solo se con il nuovo modello non è più una coppia valida (`auditorTolto`).
 */
export function presetChi(a: Azione, preset: PresetChi, r: Regole, limiti: readonly Limite[], lista: readonly Azione[], chi: Chiamante) {
  const profilo = preset === 'economico' ? 'risparmio' : preset === 'qualita' ? 'qualita' : undefined
  const rp: Regole = profilo ? { ...r, risorse: { ...r.risorse, profilo, pesi: conProfilo(r.risorse.pesi, profilo) } } : r
  const s = bilancia({ ...a, auditor: undefined, senzaAuditor: undefined }, { revisore: a.revisore }, rp, limiti, lista, chi)
  const modello = s.esecutore === 'claude' ? modelloDi(s, r) : undefined
  // Una scelta esplicita (anche «nessuno») non si tocca; un auditor scelto torna a «nessuno» solo se non fa più coppia.
  let auditor = a.auditor === 'nessuno' ? 'nessuno'
    : s.esecutore === 'claude' && a.auditor && modello && !motivoAuditor(modello, a.auditor) ? a.auditor : undefined
  const auditorTolto = a.auditor && a.auditor !== 'nessuno' && !auditor ? a.auditor : undefined
  // Qualità, solo senza una scelta: sulle corsie alte un auditor di rango più alto, se la candidata completa (auditor
  // compreso) non viola niente di più di quella senza: niente auditor dove la modalità non lo ammette (il cloud).
  const alta = ['R3', 'R4', 'R5'].includes(corsiaDi(a, r) ?? '')
  // F11.1: con «auditor suggerito» acceso anche il preset consigliato propone l'auditor, alle stesse condizioni.
  const conAuditor = preset === 'qualita' || (preset === 'consigliato' && !!r.risorse.modoLavoro?.auditorSuggerito)
  if (conAuditor && a.auditor === undefined && alta && modello) {
    const candidata: Azione = { ...a, esecutore: s.esecutore, modello: s.modello, effort: s.effort, auditor: undefined, senzaAuditor: undefined }
    const senza = violazioni(candidata, r).map(m => JSON.stringify(m))
    auditor = ['opus', 'fable'].find(x => !motivoAuditor(modello, x) && rangoModello(idAuditor(x)!) > rangoModello(modello) &&
      violazioni({ ...candidata, auditor: x }, r).every(m => senza.includes(JSON.stringify(m))))
  }
  const campi: Pick<Azione, 'esecutore' | 'modello' | 'effort' | 'auditor'> = { esecutore: s.esecutore, modello: s.modello, effort: s.effort, auditor }
  return { campi, ...(auditorTolto && { auditorTolto }) }
}

/** La chip differisce dal preset in esecutore, modello, effort o auditor? */
export const diversoDa = (a: Azione, campi: Partial<Azione>, r: Regole) =>
  CAMPI_CHI.some(k => (k === 'modello' ? modelloDi(a, r) !== modelloDi({ ...a, ...campi }, r) : k === 'effort' ? effortDi(a, r) !== effortDi({ ...a, ...campi }, r) : (a[k] ?? undefined) !== (campi[k] ?? undefined)))

// --- simulazione --------------------------------------------------------------------------------------

/**
 * Dove andrebbe una nuova proposta R2 senza scelte di motore, modello ed effort, con le regole di adesso. Stessa
 * strada della creazione (`bilancia`), poi la guardia d'avvio: se nessuna combinazione passa, i motivi.
 */
export function simula(r: Regole, limiti: readonly Limite[], lista: readonly Azione[], chi: Chiamante | null) {
  const ora = new Date(0).toISOString()
  const esempio: Azione = {
    id: 'a-simulata', versione: 0, repo: chi?.repo ?? undefined, titolo: 'Proposta d\'esempio', brief: 'Balancing simulation.',
    ordine: 0, dipende: [], esecutore: 'claude', revisore: 'codex', corsia: 'R2', stato: 'proposta', creata: ora, aggiornata: ora, // record nuovo, solo in memoria
  }
  const scelta = chi ? bilancia(esempio, {}, r, limiti, lista, chi) : esempio
  const motivi = violazioniAvvio(scelta, r, lista, chi)
  return motivi.length ? { motivi } : { scelta }
}

// --- proposte di pesi (F4) ----------------------------------------------------------------------------
// Una sessione del progetto propone, il committente decide dal pannello. Qui solo logica pura: validazione degli
// argomenti, risultato atteso, lettura del file dell'helper, testi e dati per `risorse_agenti`.

const MOTORI_NOMI: Record<string, string> = { claude: 'Claude', codex: 'Codex', freellmapi: 'FreeLLMAPI' }
const nomeProfilo = (p: PesiProfilo['profilo'], l: Lingua) => t(l, PROFILI.find(x => x.id === p)?.nome ?? 'profilo.nessuno')
const testoVoce = (tipo: Peso['tipo'], nome: string) => (tipo === 'fornitore' ? MOTORI_NOMI[nome] ?? nome : tipo === 'modello' ? nomeModello(nome) : `effort ${nome}`)
const idBreve = (id: string) => id.replace(/^local_/, '').slice(0, 8)

/** I testi composti delle proposte di pesi, nella lingua `l`; le parole semplici sono chiavi `pesi.*` del dizionario. */
export const TESTI_PESI = {
  chi: (p: PropostaPesi, l: Lingua) => t(l, 'pesi.chi', { titolo: p.proponente.titolo || t(l, 'sessione.senzaTitolo'), id: idBreve(p.proponente.id) }),
  riga: (p: PropostaPesi, l: Lingua) => t(l, 'pesi.riga', { chi: TESTI_PESI.chi(p, l), chiede: riassuntoProposta(p, l) }),
  domanda: (p: PropostaPesi, l: Lingua) =>
    t(l, 'pesi.domanda', { chi: TESTI_PESI.chi(p, l), prima: descriviPesi(p.partenza, l), dopo: descriviPesi(p.risultato, l), motivo: p.motivo }),
  /** Per l'agente che ha proposto: in inglese. */
  registrata: (id: string, scadute: readonly string[]) =>
    `Proposal recorded (id ${id}): the owner decides it from the panel.` +
    (scadute.length ? ` Expired to make room (more than 3 pending): ${scadute.join(', ')}.` : ''),
  registro: (p: PropostaPesi, l: Lingua, adesso = Date.now()) =>
    t(l, 'pesi.registro', { esito: t(l, `pesi.stato.${statoVisto(p, adesso)}`), quando: data(l, decisaIl(p, adesso)), chi: TESTI_PESI.chi(p, l), chiede: riassuntoProposta(p, l) }),
} as const

/** Profilo e pesi a parole: «Risparmio · Codex Più · effort xhigh Molto meno (non esclude)». */
export function descriviPesi(s: PesiProfilo, l: Lingua) {
  const pesi = s.pesi.map(p => {
    const i = posizioneDi(p)
    return `${testoVoce(p.tipo, p.nome)} ${i < 0 ? pesoScritto(p, l) : t(l, POSIZIONI[i]!.nome)}`
  })
  return [nomeProfilo(s.profilo, l), ...(pesi.length ? pesi : [t(l, 'pesi.nessunPeso')])].join(' · ')
}

/** Che cosa chiede una proposta, in breve: il profilo e le regolazioni. */
export const riassuntoProposta = (p: Pick<PropostaPesi, 'profilo' | 'regolazioni'>, l: Lingua) =>
  [...(p.profilo ? [nomeProfilo(p.profilo, l)] : []), ...(p.regolazioni ?? []).map(x => `${testoVoce(x.tipo, x.nome)} ${POSIZIONI[x.posizione] ? t(l, POSIZIONI[x.posizione]!.nome) : '?'}`)].join(' · ')

const SCADENZA_PROPOSTA = 24 * 3_600_000
/** In attesa e non ancora scaduta (l'helper la segna scaduta alla prossima operazione). */
export const daDecidere = (p: PropostaPesi, adesso: number) => p.stato === 'attesa' && adesso - Date.parse(p.quando) <= SCADENZA_PROPOSTA
/**
 * Lo stato da mostrare: una voce ancora «attesa» nel file ma oltre le 24 ore è già scaduta (l'helper la segna alla
 * prossima operazione). Stessa regola per righe, registro e `risorse_agenti`.
 */
export const statoVisto = (p: PropostaPesi, adesso: number): PropostaPesi['stato'] => (p.stato === 'attesa' && !daDecidere(p, adesso) ? 'scaduta' : p.stato)
/** Quando la voce è stata decisa (o annullata, o è scaduta): ordina il registro. */
export const decisaIl = (p: PropostaPesi, adesso: number) =>
  Date.parse(p.annullamento?.quando ?? p.decisione?.quando ?? p.quando) + (p.stato === 'attesa' && statoVisto(p, adesso) === 'scaduta' ? SCADENZA_PROPOSTA : 0)
/** Annullabile solo se il config porta ancora la revisione e l'origine di quella applicazione. */
export const annullabile = (p: PropostaPesi, r: RisorseProgetto) =>
  p.stato === 'applicata' && !!p.decisione && r.pesiRevisione === p.decisione.revisione && r.pesiOrigine?.id === p.decisione.id

/** Le voci regolabili per tipo: le stesse delle Impostazioni (motori e modelli ammessi, effort di routing.json). */
export function vociRegolabili(r: Regole): Record<Peso['tipo'], string[]> {
  const motori = (['claude', 'codex', 'freellmapi'] as const).filter(m => r.risorse.fornitori.includes(m))
  return { fornitore: [...motori], modello: motori.flatMap(m => r.modelli[m]), effort: [...r.effort] }
}

/**
 * Gli argomenti di `proponi_pesi`, validati al confine, e il risultato che avrebbe applicarli adesso. Mai pesi
 * grezzi: solo un profilo e posizioni 0–4 su voci ammesse. Una regolazione rende il profilo Personalizzato, come
 * nelle Impostazioni.
 */
export function propostaDa(args: Record<string, unknown>, r: Regole): string | { motivo: string; profilo?: Profilo; regolazioni?: Regolazione[]; risultato: PesiProfilo } {
  const ignoti = Object.keys(args).filter(k => !['profilo', 'regolazioni', 'motivo'].includes(k))
  if (ignoti.length) return `fields not allowed: ${ignoti.join(', ')} (only profilo, regolazioni and motivo)`
  const motivo = typeof args.motivo === 'string' ? args.motivo.trim() : ''
  if (!motivo || motivo.length > 300) return 'motivo: mandatory, up to 300 characters'
  const profilo = args.profilo as Profilo | undefined
  if (profilo !== undefined && !PROFILI.some(p => p.id === profilo)) return `profilo: one of ${PROFILI.map(p => p.id).join(', ')}`
  let regolazioni: Regolazione[] | undefined
  if (args.regolazioni !== undefined) {
    if (!Array.isArray(args.regolazioni) || !args.regolazioni.length || args.regolazioni.length > 30) return 'regolazioni: from 1 to 30 entries'
    const ammesse = vociRegolabili(r)
    regolazioni = []
    for (const x of args.regolazioni as unknown[]) {
      const v = x as Record<string, unknown>
      if (!v || typeof v !== 'object' || Object.keys(v).some(k => !['tipo', 'nome', 'posizione'].includes(k))) return 'regolazioni: each entry is { tipo, nome, posizione }'
      if (!['fornitore', 'modello', 'effort'].includes(String(v.tipo))) return 'regolazioni: tipo fornitore, modello or effort'
      const tipo = v.tipo as Peso['tipo']
      if (typeof v.nome !== 'string' || !ammesse[tipo].includes(v.nome)) return `regolazioni: "${String(v.nome)}" is not an allowed ${tipo} (${ammesse[tipo].join(', ') || 'none'})`
      if (!Number.isInteger(v.posizione) || (v.posizione as number) < 0 || (v.posizione as number) > 4) return 'regolazioni: posizione from 0 (Much less) to 4 (Prefer)'
      if (regolazioni.some(y => y.tipo === tipo && y.nome === v.nome)) return `regolazioni: ${tipo} "${v.nome}" repeated`
      regolazioni.push({ tipo, nome: v.nome, posizione: v.posizione as number })
    }
  }
  if (!profilo && !regolazioni) return 'a profilo, some regolazioni or both are needed'
  let pesi = profilo ? conProfilo(r.risorse.pesi, profilo) : [...r.risorse.pesi]
  for (const x of regolazioni ?? []) pesi = conPosizione(pesi, x.tipo, x.nome, x.posizione)
  const risultato: PesiProfilo = { profilo: regolazioni ? 'personalizzato' : profilo!, pesi }
  // Il confronto è con il profilo in vigore: «automatico» su un config senza profilo né pesi non cambia nulla.
  if (risultato.profilo === profiloDi(r.risorse) && JSON.stringify(pesi) === JSON.stringify(r.risorse.pesi)) return 'the proposal changes nothing compared to the current configuration'
  return { motivo, ...(profilo && { profilo }), ...(regolazioni && { regolazioni }), risultato }
}

const testoCorto = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : undefined)
const istanteOk = (v: unknown) => typeof v === 'string' && Number.isFinite(Date.parse(v))
const pesiProfiloDa = (v: unknown): PesiProfilo | undefined => {
  const s = v as Record<string, unknown> | null
  if (!s || typeof s !== 'object' || !Array.isArray(s.pesi) || !s.pesi.every(pesoValido)) return undefined
  const profilo = s.profilo === null ? null : PROFILI.some(p => p.id === s.profilo) ? (s.profilo as Profilo) : undefined
  return profilo === undefined ? undefined : { profilo, pesi: s.pesi as Peso[] }
}

/** Le proposte di `repo` dal file dell'helper, dalla più recente: una voce di forma sconosciuta si salta. */
export function proposteDa(json: unknown, repo: string | null): PropostaPesi[] {
  const voci = (json as { voci?: unknown } | null)?.voci
  if (!repo || !Array.isArray(voci)) return []
  return voci
    .flatMap((x): PropostaPesi[] => {
      const v = x as Record<string, unknown>
      if (!v || typeof v !== 'object' || v.progetto !== repo || typeof v.id !== 'string' || !/^p-[a-z0-9]{6,40}$/.test(v.id) || !Number.isInteger(v.versione)) return []
      const chi = v.proponente as Record<string, unknown> | undefined
      const partenza = pesiProfiloDa(v.partenza)
      const risultato = pesiProfiloDa(v.risultato)
      const rev = (v.partenza as { revisione?: unknown } | undefined)?.revisione
      if (!chi || typeof chi.id !== 'string' || !istanteOk(v.quando) || typeof v.motivo !== 'string' || !partenza || !risultato || !Number.isInteger(rev) ||
          !['attesa', 'applicata', 'rifiutata', 'scaduta', 'annullata'].includes(String(v.stato))) return []
      const regolazioni = Array.isArray(v.regolazioni)
        ? (v.regolazioni as Regolazione[]).filter(r => r && ['fornitore', 'modello', 'effort'].includes(r.tipo) && typeof r.nome === 'string' && Number.isInteger(r.posizione)).slice(0, 30)
        : undefined
      // Lo stato di una proposta di pesi, non di un'azione: niente transizione().
      const stato = v.stato as PropostaPesi['stato']
      const d = v.decisione as PropostaPesi['decisione'] | undefined
      const u = v.annullamento as PropostaPesi['annullamento'] | undefined
      return [{
        id: v.id, versione: v.versione as number, progetto: repo,
        proponente: { id: chi.id.slice(0, 200), titolo: testoCorto(chi.titolo, 80) ?? '' },
        quando: v.quando as string, motivo: v.motivo.slice(0, 300),
        ...(PROFILI.some(p => p.id === v.profilo) && { profilo: v.profilo as Profilo }), ...(regolazioni && { regolazioni }),
        partenza: { ...partenza, revisione: rev as number }, risultato, stato,
        ...(d && typeof d.id === 'string' && istanteOk(d.quando) && { decisione: { id: d.id, esito: d.esito === 'applica' ? 'applica' : 'rifiuta', quando: d.quando, ...(Number.isInteger(d.revisione) && { revisione: d.revisione }) } }),
        ...(u && typeof u.id === 'string' && istanteOk(u.quando) && Number.isInteger(u.revisione) && { annullamento: { id: u.id, quando: u.quando, revisione: u.revisione } }),
        ...(typeof v.nota === 'string' && { nota: v.nota.slice(0, 120) }),
      }]
    })
    .sort((a, b) => Date.parse(b.quando) - Date.parse(a.quando))
}

// --- dati per `risorse_agenti` ----------------------------------------------------------------------------

/** Una misura di contesto più vecchia di così non entra nella media: un numero vecchio non decide. */
const CONTESTO_FRESCO_MS = 300_000

/** Per «modello · effort»: sessioni del progetto al lavoro adesso e chip in coda. */
export function alLavoroDa(sessioni: readonly SessioneProgetto[], azioni: readonly Azione[], r: Regole) {
  const out: Record<string, { lavoro: number; coda: number }> = {}
  const voce = (k: string) => (out[k] ??= { lavoro: 0, coda: 0 })
  for (const s of sessioni) if (s.stato === 'in-corso') voce(`${s.modello ?? '?'} · ${s.effort ?? '?'}`).lavoro += 1
  for (const a of azioni) if (a.stato === 'accodata') voce(`${modelloDi(a, r)} · ${effortDi(a, r)}`).coda += 1
  return out
}

/**
 * Per modello, sulle sessioni al lavoro: media e massimo della finestra di contesto usata, solo con misure riuscite
 * negli ultimi 5 minuti, la copertura («3 su 4») e l'istante dell'ultima misura riuscita.
 */
export function contestoPerModello(sessioni: readonly SessioneProgetto[], adesso: number) {
  const out: Record<string, { media: number | null; massimo: number | null; misurate: string; ultima: string | null }> = {}
  const perModello = new Map<string, SessioneProgetto[]>()
  for (const s of sessioni) if (s.stato === 'in-corso') perModello.set(s.modello ?? '?', [...(perModello.get(s.modello ?? '?') ?? []), s])
  for (const [m, lista] of perModello) {
    const fresche = lista.filter(s => s.contesto !== undefined && s.contestoIl && adesso - Date.parse(s.contestoIl) <= CONTESTO_FRESCO_MS && adesso >= Date.parse(s.contestoIl))
    const valori = fresche.map(s => s.contesto!)
    const istanti = lista.flatMap(s => (s.contestoIl ? [s.contestoIl] : [])).sort()
    out[m] = {
      media: valori.length ? Math.round(valori.reduce((x, y) => x + y, 0) / valori.length) : null,
      massimo: valori.length ? Math.max(...valori) : null,
      misurate: `${valori.length} of ${lista.length}`,
      ultima: istanti.at(-1) ?? null,
    }
  }
  return out
}

/** Le ultime 3 proposte, in forma breve. */
export const proposteBrevi = (lista: readonly PropostaPesi[], adesso: number) =>
  lista.slice(0, 3).map(p => {
    // Lo stato visto di una proposta di pesi, non di un'azione.
    const stato = statoVisto(p, adesso)
    return { id: p.id, stato, quando: p.quando, da: p.proponente.titolo || idBreve(p.proponente.id), chiede: riassuntoProposta(p, 'en'), ...(p.decisione && { decisa: p.decisione.quando }) }
  })

export const TETTO_RISORSE = 4_000

/**
 * La risposta di `risorse_agenti` entro il tetto: se è troppo lunga si accorcia per passi, dal meno importante, e lo si
 * dice in `nota`. Ogni passo toglie dettaglio senza inventare numeri.
 */
/** Le sessioni di un modello (il totale di «k of n»): un numero, qualunque sia la parola fra i due. */
const sessioniDi = (c: { misurate: string }) => Number(/(\d+)\s*$/.exec(c.misurate)?.[1] ?? 0)

export function rispostaRisorse(dati: Record<string, unknown>, tetto = TETTO_RISORSE) {
  let d: Record<string, unknown> = { ...dati }
  const ridotti: string[] = []
  const passi: [string, (x: Record<string, unknown>) => Record<string, unknown>][] = [
    ['limits without source and name', x => ({ ...x, limiti: (x.limiti as Limite[] | undefined)?.map(l => ({ id: l.id, percentuale: l.percentuale, valore: l.valore, letto: l.letto, reset: l.reset, errore: l.errore })) })],
    ['alLavoro: the 8 most used combinations', x => ({ ...x, alLavoro: Object.fromEntries(Object.entries((x.alLavoro ?? {}) as Record<string, { lavoro: number; coda: number }>).sort((a, b) => b[1].lavoro + b[1].coda - a[1].lavoro - a[1].coda).slice(0, 8)) })],
    ['contesto: the 5 most used models', x => ({ ...x, contesto: Object.fromEntries(Object.entries((x.contesto ?? {}) as Record<string, { misurate: string }>).sort((a, b) => sessioniDi(b[1]) - sessioniDi(a[1])).slice(0, 5)) })],
    ['policy weights: only the count', x => ({ ...x, politica: { ...(x.politica as object), pesi: `${((x.politica as { pesi?: unknown[] }).pesi ?? []).length} weights: see Settings` } })],
    ['settings: thresholds omitted', x => ({ ...x, impostazioni: x.impostazioni && { ...(x.impostazioni as object), soglie: 'omitted: see Settings' } })],
    ['limits omitted', x => ({ ...x, limiti: 'omitted: too many for the answer' })],
    ['policy omitted', x => ({ ...x, politica: 'omitted: too long' })],
  ]
  for (const [nome, passo] of passi) {
    if (JSON.stringify(d).length <= tetto) break
    d = passo(d)
    ridotti.push(nome)
  }
  if (ridotti.length) d = { ...d, nota: `answer reduced under ${tetto} characters: ${ridotti.join('; ')}` }
  const testo = JSON.stringify(d)
  return testo.length <= tetto ? testo : JSON.stringify({ nota: `answer over ${tetto} characters even when reduced`, chiavi: Object.keys(d) })
}
