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

/** Runs argv without a shell; `.cmd` shims resolved like the main helper; `opz.env` added to the current environment. Returns { status, stdout }. */
function eseguiReale(argv, opz = {}) {
  const [eseguibile, argomenti] = require('./disco.cjs').comandoReale(argv)
  const r = spawnSync(eseguibile, argomenti, { cwd: opz.cwd, env: opz.env ? { ...process.env, ...opz.env } : undefined, encoding: 'utf8', timeout: opz.timeoutMs ?? 120_000, windowsHide: true, shell: false, maxBuffer: 2_000_000 })
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
  if (v.pin === 'tag') return revisioneTag(v, deps)
  if (v.pin !== 'ls-remote') throw new Rifiuto('skill.err.nonInstallabile')
  const r = deps.esegui(['git', 'ls-remote', urlDi(v), 'HEAD'], { timeoutMs: 30_000 })
  const sha = r.status === 0 ? r.stdout.trim().split(/\s+/)[0] : ''
  if (!SHA.test(sha)) throw new Rifiuto('skill.err.git')
  return sha
}

/**
 * F14.1: the commit of the registry's tag, read with the two exact refs `refs/tags/<nome>` and its peeled `^{}`. With an
 * expected tag object (annotated) the simple ref must be that object and the peeled ref that commit; without one
 * (lightweight) the simple ref must be the commit and there must be no peeled ref. Correction round 2, point 1: no
 * fallback from annotated to lightweight, not even on the same commit. A line for any other ref, a repeated ref or a value
 * that is not a sha is a refusal. The result is always the registry's commit: the download never uses the tag name.
 */
function revisioneTag(v, deps) {
  const t = v.tag
  if (!t || !SHA.test(t.commit) || (t.oggetto !== undefined && !SHA.test(t.oggetto))) throw new Rifiuto('skill.err.nonInstallabile')
  const ref = `refs/tags/${t.nome}`
  const r = deps.esegui(['git', 'ls-remote', urlDi(v), ref, `${ref}^{}`], { timeoutMs: 30_000 })
  if (r.status !== 0) throw new Rifiuto('skill.err.git')
  const righe = r.stdout.split(/\r?\n/).filter(Boolean).map(x => x.split('\t'))
  if (!righe.every(x => x.length === 2 && SHA.test(x[0]) && (x[1] === ref || x[1] === `${ref}^{}`))) throw new Rifiuto('skill.err.tag')
  const di = n => righe.filter(x => x[1] === n).map(x => x[0])
  const semplice = di(ref)
  const pelato = di(`${ref}^{}`)
  const ok = semplice.length === 1 && (t.oggetto !== undefined
    ? pelato.length === 1 && semplice[0] === t.oggetto && pelato[0] === t.commit
    : pelato.length === 0 && semplice[0] === t.commit)
  if (!ok) throw new Rifiuto('skill.err.tag')
  return t.commit
}

/**
 * F14.2: the skills a revision provides, by name: the folders the manifest lists under `skills`, else the default
 * `skills/<name>/SKILL.md` folders (one level). Read from the checked-out revision; a name outside [\w.-] is a refusal.
 */
