#!/usr/bin/env node
'use strict'
// Le primitive che `$.fs` della mod non ha. La mutua esclusione è un socket in ascolto su 127.0.0.1 a
// una porta derivata dal nome: il sistema la concede a un solo processo e la RILASCIA DA SOLO quando
// il processo termina (anche se muore). Niente file di lock, niente scadenze, niente furti di lock
// scaduti: ogni sezione critica vive dentro una sola invocazione di questo programma.
//
//   node disco.cjs cas <file> <versione|nuovo>               stdin = JSON del record
//   node disco.cjs prenota <cartella>                        stdin = {attese:{nome:versione|"nuovo"}, scrivi:{nome:record}}
//   node disco.cjs occupata <nome-mutex>                     uscita 3 se qualcuno tiene il mutex
//   node disco.cjs corsia-codex [--revisione] [--attesa ms] -- <comando> [argomenti...]
//
// Uscite: 0 ok · 2 uso · 3 mutex occupato · 4 conflitto (stdout: il primo file cambiato e la sua versione).
const fs = require('fs')
const path = require('path')
const net = require('net')
const crypto = require('crypto')
const { spawn, spawnSync } = require('child_process')

// Il mutex identifica la cartella FISICA: due spellings della stessa cartella (C:/… e D:/… sullo stesso
// volume, una junction, un link) devono dare la stessa porta. Si chiama dopo che la cartella esiste.
const MUTEX_AZIONI = dir => `azioni:${fs.realpathSync.native(path.resolve(dir)).toLowerCase()}`
const MUTEX_CODEX = 'codex:corsia-della-macchina'

/** Porta 20000-59999 derivata dal nome: stessa porta per lo stesso mutex su tutta la macchina. */
const porta = nome => 20000 + (crypto.createHash('sha256').update(nome).digest().readUInt32BE(0) % 40000)
const dorme = ms => new Promise(r => setTimeout(r, ms))

function ascolta(nome) {
  return new Promise((ok, ko) => {
    const s = net.createServer()
    s.once('error', ko)
    // exclusive: il socket non si condivide con i worker di cluster; il sistema rifiuta un secondo bind.
    s.listen({ port: porta(nome), host: '127.0.0.1', exclusive: true }, () => ok(s))
  })
}

/** Esegue `fn` tenendo il mutex; null se non si ottiene entro `attesa` ms. */
async function conMutex(nome, attesa, fn) {
  const fine = Date.now() + attesa
  for (;;) {
    let server
    try {
      server = await ascolta(nome)
    } catch (e) {
      if (e.code !== 'EADDRINUSE' && e.code !== 'EACCES') throw e
      if (Date.now() >= fine) return { occupato: true }
      await dorme(25 + Math.random() * 25)
      continue
    }
    try {
      return { valore: await fn() }
    } finally {
      await new Promise(r => server.close(r))
    }
  }
}

function leggiVersione(file) {
  try {
    const su = JSON.parse(fs.readFileSync(file, 'utf8'))
    return Number.isInteger(su.versione) ? su.versione : 0
  } catch (e) {
    if (e.code === 'ENOENT') return 'nuovo'
    // Un file illeggibile non è «nuovo»: chi lo aspettava con una versione trova un conflitto.
    return 'illeggibile'
  }
}

function scriviAtomico(file, testo) {
  const tmp = `${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`
  fs.writeFileSync(tmp, testo, { mode: 0o600 })
  fs.renameSync(tmp, file)
}

/**
 * Scrive i record solo se TUTTI i file letti dalla decisione sono ancora alla versione vista e, con
 * `elenco`, se l'insieme dei record è ancora quello letto (una proposta nuova cambia la decisione).
 */
async function prenota(dir, richiesta) {
  // La cartella può non esistere ancora (prima azione, o CHIPMANAGER_DIR nuovo).
  fs.mkdirSync(dir, { recursive: true })
  const r = await conMutex(MUTEX_AZIONI(dir), 8_000, () => {
    if (Array.isArray(richiesta.elenco)) {
      const ora = fs.readdirSync(dir).filter(n => /^a-[a-z0-9]+\.json$/.test(n)).sort()
      const visto = [...richiesta.elenco].sort()
      if (ora.join('|') !== visto.join('|')) return { conflitto: `elenco cambiato (${visto.length} → ${ora.length})` }
    }
    for (const [nome, attesa] of Object.entries(richiesta.attese ?? {})) {
      if (path.basename(nome) !== nome) return { conflitto: `${nome}=nome non valido` }
      const trovata = leggiVersione(path.join(dir, nome))
      if (String(trovata) !== String(attesa)) return { conflitto: `${nome}=${trovata}` }
    }
    for (const [nome, record] of Object.entries(richiesta.scrivi ?? {})) {
      if (path.basename(nome) !== nome) return { conflitto: `${nome}=nome non valido` }
      scriviAtomico(path.join(dir, nome), JSON.stringify(record, null, 2))
    }
    return {}
  })
  if (r.occupato) return [3, 'mutex occupato']
  if (r.valore.conflitto) return [4, r.valore.conflitto]
  return [0, '']
}

