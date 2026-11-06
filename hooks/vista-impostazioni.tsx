// Vista Impostazioni a sezioni (piano grafica, C2): Connessioni, Soglie, Bilanciamento, Progetto, Board, Avanzate.
// Si vede una sezione alla volta, scelta con chip in cima. Ogni controllo salva da sé: toast «Salvato» se va,
// l'errore in linea sotto il controllo se non va. I popup (`$.ui.ask`) solo per le procedure guidate; rifiutati,
// la stessa procedura si fa in linea.
import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { Fornitore, Peso, RisorseProgetto, StatoImpostazioni } from '../types'
import {
  budgetDa,
  conPosizione,
  conProfilo,
  conSoglia,
  manualiDaScrivere,
  nuovoBudget,
  pesoScritto,
  posizioneDi,
  POSIZIONI,
  presetDi,
  PROFILI,
  profiloDi,
  simula,
  SOGLIE_PRESET,
  TIPI_BUDGET,
} from './bilanciamento'
import type { Profilo } from './bilanciamento'
import { cartellaDati, conMisura, durata, endpointLocale, FORNITORI, livelloDi, nomeModello, piuPieno, sogliaDi } from './logica'
import type { Dati } from './pannello'
import { INSTALLAZIONE } from './risorse'
import { GRIGIO, LIVELLO, STATO } from './tema'
import { componenti } from './ui'

type StatoVista = StatoImpostazioni
type Sezione = StatoVista['sezione']
type Gruppo = NonNullable<StatoVista['gruppo']>
const statoVista = atom({ plugin: 'chip-manager', key: 'impostazioni' } as const, { sezione: 'connessioni' } as StatoVista, { shape: 'impostazioni-1' })

const SEZIONI: { valore: Sezione; testo: string }[] = [
  { valore: 'connessioni', testo: 'Connessioni' },
  { valore: 'soglie', testo: 'Soglie' },
  { valore: 'bilanciamento', testo: 'Bilanciamento' },
  { valore: 'progetto', testo: 'Progetto' },
  { valore: 'board', testo: 'Board' },
  { valore: 'avanzate', testo: 'Avanzate' },
]
const TIPO = (t: string) => t[0]!.toUpperCase() + t.slice(1)