function skillDa(dir) {
  let manifest = null
  try { manifest = JSON.parse(fs.readFileSync(fileSenzaLink(dir, '.claude-plugin/plugin.json'), 'utf8')) } catch { /* none: the default folders */ }
  const dichiarate = manifest && typeof manifest === 'object' && manifest.skills !== undefined ? [manifest.skills].flat() : null
  let nomi
  if (dichiarate) {
    if (!dichiarate.every(x => typeof x === 'string')) throw new Rifiuto('skill.err.hook')
    nomi = dichiarate.map(x => path.posix.basename(x.replace(/\/+$/, '')))
  } else {
    const base = path.join(dir, 'skills')
    nomi = fs.existsSync(base) ? fs.readdirSync(base).filter(n => fs.existsSync(path.join(base, n, 'SKILL.md'))).sort() : []
  }
  if (nomi.length > MAX_RIGHE || !nomi.every(n => /^[\w.-]{1,100}$/.test(n))) throw new Rifiuto('skill.err.hook')
  return nomi
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
        // RC 2.2.0, point 1: a `command` hook shows its command; any other type (http, prompt, agent…) shows every field,
        // its whole serialization: an `http` hook's address or a `prompt` hook's text is what the owner must see.
        const cosa = h?.type === 'command' && typeof h.command === 'string' ? h.command : JSON.stringify(h) ?? String(h)
        righe.push(riga(`${fonte} · ${evento}${typeof g?.matcher === 'string' && g.matcher ? ` [${g.matcher}]` : ''}: ${cosa}`))
      }
  }
  return { righe, moduli }
}
/**
 * One preview line, whole (the panel wraps it): never cut, so type, name and command always show in full. Seconda
 * revisione dell'audit 2.2.0, punto 1: a line longer than MAX_RIGA (a path or a command beyond any reasonable size) is
 * a refusal, never a shortened line.
 */
const riga = t => {
  // RC 2.2.0, points 1 and B4: nothing in a line can hide or reorder what the owner reads (INVISIBILI).
  const r = t.replace(INVISIBILI, c => `\\u{${c.codePointAt(0).toString(16)}}`)
  if (r.length > MAX_RIGA) throw new Rifiuto('skill.err.troppi')
  return r
}
const MAX_RIGA = 1000
/**
 * RC 2.2.0, review B4: what a line must never hide. Every control (Cc), format (Cf, zero-width and bidirectional marks,
 * the BOM among them), line and paragraph separator, plus the Arabic letter mark, the Mongolian vowel separator and
 * free variation selectors (U+180B-180F), the invisible operators, the Hangul fillers (U+115F, U+1160, U+3164, U+FFA0),
 * the blank Braille pattern and every variation selector (U+FE00-FE0F, U+E0100-E01EF; final audit, point 4): shown as
 * `\u{..}`.
 */
const INVISIBILI = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\p{Variation_Selector}\u061c\u115f\u1160\u180b-\u180f\u2060-\u2064\u2800\u3164\uffa0\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/gu
/** Keys a hooks file may carry next to its events. */
const CHIAVI_HOOK = new Set(['hooks', 'modules', 'description', '_comment', 'version'])

/**
 * Servers a plugin starts by itself (MCP: `{ mcpServers: {...} }` or the map itself; LSP: the map itself), one line each
 * with the whole entry serialized: `env`, `headers`, `cwd` and `type` change what runs or where it sends (final audit,
 * point 1). A server with neither a command nor (MCP) an address, or arguments that are not text, is a refusal.
 */
function righeServer(conf, fonte, tipo) {
  const mappa = tipo === 'MCP' && conf && typeof conf === 'object' && Object.hasOwn(conf, 'mcpServers') ? conf.mcpServers : conf
  if (!mappa || typeof mappa !== 'object' || Array.isArray(mappa)) throw new Rifiuto('skill.err.hook')
  return Object.entries(mappa).map(([nome, s]) => {
    if (!s || typeof s !== 'object' || Array.isArray(s)) throw new Rifiuto('skill.err.hook')
    const argomenti = s.args ?? []
    if (!Array.isArray(argomenti) || !argomenti.every(a => typeof a === 'string')) throw new Rifiuto('skill.err.hook')
    if (typeof s.command !== 'string' && !(tipo === 'MCP' && typeof s.url === 'string')) throw new Rifiuto('skill.err.hook')
    return riga(`${fonte} · ${tipo} ${nome}: ${JSON.stringify(s)}`)
  })
}

/** Background monitors: a list or a map of entries, each with its command, shown whole (its `env` too). Anything else is a refusal. */
function righeMonitor(conf, fonte) {
  const elenco = Array.isArray(conf) ? conf.map((m, i) => [m?.name ?? String(i), m])
    : conf && typeof conf === 'object' ? Object.entries(Object.hasOwn(conf, 'monitors') ? conf.monitors ?? {} : conf) : null
  if (!elenco) throw new Rifiuto('skill.err.hook')
  return elenco.map(([nome, m]) => {
    if (!m || typeof m !== 'object' || typeof m.command !== 'string') throw new Rifiuto('skill.err.hook')
    return riga(`${fonte} · monitor ${nome}: ${JSON.stringify(m)}`)
  })
}

