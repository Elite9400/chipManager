// Deutsch. Chiavi e segnaposto come in en.ts; termini comuni in glossario.md.
import type { Dizionario } from './en'

const de: Dizionario = {
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
  // ‹fine›
}

export default de
