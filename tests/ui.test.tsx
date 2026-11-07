import { expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { ACCENTO, ALFA_VELO, BOARD, contrasto, cssVariabiliBoard, EFFORT, FAMIGLIA, famigliaDi, GRIGIO, ICONA, LIVELLO, MARCHIO, MOTORE, SFONDI, sopra, STATO, VELO } from '../hooks/tema'
import { blocchi, classeDi, componenti } from '../hooks/ui'

// Dati d'esempio. I componenti si disegnano con l'hook del test (l'albero passa la validazione della superficie)
// e si premono chiamando l'`onPress` dell'albero restituito: un hook di test non ha pulsanti premibili per nome.

const SUPERFICI = ['desktop', 'terminal'] as const
type Superficie = (typeof SUPERFICI)[number]
type U = ReturnType<typeof componenti>
type Engine = Parameters<TestBody>[0]
type On = Parameters<TestBody>[1]
const PROPS = { title: 'prova', isFocused: false, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} } as const

function banco(on: On) {
  let disegno: (u: U) => unknown = () => null
  let albero: unknown
  on('ui.render', { component: 'Pane', requestId: 'prova-ui' }, ($$, e) => {
    const el = $$.ui.resolve(e)
    const { Box } = el
    const r = disegno(componenti(el, e.surface, 'it'))
    albero = Array.isArray(r) ? <Box flexDirection="column">{r as never}</Box> : r
    return albero as never
  })
  return async ($: Engine, surface: Superficie, f: (u: U) => unknown) => {
    disegno = f
    const ui = await $.ui.mount({ plugin: 'chip-manager', surface, component: 'Pane', requestId: 'prova-ui', props: PROPS })
    return { ui, albero }
  }
}

type Pulsante = { props: { key: string; label: string; dimColor?: boolean }; onPress: () => void }
/** Tutti i Button dell'albero grezzo, in ordine. */
function pulsanti(albero: unknown): Pulsante[] {
  if (!albero || typeof albero !== 'object') return []
  if (Array.isArray(albero)) return albero.flatMap(pulsanti)
  const n = albero as { type?: string; children?: unknown }
  return n.type === 'Button' ? [n as Pulsante] : pulsanti(n.children)
}
const premi = (albero: unknown, chiave: string) => {
  const b = pulsanti(albero).find(x => x.props.key === chiave)
  if (!b) throw new Error(`nessun pulsante ${chiave}`)
  b.onPress()
}

test('tema: rapporto di contrasto calcolato; accento, stati e motori reggono 3:1 su chiaro e scuro', () => {
  expect(Math.round(contrasto('#FFFFFF', '#000000') * 1000) / 1000).toBe(21)
  expect(contrasto('#777777', '#777777')).toBe(1)
  expect(contrasto('#000000', '#FFFFFF')).toBe(contrasto('#FFFFFF', '#000000'))
  for (const [nome, colore] of [['accento', ACCENTO], ...Object.entries(STATO), ...Object.entries(MOTORE)] as [string, string][])
    for (const sfondo of [...SFONDI.chiaro, ...SFONDI.scuro]) {
      const r = contrasto(colore, sfondo)
      if (r < 3) throw new Error(`${nome} ${colore} su ${sfondo}: ${r.toFixed(2)} < 3`)
    }
  // La chip attiva: segno nell'accento sopra il velo dell'accento, che si compone con lo sfondo.
  expect(sopra('#000000', '80', '#FFFFFF')).toBe('#7F7F7F')
  expect(sopra(ACCENTO, 'FF', '#262624')).toBe(ACCENTO)
  for (const sfondo of [...SFONDI.chiaro, ...SFONDI.scuro]) {
    const r = contrasto(ACCENTO, sopra(ACCENTO, ALFA_VELO, sfondo))
    if (r < 3) throw new Error(`accento sul suo velo sopra ${sfondo}: ${r.toFixed(2)} < 3`)
  }
  // L'azzurro dell'icona non regge sul chiaro: per questo non è l'accento.
  expect(contrasto(ICONA, '#FFFFFF')).toBeLessThan(3)
})

