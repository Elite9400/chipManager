// Il disegno del pannello. Regole (design-taste app-screens + ui-ux-pro-max):
// - un solo primario nel pannello («Avvia tutte»); sulle schede azioni secondarie e testuali;
// - schede neutre: il colore sta sui dati (stato, motore, modello, effort), il bordo si accende
//   solo sulla scheda che aspetta una decisione (ferma o fallita);
// - il colore MARCA (segni, velo, bordi), le parole restano nell'inchiostro del tema: contrasto pieno
//   sul chiaro e sullo scuro; il colore non è mai l'unico segnale (segno + parola, effort anche ▰▰▱▱);
// - niente maiuscolo spaziato, niente emoji: titoli di sezione in frase, piccoli, grigi.
import { atom, read, update } from 'claude-code'
import type { ElementTable, EngineInterface, RenderSurface } from 'claude-code'

import type { Azione, Chiamante, Contesto, Corsia, Destinazione, Limite, Motore, Permessi, Peso, Regole, Revisore, Risorse, RisorseProgetto, Traguardi, Traguardo, Vita } from '../types'
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
  FORNITORI,
  limiteFresco,
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
const regole = atom({ plugin: 'chip-manager', key: 'regole' } as const, null as Regole | null, { shape: 'regole-4' })
const annullabile = atom({ plugin: 'chip-manager', key: 'annullabile' } as const, null as { id: string; titolo: string } | null)
const filtro = atom({ plugin: 'chip-manager', key: 'filtro' } as const, '')
const illeggibili = atom({ plugin: 'chip-manager', key: 'illeggibili' } as const, [] as { nome: string; motivo: string }[], {
  shape: 'illeggibili-2',
})
const contesto = atom({ plugin: 'chip-manager', key: 'contesto' } as const, null as Chiamante | null, { shape: 'chiamante-1' })
const risorse = atom({ plugin: 'chip-manager', key: 'risorse' } as const, RISORSE_VUOTE as Risorse, { shape: 'risorse-1' })
const impostazioni = atom({ plugin: 'chip-manager', key: 'impostazioni' } as const, false)

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
  associa: (a: Azione) => Promise<unknown>
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

