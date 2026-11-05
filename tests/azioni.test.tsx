import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import {
  COLORE_EFFORT,
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
  conUltime,
  fornitoriVisibili,
  limiteFresco,
  punteggio,
  RISORSE_DEFAULT,
  COLORE_MODELLO,
  corrisponde,
  dipendenze,
  dipendenzeChiuse,
  durata,
  effortPer,
  datiLocali,
  faseDiAzione,
  mandato,
  MODELLI,
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
  testoSu,
  taskAccertato,
  traguardiDa,
  trovaTask,
  violazioni,
  violazioniAvvio,
} from '../hooks/logica'
import type { Azione, Chiamante, Limite } from '../types'
import { INSTALLAZIONE, risorseLette, usoDesktop } from '../hooks/risorse'

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
  expect(m.prompt).toContain('Revisione: Claude (tu)')
  expect(m.prompt).toContain('stato "consegnata"')
  expect(m.background.length).toBeGreaterThanOrEqual(80)
})

test('mandato: Claude esegue, Codex rivede prendendo la corsia della macchina', () => {
  const m = mandato(base('a-claude1', 1), R, { disco: 'D:/m/disco.cjs' })
  expect(m.model).toBe('claude-opus-5-5')
  expect(m.prompt).toContain('Revisione: Codex')
  expect(m.prompt).toContain('corsia-codex --revisione -- codex exec -c model_reasoning_effort="xhigh" -s read-only')
  expect(m.prompt).not.toContain('codex exec -m')
})

test('etichette: ogni modello e ogni effort ha la sua tinta', () => {
  for (const m of [...MODELLI.claude, ...MODELLI.codex]) expect(COLORE_MODELLO[m]).toMatch(/^#[0-9A-F]{6}$/)
  expect(new Set(Object.values(COLORE_MODELLO)).size).toBe(Object.keys(COLORE_MODELLO).length)
  expect(Object.keys(COLORE_EFFORT)).toEqual(['low', 'medium', 'high', 'xhigh'])
  expect(testoSu('#F59E0B')).toBe('#111827')
})

test('dipendenze: si sbloccano solo esistenti e completate; scartate e inesistenti bloccano', () => {
  const a = base('a-primo01', 1, { stato: 'avviata' })
  const b = base('a-second1', 2, { dipende: ['a-primo01'] })
  expect(dipendenzeChiuse(b, [a, b])).toBe(false)
  expect(dipendenzeChiuse(b, [{ ...a, stato: 'consegnata' }, b])).toBe(false)
  expect(dipendenzeChiuse(b, [{ ...a, stato: 'completata' }, b])).toBe(true)
  expect(dipendenze(b, [b]).problemi.join()).toContain('non esiste')
  expect(dipendenze(b, [{ ...a, stato: 'scartata' }, b]).problemi.join()).toContain('scartata')
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
  expect(violazioni(base('a-ok000001', 1), REGOLE_DEFAULT).join()).toContain('routing.json non letto')
})

test('violazioni: matrice dei revisori, R4 non aggirabile con sensibile:false, cloud e corsie di Codex', () => {
  expect(violazioni(base('a-ok000001', 1), R)).toEqual([])
  expect(violazioni(base('a-haiku001', 1, { modello: 'claude-haiku-5-5' }), R).join()).toContain('non ammette Codex')
  const r4 = base('a-r4000001', 1, { titolo: 'Fix login MFA', sensibile: false, esecutore: 'codex', revisore: 'nessuno', permessi: 'bypassPermissions' })
  expect(sensibile(r4, R)).toBe(true)
  const v = violazioni(r4, R).join(' | ')
  for (const atteso of ['l\'autore resta Claude', 'revisione è obbligatoria', 'bypass', 'Codex esegue solo le corsie']) expect(v).toContain(atteso)
  const haikuR4 = base('a-r4000002', 1, { titolo: 'permessi OU', modello: 'claude-haiku-5-5', effort: 'low', revisore: 'claude' })
  expect(violazioni(haikuR4, R).join()).toContain('autore Opus o Fable')
  expect(violazioni(base('a-r4000003', 1, { corsia: 'R4', destinazione: 'cloud' }), R).join()).toContain('mai nel cloud')
  expect(violazioni(base('a-cf000001', 1, { destinazione: 'cloud', contesto: 'fork' }), R).join()).toContain('sessione nuova')
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
    ['a-due00001', 'corsia Codex occupata'],
    ['a-qua00001', 'aspetta che le dipendenze siano fuse'],
  ])
  expect(p.bloccate.map(b => b.a.id)).toEqual(['a-sei00001'])
  // La corsia tenuta da fuori (una revisione Codex in corso) blocca anche la prima.
  expect(pianifica([lista[0]!], lista, R, 3, true).coda[0]?.motivo).toBe('corsia Codex occupata')
  const occupate = [1, 2, 3].map(n => base(`a-run0000${n}`, 10 + n, { stato: 'avviata' }))
  expect(pianifica([lista[2]!], [...occupate, lista[2]!], R, 3).coda[0]?.motivo).toBe('limite di 3 sessioni in parallelo')
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
  expect(normalizza({ ...base('a-dat00001', 1), avviataIl: 'ieri' })).toBe('avviataIl non è una data')
  const vecchia = { ...base('a-vec00001', 1) } as Partial<Azione>
  delete vecchia.versione
  expect((normalizza(vecchia) as Azione).versione).toBe(0)
  expect(normalizza({ id: '../x', titolo: 't', brief: 'b', stato: 'proposta' })).toBe('id non valido')
  expect(normalizza({ ...base('a-noesec01', 1), esecutore: undefined })).toBe('esecutore o revisore non validi')
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
  expect(violazioni(base('a-cx000001', 1, { esecutore: 'codex', revisore: 'claude', corsia: 'R3', effort: 'low' }), R).join()).toContain('almeno effort xhigh')
  expect(regoleDa({ modelli_ammessi: ROUTING.modelli_ammessi, effort_ammessi: ROUTING.effort_ammessi }, 'x').lette).toBe(false)
})

