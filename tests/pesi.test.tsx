import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import {
  alLavoroDa,
  annullabile,
  applicaPatch,
  conProfilo,
  contestoPerModello,
  daDecidere,
  decisaIl,
  proposteBrevi,
  statoVisto,
  descriviPesi,
  profiloDi as profiloDaBilanciamento,
  propostaDa,
  proposteDa,
  riassuntoProposta,
  rispostaRisorse,
  TESTI_PESI,
  TETTO_RISORSE,
} from '../hooks/bilanciamento'

test('risorse_agenti: ridotta, tiene i 5 modelli con più sessioni (50 → 46), non i primi dell\'elenco', () => {
  const contesto = Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`modello-di-esempio-${String(i + 1).padStart(2, '0')}`, { media: 50, massimo: 60, misurate: `1 of ${i + 1}`, ultima: null }]))
  const r = JSON.parse(rispostaRisorse({ contesto }, 1200)) as { contesto: Record<string, unknown> }
  expect(Object.keys(r.contesto).sort()).toEqual(['46', '47', '48', '49', '50'].map(n => `modello-di-esempio-${n}`))
})
import { bilancia, MOLTIPLICATORE_CORSIA, pianifica, profiloDi, punteggio, regoleDa, risorseDa, RISORSE_DEFAULT, radiceProgetto, sessioniCodex } from '../hooks/logica'
import type { Azione, Chiamante, Corsia, Peso, Regole, SessioneProgetto } from '../types'
import { DiscoIt } from './disco-it'
// F13.5: per le prove di sola CPU (orologio finto, molti render) che da sole superano metà dei 5 s del kit e sotto carico
// li passano: il tempo serve davvero. Il valore non cambia nessuna attesa delle prove, solo il tetto del kit.
const LUNGA = { timeoutMs: 20_000 }

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
  // F11.1: in R2 il predefinito è medium (prima high); il modo di lavoro può riportarlo a high.
  const b = azione('a-corsia04', 'R2', { revisore: 'claude' })
  expect(bilancia(b, { esecutore: 'claude', modello: 'claude-sonnet-5-5' }, r, [], [b], CHI).effort).toBe('medium')
  const alto = conRisorse({ fornitori: ['claude'], modoLavoro: { ...RISORSE_DEFAULT.modoLavoro, effortPredefinito: { ...RISORSE_DEFAULT.modoLavoro.effortPredefinito, R2: 'high' } } })
  expect(bilancia(b, { esecutore: 'claude', modello: 'claude-sonnet-5-5' }, alto, [], [b], CHI).effort).toBe('high')
})

