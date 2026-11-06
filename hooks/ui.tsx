// Componenti comuni del pannello (piano grafica, C0.3 con §9 riga 2): funzioni pure che restituiscono alberi,
// con la stessa API sul desktop e sul terminale. Le chip e la Gamma non imitano controlli HTML: la scelta si
// legge dal segno (● / ○) e dall'etichetta, il valore della Gamma è scritto e si cambia con − e +.
import type { ElementTable, RenderSurface } from 'claude-code'

import { t } from './lingua'
import type { Lingua } from './lingua'
import { velo } from './logica'
import { ACCENTO, ALFA_VELO, GRIGIO } from './tema'

/** Classe di larghezza del pannello, in colonne. */
export type Classe = 'larga' | 'media' | 'stretta'
export const classeDi = (colonne: number): Classe => (colonne >= 110 ? 'larga' : colonne >= 70 ? 'media' : 'stretta')

export type Voce = { valore: string; testo: string }

const OTTAVI = ['', '▏', '▎', '▍', '▌', '▋', '▊', '▉']
/** Barra a blocchi da terminale (F5.2) in `celle` caratteri, all'ottavo: `pieni` va colorato, `vuoti` sono spazi. */
export function blocchi(pct: number, celle: number) {
  const ottavi = Math.round((Math.min(100, Math.max(0, pct)) / 100) * celle * 8)
  const pieni = '█'.repeat(Math.floor(ottavi / 8)) + OTTAVI[ottavi % 8]
  return { pieni, vuoti: ' '.repeat(celle - [...pieni].length) }
}

type Nodo = unknown

