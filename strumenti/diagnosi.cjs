'use strict'
// F11.3: la diagnosi del doctor, in SOLA LETTURA. Legge config, copie, cartelle, lock, registri e accessi e restituisce
// codici con pochi dettagli; non libera lock, non cancella, non rinomina e non scrive niente (mai `statoApi` né
// `verificaLock`, che possono ripulire). Ogni rimedio è un comando a parte, già esistente o dedicato, sotto il suo lock.
const fs = require('node:fs')
const path = require('node:path')

const d = require('./disco.cjs')
const regole = require('./regole.cjs')
const api = require('./api-claude.cjs')

const oggetto = v => !!v && typeof v === 'object' && !Array.isArray(v)
// I campi che la mod conosce, per strato: gli altri si segnalano (mai cancellati).
// They mirror ConfigFile, StratoAccount and ConfigProgetto in types/index.d.ts (parity test in prova-disco).
const NOTI_RADICE = ['account', 'progetti', 'lingua', 'versione', 'cartella']
const NOTI_ACCOUNT = ['soglie', 'limitiManuali', 'apiClaude', 'freellmapi', 'modoLavoro', 'compatibili']
const NOTI_PROGETTO = ['routing', 'sensibili', 'background', 'fornitori', 'soloLocale', 'milestoneGithub', 'pesi', 'limitiManuali', 'freellmapi', 'board', 'soglie', 'profilo',
  'apiClaude', 'consigliere', 'restrizioni', 'modoLavoro', 'pesiRevisione', 'pesiOrigine', 'cartella', 'compatibili']
const nome = s => String(s).replace(/[^A-Za-z0-9_.-]/g, '?').slice(0, 40)

/** Le copie valide del config (bak1 è la più recente), lette senza toccarle. */
function copieValide(file) {
  return [1, 2, 3].filter(i => {
    try {
      return d.configValido(JSON.parse(fs.readFileSync(`${file}.bak${i}`, 'utf8')))
    } catch {
      return false
    }
  })
}

/**
 * `config` il file, `cartella` la cartella delle azioni, `root` il repository della sessione, `repo` owner/nome.
 * `deps` (solo le prove): `dm` cartella della macchina, `esegui`, `fonti`, `env`, `adesso`.
 */
