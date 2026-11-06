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
  assert.strictEqual(rd.stdout.trim(), 'helper.dentroWorkingTree')
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
  // R1: quanti `git` sono partiti davvero, su stderr, per il contatore del pannello.
  const avviati = Number(/git=(\d+)/.exec(r.stderr)?.[1])
  assert.ok(avviati >= 2 && avviati <= 5, r.stderr)
})

test('lingue: nelle viste nessun testo fuori dal dizionario (testo fra i tag, label, titoli, didascalie)', () => {
  const cartella = path.join(__dirname, '..', 'hooks')
  const file = ['pannello.tsx', 'ui.tsx', ...fs.readdirSync(cartella).filter(n => /^vista-.*\.tsx$/.test(n))]
  assert.ok(file.length >= 5)
  // Le parole sono di almeno due lettere; segni (● ▲ ▶ ↑ ↓ — …), numeri e percentuali passano.
  const parola = /[A-Za-zÀ-ÿ]{2,}/
  const trovati = []
  for (const f of file) {
    // Senza commenti: un commento in italiano non è interfaccia.
    const testo = fs.readFileSync(path.join(cartella, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/ \/\/ .*$/gm, '')
    const vedi = (re, prendi = m => m[1]) => {
      for (const m of testo.matchAll(re)) if (parola.test(prendi(m))) trovati.push(`${f}: ${m[0].trim().slice(0, 90)}`)
    }
    vedi(/>([^<>{}]*)<\/[A-Za-z]/g)
    vedi(/\b(?:label|placeholder|submitLabel|header)="([^"]*)"/g)
    // Un'etichetta composta: tolti i `${…}`, non resta nessuna parola.
    vedi(/\b(?:label|placeholder|submitLabel)=\{`((?:[^`$]|\$\{[^}]*\})*)`\}/g, m => m[1].replace(/\$\{[^}]*\}/g, ''))
    // Proprietà di testo dei componenti e delle note: una frase (con spazi) scritta lì è fuori dal dizionario.
    vedi(/\b(?:titolo|descrizione|etichetta|testo|parola|stato): '([^']*\s[^']*)'/g)
    vedi(/\b(?:didascalia|nota1|titoloSezione)\([^()]*?'([^']*\s[^']*)'\s*[,)]/g)
  }
  assert.deepStrictEqual(trovati, [])
})

test('lingue: nessuna frase italiana nei letterali dei hooks (interfaccia, agenti, errori, note)', () => {
  // Fuori dai dizionari (hooks/lingue) il codice parla solo per chiavi o, verso gli agenti, in inglese. Si cercano parole
  // funzionali italiane in letterali di almeno due parole; i commenti non contano.
  const cartella = path.join(__dirname, '..', 'hooks')
  const ita = /(^|[^\p{L}])(della|delle|degli|dello|nella|nelle|che|con|una|sono|è|dal|alla|alle|ancora|nessun[ao]?|il|gli|lo|la|le|di|da|del|si|questa|questo|lette|non(?=\s))(?=[^\p{L}]|$)/iu
  const trovati = []
  for (const f of fs.readdirSync(cartella).filter(n => /\.tsx?$/.test(n))) {
    const testo = fs.readFileSync(path.join(cartella, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
    for (const m of testo.matchAll(/'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/g)) {
      const s = m[0].slice(1, -1).replace(/\$\{[^}]*\}/g, ' ')
      if (/\s/.test(s.trim()) && ita.test(s) && /[a-zà-ù]{3,}\s+[a-zà-ù]{2,}/i.test(s)) trovati.push(`${f}:${testo.slice(0, m.index).split('\n').length}: ${s.trim().slice(0, 80)}`)
    }
  }
  assert.deepStrictEqual(trovati, [])
})

test('F5.7: statusline Claude e Codex locale danno lo stesso utilizzo 0→100 per lo stesso consumo (nessun residuo)', () => {
  const letto = '2026-11-06T10:00:00Z'
  const claude = fonti.finestreClaude({ rate_limits: { seven_day: { used_percentage: 37 } } }, letto, 'statusline')
  const codex = fonti.finestreCodex({ type: 'event_msg', timestamp: letto, payload: { type: 'token_count', rate_limits: { primary: { used_percent: 37 } } } })
  assert.deepStrictEqual([...claude, ...codex].map(l => [l.percentuale, l.unita]), [[37, '%'], [37, '%']])
})

test('legenda: i README ricopiano la legenda del dizionario voce per voce (en e it), più la storia dello sviluppo', () => {
  const radice = path.join(__dirname, '..')
  const intestazioni = ['legenda.descrizione', 'legenda.corsie', 'legenda.termini', 'legenda.rimando']
  const dizionario = l =>
    [...fs.readFileSync(path.join(radice, 'hooks', 'lingue', `${l}.ts`), 'utf8').matchAll(/^\s*"(legenda\.[a-z0-9]+)": (".*"),\r?$/gm)]
      .filter(m => !intestazioni.includes(m[1]))
      .map(m => JSON.parse(m[2]))
  for (const [file, l, titolo, storia] of [['README.md', 'en', 'Legend', 'Development history'], ['README.it.md', 'it', 'Legenda', 'Storia dello sviluppo']]) {
    const md = fs.readFileSync(path.join(radice, file), 'utf8').replace(/\r\n/g, '\n')
    const da = md.indexOf(`\n## ${titolo}\n`)
    assert.ok(da >= 0, `${file}: manca «## ${titolo}»`)
    const sezione = md.slice(da + 1, md.indexOf('\n## ', da + 1))
    const voci = dizionario(l)
    assert.strictEqual(voci.length, 18, `${l}: voci della legenda`)
    assert.deepStrictEqual([...sezione.matchAll(/^- (.*)$/gm)].map(m => m[1]), voci, file)
    assert.match(md, new RegExp(`\\n## ${storia}\\n[^]*?\\(docs/`), `${file}: «${storia}» rimanda a docs/`)
  }
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
  assert.deepStrictEqual([tardiva.codice, tardiva.testo], [4, 'helper.cambiata'])
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
  assert.deepStrictEqual(await decidi(a, p3, 0, 'applica', 'd-applica002'), { codice: 4, testo: 'helper.primaDellaProposta' })
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
  assert.deepStrictEqual(await pesiAnnulla(a.config, REPO_PESI, p2, 'u-tardivo001'), [4, 'helper.dopoApplicazione'])
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
  assert.deepStrictEqual(await decidi(a, id, 0, 'applica', 'd-manomess01'), { codice: 4, testo: 'helper.campi' })
  assert.strictEqual(a.testo(), prima)
})

