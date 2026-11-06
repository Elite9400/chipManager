// Logica pura delle Impostazioni (piano grafica, C2 con §9 righe 4, 5 e 7 e §10): profili di bilanciamento, regolazioni
// a cinque posizioni, soglie, budget manuali e simulazione della scelta. Niente `$`: i test la provano senza engine.
import type { Azione, Chiamante, Fornitore, Limite, Peso, PesiProfilo, PropostaPesi, Regolazione, Regole, RisorseProgetto, SessioneProgetto, Soglia } from '../types'
import { bilancia, effortDi, modelloDi, nomeModello, pesoValido, profiloDi, violazioniAvvio } from './logica'

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

// --- proposte di pesi (F4) ----------------------------------------------------------------------------
// Una sessione del progetto propone, il committente decide dal pannello. Qui solo logica pura: validazione degli
// argomenti, risultato atteso, lettura del file dell'helper, testi e dati per `risorse_agenti`.

const MOTORI_NOMI: Record<string, string> = { claude: 'Claude', codex: 'Codex', freellmapi: 'FreeLLMAPI' }
const nomeProfilo = (p: PesiProfilo['profilo']) => PROFILI.find(x => x.id === p)?.nome ?? 'nessun profilo'
const testoVoce = (tipo: Peso['tipo'], nome: string) => (tipo === 'fornitore' ? MOTORI_NOMI[nome] ?? nome : tipo === 'modello' ? nomeModello(nome) : `effort ${nome}`)
const idBreve = (id: string) => id.replace(/^local_/, '').slice(0, 8)

/** I testi delle proposte di pesi, raccolti qui (il multilingua li sposterà nei dizionari). */
export const TESTI_PESI = {
  intestazione: 'Pesi',
  rivedi: 'Rivedi',
  applica: 'Applica',
  rifiuta: 'Rifiuta',
  apri: 'Apri le impostazioni',
  annulla: 'Annulla',
  chi: (p: PropostaPesi) => `«${p.proponente.titolo || 'sessione senza titolo'}» (${idBreve(p.proponente.id)})`,
  riga: (p: PropostaPesi) => `Proposta di pesi da ${TESTI_PESI.chi(p)}: ${riassuntoProposta(p)}`,
  domanda: (p: PropostaPesi) =>
    `La sessione ${TESTI_PESI.chi(p)} propone:\n\n${descriviPesi(p.partenza)}\n→ ${descriviPesi(p.risultato)}\n\nMotivo: ${p.motivo}\n\nApplico?`,
  registrata: (id: string, scadute: readonly string[]) =>
    `Proposta registrata (id ${id}): la decide il committente dal pannello.` +
    (scadute.length ? ` Scadute per far posto (più di 3 in attesa): ${scadute.join(', ')}.` : ''),
  applicata: 'Pesi applicati',
  rifiutata: 'Proposta rifiutata',
  annullata: 'Pesi ripristinati',
  registro: (p: PropostaPesi, adesso = Date.now()) => {
    const quando = (iso: string) => new Date(iso).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    const stato = statoVisto(p, adesso)
    const parola = { attesa: 'In attesa', applicata: 'Applicata', rifiutata: 'Rifiutata', scaduta: 'Scaduta', annullata: 'Annullata' }[stato]
    return `${parola} il ${quando(new Date(decisaIl(p, adesso)).toISOString())}, proposta da ${TESTI_PESI.chi(p)}: ${riassuntoProposta(p)}`
  },
  nessunaDecisione: 'Nessuna proposta di pesi decisa.',
  titoloRegistro: 'Ultima proposta di pesi',
  titoloInAttesa: 'Proposte di pesi da decidere',
} as const

/** Profilo e pesi a parole: «Risparmio · Codex Più · effort xhigh Molto meno (non esclude)». */
export function descriviPesi(s: PesiProfilo) {
  const pesi = s.pesi.map(p => {
    const i = posizioneDi(p)
    return `${testoVoce(p.tipo, p.nome)} ${i < 0 ? pesoScritto(p) : POSIZIONI[i]!.nome}`
  })
  return [nomeProfilo(s.profilo), ...(pesi.length ? pesi : ['nessun peso'])].join(' · ')
}

/** Che cosa chiede una proposta, in breve: il profilo e le regolazioni. */
export const riassuntoProposta = (p: Pick<PropostaPesi, 'profilo' | 'regolazioni'>) =>
  [...(p.profilo ? [nomeProfilo(p.profilo)] : []), ...(p.regolazioni ?? []).map(x => `${testoVoce(x.tipo, x.nome)} ${POSIZIONI[x.posizione]?.nome ?? '?'}`)].join(' · ')

