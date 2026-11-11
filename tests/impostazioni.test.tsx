import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import {
  applicaPatch,
  budgetDa,
  campiDaProposta,
  valoreConfig,
  conPendente,
  propostaImpostazioniDa,
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
import { bilancia, progettoDa, regoleDa, REGOLE_DEFAULT, risorseDa, RISORSE_DEFAULT, violazioniAvvio } from '../hooks/logica'
import { campoRegoleMancante, regoleIniziali, testoRegoleIniziali } from '../hooks/regole-iniziali'
import { LEGENDA, LINGUE, t } from '../hooks/lingua'
import { PAGINE_AIUTO, urlAiuto } from '../hooks/aiuto'
import { ACCENTO, ALFA_VELO, GRIGIO, VELO } from '../hooks/tema'
import { MAX_URL, rapportoRedatto, urlRapporto } from '../hooks/rapporto'
import { usoDesktop } from '../hooks/risorse'
import type { Azione, Chiamante, Peso } from '../types'
import { DiscoIt } from './disco-it'
// F13.5: per le prove di sola CPU (orologio finto, molti render) che da sole superano metà dei 5 s del kit e sotto carico
// li passano: il tempo serve davvero. Il valore non cambia nessuna attesa delle prove, solo il tetto del kit.
const LUNGA = { timeoutMs: 20_000 }

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
function ambiente(on: On, progetto: Record<string, unknown> = {}, account?: Record<string, unknown>) {
  const disco = new DiscoIt()
  /** F10: le cartelle che `fs.stat` dice link (una junction). */
  const collegati = new Set<string>()
  /** F10: variabili d'ambiente in più, lette da `env.get`. */
  const variabili: Record<string, string> = {}
  const toast: string[] = []
  const processi: string[][] = []
  let proposteFatte = 0
  const domande: string[] = []
  /** F6.7: l'uscita di `stato-esecuzione` (null = l'helper fallisce) e l'esito di `accedi`; si contano entrambi. */
  const esec = {
    stato: (): string | null => JSON.stringify({ claude: { trovato: true, loggedIn: true }, github: { trovato: true, loggedIn: true, remote: true, host: 'github.com' }, fonti: [] }),
    /** F11.3: l'uscita di `diagnosi` (null = l'helper fallisce) e gli esiti dei rimedi. */
    diagnosi: (): string | null => JSON.stringify({ trovati: [], versione: '2.2.0' }),
    ripristina: (_stdin: string): [number, string] => [0, '{"copia":1}'],
    /** Gli stdin ricevuti da `sposta-dati`. */
    spostati: [] as string[],
    /** I link che `sposta-dati` dice di aver saltato. */
    saltati: [] as string[],
    accedi: (_tipo: string): [number, string] => [0, '{}'],
    /** Le fonti di impostazioni dell'host (`$.settings.read`); null = non si legge. */
    impostazioni: (_source: string): unknown => ({}),
    /** La prossima risposta di `stato-esecuzione` resta sospesa finché questa promessa non dà il testo. */
    sospesa: undefined as Promise<string> | undefined,
    controlli: 0,
    accessi: [] as string[],
  }
  /** Risposta al popup: una stringa, oppure `null` = popup chiuso (`$.ui.ask` rifiuta). */
  const popup = { risposta: (_: string): string | null => null }
  /**
   * Concorrenza: `primaDiConfigura` gira una volta appena prima del CAS dell'helper; `rifiutaUtente` fa fallire un
   * configura-utente; `trattieni()` ferma la prossima scrittura (configura o configura-utente) finché il test non la apre.
   */
  const hook: { primaDiConfigura?: () => void; primaDiUtente?: () => void; rifiutaUtente?: boolean; cancello?: { attesa: Promise<void>; segnala: () => void }; nonPrendere?: boolean } = {}
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
  disco.set(CONFIG, JSON.stringify({ ...(account && { account }), progetti: { 'esempio/demo': progetto } }))
  on('env.get', (_, e) => ({ value: variabili[e.name] ?? (e.name === 'CHIPMANAGER_DIR' ? 'X:/dati' : e.name === 'USERPROFILE' ? 'X:/casa' : undefined) }))
  on('session.id', () => ({ value: 'sessione-esempio' }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('tool.list', () => ({ value: [{ name: 'mcp__ccd_session__start_session' }] as never }))
  on('session.repo', () => ({ value: { root: 'X:/repo', remote: 'https://github.com/esempio/demo.git', internal: false, repo: null } as never }))
  on('fs.exists', (_, e) => ({ value: [...disco.keys()].some(k => k === p(e.path) || k.startsWith(`${p(e.path)}/`)) }))
  // F10: come l'host, anche le cartelle (prefisso di un file) e la radice del disco; `realPath` è il percorso stesso.
  on('fs.stat', (_, e) => {
    const q = p(e.path).replace(/\/+$/, '')
    const t = disco.get(q)
    const cartella = t === undefined && (/^[A-Za-z]:$/.test(q) || [...disco.keys()].some(k => k.startsWith(`${q}/`)))
    if (t === undefined && !cartella) throw new Error('ENOENT')
    return { value: { kind: cartella ? 'dir' as const : 'file' as const, size: t?.length ?? 0, mtimeMs: 0, isLink: collegati.has(q), ...(e.resolve && { realPath: q }) } }
  })
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
    // Like strumenti/regole-crea.cjs: exclusive creation, refused through a link (`collegati`); the real one is tested in prova-disco.
    if (script?.endsWith('/regole-crea.cjs')) {
      const x = JSON.parse(String(e.init?.stdin ?? '{}')) as { root: string; relativo: string; testo: string }
      const f = `${p(x.root)}/${x.relativo}`
      if ([...collegati].some(l => f.startsWith(`${l}/`))) return fine(6)
      if (disco.has(f)) return fine(4)
      disco.set(f, x.testo)
      return fine(0)
    }
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
        // Come l'helper vero: CAS sul testo intero, poi fusione dei campi nella sezione del progetto, dell'account nella
        // radice `account` e la lingua, in una sola scrittura (F10); null toglie il campo.
        const altra = hook.primaDiConfigura
        hook.primaDiConfigura = undefined
        altra?.()
        const input = JSON.parse(e.init!.stdin!)
        const prima = disco.get(p(file)) ?? null
        if (prima !== input.atteso) return fine(4)
        const c = prima === null ? {} : JSON.parse(prima)
        // Come l'helper vero: la stessa fusione (gemello TS di applicaPatch), che non perde campi né null non nominati.
        disco.set(p(file), JSON.stringify({ ...c, progetti: { ...c.progetti, [input.repo]: applicaPatch(c.progetti?.[input.repo] ?? {}, input.campi, input.togli?.progetto) },
          ...(input.account && { account: applicaPatch(c.account ?? {}, input.account, input.togli?.account) }), ...(input.lingua !== undefined && { lingua: input.lingua }) }))
        return fine(0)
      }) as never
    if (cmd === 'configura-utente')
      return scrittura(() => {
        // Come l'helper vero: stesso CAS, solo campi dell'utente al primo livello.
        const altra = hook.primaDiUtente
        hook.primaDiUtente = undefined
        altra?.()
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
    // F7.1: il file delle proposte di impostazioni, come l'helper: una per progetto, presa una volta sola.
    const filePI = 'X:/casa/.claude/chipmanager/proposte-impostazioni.json'
    if (cmd === 'impostazioni-proponi') {
      const q = JSON.parse(e.init!.stdin!) as { repo: string; proponente: unknown; proposta: unknown }
      const P = JSON.parse(disco.get(filePI) ?? '{"versione":0,"voci":{}}') as { versione: number; voci: Record<string, unknown> }
      if (P.voci[q.repo]) return fine(4, 'another settings proposal for this project is already waiting for the owner')
      const id = `i-prova${String(++proposteFatte).padStart(3, '0')}`
      P.voci[q.repo] = { id, quando: new Date().toISOString(), proponente: q.proponente, proposta: q.proposta }
      disco.set(filePI, JSON.stringify({ versione: P.versione + 1, voci: P.voci }))
      return fine(0, JSON.stringify({ id }))
    }
    if (cmd === 'impostazioni-prendi') {
      const [repo, id] = [e.argv[4], e.argv[5]]
      const P = JSON.parse(disco.get(filePI) ?? '{"versione":0,"voci":{}}') as { versione: number; voci: Record<string, { id: string }> }
      const v = P.voci[repo!]
      if (hook.nonPrendere || !v || v.id !== id) return fine(4, 'proposal no longer there')
      delete P.voci[repo!]
      disco.set(filePI, JSON.stringify({ versione: P.versione + 1, voci: P.voci }))
      return fine(0, JSON.stringify(v))
    }
    if (cmd === 'stato-esecuzione') {
      esec.controlli++
      const sospesa = esec.sospesa
      esec.sospesa = undefined
      if (sospesa) return sospesa.then(t => fine(0, t)) as never
      const t = esec.stato()
      return t === null ? fine(2) : fine(0, t)
    }
    if (cmd === 'diagnosi') {
      const t = esec.diagnosi()
      return t === null ? fine(1) : fine(0, t)
    }
    if (cmd === 'ripristina-config') return fine(...esec.ripristina(String(e.init?.stdin ?? '')))
    if (cmd === 'archivia-registro') return fine(0, '{"archiviato":true}')
    if (cmd === 'sposta-dati') {
      esec.spostati.push(String(e.init?.stdin ?? ''))
      // Like the helper: unless the confirmed names are exactly the skipped set, the config does not change and the names come back.
      const accettati = new Set((JSON.parse(String(e.init?.stdin ?? '{}')) as { accettaSaltati?: string[] }).accettaSaltati ?? [])
      if (accettati.size !== new Set(esec.saltati).size || esec.saltati.some(x => !accettati.has(x)))
        return fine(4, JSON.stringify({ saltati: esec.saltati }))
      return fine(0, JSON.stringify({ da: e.argv[5], a: e.argv[6], copiati: 3, saltati: esec.saltati }))
    }
    if (cmd === 'apri-url') return fine(0)
    if (cmd === 'segnala-gh') return fine(0, '{"url":"https://github.com/Elite9400/chipManager/issues/1"}')
    if (cmd === 'accedi') {
      esec.accessi.push(String(file))
      return fine(...esec.accedi(String(file)))
    }
    return fine(cmd === 'occupata' ? 0 : 2)
  })
  on('settings.read', (_, e) => {
    const v = esec.impostazioni(String((e as { source?: string }).source))
    if (v === null) throw new Error('non leggibile')
    return { value: v as never }
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
  /** F10: lo strato Account, nella radice del config (assente = undefined). */
  const accountOra = () => JSON.parse(disco.get(CONFIG)!).account as Record<string, unknown> | undefined
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
  return { disco, collegati, variabili, toast, domande, popup, progettoOra, accountOra, configure, hook, trattieni, trattieniPopup, trattieniLettura, trattieniLimiti, esec, processi }
}

const PANE = (surface: 'desktop' | 'terminal', bodyColumns = 90) =>
  ({
    plugin: 'chip-manager',
    surface,
    component: 'Pane',
    requestId: 'chipManager',
    props: { title: 'chipManager', isFocused: false, bodyColumns, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} },
  }) as const
const SEZIONI = ['connessioni', 'soglie', 'modo', 'bilanciamento', 'progetto', 'board', 'avanzate', 'esecuzione', 'lingua', 'legenda'] as const

test('F11.1 Modo di lavoro: «Tutti i progetti» e «Questo progetto» scrivono i due strati con un solo Applica; R4/R5 mai sotto high', LUNGA, async ($, on) => {
  const amb = ambiente(on)
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: 'impostazioni' })
  await ui.press({ key: 'sezione-modo-premi' })
  expect((await ui.find({ key: 'modo-effort-R0-medium-premi' }))?.props).toMatchObject({ variant: 'primary' })
  expect((await ui.find({ key: 'modo-codex-workspace-write-premi' }))?.props).toMatchObject({ variant: 'primary' })
  expect([await ui.find({ key: 'modo-effort-R4-low-premi' }), await ui.find({ key: 'modo-effort-R5-medium-premi' })]).toEqual([undefined, undefined])
  await ui.press({ key: 'modo-effort-R0-low-premi' })
  await ui.press({ key: 'modo-codex-read-only-premi' })
  // Il progetto eredita dall'account finché non sceglie: R0 a low anche qui.
  await ui.press({ key: 'modo-ambito-progetto-premi' })
  expect((await ui.find({ key: 'modo-effort-R0-low-premi' }))?.props).toMatchObject({ variant: 'primary' })
  await ui.press({ key: 'modo-parallelo-2-premi' })
  await ui.press({ key: 'modo-incrociata-no-premi' })
  expect(amb.configure()).toBe(0)
  await ui.press({ key: 'applica' })
  expect(amb.configure()).toBe(1)
  let c = JSON.parse(amb.disco.get(CONFIG)!)
  expect(c.account.modoLavoro).toEqual({ effortPredefinito: { R0: 'low' }, codexSandbox: 'read-only' })
  expect(c.progetti['esempio/demo'].modoLavoro).toEqual({ parallelo: 2, revisioneIncrociata: false })
  // «Usa i valori dell'account» toglie lo strato del progetto; l'account resta.
  await ui.press({ key: 'modo-ripristina' })
  await ui.press({ key: 'applica' })
  c = JSON.parse(amb.disco.get(CONFIG)!)
  expect('modoLavoro' in c.progetti['esempio/demo']).toBe(false)
  expect(c.account.modoLavoro).toEqual({ effortPredefinito: { R0: 'low' }, codexSandbox: 'read-only' })
})

