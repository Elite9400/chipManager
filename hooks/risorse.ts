import type { EngineInterface } from 'claude-code'
import type { Limite, Regole, Risorse } from '../types'
import { nomeLimite } from './bilanciamento'
import { t } from './lingua'
import type { Chiave, Lingua } from './lingua'
import { conta, diagnosticaHelper, FORNITORI } from './logica'

/** I limiti con un nome fisso, per id: il nome si traduce; quello salvato serve solo ai record vecchi e agli agenti. */
const NOMI_FISSI: Record<string, Chiave> = {
  'claude-five_hour': 'lim.claude5h', 'claude-seven_day': 'lim.claude7g', 'codex-primary': 'lim.codexPrimaria', 'codex-secondary': 'lim.codexSecondaria',
  claude: 'lim.claudePiano', codex: 'lim.codexPiano',
}

/** Il nome di un limite nella lingua del pannello: per id dove il nome è fisso; le etichette dell'app restano com'erano. */
export function nomeLimiteIn(l: Pick<Limite, 'id' | 'nome' | 'manuale' | 'valore'>, lingua: Lingua): string {
  if (l.manuale) return nomeLimite(l.nome, lingua)
  const fisso = NOMI_FISSI[l.id]
  if (fisso) return t(lingua, fisso)
  if (l.id === 'claude-api') return t(lingua, l.valore !== undefined ? 'lim.claudeApiMese' : 'lim.claudeApi')
  if (l.id === 'freellmapi') return t(lingua, l.valore !== undefined ? 'lim.freeMese' : 'lim.free')
  if (l.id === 'deepseek' || l.id.startsWith('deepseek-')) return t(lingua, 'lim.deepseek')
  if (l.id === 'claude-extra') return t(lingua, 'lim.claudeExtra')
  // Una finestra del piano con l'etichetta dell'app: si traduce solo il prefisso.
  const etichetta = l.nome.match(/^Claude (?:piano|plan) · (.+)$/)?.[1]
  return l.id.startsWith('claude-') && etichetta ? `${t(lingua, 'lim.claudePiano')} · ${etichetta}` : l.nome
}

/** L'unità di un valore: «richieste» si traduce, valute, token e % no. */
export const unitaIn = (u: Limite['unita'], lingua: Lingua) => (u === 'richieste' ? t(lingua, 'unita.richieste') : u ?? '')

export const RISORSE_VUOTE: Risorse = { limiti: [], proxy: 'proxy.nonVerificato', chiavi: { anthropic: false, deepseek: false, freellmapi: false } }
export const FREE_COMMIT = 'fb07845faf7cf986ea9f3692e055076035dd8739'
const immagine = `chipmanager-freellmapi:${FREE_COMMIT.slice(0, 12)}`
export const INSTALLAZIONE = [
  ['docker', 'build', '--build-arg', `FREELLMAPI_COMMIT_SHA=${FREE_COMMIT}`, '-t', immagine, `https://github.com/tashfeenahmed/freellmapi.git#${FREE_COMMIT}`],
  ['docker', 'run', '-d', '--name', 'chipmanager-freellmapi', '--user', '1000:1000', '--cap-drop=ALL', '--security-opt=no-new-privileges', '-p', '127.0.0.1:3001:3001', '-v', 'chipmanager-freellmapi-data:/app/server/data', immagine],
] as const

/** Le chiavi vivono solo nel trasporto al processo, mai nel risultato o negli argv. */
export async function fonte($: EngineInterface, options: Record<string, unknown>, comando: 'limiti' | 'completa' | 'sessioni', input: unknown) {
  const env: Record<string, string> = {}
  if (typeof options.anthropicAdminKey === 'string' && options.anthropicAdminKey) env.CHIPMANAGER_ANTHROPIC_ADMIN_KEY = options.anthropicAdminKey
  if (typeof options.deepseekKey === 'string' && options.deepseekKey) env.CHIPMANAGER_DEEPSEEK_KEY = options.deepseekKey
  if (typeof options.freellmapiKey === 'string' && options.freellmapiKey) env.CHIPMANAGER_FREELLMAPI_KEY = options.freellmapiKey
  try {
    conta({ processi: 1 }, comando)
    const r = await $.process.run(['node', `${$.plugin.root.replace(/\\/g, '/')}/strumenti/fornitori.cjs`, comando],
      { stdin: JSON.stringify(input), env, timeoutMs: comando === 'completa' ? 35_000 : 20_000 })
    if (r.exitCode !== 0 || r.isStdoutTruncated) throw new Error('source not available')
    if (Object.values(env).some(k => r.stdout.includes(k))) throw new Error('answer not usable')
    const json = JSON.parse(r.stdout) as unknown
    // Byte letti e salti dell'helper Codex: solo numeri, per la diagnostica di questa sessione.
    conta(diagnosticaHelper(json))
    return json
  } catch { throw new Error('Source not available: no credential detail is recorded') }
}

