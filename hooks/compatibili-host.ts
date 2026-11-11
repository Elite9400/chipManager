// F13.3b: the host side of the OpenAI-compatible providers. Keys stay in the native sensitive options and reach only the
// helper process of the provider in question, through its environment (never argv, records or the panel).
import type { EngineInterface } from 'claude-code'
import { COMPATIBILI, MODELLO_COMPATIBILE, voceCompatibile } from './compatibili'
import { conta } from './logica'

/** Registry providers usable now: no key needed, or its native option is set. Environment variables never count. */
export const connessiCompatibili = (opz: Record<string, unknown>) =>
  COMPATIBILI.filter(v => !v.chiaveObbligatoria || (!!v.opzione && typeof opz[v.opzione] === 'string' && (opz[v.opzione] as string).trim().length > 0)).map(v => v.id)

export type EsitoVerifica = 'valida' | 'rifiutata' | 'irraggiungibile' | 'assente' | 'nonDisponibile' | 'configurazione' | 'ignoto'
export type Rilevato = { id: string; base: string; modelli: string[] }

/** Runs `strumenti/compatibili.cjs`. Only the key of `provider` goes into the child's environment. */
export async function chiamaCompatibile($: EngineInterface, opz: Record<string, unknown>, comando: 'rileva' | 'verifica' | 'completa', input: { provider?: string } & Record<string, unknown>) {
  const env: Record<string, string> = {}
  const v = voceCompatibile(input.provider)
  const chiave = v?.opzione && typeof opz[v.opzione] === 'string' ? (opz[v.opzione] as string).trim() : ''
  if (v && chiave) env[`CHIPMANAGER_${v.id.toUpperCase()}_KEY`] = chiave
  conta({ processi: 1 }, `compatibili-${comando}`)
  const r = await $.process.run(['node', `${$.plugin.root.replace(/\\/g, '/')}/strumenti/compatibili.cjs`, comando],
    { stdin: JSON.stringify(input), env, timeoutMs: comando === 'completa' ? 40_000 : 20_000 })
  if (r.exitCode !== 0 || r.isStdoutTruncated) throw new Error(comando === 'completa' ? 'provider answer not usable' : 'provider not reachable')
  if (chiave && r.stdout.includes(chiave)) throw new Error('answer not usable')
  return JSON.parse(r.stdout) as unknown
}

/** The helper's answers re-read field by field: nothing else enters the state. */
export function esitoVerifica(json: unknown): EsitoVerifica {
  const e = (json as { esito?: unknown } | null)?.esito
  return ['valida', 'rifiutata', 'irraggiungibile', 'assente', 'nonDisponibile', 'configurazione', 'ignoto'].includes(e as string) ? (e as EsitoVerifica) : 'ignoto'
}
export function rilevatiDa(json: unknown): Rilevato[] {
  const t = (json as { trovati?: unknown } | null)?.trovati
  if (!Array.isArray(t)) return []
  return t.flatMap(x => {
    const o = x as { id?: unknown; base?: unknown; modelli?: unknown }
    const v = [...COMPATIBILI, { id: 'freellmapi', locale: true }].find(y => y.id === o?.id)
    if (!v?.locale || typeof o.base !== 'string' || !/^http:\/\/localhost:\d{1,5}\/v1$/.test(o.base) || !Array.isArray(o.modelli)) return []
    return [{ id: v.id, base: o.base, modelli: o.modelli.filter((m): m is string => typeof m === 'string' && MODELLO_COMPATIBILE.test(m)).slice(0, 50) }]
  })
}
