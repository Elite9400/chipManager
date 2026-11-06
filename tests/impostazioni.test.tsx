import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import {
  budgetDa,
  conPendente,
  conPosizione,
  conProfilo,
  conSoglia,
  manualiDaScrivere,
  nuovoBudget,
  pesoScritto,
  posizioneDi,
  POSIZIONI,
  presetDi,
  pendentiDa,
  PROFILI,
  profiloDi,
  simula,
} from '../hooks/bilanciamento'
import { bilancia, regoleDa, risorseDa, RISORSE_DEFAULT, violazioniAvvio } from '../hooks/logica'
import { LEGENDA, LINGUE, t } from '../hooks/lingua'
import { usoDesktop } from '../hooks/risorse'
import type { Azione, Chiamante, Peso } from '../types'
import { DiscoIt } from './disco-it'

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
  expect(POSIZIONI[0].nome).toBe('pos.moltoMeno')
  expect(posizioneDi(undefined)).toBe(2)
  expect(posizioneDi({ tipo: 'effort', nome: 'low', percentuale: 40, assoluto: 0 })).toBe(3)
  expect(posizioneDi({ tipo: 'effort', nome: 'low', percentuale: 40, assoluto: 1 })).toBe(-1)
  expect(posizioneDi(MODELLO)).toBe(-1)
  expect(pesoScritto(MODELLO, 'it')).toBe('personalizzato (+37% · +5)')
  expect(pesoScritto({ ...MODELLO, percentuale: -10, assoluto: -3 }, 'en')).toBe('custom (-10% · -3)')
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
    id: 'a-simulata', versione: 0, repo: 'esempio/demo', titolo: 'Proposta d\'esempio', brief: 'Balancing simulation.', ordine: 0, dipende: [],
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
  expect(esito.motivi!.map(m => m.k)).toContain('v.soloLocale')
  expect(simula(R, [], [], null).motivi!.map(m => m.k)).toContain('v.chiIgnoto')
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
  for (const rotto of ['140%', 'tanti', '12 lire', '']) expect(budgetDa(rotto)).toHaveProperty('k')
  // Le unità in ogni lingua finiscono nello stesso valore salvato; l'esempio della procedura guidata passa il parser.
  for (const l of LINGUE) {
    const esempi = t(l, 'budget.esempio').split(', ').map(budgetDa)
    expect([l, esempi]).toEqual([l, [{ percentuale: 40, unita: '%' }, { valore: 12, unita: 'USD' }, { valore: 500, unita: 'richieste' }]])
  }
  for (const u of ['requests', 'Solicitudes', 'requêtes', 'Anfragen', 'requisições', 'richiesta', 'Tokens']) expect(budgetDa(`3 ${u}`)).not.toHaveProperty('k')
  const adesso = Date.parse('2026-11-05T12:00:00Z')
  const nuovo = nuovoBudget('claude', 'settimanale', { percentuale: 40, unita: '%' }, adesso)
  expect(nuovo).toEqual({ id: `claude-settimanale-${adesso.toString(36)}`, fornitore: 'claude', nome: 'settimanale', letto: '2026-11-05T12:00:00.000Z', percentuale: 40, unita: '%' })
  const letti = risorseDa({ limitiManuali: [nuovo, { id: 'saldo', fornitore: 'deepseek', nome: 'saldo mensile', letto: '2026-11-01T00:00:00Z', valore: 12, unita: 'USD' }] })
  if ('k' in letti) throw new Error(letti.k)
  expect(letti.limitiManuali.map(l => l.id)).toEqual([`manuale-${nuovo.id}`, 'manuale-saldo'])
  const riscritti = manualiDaScrivere(letti.limitiManuali)
  expect(riscritti[1]).toEqual({ id: 'saldo', fornitore: 'deepseek', nome: 'saldo mensile', letto: '2026-11-01T00:00:00Z', valore: 12, unita: 'USD' })
  const riletti = risorseDa({ limitiManuali: riscritti })
  expect(!('k' in riletti) && riletti.limitiManuali).toEqual(letti.limitiManuali)
})

// --- il pannello contro un engine finto -------------------------------------------------------------------

const CONFIG = 'X:/casa/.claude/chipmanager/config.json'
type On = Parameters<TestBody>[1]

/** Engine finto ridotto: config e helper `configura` (CAS) in memoria, sonda dei limiti, toast e popup scriptabili. */
function ambiente(on: On, progetto: Record<string, unknown> = {}) {
  const disco = new DiscoIt()
  const toast: string[] = []
  const processi: string[][] = []
  const domande: string[] = []
  /** F6.7: l'uscita di `stato-esecuzione` (null = l'helper fallisce) e l'esito di `accedi`; si contano entrambi. */
  const esec = {
    stato: (): string | null => JSON.stringify({ claude: { trovato: true, loggedIn: true }, github: { trovato: true, loggedIn: true, remote: true, host: 'github.com' }, fonti: [] }),
    accedi: (_tipo: string): [number, string] => [0, '{}'],
    controlli: 0,
    accessi: [] as string[],
  }
  /** Risposta al popup: una stringa, oppure `null` = popup chiuso (`$.ui.ask` rifiuta). */
  const popup = { risposta: (_: string): string | null => null }
  /**
   * Concorrenza: `primaDiConfigura` gira una volta appena prima del CAS dell'helper; `rifiutaUtente` fa fallire un
   * configura-utente; `trattieni()` ferma la prossima scrittura (configura o configura-utente) finché il test non la apre.
   */
  const hook: { primaDiConfigura?: () => void; rifiutaUtente?: boolean; cancello?: { attesa: Promise<void>; segnala: () => void } } = {}
  const popupFermi: { quale: (q: string) => boolean; attesa: Promise<void>; segnala: () => void }[] = []
  /** Il prossimo popup la cui domanda soddisfa `quale` resta aperto finché non si chiama `apri()`. */
  const trattieniPopup = (quale: (q: string) => boolean) => {
    let apri!: () => void
    let segnala!: () => void
    const arrivato = new Promise<void>(ok => (segnala = ok))
    popupFermi.push({ quale, attesa: new Promise<void>(ok => (apri = ok)), segnala })
    return { arrivato, apri }
  }
  let limitiFermi: { attesa: Promise<void>; segnala: () => void } | undefined
  const trattieniLimiti = () => {
    let apri!: () => void
    let segnala!: () => void
    const arrivato = new Promise<void>(ok => (segnala = ok))
    limitiFermi = { attesa: new Promise<void>(ok => (apri = ok)), segnala }
    return { arrivato, apri }
  }
  const trattieni = () => {
    let apri!: () => void
    let segnala!: () => void
    const arrivato = new Promise<void>(ok => (segnala = ok))
    hook.cancello = { attesa: new Promise<void>(ok => (apri = ok)), segnala }
    return { arrivato, apri }
  }
  const scrittura = (scrivi: () => unknown) => {
    const c = hook.cancello
    if (!c) return scrivi()
    hook.cancello = undefined
    c.segnala()
    return c.attesa.then(scrivi)
  }
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
    if (script?.endsWith('/fornitori.cjs')) {
      const leggi = () => fine(0, JSON.stringify({
        limiti: [{ id: 'claude-weekly', fornitore: 'claude', nome: 'Claude piano · settimanale', fonte: 'app', percentuale: 37, unita: '%', letto: new Date().toISOString() }],
        proxy: 'non abilitato', chiavi: { anthropic: false, deepseek: false, freellmapi: false },
      }))
      // Concorrenza: la prossima lettura dei limiti (l'aggiornamento delle risorse dopo una scrittura) resta ferma.
      const f = limitiFermi
      if (!f || cmd !== 'limiti') return leggi()
      limitiFermi = undefined
      f.segnala()
      return f.attesa.then(leggi) as never
    }
    if (cmd === 'configura')
      return scrittura(() => {
        // Come l'helper vero: CAS sul testo intero, poi fusione dei campi nella sezione del progetto.
        const altra = hook.primaDiConfigura
        hook.primaDiConfigura = undefined
        altra?.()
        const input = JSON.parse(e.init!.stdin!)
        const prima = disco.get(p(file)) ?? null
        if (prima !== input.atteso) return fine(4)
        const c = prima === null ? {} : JSON.parse(prima)
        disco.set(p(file), JSON.stringify({ ...c, progetti: { ...c.progetti, [input.repo]: { ...c.progetti?.[input.repo], ...input.campi } } }))
        return fine(0)
      }) as never
    if (cmd === 'configura-utente')
      return scrittura(() => {
        // Come l'helper vero: stesso CAS, solo campi dell'utente al primo livello.
        if (hook.rifiutaUtente) {
          hook.rifiutaUtente = false
          return fine(4)
        }
        const input = JSON.parse(e.init!.stdin!)
        const prima = disco.get(p(file)) ?? null
        if (prima !== input.atteso) return fine(4)
        disco.set(p(file), JSON.stringify({ ...(prima === null ? {} : JSON.parse(prima)), ...input.campi }))
        return fine(0)
      }) as never
    if (cmd === 'stato-esecuzione') {
      esec.controlli++
      const t = esec.stato()
      return t === null ? fine(2) : fine(0, t)
    }
    if (cmd === 'accedi') {
      esec.accessi.push(String(file))
      return fine(...esec.accedi(String(file)))
    }
    return fine(cmd === 'occupata' ? 0 : 2)
  })
  on('mcp.call', (_, e) => ({
    value: { isError: false, content: [{ type: 'text', text: e.tool === 'get_session' ? JSON.stringify({ model: 'claude-opus-5-5', effort: 'xhigh', permissionMode: 'auto' }) : '{}' }] } as never,
  }))
  on('tool.call', { tool: 'AskUserQuestion' }, (_, e) => {
    const q = e.questions[0]!.question
    domande.push(q)
    const rispondi = () => {
      const r = popup.risposta(q)
      if (r === null) return { deny: 'finestra chiusa' }
      return { result: { questions: e.questions, answers: { [q]: r } } }
    }
    // Un popup trattenuto resta aperto finché il test non lo apre; la risposta si sceglie allora.
    const i = popupFermi.findIndex(f => f.quale(q))
    if (i < 0) return rispondi()
    const [f] = popupFermi.splice(i, 1)
    f!.segnala()
    return f!.attesa.then(rispondi) as never
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
  // Una lettura lenta della lingua salvata: il valore si legge subito ma arriva solo dopo `apri()` (una lettura vecchia).
  let letturaFerma: { key: string; attesa: Promise<void>; segnala: () => void } | undefined
  for (const key of ['lingua', 'impostazioni'] as const)
    on('state.get', { plugin: 'chip-manager', key } as never, async (_$, e, next) => {
      const letto = await next(e as never)
      const f = letturaFerma
      if (f && f.key === key) {
        letturaFerma = undefined
        f.segnala()
        await f.attesa
      }
      return letto as never
    })
  /** La prossima lettura di `key` (lingua salvata o stato delle Impostazioni) arriva solo dopo `apri()`, col valore di prima. */
  const trattieniLettura = (key: 'lingua' | 'impostazioni' = 'lingua') => {
    let apri!: () => void
    let segnala!: () => void
    const arrivato = new Promise<void>(ok => (segnala = ok))
    letturaFerma = { key, attesa: new Promise<void>(ok => (apri = ok)), segnala }
    return { arrivato, apri }
  }
  return { disco, toast, domande, popup, progettoOra, configure, hook, trattieni, trattieniPopup, trattieniLettura, trattieniLimiti, esec, processi }
}

const PANE = (surface: 'desktop' | 'terminal', bodyColumns = 90) =>
  ({
    plugin: 'chip-manager',
    surface,
    component: 'Pane',
    requestId: 'chipManager',
    props: { title: 'chipManager', isFocused: false, bodyColumns, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} },
  }) as const