test('corsia nel massivo, caso predefinito: Automatico senza nessun peso salvato, la R1 a xhigh scende sotto la R3', () => {
  const r = conRisorse({})
  expect(r.risorse.pesi).toEqual([])
  const leggera = azione('a-massa101', 'R1', { effort: 'xhigh', revisore: 'claude', modello: 'claude-sonnet-5-5' })
  const pesante = azione('a-massa102', 'R3', { effort: 'xhigh', revisore: 'claude', modello: 'claude-sonnet-5-5', ordine: 2 })
  expect(punteggio(leggera, r, [], [])).toBeLessThan(punteggio(pesante, r, [], []))
  expect(pianifica([leggera, pesante], [leggera, pesante], r, 1).avvia[0]!.id).toBe(pesante.id)
  // Nessuna chip toccata dalla corsia (R1 a medium): senza pesi l'ordine resta quello dell'utente, anche a margini diversi.
  const media = { ...leggera, effort: 'medium' }
  const codexPieno = { id: 'claude-weekly', fornitore: 'claude' as const, nome: 'settimanale', fonte: 'app', letto: new Date().toISOString(), percentuale: 95 }
  const altra = { ...pesante, esecutore: 'codex' as const, modello: 'gpt-6.1-sol', effort: 'xhigh' }
  expect(pianifica([media, altra], [media, altra], r, 1, false, () => [], [codexPieno]).avvia[0]!.id).toBe(media.id)
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

// --- proposte di pesi: logica pura ---------------------------------------------------------------------

test('proponi_pesi: argomenti validati al confine; mai pesi grezzi; risultato calcolato dalla configurazione attuale', () => {
  const r = conRisorse({ fornitori: ['claude', 'codex'] })
  for (const [args, motivo] of [
    [{ profilo: 'risparmio' }, 'motivo'],
    [{ profilo: 'risparmio', motivo: 'x'.repeat(301) }, 'motivo'],
    [{ profilo: 'economico', motivo: 'm' }, 'profilo'],
    [{ motivo: 'm' }, 'a profilo'],
    [{ motivo: 'm', pesi: [MODELLO] }, 'fields not allowed'],
    [{ motivo: 'm', fornitori: ['codex'] }, 'fields not allowed'],
    [{ motivo: 'm', regolazioni: [{ tipo: 'fornitore', nome: 'deepseek', posizione: 3 }] }, 'is not an allowed fornitore'],
    [{ motivo: 'm', regolazioni: [{ tipo: 'modello', nome: 'modello-inventato', posizione: 3 }] }, 'is not an allowed modello'],
    [{ motivo: 'm', regolazioni: [{ tipo: 'effort', nome: 'low', posizione: 5 }] }, 'posizione'],
    [{ motivo: 'm', regolazioni: [{ tipo: 'effort', nome: 'low', posizione: 1, percentuale: 300 }] }, '{ tipo, nome, posizione }'],
    [{ motivo: 'm', regolazioni: [{ tipo: 'effort', nome: 'low', posizione: 1 }, { tipo: 'effort', nome: 'low', posizione: 3 }] }, 'repeated'],
    [{ motivo: 'm', profilo: 'automatico' }, 'changes nothing'],
  ] as const)
    expect(String(propostaDa(args as Record<string, unknown>, r))).toContain(motivo)
  expect(propostaDa({ profilo: 'risparmio', motivo: '  Claude al 78%  ' }, r)).toEqual({ motivo: 'Claude al 78%', profilo: 'risparmio', risultato: { profilo: 'risparmio', pesi: conProfilo([], 'risparmio') } })
  // Una regolazione rende il profilo Personalizzato, come nelle Impostazioni; i pesi dei modelli restano.
  const conModello = conRisorse({ fornitori: ['claude', 'codex'], pesi: [MODELLO] })
  expect(propostaDa({ motivo: 'm', profilo: 'qualita', regolazioni: [{ tipo: 'fornitore', nome: 'codex', posizione: 3 }] }, conModello)).toEqual({
    motivo: 'm', profilo: 'qualita',
    regolazioni: [{ tipo: 'fornitore', nome: 'codex', posizione: 3 }],
    risultato: { profilo: 'personalizzato', pesi: [...conProfilo([MODELLO], 'qualita'), { tipo: 'fornitore', nome: 'codex', percentuale: 40, assoluto: 0 }] },
  })
})

const VOCE = {
  id: 'p-esempio01', versione: 0, progetto: 'esempio/demo', proponente: { id: 'local_0123456789ab', titolo: 'Master' }, quando: ORA, motivo: 'Claude al 78%',
  profilo: 'risparmio', partenza: { profilo: null, pesi: [], revisione: 0 }, risultato: { profilo: 'risparmio', pesi: [] }, stato: 'attesa',
} as const

test('proposte dal file: solo questo progetto, voci di forma sconosciuta saltate, dalla più recente', () => {
  const dopo = { ...VOCE, id: 'p-esempio02', quando: new Date(1000).toISOString() }
  const json = { versione: 3, voci: [VOCE, dopo, { ...VOCE, id: 'p-altro0001', progetto: 'altro/progetto' }, { ...VOCE, id: 'rotto' }, { ...VOCE, id: 'p-esempio03', risultato: { profilo: 'risparmio', pesi: [{ tipo: 'x' }] } }, null] }
  expect(proposteDa(json, 'esempio/demo').map(p => p.id)).toEqual(['p-esempio02', 'p-esempio01'])
  expect(proposteDa(json, null)).toEqual([])
  expect(proposteDa('non un oggetto', 'esempio/demo')).toEqual([])
})

test('riassunto, popup e Annulla: testi raccolti; annullabile solo con la stessa revisione e origine', () => {
  const p = proposteDa({ voci: [{ ...VOCE, regolazioni: [{ tipo: 'fornitore', nome: 'codex', posizione: 3 }, { tipo: 'effort', nome: 'xhigh', posizione: 1 }] }] }, 'esempio/demo')[0]!
  expect(riassuntoProposta(p, 'it')).toBe('Risparmio · Codex Più · effort xhigh Meno')
  expect(TESTI_PESI.riga(p, 'en')).toBe('Weights proposal from “Master” (01234567): Saving · Codex More · effort xhigh Less')
  expect(TESTI_PESI.riga(p, 'it')).toBe('Proposta di pesi da «Master» (01234567): Risparmio · Codex Più · effort xhigh Meno')
  expect(TESTI_PESI.domanda(p, 'it')).toContain('nessun profilo · nessun peso\n→ Risparmio · nessun peso')
  expect(descriviPesi({ profilo: 'personalizzato', pesi: [MODELLO, { tipo: 'effort', nome: 'low', percentuale: 40, assoluto: 0 }] }, 'it')).toContain('effort low Più')
  const applicata = { ...p, stato: 'applicata' as const, decisione: { id: 'd-esempio01', esito: 'applica' as const, quando: ORA, revisione: 4 } }
  expect(annullabile(applicata, { ...RISORSE_DEFAULT, pesiRevisione: 4, pesiOrigine: { tipo: 'proposta', id: 'd-esempio01' } })).toBe(true)
  expect(annullabile(applicata, { ...RISORSE_DEFAULT, pesiRevisione: 5, pesiOrigine: { tipo: 'proposta', id: 'd-esempio01' } })).toBe(false)
  expect(annullabile(applicata, { ...RISORSE_DEFAULT, pesiRevisione: 4, pesiOrigine: { tipo: 'manuale' } })).toBe(false)
  expect(daDecidere(p, Date.parse(ORA) + 23 * 3_600_000)).toBe(true)
  expect(daDecidere(p, Date.parse(ORA) + 25 * 3_600_000)).toBe(false)
})

test('revisione e origine dei pesi nel config: lette se ben formate, altrimenti assenti', () => {
  expect(risorseDa({ pesiRevisione: 3, pesiOrigine: { tipo: 'proposta', id: 'd-esempio01', voce: 'p-esempio01', versione: 0 } })).toMatchObject({
    pesiRevisione: 3, pesiOrigine: { tipo: 'proposta', id: 'd-esempio01', voce: 'p-esempio01', versione: 0 },
  })
  for (const guasto of [{ pesiRevisione: -1 }, { pesiRevisione: 1.5 }, { pesiOrigine: { tipo: 'altro' } }, { pesiOrigine: 'manuale' }]) {
    const r = risorseDa(guasto)
    expect(typeof r).toBe('object')
    expect([r as object].map(x => 'pesiRevisione' in x || 'pesiOrigine' in x)).toEqual([false])
  }
})

test('contesto per modello: solo misure riuscite negli ultimi 5 minuti, con copertura e istante', () => {
  const adesso = Date.parse('2026-11-06T12:00:00Z')
  const fa = (min: number) => new Date(adesso - min * 60_000).toISOString()
  const s = (id: string, extra: Partial<SessioneProgetto>): SessioneProgetto => ({ id, motore: 'claude', titolo: id, modello: 'claude-opus-5-5', stato: 'in-corso', ...extra })
  const sessioni = [
    s('a', { contesto: 40, contestoIl: fa(1) }),
    s('b', { contesto: 80, contestoIl: fa(2) }),
    // Misura valida un tempo, poi solo fallimenti: il numero vecchio non entra nella media.
    s('c', { contesto: 95, contestoIl: fa(20) }),
    s('d', {}),
    s('e', { stato: 'ferma', contesto: 99, contestoIl: fa(1) }),
  ]
  expect(contestoPerModello(sessioni, adesso)).toEqual({ 'claude-opus-5-5': { media: 60, massimo: 80, misurate: '2 of 4', ultima: fa(1) } })
  expect(contestoPerModello([s('x', { contesto: 70, contestoIl: fa(9) })], adesso)['claude-opus-5-5']).toEqual({ media: null, massimo: null, misurate: '0 of 1', ultima: fa(9) })
})

test('risorse_agenti: al lavoro per modello ed effort; risposta sotto 4.000 caratteri anche con 20 sessioni e 50 chip', () => {
  const sessioni: SessioneProgetto[] = Array.from({ length: 20 }, (_, i) => ({
    id: `s-${i}`, motore: 'claude', titolo: `Sessione ${i}`, modello: ['claude-opus-5-5', 'claude-sonnet-5-5'][i % 2], effort: ['high', 'xhigh', 'medium'][i % 3], stato: 'in-corso',
    contesto: 30 + i, contestoIl: ORA,
  }))
  const chip = Array.from({ length: 50 }, (_, i) => azione(`a-chip${String(i).padStart(4, '0')}`, 'R2', { stato: i % 2 ? 'accodata' : 'proposta', effort: ['low', 'high'][i % 2] }))
  const lavoro = alLavoroDa(sessioni, chip, R)
  // Sessioni Opus a high: 0, 6, 12, 18. In coda: le 25 chip dispari, a high sul primo modello ammesso.
  expect(lavoro['claude-opus-5-5 · high']).toEqual({ lavoro: 4, coda: 25 })
  expect(Object.values(lavoro).reduce((n, x) => n + x.coda, 0)).toBe(25)
  const limiti = Array.from({ length: 30 }, (_, i) => ({ id: `limite-${i}`, fornitore: 'claude' as const, nome: `Limite d'esempio numero ${i}`, fonte: 'fonte d\'esempio lunga', letto: ORA, percentuale: i }))
  const pesi = Array.from({ length: 60 }, (_, i) => ({ tipo: 'modello' as const, nome: `modello-${i}`, percentuale: 10, assoluto: 0 }))
  const testo = rispostaRisorse({ regole: { modelli: R.modelli }, politica: { ...RISORSE_DEFAULT, pesi }, limiti, alLavoro: lavoro, contesto: contestoPerModello(sessioni, Date.parse(ORA)), proposte: [] })
  expect(testo.length).toBeLessThanOrEqual(TETTO_RISORSE)
  const d = JSON.parse(testo) as { nota?: string; alLavoro?: object; contesto?: object }
  expect(d.nota).toContain('answer reduced')
  expect(d.alLavoro && d.contesto).toBeTruthy()
  // Una risposta piccola non si tocca.
  expect(JSON.parse(rispostaRisorse({ alLavoro: lavoro }))).toEqual({ alLavoro: lavoro })
})

// --- il pannello contro un engine finto: proposte di pesi --------------------------------------------------

const CONFIG = 'X:/casa/.claude/chipmanager/config.json'
const PROPOSTE = 'X:/casa/.claude/chipmanager/proposte-pesi.json'
type On = Parameters<TestBody>[1]

/**
 * Engine finto: config e proposte in memoria. I comandi `pesi-*` dell'helper sono imitati nel minimo (la loro logica
 * vera, con concorrenza e recupero, la provano le prove del disco): qui si controlla che la mod li chiami bene.
 */
function ambiente(on: On, progetto: Record<string, unknown> = { fornitori: ['claude', 'codex'] }) {
  const disco = new DiscoIt()
  const toast: string[] = []
  const processi: string[][] = []
  const stdin: unknown[] = []
  const domande: string[] = []
  const popup = { risposta: (_: string): string | null => null }
  const p = (s: string | undefined) => (s ?? '').replace(/\\/g, '/')
  disco.set('X:/repo/.claude/routing.json', JSON.stringify({ ...ROUTING, modelli_ammessi: [...ROUTING.modelli_ammessi] }))
  disco.set(CONFIG, JSON.stringify({ progetti: { 'esempio/demo': progetto } }))
  const leggi = (f: string) => JSON.parse(disco.get(f) ?? 'null')
  on('env.get', (_, e) => ({ value: e.name === 'CHIPMANAGER_DIR' ? 'X:/dati' : e.name === 'USERPROFILE' ? 'X:/casa' : undefined }))
  on('session.id', () => ({ value: 'local_sessione-esempio' }))
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
    return { value: { kind: cartella ? 'dir' as const : 'file' as const, size: t?.length ?? 0, mtimeMs: 0, isLink: false, ...(e.resolve && { realPath: q }) } }
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
    const [, script, cmd, ...a] = e.argv
    if (script?.endsWith('/fornitori.cjs')) return fine(0, JSON.stringify({ limiti: [], proxy: 'non abilitato', chiavi: { anthropic: false, deepseek: false, freellmapi: false } }))
    const config = leggi(CONFIG)
    const progettoDi = () => config.progetti['esempio/demo'] as Record<string, unknown>
    const P = (leggi(PROPOSTE) ?? { versione: 0, voci: [] }) as { versione: number; voci: Record<string, unknown>[] }
    const scrivi = () => {
      disco.set(CONFIG, JSON.stringify(config))
      disco.set(PROPOSTE, JSON.stringify({ ...P, versione: P.versione + 1 }))
    }
    if (cmd === 'configura') {
      const q = JSON.parse(e.init!.stdin!)
      stdin.push(q)
      if (disco.get(CONFIG) !== q.atteso) return fine(4)
      // F10: progetto, account e lingua in un solo CAS; null toglie il campo.
      // Come l'helper vero: la stessa fusione (gemello TS di applicaPatch).
      config.progetti[q.repo] = applicaPatch(config.progetti[q.repo] ?? {}, { ...q.campi, ...('pesi' in q.campi || 'profilo' in q.campi ? { pesiRevisione: ((progettoDi().pesiRevisione as number) ?? 0) + 1 } : {}) }, q.togli?.progetto)
      // L'origine dei pesi, come nell'helper, si sostituisce intera.
      if ('pesi' in q.campi || 'profilo' in q.campi) config.progetti[q.repo].pesiOrigine = { tipo: 'manuale' }
      if (q.account) config.account = applicaPatch(config.account ?? {}, q.account, q.togli?.account)
      if (q.lingua !== undefined) config.lingua = q.lingua
      scrivi()
      return fine(0)
    }
    if (cmd === 'pesi-proponi') {
      const q = JSON.parse(e.init!.stdin!)
      stdin.push(q)
      const id = `p-esempio${String(P.voci.length + 1).padStart(2, '0')}`
      P.voci.push({ id, versione: 0, progetto: q.repo, proponente: q.proponente, quando: new Date().toISOString(), motivo: q.motivo, profilo: q.profilo, regolazioni: q.regolazioni,
        partenza: { ...q.partenza, revisione: q.revisione }, risultato: q.risultato, stato: 'attesa' })
      scrivi()
      return fine(0, JSON.stringify({ id, scadute: [] }))
    }
    if (cmd === 'pesi-decidi' || cmd === 'pesi-annulla') {
      const v = P.voci.find(x => x.id === a[2])
      if (!v) return fine(4, 'helper.nonTrovata')
      const prog = progettoDi()
      const R = (prog.pesiRevisione as number) ?? 0
      if (cmd === 'pesi-decidi') {
        if (v.stato !== 'attesa' || String(v.versione) !== a[3]) return fine(4, 'helper.cambiata')
        if (a[4] === 'applica') {
          const r = v.risultato as { profilo: string; pesi: unknown[] }
          Object.assign(prog, { profilo: r.profilo, pesi: r.pesi, pesiRevisione: R + 1, pesiOrigine: { tipo: 'proposta', id: a[5], voce: v.id, versione: v.versione } })
          Object.assign(v, { stato: 'applicata', decisione: { id: a[5], esito: 'applica', quando: new Date().toISOString(), revisione: R + 1 } })
        } else Object.assign(v, { stato: 'rifiutata', decisione: { id: a[5], esito: 'rifiuta', quando: new Date().toISOString() } })
      } else {
        const d = v.decisione as { id: string; revisione: number }
        if (v.stato !== 'applicata' || R !== d.revisione || (prog.pesiOrigine as { id?: string })?.id !== d.id) return fine(4, 'helper.dopoApplicazione')
        const s = v.partenza as { profilo: string | null; pesi: unknown[] }
        Object.assign(prog, { pesi: s.pesi, pesiRevisione: R + 1, pesiOrigine: { tipo: 'annullamento', id: a[3] } })
        if (s.profilo) prog.profilo = s.profilo
        else delete prog.profilo
        Object.assign(v, { stato: 'annullata', annullamento: { id: a[3], quando: new Date().toISOString(), revisione: R + 1 } })
      }
      v.versione = (v.versione as number) + 1
      scrivi()
      return fine(0, '{}')
    }
    return fine(cmd === 'occupata' ? 0 : 2)
  })
  on('mcp.call', (_, e) => ({
    value: { isError: false, content: [{ type: 'text', text: e.tool === 'get_session' ? JSON.stringify({ model: 'claude-opus-5-5', effort: 'xhigh', permissionMode: 'auto', title: 'Master' }) : '{}' }] } as never,
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
  const progettoOra = () => leggi(CONFIG).progetti['esempio/demo'] as Record<string, unknown>
  const comandi = (cmd: string) => processi.filter(x => x[2] === cmd)
  return { disco, toast, domande, popup, stdin, progettoOra, comandi }
}

const PANE = (surface: 'desktop' | 'terminal') =>
  ({
    plugin: 'chip-manager', surface, component: 'Pane', requestId: 'chipManager',
    props: { title: 'chipManager', isFocused: false, bodyColumns: 90, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} },
  }) as const

test('proponi_pesi: il proponente è questa sessione; la proposta compare in Lavoro senza popup; un argomento estraneo è rifiutato', LUNGA, async ($, on) => {
  const amb = ambiente(on)
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const rifiuto = await $.tool.call({ tool: 'mcp__chip-manager__proponi_pesi', motivo: 'm', profilo: 'risparmio', proponente: { id: 'falso' } } as never)
  expect(JSON.stringify(rifiuto)).toContain('fields not allowed')
  expect(amb.comandi('pesi-proponi')).toHaveLength(0)
  const r = await $.tool.call({ tool: 'mcp__chip-manager__proponi_pesi', motivo: 'Claude settimanale al 78%', profilo: 'risparmio' } as never)
  expect(JSON.stringify(r)).toContain('Proposal recorded (id p-esempio01): the owner decides it')
  expect(amb.stdin[0]).toMatchObject({
    repo: 'esempio/demo', proponente: { id: 'local_sessione-esempio', titolo: 'Master' }, partenza: { profilo: null, pesi: [] }, revisione: 0,
    risultato: { profilo: 'risparmio', pesi: conProfilo([], 'risparmio') },
  })
  // Nessun cambio di config senza decisione, e nessun popup aperto dal giro.
  expect(amb.progettoOra()).toEqual({ fornitori: ['claude', 'codex'] })
  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await $.ui.mount({ ...PANE(surface) })
    expect(await ui.find({ type: 'Text', text: /Proposta di pesi da «Master» \(sessione\): Risparmio/ })).toBeDefined()
    for (const k of ['rivedi', 'applica', 'rifiuta']) expect(await ui.find({ key: `lavoro-pesi-p-esempio01-${k}` })).toBeDefined()
    await ui.unmount()
  }
  expect(amb.domande).toEqual([])
})

test('Rivedi: il popup solo dal pulsante; chiuso, Applica e Rifiuta restano; Applica passa versione e chiave nuova', async ($, on) => {
  const amb = ambiente(on)
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'mcp__chip-manager__proponi_pesi', motivo: 'Claude settimanale al 78%', regolazioni: [{ tipo: 'fornitore', nome: 'codex', posizione: 3 }] } as never)
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: 'lavoro-pesi-p-esempio01-rivedi' })
  expect(amb.domande).toHaveLength(1)
  expect(amb.domande[0]).toContain('nessun profilo · nessun peso\n→ Personalizzato · Codex Più')
  expect(amb.domande[0]).toContain('Motivo: Claude settimanale al 78%')
  expect(amb.comandi('pesi-decidi')).toHaveLength(0)
  expect(await ui.find({ key: 'lavoro-pesi-p-esempio01-applica' })).toBeDefined()
  // Popup con risposta: Applica.
  amb.popup.risposta = () => 'Applica'
  await ui.press({ key: 'lavoro-pesi-p-esempio01-rivedi' })
  const [cmd] = amb.comandi('pesi-decidi')
  expect(cmd!.slice(2, 8)).toEqual(['pesi-decidi', CONFIG, 'esempio/demo', 'p-esempio01', '0', 'applica'])
  expect(cmd![8]).toMatch(/^d-[a-z0-9]{6,40}$/)
  expect(amb.progettoOra()).toMatchObject({ profilo: 'personalizzato', pesi: [{ tipo: 'fornitore', nome: 'codex', percentuale: 40, assoluto: 0 }], pesiRevisione: 1 })
  expect(amb.toast).toContain('Pesi applicati')
  expect(await ui.find({ key: 'lavoro-pesi-p-esempio01-rivedi' })).toBeUndefined()
  // Registro nella vista Carico, con Annulla finché il config porta quell'applicazione.
  await ui.press({ key: 'vista-carico' })
  expect(await ui.find({ type: 'Text', text: /^Applicata il .*proposta da «Master» \(sessione\): Codex Più$/ })).toBeDefined()
  await ui.press({ key: 'carico-pesi-registro-annulla' })
  expect(amb.comandi('pesi-annulla')[0]![6]).toMatch(/^u-[a-z0-9]{6,40}$/)
  expect(amb.progettoOra()).toMatchObject({ pesi: [], pesiRevisione: 2 })
  expect(amb.progettoOra()).not.toHaveProperty('profilo')
  expect(await ui.find({ key: 'carico-pesi-registro-annulla' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /^Annullata il / })).toBeDefined()
  await ui.unmount()
})

