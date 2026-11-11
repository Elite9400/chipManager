// F13a: Fable 5.2, modo dirigente e catene di lavoro (logica pura).
import { expect, test } from 'claude-code/testing'

import { ADVISOR, CLOUD_MAX, corsiaDi, dipendenze, effortDi, idAuditor, istruzioniDirigente, mandato, MODELLI_ADVISOR, modelloDi, motivoAuditor, nomeModello, normalizza, occupa,
  passiCatena, PIPELINE_PREDEFINITA, pianifica,
  rangoModello, REGOLE_DEFAULT, revisoreConcreto, RISORSE_DEFAULT, ruoloNuovo, sensibile, TRANSIZIONI, violazioni } from '../hooks/logica'
import { campiDaProposta } from '../hooks/bilanciamento'
import { conVincoliPadre, costiPerTipo, costoDi, piuStretti, testoScrittore, vincoliDirigente } from '../hooks/logica'
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

// --- F13.6: catene di lavoro ---------------------------------------------------------------------------------------------

const intestazione = (giro: number, ruolo: string, rif = '-') => `<!-- chipManager artefatto catena=c-catena001 giro=${giro} ruolo=${ruolo} rif=${rif} -->\n`
const conPipeline = (p: Record<string, unknown>): Regole => ({ ...REGOLE_DEFAULT, risorse: { ...RISORSE_DEFAULT,
  modoLavoro: { ...RISORSE_DEFAULT.modoLavoro, pipeline: { ...RISORSE_DEFAULT.modoLavoro.pipeline, ...p } } } }) as Regole
const ids = () => {
  let n = 0
  return () => `a-passo00${n++}`
}

test('F13.6 passi: scrittore → revisore → riscrittura → applicatore, legati da dopoConsegna; l\'applicatore è sempre Claude', () => {
  const base = az({ titolo: 'Guida', brief: 'Scrivi la guida.', corsia: 'R2', dipende: ['a-prima0001'], ordine: 3 })
  const passi = passiCatena(base, PIPELINE_PREDEFINITA, 'c-catena001', ids())
  expect(passi.map(p => [p.titolo, p.catena?.ruolo, p.catena?.giro, p.esecutore, p.modello ?? null, p.revisore, p.dopoConsegna, p.dipende, p.ordine])).toEqual([
    ['Guida · draft v1', 'scrittore', 1, 'claude', 'claude-sonnet-5-5', 'nessuno', [], ['a-prima0001'], 3],
    ['Guida · review v1', 'revisore', 1, 'claude', 'claude-opus-5-5', 'nessuno', ['a-passo000'], [], 4],
    ['Guida · draft v2', 'scrittore', 2, 'claude', 'claude-sonnet-5-5', 'nessuno', ['a-passo001'], [], 5],
    ['Guida · apply', 'applicatore', 2, 'claude', 'claude-sonnet-5-5', 'claude', ['a-passo002'], [], 6],
  ])
  // Scrittore FreeLLMAPI (R1, low, revisione Claude come vuole la sua guardia) e revisore Codex, due giri.
  const altri = passiCatena(base, { scrittore: { provider: 'freellmapi', modello: 'testo-compatto' }, revisore: 'codex', giri: 2 }, 'c-catena001', ids())
  expect(altri.map(p => `${p.catena!.ruolo}${p.catena!.giro}:${p.esecutore}/${p.corsia}/${p.effort ?? '-'}/${p.revisore}`)).toEqual([
    'scrittore1:freellmapi/R1/low/claude', 'revisore1:codex/R2/-/nessuno', 'scrittore2:freellmapi/R1/low/claude', 'revisore2:codex/R2/-/nessuno',
    'scrittore3:freellmapi/R1/low/claude', 'applicatore3:claude/R2/-/claude'])
})

