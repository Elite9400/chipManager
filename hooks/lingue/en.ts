// English: the source dictionary. Its keys are the type of every other language (a missing key is a tsc error).
// Shared terms: lingue/glossario.md. Placeholders: {name}; plurals: { one, other } chosen by {n}.
export type Forme = { one: string; other: string }
export type Voce = string | Forme

const en = {
  'data.mesi': 'Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec',
  'data.formato': '{mese} {giorno}, {ora}',
  // ‹fine›
} satisfies Record<string, Voce>

export default en
export type Chiave = keyof typeof en
/** The shape every other dictionary must have: same keys, same kind (sentence or plural forms). */
export type Dizionario = { [K in Chiave]: (typeof en)[K] extends string ? string : Forme }