test('F13.2 Modo di lavoro: il modo dirigente si sceglie per strato e si scrive con Applica; la nota su Fable si vede', async ($, on) => {
  const amb = ambiente(on)
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: 'impostazioni' })
  await ui.press({ key: 'sezione-modo-premi' })
  expect((await ui.find({ key: 'modo-dir-quando-R3+-premi' }))?.props).toMatchObject({ variant: 'primary' })
  expect((await ui.find({ key: 'modo-dir-figli-8-premi' }))?.props).toMatchObject({ variant: 'primary' })
  await ui.press({ key: 'modo-ambito-progetto-premi' })
  await ui.press({ key: 'modo-dir-quando-sempre-premi' })
  await ui.press({ key: 'modo-dir-figli-4-premi' })
  await ui.press({ key: 'modo-dir-ripiani-0-premi' })
  await ui.press({ key: 'applica' })
  expect(JSON.parse(amb.disco.get(CONFIG)!).progetti['esempio/demo'].modoLavoro).toEqual({ dirigente: { quando: 'sempre', maxFigli: 4, maxRipiani: 0 } })
  expect(await ui.find({ type: 'Text', text: /Fable può addebitare uso extra/ })).toBeDefined()
})

// --- F11.3: il doctor ----------------------------------------------------------------------------------------------
/** I testi disegnati (stringhe ed etichette), per cercare una frase. */
const testi = (n: unknown): string[] =>
  typeof n === 'string' ? [n] : !n || typeof n !== 'object' ? [] : Array.isArray(n) ? n.flatMap(testi)
    : [...((n as { props?: { label?: unknown } }).props?.label !== undefined ? [String((n as { props: { label: unknown } }).props.label)] : []), ...testi((n as { children?: unknown }).children)]
const DIAGNOSI = {
  trovati: [
    { codice: 'config.illeggibile', copie: 2 },
    { codice: 'registro.sviluppo' },
    { codice: 'accesso.codex', trovato: true },
    { codice: 'config.campoIgnoto', strato: 'progetto', progetto: true, campo: 'ignoto' },
    // Un codice che il pannello non conosce non si mostra mai (né il suo testo).
    { codice: 'segreto.nuovo', testo: 'X:/casa/persona/progetto-segreto' },
  ],
  versione: '9.9.9',
}

test('F11.3 doctor: /chipmanager --doctor apre la pagina e diagnostica; codici ignoti scartati; versione su disco diversa = avviso', async ($, on) => {
  const amb = ambiente(on)
  amb.disco.lingua = 'en'
  amb.disco.set(CONFIG, JSON.stringify({ progetti: { 'esempio/demo': {} } }))
  amb.esec.diagnosi = () => JSON.stringify(DIAGNOSI)
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const r = await $.command.run({ command: 'chipmanager', args: '--doctor' } as never)
  expect(String((r as { text?: unknown }).text)).toContain('doctor')
  const ui = await $.ui.mount({ ...PANE('desktop') })
  expect(await ui.find({ key: 'pagina-doctor' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Needs attention' })).toBeDefined()
  expect(amb.processi.filter(p => p[2] === 'diagnosi').length).toBe(1)
  const testo = testi(await ui.drawn()).join('\n')
  for (const t of ['Config unreadable (2 valid copies)', 'Spend register of a development build', 'Codex not signed in', 'Unknown field ignoto (this project)', 'The mod on disk is newer'])
    expect([t, testo.includes(t)]).toEqual([t, true])
  expect(testo).not.toContain('progetto-segreto')
  expect(testo).not.toContain('segreto.nuovo')
  // Rimedi solo dove ci sono: Restore, Archive, Sign in; il campo ignoto si riporta soltanto.
  expect((await ui.find({ key: 'doctor-rimedio-0' }))?.props).toMatchObject({ label: 'Restore…' })
  expect(await ui.find({ key: 'doctor-rimedio-3' })).toBeUndefined()
})

test('F11.3 doctor: un rimedio solo su conferma; annullato non tocca niente; confermato ripristina con il CAS sui byte e ricontrolla', async ($, on) => {
  const amb = ambiente(on)
  amb.esec.diagnosi = () => JSON.stringify(DIAGNOSI)
  amb.disco.set(CONFIG, '{ rotto')
  amb.esec.diagnosi = () => JSON.stringify({ ...DIAGNOSI, impronta: 'a'.repeat(64) })
  const stdin: string[] = []
  amb.esec.ripristina = s => (stdin.push(s), [0, '{"copia":1}'])
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'chipmanager', args: '--doctor' } as never)
  const ui = await $.ui.mount({ ...PANE('desktop') })
  amb.popup.risposta = () => 'Cancel'
  await ui.press({ key: 'doctor-rimedio-0' })
  await ui.press({ key: 'doctor-rimedio-1' })
  expect(amb.processi.filter(p => p[2] === 'ripristina-config' || p[2] === 'archivia-registro').length).toBe(0)
  expect(amb.domande.length).toBe(2)
  amb.popup.risposta = () => 'Apply fix'
  await ui.press({ key: 'doctor-rimedio-0' })
  // F11 rilievo 3: il CAS è sull'impronta dei byte letta dalla diagnosi, non sul testo decodificato.
  expect(stdin).toEqual([JSON.stringify({ impronta: 'a'.repeat(64) })])
  expect(amb.toast).toContain('Config restored')
  expect(amb.processi.filter(p => p[2] === 'diagnosi').length).toBe(2)
  // «Accedi» parte dal clic, senza popup: il login staccato di Codex.
  await ui.press({ key: 'doctor-rimedio-2' })
  expect(amb.processi.some(p => p[2] === 'accedi' && p[3] === 'codex')).toBe(true)
})

test('F11.3 doctor: helper che non risponde = «non è partito»; nessun rilievo = «Niente da sistemare»; il rapporto si copia', async ($, on) => {
  const amb = ambiente(on)
  amb.disco.lingua = 'en'
  amb.disco.set(CONFIG, JSON.stringify({ progetti: { 'esempio/demo': {} } }))
  amb.esec.diagnosi = () => null
  const copiati: string[] = []
  on('ui.copy', (_, e) => (copiati.push(String((e as { text?: unknown }).text)), { value: { isCopied: true } as never }))
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'chipmanager', args: '--doctor' } as never)
  const ui = await $.ui.mount({ ...PANE('terminal', 60) })
  expect(testi(await ui.drawn()).join('\n')).toContain('The check did not run')
  amb.esec.diagnosi = () => JSON.stringify({ trovati: [], versione: '2.2.0' })
  await ui.press({ key: 'doctor-ricontrolla' })
  expect(testi(await ui.drawn()).join('\n')).toContain('Nothing to fix.')
  await ui.press({ key: 'doctor-copia' })
  expect(copiati).toEqual(['Nothing to fix.'])
  await ui.press({ key: 'doctor-indietro' })
  expect(await ui.find({ key: 'pagina-connessioni' })).toBeDefined()
})

test('F11.1 proposte: il modo di lavoro si propone per progetto e account e si fonde con quello scritto; profilo e consigliere non sono modo', () => {
  const v = propostaImpostazioniDa({ motivo: 'Lavoro leggero.', progetto: { modoLavoro: { effortPredefinito: { R1: 'low' } } }, account: { modoLavoro: { codexSandbox: 'read-only' } } })
  expect(v).toHaveProperty('proposta')
  const r = risorseDa({ modoLavoro: { effortPredefinito: { R0: 'high' }, parallelo: 4 } }, { modoLavoro: { auditorSuggerito: true } }) as never
  expect(campiDaProposta((v as { proposta: never }).proposta, r)).toEqual({
    modoLavoro: { effortPredefinito: { R0: 'high', R1: 'low' }, parallelo: 4 },
    'account.modoLavoro': { auditorSuggerito: true, codexSandbox: 'read-only' },
  })
  for (const m of [{ effortPredefinito: { R4: 'medium' } }, { parallelo: 9 }, { codexSandbox: 'danger-full-access' }, { profilo: 'qualita' }, {}])
    expect(propostaImpostazioniDa({ motivo: 'x', progetto: { modoLavoro: m } })).toHaveProperty('errore')
  expect(propostaImpostazioniDa({ motivo: 'x', account: { profilo: 'qualita' } })).toHaveProperty('errore')
  expect(propostaImpostazioniDa({ motivo: 'x', account: { consigliere: 'applica' } })).toHaveProperty('errore')
})

