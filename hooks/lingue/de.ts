// Deutsch. Chiavi e segnaposto come in en.ts; termini comuni in glossario.md.
import type { Parziale } from './en'

// Parziale finché il commit delle traduzioni non la completa: le chiavi assenti ripiegano sull'inglese.
const de: Parziale = {
  'data.mesi': 'Jan.|Feb.|März|Apr.|Mai|Juni|Juli|Aug.|Sept.|Okt.|Nov.|Dez.',
  'data.formato': '{giorno}. {mese}, {ora}',
  // Errors shared by the panel
  "errore.configIlleggibile": "config.json nicht lesbar: vor dem Ändern der Einstellungen reparieren",
  "errore.configCambiata": "Einstellungen anderswo geändert oder nicht schreibbar: aktualisieren und erneut versuchen",
  "salvato": "Gespeichert",
  // Settings — Language
  "imp.sezione.lingua": "Sprache",
  "imp.lingua.descrizione": "Die Sprache des Panels und der Board, für alle deine Projekte.",
  "imp.lingua.etichetta": "Sprache der Oberfläche",
  "imp.lingua.nota": "Englisch und Italienisch sind von Hand geschrieben, die anderen Sprachen maschinell übersetzt. Korrekturen sind willkommen.",
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
  "budget.esempio": "40%, 12 USD, 500 Anfragen",
  // Weights proposals
  // Provider limits: names, read errors, proxy states
  // Helper answers on weights proposals
  // Panel: chip states, header, summary
  "data.giorno": "{giorno}. {mese} {anno}",
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
  // ‹fine›
}

export default de
