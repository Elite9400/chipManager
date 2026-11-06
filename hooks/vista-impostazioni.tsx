// Vista Impostazioni a sezioni (piano grafica, C2): Connessioni, Soglie, Bilanciamento, Progetto, Board, Avanzate.
// Si vede una sezione alla volta, scelta con chip in cima. F5.9: ogni controllo mette la modifica in una bozza della
// sessione (validata subito, l'errore in linea sotto il controllo); la barra in fondo la applica in una sola scrittura
// o la annulla. I popup (`$.ui.ask`) solo per le procedure guidate, che scrivono da sé; rifiutati, si fanno in linea.
import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { Fornitore, PassoEsecuzione, Pendenti, Peso, RisorseProgetto, StatoEsecuzione, StatoImpostazioni, TipoAccesso, VoceImpostazioni } from '../types'
import {
  budgetDa,
  campiDaProposta,
  conBozza,
  conPendente,
  conPosizione,
  conProfilo,
  conSoglia,
  manualiDaScrivere,
  nuovoBudget,
  pesoScritto,
  posizioneDi,
  POSIZIONI,
  presetDi,
  piena,
  pendentiDa,
  PROFILI,
  profiloDi,
  SEZIONE_DI,
  simula,
  SOGLIE_PRESET,
  TIPI_BUDGET,
  valoreConfig,
} from './bilanciamento'
import type { Profilo } from './bilanciamento'
import { cartellaDati, conMisura, durata, endpointLocale, FORNITORI, livelloDi, nomeModello, passiMancanti, piuPieno, sogliaDi, TETTO_API_PREDEFINITO } from './logica'
import type { Ctx, Dati } from './pannello'
import { eMsg, Errore, LEGENDA, LINGUE, msg, msgDi, NOMI_LINGUE } from './lingua'
import type { Chiave, Lingua, T } from './lingua'
import { INSTALLAZIONE, nomeLimiteIn, unitaIn } from './risorse'
import { GRIGIO, LIVELLO, STATO } from './tema'
import { componenti } from './ui'

type StatoVista = StatoImpostazioni
type Sezione = StatoVista['sezione']
type Gruppo = NonNullable<StatoVista['gruppo']>
/** La lingua salvata dell'utente, come la tiene il pannello (riletta al battito e dopo ogni scrittura). */
const linguaSalvata = atom({ plugin: 'chip-manager', key: 'lingua' } as const, 'en' as Lingua)
const statoVista = atom({ plugin: 'chip-manager', key: 'impostazioni' } as const, { sezione: 'connessioni' } as StatoVista, { shape: 'impostazioni-1' })
const esecuzione = atom({ plugin: 'chip-manager', key: 'esecuzione' } as const, {} as StatoEsecuzione, { shape: 'esecuzione-1' })

/** F6.7: entrando nella vista Impostazioni già sulla sezione Esecuzione, il controllo ✓/✗ (il disegno non scrive stato). */
export async function apriImpostazioni($: EngineInterface, c: Ctx) {
  if ((await read($, statoVista)).sezione === 'esecuzione') void c.controllaEsecuzione()
}

/** «Apri le impostazioni» di una proposta di pesi: la sezione Bilanciamento, dove la proposta resta in evidenza. */
export async function apriBilanciamento($: EngineInterface) {
  await update($, statoVista, (s): StatoVista => ({ ...s, sezione: 'bilanciamento', errore: undefined }))
}

const SEZIONI: { valore: Sezione; testo: Chiave }[] = [
  { valore: 'connessioni', testo: 'imp.sezione.connessioni' },
  { valore: 'soglie', testo: 'imp.sezione.soglie' },
  { valore: 'bilanciamento', testo: 'imp.sezione.bilanciamento' },
  { valore: 'progetto', testo: 'imp.sezione.progetto' },
  { valore: 'board', testo: 'imp.sezione.board' },
  { valore: 'avanzate', testo: 'imp.sezione.avanzate' },
  { valore: 'lingua', testo: 'imp.sezione.lingua' },
  { valore: 'esecuzione', testo: 'imp.sezione.esecuzione' },
  { valore: 'legenda', testo: 'imp.sezione.legenda' },
]
const TIPO = (t: string) => t[0]!.toUpperCase() + t.slice(1)

/**
 * Vero mentre «Applica» scrive (dalla pressione alla fine, popup di conflitto compreso). Si legge senza attese, così una
 * pressione che arriva durante la scrittura la vede sempre: la bozza resta ferma e la pressione è ignorata con un avviso.
 */
let inVolo = false

/**
 * L'epoca della bozza (nell'atomo): cresce a ogni modifica della bozza e a ogni «Applica» avviato e concluso. Un'azione che
 * attende qualcosa (popup, lettura) la legge prima dell'attesa e, dopo, agisce solo se è la stessa e nessun «Applica» è in
 * volo; altrimenti non tocca niente e lo dice.
 */
const epocaDi = (s: StatoVista) => s.epoca ?? 0
/** L'ultima epoca scritta da questo modulo: si legge senza attese, così un'azione la cattura nell'istante della pressione. */
let epocaNota = 0
const conEpoca = (s: StatoVista, n: StatoVista): StatoVista => ({ ...n, epoca: (epocaNota = epocaDi(s) + 1) })
export async function epocaBozza($: EngineInterface) {
  return epocaDi(await read($, statoVista))
}

/** Perché un'azione non vale più: un «Applica» in volo, o una bozza cambiata dall'epoca letta. */
function ferma(s: StatoVista, epoca: number | undefined): Chiave | undefined {
  if (inVolo) return 'imp.salvando'
  if (epoca !== undefined && epoca !== epocaDi(s)) return 'imp.cambiateNelFrattempo'
  return undefined
}

/** Cambia la bozza se l'azione vale ancora nel momento in cui la si scrive (vedi `ferma`); altrimenti lo dice. */
async function cambiaBozza($: EngineInterface, T: T, f: (s: StatoVista) => StatoVista, epoca?: number): Promise<boolean> {
  let motivo: Chiave | undefined
  await update($, statoVista, s => {
    motivo = ferma(s, epoca)
    return motivo ? s : conEpoca(s, f(s))
  })
  if (motivo) $.ui.toast(T(motivo))
  return !motivo
}

/**
 * All'avvio della sessione (anche dopo una ricarica del modulo con lo stato conservato): nessun «Applica» è in volo, e una
 * bozza di forma vecchia o sconosciuta si scarta, dicendolo. Mai un'eccezione per uno stato strano.
 */
export async function ripristinaImpostazioni($: EngineInterface, T: T) {
  let perso = false
  await update($, statoVista, (s): StatoVista => {
    const { applicando: _, pendenti, ...resto } = (s && typeof s === 'object' ? s : { sezione: 'connessioni' }) as StatoVista
    const letta = pendentiDa(pendenti)
    perso = letta.perso
    return conEpoca({ ...resto, epoca: typeof resto.epoca === 'number' ? resto.epoca : 0 }, { ...resto, ...(letta.pendenti && { pendenti: letta.pendenti }) })
  })
  if (perso) $.ui.toast(T('imp.bozzaScartata'))
}

/**
 * F5.9 «Applica»: la bozza in una sola scrittura, ferma finché la scrittura non finisce. Se un'altra sessione ha cambiato un
 * campo toccato, niente è scritto e un popup chiede «Ricarica e riapplica» (la bozza vince) o «Scarta». `epoca`, se data, è
 * quella letta prima di un popup: se intanto la bozza è cambiata non si applica. Vero se la bozza non c'è più.
 */
