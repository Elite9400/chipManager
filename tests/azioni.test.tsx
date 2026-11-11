import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import {
  ADVISOR,
  idAuditor,
  motivoAuditor,
  rangoModello,
  statoAuditor,
  modelloDi,
  CADENZA_INIZIALE,
  rigaConsumo,
  modalitaDi,
  spesaDelMese,
  consigliaDove,
  impostazioniApiVietate,
  classeProcesso,
  classiDi,
  contaConsumo,
  diagnosticaHelper,
  passoCadenza,
  uguale,
  consumoUguale,
  STATI_PENDENTI,
  segnaLavori,
  sommaSecchi,
  bilancia,
  cartellaDati,
  checkoutDi,
  contestoDa,
  dettagliSessione,
  livelloDi,
  nelProgetto,
  piuPieno,
  radiceProgetto,
  sessioniClaude,
  sessioniCodex,
  coloreLimite,
  aspettoLimite,
  conUltime,
  etaVecchie,
  fornitoriVisibili,
  limiteFresco,
  punteggio,
  RISORSE_DEFAULT,
  COLORE_LIVELLO,
  COLORE_STATO,
  corrisponde,
  dipendenze,
  dipendenzeChiuse,
  durata,
  effortPer,
  effortDi,
  datiLocali,
  faseDiAzione,
  mandato,
  mandatoApi,
  normalizza,
  parametriAvvio,
  progettoDa,
  percentuale,
  pianifica,
  REGOLE_DEFAULT,
  regoleDa,
  CORSIE,
  repoGithub,
  sensibile,
  causaSensibile,
  sopra,
  sposta,
  stimaArrivo,
  taskAccertato,
  traguardiDa,
  trovaTask,
  violazioni,
  violazioniAvvio,
} from '../hooks/logica'
import type { Azione, Chiamante, Consumo, Limite, Regole } from '../types'
import { applicaPatch, diversoDa, presetChi, TETTO_RISORSE } from '../hooks/bilanciamento'
import type { Consiglio } from '../hooks/logica'
import { DiscoIt } from './disco-it'
import { confrontaF9, controlliF9, fineF9 } from './f9'
import { chiaveOTesto } from '../hooks/lingua'
import { INSTALLAZIONE, pianoVuoto, risorseLette, usoDesktop } from '../hooks/risorse'
import { chiaveRiassunto } from '../hooks/board'
import { GRIGIO, LIVELLO, STATO } from '../hooks/tema'

// Un routing.json d'esempio, nella forma che il pannello legge.
const ROUTING = {
  modelli_ammessi: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-fable-5-1', 'gpt-6.1-sol', 'gpt-6-astra'],
  effort_ammessi: ['low', 'medium', 'high', 'xhigh', 'max'],
  tetto_per_modello: { 'claude-fable-5-1': 'xhigh', _nota: 'x' },
  revisione: {
    revisori_ammessi_per_autore: {
      'claude-opus-5-5': ['claude-fable-5-1', 'motore:codex'],
      'claude-haiku-5-5': ['claude-sonnet-5-5', 'claude-opus-5-5'],
      'gpt-6.1-sol': ['claude-sonnet-5-5', 'claude-opus-5-5'],
      'gpt-6-astra': ['claude-sonnet-5-5', 'claude-opus-5-5'],
    },
  },
  corsia_codex: {
    modelli: ['gpt-6.1-sol', 'gpt-6-astra'],
    esegue: { corsie: ['R1', 'R2', 'R3'] },
    effort: { R1: 'high', R2: 'xhigh', R3: 'xhigh' },
    rivisto_da: { R1: 'claude-sonnet-5-5', R2: 'claude-sonnet-5-5', R3: 'claude-opus-5-5' },
  },
}
const R = regoleDa(ROUTING, 'routing.json')
const SID = 'local_12345678-1234-1234-1234-123456789abc'

const base = (id: string, ordine: number, extra: Partial<Azione> = {}): Azione => ({
  id,
  versione: 0,
  titolo: `T ${id}`,
  brief: 'Fai X.',
  ordine,
  dipende: [],
  esecutore: 'claude',
  revisore: 'codex',
  stato: 'proposta',
  creata: '2026-11-04T00:00:00Z',
  aggiornata: '2026-11-04T00:00:00Z',
  ...extra,
})

// --- logica pura ------------------------------------------------------------------------------------

test('mandato: Codex esegue con il coordinatore della corsia, Claude rivede', () => {
  const m = mandato(base('a-codex01', 1, { esecutore: 'codex', revisore: 'claude', modello: 'gpt-6-astra', corsia: 'R3', tentativo: 'az-abc' }), R, {
    disco: 'D:/m/disco.cjs',
  })
  expect(m.model).toBe('claude-opus-5-5')
  expect(m.prompt).toContain('node "D:/m/disco.cjs" corsia-codex -- codex exec -m gpt-6-astra -c model_reasoning_effort="xhigh"')
  expect(m.prompt).toContain('tentativo "az-abc"')
  expect(m.prompt).toContain('Review: Claude (you)')
  expect(m.prompt).toContain('stato "consegnata"')
  expect(m.background.length).toBeGreaterThanOrEqual(80)
})

// --- F11.1: il modo di lavoro ---------------------------------------------------------------------------------------
const conModo = (modo: Record<string, unknown>) => ({ ...R, risorse: { ...R.risorse, modoLavoro: { ...RISORSE_DEFAULT.modoLavoro, ...modo } } }) as typeof R

test('F11.1 effort: senza scelta medium su R0–R2 e high su R3–R5; il modo lo cambia; minimi di Codex, R4/R5 e sensibile vincono', () => {
  const chip = (id: string, corsia: Azione['corsia'], extra: Partial<Azione> = {}) => base(id, 1, { corsia, modello: 'claude-sonnet-5-5', ...extra })
  expect((['R0', 'R1', 'R2', 'R3', 'R4', 'R5'] as const).map((c, i) => effortDi(chip(`a-modo000${i}`, c), R))).toEqual(['medium', 'medium', 'medium', 'high', 'high', 'high'])
  // Il modo di lavoro sceglie il predefinito della corsia.
  const modo = conModo({ effortPredefinito: { ...RISORSE_DEFAULT.modoLavoro.effortPredefinito, R1: 'low', R3: 'xhigh' } })
  expect([effortDi(chip('a-modo0011', 'R1'), modo), effortDi(chip('a-modo0012', 'R3'), modo)]).toEqual(['low', 'xhigh'])
  // Una scelta esplicita ammessa resta (le guardie la controllano all'avvio).
  expect(effortDi(chip('a-modo0013', 'R1', { effort: 'xhigh' }), modo)).toBe('xhigh')
  // Sensibile: mai sotto high, anche con R1 a low nel modo.
  expect(effortDi(chip('a-modo0014', 'R1', { sensibile: true }), modo)).toBe('high')
  // Codex: il minimo di corsia_codex vince su un predefinito più basso.
  const codex = base('a-modo0015', 1, { esecutore: 'codex', revisore: 'claude', modello: 'gpt-6-astra', corsia: 'R3' })
  expect(effortDi(codex, conModo({ effortPredefinito: { ...RISORSE_DEFAULT.modoLavoro.effortPredefinito, R3: 'high' } }))).toBe(effortDi(codex, R))
})

test('F11.1 mandato: Codex esecutore modifica soltanto (sandbox del modo, predefinita workspace-write); il revisore resta read-only', () => {
  const codex = base('a-codex02', 1, { esecutore: 'codex', revisore: 'claude', modello: 'gpt-6-astra', corsia: 'R3', tentativo: 'az-abc' })
  const m = mandato(codex, R, { disco: 'D:/m/disco.cjs' })
  expect(m.prompt).toContain('-s workspace-write -C <your worktree> -')
  expect(m.prompt).toContain('Codex only edits files; you commit and push.')
  expect(mandato(codex, conModo({ codexSandbox: 'read-only' }), { disco: 'D:/m/disco.cjs' }).prompt).toContain('-s read-only -C <your worktree> -')
  const rev = mandato(base('a-claude2', 1), conModo({ codexSandbox: 'workspace-write' }), { disco: 'D:/m/disco.cjs' })
  expect(rev.prompt).toContain('corsia-codex --revisione -- codex exec -c model_reasoning_effort="xhigh" -s read-only')
  expect(rev.prompt).not.toContain('workspace-write')
})

test('F11.1 revisione incrociata spenta: senza revisore scelto R0–R2 vanno senza revisore; R3+ e le scelte esplicite restano', async ($, on) => {
  const amb = ambiente(on)
  amb.disco.set('X:/casa/.claude/chipmanager/config.json', JSON.stringify({ account: { modoLavoro: { revisioneIncrociata: false } }, progetti: { 'acme/progetto': { milestoneGithub: true } } }))
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'Docs', brief: 'Aggiorna il README.', corsia: 'R1' } as never)
  await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'Motore', brief: 'Riscrivi il pianificatore.', corsia: 'R3' } as never)
  await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'Docs 2', brief: 'Aggiorna la guida.', corsia: 'R1', revisore: 'codex' } as never)
  const per = (t: string) => amb.azione().find(a => a.titolo === t)!.revisore
  expect([per('Docs'), per('Motore'), per('Docs 2')]).toEqual(['nessuno', 'codex', 'codex'])
})

test('F11.1 parallelo: il modo di lavoro vince sull\'opzione dell\'host e sul 3 predefinito', { options: { paralleli: '5' } }, async ($, on) => {
  const amb = ambiente(on)
  amb.disco.set('X:/casa/.claude/chipmanager/config.json', JSON.stringify({ progetti: { 'acme/progetto': { milestoneGithub: true, modoLavoro: { parallelo: 1 } } } }))
  const domande: string[] = []
  conferme(on, q => (domande.push(q), q.startsWith('Avvio 1 sessione') ? 'Avvia' : 'Annulla'))
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  for (const t of ['Uno', 'Due', 'Tre']) await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: t, brief: `Aggiorna ${t}.`, corsia: 'R1' } as never)
  const r = await $.tool.call({ tool: 'mcp__chip-manager__risorse_agenti' } as never)
  expect(JSON.parse(String((r as { result?: unknown }).result)).politica.modoLavoro.parallelo).toBe(1)
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: 'tutte' })
  expect(domande[0]).toContain('massimo 1 in parallelo')
  expect(amb.chiamate.filter(c => c.tool === 'start_session').length).toBe(1)
  await ui.unmount()
})

test('mandato: Claude esegue, Codex rivede prendendo la corsia della macchina', () => {
  const m = mandato(base('a-claude1', 1), R, { disco: 'D:/m/disco.cjs' })
  expect(m.model).toBe('claude-opus-5-5')
  expect(m.prompt).toContain('Review: Codex')
  expect(m.prompt).toContain('corsia-codex --revisione -- codex exec -c model_reasoning_effort="xhigh" -s read-only')
  expect(m.prompt).not.toContain('codex exec -m')
})

test('colori: stati e livelli vengono dai gettoni di tema.ts; modello ed effort non hanno tinte proprie', () => {
  const stati: string[] = Object.values(STATO)
  for (const colore of Object.values(COLORE_STATO)) expect(stati.includes(colore)).toBe(true)
  expect(COLORE_LIVELLO).toEqual({ ok: STATO.inCorso, attenzione: LIVELLO.attenzione, critica: LIVELLO.critica })
  expect(coloreLimite({ ...LIMITE, letto: '2000-01-01T00:00:00Z' })).toBe(GRIGIO)
})

test('dipendenze: si sbloccano solo esistenti e completate; scartate e inesistenti bloccano', () => {
  const a = base('a-primo01', 1, { stato: 'avviata' })
  const b = base('a-second1', 2, { dipende: ['a-primo01'] })
  expect(dipendenzeChiuse(b, [a, b])).toBe(false)
  expect(dipendenzeChiuse(b, [{ ...a, stato: 'consegnata' }, b])).toBe(false)
  expect(dipendenzeChiuse(b, [{ ...a, stato: 'completata' }, b])).toBe(true)
  expect(dipendenze(b, [b]).problemi.map(m => m.k).join()).toContain('v.dipendenzaAssente')
  expect(dipendenze(b, [{ ...a, stato: 'scartata' }, b]).problemi.map(m => m.k).join()).toContain('v.dipendenzaScartata')
})

test('sposta: scambia con la vicina e rinumera solo chi cambia', () => {
  const l = [base('a-uno0001', 1), base('a-due0001', 2), base('a-tre0001', 3)]
  expect(sposta(l, 'a-tre0001', -1).map(a => [a.id, a.ordine])).toEqual([
    ['a-tre0001', 2],
    ['a-due0001', 3],
  ])
  expect(sposta(l, 'a-uno0001', -1)).toEqual([])
})

test('parametriAvvio: solo combinazioni che l\'app accetta; sensibile senza permessi non eredita', () => {
  const fork = parametriAvvio(base('a-fork0001', 1, { contesto: 'fork', ramo: 'x', permessi: 'plan' }), R)
  expect(fork).toMatchObject({ context: 'fork', permission_mode: 'plan' })
  expect(fork).not.toHaveProperty('use_worktree')
  expect(fork).not.toHaveProperty('background')
  const cloud = parametriAvvio(base('a-cloud001', 1, { destinazione: 'cloud', contesto: 'fork', sveglia: true }), R)
  expect(cloud).toMatchObject({ target: 'cloud', context: 'fresh' })
  expect(cloud).not.toHaveProperty('model')
  expect(cloud).not.toHaveProperty('wake_when_done')
  const loc = parametriAvvio(base('a-local01', 1, { worktree: true, ramo: 'fix-x', base: 'main', sveglia: true }), R)
  expect(loc).toMatchObject({ use_worktree: true, branch_name: 'fix-x', source_branch: 'main', wake_when_done: true })
  expect(loc).not.toHaveProperty('permission_mode')
  const r4 = parametriAvvio(base('a-r4000001', 1, { titolo: 'Fix login' }), R)
  expect(r4).toMatchObject({ permission_mode: 'acceptEdits' })
})

test('milestone: repo dal remote, righe validate, titolo intero, percentuale', () => {
  expect(repoGithub('https://github.com/acme/progetto.git')).toBe('acme/progetto')
  expect(repoGithub('git@github.com:acme/progetto.git')).toBe('acme/progetto')
  expect(repoGithub('https://gitlab.com/x/y.git')).toBeNull()
  const lungo = 'x'.repeat(80)
  const l = traguardiDa([
    { number: 1, title: lungo, open_issues: 109, closed_issues: 99, due_on: null },
    { number: 'x', title: 'rotta' },
  ])
  expect(l.length).toBe(1)
  expect(l[0]!.titolo).toBe(lungo)
  expect(percentuale(l[0]!)).toBe(48)
})

test('regole: da routing.json, senza max, corsia Codex; illeggibili = nessun avvio', () => {
  expect(R.lette).toBe(true)
  expect(R.effort).toEqual(['low', 'medium', 'high', 'xhigh'])
  expect(R.corsiaCodex.rivistoDa.R3).toBe('claude-opus-5-5')
  expect(effortPer(R, 'claude-fable-5-1')).toEqual(['low', 'medium', 'high', 'xhigh'])
  expect(regoleDa({ modelli_ammessi: 'rotto' }, 'x').lette).toBe(false)
  expect(violazioni(base('a-ok000001', 1), REGOLE_DEFAULT).map(m => m.k).join()).toContain('v.regoleNonLette')
})

test('violazioni: matrice dei revisori, R4 non aggirabile con sensibile:false, cloud e corsie di Codex', () => {
  expect(violazioni(base('a-ok000001', 1), R)).toEqual([])
  expect(violazioni(base('a-haiku001', 1, { modello: 'claude-haiku-5-5' }), R).map(m => m.k).join()).toContain('v.revisoreNonAmmesso')
  const r4 = base('a-r4000001', 1, { titolo: 'Fix login MFA', sensibile: false, esecutore: 'codex', revisore: 'nessuno', permessi: 'bypassPermissions' })
  expect(sensibile(r4, R)).toBe(true)
  const v = violazioni(r4, R).map(m => m.k).join()
  for (const atteso of ['v.r4Autore', 'v.r4Revisione', 'v.r4Bypass', 'v.codexCorsie']) expect(v).toContain(atteso)
  const haikuR4 = base('a-r4000002', 1, { titolo: 'permessi OU', modello: 'claude-haiku-5-5', effort: 'low', revisore: 'claude' })
  expect(violazioni(haikuR4, R).map(m => m.k).join()).toContain('v.r4Modello')
  expect(violazioni(base('a-r4000003', 1, { corsia: 'R4', destinazione: 'cloud' }), R).map(m => m.k).join()).toContain('v.r4Cloud')
  expect(violazioni(base('a-cf000001', 1, { destinazione: 'cloud', contesto: 'fork' }), R).map(m => m.k).join()).toContain('v.cloudFork')
})

test('pianifica: dipendenze fuse, corsia unica di Codex (anche tenuta da una revisione), limite, blocchi', () => {
  const lista = [
    base('a-uno00001', 1, { esecutore: 'codex', revisore: 'claude', corsia: 'R2' }),
    base('a-due00001', 2, { esecutore: 'codex', revisore: 'claude', corsia: 'R2' }),
    base('a-tre00001', 3),
    base('a-qua00001', 4, { dipende: ['a-tre00001'] }),
    base('a-cin00001', 5),
    base('a-sei00001', 6, { titolo: 'permessi OU', esecutore: 'codex', revisore: 'claude' }),
  ]
  const p = pianifica(lista, lista, R, 3)
  expect(p.avvia.map(a => a.id)).toEqual(['a-uno00001', 'a-tre00001', 'a-cin00001'])
  expect(p.coda.map(c => [c.a.id, c.motivo])).toEqual([
    ['a-due00001', { k: 'coda.codex' }],
    ['a-qua00001', { k: 'coda.dipendenze' }],
  ])
  expect(p.bloccate.map(b => b.a.id)).toEqual(['a-sei00001'])
  // La corsia tenuta da fuori (una revisione Codex in corso) blocca anche la prima.
  expect(pianifica([lista[0]!], lista, R, 3, true).coda[0]?.motivo).toEqual({ k: 'coda.codex' })
  const occupate = [1, 2, 3].map(n => base(`a-run0000${n}`, 10 + n, { stato: 'avviata' }))
  expect(pianifica([lista[2]!], [...occupate, lista[2]!], R, 3).coda[0]?.motivo).toEqual({ k: 'coda.paralleli', p: { n: 3 } })
})

test('registro: il task di QUESTA azione serve il ramo; record validati, migrazioni', () => {
  const reg = {
    task: {
      vecchio: { issue: 235, ramo: 'fix/a', stato: 'fuso', creato: '2026-10-01' },
      nuovo: { issue: 235, ramo: 'fix/b', stato: 'revisione', creato: '2026-11-04' },
    },
  }
  // Senza ramo nessuna associazione: la sola issue non distingue due lavori.
  expect(faseDiAzione(reg, { issue: 235, avviataIl: '2026-11-02' })).toBeUndefined()
  expect(faseDiAzione(reg, { issue: 235, avviataIl: '2026-11-02', ramoSessione: 'fix/b' })).toBe('revisione')
  // Un task chiuso nato DOPO l'invio è di questa azione; uno chiuso nato prima no.
  expect(faseDiAzione(reg, { issue: 235, avviataIl: '2026-09-01', ramoSessione: 'fix/a' })).toBe('fuso')
  expect(faseDiAzione(reg, { issue: 235, avviataIl: '2026-10-02', ramoSessione: 'fix/a' })).toBeUndefined()
  expect((normalizza({ ...base('a-avv00001', 1), stato: 'avviata' }) as Azione).stato).toBe('fallita')
  expect(normalizza({ ...base('a-dat00001', 1), avviataIl: 'ieri' })).toEqual({ k: 'rec.data', p: { campo: 'avviataIl' } })
  const vecchia = { ...base('a-vec00001', 1) } as Partial<Azione>
  delete vecchia.versione
  expect((normalizza(vecchia) as Azione).versione).toBe(0)
  expect(normalizza({ id: '../x', titolo: 't', brief: 'b', stato: 'proposta' })).toEqual({ k: 'rec.campo', p: { campo: 'id' } })
  expect(normalizza({ ...base('a-noesec01', 1), esecutore: undefined })).toEqual({ k: 'rec.campo', p: { campo: 'esecutore/revisore' } })
})

test('stima d\'arrivo, durate, modello sopra quello di chi avvia', () => {
  const oggi = new Date('2026-11-05T12:00:00')
  const t = { numero: 1, titolo: 'x', aperte: 14, chiuse: 10, scadenza: null, chiuseRecenti: 14 }
  expect(stimaArrivo(t, oggi)?.toISOString().slice(0, 10)).toBe('2026-11-19')
  expect(stimaArrivo({ ...t, chiuseRecenti: 0 }, oggi)).toBeNull()
  expect(durata(65 * 60_000)).toBe('1 h 05 min')
  expect(sopra('claude-opus-5-5', 'claude-sonnet-5-5')).toBe(true)
  expect(sopra('claude-sonnet-5-5', 'claude-opus-5-5[1m]')).toBe(false)
})

test('sensibilità dal background; effort di corsia_codex come minimo; routing parziale non è «letto»', () => {
  const bg = base('a-bg000001', 1, { background: 'Intervieni su auth e anagrafica', esecutore: 'codex', revisore: 'nessuno' })
  expect(sensibile(bg, R)).toBe(true)
  expect(violazioni(bg, R).length).toBeGreaterThan(0)
  expect(violazioni(base('a-cx000001', 1, { esecutore: 'codex', revisore: 'claude', corsia: 'R3', effort: 'low' }), R).map(m => m.k).join()).toContain('v.codexEffort')
  expect(regoleDa({ modelli_ammessi: ROUTING.modelli_ammessi, effort_ammessi: ROUTING.effort_ammessi }, 'x').lette).toBe(false)
})

test('cloud: solo mandati senza dati da LAN, e senza il background locale', () => {
  expect(datiLocali('Correggi il layout della tabella')).toBe(false)
  for (const s of ['RSSMRA80A01H501U', 'mario@esempio.it', '10.0.0.12', 'DB_PASSWORD=x', 'leggi .env', 'storage/upload']) expect(datiLocali(s)).toBe(true)
  expect(violazioni(base('a-cl000001', 1, { destinazione: 'cloud', brief: 'vedi log: 192.168.1.4' }), R).map(m => m.k).join()).toContain('v.cloudDati')
  const m = mandato(base('a-cl000002', 1, { destinazione: 'cloud', background: 'x'.repeat(100) + ' segreto locale' }), R)
  expect(m.background).not.toContain('segreto locale')
})

test('configurazione effettiva: modello e effort di chi avvia, fork che eredita, «qui» in bypass', () => {
  const chi: Chiamante = { io: 'm', repo: 'o/r', modello: 'claude-sonnet-5-5', effort: 'medium', permessi: 'bypassPermissions' }
  const a = base('a-ef000001', 1, { repo: 'o/r' })
  expect(violazioniAvvio(a, R, [a], chi)).toContainEqual({ k: 'v.modelloSessione', p: { attuale: 'Sonnet 5.5', richiesto: 'Opus 5.5' } })
  const fork = { ...a, contesto: 'fork' as const }
  expect(violazioniAvvio(fork, R, [fork], chi)).toContainEqual({ k: 'v.forkModello', p: { attuale: 'Sonnet 5.5', richiesto: 'Opus 5.5' } })
  const r4 = base('a-ef000002', 1, { repo: 'o/r', titolo: 'permessi OU', revisore: 'claude' })
  const opus: Chiamante = { ...chi, modello: 'claude-opus-5-5', effort: 'high' }
  expect(violazioniAvvio(r4, R, [r4], opus, true).map(m => m.k).join()).toContain('v.r4QuiBypass')
  expect(violazioniAvvio({ ...a, repo: undefined }, R, [a], opus).map(m => m.k).join()).toContain('v.senzaProgetto')
  expect(violazioniAvvio({ ...a, repo: 'altro/x' }, R, [a], opus)).toContainEqual({ k: 'v.altroProgetto', p: { repo: 'altro/x' } })
})

test('cloud: credenziali in JSON, IPv6 e CF omocodici restano in LAN; niente Codex nel cloud', () => {
  for (const s of ['{"api_key":"valore-fittizio"}', 'token: abc', 'fe80::1ff:fe23:4567:890a', 'RSSMRALPAMNH501U', 'Authorization: Bearer abcdefghijklmnop'])
    expect(datiLocali(s)).toBe(true)
  expect(violazioni(base('a-cl000003', 1, { destinazione: 'cloud' }), R).map(m => m.k).join()).toContain('v.cloudCodex')
})

test('metadati di chi avvia sconosciuti: le guardie che ne dipendono bloccano', () => {
  const r4 = base('a-md000001', 1, { repo: 'o/r', titolo: 'permessi OU', revisore: 'claude', permessi: 'acceptEdits' })
  const ignoto: Chiamante = { io: 'm', repo: 'o/r', modello: 'claude-opus-5-5' }
  const v = violazioniAvvio(r4, R, [r4], ignoto, true).map(m => m.k).join()
  expect(v).toContain('v.permessiIgnoti')
  expect(v).toContain('v.effortIgnoto')
})

test('registro: con il ramo noto si accetta solo il task di quel ramo', () => {
  const reg = { task: { b: { issue: 235, ramo: 'fix/b', stato: 'fuso', creato: '2026-11-04' } } }
  expect(faseDiAzione(reg, { issue: 235, avviataIl: '2026-11-01', ramoSessione: 'fix/a' })).toBeUndefined()
  expect(faseDiAzione(reg, { issue: 235, avviataIl: '2026-11-01', ramoSessione: 'fix/b' })).toBe('fuso')
  // Senza ramo, anche un unico task della stessa issue non chiude nulla.
  expect(faseDiAzione(reg, { issue: 235, avviataIl: '2026-11-01' })).toBeUndefined()
})

test('cloud: chiavi prefissate e mandati troppo lunghi per essere letti per intero', () => {
  expect(datiLocali('{"DB_PASSWORD":"segreto-fittizio"}')).toBe(true)
  expect(datiLocali('GITHUB_TOKEN=abc')).toBe(true)
  const lungo = base('a-lg000001', 1, { destinazione: 'cloud', revisore: 'claude', brief: 'x '.repeat(1000) })
  expect(violazioni(lungo, R).map(m => m.k).join()).toContain('v.cloudTesto')
  // La riga dei revisori serve anche per un autore Codex.
  const revisori = { ...R.revisori }
  delete revisori['gpt-6.1-sol']
  expect(violazioni(base('a-sx000001', 1, { esecutore: 'codex', revisore: 'claude', corsia: 'R2' }), { ...R, revisori }).map(m => m.k).join()).toContain('v.rigaRevisori')
})

test('codex senza corsia, o routing senza la regola: bloccato', () => {
  expect(violazioni(base('a-cs000001', 1, { esecutore: 'codex', revisore: 'claude' }), R).map(m => m.k).join()).toContain('v.codexCorsia')
  const senza = regoleDa({ ...ROUTING, corsia_codex: { ...ROUTING.corsia_codex, effort: {} } }, 'x')
  expect(senza.lette).toBe(false)
  const r = { ...R, revisori: {} }
  expect(violazioni(base('a-mx000001', 1, { revisore: 'claude' }), r).map(m => m.k).join()).toContain('v.rigaRevisori')
})

// --- il pannello contro un engine finto --------------------------------------------------------------

/** Engine finto: disco in memoria, helper (lock/CAS) e `gh` emulati, servizio di sessione scriptabile. */
function ambiente(on: Parameters<TestBody>[1], opz: { cli?: boolean; senzaDir?: boolean; nascosto?: boolean; strumenti?: string[]; fonte?: (cmd: string, input: Record<string, unknown>) => unknown; mcp?: (server: string, tool: string, args: unknown) => unknown; modello?: (e: { prompt: string }) => unknown; attesa?: (cmd: string) => Promise<void> | undefined; api?: (cmd: string, a: string[], stdin: string | undefined) => [number, string] | undefined; impostazioni?: (source?: string) => unknown } = {}) {
  // Come un disco vero: la data è quella della scrittura, al millisecondo; due scritture nello stesso istante la condividono.
  class Disco extends DiscoIt {
    mtime = new Map<string, number>()
    override set(k: string, v: string) {
      this.mtime?.set(k, Date.now())
      return super.set(k, v)
    }
    /** Riscrittura nello stesso istante della precedente: contenuto nuovo, stessa data. */
    stessoIstante(k: string, v: string) {
      const t = this.mtime.get(k)
      super.set(k, v)
      if (t !== undefined) this.mtime.set(k, t)
    }
  }
  const disco = new Disco()
  const p = (s: string | undefined) => (s ?? '').replace(/\\/g, '/')
  const chiamate: { server: string; tool: string; args: Record<string, unknown> }[] = []
  const toast: string[] = []
  const processi: { argv: readonly string[]; stdin?: string; env?: Record<string, string> }[] = []
  const modello: { prompt: string; model: string }[] = []
  disco.set(p('X:/repo/.claude/routing.json'), JSON.stringify(ROUTING))
  disco.set('X:/casa/.claude/chipmanager/config.json', JSON.stringify({ progetti: { 'acme/progetto': { milestoneGithub: true } } }))
  on('env.get', (_, e) => ({ value: e.name === 'CHIPMANAGER_DIR' && !opz.senzaDir ? 'X:/orch' : e.name === 'USERPROFILE' ? 'X:/casa' : e.name === 'OS' ? 'Windows_NT' : undefined }))
  on('session.id', () => ({ value: 'sessione-master' }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  const elenchiStrumenti: number[] = []
  on('tool.list', () => (elenchiStrumenti.push(1), { value: [...(opz.cli ? [] : [{ name: 'mcp__ccd_session__start_session' }]), ...(opz.strumenti ?? []).map(name => ({ name }))] as never }))
  on('session.repo', () => ({ value: { root: 'X:/repo', remote: 'https://github.com/acme/progetto.git', internal: false, repo: null } as never }))
  on('fs.exists', (_, e) => ({ value: [...disco.keys()].some(k => k === p(e.path) || k.startsWith(`${p(e.path)}/`)) }))
  const elenchi: string[] = []
  on('fs.list', (_, e) => (elenchi.push(p(e.path)), {
    value: [...disco.keys()]
      .filter(k => k.startsWith(`${p(e.path)}/`) && !k.slice(p(e.path).length + 1).includes('/'))
      .map(k => ({ name: k.slice(p(e.path).length + 1), kind: 'file' as const, size: disco.get(k)!.length, mtimeMs: disco.mtime.get(k) ?? 0, isLink: false })),
  }))
  // F10: come l'host, anche le cartelle (prefisso di un file) e la radice del disco; `realPath` è il percorso stesso.
  on('fs.stat', (_, e) => {
    const q = p(e.path).replace(/\/+$/, '')
    const t = disco.get(q)
    const cartella = t === undefined && (/^[A-Za-z]:$/.test(q) || [...disco.keys()].some(k => k.startsWith(`${q}/`)))
    if (t === undefined && !cartella) throw new Error('ENOENT')
    return { value: { kind: cartella ? 'dir' as const : 'file' as const, size: t?.length ?? 0, mtimeMs: disco.mtime.get(q) ?? 0, isLink: false, ...(e.resolve && { realPath: q }) } }
  })
  on('ui.panes', () => ({ value: opz.nascosto ? [] : [{ id: 'chipManager', title: 'chipManager', isShown: true, isFocused: false, isPlaced: true }] }))
  const letti: string[] = []
  on('fs.read', (_, e) => {
    letti.push(p(e.path))
    const t = disco.get(p(e.path))
    if (t === undefined) throw new Error('ENOENT')
    return { value: t }
  })
  on('fs.write', (_, e) => {
    disco.set(p(e.path), e.text)
    return { value: undefined }
  })
  // Le fonti di impostazioni come le espone l'host: vuote salvo diversa indicazione della prova.
  on('settings.read', (_, e) => ({ value: (opz.impostazioni?.((e as { source?: string }).source) ?? {}) as never }))
  on('process.run', (_, e) => {
    const [exe, , cmd, ...a] = e.argv
    const fine = (exitCode: number, stdout = '') => ({ value: { exitCode, stdout, stderr: '' } as never })
    processi.push({ argv: e.argv, stdin: e.init?.stdin, // Only the variable names: the values are credentials and must not reach any recorded state.
    env: Object.fromEntries(Object.keys((e.init as { env?: Record<string, string> } | undefined)?.env ?? {}).map(k => [k, '<set>'])) })
    if (exe === 'docker') return fine(0)
    // F13.7: the install helper, scriptable by the test; refusals as { motivo } with exit 2.
    if (e.argv[1]?.endsWith('/skill-installa.cjs')) {
      const r = opz.fonte?.(`skill-${e.argv[2]}`, { id: e.argv[3], stdin: e.init?.stdin }) as { codice?: number } | undefined
      return fine(r?.codice ?? 0, JSON.stringify(r ?? {}))
    }
    // F13.7: the plugin CLI (`claude plugin ...`), scriptable by the test; by default no plugin is installed.
    if (exe === 'claude' && e.argv[1] === 'plugin') {
      const risposta = opz.fonte?.(`claude ${e.argv.slice(1).join(' ')}`, {})
      return fine(0, risposta === undefined ? '[]' : JSON.stringify(risposta))
    }
    // F13.3b: the OpenAI-compatible helper, scriptable by the test like the providers helper.
    if (e.argv[1]?.endsWith('/compatibili.cjs')) {
      const input = JSON.parse(e.init?.stdin ?? '{}')
      const risposta = opz.fonte?.(`compatibili-${cmd}`, input) ?? (cmd === 'completa' ? { risultato: 'Testo scritto.' } : cmd === 'rileva' ? { trovati: [] } : { esito: 'valida' })
      return fine(0, JSON.stringify(risposta))
    }
    if (e.argv[1]?.endsWith('/fornitori.cjs')) {
      const input = JSON.parse(e.init?.stdin ?? '{}')
      const rispondi = () => {
        const risposta = opz.fonte?.(cmd!, input) ?? (cmd === 'limiti' ? { limiti: [], proxy: 'non abilitato', chiavi: { anthropic: false, deepseek: false, freellmapi: false } } : { risultato: 'Bozza pronta.' })
        return fine(0, JSON.stringify(risposta))
      }
      // Concorrenza: `attesa` può trattenere una lettura finché un'altra non la raggiunge.
      const attesa = opz.attesa?.(cmd!)
      return attesa ? attesa.then(rispondi) : rispondi()
    }
    if (exe === 'gh') {
      const url = e.argv.join(' ')
      return fine(0, url.includes('/milestones') ? JSON.stringify([{ number: 1, title: '2.1.0-alpha', open_issues: 109, closed_issues: 99, due_on: null }]) : '{}')
    }
    const versione = (f: string) => {
      const su = disco.get(f)
      if (su === undefined) return 'nuovo'
      try {
        return String(JSON.parse(su).versione ?? 0)
      } catch {
        // Come l'helper vero: un file che non si interpreta non è «nuovo».
        return 'illeggibile'
      }
    }
    if (cmd === 'occupata') return fine(0)
    // F6.2: la corsia API dell'helper, scriptabile dalla prova.
    if (/-api$/.test(cmd ?? '')) {
      const [codice, testo] = opz.api?.(cmd!, a, e.init?.stdin) ?? [0, '']
      return fine(codice, testo)
    }
    if (cmd === 'configura') {
      const input = JSON.parse(e.init!.stdin!)
      const precedente = disco.get(p(a[0])) ?? null
      if (precedente !== input.atteso) return fine(4)
      const c = precedente === null ? {} : JSON.parse(precedente)
      const campi = { ...input.campi }
      // Come l'helper vero: la generazione della board cresce a ogni cambio di modo.
      const b = c.progetti?.[input.repo]?.board
      if (campi.board) campi.board = { modo: campi.board.modo, generazione: (b?.generazione ?? 0) + (b?.modo === campi.board.modo ? 0 : 1) }
      // F10: progetto, account e lingua in un solo CAS; null toglie il campo.
      // Come l'helper vero: la stessa fusione (gemello TS di applicaPatch), che non perde campi né null non nominati.
      disco.set(p(a[0]), JSON.stringify({ ...c, progetti: { ...c.progetti, [input.repo]: applicaPatch(c.progetti?.[input.repo] ?? {}, campi, input.togli?.progetto) },
        ...(input.account && { account: applicaPatch(c.account ?? {}, input.account, input.togli?.account) }), ...(input.lingua !== undefined && { lingua: input.lingua }) }))
      return fine(0)
    }
    if (cmd === 'git-log') return fine(0, JSON.stringify([{ sha: 'abc1234', data: '2026-11-04T10:00:00Z', oggetto: 'commit d\'esempio' }]))
    if (cmd === 'leggi-piano') return fine(0, JSON.stringify({ testo: `# Piano d'esempio (${a[1]})`, troncato: false }))
    if (cmd?.startsWith('board-')) {
      // Come l'helper vero: modo e generazione riletti dal config, prenotazione e budget sotto lo stesso lock.
      const [cfg, cartella, repo, gen, impronta] = a as [string, string, string, string, string]
      const progetto = (JSON.parse(disco.get(p(cfg)) ?? '{}') as { progetti?: Record<string, { board?: { modo: string; generazione: number }; soloLocale?: boolean; fornitori?: string[] }> }).progetti?.[repo]
      const b = progetto?.board
      const modi = cmd === 'board-spegni' ? ['spenta'] : cmd === 'board-scrivi' ? ['accesa', 'riassunti'] : ['riassunti']
      if (!b || !modi.includes(b.modo) || String(b.generazione) !== gen) return fine(4, 'board cambiata')
      const dest = `${p(cartella)}/board/demo`
      const voci = (JSON.parse(disco.get(`${dest}/riassunti.json`) ?? '{"voci":{}}') as { voci: Record<string, { stato: string; testo?: string }> }).voci
      const budget = JSON.parse(disco.get(`${dest}/budget.json`) ?? '{"usati":0}') as { usati: number }
      if (cmd === 'board-scrivi') {
        disco.set(`${dest}/index.html`, String(e.init?.stdin))
        return fine(0, `${dest}/index.html`)
      }
      if (cmd === 'board-spegni') {
        disco.delete(`${dest}/index.html`)
        disco.delete(`${dest}/riassunti.json`)
        return fine(0)
      }
      if (cmd === 'board-prenota') {
        if (progetto?.soloLocale || !(progetto?.fornitori ?? ['claude', 'codex']).includes('claude')) return fine(4, 'politica')
        if (voci[impronta]) return fine(4, 'già prenotata')
        if (budget.usati >= 100) return fine(5, 'tetto')
        disco.set(`${dest}/budget.json`, JSON.stringify({ usati: budget.usati + 1 }))
        disco.set(`${dest}/riassunti.json`, JSON.stringify({ voci: { ...voci, [impronta]: { stato: 'prenotata' } } }))
        return fine(0)
      }
      if (cmd === 'board-finalizza') {
        if (voci[impronta]?.stato !== 'prenotata') return fine(4, 'nessuna prenotazione')
        const t = (JSON.parse(String(e.init?.stdin)) as { testo?: string }).testo
        disco.set(`${dest}/riassunti.json`, JSON.stringify({ voci: { ...voci, [impronta]: t ? { stato: 'fatto', testo: t } : { stato: 'fallita' } } }))
        return fine(0)
      }
    }
    if (cmd === 'lancia-cli') {
      const [dir, id, tentativo] = a
      // F13 (N1): come l'helper, una fonte dell'host che blocca chiude l'avvio con 5 e i nomi, senza esecuzione.
      const host = (JSON.parse(e.init?.stdin ?? '{}') as { fontiHost?: { source: string }[] }).fontiHost
      if (!Array.isArray(host)) return fine(2, '{"motivo":"fontiHost"}')
      if (host.length) return fine(5, JSON.stringify({ fonti: host.map(h => ({ nome: `host:${h.source}` })) }))
      const az = JSON.parse(disco.get(`${dir}/${id}.json`)!)
      const f = `${dir}/esecuzioni/${tentativo}.json`
      if (az.stato !== 'in-avvio' || az.tentativo !== tentativo || disco.has(f)) return fine(4)
      disco.set(f, JSON.stringify({ id, tentativo, stato: 'avviata', ramo: `chipmanager/${tentativo}` }))
      return fine(0)
    }
    // F13.6: come l'helper, l'artefatto di un passo di catena col riferimento atteso, che deve esistere.
    if (cmd === 'artefatto') {
      const req = JSON.parse(String(e.init?.stdin)) as { catena: { id: string; giro: number; ruolo: string }; rif?: string; testo: string }
      const { id, giro, ruolo } = req.catena
      const atteso = ruolo === 'revisore' ? `${giro}-scrittore.md` : giro > 1 ? `${giro - 1}-revisore.md` : undefined
      if (req.rif !== atteso || !['scrittore', 'revisore'].includes(ruolo)) return fine(2)
      const cart = `${p(a[0])}/artefatti/${id}`
      if (atteso && !disco.has(`${cart}/${atteso}`)) return fine(4, '{"motivo":"rif"}')
      disco.set(`${cart}/${giro}-${ruolo}.md`, `<!-- chipManager artefatto catena=${id} giro=${giro} ruolo=${ruolo} rif=${atteso ?? '-'} -->\n${req.testo}`)
      return fine(0, `${giro}-${ruolo}.md`)
    }
    // F13.2: come l'helper, la figlia sotto il lock: vincoli copiati dal record del padre, al più maxFigli.
    if (cmd === 'figlio') {
      const dir = p(a[0])
      const req = JSON.parse(String(e.init?.stdin)) as { padre: string; figlio?: Azione; figli?: Azione[]; maxFigli: number }
      const tutte = req.figli ?? [req.figlio!]
      const padre = JSON.parse(disco.get(`${dir}/${req.padre}.json`) ?? 'null') as Azione | null
      if (!padre || padre.ruolo !== 'dirigente' || padre.padre || !['avviata', 'attesa-figli'].includes(padre.stato)) return fine(4, '{"motivo":"padre"}')
      if ([...disco.entries()].filter(([k, v]) => k.startsWith(`${dir}/a-`) && JSON.parse(v).padre === req.padre).length + tutte.length > req.maxFigli) return fine(4, '{"motivo":"maxFigli"}')
      const recs = tutte.map(f => ({ ...f, ruolo: 'lavoro', padre: req.padre, vincoliPadre: padre.vincoliPropri }))
      for (const rec of recs) disco.set(`${dir}/${rec.id}.json`, JSON.stringify(rec))
      return fine(0, JSON.stringify(req.figli ? recs : recs[0]))
    }
    if (cmd === 'stato-cli') return disco.has(`${a[0]}/esecuzioni/${a[1]}.json`) ? fine(0, disco.get(`${a[0]}/esecuzioni/${a[1]}.json`)) : fine(1)
    if (cmd === 'cas') {
      const f = p(a[0])
      if (versione(f) !== a[1]) return fine(4, versione(f))
      disco.set(f, String(e.init?.stdin))
      return fine(0)
    }
    if (cmd === 'prenota') {
      const dir = p(a[0])
      const req = JSON.parse(String(e.init?.stdin)) as { elenco?: string[]; attese: Record<string, unknown>; scrivi: Record<string, unknown> }
      if (req.elenco) {
        const ora = [...disco.keys()].filter(k => k.startsWith(`${dir}/a-`)).map(k => k.slice(dir.length + 1)).sort()
        if (ora.join('|') !== [...req.elenco].sort().join('|')) return fine(4, 'elenco cambiato')
      }
      for (const [n, v] of Object.entries(req.attese)) if (versione(`${dir}/${n}`) !== String(v)) return fine(4, n)
      for (const [n, r] of Object.entries(req.scrivi)) disco.set(`${dir}/${n}`, JSON.stringify(r))
      return fine(0)
    }
    return fine(2)
  })
  on('mcp.call', (_, e) => {
    chiamate.push(e as never)
    const r = opz.mcp?.(e.server, e.tool, e.args)
    if (r !== undefined) return { value: r as never }
    if (e.tool === 'get_session' && (e.args as { session_id?: unknown }).session_id === 'self')
      return { value: { isError: false, content: [{ type: 'text', text: JSON.stringify({ model: 'claude-opus-5-5', effort: 'high', permissionMode: 'auto' }) }] } }
    if (e.tool === 'list_sessions') {
      const nomi = chiamate.filter(c => c.tool === 'start_session').map(c => c.args.name)
      return { value: { isError: false, content: [{ type: 'text', text: JSON.stringify(nomi.map(name => ({ sessionId: SID, name }))) }] } }
    }
    return { value: { isError: false, content: [{ type: 'text', text: e.tool === 'start_session' ? `started ${SID}` : '{}' }] } }
  })
  on('ui.toast', (_, e) => {
    toast.push(String((e as { text?: unknown }).text))
    return { value: undefined }
  })
  on('ui.notify', () => ({ value: { isSent: false, reason: 'no-surface' } as never }))
  on('model.complete', (_, e) => {
    const req = e as unknown as { prompt: string; model: string }
    modello.push(req)
    const r = opz.modello?.(req)
    return { value: (r ?? { isAnswered: true, text: 'Riassunto d\'esempio.', usage: { input_tokens: 700, output_tokens: 20, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } }) as never }
  })
  on('ui.open', () => ({ value: { isPlaced: true } }))
  const inviati: string[] = []
  on('prompt.submit', (_, e) => (inviati.push((e as { text: string }).text), { text: (e as { text: string }).text }))
  const registrati: { name: string; description: string; inputSchema: unknown; isDeferred?: boolean }[] = []
  on('tool.register', (_, e) => {
    registrati.push(e as never)
    return { value: { tool: e.name } }
  })
  on('command.register', () => ({ value: { command: 'chipmanager' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  const azione = () =>
    [...disco.entries()]
      .filter(([k]) => k.startsWith('X:/orch/azioni/a-'))
      .flatMap(([, v]) => {
        try {
          return [JSON.parse(v) as Azione]
        } catch {
          return []
        }
      })
  return { disco, chiamate, toast, processi, azione, modello, letti, registrati, inviati, elenchi, elenchiStrumenti }
}

const PANE = (surface: 'desktop' | 'terminal') =>
  ({
    plugin: 'chip-manager',
    surface,
    component: 'Pane',
    requestId: 'chipManager',
    props: { title: 'chipManager', isFocused: false, bodyColumns: 50, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
  }) as const

test('suggerisci, rivedi le opzioni, avvia una volta sola', async ($, on) => {
  const amb = ambiente(on)
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const r = await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'Fix ricerca', brief: 'Correggi il dedup.', esecutore: 'codex', corsia: 'R2' } as never)
  expect(String((r as { result?: unknown }).result)).toContain('in the panel')
  const id = amb.azione()[0]!.id
  expect(amb.azione()[0]!.repo).toBe('acme/progetto')

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE(surface) })
    // F9.4 supera la forma: sul desktop l'intestazione è in maiuscolo («DA AVVIARE E IN CODA»), nel terminale no.
    expect(await ui.find({ type: 'Text', text: /^Da avviare e in coda/i })).toBeDefined()
    await ui.press({ key: `mod-${id}` })
    expect(await ui.find({ key: `perm-${id}` })).toBeDefined()
    await ui.select({ key: `perm-${id}`, value: 'auto' })
    await ui.press({ key: `mod-${id}` })
    expect(await ui.find({ type: 'Text', text: /^2\.1\.0-alpha$/ })).toBeDefined()
    expect((await ui.find({ type: 'Text', text: /^48%$/ }))?.text).toBe('48%')
    await ui.unmount()
  }
  expect(amb.azione()[0]!.permessi).toBe('auto')

  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: `avvia-${id}` })
  await ui.press({ key: `avvia-${id}` }).catch(() => undefined)
  const starts = amb.chiamate.filter(c => c.tool === 'start_session')
  expect(starts.length).toBe(1)
  expect(starts[0]!.args).toMatchObject({ context: 'fresh', use_worktree: true, permission_mode: 'auto', model: 'claude-sonnet-5-5' })
  expect(String(starts[0]!.args.name)).toMatch(/^az-[a-z0-9]+$/)
  expect(amb.azione()[0]!.tentativo).toBe(starts[0]!.args.name)
  expect(amb.azione()[0]).toMatchObject({ stato: 'avviata', sessione: SID, lanciataDa: 'sessione-master' })
  expect(await ui.find({ key: `vedi-${id}` })).toBeDefined()
  await ui.unmount()
})

test('due pannelli premono «Avvia» insieme: una sola sessione', async ($, on) => {
  const amb = ambiente(on)
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'Docs', brief: 'Aggiorna il README.' } as never)
  const id = amb.azione()[0]!.id
  const u1 = await $.ui.mount({ ...PANE('desktop') })
  const u2 = await $.ui.mount({ ...PANE('terminal') })
  await Promise.all([u1.press({ key: `avvia-${id}` }), u2.press({ key: `avvia-${id}` })].map(p => p.catch(() => undefined)))
  expect(amb.chiamate.filter(c => c.tool === 'start_session').length).toBe(1)
  await u1.unmount()
  await u2.unmount()
})

test('avvio rifiutato: «fallita» con il motivo; errore di trasporto: esito incerto, poi riconciliato', async ($, on) => {
  let modo: 'rifiuta' | 'getta' = 'rifiuta'
  const amb = ambiente(on, {
    mcp: (_s, tool) => {
      if (tool === 'start_session' && modo === 'rifiuta') return { isError: true, content: [{ type: 'text', text: 'cartella non autorizzata' }] }
      if (tool === 'start_session') throw new Error('connessione persa')
      return undefined
    },
  })
  const clock = mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'Docs', brief: 'Aggiorna il README.' } as never)
  const id = amb.azione()[0]!.id
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: `avvia-${id}` })
  expect(amb.azione()[0]).toMatchObject({ stato: 'fallita' })
  expect(amb.azione()[0]!.errore).toContain('cartella non autorizzata')
  expect(await ui.find({ key: `riprova-${id}` })).toBeDefined()

  modo = 'getta'
  await ui.press({ key: `riprova-${id}` })
  expect(amb.azione()[0]).toMatchObject({ stato: 'in-avvio', incerto: true })
  // Il giro ritrova la sessione per gettone (name): nessun secondo avvio.
  await clock.advance(20_000)
  expect(amb.azione()[0]).toMatchObject({ stato: 'avviata', sessione: SID })
  expect(amb.chiamate.filter(c => c.tool === 'start_session').length).toBe(2)
  await ui.unmount()
})

test('aggiorna_azione: transizioni ammesse, «completata» = consegnata, «avviata» vuole la sessione', async ($, on) => {
  const amb = ambiente(on)
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'Docs', brief: 'Aggiorna il README.' } as never)
  let id = amb.azione()[0]!.id
  const call = (args: Record<string, unknown>) =>
    $.tool.call({ tool: 'mcp__chip-manager__aggiorna_azione', id, ...args } as never) as Promise<{ deny?: string; isError?: boolean; text?: string }>
  const rifiuto = async (args: Record<string, unknown>) => {
    const r = await call(args)
    return r.deny ?? (r.isError ? r.text : undefined) ?? ''
  }
  expect(await rifiuto({ stato: 'completata', tentativo: 'az-x' })).toContain('cannot go to')
  expect(await rifiuto({ stato: 'avviata', tentativo: 'az-x' })).toContain('sessione')
  // Il proponente può ritirare la propria proposta.
  expect(await rifiuto({ stato: 'scartata' })).toBe('')
  await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'Docs2', brief: 'Aggiorna il README.' } as never)
  id = amb.azione().find(a => a.titolo === 'Docs2')!.id
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: `avvia-${id}` })
  await ui.unmount()
  const t = amb.azione().find(a => a.id === id)!.tentativo
  expect(await rifiuto({ stato: 'completata', tentativo: 'az-vecchio' })).toContain('tentativo')
  expect(await rifiuto({ stato: 'completata', tentativo: t })).toBe('')
  expect(amb.azione().find(a => a.id === id)!.stato).toBe('consegnata')
})

test('suggerisci: sensibile:false non spegne R4; dipendenze inesistenti rifiutate', async ($, on) => {
  const amb = ambiente(on)
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const r = (await $.tool.call({
    tool: 'mcp__chip-manager__suggerisci_azione',
    titolo: 'Fix login MFA',
    brief: 'x',
    sensibile: false,
    esecutore: 'codex',
    revisore: 'nessuno',
    permessi: 'bypassPermissions',
  } as never)) as { result?: unknown }
  expect(String(r.result)).toContain('as it is it cannot start')
  expect(amb.azione()[0]!.sensibile).toBeUndefined()
  const d = (await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'B', brief: 'x', dipende: ['a-inesist01'] } as never)) as {
    deny?: string
    text?: string
  }
  expect(d.deny ?? d.text).toContain('do not exist')
})

test('giro: ferma = toast una volta; archiviata NON è fusa; il task del registro (per ramo) chiude', async ($, on) => {
  let sessione = { isArchived: false, isRunning: true, lastActivityAt: '2026-11-05T00:00:00Z', branch: 'claude/x' }
  const amb = ambiente(on, {
    mcp: (_s, tool, args) =>
      tool === 'get_session' && (args as { session_id?: unknown }).session_id !== 'self'
        ? { isError: false, content: [{ type: 'text', text: JSON.stringify(sessione) }] }
        : undefined,
  })
  const clock = mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'Docs', brief: 'Aggiorna il README.' } as never)
  const id = amb.azione()[0]!.id
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: `avvia-${id}` })
  await clock.advance(20_000)
  sessione = { ...sessione, isRunning: false }
  await clock.advance(20_000)
  await clock.advance(20_000)
  expect(amb.toast.filter(t => t.includes('si è fermata')).length).toBe(1)
  sessione = { ...sessione, isArchived: true }
  await clock.advance(20_000)
  expect(amb.azione()[0]!.stato).toBe('consegnata')
  // Nel record la frase in inglese e il codice, che il pannello traduce.
  expect(amb.azione()[0]).toMatchObject({ erroreCodice: 'rec.archiviata', errore: expect.stringContaining('archived without a recorded merge') })
  // Senza issue il task del ramo non si associa: chiude il committente (un ramo ospita più lavori).
  amb.disco.set('X:/orch/registro.json', JSON.stringify({ task: { vecchio: { issue: 1, ramo: 'claude/x', stato: 'fuso', creato: '2026-01-01' }, t1: { issue: 1, ramo: 'claude/x', stato: 'fuso', creato: '2999-01-01' } } }))
  await clock.advance(20_000)
  expect(amb.azione()[0]!.stato).toBe('consegnata')
  const conIssue = amb.azione()[0]!
  amb.disco.set(`X:/orch/azioni/${conIssue.id}.json`, JSON.stringify({ ...conIssue, issue: 1 }))
  // R10: una consegnata segue la cadenza lenta (60 s): la chiude il registro entro un minuto.
  await clock.advance(60_000)
  expect(amb.azione()[0]!.stato).toBe('completata')
  await ui.unmount()
})

test('avvio incerto: a scadenza NON diventa fallita da solo; si annulla a mano; il manuale prende il gettone', async ($, on) => {
  const amb = ambiente(on, {
    mcp: (_s, tool) => {
      if (tool === 'start_session') throw new Error('connessione persa')
      if (tool === 'list_sessions') return { isError: false, content: [{ type: 'text', text: '[]' }] }
      return undefined
    },
  })
  const clock = mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'Docs', brief: 'Aggiorna il README.' } as never)
  const id = amb.azione()[0]!.id
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: `avvia-${id}` })
  expect(amb.azione()[0]).toMatchObject({ stato: 'in-avvio', incerto: true })
  // Il tempo di sistema avanza oltre la scadenza: il giro non la dichiara fallita.
  amb.disco.set(
    `X:/orch/azioni/${id}.json`,
    JSON.stringify({ ...amb.azione()[0], avvioScade: '2000-01-01T00:00:00.000Z' }),
  )
  await clock.advance(20_000)
  expect(amb.azione()[0]!.stato).toBe('in-avvio')
  await ui.press({ key: `annullaT-${id}` })
  expect(amb.azione()[0]!.stato).toBe('fallita')

  // Ripiego manuale: «presa» una volta sola, e dopo non si annulla.
  await ui.press({ key: `chiedi-${id}` })
  const t = amb.azione()[0]!.tentativo
  // La procedura per l'agente è in inglese: prima la presa del gettone, stop sul rifiuto, poi la conferma dell'esito.
  const procedura = amb.inviati.at(-1)!
  for (const pezzo of ['FIRST call', 'stato "presa"', 'if it refuses', 'do NOT start anything', 'mcp__ccd_session__start_session', 'stato "avviata"', 'stato "fallita"', `tentativo "${t}"`])
    expect(procedura).toContain(pezzo)
  expect(procedura).not.toMatch(/PRIMA|chiama|tentativo è stato/)
  expect(amb.azione()[0]).toMatchObject({ stato: 'in-avvio', manuale: true })
  const presa = (args: Record<string, unknown>) =>
    $.tool.call({ tool: 'mcp__chip-manager__aggiorna_azione', id, stato: 'presa', ...args } as never) as Promise<{ deny?: string; result?: unknown }>
  expect((await presa({ tentativo: 'az-altro' })).deny).toContain('tentativo')
  expect((await presa({ tentativo: t })).deny).toBeUndefined()
  expect((await presa({ tentativo: t })).deny).toContain('cannot be taken')
  expect(await ui.find({ key: `annullaT-${id}` })).toBeUndefined()
  await ui.unmount()
})

test('guardia R4 con spazi o trattini; filtro sul modello mostrato; soglia del registro all\'invio', () => {
  // I nomi dei moduli sensibili di un progetto vengono dalla sua configurazione, non dal codice.
  const RP = { ...R, sensibili: ['gestione[ _-]?magazzino', 'centro[ _-]?(?:di[ _-]?)?controllo'] }
  for (const t of ['Correggi centro controllo', 'gestione magazzino: ferie', 'centro-di-controllo'])
    expect(sensibile(base('a-sp000001', 1, { titolo: t }), RP)).toBe(true)
  expect(sensibile(base('a-sp000002', 1, { titolo: 'Correggi centro controllo' }), R)).toBe(false)
  // Un termine che non compila rende sensibile tutto: mai una guardia spenta in silenzio.
  expect(sensibile(base('a-sp000003', 1, { titolo: 'Docs' }), { sensibili: ['(rotta'] })).toBe(true)
  expect(corrisponde(base('a-fl000001', 1), 'opus')).toBe(true)
  // Invio alle 10:00:00, task alle 10:00:05, riconciliazione alle 10:00:20: il task è di questa azione.
  const reg = { task: { t: { issue: 5, ramo: 'fix/x', stato: 'fuso', creato: '2026-11-05T10:00:05Z' } } }
  expect(faseDiAzione(reg, { issue: 5, ramoSessione: 'fix/x', tentatoIl: '2026-11-05T10:00:00Z', avviataIl: '2026-11-05T10:00:20Z' })).toBe('fuso')
})

test('seconda presa dopo un fallimento; «Annulla» solo nel pannello che ha chiesto l\'avvio', async ($, on) => {
  const amb = ambiente(on, { mcp: (_s, tool) => (tool === 'start_session' ? { isError: true, content: [{ type: 'text', text: 'no' }] } : undefined) })
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'Docs', brief: 'Aggiorna il README.' } as never)
  const id = amb.azione()[0]!.id
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: `avvia-${id}` })
  const chiama = (args: Record<string, unknown>) =>
    $.tool.call({ tool: 'mcp__chip-manager__aggiorna_azione', id, ...args } as never) as Promise<{ deny?: string }>
  for (let giro = 0; giro < 2; giro++) {
    await ui.press({ key: `chiedi-${id}` })
    const t = amb.azione()[0]!.tentativo
    expect((await chiama({ stato: 'presa', tentativo: t })).deny).toBeUndefined()
    expect((await chiama({ stato: 'fallita', tentativo: t })).deny).toBeUndefined()
  }
  // Un tentativo di un'altra sessione: nessun «Annulla» qui.
  const a = amb.azione()[0]!
  amb.disco.set(
    `X:/orch/azioni/${id}.json`,
    JSON.stringify({ ...a, stato: 'in-avvio', manuale: true, tentativo: 'az-altra', lanciataDa: 'altra-sessione', avvioScade: '2000-01-01T00:00:00.000Z' }),
  )
  const u2 = await $.ui.mount({ ...PANE('terminal') })
  await ui.press({ key: 'ricarica' })
  expect(await u2.find({ key: `annullaT-${id}` })).toBeUndefined()
  await u2.unmount()
  await ui.unmount()
})

test('registro: un task preparato prima dell\'avvio (pronto) si associa e si segue per id fino alla fusione', () => {
  const a = { issue: 7, ramoSessione: 'fix/z', tentatoIl: '2026-11-05T10:00:00Z' }
  const prima = { task: { k: { issue: 7, ramo: 'fix/z', stato: 'pronto', creato: '2026-11-05T09:30:00Z' } } }
  expect(trovaTask(prima, a)).toBe('k')
  const dopo = { task: { k: { issue: 7, ramo: 'fix/z', stato: 'fuso', creato: '2026-11-05T09:30:00Z' } } }
  expect(faseDiAzione(dopo, { ...a, taskId: 'k' })).toBe('fuso')
  // Senza associazione, lo stesso task chiuso e nato prima dell'invio non è di questa azione.
  expect(trovaTask(dopo, a)).toBeUndefined()
  // Il filtro usa le regole lette: con Sonnet primo, una proposta senza modello è Sonnet.
  const sonnetPrimo = { ...R, modelli: { ...R.modelli, claude: ['claude-sonnet-5-5', 'claude-opus-5-5'] } }
  expect(corrisponde(base('a-fs000001', 1), 'sonnet', sonnetPrimo)).toBe(true)
  expect(corrisponde(base('a-fs000001', 1), 'opus', sonnetPrimo)).toBe(false)
})

test('suggerisci: titolo di soli spazi rifiutato', async ($, on) => {
  ambiente(on)
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const r = (await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: '   ', brief: 'x' } as never)) as { deny?: string; text?: string }
  expect(r.deny ?? r.text).toContain('missing titolo')
})

test('F6 guardie: una sola modalità effettiva; api-claude solo Claude, senza fork, col worktree, chiave e budget; mai per le sensibili', () => {
  expect([base('a-mod00001', 1), base('a-mod00002', 1, { destinazione: 'cloud' }), base('a-mod00003', 1, { destinazione: 'api-claude' }),
    base('a-mod00004', 1, { esecutore: 'freellmapi', destinazione: 'cloud' })].map(modalitaDi)).toEqual(['local', 'cloud', 'api-claude', 'esterno'])
  const RA = { ...R, chiaveApi: true, risorse: { ...R.risorse, apiClaude: { budgetUsd: 20, tetto: 2 } } }
  const a = base('a-api00001', 1, { repo: AUTORE.repo!, destinazione: 'api-claude' })
  const k = (x: Azione, r: Regole = RA) => violazioni(x, r).map(m => m.k)
  expect(k(a)).toEqual([])
  expect(k({ ...a, esecutore: 'codex', revisore: 'claude', corsia: 'R2' })).toContain('v.apiClaude')
  expect(k({ ...a, contesto: 'fork' })).toContain('v.apiFork')
  expect(k({ ...a, worktree: false })).toContain('v.apiWorktree')
  expect(k(a, R)).toEqual(expect.arrayContaining(['v.apiChiave', 'v.apiBudget']))
  expect(k({ ...a, corsia: 'R4', revisore: 'claude' })).toContain('v.r4Api')
  // Il filtro dei dati LAN non serve: il lavoro resta su questa macchina, come Claude Code locale.
  expect(k({ ...a, brief: 'vedi log: 192.168.1.4' })).toEqual([])
  // Avvio: nessuna guardia sul modello della sessione (il processo parte con --model); mai «qui».
  expect(violazioniAvvio(a, RA, [a], AUTORE)).toEqual([])
  expect(violazioniAvvio(a, RA, [a], AUTORE, true).map(m => m.k)).toContain('v.apiQui')
  expect(violazioniAvvio({ ...a, permessi: 'bypassPermissions' }, RA, [a], AUTORE).map(m => m.k)).toContain('v.cliPermessi')
  // I record accettano la destinazione nuova; un valore sconosciuto no.
  expect('k' in normalizza({ ...a })).toBe(false)
  expect(normalizza({ ...a, destinazione: 'api-codex' })).toEqual({ k: 'rec.campo', p: { campo: 'opzioni' } })
})

const CHIAVE_API = 'sk-ant-sentinella-0123456789'
// F10: la corsia API si accende solo dall'account (tutti i progetti); il registro della spesa è uno, dell'account.
const CONFIG_API = JSON.stringify({ account: { apiClaude: { budgetUsd: 20 } }, progetti: { 'acme/progetto': {} } })
const SPESA_API = 'X:/casa/.claude/chipmanager/spesa-api.json'
const chipApi = (id: string) => base(id, 1, { repo: AUTORE.repo!, destinazione: 'api-claude', revisore: 'claude' })

test('F6.2 avvio: la chip api-claude va all\'helper con la chiave solo su stdin, tetto e budget del mese; il mandato è quello senza coordinatore', { options: { anthropicApiKey: CHIAVE_API } }, async ($, on) => {
  const chiamate: { a: string[]; stdin: string | undefined }[] = []
  const amb = ambiente(on, { api: (cmd, a, stdin) => (cmd === 'lancia-api' ? (chiamate.push({ a, stdin }), [0, '']) : undefined) })
  amb.disco.set(CONFIG, CONFIG_API)
  const a = chipApi('a-apiavv01')
  amb.disco.set(`X:/orch/azioni/${a.id}.json`, JSON.stringify(a))
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: 'ricarica' })
  await ui.press({ key: `avvia-${a.id}` })
  expect(chiamate.length).toBe(1)
  const record = amb.disco.get(`X:/orch/azioni/${a.id}.json`)!
  const r = JSON.parse(record) as Azione
  expect(r).toMatchObject({ stato: 'avviata', lanciatore: 'api-claude' })
  expect(chiamate[0]!.a).toEqual(['X:/orch/azioni', a.id, r.tentativo])
  const ingresso = JSON.parse(chiamate[0]!.stdin!) as Record<string, unknown>
  // F10: budget e tetto li rilegge l'helper dal config (qui solo informativi): riceve il file e il progetto.
  expect(ingresso).toMatchObject({ chiave: CHIAVE_API, tetto: 2, budget: 20, modello: 'claude-opus-5-5', config: CONFIG, repo: 'acme/progetto' })
  expect(String(ingresso.prompt)).toContain('How this run works')
  expect(String(ingresso.prompt)).not.toMatch(/coordinator|aggiorna_azione/)
  // La chiave non sta mai in argv, nel record, nei processi registrati se non sullo stdin dell'helper.
  expect(amb.processi.some(x => x.argv.join(' ').includes(CHIAVE_API))).toBe(false)
  expect(record.includes(CHIAVE_API)).toBe(false)
  await ui.unmount()
})

test('F6.2 avvio: lock occupato, budget insufficiente e impostazioni vietate chiudono il tentativo con il motivo', { options: { anthropicApiKey: CHIAVE_API } }, async ($, on) => {
  let risposta: [number, string] = [3, '{"motivo":"in-corso"}']
  const amb = ambiente(on, { api: cmd => (cmd === 'lancia-api' ? risposta : undefined) })
  amb.disco.set(CONFIG, CONFIG_API)
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  const casi: [[number, string], string][] = [
    [[3, '{"motivo":"in-corso"}'], 'err.apiOccupata'],
    [[5, '{"speso":19,"budget":20}'], 'err.apiBudget'],
    [[6, '{"fonti":["utente","ambiente"]}'], 'err.apiImpostazioni'],
    // F10: i motivi nuovi dell'helper, che rilegge budget e limiti dal config.
    [[5, '{"registroSviluppo":"X:/vecchia"}'], 'err.apiRegistroSviluppo'],
    [[5, '{"spenta":true}'], 'v.apiBudget'],
    [[5, '{"spesoProgetto":4,"limiteProgetto":5,"tetto":2}'], 'err.apiLimiteProgetto'],
    [[6, '{"percorso":"dentro un repository"}'], 'err.percorsoDati'],
  ]
  for (const [i, [esito, chiave]] of casi.entries()) {
    risposta = esito
    const a = chipApi(`a-apino00${i}`)
    amb.disco.set(`X:/orch/azioni/${a.id}.json`, JSON.stringify(a))
    await ui.press({ key: 'ricarica' })
    await ui.press({ key: `avvia-${a.id}` })
    const r = JSON.parse(amb.disco.get(`X:/orch/azioni/${a.id}.json`)!) as Azione
    expect([chiave, r.stato, r.erroreCodice]).toEqual([chiave, 'fallita', chiave])
  }
  const r = JSON.parse(amb.disco.get('X:/orch/azioni/a-apino002.json')!) as Azione
  expect(r.erroreParametri).toEqual({ fonti: 'utente, ambiente' })
  await ui.unmount()
})

test('F6.2 esito: dal file dell\'esecuzione entrano solo stato, ramo e costo stimato; la chip mostra il costo', { options: { anthropicApiKey: CHIAVE_API } }, async ($, on) => {
  const amb = ambiente(on)
  amb.disco.set(CONFIG, CONFIG_API)
  const a = { ...chipApi('a-apiesi01'), stato: 'avviata' as const, lanciatore: 'api-claude' as const, tentativo: 'az-apiesi01', avviataIl: '2026-11-06T10:00:00Z' }
  amb.disco.set(`X:/orch/azioni/${a.id}.json`, JSON.stringify(a))
  amb.disco.set('X:/orch/azioni/esecuzioni/az-apiesi01.json', JSON.stringify({ id: a.id, tentativo: a.tentativo, stato: 'consegnata', ramo: 'chipmanager/az-apiesi01', costo: 0.42, result: 'non entra' }))
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: 'ricarica' })
  const r = JSON.parse(amb.disco.get(`X:/orch/azioni/${a.id}.json`)!) as Azione & { result?: unknown }
  expect(r).toMatchObject({ stato: 'consegnata', costoApi: 0.42, ramoSessione: 'chipmanager/az-apiesi01' })
  expect(r.result).toBeUndefined()
  await ui.press({ key: `mod-${a.id}` })
  expect(await ui.find({ type: 'Text', text: /Costo API \(stimato\): 0,42 USD/ })).toBeDefined()
  await ui.unmount()
})

test('F6.2 lock: tenuto dopo un\'esecuzione, il pannello dice perché; «Termina» e «Libera» solo con il loro popup', async ($, on) => {
  let stato = { libero: false, motivo: 'discendenti', discendenti: ['5151'], tentativo: 'az-lock0001' } as Record<string, unknown>
  const comandi: string[] = []
  const amb = ambiente(on, { api: cmd => {
    comandi.push(cmd)
    return cmd === 'stato-api' ? [0, JSON.stringify(stato)] : cmd === 'libera-api' ? [0, JSON.stringify({ libero: true })] : [0, '{"chiusi":1}']
  } })
  const domande: string[] = []
  conferme(on, q => (domande.push(q), q.startsWith('Terminare') ? 'Termina i processi' : 'Libera'))
  // Senza file del lock nessun processo.
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: 'ricarica' })
  expect(comandi).toEqual([])
  amb.disco.set('X:/casa/.claude/chipmanager/api-claude.json', '{}')
  await ui.press({ key: 'ricarica' })
  expect(await ui.find({ type: 'Text', text: 'Corsia API Claude tenuta: processi rimasti: 1 (PID 5151)' })).toBeDefined()
  expect(await ui.find({ key: 'libera-api' })).toBeUndefined()
  await ui.press({ key: 'termina-api' })
  expect(domande.at(-1)).toBe('Terminare 1 processi lasciati dall\'ultima esecuzione API Claude (PID 5151)?')
  expect(comandi).toContain('termina-api')
  // Uscita non registrata: «Libera», con il popup che spiega il rischio.
  stato = { libero: false, motivo: 'senza-pid', tentativo: 'az-lock0001' }
  await ui.press({ key: 'ricarica' })
  expect(await ui.find({ key: 'termina-api' })).toBeUndefined()
  stato = { libero: true }
  await ui.press({ key: 'libera-api' })
  expect(domande.at(-1)).toMatch(/^Liberare la corsia API Claude\? .*il tetto intero\.$/)
  expect(comandi).toContain('libera-api')
  expect(amb.toast.at(-1)).toBe('Corsia API Claude liberata')
  expect(await ui.find({ key: 'lock-api' })).toBeUndefined()
  await ui.unmount()
})

test('F6.4 Carico: la spesa API del mese (stimata) contro il budget in USD; senza API configurata nessuna riga; nota sul cloud', async ($, on) => {
  const mese = new Date().toISOString().slice(0, 7)
  // F10: ogni voce porta il progetto (senza, il registro non si legge); la parte del progetto si somma a parte.
  const progetto = 'acme/progetto'
  const voci = { a: { progetto, mese, tetto: 2, stato: 'contato', costo: 3.2 }, b: { progetto: 'altro/repo', mese, tetto: 2, stato: 'prenotato' }, c: { progetto, mese: '2000-01', tetto: 9, stato: 'prenotato' }, d: { progetto, mese, tetto: 2, stato: 'contato', costo: null } }
  expect(spesaDelMese({ v: 1, voci }, mese)).toBe(7.2)
  expect(spesaDelMese({ v: 1, voci }, mese, progetto)).toBe(5.2)
  expect(spesaDelMese({ v: 1, voci: { a: { mese, tetto: 2, stato: 'prenotato' } } }, mese)).toBeNull()
  expect(spesaDelMese({ v: 2 }, mese)).toBeNull()
  const amb = ambiente(on)
  amb.disco.set(SPESA_API, JSON.stringify({ v: 1, voci: { 'az-spesa001': { progetto, mese, tetto: 2, stato: 'contato', costo: 3.2 }, 'az-spesa002': { progetto, mese, tetto: 2, stato: 'prenotato' },
    'az-spesa003': { progetto: 'altro/repo', mese, tetto: 2, stato: 'contato', costo: 1 } } }))
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: 'vista-carico' })
  expect(await ui.find({ type: 'Text', text: /^API Claude:/ })).toBeUndefined()
  amb.disco.set(CONFIG, CONFIG_API)
  const cloud = { ...base('a-cloud0f6', 1, { repo: AUTORE.repo!, destinazione: 'cloud', revisore: 'claude' }) }
  amb.disco.set(`X:/orch/azioni/${cloud.id}.json`, JSON.stringify(cloud))
  // La spesa si legge all'inizio del giro, con le regole del giro prima: la riga compare dal giro dopo il cambio.
  await ui.press({ key: 'ricarica' })
  await ui.press({ key: 'ricarica' })
  expect(await ui.find({ type: 'Text', text: 'API Claude: 5,20 USD questo progetto · 6,20 USD di 20 USD account (stimato, questo mese)' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^Questo progetto: al massimo/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /^Il cloud di Claude consuma gli stessi limiti del piano/ })).toBeDefined()
  amb.disco.set(SPESA_API, '{ rotto')
  await ui.press({ key: 'ricarica' })
  expect(await ui.find({ type: 'Text', text: 'API Claude: budget 20 USD, spesa non leggibile' })).toBeDefined()
  await ui.unmount()
})

test('F6.5 consigliere: tabella corsia × sensibilità × configurazione × soglie → destinazione e motivo', () => {
  const RA: Regole = { ...R, chiaveApi: true, risorse: { ...R.risorse, apiClaude: { budgetUsd: 20, tetto: 2 }, consigliere: 'suggerisci' } }
  const a = base('a-cons0001', 1, { repo: AUTORE.repo!, revisore: 'claude' })
  const piano = (percentuale: number) => [{ ...LIMITE, percentuale, letto: new Date().toISOString() }]
  const k = (c: Consiglio | null) => c && [c.d, c.motivi.map(m => m.k)]
  // Piano sotto l'attenzione: locale.
  expect(k(consigliaDove(a, RA, piano(50), [a], 3))).toEqual(['local', ['cons.piano']])
  expect(k(consigliaDove(a, RA, [], [a], 3))).toEqual(['local', ['cons.pianoOk']])
  // Oltre l'attenzione con budget: API, con il motivo del piano e del budget.
  expect(k(consigliaDove(a, RA, piano(82), [a], 3))).toEqual(['api-claude', ['cons.piano', 'cons.budget']])
  expect(consigliaDove(a, RA, piano(82), [a], 3)?.motivi[1]).toEqual({ k: 'cons.budget', p: { speso: 3, budget: 20 } })
  // Oltre la critica: né locale né cloud (stesso piano); resta l'API.
  expect(k(consigliaDove(a, RA, piano(95), [a], 3))?.[0]).toBe('api-claude')
  // Budget che non basta per un altro tetto: niente API; oltre l'attenzione resta il locale.
  expect(k(consigliaDove(a, RA, piano(82), [a], 19))?.[0]).toBe('local')
  // Lavoro lungo (R3) su un repo GitHub, piano oltre l'attenzione: cloud, che non promette modello ed effort.
  expect(k(consigliaDove({ ...a, corsia: 'R3' }, RA, piano(82), [a], 3))).toEqual(['cloud', ['cons.piano', 'cons.parallelo', 'cons.modelloCloud']])
  // Sensibile: sempre locale.
  expect(k(consigliaDove({ ...a, corsia: 'R4' }, RA, piano(95), [a], 3))).toEqual(['local', ['cons.sensibile']])
  // Codex esecutore: basta il suo limite oltre la critica per escludere il locale; cloud e API non sono ammessi → niente.
  const codex = { ...a, esecutore: 'codex' as const, corsia: 'R2' as const }
  expect(consigliaDove(codex, RA, [...piano(20), { ...LIMITE, id: 'codex-primary', fornitore: 'codex', percentuale: 97 }], [codex], 3)).toBeNull()
  // Le scelte esplicite non si toccano; l'esecutore esterno decide da sé.
  expect(consigliaDove({ ...a, destinazione: 'local' }, RA, piano(95), [a], 3)).toBeNull()
  expect(consigliaDove({ ...a, esecutore: 'freellmapi' }, RA, piano(95), [a], 3)).toBeNull()
})

test('F6.5 consigliere: «Suggerisci» mostra dove e perché sulla proposta; «Applica» scrive la destinazione nel giro', { options: { anthropicApiKey: CHIAVE_API } }, async ($, on) => {
  const amb = ambiente(on)
  const a = base('a-cons0002', 1, { repo: AUTORE.repo!, revisore: 'claude' })
  amb.disco.set(`X:/orch/azioni/${a.id}.json`, JSON.stringify(a))
  amb.disco.set(CONFIG, JSON.stringify({ account: { apiClaude: { budgetUsd: 20 } }, progetti: { 'acme/progetto': { consigliere: 'suggerisci' } } }))
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: 'ricarica' })
  expect(await ui.find({ type: 'Text', text: '→ locale · piano sotto l\'attenzione' })).toBeDefined()
  expect(JSON.parse(amb.disco.get(`X:/orch/azioni/${a.id}.json`)!).destinazione).toBeUndefined()
  amb.disco.set(CONFIG, JSON.stringify({ account: { apiClaude: { budgetUsd: 20 } }, progetti: { 'acme/progetto': { consigliere: 'applica' } } }))
  await ui.press({ key: 'ricarica' })
  await ui.press({ key: 'ricarica' })
  expect(JSON.parse(amb.disco.get(`X:/orch/azioni/${a.id}.json`)!).destinazione).toBe('local')
  await ui.unmount()
})

test('F6 risorse_agenti: destinazioni configurate e margini in inglese, dentro il tetto; della chiave solo la presenza', { options: { anthropicApiKey: CHIAVE_API } }, async ($, on) => {
  const amb = ambiente(on)
  amb.disco.set(CONFIG, JSON.stringify({ account: { apiClaude: { budgetUsd: 20 } }, progetti: { 'acme/progetto': { consigliere: 'suggerisci' } } }))
  const mese = new Date().toISOString().slice(0, 7)
  amb.disco.set(SPESA_API, JSON.stringify({ v: 1, voci: { 'az-spesa009': { progetto: 'acme/progetto', mese, tetto: 2, stato: 'contato', costo: 1.5 },
    'az-spesa010': { progetto: 'altro/repo', mese, tetto: 2, stato: 'contato', costo: 1 } } }))
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: 'ricarica' })
  await ui.press({ key: 'ricarica' })
  const r = (await $.tool.call({ tool: 'mcp__chip-manager__risorse_agenti' } as never)) as { result: string }
  expect(r.result.length).toBeLessThanOrEqual(TETTO_RISORSE)
  expect(r.result).not.toContain(CHIAVE_API)
  const d = JSON.parse(r.result) as { destinazioni: Record<string, unknown> }
  expect(d.destinazioni).toMatchObject({
    // F10: il budget è dell'account (tutti i progetti); tetto e spesa di questo progetto a parte.
    'api-claude': { account: { budgetUsd: 20, spentThisMonthUsd: 2.5, appliesTo: 'all projects' }, project: { capPerRunUsd: 2, spentThisMonthUsd: 1.5 }, estimated: true, lane: 'free' },
    advisor: 'suggerisci',
  })
  expect(String(d.destinazioni.cloud)).toMatch(/^Claude cloud: same plan limits as local/)
  await ui.unmount()
})

test('F6 rilievo 4: le fonti dell\'host (policy compresa) con un login o un gateway imposto bloccano l\'avvio API; una fonte che non si legge blocca', { options: { anthropicApiKey: CHIAVE_API } }, async ($, on) => {
  let fonte = (source?: string): unknown => (source === 'policy' ? { forceLoginGatewayUrl: 'https://gw.example' } : {})
  const chiamate: string[] = []
  const amb = ambiente(on, { impostazioni: source => fonte(source), api: cmd => (chiamate.push(cmd), [0, '']) })
  amb.disco.set(CONFIG, CONFIG_API)
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  for (const [i, attesa] of [[0, 'policy'], [1, 'project']] as const) {
    if (i === 1) fonte = source => { if (source === 'project') throw new Error('non leggibile'); return {} }
    const a = chipApi(`a-apifon0${i}`)
    amb.disco.set(`X:/orch/azioni/${a.id}.json`, JSON.stringify(a))
    await ui.press({ key: 'ricarica' })
    await ui.press({ key: `avvia-${a.id}` })
    const r = JSON.parse(amb.disco.get(`X:/orch/azioni/${a.id}.json`)!) as Azione
    expect([r.stato, r.erroreCodice, r.erroreParametri]).toEqual(['fallita', 'err.apiImpostazioni', { fonti: attesa }])
  }
  expect(chiamate.filter(c => c === 'lancia-api')).toEqual([])
  expect(impostazioniApiVietate({ permissions: {} })).toBe(false)
  await ui.unmount()
})

test('F6 rilievo 2: un registro della spesa non valido chiude il tentativo con il suo motivo, non con un budget inventato', { options: { anthropicApiKey: CHIAVE_API } }, async ($, on) => {
  const amb = ambiente(on, { api: cmd => (cmd === 'lancia-api' ? [5, '{"registro":"non valido"}'] : undefined) })
  amb.disco.set(CONFIG, CONFIG_API)
  const a = chipApi('a-apireg01')
  amb.disco.set(`X:/orch/azioni/${a.id}.json`, JSON.stringify(a))
  expect(spesaDelMese({ v: 1, voci: { x: { mese: '2026-11', stato: 'prenotato' } } }, '2026-11')).toBeNull()
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: 'ricarica' })
  await ui.press({ key: `avvia-${a.id}` })
  expect((JSON.parse(amb.disco.get(`X:/orch/azioni/${a.id}.json`)!) as Azione).erroreCodice).toBe('err.apiRegistro')
  await ui.unmount()
})

test('F6 rilievo 7: una chip fork non riceve consigli cloud o API; «Applica» scrive solo la destinazione e la chip resta fork', { options: { anthropicApiKey: CHIAVE_API } }, async ($, on) => {
  const RA: Regole = { ...R, chiaveApi: true, risorse: { ...R.risorse, apiClaude: { budgetUsd: 20, tetto: 2 }, consigliere: 'applica' } }
  const fork = base('a-consfk01', 1, { repo: AUTORE.repo!, revisore: 'claude', corsia: 'R3', contesto: 'fork', origineFork: 'sessione-master' })
  const piano = [{ ...LIMITE, percentuale: 82, letto: new Date().toISOString() }]
  expect(consigliaDove(fork, RA, piano, [fork], 3)?.d).toBe('local')
  const amb = ambiente(on)
  amb.disco.set(`X:/orch/azioni/${fork.id}.json`, JSON.stringify(fork))
  amb.disco.set(CONFIG, JSON.stringify({ account: { apiClaude: { budgetUsd: 20 } }, progetti: { 'acme/progetto': { consigliere: 'applica' } } }))
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: 'ricarica' })
  await ui.press({ key: 'ricarica' })
  expect(JSON.parse(amb.disco.get(`X:/orch/azioni/${fork.id}.json`)!)).toMatchObject({ destinazione: 'local', contesto: 'fork' })
  await ui.unmount()
})

test('F6 guardie: suggerisci_azione accetta api-claude e rifiuta le destinazioni fuori dalla 2.2.0', async ($, on) => {
  ambiente(on)
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const no = (await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'Prova', brief: 'x', destinazione: 'api-codex' } as never)) as { deny?: string; text?: string }
  expect(no.deny ?? no.text).toContain('destinazione: local | cloud | api-claude')
  const si = (await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'Prova', brief: 'x', destinazione: 'api-claude' } as never)) as { deny?: string; result?: string }
  expect(si.deny).toBeUndefined()
})

test('registro: un task chiuso e nato prima dell\'invio non si associa mai (anche se aggiornato dopo)', () => {
  const a = { issue: 9, ramoSessione: 'fix/q', tentatoIl: '2026-11-05T10:00:00Z' }
  // Vecchio task del ramo, fuso alle 09:40 e «pubblicato» alle 10:01: non è di questa azione.
  const vecchio = { task: { k: { issue: 9, ramo: 'fix/q', stato: 'pubblicato', creato: '2026-11-05T09:00:00Z', aggiornato: '2026-11-05T10:01:00Z' } } }
  expect(trovaTask(vecchio, a)).toBeUndefined()
  // Lo stesso task ancora aperto si associa: da lì lo si segue per id fino alla fusione.
  const aperto = { task: { k: { issue: 9, ramo: 'fix/q', stato: 'pronto', creato: '2026-11-05T09:00:00Z' } } }
  expect(trovaTask(aperto, a)).toBe('k')
})

test('giro: la fusione registrata chiude l\'azione anche se get_session fallisce', async ($, on) => {
  const amb = ambiente(on, {
    mcp: (_s, tool, args) =>
      tool === 'get_session' && (args as { session_id?: unknown }).session_id !== 'self'
        ? { isError: true, content: [{ type: 'text', text: 'session not found' }] }
        : undefined,
  })
  const clock = mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'Docs', brief: 'Aggiorna il README.' } as never)
  const a = amb.azione()[0]!
  amb.disco.set(
    `X:/orch/azioni/${a.id}.json`,
    JSON.stringify({ ...a, stato: 'consegnata', sessione: SID, taskId: 'k', tentativo: 'az-x', tentatoIl: '2026-11-05T10:00:00Z' }),
  )
  amb.disco.set('X:/orch/registro.json', JSON.stringify({ task: { k: { issue: 1, ramo: 'fix/q', stato: 'fuso', creato: '2026-11-05T09:00:00Z' } } }))
  await clock.advance(20_000)
  expect(amb.azione()[0]!.stato).toBe('completata')
})

test('registro: senza issue nessuna associazione; in cartella condivisa solo task nati dopo l\'invio', () => {
  const reg = { task: { k: { issue: 42, ramo: 'fix/shared', stato: 'revisione', creato: '2026-11-05T09:00:00Z' } } }
  expect(trovaTask(reg, { ramoSessione: 'fix/shared', tentatoIl: '2026-11-05T10:00:00Z' })).toBeUndefined()
  expect(trovaTask(reg, { issue: 42, ramoSessione: 'fix/shared', tentatoIl: '2026-11-05T10:00:00Z' })).toBe('k')
  // Cartella condivisa: il task aperto di prima è di un altro lavoro in corso sullo stesso ramo.
  expect(trovaTask(reg, { issue: 42, ramoSessione: 'fix/shared', tentatoIl: '2026-11-05T10:00:00Z', worktree: false })).toBeUndefined()
  expect(trovaTask(reg, { issue: 42, ramoSessione: 'fix/shared', tentatoIl: '2026-11-05T10:00:00Z', qui: true })).toBeUndefined()
})

test('registro: cartella condivisa mai associata; un task è di una sola azione', () => {
  const reg = { task: { b: { issue: 42, ramo: 'main', stato: 'fuso', creato: '2026-11-05T10:05:00Z' } } }
  const comune = { issue: 42, ramoSessione: 'main', tentatoIl: '2026-11-05T10:00:00Z' }
  // A e B in cartella condivisa: il task di B non si associa né ad A né a B.
  expect(trovaTask(reg, { ...comune, id: 'a-aaaaaaaa', worktree: false })).toBeUndefined()
  expect(trovaTask(reg, { ...comune, id: 'a-bbbbbbbb', contesto: 'fork' })).toBeUndefined()
  // Worktree propri: il task già preso da un'altra azione non si associa a una seconda.
  expect(trovaTask(reg, { ...comune, id: 'a-aaaaaaaa' }, [{ id: 'a-bbbbbbbb', taskId: 'b' }])).toBeUndefined()
  expect(trovaTask(reg, { ...comune, id: 'a-bbbbbbbb' }, [{ id: 'a-bbbbbbbb', taskId: 'b' }])).toBe('b')
})

test('giro: la prima osservazione «ferma» di un avvio recente avvisa, una volta', async ($, on) => {
  const amb = ambiente(on, {
    mcp: (_s, tool, args) =>
      tool === 'get_session' && (args as { session_id?: unknown }).session_id !== 'self'
        ? { isError: false, content: [{ type: 'text', text: JSON.stringify({ isRunning: false, branch: 'claude/y' }) }] }
        : undefined,
  })
  const clock = mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'Docs', brief: 'Aggiorna il README.' } as never)
  const id = amb.azione()[0]!.id
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: `avvia-${id}` })
  await clock.advance(20_000)
  await clock.advance(20_000)
  expect(amb.toast.filter(t => t.includes('si è fermata')).length).toBe(1)
  await ui.unmount()
})

test('taskId salvati da una versione precedente: invalidi in cartella condivisa o se duplicati', () => {
  const a = { id: 'a-aaaaaaaa', taskId: 'b', worktree: false as const }
  const b = { id: 'a-bbbbbbbb', taskId: 'b' }
  expect(taskAccertato(a, [a, b])).toBeUndefined()
  expect(taskAccertato({ id: 'a-bbbbbbbb', taskId: 'b' }, [b, { id: 'a-cccccccc', taskId: 'b' }])).toBeUndefined()
  expect(taskAccertato(b, [b])).toBe('b')
})

test('giro: una lettura fallita fra due «ferma» non ripete l\'avviso', async ($, on) => {
  let errore = false
  const amb = ambiente(on, {
    mcp: (_s, tool, args) => {
      if (tool !== 'get_session' || (args as { session_id?: unknown }).session_id === 'self') return undefined
      return errore
        ? { isError: true, content: [{ type: 'text', text: 'temporaneo' }] }
        : { isError: false, content: [{ type: 'text', text: JSON.stringify({ isRunning: false, branch: 'claude/y' }) }] }
    },
  })
  const clock = mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'Docs', brief: 'Aggiorna il README.' } as never)
  const id = amb.azione()[0]!.id
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: `avvia-${id}` })
  await clock.advance(20_000)
  errore = true
  await clock.advance(20_000)
  errore = false
  await clock.advance(20_000)
  expect(amb.toast.filter(t => t.includes('si è fermata')).length).toBe(1)
  await ui.unmount()
})

test('progetto della sessione ignoto: nessun avvio', () => {
  const a = base('a-pr000001', 1, { repo: 'o/r' })
  expect(violazioniAvvio(a, R, [a], { io: 'm', repo: null, modello: 'claude-opus-5-5', effort: 'high', permessi: 'auto' }).map(m => m.k).join()).toContain('v.progettoIgnoto')
})

test('giro: «Aggiorna» insieme al timer non avvisa due volte', async ($, on) => {
  const amb = ambiente(on, {
    mcp: (_s, tool, args) =>
      tool === 'get_session' && (args as { session_id?: unknown }).session_id !== 'self'
        ? { isError: false, content: [{ type: 'text', text: JSON.stringify({ isRunning: false, branch: 'claude/y' }) }] }
        : undefined,
  })
  const clock = mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'Docs', brief: 'Aggiorna il README.' } as never)
  const id = amb.azione()[0]!.id
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: `avvia-${id}` })
  await Promise.all([ui.press({ key: 'ricarica' }), clock.advance(20_000)])
  expect(amb.toast.filter(t => t.includes('si è fermata')).length).toBe(1)
  await ui.unmount()
})

test('A/B/C: collegamenti persistiti in cartella condivisa non chiudono A e C resta in coda', async ($, on) => {
  const amb = ambiente(on, {
    mcp: (_s, tool, args) =>
      tool === 'get_session' && (args as { session_id?: unknown }).session_id !== 'self'
        ? { isError: false, content: [{ type: 'text', text: JSON.stringify({ isRunning: true, branch: 'main' }) }] }
        : undefined,
  })
  const clock = mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  for (const t of ['A', 'B']) await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: t, brief: 'Lavoro.', issue: 42 } as never)
  const [A, B] = amb.azione().sort((x, y) => x.ordine - y.ordine)
  await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'C', brief: 'Dopo A.', dipende: [A!.id] } as never)
  const comune = { stato: 'avviata', sessione: SID, worktree: false, taskId: 'b', ramoSessione: 'main', tentativo: 'az-x', avviataIl: '2026-11-05T10:00:00Z' }
  amb.disco.set(`X:/orch/azioni/${A!.id}.json`, JSON.stringify({ ...A, ...comune }))
  amb.disco.set(`X:/orch/azioni/${B!.id}.json`, JSON.stringify({ ...B, ...comune }))
  const C = amb.azione().find(a => a.titolo === 'C')!
  amb.disco.set(`X:/orch/azioni/${C.id}.json`, JSON.stringify({ ...C, stato: 'accodata', motivoCoda: 'aspetta che le dipendenze siano fuse' }))
  amb.disco.set('X:/orch/registro.json', JSON.stringify({ task: { b: { issue: 42, ramo: 'main', stato: 'fuso', creato: '2026-11-05T10:05:00Z' } } }))
  await clock.advance(20_000)
  const dopo = amb.azione()
  expect(dopo.find(a => a.id === A!.id)!.stato).toBe('avviata')
  expect(dopo.find(a => a.id === B!.id)!.stato).toBe('avviata')
  expect(dopo.find(a => a.id === C.id)!.stato).toBe('accodata')
  expect(amb.chiamate.filter(c => c.tool === 'start_session').length).toBe(0)
})

test('elenco incompleto: con un record illeggibile nessun avvio automatico né chiusura', async ($, on) => {
  const amb = ambiente(on)
  const clock = mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'B', brief: 'Lavoro.' } as never)
  const B = amb.azione()[0]!
  // Un record che c'è ma non si legge (scrittura a metà).
  amb.disco.set('X:/orch/azioni/a-rotta0001.json', '{"id":"a-rotta0001","stato":')
  amb.disco.set(`X:/orch/azioni/${B.id}.json`, JSON.stringify({ ...B, stato: 'accodata', motivoCoda: 'limite di 3 sessioni in parallelo' }))
  await clock.advance(20_000)
  expect(amb.chiamate.filter(c => c.tool === 'start_session').length).toBe(0)
  const ui = await $.ui.mount({ ...PANE('desktop') })
  expect(await ui.find({ type: 'Text', text: /a-rotta0001\.json/ })).toBeDefined()
  // Ripristinato il record, il giro riprende a decidere.
  amb.disco.delete('X:/orch/azioni/a-rotta0001.json')
  await clock.advance(20_000)
  expect(amb.chiamate.filter(c => c.tool === 'start_session').length).toBe(1)
  await ui.unmount()
})

test('fork accodato: riparte solo dalla sessione la cui conversazione va copiata', () => {
  const chiA: Chiamante = { io: 'master-A', repo: 'o/r', modello: 'claude-opus-5-5', effort: 'high', permessi: 'auto' }
  const chiB: Chiamante = { ...chiA, io: 'master-B' }
  const q = base('a-fk000001', 1, { repo: 'o/r', contesto: 'fork', stato: 'accodata', origineFork: 'master-A', modello: 'claude-opus-5-5' })
  expect(violazioniAvvio(q, R, [q], chiB).map(m => m.k).join()).toContain('v.forkAltrui')
  expect(violazioniAvvio(q, R, [q], chiA).map(m => m.k).join()).not.toContain('v.forkAltrui')
})

test('elenco incompleto: nessuna chiusura automatica (A/B con task duplicato, B illeggibile, C dipende da A)', async ($, on) => {
  const amb = ambiente(on, {
    mcp: (_s, tool, args) =>
      tool === 'get_session' && (args as { session_id?: unknown }).session_id !== 'self'
        ? { isError: false, content: [{ type: 'text', text: JSON.stringify({ isRunning: true, branch: 'claude/a' }) }] }
        : undefined,
  })
  const clock = mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  for (const t of ['A', 'B']) await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: t, brief: 'Lavoro.', issue: 42 } as never)
  const [A, B] = amb.azione().sort((x, y) => x.ordine - y.ordine)
  await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'C', brief: 'Dopo A.', dipende: [A!.id] } as never)
  const C = amb.azione().find(a => a.titolo === 'C')!
  const avviata = { stato: 'avviata', sessione: SID, taskId: 'b', ramoSessione: 'claude/a', tentativo: 'az-x', avviataIl: '2026-11-05T10:00:00Z' }
  amb.disco.set(`X:/orch/azioni/${A!.id}.json`, JSON.stringify({ ...A, ...avviata }))
  // B ha lo stesso task (duplicato) ma è illeggibile: senza B il duplicato non si vedrebbe.
  amb.disco.set(`X:/orch/azioni/${B!.id}.json`, '{"troncato":')
  amb.disco.set(`X:/orch/azioni/${C.id}.json`, JSON.stringify({ ...C, stato: 'accodata', motivoCoda: 'aspetta che le dipendenze siano fuse' }))
  amb.disco.set('X:/orch/registro.json', JSON.stringify({ task: { b: { issue: 42, ramo: 'claude/a', stato: 'fuso', creato: '2026-11-05T10:05:00Z' } } }))
  await clock.advance(20_000)
  expect(amb.azione().find(a => a.id === A!.id)!.stato).toBe('avviata')
  expect(amb.azione().find(a => a.id === C.id)!.stato).toBe('accodata')
  expect(amb.chiamate.filter(c => c.tool === 'start_session').length).toBe(0)
})

test('fork scelto dall\'editor su un\'azione in coda: registra l\'origine; senza origine non riparte da solo', async ($, on) => {
  const amb = ambiente(on)
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'Q', brief: 'Lavoro.' } as never)
  const Q = amb.azione()[0]!
  amb.disco.set(`X:/orch/azioni/${Q.id}.json`, JSON.stringify({ ...Q, stato: 'accodata', motivoCoda: 'limite di 3 sessioni in parallelo' }))
  // Ricarica l'elenco senza un giro (che farebbe ripartire la coda): un aggiornamento rifiutato rilegge il disco.
  await $.tool.call({ tool: 'mcp__chip-manager__aggiorna_azione', id: Q.id, stato: 'consegnata', tentativo: 'az-no' } as never)
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: `mod-${Q.id}` })
  await ui.select({ key: `ctx-${Q.id}`, value: 'fork' })
  expect(amb.azione()[0]).toMatchObject({ contesto: 'fork', origineFork: 'sessione-master' })
  await ui.unmount()
  // Un fork in coda senza origine (scritto altrove) è bloccato per tutti.
  const senza = base('a-fk000002', 1, { repo: 'o/r', contesto: 'fork', stato: 'accodata' })
  const chi: Chiamante = { io: 'x', repo: 'o/r', modello: 'claude-opus-5-5', effort: 'high', permessi: 'auto' }
  expect(violazioniAvvio(senza, R, [senza], chi).map(m => m.k).join()).toContain('v.forkSenzaOrigine')
})

test('configurazione locale: assente = generica; sezione del progetto; forme non valide = motivo', () => {
  expect(progettoDa(null, 'acme/progetto')).toMatchObject({ routing: '.claude/routing.json', sensibili: [] })
  expect(progettoDa({ progetti: {} }, 'acme/progetto')).toMatchObject({ routing: '.claude/routing.json' })
  const cfg = { progetti: { 'acme/progetto': { routing: 'cfg/routing.json', sensibili: ['magazzino'], background: 'Progetto Acme.' } } }
  expect(progettoDa(cfg, 'acme/progetto')).toMatchObject({ routing: 'cfg/routing.json', sensibili: ['magazzino'], background: 'Progetto Acme.' })
  expect(progettoDa(cfg, 'altro/repo')).toMatchObject({ sensibili: [] })
  for (const rotta of [[], { progetti: [] }, { progetti: { 'acme/progetto': 'x' } }]) expect(progettoDa(rotta, 'acme/progetto')).toHaveProperty('k')
  for (const routing of ['/etc/x.json', 'C:/x.json', '../fuori.json', 'a/../../b.json', ''])
    expect(progettoDa({ progetti: { 'acme/progetto': { routing } } }, 'acme/progetto')).toEqual({ k: 'cfg.routing' })
  expect(progettoDa({ progetti: { 'acme/progetto': { sensibili: ['(rotta'] } } }, 'acme/progetto')).toMatchObject({ k: 'cfg.termine' })
  expect(progettoDa({ progetti: { 'acme/progetto': { sensibili: 'x' } } }, 'acme/progetto')).toEqual({ k: 'cfg.sensibili' })
})

test('configurazione nel pannello: routing e termini del progetto valgono; una rotta blocca ogni avvio', async ($, on) => {
  const amb = ambiente(on)
  mock.clock(on)
  amb.disco.delete('X:/repo/.claude/routing.json')
  amb.disco.set('X:/repo/cfg/routing.json', JSON.stringify(ROUTING))
  const cfg = { progetti: { 'acme/progetto': { routing: 'cfg/routing.json', sensibili: ['gestione[ _-]?magazzino'] } } }
  amb.disco.set('X:/casa/.claude/chipmanager/config.json', JSON.stringify(cfg))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'Docs', brief: 'Aggiorna il README.' } as never)
  await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'Gestione magazzino', brief: 'x', esecutore: 'codex', corsia: 'R2', revisore: 'claude' } as never)
  const [docs, mag] = ['Docs', 'Gestione magazzino'].map(t => amb.azione().find(a => a.titolo === t)!)
  const ui = await $.ui.mount({ ...PANE('desktop') })
  // Il termine del progetto rende sensibile l'azione: Codex non può esserne l'autore.
  expect(await ui.find({ type: 'Text', text: /R4 sensibile/ })).toBeDefined()
  await ui.press({ key: `avvia-${mag!.id}` }).catch(() => undefined)
  expect(amb.chiamate.filter(c => c.tool === 'start_session').length).toBe(0)
  // Configurazione rotta: nemmeno l'azione innocua parte.
  amb.disco.set('X:/casa/.claude/chipmanager/config.json', '{"progetti":')
  await ui.press({ key: `avvia-${docs!.id}` })
  expect(amb.chiamate.filter(c => c.tool === 'start_session').length).toBe(0)
  expect(await ui.find({ type: 'Text', text: /non letto \(config\.json/ })).toBeDefined()
  // Configurazione sana e pannello riletto: parte.
  amb.disco.set('X:/casa/.claude/chipmanager/config.json', JSON.stringify(cfg))
  await ui.press({ key: 'ricarica' })
  await ui.press({ key: `avvia-${docs!.id}` })
  expect(amb.chiamate.filter(c => c.tool === 'start_session').length).toBe(1)
  await ui.unmount()
})

const FREE_ROUTING = { ...ROUTING, freellmapi: { modelli: ['testo-compatto'] }, revisione: { revisori_ammessi_per_autore: { ...ROUTING.revisione.revisori_ammessi_per_autore, 'testo-compatto': ['claude-opus-5-5'] } } }
const RF = { ...regoleDa(FREE_ROUTING, 'test'), risorse: { ...RISORSE_DEFAULT, fornitori: ['claude', 'codex', 'freellmapi'] as ('claude' | 'codex' | 'freellmapi')[], freellmapi: { ...RISORSE_DEFAULT.freellmapi, livello: 'R1' as const } } }
const AUTORE: Chiamante = { io: 'master', repo: 'acme/progetto', modello: 'claude-opus-5-5', effort: 'high', permessi: 'auto', lanciatore: 'desktop' }
const LIMITE: Limite = { id: 'claude', fornitore: 'claude', nome: 'piano', percentuale: 80, fonte: 'prova', letto: new Date().toISOString() }

test('2.0: politica default, opt-in isolato per progetto e configurazione fail-closed', () => {
  expect(progettoDa(null, 'acme/progetto')).toMatchObject({ risorse: { fornitori: ['claude', 'codex'], soloLocale: false, pesi: [] } })
  for (const p of [{ fornitori: ['inventato'] }, { soloLocale: 'si' }, { pesi: [{ tipo: 'effort', nome: 'low', percentuale: Infinity, assoluto: 1 }] }, { freellmapi: { livello: 'R5' } }, { freellmapi: { livello: 'R1', endpoint: 'http://example.org/v1' } }, { freellmapi: { livello: 'R1', endpoint: 'http://localhost:3001/v1?segreto=x' } }])
    expect(progettoDa({ progetti: { 'acme/progetto': p } }, 'acme/progetto')).toHaveProperty('k')
  const config = { progetti: { 'altro/repo': { fornitori: ['freellmapi'] } } }
  expect(progettoDa(config, 'acme/progetto')).toMatchObject({ risorse: { fornitori: ['claude', 'codex'] } })
})

// F13a↔F13b (master's constraint 2): `compatibile` inherits every FreeLLMAPI guard, so this test runs on both executors.
const TERZI = [
  {
    nome: 'freellmapi',
    a: base('a-free0001', 1, { repo: AUTORE.repo!, esecutore: 'freellmapi', revisore: 'claude', modello: 'testo-compatto', effort: 'low', corsia: 'R1' }),
    r: () => RF, spento: () => ({ ...RF, risorse: RISORSE_DEFAULT }),
    r2: () => ({ ...RF, risorse: { ...RF.risorse, freellmapi: { ...RF.risorse.freellmapi, livello: 'R2' as const } } }),
  },
  {
    nome: 'compatibile',
    a: base('a-cmpter01', 1, { repo: AUTORE.repo!, esecutore: 'compatibile', provider: 'ollama', revisore: 'claude', modello: 'qwen3:8b', effort: 'low', corsia: 'R1' }),
    r: (): Regole => ({ ...R, compatibiliConnessi: ['ollama'], risorse: { ...R.risorse, compatibili: { ollama: 'R1' } } }),
    spento: (): Regole => ({ ...R, compatibiliConnessi: ['ollama'], risorse: { ...R.risorse, compatibili: {} } }),
    r2: (): Regole => ({ ...R, compatibiliConnessi: ['ollama'], risorse: { ...R.risorse, compatibili: { ollama: 'R2' } } }),
  },
]
for (const caso of TERZI) test(`2.0/F13.3b (${caso.nome}): terzi vietati su R3–R5 e su testo sensibile, dati locali e oltre il livello; revisore Claude obbligatorio`, () => {
  const { a } = caso
  const RF = caso.r()
  expect(violazioni(a, RF)).toEqual([])
  expect(violazioni(a, caso.spento()).map(m => m.k).join()).toContain('v.fornitoreNonAbilitato')
  for (const corsia of ['R2', 'R3', 'R4', 'R5'] as const) expect(violazioni({ ...a, corsia }, RF).length).toBeGreaterThan(0)
  expect(violazioni({ ...a, corsia: 'R2' }, caso.r2())).toEqual([])
  expect(violazioni({ ...a, corsia: 'R3' }, caso.r2()).map(m => m.k)).toContain('v.freeCorsia')
  // Testo sensibile su una corsia ammessa: diventa R4 e si ferma (autore Claude, corsia fuori livello).
  for (const brief of ['Rivedi il login.', 'Cambia la password.', 'Gestisci i permessi.'])
    expect(violazioni({ ...a, brief }, RF).map(m => m.k)).toEqual(expect.arrayContaining(['v.r4Autore', 'v.freeCorsia']))
  // Il revisore dell'altro motore è obbligatorio: Claude, mai Codex o nessuno.
  for (const revisore of ['codex', 'nessuno'] as const) expect(violazioni({ ...a, revisore }, RF).map(m => m.k)).toContain('v.freeRevisione')
  for (const brief of ['RSSMRA80A01H501U', 'nome@example.org', '10.2.3.4', 'storage/x', 'leggi .env'])
    expect(violazioni({ ...a, brief }, RF).map(m => m.k).join()).toContain('v.datiLan')
  expect(violazioni({ ...a, brief: 'x'.repeat(1600) }, RF).map(m => m.k)).toContain('v.freeTesto')
  expect(violazioni({ ...a, background: 'Leggi .env' }, RF).length).toBeGreaterThan(0)
  expect(violazioni(a, { ...RF, background: 'Leggi .env' }).length).toBeGreaterThan(0)
})

test('2.0: terzi, revisore R4 e fornitore del revisore non abilitato', () => {
  expect(violazioni(base('a-r400001', 1, { corsia: 'R4' }), R).map(m => m.k).join()).toContain('v.r4Revisore')
  expect(violazioni(base('a-norev01', 1), { ...R, risorse: { ...RISORSE_DEFAULT, fornitori: ['claude'] } }).map(m => m.k).join()).toContain('v.revisoreNonAbilitato')
})

test('F10 rilievo 7 (decisione della master): un fornitore ammesso ma non connesso non entra nelle scelte automatiche e una scelta esplicita non parte; Claude e Codex sempre connessi', () => {
  const a = base('a-free0002', 1, { repo: AUTORE.repo!, esecutore: 'freellmapi', revisore: 'claude', modello: 'testo-compatto', effort: 'low', corsia: 'R1' })
  // Scelta esplicita su FreeLLMAPI senza la sua chiave: si blocca con il motivo; con la chiave parte come prima.
  expect(violazioni(a, { ...RF, connessi: ['claude', 'codex'] }).map(m => m.k)).toContain('v.nonConnesso')
  expect(violazioni(a, { ...RF, connessi: ['claude', 'codex', 'freellmapi'] })).toEqual([])
  // Claude e Codex: nessun cambiamento, nemmeno con un elenco vuoto (il loro login non si verifica).
  for (const esecutore of ['claude', 'codex'] as const) {
    const c = base(`a-con${esecutore}`, 1, { repo: AUTORE.repo!, esecutore, corsia: 'R2' })
    expect(violazioni(c, { ...RF, connessi: [] })).toEqual(violazioni(c, RF))
  }
  // Le scelte automatiche: con un peso che preferisce FreeLLMAPI, senza chiave non lo sceglie mai.
  const aperta = base('a-free0003', 1, { repo: AUTORE.repo!, corsia: 'R1', revisore: 'claude' })
  const pesata = { ...RF, risorse: { ...RF.risorse, pesi: [{ tipo: 'fornitore' as const, nome: 'freellmapi', percentuale: 1000, assoluto: 1000 }] } }
  const senza = bilancia(aperta, {}, { ...pesata, connessi: ['claude', 'codex'] }, [], [aperta], AUTORE)
  expect(senza.esecutore).not.toBe('freellmapi')
  expect(violazioni(senza, { ...pesata, connessi: ['claude', 'codex'] }).map(m => m.k)).not.toContain('v.nonConnesso')
})

test('2.0: pesi e margini scelgono soltanto combinazioni ammesse; scelte esplicite intatte', () => {
  const a = base('a-peso0001', 1, { repo: AUTORE.repo!, corsia: 'R2' })
  const r = { ...R, risorse: { ...RISORSE_DEFAULT, pesi: [{ tipo: 'modello' as const, nome: 'gpt-6-astra', percentuale: 300, assoluto: 50 }, { tipo: 'effort' as const, nome: 'low', percentuale: 100, assoluto: 50 }] } }
  const b = bilancia(a, {}, r, [], [a], AUTORE)
  expect(b).toMatchObject({ esecutore: 'codex', modello: 'gpt-6-astra', effort: 'xhigh', revisore: 'claude' })
  expect(violazioniAvvio(b, r, [a], AUTORE)).toEqual([])
  expect(bilancia({ ...a, titolo: 'Fix login' }, {}, r, [], [a], AUTORE).esecutore).toBe('claude')
  expect(bilancia(a, { esecutore: 'claude', modello: 'claude-opus-5-5', effort: 'high' }, r, [], [a], AUTORE)).toMatchObject({ esecutore: 'claude', modello: 'claude-opus-5-5', effort: 'high' })
  const quasi = { ...LIMITE, percentuale: 99 }
  expect(punteggio(a, R, [quasi], [])).toBeLessThan(punteggio(a, R, [], []))
  expect(bilancia(a, {}, R, [quasi], [a], AUTORE).esecutore).toBe('codex')
})

test('2.0: il massivo cambia priorità senza saltare dipendenze o corsia Codex', () => {
  const a = base('a-prio0001', 1)
  const b = base('a-prio0002', 2, { esecutore: 'codex', revisore: 'claude', corsia: 'R2' })
  const c = { ...b, id: 'a-prio0003', ordine: 3 }
  const r = { ...R, risorse: { ...RISORSE_DEFAULT, pesi: [{ tipo: 'fornitore' as const, nome: 'codex', percentuale: 100, assoluto: 0 }] } }
  expect(pianifica([a, b, c], [a, b, c], r, 1).avvia[0]!.id).toBe(b.id)
  expect(pianifica([a, b], [a, { ...b, dipende: [a.id] }], r, 1).avvia[0]!.id).toBe(a.id)
  expect(pianifica([a, b], [a, b], r, 1, true).avvia[0]!.id).toBe(a.id)
  // Senza pesi l'ordine dell'utente vale anche se il modello della prima è già occupato.
  const occupata = base('a-prio0004', 9, { stato: 'avviata' })
  expect(pianifica([a, b], [occupata, a, b], R, 2).avvia[0]!.id).toBe(a.id)
})

test('2.0: fonti sconosciute, vecchie, future e manuali non fingono margini freschi', () => {
  expect(usoDesktop('week 70%', new Date().toISOString())).toEqual([])
  expect(usoDesktop({ five_hour: { utilization: 170 } }, new Date().toISOString())).toEqual([])
  expect(usoDesktop({ five_hour: { utilization: 70 } }, new Date().toISOString())[0]).toMatchObject({ percentuale: 70, fonte: 'ccd_session_mgmt.get_usage' })
  const letto = new Date().toISOString()
  const piano = (p: Record<string, unknown>) => ({ plan: { status: 'ok', plan: 'Esempio', ...p }, context: { tokensUsed: 1 } })
  const finestre = usoDesktop(piano({
    windows: [
      { label: 'Weekly · all models', percentUsed: 12, resetsAt: '2999-01-01T00:00:00Z', resetsIn: '3d' },
      { label: 'Weekly · Modello', percentUsed: 3, resetsAt: '2999-01-01T00:00:00Z' },
      { label: 'Weekly · all models', percentUsed: 99 },
      { label: 'Fuori scala', percentUsed: 140 },
      { label: 'x\u0000y', percentUsed: 5 },
    ],
    extraUsage: { enabled: true, percentUsed: 25, spent: '1.00', monthlyLimit: '4.00', currency: 'EUR' },
  }), letto)
  expect(finestre.map(l => l.id)).toEqual(['claude-weekly-all-models', 'claude-weekly-modello', 'claude-extra'])
  expect(finestre[0]).toMatchObject({ fornitore: 'claude', nome: 'Claude piano · Weekly · all models', percentuale: 12, reset: '2999-01-01T00:00:00Z', fonte: 'ccd_session_mgmt.get_usage' })
  // Rilievo 6: l'uso extra è un credito, in soldi: importo e tetto nella loro valuta, mai una percentuale.
  expect(finestre[2]).toMatchObject({ nome: 'Claude uso extra', valore: 1, tetto: 4, unita: 'EUR' })
  expect(finestre[2]).not.toHaveProperty('percentuale')
  expect(usoDesktop(piano({ windows: [], extraUsage: { enabled: true, percentUsed: 25, monthlyLimit: '4.00', currency: 'EUR' } }), letto)).toEqual([])
  expect(limiteFresco(finestre[0]!)).toBe(true)
  expect(usoDesktop(piano({ windows: [], extraUsage: { enabled: false, percentUsed: 0 } }), letto)).toEqual([])
  expect(usoDesktop({ plan: { status: 'not_applicable' } }, letto)[0]).toMatchObject({ id: 'claude', errore: 'lim.pianoNonApplicabile' })
  const nonLeggibile = usoDesktop({ plan: { status: 'unavailable', note: 'riprova tra poco' } }, letto)[0]!.errore
  expect(nonLeggibile).toBe('lim.pianoNonLeggibile: riprova tra poco')
  // Il codice si traduce, la nota dell'app resta com'è; un testo che non è un codice si mostra intero.
  expect(chiaveOTesto('it', nonLeggibile)).toBe('limiti di piano non leggibili ora: riprova tra poco')
  expect(chiaveOTesto('en', nonLeggibile)).toBe('plan limits cannot be read now: riprova tra poco')
  expect(chiaveOTesto('en', 'HTTP 502: gateway')).toBe('HTTP 502: gateway')
  expect(() => risorseLette({ limiti: [...finestre, ...usoDesktop({ plan: { status: 'unavailable' } }, letto)], proxy: 'x', chiavi: { anthropic: false, deepseek: false, freellmapi: false } })).not.toThrow()
  const vecchio = { ...LIMITE, letto: '2000-01-01T00:00:00Z' }
  expect(limiteFresco(vecchio)).toBe(false)
  expect(limiteFresco({ ...LIMITE, letto: '2999-01-01T00:00:00Z' })).toBe(false)
  expect(coloreLimite(vecchio)).toBe('#808080')
  // F9.2: la tinta del critico è stata ritoccata (regge 3:1 anche sul proprio velo); il gettone resta STATO.errore.
  expect(coloreLimite({ ...LIMITE, percentuale: 95 })).toBe(STATO.errore)
  expect(punteggio(base('a-margin01', 1), R, [vecchio], [])).toBe(punteggio(base('a-margin01', 1), R, [], []))
  expect(punteggio(base('a-margin01', 1), R, [{ ...LIMITE, manuale: true }], [])).toBe(punteggio(base('a-margin01', 1), R, [], []))
})

function conferme(on: Parameters<TestBody>[1], risposta: (testo: string) => string) {
  on('tool.call', { tool: 'AskUserQuestion' }, (_, e) => ({ result: { questions: e.questions, answers: Object.fromEntries(e.questions.map(q => [q.question, risposta(q.question)])) } }))
}
function configuraFree(amb: ReturnType<typeof ambiente>) {
  amb.disco.set('X:/repo/.claude/routing.json', JSON.stringify(FREE_ROUTING))
  amb.disco.set('X:/casa/.claude/chipmanager/config.json', JSON.stringify({ progetti: { 'acme/progetto': { fornitori: ['claude', 'codex', 'freellmapi'], freellmapi: { livello: 'R1' } } } }))
}

test('2.0: le fonti proiettano il contratto e rifiutano numeri, tempi o forme non interpretabili', () => {
  const dato = { limiti: [{ ...LIMITE, extra: 'non esporre' }], proxy: 'non abilitato', chiavi: { anthropic: false, deepseek: false, freellmapi: false, extra: 'non esporre' }, extra: 'non esporre' }
  expect(JSON.stringify(risorseLette(dato))).not.toContain('non esporre')
  for (const rotto of [null, [], {}, { ...dato, chiavi: {} }, { ...dato, limiti: [LIMITE, LIMITE] },
    ...[{ percentuale: 101 }, { valore: NaN }, { letto: 'ieri' }, { letto: undefined }, { nome: {} }, { fornitore: 'altro' }].map(p => ({ ...dato, limiti: [{ ...LIMITE, ...p }] }))])
    expect(() => risorseLette(rotto)).toThrow()
  const finestra = usoDesktop({ five_hour: { utilization: 70, resets_at: '2000-01-01T00:00:00Z' } }, LIMITE.letto!)[0]!
  expect(limiteFresco(finestra)).toBe(false)
})

test('2.1.1: limiti Claude dal formato attuale di get_usage; nessuna azione di altri progetti o senza progetto', async ($, on) => {
  const piano = { plan: { status: 'ok', plan: 'Esempio', windows: [{ label: 'Weekly · all models', percentUsed: 37, resetsAt: '2999-01-01T00:00:00Z', resetsIn: '5d' }],
    extraUsage: { enabled: false, percentUsed: 0, spent: '0.00', monthlyLimit: '10.00', currency: 'EUR' } } }
  const amb = ambiente(on, { strumenti: ['mcp__ccd_session_mgmt__get_usage'],
    mcp: (_s, tool) => (tool === 'get_usage' ? { isError: false, content: [{ type: 'text', text: JSON.stringify(piano) }] } : undefined) })
  mock.clock(on)
  amb.disco.set('X:/orch/azioni/a-vecchia01.json', JSON.stringify({ ...base('a-vecchia01', 1, { titolo: 'Senza progetto' }), repo: undefined }))
  amb.disco.set('X:/orch/azioni/a-altrorp1.json', JSON.stringify(base('a-altrorp1', 2, { titolo: 'Di un altro progetto', repo: 'altro/progetto' })))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'Del progetto', brief: 'Frase.' } as never)
  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await $.ui.mount({ ...PANE(surface) })
    // La riga di sintesi riporta il margine; il dettaglio dei limiti sta nella vista Carico.
    expect(await ui.find({ type: 'Text', text: /Claude 37%/ })).toBeDefined()
    await ui.press({ key: 'vista-carico' })
    expect(await ui.find({ type: 'Text', text: /Claude piano · Weekly · all models: 37% usato/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Claude piano: non disponibile/ })).toBeUndefined()
    await ui.press({ key: 'vista-lavoro' })
    expect(await ui.find({ type: 'Text', text: /Del progetto/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Senza progetto|Di un altro progetto/ })).toBeUndefined()
    await ui.unmount()
  }
})

test('2.0: helper con schema ignoto lascia il pannello disponibile senza inventare limiti', async ($, on) => {
  ambiente(on, { fonte: () => ({ limiti: 'formato cambiato' }) })
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('terminal') })
  await ui.press({ key: 'vista-carico' })
  expect(await ui.find({ type: 'Text', text: /^Limiti non letti: helper non disponibile$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^Nessun limite collegato · vai a Impostazioni$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /non disponibile ·|FreeLLMAPI/ })).toBeUndefined()
  await ui.unmount()
})

test('2.0: limiti sempre visibili e impostazioni modificabili su desktop e terminale', async ($, on) => {
  const amb = ambiente(on)
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await $.ui.mount({ ...PANE(surface) })
    await ui.press({ key: 'vista-carico' })
    // F9.4: intestazione in maiuscolo sul desktop.
    expect(await ui.find({ type: 'Text', text: /^Limiti e budget$/i })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^Nessun limite collegato · vai a Impostazioni$/ })).toBeDefined()
    await ui.press({ key: 'impostazioni' })
    // C2: le regolazioni sono a cinque posizioni, dietro «Regola a mano» (che resta aperto fra un montaggio e l'altro).
    await ui.press({ key: 'sezione-bilanciamento-premi' })
    if (!(await ui.find({ key: 'peso-fornitore-codex' }))) await ui.press({ key: 'regola-a-mano' })
    await ui.press({ key: 'peso-fornitore-codex-piu' })
    await ui.press({ key: 'applica' })
    const progetto = JSON.parse(amb.disco.get('X:/casa/.claude/chipmanager/config.json')!).progetti['acme/progetto']
    expect(progetto.pesi[0]).toMatchObject({ nome: 'codex', percentuale: surface === 'desktop' ? 40 : 100, assoluto: 0 })
    expect(progetto.profilo).toBe('personalizzato')
    await ui.press({ key: 'vista-lavoro' })
    await ui.unmount()
  }
})

test('2.0: CLI usa una sola prenotazione, stesso mandato e consegna non equivale a fusione', async ($, on) => {
  const amb = ambiente(on, { cli: true })
  const clock = mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'Docs CLI', brief: 'Scrivi documentazione.' } as never)
  const id = amb.azione()[0]!.id
  const u1 = await $.ui.mount({ ...PANE('terminal') })
  const u2 = await $.ui.mount({ ...PANE('desktop') })
  await Promise.all([u1.press({ key: `avvia-${id}` }), u2.press({ key: `avvia-${id}` })].map(p => p.catch(() => {})))
  expect(amb.processi.filter(p => p.argv[2] === 'lancia-cli').length).toBe(1)
  expect(amb.chiamate.filter(c => c.tool === 'start_session').length).toBe(0)
  const a = amb.azione()[0]!
  expect(a).toMatchObject({ stato: 'avviata', lanciatore: 'cli' })
  expect(amb.processi.find(p => p.argv[2] === 'lancia-cli')!.stdin).toContain('corsia-codex --revisione')
  amb.disco.set(`X:/orch/azioni/esecuzioni/${a.tentativo}.json`, JSON.stringify({ id, tentativo: a.tentativo, stato: 'consegnata', ramo: `chipmanager/${a.tentativo}` }))
  await clock.advance(20_000)
  expect(amb.azione()[0]!.stato).toBe('consegnata')
  // R9: lo stato dell'esecuzione si legge con $.fs, senza avviare un processo.
  expect(amb.processi.filter(p => p.argv[2] === 'stato-cli')).toEqual([])
  expect(amb.letti).toContain(`X:/orch/azioni/esecuzioni/${a.tentativo}.json`)
  // Un esito incerto salvato come codice, poi l'esito vero dell'helper: frase, codice e parametri cambiano insieme.
  amb.disco.set(`X:/orch/azioni/${id}.json`, JSON.stringify({ ...amb.azione()[0], stato: 'avviata', erroreCodice: 'rec.esitoCli', errore: 'Uncertain outcome: check the process or the dashboard before cancelling' }))
  amb.disco.set(`X:/orch/azioni/esecuzioni/${a.tentativo}.json`, JSON.stringify({ id, tentativo: a.tentativo, stato: 'fallita', errore: 'spawn codex ENOENT' }))
  await clock.advance(20_000)
  expect(amb.azione()[0]).toMatchObject({ stato: 'fallita', errore: 'spawn codex ENOENT' })
  expect(amb.azione()[0]!.erroreCodice).toBeUndefined()
  expect(await u1.find({ type: 'Text', text: /spawn codex ENOENT/ })).toBeDefined()
  await u1.unmount(); await u2.unmount()
})

test('2.0: CLI rifiuta fork, cloud, bypass e cartella condivisa; record di altro tentativo ignorato', () => {
  const a = base('a-cli00001', 1, { repo: AUTORE.repo! })
  const chi = { ...AUTORE, modello: '', effort: undefined, lanciatore: 'cli' as const }
  expect(violazioniAvvio(a, R, [a], chi)).toEqual([])
  for (const patch of [{ contesto: 'fork' as const }, { destinazione: 'cloud' as const }, { worktree: false }, { permessi: 'bypassPermissions' as const }])
    expect(violazioniAvvio({ ...a, ...patch }, R, [a], chi).length).toBeGreaterThan(0)
  expect(normalizza({ ...a, stato: 'avviata', lanciatore: 'cli', tentativo: 'az-123456' })).toMatchObject({ stato: 'avviata' })
})

test('2.0: FreeLLMAPI conferma il testo, nessun background inviato, risultato solo consegnato', { options: { freellmapiKey: 'fl-prova-0123456789' } }, async ($, on) => {
  const amb = ambiente(on)
  configuraFree(amb)
  mock.clock(on)
  conferme(on, testo => { expect(testo).toContain('Trasforma questa frase.'); return 'Invia testo' })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'Bozza', brief: 'Trasforma questa frase.', background: 'Contesto da non inviare.', esecutore: 'freellmapi', corsia: 'R1', modello: 'testo-compatto', effort: 'low', revisore: 'claude' } as never)
  const id = amb.azione()[0]!.id
  const ui = await $.ui.mount({ ...PANE('terminal') })
  await ui.press({ key: `avvia-${id}` })
  expect(amb.azione()[0]).toMatchObject({ stato: 'consegnata', risultato: 'Bozza pronta.', lanciatore: 'freellmapi' })
  const post = amb.processi.find(p => p.argv[2] === 'completa')!
  expect(JSON.parse(post.stdin!).testo).toBe('Bozza\n\nTrasforma questa frase.')
  expect(post.stdin).not.toContain('Contesto da non inviare.')
  expect(amb.chiamate.filter(c => c.tool === 'start_session').length).toBe(0)
  await ui.unmount()
})

test('2.0: modifica durante la conferma e revoca progetto bloccano FreeLLMAPI', { options: { freellmapiKey: 'fl-prova-0123456789' } }, async ($, on) => {
  const amb = ambiente(on)
  configuraFree(amb)
  mock.clock(on)
  conferme(on, () => {
    const a = amb.azione()[0]!
    amb.disco.set(`X:/orch/azioni/${a.id}.json`, JSON.stringify({ ...a, versione: a.versione + 1, brief: 'Testo diverso.' }))
    return 'Invia testo'
  })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'Bozza', brief: 'Frase.', esecutore: 'freellmapi', corsia: 'R1', effort: 'low', revisore: 'claude' } as never)
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: `avvia-${amb.azione()[0]!.id}` })
  expect(amb.processi.filter(p => p.argv[2] === 'completa').length).toBe(0)
  expect(amb.azione()[0]!.stato).toBe('proposta')
  await ui.unmount()
})

test('2.0: installazione Docker solo dopo conferma del comando completo fissato', async ($, on) => {
  const amb = ambiente(on)
  configuraFree(amb)
  mock.clock(on)
  let conferma = false
  conferme(on, testo => { expect(testo).toContain(INSTALLAZIONE[0].join(' ')); return conferma ? 'Esegui comando' : 'Annulla' })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('terminal') })
  await ui.press({ key: 'impostazioni' })
  await ui.press({ key: 'sezione-avanzate-premi' })
  await ui.press({ key: 'installa-0' })
  expect(amb.processi.filter(p => p.argv[0] === 'docker').length).toBe(0)
  conferma = true
  await ui.press({ key: 'installa-0' })
  expect(amb.processi.filter(p => p.argv[0] === 'docker').map(p => p.argv)).toEqual([INSTALLAZIONE[0]])
  await ui.unmount()
})

test('2.0: solo rete locale blocca tutti gli avvii e nessuna sonda remota viene chiesta al desktop', async ($, on) => {
  const amb = ambiente(on)
  mock.clock(on)
  amb.disco.set('X:/casa/.claude/chipmanager/config.json', JSON.stringify({ progetti: { 'acme/progetto': { soloLocale: true } } }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'Docs', brief: 'Frase.' } as never)
  const ui = await $.ui.mount({ ...PANE('desktop') })
  expect(await ui.find({ key: `avvia-${amb.azione()[0]!.id}` })).toBeUndefined()
  expect(amb.chiamate.filter(c => c.tool === 'get_usage').length).toBe(0)
  expect(amb.processi.filter(p => p.argv[0] === 'gh').length).toBe(0)
  await ui.unmount()
})

const SENTINELLA = `prova-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`
test('2.0: credenziale segreta non entra in stato, config, argv, prompt o avvisi anche se la fonte la riflette', { options: { freellmapiKey: SENTINELLA } }, async ($, on) => {
  const amb = ambiente(on, { fonte: () => ({ risultato: SENTINELLA }) })
  configuraFree(amb)
  mock.clock(on)
  on('state.set', async (_, e, next) => { expect(JSON.stringify(e)).not.toContain(SENTINELLA); return next(e) })
  conferme(on, () => 'Invia testo')
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'Bozza', brief: 'Frase.', esecutore: 'freellmapi', corsia: 'R1', effort: 'low', revisore: 'claude' } as never)
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: `avvia-${amb.azione()[0]!.id}` })
  expect(amb.azione()[0]).toMatchObject({ stato: 'in-avvio', incerto: true })
  expect(JSON.stringify([...amb.disco.values()])).not.toContain(SENTINELLA)
  expect(JSON.stringify(amb.processi)).not.toContain(SENTINELLA)
  expect(JSON.stringify(amb.chiamate)).not.toContain(SENTINELLA)
  await ui.unmount()
})

test('2.0: risorse_agenti dà al modello politica e limiti, delle chiavi solo la presenza', { options: { deepseekKey: SENTINELLA } }, async ($, on) => {
  const amb = ambiente(on)
  configuraFree(amb)
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const r = (await $.tool.call({ tool: 'mcp__chip-manager__risorse_agenti' } as never)) as { result?: unknown }
  const testo = String(r.result)
  expect(testo).not.toContain(SENTINELLA)
  const j = JSON.parse(testo) as { regole: { lette: boolean }; politica: { fornitori: string[]; freellmapi: { livello: string } }; chiavi: Record<string, boolean> }
  expect(j.regole.lette).toBe(true)
  expect(j.politica.fornitori).toContain('freellmapi')
  expect(j.politica.freellmapi.livello).toBe('R1')
  expect(typeof j.chiavi.deepseek).toBe('boolean')
})

test('2.0: revoca del fornitore durante la conferma ferma il testo prima della prenotazione', { options: { freellmapiKey: 'fl-prova-0123456789' } }, async ($, on) => {
  const amb = ambiente(on)
  configuraFree(amb)
  mock.clock(on)
  conferme(on, () => {
    amb.disco.set('X:/casa/.claude/chipmanager/config.json', JSON.stringify({ progetti: { 'acme/progetto': { fornitori: ['claude', 'codex'] } } }))
    return 'Invia testo'
  })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'Bozza', brief: 'Frase.', esecutore: 'freellmapi', corsia: 'R1', effort: 'low', revisore: 'claude' } as never)
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: `avvia-${amb.azione()[0]!.id}` })
  expect(amb.processi.filter(p => p.argv[2] === 'completa').length).toBe(0)
  expect(amb.azione()[0]!.stato).toBe('proposta')
  await ui.unmount()
})

test('2.0: impostazioni disegnate prima di una modifica concorrente non la sovrascrivono', async ($, on) => {
  const amb = ambiente(on)
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: 'impostazioni' })
  amb.disco.set('X:/casa/.claude/chipmanager/config.json', JSON.stringify({ progetti: { 'acme/progetto': { soloLocale: true } } }))
  await ui.press({ key: 'fornitore-freellmapi-premi' })
  // F5.9: la modifica è nella bozza; Applica scrive solo il campo toccato e la modifica dell'altro resta.
  expect(JSON.parse(amb.disco.get('X:/casa/.claude/chipmanager/config.json')!).progetti['acme/progetto']).toEqual({ soloLocale: true })
  await ui.press({ key: 'applica' })
  expect(JSON.parse(amb.disco.get('X:/casa/.claude/chipmanager/config.json')!).progetti['acme/progetto']).toMatchObject({ soloLocale: true, fornitori: expect.arrayContaining(['freellmapi']) })
  await ui.unmount()
})

test('2.0: fonti e GitHub assenti non fanno rete senza opt-in, budget manuale mantiene fonte e unità', async ($, on) => {
  const amb = ambiente(on)
  mock.clock(on)
  amb.disco.set('X:/casa/.claude/chipmanager/config.json', JSON.stringify({ progetti: { 'acme/progetto': { limitiManuali: [
    { id: 'budget-api', fornitore: 'claude', nome: 'Claude API budget', valore: 200, unita: 'EUR', letto: '2026-01-01T00:00:00Z' },
  ] } } }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('terminal') })
  await ui.press({ key: 'vista-carico' })
  expect(await ui.find({ type: 'Text', text: /Claude API budget: 200 EUR · manuale/ })).toBeDefined()
  // Un valore inserito a mano dice quando è stato scritto, non «vecchio»: non è una misura che scade.
  expect(await ui.find({ type: 'Text', text: /manuale · inserito .* fa/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /manuale · .*vecchio/ })).toBeUndefined()
  expect(amb.processi.filter(p => p.argv[0] === 'gh').length).toBe(0)
  await ui.unmount()
})

test('2.0: CLI ignora stato di altro tentativo e non cerca sessioni desktop', async ($, on) => {
  const amb = ambiente(on, { cli: true })
  const clock = mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'Docs', brief: 'Frase.' } as never)
  const id = amb.azione()[0]!.id
  const ui = await $.ui.mount({ ...PANE('terminal') })
  await ui.press({ key: `avvia-${id}` })
  const a = amb.azione()[0]!
  amb.disco.set(`X:/orch/azioni/esecuzioni/${a.tentativo}.json`, JSON.stringify({ id, tentativo: 'az-diverso', stato: 'consegnata' }))
  await clock.advance(20_000)
  expect(amb.azione()[0]!.stato).toBe('avviata')
  expect(amb.chiamate.filter(c => c.tool === 'list_sessions').length).toBe(0)
  await ui.unmount()
})

// --- 2.2: progetto, sessioni, vista Lavoro ----------------------------------------------------------------

test('2.2: cartella dei dati per progetto; la globale resta per compatibilità; percorsi non validi bloccano', () => {
  const home = 'C:/casa'
  expect(cartellaDati(null, 'acme/progetto', home)).toBe('C:/casa/.claude/chipmanager/progetti/acme__progetto')
  expect(cartellaDati({ cartella: '~/dati' }, 'acme/progetto', home)).toBe('C:/casa/dati')
  expect(cartellaDati({ cartella: '~/dati', progetti: { 'acme/progetto': { cartella: 'D:\\orch\\' } } }, 'acme/progetto', home)).toBe('D:/orch')
  expect(cartellaDati({ progetti: { 'acme/progetto': { cartella: '~/a' } } }, 'altro/repo', home)).toBe('C:/casa/.claude/chipmanager/progetti/altro__repo')
  expect(cartellaDati(null, 'C:/lavori/senza remote', home)).toBe('C:/casa/.claude/chipmanager/progetti/C___lavori__senza_remote')
  expect(cartellaDati(null, null, home)).toBe('C:/casa/.claude/chipmanager/progetti/_senza-progetto')
  // Una cartella configurata non valida non ripiega su un'altra: null, e chi chiama si ferma.
  expect(cartellaDati({ progetti: { 'acme/progetto': { cartella: 'relativa' } } }, 'acme/progetto', home)).toBeNull()
  expect(cartellaDati({ cartella: 3 }, 'acme/progetto', home)).toBeNull()
  const lungo = (fine: string) => cartellaDati(null, `C:/${'a'.repeat(130)}/${fine}`, home)!
  expect(lungo('uno')).not.toBe(lungo('due'))
  expect(lungo('uno').length).toBeLessThan(200)
  expect(checkoutDi('C:\\Lavori\\Progetto\\.claude\\worktrees\\fix-a')).toBe('C:/Lavori/Progetto')
  for (const cartella of ['relativa/x', 3, '', '../su'])
    expect(progettoDa({ progetti: { 'acme/progetto': { cartella } } }, 'acme/progetto')).toHaveProperty('k')
  expect(typeof progettoDa({ progetti: { 'acme/progetto': { cartella: '~/orch' } } }, 'acme/progetto')).toBe('object')
})

test('2.2: sessioni del progetto: worktree inclusi, altri progetti, archiviate e vecchie escluse; forme strette', () => {
  const radice = radiceProgetto('C:\\Lavori\\Progetto\\')
  expect(radice).toBe('c:/lavori/progetto')
  expect(nelProgetto('C:/lavori/progetto/.claude/worktrees/fix-a/sub', radice)).toBe(true)
  expect(nelProgetto('C:/lavori/progetto-due', radice)).toBe(false)
  const adesso = Date.parse('2026-01-02T12:00:00Z')
  const id = (n: number) => `local_0000000${n}-1234-1234-1234-123456789abc`
  const lista = [
    { sessionId: id(1), title: 'Guida', cwd: 'C:\\Lavori\\Progetto\\.claude\\worktrees\\docs', isRunning: true, lastActivityAt: '2026-01-02T11:59:00Z', branch: 'docs' },
    { sessionId: id(2), title: 'Altrove', cwd: 'C:/altro', isRunning: true, lastActivityAt: '2026-01-02T11:59:00Z' },
    { sessionId: id(3), title: 'Archiviata', cwd: 'C:/lavori/progetto', isArchived: true, lastActivityAt: '2026-01-02T11:59:00Z' },
    { sessionId: id(4), title: 'Di ieri l\'altro', cwd: 'C:/lavori/progetto', isRunning: false, lastActivityAt: '2025-12-30T11:59:00Z' },
    { sessionId: 'non-valida', cwd: 'C:/lavori/progetto', isRunning: true },
    { sessionId: id(5), title: 'x\u0007y', cwd: 'C:/lavori/progetto', isRunning: false, lastActivityAt: '2026-01-02T10:00:00Z' },
  ]
  expect(sessioniClaude(lista, radice, adesso).map(s => [s.id, s.titolo, s.stato])).toEqual([
    [id(1), 'Guida', 'in-corso'],
    [id(5), '', 'ferma'],
  ])
  expect(sessioniClaude({ non: 'un elenco' }, radice, adesso)).toEqual([])
  expect(dettagliSessione({ model: 'claude-sonnet-5-5', effort: 'medium', branch: 'docs', segreto: 'x' })).toEqual({ modello: 'claude-sonnet-5-5', effort: 'medium', ramo: 'docs' })
  expect(contestoDa({ context: { status: 'ok', percentUsed: 34.4, tokensUsed: 340_000 } })).toEqual({ contesto: 34, token: 340_000 })
  expect(contestoDa({ context: { status: 'ok', percentUsed: 34, tokensUsed: -1 } })).toEqual({ contesto: 34, token: undefined })
  expect(contestoDa({ context: { status: 'unavailable', percentUsed: 34 } })).toBeUndefined()
  expect(contestoDa({ context: { status: 'ok', percentUsed: 140 } })).toBeUndefined()
  const codex = sessioniCodex([
    { id: 'esempio-0001', cwd: 'C:/lavori/progetto', ramo: 'fix', modello: 'gpt-6-astra', effort: 'xhigh', inCorso: true, attivita: '2026-01-02T11:58:00Z', token: 61_000, finestra: 100_000 },
    { id: 'esempio-0002', cwd: 'C:/altro', attivita: '2026-01-02T11:58:00Z' },
    { id: 'esempio-0003', cwd: 'C:/lavori/progetto', attivita: '2025-12-01T00:00:00Z' },
    { id: '../fuori', cwd: 'C:/lavori/progetto', attivita: '2026-01-02T11:58:00Z' },
  ], radice, adesso)
  expect(codex).toEqual([{ id: 'codex-esempio-0001', motore: 'codex', titolo: 'Codex · fix', ramo: 'fix', modello: 'gpt-6-astra', effort: 'xhigh', stato: 'in-corso', contesto: 61, token: 61_000, attivita: '2026-01-02T11:58:00Z' }])
})

const ID_ESEMPIO = (n: number) => `local_aaaaaaa${n}-1234-1234-1234-123456789abc`
function ambienteSessioni(on: Parameters<TestBody>[1], adesso: () => number, limiti?: () => Limite[]) {
  const quando = (min: number) => new Date(adesso() - min * 60_000).toISOString()
  return ambiente(on, {
    strumenti: ['mcp__ccd_session_mgmt__list_sessions', 'mcp__ccd_session_mgmt__get_usage'],
    fonte: cmd => (cmd === 'sessioni'
      ? { sessioni: [{ id: 'esempio-0001', cwd: 'X:/repo/.claude/worktrees/fix-ricerca', ramo: 'fix-ricerca', modello: 'gpt-6-astra', effort: 'xhigh', stato: 'aperto', inCorso: true, attivita: quando(0), token: 61_000, finestra: 100_000 }],
          diagnostica: { byte: 4096, byteLimiti: 0, salti: 1, aperti: 1 } }
      : cmd === 'limiti' && limiti ? { limiti: limiti(), proxy: 'non abilitato', chiavi: { anthropic: false, deepseek: false, freellmapi: false } } : undefined),
    mcp: (_s, tool, args) => {
      const testo = (v: unknown) => ({ isError: false, content: [{ type: 'text', text: JSON.stringify(v) }] })
      const sid = (args as { session_id?: string }).session_id
      if (tool === 'list_sessions')
        return testo([
          { sessionId: ID_ESEMPIO(1), title: 'Guida delle API', cwd: 'X:\\repo\\.claude\\worktrees\\docs-api', isRunning: true, lastActivityAt: quando(2) },
          { sessionId: ID_ESEMPIO(2), title: 'Altro progetto', cwd: 'X:/altro', isRunning: true, lastActivityAt: quando(1) },
          { sessionId: ID_ESEMPIO(3), title: 'Revisione sessione', cwd: 'X:/repo', isRunning: false, lastActivityAt: quando(18) },
        ])
      if (tool === 'get_session' && sid === ID_ESEMPIO(1)) return testo({ model: 'claude-sonnet-5-5', effort: 'medium', branch: 'docs-api', isRunning: true })
      if (tool === 'get_session' && sid === ID_ESEMPIO(3)) return testo({ model: 'claude-opus-5-5', effort: 'high', isRunning: false })
      if (tool === 'get_usage' && sid === ID_ESEMPIO(1)) return testo({ context: { status: 'ok', percentUsed: 34, tokensUsed: 340_000 } })
      return undefined
    },
  })
}

test('2.2: «Al lavoro adesso» mostra anche le sessioni aperte a mano e quelle Codex, con modello, effort e contesto', async ($, on) => {
  const clock = mock.clock(on)
  const amb = ambienteSessioni(on, () => Date.now())
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await clock.advance(20_000)
  const ui = await $.ui.mount({ ...PANE('desktop') })
  // F12: il frammento «contesto 34%» usa Text annidati, con solo la percentuale in monospazio.
  for (const testo of [/^Guida delle API$/, /^Revisione sessione$/, /^Codex · fix-ricerca$/, /^Sonnet 5\.5$/, /^34%$/, /^61%$/, /aperta a mano/, /^3 al lavoro/])
    expect(await ui.find({ type: 'Text', text: testo })).toBeDefined()
  expect((await ui.find({ type: 'Text', text: /^34%$/ }))?.props.mono).toBe(true)
  expect((await ui.find({ type: 'Text', text: /^contesto\s*$/ }))?.props.mono).not.toBe(true)
  expect(await ui.find({ type: 'Text', text: /Altro progetto/ })).toBeUndefined()
  // Il contesto si chiede solo per le sessioni al lavoro, mai per quelle ferme.
  expect(amb.chiamate.some(c => c.tool === 'get_usage' && c.args.session_id === ID_ESEMPIO(3))).toBe(false)
  await ui.press({ key: `apri-ses-${ID_ESEMPIO(1)}` })
  expect(amb.chiamate.some(c => c.tool === 'open_session_in' && c.args.session_id === ID_ESEMPIO(1))).toBe(true)
  await ui.unmount()
  // Pannello stretto (C1.3): niente tabella; due righe per sessione, il ramo su una terza.
  const t = await $.ui.mount({ ...PANE('terminal') })
  expect(await t.find({ type: 'Text', text: /^Contesto$/ })).toBeUndefined()
  for (const testo of [/^GPT-6 Astra$|^gpt-6-astra$/, /^▰▰▰▰ xhigh$/, /^contesto 61%$/, /^fix-ricerca$/])
    expect(await t.find({ type: 'Text', text: testo })).toBeDefined()
  await t.unmount()
  const largo = await $.ui.mount({ ...PANE('terminal'), props: { ...PANE('terminal').props, bodyColumns: 120 } })
  expect(await largo.find({ type: 'Text', text: /^Contesto$/ })).toBeDefined()
  await largo.unmount()
})

for (const [nome, politica] of [['solo rete locale', { soloLocale: true }], ['Claude vietato', { fornitori: ['codex'] }]] as const)
  test(`2.2: ${nome}: le sessioni si leggono, il contesto (get_usage) no`, async ($, on) => {
    const clock = mock.clock(on)
    const amb = ambienteSessioni(on, () => Date.now())
    amb.disco.set('X:/casa/.claude/chipmanager/config.json', JSON.stringify({ progetti: { 'acme/progetto': politica } }))
    await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
    await clock.advance(20_000)
    const ui = await $.ui.mount({ ...PANE('desktop') })
    expect(await ui.find({ type: 'Text', text: /^Guida delle API$/ })).toBeDefined()
    expect(amb.chiamate.filter(c => c.tool === 'get_usage').length).toBe(0)
    await ui.unmount()
  })

test('2.2: senza CHIPMANAGER_DIR una configurazione rotta non sposta le azioni in un\'altra cartella', async ($, on) => {
  const amb = ambiente(on, { senzaDir: true })
  mock.clock(on)
  amb.disco.set('X:/casa/.claude/chipmanager/config.json', JSON.stringify({ progetti: { 'acme/progetto': { cartella: 'relativa/dati' } } }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'Docs', brief: 'Frase.' } as never).catch(() => undefined)
  expect([...amb.disco.keys()].filter(k => /\/a-[a-z0-9]+\.json$/.test(k))).toEqual([])
  amb.disco.set('X:/casa/.claude/chipmanager/config.json', '{ rotto')
  await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'Docs', brief: 'Frase.' } as never).catch(() => undefined)
  expect([...amb.disco.keys()].filter(k => /\/a-[a-z0-9]+\.json$/.test(k))).toEqual([])
  // Con una cartella valida, le azioni vanno nella cartella del progetto.
  amb.disco.set('X:/casa/.claude/chipmanager/config.json', JSON.stringify({ progetti: {} }))
  await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'Docs', brief: 'Frase.' } as never)
  expect([...amb.disco.keys()].some(k => k.startsWith('X:/casa/.claude/chipmanager/progetti/acme__progetto/azioni/a-'))).toBe(true)
})

test('2.2: azioni senza progetto: richiesta in linea, scarto annullabile, assegnazione al progetto', async ($, on) => {
  const amb = ambiente(on)
  mock.clock(on)
  amb.disco.set('X:/orch/azioni/a-orfana01.json', JSON.stringify(base('a-orfana01', 1, { titolo: 'Vecchia proposta' })))
  amb.disco.set('X:/orch/azioni/a-orfana02.json', JSON.stringify(base('a-orfana02', 2, { titolo: 'Altra vecchia' })))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('terminal') })
  expect(await ui.find({ type: 'Text', text: /2 azioni salvate da una versione precedente senza progetto/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Vecchia proposta/ })).toBeUndefined()
  await ui.press({ key: 'senza-scarta' })
  expect(amb.azione().map(a => a.stato)).toEqual(['scartata', 'scartata'])
  await ui.press({ key: 'annulla-scarto' })
  expect(amb.azione().map(a => a.stato)).toEqual(['proposta', 'proposta'])
  await ui.press({ key: 'senza-assegna' })
  expect(amb.azione().map(a => a.repo)).toEqual(['acme/progetto', 'acme/progetto'])
  expect(await ui.find({ type: 'Text', text: /Vecchia proposta/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /senza progetto/ })).toBeUndefined()
  await ui.unmount()
})

test('2.2: popup all\'apertura per le azioni senza progetto, una volta', async ($, on) => {
  const amb = ambiente(on)
  const clock = mock.clock(on)
  const domande: string[] = []
  conferme(on, q => (domande.push(q), 'Assegna a acme/progetto'))
  amb.disco.set('X:/orch/azioni/a-orfana01.json', JSON.stringify(base('a-orfana01', 1, { titolo: 'Vecchia proposta' })))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await clock.advance(20_000)
  expect(domande.filter(d => d.includes('non ha un progetto')).length).toBe(1)
  expect(amb.azione()[0]!.repo).toBe('acme/progetto')
})

test('2.2: viste con i tasti 1 2 3; la sintesi dice chi lavora e chi aspetta', async ($, on) => {
  const amb = ambiente(on)
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'Test per il filtro', brief: 'Frase.' } as never)
  const ui = await $.ui.mount({ ...PANE('terminal') })
  expect(await ui.find({ type: 'Text', text: /al lavoro · 1 da avviare/ })).toBeDefined()
  expect(await ui.find({ key: 'tutte' })).toBeDefined()
  await ui.press({ key: 'vista-carico' })
  expect(await ui.find({ type: 'Text', text: /^Limiti e budget$/ })).toBeDefined()
  expect(await ui.find({ key: 'tutte' })).toBeUndefined()
  await ui.press({ key: 'impostazioni' })
  // F10: le sezioni sono chip in due gruppi (Account e Progetto), non più un gruppo unico «sezione».
  expect(await ui.find({ key: 'sezione-connessioni-premi' })).toBeDefined()
  await ui.press({ key: 'vista-lavoro' })
  expect(await ui.find({ key: `avvia-${amb.azione()[0]!.id}` })).toBeDefined()
  await ui.unmount()
})

// --- 2.3: soglie per fornitore e vista Carico --------------------------------------------------------------

test('2.3: soglie per fornitore: predefinite 70/90, nessuna, personali; forme non valide bloccano', () => {
  const r = (soglie: unknown) => progettoDa({ progetti: { 'acme/progetto': { soglie } } }, 'acme/progetto')
  expect(progettoDa(null, 'acme/progetto')).toMatchObject({ risorse: { soglie: { claude: { attenzione: 70, critica: 90 }, codex: { attenzione: 70, critica: 90 } } } })
  expect(r({ codex: null, claude: { attenzione: 60, critica: 80 } })).toMatchObject({ risorse: { soglie: { claude: { attenzione: 60, critica: 80 }, codex: null, deepseek: { attenzione: 70, critica: 90 } } } })
  for (const rotta of [{ claude: { attenzione: 90, critica: 90 } }, { claude: { attenzione: 0, critica: 50 } }, { claude: { attenzione: 50, critica: 101 } }, { altro: null }, { claude: '70/90' }, []])
    expect(r(rotta)).toHaveProperty('k')
  const s = { attenzione: 60, critica: 80 }
  expect([livelloDi(59, s), livelloDi(60, s), livelloDi(80, s), livelloDi(99, null)]).toEqual(['ok', 'attenzione', 'critica', 'ok'])
  expect(coloreLimite({ ...LIMITE, percentuale: 85 }, Date.now(), s)).toBe(LIVELLO.critica)
  expect(coloreLimite({ ...LIMITE, percentuale: 85 })).toBe(LIVELLO.attenzione)
  expect(coloreLimite({ ...LIMITE, percentuale: 99 }, Date.now(), null)).toBe(STATO.inCorso)
  // La quota più piena conta solo misure fresche di piano: non la spesa API, non i manuali, non le vecchie.
  const limiti: Limite[] = [
    { ...LIMITE, id: 'claude-a', percentuale: 40 },
    { ...LIMITE, id: 'claude-b', percentuale: 75 },
    { ...LIMITE, id: 'claude-vecchio', percentuale: 99, letto: '2000-01-01T00:00:00Z' },
    { ...LIMITE, id: 'claude-manuale', percentuale: 98, manuale: true },
    { ...LIMITE, id: 'claude-api', percentuale: 97 },
  ]
  expect(piuPieno(limiti, 'claude')?.id).toBe('claude-b')
  expect(piuPieno(limiti, 'codex')).toBeUndefined()
})

test('2.3: oltre la soglia critica le scelte aperte vanno altrove; quelle esplicite restano', () => {
  const chi: Chiamante = { io: 'm', repo: 'o/r', modello: 'claude-opus-5-5', effort: 'high', permessi: 'auto', lanciatore: 'desktop' }
  const a = base('a-soglia01', 1, { repo: 'o/r', corsia: 'R2' })
  const codexPieno: Limite = { ...LIMITE, id: 'codex-primary', fornitore: 'codex', percentuale: 92 }
  const claudeMeta: Limite = { ...LIMITE, id: 'claude-weekly', percentuale: 50 }
  const r = { ...R, risorse: { ...RISORSE_DEFAULT, pesi: [{ tipo: 'fornitore' as const, nome: 'codex', percentuale: 400, assoluto: 0 }] } }
  // Anche con Codex molto preferito dai pesi, oltre la critica il margine è zero e vince Claude.
  expect(bilancia(a, {}, r, [codexPieno, claudeMeta], [a], chi).esecutore).toBe('claude')
  expect(bilancia(a, { esecutore: 'codex' }, r, [codexPieno, claudeMeta], [a], chi).esecutore).toBe('codex')
  // Senza soglia per Codex torna a contare solo il margine (8%) contro il peso.
  const senza = { ...r, risorse: { ...r.risorse, soglie: { ...r.risorse.soglie, codex: null } } }
  expect(punteggio({ ...a, esecutore: 'codex' }, senza, [codexPieno], [a])).toBeGreaterThan(0)
  // Oltre la critica resta un millesimo del punteggio senza soglia: abbastanza per ordinare, mai per vincere.
  const conSoglia = punteggio({ ...a, esecutore: 'codex' }, r, [codexPieno], [a])
  expect(Math.abs(conSoglia - punteggio({ ...a, esecutore: 'codex' }, senza, [codexPieno], [a]) / 1000)).toBeLessThan(1e-9)
  // Tutti oltre la critica: il residuo tiene l'ordine dei margini (Codex 9% libero batte Claude 1%).
  expect(bilancia(a, {}, R, [{ ...codexPieno, percentuale: 91 }, { ...claudeMeta, percentuale: 99 }], [a], chi).esecutore).toBe('codex')
})

test('2.3: «Avvia tutte» oltre la soglia critica lo dice e chiede «Avvia comunque»; chiusa senza scelta non avvia', async ($, on) => {
  const domande: string[] = []
  let risposta = 'Annulla'
  const amb = ambiente(on, {
    fonte: cmd => (cmd === 'limiti'
      ? { limiti: [{ id: 'claude-weekly', fornitore: 'claude', nome: 'Claude piano · settimanale', percentuale: 93, unita: '%', fonte: 'prova', letto: new Date().toISOString() }], proxy: 'non abilitato', chiavi: { anthropic: false, deepseek: false, freellmapi: false } }
      : undefined),
  })
  conferme(on, q => (domande.push(q), risposta))
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'Docs', brief: 'Frase.', esecutore: 'claude' } as never)
  const ui = await $.ui.mount({ ...PANE('desktop') })
  expect(await ui.find({ type: 'Text', text: /Claude 93% usato, oltre la critica/ })).toBeDefined()
  await ui.press({ key: 'tutte' })
  expect(domande.at(-1)).toMatch(/^Oltre la soglia critica: Claude piano · settimanale 93% usato \(critica da 90%\)\. Avvio 1 sessione/)
  expect(amb.chiamate.filter(c => c.tool === 'start_session').length).toBe(0)
  risposta = 'Avvia comunque'
  await ui.press({ key: 'tutte' })
  expect(amb.chiamate.filter(c => c.tool === 'start_session').length).toBe(1)
  await ui.press({ key: 'vista-carico' })
  expect(await ui.find({ type: 'Text', text: /^Avvii nelle ultime 24 ore: Claude 1 \(100%\)$/ })).toBeDefined()
  await ui.unmount()
})

test('2.3: conferma di «Avvia tutte» chiusa senza scelta: non parte niente e non compare un errore', async ($, on) => {
  const amb = ambiente(on)
  on('tool.call', { tool: 'AskUserQuestion' }, () => ({ deny: 'chiusa senza scelta' }))
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'Docs', brief: 'Frase.', esecutore: 'claude' } as never)
  const ui = await $.ui.mount({ ...PANE('terminal') })
  await ui.press({ key: 'tutte' })
  expect(amb.chiamate.filter(c => c.tool === 'start_session').length).toBe(0)
  expect(await ui.find({ type: 'Text', text: /^! / })).toBeUndefined()
  await ui.unmount()
})

test('2.3: «Avvia tutte» sotto soglia chiede «Avvia» e parte', async ($, on) => {
  const amb = ambiente(on)
  conferme(on, q => (q.startsWith('Avvio 1 sessione') ? 'Avvia' : 'Annulla'))
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'Docs', brief: 'Frase.', esecutore: 'claude' } as never)
  const ui = await $.ui.mount({ ...PANE('terminal') })
  await ui.press({ key: 'tutte' })
  expect(amb.chiamate.filter(c => c.tool === 'start_session').length).toBe(1)
  await ui.unmount()
})

test('2.3: vista Carico: matrice modello × effort, limiti per fornitore con le soglie, contesto e pesi in uso', async ($, on) => {
  const clock = mock.clock(on)
  const letto = () => new Date().toISOString()
  const amb = ambienteSessioni(on, () => Date.now(), () => [
    { id: 'claude-weekly', fornitore: 'claude', nome: 'Claude piano · settimanale', percentuale: 30, unita: '%', fonte: 'prova', letto: letto() },
    { id: 'codex-primary', fornitore: 'codex', nome: 'Codex piano · primaria', percentuale: 20, unita: '%', fonte: 'prova', letto: letto() },
  ])
  amb.disco.set('X:/casa/.claude/chipmanager/config.json', JSON.stringify({ progetti: { 'acme/progetto': {
    soglie: { codex: null }, pesi: [{ tipo: 'fornitore', nome: 'codex', percentuale: 50, assoluto: 0 }] } } }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'In coda', brief: 'Frase.', esecutore: 'claude', modello: 'claude-sonnet-5-5', effort: 'medium' } as never)
  await clock.advance(20_000)
  for (const [surface, colonne] of [['desktop', 120], ['terminal', 120], ['terminal', 50]] as const) {
    const ui = await $.ui.mount({ ...PANE(surface), props: { ...PANE(surface).props, bodyColumns: colonne } })
    await ui.press({ key: 'vista-carico' })
    expect(await ui.find({ type: 'Text', text: /Sonnet 5\.5: 1 sessione · 340k token/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /(GPT-6 Astra|gpt-6-astra): 1 sessione · 61k token/ })).toBeDefined()
    // Su `stretta` la matrice diventa un elenco per modello (C1.4).
    const stretta = colonne < 70
    // F9.4: le intestazioni sono in maiuscolo sul desktop (stesse parole), da qui il confronto senza maiuscole.
    for (const testo of [/^Al lavoro per modello ed effort$/i, stretta ? /^Sonnet 5\.5: medium 1 \(\+1 in coda\)$/ : /^Sonnet 5\.5$/, /^Limiti e budget$/i, /attenzione da 70% · critica da 90%/, /nessuna soglia/,
      /^Contesto delle sessioni al lavoro$/i, /^Guida delle API$/i, /^Codex \+50%\. Valgono solo/, /Nessun avvio nelle ultime 24 ore/])
      expect(await ui.find({ type: 'Text', text: testo })).toBeDefined()
    // Sonnet 5.5 · medium: una sessione al lavoro e una chip in coda nella stessa cella (sull'elenco, nella riga del modello).
    expect((await ui.findAll({ type: 'Text', text: /^1 \+1$/ })).length).toBe(stretta ? 0 : 1)
    await ui.press({ key: 'vista-lavoro' })
    await ui.unmount()
  }
})

// --- 2.4: board di progetto, revisione riferita, date --------------------------------------------------------

const CONFIG = 'X:/casa/.claude/chipmanager/config.json'
const INDICE = 'X:/orch/board/demo/index.html'
const conBoard = (amb: ReturnType<typeof ambiente>, board: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
  amb.disco.set(CONFIG, JSON.stringify({ progetti: { 'acme/progetto': { milestoneGithub: true, board, ...extra } } }))
const voci = (amb: ReturnType<typeof ambiente>) =>
  (JSON.parse(amb.disco.get('X:/orch/board/demo/riassunti.json') ?? '{"voci":{}}') as { voci: Record<string, { stato: string; testo?: string }> }).voci
const comandi = (amb: ReturnType<typeof ambiente>) => amb.processi.map(x => String(x.argv[2] ?? x.argv[0]))

test('2.4: board spenta per difetto: nessuna scrittura, nessuna chiamata al modello, nessun pulsante', async ($, on) => {
  const amb = ambiente(on)
  const clock = mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'Docs', brief: 'Aggiorna il README.' } as never)
  for (let i = 0; i < 4; i++) await clock.advance(30_000)
  expect(comandi(amb).filter(c => c.startsWith('board-') || c === 'git-log' || c === 'leggi-piano')).toEqual([])
  expect(amb.modello.length).toBe(0)
  const ui = await $.ui.mount({ ...PANE('desktop') })
  expect(await ui.find({ key: 'apri-board' })).toBeUndefined()
  expect(await ui.find({ key: `board-${amb.azione()[0]!.id}` })).toBeUndefined()
  await ui.unmount()
})

test('2.4: board accesa: HTML dall\'helper senza gettoni, «Apri board» con argv fisso, spegnimento da Impostazioni', async ($, on) => {
  const amb = ambiente(on)
  conBoard(amb, { modo: 'accesa', generazione: 1 })
  const clock = mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'Fix ricerca', brief: 'Correggi il dedup.', piano: 'docs/PIANO.md' } as never)
  const rifiutato = await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'X', brief: 'Y', piano: '../fuori.md' } as never)
  expect(String((rifiutato as { deny?: unknown }).deny)).toContain('plan')
  const id = amb.azione()[0]!.id
  expect(amb.azione()[0]!.piano).toBe('docs/PIANO.md')
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await clock.advance(30_000)
  // «Nella board» sulla scheda della chip, solo a board scritta.
  await ui.press({ key: `mod-${id}` })
  expect(await ui.find({ key: `board-${id}` })).toBeDefined()
  await ui.press({ key: `mod-${id}` })
  await ui.press({ key: `avvia-${id}` })
  await clock.advance(30_000)
  await clock.advance(30_000)
  const html = amb.disco.get(INDICE)!
  expect(html).toContain('Fix ricerca')
  expect(html).toContain('# Piano d&#39;esempio (docs/PIANO.md)')
  expect(html).toContain("content=\"default-src 'none'; style-src 'unsafe-inline'\"")
  expect(html).toContain(`File: ${INDICE}`)
  const tentativo = amb.azione()[0]!.tentativo!
  expect(html.includes(tentativo)).toBe(false)
  expect(amb.processi.some(x => x.argv[2] === 'board-scrivi' && x.argv[6] === '1')).toBe(true)
  // Due giri senza cambiamenti: nessuna riscrittura.
  const scritture = comandi(amb).filter(c => c === 'board-scrivi').length
  await clock.advance(30_000)
  expect(comandi(amb).filter(c => c === 'board-scrivi').length).toBe(scritture)
  await ui.press({ key: 'apri-board' })
  expect(amb.processi.some(x => x.argv.length === 2 && x.argv[0] === 'explorer.exe' && x.argv[1] === 'X:\\orch\\board\\demo\\index.html')).toBe(true)
  await ui.press({ key: 'impostazioni' })
  await ui.press({ key: 'sezione-board-premi' })
  await ui.press({ key: 'board-spenta-premi' })
  await ui.press({ key: 'applica' })
  expect(JSON.parse(amb.disco.get(CONFIG)!).progetti['acme/progetto'].board).toEqual({ modo: 'spenta', generazione: 2 })
  expect(amb.processi.some(x => x.argv[2] === 'board-spegni' && x.argv[6] === '2')).toBe(true)
  expect(amb.disco.has(INDICE)).toBe(false)
  await ui.press({ key: 'vista-lavoro' })
  expect(await ui.find({ key: 'apri-board' })).toBeUndefined()
  await ui.unmount()
})

test('2.4: aggiorna_azione con sola revisione: stato invariato, gettone vecchio e sessione estranea rifiutati', async ($, on) => {
  const amb = ambiente(on)
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'Docs', brief: 'Aggiorna il README.' } as never)
  const id = amb.azione()[0]!.id
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: `avvia-${id}` })
  const t = amb.azione()[0]!.tentativo!
  const chiama = (args: Record<string, unknown>) => $.tool.call({ tool: 'mcp__chip-manager__aggiorna_azione', id, ...args } as never) as Promise<{ deny?: string; result?: string }>
  const ok = await chiama({ tentativo: t, revisione: { esito: 'approvata', nota: 'tutto a posto', riferitaDa: 'falso' } })
  expect(ok.deny).toBeUndefined()
  expect(amb.azione()[0]).toMatchObject({ stato: 'avviata', revisione: { esito: 'approvata', nota: 'tutto a posto', riferitaDa: 'sessione-master', tentativo: t } })
  expect((await chiama({ tentativo: 'az-vecchio001', revisione: { esito: 'da-correggere' } })).deny).toContain('current attempt')
  expect((await chiama({ revisione: { esito: 'verificata' } })).deny).toContain('esito')
  expect((await chiama({ tentativo: t, revisione: { esito: 'approvata', nota: 'x'.repeat(301) } })).deny).toContain('300')
  expect((await chiama({})).deny).toContain('stato')
  // Il proponente può riferirla senza gettone; un'altra sessione senza gettone no.
  expect((await chiama({ revisione: { esito: 'in-corso' } })).deny).toBeUndefined()
  const a = amb.azione()[0]!
  amb.disco.set(`X:/orch/azioni/${id}.json`, JSON.stringify({ ...a, proponente: 'altra-sessione' }))
  expect((await chiama({ revisione: { esito: 'approvata' } })).deny).toContain('current attempt')
  expect(amb.azione()[0]!.revisione!.esito).toBe('in-corso')
  expect(amb.azione()[0]!.stato).toBe('avviata')
  // Stato e revisione insieme: la data di consegna la scrive transizione().
  expect((await chiama({ stato: 'consegnata', tentativo: t, revisione: { esito: 'approvata' } })).deny).toBeUndefined()
  expect(amb.azione()[0]!.consegnataIl).toBeDefined()
  expect(amb.azione()[0]!.revisione!.esito).toBe('approvata')
  // «Segna completata» dal pannello: la data della pressione.
  await ui.press({ key: `fatta-${id}` })
  expect(amb.azione()[0]).toMatchObject({ stato: 'completata' })
  expect(amb.azione()[0]!.completataIl).toBeDefined()
  await ui.unmount()
})

test('2.4: a ogni nuovo avvio la revisione si azzera; la chiusura dal registro scrive la data di completamento', async ($, on) => {
  const sessione = { isArchived: false, isRunning: true, lastActivityAt: '2026-11-05T00:00:00Z', branch: 'claude/x' }
  const amb = ambiente(on, {
    mcp: (_s, tool, args) =>
      tool === 'get_session' && (args as { session_id?: unknown }).session_id !== 'self'
        ? { isError: false, content: [{ type: 'text', text: JSON.stringify(sessione) }] }
        : undefined,
  })
  const clock = mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'Docs', brief: 'Aggiorna il README.', issue: 1 } as never)
  const id = amb.azione()[0]!.id
  const a = amb.azione()[0]!
  amb.disco.set(`X:/orch/azioni/${id}.json`, JSON.stringify({ ...a, stato: 'fallita', tentativo: 'az-vecchio001',
    revisione: { esito: 'approvata', riferitaDa: 'x', quando: '2026-11-04T00:00:00Z', tentativo: 'az-vecchio001' } }))
  await clock.advance(20_000)
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: `riprova-${id}` })
  expect(amb.azione()[0]!.stato).toBe('avviata')
  expect(amb.azione()[0]!.revisione).toBeUndefined()
  expect(amb.azione()[0]!.avviataIl).toBeDefined()
  amb.disco.set('X:/orch/registro.json', JSON.stringify({ task: { t1: { issue: 1, ramo: 'claude/x', stato: 'fuso', creato: '2999-01-01' } } }))
  await clock.advance(20_000)
  expect(amb.azione()[0]!.stato).toBe('completata')
  expect(amb.azione()[0]!.completataIl).toBeDefined()
  await ui.unmount()
})

test('2.4: riassunti: uno per testo, mai per un cambio di stato; senza risposta conta; due pannelli, una chiamata', async ($, on) => {
  let risposta: unknown
  const amb = ambiente(on, { modello: () => risposta })
  conBoard(amb, { modo: 'riassunti', generazione: 1 })
  const clock = mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'Docs', brief: 'Aggiorna il README.' } as never)
  await clock.advance(60_000)
  await clock.advance(60_000)
  expect(amb.modello.length).toBe(1)
  expect(amb.modello[0]!.model).toBe('haiku')
  expect(amb.modello[0]!.prompt).toContain('<chip>')
  expect(Object.values(voci(amb)).map(v => v.stato)).toEqual(['fatto'])
  await clock.advance(30_000)
  expect(amb.disco.get(INDICE)).toContain('Riassunto d&#39;esempio.')
  // Cambio di stato: nessuna chiamata. Testo nuovo: una chiamata; senza risposta conta e non si ritenta.
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: `avvia-${amb.azione()[0]!.id}` })
  await clock.advance(60_000)
  expect(amb.modello.length).toBe(1)
  risposta = { isAnswered: false, reason: 'empty-reply', usage: { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } }
  const a = amb.azione()[0]!
  amb.disco.set(`X:/orch/azioni/${a.id}.json`, JSON.stringify({ ...a, brief: 'Aggiorna il README e il CHANGELOG.' }))
  await clock.advance(60_000)
  await clock.advance(60_000)
  expect(amb.modello.length).toBe(2)
  expect(Object.values(voci(amb)).map(v => v.stato).sort()).toEqual(['fallita', 'fatto'])
  // Un'altra chip già prenotata da un altro pannello: nessuna seconda chiamata.
  await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'Altro', brief: 'Altro lavoro.' } as never)
  const nuova = amb.azione().find(x => x.titolo === 'Altro')!
  const lista = amb.azione().filter(x => !['completata', 'scartata'].includes(x.stato))
  amb.disco.set('X:/orch/board/demo/riassunti.json', JSON.stringify({ voci: { ...voci(amb), [chiaveRiassunto(nuova, lista, 'it')]: { stato: 'prenotata' } } }))
  await clock.advance(60_000)
  expect(amb.modello.length).toBe(2)
  await ui.unmount()
})

test('2.4: riassunti: soloLocale e tetto del giorno = zero chiamate; spegnimento durante la chiamata scarta il risultato', async ($, on) => {
  const amb = ambiente(on, {
    modello: () => {
      // Il committente spegne mentre la chiamata è in volo.
      conBoard(amb, { modo: 'spenta', generazione: 2 })
      return undefined
    },
  })
  conBoard(amb, { modo: 'riassunti', generazione: 1 }, { soloLocale: true })
  const clock = mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'Docs', brief: 'Aggiorna il README.' } as never)
  await clock.advance(60_000)
  await clock.advance(60_000)
  expect(amb.modello.length).toBe(0)
  conBoard(amb, { modo: 'riassunti', generazione: 1 })
  amb.disco.set('X:/orch/board/demo/budget.json', JSON.stringify({ usati: 100 }))
  await clock.advance(60_000)
  expect(amb.modello.length).toBe(0)
  amb.disco.set('X:/orch/board/demo/budget.json', JSON.stringify({ usati: 0 }))
  await clock.advance(60_000)
  expect(amb.modello.length).toBe(1)
  expect(Object.values(voci(amb)).map(v => v.stato)).toEqual(['prenotata'])
  expect(amb.disco.get(INDICE)).not.toContain('Riassunto d&#39;esempio.')
})

// --- 2.4: correzioni dopo la revisione ---------------------------------------------------------------------

/** Un record d'azione del progetto, scritto direttamente sul disco finto. */
const scriviAzione = (amb: ReturnType<typeof ambiente>, id: string, extra: Partial<Azione>) =>
  amb.disco.set(`X:/orch/azioni/${id}.json`, JSON.stringify({
    id, versione: 1, repo: 'acme/progetto', titolo: `Lavoro ${id}`, brief: 'Mandato d\'esempio.', ordine: 1, dipende: [],
    esecutore: 'claude', revisore: 'codex', stato: 'proposta', creata: '2026-09-01T00:00:00Z', aggiornata: '2026-09-01T00:00:00Z', ...extra,
  }))

test('2.4: la politica cambia durante un giro di riassunti: la chiamata successiva non parte', async ($, on) => {
  const amb = ambiente(on, {
    modello: () => {
      conBoard(amb, { modo: 'riassunti', generazione: 1 }, { soloLocale: true })
      return undefined
    },
  })
  conBoard(amb, { modo: 'riassunti', generazione: 1 })
  scriviAzione(amb, 'a-pol00001', { ordine: 1 })
  scriviAzione(amb, 'a-pol00002', { ordine: 2 })
  const clock = mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await clock.advance(60_000)
  expect(amb.modello.length).toBe(1)
  await clock.advance(60_000)
  expect(amb.modello.length).toBe(1)
})

test('2.4: la board riceve tutte le chip: completate vecchie contate, dipendenze trovate, riassunti allineati', async ($, on) => {
  const amb = ambiente(on)
  conBoard(amb, { modo: 'riassunti', generazione: 1 })
  scriviAzione(amb, 'a-vec00001', { titolo: 'Base vecchia', stato: 'completata', completataIl: '2026-09-01T00:00:00Z' })
  scriviAzione(amb, 'a-dip00001', { titolo: 'Dipende dalla vecchia', dipende: ['a-vec00001'], ordine: 2 })
  const clock = mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await clock.advance(60_000)
  await clock.advance(60_000)
  await clock.advance(60_000)
  const html = amb.disco.get(INDICE)!
  expect(html).toContain('1 completata da più di 30 giorni')
  expect(html).not.toContain('non esiste')
  expect(html).toContain('Base vecchia')
  // Il riassunto della chip che dipende dalla vecchia si vede: stesso testo (con i titoli delle dipendenze) per generare e mostrare.
  expect(amb.modello.length).toBe(1)
  expect(amb.modello[0]!.prompt).toContain('Depends on: Base vecchia')
  expect(html).toContain('Riassunto d&#39;esempio.')
  await clock.advance(60_000)
  expect(amb.modello.length).toBe(1)
})

test('2.4: routing illeggibile: la board resta accesa dal config e mostra i blocchi d\'avvio', async ($, on) => {
  const amb = ambiente(on)
  amb.disco.delete('X:/repo/.claude/routing.json')
  conBoard(amb, { modo: 'accesa', generazione: 1 })
  scriviAzione(amb, 'a-rou00001', { titolo: 'Senza regole' })
  const clock = mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await clock.advance(30_000)
  const html = amb.disco.get(INDICE)!
  expect(html).toContain('Senza regole')
  expect(html).toContain('routing.json non letto')
})

test('2.4: routing illeggibile: board scritta, ma nessun riassunto (nessuna chiamata al modello)', async ($, on) => {
  const amb = ambiente(on)
  amb.disco.delete('X:/repo/.claude/routing.json')
  conBoard(amb, { modo: 'riassunti', generazione: 1 })
  scriviAzione(amb, 'a-rou00002', { titolo: 'Senza regole, senza riassunti' })
  const clock = mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  for (let i = 0; i < 3; i++) await clock.advance(60_000)
  expect(amb.disco.get(INDICE)).toContain('Senza regole, senza riassunti')
  expect(amb.modello.length).toBe(0)
})

// --- 2.3.1: nelle viste operative solo i limiti configurati ---------------------------------------------

const RIGA = (id: string, fornitore: Limite['fornitore'], nome: string, extra: Partial<Limite> = {}): Limite => ({ id, fornitore, nome, fonte: 'prova', ...extra })
const RISPOSTA = (limiti: unknown) => ({ limiti, proxy: 'non abilitato', chiavi: { anthropic: false, deepseek: false, freellmapi: false } })

test('2.3.1: ultime misure e fornitori visibili: solo ammessi con una misura o un limite manuale', () => {
  const misura = RIGA('claude-weekly', 'claude', 'Claude piano · settimanale', { percentuale: 40, unita: '%', letto: LIMITE.letto })
  const errore = RIGA('codex', 'codex', 'Codex piano', { errore: 'fonte non disponibile' })
  const ultime = conUltime({}, [misura, errore, { ...misura, id: 'manuale-x', manuale: true }])
  expect(Object.keys(ultime)).toEqual(['claude-weekly'])
  // Un giro senza dati, o con il solo errore, non cancella l'ultima misura.
  expect(conUltime(ultime, [])).toEqual(ultime)
  expect(conUltime(ultime, [{ ...errore, id: 'claude-weekly', fornitore: 'claude' }])).toEqual(ultime)
  expect(conUltime(ultime, [{ ...misura, percentuale: 55 }])['claude-weekly']!.percentuale).toBe(55)
  // Una lettura riuscita che non riporta più un id lo toglie (uso extra disattivato al 99%); la spesa API è un gruppo a sé.
  const extra = RIGA('claude-extra', 'claude', 'Claude uso extra', { percentuale: 99, unita: '%', letto: LIMITE.letto })
  const conExtra = conUltime(ultime, [misura, extra])
  expect(Object.keys(conUltime(conExtra, [misura]))).toEqual(['claude-weekly'])
  expect(Object.keys(conUltime(conExtra, [RIGA('claude-api', 'claude', 'Claude API', { valore: 3, unita: 'USD', letto: LIMITE.letto })])))
    .toEqual(['claude-weekly', 'claude-extra', 'claude-api'])
  // La stessa finestra da un'altra fonte (status line al posto di get_usage) sostituisce la vecchia, non si somma.
  expect(Object.keys(conUltime(conExtra, [{ ...misura, id: 'claude-five_hour', fonte: 'status line' }]))).toEqual(['claude-five_hour'])
  // Una lettura fallita di un gruppo non tocca gli altri.
  expect(conUltime(conExtra, [errore, { ...errore, id: 'claude', fornitore: 'claude' }])).toEqual(conExtra)
  // Un gruppo letto con esito positivo ma senza misure svuota le sue; la spesa API resta.
  const conApi = conUltime(conExtra, [RIGA('claude-api', 'claude', 'Claude API', { valore: 3, unita: 'USD', letto: LIMITE.letto })])
  expect(Object.keys(conUltime(conApi, [], ['claude']))).toEqual(['claude-api'])
  expect(fornitoriVisibili(RISORSE_DEFAULT, ultime)).toEqual(['claude'])
  expect(fornitoriVisibili({ ...RISORSE_DEFAULT, fornitori: ['codex'] }, ultime)).toEqual([])
  const manuale = RIGA('manuale-budget', 'deepseek', 'Budget', { valore: 10, unita: 'USD', letto: LIMITE.letto, manuale: true })
  expect(fornitoriVisibili({ ...RISORSE_DEFAULT, fornitori: ['claude', 'deepseek'], limitiManuali: [manuale] }, {})).toEqual(['deepseek'])
})

test('2.3.1: un fornitore misurato, uno vietato con misura: Carico e sintesi mostrano solo il primo', async ($, on) => {
  const letto = new Date().toISOString()
  const amb = ambiente(on, {
    fonte: cmd => (cmd === 'limiti' ? RISPOSTA([
      RIGA('claude-weekly', 'claude', 'Claude piano · settimanale', { percentuale: 37, unita: '%', letto }),
      RIGA('codex-primary', 'codex', 'Codex piano · primaria', { percentuale: 95, unita: '%', letto }),
      RIGA('claude-api', 'claude', 'Claude API', { errore: 'chiave admin mancante' }),
      RIGA('deepseek', 'deepseek', 'DeepSeek saldo', { errore: 'rete non abilitata' }),
      RIGA('freellmapi', 'freellmapi', 'FreeLLMAPI', { errore: 'non abilitato' }),
    ]) : undefined),
  })
  amb.disco.set('X:/casa/.claude/chipmanager/config.json', JSON.stringify({ progetti: { 'acme/progetto': { fornitori: ['claude'] } } }))
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await $.ui.mount({ ...PANE(surface) })
    expect(await ui.find({ type: 'Text', text: /Claude 37%/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Codex 95%|non letti/ })).toBeUndefined()
    await ui.press({ key: 'vista-carico' })
    expect(await ui.find({ type: 'Text', text: /Claude piano · settimanale: 37% usato/ })).toBeDefined()
    // F9.4 supera F5.2 per il solo desktop: barra a blocchi nel terminale, barra a Box sul desktop con il valore accanto.
    expect(await ui.find({ type: 'Text', text: surface === 'terminal' ? /^▕.+▏ 37% usato$/ : /^ ?37% usato$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /non disponibile|FreeLLMAPI|Claude API|DeepSeek|Codex piano|Codex \(95%\)|Nessun limite collegato/ })).toBeUndefined()
    // Impostazioni resta il posto dove si vedono tutti i fornitori e, per gli ammessi, gli errori delle sonde.
    await ui.press({ key: 'impostazioni' })
    expect(await ui.find({ key: 'fornitore-codex' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^Claude: Claude piano · settimanale · letto 0 min fa · Claude API · chiave admin mancante$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^(Codex|DeepSeek|FreeLLMAPI): / })).toBeUndefined()
    await ui.press({ key: 'vista-lavoro' })
    await ui.unmount()
  }
})

test('2.3.1: giro fallito dopo uno riuscito: la misura resta; a fonte sempre guasta invecchia senza barra, in grigio e con un segno nella sintesi', async ($, on) => {
  let rotto = false
  const amb = ambiente(on, {
    fonte: cmd => (cmd !== 'limiti' ? undefined : rotto ? { limiti: 'formato cambiato' } : RISPOSTA([
      RIGA('claude-weekly', 'claude', 'Claude piano · settimanale', { percentuale: 37, unita: '%', letto: new Date().toISOString() }),
      RIGA('deepseek-saldo', 'deepseek', 'DeepSeek saldo', { valore: 12, unita: 'USD', letto: new Date().toISOString() }),
    ])),
  })
  amb.disco.set('X:/casa/.claude/chipmanager/config.json', JSON.stringify({ progetti: { 'acme/progetto': { fornitori: ['claude', 'codex', 'deepseek'] } } }))
  const clock = mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  rotto = true
  await clock.advance(300_000)
  const ui = await $.ui.mount({ ...PANE('terminal') })
  expect(await ui.find({ type: 'Text', text: /Claude 37%/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /non letti/ })).toBeUndefined()
  await ui.press({ key: 'vista-carico' })
  expect(await ui.find({ type: 'Text', text: /^Limiti non letti: helper non disponibile$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Claude piano · settimanale: 37% usato/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /DeepSeek saldo: 12 USD/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^▕.+▏ 37% usato$/ })).toBeDefined()
  await ui.press({ key: 'impostazioni' })
  expect(await ui.find({ type: 'Text', text: /^Claude: helper non disponibile$/ })).toBeDefined()
  await ui.press({ key: 'vista-lavoro' })
  await ui.unmount()

  // L'invecchiamento con la fonte sempre guasta. Il clock simulato muove $.clock e non Date (di sola lettura qui):
  // si prova con l'orologio iniettato nelle funzioni che il pannello usa per la sintesi e per le righe.
  const ora = Date.now()
  const lette = [
    RIGA('claude-weekly', 'claude', 'Claude piano · settimanale', { percentuale: 37, unita: '%', letto: new Date(ora).toISOString() }),
    RIGA('deepseek-saldo', 'deepseek', 'DeepSeek saldo', { valore: 12, unita: 'USD', letto: new Date(ora).toISOString() }),
  ]
  let ultime = conUltime({}, lette)
  for (const fallita of [[], [RIGA('claude', 'claude', 'Claude piano', { errore: 'limiti di piano non leggibili ora' })], []]) ultime = conUltime(ultime, fallita)
  const dopo = ora + 7 * 60_000
  const tutte = Object.values(ultime)
  expect(tutte.map(l => l.id)).toEqual(['claude-weekly', 'deepseek-saldo'])
  expect([etaVecchie(tutte, 'claude', ora), etaVecchie(tutte, 'deepseek', ora)]).toEqual([undefined, undefined])
  expect([durata(etaVecchie(tutte, 'claude', dopo)!), durata(etaVecchie(tutte, 'deepseek', dopo)!), etaVecchie(tutte, 'codex', dopo)]).toEqual(['7 min', '7 min', undefined])
  expect(aspettoLimite(ultime['claude-weekly']!, ora)).toEqual({ fresco: true, barra: true, grigio: false })
  expect(aspettoLimite(ultime['claude-weekly']!, dopo)).toEqual({ fresco: false, barra: false, grigio: true })
  expect(aspettoLimite(ultime['deepseek-saldo']!, dopo)).toEqual({ fresco: false, barra: false, grigio: true })
  // Il manuale non invecchia come una misura: barra e colore restano.
  expect(aspettoLimite({ ...ultime['claude-weekly']!, manuale: true }, dopo)).toEqual({ fresco: false, barra: true, grigio: false })
})

const MALFORMATI: Record<string, unknown>[] = [
  { status: 'ok', windows: 'unrecognized' },
  { status: 'ok', windows: [{ label: 'Weekly · all models', percentUsed: 140 }] },
  { status: 'ok', windows: [], extraUsage: { enabled: true, percentUsed: 'molto' } },
]

test('2.3.1: un piano vuoto è valido solo con windows [] ed extra assente o spento', () => {
  expect(pianoVuoto({ plan: { status: 'ok', windows: [] } })).toBe(true)
  expect(pianoVuoto({ plan: { status: 'ok', windows: [], extraUsage: { enabled: false, percentUsed: 0 } } })).toBe(true)
  for (const piano of [...MALFORMATI, { status: 'unavailable', windows: [] }, { status: 'ok' }, { status: 'ok', windows: [], extraUsage: null }])
    expect(pianoVuoto({ plan: piano })).toBe(false)
  for (const rotto of [null, 'testo', {}, { plan: 'ok' }]) expect(pianoVuoto(rotto)).toBe(false)
})

test('2.3.1: piano letto senza finestre dopo l\'uso extra: l\'extra (in soldi) resta alle letture scartate ed esce subito quando è spento', async ($, on) => {
  let piano: Record<string, unknown> = { status: 'ok', plan: 'Esempio', windows: [], extraUsage: { enabled: true, percentUsed: 99, spent: '9.90', monthlyLimit: '10.00', currency: 'EUR' } }
  ambiente(on, { strumenti: ['mcp__ccd_session_mgmt__get_usage'],
    mcp: (_s, tool) => (tool === 'get_usage' ? { isError: false, content: [{ type: 'text', text: JSON.stringify({ plan: piano }) }] } : undefined) })
  const clock = mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  let ui = await $.ui.mount({ ...PANE('terminal') })
  // Un credito non è una quota: nessuna soglia, nessuna percentuale nella sintesi.
  expect(await ui.find({ type: 'Text', text: /Claude \d+%/ })).toBeUndefined()
  await ui.press({ key: 'vista-carico' })
  expect(await ui.find({ type: 'Text', text: /Claude uso extra: 9,9 EUR di 10 EUR$/ })).toBeDefined()
  await ui.unmount()
  // Risposte che il parser scarta (finestre malformate, percentuale non valida, extra non valido) valgono come lettura fallita: l'extra resta.
  for (const scartato of MALFORMATI) {
    piano = scartato
    await clock.advance(300_000)
    ui = await $.ui.mount({ ...PANE('terminal') })
    expect(await ui.find({ type: 'Text', text: /Claude uso extra: 9,9 EUR di 10 EUR$/ })).toBeDefined()
    await ui.unmount()
  }
  piano = { status: 'ok', plan: 'Esempio', windows: [], extraUsage: { enabled: false, percentUsed: 0, spent: '0.00', monthlyLimit: '10.00', currency: 'EUR' } }
  await clock.advance(300_000)
  ui = await $.ui.mount({ ...PANE('terminal') })
  expect(await ui.find({ type: 'Text', text: /Claude 99%|non letti/ })).toBeUndefined()
  await ui.press({ key: 'vista-carico' })
  expect(await ui.find({ type: 'Text', text: /Claude uso extra/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /^Nessun limite collegato · vai a Impostazioni$/ })).toBeDefined()
  await ui.press({ key: 'vista-lavoro' })
  await ui.unmount()
})

test('rilievo 2: due letture dei limiti sovrapposte: quella fallita non riporta indietro la misura appena arrivata', async ($, on) => {
  const codex = (percentuale: number) => ({ limiti: [{ id: 'codex-primary', fornitore: 'codex', nome: 'Codex piano · primaria', percentuale, unita: '%', letto: new Date().toISOString(), fonte: 'prova' }],
    proxy: 'non abilitato', chiavi: { anthropic: false, deepseek: false, freellmapi: false } })
  const guasta = { limiti: [{ id: 'codex', fornitore: 'codex', nome: 'Codex piano', fonte: 'prova', errore: 'non leggibile' }], proxy: 'non abilitato', chiavi: { anthropic: false, deepseek: false, freellmapi: false } }
  const risposte: unknown[] = [codex(10)]
  // Le due letture dei limiti partono insieme; la seconda (quella che fallisce) riprende `passo` microtask dopo la prima.
  // Si provano tutti gli sfasamenti: in uno di questi la seconda legge l'ultima misura prima che la prima la scriva.
  let insieme = false
  let passo = 0
  const ferme: (() => void)[] = []
  ambiente(on, {
    fonte: cmd => (cmd === 'limiti' ? (risposte.length > 1 ? risposte.shift() : risposte[0]) : undefined),
    attesa: cmd => (cmd !== 'limiti' || !insieme ? undefined : new Promise<void>(r => {
      ferme.push(r)
      if (ferme.length === 2) {
        insieme = false
        const [prima, seconda] = ferme.splice(0)
        prima!()
        void (async () => {
          for (let i = 0; i < passo; i++) await Promise.resolve()
          seconda!()
        })()
      }
    })),
  })
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  const altro = await $.ui.mount({ ...PANE('terminal') })
  await ui.press({ key: 'vista-carico' })
  const sbagliati: number[] = []
  for (passo = 0; passo <= 40; passo++) {
    risposte.splice(0, risposte.length, codex(10))
    await ui.press({ key: 'ricarica' })
    expect(await ui.find({ type: 'Text', text: /Codex piano · primaria: 10% usato/ })).toBeDefined()
    // La prima porta 80%, la seconda fallisce: la misura nuova deve restare.
    risposte.splice(0, risposte.length, codex(80), guasta, guasta)
    insieme = true
    await Promise.all([ui.press({ key: 'ricarica' }), altro.press({ key: 'ricarica' })])
    if (!(await ui.find({ type: 'Text', text: /Codex piano · primaria: 80% usato/ }))) sbagliati.push(passo)
  }
  expect(sbagliati).toEqual([])
  await altro.unmount()
  await ui.unmount()
})

// --- 2.4.2 sobrietà: cadenza a tempo simulato e contatori ---------------------------------------------------

test('cadenza: giro veloce solo con lavoro pendente; sessioni a 20 s solo a schermo, subito al ritorno', () => {
  let c = segnaLavori(CADENZA_INIZIALE, ['giro', 'sessioni', 'traguardi', 'risorse'], 0)
  const passo = (t: number, s: { pendente: boolean; aSchermo: boolean }) => {
    const r = passoCadenza(c, t, s)
    c = r.cadenza
    return r.fare
  }
  // Nascosto e a riposo: a 20 e 40 s niente; a 60 s il giro; a 120 s le sessioni (0,5/min).
  expect(passo(20_000, { pendente: false, aSchermo: false })).toEqual([])
  expect(passo(40_000, { pendente: false, aSchermo: false })).toEqual([])
  expect(passo(60_000, { pendente: false, aSchermo: false })).toEqual(['giro'])
  expect(passo(120_000, { pendente: false, aSchermo: false })).toEqual(['giro', 'sessioni'])
  // Compare lavoro pendente: il giro torna a 20 s; le sessioni restano lente finché non si è a schermo.
  expect(passo(140_000, { pendente: true, aSchermo: false })).toEqual(['giro'])
  // Torna a schermo: sessioni subito, poi ogni 20 s.
  expect(passo(160_000, { pendente: true, aSchermo: true })).toEqual(['giro', 'sessioni'])
  expect(passo(180_000, { pendente: true, aSchermo: true })).toEqual(['giro', 'sessioni'])
  // Il lavoro sparisce: giro a 60 s.
  expect(passo(200_000, { pendente: false, aSchermo: true })).toEqual(['sessioni'])
  expect(passo(240_000, { pendente: false, aSchermo: true })).toEqual(['giro', 'sessioni'])
  // Un battito in leggero anticipo vale.
  expect(passo(259_500, { pendente: false, aSchermo: true })).toEqual(['sessioni'])
  // Traguardi e risorse a 5 minuti.
  expect(passo(300_000, { pendente: false, aSchermo: true })).toEqual(['giro', 'sessioni', 'traguardi', 'risorse'])
})

test('R10: il giro veloce solo per accodata, in-avvio e avviata; proposte e consegnate non lo tengono a 20 s', () => {
  expect([...STATI_PENDENTI].sort()).toEqual(['accodata', 'avviata', 'in-avvio'])
})

test('R10: nessuna transizione automatica parte da una proposta: dieci minuti di giri e il record non cambia', async ($, on) => {
  const amb = ambiente(on)
  const clock = mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'Proposta ferma', brief: 'Resta proposta.' } as never)
  const prima = amb.azione()[0]!
  for (let i = 0; i < 30; i++) await clock.advance(20_000)
  expect(amb.azione()[0]).toEqual(prima)
})

test('R9: un tentativo che non è un gettone (../../outside) non si legge e non avvia processi', async ($, on) => {
  const amb = ambiente(on, { cli: true })
  const clock = mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  amb.disco.set('X:/orch/azioni/a-cli00009.json', JSON.stringify({ ...base('a-cli00009', 1, { repo: 'acme/progetto' }), stato: 'in-avvio', lanciatore: 'cli', tentativo: '../../outside', avvioScade: '2999-01-01T00:00:00.000Z' }))
  await clock.advance(20_000)
  await clock.advance(20_000)
  expect(amb.letti.filter(f => f.includes('outside'))).toEqual([])
  expect(amb.processi.filter(p => p.argv[2] === 'stato-cli')).toEqual([])
})

test('cadenza: dopo una sospensione un solo giro di recupero; dopo un errore si riprova alla cadenza normale', () => {
  let c = segnaLavori(CADENZA_INIZIALE, ['giro', 'sessioni', 'traguardi', 'risorse'], 0)
  // La macchina dorme un'ora: al risveglio ogni lavoro una volta, non uno per battito perso.
  let r = passoCadenza(c, 3_600_000, { pendente: true, aSchermo: true })
  expect(r.fare).toEqual(['giro', 'sessioni', 'traguardi', 'risorse'])
  c = r.cadenza
  r = passoCadenza(c, 3_600_500, { pendente: true, aSchermo: true })
  expect(r.fare).toEqual([])
  // Il lavoro è segnato quando parte: se fallisce, il battito dopo non lo ripete prima della sua cadenza.
  r = passoCadenza(r.cadenza, 3_610_000, { pendente: true, aSchermo: true })
  expect(r.fare).toEqual([])
  expect(passoCadenza(r.cadenza, 3_620_000, { pendente: true, aSchermo: true }).fare).toEqual(['giro', 'sessioni'])
  // Un orologio tornato indietro non blocca nulla.
  expect(passoCadenza(r.cadenza, 1_000, { pendente: false, aSchermo: false }).fare).toEqual(['giro', 'sessioni', 'traguardi', 'risorse'])
})

test('D6: processi per comando, con le classi di F5.3 (raccolta, orchestrazione, non classificati) nella stessa finestra', () => {
  // Le due classi sono elenchi chiusi (piano F5.3, giro 3); ogni altro comando è «non classificato», anche se somiglia.
  for (const c of ['limiti', 'sessioni', 'git-log', 'leggi-piano', 'board-scrivi', 'board-prenota', 'board-finalizza', 'git']) expect([c, classeProcesso(c)]).toEqual([c, 'raccolta'])
  for (const c of ['occupata', 'prenota', 'stato-cli', 'cas', 'configura', 'configura-utente', 'pesi-decidi', 'pesi-proponi', 'pesi-annulla', 'gh', 'explorer', 'apri', 'codex', 'lancia-cli', 'esegui-cli'])
    expect([c, classeProcesso(c)]).toEqual([c, 'orchestrazione'])
  for (const c of ['completa', 'docker', 'qualcosa', 'board-spegni', 'board-altro', 'pesi-altro', 'corsia-codex', 'configura-altro'])
    expect([c, classeProcesso(c)]).toEqual([c, 'altri'])
  let secchi = contaConsumo([], 0, { processi: 1 }, 'gh')
  secchi = contaConsumo(secchi, 60_000, { processi: 4 }, 'git')
  secchi = contaConsumo(secchi, 61_000, { processi: 1 }, 'git-log')
  secchi = contaConsumo(secchi, 62_000, { processi: 1 }, 'docker')
  const tot = sommaSecchi(secchi, 120_000, 0)
  expect(tot.comandi).toEqual({ gh: 1, git: 4, 'git-log': 1, docker: 1 })
  expect(classiDi(tot.comandi)).toEqual({ raccolta: 5, orchestrazione: 1, altri: 1 })
  // Al più 20 chiavi: le altre si sommano in «altro», che resta non classificato.
  let molti = contaConsumo([], 0, {})
  for (let i = 0; i < 30; i++) molti = contaConsumo(molti, 0, { processi: 1 }, `comando-${i}`)
  const somma = sommaSecchi(molti, 0, 0)
  expect(Object.keys(somma.comandi ?? {}).length).toBeLessThanOrEqual(21)
  expect(Object.values(somma.comandi ?? {}).reduce((a, b) => a + b, 0)).toBe(30)
  // «Non classificati» compare anche a zero.
  expect(rigaConsumo({ processi: 0, app: 0, byte: 0, byteLimiti: 0, salti: 0, comandi: {}, da: 0 }, 60_000)).toContain('unclassified 0')
})

test('consumo: finestra mobile di 10 minuti a secchi, memoria limitata; diagnostica dell’helper validata', () => {
  let secchi = contaConsumo([], 0, { processi: 1 })
  for (let m = 1; m <= 30; m++) secchi = contaConsumo(secchi, m * 60_000, { processi: 2, app: 1, byte: 1000, salti: 0 })
  expect(secchi.length).toBeLessThanOrEqual(10)
  const tot = sommaSecchi(secchi, 30 * 60_000, 0)
  expect(tot).toEqual({ processi: 20, app: 10, byte: 10_000, byteLimiti: 0, salti: 0, comandi: {}, da: 20 * 60_000 })
  expect(sommaSecchi(secchi, 60 * 60_000, 0).processi).toBe(0)
  expect(diagnosticaHelper({ diagnostica: { byte: 5, byteLimiti: 2, salti: 1, testo: 'x' } })).toEqual({ byte: 5, byteLimiti: 2, salti: 1 })
  expect(diagnosticaHelper({ diagnostica: { byte: '5', salti: -1 } })).toEqual({ byte: 0, byteLimiti: 0, salti: 0 })
  expect(diagnosticaHelper([])).toEqual({})
})

test('battito: pannello nascosto e niente da fare = sessioni ogni 2 minuti, giro ogni 60 s, mai la corsia Codex', async ($, on) => {
  const amb = ambiente(on, { nascosto: true })
  const clock = mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const sessioni = () => amb.processi.filter(x => x.argv[1]?.endsWith('/fornitori.cjs') && x.argv[2] === 'sessioni').length
  const giri = () => amb.letti.filter(f => f.endsWith('/registro.json')).length
  amb.disco.set('X:/orch/registro.json', '{"task":[],"prova":"nascosto"}')
  const visti: number[][] = []
  for (let i = 0; i < 5; i++) {
    await clock.advance(20_000)
    visti.push([sessioni(), giri()])
  }
  // Fino a 100 s: una sola lettura delle sessioni (quella dell'apertura) e un solo giro (al primo battito).
  expect(visti).toEqual([[1, 1], [1, 1], [1, 1], [1, 1], [1, 1]])
  await clock.advance(20_000)
  expect(sessioni()).toBe(2)
  // A 120 s il secondo giro (60 s dopo il primo), con registro.json invariato: non si rilegge.
  expect(giri()).toBe(1)
  expect(amb.processi.some(x => x.argv.includes('occupata'))).toBe(false)
})

test('battito: con lavoro pendente il giro resta a 20 s; si rileggono solo i record e il registro cambiati', async ($, on) => {
  const amb = ambiente(on)
  const clock = mock.clock(on)
  // Un avvio in attesa di risposta: lavoro pendente (R10), il giro resta a 20 s senza cambiare i record.
  const inAvvio = { stato: 'in-avvio' as const, tentativo: 'az-attesa001', avvioScade: '2999-01-01T00:00:00.000Z', lanciataDa: 'altra-sessione' }
  const uno = base('a-uno0001', 1, { repo: 'acme/progetto', ...inAvvio })
  amb.disco.set('X:/orch/azioni/a-uno0001.json', JSON.stringify(uno))
  amb.disco.set('X:/orch/azioni/a-due0001.json', JSON.stringify(base('a-due0001', 2, { repo: 'acme/progetto', ...inAvvio })))
  amb.disco.set('X:/orch/registro.json', '{"task":[]}')
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await clock.advance(20_000)
  const record = () => amb.letti.filter(f => f.startsWith('X:/orch/azioni/a-'))
  const registro = () => amb.letti.filter(f => f.endsWith('/registro.json')).length
  const prima = { record: record().length, registro: registro() }
  await clock.advance(20_000)
  // Nessun file cambiato: nessuna rilettura, ma il giro c'è stato (avvii in attesa = lavoro pendente).
  expect(record().length).toBe(prima.record)
  expect(registro()).toBe(prima.registro)
  amb.disco.set('X:/orch/azioni/a-uno0001.json', JSON.stringify({ ...uno, versione: 1, titolo: 'Titolo cambiato altrove' }))
  amb.disco.set('X:/orch/registro.json', '{"task":[],"nota":"cambiato"}')
  await clock.advance(20_000)
  expect(record().slice(prima.record)).toEqual(['X:/orch/azioni/a-uno0001.json'])
  expect(registro()).toBe(prima.registro + 1)
  // Chip Claude soltanto: la corsia Codex non si interroga.
  expect(amb.processi.some(x => x.argv.includes('occupata'))).toBe(false)
})

test('strumenti: descrizioni brevi (tetto in caratteri, non token); risorse_agenti differito, suggerisci_azione no', async ($, on) => {
  const amb = ambiente(on)
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const caratteri = (nome: string) => {
    const t = amb.registrati.find(x => x.name === nome)!
    const props = Object.values((t.inputSchema as { properties?: Record<string, { description?: string }> }).properties ?? {})
    return t.description.length + props.reduce((n, p) => n + (p.description?.length ?? 0), 0)
  }
  // 2.4.0: 2021 e 435 caratteri (descrizione dello strumento più quelle delle proprietà), con il routing d'esempio.
  // 2.2.0 (UX agenti): +R0–R5 nella corsia e il link alla guida, unico strumento sempre caricato che li porta.
  expect(caratteri('suggerisci_azione')).toBeLessThanOrEqual(1450)
  expect(caratteri('risorse_agenti')).toBeLessThanOrEqual(250)
  expect(amb.registrati.find(x => x.name === 'risorse_agenti')!.isDeferred).toBe(true)
  expect(amb.registrati.find(x => x.name === 'suggerisci_azione')!.isDeferred).toBe(false)
  // F4: proporre pesi è raro, quindi differito e corto.
  expect(caratteri('proponi_pesi')).toBeLessThanOrEqual(400)
  expect(amb.registrati.find(x => x.name === 'proponi_pesi')!.isDeferred).toBe(true)
  // F7.1: proporre impostazioni è ancora più raro (solo su indicazione dell'utente): differito e corto.
  expect(caratteri('proponi_impostazioni')).toBeLessThanOrEqual(600)
  expect(amb.registrati.find(x => x.name === 'proponi_impostazioni')!.isDeferred).toBe(true)
  // Anche la 2.4.0 ha la proprietà piano.
  expect(Object.keys((amb.registrati.find(x => x.name === 'suggerisci_azione')!.inputSchema as { properties: object }).properties)).toContain('piano')
})

// Banco D7: 10 minuti simulati per pannello. Raccolta = helper fornitori (sessioni e limiti); orchestrazione = disco.cjs;
// gh a parte. I tetti sono quelli del piano: 0,7 processi/min a riposo e nascosto, 3,2/min a schermo (raccolta).
const banco = async ($: Parameters<TestBody>[0], on: Parameters<TestBody>[1], opz: { nascosto: boolean; pendente: boolean }) => {
  // Ogni lettura delle sessioni risponde un dato diverso (il ramo porta il numero della lettura) e ogni lettura dei
  // limiti una percentuale diversa: così il banco vede che le raccolte avvengono E che i dati arrivano nel pannello.
  let letture = 0
  let misure = 0
  const amb = ambiente(on, {
    nascosto: opz.nascosto,
    fonte: cmd => cmd === 'sessioni'
      ? { sessioni: [{ id: 'esempio-0007', cwd: 'X:/repo/.claude/worktrees/banco', ramo: `banco-${++letture}`, stato: 'chiuso', inCorso: false, attivita: new Date(Date.now() - 60_000).toISOString() }] }
      : cmd === 'limiti'
        ? { limiti: [{ id: 'codex-primary', fornitore: 'codex', nome: 'Codex piano · primaria', percentuale: 10 + ++misure, unita: '%', letto: new Date().toISOString(), fonte: 'banco' }], proxy: 'non abilitato', chiavi: { anthropic: false, deepseek: false, freellmapi: false } }
        : undefined,
  })
  const clock = mock.clock(on)
  if (opz.pendente) amb.disco.set('X:/orch/azioni/a-banco001.json', JSON.stringify(base('a-banco001', 1, { repo: 'acme/progetto', stato: 'avviata', sessione: SID, tentativo: 'az-banco' })))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await clock.advance(1)
  const n0 = amb.processi.length
  const c0 = amb.chiamate.length
  for (let i = 0; i < 30; i++) await clock.advance(20_000)
  const dopo = amb.processi.slice(n0)
  const conta = (f: (a: readonly string[]) => boolean) => dopo.filter(x => f(x.argv)).length
  const ui = await $.ui.mount({ ...PANE('desktop') })
  const ultimaSessione = !!(await ui.find({ type: 'Text', text: new RegExp(`^Codex · banco-${letture}$`) }))
  await ui.press({ key: 'vista-carico' })
  const ultimaMisura = !!(await ui.find({ type: 'Text', text: new RegExp(`Codex piano · primaria: ${10 + misure}% usato`) }))
  await ui.unmount()
  return {
    sessioni: conta(a => !!a[1]?.endsWith('/fornitori.cjs') && a[2] === 'sessioni'),
    limiti: conta(a => !!a[1]?.endsWith('/fornitori.cjs') && a[2] === 'limiti'),
    orchestrazione: conta(a => !!a[1]?.endsWith('/disco.cjs')),
    gh: conta(a => a[0] === 'gh'),
    app: amb.chiamate.length - c0,
    ultimaSessione,
    ultimaMisura,
  }
}

test('banco D7: a riposo e nascosto, raccolta a 0,7 processi/min e dati aggiornati', async ($, on) => {
  const m = await banco($, on, { nascosto: true, pendente: false })
  // 10 minuti: sessioni ogni 2 minuti (5), limiti ogni 5 (2) = 7 processi di raccolta, nessuno di orchestrazione.
  expect(m).toMatchObject({ sessioni: 5, limiti: 2, orchestrazione: 0, ultimaSessione: true, ultimaMisura: true })
})

test('banco D7: a schermo con lavoro in corso, raccolta a 3,2 processi/min e dati aggiornati', async ($, on) => {
  const m = await banco($, on, { nascosto: false, pendente: true })
  // Sessioni ogni 20 s (30) e limiti ogni 5 minuti (2) = 32; l'azione in corso è Claude: la corsia Codex non si guarda.
  expect(m).toMatchObject({ sessioni: 30, limiti: 2, orchestrazione: 0, ultimaSessione: true, ultimaMisura: true })
})

test('consumo: riga grigia della sessione; lo stato Codex ignoto non è in corso e si segna', () => {
  const c = { processi: 7, app: 1, byte: 3 * 1_048_576, byteLimiti: 1_048_576, salti: 2, da: 0 }
  expect(rigaConsumo(c, 10 * 60_000)).toBe('This session, last 10 minutes: 7 processes (collection 0 · orchestration 0 · unclassified 0) · 1 call to the app · 3.0 MB read by the Codex helper (1.0 MB for the limits) · 2 backlog skips')
  expect(rigaConsumo(c, 10 * 60_000, 'it')).toBe("Questa sessione, ultimi 10 minuti: 7 processi (raccolta 0 · orchestrazione 0 · non classificati 0) · 1 chiamata all'app · 3,0 MB letti dall'helper Codex (1,0 MB per i limiti) · 2 salti d'arretrato")
  expect(rigaConsumo({ ...c, byteLimiti: 0, salti: 1, processi: 1, comandi: { gh: 1 } }, 3 * 60_000, 'it')).toBe("Questa sessione, ultimi 3 min: 1 processo (raccolta 0 · orchestrazione 1 · non classificati 0) · 1 chiamata all'app · 3,0 MB letti dall'helper Codex · 1 salto d'arretrato")
  const adesso = Date.parse('2026-11-05T12:00:00Z')
  const s = (stato: string, inCorso: boolean) => sessioniCodex([{ id: 'esempio-0001', cwd: 'X:/repo', attivita: '2026-11-05T11:59:00Z', stato, inCorso }], radiceProgetto('X:/repo'), adesso)[0]!
  expect(s('ignoto', false).stato).toBe('ignota')
  expect(s('chiuso', false).stato).toBe('ferma')
  expect(s('aperto', true)).toMatchObject({ stato: 'in-corso' })
})

test('vista Carico: in fondo la riga del consumo di questa sessione', async ($, on) => {
  ambiente(on)
  const clock = mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await clock.advance(20_000)
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: 'vista-carico' })
  expect((await ui.find({ type: 'Text', text: /^Questa sessione, ultimi/ }))?.text).toMatch(/process[oi] \(raccolta \d+ · orchestrazione \d+ · non classificati \d+\) · \d+ chiamat[ae] all'app · [\d,]+ MB letti dall'helper Codex/)
  await ui.unmount()
})

test('carica: dopo un conflitto il record si rilegge dal disco, anche se riscritto nello stesso istante con la stessa lunghezza', async ($, on) => {
  const amb = ambiente(on)
  const clock = mock.clock(on)
  const f = 'X:/orch/azioni/a-stesso01.json'
  const uno = base('a-stesso01', 1, { repo: 'acme/progetto', proponente: 'sessione-master', versione: 1 })
  amb.disco.set(f, JSON.stringify(uno))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await clock.advance(20_000)
  // Un'altra sessione la riscrive nello stesso istante: versione 2, stessa lunghezza, stessa data.
  const due = { ...uno, versione: 2 }
  expect(JSON.stringify(due).length).toBe(JSON.stringify(uno).length)
  amb.disco.stessoIstante(f, JSON.stringify(due))
  const elenchi = amb.elenchi.length
  const r = await $.tool.call({ tool: 'mcp__chip-manager__aggiorna_azione', id: 'a-stesso01', stato: 'scartata' } as never)
  expect((r as { deny?: unknown }).deny).toBeUndefined()
  expect(JSON.parse(amb.disco.get(f)!)).toMatchObject({ stato: 'scartata', versione: 3 })
  // Dopo il conflitto si rilegge solo il proprio file: la cartella si elenca una volta (la lettura iniziale), non due.
  expect(amb.elenchi.slice(elenchi).filter(d => d === 'X:/orch/azioni').length).toBe(1)
})

test('carica: una riscrittura nello stesso istante si vede al più alla rilettura completa dei 5 minuti', async ($, on) => {
  const amb = ambiente(on)
  const clock = mock.clock(on)
  const f = 'X:/orch/azioni/a-stesso02.json'
  const uno = base('a-stesso02', 1, { repo: 'acme/progetto', versione: 1 })
  amb.disco.set(f, JSON.stringify(uno))
  amb.disco.set('X:/orch/registro.json', '{"task":[],"prova":"stesso-istante"}')
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await clock.advance(20_000)
  amb.disco.stessoIstante(f, JSON.stringify({ ...uno, versione: 2 }))
  amb.disco.stessoIstante('X:/orch/registro.json', '{"task":[],"prova":"stesso-istant2"}')
  const letture = (x: string) => amb.letti.filter(y => y === x).length
  const n = [letture(f), letture('X:/orch/registro.json')]
  await clock.advance(20_000)
  expect([letture(f), letture('X:/orch/registro.json')]).toEqual(n)
  await clock.advance(300_000)
  expect(letture(f)).toBeGreaterThan(n[0]!)
  expect(letture('X:/orch/registro.json')).toBeGreaterThan(n[1]!)
})

test('battito: una coda comparsa da fuori si vede al battito dopo, non al giro lento di 60 s', async ($, on) => {
  const amb = ambiente(on, { nascosto: true })
  const clock = mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await clock.advance(20_000)
  // Un'altra sessione mette in coda un'azione: niente era pendente, il giro era passato a 60 s.
  amb.disco.set('X:/orch/azioni/a-fuori001.json', JSON.stringify(base('a-fuori001', 1, { repo: 'acme/progetto', stato: 'accodata' })))
  await clock.advance(20_000)
  expect(amb.chiamate.filter(c => c.tool === 'start_session').length).toBe(1)
})

test('battito: un lavoro che fallisce si riprova alla sua cadenza, senza ripetizioni ravvicinate', async ($, on) => {
  const amb = ambiente(on, {
    fonte: cmd => {
      throw new Error(`${cmd} non disponibile`)
    },
  })
  const clock = mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const conta = (cmd: string) => amb.processi.filter(x => x.argv[1]?.endsWith('/fornitori.cjs') && x.argv[2] === cmd).length
  await clock.advance(1)
  const [s0, l0] = [conta('sessioni'), conta('limiti')]
  for (let i = 0; i < 18; i++) await clock.advance(20_000)
  // A schermo: sessioni ogni 20 s anche se falliscono (18 battiti = 18 tentativi); limiti una volta in 6 minuti.
  expect(conta('sessioni') - s0).toBe(18)
  expect(conta('limiti') - l0).toBe(1)
})

test('corsia Codex: interrogata solo se pianifica avvierebbe davvero un\'azione Codex (non per una bloccata da dipendenze)', async ($, on) => {
  const amb = ambiente(on)
  const clock = mock.clock(on)
  const codex = { repo: 'acme/progetto', stato: 'accodata' as const, esecutore: 'codex' as const, revisore: 'claude' as const, modello: 'gpt-6-astra', corsia: 'R2' as const }
  amb.disco.set('X:/orch/azioni/a-prima001.json', JSON.stringify(base('a-prima001', 1, { repo: 'acme/progetto', stato: 'avviata', sessione: SID, tentativo: 'az-prima' })))
  amb.disco.set('X:/orch/azioni/a-codex001.json', JSON.stringify(base('a-codex001', 2, { ...codex, dipende: ['a-prima001'] })))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  for (let i = 0; i < 3; i++) await clock.advance(20_000)
  const occupata = () => amb.processi.filter(x => x.argv.includes('occupata')).length
  expect(occupata()).toBe(0)
  // Senza la dipendenza parte: la corsia si guarda una volta per il piano e poi nella decisione.
  amb.disco.set('X:/orch/azioni/a-codex002.json', JSON.stringify(base('a-codex002', 3, codex)))
  await clock.advance(20_000)
  expect(occupata()).toBeGreaterThan(0)
  expect(['in-avvio', 'avviata']).toContain(amb.azione().find(a => a.id === 'a-codex002')?.stato)
})

test('sessioni: una sessione Codex con stato ignoto mostra «—», né in corso né ferma, e non conta fra quelle al lavoro', async ($, on) => {
  const clock = mock.clock(on)
  ambiente(on, {
    fonte: cmd => (cmd === 'sessioni'
      ? { sessioni: [{ id: 'esempio-0009', cwd: 'X:/repo/.claude/worktrees/ramo-ignoto', ramo: 'ramo-ignoto', stato: 'ignoto', inCorso: false, attivita: new Date(Date.now() - 60_000).toISOString() }] }
      : undefined),
  })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await clock.advance(20_000)
  const ui = await $.ui.mount({ ...PANE('desktop') })
  expect(await ui.find({ type: 'Text', text: /^Codex · ramo-ignoto$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^○ —$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^1 al lavoro/ })).toBeDefined()
  await ui.unmount()
})

test('R1: board accesa: git-log al più ogni 5 minuti, subito se cambiano le azioni o il registro', async ($, on) => {
  const amb = ambiente(on)
  conBoard(amb, { modo: 'accesa', generazione: 1 })
  const clock = mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'Docs', brief: 'Aggiorna il README.' } as never)
  const gitLog = () => comandi(amb).filter(c => c === 'git-log').length
  await clock.advance(30_000)
  const primo = gitLog()
  expect(primo).toBeGreaterThan(0)
  // Due minuti senza cambiamenti: nessun git-log in più.
  for (let i = 0; i < 4; i++) await clock.advance(30_000)
  expect(gitLog()).toBe(primo)
  // Una chip cambiata: subito.
  const a = amb.azione()[0]!
  amb.disco.set(`X:/orch/azioni/${a.id}.json`, JSON.stringify({ ...a, versione: a.versione + 1, titolo: 'Docs aggiornate' }))
  await clock.advance(30_000)
  await clock.advance(30_000)
  expect(gitLog()).toBe(primo + 1)
  // Il registro cambiato: subito.
  amb.disco.set('X:/orch/registro.json', JSON.stringify({ task: {} }))
  await clock.advance(30_000)
  expect(gitLog()).toBe(primo + 2)
  // Cinque minuti dopo l'ultima lettura: di nuovo, anche senza cambiamenti.
  for (let i = 0; i < 10; i++) await clock.advance(30_000)
  expect(gitLog()).toBe(primo + 3)
})

test('R4: il giro riusa le azioni lette dal battito: una sola lettura della cartella per battito', async ($, on) => {
  const amb = ambiente(on)
  const clock = mock.clock(on)
  amb.disco.set('X:/orch/azioni/a-avv00099.json', JSON.stringify(base('a-avv00099', 1, { repo: 'acme/progetto', stato: 'in-avvio', tentativo: 'az-attesa002', avvioScade: '2999-01-01T00:00:00.000Z', lanciataDa: 'altra' })))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await clock.advance(20_000)
  const prima = amb.elenchi.filter(d => d === 'X:/orch/azioni').length
  await clock.advance(20_000)
  // Un battito con il giro dovuto: la cartella si elenca una volta, non due.
  expect(amb.elenchi.filter(d => d === 'X:/orch/azioni').length - prima).toBe(1)
})

test('R5: elenco degli strumenti e get_session di questa sessione in cache durante i giri; prima di un avvio si rileggono', async ($, on) => {
  const amb = ambiente(on)
  const clock = mock.clock(on)
  amb.disco.set('X:/orch/azioni/a-avv00098.json', JSON.stringify(base('a-avv00098', 1, { repo: 'acme/progetto', stato: 'in-avvio', tentativo: 'az-attesa003', avvioScade: '2999-01-01T00:00:00.000Z', lanciataDa: 'altra' })))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const self = () => amb.chiamate.filter(c => c.tool === 'get_session' && (c.args as { session_id?: string }).session_id === 'self').length
  const [l0, s0] = [amb.elenchiStrumenti.length, self()]
  // Cinque minuti di giri a 20 s (15 giri): get_session self al più una volta al minuto, l'elenco degli strumenti al più ogni 10 minuti.
  for (let i = 0; i < 15; i++) await clock.advance(20_000)
  expect(self() - s0).toBeLessThanOrEqual(6)
  expect(amb.elenchiStrumenti.length - l0).toBeLessThanOrEqual(1)
  // Un avvio rilegge subito chi avvia e la sua capacità.
  await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'Nuova', brief: 'Da avviare.' } as never)
  const nuova = amb.azione().find(a => a.titolo === 'Nuova')!
  const [l1, s1] = [amb.elenchiStrumenti.length, self()]
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: `avvia-${nuova.id}` })
  expect(self()).toBeGreaterThan(s1)
  expect(amb.elenchiStrumenti.length).toBeGreaterThan(l1)
  await ui.unmount()
})

test('R11: sessioni Codex dall\'istantanea se ha al più 20 s, senza helper; vecchia o rotta, l\'helper come oggi', async ($, on) => {
  const clock = mock.clock(on)
  const amb = ambienteSessioni(on, () => Date.now())
  const ISTANTANEA = 'X:/casa/.claude/chipmanager/cache/sessioni.json'
  const sessione = { id: 'istantanea-01', cwd: 'X:/repo/.claude/worktrees/da-istantanea', ramo: 'da-istantanea', modello: 'gpt-6-astra', effort: 'high', stato: 'aperto', inCorso: true, attivita: new Date().toISOString() }
  amb.disco.set(ISTANTANEA, JSON.stringify({ v: 1, istante: new Date().toISOString(), sessioni: [sessione], diagnostica: { byte: 1 } }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const helperSessioni = () => amb.processi.filter(p => p.argv[2] === 'sessioni').length
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: 'ricarica' })
  expect(await ui.find({ type: 'Text', text: /^Codex · da-istantanea$/ })).toBeDefined()
  expect(helperSessioni()).toBe(0)
  // Vecchia di un minuto: si avvia l'helper.
  amb.disco.set(ISTANTANEA, JSON.stringify({ v: 1, istante: new Date(Date.now() - 60_000).toISOString(), sessioni: [sessione] }))
  await ui.press({ key: 'ricarica' })
  expect(helperSessioni()).toBe(1)
  // Versione sconosciuta o JSON rotto: l'helper.
  for (const rotta of [JSON.stringify({ v: 2, istante: new Date().toISOString(), sessioni: [sessione] }), '{"v":1,']) {
    amb.disco.set(ISTANTANEA, rotta)
    await ui.press({ key: 'ricarica' })
  }
  expect(helperSessioni()).toBe(3)
  await ui.unmount()
  void clock
})

test('R4: scrivi se cambia: uguaglianza sul JSON; il consumo si confronta senza `da`', () => {
  expect(uguale({ a: [1, 2] }, { a: [1, 2] })).toBe(true)
  expect(uguale({ a: [1, 2] }, { a: [2, 1] })).toBe(false)
  const c: Consumo = { processi: 3, app: 1, byte: 10, byteLimiti: 0, salti: 0, da: 1_000 }
  expect(consumoUguale(c, { ...c, da: 61_000 })).toBe(true)
  expect(consumoUguale(c, { ...c, processi: 4 })).toBe(false)
})

// --- F7.3: auditor (advisor) ---------------------------------------------------------------------------------------

test('F7.3 tabella: ogni coppia della documentazione, alias risolti, id ignoti mai scelti; separata dal rango dei modelli', () => {
  const ok = (esegue: string, auditor: string) => motivoAuditor(esegue, auditor) === undefined
  // Una riga per ogni modello che esegue, con un ammesso e un escluso che la distinguono dalla riga vicina.
  const casi: [string, string[], string[]][] = [
    ['claude-haiku-4-5', ['claude-fable-5', 'claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-5-5'], ['claude-haiku-4-5']],
    ['claude-sonnet-4-6', ['claude-sonnet-4-6', 'claude-opus-4-6', 'claude-haiku-5-5'], ['claude-haiku-4-5']],
    ['claude-opus-4-6', ['claude-fable-5-1', 'claude-opus-4-6', 'claude-sonnet-5', 'claude-haiku-5-5'], ['claude-sonnet-4-6']],
    ['claude-sonnet-5', ['claude-opus-4-7', 'claude-sonnet-5', 'claude-haiku-5-5'], ['claude-opus-4-6', 'claude-sonnet-4-6']],
    ['claude-haiku-5-5', ['claude-opus-4-8', 'claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-fable-5'], ['claude-opus-4-6']],
    ['claude-opus-4-7', ['claude-opus-4-7', 'claude-sonnet-5-5', 'claude-fable-5-1'], ['claude-sonnet-5', 'claude-haiku-5-5', 'claude-opus-4-6']],
    ['claude-opus-4-8', ['claude-opus-5-5', 'claude-sonnet-5-5'], ['claude-haiku-5-5']],
    ['claude-sonnet-5-5', ['claude-opus-5', 'claude-sonnet-5-5', 'claude-fable-5'], ['claude-opus-4-8', 'claude-sonnet-5', 'claude-haiku-5-5']],
    ['claude-opus-5', ['claude-opus-5', 'claude-opus-5-5', 'claude-fable-5-1'], ['claude-opus-4-8', 'claude-sonnet-5-5']],
    ['claude-opus-5-5', ['claude-opus-5', 'claude-fable-5'], ['claude-sonnet-5-5', 'claude-haiku-5-5']],
    ['claude-fable-5', ['claude-fable-5', 'claude-fable-5-1'], ['claude-opus-5-5']],
    ['claude-fable-5-1', ['claude-fable-5-1'], ['claude-fable-5', 'claude-opus-5-5']],
  ]
  for (const [esegue, si, no] of casi) {
    for (const x of si) expect([esegue, x, ok(esegue, x)]).toEqual([esegue, x, true])
    for (const x of no) expect([esegue, x, ok(esegue, x)]).toEqual([esegue, x, false])
  }
  expect([idAuditor('opus'), idAuditor('sonnet'), idAuditor('fable'), idAuditor('claude-opus-9'), idAuditor('haiku')]).toEqual(['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-fable-5-2', null, null])
  expect(motivoAuditor('claude-opus-5-5', 'claude-opus-9')?.k).toBe('au.ignoto')
  expect(motivoAuditor('claude-opus-9', 'fable')?.k).toBe('au.esecutoreIgnoto')
  expect(motivoAuditor('claude-opus-5-5', 'sonnet')?.k).toBe('au.coppia')
  expect(ADVISOR).toMatchObject({ fonte: 'https://code.claude.com/docs/en/advisor', letta: '2026-11-11' })
  // Il rango dei modelli non cambia: la tabella è a parte.
  expect([rangoModello('claude-sonnet-5-5'), rangoModello('claude-opus-5-5')]).toEqual([1, 2])
})

test('F7.3 guardia: auditor fuori tabella, su Codex o nel cloud blocca l\'avvio con il motivo; senza auditor niente cambia', () => {
  const RA: Regole = { ...R, chiaveApi: true, risorse: { ...R.risorse, apiClaude: { budgetUsd: 20, tetto: 2 } } }
  const a = base('a-aud00001', 1, { repo: AUTORE.repo!, revisore: 'claude', modello: 'claude-opus-5-5' })
  expect(violazioni({ ...a, auditor: 'fable' }, RA).map(m => m.k)).not.toContain('au.coppia')
  expect(violazioni({ ...a, auditor: 'sonnet' }, RA).map(m => m.k)).toContain('au.coppia')
  expect(violazioni({ ...a, auditor: 'gemini' }, RA).map(m => m.k)).toContain('au.ignoto')
  expect(violazioni({ ...a, esecutore: 'codex', modello: undefined, auditor: 'opus' }, RA).map(m => m.k)).toContain('au.soloClaude')
  expect(violazioni({ ...a, auditor: 'fable', destinazione: 'cloud' }, RA).map(m => m.k)).toContain('au.cloud')
  expect(statoAuditor({ ...a, auditor: 'fable' })).toBe('manuale')
  expect(statoAuditor({ ...a, auditor: 'fable', destinazione: 'api-claude' })).toBe('applicato')
  expect(statoAuditor({ ...a, auditor: 'fable', destinazione: 'api-claude', senzaAuditor: true })).toBe('senza')
  expect(statoAuditor(a)).toBeUndefined()
})

test('F7.3 avvio: --advisor solo per api-claude (alias risolto); le sessioni desktop non lo ricevono e nessun advisorModel si scrive', { options: { anthropicApiKey: CHIAVE_API } }, async ($, on) => {
  const ingressi: Record<string, unknown>[] = []
  const amb = ambiente(on, { api: (cmd, _a, stdin) => (cmd === 'lancia-api' ? (ingressi.push(JSON.parse(stdin!)), [0, '']) : undefined) })
  amb.disco.set(CONFIG, CONFIG_API)
  const api = { ...chipApi('a-audapi01'), auditor: 'fable' }
  const desk = base('a-auddsk01', 2, { repo: AUTORE.repo!, revisore: 'claude', auditor: 'opus' })
  for (const a of [api, desk]) amb.disco.set(`X:/orch/azioni/${a.id}.json`, JSON.stringify(a))
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: 'ricarica' })
  // La chip di sessione dice come attivarlo a mano, con «Copia», e che /advisor cambia il default di tutte le sessioni.
  expect(await ui.find({ type: 'Text', text: 'auditor: attivalo tu con /advisor opus in quella sessione' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^\/advisor cambia il tuo default per tutte le sessioni/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^Fable come auditor: su alcuni piani serve un consenso una tantum/ })).toBeDefined()
  await ui.press({ key: `avvia-${api.id}` })
  await ui.press({ key: `avvia-${desk.id}` })
  expect(ingressi).toHaveLength(1)
  // F13.1: l'alias «fable» della mod è Fable 5.2.
  expect(ingressi[0]).toMatchObject({ advisor: 'claude-fable-5-2' })
  expect(ingressi[0]).not.toHaveProperty('senzaAdvisor')
  const start = amb.chiamate.filter(c => c.tool === 'start_session')
  expect(start).toHaveLength(1)
  expect(JSON.stringify(start[0]!.args)).not.toMatch(/advisor/i)
  // Mai una scrittura di advisorModel: né nei file né negli helper.
  expect([...amb.disco.values()].some(v => v.includes('advisorModel'))).toBe(false)
  expect(amb.processi.some(p => (p.argv.join(' ') + (p.stdin ?? '')).includes('advisorModel'))).toBe(false)
  await ui.unmount()
})

test('F7.3 esito: advisor non disponibile dal supervisore; «Riavvia senza auditor» scrive con CAS e riparte senza advisor; bloccato se una fonte lo sovrascrive', { options: { anthropicApiKey: CHIAVE_API } }, async ($, on) => {
  const ingressi: Record<string, unknown>[] = []
  const amb = ambiente(on, { api: (cmd, _a, stdin) => (cmd === 'lancia-api' ? (ingressi.push(JSON.parse(stdin!)), [0, '']) : undefined) })
  amb.disco.set(CONFIG, CONFIG_API)
  const a = { ...chipApi('a-audesi01'), auditor: 'fable', stato: 'avviata' as const, lanciatore: 'api-claude' as const, tentativo: 'az-audesi01', avviataIl: '2026-11-06T10:00:00Z' }
  const b = { ...chipApi('a-audesi02'), ordine: 2, auditor: 'fable', stato: 'avviata' as const, lanciatore: 'api-claude' as const, tentativo: 'az-audesi02', avviataIl: '2026-11-06T10:00:00Z' }
  for (const x of [a, b]) amb.disco.set(`X:/orch/azioni/${x.id}.json`, JSON.stringify(x))
  const fallita = (t: string, id: string, senza: object) => JSON.stringify({ id, tentativo: t, stato: 'fallita', ramo: `chipmanager/${t}`, costo: null, advisorNonDisponibile: 'consenso',
    errore: 'advisor non disponibile: nessun lavoro fatto', advisor: { stato: 'applicato', modello: 'claude-fable-5-1' }, senzaAuditor: senza, stderr: 'testo che non entra' })
  amb.disco.set('X:/orch/azioni/esecuzioni/az-audesi01.json', fallita('az-audesi01', a.id, {}))
  amb.disco.set('X:/orch/azioni/esecuzioni/az-audesi02.json', fallita('az-audesi02', b.id, { bloccato: 'progetto' }))
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: 'ricarica' })
  const r = JSON.parse(amb.disco.get(`X:/orch/azioni/${a.id}.json`)!) as Azione & { stderr?: unknown }
  expect(r).toMatchObject({ stato: 'fallita', advisorNonDisponibile: 'consenso', advisorEsito: { stato: 'applicato', modello: 'claude-fable-5-1' }, erroreCodice: 'err.advisor.consenso' })
  expect(r.stderr).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /advisor non disponibile: Fable richiede il tuo consenso una tantum/ })).toBeDefined()
  expect(await ui.find({ key: `senza-auditor-${b.id}` })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /«Riavvia senza auditor» non è disponibile: Impostazioni del progetto imposta/ })).toBeDefined()
  await ui.press({ key: `senza-auditor-${a.id}` })
  expect(JSON.parse(amb.disco.get(`X:/orch/azioni/${a.id}.json`)!)).toMatchObject({ senzaAuditor: true, auditor: 'fable' })
  expect(ingressi.at(-1)).toMatchObject({ senzaAdvisor: true })
  expect(ingressi.at(-1)).not.toHaveProperty('advisor')
  await ui.unmount()
})

// --- F7.2: «Cambia» modello o effort di una sessione al lavoro --------------------------------------------------------

const STRUMENTI_CAMBIO = ['mcp__ccd_session_mgmt__set_session_model', 'mcp__ccd_session_mgmt__set_session_effort']
const alLavoro = (id: string, extra: Partial<Azione> = {}) => base(id, 1, {
  repo: AUTORE.repo!, revisore: 'nessuno', stato: 'avviata', sessione: SID, tentativo: `az-${id.slice(2)}`, lanciataDa: 'sessione-master',
  avviataIl: '2026-11-06T10:00:00Z', modello: 'claude-opus-5-5', effort: 'high', ...extra,
})
const finche = async (fatto: () => boolean, giri = 400) => {
  const dorme = (globalThis as unknown as { setTimeout: (f: () => void, ms: number) => void }).setTimeout
  for (let i = 0; i < giri && !fatto(); i++) await new Promise<void>(ok => dorme(ok, 5))
}
/** Risponde ai popup di «Cambia»; `prima` gira prima della risposta (per cambiare il mondo durante la conferma). */
const rispondiCambia = (on: Parameters<TestBody>[1], risposta: string | null, prima?: () => void) =>
  on('tool.call', { tool: 'AskUserQuestion' }, (_, e) => {
    prima?.()
    return risposta === null ? { deny: 'chiuso' } : { result: { questions: e.questions, answers: { [e.questions[0]!.question]: risposta } } }
  })

for (const [nome, strumenti, mod, eff] of [['senza strumenti', [], false, false], ['solo il modello', ['mcp__ccd_session_mgmt__set_session_model'], true, false]] as const)
  test(`F7.2 «Cambia» (${nome}): compare solo il cambio il cui strumento l'app espone; mai su una sessione avviata da un'altra`, async ($, on) => {
    const a = alLavoro('a-cmb00001')
    const altrui = alLavoro('a-cmb00002', { lanciataDa: 'altra-sessione', ordine: 2 })
    const amb = ambiente(on, { strumenti: [...strumenti] })
    for (const x of [a, altrui]) amb.disco.set(`X:/orch/azioni/${x.id}.json`, JSON.stringify(x))
    mock.clock(on)
    await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
    const ui = await $.ui.mount({ ...PANE('desktop') })
    await ui.press({ key: 'ricarica' })
    expect([!!(await ui.find({ key: `cambia-mod-${a.id}` })), !!(await ui.find({ key: `cambia-eff-${a.id}` }))]).toEqual([mod, eff])
    expect(await ui.find({ key: `cambia-mod-${altrui.id}` })).toBeUndefined()
    await ui.unmount()
  })

test('F7.2 «Cambia»: conferma rifiutata o obsoleta non chiama niente; un cambio sotto i minimi di corsia o che cambierebbe il revisore è rifiutato', async ($, on) => {
  const amb = ambiente(on, { strumenti: STRUMENTI_CAMBIO })
  // Una riga dei revisori anche per Sonnet: il revisore Claude di Opus è Fable, quello di Sonnet è Opus.
  amb.disco.set('X:/repo/.claude/routing.json', JSON.stringify({ ...ROUTING, revisione: { ...ROUTING.revisione,
    revisori_ammessi_per_autore: { ...ROUTING.revisione.revisori_ammessi_per_autore, 'claude-sonnet-5-5': ['claude-opus-5-5', 'motore:codex'] } } }))
  const a = alLavoro('a-cmb00003')
  const r4 = alLavoro('a-cmb00004', { ordine: 2, corsia: 'R4', tentativo: 'az-cmb00004' })
  const rev = alLavoro('a-cmb00005', { ordine: 3, revisore: 'claude', tentativo: 'az-cmb00005' })
  for (const x of [a, r4, rev]) amb.disco.set(`X:/orch/azioni/${x.id}.json`, JSON.stringify(x))
  let risposta: string | null = null
  let prima: (() => void) | undefined
  let domande = 0
  on('tool.call', { tool: 'AskUserQuestion' }, (_, e) => {
    domande++
    prima?.()
    return risposta === null ? { deny: 'chiuso' } : { result: { questions: e.questions, answers: { [e.questions[0]!.question]: risposta } } }
  })
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: 'ricarica' })
  const set = () => amb.chiamate.filter(c => /^set_session_/.test(c.tool))
  /** Aspetta la domanda numero `n`, poi l'avviso del pannello che corrisponde a `re` (o un attimo, senza `re`). */
  const dopo = async (n: number, re?: RegExp) => {
    await finche(() => domande >= n)
    for (let i = 0; i < 400; i++) {
      if (re ? await ui.find({ type: 'Text', text: re }) : i >= 20) break
      await finche(() => false, 1)
    }
  }
  // Popup chiuso: niente.
  await ui.select({ key: `cambia-eff-${a.id}`, value: 'xhigh' })
  await dopo(1)
  expect(set()).toEqual([])
  // R4: l'effort non scende sotto high.
  risposta = 'Cambia'
  await ui.select({ key: `cambia-eff-${r4.id}`, value: 'low' })
  await dopo(2, /effort/i)
  expect(set()).toEqual([])
  // Opus → Sonnet cambierebbe il revisore Claude del mandato (Fable → Opus): rifiutato.
  await ui.select({ key: `cambia-mod-${rev.id}`, value: 'claude-sonnet-5-5' })
  await dopo(3, /cambierebbe il revisore già indicato nel mandato/)
  expect(set()).toEqual([])
  expect(await ui.find({ type: 'Text', text: /cambierebbe il revisore già indicato nel mandato/ })).toBeDefined()
  // Confermato, ma intanto la sessione ha consegnato: la conferma è obsoleta.
  prima = () => amb.disco.set(`X:/orch/azioni/${a.id}.json`, JSON.stringify({ ...a, versione: 2, stato: 'consegnata' }))
  await ui.select({ key: `cambia-eff-${a.id}`, value: 'xhigh' })
  await dopo(4, /la sessione è finita o ha un tentativo nuovo/)
  expect(set()).toEqual([])
  expect(await ui.find({ type: 'Text', text: /la sessione è finita o ha un tentativo nuovo/ })).toBeDefined()
  await ui.unmount()
})

test('F7.2 «Cambia»: errore MCP = incerto, annotato, nessun nuovo tentativo; «Ricontrolla» trova il successo remoto; un cambio verificato si annota', async ($, on) => {
  let modelloRemoto = 'claude-opus-5-5'
  const amb = ambiente(on, {
    strumenti: STRUMENTI_CAMBIO,
    mcp: (_s, tool, args) => {
      const x = args as { session_id?: string; model?: string; effort?: string }
      if (tool === 'set_session_model') return { isError: true, content: [{ type: 'text', text: 'timeout' }] }
      if (tool === 'set_session_effort') return { isError: false, content: [{ type: 'text', text: 'ok' }] }
      if (tool === 'get_session' && x.session_id === SID) return { isError: false, content: [{ type: 'text', text: JSON.stringify({ model: modelloRemoto, effort: 'xhigh' }) }] }
      return undefined
    },
  })
  const a = alLavoro('a-cmb00006')
  amb.disco.set(`X:/orch/azioni/${a.id}.json`, JSON.stringify(a))
  rispondiCambia(on, 'Cambia')
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: 'ricarica' })
  const record = () => JSON.parse(amb.disco.get(`X:/orch/azioni/${a.id}.json`)!) as Azione
  await ui.select({ key: `cambia-mod-${a.id}`, value: 'claude-sonnet-5-5' })
  await finche(() => !!record().cambio)
  expect(record()).toMatchObject({ modello: 'claude-opus-5-5', cambio: { campo: 'modello', valore: 'claude-sonnet-5-5', esito: 'incerto' } })
  expect(amb.chiamate.filter(c => c.tool === 'set_session_model')).toHaveLength(1)
  expect(await ui.find({ type: 'Text', text: /cambio a Sonnet 5\.5: esito incerto/ })).toBeDefined()
  // Il cambio era arrivato davvero: «Ricontrolla» rilegge la sessione, non ritenta.
  modelloRemoto = 'claude-sonnet-5-5'
  await ui.press({ key: `cambia-ricontrolla-${a.id}` })
  await finche(() => record().cambio?.esito === 'fatto')
  expect(record()).toMatchObject({ modello: 'claude-sonnet-5-5', cambio: { esito: 'fatto' } })
  expect(amb.chiamate.filter(c => c.tool === 'set_session_model')).toHaveLength(1)
  // L'effort: chiamata riuscita e verificata con get_session.
  await ui.select({ key: `cambia-eff-${a.id}`, value: 'xhigh' })
  await finche(() => record().cambio?.campo === 'effort')
  expect(record()).toMatchObject({ effort: 'xhigh', cambio: { campo: 'effort', valore: 'xhigh', esito: 'fatto' } })
  await ui.unmount()
})

// --- F7.4: «Chi lavora» --------------------------------------------------------------------------------------------

test('F7.4 preset: deterministici; Economico mai un auditor in più; Qualità lo aggiunge sulle corsie alte; l\'auditor scelto resta se valido', () => {
  const a = base('a-pre00001', 1, { repo: AUTORE.repo!, revisore: 'claude', corsia: 'R3' })
  for (const p of ['consigliato', 'economico', 'qualita'] as const) expect(presetChi(a, p, R, [], [a], AUTORE)).toEqual(presetChi(a, p, R, [], [a], AUTORE))
  const eco = presetChi(a, 'economico', R, [], [a], AUTORE)
  expect(eco.campi.auditor).toBeUndefined()
  const qual = presetChi(a, 'qualita', R, [], [a], AUTORE)
  if (qual.campi.esecutore === 'claude') expect(qual.campi.auditor).toBeDefined()
  // Un auditor scelto a mano resta con ogni preset, Economico compreso, se fa ancora coppia.
  const conFable = { ...a, auditor: 'fable' }
  for (const p of ['consigliato', 'economico', 'qualita'] as const) {
    const x = presetChi(conFable, p, R, [], [conFable], AUTORE)
    expect([p, x.campi.esecutore !== 'claude' || x.campi.auditor === 'fable']).toEqual([p, true])
  }
  // Corsia, revisore e destinazione non si toccano.
  expect(Object.keys(eco.campi).sort()).toEqual(['auditor', 'effort', 'esecutore', 'modello'])
  expect(diversoDa(a, eco.campi, R)).toBe(diversoDa(a, eco.campi, R))
})

test('F7.4 editor: anteprima del preset prima di applicarla; «modificato» e «Ripristina consigliato»; Dettagli chiusi, auditor solo in coppie valide e tolto al cambio d\'esecutore', async ($, on) => {
  const amb = ambiente(on)
  const a = base('a-chi00001', 1, { repo: AUTORE.repo!, revisore: 'claude', corsia: 'R3', modello: 'claude-haiku-5-5', effort: 'low' })
  amb.disco.set(`X:/orch/azioni/${a.id}.json`, JSON.stringify(a))
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: 'ricarica' })
  await ui.press({ key: `mod-${a.id}` })
  const record = () => JSON.parse(amb.disco.get(`X:/orch/azioni/${a.id}.json`)!) as Azione
  expect(await ui.find({ type: 'Text', text: /modificato a mano$/ })).toBeDefined()
  // Dettagli chiusi per default: nessuna scelta di esecutore visibile.
  expect(await ui.find({ key: `esec-${a.id}` })).toBeUndefined()
  // Anteprima: il riepilogo cambia, il record no.
  await ui.press({ key: `preset-${a.id}-qualita-premi` })
  expect(await ui.find({ type: 'Text', text: 'anteprima: non si salva niente finché non premi Applica' })).toBeDefined()
  expect(record().versione).toBe(a.versione)
  await ui.press({ key: `preset-annulla-${a.id}` })
  expect(await ui.find({ key: `preset-applica-${a.id}` })).toBeUndefined()
  // Ripristina consigliato: una scrittura, poi niente «modificato».
  await ui.press({ key: `chi-ripristina-${a.id}` })
  await finche(() => record().versione > a.versione)
  expect(await ui.find({ type: 'Text', text: /modificato a mano$/ })).toBeUndefined()
  // Dettagli: l'auditor offre solo coppie valide; le altre col motivo. Al cambio d'esecutore l'auditor va via, e lo si dice.
  await ui.press({ key: `chi-dettagli-${a.id}` })
  const opzioni = ((await ui.find({ key: `aud-${a.id}` }))?.props as { options?: { value: string }[] } | undefined)?.options?.map(o => o.value) ?? []
  const modello = modelloDi(record(), R)
  for (const x of ['sonnet', 'opus', 'fable']) expect([x, opzioni.includes(x)]).toEqual([x, !motivoAuditor(modello, x)])
  await ui.select({ key: `aud-${a.id}`, value: opzioni.find(x => x !== 'nessuno')! })
  await finche(() => !!record().auditor)
  await ui.select({ key: `esec-${a.id}`, value: 'codex' })
  await finche(() => record().esecutore === 'codex')
  expect(record().auditor).toBeUndefined()
  expect(amb.toast.some(t => /^auditor .* tolto: non fa coppia con il nuovo modello$/.test(t))).toBe(true)
  await ui.unmount()
})

// --- revisione F7 (Codex) -------------------------------------------------------------------------------------------

test('F7 rilievo 1: «Cambia» valida per intero la configurazione proposta: la chip diventata R4 durante la conferma non scende a low', async ($, on) => {
  const amb = ambiente(on, { strumenti: STRUMENTI_CAMBIO })
  const a = alLavoro('a-riv70001', { effort: 'medium' })
  amb.disco.set(`X:/orch/azioni/${a.id}.json`, JSON.stringify(a))
  let domande = 0
  on('tool.call', { tool: 'AskUserQuestion' }, (_, e) => {
    domande++
    // Durante la conferma la chip diventa sensibile (R4): medium era già sotto il minimo, low lo è ancora di più.
    amb.disco.set(`X:/orch/azioni/${a.id}.json`, JSON.stringify({ ...a, versione: 2, corsia: 'R4' }))
    return { result: { questions: e.questions, answers: { [e.questions[0]!.question]: 'Cambia' } } }
  })
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: 'ricarica' })
  await ui.select({ key: `cambia-eff-${a.id}`, value: 'low' })
  await finche(() => domande > 0)
  await finche(() => false, 60)
  expect(amb.chiamate.filter(c => /^set_session_/.test(c.tool))).toEqual([])
  expect((JSON.parse(amb.disco.get(`X:/orch/azioni/${a.id}.json`)!) as Azione).cambio).toBeUndefined()
  await ui.unmount()
})

test('F7 rilievo 6: «Riavvia senza auditor» anche quando a fallire è un advisor ereditato (la chip non ne chiede uno)', { options: { anthropicApiKey: CHIAVE_API } }, async ($, on) => {
  const ingressi: Record<string, unknown>[] = []
  const amb = ambiente(on, { api: (cmd, _a, stdin) => (cmd === 'lancia-api' ? (ingressi.push(JSON.parse(stdin!)), [0, '']) : undefined) })
  amb.disco.set(CONFIG, CONFIG_API)
  const a = { ...chipApi('a-riv70006'), stato: 'avviata' as const, lanciatore: 'api-claude' as const, tentativo: 'az-riv70006', avviataIl: '2026-11-06T10:00:00Z' }
  amb.disco.set(`X:/orch/azioni/${a.id}.json`, JSON.stringify(a))
  amb.disco.set('X:/orch/azioni/esecuzioni/az-riv70006.json', JSON.stringify({ id: a.id, tentativo: a.tentativo, stato: 'fallita', ramo: 'chipmanager/az-riv70006', costo: null,
    advisorNonDisponibile: 'escluso', errore: "advisor non disponibile all'avvio", advisor: { stato: 'ereditato', modello: 'opus' }, senzaAuditor: {} }))
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: 'ricarica' })
  await ui.press({ key: `senza-auditor-${a.id}` })
  await finche(() => ingressi.length > 0)
  expect(JSON.parse(amb.disco.get(`X:/orch/azioni/${a.id}.json`)!)).toMatchObject({ senzaAuditor: true })
  expect(ingressi.at(-1)).toMatchObject({ senzaAdvisor: true })
  expect(ingressi.at(-1)).not.toHaveProperty('advisor')
  expect(statoAuditor({ ...a, senzaAuditor: true })).toBe('senza')
  await ui.unmount()
})

test('F7 rilievo 7: Qualità non aggiunge un auditor dove la modalità non lo ammette (cloud): la candidata completa si rivalida', () => {
  const a = base('a-riv70007', 1, { repo: AUTORE.repo!, revisore: 'claude', corsia: 'R3', destinazione: 'cloud' })
  const q = presetChi(a, 'qualita', R, [], [a], AUTORE)
  expect(q.campi.auditor).toBeUndefined()
  expect(violazioni({ ...a, ...q.campi }, R).map(m => m.k)).not.toContain('au.cloud')
})

test('F7 rilievo 8: «nessuno» scelto è una scelta esplicita: si salva, non è un modello sconosciuto, e nessun preset lo cambia', async ($, on) => {
  const nessuno = base('a-riv70008', 1, { repo: AUTORE.repo!, revisore: 'claude', corsia: 'R3', auditor: 'nessuno' })
  for (const p of ['consigliato', 'economico', 'qualita'] as const) expect([p, presetChi(nessuno, p, R, [], [nessuno], AUTORE).campi.auditor]).toEqual([p, 'nessuno'])
  expect(violazioni(nessuno, R).map(m => m.k).filter(k => k.startsWith('au.'))).toEqual([])
  expect(statoAuditor(nessuno)).toBeUndefined()
  const amb = ambiente(on)
  const a = base('a-riv70009', 1, { repo: AUTORE.repo!, revisore: 'claude', corsia: 'R3' })
  amb.disco.set(`X:/orch/azioni/${a.id}.json`, JSON.stringify(a))
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: 'ricarica' })
  await ui.press({ key: `mod-${a.id}` })
  await ui.press({ key: `chi-dettagli-${a.id}` })
  await ui.select({ key: `aud-${a.id}`, value: 'nessuno' })
  await finche(() => (JSON.parse(amb.disco.get(`X:/orch/azioni/${a.id}.json`)!) as Azione).auditor === 'nessuno')
  expect((JSON.parse(amb.disco.get(`X:/orch/azioni/${a.id}.json`)!) as Azione).auditor).toBe('nessuno')
  await ui.unmount()
})

test('F7 giro 2, rilievo 1: «Cambia» rivaluta con l\'elenco riletto: una dipendenza fusa non blocca il cambio', async ($, on) => {
  const amb = ambiente(on, { strumenti: STRUMENTI_CAMBIO, mcp: (_s, tool, args) => (tool === 'get_session' && (args as { session_id?: string }).session_id === SID
    ? { isError: false, content: [{ type: 'text', text: JSON.stringify({ model: 'claude-opus-5-5', effort: 'xhigh' }) }] } : undefined) })
  const dip = base('a-riv80000', 2, { repo: AUTORE.repo!, revisore: 'nessuno', stato: 'completata', completataIl: '2026-11-06T09:00:00Z' })
  const a = alLavoro('a-riv80001', { dipende: [dip.id] })
  for (const x of [dip, a]) amb.disco.set(`X:/orch/azioni/${x.id}.json`, JSON.stringify(x))
  rispondiCambia(on, 'Cambia')
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: 'ricarica' })
  await ui.select({ key: `cambia-eff-${a.id}`, value: 'xhigh' })
  await finche(() => !!(JSON.parse(amb.disco.get(`X:/orch/azioni/${a.id}.json`)!) as Azione).cambio)
  expect(amb.chiamate.filter(c => c.tool === 'set_session_effort')).toHaveLength(1)
  expect(JSON.parse(amb.disco.get(`X:/orch/azioni/${a.id}.json`)!)).toMatchObject({ effort: 'xhigh', cambio: { esito: 'fatto' } })
  await ui.unmount()
})

test('UX agenti (1, 6, 8, 9, 11): corsie spiegate, corsie Codex dal routing, aggiorna_azione corto, pesi solo su richiesta, guida', async ($, on) => {
  const amb = ambiente(on)
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const t = (nome: string) => amb.registrati.find(x => x.name === nome)!
  const props = (nome: string) => (t(nome).inputSchema as { properties: Record<string, { description?: string }> }).properties
  // 1: il significato di R0–R5 nello schema della corsia.
  expect(props('suggerisci_azione').corsia!.description).toMatch(/R0 .*R1 .*R2 .*R3 .*R4-R5/)
  // 9: le corsie di Codex vengono da routing.json (corsia_codex.esegue.corsie), non da un testo fisso.
  expect(props('suggerisci_azione').esecutore!.description).toContain('R1, R2, R3')
  // 11: la guida per gli agenti.
  expect(t('suggerisci_azione').description).toContain('docs/GUIDE-FOR-AGENTS.md')
  // 8: proporre pesi solo su richiesta dell'utente, come le impostazioni.
  expect(t('proponi_pesi').description).toMatch(/^Only when the user/)
  // 6: più corto (era 479 caratteri), con la revisione senza stato e quella del proponente.
  const d = t('aggiorna_azione').description
  expect(d.length).toBeLessThanOrEqual(330)
  for (const parola of ['"consegnata"', '"scartata"', '"presa"', '"avviata"', '"fallita"', '`revisione`', 'without `stato`', 'without `tentativo`'])
    expect(d).toContain(parola)
})

test('UX agenti (3): il risultato di suggerisci_azione dice corsia, modello, effort e modalità effettivi, e la causa della sensibilità', async ($, on) => {
  ambiente(on)
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const testoDi = async (args: Record<string, unknown>) =>
    String(((await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', ...args } as never)) as { result?: unknown }).result)
  const codex = await testoDi({ titolo: 'Fix ricerca', brief: 'Correggi il dedup.', esecutore: 'codex', corsia: 'R2' })
  expect(codex).toContain('lane R2')
  expect(codex).toMatch(/codex gpt-[\w.-]+ · xhigh → review claude/)
  expect(codex).toContain('runs: local')
  expect(codex).not.toContain('Sensitive')
  const api = await testoDi({ titolo: 'Prova', brief: 'x', destinazione: 'api-claude' })
  expect(api).toContain('runs: api-claude')
  const autore = await testoDi({ titolo: 'Pagina', brief: 'Fix the author list.' })
  expect(autore).toContain('lane R4')
  expect(autore).toContain('Sensitive')
  expect(autore).toContain('"author"')
})

test('UX agenti (3): causaSensibile, una causa nell\'ordine flag, corsia, termine, lista non valida, termine del progetto', () => {
  const pulito = base('a-causa001', 1, { brief: 'Aggiorna il README.' })
  expect(causaSensibile(pulito, R)).toBeUndefined()
  expect(causaSensibile({ ...pulito, sensibile: true, corsia: 'R5', brief: 'login' }, R)).toEqual({ tipo: 'flag' })
  expect(causaSensibile({ ...pulito, corsia: 'R5', brief: 'login' }, R)).toEqual({ tipo: 'corsia', corsia: 'R5' })
  expect(causaSensibile({ ...pulito, brief: 'Fix the author list.' }, R)).toEqual({ tipo: 'termine', termine: 'author' })
  // La lista del progetto che non compila rende sensibile tutto: si dice PRIMA di cercare un termine del progetto.
  expect(causaSensibile(pulito, { ...R, sensibili: ['('] })).toEqual({ tipo: 'listaNonValida' })
  expect(causaSensibile({ ...pulito, brief: 'Gestione magazzino.' }, { ...R, sensibili: ['magazzino'] })).toEqual({ tipo: 'termineProgetto', termine: 'magazzino' })
  // Coerente con sensibile(): stessa risposta sì/no.
  const casi: [typeof pulito, typeof R][] = [[pulito, R], [{ ...pulito, brief: 'author' }, R], [pulito, { ...R, sensibili: ['('] }]]
  for (const [a, r] of casi)
    expect(causaSensibile(a, r) !== undefined).toBe(sensibile(a, r))
})

test('UX agenti (7): suggerisci_azione rifiuta con tutti gli errori in una volta, dopo i controlli di tipo', async ($, on) => {
  ambiente(on)
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const r = (await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: '   ', brief: 'x', effort: 'ultra', ordine: 0, esecutore: 'gemini', modello: 'm' } as never)) as { deny?: string; text?: string }
  const testo = r.deny ?? r.text ?? ''
  for (const parte of ['missing titolo', 'effort:', 'ordine: integer 1-999', 'esecutore: claude | codex | freellmapi']) expect(testo).toContain(parte)
  // Con un esecutore non valido il modello non si controlla contro una lista che non esiste.
  expect(testo).not.toContain('modello for')
  // Tipi sbagliati: rifiuto, mai un'eccezione.
  const tipi = (await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 7, brief: ['x'], dipende: 'a-x' } as never)) as { deny?: string; text?: string }
  expect(tipi.deny ?? tipi.text).toContain('titolo: text up to 200 characters')
  expect(tipi.deny ?? tipi.text).toContain('brief: text up to 20000 characters')
  expect(tipi.deny ?? tipi.text).toContain('dipende: list of ids')
})

// --- F9: garanzia di non regressione per «Cambia» (le altre azioni in lavoro.test.tsx) --------------------------------

// F9 (revisione): i controlli della sessione al lavoro e gli effetti di «Cambia» per ogni superficie, mobile compreso (l'app
// può dichiarare i Select anche lì), con gli argomenti delle chiamate all'app.
for (const superficie of ['desktop', 'terminal', 'vscode', 'mobile'] as const)
  test(`F9 non regressione (${superficie}): «Cambia» modello ed effort, i controlli della sessione al lavoro e le chiamate prodotte uguali a prima`, async ($, on) => {
    const amb = ambiente(on, {
      strumenti: STRUMENTI_CAMBIO,
      mcp: (_s, tool, args) => {
        const x = args as { session_id?: string }
        if (tool === 'set_session_model' || tool === 'set_session_effort') return { isError: false, content: [{ type: 'text', text: 'ok' }] }
        if (tool === 'get_session' && x.session_id === SID) return { isError: false, content: [{ type: 'text', text: JSON.stringify({ model: 'claude-sonnet-5-5', effort: 'xhigh' }) }] }
        return undefined
      },
    })
    const a = alLavoro('a-cmbf9001')
    amb.disco.set(`X:/orch/azioni/${a.id}.json`, JSON.stringify(a))
    rispondiCambia(on, 'Cambia')
    mock.clock(on)
    await $.session.start({ cwd: '/', surface: superficie === 'terminal' ? 'terminal' : 'desktop', isInteractive: true })
    const ui = await $.ui.mount({ ...PANE(superficie === 'terminal' ? 'terminal' : 'desktop'), surface: superficie } as unknown as ReturnType<typeof PANE>)
    await ui.press({ key: 'ricarica' })
    confrontaF9(`controlli:${superficie}:sessione-al-lavoro`, controlliF9(await ui.drawn()))
    const record = () => JSON.parse(amb.disco.get(`X:/orch/azioni/${a.id}.json`)!) as Azione
    const c0 = amb.chiamate.length
    await ui.select({ key: `cambia-mod-${a.id}`, value: 'claude-sonnet-5-5' })
    await finche(() => record().cambio?.esito === 'fatto')
    await ui.select({ key: `cambia-eff-${a.id}`, value: 'xhigh' })
    await finche(() => record().cambio?.campo === 'effort')
    // Mutazione: un gestore reso inerte su una superficie non chiama l'app; qui le due chiamate ci sono davvero.
    expect(amb.chiamate.slice(c0).filter(c => c.tool === 'set_session_model' || c.tool === 'set_session_effort').map(c => c.tool)).toEqual(['set_session_model', 'set_session_effort'])
    confrontaF9(`effetti:${superficie}:cambia`, { app: amb.chiamate.slice(c0).filter(c => c.tool !== 'list_sessions'), record: { ...record(), versione: 0 } })
    await ui.unmount()
    fineF9()
  })

// --- F13.3b: OpenAI-compatible providers as an explicit text executor ------------------------------------------------

const RC: Regole = { ...R, compatibiliConnessi: ['ollama', 'mistral'], risorse: { ...R.risorse, compatibili: { ollama: 'R1', mistral: 'R2' } } }
const CMP = (extra: Partial<Azione> = {}) => base('a-cmp00001', 1, { repo: AUTORE.repo!, esecutore: 'compatibile', provider: 'ollama', modello: 'qwen3:8b', corsia: 'R1', effort: 'low', revisore: 'claude', ...extra })
const codici = (v: { k: string }[]) => v.map(m => m.k)

test('F13.3b guardie: abilitato per progetto e connesso, corsie R0–R1 (R2 col livello), filtro LAN, testo, revisione Claude, mai sensibile', () => {
  expect(violazioni(CMP(), RC)).toEqual([])
  expect(modalitaDi(CMP())).toBe('esterno')
  expect(codici(violazioni(CMP({ provider: 'groq' }), RC))).toContain('v.fornitoreNonAbilitato')
  expect(codici(violazioni(CMP(), { ...RC, compatibiliConnessi: [] }))).toContain('v.nonConnesso')
  expect(codici(violazioni(CMP({ provider: 'nessuno' }), RC))).toContain('cmp.ignoto')
  expect(codici(violazioni(CMP({ modello: undefined }), RC))).toContain('cmp.modello')
  expect(codici(violazioni(CMP({ corsia: 'R2' }), RC))).toContain('v.freeCorsia')
  expect(violazioni(CMP({ provider: 'mistral', corsia: 'R2' }), RC)).toEqual([])
  expect(codici(violazioni(CMP({ corsia: 'R3' }), RC))).toContain('v.freeCorsia')
  // Il filtro dei dati LAN vale anche per un server locale: l'URL non dice dove finiscono i dati (F13 r1.7).
  expect(codici(violazioni(CMP({ brief: 'Scrivi a mario@example.com.' }), RC))).toContain('v.datiLan')
  expect(codici(violazioni(CMP({ brief: 'x'.repeat(1600) }), RC))).toContain('v.freeTesto')
  expect(codici(violazioni(CMP({ revisore: 'codex' }), RC))).toContain('v.freeRevisione')
  expect(codici(violazioni(CMP({ effort: 'high' }), RC))).toContain('v.freeEffort')
  expect(codici(violazioni(CMP({ destinazione: 'cloud' }), RC))).toContain('v.freeIsolato')
  for (const c of ['v.r4Autore', 'v.freeCorsia']) expect(codici(violazioni(CMP({ brief: 'Rivedi il login.' }), RC))).toContain(c)
  expect(codici(violazioni(CMP(), { ...RC, risorse: { ...RC.risorse, soloLocale: true } }))).toContain('v.soloLocale')
  // Qwen US senza host del workspace: il motivo, nessun URL inventato.
  const qwen = { ...RC, compatibiliConnessi: ['qwen'], risorse: { ...RC.risorse, compatibili: { qwen: 'R1' as const }, account: { ...RC.risorse.account, compatibili: { qwen: { regione: 'us' as const } } } } }
  expect(codici(violazioni(CMP({ provider: 'qwen' }), qwen))).toContain('cmp.configurazione')
  expect(violazioniAvvio(CMP(), RC, [CMP()], AUTORE, true).map(m => m.k)).toContain('v.freeQui')
})

test('F13.3b il bilanciamento non sceglie mai un fornitore esterno; il record vuole il provider giusto', () => {
  // Constraint 3: no models for `compatibile` in the rules, whatever routing.json says.
  expect(REGOLE_DEFAULT.modelli.compatibile).toEqual([])
  expect(regoleDa({ ...ROUTING, modelli_ammessi: [...ROUTING.modelli_ammessi, 'qwen3:8b'] }, 'routing.json').modelli.compatibile).toEqual([])
  // Every lane and profile, provider enabled at R2 and connected, nothing explicit: never `compatibile`.
  for (const profilo of ['automatico', 'risparmio', 'qualita', 'velocita'] as const)
    for (const corsia of CORSIE) {
      const r: Regole = { ...RC, risorse: { ...RC.risorse, profilo, compatibili: { ollama: 'R2', mistral: 'R2' } } }
      const a = base('a-cmp00002', 1, { repo: AUTORE.repo!, corsia, effort: undefined })
      expect([profilo, corsia, bilancia(a, {}, r, [], [a], AUTORE).esecutore]).not.toEqual([profilo, corsia, 'compatibile'])
    }
  const esplicita = CMP()
  expect(bilancia(esplicita, { esecutore: 'compatibile', provider: 'ollama', modello: 'qwen3:8b', effort: 'low', revisore: 'claude' }, RC, [], [esplicita], AUTORE)).toMatchObject({ esecutore: 'compatibile', provider: 'ollama' })
  expect(normalizza({ ...CMP(), stato: 'proposta' })).toMatchObject({ provider: 'ollama' })
  for (const rotta of [{ provider: undefined }, { provider: 'altro' }, { esecutore: 'claude' as const }])
    expect('k' in (normalizza({ ...CMP(rotta), stato: 'proposta' }) as object)).toBe(true)
})

test('F13.3b configurazione: opt-in del progetto e impostazioni dell\'account validate; forme sbagliate fermano', () => {
  const p = (progetto: object, account?: object) => progettoDa({ ...(account && { account }), progetti: { 'acme/progetto': progetto } }, 'acme/progetto')
  expect((p({ compatibili: { ollama: 'R1', mistral: null } }) as { risorse: { compatibili: unknown } }).risorse.compatibili).toEqual({ ollama: 'R1' })
  expect((p({}, { compatibili: { ollama: { endpoint: 'http://127.0.0.1:11500/v1' }, qwen: { regione: 'us' } } }) as { risorse: { account: { compatibili: unknown } } }).risorse.account.compatibili)
    .toEqual({ ollama: { endpoint: 'http://127.0.0.1:11500/v1' }, qwen: { regione: 'us' } })
  for (const rotto of [
    [{ compatibili: { ollama: 'R3' } }], [{ compatibili: { nessuno: 'R1' } }], [{ compatibili: ['ollama'] }],
    [{}, { compatibili: { ollama: { endpoint: 'http://192.168.1.5:11434/v1' } } }], [{}, { compatibili: { mistral: { endpoint: 'http://localhost:1/v1' } } }],
    [{}, { compatibili: { qwen: { workspace: 'https://evil.example.com/compatible-mode/v1' } } }], [{}, { compatibili: { qwen: { regione: 'eu' } } }],
  ] as [object, object?][])
    expect('k' in (p(...rotto) as object)).toBe(true)
})

test('F13.3b suggerisci_azione: provider solo con compatibile, modello esplicito', async ($, on) => {
  const amb = ambiente(on)
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const deny = async (args: object) => {
    const r = (await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'Bozza', brief: 'Riassumi.', ...args } as never)) as { deny?: string; text?: string }
    return r.deny ?? r.text ?? ''
  }
  expect(await deny({ esecutore: 'compatibile', modello: 'qwen3:8b' })).toContain('provider:')
  expect(await deny({ provider: 'ollama' })).toContain('provider:')
  expect(await deny({ esecutore: 'compatibile', provider: 'altro', modello: 'qwen3:8b' })).toContain('registry')
  expect(await deny({ esecutore: 'compatibile', provider: 'ollama' })).toContain('modello')
  // Constraint 1: missing or unknown provider is a refusal, never a default provider; nothing was recorded.
  expect(await deny({ esecutore: 'compatibile', provider: '', modello: 'qwen3:8b' })).toContain('provider:')
  expect(amb.azione()).toHaveLength(0)
  await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'Bozza', brief: 'Riassumi.', esecutore: 'compatibile', provider: 'ollama', modello: 'qwen3:8b', corsia: 'R1' } as never)
  expect(amb.azione()[0]).toMatchObject({ esecutore: 'compatibile', provider: 'ollama', modello: 'qwen3:8b', revisore: 'claude' })
})

test('F13.3b avvio: conferma del testo, solo titolo e brief, solo la chiave di quel fornitore, costo per tipo', { options: { mistralKey: 'mk-prova-0123456789', openrouterKey: 'sk-or-prova-0123456789' } }, async ($, on) => {
  const amb = ambiente(on)
  amb.disco.set('X:/casa/.claude/chipmanager/config.json', JSON.stringify({ progetti: { 'acme/progetto': { compatibili: { ollama: 'R1', mistral: 'R1' } } } }))
  mock.clock(on)
  const viste: string[] = []
  conferme(on, testo => { viste.push(testo); return 'Invia testo' })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  for (const provider of ['ollama', 'mistral'])
    await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: `Bozza ${provider}`, brief: 'Riassumi il paragrafo.', background: 'Contesto da non inviare.', esecutore: 'compatibile', provider, modello: 'qwen3:8b', corsia: 'R1' } as never)
  const ui = await $.ui.mount({ ...PANE('desktop') })
  for (const a of amb.azione()) await ui.press({ key: `avvia-${a.id}` })
  await ui.unmount()
  expect(viste.length).toBe(2)
  const posta = amb.processi.filter(p => p.argv[1]?.endsWith('/compatibili.cjs') && p.argv[2] === 'completa')
  expect(posta.length).toBe(2)
  for (const p of posta) {
    expect(JSON.parse(p.stdin!).testo).toMatch(/^Bozza (ollama|mistral)\n\nRiassumi il paragrafo\.$/)
    expect(p.stdin).not.toContain('Contesto da non inviare.')
  }
  const ollama = posta.find(p => JSON.parse(p.stdin!).provider === 'ollama')!
  const mistral = posta.find(p => JSON.parse(p.stdin!).provider === 'mistral')!
  expect(ollama.env).toEqual({})
  expect(mistral.env).toEqual({ CHIPMANAGER_MISTRAL_KEY: '<set>' })
  for (const a of amb.azione()) expect(a).toMatchObject({ stato: 'consegnata', risultato: 'Testo scritto.', lanciatore: 'compatibile' })
  expect(amb.azione().find(a => a.provider === 'ollama')!.costo).toEqual({ tipo: 'gratuito' })
  expect(amb.azione().find(a => a.provider === 'mistral')!.costo).toEqual({ tipo: 'ignoto' })
  expect(amb.chiamate.filter(c => c.tool === 'start_session').length).toBe(0)
})

// --- F13.7: baseline skills in mandates and in the panel ------------------------------------------------------------

const PLUGIN = (attivi: string[], spenti: string[] = [], gestiti: string[] = []) => [
  ...attivi.map(id => ({ id, scope: 'user' as const, attivo: true })), ...spenti.map(id => ({ id, scope: 'user' as const, attivo: false })),
  ...gestiti.map(id => ({ id, scope: 'managed' as const, attivo: true })),
]

test('F13.7 mandato: nomina solo le skill installate e attive, per ruolo, solo per Claude; soloLocale e interruttori le tolgono', () => {
  const tutti = PLUGIN(['ponytail@ponytail', 'superpowers@claude-plugins-official', 'tokeneconomizer@tokeneconomizer'])
  const RS: Regole = { ...R, pluginBase: tutti }
  const claude = base('a-skill001', 1, { corsia: 'R2', revisore: 'claude', modello: 'claude-opus-5-5' })
  const p = mandato(claude, RS).prompt
  expect(p).toContain('Use the installed skills: ponytail. They never start sessions, worktrees or reviews outside chips.')
  // Il revisore Claude (subagente) riceve le skill di revisione; TokenEconomizer resta spento finché non lo accendi.
  expect(p).toContain('Use the installed skills: superpowers.')
  expect(p).not.toContain('tokeneconomizer')
  const acceso = { ...RS, risorse: { ...RS.risorse, modoLavoro: { ...RS.risorse.modoLavoro, skillBase: { tokeneconomizer: true, ponytail: false } } } }
  expect(mandato(claude, acceso).prompt).toContain('Use the installed skills: tokeneconomizer.')
  expect(mandato(claude, acceso).prompt).not.toContain('skills: ponytail')
  // Codex e i revisori Codex non ricevono nulla; l'elenco ignoto non nomina nulla.
  const codex = base('a-skill002', 1, { esecutore: 'codex', corsia: 'R2', revisore: 'claude' })
  expect(mandato(codex, RS).prompt).not.toContain('ponytail')
  expect(mandato({ ...claude, revisore: 'codex' }, RS).prompt).not.toContain('superpowers')
  expect(mandato(claude, { ...R, pluginBase: null }).prompt).not.toContain('Use the installed skills')
  // soloLocale: solo i flussi locali (ponytail resta, superpowers no).
  const locale = { ...RS, risorse: { ...RS.risorse, soloLocale: true } }
  expect(mandato(claude, locale).prompt).toContain('skills: ponytail')
  expect(mandato(claude, locale).prompt).not.toContain('superpowers')
  // Spento o non attivo nell'ospite: non nominato.
  expect(mandato(claude, { ...R, pluginBase: PLUGIN([], ['ponytail@ponytail']) }).prompt).not.toContain('ponytail')
})

test('F13.7 pannello: rileva i plugin con argv esatto; abilita e disabilita solo su clic, --scope user; un plugin gestito è bloccato', async ($, on) => {
  const elenco = [{ id: 'ponytail@ponytail', scope: 'user', enabled: false }, { id: 'superpowers@claude-plugins-official', scope: 'managed', enabled: true }]
  const amb = ambiente(on, { fonte: cmd => (cmd === 'claude plugin list --json' ? elenco : cmd.startsWith('claude plugin ') ? {} : undefined) })
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const plugin = () => amb.processi.filter(p => p.argv[0] === 'claude').map(p => p.argv.join(' '))
  await finche(() => plugin().includes('claude plugin list --json'))
  expect(plugin().every(x => x === 'claude plugin list --json')).toBe(true)
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: 'impostazioni' })
  await ui.press({ key: 'sezione-modo-premi' })
  expect((await ui.find({ key: 'skill-cambia-ponytail' }))?.props.label).toBe('Attiva · ponytail')
  // Gestito dalla policy: nessun pulsante.
  expect(await ui.find({ key: 'skill-cambia-superpowers' })).toBeUndefined()
  await ui.press({ key: 'skill-cambia-ponytail' })
  await finche(() => plugin().includes('claude plugin enable ponytail@ponytail --scope user'))
  expect(plugin().filter(x => !x.startsWith('claude plugin list'))).toEqual(['claude plugin enable ponytail@ponytail --scope user'])
  await ui.unmount()
})

test('F13.7 consenso: attivare un plugin con effetti esterni chiede un consenso suo; un progetto solo locale lo rifiuta senza chiedere', async ($, on) => {
  const elenco = [{ id: 'superpowers@claude-plugins-official', scope: 'user', enabled: false }]
  const amb = ambiente(on, { fonte: cmd => (cmd === 'claude plugin list --json' ? elenco : cmd.startsWith('claude plugin ') ? {} : undefined) })
  mock.clock(on)
  const domande: string[] = []
  let risposta = 'Annulla'
  conferme(on, testo => (domande.push(testo), risposta))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const comandi = () => amb.processi.filter(p => p.argv[0] === 'claude' && p.argv[2] !== 'list').map(p => p.argv.join(' '))
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: 'impostazioni' })
  await ui.press({ key: 'sezione-modo-premi' })
  await finche(() => !!amb.processi.find(p => p.argv.join(' ') === 'claude plugin list --json'))
  await ui.press({ key: 'skill-cambia-superpowers' })
  await finche(() => domande.length === 1)
  expect(domande[0]).toContain('telemetry')
  expect(comandi()).toEqual([])
  risposta = 'Attiva · superpowers'
  await ui.press({ key: 'skill-cambia-superpowers' })
  await finche(() => comandi().length === 1)
  expect(comandi()).toEqual(['claude plugin enable superpowers@claude-plugins-official --scope user'])
  await ui.unmount()
  // Progetto solo locale: nessuna domanda, nessun comando, il motivo in linea.
  amb.disco.set('X:/casa/.claude/chipmanager/config.json', JSON.stringify({ progetti: { 'acme/progetto': { soloLocale: true } } }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui2 = await $.ui.mount({ ...PANE('desktop') })
  await ui2.press({ key: 'impostazioni' })
  await ui2.press({ key: 'sezione-modo-premi' })
  await ui2.press({ key: 'skill-cambia-superpowers' })
  await finche(() => !!amb.disco)
  expect(domande.length).toBe(2)
  expect(comandi().length).toBe(1)
  await ui2.unmount()
})

test('F13.7 consenso: la politica si rilegge dopo la domanda (solo locale nel frattempo = niente) e regole illeggibili valgono come solo locale', async ($, on) => {
  const elenco = [{ id: 'superpowers@claude-plugins-official', scope: 'user', enabled: false }]
  const amb = ambiente(on, { fonte: cmd => (cmd === 'claude plugin list --json' ? elenco : cmd.startsWith('claude plugin ') ? {} : undefined) })
  mock.clock(on)
  let domande = 0
  // Mentre la domanda è aperta il progetto diventa solo locale: il sì non deve bastare.
  conferme(on, () => {
    domande++
    amb.disco.set('X:/casa/.claude/chipmanager/config.json', JSON.stringify({ progetti: { 'acme/progetto': { soloLocale: true } } }))
    return 'Attiva · superpowers'
  })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const comandi = () => amb.processi.filter(p => p.argv[0] === 'claude' && p.argv[2] !== 'list').map(p => p.argv.join(' '))
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: 'impostazioni' })
  await ui.press({ key: 'sezione-modo-premi' })
  await finche(() => !!amb.processi.find(p => p.argv.join(' ') === 'claude plugin list --json'))
  await ui.press({ key: 'skill-cambia-superpowers' })
  await finche(() => domande === 1)
  await finche(() => !!amb.disco)
  expect(comandi()).toEqual([])
  await ui.unmount()
  // Regole illeggibili (routing.json assente): nessuna domanda, nessun comando.
  amb.disco.set('X:/casa/.claude/chipmanager/config.json', JSON.stringify({ progetti: { 'acme/progetto': {} } }))
  amb.disco.delete('X:/repo/.claude/routing.json')
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui2 = await $.ui.mount({ ...PANE('desktop') })
  await ui2.press({ key: 'impostazioni' })
  await ui2.press({ key: 'sezione-modo-premi' })
  const pulsante = await ui2.find({ key: 'skill-cambia-superpowers' })
  if (pulsante) await ui2.press({ key: 'skill-cambia-superpowers' })
  expect(domande).toBe(1)
  expect(comandi()).toEqual([])
  await ui2.unmount()
})

test('F13.7 installa dal pannello: conferma con fonte, commit e hook; senza sì nulla; con sì l\'helper riceve solo url e sha approvati', async ($, on) => {
  const SHA = 'c'.repeat(40)
  const chiamate: { cmd: string; stdin?: string }[] = []
  const amb = ambiente(on, {
    fonte: (cmd, input) => {
      if (cmd === 'claude plugin list --json') return []
      if (cmd === 'skill-prepara') return (chiamate.push({ cmd }), { id: input.id, url: 'https://github.com/DietrichGebert/ponytail.git', sha: SHA, impronta: 'e'.repeat(64), hook: ['hooks/hooks.json · SessionStart: node inizio.js'] })
      if (cmd === 'skill-installa') return (chiamate.push({ cmd, stdin: input.stdin as string }), { id: 'ponytail', plugin: 'ponytail@chipmanager-base', sha: SHA })
      if (cmd === 'skill-pulisci') return (chiamate.push({ cmd }), { tolte: 1 })
      return undefined
    },
  })
  mock.clock(on)
  const domande: string[] = []
  let risposta = 'Annulla'
  conferme(on, testo => (domande.push(testo), risposta))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: 'impostazioni' })
  await ui.press({ key: 'sezione-modo-premi' })
  await finche(() => !!amb.processi.find(p => p.argv.join(' ') === 'claude plugin list --json'))
  // TokenEconomizer ha la sua procedura (F13.7 punto 4): anche lui si installa solo dal clic, sperimentale e spento.
  expect(await ui.find({ key: 'skill-installa-tokeneconomizer' })).toBeDefined()
  await ui.press({ key: 'skill-installa-ponytail' })
  await finche(() => domande.length === 1)
  for (const parte of ['https://github.com/DietrichGebert/ponytail.git', SHA, 'SessionStart: node inizio.js', 'privilegi']) expect(domande[0]).toContain(parte)
  // Refused: the downloaded revision is removed, nothing installed.
  await finche(() => chiamate.some(c => c.cmd === 'skill-pulisci'))
  expect(chiamate.map(c => c.cmd)).toEqual(['skill-prepara', 'skill-pulisci'])
  risposta = 'Installa · ponytail'
  await ui.press({ key: 'skill-installa-ponytail' })
  await finche(() => chiamate.some(c => c.cmd === 'skill-installa'))
  expect(JSON.parse(chiamate.find(c => c.cmd === 'skill-installa')!.stdin!)).toEqual({ url: 'https://github.com/DietrichGebert/ponytail.git', sha: SHA, impronta: 'e'.repeat(64), hook: ['hooks/hooks.json · SessionStart: node inizio.js'] })
  await finche(() => chiamate.filter(c => c.cmd === 'skill-pulisci').length === 2)
  await ui.unmount()
})

test('F13.7 avvio: il controllo delle approvazioni gira solo con un plugin della mod attivo; un progetto solo locale non installa ciò che invia dati', async ($, on) => {
  let elenco: object[] = [{ id: 'ponytail@ponytail', scope: 'user', enabled: true }]
  const controlli: string[] = []
  const amb = ambiente(on, {
    fonte: cmd => (cmd === 'claude plugin list --json' ? elenco : cmd === 'skill-controlla' ? (controlli.push(cmd), { spenti: ['ponytail'] }) : undefined),
  })
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await finche(() => !!amb.processi.find(p => p.argv.join(' ') === 'claude plugin list --json'))
  expect(controlli).toEqual([])
  elenco = [{ id: 'ponytail@chipmanager-base', scope: 'user', enabled: true }]
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await finche(() => controlli.length === 1)
  // Solo locale: superpowers (flusso esterno) senza pulsante d'installazione; ponytail (locale) sì.
  elenco = []
  amb.disco.set('X:/casa/.claude/chipmanager/config.json', JSON.stringify({ progetti: { 'acme/progetto': { soloLocale: true } } }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: 'impostazioni' })
  await ui.press({ key: 'sezione-modo-premi' })
  await ui.press({ key: 'skill-rileggi' })
  expect(await ui.find({ key: 'skill-installa-superpowers' })).toBeUndefined()
  expect(await ui.find({ key: 'skill-installa-ponytail' })).toBeDefined()
  await ui.unmount()
})

// --- F13b review (Codex), findings 4, 5, 6, 9, 10 --------------------------------------------------------------------

test('F13b rilievo 4: con solo TokenEconomizer attivo il controllo delle approvazioni all\'avvio gira (la proprietà la decide l\'helper)', async ($, on) => {
  const controlli: string[] = []
  const amb = ambiente(on, {
    fonte: cmd => (cmd === 'claude plugin list --json' ? [{ id: 'tokeneconomizer@tokeneconomizer', scope: 'user', enabled: true }] : cmd === 'skill-controlla' ? (controlli.push(cmd), { spenti: [] }) : undefined),
  })
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await finche(() => controlli.length === 1)
  expect(amb.processi.filter(p => p.argv[1]?.endsWith('/skill-installa.cjs')).map(p => p.argv[2])).toEqual(['controlla'])
})

test('F13b rilievo 5: passando da compatibile a Claude o con un preset, provider sparisce e il record resta valido', async ($, on) => {
  const amb = ambiente(on)
  amb.disco.set('X:/casa/.claude/chipmanager/config.json', JSON.stringify({ progetti: { 'acme/progetto': { compatibili: { ollama: 'R1' } } } }))
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'Bozza', brief: 'Riassumi.', esecutore: 'compatibile', provider: 'ollama', modello: 'qwen3:8b', corsia: 'R1' } as never)
  const a = amb.azione()[0]!
  expect(a.provider).toBe('ollama')
  const ui = await $.ui.mount({ ...PANE('desktop') })
  if (!(await ui.find({ key: `chi-dettagli-${a.id}` }))) await ui.press({ key: `mod-${a.id}` })
  await ui.press({ key: `chi-dettagli-${a.id}` })
  await ui.select({ key: `esec-${a.id}`, value: 'claude' })
  await finche(() => amb.azione()[0]!.esecutore === 'claude')
  const dopo = amb.azione()[0]!
  expect('provider' in dopo).toBe(false)
  expect('k' in (normalizza(dopo) as object)).toBe(false)
  await ui.unmount()
  // Il preset (bilanciamento) non sceglie mai compatibile, e non lascia provider.
  const { campi } = presetChi({ ...a }, 'economico', RC, [], [a], AUTORE)
  expect(campi.esecutore).not.toBe('compatibile')
  expect(campi.provider).toBeUndefined()
})

test('F13b tipi: una chip compatibile ha il segno del motore colorato e il nome del motore, nel terminale e sul desktop', async ($, on) => {
  const amb = ambiente(on)
  amb.disco.set('X:/casa/.claude/chipmanager/config.json', JSON.stringify({ progetti: { 'acme/progetto': { compatibili: { ollama: 'R1' } } } }))
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'Bozza', brief: 'Riassumi.', esecutore: 'compatibile', provider: 'ollama', modello: 'qwen3:8b', corsia: 'R1' } as never)
  const a = amb.azione()[0]!
  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await $.ui.mount({ ...PANE(surface) })
    if (!(await ui.find({ key: `chi-dettagli-${a.id}` }))) await ui.press({ key: `mod-${a.id}` })
    await ui.press({ key: `chi-dettagli-${a.id}` })
    const segni: unknown[] = []
    let testo = ''
    const visita = (n: unknown): void => {
      if (!n || typeof n !== 'object') return
      if (Array.isArray(n)) return n.forEach(visita)
      const x = n as { type?: string; props?: Record<string, unknown>; children?: unknown }
      if (typeof x.children === 'string') testo += `${x.children}\n`
      if (Array.isArray(x.children)) for (const c of x.children) if (typeof c === 'string') testo += `${c}\n`
      const propri = typeof x.children === 'string' ? [x.children] : Array.isArray(x.children) ? x.children.filter(c => typeof c === 'string') : []
      if (x.type === 'Text' && propri.some(c => c.includes('◆'))) segni.push(x.props?.color)
      visita(x.children)
    }
    visita(await ui.drawn())
    expect([surface, segni.length > 0, segni.every(c => typeof c === 'string')]).toEqual([surface, true, true])
    expect([surface, /Compatibile OpenAI/.test(testo), /undefined/.test(testo)]).toEqual([surface, true, false])
    await ui.unmount()
  }
})

test('F13b rilievo 6: se il progetto diventa solo locale mentre la conferma è aperta, l\'installazione di un plugin con flusso esterno non parte', async ($, on) => {
  const chiamate: string[] = []
  const amb = ambiente(on, {
    fonte: (cmd, input) => {
      if (cmd === 'claude plugin list --json') return []
      if (cmd === 'skill-prepara') return (chiamate.push(cmd), { id: input.id, url: 'https://github.com/obra/superpowers.git', sha: 'c'.repeat(40), impronta: 'd'.repeat(64), hook: [] })
      if (cmd.startsWith('skill-')) return (chiamate.push(cmd), {})
      return undefined
    },
  })
  mock.clock(on)
  conferme(on, () => {
    amb.disco.set('X:/casa/.claude/chipmanager/config.json', JSON.stringify({ progetti: { 'acme/progetto': { soloLocale: true } } }))
    return 'Installa · superpowers'
  })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: 'impostazioni' })
  await ui.press({ key: 'sezione-modo-premi' })
  await finche(() => !!amb.processi.find(p => p.argv.join(' ') === 'claude plugin list --json'))
  await ui.press({ key: 'skill-installa-superpowers' })
  await finche(() => chiamate.includes('skill-pulisci'))
  expect(chiamate).toEqual(['skill-prepara', 'skill-pulisci'])
  await ui.unmount()
})

test('F13b rilievo 9: il mandato a crediti API porta la stessa riga delle skill del mandato ordinario', () => {
  const RS: Regole = { ...R, pluginBase: [{ id: 'ponytail@ponytail', scope: 'user', attivo: true }] }
  const a = base('a-apiskl01', 1, { corsia: 'R2', revisore: 'claude', modello: 'claude-opus-5-5', destinazione: 'api-claude' })
  expect(mandatoApi(a, RS).prompt).toContain('Use the installed skills: ponytail.')
  expect(mandatoApi(a, { ...R, pluginBase: null }).prompt).not.toContain('Use the installed skills')
})

test('F13b rilievo 10: Qwen USA chiede l\'host del workspace (validato) e il rilevamento mostra gli id dei modelli', async ($, on) => {
  const amb = ambiente(on, { fonte: cmd => (cmd === 'compatibili-rileva' ? { trovati: [{ id: 'ollama', base: 'http://localhost:11434/v1', modelli: ['qwen3:8b', 'llama3.2'] }] } : undefined) })
  amb.disco.set('X:/casa/.claude/chipmanager/config.json', JSON.stringify({ account: { compatibili: { qwen: { regione: 'us' } } }, progetti: { 'acme/progetto': {} } }))
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: 'impostazioni' })
  const c = async (k: string) => !!(await ui.find({ key: k }))
  expect([await c('cmp-workspace-qwen'), !!(await ui.find({ type: 'Text', text: /<workspace>\.us-east-1\.maas\.aliyuncs\.com/ }))]).toEqual([true, true])
  await ui.input({ key: 'cmp-workspace-qwen', text: 'https://evil.example.com/compatible-mode/v1' })
  expect(['errore', !!(await ui.find({ type: 'Text', text: /config.json: «account»/ }))]).toEqual(['errore', true])
  await ui.input({ key: 'cmp-workspace-qwen', text: 'https://ws1.us-east-1.maas.aliyuncs.com/compatible-mode/v1' })
  expect(['valido', !!(await ui.find({ type: 'Text', text: /config.json: «account»/ }))]).toEqual(['valido', false])
  await ui.press({ key: 'cmp-rileva' })
  await finche(() => !!amb.processi.find(p => p.argv[1]?.endsWith('/compatibili.cjs') && p.argv[2] === 'rileva'))
  expect(['modelli', !!(await ui.find({ type: 'Text', text: /qwen3:8b, llama3\.2/ }))]).toEqual(['modelli', true])
  await ui.unmount()
})

// --- F13.2: modo dirigente nel pannello ------------------------------------------------------------------------------

const ROUTING_F13 = {
  ...ROUTING,
  modelli_ammessi: [...ROUTING.modelli_ammessi, 'claude-fable-5-2'],
  tetto_per_modello: { ...ROUTING.tetto_per_modello, 'claude-fable-5-2': 'xhigh' },
  revisione: { revisori_ammessi_per_autore: { ...ROUTING.revisione.revisori_ammessi_per_autore, 'claude-fable-5-2': ['claude-opus-5-5', 'motore:codex'],
    'claude-sonnet-5-5': ['claude-opus-5-5', 'motore:codex'] } },
}
const ambienteF13 = (on: Parameters<TestBody>[1], modo: Record<string, unknown> = {}, opz: Parameters<typeof ambiente>[1] = {}) => {
  const amb = ambiente(on, opz)
  amb.disco.set('X:/repo/.claude/routing.json', JSON.stringify(ROUTING_F13))
  amb.disco.set('X:/casa/.claude/chipmanager/config.json', JSON.stringify({ progetti: { 'acme/progetto': { milestoneGithub: true, modoLavoro: { dirigente: modo } } } }))
  return amb
}
/** La dirigente al lavoro come la lascerebbe un avvio riuscito: stato, gettone e sessione. */
const dirigenteAlLavoro = (amb: ReturnType<typeof ambiente>, id: string) => {
  const f = `X:/orch/azioni/${id}.json`
  const a = JSON.parse(amb.disco.get(f)!) as Azione
  amb.disco.set(f, JSON.stringify({ ...a, versione: a.versione + 1, stato: 'avviata', tentativo: 'az-dir00001', sessione: SID }))
}

test('F13.2 pannello: una R3 nasce dirigente su Fable 5.2 coi suoi vincoli; la figlia la nomina col gettone, eredita i vincoli e prende il lavoratore della corsia', async ($, on) => {
  const amb = ambienteF13(on, { maxFigli: 1 })
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const r = await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'Motore', brief: 'Riscrivi il pianificatore.', corsia: 'R3' } as never)
  expect(String((r as { result?: unknown }).result)).toContain('director')
  const dir = amb.azione()[0]!
  // La corsia minima passa alle figlie solo da R4: una R3 non porta tutte le figlie su Opus.
  expect([dir.ruolo, dir.modello, dir.vincoliPropri]).toEqual(['dirigente', 'claude-fable-5-2', { sensibile: false, datiLan: false, fornitori: ['claude', 'codex'], destinazioni: ['local'] }])
  // Una R1 normale non è una dirigente.
  await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'Docs', brief: 'Aggiorna il README.', corsia: 'R1' } as never)
  expect(amb.azione().find(a => a.titolo === 'Docs')!.ruolo).toBe(undefined)
  // Senza la dirigente al lavoro, o col gettone sbagliato: nessuna figlia.
  const figlia = { tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'Rinomina', brief: 'Rinomina un campo.', corsia: 'R1', padre: { id: dir.id, tentativo: 'az-dir00001' } }
  expect(String((await $.tool.call(figlia as never) as { deny?: unknown }).deny)).toContain('padre must be')
  dirigenteAlLavoro(amb, dir.id)
  expect(String((await $.tool.call({ ...figlia, padre: { id: dir.id, tentativo: 'az-altro0001' } } as never) as { deny?: unknown }).deny)).toContain('padre must be')
  await $.tool.call(figlia as never)
  const f = amb.azione().find(a => a.titolo === 'Rinomina')!
  expect([f.ruolo, f.padre, f.vincoliPadre, f.modello, f.stato]).toEqual(['lavoro', dir.id, dir.vincoliPropri, 'claude-sonnet-5-5', 'proposta'])
  // Oltre maxFigli l'helper rifiuta e la dirigente si ferma col motivo.
  expect(String((await $.tool.call({ ...figlia, titolo: 'Altra' } as never) as { deny?: unknown }).deny)).toContain('maxFigli')
})

test('F13.2 pannello: la dirigente aspetta col suo gettone e torna a lavorare entro maxRipiani; una chip normale non aspetta', async ($, on) => {
  const amb = ambienteF13(on, { maxRipiani: 1 })
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'Motore', brief: 'Riscrivi il pianificatore.', corsia: 'R3' } as never)
  await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'Docs', brief: 'Aggiorna il README.', corsia: 'R1' } as never)
  const dir = amb.azione().find(a => a.titolo === 'Motore')!
  const docs = amb.azione().find(a => a.titolo === 'Docs')!
  dirigenteAlLavoro(amb, dir.id)
  dirigenteAlLavoro(amb, docs.id)
  const stato = (id: string, s: string, tentativo = 'az-dir00001') => $.tool.call({ tool: 'mcp__chip-manager__aggiorna_azione', id, stato: s, tentativo } as never) as Promise<{ deny?: unknown; result?: unknown }>
  expect(String((await stato(docs.id, 'attesa-figli')).deny)).toContain('only a director')
  expect(String((await stato(dir.id, 'attesa-figli', 'az-altro0001')).deny)).toContain('not the current one')
  expect((await stato(dir.id, 'attesa-figli')).deny).toBe(undefined)
  expect(amb.azione().find(a => a.id === dir.id)!.stato).toBe('attesa-figli')
  expect((await stato(dir.id, 'avviata')).deny).toBe(undefined)
  expect(amb.azione().find(a => a.id === dir.id)).toMatchObject({ stato: 'avviata', ripiani: 1 })
  await stato(dir.id, 'attesa-figli')
  expect(String((await stato(dir.id, 'avviata')).deny)).toContain('maxRipiani 1')
  expect(amb.azione().find(a => a.id === dir.id)!.stato).toBe('attesa-figli')
})

test('F13.2 pannello: scartare la dirigente scarta le figlie mai partite (e l\'annullo le riporta); quelle partite restano', async ($, on) => {
  const amb = ambienteF13(on)
  const clock = mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'Motore', brief: 'Riscrivi il pianificatore.', corsia: 'R3' } as never)
  const dir = amb.azione()[0]!
  dirigenteAlLavoro(amb, dir.id)
  for (const t of ['Uno', 'Due']) await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: t, brief: `Rinomina ${t}.`, corsia: 'R1', padre: { id: dir.id, tentativo: 'az-dir00001' } } as never)
  const due = amb.azione().find(a => a.titolo === 'Due')!
  amb.disco.set(`X:/orch/azioni/${due.id}.json`, JSON.stringify({ ...due, versione: due.versione + 1, stato: 'avviata', tentativo: 'az-due00001', sessione: SID }))
  const d = JSON.parse(amb.disco.get(`X:/orch/azioni/${dir.id}.json`)!) as Azione
  // Corsia CLI (nessuna sessione dell'app): la riga apre la scheda della chip.
  amb.disco.set(`X:/orch/azioni/${dir.id}.json`, JSON.stringify({ ...d, versione: d.versione + 1, stato: 'attesa-figli', sessione: undefined, lanciatore: 'cli' }))
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await clock.advance(20_000)
  expect(await ui.find({ type: 'Text', text: /Aspetta le sue figlie/ })).toBeDefined()
  await ui.press({ key: `apri-${dir.id}` })
  await ui.press({ key: `scarta-${dir.id}` })
  expect(amb.azione().map(a => [a.titolo, a.stato]).sort()).toEqual([['Due', 'avviata'], ['Motore', 'scartata'], ['Uno', 'scartata']])
  await ui.press({ key: 'annulla-scarto' })
  expect(amb.azione().map(a => [a.titolo, a.stato]).sort()).toEqual([['Due', 'avviata'], ['Motore', 'attesa-figli'], ['Uno', 'proposta']])
  await ui.unmount()
})

test('F13.2 pannello: una dirigente su Fable da una sessione Opus va sulla corsia CLI; una fonte dell\'host che blocca la chiude col motivo, senza ripiego', async ($, on) => {
  const amb = ambienteF13(on, {}, { impostazioni: source => (source === 'policy' ? { apiKeyHelper: '/bin/chiave' } : {}) })
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'Motore', brief: 'Riscrivi il pianificatore.', corsia: 'R3' } as never)
  const dir = amb.azione()[0]!
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: `avvia-${dir.id}` })
  const lancio = amb.processi.filter(p => p.argv[2] === 'lancia-cli')
  expect(lancio.length).toBe(1)
  expect(JSON.parse(lancio[0]!.stdin!)).toMatchObject({ modello: 'claude-fable-5-2', fontiHost: [{ source: 'policy', chiavi: ['apiKeyHelper'] }] })
  expect(amb.chiamate.filter(c => c.tool === 'start_session').length).toBe(0)
  const a = amb.azione()[0]!
  expect([a.stato, a.lanciatore, a.modello, a.erroreCodice]).toEqual(['fallita', 'cli', 'claude-fable-5-2', 'err.cliCredenziali'])
  expect(a.erroreParametri).toEqual({ fonti: 'host:policy', modello: 'Fable 5.2' })
  await ui.unmount()
})

test('F13.2 pannello: «Dirigente su Opus» è solo una scelta del committente: modello Opus, e la dirigente parte dal desktop', async ($, on) => {
  const amb = ambienteF13(on)
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'Motore', brief: 'Riscrivi il pianificatore.', corsia: 'R3' } as never)
  const dir = amb.azione()[0]!
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: `mod-${dir.id}` })
  expect(await ui.find({ type: 'Text', text: /Dirigente · figlie 0\/8 · ripiani 0\/2 · Fable può addebitare/ })).toBeDefined()
  await ui.press({ key: `su-opus-${dir.id}` })
  expect(amb.azione()[0]).toMatchObject({ modello: 'claude-opus-5-5', dirigenteSuOpus: true })
  await ui.press({ key: `avvia-${dir.id}` })
  expect(amb.processi.filter(p => p.argv[2] === 'lancia-cli').length).toBe(0)
  expect(amb.chiamate.filter(c => c.tool === 'start_session').map(c => c.args.model)).toEqual(['claude-opus-5-5'])
  await ui.unmount()
})

// --- F13.6: catene di lavoro nel pannello ---------------------------------------------------------------------------

test('F13.6 pannello: catena: true crea i passi dalla pipeline; ogni passo consegna il suo artefatto e sblocca il successivo', async ($, on) => {
  const amb = ambienteF13(on)
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const r = await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'Guida', brief: 'Scrivi la guida d\'uso.', corsia: 'R1', catena: true } as never) as { result?: string }
  expect(String(r.result)).toMatch(/^Chain c-[a-z0-9]+: 4 chips/)
  const passi = amb.azione().sort((x, y) => x.ordine - y.ordine)
  expect(passi.map(p => [p.catena!.ruolo, p.catena!.giro, p.modello ?? null])).toEqual([['scrittore', 1, 'claude-sonnet-5-5'], ['revisore', 1, 'claude-opus-5-5'],
    ['scrittore', 2, 'claude-sonnet-5-5'], ['applicatore', 2, 'claude-sonnet-5-5']])
  const [w1, r1] = passi as [Azione, Azione]
  // Il primo passo al lavoro: senza artefatto non consegna; con l'artefatto sì, e il revisore può partire.
  amb.disco.set(`X:/orch/azioni/${w1.id}.json`, JSON.stringify({ ...w1, versione: w1.versione + 1, stato: 'avviata', tentativo: 'az-scr00001', sessione: SID }))
  const consegna = (extra: Record<string, unknown>) => $.tool.call({ tool: 'mcp__chip-manager__aggiorna_azione', id: w1.id, stato: 'consegnata', tentativo: 'az-scr00001', ...extra } as never) as Promise<{ deny?: string }>
  expect(String((await consegna({})).deny)).toContain('`artefatto`')
  expect(String((await consegna({ artefatto: 'x'.repeat(60001) })).deny)).toContain('60000')
  expect((await consegna({ artefatto: 'Primo paragrafo.\n\nSecondo paragrafo.' })).deny).toBe(undefined)
  expect(amb.azione().find(a => a.id === w1.id)).toMatchObject({ stato: 'consegnata', artefatto: '1-scrittore.md' })
  const c = w1.catena!.id
  expect(amb.disco.get(`X:/orch/azioni/artefatti/${c}/1-scrittore.md`)).toBe(`<!-- chipManager artefatto catena=${c} giro=1 ruolo=scrittore rif=- -->\nPrimo paragrafo.\n\nSecondo paragrafo.`)
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: `avvia-${r1.id}` })
  expect(amb.chiamate.filter(x => x.tool === 'start_session').map(x => x.args.model)).toEqual(['claude-opus-5-5'])
  // Il mandato del revisore nomina la bozza da leggere e la consegna dell'artefatto.
  expect(String(amb.chiamate.find(x => x.tool === 'start_session')!.args.prompt)).toContain(`X:/orch/azioni/artefatti/${c}/1-scrittore.md`)
  await ui.unmount()
})

test('F13.6 pannello: una catena sensibile o con uno scrittore che qui non c\'è si rifiuta col motivo; la dirigente ne crea una fra le sue figlie', async ($, on) => {
  const amb = ambienteF13(on)
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const nega = async (extra: Record<string, unknown>) => String(((await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'Guida', brief: 'Scrivi.', corsia: 'R1', catena: true, ...extra } as never)) as { deny?: string }).deny)
  expect(await nega({ sensibile: true })).toContain('never sensitive')
  expect(await nega({ catena: 'sì' })).toContain('catena: true')
  amb.disco.set('X:/casa/.claude/chipmanager/config.json', JSON.stringify({ progetti: { 'acme/progetto': { modoLavoro: { pipeline: { scrittore: { provider: 'ollama', modello: 'qwen3' } } } } } }))
  expect(await nega({})).toContain('ollama')
  expect(amb.azione().length).toBe(0)
  // Dalla dirigente: i passi sono sue figlie, coi suoi vincoli.
  amb.disco.set('X:/casa/.claude/chipmanager/config.json', JSON.stringify({ progetti: { 'acme/progetto': { milestoneGithub: true } } }))
  await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'Motore', brief: 'Riscrivi il pianificatore.', corsia: 'R3' } as never)
  const dir = amb.azione()[0]!
  dirigenteAlLavoro(amb, dir.id)
  await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'Guida', brief: 'Scrivi la guida.', corsia: 'R1', catena: true, padre: { id: dir.id, tentativo: 'az-dir00001' } } as never)
  expect(amb.azione().filter(a => a.padre === dir.id).map(a => a.catena!.ruolo).sort()).toEqual(['applicatore', 'revisore', 'scrittore', 'scrittore'])
})

test('F13.6 «correggi il secondo paragrafo»: lo scrittore FreeLLMAPI riceve bozza v1 e feedback, il committente conferma quel testo, e l\'uscita è la v2', { options: { freellmapiKey: 'fl-prova-0123456789' } }, async ($, on) => {
  let inviato = ''
  const amb = ambiente(on, { fonte: (cmd, input) => (cmd === 'completa' ? (inviato = String(input.testo), { risultato: 'Primo paragrafo.\n\nSecondo paragrafo, corretto.' }) : undefined) })
  configuraFree(amb)
  const cfg = JSON.parse(amb.disco.get('X:/casa/.claude/chipmanager/config.json')!)
  cfg.progetti['acme/progetto'].modoLavoro = { pipeline: { scrittore: { provider: 'freellmapi', modello: 'testo-compatto' } } }
  amb.disco.set('X:/casa/.claude/chipmanager/config.json', JSON.stringify(cfg))
  mock.clock(on)
  let confermato = ''
  conferme(on, testo => ((confermato = testo), 'Invia testo'))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'Guida', brief: 'Scrivi la guida.', corsia: 'R1', catena: true } as never)
  const passi = amb.azione().sort((x, y) => x.ordine - y.ordine)
  const [w1, r1, w2] = passi as [Azione, Azione, Azione]
  const c = w1.catena!.id
  // Bozza v1 e feedback v1 consegnati (il feedback non ripete la bozza).
  amb.disco.set(`X:/orch/azioni/artefatti/${c}/1-scrittore.md`, `<!-- chipManager artefatto catena=${c} giro=1 ruolo=scrittore rif=- -->\nPrimo paragrafo.\n\nSecondo paragrafo, con un errore.`)
  amb.disco.set(`X:/orch/azioni/artefatti/${c}/1-revisore.md`, `<!-- chipManager artefatto catena=${c} giro=1 ruolo=revisore rif=1-scrittore.md -->\nCorreggi il secondo paragrafo.`)
  for (const [x, f] of [[w1, '1-scrittore.md'], [r1, '1-revisore.md']] as const)
    amb.disco.set(`X:/orch/azioni/${x.id}.json`, JSON.stringify({ ...x, versione: x.versione + 1, stato: 'consegnata', artefatto: f }))
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: `avvia-${w2.id}` })
  for (const t of [inviato, confermato])
    for (const x of ['Secondo paragrafo, con un errore.', 'Correggi il secondo paragrafo.', 'Write draft v2']) expect([x, t.includes(x)]).toEqual([x, true])
  expect(amb.azione().find(a => a.id === w2.id)).toMatchObject({ stato: 'consegnata', artefatto: '2-scrittore.md' })
  expect(amb.disco.get(`X:/orch/azioni/artefatti/${c}/2-scrittore.md`)).toBe(`<!-- chipManager artefatto catena=${c} giro=2 ruolo=scrittore rif=1-revisore.md -->\nPrimo paragrafo.\n\nSecondo paragrafo, corretto.`)
  await ui.unmount()
})

// --- Revisione F13a (Codex) --------------------------------------------------------------------------------------------

test('Revisione F13a, rilievo 2: la dirigente passata a R4 dopo una figlia: la figlia nuova nasce R4 e sensibile, quella vecchia non parte più in R1', async ($, on) => {
  const amb = ambienteF13(on)
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'Motore', brief: 'Riscrivi il pianificatore.', corsia: 'R3' } as never)
  const dir = amb.azione()[0]!
  dirigenteAlLavoro(amb, dir.id)
  const figlia = (titolo: string) => $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo, brief: 'Rinomina un campo.', corsia: 'R1', padre: { id: dir.id, tentativo: 'az-dir00001' } } as never)
  await figlia('Prima')
  const prima = amb.azione().find(a => a.titolo === 'Prima')!
  expect([prima.vincoliPadre?.corsiaMin, prima.vincoliPadre?.sensibile]).toEqual([undefined, false])
  // Il committente porta la dirigente a R4.
  const d = JSON.parse(amb.disco.get(`X:/orch/azioni/${dir.id}.json`)!) as Azione
  amb.disco.set(`X:/orch/azioni/${dir.id}.json`, JSON.stringify({ ...d, versione: d.versione + 1, corsia: 'R4' }))
  await figlia('Seconda')
  const seconda = amb.azione().find(a => a.titolo === 'Seconda')!
  expect([seconda.vincoliPadre?.corsiaMin, seconda.vincoliPadre?.sensibile]).toEqual(['R4', true])
  expect(amb.azione().find(a => a.id === dir.id)!.vincoliPropri).toMatchObject({ corsiaMin: 'R4', sensibile: true })
  // La figlia nata prima non parte come una R1 qualunque: all'avvio prende i vincoli di adesso.
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: `avvia-${prima.id}` }).catch(() => {})
  expect(amb.chiamate.filter(c => c.tool === 'start_session').length).toBe(0)
  expect(amb.azione().find(a => a.id === prima.id)!.stato).toBe('proposta')
  await ui.unmount()
})

test('Revisione F13a, rilievo 7: la scheda della dirigente mostra il costo delle figlie per tipo; quella di un passo, la catena per ruolo', async ($, on) => {
  const amb = ambienteF13(on)
  const clock = mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'Motore', brief: 'Riscrivi il pianificatore.', corsia: 'R3' } as never)
  const dir = amb.azione()[0]!
  const figlia = (id: string, extra: Partial<Azione>) => amb.disco.set(`X:/orch/azioni/${id}.json`, JSON.stringify({ ...dir, id, titolo: id, ruolo: 'lavoro', padre: dir.id, ordine: 9,
    vincoliPropri: undefined, vincoliPadre: { sensibile: false, datiLan: false, fornitori: ['claude'] }, stato: 'consegnata', ...extra }))
  figlia('a-figapi001', { destinazione: 'api-claude', costoApi: 0.7 })
  figlia('a-figoss001', { costo: { tipo: 'osservato', usd: 0.4 } })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await clock.advance(20_000)
  await ui.press({ key: `mod-${dir.id}` })
  const t = String((await ui.find({ type: 'Text', text: /costo delle figlie/ }))?.text)
  expect([/stimato \$0,70/.test(t), /osservato \$0,40/.test(t), t.includes('1,10')]).toEqual([true, true, false])
  await ui.unmount()
})

test('Revisione F13a, giro 2, punto 3c: con un tetto la scheda della dirigente dice che è morbido', async ($, on) => {
  const amb = ambienteF13(on, { tettoUsd: 2 })
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'Motore', brief: 'Riscrivi il pianificatore.', corsia: 'R3' } as never)
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: `mod-${amb.azione()[0]!.id}` })
  expect(await ui.find({ type: 'Text', text: /tetto \$2,00, morbido: l'ultima chip può superarlo/ })).toBeDefined()
  await ui.unmount()
})

test('F13a↔F13b: una catena con scrittore compatibile (Ollama): la riscrittura riceve bozza v1 e feedback, confermati, e l\'uscita è l\'artefatto v2', async ($, on) => {
  const amb = ambiente(on)
  amb.disco.set('X:/casa/.claude/chipmanager/config.json', JSON.stringify({ progetti: { 'acme/progetto': { compatibili: { ollama: 'R1' },
    modoLavoro: { pipeline: { scrittore: { provider: 'ollama', modello: 'qwen3:8b' } } } } } }))
  mock.clock(on)
  const viste: string[] = []
  conferme(on, testo => ((viste.push(testo)), 'Invia testo'))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const r = await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'Guida', brief: 'Scrivi la guida.', corsia: 'R1', catena: true } as never) as { result?: string; deny?: string }
  expect(String(r.deny ?? r.result)).toMatch(/^Chain c-/)
  const [w1, r1, w2] = amb.azione().sort((x, y) => x.ordine - y.ordine) as [Azione, Azione, Azione]
  expect([w1.esecutore, w1.provider, w1.modello, w2.esecutore]).toEqual(['compatibile', 'ollama', 'qwen3:8b', 'compatibile'])
  const c = w1.catena!.id
  amb.disco.set(`X:/orch/azioni/artefatti/${c}/1-scrittore.md`, `<!-- chipManager artefatto catena=${c} giro=1 ruolo=scrittore rif=- -->\nPrimo paragrafo.\n\nSecondo paragrafo, con un errore.`)
  amb.disco.set(`X:/orch/azioni/artefatti/${c}/1-revisore.md`, `<!-- chipManager artefatto catena=${c} giro=1 ruolo=revisore rif=1-scrittore.md -->\nCorreggi il secondo paragrafo.`)
  for (const [x, f] of [[w1, '1-scrittore.md'], [r1, '1-revisore.md']] as const)
    amb.disco.set(`X:/orch/azioni/${x.id}.json`, JSON.stringify({ ...x, versione: x.versione + 1, stato: 'consegnata', artefatto: f }))
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: `avvia-${w2.id}` })
  const posta = amb.processi.filter(p => p.argv[1]?.endsWith('/compatibili.cjs') && p.argv[2] === 'completa')
  expect(posta.length).toBe(1)
  for (const t of [JSON.parse(posta[0]!.stdin!).testo as string, viste.at(-1)!])
    for (const x of ['Secondo paragrafo, con un errore.', 'Correggi il secondo paragrafo.', 'Write draft v2']) expect([x, t.includes(x)]).toEqual([x, true])
  expect(amb.azione().find(a => a.id === w2.id)).toMatchObject({ stato: 'consegnata', artefatto: '2-scrittore.md', costo: { tipo: 'gratuito' } })
  expect(amb.disco.get(`X:/orch/azioni/artefatti/${c}/2-scrittore.md`)).toBe(`<!-- chipManager artefatto catena=${c} giro=2 ruolo=scrittore rif=1-revisore.md -->\nTesto scritto.`)
  await ui.unmount()
})

test('Revisione F13a, giro 5, punto 1: con una bozza sensibile il passo con scrittore esterno si ferma prima della conferma e nulla parte', async ($, on) => {
  const amb = ambiente(on)
  amb.disco.set('X:/casa/.claude/chipmanager/config.json', JSON.stringify({ progetti: { 'acme/progetto': { compatibili: { ollama: 'R1' },
    modoLavoro: { pipeline: { scrittore: { provider: 'ollama', modello: 'qwen3:8b' } } } } } }))
  mock.clock(on)
  const viste: string[] = []
  conferme(on, testo => ((viste.push(testo)), 'Invia testo'))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'Guida', brief: 'Scrivi la guida.', corsia: 'R1', catena: true } as never)
  const [w1, r1, w2] = amb.azione().sort((x, y) => x.ordine - y.ordine) as [Azione, Azione, Azione]
  const c = w1.catena!.id
  amb.disco.set(`X:/orch/azioni/artefatti/${c}/1-scrittore.md`, `<!-- chipManager artefatto catena=${c} giro=1 ruolo=scrittore rif=- -->\nGuida alle login permissions dell'amministratore.`)
  amb.disco.set(`X:/orch/azioni/artefatti/${c}/1-revisore.md`, `<!-- chipManager artefatto catena=${c} giro=1 ruolo=revisore rif=1-scrittore.md -->\nAccorcia.`)
  for (const [x, f] of [[w1, '1-scrittore.md'], [r1, '1-revisore.md']] as const)
    amb.disco.set(`X:/orch/azioni/${x.id}.json`, JSON.stringify({ ...x, versione: x.versione + 1, stato: 'consegnata', artefatto: f }))
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: `avvia-${w2.id}` }).catch(() => {})
  expect([viste.length, amb.processi.filter(p => p.argv[1]?.endsWith('/compatibili.cjs') && p.argv[2] === 'completa').length]).toEqual([0, 0])
  expect(amb.azione().find(a => a.id === w2.id)).toMatchObject({ stato: 'proposta', esecutore: 'compatibile', provider: 'ollama' })
  await ui.unmount()
})

// --- Revisione F13a, giro 6: regole illeggibili alla composizione del testo di catena --------------------------------

/**
 * Una catena con scrittore esterno (Ollama o FreeLLMAPI) e la bozza v1 e il feedback già consegnati. `rompi` fa fallire le
 * letture del config dal primo artefatto letto in poi (`causa`: I/O, lista dei termini malformata, espressione che non
 * compila): così la sola lettura che fallisce è quella del compositore, come nel caso riprodotto.
 */
async function catenaEsterna($: Parameters<TestBody>[0], amb: ReturnType<typeof ambiente>, scrittore: { provider: string; modello: string }, extra: Record<string, unknown>) {
  const CONFIG = 'X:/casa/.claude/chipmanager/config.json'
  const cfg = (x: Record<string, unknown>) => JSON.stringify({ progetti: { 'acme/progetto': { fornitori: ['claude', 'codex', 'freellmapi'], freellmapi: { livello: 'R1' },
    compatibili: { ollama: 'R1' }, modoLavoro: { pipeline: { scrittore } }, ...x } } })
  amb.disco.set(CONFIG, cfg(extra))
  const prima = new Set(amb.azione().map(a => a.id))
  await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'Guida', brief: 'Scrivi la guida.', corsia: 'R1', catena: true } as never)
  const passi = amb.azione().filter(a => !prima.has(a.id)).sort((x, y) => x.ordine - y.ordine)
  expect(passi.length).toBe(4)
  const [w1, r1, w2] = passi as [Azione, Azione, Azione]
  const c = w1.catena!.id
  amb.disco.set(`X:/orch/azioni/artefatti/${c}/1-scrittore.md`, `<!-- chipManager artefatto catena=${c} giro=1 ruolo=scrittore rif=- -->\nIl bosco di cedro e i suoi sentieri.`)
  amb.disco.set(`X:/orch/azioni/artefatti/${c}/1-revisore.md`, `<!-- chipManager artefatto catena=${c} giro=1 ruolo=revisore rif=1-scrittore.md -->\nAccorcia.`)
  for (const [x, f] of [[w1, '1-scrittore.md'], [r1, '1-revisore.md']] as const)
    amb.disco.set(`X:/orch/azioni/${x.id}.json`, JSON.stringify({ ...x, versione: x.versione + 1, stato: 'consegnata', artefatto: f }))
  let armato = false
  let rotto: string | undefined
  let buono = ''
  // Il finto host registra ogni lettura in `letti` subito prima di leggere: lì si rompe il config al momento giusto.
  const letti = amb.letti as string[]
  // `quando`: al primo artefatto letto, o alla seconda lettura del config dopo il tasto (la prima è il controllo delle
  // regole di `avvia`, la seconda quella del compositore, in qualunque ordine legga gli artefatti).
  const rompi = (causa: 'io' | 'lista' | 'regex', quando: 'artefatto' | 'secondaLettura' = 'artefatto') => {
    armato = true
    let letture = 0
    buono = amb.disco.get(CONFIG)!
    // Le primitive sono congelate nel kit: il metodo proprio si definisce, non si assegna.
    Object.defineProperty(letti, 'push', { configurable: true, writable: true, value: (...xs: string[]) => {
      for (const x of xs) {
        if (armato && x === CONFIG) letture += 1
        if (armato && (quando === 'artefatto' ? x.includes('/artefatti/') : letture === 2)) {
          armato = false
          rotto = causa
          if (causa !== 'io') amb.disco.set(CONFIG, cfg(causa === 'lista' ? { sensibili: 'cedro' } : { sensibili: ['(cedro'] }))
        }
        if (rotto === 'io' && x === CONFIG) throw new Error('EIO')
      }
      return Array.prototype.push.apply(letti, xs)
    } })
  }
  const ripara = () => {
    armato = false
    rotto = undefined
    delete (letti as unknown as { push?: unknown }).push
    if (buono) amb.disco.set(CONFIG, buono)
  }
  return { w2, rompi, ripara, metti: (x: Record<string, unknown>) => amb.disco.set(CONFIG, cfg(x)) }
}
const inviati = (amb: ReturnType<typeof ambiente>) => amb.processi.filter(p => p.argv[2] === 'completa').length
const SCRITTORI = [{ provider: 'ollama', modello: 'qwen3:8b' }, { provider: 'freellmapi', modello: 'testo-compatto' }]

test('Revisione F13a, giro 6: regole illeggibili alla composizione PRIMA della conferma: niente conferma, nulla inviato (tre cause, due scrittori)', { options: { freellmapiKey: 'fl-prova-0123456789' } }, async ($, on) => {
  const amb = ambiente(on)
  configuraFree(amb)
  mock.clock(on)
  const viste: string[] = []
  conferme(on, testo => ((viste.push(testo)), 'Invia testo'))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  for (const scrittore of SCRITTORI)
    for (const causa of ['io', 'lista', 'regex'] as const) {
      const k = await catenaEsterna($, amb, scrittore, { sensibili: ['cedro'] })
      k.rompi(causa, 'secondaLettura')
      await ui.press({ key: `avvia-${k.w2.id}` }).catch(() => {})
      k.ripara()
      expect([scrittore.provider, causa, viste.length, inviati(amb), amb.azione().find(a => a.id === k.w2.id)!.stato]).toEqual([scrittore.provider, causa, 0, 0, 'proposta'])
    }
  await ui.unmount()
})

test('Revisione F13a, giro 6: termine aggiunto dopo la conferma e ultima lettura fallita: il passo si ferma prima dell\'invio (tre cause, due scrittori)', { options: { freellmapiKey: 'fl-prova-0123456789' } }, async ($, on) => {
  const amb = ambiente(on)
  configuraFree(amb)
  mock.clock(on)
  let dopoConferma: () => void = () => {}
  conferme(on, () => (dopoConferma(), 'Invia testo'))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  for (const scrittore of SCRITTORI)
    for (const causa of ['io', 'lista', 'regex'] as const) {
      const k = await catenaEsterna($, amb, scrittore, {})
      // Confermato il testo, il progetto aggiunge «cedro»; l'ultima lettura, quella del compositore, fallisce.
      dopoConferma = () => {
        k.metti({ sensibili: ['cedro'] })
        k.rompi(causa)
      }
      await ui.press({ key: `avvia-${k.w2.id}` }).catch(() => {})
      k.ripara()
      dopoConferma = () => {}
      const a = amb.azione().find(x => x.id === k.w2.id)!
      expect([scrittore.provider, causa, inviati(amb), a.stato, a.erroreCodice]).toEqual([scrittore.provider, causa, 0, 'fallita', 'cat.regoleNonLette'])
    }
  await ui.unmount()
})