test('classe di larghezza: stretta sotto 70, media fino a 109, larga da 110', () => {
  expect([60, 69, 70, 109, 110, 130].map(classeDi)).toEqual(['stretta', 'stretta', 'media', 'media', 'larga', 'larga'])
})

test('Chip F5.8: la label è il solo nome; la scelta sta nel colore (primario d\'accento), le altre attenuate; × rimuove', async ($, on) => {
  const monta = banco(on)
  for (const surface of SUPERFICI) {
    const premute: string[] = []
    const { ui, albero } = await monta($, surface, u =>
      u.Riga({
        chiave: 'r',
        classe: 'media',
        principale: u.Chip({ chiave: 'auto', testo: 'Automatico', attiva: true, onPress: () => void premute.push('auto') }),
        azioni: [
          u.Chip({ chiave: 'qual', testo: 'Qualità', attiva: false, onPress: () => void premute.push('qual') }),
          u.Chip({ chiave: 'bud', testo: 'Claude · settimanale · 40%', onRimuovi: () => void premute.push('via') }),
          u.Chip({ chiave: 'st', testo: 'Collegato', segno: '●', colore: STATO.inCorso }),
        ],
      }),
    )
    const t = surface === 'terminal'
    const attiva = await ui.find({ key: 'auto-premi' })
    // Il terminale disegna il primario come `[ label ]` nell'accento: la parentesi resta il ripiego senza colori.
    expect(attiva?.props).toMatchObject({ label: 'Automatico', variant: 'primary' })
    expect(attiva?.props.plain).toBeUndefined()
    const spenta = await ui.find({ key: 'qual-premi' })
    expect(spenta?.props).toMatchObject({ label: 'Qualità', plain: true, dimColor: true })
    expect(spenta?.props.variant).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: /^\[?[●○] (Automatico|Qualità)/ })).toBeUndefined()
    expect((await ui.find({ key: 'bud-via' }))?.props).toMatchObject({ label: 'Rimuovi Claude · settimanale · 40%' })
    // Una chip di stato non è un pulsante: segno e parola, nessuna etichetta di scelta.
    expect(await ui.find({ key: 'st-premi' })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: t ? '[● Collegato]' : '● Collegato' })).toBeDefined()
    // Il bordo e il velo dell'accento solo sul desktop.
    expect((await ui.find({ key: 'auto' }))?.props).toMatchObject(t ? { paddingX: 0 } : { borderStyle: 'round', borderColor: ACCENTO })
    premi(albero, 'auto-premi')
    premi(albero, 'qual-premi')
    premi(albero, 'bud-via')
    expect(premute).toEqual(['auto', 'qual', 'via'])
    await ui.unmount()
  }
})

test('GruppoChip: «scelta» cambia solo verso un\'altra voce; «filtro» accende e spegne', async ($, on) => {
  const monta = banco(on)
  const VOCI = [
    { valore: 'claude', testo: 'Claude' },
    { valore: 'codex', testo: 'Codex' },
    { valore: 'deepseek', testo: 'DeepSeek' },
  ]
  for (const surface of SUPERFICI) {
    const scelte: string[] = []
    const filtri: string[][] = []
    const { ui, albero } = await monta($, surface, u => [
      u.GruppoChip({ chiave: 'rete', etichetta: 'Rete', modo: 'scelta', valore: 'claude', voci: VOCI, onCambia: v => void scelte.push(v) }),
      u.GruppoChip({ chiave: 'ammessi', etichetta: 'Ammessi', modo: 'filtro', valore: ['claude', 'codex'], voci: VOCI, onCambia: v => void filtri.push(v) }),
    ])
    expect((await ui.find({ key: 'rete-claude-premi' }))?.props).toMatchObject({ label: 'Claude', variant: 'primary' })
    expect((await ui.find({ key: 'rete-codex-premi' }))?.props).toMatchObject({ label: 'Codex', plain: true, dimColor: true })
    expect(await ui.find({ type: 'Text', text: 'Ammessi' })).toBeDefined()
    premi(albero, 'rete-claude-premi')
    premi(albero, 'rete-codex-premi')
    expect(scelte).toEqual(['codex'])
    premi(albero, 'ammessi-codex-premi')
    premi(albero, 'ammessi-deepseek-premi')
    expect(filtri).toEqual([['claude'], ['claude', 'codex', 'deepseek']])
    await ui.unmount()
  }
})