test('lingua: config assente = inglese; la scelta va nella bozza, Applica la scrive con configura (CAS) e il pannello cambia', async ($, on) => {
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
  // F10: in un repository la lingua va nello stesso configura del progetto (un solo CAS), mai con configura-utente.
  expect(JSON.parse(amb.disco.get(CONFIG)!)).toEqual({ lingua: 'de', progetti: { 'esempio/demo': {} } })
  expect([amb.configure(), amb.processi.filter(x => x[2] === 'configura-utente').length]).toEqual([1, 0])
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
    expect((await ui.find({ key: 'sezione-legenda-premi' }))?.props).toMatchObject({ label: 'Aiuto', variant: 'primary' })
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

test('F13.4 Aiuto: ultima sezione, chiusa all\'apertura; una riga per corsia, le pagine del sito come testo da copiare prima di Pages; rimando R0–R5 solo nel Bilanciamento', async ($, on) => {
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
  for (const k of LEGENDA.corsie) expect([k, !!(await ui.find({ type: 'Text', text: t('it', k) }))]).toEqual([k, true])
  // Prima di GitHub Pages nessun pulsante apre il sito: gli indirizzi esatti come testo, e «Copia gli indirizzi».
  for (const p of PAGINE_AIUTO) expect([p, !!(await ui.find({ type: 'Text', text: `${t('it', `aiuto.p.${p}` as never)} · ${urlAiuto(p)}` }))]).toEqual([p, true])
  expect(await ui.find({ key: 'aiuto-copia' })).toBeDefined()
  expect(await ui.find({ type: 'Button', key: 'aiuto-index' })).toBeUndefined()
  expect(LEGENDA.corsie).toEqual(['legenda.r0', 'legenda.r1', 'legenda.r2', 'legenda.r3', 'legenda.r4', 'legenda.r5'])
  expect(t('it', 'legenda.r5')).toContain('Claude')
  // Il rimando testuale sta solo nella sezione dei pesi.
  expect(await ui.find({ type: 'Text', text: 'R0–R5: vedi Aiuto.' })).toBeUndefined()
  await ui.press({ key: 'sezione-bilanciamento-premi' })
  expect(await ui.find({ type: 'Text', text: 'R0–R5: vedi Aiuto.' })).toBeDefined()
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
  // F10: le soglie sono dell'account; progetto e account nella stessa scrittura.
  expect(amb.progettoOra()).toMatchObject({ fornitori: ['claude', 'codex', 'deepseek'], profilo: 'personalizzato' })
  expect(amb.accountOra()).toMatchObject({ soglie: { claude: null } })
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
  // F10: le soglie sono dell'account; il conflitto si vede sul valore grezzo dell'account.
  await ui.press({ key: 'soglia-claude-nessuna-premi' })
  amb.disco.set(CONFIG, JSON.stringify({ account: { soglie: { claude: { attenzione: 50, critica: 60 } } }, progetti: { 'esempio/demo': { milestoneGithub: true } } }))
  amb.popup.risposta = () => 'Ricarica e riapplica la mia bozza'
  await ui.press({ key: 'applica' })
  expect(amb.domande.at(-1)).toBe('Un\'altra sessione ha cambiato Soglie dopo le tue modifiche. Non è stato scritto niente.')
  expect(amb.configure()).toBe(1)
  expect(amb.progettoOra()).toMatchObject({ milestoneGithub: true })
  expect(amb.accountOra()).toEqual({ soglie: { claude: null } })
  await clock.advance(20_000)
  // Scarta: niente scritto, la bozza se ne va, l'altro valore resta.
  await ui.press({ key: 'soglia-claude-70/90-premi' })
  amb.disco.set(CONFIG, JSON.stringify({ account: { soglie: { claude: { attenzione: 40, critica: 60 } } }, progetti: { 'esempio/demo': {} } }))
  amb.popup.risposta = () => 'Scarta la mia bozza'
  await ui.press({ key: 'applica' })
  expect(amb.configure()).toBe(1)
  expect([amb.progettoOra(), amb.accountOra()]).toEqual([{}, { soglie: { claude: { attenzione: 40, critica: 60 } } }])
  expect(await ui.find({ key: 'pendenti' })).toBeUndefined()
  await clock.advance(20_000)
  // Un campo cambiato altrove ma non nella bozza non è un conflitto: si scrive il proprio, l'altro resta.
  await ui.press({ key: 'sezione-connessioni-premi' })
  await ui.press({ key: 'fornitore-deepseek-premi' })
  amb.disco.set(CONFIG, JSON.stringify({ account: { soglie: { claude: { attenzione: 40, critica: 60 } } }, progetti: { 'esempio/demo': { milestoneGithub: true } } }))
  const domande = amb.domande.length
  await ui.press({ key: 'applica' })
  expect(amb.domande.length).toBe(domande)
  expect(amb.progettoOra()).toMatchObject({ milestoneGithub: true, fornitori: ['claude', 'codex', 'deepseek'] })
  expect(amb.accountOra()).toEqual({ soglie: { claude: { attenzione: 40, critica: 60 } } })
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
  const amb = ambiente(on)
  // F10: i controlli delle soglie mostrano e scrivono quelle dell'account.
  amb.disco.set(CONFIG, JSON.stringify({ account: { soglie: { claude: { attenzione: 72, critica: 75 } } }, progetti: { 'esempio/demo': {} } }))
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('terminal') })
  await ui.press({ key: 'impostazioni' })
  await ui.press({ key: 'sezione-soglie-premi' })
  // Valori personali fuori passo: si mostrano così e + resta sotto la critica.
  expect(await ui.find({ key: 'soglia-claude' })).toBeDefined()
  await ui.press({ key: 'attenzione-claude-piu' })
  await ui.press({ key: 'applica' })
  expect(amb.accountOra()?.soglie).toMatchObject({ claude: { attenzione: 74, critica: 75 } })
  expect(String((await ui.find({ key: 'attenzione-claude-piu' }))?.props.label)).toBe('Aumenta Attenzione da (Claude), al massimo')
  // Un endpoint fuori da questo computer non si salva: la causa e il rimedio in linea.
  await ui.press({ key: 'sezione-avanzate-premi' })
  await ui.input({ key: 'free-endpoint', text: 'http://example.org/v1' })
  expect(await ui.find({ type: 'Text', text: /Endpoint solo su questo computer: http:\/\/localhost/ })).toBeDefined()
  expect(amb.progettoOra()).not.toHaveProperty('freellmapi')
  expect(amb.accountOra()).not.toHaveProperty('freellmapi')
  await ui.press({ key: 'sezione-soglie-premi' })
  // Una modifica concorrente dello stesso campo (qui l'account tolto altrove): niente scritto, il popup lo dice, e non c'è un secondo toast.
  await ui.press({ key: 'soglia-claude-nessuna-premi' })
  amb.disco.set(CONFIG, JSON.stringify({ progetti: { 'esempio/demo': { soloLocale: true } } }))
  amb.popup.risposta = () => 'Scarta la mia bozza'
  await ui.press({ key: 'applica' })
  expect([amb.progettoOra(), amb.accountOra()]).toEqual([{ soloLocale: true }, undefined])
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

  // F10: i budget manuali stanno nella sezione Soglie; uno nuovo è dell'account, quello del progetto resta com'è.
  await ui.press({ key: 'sezione-soglie-premi' })
  await ui.press({ key: 'aggiungi-budget' })
  expect(await ui.find({ key: 'bozza-fornitore' })).toBeDefined()
  await ui.press({ key: 'bozza-fornitore-claude-premi' })
  await ui.press({ key: 'bozza-tipo-settimanale-premi' })
  await ui.input({ key: 'bozza-valore', text: '140%' })
  expect(await ui.find({ type: 'Text', text: /Una percentuale va da 0 a 100/ })).toBeDefined()
  await ui.input({ key: 'bozza-valore', text: '40%' })
  expect(amb.progettoOra().limitiManuali).toEqual([{ id: 'saldo', fornitore: 'deepseek', nome: 'saldo mensile', letto: '2026-11-01T00:00:00Z', valore: 12, unita: 'USD' }])
  const manuali = amb.accountOra()!.limitiManuali as { id: string }[]
  expect(manuali[0]).toMatchObject({ fornitore: 'claude', nome: 'settimanale', percentuale: 40, unita: '%' })
  expect(manuali[0]!.id).toMatch(/^claude-settimanale-[a-z0-9]+$/)
  expect(await ui.find({ key: 'bozza-fornitore' })).toBeUndefined()
  expect(await ui.find({ key: 'pendenti' })).toBeUndefined()
  expect((await ui.find({ key: 'pagina-soglie' }))?.props).toMatchObject({ padding: 'md', backgroundColor: `${GRIGIO}${VELO.riquadro}` })

  // Popup accettato: fornitore e tipo dal popup, il valore in linea; × toglie la voce (qui quella del progetto).
  amb.popup.risposta = q => (q.startsWith('Per quale') ? 'DeepSeek' : 'Mensile')
  await ui.press({ key: 'aggiungi-budget' })
  expect(await ui.find({ key: 'bozza-tipo' })).toBeDefined()
  await ui.input({ key: 'bozza-valore', text: '20 USD' })
  expect((amb.accountOra()!.limitiManuali as unknown[])[1]).toMatchObject({ fornitore: 'deepseek', nome: 'mensile', valore: 20, unita: 'USD' })
  await ui.press({ key: 'budget-manuale-saldo-via' })
  expect(amb.progettoOra().limitiManuali).toEqual([])
  // Nessun prefisso raddoppiato nell'account, e i due budget dell'account restano.
  const ids = (amb.accountOra()!.limitiManuali as { id: string }[]).map(l => l.id)
  expect([ids.length, ids.some(id => id === 'saldo' || id.startsWith('manuale-'))]).toEqual([2, false])
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
  amb.disco.set(CONFIG, JSON.stringify({ account: { soglie: { claude: { attenzione: 50, critica: 60 } } }, progetti: { 'esempio/demo': {} } }))
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
  expect(amb.accountOra()).toMatchObject({ soglie: { claude: null } })
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
  // F10: i budget manuali stanno nella sezione Soglie.
  await ui.press({ key: 'sezione-soglie-premi' })
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
  // F10: i budget manuali stanno nella sezione Soglie; uno nuovo va nell'account.
  await ui.press({ key: 'sezione-soglie-premi' })
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
  expect(amb.progettoOra().limitiManuali).toEqual([])
  const manuali = amb.accountOra()!.limitiManuali as { fornitore: string; nome: string; percentuale?: number }[]
  expect(manuali.map(l => [l.fornitore, l.nome, l.percentuale])).toEqual([['claude', 'settimanale', 40]])
  expect(amb.progettoOra().milestoneGithub).toBe(true)
  await altro.unmount()
  await ui.unmount()
})

test('giro 6, D: un popup d\'uscita aperto prima di un Applica completo e di una nuova modifica non agisce sulla bozza nuova', LUNGA, async ($, on) => {
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
  // F10: budget e tetto sono dell'account (tutti i progetti); il consigliere resta del progetto. Il tetto assente vale 2.
  expect(amb.accountOra()).toMatchObject({ apiClaude: { budgetUsd: 15 } })
  expect(amb.progettoOra()).toMatchObject({ consigliere: 'suggerisci' })
  expect(amb.progettoOra()).not.toHaveProperty('apiClaude')
  expect((await ui.find({ key: 'ese-tetto' }))?.props.value).toBe('2')
  // Il tetto non supera il budget; un valore fuori misura resta in linea, senza bozza.
  await ui.input({ key: 'ese-tetto', text: '30' })
  expect(await ui.find({ type: 'Text', text: /Scrivi un numero da 0,01 a 15$/ })).toBeDefined()
  await ui.input({ key: 'ese-tetto', text: '3' })
  await ui.press({ key: 'applica' })
  expect(amb.accountOra()).toMatchObject({ apiClaude: { budgetUsd: 15, tetto: 3 } })
  await ui.press({ key: 'ese-api-togli' })
  await ui.press({ key: 'consigliere-spento-premi' })
  await ui.press({ key: 'applica' })
  // null nella scrittura toglie il campo.
  expect(amb.accountOra()).not.toHaveProperty('apiClaude')
  expect(amb.progettoOra()).not.toHaveProperty('consigliere')
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
  // F10: le soglie sono dell'account.
  amb.hook.primaDiConfigura = () => amb.disco.set(CONFIG, JSON.stringify({ account: { soglie: { claude: { attenzione: 50, critica: 60 } } }, progetti: { 'esempio/demo': { milestoneGithub: true } } }))
  amb.popup.risposta = () => 'Ricarica e riapplica la mia bozza'
  await ui.press({ key: 'applica' })
  expect(amb.domande.at(-1)).toBe('Un\'altra sessione ha cambiato Soglie dopo le tue modifiche. Non è stato scritto niente.')
  expect(amb.progettoOra()).toMatchObject({ milestoneGithub: true })
  expect(amb.accountOra()).toEqual({ soglie: { claude: null } })
  expect(await ui.find({ key: 'pendenti' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /cambiate altrove/ })).toBeUndefined()
  await ui.unmount()
})

