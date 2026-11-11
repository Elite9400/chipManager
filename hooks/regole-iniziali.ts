// Default project rules for a repository without routing.json, built only from what the mod already knows, and the first
// section that keeps an existing routing.json from counting as read. Pure: no I/O; the panel shows the text before writing.
import { EFFORT, REGOLE_DEFAULT, RISORSE_DEFAULT } from './logica'

const COORDINATORE = 'claude-sonnet-5-5'
const OPUS = 'claude-opus-5-5'
const FABLE = 'claude-fable-5-2'

/**
 * The reviewers of a Claude author, in the order the mod uses them: the first Claude one reviews ordinary work, the
 * sensitive reviewer (Fable 5.2, or Opus for a Fable author: revisoreConcreto) is always in the row, Codex last.
 */
function revisoriDi(autore: string, claude: readonly string[], codex: boolean) {
  const fable = autore.startsWith('claude-fable-')
  const primo = fable ? OPUS : autore === OPUS ? FABLE : OPUS
  const sensibile = fable ? OPUS : FABLE
  return [...new Set([primo, sensibile])].filter(m => m !== autore && claude.includes(m)).concat(codex ? ['motore:codex'] : [])
}

/** The rules as an object: models and caps from the mod's own lists, Codex only on R1–R3 with a Claude coordinator. */
export function regoleIniziali() {
  const claude = REGOLE_DEFAULT.modelli.claude
  const codex = REGOLE_DEFAULT.modelli.codex
  const corsie = REGOLE_DEFAULT.corsiaCodex.corsie
  const effort = RISORSE_DEFAULT.modoLavoro.effortPredefinito
  return {
    _nota: 'Default rules created by chipManager. Edit them to suit the project; R4 and R5 stay with Claude and are always reviewed.',
    versione: 1,
    modelli_ammessi: [...claude, ...codex],
    effort_ammessi: [...EFFORT],
    tetto_per_modello: { ...REGOLE_DEFAULT.tetto },
    revisione: {
      revisori_ammessi_per_autore: Object.fromEntries([
        ...claude.map(m => [m, revisoriDi(m, claude, codex.length > 0)]),
        // A Codex author is reviewed by the lane's Claude coordinator (corsia_codex.rivisto_da).
        ...codex.map(m => [m, [COORDINATORE, OPUS]]),
      ]),
    },
    corsia_codex: {
      modelli: [...codex],
      esegue: { corsie: [...corsie] },
      effort: Object.fromEntries(corsie.map(c => [c, effort[c as keyof typeof effort]])),
      rivisto_da: Object.fromEntries(corsie.map(c => [c, c === 'R3' ? OPUS : COORDINATORE])),
    },
  }
}

/** The exact text written to disk (and shown in the confirmation). */
export const testoRegoleIniziali = () => `${JSON.stringify(regoleIniziali(), null, 2)}\n`

/**
 * The first section that regoleDa needs and does not find in a routing.json, by its path in the file; undefined when the
 * file has them all. Mirrors the `lette` condition of regoleDa: a change there is a change here.
 */
export function campoRegoleMancante(json: unknown): string | undefined {
  const r = (json && typeof json === 'object' && !Array.isArray(json) ? json : {}) as Record<string, unknown>
  const lista = (v: unknown) => Array.isArray(v) && v.every(x => typeof x === 'string')
  const mappa = (v: unknown) => !!v && typeof v === 'object' && Object.entries(v).some(([k, x]) => !k.startsWith('_') && typeof x === 'string')
  const rev = (r.revisione as Record<string, unknown> | undefined)?.revisori_ammessi_per_autore
  const cc = (r.corsia_codex ?? {}) as Record<string, unknown>
  if (!lista(r.modelli_ammessi)) return 'modelli_ammessi'
  if (!lista(r.effort_ammessi) || !(r.effort_ammessi as string[]).some(e => e !== 'max')) return 'effort_ammessi'
  if (!rev || typeof rev !== 'object' || !Object.values(rev).some(lista)) return 'revisione.revisori_ammessi_per_autore'
  if (!lista((cc.esegue as Record<string, unknown> | undefined)?.corsie)) return 'corsia_codex.esegue.corsie'
  if (!lista(cc.modelli)) return 'corsia_codex.modelli'
  if (!mappa(cc.effort)) return 'corsia_codex.effort'
  if (!mappa(cc.rivisto_da)) return 'corsia_codex.rivisto_da'
  return undefined
}
