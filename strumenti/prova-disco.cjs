'use strict'
// Prova di disco.cjs con processi veri: `node --test strumenti/prova-disco.cjs`.
const { test, after } = require('node:test')
const assert = require('node:assert')
const { spawn, spawnSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

// Anche i segni dei mutex e i processi figli delle prove restano nel worktree.
const radiceProve = path.resolve(__dirname, '..', '.cache', 'prove-disco')
// La board rifiuta le cartelle dentro un working tree: le sue prove usano la temporanea vera, fuori dal repo.
const tmpVero = os.tmpdir()
const fuoriDalRepo = []
const fuori = () => { const d = fs.mkdtempSync(path.join(tmpVero, 'board-')); fuoriDalRepo.push(d); return d }
fs.mkdirSync(radiceProve, { recursive: true })
process.env.TMP = process.env.TEMP = process.env.TMPDIR = radiceProve
// I collegamenti simbolici lasciati qui fanno fallire `claude plugin install` dalla cartella.
after(() => { for (const d of [radiceProve, ...fuoriDalRepo]) fs.rmSync(d, { recursive: true, force: true, maxRetries: 3 }) })

const DISCO = path.join(__dirname, 'disco.cjs')
// Entrypoint delle prove: lo stesso main() di disco.cjs, con un mutex della corsia Codex proprio, passato come parametro.
// Così le prove non contendono la corsia con i Codex veri della macchina, e disco.cjs non legge nessuna variabile per farlo.
const MUTEX_PROVA = `prova:corsia-${process.pid}`
const ENTRATA = path.join(radiceProve, 'entrata-prove.cjs')
fs.writeFileSync(ENTRATA, `require(${JSON.stringify(DISCO)}).main(process.argv.slice(2), { mutexCodex: ${JSON.stringify(MUTEX_PROVA)} })
  .catch(e => { process.stdout.write(String(e?.message ?? e)); process.exitCode = 1 })
`)
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'disco-'))
const esegui = (args, input) => spawnSync(process.execPath, [ENTRATA, ...args], { input, encoding: 'utf8' })
const corri = (codice, args = []) =>
  new Promise(r => {
    const p = spawn(process.execPath, ['-e', codice, ...args])
    p.on('exit', c => r(c))
  })
const nome = () => `prova:${Math.random()}`

test('mutex: 8 processi, mai due dentro insieme', async () => {
  const dir = tmp()
  const log = path.join(dir, 'sezione.log')
  const m = nome()
  const figlio = `
    const d = require(${JSON.stringify(DISCO)}); const fs = require('fs')
    d.conMutex(${JSON.stringify(m)}, 30000, async () => {
      fs.appendFileSync(${JSON.stringify(log)}, 'entra\\n')
      await new Promise(r => setTimeout(r, 20))
      fs.appendFileSync(${JSON.stringify(log)}, 'esce\\n')
    }).then(r => process.exit(r.occupato ? 3 : 0))`
  const codici = await Promise.all(Array.from({ length: 8 }, () => corri(figlio)))
  assert.deepStrictEqual(codici, Array(8).fill(0))
  const righe = fs.readFileSync(log, 'utf8').trim().split('\n')
  assert.strictEqual(righe.length, 16)
  for (let i = 0; i < righe.length; i += 2) assert.deepStrictEqual([righe[i], righe[i + 1]], ['entra', 'esce'])
})

test('mutex: chi muore lo rilascia (nessuna scadenza da aspettare)', async () => {
  const m = nome()
  const tenitore = spawn(process.execPath, [
    '-e',
    `require(${JSON.stringify(DISCO)}).conMutex(${JSON.stringify(m)}, 1000, () => { process.stdout.write('preso'); return new Promise(() => {}) })`,
  ])
  await new Promise(r => tenitore.stdout.once('data', r))
  const occupato = await corri(`require(${JSON.stringify(DISCO)}).conMutex(${JSON.stringify(m)}, 200, () => 1).then(r => process.exit(r.occupato ? 3 : 0))`)
  assert.strictEqual(occupato, 3)
  tenitore.kill('SIGKILL')
  await new Promise(r => tenitore.on('exit', r))
  const libero = await corri(`require(${JSON.stringify(DISCO)}).conMutex(${JSON.stringify(m)}, 5000, () => 1).then(r => process.exit(r.occupato ? 3 : 0))`)
  assert.strictEqual(libero, 0)
})

test('prenota e cas: tutte le versioni lette devono essere ancora quelle; nomi solo nella cartella', () => {
  const dir = tmp()
  const a = path.join(dir, 'a-x.json')
  assert.strictEqual(esegui(['cas', a, 'nuovo'], JSON.stringify({ versione: 1 })).status, 0)
  assert.strictEqual(esegui(['cas', a, 'nuovo'], JSON.stringify({ versione: 1 })).status, 4)
  fs.writeFileSync(path.join(dir, 'a-y.json'), JSON.stringify({ versione: 5 }))
  // La decisione ha letto a-x@1 e a-y@4: a-y è cambiata, niente si scrive.
  const r = esegui(['prenota', dir], JSON.stringify({ attese: { 'a-x.json': 1, 'a-y.json': 4 }, scrivi: { 'a-x.json': { versione: 2 } } }))
  assert.strictEqual(r.status, 4)
  assert.strictEqual(r.stdout, 'a-y.json=5')
  assert.strictEqual(JSON.parse(fs.readFileSync(a, 'utf8')).versione, 1)
  assert.strictEqual(esegui(['prenota', dir], JSON.stringify({ attese: { 'a-x.json': 1, 'a-y.json': 5 }, scrivi: { 'a-x.json': { versione: 2 } } })).status, 0)
  assert.strictEqual(JSON.parse(fs.readFileSync(a, 'utf8')).versione, 2)
  assert.strictEqual(esegui(['prenota', dir], JSON.stringify({ scrivi: { '../fuori.json': {} } })).status, 4)
  assert.ok(!fs.existsSync(path.join(dir, '..', 'fuori.json')))
  assert.deepStrictEqual(fs.readdirSync(dir).filter(n => n.endsWith('.tmp')), [])
})

test('prenota: crea la cartella mancante; rifiuta se l\'insieme dei record è cambiato', () => {
  const dir = path.join(tmp(), 'non', 'ancora', 'azioni')
  assert.strictEqual(esegui(['prenota', dir], JSON.stringify({ elenco: [], scrivi: { 'a-uno.json': { versione: 1 } } })).status, 0)
  assert.ok(fs.existsSync(path.join(dir, 'a-uno.json')))
  // La decisione ha visto solo a-uno: nel frattempo è comparsa a-due.
  fs.writeFileSync(path.join(dir, 'a-due.json'), JSON.stringify({ versione: 1 }))
  const r = esegui(['prenota', dir], JSON.stringify({ elenco: ['a-uno.json'], attese: { 'a-uno.json': 1 }, scrivi: { 'a-uno.json': { versione: 2 } } }))
  assert.strictEqual(r.status, 4)
  assert.match(r.stdout, /elenco cambiato/)
})

test('corsia Codex: se il wrapper muore, il comando muore con lui o la corsia resta occupata finché vive', async () => {
  const dir = tmp()
  const fatto = path.join(dir, 'fatto')
  const lungo = `setTimeout(()=>require('fs').writeFileSync(${JSON.stringify(fatto)},'1'),1500)`
  const wrapper = spawn(process.execPath, [ENTRATA, 'corsia-codex', '--', process.execPath, '-e', lungo], { detached: true, stdio: 'ignore' })
  const filePid = path.join(os.tmpdir(), 'chipmanager-corsia-codex.pid')
  for (let i = 0; i < 50 && !fs.existsSync(filePid); i++) await new Promise(r => setTimeout(r, 50))
  const pid = JSON.parse(fs.readFileSync(filePid, 'utf8')).radice
  wrapper.kill('SIGKILL')
  await new Promise(r => setTimeout(r, 200))
  let vivo = true
  try {
    process.kill(pid, 0)
  } catch {
    vivo = false
  }
  // Su Windows libuv mette i figli in un job che il sistema chiude con il wrapper (il comando muore con
  // lui); altrove il figlio può sopravvivere. In entrambi i casi: corsia occupata ⇔ comando vivo.
  assert.strictEqual(esegui(['occupata', 'codex']).status, vivo ? 3 : 0)
  if (vivo) {
    const secondo = spawnSync(process.execPath, [ENTRATA, 'corsia-codex', '--', process.execPath, '-e', `process.exit(require('fs').existsSync(${JSON.stringify(fatto)}) ? 0 : 9)`])
    assert.strictEqual(secondo.status, 0, 'il secondo comando è partito prima della fine del primo')
  } else assert.ok(!fs.existsSync(fatto), 'il comando doveva morire con il wrapper')
})

test('mutex delle azioni: due spellings della stessa cartella (junction) danno lo stesso mutex', () => {
  const d = require(DISCO)
  const vera = path.join(tmp(), 'azioni')
  fs.mkdirSync(vera)
  const alias = path.join(tmp(), 'alias')
  fs.symlinkSync(vera, alias, 'junction')
  assert.strictEqual(d.porta(d.MUTEX_AZIONI(alias)), d.porta(d.MUTEX_AZIONI(vera)))
})

test('corsia Codex: shim .cmd di npm avviato senza shell, argomenti con spazi e virgolette intatti', { skip: process.platform !== 'win32' }, () => {
  const dir = tmp()
  const uscita = path.join(dir, 'argv.json')
  fs.mkdirSync(path.join(dir, 'node_modules', 'finto', 'bin'), { recursive: true })
  fs.writeFileSync(
    path.join(dir, 'node_modules', 'finto', 'bin', 'finto.js'),
    `require('fs').writeFileSync(${JSON.stringify(uscita)}, JSON.stringify(process.argv.slice(2)))`,
  )
  // Stessa forma dell'ultima riga degli shim di npm.
  fs.writeFileSync(path.join(dir, 'finto.cmd'), '@ECHO off\r\n"%_prog%"  "%dp0%\\node_modules\\finto\\bin\\finto.js" %*\r\n')
  const r = esegui(['corsia-codex', '--', path.join(dir, 'finto.cmd'), '-C', 'C:/la mia cartella', 'dice "ciao" & poi %PATH%'])
  assert.strictEqual(r.status, 0, r.stderr)
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(uscita, 'utf8')), ['-C', 'C:/la mia cartella', 'dice "ciao" & poi %PATH%'])
  // Uno .cmd che non è uno shim riconoscibile non parte.
  fs.writeFileSync(path.join(dir, 'altro.cmd'), '@echo %*\r\n')
  assert.strictEqual(esegui(['corsia-codex', '--', path.join(dir, 'altro.cmd'), 'x']).status, 127)
})