test('cloud: solo mandati senza dati da LAN, e senza il background locale', () => {
  expect(datiLocali('Correggi il layout della tabella')).toBe(false)
  for (const s of ['RSSMRA80A01H501U', 'mario@esempio.it', '10.0.0.12', 'DB_PASSWORD=x', 'leggi .env', 'storage/upload']) expect(datiLocali(s)).toBe(true)
  expect(violazioni(base('a-cl000001', 1, { destinazione: 'cloud', brief: 'vedi log: 192.168.1.4' }), R).join()).toContain('niente cloud')
  const m = mandato(base('a-cl000002', 1, { destinazione: 'cloud', background: 'x'.repeat(100) + ' segreto locale' }), R)
  expect(m.background).not.toContain('segreto locale')
})

test('configurazione effettiva: modello e effort di chi avvia, fork che eredita, «qui» in bypass', () => {
  const chi: Chiamante = { io: 'm', repo: 'o/r', modello: 'claude-sonnet-5-5', effort: 'medium', permessi: 'bypassPermissions' }
  const a = base('a-ef000001', 1, { repo: 'o/r' })
  expect(violazioniAvvio(a, R, [a], chi).join()).toContain('non avvia Opus 5.5 da qui')
  const fork = { ...a, contesto: 'fork' as const }
  expect(violazioniAvvio(fork, R, [fork], chi).join()).toContain('il fork gira con Sonnet 5.5')
  const r4 = base('a-ef000002', 1, { repo: 'o/r', titolo: 'permessi OU', revisore: 'claude' })
  const opus: Chiamante = { ...chi, modello: 'claude-opus-5-5', effort: 'high' }
  expect(violazioniAvvio(r4, R, [r4], opus, true).join()).toContain('in bypass')
  expect(violazioniAvvio({ ...a, repo: undefined }, R, [a], opus).join()).toContain('senza progetto')
  expect(violazioniAvvio({ ...a, repo: 'altro/x' }, R, [a], opus).join()).toContain('altro/x')
})

test('cloud: credenziali in JSON, IPv6 e CF omocodici restano in LAN; niente Codex nel cloud', () => {
  for (const s of ['{"api_key":"valore-fittizio"}', 'token: abc', 'fe80::1ff:fe23:4567:890a', 'RSSMRALPAMNH501U', 'Authorization: Bearer abcdefghijklmnop'])
    expect(datiLocali(s)).toBe(true)
  expect(violazioni(base('a-cl000003', 1, { destinazione: 'cloud' }), R).join()).toContain('nel cloud niente Codex')
})