test('F4 pesi: dopo 24 ore scade; oltre 3 in attesa la più vecchia scade e lo dice; al massimo 10 voci', async () => {
  const a = ambientePesi()
  const { id } = await proponi(a)
  a.scriviVoci(voci => { voci[0].quando = new Date(Date.now() - 25 * 3_600_000).toISOString() })
  assert.deepStrictEqual(await decidi(a, id, 0, 'applica', 'd-scaduta001'), { codice: 4, testo: 'helper.scaduta' })
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

test('R16: nessun export morto di modelli in logica (MODELLI non usato)', () => {
  const logica = fs.readFileSync(path.join(__dirname, '..', 'hooks', 'logica.ts'), 'utf8')
  assert.doesNotMatch(logica, /export const MODELLI\b/)
})

test('R11: il comando sessioni scrive l\'istantanea versionata e atomica accanto alla cache, con la stessa risposta', () => {
  const home = tmp()
  const r = spawnSync(process.execPath, [path.join(__dirname, 'fornitori.cjs'), 'sessioni'], { input: '{}', encoding: 'utf8', env: { ...process.env, USERPROFILE: home, HOME: home } })
  assert.strictEqual(r.status, 0, r.stderr)
  const risposta = JSON.parse(r.stdout)
  const cartella = path.join(home, '.claude', 'chipmanager', 'cache')
  const istantanea = JSON.parse(fs.readFileSync(path.join(cartella, 'sessioni.json'), 'utf8'))
  assert.strictEqual(istantanea.v, 1)
  assert.ok(Math.abs(Date.now() - Date.parse(istantanea.istante)) < 60_000)
  assert.deepStrictEqual(istantanea.sessioni, risposta.sessioni)
  // Nessun file temporaneo rimasto: la scrittura è un rename.
  assert.deepStrictEqual(fs.readdirSync(cartella).filter(n => n.startsWith('sessioni') && n !== 'sessioni.json'), [])
})

// --- F6.2: corsia «API Claude» (nessuna chiamata a pagamento: processi finti) -------------------------------------
const API = require('./api-claude.cjs')
const CHIAVE_PROVA = 'sk-ant-prova-0123456789'
const { EventEmitter: Emettitore } = require('node:events')
/** Un `claude -p` finto: emette lo spawn, accetta il prompt, scrive `uscita` su stdout ed esce con `codice`. */
const claudeFinto = (uscita, codice = 0, durante = () => {}) => (argv, opzioni) => {
  const p = new Emettitore()
  p.pid = 424242
  p.stdout = new Emettitore()
  p.stdin = new Emettitore()
  p.stdin.end = () => setImmediate(async () => {
    await durante(argv, opzioni)
    p.stdout.emit('data', Buffer.from(uscita))
    p.emit('exit', codice)
    p.emit('close', codice)
  })
  queueMicrotask(() => p.emit('spawn'))
  return p
}
const ingressoApi = root => ({ root, prompt: 'Lavoro di prova.', modello: 'claude-opus-5-5', effort: 'high', permessi: 'acceptEdits', tetto: 2, budget: 5, mese: '2026-11', chiave: CHIAVE_PROVA })
const recordApi = (dir, id, tentativo) => fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify({ stato: 'in-avvio', lanciatore: 'api-claude', tentativo }))
const fontiPulite = dir => ['utente', 'progetto', 'locale', 'gestite'].map(nome => ({ nome, file: path.join(dir, `${nome}.json`) }))
const supervisoreFinto = stdin => () => {
  const p = new Emettitore()
  p.stdin = new Emettitore()
  p.stdin.end = t => stdin.push(t)
  queueMicrotask(() => p.emit('spawn'))
  return p
}

test('F6.2 impostazioni: ogni fonte (utente, progetto, locale, gestite) e l\'ambiente bloccano api-claude; una fonte illeggibile blocca', () => {
  const dir = tmp()
  const fonti = fontiPulite(dir)
  assert.deepStrictEqual(API.blocchiImpostazioni(fonti, {}), [])
  const vietate = [{ env: { ANTHROPIC_BASE_URL: 'http://x' } }, { env: { ANTHROPIC_AUTH_TOKEN: 't' } }, { env: { ANTHROPIC_API_KEY: 'k' } },
    { env: { CLAUDE_CODE_USE_BEDROCK: '1' } }, { apiKeyHelper: 'x' }, { forceLoginMethod: 'claudeai' }, { forceLoginOrgUUID: 'u' }]
  for (const f of fonti)
    for (const v of vietate) {
      fs.writeFileSync(f.file, JSON.stringify(v))
      assert.deepStrictEqual([f.nome, API.blocchiImpostazioni(fonti, {})], [f.nome, [f.nome]])
      fs.rmSync(f.file)
    }
  fs.writeFileSync(fonti[1].file, '{ non json')
  assert.deepStrictEqual(API.blocchiImpostazioni(fonti, {}), ['progetto'])
  fs.rmSync(fonti[1].file)
  assert.deepStrictEqual(API.blocchiImpostazioni(fonti, { ANTHROPIC_API_KEY: 'k' }), ['ambiente'])
  // Il valore non compare mai: si nomina solo la fonte.
  fs.writeFileSync(fonti[0].file, JSON.stringify({ env: { ANTHROPIC_API_KEY: CHIAVE_PROVA } }))
  assert.ok(!JSON.stringify(API.blocchiImpostazioni(fonti, {})).includes(CHIAVE_PROVA))
})

test('F6.2 spesa: il tetto si prenota sul budget del mese, la contabilizzazione è idempotente e un costo ignoto vale il tetto', async () => {
  const dir = tmp()
  assert.strictEqual(API.prenotaSpesa(dir, 'az-spesa01', '2026-11', 2, 5), true)
  assert.strictEqual(API.prenotaSpesa(dir, 'az-spesa01', '2026-11', 2, 5), true)
  assert.strictEqual(API.prenotaSpesa(dir, 'az-spesa02', '2026-11', 2, 5), true)
  assert.strictEqual(API.prenotaSpesa(dir, 'az-spesa03', '2026-11', 2, 5), false)
  await API.contaSpesa(dir, 'az-spesa01', 0.4)
  await API.contaSpesa(dir, 'az-spesa01', 9)
  await API.contaSpesa(dir, 'az-spesa02', null)
  const s = API.leggiSpesa(dir)
  assert.deepStrictEqual([s.voci['az-spesa01'].costo, s.voci['az-spesa02'].costo], [0.4, null])
  assert.strictEqual(API.spesoNelMese(s.voci, '2026-11'), 2.4)
  assert.strictEqual(API.prenotaSpesa(dir, 'az-spesa03', '2026-11', 2, 5), true)
  assert.strictEqual(API.prenotaSpesa(dir, 'az-spesa04', '2026-12', 2, 5), true)
})

test('F6.2 avvio: lock della macchina e spesa prenotati prima del processo; un secondo avvio non parte; budget e impostazioni bloccano', async () => {
  const dir = tmp()
  const dm = tmp()
  const root = tmp()
  recordApi(dir, 'a-api00001', 'az-api0001')
  recordApi(dir, 'a-api00002', 'az-api0002')
  const stdin = []
  const deps = { dirMacchina: dm, fonti: fontiPulite(root), env: {}, supervisore: supervisoreFinto(stdin) }
  assert.deepStrictEqual(await API.lanciaApi(dir, 'a-api00001', 'az-api0001', ingressoApi(root), deps), [0, ''])
  const lock = fs.readFileSync(API.fileLock(dm), 'utf8')
  assert.strictEqual(JSON.parse(lock).stato, 'in-avvio')
  assert.ok(!lock.includes(CHIAVE_PROVA))
  assert.ok(!fs.readFileSync(path.join(dir, 'esecuzioni', 'az-api0001.json'), 'utf8').includes(CHIAVE_PROVA))
  // La chiave viaggia solo su stdin del supervisore.
  assert.strictEqual(JSON.parse(stdin[0]).chiave, CHIAVE_PROVA)
  const [codice, testo] = await API.lanciaApi(dir, 'a-api00002', 'az-api0002', ingressoApi(root), deps)
  assert.deepStrictEqual([codice, JSON.parse(testo).motivo], [3, 'senza-pid'])
  // Lock libero: il budget (5 USD, 2 già prenotati) e le impostazioni decidono.
  const dm2 = tmp()
  assert.strictEqual((await API.lanciaApi(dir, 'a-api00002', 'az-api0002', { ...ingressoApi(root), tetto: 4 }, { ...deps, dirMacchina: dm2 }))[0], 5)
  assert.strictEqual((await API.lanciaApi(dir, 'a-api00002', 'az-api0002', ingressoApi(root), { ...deps, dirMacchina: dm2, env: { ANTHROPIC_API_KEY: 'k' } }))[0], 6)
  assert.strictEqual(fs.existsSync(API.fileLock(dm2)), false)
})

test('F6.2 supervisore: niente chiave nell\'ambiente o su argv; helper con TTL esplicito; file-chiave solo durante l\'esecuzione; esito e costo contabilizzati', async () => {
  const dir = tmp()
  const dm = tmp()
  const root = tmp()
  recordApi(dir, 'a-api00003', 'az-api0003')
  const deps = { dirMacchina: dm, fonti: fontiPulite(root), env: {}, supervisore: supervisoreFinto([]) }
  assert.strictEqual((await API.lanciaApi(dir, 'a-api00003', 'az-api0003', ingressoApi(root), deps))[0], 0)
  const helper = (k, c) => spawnSync(process.execPath, [path.join(__dirname, 'chiave-api.cjs'), k, c], { encoding: 'utf8' })
  let visto
  const uscita = JSON.stringify({ type: 'result', is_error: false, total_cost_usd: 0.42, num_turns: 3, result: `Fatto. La chiave era ${CHIAVE_PROVA}` })
  const codice = await API.eseguiApi(dir, 'a-api00003', 'az-api0003', ingressoApi(root), {
    dirMacchina: dm, git: () => 'a'.repeat(40), elenco: () => [], fontiCwd: () => fontiPulite(root),
    env: { PATH: process.env.PATH, ANTHROPIC_BASE_URL: 'http://altrove', ANTHROPIC_AUTH_TOKEN: 'token', CLAUDECODE: '1' },
    avvia: claudeFinto(uscita, 0, (argv, opzioni) => {
      visto = { argv, env: opzioni.env }
      const settings = JSON.parse(argv[argv.indexOf('--settings') + 1])
      const [, , k, c] = settings.apiKeyHelper.match(/"([^"]+)"/g).map(x => x.slice(1, -1))
      assert.strictEqual(helper(k, c).stdout, CHIAVE_PROVA)
      assert.ok(Number.isFinite(Date.parse(fs.readFileSync(c, 'utf8'))))
    }),
  })
  assert.strictEqual(codice, 0)
  assert.deepStrictEqual(visto.argv.slice(0, 2), ['claude', '-p'])
  assert.strictEqual(visto.argv[visto.argv.indexOf('--max-budget-usd') + 1], '2')
  assert.ok(!visto.argv.join(' ').includes(CHIAVE_PROVA))
  for (const k of API.VIETATE) assert.strictEqual(visto.env[k], undefined)
  assert.strictEqual(visto.env.CLAUDE_CODE_API_KEY_HELPER_TTL_MS, '300000')
  // Dopo l'uscita il file-chiave non c'è più e l'helper non consegna niente.
  assert.strictEqual(fs.existsSync(API.fileChiave(dm, 'az-api0003')), false)
  assert.strictEqual(helper(API.fileChiave(dm, 'az-api0003'), API.fileConsegna(dm, 'az-api0003')).stdout, '')
  const esec = fs.readFileSync(path.join(dir, 'esecuzioni', 'az-api0003.json'), 'utf8')
  assert.deepStrictEqual([JSON.parse(esec).stato, JSON.parse(esec).costo], ['consegnata', 0.42])
  assert.ok(!esec.includes(CHIAVE_PROVA) && !esec.includes('sk-ant'))
  assert.strictEqual(API.leggiSpesa(dir).voci['az-api0003'].costo, 0.42)
  // Il lock resta finché non scade la copia in memoria della chiave (5 minuti dall'ultima consegna).
  assert.strictEqual((await API.statoApi(dm, { elenco: () => [] })).motivo, 'cache')
  assert.deepStrictEqual(await API.statoApi(dm, { elenco: () => [], adesso: () => Date.now() + API.TTL_MS + 1000 }), { libero: true, liberato: 'az-api0003' })
})