test('corsia Codex: un discendente sopravvissuto al comando e al wrapper tiene la corsia', { skip: process.platform !== 'win32' }, async () => {
  const dir = tmp()
  const fine = path.join(dir, 'nipote-finito')
  // Il comando avvia un nipote staccato (esce dal job) che vive 10 s, poi termina subito. 10 s e non meno: con la
  // macchina carica i censimenti (PowerShell) durano secondi, e un nipote già finito renderebbe la prova falsa.
  const nipote = `setTimeout(()=>require('fs').writeFileSync(${JSON.stringify(fine)},'1'),10000)`
  const comando = `require('child_process').spawn(process.execPath,['-e',${JSON.stringify(nipote)}],{detached:true,stdio:'ignore'}).unref()`
  const r = esegui(['corsia-codex', '--', process.execPath, '-e', comando])
  assert.strictEqual(r.status, 0)
  // Il comando è finito, il nipote vive: la corsia è ancora occupata.
  assert.strictEqual(esegui(['occupata', 'codex']).status, 3)
  for (let i = 0; i < 150 && !fs.existsSync(fine); i++) await new Promise(ok => setTimeout(ok, 100))
  await new Promise(ok => setTimeout(ok, 300))
  assert.strictEqual(esegui(['occupata', 'codex']).status, 0)
})

test('corsia Codex: un nipote orfano di un intermedio già uscito tiene la corsia (censimento)', { skip: process.platform !== 'win32' }, async () => {
  const dir = tmp()
  const fine = path.join(dir, 'nipote-finito')
  // radice → intermedio staccato (vive 8 s: almeno due censimenti anche con la macchina carica) → nipote staccato (vive 16 s).
  const nipote = `setTimeout(()=>require('fs').writeFileSync(${JSON.stringify(fine)},'1'),16000)`
  const intermedio = `require('child_process').spawn(process.execPath,['-e',${JSON.stringify(nipote)}],{detached:true,stdio:'ignore'}).unref();setTimeout(()=>{},8000)`
  const radice = `require('child_process').spawn(process.execPath,['-e',${JSON.stringify(intermedio)}],{detached:true,stdio:'ignore'}).unref();setTimeout(()=>{},8500)`
  assert.strictEqual(esegui(['corsia-codex', '--', process.execPath, '-e', radice]).status, 0)
  // Radice e intermedio sono usciti; il nipote ha per padre un processo morto, ma è stato censito.
  assert.strictEqual(esegui(['occupata', 'codex']).status, 3)
  for (let i = 0; i < 200 && !fs.existsSync(fine); i++) await new Promise(ok => setTimeout(ok, 100))
  await new Promise(ok => setTimeout(ok, 300))
  assert.strictEqual(esegui(['occupata', 'codex']).status, 0)
})

test('corsia Codex: comandi mai sovrapposti; la revisione in attesa passa davanti all\'implementazione', async () => {
  const dir = tmp()
  const log = path.join(dir, 'corsia.log')
  const passo = etichetta =>
    `const fs=require('fs');fs.appendFileSync(${JSON.stringify(log)},'${etichetta}+\\n');setTimeout(()=>{fs.appendFileSync(${JSON.stringify(log)},'${etichetta}-\\n')},300)`
  const via = (etichetta, revisione) =>
    new Promise(r =>
      spawn(process.execPath, [ENTRATA, 'corsia-codex', ...(revisione ? ['--revisione'] : []), '--', process.execPath, '-e', passo(etichetta)]).on(
        'exit',
        r,
      ),
    )
  const primo = via('primo', false)
  await new Promise(r => setTimeout(r, 120))
  const impl = via('impl', false)
  await new Promise(r => setTimeout(r, 120))
  const rev = via('rev', true)
  assert.deepStrictEqual(await Promise.all([primo, impl, rev]), [0, 0, 0])
  const righe = fs.readFileSync(log, 'utf8').trim().split('\n')
  for (let i = 0; i < righe.length; i += 2) assert.strictEqual(righe[i].slice(0, -1), righe[i + 1].slice(0, -1))
  assert.deepStrictEqual(righe.filter(x => x.endsWith('+')), ['primo+', 'rev+', 'impl+'])
  assert.strictEqual(esegui(['occupata', 'codex']).status, 0)
})

test('corsia Codex: un pid riciclato (stesso numero, altra nascita) non tiene la corsia; il segno estinto si toglie', { skip: process.platform !== 'win32' }, () => {
  const filePid = path.join(os.tmpdir(), 'chipmanager-corsia-codex.pid')
  // La radice registrata ha il pid di questo processo di prova (vivo) ma un istante di nascita diverso.
  fs.writeFileSync(filePid, JSON.stringify({ radice: process.pid, creato: 0, avvio: Date.now(), noti: [] }))
  assert.strictEqual(esegui(['occupata', 'codex']).status, 0)
  assert.ok(!fs.existsSync(filePid))
})

test('corsia Codex: un segno illeggibile (scrittura interrotta) tiene la corsia occupata', () => {
  const filePid = path.join(os.tmpdir(), 'chipmanager-corsia-codex.pid')
  fs.writeFileSync(filePid, '{"radice": 12')
  try {
    assert.strictEqual(esegui(['occupata', 'codex']).status, 3)
  } finally {
    fs.rmSync(filePid, { force: true })
  }
  assert.strictEqual(esegui(['occupata', 'codex']).status, 0)
})

test('corsia Codex: se il comando non parte, nessun segno e corsia libera', () => {
  const filePid = path.join(os.tmpdir(), 'chipmanager-corsia-codex.pid')
  fs.rmSync(filePid, { force: true })
  // Percorso esplicito: supera la risoluzione sul PATH e arriva davvero a spawn, che fallisce senza pid.
  const r = esegui(['corsia-codex', '--', path.join(tmp(), 'non-esiste.exe')])
  assert.strictEqual(r.status, 127)
  assert.ok(!fs.existsSync(filePid))
  assert.strictEqual(esegui(['occupata', 'codex']).status, 0)
})

test('corsia Codex: una revisione morta (voce senza battito, pid magari riciclato) non ferma le implementazioni', () => {
  const dirAttesa = path.join(os.tmpdir(), 'chipmanager-corsia-codex-revisioni')
  fs.mkdirSync(dirAttesa, { recursive: true })
  // Voce con il pid di questo processo di prova (vivo), ma ferma da un minuto: non batte più.
  const voce = path.join(dirAttesa, String(process.pid))
  fs.writeFileSync(voce, '')
  const vecchio = new Date(Date.now() - 60_000)
  fs.utimesSync(voce, vecchio, vecchio)
  const r = esegui(['corsia-codex', '--attesa', '15000', '--', process.execPath, '-e', 'process.exit(0)'])
  assert.strictEqual(r.status, 0)
  assert.ok(!fs.existsSync(voce), 'la voce morta doveva essere tolta')
})

test('corsia Codex: il battito ricrea la voce di una revisione viva tolta per errore', async () => {
  const dirAttesa = path.join(os.tmpdir(), 'chipmanager-corsia-codex-revisioni')
  // Una implementazione tiene la corsia; intanto una revisione aspetta.
  const lungo = spawn(process.execPath, [ENTRATA, 'corsia-codex', '--', process.execPath, '-e', 'setTimeout(()=>{},6000)'])
  await new Promise(r => setTimeout(r, 800))
  const rev = spawn(process.execPath, [ENTRATA, 'corsia-codex', '--revisione', '--', process.execPath, '-e', 'process.exit(0)'])
  await new Promise(r => setTimeout(r, 800))
  const voce = path.join(dirAttesa, String(rev.pid))
  assert.ok(fs.existsSync(voce))
  fs.rmSync(voce) // tolta per errore, come dopo una pausa lunga
  await new Promise(r => setTimeout(r, 2_600))
  assert.ok(fs.existsSync(voce), 'il battito doveva ricrearla')
  await Promise.all([new Promise(r => lungo.on('exit', r)), new Promise(r => rev.on('exit', r))])
})

const fonti = require('./fornitori.cjs')
const { configura, configuraUtente, lanciaCli } = require(DISCO)
const politica = { fornitori: ['claude', 'codex'], soloLocale: false, freellmapi: { livello: 'niente', endpoint: 'http://localhost:3001/v1' } }

test('2.0 fonti: parser stretti e timestamp originario, nessuna conversazione emessa', () => {
  const letto = '2026-01-01T00:00:00Z'
  assert.deepStrictEqual(fonti.finestreClaude({ rate_limits: { five_hour: { used_percentage: 70 } }, testo: 'contenuto privato' }, letto, 'statusline').map(x => [x.percentuale, x.letto]), [[70, letto]])
  assert.deepStrictEqual(fonti.finestreClaude({ five_hour: { utilization: '70' } }, letto, 'desktop'), [])
  assert.deepStrictEqual(fonti.finestreClaude({ five_hour: { utilization: 110 } }, letto, 'desktop'), [])
  const evento = { type: 'event_msg', timestamp: letto, payload: { type: 'token_count', rate_limits: { primary: { used_percent: 12, resets_at: 1900000000 } } } }
  assert.strictEqual(fonti.finestreCodex(evento)[0].percentuale, 12)
  assert.deepStrictEqual(fonti.finestreCodex({ ...evento, timestamp: '2999-01-01' }), [])
  assert.deepStrictEqual(fonti.finestreCodex({ ...evento, payload: { ...evento.payload, rate_limits: { ...evento.payload.rate_limits, limit_id: 'altro' } } }), [])
})

test('2.0 fonti: log Codex troncati, ultima osservazione valida senza promuovere mtime', async () => {
  const home = tmp()
  const dir = path.join(home, '.codex', 'sessions', '2026', '01', '01')
  fs.mkdirSync(dir, { recursive: true })
  const evento = (timestamp, percentuale) => JSON.stringify({ type: 'event_msg', timestamp, payload: { type: 'token_count', rate_limits: { primary: { used_percent: percentuale } } } })
  fs.writeFileSync(path.join(dir, 'rollout.jsonl'), ['pezzo troncato', evento('2026-01-01T01:00:00Z', 10), '{"testo":"privato"}', evento('2026-01-01T02:00:00Z', 20), '{"fine":'].join('\n'))
  const l = await fonti.codexLocale(home)
  assert.strictEqual(l.length, 1)
  assert.strictEqual(l[0].percentuale, 20)
  assert.strictEqual(l[0].letto, '2026-01-01T02:00:00Z')
  assert.ok(!JSON.stringify(l).includes('privato'))
})

