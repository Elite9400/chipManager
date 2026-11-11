'use strict'
// F6.2 — corsia «API Claude»: `claude -p` su questa macchina, pagato con i crediti API dell'utente.
//
//   node disco.cjs lancia-api <cartella> <id> <tentativo>   stdin = parametri + chiave (mai su argv o nell'ambiente)
//   node disco.cjs esegui-api <cartella> <id> <tentativo>   (lo avvia lancia-api, staccato: è il supervisore)
//   node disco.cjs stato-api                                 libera il lock se tutte le condizioni valgono
//   node disco.cjs libera-api                                «Libera» dell'utente: sostituisce solo l'uscita registrata
//   node disco.cjs termina-api                               chiude i discendenti censiti (solo su conferma)
//
// Uscite: 0 ok · 2 uso · 3 lock occupato · 4 conflitto · 5 budget insufficiente · 6 impostazioni o ambiente vietati.
//
// F10: budget e tetto li decide l'helper, rileggendo il config sotto il mutex del lock (strumenti/regole.cjs): quelli che
// manda il pannello servono solo a mostrarli. Il registro della spesa è uno solo, dell'account, accanto al lock; ogni voce
// porta il progetto e il tentativo. Un tentativo parte solo se entra nel residuo dell'account E in quello del progetto.
//
// Modello di minaccia (PIANO-F6 §12-13). Durante l'esecuzione la chiave è accessibile all'agente e ai suoi strumenti,
// come qualunque chiave data a un agente. Dopo, su questa macchina e per questa mod: il file-chiave è cancellato (se non
// si riesce, il lock resta), la copia in memoria di `claude -p` scade (TTL esplicito di 5 minuti dall'ultima consegna:
// non revoca la chiave), nessun discendente censito è vivo, e la chiave non sta mai nell'ambiente. Una copia fatta di
// proposito resta utilizzabile fino alla revoca: per questo si raccomanda una chiave dedicata con un limite di spesa.
const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawn, spawnSync } = require('child_process')
const d = require('./disco.cjs')
const regole = require('./regole.cjs')
const ACCESSO = path.join(__dirname, 'accesso.cjs')

const MUTEX_API = 'api-claude:macchina'
/**
 * Il mutex del lock della macchina. `deps.mutexApi` lo passa solo l'entrypoint delle prove, per non contendere con un
 * pannello vero o con un'altra prova sulla stessa macchina: `comando` (il percorso di produzione) non lo passa mai.
 */
const mutexApi = deps => deps.mutexApi ?? MUTEX_API
/** La cache di `apiKeyHelper` in `claude -p`: impostata in modo esplicito, così l'attesa dopo l'ultima consegna è nota. */
const TTL_MS = 300_000
const TETTO_STDOUT = 1024 * 1024
const CHIAVE = path.join(__dirname, 'chiave-api.cjs')
/** Tolte dall'ambiente del figlio: credenziali o instradamenti di priorità maggiore della chiave, e il segno di sessione. */
const VIETATE = ['ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL', 'CLAUDE_CODE_USE_BEDROCK', 'CLAUDE_CODE_USE_VERTEX', 'CLAUDE_CODE_USE_FOUNDRY', 'CLAUDE_CODE_OAUTH_TOKEN', 'CLAUDECODE', 'ANTHROPIC_API_KEY']

const dirPredefinita = () => path.join(os.homedir(), '.claude', 'chipmanager')
const fileLock = dm => path.join(dm, 'api-claude.json')
const dirChiavi = dm => path.join(dm, 'chiavi-api')
const fileChiave = (dm, t) => path.join(dirChiavi(dm), `${t}.key`)
const fileConsegna = (dm, t) => path.join(dirChiavi(dm), `${t}.consegna`)
/**
 * F10 rilievo 2: la catena dei dati dell'account (cartella, lock, registro della spesa, chiavi) e quelle che il comando
 * nomina, controllate PRIMA di ogni lettura o scrittura: nessun link o junction, percorso reale uguale, nessun `.git`
 * sopra. Lancia il Rifiuto dell'helper con il motivo.
 */
function percorsiAccount(dm, altri = []) {
  d.registraRadici(dm)
  for (const p of [dm, fileLock(dm), fileSpesa(dm), dirChiavi(dm), ...altri]) d.percorsoSicuro(p)
}
const motivoPercorso = e => String(e?.message ?? e).slice(0, 300)
/**
 * Giro 2, rilievo 1: la catena di OGNI file del tentativo (file-chiave e consegna) prima di accedervi: un link al posto
 * della consegna non deve dare un istante finto e liberare il lock. Il motivo, o null se vale.
 */
function catenaTentativo(dm, tentativo) {
  try {
    d.percorsoSicuro(fileChiave(dm, tentativo))
    d.percorsoSicuro(fileConsegna(dm, tentativo))
    return null
  } catch (e) {
    return motivoPercorso(e)
  }
}
/** F10: il registro della spesa dell'account, uno solo, accanto al lock della macchina. */
const fileSpesa = dm => path.join(dm, 'spesa-api.json')

// --- fonti delle impostazioni (§5.2, §6, §7: fail-closed) ---------------------------------------------------

/** Le fonti di impostazioni che `claude -p` leggerebbe nel worktree: utente, progetto, locale e gestite. */
// --- F13 (N1): la corsia CLI gira solo con le credenziali dell'abbonamento ----------------------------------------------
// La regola inversa di `chiaviVietate` (che protegge api-claude): qui bloccano chiave API, token, helper della chiave,
// gateway o selettori di provider e un login forzato sulla console. Il token OAuth dell'abbonamento resta ammesso.
const ENV_CLI = k => /^ANTHROPIC_(.*_)?(BASE_URL|AUTH_TOKEN|API_KEY)$/.test(k) || /^(CLAUDE_CODE_USE_|ANTHROPIC_(BEDROCK|VERTEX|FOUNDRY)_)/.test(k) || k === 'ANTHROPIC_CUSTOM_HEADERS'
/** Le chiavi responsabili (mai i valori); null se la forma non è un oggetto. */
function chiaviVietateCli(s) {
  if (!s || typeof s !== 'object' || Array.isArray(s)) return null
  if (s.env !== undefined && (!s.env || typeof s.env !== 'object' || Array.isArray(s.env))) return null
  return [...Object.keys(s.env ?? {}).filter(ENV_CLI).map(k => `env.${k}`),
    ...Object.keys(s).filter(k => ['apiKeyHelper', 'awsAuthRefresh', 'awsCredentialExport', 'gcpAuthRefresh'].includes(k)),
    ...(s.forceLoginMethod === 'console' ? ['forceLoginMethod'] : [])]
}
/**
 * Le fonti che bloccano un avvio della corsia CLI: i quattro file (utente, progetto, locale, gestite), l'ambiente
 * ereditato e i fatti delle fonti dell'host che il pannello ha letto subito prima (`host`: policy, flag…; `chiavi: null`
 * = non si legge). Una fonte illeggibile blocca. Solo nomi e chiavi, mai valori.
 */
