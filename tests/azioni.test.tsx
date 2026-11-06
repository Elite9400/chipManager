import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import {
  CADENZA_INIZIALE,
  rigaConsumo,
  modalitaDi,
  spesaDelMese,
  consigliaDove,
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
  datiLocali,
  faseDiAzione,
  mandato,
  normalizza,
  parametriAvvio,
  progettoDa,
  percentuale,
  pianifica,
  REGOLE_DEFAULT,
  regoleDa,
  repoGithub,
  sensibile,
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
import type { Consiglio } from '../hooks/logica'
import { DiscoIt } from './disco-it'
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
function ambiente(on: Parameters<TestBody>[1], opz: { cli?: boolean; senzaDir?: boolean; nascosto?: boolean; strumenti?: string[]; fonte?: (cmd: string, input: Record<string, unknown>) => unknown; mcp?: (server: string, tool: string, args: unknown) => unknown; modello?: (e: { prompt: string }) => unknown; attesa?: (cmd: string) => Promise<void> | undefined; api?: (cmd: string, a: string[], stdin: string | undefined) => [number, string] | undefined } = {}) {
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
  const processi: { argv: readonly string[]; stdin?: string }[] = []
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
  on('fs.stat', (_, e) => {
    const t = disco.get(p(e.path))
    if (t === undefined) throw new Error('ENOENT')
    return { value: { kind: 'file' as const, size: t.length, mtimeMs: disco.mtime.get(p(e.path)) ?? 0, isLink: false } }
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
  on('process.run', (_, e) => {
    const [exe, , cmd, ...a] = e.argv
    const fine = (exitCode: number, stdout = '') => ({ value: { exitCode, stdout, stderr: '' } as never })
    processi.push({ argv: e.argv, stdin: e.init?.stdin })
    if (exe === 'docker') return fine(0)
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
      disco.set(p(a[0]), JSON.stringify({ ...c, progetti: { ...c.progetti, [input.repo]: { ...c.progetti?.[input.repo], ...campi } } }))
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
      const az = JSON.parse(disco.get(`${dir}/${id}.json`)!)
      const f = `${dir}/esecuzioni/${tentativo}.json`
      if (az.stato !== 'in-avvio' || az.tentativo !== tentativo || disco.has(f)) return fine(4)
      disco.set(f, JSON.stringify({ id, tentativo, stato: 'avviata', ramo: `chipmanager/${tentativo}` }))
      return fine(0)
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
    expect(await ui.find({ type: 'Text', text: /^Da avviare e in coda/ })).toBeDefined()
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
const CONFIG_API = JSON.stringify({ progetti: { 'acme/progetto': { apiClaude: { budgetUsd: 20 } } } })
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
  expect(ingresso).toMatchObject({ chiave: CHIAVE_API, tetto: 2, budget: 20, modello: 'claude-opus-5-5' })
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
  expect(spesaDelMese({ v: 1, voci: { a: { mese, tetto: 2, stato: 'contato', costo: 3.2 }, b: { mese, tetto: 2, stato: 'prenotato' }, c: { mese: '2000-01', tetto: 9, stato: 'prenotato' }, d: { mese, tetto: 2, stato: 'contato', costo: null } } }, mese)).toBe(7.2)
  expect(spesaDelMese({ v: 2 }, mese)).toBeNull()
  const amb = ambiente(on)
  amb.disco.set('X:/orch/azioni/spesa-api.json', JSON.stringify({ v: 1, voci: { 'az-spesa001': { mese, tetto: 2, stato: 'contato', costo: 3.2 }, 'az-spesa002': { mese, tetto: 2, stato: 'prenotato' } } }))
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
  expect(await ui.find({ type: 'Text', text: 'API Claude: 5,20 USD di 20 USD (stimato, questo mese)' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^Il cloud di Claude consuma gli stessi limiti del piano/ })).toBeDefined()
  amb.disco.set('X:/orch/azioni/spesa-api.json', '{ rotto')
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
  amb.disco.set(CONFIG, JSON.stringify({ progetti: { 'acme/progetto': { apiClaude: { budgetUsd: 20 }, consigliere: 'suggerisci' } } }))
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE('desktop') })
  await ui.press({ key: 'ricarica' })
  expect(await ui.find({ type: 'Text', text: '→ locale · piano sotto l\'attenzione' })).toBeDefined()
  expect(JSON.parse(amb.disco.get(`X:/orch/azioni/${a.id}.json`)!).destinazione).toBeUndefined()
  amb.disco.set(CONFIG, JSON.stringify({ progetti: { 'acme/progetto': { apiClaude: { budgetUsd: 20 }, consigliere: 'applica' } } }))
  await ui.press({ key: 'ricarica' })
  await ui.press({ key: 'ricarica' })
  expect(JSON.parse(amb.disco.get(`X:/orch/azioni/${a.id}.json`)!).destinazione).toBe('local')
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

test('2.0: terzi vietati su R4/R5, dati locali e oltre il livello; vale anche sul revisore', () => {
  const a = base('a-free0001', 1, { repo: AUTORE.repo!, esecutore: 'freellmapi', revisore: 'claude', modello: 'testo-compatto', effort: 'low', corsia: 'R1' })
  expect(violazioni(a, RF)).toEqual([])
  expect(violazioni(a, { ...RF, risorse: RISORSE_DEFAULT }).map(m => m.k).join()).toContain('v.fornitoreNonAbilitato')
  for (const corsia of ['R2', 'R4', 'R5'] as const) expect(violazioni({ ...a, corsia }, RF).length).toBeGreaterThan(0)
  expect(violazioni({ ...a, corsia: 'R2' }, { ...RF, risorse: { ...RF.risorse, freellmapi: { ...RF.risorse.freellmapi, livello: 'R2' } } })).toEqual([])
  for (const brief of ['RSSMRA80A01H501U', 'nome@example.org', '10.2.3.4', 'storage/x', 'leggi .env'])
    expect(violazioni({ ...a, brief }, RF).map(m => m.k).join()).toContain('v.datiLan')
  expect(violazioni({ ...a, background: 'Leggi .env' }, RF).length).toBeGreaterThan(0)
  expect(violazioni(a, { ...RF, background: 'Leggi .env' }).length).toBeGreaterThan(0)
  expect(violazioni(base('a-r400001', 1, { corsia: 'R4' }), R).map(m => m.k).join()).toContain('v.r4Revisore')
  expect(violazioni(base('a-norev01', 1), { ...R, risorse: { ...RISORSE_DEFAULT, fornitori: ['claude'] } }).map(m => m.k).join()).toContain('v.revisoreNonAbilitato')
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
  expect(coloreLimite({ ...LIMITE, percentuale: 95 })).toBe('#DC2626')
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
    expect(await ui.find({ type: 'Text', text: /^Limiti e budget$/ })).toBeDefined()
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

test('2.0: FreeLLMAPI conferma il testo, nessun background inviato, risultato solo consegnato', async ($, on) => {
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

test('2.0: modifica durante la conferma e revoca progetto bloccano FreeLLMAPI', async ($, on) => {
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

test('2.0: revoca del fornitore durante la conferma ferma il testo prima della prenotazione', async ($, on) => {
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
  for (const testo of [/^Guida delle API$/, /^Revisione sessione$/, /^Codex · fix-ricerca$/, /^Sonnet 5\.5$/, /^34%$/, /^61%$/, /aperta a mano/, /^3 al lavoro/])
    expect(await ui.find({ type: 'Text', text: testo })).toBeDefined()
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
  expect(await ui.find({ key: 'sezione' })).toBeDefined()
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
    for (const testo of [/^Al lavoro per modello ed effort$/, stretta ? /^Sonnet 5\.5: medium 1 \(\+1 in coda\)$/ : /^Sonnet 5\.5$/, /^Limiti e budget$/, /attenzione da 70% · critica da 90%/, /nessuna soglia/,
      /^Contesto delle sessioni al lavoro$/, /^Guida delle API$/, /^Codex \+50%\. Valgono solo/, /Nessun avvio nelle ultime 24 ore/])
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
    expect(await ui.find({ type: 'Text', text: /^▕.+▏ 37% usato$/ })).toBeDefined()
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
  expect(caratteri('suggerisci_azione')).toBeLessThanOrEqual(1300)
  expect(caratteri('risorse_agenti')).toBeLessThanOrEqual(250)
  expect(amb.registrati.find(x => x.name === 'risorse_agenti')!.isDeferred).toBe(true)
  expect(amb.registrati.find(x => x.name === 'suggerisci_azione')!.isDeferred).toBe(false)
  // F4: proporre pesi è raro, quindi differito e corto.
  expect(caratteri('proponi_pesi')).toBeLessThanOrEqual(400)
  expect(amb.registrati.find(x => x.name === 'proponi_pesi')!.isDeferred).toBe(true)
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
