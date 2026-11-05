import type { EngineInterface } from 'claude-code'
import type { Limite, Regole, Risorse } from '../types'
import { FORNITORI } from './logica'

export const RISORSE_VUOTE: Risorse = { limiti: [], proxy: 'non verificato', chiavi: { anthropic: false, deepseek: false, freellmapi: false } }
export const FREE_COMMIT = 'fb07845faf7cf986ea9f3692e055076035dd8739'
const immagine = `chipmanager-freellmapi:${FREE_COMMIT.slice(0, 12)}`
export const INSTALLAZIONE = [
  ['docker', 'build', '--build-arg', `FREELLMAPI_COMMIT_SHA=${FREE_COMMIT}`, '-t', immagine, `https://github.com/tashfeenahmed/freellmapi.git#${FREE_COMMIT}`],
  ['docker', 'run', '-d', '--name', 'chipmanager-freellmapi', '--user', '1000:1000', '--cap-drop=ALL', '--security-opt=no-new-privileges', '-p', '127.0.0.1:3001:3001', '-v', 'chipmanager-freellmapi-data:/app/server/data', immagine],
] as const

/** Le chiavi vivono solo nel trasporto al processo, mai nel risultato o negli argv. */
export async function fonte($: EngineInterface, options: Record<string, unknown>, comando: 'limiti' | 'completa', input: unknown) {
  const env: Record<string, string> = {}
  if (typeof options.anthropicAdminKey === 'string' && options.anthropicAdminKey) env.CHIPMANAGER_ANTHROPIC_ADMIN_KEY = options.anthropicAdminKey
  if (typeof options.deepseekKey === 'string' && options.deepseekKey) env.CHIPMANAGER_DEEPSEEK_KEY = options.deepseekKey
  if (typeof options.freellmapiKey === 'string' && options.freellmapiKey) env.CHIPMANAGER_FREELLMAPI_KEY = options.freellmapiKey
  try {
    const r = await $.process.run(['node', `${$.plugin.root.replace(/\\/g, '/')}/strumenti/fornitori.cjs`, comando],
      { stdin: JSON.stringify(input), env, timeoutMs: comando === 'completa' ? 35_000 : 20_000 })
    if (r.exitCode !== 0 || r.isStdoutTruncated) throw new Error('fonte non disponibile')
    if (Object.values(env).some(k => r.stdout.includes(k))) throw new Error('risposta non utilizzabile')
    return JSON.parse(r.stdout) as unknown
  } catch { throw new Error('Fonte non disponibile: nessun dettaglio delle credenziali viene registrato') }
}

/** Il processo è un confine: schema ignoto e campi estranei non entrano nello stato. */
export function risorseLette(json: unknown): Risorse {
  const oggetto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
  const testo = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 200 && !/[\x00-\x1f\x7f]/.test(v)
  const data = (v: unknown) => v === undefined || (typeof v === 'string' && Number.isFinite(Date.parse(v)))
  const numero = (v: unknown) => v === undefined || (typeof v === 'number' && Number.isFinite(v))
  if (!oggetto(json) || !Array.isArray(json.limiti) || json.limiti.length > 50 || !testo(json.proxy) || !oggetto(json.chiavi))
    throw new Error('formato limiti non disponibile')
  const chiavi = json.chiavi
  if (!['anthropic', 'deepseek', 'freellmapi'].every(k => typeof chiavi[k] === 'boolean')) throw new Error('formato chiavi non disponibile')
  const limiti: Limite[] = json.limiti.map(x => {
    if (!oggetto(x) || !testo(x.id) || !/^[a-z0-9-]+$/.test(x.id) || !FORNITORI.includes(x.fornitore as Limite['fornitore']) ||
        !testo(x.nome) || !testo(x.fonte) || !data(x.letto) || !data(x.reset) || !numero(x.percentuale) || !numero(x.valore) ||
        (x.percentuale !== undefined && ((x.percentuale as number) < 0 || (x.percentuale as number) > 100)) ||
        (x.unita !== undefined && !['%', 'USD', 'CNY', 'EUR', 'richieste', 'token'].includes(String(x.unita))) ||
        (x.errore !== undefined && !testo(x.errore)) ||
        ((x.percentuale !== undefined || x.valore !== undefined) && x.letto === undefined) ||
        (x.percentuale === undefined && x.valore === undefined && x.errore === undefined)) throw new Error('formato limite non disponibile')
    return { id: x.id, fornitore: x.fornitore as Limite['fornitore'], nome: x.nome, fonte: x.fonte,
      letto: x.letto as string | undefined, reset: x.reset as string | undefined, percentuale: x.percentuale as number | undefined,
      valore: x.valore as number | undefined, unita: x.unita as Limite['unita'], errore: x.errore as string | undefined }
  })
  if (new Set(limiti.map(l => l.id)).size !== limiti.length) throw new Error('limiti duplicati')
  return { limiti, proxy: json.proxy, chiavi: { anthropic: chiavi.anthropic === true, deepseek: chiavi.deepseek === true, freellmapi: chiavi.freellmapi === true } }
}