test('F6.2 supervisore: un esito illeggibile o troncato è incerto e conta il tetto intero, senza riavvio', async () => {
  const dir = tmp()
  const dm = tmp()
  const root = tmp()
  recordApi(dir, 'a-api00004', 'az-api0004')
  assert.strictEqual((await API.lanciaApi(dir, 'a-api00004', 'az-api0004', ingressoApi(root), { dirMacchina: dm, fonti: fontiPulite(root), env: {}, supervisore: supervisoreFinto([]) }))[0], 0)
  await API.eseguiApi(dir, 'a-api00004', 'az-api0004', ingressoApi(root), { dirMacchina: dm, git: () => 'a'.repeat(40), elenco: () => [], fontiCwd: () => fontiPulite(root), env: {}, avvia: claudeFinto('{"type":"result","total_c') })
  const esec = JSON.parse(fs.readFileSync(path.join(dir, 'esecuzioni', 'az-api0004.json'), 'utf8'))
  assert.deepStrictEqual([esec.stato, esec.incerto, esec.costo], ['avviata', true, null])
  assert.strictEqual(API.spesoNelMese(API.leggiSpesa(dir).voci, '2026-11'), 2)
})

test('F6.2 lock: senza uscita registrata nessuna liberazione automatica; «Libera» solo con file-chiave cancellato, nessun discendente e 5 minuti', async () => {
  const dir = tmp()
  const dm = tmp()
  const root = tmp()
  recordApi(dir, 'a-api00005', 'az-api0005')
  assert.strictEqual((await API.lanciaApi(dir, 'a-api00005', 'az-api0005', ingressoApi(root), { dirMacchina: dm, fonti: fontiPulite(root), env: {}, supervisore: supervisoreFinto([]) }))[0], 0)
  const dopo = () => Date.now() + API.TTL_MS + 1000
  // Crash fra la prenotazione e lo spawn: nessun PID. Né il censimento né il tempo la liberano da soli.
  assert.strictEqual((await API.statoApi(dm, { elenco: () => [], adesso: dopo })).motivo, 'senza-pid')
  // PID registrato e poi riusato da un altro processo: senza uscita registrata resta bloccata.
  const rec = JSON.parse(fs.readFileSync(API.fileLock(dm), 'utf8'))
  fs.writeFileSync(API.fileLock(dm), JSON.stringify({ ...rec, pid: 4242, creato: 1000, avvio: 1000 }))
  assert.strictEqual((await API.statoApi(dm, { elenco: () => [{ pid: '4242', ppid: '1', creato: 99999 }], adesso: dopo })).motivo, 'in-corso')
  // «Libera»: un discendente vivo la impedisce (si offre «Termina»), la cancellazione fallita anche, i 5 minuti pure.
  const figlio = [{ pid: '5151', ppid: '4242', creato: 2000 }]
  const r1 = await API.liberaApi(dm, { elenco: () => figlio, adesso: dopo })
  assert.deepStrictEqual([r1.libero, r1.motivo, r1.discendenti], [false, 'discendenti', ['5151']])
  const uccisi = []
  assert.deepStrictEqual(await API.terminaApi(dm, { elenco: () => figlio, uccidi: pid => uccisi.push(pid) }), { chiusi: 1 })
  assert.deepStrictEqual(uccisi, ['5151'])
  fs.mkdirSync(path.dirname(API.fileChiave(dm, 'az-api0005')), { recursive: true })
  fs.writeFileSync(API.fileChiave(dm, 'az-api0005'), CHIAVE_PROVA)
  assert.strictEqual((await API.liberaApi(dm, { elenco: () => [], adesso: dopo, rm: () => { throw new Error('EPERM') } })).motivo, 'chiave')
  assert.strictEqual((await API.liberaApi(dm, { elenco: () => [] })).motivo, 'cache')
  assert.deepStrictEqual(await API.liberaApi(dm, { elenco: () => [], adesso: dopo }), { libero: true, liberato: 'az-api0005' })
  assert.strictEqual(fs.existsSync(API.fileChiave(dm, 'az-api0005')), false)
  // Il costo di un tentativo liberato a mano è ignoto: conta il tetto intero.
  assert.deepStrictEqual(API.leggiSpesa(dir).voci['az-api0005'], { mese: '2026-11', tetto: 2, stato: 'contato', costo: null })
})

test('F6.2 lock: uscita registrata ma un discendente vivo: resta bloccato finché «Termina» o «Libera»', async () => {
  const dm = tmp()
  fs.writeFileSync(API.fileLock(dm), JSON.stringify({ tentativo: 'az-api0006', istante: new Date(0).toISOString(), pid: 4242, creato: 1000, avvio: 1000, uscita: { codice: 0, fine: new Date(0).toISOString() } }))
  const r = await API.statoApi(dm, { elenco: () => [{ pid: '6161', ppid: '4242', creato: 3000 }] })
  assert.deepStrictEqual([r.libero, r.motivo], [false, 'discendenti'])
  assert.deepStrictEqual(await API.statoApi(dm, { elenco: () => [] }), { libero: true, liberato: 'az-api0006' })
})

