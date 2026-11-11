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