function blocchiCli(fonti, env = process.env, host = []) {
  const blocchi = []
  for (const f of fonti) {
    let testo
    try {
      testo = fs.readFileSync(f.file, 'utf8')
    } catch (e) {
      if (e.code !== 'ENOENT') blocchi.push({ nome: f.nome, illeggibile: true })
      continue
    }
    let chiavi
    try {
      chiavi = chiaviVietateCli(JSON.parse(testo))
    } catch {
      chiavi = null
    }
    if (chiavi === null) blocchi.push({ nome: f.nome, illeggibile: true })
    else if (chiavi.length) blocchi.push({ nome: f.nome, chiavi })
  }
  const daEnv = Object.keys(env).filter(ENV_CLI)
  if (daEnv.length) blocchi.push({ nome: 'ambiente', chiavi: daEnv })
  for (const h of host) {
    if (h.chiavi === null) blocchi.push({ nome: `host:${h.source}`, illeggibile: true })
    else if (h.chiavi.length) blocchi.push({ nome: `host:${h.source}`, chiavi: h.chiavi })
  }
  return blocchi
}
/** L'ambiente del figlio della corsia CLI: senza chiavi, token e gateway (solo le credenziali dell'abbonamento). */
const ambienteCli = env => Object.fromEntries(Object.entries(env).filter(([k]) => !ENV_CLI(k) && k !== 'CLAUDECODE'))

function fontiImpostazioni(root, env = process.env) {
  const utente = env.CLAUDE_CONFIG_DIR ? path.join(env.CLAUDE_CONFIG_DIR, 'settings.json') : path.join(os.homedir(), '.claude', 'settings.json')
  const gestite = process.platform === 'win32' ? 'C:\\Program Files\\ClaudeCode\\managed-settings.json'
    : process.platform === 'darwin' ? '/Library/Application Support/ClaudeCode/managed-settings.json' : '/etc/claude-code/managed-settings.json'
  return [
    { nome: 'utente', file: utente },
    { nome: 'progetto', file: path.join(root, '.claude', 'settings.json') },
    { nome: 'locale', file: path.join(root, '.claude', 'settings.local.json') },
    { nome: 'gestite', file: gestite },
  ]
}

/**
 * Impostazioni che cambierebbero chi paga o dove vanno le richieste: credenziali o instradamenti nell'`env`, gateway e
 * fornitori cloud, un `apiKeyHelper` dell'utente, ogni login imposto (`forceLogin*`, `forceLoginGatewayUrl` compreso).
 * Una forma che non è un oggetto vale come vietata. Stessa regola del pannello per le fonti dell'host.
 */
function chiaviVietate(s) {
  if (!s || typeof s !== 'object' || Array.isArray(s)) return null
  if (s.env !== undefined && (!s.env || typeof s.env !== 'object' || Array.isArray(s.env))) return null
  const env = Object.keys(s.env ?? {}).filter(k => /^ANTHROPIC_(.*_)?(BASE_URL|AUTH_TOKEN|API_KEY)$/.test(k) || /^(CLAUDE_CODE_USE_|ANTHROPIC_(BEDROCK|VERTEX|FOUNDRY)_)/.test(k) ||
    ['CLAUDE_CODE_OAUTH_TOKEN', 'ANTHROPIC_CUSTOM_HEADERS'].includes(k)).map(k => `env.${k}`)
  return [...env, ...Object.keys(s).filter(k => k.startsWith('forceLogin') || ['apiKeyHelper', 'awsAuthRefresh', 'awsCredentialExport', 'gcpAuthRefresh'].includes(k))]
}
/** Vietata se ha una di quelle chiavi o non ha la forma di un oggetto. */
const impostazioniVietate = s => chiaviVietate(s)?.length !== 0

/** Che cosa blocca una fonte: null se niente; le chiavi responsabili (mai i valori); `illeggibile` se non si legge. */
function bloccoDi(file) {
  let testo
  try {
    testo = fs.readFileSync(file, 'utf8')
  } catch (e) {
    return e.code === 'ENOENT' ? null : { illeggibile: true }
  }
  let chiavi
  try {
    chiavi = chiaviVietate(JSON.parse(testo))
  } catch {
    chiavi = null
  }
  return chiavi === null ? { illeggibile: true } : chiavi.length ? { chiavi } : null
}

/** Le fonti che bloccano `api-claude`, con le chiavi responsabili; anche una chiave già nell'ambiente blocca. */
function blocchiDettagliati(fonti, env = process.env) {
  const blocchi = fonti.map(f => ({ nome: f.nome, file: f.file, ...bloccoDi(f.file) })).filter(b => b.chiavi || b.illeggibile)
  if (env.ANTHROPIC_API_KEY !== undefined) blocchi.push({ nome: 'ambiente', chiavi: ['ANTHROPIC_API_KEY'] })
  return blocchi
}
/** Solo i nomi delle fonti che bloccano. */
const blocchiImpostazioni = (fonti, env = process.env) => blocchiDettagliati(fonti, env).map(b => b.nome)

// --- spesa: prenotazione e contabilizzazione per tentativo (§4) ----------------------------------------------

function leggiSpesa(dm) {
  let testo
  try {
    testo = fs.readFileSync(fileSpesa(dm), 'utf8')
  } catch (e) {
    if (e.code === 'ENOENT') return { v: 1, voci: {} }
    throw e
  }
  const s = JSON.parse(testo)
  if (s?.v !== 1 || !s.voci || typeof s.voci !== 'object' || Array.isArray(s.voci) || !Object.entries(s.voci).every(([t, v]) => d.tentativoValido(t) && voceValida(v)))
    throw new Error('registro della spesa non valido')
  return s
}

/** Una voce del registro: progetto, mese, tetto positivo, stato noto; il costo solo se contata (null = ignoto). */
const voceValida = v => !!v && typeof v === 'object' && !Array.isArray(v) && typeof v.mese === 'string' && /^\d{4}-\d{2}$/.test(v.mese) &&
  typeof v.progetto === 'string' && v.progetto.length > 0 && v.progetto.length <= 400 &&
  typeof v.tetto === 'number' && Number.isFinite(v.tetto) && v.tetto > 0 &&
  (v.stato === 'prenotato' ? v.costo === undefined : v.stato === 'contato' && (v.costo === null || (Number.isFinite(v.costo) && v.costo >= 0))) &&
  // Revisione F13a, rilievo 3: i gruppi (catena, albero della dirigente) a cui la voce conta.
  (v.gruppi === undefined || (Array.isArray(v.gruppi) && v.gruppi.length <= 2 && v.gruppi.every(g => typeof g === 'string' && GRUPPO_RE.test(g))))
const GRUPPO_RE = /^(catena:c-[a-z0-9]{6,20}|dirigente:a-[a-z0-9]{6,20})$/
/** Quanto un gruppo ha già impegnato in tutti i mesi: contato = costo stimato (ignoto = tetto intero), prenotato = tetto. */
const spesoNelGruppo = (voci, chiave) =>
  Object.values(voci).filter(v => v.gruppi?.includes(chiave)).reduce((n, v) => n + (v.stato === 'contato' ? (v.costo ?? v.tetto) : v.tetto), 0)

