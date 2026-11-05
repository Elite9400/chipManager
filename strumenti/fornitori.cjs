'use strict'
// Solo osservazioni numeriche escono dalle sonde; corpi HTTP, credenziali e transcript restano qui.
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const numero = v => typeof v === 'number' && Number.isFinite(v) && v >= 0
const decimale = v => typeof v === 'string' && /^-?\d+(?:\.\d+)?$/.test(v) && Number.isFinite(Number(v))
const data = v => typeof v === 'string' && Number.isFinite(Date.parse(v)) && Date.parse(v) <= Date.now() + 1000
const locale = s => typeof s === 'string' && /^http:\/\/(localhost|127\.0\.0\.1|\[::1\]):[1-9][0-9]{0,4}\/v1$/.test(s) && Number(s.match(/:([0-9]+)\/v1$/)?.[1]) <= 65535
const assente = (id, fornitore, nome, fonte, errore) => ({ id, fornitore, nome, fonte, errore })

function finestreClaude(json, letto, fonte) {
  if (!data(letto)) return []
  const limiti = json?.rate_limits ?? json
  return ['five_hour', 'seven_day'].flatMap(k => {
    const v = limiti?.[k]
    const n = v?.used_percentage ?? v?.utilization
    if (!numero(n) || n > 100) return []
    const reset = typeof v.resets_at === 'string' && Number.isFinite(Date.parse(v.resets_at)) ? v.resets_at : undefined
    return [{ id: `claude-${k}`, fornitore: 'claude', nome: `Claude piano · ${k === 'five_hour' ? '5 ore' : '7 giorni'}`, percentuale: n, unita: '%', letto, fonte, reset }]
  })
}

function finestreCodex(evento) {
  if (!data(evento?.timestamp) || evento?.type !== 'event_msg' || evento?.payload?.type !== 'token_count') return []
  const limiti = evento.payload.rate_limits
  if (limiti?.limit_id && limiti.limit_id !== 'codex') return []
  return ['primary', 'secondary'].flatMap(k => {
    const v = limiti?.[k]
    if (!numero(v?.used_percent) || v.used_percent > 100) return []
    return [{ id: `codex-${k}`, fornitore: 'codex', nome: `Codex piano · ${k === 'primary' ? 'primaria' : 'secondaria'}`,
      percentuale: v.used_percent, unita: '%', letto: evento.timestamp, fonte: 'Codex sessions · token_count/rate_limits',
      reset: numero(v.resets_at) && v.resets_at < 8e12 ? new Date(v.resets_at * 1000).toISOString() : undefined }]
  })
}

function saldoDeepseek(json, letto) {
  if (typeof json?.is_available !== 'boolean' || !Array.isArray(json.balance_infos)) return []
  return json.balance_infos.flatMap(x => ['USD', 'CNY'].includes(x?.currency) && decimale(x.total_balance)
    ? [{ id: `deepseek-${x.currency}`, fornitore: 'deepseek', nome: 'DeepSeek saldo', valore: Number(x.total_balance), unita: x.currency, letto, fonte: 'GET /user/balance' }] : [])
}

function costoClaude(json, letto) {
  if (!Array.isArray(json?.data) || json.has_more !== false) return []
  let totale = 0
  for (const bucket of json.data) {
    if (!Array.isArray(bucket?.results)) return []
    for (const x of bucket.results) {
      if (x.currency !== 'USD' || !decimale(x.amount)) return []
      totale += Number(x.amount)
    }
  }
  // L'API legacy restituisce centesimi USD, anche frazionari: non sono dollari.
  return Number.isFinite(totale) ? [{ id: 'claude-api', fornitore: 'claude', nome: 'Claude API · mese UTC', valore: totale / 100, unita: 'USD', letto, fonte: 'Anthropic Admin · cost_report' }] : []
}

function usoFree(json, letto) {
  if (!/^\d{4}-\d{2}$/.test(json?.month) || !numero(json.requests) || !numero(json.tokens)) return []
  // Non sommare i cap delle chiavi: non sono la quota gratuita dell'intero pool.
  return [{ id: 'freellmapi', fornitore: 'freellmapi', nome: 'FreeLLMAPI · richieste mese', valore: json.requests,
    unita: 'richieste', letto, fonte: 'GET /v1/usage · quota totale non pubblicata' }]
}