test('F13.6 riscrittura («correggi il secondo paragrafo»): il testo per lo scrittore porta la bozza v1 e il feedback su di essa', () => {
  const w2 = az({ titolo: 'Guida', brief: 'Scrivi la guida.', catena: { id: 'c-catena001', giro: 2, ruolo: 'scrittore' } })
  const bozza = `${intestazione(1, 'scrittore')}Primo paragrafo.\n\nSecondo paragrafo, con un errore.`
  const feedback = `${intestazione(1, 'revisore', '1-scrittore.md')}Correggi il secondo paragrafo.`
  const r = testoScrittore(w2, REGOLE_DEFAULT, bozza, feedback)
  expect('testo' in r).toBe(true)
  const t = (r as { testo: string }).testo
  for (const x of ['Scrivi la guida.', '--- Draft v1 ---\nPrimo paragrafo.\n\nSecondo paragrafo, con un errore.', '--- Review feedback on draft v1 ---\nCorreggi il secondo paragrafo.', 'Write draft v2'])
    expect([x, t.includes(x)]).toEqual([x, true])
  // Il primo giro: titolo e brief, come sempre.
  expect(testoScrittore({ ...w2, catena: { id: 'c-catena001', giro: 1, ruolo: 'scrittore' } }, REGOLE_DEFAULT)).toEqual({ testo: 'Guida\n\nScrivi la guida.' })
  // Il feedback di un'altra bozza, di un'altra catena, o un artefatto mancante: il passo si ferma.
  expect(testoScrittore(w2, REGOLE_DEFAULT, bozza, `${intestazione(1, 'revisore', '2-scrittore.md')}x`)).toEqual({ motivo: { k: 'cat.riferimento' } })
  expect(testoScrittore(w2, REGOLE_DEFAULT, bozza.replace('c-catena001', 'c-altra0001'), feedback)).toEqual({ motivo: { k: 'cat.riferimento' } })
  expect(testoScrittore(w2, REGOLE_DEFAULT, bozza)).toEqual({ motivo: { k: 'cat.artefattoMancante' } })
  expect(testoScrittore(w2, REGOLE_DEFAULT, 'senza intestazione', feedback)).toEqual({ motivo: { k: 'cat.artefattoMancante' } })
  // Filtro dei dati di rete locale e limite sull'INTERO testo: oltre, si ferma col numero, mai tagliato.
  expect(testoScrittore(w2, REGOLE_DEFAULT, `${intestazione(1, 'scrittore')}Il server è 192.168.1.20.`, feedback)).toEqual({ motivo: { k: 'cat.datiLan' } })
  const lungo = testoScrittore(w2, REGOLE_DEFAULT, `${intestazione(1, 'scrittore')}${'x'.repeat(CLOUD_MAX)}`, feedback)
  expect((lungo as { motivo: { k: string; p: { max: number } } }).motivo).toMatchObject({ k: 'cat.troppoLungo', p: { max: CLOUD_MAX } })
})

test('F13.6 dopoConsegna: il passo parte quando il precedente ha CONSEGNATO un artefatto; scartato = problema', () => {
  const prima = az({ id: 'a-prima0001', stato: 'consegnata', catena: { id: 'c-catena001', giro: 1, ruolo: 'scrittore' } })
  const dopo = az({ id: 'a-dopo00001', dopoConsegna: ['a-prima0001'], catena: { id: 'c-catena001', giro: 1, ruolo: 'revisore' } })
  expect(dipendenze(dopo, [prima, dopo]).chiuse).toBe(false)
  expect(dipendenze(dopo, [{ ...prima, artefatto: '1-scrittore.md' }, dopo]).chiuse).toBe(true)
  expect(dipendenze(dopo, [{ ...prima, stato: 'avviata', artefatto: '1-scrittore.md' }, dopo]).chiuse).toBe(false)
  expect(dipendenze(dopo, [{ ...prima, stato: 'scartata' }, dopo]).problemi.map(m => m.k)).toEqual(['v.dipendenzaScartata'])
  // Il record si legge solo nella forma che scrive il pannello.
  expect('k' in normalizza({ ...dopo, artefatto: '../x.md' })).toBe(true)
  expect('k' in normalizza({ ...dopo, catena: { id: 'c-catena001', giro: 9, ruolo: 'scrittore' } })).toBe(true)
  expect(normalizza({ ...dopo, artefatto: '1-revisore.md', costo: { tipo: 'osservato', usd: 0.4 } })).toMatchObject({ artefatto: '1-revisore.md' })
})