const SEZIONI = ['connessioni', 'soglie', 'bilanciamento', 'progetto', 'board', 'avanzate', 'esecuzione', 'lingua', 'legenda'] as const

test('lingua: config assente = inglese; la scelta va nella bozza, Applica la scrive con configura-utente (CAS) e il pannello cambia', async ($, on) => {
  const amb = ambiente(on)
  amb.disco.lingua = undefined
  amb.disco.delete(CONFIG)
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: 'impostazioni' })
  await ui.press({ key: 'sezione-lingua-premi' })
  expect(await ui.find({ type: 'Text', text: 'Language' })).toBeDefined()
  expect((await ui.find({ key: 'lingua-en-premi' }))?.props).toMatchObject({ label: 'English', variant: 'primary' })
  await ui.press({ key: 'lingua-de-premi' })
  expect(amb.disco.get(CONFIG)).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: '1 unsaved change' })).toBeDefined()
  await ui.press({ key: 'applica' })
  expect(JSON.parse(amb.disco.get(CONFIG)!)).toEqual({ lingua: 'de' })
  expect(await ui.find({ type: 'Text', text: 'Sprache' })).toBeDefined()
  expect((await ui.find({ key: 'lingua-de-premi' }))?.props).toMatchObject({ label: 'Deutsch', variant: 'primary' })
  await ui.unmount()
})

test('lingua: scelta in un altro pannello (config cambiato su disco) arriva al battito; un codice ignoto vale inglese', async ($, on) => {
  const amb = ambiente(on)
  const clock = mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: 'impostazioni' })
  await ui.press({ key: 'sezione-lingua-premi' })
  expect(await ui.find({ type: 'Text', text: 'Lingua' })).toBeDefined()
  amb.disco.set(CONFIG, JSON.stringify({ lingua: 'fr', progetti: { 'esempio/demo': {} } }))
  await clock.advance(20_000)
  expect(await ui.find({ type: 'Text', text: 'Langue' })).toBeDefined()
  amb.disco.set(CONFIG, JSON.stringify({ lingua: 'klingon', progetti: { 'esempio/demo': {} } }))
  await clock.advance(20_000)
  expect(await ui.find({ type: 'Text', text: 'Language' })).toBeDefined()
  await ui.unmount()
})

test('impostazioni: profilo illeggibile nel config (un elenco) non rompe il disegno e vale come assente', async ($, on) => {
  ambiente(on, { profilo: ['qualita'] })
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: 'impostazioni' })
  await ui.press({ key: 'sezione-bilanciamento-premi' })
  expect((await ui.find({ key: 'profilo-automatico-premi' }))?.props.variant).toBe('primary')
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
    expect((await ui.find({ key: 'sezione-legenda-premi' }))?.props).toMatchObject({ label: 'Legenda', variant: 'primary' })
    await ui.press({ key: 'sezione-soglie-premi' })
    expect((await ui.find({ key: 'soglia-codex-70/90-premi' }))?.props).toMatchObject({ label: 'Codex, 70/90 (predefinita)', variant: 'primary' })
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
      expect((await ui.find({ key: `sezione-${s}-premi` }))?.props.variant).toBe('primary')
    }
    await ui.press({ key: 'sezione-connessioni-premi' })
    await ui.unmount()
  }
})