test('2.2 sessioni Codex: solo metadati, turno aperto solo se recente, sotto-thread e file vecchi esclusi', async () => {
  const home = tmp()
  const dir = path.join(home, '.codex', 'sessions', '2026', '01', '01')
  fs.mkdirSync(dir, { recursive: true })
  const riga = (type, payload) => JSON.stringify({ type, timestamp: '2026-01-01T00:00:00Z', payload })
  const meta = (id, extra = {}) => riga('session_meta', { id, cwd: 'C:/esempio/progetto', git: { branch: 'fix-ricerca' }, ...extra })
  const conto = riga('event_msg', { type: 'token_count', info: { last_token_usage: { total_tokens: 61_000 }, model_context_window: 100_000 } })
  fs.writeFileSync(path.join(dir, 'a.jsonl'), [meta('sessione-a'), riga('turn_context', { model: 'gpt-esempio', effort: 'xhigh' }),
    riga('response_item', { type: 'message', content: 'testo privato' }), riga('event_msg', { type: 'task_started' }), conto, ''].join('\n'))
  fs.writeFileSync(path.join(dir, 'b.jsonl'), [meta('sessione-b', { parent_thread_id: 'sessione-a' }), conto, ''].join('\n'))
  fs.writeFileSync(path.join(dir, 'c.jsonl'), [meta('sessione-c'), conto, ''].join('\n'))
  const vecchio = (Date.now() - 3 * 86_400_000) / 1000
  fs.utimesSync(path.join(dir, 'c.jsonl'), vecchio, vecchio)
  const s = (await fonti.sessioniCodexLocali(home)).sessioni
  assert.deepStrictEqual(s.map(x => x.id), ['sessione-a'])
  assert.deepStrictEqual({ ...s[0], attivita: undefined }, { id: 'sessione-a', cwd: 'C:/esempio/progetto', ramo: 'fix-ricerca', modello: 'gpt-esempio', effort: 'xhigh',
    token: 61_000, finestra: 100_000, tokenIl: '2026-01-01T00:00:00Z', stato: 'aperto', inCorso: true, attivita: undefined })
  assert.ok(!JSON.stringify(s).includes('privato'))
  assert.ok(!fs.readFileSync(fonti.fileCache(home), 'utf8').includes('privato'))
  // Lo stesso turno aperto in un file fermo da più di 10 minuti non è lavoro in corso.
  fs.utimesSync(path.join(dir, 'a.jsonl'), Date.now() / 1000 - 900, Date.now() / 1000 - 900)
  assert.strictEqual((await fonti.sessioniCodexLocali(home)).sessioni[0].inCorso, false)
  assert.deepStrictEqual((await fonti.sessioniCodexLocali(path.join(home, 'nessuna'))).sessioni, [])
})

// --- 2.4.2 cache incrementale delle sessioni Codex (file d'esempio piccoli) ---------------------------------
const codexDiProva = () => {
  const home = tmp()
  const dir = path.join(home, '.codex', 'sessions', '2026', '11', '05')
  fs.mkdirSync(dir, { recursive: true })
  return { home, f: path.join(dir, 'rollout-esempio.jsonl') }
}
const ev = (type, payload, timestamp = '2026-11-05T10:00:00Z') => `${JSON.stringify({ type, timestamp, payload })}\n`
const metaEs = ev('session_meta', { id: 'sessione-esempio', cwd: 'C:/esempio/progetto', git: { branch: 'ramo-esempio' } })
const avvio = ev('event_msg', { type: 'task_started' })
const fine = ev('event_msg', { type: 'task_complete' })
const limite = (pct, ts) => ev('event_msg', { type: 'token_count', rate_limits: { primary: { used_percent: pct } } }, ts)
// Righe di riempimento senza eventi di turno né limiti: testo che la cache non deve mai conservare.
const riempi = kb => Array.from({ length: kb }, () => ev('response_item', { type: 'message', content: `privato ${'x'.repeat(940)}` })).join('')
const unaSessione = async (home, adesso) => (await fonti.sessioniCodexLocali(home, adesso)).sessioni[0]
const contaAperture = async fn => {
  const vero = fs.openSync
  let n = 0
  fs.openSync = (...a) => {
    if (String(a[0]).endsWith('.jsonl')) n += 1
    return vero(...a)
  }
  try {
    await fn()
  } finally {
    fs.openSync = vero
  }
  return n
}

test('2.4.2 cache Codex: un file invariato non si apre; uno cresciuto si legge solo dalla coda nuova', async () => {
  const { home, f } = codexDiProva()
  fs.writeFileSync(f, metaEs + avvio)
  assert.strictEqual((await unaSessione(home)).stato, 'aperto')
  assert.strictEqual(await contaAperture(() => fonti.sessioniCodexLocali(home)), 0)
  const prima = fs.statSync(f).size
  fs.appendFileSync(f, fine)
  const r = await fonti.sessioniCodexLocali(home)
  assert.strictEqual(r.sessioni[0].stato, 'chiuso')
  assert.strictEqual(r.diagnostica.byte, fs.statSync(f).size - prima)
  assert.strictEqual(r.diagnostica.aperti, 1)
})

test('2.4.2 cache Codex: una riga scritta in due tempi non si consuma finché non ha il suo a capo', async () => {
  const { home, f } = codexDiProva()
  fs.writeFileSync(f, metaEs + avvio.slice(0, 20))
  assert.strictEqual((await unaSessione(home)).stato, 'ignoto')
  fs.appendFileSync(f, avvio.slice(20))
  assert.strictEqual((await unaSessione(home)).stato, 'aperto')
})

test('2.4.2 cache Codex: troncato o riscritto senza crescita (stessa dimensione) si rilegge da capo', async () => {
  const { home, f } = codexDiProva()
  fs.writeFileSync(f, metaEs + avvio + fine)
  assert.strictEqual((await unaSessione(home)).stato, 'chiuso')
  // Troncato: più corto dell'offset letto.
  fs.writeFileSync(f, metaEs + avvio)
  assert.strictEqual((await unaSessione(home)).stato, 'aperto')
  fs.appendFileSync(f, fine)
  assert.strictEqual((await unaSessione(home)).stato, 'chiuso')
  // Riscritto con la stessa dimensione e un'altra data: le stesse righe in un altro ordine, lo stato cambia.
  const n = fs.statSync(f).size
  fs.writeFileSync(f, metaEs + fine + avvio)
  assert.strictEqual(fs.statSync(f).size, n)
  const t = Date.now() / 1000 + 5
  fs.utimesSync(f, t, t)
  assert.strictEqual((await unaSessione(home, Date.now() + 10_000)).stato, 'aperto')
})

test('2.4.2 cache Codex: oltre 512 KB d\'arretrato lo stato viene dalla sola coda (ignoto se non lo dice)', async () => {
  const { home, f } = codexDiProva()
  fs.writeFileSync(f, metaEs + avvio)
  assert.strictEqual((await unaSessione(home)).stato, 'aperto')
  fs.appendFileSync(f, riempi(600))
  const r = await fonti.sessioniCodexLocali(home)
  assert.strictEqual(r.sessioni[0].stato, 'ignoto', 'lo stato di prima del salto non si eredita')
  assert.strictEqual(r.sessioni[0].inCorso, false)
  assert.strictEqual(r.diagnostica.salti, 1)
  assert.ok(r.diagnostica.byteLimiti > 0)
  // Il metadato letto una volta resta; la coda dice di nuovo lo stato.
  fs.appendFileSync(f, riempi(600) + avvio)
  assert.strictEqual((await unaSessione(home)).stato, 'aperto')
  assert.strictEqual((await unaSessione(home)).id, 'sessione-esempio')
  assert.ok(!fs.readFileSync(fonti.fileCache(home), 'utf8').includes('privato'))
})

test('2.4.2 cache Codex: un turno aperto in un file fermo da 10 minuti diventa inattivo senza riaprirlo', async () => {
  const { home, f } = codexDiProva()
  fs.writeFileSync(f, metaEs + avvio)
  assert.strictEqual((await unaSessione(home)).inCorso, true)
  let s
  assert.strictEqual(await contaAperture(async () => { s = await unaSessione(home, Date.now() + 11 * 60_000) }), 0)
  assert.strictEqual(s.inCorso, false)
  assert.strictEqual(s.stato, 'aperto')
})

test('2.4.2 cache Codex: corrotta o con campi estranei si scarta e si ricostruisce, con lo stesso risultato', async () => {
  const { home, f } = codexDiProva()
  fs.writeFileSync(f, metaEs + avvio + limite(30, '2026-11-05T10:00:00Z'))
  const giusta = await fonti.sessioniCodexLocali(home)
  const cache = JSON.parse(fs.readFileSync(fonti.fileCache(home), 'utf8'))
  // Solo i campi ammessi.
  const voce = Object.values(cache.voci)[0]
  assert.deepStrictEqual(Object.keys(voce).sort(), ['dimensione', 'ino', 'limiti', 'meta', 'mtimeMs', 'offset', 'primoTurno', 'ultimo'])
  assert.deepStrictEqual(Object.keys(voce.meta).sort(), ['cwd', 'figlia', 'id', 'ramo'])
  for (const rotta of ['{"versione":1,"voci":', JSON.stringify({ versione: 1, voci: { [f]: { ...voce, ultimo: { stato: 'acceso' } } } })]) {
    fs.writeFileSync(fonti.fileCache(home), rotta)
    const r = await fonti.sessioniCodexLocali(home)
    assert.deepStrictEqual(r.sessioni, giusta.sessioni)
    assert.strictEqual(r.diagnostica.aperti, 1, 'ricostruita leggendo il file')
  }
  assert.strictEqual((await fonti.codexLocale(home))[0].percentuale, 30)
})

test('2.4.2 cache Codex: limiti identici a cache calda e fredda; un evento senza limiti non cancella la misura', async () => {
  const { home, f } = codexDiProva()
  fs.writeFileSync(f, metaEs + limite(10, '2026-11-05T10:00:00Z'))
  assert.strictEqual((await fonti.codexLocale(home))[0].percentuale, 10)
  // Calda: 80% e poi oltre 512 KB di righe senza limiti, più un token_count senza rate_limits.
  fs.appendFileSync(f, limite(80, '2026-11-05T11:00:00Z') + riempi(600) + ev('event_msg', { type: 'token_count', info: {} }, '2026-11-05T12:00:00Z'))
  const calda = await fonti.codexLocale(home)
  fs.rmSync(fonti.fileCache(home))
  const fredda = await fonti.codexLocale(home)
  assert.strictEqual(calda[0].percentuale, 80)
  assert.deepStrictEqual(fredda, calda)
  assert.strictEqual(calda[0].letto, '2026-11-05T11:00:00Z')
})

