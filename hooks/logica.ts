// Logica pura del pannello: niente `$`, così i test la provano senza engine.
import type { ModoLavoro, ModoLavoroEfficace } from '../types'
import type { Azione, BoardProgetto, Chiamante, Consumo, ControlloEsecuzione, Corsia, Destinazione, Fornitore, Limite, PassoEsecuzione, Peso, Regole, Restrizioni, RisorseProgetto, SessioneProgetto, Soglia, SogliePerStrato, StratoAccount, StatoAzione, StratoProgetto, Traguardo, Vita } from '../types'
import { eMsg, msg, numero as scriviNumero, salvato, t } from './lingua'
import type { Lingua, Msg } from './lingua'
import { GRIGIO, LIVELLO, STATO } from './tema'
import { baseDi, impostazioniCompatibiliDa, livelliCompatibiliDa, MODELLO_COMPATIBILE, voceCompatibile } from './compatibili'
import { rigaSkill, SKILL_BASE, skillAttive } from './skill-base'
import type { RuoloSkill } from './skill-base'

// --- regole (routing.json) ---------------------------------------------------------------------

/** Contesto del mandato quando il progetto non ne configura uno; è anche l'unico che va al cloud. */
export const BACKGROUND_GENERICO =
  'Follow the project instructions (CLAUDE.md or AGENTS.md): work in your worktree, push the branch and report to whoever ' +
  'proposed the action; do not merge into main.'

/**
 * Valori di ripiego per DISEGNARE il pannello quando routing.json non si legge. `lette: false` blocca
 * ogni avvio: le regole non si allentano mai in silenzio.
 */
export const SOGLIA_PREDEFINITA: Soglia = { attenzione: 70, critica: 90 }
/**
 * F6.4: la spesa a crediti API del mese, dal registro dell'helper (`spesa-api.json`): contato = costo stimato (ignoto =
 * tetto), prenotato = tetto. null se il registro non ha la forma attesa. Stessa somma dell'helper che prenota.
 */
export function spesaDelMese(s: unknown, mese: string, progetto?: string): number | null {
  if (!s || typeof s !== 'object' || (s as { v?: unknown }).v !== 1) return null
  const voci = (s as { voci?: unknown }).voci
  if (!voci || typeof voci !== 'object') return null
  let tot = 0
  for (const v of Object.values(voci as Record<string, unknown>)) {
    if (!v || typeof v !== 'object') return null
    const x = v as { mese?: unknown; tetto?: unknown; costo?: unknown; stato?: unknown; progetto?: unknown }
    // F10: il registro dell'account; ogni voce porta il progetto (come la convalida l'helper).
    if (typeof x.progetto !== 'string' || !x.progetto || x.progetto.length > 400) return null
    // Una voce non valida rende illeggibile tutto il registro (l'helper, per lo stesso motivo, non prenota più).
    if (typeof x.mese !== 'string' || !/^\d{4}-\d{2}$/.test(x.mese) || typeof x.tetto !== 'number' || !Number.isFinite(x.tetto) || x.tetto <= 0) return null
    if (x.stato === 'prenotato' ? x.costo !== undefined : x.stato !== 'contato' || !(x.costo === null || (typeof x.costo === 'number' && Number.isFinite(x.costo) && x.costo >= 0))) return null
    if (x.mese !== mese || (progetto !== undefined && x.progetto !== progetto)) continue
    tot += x.stato === 'contato' && typeof x.costo === 'number' ? x.costo : x.tetto
  }
  return Math.round(tot * 100) / 100
}

/** F6.2: il tetto predefinito di spesa per tentativo (`--max-budget-usd`), in USD; può essere superato. */
export const TETTO_API_PREDEFINITO = 2
export const RISORSE_DEFAULT: RisorseProgetto = {
  fornitori: ['claude', 'codex'], soloLocale: false, milestoneGithub: false, pesi: [], limitiManuali: [],
  freellmapi: { livello: 'niente', endpoint: 'http://localhost:3001/v1' },
  compatibili: {},
  soglie: { claude: SOGLIA_PREDEFINITA, codex: SOGLIA_PREDEFINITA, deepseek: SOGLIA_PREDEFINITA, freellmapi: SOGLIA_PREDEFINITA },
  board: { modo: 'spenta', generazione: 0 },
  account: { soglie: {}, limitiManuali: [] },
  strato: { soglie: {}, freellmapi: { livello: 'niente' }, restrizioni: {} },
  modoLavoro: { effortPredefinito: { R0: 'medium', R1: 'medium', R2: 'medium', R3: 'high', R4: 'high', R5: 'high' }, codexSandbox: 'workspace-write', auditorSuggerito: false, revisioneIncrociata: true },
}
export const REGOLE_DEFAULT: Regole = {
  lette: false,
  modelli: {
    claude: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-fable-5-1', 'claude-haiku-5-5'],
    codex: ['gpt-6.1-sol', 'gpt-6-astra'],
    freellmapi: [],
    // F13.3b: models of registry providers come from their catalogue at run time; none here, so `bilancia` never picks them.
    compatibile: [],
  },
  effort: ['low', 'medium', 'high', 'xhigh'],
  tetto: { 'claude-fable-5-1': 'xhigh' },
  revisori: {},
  corsiaCodex: { corsie: ['R1', 'R2', 'R3'], effort: {}, rivistoDa: {} },
  sensibili: [],
  background: BACKGROUND_GENERICO,
  fonte: '',
  risorse: RISORSE_DEFAULT,
}
export const EFFORT = REGOLE_DEFAULT.effort
export const CORSIE: readonly Corsia[] = ['R0', 'R1', 'R2', 'R3', 'R4', 'R5']
const COORDINATORE_PREDEFINITO = 'claude-sonnet-5-5'

/** routing.json → regole. Un campo assente o fuori forma ricade sul predefinito, mai su «tutto ammesso». */
export function regoleDa(json: unknown, fonte: string): Regole {
  const r = (json ?? {}) as Record<string, unknown>
  const lista = (v: unknown) => (Array.isArray(v) && v.every(x => typeof x === 'string') ? (v as string[]) : undefined)
  const mappa = (v: unknown) => {
    const m: Record<string, string> = {}
    for (const [k, x] of Object.entries((v ?? {}) as Record<string, unknown>)) if (!k.startsWith('_') && typeof x === 'string') m[k] = x
    return m
  }
  const ammessi = lista(r.modelli_ammessi)
  // `max` non è mai un livello di partenza (routing.json, _nota): il pannello non lo offre.
  const effort = lista(r.effort_ammessi)?.filter(e => e !== 'max')
  const revisori: Record<string, string[]> = {}
  const rev = ((r.revisione as Record<string, unknown> | undefined)?.revisori_ammessi_per_autore ?? {}) as Record<string, unknown>
  for (const [k, v] of Object.entries(rev)) {
    const l = lista(v)
    if (l) revisori[k] = l
  }
  const cc = (r.corsia_codex ?? {}) as Record<string, unknown>
  const esegue = (cc.esegue ?? {}) as Record<string, unknown>
  return {
    // «Lette» solo se ci sono tutte le sezioni che il pannello applica: una parziale non allenta i vincoli.
    lette:
      !!ammessi &&
      !!effort?.length &&
      Object.keys(revisori).length > 0 &&
      !!lista(esegue.corsie) &&
      !!lista(cc.modelli) &&
      Object.keys(mappa(cc.effort)).length > 0 &&
      Object.keys(mappa(cc.rivisto_da)).length > 0,
    modelli: {
      claude: ammessi?.filter(m => m.startsWith('claude-')) ?? REGOLE_DEFAULT.modelli.claude,
      codex: (lista(cc.modelli) ?? ammessi?.filter(m => m.startsWith('gpt-'))) ?? REGOLE_DEFAULT.modelli.codex,
      freellmapi: lista((r.freellmapi as Record<string, unknown> | undefined)?.modelli)?.filter(m => /^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,99}$/.test(m) && !/^(auto|fusion|claude-)/i.test(m)) ?? [],
      compatibile: [],
    },
    effort: effort?.length ? effort : REGOLE_DEFAULT.effort,
    tetto: mappa(r.tetto_per_modello),
    revisori,
    corsiaCodex: {
      corsie: lista(esegue.corsie) ?? REGOLE_DEFAULT.corsiaCodex.corsie,
      effort: mappa(cc.effort),
      rivistoDa: mappa(cc.rivisto_da),
    },
    sensibili: [],
    background: BACKGROUND_GENERICO,
    fonte,
    risorse: RISORSE_DEFAULT,
  }
}

/** La sezione di un progetto nella configurazione locale (`~/.claude/chipmanager/config.json`). */
export type Progetto = { routing: string; sensibili: string[]; background: string; risorse: RisorseProgetto }
const ROUTING_PREDEFINITO = '.claude/routing.json'
const PROGETTO_PREDEFINITO: Progetto = { routing: ROUTING_PREDEFINITO, sensibili: [], background: BACKGROUND_GENERICO, risorse: RISORSE_DEFAULT }

/**
 * `config` = il JSON della configurazione (`null` se il file non c'è). Restituisce la sezione del progetto o il
 * motivo per cui la configurazione non vale: chi chiama tratta il motivo come regole non lette (nessun avvio).
 */
export function progettoDa(config: unknown, repo: string | null): Progetto | Msg {
  // Un config assente vale come vuoto: la stessa lettura (e la stessa forma) di quella fatta prima di scriverlo.
  if (config === null || config === undefined) return progettoDa({}, repo)
  const oggetto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
  if (!oggetto(config)) return msg('cfg.nonOggetto')
  const progetti = config.progetti ?? {}
  if (!oggetto(progetti)) return msg('cfg.progetti')
  const p = repo ? progetti[repo] : undefined
  // F10: l'account vale anche per un progetto senza sezione nel config.
  if (p === undefined) {
    const risorse = risorseDa({}, config.account)
    return eMsg(risorse) ? risorse : { ...PROGETTO_PREDEFINITO, risorse }
  }
  if (!oggetto(p)) return msg('cfg.progetto', { repo: repo ?? '' })
  const { routing, sensibili, background } = p
  if (routing !== undefined && (typeof routing !== 'string' || !routing || /^([a-z]:)?[\\/]/i.test(routing) || /(^|[\\/])\.\.([\\/]|$)/.test(routing)))
    return msg('cfg.routing')
  if (sensibili !== undefined && (!Array.isArray(sensibili) || !sensibili.every(t => typeof t === 'string' && t.length > 0 && t.length <= 200)))
    return msg('cfg.sensibili')
  for (const t of (sensibili ?? []) as string[]) {
    try {
      new RegExp(t, 'i')
    } catch {
      return msg('cfg.termine', { termine: t.slice(0, 40) })
    }
  }
  if (p.cartella !== undefined && (typeof p.cartella !== 'string' || p.cartella.length > 400 || !/^(~(?=[\\/]|$)|[a-z]:[\\/]|[\\/])/i.test(p.cartella)))
    return msg('cfg.cartella')
  if (background !== undefined && (typeof background !== 'string' || background.length > 2000))
    return msg('cfg.background')
  const risorse = risorseDa(p, config.account)
  if (eMsg(risorse)) return risorse
  return {
    routing: (routing as string | undefined) ?? ROUTING_PREDEFINITO,
    sensibili: (sensibili as string[] | undefined) ?? [],
    background: (background as string | undefined) ?? BACKGROUND_GENERICO,
    risorse,
  }
}

export const FORNITORI: readonly Fornitore[] = ['claude', 'codex', 'deepseek', 'freellmapi']
const oggettoRisorse = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const numero = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max

/** Endpoint esattamente loopback: niente credenziali, DNS arbitrario, query o redirect. */
export const endpointLocale = (s: unknown): s is string => typeof s === 'string' && /^http:\/\/(?:localhost|127\.0\.0\.1|\[::1\]):[1-9][0-9]{0,4}\/v1$/.test(s) && Number(s.match(/:([0-9]+)\/v1$/)?.[1]) <= 65535

export function pesoValido(p: unknown): p is Peso {
  return oggettoRisorse(p) && ['fornitore', 'modello', 'effort'].includes(String(p.tipo)) &&
    typeof p.nome === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,99}$/.test(p.nome) &&
    numero(p.percentuale, -100, 1000) && numero(p.assoluto, -100, 1000)
}

/** Soglie di uno strato senza predefiniti (assente = eredita, null = nessuna); undefined se la forma non vale. */
function soglieDa(v: unknown): SogliePerStrato | undefined {
  const soglie = v ?? {}
  if (!oggettoRisorse(soglie) || !Object.entries(soglie).every(([k, s]) => FORNITORI.includes(k as Fornitore) &&
      (s === null || (oggettoRisorse(s) && numero(s.attenzione, 1, 100) && numero(s.critica, 1, 100) && s.attenzione < s.critica)))) return undefined
  return Object.fromEntries(Object.entries(soglie).map(([k, s]) => [k, s === null ? null : { attenzione: (s as Soglia).attenzione, critica: (s as Soglia).critica }]))
}

/** I budget manuali di uno strato, nella forma letta (id con il prefisso `manuale-`); undefined se la forma non vale. */
function manualiDa(v: unknown, progetto: boolean): Limite[] | undefined {
  const manuali = v ?? []
  if (!Array.isArray(manuali) || manuali.length > 30) return undefined
  const limitiManuali: Limite[] = []
  for (const x of manuali) {
    if (!oggettoRisorse(x) || !FORNITORI.includes(x.fornitore as Fornitore) || typeof x.id !== 'string' || !/^[a-z0-9-]{1,60}$/.test(x.id) ||
        typeof x.nome !== 'string' || !/^[\p{L}\p{N} .()%-]{1,60}$/u.test(x.nome) ||
        typeof x.letto !== 'string' || !Number.isFinite(Date.parse(x.letto)) || Date.parse(x.letto) > Date.now() + 60_000 ||
        (x.percentuale !== undefined && !numero(x.percentuale, 0, 100)) ||
        (x.valore !== undefined && !numero(x.valore, 0, 1e12)) || !['%', 'USD', 'CNY', 'EUR', 'richieste', 'token'].includes(String(x.unita)) ||
        (x.percentuale === undefined && x.valore === undefined)) return undefined
    limitiManuali.push({ id: `manuale-${x.id}`, fornitore: x.fornitore as Fornitore, nome: x.nome, letto: x.letto,
      percentuale: x.percentuale as number | undefined, valore: x.valore as number | undefined, unita: x.unita as Limite['unita'], fonte: 'manuale', manuale: true,
      ...(progetto && { progetto: true as const }) })
  }
  return limitiManuali
}

/**
 * F10: lo strato Account (`account` nella radice del config). Assente = vuoto; una forma non valida ferma tutto (nel
 * dubbio si blocca). Campi sconosciuti ignorati: una versione più nuova può aggiungerne.
 */
// --- F11.1: il modo di lavoro --------------------------------------------------------------------------------------
const EFFORT_MODO = ['low', 'medium', 'high', 'xhigh'] as const
const CORSIE_MODO: readonly Corsia[] = ['R0', 'R1', 'R2', 'R3', 'R4', 'R5']
const CAMPI_MODO = ['effortPredefinito', 'codexSandbox', 'parallelo', 'auditorSuggerito', 'revisioneIncrociata', 'skillBase']
/** F13.7: the baseline skill ids the work mode may turn on or off (absent = the entry's default). */
const ID_SKILL = SKILL_BASE.map(v => v.id)
/** Le corsie dove l'effort non scende sotto high: un valore più basso viola la guardia e non vale. */
const sottoHigh = (c: string, x: string) => (c === 'R4' || c === 'R5') && EFFORT_MODO.indexOf(x as never) < 2

/**
 * Il modo di lavoro di uno strato come si legge: un campo che non vale (forma, valore o guardia) si ignora, come se non
 * ci fosse (eredita). Null = assente. Le guardie restano le stesse dell'avvio: R4/R5 mai sotto high.
 */
