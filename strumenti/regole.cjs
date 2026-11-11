'use strict'
// F10: il gemello CJS di `regoleEfficaci` e di `restrizioneLarga` (hooks/logica.ts), per l'helper che prenota la spesa e
// scrive il config. Lavora sul JSON grezzo del config: convalida i campi che combina e, nel dubbio, lancia (chi chiama
// blocca). Un test di parità confronta i due su gli stessi ingressi: cambiare una regola qui vuol dire cambiarla là.

const FORNITORI = ['claude', 'codex', 'deepseek', 'freellmapi']
const PREDEFINITA = { attenzione: 70, critica: 90 }
const TETTO_PREDEFINITO = 2
const ENDPOINT_PREDEFINITO = 'http://localhost:3001/v1'

const oggetto = v => !!v && typeof v === 'object' && !Array.isArray(v)
const numero = (v, min, max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max
const endpointLocale = s => typeof s === 'string' && /^http:\/\/(?:localhost|127\.0\.0\.1|\[::1\]):[1-9][0-9]{0,4}\/v1$/.test(s) && Number(s.match(/:([0-9]+)\/v1$/)[1]) <= 65535
class NonValido extends Error {}
const no = campo => {
  throw new NonValido(`config: ${campo} non valido`)
}

/** Soglie di uno strato: assente = eredita, null = nessuna; lancia se la forma non vale. */
function soglieDa(v, campo) {
  const s = v ?? {}
  if (!oggetto(s)) no(campo)
  const fuori = {}
  for (const [k, x] of Object.entries(s)) {
    if (!FORNITORI.includes(k) || !(x === null || (oggetto(x) && numero(x.attenzione, 1, 100) && numero(x.critica, 1, 100) && x.attenzione < x.critica))) no(campo)
    fuori[k] = x === null ? null : { attenzione: x.attenzione, critica: x.critica }
  }
  return fuori
}

/** I budget manuali di uno strato, convalidati come in `manualiDa` (hooks/logica.ts); lancia se uno non vale. */
function manualiValidi(v, campo) {
  const m = v ?? []
  if (!Array.isArray(m) || m.length > 30) no(campo)
  for (const x of m)
    if (!oggetto(x) || !FORNITORI.includes(x.fornitore) || typeof x.id !== 'string' || !/^[a-z0-9-]{1,60}$/.test(x.id) ||
        typeof x.nome !== 'string' || !/^[\p{L}\p{N} .()%-]{1,60}$/u.test(x.nome) ||
        typeof x.letto !== 'string' || !Number.isFinite(Date.parse(x.letto)) || Date.parse(x.letto) > Date.now() + 60_000 ||
        (x.percentuale !== undefined && !numero(x.percentuale, 0, 100)) || (x.valore !== undefined && !numero(x.valore, 0, 1e12)) ||
        !['%', 'USD', 'CNY', 'EUR', 'richieste', 'token'].includes(String(x.unita)) || (x.percentuale === undefined && x.valore === undefined)) no(campo)
}

/** `{ budgetUsd, tetto? }` o assente (null = tolto). */
function apiDa(v, campo) {
  if (v === undefined || v === null) return undefined
  if (!oggetto(v) || !numero(v.budgetUsd, 0.01, 100_000) || (v.tetto !== undefined && !numero(v.tetto, 0.01, 1_000))) no(campo)
  return { budgetUsd: v.budgetUsd, ...(v.tetto !== undefined && { tetto: v.tetto }) }
}

// --- F11.1: il modo di lavoro (gemello di modoDa, modoNonValido e modoEfficace in hooks/logica.ts) ---------------------
const EFFORT_MODO = ['low', 'medium', 'high', 'xhigh']
const CORSIE_MODO = ['R0', 'R1', 'R2', 'R3', 'R4', 'R5']
const CAMPI_MODO = ['effortPredefinito', 'codexSandbox', 'parallelo', 'auditorSuggerito', 'revisioneIncrociata', 'skillBase']
const ID_SKILL = require('./skill-base.cjs').SKILL_BASE.map(v => v.id)
const MODO_PREDEFINITO = { effortPredefinito: { R0: 'medium', R1: 'medium', R2: 'medium', R3: 'high', R4: 'high', R5: 'high' }, codexSandbox: 'workspace-write', auditorSuggerito: false, revisioneIncrociata: true }
const sottoHigh = (c, x) => (c === 'R4' || c === 'R5') && EFFORT_MODO.indexOf(x) < 2
const paralleloValido = v => Number.isInteger(v) && v >= 1 && v <= 8

/** In lettura un campo che non vale si ignora (eredita); null = assente. Non lancia mai. */
function modoDa(v) {
  if (!oggetto(v)) return {}
  const out = {}
  if (oggetto(v.effortPredefinito)) {
    const e = {}
    for (const c of CORSIE_MODO) {
      const x = v.effortPredefinito[c]
      if (typeof x === 'string' && EFFORT_MODO.includes(x) && !sottoHigh(c, x)) e[c] = x
    }
    if (Object.keys(e).length) out.effortPredefinito = e
  }
  if (v.codexSandbox === 'workspace-write' || v.codexSandbox === 'read-only') out.codexSandbox = v.codexSandbox
  if (paralleloValido(v.parallelo)) out.parallelo = v.parallelo
  if (typeof v.auditorSuggerito === 'boolean') out.auditorSuggerito = v.auditorSuggerito
  if (typeof v.revisioneIncrociata === 'boolean') out.revisioneIncrociata = v.revisioneIncrociata
  if (oggetto(v.skillBase)) {
    const s = Object.fromEntries(Object.entries(v.skillBase).filter(([k, x]) => ID_SKILL.includes(k) && typeof x === 'boolean'))
    if (Object.keys(s).length) out.skillBase = s
  }
  return out
}

/** In scrittura: il nome del primo campo che non vale, o null (stesso testo del pannello). */
function modoNonValido(v) {
  if (v === undefined || v === null) return null
  if (!oggetto(v)) return 'modoLavoro'
  const pulito = (k, n) => k.replace(/[^A-Za-z0-9_]/g, '?').slice(0, n)
  const ignoto = Object.keys(v).find(k => !CAMPI_MODO.includes(k))
  if (ignoto) return `modoLavoro.${pulito(ignoto, 40)}`
  const e = v.effortPredefinito
  if (e !== undefined && e !== null) {
    if (!oggetto(e)) return 'modoLavoro.effortPredefinito'
    for (const [c, x] of Object.entries(e))
      if (!CORSIE_MODO.includes(c) || (x !== null && (typeof x !== 'string' || !EFFORT_MODO.includes(x) || sottoHigh(c, x)))) return `modoLavoro.effortPredefinito.${pulito(c, 10)}`
  }
  if (v.codexSandbox !== undefined && v.codexSandbox !== null && v.codexSandbox !== 'workspace-write' && v.codexSandbox !== 'read-only') return 'modoLavoro.codexSandbox'
  if (v.parallelo !== undefined && v.parallelo !== null && !paralleloValido(v.parallelo)) return 'modoLavoro.parallelo'
  for (const k of ['auditorSuggerito', 'revisioneIncrociata']) if (v[k] !== undefined && v[k] !== null && typeof v[k] !== 'boolean') return `modoLavoro.${k}`
  const sb = v.skillBase
  if (sb !== undefined && sb !== null) {
    if (!oggetto(sb)) return 'modoLavoro.skillBase'
    for (const [k, x] of Object.entries(sb)) if (!ID_SKILL.includes(k) || (x !== null && typeof x !== 'boolean')) return `modoLavoro.skillBase.${k.replace(/[^A-Za-z0-9_-]/g, '?').slice(0, 40)}`
  }
  return null
}

/** Per campo il progetto sostituisce l'account, poi i predefiniti. */
function modoEfficace(accountGrezzo, progettoGrezzo) {
  const a = modoDa(accountGrezzo)
  const p = modoDa(progettoGrezzo)
  const d = MODO_PREDEFINITO
  const effortPredefinito = Object.fromEntries(CORSIE_MODO.map(c => [c, p.effortPredefinito?.[c] ?? a.effortPredefinito?.[c] ?? d.effortPredefinito[c]]))
  const parallelo = p.parallelo ?? a.parallelo
  return {
    effortPredefinito,
    codexSandbox: p.codexSandbox ?? a.codexSandbox ?? d.codexSandbox,
    ...(parallelo !== undefined && { parallelo }),
    auditorSuggerito: p.auditorSuggerito ?? a.auditorSuggerito ?? d.auditorSuggerito,
    revisioneIncrociata: p.revisioneIncrociata ?? a.revisioneIncrociata ?? d.revisioneIncrociata,
    ...(Object.keys({ ...a.skillBase, ...p.skillBase }).length && { skillBase: { ...a.skillBase, ...p.skillBase } }),
  }
}

function accountDa(v) {
  if (v === undefined || v === null) return { soglie: {} }
  if (!oggetto(v)) no('account')
  const api = apiDa(v.apiClaude, 'account.apiClaude')
  manualiValidi(v.limitiManuali, 'account.limitiManuali')
  const f = v.freellmapi ?? undefined
  if (f !== undefined && (!oggetto(f) || (f.endpoint !== undefined && !endpointLocale(f.endpoint)))) no('account.freellmapi')
  // F13.3b: the same parser as the panel (compatibili.cjs is the twin of hooks/compatibili.ts).
  const compatibili = require('./compatibili.cjs').impostazioniCompatibiliDa(v.compatibili)
  if (!compatibili) no('account.compatibili')
  return { soglie: soglieDa(v.soglie, 'account.soglie'), ...(api && { apiClaude: { budgetUsd: api.budgetUsd, tetto: api.tetto ?? TETTO_PREDEFINITO } }), ...(f && typeof f.endpoint === 'string' && { endpoint: f.endpoint }),
    compatibili }
}

function restrizioniDa(v) {
  if (v === undefined || v === null) return {}
  if (!oggetto(v)) no('restrizioni')
  if (v.apiLimiteMeseUsd !== undefined && !numero(v.apiLimiteMeseUsd, 0.01, 100_000)) no('restrizioni.apiLimiteMeseUsd')
  if (v.apiTetto !== undefined && !numero(v.apiTetto, 0.01, 1_000)) no('restrizioni.apiTetto')
  return { ...(v.soglie !== undefined && { soglie: soglieDa(v.soglie, 'restrizioni.soglie') }), ...(v.apiLimiteMeseUsd !== undefined && { apiLimiteMeseUsd: v.apiLimiteMeseUsd }),
    ...(v.apiTetto !== undefined && { apiTetto: v.apiTetto }) }
}

/** Il più severo fra due strati: assente eredita, null perde contro un valore, fra due valori il minimo per livello. */
function piuSevera(a, b) {
  if (a === undefined) return b
  if (b === undefined || b === null) return a
  if (a === null) return b
  return { attenzione: Math.min(a.attenzione, b.attenzione), critica: Math.min(a.critica, b.critica) }
}

/**
 * Le regole efficaci di un progetto dai due strati grezzi (`config.account` e `config.progetti[repo]`): soglie per
 * fornitore, crediti API (`null` = corsia spenta) ed endpoint FreeLLMAPI. Lancia se uno dei campi combinati non vale.
 */
function regoleEfficaci(accountGrezzo, progettoGrezzo) {
  const account = accountDa(accountGrezzo)
  const p = progettoGrezzo ?? {}
  if (!oggetto(p)) no('progetto')
  const soglieProgetto = soglieDa(p.soglie, 'soglie')
  const r = restrizioniDa(p.restrizioni)
  const legacy = apiDa(p.apiClaude, 'apiClaude')
  manualiValidi(p.limitiManuali, 'limitiManuali')
  // null = assente, come nel pannello; un oggetto vuole il livello e, se c'è, un endpoint loopback.
  const fp = p.freellmapi ?? undefined
  // Un endpoint null nel progetto vale come assente (eredita quello dell'account), come nel pannello.
  if (fp !== undefined && (!oggetto(fp) || !['niente', 'R1', 'R2'].includes(String(fp.livello)) || (fp.endpoint !== undefined && fp.endpoint !== null && !endpointLocale(fp.endpoint)))) no('freellmapi')
  const soglie = {}
  for (const f of FORNITORI) {
    const s = piuSevera(account.soglie[f], piuSevera(soglieProgetto[f], r.soglie?.[f]))
    soglie[f] = s === undefined ? PREDEFINITA : s
  }
  let apiClaude = null
  if (account.apiClaude) {
    const tetto = Math.min(account.apiClaude.tetto, r.apiTetto ?? Infinity, legacy?.tetto ?? Infinity)
    const limite = Math.min(r.apiLimiteMeseUsd ?? Infinity, legacy?.budgetUsd ?? Infinity)
    apiClaude = { budgetUsd: account.apiClaude.budgetUsd, tetto, ...(limite < account.apiClaude.budgetUsd && { limiteProgettoUsd: limite }) }
  }
  const modoLavoro = modoEfficace(oggetto(accountGrezzo) ? accountGrezzo.modoLavoro : undefined, p.modoLavoro)
  // F13.3b: validated like the panel; the helper does not need the values, so they stay out of the effective rules.
  if (!require('./compatibili.cjs').livelliCompatibiliDa(p.compatibili)) no('compatibili')
  return { soglie, apiClaude, endpoint: (fp && fp.endpoint) ?? account.endpoint ?? ENDPOINT_PREDEFINITO, modoLavoro }
}

/** Il motivo per cui le restrizioni allargherebbero l'account, o null (più severo = valore più basso). Lancia se non valgono. */
function restrizioneLarga(accountGrezzo, restrizioniGrezze) {
  const account = accountDa(accountGrezzo)
  const r = restrizioniDa(restrizioniGrezze)
  for (const f of FORNITORI) {
    const p = r.soglie?.[f]
    if (p === undefined) continue
    const a = account.soglie[f] === undefined ? PREDEFINITA : account.soglie[f]
    if (a !== null && (p === null || p.attenzione > a.attenzione || p.critica > a.critica)) return `soglie.${f}`
  }
  if (r.apiLimiteMeseUsd !== undefined && (!account.apiClaude || r.apiLimiteMeseUsd > account.apiClaude.budgetUsd)) return 'apiLimiteMeseUsd'
  if (r.apiTetto !== undefined && (!account.apiClaude || r.apiTetto > account.apiClaude.tetto)) return 'apiTetto'
  return null
}

const piano = v => !!v && typeof v === 'object' && !Array.isArray(v)
const SEGMENTO = /^[A-Za-z0-9_-]{1,60}$/
const VIETATE = new Set(['__proto__', 'constructor', 'prototype'])

/**
 * Applica una patch di campi a un oggetto del config (un progetto o l'account), senza perdere niente che la patch non
 * nomina: un campo a null si cancella; un oggetto si fonde in profondità con quello di prima (un null ANNIDATO è un
 * valore, come «nessuna soglia»); ogni altro valore sostituisce. I percorsi di `togli` (`campo.chiave…`) cancellano chiavi
 * annidate, solo dentro campi che la patch nomina. Null preesistenti e campi sconosciuti, anche annidati, restano.
 * Gemello: `applicaPatch` in hooks/bilanciamento.ts (test di parità).
 */
function applicaPatch(prima, patch, togli = []) {
  if (!piano(prima) || !piano(patch) || !Array.isArray(togli)) throw new NonValido('patch')
  const fondi = (a, b) => {
    const o = { ...a }
    for (const [k, v] of Object.entries(b)) {
      if (VIETATE.has(k)) throw new NonValido('patch')
      o[k] = piano(v) && piano(a[k]) ? fondi(a[k], v) : v
    }
    return o
  }
  const out = { ...prima }
  for (const [k, v] of Object.entries(patch)) {
    if (VIETATE.has(k)) throw new NonValido('patch')
    if (v === null) delete out[k]
    else out[k] = piano(v) && piano(out[k]) ? fondi(out[k], v) : v
  }
  for (const p of togli) {
    const s = typeof p === 'string' ? p.split('.') : []
    if (s.length < 2 || s.length > 5 || !s.every(x => SEGMENTO.test(x) && !VIETATE.has(x)) || !Object.hasOwn(patch, s[0])) throw new NonValido('togli')
    let o = out
    for (const x of s.slice(0, -1)) {
      if (!piano(o[x])) {
        o = null
        break
      }
      o[x] = { ...o[x] }
      o = o[x]
    }
    if (o) delete o[s[s.length - 1]]
  }
  return out
}

/**
 * `x` è la radice `r` o sta sotto di essa? Solo stringhe (barre in avanti, niente barra finale); `insensibile` sui file
 * system che non distinguono maiuscole (Windows). Un figlio che si chiama «..cache» è DENTRO: conta solo il separatore.
 * Gemello: `dentroRadice` in hooks/logica.ts (test di parità).
 */
function dentroRadice(r, x, insensibile) {
  const n = s => {
    const t = String(s).replace(/\\/g, '/').replace(/\/+$/, '')
    return insensibile ? t.toLowerCase() : t
  }
  const R = n(r) || '/'
  const X = n(x) || '/'
  return X === R || X.startsWith(R.endsWith('/') ? R : `${R}/`)
}

module.exports = { regoleEfficaci, dentroRadice, restrizioneLarga, accountDa, restrizioniDa, applicaPatch, modoNonValido, modoEfficace, NonValido, FORNITORI }