/** Spesa del mese (di un progetto, se dato): contato = costo stimato (ignoto = tetto intero), prenotato = tetto intero. */
const spesoNelMese = (voci, mese, progetto) =>
  Object.values(voci).filter(v => v.mese === mese && (progetto === undefined || v.progetto === progetto))
    .reduce((n, v) => n + (v.stato === 'contato' ? (v.costo ?? v.tetto) : v.tetto), 0)

/**
 * Prenota il tetto del tentativo (idempotente): deve stare nel residuo del mese dell'account e, se c'è, in quello del
 * progetto. Falso se uno dei due non basta. Da chiamare sotto il mutex del lock.
 */
function prenotaSpesa(dm, tentativo, mese, tetto, budget, progetto, limiteProgetto, gruppi = []) {
  if (typeof progetto !== 'string' || !progetto) throw new Error('progetto mancante')
  const s = leggiSpesa(dm)
  if (s.voci[tentativo]) return true
  if (spesoNelMese(s.voci, mese) + tetto > budget + 1e-9) return false
  if (limiteProgetto !== undefined && spesoNelMese(s.voci, mese, progetto) + tetto > limiteProgetto + 1e-9) return false
  s.voci[tentativo] = { progetto, mese, tetto, stato: 'prenotato', ...(gruppi.length && { gruppi }) }
  fs.mkdirSync(dm, { recursive: true })
  d.scriviDati(fileSpesa(dm), JSON.stringify(s))
  return true
}

/** La prenotazione diventa il costo stimato (null = ignoto, conta il tetto), senza prendere il mutex (chi chiama lo tiene). */
function contaSpesaQui(dm, tentativo, costo) {
  const s = leggiSpesa(dm)
  const v = s.voci[tentativo]
  if (!v || v.stato === 'contato') return
  s.voci[tentativo] = { ...v, stato: 'contato', costo: typeof costo === 'number' && Number.isFinite(costo) && costo >= 0 ? costo : null }
  d.scriviDati(fileSpesa(dm), JSON.stringify(s))
}

/** Come `contaSpesaQui`, sotto lo stesso mutex del lock che prenota. Una seconda contabilizzazione non cambia nulla. */
async function contaSpesa(dm, tentativo, costo, deps = {}) {
  const r = await d.conMutex(mutexApi(deps), 30_000, () => contaSpesaQui(dm, tentativo, costo))
  if (r.occupato) throw new Error('mutex della spesa occupato')
}

/**
 * F10: budget, tetto e limite del progetto dal config riletto adesso (mai quelli del pannello). Rifiuta un config o un
 * registro fuori posto (in un albero git, oltre un link) e un registro per cartella dei build di sviluppo: nel dubbio si
 * blocca. Restituisce le regole o `[codice, dettaglio]`.
 */
function regoleApi(dir, dm, input) {
  d.registraRadici(dir, dm, typeof input?.config === 'string' && path.isAbsolute(input.config) ? path.dirname(path.resolve(input.config)) : undefined)
  const sviluppo = path.join(dir, 'spesa-api.json')
  if (fs.existsSync(sviluppo)) return [5, JSON.stringify({ registroSviluppo: path.dirname(path.resolve(sviluppo)) })]
  try {
    d.percorsoSicuro(input.config)
    d.percorsoSicuro(dm)
    d.percorsoSicuro(fileSpesa(dm))
  } catch (e) {
    return [6, JSON.stringify({ percorso: String(e.message).slice(0, 300) })]
  }
  let efficaci
  try {
    const c = fs.existsSync(input.config) ? JSON.parse(fs.readFileSync(input.config, 'utf8')) : {}
    if (!c || typeof c !== 'object' || Array.isArray(c)) throw new Error('config')
    const progetti = c.progetti ?? {}
    if (!progetti || typeof progetti !== 'object' || Array.isArray(progetti)) throw new Error('config')
    efficaci = regole.regoleEfficaci(c.account, progetti[input.repo])
  } catch {
    return [5, JSON.stringify({ config: 'non valido' })]
  }
  if (!efficaci.apiClaude) return [5, JSON.stringify({ spenta: true })]
  // Revisione F13a, rilievo 3: i tetti della catena e della dirigente, anche questi riletti dal config.
  return { ...efficaci.apiClaude, tettoCatena: efficaci.modoLavoro.pipeline.tettoUsd, tettoDirigente: efficaci.modoLavoro.dirigente.tettoUsd }
}

// --- lock della macchina (§5, §8, §10-13) --------------------------------------------------------------------

function leggiLock(dm) {
  let testo
  try {
    testo = fs.readFileSync(fileLock(dm), 'utf8')
  } catch (e) {
    return e.code === 'ENOENT' ? null : 'illeggibile'
  }
  try {
    const r = JSON.parse(testo)
    return r && d.tentativoValido(r.tentativo) ? r : 'illeggibile'
  } catch {
    return 'illeggibile'
  }
}
const scriviLock = (dm, rec) => d.scriviDati(fileLock(dm), JSON.stringify(rec))

/** I processi vivi nati da `claude -p` (lui compreso, se vivo con la stessa identità). Elenco illeggibile = uno ignoto. */
function discendenti(rec, deps = {}) {
  if (!rec.pid) return []
  if (process.platform !== 'win32' && !deps.elenco) {
    try {
      process.kill(-rec.pid, 0)
      return [{ pid: String(rec.pid) }]
    } catch (e) {
      return e.code === 'EPERM' ? [{ pid: String(rec.pid) }] : []
    }
  }
  const lista = (deps.elenco ?? d.elencoProcessi)()
  if (!lista) return [{ pid: '?' }]
  const vivi = d.alberoVivo(lista, [{ pid: String(rec.pid), creato: rec.creato ?? NaN }, ...(rec.noti ?? [])], rec.avvio ?? 0)
  // Identità della radice sconosciuta (censimento fallito all'avvio): un processo con quel PID vale vivo, mai morto.
  const radice = lista.find(p => p.pid === String(rec.pid))
  if (radice && !Number.isFinite(rec.creato) && !vivi.some(p => p.pid === radice.pid)) vivi.push({ ...radice, ignoto: true })
  return vivi
}

/** L'istante dell'ultima consegna della chiave (o, senza consegne, dell'uscita o della prenotazione). */
function ultimaConsegna(dm, rec) {
  try {
    const t = Date.parse(fs.readFileSync(fileConsegna(dm, rec.tentativo), 'utf8'))
    if (Number.isFinite(t)) return t
  } catch {
    // nessuna consegna registrata
  }
  return Date.parse(rec.uscita?.fine ?? rec.istante) || 0
}

/** Cancella il file-chiave del tentativo: vero se non c'è più. */
function cancellaChiave(dm, tentativo, deps = {}) {
  try {
    ;(deps.rm ?? fs.rmSync)(fileChiave(dm, tentativo), { force: true })
    return !fs.existsSync(fileChiave(dm, tentativo))
  } catch {
    return false
  }
}

/**
 * Le condizioni 2, 3 e 4 (file-chiave cancellato, nessun discendente vivo, cache scaduta); la 1, l'uscita registrata dal
 * supervisore, la controlla chi chiama. Il motivo dice la prima che manca.
 */
