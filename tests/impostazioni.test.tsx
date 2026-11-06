import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import {
  budgetDa,
  conPosizione,
  conProfilo,
  conSoglia,
  manualiDaScrivere,
  nuovoBudget,
  pesoScritto,
  posizioneDi,
  POSIZIONI,
  presetDi,
  PROFILI,
  profiloDi,
  simula,
} from '../hooks/bilanciamento'
import { bilancia, regoleDa, risorseDa, RISORSE_DEFAULT, violazioniAvvio } from '../hooks/logica'
import type { Azione, Chiamante, Peso } from '../types'

// Dati d'esempio: nessun progetto reale.
const ROUTING = {
  modelli_ammessi: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-fable-5-1', 'gpt-6.1-sol', 'gpt-6-astra'],
  effort_ammessi: ['low', 'medium', 'high', 'xhigh'],
  tetto_per_modello: { 'claude-fable-5-1': 'xhigh' },
  revisione: {
    revisori_ammessi_per_autore: {
      'claude-opus-5-5': ['claude-fable-5-1', 'motore:codex'],
      'claude-sonnet-5-5': ['claude-opus-5-5', 'motore:codex'],
      'gpt-6.1-sol': ['claude-sonnet-5-5', 'claude-opus-5-5'],
      'gpt-6-astra': ['claude-sonnet-5-5', 'claude-opus-5-5'],
    },
  },
  corsia_codex: {
    modelli: ['gpt-6.1-sol', 'gpt-6-astra'],
    esegue: { corsie: ['R1', 'R2', 'R3'] },
    effort: { R1: 'high', R2: 'high', R3: 'xhigh' },
    rivisto_da: { R1: 'claude-sonnet-5-5', R2: 'claude-sonnet-5-5', R3: 'claude-opus-5-5' },
  },
}
const R = regoleDa(ROUTING, 'routing.json')
const CHI: Chiamante = { io: 'sessione-esempio', repo: 'esempio/demo', modello: 'claude-opus-5-5', effort: 'xhigh', permessi: 'auto', lanciatore: 'desktop' }
const MODELLO: Peso = { tipo: 'modello', nome: 'gpt-6-astra', percentuale: 37, assoluto: 5 }

// --- logica pura --------------------------------------------------------------------------------------

test('posizioni: cinque valori fissi, assoluto 0; fuori scala si mostra intero e resta intatto', () => {
  expect(POSIZIONI.map(p => p.percentuale)).toEqual([-90, -40, 0, 40, 100])
  expect(POSIZIONI[0].nome).toBe('Molto meno (non esclude)')
  expect(posizioneDi(undefined)).toBe(2)
  expect(posizioneDi({ tipo: 'effort', nome: 'low', percentuale: 40, assoluto: 0 })).toBe(3)
  expect(posizioneDi({ tipo: 'effort', nome: 'low', percentuale: 40, assoluto: 1 })).toBe(-1)
  expect(posizioneDi(MODELLO)).toBe(-1)
  expect(pesoScritto(MODELLO)).toBe('personalizzato (+37% · +5)')
  expect(pesoScritto({ ...MODELLO, percentuale: -10, assoluto: -3 })).toBe('personalizzato (-10% · -3)')
  // Toccare un'altra voce non converte quella fuori scala; Normale toglie la voce.
  const pesi = conPosizione([MODELLO], 'fornitore', 'codex', 4)
  expect(pesi).toEqual([MODELLO, { tipo: 'fornitore', nome: 'codex', percentuale: 100, assoluto: 0 }])
  expect(conPosizione(pesi, 'fornitore', 'codex', 2)).toEqual([MODELLO])
  expect(() => conPosizione(pesi, 'effort', 'low', 5)).toThrow()
})

