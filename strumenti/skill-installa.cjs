'use strict'
// F13.7: install baseline skills at an approved revision, on the owner's click. Every command is argv with no shell, every
// source comes from the registry (skill-base.cjs), never from settings or an agent.
//
//   node skill-installa.cjs prepara <id>     approved revision (sha) + the hooks it declares, read from that revision
//   node skill-installa.cjs installa <id>    stdin { url, sha, impronta, hook } = what the owner approved: local marketplace, install, checks
//   node skill-installa.cjs abilita <id>     enable a plugin the mod installed, only if the installed revision is the approved one
//   node skill-installa.cjs controlla        disable any mod-installed plugin enabled without a matching approval record
//   node skill-installa.cjs pulisci <id>     remove the downloaded revision once the owner has decided
//
// Exit 0 with JSON on stdout; exit 2 with { motivo: <code> } for a refusal (codes are the panel's dictionary keys).
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { isDeepStrictEqual } = require('node:util')
const K = require('./skill-base.cjs')

const SHA = /^[0-9a-f]{40}$/
const dirPredefinita = () => path.join(os.homedir(), '.claude', 'chipmanager')
const fileRecord = dm => path.join(dm, 'skill-approvate.json')
const dirMarketplace = dm => path.join(dm, 'skill', 'marketplace')
const dirRevisione = (dm, id, sha) => path.join(dm, 'skill', 'revisioni', `${id}-${sha}`)
const urlDi = v => `https://github.com/${v.repo}.git`
/**
 * A folder this helper turns into a git checkout (a revision download or the TokenEconomizer clone): the path checks run
 * on its parent (no link at or below the data root; the checkout itself is a git tree by design), and the folder is not a
 * link. Throws a refusal from disco.cjs otherwise.
 */
function cartellaGitSicura(dir, dm) {
  require('./disco.cjs').percorsoSicuro(path.dirname(dir), [dm])
  if (fs.existsSync(dir) && fs.lstatSync(dir).isSymbolicLink()) throw new Rifiuto('skill.err.percorso')
}
class Rifiuto extends Error {
  constructor(motivo) { super(motivo); this.motivo = motivo }
}

/** Runs argv without a shell; `.cmd` shims resolved like the main helper. Returns { status, stdout }. */
function eseguiReale(argv, opz = {}) {
  const [eseguibile, argomenti] = require('./disco.cjs').comandoReale(argv)
  const r = spawnSync(eseguibile, argomenti, { cwd: opz.cwd, encoding: 'utf8', timeout: opz.timeoutMs ?? 120_000, windowsHide: true, shell: false, maxBuffer: 2_000_000 })
  return { status: r.status ?? 1, stdout: r.stdout ?? '' }
}

/** The official marketplace's entry, as Claude Code keeps it locally; its url must be the registry's repo. */
function revisioneUfficiale(v, deps) {
  const f = deps.marketplaceUfficiale ?? path.join(os.homedir(), '.claude', 'plugins', 'marketplaces', 'claude-plugins-official', '.claude-plugin', 'marketplace.json')
  let m
  try { m = JSON.parse(fs.readFileSync(f, 'utf8')) } catch { throw new Rifiuto('skill.err.ufficiale') }
  const e = Array.isArray(m?.plugins) ? m.plugins.find(p => p?.name === K.nomePlugin(v)) : undefined
  const s = e?.source
  if (!s || s.source !== 'url' || s.url !== urlDi(v) || !SHA.test(String(s.sha))) throw new Rifiuto('skill.err.fonte')
  return s.sha
}

/** The approved revision: the official entry's sha, or the head of the registry repo. TokenEconomizer is not handled here. */
function revisione(v, deps) {
  if (v.pin === 'ufficiale') return revisioneUfficiale(v, deps)
  if (v.pin !== 'ls-remote') throw new Rifiuto('skill.err.nonInstallabile')
  const r = deps.esegui(['git', 'ls-remote', urlDi(v), 'HEAD'], { timeoutMs: 30_000 })
  const sha = r.status === 0 ? r.stdout.trim().split(/\s+/)[0] : ''
  if (!SHA.test(sha)) throw new Rifiuto('skill.err.git')
  return sha
}

/**
 * One hooks configuration ({ hooks: { Event: [...] }, modules } or the event map itself) as short readable lines, and the
 * mod modules it loads (paths relative to the file's folder). Another key, or a shape it does not know, is a refusal.
 */
function righeHook(conf, fonte) {
  if (!conf || typeof conf !== 'object' || Array.isArray(conf)) throw new Rifiuto('skill.err.hook')
  // Audit 2.2.0, point 1: the `modules` of a hooks file are mod code loaded at every session; any other key is unknown.
  const involucro = Object.hasOwn(conf, 'hooks') || Object.hasOwn(conf, 'modules')
  if (involucro && !Object.keys(conf).every(k => CHIAVI_HOOK.has(k))) throw new Rifiuto('skill.err.hook')
  const eventi = involucro ? conf.hooks ?? {} : conf
  const moduli = involucro ? conf.modules ?? [] : []
  if (!eventi || typeof eventi !== 'object' || Array.isArray(eventi) || !Array.isArray(moduli) || !moduli.every(m => typeof m === 'string')) throw new Rifiuto('skill.err.hook')
  const righe = []
  for (const [evento, gruppi] of Object.entries(eventi)) {
    if (!Array.isArray(gruppi)) throw new Rifiuto('skill.err.hook')
    for (const g of gruppi)
      for (const h of Array.isArray(g?.hooks) ? g.hooks : [g]) {
        const cosa = h?.type === 'command' && typeof h.command === 'string' ? h.command : String(h?.type ?? '?')
        righe.push(riga(`${fonte} · ${evento}${typeof g?.matcher === 'string' && g.matcher ? ` [${g.matcher}]` : ''}: ${cosa}`))
      }
  }
  return { righe, moduli }
}
const riga = t => t.replace(/[\x00-\x1f]/g, ' ').slice(0, 200)
/** Keys a hooks file may carry next to its events. */
const CHIAVI_HOOK = new Set(['hooks', 'modules', 'description', '_comment', 'version'])