test('rilievo 4: progetto e lingua in una sola scrittura: un CAS mancato non salva niente a metà, il nuovo tentativo scrive tutto', async ($, on) => {
  const amb = ambiente(on)
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: 'impostazioni' })
  await ui.press({ key: 'fornitore-deepseek-premi' })
  await ui.press({ key: 'sezione-lingua-premi' })
  await ui.press({ key: 'lingua-de-premi' })
  // F10: configura-utente non serve più in un repository (se servisse, fallirebbe); un'altra sessione cambia un campo
  // fuori dalla bozza fra la rilettura e il CAS: niente scritto, si rilegge e si riscrive tutto insieme.
  amb.hook.rifiutaUtente = true
  let scritto: unknown
  amb.hook.primaDiConfigura = () => {
    scritto = JSON.parse(amb.disco.get(CONFIG)!)
    amb.disco.set(CONFIG, JSON.stringify({ lingua: 'it', progetti: { 'esempio/demo': { milestoneGithub: true } } }))
  }
  await ui.press({ key: 'applica' })
  expect(scritto).toEqual({ lingua: 'it', progetti: { 'esempio/demo': {} } })
  expect(amb.progettoOra()).toMatchObject({ fornitori: ['claude', 'codex', 'deepseek'], milestoneGithub: true })
  expect(JSON.parse(amb.disco.get(CONFIG)!).lingua).toBe('de')
  expect(await ui.find({ type: 'Text', text: /la lingua non è stata salvata/ })).toBeUndefined()
  expect(await ui.find({ key: 'pendenti' })).toBeUndefined()
  expect([amb.configure(), amb.processi.filter(x => x[2] === 'configura-utente').length]).toEqual([2, 0])
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
    fonti: [{ nome: 'progetto', file: FILE_PROGETTO, chiavi: ['forceLoginMethod'] }, { nome: 'ambiente', chiavi: ['ANTHROPIC_API_KEY'] }],
    account: { email: 'persona@esempio.it' },
  })
  // Una policy dell'host che l'avvio blocca: la sezione la mostra con la chiave responsabile, mai il valore.
  amb.esec.impostazioni = source => (source === 'policy' ? { forceLoginGatewayUrl: 'https://gw.segreto.example' } : {})
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: 'impostazioni' })
  await ui.press({ key: 'sezione-esecuzione-premi' })
  await finoA(() => amb.esec.controlli > 0)
  await ui.press({ key: 'ese-ricontrolla' })
  for (const t of ['Accesso a Claude non fatto', 'GitHub non collegato', 'Nessuna chiave impostata', '3 fonti di impostazioni bloccano le esecuzioni API', 'Budget del mese non impostato'])
    expect([t, await ui.find({ type: 'Text', text: new RegExp(`${t}$`) })]).toEqual([t, expect.anything()])
  expect(await ui.find({ type: 'Text', text: /^Impostazioni del progetto: l'impostazione forceLoginMethod cambia chi paga/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^Impostazioni gestite \(policy\): l'impostazione forceLoginGatewayUrl cambia chi paga/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^ANTHROPIC_API_KEY è impostata nell'ambiente/ })).toBeDefined()
  for (const k of ['ese-accedi-claude', 'ese-accedi-gh', 'ese-chiave-vai', 'ese-fonte-progetto-copia', 'ese-guida']) expect([k, await ui.find({ key: k })]).toEqual([k, expect.anything()])
  const disegno = JSON.stringify(await ui.drawn())
  for (const segreto of ['persona@esempio.it', 'Ditta Segreta', 'utente-segreto', 'gw.segreto']) expect([segreto, disegno.includes(segreto)]).toEqual([segreto, false])
  // Una fonte dell'host che non si legge blocca anche qui, come all'avvio.
  amb.esec.stato = () => JSON.stringify(ESEC_OK)
  amb.esec.impostazioni = source => (source === 'flag' ? null : {})
  await ui.press({ key: 'ese-ricontrolla' })
  expect(await ui.find({ type: 'Text', text: /^Impostazioni da riga di comando \(--settings\): non si legge/ })).toBeDefined()
  // Tutto a posto: solo ✓, nessuna azione, il metodo di accesso (mai l'account).
  amb.esec.impostazioni = () => ({})
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

test('F6.7 Accedi: un solo login per clic; ricontrollo ogni 5 s che si ferma a login fatto, a 3 minuti o lasciando la sezione', LUNGA, async ($, on) => {
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

test('F6.7 Copia: se il login non parte la riga si copia; la chiave apre /config; il file che blocca si copia, mai aperto con un\'app', async ($, on) => {
  const amb = ambiente(on)
  amb.esec.stato = () => JSON.stringify({ ...ESEC_OK, claude: { trovato: true, loggedIn: false }, fonti: [{ nome: 'progetto', file: FILE_PROGETTO, chiavi: ['apiKeyHelper'] }] })
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
  expect(await ui.find({ type: 'Text', text: FILE_PROGETTO })).toBeDefined()
  await ui.press({ key: 'ese-fonte-progetto-copia' })
  expect(copiati.at(-1)).toBe(FILE_PROGETTO)
  expect(amb.toast.at(-1)).toBe('Percorso copiato')
  expect(amb.processi.filter(p => ['xdg-open', 'open', 'explorer.exe'].includes(p[0]!))).toEqual([])
  await ui.unmount()
})

test('F6.7 procedura guidata: i passi mancanti uno alla volta, ognuno si salta; si chiude da sola quando tutto è ✓', { options: { anthropicApiKey: 'sk-ant-prova' } }, async ($, on) => {
  const amb = ambiente(on)
  // F10: il budget API è dell'account.
  amb.disco.set(CONFIG, JSON.stringify({ account: { apiClaude: { budgetUsd: 20, tetto: 2 } }, progetti: { 'esempio/demo': {} } }))
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
  expect((await ui.find({ key: 'ese-guida-passo' }))?.props.borderStyle).toBeUndefined()
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

test('F6.7 ricontrollo: una risposta vecchia, tornata dopo un nuovo «Accedi», non ferma il ricontrollo nuovo', LUNGA, async ($, on) => {
  const amb = ambiente(on)
  amb.esec.stato = () => JSON.stringify({ ...ESEC_OK, github: { trovato: true, loggedIn: false, remote: true } })
  const clock = mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: 'impostazioni' })
  await ui.press({ key: 'sezione-esecuzione-premi' })
  await finoA(() => amb.esec.controlli > 0)
  await ui.press({ key: 'ese-ricontrolla' })
  await ui.press({ key: 'ese-accedi-gh' })
  for (let t = 0; t < 170_000; t += 5000) await clock.advance(5000)
  // Il battito dei 175 s resta sospeso; a 180 s il ricontrollo scade e si preme di nuovo «Collega GitHub».
  let rispondi!: (t: string) => void
  amb.esec.sospesa = new Promise<string>(ok => (rispondi = ok))
  await clock.advance(5000)
  await clock.advance(5000)
  await ui.press({ key: 'ese-accedi-gh' })
  expect(amb.esec.accessi).toEqual(['gh', 'gh'])
  // La risposta vecchia arriva ora, con l'accesso fatto: non tocca il ricontrollo nuovo, che al battito dopo ricontrolla.
  rispondi(JSON.stringify(ESEC_OK))
  for (let i = 0; i < 400 && !(await ui.find({ type: 'Text', text: /GitHub collegato e progetto su github\.com$/ })); i++) {
    let giri = 0
    await finoA(() => ++giri > 1)
  }
  const prima = amb.esec.controlli
  await clock.advance(5000)
  expect(amb.esec.controlli).toBe(prima + 1)
  await ui.unmount()
})

// --- F7.1: proposte di impostazioni da una sessione -------------------------------------------------------------

const FILE_PI = 'X:/casa/.claude/chipmanager/proposte-impostazioni.json'
const proponi = async ($: Parameters<TestBody>[0], args: Record<string, unknown>) =>
  (await $.tool.call({ tool: 'mcp__chip-manager__proponi_impostazioni', ...args } as never)) as { result?: string; deny?: string }

test('F7.1 forma: un campo vietato o sconosciuto, anche annidato, rifiuta tutta la proposta col nome e mai col valore', () => {
  const SEGRETO = 'sk-ant-VALORE-SEGRETO'
  // F10: una patch per strato (`progetto`, `account`); il nome del campo porta il prefisso dello strato.
  for (const [x, campo] of [
    [{ motivo: 'm', account: { soglie: { claude: { attenzione: 60, critica: 80, chiave: SEGRETO } } } }, 'account.soglie.claude.chiave'],
    [{ motivo: 'm', account: { apiClaude: { budgetUsd: 5, apiKey: SEGRETO } } }, 'account.apiClaude.apiKey'],
    [{ motivo: 'm', progetto: { profilo: 'risparmio', fornitori: [SEGRETO] } }, 'progetto.fornitori'],
    [{ motivo: 'm', progetto: { profilo: 'risparmio', soloLocale: true } }, 'progetto.soloLocale'],
    [{ motivo: 'm', progetto: { board: { modo: 'accesa', colore: SEGRETO } } }, 'progetto.board.colore'],
    [{ motivo: 'm', progetto: { profilo: 'risparmio' }, permessi: 'bypassPermissions' }, 'permessi'],
    [{ motivo: 'm', account: { soglie: { gemini: { attenzione: 1, critica: 2 } } } }, 'account.soglie.gemini'],
    [{ motivo: 'm', account: { soglie: { claude: { attenzione: 90, critica: 80 } } } }, 'account.soglie.claude'],
    [{ motivo: 'm', progetto: { restrizioni: { soglie: { claude: { attenzione: 60, critica: 80, token: SEGRETO } } } } }, 'progetto.restrizioni.soglie.claude.token'],
    [{ motivo: 'm', account: { limitiManuali: [SEGRETO] } }, 'account.limitiManuali'],
    // La forma piatta di prima non vale più: le soglie stanno in uno strato.
    [{ motivo: 'm', soglie: { claude: { attenzione: 60, critica: 80 } } }, 'soglie'],
  ] as const) {
    const v = propostaImpostazioniDa(x)
    expect([campo, 'errore' in v && v.errore.includes(`"${campo}"`), JSON.stringify(v).includes(SEGRETO)]).toEqual([campo, true, false])
  }
  expect(propostaImpostazioniDa({ motivo: 'Più margine.', progetto: { profilo: 'risparmio', consigliere: 'spento' }, lingua: 'de' }))
    .toEqual({ proposta: { motivo: 'Più margine.', progetto: { profilo: 'risparmio', consigliere: 'spento' }, lingua: 'de' } })
  expect(propostaImpostazioniDa({ motivo: 'solo motivo' })).toHaveProperty('errore')
})

test('F7.1 proposta valida: riempie la bozza con la fascia, niente si scrive senza Applica; Applica scrive solo quei campi', async ($, on) => {
  const amb = ambiente(on, { board: { modo: 'accesa', generazione: 3 } })
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  const prima = amb.disco.get(CONFIG)
  const r = await proponi($, { motivo: 'Il piano è quasi pieno: meglio risparmiare.', progetto: { profilo: 'risparmio' }, account: { soglie: { claude: { attenzione: 60, critica: 80 } } } })
  expect(r.result).toMatch(/^Settings proposal recorded/)
  expect(amb.disco.get(CONFIG)).toBe(prima)
  // Nessuna applicazione senza clic: la proposta è nella bozza, la vista Lavoro lo dice.
  expect(await ui.find({ type: 'Text', text: /Impostazioni proposte da una sessione \(.*\) aspettano nella bozza/ })).toBeDefined()
  await ui.press({ key: 'proposta-impostazioni-rivedi' })
  expect(await ui.find({ type: 'Text', text: /^Proposta da una sessione/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Il piano è quasi pieno: meglio risparmiare.' })).toBeDefined()
  // F10: la proposta tocca l'account, e la fascia lo dice.
  expect(await ui.find({ type: 'Text', text: 'Cambia le impostazioni di tutti i progetti.' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '2 modifiche non salvate' })).toBeDefined()
  expect(amb.disco.get(CONFIG)).toBe(prima)
  // L'impronta della board non cambia per una proposta in bozza: tutte le scritture fin qui hanno la stessa.
  const impronte = () => new Set(amb.processi.filter(p => p[2] === 'board-scrivi').map(p => p.at(-1)))
  expect(impronte().size).toBeLessThanOrEqual(1)
  await ui.press({ key: 'applica' })
  expect(amb.progettoOra()).toMatchObject({ profilo: 'risparmio', board: { modo: 'accesa', generazione: 3 } })
  expect(amb.progettoOra()).not.toHaveProperty('soglie')
  expect(amb.accountOra()).toEqual({ soglie: { claude: { attenzione: 60, critica: 80 } } })
  expect(amb.configure()).toBe(1)
  expect(await ui.find({ key: 'proposta-impostazioni' })).toBeUndefined()
  await ui.unmount()
})

test('F7.1 rifiuti: campo vietato annidato, valore che la bozza non accetta, seconda proposta in attesa; niente scritto né salvato', async ($, on) => {
  const amb = ambiente(on)
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const r1 = await proponi($, { motivo: 'x', account: { soglie: { claude: { attenzione: 60, critica: 80, token: 'sk-ant-NONECO' } } } })
  expect(r1.deny).toMatch(/"account\.soglie\.claude\.token" can never be proposed/)
  expect(r1.deny).not.toContain('sk-ant-NONECO')
  // F10: la forma piatta di prima è un campo sconosciuto.
  expect((await proponi($, { motivo: 'x', soglie: { claude: { attenzione: 60, critica: 80 } } })).deny).toMatch(/field "soglie" is not a settings field this tool accepts/)
  // Un tetto senza budget (API non configurata) non passerebbe la bozza, e non si inventa un budget: si nomina il campo.
  expect((await proponi($, { motivo: 'x', account: { apiClaude: { tetto: 3 } } })).deny).toMatch(/field "account\.apiClaude" has a value the Settings would not accept/)
  // Una restrizione più larga dell'account (qui i 70/90 predefiniti, o l'API spenta) non passa.
  expect((await proponi($, { motivo: 'x', progetto: { restrizioni: { soglie: { claude: { attenzione: 80, critica: 95 } } } } })).deny).toMatch(/field "restrizioni" has a value the Settings would not accept/)
  expect((await proponi($, { motivo: 'x', progetto: { restrizioni: { apiTetto: 1 } } })).deny).toMatch(/field "restrizioni" has a value the Settings would not accept/)
  expect(amb.disco.get(FILE_PI)).toBeUndefined()
  // Una proposta già in attesa nel file (un altro pannello non l'ha ancora presa): la seconda è rifiutata.
  amb.disco.set(FILE_PI, JSON.stringify({ versione: 1, voci: { 'esempio/demo': { id: 'i-attesa01', quando: new Date().toISOString(), proponente: { id: 'altra', titolo: '' }, proposta: { motivo: 'm', progetto: { profilo: 'qualita' } } } } }))
  amb.hook.nonPrendere = true
  expect((await proponi($, { motivo: 'y', progetto: { profilo: 'risparmio' } })).deny).toMatch(/already waiting/)
})

test('F7.1 con una bozza aperta la proposta resta in coda e la fascia lo dice; entra dopo «Annulla modifiche»', async ($, on) => {
  const amb = ambiente(on)
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: 'impostazioni' })
  await ui.press({ key: 'sezione-esecuzione-premi' })
  await ui.press({ key: 'consigliere-suggerisci-premi' })
  expect((await proponi($, { motivo: 'Profilo più economico.', progetto: { profilo: 'risparmio' } })).result).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Una sessione \(.*\) ha proposto impostazioni: entrano nella bozza quando/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '1 modifica non salvata' })).toBeDefined()
  await ui.press({ key: 'annulla-modifiche' })
  await ui.press({ key: 'ricarica' })
  expect(await ui.find({ type: 'Text', text: /^Proposta da una sessione/ })).toBeDefined()
  expect(await ui.find({ key: 'proposta-in-coda' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: '1 modifica non salvata' })).toBeDefined()
  await ui.unmount()
})

test('F7.1 Apply con la lingua cambiata altrove (un altro progetto): niente scritto, il popup nomina la Lingua; «Ricarica e riapplica» scrive tutto in un configura', async ($, on) => {
  const amb = ambiente(on)
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await proponi($, { motivo: 'Qualità e tedesco.', progetto: { profilo: 'qualita' }, lingua: 'de' })
  await ui.press({ key: 'impostazioni' })
  // Un altro progetto sceglie il francese mentre la proposta aspetta: F10, niente salvataggio parziale, è un conflitto.
  amb.disco.set(CONFIG, JSON.stringify({ ...JSON.parse(amb.disco.get(CONFIG)!), lingua: 'fr' }))
  let alPopup: { lingua?: string; progetti: Record<string, { profilo?: string }> } | undefined
  amb.popup.risposta = () => ((alPopup = JSON.parse(amb.disco.get(CONFIG)!)), 'Ricarica e riapplica la mia bozza')
  await ui.press({ key: 'applica' })
  expect(amb.domande.at(-1)).toMatch(/Lingua|Langue/)
  expect([alPopup?.lingua, alPopup?.progetti['esempio/demo']?.profilo]).toEqual(['fr', undefined])
  // Riapplicata, la proposta scrive progetto e lingua insieme: è la scelta esplicita dell'utente.
  expect(JSON.parse(amb.disco.get(CONFIG)!)).toMatchObject({ lingua: 'de' })
  expect(amb.progettoOra().profilo).toBe('qualita')
  expect([amb.configure(), amb.processi.filter(x => x[2] === 'configura-utente').length]).toEqual([1, 0])
  await ui.unmount()
})

test('F7.1 risorse_agenti: le impostazioni proponibili con i valori di adesso, nessun segreto, dentro il tetto', { options: { anthropicApiKey: 'sk-ant-SENTINELLA-77' } }, async ($, on) => {
  const amb = ambiente(on)
  // F10: profilo, board e consigliere del progetto; il budget API dell'account; i valori efficaci a parte.
  amb.disco.set(CONFIG, JSON.stringify({ account: { apiClaude: { budgetUsd: 12, tetto: 2 } }, progetti: { 'esempio/demo': { profilo: 'qualita', consigliere: 'suggerisci' } } }))
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const r = (await $.tool.call({ tool: 'mcp__chip-manager__risorse_agenti' } as never)) as { result: string }
  expect(r.result.length).toBeLessThanOrEqual(4000)
  expect(r.result).not.toContain('SENTINELLA')
  expect(JSON.parse(r.result).impostazioni).toMatchObject({
    project: { profilo: 'qualita', board: 'spenta', consigliere: 'suggerisci', restrizioni: {} },
    account: { soglie: {}, apiClaude: { budgetUsd: 12, tetto: 2 }, appliesTo: 'all projects' },
    effective: { soglie: { claude: { attenzione: 70, critica: 90 } }, apiClaude: { budgetUsd: 12, tetto: 2 } },
    lingua: 'it',
  })
})

// --- revisione F7 (Codex) -------------------------------------------------------------------------------------------

test('F7 rilievo 3: un profilo proposto porta i suoi pesi (Risparmio → Qualità non tiene low +40 né xhigh −90), come coppia della bozza', async ($, on) => {
  const pesiRisparmio = conProfilo([], 'risparmio')
  const amb = ambiente(on, { profilo: 'risparmio', pesi: pesiRisparmio })
  const r = risorseDa({ profilo: 'risparmio', pesi: pesiRisparmio })
  if ('k' in r) throw new Error(r.k)
  const campi = campiDaProposta({ motivo: 'm', progetto: { profilo: 'qualita' } }, r)
  expect(campi).toEqual({ profilo: 'qualita', pesi: conProfilo(pesiRisparmio, 'qualita') })
  expect(JSON.stringify(campi.pesi)).not.toMatch(/"nome":"low","percentuale":40/)
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await proponi($, { motivo: 'Più qualità.', progetto: { profilo: 'qualita' } })
  await ui.press({ key: 'impostazioni' })
  await ui.press({ key: 'applica' })
  expect(amb.progettoOra()).toMatchObject({ profilo: 'qualita', pesi: conProfilo(pesiRisparmio, 'qualita') })
  await ui.unmount()
})

test('F7 rilievo 4: la lingua di una proposta non sovrascrive quella salvata da un altro progetto, né durante configura né dentro il CAS della lingua', async ($, on) => {
  const amb = ambiente(on)
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  const lingua = () => (JSON.parse(amb.disco.get(CONFIG)!) as { lingua?: string }).lingua
  // 1) Un altro progetto salva il francese mentre si scrive il progetto: alla fine resta la sua scelta, più recente.
  await proponi($, { motivo: 'Tedesco e qualità.', progetto: { profilo: 'qualita' }, lingua: 'de' })
  await ui.press({ key: 'impostazioni' })
  amb.hook.primaDiConfigura = () => amb.disco.set(CONFIG, JSON.stringify({ ...JSON.parse(amb.disco.get(CONFIG)!), lingua: 'fr' }))
  amb.popup.risposta = () => null
  await ui.press({ key: 'applica' })
  expect(lingua()).toBe('fr')
  // F10: un solo CAS, niente salvataggio parziale: neanche il progetto è scritto.
  expect(amb.progettoOra().profilo).toBeUndefined()
  await ui.unmount()
})

test('F7 rilievo 4: un\'altra lingua salvata dentro la scrittura (CAS mancato) porta al popup di conflitto, niente sovrascritto', async ($, on) => {
  const amb = ambiente(on)
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  const lingua = () => (JSON.parse(amb.disco.get(CONFIG)!) as { lingua?: string }).lingua
  await proponi($, { motivo: 'Tedesco.', lingua: 'de' })
  await ui.press({ key: 'impostazioni' })
  // F10: in un repository anche la sola lingua va con configura (un solo CAS sul file intero).
  amb.hook.primaDiConfigura = () => amb.disco.set(CONFIG, JSON.stringify({ ...JSON.parse(amb.disco.get(CONFIG)!), lingua: 'fr' }))
  amb.popup.risposta = () => null
  await ui.press({ key: 'applica' })
  expect(lingua()).toBe('fr')
  expect(amb.domande.some(q => /Lingua|Langue/.test(q))).toBe(true)
  await ui.unmount()
})

test('F7 giro 2, rilievo 2: con il progetto in conflitto la lingua proposta non si salva; «Scarta» lascia tutto com\'era', async ($, on) => {
  const amb = ambiente(on)
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  const lingua = () => (JSON.parse(amb.disco.get(CONFIG)!) as { lingua?: string }).lingua
  await proponi($, { motivo: 'Tedesco e qualità.', progetto: { profilo: 'qualita' }, lingua: 'de' })
  await ui.press({ key: 'impostazioni' })
  // Un'altra sessione cambia il profilo: Applica va in conflitto e la lingua non deve essere già scritta.
  const c = JSON.parse(amb.disco.get(CONFIG)!)
  amb.disco.set(CONFIG, JSON.stringify({ ...c, progetti: { 'esempio/demo': { ...c.progetti['esempio/demo'], profilo: 'velocita' } } }))
  amb.popup.risposta = () => 'Scarta la mia bozza'
  await ui.press({ key: 'applica' })
  expect(amb.domande.at(-1)).toMatch(/cambiato .* dopo le tue modifiche/)
  expect(lingua()).toBe('it')
  expect(amb.progettoOra().profilo).toBe('velocita')
  await ui.unmount()
})

test('F7 giro 2, rilievo 2: progetto e lingua cambiata altrove intanto: niente salvataggio parziale, popup, in bozza resta tutto', async ($, on) => {
  const amb = ambiente(on)
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await proponi($, { motivo: 'Tedesco e qualità.', progetto: { profilo: 'qualita' }, lingua: 'de' })
  await ui.press({ key: 'impostazioni' })
  // Il pannello rilegge prima la lingua salvata: la si cambia appena prima del CAS (F10: progetto e lingua insieme).
  amb.hook.primaDiConfigura = () => amb.disco.set(CONFIG, JSON.stringify({ ...JSON.parse(amb.disco.get(CONFIG)!), lingua: 'fr' }))
  amb.popup.risposta = () => null
  await ui.press({ key: 'applica' })
  expect(amb.domande.at(-1)).toMatch(/Lingua|Langue/)
  expect(amb.progettoOra().profilo).toBeUndefined()
  expect((JSON.parse(amb.disco.get(CONFIG)!) as { lingua?: string }).lingua).toBe('fr')
  expect(await ui.find({ key: 'pendenti' })).toBeDefined()
  await ui.unmount()
})

test('F8 un solo primario: «Configura Esecuzione» è secondario (il primario resta la vista scelta e Applica)', async ($, on) => {
  const amb = ambiente(on)
  amb.esec.stato = () => JSON.stringify({ claude: { trovato: true, loggedIn: false }, github: { trovato: true, loggedIn: true, remote: true }, fonti: [] })
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: 'impostazioni' })
  await ui.press({ key: 'sezione-esecuzione-premi' })
  await finoA(() => amb.esec.controlli > 0)
  await ui.press({ key: 'ese-ricontrolla' })
  expect((await ui.find({ key: 'ese-guida' }))?.props).toMatchObject({ variant: 'secondary' })
  await ui.unmount()
})

// --- F10: strato Account e strato Progetto nelle Impostazioni ---------------------------------------------------------

test('F10 Impostazioni: gruppi Account e Progetto; le restrizioni del progetto si vedono come «più severa» e si tolgono con Applica; budget di progetto con la pillola', async ($, on) => {
  const budgetProgetto = { id: 'vecchio', fornitore: 'claude', nome: 'Max', letto: '2026-11-01T10:00:00.000Z', percentuale: 40, unita: '%' }
  const amb = ambiente(on,
    { soglie: { claude: { attenzione: 50, critica: 60 } }, restrizioni: { apiLimiteMeseUsd: 4, soglie: { codex: { attenzione: 40, critica: 50 } } }, limitiManuali: [budgetProgetto], x: 'resta' },
    { soglie: { claude: { attenzione: 70, critica: 90 } }, apiClaude: { budgetUsd: 20, tetto: 2 } })
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: 'impostazioni' })
  expect(await ui.find({ type: 'Text', text: 'ACCOUNT · TUTTI I PROGETTI' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'PROGETTO · ESEMPIO/DEMO' })).toBeDefined()
  expect((await ui.find({ key: 'sezioni' }))?.props.gap).toBe('sm')
  await ui.press({ key: 'sezione-soglie-premi' })
  expect(await ui.find({ type: 'Text', text: "Impostazione dell'account: vale per tutti i progetti." })).toBeDefined()
  // La soglia efficace è la più severa: quella del progetto (50/60), detta accanto ai controlli dell'account (70/90).
  expect(await ui.find({ type: 'Text', text: /^Più severa in esempio\/demo: / })).toBeDefined()
  // Il budget del progetto porta la pillola «progetto».
  expect(await ui.find({ type: 'Text', text: /· progetto$/ })).toBeDefined()
  const prima = amb.disco.get(CONFIG)
  await ui.press({ key: 'restrizione-claude-togli' })
  expect(amb.disco.get(CONFIG)).toBe(prima)
  expect((await ui.find({ key: 'pendenti' }))?.props).toMatchObject({ padding: 'md', backgroundColor: `${ACCENTO}${ALFA_VELO}`, flexWrap: 'wrap' })
  // F12.1: the save controls remain one aligned group when the count wraps above them.
  expect((await ui.find({ key: 'pendenti-azioni' }))?.props).toMatchObject({ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 'xs', rowGap: 'xs' })
  await ui.press({ key: 'applica' })
  // «Rimuovi restrizione» toglie il campo dal progetto; l'account non cambia, i campi sconosciuti restano.
  expect(amb.progettoOra()).not.toHaveProperty('soglie')
  expect(amb.progettoOra()).toMatchObject({ x: 'resta', restrizioni: { apiLimiteMeseUsd: 4 } })
  expect(amb.accountOra()).toEqual({ soglie: { claude: { attenzione: 70, critica: 90 } }, apiClaude: { budgetUsd: 20, tetto: 2 } })
  // Esecuzione: il limite del mese del progetto si vede e si toglie; l'account resta.
  await ui.press({ key: 'sezione-esecuzione-premi' })
  expect(await ui.find({ type: 'Text', text: /^Più severa in esempio\/demo: al massimo 4 USD al mese, 2 USD per esecuzione$/ })).toBeDefined()
  await ui.press({ key: 'ese-restrizione-togli' })
  await ui.press({ key: 'applica' })
  expect(amb.progettoOra().restrizioni).toEqual({ soglie: { codex: { attenzione: 40, critica: 50 } } })
  expect(amb.accountOra()).toMatchObject({ apiClaude: { budgetUsd: 20, tetto: 2 } })
  await ui.unmount()
})

