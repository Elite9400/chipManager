// F11.4: il rapporto per migliorare chipManager. Solo codici ed elenchi chiusi: versione della mod e dell'host, superficie,
// FORMA delle impostazioni (nomi dei campi noti e tipi, mai valori), codici dei rilievi del doctor. Nessun testo libero,
// nessun nome di progetto, percorso, contenuto, chiave o dato dell'account: quello che non è in un elenco qui non esce.

/** I codici che il doctor sa dire (gli stessi della pagina Doctor). */
export const RILIEVI = ['config.illeggibile', 'config.senzaCopie', 'config.campoIgnoto', 'config.nonValido', 'config.restrizioneLarga', 'config.modoNonValido',
  'percorso.config', 'percorso.dati', 'percorso.macchina', 'percorso.registro', 'registro.sviluppo', 'lock.api', 'lock.apiIlleggibile', 'chiavi.residue',
  'azioni.orfane', 'azioni.progettiIgnoti', 'accesso.claude', 'accesso.codex', 'accesso.github', 'host.impostazioniApi', 'host.advisor', 'host.versione', 'host.claudeCode', 'connessione']
const CAMPI_ACCOUNT = ['soglie', 'limitiManuali', 'apiClaude', 'freellmapi', 'modoLavoro', 'compatibili']
const CAMPI_PROGETTO = ['fornitori', 'soloLocale', 'milestoneGithub', 'pesi', 'limitiManuali', 'freellmapi', 'board', 'soglie', 'profilo', 'apiClaude', 'consigliere',
  'restrizioni', 'modoLavoro', 'compatibili']
const SUPERFICI = ['desktop', 'terminal', 'vscode', 'mobile']

export const REPO_RAPPORTI = 'Elite9400/chipManager'
export const TITOLO_RAPPORTO = 'chipManager report: doctor findings'
/** Oltre questa lunghezza l'URL precompilato non si apre: solo il testo da copiare. */
export const MAX_URL = 7000

const tipo = (v: unknown) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v === 'object' ? 'object' : typeof v === 'number' ? 'number' : typeof v === 'boolean' ? 'boolean' : 'string')
const forma = (o: unknown, campi: readonly string[]) =>
  (o && typeof o === 'object' && !Array.isArray(o) ? campi.filter(k => Object.hasOwn(o, k) && (o as Record<string, unknown>)[k] !== undefined).map(k => `${k}:${tipo((o as Record<string, unknown>)[k])}`) : []).join(', ') || 'none'
const versione = (s: unknown) => (typeof s === 'string' && /^\d{1,4}\.\d{1,4}\.\d{1,5}(-dev)?$/.test(s) ? s : 'unknown')

/** Il testo del rapporto, riga per riga da elenchi chiusi. */
export function rapportoRedatto(d: { versione: unknown; superficie: unknown; host?: unknown; account?: unknown; progetto?: unknown; codici: readonly unknown[] }) {
  const codici = [...new Set(d.codici.filter((c): c is string => typeof c === 'string' && RILIEVI.includes(c)))].sort()
  return [
    '### chipManager report',
    `- mod: ${versione(d.versione)}`,
    `- surface: ${typeof d.superficie === 'string' && SUPERFICI.includes(d.superficie) ? d.superficie : 'unknown'}`,
    `- host: ${versione(d.host)}`,
    `- account shape: ${forma(d.account, CAMPI_ACCOUNT)}`,
    `- project shape: ${forma(d.progetto, CAMPI_PROGETTO)}`,
    `- doctor findings: ${codici.join(', ') || 'none'}`,
  ].join('\n')
}

/** L'URL del nuovo issue precompilato, o undefined se troppo lungo (allora solo il testo da copiare). */
export function urlRapporto(testo: string) {
  const u = `https://github.com/${REPO_RAPPORTI}/issues/new?title=${encodeURIComponent(TITOLO_RAPPORTO)}&body=${encodeURIComponent(testo)}`
  return u.length <= MAX_URL ? u : undefined
}