function condizioni(dm, rec, adesso, deps) {
  if (!cancellaChiave(dm, rec.tentativo, deps)) return { motivo: 'chiave' }
  const vivi = discendenti(rec, deps)
  if (vivi.length) return { motivo: 'discendenti', discendenti: vivi.map(p => p.pid) }
  const resta = ultimaConsegna(dm, rec) + TTL_MS - adesso
  if (resta > 0) return { motivo: 'cache', restaMs: resta }
  return {}
}

/** Lo stato del lock; se tutte e quattro le condizioni valgono lo libera. Sempre sotto il mutex della macchina. */
function verificaLock(dm, adesso, deps = {}) {
  const rec = leggiLock(dm)
  if (!rec) return { libero: true }
  if (rec === 'illeggibile') return { libero: false, motivo: 'illeggibile' }
  const catena = catenaTentativo(dm, rec.tentativo)
  if (catena) return { libero: false, motivo: 'percorso', percorso: catena, tentativo: rec.tentativo }
  if (!rec.uscita) {
    // Supervisore caduto con il processo verificato morto (identità nota, nessun discendente): la chiave si toglie già;
    // il lock resta finché l'utente non sceglie «Libera».
    if (rec.pid && Number.isFinite(rec.creato) && !discendenti(rec, deps).length) cancellaChiave(dm, rec.tentativo, deps)
    return { libero: false, motivo: rec.pid ? 'in-corso' : 'senza-pid', tentativo: rec.tentativo }
  }
  const c = condizioni(dm, rec, adesso, deps)
  if (c.motivo) return { libero: false, tentativo: rec.tentativo, ...c }
  fs.rmSync(fileLock(dm), { force: true })
  fs.rmSync(fileConsegna(dm, rec.tentativo), { force: true })
  return { libero: true, liberato: rec.tentativo }
}

async function statoApi(dm, deps = {}) {
  try {
    percorsiAccount(dm)
  } catch (e) {
    return { libero: false, motivo: 'percorso', percorso: motivoPercorso(e) }
  }
  const r = await d.conMutex(mutexApi(deps), 8000, () => verificaLock(dm, (deps.adesso ?? Date.now)(), deps))
  return r.occupato ? { libero: false, motivo: 'mutex' } : r.valore
}

/**
 * «Libera» dell'utente, dopo il popup sul rischio: prende il posto della sola condizione 1 (l'uscita non registrata).
 * File-chiave cancellato, nessun discendente e 5 minuti dall'ultima consegna restano obbligatori; il costo è il tetto.
 */
async function liberaApi(dm, deps = {}) {
  try {
    percorsiAccount(dm)
  } catch (e) {
    return { libero: false, motivo: 'percorso', percorso: motivoPercorso(e) }
  }
  const r = await d.conMutex(mutexApi(deps), 8000, async () => {
    const rec = leggiLock(dm)
    if (!rec) return { libero: true }
    if (rec === 'illeggibile') return { libero: false, motivo: 'illeggibile' }
    const catena = catenaTentativo(dm, rec.tentativo)
    if (catena) return { libero: false, motivo: 'percorso', percorso: catena, tentativo: rec.tentativo }
    const c = condizioni(dm, rec, (deps.adesso ?? Date.now)(), deps)
    if (c.motivo) return { libero: false, tentativo: rec.tentativo, ...c }
    fs.rmSync(fileLock(dm), { force: true })
    fs.rmSync(fileConsegna(dm, rec.tentativo), { force: true })
    if (!rec.uscita) contaSpesaQui(dm, rec.tentativo, null)
    return { libero: true, liberato: rec.tentativo }
  })
  return r.occupato ? { libero: false, motivo: 'mutex' } : r.valore
}

/** «Termina», su conferma: chiude i discendenti vivi censiti; poi si ricontrolla con stato-api. */
async function terminaApi(dm, deps = {}) {
  try {
    percorsiAccount(dm)
  } catch (e) {
    return { chiusi: 0, motivo: 'percorso', percorso: motivoPercorso(e) }
  }
  const rec = leggiLock(dm)
  if (!rec || rec === 'illeggibile') return { chiusi: 0 }
  let chiusi = 0
  for (const p of discendenti(rec, deps).filter(x => !x.ignoto && x.pid !== '?'))
    try {
      ;(deps.uccidi ?? (pid => process.kill(Number(pid))))(p.pid)
      chiusi++
    } catch {
      // già morto o non nostro
    }
  return { chiusi }
}

// --- avvio e supervisione ------------------------------------------------------------------------------------

const ingressoValido = input =>
  d.parametriValidi(input) && typeof input.tetto === 'number' && input.tetto >= 0.01 && input.tetto <= 1000 &&
  typeof input.budget === 'number' && input.budget > 0 && /^\d{4}-\d{2}$/.test(input.mese ?? '') &&
  // F10: il config da rileggere e il progetto della voce di spesa.
  typeof input.config === 'string' && path.isAbsolute(input.config) && /\.json$/i.test(input.config) && input.config.length <= 1000 &&
  typeof input.repo === 'string' && input.repo.length > 0 && input.repo.length <= 400 &&
  typeof input.chiave === 'string' && input.chiave.length >= 8 && input.chiave.length <= 500 && !/\s/.test(input.chiave) &&
  // F7.3: l'auditor è un id della tabella (il pannello ha già risolto l'alias); «senza auditor» lo esclude.
  (input.advisor === undefined || (typeof input.advisor === 'string' && /^claude-(haiku|sonnet|opus|fable)-\d+(-\d+)?$/.test(input.advisor))) &&
  (input.senzaAdvisor === undefined || input.senzaAdvisor === true) && !(input.advisor && input.senzaAdvisor)

// --- F7.3: advisor nel contesto del figlio ---------------------------------------------------------------------------

const VERI = ['1', 'true', 'yes', 'on']
const FALSI = ['0', 'false', 'no', 'off']
/** Una variabile booleana come la legge Claude Code: true, false, undefined se assente, null se il valore non si riconosce. */
const booleano = v => (v === undefined ? undefined : VERI.includes(String(v).trim().toLowerCase()) ? true : FALSI.includes(String(v).trim().toLowerCase()) ? false : null)

/**
 * L'advisor che il figlio vedrebbe nel suo worktree: le fonti in ordine di precedenza (gestite, locale, progetto, utente).
 * Il primo `env.CLAUDE_CODE_DISABLE_ADVISOR_TOOL` definito vince sull'ambiente del processo; il primo `advisorModel` è
 * l'advisor ereditato. Una fonte illeggibile si segnala: nessuna deduzione da quello che manca.
 */