test('Gamma: valore scritto, − e + di un passo entro i limiti, fermi ai bordi e su null; traccia senza pulsanti', async ($, on) => {
  const monta = banco(on)
  for (const surface of SUPERFICI) {
    const valori: number[] = []
    const g = (u: U, chiave: string, valore: number | null, min: number, max: number) =>
      u.Gamma({ chiave, etichetta: chiave === 'att' ? 'Attenzione da' : 'Critica da', valore, min, max, passo: 5, onCambia: v => void valori.push(v), formato: v => (v === null ? 'nessuna' : `${v}%`) })
    // Il vincolo attenzione < critica sta nei limiti: il + di attenzione si ferma a critica − 5, il − di critica ad attenzione + 5.
    const { ui, albero } = await monta($, surface, u => [g(u, 'att', 85, 1, 85), g(u, 'cri', 90, 90, 100), g(u, 'fuori', 72, 1, 100), g(u, 'vuota', null, 1, 100)])
    expect((await ui.find({ key: 'att-meno' }))?.props).toMatchObject({ label: 'Diminuisci Attenzione da', dimColor: false })
    expect((await ui.find({ key: 'att-piu' }))?.props).toMatchObject({ label: 'Aumenta Attenzione da, al massimo', dimColor: true })
    expect((await ui.find({ key: 'cri-meno' }))?.props).toMatchObject({ label: 'Diminuisci Critica da, al minimo', dimColor: true })
    expect(await ui.find({ type: 'Text', text: '72%' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'nessuna' })).toBeDefined()
    premi(albero, 'att-piu')
    premi(albero, 'att-meno')
    premi(albero, 'cri-meno')
    premi(albero, 'cri-piu')
    // Fuori griglia si parte dal valore attuale, non si arrotonda.
    premi(albero, 'fuori-piu')
    premi(albero, 'fuori-meno')
    premi(albero, 'vuota-piu')
    premi(albero, 'vuota-meno')
    expect(valori).toEqual([80, 95, 77, 67])
    // Due sole fermate per Gamma: la traccia non ha pulsanti.
    expect(pulsanti(albero).map(b => b.props.key).filter(k => k.startsWith('fuori-'))).toEqual(['fuori-meno', 'fuori-piu'])
    if (surface === 'terminal') expect(await ui.find({ type: 'Text', text: '──────────────●─────' })).toBeDefined()
    else expect((await ui.find({ key: 'fuori-cella-14' }))?.props).toMatchObject({ backgroundColor: ACCENTO })
    await ui.unmount()
  }
})

test('Sezione e Riga: titolo e stato affiancati sul desktop, stato sotto sul terminale; su stretta le azioni vanno sotto', async ($, on) => {
  const monta = banco(on)
  for (const surface of SUPERFICI) {
    const { ui, albero } = await monta($, surface, u =>
      u.Sezione({
        chiave: 'sez',
        titolo: 'Connessioni',
        descrizione: 'Quali fornitori usa questo progetto.',
        stato: '2 collegati · 1 da collegare',
        figli: (['larga', 'media', 'stretta'] as const).map(classe =>
          u.Riga({ chiave: `riga-${classe}`, classe, principale: u.Chip({ chiave: `c-${classe}`, testo: 'Codex', segno: '◆', colore: MOTORE.codex }), azioni: [] }),
        ),
      }),
    )
    expect(await ui.find({ type: 'Text', text: 'Connessioni' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '2 collegati · 1 da collegare' })).toBeDefined()
    const testa = (albero as { children: { props: Record<string, unknown> }[] }).children[0]!
    expect(testa.props.flexDirection).toBe(surface === 'terminal' ? 'column' : 'row')
    expect((await ui.find({ key: 'riga-larga' }))?.props).toMatchObject({ flexDirection: 'row', flexWrap: 'wrap' })
    expect((await ui.find({ key: 'riga-media' }))?.props).toMatchObject({ flexDirection: 'row', flexWrap: 'wrap' })
    expect((await ui.find({ key: 'riga-stretta' }))?.props).toMatchObject({ flexDirection: 'column' })
    await ui.unmount()
  }
})