export async function applicaBozza($: EngineInterface, c: Ctx, T: T, epoca = epocaNota): Promise<boolean> {
  // L'epoca è quella della pressione (o del popup). La bozza si ferma subito; poi, nella stessa scrittura che segna
  // l'inizio, si controlla che sia ancora quella: una modifica arrivata fra la pressione e la lettura annulla l'Applica.
  if (inVolo) {
    $.ui.toast(T('imp.salvando'))
    return false
  }
  inVolo = true
  let cambiata = false
  try {
    await update($, statoVista, (s): StatoVista => {
      cambiata = epoca !== epocaDi(s)
      return cambiata ? s : conEpoca(s, { ...s, applicando: true })
    })
    if (cambiata) {
      $.ui.toast(T('imp.cambiateNelFrattempo'))
      return false
    }
    return await applicaFerma($, c, T)
  } finally {
    inVolo = false
    if (!cambiata) await update($, statoVista, (s): StatoVista => conEpoca(s, { ...s, applicando: undefined }))
  }
}

/**
 * F7.1: la proposta presa dal file va in coda (al più una); se la bozza è vuota e nessun «Applica» scrive, la riempie,
 * con la fascia «proposta da una sessione». Una bozza aperta non si tocca mai: la proposta aspetta.
 */
export async function versaProposta($: EngineInterface, T: T, r0: RisorseProgetto, salvata: Lingua, voce?: VoceImpostazioni): Promise<'riempita' | 'in-coda' | 'niente'> {
  let esito: 'riempita' | 'in-coda' | 'niente' = 'niente'
  await update($, statoVista, (s): StatoVista => {
    const v = s.propostaInCoda ?? voce
    if (!v) return s
    if (inVolo || piena(s.pendenti)) {
      esito = 'in-coda'
      return s.propostaInCoda ? s : { ...s, propostaInCoda: v }
    }
    const campi = campiDaProposta(v.proposta, r0)
    const lingua = v.proposta.lingua && v.proposta.lingua !== salvata ? v.proposta.lingua : undefined
    // I valori sono stati controllati alla proposta; se intanto le impostazioni sono cambiate e non passano più, si scarta.
    if (eMsg(conBozza(r0, campi)) || (!Object.keys(campi).length && !lingua)) return { ...s, propostaInCoda: undefined }
    esito = 'riempita'
    const pendenti: Pendenti = {
      campi, base: Object.fromEntries(Object.keys(campi).map(k => [k, valoreConfig(r0, k)])),
      // I pesi vanno in coppia col profilo: una modifica sola per l'utente.
      dove: [...Object.keys(campi).filter(k => k !== 'pesi'), ...(lingua ? ['lingua'] : [])].map(k => `proposta:${k}`),
      ...(lingua && { lingua, linguaBase: salvata }),
    }
    return conEpoca(s, { ...s, pendenti, propostaInCoda: undefined, errore: undefined,
      proposta: { id: v.id, da: v.proponente.titolo || v.proponente.id.replace(/^local_/, '').slice(0, 8), motivo: v.proposta.motivo } })
  })
  return esito
}

/** Una scrittura sola, con «Applica» in volo (solo questa funzione cambia la bozza finché dura). */
async function applicaFerma($: EngineInterface, c: Ctx, T: T): Promise<boolean> {
  const p = piena((await read($, statoVista)).pendenti)
  if (!p) return true
  const scrivi = (f: (s: StatoVista) => StatoVista) => update($, statoVista, (s): StatoVista => conEpoca(s, f(s)))
  try {
    const esito = await c.applica(p)
    if (!esito.cambiati.length) {
      // La bozza non è cambiata durante la scrittura: se ne va tutta, tranne la lingua se il suo salvataggio è fallito.
      const resta = esito.errore && p.lingua ? { campi: {}, base: {}, dove: ['lingua'], lingua: p.lingua } : undefined
      await scrivi(s => ({ ...s, pendenti: resta, errore: esito.errore && { dove: 'applica', testo: esito.errore } }))
      if (!esito.errore) $.ui.toast(T('salvato'))
      return !resta
    }
    const dove = [...new Set(esito.cambiati.map(k => T(SEZIONE_DI[k] ?? 'imp.sezione.progetto')))].join(', ')
    const prima = await epocaBozza($)
    const scelta = await $.ui
      .ask(T('imp.conflitto', { dove }), { options: [T('imp.riapplica'), T('imp.scartaBozza')], header: T('imp.conflittoTitolo') })
      .catch(() => undefined)
    // La bozza è ferma, ma la regola vale per ogni attesa: dopo il popup si agisce solo sulla bozza di prima.
    if ((await epocaBozza($)) !== prima) {
      $.ui.toast(T('imp.cambiateNelFrattempo'))
      return false
    }
    if (scelta === T('imp.riapplica')) {
      // I campi che una proposta di pesi ha scritto da sé escono dalla bozza: «Riapplica» non li sovrascrive mai.
      const via = new Set(esito.immediati ?? [])
      await scrivi(s => {
        const q = s.pendenti
        if (!q) return s
        const tieni = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([k]) => !via.has(k)))
        const { lingua: linguaOra, ...altre } = esito.base
        const base = { ...q.base, ...altre }
        const dove = via.size ? q.dove.filter(d => !/^(profilo|peso-|proposta:profilo)/.test(d)) : q.dove
        const linguaBase = typeof linguaOra === 'string' ? (linguaOra as Lingua) : q.linguaBase
        return { ...s, pendenti: piena({ ...q, campi: tieni(q.campi), base: tieni(base), dove, ...(linguaBase && { linguaBase }) }) }
      })
      if (via.size) $.ui.toast(T('imp.pesiDaProposta'))
      return applicaFerma($, c, T)
    }
    if (scelta === T('imp.scartaBozza')) await scrivi(s => ({ ...s, pendenti: undefined, errore: undefined }))
    return scelta === T('imp.scartaBozza')
  } catch (err) {
    const m = msgDi(err)
    await update($, statoVista, (s): StatoVista => ({ ...s, errore: { dove: 'applica', testo: typeof m === 'string' ? m.slice(0, 300) : m } }))
    return false
  }
}

/** Uscendo dalle Impostazioni con una bozza: Applica / Scarta / Resta. Popup non disponibile: si esce e la bozza resta. */
export async function lasciaImpostazioni($: EngineInterface, c: Ctx, T: T): Promise<boolean> {
  // Mentre «Applica» scrive si resta: la scrittura finisce qui, con il suo esito e i suoi popup.
  if (inVolo) {
    $.ui.toast(T('imp.salvando'))
    return false
  }
  const s0 = await read($, statoVista)
  const p = piena(s0.pendenti)
  if (!p) return true
  const epoca = epocaDi(s0)
  let scelta: string | undefined
  try {
    scelta = await $.ui.ask(T('imp.uscita', { n: p.dove.length }), { options: [T('imp.applica'), T('imp.scarta'), T('imp.resta')], header: T('imp.uscitaTitolo') })
  } catch {
    // Popup non disponibile: si esce e la bozza resta, ma non mentre un «Applica» (partito intanto) scrive.
    if (!inVolo) return true
    $.ui.toast(T('imp.salvando'))
    return false
  }
  // Dopo il popup si agisce solo sulla bozza che il popup ha mostrato, e mai con un «Applica» in volo.
  const motivo = ferma(await read($, statoVista), epoca)
  if (motivo) {
    $.ui.toast(T(motivo))
    return false
  }
  if (scelta === T('imp.applica')) return applicaBozza($, c, T, epoca)
  if (scelta === T('imp.scarta')) return cambiaBozza($, T, (s): StatoVista => ({ ...s, pendenti: undefined, errore: undefined }), epoca)
  return false
}