const vivo = pid => {
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    return e.code === 'EPERM'
  }
}

// Il segno della corsia: { radice, avvio, noti: [{ pid, creato }] }. Se il wrapper muore, il mutex si
// libera ma la corsia resta occupata finché vive un processo dell'albero del comando. Su Windows un orfano
// conserva il ppid del padre morto: per non perdere i nipoti di un intermedio già uscito, durante
// l'esecuzione il wrapper REGISTRA i discendenti che vede (`noti`), e il controllo parte da tutti loro.
const filePid = path.join(require('os').tmpdir(), 'chipmanager-corsia-codex.pid')
// ponytail: censimento a intervalli; un intermedio che nasce e muore fra due censimenti, lasciando un
// orfano staccato, sfugge. Su Windows i discendenti non staccati muoiono comunque con il wrapper (job di libuv).
const CENSIMENTO_MS = 3_000

/** Processi vivi con padre e istante di creazione (Windows, via CIM); null se l'elenco non si legge. */
function elencoProcessi() {
  const r = spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      "Get-CimInstance Win32_Process | ForEach-Object { '{0},{1},{2}' -f $_.ProcessId, $_.ParentProcessId, $_.CreationDate.ToUniversalTime().ToString('o') }",
    ],
    { encoding: 'utf8', timeout: 20_000, windowsHide: true },
  )
  if (r.status !== 0 || !r.stdout) return null
  return r.stdout
    .split(/\r?\n/)
    .map(riga => riga.split(','))
    .filter(([pid, ppid]) => pid && ppid)
    .map(([pid, ppid, creato]) => ({ pid, ppid, creato: Date.parse(creato) }))
}

/**
 * I processi vivi dell'albero: i semi ancora vivi (stesso istante di creazione: un pid riciclato non conta)
 * e ogni processo vivo nato dopo l'avvio che discende da un seme, anche attraverso padri già morti.
 */
function alberoVivo(lista, semi, avvio) {
  const vivi = new Map(lista.map(p => [p.pid, p]))
  // Un seme il cui pid oggi appartiene a un processo nato in un altro istante è riciclato: né lui né i
  // suoi figli sono dell'albero. Un seme assente dall'elenco è morto, ma i suoi orfani contano.
  const buoni = semi.filter(x => !vivi.has(x.pid) || vivi.get(x.pid).creato === x.creato || Number.isNaN(x.creato))
  const dentro = new Set()
  const noti = new Set(buoni.map(x => x.pid))
  for (const x of buoni) if (vivi.get(x.pid)?.creato === x.creato) dentro.add(x.pid)
  let cresciuto = true
  while (cresciuto) {
    cresciuto = false
    for (const p of lista) {
      if (dentro.has(p.pid) || p.creato < avvio - 2_000) continue
      if (noti.has(p.ppid) || dentro.has(p.ppid)) {
        dentro.add(p.pid)
        cresciuto = true
      }
    }
  }
  return lista.filter(p => dentro.has(p.pid))
}

/** null = nessun segno; 'illeggibile' = c'è ma non si interpreta (la corsia resta occupata). */
function leggiSegno() {
  let testo
  try {
    testo = fs.readFileSync(filePid, 'utf8')
  } catch (e) {
    return e.code === 'ENOENT' ? null : 'illeggibile'
  }
  try {
    const rec = JSON.parse(testo)
    return Number.isInteger(rec?.radice) && rec.radice > 0 ? rec : 'illeggibile'
  } catch {
    return 'illeggibile'
  }
}

/** Il segno indica un albero ancora vivo? Elenco illeggibile = sì (non si può escludere). */
function alberoAncoraVivo(rec) {
  if (process.platform !== 'win32') {
    if (vivo(rec.radice)) return true
    // Altrove il comando parte in un gruppo di processi suo (detached): vive finché vive un membro.
    try {
      process.kill(-rec.radice, 0)
      return true
    } catch (e) {
      return e.code === 'EPERM'
    }
  }
  const lista = elencoProcessi()
  if (!lista) return true
  // Radice senza istante registrato (censimento mai riuscito): il solo pid vivo basta, per prudenza.
  if (rec.creato === undefined && vivo(rec.radice)) return true
  return alberoVivo(lista, [{ pid: String(rec.radice), creato: rec.creato ?? NaN }, ...(rec.noti ?? [])], rec.avvio).length > 0
}

