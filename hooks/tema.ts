// Gettoni di colore semantici: l'unico posto con colori esadecimali (piano grafica, C0.2 e §9 riga 8).
// Il colore marca un segno (●, ◐, ▲, ◔, ✓, ◆) o un velo; le parole restano nell'inchiostro del tema.
// Ogni tinta usata come segno regge almeno 3:1 sugli sfondi di riferimento, chiari e scuri (test in ui.test.tsx).
// F9.2: e anche sul proprio velo (`VELO.pillola`) sopra la scheda (`VELO.riquadro`), con e senza il velo di hover: per
// questo le tinte dei segni sono state ritoccate nella luminosità (stessa tinta), da 2,6–2,9:1 a 3,04–3,07:1.

/** Solo l'icona della mod: sul chiaro non regge 3:1, quindi mai nell'interfaccia. */
export const ICONA = '#00BFFF'

/** Selezione, chip attiva, primario, fuoco della Gamma: solo grafica (bordi, barre, segni, velo), mai il testo. */
export const ACCENTO = '#0A86C9'
/** Opacità del velo dell'accento (12%): il segno nell'accento sopra il proprio velo regge ancora 3:1. */
export const ALFA_VELO = '1F'

/**
 * F8.3: le opacità dei veli (esadecimale su 255), una scala sola. Le viste non ne scrivono altre: lo controlla prova-disco.
 * `hover` è lo sfondo di una riga sotto il puntatore; `carico` la scala delle celle della vista Carico.
 */
export const VELO = {
  scelta: ALFA_VELO,
  hover: '14',
  /** F9: il fondo della scheda sul desktop; 0A (4%) perché ogni segno regga 3:1 sul proprio velo sopra di essa. */
  riquadro: '0A',
  /** F9.2: il velo di una pillola, nella tinta del suo segno. */
  pillola: '14',
  /** F9.4: il segmento vuoto della barra spessa del desktop: con 14 ogni tinta piena regge 3:1 contro di esso (33 no). */
  barraVuota: '14',
  testata: '1F',
  vuoto: '14',
  traccia: '14',
  carico: ['', '26', '4D', '80'],
} as const

export const STATO = {
  inCorso: '#189245',
  /** Ferma, «aspetta te». */
  attesa: '#B46F09',
  /** Fallita, blocchi. */
  errore: '#E14444',
  /** Proposta, accodata. */
  coda: '#6C80A1',
  consegnata: '#8277B4',
} as const

/** Solo sul segno ◆ del motore. */
export const MOTORE = { claude: '#C06547', codex: '#0D9070', freellmapi: '#B662A1' } as const

/** F9.2: la famiglia del modello, un punto colorato distinto dal colore del motore. */
export const FAMIGLIA = { opus: '#BE682F', sonnet: '#1B8B9E', haiku: '#5D8C23', fable: '#A662CA', gpt: '#3282D1' } as const
export type Famiglia = keyof typeof FAMIGLIA
/** La famiglia di un id di modello (`claude-opus-5-5`, `gpt-6-astra`…); undefined per un modello senza famiglia nota. */
export function famigliaDi(modello: string): Famiglia | undefined {
  const m = modello.toLowerCase()
  return (['opus', 'sonnet', 'haiku', 'fable'] as const).find(f => m.includes(f)) ?? (m.startsWith('gpt') ? 'gpt' : undefined)
}

/**
 * F9.2: la scala dell'effort, monocroma dal blu all'indaco e al viola: mai rosso o giallo, che restano ad attenzione e
 * critica (F8). Il livello si legge anche dal numero di blocchi pieni e dalla parola.
 */
export const EFFORT = { low: '#4982C2', medium: '#487CE2', high: '#6775E4', xhigh: '#806FDF', max: '#9469D3' } as const

/**
 * F9.3: DEROGA DICHIARATA, solo per il marchio. «chip» resta nell'inchiostro, «Manager» va in grassetto nell'ACCENTO
 * (mai nell'ICONA) e il glifo ▣ nell'ACCENTO: un marchio in grassetto è un elemento grafico (3,99:1 su #FFFFFF, 3,80:1 su
 * #262624, 5,27:1 su #000000), non testo corrente. Nessun altro testo entra nella deroga.
 */
