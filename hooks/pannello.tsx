// Il disegno del pannello. Regole (design-taste app-screens + ui-ux-pro-max):
// - un solo primario nel pannello («Avvia tutte»); sulle schede azioni secondarie e testuali;
// - schede neutre: il colore sta sui dati (stato, motore, modello, effort), il bordo si accende
//   solo sulla scheda che aspetta una decisione (ferma o fallita);
// - il colore MARCA (segni, velo, bordi), le parole restano nell'inchiostro del tema: contrasto pieno
//   sul chiaro e sullo scuro; il colore non è mai l'unico segnale (segno + parola, effort anche ▰▰▱▱);
// - niente maiuscolo spaziato, niente emoji: titoli di sezione in frase, piccoli, grigi.
// Qui stanno i dati comuni e l'intestazione; ogni vista ha il suo file (vista-lavoro, vista-carico, vista-impostazioni).
import { atom, read, update } from 'claude-code'
import type { ElementTable, EngineInterface, RenderSurface } from 'claude-code'

import type { Azione, Chiamante, Consumo, Fornitore, Limite, Motore, Peso, Regole, Risorse, RisorseProgetto, SessioneProgetto, Sessioni, StatoBoard, Traguardi, Vista, Vita } from '../types'
import {
  attive,
  aspettaTe as aspettaTeDi,
  COLORE_STATO,
  corrisponde,
  etaVecchie,
  fornitoriVisibili,
  FORNITORI,
  livelloDi,
  piuPieno,
  sogliaDi,
  durata,
  effortDi,
  modelloDi,
  REGOLE_DEFAULT,
  transizione,
  velo,
} from './logica'
import { RISORSE_VUOTE } from './risorse'
import { GRIGIO } from './tema'
import { vistaCarico } from './vista-carico'
import { vistaImpostazioni } from './vista-impostazioni'
import { vistaLavoro } from './vista-lavoro'

// Copia identica degli atomi di register.tsx (lo scanner li vuole nel file che li usa).
const azioni = atom({ plugin: 'chip-manager', key: 'azioni' } as const, [] as Azione[], { shape: 'azioni-5' })
const aperta = atom({ plugin: 'chip-manager', key: 'aperta' } as const, null as string | null)
const vive = atom({ plugin: 'chip-manager', key: 'vive' } as const, {} as Record<string, Vita>, { shape: 'vive-2' })
const avviso = atom({ plugin: 'chip-manager', key: 'avviso' } as const, null as string | null)
const traguardi = atom({ plugin: 'chip-manager', key: 'traguardi' } as const, null as Traguardi | null, { shape: 'traguardi-3' })
const regole = atom({ plugin: 'chip-manager', key: 'regole' } as const, null as Regole | null, { shape: 'regole-5' })
const annullabile = atom({ plugin: 'chip-manager', key: 'annullabile' } as const, null as { id: string; titolo: string; altri?: string[] } | null)
const filtro = atom({ plugin: 'chip-manager', key: 'filtro' } as const, '')
const illeggibili = atom({ plugin: 'chip-manager', key: 'illeggibili' } as const, [] as { nome: string; motivo: string }[], {
  shape: 'illeggibili-2',
})
const contesto = atom({ plugin: 'chip-manager', key: 'contesto' } as const, null as Chiamante | null, { shape: 'chiamante-1' })
const risorse = atom({ plugin: 'chip-manager', key: 'risorse' } as const, RISORSE_VUOTE as Risorse, { shape: 'risorse-1' })
const ultimeMisure = atom({ plugin: 'chip-manager', key: 'ultimeMisure' } as const, {} as Record<string, Limite>, { shape: 'misure-1' })
const sessioni = atom({ plugin: 'chip-manager', key: 'sessioni' } as const, { lista: [] } as Sessioni, { shape: 'sessioni-1' })
const vista = atom({ plugin: 'chip-manager', key: 'vista' } as const, 'lavoro' as Vista)
const tutteSessioni = atom({ plugin: 'chip-manager', key: 'tutteSessioni' } as const, false)
const statoBoard = atom({ plugin: 'chip-manager', key: 'board' } as const, {} as StatoBoard, { shape: 'board-1' })
const consumo = atom({ plugin: 'chip-manager', key: 'consumo' } as const, { processi: 0, app: 0, byte: 0, byteLimiti: 0, salti: 0, da: 0 } as Consumo, { shape: 'consumo-1' })