test('Rivedi → Apri le impostazioni: la sezione Bilanciamento mostra la proposta con il dettaglio; Rifiuta dalla riga', async ($, on) => {
  const amb = ambiente(on)
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'mcp__chip-manager__proponi_pesi', motivo: 'Molte chip di documentazione', profilo: 'velocita' } as never)
  const ui = await $.ui.mount({ ...PANE('terminal') })
  amb.popup.risposta = () => 'Apri le impostazioni'
  await ui.press({ key: 'lavoro-pesi-p-esempio01-rivedi' })
  expect(await ui.find({ key: 'pagina-bilanciamento' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /nessun profilo · nessun peso → Velocità · effort low Preferisci.*Motivo: Molte chip di documentazione/ })).toBeDefined()
  await ui.press({ key: 'bil-pesi-p-esempio01-rifiuta' })
  expect(amb.comandi('pesi-decidi')[0]!.slice(6, 8)).toEqual(['0', 'rifiuta'])
  expect(amb.progettoOra()).toEqual({ fornitori: ['claude', 'codex'] })
  expect(await ui.find({ key: 'bil-pesi-p-esempio01-rifiuta' })).toBeUndefined()
  await ui.unmount()
})

test('impostazioni: un salvataggio di profilo o pesi passa dall\'helper, che incrementa la revisione e segna l\'origine manuale', async ($, on) => {
  const amb = ambiente(on)
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: 'impostazioni' })
  await ui.press({ key: 'sezione-bilanciamento-premi' })
  await ui.press({ key: 'profilo-qualita-premi' })
  await ui.press({ key: 'applica' })
  expect(amb.stdin.at(-1)).toMatchObject({ campi: { profilo: 'qualita' } })
  expect(amb.progettoOra()).toMatchObject({ profilo: 'qualita', pesiRevisione: 1, pesiOrigine: { tipo: 'manuale' } })
  await ui.unmount()
})