export function modoDa(v: unknown): ModoLavoro {
  if (!oggettoRisorse(v)) return {}
  const out: ModoLavoro = {}
  if (oggettoRisorse(v.effortPredefinito)) {
    const e: NonNullable<ModoLavoro['effortPredefinito']> = {}
    for (const c of CORSIE_MODO) {
      const x = v.effortPredefinito[c]
      if (typeof x === 'string' && (EFFORT_MODO as readonly string[]).includes(x) && !sottoHigh(c, x)) e[c] = x as (typeof EFFORT_MODO)[number]
    }
    if (Object.keys(e).length) out.effortPredefinito = e
  }
  if (v.codexSandbox === 'workspace-write' || v.codexSandbox === 'read-only') out.codexSandbox = v.codexSandbox
  if (Number.isInteger(v.parallelo) && (v.parallelo as number) >= 1 && (v.parallelo as number) <= 8) out.parallelo = v.parallelo as number
  if (typeof v.auditorSuggerito === 'boolean') out.auditorSuggerito = v.auditorSuggerito
  if (typeof v.revisioneIncrociata === 'boolean') out.revisioneIncrociata = v.revisioneIncrociata
  if (oggettoRisorse(v.skillBase)) {
    const s = Object.fromEntries(Object.entries(v.skillBase).filter(([k, x]) => ID_SKILL.includes(k) && typeof x === 'boolean')) as Record<string, boolean>
    if (Object.keys(s).length) out.skillBase = s
  }
  return out
}

/** In scrittura il modo di lavoro si rifiuta con il nome del primo campo che non vale (null = togli il campo). */
export function modoNonValido(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined
  if (!oggettoRisorse(v)) return 'modoLavoro'
  const ignoto = Object.keys(v).find(k => !CAMPI_MODO.includes(k))
  if (ignoto) return `modoLavoro.${ignoto.replace(/[^A-Za-z0-9_]/g, '?').slice(0, 40)}`
  const e = v.effortPredefinito
  if (e !== undefined && e !== null) {
    if (!oggettoRisorse(e)) return 'modoLavoro.effortPredefinito'
    for (const [c, x] of Object.entries(e))
      if (!CORSIE_MODO.includes(c as Corsia) || (x !== null && (typeof x !== 'string' || !(EFFORT_MODO as readonly string[]).includes(x) || sottoHigh(c, x))))
        return `modoLavoro.effortPredefinito.${c.replace(/[^A-Za-z0-9_]/g, '?').slice(0, 10)}`
  }
  if (v.codexSandbox !== undefined && v.codexSandbox !== null && v.codexSandbox !== 'workspace-write' && v.codexSandbox !== 'read-only') return 'modoLavoro.codexSandbox'
  if (v.parallelo !== undefined && v.parallelo !== null && !(Number.isInteger(v.parallelo) && (v.parallelo as number) >= 1 && (v.parallelo as number) <= 8)) return 'modoLavoro.parallelo'
  for (const k of ['auditorSuggerito', 'revisioneIncrociata'])
    if (v[k] !== undefined && v[k] !== null && typeof v[k] !== 'boolean') return `modoLavoro.${k}`
  const sb = v.skillBase
  if (sb !== undefined && sb !== null) {
    if (!oggettoRisorse(sb)) return 'modoLavoro.skillBase'
    for (const [k, x] of Object.entries(sb)) if (!ID_SKILL.includes(k) || (x !== null && typeof x !== 'boolean')) return `modoLavoro.skillBase.${k.replace(/[^A-Za-z0-9_-]/g, '?').slice(0, 40)}`
  }
  return undefined
}

/** Il modo efficace: per campo il progetto sostituisce l'account, poi i predefiniti (R0–R2 medium, R3–R5 high, Codex workspace-write). */
export function modoEfficace(account: ModoLavoro | undefined, progetto: ModoLavoro | undefined): ModoLavoroEfficace {
  const d = RISORSE_DEFAULT.modoLavoro
  const effortPredefinito = Object.fromEntries(CORSIE_MODO.map(c => [c, progetto?.effortPredefinito?.[c] ?? account?.effortPredefinito?.[c] ?? d.effortPredefinito[c]])) as ModoLavoroEfficace['effortPredefinito']
  const parallelo = progetto?.parallelo ?? account?.parallelo
  return {
    effortPredefinito,
    codexSandbox: progetto?.codexSandbox ?? account?.codexSandbox ?? d.codexSandbox,
    ...(parallelo !== undefined && { parallelo }),
    auditorSuggerito: progetto?.auditorSuggerito ?? account?.auditorSuggerito ?? d.auditorSuggerito,
    revisioneIncrociata: progetto?.revisioneIncrociata ?? account?.revisioneIncrociata ?? d.revisioneIncrociata,
    // F13.7: per skill the project replaces the account; empty = absent, so payloads without the field stay as before.
    ...(Object.keys({ ...account?.skillBase, ...progetto?.skillBase }).length && { skillBase: { ...account?.skillBase, ...progetto?.skillBase } }),
  }
}

export function accountDa(v: unknown): StratoAccount | Msg {
  const errore = msg('cfg.account')
  if (v === undefined || v === null) return { soglie: {}, limitiManuali: [] }
  if (!oggettoRisorse(v)) return errore
  const soglie = soglieDa(v.soglie)
  const limitiManuali = manualiDa(v.limitiManuali, false)
  if (!soglie || !limitiManuali) return errore
  const api = v.apiClaude === null ? undefined : v.apiClaude
  if (api !== undefined && (!oggettoRisorse(api) || !numero(api.budgetUsd, 0.01, 100_000) || (api.tetto !== undefined && !numero(api.tetto, 0.01, 1_000)))) return errore
  const f = v.freellmapi === null ? undefined : v.freellmapi
  if (f !== undefined && (!oggettoRisorse(f) || (f.endpoint !== undefined && !endpointLocale(f.endpoint)))) return errore
  const compatibili = impostazioniCompatibiliDa(v.compatibili)
  if (!compatibili) return errore
  // Grezzo, come sta nel file: il tetto predefinito vale solo per i valori efficaci (rilievo 5), mai per basi e proposte.
  return { soglie, limitiManuali, ...(api && { apiClaude: { budgetUsd: api.budgetUsd as number, ...(api.tetto !== undefined && { tetto: api.tetto as number }) } }),
    ...(f && typeof f.endpoint === 'string' && { freellmapi: { endpoint: f.endpoint } }),
    ...(Object.keys(compatibili).length && { compatibili }),
    ...(v.modoLavoro !== undefined && v.modoLavoro !== null && { modoLavoro: modoDa(v.modoLavoro) }) }
}

/** F10: le restrizioni del progetto (`progetti[repo].restrizioni`); undefined se la forma non vale. */
export function restrizioniDa(v: unknown): Restrizioni | undefined {
  if (v === undefined || v === null) return {}
  if (!oggettoRisorse(v)) return undefined
  const soglie = v.soglie === undefined ? undefined : soglieDa(v.soglie)
  if (v.soglie !== undefined && !soglie) return undefined
  if (v.apiLimiteMeseUsd !== undefined && !numero(v.apiLimiteMeseUsd, 0.01, 100_000)) return undefined
  if (v.apiTetto !== undefined && !numero(v.apiTetto, 0.01, 1_000)) return undefined
  return { ...(soglie && { soglie }), ...(v.apiLimiteMeseUsd !== undefined && { apiLimiteMeseUsd: v.apiLimiteMeseUsd as number }),
    ...(v.apiTetto !== undefined && { apiTetto: v.apiTetto as number }) }
}

/** Tre stati per strato: assente eredita, null non mette soglie, un valore vince su null; fra due valori il più severo per livello. */
export function sogliaPiuSevera(a: Soglia | null | undefined, b: Soglia | null | undefined): Soglia | null | undefined {
  if (a === undefined) return b
  if (b === undefined || b === null) return a
  if (a === null) return b
  return { attenzione: Math.min(a.attenzione, b.attenzione), critica: Math.min(a.critica, b.critica) }
}

/**
 * F10: le regole efficaci di un progetto, l'unico punto in cui account e progetto si combinano (gemello CJS in
 * `strumenti/regole.cjs`, stesso risultato, per l'helper che prenota la spesa). Il progetto può solo restringere:
 * soglie e tetti al più severo; senza `account.apiClaude` la corsia API è spenta; l'endpoint di progetto sostituisce
 * quello dell'account (eccezione dichiarata); i budget manuali si sommano, a parità di id vince quello di progetto.
 */
export function regoleEfficaci(account: StratoAccount, progetto: StratoProgetto & { limitiManuali: Limite[] }) {
  const r = progetto.restrizioni
  const soglie = Object.fromEntries(FORNITORI.map(f => {
    const s = sogliaPiuSevera(account.soglie[f], sogliaPiuSevera(progetto.soglie[f], r.soglie?.[f]))
    return [f, s === undefined ? SOGLIA_PREDEFINITA : s]
  })) as Record<Fornitore, Soglia | null>
  let apiClaude: RisorseProgetto['apiClaude']
  if (account.apiClaude) {
    const tetto = Math.min(account.apiClaude.tetto ?? TETTO_API_PREDEFINITO, r.apiTetto ?? Infinity, progetto.apiClaude?.tetto ?? Infinity)
    const limite = Math.min(r.apiLimiteMeseUsd ?? Infinity, progetto.apiClaude?.budgetUsd ?? Infinity)
    apiClaude = { budgetUsd: account.apiClaude.budgetUsd, tetto, ...(limite < account.apiClaude.budgetUsd && { limiteProgettoUsd: limite }) }
  }
  const diProgetto = new Set(progetto.limitiManuali.map(l => l.id))
  return {
    soglie,
    apiClaude,
    endpoint: progetto.freellmapi.endpoint ?? account.freellmapi?.endpoint ?? RISORSE_DEFAULT.freellmapi.endpoint,
    limitiManuali: [...account.limitiManuali.filter(l => !diProgetto.has(l.id)), ...progetto.limitiManuali],
    modoLavoro: modoEfficace(account.modoLavoro, progetto.modoLavoro),
  }
}

/**
 * F10: perché una restrizione allargherebbe l'account (il progetto può solo restringere), o undefined. Si controlla a ogni
 * scrittura delle restrizioni: soglie (più severo = valore più basso, anche rispetto ai 70/90 predefiniti), limite del
 * mese e tetto per tentativo.
 */
export function restrizioneLarga(account: StratoAccount, r: Restrizioni): Msg | undefined {
  for (const f of FORNITORI) {
    const p = r.soglie?.[f]
    if (p === undefined) continue
    const a = account.soglie[f] === undefined ? SOGLIA_PREDEFINITA : account.soglie[f]
    if (a !== null && (p === null || p.attenzione > a.attenzione || p.critica > a.critica)) return msg('cfg.restrizioneSoglia', { fornitore: f })
  }
  if (r.apiLimiteMeseUsd !== undefined && (!account.apiClaude || r.apiLimiteMeseUsd > account.apiClaude.budgetUsd)) return msg('cfg.restrizioneApi')
  if (r.apiTetto !== undefined && (!account.apiClaude || r.apiTetto > (account.apiClaude.tetto ?? TETTO_API_PREDEFINITO))) return msg('cfg.restrizioneApi')
  return undefined
}

/** Copia solo campi conosciuti: un config non può portare credenziali dentro lo stato. F10: `account` è la radice `account`. */
export function risorseDa(p: Record<string, unknown>, accountGrezzo?: unknown): RisorseProgetto | Msg {
  const account = accountDa(accountGrezzo)
  if (eMsg(account)) return account
  const errore = msg('cfg.risorse')
  const fornitori = p.fornitori ?? RISORSE_DEFAULT.fornitori
  if (!Array.isArray(fornitori) || !fornitori.every(f => FORNITORI.includes(f))) return errore
  if (p.soloLocale !== undefined && typeof p.soloLocale !== 'boolean') return errore
  if (p.milestoneGithub !== undefined && typeof p.milestoneGithub !== 'boolean') return errore
  const f = p.freellmapi ?? RISORSE_DEFAULT.freellmapi
  if (!oggettoRisorse(f) || !['niente', 'R1', 'R2'].includes(String(f.livello)) || !endpointLocale(f.endpoint ?? RISORSE_DEFAULT.freellmapi.endpoint)) return errore
  const pesi = p.pesi ?? []
  if (!Array.isArray(pesi) || pesi.length > 100 || !pesi.every(pesoValido) || new Set(pesi.map(x => `${x.tipo}:${x.nome}`)).size !== pesi.length) return errore
  const compatibili = livelliCompatibiliDa(p.compatibili)
  if (!compatibili) return errore
  const manualiProgetto = manualiDa(p.limitiManuali, true)
  if (!manualiProgetto) return errore
  // Soglie per fornitore dello strato Progetto: assente = eredita (70/90 se nessuno strato ne ha), null = nessuna soglia.
  const soglieProgetto = soglieDa(p.soglie)
  const restrizioni = restrizioniDa(p.restrizioni)
  if (!soglieProgetto || !restrizioni) return errore
  // Board: assente = spenta; `generazione` la incrementa l'helper a ogni cambio di modo.
  const b = p.board ?? RISORSE_DEFAULT.board
  if (!oggettoRisorse(b) || !['spenta', 'accesa', 'riassunti'].includes(String(b.modo)) ||
      (b.generazione !== undefined && !(Number.isInteger(b.generazione) && (b.generazione as number) >= 0))) return errore
  const board: BoardProgetto = { modo: b.modo as BoardProgetto['modo'], generazione: (b.generazione as number | undefined) ?? 0 }
  // Una preferenza, non un permesso: ogni forma che non è uno dei cinque nomi vale come assente.
  const profilo = typeof p.profilo === 'string' && ['automatico', 'risparmio', 'qualita', 'velocita', 'personalizzato'].includes(p.profilo)
    ? (p.profilo as RisorseProgetto['profilo']) : undefined
  // Revisione e origine dei pesi le scrive solo l'helper: servono al pannello per dire se un'applicazione si annulla
  // ancora. Una forma diversa vale come assente (revisione 0, origine manuale); l'helper ricontrolla sotto lock.
  const pesiRevisione = Number.isInteger(p.pesiRevisione) && (p.pesiRevisione as number) >= 0 ? (p.pesiRevisione as number) : undefined
  const o = p.pesiOrigine
  const pesiOrigine = oggettoRisorse(o) && ['proposta', 'annullamento', 'manuale'].includes(String(o.tipo)) &&
    (o.id === undefined || typeof o.id === 'string') && (o.voce === undefined || typeof o.voce === 'string') && (o.versione === undefined || Number.isInteger(o.versione))
    ? { tipo: o.tipo as NonNullable<RisorseProgetto['pesiOrigine']>['tipo'], ...(typeof o.id === 'string' && { id: o.id.slice(0, 60) }),
        ...(typeof o.voce === 'string' && { voce: o.voce.slice(0, 60) }), ...(Number.isInteger(o.versione) && { versione: o.versione as number }) }
    : undefined
  // F6.2: budget del mese e tetto per tentativo in USD (l'unità di total_cost_usd); assente = API non configurata.
  // null = tolta dalle Impostazioni (Applica scrive null per togliere un campo): vale come assente.
  // F10: l'`apiClaude` di progetto viene dai build di sviluppo: vale come restrizione (limite del mese e tetto), non si
  // riscrive mai in un'altra forma. null = tolto: vale come assente.
  const api = p.apiClaude === null ? undefined : p.apiClaude
  if (api !== undefined && (!oggettoRisorse(api) || !numero(api.budgetUsd, 0.01, 100_000) || (api.tetto !== undefined && !numero(api.tetto, 0.01, 1_000))))
    return errore
  // F6.5: una preferenza; ogni altra forma vale come spento.
  const consigliere = p.consigliere === 'suggerisci' || p.consigliere === 'applica' ? p.consigliere : undefined
  const livello = f.livello as RisorseProgetto['freellmapi']['livello']
  const strato: StratoProgetto = {
    soglie: soglieProgetto,
    ...(api && { apiClaude: { budgetUsd: api.budgetUsd as number, ...(api.tetto !== undefined && { tetto: api.tetto as number }) } }),
    // Solo un endpoint scritto nel progetto lo sostituisce: il predefinito non vale come eccezione.
    freellmapi: { livello, ...(p.freellmapi !== undefined && p.freellmapi !== null && typeof f.endpoint === 'string' && { endpoint: f.endpoint }) },
    restrizioni,
    ...(p.modoLavoro !== undefined && p.modoLavoro !== null && { modoLavoro: modoDa(p.modoLavoro) }),
  }
  const e = regoleEfficaci(account, { ...strato, limitiManuali: manualiProgetto })
  return { ...(e.apiClaude && { apiClaude: e.apiClaude }), ...(consigliere && { consigliere }), board, fornitori: [...fornitori], soloLocale: p.soloLocale === true, milestoneGithub: p.milestoneGithub === true,
    freellmapi: { livello, endpoint: e.endpoint },
    compatibili,
    pesi: pesi.map(x => ({ tipo: x.tipo, nome: x.nome, percentuale: x.percentuale, assoluto: x.assoluto })), limitiManuali: e.limitiManuali,
    soglie: e.soglie,
    modoLavoro: e.modoLavoro,
    ...(profilo && { profilo }), ...(pesiRevisione !== undefined && { pesiRevisione }), ...(pesiOrigine && { pesiOrigine }), account, strato }
}

