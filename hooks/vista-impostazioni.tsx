// Vista Impostazioni a sezioni (piano grafica, C2): Connessioni, Soglie, Bilanciamento, Progetto, Board, Avanzate.
// Si vede una sezione alla volta, scelta con chip in cima. F5.9: ogni controllo mette la modifica in una bozza della
// sessione (validata subito, l'errore in linea sotto il controllo); la barra in fondo la applica in una sola scrittura
// o la annulla. I popup (`$.ui.ask`) solo per le procedure guidate, che scrivono da sé; rifiutati, si fanno in linea.
import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { Fornitore, Pendenti, Peso, RisorseProgetto, StatoImpostazioni } from '../types'
import {
  budgetDa,
  conBozza,
  conPendente,
  conPosizione,
  dopoApplica,
  conProfilo,
  conSoglia,
  manualiDaScrivere,
  nuovoBudget,
  pesoScritto,
  posizioneDi,
  POSIZIONI,
  presetDi,
  piena,
  PROFILI,
  profiloDi,
  SEZIONE_DI,
  simula,
  SOGLIE_PRESET,
  TIPI_BUDGET,
} from './bilanciamento'
import type { Profilo } from './bilanciamento'
import { cartellaDati, conMisura, durata, endpointLocale, FORNITORI, livelloDi, nomeModello, piuPieno, sogliaDi } from './logica'
import type { Ctx, Dati } from './pannello'
import { eMsg, Errore, LEGENDA, LINGUE, msg, msgDi, NOMI_LINGUE } from './lingua'
import type { Chiave, Lingua, T } from './lingua'
import { INSTALLAZIONE, nomeLimiteIn, unitaIn } from './risorse'
import { GRIGIO, LIVELLO, STATO } from './tema'
import { componenti } from './ui'

type StatoVista = StatoImpostazioni
type Sezione = StatoVista['sezione']
type Gruppo = NonNullable<StatoVista['gruppo']>
const statoVista = atom({ plugin: 'chip-manager', key: 'impostazioni' } as const, { sezione: 'connessioni' } as StatoVista, { shape: 'impostazioni-1' })

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
  { valore: 'legenda', testo: 'imp.sezione.legenda' },
]
const TIPO = (t: string) => t[0]!.toUpperCase() + t.slice(1)

/**
 * F5.9 «Applica»: la bozza in una sola scrittura. Se un'altra sessione ha cambiato un campo toccato, niente è scritto e un
 * popup chiede «Ricarica e riapplica» (la bozza vince sui valori di adesso) o «Scarta». Vero se la bozza non c'è più.
 */
export async function applicaBozza($: EngineInterface, c: Ctx, T: T): Promise<boolean> {
  const p = (await read($, statoVista)).pendenti
  if (!p) return true
  try {
    const esito = await c.applica(p)
    if (!esito.cambiati.length) {
      // Si toglie solo ciò che è stato scritto: una modifica fatta intanto resta in bozza.
      await update($, statoVista, (s): StatoVista => ({
        ...s, pendenti: dopoApplica(s.pendenti, esito.scritti), errore: esito.errore && { dove: 'applica', testo: esito.errore },
      }))
      if (!esito.errore) $.ui.toast(T('salvato'))
      return !piena((await read($, statoVista)).pendenti)
    }
    const dove = [...new Set(esito.cambiati.map(k => T(SEZIONE_DI[k] ?? 'imp.sezione.progetto')))].join(', ')
    const scelta = await $.ui
      .ask(T('imp.conflitto', { dove }), { options: [T('imp.riapplica'), T('imp.scartaBozza')], header: T('imp.conflittoTitolo') })
      .catch(() => undefined)
    if (scelta === T('imp.riapplica')) {
      await update($, statoVista, (s): StatoVista => ({ ...s, pendenti: s.pendenti && { ...s.pendenti, base: { ...s.pendenti.base, ...esito.base } } }))
      return applicaBozza($, c, T)
    }
    if (scelta === T('imp.scartaBozza')) await update($, statoVista, (s): StatoVista => ({ ...s, pendenti: undefined, errore: undefined }))
    return scelta === T('imp.scartaBozza')
  } catch (err) {
    const m = msgDi(err)
    await update($, statoVista, (s): StatoVista => ({ ...s, errore: { dove: 'applica', testo: typeof m === 'string' ? m.slice(0, 300) : m } }))
    return false
  }
}