/**
 * Manifest fields that describe the plugin or point to content that runs only when asked (commands, agents, skills,
 * styles, the settings it offers). Any other field is a component read and shown below, or a refusal.
 */
const CAMPI_INERTI = new Set(['$schema', 'name', 'displayName', 'version', 'description', 'author', 'homepage', 'repository', 'license', 'keywords',
  'metadata', 'icon', 'documentationUrl', 'supportUrl', 'privacyPolicyUrl', 'termsOfServiceUrl', 'defaultEnabled',
  'commands', 'agents', 'skills', 'outputStyles', 'types', 'userConfig', 'settings'])
/**
 * RC 2.2.0, review B2: the raw frontmatter of a skill, command or agent file, every non-empty line between the opening and
 * the closing `---`; [] when the file does not start with one. What is not certainly delimited (an opening without a
 * closing, a `---` after a BOM or blank lines) is a refusal: YAML is never parsed, the lines are shown as they are.
 */
function delimita(t) {
  const righe = t.split('\n').map(r => r.replace(/\r$/, ''))
  if (!/^---[ \t]*\r?(\n|$)/.test(t)) {
    if (/^(\ufeff|\s)*---/.test(t)) throw new Rifiuto('skill.err.hook')
    return { fm: [], corpo: 0, righe }
  }
  const fine = righe.findIndex((r, i) => i > 0 && /^---[ \t]*$/.test(r))
  if (fine < 0) throw new Rifiuto('skill.err.hook')
  return { fm: righe.slice(1, fine).filter(r => r.trim()), corpo: fine + 1, righe }
}
const frontmatter = t => delimita(t).fm
/**
 * Final audit, point 2: the dynamic context of a skill or command body, run by the host when the skill is invoked (by the
 * model too): every line with an inline `` !`cmd` `` and every ```` ```! ```` (or `~~~!`) block whole, fences included,
 * as [line number from 1, text]. An inline one with no closing backtick on its line, or a block with no closing fence of
 * the same character at least as long, cannot be delimited: a refusal.
 */