test('F5.7: ogni percentuale di piano è utilizzo 0→100 con «used» in ogni lingua; i soldi restano soldi', () => {
  // Stesso consumo da ogni fonte del pannello: get_usage (finestre e rate_limits) e budget manuale in %.
  const letto = '2026-11-06T10:00:00Z'
  const fonti = [
    ...usoDesktop({ plan: { status: 'ok', windows: [{ label: 'weekly', percentUsed: 37 }] } }, letto),
    ...usoDesktop({ rate_limits: { seven_day: { utilization: 37 } } }, letto),
    budgetDa('37%'),
    budgetDa('37% used'),
    budgetDa('37 % usato'),
  ]
  expect(fonti.map(x => ('percentuale' in x ? x.percentuale : x))).toEqual([37, 37, 37, 37, 37])
  // Un saldo in valuta o un conteggio non diventa mai una percentuale.
  expect(budgetDa('12 USD')).toEqual({ valore: 12, unita: 'USD' })
  expect(budgetDa('500 requests')).toEqual({ valore: 500, unita: 'richieste' })
  // Rilievo 5: dopo «%» solo la parola «used» di una delle sei lingue; un residuo o una parola qualunque non è un utilizzo.
  for (const testo of ['90% remaining', '90% rimanente', '90% bananas', '90% left', '90 used'])
    expect([testo, budgetDa(testo)]).toEqual([testo, testo === '90 used' ? { k: 'budget.unita', p: { unita: 'used' } } : { k: 'budget.formato' }])
  for (const testo of ['90%', '90% USED', '90% utilisé', '90% genutzt', '90 %usado'])
    expect([testo, budgetDa(testo)]).toEqual([testo, { percentuale: 90, unita: '%' }])
  for (const l of LINGUE) {
    const usato = t(l, 'car.usato', { pct: 37 })
    for (const k of ['sintesi.uso', 'sintesi.attenzione', 'sintesi.critica', 'sog.uso', 'sog.usoAttenzione', 'sog.usoCritica', 'pop.limiteCritico'] as const)
      expect([l, k, t(l, k, { nome: 'Claude', pct: 37, critica: 90 }).includes(usato)]).toEqual([l, k, true])
    // L'esempio del budget dice che la percentuale è quella usata, e si legge così com'è scritto.
    const esempio = t(l, 'budget.esempio').split(',')[0]!
    expect([l, esempio, budgetDa(esempio)]).toEqual([l, t(l, 'car.usato', { pct: 40 }), { percentuale: 40, unita: '%' }])
  }
})

test('legenda: ultima sezione, chiusa all\'apertura; corsie e termini una voce per riga; rimando R0–R5 solo nel Bilanciamento', async ($, on) => {
  ambiente(on)
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: 'impostazioni' })
  expect(await ui.find({ key: 'pagina-legenda' })).toBeUndefined()
  const sezioni = (await ui.findAll({ type: 'Button' })).map(b => String(b.props.key)).filter(k => /^sezione-.*-premi$/.test(k))
  expect(sezioni.at(-1)).toBe('sezione-legenda-premi')
  await ui.press({ key: 'sezione-legenda-premi' })
  expect(await ui.find({ key: 'pagina-legenda' })).toBeDefined()
  // Una voce per riga: ogni voce è un Text a sé con il testo intero del dizionario.
  for (const k of [...LEGENDA.corsie, ...LEGENDA.termini]) expect([k, !!(await ui.find({ type: 'Text', text: t('it', k) }))]).toEqual([k, true])
  expect(LEGENDA.corsie).toEqual(['legenda.r0', 'legenda.r1', 'legenda.r2', 'legenda.r3', 'legenda.r4', 'legenda.r5'])
  expect(t('it', 'legenda.r5')).toContain('Claude')
  // Il rimando testuale sta solo nella sezione dei pesi.
  expect(await ui.find({ type: 'Text', text: 'R0–R5: vedi Legenda.' })).toBeUndefined()
  await ui.press({ key: 'sezione-bilanciamento-premi' })
  expect(await ui.find({ type: 'Text', text: 'R0–R5: vedi Legenda.' })).toBeDefined()
  await ui.unmount()
})

test('F5.9: più modifiche in più sezioni vanno nella bozza; la barra le conta; Applica = una sola scrittura e un toast', async ($, on) => {
  const amb = ambiente(on, { pesi: [MODELLO] })
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: 'impostazioni' })
  // Bozza vuota: nessuna barra.
  expect(await ui.find({ key: 'pendenti' })).toBeUndefined()
  await ui.press({ key: 'fornitore-deepseek-premi' })
  // Il pannello mostra la bozza; il config non cambia ancora.
  expect((await ui.find({ key: 'fornitore-deepseek-premi' }))?.props.variant).toBe('primary')
  expect(amb.progettoOra()).toEqual({ pesi: [MODELLO] })
  await ui.press({ key: 'sezione-bilanciamento-premi' })
  await ui.press({ key: 'profilo-risparmio-premi' })
  expect((await ui.find({ key: 'profilo-risparmio-premi' }))?.props.variant).toBe('primary')
  // La regolazione a mano passa a Personalizzato; il peso fuori scala si legge intero e resta intatto.
  await ui.press({ key: 'regola-a-mano' })
  await ui.press({ key: 'gruppo-modello-premi' })
  expect(await ui.find({ type: 'Text', text: /personalizzato \(\+37% · \+5\)/ })).toBeDefined()
  await ui.press({ key: 'gruppo-effort-premi' })
  await ui.press({ key: 'peso-effort-low-meno' })
  await ui.press({ key: 'sezione-soglie-premi' })
  await ui.press({ key: 'soglia-claude-nessuna-premi' })
  expect(await ui.find({ type: 'Text', text: '4 modifiche non salvate' })).toBeDefined()
  expect([amb.configure(), amb.toast]).toEqual([0, []])
  await ui.press({ key: 'applica' })
  expect(amb.configure()).toBe(1)
  expect(amb.progettoOra()).toMatchObject({ fornitori: ['claude', 'codex', 'deepseek'], profilo: 'personalizzato', soglie: { claude: null } })
  expect(amb.progettoOra().pesi).toContainEqual(MODELLO)
  expect(amb.toast).toEqual(['Salvato'])
  expect(await ui.find({ key: 'pendenti' })).toBeUndefined()
  await ui.unmount()
})

test('F5.9: «Annulla modifiche» lascia il config intatto; tornare alla lingua di adesso toglie la voce; bozza vuota = niente barra', async ($, on) => {
  const amb = ambiente(on)
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('terminal') })
  await ui.press({ key: 'impostazioni' })
  const prima = amb.disco.get(CONFIG)
  await ui.press({ key: 'fornitore-deepseek-premi' })
  await ui.press({ key: 'sezione-lingua-premi' })
  await ui.press({ key: 'lingua-de-premi' })
  expect(await ui.find({ type: 'Text', text: '2 modifiche non salvate' })).toBeDefined()
  await ui.press({ key: 'lingua-it-premi' })
  expect(await ui.find({ type: 'Text', text: '1 modifica non salvata' })).toBeDefined()
  await ui.press({ key: 'annulla-modifiche' })
  expect(await ui.find({ key: 'pendenti' })).toBeUndefined()
  expect(amb.disco.get(CONFIG)).toBe(prima)
  expect(amb.configure()).toBe(0)
  await ui.unmount()
})

test('F5.9: un campo della bozza cambiato altrove: niente scritto, popup; «Ricarica e riapplica» vince, «Scarta» lascia l\'altro', async ($, on) => {
  const amb = ambiente(on, { milestoneGithub: false })
  const clock = mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: 'impostazioni' })
  await ui.press({ key: 'sezione-soglie-premi' })
  // Riapplica: la soglia della bozza vince, il campo cambiato altrove e non toccato resta.
  await ui.press({ key: 'soglia-claude-nessuna-premi' })
  amb.disco.set(CONFIG, JSON.stringify({ progetti: { 'esempio/demo': { milestoneGithub: true, soglie: { claude: { attenzione: 50, critica: 60 } } } } }))
  amb.popup.risposta = () => 'Ricarica e riapplica la mia bozza'
  await ui.press({ key: 'applica' })
  expect(amb.domande.at(-1)).toBe('Un\'altra sessione ha cambiato Soglie dopo le tue modifiche. Non è stato scritto niente.')
  expect(amb.configure()).toBe(1)
  expect(amb.progettoOra()).toMatchObject({ milestoneGithub: true, soglie: { claude: null } })
  await clock.advance(20_000)
  // Scarta: niente scritto, la bozza se ne va, l'altro valore resta.
  await ui.press({ key: 'soglia-claude-70/90-premi' })
  amb.disco.set(CONFIG, JSON.stringify({ progetti: { 'esempio/demo': { soglie: { claude: { attenzione: 40, critica: 60 } } } } }))
  amb.popup.risposta = () => 'Scarta la mia bozza'
  await ui.press({ key: 'applica' })
  expect(amb.configure()).toBe(1)
  expect(amb.progettoOra()).toEqual({ soglie: { claude: { attenzione: 40, critica: 60 } } })
  expect(await ui.find({ key: 'pendenti' })).toBeUndefined()
  await clock.advance(20_000)
  // Un campo cambiato altrove ma non nella bozza non è un conflitto: si scrive il proprio, l'altro resta.
  await ui.press({ key: 'sezione-connessioni-premi' })
  await ui.press({ key: 'fornitore-deepseek-premi' })
  amb.disco.set(CONFIG, JSON.stringify({ progetti: { 'esempio/demo': { soglie: { claude: { attenzione: 40, critica: 60 } }, milestoneGithub: true } } }))
  const domande = amb.domande.length
  await ui.press({ key: 'applica' })
  expect(amb.domande.length).toBe(domande)
  expect(amb.progettoOra()).toMatchObject({ milestoneGithub: true, soglie: { claude: { attenzione: 40, critica: 60 } }, fornitori: ['claude', 'codex', 'deepseek'] })
  await ui.unmount()
})

