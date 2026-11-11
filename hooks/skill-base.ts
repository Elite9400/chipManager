// F13.7: the baseline skills the mod recommends, explains and installs on the owner's click. Twin: strumenti/skill-base.cjs
// (parity test in prova-disco). Self-contained on purpose: the parity test imports this file directly with Node.
// The mod does not enforce skill use: it recommends, installs on click, names enabled skills in mandates, and the
// doctor flags what is missing. «Off» means not installed, proposed or named by the mod; it never disables a user's plugin.

export type RuoloSkill = 'lavoro' | 'dirigente' | 'revisore'
export type VoceSkill = {
  id: string
  /** Full plugin identity as `claude plugin list --json` reports it. */
  plugin: string
  /** Source repository (`owner/repo`), fixed here: never from settings or from an agent. */
  repo: string
  marketplace: string
  /** The skills it contains (a bundle lists several). */
  skills: readonly string[]
  /** Where data goes: `locale` = instructions only; `esterno` = sends data off the machine; `ignoto` = not verified. */
  flusso: 'locale' | 'esterno' | 'ignoto'
  /** What leaves the machine and what it costs, shown before install (English; the panel shows it as is). */
  nota: string
  /** Roles whose mandate names it; user-invoked skills are offered to the owner as commands and never named. */
  ruoli: readonly RuoloSkill[]
  utente: boolean
  sperimentale: boolean
  /** On unless the owner turns it off; experimental entries start off. */
  predefinito: boolean
}

export const SKILL_BASE: readonly VoceSkill[] = [
  { id: 'ponytail', plugin: 'ponytail@ponytail', repo: 'DietrichGebert/ponytail', marketplace: 'ponytail', skills: ['ponytail'], flusso: 'locale',
    nota: 'Instructions only: a session-start hook prints the working rules. No network, no extra cost.', ruoli: ['lavoro'], utente: false, sperimentale: false, predefinito: true },
  { id: 'superpowers', plugin: 'superpowers@claude-plugins-official', repo: 'anthropics/claude-plugins-official', marketplace: 'claude-plugins-official',
    skills: ['writing-plans', 'requesting-code-review'], flusso: 'esterno',
    nota: 'Skills and hooks; its visual companion sends telemetry as its documentation describes.', ruoli: ['dirigente', 'revisore'], utente: false, sperimentale: false, predefinito: true },
  { id: 'mattpocock-skills', plugin: 'mattpocock-skills@claude-plugins-official', repo: 'anthropics/claude-plugins-official', marketplace: 'claude-plugins-official',
    skills: ['handoff', 'grill-me', 'grilling'], flusso: 'ignoto',
    nota: 'A bundle of user-invoked skills (handoff, grill-me, grilling); data flow not verified, so it is never enabled automatically.', ruoli: [], utente: true, sperimentale: false, predefinito: true },
  { id: 'tokeneconomizer', plugin: 'tokeneconomizer@tokeneconomizer', repo: 'microsoft/TokenEconomizer', marketplace: 'tokeneconomizer', skills: ['tokeneconomizer'],
    flusso: 'esterno', nota: 'Experimental, not verified on your Claude Code version: extra claude -p calls (normally Haiku) with digests of commands, errors and file names, billed to you.',
    ruoli: ['lavoro'], utente: false, sperimentale: true, predefinito: false },
]

export const voceSkill = (id: unknown) => SKILL_BASE.find(v => v.id === id)

/** One installed plugin as `claude plugin list --json` reports it, re-read field by field. */
export type PluginInstallato = { id: string; versione?: string; scope: 'user' | 'project' | 'local' | 'managed'; attivo: boolean }

/** The baseline entries' state from `claude plugin list --json`; null = the listing is unusable (unknown, never «absent»). */
export function pluginDa(json: unknown): PluginInstallato[] | null {
  const lista = Array.isArray(json) ? json : null
  if (!lista) return null
  const out: PluginInstallato[] = []
  for (const x of lista) {
    const o = x as { id?: unknown; version?: unknown; scope?: unknown; enabled?: unknown }
    if (!o || typeof o !== 'object' || typeof o.id !== 'string' || !/^[\w.-]{1,100}@[\w.-]{1,100}$/.test(o.id) || typeof o.enabled !== 'boolean' ||
        !['user', 'project', 'local', 'managed'].includes(String(o.scope))) return null
    out.push({ id: o.id, ...(typeof o.version === 'string' && o.version.length <= 80 && { versione: o.version }), scope: o.scope as PluginInstallato['scope'], attivo: o.enabled })
  }
  return out
}

/**
 * The baseline skills a mandate may name: installed and enabled, on in the work mode (absent = the entry's default),
 * relevant to the role, never user-invoked; with `soloLocale` only local-only data flows.
 */
export function skillAttive(installati: readonly PluginInstallato[] | null, accese: Readonly<Record<string, boolean>> | undefined, ruolo: RuoloSkill, soloLocale: boolean) {
  if (!installati) return []
  return SKILL_BASE.filter(v => !v.utente && v.ruoli.includes(ruolo) && (accese?.[v.id] ?? v.predefinito) && (!soloLocale || v.flusso === 'locale') &&
    installati.some(p => p.id === v.plugin && p.attivo))
}

export const RIGA_SKILL_MAX = 200

/** The mandate line (English, ≤ 200 characters), Claude chips only; empty when no skill applies. */
export function rigaSkill(attive: readonly VoceSkill[]) {
  if (!attive.length) return ''
  const r = `Use the installed skills: ${attive.map(v => v.id).join(', ')}. They never start sessions, worktrees or reviews outside chips.`
  return r.length <= RIGA_SKILL_MAX ? r : ''
}
