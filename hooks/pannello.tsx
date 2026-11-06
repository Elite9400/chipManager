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

import type { Azione, Chiamante, Consumo, Fornitore, Limite, Motore, Peso, PropostaPesi, Regole, Risorse, RisorseProgetto, SessioneProgetto, Sessioni, StatoBoard, Traguardi, Vista, Vita } from '../types'
import { annullabile as pesiAnnullabili, daDecidere, decisaIl, descriviPesi, statoVisto, TESTI_PESI } from './bilanciamento'
import {
  attive,
  aspettaTe as aspettaTeDi,
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
import { ACCENTO, ALFA_VELO, GRIGIO, STATO } from './tema'
import { classeDi, componenti } from './ui'
import { vistaCarico } from './vista-carico'
import { apriBilanciamento, vistaImpostazioni } from './vista-impostazioni'
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
const propostePesi = atom({ plugin: 'chip-manager', key: 'proposte' } as const, [] as PropostaPesi[], { shape: 'proposte-1' })

type Eng = EngineInterface

export type Ctx = {
  max: number
  fai: (fn: () => Promise<unknown>) => Promise<unknown>
  salva: (a: Azione) => Promise<unknown>
  avvia: (a: Azione) => Promise<unknown>
  faiQui: (a: Azione) => Promise<unknown>
  chiediQui: (a: Azione) => Promise<unknown>
  avviaTutte: () => Promise<unknown>
  /** Avvia la prima del piano di «Avvia tutte»; `attesa` è quella che il pannello ha annunciato. */
  avviaProssima: (attesa?: string) => Promise<unknown>
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
  /** Applica o rifiuta una proposta di pesi alla versione vista; l'helper rifiuta se è cambiata. */
  decidiPesi: (p: PropostaPesi, esito: 'applica' | 'rifiuta') => Promise<unknown>
  annullaPesi: (p: PropostaPesi) => Promise<unknown>
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
  const { Box, Text, Button } = el
  const Select = 'Select' in el ? el.Select : undefined
  const Input = 'Input' in el ? el.Input : undefined
  // Il terminale non conosce l'alfa: lì l'etichetta è segno + parola, senza velo.
  const conVelo = surface !== 'terminal'
  // La larghezza vera del pannello, su ogni superficie (bodyColumns; 100 se l'host non la dà).
  const classe = classeDi(colonne)
  const ui = componenti(el, surface)

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
  // «Perché» (i motivi di una chip bloccata) usa lo stesso atomo dei dettagli con un prefisso: una cosa aperta alla volta.
  const apertaOra = await read($, aperta)
  const espansa = apertaOra?.startsWith('perche:') ? null : apertaOra
  const motiviAperti = apertaOra?.startsWith('perche:') ? apertaOra.slice('perche:'.length) : null
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
  const apriPerche = (id: string) => () => update($, aperta, x => (x === `perche:${id}` ? null : `perche:${id}`))
  const ferma = (a: Azione) => a.stato === 'avviata' && !a.qui && stati[a.id]?.stato === 'ferma'

  /** Stato di una chip: il segno nel colore dello stato, la parola nell'inchiostro. */
  const statoDi = (a: Azione): { colore: string; segno: string; parola: string } => {
    if (a.stato === 'proposta') return { colore: STATO.coda, segno: '○', parola: 'Da avviare' }
    if (a.stato === 'accodata') return { colore: STATO.coda, segno: '◔', parola: 'In coda' }
    if (a.stato === 'in-avvio')
      return {
        colore: STATO.coda,
        segno: '◔',
        parola: a.manuale ? 'Chiesta a questa sessione: aspetto la conferma' : a.incerto ? 'Avvio incerto: verifico' : 'In avvio',
      }
    if (a.stato === 'fallita') return { colore: STATO.errore, segno: '▲', parola: 'Avvio fallito' }
    if (a.stato === 'consegnata') return { colore: STATO.consegnata, segno: '✓', parola: 'Consegnata: attende la fusione' }
    if (a.qui) return { colore: STATO.inCorso, segno: '●', parola: 'In esecuzione qui' }
    if (ferma(a)) return { colore: STATO.attesa, segno: '◐', parola: 'Ferma: aspetta te' }
    return { colore: STATO.inCorso, segno: '●', parola: stati[a.id] ? 'In corso' : 'Avviata' }
  }

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
    return { ...s, azione: a, titolo: a?.titolo ?? s.titolo, parola: fermaOra ? 'Ferma' : 'In corso', segno: fermaOra ? '◐' : '●', colore: fermaOra ? STATO.attesa : STATO.inCorso }
  })
  for (const a of avviate)
    if (!righe.some(r => r.azione?.id === a.id)) {
      const fermaOra = ferma(a)
      righe.push({
        id: `chip-${a.id}`, motore: a.esecutore === 'codex' ? 'codex' : 'claude', titolo: a.titolo, ramo: stati[a.id]?.ramo,
        modello: modelloDi(a, regoleOra), effort: effortDi(a, regoleOra), stato: fermaOra ? 'ferma' : 'in-corso', attivita: stati[a.id]?.ultimaAttivita, azione: a,
        parola: a.stato === 'in-avvio' ? 'In avvio' : fermaOra ? 'Ferma' : 'In corso', segno: a.stato === 'in-avvio' ? '◔' : fermaOra ? '◐' : '●',
        colore: a.stato === 'in-avvio' ? STATO.coda : fermaOra ? STATO.attesa : STATO.inCorso,
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

  // Proposte di pesi: nessun popup dal giro. Il popup si apre solo da «Rivedi»; Applica e Rifiuta stanno sempre sulla riga.
  const tutteProposte = await read($, propostePesi)
  const proposteAperte = tutteProposte.filter(p => daDecidere(p, adesso))
  // L'ultima decisione per istante di decisione (o di annullamento o di scadenza), non di proposta. Una voce oltre le
  // 24 ore è scaduta anche se l'helper non l'ha ancora segnata: compare qui, non sparisce.
  const ultimaDecisa = tutteProposte.filter(p => statoVisto(p, adesso) !== 'attesa').sort((a, b) => decisaIl(b, adesso) - decisaIl(a, adesso))[0]
  // Etichette uniche: con più proposte aperte, il pulsante porta la coda dell'id.
  const suffisso = (p: PropostaPesi) => (proposteAperte.length > 1 ? ` ${p.id.slice(-4)}` : '')
  const rivedi = (p: PropostaPesi) => async () => {
    let scelta: string
    try {
      scelta = await $.ui.ask(TESTI_PESI.domanda(p), { options: [TESTI_PESI.applica, TESTI_PESI.rifiuta, TESTI_PESI.apri], header: TESTI_PESI.intestazione })
    } catch {
      return // popup chiuso o nessuno a cui chiedere: Applica e Rifiuta restano sulla riga
    }
    if (scelta === TESTI_PESI.applica) await c.fai(() => c.decidiPesi(p, 'applica'))
    else if (scelta === TESTI_PESI.rifiuta) await c.fai(() => c.decidiPesi(p, 'rifiuta'))
    else if (scelta === TESTI_PESI.apri) {
      await update($, vista, () => 'impostazioni')
      await apriBilanciamento($)
    }
  }
  /** Una proposta aperta: il testo, poi Rivedi (popup), Applica e Rifiuta. `dove` tiene le chiavi uniche fra le viste. */
  const rigaProposta = (dove: string, p: PropostaPesi, conDettaglio = false) => (
    <Box key={`${dove}-${p.id}`} flexDirection="column">
      <Box flexDirection="row" flexWrap="wrap" gap={1} alignItems="center">
        {nota1(`${dove}-${p.id}-testo`, STATO.attesa, '◐', TESTI_PESI.riga(p))}
        <Button key={`${dove}-${p.id}-rivedi`} plain label={`${TESTI_PESI.rivedi}${suffisso(p)}`} onPress={() => void rivedi(p)()} />
        <Button key={`${dove}-${p.id}-applica`} plain label={`${TESTI_PESI.applica}${suffisso(p)}`} onPress={fai(() => c.decidiPesi(p, 'applica'))} />
        <Button key={`${dove}-${p.id}-rifiuta`} plain dimColor label={`${TESTI_PESI.rifiuta}${suffisso(p)}`} onPress={fai(() => c.decidiPesi(p, 'rifiuta'))} />
      </Box>
      {conDettaglio && (
        <Text key={`${dove}-${p.id}-dettaglio`} size="caption" dimColor wrap="wrap">
          {`${descriviPesi(p.partenza)} → ${descriviPesi(p.risultato)}. Motivo: ${p.motivo}`}
        </Text>
      )}
    </Box>
  )
  // L'applicazione ancora annullabile (revisione e origine del config sono le sue): al più una, cercata a parte, perché
  // una decisione successiva che non tocca il config (un rifiuto, una scadenza) non toglie la possibilità di annullarla.
  const daAnnullare = tutteProposte.find(p => pesiAnnullabili(p, regoleOra.risorse))
  const vocePesi = (dove: string, p: PropostaPesi) => (
    <Box key={`${dove}-${p.id}`} flexDirection="row" flexWrap="wrap" gap={1} alignItems="center">
      <Text size="caption" wrap="wrap">{TESTI_PESI.registro(p, adesso)}</Text>
      {p === daAnnullare && (
        <Button key={`${dove}-annulla`} plain label={`${TESTI_PESI.annulla} la proposta applicata`} onPress={fai(() => c.annullaPesi(p))} />
      )}
    </Box>
  )
  /** L'ultima decisione e, se è un'altra, l'applicazione ancora annullabile, con il suo Annulla. */
  const registroPesi = (dove: string) =>
    ultimaDecisa ? (
      <Box key={`${dove}-registro`} flexDirection="column">
        {vocePesi(`${dove}-registro`, ultimaDecisa)}
        {daAnnullare && daAnnullare !== ultimaDecisa && vocePesi(`${dove}-registro`, daAnnullare)}
      </Box>
    ) : (
      <Text key={`${dove}-registro`} size="caption" dimColor>{TESTI_PESI.nessunaDecisione}</Text>
    )

  return {
    el, c, Select, Input, conVelo, classe, colonne, ui, io, tutte, senzaProgetto, ses, vistaOra, tutteLeSessioni, regoleOra, testoFiltro,
    lista, visibili, espansa, motiviAperti, stati, nota, scartata, rotte, tr, adesso, capacita, sb, boardPronta, ultime, configura, fai, modifica,
    completa, apriChiudi, apriPerche, ferma, statoDi, nota1, proposte, tentativoAnnullabile, aspettaTe, attese, titoloSezione, righe,
    alLavoro, cella, fornitoriInUso, limiti, NOME_FORNITORE, MOTORI, motore, oraDi, consumoOra,
    proposteAperte, rigaProposta, registroPesi,
  }
}

export type Dati = Awaited<ReturnType<typeof comuni>>

export async function disegna($: Eng, el: ElementTable, surface: RenderSurface, c: Ctx, colonne = 100) {
  const d = await comuni($, el, surface, c, colonne)
  const { Box, Text, Button } = el
  const { conVelo, classe, ui, io, ses, vistaOra, regoleOra, nota, scartata, rotte, adesso, sb, boardPronta, fai, nota1,
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
  // Le viste come chip di scelta (C1.5): segno ● / ○ e «selezionato» nell'etichetta, accento solo sulla scelta.
  // Non usa `ui.Chip` per tenere il tasto (1 2 3) e la chiave del pulsante (vista-lavoro, …) di sempre.
  const schede = (
    <Box key="viste" flexDirection="row" flexWrap="wrap" gap={1}>
      {VISTE.map(v => {
        const attiva = v.id === vistaOra
        const segno = attiva ? '●' : '○'
        return (
          <Box
            key={`${v.chiave}-chip`}
            flexDirection="row"
            borderStyle={conVelo ? 'round' : undefined}
            borderColor={conVelo && attiva ? ACCENTO : undefined}
            borderDimColor={conVelo && !attiva}
            backgroundColor={conVelo && attiva ? velo(ACCENTO, ALFA_VELO) : undefined}
            paddingX={conVelo ? 1 : 0}
          >
            <Button key={v.chiave} plain hotkey={v.tasto} label={`${segno} Vista ${v.nome}, ${attiva ? 'selezionato' : 'non selezionato'}`} onPress={() => void update($, vista, () => v.id)}>
              <Text>
                {conVelo ? '' : '['}
                <Text color={attiva ? ACCENTO : undefined}>{segno}</Text>
                {` ${v.nome}${conVelo ? '' : ']'}`}
              </Text>
            </Button>
          </Box>
        )
      })}
    </Box>
  )

  return (
    <Box flexDirection="column" gap={2}>
      <Box flexDirection="column" gap={1}>
        {ui.Riga({
          chiave: 'testata',
          classe,
          principale: (
            <Text size="title" weight="semibold" wrap="wrap">
              {`chipManager${io?.repo ? ` · ${io.repo}` : ''}`}
            </Text>
          ),
          azioni: [
            boardPronta && <Button key="apri-board" plain hotkey="b" label="Apri board" onPress={fai(c.apriBoard)} />,
            <Button key="ricarica" plain dimColor hotkey="r" label={`Aggiorna${ses.letto ? ` · ${oraDi(ses.letto)}` : ''}`} onPress={fai(c.giro)} />,
            schede,
          ],
        })}
        <Text dimColor wrap="wrap">{sintesi}</Text>
        {boardPronta && <Text key="percorso-board" size="caption" dimColor wrap="truncate-middle">{`Board: ${sb.percorso}`}</Text>}
        {!regoleOra.lette && nota1('regole', STATO.errore, '▲', `Regole ${regoleOra.fonte}: nessun avvio finché routing.json non si legge.`)}
        {rotte.length > 0 &&
          nota1(
            'rotte',
            STATO.attesa,
            '!',
            `Non si leggono: ${rotte.map(r => `${r.nome} (${r.motivo})`).join('; ')}. Finché non si leggono, il pannello non avvia e non chiude nulla da solo.`,
          )}
      </Box>
      {scartata && (
        <Box flexDirection="row" gap={1} alignItems="center" flexWrap="wrap" backgroundColor={conVelo ? velo(GRIGIO, '1F') : undefined} paddingX={1}>
          <Text>{`Scartata «${scartata.titolo}»`}</Text>
          <Button key="annulla-scarto" plain hotkey="u" label="Annulla" onPress={fai(() => c.annullaScarto(scartata.id))} />
        </Box>
      )}
      {nota && (
        // Un bordo e non un velo: il rosso del segno sul proprio velo, sul fondo scuro, scende sotto 3:1.
        <Box borderStyle={conVelo ? 'round' : undefined} borderColor={STATO.errore} paddingX={1}>
          {nota1('nota', STATO.errore, '!', nota)}
        </Box>
      )}
      {vistaOra === 'carico' ? vistaCarico(d) : vistaOra === 'impostazioni' ? await vistaImpostazioni($, d) : vistaLavoro($, d)}
    </Box>
  )
}
