// F13.4: the panel's Help. One line per lane stays in the panel (needed to read chips); everything else lives on the
// documentation site. Twin of the whitelist in strumenti/disco.cjs (`apri-pagina`), parity test in prova-disco.

/** The site pages, in reading order. Exact names: the URL is built only from this list. */
export const PAGINE_AIUTO = ['index', 'quick-start', 'panel', 'chips', 'lanes', 'models', 'settings', 'doctor', 'board', 'agents', 'faq'] as const
export type PaginaAiuto = (typeof PAGINE_AIUTO)[number]

export const SITO_AIUTO = 'https://elite9400.github.io/chipManager/site/'
export const urlAiuto = (p: PaginaAiuto) => `${SITO_AIUTO}${p}.html`

/**
 * GitHub Pages needs the owner's yes at release (F13 r1.10). Until it is on, Help shows each address as copyable text and
 * opens nothing; switching this to true is the only change needed after publishing.
 */
export const SITO_PUBBLICATO = false

/**
 * RC 2.2.0: until the site is published, «Knowledgebase» opens the copy installed with the plugin. The panel sends only
 * this token: the helper knows the one file it may open (`<plugin>/docs/site/index.html`, twin in strumenti/disco.cjs).
 */
export const KNOWLEDGEBASE_LOCALE = 'knowledgebase-locale'
/** What «Knowledgebase» asks the helper to open: the published home page, or the local copy by its token. */
export const destinazioneKnowledgebase = (pubblicato: boolean) => (pubblicato ? urlAiuto('index') : KNOWLEDGEBASE_LOCALE)

/** The lane lines kept in the dictionaries (`legenda.r0`–`legenda.r5`). */
export const RIGHE_CORSIE = ['legenda.r0', 'legenda.r1', 'legenda.r2', 'legenda.r3', 'legenda.r4', 'legenda.r5'] as const