test('profili: ognuno scrive esattamente i suoi pesi su motori ed effort; i modelli restano intatti', () => {
  const prima: Peso[] = [MODELLO, { tipo: 'fornitore', nome: 'claude', percentuale: 12, assoluto: 3 }, { tipo: 'effort', nome: 'high', percentuale: 40, assoluto: 0 }]
  expect(conProfilo(prima, 'automatico')).toEqual([MODELLO])
  expect(conProfilo(prima, 'risparmio')).toEqual([
    MODELLO,
    { tipo: 'fornitore', nome: 'codex', percentuale: 40, assoluto: 0 },
    { tipo: 'effort', nome: 'low', percentuale: 40, assoluto: 0 },
    { tipo: 'effort', nome: 'high', percentuale: -40, assoluto: 0 },
    { tipo: 'effort', nome: 'xhigh', percentuale: -90, assoluto: 0 },
  ])
  expect(conProfilo(prima, 'qualita')).toEqual([
    MODELLO,
    { tipo: 'effort', nome: 'xhigh', percentuale: 100, assoluto: 0 },
    { tipo: 'effort', nome: 'high', percentuale: 40, assoluto: 0 },
    { tipo: 'effort', nome: 'medium', percentuale: -40, assoluto: 0 },
    { tipo: 'effort', nome: 'low', percentuale: -90, assoluto: 0 },
  ])
  expect(conProfilo(prima, 'velocita')).toEqual([
    MODELLO,
    { tipo: 'effort', nome: 'low', percentuale: 100, assoluto: 0 },
    { tipo: 'effort', nome: 'medium', percentuale: 40, assoluto: 0 },
    { tipo: 'effort', nome: 'high', percentuale: -40, assoluto: 0 },
    { tipo: 'effort', nome: 'xhigh', percentuale: -90, assoluto: 0 },
  ])
  expect(conProfilo(prima, 'personalizzato')).toEqual(prima)
  // Nessun profilo nomina un modello; ogni peso dei profili sta su una delle cinque posizioni.
  for (const p of PROFILI) for (const x of p.pesi ?? []) expect([x.tipo !== 'modello', posizioneDi(x) >= 0]).toEqual([true, true])
  expect(profiloDi(RISORSE_DEFAULT)).toBe('automatico')
  expect(profiloDi({ ...RISORSE_DEFAULT, pesi: [MODELLO] })).toBe('personalizzato')
  expect(profiloDi({ ...RISORSE_DEFAULT, profilo: 'qualita' })).toBe('qualita')
})

test('profilo nel config: vale solo una stringa fra le cinque; ogni altra forma si tratta come assente', () => {
  expect(risorseDa({})).not.toHaveProperty('profilo')
  expect(risorseDa({ profilo: 'risparmio' })).toMatchObject({ profilo: 'risparmio' })
  // Un elenco con un nome valido non passa da String(): niente profilo, e il resto della politica resta valido.
  for (const profilo of ['economico', 3, null, ['qualita'], { qualita: true }]) {
    const r = risorseDa({ profilo, fornitori: ['claude'] })
    expect(typeof r).toBe('object')
    expect(r).not.toHaveProperty('profilo')
  }
})

test('simulazione: è la scelta di bilancia sulla stessa proposta e passa la guardia d\'avvio', () => {
  const r = { ...R, risorse: { ...RISORSE_DEFAULT, pesi: conProfilo([], 'risparmio') } }
  const esito = simula(r, [], [], CHI)
  const proposta: Azione = {
    id: 'a-simulata', versione: 0, repo: 'esempio/demo', titolo: 'Proposta d\'esempio', brief: 'Simulazione del bilanciamento.', ordine: 0, dipende: [],
    esecutore: 'claude', revisore: 'codex', corsia: 'R2', stato: 'proposta', creata: new Date(0).toISOString(), aggiornata: new Date(0).toISOString(),
  }
  const attesa = bilancia(proposta, {}, r, [], [], CHI)
  expect(esito.scelta).toEqual(attesa)
  expect(violazioniAvvio(esito.scelta!, r, [], CHI)).toEqual([])
  // Qualità sposta l'effort verso l'alto rispetto a Velocità.
  const effort = (p: 'qualita' | 'velocita') => simula({ ...R, risorse: { ...RISORSE_DEFAULT, fornitori: ['claude'], pesi: conProfilo([], p) } }, [], [], CHI).scelta?.effort
  expect([effort('qualita'), effort('velocita')]).toEqual(['xhigh', 'low'])
})