test('2.4.2 cache Codex: i limiti vengono solo dai file degli ultimi 7 giorni', async () => {
  const { home, f } = codexDiProva()
  fs.writeFileSync(f, metaEs + limite(55, '2026-11-05T10:00:00Z'))
  const vecchio = (Date.now() - 8 * 86_400_000) / 1000
  fs.utimesSync(f, vecchio, vecchio)
  assert.deepStrictEqual(await fonti.codexLocale(home), [])
})

test('2.4.2 cache Codex: due processi insieme, nessun errore e risultato corretto', async () => {
  const { home, f } = codexDiProva()
  fs.writeFileSync(f, metaEs + avvio + riempi(200))
  const codice = `require(${JSON.stringify(path.join(__dirname, 'fornitori.cjs'))}).sessioniCodexLocali(${JSON.stringify(home)})
    .then(r => process.exit(r.sessioni[0]?.stato === 'aperto' ? 0 : 5), () => process.exit(6))`
  assert.deepStrictEqual(await Promise.all([corri(codice), corri(codice)]), [0, 0])
  assert.strictEqual((await unaSessione(home)).stato, 'aperto')
})

test('2.0 fonti: saldo non è percentuale; costi USD, paginazione incompleta mai totale', () => {
  const saldo = fonti.saldoDeepseek({ is_available: true, balance_infos: [{ currency: 'USD', total_balance: '20.50' }] }, '2026-01-01')
  assert.strictEqual(saldo[0].valore, 20.5)
  assert.strictEqual(saldo[0].percentuale, undefined)
  assert.deepStrictEqual(fonti.saldoDeepseek({ is_available: true, balance_infos: [{ currency: 'USD', total_balance: 'Infinity' }] }, '2026-01-01'), [])
  const report = { data: [{ results: [{ currency: 'USD', amount: '10.25' }, { currency: 'USD', amount: '-1.25' }] }], has_more: false }
  assert.strictEqual(fonti.costoClaude(report, '2026-01-01')[0].valore, 0.09)
  assert.strictEqual(fonti.costoClaude({ data: [{ results: [{ currency: 'USD', amount: '123.78912' }] }], has_more: false }, '2026-01-01')[0].valore, 1.2378912)
  assert.deepStrictEqual(fonti.costoClaude({ ...report, has_more: true }, '2026-01-01'), [])
  assert.strictEqual(fonti.usoFree({ month: '2026-01', requests: 30, tokens: 1000 }, '2026-01-01')[0].percentuale, undefined)
})

test('2.0 fonti: default e soloLocale non fanno richieste a fornitori non ammessi', async () => {
  const calls = []
  const richiesta = async url => { calls.push(url); throw new Error('non prevista') }
  const chiave = require('node:crypto').randomBytes(24).toString('hex')
  const deps = { home: tmp(), richiesta }
  await fonti.osserva(politica, { deepseek: chiave, freellmapi: chiave }, deps)
  assert.deepStrictEqual(calls, [])
  await fonti.osserva({ ...politica, fornitori: ['claude', 'codex', 'deepseek', 'freellmapi'], soloLocale: true }, { anthropic: chiave, deepseek: chiave, freellmapi: chiave }, deps)
  assert.deepStrictEqual(calls, [])
  await assert.rejects(fonti.osserva({ ...politica, soloLocale: 'si' }, {}, deps))
})

test('2.0 fonti: sonde abilitate senza testo del progetto e senza chiavi nelle risposte', async () => {
  const chiave = require('node:crypto').randomBytes(24).toString('hex')
  const calls = []
  const r = await fonti.osserva({ ...politica, fornitori: ['deepseek'] }, { deepseek: chiave }, { home: tmp(), richiesta: async (url, init) => {
    calls.push(url)
    assert.strictEqual(init.body, undefined)
    assert.strictEqual(init.headers.Authorization, `Bearer ${chiave}`)
    return { is_available: true, balance_infos: [{ currency: 'CNY', total_balance: '18.00', extra: chiave }] }
  } })
  assert.deepStrictEqual(calls, ['https://api.deepseek.com/user/balance'])
  assert.strictEqual(r.chiavi.deepseek, true)
  // Gli id passano il confine del pannello (risorseLette in hooks/risorse.ts): un saldo letto non deve far rifiutare la risposta.
  assert.strictEqual(r.limiti.find(l => l.fornitore === 'deepseek').id, 'deepseek-cny')
  for (const l of r.limiti) assert.match(l.id, /^[a-z0-9-]+$/)
  assert.ok(!JSON.stringify(r).includes(chiave))
  const errore = await fonti.osserva({ ...politica, fornitori: ['deepseek'] }, { deepseek: chiave }, { home: tmp(), richiesta: async () => { throw new Error(chiave) } })
  assert.ok(!JSON.stringify(errore).includes(chiave))
  const mancanti = await fonti.osserva(politica, { anthropic: chiave }, { home: tmp(), richiesta: async () => { throw new Error('offline') } })
  assert.strictEqual(new Set(mancanti.limiti.map(l => l.id)).size, mancanti.limiti.length)
  assert.ok(mancanti.limiti.find(l => l.id === 'claude-api').errore)
})

test('2.0 HTTP: redirect vietati, timeout breve, risposta limitata e nessuna rete reale', async () => {
  let chiamate = 0
  const finto = async (url, init) => {
    chiamate++
    assert.strictEqual(init.redirect, 'error')
    assert.ok(init.signal instanceof AbortSignal)
    return new Response('{"ok":true}', { status: 200 })
  }
  assert.deepStrictEqual(await fonti.richiesta('http://localhost:3001/api/ping', {}, finto), { ok: true })
  assert.strictEqual(chiamate, 1)
  await assert.rejects(fonti.richiesta('http://localhost:3001/api/ping', {}, async () => new Response('x'.repeat(512001))))
  await assert.rejects(fonti.richiesta('http://localhost:3001/api/ping', {}, async () => new Response('', { status: 302 })))
})

test('2.0 FreeLLMAPI: solo loopback, modello unificato, niente strumenti e chiave mai restituita', async () => {
  for (const endpoint of ['https://localhost:3001/v1', 'http://127.0.0.1.example.org:3001/v1', 'http://user:password@localhost:3001/v1', 'http://localhost:3001/v1?q=x', 'http://localhost:99999/v1']) assert.strictEqual(fonti.locale(endpoint), false)
  const p = { ...politica, fornitori: ['freellmapi'], freellmapi: { ...politica.freellmapi, livello: 'R1' } }
  const chiave = require('node:crypto').randomBytes(24).toString('hex')
  const input = { testo: 'Rendi concisa questa frase.', modello: 'testo-compatto' }
  const calls = []
  const risposta = await fonti.completa(p, input, chiave, async (url, init) => {
    calls.push(url)
    if (url.includes('/models/')) { assert.strictEqual(init.body, undefined); return { id: input.modello, owned_by: 'freellmapi', available: true } }
    const body = JSON.parse(init.body)
    assert.strictEqual(body.tools, undefined)
    assert.deepStrictEqual(body.messages, [{ role: 'user', content: input.testo }])
    assert.ok(!init.body.includes(chiave))
    return { choices: [{ message: { content: 'Frase concisa.' } }] }
  })
  assert.strictEqual(risposta, 'Frase concisa.')
  assert.strictEqual(calls.length, 2)
  let post = 0
  await assert.rejects(fonti.completa(p, input, chiave, async (_url, init) => { if (init.method === 'POST') post++; return { id: input.modello, owned_by: 'groq', available: true } }))
  assert.strictEqual(post, 0)
  await assert.rejects(fonti.completa(p, { ...input, modello: 'auto' }, chiave))
  await assert.rejects(fonti.completa({ ...p, soloLocale: true }, input, chiave))
  await assert.rejects(fonti.completa(p, input, chiave, async url => url.includes('/models/') ? { id: input.modello, owned_by: 'freellmapi', available: true } : { choices: [{ message: { content: chiave } }] }))
})

test('2.0 config: CAS preserva altri progetti e rifiuta configurazione corrotta', async () => {
  const dir = tmp()
  const file = path.join(dir, 'config.json')
  const prima = JSON.stringify({ progetti: { altro: { background: 'da conservare' } } })
  fs.writeFileSync(file, prima)
  assert.strictEqual(await configura(file, { atteso: prima, repo: 'acme/repo', campi: { fornitori: ['claude'] } }), 0)
  assert.strictEqual(JSON.parse(fs.readFileSync(file)).progetti.altro.background, 'da conservare')
  assert.strictEqual(await configura(file, { atteso: prima, repo: 'acme/repo', campi: { fornitori: ['freellmapi'] } }), 4)
  fs.writeFileSync(file, '{"rotto":')
  await assert.rejects(configura(file, { atteso: '{"rotto":', repo: 'acme/repo', campi: { pesi: [] } }))
  assert.strictEqual(fs.readFileSync(file, 'utf8'), '{"rotto":')
})

test('lingua: configura-utente scrive solo campi utente validi, senza repo, con lo stesso CAS; i progetti restano', async () => {
  const dir = tmp()
  const file = path.join(dir, 'config.json')
  assert.strictEqual(await configuraUtente(file, { atteso: null, campi: { lingua: 'de' } }), 0)
  const prima = fs.readFileSync(file, 'utf8')
  assert.deepStrictEqual(JSON.parse(prima), { lingua: 'de' })
  assert.strictEqual(await configura(file, { atteso: prima, repo: 'esempio/demo', campi: { fornitori: ['claude'] } }), 0)
  const dopo = fs.readFileSync(file, 'utf8')
  assert.strictEqual(await configuraUtente(file, { atteso: prima, campi: { lingua: 'it' } }), 4)
  for (const campi of [{ lingua: 'zh' }, { lingua: 'IT' }, { progetti: {} }, { lingua: 'it', fornitori: [] }, {}, null, ['lingua']])
    assert.strictEqual(await configuraUtente(file, { atteso: dopo, campi }), 2)
  assert.strictEqual(await configuraUtente(file, { atteso: dopo, campi: { lingua: 'pt' } }), 0)
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { lingua: 'pt', progetti: { 'esempio/demo': { fornitori: ['claude'] } } })
  fs.writeFileSync(file, '{"rotto":')
  await assert.rejects(configuraUtente(file, { atteso: '{"rotto":', campi: { lingua: 'en' } }))
  assert.strictEqual(fs.readFileSync(file, 'utf8'), '{"rotto":')
})

