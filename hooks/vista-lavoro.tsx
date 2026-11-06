// Vista Lavoro: chi aspetta una decisione, chi lavora adesso, cosa c'è da avviare e da fondere, il rilascio.
import { atom, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { Azione, Contesto, Corsia, Destinazione, Motore, Permessi, Revisore, Traguardo } from '../types'
import {
  barreEffort,
  BASE_RE,
  blocca,
  COLORE_EFFORT,
  COLORE_MODELLO,
  COLORE_MOTORE,
  COLORE_STATO,
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
import type { Dati } from './pannello'

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
  const { c, Select, Input, conVelo, stretto, io, tutte, senzaProgetto, ses, tutteLeSessioni, regoleOra,
    testoFiltro, lista, visibili, espansa, stati, tr, adesso, boardPronta, fai, modifica, completa,
    apriChiudi, ferma, statoDi, etichetta, nota1, proposte, tentativoAnnullabile, aspettaTe, titoloSezione, righe,
    alLavoro, cella, MOTORI, motore, oraDi } = d
  const { Box, Text, Button } = d.el
  type Riga = Dati['righe'][number]

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
                onPress={modifica(a, { ...transizione(a, 'proposta', new Date(adesso).toISOString()), motivoCoda: undefined })}
              />
            )}
            {(a.stato === 'avviata' || a.stato === 'consegnata') && a.sessione && mia && (
              <Button key={`vedi-${a.id}`} variant="secondary" label="Apri" onPress={fai(() => c.apri(a.sessione!))} />
            )}
            {(a.stato === 'avviata' || a.stato === 'consegnata') && (
              <Button key={`fatta-${a.id}`} plain label="Segna completata" onPress={completa(a)} />
            )}
            {boardPronta && <Button key={`board-${a.id}`} plain label="Nella board" onPress={fai(c.apriBoard)} />}
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
              <Button key={`annulla-${a.id}`} plain label="Togli dalla coda" onPress={modifica(a, { ...transizione(a, 'proposta', new Date(adesso).toISOString()), motivoCoda: undefined })} />
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
          <Button key={`fatta-${a.id}`} plain label="Segna completata" onPress={completa(a)} />
          {dettagli(a)}
        </Box>
      </Box>
    )
  }


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
  return lavoro
}
