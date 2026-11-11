// F13a: Fable 5.2, modo dirigente e catene di lavoro (logica pura).
import { expect, test } from 'claude-code/testing'

import { ADVISOR, corsiaDi, effortDi, idAuditor, istruzioniDirigente, mandato, MODELLI_ADVISOR, modelloDi, motivoAuditor, nomeModello, occupa, pianifica,
  rangoModello, REGOLE_DEFAULT, revisoreConcreto, RISORSE_DEFAULT, ruoloNuovo, sensibile, TRANSIZIONI, violazioni } from '../hooks/logica'
import { campiDaProposta } from '../hooks/bilanciamento'
import { famigliaDi } from '../hooks/tema'
import type { Azione, Regole } from '../types'

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

// --- F13.2: modo dirigente ----------------------------------------------------------------------------------------------

const conDirigente = (d: Record<string, unknown>): Regole => ({ ...REGOLE_DEFAULT, risorse: { ...RISORSE_DEFAULT,
  modoLavoro: { ...RISORSE_DEFAULT.modoLavoro, dirigente: { ...RISORSE_DEFAULT.modoLavoro.dirigente, ...d } } } }) as Regole
const vincoli = { sensibile: false, datiLan: false, fornitori: ['claude'] }

test('F13.2 quando: off mai, R3+ da R3 in su, sempre per ogni corsia', () => {
  expect((['R0', 'R2', 'R3', 'R5'] as const).map(c => ruoloNuovo(c, REGOLE_DEFAULT) ?? null)).toEqual([null, null, 'dirigente', 'dirigente'])
  expect(ruoloNuovo('R5', conDirigente({ quando: 'off' })) ?? null).toBe(null)
  expect(ruoloNuovo('R0', conDirigente({ quando: 'sempre' }))).toBe('dirigente')
  expect(ruoloNuovo(undefined, REGOLE_DEFAULT) ?? null).toBe(null)
})

test('F13.2 modelli: dirigente su Fable 5.2 (Opus solo per scelta esplicita); figlie col lavoratore della corsia; la scelta esplicita vince', () => {
  expect(modelloDi(az({ ruolo: 'dirigente', corsia: 'R3' }), REGOLE_DEFAULT)).toBe('claude-fable-5-2')
  expect(modelloDi(az({ ruolo: 'dirigente', corsia: 'R3', dirigenteSuOpus: true }), REGOLE_DEFAULT)).toBe('claude-opus-5-5')
  const figlia = (corsia: 'R0' | 'R1' | 'R2' | 'R3') => az({ ruolo: 'lavoro', padre: 'a-dir00001', corsia, vincoliPadre: vincoli })
  expect((['R0', 'R1', 'R2', 'R3'] as const).map(c => modelloDi(figlia(c), REGOLE_DEFAULT))).toEqual(['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5'])
  expect(modelloDi({ ...figlia('R1'), modello: 'claude-opus-5-5' }, REGOLE_DEFAULT)).toBe('claude-opus-5-5')
  expect(modelloDi(figlia('R1'), conDirigente({ lavoratori: { ...RISORSE_DEFAULT.modoLavoro.dirigente.lavoratori, R1: 'claude-haiku-5-5' } }))).toBe('claude-haiku-5-5')
  // Una chip normale non cambia.
  expect(modelloDi(az({ corsia: 'R3' }), REGOLE_DEFAULT)).toBe('claude-opus-5-5')
})

