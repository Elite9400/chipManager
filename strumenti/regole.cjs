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

/** `{ budgetUsd, tetto? }` o assente (null = tolto). */
function apiDa(v, campo) {
  if (v === undefined || v === null) return undefined
  if (!oggetto(v) || !numero(v.budgetUsd, 0.01, 100_000) || (v.tetto !== undefined && !numero(v.tetto, 0.01, 1_000))) no(campo)
  return { budgetUsd: v.budgetUsd, ...(v.tetto !== undefined && { tetto: v.tetto }) }
}

function accountDa(v) {
  if (v === undefined || v === null) return { soglie: {} }
  if (!oggetto(v)) no('account')
  const api = apiDa(v.apiClaude, 'account.apiClaude')
  const f = v.freellmapi ?? undefined
  if (f !== undefined && (!oggetto(f) || (f.endpoint !== undefined && !endpointLocale(f.endpoint)))) no('account.freellmapi')
  return { soglie: soglieDa(v.soglie, 'account.soglie'), ...(api && { apiClaude: { budgetUsd: api.budgetUsd, tetto: api.tetto ?? TETTO_PREDEFINITO } }), ...(f && typeof f.endpoint === 'string' && { endpoint: f.endpoint }) }
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
  const fp = p.freellmapi
  if (fp !== undefined && (!oggetto(fp) || (fp.endpoint !== undefined && !endpointLocale(fp.endpoint)))) no('freellmapi')
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
  return { soglie, apiClaude, endpoint: (fp && fp.endpoint) ?? account.endpoint ?? ENDPOINT_PREDEFINITO }
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

module.exports = { regoleEfficaci, restrizioneLarga, accountDa, restrizioniDa, NonValido, FORNITORI }