export const limiteFresco = (l: Limite, adesso = Date.now()) => !l.errore && !!l.letto && adesso >= Date.parse(l.letto) && adesso - Date.parse(l.letto) <= 300_000 && (!l.reset || Date.parse(l.reset) > adesso)
/** La soglia di un fornitore nella politica del progetto (null = nessuna). */
export const sogliaDi = (r: RisorseProgetto, f: Fornitore): Soglia | null => (r.soglie?.[f] === undefined ? SOGLIA_PREDEFINITA : r.soglie[f])
export type Livello = 'ok' | 'attenzione' | 'critica'
export const livelloDi = (percentuale: number, soglia: Soglia | null): Livello =>
  !soglia ? 'ok' : percentuale >= soglia.critica ? 'critica' : percentuale >= soglia.attenzione ? 'attenzione' : 'ok'
/** Il colore del livello su barre e segni: `ok` non ha una tinta di livello, la sua barra è quella del lavoro che va. */
export const COLORE_LIVELLO: Record<Livello, string> = { ok: STATO.inCorso, attenzione: LIVELLO.attenzione, critica: LIVELLO.critica }
// Il manuale si colora per soglia anche se non è «fresco»: è una dichiarazione, non una misura che scade.
export const coloreLimite = (l: Limite, adesso = Date.now(), soglia: Soglia | null = SOGLIA_PREDEFINITA) =>
  (!l.manuale && !limiteFresco(l, adesso)) || l.percentuale === undefined ? GRIGIO : COLORE_LIVELLO[livelloDi(l.percentuale, soglia)]

/** La quota misurata più piena di un fornitore fra quelle fresche (i manuali e la spesa API non sono quote di piano). */
export function piuPieno(limiti: readonly Limite[], f: Fornitore, adesso = Date.now()): Limite | undefined {
  return limiti
    .filter(l => l.fornitore === f && l.id !== 'claude-api' && !l.manuale && l.percentuale !== undefined && limiteFresco(l, adesso))
    .reduce<Limite | undefined>((m, l) => (!m || l.percentuale! > m.percentuale! ? l : m), undefined)
}

/** Un limite ha una misura se porta un numero: una riga con il solo errore non ne ha. */
export const conMisura = (l: Limite) => l.percentuale !== undefined || l.valore !== undefined
// Come in osservaRisorse: la spesa Claude API è una fonte a sé, le altre righe di un fornitore vengono da una lettura sola.
const gruppo = (l: Limite) => (l.id === 'claude-api' ? l.id : l.fornitore)
/**
 * L'ultima misura per id. Un gruppo letto con almeno una misura, o dichiarato letto in `vuoti` (risposta valida senza
 * misure), sostituisce le sue precedenti: un id sparito, come l'uso extra disattivato, esce. Un gruppo fallito (solo
 * errori o assente) le conserva, e invecchiano da sole.
 */
export function conUltime(prima: Readonly<Record<string, Limite>>, limiti: readonly Limite[], vuoti: readonly string[] = []): Record<string, Limite> {
  const misure = limiti.filter(l => !l.manuale && conMisura(l))
  const letti = new Set([...misure.map(gruppo), ...vuoti])
  return { ...Object.fromEntries(Object.entries(prima).filter(([, l]) => !letti.has(gruppo(l)))), ...Object.fromEntries(misure.map(l => [l.id, l])) }
}
/** Come si mostra un limite: barra solo con una misura fresca (o manuale), grigio quando la misura è vecchia. */
export const aspettoLimite = (l: Limite, adesso = Date.now()) => {
  const fresco = limiteFresco(l, adesso)
  return { fresco, barra: l.percentuale !== undefined && (fresco || !!l.manuale), grigio: !fresco && !l.manuale }
}
/** Da quanto un fornitore non ha misure fresche: undefined se non ne ha mai avute o se una è ancora fresca. */
export function etaVecchie(limiti: readonly Limite[], f: Fornitore, adesso = Date.now()): number | undefined {
  const misure = limiti.filter(l => l.fornitore === f && !l.manuale && l.letto)
  if (!misure.length || misure.some(l => limiteFresco(l, adesso))) return undefined
  return Math.max(0, adesso - Math.max(...misure.map(l => Date.parse(l.letto!))))
}
/** Nelle viste operative compare solo un fornitore ammesso con una misura (anche vecchia) o un limite manuale. */
export const fornitoriVisibili = (r: RisorseProgetto, ultime: Readonly<Record<string, Limite>>): Fornitore[] =>
  FORNITORI.filter(f => r.fornitori.includes(f) && [...Object.values(ultime), ...r.limitiManuali].some(l => l.fornitore === f))

/** Il profilo in vigore, unica fonte: quello salvato, altrimenti Personalizzato con dei pesi e Automatico senza. */
export const profiloDi = (r: RisorseProgetto): NonNullable<RisorseProgetto['profilo']> => r.profilo ?? (r.pesi.length ? 'personalizzato' : 'automatico')

/** Automatico si adatta alla corsia: sulle corsie leggere (R0–R1) gli effort alti valgono meno. R2–R5 non cambiano. */
export const MOLTIPLICATORE_CORSIA: Readonly<Record<string, number>> = { high: 0.6, xhigh: 0.4 }
const CORSIE_LEGGERE = ['R0', 'R1']
/** La corsia adatta la scelta solo con il profilo Automatico e su una corsia leggera. */
const corsiaAdatta = (a: Azione, r: Regole) => profiloDi(r.risorse) === 'automatico' && CORSIE_LEGGERE.includes(corsiaDi(a, r) ?? '')
/** La corsia cambia davvero il punteggio di questa chip (effort high o xhigh). */
const corsiaPenalizza = (a: Azione, r: Regole) => corsiaAdatta(a, r) && MOLTIPLICATORE_CORSIA[effortDi(a, r)] !== undefined

/**
 * Peso = preferenza, mai autorizzazione. Quote sconosciute non equivalgono a 100% libero.
 * Precedenza: pesi salvati × moltiplicatore di corsia (solo Automatico) × margine dei limiti ÷ carico.
 */
export function punteggio(a: Azione, r: Regole, limiti: readonly Limite[], lista: readonly Azione[]) {
  let peso = 100
  // R3: l'effort che corsia_codex impone a Codex non è una scelta: con un profilo predefinito la sua penalità non vale
  // (solo per quel valore esatto: un effort sopra resta penalizzato, e i pesi personalizzati valgono come scritti).
  const imposto = a.esecutore === 'codex' && profiloDi(r.risorse) !== 'personalizzato' ? r.corsiaCodex.effort[corsiaDi(a, r) ?? ''] : undefined
  for (const p of r.risorse.pesi) {
    const nome = p.tipo === 'fornitore' ? a.esecutore : p.tipo === 'modello' ? modelloDi(a, r) : effortDi(a, r)
    if (p.tipo === 'effort' && imposto && nome === imposto && p.percentuale + p.assoluto < 0) continue
    if (p.nome === nome) peso *= Math.max(0, 100 * (1 + p.percentuale / 100) + p.assoluto) / 100
  }
  if (corsiaAdatta(a, r)) peso *= MOLTIPLICATORE_CORSIA[effortDi(a, r)] ?? 1
  const quote = limiti.filter(l => l.fornitore === a.esecutore && !l.manuale && l.percentuale !== undefined && limiteFresco(l))
  const pieno = quote.length ? Math.max(...quote.map(l => l.percentuale!)) : undefined
  // Oltre la soglia critica il margine scende a un residuo: la scelta va altrove se un'alternativa ammessa c'è,
  // e se tutti sono oltre, il residuo tiene ancora l'ordine fra di loro.
  const libero = pieno === undefined ? 0.25 : Math.max(0, 1 - pieno / 100)
  const margine = pieno !== undefined && a.esecutore !== 'compatibile' && livelloDi(pieno, sogliaDi(r.risorse, a.esecutore)) === 'critica' ? libero * 0.001 : libero
  const attivi = lista.filter(x => occupa(x) && x.esecutore === a.esecutore && modelloDi(x, r) === modelloDi(a, r)).length
  return peso * margine / (1 + attivi)
}

/** Completa solo opzioni omesse; ogni candidato supera la stessa guardia dell'avvio. */
export function bilancia(a: Azione, espliciti: Record<string, unknown>, r: Regole, limiti: readonly Limite[], lista: readonly Azione[], chi: Chiamante) {
  let scelta = a
  let migliore = -1
  const profilo = profiloDi(r.risorse)
  const corsia = corsiaDi(a, r)
  // R2 (decisione del committente): senza un modello indicato, a parità vince il Claude di rango più basso sulle corsie
  // leggere (R0–R1) con ogni profilo, e su tutte con Risparmio e Velocità. Codex non entra in questo spareggio.
  const perRango = espliciti.modello === undefined && (corsia === 'R0' || corsia === 'R1' || profilo === 'risparmio' || profilo === 'velocita')
  const meglio = (c: Azione, punti: number) => {
    if (migliore < 0 || punti > migliore * (1 + 1e-9)) return true
    if (punti < migliore * (1 - 1e-9)) return false
    // R3: con Risparmio, a parità vince Codex quando è ammesso.
    if (profilo === 'risparmio' && c.esecutore === 'codex' && scelta.esecutore !== 'codex') return true
    return perRango && c.esecutore === 'claude' && scelta.esecutore === 'claude' && rangoModello(c.modello ?? '') < rangoModello(scelta.modello ?? '')
  }
  for (const esecutore of ['claude', 'codex', 'freellmapi'] as const) {
    if (espliciti.esecutore !== undefined && espliciti.esecutore !== esecutore) continue
    for (const modello of r.modelli[esecutore]) {
      if (espliciti.modello !== undefined && espliciti.modello !== modello) continue
      const preferito = effortDi({ ...a, esecutore, modello }, r)
      // Prima il preferito. Solo dove agisce la corsia (Automatico, R0–R1) gli altri vanno dal più vicino (a pari distanza
      // il più basso): così il preferito penalizzato scende di un passo. Altrove l'ordine resta quello di sempre.
      const tutti = effortPer(r, modello)
      const distanza = (e: string) => Math.abs(tutti.indexOf(e) - tutti.indexOf(preferito))
      const altri = tutti.filter(e => e !== preferito)
      if (corsiaAdatta(a, r)) altri.sort((x, y) => distanza(x) - distanza(y) || tutti.indexOf(x) - tutti.indexOf(y))
      const livelli = [preferito, ...altri]
      for (const effort of livelli) {
        if (espliciti.effort !== undefined && espliciti.effort !== effort) continue
        for (const revisore of [a.revisore, ...(a.revisore !== 'claude' ? ['claude' as const] : [])]) {
          if (espliciti.revisore !== undefined && espliciti.revisore !== revisore) continue
          const candidata: Azione = { ...a, esecutore, modello, effort, revisore }
          if (violazioniAvvio(candidata, r, lista, chi).length) continue
          const punti = punteggio(candidata, r, limiti, lista)
          if (meglio(candidata, punti)) { migliore = Math.max(migliore, punti); scelta = candidata }
        }
      }
    }
  }
  return scelta
}

export const modelloDi = (a: Azione, regole: Regole = REGOLE_DEFAULT) => {
  // F13.3b: the model of a registry provider is always explicit (its catalogue is checked when it runs).
  if (a.esecutore === 'compatibile') return a.modello && MODELLO_COMPATIBILE.test(a.modello) ? a.modello : ''
  const ammessi = regole.modelli[a.esecutore]
  return a.modello && ammessi.includes(a.modello) ? a.modello : (ammessi[0] ?? REGOLE_DEFAULT.modelli[a.esecutore][0] ?? '')
}

/** Gli effort offribili per un modello: quelli ammessi fino al suo tetto. */
export function effortPer(regole: Regole, modello: string) {
  const t = regole.tetto[modello]
  const i = t ? regole.effort.indexOf(t) : -1
  return i >= 0 ? regole.effort.slice(0, i + 1) : regole.effort
}

/**
 * L'effort di una chip. Una scelta esplicita ammessa vince (le guardie la controllano all'avvio). Senza scelta (F11.1): il
 * più alto fra il modo di lavoro per la corsia (predefinito R0–R2 medium, R3–R5 high; senza corsia high), il minimo di
 * Codex per la corsia (corsia_codex) e high per R4/R5 o sensibile; FreeLLMAPI low. Poi il primo ammesso da lì in su.
 */
export const effortDi = (a: Azione, regole: Regole = REGOLE_DEFAULT) => {
  const ammessi = effortPer(regole, modelloDi(a, regole))
  if (a.effort && ammessi.includes(a.effort)) return a.effort
  if ((a.esecutore === 'freellmapi' || a.esecutore === 'compatibile') && ammessi.includes('low')) return 'low'
  const ordine = regole.effort
  const corsia = corsiaDi(a, regole)
  const modo = regole.risorse.modoLavoro ?? RISORSE_DEFAULT.modoLavoro
  const candidati = [
    corsia ? modo.effortPredefinito[corsia] : 'high',
    a.esecutore === 'codex' ? regole.corsiaCodex.effort[corsia ?? ''] : undefined,
    corsia === 'R4' || corsia === 'R5' || sensibile(a, regole) ? 'high' : undefined,
  ].filter((x): x is string => !!x && ordine.includes(x))
  const voluto = candidati.reduce((m, x) => (ordine.indexOf(x) > ordine.indexOf(m) ? x : m), candidati[0] ?? 'high')
  return ammessi.find(x => ordine.indexOf(x) >= ordine.indexOf(voluto)) ?? ammessi.at(-1)!
}

// Superfici sensibili in ogni progetto (corsia R4: niente delega in autonomia, revisione obbligatoria). Quelle
// proprie di un progetto, come i nomi dei suoi moduli, arrivano da `regole.sensibili` (configurazione locale).
const SENSIBILE_RE = /\b(auth\w*|login|password|passwd|mfa|otp|csrf|permess\w*|PII|dati[ _-]?personali|codic[ei][ _-]?fiscal\w*)\b/i
const TUTTO = /[\s\S]/
const termini = new Map<string, RegExp | null>()
/** I termini del progetto in una sola espressione; una che non compila rende sensibile tutto (fail-closed). */
function terminiRe(lista: readonly string[] | undefined) {
  const k = (lista ?? []).join('\u0000')
  if (!termini.has(k)) {
    let re: RegExp | null = null
    try {
      re = lista?.length ? new RegExp(`\\b(?:${lista.map(t => `(?:${t})`).join('|')})\\b`, 'i') : null
    } catch {
      re = TUTTO
    }
    termini.set(k, re)
  }
  return termini.get(k)!
}

/**
 * Sensibile se lo dice il testo (titolo, mandato E contesto: tutto ciò che arriva alla sessione), la corsia
 * o il proponente; un `false` esplicito non spegne l'evidenza.
 */
export const sensibile = (a: Pick<Azione, 'sensibile' | 'titolo' | 'brief' | 'corsia' | 'background'>, regole: Pick<Regole, 'sensibili'> & Partial<Pick<Regole, 'background'>>) =>
  causaSensibile(a, regole) !== undefined

/** Perché un'azione è sensibile, una causa sola: per dirlo all'agente che la propone. */
export type CausaSensibile =
  | { tipo: 'flag' }
  | { tipo: 'corsia'; corsia: Corsia }
  | { tipo: 'termine'; termine: string }
  | { tipo: 'listaNonValida' }
  | { tipo: 'termineProgetto'; termine: string }

/**
 * La causa, in quest'ordine: `sensibile: true`, corsia R4/R5, un termine fisso, la lista del progetto che non compila
 * (TUTTO: va detta prima di cercare, perché TUTTO trova qualunque testo), un termine del progetto. undefined = non sensibile.
 */