type Eng = EngineInterface

export type Ctx = {
  max: number
  fai: (fn: () => Promise<unknown>) => Promise<unknown>
  salva: (a: Azione) => Promise<unknown>
  avvia: (a: Azione) => Promise<unknown>
  faiQui: (a: Azione) => Promise<unknown>
  chiediQui: (a: Azione) => Promise<unknown>
  avviaTutte: () => Promise<unknown>
  giro: () => Promise<unknown>
  riordina: (id: string, verso: -1 | 1) => Promise<unknown>
  scarta: (a: Azione) => Promise<unknown>
  annullaTentativo: (a: Azione) => Promise<unknown>
  senzaProgetto: (come: 'assegna' | 'scarta') => Promise<unknown>
  annullaScarto: (id: string) => Promise<unknown>
  apri: (sessione: string) => Promise<unknown>
  configura: (campi: Record<string, unknown>, attese: RisorseProgetto) => Promise<unknown>
  peso: (peso: Peso, attese: RisorseProgetto) => Promise<unknown>
  installa: (passo: number) => Promise<unknown>
  board: (modo: RisorseProgetto['board']['modo'], attese: RisorseProgetto) => Promise<unknown>
  apriBoard: () => Promise<unknown>
}

const MOTORI = ['claude', 'codex', 'freellmapi'] as const
const motore = (m: Motore | 'nessuno') => (m === 'claude' ? 'Claude' : m === 'codex' ? 'Codex' : m === 'freellmapi' ? 'FreeLLMAPI' : 'Nessuno')
const due = (n: number) => String(n).padStart(2, '0')
const oraDi = (iso: string) => {
  const d = new Date(iso)
  return `${due(d.getHours())}:${due(d.getMinutes())}`
}