// --- F6.2, revisione: nel dubbio si blocca ------------------------------------------------------------------------

test('F6.2 rilievo 1: spawn fallito e cancellazione in EPERM: chiave presente, lock tenuto; la verifica dopo la ritenta e solo allora libera', async () => {
  const dir = tmp()
  const dm = tmp()
  const root = tmp()
  recordApi(dir, 'a-api00011', 'az-api0011')
  assert.strictEqual((await API.lanciaApi(dir, 'a-api00011', 'az-api0011', ingressoApi(root), { dirMacchina: dm, fonti: fontiPulite(root), env: {}, supervisore: supervisoreFinto([]) }))[0], 0)
  await API.eseguiApi(dir, 'a-api00011', 'az-api0011', ingressoApi(root), {
    dirMacchina: dm, git: () => 'a'.repeat(40), elenco: () => [], env: {}, fontiCwd: () => fontiPulite(root),
    avvia: () => { throw Object.assign(new Error('spawn claude ENOENT'), { code: 'ENOENT' }) },
    rm: () => { throw Object.assign(new Error('EPERM'), { code: 'EPERM' }) },
  })
  assert.strictEqual(fs.existsSync(API.fileChiave(dm, 'az-api0011')), true)
  assert.strictEqual(fs.existsSync(API.fileLock(dm)), true)
  assert.strictEqual((await API.statoApi(dm, { elenco: () => [], adesso: () => Date.now() + API.TTL_MS + 1000, rm: () => { throw new Error('EPERM') } })).motivo, 'chiave')
  assert.deepStrictEqual(await API.statoApi(dm, { elenco: () => [], adesso: () => Date.now() + API.TTL_MS + 1000 }), { libero: true, liberato: 'az-api0011' })
  assert.strictEqual(fs.existsSync(API.fileChiave(dm, 'az-api0011')), false)
})

test('F6.2 rilievo 1: supervisore caduto senza uscita registrata: con il processo verificato morto la chiave si cancella; il lock resta per «Libera»', async () => {
  const dm = tmp()
  fs.mkdirSync(path.dirname(API.fileChiave(dm, 'az-api0012')), { recursive: true })
  fs.writeFileSync(API.fileChiave(dm, 'az-api0012'), CHIAVE_PROVA)
  fs.writeFileSync(API.fileLock(dm), JSON.stringify({ tentativo: 'az-api0012', istante: new Date(0).toISOString(), pid: 4242, creato: 1000, avvio: 1000 }))
  // Identità ignota con quel PID vivo: niente si tocca.
  const ignota = JSON.parse(fs.readFileSync(API.fileLock(dm), 'utf8'))
  fs.writeFileSync(API.fileLock(dm), JSON.stringify({ ...ignota, creato: undefined }))
  assert.strictEqual((await API.statoApi(dm, { elenco: () => [{ pid: '4242', ppid: '1', creato: 1000 }] })).motivo, 'in-corso')
  assert.strictEqual(fs.existsSync(API.fileChiave(dm, 'az-api0012')), true)
  // Identità nota, processo morto e nessun discendente: la chiave va via, il lock no.
  fs.writeFileSync(API.fileLock(dm), JSON.stringify(ignota))
  assert.strictEqual((await API.statoApi(dm, { elenco: () => [] })).motivo, 'in-corso')
  assert.strictEqual(fs.existsSync(API.fileChiave(dm, 'az-api0012')), false)
  assert.strictEqual(fs.existsSync(API.fileLock(dm)), true)
})

test('F6.2 rilievo 2: una voce del registro senza tetto, con importi o stati non validi blocca le prenotazioni con il motivo', async () => {
  const mese = '2026-11'
  for (const voce of [{ mese, stato: 'prenotato' }, { mese, tetto: -1, stato: 'prenotato' }, { mese, tetto: 2, stato: 'boh' }, { mese, tetto: 2, stato: 'contato', costo: 'molto' }, { mese: 'ieri', tetto: 2, stato: 'prenotato' }]) {
    const dir = tmp()
    fs.writeFileSync(path.join(dir, 'spesa-api.json'), JSON.stringify({ v: 1, voci: { 'az-vecchio01': voce } }))
    assert.throws(() => API.prenotaSpesa(dir, 'az-nuovo0001', mese, 2, 1))
    recordApi(dir, 'a-api00013', 'az-api0013')
    const [codice, testo] = await API.lanciaApi(dir, 'a-api00013', 'az-api0013', { ...ingressoApi(tmp()), budget: 1, tetto: 0.5 }, { dirMacchina: tmp(), fonti: fontiPulite(tmp()), env: {}, supervisore: supervisoreFinto([]) })
    assert.deepStrictEqual([JSON.stringify(voce), codice, JSON.parse(testo)], [JSON.stringify(voce), 5, { registro: 'non valido' }])
  }
})

test('F6.2 rilievo 3: senza identità registrata, un processo vivo con quel PID tiene il lock (mai «morto»); «Termina» non lo chiude', async () => {
  const dm = tmp()
  fs.writeFileSync(API.fileLock(dm), JSON.stringify({ tentativo: 'az-api0014', istante: new Date(0).toISOString(), pid: 4242, avvio: 1000, uscita: { codice: 0, fine: new Date(0).toISOString() } }))
  const r = await API.statoApi(dm, { elenco: () => [{ pid: '4242', ppid: '1', creato: 5000 }] })
  assert.deepStrictEqual([r.libero, r.motivo, r.discendenti], [false, 'discendenti', ['4242']])
  const uccisi = []
  assert.deepStrictEqual(await API.terminaApi(dm, { elenco: () => [{ pid: '4242', ppid: '1', creato: 5000 }], uccidi: p => uccisi.push(p) }), { chiusi: 0 })
  assert.strictEqual((await API.liberaApi(dm, { elenco: () => [{ pid: '4242', ppid: '1', creato: 5000 }], adesso: () => Date.now() + API.TTL_MS })).libero, false)
})

test('F6.2 rilievo 4: forceLoginGatewayUrl, ogni forceLogin*, gateway e fornitori cloud bloccano; una forma non valida blocca', () => {
  for (const s of [{ forceLoginGatewayUrl: 'https://gw' }, { forceLoginAnything: 1 }, { env: { ANTHROPIC_BEDROCK_BASE_URL: 'x' } }, { env: { ANTHROPIC_VERTEX_PROJECT_ID: 'x' } },
    { env: { ANTHROPIC_FOUNDRY_API_KEY: 'x' } }, { env: { CLAUDE_CODE_USE_FOUNDRY: '1' } }, { env: { ANTHROPIC_CUSTOM_HEADERS: 'x' } }, { awsAuthRefresh: 'x' }, { env: 'x' }, [], null])
    assert.strictEqual(API.impostazioniVietate(s), true, JSON.stringify(s))
  assert.strictEqual(API.impostazioniVietate({ permissions: { allow: [] }, env: { NODE_OPTIONS: '' } }), false)
})

