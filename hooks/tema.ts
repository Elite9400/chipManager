// Gettoni di colore semantici: l'unico posto con colori esadecimali (piano grafica, C0.2 e §9 riga 8).
// Il colore marca un segno (●, ◐, ▲, ◔, ✓, ◆) o un velo; le parole restano nell'inchiostro del tema.
// Ogni tinta usata come segno regge almeno 3:1 sugli sfondi di riferimento, chiari e scuri (test in ui.test.tsx).

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
  riquadro: '14',
  testata: '1F',
  vuoto: '33',
  traccia: '4D',
  carico: ['', '26', '4D', '80'],
} as const

export const STATO = {
  inCorso: '#1A9E4B',
  /** Ferma, «aspetta te». */
  attesa: '#C2770A',
  /** Fallita, blocchi. */
  errore: '#DC2626',
  /** Proposta, accodata. */
  coda: '#6B7FA0',
  consegnata: '#8B7FC0',
} as const

/** Solo sul segno ◆ del motore. */
export const MOTORE = { claude: '#C96A4A', codex: '#0E9A78', freellmapi: '#B0569A' } as const

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
  chiaro: { fondo: '#FFFFFF', testo: '#111827', tenue: '#6B7280', bordo: '#E5E7EB', traccia: '#868B94', accento: ACCENTO, errore: STATO.errore },
} as const

/** Il blocco unico di variabili CSS della board, generato dai valori sopra: scuro di default, chiaro se il sistema lo chiede. */
export function cssVariabiliBoard() {
  const v = (t: (typeof BOARD)['scuro' | 'chiaro']) =>
    `--fondo:${t.fondo};--testo:${t.testo};--tenue:${t.tenue};--bordo:${t.bordo};--traccia:${t.traccia};--accento:${t.accento};--errore:${t.errore};--velo:${GRIGIO}${VELO.riquadro}`
  return `:root{color-scheme:dark light;${v(BOARD.scuro)};--mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}\n@media (prefers-color-scheme:light){:root{${v(BOARD.chiaro)}}}`
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