/** Dati e pezzi comuni alle viste, letti una volta per disegno. */
async function comuni($: Eng, el: ElementTable, surface: RenderSurface, c: Ctx, colonne: number) {
  const { Box, Text } = el
  const Select = 'Select' in el ? el.Select : undefined
  const Input = 'Input' in el ? el.Input : undefined
  // Il terminale non conosce l'alfa: lì l'etichetta è segno + parola, senza velo.
  const conVelo = surface !== 'terminal'
  // Terminale stretto: cadono «Contesto» e «Attività», modello ed effort in una colonna.
  const stretto = surface === 'terminal' && colonne < 80

  const io = await read($, contesto)
  const lette = await read($, azioni)
  // Solo le azioni di questo progetto: quelle senza progetto non si mostrano più da nessuna parte.
  const tutte = lette.filter(a => !!a.repo && a.repo === io?.repo)
  const senzaProgetto = attive(lette).filter(a => !a.repo).length
  const ses = await read($, sessioni)
  const vistaOra = await read($, vista)
  const tutteLeSessioni = await read($, tutteSessioni)
  const regoleOra = (await read($, regole)) ?? REGOLE_DEFAULT
  const testoFiltro = await read($, filtro)
  const lista = attive(tutte)
  const visibili = lista.filter(a => corrisponde(a, testoFiltro, regoleOra))
  const espansa = await read($, aperta)
  const consumoOra = await read($, consumo)
  const stati = await read($, vive)
  const nota = await read($, avviso)
  const scartata = await read($, annullabile)
  const rotte = await read($, illeggibili)
  const tr = await read($, traguardi)
  const adesso = Date.now()
  const capacita = await read($, risorse)
  const sb = await read($, statoBoard)
  // La board si mostra solo accesa e scritta: spenta, nessun pulsante e nessun riferimento.
  const boardPronta = regoleOra.risorse.board.modo !== 'spenta' && !!sb.percorso
  const ultime = await read($, ultimeMisure)
  const configura = (campi: Record<string, unknown>) => c.configura(campi, regoleOra.risorse)

  const fai = (fn: () => Promise<unknown>) => () => void c.fai(fn)
  const modifica = (a: Azione, campi: Partial<Azione>) => fai(() => c.salva({ ...a, ...campi }))
  // La data di completamento è quella della pressione, non del disegno.
  const completa = (a: Azione) => fai(() => c.salva({ ...a, ...transizione(a, 'completata', new Date().toISOString()) }))
  const apriChiudi = (id: string) => () => update($, aperta, x => (x === id ? null : id))
  const ferma = (a: Azione) => a.stato === 'avviata' && !a.qui && stati[a.id]?.stato === 'ferma'

  const statoDi = (a: Azione): { colore: string; parola: string } => {
    if (a.stato === 'proposta') return { colore: COLORE_STATO.proposta, parola: 'Da avviare' }
    if (a.stato === 'accodata') return { colore: COLORE_STATO.accodata, parola: 'In coda' }
    if (a.stato === 'in-avvio')
      return {
        colore: COLORE_STATO.inAvvio,
        parola: a.manuale ? 'Chiesta a questa sessione: aspetto la conferma' : a.incerto ? 'Avvio incerto: verifico' : 'In avvio',
      }
    if (a.stato === 'fallita') return { colore: COLORE_STATO.fallita, parola: 'Avvio fallito' }
    if (a.stato === 'consegnata') return { colore: COLORE_STATO.consegnata, parola: 'Consegnata: attende la fusione' }
    if (a.qui) return { colore: COLORE_STATO.qui, parola: 'In esecuzione qui' }
    if (ferma(a)) return { colore: COLORE_STATO.ferma, parola: 'Ferma: aspetta te' }
    return { colore: COLORE_STATO.inCorso, parola: stati[a.id] ? 'In corso' : 'Avviata' }
  }

  /** Etichetta: velo del colore, segno nel colore, testo nell'inchiostro del tema. */
  const etichetta = (k: string, colore: string, testo: string, segno = '●') => (
    <Box key={k} flexDirection="row" backgroundColor={conVelo ? velo(colore) : undefined} paddingX={1}>
      <Text color={colore}>{`${segno} `}</Text>
      <Text>{testo}</Text>
    </Box>
  )
  /** Riga di nota: segno colorato, parole nell'inchiostro (contrasto pieno su ogni tema). */
  const nota1 = (k: string, colore: string, segno: string, testo: string) => (
    <Text key={k} size="caption">
      <Text color={colore}>{`${segno} `}</Text>
      {testo}
    </Text>
  )

  const conta = (f: (a: Azione) => boolean) => lista.filter(f).length
  const proposte = conta(a => a.stato === 'proposta')
  // Un avvio scaduto o chiesto a questa sessione e non ancora preso aspetta una decisione: si può annullare.
  const tentativoAnnullabile = (a: Azione) =>
    a.stato === 'in-avvio' && a.lanciatore !== 'cli' && !!io && a.lanciataDa === io.io &&
    ((a.manuale && !a.presa) || (!a.manuale && (a.avvioScade ?? '') < new Date(adesso).toISOString()))
  const aspettaTe = (a: Azione) => aspettaTeDi(a, stati, io?.io, adesso)
  const attese = conta(aspettaTe)

  const titoloSezione = (k: string, testo: string, n?: number) => (
    <Text key={k} size="caption" weight="medium" dimColor>
      {n === undefined ? testo : `${testo}  ${n}`}
    </Text>
  )

  // «Al lavoro adesso»: le sessioni del progetto (anche aperte a mano) più le chip avviate di cui l'app non dà la sessione.
  type Riga = SessioneProgetto & { azione?: Azione; parola: string; segno: string; colore: string }
  const avviate = lista.filter(a => a.stato === 'avviata' || a.stato === 'in-avvio')
  const righe: Riga[] = ses.lista.map(s => {
    const a = avviate.find(x => (s.motore === 'claude' && x.sessione === s.id) || (s.motore === 'codex' && x.esecutore === 'codex' && !!s.ramo && stati[x.id]?.ramo === s.ramo))
    const fermaOra = a ? ferma(a) : s.stato === 'ferma'
    // Stato non noto: né in corso né ferma, come un dato mancante.
    if (!a && s.stato === 'ignota') return { ...s, titolo: s.titolo, parola: '—', segno: '○', colore: GRIGIO }
    return { ...s, azione: a, titolo: a?.titolo ?? s.titolo, parola: fermaOra ? 'Ferma' : 'In corso', segno: fermaOra ? '◐' : '●', colore: fermaOra ? COLORE_STATO.ferma : COLORE_STATO.inCorso }
  })
  for (const a of avviate)
    if (!righe.some(r => r.azione?.id === a.id)) {
      const fermaOra = ferma(a)
      righe.push({
        id: `chip-${a.id}`, motore: a.esecutore === 'codex' ? 'codex' : 'claude', titolo: a.titolo, ramo: stati[a.id]?.ramo,
        modello: modelloDi(a, regoleOra), effort: effortDi(a, regoleOra), stato: fermaOra ? 'ferma' : 'in-corso', attivita: stati[a.id]?.ultimaAttivita, azione: a,
        parola: a.stato === 'in-avvio' ? 'In avvio' : fermaOra ? 'Ferma' : 'In corso', segno: a.stato === 'in-avvio' ? '◔' : fermaOra ? '◐' : '●',
        colore: a.stato === 'in-avvio' ? COLORE_STATO.inAvvio : fermaOra ? COLORE_STATO.ferma : COLORE_STATO.inCorso,
      })
    }
  righe.sort((x, y) => Number(y.stato === 'in-corso') - Number(x.stato === 'in-corso') || (y.attivita ?? '').localeCompare(x.attivita ?? ''))
  const alLavoro = righe.filter(r => r.stato === 'in-corso').length

  const cella = (k: string, w: string, figli: unknown, destra = false) => (
    <Box key={k} width={w} flexDirection="column" alignItems={destra ? 'flex-end' : 'flex-start'} paddingRight={1}>
      {figli as never}
    </Box>
  )

  // Solo ciò che è configurato: fornitori ammessi con una misura (anche vecchia) o un limite manuale; le righe di solo errore restano in Impostazioni.
  const fornitoriInUso = fornitoriVisibili(regoleOra.risorse, ultime)
  const limiti = [...Object.values(ultime), ...regoleOra.risorse.limitiManuali].filter(l => fornitoriInUso.includes(l.fornitore))
  const NOME_FORNITORE: Record<Fornitore, string> = { claude: 'Claude', codex: 'Codex', deepseek: 'DeepSeek', freellmapi: 'FreeLLMAPI' }

  return {
    el, c, Select, Input, conVelo, stretto, io, tutte, senzaProgetto, ses, vistaOra, tutteLeSessioni, regoleOra, testoFiltro,
    lista, visibili, espansa, stati, nota, scartata, rotte, tr, adesso, capacita, sb, boardPronta, ultime, configura, fai, modifica,
    completa, apriChiudi, ferma, statoDi, etichetta, nota1, proposte, tentativoAnnullabile, aspettaTe, attese, titoloSezione, righe,
    alLavoro, cella, fornitoriInUso, limiti, NOME_FORNITORE, MOTORI, motore, oraDi, consumoOra,
  }
}

