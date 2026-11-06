// Français. Chiavi e segnaposto come in en.ts; termini comuni in glossario.md.
import type { Parziale } from './en'

// Parziale finché il commit delle traduzioni non la completa: le chiavi assenti ripiegano sull'inglese.
const fr: Parziale = {
  'data.mesi': 'janv.|févr.|mars|avr.|mai|juin|juil.|août|sept.|oct.|nov.|déc.',
  'data.formato': '{giorno} {mese}, {ora}',
  // Errors shared by the panel
  "errore.configIlleggibile": "config.json illisible : corrigez-le avant de modifier les réglages",
  "errore.configCambiata": "Réglages modifiés ailleurs ou impossibles à écrire : actualisez et réessayez",
  "salvato": "Enregistré",
  // Settings — Language
  "imp.sezione.lingua": "Langue",
  "imp.lingua.descrizione": "La langue du panneau et de la board, pour tous vos projets.",
  "imp.lingua.etichetta": "Langue de l'interface",
  "imp.lingua.nota": "L'anglais et l'italien sont rédigés à la main ; les autres langues sont traduites automatiquement. Les corrections sont les bienvenues.",
  // Start rules (why a chip cannot start as it is)
  // Why a chip waits in the queue
  // Start: confirmations and errors

  // Local configuration (config.json)
  // Plan file of a chip
  // Records on disk
  // Permission modes
  // Durations and this session's usage
  // Sessions without a title


  // Balancing: positions, profiles, thresholds, budgets
  "budget.esempio": "40%, 12 USD, 500 requêtes",
  // Weights proposals
  // Provider limits: names, read errors, proxy states
  // Helper answers on weights proposals
  // ‹fine›
}

export default fr
