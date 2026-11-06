// Português (Brasil). Chiavi e segnaposto come in en.ts; termini comuni in glossario.md.
import type { Dizionario } from './en'

const pt: Dizionario = {
  'data.mesi': 'jan.|fev.|mar.|abr.|mai.|jun.|jul.|ago.|set.|out.|nov.|dez.',
  'data.formato': '{giorno} de {mese}, {ora}',
  // Errors shared by the panel
  "errore.configIlleggibile": "Não foi possível ler config.json: corrija-o antes de alterar as configurações",
  "errore.configCambiata": "Configurações alteradas em outro lugar ou não graváveis: atualize e tente de novo",
  "salvato": "Salvo",
  // Settings — Language
  "imp.sezione.lingua": "Idioma",
  "imp.lingua.descrizione": "O idioma do painel e da board, para todos os seus projetos.",
  "imp.lingua.etichetta": "Idioma da interface",
  "imp.lingua.nota": "Inglês e italiano são escritos à mão; os outros idiomas são traduzidos automaticamente. Correções são bem-vindas.",
  // ‹fine›
}

export default pt