export function componenti(el: ElementTable, surface: RenderSurface, lingua: Lingua) {
  const { Box, Text, Button } = el
  const terminale = surface === 'terminal'

  /**
   * Una chip. Con `attiva` definito è una chip di scelta o filtro (F5.8): la label è il solo nome e la scelta sta nel colore,
   * pulsante primario d'accento la attiva (nel terminale `[ nome ]`), attenuate le altre.
   * Senza, è un'etichetta di stato con il suo `segno` nel suo `colore`: segno e parola, mai il solo colore.
   */
  function Chip(p: {
    chiave: string
    testo: string
    attiva?: boolean
    segno?: string
    colore?: string
    onPress?: () => void
    onRimuovi?: () => void
    /** Di chi è la chip, solo nella label («Claude, 70/90»): distingue chip uguali di gruppi diversi. */
    contesto?: string
  }) {
    const scelta = p.attiva !== undefined
    const segno = p.segno ?? '●'
    // Il desktop disegna la label, non i figli: una chip di stato tiene il segno anche lì.
    const nome = `${p.contesto ? `${p.contesto}, ` : ''}${p.testo}`
    const chiusa = terminale && !p.onRimuovi ? ']' : ''
    const corpo = scelta ? (
      <Text key={`${p.chiave}-testo`} color={p.attiva ? ACCENTO : undefined} dimColor={!p.attiva}>
        {terminale && p.attiva ? `[${p.testo}]` : p.testo}
      </Text>
    ) : (
      <Text key={`${p.chiave}-testo`}>
        {terminale ? '[' : ''}
        <Text color={p.colore}>{segno}</Text>
        {` ${p.testo}${chiusa}`}
      </Text>
    )
    return (
      <Box
        key={p.chiave}
        flexDirection="row"
        gap={1}
        borderStyle={terminale ? undefined : 'round'}
        borderColor={!terminale && p.attiva ? ACCENTO : undefined}
        borderDimColor={!terminale && !p.attiva}
        backgroundColor={!terminale && p.attiva ? velo(ACCENTO, ALFA_VELO) : undefined}
        paddingX={terminale ? 0 : 1}
      >
        {p.onPress && scelta ? (
          p.attiva ? (
            <Button key={`${p.chiave}-premi`} variant="primary" label={nome} onPress={p.onPress} />
          ) : (
            <Button key={`${p.chiave}-premi`} plain dimColor label={nome} onPress={p.onPress} />
          )
        ) : p.onPress ? (
          <Button key={`${p.chiave}-premi`} plain label={`${segno} ${nome}`} onPress={p.onPress}>
            {corpo}
          </Button>
        ) : (
          corpo
        )}
        {p.onRimuovi && (
          <Button key={`${p.chiave}-via`} plain dimColor label={t(lingua, 'ui.rimuovi', { nome: p.testo })} onPress={p.onRimuovi}>
            ×
          </Button>
        )}
        {p.onRimuovi && terminale && <Text key={`${p.chiave}-fine`}>]</Text>}
      </Box>
    )
  }

  /** Chip in fila che vanno a capo. `scelta`: una sola attiva. `filtro`: ciascuna si accende e si spegne da sé. */
  function GruppoChip(
    p: { chiave: string; etichetta: string; voci: readonly Voce[]; contesto?: string } & (
      | { modo: 'scelta'; valore: string; onCambia: (v: string) => void }
      | { modo: 'filtro'; valore: readonly string[]; onCambia: (v: string[]) => void }
    ),
  ) {
    const premi = (v: string) => () => {
      if (p.modo === 'scelta') {
        if (v !== p.valore) p.onCambia(v)
      } else p.onCambia(p.valore.includes(v) ? p.valore.filter(x => x !== v) : [...p.valore, v])
    }
    return (
      <Box key={p.chiave} flexDirection="column">
        <Text size="caption" dimColor>
          {p.etichetta}
        </Text>
        <Box flexDirection="row" flexWrap="wrap" gap={1}>
          {p.voci.map(v =>
            Chip({
              chiave: `${p.chiave}-${v.valore}`,
              testo: v.testo,
              attiva: p.modo === 'scelta' ? v.valore === p.valore : p.valore.includes(v.valore),
              onPress: premi(v.valore),
              contesto: p.contesto,
            }),
          )}
        </Box>
      </Box>
    )
  }

  /**
   * Un valore scritto con − e + (due sole fermate di tastiera) e una traccia disegnata, non interattiva.
   * − e + si muovono di `passo` dal valore attuale, anche fuori griglia, entro `min` e `max`; ai bordi non fanno nulla.
   * Con `valore` null (nessun valore) non fanno nulla: si parte da una chip di preset.
   */
  function Gamma(p: {
    chiave: string
    etichetta: string
    valore: number | null
    min: number
    max: number
    passo: number
    onCambia: (v: number) => void
    formato?: (v: number | null) => string
  }) {
    const scritto = p.formato ? p.formato(p.valore) : p.valore === null ? '—' : String(p.valore)
    const verso = (d: -1 | 1) => (p.valore === null ? null : Math.min(p.max, Math.max(p.min, p.valore + d * p.passo)))
    const meno = verso(-1)
    const piu = verso(1)
    const puoMeno = meno !== null && meno !== p.valore
    const puoPiu = piu !== null && piu !== p.valore
    const celle = Math.floor((p.max - p.min) / p.passo) + 1
    const qui = p.valore === null ? -1 : Math.min(celle - 1, Math.max(0, Math.round((p.valore - p.min) / p.passo)))
    const traccia = terminale ? (
      <Text key={`${p.chiave}-traccia`} dimColor>
        {'─'.repeat(qui < 0 ? celle : qui)}
        {qui >= 0 && <Text color={ACCENTO}>●</Text>}
        {'─'.repeat(qui < 0 ? 0 : celle - qui - 1)}
      </Text>
    ) : (
      <Box key={`${p.chiave}-traccia`} flexDirection="row" flexGrow={1}>
        {Array.from({ length: celle }, (_, i) => (
          <Box key={`${p.chiave}-cella-${i}`} flexGrow={1} backgroundColor={i <= qui ? (i === qui ? ACCENTO : velo(ACCENTO, '4D')) : velo(GRIGIO, '33')}>
            <Text size="caption"> </Text>
          </Box>
        ))}
      </Box>
    )
    return (
      <Box key={p.chiave} flexDirection="column">
        <Text size="caption" dimColor>
          {p.etichetta}
        </Text>
        <Box flexDirection="row" alignItems="center" gap={1}>
          <Button
            key={`${p.chiave}-meno`}
            plain
            dimColor={!puoMeno}
            label={t(lingua, puoMeno ? 'ui.diminuisci' : 'ui.diminuisciMinimo', { nome: p.etichetta })}
            onPress={() => {
              if (puoMeno) p.onCambia(meno)
            }}
          >
            −
          </Button>
          {traccia}
          <Button
            key={`${p.chiave}-piu`}
            plain
            dimColor={!puoPiu}
            label={t(lingua, puoPiu ? 'ui.aumenta' : 'ui.aumentaMassimo', { nome: p.etichetta })}
            onPress={() => {
              if (puoPiu) p.onCambia(piu)
            }}
          >
            +
          </Button>
          <Text key={`${p.chiave}-valore`} tabular>
            {scritto}
          </Text>
        </Box>
      </Box>
    )
  }

  /** Una sezione: titolo, che cosa configura e lo stato sintetico (a destra sul desktop, sotto sul terminale). */
  function Sezione(p: { chiave: string; titolo: string; descrizione: string; stato?: string; figli: Nodo[] }) {
    const stato = p.stato ? (
      <Text key={`${p.chiave}-stato`} size="caption" dimColor>
        {p.stato}
      </Text>
    ) : null
    return (
      <Box key={p.chiave} flexDirection="column" gap={1}>
        <Box flexDirection={terminale ? 'column' : 'row'} justifyContent="space-between" flexWrap="wrap" gap={terminale ? 0 : 1}>
          <Text weight="semibold" wrap="wrap">
            {p.titolo}
          </Text>
          {stato}
        </Box>
        <Text size="caption" dimColor wrap="wrap">
          {p.descrizione}
        </Text>
        {p.figli as never}
      </Box>
    )
  }

  /** Principale e azioni: sulla stessa riga (le azioni vanno a capo se serve) tranne su `stretta`, dove stanno sotto. */
  function Riga(p: { chiave: string; principale: Nodo; azioni: Nodo[]; classe: Classe }) {
    const sotto = p.classe === 'stretta'
    return (
      <Box
        key={p.chiave}
        flexDirection={sotto ? 'column' : 'row'}
        flexWrap={sotto ? undefined : 'wrap'}
        justifyContent="space-between"
        alignItems={sotto ? 'flex-start' : 'center'}
        gap={sotto ? 0 : 1}
      >
        <Box flexDirection="column" flexShrink={1}>
          {p.principale as never}
        </Box>
        <Box flexDirection="row" flexWrap="wrap" gap={1}>
          {p.azioni as never}
        </Box>
      </Box>
    )
  }

  /** La barra a blocchi fra ▕ e ▏, uguale sul desktop e nel terminale (monospazio); `dopo` è il valore scritto. */
  function Barra(p: { chiave: string; pct: number; colore: string; celle: number; dopo?: string }) {
    const b = blocchi(p.pct, p.celle)
    return (
      <Text key={p.chiave} mono>
        <Text dimColor>▕</Text>
        <Text color={p.colore}>{b.pieni}</Text>
        <Text dimColor>{`${b.vuoti}▏`}</Text>
        {p.dopo ?? ''}
      </Text>
    )
  }

  return { Chip, GruppoChip, Gamma, Sezione, Riga, Barra }
}
