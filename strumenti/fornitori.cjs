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

const limiteCodex = (id, percentuale, letto, reset) => ({ id, fornitore: 'codex', nome: `Codex piano · ${id === 'codex-primary' ? 'primaria' : 'secondaria'}`,
  percentuale, unita: '%', letto, fonte: 'Codex sessions · token_count/rate_limits', reset })

function finestreCodex(evento) {
  if (!data(evento?.timestamp) || evento?.type !== 'event_msg' || evento?.payload?.type !== 'token_count') return []
  const limiti = evento.payload.rate_limits
  if (limiti?.limit_id && limiti.limit_id !== 'codex') return []
  return ['primary', 'secondary'].flatMap(k => {
    const v = limiti?.[k]
    if (!numero(v?.used_percent) || v.used_percent > 100) return []
    return [limiteCodex(`codex-${k}`, v.used_percent, evento.timestamp, numero(v.resets_at) && v.resets_at < 8e12 ? new Date(v.resets_at * 1000).toISOString() : undefined)]
  })
}

function saldoDeepseek(json, letto) {
  if (typeof json?.is_available !== 'boolean' || !Array.isArray(json.balance_infos)) return []
  return json.balance_infos.flatMap(x => ['USD', 'CNY'].includes(x?.currency) && decimale(x.total_balance)
    ? [{ id: `deepseek-${x.currency.toLowerCase()}`, fornitore: 'deepseek', nome: 'DeepSeek saldo', valore: Number(x.total_balance), unita: x.currency, letto, fonte: 'GET /user/balance' }] : [])
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
  const { timeoutMs, ...resto } = init
  const r = await fetcher(url, { ...resto, redirect: 'error', signal: AbortSignal.timeout(timeoutMs ?? (init.method === 'POST' ? 30_000 : 4_000)) })
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

// --- cache incrementale dei file di sessione Codex --------------------------------------------------------
// Ogni .jsonl si apre solo se è cambiato, e se ne leggono solo i byte nuovi. La cache è un dato derivato:
// illeggibile o non valida si scarta e si ricostruisce (cambia il costo, non il risultato). Tiene solo metadati
// validati: mai payload integrali né testo delle conversazioni.
const TESTA = 256_000
const CODA = 512_000
const BLOCCO = 65_536
const RIGA_MAX = 256_000
const GIORNO = 86_400_000
const testo = (v, n) => (typeof v === 'string' && v && v.length <= n && !/[\x00-\x1f\x7f]/.test(v) ? v : undefined)
const fileCache = home => path.join(home, '.claude', 'chipmanager', 'cache', 'codex.json')
/** R11: l'istantanea delle sessioni Codex, accanto alla cache. */
const fileIstantanea = home => path.join(home, '.claude', 'chipmanager', 'cache', 'sessioni.json')

/** I file recenti, i più nuovi prima: fino a 40 delle ultime 24 ore (sessioni) e 30 degli ultimi 7 giorni (limiti). */
function elencoCodex(home, adesso) {
  const sessioni = []
  const limiti = []
  const pieno = () => sessioni.length >= 40 && limiti.length >= 30
  const visita = (dir, livello) => {
    if (pieno() || livello > 3) return
    const voci = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => b.name.localeCompare(a.name))
    for (const v of voci) {
      if (pieno()) break
      if (v.isSymbolicLink()) continue
      const f = path.join(dir, v.name)
      if (v.isDirectory() && /^\d{2,4}$/.test(v.name)) visita(f, livello + 1)
      else if (v.isFile() && v.name.endsWith('.jsonl')) {
        // Un file sparito fra readdir e stat salta da solo, non svuota l'elenco.
        let st
        try { st = fs.statSync(f) } catch { continue }
        if (sessioni.length < 40 && adesso - st.mtimeMs <= GIORNO) sessioni.push({ f, st })
        if (limiti.length < 30 && adesso - st.mtimeMs <= 7 * GIORNO) limiti.push({ f, st })
      }
    }
  }
  try { visita(path.join(home, '.codex', 'sessions'), 0) } catch { /* nessuna cartella: nessun file */ }
  return { sessioni, limiti }
}

/**
 * Una voce della cache con i soli campi ammessi, validati. Un campo non valido o estraneo invalida la voce INTERA:
 * il file si rilegge da capo, così nessuna misura resta persa a metà.
 */