export async function vistaImpostazioni($: EngineInterface, d: Dati) {
  const { c, Input, regoleOra, adesso, capacita, sb, configura, nota1, NOME_FORNITORE, MOTORI, motore, ultime, io } = d
  const { Box, Text, Button } = d.el
  const terminale = !d.conVelo
  const u = componenti(d.el, terminale ? 'terminal' : 'desktop')
  const classe = d.stretto ? 'stretta' : 'media'
  const r = regoleOra.risorse
  const vista = await read($, statoVista)
  const cambia = (f: (s: StatoVista) => StatoVista) => update($, statoVista, f)

  /** Esegue, poi toast se va (senza `conferma`, nessun toast) e errore in linea sotto `dove` se non va. */
  const esegui = async (dove: string, fn: () => Promise<unknown>, conferma = 'Salvato') => {
    try {
      await fn()
      await cambia(s => ({ ...s, errore: undefined }))
      if (conferma) $.ui.toast(conferma)
    } catch (err) {
      await cambia(s => ({ ...s, errore: { dove, testo: String((err as Error)?.message ?? err).slice(0, 300) } }))
    }
  }
  const salva = (dove: string, campi: () => Record<string, unknown>) => () => void esegui(dove, () => configura(campi()))
  const errore = (dove: string) =>
    vista.errore?.dove === dove ? nota1(`errore-${dove}`, STATO.errore, '▲', `${vista.errore.testo}`) : null
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
    const verifica = { etichetta: 'Verifica ora', fai: c.giro, conferma: 'Letture aggiornate' }
    const admin = 'Facoltativo: la spesa API con la chiave Admin Anthropic nel campo segreto di /config.'
    if (f === 'claude')
      return {
        testo: terminale
          ? `Da terminale l'uso del piano arriva dalla status line. Nel tuo script di status line passa il JSON a:\n\nnode "${$.plugin.root.replace(/\\/g, '/')}/strumenti/fornitori.cjs" statusline\n\nScrive solo istante e percentuali in ~/.claude/chipmanager/statusline.json. ${admin}`
          : `Dal desktop Claude si collega da solo: l'uso del piano arriva dall'app. ${admin}`,
        scelte: [verifica],
      }
    if (f === 'codex') return { testo: 'I limiti di Codex si leggono dalle sessioni locali di Codex CLI: basta averlo usato una volta su questo computer.', scelte: [verifica] }
    if (f === 'deepseek')
      return { testo: 'La chiave DeepSeek va nel campo segreto di /config (impostazioni della mod), mai nel config del progetto. Poi verifica il collegamento.', scelte: [verifica] }
    return {
      testo: 'FreeLLMAPI gira in un container Docker locale. Prepara l\'immagine, poi avvia il container; copia la chiave unificata dal dashboard http://localhost:3001 nel campo segreto di /config. Ogni comando chiede conferma.',
      scelte: [
        { etichetta: 'Prepara immagine Docker', fai: () => c.installa(0), conferma: '' },
        { etichetta: 'Avvia container', fai: () => c.installa(1), conferma: '' },
        verifica,
      ],
    }
  }
  const collega = (f: Fornitore) => async () => {
    const g = guida(f)
    let scelta: string
    try {
      scelta = await $.ui.ask(`${g.testo}\n\nCosa faccio adesso?`, { options: [...g.scelte.map(s => s.etichetta), 'Chiudi'], header: 'Collega' })
    } catch {
      // Popup chiuso o nessuno a cui chiedere (-p): la procedura resta in linea, sotto la riga.
      await cambia(s => ({ ...s, guida: f }))
      return
    }
    const s = g.scelte.find(x => x.etichetta === scelta)
    if (s) await esegui(`collega-${f}`, s.fai, s.conferma)
  }

  const statoFornitore = (f: Fornitore) => {
    if (!r.fornitori.includes(f)) return u.Chip({ chiave: `stato-chip-${f}`, testo: 'Vietato per questo progetto', segno: '✕', colore: GRIGIO })
    const l = ultima(f)
    if (!l) return u.Chip({ chiave: `stato-chip-${f}`, testo: 'Da collegare', segno: '○', colore: STATO.coda })
    return u.Chip({ chiave: `stato-chip-${f}`, testo: `Collegato · ${l.fonte} · ${durata(Math.max(0, adesso - Date.parse(l.letto!)))} fa`, segno: '●', colore: STATO.inCorso })
  }
  // La diagnosi delle sonde (le viste operative la tacciono): solo per gli ammessi, come nella 2.3.1.
  const diagnosi = (f: Fornitore) => {
    const righe = capacita.limiti.filter(l => l.fornitore === f && !l.manuale)
      .map(l => (l.errore ? `${l.nome} · ${l.errore}` : `${l.nome} · letto ${durata(Math.max(0, adesso - Date.parse(l.letto!)))} fa`))
    if (f === 'freellmapi') righe.push(`proxy ${capacita.proxy} · chiave ${capacita.chiavi.freellmapi ? 'impostata' : 'mancante'}`)
    return `${NOME_FORNITORE[f]}: ${righe.join(' · ') || (capacita.proxy === 'helper non disponibile' ? 'helper non disponibile' : 'nessuna lettura')}`
  }
  const chiave = (f: Fornitore) =>
    f === 'claude' ? `Chiave Admin Anthropic ${capacita.chiavi.anthropic ? 'impostata' : 'mancante'}` : f === 'deepseek' ? `Chiave ${capacita.chiavi.deepseek ? 'impostata' : 'mancante'}` : undefined

  const connessioni = () => {
    const stato = `${collegati.length} ${collegati.length === 1 ? 'collegato' : 'collegati'} · ${ammessi.length - collegati.length} da collegare`
    return u.Sezione({
      chiave: 'pagina-connessioni',
      titolo: 'Connessioni',
      descrizione: 'Quali fornitori può usare questo progetto e da dove si leggono i loro limiti.',
      stato,
      figli: [
        u.GruppoChip({
          chiave: 'fornitore', etichetta: 'Ammessi per questo progetto', modo: 'filtro', valore: r.fornitori,
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
                azioni: r.fornitori.includes(f) && !ultima(f) ? [<Button key={`collega-${f}`} variant="secondary" label={`Collega ${NOME_FORNITORE[f]}…`} onPress={() => void collega(f)()} />] : [],
              })}
              {errore(`collega-${f}`)}
              {g && (
                <Box key={`guida-${f}`} flexDirection="column" gap={1} paddingLeft={2}>
                  {didascalia(`guida-${f}-testo`, g.testo)}
                  <Box flexDirection="row" flexWrap="wrap" gap={1}>
                    {g.scelte.map((s, i) => (
                      <Button key={`guida-${f}-${i}`} variant="secondary" label={`${s.etichetta} per ${NOME_FORNITORE[f]}`} onPress={() => void esegui(`collega-${f}`, s.fai, s.conferma)} />
                    ))}
                    <Button key={`guida-${f}-chiudi`} plain dimColor label={`Chiudi la procedura di ${NOME_FORNITORE[f]}`} onPress={() => void cambia(s => ({ ...s, guida: undefined }))} />
                  </Box>
                </Box>
              )}
            </Box>
          )
        }),
        didascalia('chiavi-nota', 'Le chiavi stanno nei campi segreti di /config o nell\'ambiente, mai nel config del progetto: qui se ne vede solo lo stato.'),
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
    const parole = uso === undefined ? 'nessuna misura fresca' : `uso ${uso}%${livello === 'critica' ? ', oltre la critica' : livello === 'attenzione' ? ', in attenzione' : ''}`
    return (
      <Text key={`anteprima-${f}`} size="caption">
        <Text color={LIVELLO[livello]} dimColor={livello === 'ok'}>{traccia}</Text>
        {` ${parole}${s ? ` · attenzione ${s.attenzione}% · critica ${s.critica}%` : ' · nessuna soglia'}`}
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
          chiave: `soglia-${f}`, etichetta: presetDi(s) ? 'Preset' : 'Preset (adesso una soglia personale)', modo: 'scelta', valore: presetDi(s),
          voci: SOGLIE_PRESET, onCambia: v => scrivi(SOGLIE_PRESET.find(p => p.valore === v)!.soglia),
        })}
        {s &&
          u.Gamma({
            chiave: `attenzione-${f}`, etichetta: `Attenzione da (${nome})`, valore: s.attenzione, min: 1, max: s.critica - 1, passo: 5,
            formato: v => `${v}%`, onCambia: v => scrivi({ ...s, attenzione: v }),
          })}
        {s &&
          u.Gamma({
            chiave: `critica-${f}`, etichetta: `Critica da (${nome})`, valore: s.critica, min: s.attenzione + 1, max: 100, passo: 5,
            formato: v => `${v}%`, onCambia: v => scrivi({ ...s, critica: v }),
          })}
        {anteprima(f)}
        {errore(`soglia-${f}`)}
      </Box>
    )
  }
  const soglie = () => {
    const stato = `${d.fornitoriInUso.length} fornitori con misure`
    return u.Sezione({
      chiave: 'pagina-soglie',
      titolo: 'Soglie',
      descrizione: 'Da quale uso un limite passa in attenzione e in critica. Oltre la critica il bilanciamento cerca un\'alternativa.',
      stato,
      figli: d.fornitoriInUso.length
        ? d.fornitoriInUso.map(sogliaUi)
        : [didascalia('soglie-vuote', 'Le soglie compaiono per i fornitori ammessi con una lettura o un budget manuale: collegane uno in Connessioni.')],
    })
  }

  // --- Bilanciamento ---------------------------------------------------------------------------------
  const profilo = profiloDi(r)
  const simulazione = () => {
    const esito = simula(regoleOra, capacita.limiti, d.tutte, io)
    if (esito.motivi)
      return [
        nota1('simulazione', STATO.attesa, '▲', 'Simulazione: nessuna combinazione avviabile con queste regole.'),
        ...esito.motivi.map((m, i) => didascalia(`simulazione-motivo-${i}`, `· ${m}`)),
      ]
    const a = esito.scelta!
    return [
      <Text key="simulazione" wrap="wrap">
        {`Simulazione: una nuova proposta R2 senza scelte andrebbe a ${motore(a.esecutore)} · ${nomeModello(a.modello ?? '')} · ${a.effort}`}
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
          formato: n => (n === null ? pesoScritto(p as Peso) : POSIZIONI[n]!.nome), onCambia: scrivi,
        })}
        {i < 0 && <Button key={`${dove}-normale`} plain label={`Riporta ${v.testo} a Normale`} onPress={() => scrivi(2)} />}
        {errore(dove)}
      </Box>
    )
  }
  const bilanciamento = () => {
    const stato = `Profilo ${PROFILI.find(p => p.id === profilo)!.nome}`
    return u.Sezione({
      chiave: 'pagina-bilanciamento',
      titolo: 'Bilanciamento',
      descrizione: 'Come scegliere motore ed effort quando una proposta non li indica. Una preferenza, mai un permesso: le regole d\'avvio valgono sempre.',
      stato,
      figli: [
        u.GruppoChip({
          chiave: 'profilo', etichetta: 'Profilo', modo: 'scelta', valore: profilo, voci: PROFILI.map(p => ({ valore: p.id, testo: p.nome })),
          onCambia: v => salva('profilo', () => ({ profilo: v, pesi: conProfilo(r.pesi, v as Profilo) }))(),
        }),
        <Box key="profili-descrizione" flexDirection="column">
          {PROFILI.map(p => didascalia(`profilo-${p.id}-descrizione`, `${p.nome}: ${p.descrizione}`))}
        </Box>,
        didascalia('profili-nota', 'I profili toccano solo motori ed effort; i modelli si regolano a mano.'),
        errore('profilo'),
        ...simulazione(),
        didascalia('simulazione-nota', 'Vale alla creazione di una proposta: le chip già salvate non cambiano.'),
        <Button
          key="regola-a-mano"
          plain
          label={vista.regola ? 'Chiudi le regolazioni a mano' : 'Regola a mano…'}
          onPress={() => void cambia(s => ({ ...s, regola: !s.regola }))}
        />,
        ...(vista.regola
          ? [
              u.GruppoChip({
                chiave: 'gruppo', etichetta: 'Regola', modo: 'scelta', valore: vista.gruppo ?? 'fornitore',
                voci: [{ valore: 'fornitore', testo: 'Fornitori' }, { valore: 'modello', testo: 'Modelli' }, { valore: 'effort', testo: 'Effort' }],
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
    return { config, cartella: cartellaDati(letto, io?.repo ?? null, casa) ?? 'non valida: vedi «cartella» nel config' }
  }
  const budgetScritto = (l: RisorseProgetto['limitiManuali'][number]) =>
    `${NOME_FORNITORE[l.fornitore]} · ${l.nome} · ${l.percentuale !== undefined ? `${l.percentuale}%` : `${l.valore} ${l.unita}`}`
  const aggiungiBudget = async () => {
    const nomi = ammessi.map(f => NOME_FORNITORE[f])
    const bozza: NonNullable<StatoVista['bozza']> = {}
    try {
      if (!ammessi.length) throw new Error('Nessun fornitore ammesso: abilitane uno in Connessioni')
      const f = ammessi.length === 1 ? ammessi[0] : ammessi[nomi.indexOf(await $.ui.ask('Per quale fornitore è il budget?', { options: nomi.slice(0, 4), header: 'Budget' }))]
      // Una risposta libera («Altro») che non è un fornitore: il resto si sceglie in linea.
      if (!f) throw new Error('fornitore da scegliere in linea')
      bozza.fornitore = f
      const t = await $.ui.ask(`Che budget è per ${NOME_FORNITORE[f]}?`, { options: TIPI_BUDGET.map(TIPO), header: 'Budget' })
      bozza.tipo = TIPI_BUDGET.find(x => TIPO(x) === t)
    } catch (err) {
      if (!ammessi.length) return void (await cambia(s => ({ ...s, errore: { dove: 'budget', testo: String((err as Error).message) } })))
      // Popup rifiutato: i passi mancanti si scelgono in linea.
    }
    await cambia(s => ({ ...s, bozza, errore: undefined }))
  }
  const bozzaUi = (b: NonNullable<StatoVista['bozza']>) => (
    <Box key="bozza-budget" flexDirection="column" gap={1} paddingLeft={2}>
      {u.GruppoChip({
        chiave: 'bozza-fornitore', etichetta: 'Fornitore', modo: 'scelta', valore: b.fornitore ?? '',
        voci: ammessi.map(f => ({ valore: f, testo: NOME_FORNITORE[f] })), onCambia: v => void cambia(s => ({ ...s, bozza: { ...s.bozza, fornitore: v as Fornitore } })),
      })}
      {u.GruppoChip({
        chiave: 'bozza-tipo', etichetta: 'Tipo', modo: 'scelta', valore: b.tipo ?? '',
        voci: TIPI_BUDGET.map(t => ({ valore: t, testo: TIPO(t) })), onCambia: v => void cambia(s => ({ ...s, bozza: { ...s.bozza, tipo: v } })),
      })}
      {Input && b.fornitore && b.tipo && (
        <Input
          key="bozza-valore"
          label={`Valore di ${NOME_FORNITORE[b.fornitore]} · ${b.tipo} (40%, 12 USD, 500 richieste)`}
          onSubmit={testo =>
            void esegui('budget', async () => {
              const misura = budgetDa(testo)
              if (typeof misura === 'string') throw new Error(misura)
              await configura({ limitiManuali: [...manualiDaScrivere(r.limitiManuali), nuovoBudget(b.fornitore!, b.tipo!, misura, Date.now())] })
              await cambia(s => ({ ...s, bozza: undefined }))
            })
          }
        />
      )}
      <Button key="bozza-annulla" plain dimColor label="Annulla il nuovo budget" onPress={() => void cambia(s => ({ ...s, bozza: undefined, errore: undefined }))} />
    </Box>
  )
  const progetto = async () => {
    const { config, cartella } = await percorsi()
    const stato = `${r.soloLocale ? 'Solo rete locale' : 'Fornitori abilitati'} · ${r.limitiManuali.length} ${r.limitiManuali.length === 1 ? 'budget manuale' : 'budget manuali'}`
    return u.Sezione({
      chiave: 'pagina-progetto',
      titolo: 'Progetto',
      descrizione: 'Rete, servizi esterni, cartella dei dati, termini sensibili e budget dichiarati a mano.',
      stato,
      figli: [
        u.GruppoChip({
          chiave: 'rete', etichetta: 'Rete', modo: 'scelta', valore: r.soloLocale ? 'locale' : 'abilitati',
          voci: [{ valore: 'abilitati', testo: 'Fornitori abilitati' }, { valore: 'locale', testo: 'Solo rete locale' }],
          onCambia: v => salva('rete', () => ({ soloLocale: v === 'locale' }))(),
        }),
        didascalia('rete-nota', r.soloLocale
          ? 'Bloccati: ogni inferenza esterna (anche Claude, Codex e FreeLLMAPI) e le milestone remote.'
          : 'Ammessi i fornitori scelti in Connessioni. FreeLLMAPI inoltra a fornitori esterni.'),
        errore('rete'),
        u.Chip({
          chiave: 'milestone-github', testo: 'Leggi le milestone GitHub', attiva: r.milestoneGithub,
          onPress: salva('milestone', () => ({ milestoneGithub: !r.milestoneGithub })),
        }),
        errore('milestone'),
        <Box key="cartella" flexDirection="column">
          {didascalia('cartella-titolo', 'Cartella dei dati')}
          <Text wrap="truncate-middle">{cartella}</Text>
        </Box>,
        <Box key="sensibili" flexDirection="column">
          {didascalia('sensibili-titolo', `Termini sensibili in più (da ${config})`)}
          {regoleOra.sensibili.length ? (
            <Box flexDirection="row" flexWrap="wrap" gap={1}>
              {regoleOra.sensibili.map((t, i) => u.Chip({ chiave: `sensibile-${i}`, testo: t, segno: '▲', colore: STATO.attesa }))}
            </Box>
          ) : (
            <Text>Nessuno: valgono quelli generici.</Text>
          )}
        </Box>,
        <Box key="budget" flexDirection="column" gap={1}>
          {didascalia('budget-titolo', 'Budget manuali: dichiarazioni, non cambiano i dati misurati')}
          <Box flexDirection="row" flexWrap="wrap" gap={1}>
            {r.limitiManuali.map(l =>
              u.Chip({
                chiave: `budget-${l.id}`, testo: budgetScritto(l), segno: '•',
                onRimuovi: salva('budget', () => ({ limitiManuali: manualiDaScrivere(r.limitiManuali.filter(x => x.id !== l.id)) })),
              }),
            )}
            {!vista.bozza && <Button key="aggiungi-budget" variant="secondary" label="Aggiungi budget…" onPress={() => void aggiungiBudget()} />}
          </Box>
          {vista.bozza && bozzaUi(vista.bozza)}
          {errore('budget')}
        </Box>,
      ],
    })
  }

  // --- Board -------------------------------------------------------------------------------------------
  const MODI: { valore: RisorseProgetto['board']['modo']; testo: string }[] = [
    { valore: 'spenta', testo: 'Spenta' },
    { valore: 'accesa', testo: 'Accesa' },
    { valore: 'riassunti', testo: 'Con riassunti' },
  ]
  const board = () => {
    const stato = MODI.find(m => m.valore === r.board.modo)!.testo
    return u.Sezione({
      chiave: 'pagina-board',
      titolo: 'Board',
      descrizione: 'Una pagina HTML locale con lo stato delle chip, nella cartella dei dati. Mai pubblicata.',
      stato,
      figli: [
        u.GruppoChip({
          chiave: 'board', etichetta: 'Board di progetto', modo: 'scelta', valore: r.board.modo, voci: MODI,
          onCambia: v => void esegui('board', () => c.board(v as RisorseProgetto['board']['modo'], r)),
        }),
        didascalia('board-nota', r.board.modo === 'riassunti'
          ? `Costo stimato: circa 700 token in ingresso e 120 in uscita con Haiku per chip cambiata, al più 100 al giorno${r.soloLocale || !r.fornitori.includes('claude') ? '. Fermi: servono Claude abilitato e rete non solo locale' : ''}${sb.riassunti ? `. ${sb.riassunti}` : ''}.`
          : r.board.modo === 'accesa'
            ? 'Costo: nessun modello, solo un file HTML scritto a ogni cambiamento.'
            : 'I riassunti sono facoltativi e mandano a Claude solo titolo e mandato delle chip.'),
        sb.percorso ? (
          <Text key="board-percorso" size="caption" wrap="truncate-middle">{`File: ${sb.percorso}`}</Text>
        ) : null,
        r.board.modo !== 'spenta' && sb.motivo ? nota1('board-motivo', STATO.attesa, '!', `Board non scritta: ${sb.motivo}`) : null,
        errore('board'),
      ],
    })
  }

  // --- Avanzate ----------------------------------------------------------------------------------------
  const LIVELLI = [
    { valore: 'niente', testo: 'Niente' },
    { valore: 'R1', testo: 'Solo R0–R1' },
    { valore: 'R2', testo: 'Anche R2' },
  ]
  const avanzate = () => {
    const stato = `FreeLLMAPI: ${LIVELLI.find(l => l.valore === r.freellmapi.livello)!.testo}`
    return u.Sezione({
      chiave: 'pagina-avanzate',
      titolo: 'Avanzate',
      descrizione: 'FreeLLMAPI: un proxy locale verso modelli gratuiti, per compiti testuali delle corsie basse.',
      stato,
      figli: [
        u.GruppoChip({
          chiave: 'free-livello', etichetta: 'Compiti FreeLLMAPI', modo: 'scelta', valore: r.freellmapi.livello, voci: LIVELLI,
          onCambia: v => salva('free-livello', () => ({ freellmapi: { ...r.freellmapi, livello: v } }))(),
        }),
        errore('free-livello'),
        Input ? (
          <Input
            key="free-endpoint"
            label="Endpoint FreeLLMAPI (loopback)"
            value={r.freellmapi.endpoint}
            onSubmit={v =>
              salva('free-endpoint', () => {
                if (!endpointLocale(v.trim())) throw new Error('Endpoint solo su questo computer: http://localhost:<porta>/v1, 127.0.0.1 o [::1]')
                return { freellmapi: { ...r.freellmapi, endpoint: v.trim() } }
              })()
            }
          />
        ) : null,
        errore('free-endpoint'),
        didascalia('installa-nota', 'Installa con Docker già disponibile; poi configura i fornitori e copia la chiave unificata dal dashboard http://localhost:3001.'),
        ...INSTALLAZIONE.map((cmd, i) => (
          <Box key={`installazione-${i}`} flexDirection="column">
            <Text size="caption" wrap="wrap">{cmd.join(' ')}</Text>
            <Button key={`installa-${i}`} variant="secondary" label={i === 0 ? 'Prepara immagine Docker…' : 'Avvia container…'} onPress={() => void esegui('installa', () => c.installa(i), '')} />
          </Box>
        )),
        errore('installa'),
      ],
    })
  }

  const corpo =
    vista.sezione === 'soglie' ? soglie()
      : vista.sezione === 'bilanciamento' ? bilanciamento()
        : vista.sezione === 'progetto' ? await progetto()
          : vista.sezione === 'board' ? board()
            : vista.sezione === 'avanzate' ? avanzate()
              : connessioni()

  return (
    <Box key="configurazione" flexDirection="column" gap={1}>
      {u.GruppoChip({
        chiave: 'sezione', etichetta: 'Sezione', modo: 'scelta', valore: vista.sezione, voci: SEZIONI,
        onCambia: v => void cambia(s => ({ ...s, sezione: v as Sezione, errore: undefined })),
      })}
      {corpo}
    </Box>
  )
}