test('metadati di chi avvia sconosciuti: le guardie che ne dipendono bloccano', () => {
  const r4 = base('a-md000001', 1, { repo: 'o/r', titolo: 'permessi OU', revisore: 'claude', permessi: 'acceptEdits' })
  const ignoto: Chiamante = { io: 'm', repo: 'o/r', modello: 'claude-opus-5-5' }
  const v = violazioniAvvio(r4, R, [r4], ignoto, true).join()
  expect(v).toContain('modalità permessi')
  expect(v).toContain('effort')
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
  expect(violazioni(lungo, R).join()).toContain('1500 caratteri')
  // La riga dei revisori serve anche per un autore Codex.
  const revisori = { ...R.revisori }
  delete revisori['gpt-6.1-sol']
  expect(violazioni(base('a-sx000001', 1, { esecutore: 'codex', revisore: 'claude', corsia: 'R2' }), { ...R, revisori }).join()).toContain('riga dei revisori')
})

test('codex senza corsia, o routing senza la regola: bloccato', () => {
  expect(violazioni(base('a-cs000001', 1, { esecutore: 'codex', revisore: 'claude' }), R).join()).toContain('Codex vuole una corsia')
  const senza = regoleDa({ ...ROUTING, corsia_codex: { ...ROUTING.corsia_codex, effort: {} } }, 'x')
  expect(senza.lette).toBe(false)
  const r = { ...R, revisori: {} }
  expect(violazioni(base('a-mx000001', 1, { revisore: 'claude' }), r).join()).toContain('riga dei revisori')
})

// --- il pannello contro un engine finto --------------------------------------------------------------

