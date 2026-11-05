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
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'disco-'))
const esegui = (args, input) => spawnSync(process.execPath, [DISCO, ...args], { input, encoding: 'utf8' })
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
  const wrapper = spawn(process.execPath, [DISCO, 'corsia-codex', '--', process.execPath, '-e', lungo], { detached: true, stdio: 'ignore' })
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
    const secondo = spawnSync(process.execPath, [DISCO, 'corsia-codex', '--', process.execPath, '-e', `process.exit(require('fs').existsSync(${JSON.stringify(fatto)}) ? 0 : 9)`])
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
  // Il comando avvia un nipote staccato (esce dal job) che vive 3 s, poi termina subito.
  const nipote = `setTimeout(()=>require('fs').writeFileSync(${JSON.stringify(fine)},'1'),3000)`
  const comando = `require('child_process').spawn(process.execPath,['-e',${JSON.stringify(nipote)}],{detached:true,stdio:'ignore'}).unref()`
  const r = esegui(['corsia-codex', '--', process.execPath, '-e', comando])
  assert.strictEqual(r.status, 0)
  // Il comando è finito, il nipote vive: la corsia è ancora occupata.
  assert.strictEqual(esegui(['occupata', 'codex']).status, 3)
  for (let i = 0; i < 60 && !fs.existsSync(fine); i++) await new Promise(ok => setTimeout(ok, 100))
  await new Promise(ok => setTimeout(ok, 300))
  assert.strictEqual(esegui(['occupata', 'codex']).status, 0)
})