test('2.6 config: soglie, profilo e pesi in una sola scrittura; campi fuori elenco rifiutati senza toccare il file', async () => {
  const dir = tmp()
  const file = path.join(dir, 'config.json')
  const prima = JSON.stringify({ progetti: { 'esempio/demo': { fornitori: ['claude'] } } })
  fs.writeFileSync(file, prima)
  const campi = {
    profilo: 'risparmio',
    pesi: [{ tipo: 'effort', nome: 'low', percentuale: 40, assoluto: 0 }],
    soglie: { claude: { attenzione: 60, critica: 80 }, codex: null },
    limitiManuali: [{ id: 'claude-settimanale-abc', fornitore: 'claude', nome: 'settimanale', letto: '2026-11-05T12:00:00.000Z', percentuale: 40, unita: '%' }],
  }
  assert.strictEqual(await configura(file, { atteso: prima, repo: 'esempio/demo', campi }), 0)
  const dopo = fs.readFileSync(file, 'utf8')
  // Profilo e pesi portano la revisione e l'origine manuale, scritte dall'helper.
  assert.deepStrictEqual(JSON.parse(dopo).progetti['esempio/demo'], { fornitori: ['claude'], ...campi, pesiRevisione: 1, pesiOrigine: { tipo: 'manuale' } })
  for (const estraneo of [{ chiave: 'x' }, { routing: 'altro.json' }, { sensibili: [] }, { pesiRevisione: 9 }, { pesiOrigine: { tipo: 'proposta', id: 'd-falsa00001' } }])
    assert.strictEqual(await configura(file, { atteso: dopo, repo: 'esempio/demo', campi: { profilo: 'qualita', ...estraneo } }), 2)
  assert.strictEqual(fs.readFileSync(file, 'utf8'), dopo)
})

test('2.0 CLI: record già riservato e gettone non corrente non possono fare spawn', async () => {
  const dir = tmp()
  const id = 'a-cli00001'
  const tentativo = 'az-123456'
  fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify({ stato: 'in-avvio', lanciatore: 'cli', tentativo }))
  fs.mkdirSync(path.join(dir, 'esecuzioni'))
  fs.writeFileSync(path.join(dir, 'esecuzioni', `${tentativo}.json`), '{}')
  assert.strictEqual(await lanciaCli(dir, id, tentativo, {}), 4)
  assert.strictEqual(await lanciaCli(dir, id, 'az-vecchio', {}), 4)
  assert.strictEqual(await lanciaCli(dir, '../fuori', tentativo, {}), 2)
})

test('2.0 CLI: worktree distinto, argv senza shell, prompt su stdin e uscita solo consegnata', async () => {
  const { eseguiCli } = require(DISCO)
  const { EventEmitter } = require('node:events')
  const dir = tmp()
  const root = tmp()
  const id = 'a-cli00002'
  const tentativo = 'az-654321'
  const file = path.join(dir, 'esecuzioni', `${tentativo}.json`)
  fs.mkdirSync(path.dirname(file))
  fs.writeFileSync(file, JSON.stringify({ id, tentativo, stato: 'in-avvio' }))
  const chiamate = []
  const prompt = 'Testo con "virgolette" e $(non_eseguire) & %PATH%'
  const codice = await eseguiCli(dir, id, tentativo, { root, prompt, modello: 'claude-opus-5-5', effort: 'high', permessi: 'acceptEdits', base: 'main' }, {
    git: args => { chiamate.push(args); return 'a'.repeat(40) },
    avvia: (argv, opzioni) => {
      assert.deepStrictEqual(argv, ['claude', '-p', '--model', 'claude-opus-5-5', '--effort', 'high', '--permission-mode', 'acceptEdits', '--output-format', 'json'])
      assert.strictEqual(opzioni.shell, undefined)
      assert.deepStrictEqual(opzioni.stdio, ['pipe', 'ignore', 'ignore'])
      assert.ok(opzioni.cwd.startsWith(root + path.sep))
      const p = new EventEmitter()
      p.stdin = new EventEmitter()
      p.stdin.end = testo => {
        assert.strictEqual(testo, prompt)
        assert.strictEqual(JSON.parse(fs.readFileSync(file)).stato, 'avviata')
        setImmediate(() => p.emit('exit', 0))
      }
      queueMicrotask(() => p.emit('spawn'))
      return p
    },
  })
  assert.strictEqual(codice, 0)
  assert.deepStrictEqual(chiamate[0], ['rev-parse', '--verify', 'main^{commit}'])
  assert.deepStrictEqual(chiamate[1].slice(0, 4), ['worktree', 'add', '-b', `chipmanager/${tentativo}`])
  assert.strictEqual(JSON.parse(fs.readFileSync(file)).stato, 'consegnata')
  await assert.rejects(eseguiCli(dir, id, tentativo, {}, { avvia: () => { throw new Error('non deve arrivare qui') } }))
})

test('2.0 CLI: un errore di preparazione conserva il worktree e non avvia nulla', async () => {
  const { eseguiCli } = require(DISCO)
  const dir = tmp()
  const id = 'a-cli00003'
  const tentativo = 'az-777777'
  const file = path.join(dir, 'esecuzioni', `${tentativo}.json`)
  fs.mkdirSync(path.dirname(file))
  fs.writeFileSync(file, JSON.stringify({ id, tentativo, stato: 'in-avvio' }))
  let avvii = 0
  await eseguiCli(dir, id, tentativo, { root: dir, prompt: 'testo', modello: 'claude-opus-5-5', effort: 'high', permessi: 'bypassPermissions' }, { avvia: () => { avvii++ } })
  assert.strictEqual(avvii, 0)
  assert.strictEqual(JSON.parse(fs.readFileSync(file)).stato, 'fallita')
  const root = tmp()
  const fuori = tmp()
  fs.symlinkSync(fuori, path.join(root, '.claude'), process.platform === 'win32' ? 'junction' : 'dir')
  fs.writeFileSync(file, JSON.stringify({ id, tentativo, stato: 'in-avvio' }))
  await eseguiCli(dir, id, tentativo, { root, prompt: 'testo', modello: 'claude-opus-5-5', effort: 'high', permessi: 'acceptEdits' }, {
    git: args => { assert.strictEqual(args[0], 'rev-parse'); return 'a'.repeat(40) },
    avvia: () => { avvii++ },
  })
  assert.strictEqual(avvii, 0)
  assert.strictEqual(fs.existsSync(path.join(fuori, 'worktrees')), false)
  assert.strictEqual(JSON.parse(fs.readFileSync(file)).stato, 'fallita')
})

// --- 2.4 board di progetto e piani -------------------------------------------------------------------

const preparaBoard = (repo = 'esempio/demo') => {
  const base = fuori()
  const cartella = path.join(base, 'dati')
  fs.mkdirSync(cartella)
  return { config: path.join(base, 'config.json'), cartella, repo }
}
/** Cambia il modo come il pannello (CAS di `configura`) e restituisce la generazione scritta dall'helper. */
const imposta = async (b, modo) => {
  const atteso = fs.existsSync(b.config) ? fs.readFileSync(b.config, 'utf8') : null
  assert.strictEqual(await configura(b.config, { atteso, repo: b.repo, campi: { board: { modo } } }), 0)
  return JSON.parse(fs.readFileSync(b.config, 'utf8')).progetti[b.repo].board.generazione
}
const bc = (b, cmd, gen, extra = [], input) => esegui([cmd, b.config, b.cartella, b.repo, String(gen), ...extra], input)
const bcAsync = (b, cmd, gen, extra = []) =>
  new Promise(r => spawn(process.execPath, [DISCO, cmd, b.config, b.cartella, b.repo, String(gen), ...extra]).on('exit', r))
const HTML = '<html>prova</html>'

test('2.4 board: la generazione cresce a ogni cambio di modo; dopo spento → acceso il lavoro vecchio non si pubblica', async () => {
  const b = preparaBoard()
  const g1 = await imposta(b, 'riassunti')
  assert.strictEqual(g1, 1)
  assert.strictEqual(await imposta(b, 'riassunti'), 1)
  assert.strictEqual(bc(b, 'board-prenota', g1, ['imp1']).status, 0)
  const g2 = await imposta(b, 'spenta')
  const g3 = await imposta(b, 'riassunti')
  assert.deepStrictEqual([g2, g3], [2, 3])
  assert.strictEqual(bc(b, 'board-finalizza', g1, ['imp1'], JSON.stringify({ testo: 'vecchio' })).status, 4)
  assert.strictEqual(bc(b, 'board-scrivi', g1, ['h1'], HTML).status, 4)
  assert.strictEqual(bc(b, 'board-prenota', g1, ['imp2']).status, 4)
  const r = bc(b, 'board-scrivi', g3, ['h3'], HTML)
  assert.strictEqual(r.status, 0, r.stdout)
  const file = r.stdout.trim()
  assert.strictEqual(path.basename(file), 'index.html')
  assert.strictEqual(fs.readFileSync(file, 'utf8'), HTML)
  // Accesa senza riassunti: nessuna prenotazione di chiamate al modello.
  const g4 = await imposta(b, 'accesa')
  assert.strictEqual(bc(b, 'board-prenota', g4, ['imp3']).status, 4)
  assert.strictEqual(bc(b, 'board-scrivi', g4, ['h4'], HTML).status, 0)
})

test('2.4 board: lo spegnimento cancella solo HTML e riassunti, con il marcatore; il budget del giorno resta', async () => {
  const b = preparaBoard()
  let g = await imposta(b, 'riassunti')
  for (const i of ['i0', 'i1', 'i2']) assert.strictEqual(bc(b, 'board-prenota', g, [i]).status, 0)
  const dest = path.dirname(bc(b, 'board-scrivi', g, ['h'], HTML).stdout.trim())
  fs.writeFileSync(path.join(dest, 'altro.txt'), 'resta')
  assert.strictEqual(bc(b, 'board-spegni', g).status, 4, 'spegnere con la board ancora accesa')
  g = await imposta(b, 'spenta')
  assert.strictEqual(bc(b, 'board-spegni', g).status, 0)
  assert.deepStrictEqual(fs.readdirSync(dest).sort(), ['.chipmanager-board', 'altro.txt', 'budget.json'])
  g = await imposta(b, 'riassunti')
  const budget = path.join(dest, 'budget.json')
  assert.strictEqual(JSON.parse(fs.readFileSync(budget, 'utf8')).usati, 3)
  fs.writeFileSync(budget, JSON.stringify({ ...JSON.parse(fs.readFileSync(budget, 'utf8')), usati: 100 }))
  assert.strictEqual(bc(b, 'board-prenota', g, ['oltre']).status, 5)
})

