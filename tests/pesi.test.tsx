import { expect, test } from 'claude-code/testing'

import { profiloDi as profiloDaBilanciamento } from '../hooks/bilanciamento'
import { bilancia, MOLTIPLICATORE_CORSIA, pianifica, profiloDi, punteggio, regoleDa, RISORSE_DEFAULT } from '../hooks/logica'
import type { Azione, Chiamante, Corsia, Peso, Regole } from '../types'

// Dati d'esempio: nessun progetto reale.
const ROUTING = {
  modelli_ammessi: ['claude-opus-5-5', 'claude-sonnet-5-5', 'gpt-6.1-sol', 'gpt-6-astra'],
  effort_ammessi: ['low', 'medium', 'high', 'xhigh'],
  revisione: { revisori_ammessi_per_autore: { 'claude-opus-5-5': ['motore:codex'], 'claude-sonnet-5-5': ['claude-opus-5-5', 'motore:codex'] } },
  corsia_codex: { modelli: ['gpt-6.1-sol'], esegue: { corsie: ['R1', 'R2', 'R3'] }, effort: { R1: 'high', R2: 'high', R3: 'xhigh' }, rivisto_da: { R1: 'claude-sonnet-5-5', R2: 'claude-sonnet-5-5', R3: 'claude-opus-5-5' } },
}
const R = regoleDa(ROUTING, 'routing.json')
const CHI: Chiamante = { io: 'sessione-esempio', repo: 'esempio/demo', modello: 'claude-opus-5-5', effort: 'xhigh', permessi: 'auto', lanciatore: 'desktop' }
const ORA = new Date(0).toISOString()
const azione = (id: string, corsia: Corsia, extra: Partial<Azione> = {}): Azione => ({
  id, versione: 0, repo: 'esempio/demo', titolo: 'Aggiorna la documentazione', brief: 'Esempio.', ordine: 1, dipende: [],
  esecutore: 'claude', revisore: 'codex', corsia, stato: 'proposta', creata: ORA, aggiornata: ORA, ...extra,
})
const conRisorse = (risorse: Partial<Regole['risorse']>): Regole => ({ ...R, risorse: { ...RISORSE_DEFAULT, ...risorse } })
const vicino = (x: number, y: number) => expect(Math.abs(x - y)).toBeLessThan(1e-9)
const MODELLO: Peso = { tipo: 'modello', nome: 'claude-sonnet-5-5', percentuale: 40, assoluto: 0 }

test('profiloDi: una sola fonte in logica, riesportata da bilanciamento', () => {
  expect(profiloDaBilanciamento).toBe(profiloDi)
  expect(profiloDi(RISORSE_DEFAULT)).toBe('automatico')
  // Un config precedente, con pesi e senza profilo, resta Personalizzato.
  expect(profiloDi({ ...RISORSE_DEFAULT, pesi: [MODELLO] })).toBe('personalizzato')
  expect(profiloDi({ ...RISORSE_DEFAULT, pesi: [MODELLO], profilo: 'automatico' })).toBe('automatico')
})

test('corsia: in R0–R1 con Automatico high vale ×0,6 e xhigh ×0,4; low e medium invariati', () => {
  expect(MOLTIPLICATORE_CORSIA).toEqual({ high: 0.6, xhigh: 0.4 })
  const auto = conRisorse({})
  for (const corsia of ['R0', 'R1'] as const) {
    const base = punteggio(azione('a-corsia01', corsia, { effort: 'medium' }), auto, [], [])
    vicino(punteggio(azione('a-corsia01', corsia, { effort: 'low' }), auto, [], []), base)
    vicino(punteggio(azione('a-corsia01', corsia, { effort: 'high' }), auto, [], []), base * 0.6)
    vicino(punteggio(azione('a-corsia01', corsia, { effort: 'xhigh' }), auto, [], []), base * 0.4)
  }
  // R2–R5 non cambiano.
  for (const corsia of ['R2', 'R3', 'R4', 'R5'] as const)
    vicino(punteggio(azione('a-corsia01', corsia, { effort: 'xhigh' }), auto, [], []), punteggio(azione('a-corsia01', corsia, { effort: 'medium' }), auto, [], []))
})

test('corsia: vale solo con Automatico; un config con pesi e senza profilo non riceve penalità nuove', () => {
  const xhigh = azione('a-corsia02', 'R1', { effort: 'xhigh' })
  const medium = azione('a-corsia02', 'R1', { effort: 'medium' })
  for (const r of [conRisorse({ pesi: [MODELLO] }), conRisorse({ profilo: 'qualita' }), conRisorse({ profilo: 'personalizzato' })])
    vicino(punteggio(xhigh, r, [], []), punteggio(medium, r, [], []))
  // Automatico esplicito con un peso sui modelli: la regolazione del modello resta, la corsia si aggiunge.
  const auto = conRisorse({ profilo: 'automatico', pesi: [MODELLO] })
  vicino(punteggio(xhigh, auto, [], []), punteggio(medium, auto, [], []) * 0.4)
})

test('corsia: una chip di documentazione in R1 senza effort va a medium invece che a high', () => {
  const r = conRisorse({ fornitori: ['claude'] })
  const a = azione('a-corsia03', 'R1', { revisore: 'claude' })
  expect(bilancia(a, { esecutore: 'claude', modello: 'claude-sonnet-5-5' }, r, [], [a], CHI).effort).toBe('medium')
  // In R2 la preferenza resta high.
  const b = azione('a-corsia04', 'R2', { revisore: 'claude' })
  expect(bilancia(b, { esecutore: 'claude', modello: 'claude-sonnet-5-5' }, r, [], [b], CHI).effort).toBe('high')
})

test('corsia nel massivo: con Automatico e pesi la chip R1 a xhigh scende sotto la R3 a xhigh', () => {
  const r = conRisorse({ profilo: 'automatico', pesi: [MODELLO] })
  const leggera = azione('a-massa001', 'R1', { effort: 'xhigh', revisore: 'claude', modello: 'claude-sonnet-5-5' })
  const pesante = azione('a-massa002', 'R3', { effort: 'xhigh', revisore: 'claude', modello: 'claude-sonnet-5-5', ordine: 2 })
  expect(pianifica([leggera, pesante], [leggera, pesante], r, 1).avvia[0]!.id).toBe(pesante.id)
  // Personalizzato: nessuna penalità, l'ordine resta quello dell'utente.
  const p = conRisorse({ profilo: 'personalizzato', pesi: [MODELLO] })
  expect(pianifica([leggera, pesante], [leggera, pesante], p, 1).avvia[0]!.id).toBe(leggera.id)
})