test('Percorsi nel pannello: un link SOPRA la radice dati (.claude spostata) vale; un link dalla radice in giù o un .git sopra fermano tutto, con la causa', async ($, on) => {
  const amb = ambiente(on, {}, { apiClaude: { budgetUsd: 20, tetto: 2 } })
  const errori = /contains a link|contiene un link|inside the repository|dentro il repository|cannot be read|non si legge/
  // .claude spostata su un altro disco (una junction): il pannello legge il config e lavora.
  amb.collegati.add('X:/casa/.claude')
  const clock = mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  expect(await ui.find({ type: 'Text', text: errori })).toBeUndefined()
  // Un link sulla radice dati stessa («chipmanager»): fermo, con il percorso e che cosa fare.
  amb.collegati.add('X:/casa/.claude/chipmanager')
  await clock.advance(60_000)
  expect(await ui.find({ type: 'Text', text: /contains a link: X:\/casa\/\.claude\/chipmanager\. .*--doctor/ })).toBeDefined()
  expect(amb.configure()).toBe(0)
  // Un `.git` (anche un file) sopra il config: dentro un repository, con il suo percorso.
  amb.collegati.delete('X:/casa/.claude/chipmanager')
  amb.disco.set('X:/casa/.git', 'gitdir: altrove')
  await clock.advance(60_000)
  expect(await ui.find({ type: 'Text', text: /inside the repository X:\/casa: .*--doctor/ })).toBeDefined()
  // Tolto, il pannello torna a leggere.
  amb.disco.delete('X:/casa/.git')
  await clock.advance(60_000)
  expect(await ui.find({ type: 'Text', text: errori })).toBeUndefined()
  await ui.unmount()
})
test('F10 rilievo 4: lingua scelta it→de, un\'altra sessione salva fr prima della lettura del CAS: conflitto, niente scritto; Riapplica sceglie de', async ($, on) => {
  const amb = ambiente(on, {}, { soglie: {} })
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: 'impostazioni' })
  await ui.press({ key: 'sezione-lingua-premi' })
  await ui.press({ key: 'lingua-de-premi' })
  // Un'altra sessione salva fr DOPO la scelta (la base è it) e prima che Applica legga il testo del CAS.
  const conFr = JSON.stringify({ ...JSON.parse(amb.disco.get(CONFIG)!), lingua: 'fr' })
  amb.disco.set(CONFIG, conFr)
  amb.popup.risposta = () => null
  await ui.press({ key: 'applica' })
  // Niente scritto: la lingua dell'altra sessione resta, e il popup di conflitto nomina la Lingua.
  expect(amb.disco.get(CONFIG)).toBe(conFr)
  expect(amb.domande.some(q => /Langue|Lingua/.test(q))).toBe(true)
  // «Ricarica e riapplica» (la bozza vince, con la base nuova): una sola scrittura, la lingua scelta.
  amb.popup.risposta = q => (/Langue/.test(q) ? 'Recharger et réappliquer mon brouillon' : /Lingua/.test(q) ? 'Ricarica e riapplica la mia bozza' : null)
  await ui.press({ key: 'applica' })
  expect(JSON.parse(amb.disco.get(CONFIG)!).lingua).toBe('de')
  await ui.unmount()
})

test('F10 rilievo 5: l\'account resta grezzo (il tetto predefinito solo nei valori efficaci); proporre solo il budget non scrive il tetto', () => {
  const senza = risorseDa({}, { apiClaude: { budgetUsd: 20 } })
  const con = risorseDa({}, { apiClaude: { budgetUsd: 20, tetto: 2 } })
  if ('k' in senza || 'k' in con) throw new Error('non valide')
  // Grezzi distinguibili (basi e conflitti), efficaci uguali (decisioni).
  expect([senza.account.apiClaude, con.account.apiClaude]).toEqual([{ budgetUsd: 20 }, { budgetUsd: 20, tetto: 2 }])
  expect(senza.apiClaude).toEqual(con.apiClaude)
  expect(valoreConfig(senza, 'account.apiClaude')).not.toEqual(valoreConfig(con, 'account.apiClaude'))
  // Solo il budget proposto: il tetto non si compila da sé.
  expect(campiDaProposta({ motivo: 'm', account: { apiClaude: { budgetUsd: 30 } } }, senza)).toEqual({ 'account.apiClaude': { budgetUsd: 30 } })
  expect(campiDaProposta({ motivo: 'm', account: { apiClaude: { budgetUsd: 30 } } }, con)).toEqual({ 'account.apiClaude': { budgetUsd: 30, tetto: 2 } })
})