test('F5.9: uscendo dalle Impostazioni con una bozza: Resta, Applica, oppure popup chiuso = si esce e la barra la ripropone', async ($, on) => {
  const amb = ambiente(on)
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: 'impostazioni' })
  await ui.press({ key: 'fornitore-deepseek-premi' })
  amb.popup.risposta = () => 'Resta'
  await ui.press({ key: 'vista-lavoro' })
  expect(amb.domande.at(-1)).toBe('1 modifica delle Impostazioni non è ancora salvata.')
  expect(await ui.find({ key: 'pagina-connessioni' })).toBeDefined()
  amb.popup.risposta = () => 'Applica'
  await ui.press({ key: 'vista-lavoro' })
  expect(amb.configure()).toBe(1)
  expect(amb.progettoOra().fornitori).toEqual(['claude', 'codex', 'deepseek'])
  expect(await ui.find({ key: 'pagina-connessioni' })).toBeUndefined()
  // Popup chiuso: si esce, la bozza resta e la barra la ripropone al ritorno; senza bozza nessun popup.
  await ui.press({ key: 'impostazioni' })
  await ui.press({ key: 'fornitore-deepseek-premi' })
  amb.popup.risposta = () => null
  await ui.press({ key: 'vista-carico' })
  expect(await ui.find({ key: 'pagina-connessioni' })).toBeUndefined()
  await ui.press({ key: 'impostazioni' })
  expect(await ui.find({ type: 'Text', text: '1 modifica non salvata' })).toBeDefined()
  await ui.press({ key: 'annulla-modifiche' })
  const domande = amb.domande.length
  await ui.press({ key: 'vista-lavoro' })
  expect(amb.domande.length).toBe(domande)
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
  await ui.press({ key: 'applica' })
  expect(amb.progettoOra().soglie).toMatchObject({ claude: { attenzione: 74, critica: 75 } })
  expect(String((await ui.find({ key: 'attenzione-claude-piu' }))?.props.label)).toBe('Aumenta Attenzione da (Claude), al massimo')
  // Un endpoint fuori da questo computer non si salva: la causa e il rimedio in linea.
  await ui.press({ key: 'sezione-avanzate-premi' })
  await ui.input({ key: 'free-endpoint', text: 'http://example.org/v1' })
  expect(await ui.find({ type: 'Text', text: /Endpoint solo su questo computer: http:\/\/localhost/ })).toBeDefined()
  expect(amb.progettoOra()).not.toHaveProperty('freellmapi')
  await ui.press({ key: 'sezione-soglie-premi' })
  // Una modifica concorrente dello stesso campo: niente scritto, il popup lo dice, e non c'è un secondo toast.
  await ui.press({ key: 'soglia-claude-nessuna-premi' })
  amb.disco.set(CONFIG, JSON.stringify({ progetti: { 'esempio/demo': { soloLocale: true } } }))
  amb.popup.risposta = () => 'Scarta la mia bozza'
  await ui.press({ key: 'applica' })
  expect(amb.progettoOra()).toEqual({ soloLocale: true })
  expect(amb.domande.at(-1)).toMatch(/ha cambiato Soglie/)
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

// Durante un Applica in volo la bozza è ferma (giro 4 della revisione): le corse dei giri 1–3 (una modifica, una lingua o
// «Annulla modifiche» arrivati mentre l'helper scrive) non sono più possibili. Un secondo pannello preme durante la scrittura.
test('congelamento: durante Applica un controllo, la lingua, «Annulla modifiche» e un secondo Applica non toccano la bozza e dicono «Salvataggio in corso…»', async ($, on) => {
  const amb = ambiente(on)
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  const altro = await $.ui.mount({ ...PANE('terminal') })
  await ui.press({ key: 'impostazioni' })
  await ui.press({ key: 'sezione-progetto-premi' })
  await ui.press({ key: 'rete-locale-premi' })
  const { arrivato, apri } = amb.trattieni()
  const applica = ui.press({ key: 'applica' })
  await arrivato
  expect(await altro.find({ type: 'Text', text: 'Salvataggio in corso…' })).toBeDefined()
  await altro.press({ key: 'milestone-github-premi' })
  await altro.press({ key: 'sezione-lingua-premi' })
  await altro.press({ key: 'lingua-de-premi' })
  await altro.press({ key: 'annulla-modifiche' })
  await altro.press({ key: 'applica' })
  expect(amb.toast).toEqual(Array(4).fill('Salvataggio in corso…'))
  apri()
  await applica
  expect(amb.configure()).toBe(1)
  expect(amb.progettoOra()).toEqual({ soloLocale: true })
  expect(JSON.parse(amb.disco.get(CONFIG)!).lingua).toBe('it')
  expect(await ui.find({ key: 'pendenti' })).toBeUndefined()
  expect(amb.toast.at(-1)).toBe('Salvato')
  // Finita la scrittura, i controlli tornano a scrivere nella bozza.
  await ui.press({ key: 'lingua-de-premi' })
  expect(await ui.find({ type: 'Text', text: '1 modifica non salvata' })).toBeDefined()
  await altro.unmount()
  await ui.unmount()
})

test('congelamento: i due casi del giro 4 (scelta della lingua durante la scrittura; Annulla durante la scrittura poi de→it→fr) non perdono niente', async ($, on) => {
  const amb = ambiente(on)
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  const altro = await $.ui.mount({ ...PANE('terminal') })
  await ui.press({ key: 'impostazioni' })
  await ui.press({ key: 'sezione-lingua-premi' })
  // Caso 1: de in bozza, Applica sospeso, si sceglie fr: ignorato e detto; si salva de, niente resta pendente in silenzio.
  await ui.press({ key: 'lingua-de-premi' })
  let cancello = amb.trattieni()
  let applica = ui.press({ key: 'applica' })
  await cancello.arrivato
  await altro.press({ key: 'lingua-fr-premi' })
  cancello.apri()
  await applica
  expect(JSON.parse(amb.disco.get(CONFIG)!).lingua).toBe('de')
  expect(await ui.find({ key: 'pendenti' })).toBeUndefined()
  expect(amb.toast).toEqual(['Salvataggio in corso…', 'Salvato'])
  // Caso 2: fr in bozza, Applica sospeso, «Annulla modifiche» ignorato; poi de→it→fr: l'ultima scelta resta.
  await ui.press({ key: 'lingua-fr-premi' })
  cancello = amb.trattieni()
  applica = ui.press({ key: 'applica' })
  await cancello.arrivato
  await altro.press({ key: 'annulla-modifiche' })
  cancello.apri()
  await applica
  expect(JSON.parse(amb.disco.get(CONFIG)!).lingua).toBe('fr')
  for (const l of ['de', 'it', 'fr']) await ui.press({ key: `lingua-${l}-premi` })
  expect(await ui.find({ key: 'pendenti' })).toBeUndefined()
  for (const l of ['de', 'it']) await ui.press({ key: `lingua-${l}-premi` })
  expect((await ui.find({ key: 'lingua-it-premi' }))?.props.variant).toBe('primary')
  await ui.press({ key: 'applica' })
  expect(JSON.parse(amb.disco.get(CONFIG)!).lingua).toBe('it')
  await altro.unmount()
  await ui.unmount()
})