test('risorse_agenti: al lavoro, contesto con copertura e proposte; profilo e soglie restano in politica', async ($, on) => {
  ambiente(on)
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'mcp__chip-manager__proponi_pesi', motivo: 'm', profilo: 'risparmio' } as never)
  const r = (await $.tool.call({ tool: 'mcp__chip-manager__risorse_agenti' } as never)) as { result: string }
  expect(r.result.length).toBeLessThanOrEqual(TETTO_RISORSE)
  const d = JSON.parse(r.result) as Record<string, unknown>
  expect(Object.keys(d)).toEqual(expect.arrayContaining(['politica', 'limiti', 'alLavoro', 'contesto', 'proposte']))
  expect(d.proposte).toEqual([expect.objectContaining({ id: 'p-esempio01', stato: 'attesa', da: 'Master', chiede: 'Saving' })])
  expect(d).not.toHaveProperty('profilo')
  expect(d).not.toHaveProperty('soglie')
  expect(Object.keys(d.politica as object)).toContain('soglie')
})

test('P2 Codex: contesto di una sessione Codex con l\'istante del token_count; senza, nessuna misura datata', () => {
  const radice = radiceProgetto('C:\\Lavori\\Progetto\\')
  const adesso = Date.parse('2026-01-02T12:00:00Z')
  const base = { id: 'esempio-0001', cwd: 'C:/lavori/progetto', attivita: '2026-01-02T11:58:00Z', token: 61_000, finestra: 100_000, inCorso: true }
  expect(sessioniCodex([{ ...base, tokenIl: '2026-01-02T11:30:00Z' }], radice, adesso)[0]).toMatchObject({ contesto: 61, contestoIl: '2026-01-02T11:30:00Z' })
  expect(sessioniCodex([base], radice, adesso)[0]).not.toHaveProperty('contestoIl')
  // Misura di 30 minuti fa con attività recente: fuori dalla media.
  expect(contestoPerModello(sessioniCodex([{ ...base, modello: 'gpt-6-astra', tokenIl: '2026-01-02T11:30:00Z' }], radice, adesso), adesso)['gpt-6-astra']).toMatchObject({ media: null, misurate: '0 of 1' })
})

