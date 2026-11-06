// C1 (piano grafica): vista Lavoro e intestazione responsive, scheda compatta, «Avvia la prossima», motivi del blocco.
// Solo dati d'esempio: progetto acme/progetto, sessioni e titoli inventati.
import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { ACCENTO, contrasto, GRIGIO, ICONA, MOTORE, SFONDI, sopra, STATO } from '../hooks/tema'
import type { Azione, Limite } from '../types'

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
function ambiente(on: On, azioni: Azione[], limiti: Limite[] = [], opz: { codexOccupato?: boolean } = {}) {
  const toast: string[] = []
  const disco = new Map<string, string>()
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
  on('fs.stat', (_, e) => {
    const t = disco.get(p(e.path))
    if (t === undefined) throw new Error('ENOENT')
    return { value: { kind: 'file' as const, size: t.length, mtimeMs: t.length, isLink: false } }
  })
  on('fs.read', (_, e) => {
    const t = disco.get(p(e.path))
    if (t === undefined) throw new Error('ENOENT')
    return { value: t }
  })
  on('fs.write', (_, e) => (disco.set(p(e.path), e.text), { value: undefined }))
  on('ui.panes', () => ({ value: [{ id: 'chipManager', title: 'chipManager', isShown: true, isFocused: false, isPlaced: true }] }))
  on('process.run', (_, e) => {
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
  return { disco, chiamate, toast, azione, avvii: () => chiamate.filter(c => c.tool === 'start_session') }
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
      expect((await ui.find({ key: 'vista-lavoro' }))?.props.label).toBe('● Vista Lavoro, selezionato')
      expect((await ui.find({ key: 'vista-carico' }))?.props.label).toBe('○ Vista Carico, non selezionato')
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
  const gettoni = new Set<string>([ACCENTO, GRIGIO, ...Object.values(STATO), ...Object.values(MOTORE)])
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
