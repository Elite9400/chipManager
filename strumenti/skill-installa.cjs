'use strict'
// F13.7: install baseline skills at an approved revision, on the owner's click. Every command is argv with no shell, every
// source comes from the registry (skill-base.cjs), never from settings or an agent.
//
//   node skill-installa.cjs prepara <id>     approved revision (sha) + the hooks it declares, read from that revision
//   node skill-installa.cjs installa <id>    stdin { url, sha } = what the owner approved: local marketplace, install, sha check
//   node skill-installa.cjs abilita <id>     enable a plugin the mod installed, only if the installed revision is the approved one
//   node skill-installa.cjs controlla        disable any mod-installed plugin enabled without a matching approval record
//
// Exit 0 with JSON on stdout; exit 2 with { motivo: <code> } for a refusal (codes are the panel's dictionary keys).
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const K = require('./skill-base.cjs')

const SHA = /^[0-9a-f]{40}$/
const dirPredefinita = () => path.join(os.homedir(), '.claude', 'chipmanager')
const fileRecord = dm => path.join(dm, 'skill-approvate.json')
const dirMarketplace = dm => path.join(dm, 'skill', 'marketplace')
const dirRevisione = (dm, id, sha) => path.join(dm, 'skill', 'revisioni', `${id}-${sha}`)
const urlDi = v => `https://github.com/${v.repo}.git`
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

/** One hooks configuration ({ hooks: { Event: [...] } } or the event map itself) as short readable lines. */
function righeHook(conf, fonte) {
  const eventi = conf && typeof conf === 'object' && conf.hooks && typeof conf.hooks === 'object' && !Array.isArray(conf.hooks) ? conf.hooks : conf
  if (!eventi || typeof eventi !== 'object' || Array.isArray(eventi)) throw new Rifiuto('skill.err.hook')
  const righe = []
  for (const [evento, gruppi] of Object.entries(eventi)) {
    if (!Array.isArray(gruppi)) throw new Rifiuto('skill.err.hook')
    for (const g of gruppi)
      for (const h of Array.isArray(g?.hooks) ? g.hooks : [g]) {
        const cosa = h?.type === 'command' && typeof h.command === 'string' ? h.command : String(h?.type ?? '?')
        righe.push(`${fonte} · ${evento}${typeof g?.matcher === 'string' && g.matcher ? ` [${g.matcher}]` : ''}: ${cosa}`.replace(/[\x00-\x1f]/g, ' ').slice(0, 200))
      }
  }
  return righe
}

/**
 * Fetches the approved revision read-only into the data folder and lists every hook it declares: the manifest's `hooks`
 * (inline or file paths), the conventional `hooks/hooks.json`. A declared file that cannot be read blocks the install.
 */