test('F13.6 mandati: lo scrittore legge bozza e feedback e consegna l\'artefatto; Codex rivede in sola lettura; solo l\'applicatore cambia file', () => {
  const s = { disco: 'X:/m/strumenti/disco.cjs', dati: 'X:/orch/azioni' }
  const passo = (giro: number, ruolo: 'scrittore' | 'revisore' | 'applicatore', extra: Partial<Azione> = {}) =>
    mandato(az({ catena: { id: 'c-catena001', giro, ruolo }, corsia: 'R1', tentativo: 'az-prova001', ...extra }), REGOLE_DEFAULT, s).prompt
  const w2 = passo(2, 'scrittore')
  for (const x of ['X:/orch/azioni/artefatti/c-catena001/1-scrittore.md', 'X:/orch/azioni/artefatti/c-catena001/1-revisore.md', '`artefatto`', 'Change no files and push nothing'])
    expect([x, w2.includes(x)]).toEqual([x, true])
  expect(w2.includes('branch pushed')).toBe(false)
  const rc = passo(1, 'revisore', { esecutore: 'codex', revisore: 'claude' })
  expect(rc).toContain('-s read-only')
  expect(rc).toContain('X:/orch/azioni/artefatti/c-catena001/1-scrittore.md')
  const ap = passo(2, 'applicatore')
  expect(ap).toContain('only step of the chain that changes files')
  expect(ap).toContain('branch pushed')
})

test('F13.6 tetto della catena: raggiunta la spesa misurata, nessun altro passo parte; i tipi di costo restano distinti', () => {
  const r = conPipeline({ tettoUsd: 1 })
  const fatto = az({ id: 'a-fatto0001', stato: 'consegnata', destinazione: 'api-claude', costoApi: 0.7, catena: { id: 'c-catena001', giro: 1, ruolo: 'scrittore' } })
  const altro = az({ id: 'a-altro0001', costo: { tipo: 'osservato', usd: 0.4 }, catena: { id: 'c-catena001', giro: 1, ruolo: 'revisore' } })
  const prossimo = az({ id: 'a-pross0001', catena: { id: 'c-catena001', giro: 2, ruolo: 'scrittore' } })
  expect(violazioni(prossimo, r, [fatto, prossimo]).map(x => x.k)).not.toContain('v.catenaTetto')
  expect(violazioni(prossimo, r, [fatto, altro, prossimo]).find(x => x.k === 'v.catenaTetto')).toEqual({ k: 'v.catenaTetto', p: { tetto: 1, speso: 1.1 } })
  expect(violazioni(prossimo, REGOLE_DEFAULT, [fatto, altro, prossimo]).map(x => x.k)).not.toContain('v.catenaTetto')
  expect([costoDi(fatto), costoDi(altro), costoDi(prossimo), costoDi({ ...prossimo, destinazione: 'api-claude' })]).toEqual([
    { tipo: 'stimato', usd: 0.7 }, { tipo: 'osservato', usd: 0.4 }, { tipo: 'piano' }, { tipo: 'ignoto' }])
})

