// Vista Lavoro: chi aspetta una decisione, chi lavora adesso, cosa c'è da avviare e da fondere, il rilascio.
import { atom, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { Azione, Contesto, Corsia, Destinazione, Motore, Permessi, Revisore, Traguardo } from '../types'
import {
  barreEffort,
  BASE_RE,
  blocca,
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
  pianifica,
  pianoValido,
  PERMESSI,
  RAMO_RE,
  sensibile,
  stimaArrivo,
  taskAccertato,
  transizione,
  velo,
  violazioniAvvio,
} from './logica'
import { letto, salvato } from './lingua'
import type { Msg } from './lingua'
import type { Dati } from './pannello'
import { GRIGIO, MOTORE, STATO } from './tema'

// Copia identica degli atomi di register.tsx (lo scanner li vuole nel file che li usa).
const avviso = atom({ plugin: 'chip-manager', key: 'avviso' } as const, null as string | null)
const filtro = atom({ plugin: 'chip-manager', key: 'filtro' } as const, '')
const tutteSessioni = atom({ plugin: 'chip-manager', key: 'tutteSessioni' } as const, false)

const REVISORI = ['claude', 'codex', 'nessuno'] as const
const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']
const giornoDi = (d: Date) => `${d.getDate()} ${MESI[d.getMonth()]} ${d.getFullYear()}`
const corto = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

// `$` resta un argomento: lo scanner non lo vuole dentro un oggetto.
export function vistaLavoro($: EngineInterface, d: Dati) {
  const { T, c, Select, Input, conVelo, classe, colonne, ui, io, tutte, senzaProgetto, ses, tutteLeSessioni, regoleOra,
    testoFiltro, lista, visibili, espansa, motiviAperti, stati, tr, adesso, capacita, boardPronta, fai, modifica, completa,
    apriChiudi, apriPerche, ferma, statoDi, nota1, proposte, tentativoAnnullabile, aspettaTe, titoloSezione, righe,
    alLavoro, cella, MOTORI, motore, oraDi } = d
  const { Box, Text, Button } = d.el
  type Riga = Dati['righe'][number]
  /**
   * La chip nelle etichette dei pulsanti: il numero d'ordine, che la distingue anche da un titolo con lo stesso inizio,
   * e il titolo corto, perché il desktop può disegnare l'etichetta al posto del testo del pulsante.
   */
  const breve = (a: Azione) => {
    const n = lista.findIndex(x => x.id === a.id) + 1
    return `${n || a.id} · ${corto(a.titolo, 24)}`
  }

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
        backgroundColor={conVelo ? velo(GRIGIO, '14') : undefined}
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
                p.value === 'eredita' && sensibile(a, regoleOra) ? { value: 'eredita', label: 'Accetta modifiche (predefinito sulle sensibili)' } : { ...p, label: T(p.label) },
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
              key={`piano-${a.id}`}
              label="Piano"
              placeholder="percorso nel repo, es. docs/PIANO.md"
              value={a.piano ?? ''}
              submitLabel="salva"
              onSubmit={v => {
                const t = v.trim()
                const no = t ? pianoValido(t) : undefined
                if (no) return void update($, avviso, () => no)
                void modifica(a, { piano: t || undefined })()
              }}
            />,
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
        : T(a.permessi ? `permessi.${a.permessi}` as const : sensibile(a, regoleOra) ? 'permessi.acceptEdits' : 'permessi.eredita').toLowerCase(),
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
              {qui ? <Text color={STATO.inCorso}>{'● '}</Text> : ''}
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

  /**
   * Prima riga di una scheda o di una sessione: il titolo va a capo e lascia lo stato a destra; su `stretta` lo stato
   * scende sotto. (`ui.Riga` manda a capo l'intero gruppo di destra quando il titolo è lungo: qui lo stato resta fisso.)
   */
  const testa = (k: string, principale: unknown, destra: unknown[]) => (
    <Box key={k} flexDirection={classe === 'stretta' ? 'column' : 'row'} justifyContent="space-between" alignItems="flex-start" columnGap={1}>
      <Box flexDirection="column" flexGrow={1} flexShrink={1}>
        {principale as never}
      </Box>
      <Box flexDirection="row" flexShrink={0} columnGap={1}>
        {destra as never}
      </Box>
    </Box>
  )

  /** Frammenti in fila che vanno a capo fra un frammento e l'altro, separati da «·». */
  const pezzi = (k: string, voci: unknown[]) => (
    <Box key={k} flexDirection="row" flexWrap="wrap" columnGap={1}>
      {voci.filter(Boolean).map((v, i) => (
        <Text key={`${k}-${i}`}>
          {i ? <Text dimColor>{'· '}</Text> : ''}
          {v as never}
        </Text>
      ))}
    </Box>
  )

  /** Le informazioni di lavoro in inchiostro: il colore solo sul ◆ del motore e sul ▲ della corsia sensibile. */
  const infoLavoro = (a: Azione) => {
    const effort = effortDi(a, regoleOra)
    const corsia = corsiaDi(a, regoleOra)
    const prima = a.dipende.map(x => tutte.find(y => y.id === x)?.titolo ?? x)
    const ms = milestoneDi(a)
    return pezzi(`info-${a.id}`, [
      <Text><Text color={MOTORE[a.esecutore]}>{'◆ '}</Text>{motore(a.esecutore)}</Text>,
      <Text>{nomeModello(modelloDi(a, regoleOra))}</Text>,
      <Text>{`${barreEffort(effort)} ${effort}`}</Text>,
      <Text>{a.revisore === 'nessuno' ? 'senza revisione' : `↺ rivede ${motore(a.revisore)}`}</Text>,
      sensibile(a, regoleOra) ? <Text><Text color={STATO.errore}>{'▲ '}</Text>{`${corsia ?? 'R4'} sensibile`}</Text> : corsia && <Text>{corsia}</Text>,
      a.issue && <Text>{`#${a.issue}`}</Text>,
      ms && <Text>{`◎ ${corto(ms.titolo, 28)}`}</Text>,
      prima.length > 0 && <Text>{`dopo «${corto(prima.join('», «'), 40)}»`}</Text>,
    ])
  }
  /** La chip dello stato, con il segno nel suo colore e la parola nell'inchiostro. */
  const chipStato = (a: Azione) => {
    const s = statoDi(a)
    return ui.Chip({ chiave: `st-${a.id}`, testo: s.parola, segno: s.segno, colore: s.colore })
  }

  const scheda = (a: Azione) => {
    const modificabile = ['proposta', 'accodata', 'fallita'].includes(a.stato)
    const aperto = espansa === a.id && modificabile
    const dip = dipendenze(a, tutte)
    const allerta = ferma(a) ? STATO.attesa : a.stato === 'fallita' ? STATO.errore : undefined
    const vita = stati[a.id]
    const blocchi = modificabile ? violazioniAvvio(a, regoleOra, tutte, io) : []
    const bloccatoQui = a.stato === 'proposta' ? violazioniAvvio(a, regoleOra, tutte, io, true) : []
    const sblocca = blocca(a, tutte)
    const mia = !!io && a.lanciataDa === io.io
    return (
      <Box
        key={`riga-${a.id}`}
        flexDirection="column"
        gap={1}
        borderStyle="round"
        borderColor={allerta}
        borderDimColor={!allerta}
        paddingX={1}
        paddingY={conVelo ? 1 : 0}
      >
        {testa(
          `testa-${a.id}`,
          (
            <Button key={`apri-${a.id}`} plain label={`${aperto ? 'Chiudi' : 'Apri'} i dettagli di ${a.titolo}`} onPress={apriChiudi(a.id)}>
              <Text dimColor tabular>{`${lista.indexOf(a) + 1}  `}</Text>
              <Text weight="semibold" bold>
                {a.titolo}
              </Text>
            </Button>
          ),
          [chipStato(a)],
        )}
        {infoLavoro(a)}
        <Text dimColor size="caption" wrap="wrap">
          {opzioni(a)}
        </Text>
        {a.dipende.length > 0 &&
          nota1(
            `dip-${a.id}`,
            dip.chiuse ? STATO.inCorso : STATO.coda,
            dip.chiuse ? '✓' : '◔',
            `${dip.chiuse ? 'Dipendenze fuse' : 'Aspetta che siano fuse'}: ${a.dipende.map(d => tutte.find(x => x.id === d)?.titolo ?? d).join(', ')}`,
          )}
        {sblocca > 0 && (
          <Text size="caption" dimColor>
            {`Sblocca ${sblocca} ${sblocca === 1 ? 'azione' : 'azioni'}`}
          </Text>
        )}
        {a.stato === 'accodata' && a.motivoCoda && nota1(`coda-${a.id}`, STATO.coda, '◔', `In coda: ${T.m(letto(a.motivoCodice, a.motivoParametri, a.motivoCoda))}`)}
        {a.contesto === 'fork' && a.origineFork && (
          <Text size="caption" dimColor>
            {a.origineFork === io?.io
              ? 'Fork di questa conversazione'
              : `Fork della conversazione di «${a.origineNome ?? `${a.origineFork.slice(0, 8)}…`}»: riparte solo da quella sessione`}
          </Text>
        )}
        {blocchi.length > 0 && motivi(a, blocchi, 'Così non può partire')}
        {(a.stato === 'avviata' || a.stato === 'consegnata') && pipeline(a, vita?.fase)}
        {(a.stato === 'avviata' || a.stato === 'consegnata') && (
          <Text size="caption" dimColor tabular wrap="wrap">
            {[
              a.avviataIl ? `da ${durata(adesso - Date.parse(a.avviataIl), T.lingua)}` : undefined,
              vita?.ultimaAttivita ? `ultima attività ${durata(adesso - Date.parse(vita.ultimaAttivita), T.lingua)} fa` : undefined,
              vita?.ramo,
              a.sessione && !mia ? 'aprila dalla barra laterale' : undefined,
            ]
              .filter(Boolean)
              .join(' · ') || ' '}
          </Text>
        )}
        {a.errore && nota1(`err-${a.id}`, STATO.attesa, '!', T.m(letto(a.erroreCodice, a.erroreParametri, a.errore)))}
        {a.risultato && <Box flexDirection="column" borderStyle="single" paddingX={1}><Text weight="semibold">Bozza FreeLLMAPI da rivedere</Text><Text>{a.risultato}</Text></Box>}
        <Box flexDirection="row" gap={1} flexWrap="wrap" justifyContent="space-between" alignItems="center">
          <Box flexDirection="row" gap={1} flexWrap="wrap">
            {a.stato === 'proposta' && blocchi.length === 0 && (
              <Button key={`avvia-${a.id}`} variant="secondary" label={`${dip.chiuse ? '▶ Avvia' : '▶ Accoda'} ${breve(a)}`} onPress={fai(() => c.avvia(a))}>
                {dip.chiuse ? '▶ Avvia' : '▶ Accoda'}
              </Button>
            )}
            {a.stato === 'proposta' && dip.chiuse && bloccatoQui.length === 0 && (
              <Button key={`qui-${a.id}`} plain label={`Fallo qui ${breve(a)}`} onPress={fai(() => c.faiQui(a))}>Fallo qui</Button>
            )}
            {a.stato === 'fallita' && blocchi.length === 0 && (
              <Button key={`riprova-${a.id}`} variant="secondary" label={`▶ Riprova ${breve(a)}`} onPress={fai(() => c.avvia(a))}>
                ▶ Riprova
              </Button>
            )}
            {a.stato === 'fallita' && blocchi.length === 0 && io?.lanciatore !== 'cli' && a.esecutore !== 'freellmapi' && (
              <Button key={`chiedi-${a.id}`} plain label={`Chiedi a questa sessione ${breve(a)}`} onPress={fai(() => c.chiediQui(a))}>Chiedi a questa sessione</Button>
            )}
            {tentativoAnnullabile(a) && (
              <Button key={`annullaT-${a.id}`} plain label={`Annulla il tentativo ${breve(a)}`} onPress={fai(() => c.annullaTentativo(a))}>Annulla il tentativo</Button>
            )}
            {a.stato === 'accodata' && (
              <Button
                key={`annulla-${a.id}`}
                variant="secondary"
                label={`Togli dalla coda ${breve(a)}`}
                onPress={modifica(a, { ...transizione(a, 'proposta', new Date(adesso).toISOString()), ...salvato('motivoCoda', 'motivo', undefined) })}
              >
                Togli dalla coda
              </Button>
            )}
            {(a.stato === 'avviata' || a.stato === 'consegnata') && a.sessione && mia && (
              <Button key={`vedi-${a.id}`} variant="secondary" label={`Apri ${breve(a)}`} onPress={fai(() => c.apri(a.sessione!))}>Apri</Button>
            )}
            {(a.stato === 'avviata' || a.stato === 'consegnata') && (
              <Button key={`fatta-${a.id}`} plain label={`Segna completata ${breve(a)}`} onPress={completa(a)}>Segna completata</Button>
            )}
            {boardPronta && <Button key={`board-${a.id}`} plain label="Nella board" onPress={fai(c.apriBoard)} />}
            {modificabile && <Button key={`mod-${a.id}`} plain label={`${aperto ? 'Chiudi' : 'Modifica'} ${breve(a)}`} onPress={apriChiudi(a.id)}>{aperto ? 'Chiudi' : 'Modifica'}</Button>}
          </Box>
          {modificabile && spostaScarta(a)}
        </Box>
        {aperto && editor(a)}
      </Box>
    )
  }

  // --- vista Lavoro ------------------------------------------------------------------------------------
  // Una scheda compatta per ogni chip; «Dettagli» apre al suo posto la scheda completa (con l'editor, se si può modificare).
  // Stessa chiave del «Modifica» della scheda: lo stesso controllo, chiusa o aperta.
  const dettagli = (a: Azione) => (
    <Button key={`mod-${a.id}`} plain label={`Dettagli ${breve(a)}`} onPress={apriChiudi(a.id)}>
      Dettagli
    </Button>
  )
  function spostaScarta(a: Azione) {
    return (
      <Box key={`ordine-${a.id}`} flexDirection="row" flexWrap="wrap" columnGap={1}>
        <Button key={`su-${a.id}`} plain dimColor label={`↑ ${breve(a)}`} onPress={fai(() => c.riordina(a.id, -1))}>
          ↑
        </Button>
        <Button key={`giu-${a.id}`} plain dimColor label={`↓ ${breve(a)}`} onPress={fai(() => c.riordina(a.id, 1))}>
          ↓
        </Button>
        <Button key={`scarta-${a.id}`} plain dimColor label={`Scarta ${breve(a)}`} onPress={fai(() => c.scarta(a))}>
          Scarta
        </Button>
      </Box>
    )
  }
  /** L'elenco completo dei motivi per cui una chip non parte. */
  function motivi(a: Azione, blocchi: Msg[], titolo: string) {
    return (
      // Senza velo: il rosso del segno sul proprio velo, sul fondo scuro, scende sotto 3:1.
      <Box key={`motivi-${a.id}`} flexDirection="column" paddingX={1}>
        {nota1(`bt-${a.id}`, STATO.errore, '▲', titolo)}
        {blocchi.map((b, i) => (
          <Text key={`bl-${a.id}-${i}`} size="caption" wrap="wrap">{`· ${T.m(b)}`}</Text>
        ))}
      </Box>
    )
  }

  /**
   * Scheda compatta (C1.1, matrice C1.6): numero e titolo intero con lo stato, le informazioni di lavoro, l'inizio del
   * mandato, le azioni. «▶ Avvia» è sempre il primo pulsante; su una chip bloccata il primo motivo e «Perché».
   */
  const schedaCompatta = (a: Azione) => {
    if (espansa === a.id) return scheda(a)
    const modificabile = ['proposta', 'accodata', 'fallita'].includes(a.stato)
    const dip = dipendenze(a, tutte)
    const blocchi = a.stato === 'proposta' || a.stato === 'fallita' ? violazioniAvvio(a, regoleOra, tutte, io) : []
    const bloccatoQui = a.stato === 'proposta' ? violazioniAvvio(a, regoleOra, tutte, io, true) : []
    const bloccata = blocchi.length > 0
    const mia = !!io && a.lanciataDa === io.io
    const allerta = bloccata || a.stato === 'fallita' ? STATO.errore : ferma(a) ? STATO.attesa : undefined
    const brief = a.brief.split('\n').find(r => r.trim())?.trim() ?? ''
    const avviata = a.stato === 'avviata' || a.stato === 'consegnata'
    const pulsanti = [
      a.stato === 'proposta' && !bloccata && (
        <Button key={`avvia-${a.id}`} variant="secondary" label={`${dip.chiuse ? '▶ Avvia' : '▶ Accoda'} ${breve(a)}`} onPress={fai(() => c.avvia(a))}>
          {dip.chiuse ? '▶ Avvia' : '▶ Accoda'}
        </Button>
      ),
      a.stato === 'fallita' && !bloccata && (
        <Button key={`riprova-${a.id}`} variant="secondary" label={`▶ Riprova ${breve(a)}`} onPress={fai(() => c.avvia(a))}>
          ▶ Riprova
        </Button>
      ),
      // «Fallo qui» ha la sua guardia: resta anche su una chip che non può partire come sessione nuova.
      a.stato === 'proposta' && dip.chiuse && bloccatoQui.length === 0 && <Button key={`qui-${a.id}`} plain label={`Fallo qui ${breve(a)}`} onPress={fai(() => c.faiQui(a))}>Fallo qui</Button>,
      a.stato === 'fallita' && !bloccata && io?.lanciatore !== 'cli' && a.esecutore !== 'freellmapi' && (
        <Button key={`chiedi-${a.id}`} plain label={`Chiedi a questa sessione ${breve(a)}`} onPress={fai(() => c.chiediQui(a))}>Chiedi a questa sessione</Button>
      ),
      bloccata && (
        <Button
          key={`perche-${a.id}`}
          plain
          label={`${motiviAperti === a.id ? 'Nascondi i motivi' : 'Perché'} ${breve(a)}`}
          onPress={apriPerche(a.id)}
        >
          {motiviAperti === a.id ? 'Nascondi i motivi' : 'Perché'}
        </Button>
      ),
      tentativoAnnullabile(a) && <Button key={`annullaT-${a.id}`} plain label={`Annulla il tentativo ${breve(a)}`} onPress={fai(() => c.annullaTentativo(a))}>Annulla il tentativo</Button>,
      a.stato === 'accodata' && (
        <Button key={`annulla-${a.id}`} plain label={`Togli dalla coda ${breve(a)}`} onPress={modifica(a, { ...transizione(a, 'proposta', new Date(adesso).toISOString()), ...salvato('motivoCoda', 'motivo', undefined) })}>
          Togli dalla coda
        </Button>
      ),
      avviata && a.sessione && mia && <Button key={`vedi-${a.id}`} variant="secondary" label={`Apri ${breve(a)}`} onPress={fai(() => c.apri(a.sessione!))}>Apri</Button>,
      avviata && <Button key={`fatta-${a.id}`} plain label={`Segna completata ${breve(a)}`} onPress={completa(a)}>Segna completata</Button>,
      dettagli(a),
      modificabile && spostaScarta(a),
    ]
    return (
      <Box
        key={`riga-${a.id}`}
        flexDirection="column"
        borderStyle={conVelo ? 'round' : undefined}
        borderColor={conVelo ? allerta : undefined}
        borderDimColor={conVelo && !allerta}
        paddingX={conVelo ? 1 : 0}
      >
        {testa(
          `testa-${a.id}`,
          (
            <Text wrap="wrap">
              {modificabile ? <Text dimColor tabular>{`${lista.indexOf(a) + 1}  `}</Text> : ''}
              <Text weight="semibold">{a.titolo}</Text>
            </Text>
          ),
          [chipStato(a)],
        )}
        {infoLavoro(a)}
        {brief && (
          <Text size="caption" dimColor wrap="wrap">
            {corto(brief, Math.max(40, 2 * (colonne - 8)))}
          </Text>
        )}
        {a.stato === 'accodata' && a.motivoCoda && nota1(`coda-${a.id}`, STATO.coda, '◔', `In coda: ${T.m(letto(a.motivoCodice, a.motivoParametri, a.motivoCoda))}`)}
        {a.errore && nota1(`err-${a.id}`, STATO.attesa, '!', T.m(letto(a.erroreCodice, a.erroreParametri, a.errore)))}
        {bloccata && nota1(`blocco-${a.id}`, STATO.errore, '▲', `Non può partire: ${T.m(blocchi[0])}${blocchi.length > 1 ? ` (+${blocchi.length - 1})` : ''}`)}
        <Box key={`azioni-${a.id}`} flexDirection="row" flexWrap="wrap" columnGap={1} alignItems="center">
          {pulsanti as never}
        </Box>
        {bloccata && motiviAperti === a.id && motivi(a, blocchi, blocchi.length === 1 ? 'Il motivo' : `I ${blocchi.length} motivi`)}
      </Box>
    )
  }

  const mostrate = tutteLeSessioni ? righe : righe.slice(0, 6)

  const quando = (iso?: string) => {
    if (!iso) return '—'
    const ms = adesso - Date.parse(iso)
    return ms < 60_000 ? 'adesso' : durata(ms, T.lingua)
  }
  // «Al lavoro adesso» (C1.3): la tabella solo su `larga`; sotto, due righe per sessione (tre su `stretta`, col ramo).
  const COL = { lavoro: '30%', chi: '11%', modello: '14%', effort: '16%', stato: '11%', contesto: '9%', attivita: '9%' }
  const intestazione = (
    <Box key="tab-testa" flexDirection="row">
      {cella('h-lav', COL.lavoro, <Text size="caption" dimColor>Lavoro</Text>)}
      {cella('h-chi', COL.chi, <Text size="caption" dimColor>Chi</Text>)}
      {cella('h-mod', COL.modello, <Text size="caption" dimColor>Modello</Text>)}
      {cella('h-eff', COL.effort, <Text size="caption" dimColor>Effort</Text>)}
      {cella('h-st', COL.stato, <Text size="caption" dimColor>Stato</Text>)}
      {cella('h-ctx', COL.contesto, <Text size="caption" dimColor>Contesto</Text>, true)}
      {cella('h-att', COL.attivita, <Text size="caption" dimColor>Attività</Text>, true)}
    </Box>
  )
  /** Il titolo apre la sessione quando si può; una chip tiene «Dettagli» accanto. */
  const titoloSessione = (r: Riga) => {
    const testo = <Text weight="semibold" wrap="wrap">{r.titolo}</Text>
    const apribile = r.motore === 'claude' && !r.qui && !r.id.startsWith('chip-')
    // Solo chi ha chiesto l'avvio apre la sessione di una chip (l'app la affianca a questa).
    const sessioneChip = r.azione?.sessione && io && r.azione.lanciataDa === io.io ? r.azione.sessione : undefined
    const titolo = sessioneChip ? (
      <Button key={`vedi-${r.azione!.id}`} plain label={`Apri la sessione di ${r.titolo}`} onPress={fai(() => c.apri(sessioneChip))}>{testo}</Button>
    ) : apribile ? (
      <Button key={`apri-ses-${r.id}`} plain label={`Apri la sessione ${r.titolo}`} onPress={fai(() => c.apri(r.id))}>{testo}</Button>
    ) : r.azione ? (
      <Button key={`apri-${r.azione.id}`} plain label={`Dettagli di ${r.titolo}`} onPress={apriChiudi(r.azione.id)}>{testo}</Button>
    ) : (
      <Box key={`t-${r.id}`}>{testo}</Box>
    )
    // Una chip che aspetta te ha già la sua scheda, con queste azioni, in «Aspettano te».
    const a = r.azione && !aspettaTe(r.azione) ? r.azione : undefined
    const altri = [
      a?.stato === 'avviata' && (
        <Button key={`fatta-${a.id}`} plain label={`Segna completata ${breve(a)}`} onPress={completa(a)}>Segna completata</Button>
      ),
      a && (sessioneChip || apribile) && (
        <Button key={`mod-${a.id}`} plain dimColor label={`Dettagli ${breve(a)}`} onPress={apriChiudi(a.id)}>Dettagli</Button>
      ),
    ]
    return { titolo, altri }
  }
  const statoSessione = (r: Riga) => (
    <Text dimColor={r.stato === 'ignota'}>
      <Text color={r.colore}>{`${r.segno} `}</Text>
      {r.parola}
    </Text>
  )
  const chiSessione = (r: Riga) => (
    <Text>
      <Text color={MOTORE[r.motore]}>{'◆ '}</Text>
      {r.motore === 'codex' ? 'Codex' : 'Claude'}
    </Text>
  )
  const extraSessione = (r: Riga) => (r.qui ? 'questa sessione' : r.azione ? undefined : 'aperta a mano')

  const rigaTabella = (r: Riga) => {
    const seconda = [r.ramo, extraSessione(r)].filter(Boolean).join(' · ')
    const { titolo, altri } = titoloSessione(r)
    return (
      <Box key={`ses-${r.id}`} flexDirection="row">
        {cella(`c-lav-${r.id}`, COL.lavoro, [
          titolo,
          <Box key={`r2-${r.id}`} flexDirection="row" flexWrap="wrap" columnGap={1}>
            {seconda ? <Text size="caption" dimColor wrap="truncate-middle">{seconda}</Text> : null}
            {altri}
          </Box>,
        ])}
        {cella(`c-chi-${r.id}`, COL.chi, chiSessione(r))}
        {cella(`c-mod-${r.id}`, COL.modello, <Text wrap="wrap" dimColor={!r.modello}>{r.modello ? nomeModello(r.modello) : '—'}</Text>)}
        {cella(`c-eff-${r.id}`, COL.effort, r.effort ? <Text>{`${barreEffort(r.effort)} ${r.effort}`}</Text> : <Text dimColor>—</Text>)}
        {cella(`c-st-${r.id}`, COL.stato, statoSessione(r))}
        {cella(`c-ctx-${r.id}`, COL.contesto, <Text tabular dimColor={r.contesto === undefined}>{r.contesto === undefined ? '—' : `${r.contesto}%`}</Text>, true)}
        {cella(`c-att-${r.id}`, COL.attivita, <Text tabular dimColor>{r.qui ? 'adesso' : quando(r.attivita)}</Text>, true)}
      </Box>
    )
  }
  const rigaCompatta = (r: Riga) => {
    const { titolo, altri } = titoloSessione(r)
    const ramoSotto = classe === 'stretta' && !!r.ramo
    return (
      <Box key={`ses-${r.id}`} flexDirection="column">
        {testa(`ses1-${r.id}`, titolo, [statoSessione(r), ...altri])}
        {pezzi(`ses2-${r.id}`, [
          chiSessione(r),
          <Text dimColor={!r.modello}>{r.modello ? nomeModello(r.modello) : 'modello ignoto'}</Text>,
          r.effort && <Text>{`${barreEffort(r.effort)} ${r.effort}`}</Text>,
          r.contesto !== undefined && (
            <Text>
              <Text dimColor>{'contesto '}</Text>
              <Text tabular>{`${r.contesto}%`}</Text>
            </Text>
          ),
          <Text dimColor>{r.qui ? 'adesso' : quando(r.attivita)}</Text>,
          !ramoSotto && r.ramo && <Text dimColor>{r.ramo}</Text>,
          extraSessione(r) && <Text dimColor>{extraSessione(r)}</Text>,
        ])}
        {ramoSotto && (
          <Text size="caption" dimColor wrap="truncate-middle">
            {r.ramo}
          </Text>
        )}
      </Box>
    )
  }
  const rigaSessione = (r: Riga) => [classe === 'larga' ? rigaTabella(r) : rigaCompatta(r), r.azione && espansa === r.azione.id ? scheda(r.azione) : null]

  const attesaTe = visibili.filter(aspettaTe)
  const daAvviare = visibili.filter(a => a.stato === 'proposta' || a.stato === 'accodata')
  const daFondere = visibili.filter(a => a.stato === 'consegnata')

  // «Avvia la prossima» (C1.2): qui solo per annunciarla e dire perché nessuna parte, senza la corsia Codex della macchina
  // (leggerla a ogni disegno costa un processo). Alla pressione `avviaProssima` rifà il piano di «Avvia tutte» con la corsia
  // reale e avvia la prima, sotto la guardia atomica di sempre.
  const proposteOra = lista.filter(a => a.stato === 'proposta')
  const piano = proposteOra.length
    ? pianifica(proposteOra, tutte, regoleOra, c.max, false, x => violazioniAvvio(x, regoleOra, tutte, io), capacita.limiti)
    : undefined
  const prossima = piano?.avvia[0]
  const nessunaParte =
    piano && !prossima
      ? [...new Set([...piano.coda.map(x => T.m(x.motivo)), ...(piano.bloccate.length ? [`${piano.bloccate.length} ${piano.bloccate.length === 1 ? 'bloccata' : 'bloccate'} dalle regole`] : [])])]
      : []

  /** Barra di avanzamento: due Box in proporzione sul desktop, celle █ sul terminale. */
  const barra = (t: Traguardo) => {
    const pct = percentuale(t)
    const colore = pct >= 100 ? STATO.inCorso : STATO.coda
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
      <Box key={`barra-${t.numero}`} flexDirection="row" backgroundColor={velo(GRIGIO, '33')}>
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
      backgroundColor={conVelo ? velo(GRIGIO, '14') : undefined}
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
            <Box flexDirection="row" justifyContent="space-between" alignItems="flex-end" gap={1}>
              <Text weight="semibold" wrap="wrap">{t.titolo}</Text>
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
      {tr.errore && nota1('tr-err', STATO.attesa, '!', `Milestone non lette: ${tr.errore}`)}
    </Box>
  )

  const lavoro = (
    <Box key="vista-lavoro-corpo" flexDirection="column" gap={2}>
      {d.proposteAperte.length > 0 && (
        <Box key="proposte-pesi" flexDirection="column" gap={1}>
          {d.proposteAperte.map(p => d.rigaProposta('lavoro-pesi', p))}
        </Box>
      )}
      {senzaProgetto > 0 && (
        <Box key="senza-progetto" flexDirection="row" gap={1} alignItems="center" flexWrap="wrap">
          <Text>
            <Text color={STATO.coda}>{'◔ '}</Text>
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
          {attesaTe.map(schedaCompatta)}
        </Box>
      )}

      <Box key="sez-lavoro" flexDirection="column" gap={1}>
        <Box flexDirection="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
          {titoloSezione('t-lavoro', 'Al lavoro adesso', alLavoro)}
          {righe.length > 6 && (
            <Button key="tutte-sessioni" plain label={tutteLeSessioni ? 'Mostra meno' : `Mostra tutte · ${righe.length}`} onPress={() => void update($, tutteSessioni, v => !v)} />
          )}
        </Box>
        {righe.length === 0 ? (
          <Text dimColor>{ses.nota ? `Nessuna sessione letta: ${ses.nota}.` : 'Nessuna sessione di questo progetto nelle ultime 24 ore.'}</Text>
        ) : (
          <Box flexDirection="column" gap={1}>
            {classe === 'larga' && intestazione}
            {mostrate.flatMap(rigaSessione)}
          </Box>
        )}
        {righe.length > 0 && ses.nota && <Text size="caption" dimColor>{`Lettura parziale: ${ses.nota}.`}</Text>}
      </Box>

      <Box key="sez-avvio" flexDirection="column" gap={1}>
        {ui.Riga({
          chiave: 'testa-avvio',
          classe,
          principale: titoloSezione('t-avvio', 'Da avviare e in coda', daAvviare.length),
          azioni: [
            prossima && (
              <Button key="prossima" variant="secondary" hotkey="n" label={`Avvia la prossima: ${corto(prossima.titolo, 32)}`} onPress={fai(() => c.avviaProssima(prossima.id))} />
            ),
            proposte > 0 && <Button key="tutte" variant="primary" hotkey="a" label={`Avvia tutte · ${proposte}`} onPress={fai(c.avviaTutte)} />,
          ],
        })}
        {nessunaParte.length > 0 && nota1('nessuna-parte', STATO.attesa, '◔', `Nessuna parte adesso: ${nessunaParte.join(' · ')}`)}
        {daAvviare.length === 0 ? (
          <Text dimColor>
            {lista.length === 0
              ? 'Quando una sessione suggerisce un\'azione con suggerisci_azione, la trovi qui pronta da rivedere e avviare.'
              : 'Niente da avviare.'}
          </Text>
        ) : (
          daAvviare.map(schedaCompatta)
        )}
        {proposte > 0 && <Text size="caption" dimColor>{`al massimo ${c.max} in parallelo · regole da ${d.fonteRegole}`}</Text>}
      </Box>

      {daFondere.length > 0 && (
        <Box key="sez-fondere" flexDirection="column" gap={1}>
          {titoloSezione('t-fondere', 'Da fondere', daFondere.length)}
          {daFondere.map(schedaCompatta)}
        </Box>
      )}
      {footer}
    </Box>
  )
  return lavoro
}