function vocePulita(v) {
  const n = x => typeof x === 'number' && Number.isFinite(x) && x >= 0
  const solo = (o, chiavi) => !!o && typeof o === 'object' && !Array.isArray(o) && Object.keys(o).every(k => chiavi.includes(k))
  const forse = (x, ok) => x === undefined || ok(x)
  // Sempre una stringa valida: undefined non passa (i campi facoltativi passano da forse()). id e cwd sono obbligatori.
  const t = max => x => typeof x === 'string' && testo(x, max) === x
  const istante = x => typeof x === 'string' && Number.isFinite(Date.parse(x))
  if (!solo(v, ['dimensione', 'mtimeMs', 'ino', 'offset', 'meta', 'primoTurno', 'ultimo', 'limiti']) ||
    !n(v.dimensione) || !n(v.mtimeMs) || !n(v.ino) || !n(v.offset) || v.offset > v.dimensione) return null
  const m = v.meta
  if (m !== null && !(solo(m, ['id', 'cwd', 'ramo', 'figlia']) && t(64)(m.id) && t(400)(m.cwd) && forse(m.ramo, t(80)) && typeof m.figlia === 'boolean')) return null
  const pt = v.primoTurno
  const u = v.ultimo
  if (!solo(pt, ['modello', 'effort']) || !forse(pt.modello, t(60)) || !forse(pt.effort, t(20))) return null
  if (!solo(u, ['modello', 'effort', 'token', 'finestra', 'tokenIl', 'stato']) || !forse(u.modello, t(60)) || !forse(u.effort, t(20)) || !forse(u.tokenIl, data) ||
    !forse(u.token, numero) || !forse(u.finestra, numero) || !['aperto', 'chiuso', 'ignoto'].includes(u.stato)) return null
  if (!Array.isArray(v.limiti) || v.limiti.length > 2 || !v.limiti.every(l => solo(l, ['id', 'percentuale', 'letto', 'reset']) &&
    /^codex-(primary|secondary)$/.test(l.id) && numero(l.percentuale) && l.percentuale <= 100 && data(l.letto) && forse(l.reset, istante))) return null
  return {
    dimensione: v.dimensione, mtimeMs: v.mtimeMs, ino: v.ino, offset: v.offset,
    meta: m && { id: m.id, cwd: m.cwd, ramo: m.ramo, figlia: m.figlia },
    primoTurno: { modello: pt.modello, effort: pt.effort },
    ultimo: { modello: u.modello, effort: u.effort, token: u.token, finestra: u.finestra, tokenIl: u.tokenIl, stato: u.stato },
    limiti: v.limiti.map(l => ({ id: l.id, percentuale: l.percentuale, letto: l.letto, reset: l.reset })),
  }
}

function leggiCache(file) {
  const voci = new Map()
  try {
    const j = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (j?.versione !== 1 || !j.voci || typeof j.voci !== 'object') return voci
    for (const [k, v] of Object.entries(j.voci)) {
      const p = vocePulita(v)
      if (p) voci.set(k, p)
    }
  } catch { /* assente o corrotta: si ricostruisce */ }
  return voci
}

/**
 * Aggiorna la voce di un file. Invariato (dimensione, data, ino): nessuna apertura. Riscritto (altro ino, più corto
 * dell'offset, data indietro, o data cambiata senza crescita): da capo. Cresciuto: solo i byte dopo l'ultimo `\n`
 * letto. Oltre 512 KB d'arretrato lo stato si ricalcola dalla sola coda (ignoto se la coda non lo dice), mentre i
 * limiti si cercano anche nell'intervallo saltato, a blocchi, analizzando solo le righe con `rate_limits`.
 */
