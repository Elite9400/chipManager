// Lingua dell'interfaccia: dizionari tipizzati (l'inglese è la fonte), plurali, date e numeri fatti qui, senza Intl
// né toLocaleString: deterministici, testabili senza l'host, uguali su ogni runtime.
import de from './lingue/de'
import en from './lingue/en'
import type { Chiave, Forme, Voce } from './lingue/en'
import es from './lingue/es'
import fr from './lingue/fr'
import it from './lingue/it'
import pt from './lingue/pt'

export type { Chiave } from './lingue/en'
export type Lingua = 'en' | 'it' | 'es' | 'fr' | 'de' | 'pt'
export const LINGUE: readonly Lingua[] = ['en', 'it', 'es', 'fr', 'de', 'pt']
export const DIZIONARI: Record<Lingua, Record<Chiave, Voce>> = { en, it, es, fr, de, pt }
/** Ogni lingua col suo nome, uguale in tutte le interfacce: chi non capisce la lingua attuale ritrova la sua. */
/** La legenda (F5.1): una sola fonte per pannello e board; i README la ricopiano e prova-disco li confronta. */
export const LEGENDA = {
  corsie: ['legenda.r0', 'legenda.r1', 'legenda.r2', 'legenda.r3', 'legenda.r4', 'legenda.r5'],
  termini: ['legenda.effort', 'legenda.worktree', 'legenda.fork', 'legenda.fusione', 'legenda.registro', 'legenda.mcp', 'legenda.pii', 'legenda.soglie', 'legenda.contesto', 'legenda.token', 'legenda.condivisa', 'legenda.cloud'],
} as const satisfies Record<string, readonly Chiave[]>
export const NOMI_LINGUE: Record<Lingua, string> = { en: 'English', it: 'Italiano', es: 'Español', fr: 'Français', de: 'Deutsch', pt: 'Português (Brasil)' }

/** Il valore salvato, se è un codice ammesso; altrimenti l'inglese (anche config assente o rotto). */
export const linguaDa = (v: unknown): Lingua => (LINGUE as readonly unknown[]).includes(v) ? (v as Lingua) : 'en'

/** Un parametro: un dato già scritto, oppure un messaggio (o un elenco) tradotto nella stessa lingua della frase. */
export type Valore = string | number | Msg | readonly (Msg | string)[]
export type Parametri = { [nome: string]: Valore }
/** Un messaggio come codice e parametri: lo salva chi lo produce, lo traduce chi lo mostra. */
export type Msg = { k: Chiave; p?: Parametri }
export const msg = (k: Chiave, p?: Parametri): Msg => (p ? { k, p } : { k })
/** Una chiave del dizionario inglese, propria: un nome ereditato (`constructor`, `toString`) non lo è. */
export const eChiave = (k: unknown): k is Chiave => typeof k === 'string' && Object.hasOwn(en, k)
export const eMsg = (x: unknown): x is Msg => !!x && typeof x === 'object' && eChiave((x as Msg).k)

/** Un errore proprio della mod: il messaggio in inglese (log e agenti), il codice per chi lo mostra tradotto. */
export class Errore extends Error {
  constructor(readonly msg: Msg) {
    super(t('en', msg.k, msg.p))
  }
}
export const errore = (k: Chiave, p?: Parametri) => new Errore(msg(k, p))
/** Il messaggio di un errore: il codice se è proprio, altrimenti il testo (diagnostica esterna, mostrata com'è). */
export const msgDi = (err: unknown): Msg | string => (err instanceof Errore ? err.msg : String((err as Error)?.message ?? err))

/**
 * Un messaggio da salvare in un record: la frase inglese nel campo di sempre (chi legge con una versione vecchia, gli
 * agenti) più codice e parametri, che il pannello traduce. Una diagnostica esterna resta solo testo.
 */
export function salvato<F extends string, B extends string>(campo: F, base: B, m: Msg | string | undefined, max = 300) {
  const frase = m === undefined ? undefined : (typeof m === 'string' ? m : t('en', m.k, m.p)).slice(0, max)
  const codice = m !== undefined && typeof m !== 'string' ? m : undefined
  return { [campo]: frase, [`${base}Codice`]: codice?.k, [`${base}Parametri`]: codice?.p } as
    Record<F, string | undefined> & Record<`${B}Codice`, Chiave | undefined> & Record<`${B}Parametri`, Parametri | undefined>
}
/** Il messaggio di un record: il codice se c'è e si conosce, altrimenti la frase salvata (record vecchi). */
export const letto = (codice: unknown, parametri: unknown, frase: string | undefined): Msg | string | undefined =>
  eChiave(codice) ? { k: codice, p: (parametri ?? undefined) as Parametri | undefined } : frase

/** `one` o `other`. Francese e portoghese (Brasile): 0 e 1 sono `one`; le altre lingue: solo 1. */
export const formaPlurale = (l: Lingua, n: number): keyof Forme =>
  l === 'fr' || l === 'pt' ? (Math.abs(n) < 2 ? 'one' : 'other') : n === 1 ? 'one' : 'other'

/** La frase della chiave; manca nella lingua → inglese; manca anche lì → la chiave (e il test di completezza fallisce). */
export function t(l: Lingua, k: Chiave, p: Parametri = {}): string {
  if (!eChiave(k)) return k
  const d = DIZIONARI[l]
  const v: Voce = d && Object.hasOwn(d, k) ? d[k] : en[k]
  const s = typeof v === 'string' ? v : v[formaPlurale(l, Number(p.n ?? 0))]
  return s.replace(/\{(\w+)\}/g, (m, nome: string) => (Object.hasOwn(p, nome) ? valore(l, p[nome]) : m))
}