function figlioVivo() {
  const rec = leggiSegno()
  if (!rec) return false
  // ponytail: un segno illeggibile blocca la corsia finché qualcuno non lo toglie a mano (il percorso è
  // nel messaggio). Con le scritture atomiche non dovrebbe mai succedere; nel dubbio non si libera.
  if (rec === 'illeggibile') {
    process.stderr.write(`segno della corsia illeggibile: ${filePid} (toglilo a mano se nessun Codex è in esecuzione)\n`)
    return true
  }
  if (alberoAncoraVivo(rec)) return true
  // Albero estinto: il segno si toglie, così il prossimo controllo non rifà l'elenco dei processi.
  fs.rmSync(filePid, { force: true })
  return false
}

/** Durante l'esecuzione: registra nel segno ogni discendente visto (anche quelli nati da intermedi). */
function censisci(rec) {
  if (process.platform !== 'win32') return rec
  const lista = elencoProcessi()
  if (!lista) return rec
  const radice = lista.find(p => p.pid === String(rec.radice))
  if (radice && rec.creato === undefined) rec.creato = radice.creato
  const visti = alberoVivo(lista, [{ pid: String(rec.radice), creato: rec.creato }, ...rec.noti], rec.avvio)
  for (const p of visti) if (p.pid !== String(rec.radice) && !rec.noti.some(n => n.pid === p.pid)) rec.noti.push({ pid: p.pid, creato: p.creato })
  scriviAtomico(filePid, JSON.stringify(rec))
  return rec
}

/** Un comando nudo sul PATH; su Windows solo con un'estensione eseguibile (lo shim sh di npm non lo è). */
function risolvi(cmd) {
  if (/[\\/]/.test(cmd)) return cmd
  const est = process.platform === 'win32' ? (process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean) : ['']
  for (const d of (process.env.PATH || '').split(path.delimiter).filter(Boolean))
    for (const e of est) {
      const f = path.join(d, cmd + e.toLowerCase())
      try {
        if (fs.statSync(f).isFile()) return f
      } catch {
        // non qui
      }
    }
  return null
}

/**
 * Avvia il comando SENZA shell, così gli argomenti arrivano come sono (anche con spazi o virgolette). Uno
 * shim .cmd di npm si risolve nello script node che lancia e si avvia quello; un .cmd sconosciuto si rifiuta.
 */
function avviaComando(comando, opzioni = {}) {
  const f = risolvi(comando[0])
  if (!f) throw Object.assign(new Error(`comando non trovato: ${comando[0]}`), { code: 'ENOENT' })
  if (process.platform === 'win32' && /\.(cmd|bat)$/i.test(f)) {
    const testo = fs.readFileSync(f, 'utf8')
    const m = testo.match(/"%dp0%\\([^"]+\.(?:c|m)?js)"\s+%\*/i)
    if (!m) throw new Error(`${path.basename(f)}: uno script .cmd si avvia solo se è uno shim npm riconoscibile (niente shell)`)
    const script = path.join(path.dirname(f), m[1])
    return spawn(process.execPath, [script, ...comando.slice(1)], { stdio: 'inherit', windowsHide: true, ...opzioni })
  }
  return spawn(f, comando.slice(1), { stdio: 'inherit', windowsHide: true, detached: process.platform !== 'win32', ...opzioni })
}

/** CAS del config intero, senza scartare campi di altri progetti o modifiche di un altro pannello. */
async function configura(file, richiesta) {
  if (!richiesta || typeof richiesta.repo !== 'string' || !richiesta.repo || !richiesta.campi ||
      Object.keys(richiesta.campi).some(k => !['fornitori', 'soloLocale', 'milestoneGithub', 'pesi', 'limitiManuali', 'freellmapi', 'board'].includes(k))) return 2
  if (richiesta.campi.board !== undefined && !BOARD_MODI.includes(richiesta.campi.board?.modo)) return 2
  const dir = path.dirname(file)
  fs.mkdirSync(dir, { recursive: true })
  const r = await conMutex(mutexConfig(file), 8000, () => {
    const prima = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null
    if (prima !== richiesta.atteso) return 4
    const c = prima === null ? {} : JSON.parse(prima)
    if (!c || typeof c !== 'object' || Array.isArray(c) || (c.progetti && (typeof c.progetti !== 'object' || Array.isArray(c.progetti)))) return 2
    const precedente = c.progetti?.[richiesta.repo] ?? {}
    if (!precedente || typeof precedente !== 'object' || Array.isArray(precedente)) return 2
    const campi = { ...richiesta.campi }
    if (campi.board) {
      // La generazione la decide l'helper, sotto lo stesso lock: ogni cambio di modo invalida il lavoro in volo.
      const b = precedente.board
      const gen = Number.isInteger(b?.generazione) && b.generazione >= 0 ? b.generazione : 0
      campi.board = { modo: campi.board.modo, generazione: b?.modo === campi.board.modo ? gen : gen + 1 }
    }
    const progetti = { ...c.progetti, [richiesta.repo]: { ...precedente, ...campi } }
    scriviAtomico(file, JSON.stringify({ ...c, progetti }, null, 2))
    return 0
  })
  return r.occupato ? 3 : r.valore
}

