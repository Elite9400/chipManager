// Italiano. Chiavi e segnaposto come in en.ts; termini comuni in glossario.md.
import type { Dizionario } from './en'

const it: Dizionario = {
  'data.mesi': 'gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic',
  'data.formato': '{giorno} {mese}, {ora}',
  // Errors shared by the panel
  "errore.configIlleggibile": "config.json illeggibile: correggilo prima di cambiare le impostazioni",
  "errore.configCambiata": "Configurazione cambiata altrove o non scrivibile: ricarica e riprova",
  "salvato": "Salvato",
  // Settings — Language
  "imp.sezione.lingua": "Lingua",
  "imp.lingua.descrizione": "La lingua del pannello e della board, per tutti i tuoi progetti.",
  "imp.lingua.etichetta": "Lingua dell'interfaccia",
  "imp.lingua.nota": "Inglese e italiano sono scritti a mano; le altre lingue sono tradotte automaticamente. Le correzioni sono benvenute.",
  // ‹fine›
}

export default it