const SCADENZA_PROPOSTA = 24 * 3_600_000
/** In attesa e non ancora scaduta (l'helper la segna scaduta alla prossima operazione). */
export const daDecidere = (p: PropostaPesi, adesso: number) => p.stato === 'attesa' && adesso - Date.parse(p.quando) <= SCADENZA_PROPOSTA
/**
 * Lo stato da mostrare: una voce ancora «attesa» nel file ma oltre le 24 ore è già scaduta (l'helper la segna alla
 * prossima operazione). Stessa regola per righe, registro e `risorse_agenti`.
 */
export const statoVisto = (p: PropostaPesi, adesso: number): PropostaPesi['stato'] => (p.stato === 'attesa' && !daDecidere(p, adesso) ? 'scaduta' : p.stato)
/** Quando la voce è stata decisa (o annullata, o è scaduta): ordina il registro. */
export const decisaIl = (p: PropostaPesi, adesso: number) =>
  Date.parse(p.annullamento?.quando ?? p.decisione?.quando ?? p.quando) + (p.stato === 'attesa' && statoVisto(p, adesso) === 'scaduta' ? SCADENZA_PROPOSTA : 0)
/** Annullabile solo se il config porta ancora la revisione e l'origine di quella applicazione. */
export const annullabile = (p: PropostaPesi, r: RisorseProgetto) =>
  p.stato === 'applicata' && !!p.decisione && r.pesiRevisione === p.decisione.revisione && r.pesiOrigine?.id === p.decisione.id

/** Le voci regolabili per tipo: le stesse delle Impostazioni (motori e modelli ammessi, effort di routing.json). */
export function vociRegolabili(r: Regole): Record<Peso['tipo'], string[]> {
  const motori = (['claude', 'codex', 'freellmapi'] as const).filter(m => r.risorse.fornitori.includes(m))
  return { fornitore: [...motori], modello: motori.flatMap(m => r.modelli[m]), effort: [...r.effort] }
}

/**
 * Gli argomenti di `proponi_pesi`, validati al confine, e il risultato che avrebbe applicarli adesso. Mai pesi
 * grezzi: solo un profilo e posizioni 0–4 su voci ammesse. Una regolazione rende il profilo Personalizzato, come
 * nelle Impostazioni.
 */
export function propostaDa(args: Record<string, unknown>, r: Regole): string | { motivo: string; profilo?: Profilo; regolazioni?: Regolazione[]; risultato: PesiProfilo } {
  const ignoti = Object.keys(args).filter(k => !['profilo', 'regolazioni', 'motivo'].includes(k))
  if (ignoti.length) return `campi non ammessi: ${ignoti.join(', ')} (solo profilo, regolazioni e motivo)`
  const motivo = typeof args.motivo === 'string' ? args.motivo.trim() : ''
  if (!motivo || motivo.length > 300) return 'motivo: obbligatorio, fino a 300 caratteri'
  const profilo = args.profilo as Profilo | undefined
  if (profilo !== undefined && !PROFILI.some(p => p.id === profilo)) return `profilo: uno fra ${PROFILI.map(p => p.id).join(', ')}`
  let regolazioni: Regolazione[] | undefined
  if (args.regolazioni !== undefined) {
    if (!Array.isArray(args.regolazioni) || !args.regolazioni.length || args.regolazioni.length > 30) return 'regolazioni: da 1 a 30 voci'
    const ammesse = vociRegolabili(r)
    regolazioni = []
    for (const x of args.regolazioni as unknown[]) {
      const v = x as Record<string, unknown>
      if (!v || typeof v !== 'object' || Object.keys(v).some(k => !['tipo', 'nome', 'posizione'].includes(k))) return 'regolazioni: ogni voce è { tipo, nome, posizione }'
      if (!['fornitore', 'modello', 'effort'].includes(String(v.tipo))) return 'regolazioni: tipo fornitore, modello o effort'
      const tipo = v.tipo as Peso['tipo']
      if (typeof v.nome !== 'string' || !ammesse[tipo].includes(v.nome)) return `regolazioni: «${String(v.nome)}» non è un ${tipo} ammesso (${ammesse[tipo].join(', ') || 'nessuno'})`
      if (!Number.isInteger(v.posizione) || (v.posizione as number) < 0 || (v.posizione as number) > 4) return 'regolazioni: posizione da 0 (Molto meno) a 4 (Preferisci)'
      if (regolazioni.some(y => y.tipo === tipo && y.nome === v.nome)) return `regolazioni: ${tipo} «${v.nome}» ripetuto`
      regolazioni.push({ tipo, nome: v.nome, posizione: v.posizione as number })
    }
  }
  if (!profilo && !regolazioni) return 'serve un profilo, delle regolazioni o entrambi'
  let pesi = profilo ? conProfilo(r.risorse.pesi, profilo) : [...r.risorse.pesi]
  for (const x of regolazioni ?? []) pesi = conPosizione(pesi, x.tipo, x.nome, x.posizione)
  const risultato: PesiProfilo = { profilo: regolazioni ? 'personalizzato' : profilo!, pesi }
  // Il confronto è con il profilo in vigore: «automatico» su un config senza profilo né pesi non cambia nulla.
  if (risultato.profilo === profiloDi(r.risorse) && JSON.stringify(pesi) === JSON.stringify(r.risorse.pesi)) return 'la proposta non cambia nulla rispetto alla configurazione attuale'
  return { motivo, ...(profilo && { profilo }), ...(regolazioni && { regolazioni }), risultato }
}