test('F10 rilievo 7: in Connessioni un fornitore ammesso senza la sua chiave ha la pillola «Non connesso»; con la chiave no', async ($, on) => {
  const amb = ambiente(on, { fornitori: ['claude', 'codex', 'deepseek', 'freellmapi'], freellmapi: { livello: 'R1' } })
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: 'impostazioni' })
  await ui.press({ key: 'sezione-connessioni-premi' })
  for (const f of ['deepseek', 'freellmapi']) expect(JSON.stringify(await ui.find({ key: `stato-chip-${f}` }))).toMatch(/Non connesso/)
  for (const f of ['claude', 'codex']) expect(JSON.stringify(await ui.find({ key: `stato-chip-${f}` }))).not.toMatch(/Non connesso/)
  expect(amb.configure()).toBe(0)
  await ui.unmount()
})

test('F10 rilievo 7: con le chiavi nelle opzioni DeepSeek e FreeLLMAPI contano come connessi', { options: { deepseekKey: 'ds-prova-123456', freellmapiKey: 'fl-prova-123456' } }, async ($, on) => {
  ambiente(on, { fornitori: ['claude', 'codex', 'deepseek', 'freellmapi'], freellmapi: { livello: 'R1' } })
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: 'impostazioni' })
  await ui.press({ key: 'sezione-connessioni-premi' })
  for (const f of ['deepseek', 'freellmapi']) expect(JSON.stringify(await ui.find({ key: `stato-chip-${f}` }))).not.toMatch(/Non connesso/)
  await ui.unmount()
})

test('F10 giro 2, rilievo 4: per API Claude conta solo l\'opzione sensibile della mod, mai una chiave d\'ambiente; DeepSeek e FreeLLMAPI anche dall\'ambiente', async ($, on) => {
  const amb = ambiente(on, { fornitori: ['claude', 'codex', 'deepseek', 'freellmapi'], freellmapi: { livello: 'R1' } }, { apiClaude: { budgetUsd: 20, tetto: 2 } })
  amb.variabili.ANTHROPIC_API_KEY = 'sk-ant-ambiente-0123456789'
  amb.variabili.DEEPSEEK_API_KEY = 'ds-ambiente-0123456789'
  amb.variabili.FREELLMAPI_KEY = 'fl-ambiente-0123456789'
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: 'impostazioni' })
  await ui.press({ key: 'sezione-esecuzione-premi' })
  // La chiave nell'ambiente non conta come «connessa» per API Claude (F6 §7: blocca la corsia, fatturerebbe altrove).
  expect(await ui.find({ type: 'Text', text: /Nessuna chiave impostata/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Chiave impostata nelle opzioni sensibili/ })).toBeUndefined()
  const r = await $.tool.call({ tool: 'mcp__chip-manager__risorse_agenti' } as never) as { result?: string }
  expect(JSON.stringify(r.result)).toMatch(/no key in the mod options/)
  // DeepSeek e FreeLLMAPI: la chiave d'ambiente è quella che l'helper già usa, quindi contano come connessi.
  await ui.press({ key: 'sezione-connessioni-premi' })
  for (const f of ['deepseek', 'freellmapi']) expect(JSON.stringify(await ui.find({ key: `stato-chip-${f}` }))).not.toMatch(/Non connesso/)
  await ui.unmount()
})

// --- F11.2: la configurazione guidata ---------------------------------------------------------------------------------

test('F11.2 setup: /chipmanager --setup apre il passo 1 di 7; Avanti, Indietro, Salta al riepilogo; i passi non proponibili dicono «tu»', async ($, on) => {
  const amb = ambiente(on)
  amb.disco.lingua = 'en'
  amb.disco.set(CONFIG, JSON.stringify({ progetti: { 'esempio/demo': {} } }))
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const r = await $.command.run({ command: 'chipmanager', args: '--setup' } as never)
  expect(String((r as { text?: unknown }).text)).toContain('setup')
  const ui = await $.ui.mount({ ...PANE('terminal', 60) })
  const passo = async () => testi(await ui.drawn()).find(t => /^Step \d/.test(t))
  expect(await passo()).toBe('Step 1 of 7 · Language')
  expect(await ui.find({ key: 'setup-indietro' })).toBeUndefined()
  await ui.press({ key: 'setup-avanti' })
  expect(await passo()).toBe('Step 2 of 7 · Providers · you')
  await ui.press({ key: 'setup-avanti' })
  expect(await passo()).toBe('Step 3 of 7 · Sign-ins · you')
  // Entrando negli accessi si ricontrolla; Codex conta col solo codice d'uscita.
  expect(amb.processi.some(x => x[2] === 'stato-esecuzione')).toBe(true)
  await ui.press({ key: 'setup-indietro' })
  expect(await passo()).toBe('Step 2 of 7 · Providers · you')
  await ui.press({ key: 'setup-riepilogo-vai' })
  expect(await passo()).toBe('Step 7 of 7 · Summary')
  expect(await ui.find({ key: 'setup-avanti' })).toBeUndefined()
  expect(testi(await ui.drawn()).join('\n')).toContain('Nothing to apply yet.')
  // With the project's rules read, the summary has no rules guide.
  expect(await ui.find({ key: 'regole-guida' })).toBeUndefined()
  await ui.press({ key: 'setup-chiudi' })
  expect(await ui.find({ key: 'pagina-connessioni' })).toBeDefined()
  expect(amb.configure()).toBe(0)
})

test('audit 4: without a readable routing.json, setup and doctor say what the file is and where the guide is; nothing is written', async ($, on) => {
  const amb = ambiente(on)
  amb.disco.lingua = 'en'
  amb.disco.delete('X:/repo/.claude/routing.json')
  amb.disco.set(CONFIG, JSON.stringify({ progetti: { 'esempio/demo': {} } }))
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'chipmanager', args: '--setup' } as never)
  const ui = await $.ui.mount({ ...PANE('terminal', 60) })
  await ui.press({ key: 'setup-riepilogo-vai' })
  let testo = testi(await ui.drawn()).join('\n')
  for (const t of ['Project rules not readable: routing.json missing', '.claude/routing.json', 'Guide: https://elite9400.github.io/chipManager/site/quick-start.html#rules'])
    expect([t, testo.includes(t)]).toEqual([t, true])
  await $.command.run({ command: 'chipmanager', args: '--doctor' } as never)
  testo = testi(await ui.drawn()).join('\n')
  expect(testo).toContain('Project rules not readable: routing.json missing')
  expect([testo.includes('All checks passed'), testo.includes('Nothing to fix.')]).toEqual([false, false])
  expect(await ui.find({ key: 'regole-guida-crea' })).toBeDefined()
  // An incomplete file: the same guide, naming the first section it lacks; no offer to create, nothing touched.
  const incompleto = JSON.stringify({ modelli_ammessi: ['claude-opus-5-5'] })
  amb.disco.set('X:/repo/.claude/routing.json', incompleto)
  await $.command.run({ command: 'chipmanager', args: '--doctor' } as never)
  expect(testi(await ui.drawn()).join('\n')).toContain('Project rules not readable: routing.json: «effort_ammessi» missing or invalid')
  expect(await ui.find({ key: 'regole-guida-crea' })).toBeUndefined()
  expect([[...amb.disco.keys()].filter(k => k.startsWith('X:/repo/')), amb.disco.get('X:/repo/.claude/routing.json')]).toEqual([['X:/repo/.claude/routing.json'], incompleto])
  expect(amb.processi.some(x => x[1]?.endsWith('/regole-crea.cjs'))).toBe(false)
  amb.disco.set('X:/repo/.claude/routing.json', JSON.stringify(ROUTING))
  await $.command.run({ command: 'chipmanager', args: '--doctor' } as never)
  expect(await ui.find({ key: 'regole-guida' })).toBeUndefined()
  await ui.unmount()
})

test('default rules: built from the mod\'s own lists, read back by regoleDa as complete; the missing section mirrors regoleDa', () => {
  const r = regoleIniziali()
  expect(JSON.parse(testoRegoleIniziali())).toEqual(r)
  const lette = regoleDa(r, 'routing.json v1')
  expect(lette.lette).toBe(true)
  expect(r.modelli_ammessi).toEqual([...REGOLE_DEFAULT.modelli.claude, ...REGOLE_DEFAULT.modelli.codex])
  expect(r.effort_ammessi).toEqual(['low', 'medium', 'high', 'xhigh'])
  expect(r.tetto_per_modello).toEqual(REGOLE_DEFAULT.tetto)
  // No external provider: no FreeLLMAPI models; Codex never on R4/R5.
  expect([lette.modelli.freellmapi, 'freellmapi' in r, r.corsia_codex.esegue.corsie]).toEqual([[], false, ['R1', 'R2', 'R3']])
  // Every Claude author: the ordinary reviewer is another Claude model, and the sensitive one (Fable 5.2, Opus for Fable) is in the row.
  for (const autore of lette.modelli.claude) {
    const riga = lette.revisori[autore]!
    const sensibile = autore.startsWith('claude-fable-') ? 'claude-opus-5-5' : 'claude-fable-5-2'
    expect([autore, riga.find(x => x.startsWith('claude-')) !== autore, riga.includes(sensibile), riga.includes(autore)]).toEqual([autore, true, true, false])
  }
  for (const m of lette.modelli.codex) expect(lette.revisori[m]).toContain(lette.corsiaCodex.rivistoDa.R1!)
  // The doctor's «missing section» agrees with regoleDa on partial files.
  const casi: unknown[] = [null, {}, { ...r, effort_ammessi: ['max'] }, { ...r, revisione: {} }, { ...r, corsia_codex: { ...r.corsia_codex, effort: {} } },
    { ...r, corsia_codex: { ...r.corsia_codex, rivisto_da: { _nota: 'x' } } }, { ...r, corsia_codex: { ...r.corsia_codex, modelli: 'gpt' } }, r]
  for (const c of casi) expect([c, campoRegoleMancante(c) === undefined]).toEqual([c, regoleDa(c, 'x').lette])
})

/** Settings on the Summary step with no routing.json, ready to create the default rules. */
async function senzaRegole($: Parameters<TestBody>[0], on: On) {
  const amb = ambiente(on)
  amb.disco.lingua = 'en'
  amb.disco.delete('X:/repo/.claude/routing.json')
  amb.disco.set(CONFIG, JSON.stringify({ progetti: { 'esempio/demo': {} } }))
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'chipmanager', args: '--setup' } as never)
  const ui = await $.ui.mount({ ...PANE('terminal', 60) })
  await ui.press({ key: 'setup-riepilogo-vai' })
  return { amb, ui }
}

test('default rules, empty repository (terminal, 60 columns): the confirmation shows path and full text; then the file exists and starts are unblocked', async ($, on) => {
  const { amb, ui } = await senzaRegole($, on)
  expect(testi(await ui.drawn()).join('\n')).toContain('nothing starts until routing.json can be read')
  amb.popup.risposta = q => (q.includes('X:/repo/.claude/routing.json') && q.includes(testoRegoleIniziali()) ? 'Create default rules' : null)
  await ui.press({ key: 'regole-guida-crea' })
  expect(amb.disco.get('X:/repo/.claude/routing.json')).toBe(testoRegoleIniziali())
  expect(amb.toast).toContain('Default rules created')
  const testo = testi(await ui.drawn()).join('\n')
  expect([testo.includes('nothing starts until routing.json can be read'), !!(await ui.find({ key: 'regole-guida' }))]).toEqual([false, false])
  await ui.unmount()
})

test('default rules: Cancel writes nothing and runs nothing', async ($, on) => {
  const { amb, ui } = await senzaRegole($, on)
  amb.popup.risposta = () => 'Undo'
  await ui.press({ key: 'regole-guida-crea' })
  expect([amb.disco.has('X:/repo/.claude/routing.json'), amb.processi.some(x => x[1]?.endsWith('/regole-crea.cjs'))]).toEqual([false, false])
  expect(await ui.find({ key: 'regole-guida-crea' })).toBeDefined()
  await ui.unmount()
})

test('default rules: a file that appeared meanwhile is never overwritten; a path through a link is refused', async ($, on) => {
  const { amb, ui } = await senzaRegole($, on)
  amb.popup.risposta = () => 'Create default rules'
  // Already there when pressed: nothing asked, nothing written, the error in line.
  amb.disco.set('X:/repo/.claude/routing.json', '{"mio":true}')
  await ui.press({ key: 'regole-guida-crea' })
  expect([amb.disco.get('X:/repo/.claude/routing.json'), amb.domande.length, amb.processi.some(x => x[1]?.endsWith('/regole-crea.cjs'))]).toEqual(['{"mio":true}', 0, false])
  expect(testi(await ui.drawn()).join('\n')).toContain('routing.json already exists: it is never overwritten')
  // Created by someone else between the question and the write: the helper refuses (exclusive creation).
  amb.disco.delete('X:/repo/.claude/routing.json')
  amb.popup.risposta = () => (amb.disco.set('X:/repo/.claude/routing.json', '{"altro":true}'), 'Create default rules')
  await ui.press({ key: 'regole-guida-crea' })
  expect([amb.disco.get('X:/repo/.claude/routing.json'), amb.processi.filter(x => x[1]?.endsWith('/regole-crea.cjs')).length]).toEqual(['{"altro":true}', 1])
  expect(testi(await ui.drawn()).join('\n')).toContain('routing.json already exists: it is never overwritten')
  // `.claude` is a junction: refused, nothing written.
  amb.disco.delete('X:/repo/.claude/routing.json')
  amb.collegati.add('X:/repo/.claude')
  amb.popup.risposta = () => 'Create default rules'
  await ui.press({ key: 'regole-guida-crea' })
  expect(amb.disco.has('X:/repo/.claude/routing.json')).toBe(false)
  expect(testi(await ui.drawn()).join('\n')).toContain('goes through a link or junction')
  await ui.unmount()
})