export async function vistaImpostazioni($: EngineInterface, d: Dati) {
  const { T, c, Input, regoleOra, adesso, capacita, sb, configura, nota1, NOME_FORNITORE, MOTORI, motore, ultime, io } = d
  const { Box, Text, Button } = d.el
  const terminale = !d.conVelo
  const u = componenti(d.el, terminale ? 'terminal' : 'desktop', T.lingua)
  const classe = d.classe
  const vista = await read($, statoVista)
  // I controlli mostrano la bozza sopra le regole lette; una bozza che non passa più la validazione non si mostra.
  const r0 = regoleOra.risorse
  const conB = vista.pendenti ? conBozza(r0, vista.pendenti.campi) : r0
  const r = eMsg(conB) ? r0 : conB
  const cambia = (f: (s: StatoVista) => StatoVista) => update($, statoVista, f)
  /** Cambia la bozza solo se l'azione vale ancora quando la si scrive (nessun «Applica» in volo, `epoca` invariata). */
  const inBozza = (f: (s: StatoVista) => StatoVista, epoca?: number) => cambiaBozza($, T, f, epoca)
  const nomeTipo = (x: (typeof TIPI_BUDGET)[number]) => TIPO(T(`budget.${x}`))

  /** Esegue, poi toast se va (senza `conferma`, nessun toast) e errore in linea sotto `dove` se non va. */
  const esegui = async (dove: string, fn: () => Promise<unknown>, conferma = T('salvato')) => {
    if (inVolo) return void $.ui.toast(T('imp.salvando'))
    try {
      await fn()
      await cambia(s => ({ ...s, errore: undefined }))
      if (conferma) $.ui.toast(conferma)
    } catch (err) {
      const m = msgDi(err)
      await cambia(s => ({ ...s, errore: { dove, testo: typeof m === 'string' ? m.slice(0, 300) : m } }))
    }
  }
  /** F5.9: la modifica va nella bozza, validata come la scriverebbe `configura`; l'errore resta in linea sotto `dove`. */
  const salva = (dove: string, campi: () => Record<string, unknown>) => () =>
    void inBozza(s => {
      try {
        const p = conPendente(s.pendenti, r0, dove, campi())
        const prova = conBozza(r0, p.campi)
        if (eMsg(prova)) throw new Errore(prova)
        return { ...s, pendenti: p, errore: undefined }
      } catch (err) {
        const m = msgDi(err)
        return { ...s, errore: { dove, testo: typeof m === 'string' ? m.slice(0, 300) : m } }
      }
    })
  const errore = (dove: string) =>
    vista.errore?.dove === dove ? nota1(`errore-${dove}`, STATO.errore, '▲', T.m(vista.errore.testo)) : null
  const didascalia = (k: string, testo: string) => (
    <Text key={k} size="caption" dimColor wrap="wrap">
      {testo}
    </Text>
  )

  // --- Connessioni -------------------------------------------------------------------------------------
  const ammessi = FORNITORI.filter(f => r.fornitori.includes(f))
  const misure = (f: Fornitore) => Object.values(ultime).filter(l => l.fornitore === f && !l.manuale && conMisura(l) && l.letto)
  const ultima = (f: Fornitore) => misure(f).sort((a, b) => Date.parse(b.letto!) - Date.parse(a.letto!))[0]
  const collegati = ammessi.filter(f => !!ultima(f))

  /** La procedura di «Collega…»: un testo e le scelte; la stessa nel popup e in linea. */
  const guida = (f: Fornitore): { testo: string; scelte: { etichetta: string; fai: () => Promise<unknown>; conferma: string }[] } => {
    const verifica = { etichetta: T('con.verifica'), fai: c.giro, conferma: T('con.lettureAggiornate') }
    const admin = T('con.admin')
    if (f === 'claude')
      return {
        testo: terminale
          ? T('con.claudeTerminale', { comando: `node "${$.plugin.root.replace(/\\/g, '/')}/strumenti/fornitori.cjs" statusline`, admin })
          : T('con.claudeDesktop', { admin }),
        scelte: [verifica],
      }
    if (f === 'codex') return { testo: T('con.codex'), scelte: [verifica] }
    if (f === 'deepseek')
      return { testo: T('con.deepseek'), scelte: [verifica] }
    return {
      testo: T('con.free'),
      scelte: [
        { etichetta: T('con.prepara'), fai: () => c.installa(0), conferma: '' },
        { etichetta: T('con.avviaContainer'), fai: () => c.installa(1), conferma: '' },
        verifica,
      ],
    }
  }
  const collega = (f: Fornitore) => async () => {
    const g = guida(f)
    let scelta: string
    try {
      scelta = await $.ui.ask(T('con.domanda', { testo: g.testo }), { options: [...g.scelte.map(s => s.etichetta), T('az.chiudi')], header: T('con.collega') })
    } catch {
      // Popup chiuso o nessuno a cui chiedere (-p): la procedura resta in linea, sotto la riga.
      await cambia(s => ({ ...s, guida: f }))
      return
    }
    const s = g.scelte.find(x => x.etichetta === scelta)
    if (s) await esegui(`collega-${f}`, s.fai, s.conferma)
  }

  const statoFornitore = (f: Fornitore) => {
    if (!r.fornitori.includes(f)) return u.Chip({ chiave: `stato-chip-${f}`, testo: T('con.vietato'), segno: '✕', colore: GRIGIO })
    const l = ultima(f)
    if (!l) return u.Chip({ chiave: `stato-chip-${f}`, testo: T('con.daCollegare'), segno: '○', colore: STATO.coda })
    return u.Chip({ chiave: `stato-chip-${f}`, testo: T('con.collegato', { fonte: l.fonte, durata: durata(Math.max(0, adesso - Date.parse(l.letto!)), T.lingua) }), segno: '●', colore: STATO.inCorso })
  }
  // La diagnosi delle sonde (le viste operative la tacciono): solo per gli ammessi, come nella 2.3.1.
  const diagnosi = (f: Fornitore) => {
    const righe = capacita.limiti.filter(l => l.fornitore === f && !l.manuale)
      .map(l => (l.errore ? `${nomeLimiteIn(l, T.lingua)} · ${T.k(l.errore)}` : `${nomeLimiteIn(l, T.lingua)} · ${T('con.letto', { durata: durata(Math.max(0, adesso - Date.parse(l.letto!)), T.lingua) })}`))
    if (f === 'freellmapi') righe.push(T(capacita.chiavi.freellmapi ? 'con.proxyChiave' : 'con.proxySenzaChiave', { proxy: T.k(capacita.proxy) }))
    return `${NOME_FORNITORE[f]}: ${righe.join(' · ') || (capacita.proxy === 'proxy.helper' ? T.k(capacita.proxy) : T('con.nessunaLettura'))}`
  }
  const chiave = (f: Fornitore) =>
    f === 'claude' ? T(capacita.chiavi.anthropic ? 'con.adminImpostata' : 'con.adminMancante') : f === 'deepseek' ? T(capacita.chiavi.deepseek ? 'con.chiaveImpostata' : 'con.chiaveMancante') : undefined

  const connessioni = () => {
    const stato = T('con.stato', { n: collegati.length, mancanti: ammessi.length - collegati.length })
    return u.Sezione({
      chiave: 'pagina-connessioni',
      titolo: T('imp.sezione.connessioni'),
      descrizione: T('con.descrizione'),
      stato,
      figli: [
        u.GruppoChip({
          chiave: 'fornitore', etichetta: T('con.ammessi'), modo: 'filtro', valore: r.fornitori,
          voci: FORNITORI.map(f => ({ valore: f, testo: NOME_FORNITORE[f] })),
          onCambia: v => salva('fornitori', () => ({ fornitori: FORNITORI.filter(f => v.includes(f)) }))(),
        }),
        errore('fornitori'),
        ...FORNITORI.map(f => {
          const g = vista.guida === f ? guida(f) : undefined
          return (
            <Box key={`connessione-${f}`} flexDirection="column">
              {u.Riga({
                chiave: `riga-${f}`,
                classe,
                principale: [
                  <Box key={`nome-${f}`} flexDirection="row" flexWrap="wrap" gap={1} alignItems="center">
                    <Text weight="medium">{NOME_FORNITORE[f]}</Text>
                    {statoFornitore(f)}
                  </Box>,
                  r.fornitori.includes(f) && didascalia(`stato-${f}`, diagnosi(f)),
                  chiave(f) && didascalia(`chiave-${f}`, chiave(f)!),
                ],
                azioni: r.fornitori.includes(f) && !ultima(f) ? [<Button key={`collega-${f}`} variant="secondary" label={T('con.collegaFornitore', { fornitore: NOME_FORNITORE[f] })} onPress={() => void collega(f)()} />] : [],
              })}
              {errore(`collega-${f}`)}
              {g && (
                <Box key={`guida-${f}`} flexDirection="column" gap={1} paddingLeft={2}>
                  {didascalia(`guida-${f}-testo`, g.testo)}
                  <Box flexDirection="row" flexWrap="wrap" gap={1}>
                    {g.scelte.map((s, i) => (
                      <Button key={`guida-${f}-${i}`} variant="secondary" label={T('con.passoPer', { passo: s.etichetta, fornitore: NOME_FORNITORE[f] })} onPress={() => void esegui(`collega-${f}`, s.fai, s.conferma)} />
                    ))}
                    <Button key={`guida-${f}-chiudi`} plain dimColor label={T('con.chiudiProcedura', { fornitore: NOME_FORNITORE[f] })} onPress={() => void cambia(s => ({ ...s, guida: undefined }))} />
                  </Box>
                </Box>
              )}
            </Box>
          )
        }),
        didascalia('chiavi-nota', T('con.chiaviNota')),
      ],
    })
  }

  // --- Soglie ------------------------------------------------------------------------------------------
  /** Uso attuale e soglie su una traccia di 20 celle da 5%: la parola dice il livello, il colore lo ripete. */
  const anteprima = (f: Fornitore) => {
    const s = sogliaDi(r, f)
    const l = piuPieno(d.limiti, f, adesso)
    const uso = l?.percentuale
    const livello = uso === undefined ? 'ok' : livelloDi(uso, s)
    const cella = (i: number) => (s && (i + 1) * 5 === s.critica ? '┃' : s && (i + 1) * 5 === s.attenzione ? '│' : uso !== undefined && i < Math.round(uso / 5) ? '█' : '░')
    const traccia = Array.from({ length: 20 }, (_, i) => cella(i)).join('')
    const parole = uso === undefined ? T('sog.nessunaMisura') : T(livello === 'critica' ? 'sog.usoCritica' : livello === 'attenzione' ? 'sog.usoAttenzione' : 'sog.uso', { pct: uso })
    return (
      <Text key={`anteprima-${f}`} size="caption">
        <Text color={LIVELLO[livello]} dimColor={livello === 'ok'}>{traccia}</Text>
        {` ${parole} · ${s ? T('car.soglie', { attenzione: s.attenzione, critica: s.critica }) : T('car.nessunaSoglia')}`}
      </Text>
    )
  }
  const sogliaUi = (f: Fornitore) => {
    const s = sogliaDi(r, f)
    const nome = NOME_FORNITORE[f]
    const scrivi = (n: typeof s) => salva(`soglia-${f}`, () => ({ soglie: conSoglia(r.soglie, f, n) }))()
    return (
      <Box key={`soglie-${f}`} flexDirection="column" gap={1}>
        <Text weight="medium">{nome}</Text>
        {u.GruppoChip({
          chiave: `soglia-${f}`, etichetta: T(presetDi(s) ? 'sog.preset' : 'sog.presetPersonale'), modo: 'scelta', valore: presetDi(s),
          voci: SOGLIE_PRESET.map(p => ({ valore: p.valore, testo: T(p.testo) })), contesto: nome, onCambia: v => scrivi(SOGLIE_PRESET.find(p => p.valore === v)!.soglia),
        })}
        {s &&
          u.Gamma({
            chiave: `attenzione-${f}`, etichetta: T('sog.attenzioneDa', { nome }), valore: s.attenzione, min: 1, max: s.critica - 1, passo: 5,
            formato: v => `${v === null ? '' : T.numero(v)}%`, onCambia: v => scrivi({ ...s, attenzione: v }),
          })}
        {s &&
          u.Gamma({
            chiave: `critica-${f}`, etichetta: T('sog.criticaDa', { nome }), valore: s.critica, min: s.attenzione + 1, max: 100, passo: 5,
            formato: v => `${v === null ? '' : T.numero(v)}%`, onCambia: v => scrivi({ ...s, critica: v }),
          })}
        {anteprima(f)}
        {errore(`soglia-${f}`)}
      </Box>
    )
  }
  const soglie = () => {
    const stato = T('sog.stato', { n: d.fornitoriInUso.length })
    return u.Sezione({
      chiave: 'pagina-soglie',
      titolo: T('imp.sezione.soglie'),
      descrizione: T('sog.descrizione'),
      stato,
      figli: d.fornitoriInUso.length
        ? d.fornitoriInUso.map(sogliaUi)
        : [didascalia('soglie-vuote', T('sog.vuote'))],
    })
  }

  // --- Bilanciamento ---------------------------------------------------------------------------------
  const profilo = profiloDi(r)
  const simulazione = () => {
    // Rilievo 7: la simulazione vede le regole con la bozza, come i controlli.
    const esito = simula({ ...regoleOra, risorse: r }, capacita.limiti, d.tutte, io)
    if (esito.motivi)
      return [
        nota1('simulazione', STATO.attesa, '▲', T('bil.simulazioneNessuna')),
        ...esito.motivi.map((m, i) => didascalia(`simulazione-motivo-${i}`, `· ${T.m(m)}`)),
      ]
    const a = esito.scelta!
    return [
      <Text key="simulazione" wrap="wrap">
        {T('bil.simulazione', { scelta: `${motore(a.esecutore)} · ${nomeModello(a.modello ?? '')} · ${a.effort}` })}
      </Text>,
    ]
  }
  const voci: Record<Gruppo, { nome: string; testo: string }[]> = {
    fornitore: MOTORI.filter(m => r.fornitori.includes(m)).map(m => ({ nome: m, testo: motore(m) })),
    modello: MOTORI.filter(m => r.fornitori.includes(m)).flatMap(m => regoleOra.modelli[m].map(x => ({ nome: x, testo: nomeModello(x) }))),
    effort: regoleOra.effort.map(e => ({ nome: e, testo: `effort ${e}` })),
  }
  const regolazione = (tipo: Gruppo, v: { nome: string; testo: string }) => {
    const p = r.pesi.find(x => x.tipo === tipo && x.nome === v.nome)
    const i = posizioneDi(p)
    const dove = `peso-${tipo}-${v.nome}`
    const scrivi = (n: number) => salva(dove, () => ({ profilo: 'personalizzato', pesi: conPosizione(r.pesi, tipo, v.nome, n) }))()
    return (
      <Box key={`regolazione-${tipo}-${v.nome}`} flexDirection="column">
        {u.Gamma({
          chiave: dove, etichetta: v.testo, valore: i < 0 ? null : i, min: 0, max: POSIZIONI.length - 1, passo: 1,
          formato: n => (n === null ? pesoScritto(p as Peso, T.lingua) : T(POSIZIONI[n]!.nome)), onCambia: scrivi,
        })}
        {i < 0 && <Button key={`${dove}-normale`} plain label={T('bil.riporta', { voce: v.testo })} onPress={() => scrivi(2)} />}
        {errore(dove)}
      </Box>
    )
  }
  const bilanciamento = () => {
    const stato = T('bil.stato', { profilo: T(PROFILI.find(p => p.id === profilo)!.nome) })
    return u.Sezione({
      chiave: 'pagina-bilanciamento',
      titolo: T('imp.sezione.bilanciamento'),
      descrizione: T('bil.descrizione'),
      stato,
      figli: [
        ...(d.proposteAperte.length
          ? [<Box key="bil-proposte" flexDirection="column" gap={1}>{d.proposteAperte.map(p => d.rigaProposta('bil-pesi', p, true))}</Box>]
          : []),
        u.GruppoChip({
          chiave: 'profilo', etichetta: T('bil.profilo'), modo: 'scelta', valore: profilo, voci: PROFILI.map(p => ({ valore: p.id, testo: T(p.nome) })),
          onCambia: v => salva('profilo', () => ({ profilo: v, pesi: conProfilo(r.pesi, v as Profilo) }))(),
        }),
        <Box key="profili-descrizione" flexDirection="column">
          {PROFILI.map(p => didascalia(`profilo-${p.id}-descrizione`, `${T(p.nome)}: ${T(p.descrizione)}`))}
        </Box>,
        didascalia('profili-nota', T('bil.profiliNota')),
        didascalia('legenda-rimando', T('legenda.rimando')),
        errore('profilo'),
        ...simulazione(),
        didascalia('simulazione-nota', T('bil.simulazioneNota')),
        <Button
          key="regola-a-mano"
          plain
          label={T(vista.regola ? 'bil.chiudiRegola' : 'bil.regola')}
          onPress={() => void cambia(s => ({ ...s, regola: !s.regola }))}
        />,
        ...(vista.regola
          ? [
              u.GruppoChip({
                chiave: 'gruppo', etichetta: T('bil.gruppo'), modo: 'scelta', valore: vista.gruppo ?? 'fornitore',
                voci: [{ valore: 'fornitore', testo: T('bil.fornitori') }, { valore: 'modello', testo: T('bil.modelli') }, { valore: 'effort', testo: T('tab.effort') }],
                onCambia: v => void cambia(s => ({ ...s, gruppo: v as Gruppo })),
              }),
              ...voci[vista.gruppo ?? 'fornitore'].map(v => regolazione(vista.gruppo ?? 'fornitore', v)),
            ]
          : []),
      ],
    })
  }

  // --- Progetto --------------------------------------------------------------------------------------
  /** Cartella dei dati e file della configurazione, letti come li legge il resto della mod; solo per mostrarli. */
  const percorsi = async () => {
    const casa = ((await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME')) ?? '').replace(/\\/g, '/')
    const config = (await $.env.get('CHIPMANAGER_CONFIG')) ?? `${casa}/.claude/chipmanager/config.json`
    const env = await $.env.get('CHIPMANAGER_DIR')
    if (env) return { config, cartella: env.replace(/\\/g, '/') }
    const letto = await $.fs.read(config).then(t => JSON.parse(t as string) as unknown, () => null)
    return { config, cartella: cartellaDati(letto, io?.repo ?? null, casa) ?? T('pro.cartellaNonValida') }
  }
  const budgetScritto = (l: RisorseProgetto['limitiManuali'][number]) =>
    `${NOME_FORNITORE[l.fornitore]} · ${nomeLimiteIn(l, T.lingua)} · ${l.percentuale !== undefined ? `${T.numero(l.percentuale)}%` : `${T.numero(l.valore ?? 0)} ${unitaIn(l.unita, T.lingua)}`}`
  const aggiungiBudget = async () => {
    const nomi = ammessi.map(f => NOME_FORNITORE[f])
    const bozza: NonNullable<StatoVista['bozza']> = {}
    try {
      if (!ammessi.length) throw new Errore(msg('pro.nessunAmmesso'))
      const f = ammessi.length === 1 ? ammessi[0] : ammessi[nomi.indexOf(await $.ui.ask(T('pro.budgetFornitore'), { options: nomi.slice(0, 4), header: T('pro.budget') }))]
      // Una risposta libera («Altro») che non è un fornitore: il resto si sceglie in linea.
      if (!f) throw new Error('provider to choose in line')
      bozza.fornitore = f
      const t = await $.ui.ask(T('pro.budgetTipo', { fornitore: NOME_FORNITORE[f] }), { options: TIPI_BUDGET.map(nomeTipo), header: T('pro.budget') })
      bozza.tipo = TIPI_BUDGET.find(x => nomeTipo(x) === t)
    } catch (err) {
      if (!ammessi.length) return void (await cambia(s => ({ ...s, errore: { dove: 'budget', testo: msgDi(err) } })))
      // Popup rifiutato: i passi mancanti si scelgono in linea.
    }
    await cambia(s => ({ ...s, bozza, errore: undefined }))
  }
  const bozzaUi = (b: NonNullable<StatoVista['bozza']>) => (
    <Box key="bozza-budget" flexDirection="column" gap={1} paddingLeft={2}>
      {u.GruppoChip({
        chiave: 'bozza-fornitore', etichetta: T('pro.fornitore'), modo: 'scelta', valore: b.fornitore ?? '',
        voci: ammessi.map(f => ({ valore: f, testo: NOME_FORNITORE[f] })), onCambia: v => void cambia(s => ({ ...s, bozza: { ...s.bozza, fornitore: v as Fornitore } })),
      })}
      {u.GruppoChip({
        chiave: 'bozza-tipo', etichetta: T('pro.tipo'), modo: 'scelta', valore: b.tipo ?? '',
        voci: TIPI_BUDGET.map(t => ({ valore: t, testo: nomeTipo(t) })), onCambia: v => void cambia(s => ({ ...s, bozza: { ...s.bozza, tipo: v } })),
      })}
      {Input && b.fornitore && b.tipo && (
        <Input
          key="bozza-valore"
          label={T('pro.valore', { fornitore: NOME_FORNITORE[b.fornitore], tipo: nomeTipo(b.tipo as (typeof TIPI_BUDGET)[number]), esempio: T('budget.esempio') })}
          onSubmit={testo =>
            void esegui('budget', async () => {
              const misura = budgetDa(testo)
              if ('k' in misura) throw new Errore(misura)
              // La procedura guidata scrive da sé, sui limiti letti: i budget non stanno nella bozza.
              await configura({ limitiManuali: [...manualiDaScrivere(r0.limitiManuali), nuovoBudget(b.fornitore!, b.tipo!, misura, Date.now())] })
              await cambia(s => ({ ...s, bozza: undefined }))
            })
          }
        />
      )}
      <Button key="bozza-annulla" plain dimColor label={T('pro.annullaBudget')} onPress={() => void cambia(s => ({ ...s, bozza: undefined, errore: undefined }))} />
    </Box>
  )
  const progetto = async () => {
    const { config, cartella } = await percorsi()
    const stato = `${T(r.soloLocale ? 'pro.soloLocale' : 'pro.abilitati')} · ${T('pro.budgetManuali', { n: r.limitiManuali.length })}`
    return u.Sezione({
      chiave: 'pagina-progetto',
      titolo: T('imp.sezione.progetto'),
      descrizione: T('pro.descrizione'),
      stato,
      figli: [
        u.GruppoChip({
          chiave: 'rete', etichetta: T('pro.rete'), modo: 'scelta', valore: r.soloLocale ? 'locale' : 'abilitati',
          voci: [{ valore: 'abilitati', testo: T('pro.abilitati') }, { valore: 'locale', testo: T('pro.soloLocale') }],
          onCambia: v => salva('rete', () => ({ soloLocale: v === 'locale' }))(),
        }),
        didascalia('rete-nota', r.soloLocale
          ? T('pro.reteBloccati')
          : T('pro.reteAmmessi')),
        errore('rete'),
        u.Chip({
          chiave: 'milestone-github', testo: T('pro.milestone'), attiva: r.milestoneGithub,
          onPress: salva('milestone', () => ({ milestoneGithub: !r.milestoneGithub })),
        }),
        errore('milestone'),
        <Box key="cartella" flexDirection="column">
          {didascalia('cartella-titolo', T('pro.cartella'))}
          <Text wrap="truncate-middle">{cartella}</Text>
        </Box>,
        <Box key="sensibili" flexDirection="column">
          {didascalia('sensibili-titolo', T('pro.sensibili', { config }))}
          {regoleOra.sensibili.length ? (
            <Box flexDirection="row" flexWrap="wrap" gap={1}>
              {regoleOra.sensibili.map((t, i) => u.Chip({ chiave: `sensibile-${i}`, testo: t, segno: '▲', colore: STATO.attesa }))}
            </Box>
          ) : (
            <Text>{T('pro.sensibiliNessuno')}</Text>
          )}
        </Box>,
        <Box key="budget" flexDirection="column" gap={1}>
          {didascalia('budget-titolo', T('pro.budgetTitolo'))}
          <Box flexDirection="row" flexWrap="wrap" gap={1}>
            {r.limitiManuali.map(l =>
              u.Chip({
                chiave: `budget-${l.id}`, testo: budgetScritto(l), segno: '•',
                // Il budget scrive subito, come la procedura che lo aggiunge: non sta nella bozza.
                onRimuovi: () => void esegui('budget', () => configura({ limitiManuali: manualiDaScrivere(r0.limitiManuali.filter(x => x.id !== l.id)) })),
              }),
            )}
            {!vista.bozza && <Button key="aggiungi-budget" variant="secondary" label={T('pro.aggiungiBudget')} onPress={() => void aggiungiBudget()} />}
          </Box>
          {vista.bozza && bozzaUi(vista.bozza)}
          {errore('budget')}
        </Box>,
      ],
    })
  }

  // --- Board -------------------------------------------------------------------------------------------
  const MODI: { valore: RisorseProgetto['board']['modo']; testo: string }[] = [
    { valore: 'spenta', testo: T('boa.spenta') },
    { valore: 'accesa', testo: T('boa.accesa') },
    { valore: 'riassunti', testo: T('boa.riassunti') },
  ]
  const board = () => {
    const stato = MODI.find(m => m.valore === r.board.modo)!.testo
    return u.Sezione({
      chiave: 'pagina-board',
      titolo: T('imp.sezione.board'),
      descrizione: T('boa.descrizione'),
      stato,
      figli: [
        u.GruppoChip({
          chiave: 'board', etichetta: T('boa.etichetta'), modo: 'scelta', valore: r.board.modo, voci: MODI,
          onCambia: v => salva('board', () => ({ board: { modo: v } }))(),
        }),
        didascalia('board-nota', r.board.modo === 'riassunti'
          ? [T('boa.costoRiassunti'), r.soloLocale || !r.fornitori.includes('claude') ? T('boa.fermi') : '', sb.riassunti ? T.k(sb.riassunti) : ''].filter(Boolean).join('. ') + '.'
          : r.board.modo === 'accesa'
            ? T('boa.costoAccesa')
            : T('boa.notaSpenta')),
        sb.percorso ? (
          <Text key="board-percorso" size="caption" wrap="truncate-middle">{T('boa.file', { percorso: sb.percorso })}</Text>
        ) : null,
        r.board.modo !== 'spenta' && sb.motivo ? nota1('board-motivo', STATO.attesa, '!', T('boa.nonScritta', { motivo: T.k(sb.motivo) })) : null,
        errore('board'),
      ],
    })
  }

  // --- Avanzate ----------------------------------------------------------------------------------------
  const LIVELLI = [
    { valore: 'niente', testo: T('ava.niente') },
    { valore: 'R1', testo: T('ava.r1') },
    { valore: 'R2', testo: T('ava.r2') },
  ]
  // --- Esecuzione (F6.6) ------------------------------------------------------------------------------------
  // La chiave API di Claude si inserisce SOLO nelle opzioni sensibili della mod (archivio sicuro dell'host): qui se ne dice
  // la presenza, mai il valore, e non passa mai per popup, bozza o JSON. Budget, tetto e consigliere vanno nella bozza.
  const CONSIGLI = [
    { valore: 'spento', testo: T('ese.spento') },
    { valore: 'suggerisci', testo: T('ese.suggerisci') },
    { valore: 'applica', testo: T('ese.applica') },
  ]
  const numeroUsd = (testo: string, min: number, max: number) => {
    const n = Number(testo.trim().replace(',', '.'))
    if (!Number.isFinite(n) || n < min || n > max) throw new Errore(msg('ese.numero', { min, max }))
    return Math.round(n * 100) / 100
  }
  const sezioneEsecuzione = async () => {
    const api = r.apiClaude
    const chiave = !!regoleOra.chiaveApi
    const github = /^[^/\s]+\/[^/\s]+$/.test(io?.repo ?? '')
    const stato = T(api ? 'ese.statoApi' : 'ese.statoLocale')
    const es = await read($, esecuzione)
    const k = es.controllo
    const mancanti = passiMancanti(k, chiave, !!api)
    // Senza passi da fare la procedura non si disegna; il controllo che la trova finita la chiude (register.tsx).
    const guidaPassi = es.guida ? mancanti.filter(p => !es.guida!.saltati.includes(p)) : []
    const segno = (ok: boolean | undefined) => (ok === undefined ? ['…', GRIGIO] : ok ? ['✓', STATO.inCorso] : ['✗', STATO.attesa]) as [string, string]
    const riga = (key: string, ok: boolean | undefined, testo: string) => nota1(key, segno(ok)[1], segno(ok)[0], testo)
    const accesso = (tipo: TipoAccesso, pre: string) => {
      const a = es.accessi?.[tipo]
      return a ? (
        <Box key={`${pre}-attesa-${tipo}`} flexDirection="column">
          {didascalia(`${pre}-attesa-${tipo}-testo`, T('ese.attesaAccesso'))}
          {a.codice ? <Text key={`${pre}-codice-${tipo}`} weight="semibold">{T('ese.codiceGh', { codice: a.codice })}</Text> : null}
        </Box>
      ) : (
        <Button key={`${pre}-accedi-${tipo}`} variant="secondary" label={T(tipo === 'claude' ? 'ese.accedi' : 'ese.collegaGh')} onPress={() => void esegui('esecuzione', () => c.accedi(tipo), '')} />
      )
    }
    const copia = (pre: string) =>
      es.copia ? (
        <Box key={`${pre}-copia`} flexDirection="column">
          {didascalia(`${pre}-copia-testo`, T('ese.copiaRiga'))}
          <Text key={`${pre}-copia-riga`} wrap="wrap">{es.copia.riga}</Text>
          <Button key={`${pre}-copia-premi`} variant="secondary" label={T('ese.copia')}
            onPress={() => void $.ui.copy({ text: es.copia!.riga }).then(x => x.isCopied && $.ui.toast(T('ese.copiato')))} />
        </Box>
      ) : null
    /** L'azione di un passo mancante: la stessa nella riga e nella procedura guidata (`pre` distingue le chiavi). */
    const azione = (p: PassoEsecuzione, pre: string): JSX.Element[] => {
      if (p === 'claude') return k?.claude.trovato ? [accesso('claude', pre)] : [didascalia(`${pre}-claude-assente`, T('ese.claudeAssente'))]
      if (p === 'github') {
        if (!k?.github.trovato) return [didascalia(`${pre}-gh-assente`, T('ese.ghAssente'))]
        if (!k.github.loggedIn) return [accesso('gh', pre)]
        return [didascalia(`${pre}-gh-remote`, T('ese.ghRemote'))]
      }
      if (p === 'chiave')
        return [
          <Button key={`${pre}-chiave-vai`} variant="secondary" label={T('ese.chiaveVai')} onPress={() => void esegui('esecuzione', c.apriConfig, '')} />,
          didascalia(`${pre}-chiave-percorso`, T('ese.chiavePercorso')),
        ]
      if (p === 'fonti')
        return (k?.fonti ?? []).map(f => (
          <Box key={`${pre}-fonte-${f.nome}`} flexDirection="column">
            <Text key={`${pre}-fonte-${f.nome}-testo`} wrap="wrap">
              {f.nome === 'ambiente' ? T('ese.ambienteNo')
                : f.illeggibile ? T('ese.fonteNonValida', { fonte: T(`ese.fonte.${f.nome}`) })
                : T('ese.fonteNo', { fonte: T(`ese.fonte.${f.nome}`), chiavi: (f.chiavi ?? []).join(', ') })}
            </Text>
            {f.file ? <Text key={`${pre}-fonte-${f.nome}-file`} size="caption" dimColor wrap="wrap">{f.file}</Text> : null}
            {/* Mai aperto con un'app esterna (potrebbe modificarlo): solo il percorso da copiare, un'etichetta per file. */}
            {f.file && f.nome !== 'ambiente' ? (
              <Button key={`${pre}-fonte-${f.nome}-copia`} plain label={`${T('ese.copiaPercorso')} · ${T(`ese.fonte.${f.nome}`)}`}
                onPress={() => void $.ui.copy({ text: f.file! }).then(x => x.isCopied && $.ui.toast(T('ese.percorsoCopiato')))} />
            ) : null}
          </Box>
        ))
      return [didascalia(`${pre}-budget-nota`, T('ese.guidaBudget'))]
    }
    const ghOk = k ? k.github.loggedIn && k.github.remote : undefined
    const passo = guidaPassi[0]
    return u.Sezione({
      chiave: 'pagina-esecuzione',
      titolo: T('imp.sezione.esecuzione'),
      descrizione: T('ese.descrizione'),
      stato,
      figli: [
        // F6.7: che cosa è pronto, calcolato dalla mod; per ogni ✗ l'azione a un clic.
        <Box key="ese-stato" flexDirection="column" gap={1}>
          <Box key="ese-stato-testa" flexDirection="row" flexWrap="wrap" columnGap={2} alignItems="center">
            <Text key="ese-stato-titolo" weight="semibold">{T('ese.statoTitolo')}</Text>
            <Button key="ese-ricontrolla" plain label={es.inCorso ? T('ese.controllando') : T('ese.ricontrolla')} onPress={() => void c.controllaEsecuzione()} />
            {mancanti.length && !passo ? (
              <Button key="ese-guida" variant="primary" label={T('ese.guida')} onPress={() => void (async () => {
                await update($, esecuzione, s => ({ ...s, guida: { saltati: [] } }))
                await c.controllaEsecuzione()
              })()} />
            ) : null}
          </Box>
          {es.fallito ? nota1('ese-controllo-fallito', STATO.errore, '▲', T('ese.controlloFallito')) : null}
          {riga('ese-riga-claude', k && k.claude.loggedIn, T(!k || k.claude.trovato ? (k?.claude.loggedIn ? 'ese.claudeOk' : 'ese.claudeNo') : 'ese.claudeAssente') + (k?.claude.metodo ? ` · ${k.claude.metodo}` : ''))}
          {k && !k.claude.loggedIn && k.claude.trovato && !passo ? accesso('claude', 'ese') : null}
          {riga('ese-riga-github', ghOk, T(!k ? 'ese.ghNo' : !k.github.trovato ? 'ese.ghAssente' : !k.github.loggedIn ? 'ese.ghNo' : k.github.remote ? 'ese.ghOk' : 'ese.ghRemote'))}
          {k && k.github.trovato && !k.github.loggedIn && !passo ? accesso('gh', 'ese') : null}
          {riga('ese-chiave', chiave, T(chiave ? 'ese.chiavePresente' : 'ese.chiaveAssente'))}
          {!chiave && !passo ? azione('chiave', 'ese') : null}
          {riga('ese-riga-fonti', k ? !k.fonti.length : undefined, k && k.fonti.length ? T('ese.fontiNo', { n: k.fonti.length }) : T('ese.fontiOk'))}
          {k?.fonti.length && !passo ? azione('fonti', 'ese') : null}
          {riga('ese-riga-budget', !!api, api ? T('ese.budgetOk', { budget: api.budgetUsd, tetto: api.tetto }) : T('ese.budgetNo'))}
          {passo ? null : copia('ese')}
          {errore('esecuzione')}
        </Box>,
        // La procedura guidata: un passo mancante alla volta, ognuno si può saltare; si chiude da sola quando è tutto ✓.
        passo ? (
          <Box key="ese-guida-passo" flexDirection="column" gap={1} borderStyle="single">
            <Text key="ese-guida-titolo" weight="semibold">{`${T('ese.guida')} · ${T('ese.guidaPasso', { n: mancanti.indexOf(passo) + 1, tot: mancanti.length })}`}</Text>
            {azione(passo, 'guida')}
            {copia('guida')}
            <Box key="ese-guida-pulsanti" flexDirection="row" flexWrap="wrap" columnGap={2}>
              <Button key="guida-salta" plain label={T('ese.salta')} onPress={() => void update($, esecuzione, s => ({ ...s, guida: s.guida && guidaPassi.length > 1 ? { saltati: [...s.guida.saltati, passo] } : undefined }))} />
              <Button key="guida-chiudi" plain dimColor label={T('ese.guidaChiudi')} onPress={() => void update($, esecuzione, s => ({ ...s, guida: undefined }))} />
            </Box>
          </Box>
        ) : null,
        // API Claude: chiave (solo presenza), modello di minaccia, budget del mese e tetto per tentativo.
        <Box key="ese-api" flexDirection="column" gap={1}>
          <Text key="ese-api-titolo" weight="semibold">{T('ese.apiTitolo')}</Text>
          {didascalia('ese-chiave-dove', T('ese.chiaveDove'))}
          {didascalia('ese-chiave-dedicata', T('ese.chiaveDedicata'))}
          {didascalia('ese-chiave-rischio', T('ese.chiaveRischio'))}
          {Input ? (
            <Input key="ese-budget" label={T('ese.budget')} value={api ? String(api.budgetUsd) : ''}
              onSubmit={v => salva('api', () => ({ apiClaude: { budgetUsd: numeroUsd(v, 0.01, 100_000), tetto: api?.tetto ?? TETTO_API_PREDEFINITO } }))()} />
          ) : null}
          {Input && api ? (
            <Input key="ese-tetto" label={T('ese.tetto')} value={String(api.tetto)}
              onSubmit={v => salva('api', () => ({ apiClaude: { budgetUsd: api.budgetUsd, tetto: numeroUsd(v, 0.01, Math.min(1_000, api.budgetUsd)) } }))()} />
          ) : null}
          {didascalia('ese-tetto-nota', T('ese.tettoNota'))}
          {api && <Button key="ese-api-togli" plain dimColor label={T('ese.apiTogli')} onPress={salva('api', () => ({ apiClaude: null }))} />}
          {errore('api')}
        </Box>,
        // Cloud di Claude: niente da configurare qui; si verifica il remote GitHub e si dice che cosa serve.
        <Box key="ese-cloud" flexDirection="column" gap={1}>
          <Text key="ese-cloud-titolo" weight="semibold">{T('ese.cloudTitolo')}</Text>
          {nota1('ese-github', github ? STATO.inCorso : STATO.attesa, github ? '✓' : '○', T(github ? 'ese.github' : 'ese.noGithub'))}
          {didascalia('ese-cloud-come', T('ese.cloudCome'))}
          {didascalia('ese-cloud-extra', T('ese.cloudExtra'))}
        </Box>,
        u.GruppoChip({
          chiave: 'consigliere', etichetta: T('ese.consigliere'), modo: 'scelta', valore: r.consigliere ?? 'spento', voci: CONSIGLI,
          onCambia: v => salva('consigliere', () => ({ consigliere: v === 'spento' ? null : v }))(),
        }),
        didascalia('ese-consigliere-nota', T('ese.consigliereNota')),
        errore('consigliere'),
      ],
    })
  }

  const avanzate = () => {
    const stato = `FreeLLMAPI: ${LIVELLI.find(l => l.valore === r.freellmapi.livello)!.testo}`
    return u.Sezione({
      chiave: 'pagina-avanzate',
      titolo: T('imp.sezione.avanzate'),
      descrizione: T('ava.descrizione'),
      stato,
      figli: [
        u.GruppoChip({
          chiave: 'free-livello', etichetta: T('ava.compiti'), modo: 'scelta', valore: r.freellmapi.livello, voci: LIVELLI,
          onCambia: v => salva('free-livello', () => ({ freellmapi: { ...r.freellmapi, livello: v } }))(),
        }),
        errore('free-livello'),
        Input ? (
          <Input
            key="free-endpoint"
            label={T('ava.endpoint')}
            value={r.freellmapi.endpoint}
            onSubmit={v =>
              salva('free-endpoint', () => {
                if (!endpointLocale(v.trim())) throw new Errore(msg('ava.endpointLocale'))
                return { freellmapi: { ...r.freellmapi, endpoint: v.trim() } }
              })()
            }
          />
        ) : null,
        errore('free-endpoint'),
        didascalia('installa-nota', T('ava.installaNota')),
        ...INSTALLAZIONE.map((cmd, i) => (
          <Box key={`installazione-${i}`} flexDirection="column">
            <Text size="caption" wrap="wrap">{cmd.join(' ')}</Text>
            <Button key={`installa-${i}`} variant="secondary" label={`${T(i === 0 ? 'con.prepara' : 'con.avviaContainer')}…`} onPress={() => void esegui('installa', () => c.installa(i), '')} />
          </Box>
        )),
        errore('installa'),
      ],
    })
  }

  // --- Lingua ------------------------------------------------------------------------------------------
  // Dell'utente, non del progetto: ogni lingua col suo nome, così chi non capisce quella attuale ritrova la sua.
  const lingua = () => {
    const stato = NOMI_LINGUE[T.lingua]
    return u.Sezione({
      chiave: 'pagina-lingua',
      titolo: T('imp.sezione.lingua'),
      descrizione: T('imp.lingua.descrizione'),
      stato,
      figli: [
        u.GruppoChip({
          chiave: 'lingua', etichetta: T('imp.lingua.etichetta'), modo: 'scelta', valore: vista.pendenti?.lingua ?? T.lingua,
          voci: LINGUE.map(l => ({ valore: l, testo: NOMI_LINGUE[l] })),
          // Nella bozza come il resto; pendente solo se diversa dalla lingua salvata quando la scelta arriva (riletta).
          onCambia: v =>
            void (async () => {
              // Il congelamento si controlla quando la scelta entra nella bozza, dopo la lettura: un «Applica» partito
              // nel frattempo (anche già finito) rende vecchia la lingua letta.
              if (inVolo) return void $.ui.toast(T('imp.salvando'))
              const epoca = await epocaBozza($)
              const salvata = await read($, linguaSalvata)
              await inBozza(s => {
                const p = s.pendenti ?? { campi: {}, base: {}, dove: [] }
                const lingua = v === salvata ? undefined : (v as Lingua)
                const dove = [...p.dove.filter(x => x !== 'lingua'), ...(lingua ? ['lingua'] : [])]
                return { ...s, pendenti: piena({ ...p, lingua, dove }), errore: undefined }
              }, epoca)
            })(),
        }),
        errore('lingua'),
        didascalia('lingua-nota', T('imp.lingua.nota')),
      ],
    })
  }

  // --- Legenda -----------------------------------------------------------------------------------------
  // Una voce per riga, dallo stesso dizionario della board; le fasi di sviluppo stanno solo nei README.
  const legenda = () =>
    u.Sezione({
      chiave: 'pagina-legenda',
      titolo: T('imp.sezione.legenda'),
      descrizione: T('legenda.descrizione'),
      figli: (['corsie', 'termini'] as const).map(g => (
        <Box key={`legenda-${g}`} flexDirection="column">
          <Text key={`legenda-${g}-titolo`} bold>{T(`legenda.${g}`)}</Text>
          {LEGENDA[g].map(k => (
            <Text key={k} wrap="wrap">
              {T(k)}
            </Text>
          ))}
        </Box>
      )),
    })

  const pendenti = piena(vista.pendenti)?.dove.length ?? 0
  const propostaVisibile = !!vista.proposta && !!piena(vista.pendenti)?.dove.some(x => x.startsWith('proposta:'))
  const corpo =
    vista.sezione === 'esecuzione' ? await sezioneEsecuzione()
      : vista.sezione === 'legenda' ? legenda()
      : vista.sezione === 'lingua' ? lingua()
      : vista.sezione === 'soglie' ? soglie()
      : vista.sezione === 'bilanciamento' ? bilanciamento()
        : vista.sezione === 'progetto' ? await progetto()
          : vista.sezione === 'board' ? board()
            : vista.sezione === 'avanzate' ? avanzate()
              : connessioni()

  return (
    <Box key="configurazione" flexDirection="column" gap={1}>
      {u.GruppoChip({
        chiave: 'sezione', etichetta: T('imp.sezione'), modo: 'scelta', valore: vista.sezione, voci: SEZIONI.map(s => ({ valore: s.valore, testo: T(s.testo) })),
        onCambia: v => {
          if (v === 'esecuzione') void c.controllaEsecuzione()
          void cambia(s => ({ ...s, sezione: v as Sezione, errore: undefined }))
        },
      })}
      {propostaVisibile ? (
        <Box key="proposta-impostazioni" flexDirection="column" borderStyle="single" paddingX={1}>
          <Text key="proposta-impostazioni-titolo" weight="semibold" wrap="wrap">{T('imp.propostaDa', { da: vista.proposta!.da })}</Text>
          <Text key="proposta-impostazioni-motivo" wrap="wrap">{vista.proposta!.motivo}</Text>
          <Text key="proposta-impostazioni-come" size="caption" dimColor wrap="wrap">{T('imp.propostaCome')}</Text>
        </Box>
      ) : null}
      {vista.propostaInCoda ? nota1('proposta-in-coda', STATO.coda, '◔', T('imp.propostaInCoda', { da: vista.propostaInCoda.proponente.titolo || vista.propostaInCoda.proponente.id.slice(0, 14) })) : null}
      {corpo}
      {pendenti > 0 && (
        <Box key="pendenti" flexDirection="row" flexWrap="wrap" columnGap={2} alignItems="center" borderStyle="single" borderDimColor paddingX={1}>
          <Text key="pendenti-n">{vista.applicando && inVolo ? T('imp.salvando') : T('imp.nonSalvate', { n: pendenti })}</Text>
          <Button key="applica" variant="primary" hotkey="s" label={T('imp.applica')} onPress={() => void applicaBozza($, c, T)} />
          <Button key="annulla-modifiche" plain dimColor label={T('imp.annullaModifiche')} onPress={() => void inBozza(s => ({ ...s, pendenti: undefined, errore: undefined }))} />
        </Box>
      )}
      {errore('applica')}
    </Box>
  )
}
