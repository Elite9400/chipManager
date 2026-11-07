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

import type { LockApi, TipoAccesso } from '../types'
import type { Azione, Chiamante, Consumo, Fornitore, Limite, Motore, Pendenti, Peso, PropostaPesi, Regole, Risorse, RisorseProgetto, SessioneProgetto, Sessioni, StatoBoard, StatoImpostazioni, Traguardi, Vista, Vita } from '../types'
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
import { traduttore } from './lingua'
import type { Lingua, Msg } from './lingua'
import { RISORSE_VUOTE } from './risorse'
import { ACCENTO, ALFA_VELO, GRIGIO, STATO, VELO } from './tema'
import { classeDi, componenti } from './ui'
import { vistaCarico } from './vista-carico'
import { apriBilanciamento, apriImpostazioni, lasciaImpostazioni, vistaImpostazioni } from './vista-impostazioni'
import { vistaLavoro } from './vista-lavoro'

// Copia identica degli atomi di register.tsx (lo scanner li vuole nel file che li usa).
const azioni = atom({ plugin: 'chip-manager', key: 'azioni' } as const, [] as Azione[], { shape: 'azioni-5' })
const aperta = atom({ plugin: 'chip-manager', key: 'aperta' } as const, null as string | null)
const selezionate = atom({ plugin: 'chip-manager', key: 'selezionate' } as const, [] as string[], { shape: 'selezionate-1' })
const vive = atom({ plugin: 'chip-manager', key: 'vive' } as const, {} as Record<string, Vita>, { shape: 'vive-2' })
const avviso = atom({ plugin: 'chip-manager', key: 'avviso' } as const, null as Msg | string | null)
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
const lockApi = atom({ plugin: 'chip-manager', key: 'lockApi' } as const, null as LockApi | null, { shape: 'lock-api-1' })
const spesaApi = atom({ plugin: 'chip-manager', key: 'spesaApi' } as const, null as { mese: string; speso: number | null; progetto?: number | null } | null, { shape: 'spesa-api-2' })
const consumo = atom({ plugin: 'chip-manager', key: 'consumo' } as const, { processi: 0, app: 0, byte: 0, byteLimiti: 0, salti: 0, comandi: {}, da: 0 } as Consumo, { shape: 'consumo-2' })
const propostePesi = atom({ plugin: 'chip-manager', key: 'proposte' } as const, [] as PropostaPesi[], { shape: 'proposte-1' })
const lingua = atom({ plugin: 'chip-manager', key: 'lingua' } as const, 'en' as Lingua)
const anteprimaChi = atom({ plugin: 'chip-manager', key: 'anteprimaChi' } as const, null as { id: string; preset: 'consigliato' | 'economico' | 'qualita' } | null, { shape: 'anteprima-chi-1' })
const dettagliChi = atom({ plugin: 'chip-manager', key: 'dettagliChi' } as const, null as string | null)
const statoImpostazioni = atom({ plugin: 'chip-manager', key: 'impostazioni' } as const, { sezione: 'connessioni' } as StatoImpostazioni, { shape: 'impostazioni-1' })

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
  /** F7.2: «Cambia» modello o effort di una sessione al lavoro (con conferma) e «Ricontrolla» di un esito incerto. */
  cambiaSessione: (a: Azione, campo: 'modello' | 'effort', valore: string) => Promise<unknown>
  ricontrollaCambio: (a: Azione) => Promise<unknown>
  /** F6.7: il controllo ✓/✗ della sezione Esecuzione, i login a un clic, il menu /config. */
  controllaEsecuzione: () => Promise<unknown>
  accedi: (tipo: TipoAccesso) => Promise<unknown>
  apriConfig: () => Promise<unknown>
  /** F6.2: «Libera» e «Termina» del lock della corsia API, ciascuno con il suo popup. */
  liberaApi: () => Promise<unknown>
  terminaApi: () => Promise<unknown>
  /** F5.9: applica la bozza delle Impostazioni; `cambiati` non vuoto = cambiati altrove, niente scritto. */
  applica: (p: Pendenti) => Promise<EsitoApplica>
  apriBoard: () => Promise<unknown>
  /** Applica o rifiuta una proposta di pesi alla versione vista; l'helper rifiuta se è cambiata. */
  decidiPesi: (p: PropostaPesi, esito: 'applica' | 'rifiuta') => Promise<unknown>
  annullaPesi: (p: PropostaPesi) => Promise<unknown>
}