test('F6.2 rilievo 5: impostazioni vietate solo nel worktree: niente chiave né spawn, tentativo fallito, lock e spesa liberati', async () => {
  const dir = tmp()
  const dm = tmp()
  const root = tmp()
  recordApi(dir, 'a-api00015', 'az-api0015')
  assert.strictEqual((await API.lanciaApi(dir, 'a-api00015', 'az-api0015', ingressoApi(root), { dirMacchina: dm, fonti: fontiPulite(root), env: {}, supervisore: supervisoreFinto([]) }))[0], 0)
  let avvii = 0
  await API.eseguiApi(dir, 'a-api00015', 'az-api0015', ingressoApi(root), {
    dirMacchina: dm, git: () => 'a'.repeat(40), elenco: () => [], env: {},
    fontiCwd: cwd => {
      fs.mkdirSync(path.join(cwd, '.claude'), { recursive: true })
      fs.writeFileSync(path.join(cwd, '.claude', 'settings.json'), JSON.stringify({ forceLoginGatewayUrl: 'https://gw' }))
      return [{ nome: 'progetto', file: path.join(cwd, '.claude', 'settings.json') }]
    },
    avvia: () => { avvii++ },
  })
  assert.strictEqual(avvii, 0)
  assert.strictEqual(fs.existsSync(API.fileChiave(dm, 'az-api0015')), false)
  const esec = JSON.parse(fs.readFileSync(path.join(dir, 'esecuzioni', 'az-api0015.json'), 'utf8'))
  assert.deepStrictEqual([esec.stato, /progetto/.test(esec.errore)], ['fallita', true])
  assert.strictEqual(fs.existsSync(API.fileLock(dm)), false)
  assert.strictEqual(API.leggiSpesa(dir).voci['az-api0015'].costo, 0)
})

test('F6.2 rilievo 6: il JSON finale arrivato dopo l\'uscita si legge alla chiusura degli stream; la chiave va via subito all\'uscita', async () => {
  const dir = tmp()
  const dm = tmp()
  const root = tmp()
  recordApi(dir, 'a-api00016', 'az-api0016')
  assert.strictEqual((await API.lanciaApi(dir, 'a-api00016', 'az-api0016', ingressoApi(root), { dirMacchina: dm, fonti: fontiPulite(root), env: {}, supervisore: supervisoreFinto([]) }))[0], 0)
  let chiaveDopoUscita
  await API.eseguiApi(dir, 'a-api00016', 'az-api0016', ingressoApi(root), {
    dirMacchina: dm, git: () => 'a'.repeat(40), elenco: () => [], env: {}, fontiCwd: () => fontiPulite(root),
    avvia: () => {
      const p = new Emettitore()
      p.pid = 434343
      p.stdout = new Emettitore()
      p.stdin = new Emettitore()
      p.stdin.end = () => setImmediate(() => {
        p.emit('exit', 0)
        setImmediate(() => {
          chiaveDopoUscita = fs.existsSync(API.fileChiave(dm, 'az-api0016'))
          p.stdout.emit('data', Buffer.from(JSON.stringify({ is_error: false, total_cost_usd: 0.25, num_turns: 1 })))
          p.emit('close', 0)
        })
      })
      queueMicrotask(() => p.emit('spawn'))
      return p
    },
  })
  assert.strictEqual(chiaveDopoUscita, false)
  const esec = JSON.parse(fs.readFileSync(path.join(dir, 'esecuzioni', 'az-api0016.json'), 'utf8'))
  assert.deepStrictEqual([esec.stato, esec.costo], ['consegnata', 0.25])
  assert.strictEqual(API.leggiSpesa(dir).voci['az-api0016'].costo, 0.25)
})

// --- F6.7: stato della configurazione e accessi a un clic --------------------------------------------------------

/** Eseguibili finti in una cartella da mettere nel PATH: shim npm su Windows, script con shebang altrove. */
function eseguibiliFinti(script) {
  const dir = tmp()
  for (const [nome, codice] of Object.entries(script)) {
    fs.writeFileSync(path.join(dir, `${nome}.js`), codice)
    if (process.platform === 'win32') fs.writeFileSync(path.join(dir, `${nome}.cmd`), `@ECHO off\r\n"%_prog%"  "%dp0%\\${nome}.js" %*\r\n`)
    else fs.writeFileSync(path.join(dir, nome), `#!${process.execPath}\nrequire(${JSON.stringify(path.join(dir, `${nome}.js`))})\n`, { mode: 0o755 })
  }
  return dir
}

test('F6.7 stato-esecuzione: con eseguibili finti escono solo sì/no, metodo e host; email, organizzazione e token mai', () => {
  const casa = tmp()
  const root = tmp()
  fs.mkdirSync(path.join(root, '.claude'))
  fs.writeFileSync(path.join(root, '.claude', 'settings.json'), JSON.stringify({ forceLoginGatewayUrl: 'https://gw.example' }))
  const finti = eseguibiliFinti({
    claude: `process.stdout.write(JSON.stringify({ loggedIn: true, authMethod: 'claude.ai', email: 'persona@esempio.it', orgId: 'org-segreto-42', orgName: 'Ditta Segreta' }))`,
    gh: `process.stderr.write('Logged in to github.com account utente-segreto (keyring)'); process.exit(0)`,
    git: `process.stdout.write('https://utente-segreto:ghp_tokensegreto@github.com/acme/progetto.git\\n')`,
  })
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(path|anthropic_api_key)$/i.test(k)))
  Object.assign(env, { PATH: finti, CLAUDE_CONFIG_DIR: casa })
  const r = spawnSync(process.execPath, [ENTRATA, 'stato-esecuzione', root], { encoding: 'utf8', env })
  assert.strictEqual(r.status, 0, r.stderr)
  for (const segreto of ['persona@esempio.it', 'org-segreto-42', 'Ditta Segreta', 'utente-segreto', 'ghp_tokensegreto', 'acme', 'gw.example']) assert.ok(!r.stdout.includes(segreto), segreto)
  assert.deepStrictEqual(JSON.parse(r.stdout), {
    claude: { trovato: true, loggedIn: true, metodo: 'claude.ai' },
    github: { trovato: true, loggedIn: true, remote: true, host: 'github.com' },
    fonti: [{ nome: 'progetto', file: path.join(root, '.claude', 'settings.json'), chiavi: ['forceLoginGatewayUrl'] }],
  })
  // Un metodo che non è una parola semplice non passa; claude assente, gh scollegato, remote non GitHub.
  assert.strictEqual(API.statoEsecuzione(root, { fonti: [], env: {}, esegui: a => (a[0] === 'claude' ? { codice: 0, testo: '{"loggedIn":true,"authMethod":"api_key"}' } : null) }).claude.metodo, 'api_key')
  const altro = eseguibiliFinti({ gh: 'process.exit(1)', git: `process.stdout.write('git@gitlab.example.org:acme/x.git')` })
  const r2 = spawnSync(process.execPath, [ENTRATA, 'stato-esecuzione', tmp()], { encoding: 'utf8', env: { ...env, PATH: altro } })
  assert.deepStrictEqual(JSON.parse(r2.stdout), { claude: { trovato: false }, github: { trovato: true, loggedIn: false, remote: false, host: 'gitlab.example.org' }, fonti: [] })
})

test('F6.7 accedi: di GitHub esce solo il codice; l\'output del login non tocca mai il disco; un solo login finché vive, a qualunque età', async t => {
  // Il nome dell'account si compone a runtime: nel sorgente del finto non compare intero.
  const finti = eseguibiliFinti({
    gh: `console.log('! First copy your one-time code: AB12-CD34'); console.log('Logged in as ' + 'account-' + 'nascosto-gh7'); setTimeout(() => {}, 3000)`,
  })
  const aperti = []
  const openSync = fs.openSync
  const writeFileSync = fs.writeFileSync
  fs.openSync = (f, flag, ...resto) => (/[wa]/.test(String(flag ?? '')) && aperti.push(String(f)), openSync(f, flag, ...resto))
  fs.writeFileSync = (f, ...resto) => (aperti.push(String(f)), writeFileSync(f, ...resto))
  const prima = process.env.PATH
  process.env.PATH = finti
  try {
    aperti.length = 0
    const [codice, testo] = await API.accedi('gh', { attesaCodice: 10_000 })
    assert.deepStrictEqual([codice, JSON.parse(testo)], [0, { codice: 'AB12-CD34' }])
    // Da questo processo nessun file scritto; dal processo del login niente sotto la radice delle prove.
    assert.deepStrictEqual(aperti, [])
    // Solo cartelle e file veri: le giunzioni lasciate da altre prove non si seguono.
    const tutti = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? tutti(path.join(d, e.name)) : e.isFile() ? [path.join(d, e.name)] : []))
    assert.deepStrictEqual(tutti(radiceProve).filter(f => fs.readFileSync(f, 'utf8').includes('account-nascosto-gh7')), [])
    // Il primo login vive ancora: un secondo clic non ne avvia un altro, anche con l'orologio oltre i 3 minuti del ricontrollo.
    t.mock.timers.enable({ apis: ['Date'], now: Date.now() + 180_001 })
    try {
      assert.deepStrictEqual(await API.accedi('gh', {}), [3, ''])
    } finally {
      t.mock.timers.reset()
    }
    // Finito il login, il mutex è libero e un nuovo clic riparte.
    for (let i = 0; i < 100 && (await require(DISCO).conMutex('accesso-vivo:gh', 0, () => true)).occupato; i++) await new Promise(ok => setTimeout(ok, 100))
    fs.writeFileSync(path.join(finti, 'gh.js'), `console.log('codice XY98-ZW76'); setTimeout(() => {}, 300)`)
    aperti.length = 0
    assert.deepStrictEqual((await API.accedi('gh', { attesaCodice: 10_000 }))[0], 0)
    // claude non c'è: nessun processo, la riga da copiare.
    assert.deepStrictEqual(await API.accedi('claude', {}), [1, JSON.stringify({ copia: 'claude auth login' })])
    assert.deepStrictEqual(await API.accedi('rm', {}), [2, ''])
  } finally {
    process.env.PATH = prima
    fs.openSync = openSync
    fs.writeFileSync = writeFileSync
  }
})

