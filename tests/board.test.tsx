import { expect, test } from 'claude-code/testing'

import { board, chiaveRiassunto, esc, hash, improntaBoard, oscura, testoRiassunto } from '../hooks/board'
import type { DatiBoard, IngressiBoard } from '../hooks/board'
import { normalizza, pianoValido, regoleDa, risorseDa, transizione } from '../hooks/logica'
import type { Azione, Chiamante } from '../types'

// Dati d'esempio: nessun progetto reale.
const ROUTING = {
  modelli_ammessi: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-fable-5-1', 'gpt-6.1-sol', 'gpt-6-astra'],
  effort_ammessi: ['low', 'medium', 'high', 'xhigh', 'max'],
  revisione: { revisori_ammessi_per_autore: { 'claude-opus-5-5': ['claude-fable-5-1', 'motore:codex'] } },
  corsia_codex: {
    modelli: ['gpt-6.1-sol', 'gpt-6-astra'],
    esegue: { corsie: ['R1', 'R2', 'R3'] },
    effort: { R1: 'high', R2: 'xhigh', R3: 'xhigh' },
    rivisto_da: { R1: 'claude-sonnet-5-5', R2: 'claude-sonnet-5-5', R3: 'claude-opus-5-5' },
  },
}
const R = regoleDa(ROUTING, 'routing.json v1')
const ADESSO = '2026-11-05T12:00:00.000Z'

const az = (id: string, ordine: number, extra: Partial<Azione> = {}): Azione => ({
  id, versione: 1, repo: 'esempio/demo', titolo: `Lavoro ${id}`, brief: 'Fai una cosa d\'esempio.', ordine, dipende: [],
  esecutore: 'claude', revisore: 'codex', stato: 'proposta', creata: '2026-11-01T09:00:00Z', aggiornata: '2026-11-01T09:00:00Z', ...extra,
})

const dati = (azioni: Azione[], extra: Partial<DatiBoard> = {}): DatiBoard => ({
  progetto: 'esempio/demo', versione: '2.4.0', generata: ADESSO, azioni, vive: {}, regole: R, piani: {}, commit: [],
  traguardi: null, riassunti: {}, percorso: 'X:/dati/board/esempio__demo-abc/index.html', lingua: 'it', ...extra,
})

const SID = 'local_12345678-1234-1234-1234-123456789abc'
const insieme = () => [
  az('a-prop0001', 1),
  az('a-coda0001', 2, { stato: 'accodata', motivoCoda: 'limite di 3 sessioni in parallelo', dipende: ['a-prop0001'] }),
  az('a-fall0001', 3, { stato: 'fallita', tentativo: 'az-fal1234567', errore: 'avvio rifiutato az-fal1234567' }),
  az('a-avv00001', 4, { stato: 'avviata', sessione: SID, tentativo: 'az-avv1234567', avviataIl: '2026-11-04T10:00:00Z' }),
  az('a-ferm0001', 5, { stato: 'avviata', sessione: SID, tentativo: 'az-fer1234567' }),
  az('a-cons0001', 6, { stato: 'consegnata', sessione: SID, tentativo: 'az-con1234567', consegnataIl: '2026-11-04T11:00:00Z' }),
  az('a-fatt0001', 7, { stato: 'completata', completataIl: '2026-11-03T10:00:00Z' }),
  az('a-vecc0001', 8, { stato: 'completata', completataIl: '2026-09-01T10:00:00Z' }),
  az('a-scar0001', 9, { stato: 'scartata' }),
]

test('board: quattro gruppi, un <details> per ogni chip mostrata, fallita fra «Aspetta il committente»', () => {
  const html = board(dati(insieme(), { vive: { 'a-ferm0001': { stato: 'ferma' }, 'a-avv00001': { stato: 'in-corso', fase: 'rapporto' } } }))
  for (const g of ['Aspetta il committente', 'In corso', 'Prossimi', 'Fatto']) expect(html).toContain(`${g} (`)
  // 2 prossimi + fallita + ferma + avviata + consegnata + 1 completata recente; vecchia e scartata no.
  expect((html.match(/<details /g) ?? []).length).toBe(7)
  expect((html.match(/<\/details>/g) ?? []).length).toBe(7)
  expect(html).not.toContain('id="t-a-scar0001"')
  expect(html).not.toContain('id="t-a-vecc0001"')
  expect(html).toContain('1 completata da più di 30 giorni')
  const attesa = html.slice(html.indexOf('Aspetta il committente ('), html.indexOf('In corso ('))
  expect(attesa).toContain('id="t-a-fall0001"')
  expect(attesa).toContain('id="t-a-ferm0001"')
  expect(attesa).toContain('Errore')
  expect(html.slice(html.indexOf('In corso ('), html.indexOf('Prossimi ('))).toContain('<strong>● rapporto</strong>')
  expect(html.slice(html.indexOf('Prossimi ('))).toContain('limite di 3 sessioni in parallelo')
})

