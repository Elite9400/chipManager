// C1 (piano grafica): vista Lavoro e intestazione responsive, scheda compatta, «Avvia la prossima», motivi del blocco.
// Solo dati d'esempio: progetto acme/progetto, sessioni e titoli inventati.
import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { ACCENTO, contrasto, EFFORT, FAMIGLIA, GRIGIO, ICONA, MOTORE, SFONDI, sopra, STATO, VELO } from '../hooks/tema'
import type { Azione, Limite } from '../types'
import { t } from '../hooks/lingua'
import { DiscoIt } from './disco-it'
import { applicaPatch } from '../hooks/bilanciamento'
import { ANTEPRIMA, confrontaControlli, confrontaF9, controlliF9, fineF9, normaF9 } from './f9'
import { PRIMA } from './f9-prima'

type On = Parameters<TestBody>[1]
const p = (s: string | undefined) => (s ?? '').replace(/\\/g, '/')
const SID = 'local_12345678-1234-1234-1234-123456789abc'
const DIR = 'X:/orch/azioni'

const ROUTING = {
  modelli_ammessi: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-fable-5-1', 'gpt-6.1-sol', 'gpt-6-astra'],
  effort_ammessi: ['low', 'medium', 'high', 'xhigh', 'max'],
  tetto_per_modello: { 'claude-fable-5-1': 'xhigh' },
  revisione: {
    revisori_ammessi_per_autore: {
      'claude-opus-5-5': ['claude-fable-5-1', 'motore:codex'],
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

/** Come le etichette dei pulsanti: il numero d'ordine (le rende uniche) e il titolo accorciato a 24 caratteri. */
const breve = (n: number, t: string) => `${n} · ${t.length > 24 ? `${t.slice(0, 23)}…` : t}`
const LUNGO = 'Filtro di ricerca per le liste lunghe, con paginazione lato server e conteggio dei risultati in testata'
const az = (id: string, ordine: number, extra: Partial<Azione> = {}): Azione => ({
  id, versione: 0, titolo: `Esempio ${id}`, brief: 'Frase d\'esempio.', ordine, dipende: [], esecutore: 'claude', revisore: 'codex',
  modello: 'claude-opus-5-5', stato: 'proposta', creata: '2026-11-04T00:00:00Z', aggiornata: '2026-11-04T00:00:00Z', repo: 'acme/progetto', ...extra,
})

/** Engine finto ridotto: disco in memoria, prenotazione atomica dell'helper, avvio desktop che riesce. */
function ambiente(on: On, azioni: Azione[], limiti: Limite[] = [], opz: { codexOccupato?: boolean; esecuzione?: string } = {}) {
  const toast: string[] = []
  const disco = new DiscoIt()
  disco.set('X:/repo/.claude/routing.json', JSON.stringify(ROUTING))
  disco.set('X:/casa/.claude/chipmanager/config.json', JSON.stringify({ progetti: { 'acme/progetto': {} } }))
  for (const a of azioni) disco.set(`${DIR}/${a.id}.json`, JSON.stringify(a))
  const chiamate: { tool: string; args: Record<string, unknown> }[] = []
  const versione = (f: string) => {
    const su = disco.get(f)
    return su === undefined ? 'nuovo' : String(JSON.parse(su).versione ?? 0)
  }
  on('env.get', (_, e) => ({ value: e.name === 'CHIPMANAGER_DIR' ? 'X:/orch' : e.name === 'USERPROFILE' ? 'X:/casa' : e.name === 'OS' ? 'Windows_NT' : undefined }))
  on('session.id', () => ({ value: 'sessione-master' }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('tool.list', () => ({ value: [{ name: 'mcp__ccd_session__start_session' }] as never }))
  on('session.repo', () => ({ value: { root: 'X:/repo', remote: 'https://github.com/acme/progetto.git', internal: false, repo: null } as never }))
  on('fs.exists', (_, e) => ({ value: [...disco.keys()].some(k => k === p(e.path) || k.startsWith(`${p(e.path)}/`)) }))
  on('fs.list', (_, e) => ({
    value: [...disco.keys()]
      .filter(k => k.startsWith(`${p(e.path)}/`) && !k.slice(p(e.path).length + 1).includes('/'))
      .map(k => ({ name: k.slice(p(e.path).length + 1), kind: 'file' as const, size: disco.get(k)!.length, mtimeMs: 1, isLink: false })),
  }))
  // F10: come l'host, anche le cartelle (prefisso di un file) e la radice del disco; `realPath` è il percorso stesso.
  on('fs.stat', (_, e) => {
    const q = p(e.path).replace(/\/+$/, '')
    const t = disco.get(q)
    const cartella = t === undefined && (/^[A-Za-z]:$/.test(q) || [...disco.keys()].some(k => k.startsWith(`${q}/`)))
    if (t === undefined && !cartella) throw new Error('ENOENT')
    return { value: { kind: cartella ? 'dir' as const : 'file' as const, size: t?.length ?? 0, mtimeMs: t?.length ?? 0, isLink: false, ...(e.resolve && { realPath: q }) } }
  })
  on('fs.read', (_, e) => {
    const t = disco.get(p(e.path))
    if (t === undefined) throw new Error('ENOENT')
    return { value: t }
  })
  on('fs.write', (_, e) => (disco.set(p(e.path), e.text), { value: undefined }))
  on('ui.panes', () => ({ value: [{ id: 'chipManager', title: 'chipManager', isShown: true, isFocused: false, isPlaced: true }] }))
  // F9: gli argomenti di ogni processo (helper compreso) e il suo stdin, per confrontare gli effetti prima e dopo.
  const processi: unknown[][] = []
  on('process.run', (_, e) => {
    const ingresso = (() => {
      try {
        return e.init?.stdin === undefined ? undefined : JSON.parse(String(e.init.stdin))
      } catch {
        return String(e.init?.stdin)
      }
    })()
    processi.push([...e.argv].slice(2).concat(ingresso === undefined ? [] : [ingresso]))
    const [, , cmd, ...a] = e.argv
    const fine = (exitCode: number, stdout = '') => ({ value: { exitCode, stdout, stderr: '' } as never })
    if (e.argv[1]?.endsWith('/fornitori.cjs'))
      return fine(0, JSON.stringify(cmd === 'limiti' ? { limiti, proxy: 'non abilitato', chiavi: { anthropic: false, deepseek: false, freellmapi: false } } : {}))
    // La corsia Codex della macchina: occupata da fuori (un'altra sessione, una revisione) quando il test lo chiede.
    if (cmd === 'occupata') return fine(opz.codexOccupato ? 1 : 0)
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
    if (cmd === 'stato-esecuzione' && opz.esecuzione) return fine(0, opz.esecuzione)
    // Come l'helper vero: CAS sul testo intero, poi la stessa fusione per strato (gemello TS di applicaPatch).
    if (cmd === 'configura') {
      const q = JSON.parse(String(e.init?.stdin)) as { atteso: string | null; repo: string; campi: Record<string, unknown>; account?: Record<string, unknown>; lingua?: string; togli?: { progetto?: string[]; account?: string[] } }
      const f = p(a[0])
      if ((disco.get(f) ?? null) !== q.atteso) return fine(4)
      const c = q.atteso === null ? {} : JSON.parse(q.atteso)
      disco.set(f, JSON.stringify({ ...c, progetti: { ...c.progetti, [q.repo]: applicaPatch(c.progetti?.[q.repo] ?? {}, q.campi, q.togli?.progetto) },
        ...(q.account && { account: applicaPatch(c.account ?? {}, q.account, q.togli?.account) }), ...(q.lingua !== undefined && { lingua: q.lingua }) }))
      return fine(0)
    }
    return fine(2)
  })
  on('mcp.call', (_, e) => {
    chiamate.push(e as never)
    const testo = (v: unknown) => ({ value: { isError: false, content: [{ type: 'text', text: typeof v === 'string' ? v : JSON.stringify(v) }] } as never })
    if (e.tool === 'get_session') return testo({ model: 'claude-opus-5-5', effort: 'high', permissionMode: 'auto' })
    if (e.tool === 'list_sessions') return testo(chiamate.filter(c => c.tool === 'start_session').map(c => ({ sessionId: SID, name: c.args.name })))
    if (e.tool === 'start_session') return testo(`started ${SID}`)
    return testo({})
  })
  on('ui.toast', (_, e) => (toast.push(String((e as { text?: unknown }).text)), { value: undefined }))
  on('ui.notify', () => ({ value: { isSent: false, reason: 'no-surface' } as never }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('tool.register', (_, e) => ({ value: { tool: e.name } }))
  on('command.register', () => ({ value: { command: 'chipmanager' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  const azione = (id: string) => JSON.parse(disco.get(`${DIR}/${id}.json`)!) as Azione
  return { disco, chiamate, toast, processi, azione, avvii: () => chiamate.filter(c => c.tool === 'start_session') }
}

const PANE = (surface: 'desktop' | 'terminal', colonne: number) =>
  ({
    plugin: 'chip-manager', surface, component: 'Pane', requestId: 'chipManager',
    props: { title: 'chipManager', isFocused: false, bodyColumns: colonne, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} },
  }) as const

const SUPERFICI = ['desktop', 'terminal'] as const
const LARGHEZZE = [60, 90, 130] as const

// Una chip per ogni riga della matrice C1.6. Il fork di un'altra conversazione non parte come sessione nuova, ma
// «Fallo qui» (la sua guardia) lo ammette: la riga bloccata lo tiene (§10).
const MATRICE = [
  az('a-avviab01', 1, { titolo: LUNGO, brief: 'Aggiungere il filtro alla lista d\'esempio.\nSecondo paragrafo che non si mostra.', issue: 123 }),
  az('a-blocca01', 2, { titolo: 'Bozza da un\'altra conversazione', contesto: 'fork', origineFork: 'altra-sessione', origineNome: 'Altra' }),
  az('a-coda0001', 3, { titolo: 'Guida d\'esempio in coda', stato: 'accodata', motivoCoda: 'limite di 3 sessioni in parallelo' }),
  az('a-fallit01', 4, { titolo: 'Esportazione d\'esempio fallita', stato: 'fallita', errore: 'la sessione non è partita' }),
  az('a-avviat01', 6, { titolo: 'Indici di esempio al lavoro', stato: 'avviata', sessione: 'local_22345678-1234-1234-1234-123456789abc', lanciataDa: 'sessione-master', avviataIl: '2026-11-05T10:00:00Z' }),
  // Due titoli con lo stesso inizio: accorciati coincidono, le etichette no.
  az('a-docapi01', 7, { titolo: 'Aggiorna documentazione API' }),
  az('a-doccli01', 8, { titolo: 'Aggiorna documentazione CLI' }),
  az('a-conseg01', 5, { titolo: 'Legenda d\'esempio consegnata', stato: 'consegnata', sessione: SID, lanciataDa: 'sessione-master', avviataIl: '2026-11-05T10:00:00Z' }),
]
/** Le azioni che ogni stato della matrice deve offrire sulla riga, per chiave del pulsante. */
const AZIONI_PER_STATO: Record<string, string[]> = {
  'a-avviab01': ['avvia', 'qui', 'mod', 'su', 'giu', 'scarta'],
  'a-blocca01': ['qui', 'perche', 'mod', 'su', 'giu', 'scarta'],
  'a-coda0001': ['annulla', 'mod', 'su', 'giu', 'scarta'],
  'a-fallit01': ['riprova', 'chiedi', 'mod', 'su', 'giu', 'scarta'],
  'a-conseg01': ['vedi', 'fatta', 'mod'],
  // Avviata e non ferma: sta in «Al lavoro adesso», con la stessa riga di azioni della matrice.
  'a-avviat01': ['vedi', 'fatta', 'mod'],
}

type Pulsante = { key?: string; label?: string }
/** Le props di ogni Button dell'albero disegnato. */
function pulsanti(n: unknown): Pulsante[] {
  if (!n || typeof n !== 'object') return []
  if (Array.isArray(n)) return n.flatMap(pulsanti)
  const x = n as { type?: string; props?: Pulsante; children?: unknown }
  return [...(x.type === 'Button' && x.props ? [x.props] : []), ...pulsanti(x.children)]
}
// Le azioni delle righe: il desktop può disegnarne l'etichetta, che deve stare corta e restare unica.
const AZIONI_RIGA = /^(avvia|riprova|qui|chiedi|perche|annullaT|annulla|fatta|mod|su|giu|scarta)-/

test('C1: a 60, 90 e 130 colonne, desktop e terminale: titoli interi, «▶ Avvia» presente, nessuna azione persa', async ($, on) => {
  ambiente(on, MATRICE)
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  for (const surface of SUPERFICI)
    for (const colonne of LARGHEZZE) {
      const ui = await $.ui.mount(PANE(surface, colonne))
      expect(await ui.find({ type: 'Text', text: LUNGO })).toBeDefined()
      const avvia = await ui.find({ key: 'avvia-a-avviab01' })
      // Sempre il primo pulsante della sua riga: si vede «▶ Avvia», l'etichetta dice anche quale chip.
      expect(avvia?.text).toBe('▶ Avvia')
      expect(avvia?.props.label).toBe(`▶ Avvia ${breve(1, LUNGO)}`)
      expect((await ui.find({ key: 'su-a-avviab01' }))?.props.label).toBe(`↑ ${breve(1, LUNGO)}`)
      expect((await ui.find({ key: 'scarta-a-doccli01' }))?.props.label).toBe(`Scarta ${breve(8, 'Aggiorna documentazione CLI')}`)
      const tutti = pulsanti(await ui.drawn())
      const etichette = tutti.map(b => b.label ?? '')
      // Ogni etichetta dell'albero è unica; quelle delle azioni di riga anche corte.
      for (const b of tutti) {
        if (etichette.filter(l => l === (b.label ?? '')).length > 1) throw new Error(`${b.key}: etichetta ripetuta «${b.label}»`)
        // Verbo, numero d'ordine e al più 24 caratteri di titolo.
        if (AZIONI_RIGA.test(b.key ?? '') && (b.label ?? '').length > 60) throw new Error(`${b.key}: etichetta lunga «${b.label}»`)
      }
      for (const [id, chiavi] of Object.entries(AZIONI_PER_STATO))
        for (const k of chiavi) if (!(await ui.find({ key: `${k}-${id}` }))) throw new Error(`${surface} ${colonne}: manca ${k}-${id}`)
      // La chip bloccata non ha «Avvia»; quella consegnata non si riordina.
      expect(await ui.find({ key: 'avvia-a-blocca01' })).toBeUndefined()
      expect(await ui.find({ key: 'su-a-conseg01' })).toBeUndefined()
      // Riga 2 in inchiostro, riga 3 la prima riga del mandato.
      for (const testo of [/^Opus 5\.5$/, /^#123$/, /^Aggiungere il filtro alla lista d'esempio\.$/])
        expect(await ui.find({ type: 'Text', text: testo })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /Secondo paragrafo/ })).toBeUndefined()
      // Le viste come chip di scelta, con i tasti di sempre.
      // F5.8: il solo nome; la scelta sta nel colore, il tasto resta.
      expect((await ui.find({ key: 'vista-lavoro' }))?.props).toMatchObject({ label: 'Lavoro', variant: 'primary', hotkey: '1' })
      expect((await ui.find({ key: 'vista-carico' }))?.props).toMatchObject({ label: 'Carico', plain: true, dimColor: true, hotkey: '2' })
      await ui.unmount()
    }
})

test('C1: «n» avvia la prima chip che partirebbe adesso, e solo quella', async ($, on) => {
  const amb = ambiente(on, [
    az('a-blocca01', 1, { titolo: 'Prima ma bloccata', contesto: 'fork', origineFork: 'altra-sessione' }),
    az('a-prossi01', 2, { titolo: 'Seconda, la prossima' }),
    az('a-terza001', 3, { titolo: 'Terza, dopo' }),
  ])
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  for (const surface of SUPERFICI) {
    const ui = await $.ui.mount(PANE(surface, 90))
    expect((await ui.find({ key: 'prossima' }))?.text).toBe('Avvia la prossima: Seconda, la prossima')
    await ui.unmount()
  }
  const ui = await $.ui.mount(PANE('terminal', 60))
  await ui.press({ key: 'prossima' })
  expect(amb.avvii().length).toBe(1)
  expect(amb.azione('a-prossi01').stato).toBe('avviata')
  expect(amb.azione('a-blocca01').stato).toBe('proposta')
  expect(amb.azione('a-terza001').stato).toBe('proposta')
  // Ora la prossima è la terza.
  expect((await ui.find({ key: 'prossima' }))?.text).toBe('Avvia la prossima: Terza, dopo')
  await ui.unmount()
})

test('C1: nessuna avviabile: niente «Avvia la prossima» e la riga dice perché', async ($, on) => {
  ambiente(on, [az('a-blocca01', 1, { titolo: 'Bloccata', contesto: 'fork', origineFork: 'altra-sessione' }), az('a-dopo0001', 2, { titolo: 'Dopo', dipende: ['a-blocca01'] })])
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount(PANE('terminal', 90))
  expect(await ui.find({ key: 'prossima' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /^◔ Nessuna parte adesso: .*aspetta che le dipendenze siano fuse.*1 bloccata dalle regole/ })).toBeDefined()
  await ui.unmount()
})

test('C1: una chip bloccata dice il primo motivo; «Perché» li elenca tutti, senza aprire l\'editor', async ($, on) => {
  ambiente(on, [az('a-blocca01', 1, { titolo: 'Bloccata', contesto: 'fork', origineFork: 'altra-sessione', dipende: ['a-inesist1'] })])
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  for (const surface of SUPERFICI) {
    const ui = await $.ui.mount(PANE(surface, 60))
    expect(await ui.find({ type: 'Text', text: /^▲ Non può partire: .+ \(\+1\)$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^· è un fork della conversazione/ })).toBeUndefined()
    await ui.press({ key: 'perche-a-blocca01' })
    expect(await ui.find({ type: 'Text', text: /^▲ I 2 motivi$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^· è un fork della conversazione di un'altra sessione/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^· la dipendenza a-inesist1 non esiste/ })).toBeDefined()
    expect(await ui.find({ key: 'perm-a-blocca01' })).toBeUndefined()
    // «Perché» si richiude; «Dettagli» apre l'editor e chiude i motivi.
    await ui.press({ key: 'perche-a-blocca01' })
    expect(await ui.find({ type: 'Text', text: /^▲ I 2 motivi$/ })).toBeUndefined()
    await ui.press({ key: 'perche-a-blocca01' })
    await ui.press({ key: 'mod-a-blocca01' })
    expect(await ui.find({ key: 'perm-a-blocca01' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^▲ I 2 motivi$/ })).toBeUndefined()
    await ui.press({ key: 'mod-a-blocca01' })
    await ui.unmount()
  }
})

test('C1: ridimensionando il pannello cambiano intestazione e «Al lavoro adesso», sul desktop come nel terminale', async ($, on) => {
  ambiente(on, [az('a-avviab01', 1, { titolo: LUNGO, stato: 'avviata', sessione: SID, lanciataDa: 'sessione-master', avviataIl: '2026-11-05T10:00:00Z' })])
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  for (const surface of SUPERFICI) {
    const ui = await $.ui.mount(PANE(surface, 130))
    // Larga: la tabella con le sue colonne.
    expect(await ui.find({ type: 'Text', text: /^Contesto$/ })).toBeDefined()
    for (const colonne of [90, 60]) {
      await ui.redraw({ ...PANE(surface, colonne).props })
      // Media e stretta: niente tabella, il titolo intero e le informazioni in frammenti.
      expect(await ui.find({ type: 'Text', text: /^Contesto$/ })).toBeUndefined()
      expect(await ui.find({ type: 'Text', text: LUNGO })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /^◆ Claude$/ })).toBeDefined()
    }
    await ui.redraw({ ...PANE(surface, 130).props })
    expect(await ui.find({ type: 'Text', text: /^Contesto$/ })).toBeDefined()
    await ui.unmount()
  }
})

test('C1: i colori del pannello sono solo gettoni di tema.ts; ogni segno colorato regge 3:1 su chiaro e scuro', async ($, on) => {
  const letto = new Date().toISOString()
  const limite = (id: string, fornitore: Limite['fornitore'], percentuale: number): Limite =>
    ({ id, fornitore, nome: `${fornitore} d'esempio`, percentuale, unita: '%', fonte: 'esempio', letto })
  ambiente(on, MATRICE, [limite('claude-a', 'claude', 40), limite('claude-b', 'claude', 75), limite('codex-a', 'codex', 95)])
  const clock = mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await clock.advance(20_000)
  // F9.2: anche le famiglie dei modelli e la scala dell'effort; ogni segno si misura sul fondo composto (velo della pillola,
  // fondo della scheda, eventuali altri veli), come prima.
  const gettoni = new Set<string>([ACCENTO, GRIGIO, ...Object.values(STATO), ...Object.values(MOTORE), ...Object.values(FAMIGLIA), ...Object.values(EFFORT)])
  const visti = new Set<string>()
  // `fondi`: i backgroundColor degli antenati (con il loro alfa), dal più esterno; il segno si misura sul fondo composto.
  const visita = (n: unknown, fondi: string[] = []): void => {
    if (!n || typeof n !== 'object') return
    if (Array.isArray(n)) return n.forEach(m => visita(m, fondi))
    const x = n as { type?: string; props?: Record<string, unknown>; children?: unknown }
    const fondo = x.props?.backgroundColor
    const sotto = typeof fondo === 'string' ? [...fondi, fondo] : fondi
    for (const k of ['color', 'backgroundColor', 'borderColor']) {
      const v = x.props?.[k]
      if (typeof v !== 'string') continue
      const tinta = v.slice(0, 7).toUpperCase()
      visti.add(tinta)
      if (!gettoni.has(tinta)) throw new Error(`${k} ${v} non è un gettone di tema.ts`)
      // Un segno nel colore (Text color) deve leggersi su ogni sfondo; i veli (alfa) stanno sotto testo in inchiostro.
      if (k === 'color' && x.type === 'Text')
        for (const sfondo of [...SFONDI.chiaro, ...SFONDI.scuro]) {
          const composto = sotto.reduce((base, f) => sopra(f.slice(0, 7), f.slice(7) || 'FF', base), sfondo)
          if (contrasto(tinta, composto) < 3) throw new Error(`${tinta} su ${composto} (${sfondo} con ${sotto.join(' + ')}): ${contrasto(tinta, composto).toFixed(2)} < 3`)
        }
    }
    visita(x.children, sotto)
  }
  for (const surface of SUPERFICI) {
    const ui = await $.ui.mount(PANE(surface, 90))
    visita(await ui.drawn())
    await ui.press({ key: 'perche-a-blocca01' })
    visita(await ui.drawn())
    await ui.press({ key: 'vista-carico' })
    visita(await ui.drawn())
    await ui.press({ key: 'vista-lavoro' })
    await ui.unmount()
  }
  // Ci sono davvero: stati, motore, livelli dei limiti, accento della vista attiva. L'azzurro dell'icona no.
  for (const t of [STATO.coda, STATO.errore, STATO.consegnata, MOTORE.claude, ACCENTO, STATO.attesa]) expect(visti.has(t)).toBe(true)
  expect(visti.has(ICONA)).toBe(false)
})

test('C1: «Avvia la prossima» con la corsia Codex occupata da fuori avvia la prima che parte davvero, come «Avvia tutte»', async ($, on) => {
  const amb = ambiente(on, [
    az('a-codex001', 1, { titolo: 'Prima, per Codex', esecutore: 'codex', revisore: 'claude', modello: 'gpt-6-astra', corsia: 'R2' }),
    az('a-claude01', 2, { titolo: 'Seconda, per Claude' }),
  ], [], { codexOccupato: true })
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount(PANE('desktop', 90))
  await ui.press({ key: 'prossima' })
  expect(amb.avvii().length).toBe(1)
  expect(amb.azione('a-claude01').stato).toBe('avviata')
  // La chip Codex non si accoda: resta da avviare, pronta quando la corsia si libera.
  expect(amb.azione('a-codex001').stato).toBe('proposta')
  // Il pannello aveva annunciato la chip Codex: il toast dice quale è partita e perché l'altra aspetta.
  expect(amb.toast).toContain('Parte «Seconda, per Claude»; «Prima, per Codex» aspetta: corsia Codex occupata')
  await ui.unmount()
})

test('C1: anche le Impostazioni ricevono la classe di larghezza da bodyColumns, sul desktop come nel terminale', async ($, on) => {
  ambiente(on, [])
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  for (const surface of SUPERFICI)
    for (const [colonne, verso] of [[60, 'column'], [130, 'row']] as const) {
      const ui = await $.ui.mount(PANE(surface, colonne))
      await ui.press({ key: 'impostazioni' })
      // Le righe dei fornitori (ui.Riga): su `stretta` le azioni scendono sotto, altrimenti stanno accanto.
      expect((await ui.find({ key: 'riga-claude' }))?.props.flexDirection).toBe(verso)
      await ui.press({ key: 'vista-lavoro' })
      await ui.unmount()
    }
})

// --- lingue: il giro delle viste in inglese ---------------------------------------------------------------
// Dati d'esempio in inglese e record nuovi (motivo come codice): così ogni parola italiana viene dalla mod.
const MATRICE_EN = [
  az('a-avviab01', 1, { titolo: 'Search filter for long lists, with server-side paging and a result count in the header', brief: 'Add the filter to the sample list.', issue: 123 }),
  az('a-blocca01', 2, { titolo: 'Draft from another conversation', brief: 'Sample brief.', contesto: 'fork', origineFork: 'altra-sessione', origineNome: 'Other' }),
  az('a-coda0001', 3, { titolo: 'Queued sample guide', brief: 'Sample brief.', stato: 'accodata', motivoCoda: 'limit of 3 parallel sessions', motivoCodice: 'coda.paralleli', motivoParametri: { n: 3 } }),
  az('a-fallit01', 4, { titolo: 'Failed sample export', brief: 'Sample brief.', stato: 'fallita', errore: 'HTTP 502' }),
  az('a-conseg01', 5, { titolo: 'Delivered sample legend', brief: 'Sample brief.', stato: 'consegnata', sessione: SID, lanciataDa: 'sessione-master', avviataIl: '2026-11-05T10:00:00Z' }),
]
const ITALIANO = /\b(Avvia|Aspettano|Impostazioni|Nessun[ao]?|sessione|Soglie|Collega|Dettagli|Scarta|selezionato|Modifica|Perché|Fallo|Lavoro|Carico|coda|Aggiorna|fornitor[ei]|giorni|manuale|Pesi|Vista|Lingua|Progetto|Avanzate|Rete|Cartella|Mandato|Ramo|Riprova|Chiedi|Togli|Segna)\b/
/** Tutto il testo dell'albero disegnato: le stringhe e le etichette dei pulsanti e dei campi. */
function testi(n: unknown): string[] {
  if (typeof n === 'string' || typeof n === 'number') return [String(n)]
  if (!n || typeof n !== 'object') return []
  if (Array.isArray(n)) return n.flatMap(testi)
  const x = n as { props?: Record<string, unknown>; children?: unknown }
  return [...['label', 'placeholder', 'submitLabel'].map(k => x.props?.[k]).filter((v): v is string => typeof v === 'string'), ...testi(x.children)]
}

test('F5.2: stato con glifo e parola (✗ errore, ○ in coda); i dati (modello, effort, durate) in carattere monospazio', async ($, on) => {
  const amb = ambiente(on, MATRICE_EN)
  amb.disco.set('X:/casa/.claude/chipmanager/config.json', JSON.stringify({ lingua: 'en', progetti: { 'acme/progetto': {} } }))
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount(PANE('desktop', 130))
  for (const testo of ['✗ Start failed', '○ Queued']) expect([testo, !!(await ui.find({ type: 'Text', text: testo }))]).toEqual([testo, true])
  expect(await ui.find({ type: 'Text', text: /^▲ Start failed/ })).toBeUndefined()
  expect((await ui.find({ type: 'Text', text: /^Opus 5\.5$/ }))?.props.mono).toBe(true)
  await ui.unmount()
})

// --- F6.1: dove gira una chip --------------------------------------------------------------------------------
// F10: la corsia API si accende solo dall'account (tutti i progetti).
const CONFIG_API = JSON.stringify({ account: { apiClaude: { budgetUsd: 20 } }, progetti: { 'acme/progetto': {} } })

test('F6.1 Dove: l\'editor offre le destinazioni ammesse; le altre compaiono col motivo; una sensibile solo in locale', { options: { anthropicApiKey: 'sk-ant-prova' } }, async ($, on) => {
  const amb = ambiente(on, [az('a-dove0001', 1, { revisore: 'claude' }), az('a-dove0002', 2, { corsia: 'R4', revisore: 'claude' })])
  amb.disco.set('X:/casa/.claude/chipmanager/config.json', CONFIG_API)
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount(PANE('desktop', 130))
  await ui.press({ key: 'ricarica' })
  await ui.press({ key: 'mod-a-dove0001' })
  expect(((await ui.find({ key: 'dest-a-dove0001' }))?.props.options as { value: string }[]).map(o => o.value)).toEqual(['local', 'cloud', 'api-claude'])
  await ui.press({ key: 'mod-a-dove0001' })
  await ui.press({ key: 'mod-a-dove0002' })
  expect(((await ui.find({ key: 'dest-a-dove0002' }))?.props.options as { value: string }[]).map(o => o.value)).toEqual(['local'])
  expect(await ui.find({ type: 'Text', text: /^Nel cloud \(solo sessione nuova\): non disponibile — / })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^Qui a crediti API \(Claude\): non disponibile — una chip sensibile/ })).toBeDefined()
  await ui.unmount()
})

test('F6.1 Dove: l\'accesso rapido sulla riga passa alla prossima destinazione ammessa, con una scrittura CAS che fa decadere le conferme', { options: { anthropicApiKey: 'sk-ant-prova' } }, async ($, on) => {
  const amb = ambiente(on, [az('a-dove0003', 1, { revisore: 'claude' })])
  amb.disco.set('X:/casa/.claude/chipmanager/config.json', CONFIG_API)
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount(PANE('desktop', 130))
  await ui.press({ key: 'ricarica' })
  const prima = amb.azione('a-dove0003').versione
  await ui.press({ key: 'dove-a-dove0003' })
  expect(amb.azione('a-dove0003')).toMatchObject({ destinazione: 'cloud', versione: prima + 1 })
  await ui.press({ key: 'dove-a-dove0003' })
  expect(amb.azione('a-dove0003').destinazione).toBe('api-claude')
  await ui.press({ key: 'dove-a-dove0003' })
  expect(amb.azione('a-dove0003').destinazione).toBe('local')
  await ui.unmount()
})

test('F6.1 Dove…: la stessa destinazione a più chip scelte; quelle non ammesse restano e lo si dice', { options: { anthropicApiKey: 'sk-ant-prova' } }, async ($, on) => {
  const amb = ambiente(on, [az('a-dove0004', 1), az('a-dove0005', 2, { corsia: 'R4', revisore: 'claude' }), az('a-dove0006', 3)])
  amb.disco.set('X:/casa/.claude/chipmanager/config.json', CONFIG_API)
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount(PANE('desktop', 130))
  await ui.press({ key: 'ricarica' })
  expect(await ui.find({ key: 'dove-scelte' })).toBeUndefined()
  await ui.press({ key: 'sel-a-dove0004' })
  await ui.press({ key: 'sel-a-dove0005' })
  expect(await ui.find({ type: 'Text', text: '2 chip scelte · dove:' })).toBeDefined()
  await ui.press({ key: 'dove-tutte-api-claude' })
  expect(amb.azione('a-dove0004').destinazione).toBe('api-claude')
  expect(amb.azione('a-dove0005').destinazione).toBeUndefined()
  expect(amb.azione('a-dove0006').destinazione).toBeUndefined()
  expect(amb.toast.at(-1)).toMatch(/^1 chip spostata in API Claude · «Esempio a-dove0005» resta: /)
  expect(await ui.find({ key: 'dove-scelte' })).toBeUndefined()
  await ui.unmount()
})

test('F6 rilievo 8: «Dove…» su più chip aspetta ogni scrittura; una in conflitto non si conta e resta scelta con il motivo', { options: { anthropicApiKey: 'sk-ant-prova' } }, async ($, on) => {
  const amb = ambiente(on, [az('a-dove0007', 1, { revisore: 'claude' }), az('a-dove0008', 2, { revisore: 'claude' })])
  amb.disco.set('X:/casa/.claude/chipmanager/config.json', CONFIG_API)
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount(PANE('desktop', 130))
  await ui.press({ key: 'ricarica' })
  await ui.press({ key: 'sel-a-dove0007' })
  await ui.press({ key: 'sel-a-dove0008' })
  // Un altro pannello cambia la seconda dopo che questo l'ha disegnata: la sua scrittura CAS fallisce.
  amb.disco.set(`${DIR}/a-dove0008.json`, JSON.stringify({ ...amb.azione('a-dove0008'), versione: 5, titolo: 'Cambiata altrove' }))
  await ui.press({ key: 'dove-tutte-cloud' })
  expect(amb.azione('a-dove0007').destinazione).toBe('cloud')
  expect(amb.azione('a-dove0008').destinazione).toBeUndefined()
  expect(amb.toast.at(-1)).toMatch(/^1 chip spostata in cloud · «Esempio a-dove0008» resta: /)
  expect(await ui.find({ type: 'Text', text: '1 chip scelta · dove:' })).toBeDefined()
  await ui.unmount()
})

test('lingue: in inglese le viste (Lavoro, Carico e ogni sezione delle Impostazioni) non hanno parole italiane, a ogni larghezza', async ($, on) => {
  const amb = ambiente(on, MATRICE_EN)
  amb.disco.set('X:/casa/.claude/chipmanager/config.json', JSON.stringify({ lingua: 'en', progetti: { 'acme/progetto': {} } }))
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const SEZIONI = ['connessioni', 'soglie', 'modo', 'bilanciamento', 'progetto', 'board', 'avanzate', 'esecuzione', 'lingua', 'legenda']
  for (const surface of SUPERFICI)
    for (const colonne of LARGHEZZE) {
      const ui = await $.ui.mount(PANE(surface, colonne))
      const controlla = async (dove: string) => {
        const tutto = testi(await ui.drawn())
        const italiane = tutto.filter(s => ITALIANO.test(s))
        if (italiane.length) throw new Error(`${surface} ${colonne} ${dove}: ${italiane.slice(0, 3).join(' | ')}`)
        const etichette = pulsanti(await ui.drawn()).map(b => b.label ?? '')
        const doppie = etichette.filter((e, i) => etichette.indexOf(e) !== i)
        if (doppie.length) throw new Error(`${surface} ${colonne} ${dove}: etichette ripetute ${doppie.join(' | ')}`)
      }
      expect((await ui.find({ key: 'avvia-a-avviab01' }))?.text).toBe('▶ Start')
      expect((await ui.find({ key: 'vista-lavoro' }))?.props).toMatchObject({ label: 'Work', variant: 'primary' })
      expect(await ui.find({ type: 'Text', text: /Queued: limit of 3 parallel sessions$/ })).toBeDefined()
      await controlla('lavoro')
      await ui.press({ key: 'vista-carico' })
      await controlla('carico')
      await ui.press({ key: 'impostazioni' })
      for (const s of SEZIONI) {
        await ui.press({ key: `sezione-${s}-premi` })
        await controlla(s)
      }
      await ui.press({ key: 'vista-lavoro' })
      await ui.unmount()
    }
})

// --- lingue: resa nel terminale a 60 colonne ----------------------------------------------------------------
// Il kit non dipinge: si calcola la larghezza minima che l'albero disegnato chiede al terminale. Una parola non si
// spezza, un pulsante non va a capo, una riga di Box senza `flexWrap` somma i figli; bordi e margini contano.
type Nodo = { type?: string; props?: Record<string, unknown>; children?: unknown }
// Solo le parole di una lingua: un comando, un percorso o un URL dentro un Text che va a capo il terminale lo spezza.
const parole = (s: string) => Math.max(0, ...s.split(/\s+/).filter(w => /^[\p{L}'’«»“”„()-]+[.,:;!?…]*$/u.test(w)).map(w => [...w].length))
const testoDi = (n: unknown): string =>
  typeof n === 'string' || typeof n === 'number' ? String(n) : Array.isArray(n) ? n.map(testoDi).join('') : n && typeof n === 'object' ? testoDi((n as Nodo).children) : ''
const figliDi = (n: Nodo) => [n.children].flat(9).filter(x => x !== null && x !== undefined && x !== false && x !== '')
const num = (v: unknown) => (typeof v === 'number' ? v : 0)
function minima(n: unknown, troppo: string[], limite: number): number {
  if (typeof n === 'string' || typeof n === 'number') return parole(String(n))
  if (!n || typeof n !== 'object') return 0
  if (Array.isArray(n)) return Math.max(0, ...n.map(x => minima(x, troppo, limite)))
  const x = n as Nodo
  const p = x.props ?? {}
  let w: number
  if (x.type === 'Text') w = String(p.wrap ?? '').startsWith('truncate') ? 1 : parole(testoDi(x))
  else if (x.type === 'Button') w = [...(testoDi(x) || String(p.label ?? ''))].length + 2
  else if (x.type === 'Input' || x.type === 'Select') w = Math.min(limite, [...String(p.label ?? '')].length + 2)
  else {
    const figli = figliDi(x).map(f => minima(f, troppo, limite))
    const colonna = p.flexDirection === 'column' || p.flexDirection === 'column-reverse'
    const spazio = num(p.columnGap ?? p.gap) * Math.max(0, figli.length - 1)
    const interno = typeof p.width === 'string' ? 0 : colonna || p.flexWrap === 'wrap' ? Math.max(0, ...figli) : figli.reduce((a, b) => a + b, 0) + spazio
    w = interno + num(p.paddingX) * 2 + num(p.paddingLeft) + num(p.paddingRight) + num(p.padding) * 2 + (p.borderStyle ? 2 : 0)
  }
  if (w > limite) troppo.push(`${x.type} ${w}: ${(testoDi(x) || String(p.label ?? '')).slice(0, 70)}`)
  return w
}

test('lingue: a 60 colonne nel terminale nessuna riga supera la larghezza e nessuna etichetta si ripete, in ogni lingua', async ($, on) => {
  const amb = ambiente(on, MATRICE_EN)
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const SEZIONI = ['connessioni', 'soglie', 'modo', 'bilanciamento', 'progetto', 'board', 'avanzate', 'esecuzione', 'lingua', 'legenda']
  for (const lingua of ['en', 'it', 'es', 'fr', 'de', 'pt']) {
    // F10: account e restrizioni del progetto, così si disegnano anche gruppi, restrizioni, pillole ed eccezioni.
    amb.disco.set('X:/casa/.claude/chipmanager/config.json', JSON.stringify({ lingua,
      account: { apiClaude: { budgetUsd: 20, tetto: 2 }, soglie: { claude: { attenzione: 70, critica: 90 } } },
      progetti: { 'acme/progetto': { soglie: { claude: { attenzione: 50, critica: 60 } }, restrizioni: { apiLimiteMeseUsd: 4 },
        freellmapi: { livello: 'niente', endpoint: 'http://localhost:4000/v1' },
        limitiManuali: [{ id: 'saldo', fornitore: 'claude', nome: 'Max', letto: '2026-11-01T10:00:00.000Z', percentuale: 40, unita: '%' }] } } }))
    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const ui = await $.ui.mount(PANE('terminal', 60))
    const controlla = async (dove: string) => {
      const albero = await ui.drawn()
      const troppo: string[] = []
      // Il pannello toglie due colonne di margine: il contenuto ne ha 58.
      minima(albero, troppo, 58)
      // Solo le foglie (Text, Button, campi) sono il colpevole: i Box che le contengono lo ripetono.
      const foglie = troppo.filter(t => !t.startsWith('Box') && !t.startsWith('undefined'))
      if (foglie.length) throw new Error(`${lingua} ${dove}: ${foglie.slice(0, 4).join(' | ')}`)
      if (troppo.length) throw new Error(`${lingua} ${dove}: riga troppo larga ${troppo[0]}`)
      const etichette = pulsanti(albero).map(b => b.label ?? '')
      const doppie = etichette.filter((e, i) => etichette.indexOf(e) !== i)
      if (doppie.length) throw new Error(`${lingua} ${dove}: etichette ripetute ${doppie.join(' | ')}`)
      for (const [id, chiavi] of Object.entries(AZIONI_PER_STATO))
        if (dove === 'lavoro' && MATRICE_EN.some(a => a.id === id))
          for (const k of chiavi) if (!(await ui.find({ key: `${k}-${id}` }))) throw new Error(`${lingua}: manca ${k}-${id}`)
    }
    // La vista scelta resta da un giro all'altro: si riparte da Lavoro.
    await ui.press({ key: 'vista-lavoro' })
    await controlla('lavoro')
    await ui.press({ key: 'vista-carico' })
    await controlla('carico')
    await ui.press({ key: 'impostazioni' })
    for (const s of SEZIONI) {
      await ui.press({ key: `sezione-${s}-premi` })
      await controlla(s)
    }
    await ui.unmount()
  }
})

test('F6.7 lingue: Esecuzione con tutto da fare e ogni passo della procedura guidata stanno in 60 colonne, in ogni lingua', async ($, on) => {
  const ESEC = JSON.stringify({
    claude: { trovato: true, loggedIn: false },
    github: { trovato: true, loggedIn: false, remote: false },
    fonti: [{ nome: 'gestite', file: 'C:/Program Files/ClaudeCode/managed-settings.json', chiavi: ['forceLoginGatewayUrl', 'env.ANTHROPIC_BEDROCK_BASE_URL'] },
      { nome: 'locale', file: 'X:/repo/.claude/settings.local.json', illeggibile: true }, { nome: 'ambiente', chiavi: ['ANTHROPIC_API_KEY'] }],
  })
  const amb = ambiente(on, [], [], { esecuzione: ESEC })
  // Le fonti dell'host: la riga di comando con una chiave vietata, le altre pulite.
  on('settings.read', (_, e) => ({ value: ((e as { source?: string }).source === 'flag' ? { apiKeyHelper: 'x' } : {}) as never }))
  mock.clock(on)
  const pausa = () => new Promise<void>(ok => (globalThis as unknown as { setTimeout: (f: () => void, ms: number) => void }).setTimeout(ok, 5))
  for (const lingua of ['en', 'it', 'es', 'fr', 'de', 'pt']) {
    amb.disco.set('X:/casa/.claude/chipmanager/config.json', JSON.stringify({ lingua, progetti: { 'acme/progetto': {} } }))
    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const ui = await $.ui.mount(PANE('terminal', 60))
    const controlla = async (dove: string) => {
      const albero = await ui.drawn()
      const troppo: string[] = []
      minima(albero, troppo, 58)
      if (troppo.length) throw new Error(`${lingua} ${dove}: ${troppo.slice(0, 4).join(' | ')}`)
      const etichette = pulsanti(albero).map(b => b.label ?? '')
      const doppie = etichette.filter((e, i) => etichette.indexOf(e) !== i)
      if (doppie.length) throw new Error(`${lingua} ${dove}: etichette ripetute ${doppie.join(' | ')}`)
    }
    await ui.press({ key: 'impostazioni' })
    await ui.press({ key: 'sezione-esecuzione-premi' })
    for (let i = 0; i < 400 && !(await ui.find({ key: 'ese-accedi-claude' })); i++) await pausa()
    await controlla('righe')
    await ui.press({ key: 'ese-guida' })
    for (const passo of ['claude', 'github', 'chiave', 'fonti', 'budget']) {
      for (let i = 0; i < 400 && !(await ui.find({ key: 'ese-guida-passo' })); i++) await pausa()
      expect([lingua, passo, !!(await ui.find({ key: 'ese-guida-passo' }))]).toEqual([lingua, passo, true])
      await controlla(passo)
      await ui.press({ key: 'guida-salta' })
    }
    expect(await ui.find({ key: 'ese-guida-passo' })).toBeUndefined()
    await ui.unmount()
  }
})

test('lingue: le fasi del registro nella scheda sono tradotte, mai i valori salvati', async ($, on) => {
  const avviata = az('a-fase0001', 1, { titolo: 'Sample running chip', brief: 'Sample brief.', stato: 'avviata', issue: 7, sessione: SID, lanciataDa: 'sessione-master',
    ramoSessione: 'fix/esempio', tentativo: 'az-esempio01', tentatoIl: '2026-11-05T09:00:00Z', avviataIl: '2026-11-05T09:00:10Z' })
  const amb = ambiente(on, [avviata])
  amb.disco.set('X:/casa/.claude/chipmanager/config.json', JSON.stringify({ lingua: 'en', progetti: { 'acme/progetto': {} } }))
  amb.disco.set('X:/orch/registro.json', JSON.stringify({ task: { k: { issue: 7, ramo: 'fix/esempio', stato: 'rapporto', creato: '2026-11-05T09:30:00Z' } } }))
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount(PANE('desktop', 130))
  await ui.press({ key: 'ricarica' })
  await ui.press({ key: 'mod-a-fase0001' })
  const tutto = testi(await ui.drawn()).join(' | ')
  expect(tutto).toContain('report')
  expect(tutto).not.toMatch(/\b(pronto|avviato|rapporto|fuso|pubblicato)\b/)
  await ui.unmount()
})

test('lingue: in Carico una percentuale decimale si scrive con il separatore della lingua (40,5 in italiano)', async ($, on) => {
  ambiente(on, [], [{ id: 'claude-weekly', fornitore: 'claude', nome: 'Claude piano · settimanale', percentuale: 40.5, unita: '%', fonte: 'esempio', letto: new Date().toISOString() }])
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount(PANE('desktop', 90))
  await ui.press({ key: 'ricarica' })
  await ui.press({ key: 'vista-carico' })
  expect(await ui.find({ type: 'Text', text: /Claude piano · settimanale: 40,5% usato/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /40\.5%/ })).toBeUndefined()
  await ui.unmount()
})

test('F7.4 lingue: «Chi lavora» con preset in anteprima, Dettagli aperti e id lunghi sta in 60 colonne, nel terminale e sul desktop, in ogni lingua', async ($, on) => {
  const a = az('a-chi60001', 1, { revisore: 'claude', corsia: 'R3', auditor: 'fable', titolo: 'Chip con auditor' })
  const lungo = az('a-chi60002', 2, { revisore: 'codex', corsia: 'R2', modello: 'claude-opus-4-8-anteprima-lunghissima-0001', auditor: 'claude-opus-4-8-anteprima-lunghissima-0001' })
  const amb = ambiente(on, [a, lungo])
  mock.clock(on)
  const pausa = () => new Promise<void>(ok => (globalThis as unknown as { setTimeout: (f: () => void, ms: number) => void }).setTimeout(ok, 5))
  for (const surface of ['terminal', 'desktop'] as const)
    for (const lingua of ['en', 'it', 'es', 'fr', 'de', 'pt']) {
      amb.disco.set('X:/casa/.claude/chipmanager/config.json', JSON.stringify({ lingua, progetti: { 'acme/progetto': {} } }))
      await $.session.start({ cwd: '/', surface, isInteractive: true })
      const ui = await $.ui.mount(PANE(surface, 60))
      await ui.press({ key: 'vista-lavoro' })
      await ui.press({ key: 'ricarica' })
      // Una chip aperta alla volta: ognuna con «Dettagli» aperti; la prima anche con un preset in anteprima.
      for (const x of [a, lungo]) {
        if (!(await ui.find({ key: `chi-dettagli-${x.id}` }))) await ui.press({ key: `mod-${x.id}` })
        if (!(await ui.find({ key: `esec-${x.id}` }))) await ui.press({ key: `chi-dettagli-${x.id}` })
        if (x === a) {
          await ui.press({ key: `preset-${a.id}-economico-premi` })
          for (let i = 0; i < 50 && !(await ui.find({ key: `preset-applica-${a.id}` })); i++) await pausa()
        }
        const albero = await ui.drawn()
        const troppo: string[] = []
        minima(albero, troppo, 58)
        if (troppo.length) throw new Error(`${surface} ${lingua} ${x.id}: ${troppo.slice(0, 4).join(' | ')}`)
        const etichette = pulsanti(albero).map(b => b.label ?? '')
        const doppie = etichette.filter((e, i) => e && etichette.indexOf(e) !== i)
        if (doppie.length) throw new Error(`${surface} ${lingua} ${x.id}: etichette ripetute ${doppie.join(' | ')}`)
        // Le azioni restano raggiungibili.
        for (const k of [...(x === a ? [`preset-applica-${a.id}`] : []), `chi-dettagli-${x.id}`, `esec-${x.id}`]) if (!(await ui.find({ key: k }))) throw new Error(`${surface} ${lingua}: manca ${k}`)
        if (x === a) await ui.press({ key: `preset-annulla-${a.id}` })
        await ui.press({ key: `mod-${x.id}` })
      }
      await ui.unmount()
    }
})

// --- F8.1 / F8.2 / F8.4 -----------------------------------------------------------------------------------------------

type NodoF8 = { type?: string; props?: Record<string, unknown> & { key?: string; display?: string }; hover?: { scope?: string }; children?: unknown }
const figliF8 = (n: NodoF8) => [n.children].flat(9).filter((x): x is NodoF8 => !!x && typeof x === 'object')
/** Ogni nodo con i suoi fratelli (per controllare le chiavi). */
function visitaF8(n: unknown, f: (x: NodoF8, fratelli: NodoF8[]) => void, fratelli: NodoF8[] = []) {
  if (!n || typeof n !== 'object') return
  if (Array.isArray(n)) return void n.forEach(x => visitaF8(x, f, n as NodoF8[]))
  const x = n as NodoF8
  f(x, fratelli)
  const fs = figliF8(x)
  fs.forEach(c => visitaF8(c, f, fs))
}

test('F8.2 albero: ogni hover sta su un Box con chiave unica fra i fratelli (o in uno scope); niente display:none sopra un pulsante; nel terminale nessun hover e le stesse azioni', async ($, on) => {
  ambiente(on, MATRICE)
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const azioni: Record<string, string[]> = {}
  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await $.ui.mount(PANE(surface, 100))
    await ui.press({ key: 'ricarica' })
    const albero = await ui.drawn()
    let hover = 0
    const errori: string[] = []
    visitaF8(albero, (x, fratelli) => {
      if (x.hover) {
        hover++
        const k = x.props?.key
        if (!x.hover.scope && (x.type !== 'Box' || typeof k !== 'string' || fratelli.filter(y => y.props?.key === k).length !== 1)) errori.push(`hover senza chiave unica: ${x.type} ${k}`)
      }
      if (x.props?.display === 'none' && pulsanti(x).length) errori.push(`display:none sopra un pulsante: ${x.props.key}`)
    })
    expect([surface, errori]).toEqual([surface, []])
    expect([surface, hover > 0]).toEqual([surface, surface === 'desktop'])
    azioni[surface] = pulsanti(albero).map(b => b.key ?? '').filter(k => /^(avvia|riprova|mod|scarta|qui)-/.test(k)).sort()
    await ui.unmount()
  }
  // Nessuna azione dipende dall'hover: nel terminale ci sono tutte quelle del desktop.
  expect(azioni.terminal).toEqual(azioni.desktop)
})

test('F8.4 «Chi lavora»: nella scheda compatta l\'auditor ha «Copy» e gli avvisi in una riga, per esteso a chip aperta; i dettagli senza titolo ripetuto né righe vuote', async ($, on) => {
  const a = az('a-f84cmp01', 1, { revisore: 'claude', corsia: 'R3', auditor: 'fable' })
  ambiente(on, [a])
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount(PANE('terminal', 60))
  await ui.press({ key: 'ricarica' })
  expect(await ui.find({ type: 'Text', text: /^auditor: attivalo tu con \/advisor fable/ })).toBeDefined()
  // Compatta: l'effetto globale di /advisor e il consenso di Fable restano accanto alle azioni, in una riga ciascuno.
  expect(await ui.find({ type: 'Text', text: t('it', 'au.manualeBreve') })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: t('it', 'au.fableBreve') })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: t('it', 'au.manualeNota') })).toBeUndefined()
  await ui.press({ key: `mod-${a.id}` })
  expect(await ui.find({ type: 'Text', text: t('it', 'au.manualeNota') })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: t('it', 'au.fable') })).toBeDefined()
  await ui.press({ key: `chi-dettagli-${a.id}` })
  const dettagli = await ui.find({ key: `g-chi-dettagli-${a.id}` }) as unknown as NodoF8
  expect(dettagli.props?.gap).toBeUndefined()
  // Il pulsante dice già «Nascondi dettagli»: nessun titolo «Dettagli» ripetuto dentro.
  expect(await ui.find({ type: 'Text', text: 'Dettagli' })).toBeUndefined()
  await ui.unmount()
})

test('F8.1 guardia: le schede delle viste hanno come etichetta il solo nome, in sei lingue; le chiavi di stato dei pulsanti non esistono', async ($, on) => {
  const amb = ambiente(on, [])
  mock.clock(on)
  for (const lingua of ['en', 'it', 'es', 'fr', 'de', 'pt'] as const) {
    amb.disco.set('X:/casa/.claude/chipmanager/config.json', JSON.stringify({ lingua, progetti: { 'acme/progetto': {} } }))
    await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
    const ui = await $.ui.mount(PANE('desktop', 100))
    await ui.press({ key: 'ricarica' })
    const etichette = pulsanti(await ui.drawn()).filter(b => ['vista-lavoro', 'vista-carico', 'impostazioni'].includes(b.key ?? '')).map(b => b.label)
    expect([lingua, etichette]).toEqual([lingua, [t(lingua, 'vista.lavoro'), t(lingua, 'vista.carico'), t(lingua, 'vista.impostazioni')]])
    await ui.unmount()
  }
  for (const k of ['ui.selezionato', 'ui.nonSelezionato', 'vista.etichettaScelta']) expect(t('it', k as never)).toBe(k)
})

// --- F9: garanzia di non regressione (elenco ordinato dei controlli ed effetti dei callback, prima e dopo) ----------

const SEZIONI_F9 = ['connessioni', 'soglie', 'bilanciamento', 'progetto', 'board', 'avanzate', 'esecuzione', 'lingua', 'legenda']
const PANE_F9 = (surface: 'desktop' | 'terminal' | 'vscode' | 'mobile', colonne: number) =>
  ({ ...PANE(surface === 'terminal' ? 'terminal' : 'desktop', colonne), surface }) as unknown as ReturnType<typeof PANE>

test('F9 non regressione: elenco ordinato dei controlli per vista e per superficie uguale a prima di F9 (chiavi e scorciatoie uniche)', async ($, on) => {
  const amb = ambiente(on, MATRICE_EN)
  amb.disco.set('X:/casa/.claude/chipmanager/config.json', JSON.stringify({ lingua: 'en', account: { apiClaude: { budgetUsd: 20, tetto: 2 } }, progetti: { 'acme/progetto': {} } }))
  mock.clock(on)
  for (const surface of ['desktop', 'terminal', 'vscode', 'mobile'] as const) {
    await $.session.start({ cwd: '/', surface: surface === 'terminal' ? 'terminal' : 'desktop', isInteractive: true })
    const ui = await $.ui.mount(PANE_F9(surface, surface === 'terminal' ? 100 : 130))
    const foto = async (vista: string) => {
      const c = controlliF9(await ui.drawn())
      const chiavi = c.map(x => x.chiave).filter(k => k !== undefined)
      const scorciatoie = c.map(x => x.hotkey).filter(k => k !== undefined)
      expect([vista, chiavi.filter((k, i) => chiavi.indexOf(k) !== i)]).toEqual([vista, []])
      expect([vista, scorciatoie.filter((k, i) => scorciatoie.indexOf(k) !== i)]).toEqual([vista, []])
      confrontaControlli(`controlli:${surface}:${vista}`, c)
    }
    await ui.press({ key: 'vista-lavoro' })
    await foto('lavoro')
    await ui.press({ key: 'mod-a-avviab01' })
    await foto('lavoro-dettagli')
    await ui.press({ key: 'mod-a-avviab01' })
    await ui.press({ key: 'vista-carico' })
    await foto('carico')
    await ui.press({ key: 'impostazioni' })
    // F11: la sezione Modo di lavoro è nuova; i suoi controlli vanno nella fotografia di F11.
    for (const s of [...SEZIONI_F9, 'modo']) {
      await ui.press({ key: `sezione-${s}-premi` })
      await foto(`impostazioni-${s}`)
    }
    await ui.press({ key: 'vista-lavoro' })
    await ui.unmount()
  }
  fineF9()
})

// F9 (revisione): gli effetti di Avvia, Dove, Scarta e Applica su casi RIUSCITI (avvio vero, salvataggio vero), con il
// payload di ogni chiamata (argomenti e stdin dell'helper, argomenti dell'app), per ciascuna superficie. Dove agisce su una
// chip sua, così Avvia resta in locale e parte davvero. La prova di mutazione: gli effetti di Scarta al posto di Avvia (e
// viceversa) NON coincidono con la fotografia, quindi uno scambio dei gestori fa fallire il confronto.
const MATRICE_EFFETTI = [...MATRICE_EN, az('a-dove0001', 6, { titolo: 'Sample move between destinations', brief: 'Sample brief.' })]
for (const superficie of ['desktop', 'terminal', 'vscode', 'mobile'] as const)
  test(`F9 non regressione (${superficie}): effetti di Avvia, Dove, Scarta e Applica riusciti, con il payload, uguali a prima; uno scambio dei gestori si vede`, { options: { anthropicApiKey: 'sk-ant-prova-0123456789' } }, async ($, on) => {
    const amb = ambiente(on, MATRICE_EFFETTI)
    amb.disco.set('X:/casa/.claude/chipmanager/config.json', JSON.stringify({ lingua: 'en', account: { apiClaude: { budgetUsd: 20, tetto: 2 } }, progetti: { 'acme/progetto': {} } }))
    const processi = amb.processi
    mock.clock(on)
    await $.session.start({ cwd: '/', surface: superficie === 'terminal' ? 'terminal' : 'desktop', isInteractive: true })
    const ui = await $.ui.mount(PANE_F9(superficie, superficie === 'terminal' ? 100 : 130))
    const effetti = async (fai: () => Promise<unknown>) => {
      const p0 = processi.length
      const c0 = amb.chiamate.length
      const prima = new Map(amb.disco)
      await fai()
      const scritti = [...amb.disco.entries()].filter(([k, v]) => prima.get(k) !== v).map(([k, v]) => [k, k.endsWith('.json') ? JSON.parse(v) : v]).sort()
      return { helper: processi.slice(p0).filter(a => !['occupata', 'limiti'].includes(String(a[0] ?? ''))), app: amb.chiamate.slice(c0), scritti }
    }
    const dove = await effetti(() => ui.press({ key: 'dove-a-dove0001' }))
    confrontaF9(`effetti:${superficie}:dove`, dove)
    const avvia = await effetti(() => ui.press({ key: 'avvia-a-avviab01' }))
    // Un avvio riuscito: la chip lascia la proposta e l'app riceve start_session.
    expect(avvia.app.some(c => c.tool === 'start_session')).toBe(true)
    confrontaF9(`effetti:${superficie}:avvia`, avvia)
    const scarta = await effetti(() => ui.press({ key: 'scarta-a-blocca01' }))
    confrontaF9(`effetti:${superficie}:scarta`, scarta)
    // Mutazione: Scarta al posto di Avvia, e Avvia al posto di Scarta, non passerebbero il confronto.
    if (`effetti:${superficie}:avvia` in PRIMA) {
      expect(normaF9(scarta)).not.toEqual(PRIMA[`effetti:${superficie}:avvia`])
      expect(normaF9(avvia)).not.toEqual(PRIMA[`effetti:${superficie}:scarta`])
    }
    await ui.press({ key: 'impostazioni' })
    await ui.press({ key: 'sezione-bilanciamento-premi' })
    const applica = await effetti(async () => {
      await ui.press({ key: 'profilo-risparmio-premi' })
      await ui.press({ key: 'applica' })
    })
    // Un salvataggio riuscito: il config cambia con il profilo scelto.
    expect(applica.scritti.some(([k]) => String(k).endsWith('config.json'))).toBe(true)
    confrontaF9(`effetti:${superficie}:applica`, applica)
    await ui.unmount()
    fineF9()
  })

// F9.5: l'anteprima per il committente. Solo con ANTEPRIMA a true (tests/f9.ts): il test restituisce gli alberi
// disegnati (desktop e terminale, viste Lavoro, Carico e Impostazioni con le fixture d'esempio) in un errore marcato, da
// cui uno script fuori dal repo genera l'HTML e la simulazione testuale. Nelle prove normali non fa niente.
test('F9.5 anteprima (solo con ANTEPRIMA in tests/f9.ts): gli alberi disegnati delle viste, desktop e terminale', async ($, on) => {
  if (!ANTEPRIMA) return
  const amb = ambiente(on, MATRICE_EN, [
    { id: 'claude-week', fornitore: 'claude', nome: 'Claude plan · weekly', percentuale: 42, unita: '%', fonte: 'app', letto: new Date().toISOString() },
    { id: 'codex-prim', fornitore: 'codex', nome: 'Codex plan · primary', percentuale: 76, unita: '%', fonte: 'codex', letto: new Date().toISOString() },
  ])
  amb.disco.set('X:/casa/.claude/chipmanager/config.json', JSON.stringify({ lingua: 'en', account: { apiClaude: { budgetUsd: 20, tetto: 2 } }, progetti: { 'acme/progetto': { soglie: { claude: { attenzione: 50, critica: 60 } } } } }))
  const clock = mock.clock(on)
  const alberi: Record<string, unknown> = {}
  for (const [surface, colonne] of [['desktop', 110], ['terminal', 100]] as const) {
    await $.session.start({ cwd: '/', surface, isInteractive: true })
    await clock.advance(20_000)
    const ui = await $.ui.mount(PANE(surface, colonne))
    await ui.press({ key: 'vista-lavoro' })
    alberi[`${surface}:lavoro`] = await ui.drawn()
    await ui.press({ key: 'vista-carico' })
    alberi[`${surface}:carico`] = await ui.drawn()
    await ui.press({ key: 'impostazioni' })
    for (const s of ['soglie', 'esecuzione']) {
      await ui.press({ key: `sezione-${s}-premi` })
      alberi[`${surface}:impostazioni-${s}`] = await ui.drawn()
    }
    await ui.press({ key: 'vista-lavoro' })
    await ui.unmount()
  }
  throw new Error(`F9ANTEPRIMA<<${JSON.stringify(alberi)}>>F9ANTEPRIMA`)
})

test('F9 (revisione): la scheda espansa (Dettagli) tiene il fondo della scheda e il bordo rosso di una sensibile R4, come la compatta', async ($, on) => {
  const sens = az('a-sens0001', 1, { titolo: 'Fix the login page', corsia: 'R4', esecutore: 'claude', modello: 'claude-opus-5-5', effort: 'high', revisore: 'claude' })
  ambiente(on, [sens])
  mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount(PANE('desktop', 130))
  const scheda = async () => (await ui.find({ key: 'riga-a-sens0001' }))?.props
  expect(await scheda()).toMatchObject({ borderColor: STATO.errore, backgroundColor: `${GRIGIO}${VELO.riquadro}` })
  await ui.press({ key: 'mod-a-sens0001' })
  expect(await scheda()).toMatchObject({ borderColor: STATO.errore, backgroundColor: `${GRIGIO}${VELO.riquadro}` })
  await ui.unmount()
})