test('F6.2 rilievo 2 (giro 2): un campo del tipo sbagliato (mese in un elenco, numeri come testo) blocca le prenotazioni', async () => {
  const mese = '2026-11'
  for (const voce of [{ mese: [mese], tetto: 4, stato: 'prenotato' }, { mese, tetto: '4', stato: 'prenotato' }, { mese, tetto: [4], stato: 'prenotato' },
    { mese, tetto: 2, stato: 'contato', costo: '0.5' }, { mese, tetto: 2, stato: ['contato'], costo: 1 }, [mese, 4]]) {
    const dir = tmp()
    fs.writeFileSync(path.join(dir, 'spesa-api.json'), JSON.stringify({ v: 1, voci: { 'az-vecchio02': voce } }))
    assert.throws(() => API.prenotaSpesa(dir, 'az-nuovo0002', mese, 2, 5), undefined, JSON.stringify(voce))
    recordApi(dir, 'a-api00018', 'az-api0018')
    const [codice, testo] = await API.lanciaApi(dir, 'a-api00018', 'az-api0018', { ...ingressoApi(tmp()), budget: 5, tetto: 2 }, { dirMacchina: tmp(), fonti: fontiPulite(tmp()), env: {}, supervisore: supervisoreFinto([]) })
    assert.deepStrictEqual([JSON.stringify(voce), codice, JSON.parse(testo)], [JSON.stringify(voce), 5, { registro: 'non valido' }])
  }
})

test('F6.2 rilievo 6 (giro 2): l\'attesa degli stream parte dall\'uscita: dopo 31 s di lavoro il JSON arrivato dopo l\'uscita conta', async t => {
  const dir = tmp()
  const dm = tmp()
  const root = tmp()
  recordApi(dir, 'a-api00019', 'az-api0019')
  assert.strictEqual((await API.lanciaApi(dir, 'a-api00019', 'az-api0019', ingressoApi(root), { dirMacchina: dm, fonti: fontiPulite(root), env: {}, supervisore: supervisoreFinto([]) }))[0], 0)
  let p
  const finito = API.eseguiApi(dir, 'a-api00019', 'az-api0019', ingressoApi(root), {
    dirMacchina: dm, git: () => 'a'.repeat(40), elenco: () => [], env: {}, fontiCwd: () => fontiPulite(root),
    avvia: () => {
      // Da qui il tempo lo decide la prova: solo setTimeout, il resto (mutex, I/O) corre normale.
      t.mock.timers.enable({ apis: ['setTimeout'] })
      p = new Emettitore()
      p.pid = 434345
      p.stdout = new Emettitore()
      p.stdin = new Emettitore()
      p.stdin.end = () => {}
      queueMicrotask(() => p.emit('spawn'))
      return p
    },
  })
  const giri = async n => { for (let i = 0; i < n; i++) await new Promise(ok => setImmediate(ok)) }
  while (!p) await giri(1)
  await giri(20)
  t.mock.timers.tick(31_000)
  p.emit('exit', 0)
  await giri(20)
  p.stdout.emit('data', Buffer.from(JSON.stringify({ is_error: false, total_cost_usd: 0.25, num_turns: 1 })))
  p.emit('close', 0)
  await finito
  t.mock.timers.reset()
  const esec = JSON.parse(fs.readFileSync(path.join(dir, 'esecuzioni', 'az-api0019.json'), 'utf8'))
  assert.deepStrictEqual([esec.stato, esec.costo, esec.incerto], ['consegnata', 0.25, undefined])
  assert.strictEqual(API.leggiSpesa(dir).voci['az-api0019'].costo, 0.25)
})

// --- F7.1: proposte di impostazioni nell'helper -------------------------------------------------------------------

test('F7.1 helper: rivalida la forma (campo annidato vietato, valore mai ripetuto), una sola proposta per progetto, presa una volta sola', async () => {
  const d = require(DISCO)
  const file = path.join(tmp(), 'config.json')
  const chi = { id: 'local_prova', titolo: 'Sessione di prova' }
  const [c1, t1] = await d.impostazioniProponi(file, { repo: 'acme/x', proponente: chi, proposta: { motivo: 'm', apiClaude: { budgetUsd: 5, chiave: 'sk-ant-NONQUI' } } })
  assert.deepStrictEqual([c1, /"apiClaude\.chiave"/.test(t1), t1.includes('sk-ant-NONQUI')], [2, true, false])
  assert.strictEqual(fs.existsSync(d.fileImpostazioniDi(file)), false)
  for (const proposta of [{ motivo: 'm' }, { motivo: 'm', soloLocale: true }, { motivo: 'm', soglie: { claude: { attenzione: 80, critica: 70 } } }, { motivo: 'm', lingua: 'xx' }])
    assert.strictEqual((await d.impostazioniProponi(file, { repo: 'acme/x', proponente: chi, proposta }))[0], 2, JSON.stringify(proposta))
  const [c2, t2] = await d.impostazioniProponi(file, { repo: 'acme/x', proponente: chi, proposta: { motivo: ' Risparmio. ', profilo: 'risparmio' } })
  assert.strictEqual(c2, 0)
  const { id } = JSON.parse(t2)
  assert.strictEqual((await d.impostazioniProponi(file, { repo: 'acme/x', proponente: chi, proposta: { motivo: 'altra', profilo: 'qualita' } }))[0], 4)
  // Un altro progetto ha la sua.
  assert.strictEqual((await d.impostazioniProponi(file, { repo: 'acme/y', proponente: chi, proposta: { motivo: 'y', board: { modo: 'accesa' } } }))[0], 0)
  const [c3, t3] = await d.impostazioniPrendi(file, 'acme/x', id)
  assert.deepStrictEqual([c3, JSON.parse(t3).proposta], [0, { motivo: 'Risparmio.', profilo: 'risparmio' }])
  assert.strictEqual((await d.impostazioniPrendi(file, 'acme/x', id))[0], 4)
  // Scaduta (oltre 24 ore) o manomessa nel file: non arriva al pannello.
  const fp = d.fileImpostazioniDi(file)
  const P = JSON.parse(fs.readFileSync(fp, 'utf8'))
  P.voci['acme/z'] = { id: 'i-vecchia01', quando: new Date(Date.now() - 25 * 3_600_000).toISOString(), proponente: chi, proposta: { motivo: 'm', profilo: 'qualita' } }
  P.voci['acme/w'] = { id: 'i-manomessa1', quando: new Date().toISOString(), proponente: chi, proposta: { motivo: 'm', fornitori: ['x'] } }
  fs.writeFileSync(fp, JSON.stringify(P))
  assert.strictEqual((await d.impostazioniPrendi(file, 'acme/z', 'i-vecchia01'))[0], 4)
  assert.strictEqual((await d.impostazioniPrendi(file, 'acme/w', 'i-manomessa1'))[0], 4)
})