export async function disegna($: Eng, el: ElementTable, surface: RenderSurface, c: Ctx) {
  const { Box, Text, Button } = el
  const Select = 'Select' in el ? el.Select : undefined
  const Input = 'Input' in el ? el.Input : undefined
  // Il terminale non conosce l'alfa: lì l'etichetta è segno + parola, senza velo.
  const conVelo = surface !== 'terminal'

  const io = await read($, contesto)
  // Solo le azioni di questo progetto: quelle senza progetto non si mostrano più da nessuna parte.
  const tutte = (await read($, azioni)).filter(a => !!a.repo && a.repo === io?.repo)
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
  const configuraAperta = await read($, impostazioni)
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
  const attese = conta(a => ferma(a) || a.stato === 'fallita')
  const inCoda = conta(a => a.stato === 'accodata')
  const inCorso = conta(a => (a.stato === 'avviata' && !ferma(a)) || a.stato === 'in-avvio')
  const consegnate = conta(a => a.stato === 'consegnata')
  const riepilogo =
    [
      attese && `${attese} aspettano te`,
      proposte && `${proposte} da avviare`,
      inCoda && `${inCoda} in coda`,
      inCorso && `${inCorso} in corso`,
      consegnate && `${consegnate} da fondere`,
    ]
      .filter(Boolean)
      .join(' · ') || 'Nessuna azione in sospeso'

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
            {!a.repo && modificabile && (
              <Button key={`associa-${a.id}`} variant="secondary" label="Associa a questo progetto" onPress={fai(() => c.associa(a))} />
            )}
            {a.stato === 'fallita' && blocchi.length === 0 && (
              <Button key={`riprova-${a.id}`} variant="secondary" label="Riprova" onPress={fai(() => c.avvia(a))} />
            )}
            {a.stato === 'fallita' && blocchi.length === 0 && io?.lanciatore !== 'cli' && a.esecutore !== 'freellmapi' && (
              <Button key={`chiedi-${a.id}`} plain label="Chiedi a questa sessione" onPress={fai(() => c.chiediQui(a))} />
            )}
            {a.stato === 'in-avvio' && a.lanciatore !== 'cli' && mia && ((a.manuale && !a.presa) || (!a.manuale && (a.avvioScade ?? '') < new Date(adesso).toISOString())) && (
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

  // Chi aspetta te viene prima di tutto: è l'unica cosa che richiede una decisione adesso.
  const sezioni: { titolo: string; righe: Azione[] }[] = [
    { titolo: 'Aspettano te', righe: visibili.filter(a => ferma(a) || a.stato === 'fallita') },
    { titolo: 'In corso', righe: visibili.filter(a => (a.stato === 'avviata' && !ferma(a)) || a.stato === 'in-avvio') },
    { titolo: 'Consegnate, da fondere', righe: visibili.filter(a => a.stato === 'consegnata') },
    { titolo: 'In coda', righe: visibili.filter(a => a.stato === 'accodata') },
    { titolo: 'Da avviare', righe: visibili.filter(a => a.stato === 'proposta') },
  ]

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

  const mancanti: Limite[] = [
    { id: 'claude', fornitore: 'claude', nome: 'Claude piano', fonte: 'app desktop (get_usage) o status line' },
    { id: 'claude-api', fornitore: 'claude', nome: 'Claude API', fonte: 'Anthropic Admin' },
    { id: 'codex', fornitore: 'codex', nome: 'Codex piano', fonte: 'sessioni locali' },
    { id: 'deepseek', fornitore: 'deepseek', nome: 'DeepSeek', fonte: 'balance API' },
    { id: 'freellmapi', fornitore: 'freellmapi', nome: 'FreeLLMAPI', fonte: 'proxy locale' },
  ]
  const limiti = [...capacita.limiti, ...mancanti.filter(m => !capacita.limiti.some(l => m.id === 'claude-api' ? l.id === m.id : l.fornitore === m.fornitore && l.id !== 'claude-api'))]
  const controlloLimiti = (
    <Box key="limiti" flexDirection="column" gap={1}>
      <Text weight="semibold">Limiti e budget</Text>
      {limiti.map(l => {
        const fresco = limiteFresco(l, adesso)
        const n = l.percentuale
        const pieni = n === undefined ? 0 : Math.round(Math.min(100, Math.max(0, n)) / 10)
        const valore = n !== undefined ? `${n}% usato` : l.valore !== undefined ? `${l.valore.toLocaleString('it-IT')} ${l.unita ?? ''}` : 'non disponibile'
        // Un valore inserito a mano non invecchia come una misura: dice solo quando è stato scritto.
        const eta = !l.letto
          ? 'mai letto'
          : l.manuale
            ? `inserito ${durata(Math.max(0, adesso - Date.parse(l.letto)))} fa`
            : `${durata(Math.max(0, adesso - Date.parse(l.letto)))} fa${fresco ? '' : ' · vecchio'}`
        const reset = l.reset
          ? new Date(l.reset).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
          : undefined
        return <Box key={`limite-${l.id}`} flexDirection="column">
          <Text><Text color={coloreLimite(l, adesso)}>{n === undefined ? '○ ' : `${'█'.repeat(pieni)}${'░'.repeat(10 - pieni)} `}</Text>{`${l.nome}: ${valore}${l.manuale ? ' · manuale' : ''}`}</Text>
          <Text dimColor size="caption">{`${l.fonte} · ${eta}${l.errore ? ` · ${l.errore}` : ''}${reset ? ` · reset ${reset}` : ''}`}</Text>
        </Box>
      })}
      <Text size="caption" dimColor>70% attenzione · 90% quasi esaurito. Saldi e budget non sono quote di piano.</Text>
      <Text>{`FreeLLMAPI: ${capacita.proxy} · chiave ${capacita.chiavi.freellmapi ? 'impostata' : 'mancante'}`}</Text>
      <Button key="impostazioni" plain hotkey="i" label={configuraAperta ? 'Chiudi impostazioni' : 'Impostazioni e pesi'} onPress={() => void update($, impostazioni, v => !v)} />
    </Box>
  )

  const pesi: { tipo: Peso['tipo']; nome: string }[] = [
    ...MOTORI.map(nome => ({ tipo: 'fornitore' as const, nome })),
    ...Object.values(regoleOra.modelli).flat().map(nome => ({ tipo: 'modello' as const, nome })),
    ...regoleOra.effort.map(nome => ({ tipo: 'effort' as const, nome })),
  ]
  const impostazioniUi = configuraAperta && <Box key="configurazione" flexDirection="column" gap={1} borderStyle="single" paddingX={1}>
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

  return (
    <Box flexDirection="column" gap={2}>
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="row" justifyContent="space-between" alignItems="center">
          <Text size="title" weight="semibold">
            chipManager
          </Text>
          <Button key="ricarica" plain dimColor hotkey="r" label="Aggiorna" onPress={fai(c.giro)} />
        </Box>
        <Text dimColor>{riepilogo}</Text>
        <Text size="caption" dimColor>{`Avvio: ${io?.lanciatore === 'cli' ? 'CLI in worktree proprio' : io?.lanciatore === 'desktop' ? 'sessioni desktop' : 'capacità non verificata'}`}</Text>
        {controlloLimiti}
        {proposte > 0 && (
          <Box flexDirection="row" gap={2} alignItems="center" flexWrap="wrap">
            <Button key="tutte" variant="primary" hotkey="a" label={`Avvia tutte · ${proposte}`} onPress={fai(c.avviaTutte)} />
            <Text size="caption" dimColor>
              {`al massimo ${c.max} in parallelo · regole da ${regoleOra.fonte}`}
            </Text>
          </Box>
        )}
        {!regoleOra.lette && nota1('regole', COLORE_STATO.fallita, '▲', `Regole ${regoleOra.fonte}: nessun avvio finché routing.json non si legge.`)}
        {rotte.length > 0 &&
          nota1(
            'rotte',
            COLORE_STATO.ferma,
            '!',
            `Non si leggono: ${rotte.map(r => `${r.nome} (${r.motivo})`).join('; ')}. Finché non si leggono, il pannello non avvia e non chiude nulla da solo.`,
          )}
      </Box>
      {impostazioniUi}
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
      {lista.length === 0 && (
        <Text dimColor>Quando una sessione suggerisce un'azione con suggerisci_azione, la trovi qui pronta da rivedere e avviare.</Text>
      )}
      {lista.length > 0 && visibili.length === 0 && <Text dimColor>{`Nessuna azione corrisponde a «${testoFiltro}».`}</Text>}
      {sezioni
        .filter(s => s.righe.length > 0)
        .map(s => (
          <Box key={`sez-${s.titolo}`} flexDirection="column" gap={1}>
            <Text size="caption" weight="medium" dimColor>
              {`${s.titolo}  ${s.righe.length}`}
            </Text>
            {s.righe.map(scheda)}
          </Box>
        ))}
      {footer}
    </Box>
  )
}