export type Dati = Awaited<ReturnType<typeof comuni>>

export async function disegna($: Eng, el: ElementTable, surface: RenderSurface, c: Ctx, colonne = 100) {
  const d = await comuni($, el, surface, c, colonne)
  const { Box, Text, Button } = el
  const { conVelo, io, ses, vistaOra, regoleOra, nota, scartata, rotte, adesso, sb, boardPronta, fai, nota1,
    proposte, attese, alLavoro, fornitoriInUso, limiti, NOME_FORNITORE, oraDi } = d

  // Riga di sintesi: chi lavora, chi aspetta, e il margine più stretto per fornitore (solo misure fresche).
  const margine = (f: Fornitore) => {
    if (!fornitoriInUso.includes(f)) return undefined
    const nome = NOME_FORNITORE[f]
    // Un solo segno per fornitore visibile: c'era una misura, ora nessuna è più fresca.
    const vecchie = etaVecchie(limiti, f, adesso)
    if (vecchie !== undefined) return `${nome}: limiti non letti da ${durata(vecchie)}`
    // Il margine in percentuale resta sulle quote di piano.
    const l = f === 'claude' || f === 'codex' ? piuPieno(limiti, f, adesso) : undefined
    if (!l) return undefined
    const livello = livelloDi(l.percentuale!, sogliaDi(regoleOra.risorse, f))
    return `${nome} ${l.percentuale}%${livello === 'critica' ? ' oltre la soglia critica' : livello === 'attenzione' ? ' in attenzione' : ''}`
  }
  const sintesi =
    [
      `${alLavoro} al lavoro`,
      attese ? `${attese} ${attese === 1 ? 'aspetta' : 'aspettano'} te` : undefined,
      proposte ? `${proposte} da avviare` : undefined,
      ...FORNITORI.map(margine),
    ]
      .filter(Boolean)
      .join(' · ')

  const VISTE: { id: Vista; nome: string; tasto: string; chiave: string }[] = [
    { id: 'lavoro', nome: 'Lavoro', tasto: '1', chiave: 'vista-lavoro' },
    { id: 'carico', nome: 'Carico', tasto: '2', chiave: 'vista-carico' },
    { id: 'impostazioni', nome: 'Impostazioni', tasto: '3', chiave: 'impostazioni' },
  ]
  const schede = (
    <Box key="viste" flexDirection="row" gap={2}>
      {VISTE.map(v => (
        <Button key={v.chiave} plain hotkey={v.tasto} label={`Vista ${v.nome}${v.id === vistaOra ? ', attiva' : ''}`} onPress={() => void update($, vista, () => v.id)}>
          <Text weight={v.id === vistaOra ? 'semibold' : 'regular'} dimColor={v.id !== vistaOra}>
            {v.nome}
          </Text>
        </Button>
      ))}
    </Box>
  )

  return (
    <Box flexDirection="column" gap={2}>
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="row" justifyContent="space-between" alignItems="center" gap={1}>
          <Text size="title" weight="semibold" wrap="truncate-end">
            {`chipManager${io?.repo ? ` · ${io.repo}` : ''}`}
          </Text>
          <Box flexDirection="row" gap={1}>
            {boardPronta && <Button key="apri-board" plain hotkey="b" label="Apri board" onPress={fai(c.apriBoard)} />}
            <Button key="ricarica" plain dimColor hotkey="r" label={`Aggiorna${ses.letto ? ` · ${oraDi(ses.letto)}` : ''}`} onPress={fai(c.giro)} />
          </Box>
        </Box>
        <Text dimColor>{sintesi}</Text>
        {boardPronta && <Text key="percorso-board" size="caption" dimColor>{`Board: ${sb.percorso}`}</Text>}
        {schede}
        {!regoleOra.lette && nota1('regole', COLORE_STATO.fallita, '▲', `Regole ${regoleOra.fonte}: nessun avvio finché routing.json non si legge.`)}
        {rotte.length > 0 &&
          nota1(
            'rotte',
            COLORE_STATO.ferma,
            '!',
            `Non si leggono: ${rotte.map(r => `${r.nome} (${r.motivo})`).join('; ')}. Finché non si leggono, il pannello non avvia e non chiude nulla da solo.`,
          )}
      </Box>
      {scartata && (
        <Box flexDirection="row" gap={1} alignItems="center" backgroundColor={conVelo ? velo('#808080', '1F') : undefined} paddingX={1}>
          <Text>{`Scartata «${scartata.titolo}»`}</Text>
          <Button key="annulla-scarto" plain hotkey="u" label="Annulla" onPress={fai(() => c.annullaScarto(scartata.id))} />
        </Box>
      )}
      {nota && (
        <Box backgroundColor={conVelo ? velo(COLORE_STATO.fallita) : undefined} paddingX={1}>
          {nota1('nota', COLORE_STATO.fallita, '!', nota)}
        </Box>
      )}
      {vistaOra === 'carico' ? vistaCarico(d) : vistaOra === 'impostazioni' ? vistaImpostazioni(d) : vistaLavoro($, d)}
    </Box>
  )
}