test('board: escape di ogni testo; nessuno script, nessun href, nessuna risorsa esterna; CSP', () => {
  const cattivo = '<script>alert(1)</script>"onx=1 javascript:alert(1) </details><img src=x>'
  const html = board(dati([az('a-esc00001', 1, { titolo: cattivo, brief: cattivo, background: cattivo, piano: 'docs/p.md' })], {
    piani: { 'a-esc00001': { testo: cattivo } }, commit: [{ sha: 'abc1234', data: ADESSO, oggetto: cattivo }], riassunti: {},
  }))
  expect(html).not.toMatch(/<script/i)
  expect(html).not.toMatch(/<img/i)
  expect(html).not.toContain('"onx=')
  // Nessun attributo che carichi o colleghi qualcosa; il testo escapato può contenere «src=», ma mai dentro un tag.
  expect(html).not.toMatch(/<[^>]*\s(href|src|on[a-z]+)\s*=/i)
  expect(html).not.toMatch(/url\(|@import/i)
  expect((html.match(/<\/details>/g) ?? []).length).toBe(1)
  expect(html).toContain('&lt;script&gt;')
  expect(html).toContain('<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'">')
  expect(esc('<a href="x">\'&')).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;')
})

test('board: nessun gettone nell\'HTML (mandato, rami, errori, testo annidato), controllo letterale', () => {
  const gettoni = ['az-abc1234567', 'az-k9x0q1w2e3', 'az-zz00yy11xx'] as const
  const lista = [
    az('a-tok00001', 1, { stato: 'avviata', sessione: SID, tentativo: gettoni[0], ramoSessione: `claude/token_${gettoni[0]}` }),
    az('a-tok00002', 2, { stato: 'fallita', tentativo: gettoni[1], errore: `prova x${gettoni[1]} e ${gettoni[1].toUpperCase()}` }),
    az('a-tok00003', 3, { stato: 'consegnata', sessione: SID, tentativo: gettoni[2], brief: `annidato:xaz-${gettoni[2].slice(3)}_fine` }),
  ]
  const html = board(dati(lista))
  for (const a of lista) expect(html.includes(a.tentativo!)).toBe(false)
  expect(html).not.toMatch(/az-[a-z0-9]{10}/i)
  expect(html).toContain('az-•••')
  expect(oscura('id_az-abcdefghij.', [])).toBe('id_az-•••.')
})

test('board: date mancanti «ignoto»; revisione solo del tentativo corrente, «riferita da», mai «verificata»', () => {
  const corrente = az('a-rev00001', 1, {
    stato: 'consegnata', sessione: SID, tentativo: 'az-rev1234567',
    revisione: { esito: 'approvata', nota: 'tutto a posto', riferitaDa: 'sessione-revisore', quando: '2026-11-04T12:00:00Z', tentativo: 'az-rev1234567' },
  })
  const vecchia = az('a-rev00002', 2, {
    stato: 'avviata', sessione: SID, tentativo: 'az-nuo1234567',
    revisione: { esito: 'da-correggere', riferitaDa: 'sessione-x', quando: '2026-11-04T12:00:00Z', tentativo: 'az-vec1234567' },
  })
  const html = board(dati([corrente, vecchia]))
  expect(html).toContain('ignoto')
  expect(html).toContain('Riferita da')
  expect(html).toContain('sessione-revisore')
  expect(html).not.toContain('<dd>da-correggere</dd>')
  expect(html).not.toMatch(/verificat/i)
})

test('board: piano escapato con troncamento; riassunto per impronta del testo; milestone solo se attive', () => {
  const a = az('a-pia00001', 1, { piano: 'docs/PIANO.md' })
  const r = { ...R, risorse: { ...R.risorse, milestoneGithub: true } }
  const t = { repo: 'esempio/demo', lista: [{ numero: 1, titolo: 'M1', aperte: 1, chiuse: 3, scadenza: null }], milestoneDi: {}, letto: ADESSO }
  const html = board(dati([a], {
    regole: r, traguardi: t, piani: { 'a-pia00001': { testo: '# Piano <b>', troncato: true } },
    riassunti: { [chiaveRiassunto(a, [a], 'it')]: 'Riassunto breve.' },
  }))
  expect(html).toContain('# Piano &lt;b&gt;')
  expect(html).toContain('troncato a 200 KB')
  expect(html).toContain('Riassunto breve.')
  expect(html).toContain('75%')
  expect(board(dati([a], { traguardi: t }))).not.toContain('Milestone')
})

test('impronta: ignora `aggiornata` e l\'ora; cambia con Regole.lette (e la board mostra i blocchi)', () => {
  const ingressi = (regole = R, azioni = insieme()): IngressiBoard => ({
    azioni, vive: {}, regole, piani: {}, registro: null, commit: [], traguardi: null, riassunti: {}, oggi: '2026-11-05', modo: 'accesa', versione: '2.4.0', lingua: 'it',
  })
  const base = improntaBoard(ingressi())
  expect(improntaBoard(ingressi(R, insieme().map(a => ({ ...a, aggiornata: ADESSO }))))).toBe(base)
  const senza = regoleDa({ ...ROUTING, corsia_codex: { ...ROUTING.corsia_codex, modelli: undefined } }, 'routing.json v1')
  expect(senza.lette).toBe(false)
  expect(improntaBoard(ingressi(senza))).not.toBe(base)
  expect(improntaBoard({ ...ingressi(), vive: { 'a-avv00001': { stato: 'in-corso', ultimaAttivita: '2026-11-05T11:00:10Z' } } }))
    .toBe(improntaBoard({ ...ingressi(), vive: { 'a-avv00001': { stato: 'in-corso', ultimaAttivita: '2026-11-05T11:00:50Z' } } }))
  expect(board(dati([az('a-blk00001', 1)], { regole: senza }))).toContain('routing.json non letto')
})

test('transizione: unica fonte delle date; stesso stato non le tocca; un nuovo avvio azzera date e revisione', () => {
  const ora = '2026-11-05T10:00:00.000Z'
  expect(transizione({ stato: 'avviata' }, 'consegnata', ora)).toEqual({ stato: 'consegnata', consegnataIl: ora })
  expect(transizione({ stato: 'consegnata' }, 'completata', ora)).toEqual({ stato: 'completata', completataIl: ora })
  expect(transizione({ stato: 'in-avvio' }, 'avviata', ora)).toEqual({ stato: 'avviata', avviataIl: ora })
  expect(transizione({ stato: 'avviata' }, 'avviata', ora)).toEqual({ stato: 'avviata' })
  const r = transizione({ stato: 'fallita' }, 'in-avvio', ora)
  expect('revisione' in r && r.revisione === undefined && 'consegnataIl' in r).toBe(true)
})

test('piano: al confine niente «..», assoluti, UNC, \\\\?\\, «:» ed estensioni non ammesse', () => {
  for (const ok of ['docs/PIANO.md', 'note.txt', 'a/b c/d.MD']) expect(pianoValido(ok)).toBeUndefined()
  for (const no of ['../fuori.md', 'docs/../../x.md', 'docs\\..\\x.md', '/etc/x.md', 'C:/x.md', 'C:x.md', '\\\\server\\share\\x.md',
    '\\\\?\\C:\\x.md', '\\\\.\\pipe\\x.md', 'docs/x.md:flusso', 'x.pdf', 'x', '', 'a'.repeat(298) + '.md'])
    expect(pianoValido(no)).toBeDefined()
})

test('record: azioni-5 accetta piano, revisione e date; li valida', () => {
  const ok = normalizza({ ...az('a-rec00001', 1), piano: 'docs/p.md', consegnataIl: ADESSO, completataIl: ADESSO,
    revisione: { esito: 'in-corso', riferitaDa: 's', quando: ADESSO, tentativo: 'az-x' } })
  expect(typeof ok).toBe('object')
  expect(normalizza({ ...az('a-rec00002', 1), piano: '../x.md' })).toEqual({ k: 'rec.campo', p: { campo: 'piano' } })
  expect(normalizza({ ...az('a-rec00003', 1), revisione: { esito: 'verificata', riferitaDa: 's', quando: ADESSO } })).toEqual({ k: 'rec.campo', p: { campo: 'revisione' } })
  expect(normalizza({ ...az('a-rec00004', 1), revisione: { esito: 'approvata', riferitaDa: 's', quando: ADESSO, nota: 'x'.repeat(301) } })).toEqual({ k: 'rec.campo', p: { campo: 'revisione' } })
  expect(normalizza({ ...az('a-rec00005', 1), completataIl: 'ieri' })).toEqual({ k: 'rec.data', p: { campo: 'completataIl' } })
})

test('impostazioni: board spenta per difetto; modo e generazione validati', () => {
  expect((risorseDa({}) as { board: unknown }).board).toEqual({ modo: 'spenta', generazione: 0 })
  expect((risorseDa({ board: { modo: 'riassunti', generazione: 3 } }) as { board: unknown }).board).toEqual({ modo: 'riassunti', generazione: 3 })
  expect(risorseDa({ board: { modo: 'pubblica' } })).toEqual({ k: 'cfg.risorse' })
  expect(risorseDa({ board: { modo: 'accesa', generazione: -1 } })).toEqual({ k: 'cfg.risorse' })
  expect(risorseDa({ board: 'accesa' })).toEqual({ k: 'cfg.risorse' })
})

test('lingue: la board nella lingua dell\'utente, con `lang` della pagina; cambiare lingua cambia l\'impronta', () => {
  const lista = [az('a-blk00002', 1, { titolo: 'Sample chip', brief: 'Sample brief.' })]
  const blocco = regoleDa({ ...ROUTING, corsia_codex: { ...ROUTING.corsia_codex, modelli: undefined } }, 'routing.json v1')
  const en = board(dati(lista, { lingua: 'en', regole: blocco }))
  expect(en).toContain('<html lang="en">')
  for (const parola of ['Waiting for the owner', 'Next', 'Done', 'Legend:', 'routing.json not read', 'Generated on Nov 5, 2026']) expect(en).toContain(parola)
  for (const parola of ['Aspetta il committente', 'Prossimi', 'Legenda', 'Generata il', 'non letto']) expect(en).not.toContain(parola)
  const it = board(dati(lista, { lingua: 'it', regole: blocco }))
  expect(it).toContain('<html lang="it">')
  for (const parola of ['Aspetta il committente', 'Prossimi', 'Legenda:', 'Generata il 5 nov 2026']) expect(it).toContain(parola)
  expect(board(dati(lista, { lingua: 'pt' }))).toContain('<html lang="pt-BR">')
  const ingressi: IngressiBoard = { azioni: lista, vive: {}, regole: R, piani: {}, registro: null, commit: [], traguardi: null, riassunti: {}, oggi: '2026-11-05', modo: 'accesa', versione: '2.4.0', lingua: 'it' }
  expect(improntaBoard({ ...ingressi, lingua: 'de' })).not.toBe(improntaBoard(ingressi))
})

test('lingue: nella board fasi del registro ed esito della revisione tradotti, mai i valori salvati', () => {
  const a = az('a-fas00001', 1, { stato: 'avviata', tentativo: 'az-esempio01', revisione: { esito: 'approvata', riferitaDa: 'revisore', quando: ADESSO, tentativo: 'az-esempio01' } })
  const html = board(dati([a], { lingua: 'en', vive: { 'a-fas00001': { stato: 'in-corso', fase: 'rapporto' } } }))
  expect(html).toContain('<strong>● report</strong>')
  expect(html).toContain('<dd>approved</dd>')
  // Fuori dal mandato (testo per l'agente, con i valori dell'API): solo parole tradotte.
  expect(html.replace(/<pre>[\s\S]*?<\/pre>/g, '')).not.toMatch(/\b(pronto|avviato|rapporto|fuso|pubblicato|approvata)\b/)
})

test('R7: la board non dipende da chi la genera: niente chi negli ingressi, blocchi solo dalle regole di progetto, «aspetta il committente»', () => {
  // Un R4 con autore Haiku viola una regola di progetto: il blocco c'è per chiunque generi.
  const r4 = az('a-r4b00001', 1, { titolo: 'permessi OU', modello: 'claude-haiku-5-5', effort: 'low', revisore: 'claude' })
  // Un avvio annullabile solo da chi l'ha chiesto non è lavoro del committente: resta «in corso».
  const inAvvio = az('a-ina00001', 2, { stato: 'in-avvio', manuale: true, lanciataDa: 'sessione-master', tentativo: 'az-esempio02', avvioScade: '2999-01-01T00:00:00.000Z' })
  const fallita = az('a-fal00002', 3, { stato: 'fallita', errore: 'HTTP 502' })
  const d: DatiBoard = { ...dati([r4, inAvvio, fallita], { lingua: 'en' }) }
  expect('chi' in d).toBe(false)
  const html = board(d)
  expect(html).toContain('sensitive lane (R4): author Opus or Fable, not Haiku 5.5')
  const owner = html.slice(html.indexOf('Waiting for the owner'), html.indexOf('</section>', html.indexOf('Waiting for the owner')))
  expect(owner).toContain('a-fal00002')
  expect(owner).not.toContain('a-ina00001')
  const ingressi: IngressiBoard = { azioni: [r4], vive: {}, regole: R, piani: {}, registro: null, commit: [], traguardi: null, riassunti: {}, oggi: '2026-11-05', modo: 'accesa', versione: '2.4.0', lingua: 'en' }
  expect('chi' in ingressi).toBe(false)
})
