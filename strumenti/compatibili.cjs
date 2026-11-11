'use strict'
// F13.3/F13.3b: registry of OpenAI-compatible providers (twin of hooks/compatibili.ts, parity test in prova-disco) and the
// generic text executor. Text in, text out: no repository, no tools. Keys reach this process only through its environment.
//
//   node compatibili.cjs rileva                  local servers answering GET /models (loopback only, short timeout)
//   node compatibili.cjs verifica   (stdin)      { provider, imp }: one cheap authenticated GET, only on the owner's click
//   node compatibili.cjs completa   (stdin)      { provider, imp, livello, soloLocale, modello, testo }
const { richiesta } = require('./fornitori.cjs')

const COMPATIBILI = [
  { id: 'deepseek', nome: 'DeepSeek', base: 'https://api.deepseek.com', locale: false, opzione: 'deepseekKey', chiaveObbligatoria: true,
    paginaChiave: 'https://platform.deepseek.com/api_keys', verificaChiave: '/models', catalogo: '/models', fonte: 'https://api-docs.deepseek.com/' },
  { id: 'openrouter', nome: 'OpenRouter', base: 'https://openrouter.ai/api/v1', locale: false, opzione: 'openrouterKey', chiaveObbligatoria: true,
    paginaChiave: 'https://openrouter.ai/settings/keys', verificaChiave: 'https://openrouter.ai/api/v1/key', catalogo: '/models', fonte: 'https://openrouter.ai/docs' },
  { id: 'qwen', nome: 'Qwen (Alibaba Cloud Model Studio)', base: null, locale: false, opzione: 'qwenKey', chiaveObbligatoria: true,
    paginaChiave: 'https://modelstudio.console.alibabacloud.com/model/settings/api-key', verificaChiave: '/models', catalogo: '/models',
    fonte: 'https://www.alibabacloud.com/help/en/model-studio/compatibility-of-openai-with-dashscope' },
  { id: 'mistral', nome: 'Mistral', base: 'https://api.mistral.ai/v1', locale: false, opzione: 'mistralKey', chiaveObbligatoria: true,
    paginaChiave: 'https://console.mistral.ai/api-keys', verificaChiave: '/models', catalogo: '/models', fonte: 'https://docs.mistral.ai/api' },
  { id: 'groq', nome: 'Groq', base: 'https://api.groq.com/openai/v1', locale: false, opzione: 'groqKey', chiaveObbligatoria: true,
    paginaChiave: 'https://console.groq.com/keys', verificaChiave: '/models', catalogo: '/models', fonte: 'https://console.groq.com/docs/openai' },
  { id: 'ollama', nome: 'Ollama', base: 'http://localhost:11434/v1', locale: true, opzione: null, chiaveObbligatoria: false,
    paginaChiave: null, verificaChiave: null, catalogo: '/models', fonte: 'https://docs.ollama.com/api/openai-compatibility' },
  { id: 'lmstudio', nome: 'LM Studio', base: 'http://localhost:1234/v1', locale: true, opzione: 'lmstudioKey', chiaveObbligatoria: false,
    paginaChiave: null, verificaChiave: '/models', catalogo: '/models', fonte: 'https://lmstudio.ai/docs/developer/openai-compat' },
  { id: 'vllm', nome: 'vLLM', base: 'http://localhost:8000/v1', locale: true, opzione: 'vllmKey', chiaveObbligatoria: false,
    paginaChiave: null, verificaChiave: '/models', catalogo: '/models', fonte: 'https://docs.vllm.ai/en/stable/serving/online_serving/' },
]
const REGIONI_QWEN = { intl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1', cn: 'https://dashscope.aliyuncs.com/compatible-mode/v1', us: null }
const WORKSPACE_QWEN = /^https:\/\/[a-z0-9][a-z0-9-]{0,62}\.(ap-southeast-1|us-east-1|cn-hongkong|ap-northeast-1|cn-beijing)\.maas\.aliyuncs\.com\/compatible-mode\/v1$/
const endpointLoopback = s =>
  typeof s === 'string' && /^http:\/\/(?:localhost|127\.0\.0\.1|\[::1\]):[1-9][0-9]{0,4}\/v1$/.test(s) && Number(s.match(/:([0-9]+)\/v1$/)?.[1]) <= 65535
const MODELLO_COMPATIBILE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/
const ESECUTORI_TESTO = [...COMPATIBILI.map(v => v.id), 'freellmapi']
const voceCompatibile = id => COMPATIBILI.find(v => v.id === id)

function baseDi(id, imp) {
  const v = voceCompatibile(id)
  if (!v) return { motivo: 'unknown provider' }
  if (v.locale) {
    const e = imp?.endpoint ?? v.base
    return endpointLoopback(e) ? { base: e } : { motivo: 'local servers: loopback endpoint only' }
  }
  if (v.id !== 'qwen') return { base: v.base }
  if (imp?.workspace !== undefined) return WORKSPACE_QWEN.test(imp.workspace) ? { base: imp.workspace } : { motivo: 'Qwen: workspace host outside the documented pattern' }
  const b = REGIONI_QWEN[imp?.regione ?? 'intl']
  return b ? { base: b } : { motivo: 'Qwen US: needs a workspace host' }
}
const urlDi = (base, percorso) => (percorso.startsWith('https://') ? percorso : `${base}${percorso}`)
const oggetto = v => !!v && typeof v === 'object' && !Array.isArray(v)

function livelliCompatibiliDa(v) {
  if (v === undefined || v === null) return {}
  if (!oggetto(v)) return undefined
  const out = {}
  for (const [id, l] of Object.entries(v)) {
    if (l === null) continue
    if (!voceCompatibile(id) || (l !== 'R1' && l !== 'R2')) return undefined
    out[id] = l
  }
  return out
}

function impostazioniCompatibiliDa(v) {
  if (v === undefined || v === null) return {}
  if (!oggetto(v)) return undefined
  const out = {}
  for (const [id, x] of Object.entries(v)) {
    if (x === null) continue
    const voce = voceCompatibile(id)
    if (!voce || !oggetto(x)) return undefined
    const chiavi = Object.keys(x)
    const ammesse = voce.locale ? ['endpoint'] : voce.id === 'qwen' ? ['regione', 'workspace'] : []
    if (chiavi.some(k => !ammesse.includes(k))) return undefined
    const imp = {
      ...(typeof x.endpoint === 'string' && { endpoint: x.endpoint }),
      ...(typeof x.regione === 'string' && { regione: x.regione }),
      ...(typeof x.workspace === 'string' && { workspace: x.workspace }),
    }
    const usSenzaHost = imp.regione === 'us' && imp.workspace === undefined
    if (chiavi.length !== Object.keys(imp).length || (imp.regione !== undefined && !(imp.regione in REGIONI_QWEN)) || (!usSenzaHost && 'motivo' in baseDi(id, imp)))
      return undefined
    out[id] = imp
  }
  return out
}

function scrittoreAmmesso(scrittore, regole) {
  const { provider, modello } = scrittore
  if (!ESECUTORI_TESTO.includes(provider)) return { k: 'cmp.ignoto', p: { provider: String(provider ?? '') } }
  if (regole.risorse.soloLocale) return { k: 'v.soloLocale' }
  if (provider === 'freellmapi') {
    if (!regole.risorse.fornitori.includes('freellmapi') || regole.risorse.freellmapi.livello === 'niente') return { k: 'v.fornitoreNonAbilitato', p: { fornitore: provider } }
    if (!(regole.connessi ?? []).includes('freellmapi')) return { k: 'v.nonConnesso', p: { fornitore: provider } }
    return regole.modelli.freellmapi?.includes(modello) ? undefined : { k: 'v.modelloNonAmmesso', p: { modello, esecutore: provider } }
  }
  if (!regole.risorse.compatibili[provider]) return { k: 'v.fornitoreNonAbilitato', p: { fornitore: provider } }
  if (!(regole.compatibiliConnessi ?? []).includes(provider)) return { k: 'v.nonConnesso', p: { fornitore: provider } }
  const b = baseDi(provider, regole.risorse.account.compatibili?.[provider])
  if ('motivo' in b) return { k: 'cmp.configurazione', p: { provider, motivo: b.motivo } }
  return MODELLO_COMPATIBILE.test(modello) ? undefined : { k: 'v.modelloNonAmmesso', p: { modello, esecutore: provider } }
}

/** The key from this process's environment: `CHIPMANAGER_<ID>_KEY`, set by the mod from the native option. */
const chiaveDi = (id, env = process.env) => env[`CHIPMANAGER_${id.toUpperCase()}_KEY`] || undefined
const intestazioni = chiave => (chiave ? { Authorization: `Bearer ${chiave}` } : {})

/** Model ids from an OpenAI-style list, validated; anything else in the body is dropped. */
const idModelli = json => (Array.isArray(json?.data) ? json.data.map(m => m?.id).filter(x => typeof x === 'string' && MODELLO_COMPATIBILE.test(x)).slice(0, 200) : null)

/** Only on the owner's click. Outcomes are codes for the panel's dictionary, never the HTTP body. */
async function verifica(input, env = process.env, get = richiesta) {
  const v = voceCompatibile(input?.provider)
  if (!v) return { esito: 'ignoto' }
  if (!v.verificaChiave) return { esito: 'nonDisponibile' }
  const chiave = chiaveDi(v.id, env)
  if (v.chiaveObbligatoria && !chiave) return { esito: 'assente' }
  const b = baseDi(v.id, input.imp)
  if ('motivo' in b) return { esito: 'configurazione', motivo: b.motivo }
  try {
    await get(urlDi(b.base, v.verificaChiave), { headers: intestazioni(chiave) })
    return { esito: 'valida' }
  } catch (e) {
    return { esito: /HTTP (401|403)\b/.test(String(e?.message)) ? 'rifiutata' : 'irraggiungibile' }
  }
}

/** Local servers on their default loopback endpoints (FreeLLMAPI preset included): short timeout, no key. */
async function rileva(get = richiesta) {
  const punti = [...COMPATIBILI.filter(v => v.locale).map(v => ({ id: v.id, base: v.base })), { id: 'freellmapi', base: 'http://localhost:3001/v1' }]
  const trovati = []
  for (const p of punti) {
    try {
      const modelli = idModelli(await get(`${p.base}/models`, { timeoutMs: 1_500 }))
      if (modelli) trovati.push({ id: p.id, base: p.base, modelli })
    } catch { /* not running: not listed */ }
  }
  return { trovati }
}

/**
 * Text only. The mod already checked lanes, the LAN-data filter and the text limit on the whole text; this re-checks
 * what it can see and refuses anything else (fail-closed).
 */
async function completa(input, env = process.env, get = richiesta) {
  const v = voceCompatibile(input?.provider)
  if (!v || input.soloLocale !== false || !['R1', 'R2'].includes(input.livello)) throw new Error('provider not enabled')
  if (typeof input.testo !== 'string' || !input.testo.trim() || input.testo.length > 1502 || typeof input.modello !== 'string' || !MODELLO_COMPATIBILE.test(input.modello))
    throw new Error('invalid mandate')
  const chiave = chiaveDi(v.id, env)
  if (v.chiaveObbligatoria && !chiave) throw new Error('key missing')
  const b = baseDi(v.id, input.imp)
  if ('motivo' in b) throw new Error(b.motivo)
  const modelli = idModelli(await get(urlDi(b.base, v.catalogo), { headers: intestazioni(chiave) }))
  if (!modelli?.includes(input.modello)) throw new Error('model not in the provider catalogue')
  const r = await get(`${b.base}/chat/completions`, {
    method: 'POST', headers: { ...intestazioni(chiave), 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: input.modello, messages: [{ role: 'user', content: input.testo }], stream: false, max_tokens: 2048 }),
  })
  const msg = r?.choices?.[0]?.message
  if (typeof msg?.content !== 'string' || msg.tool_calls?.length || msg.function_call || msg.content.length > 30000) throw new Error('unusable answer')
  // The key-leak check only when there is a key (an empty string would match everything).
  if (chiave && msg.content.includes(chiave)) throw new Error('unusable answer')
  return msg.content
}

async function main(argv = process.argv.slice(2), env = process.env) {
  const cmd = argv[0]
  const input = cmd === 'rileva' ? {} : JSON.parse(require('node:fs').readFileSync(0, 'utf8'))
  const output = cmd === 'rileva' ? await rileva() : cmd === 'verifica' ? await verifica(input, env) : cmd === 'completa' ? { risultato: await completa(input, env) } : null
  if (!output) throw new Error('invalid command')
  const testo = JSON.stringify(output)
  if (COMPATIBILI.some(v => { const k = chiaveDi(v.id, env); return k && testo.includes(k) })) throw new Error('unusable answer')
  process.stdout.write(testo)
}
if (require.main === module) main().catch(e => { process.stderr.write(String(e?.message ?? 'request not available').slice(0, 200)); process.exitCode = 1 })

module.exports = { COMPATIBILI, REGIONI_QWEN, ESECUTORI_TESTO, MODELLO_COMPATIBILE, endpointLoopback, voceCompatibile, baseDi, urlDi, chiaveDi,
  livelliCompatibiliDa, impostazioniCompatibiliDa, scrittoreAmmesso, verifica, rileva, completa, main }