async function richiesta(url, init = {}, fetcher = fetch) {
  const r = await fetcher(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(init.method === 'POST' ? 30_000 : 4_000) })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  const reader = r.body.getReader()
  const parti = []
  let n = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      n += value.length
      if (n > 512_000) throw new Error('risposta troppo grande')
      parti.push(Buffer.from(value))
    }
  } finally { await reader.cancel().catch(() => {}) }
  return JSON.parse(Buffer.concat(parti).toString('utf8'))
}

/** Legge al massimo trenta code da 512 KiB, senza emettere testo delle conversazioni. */
function codexLocale(home) {
  const radice = path.join(home, '.codex', 'sessions')
  const file = []
  const visita = (dir, livello) => {
    if (file.length >= 30 || livello > 3) return
    const voci = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => b.name.localeCompare(a.name))
    for (const v of voci) {
      if (file.length >= 30) break
      if (v.isSymbolicLink()) continue
      if (v.isDirectory() && /^\d{2,4}$/.test(v.name)) visita(path.join(dir, v.name), livello + 1)
      else if (v.isFile() && v.name.endsWith('.jsonl')) file.push(path.join(dir, v.name))
    }
  }
  visita(radice, 0)
  const ultime = new Map()
  for (const f of file) {
    const fd = fs.openSync(f, 'r')
    try {
      const size = fs.fstatSync(fd).size
      const buffer = Buffer.alloc(Math.min(size, 512_000))
      fs.readSync(fd, buffer, 0, buffer.length, size - buffer.length)
      for (const riga of buffer.toString('utf8').split('\n')) {
        try {
          for (const x of finestreCodex(JSON.parse(riga))) if (!ultime.has(x.id) || Date.parse(x.letto) > Date.parse(ultime.get(x.id).letto)) ultime.set(x.id, x)
        } catch { /* una coda può iniziare o finire a metà evento */ }
      }
    } finally { fs.closeSync(fd) }
  }
  return [...ultime.values()]
}

function politicaValida(p) {
  return p && Array.isArray(p.fornitori) && p.fornitori.every(x => ['claude', 'codex', 'deepseek', 'freellmapi'].includes(x)) &&
    typeof p.soloLocale === 'boolean' && p.freellmapi && ['niente', 'R1', 'R2'].includes(p.freellmapi.livello) && locale(p.freellmapi.endpoint)
}

async function osserva(p, chiavi, deps = {}) {
  if (!politicaValida(p)) throw new Error('politica non valida')
  const home = deps.home ?? os.homedir()
  const get = deps.richiesta ?? richiesta
  const letto = new Date().toISOString()
  const limiti = []
  let proxy = 'non abilitato'
  const abilita = f => !p.soloLocale && p.fornitori.includes(f)
  const sonda = async (id, f, nome, fonte, fn) => {
    if (!p.fornitori.includes(f)) { limiti.push(assente(id, f, nome, fonte, 'fornitore non abilitato')); return }
    try {
      const l = await fn()
      limiti.push(...(l.length ? l : [assente(id, f, nome, fonte, 'formato non disponibile')]))
    } catch { limiti.push(assente(id, f, nome, fonte, 'fonte non disponibile')) }
  }
  await sonda('claude', 'claude', 'Claude piano', 'snapshot status line', async () => {
    const s = JSON.parse(fs.readFileSync(path.join(home, '.claude', 'chipmanager', 'statusline.json'), 'utf8'))
    return finestreClaude(s, s.letto, 'Claude status line · snapshot locale')
  })
  await sonda('codex', 'codex', 'Codex piano', 'Codex sessions', async () => codexLocale(home))
  if (abilita('claude') && chiavi.anthropic) {
    await sonda('claude-api', 'claude', 'Claude API', 'Anthropic Admin · cost_report', async () => costoClaude(await get(
      `https://api.anthropic.com/v1/organizations/cost_report?starting_at=${letto.slice(0, 7)}-01T00%3A00%3A00Z&limit=31`,
      { headers: { 'x-api-key': chiavi.anthropic, 'anthropic-version': '2023-06-01' } }), letto))
  } else limiti.push(assente('claude-api', 'claude', 'Claude API', 'Anthropic Admin', abilita('claude') ? 'chiave admin mancante' : 'rete non abilitata'))
  if (abilita('deepseek') && chiavi.deepseek) {
    await sonda('deepseek', 'deepseek', 'DeepSeek saldo', 'GET /user/balance', async () => saldoDeepseek(await get('https://api.deepseek.com/user/balance', { headers: { Authorization: `Bearer ${chiavi.deepseek}` } }), letto))
  } else limiti.push(assente('deepseek', 'deepseek', 'DeepSeek saldo', 'GET /user/balance', abilita('deepseek') ? 'chiave mancante' : 'rete non abilitata'))
  if (abilita('freellmapi')) {
    try {
      await get(p.freellmapi.endpoint.replace(/\/v1$/, '/api/ping'))
      proxy = 'rilevato su loopback; accesso API da verificare'
      if (chiavi.freellmapi) {
        const l = usoFree(await get(`${p.freellmapi.endpoint}/usage`, { headers: { Authorization: `Bearer ${chiavi.freellmapi}` } }), letto)
        if (l.length) { limiti.push(...l); proxy = 'rilevato; API autenticata' }
      }
    } catch { proxy = 'non raggiungibile o API non disponibile' }
  }
  if (!limiti.some(l => l.fornitore === 'freellmapi')) limiti.push(assente('freellmapi', 'freellmapi', 'FreeLLMAPI', 'GET /v1/usage', proxy))
  return { limiti, proxy, chiavi: { anthropic: !!chiavi.anthropic, deepseek: !!chiavi.deepseek, freellmapi: !!chiavi.freellmapi } }
}

