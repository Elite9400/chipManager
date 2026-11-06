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
export const NOMI_LINGUE: Record<Lingua, string> = { en: 'English', it: 'Italiano', es: 'Español', fr: 'Français', de: 'Deutsch', pt: 'Português (Brasil)' }

/** Il valore salvato, se è un codice ammesso; altrimenti l'inglese (anche config assente o rotto). */
export const linguaDa = (v: unknown): Lingua => (LINGUE as readonly unknown[]).includes(v) ? (v as Lingua) : 'en'

export type Parametri = Record<string, string | number>
/** Un messaggio come codice e parametri: lo salva chi lo produce, lo traduce chi lo mostra. */
export type Msg = { k: Chiave; p?: Parametri }
export const msg = (k: Chiave, p?: Parametri): Msg => (p ? { k, p } : { k })
export const eMsg = (x: unknown): x is Msg => !!x && typeof x === 'object' && typeof (x as Msg).k === 'string' && (x as Msg).k in en

/** `one` o `other`. Francese e portoghese (Brasile): 0 e 1 sono `one`; le altre lingue: solo 1. */
export const formaPlurale = (l: Lingua, n: number): keyof Forme =>
  l === 'fr' || l === 'pt' ? (Math.abs(n) < 2 ? 'one' : 'other') : n === 1 ? 'one' : 'other'

/** La frase della chiave; manca nella lingua → inglese; manca anche lì → la chiave (e il test di completezza fallisce). */
export function t(l: Lingua, k: Chiave, p: Parametri = {}): string {
  const v: Voce | undefined = DIZIONARI[l]?.[k] ?? en[k]
  if (v === undefined) return k
  const s = typeof v === 'string' ? v : v[formaPlurale(l, Number(p.n ?? 0))]
  return s.replace(/\{(\w+)\}/g, (m, nome: string) => (nome in p ? String(p[nome]) : m))
}

/** Un messaggio salvato: codice → frase tradotta; una stringa di un record vecchio si mostra com'è. */
export const testo = (l: Lingua, x: Msg | string | undefined): string => (x === undefined ? '' : typeof x === 'string' ? x : t(l, x.k, x.p))

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

/** Numero con il separatore decimale della lingua; quello delle migliaia solo da 10.000 in su. */
export function numero(l: Lingua, n: number, decimali?: number): string {
  const s = decimali === undefined ? String(n) : n.toFixed(decimali)
  const [intera = '', frazione] = s.replace('-', '').split('.')
  const gruppi = intera.length > 4 ? intera.replace(/\B(?=(\d{3})+$)/g, MIGLIAIA[l]) : intera
  return `${n < 0 ? '-' : ''}${gruppi}${frazione ? `${l === 'en' ? '.' : ','}${frazione}` : ''}`
}

/** Traduttore legato a una lingua: quello che ricevono le viste. */
export function traduttore(l: Lingua) {
  const T = (k: Chiave, p?: Parametri) => t(l, k, p)
  return Object.assign(T, {
    lingua: l,
    m: (x: Msg | string | undefined) => testo(l, x),
    data: (q: Date | string | number) => data(l, q),
    ora: (q: Date | string | number) => ora(l, q),
    numero: (n: number, decimali?: number) => numero(l, n, decimali),
  })
}
export type T = ReturnType<typeof traduttore>