test('P2 spareggio: l\'ordine per vicinanza vale solo con Automatico in R0–R1; altrove resta il più basso ammesso', () => {
  // Chiamante a medium: high (preferito) non è avviabile da lui; fra gli altri, a pari punteggio, l'ordine di sempre.
  const chi = { ...CHI, effort: 'medium' }
  // F11.1: il predefinito di R2 è medium; qui il modo di lavoro lo riporta a high per provare lo spareggio.
  const r = conRisorse({ fornitori: ['claude'], modoLavoro: { ...RISORSE_DEFAULT.modoLavoro, effortPredefinito: { ...RISORSE_DEFAULT.modoLavoro.effortPredefinito, R2: 'high' } } })
  const a = azione('a-spareg01', 'R2', { revisore: 'claude' })
  expect(bilancia(a, { esecutore: 'claude', modello: 'claude-sonnet-5-5' }, r, [], [a], chi).effort).toBe('low')
  const p = conRisorse({ fornitori: ['claude'], profilo: 'personalizzato', pesi: [{ tipo: 'effort', nome: 'high', percentuale: -40, assoluto: 0 }],
    modoLavoro: { ...RISORSE_DEFAULT.modoLavoro, effortPredefinito: { ...RISORSE_DEFAULT.modoLavoro.effortPredefinito, R1: 'high' } } })
  expect(bilancia({ ...a, corsia: 'R1' }, { esecutore: 'claude', modello: 'claude-sonnet-5-5' }, p, [], [a], CHI).effort).toBe('low')
})