/** Engine finto: disco in memoria, helper (lock/CAS) e `gh` emulati, servizio di sessione scriptabile. */
function ambiente(on: Parameters<TestBody>[1], opz: { cli?: boolean; senzaDir?: boolean; strumenti?: string[]; fonte?: (cmd: string, input: Record<string, unknown>) => unknown; mcp?: (server: string, tool: string, args: unknown) => unknown } = {}) {
  const disco = new Map<string, string>()
  const p = (s: string | undefined) => (s ?? '').replace(/\\/g, '/')
  const chiamate: { server: string; tool: string; args: Record<string, unknown> }[] = []
  const toast: string[] = []
  const processi: { argv: readonly string[]; stdin?: string }[] = []
  disco.set(p('X:/repo/.claude/routing.json'), JSON.stringify(ROUTING))
  disco.set('X:/casa/.claude/chipmanager/config.json', JSON.stringify({ progetti: { 'acme/progetto': { milestoneGithub: true } } }))
  on('env.get', (_, e) => ({ value: e.name === 'CHIPMANAGER_DIR' && !opz.senzaDir ? 'X:/orch' : e.name === 'USERPROFILE' ? 'X:/casa' : undefined }))
  on('session.id', () => ({ value: 'sessione-master' }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('tool.list', () => ({ value: [...(opz.cli ? [] : [{ name: 'mcp__ccd_session__start_session' }]), ...(opz.strumenti ?? []).map(name => ({ name }))] as never }))
  on('session.repo', () => ({ value: { root: 'X:/repo', remote: 'https://github.com/acme/progetto.git', internal: false, repo: null } as never }))
  on('fs.exists', (_, e) => ({ value: [...disco.keys()].some(k => k === p(e.path) || k.startsWith(`${p(e.path)}/`)) }))
  on('fs.list', (_, e) => ({
    value: [...disco.keys()]
      .filter(k => k.startsWith(`${p(e.path)}/`) && !k.slice(p(e.path).length + 1).includes('/'))
      .map(k => ({ name: k.slice(p(e.path).length + 1), kind: 'file' as const, size: 1, mtimeMs: 0, isLink: false })),
  }))
  on('fs.read', (_, e) => {
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
      const risposta = opz.fonte?.(cmd!, input) ?? (cmd === 'limiti' ? { limiti: [], proxy: 'non abilitato', chiavi: { anthropic: false, deepseek: false, freellmapi: false } } : { risultato: 'Bozza pronta.' })
      return fine(0, JSON.stringify(risposta))
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
    if (cmd === 'configura') {
      const input = JSON.parse(e.init!.stdin!)
      const precedente = disco.get(p(a[0])) ?? null
      if (precedente !== input.atteso) return fine(4)
      const c = precedente === null ? {} : JSON.parse(precedente)
      disco.set(p(a[0]), JSON.stringify({ ...c, progetti: { ...c.progetti, [input.repo]: { ...c.progetti?.[input.repo], ...input.campi } } }))
      return fine(0)
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
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('prompt.submit', (_, e) => ({ text: (e as { text: string }).text }))
  on('tool.register', (_, e) => ({ value: { tool: e.name } }))
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
  return { disco, chiamate, toast, processi, azione }
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
  expect(String((r as { result?: unknown }).result)).toContain('nel pannello')
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
  expect(await rifiuto({ stato: 'completata', tentativo: 'az-x' })).toContain('non si passa')
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
  expect(String(r.result)).toContain('così non può partire')
  expect(amb.azione()[0]!.sensibile).toBeUndefined()
  const d = (await $.tool.call({ tool: 'mcp__chip-manager__suggerisci_azione', titolo: 'B', brief: 'x', dipende: ['a-inesist01'] } as never)) as {
    deny?: string
    text?: string
  }
  expect(d.deny ?? d.text).toContain('inesistenti')
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
  expect(amb.azione()[0]!.errore).toContain('archiviata senza fusione')
  // Senza issue il task del ramo non si associa: chiude il committente (un ramo ospita più lavori).
  amb.disco.set('X:/orch/registro.json', JSON.stringify({ task: { vecchio: { issue: 1, ramo: 'claude/x', stato: 'fuso', creato: '2026-01-01' }, t1: { issue: 1, ramo: 'claude/x', stato: 'fuso', creato: '2999-01-01' } } }))
  await clock.advance(20_000)
  expect(amb.azione()[0]!.stato).toBe('consegnata')
  const conIssue = amb.azione()[0]!
  amb.disco.set(`X:/orch/azioni/${conIssue.id}.json`, JSON.stringify({ ...conIssue, issue: 1 }))
  await clock.advance(20_000)
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
  expect(amb.azione()[0]).toMatchObject({ stato: 'in-avvio', manuale: true })
  const presa = (args: Record<string, unknown>) =>
    $.tool.call({ tool: 'mcp__chip-manager__aggiorna_azione', id, stato: 'presa', ...args } as never) as Promise<{ deny?: string; result?: unknown }>
  expect((await presa({ tentativo: 'az-altro' })).deny).toContain('tentativo')
  expect((await presa({ tentativo: t })).deny).toBeUndefined()
  expect((await presa({ tentativo: t })).deny).toContain('non è (più) prendibile')
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
  expect(r.deny ?? r.text).toContain('manca titolo')
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
  expect(violazioniAvvio(a, R, [a], { io: 'm', repo: null, modello: 'claude-opus-5-5', effort: 'high', permessi: 'auto' }).join()).toContain(
    'non so in quale progetto',
  )
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
  expect(violazioniAvvio(q, R, [q], chiB).join()).toContain('fork della conversazione di un\'altra sessione')
  expect(violazioniAvvio(q, R, [q], chiA).join()).not.toContain('fork della conversazione')
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
  expect(violazioniAvvio(senza, R, [senza], chi).join()).toContain('senza conversazione d\'origine')
})

test('configurazione locale: assente = generica; sezione del progetto; forme non valide = motivo', () => {
  expect(progettoDa(null, 'acme/progetto')).toMatchObject({ routing: '.claude/routing.json', sensibili: [] })
  expect(progettoDa({ progetti: {} }, 'acme/progetto')).toMatchObject({ routing: '.claude/routing.json' })
  const cfg = { progetti: { 'acme/progetto': { routing: 'cfg/routing.json', sensibili: ['magazzino'], background: 'Progetto Acme.' } } }
  expect(progettoDa(cfg, 'acme/progetto')).toMatchObject({ routing: 'cfg/routing.json', sensibili: ['magazzino'], background: 'Progetto Acme.' })
  expect(progettoDa(cfg, 'altro/repo')).toMatchObject({ sensibili: [] })
  for (const rotta of [[], { progetti: [] }, { progetti: { 'acme/progetto': 'x' } }]) expect(typeof progettoDa(rotta, 'acme/progetto')).toBe('string')
  for (const routing of ['/etc/x.json', 'C:/x.json', '../fuori.json', 'a/../../b.json', ''])
    expect(progettoDa({ progetti: { 'acme/progetto': { routing } } }, 'acme/progetto')).toContain('relativo')
  expect(progettoDa({ progetti: { 'acme/progetto': { sensibili: ['(rotta'] } } }, 'acme/progetto')).toContain('non valido')
  expect(progettoDa({ progetti: { 'acme/progetto': { sensibili: 'x' } } }, 'acme/progetto')).toContain('elenco')
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
    expect(typeof progettoDa({ progetti: { 'acme/progetto': p } }, 'acme/progetto')).toBe('string')
  const config = { progetti: { 'altro/repo': { fornitori: ['freellmapi'] } } }
  expect(progettoDa(config, 'acme/progetto')).toMatchObject({ risorse: { fornitori: ['claude', 'codex'] } })
})

test('2.0: terzi vietati su R4/R5, dati locali e oltre il livello; vale anche sul revisore', () => {
  const a = base('a-free0001', 1, { repo: AUTORE.repo!, esecutore: 'freellmapi', revisore: 'claude', modello: 'testo-compatto', effort: 'low', corsia: 'R1' })
  expect(violazioni(a, RF)).toEqual([])
  expect(violazioni(a, { ...RF, risorse: RISORSE_DEFAULT }).join()).toContain('non abilitato')
  for (const corsia of ['R2', 'R4', 'R5'] as const) expect(violazioni({ ...a, corsia }, RF).length).toBeGreaterThan(0)
  expect(violazioni({ ...a, corsia: 'R2' }, { ...RF, risorse: { ...RF.risorse, freellmapi: { ...RF.risorse.freellmapi, livello: 'R2' } } })).toEqual([])
  for (const brief of ['RSSMRA80A01H501U', 'nome@example.org', '10.2.3.4', 'storage/x', 'leggi .env'])
    expect(violazioni({ ...a, brief }, RF).join()).toContain('dati da tenere in LAN')
  expect(violazioni({ ...a, background: 'Leggi .env' }, RF).length).toBeGreaterThan(0)
  expect(violazioni(a, { ...RF, background: 'Leggi .env' }).length).toBeGreaterThan(0)
  expect(violazioni(base('a-r400001', 1, { corsia: 'R4' }), R).join()).toContain('revisore resta Claude')
  expect(violazioni(base('a-norev01', 1), { ...R, risorse: { ...RISORSE_DEFAULT, fornitori: ['claude'] } }).join()).toContain('revisore codex non abilitato')
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
  expect(finestre[2]).toMatchObject({ nome: 'Claude uso extra · tetto 4.00 EUR', percentuale: 25 })
  expect(limiteFresco(finestre[0]!)).toBe(true)
  expect(usoDesktop(piano({ windows: [], extraUsage: { enabled: false, percentUsed: 0 } }), letto)).toEqual([])
  expect(usoDesktop({ plan: { status: 'not_applicable' } }, letto)[0]).toMatchObject({ id: 'claude', errore: 'limiti di piano non applicabili qui' })
  expect(usoDesktop({ plan: { status: 'unavailable', note: 'riprova tra poco' } }, letto)[0]!.errore).toBe('limiti di piano non leggibili ora: riprova tra poco')
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
    await ui.input({ key: 'percentuale-fornitore-codex', text: '120' })
    expect(JSON.parse(amb.disco.get('X:/casa/.claude/chipmanager/config.json')!).progetti['acme/progetto'].pesi[0]).toMatchObject({ nome: 'codex', percentuale: 120 })
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
  await ui.select({ key: 'fornitore-freellmapi', value: 'si' })
  expect(JSON.parse(amb.disco.get('X:/casa/.claude/chipmanager/config.json')!).progetti['acme/progetto']).toEqual({ soloLocale: true })
  expect(await ui.find({ type: 'Text', text: /Impostazioni cambiate altrove/ })).toBeDefined()
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
    expect(typeof progettoDa({ progetti: { 'acme/progetto': { cartella } } }, 'acme/progetto')).toBe('string')
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
    [id(5), 'Sessione senza titolo', 'ferma'],
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
      ? [{ id: 'esempio-0001', cwd: 'X:/repo/.claude/worktrees/fix-ricerca', ramo: 'fix-ricerca', modello: 'gpt-6-astra', effort: 'xhigh', inCorso: true, attivita: quando(0), token: 61_000, finestra: 100_000 }]
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
  // Terminale stretto: cadono Contesto e Attività, modello ed effort in una colonna.
  const t = await $.ui.mount({ ...PANE('terminal') })
  expect(await t.find({ type: 'Text', text: /^Modello · effort$/ })).toBeDefined()
  expect(await t.find({ type: 'Text', text: /^Contesto$/ })).toBeUndefined()
  expect(await t.find({ type: 'Text', text: /^GPT-6 Astra · xhigh$|^gpt-6-astra · xhigh$/ })).toBeDefined()
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
  expect(await ui.find({ type: 'Text', text: /^Politica di questo progetto$/ })).toBeDefined()
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
    expect(typeof r(rotta)).toBe('string')
  const s = { attenzione: 60, critica: 80 }
  expect([livelloDi(59, s), livelloDi(60, s), livelloDi(80, s), livelloDi(99, null)]).toEqual(['ok', 'attenzione', 'critica', 'ok'])
  expect(coloreLimite({ ...LIMITE, percentuale: 85 }, Date.now(), s)).toBe('#DC2626')
  expect(coloreLimite({ ...LIMITE, percentuale: 85 })).toBe('#D97706')
  expect(coloreLimite({ ...LIMITE, percentuale: 99 }, Date.now(), null)).toBe('#059669')
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
  expect(await ui.find({ type: 'Text', text: /Claude 93% oltre la soglia critica/ })).toBeDefined()
  await ui.press({ key: 'tutte' })
  expect(domande.at(-1)).toMatch(/^Oltre la soglia critica: Claude piano · settimanale al 93% \(critica da 90%\)\. Avvio 1 sessione/)
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
    for (const testo of [/^Al lavoro per modello ed effort$/, /^Sonnet 5\.5$/, /^Limiti e budget$/, /attenzione da 70% · critica da 90%/, /nessuna soglia/,
      /^Contesto delle sessioni al lavoro$/, /^Guida delle API$/, /^Codex \+50%\. Valgono solo/, /Nessun avvio nelle ultime 24 ore/])
      expect(await ui.find({ type: 'Text', text: testo })).toBeDefined()
    // Sonnet 5.5 · medium: una sessione al lavoro e una chip in coda nella stessa cella.
    expect((await ui.findAll({ type: 'Text', text: /^1 \+1$/ })).length).toBe(1)
    await ui.press({ key: 'vista-lavoro' })
    await ui.unmount()
  }
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
    expect(await ui.find({ type: 'Text', text: /100%$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /non disponibile|FreeLLMAPI|Claude API|DeepSeek|Codex piano|Codex \(95%\)|Nessun limite collegato/ })).toBeUndefined()
    // Impostazioni resta il posto dove si vedono tutti i fornitori.
    await ui.press({ key: 'impostazioni' })
    expect(await ui.find({ key: 'fornitore-codex' })).toBeDefined()
    await ui.press({ key: 'vista-lavoro' })
    await ui.unmount()
  }
})

test('2.3.1: giro fallito dopo uno riuscito: la misura resta, poi invecchia senza barra e con un segno nella sintesi', async ($, on) => {
  // Il clock simulato muove $.clock, non Date: l'età della misura la porta la fonte, come una status line non aggiornata.
  let rotto = false
  let eta = 0
  ambiente(on, {
    fonte: cmd => (cmd !== 'limiti' ? undefined : rotto ? { limiti: 'formato cambiato' }
      : RISPOSTA([RIGA('claude-weekly', 'claude', 'Claude piano · settimanale', { percentuale: 37, unita: '%', letto: new Date(Date.now() - eta).toISOString() })])),
  })
  const clock = mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  rotto = true
  await clock.advance(300_000)
  let ui = await $.ui.mount({ ...PANE('terminal') })
  expect(await ui.find({ type: 'Text', text: /Claude 37%/ })).toBeDefined()
  await ui.press({ key: 'vista-carico' })
  expect(await ui.find({ type: 'Text', text: /^Limiti non letti: helper non disponibile$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Claude piano · settimanale: 37% usato/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /100%$/ })).toBeDefined()
  await ui.press({ key: 'vista-lavoro' })
  await ui.unmount()
  rotto = false
  eta = 12 * 60_000
  await clock.advance(300_000)
  ui = await $.ui.mount({ ...PANE('terminal') })
  expect(await ui.find({ type: 'Text', text: /Claude: limiti non letti da 12 min/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Claude 37%/ })).toBeUndefined()
  await ui.press({ key: 'vista-carico' })
  expect(await ui.find({ type: 'Text', text: /Claude piano · settimanale: 37% usato/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /vecchio, non conta nelle scelte/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /100%$/ })).toBeUndefined()
  await ui.press({ key: 'vista-lavoro' })
  await ui.unmount()
})
