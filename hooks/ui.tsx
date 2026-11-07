// Componenti comuni del pannello (piano grafica, C0.3 con §9 riga 2): funzioni pure che restituiscono alberi,
// con la stessa API sul desktop e sul terminale. Le chip e la Gamma non imitano controlli HTML: la scelta si
// legge dal segno (● / ○) e dall'etichetta, il valore della Gamma è scritto e si cambia con − e +.
// F9.1: due rese per superficie. Desktop (anche vscode e mobile): schede velate con bordo arrotondato, pillole con il
// velo della propria tinta, etichette di sezione in maiuscolo solo sul desktop, barre spesse fatte di Box. Terminale:
// lo stile developer di F5.2/F8 (glifi colorati, testo nell'inchiostro, barre a blocchi). Stessi dati, stesse azioni (chiave, label,
// onPress) nello stesso ordine: cambia solo la presentazione.
import type { ElementTable, RenderSurface } from 'claude-code'

import { t } from './lingua'
import type { Lingua } from './lingua'
import { velo } from './logica'
import { ACCENTO, ALFA_VELO, GRIGIO, VELO } from './tema'

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
    if (!terminale && !scelta && !p.onPress && !p.onRimuovi)
      return Pillola({ chiave: p.chiave, testo: p.testo, segno, colore: p.colore })
    // Il desktop disegna la label, non i figli: una chip di stato tiene il segno anche lì.
    const nome = `${p.contesto ? `${p.contesto}, ` : ''}${p.testo}`
    const chiusa = terminale && !p.onRimuovi ? ']' : ''
    const corpo = scelta ? (
      // Il testo resta nell'inchiostro dell'host: la scelta si vede da bordo, velo e variante, l'accento non colora parole.
      <Text key={`${p.chiave}-testo`} dimColor={!p.attiva}>
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
        gap={terminale ? 1 : 'xs'}
        alignItems="center"
        borderStyle={terminale || scelta ? undefined : 'round'}
        borderColor={!terminale && p.attiva ? ACCENTO : undefined}
        borderDimColor={!terminale && !p.attiva}
        backgroundColor={!terminale && p.attiva ? velo(ACCENTO, ALFA_VELO) : undefined}
        paddingX={terminale || scelta ? 0 : 'xs'}
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
      <Box key={p.chiave} flexDirection="column" gap={terminale ? 0 : 'xs'}>
        <Text size="caption" dimColor>
          {p.etichetta}
        </Text>
        <Box flexDirection="row" flexWrap="wrap" alignItems="center" columnGap={terminale ? 1 : 'xs'} rowGap={terminale ? 0 : 'xs'}>
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
      <Text key={`${p.chiave}-traccia`}>
        <Text dimColor>{'─'.repeat(qui < 0 ? celle : qui)}</Text>
        {qui >= 0 && <Text color={ACCENTO}>●</Text>}
        <Text dimColor>{'─'.repeat(qui < 0 ? 0 : celle - qui - 1)}</Text>
      </Text>
    ) : (
      <Box key={`${p.chiave}-traccia`} flexDirection="row" flexGrow={1}>
        {Array.from({ length: celle }, (_, i) => (
          <Box key={`${p.chiave}-cella-${i}`} flexGrow={1} backgroundColor={i <= qui ? (i === qui ? ACCENTO : velo(ACCENTO, VELO.traccia)) : velo(GRIGIO, VELO.vuoto)}>
            <Text size="caption"> </Text>
          </Box>
        ))}
      </Box>
    )
    return (
      <Box key={p.chiave} flexDirection="column" gap={terminale ? 0 : 'xs'}>
        <Text size="caption" dimColor>
          {p.etichetta}
        </Text>
        <Box flexDirection="row" alignItems="center" gap={terminale ? 1 : 'xs'}>
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
  function Sezione(p: { chiave: string; titolo: string; descrizione?: string; stato?: string; figli: Nodo[]; interna?: boolean }) {
    const stato = p.stato ? (
      <Text key={`${p.chiave}-stato`} size="caption" dimColor>
        {p.stato}
      </Text>
    ) : null
    // F12: il titolo della scheda conserva la grafia tradotta; solo Intestazione rende maiuscole le etichette di sezione.
    return (
      <Box
        key={p.chiave}
        flexDirection="column"
        gap={terminale ? 1 : 'sm'}
        borderStyle={terminale || p.interna ? undefined : 'round'}
        borderDimColor={!terminale && !p.interna}
        backgroundColor={terminale || p.interna ? undefined : velo(GRIGIO, VELO.riquadro)}
        padding={terminale || p.interna ? 0 : 'md'}
      >
        <Box key={`${p.chiave}-testata`} flexDirection="column" gap={terminale ? 0 : 'xs'}>
          <Box flexDirection={terminale ? 'column' : 'row'} justifyContent="space-between" alignItems={terminale ? 'flex-start' : 'center'} flexWrap="wrap" gap={terminale ? 0 : 'xs'}>
            <Text size="body" weight="semibold" wrap="wrap">
              {p.titolo}
            </Text>
            {stato}
          </Box>
          {p.descrizione && <Text size="caption" dimColor wrap="wrap">
            {p.descrizione}
          </Text>}
        </Box>
        {p.figli as never}
      </Box>
    )
  }

  /** Principale e azioni: sotto nelle intestazioni e su `stretta`, altrimenti affiancati; ogni gruppo può andare a capo. */
  function Riga(p: { chiave: string; principale: Nodo; azioni: Nodo[]; classe: Classe; intestazione?: boolean }) {
    const sotto = p.classe === 'stretta' || !!p.intestazione
    return (
      <Box
        key={p.chiave}
        hover={terminale || p.intestazione || !p.azioni.some(Boolean) ? undefined : { backgroundColor: velo(ACCENTO, VELO.hover) }}
        flexDirection={sotto ? 'column' : 'row'}
        flexWrap={sotto ? undefined : 'wrap'}
        justifyContent="space-between"
        alignItems={sotto ? 'flex-start' : 'center'}
        gap={terminale ? (sotto ? 0 : 1) : 'sm'}
      >
        <Box flexDirection="column" width={sotto ? '100%' : undefined} flexShrink={1} gap={terminale ? 0 : 'xs'}>
          {p.principale as never}
        </Box>
        {p.azioni.some(Boolean) && <Box flexDirection="row" flexWrap="wrap" alignItems="center" columnGap={terminale ? 1 : 'xs'} rowGap={terminale ? 0 : 'xs'}>
          {p.azioni as never}
        </Box>}
      </Box>
    )
  }

  /**
   * Una barra d'uso. Terminale: blocchi fra ▕ e ▏ (monospazio). Desktop (F9.4, supera F5.2 e F8 solo qui): una barra
   * spessa fatta di Box, la parte piena nella tinta del livello e il resto velato; `dopo` è il valore scritto, accanto.
   */
  function Barra(p: { chiave: string; pct: number; colore: string; celle: number; dopo?: string }) {
    if (!terminale) {
      const pieno = Math.round(Math.min(100, Math.max(0, p.pct)))
      return (
        <Box key={p.chiave} flexDirection="row" flexWrap="wrap" alignItems="center" gap="xs">
          <Box key={`${p.chiave}-traccia`} flexDirection="row" flexGrow={1} minWidth={p.celle * 2} borderStyle="round" borderDimColor>
            {pieno > 0 ? <Box key={`${p.chiave}-pieno`} flexGrow={pieno} backgroundColor={p.colore}><Text size="caption"> </Text></Box> : null}
            {pieno < 100 ? <Box key={`${p.chiave}-vuoto`} flexGrow={100 - pieno} backgroundColor={velo(GRIGIO, VELO.barraVuota)}><Text size="caption"> </Text></Box> : null}
          </Box>
          {p.dopo ? <Text key={`${p.chiave}-dopo`} mono>{p.dopo}</Text> : null}
        </Box>
      )
    }
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

  /**
   * F9.2: un attributo come pillola: il segno nella sua tinta e la parola nell'inchiostro, mai il solo colore. Desktop: sul
   * velo della propria tinta (`VELO.pillola`); terminale: segno colorato e parola, in fila con le altre.
   */
  function Pillola(p: { chiave: string; segno: string; colore?: string; testo: string; mono?: boolean }) {
    // La parola è un testo a sé (le prove e i lettori di schermo la trovano intera); lo spazio sta nel segno.
    const corpo = [
      <Text key={`${p.chiave}-segno`} color={p.colore}>{`${p.segno} `}</Text>,
      <Text key={`${p.chiave}-testo`} mono={p.mono}>{p.testo}</Text>,
    ]
    if (terminale) return <Text key={p.chiave}>{corpo}</Text>
    return (
      <Box key={p.chiave} flexDirection="row" flexShrink={1} paddingX="xs" borderStyle="round" borderDimColor backgroundColor={velo(p.colore ?? GRIGIO, VELO.pillola)}>
        <Text wrap="wrap">{corpo}</Text>
      </Box>
    )
  }

  /** Pillole in fila che vanno a capo: sul terminale separate da «·», sul desktop dallo spazio. */
  function Pillole(p: { chiave: string; voci: unknown[] }) {
    const voci = p.voci.filter(Boolean)
    if (!terminale)
      return (
        <Box key={p.chiave} flexDirection="row" flexWrap="wrap" alignItems="center" gap="xs">
          {voci as never}
        </Box>
      )
    return (
      <Box key={p.chiave} flexDirection="row" flexWrap="wrap" alignItems="center" columnGap={1}>
        {voci.map((v, i) => (
          <Text key={`${p.chiave}-${i}`}>
            {i ? <Text dimColor>{'· '}</Text> : ''}
            {v as never}
          </Text>
        ))}
      </Box>
    )
  }

  /**
   * F9.4: la scheda di una chip o di una sezione. Desktop: fondo velato (`VELO.riquadro`), bordo arrotondato (nella tinta
   * dell'allerta se c'è, altrimenti attenuato), padding e velo d'accento sotto il puntatore. Terminale: un blocco
   * semplice, senza hover; il bordo si conserva sulle schede intere.
   * Una sola base VELO.riquadro: editor e passi interni non aggiungono schede. Niente hover sulle barre d'uso o
   * d'intestazione, anche con pulsanti: solo record azionabili e righe interattive ricevono il velo.
   */
  function Scheda(p: { chiave: string; allerta?: string; figli: unknown[]; gap?: number; interattiva?: boolean; bordoTerminale?: boolean }) {
    // F12 (spec §2): nel terminale la scheda intera tiene gli angoli arrotondati, come prima; i record compatti no.
    if (terminale)
      return p.bordoTerminale ? (
        <Box key={p.chiave} flexDirection="column" gap={p.gap} borderStyle="round" borderColor={p.allerta} borderDimColor={!p.allerta} paddingX={1}>
          {p.figli as never}
        </Box>
      ) : (
        <Box key={p.chiave} flexDirection="column" gap={p.gap}>
          {p.figli as never}
        </Box>
      )
    return (
      <Box
        key={p.chiave}
        flexDirection="column"
        gap="sm"
        borderStyle="round"
        borderColor={p.allerta}
        borderDimColor={!p.allerta}
        backgroundColor={velo(GRIGIO, VELO.riquadro)}
        hover={p.interattiva === false ? undefined : { backgroundColor: velo(ACCENTO, VELO.hover) }}
        padding="md"
      >
        {p.figli as never}
      </Box>
    )
  }

  /**
   * F9.4: l'intestazione di un gruppo: in maiuscolo attenuato con il conteggio a destra sul desktop («DA AVVIARE      4»);
   * nel terminale una riga «Da avviare · 4».
   */
  function Intestazione(p: { chiave: string; titolo: string; conteggio?: number }) {
    if (terminale)
      return (
        <Text key={p.chiave} weight="semibold" dimColor>
          {p.conteggio === undefined ? p.titolo : `${p.titolo} · ${p.conteggio}`}
        </Text>
      )
    return (
      <Box key={p.chiave} flexDirection="row" flexGrow={1} flexWrap="wrap" justifyContent="space-between" alignItems="center" gap="xs">
        <Text key={`${p.chiave}-titolo`} size="caption" weight="semibold" dimColor>
          {surface === 'desktop' ? p.titolo.toLocaleUpperCase(lingua) : p.titolo}
        </Text>
        {p.conteggio === undefined ? null : (
          <Text key={`${p.chiave}-n`} size="caption" dimColor tabular>
            {String(p.conteggio)}
          </Text>
        )}
      </Box>
    )
  }

  return { Chip, GruppoChip, Gamma, Sezione, Riga, Barra, Pillola, Pillole, Scheda, Intestazione }
}
