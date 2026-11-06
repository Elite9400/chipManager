// Vista Lavoro: chi aspetta una decisione, chi lavora adesso, cosa c'è da avviare e da fondere, il rilascio.
import { atom, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { Azione, Contesto, Corsia, Destinazione, Motore, Permessi, Revisore, Traguardo } from '../types'
import {
  barreEffort,
  BASE_RE,
  blocca,
  CORSIE,
  conDestinazione,
  consigliaDove,
  corsiaDi,
  cartellaCondivisa,
  destinazioniPer,
  dipendenze,
  durata,
  effortDi,
  effortPer,
  FASI,
  auditorDi,
  idAuditor,
  modelloDi,
  motivoAuditor,
  piuPieno,
  profiloDi,
  puoCambiare,
  revisoreConcreto,
  nomeModello,
  percentuale,
  pianifica,
  pianoValido,
  PERMESSI,
  RAMO_RE,
  sensibile,
  statoAuditor,
  stimaArrivo,
  taskAccertato,
  transizione,
  velo,
  violazioniAvvio,
} from './logica'
import { letto, msg, msgDi, salvato } from './lingua'
import type { Msg } from './lingua'
import type { Dati } from './pannello'
import { diversoDa, presetChi, PRESET_CHI, PROFILI } from './bilanciamento'
import type { PresetChi } from './bilanciamento'
import { ACCENTO, GRIGIO, MOTORE, STATO, VELO } from './tema'

// Copia identica degli atomi di register.tsx (lo scanner li vuole nel file che li usa).
const avviso = atom({ plugin: 'chip-manager', key: 'avviso' } as const, null as Msg | string | null)
const filtro = atom({ plugin: 'chip-manager', key: 'filtro' } as const, '')
const tutteSessioni = atom({ plugin: 'chip-manager', key: 'tutteSessioni' } as const, false)
const selezionate = atom({ plugin: 'chip-manager', key: 'selezionate' } as const, [] as string[], { shape: 'selezionate-1' })
const anteprimaChi = atom({ plugin: 'chip-manager', key: 'anteprimaChi' } as const, null as { id: string; preset: PresetChi } | null, { shape: 'anteprima-chi-1' })
const dettagliChi = atom({ plugin: 'chip-manager', key: 'dettagliChi' } as const, null as string | null)
const PRESET_TESTO: Record<PresetChi, 'chi.consigliato' | 'chi.economico' | 'chi.qualita'> = { consigliato: 'chi.consigliato', economico: 'chi.economico', qualita: 'chi.qualita' }
const ALIAS_AUDITOR = ['sonnet', 'opus', 'fable']

const REVISORI = ['claude', 'codex', 'nessuno'] as const
const DESTINAZIONI_UI: readonly Destinazione[] = ['local', 'cloud', 'api-claude']
const NOME_DOVE: Record<Destinazione, 'ed.locale' | 'ed.cloud' | 'ed.apiClaude'> = { local: 'ed.locale', cloud: 'ed.cloud', 'api-claude': 'ed.apiClaude' }
const BREVE_DOVE: Record<Destinazione, 'op.locale' | 'op.cloud' | 'op.apiClaude'> = { local: 'op.locale', cloud: 'op.cloud', 'api-claude': 'op.apiClaude' }
const corto = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

// `$` resta un argomento: lo scanner non lo vuole dentro un oggetto.
export function vistaLavoro($: EngineInterface, d: Dati) {
  const { T, c, Select, Input, conVelo, classe, colonne, ui, io, tutte, senzaProgetto, ses, tutteLeSessioni, regoleOra,
    testoFiltro, lista, visibili, espansa, motiviAperti, scelte, lockApiOra, stati, tr, adesso, capacita, boardPronta, fai, modifica, completa,
    apriChiudi, apriPerche, ferma, statoDi, nota1, proposte, tentativoAnnullabile, aspettaTe, titoloSezione, righe,
    alLavoro, cella, MOTORI, motore, oraDi } = d
  const { Box, Text, Button } = d.el
  type Riga = Dati['righe'][number]
  /**
   * F8.2: sotto il puntatore una riga (chip, sessione) prende un velo d'accento basso; cambia solo lo sfondo. Il terminale
   * non ha hover: niente, e nessuna azione dipende da esso. Le azioni secondarie restano `dimColor`, che l'host porta a
   * piena intensità sotto il puntatore o con il fuoco.
   */
  const sotto = conVelo ? { backgroundColor: velo(ACCENTO, VELO.hover) } : undefined
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

  /** F7.4: chi lavora in stile developer. Larga: una riga; stretta: esecutore · modello · effort, poi auditor · revisore · corsia. */
  const riepilogo = (a: Azione, k: string, motivo?: string) => {
    const modello = modelloDi(a, regoleOra)
    const eff = effortDi(a, regoleOra)
    const rev = revisoreConcreto(a, regoleOra)
    const riga1 = [motore(a.esecutore), a.esecutore === 'claude' || modello ? nomeModello(modello) : '', `${barreEffort(eff)} ${eff}`].filter(Boolean).join(' · ')
    const riga2 = [
      auditorDi(a) ? T('chi.auditor', { auditor: nomeModello(idAuditor(auditorDi(a)!) ?? auditorDi(a)!) }) : T('chi.senzaAuditor'),
      a.revisore === 'nessuno' ? T('chi.senzaRev') : T('chi.rev', { revisore: rev === 'motore:codex' ? 'Codex' : rev ? nomeModello(rev) : motore(a.revisore) }),
      corsiaDi(a, regoleOra) ?? T('ed.corsiaNessuna'),
    ].join(' · ')
    return (
      <Box key={k} flexDirection="column">
        {classe === 'stretta' ? [
          <Text key={`${k}-1`} mono wrap="wrap">{riga1}</Text>,
          <Text key={`${k}-2`} mono wrap="wrap">{riga2}</Text>,
        ] : <Text key={`${k}-1`} mono wrap="wrap">{`${riga1} · ${riga2}`}</Text>}
        {motivo ? <Text key={`${k}-motivo`} size="caption" dimColor wrap="wrap">{motivo}</Text> : null}
      </Box>
    )
  }
  /** Il motivo della scelta consigliata: corsia, profilo e, se letto, il piano Claude più pieno. */
  const motivoConsigliato = (a: Azione) => {
    const nome = PROFILI.find(p => p.id === profiloDi(regoleOra.risorse))?.nome
    const pct = piuPieno(d.limiti, 'claude', adesso)?.percentuale
    return [T('chi.motivo', { corsia: corsiaDi(a, regoleOra) ?? '—', profilo: nome ? T(nome) : '—' }), pct !== undefined ? T('chi.motivoPiano', { pct: Math.round(pct) }) : ''].filter(Boolean).join(' · ')
  }
  /** Con un nuovo esecutore o modello l'auditor si ricontrolla: se non è più una coppia valida torna a «nessuno», e lo si dice. */
  const conAuditorValido = (a: Azione, campi: Partial<Azione>): Partial<Azione> => {
    const n = { ...a, ...campi }
    const aud = auditorDi(n)
    if (!aud || (n.esecutore === 'claude' && !motivoAuditor(modelloDi(n, regoleOra), aud))) return campi
    $.ui.toast(T('au.tolto', { auditor: aud }))
    return { ...campi, auditor: undefined, senzaAuditor: undefined }
  }
  /**
   * F7.4 «Chi lavora»: il riepilogo sempre visibile; i preset (Consigliato, Economico, Qualità) con l'anteprima prima di
   * applicarli; «modificato» con «Ripristina consigliato»; i «Dettagli», chiusi per default, con ogni scelta e il suo motivo.
   */
  const chiLavora = (a: Azione, modello: string) => {
    const ant = d.anteprimaChiOra?.id === a.id ? d.anteprimaChiOra.preset : undefined
    const cons = io ? presetChi(a, 'consigliato', regoleOra, d.limiti, tutte, io) : undefined
    const prev = io && ant ? presetChi(a, ant, regoleOra, d.limiti, tutte, io) : undefined
    const aperti = d.dettagliChiOra === a.id
    const corsia = corsiaDi(a, regoleOra)
    const auditorNo = a.esecutore === 'claude' ? ALIAS_AUDITOR.map(x => ({ x, motivo: motivoAuditor(modello, x) })) : []
    return (
      <Box key={`g-mot-${a.id}`} flexDirection="column" gap={1}>
        <Text size="caption" weight="medium" dimColor>{T('ed.chiLavora')}</Text>
        {riepilogo(prev ? { ...a, ...prev.campi } : a, `chi-riepilogo-${a.id}`, prev ? T('chi.anteprima') : motivoConsigliato(a))}
        {cons && !prev && diversoDa(a, cons.campi, regoleOra) && (
          <Box key={`chi-modificato-${a.id}`} flexDirection="row" flexWrap="wrap" columnGap={1} alignItems="center">
            {nota1(`chi-modificato-${a.id}-testo`, STATO.attesa, '◆', T('chi.modificato'))}
            <Button key={`chi-ripristina-${a.id}`} plain label={`${T('chi.ripristina')} ${breve(a)}`} onPress={modifica(a, { ...cons.campi, senzaAuditor: undefined })}>{T('chi.ripristina')}</Button>
          </Box>
        )}
        {cons && ui.GruppoChip({
          chiave: `preset-${a.id}`, etichetta: T('chi.preset'), modo: 'scelta', valore: ant ?? '',
          voci: PRESET_CHI.map(p => ({ valore: p, testo: T(PRESET_TESTO[p]) })),
          onCambia: v => void update($, anteprimaChi, () => ({ id: a.id, preset: v as PresetChi })),
        })}
        {prev && (
          <Box key={`chi-anteprima-${a.id}`} flexDirection="column">
            {prev.auditorTolto ? <Text key={`chi-tolto-${a.id}`} size="caption" dimColor wrap="wrap">{T('au.tolto', { auditor: prev.auditorTolto })}</Text> : null}
            {auditorDi(prev.campi) && !auditorDi(a) ? <Text key={`chi-costo-${a.id}`} size="caption" dimColor wrap="wrap">{T('chi.costoAuditor')}</Text> : null}
            <Box key={`chi-anteprima-${a.id}-pulsanti`} flexDirection="row" flexWrap="wrap" columnGap={1}>
              <Button key={`preset-applica-${a.id}`} variant="secondary" label={`${T('chi.applica')} ${breve(a)}`}
                onPress={fai(async () => {
                  await c.salva({ ...a, ...prev.campi, senzaAuditor: undefined })
                  await update($, anteprimaChi, () => null)
                })}>
                {T('chi.applica')}
              </Button>
              <Button key={`preset-annulla-${a.id}`} plain dimColor label={`${T('comune.annulla')} ${breve(a)}`} onPress={() => void update($, anteprimaChi, () => null)}>{T('comune.annulla')}</Button>
            </Box>
          </Box>
        )}
        <Button key={`chi-dettagli-${a.id}`} plain label={`${T(aperti ? 'chi.chiudiDettagli' : 'chi.dettagli')} ${breve(a)}`} onPress={() => void update($, dettagliChi, x => (x === a.id ? null : a.id))}>
          {T(aperti ? 'chi.chiudiDettagli' : 'chi.dettagli')}
        </Button>
        {/* F8.4: i dettagli senza un secondo titolo (il pulsante lo dice già) e senza righe vuote fra le scelte. */}
        {aperti && dettagliChiLavora(`g-chi-dettagli-${a.id}`, [
          scelta(a, 'esec', T('ed.esecutore'), a.esecutore, MOTORI.filter(m => regoleOra.risorse.fornitori.includes(m)).map(m => ({ value: m, label: motore(m) })), v =>
            conAuditorValido(a, { esecutore: v as Motore, modello: undefined, effort: undefined })),
          scelta(a, 'mod', T('ed.modello'), modello, regoleOra.modelli[a.esecutore].map(m => ({ value: m, label: nomeModello(m) })), v => conAuditorValido(a, { modello: v })),
          scelta(a, 'eff', T('ed.effort'), effortDi(a, regoleOra), effortPer(regoleOra, modello).map(m => ({ value: m, label: `${barreEffort(m)}  ${m}` })), v => ({ effort: v })),
          // L'auditor: solo le coppie della tabella; le altre si vedono sotto con il motivo.
          a.esecutore === 'claude' && scelta(a, 'aud', T('chi.auditorScelta'), a.auditor ?? 'nessuno', [
            { value: 'nessuno', label: T('chi.senzaAuditor') },
            ...auditorNo.filter(x => !x.motivo).map(x => ({ value: x.x, label: nomeModello(idAuditor(x.x)!) })),
            ...(auditorDi(a) && !ALIAS_AUDITOR.includes(a.auditor!) ? [{ value: a.auditor!, label: nomeModello(a.auditor!) }] : []),
          ], v => ({ auditor: v, senzaAuditor: undefined })),
          ...auditorNo.filter(x => x.motivo).map(x => (
            <Text key={`aud-no-${x.x}-${a.id}`} size="caption" dimColor wrap="wrap">{T.m(x.motivo!)}</Text>
          )),
          scelta(a, 'rev', T('ed.revisore'), a.revisore, REVISORI.map(m => ({ value: m, label: motore(m) })), v => ({ revisore: v as Revisore })),
          scelta(
            a,
            'cor',
            T('ed.corsia'),
            corsia ?? 'nessuna',
            [{ value: 'nessuna', label: T('ed.corsiaNessuna') }, ...CORSIE.map(k => ({ value: k, label: k }))].filter(
              // Su un'azione sensibile le corsie sotto R4 non si possono scegliere: non spariscono le regole.
              o => !sensibile({ ...a, corsia: undefined }, regoleOra) || o.value === 'R4' || o.value === 'R5',
            ),
            v => ({ corsia: v === 'nessuna' ? undefined : (v as Corsia) }),
          ),
          corsia ? <Text key={`cor-legenda-${a.id}`} size="caption" dimColor wrap="wrap">{T(`legenda.${corsia.toLowerCase() as 'r0'}`)}</Text> : null,
        ])}
      </Box>
    )
  }
  /** F7.4: lo stesso blocco in sola lettura per una sessione al lavoro, con «Cambia» (F7.2) dove l'app lo permette. */
  const chiLavoraSola = (a: Azione) => {
    const modello = modelloDi(a, regoleOra)
    const cambio = a.cambio
    return (
      <Box key={`chi-sola-${a.id}`} flexDirection="column">
        {riepilogo(a, `chi-sola-riepilogo-${a.id}`)}
        {(puoCambiare(a, io, 'modello') || puoCambiare(a, io, 'effort')) && (
          <Box key={`cambia-${a.id}`} flexDirection="row" flexWrap="wrap" columnGap={1} alignItems="center">
            {puoCambiare(a, io, 'modello') && Select && (
              <Select key={`cambia-mod-${a.id}`} label={T('cambia.modello')} value={modello} options={regoleOra.modelli.claude.map(m => ({ value: m, label: nomeModello(m) }))}
                onSelect={v => void fai(() => c.cambiaSessione(a, 'modello', v))()} />
            )}
            {puoCambiare(a, io, 'effort') && Select && (
              <Select key={`cambia-eff-${a.id}`} label={T('cambia.effort')} value={effortDi(a, regoleOra)} options={effortPer(regoleOra, modello).map(m => ({ value: m, label: `${barreEffort(m)}  ${m}` }))}
                onSelect={v => void fai(() => c.cambiaSessione(a, 'effort', v))()} />
            )}
          </Box>
        )}
        {cambio?.esito === 'incerto' && (
          <Box key={`cambio-${a.id}`} flexDirection="row" flexWrap="wrap" columnGap={1} alignItems="center">
            {nota1(`cambio-${a.id}-testo`, STATO.attesa, '?', T('cambia.esitoIncerto', { valore: cambio.campo === 'modello' ? nomeModello(cambio.valore) : cambio.valore }))}
            <Button key={`cambia-ricontrolla-${a.id}`} plain label={`${T('ese.ricontrolla')} ${breve(a)}`} onPress={fai(() => c.ricontrollaCambio(a))}>{T('ese.ricontrolla')}</Button>
          </Box>
        )}
      </Box>
    )
  }

  const dettagliChiLavora = (k: string, figli: unknown[]) => (
    <Box key={k} flexDirection="column">
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
        backgroundColor={conVelo ? velo(GRIGIO, VELO.riquadro) : undefined}
        borderStyle={conVelo ? undefined : 'single'}
        borderDimColor
      >
        {chiLavora(a, modello)}
        {gruppo(`g-ses-${a.id}`, T('ed.comeParte'), [
          // F6.1: le destinazioni ammesse si scelgono; le altre si mostrano sotto, ciascuna con il suo motivo.
          scelta(
            a,
            'dest',
            T('ed.dove'),
            a.destinazione ?? 'local',
            destinazioniPer(a, regoleOra, tutte)
              .filter(x => !x.motivo || x.d === (a.destinazione ?? 'local'))
              .map(x => ({ value: x.d, label: T(NOME_DOVE[x.d]) })),
            v => ({ destinazione: v as Destinazione, contesto: conDestinazione(a, v as Destinazione).contesto }),
          ),
          ...destinazioniPer(a, regoleOra, tutte)
            .filter(x => x.motivo && x.d !== (a.destinazione ?? 'local'))
            .map(x => (
              <Text key={`dove-no-${x.d}-${a.id}`} size="caption" dimColor wrap="wrap">
                {T('dove.no', { dove: T(NOME_DOVE[x.d]), motivo: T.m(x.motivo!) })}
              </Text>
            )),
          scelta(
            a,
            'ctx',
            T('ed.contesto'),
            a.contesto ?? 'fresh',
            [
              { value: 'fresh', label: T('ed.fresh') },
              ...(a.destinazione === 'cloud' ? [] : [{ value: 'fork', label: T('ed.fork') }]),
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
              T('ed.cartella'),
              a.worktree === false ? 'no' : 'si',
              [
                { value: 'si', label: T('ed.worktree') },
                { value: 'no', label: T('ed.condivisa') },
              ],
              v => ({ worktree: v === 'si' }),
            ),
          a.destinazione !== 'cloud' &&
            scelta(
              a,
              'perm',
              T('ed.permessi'),
              a.permessi ?? 'eredita',
              PERMESSI.filter(p => !sensibile(a, regoleOra) || p.value !== 'bypassPermissions').map(p =>
                p.value === 'eredita' && sensibile(a, regoleOra) ? { value: 'eredita', label: T('ed.permessiSensibili') } : { ...p, label: T(p.label) },
              ),
              v => ({ permessi: v === 'eredita' ? undefined : (v as Permessi) }),
            ),
          a.destinazione !== 'cloud' &&
            scelta(
              a,
              'sv',
              T('ed.risveglio'),
              a.sveglia ? 'si' : 'no',
              [
                { value: 'no', label: T('ed.risveglioNo') },
                { value: 'si', label: T('ed.risveglioSi') },
              ],
              v => ({ sveglia: v === 'si' }),
            ),
        ])}
        {Input &&
          gruppo(`g-txt-${a.id}`, T('ed.ramoTesti'), [
            a.destinazione !== 'cloud' && a.contesto !== 'fork' && a.worktree !== false && (
              <Input
                key={`ramo-${a.id}`}
                label={T('ed.ramo')}
                placeholder={T('ed.ramoEsempio')}
                value={a.ramo ?? ''}
                submitLabel={T('ed.salva')}
                onSubmit={v => {
                  const t = v.trim()
                  if (t && !RAMO_RE.test(t)) return void update($, avviso, () => msg('ed.ramoNonValido'))
                  void modifica(a, { ramo: t || undefined })()
                }}
              />
            ),
            a.destinazione !== 'cloud' && a.contesto !== 'fork' && a.worktree !== false && (
              <Input
                key={`base-${a.id}`}
                label={T('ed.base')}
                placeholder={T('ed.baseEsempio')}
                value={a.base ?? ''}
                submitLabel={T('ed.salva')}
                onSubmit={v => {
                  const t = v.trim()
                  if (t && !BASE_RE.test(t)) return void update($, avviso, () => msg('ed.baseNonValida'))
                  void modifica(a, { base: t || undefined })()
                }}
              />
            ),
            <Input
              key={`piano-${a.id}`}
              label={T('ed.piano')}
              placeholder={T('ed.pianoEsempio')}
              value={a.piano ?? ''}
              submitLabel={T('ed.salva')}
              onSubmit={v => {
                const t = v.trim()
                const no = t ? pianoValido(t) : undefined
                if (no) return void update($, avviso, () => no)
                void modifica(a, { piano: t || undefined })()
              }}
            />,
            <Input
              key={`tit-${a.id}`}
              label={T('ed.titolo')}
              value={a.titolo}
              submitLabel={T('ed.salva')}
              onSubmit={v => void (v.trim() ? modifica(a, { titolo: v.trim().slice(0, 200) })() : undefined)}
            />,
            <Input
              key={`brief-${a.id}`}
              label={T('ed.mandato')}
              rows={8}
              value={a.brief}
              submitLabel={T('ed.salva')}
              onSubmit={v => void (v.trim() ? modifica(a, { brief: v })() : undefined)}
            />,
          ])}
      </Box>
    )
  }

  const opzioni = (a: Azione) =>
    [
      corsiaDi(a, regoleOra) ? T('op.corsia', { corsia: corsiaDi(a, regoleOra)! }) : undefined,
      T(BREVE_DOVE[a.destinazione ?? 'local']),
      a.destinazione === 'cloud' ? undefined : a.contesto === 'fork' ? 'fork' : T('op.nuova'),
      a.destinazione === 'cloud' || a.contesto === 'fork'
        ? undefined
        : a.worktree === false
          ? T('op.condivisa')
          : `worktree${a.ramo ? ` ${a.ramo}` : ''}${a.base ? ` ${T('op.da', { base: a.base })}` : ''}`,
      a.destinazione === 'cloud'
        ? undefined
        : T(a.permessi ? `permessi.${a.permessi}` as const : sensibile(a, regoleOra) ? 'permessi.acceptEdits' : 'permessi.eredita').toLowerCase(),
      a.sveglia ? T('op.sveglia') : undefined,
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
            ? T('reg.condivisa')
            : !a.issue
              ? T('reg.senzaIssue')
              : a.taskId && !taskAccertato(a, tutte)
                ? T('reg.nonDimostrabile')
                : T('reg.nessunTask', { issue: String(a.issue) })}
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
              <Text dimColor={!qui} bold={qui}>{`${i > pos ? '✓ ' : ''}${T(`fase.${f}`)}`}</Text>
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
      <Text mono>{nomeModello(modelloDi(a, regoleOra))}</Text>,
      <Text mono>{`${barreEffort(effort)} ${effort}`}</Text>,
      <Text>{a.revisore === 'nessuno' ? T('info.senzaRevisione') : T('info.rivede', { motore: motore(a.revisore) })}</Text>,
      sensibile(a, regoleOra) ? <Text><Text color={STATO.errore}>{'▲ '}</Text>{T('info.sensibile', { corsia: corsia ?? 'R4' })}</Text> : corsia && <Text mono>{corsia}</Text>,
      a.issue && <Text mono>{`#${a.issue}`}</Text>,
      ms && <Text>{`◎ ${corto(ms.titolo, 28)}`}</Text>,
      prima.length > 0 && <Text>{T('info.dopo', { titoli: corto(prima.join(T('info.separatore')), 40) })}</Text>,
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
        hover={sotto}
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
            <Button key={`apri-${a.id}`} plain label={T(aperto ? 'az.chiudiDettagli' : 'az.apriDettagli', { titolo: a.titolo })} onPress={apriChiudi(a.id)}>
              <Text dimColor tabular>{`${lista.indexOf(a) + 1}  `}</Text>
              <Text weight="semibold" bold>
                {a.titolo}
              </Text>
            </Button>
          ),
          [chipStato(a)],
        )}
        {infoLavoro(a)}
        {consiglioRiga(a)}
        {auditorRiga(a)}
        {a.stato === 'avviata' && chiLavoraSola(a)}
        <Text dimColor size="caption" wrap="wrap">
          {opzioni(a)}
        </Text>
        {a.dipende.length > 0 &&
          nota1(
            `dip-${a.id}`,
            dip.chiuse ? STATO.inCorso : STATO.coda,
            dip.chiuse ? '✓' : '◔',
            T(dip.chiuse ? 'info.dipFuse' : 'info.dipAttesa', { titoli: a.dipende.map(d => tutte.find(x => x.id === d)?.titolo ?? d).join(', ') }),
          )}
        {sblocca > 0 && (
          <Text size="caption" dimColor>
            {T('info.sblocca', { n: sblocca })}
          </Text>
        )}
        {a.stato === 'accodata' && a.motivoCoda && nota1(`coda-${a.id}`, STATO.coda, '◔', T('info.inCoda', { motivo: T.m(letto(a.motivoCodice, a.motivoParametri, a.motivoCoda)) }))}
        {a.contesto === 'fork' && a.origineFork && (
          <Text size="caption" dimColor>
            {a.origineFork === io?.io
              ? T('info.forkQui')
              : T('info.forkAltrui', { nome: a.origineNome ?? `${a.origineFork.slice(0, 8)}…` })}
          </Text>
        )}
        {blocchi.length > 0 && motivi(a, blocchi, T('motivi.cosi'))}
        {(a.stato === 'avviata' || a.stato === 'consegnata') && pipeline(a, vita?.fase)}
        {(a.stato === 'avviata' || a.stato === 'consegnata') && (
          <Text size="caption" dimColor mono wrap="wrap">
            {[
              a.avviataIl ? T('info.da', { durata: durata(adesso - Date.parse(a.avviataIl), T.lingua) }) : undefined,
              vita?.ultimaAttivita ? T('info.ultimaAttivita', { durata: durata(adesso - Date.parse(vita.ultimaAttivita), T.lingua) }) : undefined,
              vita?.ramo,
              // F6.2: il costo stimato di un'esecuzione a crediti API (ignoto = conta il tetto intero).
              a.lanciatore === 'api-claude' && a.costoApi !== undefined
                ? a.costoApi === null ? T('info.costoApiIgnoto') : T('info.costoApi', { costo: T.numero(a.costoApi, 2) })
                : undefined,
              a.sessione && !mia ? T('info.barraLaterale') : undefined,
            ]
              .filter(Boolean)
              .join(' · ') || ' '}
          </Text>
        )}
        {a.errore && nota1(`err-${a.id}`, STATO.attesa, '!', T.m(letto(a.erroreCodice, a.erroreParametri, a.errore)))}
        {a.risultato && <Box flexDirection="column" borderStyle="single" paddingX={1}><Text weight="semibold">{T('info.bozza')}</Text><Text>{a.risultato}</Text></Box>}
        <Box flexDirection="row" gap={1} flexWrap="wrap" justifyContent="space-between" alignItems="center">
          <Box flexDirection="row" gap={1} flexWrap="wrap">
            {a.stato === 'proposta' && blocchi.length === 0 && (
              <Button key={`avvia-${a.id}`} variant="secondary" label={`${dip.chiuse ? T('az.avvia') : T('az.accoda')} ${breve(a)}`} onPress={fai(() => c.avvia(a))}>
                {dip.chiuse ? T('az.avvia') : T('az.accoda')}
              </Button>
            )}
            {a.stato === 'proposta' && dip.chiuse && bloccatoQui.length === 0 && (
              <Button key={`qui-${a.id}`} plain label={`${T('az.qui')} ${breve(a)}`} onPress={fai(() => c.faiQui(a))}>{T('az.qui')}</Button>
            )}
            {a.stato === 'fallita' && blocchi.length === 0 && (
              <Button key={`riprova-${a.id}`} variant="secondary" label={`${T('az.riprova')} ${breve(a)}`} onPress={fai(() => c.avvia(a))}>
                {T('az.riprova')}
              </Button>
            )}
            {a.stato === 'fallita' && blocchi.length === 0 && io?.lanciatore !== 'cli' && a.esecutore !== 'freellmapi' && (
              <Button key={`chiedi-${a.id}`} plain label={`${T('az.chiedi')} ${breve(a)}`} onPress={fai(() => c.chiediQui(a))}>{T('az.chiedi')}</Button>
            )}
            {tentativoAnnullabile(a) && (
              <Button key={`annullaT-${a.id}`} plain label={`${T('az.annullaTentativo')} ${breve(a)}`} onPress={fai(() => c.annullaTentativo(a))}>{T('az.annullaTentativo')}</Button>
            )}
            {a.stato === 'accodata' && (
              <Button
                key={`annulla-${a.id}`}
                variant="secondary"
                label={`${T('az.togliCoda')} ${breve(a)}`}
                onPress={modifica(a, { ...transizione(a, 'proposta', new Date(adesso).toISOString()), ...salvato('motivoCoda', 'motivo', undefined) })}
              >
                {T('az.togliCoda')}
              </Button>
            )}
            {(a.stato === 'avviata' || a.stato === 'consegnata') && a.sessione && mia && (
              <Button key={`vedi-${a.id}`} variant="secondary" label={`${T('az.apri')} ${breve(a)}`} onPress={fai(() => c.apri(a.sessione!))}>{T('az.apri')}</Button>
            )}
            {(a.stato === 'avviata' || a.stato === 'consegnata') && (
              <Button key={`fatta-${a.id}`} plain label={`${T('az.completata')} ${breve(a)}`} onPress={completa(a)}>{T('az.completata')}</Button>
            )}
            {boardPronta && <Button key={`board-${a.id}`} plain label={T('az.nellaBoard')} onPress={fai(c.apriBoard)} />}
            {modificabile && <Button key={`mod-${a.id}`} plain label={`${T(aperto ? 'az.chiudi' : 'az.modifica')} ${breve(a)}`} onPress={apriChiudi(a.id)}>{T(aperto ? 'az.chiudi' : 'az.modifica')}</Button>}
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
    <Button key={`mod-${a.id}`} plain label={`${T('az.dettagli')} ${breve(a)}`} onPress={apriChiudi(a.id)}>
      {T('az.dettagli')}
    </Button>
  )
  function spostaScarta(a: Azione) {
    // F6.1: accesso rapido a «Dove» (passa alla prossima destinazione ammessa) e scelta della chip per «Dove…» su più chip.
    const ora = a.destinazione ?? 'local'
    const ammesse = destinazioniPer(a, regoleOra, tutte).filter(x => !x.motivo).map(x => x.d)
    const prossima = ammesse.length > 1 ? ammesse[(ammesse.indexOf(ora) + 1) % ammesse.length] : undefined
    const scelta = scelte.includes(a.id)
    return (
      <Box key={`ordine-${a.id}`} flexDirection="row" flexWrap="wrap" columnGap={1}>
        {prossima && (
          <Button key={`dove-${a.id}`} plain dimColor label={`${T('az.dove', { dove: T(BREVE_DOVE[ora]) })} ${breve(a)}`} onPress={modifica(a, conDestinazione(a, prossima))}>
            {T('az.dove', { dove: T(BREVE_DOVE[ora]) })}
          </Button>
        )}
        <Button
          key={`sel-${a.id}`}
          plain
          dimColor={!scelta}
          label={`${T(scelta ? 'az.deseleziona' : 'az.seleziona')} ${breve(a)}`}
          onPress={() => void update($, selezionate, s => (s.includes(a.id) ? s.filter(x => x !== a.id) : [...s, a.id]))}
        >
          {scelta ? '☑' : '☐'}
        </Button>
        <Button key={`su-${a.id}`} plain dimColor label={`↑ ${breve(a)}`} onPress={fai(() => c.riordina(a.id, -1))}>
          ↑
        </Button>
        <Button key={`giu-${a.id}`} plain dimColor label={`↓ ${breve(a)}`} onPress={fai(() => c.riordina(a.id, 1))}>
          ↓
        </Button>
        <Button key={`scarta-${a.id}`} plain dimColor label={`${T('az.scarta')} ${breve(a)}`} onPress={fai(() => c.scarta(a))}>
          {T('az.scarta')}
        </Button>
      </Box>
    )
  }
  /**
   * F6.1 «Dove…» su più chip: la stessa destinazione a tutte le scelte modificabili. Quelle per cui non è ammessa restano
   * dove sono, e lo si dice con il motivo. Ogni cambio è una scrittura CAS del record: le conferme già date decadono.
   */
  async function doveTutte(d: Destinazione) {
    const scelteOra = tutte.filter(a => scelte.includes(a.id))
    let spostate = 0
    const restano: string[] = []
    const fallite: string[] = []
    for (const a of scelteOra) {
      const motivo = !['proposta', 'accodata', 'fallita'].includes(a.stato) ? msg('dove.statoFisso') : destinazioniPer(a, regoleOra, tutte).find(x => x.d === d)?.motivo
      if (motivo) restano.push(T('dove.resta', { titolo: corto(a.titolo, 32), motivo: T.m(motivo) }))
      else if ((a.destinazione ?? 'local') !== d) {
        // La scrittura CAS di ogni chip si aspetta: conta solo quella riuscita; una fallita resta scelta, con il motivo.
        try {
          await c.salva({ ...a, ...conDestinazione(a, d) })
          spostate++
        } catch (err) {
          fallite.push(a.id)
          restano.push(T('dove.resta', { titolo: corto(a.titolo, 32), motivo: T.m(msgDi(err)) }))
        }
      }
    }
    await update($, selezionate, () => fallite)
    $.ui.toast([T('dove.esito', { n: spostate, dove: T(BREVE_DOVE[d]) }), ...restano].join(' · '))
  }
  /** F6.2: il lock della corsia API resta tenuto: perché, e «Libera» o «Termina» quando servono. */
  function notaLockApi() {
    const l = lockApiOra
    if (!l) return null
    const motivo =
      l.motivo === 'discendenti' ? T('api.motivo.discendenti', { n: l.discendenti?.length ?? 0, pid: (l.discendenti ?? []).join(', ') })
        : l.motivo === 'cache' ? T('api.motivo.cache', { min: Math.max(1, Math.ceil((l.restaMs ?? 0) / 60_000)) })
          : T(l.motivo === 'senza-pid' ? 'api.motivo.senzaPid' : l.motivo === 'chiave' ? 'api.motivo.chiave' : l.motivo === 'illeggibile' ? 'api.motivo.illeggibile' : 'api.motivo.inCorso')
    return (
      <Box key="lock-api" flexDirection="row" flexWrap="wrap" columnGap={1} alignItems="center">
        {nota1('lock-api-testo', STATO.attesa, '◐', T('api.lock', { motivo }))}
        {l.motivo === 'discendenti' && <Button key="termina-api" plain label={T('az.termina')} onPress={fai(c.terminaApi)} />}
        {['in-corso', 'senza-pid', 'chiave', 'illeggibile'].includes(l.motivo) && <Button key="libera-api" plain label={T('az.libera')} onPress={fai(c.liberaApi)} />}
      </Box>
    )
  }
  /**
   * F7.3: l'auditor della chip, per modalità. Richiesto (il campo), applicato (solo api-claude, con `--advisor`) o manuale
   * (sessioni: lo digita l'utente con /advisor, che cambia il suo default per tutte le sessioni). Mai «effettivo».
   */
  function auditorRiga(a: Azione, compatta = false) {
    const st = statoAuditor(a)
    const esito = a.lanciatore === 'api-claude' ? a.advisorEsito : undefined
    if (!st && !esito && !a.advisorNonDisponibile) return null
    const scelto = auditorDi(a)
    const id = scelto ? idAuditor(scelto) : undefined
    const nome = scelto ? nomeModello(id ?? scelto) : ''
    const comando = `/advisor ${scelto ?? ''}`
    return (
      <Box key={`auditor-${a.id}`} flexDirection="column">
        {st === 'applicato' && <Text key={`auditor-${a.id}-testo`} size="caption" dimColor wrap="wrap">{T('au.applicato', { auditor: nome })}</Text>}
        {st === 'senza' && <Text key={`auditor-${a.id}-testo`} size="caption" dimColor wrap="wrap">{T('au.senza')}</Text>}
        {st === 'manuale' && (
          <Box key={`auditor-${a.id}-manuale`} flexDirection="row" flexWrap="wrap" columnGap={1} alignItems="center">
            <Text key={`auditor-${a.id}-testo`} size="caption" dimColor wrap="wrap">{T('au.manuale', { comando })}</Text>
            <Button key={`auditor-copia-${a.id}`} plain label={`${T('ese.copia')} ${breve(a)}`}
              onPress={() => void $.ui.copy({ text: comando }).then(x => x.isCopied && $.ui.toast(T('ese.copiato')))}>
              {T('ese.copia')}
            </Button>
          </Box>
        )}
        {/* Nella scheda compatta solo la riga e «Copy»: le note lunghe stanno nella chip aperta. */}
        {st === 'manuale' && !compatta && <Text key={`auditor-${a.id}-nota`} size="caption" dimColor wrap="wrap">{T('au.manualeNota')}</Text>}
        {id?.startsWith('claude-fable') && st !== 'senza' && !compatta && <Text key={`auditor-${a.id}-fable`} size="caption" dimColor wrap="wrap">{T('au.fable')}</Text>}
        {esito && <Text key={`auditor-${a.id}-esito`} size="caption" dimColor wrap="wrap">{T(`au.esito.${esito.stato}`, { modello: esito.modello ? nomeModello(esito.modello) : '' })}</Text>}
        {a.stato === 'fallita' && a.lanciatore === 'api-claude' && a.advisorNonDisponibile && !a.senzaAuditor && (
          a.senzaAuditorBloccato
            ? nota1(`auditor-${a.id}-bloccato`, STATO.attesa, '!', T('au.senzaBloccato', { fonte: T(`ese.fonte.${a.senzaAuditorBloccato as 'utente'}`) }))
            : (
              <Button key={`senza-auditor-${a.id}`} variant="secondary" label={`${T('au.riavviaSenza')} ${breve(a)}`}
                onPress={fai(async () => {
                  // Una scrittura CAS del record (le conferme già date decadono), poi l'avvio di sempre.
                  await c.salva({ ...a, senzaAuditor: true })
                  await c.avvia(a)
                })}>
                {T('au.riavviaSenza')}
              </Button>
            )
        )}
      </Box>
    )
  }
  /** F6.5 «Suggerisci»: dove andrebbe una proposta senza destinazione esplicita, e perché (il consigliere non sceglie). */
  function consiglioRiga(a: Azione) {
    if (!regoleOra.risorse.consigliere || a.stato !== 'proposta') return null
    const cons = consigliaDove(a, regoleOra, d.limiti, tutte, d.spesaApiOra?.speso, adesso)
    if (!cons) return null
    return (
      <Text key={`cons-${a.id}`} size="caption" dimColor wrap="wrap">
        {T('cons.riga', { dove: T(BREVE_DOVE[cons.d]), motivi: cons.motivi.map(m => T.m(m)).join(', ') })}
      </Text>
    )
  }
  function barraScelte() {
    const n = tutte.filter(a => scelte.includes(a.id)).length
    if (!n) return null
    return (
      <Box key="dove-scelte" flexDirection="row" flexWrap="wrap" columnGap={1} alignItems="center">
        <Text key="dove-scelte-n">{T('dove.scelte', { n })}</Text>
        {DESTINAZIONI_UI.map(d => (
          <Button key={`dove-tutte-${d}`} plain label={T('dove.verso', { dove: T(BREVE_DOVE[d]) })} onPress={() => void doveTutte(d)} />
        ))}
        <Button key="dove-pulisci" plain dimColor label={T('dove.pulisci')} onPress={() => void update($, selezionate, () => [])} />
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
        <Button key={`avvia-${a.id}`} variant="secondary" label={`${dip.chiuse ? T('az.avvia') : T('az.accoda')} ${breve(a)}`} onPress={fai(() => c.avvia(a))}>
          {dip.chiuse ? T('az.avvia') : T('az.accoda')}
        </Button>
      ),
      a.stato === 'fallita' && !bloccata && (
        <Button key={`riprova-${a.id}`} variant="secondary" label={`${T('az.riprova')} ${breve(a)}`} onPress={fai(() => c.avvia(a))}>
          {T('az.riprova')}
        </Button>
      ),
      // «Fallo qui» ha la sua guardia: resta anche su una chip che non può partire come sessione nuova.
      a.stato === 'proposta' && dip.chiuse && bloccatoQui.length === 0 && <Button key={`qui-${a.id}`} plain label={`${T('az.qui')} ${breve(a)}`} onPress={fai(() => c.faiQui(a))}>{T('az.qui')}</Button>,
      a.stato === 'fallita' && !bloccata && io?.lanciatore !== 'cli' && a.esecutore !== 'freellmapi' && (
        <Button key={`chiedi-${a.id}`} plain label={`${T('az.chiedi')} ${breve(a)}`} onPress={fai(() => c.chiediQui(a))}>{T('az.chiedi')}</Button>
      ),
      bloccata && (
        <Button
          key={`perche-${a.id}`}
          plain
          label={`${T(motiviAperti === a.id ? 'az.nascondiMotivi' : 'az.perche')} ${breve(a)}`}
          onPress={apriPerche(a.id)}
        >
          {T(motiviAperti === a.id ? 'az.nascondiMotivi' : 'az.perche')}
        </Button>
      ),
      tentativoAnnullabile(a) && <Button key={`annullaT-${a.id}`} plain label={`${T('az.annullaTentativo')} ${breve(a)}`} onPress={fai(() => c.annullaTentativo(a))}>{T('az.annullaTentativo')}</Button>,
      a.stato === 'accodata' && (
        <Button key={`annulla-${a.id}`} plain label={`${T('az.togliCoda')} ${breve(a)}`} onPress={modifica(a, { ...transizione(a, 'proposta', new Date(adesso).toISOString()), ...salvato('motivoCoda', 'motivo', undefined) })}>
          {T('az.togliCoda')}
        </Button>
      ),
      avviata && a.sessione && mia && <Button key={`vedi-${a.id}`} variant="secondary" label={`${T('az.apri')} ${breve(a)}`} onPress={fai(() => c.apri(a.sessione!))}>{T('az.apri')}</Button>,
      avviata && <Button key={`fatta-${a.id}`} plain label={`${T('az.completata')} ${breve(a)}`} onPress={completa(a)}>{T('az.completata')}</Button>,
      dettagli(a),
      modificabile && spostaScarta(a),
    ]
    return (
      <Box
        key={`riga-${a.id}`}
        hover={sotto}
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
        {consiglioRiga(a)}
        {auditorRiga(a, true)}
        {a.stato === 'avviata' && chiLavoraSola(a)}
        {brief && (
          <Text size="caption" dimColor wrap="wrap">
            {corto(brief, Math.max(40, 2 * (colonne - 8)))}
          </Text>
        )}
        {a.stato === 'accodata' && a.motivoCoda && nota1(`coda-${a.id}`, STATO.coda, '◔', T('info.inCoda', { motivo: T.m(letto(a.motivoCodice, a.motivoParametri, a.motivoCoda)) }))}
        {a.errore && nota1(`err-${a.id}`, STATO.attesa, '!', T.m(letto(a.erroreCodice, a.erroreParametri, a.errore)))}
        {bloccata && nota1(`blocco-${a.id}`, STATO.errore, '▲', `${T('motivi.primo', { motivo: T.m(blocchi[0]) })}${blocchi.length > 1 ? ` (+${blocchi.length - 1})` : ''}`)}
        <Box key={`azioni-${a.id}`} flexDirection="row" flexWrap="wrap" columnGap={1} alignItems="center">
          {pulsanti as never}
        </Box>
        {bloccata && motiviAperti === a.id && motivi(a, blocchi, T('motivi.titolo', { n: blocchi.length }))}
      </Box>
    )
  }

  const mostrate = tutteLeSessioni ? righe : righe.slice(0, 6)

  const quando = (iso?: string) => {
    if (!iso) return '—'
    const ms = adesso - Date.parse(iso)
    return ms < 60_000 ? T('tempo.adesso') : durata(ms, T.lingua)
  }
  // «Al lavoro adesso» (C1.3): la tabella solo su `larga`; sotto, due righe per sessione (tre su `stretta`, col ramo).
  const COL = { lavoro: '30%', chi: '11%', modello: '14%', effort: '16%', stato: '11%', contesto: '9%', attivita: '9%' }
  const intestazione = (
    <Box key="tab-testa" flexDirection="row">
      {cella('h-lav', COL.lavoro, <Text size="caption" dimColor>{T('tab.lavoro')}</Text>)}
      {cella('h-chi', COL.chi, <Text size="caption" dimColor>{T('tab.chi')}</Text>)}
      {cella('h-mod', COL.modello, <Text size="caption" dimColor>{T('tab.modello')}</Text>)}
      {cella('h-eff', COL.effort, <Text size="caption" dimColor>{T('tab.effort')}</Text>)}
      {cella('h-st', COL.stato, <Text size="caption" dimColor>{T('tab.stato')}</Text>)}
      {cella('h-ctx', COL.contesto, <Text size="caption" dimColor>{T('tab.contesto')}</Text>, true)}
      {cella('h-att', COL.attivita, <Text size="caption" dimColor>{T('tab.attivita')}</Text>, true)}
    </Box>
  )
  /** Il titolo apre la sessione quando si può; una chip tiene «Dettagli» accanto. */
  const titoloSessione = (r: Riga) => {
    const testo = <Text weight="semibold" wrap="wrap">{r.titolo}</Text>
    const apribile = r.motore === 'claude' && !r.qui && !r.id.startsWith('chip-')
    // Solo chi ha chiesto l'avvio apre la sessione di una chip (l'app la affianca a questa).
    const sessioneChip = r.azione?.sessione && io && r.azione.lanciataDa === io.io ? r.azione.sessione : undefined
    const titolo = sessioneChip ? (
      <Button key={`vedi-${r.azione!.id}`} plain label={T('ses.apriDi', { titolo: r.titolo })} onPress={fai(() => c.apri(sessioneChip))}>{testo}</Button>
    ) : apribile ? (
      <Button key={`apri-ses-${r.id}`} plain label={T('ses.apri', { titolo: r.titolo })} onPress={fai(() => c.apri(r.id))}>{testo}</Button>
    ) : r.azione ? (
      <Button key={`apri-${r.azione.id}`} plain label={T('ses.dettagli', { titolo: r.titolo })} onPress={apriChiudi(r.azione.id)}>{testo}</Button>
    ) : (
      <Box key={`t-${r.id}`}>{testo}</Box>
    )
    // Una chip che aspetta te ha già la sua scheda, con queste azioni, in «Aspettano te».
    const a = r.azione && !aspettaTe(r.azione) ? r.azione : undefined
    const altri = [
      a?.stato === 'avviata' && (
        <Button key={`fatta-${a.id}`} plain label={`${T('az.completata')} ${breve(a)}`} onPress={completa(a)}>{T('az.completata')}</Button>
      ),
      a && (sessioneChip || apribile) && (
        <Button key={`mod-${a.id}`} plain dimColor label={`${T('az.dettagli')} ${breve(a)}`} onPress={apriChiudi(a.id)}>{T('az.dettagli')}</Button>
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
  const extraSessione = (r: Riga) => (r.qui ? T('ses.questa') : r.azione ? undefined : T('ses.aMano'))

  const rigaTabella = (r: Riga) => {
    const seconda = [r.ramo, extraSessione(r)].filter(Boolean).join(' · ')
    const { titolo, altri } = titoloSessione(r)
    return (
      <Box key={`ses-${r.id}`} hover={sotto} flexDirection="row">
        {cella(`c-lav-${r.id}`, COL.lavoro, [
          titolo,
          <Box key={`r2-${r.id}`} flexDirection="row" flexWrap="wrap" columnGap={1}>
            {seconda ? <Text size="caption" dimColor mono wrap="truncate-middle">{seconda}</Text> : null}
            {altri}
          </Box>,
        ])}
        {cella(`c-chi-${r.id}`, COL.chi, chiSessione(r))}
        {cella(`c-mod-${r.id}`, COL.modello, <Text mono wrap="wrap" dimColor={!r.modello}>{r.modello ? nomeModello(r.modello) : '—'}</Text>)}
        {cella(`c-eff-${r.id}`, COL.effort, r.effort ? <Text mono>{`${barreEffort(r.effort)} ${r.effort}`}</Text> : <Text dimColor>—</Text>)}
        {cella(`c-st-${r.id}`, COL.stato, statoSessione(r))}
        {cella(`c-ctx-${r.id}`, COL.contesto, <Text mono dimColor={r.contesto === undefined}>{r.contesto === undefined ? '—' : `${r.contesto}%`}</Text>, true)}
        {cella(`c-att-${r.id}`, COL.attivita, <Text mono dimColor>{r.qui ? T('tempo.adesso') : quando(r.attivita)}</Text>, true)}
      </Box>
    )
  }
  const rigaCompatta = (r: Riga) => {
    const { titolo, altri } = titoloSessione(r)
    const ramoSotto = classe === 'stretta' && !!r.ramo
    return (
      <Box key={`ses-${r.id}`} hover={sotto} flexDirection="column">
        {testa(`ses1-${r.id}`, titolo, [statoSessione(r), ...altri])}
        {pezzi(`ses2-${r.id}`, [
          chiSessione(r),
          <Text mono={!!r.modello} dimColor={!r.modello}>{r.modello ? nomeModello(r.modello) : T('ses.modelloIgnoto')}</Text>,
          r.effort && <Text mono>{`${barreEffort(r.effort)} ${r.effort}`}</Text>,
          r.contesto !== undefined && (
            <Text>
              <Text dimColor>{`${T('ses.contesto')} `}</Text>
              <Text mono>{`${r.contesto}%`}</Text>
            </Text>
          ),
          <Text mono dimColor>{r.qui ? T('tempo.adesso') : quando(r.attivita)}</Text>,
          !ramoSotto && r.ramo && <Text mono dimColor>{r.ramo}</Text>,
          extraSessione(r) && <Text dimColor>{extraSessione(r)}</Text>,
        ])}
        {ramoSotto && (
          <Text size="caption" dimColor mono wrap="truncate-middle">
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
      ? [...new Set([...piano.coda.map(x => T.m(x.motivo)), ...(piano.bloccate.length ? [T('err.bloccateRegole', { n: piano.bloccate.length })] : [])])]
      : []

  /** Barra di avanzamento a blocchi, uguale sul desktop e nel terminale (la percentuale sta accanto). */
  const barra = (t: Traguardo) => {
    const pct = percentuale(t)
    return ui.Barra({ chiave: `barra-${t.numero}`, pct, colore: pct >= 100 ? STATO.inCorso : STATO.coda, celle: 20 })
  }

  // Footer: quanto manca al rilascio, milestone per milestone. Sta in fondo perché è contesto, non lavoro.
  const footer = tr && (tr.lista.length > 0 || tr.errore) && (
    <Box
      key="footer"
      flexDirection="column"
      gap={1}
      marginTop={1}
      padding={1}
      backgroundColor={conVelo ? velo(GRIGIO, VELO.riquadro) : undefined}
      borderStyle={conVelo ? undefined : 'single'}
      borderDimColor
    >
      <Box flexDirection="row" justifyContent="space-between">
        <Text size="caption" weight="medium" dimColor>
          {T('tr.titolo')}
        </Text>
        <Text size="caption" dimColor>{T('tr.aggiornato', { ora: oraDi(tr.letto) })}</Text>
      </Box>
      {tr.lista.map(t => {
        const arrivo = stimaArrivo(t, new Date(adesso))
        const legate = lista.filter(a => a.issue && tr.milestoneDi[String(a.issue)] === t.numero).length
        const ritmo = [
          t.chiuseRecenti !== undefined ? T('tr.chiuseRecenti', { n: t.chiuseRecenti }) : undefined,
          arrivo ? T('tr.arrivo', { giorno: T.giorno(arrivo) }) : t.chiuseRecenti === 0 ? T('tr.fermo') : undefined,
          legate ? T('tr.legate', { n: legate }) : undefined,
        ].filter(Boolean)
        return (
          <Box key={`tr-${t.numero}`} flexDirection="column">
            <Box flexDirection="row" justifyContent="space-between" alignItems="flex-end" gap={1}>
              <Text weight="semibold" wrap="wrap">{t.titolo}</Text>
              <Text weight="semibold" mono>{`${percentuale(t)}%`}</Text>
            </Box>
            {barra(t)}
            <Text size="caption" dimColor tabular>
              {`${T('tr.chiuse', { n: t.chiuse })} · ${T('tr.aperte', { n: t.aperte })} · ${t.scadenza ? T('tr.scade', { giorno: T.giorno(t.scadenza) }) : T('tr.senzaScadenza')}`}
            </Text>
            {ritmo.length > 0 && (
              <Text size="caption" dimColor tabular>
                {ritmo.join(' · ')}
              </Text>
            )}
          </Box>
        )
      })}
      {tr.lista.length === 0 && !tr.errore && <Text dimColor>{T('tr.nessuna', { repo: tr.repo })}</Text>}
      {tr.parziale && <Text size="caption" dimColor>{T('tr.parziale', { dettaglio: T.m(tr.parziale) })}</Text>}
      {tr.errore && nota1('tr-err', STATO.attesa, '!', T('tr.errore', { errore: T.k(tr.errore) }))}
    </Box>
  )

  const lavoro = (
    <Box key="vista-lavoro-corpo" flexDirection="column" gap={2}>
      {d.propostaImp && (
        <Box key="proposta-impostazioni-lavoro" flexDirection="row" flexWrap="wrap" gap={1} alignItems="center">
          {nota1('proposta-impostazioni-lavoro-testo', STATO.attesa, '◐', T('imp.propostaLavoro', { da: d.propostaImp }))}
          <Button key="proposta-impostazioni-rivedi" plain label={T('pesi.rivedi')} onPress={() => void d.rivediImpostazioni()} />
        </Box>
      )}
      {d.proposteAperte.length > 0 && (
        <Box key="proposte-pesi" flexDirection="column" gap={1}>
          {d.proposteAperte.map(p => d.rigaProposta('lavoro-pesi', p))}
        </Box>
      )}
      {senzaProgetto > 0 && (
        <Box key="senza-progetto" flexDirection="row" gap={1} alignItems="center" flexWrap="wrap">
          <Text>
            <Text color={STATO.coda}>{'◔ '}</Text>
            {T('senza.testo', { n: senzaProgetto })}
          </Text>
          <Button key="senza-assegna" variant="secondary" label={T('senza.assegna')} onPress={fai(() => c.senzaProgetto('assegna'))} />
          <Button key="senza-scarta" plain label={T('az.scarta')} onPress={fai(() => c.senzaProgetto('scarta'))} />
        </Box>
      )}
      {Input && (lista.length > 6 || testoFiltro) && (
        <Box flexDirection="row" gap={1} alignItems="center">
          <Input
            key="filtro"
            label={T('filtro.etichetta')}
            placeholder={T('filtro.esempio')}
            value={testoFiltro}
            submitLabel={T('filtro.invia')}
            onInput={v => void update($, filtro, () => v)}
            onSubmit={v => void update($, filtro, () => v)}
          />
          {testoFiltro && <Button key="via-filtro" plain label={T('filtro.cancella')} onPress={() => void update($, filtro, () => '')} />}
        </Box>
      )}
      {!Input && testoFiltro && <Button key="via-filtro" plain label={T('filtro.cancellaTesto', { testo: testoFiltro })} onPress={() => void update($, filtro, () => '')} />}
      {lista.length > 0 && visibili.length === 0 && <Text dimColor>{T('filtro.nessuna', { testo: testoFiltro })}</Text>}

      {attesaTe.length > 0 && (
        <Box key="sez-attesa" flexDirection="column" gap={1}>
          {titoloSezione('t-attesa', T('sez.aspettano'), attesaTe.length)}
          {attesaTe.map(schedaCompatta)}
        </Box>
      )}

      <Box key="sez-lavoro" flexDirection="column" gap={1}>
        <Box flexDirection="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
          {titoloSezione('t-lavoro', T('sez.alLavoro'), alLavoro)}
          {righe.length > 6 && (
            <Button key="tutte-sessioni" plain label={tutteLeSessioni ? T('ses.mostraMeno') : T('ses.mostraTutte', { n: righe.length })} onPress={() => void update($, tutteSessioni, v => !v)} />
          )}
        </Box>
        {righe.length === 0 ? (
          <Text dimColor>{ses.nota ? T('ses.nessunaLetta', { nota: ses.nota.split(' · ').map(T.k).join(' · ') }) : T('ses.nessuna')}</Text>
        ) : (
          <Box flexDirection="column" gap={1}>
            {classe === 'larga' && intestazione}
            {mostrate.flatMap(rigaSessione)}
          </Box>
        )}
        {righe.length > 0 && ses.nota && <Text size="caption" dimColor>{T('ses.parziale', { nota: ses.nota.split(' · ').map(T.k).join(' · ') })}</Text>}
      </Box>

      <Box key="sez-avvio" flexDirection="column" gap={1}>
        {ui.Riga({
          chiave: 'testa-avvio',
          classe,
          principale: titoloSezione('t-avvio', T('sez.daAvviare'), daAvviare.length),
          azioni: [
            prossima && (
              <Button key="prossima" variant="secondary" hotkey="n" label={T('az.prossima', { titolo: corto(prossima.titolo, 32) })} onPress={fai(() => c.avviaProssima(prossima.id))} />
            ),
            proposte > 0 && <Button key="tutte" variant="primary" hotkey="a" label={T('az.tutte', { n: proposte })} onPress={fai(c.avviaTutte)} />,
          ],
        })}
        {barraScelte()}
        {notaLockApi()}
        {nessunaParte.length > 0 && nota1('nessuna-parte', STATO.attesa, '◔', T('err.nessunaParte', { motivi: nessunaParte.join(' · ') }))}
        {daAvviare.length === 0 ? (
          <Text dimColor>
            {lista.length === 0
              ? T('vuoto.primaVolta')
              : T('vuoto.niente')}
          </Text>
        ) : (
          daAvviare.map(schedaCompatta)
        )}
        {proposte > 0 && <Text size="caption" dimColor>{T('piede.parallelo', { n: c.max, fonte: d.fonteRegole })}</Text>}
      </Box>

      {daFondere.length > 0 && (
        <Box key="sez-fondere" flexDirection="column" gap={1}>
          {titoloSezione('t-fondere', T('sez.daFondere'), daFondere.length)}
          {daFondere.map(schedaCompatta)}
        </Box>
      )}
      {footer}
    </Box>
  )
  return lavoro
}