const testoCorto = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : undefined)
const istanteOk = (v: unknown) => typeof v === 'string' && Number.isFinite(Date.parse(v))
const pesiProfiloDa = (v: unknown): PesiProfilo | undefined => {
  const s = v as Record<string, unknown> | null
  if (!s || typeof s !== 'object' || !Array.isArray(s.pesi) || !s.pesi.every(pesoValido)) return undefined
  const profilo = s.profilo === null ? null : PROFILI.some(p => p.id === s.profilo) ? (s.profilo as Profilo) : undefined
  return profilo === undefined ? undefined : { profilo, pesi: s.pesi as Peso[] }
}

/** Le proposte di `repo` dal file dell'helper, dalla più recente: una voce di forma sconosciuta si salta. */
export function proposteDa(json: unknown, repo: string | null): PropostaPesi[] {
  const voci = (json as { voci?: unknown } | null)?.voci
  if (!repo || !Array.isArray(voci)) return []
  return voci
    .flatMap((x): PropostaPesi[] => {
      const v = x as Record<string, unknown>
      if (!v || typeof v !== 'object' || v.progetto !== repo || typeof v.id !== 'string' || !/^p-[a-z0-9]{6,40}$/.test(v.id) || !Number.isInteger(v.versione)) return []
      const chi = v.proponente as Record<string, unknown> | undefined
      const partenza = pesiProfiloDa(v.partenza)
      const risultato = pesiProfiloDa(v.risultato)
      const rev = (v.partenza as { revisione?: unknown } | undefined)?.revisione
      if (!chi || typeof chi.id !== 'string' || !istanteOk(v.quando) || typeof v.motivo !== 'string' || !partenza || !risultato || !Number.isInteger(rev) ||
          !['attesa', 'applicata', 'rifiutata', 'scaduta', 'annullata'].includes(String(v.stato))) return []
      const regolazioni = Array.isArray(v.regolazioni)
        ? (v.regolazioni as Regolazione[]).filter(r => r && ['fornitore', 'modello', 'effort'].includes(r.tipo) && typeof r.nome === 'string' && Number.isInteger(r.posizione)).slice(0, 30)
        : undefined
      // Lo stato di una proposta di pesi, non di un'azione: niente transizione().
      const stato = v.stato as PropostaPesi['stato']
      const d = v.decisione as PropostaPesi['decisione'] | undefined
      const u = v.annullamento as PropostaPesi['annullamento'] | undefined
      return [{
        id: v.id, versione: v.versione as number, progetto: repo,
        proponente: { id: chi.id.slice(0, 200), titolo: testoCorto(chi.titolo, 80) ?? '' },
        quando: v.quando as string, motivo: v.motivo.slice(0, 300),
        ...(PROFILI.some(p => p.id === v.profilo) && { profilo: v.profilo as Profilo }), ...(regolazioni && { regolazioni }),
        partenza: { ...partenza, revisione: rev as number }, risultato, stato,
        ...(d && typeof d.id === 'string' && istanteOk(d.quando) && { decisione: { id: d.id, esito: d.esito === 'applica' ? 'applica' : 'rifiuta', quando: d.quando, ...(Number.isInteger(d.revisione) && { revisione: d.revisione }) } }),
        ...(u && typeof u.id === 'string' && istanteOk(u.quando) && Number.isInteger(u.revisione) && { annullamento: { id: u.id, quando: u.quando, revisione: u.revisione } }),
        ...(typeof v.nota === 'string' && { nota: v.nota.slice(0, 120) }),
      }]
    })
    .sort((a, b) => Date.parse(b.quando) - Date.parse(a.quando))
}

// --- dati per `risorse_agenti` ----------------------------------------------------------------------------

/** Una misura di contesto più vecchia di così non entra nella media: un numero vecchio non decide. */
const CONTESTO_FRESCO_MS = 300_000

/** Per «modello · effort»: sessioni del progetto al lavoro adesso e chip in coda. */
export function alLavoroDa(sessioni: readonly SessioneProgetto[], azioni: readonly Azione[], r: Regole) {
  const out: Record<string, { lavoro: number; coda: number }> = {}
  const voce = (k: string) => (out[k] ??= { lavoro: 0, coda: 0 })
  for (const s of sessioni) if (s.stato === 'in-corso') voce(`${s.modello ?? '?'} · ${s.effort ?? '?'}`).lavoro += 1
  for (const a of azioni) if (a.stato === 'accodata') voce(`${modelloDi(a, r)} · ${effortDi(a, r)}`).coda += 1
  return out
}