test('default rules: the configured routing path has one normal form for confirmation, writing and reading; a backslash is refused', async ($, on) => {
  expect(progettoDa({ progetti: { 'esempio/demo': { routing: './regole//routing.json' } } }, 'esempio/demo')).toMatchObject({ routing: 'regole/routing.json' })
  expect(progettoDa({ progetti: { 'esempio/demo': { routing: 'regole\\routing.json' } } }, 'esempio/demo')).toEqual({ k: 'cfg.routing' })
  const amb = ambiente(on)
  amb.disco.lingua = 'en'
  amb.disco.delete('X:/repo/.claude/routing.json')
  amb.disco.set(CONFIG, JSON.stringify({ progetti: { 'esempio/demo': { routing: './regole//routing.json' } } }))
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'chipmanager', args: '--setup' } as never)
  const ui = await $.ui.mount({ ...PANE('terminal', 60) })
  await ui.press({ key: 'setup-riepilogo-vai' })
  amb.popup.risposta = () => 'Create default rules'
  await ui.press({ key: 'regole-guida-crea' })
  // The confirmation, the helper and the reader all use X:/repo/regole/routing.json.
  expect(amb.domande.at(-1)).toContain('Create X:/repo/regole/routing.json with this content?')
  expect(amb.processi.some(x => x[1]?.endsWith('/regole-crea.cjs'))).toBe(true)
  expect([amb.disco.get('X:/repo/regole/routing.json'), !!(await ui.find({ key: 'regole-guida' }))]).toEqual([testoRegoleIniziali(), false])
  await ui.unmount()
})

test('audit 8: a malformed config does not break the Project section: it shows the config error', async ($, on) => {
  const amb = ambiente(on)
  amb.disco.lingua = 'en'
  amb.variabili.CHIPMANAGER_DIR = ''
  amb.disco.set(CONFIG, '{')
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: 'impostazioni' })
  await ui.press({ key: 'sezione-progetto-premi' })
  expect(await ui.find({ key: 'pagina-progetto' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'config.json cannot be read' })).toBeDefined()
  await ui.unmount()
})

test('F11.2 setup: lingua e preset del modo di lavoro vanno nella bozza; il riepilogo li elenca; Applica scrive tutto con un solo CAS', async ($, on) => {
  const amb = ambiente(on)
  amb.disco.lingua = 'en'
  amb.disco.set(CONFIG, JSON.stringify({ progetti: { 'esempio/demo': {} } }))
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'chipmanager', args: '--setup' } as never)
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: 'lingua-de-premi' })
  for (let i = 0; i < 5; i++) await ui.press({ key: 'setup-avanti' })
  // F12: on graphical surfaces «Step n of m» is right-aligned, apart from the step title.
  expect(testi(await ui.drawn())).toEqual(expect.arrayContaining(['Step 6 of 7', 'Work mode']))
  await ui.press({ key: 'modo-preset-economico-premi' })
  await ui.press({ key: 'setup-avanti' })
  expect(testi(await ui.drawn()).join('\n')).toMatch(/2 unsaved changes in: (Language, Work mode|Work mode, Language)/)
  expect(amb.configure()).toBe(0)
  await ui.press({ key: 'applica' })
  expect(amb.configure()).toBe(1)
  const c = JSON.parse(amb.disco.get(CONFIG)!)
  expect(c.lingua).toBe('de')
  expect(c.account.modoLavoro).toEqual({ effortPredefinito: { R0: 'low', R1: 'low', R2: 'medium' }, auditorSuggerito: false, revisioneIncrociata: false })
})

test('F11.2 setup dall\'IA: una proposta di proponi_impostazioni riempie la bozza e --setup apre sul riepilogo; niente si scrive senza Applica', async ($, on) => {
  const amb = ambiente(on)
  amb.disco.lingua = 'en'
  amb.disco.set(CONFIG, JSON.stringify({ progetti: { 'esempio/demo': {} } }))
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  const r = await proponi($, { motivo: 'Light work on docs.', account: { modoLavoro: { effortPredefinito: { R1: 'low' }, revisioneIncrociata: false } } })
  expect(r.result).toMatch(/^Settings proposal recorded/)
  await $.command.run({ command: 'chipmanager', args: '--setup' } as never)
  expect(testi(await ui.drawn())).toEqual(expect.arrayContaining(['Step 7 of 7', 'Summary']))
  expect(await ui.find({ type: 'Text', text: 'Light work on docs.' })).toBeDefined()
  expect(amb.configure()).toBe(0)
  await ui.press({ key: 'applica' })
  expect(JSON.parse(amb.disco.get(CONFIG)!).account.modoLavoro).toEqual({ effortPredefinito: { R1: 'low' }, revisioneIncrociata: false })
})

test('F11.2 setup: nessuna chiave passa mai dal pannello: il passo delle chiavi dice solo presenza e percorso, senza campi', { options: { anthropicApiKey: 'sk-ant-prova-SEGRETO-123', deepseekKey: 'ds-prova-SEGRETO-456' } }, async ($, on) => {
  const amb = ambiente(on)
  amb.disco.lingua = 'en'
  amb.disco.set(CONFIG, JSON.stringify({ progetti: { 'esempio/demo': { fornitori: ['claude', 'codex', 'deepseek'] } } }))
  const copiati: string[] = []
  on('ui.copy', (_, e) => (copiati.push(String((e as { text?: unknown }).text)), { value: { isCopied: true } as never }))
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'chipmanager', args: '--setup' } as never)
  const ui = await $.ui.mount({ ...PANE('desktop') })
  for (let i = 0; i < 3; i++) await ui.press({ key: 'setup-avanti' })
  expect(testi(await ui.drawn())).toEqual(expect.arrayContaining(['Step 4 of 7', 'API keys · you']))
  const albero = JSON.stringify(await ui.drawn())
  expect(albero).not.toContain('SEGRETO')
  expect(testi(await ui.drawn()).join('\n')).toContain('Anthropic API (credits) · key set')
  expect(testi(await ui.drawn()).join('\n')).toContain('DeepSeek · key set')
  expect(await ui.find({ type: 'Input' })).toBeUndefined()
  await ui.press({ key: 'setup-chiavi-copia' })
  expect(copiati).toEqual(['/config'])
  for (let i = 0; i < 3; i++) await ui.press({ key: 'setup-avanti' })
  await ui.press({ key: 'applica' }).catch(() => undefined)
  expect([...amb.disco.values()].join('\n')).not.toContain('SEGRETO')
  expect(amb.processi.flat().join(' ')).not.toContain('SEGRETO')
})

// --- F11.4: il rapporto a chipManager ----------------------------------------------------------------------------------

test('F11.4 redattore: su ingressi avversari esce solo da elenchi chiusi (niente percorsi, nomi, codice, chiavi, email)', () => {
  const SEGRETI = ['X:/casa/persona/progetto-segreto', 'persona@esempio.it', 'sk-ant-SEGRETO', 'ghp_SEGRETO', 'acme/progetto-segreto', 'function rubare()', 'Mario Rossi', 'org-42']
  const testo = rapportoRedatto({
    versione: 'sk-ant-SEGRETO', superficie: 'X:/casa/persona/progetto-segreto', host: '2.1.280',
    account: { apiClaude: { budgetUsd: 5, chiave: 'sk-ant-SEGRETO' }, 'persona@esempio.it': 1, soglie: { claude: null }, freellmapi: { endpoint: 'ghp_SEGRETO' } },
    progetto: { fornitori: ['acme/progetto-segreto'], profilo: 'Mario Rossi', board: null, 'function rubare()': 'org-42', restrizioni: undefined },
    codici: ['lock.api', 'config.illeggibile', 'X:/casa/persona/progetto-segreto', 'persona@esempio.it', 'lock.api', 42, { codice: 'ghp_SEGRETO' }],
  })
  for (const s of SEGRETI) expect([s, testo.includes(s)]).toEqual([s, false])
  expect(testo).toBe([
    '### chipManager report',
    '- mod: unknown',
    '- surface: unknown',
    '- host: 2.1.280',
    '- account shape: soglie:object, apiClaude:object, freellmapi:object',
    '- project shape: fornitori:array, board:null, profilo:string',
    '- doctor findings: config.illeggibile, lock.api',
  ].join('\n'))
  // L'URL precompilato ha un limite: oltre, solo il testo da copiare.
  expect(urlRapporto(testo)!.startsWith('https://github.com/Elite9400/chipManager/issues/new?title=')).toBe(true)
  expect(urlRapporto('x'.repeat(MAX_URL))).toBeUndefined()
})

test('F11.4 doctor: «Segnala» mostra il rapporto per intero; apertura e gh solo dopo un sì, con esattamente quel testo', async ($, on) => {
  const amb = ambiente(on)
  amb.disco.lingua = 'en'
  amb.disco.set(CONFIG, JSON.stringify({ account: { apiClaude: { budgetUsd: 5 } }, progetti: { 'esempio/demo': { profilo: 'risparmio' } } }))
  amb.esec.diagnosi = () => JSON.stringify({ trovati: [{ codice: 'lock.api', minuti: 3 }], versione: '2.2.0' })
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  // Il controllo dell'esecuzione dice se gh è collegato (il pulsante «Crea con gh» c'è solo allora).
  await ui.press({ key: 'impostazioni' })
  await ui.press({ key: 'sezione-esecuzione-premi' })
  await $.command.run({ command: 'chipmanager', args: '--doctor' } as never)
  await ui.press({ key: 'doctor-segnala' })
  const testo = testi(await ui.drawn()).find(t => t.startsWith('### chipManager report'))!
  expect(testo).toContain('- doctor findings: lock.api')
  expect(testo).not.toContain('esempio/demo')
  expect(testo).not.toContain('risparmio')
  const inviati = () => amb.processi.filter(p => p[2] === 'apri-url' || p[2] === 'segnala-gh')
  expect(inviati().length).toBe(0)
  amb.popup.risposta = () => 'Cancel'
  await ui.press({ key: 'doctor-rapporto-apri' })
  await ui.press({ key: 'doctor-rapporto-gh' })
  expect(inviati().length).toBe(0)
  amb.popup.risposta = q => (q.startsWith('Open GitHub') ? 'Open on GitHub' : 'Create with gh')
  await ui.press({ key: 'doctor-rapporto-apri' })
  expect(inviati()[0]!.slice(2)).toEqual(['apri-url', urlRapporto(testo)!])
  await ui.press({ key: 'doctor-rapporto-gh' })
  expect(amb.processi.filter(p => p[2] === 'segnala-gh').length).toBe(1)
  expect(amb.toast).toContain('Issue created')
})

// --- F11, revisione Codex ----------------------------------------------------------------------------------------------

test('F11 rilievo 1: --doctor con config rotto e senza CHIPMANAGER_DIR chiama comunque la diagnosi e mostra i rilievi', async ($, on) => {
  const amb = ambiente(on)
  amb.variabili.CHIPMANAGER_DIR = ''
  amb.disco.set(CONFIG, '{ rotto')
  amb.esec.diagnosi = () => JSON.stringify({ trovati: [{ codice: 'config.illeggibile', copie: 1 }], versione: '2.2.0', impronta: 'b'.repeat(64) })
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'chipmanager', args: '--doctor' } as never)
  const d = amb.processi.find(p => p[2] === 'diagnosi')
  expect(d).toBeDefined()
  // La cartella dei dati non si sa (dipende dal config): la diagnosi la riceve vuota e salta quei controlli.
  expect(d![4]).toBe('')
  const ui = await $.ui.mount({ ...PANE('desktop') })
  expect(await ui.find({ key: 'doctor-rimedio-0' })).toBeDefined()
})

test('F11 rilievo 6: nel setup e nel doctor l\'accesso mostra il codice di GitHub, il ripiego da copiare, e il ricontrollo continua', async ($, on) => {
  const amb = ambiente(on)
  amb.disco.lingua = 'en'
  amb.disco.set(CONFIG, JSON.stringify({ progetti: { 'esempio/demo': { milestoneGithub: true } } }))
  amb.esec.stato = () => JSON.stringify({ claude: { trovato: true, loggedIn: true }, github: { trovato: true, loggedIn: false, remote: true, host: 'github.com' }, codex: { trovato: true, loggedIn: true }, fonti: [] })
  amb.esec.accedi = () => [0, '{"codice":"AB12-CD34"}']
  const clock = mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'chipmanager', args: '--setup' } as never)
  const ui = await $.ui.mount({ ...PANE('desktop') })
  for (let i = 0; i < 2; i++) await ui.press({ key: 'setup-avanti' })
  await ui.press({ key: 'setup-accedi-gh' })
  expect(testi(await ui.drawn()).join('\n')).toContain('Code to enter on GitHub: AB12-CD34')
  const prima = amb.esec.controlli
  for (let t = 0; t < 15_000; t += 5000) await clock.advance(5000)
  expect(amb.esec.controlli).toBeGreaterThan(prima)
  // Il ripiego: se il login non parte, la riga da copiare.
  amb.esec.accedi = () => [1, '{"copia":"codex login"}']
  amb.esec.stato = () => JSON.stringify({ claude: { trovato: true, loggedIn: true }, github: { trovato: true, loggedIn: true, remote: true, host: 'github.com' }, codex: { trovato: true, loggedIn: false }, fonti: [] })
  // Il ricontrollo di GitHub vede il login fatto e si ferma.
  await clock.advance(5000)
  await ui.press({ key: 'setup-ricontrolla' })
  await ui.press({ key: 'setup-accedi-codex' })
  expect(testi(await ui.drawn()).join('\n')).toContain('codex login')
  expect(await ui.find({ key: 'setup-copia-premi' })).toBeDefined()
  // Nel doctor lo stesso: «Accedi» poi codice.
  amb.esec.accedi = () => [0, '{"codice":"ZX98-YW76"}']
  amb.esec.diagnosi = () => JSON.stringify({ trovati: [{ codice: 'accesso.github', trovato: true }], versione: '2.2.0' })
  await $.command.run({ command: 'chipmanager', args: '--doctor' } as never)
  await ui.press({ key: 'doctor-rimedio-0' })
  expect(testi(await ui.drawn()).join('\n')).toContain('Code to enter on GitHub: ZX98-YW76')
})

