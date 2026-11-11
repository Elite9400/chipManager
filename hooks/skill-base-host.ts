// F13.7: the host side of the baseline skills. Detection with `claude plugin list --json` (argv, no shell; the raw output is
// never stored), and enable/disable on the owner's click for registry plugins only, always with `--scope user`.
import { atom, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'
import type { StatoSkill } from '../types'
import { conta } from './logica'
import { pluginDa, voceSkill } from './skill-base'

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

/**
 * Enable or disable one baseline plugin, only after the owner's click. A plugin installed in a managed scope is locked:
 * it is shown as such and nothing runs. Then the listing is read again.
 */
export async function cambiaPlugin($: EngineInterface, id: string, attiva: boolean, soloLocale: boolean, consenso: (nota: string) => Promise<boolean>) {
  const v = voceSkill(id)
  if (!v) throw new Error('not a baseline skill')
  // F13.7 r1.3: a plugin that is not local-only is never turned on from a local-only project, and needs its own consent.
  if (attiva && v.flusso !== 'locale') {
    if (soloLocale) throw new Error('local-only project')
    if (!(await consenso(v.nota))) return
  }
  const ora = await leggiPlugin($)
  const p = ora?.find(x => x.id === v.plugin)
  if (!p) throw new Error('not installed')
  if (p.scope === 'managed') throw new Error('locked by managed policy')
  conta({ processi: 1 }, 'plugin-cambia')
  const r = await $.process.run(['claude', 'plugin', attiva ? 'enable' : 'disable', v.plugin, '--scope', 'user'], { timeoutMs: 30_000 })
  await leggiPlugin($)
  if (r.exitCode !== 0) throw new Error('plugin command failed')
}