test('2.4 board: due pannelli prenotano la stessa impronta insieme: una prenotazione; una senza risposta non si ritenta', async () => {
  const b = preparaBoard()
  const g = await imposta(b, 'riassunti')
  const codici = await Promise.all(Array.from({ length: 6 }, () => bcAsync(b, 'board-prenota', g, ['stessa'])))
  assert.strictEqual(codici.filter(c => c === 0).length, 1, String(codici))
  assert.strictEqual(bc(b, 'board-finalizza', g, ['stessa'], JSON.stringify({ testo: 'Riassunto.' })).status, 0)
  assert.strictEqual(bc(b, 'board-finalizza', g, ['stessa'], JSON.stringify({ testo: 'Doppio.' })).status, 4)
  assert.strictEqual(bc(b, 'board-prenota', g, ['stessa']).status, 4)
  // Senza risposta (isAnswered: false) la prenotazione conta e la stessa impronta non si ritenta.
  assert.strictEqual(bc(b, 'board-prenota', g, ['muta']).status, 0)
  assert.strictEqual(bc(b, 'board-finalizza', g, ['muta'], '{}').status, 0)
  assert.strictEqual(bc(b, 'board-prenota', g, ['muta']).status, 4)
  const dest = path.dirname(bc(b, 'board-scrivi', g, ['h'], HTML).stdout.trim())
  const voci = JSON.parse(fs.readFileSync(path.join(dest, 'riassunti.json'), 'utf8')).voci
  assert.deepStrictEqual([voci.stessa.stato, voci.stessa.testo, voci.muta.stato], ['fatto', 'Riassunto.', 'fallita'])
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(dest, 'budget.json'), 'utf8')).usati, 2)
})

test('2.4 board: identità completa nel marcatore; due progetti con lo stesso nome pulito non si incontrano', async () => {
  const b1 = preparaBoard('C:/work/a b')
  const b2 = { ...b1, repo: 'C:/work/a_b' }
  const g1 = await imposta(b1, 'accesa')
  const g2 = await imposta(b2, 'accesa')
  const d1 = path.dirname(bc(b1, 'board-scrivi', g1, ['h'], HTML).stdout.trim())
  const d2 = path.dirname(bc(b2, 'board-scrivi', g2, ['h'], HTML).stdout.trim())
  assert.notStrictEqual(d1, d2)
  assert.strictEqual(fs.readFileSync(path.join(d1, '.chipmanager-board'), 'utf8'), 'C:/work/a b')
  fs.writeFileSync(path.join(d1, '.chipmanager-board'), 'C:/work/a_b')
  assert.strictEqual(bc(b1, 'board-scrivi', g1, ['h2'], HTML).status, 4)
  const s1 = await imposta(b1, 'spenta')
  assert.strictEqual(bc(b1, 'board-spegni', s1).status, 4)
  assert.ok(fs.existsSync(path.join(d1, 'index.html')))
})

test('2.4 board: junction nel percorso o cartella dentro un working tree: board rifiutata', async () => {
  const b = preparaBoard()
  const g = await imposta(b, 'accesa')
  const altrove = fuori()
  fs.symlinkSync(altrove, path.join(b.cartella, 'board'), process.platform === 'win32' ? 'junction' : 'dir')
  const r = bc(b, 'board-scrivi', g, ['h'], HTML)
  assert.strictEqual(r.status, 6, r.stdout)
  assert.deepStrictEqual(fs.readdirSync(altrove), [])
  const repo = fuori()
  assert.strictEqual(spawnSync('git', ['init', '-q', repo]).status, 0)
  const dentro = { ...preparaBoard(), cartella: path.join(repo, 'dati') }
  fs.mkdirSync(dentro.cartella)
  const gd = await imposta(dentro, 'accesa')
  const rd = bc(dentro, 'board-scrivi', gd, ['h'], HTML)
  assert.strictEqual(rd.status, 6)
  assert.match(rd.stdout, /working tree/)
  assert.strictEqual(fs.existsSync(path.join(dentro.cartella, 'board')), false)
})

test('2.4 leggi-piano: solo file regolari sotto la radice reale; link fuori rifiutati; oltre 200 KB troncato', () => {
  const root = fuori()
  fs.mkdirSync(path.join(root, 'docs'))
  fs.writeFileSync(path.join(root, 'docs', 'p.md'), '# piano')
  let r = esegui(['leggi-piano', root, 'docs/p.md'])
  assert.strictEqual(r.status, 0, r.stdout)
  assert.deepStrictEqual(JSON.parse(r.stdout), { testo: '# piano', troncato: false })
  fs.writeFileSync(path.join(root, 'docs', 'grande.txt'), 'x'.repeat(250 * 1024))
  const g = JSON.parse(esegui(['leggi-piano', root, 'docs/grande.txt']).stdout)
  assert.deepStrictEqual([g.testo.length, g.troncato], [200 * 1024, true])
  for (const no of ['../fuori.md', 'docs/../../x.md', '/x.md', 'C:x.md', '\\\\?\\C:\\x.md', '\\\\srv\\s\\x.md', 'docs/p.md:alt', 'docs/p.pdf'])
    assert.strictEqual(esegui(['leggi-piano', root, no]).status, 4, no)
  const altrove = fuori()
  fs.writeFileSync(path.join(altrove, 'segreto.md'), 'non deve uscire')
  fs.symlinkSync(altrove, path.join(root, 'ponte'), process.platform === 'win32' ? 'junction' : 'dir')
  r = esegui(['leggi-piano', root, 'ponte/segreto.md'])
  assert.strictEqual(r.status, 4)
  assert.doesNotMatch(r.stdout, /non deve uscire/)
  fs.mkdirSync(path.join(root, 'cartella.md'))
  assert.strictEqual(esegui(['leggi-piano', root, 'cartella.md']).status, 4)
})

test('2.4 git-log: oggetto, data e SHA corto del ramo base, al massimo 15', () => {
  const repo = fuori()
  const git = (...a) => spawnSync('git', ['-C', repo, '-c', 'user.name=prova', '-c', 'user.email=prova@example.invalid', ...a], { encoding: 'utf8' })
  git('init', '-q', '-b', 'main')
  for (let i = 0; i < 17; i++) git('commit', '-q', '--allow-empty', '-m', `commit ${i} <b>`)
  const r = esegui(['git-log', repo])
  assert.strictEqual(r.status, 0, r.stdout)
  const l = JSON.parse(r.stdout)
  assert.strictEqual(l.length, 15)
  assert.strictEqual(l[0].oggetto, 'commit 16 <b>')
  assert.match(l[0].sha, /^[0-9a-f]{7,12}$/)
  assert.ok(Number.isFinite(Date.parse(l[0].data)))
})