// --- F7.3: advisor nel supervisore api-claude ------------------------------------------------------------------------

test('F7.3 booleano e precedenza: 1/true/yes/on veri, 0/false/no/off falsi, assente; la fonte più alta vince fra gestite, locale, progetto, utente', () => {
  assert.deepStrictEqual(['1', 'TRUE', 'yes', 'On', '0', 'false', 'No', 'OFF', undefined, 'forse'].map(API.booleano), [true, true, true, true, false, false, false, false, undefined, null])
  const dir = tmp()
  const fonti = ['utente', 'progetto', 'locale', 'gestite'].map(nome => ({ nome, file: path.join(dir, `${nome}.json`) }))
  fs.writeFileSync(fonti[0].file, JSON.stringify({ env: { CLAUDE_CODE_DISABLE_ADVISOR_TOOL: '1' }, advisorModel: 'opus' }))
  fs.writeFileSync(fonti[2].file, JSON.stringify({ env: { CLAUDE_CODE_DISABLE_ADVISOR_TOOL: '0' }, advisorModel: 'fable' }))
  const w = API.advisorNelWorktree(fonti)
  assert.deepStrictEqual([w.disattiva, w.fonteDisattiva, w.ereditato], ['0', 'locale', 'fable'])
  // L'env delle impostazioni sostituisce quello del processo: «0» in locale vince sull'1 del figlio.
  assert.deepStrictEqual(API.statoAdvisor({ senzaAdvisor: true }, w, { CLAUDE_CODE_DISABLE_ADVISOR_TOOL: '1' }), { advisor: { stato: 'ereditato', modello: 'fable' }, senzaAuditor: { bloccato: 'locale' } })
  assert.deepStrictEqual(API.statoAdvisor({}, {}, { CLAUDE_CODE_DISABLE_ADVISOR_TOOL: 'true' }).advisor, { stato: 'disattivato' })
  assert.deepStrictEqual(API.statoAdvisor({}, {}, {}).advisor, { stato: 'nessuno' })
  assert.deepStrictEqual(API.statoAdvisor({ advisor: 'claude-opus-5-5' }, { ereditato: 'fable' }, {}).advisor, { stato: 'applicato', modello: 'claude-opus-5-5' })
})

/** Un `claude -p` finto che registra argv e ambiente, scrive `stderr`, poi esce con `codice` (e il JSON se dato). */
const claudeAdvisor = (vista, { codice = 0, uscita = '', stderr = '' } = {}) => (argv, opzioni) => {
  vista.argv = argv
  vista.env = opzioni.env
  const p = new Emettitore()
  p.pid = 525252
  p.stdout = new Emettitore()
  p.stderr = new Emettitore()
  p.stdin = new Emettitore()
  p.stdin.end = () => setImmediate(() => {
    if (stderr) p.stderr.emit('data', Buffer.from(stderr))
    if (uscita) p.stdout.emit('data', Buffer.from(uscita))
    p.emit('exit', codice)
    p.emit('close', codice)
  })
  queueMicrotask(() => p.emit('spawn'))
  return p
}
async function eseguiConAdvisor(tentativo, input, fontiWorktree, figlio, invariato = true) {
  const dir = tmp()
  const dm = tmp()
  const root = tmp()
  const id = `a-${tentativo.slice(3)}`
  recordApi(dir, id, tentativo)
  // Il padre (lanciaApi) vede fonti pulite: l'eredità si guarda solo sul worktree del figlio.
  assert.strictEqual((await API.lanciaApi(dir, id, tentativo, { ...ingressoApi(root), ...input }, { dirMacchina: dm, fonti: fontiPulite(root), env: {}, supervisore: supervisoreFinto([]) }))[0], 0)
  await API.eseguiApi(dir, id, tentativo, { ...ingressoApi(root), ...input }, { dirMacchina: dm, git: () => 'a'.repeat(40), elenco: () => [], env: {}, fontiCwd: () => fontiWorktree, avvia: figlio,
    worktreeInvariato: (_cwd, base) => (assert.strictEqual(base, 'a'.repeat(40)), invariato) })
  return JSON.parse(fs.readFileSync(path.join(dir, 'esecuzioni', `${tentativo}.json`), 'utf8'))
}
const fontiCon = (contenuti) => {
  const dir = tmp()
  return ['utente', 'progetto', 'locale', 'gestite'].map(nome => {
    const file = path.join(dir, `${nome}.json`)
    if (contenuti[nome] !== undefined) fs.writeFileSync(file, typeof contenuti[nome] === 'string' ? contenuti[nome] : JSON.stringify(contenuti[nome]))
    return { nome, file }
  })
}
const OK = JSON.stringify({ is_error: false, total_cost_usd: 0.1, num_turns: 1 })

test('F7.3 supervisore: --advisor solo se chiesto; eredità letta sul worktree reale (padre diverso); «senza auditor» mette =1 sul solo figlio', async () => {
  const v1 = {}
  const e1 = await eseguiConAdvisor('az-adv00001', { advisor: 'claude-opus-5-5' }, fontiCon({}), claudeAdvisor(v1, { uscita: OK }))
  assert.deepStrictEqual([v1.argv.slice(-2), e1.advisor], [['--advisor', 'claude-opus-5-5'], { stato: 'applicato', modello: 'claude-opus-5-5' }])
  const v2 = {}
  const e2 = await eseguiConAdvisor('az-adv00002', {}, fontiCon({ utente: { advisorModel: 'fable' } }), claudeAdvisor(v2, { uscita: OK }))
  assert.deepStrictEqual([v2.argv.includes('--advisor'), e2.advisor], [false, { stato: 'ereditato', modello: 'fable' }])
  const v3 = {}
  const e3 = await eseguiConAdvisor('az-adv00003', { senzaAdvisor: true }, fontiCon({ progetto: { advisorModel: 'opus' }, utente: { env: { CLAUDE_CODE_DISABLE_ADVISOR_TOOL: '1' } } }), claudeAdvisor(v3, { uscita: OK }))
  assert.deepStrictEqual([v3.argv.includes('--advisor'), v3.env.CLAUDE_CODE_DISABLE_ADVISOR_TOOL, e3.advisor], [false, '1', { stato: 'disattivato' }])
  assert.strictEqual(process.env.CLAUDE_CODE_DISABLE_ADVISOR_TOOL, undefined)
})

test('F7.3 «senza auditor»: 0 o false nell\'env di qualunque fonte, o una fonte illeggibile, lo rendono non disponibile (niente spawn); 1 o assente no', async () => {
  for (const nome of ['utente', 'progetto', 'locale', 'gestite'])
    for (const valore of ['0', 'false']) {
      let avvii = 0
      const e = await eseguiConAdvisor('az-advb0001', { senzaAdvisor: true }, fontiCon({ [nome]: { env: { CLAUDE_CODE_DISABLE_ADVISOR_TOOL: valore } } }), () => { avvii++ })
      assert.deepStrictEqual([nome, valore, avvii, e.stato, e.senzaAuditor], [nome, valore, 0, 'fallita', { bloccato: nome }])
      assert.ok(!e.errore.includes(valore === '0' ? '"0"' : 'false'))
    }
  // Una fonte illeggibile blocca già prima, come impostazione vietata (§6/§7): niente spawn, tentativo fallito.
  let avvii = 0
  assert.strictEqual((await eseguiConAdvisor('az-advb0002', { senzaAdvisor: true }, fontiCon({ locale: '{ rotto' }), () => { avvii++ })).stato, 'fallita')
  assert.strictEqual(avvii, 0)
  assert.strictEqual(API.statoAdvisor({ senzaAdvisor: true }, { illeggibile: 'locale' }, {}).senzaAuditor.bloccato, 'locale')
  for (const c of [{}, { gestite: { env: { CLAUDE_CODE_DISABLE_ADVISOR_TOOL: '1' } } }]) {
    const v = {}
    const e = await eseguiConAdvisor('az-advb0003', { senzaAdvisor: true }, fontiCon(c), claudeAdvisor(v, { uscita: OK }))
    assert.deepStrictEqual([e.stato, e.senzaAuditor, v.env.CLAUDE_CODE_DISABLE_ADVISOR_TOOL], ['consegnata', {}, '1'])
  }
})