function hookDellaRevisione(v, sha, dm, deps) {
  const dir = dirRevisione(dm, v.id, sha)
  fs.mkdirSync(dir, { recursive: true })
  const git = (...a) => deps.esegui(['git', '-C', dir, ...a], { timeoutMs: 120_000 })
  if (!fs.existsSync(path.join(dir, '.git')) && deps.esegui(['git', 'init', '-q', dir]).status !== 0) throw new Rifiuto('skill.err.git')
  if (git('fetch', '-q', '--depth', '1', '--no-tags', urlDi(v), sha).status !== 0) throw new Rifiuto('skill.err.git')
  const esiste = p => git('cat-file', '-e', `${sha}:${p}`).status === 0
  const leggi = p => {
    const r = git('show', `${sha}:${p}`)
    if (r.status !== 0) throw new Rifiuto('skill.err.hook')
    try { return JSON.parse(r.stdout) } catch { throw new Rifiuto('skill.err.hook') }
  }
  const righe = []
  const manifest = esiste('.claude-plugin/plugin.json') ? leggi('.claude-plugin/plugin.json') : null
  if (manifest && typeof manifest.name === 'string' && manifest.name !== K.nomePlugin(v)) throw new Rifiuto('skill.err.nome')
  const dichiarati = manifest?.hooks === undefined ? [] : Array.isArray(manifest.hooks) ? manifest.hooks : [manifest.hooks]
  for (const h of dichiarati) {
    if (typeof h === 'string') {
      const p = path.posix.normalize(h.replace(/^\.\//, ''))
      if (p.startsWith('..') || path.posix.isAbsolute(p) || !esiste(p)) throw new Rifiuto('skill.err.hook')
      righe.push(...righeHook(leggi(p), p))
    } else righe.push(...righeHook(h, 'plugin.json'))
  }
  if (esiste('hooks/hooks.json') && !dichiarati.includes('./hooks/hooks.json') && !dichiarati.includes('hooks/hooks.json')) righe.push(...righeHook(leggi('hooks/hooks.json'), 'hooks/hooks.json'))
  return righe.slice(0, 60)
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

/** The installed revision, as the host records it (`gitCommitSha`, or a 12-character `version`); undefined = cannot verify. */
function shaInstallato(plugin, deps) {
  const f = deps.installati ?? path.join(process.env.CLAUDE_CODE_PLUGIN_CACHE_DIR ?? path.join(os.homedir(), '.claude', 'plugins'), 'installed_plugins.json')
  try {
    const j = JSON.parse(fs.readFileSync(f, 'utf8'))
    const voci = (j.plugins ?? j)[plugin]
    const u = Array.isArray(voci) ? voci.find(x => x?.scope === 'user') : undefined
    if (u && SHA.test(String(u.gitCommitSha))) return { pieno: u.gitCommitSha }
    if (u && /^[0-9a-f]{12}$/.test(String(u.version))) return { corto: u.version }
  } catch { /* unreadable: cannot verify */ }
  return undefined
}
const coincide = (inst, sha) => !!inst && (inst.pieno ? inst.pieno === sha : sha.startsWith(inst.corto))

function voce(id) {
  const v = K.voceSkill(id)
  if (!v || v.pin === 'clone') throw new Rifiuto('skill.err.nonInstallabile')
  return v
}

function prepara(id, dm, deps) {
  const v = voce(id)
  const sha = revisione(v, deps)
  return { id, url: urlDi(v), sha, hook: hookDellaRevisione(v, sha, dm, deps) }
}

/** Installs exactly the approved revision from the mod's local marketplace, arriving disabled (`defaultEnabled: false`). */
function installa(id, input, dm, deps) {
  const v = voce(id)
  if (input?.url !== urlDi(v) || !SHA.test(String(input?.sha))) throw new Rifiuto('skill.err.fonte')
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
  const claude = (...a) => deps.esegui(['claude', 'plugin', ...a], { timeoutMs: 300_000 })
  // Adding a marketplace that is already known fails harmlessly; the install below is what must succeed.
  claude('marketplace', 'add', dir, '--scope', 'user')
  claude('marketplace', 'update', K.MARKETPLACE_BASE)
  const plugin = K.pluginDellaMod(v)
  if (claude('install', plugin, '--scope', 'user').status !== 0) throw new Rifiuto('skill.err.installa')
  const inst = shaInstallato(plugin, deps)
  if (!coincide(inst, input.sha)) {
    claude('disable', plugin, '--scope', 'user')
    throw new Rifiuto(inst ? 'skill.err.shaDiverso' : 'skill.err.shaNonVerificabile')
  }
  const r = leggiRecord(dm)
  r.voci[id] = { plugin, url: input.url, sha: input.sha, quando: new Date().toISOString(), abilitato: false }
  scriviRecord(dm, r)
  return { id, plugin, sha: input.sha }
}

/** Enables a mod-installed plugin only if the installed revision is still the approved one; records the consent. */
function abilita(id, dm, deps) {
  const v = voce(id)
  const plugin = K.pluginDellaMod(v)
  const r = leggiRecord(dm)
  const rec = r.voci[id]
  if (!rec || rec.plugin !== plugin || !SHA.test(String(rec.sha))) throw new Rifiuto('skill.err.nonApprovato')
  if (!coincide(shaInstallato(plugin, deps), rec.sha)) throw new Rifiuto('skill.err.cambiato')
  const e = deps.esegui(['claude', 'plugin', 'enable', plugin, '--scope', 'user'], { timeoutMs: 60_000 })
  if (e.status !== 0 && !/already enabled/i.test(e.stdout)) throw new Rifiuto('skill.err.abilita')
  r.voci[id] = { ...rec, abilitato: true, abilitatoIl: new Date().toISOString() }
  scriviRecord(dm, r)
  return { id, plugin }
}

/** Session start: a mod-installed plugin enabled without a matching approval (sha + «enable» consent) is disabled. */
function controlla(dm, deps) {
  const l = deps.esegui(['claude', 'plugin', 'list', '--json'], { timeoutMs: 30_000 })
  let elenco
  try { elenco = l.status === 0 ? K.pluginDa(JSON.parse(l.stdout)) : null } catch { elenco = null }
  if (!elenco) return { spenti: [], ignoto: true }
  const r = leggiRecord(dm)
  const spenti = []
  for (const v of K.SKILL_BASE) {
    const plugin = K.pluginDellaMod(v)
    const p = elenco.find(x => x.id === plugin)
    if (!p?.attivo) continue
    const rec = r.voci[v.id]
    if (rec?.abilitato && rec.plugin === plugin && coincide(shaInstallato(plugin, deps), rec.sha)) continue
    deps.esegui(['claude', 'plugin', 'disable', plugin, '--scope', 'user'], { timeoutMs: 60_000 })
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
    const out = cmd === 'prepara' ? prepara(id, dm, d) : cmd === 'installa' ? installa(id, input, dm, d) : cmd === 'abilita' ? abilita(id, dm, d) : cmd === 'controlla' ? controlla(dm, d) : null
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

module.exports = { main, prepara, installa, abilita, controlla, righeHook, shaInstallato, coincide, fileRecord, dirMarketplace, Rifiuto }