test('P2 scadenza: oltre 24 ore una proposta ancora «attesa» nel file compare come Scaduta, nel registro e in risorse_agenti', () => {
  const p = proposteDa({ voci: [VOCE] }, 'esempio/demo')[0]!
  const dopo = Date.parse(ORA) + 25 * 3_600_000
  expect([statoVisto(p, dopo), statoVisto(p, Date.parse(ORA) + 3_600_000)]).toEqual(['scaduta', 'attesa'])
  expect(TESTI_PESI.registro(p, 'it', dopo)).toMatch(/^Scaduta il /)
  expect(decisaIl(p, dopo)).toBe(Date.parse(ORA) + 24 * 3_600_000)
  expect(proposteBrevi([p], dopo)[0]!.stato).toBe('scaduta')
})

test('registro: applica A, poi rifiuta B: il registro dice B e tiene «Annulla» per A, ancora annullabile', async ($, on) => {
  const amb = ambiente(on)
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'mcp__chip-manager__proponi_pesi', motivo: 'Prima', profilo: 'risparmio' } as never)
  await $.tool.call({ tool: 'mcp__chip-manager__proponi_pesi', motivo: 'Seconda', profilo: 'qualita' } as never)
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: 'lavoro-pesi-p-esempio01-applica' })
  await ui.press({ key: 'lavoro-pesi-p-esempio02-rifiuta' })
  await ui.press({ key: 'vista-carico' })
  expect(await ui.find({ type: 'Text', text: /^Rifiutata il .*: Qualità$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^Applicata il .*: Risparmio$/ })).toBeDefined()
  await ui.press({ key: 'carico-pesi-registro-annulla' })
  expect(amb.comandi('pesi-annulla')[0]!.slice(4, 6)).toEqual(['esempio/demo', 'p-esempio01'])
  expect(amb.progettoOra()).toMatchObject({ pesi: [], pesiRevisione: 2 })
  expect(await ui.find({ key: 'carico-pesi-registro-annulla' })).toBeUndefined()
  await ui.unmount()
})

