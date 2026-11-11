'use strict'
// F13.7: twin of hooks/skill-base.ts (parity test in prova-disco). Same data, same functions.
// The mod does not enforce skill use: it recommends, installs on click, names enabled skills in mandates, and the
// doctor flags what is missing. «Off» means not installed, proposed or named by the mod; it never disables a user's plugin.

const SKILL_BASE = [
  { id: 'ponytail', plugin: 'ponytail@ponytail', repo: 'DietrichGebert/ponytail', pin: 'ls-remote', marketplace: 'ponytail', skills: ['ponytail'], flusso: 'locale',
    nota: 'Instructions only: a session-start hook prints the working rules. No network, no extra cost.', ruoli: ['lavoro'], utente: false, sperimentale: false, predefinito: true },
  { id: 'superpowers', plugin: 'superpowers@claude-plugins-official', repo: 'obra/superpowers', pin: 'ufficiale', marketplace: 'claude-plugins-official',
    skills: ['writing-plans', 'requesting-code-review'], flusso: 'esterno',
    nota: 'Skills and hooks; its visual companion sends telemetry as its documentation describes.', ruoli: ['dirigente', 'revisore'], utente: false, sperimentale: false, predefinito: true },
  { id: 'mattpocock-skills', plugin: 'mattpocock-skills@claude-plugins-official', repo: 'mattpocock/skills', pin: 'ufficiale', marketplace: 'claude-plugins-official',
    skills: ['handoff', 'grill-me', 'grilling'], flusso: 'ignoto',
    nota: 'A bundle of user-invoked skills (handoff, grill-me, grilling); data flow not verified, so it is never enabled automatically.', ruoli: [], utente: true, sperimentale: false, predefinito: true },
  { id: 'tokeneconomizer', plugin: 'tokeneconomizer@tokeneconomizer', repo: 'microsoft/TokenEconomizer', pin: 'clone', marketplace: 'tokeneconomizer', skills: ['tokeneconomizer'],
    flusso: 'esterno', nota: 'Experimental, not verified on your Claude Code version: extra claude -p calls (normally Haiku) with digests of commands, errors and file names, billed to you.',
    ruoli: ['lavoro'], utente: false, sperimentale: true, predefinito: false },
]

const voceSkill = id => SKILL_BASE.find(v => v.id === id)

const MARKETPLACE_BASE = 'chipmanager-base'
const nomePlugin = v => v.plugin.slice(0, v.plugin.indexOf('@'))
const pluginDellaMod = v => `${nomePlugin(v)}@${MARKETPLACE_BASE}`
const eDellaVoce = (v, id) => id === v.plugin || id === pluginDellaMod(v)


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

module.exports = { SKILL_BASE, MARKETPLACE_BASE, nomePlugin, pluginDellaMod, eDellaVoce, voceSkill, pluginDa, skillAttive, rigaSkill, RIGA_SKILL_MAX }