test('giro 5, caso 1: «Scarta» nel popup d\'uscita arrivato mentre Applica è in volo non tocca la bozza; «Riapplica» poi scrive', async ($, on) => {
  const amb = ambiente(on)
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  const altro = await $.ui.mount({ ...PANE('terminal') })
  await ui.press({ key: 'impostazioni' })
  await ui.press({ key: 'sezione-soglie-premi' })
  await ui.press({ key: 'soglia-claude-nessuna-premi' })
  // L'altro pannello vuole uscire: il popup Applica / Scarta / Resta resta aperto.
  const uscita = amb.trattieniPopup(q => q.includes('non è ancora salvata'))
  const esce = altro.press({ key: 'vista-lavoro' })
  await uscita.arrivato
  // Questo pannello applica e trova un conflitto: il suo popup resta aperto, Applica è in volo.
  amb.disco.set(CONFIG, JSON.stringify({ progetti: { 'esempio/demo': { soglie: { claude: { attenzione: 50, critica: 60 } } } } }))
  const conflitto = amb.trattieniPopup(q => q.startsWith('Un\'altra sessione'))
  const applica = ui.press({ key: 'applica' })
  await conflitto.arrivato
  amb.popup.risposta = q => (q.includes('non è ancora salvata') ? 'Scarta' : 'Ricarica e riapplica la mia bozza')
  uscita.apri()
  await esce
  await finoA(() => amb.toast.includes('Salvataggio in corso…'))
  expect(amb.toast).toContain('Salvataggio in corso…')
  conflitto.apri()
  await applica
  expect(amb.configure()).toBe(1)
  expect(amb.progettoOra()).toMatchObject({ soglie: { claude: null } })
  expect(amb.toast.at(-1)).toBe('Salvato')
  await altro.unmount()
  await ui.unmount()
})

test('giro 5, caso 2: la scelta della lingua la cui lettura finisce dopo un Applica intero non si perde in silenzio', async ($, on) => {
  const amb = ambiente(on)
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  const altro = await $.ui.mount({ ...PANE('terminal') })
  await ui.press({ key: 'impostazioni' })
  await ui.press({ key: 'sezione-lingua-premi' })
  await ui.press({ key: 'lingua-de-premi' })
  // L'altro pannello sceglie it (la lingua salvata adesso); la sua lettura della lingua arriva dopo che Applica ha scritto de.
  const lettura = amb.trattieniLettura()
  const sceglie = altro.press({ key: 'lingua-it-premi' })
  await lettura.arrivato
  await ui.press({ key: 'applica' })
  expect(JSON.parse(amb.disco.get(CONFIG)!).lingua).toBe('de')
  lettura.apri()
  await sceglie
  // O la scelta resta pendente, o è rifiutata e lo si dice: mai de salvato con it perso in silenzio.
  const pendente = (await ui.find({ key: 'lingua-it-premi' }))?.props.variant === 'primary'
  // Rifiutata perché un Applica è passato mentre aspettava la lettura (giro 6: l'epoca della bozza è cambiata).
  const detto = amb.toast.includes('Salvataggio in corso…') || amb.toast.includes('Le impostazioni sono cambiate nel frattempo: non è stato fatto niente')
  expect(pendente || detto).toBe(true)
  await altro.unmount()
  await ui.unmount()
})

/** Ricarica del modulo con `$.state` conservato: finché il modulo nuovo non scrive, le Impostazioni valgono `valore`. */
function lasciato(on: On, valore: unknown) {
  on('state.get', { plugin: 'chip-manager', key: 'impostazioni' } as never, async (_$, e, next) => {
    // L'hook risponde { value: { value, version } }; l'atomo tiene il suo valore nella busta { shape, value }.
    const letto = (await next(e as never)) as { value: { value?: unknown; version: number } }
    return (letto.value.value === undefined ? { value: { ...letto.value, value: { shape: 'impostazioni-1', value: valore } } } : letto) as never
  })
}

test('giro 5, caso 3: ricarica del modulo con lo stato conservato: «applicando» rimasto vero si azzera; una bozza di forma vecchia si scarta e lo si dice', async ($, on) => {
  const amb = ambiente(on)
  mock.clock(on)
  // Lo stato che un modulo precedente ha lasciato: scrittura «in volo» e la bozza con `dove` come oggetto.
  lasciato(on, { sezione: 'connessioni', applicando: true, pendenti: { campi: { fornitori: ['claude', 'codex', 'deepseek'] }, base: {}, dove: { fornitori: ['fornitori'] } } })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  expect(amb.toast).toContain('La bozza precedente non era valida ed è stata scartata')
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: 'impostazioni' })
  expect(await ui.find({ type: 'Text', text: 'Salvataggio in corso…' })).toBeUndefined()
  expect(await ui.find({ key: 'pendenti' })).toBeUndefined()
  // I controlli scrivono di nuovo nella bozza e Applica scrive.
  await ui.press({ key: 'fornitore-deepseek-premi' })
  expect(await ui.find({ type: 'Text', text: '1 modifica non salvata' })).toBeDefined()
  await ui.press({ key: 'applica' })
  expect(amb.progettoOra().fornitori).toEqual(['claude', 'codex', 'deepseek'])
  await ui.unmount()
})

test('giro 5, caso 3: una bozza valida lasciata da un modulo precedente resta, solo «applicando» si azzera', async ($, on) => {
  const amb = ambiente(on)
  mock.clock(on)
  lasciato(on, { sezione: 'connessioni', applicando: true, pendenti: { campi: { soloLocale: true }, base: { soloLocale: false }, dove: ['rete'] } })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  expect(amb.toast).not.toContain('La bozza precedente non era valida ed è stata scartata')
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: 'impostazioni' })
  expect(await ui.find({ type: 'Text', text: '1 modifica non salvata' })).toBeDefined()
  await ui.press({ key: 'applica' })
  expect(amb.progettoOra()).toEqual({ soloLocale: true })
  await ui.unmount()
})

/** Un press torna quando onPress torna; l'uscita (popup e controlli) prosegue dopo: si aspetta il suo avviso. */
async function finoA(fatto: () => boolean) {
  const dorme = (globalThis as unknown as { setTimeout: (f: () => void, ms: number) => void }).setTimeout
  for (let i = 0; i < 400 && !fatto(); i++) await new Promise<void>(ok => dorme(ok, 5))
}

const SALDO = { id: 'saldo', fornitore: 'deepseek', nome: 'saldo mensile', letto: '2026-11-01T00:00:00Z', valore: 12, unita: 'USD' }

test('giro 6, B: i budget non stanno nella bozza: × scrive subito; un campo fuori schema è rifiutato o, da uno stato vecchio, scartato', async ($, on) => {
  expect(() => conPendente(undefined, RISORSE_DEFAULT, 'budget', { limitiManuali: [] })).toThrow()
  expect(pendentiDa({ campi: { limitiManuali: [], soloLocale: true }, base: { limitiManuali: [] }, dove: ['budget', 'rete'] }))
    .toEqual({ pendenti: { campi: { soloLocale: true }, base: {}, dove: ['budget', 'rete'] }, perso: true })
  const amb = ambiente(on, { fornitori: ['claude', 'codex', 'deepseek'], limitiManuali: [SALDO] })
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: 'impostazioni' })
  await ui.press({ key: 'sezione-progetto-premi' })
  await ui.press({ key: 'budget-manuale-saldo-via' })
  expect(amb.configure()).toBe(1)
  expect(amb.progettoOra().limitiManuali).toEqual([])
  expect(amb.toast).toEqual(['Salvato'])
  expect(await ui.find({ key: 'pendenti' })).toBeUndefined()
  await ui.unmount()
})