function advisorNelWorktree(fonti) {
  const esito = {}
  for (const nome of ['gestite', 'locale', 'progetto', 'utente']) {
    const f = fonti.find(x => x.nome === nome)
    if (!f) continue
    let s
    try {
      s = JSON.parse(fs.readFileSync(f.file, 'utf8'))
    } catch (e) {
      if (e.code !== 'ENOENT') esito.illeggibile ??= nome
      continue
    }
    if (!s || typeof s !== 'object' || Array.isArray(s)) {
      esito.illeggibile ??= nome
      continue
    }
    const v = s.env && typeof s.env === 'object' ? s.env.CLAUDE_CODE_DISABLE_ADVISOR_TOOL : undefined
    if (esito.disattiva === undefined && v !== undefined) Object.assign(esito, { disattiva: v, fonteDisattiva: nome })
    if (esito.ereditato === undefined && typeof s.advisorModel === 'string') esito.ereditato = s.advisorModel.slice(0, 60)
  }
  return esito
}

/** Lo stato dell'advisor per il record dell'esecuzione, e la fonte che impedirebbe di spegnerlo per il solo figlio. */
function statoAdvisor(input, w, envFiglio) {
  const spento = booleano(w.disattiva !== undefined ? w.disattiva : envFiglio.CLAUDE_CODE_DISABLE_ADVISOR_TOOL)
  const stato = spento === true ? { stato: 'disattivato' } : spento === null ? { stato: 'incerto' }
    : input.advisor ? { stato: 'applicato', modello: input.advisor } : w.ereditato ? { stato: 'ereditato', modello: w.ereditato } : { stato: 'nessuno' }
  // «Senza auditor» mette =1 nell'ambiente del figlio: un `env` delle impostazioni che non è vero lo sovrascriverebbe.
  const bloccato = w.illeggibile ?? (w.disattiva !== undefined && booleano(w.disattiva) !== true ? w.fonteDisattiva : undefined)
  return { advisor: stato, senzaAuditor: bloccato ? { bloccato } : {} }
}

const TETTO_STDERR = 16 * 1024
/** Quanto stderr grezzo si tiene in memoria prima del filtro (mai salvato così). */
const TETTO_STDERR_GREZZO = 64 * 1024
/**
 * Lo stderr del figlio come si salva: senza la chiave, `sk-ant-…`, email e percorsi della home, al più 16 KiB in byte. Si
 * filtra PRIMA di tagliare; se il grezzo era troncato si scarta la riga incompleta in fondo (un segreto a metà non si
 * riconoscerebbe), e il taglio finale cade su un confine di carattere.
 */
function filtraStderr(testo, chiave, casa = os.homedir(), troncato = false) {
  let t = troncato ? testo.slice(0, Math.max(0, testo.lastIndexOf('\n'))) : testo
  if (chiave) t = t.split(chiave).join('[key]')
  t = t.replace(/sk-ant-[A-Za-z0-9_-]+/g, 'sk-ant-…').replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '<email>')
  for (const h of new Set([casa, casa.replace(/\\/g, '/')])) if (h && h.length > 2) t = t.split(h).join('~')
  const b = Buffer.from(t, 'utf8')
  return b.length <= TETTO_STDERR ? t : b.subarray(0, TETTO_STDERR).toString('utf8').replace(/\uFFFD+$/, '')
}
/** Un rifiuto all'avvio è un'uscita entro questo tempo, con errore e senza JSON finale. */
const AVVIO_MS = 20_000
/** Il worktree è come alla partenza: `git status` pulito e HEAD ancora la base. Ogni dubbio (git che non risponde) = no. */
function worktreeInvariato(cwd, base, deps = {}) {
  if (deps.worktreeInvariato) return deps.worktreeInvariato(cwd, base)
  const git = args => spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8', windowsHide: true, timeout: 15_000 })
  const stato = git(['status', '--porcelain'])
  const testa = git(['rev-parse', 'HEAD'])
  return stato.status === 0 && stato.stdout.trim() === '' && testa.status === 0 && testa.stdout.trim() === base
}
/** Un'uscita anticipata per l'advisor: consenso a Fable, esclusione da `availableModels`, o rifiuto all'avvio. */
const advisorNonDisponibile = stderr =>
  /\/model fable|consent/i.test(stderr) ? 'consenso' : /availableModels/i.test(stderr) ? 'escluso' : /advisor/i.test(stderr) ? 'rifiutato' : undefined

/** Prenota (lock della macchina e spesa) PRIMA del processo; poi avvia il supervisore staccato, con la chiave su stdin. */
async function lanciaApi(dir, id, tentativo, input, deps = {}) {
  if (!d.idValido(id) || !d.tentativoValido(tentativo) || !ingressoValido(input)) return [2, '']
  const dm = deps.dirMacchina ?? dirPredefinita()
  // Prima di leggere il lock, cancellare chiavi o toccare la cartella delle azioni: tutte le catene, config compreso.
  try {
    percorsiAccount(dm, [dir, d.fileEsecuzione(dir, tentativo), input.config])
  } catch (e) {
    return [6, JSON.stringify({ percorso: motivoPercorso(e) })]
  }
  const r = await d.conMutex(d.MUTEX_AZIONI(dir), 8000, async () => {
    const a = JSON.parse(fs.readFileSync(path.join(dir, `${id}.json`), 'utf8'))
    if (a.stato !== 'in-avvio' || a.lanciatore !== 'api-claude' || a.tentativo !== tentativo) return [4, '']
    const file = d.fileEsecuzione(dir, tentativo)
    if (fs.existsSync(file)) return [4, '']
    const m = await d.conMutex(mutexApi(deps), 8000, async () => {
      const stato = verificaLock(dm, (deps.adesso ?? Date.now)(), deps)
      if (!stato.libero) return [3, JSON.stringify({ motivo: stato.motivo })]
      // Lock libero: nessuna esecuzione attiva, quindi ogni file-chiave rimasto è di un crash e si cancella.
      fs.rmSync(dirChiavi(dm), { recursive: true, force: true })
      const blocchi = blocchiImpostazioni(deps.fonti ?? fontiImpostazioni(input.root), deps.env ?? process.env)
      if (blocchi.length) return [6, JSON.stringify({ fonti: blocchi })]
      const api = regoleApi(dir, dm, input)
      if (Array.isArray(api)) return api
      // Revisione F13a, rilievo 3: una chip di catena o dell'albero di una dirigente impegna al più il residuo del suo
      // gruppo (tetto del config meno quanto già prenotato o contato), sotto questo mutex: il processo riceve quel limite
      // come `--max-budget-usd` e il consuntivo libera la differenza. I gruppi vengono dal record, i tetti dal config.
      const gruppi = [
        ...(a.catena && typeof a.catena.id === 'string' && api.tettoCatena !== undefined ? [{ chiave: `catena:${a.catena.id}`, tetto: api.tettoCatena }] : []),
        ...((a.padre || a.ruolo === 'dirigente') && api.tettoDirigente !== undefined ? [{ chiave: `dirigente:${a.padre ?? id}`, tetto: api.tettoDirigente }] : []),
      ]
      if (gruppi.some(g => !GRUPPO_RE.test(g.chiave))) return [2, '']
      let tetto = api.tetto
      try {
        const voci = leggiSpesa(dm).voci
        for (const g of gruppi) {
          const speso = spesoNelGruppo(voci, g.chiave)
          // Al centesimo per difetto, con margine per la virgola mobile (1 - 0,9 non è 0,1 esatto).
          const residuo = Math.floor((g.tetto - speso) * 100 + 1e-6) / 100
          if (residuo < 0.01) return [5, JSON.stringify({ gruppo: g.chiave.split(':')[0], speso: Math.round(speso * 100) / 100, tettoGruppo: g.tetto })]
          tetto = Math.min(tetto, residuo)
        }
      } catch {
        return [5, JSON.stringify({ registro: 'non valido' })]
      }
      // Il tetto che conta è quello efficace: anche `--max-budget-usd` del supervisore lo riceve da qui.
      input = { ...input, tetto, budget: api.budgetUsd }
      let prenotata
      try {
        prenotata = prenotaSpesa(dm, tentativo, input.mese, tetto, api.budgetUsd, input.repo, api.limiteProgettoUsd, gruppi.map(g => g.chiave))
      } catch {
        return [5, JSON.stringify({ registro: 'non valido' })]
      }
      if (!prenotata) {
        const voci = leggiSpesa(dm).voci
        return [5, JSON.stringify({ speso: spesoNelMese(voci, input.mese), budget: api.budgetUsd, tetto: api.tetto,
          ...(api.limiteProgettoUsd !== undefined && { spesoProgetto: spesoNelMese(voci, input.mese, input.repo), limiteProgetto: api.limiteProgettoUsd }) })]
      }
      fs.mkdirSync(dm, { recursive: true })
      scriviLock(dm, { tentativo, id, dir, istante: new Date((deps.adesso ?? Date.now)()).toISOString(), stato: 'in-avvio' })
      fs.mkdirSync(path.dirname(file), { recursive: true })
      d.scriviDati(file, JSON.stringify({ id, tentativo, stato: 'in-avvio', lanciatore: 'api-claude' }))
      try {
        const p = (deps.supervisore ?? (() => spawn(process.execPath, [path.join(__dirname, 'disco.cjs'), 'esegui-api', dir, id, tentativo], { stdio: ['pipe', 'ignore', 'ignore'], detached: true, windowsHide: true })))()
        await new Promise((ok, ko) => { p.once('spawn', ok); p.once('error', ko) })
        p.stdin.on('error', () => {})
        p.stdin.end(JSON.stringify(input))
        p.unref?.()
        return [0, '']
      } catch {
        d.scriviDati(file, JSON.stringify({ id, tentativo, stato: 'fallita', lanciatore: 'api-claude', errore: 'processo non avviato' }))
        fs.rmSync(fileLock(dm), { force: true })
        try {
          contaSpesaQui(dm, tentativo, 0)
        } catch {
          // il registro illeggibile resta com'è: la prossima prenotazione lo rifiuta
        }
        return [1, '']
      }
    })
    return m.occupato ? [3, JSON.stringify({ motivo: 'mutex' })] : m.valore
  })
  return r.occupato ? [3, JSON.stringify({ motivo: 'mutex' })] : r.valore
}