/** get_usage non ha un contratto tipizzato: accettiamo solo le finestre numeriche riconosciute. */
export function usoDesktop(json: unknown, letto: string): Limite[] {
  if (!json || typeof json !== 'object') return []
  const j = json as Record<string, unknown>
  const dati = (j.rate_limits ?? j) as Record<string, unknown>
  return ['five_hour', 'seven_day'].flatMap(k => {
    const v = dati?.[k] as Record<string, unknown> | undefined
    const n = v?.utilization ?? v?.used_percentage
    return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100
      ? [{ id: `claude-${k}`, fornitore: 'claude' as const, nome: `Claude piano · ${k === 'five_hour' ? '5 ore' : '7 giorni'}`, percentuale: n, unita: '%' as const, letto, fonte: 'ccd_session_mgmt.get_usage',
        reset: typeof v?.resets_at === 'string' && Number.isFinite(Date.parse(v.resets_at)) ? v.resets_at : undefined }] : []
  })
}

export async function osservaRisorse($: EngineInterface, options: Record<string, unknown>, r: Regole): Promise<Risorse> {
  if (!r.lette) return { ...RISORSE_VUOTE, proxy: 'regole non leggibili: sonde disabilitate' }
  let risultato: Risorse
  try { risultato = risorseLette(await fonte($, options, 'limiti', r.risorse)) }
  catch { risultato = { ...RISORSE_VUOTE, proxy: 'helper non disponibile', chiavi: { anthropic: !!options.anthropicAdminKey, deepseek: !!options.deepseekKey, freellmapi: !!options.freellmapiKey } } }
  if (r.risorse.fornitori.includes('claude') && !r.risorse.soloLocale) {
    try {
      const disponibile = (await $.tool.list()).some(t => t.name === 'mcp__ccd_session_mgmt__get_usage')
      const m = disponibile ? await new Promise<Awaited<ReturnType<EngineInterface['mcp']['call']>> | null>(ok => {
        const timer = $.clock.after(4000, () => ok(null))
        void $.mcp.call('ccd_session_mgmt', 'get_usage', {}).then(risposta => { timer.cancel(); ok(risposta) }, () => { timer.cancel(); ok(null) })
      }) : null
      if (m && !m.isError) {
        const l = usoDesktop(JSON.parse(m.content.filter(c => c.type === 'text').map(c => c.text).join('\n')), new Date().toISOString())
        if (l.length) risultato = { ...risultato, limiti: [...risultato.limiti.filter(x => x.fornitore !== 'claude' || x.id === 'claude-api'), ...l] }
      }
    } catch { /* il dato locale resta con la propria età; nessuna percentuale inventata */ }
  }
  return { ...risultato, limiti: [...risultato.limiti, ...r.risorse.limitiManuali] }
}