test('F13.2 vincoli del padre: una figlia riscritta senza termini sensibili resta R4; fornitori del padre; profondità 1; dirigente su Claude', () => {
  const figlia = az({ ruolo: 'lavoro', padre: 'a-dir00001', corsia: 'R1', brief: 'Rinomina un campo.', vincoliPadre: { sensibile: true, corsiaMin: 'R4', datiLan: true, fornitori: ['claude'] } })
  expect(sensibile(figlia, REGOLE_DEFAULT)).toBe(true)
  expect(corsiaDi(figlia, REGOLE_DEFAULT)).toBe('R4')
  expect(corsiaDi({ ...figlia, vincoliPadre: { ...vincoli, corsiaMin: 'R3' } }, REGOLE_DEFAULT)).toBe('R3')
  expect(violazioni({ ...figlia, esecutore: 'codex', revisore: 'claude' }, REGOLE_DEFAULT).map(x => x.k)).toContain('v.fornitorePadre')
  expect(violazioni(az({ ruolo: 'dirigente', padre: 'a-dir00001' }), REGOLE_DEFAULT).map(x => x.k)).toContain('v.dirigenteFiglia')
  expect(violazioni(az({ ruolo: 'dirigente', esecutore: 'codex', revisore: 'claude' }), REGOLE_DEFAULT).map(x => x.k)).toContain('v.dirigenteClaude')
})

test('F13.2 mandato della dirigente: entro 1.500 caratteri, con id, limiti e attesa; mai rivedere il lavoro pianificato', () => {
  const testo = istruzioniDirigente({ id: 'a-dir00001' }, conDirigente({ maxFigli: 20, maxRipiani: 5 }))
  expect(testo.length <= 1500).toBe(true)
  for (const t of ['a-dir00001', 'at most 20', 'at most 5', 'attesa-figli', 'never review work you planned']) expect([t, testo.includes(t)]).toEqual([t, true])
  expect(mandato(az({ ruolo: 'dirigente', corsia: 'R3' }), REGOLE_DEFAULT).prompt).toContain('You are the director chip')
  expect(mandato(az({ corsia: 'R3' }), REGOLE_DEFAULT).prompt.includes('director chip')).toBe(false)
})

test('F13.2 attesa-figli: transizioni; fuori dal parallelo: con parallelo 1 la figlia parte mentre la dirigente aspetta', () => {
  expect(TRANSIZIONI['attesa-figli']).toEqual(['avviata'])
  expect(TRANSIZIONI.avviata).toContain('attesa-figli')
  expect(TRANSIZIONI.consegnata).toContain('attesa-figli')
  expect(TRANSIZIONI.scartata).toContain('attesa-figli')
  const dirigente = az({ id: 'a-dir00001', ruolo: 'dirigente', corsia: 'R3', stato: 'attesa-figli', sessione: 'local_x' })
  expect(occupa(dirigente)).toBe(false)
  expect(occupa({ ...dirigente, stato: 'avviata' })).toBe(true)
  // Regole lette e nessun revisore: qui conta solo il tetto delle sessioni in parallelo.
  const lette = { ...REGOLE_DEFAULT, lette: true }
  const figlia = az({ id: 'a-fig00001', ruolo: 'lavoro', padre: 'a-dir00001', corsia: 'R1', ordine: 2, revisore: 'nessuno', vincoliPadre: vincoli })
  expect(pianifica([figlia], [dirigente, figlia], lette, 1).avvia.map(a => a.id)).toEqual(['a-fig00001'])
  expect(pianifica([figlia], [{ ...dirigente, stato: 'avviata' }, figlia], lette, 1).avvia.length).toBe(0)
})

test('F13.2 proposta d\'impostazioni: il modo dirigente si fonde campo per campo con lo strato scritto (lavoratori compresi)', () => {
  const r = { ...RISORSE_DEFAULT, strato: { modoLavoro: { dirigente: { maxFigli: 4, lavoratori: { R0: 'claude-sonnet-5-5' } } } }, account: {} } as never
  expect(campiDaProposta({ progetto: { modoLavoro: { dirigente: { quando: 'sempre', lavoratori: { R1: 'claude-haiku-5-5' } } } } } as never, r)).toEqual({
    modoLavoro: { dirigente: { maxFigli: 4, quando: 'sempre', lavoratori: { R0: 'claude-sonnet-5-5', R1: 'claude-haiku-5-5' } } },
  })
})
