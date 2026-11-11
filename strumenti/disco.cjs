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
const regole = require('./regole.cjs')

// Il mutex identifica la cartella FISICA: due spellings della stessa cartella (C:/… e D:/… sullo stesso
// volume, una junction, un link) devono dare la stessa porta. Si chiama dopo che la cartella esiste.
const MUTEX_AZIONI = dir => `azioni:${percorsoCanonico(dir)}`
/**
 * L'identità di un percorso per mutex e lock: il percorso REALE della parte esistente più il resto, in minuscolo. Con le
 * junction ammesse sopra la radice dati, l'alias e il percorso fisico devono prendere lo stesso lock (stesso record,
 * stessa cartella), altrimenti due supervisori lavorerebbero insieme sullo stesso stato.
 */
function percorsoCanonico(p, piattaforma = process.platform) {
  // Il minuscolo solo dove il file system non distingue (Windows); altrove `/srv/Alpha` e `/srv/alpha` sono due cartelle.
  const caso = s => (piattaforma === 'win32' ? s.toLowerCase() : s)
  const assoluto = path.resolve(p)
  const resto = []
  for (let x = assoluto; ; x = path.dirname(x)) {
    try {
      return caso(path.join(fs.realpathSync.native(x), ...resto))
    } catch {
      if (path.dirname(x) === x) return caso(assoluto)
      resto.unshift(path.basename(x))
    }
  }
}

/**
 * Le radici dei dati EFFETTIVE (cartella del config, cartella dati configurata, cartella della macchina): le passa il
 * pannello (`CHIPMANAGER_RADICI`) e le aggiunge ogni comando dai propri argomenti. Mai dedotte dai nomi delle cartelle.
 * Sopra una radice i link sono ammessi; dalla radice in giù no. Un percorso fuori da ogni radice nota: nessun link.
 */
const RADICI = new Set()
function registraRadici(...ps) {
  for (const p of ps) if (typeof p === 'string' && p && path.isAbsolute(p)) RADICI.add(path.resolve(p))
}
/** Il mutex del supervisore di un'esecuzione (`cli`, `api`): uno per record, qualunque percorso lo nomini. */
const mutexEsecuzione = (tipo, file) => `${tipo}:${percorsoCanonico(file)}`
// Uno solo per macchina e non configurabile: nessuna variabile d'ambiente lo cambia. Le prove, chiamando main()
// dal proprio entrypoint, ne passano un altro come parametro.
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

/**
 * F10 rilievo 3: una scrittura sotto i dati della mod (cartella dati, esecuzioni, config, proposte, board, registro della
 * spesa, lock): la catena della cartella finale si controlla subito prima (nessun link o junction, percorso reale uguale,
 * nessun `.git` sopra), così una junction su una sottocartella (`esecuzioni`) non porta la scrittura altrove.
 */
function scriviDati(file, testo) {
  percorsoSicuro(path.dirname(path.resolve(file)))
  scriviAtomico(file, testo)
}

// --- F11.4: il rapporto a chipManager ---------------------------------------------------------------------------------
// Gli stessi elenchi chiusi di hooks/rapporto.ts (un test di parità li confronta): la difesa al confine non si fida del pannello.
const TITOLO_RAPPORTO = 'chipManager report: doctor findings'
const RILIEVI_RAPPORTO = ['config.illeggibile', 'config.senzaCopie', 'config.campoIgnoto', 'config.nonValido', 'config.restrizioneLarga', 'config.modoNonValido',
  'percorso.config', 'percorso.dati', 'percorso.macchina', 'percorso.registro', 'registro.sviluppo', 'lock.api', 'lock.apiIlleggibile', 'chiavi.residue',
  'azioni.orfane', 'azioni.progettiIgnoti', 'accesso.claude', 'accesso.codex', 'accesso.github', 'host.impostazioniApi', 'host.advisor', 'host.versione', 'connessione']
const CAMPI_ACCOUNT_RAPPORTO = ['soglie', 'limitiManuali', 'apiClaude', 'freellmapi', 'modoLavoro']
const CAMPI_PROGETTO_RAPPORTO = ['fornitori', 'soloLocale', 'milestoneGithub', 'pesi', 'limitiManuali', 'freellmapi', 'board', 'soglie', 'profilo', 'apiClaude',
  'consigliere', 'restrizioni', 'modoLavoro']
const SUPERFICI_RAPPORTO = ['desktop', 'terminal', 'vscode', 'mobile', 'unknown']
const TIPI_RAPPORTO = ['null', 'array', 'object', 'number', 'boolean', 'string']
const VERSIONE_RAPPORTO = /^(\d{1,4}\.\d{1,4}\.\d{1,5}(-dev)?|unknown)$/

/** `campo:tipo, …` con campi dell'elenco, nell'ordine dell'elenco e senza ripetizioni, o `none`. */
function formaRapportoValida(s, campi) {
  if (s === 'none') return true
  let prima = -1
  for (const parte of s.split(', ')) {
    const [campo, tipo, ...resto] = parte.split(':')
    const i = campi.indexOf(campo)
    if (resto.length || i <= prima || !TIPI_RAPPORTO.includes(tipo)) return false
    prima = i
  }
  return true
}

/** Il rapporto esattamente come lo scrive `rapportoRedatto`: sette righe, ogni valore da un elenco chiuso. */
function rapportoValido(t) {
  if (typeof t !== 'string' || t.length > 4000) return false
  const r = t.split('\n')
  if (r.length !== 7 || r[0] !== '### chipManager report') return false
  const valore = (riga, prefisso) => (riga.startsWith(prefisso) ? riga.slice(prefisso.length) : null)
  const [mod, sup, host, acc, pro, fin] = [[1, '- mod: '], [2, '- surface: '], [3, '- host: '], [4, '- account shape: '], [5, '- project shape: '], [6, '- doctor findings: ']]
    .map(([i, p]) => valore(r[i], p))
  if ([mod, sup, host, acc, pro, fin].some(x => x === null)) return false
  if (!VERSIONE_RAPPORTO.test(mod) || !VERSIONE_RAPPORTO.test(host) || !SUPERFICI_RAPPORTO.includes(sup)) return false
  if (!formaRapportoValida(acc, CAMPI_ACCOUNT_RAPPORTO) || !formaRapportoValida(pro, CAMPI_PROGETTO_RAPPORTO)) return false
  if (fin === 'none') return true
  const codici = fin.split(', ')
  return codici.every((c, i) => RILIEVI_RAPPORTO.includes(c) && (i === 0 || codici[i - 1] < c))
}

/**
 * Apre nel browser SOLO il nuovo issue di chipManager: https, host esatto github.com, percorso esatto, i soli parametri
 * `title` (fisso) e `body` (un rapporto valido). Argv fisso per sistema, mai una shell. `deps.avvia` solo per le prove.
 */