test('simulazione senza candidati validi: solo rete locale non propone Claude e dice i motivi', () => {
  const esito = simula({ ...R, risorse: { ...RISORSE_DEFAULT, soloLocale: true } }, [], [], CHI)
  expect(esito.scelta).toBeUndefined()
  expect(esito.motivi!.join(' ')).toContain('solo rete locale')
  expect(simula(R, [], [], null).motivi!.join(' ')).toContain('quale sessione')
})

test('soglie: preset riconosciuti, valori personali e null intatti, attenzione sempre sotto la critica', () => {
  expect(presetDi({ attenzione: 70, critica: 90 })).toBe('70/90')
  expect(presetDi(null)).toBe('nessuna')
  expect(presetDi({ attenzione: 72, critica: 93 })).toBe('')
  const s = RISORSE_DEFAULT.soglie
  expect(conSoglia(s, 'codex', { attenzione: 42, critica: 93 })).toEqual({ ...s, codex: { attenzione: 42, critica: 93 } })
  // Come la lettura: numeri finiti da 1 a 100, anche decimali; +5 da 72.5 resta valido.
  const decimali = risorseDa({ soglie: { codex: { attenzione: 72.5, critica: 93.5 } } })
  expect(decimali).toMatchObject({ soglie: { codex: { attenzione: 72.5, critica: 93.5 } } })
  expect(conSoglia(s, 'codex', { attenzione: 77.5, critica: 93.5 }).codex).toEqual({ attenzione: 77.5, critica: 93.5 })
  for (const rotta of [{ attenzione: NaN, critica: 90 }, { attenzione: 50, critica: Infinity }, { attenzione: 0.5, critica: 90 }])
    expect(() => conSoglia(s, 'codex', rotta)).toThrow()
  expect(conSoglia(s, 'codex', null).codex).toBeNull()
  expect(() => conSoglia(s, 'codex', { attenzione: 90, critica: 90 })).toThrow()
  expect(() => conSoglia(s, 'codex', { attenzione: 0, critica: 50 })).toThrow()
  expect(() => conSoglia(s, 'codex', { attenzione: 50, critica: 101 })).toThrow()
})

test('budget manuali: valore con unità, nuovo nella forma del config, riscrittura senza raddoppiare il prefisso', () => {
  expect(budgetDa('40')).toEqual({ percentuale: 40, unita: '%' })
  expect(budgetDa(' 12,5 usd ')).toEqual({ valore: 12.5, unita: 'USD' })
  expect(budgetDa('500 richieste')).toEqual({ valore: 500, unita: 'richieste' })
  for (const rotto of ['140%', 'tanti', '12 lire', '']) expect(typeof budgetDa(rotto)).toBe('string')
  const adesso = Date.parse('2026-11-05T12:00:00Z')
  const nuovo = nuovoBudget('claude', 'settimanale', { percentuale: 40, unita: '%' }, adesso)
  expect(nuovo).toEqual({ id: `claude-settimanale-${adesso.toString(36)}`, fornitore: 'claude', nome: 'settimanale', letto: '2026-11-05T12:00:00.000Z', percentuale: 40, unita: '%' })
  const letti = risorseDa({ limitiManuali: [nuovo, { id: 'saldo', fornitore: 'deepseek', nome: 'saldo mensile', letto: '2026-11-01T00:00:00Z', valore: 12, unita: 'USD' }] })
  if (typeof letti === 'string') throw new Error(letti)
  expect(letti.limitiManuali.map(l => l.id)).toEqual([`manuale-${nuovo.id}`, 'manuale-saldo'])
  const riscritti = manualiDaScrivere(letti.limitiManuali)
  expect(riscritti[1]).toEqual({ id: 'saldo', fornitore: 'deepseek', nome: 'saldo mensile', letto: '2026-11-01T00:00:00Z', valore: 12, unita: 'USD' })
  const riletti = risorseDa({ limitiManuali: riscritti })
  expect(typeof riletti !== 'string' && riletti.limitiManuali).toEqual(letti.limitiManuali)
})