export function causaSensibile(a: Pick<Azione, 'sensibile' | 'titolo' | 'brief' | 'corsia' | 'background'>, regole: Pick<Regole, 'sensibili'> & Partial<Pick<Regole, 'background'>>): CausaSensibile | undefined {
  if (a.sensibile === true) return { tipo: 'flag' }
  if (a.corsia === 'R4' || a.corsia === 'R5') return { tipo: 'corsia', corsia: a.corsia }
  const testo = `${a.titolo}\n${a.brief}\n${a.background ?? ''}\n${regole.background ?? ''}`
  const fisso = SENSIBILE_RE.exec(testo)
  if (fisso) return { tipo: 'termine', termine: fisso[0] }
  const progetto = terminiRe(regole.sensibili)
  if (progetto === TUTTO) return { tipo: 'listaNonValida' }
  const trovato = progetto?.exec(testo)
  return trovato ? { tipo: 'termineProgetto', termine: trovato[0] } : undefined
}

// Forme di dati che non devono uscire dalla rete locale: codice fiscale,
// email, IP, chiavi private, assegnazioni stile .env, credenziali. Controllo per il cloud: nel dubbio blocca.
const DATI_LOCALI_RE = [
  // codice fiscale, anche omocodico (lettere LMNPQRSTUV al posto delle cifre)
  /\b[A-Z]{6}[\dLMNPQRSTUV]{2}[A-Z][\dLMNPQRSTUV]{2}[A-Z][\dLMNPQRSTUV]{3}[A-Z]\b/i,
  /[^\s@]+@[^\s@]+\.[a-z]{2,}/i,
  /\b(?:\d{1,3}\.){3}\d{1,3}\b/,
  // IPv6 (anche abbreviato): nel dubbio blocca, anche se somiglia a un orario
  /(?:^|[^\w:])(?:[0-9a-f]{0,4}:){2,7}[0-9a-f]{0,4}(?:%\w+)?(?=$|[^\w:])/i,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /^\s*[A-Z][A-Z0-9_]{2,}\s*=\s*\S+/m,
  // credenziali come assegnazione, opzione o chiave JSON/YAML: password=…, "api_key": …, token: …
  /(password|passwd|pwd|secret|token|api[_-]?key|access[_-]?key|client[_-]?secret|private[_-]?key|bearer|authorization)["']?\s*[:=]/i,
  /\bbearer\s+[a-z0-9._~+/-]{12,}/i,
  /\b(?:sk-(?:ant-|proj-)?|freellmapi-|gh[pousr]_)[a-z0-9_-]{16,}\b/i,
  /(^|[\\/\s])\.env\b/,
  /\bstorage[\\/]/i,
]
/** Quanto testo può andare al cloud: tutto quello che parte deve stare nella conferma, leggibile per intero. */
export const CLOUD_MAX = 1500

/** Il testo che il cloud riceverebbe contiene dati che la policy tiene in LAN? */
export const datiLocali = (testo: string) => DATI_LOCALI_RE.some(r => r.test(testo))

export const corsiaDi = (a: Azione, regole: Pick<Regole, 'sensibili'>): Corsia | undefined =>
  sensibile(a, regole) && (!a.corsia || a.corsia < 'R4') ? 'R4' : a.corsia

/** Modelli ammessi come autori sulle corsie sensibili: lì serve verifica avversariale, non risparmio. */
const AUTORI_R4 = ['claude-opus-5-5', 'claude-fable-5-1']

// --- dipendenze ----------------------------------------------------------------------------------

/** Stato delle dipendenze: si sblocca SOLO con dipendenze esistenti e completate (fuse). */
export function dipendenze(a: Azione, lista: readonly Azione[]) {
  const problemi: Msg[] = []
  let aperte = 0
  for (const id of a.dipende) {
    const d = lista.find(x => x.id === id)
    if (!d) problemi.push(msg('v.dipendenzaAssente', { id }))
    else if (d.stato === 'scartata') problemi.push(msg('v.dipendenzaScartata', { titolo: d.titolo }))
    else if (d.stato !== 'completata') aperte += 1
  }
  return { chiuse: problemi.length === 0 && aperte === 0, problemi }
}
export const dipendenzeChiuse = (a: Azione, lista: readonly Azione[]) => dipendenze(a, lista).chiuse

/**
 * Il revisore che il mandato nominerà davvero: `motore:codex`, oppure il modello Claude. Per un autore
 * Codex è il coordinatore della corsia (corsia_codex.rivisto_da); sulle sensibili è Fable avversariale,
 * o Opus se l'autore è già Fable; altrimenti il primo Claude della matrice.
 */
export function revisoreConcreto(a: Azione, regole: Regole): string | undefined {
  if (a.revisore === 'nessuno') return undefined
  if (a.revisore === 'codex') return 'motore:codex'
  // F13.3b: no routing row can exist for an arbitrary catalogue id: the Claude coordinator of the lane reviews, like Codex.
  if (a.esecutore === 'codex' || a.esecutore === 'compatibile') return regole.corsiaCodex.rivistoDa[corsiaDi(a, regole) ?? ''] ?? COORDINATORE_PREDEFINITO
  const autore = modelloDi(a, regole)
  if (sensibile(a, regole)) return autore === 'claude-fable-5-1' ? 'claude-opus-5-5' : 'claude-fable-5-1'
  return (regole.revisori[autore] ?? []).find(r => r.startsWith('claude-') && r !== autore)
}

/** Dove gira davvero un'azione (F6): l'esecutore esterno decide da sé, altrimenti la destinazione. */
export type Modalita = 'local' | 'cloud' | 'api-claude' | 'esterno'
/** La modalità effettiva: una sola funzione per pannello, strumenti e coda, da cui dipendono le guardie. */
export const modalitaDi = (a: Pick<Azione, 'esecutore' | 'destinazione'>): Modalita => (a.esecutore === 'freellmapi' || a.esecutore === 'compatibile' ? 'esterno' : (a.destinazione ?? 'local'))

/** Le destinazioni della 2.2.0 (F6): API Codex e Codex cloud restano fuori. */
export const DESTINAZIONI: readonly Destinazione[] = ['local', 'cloud', 'api-claude']
/** L'azione spostata in `d`: fuori da questa macchina o a crediti API non c'è una conversazione da copiare. */
export const conDestinazione = (a: Azione, d: Destinazione): Azione => ({ ...a, destinazione: d, ...(d !== 'local' && a.contesto === 'fork' && { contesto: 'fresh' as const }) })
/**
 * F6.1: ogni destinazione con, se non è ammessa, il primo motivo che aggiunge rispetto al locale (le guardie sono quelle
 * di `violazioni`, per la modalità effettiva). Il locale non ha motivi suoi: i blocchi comuni li dice già la chip.
 */
export function destinazioniPer(a: Azione, regole: Regole, lista: readonly Azione[] = [], contestoReale = false): { d: Destinazione; motivo?: Msg }[] {
  // contestoReale: si cambia SOLO la destinazione (il consigliere): una chip fork resta fork e il cloud o l'API la escludono.
  const sposta = (d: Destinazione) => (contestoReale ? { ...a, destinazione: d } : conDestinazione(a, d))
  const comuni = new Set(violazioni(sposta('local'), regole, lista).map(m => JSON.stringify(m)))
  return DESTINAZIONI.map(d => ({ d, motivo: violazioni(sposta(d), regole, lista).find(m => !comuni.has(JSON.stringify(m))) }))
}

/**
 * F6.2: impostazioni che cambierebbero chi paga o dove vanno le richieste di `claude -p` (stessa regola dell'helper):
 * credenziali o instradamenti nell'`env`, gateway e fornitori cloud, un `apiKeyHelper`, ogni login imposto. Una forma
 * che non è un oggetto vale come vietata.
 */
export function impostazioniApiVietate(s: unknown): boolean {
  return chiaviApiVietate(s)?.length !== 0
}

/** F6.7: le chiavi responsabili (`env.NOME` per l'ambiente), mai i valori; null se la forma non è un oggetto. */
export function chiaviApiVietate(s: unknown): string[] | null {
  if (!s || typeof s !== 'object' || Array.isArray(s)) return null
  const o = s as Record<string, unknown>
  if (o.env !== undefined && (!o.env || typeof o.env !== 'object' || Array.isArray(o.env))) return null
  const env = Object.keys((o.env as Record<string, unknown> | undefined) ?? {}).filter(k => /^ANTHROPIC_(.*_)?(BASE_URL|AUTH_TOKEN|API_KEY)$/.test(k) ||
    /^(CLAUDE_CODE_USE_|ANTHROPIC_(BEDROCK|VERTEX|FOUNDRY)_)/.test(k) || ['CLAUDE_CODE_OAUTH_TOKEN', 'ANTHROPIC_CUSTOM_HEADERS'].includes(k))
  return [...env.map(k => `env.${k}`), ...Object.keys(o).filter(k => k.startsWith('forceLogin') || ['apiKeyHelper', 'awsAuthRefresh', 'awsCredentialExport', 'gcpAuthRefresh'].includes(k))]
}

/**
 * F6.7: l'uscita di `stato-esecuzione` riletta campo per campo; tutto il resto si scarta (l'helper non fa uscire dati
 * dell'account, e qui non passerebbero comunque). Una forma che non torna vale come controllo fallito.
 */
export function controlloDa(v: unknown): ControlloEsecuzione | undefined {
  const o = v as { claude?: Record<string, unknown>; github?: Record<string, unknown>; codex?: unknown; fonti?: unknown }
  if (!o || typeof o !== 'object' || !o.claude || !o.github || !Array.isArray(o.fonti)) return undefined
  const NOMI = ['utente', 'progetto', 'locale', 'gestite', 'flag', 'ambiente'] as const
  const fonti: ControlloEsecuzione['fonti'] = []
  for (const f of o.fonti as Record<string, unknown>[]) {
    const nome = NOMI.find(n => n === f?.nome)
    if (!nome) return undefined
    const chiavi = Array.isArray(f.chiavi) ? f.chiavi.filter((k): k is string => typeof k === 'string' && /^[A-Za-z0-9_.]{1,80}$/.test(k)).slice(0, 20) : []
    fonti.push({ nome, ...(typeof f.file === 'string' && f.file.length < 500 && { file: f.file }), ...(chiavi.length && { chiavi }), ...(f.illeggibile === true && { illeggibile: true }) })
  }
  const metodo = o.claude.metodo
  const host = o.github.host
  return {
    claude: { trovato: o.claude.trovato === true, loggedIn: o.claude.loggedIn === true, ...(typeof metodo === 'string' && /^[a-z._-]{1,20}$/i.test(metodo) && { metodo }) },
    ...(o.codex && typeof o.codex === 'object' ? { codex: { trovato: (o.codex as Record<string, unknown>).trovato === true, loggedIn: (o.codex as Record<string, unknown>).loggedIn === true } } : {}),
    github: { trovato: o.github.trovato === true, loggedIn: o.github.loggedIn === true, remote: o.github.remote === true, ...(typeof host === 'string' && /^[a-z0-9.-]{1,100}$/i.test(host) && { host }) },
    fonti,
  }
}

/** F6.7: i passi che mancano, in ordine; senza controllo (non ancora fatto o fallito) i tre che ne dipendono non si sanno. */
export function passiMancanti(c: ControlloEsecuzione | undefined, chiave: boolean, budget: boolean): PassoEsecuzione[] {
  const p: PassoEsecuzione[] = []
  if (c && !c.claude.loggedIn) p.push('claude')
  if (c && !(c.github.loggedIn && c.github.remote)) p.push('github')
  if (!chiave) p.push('chiave')
  if (c?.fonti.length) p.push('fonti')
  if (!budget) p.push('budget')
  return p
}

/** Un consiglio di destinazione (F6.5): dove, e il perché in poche parole. */
export type Consiglio = { d: Destinazione; motivi: Msg[] }

/**
 * F6.5: dove far girare una chip SENZA destinazione esplicita, fra quelle ammesse per l'esecutore e il modello già scelti
 * da `bilancia` (il consigliere non tocca modello ed effort). Regole pure, in quest'ordine:
 *  1. una sensibile va sempre in locale;
 *  2. fork, dati da LAN o testo lungo escludono il cloud (lo dicono già le guardie);
 *  3. si scarta ciò che non è configurato o è oltre la soglia critica: per locale e cloud il piano Claude (con Codex
 *     esecutore anche il suo limite: basta uno dei due), per l'API il residuo del budget del mese;
 *  4. preferenza fissa: locale se il piano è sotto l'attenzione; altrimenti cloud per un lavoro lungo o parallelo su un repo
 *     GitHub (consuma lo stesso piano: aiuta il parallelismo e la macchina, non il limite); poi l'API; poi il locale.
 * null = niente da consigliare.
 */
export function consigliaDove(a: Azione, regole: Regole, limiti: readonly Limite[], lista: readonly Azione[], spesaApi?: number | null, adesso = Date.now(), spesaProgetto?: number | null): Consiglio | null {
  if (a.destinazione !== undefined || modalitaDi(a) === 'esterno') return null
  if (sensibile(a, regole)) return { d: 'local', motivi: [msg('cons.sensibile')] }
  const ammesse = destinazioniPer(a, regole, lista, true).filter(x => !x.motivo).map(x => x.d)
  const pct = (f: Fornitore) => piuPieno(limiti, f, adesso)?.percentuale
  const livello = (f: Fornitore) => (pct(f) === undefined ? 'ok' : livelloDi(pct(f)!, sogliaDi(regole.risorse, f)))
  const piano = livello('claude')
  const fuori = new Set<Destinazione>()
  if (piano === 'critica' || (a.esecutore === 'codex' && livello('codex') === 'critica')) fuori.add('local')
  if (piano === 'critica') fuori.add('cloud')
  const api = regole.risorse.apiClaude
  const apiOk = !!api && typeof spesaApi === 'number' && spesaApi + api.tetto <= api.budgetUsd &&
    livelloDi(Math.min(100, (spesaApi / api.budgetUsd) * 100), sogliaDi(regole.risorse, 'claude')) !== 'critica' &&
    // F10: anche il limite del mese del progetto, se c'è (la spesa di questo progetto nel registro dell'account).
    (api.limiteProgettoUsd === undefined || (typeof spesaProgetto === 'number' && spesaProgetto + api.tetto <= api.limiteProgettoUsd))
  if (!apiOk) fuori.add('api-claude')
  const restanti = ammesse.filter(d => !fuori.has(d))
  if (!restanti.length) return null
  const motivoPiano = pct('claude') === undefined ? undefined : msg('cons.piano', { pct: pct('claude')! })
  const motivoBudget = api && typeof spesaApi === 'number' ? msg('cons.budget', { speso: Math.round(spesaApi * 100) / 100, budget: api.budgetUsd }) : undefined
  const scegli = (d: Destinazione, ...m: (Msg | undefined)[]): Consiglio => ({ d, motivi: m.filter((x): x is Msg => !!x) })
  if (restanti.includes('local') && piano === 'ok') return scegli('local', motivoPiano ?? msg('cons.pianoOk'))
  const lungo = corsiaDi(a, regole) === 'R3' || lista.filter(x => ['proposta', 'accodata', 'in-avvio', 'avviata'].includes(x.stato)).length >= 3
  if (restanti.includes('cloud') && lungo && /^[^/\s]+\/[^/\s]+$/.test(a.repo ?? ''))
    return scegli('cloud', motivoPiano, msg('cons.parallelo'), msg('cons.modelloCloud'))
  if (restanti.includes('api-claude') && piano !== 'ok') return scegli('api-claude', motivoPiano, motivoBudget)
  if (restanti.includes('local')) return scegli('local', motivoPiano)
  return scegli(restanti[0]!, motivoPiano)
}

/**
 * F10 (decisione della master): un fornitore è connesso dove si può verificare. Claude e Codex sempre (piani: il login
 * non si legge in modo affidabile); DeepSeek e FreeLLMAPI solo con la chiave presente. Uno non connesso non entra nelle
 * scelte automatiche e una scelta esplicita su di lui non parte.
 */
export const connesso = (r: Pick<Regole, 'connessi'>, f: Fornitore) => f === 'claude' || f === 'codex' || (r.connessi ?? FORNITORI).includes(f)

/** Perché un'azione non può partire così com'è: vuoto = può partire. */
export function violazioni(a: Azione, regole: Regole, lista: readonly Azione[] = []): Msg[] {
  const v: Msg[] = []
  if (!regole.lette) v.push(msg('v.regoleNonLette'))
  const modello = modelloDi(a, regole)
  const effort = effortDi(a, regole)
  const corsia = corsiaDi(a, regole)
  const politica = regole.risorse
  const modo = modalitaDi(a)
  if (politica.soloLocale) v.push(msg('v.soloLocale'))
  // F13.3b: a registry provider is enabled by the project's own opt-in (`compatibili`), connected by its key or by needing none.
  const compatibile = a.esecutore === 'compatibile'
  const livelloEsterno = compatibile ? (politica.compatibili ?? {})[a.provider ?? ''] ?? 'niente' : politica.freellmapi.livello
  if (a.esecutore === 'compatibile') {
    if (!voceCompatibile(a.provider)) v.push(msg('cmp.ignoto', { provider: String(a.provider ?? '—') }))
    else if (livelloEsterno === 'niente') v.push(msg('v.fornitoreNonAbilitato', { fornitore: a.provider! }))
    else if (!(regole.compatibiliConnessi ?? []).includes(a.provider!)) v.push(msg('v.nonConnesso', { fornitore: a.provider! }))
    else {
      const b = baseDi(a.provider!, politica.account?.compatibili?.[a.provider!])
      if ('motivo' in b) v.push(msg('cmp.configurazione', { provider: a.provider!, motivo: b.motivo }))
    }
    if (!modello) v.push(msg('cmp.modello'))
  } else if (!politica.fornitori.includes(a.esecutore)) v.push(msg('v.fornitoreNonAbilitato', { fornitore: a.esecutore }))
  else if (!connesso(regole, a.esecutore)) v.push(msg('v.nonConnesso', { fornitore: a.esecutore }))
  if (a.revisore !== 'nessuno' && !politica.fornitori.includes(a.revisore)) v.push(msg('v.revisoreNonAbilitato', { revisore: a.revisore }))
  if (!compatibile && !regole.modelli[a.esecutore].length) v.push(msg('v.nessunModello', { esecutore: a.esecutore }))
  // Every non-Claude text executor: same lanes, LAN-data filter, text limit, isolation, Claude review and low effort (F13 r1.7).
  if (a.esecutore === 'freellmapi' || compatibile) {
    if (!corsia || !['R0', 'R1', ...(livelloEsterno === 'R2' ? ['R2'] : [])].includes(corsia) || livelloEsterno === 'niente')
      v.push(msg('v.freeCorsia'))
    if (datiLocali(`${a.titolo}\n${a.brief}\n${a.background ?? ''}\n${regole.background}`)) v.push(msg('v.datiLan'))
    if (a.contesto === 'fork' || (a.destinazione ?? 'local') !== 'local' || a.worktree === false) v.push(msg('v.freeIsolato'))
    if (a.titolo.length + a.brief.length > CLOUD_MAX) v.push(msg('v.freeTesto', { max: CLOUD_MAX }))
    if (a.revisore !== 'claude') v.push(msg('v.freeRevisione'))
    if (effort !== 'low') v.push(msg('v.freeEffort'))
  }
  if (a.modello && a.modello !== modello) v.push(msg('v.modelloNonAmmesso', { modello: a.modello, esecutore: a.esecutore }))
  // F7.3: l'auditor solo su Claude, mai nel cloud (non lo si controlla), e solo in una coppia della tabella.
  const auditor = auditorDi(a)
  if (auditor) {
    if (a.esecutore !== 'claude') v.push(msg('au.soloClaude'))
    else {
      const m = motivoAuditor(modello, auditor)
      if (m) v.push(m)
    }
    if (modo === 'cloud') v.push(msg('au.cloud'))
  }
  if (a.effort && a.effort !== effort) v.push(msg('v.effortOltre', { effort: a.effort, modello: nomeModello(modello) }))
  // Il revisore che il mandato nominerà deve stare nella matrice dell'autore e non essere l'autore.
  const rev = revisoreConcreto(a, regole)
  const ammessi = compatibile ? undefined : regole.revisori[modello]
  if (a.revisore !== 'nessuno' && !ammessi && !compatibile)
    v.push(msg('v.rigaRevisori', { modello: nomeModello(modello) }))
  if (a.revisore !== 'nessuno') {
    if (!rev) v.push(msg('v.revisoreClaude', { modello: nomeModello(modello) }))
    else if (rev === modello) v.push(msg('v.revisoreUguale', { modello: nomeModello(modello) }))
    else if (ammessi && !ammessi.includes(rev))
      v.push(msg('v.revisoreNonAmmesso', { revisore: rev === 'motore:codex' ? 'Codex' : nomeModello(rev), modello: nomeModello(modello) }))
  }
  // F6.2: un processo `claude -p` nuovo, su questa macchina, a crediti API: niente conversazione da copiare, un worktree
  // suo, la chiave nelle opzioni sensibili e un budget del mese. I dati non escono più di quanto fa Claude Code locale.
  if (modo === 'api-claude') {
    if (a.esecutore !== 'claude') v.push(msg('v.apiClaude'))
    if (a.contesto === 'fork') v.push(msg('v.apiFork'))
    if (a.worktree === false) v.push(msg('v.apiWorktree'))
    if (!regole.chiaveApi) v.push(msg('v.apiChiave'))
    if (!politica.apiClaude?.budgetUsd) v.push(msg('v.apiBudget'))
  }
  if (modo === 'cloud') {
    if (a.contesto === 'fork') v.push(msg('v.cloudFork'))
    if (a.esecutore === 'codex' || a.revisore === 'codex')
      v.push(msg('v.cloudCodex'))
    // Al cloud va solo titolo + mandato (il contesto locale resta qui): niente dati che la policy tiene in LAN.
    if (datiLocali(`${a.titolo}\n${a.brief}`)) v.push(msg('v.cloudDati'))
    if (a.titolo.length + a.brief.length > CLOUD_MAX)
      v.push(msg('v.cloudTesto', { max: CLOUD_MAX }))
  }
  if (a.esecutore === 'codex') {
    if (!corsia) v.push(msg('v.codexCorsia', { corsie: regole.corsiaCodex.corsie.join(', ') }))
    else if (!regole.corsiaCodex.effort[corsia] || !regole.corsiaCodex.rivistoDa[corsia])
      v.push(msg('v.codexRegola', { corsia }))
    if (corsia && !regole.corsiaCodex.corsie.includes(corsia))
      v.push(msg('v.codexCorsie', { corsie: regole.corsiaCodex.corsie.join(', '), corsia }))
    // L'effort di corsia_codex è un minimo, non un suggerimento.
    const prescritto = regole.corsiaCodex.effort[corsia ?? '']
    if (prescritto && regole.effort.indexOf(effort) < regole.effort.indexOf(prescritto))
      v.push(msg('v.codexEffort', { effort: prescritto, corsia: corsia ?? '' }))
  }
  if (sensibile(a, regole)) {
    if (a.esecutore !== 'claude') v.push(msg('v.r4Autore'))
    if (a.revisore === 'nessuno') v.push(msg('v.r4Revisione'))
    if (a.revisore === 'codex') v.push(msg('v.r4Revisore'))
    if (a.permessi === 'bypassPermissions') v.push(msg('v.r4Bypass'))
    if (modo === 'cloud') v.push(msg('v.r4Cloud'))
    // Le sensibili solo in locale interattivo, con revisione umana: mai un processo a crediti API senza nessuno davanti.
    if (modo === 'api-claude') v.push(msg('v.r4Api'))
    if (a.esecutore === 'claude' && !AUTORI_R4.includes(modello)) v.push(msg('v.r4Modello', { modello: nomeModello(modello) }))
    if (regole.effort.indexOf(effort) < regole.effort.indexOf('high')) v.push(msg('v.r4Effort'))
  }
  v.push(...dipendenze(a, lista).problemi)
  return v
}

/**
 * Le violazioni della configurazione che si OTTERREBBE avviando da `chi`: start_session ignora un modello
 * o un effort sopra quelli di chi avvia, il fork eredita modello ed effort, e «Fallo qui» gira con i
 * permessi di questa sessione. Senza progetto o di un altro progetto non si avvia.
 */
export function violazioniAvvio(a: Azione, regole: Regole, lista: readonly Azione[], chi: Chiamante | null, qui = false): Msg[] {
  const v = violazioni(a, regole, lista)
  if (!chi) return [...v, msg('v.chiIgnoto')]
  if (a.contesto === 'fork' && a.stato === 'accodata' && !a.origineFork && !qui)
    v.push(msg('v.forkSenzaOrigine'))
  if (a.contesto === 'fork' && a.origineFork && a.origineFork !== chi.io && !qui)
    v.push(msg('v.forkAltrui'))
  if (!a.repo) v.push(msg('v.senzaProgetto'))
  else if (!chi.repo) v.push(msg('v.progettoIgnoto'))
  else if (a.repo !== chi.repo) v.push(msg('v.altroProgetto', { repo: a.repo }))
  if (a.esecutore === 'freellmapi' || a.esecutore === 'compatibile') {
    if (qui) v.push(msg('v.freeQui'))
    return v
  }
  // F6.2: l'helper avvia `claude -p` con modello ed effort espliciti: le guardie sulla sessione che avvia non servono.
  if (modalitaDi(a) === 'api-claude') {
    if (qui) v.push(msg('v.apiQui'))
    if (a.permessi === 'bypassPermissions' || a.permessi === 'auto') v.push(msg('v.cliPermessi'))
    return v
  }
  if (!qui && chi.lanciatore === 'ignoto') v.push(msg('v.lanciatoreIgnoto'))
  if (!qui && chi.lanciatore === 'cli') {
    if (a.contesto === 'fork' || a.destinazione === 'cloud' || a.worktree === false) v.push(msg('v.cliWorktree'))
    if (a.permessi === 'bypassPermissions' || a.permessi === 'auto') v.push(msg('v.cliPermessi'))
    return v
  }
  const cloud = a.destinazione === 'cloud' && !qui
  if (cloud) return v
  const eredita = qui || a.contesto === 'fork'
  // Il modello della sessione desktop: l'autore se esegue Claude, il coordinatore della corsia se esegue Codex.
  const richiesto = a.esecutore === 'codex' ? (regole.corsiaCodex.rivistoDa[corsiaDi(a, regole) ?? ''] ?? COORDINATORE_PREDEFINITO) : modelloDi(a, regole)
  const effort = effortDi(a, regole)
  if (chi.modello) {
    if (eredita) {
      if (rangoModello(chi.modello) !== rangoModello(richiesto))
        v.push(msg(qui ? 'v.quiModello' : 'v.forkModello', { attuale: nomeModello(chi.modello), richiesto: nomeModello(richiesto) }))
      // Le regole valgono sulla configurazione effettiva, non su quella scritta nell'azione.
      if (sensibile(a, regole) && rangoModello(chi.modello) < rangoModello('opus'))
        v.push(msg(qui ? 'v.r4QuiModello' : 'v.r4ForkModello', { modello: nomeModello(chi.modello) }))
    } else if (rangoModello(richiesto) > rangoModello(chi.modello))
      v.push(msg('v.modelloSessione', { attuale: nomeModello(chi.modello), richiesto: nomeModello(richiesto) }))
  }
  // Sconosciuto non vuol dire compatibile: dove la guardia dipende da un metadato che manca, si blocca.
  if (!chi.modello && (eredita || a.esecutore === 'claude')) v.push(msg('v.modelloIgnoto'))
  if (!chi.effort && (eredita || sensibile(a, regole))) v.push(msg('v.effortIgnoto'))
  if (qui && !chi.permessi) v.push(msg('v.permessiIgnoti'))
  const eChi = chi.effort ? regole.effort.indexOf(chi.effort) : -1
  if (eChi >= 0) {
    const eVoluto = regole.effort.indexOf(a.esecutore === 'codex' ? 'medium' : effort)
    if (eredita && a.esecutore === 'claude' && eChi !== eVoluto) v.push(msg(qui ? 'v.quiEffort' : 'v.forkEffort', { attuale: chi.effort ?? '', voluto: effort }))
    else if (!eredita && eVoluto > eChi) v.push(msg('v.effortSessione', { attuale: chi.effort ?? '', voluto: effort }))
  }
  if (qui) {
    if (sensibile(a, regole) && chi.permessi === 'bypassPermissions') v.push(msg('v.r4QuiBypass'))
    if (a.permessi && chi.permessi && a.permessi !== chi.permessi)
      v.push(msg('v.permessiDiversi', { attuale: chi.permessi, voluto: a.permessi }))
  }
  return v
}

const RANGO = ['haiku', 'sonnet', 'opus', 'fable']
export const rangoModello = (m: string) => RANGO.findIndex(f => m.toLowerCase().includes(f))

// --- F7.3: auditor (advisor di Claude Code) ------------------------------------------------------------------------
// Una tabella di coppie, separata da `rangoModello`: Claude Code ignora in silenzio un advisor fuori tabella, quindi qui
// una coppia non documentata non si può scegliere e blocca l'avvio. Un id che la tabella non conosce non si sceglie.

/** Fonte, data di lettura e alias (Anthropic API) della tabella; le righe vanno dal modello di rango più basso. */
export const ADVISOR = {
  fonte: 'https://code.claude.com/docs/en/advisor',
  letta: '2026-11-06',
  versione: 1,
  alias: { fable: 'claude-fable-5-1', opus: 'claude-opus-5-5', sonnet: 'claude-sonnet-5-5' } as Record<string, string>,
  /** [modelli che eseguono, advisor ammessi]: `famiglia` = ogni versione, `famiglia-v` = quella, `famiglia>=v` = da quella in su. */
  coppie: [
    [['haiku-4.5', 'sonnet-4.6'], ['fable', 'opus', 'sonnet', 'haiku-5.5']],
    [['opus-4.6'], ['fable', 'opus', 'sonnet>=5', 'haiku-5.5']],
    [['sonnet-5', 'haiku-5.5'], ['fable', 'opus>=4.7', 'sonnet>=5', 'haiku-5.5']],
    [['opus-4.7', 'opus-4.8'], ['fable', 'opus>=4.7', 'sonnet-5.5']],
    [['sonnet-5.5'], ['fable', 'opus>=5', 'sonnet-5.5']],
    [['opus-5', 'opus-5.5'], ['fable', 'opus>=5']],
    [['fable-5'], ['fable-5.1', 'fable-5']],
    [['fable-5.1'], ['fable-5.1']],
  ] as const,
}
/** I modelli che la tabella nomina, come id completi: gli altri non si scelgono né come esecutore né come auditor. */
export const MODELLI_ADVISOR = ['claude-haiku-4-5', 'claude-haiku-5-5', 'claude-sonnet-4-6', 'claude-sonnet-5', 'claude-sonnet-5-5', 'claude-opus-4-6',
  'claude-opus-4-7', 'claude-opus-4-8', 'claude-opus-5', 'claude-opus-5-5', 'claude-fable-5', 'claude-fable-5-1']
const famigliaVersione = (id: string) => {
  const m = /^claude-(haiku|sonnet|opus|fable)-(\d+)(?:-(\d+))?$/.exec(id)
  return m ? { f: m[1]!, v: Number(m[2]) + (m[3] ? Number(m[3]) / 10 : 0) } : undefined
}
const nellaRegola = (regola: string, id: string) => {
  const x = famigliaVersione(id)
  const r = /^([a-z]+)(?:(-|>=)([\d.]+))?$/.exec(regola)
  if (!x || !r || x.f !== r[1]) return false
  return !r[2] || (r[2] === '-' ? x.v === Number(r[3]) : x.v >= Number(r[3]))
}
/** L'auditor richiesto: `nessuno` è una scelta esplicita di non averne (i preset non la toccano), non un modello. */
export const auditorDi = (a: Pick<Azione, 'auditor'>) => (a.auditor && a.auditor !== 'nessuno' ? a.auditor : undefined)
/** L'id dell'auditor: un alias si risolve, un id deve stare nella tabella; null = sconosciuto. */
export const idAuditor = (auditor: string): string | null => ADVISOR.alias[auditor] ?? (MODELLI_ADVISOR.includes(auditor) ? auditor : null)
/** Perché `auditor` non va con il modello che esegue (id sconosciuti, coppia fuori tabella), o undefined se va. */
export function motivoAuditor(esegue: string, auditor: string): Msg | undefined {
  const id = idAuditor(auditor)
  if (!id) return msg('au.ignoto', { auditor: auditor.slice(0, 40) })
  if (!MODELLI_ADVISOR.includes(esegue)) return msg('au.esecutoreIgnoto', { modello: nomeModello(esegue) })
  const riga = ADVISOR.coppie.find(([chi]) => chi.some(r => nellaRegola(r, esegue)))
  if (!riga || !riga[1].some(r => nellaRegola(r, id))) return msg('au.coppia', { auditor: nomeModello(id), modello: nomeModello(esegue) })
  return undefined
}
/** Solo una sessione desktop avviata da questa, con esecutore Claude, ancora al lavoro, e se l'app espone lo strumento. */
export function puoCambiare(a: Azione, chi: Chiamante | null, campo: 'modello' | 'effort') {
  return !!chi && chi.lanciatore === 'desktop' && !!chi.cambia?.includes(campo) && a.stato === 'avviata' && !!a.sessione && !a.lanciatore && !a.qui &&
    a.esecutore === 'claude' && (a.destinazione ?? 'local') === 'local' && a.lanciataDa === chi.io
}

/** Come si applica l'auditor richiesto: con `--advisor` (api-claude), a mano con /advisor (sessioni), o spento per l'avvio. */
export function statoAuditor(a: Azione): 'applicato' | 'manuale' | 'senza' | undefined {
  // «Senza auditor» vale anche per un advisor ereditato: per questo avvio l'advisor è spento comunque.
  if (modalitaDi(a) === 'api-claude' && a.senzaAuditor) return 'senza'
  if (!auditorDi(a)) return undefined
  return modalitaDi(a) === 'api-claude' ? 'applicato' : 'manuale'
}

// --- coda e avvio massivo -----------------------------------------------------------------------

/** Stati che occupano un posto di sessione: partita o in partenza, in una sessione nuova. */
export const occupa = (a: Azione) => (a.stato === 'avviata' || a.stato === 'in-avvio') && !a.qui
/** Stati che tengono la corsia di Codex: un'esecuzione Codex partita o in partenza (anche «qui»). */
const tieneCodex = (a: Azione) => (a.stato === 'avviata' || a.stato === 'in-avvio') && a.esecutore === 'codex'

const TERMINALI: readonly StatoAzione[] = ['completata', 'scartata']
export const attive = (lista: readonly Azione[]) =>
  lista.filter(a => !TERMINALI.includes(a.stato)).sort((x, y) => x.ordine - y.ordine || x.creata.localeCompare(y.creata))

export type Piano = {
  avvia: Azione[]
  coda: { a: Azione; motivo: Msg }[]
  bloccate: { a: Azione; motivi: Msg[] }[]
}

/**
 * Chi parte adesso, chi aspetta e perché, nell'ordine di avvio. Vincoli: le regole (bloccano), le
 * dipendenze, la corsia unica di Codex (due `codex exec` in parallelo si bloccano nella sandbox
 * Windows; `codexOccupato` dice se qualcuno, anche una revisione, tiene il lock della macchina) e il
 * tetto di sessioni in parallelo. Chiamata sotto il lock delle azioni, il piano è una prenotazione.
 */
export function pianifica(
  candidate: readonly Azione[],
  lista: readonly Azione[],
  regole: Regole,
  maxParalleli: number,
  codexOccupato = false,
  extra: (a: Azione) => Msg[] = () => [],
  limiti: readonly Limite[] = [],
): Piano {
  const piano: Piano = { avvia: [], coda: [], bloccate: [] }
  let occupate = lista.filter(occupa).length
  let codex = codexOccupato || lista.some(tieneCodex)
  const ids = new Set(candidate.map(a => a.id))
  // L'ordine scelto dall'utente vale finché non configura pesi o non opera la corsia (Automatico su una chip R0–R1 a
  // effort alto): solo allora il punteggio riordina il massivo. L'ordinamento è stabile: a pari punteggio resta il suo.
  const ordinate = attive(lista).filter(x => ids.has(x.id))
  if (regole.risorse.pesi.length || ordinate.some(a => corsiaPenalizza(a, regole)))
    ordinate.sort((a, b) => punteggio(b, regole, limiti, lista) - punteggio(a, regole, limiti, lista))
  for (const a of ordinate) {
    const motivi = [...violazioni(a, regole, lista), ...extra(a)]
    if (motivi.length) piano.bloccate.push({ a, motivi })
    else if (!dipendenzeChiuse(a, lista)) piano.coda.push({ a, motivo: msg('coda.dipendenze') })
    else if (a.esecutore === 'codex' && codex) piano.coda.push({ a, motivo: msg('coda.codex') })
    else if (occupate >= maxParalleli) piano.coda.push({ a, motivo: msg('coda.paralleli', { n: maxParalleli }) })
    else {
      piano.avvia.push(a)
      occupate += 1
      if (a.esecutore === 'codex') codex = true
    }
  }
  return piano
}

/** Quante azioni attive questa sblocca: per far vedere il percorso critico. */
export const blocca = (a: Azione, lista: readonly Azione[]) => attive(lista).filter(x => x.dipende.includes(a.id)).length

/** Scambia la posizione con la vicina: rinumera tutto per non lasciare pari merito. */
export function sposta(lista: readonly Azione[], id: string, verso: -1 | 1): Azione[] {
  const ordinate = attive(lista)
  const i = ordinate.findIndex(a => a.id === id)
  const j = i + verso
  if (i < 0 || j < 0 || j >= ordinate.length) return []
  ;[ordinate[i], ordinate[j]] = [ordinate[j]!, ordinate[i]!]
  return ordinate.flatMap((a, k) => (a.ordine === k + 1 ? [] : [{ ...a, ordine: k + 1 }]))
}

/** Transizioni che uno strumento (una sessione) può chiedere; il resto lo decide il pannello. */
export const TRANSIZIONI: Record<string, readonly StatoAzione[]> = {
  // «presa» non cambia stato: il ripiego manuale prende il gettone prima dell'effetto remoto.
  presa: ['in-avvio'],
  avviata: ['in-avvio', 'fallita'],
  fallita: ['in-avvio'],
  consegnata: ['avviata'],
  scartata: ['proposta', 'accodata', 'fallita'],
}

/**
 * L'unico punto che cambia lo stato di un'azione: scrive le date della transizione. Restare nello stesso stato
 * non tocca le date; un nuovo avvio («in-avvio») le azzera insieme all'esito di revisione.
 */
export function transizione(a: Pick<Azione, 'stato'>, stato: StatoAzione, ora: string): Partial<Azione> {
  if (a.stato === stato) return { stato }
  if (stato === 'in-avvio') return { stato, avviataIl: undefined, consegnataIl: undefined, completataIl: undefined, revisione: undefined }
  if (stato === 'avviata') return { stato, avviataIl: ora }
  if (stato === 'consegnata') return { stato, consegnataIl: ora }
  if (stato === 'completata') return { stato, completataIl: ora }
  return { stato }
}

/** Le chip che aspettano una decisione (vista Lavoro e board): ferme, fallite, tentativi annullabili da `io`. */
export function aspettaTe(a: Azione, vive: Record<string, Vita>, io: string | undefined, adesso: number) {
  const ferma = a.stato === 'avviata' && !a.qui && vive[a.id]?.stato === 'ferma'
  const annullabile =
    a.stato === 'in-avvio' && a.lanciatore !== 'cli' && !!io && a.lanciataDa === io &&
    ((!!a.manuale && !a.presa) || (!a.manuale && (a.avvioScade ?? '') < new Date(adesso).toISOString()))
  return ferma || a.stato === 'fallita' || annullabile
}

/**
 * Percorso del piano al confine: relativo alla radice del repo, `.md` o `.txt`, niente `..`, assoluti, prefissi
 * `\\?\`, `\\.\` o UNC, niente `:` (lettere di unità e flussi NTFS). Il resto (link, junction) lo controlla l'helper.
 */
export function pianoValido(v: unknown): Msg | undefined {
  if (typeof v !== 'string' || !v || v.length > 300) return msg('piano.lungo')
  if (/[\x00-\x1f:*?"<>|]/.test(v) || /^[\\/]/.test(v) || /(^|[\\/])\.\.([\\/]|$)/.test(v))
    return msg('piano.relativo')
  if (!/\.(md|txt)$/i.test(v)) return msg('piano.tipo')
  return undefined
}

// --- validazione dei record su disco ---------------------------------------------------------------

export const ID_RE = /^a-[a-z0-9]{6,20}$/
export const RAMO_RE = /^[a-z0-9][a-z0-9-]{0,39}$/
export const BASE_RE = /^[A-Za-z0-9._/-]{1,100}$/
export const SESSIONE_RE = /^local_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const STATI: readonly StatoAzione[] = ['proposta', 'accodata', 'in-avvio', 'avviata', 'consegnata', 'fallita', 'completata', 'scartata']

/** Un record letto da disco → Azione, o il motivo per cui non lo è. Mai un cast cieco. */
export function normalizza(x: unknown): Azione | Msg {
  const a = (x ?? {}) as Record<string, unknown>
  const str = (k: string, max: number) => a[k] === undefined || (typeof a[k] === 'string' && (a[k] as string).length <= max)
  const tra = <T>(k: string, ammessi: readonly T[]) => a[k] === undefined || ammessi.includes(a[k] as T)
  const bool = (k: string) => a[k] === undefined || typeof a[k] === 'boolean'
  if (typeof a.id !== 'string' || !ID_RE.test(a.id)) return msg('rec.campo', { campo: 'id' })
  if (typeof a.titolo !== 'string' || !a.titolo || typeof a.brief !== 'string' || !a.brief) return msg('rec.titolo')
  if (!STATI.includes(a.stato as StatoAzione) || !tra('statoPrima', STATI)) return msg('rec.campo', { campo: 'stato' })
  if (!['claude', 'codex', 'freellmapi', 'compatibile'].includes(a.esecutore as string) || !['claude', 'codex', 'nessuno'].includes(a.revisore as string) ||
      (a.esecutore === 'compatibile') !== (a.provider !== undefined) || (a.provider !== undefined && !voceCompatibile(a.provider)))
    return msg('rec.campo', { campo: 'esecutore/revisore' })
  if (!Number.isFinite(a.ordine)) return msg('rec.campo', { campo: 'ordine' })
  if (a.dipende !== undefined && !(Array.isArray(a.dipende) && a.dipende.every(d => typeof d === 'string' && ID_RE.test(d))))
    return msg('rec.campo', { campo: 'dipende' })
  if (a.issue !== undefined && !(Number.isInteger(a.issue) && (a.issue as number) > 0)) return msg('rec.campo', { campo: 'issue' })
  if (a.sessione !== undefined && !(typeof a.sessione === 'string' && SESSIONE_RE.test(a.sessione))) return msg('rec.campo', { campo: 'sessione' })
  if (!tra('corsia', CORSIE) || !tra('contesto', ['fresh', 'fork']) || !tra('destinazione', ['local', 'cloud', 'api-claude'])) return msg('rec.campo', { campo: 'opzioni' })
  if (!tra('permessi', ['default', 'acceptEdits', 'plan', 'auto', 'bypassPermissions'])) return msg('rec.campo', { campo: 'permessi' })
  if (!tra('lanciatore', ['cli', 'freellmapi', 'api-claude', 'compatibile']) || !str('risultato', 30000)) return msg('rec.campo', { campo: 'esecuzione' })
  if (a.costoApi !== undefined && a.costoApi !== null && !numero(a.costoApi, 0, 1_000_000)) return msg('rec.campo', { campo: 'esecuzione' })
  if (!bool('worktree') || !bool('sveglia') || !bool('sensibile') || !bool('qui') || !bool('incerto') || !bool('manuale') || !bool('presa')) return msg('rec.campo', { campo: 'opzioni' })
  if (a.ramo !== undefined && !(typeof a.ramo === 'string' && RAMO_RE.test(a.ramo))) return msg('rec.campo', { campo: 'ramo' })
  if (a.base !== undefined && !(typeof a.base === 'string' && BASE_RE.test(a.base))) return msg('rec.campo', { campo: 'base' })
  for (const k of ['background', 'modello', 'effort', 'repo', 'proponente', 'motivoCoda', 'lanciataDa', 'tentativo', 'tentatoIl', 'avvioScade', 'avviataIl', 'errore', 'ramoSessione', 'taskId', 'origineFork', 'origineNome'])
    if (!str(k, 20000)) return msg('rec.campo', { campo: k })
  // Codici dei messaggi salvati: una stringa e un oggetto semplice; un codice sconosciuto mostra la frase salvata.
  for (const k of ['motivoCodice', 'erroreCodice']) if (!str(k, 100)) return msg('rec.campo', { campo: k })
  for (const k of ['motivoParametri', 'erroreParametri'])
    if (a[k] !== undefined && (!a[k] || typeof a[k] !== 'object' || Array.isArray(a[k]) || JSON.stringify(a[k]).length > 20000)) return msg('rec.campo', { campo: k })
  if (a.piano !== undefined && pianoValido(a.piano)) return msg('rec.campo', { campo: 'piano' })
  if (a.revisione !== undefined) {
    const r = a.revisione as Record<string, unknown>
    if (!r || typeof r !== 'object' || !['in-corso', 'approvata', 'da-correggere'].includes(r.esito as string) ||
        typeof r.riferitaDa !== 'string' || r.riferitaDa.length > 200 || typeof r.quando !== 'string' || Number.isNaN(Date.parse(r.quando)) ||
        (r.nota !== undefined && (typeof r.nota !== 'string' || r.nota.length > 300)) ||
        (r.tentativo !== undefined && typeof r.tentativo !== 'string')) return msg('rec.campo', { campo: 'revisione' })
  }
  if (typeof a.creata !== 'string' || typeof a.aggiornata !== 'string') return msg('rec.date')
  for (const k of ['tentatoIl', 'avvioScade', 'avviataIl', 'creata', 'consegnataIl', 'completataIl'])
    if (a[k] !== undefined && Number.isNaN(Date.parse(a[k] as string))) return msg('rec.data', { campo: k })
  // Migrazioni esplicite. Le azioni della 0.1 non hanno `versione`. Uno stato che non regge i suoi
  // invarianti (avviata senza sessione, avvio senza gettone o scadenza) non occupa un posto in silenzio:
  // diventa «fallita» con il motivo, e il committente verifica prima di riprovare.
  let stato = a.stato as StatoAzione
  let corretto: Msg | undefined
  if (stato === 'avviata' && !a.qui && !a.sessione && !(a.lanciatore && typeof a.tentativo === 'string' && /^az-[a-z0-9]{6,20}$/.test(a.tentativo))) {
    stato = 'fallita'
    corretto = msg('rec.avviataSenzaSessione')
  } else if (stato === 'in-avvio' && (!a.tentativo || !a.avvioScade)) {
    stato = 'fallita'
    corretto = msg('rec.avvioSenzaGettone')
  }
  return {
    ...(a as unknown as Azione),
    stato,
    ...(corretto && salvato('errore', 'errore', corretto)),
    versione: Number.isInteger(a.versione) ? (a.versione as number) : 0,
    dipende: (a.dipende as string[]) ?? [],
  }
}

// --- mandato e avvio -------------------------------------------------------------------------------

/** Dove sta l'helper: entra nel mandato come comando che tiene la corsia di Codex. */
export type Strumenti = { disco: string }

/** `codex exec` avvolto dall'helper: la corsia della macchina resta presa per tutta la vita del comando. */
const conCorsia = (s: Strumenti | undefined, revisione: boolean, comando: string) =>
  s ? `node "${s.disco}" corsia-codex ${revisione ? '--revisione ' : ''}-- ${comando}` : comando

/**
 * F13.7: the mandate line naming the enabled baseline skills relevant to `ruolo` (≤ 200 characters, English), or ''.
 * Exported for F13a's director mandate. The installed plugins come from `claude plugin list --json` (`pluginBase`).
 */
export const rigaSkillPer = (regole: Regole, ruolo: RuoloSkill) =>
  rigaSkill(skillAttive(regole.pluginBase ?? null, regole.risorse.modoLavoro?.skillBase, ruolo, regole.risorse.soloLocale))

function revisione(a: Azione, regole: Regole, s: Strumenti | undefined) {
  const r = revisioneSenzaSkill(a, regole, s)
  // The Claude reviewer (a subagent, or the coordinator of a Codex chip) gets the reviewer skills; Codex gets none.
  const skill = r && revisoreConcreto(a, regole) !== 'motore:codex' ? rigaSkillPer(regole, 'revisore') : ''
  return skill ? `${r} ${skill}` : r
}

function revisioneSenzaSkill(a: Azione, regole: Regole, s: Strumenti | undefined) {
  const rev = revisoreConcreto(a, regole)
  if (!rev) return ''
  if (rev === 'motore:codex') {
    return (
      '**Review: Codex.** Before reporting, have Codex review the branch diff read-only, ALWAYS through the machine lane ' +
      `(one Codex run at a time, reviews go first): \`${conCorsia(s, true, `codex exec -c model_reasoning_effort="${regole.corsiaCodex.effort.revisione ?? 'xhigh'}" -s read-only -C <worktree> -`)}\` ` +
      'with the review request on stdin. Address or justify every finding in the report.'
    )
  }
  if (a.esecutore === 'codex')
    return '**Review: Claude (you).** Review the diff Codex produced yourself, line by line (skill `requesting-code-review`): fix it or send it back to Codex before reporting.'
  const come = sensibile(a, regole) ? ', as an adversarial read' : ''
  return `**Review: Claude.** When the work is done, have a \`${rev}\` subagent review the diff${come} (routing.json: the reviewer is never the author).`
}

/** Il prompt e i parametri con cui la sessione desktop viene avviata. */
export function mandato(a: Azione, regole: Regole = REGOLE_DEFAULT, s?: Strumenti) {
  const modello = modelloDi(a, regole)
  const effort = effortDi(a, regole)
  const corsia = corsiaDi(a, regole)
  const parti: string[] = []
  if (corsia) parti.push(`**Lane ${corsia}.** Set by the panel: apply the skills and gates the project process requires for this lane.`)
  if (sensibile(a, regole)) parti.push('**Sensitive module.** Adversarial check and explicit human review before merging.')
  if (a.esecutore === 'codex') {
    parti.push(
      `**Engine: Codex (\`${modello}\`, effort ${effort}).** You coordinate and do not write the code: pass the brief below to Codex, ` +
        'ALWAYS through the machine lane (one Codex run at a time): ' +
        `\`${conCorsia(s, false, `codex exec -m ${modello} -c model_reasoning_effort="${effort}" -s ${(regole.risorse.modoLavoro ?? RISORSE_DEFAULT.modoLavoro).codexSandbox} -C <your worktree> -`)}\` with the brief on stdin. ` +
        // F11.1: Codex modifica soltanto (la sandbox protegge .git e di solito non ha rete): commit e push restano a te.
        'Codex only edits files; you commit and push. Then check the tests and the diff.',
    )
  }
  parti.push(a.brief.trim())
  // F13.7: the enabled baseline skills for whoever writes the code, Claude only (Codex gets none).
  const skill = a.esecutore === 'claude' ? rigaSkillPer(regole, 'lavoro') : ''
  if (skill) parti.push(skill)
  const rev = revisione(a, regole, s)
  if (rev) parti.push(rev)
  parti.push(
    `_Suggested action \`${a.id}\`, attempt \`${a.tentativo ?? '-'}\`._ When the work is delivered (branch pushed, report to the coordinator), if you have ` +
      `the \`mcp__chip-manager__aggiorna_azione\` tool, call it with id "${a.id}", stato "consegnata" and tentativo "${a.tentativo ?? ''}". ` +
      'The merge decides the closing. When the review has an outcome, report it with the same tool: id, tentativo and ' +
      '`revisione` ({ esito: "in-corso" | "approvata" | "da-correggere", nota }).',
  )
  // Al cloud va solo il contesto fisso: il background dell'azione è contesto locale e resta qui.
  const cloud = a.destinazione === 'cloud'
  const bg = cloud
    ? BACKGROUND_GENERICO
    : a.background && a.background.length >= 80
      ? a.background
      : `${a.background ? a.background + ' ' : ''}${regole.background}`
  const coordinatore = regole.corsiaCodex.rivistoDa[corsia ?? ''] ?? COORDINATORE_PREDEFINITO
  return {
    title: a.titolo.slice(0, 59),
    prompt: parti.join('\n\n'),
    background: bg,
    model: a.esecutore === 'codex' ? coordinatore : modello,
    effort: a.esecutore === 'codex' ? 'medium' : effort,
  }
}

/**
 * F6.2: il mandato di un `claude -p` a crediti API. È un processo senza persone davanti e senza la conversazione di una
 * sessione: niente frasi da coordinatore né strumenti del pannello; lavora nel suo worktree e si ferma lì.
 */
export function mandatoApi(a: Azione, regole: Regole = REGOLE_DEFAULT, s?: Strumenti) {
  const m = mandato(a, regole, s)
  const corsia = corsiaDi(a, regole)
  const parti: string[] = []
  if (corsia) parti.push(`**Lane ${corsia}.** Set by the panel: apply the skills and gates the project process requires for this lane.`)
  parti.push(a.brief.trim())
  // F13.7: the same baseline-skill line as the ordinary mandate (API runs are always Claude writing code).
  const skill = rigaSkillPer(regole, 'lavoro')
  if (skill) parti.push(skill)
  parti.push(
    '**How this run works.** You run headless, on API credits with a spending cap, in a worktree made for this attempt. ' +
      'Work only there and commit your changes on its branch. Do not push, merge, open pull requests or start other sessions. ' +
      'End with a short report: what changed, which tests ran, what is left to check. The review happens after delivery.',
  )
  parti.push(`_Suggested action \`${a.id}\`, attempt \`${a.tentativo ?? '-'}\`._`)
  return { ...m, prompt: parti.join('\n\n') }
}

/** Gli argomenti di start_session: le stesse opzioni della chip di sessione dell'app. */
export function parametriAvvio(a: Azione, regole: Regole = REGOLE_DEFAULT, s?: Strumenti) {
  const m = mandato(a, regole, s)
  const cloud = a.destinazione === 'cloud'
  const fork = a.contesto === 'fork' && !cloud
  const args: Record<string, unknown> = {
    initiation: 'user_asked',
    context: fork ? 'fork' : 'fresh',
    title: m.title,
    prompt: m.prompt,
  }
  // Il gettone del tentativo come `name`: list_sessions lo restituisce e l'esito incerto si riconcilia
  // su un identificatore univoco, non sul titolo.
  if (a.tentativo) args.name = a.tentativo
  // Ogni opzione va solo dove l'app la accetta: fork rifiuta background, worktree e modello;
  // il cloud (solo da sessione nuova) ignora modello, effort, worktree e permessi.
  if (!fork) args.background = m.background
  if (cloud) args.target = 'cloud'
  if (!fork && !cloud) {
    args.model = m.model
    args.effort = m.effort
    args.use_worktree = a.worktree !== false
    if (a.worktree !== false && a.ramo) args.branch_name = a.ramo
    if (a.worktree !== false && a.base) args.source_branch = a.base
  }
  // Su una sensibile senza permessi scelti non si eredita la modalità di chi avvia (spesso bypass).
  const permessi = a.permessi ?? (sensibile(a, regole) ? 'acceptEdits' : undefined)
  if (permessi && !cloud) args.permission_mode = permessi
  if (a.sveglia && !cloud) args.wake_when_done = true
  return args
}

export const idSessione = (testo: string) => testo.match(/local_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/)?.[0]

/** Famiglia del modello (fable > opus > sonnet > haiku): l'app ignora un modello sopra quello di chi avvia. */
export const sopra = (scelto: string, sessione: string) =>
  rangoModello(scelto) >= 0 && rangoModello(sessione) >= 0 && rangoModello(scelto) > rangoModello(sessione)

// --- registro dell'orchestratore -------------------------------------------------------------------

export const FASI = ['pronto', 'avviato', 'rapporto', 'revisione', 'fuso', 'pubblicato'] as const
/**
 * Fase del task del registro che è DI QUESTA azione. Identità, in ordine: il ramo della sessione
 * (`ramo` del task = ramo della sessione); altrimenti l'unico task della stessa issue creato dopo
 * l'avvio. Due candidati senza ramo che li distingua = ambiguo = nessuna fase: niente chiusura a caso.
 */
type TaskRegistro = { id: string; issue?: unknown; ramo?: unknown; stato: string; creato?: unknown; aggiornato?: unknown }
const taskDel = (registro: unknown): TaskRegistro[] =>
  Object.entries(((registro ?? {}) as { task?: Record<string, unknown> }).task ?? {})
    .map(([id, t]) => ({ id, ...(t as object) }) as TaskRegistro)
    .filter(t => typeof t.stato === 'string' && (FASI as readonly string[]).includes(t.stato))

/**
 * Il task del registro che è DI QUESTA azione. Serve il ramo della sessione: un task di quel ramo (e della
 * stessa issue) ancora APERTO, o nato dopo l'invio. Senza ramo nessuna associazione (la sola issue non
 * distingue due lavori), e un task già chiuso e nato prima dell'invio non si associa mai: potrebbe essere
 * di un lavoro precedente sullo stesso ramo, e chiudere per errore libererebbe le dipendenze.
 * Il prezzo, dichiarato: un task preparato prima e fuso prima che il pannello lo associ non chiude da
 * solo l'azione; la chiude il committente («Segna completata»). Più candidati = ambiguo = nessuno.
 */
export function trovaTask(
  registro: unknown,
  a: Pick<Azione, 'issue' | 'avviataIl' | 'ramoSessione' | 'tentatoIl'> & Partial<Pick<Azione, 'id' | 'qui' | 'worktree' | 'contesto'>>,
  altre: readonly Pick<Azione, 'id' | 'taskId'>[] = [],
) {
  // Servono ramo E issue: un ramo può ospitare lavori di issue diverse, e senza issue niente lega il task
  // a questa azione. Senza, la chiusura è del committente.
  if (!a.ramoSessione || !a.issue) return undefined
  // Cartella condivisa («qui», worktree:false, fork): il ramo è anche di altri lavori in corso, anche della
  // stessa issue; niente di ciò che il pannello vede lega un task a QUESTA sessione. Nessuna associazione:
  // la chiusura è del committente.
  if (cartellaCondivisa(a)) return undefined
  const soglia = a.tentatoIl ?? a.avviataIl
  const dopo = (t: TaskRegistro) => !!soglia && typeof t.creato === 'string' && t.creato >= soglia
  const presi = new Set(altre.filter(x => x.id !== a.id && x.taskId).map(x => x.taskId))
  const candidati = taskDel(registro).filter(
    t => t.ramo === a.ramoSessione && t.issue === a.issue && (!faseChiusa(t.stato) || dopo(t)),
  )
  // Un task è di UNA sola azione: se un'altra lo ha già, è ambiguo.
  return candidati.length === 1 && !presi.has(candidati[0]!.id) ? candidati[0]!.id : undefined
}

/** Cartella condivisa: il ramo non identifica il lavoro di questa sessione. */
export const cartellaCondivisa = (a: Partial<Pick<Azione, 'qui' | 'worktree' | 'contesto'>>) =>
  !!a.qui || a.worktree === false || a.contesto === 'fork'

/**
 * Il `taskId` salvato, se si può ancora usare per chiudere: mai in cartella condivisa, mai se un'altra azione
 * ha lo stesso task (collegamenti scritti da versioni precedenti, o duplicati). Altrimenti undefined: la
 * chiusura torna al committente.
 */
export function taskAccertato(a: Pick<Azione, 'id' | 'taskId'> & Partial<Pick<Azione, 'qui' | 'worktree' | 'contesto'>>, altre: readonly Pick<Azione, 'id' | 'taskId'>[]) {
  if (!a.taskId || cartellaCondivisa(a)) return undefined
  return altre.some(x => x.id !== a.id && x.taskId === a.taskId) ? undefined : a.taskId
}

/** Fase del task di questa azione: per id se già associato, altrimenti come lo trova `trovaTask`. */
export function faseDiAzione(
  registro: unknown,
  a: Pick<Azione, 'issue' | 'avviataIl' | 'ramoSessione' | 'tentatoIl' | 'taskId'> & Partial<Pick<Azione, 'qui' | 'worktree' | 'contesto'>>,
) {
  // Con `taskId` presente nell'argomento (anche undefined) decide il chiamante: nessuna ricerca implicita.
  const id = 'taskId' in a ? a.taskId : trovaTask(registro, a)
  return id ? taskDel(registro).find(t => t.id === id)?.stato : undefined
}
export const faseChiusa = (fase: string | undefined) => fase === 'fuso' || fase === 'pubblicato'

// --- etichette e colori ----------------------------------------------------------------------------

export const PERMESSI = [
  { value: 'eredita', label: 'permessi.eredita' },
  { value: 'default', label: 'permessi.default' },
  { value: 'acceptEdits', label: 'permessi.acceptEdits' },
  { value: 'plan', label: 'permessi.plan' },
  { value: 'auto', label: 'permessi.auto' },
  { value: 'bypassPermissions', label: 'permessi.bypassPermissions' },
] as const

const NOMI: Record<string, string> = {
  'claude-opus-5-5': 'Opus 5.5',
  'claude-sonnet-5-5': 'Sonnet 5.5',
  'claude-fable-5-1': 'Fable 5.1',
  'claude-haiku-5-5': 'Haiku 5.5',
  'gpt-6.1-sol': 'GPT-6.1 Sol',
  'gpt-6-astra': 'GPT-6 Astra',
}
export const nomeModello = (id: string) => NOMI[id] ?? id

// Colori degli stati in parole di dominio, dai gettoni di tema.ts (l'unico file con colori esadecimali).
export const COLORE_STATO = {
  proposta: STATO.coda,
  accodata: STATO.coda,
  inAvvio: STATO.coda,
  inCorso: STATO.inCorso,
  consegnata: STATO.consegnata,
  ferma: STATO.attesa,
  fallita: STATO.errore,
  qui: STATO.inCorso,
  sensibile: STATO.errore,
} as const

/** Tinta pallida dello stesso colore (alfa ~16%): regge sia sul tema chiaro sia sullo scuro. */
export const velo = (hex: string, alfa: string) => `${hex}${alfa}`

/** L'effort come grandezza, non solo come colore: ▰ pieni su 4. */
export const barreEffort = (effort: string) => {
  const n = Math.max(1, EFFORT.indexOf(effort) + 1)
  return '▰'.repeat(n) + '▱'.repeat(EFFORT.length - n)
}

/** «12 min», «1 h 05 min», «3 g»: durate brevi da leggere a colpo d'occhio. */
export function durata(ms: number, l: Lingua = 'en') {
  const min = Math.max(0, Math.floor(ms / 60_000))
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  if (h < 48) return `${h} h ${String(min % 60).padStart(2, '0')} min`
  return t(l, 'durata.giorni', { n: Math.floor(h / 24) })
}

// --- milestone ---------------------------------------------------------------------------------------

/** `owner/name` da un remote GitHub (https o ssh); null se il remote non è GitHub. */
export function repoGithub(remote: string | null | undefined) {
  const m = remote?.match(/github\.com[:/]([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/)
  return m ? `${m[1]}/${m[2]}` : null
}

/** Righe di `gh api .../milestones` → traguardi validati; un campo fuori forma scarta la riga. Titolo intero. */
export function traguardiDa(json: unknown): Traguardo[] {
  if (!Array.isArray(json)) return []
  return json.flatMap(m => {
    const r = m as Record<string, unknown>
    const ok =
      Number.isInteger(r.number) &&
      typeof r.title === 'string' &&
      (r.title as string).length <= 255 &&
      Number.isInteger(r.open_issues) &&
      Number.isInteger(r.closed_issues) &&
      (r.due_on === null || typeof r.due_on === 'string')
    return ok
      ? [
          {
            numero: r.number as number,
            titolo: r.title as string,
            aperte: r.open_issues as number,
            chiuse: r.closed_issues as number,
            scadenza: r.due_on as string | null,
          },
        ]
      : []
  })
}

export const percentuale = (t: Traguardo) => {
  const tot = t.aperte + t.chiuse
  return tot === 0 ? 0 : Math.round((t.chiuse / tot) * 100)
}

/** Data d'arrivo al ritmo delle ultime due settimane; null se il ritmo è zero o non noto. */
export function stimaArrivo(t: Traguardo, oggi: Date) {
  if (!t.chiuseRecenti || t.aperte === 0) return null
  const perGiorno = t.chiuseRecenti / 14
  return new Date(oggi.getTime() + Math.ceil(t.aperte / perGiorno) * 86_400_000)
}

/** Testo libero del filtro: titolo, issue, motore, modello. */
export const corrisponde = (a: Azione, filtro: string, regole: Regole = REGOLE_DEFAULT) => {
  const f = filtro.trim().toLowerCase()
  if (!f) return true
  const modello = modelloDi(a, regole)
  return [a.titolo, a.issue ? `#${a.issue}` : '', a.esecutore, modello, nomeModello(modello)].join(' ').toLowerCase().includes(f)
}

// --- progetto: cartella dei dati e sessioni -----------------------------------------------------------

/**
 * Cartella dei dati del progetto (dopo `CHIPMANAGER_DIR`, che vince su tutto): `progetti[repo].cartella`, poi la
 * `cartella` globale (compatibilità), poi `~/.claude/chipmanager/progetti/<owner>__<repo>`.
 * `null` = una cartella configurata non è un percorso assoluto o con ~: chi chiama non legge né scrive (fail-closed).
 */
/**
 * `x` è la radice `r` o sta sotto di essa? Solo stringhe; `insensibile` dove il file system non distingue maiuscole.
 * Un figlio «..cache» è dentro: conta solo il separatore. Gemello: `dentroRadice` in strumenti/regole.cjs (parità).
 */
export function dentroRadice(r: string, x: string, insensibile: boolean): boolean {
  const n = (s: string) => {
    const t = String(s).replace(/\\/g, '/').replace(/\/+$/, '')
    return insensibile ? t.toLowerCase() : t
  }
  const R = n(r) || '/'
  const X = n(x) || '/'
  return X === R || X.startsWith(R.endsWith('/') ? R : `${R}/`)
}

export function cartellaDati(config: unknown, repo: string | null, home: string): string | null {
  const oggetto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
  const valida = (d: unknown): d is string => typeof d === 'string' && d.length <= 400 && /^(~(?=[\\/]|$)|[a-z]:[\\/]|[\\/])/i.test(d)
  const espandi = (d: string) => d.replace(/\\/g, '/').replace(/^~(?=\/|$)/, home).replace(/\/+$/, '')
  const c = oggetto(config) ? config : {}
  const sezione = repo && oggetto(c.progetti) ? c.progetti[repo] : undefined
  const propria = oggetto(sezione) ? sezione.cartella : undefined
  if (propria !== undefined) return valida(propria) ? espandi(propria) : null
  if (c.cartella !== undefined) return valida(c.cartella) ? espandi(c.cartella) : null
  // Nomi lunghi: coda tenuta e un'impronta dell'intero, così due percorsi con lo stesso inizio non si incontrano.
  const pulito = repo ? repo.replace(/\//g, '__').replace(/[^A-Za-z0-9._-]+/g, '_') : '_senza-progetto'
  const impronta = [...pulito].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0, 7).toString(36)
  return `${home}/.claude/chipmanager/progetti/${pulito.length > 120 ? `${pulito.slice(-100)}-${impronta}` : pulito}`
}

/** Il checkout di un percorso: un worktree in `.claude/worktrees/<nome>` appartiene al checkout che lo ospita. */
export const checkoutDi = (percorso: string) =>
  percorso.replace(/\\/g, '/').replace(/\/+$/, '').replace(/\/\.claude\/worktrees\/[^/]+(\/.*)?$/, '')

/** Radice di confronto: il checkout, in minuscolo su Windows (maiuscole e minuscole sono lo stesso percorso). */
export function radiceProgetto(percorso: string) {
  const r = checkoutDi(percorso)
  return /^[a-z]:\//i.test(r) ? r.toLowerCase() : r
}
export const nelProgetto = (cwd: unknown, radice: string) => {
  if (typeof cwd !== 'string' || !cwd || !radice) return false
  const r = radiceProgetto(cwd)
  return r === radice || r.startsWith(`${radice}/`)
}

const GIORNO = 86_400_000
const testoBreve = (v: unknown, n: number) => (typeof v === 'string' && v.trim() && !/[\x00-\x1f\x7f]/.test(v) ? v.trim().slice(0, n) : undefined)
const istante = (v: unknown) => (typeof v === 'string' && Number.isFinite(Date.parse(v)) ? v : undefined)

/**
 * Le sessioni Claude del progetto da `list_sessions`: non archiviate, con la cartella nel progetto, al lavoro o
 * attive nelle ultime 24 ore. shortcut: finestra fissa di 24 ore; diventa un'impostazione se serve.
 */
export function sessioniClaude(json: unknown, radice: string, adesso: number): SessioneProgetto[] {
  if (!Array.isArray(json)) return []
  return json.slice(0, 200).flatMap((s: Record<string, unknown>) => {
    if (!s || typeof s !== 'object' || typeof s.sessionId !== 'string' || !SESSIONE_RE.test(s.sessionId) || s.isArchived === true) return []
    if (!nelProgetto(s.cwd, radice)) return []
    const attivita = istante(s.lastActivityAt)
    const inCorso = s.isRunning === true
    if (!inCorso && (!attivita || adesso - Date.parse(attivita) > GIORNO)) return []
    return [{ id: s.sessionId, motore: 'claude' as const, titolo: testoBreve(s.title, 80) ?? '', ramo: testoBreve(s.branch, 80),
      stato: inCorso ? ('in-corso' as const) : ('ferma' as const), attivita }]
  })
}

/** Modello, effort e ramo da `get_session`: solo stringhe brevi, il resto si ignora. */
export function dettagliSessione(json: unknown): Pick<SessioneProgetto, 'modello' | 'effort' | 'ramo'> {
  const s = json && typeof json === 'object' ? (json as Record<string, unknown>) : {}
  return { modello: testoBreve(s.model, 60), effort: testoBreve(s.effort, 20), ramo: testoBreve(s.branch, 80) }
}

/** Contesto da `get_usage(session_id)`: percentuale e token usati; assente se la sessione non lo riporta. */
export function contestoDa(json: unknown): Pick<SessioneProgetto, 'contesto' | 'token'> | undefined {
  const c = json && typeof json === 'object' ? (json as { context?: { status?: unknown; percentUsed?: unknown; tokensUsed?: unknown } }).context : undefined
  const n = c?.status === 'ok' ? c.percentUsed : undefined
  if (!(typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100)) return undefined
  const t = c?.tokensUsed
  return { contesto: Math.round(n), token: typeof t === 'number' && Number.isFinite(t) && t >= 0 ? t : undefined }
}

/** Le sessioni Codex che l'helper legge da `~/.codex/sessions`: forma stretta, solo quelle del progetto. */
export function sessioniCodex(json: unknown, radice: string, adesso: number): SessioneProgetto[] {
  if (!Array.isArray(json)) return []
  return json.slice(0, 50).flatMap((s: Record<string, unknown>) => {
    if (!s || typeof s !== 'object' || typeof s.id !== 'string' || !/^[A-Za-z0-9-]{8,64}$/.test(s.id) || !nelProgetto(s.cwd, radice)) return []
    const attivita = istante(s.attivita)
    if (!attivita || adesso - Date.parse(attivita) > GIORNO) return []
    const token = typeof s.token === 'number' && Number.isFinite(s.token) && s.token >= 0 ? s.token : undefined
    const finestra = typeof s.finestra === 'number' && Number.isFinite(s.finestra) && s.finestra > 0 ? s.finestra : undefined
    const ramo = testoBreve(s.ramo, 80)
    return [{ id: `codex-${s.id}`, motore: 'codex' as const, titolo: ramo ? `Codex · ${ramo}` : '', ramo,
      modello: testoBreve(s.modello, 60), effort: testoBreve(s.effort, 20), stato: s.inCorso === true ? ('in-corso' as const) : s.stato === 'ignoto' ? ('ignota' as const) : ('ferma' as const),
      contesto: token !== undefined && finestra ? Math.min(100, Math.round((token / finestra) * 100)) : undefined, token, attivita,
      // L'istante della misura è quello dell'evento token_count, non l'ultima attività (un'attività senza token non rinfresca).
      ...(token !== undefined && finestra && istante(s.tokenIl) && { contestoIl: istante(s.tokenIl) }) }]
  })
}

// --- cadenza dei lavori di sorveglianza e consumo di questa sessione (2.4.2) ---------------------------------

export type Lavoro = 'giro' | 'sessioni' | 'traguardi' | 'risorse'
export type Cadenza = { ultimi: Record<Lavoro, number>; aSchermo: boolean }
// Mai fatti: al primo battito è tutto dovuto, qualunque sia l'orologio.
export const CADENZA_INIZIALE: Cadenza = { ultimi: { giro: -Infinity, sessioni: -Infinity, traguardi: -Infinity, risorse: -Infinity }, aSchermo: false }
/** Stati che tengono il giro veloce: l'orchestrazione non deve rallentare mentre c'è lavoro pendente. */
// R10: solo questi stati hanno lavoro del giro da fare presto; proposte e consegnate seguono la cadenza lenta (60 s).
export const STATI_PENDENTI: readonly StatoAzione[] = ['accodata', 'in-avvio', 'avviata']
// Il battito arriva ogni 20 s, mai esattamente: un lavoro da 20 s è dovuto anche a 19,5 s.
const MARGINE_MS = 1_000

/**
 * Un battito: quali lavori fare adesso. Il giro va ogni 20 s con lavoro pendente, altrimenti ogni 60 s; le sessioni ogni
 * 20 s con il pannello a schermo, altrimenti ogni 2 minuti, e subito quando torna a schermo; traguardi e risorse ogni 5
 * minuti. Un lavoro si segna quando parte, riuscito o no: dopo un errore o una sospensione si riprova alla cadenza normale,
 * una volta sola, senza raffiche. Un orologio tornato indietro rende tutto dovuto.
 */
export function passoCadenza(c: Cadenza, adesso: number, s: { pendente: boolean; aSchermo: boolean }): { cadenza: Cadenza; fare: Lavoro[] } {
  const ogni: Record<Lavoro, number> = { giro: s.pendente ? 20_000 : 60_000, sessioni: s.aSchermo ? 20_000 : 120_000, traguardi: 300_000, risorse: 300_000 }
  const tornato = s.aSchermo && !c.aSchermo
  const fare = (Object.keys(ogni) as Lavoro[]).filter(k => adesso < c.ultimi[k] || adesso - c.ultimi[k] >= ogni[k] - MARGINE_MS || (k === 'sessioni' && tornato))
  return { cadenza: segnaLavori({ ...c, aSchermo: s.aSchermo }, fare, adesso), fare }
}

/** Segna i lavori fatti fuori dal battito (apertura, «Aggiorna»): il battito non li ripete subito. */
export function segnaLavori(c: Cadenza, fatti: readonly Lavoro[], adesso: number): Cadenza {
  const ultimi = { ...c.ultimi }
  for (const k of fatti) ultimi[k] = adesso
  return { ...c, ultimi }
}

/** Contatori a minuti: al più 11 secchi, la memoria non cresce con la durata della sessione. */
export type Secchi = { minuto: number; v: Omit<Consumo, 'da'> }[]
const FINESTRA_MIN = 10

export function contaConsumo(secchi: Secchi, adesso: number, delta: Partial<Omit<Consumo, 'da' | 'comandi'>>, comando?: string): Secchi {
  const minuto = Math.floor(adesso / 60_000)
  const tenuti = secchi.filter(x => x.minuto > minuto - FINESTRA_MIN && x.minuto <= minuto)
  let ultimo = tenuti[tenuti.length - 1]
  if (!ultimo || ultimo.minuto !== minuto) tenuti.push((ultimo = { minuto, v: { processi: 0, app: 0, byte: 0, byteLimiti: 0, salti: 0, comandi: {} } }))
  else tenuti[tenuti.length - 1] = ultimo = { minuto, v: { ...ultimo.v, comandi: { ...ultimo.v.comandi } } }
  for (const [k, n] of Object.entries(delta) as [keyof Omit<Consumo, 'da' | 'comandi'>, number][]) if (Number.isFinite(n) && n > 0) ultimo.v[k] += n
  // D6 per comando: al più 20 chiavi per secchio, le altre in «altro» (non classificato).
  const n = delta.processi ?? 0
  if (comando && Number.isFinite(n) && n > 0) {
    const c = ultimo.v.comandi ?? (ultimo.v.comandi = {})
    const chiave = comando in c || Object.keys(c).length < 20 ? comando : 'altro'
    c[chiave] = (c[chiave] ?? 0) + n
  }
  return tenuti
}

export type ClasseProcesso = 'raccolta' | 'orchestrazione' | 'altri'
// Le due classi sono elenchi chiusi (piano F5.3, giro 3). Raccolta: letture dei fornitori e cache Codex, git, piano,
// board in scrittura e generazione. Orchestrazione: mutex e prenotazioni, configura*, pesi-*, gh, Explorer (o l'apri-
// programma), codex, avvii di sessione. Ogni altro comando, anche nuovo o somigliante, è «non classificato».
const RACCOLTA = new Set(['limiti', 'sessioni', 'git-log', 'git', 'leggi-piano', 'board-scrivi', 'board-prenota', 'board-finalizza', 'stato-esecuzione'])
const ORCHESTRAZIONE = new Set(['occupata', 'prenota', 'stato-cli', 'cas', 'configura', 'configura-utente', 'pesi-proponi', 'pesi-decidi',
  'pesi-annulla', 'gh', 'explorer', 'apri', 'codex', 'lancia-cli', 'esegui-cli', 'accedi'])
/** La classe di un comando (F5.3): raccolta, orchestrazione o non classificato. Vale anche per il registratore esterno. */
export const classeProcesso = (comando: string): ClasseProcesso => (RACCOLTA.has(comando) ? 'raccolta' : ORCHESTRAZIONE.has(comando) ? 'orchestrazione' : 'altri')
/** I processi per comando sommati per classe; ogni classe c'è sempre, anche a zero. */
export function classiDi(comandi: Record<string, number> = {}): Record<ClasseProcesso, number> {
  const tot: Record<ClasseProcesso, number> = { raccolta: 0, orchestrazione: 0, altri: 0 }
  for (const [c, n] of Object.entries(comandi)) tot[classeProcesso(c)] += n
  return tot
}

/** Somma degli ultimi 10 minuti; `da` è l'inizio della finestra, o l'avvio della mod se più recente. */
export function sommaSecchi(secchi: Secchi, adesso: number, avvio: number): Consumo {
  const minuto = Math.floor(adesso / 60_000)
  const tot: Consumo = { processi: 0, app: 0, byte: 0, byteLimiti: 0, salti: 0, comandi: {}, da: Math.max(avvio, adesso - FINESTRA_MIN * 60_000) }
  for (const x of secchi)
    if (x.minuto > minuto - FINESTRA_MIN && x.minuto <= minuto) {
      for (const k of ['processi', 'app', 'byte', 'byteLimiti', 'salti'] as const) tot[k] += x.v[k]
      for (const [c, n] of Object.entries(x.v.comandi ?? {})) tot.comandi![c] = (tot.comandi![c] ?? 0) + n
    }
  return tot
}

// I contatori di QUESTA sessione: in memoria, mai su disco. Ogni punto che avvia un processo o chiama l'app li tocca.
const AVVIO = Date.now()
let secchi: Secchi = []
/** Conta processi e chiamate; `comando` dice quale processo, per la divisione per classe (D6). */
export const conta = (delta: Partial<Omit<Consumo, 'da' | 'comandi'>>, comando?: string) => void (secchi = contaConsumo(secchi, Date.now(), delta, comando))
export const sommaConsumo = () => sommaSecchi(secchi, Date.now(), AVVIO)

/** R4: due valori di stato uguali nel JSON: scriverli di nuovo farebbe solo ridisegnare chi li legge. */
export const uguale = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
/** Il consumo senza `da`, che scorre col tempo: cambia solo se cambiano i conteggi. */
export const consumoUguale = (a: Consumo, b: Consumo) => uguale({ ...a, da: 0 }, { ...b, da: 0 })

/** La riga grigia della vista Carico: solo i numeri di QUESTA sessione, e lo dice. */
export function rigaConsumo(c: Consumo, adesso: number, l: Lingua = 'en'): string {
  const min = Math.max(1, Math.round((adesso - c.da) / 60_000))
  const mb = (n: number) => `${scriviNumero(l, n / 1_048_576, 1)} MB`
  return [
    t(l, min >= FINESTRA_MIN ? 'consumo.dieci' : 'consumo.minuti', { n: min, processi: `${t(l, 'consumo.processi', { n: c.processi })} (${t(l, 'consumo.classi', classiDi(c.comandi))})` }),
    t(l, 'consumo.app', { n: c.app }),
    t(l, c.byteLimiti ? 'consumo.byteLimiti' : 'consumo.byte', { mb: mb(c.byte), limiti: mb(c.byteLimiti) }),
    t(l, 'consumo.salti', { n: c.salti }),
  ].join(' · ')
}

/** I contatori che l'helper restituisce (`diagnostica`), validati: tutto ciò che non è un numero non conta. */
export function diagnosticaHelper(json: unknown): Partial<Omit<Consumo, 'da'>> {
  const d = (json as { diagnostica?: Record<string, unknown> } | null)?.diagnostica
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < 1e12 ? v : 0)
  return d && typeof d === 'object' ? { byte: n(d.byte), byteLimiti: n(d.byteLimiti), salti: n(d.salti) } : {}
}