function apriUrl(url, deps = {}) {
  if (typeof url !== 'string' || url.length > 7000 || /[\s"'<>\\^`{|}]/.test(url)) return [2, '']
  let u
  try {
    u = new URL(url)
  } catch {
    return [2, '']
  }
  const chiavi = [...u.searchParams.keys()]
  if (u.protocol !== 'https:' || u.hostname !== 'github.com' || u.port || u.username || u.password || u.hash || u.pathname !== '/Elite9400/chipManager/issues/new' ||
      chiavi.length !== 2 || chiavi[0] !== 'title' || chiavi[1] !== 'body' || u.searchParams.get('title') !== TITOLO_RAPPORTO || !rapportoValido(u.searchParams.get('body'))) return [2, '']
  const argv = process.platform === 'win32' ? ['rundll32', 'url.dll,FileProtocolHandler', url] : process.platform === 'darwin' ? ['open', url] : ['xdg-open', url]
  try {
    if (deps.avvia) deps.avvia(argv)
    else {
      const [eseguibile, argomenti] = comandoReale(argv)
      spawn(eseguibile, argomenti, { stdio: 'ignore', detached: true, windowsHide: true }).unref()
    }
    return [0, '']
  } catch {
    return [1, '']
  }
}

/** `gh issue create` sul solo repository di chipManager, con il corpo in un file temporaneo cancellato dopo. */
function segnalaGh(richiesta) {
  if (!oggetto(richiesta) || richiesta.titolo !== TITOLO_RAPPORTO || !rapportoValido(richiesta.corpo)) return [2, '']
  const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'chipmanager-rapporto-'))
  const file = path.join(dir, 'corpo.md')
  try {
    fs.writeFileSync(file, richiesta.corpo, { mode: 0o600 })
    const [eseguibile, argomenti] = comandoReale(['gh', 'issue', 'create', '--repo', 'Elite9400/chipManager', '--title', richiesta.titolo, '--body-file', file])
    const r = spawnSync(eseguibile, argomenti, { encoding: 'utf8', windowsHide: true, timeout: 60_000 })
    const url = /https:\/\/github\.com\/Elite9400\/chipManager\/issues\/\d{1,9}/.exec(r.stdout ?? '')?.[0]
    return r.status === 0 && url ? [0, JSON.stringify({ url })] : [1, '']
  } catch {
    return [1, '']
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

// --- F11.3: copie del config e contatori monotòni ----------------------------------------------------------------
const COPIE = 3
const fileContatori = file => `${file}.contatori`
const intero = v => (Number.isInteger(v) && v >= 0 ? v : 0)
/** L'impronta dei byte del config: il CAS del ripristino la confronta (anche su un file che non è UTF-8 valido). */
const improntaByte = b => crypto.createHash('sha256').update(b).digest('hex')

/** Un config che si può usare: un oggetto, con `progetti` e `account` oggetti se ci sono, e regole efficaci valide. */
function configValido(c) {
  if (!oggetto(c) || (c.progetti !== undefined && !oggetto(c.progetti)) || (c.account !== undefined && !oggetto(c.account))) return false
  try {
    for (const p of Object.values(c.progetti ?? {})) regole.regoleEfficaci(c.account, p)
    if (!c.progetti || !Object.keys(c.progetti).length) regole.regoleEfficaci(c.account, {})
    return true
  } catch {
    return false
  }
}

/** I contatori monotòni di un config: generazione della board e revisione dei pesi per progetto, `versione` della radice. */
function contatoriDi(c) {
  const progetti = {}
  if (oggetto(c?.progetti))
    for (const [repo, p] of Object.entries(c.progetti)) if (oggetto(p)) progetti[repo] = { generazione: intero(p.board?.generazione), pesiRevisione: intero(p.pesiRevisione) }
  return { versione: intero(c?.versione), progetti }
}
const maxContatori = (a, b) => ({
  versione: Math.max(a.versione, b.versione),
  progetti: Object.fromEntries([...new Set([...Object.keys(a.progetti), ...Object.keys(b.progetti)])].map(r => [r, {
    generazione: Math.max(a.progetti[r]?.generazione ?? 0, b.progetti[r]?.generazione ?? 0),
    pesiRevisione: Math.max(a.progetti[r]?.pesiRevisione ?? 0, b.progetti[r]?.pesiRevisione ?? 0),
  }])),
})
function leggiContatori(file) {
  try {
    const v = JSON.parse(fs.readFileSync(fileContatori(file), 'utf8'))
    return contatoriDi({ versione: v.versione, progetti: Object.fromEntries(Object.entries(oggetto(v.progetti) ? v.progetti : {}).map(([r, k]) => [r, { board: { generazione: k?.generazione }, pesiRevisione: k?.pesiRevisione }])) })
  } catch {
    return { versione: 0, progetti: {} }
  }
}

/**
 * Ogni scrittura del config. PRIMA i contatori (il massimo fra file dei contatori, config attuale e nuovo): se non si
 * salvano, il config non si scrive. Poi il config, poi la copia più recente in `.bak1` (le altre scalano fino a
 * `.bak3`): una rotazione che non riesce lascia valida la scrittura e il doctor lo dice («senza copie»).
 * `prima` (optional) runs before reading and before each of the two writes; whatever it throws stops the write.
 */
function scriviConfig(file, testo, prima = () => {}) {
  prima()
  let attuale = { versione: 0, progetti: {} }
  try {
    attuale = contatoriDi(JSON.parse(fs.readFileSync(file, 'utf8')))
  } catch {
    // config assente o illeggibile: valgono il file dei contatori e il nuovo testo
  }
  const k = maxContatori(maxContatori(leggiContatori(file), attuale), contatoriDi(JSON.parse(testo)))
  prima()
  scriviDati(fileContatori(file), JSON.stringify(k))
  prima()
  scriviDati(file, testo)
  try {
    for (let i = COPIE; i > 1; i--) if (fs.existsSync(`${file}.bak${i - 1}`)) fs.renameSync(`${file}.bak${i - 1}`, `${file}.bak${i}`)
    scriviDati(`${file}.bak1`, testo)
  } catch (e) {
    if (!(e instanceof Error)) throw e
  }
}

/**
 * Ripristina l'ultima copia valida, sotto il mutex di `configura`, con CAS sull'IMPRONTA dei byte osservati (anche un
 * JSON rotto o non UTF-8). Prima copia in binario l'attuale in `config.json.corrotto-<istante>`, poi sostituisce in modo
 * atomico. Per OGNI progetto (della copia, dei contatori o del file attuale) generazione della board e revisione dei
 * pesi diventano max(attuale leggibile, file dei contatori, copia) + 1, con la board spenta se la copia non ne ha una,
 * e l'origine dei pesi «manuale»: un lavoro avviato su una generazione vecchia o un «Annulla» di prima non valgono più.
 * Il registro della spesa non si tocca. stdin `{ impronta }` (sha256 esadecimale, null = file assente): 0 ripristinato,
 * 4 il file è cambiato, 5 nessuna copia valida (non fa niente), 3 occupato.
 */
async function ripristinaConfig(file, richiesta) {
  registraRadici(path.dirname(path.resolve(file)))
  if (!oggetto(richiesta) || !(richiesta.impronta === null || (typeof richiesta.impronta === 'string' && /^[0-9a-f]{64}$/.test(richiesta.impronta)))) return [2, '']
  const r = await conMutex(mutexConfig(file), 8000, () => {
    const ora = fs.existsSync(file) ? fs.readFileSync(file) : null
    if ((ora === null ? null : improntaByte(ora)) !== richiesta.impronta) return [4, '']
    let copia = null
    let n = 0
    for (const i of [1, 2, 3]) {
      try {
        const c = JSON.parse(fs.readFileSync(`${file}.bak${i}`, 'utf8'))
        if (configValido(c)) {
          copia = c
          n = i
          break
        }
      } catch {
        // copia assente o rotta: la prossima
      }
    }
    if (!copia) return [5, '']
    if (ora !== null) scriviDati(`${file}.corrotto-${new Date().toISOString().replace(/[:.]/g, '-')}`, ora)
    let attuali = { versione: 0, progetti: {} }
    try {
      attuali = contatoriDi(JSON.parse(ora.toString('utf8')))
    } catch {
      // illeggibile: valgono il file dei contatori e la copia
    }
    const k = maxContatori(maxContatori(attuali, leggiContatori(file)), contatoriDi(copia))
    const progetti = {}
    for (const repo of new Set([...Object.keys(copia.progetti ?? {}), ...Object.keys(k.progetti)])) {
      // Un progetto null o assente nella copia vale come vuoto: riceve comunque i contatori portati avanti, così una
      // riattivazione non riparte da una generazione già usata.
      const grezzo = copia.progetti?.[repo]
      if (grezzo !== undefined && grezzo !== null && !oggetto(grezzo)) {
        progetti[repo] = grezzo
        continue
      }
      const p = grezzo ?? {}
      const x = k.progetti[repo] ?? { generazione: 0, pesiRevisione: 0 }
      const b = oggetto(p?.board) ? p.board : {}
      progetti[repo] = { ...p, pesiRevisione: x.pesiRevisione + 1, pesiOrigine: { tipo: 'manuale' },
        board: { ...b, modo: typeof b.modo === 'string' ? b.modo : 'spenta', generazione: x.generazione + 1 } }
    }
    const nuovo = { ...copia, ...(Object.keys(progetti).length && { progetti }), ...((copia.versione !== undefined || k.versione > 0) && { versione: k.versione + 1 }) }
    scriviConfig(file, JSON.stringify(nuovo, null, 2))
    return [0, JSON.stringify({ copia: n })]
  })
  return r.occupato ? [3, ''] : r.valore
}

/**
 * The doctor moves a project's data (folder inside a repository or with links inside) to the safe folder `a`, only on
 * confirmation. It holds THE SAME locks as the writers (config, actions, API lane and every execution) from the start to
 * the config change included, with a CAS on the config bytes. The executions are counted under the actions mutex
 * (launchers create their records holding it), locked, then counted again: a different set stops the move. The copy goes
 * to an exclusive staging folder next to the destination; before every write the chain of the path being written and the
 * real path of the parent are checked again; every copy is verified with sha256; the staging folder is renamed atomically
 * to `a`; then `progetti[repo].cartella = a` is written. The old folder stays untouched. Links are not copied: unless
 * `accettaSaltati` is exactly the set of skipped names, the config does not change and the staging folder is removed.
 * Cleanup removes only the staging folder created here (same physical parent, same dev+ino); otherwise it leaves it and
 * says so. stdin `{ impronta, accettaSaltati? }`: 0 done; 4 config changed (empty stdout), destination not empty
 * (`motivo`) or skipped names to accept (`saltati`); 2 invalid request; 3 busy; 6 unsafe path or staging left in place.
 * `deps` (tests only): `dopoLock`, `dopoCopia`, `primaDelConfig`.
 */
async function spostaDati(config, repo, da, a, richiesta, deps = {}) {
  if (!oggetto(richiesta) || !(richiesta.impronta === null || (typeof richiesta.impronta === 'string' && /^[0-9a-f]{64}$/.test(richiesta.impronta)))) return [2, '']
  const accettati = richiesta.accettaSaltati ?? []
  // The panel sends back the whole list the copier reported: the bounds reject absurd input, never a real list.
  if (!Array.isArray(accettati) || accettati.length > 100_000 || !accettati.every(x => typeof x === 'string' && x.length <= 4096)) return [2, '']
  if (typeof repo !== 'string' || !/^[^/\s]+\/[^/\s]+$/.test(repo) || ![config, da, a].every(x => typeof x === 'string' && path.isAbsolute(x))) return [2, '']
  const DA = path.resolve(da)
  const A = path.resolve(a)
  const ins = process.platform === 'win32'
  if (regole.dentroRadice(DA, A, ins) || regole.dentroRadice(A, DA, ins)) return [2, '']
  registraRadici(path.dirname(path.resolve(config)), DA)
  const sopra = path.dirname(A)
  try {
    percorsoSicuro(A)
  } catch (e) {
    if (e instanceof Rifiuto) return [e.codice ?? 6, e.message]
    throw e
  }
  if (fs.existsSync(A) && fs.readdirSync(A).length) return [4, JSON.stringify({ motivo: 'destinazione non vuota' })]
  const azioni = path.join(DA, 'azioni')
  const esecuzioni = path.join(azioni, 'esecuzioni')
  const censisci = () => {
    try {
      return fs.readdirSync(esecuzioni).filter(n => n.endsWith('.json')).sort()
    } catch {
      return []
    }
  }
  // The writers' own locks. Config, actions and API lane are waited for (held briefly); an execution held by its
  // supervisor means work in progress: the move does not start (busy).
  const API = require('./api-claude.cjs')
  const tieni = async (lock, attesa, fn) => {
    if (!lock.length) return fn()
    const r = await conMutex(lock[0], attesa, () => tieni(lock.slice(1), attesa, fn))
    return r.occupato ? [3, ''] : r.valore
  }
  return tieni([mutexConfig(config), MUTEX_AZIONI(azioni), API.MUTEX_API], 8000, async () => {
    // Counted under the actions mutex, never before it: a record created in between, with its supervisor already
    // running, would stay unlocked and the copy would freeze a state the supervisor keeps changing at the source.
    const registri = censisci()
    return tieni(registri.flatMap(n => [mutexEsecuzione('cli', path.join(esecuzioni, n)), mutexEsecuzione('api', path.join(esecuzioni, n))]), 0, async () => {
      await deps.dopoLock?.()
      if (censisci().join('|') !== registri.join('|')) return [3, JSON.stringify({ motivo: 'esecuzioni cambiate' })]
      return copiaSottoLock()
    })
  })

  async function copiaSottoLock() {
    const ora = fs.existsSync(config) ? fs.readFileSync(config) : null
    if ((ora === null ? null : improntaByte(ora)) !== richiesta.impronta) return [4, '']
    let c = {}
    if (ora !== null) {
      try {
        c = JSON.parse(ora.toString('utf8'))
      } catch {
        return [2, '']
      }
      if (!configValido(c)) return [2, '']
    }
    let staging
    let identita
    let realeSopra
    // The staging folder is still the one created here: same physical parent and same dev+ino. A re-pointed alias above
    // the root, or a folder swapped in under the same name, would otherwise be published or deleted as if it were ours.
    const nostro = () => {
      const st = fs.lstatSync(staging, { bigint: true })
      return st.isDirectory() && st.dev === identita.dev && st.ino === identita.ino && stessoPercorso(fs.realpathSync.native(sopra), realeSopra)
    }
    const togli = () => {
      try {
        percorsoSicuro(staging)
        if (!nostro()) return false
        fs.rmSync(staging, { recursive: true, force: true })
        return true
      } catch {
        return false
      }
    }
    const rimasto = () => [6, `helper.stagingNonRimosso: ${staging}`]
    const dirConfig = path.dirname(path.resolve(config))
    try {
      // The config folder's physical identity, fixed now and checked again before each config write: an alias above the
      // root re-pointed meanwhile would make the write land in someone else's config.
      percorsoSicuro(dirConfig)
      fs.mkdirSync(dirConfig, { recursive: true })
      const idConfig = fs.statSync(dirConfig, { bigint: true })
      const realeConfig = fs.realpathSync.native(dirConfig)
      const configFermo = () => {
        const st = fs.statSync(dirConfig, { bigint: true })
        if (st.dev !== idConfig.dev || st.ino !== idConfig.ino || !stessoPercorso(fs.realpathSync.native(dirConfig), realeConfig))
          throw new Rifiuto(6, `helper.configAltrove: ${dirConfig}`)
      }
      percorsoSicuro(sopra)
      fs.mkdirSync(sopra, { recursive: true })
      percorsoSicuro(sopra)
      realeSopra = fs.realpathSync.native(sopra)
      // Before every write: no link from the root down along the very path being written (a folder of the staging tree
      // swapped for a link would carry the copy elsewhere), and the same REAL parent (no ancestor re-pointed).
      const controlla = dove => {
        percorsoSicuro(dove)
        if (!stessoPercorso(fs.realpathSync.native(sopra), realeSopra)) throw new Rifiuto(6, `helper.percorsoReale: ${sopra}`)
      }
      staging = path.join(sopra, `.${path.basename(A)}.staging-${crypto.randomBytes(6).toString('hex')}`)
      // Created exclusively: if it already exists (someone else's) mkdir fails and it is not touched.
      fs.mkdirSync(staging)
      identita = fs.lstatSync(staging, { bigint: true })
      const copiati = []
      const saltati = []
      const relativo = x => path.relative(DA, x).replace(/\\/g, '/')
      const copia = (s, d) => {
        for (const n of fs.readdirSync(s)) {
          const x = path.join(s, n)
          const y = path.join(d, n)
          const st = fs.lstatSync(x)
          if (st.isSymbolicLink() || (!st.isDirectory() && !st.isFile())) saltati.push(relativo(x))
          else if (st.isDirectory()) {
            controlla(y)
            fs.mkdirSync(y)
            copia(x, y)
          } else {
            controlla(y)
            fs.copyFileSync(x, y, fs.constants.COPYFILE_EXCL)
            copiati.push([x, y])
          }
        }
      }
      copia(DA, staging)
      await deps.dopoCopia?.()
      controlla(staging)
      // The chain again while verifying: a link slipped in between a check and its write is still caught here. Nothing
      // awaits between this verification and the rename, so what is published is what was verified.
      for (const [x, y] of copiati) {
        controlla(y)
        if (improntaByte(fs.readFileSync(x)) !== improntaByte(fs.readFileSync(y))) throw new Error('copia non verificata')
      }
      // Exactly the skipped set, no more and no less: a partial or stale confirmation moves nothing.
      const confermati = new Set(accettati)
      if (new Set(saltati).size !== confermati.size || saltati.some(x => !confermati.has(x))) {
        if (!togli()) return rimasto()
        return [4, JSON.stringify({ saltati })]
      }
      // The destination: absent, or empty as it was at the start (rmdir fails if someone put something in it).
      if (fs.existsSync(A)) fs.rmdirSync(A)
      // Right before the rename: the folder about to be published is still the one verified, not one swapped in.
      controlla(staging)
      if (!nostro()) throw new Rifiuto(6, `helper.stagingCambiato: ${staging}`)
      fs.renameSync(staging, A)
      staging = undefined
      await deps.primaDelConfig?.()
      const prog = oggetto(c.progetti?.[repo]) ? c.progetti[repo] : {}
      const nuovo = { ...c, progetti: { ...(oggetto(c.progetti) ? c.progetti : {}), [repo]: { ...prog, cartella: A.replace(/\\/g, '/') } } }
      scriviConfig(config, JSON.stringify(nuovo, null, 2), configFermo)
      return [0, JSON.stringify({ da: DA, a: A, copiati: copiati.length, saltati })]
    } catch (e) {
      if (staging && identita && !togli()) return rimasto()
      if (e instanceof Rifiuto) return [e.codice ?? 6, e.message]
      return [1, String(e?.code ?? 'errore')]
    }
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
  registraRadici(dir)
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
      scriviDati(path.join(dir, nome), JSON.stringify(record, null, 2))
    }
    return {}
  })
  if (r.occupato) return [3, 'helper.mutex']
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
  const [eseguibile, argomenti, shim] = comandoReale(comando)
  return spawn(eseguibile, argomenti, { stdio: 'inherit', windowsHide: true, ...(shim ? {} : { detached: process.platform !== 'win32' }), ...opzioni })
}