// F9.4 supera F5.2 e F8 per il solo desktop: «stessa barra testuale su desktop e terminale» diventa «barra a blocchi nel
// terminale, barra a Box sul desktop». Il valore scritto accanto resta lo stesso, in monospazio.
test('F5.2/F9.4: barra a blocchi nel terminale (monospazio), barra spessa a Box sul desktop con il valore accanto', async ($, on) => {
  expect(blocchi(72, 10)).toEqual({ pieni: '███████▎', vuoti: '  ' })
  expect(blocchi(0, 10)).toEqual({ pieni: '', vuoti: ' '.repeat(10) })
  expect(blocchi(100, 10)).toEqual({ pieni: '█'.repeat(10), vuoti: '' })
  expect(blocchi(150, 4)).toEqual({ pieni: '████', vuoti: '' })
  expect(blocchi(-5, 4)).toEqual({ pieni: '', vuoti: '    ' })
  const monta = banco(on)
  const t = await monta($, 'terminal', u => u.Barra({ chiave: 'b', pct: 72, colore: STATO.coda, celle: 10, dopo: ' 72%' }))
  expect((await t.ui.find({ type: 'Text', text: '▕███████▎  ▏ 72%' }))?.props.mono).toBe(true)
  await t.ui.unmount()
  const d = await monta($, 'desktop', u => u.Barra({ chiave: 'b', pct: 72, colore: STATO.coda, celle: 10, dopo: ' 72%' }))
  expect(await d.ui.find({ type: 'Text', text: /▕|█/ })).toBeUndefined()
  expect((await d.ui.find({ key: 'b-pieno' }))?.props).toMatchObject({ flexGrow: 72, backgroundColor: STATO.coda })
  expect((await d.ui.find({ key: 'b-vuoto' }))?.props.flexGrow).toBe(28)
  expect((await d.ui.find({ type: 'Text', text: ' 72%' }))?.props.mono).toBe(true)
  await d.ui.unmount()
})

// --- F8.3 / F8.2 ----------------------------------------------------------------------------------------------------

test('F8.3 contrasto in due: l\'accento è grafica (≥ 3:1 su ogni sfondo); la board misura testo ≥ 4,5:1 e grafica ≥ 3:1 per tema', () => {
  for (const sfondo of [...SFONDI.chiaro, ...SFONDI.scuro]) expect([sfondo, contrasto(ACCENTO, sfondo) >= 3]).toEqual([sfondo, true])
  for (const tema of ['scuro', 'chiaro'] as const) {
    const t = BOARD[tema]
    for (const k of ['testo', 'tenue', 'errore'] as const) expect([tema, k, contrasto(t[k], t.fondo) >= 4.5]).toEqual([tema, k, true])
    expect([tema, 'accento', contrasto(t.accento, t.fondo) >= 3]).toEqual([tema, 'accento', true])
    // La traccia vuota della barra (il suo contorno) è grafica che porta informazione: anche lei ≥ 3:1 sul fondo.
    expect([tema, 'traccia', contrasto(t.traccia, t.fondo) >= 3]).toEqual([tema, 'traccia', true])
  }
  // Il blocco CSS nasce dagli stessi valori; il colore dell'icona non c'entra.
  const css = cssVariabiliBoard()
  for (const v of [BOARD.scuro.fondo, BOARD.chiaro.fondo, BOARD.scuro.errore, ACCENTO]) expect(css).toContain(v)
  expect(css).not.toContain(ICONA)
})

