// Español. Chiavi e segnaposto come in en.ts; termini comuni in glossario.md.
import type { Dizionario } from './en'

const es: Dizionario = {
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
  // ‹fine›
}

export default es