test('F11 rilievo 7: nel setup i limiti hanno budget e tetto API e il modo di lavoro il consigliere; tutto con un solo Applica', async ($, on) => {
  const amb = ambiente(on)
  amb.disco.lingua = 'en'
  amb.disco.set(CONFIG, JSON.stringify({ progetti: { 'esempio/demo': {} } }))
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'chipmanager', args: '--setup' } as never)
  const ui = await $.ui.mount({ ...PANE('desktop') })
  for (let i = 0; i < 4; i++) await ui.press({ key: 'setup-avanti' })
  await ui.input({ key: 'ese-budget', text: '15' })
  await ui.press({ key: 'setup-avanti' })
  await ui.press({ key: 'consigliere-applica-premi' })
  expect(amb.configure()).toBe(0)
  await ui.press({ key: 'applica' })
  expect(amb.configure()).toBe(1)
  const c = JSON.parse(amb.disco.get(CONFIG)!)
  expect(c.account.apiClaude.budgetUsd).toBe(15)
  expect(c.progetti['esempio/demo'].consigliere).toBe('applica')
})

test('F11 giro 2, rilievo 2: a login GitHub riuscito il rilievo del doctor cade da solo, senza rifare la diagnosi', async ($, on) => {
  const amb = ambiente(on)
  amb.disco.lingua = 'en'
  amb.disco.set(CONFIG, JSON.stringify({ progetti: { 'esempio/demo': { milestoneGithub: true } } }))
  const stato = (gh: boolean) => JSON.stringify({ claude: { trovato: true, loggedIn: true }, github: { trovato: true, loggedIn: gh, remote: true, host: 'github.com' }, codex: { trovato: true, loggedIn: true }, fonti: [] })
  amb.esec.stato = () => stato(false)
  amb.esec.accedi = () => [0, '{"codice":"AB12-CD34"}']
  amb.esec.diagnosi = () => JSON.stringify({ trovati: [{ codice: 'accesso.github', trovato: true }, { codice: 'lock.api', minuti: 2 }], versione: '2.2.0' })
  const clock = mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'chipmanager', args: '--doctor' } as never)
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: 'doctor-rimedio-0' })
  expect(testi(await ui.drawn()).join('\n')).toContain('Code to enter on GitHub: AB12-CD34')
  const diagnosi = amb.processi.filter(p => p[2] === 'diagnosi').length
  amb.esec.stato = () => stato(true)
  await clock.advance(5000)
  const testo = testi(await ui.drawn()).join('\n')
  expect(testo).not.toContain('GitHub not signed in')
  expect(testo).toContain('API Claude lane held for 2 min')
  expect(amb.processi.filter(p => p[2] === 'diagnosi').length).toBe(diagnosi)
})


test('F12 setup e doctor: una sola scheda, azioni in ordine, bozza e scope invariati', async ($, on) => {
  const amb = ambiente(on)
  amb.disco.lingua = 'en'
  amb.disco.set(CONFIG, JSON.stringify({ progetti: { 'esempio/demo': {} } }))
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const basi = (n: unknown): number => {
    if (!n || typeof n !== 'object') return 0
    if (Array.isArray(n)) return n.reduce((somma, x) => somma + basi(x), 0)
    const x = n as { props?: Record<string, unknown>; children?: unknown }
    return Number(x.props?.backgroundColor === `${GRIGIO}${VELO.riquadro}`) + basi(x.children)
  }
  for (const surface of ['desktop', 'terminal'] as const) {
    await $.command.run({ command: 'chipmanager', args: '--setup' } as never)
    const ui = await $.ui.mount(PANE(surface, 60))
    for (let i = 0; i < 7; i++) {
      expect(basi(await ui.drawn())).toBe(surface === 'terminal' ? 0 : 1)
      expect((await ui.find({ key: 'pagina-setup' }))?.props.padding).toBe(surface === 'terminal' ? 0 : 'md')
      expect((await ui.find({ key: 'setup-azioni' }))?.props.flexWrap).toBe('wrap')
      expect((await ui.find({ key: 'setup-introduzione' }))?.props.gap).toBe(surface === 'terminal' ? 0 : 'xs')
      expect((await ui.find({ key: 'setup-azioni' }))?.props.rowGap).toBe(surface === 'terminal' ? 0 : 'xs')
      expect(await ui.find({ type: 'Text', text: surface === 'terminal' ? new RegExp(`^Step ${i + 1} of 7 · `) : `Step ${i + 1} of 7` })).toBeDefined()
      if (i < 6) await ui.press({ key: 'setup-avanti' })
    }
    expect(amb.configure()).toBe(0)
    await ui.press({ key: 'setup-chiudi' })
    expect(await ui.find({ key: 'sezioni-account' })).toBeDefined()
    expect(await ui.find({ key: 'sezioni-progetto' })).toBeDefined()
    await $.command.run({ command: 'chipmanager', args: '--doctor' } as never)
    expect(basi(await ui.drawn())).toBe(surface === 'terminal' ? 0 : 1)
    // I Text non portano la loro chiave nell'albero disegnato: si cercano per testo.
    expect(await ui.find({ type: 'Text', text: 'Nothing to fix.' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'All checks passed' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^0 findings · / })).toBeDefined()
    expect((await ui.find({ key: 'doctor-azioni' }))?.props.flexWrap).toBe('wrap')
    expect((await ui.find({ key: 'doctor-azioni' }))?.props.rowGap).toBe(surface === 'terminal' ? 0 : 'xs')
    await ui.press({ key: 'doctor-indietro' })
    await ui.unmount()
  }
})

test('Percorsi, doctor: la cartella dati in un repository offre «Sposta i dati…» solo su conferma; con CHIPMANAGER_DIR no', async ($, on) => {
  const amb = ambiente(on, { cartella: 'X:/repo/dati' })
  amb.disco.lingua = 'en'
  amb.disco.set(CONFIG, JSON.stringify({ progetti: { 'esempio/demo': { cartella: 'X:/repo/dati' } } }))
  amb.variabili.CHIPMANAGER_DIR = ''
  amb.esec.diagnosi = () => JSON.stringify({ trovati: [{ codice: 'percorso.dati', motivo: 'helper.dentroWorkingTree: X:/repo' }], versione: '2.2.0', impronta: 'd'.repeat(64) })
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'chipmanager', args: '--doctor' } as never)
  const ui = await $.ui.mount({ ...PANE('desktop') })
  expect((await ui.find({ key: 'doctor-rimedio-0' }))?.props).toMatchObject({ label: 'Move data…' })
  amb.popup.risposta = () => 'Cancel'
  await ui.press({ key: 'doctor-rimedio-0' })
  expect(amb.processi.filter(p => p[2] === 'sposta-dati').length).toBe(0)
  amb.popup.risposta = () => 'Apply fix'
  await ui.press({ key: 'doctor-rimedio-0' })
  const p = amb.processi.find(x => x[2] === 'sposta-dati')!
  expect(p.slice(3)).toEqual([CONFIG, 'esempio/demo', 'X:/repo/dati', 'X:/casa/.claude/chipmanager/progetti/esempio__demo'])
  expect(amb.esec.spostati).toEqual([JSON.stringify({ impronta: 'd'.repeat(64) })])
  expect(amb.domande.some(q => q.includes('X:/repo/dati') && q.includes('X:/casa/.claude/chipmanager/progetti/esempio__demo'))).toBe(true)
  // Con la cartella decisa da CHIPMANAGER_DIR il config non la cambia: nessun pulsante.
  amb.variabili.CHIPMANAGER_DIR = 'X:/repo/dati'
  await $.command.run({ command: 'chipmanager', args: '--doctor' } as never)
  expect(await ui.find({ key: 'doctor-rimedio-0' })).toBeUndefined()
})

test('Percorsi, rilievo 4: link saltati nello spostamento: nomi detti, Annulla non cambia niente, il sì riprova solo con quei nomi accettati', async ($, on) => {
  const amb = ambiente(on, { cartella: 'X:/repo/dati' })
  amb.disco.lingua = 'en'
  amb.disco.set(CONFIG, JSON.stringify({ progetti: { 'esempio/demo': { cartella: 'X:/repo/dati' } } }))
  amb.variabili.CHIPMANAGER_DIR = ''
  amb.esec.saltati = ['board']
  amb.esec.diagnosi = () => JSON.stringify({ trovati: [{ codice: 'percorso.dati', motivo: 'helper.collegamento: X:/repo/dati/board' }], versione: '2.2.0', impronta: 'e'.repeat(64) })
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'chipmanager', args: '--doctor' } as never)
  const ui = await $.ui.mount({ ...PANE('desktop') })
  amb.popup.risposta = q => (q.startsWith('These are links') ? 'Cancel' : 'Apply fix')
  await ui.press({ key: 'doctor-rimedio-0' })
  expect(amb.esec.spostati).toEqual([JSON.stringify({ impronta: 'e'.repeat(64) })])
  expect(amb.domande.some(q => q.startsWith('These are links') && q.includes('board'))).toBe(true)
  expect(amb.toast).toContain('Data not moved: nothing changed')
  amb.popup.risposta = q => (q.startsWith('These are links') ? 'Move without them' : 'Apply fix')
  await ui.press({ key: 'doctor-rimedio-0' })
  expect(amb.esec.spostati.at(-1)).toBe(JSON.stringify({ impronta: 'e'.repeat(64), accettaSaltati: ['board'] }))
})

test('Paths, round 2 finding 3: 51 skipped links: every name shown a page at a time, the whole set confirmed; a changed set never reads as a config change', async ($, on) => {
  const amb = ambiente(on, { cartella: 'X:/repo/dati' })
  amb.disco.lingua = 'en'
  amb.disco.set(CONFIG, JSON.stringify({ progetti: { 'esempio/demo': { cartella: 'X:/repo/dati' } } }))
  amb.variabili.CHIPMANAGER_DIR = ''
  const nomi = Array.from({ length: 51 }, (_, i) => `link-${String(i).padStart(2, '0')}`)
  amb.esec.saltati = nomi
  amb.esec.diagnosi = () => JSON.stringify({ trovati: [{ codice: 'percorso.dati', motivo: 'helper.collegamento: X:/repo/dati/link-00' }], versione: '2.2.0', impronta: 'f'.repeat(64) })
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'chipmanager', args: '--doctor' } as never)
  const ui = await $.ui.mount({ ...PANE('desktop') })
  amb.popup.risposta = q => (q.startsWith('These are links') ? 'Move without them' : 'Apply fix')
  await ui.press({ key: 'doctor-rimedio-0' })
  const pagine = amb.domande.filter(q => q.startsWith('These are links'))
  expect(pagine.length).toBe(3)
  for (const n of nomi) expect(pagine.some(q => q.includes(n))).toBe(true)
  expect(amb.esec.spostati.at(-1)).toBe(JSON.stringify({ impronta: 'f'.repeat(64), accettaSaltati: nomi }))
  expect(amb.toast.some(t => t.startsWith('Data copied to'))).toBe(true)
  // The set changes between the question and the move: the helper refuses, and the message says nothing moved.
  amb.toast.length = 0
  amb.popup.risposta = q => {
    if (q.startsWith('These are links')) amb.esec.saltati = [...nomi, 'link-nuovo']
    return q.startsWith('These are links') ? 'Move without them' : 'Apply fix'
  }
  amb.esec.saltati = nomi
  await ui.press({ key: 'doctor-rimedio-0' })
  expect(amb.toast).toContain('Data not moved: nothing changed')
  expect(amb.toast.some(t => t.startsWith('Settings changed elsewhere'))).toBe(false)
})

test('F13.1 doctor: Claude Code più vecchio di 2.1.321 = avviso per Fable 5.2; 2.1.321 o più nuovo, o versione ignota, nessun avviso', async ($, on) => {
  const amb = ambiente(on)
  amb.disco.lingua = 'en'
  amb.disco.set(CONFIG, JSON.stringify({ progetti: { 'esempio/demo': {} } }))
  let versione: string | null = '2.1.300'
  on('session.version', () => {
    if (versione === null) throw new Error('ignota')
    return { value: { version: versione, base: versione } as never }
  })
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'chipmanager', args: '--doctor' } as never)
  const ui = await $.ui.mount({ ...PANE('desktop') })
  expect(testi(await ui.drawn()).join('\n')).toContain('Claude Code 2.1.300 is older than 2.1.321')
  for (const v of ['2.1.321', '2.2.0', null]) {
    versione = v
    await ui.press({ key: 'doctor-ricontrolla' })
    expect([v, testi(await ui.drawn()).join('\n').includes('older than 2.1.321')]).toEqual([v, false])
  }
})