// --- il pannello contro un engine finto -------------------------------------------------------------------

const CONFIG = 'X:/casa/.claude/chipmanager/config.json'
type On = Parameters<TestBody>[1]

/** Engine finto ridotto: config e helper `configura` (CAS) in memoria, sonda dei limiti, toast e popup scriptabili. */
function ambiente(on: On, progetto: Record<string, unknown> = {}) {
  const disco = new Map<string, string>()
  const toast: string[] = []
  const processi: string[][] = []
  const domande: string[] = []
  /** Risposta al popup: una stringa, oppure `null` = popup chiuso (`$.ui.ask` rifiuta). */
  const popup = { risposta: (_: string): string | null => null }
  const p = (s: string | undefined) => (s ?? '').replace(/\\/g, '/')
  disco.set('X:/repo/.claude/routing.json', JSON.stringify(ROUTING))
  disco.set(CONFIG, JSON.stringify({ progetti: { 'esempio/demo': progetto } }))
  on('env.get', (_, e) => ({ value: e.name === 'CHIPMANAGER_DIR' ? 'X:/dati' : e.name === 'USERPROFILE' ? 'X:/casa' : undefined }))
  on('session.id', () => ({ value: 'sessione-esempio' }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('tool.list', () => ({ value: [{ name: 'mcp__ccd_session__start_session' }] as never }))
  on('session.repo', () => ({ value: { root: 'X:/repo', remote: 'https://github.com/esempio/demo.git', internal: false, repo: null } as never }))
  on('fs.exists', (_, e) => ({ value: [...disco.keys()].some(k => k === p(e.path) || k.startsWith(`${p(e.path)}/`)) }))
  on('fs.list', () => ({ value: [] }))
  on('fs.read', (_, e) => {
    const t = disco.get(p(e.path))
    if (t === undefined) throw new Error('ENOENT')
    return { value: t }
  })
  on('fs.write', (_, e) => {
    disco.set(p(e.path), e.text)
    return { value: undefined }
  })
  on('ui.panes', () => ({ value: [{ id: 'chipManager', title: 'chipManager', isShown: true, isFocused: false, isPlaced: true }] }))
  on('process.run', (_, e) => {
    const fine = (exitCode: number, stdout = '') => ({ value: { exitCode, stdout, stderr: '' } as never })
    processi.push([...e.argv])
    const [, script, cmd, file] = e.argv
    if (script?.endsWith('/fornitori.cjs'))
      return fine(0, JSON.stringify({
        limiti: [{ id: 'claude-weekly', fornitore: 'claude', nome: 'Claude piano · settimanale', fonte: 'app', percentuale: 37, unita: '%', letto: new Date().toISOString() }],
        proxy: 'non abilitato', chiavi: { anthropic: false, deepseek: false, freellmapi: false },
      }))
    if (cmd === 'configura') {
      // Come l'helper vero: CAS sul testo intero, poi fusione dei campi nella sezione del progetto.
      const input = JSON.parse(e.init!.stdin!)
      const prima = disco.get(p(file)) ?? null
      if (prima !== input.atteso) return fine(4)
      const c = prima === null ? {} : JSON.parse(prima)
      disco.set(p(file), JSON.stringify({ ...c, progetti: { ...c.progetti, [input.repo]: { ...c.progetti?.[input.repo], ...input.campi } } }))
      return fine(0)
    }
    return fine(cmd === 'occupata' ? 0 : 2)
  })
  on('mcp.call', (_, e) => ({
    value: { isError: false, content: [{ type: 'text', text: e.tool === 'get_session' ? JSON.stringify({ model: 'claude-opus-5-5', effort: 'xhigh', permissionMode: 'auto' }) : '{}' }] } as never,
  }))
  on('tool.call', { tool: 'AskUserQuestion' }, (_, e) => {
    const q = e.questions[0]!.question
    domande.push(q)
    const r = popup.risposta(q)
    if (r === null) return { deny: 'finestra chiusa' }
    return { result: { questions: e.questions, answers: { [q]: r } } }
  })
  on('ui.toast', (_, e) => {
    toast.push(String((e as { text?: unknown }).text))
    return { value: undefined }
  })
  on('ui.notify', () => ({ value: { isSent: false, reason: 'no-surface' } as never }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('tool.register', (_, e) => ({ value: { tool: e.name } }))
  on('command.register', () => ({ value: { command: 'chipmanager' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  const progettoOra = () => JSON.parse(disco.get(CONFIG)!).progetti['esempio/demo'] as Record<string, unknown>
  const configure = () => processi.filter(p => p[2] === 'configura').length
  return { disco, toast, domande, popup, progettoOra, configure }
}

const PANE = (surface: 'desktop' | 'terminal', bodyColumns = 90) =>
  ({
    plugin: 'chip-manager',
    surface,
    component: 'Pane',
    requestId: 'chipManager',
    props: { title: 'chipManager', isFocused: false, bodyColumns, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} },
  }) as const
const SEZIONI = ['connessioni', 'soglie', 'bilanciamento', 'progetto', 'board', 'avanzate'] as const

test('impostazioni: profilo illeggibile nel config (un elenco) non rompe il disegno e vale come assente', async ($, on) => {
  ambiente(on, { profilo: ['qualita'] })
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: 'impostazioni' })
  await ui.press({ key: 'sezione-bilanciamento-premi' })
  expect(String((await ui.find({ key: 'profilo-automatico-premi' }))?.props.label)).toMatch(/, selezionato$/)
  await ui.unmount()
})

test('impostazioni: in ogni sezione le etichette dei pulsanti sono uniche (preset delle soglie con il fornitore)', async ($, on) => {
  ambiente(on, {
    fornitori: ['claude', 'codex', 'deepseek'],
    limitiManuali: [
      { id: 'quota', fornitore: 'codex', nome: 'settimanale', letto: '2026-11-01T00:00:00Z', percentuale: 20, unita: '%' },
      { id: 'saldo', fornitore: 'deepseek', nome: 'saldo mensile', letto: '2026-11-01T00:00:00Z', valore: 12, unita: 'USD' },
    ],
  })
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await $.ui.mount({ ...PANE(surface) })
    await ui.press({ key: 'impostazioni' })
    for (const s of SEZIONI) {
      await ui.press({ key: `sezione-${s}-premi` })
      if (s === 'bilanciamento' && !(await ui.find({ key: 'gruppo' }))) await ui.press({ key: 'regola-a-mano' })
      const etichette = (await ui.findAll({ type: 'Button' })).map(b => String(b.props.label))
      expect([s, etichette.filter((e, i) => etichette.indexOf(e) !== i)]).toEqual([s, []])
    }
    expect(String((await ui.find({ key: 'sezione-avanzate-premi' }))?.props.label)).toBe('● Avanzate, selezionato')
    await ui.press({ key: 'sezione-soglie-premi' })
    expect(String((await ui.find({ key: 'soglia-codex-70/90-premi' }))?.props.label)).toBe('● Codex, 70/90 (predefinita), selezionato')
    await ui.unmount()
  }
})

test('impostazioni: chip di sezione in cima, una sezione alla volta, la scelta sta nell\'etichetta', async ($, on) => {
  ambiente(on)
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await $.ui.mount({ ...PANE(surface) })
    await ui.press({ key: 'impostazioni' })
    for (const s of SEZIONI) {
      await ui.press({ key: `sezione-${s}-premi` })
      for (const altra of SEZIONI) expect([altra, !!(await ui.find({ key: `pagina-${altra}` }))]).toEqual([altra, altra === s])
      expect(String((await ui.find({ key: `sezione-${s}-premi` }))?.props.label)).toMatch(/, selezionato$/)
    }
    await ui.press({ key: 'sezione-connessioni-premi' })
    await ui.unmount()
  }
})

test('impostazioni: ogni controllo salva da sé con il toast; profilo e pesi in una sola configura', async ($, on) => {
  const amb = ambiente(on, { pesi: [MODELLO] })
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: 'impostazioni' })
  await ui.press({ key: 'fornitore-deepseek-premi' })
  expect(amb.progettoOra().fornitori).toEqual(['claude', 'codex', 'deepseek'])
  expect(amb.toast).toEqual(['Salvato'])
  await ui.press({ key: 'sezione-bilanciamento-premi' })
  const prima = amb.configure()
  await ui.press({ key: 'profilo-risparmio-premi' })
  expect(amb.configure() - prima).toBe(1)
  expect(amb.progettoOra()).toMatchObject({ profilo: 'risparmio', pesi: conProfilo([MODELLO], 'risparmio') })
  // La regolazione a mano passa a Personalizzato; il peso fuori scala si legge intero e resta intatto.
  await ui.press({ key: 'regola-a-mano' })
  await ui.press({ key: 'gruppo-modello-premi' })
  expect(await ui.find({ type: 'Text', text: /personalizzato \(\+37% · \+5\)/ })).toBeDefined()
  await ui.press({ key: 'gruppo-effort-premi' })
  await ui.press({ key: 'peso-effort-low-meno' })
  expect(amb.progettoOra().profilo).toBe('personalizzato')
  expect(amb.progettoOra().pesi).toContainEqual(MODELLO)
  expect(amb.toast).toEqual(['Salvato', 'Salvato', 'Salvato'])
  await ui.unmount()
})

test('impostazioni: un errore va in linea sotto il controllo, senza toast; le soglie non scendono sotto il vincolo', async ($, on) => {
  const amb = ambiente(on, { soglie: { claude: { attenzione: 72, critica: 75 } } })
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('terminal') })
  await ui.press({ key: 'impostazioni' })
  await ui.press({ key: 'sezione-soglie-premi' })
  // Valori personali fuori passo: si mostrano così e + resta sotto la critica.
  expect(await ui.find({ key: 'soglia-claude' })).toBeDefined()
  await ui.press({ key: 'attenzione-claude-piu' })
  expect(amb.progettoOra().soglie).toMatchObject({ claude: { attenzione: 74, critica: 75 } })
  expect(String((await ui.find({ key: 'attenzione-claude-piu' }))?.props.label)).toBe('Aumenta Attenzione da (Claude), al massimo')
  // Un endpoint fuori da questo computer non si salva: la causa e il rimedio in linea.
  await ui.press({ key: 'sezione-avanzate-premi' })
  await ui.input({ key: 'free-endpoint', text: 'http://example.org/v1' })
  expect(await ui.find({ type: 'Text', text: /Endpoint solo su questo computer: http:\/\/localhost/ })).toBeDefined()
  expect(amb.progettoOra()).not.toHaveProperty('freellmapi')
  await ui.press({ key: 'sezione-soglie-premi' })
  // Una modifica concorrente: l'errore sta in linea con il rimedio e non c'è un secondo toast.
  amb.disco.set(CONFIG, JSON.stringify({ progetti: { 'esempio/demo': { soloLocale: true } } }))
  await ui.press({ key: 'soglia-claude-nessuna-premi' })
  expect(amb.progettoOra()).toEqual({ soloLocale: true })
  expect(await ui.find({ type: 'Text', text: /Impostazioni cambiate altrove: aggiorna/ })).toBeDefined()
  expect(amb.toast).toEqual(['Salvato'])
  await ui.unmount()
})