test('F7.3 advisor non disponibile: uscita anticipata con lo stderr sull\'advisor; motivo giusto e stderr salvato senza segreti', async () => {
  const casa = os.homedir()
  const stderr = `Error: Fable needs consent: run /model fable first. key ${CHIAVE_PROVA} sk-ant-altra-999 user persona@esempio.it at ${path.join(casa, 'progetto', 'x.json')}`
  const e = await eseguiConAdvisor('az-advn0001', { advisor: 'claude-fable-5-1' }, fontiCon({}), claudeAdvisor({}, { codice: 1, stderr }))
  assert.deepStrictEqual([e.stato, e.advisorNonDisponibile, e.costo], ['fallita', 'consenso', null])
  for (const segreto of [CHIAVE_PROVA, 'sk-ant-altra-999', 'persona@esempio.it', casa]) assert.ok(!e.stderr.includes(segreto), segreto)
  assert.match(e.stderr, /\/model fable/)
  assert.strictEqual((await eseguiConAdvisor('az-advn0002', { advisor: 'claude-opus-5-5' }, fontiCon({}), claudeAdvisor({}, { codice: 1, stderr: 'model excluded by availableModels' }))).advisorNonDisponibile, 'escluso')
  // Un errore che non parla dell'advisor resta l'esito incerto di sempre.
  const altro = await eseguiConAdvisor('az-advn0003', {}, fontiCon({}), claudeAdvisor({}, { codice: 1, stderr: 'network down' }))
  assert.deepStrictEqual([altro.stato, altro.incerto, altro.advisorNonDisponibile], ['avviata', true, undefined])
  // Lo stderr ha un tetto di 16 KiB.
  const lungo = await eseguiConAdvisor('az-advn0004', {}, fontiCon({}), claudeAdvisor({}, { codice: 1, stderr: 'x'.repeat(40_000) }))
  assert.ok(lungo.stderr.length <= 16 * 1024)
})

// --- revisione F7 (Codex) ------------------------------------------------------------------------------------------

test('F7 rilievo 2: un figlio che ha lavorato (stdout) e cita l\'advisor resta incerto; un JSON con is_error non è una consegna; il rifiuto all\'avvio sì', async () => {
  const lavorato = await eseguiConAdvisor('az-riv70201', {}, fontiCon({}), claudeAdvisor({}, { codice: 1, uscita: 'testo di lavoro senza JSON', stderr: 'warning: advisor call failed once' }), false)
  assert.deepStrictEqual([lavorato.stato, lavorato.incerto, lavorato.advisorNonDisponibile], ['avviata', true, undefined])
  const errore = await eseguiConAdvisor('az-riv70202', {}, fontiCon({}), claudeAdvisor({}, { codice: 1, uscita: JSON.stringify({ is_error: true, total_cost_usd: 0.3, num_turns: 4 }) }))
  assert.deepStrictEqual([errore.stato, errore.incerto, errore.costo, errore.advisorNonDisponibile], ['avviata', true, 0.3, undefined])
  // Senza JSON finale, uscita subito, stderr sull'advisor e worktree invariato: il rifiuto all'avvio.
  const rifiuto = await eseguiConAdvisor('az-riv70203', { advisor: 'claude-opus-5-5' }, fontiCon({}), claudeAdvisor({}, { codice: 1, stderr: 'advisor model rejected' }))
  assert.deepStrictEqual([rifiuto.stato, rifiuto.advisorNonDisponibile], ['fallita', 'rifiutato'])
  for (const e of [lavorato, errore, rifiuto]) assert.ok(!/nessun lavoro/i.test(e.errore ?? ''))
})

test('F7 rilievo 5: lo stderr salvato sta in 16 KiB di byte e non lascia mai un pezzo della chiave', async () => {
  const chiave = 'chiave-dedicata-0123456789'
  const lungo = await eseguiConAdvisor('az-riv70501', { chiave }, fontiCon({}), claudeAdvisor({}, { codice: 1, stderr: ('è'.repeat(100) + '\n').repeat(400) }))
  assert.ok(Buffer.byteLength(lungo.stderr, 'utf8') <= 16 * 1024, String(Buffer.byteLength(lungo.stderr, 'utf8')))
  assert.ok(Buffer.byteLength(lungo.stderr, 'utf8') > 15 * 1024)
  // La chiave a cavallo del vecchio taglio (16 KiB di caratteri) e del tetto del grezzo (64 KiB).
  for (const [t, stderr] of [['az-riv70502', 'x'.repeat(16 * 1024 - 10) + chiave], ['az-riv70503', 'riga\n'.repeat(13_000) + 'x'.repeat(64 * 1024 - 65_000 - 10) + chiave + '\nfine']]) {
    const e = await eseguiConAdvisor(t, { chiave }, fontiCon({}), claudeAdvisor({}, { codice: 1, stderr }))
    for (let n = 6; n <= chiave.length; n++) assert.ok(!(e.stderr ?? '').includes(chiave.slice(0, n)), `${t}: prefisso di ${n}`)
    assert.ok(Buffer.byteLength(e.stderr ?? '', 'utf8') <= 16 * 1024)
  }
})


test('F7 giro 2, rilievo 3: senza stdout ma con il worktree cambiato è incerto; is_error senza num_turns non vale zero turni; un JSON d\'errore sull\'advisor non è un rifiuto', async () => {
  const cambiato = await eseguiConAdvisor('az-rv8301', { advisor: 'claude-opus-5-5' }, fontiCon({}), claudeAdvisor({}, { codice: 1, stderr: 'advisor warning' }), false)
  assert.deepStrictEqual([cambiato.stato, cambiato.incerto, cambiato.advisorNonDisponibile, cambiato.costo], ['avviata', true, undefined, null])
  const senzaTurni = await eseguiConAdvisor('az-rv8302', {}, fontiCon({}), claudeAdvisor({}, { codice: 1, uscita: JSON.stringify({ is_error: true }) }))
  assert.deepStrictEqual([senzaTurni.stato, senzaTurni.incerto, 'turni' in senzaTurni], ['avviata', true, false])
  const conJson = await eseguiConAdvisor('az-rv8303', { advisor: 'claude-opus-5-5' }, fontiCon({}), claudeAdvisor({}, { codice: 1, uscita: JSON.stringify({ is_error: true, num_turns: 0 }), stderr: 'advisor model rejected' }))
  assert.deepStrictEqual([conJson.stato, conJson.incerto, conJson.advisorNonDisponibile], ['avviata', true, undefined])
  // Il controllo vero: un worktree con un file nuovo o un commit oltre la base non è invariato; git che non risponde nemmeno.
  const repo = tmp()
  const git = (...a) => spawnSync('git', ['-C', repo, ...a], { encoding: 'utf8' })
  git('init', '-q')
  git('-c', 'user.email=prova@esempio.it', '-c', 'user.name=prova', 'commit', '-q', '--allow-empty', '-m', 'base')
  const base = git('rev-parse', 'HEAD').stdout.trim()
  assert.strictEqual(API.worktreeInvariato(repo, base), true)
  fs.writeFileSync(path.join(repo, 'nuovo.txt'), 'x')
  assert.strictEqual(API.worktreeInvariato(repo, base), false)
  fs.rmSync(path.join(repo, 'nuovo.txt'))
  git('-c', 'user.email=prova@esempio.it', '-c', 'user.name=prova', 'commit', '-q', '--allow-empty', '-m', 'dopo')
  assert.strictEqual(API.worktreeInvariato(repo, base), false)
  assert.strictEqual(API.worktreeInvariato(path.join(repo, 'non-esiste'), base), false)
})