test('F13a↔F13b: lo scrittore {provider, modello} nella chip: claude e freellmapi restano esecutori, ogni altro è compatibile col suo provider', () => {
  const base = az({ titolo: 'Guida', brief: 'Scrivi.', corsia: 'R1' })
  const scrittore = (provider: string) => passiCatena(base, { scrittore: { provider, modello: 'qwen3:8b' }, revisore: 'claude-opus-5-5', giri: 1 }, 'c-catena001', ids())[0]!
  expect([scrittore('ollama').esecutore, scrittore('ollama').provider]).toEqual(['compatibile', 'ollama'])
  expect([scrittore('freellmapi').esecutore, scrittore('freellmapi').provider]).toEqual(['freellmapi', undefined])
  expect(REGOLE_DEFAULT.modelli.compatibile).toEqual([])
  // Dopo la fusione con F13b decidono le guardie del registro: senza l'adesione del progetto un compatibile non parte.
  expect(violazioni(scrittore('ollama'), REGOLE_DEFAULT).map(x => x.k)).toContain('v.fornitoreNonAbilitato')
  // Nel record `provider` va solo, e sempre, con `compatibile`.
  expect('k' in normalizza({ ...base, esecutore: 'compatibile' })).toBe(true)
  expect('k' in normalizza({ ...base, provider: 'ollama' })).toBe(true)
  expect('k' in normalizza({ ...base, esecutore: 'compatibile', provider: '../x' })).toBe(true)
  expect(normalizza({ ...base, esecutore: 'compatibile', provider: 'ollama' })).toMatchObject({ esecutore: 'compatibile', provider: 'ollama' })
})

test('F13 violazioni: «non connesso» solo per un fornitore abilitato, anche su un passo di catena oltre il tetto', () => {
  const free = az({ esecutore: 'freellmapi', revisore: 'claude', corsia: 'R1', effort: 'low' })
  const k = (a: Azione, r: Regole, lista: Azione[] = [a]) => violazioni(a, r, lista).map(x => x.k)
  expect(k(free, REGOLE_DEFAULT)).toContain('v.fornitoreNonAbilitato')
  expect(k(free, REGOLE_DEFAULT)).not.toContain('v.nonConnesso')
  const abilitato = { ...conPipeline({ tettoUsd: 1 }), risorse: { ...conPipeline({ tettoUsd: 1 }).risorse, fornitori: ['claude', 'codex', 'freellmapi'] }, connessi: ['claude', 'codex'] } as Regole
  const speso = az({ id: 'a-speso0001', costo: { tipo: 'osservato', usd: 2 }, catena: { id: 'c-catena001', giro: 1, ruolo: 'scrittore' } })
  const passo = { ...free, catena: { id: 'c-catena001', giro: 2, ruolo: 'scrittore' as const } }
  expect(k(passo, abilitato, [speso, passo])).toEqual(expect.arrayContaining(['v.catenaTetto', 'v.nonConnesso']))
})

// --- Revisione F13a (Codex) ----------------------------------------------------------------------------------------------

test('Revisione F13a, rilievo 2: i vincoli della dirigente si ricalcolano solo verso l\'alto, destinazioni comprese', () => {
  const v = { sensibile: false, datiLan: false, fornitori: ['claude', 'codex'], destinazioni: ['local' as const, 'api-claude' as const] }
  expect(piuStretti(v, { sensibile: true, corsiaMin: 'R4', datiLan: false, fornitori: ['claude'], destinazioni: ['local'] }))
    .toEqual({ sensibile: true, corsiaMin: 'R4', datiLan: false, fornitori: ['claude'], destinazioni: ['local'] })
  // Mai un'attenuazione: un padre tornato «pulito» non toglie quello che era già fissato.
  expect(piuStretti({ sensibile: true, corsiaMin: 'R5', datiLan: true, fornitori: ['claude'] }, { ...v, corsiaMin: 'R4' }))
    .toEqual({ sensibile: true, corsiaMin: 'R5', datiLan: true, fornitori: ['claude'], destinazioni: ['local', 'api-claude'] })
  const padre = az({ id: 'a-dir00001', ruolo: 'dirigente', corsia: 'R4', brief: 'Rivedi i permessi.' })
  expect(vincoliDirigente(padre, REGOLE_DEFAULT)).toMatchObject({ sensibile: true, corsiaMin: 'R4', destinazioni: ['local'] })
  const figlia = az({ id: 'a-fig00001', ruolo: 'lavoro', padre: 'a-dir00001', corsia: 'R1', vincoliPadre: { sensibile: false, datiLan: false, fornitori: ['claude'] } })
  const ora = conVincoliPadre(figlia, [padre, figlia], REGOLE_DEFAULT)
  expect([corsiaDi(ora, REGOLE_DEFAULT), sensibile(ora, REGOLE_DEFAULT)]).toEqual(['R4', true])
  // Una figlia API di una dirigente locale non passa.
  expect(violazioni({ ...ora, destinazione: 'api-claude' }, REGOLE_DEFAULT).map(x => x.k)).toContain('v.destinazionePadre')
})