function contestoDinamico(righe, da) {
  const out = []
  for (let i = da; i < righe.length; i++) {
    const apre = /^\s*(`{3,}|~{3,})\s*!/.exec(righe[i])
    if (apre) {
      const chiude = r => r.trim().length >= apre[1].length && [...r.trim()].every(c => c === apre[1][0])
      let j = i + 1
      while (j < righe.length && !chiude(righe[j])) j++
      if (j >= righe.length) throw new Rifiuto('skill.err.hook')
      for (let k = i; k <= j; k++) out.push([k + 1, righe[k]])
      i = j
      continue
    }
    let k = righe[i].indexOf('!`')
    if (k < 0) continue
    for (; k >= 0; k = righe[i].indexOf('!`', k)) {
      k = righe[i].indexOf('`', k + 2)
      if (k < 0) throw new Rifiuto('skill.err.hook')
    }
    out.push([i + 1, righe[i]])
  }
  return out
}
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
function hookDa(v, esiste, testo, voce, elenca = () => null) {
  // RC 2.2.0, review A: this is the preview only; what the approval covers is the whole tree (alberoImpronta).
  const grezzo = p => {
    const t = testo(p)
    if (t === null) throw new Rifiuto('skill.err.hook')
    return t
  }
  const leggi = p => {
    const t = grezzo(p)
    try { return JSON.parse(t) } catch { throw new Rifiuto('skill.err.hook') }
  }
  const dentro = (base, p) => {
    // Seconda revisione dell'audit 2.2.0, punto 2: a declared path uses `/` only, on every platform. A backslash would be
    // a separator for Windows and not for the link check, so a linked folder could be skipped: it is a refusal.
    if (typeof p !== 'string' || p.includes('\\')) throw new Rifiuto('skill.err.hook')
    const r = path.posix.normalize(path.posix.join(base, p.replace(/^\.\//, '')))
    if (path.posix.isAbsolute(p) || r.startsWith('..') || !esiste(r)) throw new Rifiuto('skill.err.hook')
    return r
  }
  const righe = []
  const manifest = esiste('.claude-plugin/plugin.json') ? leggi('.claude-plugin/plugin.json') : null
  if (manifest !== null && (typeof manifest !== 'object' || Array.isArray(manifest))) throw new Rifiuto('skill.err.hook')
  if (manifest && typeof manifest.name === 'string' && manifest.name !== K.nomePlugin(v)) throw new Rifiuto('skill.err.nome')
  if (manifest && !Object.keys(manifest).every(k => CAMPI_INERTI.has(k) || COMPONENTI.some(c => c.campo === k))) throw new Rifiuto('skill.err.hook')
  if (voce !== undefined) {
    if (!oggettoPuro(voce) || !Object.keys(voce).every(k => CAMPI_VOCE.has(k) || CAMPI_INERTI.has(k) || COMPONENTI.some(c => c.campo === k))) throw new Rifiuto('skill.err.hook')
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
  // RC 2.2.0, point 5 (code.claude.com/docs/en/plugins-reference and /plugins/components): what else acts once the
  // plugin is enabled. Settings (`agent` replaces the main agent, `subagentStatusLine`), `bin/` on the Bash tool's PATH,
  // and hooks in the frontmatter of skills and commands (Claude may invoke a skill by itself; its hooks then stay for the
  // session). All read, shown and fingerprinted; a folder that cannot be listed or a shape it does not know is a refusal.
  const tutti = dir => {
    const l = elenca(dir)
    if (!Array.isArray(l) || !l.every(x => typeof x === 'string' && !x.includes('\\'))) throw new Rifiuto('skill.err.hook')
    return [...l].sort()
  }
  const agenti = []
  for (const [conf, fonte] of [[manifest?.settings, 'plugin.json'], [voce?.settings, 'marketplace.json'], ...(esiste('settings.json') ? [[leggi('settings.json'), 'settings.json']] : [])]) {
    if (conf === undefined) continue
    if (!oggettoPuro(conf)) throw new Rifiuto('skill.err.hook')
    for (const [k, x] of Object.entries(conf)) righe.push(riga(`${fonte} · settings ${k}: ${JSON.stringify(x)}`))
    if (Object.hasOwn(conf, 'agent')) agenti.push(conf.agent)
  }
  for (const f of tutti('bin')) {
    grezzo(f)
    righe.push(riga(`${f} · on the Bash PATH`))
  }
  // Final audit, point 3: a superset of what the host loads. The default folder is always read, declared paths too, and
  // file names match in any case (`skill.md`, `.MD`).
  const cartelle = (valori, predefinita) => {
    const dichiarate = valori.filter(x => x !== undefined).flatMap(x => (Array.isArray(x) ? x : [x]))
    if (!dichiarate.every(x => typeof x === 'string')) throw new Rifiuto('skill.err.hook')
    return [...new Set([predefinita, ...dichiarate.map(x => dentro('', x))])]
  }
  // RC 2.2.0, review B1 and B2: the root skill (`SKILL.md` at the plugin root) too, and every frontmatter whole.
  const visti = new Set()
  const fileSkill = [...(esiste('SKILL.md') ? ['SKILL.md'] : [])]
  for (const [dir, nome] of [...cartelle([manifest?.skills, voce?.skills], 'skills').map(d => [d, /(^|\/)skill\.md$/i]),
    ...cartelle([manifest?.commands, voce?.commands], 'commands').map(d => [d, /\.md$/i])])
    for (const f of tutti(dir)) if (nome.test(f)) fileSkill.push(f)
  for (const f of fileSkill) {
    if (visti.has(f)) continue
    visti.add(f)
    const { fm, corpo, righe: linee } = delimita(grezzo(f))
    for (const r of fm) righe.push(riga(`${f} · ${r}`))
    for (const [n, r] of contestoDinamico(linee, corpo)) righe.push(riga(`${f}:${n} · ${r}`))
  }
  // Final audit, point 3, and its review: every output style whole, frontmatter and body, every non-empty line with its
  // number. `force-for-plugin` applies one to every session and YAML spells it many ways (quoted, flow, commented), so no
  // style is told apart by reading it.
  for (const f of new Set(cartelle([manifest?.outputStyles, voce?.outputStyles], 'output-styles').flatMap(d => tutti(d).filter(x => /\.md$/i.test(x))))) {
    grezzo(f).split('\n').forEach((r, i) => {
      if (r.trim()) righe.push(riga(`${f}:${i + 1} · ${r.replace(/\r$/, '')}`))
    })
  }
  // RC 2.2.0, review B1: the agent `settings.agent` makes the main thread is shown whole (every non-empty line of its
  // file). It is found by file name, by its path under an agents folder (`a/b.md` = `a:b`) or by its frontmatter `name`;
  // an agent the plugin does not contain is a refusal.
  const fileAgenti = [...new Map(cartelle([manifest?.agents, voce?.agents], 'agents').flatMap(d => tutti(d).filter(f => /\.md$/i.test(f)).map(f => [f, d])))].map(([f, d]) => [d, f])
  for (const nomeAgente of agenti) {
    if (typeof nomeAgente !== 'string' || !nomeAgente.trim()) throw new Rifiuto('skill.err.hook')
    const scelti = fileAgenti.filter(([d, f]) => {
      const rel = f.slice(d.length + 1, -3)
      const dichiarato = frontmatter(grezzo(f)).map(r => /^name\s*:\s*["']?(.*?)["']?\s*$/.exec(r)?.[1]).find(x => x !== undefined)
      return path.posix.basename(rel) === nomeAgente || rel.replace(/\//g, ':') === nomeAgente || dichiarato === nomeAgente
    })
    if (!scelti.length) throw new Rifiuto('skill.err.hook')
    for (const [, f] of scelti) for (const r of grezzo(f).split('\n')) if (r.trim()) righe.push(riga(`${f} · ${r.replace(/\r$/, '')}`))
  }
  // `righe` is the whole preview for the confirmation.
  if (righe.length > MAX_RIGHE) throw new Rifiuto('skill.err.troppi')
  return { righe }
}

/** The host's own marks at the root of an installed plugin: `.in_use/<pid>` files and the orphan time. */
const MARCHI_HOST = new Set(['.in_use', '.orphaned_at'])
/**
 * RC 2.2.0, second review, point 1: a host mark in the exact form the host writes it (seen on the installed copies):
 * `.in_use` a real folder holding only regular files named by a pid, each `{"pid":<that pid>,"procStartFt":"<digits>"}`
 * and nothing more; `.orphaned_at` a regular file holding a time in milliseconds. Anything else under these names (a
 * link, a script, another field) is not the host's.
 */
function marchioHost(abs, nome) {
  try {
    const s = fs.lstatSync(abs)
    if (s.isSymbolicLink()) return false
    if (nome === '.orphaned_at') return s.isFile() && s.size <= 32 && /^\d{10,16}$/.test(fs.readFileSync(abs, 'utf8'))
    if (nome !== '.in_use' || !s.isDirectory()) return false
    return fs.readdirSync(abs).every(f => {
      const x = path.join(abs, f)
      const t = fs.lstatSync(x)
      if (!/^\d{1,10}$/.test(f) || t.isSymbolicLink() || !t.isFile() || t.size > 200) return false
      // Third review, point 1: the raw text, whole, in the host's exact form (keys in order, no duplicate, no spaces, no
      // other field): JSON.parse would keep the last of two `pid` and hide extra data from the fingerprint.
      const m = /^\{"pid":([1-9]\d{0,9}),"procStartFt":"(\d{1,25})"\}$/.exec(fs.readFileSync(x, 'latin1'))
      return !!m && m[1] === f
    })
  } catch {
    return false
  }
}
/**
 * RC 2.2.0, review A: the integrity fingerprint, sha256 of the whole plugin tree on disk, raw bytes: every regular file by
 * its relative path (sorted), size and content, nothing decoded or normalised. `.git` at the root is left out. A link
 * anywhere, an entry that is neither file nor folder, or a file that cannot be read is a refusal. Both sides are
 * checkouts made by git on this machine (the approved revision here, the host's install there), so line-ending
 * conversion is the same on both (test with core.autocrlf and .gitattributes). `voce`, TokenEconomizer's marketplace
 * entry, is added without `defaultEnabled` (the mod's only edit).
 * Second review: `lato` 'revisione' (the approved checkout) refuses the host marks' names outright; 'copia' (the installed
 * copy) leaves them out only in the host's exact form (marchioHost). On POSIX each file's executable bit is in the
 * fingerprint (git checks the tree mode 100755/100644 out as that bit, so the checkout and the copy carry it alike); on
 * Windows there is no such bit and it is left out on both sides. The bit is the owner's (0100), the one git reads to
 * choose 100755 or 100644 (third review, point 5). `eseguibile` only for the tests.
 */
/** The executable bit as git reads it: the owner's (0100); on Windows there is none. */
const bitEseguibile = (s, piattaforma = process.platform) => piattaforma !== 'win32' && (s.mode & 0o100) !== 0
/** A real `__pycache__` folder holding only regular `*.pyc` files (Python's byte-code cache, nothing else). */
function soloPyc(abs) {
  try {
    if (!fs.lstatSync(abs).isDirectory()) return false
    return fs.readdirSync(abs).every(f => /\.pyc$/.test(f) && fs.lstatSync(path.join(abs, f)).isFile())
  } catch {
    return false
  }
}
/**
 * `senzaPyc` only to explain a refusal (final audit review, point 2c): the same fingerprint with byte-code caches left
 * out, never to accept a copy.
 */
function alberoImpronta(root, voce, lato = 'revisione', eseguibile = s => bitEseguibile(s), senzaPyc = false) {
  const h = require('node:crypto').createHash('sha256')
  const file = []
  const giro = (abs, rel) => {
    const s = fs.lstatSync(abs)
    if (s.isSymbolicLink()) throw new Rifiuto('skill.err.percorso')
    if (s.isDirectory()) {
      for (const n of fs.readdirSync(abs)) {
        if (!rel && n === '.git') continue
        // Third review, point 4: the reserved names in any case (on Windows `.IN_USE` is `.in_use`): refused in the
        // revision; on the copy skipped only with the exact name and form the host writes, empty folders included.
        if (!rel && MARCHI_HOST.has(n.toLowerCase())) {
          if (lato === 'copia' && MARCHI_HOST.has(n) && marchioHost(path.join(abs, n), n)) continue
          throw new Rifiuto('skill.err.percorso')
        }
        if (senzaPyc && n === '__pycache__' && soloPyc(path.join(abs, n))) continue
        giro(path.join(abs, n), rel ? `${rel}/${n}` : n)
      }
    } else if (s.isFile()) file.push([rel, abs, eseguibile(s, abs)])
    else throw new Rifiuto('skill.err.percorso')
  }
  try {
    giro(path.resolve(root), '')
    file.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    for (const [rel, abs, x] of file) {
      const b = fs.readFileSync(abs)
      h.update(`f\0${rel}\0${x ? 'x' : '-'}\0${b.length}\0`)
      h.update(b)
      h.update('\0')
    }
  } catch (e) {
    throw e instanceof Rifiuto ? e : new Rifiuto('skill.err.percorso')
  }
  if (voce !== undefined) {
    const { defaultEnabled: _spento, ...resto } = voce
    h.update(`marketplace-entry\0${JSON.stringify(resto)}\0`)
  }
  return h.digest('hex')
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
  // RC 2.2.0, review A: checked out like the host checks it out, then read and fingerprinted like the installed copy.
  if (git('checkout', '-q', '--detach', '--force', sha).status !== 0) throw new Rifiuto('skill.err.git')
  return leggiPlugin(v, dir)
}

/**
 * A file under `radice` whose every component, from `radice` down to the file, is not a link (junctions included): reading
 * or writing it cannot leave `radice`. Returns the absolute path, or throws a refusal.
 */
function fileSenzaLink(radice, rel) {
  let x = path.resolve(radice)
  if (fs.lstatSync(x).isSymbolicLink()) throw new Rifiuto('skill.err.percorso')
  // Both separators, so no component of the path escapes the check (a backslash is refused earlier, this is the backstop).
  for (const parte of rel.split(/[\\/]/)) {
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

/**
 * The preview and the whole-tree fingerprint of a plugin on disk (a checked-out revision or an installed copy), or a
 * refusal that names what failed.
 */
function leggiPlugin(v, installPath, voce, lato = 'revisione') {
  if (typeof installPath !== 'string' || !path.isAbsolute(installPath)) throw new Rifiuto('skill.err.percorso')
  const dentro = p => {
    const f = path.resolve(installPath, p)
    return f.startsWith(path.resolve(installPath) + path.sep) ? f : null
  }
  // The files under `rel` (none when it is absent), with no link anywhere from the plugin root down; null = refused.
  const elenca = rel => {
    const base = dentro(rel)
    if (!base) return null
    try {
      fileSenzaLink(installPath, rel)
      if (!fs.lstatSync(base, { throwIfNoEntry: false })) return []
      const out = []
      const giro = (abs, r) => {
        const s = fs.lstatSync(abs)
        if (s.isSymbolicLink()) throw new Rifiuto('skill.err.percorso')
        if (s.isDirectory()) for (const n of fs.readdirSync(abs)) giro(path.join(abs, n), `${r}/${n}`)
        else if (s.isFile()) out.push(r)
        else throw new Rifiuto('skill.err.percorso')
      }
      giro(base, rel)
      return out
    } catch {
      return null
    }
  }
  const impronta = alberoImpronta(installPath, voce, lato)
  const { righe } = hookDa(v, p => !!dentro(p) && fs.existsSync(dentro(p)), p => {
    try { return dentro(p) ? fs.readFileSync(fileSenzaLink(installPath, p), 'utf8') : null } catch { return null }
  }, voce, elenca)
  return { righe, impronta }
}
/** The same, for a copy whose content is only compared: undefined = cannot be read (counts as different). */
function hookInstallati(v, installPath, voce) {
  try {
    return leggiPlugin(v, installPath, voce, 'copia')
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
  // RC 2.2.0: la radice è la cartella dei dati (una `.claude` collegata sopra di lei è ammessa, un link dentro no).
  d.percorsoSicuro(fileRecord(dm), [dm])
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
  // F14.2: the list the owner reads before installing comes from this revision, never from the registry.
  return { id, url: urlDi(v), sha, hook: h.righe, impronta: h.impronta, skills: skillDa(dirRevisione(dm, v.id, sha)) }
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

/**
 * Final audit review, point 2b: every Python command the mod runs for TokenEconomizer writes no byte-code cache. The
 * host's own hooks run outside the mod's control: a copy changed only by such a cache is still turned off, and the
 * start-up message says why (controlla).
 */
const SENZA_BYTECODE = Object.freeze({ PYTHONDONTWRITEBYTECODE: '1' })
/** Python ≥ 3.10 (first working of python3, python, py -3) and, on Windows, Git's `sh`: argv of the interpreter, or a refusal. */
function prerequisiti(deps) {
  const piattaforma = deps.piattaforma ?? process.platform
  let py
  for (const c of [['python3'], ['python'], ...(piattaforma === 'win32' ? [['py', '-3']] : [])]) {
    // A command that does not exist (ENOENT from the resolver) is a candidate that fails: try the next one.
    let r
    try { r = deps.esegui([...c, '--version'], { timeoutMs: 15_000, env: SENZA_BYTECODE }) } catch { continue }
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
  // Second review, point 1: the marks the host writes into the plugin it loads in place (untracked) are allowed only in
  // their exact form; any other change or untracked file is not.
  const ammessa = r => r.slice(3) === MANIFEST_CLONE ||
    (r.startsWith('?? ') && ['plugin/.in_use/', 'plugin/.orphaned_at'].includes(r.slice(3)) && marchioHost(path.join(dir, r.slice(3)), path.basename(r.slice(3))))
  return stato.status === 0 && stato.stdout.split(/\r?\n/).filter(Boolean).every(ammessa) && manifestoAmmesso(dir, git, sha, v)
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
  const h = leggiPlugin(v, path.join(dir, 'plugin'), voceClone(dir, v))
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
  if (!Array.isArray(hook) || hook.length > MAX_RIGHE || !hook.every(x => typeof x === 'string' && x.length <= MAX_RIGA)) throw new Rifiuto('skill.err.fonte')
  if (v.pin === 'clone') return installaClone(v, input, dm, deps)
  // F14.1: the tag is resolved again right before anything is written: moved, re-annotated or gone since the owner's
  // confirmation stops here; so does an approval of any commit other than the pinned one.
  if (v.pin === 'tag' && revisioneTag(v, deps) !== input.sha) throw new Rifiuto('skill.err.tag')
  const dir = dirMarketplace(dm)
  const f = path.join(dir, '.claude-plugin', 'marketplace.json')
  const d = require('./disco.cjs')
  d.percorsoSicuro(f, [dm])
  let m
  try { m = JSON.parse(fs.readFileSync(f, 'utf8')) } catch { m = null }
  const altri = (Array.isArray(m?.plugins) ? m.plugins : []).filter(p => p?.name !== K.nomePlugin(v) && K.SKILL_BASE.some(x => K.nomePlugin(x) === p?.name))
  // F14.4: the channel decides the entry's source kind; both name the approved sha, never a branch or a tag.
  const fonte = v.canale === 'github' ? { source: 'github', repo: v.repo, sha: input.sha } : { source: 'url', url: input.url, sha: input.sha }
  const entry = { name: K.nomePlugin(v), source: fonte, defaultEnabled: false, description: `Baseline skill ${v.id}, approved revision` }
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
  const te = (...a) => deps.esegui([...py, path.join(dirClone(dm), 'plugin', 'scripts', 'te_bootstrap.py'), 'cli', ...a], { timeoutMs: 60_000, env: SENZA_BYTECODE })
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
  const pyc = []
  for (const v of K.SKILL_BASE) {
    const plugin = pluginInstallato(v)
    const p = elenco.find(x => x.id === plugin)
    const rec = r.voci[v.id]
    if (!p?.attivo || (!rec && marketplace(nomeMarketplace(v), dirDellaVoce(v, dm), deps) !== 'nostro')) continue
    let ok = !!rec?.abilitato && rec.plugin === plugin
    let errore
    if (ok) try { verificaInstallato(v, rec, dm, deps) } catch (e) { ok = false; errore = e }
    if (ok) continue
    spegniPlugin(deps, plugin)
    spenti.push(v.id)
    // Final audit review, point 2c: off all the same; the message names a change made only of Python byte-code caches.
    if (errore?.motivo === 'skill.err.hookCambiati') try {
      const installato = percorsoInstallato(plugin, deps)
      if (installato && alberoImpronta(installato, v.pin === 'clone' ? voceClone(dirClone(dm), v) : undefined, 'copia', undefined, true) === rec.impronta) pyc.push(v.id)
    } catch { /* not explained: the usual message */ }
  }
  return pyc.length ? { spenti, pyc } : { spenti }
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

module.exports = { main, eseguiReale, prepara, installa, revisione, skillDa, abilita, controlla, pulisci, prerequisiti, dirClone, fileSenzaLink, marketplace, hookInstallati, alberoImpronta, bitEseguibile, hookDellaRevisione, righeHook, shaInstallato, coincide, fileRecord, dirMarketplace, Rifiuto }