test('corsia Codex: un nipote orfano di un intermedio già uscito tiene la corsia (censimento)', { skip: process.platform !== 'win32' }, async () => {
  const dir = tmp()
  const fine = path.join(dir, 'nipote-finito')
  // radice → intermedio staccato (vive 4 s, abbastanza per un censimento) → nipote staccato (vive 9 s).
  const nipote = `setTimeout(()=>require('fs').writeFileSync(${JSON.stringify(fine)},'1'),9000)`
  const intermedio = `require('child_process').spawn(process.execPath,['-e',${JSON.stringify(nipote)}],{detached:true,stdio:'ignore'}).unref();setTimeout(()=>{},4000)`
  const radice = `require('child_process').spawn(process.execPath,['-e',${JSON.stringify(intermedio)}],{detached:true,stdio:'ignore'}).unref();setTimeout(()=>{},4500)`
  assert.strictEqual(esegui(['corsia-codex', '--', process.execPath, '-e', radice]).status, 0)
  // Radice e intermedio sono usciti; il nipote ha per padre un processo morto, ma è stato censito.
  assert.strictEqual(esegui(['occupata', 'codex']).status, 3)
  for (let i = 0; i < 80 && !fs.existsSync(fine); i++) await new Promise(ok => setTimeout(ok, 100))
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
      spawn(process.execPath, [DISCO, 'corsia-codex', ...(revisione ? ['--revisione'] : []), '--', process.execPath, '-e', passo(etichetta)]).on(
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
  const lungo = spawn(process.execPath, [DISCO, 'corsia-codex', '--', process.execPath, '-e', 'setTimeout(()=>{},6000)'])
  await new Promise(r => setTimeout(r, 800))
  const rev = spawn(process.execPath, [DISCO, 'corsia-codex', '--revisione', '--', process.execPath, '-e', 'process.exit(0)'])
  await new Promise(r => setTimeout(r, 800))
  const voce = path.join(dirAttesa, String(rev.pid))
  assert.ok(fs.existsSync(voce))
  fs.rmSync(voce) // tolta per errore, come dopo una pausa lunga
  await new Promise(r => setTimeout(r, 2_600))
  assert.ok(fs.existsSync(voce), 'il battito doveva ricrearla')
  await Promise.all([new Promise(r => lungo.on('exit', r)), new Promise(r => rev.on('exit', r))])
})

const fonti = require('./fornitori.cjs')
const { configura, lanciaCli } = require(DISCO)
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

test('2.0 fonti: log Codex troncati, ultima osservazione valida senza promuovere mtime', () => {
  const home = tmp()
  const dir = path.join(home, '.codex', 'sessions', '2026', '01', '01')
  fs.mkdirSync(dir, { recursive: true })
  const evento = (timestamp, percentuale) => JSON.stringify({ type: 'event_msg', timestamp, payload: { type: 'token_count', rate_limits: { primary: { used_percent: percentuale } } } })
  fs.writeFileSync(path.join(dir, 'rollout.jsonl'), ['pezzo troncato', evento('2026-01-01T01:00:00Z', 10), '{"testo":"privato"}', evento('2026-01-01T02:00:00Z', 20), '{"fine":'].join('\n'))
  const l = fonti.codexLocale(home)
  assert.strictEqual(l.length, 1)
  assert.strictEqual(l[0].percentuale, 20)
  assert.strictEqual(l[0].letto, '2026-01-01T02:00:00Z')
  assert.ok(!JSON.stringify(l).includes('privato'))
})

test('2.2 sessioni Codex: solo metadati, turno aperto solo se recente, sotto-thread e file vecchi esclusi', () => {
  const home = tmp()
  const dir = path.join(home, '.codex', 'sessions', '2026', '01', '01')
  fs.mkdirSync(dir, { recursive: true })
  const riga = (type, payload) => JSON.stringify({ type, timestamp: '2026-01-01T00:00:00Z', payload })
  const meta = (id, extra = {}) => riga('session_meta', { id, cwd: 'C:/esempio/progetto', git: { branch: 'fix-ricerca' }, ...extra })
  const conto = riga('event_msg', { type: 'token_count', info: { last_token_usage: { total_tokens: 61_000 }, model_context_window: 100_000 } })
  fs.writeFileSync(path.join(dir, 'a.jsonl'), [meta('sessione-a'), riga('turn_context', { model: 'gpt-esempio', effort: 'xhigh' }),
    riga('response_item', { type: 'message', content: 'testo privato' }), riga('event_msg', { type: 'task_started' }), conto].join('\n'))
  fs.writeFileSync(path.join(dir, 'b.jsonl'), [meta('sessione-b', { parent_thread_id: 'sessione-a' }), conto].join('\n'))
  fs.writeFileSync(path.join(dir, 'c.jsonl'), [meta('sessione-c'), conto].join('\n'))
  const vecchio = (Date.now() - 3 * 86_400_000) / 1000
  fs.utimesSync(path.join(dir, 'c.jsonl'), vecchio, vecchio)
  const s = fonti.sessioniCodexLocali(home)
  assert.deepStrictEqual(s.map(x => x.id), ['sessione-a'])
  assert.deepStrictEqual({ ...s[0], attivita: undefined }, { id: 'sessione-a', cwd: 'C:/esempio/progetto', ramo: 'fix-ricerca', modello: 'gpt-esempio', effort: 'xhigh',
    token: 61_000, finestra: 100_000, inCorso: true, attivita: undefined })
  assert.ok(!JSON.stringify(s).includes('privato'))
  // Lo stesso turno aperto in un file fermo da più di 10 minuti non è lavoro in corso.
  fs.utimesSync(path.join(dir, 'a.jsonl'), Date.now() / 1000 - 900, Date.now() / 1000 - 900)
  assert.strictEqual(fonti.sessioniCodexLocali(home)[0].inCorso, false)
  assert.deepStrictEqual(fonti.sessioniCodexLocali(path.join(home, 'nessuna')), [])
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
  for (const f of ['register.tsx', 'pannello.tsx']) {
    const righe = fs.readFileSync(path.join(__dirname, '..', 'hooks', f), 'utf8').split('\n')
    // Gli unici `stato:` ammessi fuori da transizione() sono quelli delle sessioni (in-corso / ferma).
    const scritte = righe
      .map((r, i) => `${f}:${i + 1}: ${r.trim()}`)
      .filter(r => /\bstato: /.test(r) && !/\bstato: (s\.isRunning|'in-corso'|fermaOra)/.test(r))
    assert.deepStrictEqual(scritte, [])
  }
})