/**
 * Per modello, sulle sessioni al lavoro: media e massimo della finestra di contesto usata, solo con misure riuscite
 * negli ultimi 5 minuti, la copertura («3 su 4») e l'istante dell'ultima misura riuscita.
 */
export function contestoPerModello(sessioni: readonly SessioneProgetto[], adesso: number) {
  const out: Record<string, { media: number | null; massimo: number | null; misurate: string; ultima: string | null }> = {}
  const perModello = new Map<string, SessioneProgetto[]>()
  for (const s of sessioni) if (s.stato === 'in-corso') perModello.set(s.modello ?? '?', [...(perModello.get(s.modello ?? '?') ?? []), s])
  for (const [m, lista] of perModello) {
    const fresche = lista.filter(s => s.contesto !== undefined && s.contestoIl && adesso - Date.parse(s.contestoIl) <= CONTESTO_FRESCO_MS && adesso >= Date.parse(s.contestoIl))
    const valori = fresche.map(s => s.contesto!)
    const istanti = lista.flatMap(s => (s.contestoIl ? [s.contestoIl] : [])).sort()
    out[m] = {
      media: valori.length ? Math.round(valori.reduce((x, y) => x + y, 0) / valori.length) : null,
      massimo: valori.length ? Math.max(...valori) : null,
      misurate: `${valori.length} su ${lista.length}`,
      ultima: istanti.at(-1) ?? null,
    }
  }
  return out
}

/** Le ultime 3 proposte, in forma breve. */
export const proposteBrevi = (lista: readonly PropostaPesi[], adesso: number) =>
  lista.slice(0, 3).map(p => {
    // Lo stato visto di una proposta di pesi, non di un'azione.
    const stato = statoVisto(p, adesso)
    return { id: p.id, stato, quando: p.quando, da: p.proponente.titolo || idBreve(p.proponente.id), chiede: riassuntoProposta(p), ...(p.decisione && { decisa: p.decisione.quando }) }
  })

export const TETTO_RISORSE = 4_000

/**
 * La risposta di `risorse_agenti` entro il tetto: se è troppo lunga si accorcia per passi, dal meno importante, e lo si
 * dice in `nota`. Ogni passo toglie dettaglio senza inventare numeri.
 */
export function rispostaRisorse(dati: Record<string, unknown>, tetto = TETTO_RISORSE) {
  let d: Record<string, unknown> = { ...dati }
  const ridotti: string[] = []
  const passi: [string, (x: Record<string, unknown>) => Record<string, unknown>][] = [
    ['limiti senza fonte e nome', x => ({ ...x, limiti: (x.limiti as Limite[] | undefined)?.map(l => ({ id: l.id, percentuale: l.percentuale, valore: l.valore, letto: l.letto, reset: l.reset, errore: l.errore })) })],
    ['alLavoro: le 8 combinazioni più usate', x => ({ ...x, alLavoro: Object.fromEntries(Object.entries((x.alLavoro ?? {}) as Record<string, { lavoro: number; coda: number }>).sort((a, b) => b[1].lavoro + b[1].coda - a[1].lavoro - a[1].coda).slice(0, 8)) })],
    ['contesto: i 5 modelli più usati', x => ({ ...x, contesto: Object.fromEntries(Object.entries((x.contesto ?? {}) as Record<string, { misurate: string }>).sort((a, b) => parseInt(b[1].misurate.split(' su ')[1]!, 10) - parseInt(a[1].misurate.split(' su ')[1]!, 10)).slice(0, 5)) })],
    ['pesi della politica: solo il numero', x => ({ ...x, politica: { ...(x.politica as object), pesi: `${((x.politica as { pesi?: unknown[] }).pesi ?? []).length} pesi: vedi le Impostazioni` } })],
    ['limiti omessi', x => ({ ...x, limiti: 'omessi: troppi per la risposta' })],
    ['politica omessa', x => ({ ...x, politica: 'omessa: troppo lunga' })],
  ]
  for (const [nome, passo] of passi) {
    if (JSON.stringify(d).length <= tetto) break
    d = passo(d)
    ridotti.push(nome)
  }
  if (ridotti.length) d = { ...d, nota: `risposta ridotta sotto ${tetto} caratteri: ${ridotti.join('; ')}` }
  const testo = JSON.stringify(d)
  return testo.length <= tetto ? testo : JSON.stringify({ nota: `risposta oltre ${tetto} caratteri anche ridotta`, chiavi: Object.keys(d) })
}
