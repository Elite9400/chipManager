// F13.7: the baseline skills the mod recommends, explains and installs on the owner's click. Twin: strumenti/skill-base.cjs
// (parity test in prova-disco). Self-contained on purpose: the parity test imports this file directly with Node.
// The mod does not enforce skill use: it recommends, installs on click, names enabled skills in mandates, and the
// doctor flags what is missing. «Off» means not installed, proposed or named by the mod; it never disables a user's plugin.

export type RuoloSkill = 'lavoro' | 'dirigente' | 'revisore'
export type VoceSkill = {
  id: string
  /** Full plugin identity as `claude plugin list --json` reports it. */
  plugin: string
  /** Source repository of the plugin code (`owner/repo`), fixed here: never from settings or from an agent. */
  repo: string
  /**
   * How the approved revision is found: `ls-remote` = the head of `repo`; `ufficiale` = the `source.sha` of the official
   * marketplace entry (its url must be `repo`); `clone` = TokenEconomizer's own procedure (not installed by the mod yet);
   * `tag` (F14.1) = the commit a tag of `repo` points to, checked against `tag` before the download and again before install.
   */
  pin: 'ls-remote' | 'ufficiale' | 'clone' | 'tag'
  /**
   * F14.1, with `pin: 'tag'` only: the tag name, the commit it must resolve to and, for an annotated tag, its tag object.
   * With `oggetto` only an annotated tag with that very object is accepted; without it, only a lightweight tag.
   */
  tag?: { nome: string; commit: string; oggetto?: string }
  marketplace: string
  /** F14.4: how the mod's local marketplace points at the code: a git `url`, a `github` repository, or TokenEconomizer's own clone. */
  canale: 'url' | 'github' | 'clone'
  /** Skills known by name; the full list shown before install is read from the approved revision (F14.2). */
  skills: readonly string[]
  /**
   * F14.1: hooks that run by themselves in every session and change behaviour everywhere in the user scope once enabled;
   * the enable consent says so and lists what the hook commands need on the machine.
   */
  avvio?: { requisiti: readonly string[] }
  /** F14.3: the skill (of this plugin) that configures a repository; the mod proposes it once per repository as a chip. */
  setup?: string
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

export const voceSkill = (id: unknown) => SKILL_BASE.find(v => v.id === id)

/** The mod's own local marketplace: plugins installed by the mod at an approved revision get this suffix. */
export const MARKETPLACE_BASE = 'chipmanager-base'
/** The plugin name (before `@`) and the id it has when the mod installed it. */
export const nomePlugin = (v: VoceSkill) => v.plugin.slice(0, v.plugin.indexOf('@'))
export const pluginDellaMod = (v: VoceSkill) => `${nomePlugin(v)}@${MARKETPLACE_BASE}`
/** Either identity counts: installed by the user from upstream, or by the mod from its local marketplace. */
export const eDellaVoce = (v: VoceSkill, id: string) => id === v.plugin || id === pluginDellaMod(v)

/** F14.3: the slash command (without the slash) that sets a repository up, as the host lists it; undefined = none. */
export const comandoSetup = (v: VoceSkill) => (v.setup ? `${nomePlugin(v)}:${v.setup}` : undefined)
/**
 * F14.3: the fixed id of an entry's setup chip in one project (`repo` as the panel names the project): FNV-1a 64 over the
 * UTF-16 code units of `<id>\n<repo>`. The same project always gets the same chip, so a second proposal is a CAS conflict.
 */
export function idSetup(v: VoceSkill, repo: string) {
  let h = 0xcbf29ce484222325n
  const testo = `${v.id}\n${repo}`
  for (let i = 0; i < testo.length; i++) h = ((h ^ BigInt(testo.charCodeAt(i))) * 0x100000001b3n) & 0xffffffffffffffffn
  return `a-set${h.toString(16).padStart(16, '0')}`
}

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
    installati.some(p => eDellaVoce(v, p.id) && p.attivo))
}

export const RIGA_SKILL_MAX = 200

/** The mandate line (English, ≤ 200 characters), Claude chips only; empty when no skill applies. */
export function rigaSkill(attive: readonly VoceSkill[]) {
  if (!attive.length) return ''
  const r = `Use the installed skills: ${attive.map(v => v.id).join(', ')}. They never start sessions, worktrees or reviews outside chips.`
  return r.length <= RIGA_SKILL_MAX ? r : ''
}