function aggiornaVoce(f, st, c, diag) {
  const ino = numero(st.ino) ? st.ino : 0
  if (c && c.dimensione === st.size && c.mtimeMs === st.mtimeMs && c.ino === ino) return c
  const daCapo = !c || (ino && c.ino && ino !== c.ino) || st.size < c.offset || st.mtimeMs < c.mtimeMs || st.size <= c.dimensione
  const v = daCapo
    ? { offset: 0, meta: null, primoTurno: {}, ultimo: { stato: 'ignoto' }, limiti: [] }
    : { ...c, primoTurno: { ...c.primoTurno }, ultimo: { ...c.ultimo }, limiti: [...c.limiti] }
  const da = v.offset
  const inizioCoda = Math.max(da, st.size - CODA)
  if (inizioCoda > da) {
    diag.salti += 1
    // Niente di prima del salto si eredita: tutti gli ultimi campi vengono dalla sola coda, come a cache fredda.
    v.ultimo = { stato: 'ignoto' }
  }
  // I metadati si cercano finché mancano, anche a cache calda: un session_meta può arrivare in due scritture.
  let metaVisto = v.meta !== null
  const esamina = (riga, inizio) => {
    const inCoda = inizio >= inizioCoda
    const inTesta = inizio < TESTA && ((!metaVisto && riga.includes('"session_meta"')) || (!v.primoTurno.modello && riga.includes('"turn_context"')))
    if (!inCoda && !inTesta && !riga.includes('rate_limits')) return
    let e
    try { e = JSON.parse(riga.toString('utf8')) } catch { return }
    const p = e?.payload
    if (inTesta && e?.type === 'session_meta' && !metaVisto) {
      metaVisto = true
      const id = testo(p?.id, 64)
      const cwd = testo(p?.cwd, 400)
      v.meta = id && cwd ? { id, cwd, ramo: testo(p.git?.branch, 80), figlia: !!p.parent_thread_id } : null
    }
    if (e?.type === 'turn_context') {
      if (inTesta && !v.primoTurno.modello) v.primoTurno = { modello: testo(p?.model, 60), effort: testo(p?.effort, 20) }
      if (inCoda) {
        v.ultimo.modello = testo(p?.model, 60) ?? v.ultimo.modello
        v.ultimo.effort = testo(p?.effort, 20) ?? v.ultimo.effort
      }
    }
    if (inCoda && e?.type === 'event_msg') {
      if (p?.type === 'task_started') v.ultimo.stato = 'aperto'
      if (p?.type === 'task_complete') v.ultimo.stato = 'chiuso'
      const t = p?.info?.last_token_usage?.total_tokens
      if (p?.type === 'token_count' && numero(t) && numero(p.info.model_context_window)) {
        v.ultimo.token = t
        v.ultimo.finestra = p.info.model_context_window
        // L'istante della misura è quello dell'evento, non la data del file: un'attività senza token non la rinfresca.
        v.ultimo.tokenIl = data(e.timestamp) ? e.timestamp : undefined
      }
    }
    // Per ogni finestra l'osservazione con il timestamp più recente; un evento senza limiti non cancella nulla.
    for (const x of finestreCodex(e)) {
      const nuovo = { id: x.id, percentuale: x.percentuale, letto: x.letto, reset: x.reset }
      const i = v.limiti.findIndex(l => l.id === x.id)
      if (i < 0) v.limiti.push(nuovo)
      else if (Date.parse(x.letto) > Date.parse(v.limiti[i].letto)) v.limiti[i] = nuovo
    }
  }
  const fd = fs.openSync(f, 'r')
  diag.aperti += 1
  try {
    const b = Buffer.alloc(BLOCCO)
    let pos = da
    let resto = null
    let restoInizio = da
    let scarta = false
    while (pos < st.size) {
      const n = fs.readSync(fd, b, 0, Math.min(BLOCCO, st.size - pos), pos)
      if (n <= 0) break
      diag.byte += n
      if (pos < inizioCoda) diag.byteLimiti += Math.min(n, inizioCoda - pos)
      const blocco = b.subarray(0, n)
      let i = 0
      for (let j = blocco.indexOf(10, i); j >= 0; j = blocco.indexOf(10, i)) {
        if (!scarta) esamina(resto ? Buffer.concat([resto, blocco.subarray(i, j)]) : blocco.subarray(i, j), resto ? restoInizio : pos + i)
        resto = null
        scarta = false
        i = j + 1
        // Solo dopo un `\n`: una riga ancora senza fine si rilegge al giro dopo.
        v.offset = pos + i
      }
      if (i < n && !scarta) {
        if (!resto) restoInizio = pos + i
        resto = resto ? Buffer.concat([resto, blocco.subarray(i)]) : Buffer.from(blocco.subarray(i))
        // Una riga enorme è testo, non un evento che serve: si salta fino al prossimo `\n`.
        if (resto.length > RIGA_MAX) {
          resto = null
          scarta = true
        }
      }
      pos += n
    }
  } finally { fs.closeSync(fd) }
  return vocePulita({ ...v, dimensione: st.size, mtimeMs: st.mtimeMs, ino })
}