/**
 * Servers a plugin starts by itself (MCP: `{ mcpServers: {...} }` or the map itself; LSP: the map itself), one line each
 * with the command and its arguments, or the address of a remote MCP server. A server it cannot read is a refusal.
 */
function righeServer(conf, fonte, tipo) {
  const mappa = tipo === 'MCP' && conf && typeof conf === 'object' && Object.hasOwn(conf, 'mcpServers') ? conf.mcpServers : conf
  if (!mappa || typeof mappa !== 'object' || Array.isArray(mappa)) throw new Rifiuto('skill.err.hook')
  return Object.entries(mappa).map(([nome, s]) => {
    if (!s || typeof s !== 'object' || Array.isArray(s)) throw new Rifiuto('skill.err.hook')
    const argomenti = s.args ?? []
    if (!Array.isArray(argomenti) || !argomenti.every(a => typeof a === 'string')) throw new Rifiuto('skill.err.hook')
    const cosa = typeof s.command === 'string' ? [s.command, ...argomenti].join(' ') : tipo === 'MCP' && typeof s.url === 'string' ? s.url : null
    if (cosa === null) throw new Rifiuto('skill.err.hook')
    return riga(`${fonte} · ${tipo} ${nome}: ${cosa}`)
  })
}

/** Background monitors: a list or a map of entries, each with its command. Anything else is a refusal. */
function righeMonitor(conf, fonte) {
  const elenco = Array.isArray(conf) ? conf.map((m, i) => [m?.name ?? String(i), m])
    : conf && typeof conf === 'object' ? Object.entries(Object.hasOwn(conf, 'monitors') ? conf.monitors ?? {} : conf) : null
  if (!elenco) throw new Rifiuto('skill.err.hook')
  return elenco.map(([nome, m]) => {
    if (!m || typeof m !== 'object' || typeof m.command !== 'string') throw new Rifiuto('skill.err.hook')
    return riga(`${fonte} · monitor ${nome}: ${m.command}`)
  })
}

/**
 * Manifest fields that describe the plugin or point to content that runs only when asked (commands, agents, skills,
 * styles, the settings it offers). Any other field is a component read and shown below, or a refusal.
 */
const CAMPI_INERTI = new Set(['$schema', 'name', 'displayName', 'version', 'description', 'author', 'homepage', 'repository', 'license', 'keywords',
  'commands', 'agents', 'skills', 'outputStyles', 'types', 'userConfig'])
/** What runs on its own: the manifest field, the conventional file, and how one configuration reads. */
const COMPONENTI = [
  { campo: 'hooks', file: 'hooks/hooks.json', righe: righeHook },
  { campo: 'mcpServers', file: '.mcp.json', righe: (c, f) => ({ righe: righeServer(c, f, 'MCP'), moduli: [] }) },
  { campo: 'lspServers', file: '.lsp.json', righe: (c, f) => ({ righe: righeServer(c, f, 'LSP'), moduli: [] }) },
  { campo: 'monitors', file: 'monitors/monitors.json', righe: (c, f) => ({ righe: righeMonitor(c, f), moduli: [] }) },
]

/**
 * Everything a plugin runs on its own, from any source of its files (`esiste`/`testo` on paths relative to the plugin
 * root): hooks and the mod modules they load, MCP and LSP servers, monitors; from the manifest (inline or file paths) and
 * from the conventional files. A manifest field it does not know, or a declared file it cannot read, is a refusal. Used
 * on the approved revision before install and on the installed copy before enabling.
 * Revisione dell'audit 2.2.0, S1: `voce` is the plugin's entry in a marketplace the mod installs from unchanged
 * (TokenEconomizer's own): the host applies the components it declares too, so they are read, shown and fingerprinted
 * like the manifest's (paths relative to the plugin root); `defaultEnabled`, the mod's only edit, is left out of the
 * fingerprint. Every line is returned (the panel shows them all, a page at a time); over MAX_RIGHE it is a refusal.
 */