test('2.4 date: ogni cambio di stato di un\'azione passa da transizione()', () => {
  // Ogni sorgente dei hooks, così un file nuovo (una vista, un modulo) non esce dal controllo.
  const cartella = path.join(__dirname, '..', 'hooks')
  const file = fs.readdirSync(cartella).filter(n => /\.tsx?$/.test(n))
  for (const f of ['register.tsx', 'pannello.tsx', 'vista-lavoro.tsx', 'logica.ts']) assert.ok(file.includes(f), f)
  for (const f of file) {
    const righe = fs.readFileSync(path.join(cartella, f), 'utf8').split('\n')
    // Fuori da transizione() restano solo: la sua firma, i commenti, lo stato delle sessioni (in-corso / ferma),
    // schema dello strumento, larghezze di colonna e la creazione di un record nuovo.
    const scritte = righe
      .map((r, i) => ({ r: r.trim(), dove: `${f}:${i + 1}` }))
      .filter(({ r }) => !r.startsWith('//') && !r.startsWith('export function transizione('))
      .map(({ r, dove }) => `${dove}: ${r}`)
      .filter(r => /\bstato: /.test(r) && !/\bstato: (s\.isRunning|'in-corso'|fermaOra|inCorso|s\.inCorso|\{ type:|string;|'\d+%')/.test(r) && !r.includes('// record nuovo'))
    assert.deepStrictEqual(scritte, [])
  }
})

// --- 2.4 correzioni dopo la revisione ------------------------------------------------------------------

test('2.4 riassunti: la politica si ricontrolla sotto lock a ogni prenotazione (soloLocale, Claude vietato)', async () => {
  const b = preparaBoard()
  const g = await imposta(b, 'riassunti')
  assert.strictEqual(bc(b, 'board-prenota', g, ['prima']).status, 0)
  const cambia = async campi => {
    const atteso = fs.readFileSync(b.config, 'utf8')
    assert.strictEqual(await configura(b.config, { atteso, repo: b.repo, campi }), 0)
  }
  await cambia({ soloLocale: true })
  assert.strictEqual(bc(b, 'board-prenota', g, ['seconda']).status, 4)
  await cambia({ soloLocale: false, fornitori: ['codex'] })
  assert.strictEqual(bc(b, 'board-prenota', g, ['terza']).status, 4)
  await cambia({ fornitori: ['claude', 'codex'] })
  assert.strictEqual(bc(b, 'board-prenota', g, ['quarta']).status, 0)
})

test('2.4 board: un errore di git non vale «fuori dal working tree»: scrittura bloccata con il motivo', async () => {
  const b = preparaBoard()
  const g = await imposta(b, 'accesa')
  const rotta = path.join(fuori(), 'gitconfig-rotta')
  fs.writeFileSync(rotta, '[core\n  questa non è una configurazione')
  const r = spawnSync(process.execPath, [DISCO, 'board-scrivi', b.config, b.cartella, b.repo, String(g), 'h'], {
    input: HTML, encoding: 'utf8', env: { ...process.env, GIT_CONFIG_GLOBAL: rotta },
  })
  assert.strictEqual(r.status, 6, r.stdout)
  assert.match(r.stdout, /git/)
  assert.strictEqual(fs.existsSync(path.join(b.cartella, 'board')), false)
  // Con git sano la stessa cartella passa.
  assert.strictEqual(bc(b, 'board-scrivi', g, ['h'], HTML).status, 0)
})

test('2.4 git-log: il ramo base locale, non origin/HEAD né il ramo del task', () => {
  const repo = fuori()
  const git = (...a) => spawnSync('git', ['-C', repo, '-c', 'user.name=prova', '-c', 'user.email=prova@example.invalid', ...a], { encoding: 'utf8' })
  git('init', '-q', '-b', 'main')
  git('commit', '-q', '--allow-empty', '-m', 'base remota')
  // origin/main resta indietro: il commit locale di main deve comparire.
  git('update-ref', 'refs/remotes/origin/main', 'HEAD')
  git('symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/main')
  git('commit', '-q', '--allow-empty', '-m', 'locale su main')
  // Il checkout è sul ramo del task: i suoi commit non sono del ramo base.
  git('checkout', '-q', '-b', 'task')
  git('commit', '-q', '--allow-empty', '-m', 'lavoro del task')
  const l = JSON.parse(esegui(['git-log', repo]).stdout)
  assert.deepStrictEqual(l.map(c => c.oggetto), ['locale su main', 'base remota'])
  // Un altro nome di ramo base locale (master), senza remoto.
  const altro = fuori()
  const g2 = (...a) => spawnSync('git', ['-C', altro, '-c', 'user.name=prova', '-c', 'user.email=prova@example.invalid', ...a], { encoding: 'utf8' })
  g2('init', '-q', '-b', 'master')
  g2('commit', '-q', '--allow-empty', '-m', 'su master')
  g2('checkout', '-q', '-b', 'task')
  g2('commit', '-q', '--allow-empty', '-m', 'del task')
  assert.deepStrictEqual(JSON.parse(esegui(['git-log', altro]).stdout).map(c => c.oggetto), ['su master'])
})

test('2.4 riassunti: politica non valida sotto lock (tipi o fornitori ignoti) = nessuna prenotazione', async () => {
  for (const guasto of [{ soloLocale: 'true' }, { fornitori: ['claude', 'NON_VALIDO'] }, { fornitori: 'claude' }, { soloLocale: 1 }]) {
    const b = preparaBoard()
    const g = await imposta(b, 'riassunti')
    // Scrittura a mano del config: `configura` non accetterebbe questi valori.
    const c = JSON.parse(fs.readFileSync(b.config, 'utf8'))
    Object.assign(c.progetti[b.repo], guasto)
    fs.writeFileSync(b.config, JSON.stringify(c))
    assert.strictEqual(bc(b, 'board-prenota', g, ['x']).status, 4, JSON.stringify(guasto))
  }
})

test('2.4.2 corsia Codex: in produzione il mutex della macchina è uno solo, nessuna variabile d\'ambiente lo cambia', () => {
  assert.strictEqual(require(DISCO).MUTEX_CODEX, 'codex:corsia-della-macchina')
  assert.ok(!/CHIPMANAGER_PROVA/.test(fs.readFileSync(DISCO, 'utf8')))
  // Con la variabile che la prima versione di questa fase leggeva, il nome resta quello della macchina.
  const r = spawnSync(process.execPath, ['-e', `process.stdout.write(require(${JSON.stringify(DISCO)}).MUTEX_CODEX)`],
    { env: { ...process.env, CHIPMANAGER_PROVA_MUTEX_CODEX: 'prova:altro' }, encoding: 'utf8' })
  assert.strictEqual(r.stdout, 'codex:corsia-della-macchina')
})

test('2.4.2 cache Codex: session_meta scritto in due tempi, anche come prima riga, si acquisisce a cache calda', async () => {
  const { home, f } = codexDiProva()
  fs.writeFileSync(f, metaEs.slice(0, 30))
  assert.deepStrictEqual((await fonti.sessioniCodexLocali(home)).sessioni, [])
  fs.appendFileSync(f, metaEs.slice(30) + avvio)
  const s = await unaSessione(home)
  assert.strictEqual(s?.id, 'sessione-esempio')
  assert.strictEqual(s.stato, 'aperto')
})

test('2.4.2 cache Codex: una voce con un campo non valido (limite al 101%) si scarta intera e si ricostruisce', async () => {
  const { home, f } = codexDiProva()
  fs.writeFileSync(f, metaEs + limite(37, '2026-11-05T10:00:00Z'))
  assert.strictEqual((await fonti.codexLocale(home))[0].percentuale, 37)
  const cache = JSON.parse(fs.readFileSync(fonti.fileCache(home), 'utf8'))
  for (const v of Object.values(cache.voci)) v.limiti[0].percentuale = 101
  fs.writeFileSync(fonti.fileCache(home), JSON.stringify(cache))
  assert.strictEqual((await fonti.codexLocale(home))[0]?.percentuale, 37)
  // Anche un campo estraneo invalida la voce.
  const pulita = JSON.parse(fs.readFileSync(fonti.fileCache(home), 'utf8'))
  for (const v of Object.values(pulita.voci)) v.testo = 'privato'
  fs.writeFileSync(fonti.fileCache(home), JSON.stringify(pulita))
  const r = await fonti.sessioniCodexLocali(home)
  assert.strictEqual(r.diagnostica.aperti, 1)
  assert.ok(!fs.readFileSync(fonti.fileCache(home), 'utf8').includes('privato'))
})

test('2.4.2 cache Codex: dopo un salto tutti gli ultimi campi vengono dalla sola coda, come a cache fredda', async () => {
  const { home, f } = codexDiProva()
  fs.writeFileSync(f, metaEs + ev('turn_context', { model: 'modello-a', effort: 'high' }) + avvio +
    ev('event_msg', { type: 'token_count', info: { last_token_usage: { total_tokens: 5000 }, model_context_window: 100_000 } }))
  assert.strictEqual((await unaSessione(home)).token, 5000)
  fs.appendFileSync(f, riempi(600))
  const calda = await unaSessione(home)
  fs.rmSync(fonti.fileCache(home))
  const fredda = await unaSessione(home)
  assert.deepStrictEqual(calda, fredda)
  assert.strictEqual(calda.token, undefined)
  assert.strictEqual(calda.modello, 'modello-a', 'il primo turno della testa resta')
})

test('2.4.2 cache Codex: una voce senza meta.id o senza meta.cwd non vale: si ricostruisce e la sessione resta', async () => {
  for (const campo of ['id', 'cwd']) {
    const { home, f } = codexDiProva()
    fs.writeFileSync(f, metaEs + avvio)
    const giusta = await unaSessione(home)
    assert.strictEqual(giusta.id, 'sessione-esempio')
    const cache = JSON.parse(fs.readFileSync(fonti.fileCache(home), 'utf8'))
    for (const v of Object.values(cache.voci)) delete v.meta[campo]
    fs.writeFileSync(fonti.fileCache(home), JSON.stringify(cache))
    const r = await fonti.sessioniCodexLocali(home)
    assert.strictEqual(r.diagnostica.aperti, 1, `senza meta.${campo} la voce si rilegge`)
    assert.deepStrictEqual(r.sessioni[0], giusta)
  }
})

// --- F4: proposte di pesi, con l'helper vero ------------------------------------------------------------
const { pesiProponi, pesiDecidi, pesiAnnulla } = require(DISCO)
const REPO_PESI = 'esempio/demo'
const EFFORT_LOW = { tipo: 'effort', nome: 'low', percentuale: 40, assoluto: 0 }
const arresto = { dopoConfig: () => { throw new Error('arresto simulato') } }
function ambientePesi() {
  const dir = tmp()
  const a = { config: path.join(dir, 'config.json'), proposte: path.join(dir, 'proposte-pesi.json') }
  fs.writeFileSync(a.config, JSON.stringify({ progetti: { [REPO_PESI]: { fornitori: ['claude'] }, 'altro/progetto': { fornitori: ['codex'] } } }))
  a.testo = () => fs.readFileSync(a.config, 'utf8')
  a.leggi = () => JSON.parse(a.testo()).progetti[REPO_PESI]
  a.voci = () => JSON.parse(fs.readFileSync(a.proposte, 'utf8')).voci
  a.scriviVoci = f => { const p = JSON.parse(fs.readFileSync(a.proposte, 'utf8')); f(p.voci); fs.writeFileSync(a.proposte, JSON.stringify(p)) }
  return a
}
const proposta = (risultato = { profilo: 'risparmio', pesi: [EFFORT_LOW] }, partenza = { profilo: null, pesi: [] }, revisione = 0) =>
  ({ repo: REPO_PESI, proponente: { id: 'sessione-esempio', titolo: 'Master' }, motivo: 'Claude settimanale al 78%', profilo: risultato.profilo, partenza, revisione, risultato })
async function proponi(a, q = proposta()) {
  const [codice, testo] = await pesiProponi(a.config, q)
  assert.strictEqual(codice, 0, testo)
  return JSON.parse(testo)
}
/** `pesi-decidi` in un processo suo, come lo chiama il pannello. */
const decidi = (a, id, versione, esito, chiave) =>
  new Promise(r => {
    const p = spawn(process.execPath, [ENTRATA, 'pesi-decidi', a.config, REPO_PESI, id, String(versione), esito, chiave])
    let testo = ''
    p.stdout.on('data', d => { testo += d })
    p.on('exit', codice => r({ codice, testo }))
  })

test('F4 pesi: due processi decidono la stessa voce insieme: una sola applicazione, altri progetti intatti', async () => {
  const a = ambientePesi()
  const { id } = await proponi(a)
  const esiti = await Promise.all([decidi(a, id, 0, 'applica', 'd-primo00001'), decidi(a, id, 0, 'applica', 'd-second0001')])
  assert.deepStrictEqual(esiti.map(x => x.codice).sort(), [0, 4])
  const v = a.voci()[0]
  assert.deepStrictEqual([v.stato, a.leggi().pesiRevisione, a.leggi().pesiOrigine.id], ['applicata', 1, v.decisione.id])
  assert.deepStrictEqual([a.leggi().profilo, a.leggi().pesi, a.leggi().fornitori], ['risparmio', [EFFORT_LOW], ['claude']])
  assert.deepStrictEqual(JSON.parse(a.testo()).progetti['altro/progetto'], { fornitori: ['codex'] })
})

test('F4 pesi: chiave di decisione idempotente; altra chiave o versione vecchia rifiutate', async () => {
  const a = ambientePesi()
  const { id } = await proponi(a)
  assert.strictEqual((await decidi(a, id, 1, 'applica', 'd-vecchia001')).codice, 4)
  assert.strictEqual((await decidi(a, id, 0, 'applica', 'd-chiave0001')).codice, 0)
  // La risposta si perde e il pannello ritenta con la stessa chiave: ok, nessuna seconda applicazione.
  const ritento = await decidi(a, id, 0, 'applica', 'd-chiave0001')
  assert.deepStrictEqual([ritento.codice, JSON.parse(ritento.testo).stato, a.leggi().pesiRevisione], [0, 'applicata', 1])
  // Una risposta tardiva (popup aperto sulla versione 0) con un'altra chiave: rifiutata.
  const tardiva = await decidi(a, id, 0, 'rifiuta', 'd-chiave0002')
  assert.deepStrictEqual([tardiva.codice, tardiva.testo], [4, 'la proposta è cambiata, rivedi'])
  assert.strictEqual(a.voci()[0].stato, 'applicata')
})

test('F4 pesi: proposta nuova mentre un\'altra è in revisione: entrambe visibili, decisioni indipendenti', async () => {
  const a = ambientePesi()
  const p1 = (await proponi(a)).id
  const p2 = (await proponi(a, proposta({ profilo: 'qualita', pesi: [] }))).id
  const p3 = (await proponi(a, proposta({ profilo: 'velocita', pesi: [] }))).id
  assert.deepStrictEqual(a.voci().map(v => v.stato), ['attesa', 'attesa', 'attesa'])
  assert.strictEqual((await decidi(a, p1, 0, 'rifiuta', 'd-rifiuto001')).codice, 0)
  assert.strictEqual((await decidi(a, p2, 0, 'applica', 'd-applica001')).codice, 0)
  // La terza partiva dalla configurazione di prima: non si applica sopra quella nuova.
  assert.deepStrictEqual(await decidi(a, p3, 0, 'applica', 'd-applica002'), { codice: 4, testo: 'la configurazione è cambiata dalla proposta: rivedi' })
  assert.deepStrictEqual([a.voci().map(v => v.stato), a.leggi().profilo], [['rifiutata', 'applicata', 'attesa'], 'qualita'])
})

test('F4 pesi: arresto dopo il config di un\'applicazione: la configura successiva recupera prima di scrivere', async () => {
  const a = ambientePesi()
  const { id } = await proponi(a)
  await assert.rejects(pesiDecidi(a.config, REPO_PESI, id, 0, 'applica', 'd-arresto001', arresto))
  assert.deepStrictEqual([a.voci()[0].stato, a.leggi().pesiOrigine], ['attesa', { tipo: 'proposta', id: 'd-arresto001', voce: id, versione: 0 }])
  // Il file delle proposte sta accanto al config, qualunque sia la cartella dei dati della sessione.
  assert.strictEqual(path.dirname(a.proposte), path.dirname(a.config))
  // Con il file delle proposte illeggibile il recupero non si completa: nessuna scrittura che cancelli pesiOrigine.
  const prima = a.testo()
  const proposteSane = fs.readFileSync(a.proposte, 'utf8')
  fs.writeFileSync(a.proposte, '{"rotto":')
  assert.strictEqual(await configura(a.config, { atteso: prima, repo: REPO_PESI, campi: { pesi: [] } }), 4)
  assert.strictEqual(a.testo(), prima)
  fs.writeFileSync(a.proposte, proposteSane)
  assert.strictEqual(await configura(a.config, { atteso: prima, repo: REPO_PESI, campi: { profilo: 'qualita', pesi: [] } }), 0)
  const v = a.voci()[0]
  assert.deepStrictEqual([v.stato, v.decisione.id, v.decisione.revisione], ['applicata', 'd-arresto001', 1])
  assert.deepStrictEqual([a.leggi().pesiRevisione, a.leggi().pesiOrigine, a.leggi().profilo], [2, { tipo: 'manuale' }, 'qualita'])
})

test('F4 pesi: arresto dopo il config di un annullamento: la configura successiva lo completa', async () => {
  const a = ambientePesi()
  const { id } = await proponi(a)
  assert.strictEqual((await decidi(a, id, 0, 'applica', 'd-applica003')).codice, 0)
  await assert.rejects(pesiAnnulla(a.config, REPO_PESI, id, 'u-arresto001', arresto))
  assert.deepStrictEqual([a.voci()[0].stato, a.leggi().pesi, a.leggi().profilo, a.leggi().pesiRevisione], ['applicata', [], undefined, 2])
  assert.strictEqual(await configura(a.config, { atteso: a.testo(), repo: REPO_PESI, campi: { pesi: [EFFORT_LOW] } }), 0)
  const v = a.voci()[0]
  assert.deepStrictEqual([v.stato, v.annullamento.id, v.annullamento.revisione], ['annullata', 'u-arresto001', 2])
  assert.strictEqual(a.leggi().pesiRevisione, 3)
})

test('F4 pesi: due proposte con lo stesso risultato: si recupera solo quella indicata in pesiOrigine', async () => {
  const a = ambientePesi()
  const p1 = (await proponi(a)).id
  const p2 = (await proponi(a)).id
  await assert.rejects(pesiDecidi(a.config, REPO_PESI, p2, 0, 'applica', 'd-seconda001', arresto))
  // Anche un comando pesi-* recupera prima di fare altro.
  assert.strictEqual((await decidi(a, p1, 0, 'rifiuta', 'd-rifiuto002')).codice, 0)
  const [v1, v2] = a.voci()
  assert.deepStrictEqual([v1.stato, v1.decisione.id, v2.stato, v2.decisione.id], ['rifiutata', 'd-rifiuto002', 'applicata', 'd-seconda001'])
})

test('F4 pesi: Annulla ripristina la partenza; dopo una modifica manuale (anche risultato → altro → risultato) è rifiutato', async () => {
  const a = ambientePesi()
  const p1 = (await proponi(a)).id
  assert.strictEqual((await decidi(a, p1, 0, 'applica', 'd-applica004')).codice, 0)
  assert.strictEqual((await pesiAnnulla(a.config, REPO_PESI, p1, 'u-annulla001'))[0], 0)
  assert.deepStrictEqual([a.leggi().pesi, a.leggi().profilo, a.leggi().pesiRevisione, a.leggi().pesiOrigine.tipo], [[], undefined, 2, 'annullamento'])
  assert.strictEqual(a.voci()[0].stato, 'annullata')
  const p2 = (await proponi(a, proposta(undefined, { profilo: null, pesi: [] }, 2))).id
  assert.strictEqual((await decidi(a, p2, 0, 'applica', 'd-applica005')).codice, 0)
  for (const campi of [{ profilo: 'qualita', pesi: [] }, { profilo: 'risparmio', pesi: [EFFORT_LOW] }])
    assert.strictEqual(await configura(a.config, { atteso: a.testo(), repo: REPO_PESI, campi }), 0)
  const prima = a.testo()
  assert.deepStrictEqual(await pesiAnnulla(a.config, REPO_PESI, p2, 'u-tardivo001'), [4, 'la configurazione è cambiata dopo l\'applicazione'])
  assert.deepStrictEqual([a.testo(), a.voci()[1].stato], [prima, 'applicata'])
})

test('F4 pesi: un campo diverso da profilo o pesi è rifiutato, anche in un file manomesso, senza toccare il config', async () => {
  const a = ambientePesi()
  const prima = a.testo()
  for (const risultato of [{ profilo: 'risparmio', pesi: [], fornitori: ['codex'] }, { profilo: 'risparmio', pesi: [], soglie: {} }, { profilo: 'risparmio', pesi: [{ ...EFFORT_LOW, extra: 1 }] }])
    assert.strictEqual((await pesiProponi(a.config, proposta(risultato)))[0], 2)
  assert.strictEqual((await pesiProponi(a.config, { ...proposta(), soloLocale: true }))[0], 2)
  assert.strictEqual((await pesiProponi(a.config, { ...proposta(), motivo: 'x'.repeat(301) }))[0], 2)
  assert.strictEqual(fs.existsSync(a.proposte), false)
  const { id } = await proponi(a)
  a.scriviVoci(voci => { voci[0].risultato.fornitori = ['codex'] })
  assert.deepStrictEqual(await decidi(a, id, 0, 'applica', 'd-manomess01'), { codice: 4, testo: 'proposta non valida: solo profilo e pesi' })
  assert.strictEqual(a.testo(), prima)
})

test('F4 pesi: dopo 24 ore scade; oltre 3 in attesa la più vecchia scade e lo dice; al massimo 10 voci', async () => {
  const a = ambientePesi()
  const { id } = await proponi(a)
  a.scriviVoci(voci => { voci[0].quando = new Date(Date.now() - 25 * 3_600_000).toISOString() })
  assert.deepStrictEqual(await decidi(a, id, 0, 'applica', 'd-scaduta001'), { codice: 4, testo: 'la proposta è scaduta' })
  assert.strictEqual(a.voci()[0].stato, 'scaduta')
  const ids = []
  for (let i = 0; i < 12; i++) {
    const r = await proponi(a)
    if (i === 3) assert.deepStrictEqual(r.scadute, [ids[0]])
    ids.push(r.id)
  }
  const voci = a.voci()
  assert.strictEqual(voci.length, 10)
  assert.deepStrictEqual(voci.filter(v => v.stato === 'attesa').map(v => v.id), ids.slice(-3))
  assert.strictEqual(a.leggi().pesiRevisione, undefined, 'una proposta non cambia il config')
})

test('F4 contesto Codex: l\'istante è quello del token_count valido, non della data del file; cache calda e fredda uguali', async () => {
  const { home, f } = codexDiProva()
  const conto = (t, ts) => ev('event_msg', { type: 'token_count', info: { last_token_usage: { total_tokens: t }, model_context_window: 100_000 } }, ts)
  fs.writeFileSync(f, metaEs + avvio + conto(40_000, '2026-11-05T10:05:00Z'))
  assert.strictEqual((await unaSessione(home)).tokenIl, '2026-11-05T10:05:00Z')
  // Nuova attività senza token: il file cambia, la misura no.
  fs.appendFileSync(f, ev('event_msg', { type: 'task_complete' }, '2026-11-05T10:30:00Z') + avvio)
  const calda = await unaSessione(home)
  assert.deepStrictEqual([calda.token, calda.tokenIl], [40_000, '2026-11-05T10:05:00Z'])
  fs.rmSync(fonti.fileCache(home), { force: true })
  assert.strictEqual((await unaSessione(home)).tokenIl, '2026-11-05T10:05:00Z')
})
