// Vista Carico: quale modello fa cosa, con quale effort, e quanto resta dei limiti.
import type { Limite, Motore, Soglia } from '../types'
import {
  coloreLimite,
  aspettoLimite,
  COLORE_LIVELLO,
  livelloDi,
  piuPieno,
  sogliaDi,
  durata,
  effortDi,
  modelloDi,
  nomeModello,
  rigaConsumo,
  velo,
} from './logica'
import type { Dati } from './pannello'
import { nomeLimiteIn, unitaIn } from './risorse'
import { ACCENTO, GRIGIO, STATO } from './tema'

export function vistaCarico(d: Dati) {
  const { T, conVelo, classe, tutte, regoleOra, lista, adesso, capacita, nota1, titoloSezione,
    righe, cella, fornitoriInUso, limiti, NOME_FORNITORE, MOTORI, motore, consumoOra } = d
  const { Box, Text } = d.el

  const parolaSoglia = (s: Soglia | null) => (s ? `attenzione da ${s.attenzione}% · critica da ${s.critica}%` : 'nessuna soglia')

  /** Barra al rapporto vero con entrambi gli estremi: Box in proporzione sul desktop, 20 celle sul terminale. */
  const barraPct = (k: string, pct: number, colore: string, corta = false) => {
    const p = Math.min(100, Math.max(0, pct))
    if (!conVelo) {
      // Pannello stretto o colonna stretta: 10 celle, così la riga non va a capo.
      const celle = classe === 'stretta' || corta ? 10 : 20
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
        <Box flexGrow={1} flexDirection="row" backgroundColor={velo(GRIGIO, '33')}>
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
    const { fresco, barra, grigio } = aspettoLimite(l, adesso)
    const n = l.percentuale
    const colore = coloreLimite(l, adesso, soglia)
    const livello = n !== undefined && (fresco || l.manuale) ? livelloDi(n, soglia) : undefined
    const valore = n !== undefined ? `${n}% usato` : l.valore !== undefined ? `${T.numero(l.valore)} ${unitaIn(l.unita, T.lingua)}` : 'non disponibile'
    // Un valore inserito a mano non invecchia come una misura: dice solo quando è stato scritto.
    const eta = !l.letto
      ? 'mai letto'
      : l.manuale
        ? `inserito ${durata(Math.max(0, adesso - Date.parse(l.letto)), T.lingua)} fa`
        : `${durata(Math.max(0, adesso - Date.parse(l.letto)), T.lingua)} fa${fresco ? '' : ' · vecchio, non conta nelle scelte'}`
    const reset = l.reset
      ? T.data(l.reset)
      : undefined
    return (
      <Box key={`limite-${l.id}`} flexDirection="column">
        <Text dimColor={grigio}>
          {n === undefined ? <Text color={colore}>{'○ '}</Text> : livello && livello !== 'ok' ? <Text color={colore}>{'▲ '}</Text> : ''}
          {`${nomeLimiteIn(l, T.lingua)}: ${valore}${l.manuale ? ' · manuale' : ''}${livello === 'critica' ? ' · oltre la soglia critica' : livello === 'attenzione' ? ' · sopra la soglia di attenzione' : ''}${l.manuale && livello && livello !== 'ok' ? ' (dichiarato: non cambia le scelte)' : ''}`}
        </Text>
        {barra && barraPct(`barra-${l.id}`, n!, colore)}
        <Text dimColor size="caption">{`${l.fonte} · ${eta}${l.errore ? ` · ${T.k(l.errore)}` : ''}${reset ? ` · reset ${reset}` : ''}`}</Text>
      </Box>
    )
  }

  const controlloLimiti = (
    <Box key="limiti" flexDirection="column" gap={1}>
      {titoloSezione('t-limiti', 'Limiti e budget')}
      {fornitoriInUso.length === 0 && <Text dimColor>Nessun limite collegato · vai a Impostazioni</Text>}
      {fornitoriInUso.map(f => (
        <Box key={`forn-${f}`} flexDirection="column" gap={1}>
          <Text wrap="wrap">
            <Text weight="semibold">{NOME_FORNITORE[f]}</Text>
            <Text dimColor size="caption">{`  ${parolaSoglia(sogliaDi(regoleOra.risorse, f))}`}</Text>
          </Text>
          {limiti.filter(l => l.fornitore === f).map(rigaLimite)}
        </Box>
      ))}
      {fornitoriInUso.length > 0 && <Text size="caption" dimColor>Saldi e budget non sono quote di piano. Un dato vecchio resta grigio e non entra nelle scelte.</Text>}
      {capacita.proxy === 'proxy.helper' && <Text dimColor>{`Limiti non letti: ${T.k(capacita.proxy)}`}</Text>}
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
  // Il velo dell'accento più intenso dove si lavora di più: 1, 2, 3 o più sessioni.
  const VELI = ['', '26', '4D', '80'] as const
  const griglia = (
    <Box flexDirection="column">
      <Box key="m-testa" flexDirection="row">
        {cella('m-h-mod', '36%', <Text size="caption" dimColor>Modello</Text>)}
        {regoleOra.effort.map(e => cella(`m-h-${e}`, larghezzaEffort, <Text size="caption" dimColor>{e}</Text>, true))}
      </Box>
      {modelliAttivi.map(m => (
        <Box key={`m-${m}`} flexDirection="row">
          {cella(`m-n-${m}`, '36%', <Text wrap="wrap">{nomeModello(m)}</Text>)}
          {regoleOra.effort.map(e => {
            const c = conta2(m, e)
            return (
              <Box key={`m-${m}-${e}`} width={larghezzaEffort} flexDirection="row" justifyContent="flex-end" paddingRight={1}
                backgroundColor={conVelo && c.lavoro ? velo(ACCENTO, VELI[Math.min(3, c.lavoro)]) : undefined}>
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
  )
  // Su `stretta` la griglia non entra: un elenco per modello, solo le celle non vuote.
  const elenco = (
    <Box flexDirection="column">
      {modelliAttivi.map(m => {
        const celle = regoleOra.effort.map(e => ({ e, ...conta2(m, e) })).filter(x => x.lavoro + x.coda > 0)
        const coda = celle.reduce((n, x) => n + x.coda, 0)
        return (
          <Text key={`m-${m}`} wrap="wrap">
            <Text weight="semibold">{`${nomeModello(m)}: `}</Text>
            {celle.map(x => `${x.e} ${x.lavoro}`).join(' · ')}
            {coda ? <Text dimColor>{` (+${coda} in coda)`}</Text> : ''}
          </Text>
        )
      })}
      {senzaDati > 0 && <Text size="caption" dimColor>{`${senzaDati} al lavoro senza modello o effort noto`}</Text>}
    </Box>
  )
  const matrice = (
    <Box key="matrice" flexDirection="column" gap={1}>
      {titoloSezione('t-matrice', 'Al lavoro per modello ed effort')}
      {modelliAttivi.length === 0 ? <Text dimColor>Nessuna sessione al lavoro e niente in coda.</Text> : classe === 'stretta' ? elenco : griglia}
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
        conContesto.map(r =>
          classe === 'stretta' ? (
            <Box key={`tok-${r.id}`} flexDirection="column">
              <Text wrap="wrap">{r.titolo}</Text>
              <Box flexDirection="row" alignItems="center" gap={1}>
                <Box flexGrow={1}>{barraPct(`tok-b-${r.id}`, r.contesto!, STATO.coda, true)}</Box>
                <Text tabular>{`${r.contesto}%`}</Text>
              </Box>
            </Box>
          ) : (
            <Box key={`tok-${r.id}`} flexDirection="row" alignItems="center">
              {cella(`tok-t-${r.id}`, '40%', <Text wrap="wrap">{r.titolo}</Text>)}
              <Box width="45%" paddingRight={1}>{barraPct(`tok-b-${r.id}`, r.contesto!, STATO.coda, true)}</Box>
              {cella(`tok-p-${r.id}`, '15%', <Text tabular>{`${r.contesto}%`}</Text>, true)}
            </Box>
          ),
        )
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
  const critici = fornitoriInUso.flatMap(f => {
    const l = piuPieno(limiti, f, adesso)
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
      {d.registroPesi('carico-pesi')}
      <Text size="caption" dimColor>
        {quote.length
          ? `Avvii nelle ultime 24 ore: ${quote.map(x => `${motore(x.m)} ${x.n} (${Math.round((x.n / avviiRecenti.length) * 100)}%)`).join(' · ')}`
          : 'Nessun avvio nelle ultime 24 ore.'}
      </Text>
    </Box>
  )

  const carico = (
    <Box key="vista-carico-corpo" flexDirection="column" gap={2}>
      {matrice}
      {controlloLimiti}
      {token}
      {pesiInUso}
      {consumoOra.da > 0 && <Text key="consumo" size="caption" dimColor>{rigaConsumo(consumoOra, adesso, T.lingua)}</Text>}
    </Box>
  )
  return carico
}
