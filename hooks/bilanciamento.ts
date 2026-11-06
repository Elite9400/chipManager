// Logica pura delle Impostazioni (piano grafica, C2 con §9 righe 4, 5 e 7 e §10): profili di bilanciamento, regolazioni
// a cinque posizioni, soglie, budget manuali e simulazione della scelta. Niente `$`: i test la provano senza engine.
import type { Azione, Chiamante, Fornitore, Limite, Peso, Regole, RisorseProgetto, Soglia } from '../types'
import { bilancia, profiloDi, violazioniAvvio } from './logica'

export type Profilo = NonNullable<RisorseProgetto['profilo']>

// --- regolazioni a cinque posizioni --------------------------------------------------------------------

/** Le cinque posizioni di una regolazione: `percentuale` del peso, `assoluto` sempre 0. «Molto meno» non esclude. */
export const POSIZIONI = [
  { nome: 'Molto meno (non esclude)', percentuale: -90 },
  { nome: 'Meno', percentuale: -40 },
  { nome: 'Normale', percentuale: 0 },
  { nome: 'Più', percentuale: 40 },
  { nome: 'Preferisci', percentuale: 100 },
] as const
const NORMALE = 2

/** La posizione di un peso, -1 se è fuori dalle cinque (personalizzato: si mostra intero e resta intatto). Assente = Normale. */
export function posizioneDi(p: Peso | undefined) {
  if (!p) return NORMALE
  return p.assoluto === 0 ? POSIZIONI.findIndex(x => x.percentuale === p.percentuale) : -1
}

/** Come si legge un peso fuori dalle cinque posizioni: entrambi i componenti, con il segno. */
export const pesoScritto = (p: Peso) => `personalizzato (${p.percentuale >= 0 ? '+' : ''}${p.percentuale}% · ${p.assoluto >= 0 ? '+' : ''}${p.assoluto})`

/** I pesi con la voce `tipo:nome` alla posizione `i`; Normale toglie la voce. Le altre voci restano come sono. */
export function conPosizione(pesi: readonly Peso[], tipo: Peso['tipo'], nome: string, i: number): Peso[] {
  const pos = POSIZIONI[i]
  if (!pos) throw new Error('posizione non valida')
  const altri = pesi.filter(p => p.tipo !== tipo || p.nome !== nome)
  return i === NORMALE ? altri : [...altri, { tipo, nome, percentuale: pos.percentuale, assoluto: 0 }]
}

// --- profili ------------------------------------------------------------------------------------------

const peso = (tipo: Peso['tipo'], nome: string, i: number): Peso => ({ tipo, nome, percentuale: POSIZIONI[i]!.percentuale, assoluto: 0 })

/**
 * Insiemi fissi di pesi su motori ed effort, mai sui modelli: l'ordine di routing.json non dice nulla sulle capacità.
 * Automatico = nessuna preferenza fissa, decide il margine dei limiti. Personalizzato non ha pesi propri.
 */
export const PROFILI: readonly { id: Profilo; nome: string; descrizione: string; pesi?: readonly Peso[] }[] = [
  { id: 'automatico', nome: 'Automatico', descrizione: 'Nessuna preferenza fissa: decide il margine dei limiti.', pesi: [] },
  {
    id: 'risparmio', nome: 'Risparmio', descrizione: 'Preferisce Codex ed effort bassi.',
    pesi: [peso('fornitore', 'codex', 3), peso('effort', 'low', 3), peso('effort', 'high', 1), peso('effort', 'xhigh', 0)],
  },
  {
    id: 'qualita', nome: 'Qualità', descrizione: 'Preferisce effort alti.',
    pesi: [peso('effort', 'xhigh', 4), peso('effort', 'high', 3), peso('effort', 'medium', 1), peso('effort', 'low', 0)],
  },
  {
    id: 'velocita', nome: 'Velocità', descrizione: 'Preferisce effort bassi, per risposte rapide.',
    pesi: [peso('effort', 'low', 4), peso('effort', 'medium', 3), peso('effort', 'high', 1), peso('effort', 'xhigh', 0)],
  },
  { id: 'personalizzato', nome: 'Personalizzato', descrizione: 'Si attiva da solo appena tocchi una regolazione.' },
]

/** I pesi dopo la scelta di un profilo: quelli di motori ed effort diventano i suoi, quelli dei modelli restano intatti. */
export function conProfilo(pesi: readonly Peso[], profilo: Profilo): Peso[] {
  const p = PROFILI.find(x => x.id === profilo)
  if (!p) throw new Error('profilo non valido')
  if (!p.pesi) return [...pesi]
  return [...pesi.filter(x => x.tipo === 'modello'), ...p.pesi]
}

// Una sola risoluzione del profilo: sta in logica (la usa `punteggio`), qui solo riesportata.
export { profiloDi }

// --- soglie -------------------------------------------------------------------------------------------