/** Il processo è un confine: schema ignoto e campi estranei non entrano nello stato. */
export function risorseLette(json: unknown): Risorse {
  const oggetto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
  const testo = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 200 && !/[\x00-\x1f\x7f]/.test(v)
  const data = (v: unknown) => v === undefined || (typeof v === 'string' && Number.isFinite(Date.parse(v)))
  const numero = (v: unknown) => v === undefined || (typeof v === 'number' && Number.isFinite(v))
  if (!oggetto(json) || !Array.isArray(json.limiti) || json.limiti.length > 50 || !testo(json.proxy) || !oggetto(json.chiavi))
    throw new Error('limits format not available')
  const chiavi = json.chiavi
  if (!['anthropic', 'deepseek', 'freellmapi'].every(k => typeof chiavi[k] === 'boolean')) throw new Error('keys format not available')
  const limiti: Limite[] = json.limiti.map(x => {
    if (!oggetto(x) || !testo(x.id) || !/^[a-z0-9-]+$/.test(x.id) || !FORNITORI.includes(x.fornitore as Limite['fornitore']) ||
        !testo(x.nome) || !testo(x.fonte) || !data(x.letto) || !data(x.reset) || !numero(x.percentuale) || !numero(x.valore) ||
        (x.percentuale !== undefined && ((x.percentuale as number) < 0 || (x.percentuale as number) > 100)) ||
        (x.unita !== undefined && !['%', 'USD', 'CNY', 'EUR', 'richieste', 'token'].includes(String(x.unita))) ||
        (x.errore !== undefined && !testo(x.errore)) ||
        ((x.percentuale !== undefined || x.valore !== undefined) && x.letto === undefined) ||
        (x.percentuale === undefined && x.valore === undefined && x.errore === undefined)) throw new Error('limit format not available')
    return { id: x.id, fornitore: x.fornitore as Limite['fornitore'], nome: x.nome, fonte: x.fonte,
      letto: x.letto as string | undefined, reset: x.reset as string | undefined, percentuale: x.percentuale as number | undefined,
      valore: x.valore as number | undefined, unita: x.unita as Limite['unita'], errore: x.errore as string | undefined }
  })
  if (new Set(limiti.map(l => l.id)).size !== limiti.length) throw new Error('limiti duplicati')
  return { limiti, proxy: json.proxy, chiavi: { anthropic: chiavi.anthropic === true, deepseek: chiavi.deepseek === true, freellmapi: chiavi.freellmapi === true } }
}

/**
 * get_usage non ha un contratto tipizzato: accettiamo solo forme note.
 * Attuale: plan { status, windows[{ label, percentUsed, resetsAt }], extraUsage }; vecchia: rate_limits.five_hour / seven_day.
 */
export function usoDesktop(json: unknown, letto: string): Limite[] {
  if (!json || typeof json !== 'object') return []
  const j = json as Record<string, unknown>
  const fonte = 'ccd_session_mgmt.get_usage'
  const pct = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100
  const quando = (v: unknown) => (typeof v === 'string' && Number.isFinite(Date.parse(v)) ? v : undefined)
  const etichetta = (v: unknown) => (typeof v === 'string' && v.length > 0 && v.length <= 80 && !/[\x00-\x1f\x7f]/.test(v) ? v : undefined)
  const piano = j.plan as Record<string, unknown> | undefined
  if (piano && typeof piano === 'object') {
    if (piano.status !== 'ok') {
      // Codici del dizionario (il pannello li traduce); la nota dell'app resta com'è dopo i due punti.
      const motivo = piano.status === 'not_applicable' ? 'lim.pianoNonApplicabile' : 'lim.pianoNonLeggibile'
      const nota = etichetta(piano.note)
      return [{ id: 'claude', fornitore: 'claude', nome: 'Claude piano', fonte, errore: nota ? `${motivo}: ${nota}` : motivo }]
    }
    const visti = new Set<string>()
    const finestre: Limite[] = (Array.isArray(piano.windows) ? piano.windows.slice(0, 20) : []).flatMap((w: Record<string, unknown>) => {
      const nome = etichetta(w?.label)
      const id = nome && `claude-${nome.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`
      if (!nome || !id || id === 'claude-' || id === 'claude-api' || visti.has(id) || !pct(w.percentUsed)) return []
      visti.add(id)
      return [{ id, fornitore: 'claude' as const, nome: `Claude piano · ${nome}`, percentuale: w.percentUsed, unita: '%' as const, letto, fonte, reset: quando(w.resetsAt) }]
    })
    const extra = piano.extraUsage as Record<string, unknown> | undefined
    // Rilievo 6: l'uso extra è un credito: importo speso e tetto nella loro valuta, mai la percentuale dell'app.
    const importo = (v: unknown) => (typeof v === 'string' && /^\d{1,12}(\.\d+)?$/.test(v) ? Number(v) : undefined)
    const valuta = ['EUR', 'USD', 'CNY'].includes(String(extra?.currency)) ? (extra!.currency as 'EUR' | 'USD' | 'CNY') : undefined
    const speso = importo(extra?.spent)
    const tetto = importo(extra?.monthlyLimit)
    if (extra?.enabled === true && valuta && speso !== undefined)
      finestre.push({ id: 'claude-extra', fornitore: 'claude', nome: 'Claude uso extra', valore: speso, ...(tetto !== undefined && { tetto }), unita: valuta, letto, fonte })
    return finestre
  }
  const dati = (j.rate_limits ?? j) as Record<string, unknown>
  return ['five_hour', 'seven_day'].flatMap(k => {
    const v = dati?.[k] as Record<string, unknown> | undefined
    const n = v?.utilization ?? v?.used_percentage
    return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100
      ? [{ id: `claude-${k}`, fornitore: 'claude' as const, nome: `Claude piano · ${k === 'five_hour' ? '5 ore' : '7 giorni'}`, percentuale: n, unita: '%' as const, letto, fonte: 'ccd_session_mgmt.get_usage',
        reset: typeof v?.resets_at === 'string' && Number.isFinite(Date.parse(v.resets_at)) ? v.resets_at : undefined }] : []
  })
}

