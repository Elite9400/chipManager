// Português (Brasil). Chiavi e segnaposto come in en.ts; termini comuni in glossario.md.
import type { Parziale } from './en'

// Parziale finché il commit delle traduzioni non la completa: le chiavi assenti ripiegano sull'inglese.
const pt: Parziale = {
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
  "budget.esempio": "40%, 12 USD, 500 requisições",
  // Weights proposals
  // Provider limits: names, read errors, proxy states
  // Helper answers on weights proposals
  // Panel: chip states, header, summary
  "data.giorno": "{giorno} de {mese} de {anno}",
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

export default pt