/** Uscendo dalle Impostazioni con una bozza: Applica / Scarta / Resta. Popup non disponibile: si esce e la bozza resta. */
export async function lasciaImpostazioni($: EngineInterface, c: Ctx, T: T): Promise<boolean> {
  const p = piena((await read($, statoVista)).pendenti)
  if (!p) return true
  const n = Object.keys(p.dove).length
  let scelta: string | undefined
  try {
    scelta = await $.ui.ask(T('imp.uscita', { n }), { options: [T('imp.applica'), T('imp.scarta'), T('imp.resta')], header: T('imp.uscitaTitolo') })
  } catch {
    return true
  }
  if (scelta === T('imp.applica')) return applicaBozza($, c, T)
  if (scelta === T('imp.scarta')) {
    await update($, statoVista, (s): StatoVista => ({ ...s, pendenti: undefined, errore: undefined }))
    return true
  }
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
  const nomeTipo = (x: (typeof TIPI_BUDGET)[number]) => TIPO(T(`budget.${x}`))

  /** Esegue, poi toast se va (senza `conferma`, nessun toast) e errore in linea sotto `dove` se non va. */
  const esegui = async (dove: string, fn: () => Promise<unknown>, conferma = T('salvato')) => {
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
    void cambia(s => {
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
              // La procedura guidata scrive da sé, sui limiti letti; un elenco già nella bozza riceve lo stesso budget.
              const nuovo = nuovoBudget(b.fornitore!, b.tipo!, misura, Date.now())
              const scritti = [...manualiDaScrivere(r0.limitiManuali), nuovo]
              await configura({ limitiManuali: scritti })
              await cambia(s => {
                const p = s.pendenti
                if (!p || !('limitiManuali' in p.campi)) return { ...s, bozza: undefined }
                const campi = { ...p.campi, limitiManuali: [...(p.campi.limitiManuali as unknown[]), nuovo] }
                return { ...s, bozza: undefined, pendenti: { ...p, campi, base: { ...p.base, limitiManuali: scritti } } }
              })
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
                onRimuovi: salva('budget', () => ({ limitiManuali: manualiDaScrivere(r.limitiManuali.filter(x => x.id !== l.id)) })),
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
          // Nella bozza come il resto; tornare alla lingua di adesso la toglie.
          onCambia: v =>
            void cambia(s => {
              const p = s.pendenti ?? { campi: {}, base: {}, dove: {} }
              const lingua = v === T.lingua ? undefined : (v as Lingua)
              const { lingua: _, ...altri } = p.dove
              const dove = lingua ? { ...altri, lingua: ['lingua'] } : altri
              return { ...s, pendenti: piena({ ...p, lingua, dove }), errore: undefined }
            }),
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

  const pendenti = Object.keys(piena(vista.pendenti)?.dove ?? {}).length
  const corpo =
    vista.sezione === 'legenda' ? legenda()
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
        onCambia: v => void cambia(s => ({ ...s, sezione: v as Sezione, errore: undefined })),
      })}
      {corpo}
      {pendenti > 0 && (
        <Box key="pendenti" flexDirection="row" flexWrap="wrap" columnGap={2} alignItems="center" borderStyle="single" borderDimColor paddingX={1}>
          <Text key="pendenti-n">{T('imp.nonSalvate', { n: pendenti })}</Text>
          <Button key="applica" variant="primary" hotkey="s" label={T('imp.applica')} onPress={() => void applicaBozza($, c, T)} />
          <Button key="annulla-modifiche" plain dimColor label={T('imp.annullaModifiche')} onPress={() => void cambia(s => ({ ...s, pendenti: undefined, errore: undefined }))} />
        </Box>
      )}
      {errore('applica')}
    </Box>
  )
}
