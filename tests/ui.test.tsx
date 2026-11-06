import { expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { ACCENTO, ALFA_VELO, contrasto, ICONA, MOTORE, SFONDI, sopra, STATO } from '../hooks/tema'
import { classeDi, componenti } from '../hooks/ui'

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

test('Chip: la scelta sta nel segno e nell\'etichetta; il terminale la scrive tra parentesi; × rimuove', async ($, on) => {
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
    expect(attiva?.props).toMatchObject({ label: '● Automatico, selezionato' })
    expect(attiva?.text).toBe(t ? '[● Automatico]' : '● Automatico')
    const spenta = await ui.find({ key: 'qual-premi' })
    expect(spenta?.props).toMatchObject({ label: '○ Qualità, non selezionato' })
    expect(spenta?.text).toBe(t ? '[○ Qualità]' : '○ Qualità')
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
    expect((await ui.find({ key: 'rete-claude-premi' }))?.props).toMatchObject({ label: '● Claude, selezionato' })
    expect((await ui.find({ key: 'rete-codex-premi' }))?.props).toMatchObject({ label: '○ Codex, non selezionato' })
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