async function scriviCache(home, voci) {
  const file = fileCache(home)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const { conMutex, scriviAtomico } = require('./disco.cjs')
  // Dato derivato: se il mutex non arriva in 2 s la cache resta com'è, e il prossimo passaggio la riscrive.
  await conMutex('codex-cache', 2_000, () => scriviAtomico(file, JSON.stringify({ versione: 1, voci: Object.fromEntries(voci) })))
}

/** Aggiorna la cache dei file recenti e la restituisce, con i contatori di questo passaggio. */
async function codexCache(home, adesso = Date.now()) {
  const diag = { byte: 0, byteLimiti: 0, salti: 0, aperti: 0 }
  const elenco = elencoCodex(home, adesso)
  const prima = leggiCache(fileCache(home))
  const voci = new Map()
  for (const { f, st } of [...elenco.sessioni, ...elenco.limiti]) {
    if (voci.has(f)) continue
    try {
      const v = aggiornaVoce(f, st, prima.get(f), diag)
      if (v) voci.set(f, v)
    } catch { /* sparito o illeggibile: fuori dalla cache */ }
  }
  if (JSON.stringify([...voci]) !== JSON.stringify([...prima])) await scriviCache(home, voci).catch(() => undefined)
  return { elenco, voci, diag }
}

/** Limiti di piano Codex dai file degli ultimi 7 giorni, dalla cache: per ogni finestra l'osservazione più recente. */
async function codexLocale(home, adesso = Date.now(), cache) {
  const { elenco, voci } = cache ?? (await codexCache(home, adesso))
  const ultime = new Map()
  for (const { f } of elenco.limiti)
    for (const l of voci.get(f)?.limiti ?? []) if (!ultime.has(l.id) || Date.parse(l.letto) > Date.parse(ultime.get(l.id).letto)) ultime.set(l.id, l)
  return [...ultime.values()].map(l => limiteCodex(l.id, l.percentuale, l.letto, l.reset))
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
  // Errori e stati del proxy sono codici del dizionario del pannello (che li traduce), non frasi.
  let proxy = 'proxy.nonAbilitato'
  const abilita = f => !p.soloLocale && p.fornitori.includes(f)
  const sonda = async (id, f, nome, fonte, fn) => {
    if (!p.fornitori.includes(f)) { limiti.push(assente(id, f, nome, fonte, 'lim.fornitoreNonAbilitato')); return }
    try {
      const l = await fn()
      limiti.push(...(l.length ? l : [assente(id, f, nome, fonte, 'lim.formato')]))
    } catch { limiti.push(assente(id, f, nome, fonte, 'lim.fonte')) }
  }
  await sonda('claude', 'claude', 'Claude piano', 'snapshot status line', async () => {
    const s = JSON.parse(fs.readFileSync(path.join(home, '.claude', 'chipmanager', 'statusline.json'), 'utf8'))
    return finestreClaude(s, s.letto, 'Claude status line · snapshot locale')
  })
  let diagnostica
  await sonda('codex', 'codex', 'Codex piano', 'Codex sessions', async () => {
    const c = await codexCache(home)
    diagnostica = c.diag
    return codexLocale(home, Date.now(), c)
  })
  if (abilita('claude') && chiavi.anthropic) {
    await sonda('claude-api', 'claude', 'Claude API', 'Anthropic Admin · cost_report', async () => costoClaude(await get(
      `https://api.anthropic.com/v1/organizations/cost_report?starting_at=${letto.slice(0, 7)}-01T00%3A00%3A00Z&limit=31`,
      { headers: { 'x-api-key': chiavi.anthropic, 'anthropic-version': '2023-06-01' } }), letto))
  } else limiti.push(assente('claude-api', 'claude', 'Claude API', 'Anthropic Admin', abilita('claude') ? 'lim.chiaveAdmin' : 'lim.rete'))
  if (abilita('deepseek') && chiavi.deepseek) {
    await sonda('deepseek', 'deepseek', 'DeepSeek saldo', 'GET /user/balance', async () => saldoDeepseek(await get('https://api.deepseek.com/user/balance', { headers: { Authorization: `Bearer ${chiavi.deepseek}` } }), letto))
  } else limiti.push(assente('deepseek', 'deepseek', 'DeepSeek saldo', 'GET /user/balance', abilita('deepseek') ? 'lim.chiave' : 'lim.rete'))
  if (abilita('freellmapi')) {
    try {
      await get(p.freellmapi.endpoint.replace(/\/v1$/, '/api/ping'))
      proxy = 'proxy.rilevato'
      if (chiavi.freellmapi) {
        const l = usoFree(await get(`${p.freellmapi.endpoint}/usage`, { headers: { Authorization: `Bearer ${chiavi.freellmapi}` } }), letto)
        if (l.length) { limiti.push(...l); proxy = 'proxy.autenticato' }
      }
    } catch { proxy = 'proxy.irraggiungibile' }
  }
  if (!limiti.some(l => l.fornitore === 'freellmapi')) limiti.push(assente('freellmapi', 'freellmapi', 'FreeLLMAPI', 'GET /v1/usage', proxy))
  return { limiti, proxy, chiavi: { anthropic: !!chiavi.anthropic, deepseek: !!chiavi.deepseek, freellmapi: !!chiavi.freellmapi }, diagnostica }
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

/**
 * Sessioni Codex delle ultime 24 ore: solo metadati (cartella, ramo, modello, effort, token, finestra, stato).
 * Mai testo della conversazione: dalla cache vengono soltanto session_meta, turn_context, token_count e task_*.
 * `stato` ignoto (un salto oltre la coda senza eventi di turno) non è «in corso».
 */
async function sessioniCodexLocali(home, adesso = Date.now()) {
  const c = await codexCache(home, adesso)
  const sessioni = c.elenco.sessioni.flatMap(({ f, st }) => {
    const v = c.voci.get(f)
    if (!v?.meta || v.meta.figlia) return []
    // Un turno aperto in un file fermo da 10 minuti è un processo finito male, non lavoro in corso.
    return [{ id: v.meta.id, cwd: v.meta.cwd, ramo: v.meta.ramo, attivita: new Date(st.mtimeMs).toISOString(),
      modello: v.ultimo.modello ?? v.primoTurno.modello, effort: v.ultimo.effort ?? v.primoTurno.effort, token: v.ultimo.token, finestra: v.ultimo.finestra, tokenIl: v.ultimo.tokenIl,
      stato: v.ultimo.stato, inCorso: v.ultimo.stato === 'aperto' && adesso - st.mtimeMs <= 600_000 }]
  })
  return { sessioni, diagnostica: c.diag }
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
  if (cmd === 'sessioni') {
    const r = await sessioniCodexLocali(os.homedir())
    // R11: un'istantanea per gli altri pannelli (versionata, scritta con file temporaneo e rinomina); chi la legge entro
    // 20 s non avvia un processo. Un errore di scrittura non tocca la risposta.
    try {
      const { scriviAtomico } = require('./disco.cjs')
      fs.mkdirSync(path.dirname(fileIstantanea(os.homedir())), { recursive: true })
      scriviAtomico(fileIstantanea(os.homedir()), JSON.stringify({ v: 1, istante: new Date().toISOString(), ...r }))
    } catch { /* istantanea saltata */ }
    process.stdout.write(JSON.stringify(r))
    return
  }
  const output = cmd === 'limiti' ? await osserva(input, chiavi) : cmd === 'completa' ? { risultato: await completa(input.politica, input, chiavi.freellmapi) } : null
  if (!output) throw new Error('comando non valido')
  const testo = JSON.stringify(output)
  if (Object.values(chiavi).some(k => k && testo.includes(k))) throw new Error('risposta non utilizzabile')
  process.stdout.write(testo)
}
if (require.main === module) main().catch(() => { process.stderr.write('Fonte o richiesta non disponibile'); process.exitCode = 1 })
module.exports = { sessioniCodexLocali, codexCache, fileCache, finestreClaude, finestreCodex, saldoDeepseek, costoClaude, usoFree, codexLocale, osserva, completa, richiesta, locale }
