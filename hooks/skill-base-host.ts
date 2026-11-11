// F13.7: the host side of the baseline skills. Detection with `claude plugin list --json` (argv, no shell; the raw output is
// never stored), and enable/disable on the owner's click for registry plugins only, always with `--scope user`.
import { atom, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'
import type { StatoSkill } from '../types'
import { conta } from './logica'
import { eDellaVoce, MARKETPLACE_BASE, pluginDa, pluginDellaMod, SKILL_BASE, voceSkill } from './skill-base'

export const statoSkill = atom({ plugin: 'chip-manager', key: 'skill' } as const, {} as StatoSkill, { shape: 'skill-1' })

/** Installed plugins, or null when the listing cannot be read (unknown, never «absent»). */
export async function leggiPlugin($: EngineInterface) {
  conta({ processi: 1 }, 'plugin-list')
  const r = await $.process.run(['claude', 'plugin', 'list', '--json'], { timeoutMs: 20_000 }).catch(() => null)
  let installati = null
  try {
    if (r && r.exitCode === 0 && !r.isStdoutTruncated) installati = pluginDa(JSON.parse(r.stdout))
  } catch { /* unreadable: unknown */ }
  await update($, statoSkill, s => ({ ...s, installati, quando: new Date().toISOString() }))
  return installati
}

/** Runs `strumenti/skill-installa.cjs`: exit 0 = JSON result, exit 2 = { motivo: <dictionary code> }, else unknown. */
export async function helperSkill($: EngineInterface, argv: string[], stdin?: string): Promise<{ ok: true; dati: Record<string, unknown> } | { ok: false; motivo: string }> {
  conta({ processi: 1 }, `skill-${argv[0]}`)
  const r = await $.process.run(['node', `${$.plugin.root.replace(/\\/g, '/')}/strumenti/skill-installa.cjs`, ...argv], { stdin: stdin ?? '', timeoutMs: 600_000 }).catch(() => null)
  let j: Record<string, unknown> = {}
  try { j = JSON.parse(r?.stdout ?? '') as Record<string, unknown> } catch { /* unreadable */ }
  if (r?.exitCode === 0 && !r.isStdoutTruncated) return { ok: true, dati: j }
  return { ok: false, motivo: typeof j.motivo === 'string' && /^skill\.err\.\w+$/.test(j.motivo) ? j.motivo : 'skill.err.inatteso' }
}

/**
 * Install at the approved revision, only on the owner's click: the helper resolves the revision and reads the hooks it
 * declares; `conferma` shows source, commit, data flow and hooks and must say yes; then the install, which arrives disabled.
 */
export async function installaSkill($: EngineInterface, id: string, conferma: (d: { url: string; sha: string; hook: string[] }) => Promise<boolean>,
  /** Re-read right before installing: a policy that changed while the confirmation was open stops it (reason as a code). */
  ancoraAmmessa: () => Promise<string | undefined> = async () => undefined) {
  const v = voceSkill(id)
  if (!v) throw new Error('skill.err.nonInstallabile')
  const p = await helperSkill($, ['prepara', id])
  // The downloaded revision is only for reading its hooks: it goes once the owner has decided (or the preparation failed).
  const pulisci = () => helperSkill($, ['pulisci', id]).catch(() => undefined)
  if (!p.ok) {
    await pulisci()
    throw new Error(p.motivo)
  }
  const url = String(p.dati.url ?? '')
  const sha = String(p.dati.sha ?? '')
  const hook = Array.isArray(p.dati.hook) ? p.dati.hook.filter((x): x is string => typeof x === 'string').slice(0, 60) : []
  const impronta = typeof p.dati.impronta === 'string' && /^[0-9a-f]{64}$/.test(p.dati.impronta) ? p.dati.impronta : ''
  if (!(await conferma({ url, sha, hook }))) {
    await pulisci()
    return false
  }
  const no = await ancoraAmmessa()
  if (no) {
    await pulisci()
    throw new Error(no)
  }
  // Exactly what the owner approved: url, sha, the digest of the full content and the preview shown; never re-derived.
  const i = await helperSkill($, ['installa', id], JSON.stringify({ url, sha, impronta, hook }))
  await pulisci()
  await leggiPlugin($)
  if (!i.ok) throw new Error(i.motivo)
  return true
}

/**
 * Session start (second belt after `defaultEnabled: false`): runs when a plugin the mod may have installed is enabled — any
 * `@chipmanager-base` id, or TokenEconomizer, which keeps its upstream id. Whether it is really the mod's (its marketplace)
 * is the helper's check: a TokenEconomizer the user installed is left alone there.
 */
export async function controllaApprovate($: EngineInterface) {
  const installati = await leggiPlugin($)
  const daControllare = (id: string) => id.endsWith(`@${MARKETPLACE_BASE}`) || SKILL_BASE.some(v => v.pin === 'clone' && v.plugin === id)
  if (!installati?.some(p => daControllare(p.id) && p.attivo)) return []
  const r = await helperSkill($, ['controlla'])
  await leggiPlugin($)
  return r.ok && Array.isArray(r.dati.spenti) ? r.dati.spenti.filter((x): x is string => typeof x === 'string') : []
}

/**
 * Enable or disable one baseline plugin, only after the owner's click. A plugin installed in a managed scope is locked:
 * it is shown as such and nothing runs. Then the listing is read again. `soloLocale` is read again right before the
 * command: `true` (or unknown, when the rules cannot be read) blocks turning on a plugin that is not local-only, also
 * when the policy changed while the consent question was open. A plugin the mod installed is enabled through the helper,
 * which checks the installed revision against the approved one and records the consent.
 */
export async function cambiaPlugin($: EngineInterface, id: string, attiva: boolean, soloLocale: () => Promise<boolean>, consenso: (nota: string) => Promise<boolean>) {
  const v = voceSkill(id)
  if (!v) throw new Error('not a baseline skill')
  // F13.7 r1.3: a plugin that is not local-only is never turned on from a local-only project, and needs its own consent.
  if (attiva && v.flusso !== 'locale') {
    if (await soloLocale()) throw new Error('local-only project')
    if (!(await consenso(v.nota))) return
    if (await soloLocale()) throw new Error('local-only project')
  }
  const ora = await leggiPlugin($)
  const p = ora?.find(x => eDellaVoce(v, x.id))
  if (!p) throw new Error('not installed')
  if (p.scope === 'managed') throw new Error('locked by managed policy')
  // TokenEconomizer keeps its upstream id: enabling it from the mod always goes through the helper's approval checks.
  if (attiva && (p.id === pluginDellaMod(v) || v.pin === 'clone')) {
    const r = await helperSkill($, ['abilita', id])
    await leggiPlugin($)
    if (!r.ok) throw new Error(r.motivo)
    return
  }
  conta({ processi: 1 }, 'plugin-cambia')
  const r = await $.process.run(['claude', 'plugin', attiva ? 'enable' : 'disable', p.id, '--scope', 'user'], { timeoutMs: 30_000 })
  await leggiPlugin($)
  if (r.exitCode !== 0) throw new Error('plugin command failed')
}