/** L'esito di «Applica»: campi cambiati altrove (niente scritto) con i loro valori di adesso; `errore` = progetto scritto, lingua no. */
export type EsitoApplica = {
  cambiati: string[]
  base: Record<string, unknown>
  /** Fra i cambiati, quelli scritti da sé da una proposta di pesi: «Riapplica» li toglie dalla bozza invece di sovrascriverli. */
  immediati?: string[]
  errore?: Msg
}

const MOTORI = ['claude', 'codex', 'freellmapi'] as const
const NOMI_MOTORI: Record<Motore, string> = { claude: 'Claude', codex: 'Codex', freellmapi: 'FreeLLMAPI' }

/** Dati e pezzi comuni alle viste, letti una volta per disegno. */
async function comuni($: Eng, el: ElementTable, surface: RenderSurface, c: Ctx, colonne: number) {
  const { Box, Text, Button } = el
  const Select = 'Select' in el ? el.Select : undefined
  const Input = 'Input' in el ? el.Input : undefined
  // Il terminale non conosce l'alfa: lì l'etichetta è segno + parola, senza velo.
  const conVelo = surface !== 'terminal'
  // La larghezza vera del pannello, su ogni superficie (bodyColumns; 100 se l'host non la dà).
  const classe = classeDi(colonne)
  const T = traduttore(await read($, lingua))
  const ui = componenti(el, surface, T.lingua)

  const motore = (m: Motore | 'nessuno') => (m === 'nessuno' ? T('motore.nessuno') : NOMI_MOTORI[m])
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
  const scelte = await read($, selezionate)
  const lockApiOra = await read($, lockApi)
  const anteprimaChiOra = await read($, anteprimaChi)
  const dettagliChiOra = await read($, dettagliChi)
  // F7.1: una proposta di impostazioni nella bozza, o in coda: la vista Lavoro lo dice e porta alle Impostazioni.
  const imp = await read($, statoImpostazioni)
  const propostaImp = imp.proposta && imp.pendenti?.dove.some(x => x.startsWith('proposta:')) ? imp.proposta.da
    : imp.propostaInCoda ? imp.propostaInCoda.proponente.titolo || imp.propostaInCoda.proponente.id.slice(0, 14) : undefined
  const rivediImpostazioni = async () => {
    await update($, vista, () => 'impostazioni')
    await apriImpostazioni($, c)
  }
  const spesaApiOra = await read($, spesaApi)
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
  // Da dove vengono le regole, o perché non si leggono.
  const fonteRegole = regoleOra.lette ? regoleOra.fonte : regoleOra.motivo ? T('regole.nonLette', { motivo: T.m(regoleOra.motivo) }) : T('regole.nonLetteAncora')

  const fai = (fn: () => Promise<unknown>) => () => void c.fai(fn)
  const modifica = (a: Azione, campi: Partial<Azione>) => fai(() => c.salva({ ...a, ...campi }))
  // La data di completamento è quella della pressione, non del disegno.
  const completa = (a: Azione) => fai(() => c.salva({ ...a, ...transizione(a, 'completata', new Date().toISOString()) }))
  const apriChiudi = (id: string) => () => update($, aperta, x => (x === id ? null : id))
  const apriPerche = (id: string) => () => update($, aperta, x => (x === `perche:${id}` ? null : `perche:${id}`))
  const ferma = (a: Azione) => a.stato === 'avviata' && !a.qui && stati[a.id]?.stato === 'ferma'

  /** Stato di una chip: il segno nel colore dello stato, la parola nell'inchiostro (F5.2: ● ○ ◐ ? ✓ ✗ ⏸, mai il solo colore). */
  const statoDi = (a: Azione): { colore: string; segno: string; parola: string } => {
    if (a.stato === 'proposta') return { colore: STATO.coda, segno: '○', parola: T('stato.proposta') }
    if (a.stato === 'accodata') return { colore: STATO.coda, segno: '○', parola: T('stato.accodata') }
    if (a.stato === 'in-avvio')
      return {
        colore: STATO.coda,
        segno: a.incerto && !a.manuale ? '?' : '◐',
        parola: T(a.manuale ? 'stato.chiestaQui' : a.incerto ? 'stato.incerto' : 'stato.inAvvio'),
      }
    if (a.stato === 'fallita') return { colore: STATO.errore, segno: '✗', parola: T('stato.fallita') }
    if (a.stato === 'consegnata') return { colore: STATO.consegnata, segno: '✓', parola: T('stato.consegnata') }
    if (a.qui) return { colore: STATO.inCorso, segno: '●', parola: T('stato.qui') }
    if (ferma(a)) return { colore: STATO.attesa, segno: '⏸', parola: T('stato.ferma') }
    return { colore: STATO.inCorso, segno: '●', parola: T(stati[a.id] ? 'stato.inCorso' : 'stato.avviata') }
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
    // Una sessione senza titolo ne prende uno nella lingua del pannello.
    const titolo = s.titolo || T(s.id === 'self' ? 'sessione.questa' : s.motore === 'codex' ? 'sessione.codex' : 'sessione.senzaTitolo')
    if (!a && s.stato === 'ignota') return { ...s, titolo, parola: '—', segno: '○', colore: GRIGIO }
    return { ...s, azione: a, titolo: a?.titolo ?? titolo, parola: T(fermaOra ? 'sessione.ferma' : 'sessione.inCorso'), segno: fermaOra ? '⏸' : '●', colore: fermaOra ? STATO.attesa : STATO.inCorso }
  })
  for (const a of avviate)
    if (!righe.some(r => r.azione?.id === a.id)) {
      const fermaOra = ferma(a)
      righe.push({
        id: `chip-${a.id}`, motore: a.esecutore === 'codex' ? 'codex' : 'claude', titolo: a.titolo, ramo: stati[a.id]?.ramo,
        modello: modelloDi(a, regoleOra), effort: effortDi(a, regoleOra), stato: fermaOra ? 'ferma' : 'in-corso', attivita: stati[a.id]?.ultimaAttivita, azione: a,
        parola: T(a.stato === 'in-avvio' ? 'stato.inAvvio' : fermaOra ? 'sessione.ferma' : 'sessione.inCorso'), segno: a.stato === 'in-avvio' ? '◐' : fermaOra ? '⏸' : '●',
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
      scelta = await $.ui.ask(TESTI_PESI.domanda(p, T.lingua), { options: [T('pesi.applica'), T('pesi.rifiuta'), T('pesi.apri')], header: T('pesi.intestazione') })
    } catch {
      return // popup chiuso o nessuno a cui chiedere: Applica e Rifiuta restano sulla riga
    }
    if (scelta === T('pesi.applica')) await c.fai(() => c.decidiPesi(p, 'applica'))
    else if (scelta === T('pesi.rifiuta')) await c.fai(() => c.decidiPesi(p, 'rifiuta'))
    else if (scelta === T('pesi.apri')) {
      await update($, vista, () => 'impostazioni')
      await apriBilanciamento($)
    }
  }
  /** Una proposta aperta: il testo, poi Rivedi (popup), Applica e Rifiuta. `dove` tiene le chiavi uniche fra le viste. */
  const rigaProposta = (dove: string, p: PropostaPesi, conDettaglio = false) => (
    <Box key={`${dove}-${p.id}`} flexDirection="column">
      <Box flexDirection="row" flexWrap="wrap" gap={1} alignItems="center">
        {nota1(`${dove}-${p.id}-testo`, STATO.attesa, '◐', TESTI_PESI.riga(p, T.lingua))}
        <Button key={`${dove}-${p.id}-rivedi`} plain label={`${T('pesi.rivedi')}${suffisso(p)}`} onPress={() => void rivedi(p)()} />
        <Button key={`${dove}-${p.id}-applica`} plain label={`${T('pesi.applica')}${suffisso(p)}`} onPress={fai(() => c.decidiPesi(p, 'applica'))} />
        <Button key={`${dove}-${p.id}-rifiuta`} plain dimColor label={`${T('pesi.rifiuta')}${suffisso(p)}`} onPress={fai(() => c.decidiPesi(p, 'rifiuta'))} />
      </Box>
      {conDettaglio && (
        <Text key={`${dove}-${p.id}-dettaglio`} size="caption" dimColor wrap="wrap">
          {T('pesi.dettaglio', { prima: descriviPesi(p.partenza, T.lingua), dopo: descriviPesi(p.risultato, T.lingua), motivo: p.motivo })}
        </Text>
      )}
    </Box>
  )
  // L'applicazione ancora annullabile (revisione e origine del config sono le sue): al più una, cercata a parte, perché
  // una decisione successiva che non tocca il config (un rifiuto, una scadenza) non toglie la possibilità di annullarla.
  const daAnnullare = tutteProposte.find(p => pesiAnnullabili(p, regoleOra.risorse))
  const vocePesi = (dove: string, p: PropostaPesi) => (
    <Box key={`${dove}-${p.id}`} flexDirection="row" flexWrap="wrap" gap={1} alignItems="center">
      <Text size="caption" wrap="wrap">{TESTI_PESI.registro(p, T.lingua, adesso)}</Text>
      {p === daAnnullare && (
        <Button key={`${dove}-annulla`} plain label={T('pesi.annullaApplicata')} onPress={fai(() => c.annullaPesi(p))} />
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
      <Text key={`${dove}-registro`} size="caption" dimColor>{T('pesi.nessunaDecisione')}</Text>
    )

  return {
    el, T, fonteRegole, c, Select, Input, conVelo, classe, colonne, ui, io, tutte, senzaProgetto, ses, vistaOra, tutteLeSessioni, regoleOra, testoFiltro,
    lista, visibili, espansa, motiviAperti, scelte, lockApiOra, spesaApiOra, stati, nota, scartata, rotte, tr, adesso, capacita, sb, boardPronta, ultime, configura, fai, modifica,
    completa, apriChiudi, apriPerche, ferma, statoDi, nota1, proposte, tentativoAnnullabile, aspettaTe, attese, titoloSezione, righe,
    alLavoro, cella, fornitoriInUso, limiti, NOME_FORNITORE, MOTORI, motore, oraDi: T.ora, consumoOra,
    proposteAperte, rigaProposta, registroPesi, propostaImp, rivediImpostazioni, anteprimaChiOra, dettagliChiOra,
  }
}

export type Dati = Awaited<ReturnType<typeof comuni>>

export async function disegna($: Eng, el: ElementTable, surface: RenderSurface, c: Ctx, colonne = 100) {
  const d = await comuni($, el, surface, c, colonne)
  const { Box, Text, Button } = el
  const { T, conVelo, classe, ui, io, ses, vistaOra, regoleOra, nota, scartata, rotte, adesso, sb, boardPronta, fai, nota1,
    proposte, attese, alLavoro, fornitoriInUso, limiti, NOME_FORNITORE, oraDi } = d

  // Riga di sintesi: chi lavora, chi aspetta, e il margine più stretto per fornitore (solo misure fresche).
  const margine = (f: Fornitore) => {
    if (!fornitoriInUso.includes(f)) return undefined
    const nome = NOME_FORNITORE[f]
    // Un solo segno per fornitore visibile: c'era una misura, ora nessuna è più fresca.
    const vecchie = etaVecchie(limiti, f, adesso)
    if (vecchie !== undefined) return T('sintesi.vecchi', { nome, durata: durata(vecchie, T.lingua) })
    // Il margine in percentuale resta sulle quote di piano.
    const l = f === 'claude' || f === 'codex' ? piuPieno(limiti, f, adesso) : undefined
    if (!l) return undefined
    const livello = livelloDi(l.percentuale!, sogliaDi(regoleOra.risorse, f))
    return T(livello === 'critica' ? 'sintesi.critica' : livello === 'attenzione' ? 'sintesi.attenzione' : 'sintesi.uso', { nome, pct: l.percentuale! })
  }
  const sintesi =
    [
      T('sintesi.alLavoro', { n: alLavoro }),
      attese ? T('sintesi.aspettano', { n: attese }) : undefined,
      proposte ? T('sintesi.daAvviare', { n: proposte }) : undefined,
      ...FORNITORI.map(margine),
    ]
      .filter(Boolean)
      .join(' · ')

  const VISTE: { id: Vista; nome: string; tasto: string; chiave: string }[] = [
    { id: 'lavoro', nome: T('vista.lavoro'), tasto: '1', chiave: 'vista-lavoro' },
    { id: 'carico', nome: T('vista.carico'), tasto: '2', chiave: 'vista-carico' },
    { id: 'impostazioni', nome: T('vista.impostazioni'), tasto: '3', chiave: 'impostazioni' },
  ]
  // Le viste come chip di scelta (C1.5, F5.8): il solo nome; la scelta sta nel colore (primario d'accento), le altre attenuate.
  // Non usa `ui.Chip` per tenere il tasto (1 2 3) e la chiave del pulsante (vista-lavoro, …) di sempre.
  // F5.9: uscendo dalle Impostazioni con una bozza, prima il popup Applica / Scarta / Resta.
  const vai = async (id: Vista) => {
    if (vistaOra === 'impostazioni' && id !== 'impostazioni' && !(await lasciaImpostazioni($, c, T))) return
    await update($, vista, () => id)
    if (id === 'impostazioni' && vistaOra !== 'impostazioni') await apriImpostazioni($, c)
  }
  const schede = (
    <Box key="viste" flexDirection="row" flexWrap="wrap" gap={1}>
      {VISTE.map(v => {
        const attiva = v.id === vistaOra
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
            {attiva ? (
              <Button key={v.chiave} variant="primary" hotkey={v.tasto} label={v.nome} onPress={() => void vai(v.id)} />
            ) : (
              <Button key={v.chiave} plain dimColor hotkey={v.tasto} label={v.nome} onPress={() => void vai(v.id)} />
            )}
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
            boardPronta && <Button key="apri-board" plain hotkey="b" label={T('testata.apriBoard')} onPress={fai(c.apriBoard)} />,
            <Button key="ricarica" plain dimColor hotkey="r" label={ses.letto ? T('testata.aggiornaOra', { ora: T.ora(ses.letto) }) : T('testata.aggiorna')} onPress={fai(c.giro)} />,
            schede,
          ],
        })}
        <Text dimColor wrap="wrap">{sintesi}</Text>
        {boardPronta && <Text key="percorso-board" size="caption" dimColor wrap="truncate-middle">{T('testata.percorsoBoard', { percorso: sb.percorso ?? '' })}</Text>}
        {!regoleOra.lette && nota1('regole', STATO.errore, '▲', T('testata.regole', { fonte: d.fonteRegole }))}
        {rotte.length > 0 &&
          nota1(
            'rotte',
            STATO.attesa,
            '!',
            T('testata.rotte', { file: rotte.map(r => `${r.nome} (${T.m(r.motivo)})`).join('; ') }),
          )}
      </Box>
      {scartata && (
        <Box flexDirection="row" gap={1} alignItems="center" flexWrap="wrap" backgroundColor={conVelo ? velo(GRIGIO, VELO.testata) : undefined} paddingX={1}>
          <Text>{T('testata.scartata', { titolo: scartata.titolo })}</Text>
          <Button key="annulla-scarto" plain hotkey="u" label={T('comune.annulla')} onPress={fai(() => c.annullaScarto(scartata.id))} />
        </Box>
      )}
      {nota && (
        // Un bordo e non un velo: il rosso del segno sul proprio velo, sul fondo scuro, scende sotto 3:1.
        <Box borderStyle={conVelo ? 'round' : undefined} borderColor={STATO.errore} paddingX={1}>
          {nota1('nota', STATO.errore, '!', d.T.m(nota))}
        </Box>
      )}
      {vistaOra === 'carico' ? vistaCarico(d) : vistaOra === 'impostazioni' ? await vistaImpostazioni($, d) : vistaLavoro($, d)}
    </Box>
  )
}