// --- board di progetto -------------------------------------------------------------------------------
// Tutti i comandi `board-*` prendono il mutex di `configura` e rileggono sotto lock modo e generazione:
// un lavoro avviato prima di un cambio di modo (anche spento → acceso) non si pubblica mai.
// Uscite: 0 ok · 4 rifiuto (board cambiata, marcatore, già prenotata) · 5 tetto del giorno · 6 percorso non sicuro.

const BOARD_MODI = ['spenta', 'accesa', 'riassunti']
const MARCATORE = '.chipmanager-board'
const TETTO_GIORNO = 100
const mutexConfig = file => `${MUTEX_AZIONI(path.dirname(file))}:config`
const stessoPercorso = (a, b) => (process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b)
class Rifiuto extends Error {
  constructor(codice, messaggio) {
    super(messaggio)
    this.codice = codice
  }
}

/** `<pulito>-<hash dell'identità>`: l'hash c'è sempre, così due identità con lo stesso nome pulito non si incontrano. */
const nomeBoard = repo =>
  `${repo.replace(/\//g, '__').replace(/[^A-Za-z0-9._-]+/g, '_').slice(-60)}-${crypto.createHash('sha256').update(repo).digest('hex').slice(0, 12)}`

/** Nessun componente da `<cartella>` in giù può essere un link o una junction. */
function senzaLink(...percorsi) {
  for (const p of percorsi) {
    let st
    try {
      st = fs.lstatSync(p)
    } catch (e) {
      if (e.code === 'ENOENT') continue
      throw e
    }
    if (st.isSymbolicLink() || !st.isDirectory()) throw new Rifiuto(6, `percorso non sicuro: ${p} è un collegamento o non è una cartella`)
  }
}

function dentroWorkingTree(dir) {
  const env = { ...process.env }
  for (const k of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_CEILING_DIRECTORIES']) delete env[k]
  const g = spawnSync('git', ['-C', dir, 'rev-parse', '--is-inside-work-tree'], { encoding: 'utf8', windowsHide: true, timeout: 10_000, env })
  if (g.error) throw new Rifiuto(6, 'git non disponibile: non posso escludere che la cartella sia dentro un working tree')
  return g.status === 0 && g.stdout.trim() === 'true'
}

/**
 * La cartella della board di `repo` dentro `<cartella>/board/`. Con `crea` la crea e scrive il marcatore con
 * l'identità; senza, restituisce null se non c'è. Rifiuta link, junction, identità diverse e working tree.
 */
function destBoard(cartella, repo, crea) {
  if (!path.isAbsolute(cartella)) throw new Rifiuto(2, 'cartella non assoluta')
  const base = path.resolve(cartella)
  const contenitore = path.join(base, 'board')
  const dest = path.join(contenitore, nomeBoard(repo))
  senzaLink(base, contenitore, dest)
  if (!fs.existsSync(dest)) {
    if (!crea) return null
    fs.mkdirSync(base, { recursive: true })
    // Il controllo «fuori da ogni working tree» va fatto prima di scrivere, sul percorso reale.
    if (dentroWorkingTree(fs.realpathSync.native(base)))
      throw new Rifiuto(6, 'la cartella dei dati è dentro un working tree git: cambia «cartella» nella configurazione del progetto')
    if (!fs.existsSync(contenitore)) fs.mkdirSync(contenitore)
    senzaLink(contenitore)
    fs.mkdirSync(dest)
  }
  senzaLink(base, contenitore, dest)
  const reale = fs.realpathSync.native(dest)
  if (!stessoPercorso(reale, path.join(fs.realpathSync.native(base), 'board', nomeBoard(repo))))
    throw new Rifiuto(6, 'percorso non sicuro: la destinazione non è dove deve essere')
  if (dentroWorkingTree(reale)) throw new Rifiuto(6, 'la cartella dei dati è dentro un working tree git: cambia «cartella» nella configurazione del progetto')
  const marcatore = path.join(reale, MARCATORE)
  let st
  try {
    st = fs.lstatSync(marcatore)
  } catch (e) {
    if (e.code !== 'ENOENT') throw e
  }
  if (!st) {
    if (!crea || fs.readdirSync(reale).length) throw new Rifiuto(4, 'cartella della board senza marcatore: non la tocco')
    fs.writeFileSync(marcatore, repo, { mode: 0o600 })
  } else if (!st.isFile() || fs.readFileSync(marcatore, 'utf8') !== repo) throw new Rifiuto(4, 'il marcatore è di un altro progetto')
  return reale
}

/** Esegue `fn(dest)` sotto il mutex del config, solo se la board di `repo` vale ancora `modi` alla `generazione` attesa. */
async function conBoard(file, cartella, repo, generazione, modi, crea, fn) {
  const gen = Number(generazione)
  if (typeof repo !== 'string' || !repo || repo.length > 400 || !Number.isInteger(gen) || gen < 0) return [2, 'argomenti non validi']
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const r = await conMutex(mutexConfig(file), 8000, () => {
    try {
      const c = JSON.parse(fs.readFileSync(file, 'utf8'))
      const b = c?.progetti?.[repo]?.board
      if (!b || !modi.includes(b.modo) || b.generazione !== gen) return [4, 'board cambiata: lavoro scartato']
      return fn(destBoard(cartella, repo, crea))
    } catch (e) {
      if (e instanceof Rifiuto) return [e.codice, e.message]
      throw e
    }
  })
  return r.occupato ? [3, 'mutex occupato'] : r.valore
}

const leggiJson = (f, vuoto) => {
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'))
  } catch (e) {
    if (e.code === 'ENOENT') return vuoto
    throw e
  }
}
const oggi = () => new Date().toISOString().slice(0, 10)

