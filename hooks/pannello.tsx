// Il disegno del pannello. Regole (design-taste app-screens + ui-ux-pro-max):
// - un solo primario nel pannello («Avvia tutte»); sulle schede azioni secondarie e testuali;
// - schede neutre: il colore sta sui dati (stato, motore, modello, effort), il bordo si accende
//   solo sulla scheda che aspetta una decisione (ferma o fallita);
// - il colore MARCA (segni, velo, bordi), le parole restano nell'inchiostro del tema: contrasto pieno
//   sul chiaro e sullo scuro; il colore non è mai l'unico segnale (segno + parola, effort anche ▰▰▱▱);
// - niente maiuscolo spaziato, niente emoji: titoli di sezione in frase, piccoli, grigi.
import { atom, read, update } from 'claude-code'
import type { ElementTable, EngineInterface, RenderSurface } from 'claude-code'

import type { Azione, Chiamante, Contesto, Corsia, Destinazione, Fornitore, Limite, Motore, Permessi, Peso, Regole, Revisore, Risorse, RisorseProgetto, SessioneProgetto, Sessioni, Soglia, Traguardi, Traguardo, Vista, Vita } from '../types'
import {
  attive,
  barreEffort,
  BASE_RE,
  blocca,
  COLORE_EFFORT,
  COLORE_MODELLO,
  COLORE_MOTORE,
  COLORE_STATO,
  corrisponde,
  coloreLimite,
  COLORE_LIVELLO,
  FORNITORI,
  limiteFresco,
  livelloDi,
  piuPieno,
  sogliaDi,
  CORSIE,
  corsiaDi,
  cartellaCondivisa,
  dipendenze,
  durata,
  effortDi,
  effortPer,
  FASI,
  modelloDi,
  nomeModello,
  percentuale,
  PERMESSI,
  RAMO_RE,
  REGOLE_DEFAULT,
  sensibile,
  stimaArrivo,
  taskAccertato,
  velo,
  violazioniAvvio,
} from './logica'
import { INSTALLAZIONE, RISORSE_VUOTE } from './risorse'

// Copia identica degli atomi di register.tsx (lo scanner li vuole nel file che li usa).
const azioni = atom({ plugin: 'chip-manager', key: 'azioni' } as const, [] as Azione[], { shape: 'azioni-4' })
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
const sessioni = atom({ plugin: 'chip-manager', key: 'sessioni' } as const, { lista: [] } as Sessioni, { shape: 'sessioni-1' })
const vista = atom({ plugin: 'chip-manager', key: 'vista' } as const, 'lavoro' as Vista)
const tutteSessioni = atom({ plugin: 'chip-manager', key: 'tutteSessioni' } as const, false)

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
}

const MOTORI = ['claude', 'codex', 'freellmapi'] as const
const REVISORI = ['claude', 'codex', 'nessuno'] as const
const motore = (m: Motore | 'nessuno') => (m === 'claude' ? 'Claude' : m === 'codex' ? 'Codex' : m === 'freellmapi' ? 'FreeLLMAPI' : 'Nessuno')
const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']
const due = (n: number) => String(n).padStart(2, '0')
const oraDi = (iso: string) => {
  const d = new Date(iso)
  return `${due(d.getHours())}:${due(d.getMinutes())}`
}
const giornoDi = (d: Date) => `${d.getDate()} ${MESI[d.getMonth()]} ${d.getFullYear()}`
const corto = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

