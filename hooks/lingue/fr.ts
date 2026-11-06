// Français. Chiavi e segnaposto come in en.ts; termini comuni in glossario.md.
import type { Dizionario } from './en'

const fr: Dizionario = {
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
  // ‹fine›
}

export default fr
