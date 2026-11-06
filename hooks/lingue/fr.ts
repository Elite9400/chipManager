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
  // Panel: chip states, header, summary
  "data.giorno": "{giorno} {mese} {anno}",
  // Work view: chip editor
  // Work view: chip card
  // Work view: sessions at work
  // Work view: milestones
  // Work view: sections, filter, empty states
  // Load view
  // Settings: sections
  // Settings: connections
  // Settings: thresholds
  // Settings: balancing
  // Settings: project
  // Settings: board
  // Settings: advanced


  // Project board (HTML page)
  // Helper answers on board, plans and git
  // Errors shown in the panel notice
  // Errors saved on a chip
  // Session notes, popups and toasts

  // ‹fine›
}

export default fr