export async function disegna($: Eng, el: ElementTable, surface: RenderSurface, c: Ctx, colonne = 100) {
  const { Box, Text, Button } = el
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
  const stati = await read($, vive)
  const nota = await read($, avviso)
  const scartata = await read($, annullabile)
  const rotte = await read($, illeggibili)
  const tr = await read($, traguardi)
  const adesso = Date.now()
  const capacita = await read($, risorse)
  const configura = (campi: Record<string, unknown>) => c.configura(campi, regoleOra.risorse)

  const fai = (fn: () => Promise<unknown>) => () => void c.fai(fn)
  const modifica = (a: Azione, campi: Partial<Azione>) => fai(() => c.salva({ ...a, ...campi }))
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
  const aspettaTe = (a: Azione) => ferma(a) || a.stato === 'fallita' || tentativoAnnullabile(a)
  const attese = conta(aspettaTe)

  const scelta = (
    a: Azione,
    chiave: string,
    nome: string,
    valore: string,
    voci: readonly { value: string; label: string }[],
    applica: (v: string) => Partial<Azione>,
  ) =>
    Select && (
      <Select key={`${chiave}-${a.id}`} label={nome} value={valore} options={voci} onSelect={v => void modifica(a, applica(v))()} />
    )

  const gruppo = (k: string, nome: string, figli: unknown[]) => (
    <Box key={k} flexDirection="column" gap={1}>
      <Text size="caption" weight="medium" dimColor>
        {nome}
      </Text>
      {figli as never}
    </Box>
  )

  const editor = (a: Azione) => {
    const modello = modelloDi(a, regoleOra)
    return (
      <Box
        flexDirection="column"
        gap={1}
        marginTop={1}
        padding={1}
        backgroundColor={conVelo ? velo('#808080', '14') : undefined}
        borderStyle={conVelo ? undefined : 'single'}
        borderDimColor
      >
        {gruppo(`g-mot-${a.id}`, 'Chi lavora', [
          scelta(a, 'esec', 'Esecutore', a.esecutore, MOTORI.filter(m => regoleOra.risorse.fornitori.includes(m)).map(m => ({ value: m, label: motore(m) })), v => ({
            esecutore: v as Motore,
            modello: undefined,
            effort: undefined,
          })),
          scelta(a, 'mod', 'Modello', modello, regoleOra.modelli[a.esecutore].map(m => ({ value: m, label: nomeModello(m) })), v => ({
            modello: v,
          })),
          scelta(
            a,
            'eff',
            'Effort',
            effortDi(a, regoleOra),
            effortPer(regoleOra, modello).map(m => ({ value: m, label: `${barreEffort(m)}  ${m}` })),
            v => ({ effort: v }),
          ),
          scelta(a, 'rev', 'Revisore', a.revisore, REVISORI.map(m => ({ value: m, label: motore(m) })), v => ({
            revisore: v as Revisore,
          })),
          scelta(
            a,
            'cor',
            'Corsia',
            corsiaDi(a, regoleOra) ?? 'nessuna',
            [{ value: 'nessuna', label: 'Non indicata' }, ...CORSIE.map(k => ({ value: k, label: k }))].filter(
              // Su un'azione sensibile le corsie sotto R4 non si possono scegliere: non spariscono le regole.
              o => !sensibile({ ...a, corsia: undefined }, regoleOra) || o.value === 'R4' || o.value === 'R5',
            ),
            v => ({ corsia: v === 'nessuna' ? undefined : (v as Corsia) }),
          ),
        ])}
        {gruppo(`g-ses-${a.id}`, 'Come parte la sessione', [
          scelta(
            a,
            'dest',
            'Dove',
            a.destinazione ?? 'local',
            [{ value: 'local', label: 'Su questo computer' }, ...(sensibile(a, regoleOra) ? [] : [{ value: 'cloud', label: 'Nel cloud (solo sessione nuova)' }])],
            v => ({ destinazione: v as Destinazione, contesto: v === 'cloud' ? 'fresh' : a.contesto }),
          ),
          scelta(
            a,
            'ctx',
            'Contesto',
            a.contesto ?? 'fresh',
            [
              { value: 'fresh', label: 'Sessione nuova, solo il mandato' },
              ...(a.destinazione === 'cloud' ? [] : [{ value: 'fork', label: 'Fork di questa conversazione' }]),
            ],
            v => ({
              contesto: v as Contesto,
              origineFork: v === 'fork' ? io?.io : undefined,
              origineNome: v === 'fork' ? io?.titolo : undefined,
            }),
          ),
          a.destinazione !== 'cloud' &&
            a.contesto !== 'fork' &&
            scelta(
              a,
              'wt',
              'Cartella',
              a.worktree === false ? 'no' : 'si',
              [
                { value: 'si', label: 'Worktree proprio' },
                { value: 'no', label: 'Cartella condivisa' },
              ],
              v => ({ worktree: v === 'si' }),
            ),
          a.destinazione !== 'cloud' &&
            scelta(
              a,
              'perm',
              'Permessi',
              a.permessi ?? 'eredita',
              PERMESSI.filter(p => !sensibile(a, regoleOra) || p.value !== 'bypassPermissions').map(p =>
                p.value === 'eredita' && sensibile(a, regoleOra) ? { value: 'eredita', label: 'Accetta modifiche (predefinito sulle sensibili)' } : p,
              ),
              v => ({ permessi: v === 'eredita' ? undefined : (v as Permessi) }),
            ),
          a.destinazione !== 'cloud' &&
            scelta(
              a,
              'sv',
              'Risveglio',
              a.sveglia ? 'si' : 'no',
              [
                { value: 'no', label: 'Predefinito: l\'app mi risveglia a fine turno' },
                { value: 'si', label: 'Anche se il mandato non arriva alla sessione' },
              ],
              v => ({ sveglia: v === 'si' }),
            ),
        ])}
        {Input &&
          gruppo(`g-txt-${a.id}`, 'Ramo e testi', [
            a.destinazione !== 'cloud' && a.contesto !== 'fork' && a.worktree !== false && (
              <Input
                key={`ramo-${a.id}`}
                label="Ramo"
                placeholder="nome breve, es. fix-ricerca"
                value={a.ramo ?? ''}
                submitLabel="salva"
                onSubmit={v => {
                  const t = v.trim()
                  if (t && !RAMO_RE.test(t)) return void update($, avviso, () => 'Ramo: solo minuscole, cifre e trattini, fino a 40')
                  void modifica(a, { ramo: t || undefined })()
                }}
              />
            ),
            a.destinazione !== 'cloud' && a.contesto !== 'fork' && a.worktree !== false && (
              <Input
                key={`base-${a.id}`}
                label="Parte da"
                placeholder="vuoto: il ramo base della sessione che avvia"
                value={a.base ?? ''}
                submitLabel="salva"
                onSubmit={v => {
                  const t = v.trim()
                  if (t && !BASE_RE.test(t)) return void update($, avviso, () => 'Ramo di partenza non valido')
                  void modifica(a, { base: t || undefined })()
                }}
              />
            ),
            <Input
              key={`tit-${a.id}`}
              label="Titolo"
              value={a.titolo}
              submitLabel="salva"
              onSubmit={v => void (v.trim() ? modifica(a, { titolo: v.trim().slice(0, 200) })() : undefined)}
            />,
            <Input
              key={`brief-${a.id}`}
              label="Mandato"
              rows={8}
              value={a.brief}
              submitLabel="salva"
              onSubmit={v => void (v.trim() ? modifica(a, { brief: v })() : undefined)}
            />,
          ])}
      </Box>
    )
  }

  const opzioni = (a: Azione) =>
    [
      corsiaDi(a, regoleOra) ? `corsia ${corsiaDi(a, regoleOra)}` : undefined,
      a.destinazione === 'cloud' ? 'cloud' : 'locale',
      a.destinazione === 'cloud' ? undefined : a.contesto === 'fork' ? 'fork' : 'sessione nuova',
      a.destinazione === 'cloud' || a.contesto === 'fork'
        ? undefined
        : a.worktree === false
          ? 'cartella condivisa'
          : `worktree${a.ramo ? ` ${a.ramo}` : ''}${a.base ? ` da ${a.base}` : ''}`,
      a.destinazione === 'cloud'
        ? undefined
        : (a.permessi ? PERMESSI.find(p => p.value === a.permessi)?.label : sensibile(a, regoleOra) ? 'Accetta modifiche' : 'Come questa sessione')?.toLowerCase(),
      a.sveglia ? 'mi risveglia' : undefined,
    ]
      .filter(Boolean)
      .join(' · ')

  /** Le fasi del registro dell'orchestratore, con la corrente in evidenza (segno colorato, parola in inchiostro). */
  const pipeline = (a: Azione, fase: string | undefined) => {
    const i = fase ? (FASI as readonly string[]).indexOf(fase) : -1
    if (i < 0)
      return (
        <Text size="caption" dimColor>
          {cartellaCondivisa(a)
            ? 'Cartella condivisa: il registro non si collega da solo. Quando è fusa, chiudila tu con «Segna completata»'
            : !a.issue
              ? 'Senza issue il registro non si collega: quando è fusa, chiudila tu con «Segna completata»'
              : a.taskId && !taskAccertato(a, tutte)
                ? 'Collegamento al registro non dimostrabile (task condiviso con un\'altra azione): chiudila tu quando è fusa'
                : `Il registro dell'orchestratore non ha ancora un task di questo ramo per #${a.issue}`}
        </Text>
      )
    return (
      <Text size="caption">
        {FASI.slice(1).map((f, k) => {
          const pos = k + 1
          const qui = i === pos
          return (
            <Text key={`f-${a.id}-${f}`}>
              {k ? <Text dimColor>{'  ›  '}</Text> : ''}
              {qui ? <Text color={COLORE_STATO.inCorso}>{'● '}</Text> : ''}
              <Text dimColor={!qui} bold={qui}>{`${i > pos ? '✓ ' : ''}${f}`}</Text>
            </Text>
          )
        })}
      </Text>
    )
  }

  const milestoneDi = (a: Azione) => {
    const n = a.issue && tr ? tr.milestoneDi[String(a.issue)] : undefined
    return n ? tr?.lista.find(t => t.numero === n) : undefined
  }

  const scheda = (a: Azione) => {
    const s = statoDi(a)
    const modificabile = ['proposta', 'accodata', 'fallita'].includes(a.stato)
    const aperto = espansa === a.id && modificabile
    const dip = dipendenze(a, tutte)
    const allerta = ferma(a) || a.stato === 'fallita'
    const modello = modelloDi(a, regoleOra)
    const effort = effortDi(a, regoleOra)
    const vita = stati[a.id]
    const blocchi = modificabile ? violazioniAvvio(a, regoleOra, tutte, io) : []
    const bloccatoQui = a.stato === 'proposta' ? violazioniAvvio(a, regoleOra, tutte, io, true) : []
    const sblocca = blocca(a, tutte)
    const ms = milestoneDi(a)
    const mia = !!io && a.lanciataDa === io.io
    return (
      <Box
        key={`riga-${a.id}`}
        flexDirection="column"
        gap={1}
        borderStyle="round"
        borderColor={allerta ? s.colore : undefined}
        borderDimColor={!allerta}
        paddingX={1}
        paddingY={conVelo ? 1 : 0}
      >
        <Box flexDirection="row" gap={1} justifyContent="space-between" alignItems="flex-start">
          <Button key={`apri-${a.id}`} plain label={`${aperto ? 'Chiudi' : 'Apri'} i dettagli di ${a.titolo}`} onPress={apriChiudi(a.id)}>
            <Text dimColor tabular>{`${lista.indexOf(a) + 1}  `}</Text>
            <Text weight="semibold" bold>
              {a.titolo}
            </Text>
          </Button>
          {a.issue ? <Text dimColor tabular>{`#${a.issue}`}</Text> : null}
        </Box>
        <Box flexDirection="row" gap={1} flexWrap="wrap">
          {etichetta(`et-st-${a.id}`, s.colore, s.parola)}
          {sensibile(a, regoleOra) && etichetta(`et-r4-${a.id}`, COLORE_STATO.sensibile, `${corsiaDi(a, regoleOra) ?? 'R4'} sensibile`, '▲')}
          {etichetta(`et-mot-${a.id}`, COLORE_MOTORE[a.esecutore] ?? '#0D9488', motore(a.esecutore), '◆')}
          {etichetta(`et-mod-${a.id}`, COLORE_MODELLO[modello] ?? '#808080', nomeModello(modello))}
          {etichetta(`et-eff-${a.id}`, COLORE_EFFORT[effort] ?? '#808080', effort, barreEffort(effort))}
          {etichetta(
            `et-rev-${a.id}`,
            COLORE_MOTORE[a.revisore]!,
            a.revisore === 'nessuno' ? 'senza revisione' : `rivede ${motore(a.revisore)}`,
            '↺',
          )}
          {ms && etichetta(`et-ms-${a.id}`, COLORE_STATO.proposta, corto(ms.titolo, 28), '◎')}
        </Box>
        <Text dimColor size="caption">
          {opzioni(a)}
        </Text>
        {a.dipende.length > 0 &&
          nota1(
            `dip-${a.id}`,
            dip.chiuse ? COLORE_STATO.inCorso : COLORE_STATO.accodata,
            dip.chiuse ? '✓' : '◔',
            `${dip.chiuse ? 'Dipendenze fuse' : 'Aspetta che siano fuse'}: ${a.dipende.map(d => tutte.find(x => x.id === d)?.titolo ?? d).join(', ')}`,
          )}
        {sblocca > 0 && (
          <Text size="caption" dimColor>
            {`Sblocca ${sblocca} ${sblocca === 1 ? 'azione' : 'azioni'}`}
          </Text>
        )}
        {a.stato === 'accodata' && a.motivoCoda && nota1(`coda-${a.id}`, COLORE_STATO.accodata, '◔', `In coda: ${a.motivoCoda}`)}
        {a.contesto === 'fork' && a.origineFork && (
          <Text size="caption" dimColor>
            {a.origineFork === io?.io
              ? 'Fork di questa conversazione'
              : `Fork della conversazione di «${a.origineNome ?? `${a.origineFork.slice(0, 8)}…`}»: riparte solo da quella sessione`}
          </Text>
        )}
        {blocchi.length > 0 && (
          <Box flexDirection="column" backgroundColor={conVelo ? velo(COLORE_STATO.fallita, '1F') : undefined} paddingX={1}>
            {nota1(`bt-${a.id}`, COLORE_STATO.fallita, '▲', 'Così non può partire')}
            {blocchi.map((b, i) => (
              <Text key={`bl-${a.id}-${i}`} size="caption">{`· ${b}`}</Text>
            ))}
          </Box>
        )}
        {(a.stato === 'avviata' || a.stato === 'consegnata') && pipeline(a, vita?.fase)}
        {(a.stato === 'avviata' || a.stato === 'consegnata') && (
          <Text size="caption" dimColor tabular>
            {[
              a.avviataIl ? `da ${durata(adesso - Date.parse(a.avviataIl))}` : undefined,
              vita?.ultimaAttivita ? `ultima attività ${durata(adesso - Date.parse(vita.ultimaAttivita))} fa` : undefined,
              vita?.ramo,
              a.sessione && !mia ? 'aprila dalla barra laterale' : undefined,
            ]
              .filter(Boolean)
              .join(' · ') || ' '}
          </Text>
        )}
        {a.errore && nota1(`err-${a.id}`, COLORE_STATO.ferma, '!', a.errore)}
        {a.risultato && <Box flexDirection="column" borderStyle="single" paddingX={1}><Text weight="semibold">Bozza FreeLLMAPI da rivedere</Text><Text>{a.risultato}</Text></Box>}
        <Box flexDirection="row" gap={1} flexWrap="wrap" justifyContent="space-between" alignItems="center">
          <Box flexDirection="row" gap={1} flexWrap="wrap">
            {a.stato === 'proposta' && blocchi.length === 0 && (
              <Button key={`avvia-${a.id}`} variant="secondary" label={dip.chiuse ? 'Avvia' : 'Accoda'} onPress={fai(() => c.avvia(a))} />
            )}
            {a.stato === 'proposta' && dip.chiuse && bloccatoQui.length === 0 && (
              <Button key={`qui-${a.id}`} plain label="Fallo qui" onPress={fai(() => c.faiQui(a))} />
            )}
            {a.stato === 'fallita' && blocchi.length === 0 && (
              <Button key={`riprova-${a.id}`} variant="secondary" label="Riprova" onPress={fai(() => c.avvia(a))} />
            )}
            {a.stato === 'fallita' && blocchi.length === 0 && io?.lanciatore !== 'cli' && a.esecutore !== 'freellmapi' && (
              <Button key={`chiedi-${a.id}`} plain label="Chiedi a questa sessione" onPress={fai(() => c.chiediQui(a))} />
            )}
            {tentativoAnnullabile(a) && (
              <Button key={`annullaT-${a.id}`} plain label="Annulla il tentativo" onPress={fai(() => c.annullaTentativo(a))} />
            )}
            {a.stato === 'accodata' && (
              <Button
                key={`annulla-${a.id}`}
                variant="secondary"
                label="Togli dalla coda"
                onPress={modifica(a, { stato: 'proposta', motivoCoda: undefined })}
              />
            )}
            {(a.stato === 'avviata' || a.stato === 'consegnata') && a.sessione && mia && (
              <Button key={`vedi-${a.id}`} variant="secondary" label="Apri" onPress={fai(() => c.apri(a.sessione!))} />
            )}
            {(a.stato === 'avviata' || a.stato === 'consegnata') && (
              <Button key={`fatta-${a.id}`} plain label="Segna completata" onPress={modifica(a, { stato: 'completata' })} />
            )}
            {modificabile && <Button key={`mod-${a.id}`} plain label={aperto ? 'Chiudi' : 'Modifica'} onPress={apriChiudi(a.id)} />}
          </Box>
          {modificabile && (
            <Box flexDirection="row" gap={1}>
              <Button key={`su-${a.id}`} plain dimColor label={`Sposta prima: ${a.titolo}`} onPress={fai(() => c.riordina(a.id, -1))}>
                ↑
              </Button>
              <Button key={`giu-${a.id}`} plain dimColor label={`Sposta dopo: ${a.titolo}`} onPress={fai(() => c.riordina(a.id, 1))}>
                ↓
              </Button>
              <Button key={`scarta-${a.id}`} plain dimColor label="Scarta" onPress={fai(() => c.scarta(a))} />
            </Box>
          )}
        </Box>
        {aperto && editor(a)}
      </Box>
    )
  }

  // --- vista Lavoro ------------------------------------------------------------------------------------
  // Righe compatte; «Dettagli» apre al loro posto la scheda completa (con l'editor, se si può modificare).

  const titoloSezione = (k: string, testo: string, n?: number) => (
    <Text key={k} size="caption" weight="medium" dimColor>
      {n === undefined ? testo : `${testo}  ${n}`}
    </Text>
  )
  // Stessa chiave del «Modifica» della scheda: lo stesso controllo, chiusa o aperta.
  const dettagli = (a: Azione) => <Button key={`mod-${a.id}`} plain label="Dettagli" onPress={apriChiudi(a.id)} />
  const chiLavora = (a: Azione) =>
    [motore(a.esecutore), nomeModello(modelloDi(a, regoleOra)), effortDi(a, regoleOra), a.revisore === 'nessuno' ? 'senza revisione' : `rivede ${motore(a.revisore)}`].join(' · ')

  /** Una chip che aspetta una decisione: il bordo acceso solo qui, l'azione che la sblocca sulla riga. */
  const rigaAttesa = (a: Azione) => {
    if (espansa === a.id) return scheda(a)
    const s = statoDi(a)
    const blocchi = a.stato === 'fallita' ? violazioniAvvio(a, regoleOra, tutte, io) : []
    const mia = !!io && a.lanciataDa === io.io
    return (
      <Box key={`riga-${a.id}`} flexDirection="column" borderStyle={conVelo ? 'round' : undefined} borderColor={s.colore} paddingX={conVelo ? 1 : 0}>
        <Box flexDirection="row" justifyContent="space-between" alignItems="center" gap={1}>
          <Text wrap="truncate-end">
            <Text color={s.colore}>{'▲ '}</Text>
            <Text weight="semibold">{a.titolo}</Text>
            {`: ${a.stato === 'fallita' ? `avvio fallito${a.errore ? ` (${corto(a.errore, 60)})` : ''}` : a.stato === 'in-avvio' ? s.parola.toLowerCase() : 'ferma, aspetta te'}`}
          </Text>
          <Box flexDirection="row" gap={1}>
            {a.stato === 'fallita' && blocchi.length === 0 && <Button key={`riprova-${a.id}`} variant="secondary" label="Riprova" onPress={fai(() => c.avvia(a))} />}
            {a.stato === 'fallita' && blocchi.length === 0 && io?.lanciatore !== 'cli' && a.esecutore !== 'freellmapi' && (
              <Button key={`chiedi-${a.id}`} plain label="Chiedi a questa sessione" onPress={fai(() => c.chiediQui(a))} />
            )}
            {tentativoAnnullabile(a) && <Button key={`annullaT-${a.id}`} plain label="Annulla il tentativo" onPress={fai(() => c.annullaTentativo(a))} />}
            {ferma(a) && a.sessione && mia && <Button key={`vedi-${a.id}`} variant="secondary" label="Apri" onPress={fai(() => c.apri(a.sessione!))} />}
            {dettagli(a)}
          </Box>
        </Box>
        <Text size="caption" dimColor>{chiLavora(a)}</Text>
      </Box>
    )
  }

  /** Da avviare e in coda: numero d'ordine, titolo e dipendenza; chi lavora sulla seconda riga, grigia. */
  const rigaCoda = (a: Azione) => {
    if (espansa === a.id) return scheda(a)
    const dip = dipendenze(a, tutte)
    const blocchi = violazioniAvvio(a, regoleOra, tutte, io)
    const prima = a.dipende.map(d => tutte.find(x => x.id === d)?.titolo ?? d)
    const avvisi = [
      sensibile(a, regoleOra) ? `${corsiaDi(a, regoleOra) ?? 'R4'} sensibile` : undefined,
      blocchi.length ? 'così non può partire' : undefined,
      a.stato === 'accodata' && a.motivoCoda ? `in coda: ${a.motivoCoda}` : undefined,
    ].filter(Boolean)
    return (
      <Box key={`riga-${a.id}`} flexDirection="column">
        <Box flexDirection="row" justifyContent="space-between" alignItems="center" gap={1}>
          <Text wrap="truncate-end">
            <Text dimColor tabular>{`${lista.indexOf(a) + 1}  `}</Text>
            <Text weight="semibold">{a.titolo}</Text>
            {prima.length > 0 && <Text dimColor>{` · dopo «${corto(prima.join('», «'), 40)}»`}</Text>}
          </Text>
          <Box flexDirection="row" gap={1}>
            {a.stato === 'proposta' && blocchi.length === 0 && (
              <Button key={`avvia-${a.id}`} variant="secondary" label={dip.chiuse ? 'Avvia' : 'Accoda'} onPress={fai(() => c.avvia(a))} />
            )}
            {a.stato === 'accodata' && (
              <Button key={`annulla-${a.id}`} plain label="Togli dalla coda" onPress={modifica(a, { stato: 'proposta', motivoCoda: undefined })} />
            )}
            {dettagli(a)}
          </Box>
        </Box>
        <Text size="caption" dimColor>
          {chiLavora(a)}
          {avvisi.length > 0 && <Text color={COLORE_STATO.fallita}>{'  ▲ '}</Text>}
          {avvisi.join(' · ')}
        </Text>
      </Box>
    )
  }

  /** Consegnate: aspettano la fusione. */
  const rigaFondere = (a: Azione) => {
    if (espansa === a.id) return scheda(a)
    const mia = !!io && a.lanciataDa === io.io
    return (
      <Box key={`riga-${a.id}`} flexDirection="row" justifyContent="space-between" alignItems="center" gap={1}>
        <Text wrap="truncate-end">
          <Text color={COLORE_STATO.consegnata}>{'✓ '}</Text>
          <Text weight="semibold">{a.titolo}</Text>
          <Text dimColor>{stati[a.id]?.ramo ? ` · ${stati[a.id]!.ramo}` : ''}</Text>
        </Text>
        <Box flexDirection="row" gap={1}>
          {a.sessione && mia && <Button key={`vedi-${a.id}`} variant="secondary" label="Apri" onPress={fai(() => c.apri(a.sessione!))} />}
          <Button key={`fatta-${a.id}`} plain label="Segna completata" onPress={modifica(a, { stato: 'completata' })} />
          {dettagli(a)}
        </Box>
      </Box>
    )
  }

  // «Al lavoro adesso»: le sessioni del progetto (anche aperte a mano) più le chip avviate di cui l'app non dà la sessione.
  type Riga = SessioneProgetto & { azione?: Azione; parola: string; segno: string; colore: string }
  const avviate = lista.filter(a => a.stato === 'avviata' || a.stato === 'in-avvio')
  const righe: Riga[] = ses.lista.map(s => {
    const a = avviate.find(x => (s.motore === 'claude' && x.sessione === s.id) || (s.motore === 'codex' && x.esecutore === 'codex' && !!s.ramo && stati[x.id]?.ramo === s.ramo))
    const fermaOra = a ? ferma(a) : s.stato === 'ferma'
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
  const mostrate = tutteLeSessioni ? righe : righe.slice(0, 6)

  const quando = (iso?: string) => {
    if (!iso) return '—'
    const ms = adesso - Date.parse(iso)
    return ms < 60_000 ? 'adesso' : durata(ms)
  }
  // Larghezze in percentuale: stesse colonne sul desktop e sul terminale; strette, ne cadono due.
  const COL: { lavoro: string; chi: string; modello: string; stato: string; effort?: string; contesto?: string; attivita?: string } = stretto
    ? { lavoro: '40%', chi: '18%', modello: '24%', stato: '18%' }
    : { lavoro: '30%', chi: '11%', modello: '14%', effort: '16%', stato: '11%', contesto: '9%', attivita: '9%' }
  const cella = (k: string, w: string, figli: unknown, destra = false) => (
    <Box key={k} width={w} flexDirection="column" alignItems={destra ? 'flex-end' : 'flex-start'} paddingRight={1}>
      {figli as never}
    </Box>
  )
  const intestazione = (
    <Box key="tab-testa" flexDirection="row">
      {cella('h-lav', COL.lavoro, <Text size="caption" dimColor>Lavoro</Text>)}
      {cella('h-chi', COL.chi, <Text size="caption" dimColor>Chi</Text>)}
      {cella('h-mod', COL.modello, <Text size="caption" dimColor>{stretto ? 'Modello · effort' : 'Modello'}</Text>)}
      {COL.effort && cella('h-eff', COL.effort, <Text size="caption" dimColor>Effort</Text>)}
      {cella('h-st', COL.stato, <Text size="caption" dimColor>Stato</Text>)}
      {COL.contesto && cella('h-ctx', COL.contesto, <Text size="caption" dimColor>Contesto</Text>, true)}
      {COL.attivita && cella('h-att', COL.attivita, <Text size="caption" dimColor>Attività</Text>, true)}
    </Box>
  )
  const rigaSessione = (r: Riga) => {
    const seconda = [r.ramo, r.qui ? 'questa sessione' : r.azione ? undefined : 'aperta a mano'].filter(Boolean).join(' · ')
    const titolo = <Text weight="semibold" wrap="truncate-end">{r.titolo}</Text>
    const apribile = r.motore === 'claude' && !r.qui && !r.id.startsWith('chip-')
    // Solo chi ha chiesto l'avvio apre la sessione di una chip (l'app la affianca a questa).
    const sessioneChip = r.azione?.sessione && io && r.azione.lanciataDa === io.io ? r.azione.sessione : undefined
    return [
      <Box key={`ses-${r.id}`} flexDirection="row">
        {cella(`c-lav-${r.id}`, COL.lavoro, [
          // Il titolo apre la sessione quando si può; una chip tiene «Dettagli» sulla seconda riga.
          sessioneChip
            ? <Button key={`vedi-${r.azione!.id}`} plain label={`Apri la sessione di ${r.titolo}`} onPress={fai(() => c.apri(sessioneChip))}>{titolo}</Button>
            : apribile
              ? <Button key={`apri-ses-${r.id}`} plain label={`Apri la sessione ${r.titolo}`} onPress={fai(() => c.apri(r.id))}>{titolo}</Button>
              : r.azione
                ? <Button key={`apri-${r.azione.id}`} plain label={`Dettagli di ${r.titolo}`} onPress={apriChiudi(r.azione.id)}>{titolo}</Button>
                : <Box key={`t-${r.id}`}>{titolo}</Box>,
          <Box key={`r2-${r.id}`} flexDirection="row" gap={1}>
            {seconda ? <Text size="caption" dimColor wrap="truncate-end">{seconda}</Text> : null}
            {r.azione && (sessioneChip || apribile) && <Button key={`mod-${r.azione.id}`} plain dimColor label="Dettagli" onPress={apriChiudi(r.azione.id)} />}
          </Box>,
        ])}
        {cella(`c-chi-${r.id}`, COL.chi, <Text><Text color={COLORE_MOTORE[r.motore]}>{'◆ '}</Text>{r.motore === 'codex' ? 'Codex' : 'Claude'}</Text>)}
        {cella(`c-mod-${r.id}`, COL.modello, stretto
          ? <Text wrap="truncate-end">{[r.modello ? nomeModello(r.modello) : '—', r.effort].filter(Boolean).join(' · ')}</Text>
          : <Text wrap="truncate-end" dimColor={!r.modello}>{r.modello ? nomeModello(r.modello) : '—'}</Text>)}
        {COL.effort && cella(`c-eff-${r.id}`, COL.effort, r.effort
          ? <Text>{`${barreEffort(r.effort)} ${r.effort}`}</Text>
          : <Text dimColor>—</Text>)}
        {cella(`c-st-${r.id}`, COL.stato, <Text><Text color={r.colore}>{`${r.segno} `}</Text>{r.parola}</Text>)}
        {COL.contesto && cella(`c-ctx-${r.id}`, COL.contesto, <Text tabular dimColor={r.contesto === undefined}>{r.contesto === undefined ? '—' : `${r.contesto}%`}</Text>, true)}
        {COL.attivita && cella(`c-att-${r.id}`, COL.attivita, <Text tabular dimColor>{r.qui ? 'adesso' : quando(r.attivita)}</Text>, true)}
      </Box>,
      r.azione && espansa === r.azione.id ? scheda(r.azione) : null,
    ]
  }

  const attesaTe = visibili.filter(aspettaTe)
  const daAvviare = visibili.filter(a => a.stato === 'proposta' || a.stato === 'accodata')
  const daFondere = visibili.filter(a => a.stato === 'consegnata')

  /** Barra di avanzamento: due Box in proporzione sul desktop, celle █ sul terminale. */
  const barra = (t: Traguardo) => {
    const pct = percentuale(t)
    const colore = pct >= 100 ? COLORE_STATO.inCorso : COLORE_STATO.proposta
    if (!conVelo) {
      const pieni = Math.round(pct / 5)
      return (
        <Text>
          <Text color={colore}>{'█'.repeat(pieni)}</Text>
          <Text dimColor>{'░'.repeat(20 - pieni)}</Text>
        </Text>
      )
    }
    return (
      <Box key={`barra-${t.numero}`} flexDirection="row" backgroundColor={velo('#808080', '33')}>
        {pct > 0 && (
          <Box flexGrow={pct} backgroundColor={colore}>
            <Text size="caption"> </Text>
          </Box>
        )}
        {pct < 100 && (
          <Box flexGrow={100 - pct}>
            <Text size="caption"> </Text>
          </Box>
        )}
      </Box>
    )
  }

  // Footer: quanto manca al rilascio, milestone per milestone. Sta in fondo perché è contesto, non lavoro.
  const footer = tr && (tr.lista.length > 0 || tr.errore) && (
    <Box
      key="footer"
      flexDirection="column"
      gap={1}
      marginTop={1}
      padding={1}
      backgroundColor={conVelo ? velo('#808080', '14') : undefined}
      borderStyle={conVelo ? undefined : 'single'}
      borderDimColor
    >
      <Box flexDirection="row" justifyContent="space-between">
        <Text size="caption" weight="medium" dimColor>
          Verso il rilascio
        </Text>
        <Text size="caption" dimColor>{`aggiornato alle ${oraDi(tr.letto)}`}</Text>
      </Box>
      {tr.lista.map(t => {
        const arrivo = stimaArrivo(t, new Date(adesso))
        const legate = lista.filter(a => a.issue && tr.milestoneDi[String(a.issue)] === t.numero).length
        const ritmo = [
          t.chiuseRecenti !== undefined ? `${t.chiuseRecenti} chiuse in 14 giorni` : undefined,
          arrivo ? `a questo ritmo arriva il ${giornoDi(arrivo)}` : t.chiuseRecenti === 0 ? 'ritmo fermo: nessuna stima' : undefined,
          legate ? `${legate} ${legate === 1 ? 'azione' : 'azioni'} del pannello` : undefined,
        ].filter(Boolean)
        return (
          <Box key={`tr-${t.numero}`} flexDirection="column">
            <Box flexDirection="row" justifyContent="space-between" alignItems="flex-end">
              <Text weight="semibold">{corto(t.titolo, 40)}</Text>
              <Text weight="semibold" tabular>{`${percentuale(t)}%`}</Text>
            </Box>
            {barra(t)}
            <Text size="caption" dimColor tabular>
              {`${t.chiuse} chiuse · ${t.aperte} aperte · ${t.scadenza ? `scade il ${giornoDi(new Date(t.scadenza))}` : 'senza scadenza'}`}
            </Text>
            {ritmo.length > 0 && (
              <Text size="caption" dimColor tabular>
                {ritmo.join(' · ')}
              </Text>
            )}
          </Box>
        )
      })}
      {tr.lista.length === 0 && !tr.errore && <Text dimColor>{`Nessuna milestone aperta su ${tr.repo}.`}</Text>}
      {tr.parziale && <Text size="caption" dimColor>{`Copertura parziale: ${tr.parziale}`}</Text>}
      {tr.errore && nota1('tr-err', COLORE_STATO.ferma, '!', `Milestone non lette: ${tr.errore}`)}
    </Box>
  )

  // --- vista Carico: quale modello fa cosa, con quale effort, e quanto ne resta ------------------------------

  const mancanti: Limite[] = [
    { id: 'claude', fornitore: 'claude', nome: 'Claude piano', fonte: 'app desktop (get_usage) o status line' },
    { id: 'claude-api', fornitore: 'claude', nome: 'Claude API', fonte: 'Anthropic Admin' },
    { id: 'codex', fornitore: 'codex', nome: 'Codex piano', fonte: 'sessioni locali' },
    { id: 'deepseek', fornitore: 'deepseek', nome: 'DeepSeek', fonte: 'balance API' },
    { id: 'freellmapi', fornitore: 'freellmapi', nome: 'FreeLLMAPI', fonte: 'proxy locale' },
  ]
  const limiti = [...capacita.limiti, ...mancanti.filter(m => !capacita.limiti.some(l => m.id === 'claude-api' ? l.id === m.id : l.fornitore === m.fornitore && l.id !== 'claude-api'))]
  const NOME_FORNITORE: Record<Fornitore, string> = { claude: 'Claude', codex: 'Codex', deepseek: 'DeepSeek', freellmapi: 'FreeLLMAPI' }
  const parolaSoglia = (s: Soglia | null) => (s ? `attenzione da ${s.attenzione}% · critica da ${s.critica}%` : 'nessuna soglia')

  /** Barra al rapporto vero con entrambi gli estremi: Box in proporzione sul desktop, 20 celle sul terminale. */
  const barraPct = (k: string, pct: number, colore: string, corta = false) => {
    const p = Math.min(100, Math.max(0, pct))
    if (!conVelo) {
      // Terminale stretto o colonna stretta: 10 celle, così la riga non va a capo.
      const celle = stretto || corta ? 10 : 20
      const pieni = Math.round((p / 100) * celle)
      return (
        <Text key={k}>
          <Text dimColor>{'0 '}</Text>
          <Text color={colore}>{'█'.repeat(pieni)}</Text>
          <Text dimColor>{`${'░'.repeat(celle - pieni)} 100%`}</Text>
        </Text>
      )
    }
    return (
      <Box key={k} flexDirection="row" alignItems="center" gap={1}>
        <Text size="caption" dimColor>0</Text>
        <Box flexGrow={1} flexDirection="row" backgroundColor={velo('#808080', '33')}>
          {p > 0 && (
            <Box flexGrow={p} backgroundColor={colore}>
              <Text size="caption"> </Text>
            </Box>
          )}
          {p < 100 && (
            <Box flexGrow={100 - p}>
              <Text size="caption"> </Text>
            </Box>
          )}
        </Box>
        <Text size="caption" dimColor>100%</Text>
      </Box>
    )
  }

  const rigaLimite = (l: Limite) => {
    const soglia = sogliaDi(regoleOra.risorse, l.fornitore)
    const fresco = limiteFresco(l, adesso)
    const n = l.percentuale
    const colore = coloreLimite(l, adesso, soglia)
    const livello = n !== undefined && (fresco || l.manuale) ? livelloDi(n, soglia) : undefined
    const valore = n !== undefined ? `${n}% usato` : l.valore !== undefined ? `${l.valore.toLocaleString('it-IT')} ${l.unita ?? ''}` : 'non disponibile'
    // Un valore inserito a mano non invecchia come una misura: dice solo quando è stato scritto.
    const eta = !l.letto
      ? 'mai letto'
      : l.manuale
        ? `inserito ${durata(Math.max(0, adesso - Date.parse(l.letto)))} fa`
        : `${durata(Math.max(0, adesso - Date.parse(l.letto)))} fa${fresco ? '' : ' · vecchio, non conta nelle scelte'}`
    const reset = l.reset
      ? new Date(l.reset).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
      : undefined
    return (
      <Box key={`limite-${l.id}`} flexDirection="column">
        <Text>
          {n === undefined ? <Text color={colore}>{'○ '}</Text> : livello && livello !== 'ok' ? <Text color={colore}>{'▲ '}</Text> : ''}
          {`${l.nome}: ${valore}${l.manuale ? ' · manuale' : ''}${livello === 'critica' ? ' · oltre la soglia critica' : livello === 'attenzione' ? ' · sopra la soglia di attenzione' : ''}${l.manuale && livello && livello !== 'ok' ? ' (dichiarato: non cambia le scelte)' : ''}`}
        </Text>
        {n !== undefined && barraPct(`barra-${l.id}`, n, colore)}
        <Text dimColor size="caption">{`${l.fonte} · ${eta}${l.errore ? ` · ${l.errore}` : ''}${reset ? ` · reset ${reset}` : ''}`}</Text>
      </Box>
    )
  }

  const controlloLimiti = (
    <Box key="limiti" flexDirection="column" gap={1}>
      {titoloSezione('t-limiti', 'Limiti e budget')}
      {FORNITORI.filter(f => limiti.some(l => l.fornitore === f)).map(f => (
        <Box key={`forn-${f}`} flexDirection="column" gap={1}>
          <Text>
            <Text weight="semibold">{NOME_FORNITORE[f]}</Text>
            <Text dimColor size="caption">{`  ${parolaSoglia(sogliaDi(regoleOra.risorse, f))}`}</Text>
          </Text>
          {limiti.filter(l => l.fornitore === f).map(rigaLimite)}
        </Box>
      ))}
      <Text size="caption" dimColor>Saldi e budget non sono quote di piano. Un dato vecchio resta grigio e non entra nelle scelte.</Text>
      <Text>{`FreeLLMAPI: ${capacita.proxy} · chiave ${capacita.chiavi.freellmapi ? 'impostata' : 'mancante'}`}</Text>
    </Box>
  )

  // Matrice modello × effort: al lavoro in inchiostro, in coda in grigio; un solo colore, più intenso dove si lavora di più.
  const inCodaOra = lista.filter(a => a.stato === 'proposta' || a.stato === 'accodata')
  const alLavoroOra = righe.filter(r => r.stato === 'in-corso')
  const modelliNoti = [
    ...MOTORI.filter(m => regoleOra.risorse.fornitori.includes(m)).flatMap(m => regoleOra.modelli[m]),
    ...alLavoroOra.map(r => r.modello).filter((m): m is string => !!m),
  ].filter((m, i, v) => v.indexOf(m) === i)
  const conta2 = (m: string, e: string) => ({
    lavoro: alLavoroOra.filter(r => r.modello === m && r.effort === e).length,
    coda: inCodaOra.filter(a => modelloDi(a, regoleOra) === m && effortDi(a, regoleOra) === e).length,
  })
  const modelliAttivi = modelliNoti.filter(m => regoleOra.effort.some(e => { const c = conta2(m, e); return c.lavoro + c.coda > 0 }))
  // Ogni sessione al lavoro che non cade in una cella si conta qui: la matrice non sottostima in silenzio.
  const senzaDati = alLavoroOra.filter(r => !r.modello || !r.effort || !regoleOra.effort.includes(r.effort)).length
  const larghezzaEffort = `${Math.floor(64 / Math.max(1, regoleOra.effort.length))}%`
  const VELI = ['', '26', '4D', '80'] as const
  const matrice = (
    <Box key="matrice" flexDirection="column" gap={1}>
      {titoloSezione('t-matrice', 'Al lavoro per modello ed effort')}
      {modelliAttivi.length === 0 ? (
        <Text dimColor>Nessuna sessione al lavoro e niente in coda.</Text>
      ) : (
        <Box flexDirection="column">
          <Box key="m-testa" flexDirection="row">
            {cella('m-h-mod', '36%', <Text size="caption" dimColor>Modello</Text>)}
            {regoleOra.effort.map(e => cella(`m-h-${e}`, larghezzaEffort, <Text size="caption" dimColor>{e}</Text>, true))}
          </Box>
          {modelliAttivi.map(m => (
            <Box key={`m-${m}`} flexDirection="row">
              {cella(`m-n-${m}`, '36%', <Text wrap="truncate-end">{nomeModello(m)}</Text>)}
              {regoleOra.effort.map(e => {
                const c = conta2(m, e)
                return (
                  <Box key={`m-${m}-${e}`} width={larghezzaEffort} flexDirection="row" justifyContent="flex-end" paddingRight={1}
                    backgroundColor={conVelo && c.lavoro ? velo(COLORE_STATO.proposta, VELI[Math.min(3, c.lavoro)]) : undefined}>
                    <Text tabular>
                      <Text weight={c.lavoro ? 'semibold' : 'regular'} dimColor={!c.lavoro}>{String(c.lavoro)}</Text>
                      {c.coda ? <Text dimColor>{` +${c.coda}`}</Text> : ''}
                    </Text>
                  </Box>
                )
              })}
            </Box>
          ))}
          <Text size="caption" dimColor>{`al lavoro · +in coda${senzaDati ? ` · ${senzaDati} al lavoro senza modello o effort noto` : ''}`}</Text>
        </Box>
      )}
    </Box>
  )

  // Token: la finestra di contesto di ogni sessione al lavoro, e il totale per modello.
  const conContesto = alLavoroOra.filter(r => r.contesto !== undefined)
  const migliaia = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n))
  const perModello = conContesto.reduce<Record<string, { n: number; token: number; noti: boolean }>>((acc, r) => {
    const k = r.modello ?? '—'
    const x = (acc[k] ??= { n: 0, token: 0, noti: true })
    x.n += 1
    if (r.token === undefined) x.noti = false
    else x.token += r.token
    return acc
  }, {})
  const token = (
    <Box key="token" flexDirection="column" gap={1}>
      {titoloSezione('t-token', 'Contesto delle sessioni al lavoro')}
      {conContesto.length === 0 ? (
        <Text dimColor>Nessuna sessione al lavoro riporta il suo contesto.</Text>
      ) : (
        conContesto.map(r => (
          <Box key={`tok-${r.id}`} flexDirection="row" alignItems="center">
            {cella(`tok-t-${r.id}`, '40%', <Text wrap="truncate-end">{r.titolo}</Text>)}
            <Box width="45%" paddingRight={1}>{barraPct(`tok-b-${r.id}`, r.contesto!, COLORE_STATO.proposta, true)}</Box>
            {cella(`tok-p-${r.id}`, '15%', <Text tabular>{`${r.contesto}%`}</Text>, true)}
          </Box>
        ))
      )}
      {Object.keys(perModello).length > 0 && (
        <Text size="caption" dimColor>
          {Object.entries(perModello)
            .map(([m, x]) => `${m === '—' ? 'modello ignoto' : nomeModello(m)}: ${x.n} ${x.n === 1 ? 'sessione' : 'sessioni'}${x.noti ? ` · ${migliaia(x.token)} token` : ''}`)
            .join(' · ')}
        </Text>
      )}
    </Box>
  )

  // Pesi in uso, detti a parole, e come si è distribuito davvero il lavoro nelle ultime 24 ore.
  const segno = (n: number) => (n > 0 ? `+${n}` : String(n))
  const parolePesi = regoleOra.risorse.pesi
    .map(p => `${p.tipo === 'modello' ? nomeModello(p.nome) : p.tipo === 'fornitore' ? motore(p.nome as Motore) : `effort ${p.nome}`} ${segno(p.percentuale)}%${p.assoluto ? ` ${segno(p.assoluto)}` : ''}`)
    .join(' · ')
  const critici = FORNITORI.flatMap(f => {
    const l = piuPieno(capacita.limiti, f, adesso)
    return l && livelloDi(l.percentuale!, sogliaDi(regoleOra.risorse, f)) === 'critica' ? [`${NOME_FORNITORE[f]} (${l.percentuale}%)`] : []
  })
  const avviiRecenti = tutte.filter(a => a.avviataIl && adesso - Date.parse(a.avviataIl) <= 86_400_000)
  const quote = MOTORI.map(m => ({ m, n: avviiRecenti.filter(a => a.esecutore === m).length })).filter(x => x.n > 0)
  const pesiInUso = (
    <Box key="pesi-uso" flexDirection="column" gap={1}>
      {titoloSezione('t-pesi', 'Pesi in uso')}
      <Text>
        {parolePesi
          ? `${parolePesi}. Valgono solo fra le combinazioni che le regole ammettono.`
          : 'Nessun peso: l\'ordine è il tuo, e il pannello completa le scelte lasciate aperte guardando i margini.'}
      </Text>
      {critici.length > 0 && nota1('critici', COLORE_LIVELLO.critica, '▲', `Oltre la soglia critica: ${critici.join(', ')}. Le scelte lasciate aperte vanno a un altro fornitore ammesso.`)}
      <Text size="caption" dimColor>
        {quote.length
          ? `Avvii nelle ultime 24 ore: ${quote.map(x => `${motore(x.m)} ${x.n} (${Math.round((x.n / avviiRecenti.length) * 100)}%)`).join(' · ')}`
          : 'Nessun avvio nelle ultime 24 ore.'}
      </Text>
    </Box>
  )

  const pesi: { tipo: Peso['tipo']; nome: string }[] = [
    ...MOTORI.map(nome => ({ tipo: 'fornitore' as const, nome })),
    ...Object.values(regoleOra.modelli).flat().map(nome => ({ tipo: 'modello' as const, nome })),
    ...regoleOra.effort.map(nome => ({ tipo: 'effort' as const, nome })),
  ]
  const impostazioniUi = <Box key="configurazione" flexDirection="column" gap={1}>
    <Text weight="semibold">Politica di questo progetto</Text>
    <Text size="caption">FreeLLMAPI inoltra a fornitori esterni. Solo rete locale blocca anche Claude/Codex e le milestone remote.</Text>
    {Select && <Select key="solo-locale" label="Rete" value={regoleOra.risorse.soloLocale ? 'locale' : 'abilitati'} options={[{ value: 'abilitati', label: 'Fornitori abilitati' }, { value: 'locale', label: 'Solo rete locale' }]} onSelect={v => void c.fai(() => configura({ soloLocale: v === 'locale' }))} />}
    {Select && <Select key="milestone-github" label="Milestone GitHub" value={regoleOra.risorse.milestoneGithub ? 'si' : 'no'} options={[{ value: 'no', label: 'Nessuna richiesta a GitHub' }, { value: 'si', label: 'Leggi le milestone del progetto' }]} onSelect={v => void c.fai(() => configura({ milestoneGithub: v === 'si' }))} />}
    {Select && FORNITORI.map(f => <Select key={`fornitore-${f}`} label={`Fornitore ${f}`} value={regoleOra.risorse.fornitori.includes(f) ? 'si' : 'no'} options={[{ value: 'no', label: 'Vietato' }, { value: 'si', label: 'Abilitato per questo progetto' }]} onSelect={v => void c.fai(() => configura({ fornitori: [...regoleOra.risorse.fornitori.filter(x => x !== f), ...(v === 'si' ? [f] : [])] }))} />)}
    <Text>{`Admin Anthropic: ${capacita.chiavi.anthropic ? 'impostata' : 'mancante'} · DeepSeek: ${capacita.chiavi.deepseek ? 'impostata' : 'mancante'}`}</Text>
    <Text size="caption" dimColor>Chiavi nei campi segreti di /config o nell’ambiente. Mai nel config del progetto.</Text>
    {Select && <Select key="free-livello" label="Compiti FreeLLMAPI" value={regoleOra.risorse.freellmapi.livello} options={[{ value: 'niente', label: 'Niente' }, { value: 'R1', label: 'Solo R0–R1' }, { value: 'R2', label: 'Anche R2' }]} onSelect={v => void c.fai(() => configura({ freellmapi: { ...regoleOra.risorse.freellmapi, livello: v } }))} />}
    {Input && <Input key="free-endpoint" label="Endpoint FreeLLMAPI (loopback)" value={regoleOra.risorse.freellmapi.endpoint} onSubmit={v => void c.fai(() => configura({ freellmapi: { ...regoleOra.risorse.freellmapi, endpoint: v.trim() } }))} />}
    <Text size="caption">Installa con Docker già disponibile; poi configura i fornitori e copia la chiave unificata dal dashboard http://localhost:3001.</Text>
    {INSTALLAZIONE.map((cmd, i) => <Box key={`installazione-${i}`} flexDirection="column"><Text size="caption">{cmd.join(' ')}</Text><Button key={`installa-${i}`} variant="secondary" label={i === 0 ? 'Prepara immagine Docker…' : 'Avvia container…'} onPress={fai(() => c.installa(i))} /></Box>)}
    <Text weight="semibold">Bilanciamento</Text>
    <Text size="caption">Base 100: peso = 100 × (1 + incremento % / 100) + incremento assoluto. Vale solo fra combinazioni ammesse; spareggio nell’ordine manuale.</Text>
    {Input && pesi.map(p => {
      const peso: Peso = regoleOra.risorse.pesi.find(x => x.tipo === p.tipo && x.nome === p.nome) ?? { ...p, percentuale: 0, assoluto: 0 }
      return <Box key={`peso-${p.tipo}-${p.nome}`} flexDirection="column"><Text>{`${p.tipo}: ${p.nome}`}</Text>
        <Input key={`percentuale-${p.tipo}-${p.nome}`} label="Incremento %" value={String(peso.percentuale)} onSubmit={v => void c.fai(() => c.peso({ ...peso, percentuale: v.trim() ? Number(v) : NaN }, regoleOra.risorse))} />
        <Input key={`assoluto-${p.tipo}-${p.nome}`} label="Incremento assoluto" value={String(peso.assoluto)} onSubmit={v => void c.fai(() => c.peso({ ...peso, assoluto: v.trim() ? Number(v) : NaN }, regoleOra.risorse))} />
      </Box>
    })}
    <Text size="caption">Piani, percentuali e budget manuali: limitiManuali nel config del progetto; non modificano i dati misurati.</Text>
  </Box>

  // Riga di sintesi: chi lavora, chi aspetta, e il margine più stretto per fornitore (solo misure fresche).
  const margine = (f: 'claude' | 'codex', nome: string) => {
    const l = piuPieno(capacita.limiti, f, adesso)
    if (!l) return undefined
    const livello = livelloDi(l.percentuale!, sogliaDi(regoleOra.risorse, f))
    return `${nome} ${l.percentuale}%${livello === 'critica' ? ' oltre la soglia critica' : livello === 'attenzione' ? ' in attenzione' : ''}`
  }
  const sintesi =
    [
      `${alLavoro} al lavoro`,
      attese ? `${attese} ${attese === 1 ? 'aspetta' : 'aspettano'} te` : undefined,
      proposte ? `${proposte} da avviare` : undefined,
      margine('claude', 'Claude'),
      margine('codex', 'Codex'),
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

  const lavoro = (
    <Box key="vista-lavoro-corpo" flexDirection="column" gap={2}>
      {senzaProgetto > 0 && (
        <Box key="senza-progetto" flexDirection="row" gap={1} alignItems="center" flexWrap="wrap">
          <Text>
            <Text color={COLORE_STATO.accodata}>{'◔ '}</Text>
            {`${senzaProgetto} ${senzaProgetto === 1 ? 'azione salvata' : 'azioni salvate'} da una versione precedente senza progetto`}
          </Text>
          <Button key="senza-assegna" variant="secondary" label="Assegna a questo progetto" onPress={fai(() => c.senzaProgetto('assegna'))} />
          <Button key="senza-scarta" plain label="Scarta" onPress={fai(() => c.senzaProgetto('scarta'))} />
        </Box>
      )}
      {Input && (lista.length > 6 || testoFiltro) && (
        <Box flexDirection="row" gap={1} alignItems="center">
          <Input
            key="filtro"
            label="Filtra"
            placeholder="titolo, #issue, claude, codex, modello"
            value={testoFiltro}
            submitLabel="filtra"
            onInput={v => void update($, filtro, () => v)}
            onSubmit={v => void update($, filtro, () => v)}
          />
          {testoFiltro && <Button key="via-filtro" plain label="Cancella filtro" onPress={() => void update($, filtro, () => '')} />}
        </Box>
      )}
      {!Input && testoFiltro && <Button key="via-filtro" plain label={`Cancella il filtro «${testoFiltro}»`} onPress={() => void update($, filtro, () => '')} />}
      {lista.length > 0 && visibili.length === 0 && <Text dimColor>{`Nessuna azione corrisponde a «${testoFiltro}».`}</Text>}

      {attesaTe.length > 0 && (
        <Box key="sez-attesa" flexDirection="column" gap={1}>
          {titoloSezione('t-attesa', 'Aspettano te', attesaTe.length)}
          {attesaTe.map(rigaAttesa)}
        </Box>
      )}

      <Box key="sez-lavoro" flexDirection="column" gap={1}>
        <Box flexDirection="row" justifyContent="space-between" alignItems="center">
          {titoloSezione('t-lavoro', 'Al lavoro adesso', alLavoro)}
          {righe.length > 6 && (
            <Button key="tutte-sessioni" plain label={tutteLeSessioni ? 'Mostra meno' : `Mostra tutte · ${righe.length}`} onPress={() => void update($, tutteSessioni, v => !v)} />
          )}
        </Box>
        {righe.length === 0 ? (
          <Text dimColor>{ses.nota ? `Nessuna sessione letta: ${ses.nota}.` : 'Nessuna sessione di questo progetto nelle ultime 24 ore.'}</Text>
        ) : (
          <Box flexDirection="column" gap={1}>
            {intestazione}
            {mostrate.flatMap(rigaSessione)}
          </Box>
        )}
        {righe.length > 0 && ses.nota && <Text size="caption" dimColor>{`Lettura parziale: ${ses.nota}.`}</Text>}
      </Box>

      <Box key="sez-avvio" flexDirection="column" gap={1}>
        <Box flexDirection="row" justifyContent="space-between" alignItems="center" gap={1} flexWrap="wrap">
          {titoloSezione('t-avvio', 'Da avviare e in coda', daAvviare.length)}
          {proposte > 0 && <Button key="tutte" variant="primary" hotkey="a" label={`Avvia tutte · ${proposte}`} onPress={fai(c.avviaTutte)} />}
        </Box>
        {daAvviare.length === 0 ? (
          <Text dimColor>
            {lista.length === 0
              ? 'Quando una sessione suggerisce un\'azione con suggerisci_azione, la trovi qui pronta da rivedere e avviare.'
              : 'Niente da avviare.'}
          </Text>
        ) : (
          daAvviare.map(rigaCoda)
        )}
        {proposte > 0 && <Text size="caption" dimColor>{`al massimo ${c.max} in parallelo · regole da ${regoleOra.fonte}`}</Text>}
      </Box>

      {daFondere.length > 0 && (
        <Box key="sez-fondere" flexDirection="column" gap={1}>
          {titoloSezione('t-fondere', 'Da fondere', daFondere.length)}
          {daFondere.map(rigaFondere)}
        </Box>
      )}
      {footer}
    </Box>
  )

  const carico = (
    <Box key="vista-carico-corpo" flexDirection="column" gap={2}>
      {matrice}
      {controlloLimiti}
      {token}
      {pesiInUso}
    </Box>
  )

  return (
    <Box flexDirection="column" gap={2}>
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="row" justifyContent="space-between" alignItems="center" gap={1}>
          <Text size="title" weight="semibold" wrap="truncate-end">
            {`chipManager${io?.repo ? ` · ${io.repo}` : ''}`}
          </Text>
          <Button key="ricarica" plain dimColor hotkey="r" label={`Aggiorna${ses.letto ? ` · ${oraDi(ses.letto)}` : ''}`} onPress={fai(c.giro)} />
        </Box>
        <Text dimColor>{sintesi}</Text>
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
      {vistaOra === 'carico' ? carico : vistaOra === 'impostazioni' ? impostazioniUi : lavoro}
    </Box>
  )
}