/** Solo testo, nessuna lettura di file o tool call. Il controllo completo del mandato è nella mod. */
async function completa(p, input, chiave, get = richiesta) {
  if (!politicaValida(p) || p.soloLocale || !p.fornitori.includes('freellmapi') || p.freellmapi.livello === 'niente' || !chiave) throw new Error('FreeLLMAPI non abilitato')
  if (typeof input.testo !== 'string' || input.testo.length > 1502 || !/^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,99}$/.test(input.modello) || /^(auto|fusion|claude-)/i.test(input.modello)) throw new Error('mandato non valido')
  // Il pin legacy può ricadere su ALTRI modelli. Solo i gruppi unificati hanno fallback confinato.
  const catalogo = await get(`${p.freellmapi.endpoint}/models/${encodeURIComponent(input.modello)}`, { headers: { Authorization: `Bearer ${chiave}` } })
  if (catalogo?.id !== input.modello || catalogo.owned_by !== 'freellmapi' || catalogo.available !== true) throw new Error('serve un modello unificato disponibile: nessun fallback libero')
  const r = await get(`${p.freellmapi.endpoint}/chat/completions`, { method: 'POST', headers: { Authorization: `Bearer ${chiave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: input.modello, messages: [{ role: 'user', content: input.testo }], stream: false, max_tokens: 2048 }) })
  const msg = r?.choices?.[0]?.message
  if (typeof msg?.content !== 'string' || msg.tool_calls?.length || msg.content.length > 30000 || msg.content.includes(chiave)) throw new Error('risposta non utilizzabile')
  return msg.content
}

async function main() {
  const cmd = process.argv[2]
  const input = JSON.parse(fs.readFileSync(0, 'utf8'))
  if (cmd === 'statusline') {
    const letto = new Date().toISOString()
    const rate_limits = {}
    for (const l of finestreClaude(input, letto, 'statusline')) rate_limits[l.id.slice(7)] = { used_percentage: l.percentuale, resets_at: l.reset }
    const dir = path.join(os.homedir(), '.claude', 'chipmanager')
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'statusline.json'), JSON.stringify({ letto, rate_limits }), { mode: 0o600 })
    return
  }
  const chiavi = { anthropic: process.env.CHIPMANAGER_ANTHROPIC_ADMIN_KEY || process.env.ANTHROPIC_ADMIN_KEY,
    deepseek: process.env.CHIPMANAGER_DEEPSEEK_KEY || process.env.DEEPSEEK_API_KEY, freellmapi: process.env.CHIPMANAGER_FREELLMAPI_KEY || process.env.FREELLMAPI_KEY }
  const output = cmd === 'limiti' ? await osserva(input, chiavi) : cmd === 'completa' ? { risultato: await completa(input.politica, input, chiavi.freellmapi) } : null
  if (!output) throw new Error('comando non valido')
  const testo = JSON.stringify(output)
  if (Object.values(chiavi).some(k => k && testo.includes(k))) throw new Error('risposta non utilizzabile')
  process.stdout.write(testo)
}
if (require.main === module) main().catch(() => { process.stderr.write('Fonte o richiesta non disponibile'); process.exitCode = 1 })
module.exports = { finestreClaude, finestreCodex, saldoDeepseek, costoClaude, usoFree, codexLocale, osserva, completa, richiesta, locale }
