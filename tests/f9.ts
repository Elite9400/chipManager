// F9: la garanzia di non regressione della grafica. La fotografia «prima» si scrive una volta sola, dal codice che precede
// F9, in tests/f9-prima.ts (nel commit che la introduce); da lì in poi i test confrontano. Si cambia solo se una
// correzione dichiarata lo chiede, mai per la grafica.
import { expect } from 'claude-code/testing'

import { NUOVI_F11 } from './f11-nuovi'
import { NUOVI_F13B } from './f13b-nuovi'
import { NUOVI_F14 } from './f14-nuovi'
import { PRIMA } from './f9-prima'

export type ControlloF9 = { tipo?: string; chiave?: unknown; label?: unknown; hotkey?: unknown; variant?: unknown; value?: unknown; options?: unknown; gestori: string[] }

/** L'elenco ORDINATO dei controlli dell'albero disegnato: tipo, chiave, etichetta, scorciatoia, variante, valore e opzioni, gestori. */
export function controlliF9(n: unknown): ControlloF9[] {
  if (!n || typeof n !== 'object') return []
  if (Array.isArray(n)) return n.flatMap(controlliF9)
  const x = n as Record<string, unknown> & { type?: string; props?: Record<string, unknown>; children?: unknown }
  const gestori = Object.keys(x).filter(k => !['type', 'props', 'children'].includes(k) && !!x[k] && typeof x[k] === 'object' && 'handle' in (x[k] as object)).sort()
  const p = x.props ?? {}
  const proprio = gestori.length || ['Button', 'Select', 'Input'].includes(x.type ?? '')
    ? [{ tipo: x.type, chiave: p.key, label: p.label, hotkey: p.hotkey, variant: p.variant, value: p.value, options: p.options, gestori }] : []
  return [...proprio, ...controlliF9(x.children)]
}

/** Toglie da un valore ciò che cambia a ogni esecuzione (istanti, gettoni di tentativo, id generati). */
export const normaF9 = (v: unknown) =>
  JSON.parse(JSON.stringify(v ?? null)
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z/g, 'ISTANTE')
    .replace(/az-[a-z0-9]{6,20}/g, 'az-TENTATIVO')
    // La cartella della mod (nel mandato, il percorso dell'helper): cambia da un checkout all'altro.
    .replace(/[A-Za-z]:\/[^"\\]*?\/strumenti\//g, 'PLUGIN/strumenti/')
    // L'ora del giorno (per esempio nell'etichetta di «Aggiorna»): dipende dall'orologio della prova.
    .replace(/\b\d{1,2}:\d{2}( ?[ap]m)?\b/gi, 'HH:MM')
    .replace(/"(gettone|tentativo|epoca|handle)":\s*"?[^",}]*"?/g, '"$1":"X"')) as unknown

const mancanti: [string, unknown][] = []

/**
 * F11: i controlli che non esistevano prima di F11 (sezione Modo di lavoro, setup, doctor). Non toccano la fotografia di
 * F9: si tolgono prima del confronto con quella e si confrontano con la loro, in tests/f11-nuovi.ts.
 */
export const nuovoF11 = (k: unknown) => typeof k === 'string' && /^(sezione-modo|modo-|setup-|doctor-)/.test(k)

/** I controlli di una vista: quelli di prima contro la fotografia di F9, i nuovi contro quella di F11; una vista nuova tutta in F11. */
export function confrontaControlli(chiave: string, c: ControlloF9[]) {
  // F14: the controls of the baseline entries F14 adds (caveman) have their own snapshot; the older ones never see them.
  confrontaF9(chiave, c.filter(x => nuovoF14(x.chiave)), NUOVI_F14)
  c = c.filter(x => !nuovoF14(x.chiave))
  // F13b: provider rows, Help and the relabelled Help tab go to their own snapshot, before the F9 and F11 ones.
  confrontaF9(chiave, c.filter(x => nuovoF13b(x.chiave)), NUOVI_F13B)
  c = c.filter(x => !nuovoF13b(x.chiave))
  // The older snapshots lose the same controls, so a relabelled one (the Help tab) is compared only once, in F13b's.
  const senza = (foto: Record<string, unknown>) => (chiave in foto ? { ...foto, [chiave]: (foto[chiave] as ControlloF9[]).filter(x => !nuovoF13b(x.chiave)) } : foto)
  if (!(chiave in PRIMA)) return confrontaF9(chiave, c, senza(NUOVI_F11))
  confrontaF9(chiave, c.filter(x => !nuovoF11(x.chiave)), senza(PRIMA))
  confrontaF9(chiave, c.filter(x => nuovoF11(x.chiave)), senza(NUOVI_F11))
}

/** F14: the controls of the registry entries F14 adds (caveman's row in the baseline skills). */
export const nuovoF14 = (k: unknown) => typeof k === 'string' && /^skill-.*caveman/.test(k)

/** F13b: the controls added (cmp-*, aiuto-*) or relabelled (the Help tab, formerly Legend) by F13b. */
export const nuovoF13b = (k: unknown) => typeof k === 'string' && /^(cmp-|aiuto-|skill-|sezione-legenda-premi$)/.test(k)

/**
 * Confronta `chiave` con la fotografia «prima» (tests/f9-prima.ts). Una chiave che la fotografia non ha ancora si
 * raccoglie: `fineF9` la restituisce in un errore, da cui si scrive la fotografia (solo dal codice prima di F9).
 */
export function confrontaF9(chiave: string, valore: unknown, foto: Record<string, unknown> = PRIMA) {
  const v = normaF9(valore)
  if (!(chiave in foto)) mancanti.push([chiave, v])
  else expect([chiave, v]).toEqual([chiave, foto[chiave]])
}

/** Alla fine di ogni test F9: se mancano chiavi nella fotografia, il test fallisce e le stampa. */
export function fineF9() {
  if (!mancanti.length) return
  const testo = JSON.stringify(Object.fromEntries(mancanti.splice(0)))
  throw new Error(`F9FOTO<<${testo}>>F9FOTO`)
}

/**
 * F9.5: l'anteprima per il committente. Spento nelle prove; per ricavare gli alberi disegnati si mette a true in locale,
 * si eseguono le prove e si rimette a false (l'anteprima si genera fuori dal repo da quegli alberi).
 */
export const ANTEPRIMA = false
