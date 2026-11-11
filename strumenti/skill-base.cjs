'use strict'
// F13.7: twin of hooks/skill-base.ts (parity test in prova-disco). Same data, same functions.
// The mod does not enforce skill use: it recommends, installs on click, names enabled skills in mandates, and the
// doctor flags what is missing. «Off» means not installed, proposed or named by the mod; it never disables a user's plugin.

const SKILL_BASE = [
  { id: 'ponytail', plugin: 'ponytail@ponytail', repo: 'DietrichGebert/ponytail', pin: 'ls-remote', marketplace: 'ponytail', canale: 'url', skills: ['ponytail'], flusso: 'locale',
    nota: 'Instructions only: a session-start hook prints the working rules. No network, no extra cost.', ruoli: ['lavoro'], utente: false, sperimentale: false, predefinito: true },
  { id: 'superpowers', plugin: 'superpowers@claude-plugins-official', repo: 'obra/superpowers', pin: 'ufficiale', marketplace: 'claude-plugins-official', canale: 'url',
    skills: ['writing-plans', 'requesting-code-review'], flusso: 'esterno',
    nota: 'Skills and hooks; its visual companion sends telemetry as its documentation describes.', ruoli: ['dirigente', 'revisore'], utente: false, sperimentale: false, predefinito: true },
  { id: 'mattpocock-skills', plugin: 'mattpocock-skills@claude-plugins-official', repo: 'mattpocock/skills', pin: 'ufficiale', marketplace: 'claude-plugins-official', canale: 'url',
    skills: ['setup-matt-pocock-skills'], flusso: 'ignoto', setup: 'setup-matt-pocock-skills',
    nota: 'The full set of user-invoked skills, as listed by the approved revision; data flow not verified, so it is never enabled automatically. Its setup runs once per repository as a chip.',
    ruoli: [], utente: true, sperimentale: false, predefinito: true },
  { id: 'tokeneconomizer', plugin: 'tokeneconomizer@tokeneconomizer', repo: 'microsoft/TokenEconomizer', pin: 'clone', marketplace: 'tokeneconomizer', canale: 'clone', skills: ['tokeneconomizer'],
    flusso: 'esterno', nota: 'Experimental, not verified on your Claude Code version: extra claude -p calls (normally Haiku) with digests of commands, errors and file names, billed to you.',
    ruoli: ['lavoro'], utente: false, sperimentale: true, predefinito: false },
  // F14.1: pinned by the annotated tag v4.1.0 (object and commit both checked); its own marketplace is `caveman`.
  { id: 'caveman', plugin: 'caveman@caveman', repo: 'JuliusBrussee/caveman', pin: 'tag',
    tag: { nome: 'v4.1.0', commit: '1e91f1306d602d4ca23618701b1185575ae1869b', oggetto: '5831edc2f57b6c4a274dcc9e2e433988d97eb23d' },
    marketplace: 'caveman', canale: 'github', skills: ['caveman'], flusso: 'esterno', avvio: { requisiti: ['node', 'sh', 'sed', 'printf'] },
    nota: 'Compressed answers. Its caveman-compress skill sends file text to your configured model provider, rewrites the file and keeps backups outside the repository. Never its CLI or installers.',
    ruoli: ['lavoro'], utente: false, sperimentale: false, predefinito: true },
]

const voceSkill = id => SKILL_BASE.find(v => v.id === id)

const MARKETPLACE_BASE = 'chipmanager-base'
const nomePlugin = v => v.plugin.slice(0, v.plugin.indexOf('@'))
const pluginDellaMod = v => `${nomePlugin(v)}@${MARKETPLACE_BASE}`
const eDellaVoce = (v, id) => id === v.plugin || id === pluginDellaMod(v)

const comandoSetup = v => (v.setup ? `${nomePlugin(v)}:${v.setup}` : undefined)
/** F14.3: FNV-1a 64 over the UTF-16 code units of `<id>\n<repo>` (same as the TS twin). */
function idSetup(v, repo) {
  let h = 0xcbf29ce484222325n
  const testo = `${v.id}\n${repo}`
  for (let i = 0; i < testo.length; i++) h = ((h ^ BigInt(testo.charCodeAt(i))) * 0x100000001b3n) & 0xffffffffffffffffn
  return `a-set${h.toString(16).padStart(16, '0')}`
}


/** The baseline entries' state from `claude plugin list --json`; null = the listing is unusable (unknown, never «absent»). */
function pluginDa(json) {
  const lista = Array.isArray(json) ? json : null
  if (!lista) return null
  const out = []
  for (const x of lista) {
    const o = x
    if (!o || typeof o !== 'object' || typeof o.id !== 'string' || !/^[\w.-]{1,100}@[\w.-]{1,100}$/.test(o.id) || typeof o.enabled !== 'boolean' ||
        !['user', 'project', 'local', 'managed'].includes(String(o.scope))) return null
    out.push({ id: o.id, ...(typeof o.version === 'string' && o.version.length <= 80 && { versione: o.version }), scope: o.scope, attivo: o.enabled })
  }
  return out
}

/**
 * The baseline skills a mandate may name: installed and enabled, on in the work mode (absent = the entry's default),
 * relevant to the role, never user-invoked; with `soloLocale` only local-only data flows.
 */
function skillAttive(installati, accese, ruolo, soloLocale) {
  if (!installati) return []
  return SKILL_BASE.filter(v => !v.utente && v.ruoli.includes(ruolo) && (accese?.[v.id] ?? v.predefinito) && (!soloLocale || v.flusso === 'locale') &&
    installati.some(p => eDellaVoce(v, p.id) && p.attivo))
}

const RIGA_SKILL_MAX = 200

/** The mandate line (English, ≤ 200 characters), Claude chips only; empty when no skill applies. */
function rigaSkill(attive) {
  if (!attive.length) return ''
  const r = `Use the installed skills: ${attive.map(v => v.id).join(', ')}. They never start sessions, worktrees or reviews outside chips.`
  return r.length <= RIGA_SKILL_MAX ? r : ''
}

module.exports = { SKILL_BASE, MARKETPLACE_BASE, nomePlugin, pluginDellaMod, eDellaVoce, comandoSetup, idSetup, voceSkill, pluginDa, skillAttive, rigaSkill, RIGA_SKILL_MAX }