test('giro 6, B: un budget salvato mentre Applica parte (durante l\'aggiornamento delle risorse) resta, né cancellato né doppio', async ($, on) => {
  const amb = ambiente(on, { fornitori: ['claude', 'codex', 'deepseek'], limitiManuali: [SALDO] })
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  const altro = await $.ui.mount({ ...PANE('terminal') })
  await ui.press({ key: 'impostazioni' })
  await ui.press({ key: 'sezione-progetto-premi' })
  await ui.press({ key: 'milestone-github-premi' })
  await ui.press({ key: 'budget-manuale-saldo-via' })
  await ui.press({ key: 'aggiungi-budget' })
  await ui.press({ key: 'bozza-fornitore-claude-premi' })
  await ui.press({ key: 'bozza-tipo-settimanale-premi' })
  // Il budget si scrive; mentre le risorse si aggiornano, l'altro pannello applica la bozza.
  const limiti = amb.trattieniLimiti()
  const aggiunge = ui.input({ key: 'bozza-valore', text: '40%' })
  await limiti.arrivato
  await altro.press({ key: 'applica' })
  limiti.apri()
  await aggiunge
  const manuali = amb.progettoOra().limitiManuali as { fornitore: string; nome: string; percentuale?: number }[]
  expect(manuali.map(l => [l.fornitore, l.nome, l.percentuale])).toEqual([['claude', 'settimanale', 40]])
  expect(amb.progettoOra().milestoneGithub).toBe(true)
  await altro.unmount()
  await ui.unmount()
})

test('giro 6, D: un popup d\'uscita aperto prima di un Applica completo e di una nuova modifica non agisce sulla bozza nuova', async ($, on) => {
  const amb = ambiente(on)
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  const altro = await $.ui.mount({ ...PANE('terminal') })
  await ui.press({ key: 'impostazioni' })
  for (const risposta of ['Scarta', 'Applica']) {
    await ui.press({ key: 'fornitore-deepseek-premi' })
    // Il popup d'uscita si apre su questa bozza; la sua risposta arriva dopo un Applica completo e una nuova modifica.
    // (Un popup tenuto aperto tanto a lungo il kit lo rifiuta: si trattiene invece la lettura della bozza che lo precede.)
    const uscita = amb.trattieniPopup(q => q.includes('non è ancora salvata'))
    const esce = altro.press({ key: 'vista-lavoro' })
    await uscita.arrivato
    await ui.press({ key: 'applica' })
    // Una modifica nuova dopo l'Applica: il popup vecchio non la vede.
    await ui.press({ key: 'fornitore-deepseek-premi' })
    const scritture = amb.configure()
    amb.popup.risposta = () => risposta
    const avvisi = amb.toast.length
    uscita.apri()
    await esce
    await finoA(() => amb.toast.length > avvisi)
    expect([risposta, amb.toast.at(-1)]).toEqual([risposta, 'Le impostazioni sono cambiate nel frattempo: non è stato fatto niente'])
    expect([risposta, amb.configure()]).toEqual([risposta, scritture])
    expect(await ui.find({ type: 'Text', text: '1 modifica non salvata' })).toBeDefined()
    expect(await ui.find({ key: 'pagina-connessioni' })).toBeDefined()
    await ui.press({ key: 'annulla-modifiche' })
    // La bozza torna vuota: si riparte dai fornitori scritti.
    await ui.press({ key: 'fornitore-deepseek-premi' })
    await ui.press({ key: 'applica' })
  }
  await altro.unmount()
  await ui.unmount()
})

test('giro 6, C: il popup d\'uscita che fallisce mentre un Applica è in volo non fa uscire: si resta, con «Salvataggio in corso…»', async ($, on) => {
  const amb = ambiente(on)
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  const altro = await $.ui.mount({ ...PANE('terminal') })
  await ui.press({ key: 'impostazioni' })
  await ui.press({ key: 'fornitore-deepseek-premi' })
  const uscita = amb.trattieniPopup(q => q.includes('non è ancora salvata'))
  const esce = altro.press({ key: 'vista-lavoro' })
  await uscita.arrivato
  const scrittura = amb.trattieni()
  const applica = ui.press({ key: 'applica' })
  await scrittura.arrivato
  amb.popup.risposta = () => null
  uscita.apri()
  await esce
  await finoA(() => amb.toast.includes('Salvataggio in corso…'))
  expect(amb.toast).toContain('Salvataggio in corso…')
  expect(await ui.find({ key: 'pagina-connessioni' })).toBeDefined()
  scrittura.apri()
  await applica
  expect(amb.progettoOra().fornitori).toEqual(['claude', 'codex', 'deepseek'])
  await altro.unmount()
  await ui.unmount()
})

test('giro 6, B: profilo e pesi scritti da una proposta mentre la bozza li tocca: «Riapplica» non li sovrascrive, escono dalla bozza', async ($, on) => {
  const amb = ambiente(on, { pesi: [MODELLO] })
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: 'impostazioni' })
  await ui.press({ key: 'sezione-bilanciamento-premi' })
  await ui.press({ key: 'profilo-risparmio-premi' })
  const proposta = { profilo: 'qualita', pesi: conProfilo([MODELLO], 'qualita'), pesiRevisione: 3, pesiOrigine: { tipo: 'proposta', id: 'p-esempio01', versione: 1 } }
  amb.disco.set(CONFIG, JSON.stringify({ lingua: 'it', progetti: { 'esempio/demo': proposta } }))
  amb.popup.risposta = () => 'Ricarica e riapplica la mia bozza'
  await ui.press({ key: 'applica' })
  expect(amb.domande.at(-1)).toMatch(/ha cambiato Bilanciamento/)
  expect(amb.toast).toContain('I pesi sono stati cambiati da una proposta applicata: restano così ed escono dalla tua bozza')
  expect(amb.configure()).toBe(0)
  expect(amb.progettoOra()).toEqual(proposta)
  expect(await ui.find({ key: 'pendenti' })).toBeUndefined()
  await ui.unmount()
})

test('giro 7, 1: Personalizzato → bozza Risparmio → una proposta cambia solo i pesi → Riapplica: profilo e pesi escono insieme', async ($, on) => {
  const amb = ambiente(on, { profilo: 'personalizzato', pesi: [MODELLO] })
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: 'impostazioni' })
  await ui.press({ key: 'sezione-bilanciamento-premi' })
  await ui.press({ key: 'profilo-risparmio-premi' })
  // La proposta applicata altrove tocca solo i pesi: il profilo resta «personalizzato».
  const proposta = { profilo: 'personalizzato', pesi: [MODELLO, { tipo: 'effort', nome: 'low', percentuale: 40, assoluto: 0 }], pesiRevisione: 2, pesiOrigine: { tipo: 'proposta', id: 'p-esempio01', versione: 1 } }
  amb.disco.set(CONFIG, JSON.stringify({ lingua: 'it', progetti: { 'esempio/demo': proposta } }))
  amb.popup.risposta = () => 'Ricarica e riapplica la mia bozza'
  await ui.press({ key: 'applica' })
  expect(amb.toast).toContain('I pesi sono stati cambiati da una proposta applicata: restano così ed escono dalla tua bozza')
  expect(amb.configure()).toBe(0)
  expect(amb.progettoOra()).toEqual(proposta)
  expect(await ui.find({ key: 'pendenti' })).toBeUndefined()
  await ui.unmount()
})

test('giro 7, 2: Applica dal pulsante con la lettura iniziale sospesa: una modifica arrivata intanto non entra nella scrittura', async ($, on) => {
  const amb = ambiente(on)
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  const altro = await $.ui.mount({ ...PANE('terminal') })
  await ui.press({ key: 'impostazioni' })
  await ui.press({ key: 'fornitore-deepseek-premi' })
  await ui.find({ key: 'pendenti' })
  await altro.find({ key: 'pendenti' })
  // La lettura dello stato con cui Applica comincia arriva tardi; intanto l'altro pannello tocca un altro controllo.
  const lettura = amb.trattieniLettura('impostazioni')
  const applica = ui.press({ key: 'applica' })
  await lettura.arrivato
  await altro.press({ key: 'sezione-progetto-premi' })
  await altro.press({ key: 'milestone-github-premi' })
  lettura.apri()
  await applica
  await finoA(() => amb.toast.includes('Salvato') || amb.toast.includes('Le impostazioni sono cambiate nel frattempo: non è stato fatto niente'))
  // Si scrive solo la bozza mostrata alla pressione: la modifica arrivata dopo è rifiutata e detta, o resta pendente.
  expect(amb.progettoOra().milestoneGithub).toBeUndefined()
  expect(amb.toast.some(t => t === 'Salvataggio in corso…' || t === 'Le impostazioni sono cambiate nel frattempo: non è stato fatto niente')).toBe(true)
  await altro.unmount()
  await ui.unmount()
})