test('impostazioni: popup rifiutato, «Collega…» e «Aggiungi budget…» si fanno in linea', async ($, on) => {
  const amb = ambiente(on, { fornitori: ['claude', 'codex', 'deepseek'], limitiManuali: [{ id: 'saldo', fornitore: 'deepseek', nome: 'saldo mensile', letto: '2026-11-01T00:00:00Z', valore: 12, unita: 'USD' }] })
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: 'impostazioni' })
  // Claude è collegato (misura dall'app); DeepSeek no: «Collega…» solo lì, e il popup chiuso la lascia in linea.
  expect(await ui.find({ key: 'collega-claude' })).toBeUndefined()
  await ui.press({ key: 'collega-deepseek' })
  expect(amb.domande[0]).toContain('campo segreto di /config')
  expect(await ui.find({ key: 'guida-deepseek' })).toBeDefined()
  await ui.press({ key: 'guida-deepseek-chiudi' })
  expect(await ui.find({ key: 'guida-deepseek' })).toBeUndefined()

  await ui.press({ key: 'sezione-progetto-premi' })
  await ui.press({ key: 'aggiungi-budget' })
  expect(await ui.find({ key: 'bozza-fornitore' })).toBeDefined()
  await ui.press({ key: 'bozza-fornitore-claude-premi' })
  await ui.press({ key: 'bozza-tipo-settimanale-premi' })
  await ui.input({ key: 'bozza-valore', text: '140%' })
  expect(await ui.find({ type: 'Text', text: /Una percentuale va da 0 a 100/ })).toBeDefined()
  await ui.input({ key: 'bozza-valore', text: '40%' })
  const manuali = amb.progettoOra().limitiManuali as { id: string }[]
  expect(manuali[0]).toEqual({ id: 'saldo', fornitore: 'deepseek', nome: 'saldo mensile', letto: '2026-11-01T00:00:00Z', valore: 12, unita: 'USD' })
  expect(manuali[1]).toMatchObject({ fornitore: 'claude', nome: 'settimanale', percentuale: 40, unita: '%' })
  expect(manuali[1]!.id).toMatch(/^claude-settimanale-[a-z0-9]+$/)
  expect(await ui.find({ key: 'bozza-fornitore' })).toBeUndefined()

  // Popup accettato: fornitore e tipo dal popup, il valore in linea; × toglie la voce.
  amb.popup.risposta = q => (q.startsWith('Per quale') ? 'DeepSeek' : 'Mensile')
  await ui.press({ key: 'aggiungi-budget' })
  expect(await ui.find({ key: 'bozza-tipo' })).toBeDefined()
  await ui.input({ key: 'bozza-valore', text: '20 USD' })
  expect((amb.progettoOra().limitiManuali as unknown[])[2]).toMatchObject({ fornitore: 'deepseek', nome: 'mensile', valore: 20, unita: 'USD' })
  await ui.press({ key: 'budget-manuale-saldo-via' })
  expect((amb.progettoOra().limitiManuali as { id: string }[]).map(l => l.id).some(id => id === 'saldo' || id.startsWith('manuale-'))).toBe(false)
  await ui.unmount()
})

test('impostazioni: con solo rete locale la simulazione non propone Claude e dice i motivi', async ($, on) => {
  ambiente(on, { soloLocale: true })
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await $.ui.mount({ ...PANE(surface) })
    await ui.press({ key: 'impostazioni' })
    await ui.press({ key: 'sezione-bilanciamento-premi' })
    expect(await ui.find({ type: 'Text', text: /Simulazione: nessuna combinazione avviabile con queste regole/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /progetto solo rete locale/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /andrebbe a/ })).toBeUndefined()
    await ui.unmount()
  }
})