const boardScrivi = (file, cartella, repo, gen, impronta, html) =>
  conBoard(file, cartella, repo, gen, ['accesa', 'riassunti'], true, dest => {
    const indice = path.join(dest, 'index.html')
    // Stessa impronta già scritta (da un altro pannello): niente da fare.
    if (fs.existsSync(indice) && fs.readFileSync(indice, 'utf8').includes(`name="chipmanager-impronta" content="${impronta}"`)) return [0, indice]
    scriviAtomico(indice, html)
    return [0, indice]
  })

const boardSpegni = (file, cartella, repo, gen) =>
  conBoard(file, cartella, repo, gen, ['spenta'], false, dest => {
    if (!dest) return [0, '']
    // Solo i due file della board, solo se sono file regolari: niente cartelle, niente link seguiti. Il budget resta.
    for (const n of ['index.html', 'riassunti.json']) {
      const f = path.join(dest, n)
      try {
        if (fs.lstatSync(f).isFile()) fs.unlinkSync(f)
      } catch (e) {
        if (e.code !== 'ENOENT') throw e
      }
    }
    return [0, '']
  })

/** Prenota un riassunto: impronta e un'unità del budget del giorno, insieme. Una prenotazione conta sempre. */
const boardPrenota = (file, cartella, repo, gen, impronta) =>
  conBoard(file, cartella, repo, gen, ['riassunti'], true, dest => {
    const fr = path.join(dest, 'riassunti.json')
    const fb = path.join(dest, 'budget.json')
    const r = leggiJson(fr, { voci: {} })
    const b = leggiJson(fb, { giorno: oggi(), usati: 0 })
    if (r.voci?.[impronta]) return [4, 'già prenotata']
    const usati = b.giorno === oggi() && Number.isInteger(b.usati) ? b.usati : 0
    if (usati >= TETTO_GIORNO) return [5, 'tetto giornaliero dei riassunti raggiunto']
    scriviAtomico(fb, JSON.stringify({ giorno: oggi(), usati: usati + 1 }))
    scriviAtomico(fr, JSON.stringify({ voci: { ...r.voci, [impronta]: { stato: 'prenotata', quando: new Date().toISOString() } } }))
    return [0, '']
  })

const boardFinalizza = (file, cartella, repo, gen, impronta, esito) =>
  conBoard(file, cartella, repo, gen, ['riassunti'], false, dest => {
    if (!dest) return [4, 'board assente']
    const fr = path.join(dest, 'riassunti.json')
    const r = leggiJson(fr, { voci: {} })
    if (r.voci?.[impronta]?.stato !== 'prenotata') return [4, 'nessuna prenotazione aperta']
    const testo = typeof esito?.testo === 'string' && esito.testo.trim() ? esito.testo.trim().slice(0, 1000) : undefined
    const voce = testo ? { stato: 'fatto', testo, quando: new Date().toISOString() } : { stato: 'fallita', quando: new Date().toISOString() }
    scriviAtomico(fr, JSON.stringify({ voci: { ...r.voci, [impronta]: voce } }))
    return [0, '']
  })

const PIANO_MAX = 200 * 1024