test('F6.6 Esecuzione: la chiave solo come presenza (mai popup, bozza o JSON); budget, tetto e consigliere passano per bozza e Applica', { options: { anthropicApiKey: 'sk-ant-sentinella-0123' } }, async ($, on) => {
  const amb = ambiente(on)
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: 'impostazioni' })
  await ui.press({ key: 'sezione-esecuzione-premi' })
  expect(await ui.find({ type: 'Text', text: /Chiave impostata nelle opzioni sensibili della mod$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^Usa una chiave creata solo per la mod, .*La mod non può verificarlo\.$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /questo non revoca la chiave\. Se pensi che la chiave sia stata copiata, revocala dalla Console/ })).toBeDefined()
  expect(await ui.find({ key: 'ese-tetto' })).toBeUndefined()
  const prima = amb.disco.get(CONFIG)
  await ui.input({ key: 'ese-budget', text: '15' })
  await ui.press({ key: 'consigliere-suggerisci-premi' })
  expect(await ui.find({ type: 'Text', text: '2 modifiche non salvate' })).toBeDefined()
  expect(amb.disco.get(CONFIG)).toBe(prima)
  await ui.press({ key: 'applica' })
  expect(amb.progettoOra()).toMatchObject({ apiClaude: { budgetUsd: 15, tetto: 2 }, consigliere: 'suggerisci' })
  // Il tetto non supera il budget; un valore fuori misura resta in linea, senza bozza.
  await ui.input({ key: 'ese-tetto', text: '30' })
  expect(await ui.find({ type: 'Text', text: /Scrivi un numero da 0,01 a 15$/ })).toBeDefined()
  await ui.input({ key: 'ese-tetto', text: '3' })
  await ui.press({ key: 'applica' })
  expect(amb.progettoOra()).toMatchObject({ apiClaude: { budgetUsd: 15, tetto: 3 } })
  await ui.press({ key: 'ese-api-togli' })
  await ui.press({ key: 'consigliere-spento-premi' })
  await ui.press({ key: 'applica' })
  expect(amb.progettoOra()).toMatchObject({ apiClaude: null, consigliere: null })
  // La chiave non passa mai di qui: nessun popup, nessun valore nel config.
  expect(amb.domande).toEqual([])
  expect(amb.disco.get(CONFIG)).not.toContain('sentinella')
  await ui.unmount()
})

test('F6.6 Esecuzione: senza chiave lo dice; senza remote GitHub il cloud non è disponibile', async ($, on) => {
  ambiente(on)
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('terminal') })
  await ui.press({ key: 'impostazioni' })
  await ui.press({ key: 'sezione-esecuzione-premi' })
  expect(await ui.find({ type: 'Text', text: /Nessuna chiave impostata$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Il progetto è su GitHub: il cloud parte dal ramo pubblicato$/ })).toBeDefined()
  await ui.unmount()
})

test('rilievo 3: un conflitto CAS dopo il controllo preliminare (codice 4) apre lo stesso popup; «Ricarica e riapplica» scrive', async ($, on) => {
  const amb = ambiente(on)
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: 'impostazioni' })
  await ui.press({ key: 'sezione-soglie-premi' })
  await ui.press({ key: 'soglia-claude-nessuna-premi' })
  // Un'altra sessione scrive le soglie fra la rilettura di Applica e il CAS dell'helper.
  amb.hook.primaDiConfigura = () => amb.disco.set(CONFIG, JSON.stringify({ progetti: { 'esempio/demo': { milestoneGithub: true, soglie: { claude: { attenzione: 50, critica: 60 } } } } }))
  amb.popup.risposta = () => 'Ricarica e riapplica la mia bozza'
  await ui.press({ key: 'applica' })
  expect(amb.domande.at(-1)).toBe('Un\'altra sessione ha cambiato Soglie dopo le tue modifiche. Non è stato scritto niente.')
  expect(amb.progettoOra()).toMatchObject({ milestoneGithub: true, soglie: { claude: null } })
  expect(await ui.find({ key: 'pendenti' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /cambiate altrove/ })).toBeUndefined()
  await ui.unmount()
})

test('rilievo 4: progetto scritto e lingua rifiutata: lo dice, e in bozza resta solo la lingua', async ($, on) => {
  const amb = ambiente(on)
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: 'impostazioni' })
  await ui.press({ key: 'fornitore-deepseek-premi' })
  await ui.press({ key: 'sezione-lingua-premi' })
  await ui.press({ key: 'lingua-de-premi' })
  amb.hook.rifiutaUtente = true
  await ui.press({ key: 'applica' })
  expect(amb.progettoOra().fornitori).toEqual(['claude', 'codex', 'deepseek'])
  expect(JSON.parse(amb.disco.get(CONFIG)!).lingua).toBe('it')
  expect(await ui.find({ type: 'Text', text: /Impostazioni del progetto salvate; la lingua non è stata salvata: / })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '1 modifica non salvata' })).toBeDefined()
  await ui.press({ key: 'applica' })
  expect(JSON.parse(amb.disco.get(CONFIG)!).lingua).toBe('de')
  expect(amb.configure()).toBe(1)
  await ui.unmount()
})

test('rilievo 7: la simulazione usa la bozza: solo rete locale in bozza = nessuna combinazione e il motivo', async ($, on) => {
  ambiente(on)
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: 'impostazioni' })
  await ui.press({ key: 'sezione-progetto-premi' })
  await ui.press({ key: 'rete-locale-premi' })
  await ui.press({ key: 'sezione-bilanciamento-premi' })
  expect(await ui.find({ type: 'Text', text: /Simulazione: nessuna combinazione avviabile con queste regole/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /progetto solo rete locale/ })).toBeDefined()
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

// --- F6.7: configurazione di Esecuzione dalla mod ---------------------------------------------------------------

const ESEC_OK = { claude: { trovato: true, loggedIn: true, metodo: 'claude.ai' }, github: { trovato: true, loggedIn: true, remote: true, host: 'github.com' }, fonti: [] }
const FILE_PROGETTO = 'X:/repo/.claude/settings.json'

test('F6.7 stato: righe ✓/✗ calcolate dall\'helper; email, organizzazione e utente non arrivano mai al pannello', async ($, on) => {
  const amb = ambiente(on)
  // Un helper che sbagliasse e facesse uscire dati dell'account: il pannello rilegge campo per campo e li scarta.
  amb.esec.stato = () => JSON.stringify({
    claude: { trovato: true, loggedIn: false, email: 'persona@esempio.it', orgName: 'Ditta Segreta' },
    github: { trovato: true, loggedIn: false, remote: false, host: 'gitlab.example.org', utente: 'utente-segreto' },
    fonti: [{ nome: 'progetto', file: FILE_PROGETTO }, { nome: 'ambiente' }],
    account: { email: 'persona@esempio.it' },
  })
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: 'impostazioni' })
  await ui.press({ key: 'sezione-esecuzione-premi' })
  await finoA(() => amb.esec.controlli > 0)
  await ui.press({ key: 'ese-ricontrolla' })
  for (const t of ['Accesso a Claude non fatto', 'GitHub non collegato', 'Nessuna chiave impostata', '2 fonti di impostazioni bloccano le esecuzioni API', 'Budget del mese non impostato'])
    expect([t, await ui.find({ type: 'Text', text: new RegExp(`${t}$`) })]).toEqual([t, expect.anything()])
  expect(await ui.find({ type: 'Text', text: /^Impostazioni del progetto: un'impostazione cambia chi paga/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^ANTHROPIC_API_KEY è impostata nell'ambiente/ })).toBeDefined()
  for (const k of ['ese-accedi-claude', 'ese-accedi-gh', 'ese-chiave-vai', 'ese-fonte-progetto-apri', 'ese-guida']) expect([k, await ui.find({ key: k })]).toEqual([k, expect.anything()])
  const disegno = JSON.stringify(await ui.drawn())
  for (const segreto of ['persona@esempio.it', 'Ditta Segreta', 'utente-segreto']) expect([segreto, disegno.includes(segreto)]).toEqual([segreto, false])
  // Tutto a posto: solo ✓, nessuna azione, il metodo di accesso (mai l'account).
  amb.esec.stato = () => JSON.stringify(ESEC_OK)
  await ui.press({ key: 'ese-ricontrolla' })
  expect(await ui.find({ type: 'Text', text: /Accesso a Claude fatto · claude\.ai$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /GitHub collegato e progetto su github\.com$/ })).toBeDefined()
  expect(await ui.find({ key: 'ese-accedi-claude' })).toBeUndefined()
  // Il controllo non riesce: lo dice, senza inventare uno stato.
  amb.esec.stato = () => null
  await ui.press({ key: 'ese-ricontrolla' })
  expect(await ui.find({ type: 'Text', text: /Non si è potuto controllare lo stato/ })).toBeDefined()
  await ui.unmount()
})