export const SOGLIE_PRESET: readonly { valore: string; testo: string; soglia: Soglia | null }[] = [
  { valore: '60/80', testo: '60/80', soglia: { attenzione: 60, critica: 80 } },
  { valore: '70/90', testo: '70/90 (predefinita)', soglia: { attenzione: 70, critica: 90 } },
  { valore: '80/95', testo: '80/95', soglia: { attenzione: 80, critica: 95 } },
  { valore: 'nessuna', testo: 'Nessuna', soglia: null },
]

/** Il preset di una soglia, '' se è personale (resta così com'è). */
export const presetDi = (s: Soglia | null) =>
  SOGLIE_PRESET.find(p => (p.soglia === null ? s === null : !!s && p.soglia.attenzione === s.attenzione && p.soglia.critica === s.critica))?.valore ?? ''

/** Le soglie con quella di `f` cambiata. Vale lo stesso vincolo della lettura: numeri finiti da 1 a 100, attenzione sotto la critica. */
export function conSoglia(soglie: RisorseProgetto['soglie'], f: Fornitore, s: Soglia | null): RisorseProgetto['soglie'] {
  const ok = (n: number) => typeof n === 'number' && Number.isFinite(n) && n >= 1 && n <= 100
  if (s && (!ok(s.attenzione) || !ok(s.critica))) throw new Error('Le soglie vanno da 1 a 100')
  if (s && s.attenzione >= s.critica) throw new Error(`Attenzione (${s.attenzione}%) deve stare sotto la critica (${s.critica}%)`)
  return { ...soglie, [f]: s }
}

// --- budget manuali -----------------------------------------------------------------------------------

export const TIPI_BUDGET = ['giornaliero', 'settimanale', 'mensile'] as const
const UNITA: Record<string, NonNullable<Limite['unita']>> = { usd: 'USD', eur: 'EUR', cny: 'CNY', richieste: 'richieste', token: 'token' }

/** «40» o «40%» = quota; «12 USD», «500 richieste», «1000 token» = valore. Restituisce il motivo se non si legge. */
export function budgetDa(testo: string): Pick<Limite, 'percentuale' | 'valore' | 'unita'> | string {
  const m = testo.trim().replace(',', '.').match(/^(\d+(?:\.\d+)?)\s*(%|[a-z]+)?$/i)
  if (!m) return 'Scrivi un numero con l\'unità: 40%, 12 USD, 500 richieste'
  const n = Number(m[1])
  const u = (m[2] ?? '%').toLowerCase()
  if (u === '%') return n <= 100 ? { percentuale: n, unita: '%' } : 'Una percentuale va da 0 a 100'
  if (!UNITA[u]) return `Unità sconosciuta «${m[2]}»: %, USD, EUR, CNY, richieste o token`
  return n <= 1e12 ? { valore: n, unita: UNITA[u] } : 'Valore troppo grande'
}

/** Il budget manuale nuovo, nella forma del config. `adesso` in ms. */
export function nuovoBudget(f: Fornitore, tipo: string, misura: Pick<Limite, 'percentuale' | 'valore' | 'unita'>, adesso: number) {
  return { id: `${f}-${tipo}-${adesso.toString(36)}`.slice(0, 60), fornitore: f, nome: tipo, letto: new Date(adesso).toISOString(), ...misura }
}

/** I budget letti, riportati alla forma del config: senza il prefisso `manuale-` che aggiunge la lettura e senza i campi derivati. */
export const manualiDaScrivere = (limiti: readonly Limite[]) =>
  limiti.map(l => ({
    id: l.id.replace(/^manuale-/, ''), fornitore: l.fornitore, nome: l.nome, letto: l.letto, unita: l.unita,
    ...(l.percentuale !== undefined && { percentuale: l.percentuale }),
    ...(l.valore !== undefined && { valore: l.valore }),
  }))

// --- simulazione --------------------------------------------------------------------------------------

/**
 * Dove andrebbe una nuova proposta R2 senza scelte di motore, modello ed effort, con le regole di adesso. Stessa
 * strada della creazione (`bilancia`), poi la guardia d'avvio: se nessuna combinazione passa, i motivi.
 */
export function simula(r: Regole, limiti: readonly Limite[], lista: readonly Azione[], chi: Chiamante | null) {
  const ora = new Date(0).toISOString()
  const esempio: Azione = {
    id: 'a-simulata', versione: 0, repo: chi?.repo ?? undefined, titolo: 'Proposta d\'esempio', brief: 'Simulazione del bilanciamento.',
    ordine: 0, dipende: [], esecutore: 'claude', revisore: 'codex', corsia: 'R2', stato: 'proposta', creata: ora, aggiornata: ora, // record nuovo, solo in memoria
  }
  const scelta = chi ? bilancia(esempio, {}, r, limiti, lista, chi) : esempio
  const motivi = violazioniAvvio(scelta, r, lista, chi)
  return motivi.length ? { motivi } : { scelta }
}