/** Eseguibile e argomenti senza shell: uno shim .cmd di npm diventa lo script node che lancia; un .cmd sconosciuto si rifiuta. */
function comandoReale(comando) {
  const f = risolvi(comando[0])
  if (!f) throw Object.assign(new Error(`comando non trovato: ${comando[0]}`), { code: 'ENOENT' })
  if (process.platform === 'win32' && /\.(cmd|bat)$/i.test(f)) {
    const testo = fs.readFileSync(f, 'utf8')
    const m = testo.match(/"%dp0%\\([^"]+\.(?:c|m)?js)"\s+%\*/i)
    if (!m) throw new Error(`${path.basename(f)}: uno script .cmd si avvia solo se è uno shim npm riconoscibile (niente shell)`)
    return [process.execPath, [path.join(path.dirname(f), m[1]), ...comando.slice(1)], true]
  }
  return [f, comando.slice(1), false]
}

/**
 * CAS del config intero, senza scartare campi di altri progetti o modifiche di un altro pannello. Una scrittura di
 * `profilo` o `pesi` completa prima l'operazione indicata da `pesiOrigine` (file delle proposte accanto al config), poi
 * incrementa `pesiRevisione` e segna l'origine manuale: nessuno dei due si scrive da fuori.
 */
async function configura(file, richiesta) {
  registraRadici(path.dirname(path.resolve(file)))
  if (!richiesta || typeof richiesta.repo !== 'string' || !richiesta.repo || !richiesta.campi || typeof richiesta.campi !== 'object' || Array.isArray(richiesta.campi) ||
      Object.keys(richiesta.campi).some(k => !CAMPI_PROGETTO.includes(k))) return 2
  // F10: nella stessa scrittura anche lo strato Account e la lingua (un solo CAS: niente allentamenti intermedi).
  const account = richiesta.account ?? {}
  if (!account || typeof account !== 'object' || Array.isArray(account) || Object.keys(account).some(k => !CAMPI_ACCOUNT.includes(k))) return 2
  if (richiesta.lingua !== undefined && !CAMPI_UTENTE.lingua(richiesta.lingua)) return 2
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
    if ('pesi' in campi || 'profilo' in campi) {
      const o = precedente.pesiOrigine
      if (o && (o.tipo === 'proposta' || o.tipo === 'annullamento')) {
        try {
          recupera(c, richiesta.repo, leggiProposte(fileProposteDi(file)), fileProposteDi(file))
        } catch (e) {
          if (e instanceof Rifiuto) return 4
          throw e
        }
      }
      campi.pesiRevisione = revisioneDi(precedente) + 1
      campi.pesiOrigine = { tipo: 'manuale' }
    }
    if (campi.board) {
      // La generazione la decide l'helper, sotto lo stesso lock: ogni cambio di modo invalida il lavoro in volo.
      const b = precedente.board
      const gen = Number.isInteger(b?.generazione) && b.generazione >= 0 ? b.generazione : 0
      campi.board = { modo: campi.board.modo, generazione: b?.modo === campi.board.modo ? gen : gen + 1 }
    }
    const acc = c.account === undefined ? {} : c.account
    if (!acc || typeof acc !== 'object' || Array.isArray(acc)) return 2
    const togli = richiesta.togli ?? {}
    let progetto
    let nuovoAccount
    try {
      if (!oggetto(togli) || Object.keys(togli).some(k => !['progetto', 'account'].includes(k))) return 2
      // Si cancella solo ciò che la patch chiede (un campo a null, un percorso in `togli`); il resto si fonde e resta,
      // null preesistenti e campi sconosciuti annidati compresi.
      progetto = regole.applicaPatch(precedente, campi, togli.progetto ?? [])
      // L'origine dei pesi la decide l'helper: si sostituisce intera, mai fusa con quella di prima.
      if (campi.pesiOrigine) progetto.pesiOrigine = campi.pesiOrigine
      nuovoAccount = regole.applicaPatch(acc, account, togli.account ?? [])
      // Lo strato Account e le restrizioni devono valere; le restrizioni scritte adesso possono solo restringere.
      regole.regoleEfficaci(nuovoAccount, progetto)
      if ('restrizioni' in campi && progetto.restrizioni !== undefined && regole.restrizioneLarga(nuovoAccount, progetto.restrizioni)) return 2
      // F11.1: il modo di lavoro scritto adesso deve valere dopo la fusione (forma, valori, R4/R5 mai sotto high).
      if (('modoLavoro' in campi && regole.modoNonValido(progetto.modoLavoro)) || ('modoLavoro' in account && regole.modoNonValido(nuovoAccount.modoLavoro))) return 2
    } catch (e) {
      if (e instanceof regole.NonValido) return 2
      throw e
    }
    const progetti = { ...c.progetti, [richiesta.repo]: progetto }
    const radice = { ...c, progetti, ...(Object.keys(account).length && { account: nuovoAccount }), ...(richiesta.lingua !== undefined && { lingua: richiesta.lingua }) }
    scriviConfig(file, JSON.stringify(radice, null, 2))
    return 0
  })
  return r.occupato ? 3 : r.valore
}

