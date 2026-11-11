// F13.3/F13.3b: the registry of OpenAI-compatible providers. Twin: strumenti/compatibili.cjs (parity test in prova-disco).
// Self-contained on purpose: the parity test imports this file directly with Node.

/** One provider. URLs are fixed here: nothing from settings or from an agent becomes a URL, except a loopback endpoint. */
export type VoceCompatibile = {
  id: string
  nome: string
  /** OpenAI-compatible base (`/chat/completions` and `/models` are appended); null = chosen by region (Qwen). */
  base: string | null
  locale: boolean
  /** Native sensitive option in plugin.json, or null (no key: Ollama). */
  opzione: string | null
  /** Whether a key is required to use it. */
  chiaveObbligatoria: boolean
  /** Page where the user creates the key (opened with the system opener), or null. */
  paginaChiave: string | null
  /** Cheap authenticated GET that checks the key, absolute or relative to the base; null = none documented. */
  verificaChiave: string | null
  /** The model list, relative to the base. */
  catalogo: string
  /** Where each fact comes from (official docs, read 2026-11-11). */
  fonte: string
}

export const COMPATIBILI: readonly VoceCompatibile[] = [
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

/** Qwen regions: legacy hosts from the docs; the US needs a workspace host (documented pattern only). */
export const REGIONI_QWEN = {
  intl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
  cn: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  us: null,
} as const
export type RegioneQwen = keyof typeof REGIONI_QWEN
const WORKSPACE_QWEN = /^https:\/\/[a-z0-9][a-z0-9-]{0,62}\.(ap-southeast-1|us-east-1|cn-hongkong|ap-northeast-1|cn-beijing)\.maas\.aliyuncs\.com\/compatible-mode\/v1$/

/** Loopback only (F13 round 1, point 7): no LAN trust in 2.2.0. */
export const endpointLoopback = (s: unknown): s is string =>
  typeof s === 'string' && /^http:\/\/(?:localhost|127\.0\.0\.1|\[::1\]):[1-9][0-9]{0,4}\/v1$/.test(s) && Number(s.match(/:([0-9]+)\/v1$/)?.[1]) <= 65535

/** Model ids: colons allowed (`qwen3:8b`), nothing that could become a path or a header. */
export const MODELLO_COMPATIBILE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/

/** The non-Claude executor ids that may write text (F13a↔F13b interface): the registry plus FreeLLMAPI. */
export const ESECUTORI_TESTO: readonly string[] = [...COMPATIBILI.map(v => v.id), 'freellmapi']

export const voceCompatibile = (id: unknown) => COMPATIBILI.find(v => v.id === id)

/** Account settings of one provider: a loopback endpoint for local servers, region (and workspace host) for Qwen. */
export type ImpostazioneCompatibile = { endpoint?: string; regione?: RegioneQwen; workspace?: string }

/** The base URL actually used, or the reason it cannot be used. Never a URL the registry does not allow. */
export function baseDi(id: string, imp: ImpostazioneCompatibile | undefined): { base: string } | { motivo: string } {
  const v = voceCompatibile(id)
  if (!v) return { motivo: 'unknown provider' }
  if (v.locale) {
    const e = imp?.endpoint ?? v.base!
    return endpointLoopback(e) ? { base: e } : { motivo: 'local servers: loopback endpoint only' }
  }
  if (v.id !== 'qwen') return { base: v.base! }
  if (imp?.workspace !== undefined) return WORKSPACE_QWEN.test(imp.workspace) ? { base: imp.workspace } : { motivo: 'Qwen: workspace host outside the documented pattern' }
  const regione = imp?.regione ?? 'intl'
  const b = REGIONI_QWEN[regione]
  return b ? { base: b } : { motivo: 'Qwen US: needs a workspace host' }
}

/** The URL of a registry path: absolute paths come only from the registry itself. */
export const urlDi = (base: string, percorso: string) => (percorso.startsWith('https://') ? percorso : `${base}${percorso}`)

const oggetto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

/** Project opt-in (`progetti[repo].compatibili`): `{ id: 'R1' | 'R2' }`; absent or null = none; undefined = invalid shape. */
export function livelliCompatibiliDa(v: unknown): Record<string, 'R1' | 'R2'> | undefined {
  if (v === undefined || v === null) return {}
  if (!oggetto(v)) return undefined
  const out: Record<string, 'R1' | 'R2'> = {}
  for (const [id, l] of Object.entries(v)) {
    if (l === null) continue
    if (!voceCompatibile(id) || (l !== 'R1' && l !== 'R2')) return undefined
    out[id] = l
  }
  return out
}

/** Account settings (`account.compatibili`): only fields that `baseDi` accepts; anything else makes the shape invalid. */
export function impostazioniCompatibiliDa(v: unknown): Record<string, ImpostazioneCompatibile> | undefined {
  if (v === undefined || v === null) return {}
  if (!oggetto(v)) return undefined
  const out: Record<string, ImpostazioneCompatibile> = {}
  for (const [id, x] of Object.entries(v)) {
    if (x === null) continue
    const voce = voceCompatibile(id)
    if (!voce || !oggetto(x)) return undefined
    const chiavi = Object.keys(x)
    const ammesse = voce.locale ? ['endpoint'] : voce.id === 'qwen' ? ['regione', 'workspace'] : []
    if (chiavi.some(k => !ammesse.includes(k))) return undefined
    const imp: ImpostazioneCompatibile = {
      ...(typeof x.endpoint === 'string' && { endpoint: x.endpoint }),
      ...(typeof x.regione === 'string' && { regione: x.regione as RegioneQwen }),
      ...(typeof x.workspace === 'string' && { workspace: x.workspace }),
    }
    // US without a workspace host is a valid setting that cannot run yet (baseDi says why); every other refusal is a bad shape.
    const usSenzaHost = imp.regione === 'us' && imp.workspace === undefined
    if (chiavi.length !== Object.keys(imp).length || (imp.regione !== undefined && !(imp.regione in REGIONI_QWEN)) || (!usSenzaHost && 'motivo' in baseDi(id, imp)))
      return undefined
    out[id] = imp
  }
  return out
}

/** Why a non-Claude writer cannot be used (F13a↔F13b interface), as a dictionary code; undefined = usable. */
export function scrittoreAmmesso(
  scrittore: { provider: string; modello: string },
  regole: { risorse: { soloLocale: boolean; fornitori: readonly string[]; freellmapi: { livello: string }; compatibili: Record<string, string>; account: { compatibili?: Record<string, ImpostazioneCompatibile> } }; connessi?: readonly string[]; compatibiliConnessi?: readonly string[]; modelli: Record<string, readonly string[]> },
): { k: string; p?: Record<string, string> } | undefined {
  const { provider, modello } = scrittore
  if (!ESECUTORI_TESTO.includes(provider)) return { k: 'cmp.ignoto', p: { provider } }
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