function diagnosi(config, cartella, root, repo, deps = {}) {
  const trovati = []
  const trova = (codice, extra = {}) => trovati.push({ codice, ...extra })
  const sicuro = (p, codice) => {
    try {
      d.percorsoSicuro(p)
      return true
    } catch (e) {
      trova(codice, { motivo: String(e.message).slice(0, 120) })
      return false
    }
  }
  const dm = deps.dm ?? api.dirPredefinita()
  d.registraRadici(path.isAbsolute(String(config)) ? path.dirname(path.resolve(config)) : undefined, cartella, dm)

  // --- config ---------------------------------------------------------------------------------------------------
  let c = {}
  // L'impronta dei byte letti: il ripristino la usa come CAS (null = file assente o non letto).
  let impronta = null
  if (sicuro(path.dirname(path.resolve(config)), 'percorso.config')) {
    let testo = null
    try {
      const byte = fs.readFileSync(config)
      impronta = require('node:crypto').createHash('sha256').update(byte).digest('hex')
      testo = byte.toString('utf8')
    } catch (e) {
      if (e.code !== 'ENOENT') trova('config.illeggibile', { copie: copieValide(config).length })
    }
    if (testo !== null) {
      try {
        c = JSON.parse(testo)
        if (!d.configValido(c)) throw new Error('forma')
      } catch {
        c = {}
        trova('config.illeggibile', { copie: copieValide(config).length })
      }
      if (testo !== null && !trovati.some(t => t.codice === 'config.illeggibile') && !copieValide(config).length) trova('config.senzaCopie')
    }
  }
  for (const k of Object.keys(c)) if (!NOTI_RADICE.includes(k)) trova('config.campoIgnoto', { strato: 'radice', campo: nome(k) })
  if (oggetto(c.account)) for (const k of Object.keys(c.account)) if (!NOTI_ACCOUNT.includes(k)) trova('config.campoIgnoto', { strato: 'account', campo: nome(k) })
  const modoAccount = regole.modoNonValido(c.account?.modoLavoro)
  if (modoAccount) trova('config.modoNonValido', { strato: 'account', campo: modoAccount })
  for (const [r, p] of Object.entries(oggetto(c.progetti) ? c.progetti : {})) {
    const qui = r === repo
    if (!oggetto(p)) {
      trova('config.nonValido', { progetto: qui })
      continue
    }
    for (const k of Object.keys(p)) if (!NOTI_PROGETTO.includes(k)) trova('config.campoIgnoto', { strato: 'progetto', progetto: qui, campo: nome(k) })
    try {
      regole.regoleEfficaci(c.account, p)
      const larga = p.restrizioni === undefined ? null : regole.restrizioneLarga(c.account, p.restrizioni)
      if (larga) trova('config.restrizioneLarga', { progetto: qui, campo: nome(larga) })
    } catch {
      trova('config.nonValido', { progetto: qui })
    }
    const modo = regole.modoNonValido(p.modoLavoro)
    if (modo) trova('config.modoNonValido', { strato: 'progetto', progetto: qui, campo: modo })
  }

  // --- cartelle e registri --------------------------------------------------------------------------------------
  // Senza cartella (dipende da un config che non si legge) i controlli dei dati si saltano.
  const datiOk = !!cartella && sicuro(cartella, 'percorso.dati')
  if (sicuro(dm, 'percorso.macchina')) sicuro(api.fileSpesa(dm), 'percorso.registro')
  // Un registro della spesa per cartella (build di sviluppo) blocca la corsia API: si offre di archiviarlo.
  if (datiOk && fs.existsSync(path.join(cartella, 'spesa-api.json'))) trova('registro.sviluppo')

  // --- lock e chiavi della corsia API (solo letti) ----------------------------------------------------------------
  const lock = api.leggiLock(dm)
  if (lock === 'illeggibile') trova('lock.apiIlleggibile')
  else if (lock) {
    const da = Date.parse(lock.istante)
    trova('lock.api', { minuti: Number.isFinite(da) ? Math.max(0, Math.floor(((deps.adesso ?? Date.now)() - da) / 60_000)) : null })
  }
  try {
    const chiavi = fs.readdirSync(path.join(dm, 'chiavi-api')).filter(n => n.endsWith('.key') && (!oggetto(lock) || n !== `${lock.tentativo}.key`))
    if (chiavi.length) trova('chiavi.residue', { n: chiavi.length })
  } catch {
    // Nessuna cartella delle chiavi: niente da segnalare.
  }

  // --- azioni ---------------------------------------------------------------------------------------------------
  if (datiOk) {
    let orfane = 0
    let ignoti = 0
    let nomi = []
    try {
      nomi = fs.readdirSync(cartella).filter(n => /^a-[a-z0-9]+\.json$/.test(n))
    } catch {
      nomi = []
    }
    for (const n of nomi) {
      let a
      try {
        a = JSON.parse(fs.readFileSync(path.join(cartella, n), 'utf8'))
      } catch {
        continue
      }
      if (!oggetto(a)) continue
      if (typeof a.repo !== 'string' || !a.repo) orfane++
      else if (!oggetto(c.progetti) || !Object.hasOwn(c.progetti, a.repo)) ignoti++
    }
    if (orfane) trova('azioni.orfane', { n: orfane })
    if (ignoti) trova('azioni.progettiIgnoti', { n: ignoti })
  }

  // --- accessi e host ---------------------------------------------------------------------------------------------
  const esec = api.statoEsecuzione(root, deps)
  const progetto = oggetto(c.progetti?.[repo]) ? c.progetti[repo] : {}
  const fornitori = Array.isArray(progetto.fornitori) ? progetto.fornitori : ['claude', 'codex']
  if (fornitori.includes('claude') && !esec.claude.loggedIn) trova('accesso.claude', { trovato: esec.claude.trovato })
  if (fornitori.includes('codex') && !esec.codex.loggedIn) trova('accesso.codex', { trovato: esec.codex.trovato })
  if (progetto.milestoneGithub === true && !esec.github.loggedIn) trova('accesso.github', { trovato: esec.github.trovato })
  if (oggetto(c.account?.apiClaude) && esec.fonti.length) trova('host.impostazioniApi', { fonti: esec.fonti.map(f => nome(f.nome)) })
  const advisor = api.advisorNelWorktree(deps.fonti ?? api.fontiImpostazioni(root))
  if (advisor.illeggibile || (advisor.disattiva !== undefined && api.booleano(advisor.disattiva) !== true))
    trova('host.advisor', { fonte: nome(advisor.illeggibile ?? advisor.fonteDisattiva) })

  let versione = null
  try {
    versione = String(JSON.parse(fs.readFileSync(path.join(__dirname, '..', '.claude-plugin', 'plugin.json'), 'utf8')).version).slice(0, 20)
  } catch {
    versione = null
  }
  return { trovati, versione, impronta }
}

/**
 * Il registro per cartella di un build di sviluppo si archivia rinominandolo `.archiviato-<istante>`: mai sovrascritto,
 * reversibile (si rinomina indietro). Sotto il mutex delle azioni della cartella.
 */
async function archiviaRegistro(cartella) {
  d.registraRadici(cartella)
  d.percorsoSicuro(cartella)
  const file = path.join(cartella, 'spesa-api.json')
  const r = await d.conMutex(d.MUTEX_AZIONI(cartella), 8000, () => {
    if (!fs.existsSync(file)) return [0, JSON.stringify({ archiviato: false })]
    const meta = `${file}.archiviato-${new Date().toISOString().replace(/[:.]/g, '-')}`
    if (fs.existsSync(meta)) return [4, '']
    fs.renameSync(file, meta)
    return [0, JSON.stringify({ archiviato: true })]
  })
  return r.occupato ? [3, ''] : r.valore
}

module.exports = { diagnosi, archiviaRegistro, copieValide, NOTI_RADICE, NOTI_ACCOUNT, NOTI_PROGETTO }