test('Revisione F13a, rilievi 4 e 6: un passo di catena gira solo in locale (né corsia API né cloud), con il motivo', () => {
  const passo = az({ catena: { id: 'c-catena001', giro: 1, ruolo: 'scrittore' }, corsia: 'R1' })
  expect(violazioni({ ...passo, destinazione: 'api-claude' }, REGOLE_DEFAULT).map(x => x.k)).toContain('v.catenaApi')
  expect(violazioni({ ...passo, destinazione: 'cloud' }, REGOLE_DEFAULT).map(x => x.k)).toContain('v.catenaCloud')
  const locale = violazioni(passo, REGOLE_DEFAULT).map(x => x.k)
  expect([locale.includes('v.catenaApi'), locale.includes('v.catenaCloud')]).toEqual([false, false])
})

test('Revisione F13a, rilievo 5: senza Fable 5.2 fra gli ammessi la dirigente si ferma; Opus solo con «Dirigente su Opus»', () => {
  const senzaFable = { ...REGOLE_DEFAULT, modelli: { ...REGOLE_DEFAULT.modelli, claude: ['claude-opus-5-5', 'claude-sonnet-5-5'] } } as Regole
  const dir = az({ ruolo: 'dirigente', corsia: 'R3' })
  expect(violazioni(dir, senzaFable).find(x => x.k === 'v.dirigenteModello')).toEqual({ k: 'v.dirigenteModello', p: { modello: 'Fable 5.2' } })
  // Anche con Opus scritto nel record (il bilanciamento lo aveva scelto da sé): serve la scelta esplicita.
  expect(violazioni({ ...dir, modello: 'claude-opus-5-5' }, senzaFable).map(x => x.k)).toContain('v.dirigenteModello')
  expect(violazioni({ ...dir, modello: 'claude-opus-5-5', dirigenteSuOpus: true }, senzaFable).map(x => x.k)).not.toContain('v.dirigenteModello')
  expect(violazioni(dir, REGOLE_DEFAULT).map(x => x.k)).not.toContain('v.dirigenteModello')
})

test('Revisione F13a, rilievo 7: i costi si raggruppano per tipo con costoDi, mai sommati fra tipi diversi', () => {
  const lista = [az({ destinazione: 'api-claude', costoApi: 0.7 }), az({ costo: { tipo: 'osservato', usd: 0.4 } }), az({ costo: { tipo: 'osservato', usd: 0.1 } }), az({}),
    az({ destinazione: 'api-claude' }), az({ costo: { tipo: 'gratuito' } })]
  const c = costiPerTipo(lista)
  expect([c.stimato, c.piano, c.ignoto, c.gratuito]).toEqual([{ n: 1, usd: 0.7 }, { n: 1, usd: 0 }, { n: 1, usd: 0 }, { n: 1, usd: 0 }])
  expect([c.osservato!.n, Math.round(c.osservato!.usd * 100) / 100]).toEqual([2, 0.5])
})