/** I campi di `progetti[repo]` che `configura` scrive (F10: `restrizioni`); quelli dell'account (`account` nella radice). */
const CAMPI_PROGETTO = ['fornitori', 'soloLocale', 'milestoneGithub', 'pesi', 'limitiManuali', 'freellmapi', 'board', 'soglie', 'profilo', 'apiClaude', 'consigliere', 'restrizioni', 'modoLavoro']
const CAMPI_ACCOUNT = ['soglie', 'limitiManuali', 'apiClaude', 'freellmapi', 'modoLavoro']

/** I campi di primo livello che appartengono all'utente, non a un progetto, e come devono essere. */
const CAMPI_UTENTE = { lingua: v => ['en', 'it', 'es', 'fr', 'de', 'pt'].includes(v) }

/**
 * Come `configura`, ma per i campi dell'utente: stesso file, stesso mutex, stesso CAS sul testo intero, nessun `repo`
 * (funziona anche fuori da un repository). Scrive solo i campi di `CAMPI_UTENTE`, validati; i progetti restano intatti.
 */
async function configuraUtente(file, richiesta) {
  registraRadici(path.dirname(path.resolve(file)))
  const campi = richiesta?.campi
  if (!campi || typeof campi !== 'object' || Array.isArray(campi) || !Object.keys(campi).length ||
      Object.entries(campi).some(([k, v]) => !Object.hasOwn(CAMPI_UTENTE, k) || !CAMPI_UTENTE[k](v))) return 2
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const r = await conMutex(mutexConfig(file), 8000, () => {
    const prima = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null
    if (prima !== richiesta.atteso) return 4
    const c = prima === null ? {} : JSON.parse(prima)
    if (!c || typeof c !== 'object' || Array.isArray(c)) return 2
    scriviConfig(file, JSON.stringify({ ...c, ...campi }, null, 2))
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

/** Nessun componente da `<cartella>` in giù può essere un link o una junction (e ognuno, se c'è, è una cartella). */
function senzaLink(...percorsi) {
  for (const p of percorsi) {
    percorsoSicuro(p)
    let st
    try {
      st = fs.lstatSync(p)
    } catch (e) {
      if (e.code === 'ENOENT') continue
      throw e
    }
    if (st.isSymbolicLink() || !st.isDirectory()) throw new Rifiuto(6, `helper.collegamento: ${p}`)
  }
}

/**
 * F10: un percorso dei dati della mod (config, cartella dell'account, registro della spesa, cartella dati, board) vale
 * solo se: nessun antenato esistente, dalla radice del volume, è un link o una junction (`lstat`); il percorso reale
 * coincide con quello dichiarato; nessun antenato del percorso reale contiene `.git`, cartella o file. Ogni errore di
 * lettura blocca. Restituisce la parte esistente del percorso, reale; lancia un Rifiuto(6) con il motivo.
 */
function percorsoSicuro(p, radici = []) {
  if (typeof p !== 'string' || !path.isAbsolute(p)) throw new Rifiuto(6, 'helper.percorsoNonAssoluto')
  const catena = []
  for (let x = path.resolve(p); ; x = path.dirname(x)) {
    catena.unshift(x)
    if (path.dirname(x) === x) break
  }
  // Sopra la radice dati i link sono ammessi (home o `.claude` spostati dall'utente); dalla radice in giù nessuno, con
  // lstat su ogni componente: una junction dentro i dati porterebbe le scritture altrove. La radice è la più esterna fra
  // quelle effettive che contengono il percorso (la regola più severa); fuori da ogni radice nota, nessun link ammesso.
  const ins = process.platform === 'win32'
  const assoluto = path.resolve(p)
  const radice = [...RADICI, ...radici.map(r => path.resolve(r))].filter(r => regole.dentroRadice(r, assoluto, ins)).sort((a, b) => a.length - b.length)[0]
  const daRadice = x => radice === undefined || regole.dentroRadice(radice, x, ins)
  let esistente
  for (const x of catena) {
    let st
    try {
      st = fs.lstatSync(x)
    } catch (e) {
      if (e.code === 'ENOENT') break
      throw new Rifiuto(6, `helper.percorsoIlleggibile: ${x}`)
    }
    if (st.isSymbolicLink() && daRadice(x)) throw new Rifiuto(6, `helper.collegamento: ${x}`)
    esistente = x
  }
  if (!esistente) throw new Rifiuto(6, `helper.percorsoIlleggibile: ${p}`)
  let reale
  try {
    reale = fs.realpathSync.native(esistente)
  } catch {
    throw new Rifiuto(6, `helper.percorsoIlleggibile: ${esistente}`)
  }
  // Il percorso REALE (e ogni suo antenato reale) non ha `.git`, cartella o file: mai dentro un repository.
  for (let x = reale; ; x = path.dirname(x)) {
    try {
      fs.lstatSync(path.join(x, '.git'))
    } catch (e) {
      if (e.code !== 'ENOENT' && e.code !== 'ENOTDIR') throw new Rifiuto(6, `helper.percorsoIlleggibile: ${x}`)
      if (path.dirname(x) === x) break
      continue
    }
    throw new Rifiuto(6, `helper.dentroWorkingTree: ${x}`)
  }
  return reale
}

/** Un `.git` (cartella o file di un worktree) in `dir` o in uno dei suoi genitori. */
function gitRisalendo(dir) {
  for (let d = dir; ; d = path.dirname(d)) {
    if (fs.existsSync(path.join(d, '.git'))) return true
    if (path.dirname(d) === d) return false
  }
}

/**
 * Fuori da ogni working tree solo se è ACCERTATO: git risponde «not a git repository» e nessun `.git` risale
 * i genitori del percorso reale (o, senza git installato, nessun `.git`). Ogni altro esito blocca con il motivo.
 */
function dentroWorkingTree(dir) {
  const env = { ...process.env, LC_ALL: 'C', LANG: 'C', LANGUAGE: 'C' }
  for (const k of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_CEILING_DIRECTORIES']) delete env[k]
  const g = spawnSync('git', ['-C', dir, 'rev-parse', '--is-inside-work-tree'], { encoding: 'utf8', windowsHide: true, timeout: 10_000, env })
  if (g.error?.code === 'ENOENT') return gitRisalendo(dir)
  if (g.error) throw new Rifiuto(6, `helper.gitNonRisponde: ${g.error.code ?? g.error.message}`)
  if (g.status === 0) return true
  if (/not a git repository/i.test(g.stderr)) return gitRisalendo(dir)
  throw new Rifiuto(6, `helper.gitWorkingTree: ${(g.stderr.trim().split('\n')[0] || `exit ${g.status}`).slice(0, 160)}`)
}

/**
 * La cartella della board di `repo` dentro `<cartella>/board/`. Con `crea` la crea e scrive il marcatore con
 * l'identità; senza, restituisce null se non c'è. Rifiuta link, junction, identità diverse e working tree.
 */
function destBoard(cartella, repo, crea) {
  if (!path.isAbsolute(cartella)) throw new Rifiuto(2, 'helper.cartellaNonAssoluta')
  const base = path.resolve(cartella)
  const contenitore = path.join(base, 'board')
  const dest = path.join(contenitore, nomeBoard(repo))
  senzaLink(base, contenitore, dest)
  if (!fs.existsSync(dest)) {
    if (!crea) return null
    fs.mkdirSync(base, { recursive: true })
    // Il controllo «fuori da ogni working tree» va fatto prima di scrivere, sul percorso reale.
    if (dentroWorkingTree(fs.realpathSync.native(base)))
      throw new Rifiuto(6, 'helper.dentroWorkingTree')
    if (!fs.existsSync(contenitore)) fs.mkdirSync(contenitore)
    senzaLink(contenitore)
    fs.mkdirSync(dest)
  }
  senzaLink(base, contenitore, dest)
  const reale = fs.realpathSync.native(dest)
  if (!stessoPercorso(reale, path.join(fs.realpathSync.native(base), 'board', nomeBoard(repo))))
    throw new Rifiuto(6, 'helper.destinazione')
  if (dentroWorkingTree(reale)) throw new Rifiuto(6, 'helper.dentroWorkingTree')
  const marcatore = path.join(reale, MARCATORE)
  let st
  try {
    st = fs.lstatSync(marcatore)
  } catch (e) {
    if (e.code !== 'ENOENT') throw e
  }
  if (!st) {
    if (!crea || fs.readdirSync(reale).length) throw new Rifiuto(4, 'helper.senzaMarcatore')
    fs.writeFileSync(marcatore, repo, { mode: 0o600 })
  } else if (!st.isFile() || fs.readFileSync(marcatore, 'utf8') !== repo) throw new Rifiuto(4, 'helper.marcatoreAltrui')
  return reale
}

/** Esegue `fn(dest)` sotto il mutex del config, solo se la board di `repo` vale ancora `modi` alla `generazione` attesa. */
async function conBoard(file, cartella, repo, generazione, modi, crea, fn) {
  const gen = Number(generazione)
  if (typeof repo !== 'string' || !repo || repo.length > 400 || !Number.isInteger(gen) || gen < 0) return [2, 'helper.argomenti']
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const r = await conMutex(mutexConfig(file), 8000, () => {
    try {
      const c = JSON.parse(fs.readFileSync(file, 'utf8'))
      const b = c?.progetti?.[repo]?.board
      if (!b || !modi.includes(b.modo) || b.generazione !== gen) return [4, 'helper.boardCambiata']
      return fn(destBoard(cartella, repo, crea), c.progetti[repo])
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
    scriviDati(indice, html)
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

/**
 * Prenota un riassunto: impronta e un'unità del budget del giorno, insieme. Una prenotazione conta sempre. La
 * politica del progetto si rilegge qui, sotto lock, prima di OGNI chiamata: solo rete locale o Claude vietato = no.
 */
const boardPrenota = (file, cartella, repo, gen, impronta) =>
  conBoard(file, cartella, repo, gen, ['riassunti'], true, (dest, progetto) => {
    // Stessa regola di risorseDa: soloLocale booleano, fornitori noti (assenti = Claude e Codex). Non valida = no.
    const fornitori = progetto.fornitori ?? ['claude', 'codex']
    const valida = (progetto.soloLocale === undefined || typeof progetto.soloLocale === 'boolean') &&
      Array.isArray(fornitori) && fornitori.every(f => ['claude', 'codex', 'deepseek', 'freellmapi'].includes(f))
    if (!valida || progetto.soloLocale === true || !fornitori.includes('claude')) return [4, 'helper.riassuntiPolitica']
    const fr = path.join(dest, 'riassunti.json')
    const fb = path.join(dest, 'budget.json')
    const r = leggiJson(fr, { voci: {} })
    const b = leggiJson(fb, { giorno: oggi(), usati: 0 })
    if (r.voci?.[impronta]) return [4, 'helper.giaPrenotata']
    const usati = b.giorno === oggi() && Number.isInteger(b.usati) ? b.usati : 0
    if (usati >= TETTO_GIORNO) return [5, 'helper.tetto']
    scriviDati(fb, JSON.stringify({ giorno: oggi(), usati: usati + 1 }))
    scriviDati(fr, JSON.stringify({ voci: { ...r.voci, [impronta]: { stato: 'prenotata', quando: new Date().toISOString() } } }))
    return [0, '']
  })

const boardFinalizza = (file, cartella, repo, gen, impronta, esito) =>
  conBoard(file, cartella, repo, gen, ['riassunti'], false, dest => {
    if (!dest) return [4, 'helper.boardAssente']
    const fr = path.join(dest, 'riassunti.json')
    const r = leggiJson(fr, { voci: {} })
    if (r.voci?.[impronta]?.stato !== 'prenotata') return [4, 'helper.nessunaPrenotazione']
    const testo = typeof esito?.testo === 'string' && esito.testo.trim() ? esito.testo.trim().slice(0, 1000) : undefined
    const voce = testo ? { stato: 'fatto', testo, quando: new Date().toISOString() } : { stato: 'fallita', quando: new Date().toISOString() }
    scriviDati(fr, JSON.stringify({ voci: { ...r.voci, [impronta]: voce } }))
    return [0, '']
  })

const PIANO_MAX = 200 * 1024

/** Il piano di una chip: percorso relativo, sotto la radice REALE (link e junction risolti), file regolare, 200 KB. */
function leggiPiano(radice, relativo) {
  if (typeof relativo !== 'string' || !relativo || relativo.length > 300 || /[\x00-\x1f:*?"<>|]/.test(relativo) ||
      /^[\\/]/.test(relativo) || /(^|[\\/])\.\.([\\/]|$)/.test(relativo) || !/\.(md|txt)$/i.test(relativo)) return [4, 'helper.pianoNonAmmesso']
  try {
    const root = fs.realpathSync.native(radice)
    const reale = fs.realpathSync.native(path.resolve(root, relativo))
    const rel = path.relative(root, reale)
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return [4, 'helper.pianoFuori']
    const st = fs.statSync(reale)
    if (!st.isFile()) return [4, 'helper.pianoNonFile']
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
  // Quanti `git` si avviano davvero (3–5): su stderr, così il pannello li conta senza cambiare la risposta.
  let avviati = 0
  process.on('exit', () => process.stderr.write(`git=${avviati}
`))
  const git = args => (avviati++, spawnSync('git', ['-C', radice, ...args], { encoding: 'utf8', windowsHide: true, timeout: 15_000 }))
  // Il ramo base LOCALE: il nome che origin/HEAD indica, poi main e master. Mai origin/… (perde i commit locali)
  // né HEAD (nel worktree di un task è il ramo del task).
  const remoto = git(['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'])
  const daRemoto = remoto.status === 0 ? remoto.stdout.trim().replace(/^origin\//, '') : ''
  const nome = [daRemoto, 'main', 'master'].find(n => /^[A-Za-z0-9._/-]{1,100}$/.test(n) && git(['rev-parse', '--verify', '--quiet', `refs/heads/${n}`]).status === 0)
  if (!nome) return [4, 'helper.ramoBase']
  const r = git(['log', '--first-parent', '-15', '--format=%h%x09%cI%x09%s', `refs/heads/${nome}`, '--'])
  if (r.status !== 0) return [4, 'helper.gitLog']
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
  registraRadici(dir)
  if (!idValido(id) || !tentativoValido(tentativo)) return 2
  const r = await conMutex(MUTEX_AZIONI(dir), 8000, async () => {
    const a = JSON.parse(fs.readFileSync(path.join(dir, `${id}.json`), 'utf8'))
    if (a.stato !== 'in-avvio' || a.lanciatore !== 'cli' || a.tentativo !== tentativo) return 4
    const file = fileEsecuzione(dir, tentativo)
    if (fs.existsSync(file)) return 4
    fs.mkdirSync(path.dirname(file), { recursive: true })
    scriviDati(file, JSON.stringify({ id, tentativo, stato: 'in-avvio' }))
    try {
      const p = spawn(process.execPath, [__filename, 'esegui-cli', dir, id, tentativo], { stdio: ['pipe', 'ignore', 'ignore'], detached: true, windowsHide: true })
      await new Promise((ok, ko) => { p.once('spawn', ok); p.once('error', ko) })
      p.stdin.on('error', () => {})
      p.stdin.end(JSON.stringify(input))
      p.unref()
      return 0
    } catch {
      scriviDati(file, JSON.stringify({ id, tentativo, stato: 'fallita', errore: 'processo non avviato' }))
      return 1
    }
  })
  return r.occupato ? 3 : r.valore
}

/**
 * Il worktree del tentativo, sotto `<progetto>/.claude/worktrees`, su un ramo nuovo dalla base: mai fuori dal progetto e
 * mai rimosso in automatico. `fuori.ramo` si scrive prima di crearlo, così un errore lo può nominare.
 */
function preparaWorktree(input, tentativo, deps = {}, fuori = {}) {
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
  const ramo = (fuori.ramo = `chipmanager/${tentativo}`)
  git(['worktree', 'add', '-b', ramo, cwd, base])
  return { cwd, ramo, base }
}

/** I parametri di un avvio da riga di comando (CLI o API): modello, effort e permessi fra quelli ammessi. */
const parametriValidi = input =>
  !!input && typeof input.root === 'string' && typeof input.prompt === 'string' && input.prompt.length <= 40000 &&
  /^claude-[a-z0-9.-]{1,80}$/.test(input.modello) && ['low', 'medium', 'high', 'xhigh'].includes(input.effort) &&
  ['default', 'acceptEdits', 'plan'].includes(input.permessi) && (!input.base || /^[A-Za-z0-9][A-Za-z0-9._/-]{0,99}$/.test(input.base))

/** Worktree unico; mai rimozione automatica. stdout/stderr del modello non diventano log della mod. */
async function eseguiCli(dir, id, tentativo, input, deps = {}) {
  registraRadici(dir)
  if (!idValido(id) || !tentativoValido(tentativo)) throw new Error('identità non valida')
  const file = fileEsecuzione(dir, tentativo)
  // Giro 2, rilievo 2: la catena delle esecuzioni prima di leggere il segno, creare il worktree o avviare il processo.
  percorsoSicuro(file)
  const segno = JSON.parse(fs.readFileSync(file, 'utf8'))
  if (segno.id !== id || segno.tentativo !== tentativo || segno.stato !== 'in-avvio') throw new Error('tentativo non valido')
  const r = await conMutex(mutexEsecuzione('cli', file), 0, async () => {
    const scrivi = campi => scriviDati(file, JSON.stringify({ id, tentativo, ...campi }))
    let partito = false
    const fuori = {}
    let ramo
    try {
      if (!parametriValidi(input)) throw new Error('parametri non validi')
      percorsoSicuro(file)
      const { cwd } = preparaWorktree(input, tentativo, deps, fuori)
      ramo = fuori.ramo
      const env = { ...process.env }
      delete env.CLAUDECODE
      // Ancora subito prima dello spawn: una junction comparsa durante il worktree ferma tutto prima del processo.
      percorsoSicuro(file)
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
      ramo ??= fuori.ramo
      scrivi({ stato: partito ? 'avviata' : 'fallita', ramo, errore: partito ? 'esito CLI incerto: controlla il processo e il worktree' : 'CLI non avviata: verifica comando e worktree; nessun file eliminato' })
    }
  })
  return r.occupato ? 3 : 0
}

async function occupata(nome, mutexCodex = MUTEX_CODEX) {
  // Sotto il mutex: chi esegue tiene il mutex (occupata), e nessuno può sostituire il segno mentre lo si
  // controlla e, se l'albero è estinto, lo si toglie.
  const r = await conMutex(nome, 0, () => (nome === mutexCodex ? figlioVivo() : false))
  return r.occupato || r.valore ? 3 : 0
}

/**
 * Tiene la corsia di Codex per tutta la vita del comando (il mutex è di questo processo: se il comando o
 * questo processo muoiono, la corsia si libera). Le revisioni hanno la precedenza (routing.json,
 * corsia_codex): un'implementazione cede finché c'è una revisione viva in attesa.
 */
async function corsiaCodex(argv, mutexCodex = MUTEX_CODEX) {
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
      const r = await conMutex(mutexCodex, Math.min(2_000, Math.max(0, fine - Date.now())), async () => {
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

// --- proposte di pesi (F4) ---------------------------------------------------------------------------
// Un'unica autorità: questi comandi e `configura` lavorano sotto il mutex del config. Il legame fra operazione e
// proposta (`pesiOrigine = { tipo, id, voce, versione }`) entra nel config nella stessa scrittura che cambia i pesi;
// prima di ogni altra scrittura il recupero lo completa nel file delle proposte. Mai dedotto dai valori dei pesi.
// Uscite: 0 ok (stdout JSON) · 2 uso · 3 mutex occupato · 4 rifiuto (stdout: il motivo).

const PROFILI = ['automatico', 'risparmio', 'qualita', 'velocita', 'personalizzato']
const SCADENZA_PROPOSTA = 24 * 3_600_000
const MAX_ATTESA = 3
const MAX_VOCI = 10
const ID_VOCE = /^p-[a-z0-9]{6,40}$/
const ID_DECISIONE = /^d-[a-z0-9]{6,40}$/
const ID_ANNULLAMENTO = /^u-[a-z0-9]{6,40}$/
// Accanto al config, non nella cartella dei dati: config e mutex sono uno solo, la cartella dei dati può cambiare fra
// sessioni (CHIPMANAGER_DIR, «cartella»). Così decisione, recupero e `configura` leggono sempre lo stesso file.
const fileProposteDi = file => path.join(path.dirname(file), 'proposte-pesi.json')
// I testi che arrivano al committente, raccolti qui.
// Codici del dizionario della mod (hooks/lingue): il pannello li traduce, gli agenti li ricevono in inglese.
const TESTI_PESI = {
  argomenti: 'helper.argomenti',
  campi: 'helper.campi',
  illeggibile: 'helper.proposteIlleggibili',
  configIlleggibile: 'helper.configIlleggibile',
  nonTrovata: 'helper.nonTrovata',
  cambiata: 'helper.cambiata',
  scaduta: 'helper.scaduta',
  primaDellaProposta: 'helper.primaDellaProposta',
  dopoApplicazione: 'helper.dopoApplicazione',
  nonApplicata: 'helper.nonApplicata',
  scadutaDopo: 'helper.scadutaDopo',
  sostituita: 'helper.sostituita',
}

const oggetto = x => !!x && typeof x === 'object' && !Array.isArray(x)
const numero = (v, min, max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max
// Stesse regole di `pesoValido` nella mod.
const pesoOk = p => oggetto(p) && Object.keys(p).every(k => ['tipo', 'nome', 'percentuale', 'assoluto'].includes(k)) &&
  ['fornitore', 'modello', 'effort'].includes(p.tipo) && typeof p.nome === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,99}$/.test(p.nome) &&
  numero(p.percentuale, -100, 1000) && numero(p.assoluto, -100, 1000)
const pesiOk = x => Array.isArray(x) && x.length <= 100 && x.every(pesoOk) && new Set(x.map(p => `${p.tipo}:${p.nome}`)).size === x.length
/** Solo `{ profilo, pesi }`: un qualsiasi altro campo rifiuta, così l'applicazione non scrive mai altro. */
const pesiProfiloOk = s => oggetto(s) && Object.keys(s).every(k => k === 'profilo' || k === 'pesi') && (s.profilo === null || PROFILI.includes(s.profilo)) && pesiOk(s.pesi)

const revisioneDi = prog => (Number.isInteger(prog?.pesiRevisione) && prog.pesiRevisione >= 0 ? prog.pesiRevisione : 0)
const pesiProfiloDi = prog => ({ profilo: PROFILI.includes(prog?.profilo) ? prog.profilo : null, pesi: Array.isArray(prog?.pesi) ? prog.pesi : [] })
const canonico = s => JSON.stringify([s.profilo ?? null, (s.pesi ?? []).map(p => [p.tipo, p.nome, p.percentuale, p.assoluto])])
const ugualiPesi = (a, b) => canonico(a) === canonico(b)

function leggiProposte(file) {
  let testo
  try {
    testo = fs.readFileSync(file, 'utf8')
  } catch (e) {
    if (e.code === 'ENOENT') return { versione: 0, voci: [] }
    throw e
  }
  let p
  try {
    p = JSON.parse(testo)
  } catch {
    throw new Rifiuto(4, TESTI_PESI.illeggibile)
  }
  if (!oggetto(p) || !Number.isInteger(p.versione) || !Array.isArray(p.voci) || !p.voci.every(v => oggetto(v) && typeof v.id === 'string' && Number.isInteger(v.versione)))
    throw new Rifiuto(4, TESTI_PESI.illeggibile)
  return p
}
function scriviProposte(file, p) {
  p.versione += 1
  scriviDati(file, JSON.stringify(p, null, 2))
}
function leggiConfigPesi(file) {
  if (!fs.existsSync(file)) return {}
  let c
  try {
    c = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    throw new Rifiuto(4, TESTI_PESI.configIlleggibile)
  }
  if (!oggetto(c) || (c.progetti !== undefined && !oggetto(c.progetti))) throw new Rifiuto(4, TESTI_PESI.configIlleggibile)
  return c
}
const conProgetto = (c, repo, prog) => ({ ...c, progetti: { ...c.progetti, [repo]: prog } })
/** Il progetto con profilo e pesi di `s`; profilo null = nessun profilo salvato. */
function conPesiProfilo(prog, s, revisione, origine) {
  const nuovo = { ...prog, pesi: s.pesi, pesiRevisione: revisione, pesiOrigine: origine }
  if (s.profilo) nuovo.profilo = s.profilo
  else delete nuovo.profilo
  return nuovo
}

/** Completa nel file delle proposte l'operazione che `pesiOrigine` dice già scritta nel config. */
function recupera(c, repo, P, fileProposte) {
  const prog = c.progetti?.[repo]
  const o = prog?.pesiOrigine
  if (!oggetto(o) || (o.tipo !== 'proposta' && o.tipo !== 'annullamento')) return
  const v = P.voci.find(x => x.id === o.voce && x.progetto === repo)
  if (!v || v.versione !== o.versione) return
  const traccia = { id: o.id, quando: new Date().toISOString(), revisione: revisioneDi(prog) }
  if (o.tipo === 'proposta' && v.stato === 'attesa' && v.decisione?.id !== o.id) Object.assign(v, { stato: 'applicata', decisione: { ...traccia, esito: 'applica' } })
  else if (o.tipo === 'annullamento' && v.stato === 'applicata' && v.annullamento?.id !== o.id) Object.assign(v, { stato: 'annullata', annullamento: traccia })
  else return
  v.versione += 1
  scriviProposte(fileProposte, P)
}

/** Le voci in attesa da più di 24 ore scadono. Restituisce se qualcosa è cambiato. */
function scadi(P, repo, adesso) {
  let cambiato = false
  for (const v of P.voci)
    if (v.progetto === repo && v.stato === 'attesa' && !(adesso - Date.parse(v.quando) <= SCADENZA_PROPOSTA)) {
      Object.assign(v, { stato: 'scaduta', nota: TESTI_PESI.scadutaDopo })
      v.versione += 1
      cambiato = true
    }
  return cambiato
}

/** Sotto il mutex del config: legge config e proposte, recupera, poi `fn(c, P)`. */
async function conPesi(file, repo, fn) {
  if (typeof repo !== 'string' || !repo || repo.length > 400 || typeof file !== 'string' || !path.isAbsolute(file)) return [2, TESTI_PESI.argomenti]
  const fileProposte = fileProposteDi(file)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const r = await conMutex(mutexConfig(file), 8000, () => {
    try {
      const c = leggiConfigPesi(file)
      const P = leggiProposte(fileProposte)
      recupera(c, repo, P, fileProposte)
      return fn(c, P, fileProposte)
    } catch (e) {
      if (e instanceof Rifiuto) return [e.codice, e.message]
      throw e
    }
  })
  return r.occupato ? [3, 'mutex occupato'] : r.valore
}

// --- F7.1: proposte di impostazioni -------------------------------------------------------------------------
// Una per progetto, in attesa che il pannello la prenda nella bozza; scade dopo 24 ore. La forma si ricontrolla qui, con
// la stessa regola dello strumento: un campo sconosciuto o vietato rifiuta tutto, e il valore non si ripete mai.

const fileImpostazioniDi = file => path.join(path.dirname(file), 'proposte-impostazioni.json')
const FORNITORI_SOGLIE = ['claude', 'codex', 'deepseek', 'freellmapi']
const LINGUE_PROPOSTA = ['en', 'it', 'es', 'fr', 'de', 'pt']
const numeroIn = (x, min, max, intero = false) => typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max && (!intero || Number.isInteger(x))

/** Null se la proposta ha la forma ammessa; altrimenti il campo (solo il nome) che la rifiuta. */
function propostaImpostazioniNonValida(x) {
  const solo = (v, ammesse, dove) => Object.keys(v).find(k => !ammesse.includes(k)) && `${dove}${Object.keys(v).find(k => !ammesse.includes(k))}`
  if (!oggetto(x)) return 'proposta'
  // F10: una patch per strato, ciascuna con la sua whitelist (la stessa di `propostaImpostazioniDa` nel pannello).
  const fuori = solo(x, ['motivo', 'progetto', 'account', 'lingua'], '')
  if (fuori) return fuori
  if (typeof x.motivo !== 'string' || !x.motivo.trim() || x.motivo.length > 300) return 'motivo'
  const soglie = (v, dove) => {
    if (!oggetto(v) || !Object.keys(v).length) return dove
    const f = solo(v, FORNITORI_SOGLIE, `${dove}.`)
    if (f) return f
    for (const [k, s] of Object.entries(v)) {
      if (s === null) continue
      if (!oggetto(s)) return `${dove}.${k}`
      const g = solo(s, ['attenzione', 'critica'], `${dove}.${k}.`)
      if (g) return g
      if (!numeroIn(s.attenzione, 1, 100, true) || !numeroIn(s.critica, 1, 100, true) || s.attenzione >= s.critica) return `${dove}.${k}`
    }
    return null
  }
  if (x.progetto !== undefined) {
    const q = x.progetto
    if (!oggetto(q) || !Object.keys(q).length) return 'progetto'
    const g = solo(q, ['profilo', 'board', 'consigliere', 'restrizioni', 'modoLavoro'], 'progetto.')
    if (g) return g
    if (q.profilo !== undefined && !PROFILI.includes(q.profilo)) return 'progetto.profilo'
    if (q.board !== undefined) {
      if (!oggetto(q.board)) return 'progetto.board'
      const h = solo(q.board, ['modo'], 'progetto.board.')
      if (h) return h
      if (!['spenta', 'accesa', 'riassunti'].includes(q.board.modo)) return 'progetto.board.modo'
    }
    if (q.consigliere !== undefined && !['spento', 'suggerisci', 'applica'].includes(q.consigliere)) return 'progetto.consigliere'
    if (q.restrizioni !== undefined) {
      const r = q.restrizioni
      if (!oggetto(r) || !Object.keys(r).length) return 'progetto.restrizioni'
      const h = solo(r, ['soglie', 'apiLimiteMeseUsd', 'apiTetto'], 'progetto.restrizioni.')
      if (h) return h
      const sg = r.soglie === undefined ? null : soglie(r.soglie, 'progetto.restrizioni.soglie')
      if (sg) return sg
      if (r.apiLimiteMeseUsd !== undefined && !numeroIn(r.apiLimiteMeseUsd, 0.01, 100_000)) return 'progetto.restrizioni.apiLimiteMeseUsd'
      if (r.apiTetto !== undefined && !numeroIn(r.apiTetto, 0.01, 1_000)) return 'progetto.restrizioni.apiTetto'
    }
    if (q.modoLavoro !== undefined) {
      const m = q.modoLavoro === null ? 'modoLavoro' : regole.modoNonValido(q.modoLavoro)
      if (m || !Object.keys(q.modoLavoro).length) return `progetto.${m ?? 'modoLavoro'}`
    }
  }
  if (x.account !== undefined) {
    const a = x.account
    if (!oggetto(a) || !Object.keys(a).length) return 'account'
    const g = solo(a, ['soglie', 'apiClaude', 'modoLavoro'], 'account.')
    if (g) return g
    const sg = a.soglie === undefined ? null : soglie(a.soglie, 'account.soglie')
    if (sg) return sg
    if (a.apiClaude !== undefined) {
      if (!oggetto(a.apiClaude) || !Object.keys(a.apiClaude).length) return 'account.apiClaude'
      const h = solo(a.apiClaude, ['budgetUsd', 'tetto'], 'account.apiClaude.')
      if (h) return h
      if (a.apiClaude.budgetUsd !== undefined && !numeroIn(a.apiClaude.budgetUsd, 0.01, 100_000)) return 'account.apiClaude.budgetUsd'
      if (a.apiClaude.tetto !== undefined && !numeroIn(a.apiClaude.tetto, 0.01, 1_000)) return 'account.apiClaude.tetto'
    }
    if (a.modoLavoro !== undefined) {
      const m = a.modoLavoro === null ? 'modoLavoro' : regole.modoNonValido(a.modoLavoro)
      if (m || !Object.keys(a.modoLavoro).length) return `account.${m ?? 'modoLavoro'}`
    }
  }
  if (x.lingua !== undefined && !LINGUE_PROPOSTA.includes(x.lingua)) return 'lingua'
  return Object.keys(x).length < 2 ? 'proposta' : null
}

function leggiImpostazioniProposte(file) {
  let testo
  try {
    testo = fs.readFileSync(file, 'utf8')
  } catch (e) {
    if (e.code === 'ENOENT') return { versione: 0, voci: {} }
    throw e
  }
  const p = JSON.parse(testo)
  if (!oggetto(p) || !Number.isInteger(p.versione) || !oggetto(p.voci)) throw new Error('proposals file not valid')
  return p
}

/** stdin `{ repo, proponente: { id, titolo }, proposta }`: 0 e l'id, 4 se un'altra proposta del progetto aspetta, 2 se la forma non va. */
async function impostazioniProponi(file, q) {
  if (!oggetto(q) || Object.keys(q).some(k => !['repo', 'proponente', 'proposta'].includes(k)) || typeof q.repo !== 'string' || !q.repo || q.repo.length > 400 ||
      !oggetto(q.proponente) || typeof q.proponente.id !== 'string' || !q.proponente.id || q.proponente.id.length > 200 ||
      (q.proponente.titolo !== undefined && (typeof q.proponente.titolo !== 'string' || q.proponente.titolo.length > 80)) || typeof file !== 'string' || !path.isAbsolute(file))
    return [2, 'arguments not valid']
  const campo = propostaImpostazioniNonValida(q.proposta)
  if (campo) return [2, `field "${String(campo).replace(/[^A-Za-z0-9_.-]/g, '?').slice(0, 60)}" is not accepted: the whole proposal is rejected`]
  const fp = fileImpostazioniDi(file)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const r = await conMutex(mutexConfig(file), 8000, () => {
    const P = leggiImpostazioniProposte(fp)
    const adesso = Date.now()
    const c = P.voci[q.repo]
    if (c && adesso - Date.parse(c.quando) <= SCADENZA_PROPOSTA) return [4, 'another settings proposal for this project is already waiting for the owner: try again after it is reviewed']
    const id = `i-${adesso.toString(36)}${crypto.randomBytes(3).toString('hex')}`
    P.voci[q.repo] = { id, quando: new Date(adesso).toISOString(), proponente: { id: q.proponente.id, titolo: q.proponente.titolo ?? '' }, proposta: { ...q.proposta, motivo: q.proposta.motivo.trim() } }
    P.versione += 1
    scriviDati(fp, JSON.stringify(P, null, 2))
    return [0, JSON.stringify({ id })]
  })
  return r.occupato ? [3, 'mutex occupato'] : r.valore
}

/** Il pannello prende la proposta `id` del progetto (una volta sola): 0 e la voce, 4 se non c'è più o è scaduta. */
async function impostazioniPrendi(file, repo, id) {
  if (typeof repo !== 'string' || !repo || typeof id !== 'string' || !/^i-[a-z0-9]{6,20}$/.test(id) || typeof file !== 'string' || !path.isAbsolute(file)) return [2, 'arguments not valid']
  const fp = fileImpostazioniDi(file)
  const r = await conMutex(mutexConfig(file), 8000, () => {
    const P = leggiImpostazioniProposte(fp)
    const v = P.voci[repo]
    if (!v || v.id !== id) return [4, 'proposal no longer there']
    delete P.voci[repo]
    P.versione += 1
    scriviDati(fp, JSON.stringify(P, null, 2))
    // Ricontrollata anche all'uscita: una voce scaduta o di forma non valida non arriva al pannello.
    if (!(Date.now() - Date.parse(v.quando) <= SCADENZA_PROPOSTA) || propostaImpostazioniNonValida(v.proposta)) return [4, 'proposal expired or not valid']
    return [0, JSON.stringify(v)]
  })
  return r.occupato ? [3, 'mutex occupato'] : r.valore
}

/**
 * stdin: `{ repo, proponente: { id, titolo }, motivo, profilo?, regolazioni?, partenza: { profilo, pesi }, revisione, risultato: { profilo, pesi } }`.
 * La partenza deve essere ancora quella del config (valori e revisione). Oltre 3 in attesa la più vecchia scade.
 */
async function pesiProponi(file, q) {
  const ammessi = ['repo', 'proponente', 'motivo', 'profilo', 'regolazioni', 'partenza', 'revisione', 'risultato']
  if (!oggetto(q) || Object.keys(q).some(k => !ammessi.includes(k))) return [2, TESTI_PESI.campi]
  const chi = q.proponente
  if (!oggetto(chi) || typeof chi.id !== 'string' || !chi.id || chi.id.length > 200 || (chi.titolo !== undefined && (typeof chi.titolo !== 'string' || chi.titolo.length > 80)) ||
      typeof q.motivo !== 'string' || !q.motivo.trim() || q.motivo.length > 300 ||
      (q.profilo !== undefined && !PROFILI.includes(q.profilo)) ||
      (q.regolazioni !== undefined && !(Array.isArray(q.regolazioni) && q.regolazioni.length <= 30 && q.regolazioni.every(x =>
        oggetto(x) && ['fornitore', 'modello', 'effort'].includes(x.tipo) && typeof x.nome === 'string' && x.nome.length <= 100 && Number.isInteger(x.posizione) && x.posizione >= 0 && x.posizione <= 4))) ||
      (q.profilo === undefined && q.regolazioni === undefined) ||
      !Number.isInteger(q.revisione) || q.revisione < 0 || !pesiProfiloOk(q.partenza) || !pesiProfiloOk(q.risultato) || !q.risultato.profilo) return [2, TESTI_PESI.campi]
  return conPesi(file, q.repo, (c, P, fileProposte) => {
    const prog = c.progetti?.[q.repo] ?? {}
    if (revisioneDi(prog) !== q.revisione || !ugualiPesi(pesiProfiloDi(prog), q.partenza)) return [4, TESTI_PESI.primaDellaProposta]
    const adesso = Date.now()
    scadi(P, q.repo, adesso)
    const scadute = []
    const inAttesa = P.voci.filter(v => v.progetto === q.repo && v.stato === 'attesa').sort((x, y) => Date.parse(x.quando) - Date.parse(y.quando))
    while (inAttesa.length >= MAX_ATTESA) {
      const v = inAttesa.shift()
      Object.assign(v, { stato: 'scaduta', nota: TESTI_PESI.sostituita })
      v.versione += 1
      scadute.push(v.id)
    }
    const voce = {
      id: `p-${adesso.toString(36)}${crypto.randomBytes(3).toString('hex')}`, versione: 0, progetto: q.repo,
      proponente: { id: chi.id, titolo: chi.titolo ?? '' }, quando: new Date(adesso).toISOString(), motivo: q.motivo.trim(),
      ...(q.profilo !== undefined && { profilo: q.profilo }), ...(q.regolazioni !== undefined && { regolazioni: q.regolazioni }),
      partenza: { profilo: q.partenza.profilo, pesi: q.partenza.pesi, revisione: q.revisione },
      risultato: { profilo: q.risultato.profilo, pesi: q.risultato.pesi }, stato: 'attesa',
    }
    P.voci.push(voce)
    // Al massimo MAX_VOCI per progetto: escono le più vecchie già decise.
    const decise = P.voci.filter(v => v.progetto === q.repo && v.stato !== 'attesa').sort((x, y) => Date.parse(x.quando) - Date.parse(y.quando))
    const troppe = P.voci.filter(v => v.progetto === q.repo).length - MAX_VOCI
    const fuori = new Set(decise.slice(0, Math.max(0, troppe)).map(v => v.id))
    P.voci = P.voci.filter(v => v.progetto !== q.repo || !fuori.has(v.id))
    scriviProposte(fileProposte, P)
    return [0, JSON.stringify({ id: voce.id, scadute })]
  })
}

/**
 * Applica o rifiuta la voce alla `versione` vista. Primo controllo: la stessa chiave di decisione ha già deciso →
 * l'esito registrato, senza riscrivere. `opz.dopoConfig` esiste solo per le prove (arresto fra le due scritture).
 */
async function pesiDecidi(file, repo, idVoce, versione, esito, idDecisione, opz = {}) {
  if (!ID_VOCE.test(idVoce) || !/^\d{1,9}$/.test(String(versione)) || !['applica', 'rifiuta'].includes(esito) || !ID_DECISIONE.test(idDecisione)) return [2, TESTI_PESI.argomenti]
  return conPesi(file, repo, (c, P, fileProposte) => {
    const v = P.voci.find(x => x.id === idVoce && x.progetto === repo)
    if (!v) return [4, TESTI_PESI.nonTrovata]
    if (v.decisione?.id === idDecisione) return [0, JSON.stringify({ stato: v.stato, decisione: v.decisione })]
    if (scadi(P, repo, Date.now())) scriviProposte(fileProposte, P)
    if (v.stato !== 'attesa' || v.versione !== Number(versione)) return [4, v.stato === 'scaduta' ? TESTI_PESI.scaduta : TESTI_PESI.cambiata]
    const quando = new Date().toISOString()
    if (esito === 'applica') {
      const partenza = oggetto(v.partenza) ? { profilo: v.partenza.profilo, pesi: v.partenza.pesi } : null
      if (!pesiProfiloOk(v.risultato) || !pesiProfiloOk(partenza)) return [4, TESTI_PESI.campi]
      const prog = c.progetti?.[repo] ?? {}
      if (!oggetto(prog)) return [4, TESTI_PESI.configIlleggibile]
      const R = revisioneDi(prog)
      if (R !== v.partenza.revisione || !ugualiPesi(pesiProfiloDi(prog), partenza)) return [4, TESTI_PESI.primaDellaProposta]
      const origine = { tipo: 'proposta', id: idDecisione, voce: v.id, versione: v.versione }
      scriviConfig(file, JSON.stringify(conProgetto(c, repo, conPesiProfilo(prog, v.risultato, R + 1, origine)), null, 2))
      opz.dopoConfig?.()
      Object.assign(v, { stato: 'applicata', decisione: { id: idDecisione, esito, quando, revisione: R + 1 } })
    } else Object.assign(v, { stato: 'rifiutata', decisione: { id: idDecisione, esito, quando } })
    v.versione += 1
    scriviProposte(fileProposte, P)
    return [0, JSON.stringify({ stato: v.stato, decisione: v.decisione })]
  })
}

/** Ripristina la partenza solo se il config porta ancora la revisione e l'origine di quella applicazione. */
async function pesiAnnulla(file, repo, idVoce, idAnnullamento, opz = {}) {
  if (!ID_VOCE.test(idVoce) || !ID_ANNULLAMENTO.test(idAnnullamento)) return [2, TESTI_PESI.argomenti]
  return conPesi(file, repo, (c, P, fileProposte) => {
    const v = P.voci.find(x => x.id === idVoce && x.progetto === repo)
    if (!v) return [4, TESTI_PESI.nonTrovata]
    if (v.annullamento?.id === idAnnullamento) return [0, JSON.stringify({ stato: v.stato, annullamento: v.annullamento })]
    if (v.stato !== 'applicata' || !oggetto(v.decisione)) return [4, TESTI_PESI.nonApplicata]
    const prog = c.progetti?.[repo] ?? {}
    const R = revisioneDi(prog)
    if (R !== v.decisione.revisione || prog.pesiOrigine?.id !== v.decisione.id) return [4, TESTI_PESI.dopoApplicazione]
    const partenza = oggetto(v.partenza) ? { profilo: v.partenza.profilo, pesi: v.partenza.pesi } : null
    if (!pesiProfiloOk(partenza)) return [4, TESTI_PESI.campi]
    const origine = { tipo: 'annullamento', id: idAnnullamento, voce: v.id, versione: v.versione }
    scriviConfig(file, JSON.stringify(conProgetto(c, repo, conPesiProfilo(prog, partenza, R + 1, origine)), null, 2))
    opz.dopoConfig?.()
    Object.assign(v, { stato: 'annullata', annullamento: { id: idAnnullamento, quando: new Date().toISOString(), revisione: R + 1 } })
    v.versione += 1
    scriviProposte(fileProposte, P)
    return [0, JSON.stringify({ stato: v.stato, annullamento: v.annullamento })]
  })
}

/** Il punto d'ingresso: un percorso dei dati rifiutato in qualunque comando (anche a metà, in una scrittura) esce con 6 e il motivo. */
async function main(argv, opz = {}) {
  // Le radici effettive dal pannello: un array di percorsi assoluti; una forma diversa blocca il comando.
  const dalPannello = process.env.CHIPMANAGER_RADICI
  if (dalPannello !== undefined) {
    let lista
    try {
      lista = JSON.parse(dalPannello)
    } catch {
      return esci(2, 'CHIPMANAGER_RADICI')
    }
    if (!Array.isArray(lista) || lista.length > 8 || !lista.every(x => typeof x === 'string' && x.length < 500 && path.isAbsolute(x))) return esci(2, 'CHIPMANAGER_RADICI')
    registraRadici(...lista)
  }
  // E quelle che ogni comando nomina nei propri argomenti.
  const [cmd, ...a] = argv
  const cartellaDi = f => (typeof f === 'string' && path.isAbsolute(f) ? path.dirname(path.resolve(f)) : undefined)
  if (/^(configura|configura-utente|ripristina-config|pesi-[a-z]+|impostazioni-[a-z]+)$/.test(cmd ?? '')) registraRadici(cartellaDi(a[0]))
  else if (/^(prenota|lancia-cli|esegui-cli|stato-cli|archivia-registro)$/.test(cmd ?? '')) registraRadici(a[0])
  else if (cmd === 'cas') registraRadici(cartellaDi(a[0]))
  else if (/^board-[a-z]+$/.test(cmd ?? '') || cmd === 'diagnosi') registraRadici(cartellaDi(a[0]), a[1])
  else if (cmd === 'sposta-dati') registraRadici(cartellaDi(a[0]), a[2])
  try {
    return await comandoHelper(argv, opz)
  } catch (e) {
    if (e instanceof Rifiuto) return esci(e.codice ?? 6, e.message)
    throw e
  }
}

async function comandoHelper(argv, { mutexCodex = MUTEX_CODEX, dirMacchina } = {}) {
  const [cmd, ...a] = argv
  const stdin = () => JSON.parse(fs.readFileSync(0, 'utf8'))
  // F6.2: la corsia a crediti API di Claude vive in un modulo suo (letto qui, a modulo caricato).
  if (/^((lancia|esegui|stato|libera|termina)-api|stato-esecuzione|accedi)$/.test(cmd ?? '')) return require('./api-claude.cjs').comando(cmd, a, stdin, { dirMacchina })
  // F10: config e cartelle dei dati fuori da ogni albero git e da ogni link, prima di qualunque lettura o scrittura.
  const sicuro = cmd === 'cas' ? path.dirname(a[0] ?? '') : /^(configura|configura-utente|ripristina-config|board-[a-z]+|pesi-[a-z]+|impostazioni-[a-z]+|prenota|lancia-cli|esegui-cli|stato-cli)$/.test(cmd ?? '') ? a[0] : undefined
  if (sicuro !== undefined) {
    try {
      percorsoSicuro(sicuro)
    } catch (e) {
      if (e instanceof Rifiuto) return esci(6, e.message)
      throw e
    }
  }
  if (cmd === 'configura' && a.length === 1) return esci(await configura(a[0], stdin()))
  if (cmd === 'configura-utente' && a.length === 1) return esci(await configuraUtente(a[0], stdin()))
  // F11.3: il doctor. La diagnosi legge soltanto (anche percorsi rifiutati: li riporta); i rimedi sono comandi a parte.
  if (cmd === 'ripristina-config' && a.length === 1) return esci(...(await ripristinaConfig(a[0], stdin())))
  if (cmd === 'diagnosi' && a.length === 4) return esci(0, JSON.stringify(require('./diagnosi.cjs').diagnosi(...a, { dm: dirMacchina })))
  if (cmd === 'archivia-registro' && a.length === 1) return esci(...(await require('./diagnosi.cjs').archiviaRegistro(a[0])))
  if (cmd === 'apri-url' && a.length === 1) return esci(...apriUrl(a[0]))
  if (cmd === 'sposta-dati' && a.length === 4) return esci(...(await spostaDati(...a, stdin())))
  if (cmd === 'segnala-gh' && !a.length) return esci(...segnalaGh(stdin()))
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
  if (cmd === 'occupata' && a.length === 1) return esci(await occupata(a[0] === 'codex' ? mutexCodex : a[0], mutexCodex))
  if (cmd === 'corsia-codex') return esci(await corsiaCodex(a, mutexCodex))
  if (cmd === 'leggi-piano' && a.length === 2) return esci(...leggiPiano(...a))
  if (cmd === 'git-log' && a.length === 1) return esci(...gitLog(a[0]))
  if (cmd === 'board-scrivi' && a.length === 5) return esci(...(await boardScrivi(...a, fs.readFileSync(0, 'utf8'))))
  if (cmd === 'board-spegni' && a.length === 4) return esci(...(await boardSpegni(...a)))
  if (cmd === 'board-prenota' && a.length === 5) return esci(...(await boardPrenota(...a)))
  if (cmd === 'board-finalizza' && a.length === 5) return esci(...(await boardFinalizza(...a, stdin())))
  if (cmd === 'pesi-proponi' && a.length === 1) return esci(...(await pesiProponi(a[0], stdin())))
  if (cmd === 'impostazioni-proponi' && a.length === 1) return esci(...(await impostazioniProponi(a[0], stdin())))
  if (cmd === 'impostazioni-prendi' && a.length === 3) return esci(...(await impostazioniPrendi(...a)))
  if (cmd === 'pesi-decidi' && a.length === 6) return esci(...(await pesiDecidi(...a)))
  if (cmd === 'pesi-annulla' && a.length === 4) return esci(...(await pesiAnnulla(...a)))
  esci(2, 'uso: cas <file> <versione|nuovo> | prenota <cartella> | occupata <mutex|codex> | corsia-codex [--revisione] -- <comando>')
}

function esci(codice, testo) {
  if (testo) process.stdout.write(String(testo))
  process.exitCode = codice
}

module.exports = {
  main, conMutex, percorsoCanonico, mutexEsecuzione, registraRadici, scriviAtomico, scriviDati, scriviConfig, ripristinaConfig, spostaDati, configValido, apriUrl, segnalaGh, rapportoValido, percorsoSicuro, Rifiuto, impostazioniProponi, impostazioniPrendi, propostaImpostazioniNonValida, fileImpostazioniDi, prenota, porta, MUTEX_AZIONI, MUTEX_CODEX, configura, configuraUtente, lanciaCli, eseguiCli, pesiProponi, pesiDecidi, pesiAnnulla,
  esci, preparaWorktree, parametriValidi, avviaComando, comandoReale, elencoProcessi, alberoVivo, vivo, tentativoValido, idValido, fileEsecuzione,
}
if (require.main === module) main(process.argv.slice(2)).catch(e => esci(1, String(e?.message ?? e)))
