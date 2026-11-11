// F13a: Fable 5.2, modo dirigente e catene di lavoro (logica pura).
import { expect, test } from 'claude-code/testing'

import { ADVISOR, effortDi, idAuditor, MODELLI_ADVISOR, motivoAuditor, nomeModello, rangoModello, REGOLE_DEFAULT, revisoreConcreto, violazioni } from '../hooks/logica'
import { famigliaDi } from '../hooks/tema'
import type { Azione } from '../types'

const az = (extra: Partial<Azione> = {}): Azione => ({
  id: 'a-f13prova', versione: 1, titolo: 'Prova', brief: 'Fai una cosa.', ordine: 1, dipende: [], esecutore: 'claude', revisore: 'claude',
  stato: 'proposta', creata: '2026-11-11T00:00:00Z', aggiornata: '2026-11-11T00:00:00Z', ...extra,
})

// --- F13.1: Fable 5.2 ---------------------------------------------------------------------------------------------------

test('F13.1 Fable 5.2: id esplicito nella lista Claude, nome, famiglia, rango e tetto; Fable 5.1 resta scegliibile', () => {
  expect(REGOLE_DEFAULT.modelli.claude).toContain('claude-fable-5-2')
  expect(REGOLE_DEFAULT.modelli.claude).toContain('claude-fable-5-1')
  // Il primo modello (il predefinito di un esecutore Claude) non cambia.
  expect(REGOLE_DEFAULT.modelli.claude[0]).toBe('claude-opus-5-5')
  expect(nomeModello('claude-fable-5-2')).toBe('Fable 5.2')
  expect(famigliaDi('claude-fable-5-2')).toBe('fable')
  expect(rangoModello('claude-fable-5-2')).toBe(rangoModello('claude-fable-5-1'))
  expect(REGOLE_DEFAULT.tetto['claude-fable-5-2']).toBe('xhigh')
})

test('F13.1 advisor: «fable» = claude-fable-5-2 nella tabella della mod; un esecutore Fable 5.2 accetta solo Fable 5.2; Mythos riconosciuto ma non abilitato', () => {
  expect(ADVISOR.alias.fable).toBe('claude-fable-5-2')
  expect(ADVISOR.versione).toBe(2)
  expect(ADVISOR.letta >= '2026-11-03').toBe(true)
  expect(idAuditor('fable')).toBe('claude-fable-5-2')
  expect(motivoAuditor('claude-fable-5-2', 'claude-fable-5-2')).toBeUndefined()
  for (const no of ['claude-fable-5-1', 'claude-opus-5-5', 'claude-sonnet-5-5']) expect(motivoAuditor('claude-fable-5-2', no)).toBeDefined()
  // Fable 5.2 come advisor di ogni esecutore della tabella.
  for (const esegue of ['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5', 'claude-fable-5', 'claude-fable-5-1'])
    expect([esegue, motivoAuditor(esegue, 'claude-fable-5-2')]).toEqual([esegue, undefined])
  // Mythos: l'id si riconosce (non è «sconosciuto»), ma non si sceglie.
  expect(MODELLI_ADVISOR).not.toContain('claude-mythos-5-2')
  expect(idAuditor('claude-mythos-5-2')).toBeNull()
  expect(motivoAuditor('claude-fable-5-2', 'claude-mythos-5-2')).toBeDefined()
})

test('F13.1 R4 e revisore: Fable 5.2 autore ammesso sulle sensibili; Fable 5.2 → revisore Opus 5.5 e Opus 5.5 → Fable 5.2', () => {
  const sens = az({ corsia: 'R4', sensibile: true, revisore: 'claude' })
  expect(violazioni({ ...sens, modello: 'claude-fable-5-2' }, REGOLE_DEFAULT).map(v => v.k)).not.toContain('v.r4Modello')
  expect(revisoreConcreto({ ...sens, modello: 'claude-fable-5-2' }, REGOLE_DEFAULT)).toBe('claude-opus-5-5')
  expect(revisoreConcreto({ ...sens, modello: 'claude-opus-5-5' }, REGOLE_DEFAULT)).toBe('claude-fable-5-2')
  expect(revisoreConcreto({ ...sens, modello: 'claude-fable-5-1' }, REGOLE_DEFAULT)).toBe('claude-opus-5-5')
})

test('F13.1 effort: senza scelta il lavoro su Fable 5.2 parte da high (anche su R1); xhigh solo se scelto', () => {
  expect(effortDi(az({ corsia: 'R1', modello: 'claude-fable-5-2' }), REGOLE_DEFAULT)).toBe('high')
  expect(effortDi(az({ corsia: 'R1', modello: 'claude-fable-5-2', effort: 'xhigh' }), REGOLE_DEFAULT)).toBe('xhigh')
  expect(effortDi(az({ corsia: 'R1', modello: 'claude-sonnet-5-5' }), REGOLE_DEFAULT)).toBe('medium')
})