/** Un parametro scritto: i messaggi annidati nella stessa lingua, gli elenchi separati da «; ». */
function valore(l: Lingua, v: unknown): string {
  if (Array.isArray(v)) return v.map(x => valore(l, x)).join('; ')
  if (v && typeof v === 'object' && typeof (v as Msg).k === 'string') return t(l, (v as Msg).k, (v as Msg).p)
  // Un numero si scrive nella lingua della frase (40,5 in italiano); un identificatore numerico va passato come testo.
  return typeof v === 'number' ? numero(l, v) : String(v)
}

/** Un codice del dizionario («codice» o «codice: dettaglio») tradotto; ogni altro testo (diagnostica esterna) com'è. */
export function chiaveOTesto(l: Lingua, s: string | undefined): string {
  if (!s) return ''
  const [k, ...resto] = s.split(': ')
  return eChiave(k) ? [t(l, k), ...resto].join(': ') : s
}

/** Un testo dell'helper come messaggio: un codice del dizionario diventa codice, ogni altro testo resta testo; vuoto = undefined. */
export const daTesto = (s: string | undefined): Msg | string | undefined => (!s ? undefined : eChiave(s) ? { k: s } : s)

/** Un messaggio salvato: codice → frase tradotta; una stringa di un record vecchio si mostra com'è. */
export const testo = (l: Lingua, x: Msg | string | { k: string; p?: Record<string, unknown> } | null | undefined): string =>
  !x ? '' : typeof x === 'string' ? x : t(l, x.k as Chiave, x.p as Parametri | undefined)

const due = (n: number) => String(n).padStart(2, '0')

/** Ora locale: `h:MM am/pm` in inglese, `HH:MM` sulle 24 ore nelle altre. */
export function ora(l: Lingua, quando: Date | string | number): string {
  const d = new Date(quando)
  const h = d.getHours()
  return l === 'en' ? `${h % 12 || 12}:${due(d.getMinutes())} ${h < 12 ? 'am' : 'pm'}` : `${due(h)}:${due(d.getMinutes())}`
}

/** Giorno, mese corto e ora nel fuso locale, col formato del dizionario («Nov 4, 2:30 pm», «4 nov, 14:30»). */
export function data(l: Lingua, quando: Date | string | number): string {
  const d = new Date(quando)
  if (Number.isNaN(d.getTime())) return '—'
  return t(l, 'data.formato', { giorno: d.getDate(), mese: t(l, 'data.mesi').split('|')[d.getMonth()] ?? '', ora: ora(l, d) })
}

const MIGLIAIA: Record<Lingua, string> = { en: ',', it: '.', es: '.', fr: ' ', de: '.', pt: '.' }

/** Giorno, mese corto e anno, senza ora («Nov 4, 2026», «4 nov 2026»). */
export function giorno(l: Lingua, quando: Date | string | number): string {
  const d = new Date(quando)
  if (Number.isNaN(d.getTime())) return '—'
  return t(l, 'data.giorno', { giorno: d.getDate(), mese: t(l, 'data.mesi').split('|')[d.getMonth()] ?? '', anno: d.getFullYear() })
}

/** Numero con il separatore decimale della lingua; quello delle migliaia solo da 10.000 in su. */
export function numero(l: Lingua, n: number, decimali?: number): string {
  const s = decimali === undefined ? String(n) : n.toFixed(decimali)
  // Segno, mantissa ed esponente separati: il meno di `1e-7` è dell'esponente, non del numero.
  const [, segno = '', mantissa = '', esponente = ''] = s.match(/^(-?)([^e]*)(e.*)?$/i) ?? []
  const [intera = '', frazione] = mantissa.split('.')
  const gruppi = intera.length > 4 ? intera.replace(/\B(?=(\d{3})+$)/g, MIGLIAIA[l]) : intera
  return `${segno}${gruppi}${frazione ? `${l === 'en' ? '.' : ','}${frazione}` : ''}${esponente}`
}

/**
 * Le unità dei budget come si scrivono nelle sei lingue (minuscole), con il nome con cui si salvano nel config: una sola
 * tabella, così l'esempio della procedura guidata in ogni lingua passa lo stesso parser.
 */
export const ALIAS_UNITA: Record<string, 'USD' | 'EUR' | 'CNY' | 'richieste' | 'token'> = {
  usd: 'USD', eur: 'EUR', cny: 'CNY', token: 'token', tokens: 'token',
  requests: 'richieste', request: 'richieste', richieste: 'richieste', richiesta: 'richieste',
  solicitudes: 'richieste', solicitud: 'richieste', 'requêtes': 'richieste', 'requête': 'richieste',
  anfragen: 'richieste', anfrage: 'richieste', 'requisições': 'richieste', 'requisição': 'richieste',
}

/** Traduttore legato a una lingua: quello che ricevono le viste. */
export function traduttore(l: Lingua) {
  const T = (k: Chiave, p?: Parametri) => t(l, k, p)
  return Object.assign(T, {
    lingua: l,
    m: (x: Parameters<typeof testo>[1]) => testo(l, x),
    /** Un testo che può essere un codice del dizionario («codice» o «codice: dettaglio»): tradotto se lo è, altrimenti com'è. */
    k: (s: string | undefined) => chiaveOTesto(l, s),
    data: (q: Date | string | number) => data(l, q),
    giorno: (q: Date | string | number) => giorno(l, q),
    ora: (q: Date | string | number) => ora(l, q),
    numero: (n: number, decimali?: number) => numero(l, n, decimali),
  })
}
export type T = ReturnType<typeof traduttore>