test('F8.3 la chip di scelta attiva tiene il testo nell\'inchiostro dell\'host: l\'accento resta sul bordo e sul velo', async ($, on) => {
  const disegna = banco(on)
  for (const surface of SUPERFICI) {
    const { albero, ui } = await disegna($, surface, u => u.Chip({ chiave: 'c1', testo: 'Uno', attiva: true }))
    const trova = (n: unknown): { props?: Record<string, unknown> } | undefined => {
      if (!n || typeof n !== 'object') return undefined
      if (Array.isArray(n)) return n.map(trova).find(Boolean)
      const x = n as { type?: string; props?: Record<string, unknown>; children?: unknown }
      return x.type === 'Text' && x.props?.key === 'c1-testo' ? x : trova(x.children)
    }
    expect([surface, trova(albero)?.props?.color]).toEqual([surface, undefined])
    await ui.unmount()
  }
})

test('F8.2 Riga: sul desktop un hover di solo sfondo sul Box con chiave; nel terminale nessun hover', async ($, on) => {
  const disegna = banco(on)
  for (const surface of SUPERFICI) {
    const { albero, ui } = await disegna($, surface, u => u.Riga({ chiave: 'riga-1', principale: 'Voce', azioni: [], classe: 'larga' }))
    // Il kit tiene `hover` sul nodo, accanto alle props.
    const box = albero as { props?: { key?: string }; hover?: Record<string, unknown> }
    expect([surface, box.props?.key, box.hover]).toEqual([surface, 'riga-1', surface === 'desktop' ? { backgroundColor: `${ACCENTO}${VELO.hover}` } : undefined])
    await ui.unmount()
  }
})

// --- F9: palette, marchio e primitive a due rese ---------------------------------------------------------------------

test('F9.2 contrasto: ogni segno (motore, famiglia, effort, stati, livelli) regge 3:1 sul proprio velo sopra la scheda, su ogni sfondo, anche sotto il puntatore', () => {
  const tinte: Record<string, string> = {
    ...Object.fromEntries(Object.entries(MOTORE).map(([k, v]) => [`motore.${k}`, v])),
    ...Object.fromEntries(Object.entries(FAMIGLIA).map(([k, v]) => [`famiglia.${k}`, v])),
    ...Object.fromEntries(Object.entries(EFFORT).map(([k, v]) => [`effort.${k}`, v])),
    ...Object.fromEntries(Object.entries(STATO).map(([k, v]) => [`stato.${k}`, v])),
    'livello.attenzione': LIVELLO.attenzione, 'livello.critica': LIVELLO.critica,
  }
  expect(VELO.pillola).toBe('14')
  for (const [nome, tinta] of Object.entries(tinte))
    for (const sfondo of [...SFONDI.chiaro, ...SFONDI.scuro]) {
      const scheda = sopra(GRIGIO, VELO.riquadro, sfondo)
      for (const [come, base] of [['fermo', scheda], ['hover', sopra(ACCENTO, VELO.hover, scheda)]] as const) {
        const pillola = sopra(tinta, VELO.pillola, base)
        expect([nome, sfondo, come, contrasto(tinta, pillola) >= 3]).toEqual([nome, sfondo, come, true])
      }
      expect([nome, sfondo, 'nudo', contrasto(tinta, sfondo) >= 3]).toEqual([nome, sfondo, 'nudo', true])
    }
})

test('F9.2 scala dell\'effort: monocroma dal blu all\'indaco e al viola (nessun rosso o giallo), più fredda a ogni passo; famiglie dei modelli', () => {
  const tinta = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number]
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const d = max - min
    const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
    return (h * 60 + 360) % 360
  }
  const scala = Object.values(EFFORT).map(tinta)
  for (const h of scala) expect(h >= 200 && h <= 290).toBe(true)
  for (let i = 1; i < scala.length; i++) expect(scala[i]! >= scala[i - 1]! - 1).toBe(true)
  // Il rosso e l'ambra restano ad attenzione e critica.
  expect(Object.values(EFFORT)).not.toContain(STATO.errore)
  expect(Object.values(EFFORT)).not.toContain(STATO.attesa)
  expect(['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-fable-5-1', 'gpt-6-astra', 'gpt-6.1-sol', 'testo-compatto'].map(famigliaDi))
    .toEqual(['opus', 'sonnet', 'haiku', 'fable', 'gpt', 'gpt', undefined])
  // Il marchio usa l'accento, mai l'icona (deroga dichiarata solo per il marchio).
  expect([MARCHIO.colore, MARCHIO.glifo]).toEqual([ACCENTO, '▣'])
  expect(MARCHIO.colore).not.toBe(ICONA)
})