/** Il JSON finale di `claude -p --output-format json`: solo i campi ammessi. null = illeggibile (esito incerto). */
function estraiEsito(testo) {
  for (const candidato of [testo.trim(), testo.trim().split(/\r?\n/).pop() ?? '']) {
    try {
      const j = JSON.parse(candidato)
      if (!j || typeof j !== 'object' || Array.isArray(j)) continue
      const costo = typeof j.total_cost_usd === 'number' && Number.isFinite(j.total_cost_usd) && j.total_cost_usd >= 0 ? j.total_cost_usd : null
      return { costo, errore: j.is_error === true, turni: Number.isInteger(j.num_turns) ? j.num_turns : undefined }
    } catch {
      // il prossimo candidato
    }
  }
  return null
}

/** L'ambiente del solo `claude -p`: ereditato, senza credenziali né instradamenti altrui, con il TTL esplicito. */
function ambienteFiglio(base = process.env) {
  const env = { ...base }
  for (const k of VIETATE) delete env[k]
  env.CLAUDE_CODE_API_KEY_HELPER_TTL_MS = String(TTL_MS)
  return env
}

/** Il supervisore: padre di `claude -p`, ne registra PID, discendenti e uscita, cancella il file-chiave, contabilizza. */
async function eseguiApi(dir, id, tentativo, input, deps = {}) {
  if (!d.idValido(id) || !d.tentativoValido(tentativo)) throw new Error('identità non valida')
  const dm = deps.dirMacchina ?? dirPredefinita()
  const file = d.fileEsecuzione(dir, tentativo)
  // Il supervisore ricontrolla le catene prima di leggere il segno o il lock (un percorso cambiato dopo il lancio).
  percorsiAccount(dm, [dir, file])
  const segno = JSON.parse(fs.readFileSync(file, 'utf8'))
  if (segno.id !== id || segno.tentativo !== tentativo || segno.stato !== 'in-avvio') throw new Error('tentativo non valido')
  const lock = leggiLock(dm)
  if (!lock || lock === 'illeggibile' || lock.tentativo !== tentativo || lock.uscita) throw new Error('lock non di questo tentativo')
  const r = await d.conMutex(d.mutexEsecuzione('api', file), 0, async () => {
    const scrivi = campi => d.scriviDati(file, JSON.stringify({ id, tentativo, lanciatore: 'api-claude', ...campi }))
    let partito = false
    const fuori = {}
    let rec = lock
    try {
      if (!ingressoValido(input)) throw new Error('parametri non validi')
      // Giro 2, rilievo 2: la destinazione si ricontrolla prima del worktree e di nuovo prima dello spawn.
      percorsiAccount(dm, [dir, file, fileChiave(dm, tentativo), fileConsegna(dm, tentativo)])
      const { cwd, ramo, base } = d.preparaWorktree(input, tentativo, deps, fuori)
      // Il processo parte nel worktree, che può avere impostazioni sue: si ricontrolla lì, prima della chiave e dello spawn.
      const fontiCwd = deps.fontiCwd?.(cwd) ?? fontiImpostazioni(cwd, deps.env ?? process.env)
      const vietate = blocchiImpostazioni(fontiCwd, deps.env ?? process.env)
      if (vietate.length) throw Object.assign(new Error('impostazioni vietate'), { fonti: vietate })
      // F7.3: l'advisor sul worktree reale, con le stesse fonti. «Senza auditor» non parte se non si può garantire.
      const envFiglio = { ...ambienteFiglio(deps.env ?? process.env), ...(input.senzaAdvisor && { CLAUDE_CODE_DISABLE_ADVISOR_TOOL: '1' }) }
      const adv = statoAdvisor(input, advisorNelWorktree(fontiCwd), envFiglio)
      if (input.senzaAdvisor && adv.senzaAuditor.bloccato) throw Object.assign(new Error('advisor non spegnibile'), { advisor: adv.senzaAuditor.bloccato })
      fs.mkdirSync(dirChiavi(dm), { recursive: true })
      d.percorsoSicuro(dirChiavi(dm))
      // Il file-chiave nasce subito prima dello spawn, leggibile solo dall'utente, e muore all'uscita.
      fs.writeFileSync(fileChiave(dm, tentativo), input.chiave, { mode: 0o600, flag: 'wx' })
      const helper = [process.execPath, CHIAVE, fileChiave(dm, tentativo), fileConsegna(dm, tentativo)].map(x => `"${x}"`).join(' ')
      const argv = ['claude', '-p', '--output-format', 'json', '--model', input.modello, '--effort', input.effort, '--permission-mode', input.permessi,
        '--max-budget-usd', String(input.tetto), '--settings', JSON.stringify({ apiKeyHelper: helper }), ...(input.advisor && !input.senzaAdvisor ? ['--advisor', input.advisor] : [])]
      percorsiAccount(dm, [dir, file, fileChiave(dm, tentativo), fileConsegna(dm, tentativo)])
      const p = (deps.avvia ?? d.avviaComando)(argv, { cwd, env: envFiglio, stdio: ['pipe', 'pipe', 'pipe'], detached: process.platform !== 'win32' })
      await new Promise((ok, ko) => { p.once('spawn', ok); p.once('error', ko) })
      partito = true
      const avvio = Date.now()
      const radice = process.platform === 'win32' && !deps.elenco ? (d.elencoProcessi() ?? []).find(x => x.pid === String(p.pid)) : undefined
      rec = { ...rec, stato: 'avviata', pid: p.pid, creato: radice?.creato, avvio, noti: [] }
      scriviLock(dm, rec)
      scrivi({ stato: 'avviata', ramo, avviataIl: new Date().toISOString(), ...adv })
      // Censimento a intervalli: i discendenti visti restano noti anche se il loro padre muore prima.
      const censimento = process.platform === 'win32' && !deps.elenco ? setInterval(() => {
        const lista = d.elencoProcessi()
        if (!lista) return
        for (const x of d.alberoVivo(lista, [{ pid: String(rec.pid), creato: rec.creato ?? NaN }, ...rec.noti], rec.avvio))
          if (x.pid !== String(rec.pid) && !rec.noti.some(n => n.pid === x.pid)) rec.noti.push({ pid: x.pid, creato: x.creato })
        scriviLock(dm, rec)
      }, 3_000) : undefined
      const pezzi = []
      let letti = 0
      let troncato = false
      p.stdout?.on('data', b => {
        if (letti + b.length > TETTO_STDOUT) troncato = true
        else pezzi.push(b)
        letti += b.length
      })
      // F7.3: lo stderr non si scarta più: in memoria al più 64 KiB grezzi, salvato filtrato e al più 16 KiB.
      const grezzo = []
      let byteErrori = 0
      let erroriTroncati = false
      p.stderr?.on('data', b => {
        // Si tiene la parte che sta nel tetto; il resto si scarta e lo si ricorda (il filtro toglie la riga incompleta).
        const resta = TETTO_STDERR_GREZZO - byteErrori
        if (resta > 0) grezzo.push(b.subarray(0, resta))
        if (b.length > resta) erroriTroncati = true
        byteErrori += Math.min(b.length, Math.max(0, resta))
      })
      // La fine degli stream arriva dopo l'uscita: il costo si legge solo allora (al più 30 s dopo l'uscita, poi vale quel che c'è).
      const chiuso = new Promise(ok => p.once('close', ok))
      p.stdin.on('error', () => {})
      p.stdin.end(input.prompt)
      const codice = await new Promise(ok => p.once('exit', ok))
      if (censimento) clearInterval(censimento)
      rec = { ...rec, uscita: { codice, fine: new Date().toISOString() } }
      rec.chiaveCancellata = cancellaChiave(dm, tentativo, deps)
      scriviLock(dm, rec)
      await Promise.race([chiuso, new Promise(ok => setTimeout(ok, 30_000).unref?.())])
      const esito = troncato ? null : estraiEsito(Buffer.concat(pezzi).toString('utf8'))
      const errori = Buffer.concat(grezzo).toString('utf8')
      const stderr = errori ? { stderr: filtraStderr(errori, input.chiave, undefined, erroriTroncati) } : {}
      // Rifiuto all'avvio SOLO se tutto è vero: nessun JSON finale e stdout NON troncato (un JSON oltre il limite potrebbe
      // esserci), uscita con errore entro pochi secondi, stderr che cita advisor, availableModels o il consenso, e il
      // worktree invariato (status pulito, nessun commit oltre la base). Lo stdout vuoto non dice che non si è lavorato.
      const nonDisp = !esito && !troncato && codice !== 0 && Date.now() - avvio < (deps.avvioMs ?? AVVIO_MS) ? advisorNonDisponibile(errori) : undefined
      const rifiutato = !!nonDisp && worktreeInvariato(cwd, base, deps)
      // F6 §4, una regola sola: ogni esito che non è una consegna pulita (incerto, rifiuto) contabilizza il tetto intero.
      // Il costo che il JSON riporta resta nel record solo come informazione (`costoRiportato`).
      const riportato = esito && esito.costo !== null ? { costoRiportato: esito.costo } : {}
      if (rifiutato) scrivi({ stato: 'fallita', ramo, costo: null, advisorNonDisponibile: nonDisp, errore: "advisor non disponibile all'avvio: il worktree è invariato", ...adv, ...stderr })
      else if (!esito) scrivi({ stato: 'avviata', ramo, incerto: true, costo: null, errore: 'esito API incerto: controlla il worktree prima di chiudere', ...adv, ...stderr })
      // Un JSON con is_error non è una consegna: finita con errore, il lavoro fatto non si sa (num_turns mancante = ignoto).
      else if (esito.errore) scrivi({ stato: 'avviata', ramo, incerto: true, costo: null, ...riportato, ...(esito.turni !== undefined && { turni: esito.turni }), errore: 'esecuzione API terminata con errore: controlla il worktree prima di chiudere', ...adv, ...stderr })
      else scrivi({ stato: 'consegnata', ramo, costo: esito.costo, turni: esito.turni, errore: codice !== 0 ? 'esecuzione API terminata con errore: controlla il worktree prima di chiudere' : undefined, ...adv, ...stderr })
      await contaSpesa(dm, tentativo, esito && !esito.errore && !rifiutato ? esito.costo : null, deps)
    } catch (e) {
      if (!partito) {
        scrivi({ stato: 'fallita', ramo: fuori.ramo,
          errore: e?.fonti ? `API non avviata: impostazioni vietate nel worktree (${e.fonti.join(', ')})`
            : e?.advisor ? `API non avviata: l'advisor non si può spegnere per questo avvio (${e.advisor})` : 'API non avviata: verifica comando e worktree; nessun file eliminato',
          ...(e?.advisor && { senzaAuditor: { bloccato: e.advisor } }) })
        // Il lock si toglie solo se il file-chiave non c'è più; altrimenti resta, con l'uscita registrata, e la
        // prossima verifica ritenta la cancellazione prima di liberarlo.
        if (cancellaChiave(dm, tentativo, deps)) fs.rmSync(fileLock(dm), { force: true })
        else scriviLock(dm, { ...rec, uscita: { codice: null, fine: new Date().toISOString() }, chiaveCancellata: false })
        await contaSpesa(dm, tentativo, 0, deps).catch(() => {})
      } else scrivi({ stato: 'avviata', ramo: fuori.ramo, incerto: true, costo: null, errore: 'esito API incerto: controlla il processo e il worktree' })
    }
  })
  return r.occupato ? 3 : 0
}