test('F6.7 Accedi: un solo login per clic; ricontrollo ogni 5 s che si ferma a login fatto, a 3 minuti o lasciando la sezione', async ($, on) => {
  const amb = ambiente(on)
  let fatto = false
  amb.esec.stato = () => JSON.stringify({ ...ESEC_OK, claude: { trovato: true, loggedIn: fatto }, github: { trovato: true, loggedIn: false, remote: true, host: 'github.com' } })
  const clock = mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: 'impostazioni' })
  await ui.press({ key: 'sezione-esecuzione-premi' })
  await finoA(() => amb.esec.controlli > 0)
  await ui.press({ key: 'ese-ricontrolla' })
  const avanti = async (ms: number) => {
    for (let t = 0; t < ms; t += 5000) await clock.advance(5000)
  }
  // Claude: un processo; il pulsante lascia il posto all'attesa; il ricontrollo si ferma appena l'accesso c'è.
  await ui.press({ key: 'ese-accedi-claude' })
  expect(amb.esec.accessi).toEqual(['claude'])
  expect(await ui.find({ key: 'ese-accedi-claude' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /^Completa l'accesso nel browser/ })).toBeDefined()
  let prima = amb.esec.controlli
  await avanti(10_000)
  expect(amb.esec.controlli - prima).toBe(2)
  fatto = true
  await avanti(5000)
  prima = amb.esec.controlli
  await avanti(30_000)
  expect(amb.esec.controlli).toBe(prima)
  expect(await ui.find({ type: 'Text', text: /Accesso a Claude fatto$/ })).toBeDefined()
  // GitHub: il codice monouso si mostra; senza login il ricontrollo si ferma dopo 3 minuti.
  amb.esec.accedi = () => [0, '{"codice":"AB12-CD34"}']
  await ui.press({ key: 'ese-accedi-gh' })
  expect(await ui.find({ type: 'Text', text: 'Codice da inserire su GitHub: AB12-CD34' })).toBeDefined()
  prima = amb.esec.controlli
  await avanti(200_000)
  expect(amb.esec.controlli - prima).toBeLessThanOrEqual(36)
  prima = amb.esec.controlli
  await avanti(30_000)
  expect(amb.esec.controlli).toBe(prima)
  expect(await ui.find({ key: 'ese-accedi-gh' })).toBeDefined()
  // Lasciando la sezione il ricontrollo si ferma al battito dopo; un login già in corso altrove non ne avvia un altro.
  await ui.press({ key: 'ese-accedi-gh' })
  await ui.press({ key: 'sezione-lingua-premi' })
  await avanti(5000)
  prima = amb.esec.controlli
  await avanti(60_000)
  expect(amb.esec.controlli).toBe(prima)
  amb.esec.accedi = () => [3, '']
  await ui.press({ key: 'sezione-esecuzione-premi' })
  await ui.press({ key: 'ese-accedi-gh' })
  expect(amb.toast.at(-1)).toBe('Un accesso è già in corso: completalo nel browser')
  expect(amb.esec.accessi).toEqual(['claude', 'gh', 'gh', 'gh'])
  await ui.unmount()
})

test('F6.7 Copia: se il login non parte la riga si copia; la chiave apre /config; «Apri il file» non scrive niente', async ($, on) => {
  const amb = ambiente(on)
  amb.esec.stato = () => JSON.stringify({ ...ESEC_OK, claude: { trovato: true, loggedIn: false }, fonti: [{ nome: 'progetto', file: FILE_PROGETTO }] })
  amb.esec.accedi = () => [1, '{"copia":"altro testo"}']
  const copiati: string[] = []
  on('ui.copy', (_, e) => (copiati.push(e.text), { value: { isCopied: true } as never }))
  const comandi: string[] = []
  on('command.run', (_, e) => (comandi.push(e.command), { text: '' }))
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: 'impostazioni' })
  await ui.press({ key: 'sezione-esecuzione-premi' })
  await finoA(() => amb.esec.controlli > 0)
  await ui.press({ key: 'ese-ricontrolla' })
  await ui.press({ key: 'ese-accedi-claude' })
  // La riga è quella fissa della mod, mai il testo arrivato dal processo.
  expect(await ui.find({ type: 'Text', text: 'claude auth login' })).toBeDefined()
  await ui.press({ key: 'ese-copia-premi' })
  expect(copiati).toEqual(['claude auth login'])
  expect(amb.toast.at(-1)).toBe('Riga copiata')
  await ui.press({ key: 'ese-chiave-vai' })
  expect(comandi).toEqual(['config'])
  expect(await ui.find({ type: 'Text', text: /^In \/config apri chip-manager e incolla la chiave in «Anthropic API \(credits\)»/ })).toBeDefined()
  const prima = amb.disco.get(FILE_PROGETTO)
  await ui.press({ key: 'ese-fonte-progetto-apri' })
  expect(amb.processi.filter(p => p[0] === 'xdg-open')).toEqual([['xdg-open', FILE_PROGETTO]])
  expect(amb.disco.get(FILE_PROGETTO)).toBe(prima)
  await ui.unmount()
})

test('F6.7 procedura guidata: i passi mancanti uno alla volta, ognuno si salta; si chiude da sola quando tutto è ✓', { options: { anthropicApiKey: 'sk-ant-prova' } }, async ($, on) => {
  const amb = ambiente(on, { apiClaude: { budgetUsd: 20, tetto: 2 } })
  let fatto = false
  amb.esec.stato = () => JSON.stringify({ ...ESEC_OK, claude: { trovato: true, loggedIn: fatto }, github: { trovato: true, loggedIn: false, remote: true } })
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: 'impostazioni' })
  await ui.press({ key: 'sezione-esecuzione-premi' })
  await finoA(() => amb.esec.controlli > 0)
  await ui.press({ key: 'ese-ricontrolla' })
  await ui.press({ key: 'ese-guida' })
  expect(await ui.find({ type: 'Text', text: 'Configura Esecuzione · passo 1 di 2' })).toBeDefined()
  expect(await ui.find({ key: 'guida-accedi-claude' })).toBeDefined()
  // Le azioni stanno nella procedura, non due volte.
  expect(await ui.find({ key: 'ese-accedi-claude' })).toBeUndefined()
  await ui.press({ key: 'guida-salta' })
  expect(await ui.find({ type: 'Text', text: 'Configura Esecuzione · passo 2 di 2' })).toBeDefined()
  expect(await ui.find({ key: 'guida-accedi-gh' })).toBeDefined()
  await ui.press({ key: 'guida-chiudi' })
  expect(await ui.find({ key: 'ese-guida-passo' })).toBeUndefined()
  // Riaperta, riparte dal primo; quando l'ultimo mancante diventa ✓ la procedura si chiude e lo dice.
  await ui.press({ key: 'ese-guida' })
  expect(await ui.find({ key: 'guida-accedi-claude' })).toBeDefined()
  amb.esec.stato = () => JSON.stringify({ ...ESEC_OK, claude: { trovato: true, loggedIn: fatto } })
  fatto = true
  await ui.press({ key: 'ese-ricontrolla' })
  await finoA(() => amb.toast.includes('Esecuzione configurata: tutto pronto') || amb.toast.length > 50)
  expect(await ui.find({ key: 'ese-guida-passo' })).toBeUndefined()
  await ui.unmount()
})