/** Il piano di una chip: percorso relativo, sotto la radice REALE (link e junction risolti), file regolare, 200 KB. */
function leggiPiano(radice, relativo) {
  if (typeof relativo !== 'string' || !relativo || relativo.length > 300 || /[\x00-\x1f:*?"<>|]/.test(relativo) ||
      /^[\\/]/.test(relativo) || /(^|[\\/])\.\.([\\/]|$)/.test(relativo) || !/\.(md|txt)$/i.test(relativo)) return [4, 'percorso del piano non ammesso']
  try {
    const root = fs.realpathSync.native(radice)
    const reale = fs.realpathSync.native(path.resolve(root, relativo))
    const rel = path.relative(root, reale)
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return [4, 'il piano è fuori dal repository']
    const st = fs.statSync(reale)
    if (!st.isFile()) return [4, 'il piano non è un file']
    const fd = fs.openSync(reale, 'r')
    try {
      const buf = Buffer.alloc(Math.min(st.size, PIANO_MAX))
      const n = fs.readSync(fd, buf, 0, buf.length, 0)
      return [0, JSON.stringify({ testo: buf.subarray(0, n).toString('utf8'), troncato: st.size > PIANO_MAX })]
    } finally {
      fs.closeSync(fd)
    }
  } catch (e) {
    return [4, e.code === 'ENOENT' ? 'piano non trovato' : 'piano illeggibile']
  }
}

/** Le ultime 15 voci del ramo base (first-parent): SHA corto, data, oggetto. Nient'altro del commit. */
function gitLog(radice) {
  const git = args => spawnSync('git', ['-C', radice, ...args], { encoding: 'utf8', windowsHide: true, timeout: 15_000 })
  const remoto = git(['rev-parse', '--abbrev-ref', 'origin/HEAD'])
  const ref = remoto.status === 0 && /^[A-Za-z0-9._/-]{1,100}$/.test(remoto.stdout.trim()) ? remoto.stdout.trim() : 'HEAD'
  const r = git(['log', '--first-parent', '-15', '--format=%h%x09%cI%x09%s', ref, '--'])
  if (r.status !== 0) return [4, 'git log non riuscito']
  const voci = r.stdout.split('\n').filter(Boolean).map(riga => {
    const [sha, data, ...oggetto] = riga.split('\t')
    return { sha, data, oggetto: oggetto.join('\t').replace(/[\x00-\x1f\x7f]/g, ' ').slice(0, 200) }
  })
  return [0, JSON.stringify(voci)]
}

const tentativoValido = t => typeof t === 'string' && /^az-[a-z0-9]{6,20}$/.test(t)
const idValido = id => typeof id === 'string' && /^a-[a-z0-9]{6,20}$/.test(id)
const fileEsecuzione = (dir, t) => path.join(dir, 'esecuzioni', `${t}.json`)

/** Il segno nasce PRIMA del processo: un esito perso non permette un secondo spawn. */
async function lanciaCli(dir, id, tentativo, input) {
  if (!idValido(id) || !tentativoValido(tentativo)) return 2
  const r = await conMutex(MUTEX_AZIONI(dir), 8000, async () => {
    const a = JSON.parse(fs.readFileSync(path.join(dir, `${id}.json`), 'utf8'))
    if (a.stato !== 'in-avvio' || a.lanciatore !== 'cli' || a.tentativo !== tentativo) return 4
    const file = fileEsecuzione(dir, tentativo)
    if (fs.existsSync(file)) return 4
    fs.mkdirSync(path.dirname(file), { recursive: true })
    scriviAtomico(file, JSON.stringify({ id, tentativo, stato: 'in-avvio' }))
    try {
      const p = spawn(process.execPath, [__filename, 'esegui-cli', dir, id, tentativo], { stdio: ['pipe', 'ignore', 'ignore'], detached: true, windowsHide: true })
      await new Promise((ok, ko) => { p.once('spawn', ok); p.once('error', ko) })
      p.stdin.on('error', () => {})
      p.stdin.end(JSON.stringify(input))
      p.unref()
      return 0
    } catch {
      scriviAtomico(file, JSON.stringify({ id, tentativo, stato: 'fallita', errore: 'processo non avviato' }))
      return 1
    }
  })
  return r.occupato ? 3 : r.valore
}

/** Worktree unico; mai rimozione automatica. stdout/stderr del modello non diventano log della mod. */
async function eseguiCli(dir, id, tentativo, input, deps = {}) {
  if (!idValido(id) || !tentativoValido(tentativo)) throw new Error('identità non valida')
  const file = fileEsecuzione(dir, tentativo)
  const segno = JSON.parse(fs.readFileSync(file, 'utf8'))
  if (segno.id !== id || segno.tentativo !== tentativo || segno.stato !== 'in-avvio') throw new Error('tentativo non valido')
  const r = await conMutex(`cli:${path.resolve(file).toLowerCase()}`, 0, async () => {
    const scrivi = campi => scriviAtomico(file, JSON.stringify({ id, tentativo, ...campi }))
    let partito = false
    let ramo
    try {
      if (!input || typeof input.root !== 'string' || typeof input.prompt !== 'string' || input.prompt.length > 40000 ||
          !/^claude-[a-z0-9.-]{1,80}$/.test(input.modello) || !['low', 'medium', 'high', 'xhigh'].includes(input.effort) ||
          !['default', 'acceptEdits', 'plan'].includes(input.permessi) ||
          (input.base && !/^[A-Za-z0-9][A-Za-z0-9._/-]{0,99}$/.test(input.base))) throw new Error('parametri non validi')
      const root = fs.realpathSync(input.root)
      const git = deps.git ?? (args => {
        const g = spawnSync('git', ['-c', `core.hooksPath=${process.platform === 'win32' ? 'NUL' : '/dev/null'}`, '-C', root, ...args], { encoding: 'utf8', windowsHide: true, timeout: 20000 })
        if (g.status !== 0) throw new Error('preparazione worktree fallita')
        return g.stdout.trim()
      })
      const base = git(['rev-parse', '--verify', `${input.base || 'HEAD'}^{commit}`])
      let destinazione = root
      // Controlla ogni antenato prima di creare il successivo: .claude può essere un link esterno.
      for (const segmento of ['.claude', 'worktrees']) {
        destinazione = path.join(destinazione, segmento)
        if (!fs.existsSync(destinazione)) fs.mkdirSync(destinazione)
        const relativo = path.relative(root, fs.realpathSync(destinazione))
        if (!relativo || relativo === '..' || relativo.startsWith(`..${path.sep}`) || path.isAbsolute(relativo)) throw new Error('worktree fuori progetto')
      }
      const cwd = path.join(destinazione, `chipmanager-${tentativo}`)
      ramo = `chipmanager/${tentativo}`
      git(['worktree', 'add', '-b', ramo, cwd, base])
      const env = { ...process.env }
      delete env.CLAUDECODE
      const p = (deps.avvia ?? avviaComando)(['claude', '-p', '--model', input.modello, '--effort', input.effort, '--permission-mode', input.permessi, '--output-format', 'json'],
        { cwd, env, stdio: ['pipe', 'ignore', 'ignore'], detached: false })
      await new Promise((ok, ko) => { p.once('spawn', ok); p.once('error', ko) })
      partito = true
      scrivi({ stato: 'avviata', ramo, avviataIl: new Date().toISOString() })
      p.stdin.on('error', () => {})
      p.stdin.end(input.prompt)
      const codice = await new Promise(ok => p.once('exit', ok))
      scrivi({ stato: 'consegnata', ramo, errore: codice === 0 ? undefined : 'CLI terminata con errore: controlla il worktree prima di chiudere' })
    } catch {
      scrivi({ stato: partito ? 'avviata' : 'fallita', ramo, errore: partito ? 'esito CLI incerto: controlla il processo e il worktree' : 'CLI non avviata: verifica comando e worktree; nessun file eliminato' })
    }
  })
  return r.occupato ? 3 : 0
}

async function occupata(nome) {
  // Sotto il mutex: chi esegue tiene il mutex (occupata), e nessuno può sostituire il segno mentre lo si
  // controlla e, se l'albero è estinto, lo si toglie.
  const r = await conMutex(nome, 0, () => (nome === MUTEX_CODEX ? figlioVivo() : false))
  return r.occupato || r.valore ? 3 : 0
}

/**
 * Tiene la corsia di Codex per tutta la vita del comando (il mutex è di questo processo: se il comando o
 * questo processo muoiono, la corsia si libera). Le revisioni hanno la precedenza (routing.json,
 * corsia_codex): un'implementazione cede finché c'è una revisione viva in attesa.
 */
async function corsiaCodex(argv) {
  const sep = argv.indexOf('--')
  if (sep < 0 || sep === argv.length - 1) return 2
  const opz = argv.slice(0, sep)
  const comando = argv.slice(sep + 1)
  const revisione = opz.includes('--revisione')
  const iAttesa = opz.indexOf('--attesa')
  const attesa = iAttesa >= 0 ? Number(opz[iAttesa + 1]) : 6 * 3_600_000
  const dirAttesa = path.join(require('os').tmpdir(), 'chipmanager-corsia-codex-revisioni')
  const mio = path.join(dirAttesa, String(process.pid))
  const BATTITO_MS = 2_000
  const revisioniVive = () => {
    let vive = 0
    let voci = []
    try {
      voci = fs.readdirSync(dirAttesa)
    } catch {
      return 0
    }
    for (const n of voci) {
      if (n === String(process.pid)) continue
      const f = path.join(dirAttesa, n)
      try {
        // Viva = ha battuto da poco; una voce ferma da 5 battiti è di un processo morto e si toglie.
        if (Date.now() - fs.statSync(f).mtimeMs < 5 * BATTITO_MS) vive += 1
        else fs.rmSync(f, { force: true })
      } catch {
        // tolta nel frattempo
      }
    }
    return vive
  }
  let battito
  if (revisione) {
    fs.mkdirSync(dirAttesa, { recursive: true })
    fs.writeFileSync(mio, '')
    // Il battito riscrive la voce: se un'altra attesa l'ha tolta credendola morta (questo processo è
    // rimasto fermo più di 5 battiti, per esempio durante un censimento lento), la ricrea. Si ferma prima
    // che la revisione parta, quando la voce si toglie davvero.
    battito = setInterval(() => {
      try {
        fs.writeFileSync(mio, '')
      } catch {
        // cartella non scrivibile in questo istante: il prossimo battito riprova
      }
    }, BATTITO_MS)
  }
  const OCCUPATA = Symbol('occupata')
  const fine = Date.now() + attesa
  try {
    for (;;) {
      if (!revisione && revisioniVive() > 0) {
        if (Date.now() >= fine) return 3
        await dorme(2_000)
        continue
      }
      const r = await conMutex(MUTEX_CODEX, Math.min(2_000, Math.max(0, fine - Date.now())), async () => {
        // Ricontrollo DENTRO il mutex: una revisione arrivata durante l'attesa passa davanti, e un figlio
        // sopravvissuto al suo wrapper tiene ancora la corsia.
        if ((!revisione && revisioniVive() > 0) || figlioVivo()) return OCCUPATA
        if (revisione) {
          clearInterval(battito)
          fs.rmSync(mio, { force: true })
        }
        return new Promise(ok => {
          let figlio
          try {
            figlio = avviaComando(comando)
          } catch (e) {
            process.stderr.write(`${e.message}\n`)
            return ok(127)
          }
          let rec = { radice: figlio.pid, avvio: Date.now(), noti: [] }
          const conPid = Number.isInteger(figlio.pid) && figlio.pid > 0
          if (conPid) {
            scriviAtomico(filePid, JSON.stringify(rec))
            rec = censisci(rec)
          }
          const timer = conPid
            ? setInterval(() => {
                rec = censisci(rec)
              }, CENSIMENTO_MS)
            : undefined
          let finito = false
          const fatto = codice => {
            if (finito) return
            finito = true
            if (timer) clearInterval(timer)
            if (!conPid) return ok(codice)
            // Il segno resta se un processo dell'albero vive ancora: lo toglierà il controllo a albero estinto.
            try {
              rec = censisci(rec)
              const su = leggiSegno()
              if (su && su !== 'illeggibile' && su.radice === rec.radice && su.avvio === rec.avvio && !alberoAncoraVivo(rec))
                fs.rmSync(filePid, { force: true })
            } catch {
              // già tolto
            }
            ok(codice)
          }
          figlio.on('exit', codice => fatto(codice ?? 1))
          figlio.on('error', () => fatto(127))
        })
      })
      if (!r.occupato && r.valore !== OCCUPATA) return r.valore
      if (Date.now() >= fine) return 3
      if (r.valore === OCCUPATA) await dorme(1_000)
    }
  } finally {
    if (revisione) {
      clearInterval(battito)
      fs.rmSync(mio, { force: true })
    }
  }
}

async function main(argv) {
  const [cmd, ...a] = argv
  const stdin = () => JSON.parse(fs.readFileSync(0, 'utf8'))
  if (cmd === 'configura' && a.length === 1) return esci(await configura(a[0], stdin()))
  if (cmd === 'lancia-cli' && a.length === 3) return esci(await lanciaCli(...a, stdin()))
  if (cmd === 'esegui-cli' && a.length === 3) return esci(await eseguiCli(...a, stdin()))
  if (cmd === 'stato-cli' && a.length === 2 && tentativoValido(a[1])) {
    return esci(0, fs.readFileSync(fileEsecuzione(a[0], a[1]), 'utf8'))
  }
  if (cmd === 'cas' && a.length === 2) {
    const [file, attesa] = a
    const [codice, testo] = await prenota(path.dirname(file), { attese: { [path.basename(file)]: attesa }, scrivi: { [path.basename(file)]: stdin() } })
    return esci(codice, testo)
  }
  if (cmd === 'prenota' && a.length === 1) {
    const [codice, testo] = await prenota(a[0], stdin())
    return esci(codice, testo)
  }
  if (cmd === 'occupata' && a.length === 1) return esci(await occupata(a[0] === 'codex' ? MUTEX_CODEX : a[0]))
  if (cmd === 'corsia-codex') return esci(await corsiaCodex(a))
  if (cmd === 'leggi-piano' && a.length === 2) return esci(...leggiPiano(...a))
  if (cmd === 'git-log' && a.length === 1) return esci(...gitLog(a[0]))
  if (cmd === 'board-scrivi' && a.length === 5) return esci(...(await boardScrivi(...a, fs.readFileSync(0, 'utf8'))))
  if (cmd === 'board-spegni' && a.length === 4) return esci(...(await boardSpegni(...a)))
  if (cmd === 'board-prenota' && a.length === 5) return esci(...(await boardPrenota(...a)))
  if (cmd === 'board-finalizza' && a.length === 5) return esci(...(await boardFinalizza(...a, stdin())))
  esci(2, 'uso: cas <file> <versione|nuovo> | prenota <cartella> | occupata <mutex|codex> | corsia-codex [--revisione] -- <comando>')
}

function esci(codice, testo) {
  if (testo) process.stdout.write(String(testo))
  process.exitCode = codice
}

if (require.main === module) main(process.argv.slice(2)).catch(e => esci(1, String(e?.message ?? e)))
module.exports = { conMutex, prenota, porta, MUTEX_AZIONI, MUTEX_CODEX, configura, lanciaCli, eseguiCli }