// --- F6.7: stato della configurazione e accessi a un clic ---------------------------------------------------
// Solo stati sì/no, metodo e host: email, nomi e identificativi dell'account non escono mai da qui.

/** Un comando senza shell, con l'output catturato (mai mostrato così com'è): null se non parte. */
function esegui(argv, deps = {}) {
  if (deps.esegui) return deps.esegui(argv)
  try {
    const [eseguibile, argomenti] = d.comandoReale(argv)
    const r = spawnSync(eseguibile, argomenti, { encoding: 'utf8', windowsHide: true, timeout: 20_000 })
    return r.error ? null : { codice: r.status, testo: r.stdout ?? '' }
  } catch {
    return null
  }
}

/** L'host di un URL git (https o scp), nient'altro: utente, percorso e credenziali restano fuori. */
const hostGit = url => /^(?:[a-z+]+:\/\/(?:[^@/]+@)?|[^@\s/]+@)([a-z0-9.-]+)[:/]/i.exec(url.trim())?.[1]?.toLowerCase()

/** Login Claude, GitHub con il remote del progetto, fonti di impostazioni compatibili con `api-claude`. */
function statoEsecuzione(root, deps = {}) {
  const claude = (() => {
    const r = esegui(['claude', 'auth', 'status'], deps)
    if (!r) return { trovato: false }
    try {
      const j = JSON.parse(r.testo)
      return { trovato: true, loggedIn: j.loggedIn === true, metodo: typeof j.authMethod === 'string' && /^[a-z._-]{1,20}$/i.test(j.authMethod) ? j.authMethod : undefined }
    } catch {
      return { trovato: true, loggedIn: false }
    }
  })()
  // F11: Codex conta solo per il codice d'uscita di `codex login status`; l'output non si legge né si salva.
  const cx = esegui(['codex', 'login', 'status'], deps)
  const gh = esegui(['gh', 'auth', 'status', '--hostname', 'github.com'], deps)
  const remote = esegui(['git', '-C', root, 'remote', 'get-url', 'origin'], deps)
  const host = remote && remote.codice === 0 ? hostGit(remote.testo) : undefined
  return {
    claude,
    github: { trovato: !!gh, loggedIn: !!gh && gh.codice === 0, remote: host === 'github.com', ...(host && { host }) },
    codex: { trovato: !!cx, loggedIn: !!cx && cx.codice === 0 },
    fonti: blocchiDettagliati(deps.fonti ?? fontiImpostazioni(root), deps.env ?? process.env),
  }
}