/** Il nome è proprio e non si traduce: le due parti, la seconda nell'accento. */
export const MARCHIO = { glifo: '▣', colore: ACCENTO, nome: ['chip', 'Manager'] } as const

/** `ok` non ha colore. */
export const LIVELLO = { ok: undefined, attenzione: STATO.attesa, critica: STATO.errore } as const

/** Didascalie e velo neutro. */
export const GRIGIO = '#808080'

/** Sfondi su cui si misura il contrasto: tema chiaro e scuro, del desktop e del terminale. */
export const SFONDI = { chiaro: ['#FFFFFF', '#FAF9F5'], scuro: ['#000000', '#262624'] } as const

/**
 * F8.3: i valori concreti della board HTML, per tema, dalla stessa fonte. Testo, tenue ed errore sono testo (≥ 4,5:1 sul
 * fondo); accento e traccia (il contorno della barra delle milestone) sono grafica che porta informazione (≥ 3:1); il bordo
 * delle schede separa soltanto. Lo script dei test
 * misura queste coppie: il contrasto dei temi dell'host (dimColor, hover, fuoco) si guarda al collaudo.
 */
export const BOARD = {
  scuro: { fondo: '#0F1115', testo: '#E5E7EB', tenue: '#9CA3AF', bordo: '#2A2F3A', traccia: '#6B7280', accento: ACCENTO, errore: '#EF4444' },
  // L'errore della board è testo (≥ 4,5:1 sul bianco): resta il rosso più scuro, non la tinta del segno.
  chiaro: { fondo: '#FFFFFF', testo: '#111827', tenue: '#6B7280', bordo: '#E5E7EB', traccia: '#868B94', accento: ACCENTO, errore: '#DC2626' },
} as const

/** Il blocco unico di variabili CSS della board, generato dai valori sopra: scuro di default, chiaro se il sistema lo chiede. */
export function cssVariabiliBoard() {
  // Una sola scheda sotto le pillole; barre e schede passive non ricevono il velo di hover.
  const segni = { neutro: GRIGIO, ...Object.fromEntries(
    // Coppie [gruppo, tinte]: le stesse variabili (`--stato-…`, `--motore-…`), senza chiavi `stato:` che il controllo
    // delle transizioni (prova-disco) prende per una scrittura dello stato di un'azione.
    ([['stato', STATO], ['motore', MOTORE], ['famiglia', FAMIGLIA], ['effort', EFFORT]] as const)
      .flatMap(([gruppo, tinte]) => Object.entries(tinte).map(([k, v]) => [`${gruppo}-${k}`, v])),
  ) }
  const semantici = Object.entries(segni).map(([k, v]) => `--${k}:${v};--${k}-velo:${v}${VELO.pillola}`).join(';')
  const v = (t: (typeof BOARD)['scuro' | 'chiaro']) =>
    `--fondo:${t.fondo};--testo:${t.testo};--tenue:${t.tenue};--bordo:${t.bordo};--traccia:${t.traccia};--accento:${t.accento};--errore:${t.errore};--velo:${GRIGIO}${VELO.riquadro}`
  return `:root{color-scheme:dark light;${v(BOARD.scuro)};${semantici};--hover:${ACCENTO}${VELO.hover};--barra-vuota:${GRIGIO}${VELO.barraVuota};--mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}\n@media (prefers-color-scheme:light){:root{${v(BOARD.chiaro)}}}`
}

/** Luminanza relativa WCAG di un colore `#RRGGBB`. */
export function luminanza(hex: string) {
  const [r, g, b] = [1, 3, 5].map(i => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Il colore che si vede: `colore` con opacità `alfa` (esadecimale, come in `velo`) sopra `sfondo`. */
export function sopra(colore: string, alfa: string, sfondo: string) {
  const a = parseInt(alfa, 16) / 255
  const canale = (h: string, i: number) => parseInt(h.slice(i, i + 2), 16)
  return `#${[1, 3, 5].map(i => Math.round(a * canale(colore, i) + (1 - a) * canale(sfondo, i)).toString(16).padStart(2, '0')).join('').toUpperCase()}`
}

/** Rapporto di contrasto WCAG fra due colori, da 1 a 21. */
export function contrasto(a: string, b: string) {
  const [chiara, scura] = [luminanza(a), luminanza(b)].sort((x, y) => y - x) as [number, number]
  return (chiara + 0.05) / (scura + 0.05)
}
