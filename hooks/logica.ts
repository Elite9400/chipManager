// Logica pura del pannello: niente `$`, così i test la provano senza engine.
import type { Azione, Chiamante, Corsia, Fornitore, Limite, Peso, Regole, RisorseProgetto, SessioneProgetto, Soglia, StatoAzione, Traguardo } from '../types'

// --- regole (routing.json) ---------------------------------------------------------------------

/** Contesto del mandato quando il progetto non ne configura uno; è anche l'unico che va al cloud. */
export const BACKGROUND_GENERICO =
  'Segui le istruzioni del progetto (CLAUDE.md o AGENTS.md): lavora nel tuo worktree, pusha il ramo e riferisci a chi ' +
  'ha proposto l\'azione; non fondere in main.'

/**
 * Valori di ripiego per DISEGNARE il pannello quando routing.json non si legge. `lette: false` blocca
 * ogni avvio: le regole non si allentano mai in silenzio.
 */
export const SOGLIA_PREDEFINITA: Soglia = { attenzione: 70, critica: 90 }
export const RISORSE_DEFAULT: RisorseProgetto = {
  fornitori: ['claude', 'codex'], soloLocale: false, milestoneGithub: false, pesi: [], limitiManuali: [],
  freellmapi: { livello: 'niente', endpoint: 'http://localhost:3001/v1' },
  soglie: { claude: SOGLIA_PREDEFINITA, codex: SOGLIA_PREDEFINITA, deepseek: SOGLIA_PREDEFINITA, freellmapi: SOGLIA_PREDEFINITA },
}
export const REGOLE_DEFAULT: Regole = {
  lette: false,
  modelli: {
    claude: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-fable-5-1', 'claude-haiku-5-5'],
    codex: ['gpt-6.1-sol', 'gpt-6-astra'],
    freellmapi: [],
  },
  effort: ['low', 'medium', 'high', 'xhigh'],
  tetto: { 'claude-fable-5-1': 'xhigh' },
  revisori: {},
  corsiaCodex: { corsie: ['R1', 'R2', 'R3'], effort: {}, rivistoDa: {} },
  sensibili: [],
  background: BACKGROUND_GENERICO,
  fonte: 'non letto',
  risorse: RISORSE_DEFAULT,
}
export const EFFORT = REGOLE_DEFAULT.effort
export const MODELLI = REGOLE_DEFAULT.modelli
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
export function progettoDa(config: unknown, repo: string | null): Progetto | string {
  if (config === null || config === undefined) return PROGETTO_PREDEFINITO
  const oggetto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
  if (!oggetto(config)) return 'config.json non è un oggetto'
  const progetti = config.progetti ?? {}
  if (!oggetto(progetti)) return 'config.json: «progetti» non è un oggetto'
  const p = repo ? progetti[repo] : undefined
  if (p === undefined) return PROGETTO_PREDEFINITO
  if (!oggetto(p)) return `config.json: il progetto ${repo} non è un oggetto`
  const { routing, sensibili, background } = p
  if (routing !== undefined && (typeof routing !== 'string' || !routing || /^([a-z]:)?[\\/]/i.test(routing) || /(^|[\\/])\.\.([\\/]|$)/.test(routing)))
    return 'config.json: «routing» è un percorso relativo alla radice del repo'
  if (sensibili !== undefined && (!Array.isArray(sensibili) || !sensibili.every(t => typeof t === 'string' && t.length > 0 && t.length <= 200)))
    return 'config.json: «sensibili» è un elenco di espressioni (stringhe non vuote)'
  for (const t of (sensibili ?? []) as string[]) {
    try {
      new RegExp(t, 'i')
    } catch {
      return `config.json: termine sensibile non valido: ${t.slice(0, 40)}`
    }
  }
  if (p.cartella !== undefined && (typeof p.cartella !== 'string' || p.cartella.length > 400 || !/^(~(?=[\\/]|$)|[a-z]:[\\/]|[\\/])/i.test(p.cartella)))
    return 'config.json: «cartella» è un percorso assoluto o che inizia con ~'
  if (background !== undefined && (typeof background !== 'string' || background.length > 2000))
    return 'config.json: «background» è un testo di al massimo 2000 caratteri'
  const risorse = risorseDa(p)
  if (typeof risorse === 'string') return risorse
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

/** Copia solo campi conosciuti: un config non può portare credenziali dentro lo stato. */
export function risorseDa(p: Record<string, unknown>): RisorseProgetto | string {
  const errore = 'config.json: politica fornitori, pesi o limiti non validi'
  const fornitori = p.fornitori ?? RISORSE_DEFAULT.fornitori
  if (!Array.isArray(fornitori) || !fornitori.every(f => FORNITORI.includes(f))) return errore
  if (p.soloLocale !== undefined && typeof p.soloLocale !== 'boolean') return errore
  if (p.milestoneGithub !== undefined && typeof p.milestoneGithub !== 'boolean') return errore
  const f = p.freellmapi ?? RISORSE_DEFAULT.freellmapi
  if (!oggettoRisorse(f) || !['niente', 'R1', 'R2'].includes(String(f.livello)) || !endpointLocale(f.endpoint ?? RISORSE_DEFAULT.freellmapi.endpoint)) return errore
  const pesi = p.pesi ?? []
  if (!Array.isArray(pesi) || pesi.length > 100 || !pesi.every(pesoValido) || new Set(pesi.map(x => `${x.tipo}:${x.nome}`)).size !== pesi.length) return errore
  const manuali = p.limitiManuali ?? []
  if (!Array.isArray(manuali) || manuali.length > 30) return errore
  const limitiManuali: Limite[] = []
  for (const x of manuali) {
    if (!oggettoRisorse(x) || !FORNITORI.includes(x.fornitore as Fornitore) || typeof x.id !== 'string' || !/^[a-z0-9-]{1,60}$/.test(x.id) ||
        typeof x.nome !== 'string' || !/^[\p{L}\p{N} .()%-]{1,60}$/u.test(x.nome) ||
        typeof x.letto !== 'string' || !Number.isFinite(Date.parse(x.letto)) || Date.parse(x.letto) > Date.now() + 60_000 ||
        (x.percentuale !== undefined && !numero(x.percentuale, 0, 100)) ||
        (x.valore !== undefined && !numero(x.valore, 0, 1e12)) || !['%', 'USD', 'CNY', 'EUR', 'richieste', 'token'].includes(String(x.unita)) ||
        (x.percentuale === undefined && x.valore === undefined)) return errore
    limitiManuali.push({ id: `manuale-${x.id}`, fornitore: x.fornitore as Fornitore, nome: x.nome, letto: x.letto,
      percentuale: x.percentuale as number | undefined, valore: x.valore as number | undefined, unita: x.unita as Limite['unita'], fonte: 'manuale', manuale: true })
  }
  // Soglie per fornitore: assente = 70/90, null = nessuna soglia; attenzione sempre sotto la critica.
  const soglie = p.soglie ?? {}
  if (!oggettoRisorse(soglie) || !Object.entries(soglie).every(([k, v]) => FORNITORI.includes(k as Fornitore) &&
      (v === null || (oggettoRisorse(v) && numero(v.attenzione, 1, 100) && numero(v.critica, 1, 100) && v.attenzione < v.critica)))) return errore
  const soglia = (k: Fornitore): Soglia | null => {
    const v = soglie[k] as { attenzione: number; critica: number } | null | undefined
    return v === undefined ? SOGLIA_PREDEFINITA : v && { attenzione: v.attenzione, critica: v.critica }
  }
  return { fornitori: [...fornitori], soloLocale: p.soloLocale === true, milestoneGithub: p.milestoneGithub === true,
    freellmapi: { livello: f.livello as RisorseProgetto['freellmapi']['livello'], endpoint: (f.endpoint as string | undefined) ?? RISORSE_DEFAULT.freellmapi.endpoint },
    pesi: pesi.map(x => ({ tipo: x.tipo, nome: x.nome, percentuale: x.percentuale, assoluto: x.assoluto })), limitiManuali,
    soglie: { claude: soglia('claude'), codex: soglia('codex'), deepseek: soglia('deepseek'), freellmapi: soglia('freellmapi') } }
}

export const limiteFresco = (l: Limite, adesso = Date.now()) => !l.errore && !!l.letto && adesso >= Date.parse(l.letto) && adesso - Date.parse(l.letto) <= 300_000 && (!l.reset || Date.parse(l.reset) > adesso)
/** La soglia di un fornitore nella politica del progetto (null = nessuna). */
export const sogliaDi = (r: RisorseProgetto, f: Fornitore): Soglia | null => (r.soglie?.[f] === undefined ? SOGLIA_PREDEFINITA : r.soglie[f])
export type Livello = 'ok' | 'attenzione' | 'critica'
export const livelloDi = (percentuale: number, soglia: Soglia | null): Livello =>
  !soglia ? 'ok' : percentuale >= soglia.critica ? 'critica' : percentuale >= soglia.attenzione ? 'attenzione' : 'ok'
export const COLORE_LIVELLO: Record<Livello, string> = { ok: '#059669', attenzione: '#D97706', critica: '#DC2626' }
// Il manuale si colora per soglia anche se non è «fresco»: è una dichiarazione, non una misura che scade.
export const coloreLimite = (l: Limite, adesso = Date.now(), soglia: Soglia | null = SOGLIA_PREDEFINITA) =>
  (!l.manuale && !limiteFresco(l, adesso)) || l.percentuale === undefined ? '#808080' : COLORE_LIVELLO[livelloDi(l.percentuale, soglia)]

/** La quota misurata più piena di un fornitore fra quelle fresche (i manuali e la spesa API non sono quote di piano). */
export function piuPieno(limiti: readonly Limite[], f: Fornitore, adesso = Date.now()): Limite | undefined {
  return limiti
    .filter(l => l.fornitore === f && l.id !== 'claude-api' && !l.manuale && l.percentuale !== undefined && limiteFresco(l, adesso))
    .reduce<Limite | undefined>((m, l) => (!m || l.percentuale! > m.percentuale! ? l : m), undefined)
}

/** Peso = preferenza, mai autorizzazione. Quote sconosciute non equivalgono a 100% libero. */
export function punteggio(a: Azione, r: Regole, limiti: readonly Limite[], lista: readonly Azione[]) {
  let peso = 100
  for (const p of r.risorse.pesi) {
    const nome = p.tipo === 'fornitore' ? a.esecutore : p.tipo === 'modello' ? modelloDi(a, r) : effortDi(a, r)
    if (p.nome === nome) peso *= Math.max(0, 100 * (1 + p.percentuale / 100) + p.assoluto) / 100
  }
  const quote = limiti.filter(l => l.fornitore === a.esecutore && !l.manuale && l.percentuale !== undefined && limiteFresco(l))
  const pieno = quote.length ? Math.max(...quote.map(l => l.percentuale!)) : undefined
  // Oltre la soglia critica il margine scende a un residuo: la scelta va altrove se un'alternativa ammessa c'è,
  // e se tutti sono oltre, il residuo tiene ancora l'ordine fra di loro.
  const libero = pieno === undefined ? 0.25 : Math.max(0, 1 - pieno / 100)
  const margine = pieno !== undefined && livelloDi(pieno, sogliaDi(r.risorse, a.esecutore)) === 'critica' ? libero * 0.001 : libero
  const attivi = lista.filter(x => occupa(x) && x.esecutore === a.esecutore && modelloDi(x, r) === modelloDi(a, r)).length
  return peso * margine / (1 + attivi)
}

/** Completa solo opzioni omesse; ogni candidato supera la stessa guardia dell'avvio. */
export function bilancia(a: Azione, espliciti: Record<string, unknown>, r: Regole, limiti: readonly Limite[], lista: readonly Azione[], chi: Chiamante) {
  let scelta = a
  let migliore = -1
  for (const esecutore of ['claude', 'codex', 'freellmapi'] as const) {
    if (espliciti.esecutore !== undefined && espliciti.esecutore !== esecutore) continue
    for (const modello of r.modelli[esecutore]) {
      if (espliciti.modello !== undefined && espliciti.modello !== modello) continue
      const preferito = effortDi({ ...a, esecutore, modello }, r)
      const livelli = [preferito, ...effortPer(r, modello).filter(e => e !== preferito)]
      for (const effort of livelli) {
        if (espliciti.effort !== undefined && espliciti.effort !== effort) continue
        for (const revisore of [a.revisore, ...(a.revisore !== 'claude' ? ['claude' as const] : [])]) {
          if (espliciti.revisore !== undefined && espliciti.revisore !== revisore) continue
          const candidata: Azione = { ...a, esecutore, modello, effort, revisore }
          if (violazioniAvvio(candidata, r, lista, chi).length) continue
          const punti = punteggio(candidata, r, limiti, lista)
          if (punti > migliore) { migliore = punti; scelta = candidata }
        }
      }
    }
  }
  return scelta
}

export const modelloDi = (a: Azione, regole: Regole = REGOLE_DEFAULT) => {
  const ammessi = regole.modelli[a.esecutore]
  return a.modello && ammessi.includes(a.modello) ? a.modello : (ammessi[0] ?? REGOLE_DEFAULT.modelli[a.esecutore][0] ?? '')
}

/** Gli effort offribili per un modello: quelli ammessi fino al suo tetto. */
export function effortPer(regole: Regole, modello: string) {
  const t = regole.tetto[modello]
  const i = t ? regole.effort.indexOf(t) : -1
  return i >= 0 ? regole.effort.slice(0, i + 1) : regole.effort
}

export const effortDi = (a: Azione, regole: Regole = REGOLE_DEFAULT) => {
  const ammessi = effortPer(regole, modelloDi(a, regole))
  if (a.effort && ammessi.includes(a.effort)) return a.effort
  // Codex senza effort scelto: quello che corsia_codex prescrive per la corsia.
  const daCorsia = a.esecutore === 'codex' ? regole.corsiaCodex.effort[corsiaDi(a, regole) ?? ''] : undefined
  if (daCorsia && ammessi.includes(daCorsia)) return daCorsia
  return ammessi.includes('high') ? 'high' : ammessi.at(-1)!
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
export const sensibile = (a: Pick<Azione, 'sensibile' | 'titolo' | 'brief' | 'corsia' | 'background'>, regole: Pick<Regole, 'sensibili'> & Partial<Pick<Regole, 'background'>>) => {
  if (a.sensibile === true || a.corsia === 'R4' || a.corsia === 'R5') return true
  const testo = `${a.titolo}\n${a.brief}\n${a.background ?? ''}\n${regole.background ?? ''}`
  return SENSIBILE_RE.test(testo) || !!terminiRe(regole.sensibili)?.test(testo)
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
  const problemi: string[] = []
  let aperte = 0
  for (const id of a.dipende) {
    const d = lista.find(x => x.id === id)
    if (!d) problemi.push(`la dipendenza ${id} non esiste (o non si legge)`)
    else if (d.stato === 'scartata') problemi.push(`la dipendenza «${d.titolo}» è stata scartata`)
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
  if (a.esecutore === 'codex') return regole.corsiaCodex.rivistoDa[corsiaDi(a, regole) ?? ''] ?? COORDINATORE_PREDEFINITO
  const autore = modelloDi(a, regole)
  if (sensibile(a, regole)) return autore === 'claude-fable-5-1' ? 'claude-opus-5-5' : 'claude-fable-5-1'
  return (regole.revisori[autore] ?? []).find(r => r.startsWith('claude-') && r !== autore)
}

/** Perché un'azione non può partire così com'è: vuoto = può partire. */
export function violazioni(a: Azione, regole: Regole, lista: readonly Azione[] = []): string[] {
  const v: string[] = []
  if (!regole.lette) v.push('routing.json non letto o incompleto: nessun avvio finché le regole non si leggono')
  const modello = modelloDi(a, regole)
  const effort = effortDi(a, regole)
  const corsia = corsiaDi(a, regole)
  const politica = regole.risorse
  if (politica.soloLocale) v.push('progetto solo rete locale: nessuna inferenza esterna, anche tramite CLI o proxy locale')
  if (!politica.fornitori.includes(a.esecutore)) v.push(`fornitore ${a.esecutore} non abilitato per il progetto`)
  if (a.revisore !== 'nessuno' && !politica.fornitori.includes(a.revisore)) v.push(`revisore ${a.revisore} non abilitato per il progetto`)
  if (!regole.modelli[a.esecutore].length) v.push(`nessun modello ammesso per ${a.esecutore}`)
  if (a.esecutore === 'freellmapi') {
    if (!corsia || !['R0', 'R1', ...(politica.freellmapi.livello === 'R2' ? ['R2'] : [])].includes(corsia) || politica.freellmapi.livello === 'niente')
      v.push('FreeLLMAPI: corsia fuori dal livello abilitato per il progetto')
    if (datiLocali(`${a.titolo}\n${a.brief}\n${a.background ?? ''}\n${regole.background}`)) v.push('dati da tenere in LAN: niente fornitori terzi')
    if (a.contesto === 'fork' || a.destinazione === 'cloud' || a.worktree === false) v.push('FreeLLMAPI: solo mandato testuale isolato, niente fork o cartella condivisa')
    if (a.titolo.length + a.brief.length > CLOUD_MAX) v.push(`FreeLLMAPI: testo da confermare entro ${CLOUD_MAX} caratteri`)
    if (a.revisore !== 'claude') v.push('FreeLLMAPI: consegna testuale da rivedere con Claude')
    if (effort !== 'low') v.push('FreeLLMAPI: effort low (nessun parametro di ragionamento non verificato)')
  }
  if (a.modello && a.modello !== modello) v.push(`il modello ${a.modello} non è fra quelli ammessi per ${a.esecutore}`)
  if (a.effort && a.effort !== effort) v.push(`effort ${a.effort} oltre il tetto di ${nomeModello(modello)}`)
  // Il revisore che il mandato nominerà deve stare nella matrice dell'autore e non essere l'autore.
  const rev = revisoreConcreto(a, regole)
  const ammessi = regole.revisori[modello]
  if (a.revisore !== 'nessuno' && !ammessi)
    v.push(`routing.json non ha la riga dei revisori per ${nomeModello(modello)}: nessun avvio senza la regola`)
  if (a.revisore !== 'nessuno') {
    if (!rev) v.push(`routing.json non indica un revisore Claude per ${nomeModello(modello)}`)
    else if (rev === modello) v.push(`il revisore sarebbe lo stesso modello dell'autore (${nomeModello(modello)})`)
    else if (ammessi && !ammessi.includes(rev))
      v.push(`routing.json non ammette ${rev === 'motore:codex' ? 'Codex' : nomeModello(rev)} come revisore di ${nomeModello(modello)}`)
  }
  if (a.destinazione === 'cloud') {
    if (a.contesto === 'fork') v.push('il cloud parte solo da una sessione nuova, non da un fork')
    if (a.esecutore === 'codex' || a.revisore === 'codex')
      v.push('nel cloud niente Codex: la corsia unica della macchina e il suo helper esistono solo su questo computer')
    // Al cloud va solo titolo + mandato (il contesto locale resta qui): niente dati che la policy tiene in LAN.
    if (datiLocali(`${a.titolo}\n${a.brief}`)) v.push('il mandato contiene dati da tenere in LAN (CF, email, IP, chiavi, .env, storage): niente cloud')
    if (a.titolo.length + a.brief.length > CLOUD_MAX)
      v.push(`per il cloud titolo e mandato stanno in ${CLOUD_MAX} caratteri, così li leggi per intero prima dell'invio`)
  }
  if (a.esecutore === 'codex') {
    if (!corsia) v.push(`Codex vuole una corsia (${regole.corsiaCodex.corsie.join(', ')}): da lei dipendono effort e revisore`)
    else if (!regole.corsiaCodex.effort[corsia] || !regole.corsiaCodex.rivistoDa[corsia])
      v.push(`routing.json non definisce effort o revisore di corsia_codex per ${corsia}: nessun avvio senza la regola`)
    if (corsia && !regole.corsiaCodex.corsie.includes(corsia))
      v.push(`Codex esegue solo le corsie ${regole.corsiaCodex.corsie.join(', ')} (questa è ${corsia})`)
    // L'effort di corsia_codex è un minimo, non un suggerimento.
    const prescritto = regole.corsiaCodex.effort[corsia ?? '']
    if (prescritto && regole.effort.indexOf(effort) < regole.effort.indexOf(prescritto))
      v.push(`corsia_codex vuole almeno effort ${prescritto} su ${corsia}`)
  }
  if (sensibile(a, regole)) {
    if (a.esecutore !== 'claude') v.push('corsia sensibile (R4): l\'autore resta Claude')
    if (a.revisore === 'nessuno') v.push('corsia sensibile (R4): la revisione è obbligatoria')
    if (a.revisore === 'codex') v.push('corsia sensibile (R4): anche il revisore resta Claude')
    if (a.permessi === 'bypassPermissions') v.push('corsia sensibile (R4): niente bypass dei permessi')
    if (a.destinazione === 'cloud') v.push('corsia sensibile (R4): resta su questo computer, mai nel cloud')
    if (a.esecutore === 'claude' && !AUTORI_R4.includes(modello)) v.push(`corsia sensibile (R4): autore Opus o Fable, non ${nomeModello(modello)}`)
    if (regole.effort.indexOf(effort) < regole.effort.indexOf('high')) v.push('corsia sensibile (R4): effort almeno high')
  }
  v.push(...dipendenze(a, lista).problemi)
  return v
}

/**
 * Le violazioni della configurazione che si OTTERREBBE avviando da `chi`: start_session ignora un modello
 * o un effort sopra quelli di chi avvia, il fork eredita modello ed effort, e «Fallo qui» gira con i
 * permessi di questa sessione. Senza progetto o di un altro progetto non si avvia.
 */
export function violazioniAvvio(a: Azione, regole: Regole, lista: readonly Azione[], chi: Chiamante | null, qui = false): string[] {
  const v = violazioni(a, regole, lista)
  if (!chi) return [...v, 'non so ancora quale sessione sta avviando: riprova fra un attimo']
  if (a.contesto === 'fork' && a.stato === 'accodata' && !a.origineFork && !qui)
    v.push('fork in coda senza conversazione d\'origine: riscegli «Fork di questa conversazione» dalla sessione giusta')
  if (a.contesto === 'fork' && a.origineFork && a.origineFork !== chi.io && !qui)
    v.push('è un fork della conversazione di un\'altra sessione: riparte solo da lì (o passala a «sessione nuova»)')
  if (!a.repo) v.push('azione senza progetto (versione precedente): associala a questo progetto prima di avviarla')
  else if (!chi.repo) v.push('non so in quale progetto gira questa sessione: avvio bloccato')
  else if (a.repo !== chi.repo) v.push(`è del progetto ${a.repo}: avviala da lì`)
  if (a.esecutore === 'freellmapi') {
    if (qui) v.push('FreeLLMAPI non si esegue nella conversazione corrente')
    return v
  }
  if (!qui && chi.lanciatore === 'ignoto') v.push('capacità di avvio non verificata: nessun fallback dopo un errore desktop')
  if (!qui && chi.lanciatore === 'cli') {
    if (a.contesto === 'fork' || a.destinazione === 'cloud' || a.worktree === false) v.push('CLI: serve sessione nuova locale in worktree proprio')
    if (a.permessi === 'bypassPermissions' || a.permessi === 'auto') v.push('CLI: scegli default, acceptEdits o plan; nessun bypass non interattivo')
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
        v.push(`${qui ? 'qui' : 'il fork'} gira con ${nomeModello(chi.modello)}, non con ${nomeModello(richiesto)}`)
      // Le regole valgono sulla configurazione effettiva, non su quella scritta nell'azione.
      if (sensibile(a, regole) && rangoModello(chi.modello) < rangoModello('opus'))
        v.push(`corsia sensibile (R4): ${qui ? 'questa sessione' : 'il fork'} usa ${nomeModello(chi.modello)}, serve Opus o Fable`)
    } else if (rangoModello(richiesto) > rangoModello(chi.modello))
      v.push(`questa sessione usa ${nomeModello(chi.modello)}: l'app non avvia ${nomeModello(richiesto)} da qui`)
  }
  // Sconosciuto non vuol dire compatibile: dove la guardia dipende da un metadato che manca, si blocca.
  if (!chi.modello && (eredita || a.esecutore === 'claude')) v.push('non so con che modello gira questa sessione: avvio bloccato')
  if (!chi.effort && (eredita || sensibile(a, regole))) v.push('non so con che effort gira questa sessione: avvio bloccato')
  if (qui && !chi.permessi) v.push('non so in che modalità permessi gira questa sessione: «Fallo qui» bloccato')
  const eChi = chi.effort ? regole.effort.indexOf(chi.effort) : -1
  if (eChi >= 0) {
    const eVoluto = regole.effort.indexOf(a.esecutore === 'codex' ? 'medium' : effort)
    if (eredita && a.esecutore === 'claude' && eChi !== eVoluto) v.push(`${qui ? 'qui' : 'il fork'} gira con effort ${chi.effort}, non ${effort}`)
    else if (!eredita && eVoluto > eChi) v.push(`questa sessione è a effort ${chi.effort}: l'app non avvia ${effort} da qui`)
  }
  if (qui) {
    if (sensibile(a, regole) && chi.permessi === 'bypassPermissions') v.push('corsia sensibile (R4): questa sessione è in bypass dei permessi')
    if (a.permessi && chi.permessi && a.permessi !== chi.permessi)
      v.push(`questa sessione è in «${chi.permessi}», l'azione chiede «${a.permessi}»`)
  }
  return v
}

const RANGO = ['haiku', 'sonnet', 'opus', 'fable']
export const rangoModello = (m: string) => RANGO.findIndex(f => m.toLowerCase().includes(f))

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
  coda: { a: Azione; motivo: string }[]
  bloccate: { a: Azione; motivi: string[] }[]
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
  extra: (a: Azione) => string[] = () => [],
  limiti: readonly Limite[] = [],
): Piano {
  const piano: Piano = { avvia: [], coda: [], bloccate: [] }
  let occupate = lista.filter(occupa).length
  let codex = codexOccupato || lista.some(tieneCodex)
  const ids = new Set(candidate.map(a => a.id))
  // L'ordine scelto dall'utente vale finché non configura pesi: solo allora il punteggio riordina il massivo.
  const ordinate = attive(lista).filter(x => ids.has(x.id))
  if (regole.risorse.pesi.length) ordinate.sort((a, b) => punteggio(b, regole, limiti, lista) - punteggio(a, regole, limiti, lista))
  for (const a of ordinate) {
    const motivi = [...violazioni(a, regole, lista), ...extra(a)]
    if (motivi.length) piano.bloccate.push({ a, motivi })
    else if (!dipendenzeChiuse(a, lista)) piano.coda.push({ a, motivo: 'aspetta che le dipendenze siano fuse' })
    else if (a.esecutore === 'codex' && codex) piano.coda.push({ a, motivo: 'corsia Codex occupata' })
    else if (occupate >= maxParalleli) piano.coda.push({ a, motivo: `limite di ${maxParalleli} sessioni in parallelo` })
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

// --- validazione dei record su disco ---------------------------------------------------------------

export const ID_RE = /^a-[a-z0-9]{6,20}$/
export const RAMO_RE = /^[a-z0-9][a-z0-9-]{0,39}$/
export const BASE_RE = /^[A-Za-z0-9._/-]{1,100}$/
export const SESSIONE_RE = /^local_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const STATI: readonly StatoAzione[] = ['proposta', 'accodata', 'in-avvio', 'avviata', 'consegnata', 'fallita', 'completata', 'scartata']

/** Un record letto da disco → Azione, o il motivo per cui non lo è. Mai un cast cieco. */
export function normalizza(x: unknown): Azione | string {
  const a = (x ?? {}) as Record<string, unknown>
  const str = (k: string, max: number) => a[k] === undefined || (typeof a[k] === 'string' && (a[k] as string).length <= max)
  const tra = <T>(k: string, ammessi: readonly T[]) => a[k] === undefined || ammessi.includes(a[k] as T)
  const bool = (k: string) => a[k] === undefined || typeof a[k] === 'boolean'
  if (typeof a.id !== 'string' || !ID_RE.test(a.id)) return 'id non valido'
  if (typeof a.titolo !== 'string' || !a.titolo || typeof a.brief !== 'string' || !a.brief) return 'titolo o mandato mancante'
  if (!STATI.includes(a.stato as StatoAzione) || !tra('statoPrima', STATI)) return 'stato non valido'
  if (!['claude', 'codex', 'freellmapi'].includes(a.esecutore as string) || !['claude', 'codex', 'nessuno'].includes(a.revisore as string))
    return 'esecutore o revisore non validi'
  if (!Number.isFinite(a.ordine)) return 'ordine non valido'
  if (a.dipende !== undefined && !(Array.isArray(a.dipende) && a.dipende.every(d => typeof d === 'string' && ID_RE.test(d))))
    return 'dipendenze non valide'
  if (a.issue !== undefined && !(Number.isInteger(a.issue) && (a.issue as number) > 0)) return 'issue non valida'
  if (a.sessione !== undefined && !(typeof a.sessione === 'string' && SESSIONE_RE.test(a.sessione))) return 'sessione non valida'
  if (!tra('corsia', CORSIE) || !tra('contesto', ['fresh', 'fork']) || !tra('destinazione', ['local', 'cloud'])) return 'opzioni non valide'
  if (!tra('permessi', ['default', 'acceptEdits', 'plan', 'auto', 'bypassPermissions'])) return 'permessi non validi'
  if (!tra('lanciatore', ['cli', 'freellmapi']) || !str('risultato', 30000)) return 'esecuzione non valida'
  if (!bool('worktree') || !bool('sveglia') || !bool('sensibile') || !bool('qui') || !bool('incerto') || !bool('manuale') || !bool('presa')) return 'opzioni non valide'
  if (a.ramo !== undefined && !(typeof a.ramo === 'string' && RAMO_RE.test(a.ramo))) return 'ramo non valido'
  if (a.base !== undefined && !(typeof a.base === 'string' && BASE_RE.test(a.base))) return 'ramo base non valido'
  for (const k of ['background', 'modello', 'effort', 'repo', 'proponente', 'motivoCoda', 'lanciataDa', 'tentativo', 'tentatoIl', 'avvioScade', 'avviataIl', 'errore', 'ramoSessione', 'taskId', 'origineFork', 'origineNome'])
    if (!str(k, 20000)) return `${k} non valido`
  if (typeof a.creata !== 'string' || typeof a.aggiornata !== 'string') return 'date mancanti'
  for (const k of ['tentatoIl', 'avvioScade', 'avviataIl', 'creata'])
    if (a[k] !== undefined && Number.isNaN(Date.parse(a[k] as string))) return `${k} non è una data`
  // Migrazioni esplicite. Le azioni della 0.1 non hanno `versione`. Uno stato che non regge i suoi
  // invarianti (avviata senza sessione, avvio senza gettone o scadenza) non occupa un posto in silenzio:
  // diventa «fallita» con il motivo, e il committente verifica prima di riprovare.
  let stato = a.stato as StatoAzione
  let errore = a.errore as string | undefined
  if (stato === 'avviata' && !a.qui && !a.sessione && !(a.lanciatore && typeof a.tentativo === 'string' && /^az-[a-z0-9]{6,20}$/.test(a.tentativo))) {
    stato = 'fallita'
    errore = 'record incoerente: avviata senza sessione. Verifica nella barra laterale prima di riprovare'
  } else if (stato === 'in-avvio' && (!a.tentativo || !a.avvioScade)) {
    stato = 'fallita'
    errore = 'avvio senza gettone o senza scadenza. Verifica nella barra laterale prima di riprovare'
  }
  return {
    ...(a as unknown as Azione),
    stato,
    errore,
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

function revisione(a: Azione, regole: Regole, s: Strumenti | undefined) {
  const rev = revisoreConcreto(a, regole)
  if (!rev) return ''
  if (rev === 'motore:codex') {
    return (
      '**Revisione: Codex.** Prima del rapporto fai rivedere il diff del ramo a Codex in sola lettura, SEMPRE attraverso la corsia ' +
      `della macchina (una sola esecuzione Codex per volta, le revisioni passano davanti): \`${conCorsia(s, true, `codex exec -c model_reasoning_effort="${regole.corsiaCodex.effort.revisione ?? 'xhigh'}" -s read-only -C <worktree> -`)}\` ` +
      'con la richiesta di revisione su stdin. Integra o motiva ogni rilievo nel rapporto.'
    )
  }
  if (a.esecutore === 'codex')
    return '**Revisione: Claude (tu).** Rivedi tu il diff prodotto da Codex, riga per riga (skill `requesting-code-review`): correggi o rimanda a Codex prima del rapporto.'
  const come = sensibile(a, regole) ? ', in lettura avversariale' : ''
  return `**Revisione: Claude.** A fine lavoro fai rivedere il diff da un subagente \`${rev}\`${come} (routing.json: il revisore non è mai l'autore).`
}

/** Il prompt e i parametri con cui la sessione desktop viene avviata. */
export function mandato(a: Azione, regole: Regole = REGOLE_DEFAULT, s?: Strumenti) {
  const modello = modelloDi(a, regole)
  const effort = effortDi(a, regole)
  const corsia = corsiaDi(a, regole)
  const parti: string[] = []
  if (corsia) parti.push(`**Corsia ${corsia}.** Determinata dal pannello: applica le skill e i gate che il processo del progetto impone per questa corsia.`)
  if (sensibile(a, regole)) parti.push('**Modulo sensibile.** Verifica avversariale e revisione umana esplicita prima della fusione.')
  if (a.esecutore === 'codex') {
    parti.push(
      `**Esecutore: Codex (\`${modello}\`, effort ${effort}).** Tu coordini e non scrivi il codice: passa il mandato qui sotto a Codex, ` +
        'SEMPRE attraverso la corsia della macchina (una sola esecuzione Codex per volta): ' +
        `\`${conCorsia(s, false, `codex exec -m ${modello} -c model_reasoning_effort="${effort}" -C <il tuo worktree> -`)}\` con il mandato su stdin. ` +
        'Poi verifica test e diff.',
    )
  }
  parti.push(a.brief.trim())
  const rev = revisione(a, regole, s)
  if (rev) parti.push(rev)
  parti.push(
    `_Azione suggerita \`${a.id}\`, tentativo \`${a.tentativo ?? '-'}\`._ A lavoro consegnato (ramo pushato, rapporto a chi coordina), se hai ` +
      `lo strumento \`mcp__chip-manager__aggiorna_azione\` chiamalo con id "${a.id}", stato "consegnata" e tentativo "${a.tentativo ?? ''}". ` +
      'La chiusura la decide la fusione.',
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
  { value: 'eredita', label: 'Come questa sessione' },
  { value: 'default', label: 'Chiedi ogni volta' },
  { value: 'acceptEdits', label: 'Accetta modifiche' },
  { value: 'plan', label: 'Piano' },
  { value: 'auto', label: 'Auto' },
  { value: 'bypassPermissions', label: 'Bypass permessi' },
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

// Palette delle etichette: una tinta per modello, una scala «calda» per l'effort (più caldo = più costoso),
// una per motore e una per stato. I colori marcano (pallini, velo, bordi): le parole restano nell'inchiostro.
export const COLORE_MODELLO: Record<string, string> = {
  'claude-opus-5-5': '#E11D48',
  'claude-fable-5-1': '#C026D3',
  'claude-sonnet-5-5': '#2563EB',
  'claude-haiku-5-5': '#0D9488',
  'gpt-6.1-sol': '#EA580C',
  'gpt-6-astra': '#CA8A04',
}
export const COLORE_EFFORT: Record<string, string> = {
  low: '#16A34A',
  medium: '#0891B2',
  high: '#D97706',
  xhigh: '#DC2626',
}
export const COLORE_MOTORE: Record<string, string> = { claude: '#D97757', codex: '#10A37F', freellmapi: '#0D9488', nessuno: '#6B7280' }
// «Da avviare» porta l'unico accento freddo del pannello, l'azzurro.
// «Ferma» e «fallita» chiedono una decisione: gli unici caldi, gli unici con il bordo acceso.
export const COLORE_STATO = {
  proposta: '#00BFFF',
  accodata: '#F59E0B',
  inAvvio: '#38BDF8',
  inCorso: '#22C55E',
  consegnata: '#14B8A6',
  ferma: '#F97316',
  fallita: '#EF4444',
  qui: '#D97757',
  sensibile: '#EF4444',
} as const

/** Tinta pallida dello stesso colore (alfa ~16%): regge sia sul tema chiaro sia sullo scuro. */
export const velo = (hex: string, alfa = '29') => `${hex}${alfa}`

/** Testo scuro su sfondi chiari, bianco sugli altri (luminanza relativa WCAG). */
export function testoSu(hex: string) {
  const [r, g, b] = [1, 3, 5].map(i => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? '#111827' : '#FFFFFF'
}

/** L'effort come grandezza, non solo come colore: ▰ pieni su 4. */
export const barreEffort = (effort: string) => {
  const n = Math.max(1, EFFORT.indexOf(effort) + 1)
  return '▰'.repeat(n) + '▱'.repeat(EFFORT.length - n)
}

/** «12 min», «1 h 05 min», «3 g»: durate brevi da leggere a colpo d'occhio. */
export function durata(ms: number) {
  const min = Math.max(0, Math.floor(ms / 60_000))
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  if (h < 48) return `${h} h ${String(min % 60).padStart(2, '0')} min`
  return `${Math.floor(h / 24)} g`
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
    return [{ id: s.sessionId, motore: 'claude' as const, titolo: testoBreve(s.title, 80) ?? 'Sessione senza titolo', ramo: testoBreve(s.branch, 80),
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
    return [{ id: `codex-${s.id}`, motore: 'codex' as const, titolo: ramo ? `Codex · ${ramo}` : 'Sessione Codex', ramo,
      modello: testoBreve(s.modello, 60), effort: testoBreve(s.effort, 20), stato: s.inCorso === true ? ('in-corso' as const) : ('ferma' as const),
      contesto: token !== undefined && finestra ? Math.min(100, Math.round((token / finestra) * 100)) : undefined, token, attivita }]
  })
}