/**
 * Un piano che risponde «nessuna finestra e nessun uso extra» in forma valida: windows è un array vuoto, extraUsage
 * manca o è spento. Una risposta con elementi scartati o tipi sbagliati non lo è: vale come lettura fallita.
 */
export function pianoVuoto(json: unknown): boolean {
  const piano = (json as { plan?: unknown } | null)?.plan as Record<string, unknown> | undefined
  if (!piano || typeof piano !== 'object' || piano.status !== 'ok' || !Array.isArray(piano.windows) || piano.windows.length) return false
  const extra = piano.extraUsage as Record<string, unknown> | null | undefined
  return extra === undefined || (!!extra && typeof extra === 'object' && extra.enabled === false)
}

/** R5: i nomi degli strumenti dell'host, in cache 10 minuti (subito di nuovo se l'ultima lettura è fallita). */
let strumentiHost: { quando: number; nomi: Set<string> | null } | undefined
export async function nomiStrumenti($: EngineInterface, forza = false): Promise<Set<string> | null> {
  const adesso = await $.clock.now()
  const c = strumentiHost
  if (!forza && c?.nomi && adesso >= c.quando && adesso - c.quando < 600_000) return c.nomi
  try {
    const nomi = new Set((await $.tool.list()).map(t => t.name))
    strumentiHost = { quando: adesso, nomi }
    return nomi
  } catch {
    strumentiHost = { quando: adesso, nomi: null }
    return null
  }
}

export async function osservaRisorse($: EngineInterface, options: Record<string, unknown>, r: Regole): Promise<Risorse> {
  if (!r.lette) return { ...RISORSE_VUOTE, proxy: 'proxy.regole' }
  let risultato: Risorse
  try { risultato = risorseLette(await fonte($, options, 'limiti', r.risorse)) }
  catch { risultato = { ...RISORSE_VUOTE, proxy: 'proxy.helper', chiavi: { anthropic: !!options.anthropicAdminKey, deepseek: !!options.deepseekKey, freellmapi: !!options.freellmapiKey } } }
  if (r.risorse.fornitori.includes('claude') && !r.risorse.soloLocale) {
    try {
      const disponibile = !!(await nomiStrumenti($))?.has('mcp__ccd_session_mgmt__get_usage')
      const m = disponibile ? await new Promise<Awaited<ReturnType<EngineInterface['mcp']['call']>> | null>(ok => {
        const timer = $.clock.after(4000, () => ok(null))
        conta({ app: 1 })
        void $.mcp.call('ccd_session_mgmt', 'get_usage', {}).then(risposta => { timer.cancel(); ok(risposta) }, () => { timer.cancel(); ok(null) })
      }) : null
      if (m && !m.isError) {
        const json: unknown = JSON.parse(m.content.filter(c => c.type === 'text').map(c => c.text).join('\n'))
        const l = usoDesktop(json, new Date().toISOString())
        // Piano letto senza finestre né uso extra: è una risposta, non un guasto; le finestre di prima non valgono più.
        if (!l.length && pianoVuoto(json)) risultato = { ...risultato, letti: ['claude'] }
        // Un «non disponibile» dall'app non cancella una misura della status line ancora presente.
        const misurato = risultato.limiti.some(x => x.fornitore === 'claude' && x.id !== 'claude-api' && x.percentuale !== undefined)
        if (l.length && !(misurato && l.every(x => x.errore))) risultato ={ ...risultato, limiti: [...risultato.limiti.filter(x => x.fornitore !== 'claude' || x.id === 'claude-api'), ...l] }
      }
    } catch { /* il dato locale resta con la propria età; nessuna percentuale inventata */ }
  }
  return { ...risultato, limiti: [...risultato.limiti, ...r.risorse.limitiManuali] }
}
