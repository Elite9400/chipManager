// Vista Impostazioni: politica del progetto, fornitori, board, FreeLLMAPI e bilanciamento.
import type { Peso, RisorseProgetto } from '../types'
import { COLORE_STATO, durata, FORNITORI } from './logica'
import { INSTALLAZIONE } from './risorse'
import type { Dati } from './pannello'

export function vistaImpostazioni(d: Dati) {
  const { c, Select, Input, regoleOra, adesso, capacita, sb, configura, fai, nota1, NOME_FORNITORE, MOTORI } = d
  const { Box, Text, Button } = d.el
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
    {Select && <Select key="board-progetto" label="Board di progetto" value={regoleOra.risorse.board.modo} options={[{ value: 'spenta', label: 'Spenta' }, { value: 'accesa', label: 'Accesa (HTML locale, nessun modello)' }, { value: 'riassunti', label: 'Accesa con riassunti (modello leggero)' }]} onSelect={v => void c.fai(() => c.board(v as RisorseProgetto['board']['modo'], regoleOra.risorse))} />}
    <Text key="board-nota" size="caption" dimColor>{regoleOra.risorse.board.modo === 'riassunti'
      ? `Riassunti con Haiku: circa 700 token in ingresso e 120 in uscita per chip cambiata, al più 100 al giorno${regoleOra.risorse.soloLocale || !regoleOra.risorse.fornitori.includes('claude') ? '. Fermi: servono Claude abilitato e rete non solo locale' : ''}${sb.riassunti ? `. ${sb.riassunti}` : ''}.`
      : 'File HTML locale nella cartella dei dati, mai pubblicato. I riassunti sono facoltativi e mandano a Claude solo titolo e mandato delle chip.'}</Text>
    {regoleOra.risorse.board.modo !== 'spenta' && sb.motivo && nota1('board-motivo', COLORE_STATO.ferma, '!', `Board non scritta: ${sb.motivo}`)}
    {Select && FORNITORI.map(f => <Select key={`fornitore-${f}`} label={`Fornitore ${f}`} value={regoleOra.risorse.fornitori.includes(f) ? 'si' : 'no'} options={[{ value: 'no', label: 'Vietato' }, { value: 'si', label: 'Abilitato per questo progetto' }]} onSelect={v => void c.fai(() => configura({ fornitori: [...regoleOra.risorse.fornitori.filter(x => x !== f), ...(v === 'si' ? [f] : [])] }))} />)}
    <Text>{`Admin Anthropic: ${capacita.chiavi.anthropic ? 'impostata' : 'mancante'} · DeepSeek: ${capacita.chiavi.deepseek ? 'impostata' : 'mancante'}`}</Text>
    {/* Le viste operative tacciono gli errori delle sonde: la diagnosi del giro corrente sta qui. */}
    {regoleOra.risorse.fornitori.map(f => {
      const righe = capacita.limiti.filter(l => l.fornitore === f && !l.manuale)
        .map(l => (l.errore ? `${l.nome} · ${l.errore}` : `${l.nome} · letto ${durata(Math.max(0, adesso - Date.parse(l.letto!)))} fa`))
      if (f === 'freellmapi') righe.push(`proxy ${capacita.proxy} · chiave ${capacita.chiavi.freellmapi ? 'impostata' : 'mancante'}`)
      return <Text key={`stato-${f}`} size="caption" dimColor>{`${NOME_FORNITORE[f]}: ${righe.join(' · ') || (capacita.proxy === 'helper non disponibile' ? 'helper non disponibile' : 'nessuna lettura')}`}</Text>
    })}
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
  return impostazioniUi
}