test('F9.1 primitive a due rese: pillola velata sul desktop e in fila nel terminale, scheda con bordo e fondo solo sul desktop, intestazione in maiuscolo con il conteggio', async ($, on) => {
  const monta = banco(on)
  const disegno = (u: U) => u.Scheda({ chiave: 's', allerta: STATO.errore, figli: [
    u.Intestazione({ chiave: 'i', titolo: 'Da avviare', conteggio: 4 }),
    u.Pillole({ chiave: 'p', voci: [u.Pillola({ chiave: 'm', segno: '◆', colore: MOTORE.claude, testo: 'Claude' }), u.Pillola({ chiave: 'e', segno: '▰▰▱▱', colore: EFFORT.medium, testo: 'medium', mono: true })] }),
  ] })
  const d = await monta($, 'desktop', disegno)
  expect((await d.ui.find({ key: 's' }))?.props).toMatchObject({ borderStyle: 'round', borderColor: STATO.errore, backgroundColor: `${GRIGIO}${VELO.riquadro}` })
  expect((await d.ui.find({ key: 'm' }))?.props.backgroundColor).toBe(`${MOTORE.claude}${VELO.pillola}`)
  expect(await d.ui.find({ type: 'Text', text: 'DA AVVIARE' })).toBeDefined()
  expect(await d.ui.find({ type: 'Text', text: '4' })).toBeDefined()
  expect((await d.ui.findAll({ type: 'Text', text: 'medium' })).some(x => x.props.mono === true)).toBe(true)
  await d.ui.unmount()
  const t = await monta($, 'terminal', disegno)
  expect((await t.ui.find({ key: 's' }))?.props.borderStyle).toBeUndefined()
  expect((await t.ui.find({ key: 's' }))?.props.backgroundColor).toBeUndefined()
  expect(await t.ui.find({ type: 'Text', text: 'Da avviare · 4' })).toBeDefined()
  // Nel terminale le pillole stanno in fila separate da «·», senza velo.
  expect(await t.ui.find({ key: 'm' })).toBeUndefined()
  expect(await t.ui.find({ type: 'Text', text: 'Claude' })).toBeDefined()
  await t.ui.unmount()
})

test('F9.4 barre del desktop: la parte piena (critico, attenzione, accento, milestone) regge 3:1 sul segmento vuoto, su ogni sfondo e dentro una scheda', async ($, on) => {
  const piene = { critica: LIVELLO.critica, attenzione: LIVELLO.attenzione, accento: ACCENTO, fatta: STATO.inCorso, milestone: STATO.coda }
  for (const sfondo of [...SFONDI.chiaro, ...SFONDI.scuro])
    for (const [dove, base] of [['nudo', sfondo], ['scheda', sopra(GRIGIO, VELO.riquadro, sfondo)]] as const) {
      const vuoto = sopra(GRIGIO, VELO.barraVuota, base)
      for (const [nome, piena] of Object.entries(piene)) expect([nome, sfondo, dove, contrasto(piena, vuoto) >= 3]).toEqual([nome, sfondo, dove, true])
    }
  // La barra disegnata usa proprio quel velo per il segmento vuoto.
  const monta = banco(on)
  const d = await monta($, 'desktop', u => u.Barra({ chiave: 'b', pct: 40, colore: LIVELLO.critica, celle: 10 }))
  expect((await d.ui.find({ key: 'b-vuoto' }))?.props.backgroundColor).toBe(`${GRIGIO}${VELO.barraVuota}`)
  await d.ui.unmount()
})