/**
 * «Accedi» (Claude) e «Collega GitHub»: il login dell'host lo tiene un processo staccato (`accesso.cjs`) che ne legge
 * l'output solo in memoria e passa qui, su una pipe, «pronto» e il codice monouso di GitHub: niente output del login va
 * mai su disco. Il processo tiene il mutex `accesso-vivo:<tipo>` finché il login vive: intanto nessun secondo login,
 * a qualunque età. Se il comando non c'è o non parte, la riga da copiare.
 */
async function accedi(tipo, deps = {}) {
  const argv = tipo === 'claude' ? ['claude', 'auth', 'login'] : tipo === 'gh' ? ['gh', 'auth', 'login', '--web', '--hostname', 'github.com', '--git-protocol', 'https']
    : tipo === 'codex' ? ['codex', 'login'] : null
  if (!argv) return [2, '']
  const copia = [1, JSON.stringify({ copia: argv.join(' ') })]
  try {
    d.comandoReale(argv)
  } catch {
    return copia
  }
  // Come per l'API: `deps.mutexAccesso` (un prefisso) lo passa solo l'entrypoint delle prove; in produzione «accesso».
  const prefisso = deps.mutexAccesso ?? 'accesso'
  const vivo = `${prefisso}-vivo:${tipo}`
  const r = await d.conMutex(`${prefisso}:${tipo}`, 2000, async () => {
    if ((await d.conMutex(vivo, 0, () => true)).occupato) return [3, '']
    let p
    try {
      p = spawn(process.execPath, [ACCESSO, vivo, tipo, ...argv], { stdio: ['ignore', 'pipe', 'ignore'], detached: true, windowsHide: true })
      await new Promise((ok, ko) => { p.once('spawn', ok); p.once('error', ko) })
    } catch {
      return copia
    }
    let uscita = ''
    p.stdout.on('data', b => { uscita = (uscita + b.toString('utf8')).slice(-200) })
    const attendi = async (re, ms) => {
      for (let t = 0; t < ms && !re.test(uscita); t += 100) await new Promise(ok => setTimeout(ok, 100))
      return re.exec(uscita)
    }
    const stato = (await attendi(/^(pronto|errore|occupato)$/m, 5000))?.[1]
    const codice = stato === 'pronto' && tipo === 'gh' ? (await attendi(/^codice ([A-Z0-9]{4}-[A-Z0-9]{4})$/m, deps.attesaCodice ?? 8000))?.[1] : undefined
    if (stato !== 'pronto') p.kill()
    p.stdout.destroy()
    p.unref()
    return stato === 'occupato' ? [3, ''] : stato === 'pronto' ? [0, JSON.stringify(codice ? { codice } : {})] : copia
  })
  return r.occupato ? [3, ''] : r.valore
}

/** Il punto d'ingresso da disco.cjs. */
async function comando(cmd, a, stdin, opz = {}) {
  const dm = opz.dirMacchina ?? dirPredefinita()
  if (cmd === 'lancia-api' && a.length === 3) return d.esci(...(await lanciaApi(...a, stdin(), { dirMacchina: dm })))
  if (cmd === 'esegui-api' && a.length === 3) return d.esci(await eseguiApi(...a, stdin(), { dirMacchina: dm }))
  if (cmd === 'stato-api' && !a.length) return d.esci(0, JSON.stringify(await statoApi(dm)))
  if (cmd === 'libera-api' && !a.length) return d.esci(0, JSON.stringify(await liberaApi(dm)))
  if (cmd === 'termina-api' && !a.length) return d.esci(0, JSON.stringify(await terminaApi(dm)))
  if (cmd === 'stato-esecuzione' && a.length === 1) return d.esci(0, JSON.stringify(statoEsecuzione(a[0])))
  if (cmd === 'accedi' && a.length === 1) return d.esci(...(await accedi(a[0])))
  return d.esci(2, '')
}

module.exports = {
  comando, dirPredefinita, MUTEX_API, chiaviVietateCli, blocchiCli, ambienteCli, lanciaApi, eseguiApi, booleano, worktreeInvariato, advisorNelWorktree, statoAdvisor, filtraStderr, statoApi, liberaApi, terminaApi, statoEsecuzione, accedi, hostGit, blocchiImpostazioni, fontiImpostazioni, impostazioniVietate, chiaviVietate, prenotaSpesa, contaSpesa,
  leggiSpesa, spesoNelMese, fileSpesa, regoleApi, percorsiAccount, estraiEsito, ambienteFiglio, leggiLock, fileLock, fileChiave, fileConsegna, TTL_MS, VIETATE,
}