test('Revisione F13a, giro 5, punto 1: una bozza o un feedback sensibile (termini fissi o del progetto) non va a uno scrittore esterno', () => {
  const w2 = az({ titolo: 'Guida', brief: 'Scrivi la guida.', catena: { id: 'c-catena001', giro: 2, ruolo: 'scrittore' } })
  const bozza = (corpo: string) => `${intestazione(1, 'scrittore')}${corpo}`
  const feedback = (corpo: string) => `${intestazione(1, 'revisore', '1-scrittore.md')}${corpo}`
  expect(testoScrittore(w2, REGOLE_DEFAULT, bozza('Spiega le login permissions.'), feedback('Va bene.'))).toEqual({ motivo: { k: 'cat.sensibile', p: { termine: 'login' } } })
  const progetto = { ...REGOLE_DEFAULT, sensibili: ['fatturazione interna'] }
  expect(testoScrittore(w2, progetto, bozza('Testo.'), feedback('Aggiungi la fatturazione interna.'))).toEqual({ motivo: { k: 'cat.sensibile', p: { termine: 'fatturazione interna' } } })
  expect('testo' in testoScrittore(w2, progetto, bozza('Testo.'), feedback('Va bene.'))).toBe(true)
})

// --- Audit di correttezza 2.2.0 (Codex) --------------------------------------------------------------------------------

test('Correttezza 2.2.0, rilievo 2: una figlia con provider compatibile parte se il progetto della dirigente lo ammette; i vincoli restringono solo', () => {
  const con = (compatibili: Record<string, 'R1' | 'R2'>): Regole => ({ ...REGOLE_DEFAULT, risorse: { ...REGOLE_DEFAULT.risorse, compatibili } })
  const padre = az({ id: 'a-padre0001', ruolo: 'dirigente', corsia: 'R3' })
  // Il record che scrive l'helper per una figlia non porta i provider: arrivano dalla fusione all'avvio.
  const figlia = (provider: string, vincoli = { sensibile: false, datiLan: false, fornitori: ['claude', 'codex'] }) =>
    az({ id: 'a-figlia001', padre: padre.id, ruolo: 'lavoro', esecutore: 'compatibile', provider, modello: 'qwen3:8b', corsia: 'R1', effort: 'low', vincoliPadre: vincoli })
  const padreDice = (a: Azione, r: Regole) => violazioni(conVincoliPadre(a, [padre, a], r), r, [padre, a]).find(m => m.k === 'v.fornitorePadre')
  expect(padreDice(figlia('ollama'), con({ ollama: 'R1' }))).toBeUndefined()
  expect(padreDice(figlia('mistral'), con({ ollama: 'R1' }))).toEqual({ k: 'v.fornitorePadre', p: { fornitore: 'mistral' } })
  // Fissati a ['ollama'], un'aggiunta successiva del progetto non allarga la figlia; senza elenco nessun provider passa.
  const fissata = figlia('mistral', { sensibile: false, datiLan: false, fornitori: ['claude', 'codex'], compatibili: ['ollama'] } as never)
  expect(padreDice(fissata, con({ ollama: 'R1', mistral: 'R2' }))?.k).toBe('v.fornitorePadre')
  const senza = figlia('ollama')
  // Revisione dell'audit 2.2.0, C2: violazioni fonde da sé la dirigente della lista; senza la dirigente nella lista, nessun provider passa.
  expect(violazioni(senza, con({ ollama: 'R1' }), [padre, senza]).find(m => m.k === 'v.fornitorePadre')).toBeUndefined()
  expect(violazioni(senza, con({ ollama: 'R1' }), [senza]).find(m => m.k === 'v.fornitorePadre')).toEqual({ k: 'v.fornitorePadre', p: { fornitore: 'ollama' } })
  expect(vincoliDirigente(padre, con({ ollama: 'R1', mistral: 'R2' })).compatibili).toEqual(['ollama', 'mistral'])
  expect('k' in normalizza({ ...senza, vincoliPadre: { ...senza.vincoliPadre, compatibili: ['../x'] } })).toBe(true)
})
