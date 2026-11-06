// Español. Chiavi e segnaposto come in en.ts; termini comuni in glossario.md.
import type { Parziale } from './en'

// Parziale finché il commit delle traduzioni non la completa: le chiavi assenti ripiegano sull'inglese.
const es: Parziale = {
  'data.mesi': 'ene|feb|mar|abr|may|jun|jul|ago|sept|oct|nov|dic',
  'data.formato': '{giorno} {mese}, {ora}',
  // Errors shared by the panel
  "errore.configIlleggibile": "No se puede leer config.json: corrígelo antes de cambiar los ajustes",
  "errore.configCambiata": "Ajustes cambiados en otro lugar o no se pueden escribir: actualiza y reinténtalo",
  "salvato": "Guardado",
  // Settings — Language
  "imp.sezione.lingua": "Idioma",
  "imp.lingua.descrizione": "El idioma del panel y de la board, para todos tus proyectos.",
  "imp.lingua.etichetta": "Idioma de la interfaz",
  "imp.lingua.nota": "El inglés y el italiano están escritos a mano; los demás idiomas son traducciones automáticas. Se agradecen las correcciones.",
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
  "budget.esempio": "40%, 12 USD, 500 solicitudes",
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


  // ‹fine›
}

export default es