function hookDa(v, esiste, testo, voce) {
  // The approval covers the full content (manifest, every component file and module, line endings normalised), never the preview.
  const impronta = require('node:crypto').createHash('sha256')
  const grezzo = p => {
    const t = testo(p)
    if (t === null) throw new Rifiuto('skill.err.hook')
    impronta.update(`${p}\0${t.replace(/\r\n/g, '\n')}\0`)
    return t
  }
  const leggi = p => {
    const t = grezzo(p)
    try { return JSON.parse(t) } catch { throw new Rifiuto('skill.err.hook') }
  }
  const dentro = (base, p) => {
    const r = path.posix.normalize(path.posix.join(base, p.replace(/^\.\//, '')))
    if (path.posix.isAbsolute(p) || r.startsWith('..') || !esiste(r)) throw new Rifiuto('skill.err.hook')
    return r
  }
  const righe = []
  const manifest = esiste('.claude-plugin/plugin.json') ? leggi('.claude-plugin/plugin.json') : (impronta.update('no-manifest\0'), null)
  if (manifest !== null && (typeof manifest !== 'object' || Array.isArray(manifest))) throw new Rifiuto('skill.err.hook')
  if (manifest && typeof manifest.name === 'string' && manifest.name !== K.nomePlugin(v)) throw new Rifiuto('skill.err.nome')
  if (manifest && !Object.keys(manifest).every(k => CAMPI_INERTI.has(k) || COMPONENTI.some(c => c.campo === k))) throw new Rifiuto('skill.err.hook')
  if (voce !== undefined) {
    if (!oggettoPuro(voce) || !Object.keys(voce).every(k => CAMPI_VOCE.has(k) || CAMPI_INERTI.has(k) || COMPONENTI.some(c => c.campo === k))) throw new Rifiuto('skill.err.hook')
    const { defaultEnabled: _spento, ...resto } = voce
    impronta.update(`marketplace-entry\0${JSON.stringify(resto)}\0`)
  }
  for (const c of COMPONENTI) {
    const dichiaratiDa = (m, fonte) => {
      const valore = m?.[c.campo]
      const elenco = Array.isArray(valore) && (c.campo !== 'monitors' || valore.every(x => typeof x === 'string'))
      return (valore === undefined ? [] : elenco ? valore : [valore]).map(d => [d, fonte])
    }
    const dichiarati = [...dichiaratiDa(manifest, 'plugin.json'), ...dichiaratiDa(voce, 'marketplace.json')]
    const letti = new Set()
    const una = (conf, fonte, base) => {
      const r = c.righe(conf, fonte)
      righe.push(...r.righe)
      for (const m of r.moduli) {
        const p = dentro(base, m)
        grezzo(p)
        righe.push(riga(`${fonte} · module: ${p}`))
      }
    }
    for (const [d, fonte] of dichiarati) {
      if (typeof d !== 'string') { una(d, fonte, ''); continue }
      const p = dentro('', d)
      letti.add(p)
      una(leggi(p), p, path.posix.dirname(p))
    }
    if (esiste(c.file) && !letti.has(c.file)) una(leggi(c.file), c.file, path.posix.dirname(c.file))
  }
  // `righe` is the whole preview for the confirmation; `impronta` (full content) is what the record keeps and compares.
  if (righe.length > MAX_RIGHE) throw new Rifiuto('skill.err.troppi')
  return { righe, impronta: impronta.digest('hex') }
}
/** The most preview lines the owner is asked to read (a page at a time); more is a refusal, never a cut preview. */
const MAX_RIGHE = 400
/** Fields of a marketplace entry besides the manifest's: where it comes from and how the host treats it. */
const CAMPI_VOCE = new Set(['source', 'defaultEnabled', 'strict', 'category', 'tags'])
const IMPRONTA = /^[0-9a-f]{64}$/

/**
 * Fetches the approved revision read-only into the data folder (through the path checks: no link at or below the data
 * root) and lists its hooks. The folder is removed by `pulisci` once the owner has decided.
 */
function hookDellaRevisione(v, sha, dm, deps) {
  const dir = dirRevisione(dm, v.id, sha)
  cartellaGitSicura(dir, dm)
  fs.mkdirSync(dir, { recursive: true })
  const git = (...a) => deps.esegui(['git', '-C', dir, ...a], { timeoutMs: 120_000 })
  if (!fs.existsSync(path.join(dir, '.git')) && deps.esegui(['git', 'init', '-q', dir]).status !== 0) throw new Rifiuto('skill.err.git')
  if (git('fetch', '-q', '--depth', '1', '--no-tags', urlDi(v), sha).status !== 0) throw new Rifiuto('skill.err.git')
  return hookDa(v, p => git('cat-file', '-e', `${sha}:${p}`).status === 0, p => {
    const r = git('show', `${sha}:${p}`)
    return r.status === 0 ? r.stdout : null
  })
}

/**
 * A file under `radice` whose every component, from `radice` down to the file, is not a link (junctions included): reading
 * or writing it cannot leave `radice`. Returns the absolute path, or throws a refusal.
 */
function fileSenzaLink(radice, rel) {
  let x = path.resolve(radice)
  if (fs.lstatSync(x).isSymbolicLink()) throw new Rifiuto('skill.err.percorso')
  for (const parte of rel.split('/')) {
    x = path.join(x, parte)
    // lstat, not exists: a dangling link is still a link.
    if (fs.lstatSync(x, { throwIfNoEntry: false })?.isSymbolicLink()) throw new Rifiuto('skill.err.percorso')
  }
  return x
}
/** Writes without following a link at the last component (O_NOFOLLOW where the platform has it; lstat checked before). */
function scriviSenzaLink(radice, rel, testo) {
  const f = fileSenzaLink(radice, rel)
  // Windows rejects numeric open flags here (EINVAL) and has no O_NOFOLLOW: there the per-component lstat above is the check.
  const fd = process.platform === 'win32' ? fs.openSync(f, 'r+') : fs.openSync(f, fs.constants.O_WRONLY | (fs.constants.O_NOFOLLOW ?? 0))
  try {
    fs.ftruncateSync(fd, 0)
    fs.writeSync(fd, testo, 0)
  } finally { fs.closeSync(fd) }
}

/** The hooks of the installed copy (its `installPath`, read from disk, no links); undefined = cannot be read (counts as different). */
function hookInstallati(v, installPath, voce) {
  if (typeof installPath !== 'string' || !path.isAbsolute(installPath)) return undefined
  const dentro = p => {
    const f = path.resolve(installPath, p)
    return f.startsWith(path.resolve(installPath) + path.sep) ? f : null
  }
  try {
    return hookDa(v, p => !!dentro(p) && fs.existsSync(dentro(p)), p => {
      try { return dentro(p) ? fs.readFileSync(fileSenzaLink(installPath, p), 'utf8') : null } catch { return null }
    }, voce)
  } catch (e) {
    // Too much to show is its own refusal; anything else is «cannot be read» (counts as different).
    if (e instanceof Rifiuto && e.motivo === 'skill.err.troppi') throw e
    return undefined
  }
}

/** Removes the downloaded revision of `id` (only folders this helper creates, after the same path checks). */
function pulisci(id, dm) {
  const v = K.voceSkill(id)
  if (!v) throw new Rifiuto('skill.err.nonInstallabile')
  if (v.pin === 'clone') {
    // The clone is the installed marketplace once approved: it goes only when nothing was installed from it.
    const dir = dirClone(dm)
    if (leggiRecord(dm).voci[id] || !fs.existsSync(dir)) return { tolte: 0 }
    cartellaGitSicura(dir, dm)
    if (fs.lstatSync(dir).isSymbolicLink()) return { tolte: 0 }
    fs.rmSync(dir, { recursive: true, force: true })
    return { tolte: 1 }
  }
  const base = path.join(dm, 'skill', 'revisioni')
  if (!fs.existsSync(base)) return { tolte: 0 }
  require('./disco.cjs').percorsoSicuro(base, [dm])
  let tolte = 0
  for (const n of fs.readdirSync(base)) {
    if (!new RegExp(`^${v.id}-[0-9a-f]{40}$`).test(n)) continue
    const f = path.join(base, n)
    if (fs.lstatSync(f).isSymbolicLink()) continue
    fs.rmSync(f, { recursive: true, force: true })
    tolte++
  }
  return { tolte }
}

/** The installed copy's path from `claude plugin list --json` (raw entry, read only here). */
function percorsoInstallato(plugin, deps) {
  const l = deps.esegui(['claude', 'plugin', 'list', '--json'], { timeoutMs: 30_000 })
  try {
    const e = l.status === 0 ? JSON.parse(l.stdout).find(x => x?.id === plugin && x?.scope === 'user') : undefined
    return typeof e?.installPath === 'string' ? e.installPath : undefined
  } catch { return undefined }
}

function leggiRecord(dm) {
  try {
    const r = JSON.parse(fs.readFileSync(fileRecord(dm), 'utf8'))
    return r && r.v === 1 && r.voci && typeof r.voci === 'object' ? r : { v: 1, voci: {} }
  } catch { return { v: 1, voci: {} } }
}
function scriviRecord(dm, r) {
  const d = require('./disco.cjs')
  d.percorsoSicuro(fileRecord(dm))
  d.scriviAtomico(fileRecord(dm), JSON.stringify(r, null, 1))
}

const oggettoPuro = x => !!x && typeof x === 'object' && !Array.isArray(x)
/** Each known field of an installed record, when present, has its type; unknown fields are left to the host. */
const CAMPI_RECORD = { scope: 'string', version: 'string', gitCommitSha: 'string', installPath: 'string', installedAt: 'string', lastUpdated: 'string', isLocal: 'boolean' }
const recordValido = x => oggettoPuro(x) && typeof x.scope === 'string'
  && Object.entries(CAMPI_RECORD).every(([k, t]) => !Object.hasOwn(x, k) || typeof x[k] === t)
  && (!Object.hasOwn(x, 'gitCommitSha') || SHA.test(x.gitCommitSha))
/** Marketplace source kinds Claude Code records, each with its required string field; any other kind is not understood. */
const CAMPO_SORGENTE = { github: 'repo', git: 'url', url: 'url', file: 'path', directory: 'path' }
const sorgenteValida = s => oggettoPuro(s) && typeof s.source === 'string' && Object.hasOwn(CAMPO_SORGENTE, s.source) && typeof s[CAMPO_SORGENTE[s.source]] === 'string'

/**
 * The installed revision, as the host records it (schema version 2: `gitCommitSha`, or a 12-character `version`);
 * undefined = cannot verify. Fail-closed: an unknown schema, a wrong type, more than one user record, or a present field
 * that is not valid refuses, with no fallback to another field.
 */
function shaInstallato(plugin, deps) {
  // Nothing thrown leaves the parser: any unexpected shape is «cannot verify».
  try { return leggiShaInstallato(plugin, deps) } catch { return undefined }
}
function leggiShaInstallato(plugin, deps) {
  const f = deps.installati ?? path.join(process.env.CLAUDE_CODE_PLUGIN_CACHE_DIR ?? path.join(os.homedir(), '.claude', 'plugins'), 'installed_plugins.json')
  const j = JSON.parse(fs.readFileSync(f, 'utf8'))
  if (!oggettoPuro(j) || j.version !== 2 || !oggettoPuro(j.plugins)) return undefined
  const voci = Object.hasOwn(j.plugins, plugin) ? j.plugins[plugin] : undefined
  if (!Array.isArray(voci) || !voci.every(recordValido)) return undefined
  const utente = voci.filter(x => x.scope === 'user')
  if (utente.length !== 1) return undefined
  const [u] = utente
  if (Object.hasOwn(u, 'gitCommitSha')) return { pieno: u.gitCommitSha }
  return /^[0-9a-f]{12}$/.test(u.version ?? '') ? { corto: u.version } : undefined
}
const coincide = (inst, sha) => !!inst && (inst.pieno ? inst.pieno === sha : sha.startsWith(inst.corto))

function voce(id) {
  const v = K.voceSkill(id)
  if (!v) throw new Rifiuto('skill.err.nonInstallabile')
  return v
}
/** The id the plugin has when the mod installed it: TokenEconomizer keeps its upstream identity (its clone is the marketplace). */
const pluginInstallato = v => (v.pin === 'clone' ? v.plugin : K.pluginDellaMod(v))

function prepara(id, dm, deps) {
  const v = voce(id)
  if (v.pin === 'clone') return preparaClone(v, dm, deps)
  const sha = revisione(v, deps)
  const h = hookDellaRevisione(v, sha, dm, deps)
  return { id, url: urlDi(v), sha, hook: h.righe, impronta: h.impronta }
}

/**
 * Which marketplace provides `nome`, as Claude Code records it: `assente` (no file, or no entry with that name),
 * `nostro` (a directory source at exactly `dirAtteso`) or `altro`. A file that cannot be read, or whose structure is not
 * an object of entries whose `source` is a known kind with its required string field (CAMPO_SORGENTE), is `altro`: in doubt nothing runs. (The file is Claude
 * Code's own; its directory entries are `{ source: 'directory', path }`.)
 */
function marketplace(nome, dirAtteso, deps) {
  // Nothing thrown leaves the parser: any unexpected shape is `altro`.
  try { return leggiMarketplace(nome, dirAtteso, deps) } catch { return 'altro' }
}
function leggiMarketplace(nome, dirAtteso, deps) {
  const f = deps.marketplaceNote ?? path.join(process.env.CLAUDE_CODE_PLUGIN_CACHE_DIR ?? path.join(os.homedir(), '.claude', 'plugins'), 'known_marketplaces.json')
  if (!fs.existsSync(f)) return 'assente'
  const note = JSON.parse(fs.readFileSync(f, 'utf8'))
  if (!oggettoPuro(note) || !Object.values(note).every(x => oggettoPuro(x) && sorgenteValida(x.source))) return 'altro'
  if (!Object.hasOwn(note, nome)) return 'assente'
  const s = note[nome].source
  return s.source === 'directory' && typeof s.path === 'string' && path.resolve(s.path) === path.resolve(dirAtteso) ? 'nostro' : 'altro'
}
const dirDellaVoce = (v, dm) => (v.pin === 'clone' ? dirClone(dm) : dirMarketplace(dm))
const nomeMarketplace = v => (v.pin === 'clone' ? v.marketplace : K.MARKETPLACE_BASE)

/** The mod's marketplace for `v` is registered, adding it if missing; another marketplace with that name is a refusal. */
function marketplaceNostro(v, dm, deps) {
  const dir = dirDellaVoce(v, dm)
  const stato = marketplace(nomeMarketplace(v), dir, deps)
  if (stato === 'altro') throw new Rifiuto('skill.err.marketplace')
  if (stato === 'assente') {
    if (deps.esegui(['claude', 'plugin', 'marketplace', 'add', percorsoAvanti(dir), '--scope', 'user'], { timeoutMs: 300_000 }).status !== 0) throw new Rifiuto('skill.err.marketplace')
    if (marketplace(nomeMarketplace(v), dir, deps) !== 'nostro') throw new Rifiuto('skill.err.marketplace')
  }
}
/** Every plugin command must succeed; `disable` on a plugin already disabled (exit 1, documented message) counts as done. */
function comando(deps, argv, motivo, giaFatto) {
  const r = deps.esegui(argv, { timeoutMs: 300_000 })
  if (r.status !== 0 && !(giaFatto && giaFatto.test(r.stdout))) throw new Rifiuto(motivo)
  return r
}
const spegniPlugin = (deps, plugin) => comando(deps, ['claude', 'plugin', 'disable', plugin, '--scope', 'user'], 'skill.err.disabilita', /already disabled/i)

// --- TokenEconomizer (F13.7 corrections r2–r4): experimental, off until the owner's second consent ------------------
// Upstream packaging is kept: the approved clone is itself the marketplace, its plugin loads in place from `plugin/`, and
// its runtime is found in the clone. The only edit is `defaultEnabled: false` in the clone's own marketplace manifest.

const dirClone = dm => path.join(dm, 'skill', 'tokeneconomizer')
const MANIFEST_CLONE = '.claude-plugin/marketplace.json'
/** Forward slashes on Windows too: the marketplace path upstream documents. */
const percorsoAvanti = p => p.replace(/\\/g, '/')

/** Python ≥ 3.10 (first working of python3, python, py -3) and, on Windows, Git's `sh`: argv of the interpreter, or a refusal. */
function prerequisiti(deps) {
  const piattaforma = deps.piattaforma ?? process.platform
  let py
  for (const c of [['python3'], ['python'], ...(piattaforma === 'win32' ? [['py', '-3']] : [])]) {
    // A command that does not exist (ENOENT from the resolver) is a candidate that fails: try the next one.
    let r
    try { r = deps.esegui([...c, '--version'], { timeoutMs: 15_000 }) } catch { continue }
    const m = /Python (\d+)\.(\d+)/.exec(r.stdout)
    if (r.status === 0 && m && (Number(m[1]) > 3 || (Number(m[1]) === 3 && Number(m[2]) >= 10))) { py = c; break }
  }
  if (!py) throw new Rifiuto('skill.err.python')
  if (piattaforma === 'win32') {
    let ok = false
    try { ok = deps.esegui(['sh', '-c', 'exit 0'], { timeoutMs: 15_000 }).status === 0 } catch { /* missing */ }
    if (!ok) throw new Rifiuto('skill.err.sh')
  }
  return py
}

/** The clone checked out at `sha`, through the path checks; reused when it is already there at that commit. */
function cloneA(dm, url, sha, deps) {
  const dir = dirClone(dm)
  cartellaGitSicura(dir, dm)
  const git = (...a) => deps.esegui(['git', '-C', dir, ...a], { timeoutMs: 300_000 })
  if (!fs.existsSync(path.join(dir, '.git'))) {
    fs.mkdirSync(dir, { recursive: true })
    if (deps.esegui(['git', 'init', '-q', dir]).status !== 0) throw new Rifiuto('skill.err.git')
  }
  if (git('fetch', '-q', '--depth', '1', '--no-tags', url, sha).status !== 0 || git('checkout', '-q', '--detach', '--force', sha).status !== 0) throw new Rifiuto('skill.err.git')
  return { dir, git }
}

/** The clone is at the approved commit and its only change is the manifest edit (the plugin code is untouched). */
function cloneIntegro(dir, git, sha, v) {
  const testa = git('rev-parse', 'HEAD')
  if (testa.status !== 0 || testa.stdout.trim() !== sha) return false
  const stato = git('status', '--porcelain')
  return stato.status === 0 && stato.stdout.split(/\r?\n/).filter(Boolean).every(r => r.slice(3) === MANIFEST_CLONE) && manifestoAmmesso(dir, git, sha, v)
}
/**
 * Revisione dell'audit 2.2.0, S1: the clone's marketplace manifest, compared as structure with the one at the approved
 * commit: the same, or the same with only `defaultEnabled: false` on the plugin's entry. Any other difference (a hook or a
 * server added to the entry, a field changed) is a refusal.
 */
function manifestoAmmesso(dir, git, sha, v) {
  try {
    const originale = git('show', `${sha}:${MANIFEST_CLONE}`)
    if (originale.status !== 0) return false
    const atteso = JSON.parse(originale.stdout)
    const ora = JSON.parse(fs.readFileSync(fileSenzaLink(dir, MANIFEST_CLONE), 'utf8'))
    if (isDeepStrictEqual(ora, atteso)) return true
    const e = Array.isArray(atteso?.plugins) ? atteso.plugins.find(x => x?.name === K.nomePlugin(v)) : undefined
    if (!oggettoPuro(e)) return false
    e.defaultEnabled = false
    return isDeepStrictEqual(ora, atteso)
  } catch {
    return false
  }
}
/** The plugin's entry in the clone's marketplace manifest (read with no link on the way), or a refusal. */
function voceClone(dir, v) {
  let m
  try { m = JSON.parse(fs.readFileSync(fileSenzaLink(dir, MANIFEST_CLONE), 'utf8')) } catch (e) {
    throw e instanceof Rifiuto ? e : new Rifiuto('skill.err.fonte')
  }
  const e = Array.isArray(m?.plugins) ? m.plugins.find(p => p?.name === K.nomePlugin(v)) : undefined
  if (m?.name !== v.marketplace || !oggettoPuro(e) || e.source !== './plugin') throw new Rifiuto('skill.err.fonte')
  return e
}

function preparaClone(v, dm, deps) {
  prerequisiti(deps)
  const sha = revisione({ ...v, pin: 'ls-remote' }, deps)
  const { dir, git } = cloneA(dm, urlDi(v), sha, deps)
  if (!cloneIntegro(dir, git, sha, v)) throw new Rifiuto('skill.err.git')
  const h = hookInstallati(v, path.join(dir, 'plugin'), voceClone(dir, v))
  if (!h) throw new Rifiuto('skill.err.hook')
  return { id: v.id, url: urlDi(v), sha, hook: h.righe, impronta: h.impronta }
}

/**
 * The guarded sequence, after the owner's first consent (the confirmation): prerequisites, the approved clone, the
 * manifest edit to `defaultEnabled: false` with the diff check, our marketplace, install (arrives disabled) and an
 * immediate disable, then the check of what is installed and the disabled record. None of its code runs here: its
 * setup (configuration and `status`) comes with the second consent (`abilita`). Any failure leaves it disabled.
 */
function installaClone(v, input, dm, deps) {
  prerequisiti(deps)
  const { dir, git } = cloneA(dm, input.url, input.sha, deps)
  // The clone's own manifest, read and written with no link anywhere between the clone and the file.
  let m
  try { m = JSON.parse(fs.readFileSync(fileSenzaLink(dir, MANIFEST_CLONE), 'utf8')) } catch (e) {
    throw e instanceof Rifiuto ? e : new Rifiuto('skill.err.fonte')
  }
  const e = Array.isArray(m?.plugins) ? m.plugins.find(p => p?.name === K.nomePlugin(v)) : undefined
  if (m?.name !== v.marketplace || !e || e.source !== './plugin') throw new Rifiuto('skill.err.fonte')
  e.defaultEnabled = false
  scriviSenzaLink(dir, MANIFEST_CLONE, `${JSON.stringify(m, null, 2)}\n`)
  if (!cloneIntegro(dir, git, input.sha, v)) throw new Rifiuto('skill.err.diff')
  const h = hookInstallati(v, path.join(dir, 'plugin'), voceClone(dir, v))
  if (h?.impronta !== input.impronta) throw new Rifiuto('skill.err.hookCambiati')
  marketplaceNostro(v, dm, deps)
  comando(deps, ['claude', 'plugin', 'install', v.plugin, '--scope', 'user'], 'skill.err.installa')
  spegniPlugin(deps, v.plugin)
  try {
    // Audit 2.2.0, point 2: no code of it runs at the first consent; the installed copy is only checked here.
    verificaInstallato(v, { sha: input.sha, impronta: input.impronta }, dm, deps)
  } catch (err) {
    spegniPlugin(deps, v.plugin)
    throw err
  }
  const r = leggiRecord(dm)
  r.voci[v.id] = { plugin: v.plugin, url: input.url, sha: input.sha, impronta: input.impronta, hook: input.hook, clone: percorsoAvanti(dir), quando: new Date().toISOString(), abilitato: false }
  scriviRecord(dm, r)
  return { id: v.id, plugin: v.plugin, sha: input.sha }
}

/**
 * The installed plugin is exactly the approved one, checked before anything of it runs or is enabled: provided by the
 * mod's own marketplace; at the approved revision (the clone's commit for TokenEconomizer, the host's record otherwise);
 * loading from where it should (in place from the clone for TokenEconomizer); and with the approved content (digest of
 * the manifest and every hook file). Throws the refusal that names what differs.
 */
function verificaInstallato(v, rec, dm, deps) {
  if (marketplace(nomeMarketplace(v), dirDellaVoce(v, dm), deps) !== 'nostro') throw new Rifiuto('skill.err.marketplace')
  const plugin = pluginInstallato(v)
  if (v.pin === 'clone') {
    const dir = dirClone(dm)
    if (!fs.existsSync(path.join(dir, '.git')) || !cloneIntegro(dir, (...a) => deps.esegui(['git', '-C', dir, ...a], { timeoutMs: 60_000 }), rec.sha, v)) throw new Rifiuto('skill.err.cambiato')
  } else if (!coincide(shaInstallato(plugin, deps), rec.sha)) throw new Rifiuto('skill.err.cambiato')
  const installato = percorsoInstallato(plugin, deps)
  if (!installato) throw new Rifiuto('skill.err.percorso')
  if (v.pin === 'clone' && path.resolve(installato) !== path.resolve(dirClone(dm), 'plugin')) throw new Rifiuto('skill.err.percorso')
  if (hookInstallati(v, installato, v.pin === 'clone' ? voceClone(dirClone(dm), v) : undefined)?.impronta !== rec.impronta) throw new Rifiuto('skill.err.hookCambiati')
}

/** Installs exactly the approved revision from the mod's local marketplace, arriving disabled (`defaultEnabled: false`). */
function installa(id, input, dm, deps) {
  const v = voce(id)
  if (input?.url !== urlDi(v) || !SHA.test(String(input?.sha)) || !IMPRONTA.test(String(input?.impronta))) throw new Rifiuto('skill.err.fonte')
  // A marketplace with our name that is not ours, or a host file we cannot read as expected, stops before any command.
  if (marketplace(nomeMarketplace(v), dirDellaVoce(v, dm), deps) === 'altro') throw new Rifiuto('skill.err.marketplace')
  // The preview the owner saw (kept for the panel) and the digest of the full content (what is compared).
  const hook = input.hook
  if (!Array.isArray(hook) || hook.length > MAX_RIGHE || !hook.every(x => typeof x === 'string' && x.length <= 200)) throw new Rifiuto('skill.err.fonte')
  if (v.pin === 'clone') return installaClone(v, input, dm, deps)
  const dir = dirMarketplace(dm)
  const f = path.join(dir, '.claude-plugin', 'marketplace.json')
  const d = require('./disco.cjs')
  d.percorsoSicuro(f)
  let m
  try { m = JSON.parse(fs.readFileSync(f, 'utf8')) } catch { m = null }
  const altri = (Array.isArray(m?.plugins) ? m.plugins : []).filter(p => p?.name !== K.nomePlugin(v) && K.SKILL_BASE.some(x => K.nomePlugin(x) === p?.name))
  const entry = { name: K.nomePlugin(v), source: { source: 'url', url: input.url, sha: input.sha }, defaultEnabled: false, description: `Baseline skill ${v.id}, approved revision` }
  fs.mkdirSync(path.dirname(f), { recursive: true })
  d.scriviAtomico(f, JSON.stringify({ name: K.MARKETPLACE_BASE, owner: { name: 'chipManager' }, plugins: [...altri, entry] }, null, 1))
  // Every command must succeed; a marketplace with our name that is not our folder stops everything.
  marketplaceNostro(v, dm, deps)
  comando(deps, ['claude', 'plugin', 'marketplace', 'update', K.MARKETPLACE_BASE], 'skill.err.marketplace')
  const plugin = K.pluginDellaMod(v)
  comando(deps, ['claude', 'plugin', 'install', plugin, '--scope', 'user'], 'skill.err.installa')
  try {
    verificaInstallato(v, { sha: input.sha, impronta: input.impronta }, dm, deps)
  } catch (err) {
    spegniPlugin(deps, plugin)
    const inst = shaInstallato(plugin, deps)
    throw err.motivo === 'skill.err.cambiato' ? new Rifiuto(inst ? 'skill.err.shaDiverso' : 'skill.err.shaNonVerificabile') : err
  }
  const r = leggiRecord(dm)
  r.voci[id] = { plugin, url: input.url, sha: input.sha, impronta: input.impronta, hook, quando: new Date().toISOString(), abilitato: false }
  scriviRecord(dm, r)
  return { id, plugin, sha: input.sha }
}

/**
 * TokenEconomizer's own setup, after the owner's second consent and the checks on the installed copy, before it is
 * enabled: its safe global configuration, read back, then `status`. The first upstream code that runs; a failure leaves
 * it disabled with the reason.
 */
function configuraClone(dm, deps) {
  const py = prerequisiti(deps)
  const te = (...a) => deps.esegui([...py, path.join(dirClone(dm), 'plugin', 'scripts', 'te_bootstrap.py'), 'cli', ...a], { timeoutMs: 60_000 })
  if (te('config', 'set', 'toolprune=propose', '--global').status !== 0 || te('config', 'set', 'loopguard=off', '--global').status !== 0)
    throw new Rifiuto('skill.err.config')
  // The settings file format is not documented: read the values back and require both, or stay off.
  const letto = te('config')
  if (letto.status !== 0 || !/toolprune\W+propose\b/i.test(letto.stdout) || !/loopguard\W+off\b/i.test(letto.stdout)) throw new Rifiuto('skill.err.config')
  if (te('--host', 'claude', 'status').status !== 0) throw new Rifiuto('skill.err.status')
}

/** Enables a mod-installed plugin only if it is still exactly the approved one; records the consent. */
function abilita(id, dm, deps) {
  const v = voce(id)
  const plugin = pluginInstallato(v)
  const r = leggiRecord(dm)
  const rec = r.voci[id]
  if (!rec || rec.plugin !== plugin || !SHA.test(String(rec.sha)) || !IMPRONTA.test(String(rec.impronta))) throw new Rifiuto('skill.err.nonApprovato')
  verificaInstallato(v, rec, dm, deps)
  if (v.pin === 'clone') configuraClone(dm, deps)
  comando(deps, ['claude', 'plugin', 'enable', plugin, '--scope', 'user'], 'skill.err.abilita', /already enabled/i)
  r.voci[id] = { ...rec, abilitato: true, abilitatoIl: new Date().toISOString() }
  scriviRecord(dm, r)
  return { id, plugin }
}

/**
 * Session start: a mod-installed plugin enabled without a matching approval (marketplace, revision, content digest and
 * the «enable» consent) is disabled and reported; nothing is ever reinstalled. The mod's plugins are those it holds a
 * record for or that come from its own marketplace: for them anything that differs or cannot be verified disables. Only
 * a plugin with neither (installed by the user) is never touched.
 */
function controlla(dm, deps) {
  const l = deps.esegui(['claude', 'plugin', 'list', '--json'], { timeoutMs: 30_000 })
  let elenco
  try { elenco = l.status === 0 ? K.pluginDa(JSON.parse(l.stdout)) : null } catch { elenco = null }
  if (!elenco) return { spenti: [], ignoto: true }
  const r = leggiRecord(dm)
  const spenti = []
  for (const v of K.SKILL_BASE) {
    const plugin = pluginInstallato(v)
    const p = elenco.find(x => x.id === plugin)
    const rec = r.voci[v.id]
    if (!p?.attivo || (!rec && marketplace(nomeMarketplace(v), dirDellaVoce(v, dm), deps) !== 'nostro')) continue
    let ok = !!rec?.abilitato && rec.plugin === plugin
    if (ok) try { verificaInstallato(v, rec, dm, deps) } catch { ok = false }
    if (ok) continue
    spegniPlugin(deps, plugin)
    spenti.push(v.id)
  }
  return { spenti }
}

function main(argv = process.argv.slice(2), deps = {}) {
  const d = { esegui: eseguiReale, ...deps }
  const dm = deps.dir ?? dirPredefinita()
  const [cmd, id] = argv
  try {
    const input = cmd === 'installa' ? JSON.parse(fs.readFileSync(0, 'utf8')) : undefined
    const out = cmd === 'prepara' ? prepara(id, dm, d) : cmd === 'installa' ? installa(id, input, dm, d) : cmd === 'abilita' ? abilita(id, dm, d) : cmd === 'controlla' ? controlla(dm, d) : cmd === 'pulisci' ? pulisci(id, dm) : null
    if (!out) return [2, JSON.stringify({ motivo: 'skill.err.comando' })]
    return [0, JSON.stringify(out)]
  } catch (e) {
    return [2, JSON.stringify({ motivo: e instanceof Rifiuto ? e.motivo : 'skill.err.inatteso' })]
  }
}
if (require.main === module) {
  const [codice, testo] = main()
  process.stdout.write(testo)
  process.exitCode = codice
}

module.exports = { main, prepara, installa, abilita, controlla, pulisci, prerequisiti, dirClone, fileSenzaLink, marketplace, hookInstallati, righeHook, shaInstallato, coincide, fileRecord, dirMarketplace, Rifiuto }