test('R2/R3: matrice profilo × corsia per una chip senza modello né effort; il modello esplicito non cambia', () => {
  // Le righe dei revisori anche per Codex, come nel routing del rapporto: così Codex è avviabile dove la corsia lo ammette.
  const RC = regoleDa({ ...ROUTING, revisione: { revisori_ammessi_per_autore: { ...ROUTING.revisione.revisori_ammessi_per_autore, 'gpt-6.1-sol': ['claude-sonnet-5-5', 'claude-opus-5-5'], 'gpt-6-astra': ['claude-sonnet-5-5', 'claude-opus-5-5'] } } }, 'routing.json')
  const conRC = (risorse: Partial<Regole['risorse']>): Regole => ({ ...RC, risorse: { ...RISORSE_DEFAULT, ...risorse } })
  const scelta = (profilo: 'automatico' | 'risparmio' | 'qualita' | 'velocita', corsia: Corsia) => {
    const r = conRC({ profilo, pesi: conProfilo([], profilo) })
    const a = azione(`a-mat-${profilo.slice(0, 3)}-${corsia}`.toLowerCase().replace(/[^a-z0-9-]/g, ''), corsia)
    const b = bilancia(a, {}, r, [], [a], CHI)
    return `${b.esecutore === 'codex' ? 'codex' : b.modello}`
  }
  const matrice = Object.fromEntries((['automatico', 'risparmio', 'qualita', 'velocita'] as const).map(p => [p, (['R0', 'R1', 'R2', 'R3'] as Corsia[]).map(c => scelta(p, c))]))
  expect(matrice).toEqual({
    // R2 (decisione del committente): sulle corsie leggere vince il modello Claude di rango più basso.
    automatico: ['claude-sonnet-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5', 'claude-opus-5-5'],
    // R3: con Risparmio l'effort imposto dalla corsia non penalizza Codex, e a parità vince Codex.
    risparmio: ['claude-sonnet-5-5', 'codex', 'codex', 'codex'],
    qualita: ['claude-sonnet-5-5', 'claude-sonnet-5-5', expect.any(String), expect.any(String)],
    velocita: ['claude-sonnet-5-5', 'claude-sonnet-5-5', 'claude-sonnet-5-5', 'claude-sonnet-5-5'],
  })
  // Il modello esplicito resta intoccabile, anche sulle corsie leggere.
  const r = conRisorse({ profilo: 'velocita', pesi: conProfilo([], 'velocita') })
  const a = azione('a-matesp01', 'R0', { modello: 'claude-opus-5-5' })
  expect(bilancia(a, { modello: 'claude-opus-5-5' }, r, [], [a], CHI).modello).toBe('claude-opus-5-5')
  // Un effort sopra quello imposto dalla corsia resta penalizzato: la neutralizzazione vale solo per il valore imposto.
  const ris = conRC({ profilo: 'risparmio', pesi: conProfilo([], 'risparmio') })
  const codexR1 = azione('a-matcod01', 'R1', { esecutore: 'codex', revisore: 'claude', modello: 'gpt-6.1-sol' })
  expect(punteggio({ ...codexR1, effort: 'high' }, ris, [], [codexR1])).toBeGreaterThan(punteggio({ ...codexR1, effort: 'xhigh' }, ris, [], [codexR1]))
})
