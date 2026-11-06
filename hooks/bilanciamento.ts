// Logica pura delle Impostazioni (piano grafica, C2 con §9 righe 4, 5 e 7 e §10): profili di bilanciamento, regolazioni
// a cinque posizioni, soglie, budget manuali e simulazione della scelta. Niente `$`: i test la provano senza engine.
import type { Azione, Chiamante, Fornitore, Limite, Pendenti, Peso, PesiProfilo, PropostaPesi, Regolazione, Regole, RisorseProgetto, SessioneProgetto, Soglia } from '../types'
import { ALIAS_UNITA, data, errore, LINGUE, msg, t } from './lingua'
import type { Chiave, Lingua, Msg } from './lingua'
import { bilancia, effortDi, modelloDi, nomeModello, pesoValido, profiloDi, risorseDa, violazioniAvvio } from './logica'

export type Profilo = NonNullable<RisorseProgetto['profilo']>

// --- regolazioni a cinque posizioni --------------------------------------------------------------------

/** Le cinque posizioni di una regolazione: `percentuale` del peso, `assoluto` sempre 0. «Molto meno» non esclude. */
export const POSIZIONI = [
  { nome: 'pos.moltoMeno', percentuale: -90 },
  { nome: 'pos.meno', percentuale: -40 },
  { nome: 'pos.normale', percentuale: 0 },
  { nome: 'pos.piu', percentuale: 40 },
  { nome: 'pos.preferisci', percentuale: 100 },
] as const satisfies readonly { nome: Chiave; percentuale: number }[]
const NORMALE = 2

/** La posizione di un peso, -1 se è fuori dalle cinque (personalizzato: si mostra intero e resta intatto). Assente = Normale. */
export function posizioneDi(p: Peso | undefined) {
  if (!p) return NORMALE
  return p.assoluto === 0 ? POSIZIONI.findIndex(x => x.percentuale === p.percentuale) : -1
}

/** Come si legge un peso fuori dalle cinque posizioni: entrambi i componenti, con il segno. */
export const pesoScritto = (p: Peso, l: Lingua) =>
  t(l, 'pos.personalizzato', { valore: `${p.percentuale >= 0 ? '+' : ''}${p.percentuale}% · ${p.assoluto >= 0 ? '+' : ''}${p.assoluto}` })

/** I pesi con la voce `tipo:nome` alla posizione `i`; Normale toglie la voce. Le altre voci restano come sono. */
export function conPosizione(pesi: readonly Peso[], tipo: Peso['tipo'], nome: string, i: number): Peso[] {
  const pos = POSIZIONI[i]
  if (!pos) throw errore('pos.nonValida')
  const altri = pesi.filter(p => p.tipo !== tipo || p.nome !== nome)
  return i === NORMALE ? altri : [...altri, { tipo, nome, percentuale: pos.percentuale, assoluto: 0 }]
}

// --- profili ------------------------------------------------------------------------------------------

const peso = (tipo: Peso['tipo'], nome: string, i: number): Peso => ({ tipo, nome, percentuale: POSIZIONI[i]!.percentuale, assoluto: 0 })

/**
 * Insiemi fissi di pesi su motori ed effort, mai sui modelli: l'ordine di routing.json non dice nulla sulle capacità.
 * Automatico = nessuna preferenza fissa, decide il margine dei limiti. Personalizzato non ha pesi propri.
 */
export const PROFILI: readonly { id: Profilo; nome: Chiave; descrizione: Chiave; pesi?: readonly Peso[] }[] = [
  { id: 'automatico', nome: 'profilo.automatico', descrizione: 'profilo.automatico.descrizione', pesi: [] },
  {
    id: 'risparmio', nome: 'profilo.risparmio', descrizione: 'profilo.risparmio.descrizione',
    pesi: [peso('fornitore', 'codex', 3), peso('effort', 'low', 3), peso('effort', 'high', 1), peso('effort', 'xhigh', 0)],
  },
  {
    id: 'qualita', nome: 'profilo.qualita', descrizione: 'profilo.qualita.descrizione',
    pesi: [peso('effort', 'xhigh', 4), peso('effort', 'high', 3), peso('effort', 'medium', 1), peso('effort', 'low', 0)],
  },
  {
    id: 'velocita', nome: 'profilo.velocita', descrizione: 'profilo.velocita.descrizione',
    pesi: [peso('effort', 'low', 4), peso('effort', 'medium', 3), peso('effort', 'high', 1), peso('effort', 'xhigh', 0)],
  },
  { id: 'personalizzato', nome: 'profilo.personalizzato', descrizione: 'profilo.personalizzato.descrizione' },
]

/** I pesi dopo la scelta di un profilo: quelli di motori ed effort diventano i suoi, quelli dei modelli restano intatti. */
export function conProfilo(pesi: readonly Peso[], profilo: Profilo): Peso[] {
  const p = PROFILI.find(x => x.id === profilo)
  if (!p) throw errore('profilo.nonValido')
  if (!p.pesi) return [...pesi]
  return [...pesi.filter(x => x.tipo === 'modello'), ...p.pesi]
}

// Una sola risoluzione del profilo: sta in logica (la usa `punteggio`), qui solo riesportata.
export { profiloDi }

// --- soglie -------------------------------------------------------------------------------------------

export const SOGLIE_PRESET: readonly { valore: string; testo: Chiave; soglia: Soglia | null }[] = [
  { valore: '60/80', testo: 'soglia.6080', soglia: { attenzione: 60, critica: 80 } },
  { valore: '70/90', testo: 'soglia.7090', soglia: { attenzione: 70, critica: 90 } },
  { valore: '80/95', testo: 'soglia.8095', soglia: { attenzione: 80, critica: 95 } },
  { valore: 'nessuna', testo: 'soglia.nessuna', soglia: null },
]

/** Il preset di una soglia, '' se è personale (resta così com'è). */
export const presetDi = (s: Soglia | null) =>
  SOGLIE_PRESET.find(p => (p.soglia === null ? s === null : !!s && p.soglia.attenzione === s.attenzione && p.soglia.critica === s.critica))?.valore ?? ''

/** Le soglie con quella di `f` cambiata. Vale lo stesso vincolo della lettura: numeri finiti da 1 a 100, attenzione sotto la critica. */
export function conSoglia(soglie: RisorseProgetto['soglie'], f: Fornitore, s: Soglia | null): RisorseProgetto['soglie'] {
  const ok = (n: number) => typeof n === 'number' && Number.isFinite(n) && n >= 1 && n <= 100
  if (s && (!ok(s.attenzione) || !ok(s.critica))) throw errore('soglia.fuoriScala')
  if (s && s.attenzione >= s.critica) throw errore('soglia.ordine', { attenzione: s.attenzione, critica: s.critica })
  return { ...soglie, [f]: s }
}

// --- budget manuali -----------------------------------------------------------------------------------

/** I tipi di budget: identificatori salvati nel config (il nome del limite), mostrati con la chiave `budget.<tipo>`. */
export const TIPI_BUDGET = ['giornaliero', 'settimanale', 'mensile'] as const
/** La parola «usato» nelle sei lingue, dall'etichetta «{pct}% usato» dei dizionari. */
const USATO = new Set(LINGUE.map(l => t(l, 'car.usato', { pct: 0 }).replace(/^0%\s*/, '').toLowerCase()))
/** Il nome di un limite: un tipo di budget si traduce, ogni altro nome (dei fornitori) resta com'è. */
export const nomeLimite = (nome: string, l: Lingua) => ((TIPI_BUDGET as readonly string[]).includes(nome) ? t(l, `budget.${nome as (typeof TIPI_BUDGET)[number]}`) : nome)

/**
 * «40», «40%» o «40% usato» (la parola «usato» di una delle sei lingue) = quota usata; «12 USD», «500 richieste», «1000 token» = valore. Le unità si scrivono in una qualunque delle
 * sei lingue (`ALIAS_UNITA`) e si salvano sempre con lo stesso nome. Restituisce il motivo se non si legge.
 */
export function budgetDa(testo: string): Pick<Limite, 'percentuale' | 'valore' | 'unita'> | Msg {
  // F5.7: dopo «%» può seguire solo la parola «usato» dell'esempio; un residuo o un'altra parola non è un utilizzo.
  const m = testo.trim().replace(',', '.').match(/^(\d+(?:\.\d+)?)\s*(?:%\s*(\p{L}+)?|(\p{L}+))?$/iu)
  if (!m || (m[2] && !USATO.has(m[2].toLowerCase()))) return msg('budget.formato')
  const n = Number(m[1])
  if (!m[3]) return n <= 100 ? { percentuale: n, unita: '%' } : msg('budget.percentuale')
  const unita = ALIAS_UNITA[m[3].toLowerCase()]
  if (!unita) return msg('budget.unita', { unita: m[3] })
  return n <= 1e12 ? { valore: n, unita } : msg('budget.grande')
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

// --- bozza delle Impostazioni (F5.9) -------------------------------------------------------------------
// Le modifiche restano nella bozza della sessione finché non si preme «Applica»: una sola scrittura CAS. Ogni campo
// tiene il valore che aveva quando lo si è toccato (`base`), così all'Applica si vede se un'altra sessione l'ha cambiato.

/** Il valore di un campo del progetto nella forma che scrive `configura`. */
export const valoreConfig = (r: RisorseProgetto, k: string): unknown =>
  k === 'limitiManuali' ? manualiDaScrivere(r.limitiManuali) : k === 'board' ? { modo: r.board.modo } : (r as Record<string, unknown>)[k]

/** Aggiunge alla bozza i `campi` toccati da un controllo (`dove`); la base di un campo è quella del primo tocco. */
export function conPendente(p: Pendenti | undefined, r: RisorseProgetto, dove: string, campi: Record<string, unknown>): Pendenti {
  const base = { ...p?.base }
  for (const k of Object.keys(campi)) if (!(k in base)) base[k] = valoreConfig(r, k)
  return { ...p, campi: { ...p?.campi, ...campi }, base, dove: { ...p?.dove, [dove]: [...new Set([...(p?.dove[dove] ?? []), ...Object.keys(campi)])] } }
}

/** Una bozza senza campi né lingua non c'è. */
export const piena = (p: Pendenti | undefined) => (p && (Object.keys(p.campi).length || p.lingua) ? p : undefined)

/**
 * Dopo «Applica» (rilievo 1): toglie dalla bozza solo ciò che è stato scritto, con il valore scritto. Una modifica arrivata
 * mentre si scriveva resta; se tocca un campo appena scritto, la sua base diventa il valore scritto (non è un conflitto).
 * La lingua si confronta con quella salvata adesso (`linguaOra`, riletta): se è stata scelta di nuovo mentre si scriveva
 * (`tocchiPrima` diverso) vale l'ultima scelta; pendente solo se diversa da `linguaOra`.
 */
export function dopoApplica(p: Pendenti | undefined, scritti: { campi: Record<string, unknown> }, tocchiPrima: number | undefined, linguaOra: Pendenti['lingua']): Pendenti | undefined {
  if (!p) return undefined
  const campi = { ...p.campi }
  const base = { ...p.base }
  for (const [k, v] of Object.entries(scritti.campi)) {
    if (!(k in campi)) continue
    if (JSON.stringify(campi[k]) === JSON.stringify(v)) {
      delete campi[k]
      delete base[k]
    } else base[k] = v
  }
  const voluta = (p.tocchi ?? 0) !== (tocchiPrima ?? 0) ? p.scelta : p.lingua
  const lingua = voluta && voluta !== linguaOra ? voluta : undefined
  const dove = Object.fromEntries(Object.entries(p.dove).filter(([, ks]) => ks.some(k => (k === 'lingua' ? !!lingua : k in campi))))
  const conLingua = lingua ? { ...dove, lingua: ['lingua'] } : dove
  return piena({ campi, base, dove: conLingua, ...(lingua && { lingua, scelta: lingua }), ...(p.tocchi !== undefined && { tocchi: p.tocchi }) })
}

/** Le risorse come le vedrà il config con la bozza applicata; il motivo se la bozza non passa la validazione di oggi. */
export const conBozza = (r: RisorseProgetto, campi: Record<string, unknown>) =>
  risorseDa({ ...r, limitiManuali: manualiDaScrivere(r.limitiManuali), ...campi })

/** I campi della bozza che un'altra sessione ha cambiato dopo il primo tocco. */
export const cambiatiAltrove = (p: Pendenti, r: RisorseProgetto) => Object.keys(p.campi).filter(k => JSON.stringify(p.base[k]) !== JSON.stringify(valoreConfig(r, k)))

/** Dove sta un campo, per dire all'utente che cosa è cambiato. */
export const SEZIONE_DI: Record<string, Chiave> = {
  fornitori: 'imp.sezione.connessioni', soglie: 'imp.sezione.soglie', profilo: 'imp.sezione.bilanciamento', pesi: 'imp.sezione.bilanciamento',
  soloLocale: 'imp.sezione.progetto', milestoneGithub: 'imp.sezione.progetto', limitiManuali: 'imp.sezione.progetto', board: 'imp.sezione.board',
  freellmapi: 'imp.sezione.avanzate',
}

// --- simulazione --------------------------------------------------------------------------------------

/**
 * Dove andrebbe una nuova proposta R2 senza scelte di motore, modello ed effort, con le regole di adesso. Stessa
 * strada della creazione (`bilancia`), poi la guardia d'avvio: se nessuna combinazione passa, i motivi.
 */
export function simula(r: Regole, limiti: readonly Limite[], lista: readonly Azione[], chi: Chiamante | null) {
  const ora = new Date(0).toISOString()
  const esempio: Azione = {
    id: 'a-simulata', versione: 0, repo: chi?.repo ?? undefined, titolo: 'Proposta d\'esempio', brief: 'Balancing simulation.',
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
const nomeProfilo = (p: PesiProfilo['profilo'], l: Lingua) => t(l, PROFILI.find(x => x.id === p)?.nome ?? 'profilo.nessuno')
const testoVoce = (tipo: Peso['tipo'], nome: string) => (tipo === 'fornitore' ? MOTORI_NOMI[nome] ?? nome : tipo === 'modello' ? nomeModello(nome) : `effort ${nome}`)
const idBreve = (id: string) => id.replace(/^local_/, '').slice(0, 8)

/** I testi composti delle proposte di pesi, nella lingua `l`; le parole semplici sono chiavi `pesi.*` del dizionario. */
export const TESTI_PESI = {
  chi: (p: PropostaPesi, l: Lingua) => t(l, 'pesi.chi', { titolo: p.proponente.titolo || t(l, 'sessione.senzaTitolo'), id: idBreve(p.proponente.id) }),
  riga: (p: PropostaPesi, l: Lingua) => t(l, 'pesi.riga', { chi: TESTI_PESI.chi(p, l), chiede: riassuntoProposta(p, l) }),
  domanda: (p: PropostaPesi, l: Lingua) =>
    t(l, 'pesi.domanda', { chi: TESTI_PESI.chi(p, l), prima: descriviPesi(p.partenza, l), dopo: descriviPesi(p.risultato, l), motivo: p.motivo }),
  /** Per l'agente che ha proposto: in inglese. */
  registrata: (id: string, scadute: readonly string[]) =>
    `Proposal recorded (id ${id}): the owner decides it from the panel.` +
    (scadute.length ? ` Expired to make room (more than 3 pending): ${scadute.join(', ')}.` : ''),
  registro: (p: PropostaPesi, l: Lingua, adesso = Date.now()) =>
    t(l, 'pesi.registro', { esito: t(l, `pesi.stato.${statoVisto(p, adesso)}`), quando: data(l, decisaIl(p, adesso)), chi: TESTI_PESI.chi(p, l), chiede: riassuntoProposta(p, l) }),
} as const

/** Profilo e pesi a parole: «Risparmio · Codex Più · effort xhigh Molto meno (non esclude)». */
export function descriviPesi(s: PesiProfilo, l: Lingua) {
  const pesi = s.pesi.map(p => {
    const i = posizioneDi(p)
    return `${testoVoce(p.tipo, p.nome)} ${i < 0 ? pesoScritto(p, l) : t(l, POSIZIONI[i]!.nome)}`
  })
  return [nomeProfilo(s.profilo, l), ...(pesi.length ? pesi : [t(l, 'pesi.nessunPeso')])].join(' · ')
}

/** Che cosa chiede una proposta, in breve: il profilo e le regolazioni. */
export const riassuntoProposta = (p: Pick<PropostaPesi, 'profilo' | 'regolazioni'>, l: Lingua) =>
  [...(p.profilo ? [nomeProfilo(p.profilo, l)] : []), ...(p.regolazioni ?? []).map(x => `${testoVoce(x.tipo, x.nome)} ${POSIZIONI[x.posizione] ? t(l, POSIZIONI[x.posizione]!.nome) : '?'}`)].join(' · ')

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
  if (ignoti.length) return `fields not allowed: ${ignoti.join(', ')} (only profilo, regolazioni and motivo)`
  const motivo = typeof args.motivo === 'string' ? args.motivo.trim() : ''
  if (!motivo || motivo.length > 300) return 'motivo: mandatory, up to 300 characters'
  const profilo = args.profilo as Profilo | undefined
  if (profilo !== undefined && !PROFILI.some(p => p.id === profilo)) return `profilo: one of ${PROFILI.map(p => p.id).join(', ')}`
  let regolazioni: Regolazione[] | undefined
  if (args.regolazioni !== undefined) {
    if (!Array.isArray(args.regolazioni) || !args.regolazioni.length || args.regolazioni.length > 30) return 'regolazioni: from 1 to 30 entries'
    const ammesse = vociRegolabili(r)
    regolazioni = []
    for (const x of args.regolazioni as unknown[]) {
      const v = x as Record<string, unknown>
      if (!v || typeof v !== 'object' || Object.keys(v).some(k => !['tipo', 'nome', 'posizione'].includes(k))) return 'regolazioni: each entry is { tipo, nome, posizione }'
      if (!['fornitore', 'modello', 'effort'].includes(String(v.tipo))) return 'regolazioni: tipo fornitore, modello or effort'
      const tipo = v.tipo as Peso['tipo']
      if (typeof v.nome !== 'string' || !ammesse[tipo].includes(v.nome)) return `regolazioni: "${String(v.nome)}" is not an allowed ${tipo} (${ammesse[tipo].join(', ') || 'none'})`
      if (!Number.isInteger(v.posizione) || (v.posizione as number) < 0 || (v.posizione as number) > 4) return 'regolazioni: posizione from 0 (Much less) to 4 (Prefer)'
      if (regolazioni.some(y => y.tipo === tipo && y.nome === v.nome)) return `regolazioni: ${tipo} "${v.nome}" repeated`
      regolazioni.push({ tipo, nome: v.nome, posizione: v.posizione as number })
    }
  }
  if (!profilo && !regolazioni) return 'a profilo, some regolazioni or both are needed'
  let pesi = profilo ? conProfilo(r.risorse.pesi, profilo) : [...r.risorse.pesi]
  for (const x of regolazioni ?? []) pesi = conPosizione(pesi, x.tipo, x.nome, x.posizione)
  const risultato: PesiProfilo = { profilo: regolazioni ? 'personalizzato' : profilo!, pesi }
  // Il confronto è con il profilo in vigore: «automatico» su un config senza profilo né pesi non cambia nulla.
  if (risultato.profilo === profiloDi(r.risorse) && JSON.stringify(pesi) === JSON.stringify(r.risorse.pesi)) return 'the proposal changes nothing compared to the current configuration'
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
      misurate: `${valori.length} of ${lista.length}`,
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
    return { id: p.id, stato, quando: p.quando, da: p.proponente.titolo || idBreve(p.proponente.id), chiede: riassuntoProposta(p, 'en'), ...(p.decisione && { decisa: p.decisione.quando }) }
  })

export const TETTO_RISORSE = 4_000

/**
 * La risposta di `risorse_agenti` entro il tetto: se è troppo lunga si accorcia per passi, dal meno importante, e lo si
 * dice in `nota`. Ogni passo toglie dettaglio senza inventare numeri.
 */
/** Le sessioni di un modello (il totale di «k of n»): un numero, qualunque sia la parola fra i due. */
const sessioniDi = (c: { misurate: string }) => Number(/(\d+)\s*$/.exec(c.misurate)?.[1] ?? 0)

export function rispostaRisorse(dati: Record<string, unknown>, tetto = TETTO_RISORSE) {
  let d: Record<string, unknown> = { ...dati }
  const ridotti: string[] = []
  const passi: [string, (x: Record<string, unknown>) => Record<string, unknown>][] = [
    ['limits without source and name', x => ({ ...x, limiti: (x.limiti as Limite[] | undefined)?.map(l => ({ id: l.id, percentuale: l.percentuale, valore: l.valore, letto: l.letto, reset: l.reset, errore: l.errore })) })],
    ['alLavoro: the 8 most used combinations', x => ({ ...x, alLavoro: Object.fromEntries(Object.entries((x.alLavoro ?? {}) as Record<string, { lavoro: number; coda: number }>).sort((a, b) => b[1].lavoro + b[1].coda - a[1].lavoro - a[1].coda).slice(0, 8)) })],
    ['contesto: the 5 most used models', x => ({ ...x, contesto: Object.fromEntries(Object.entries((x.contesto ?? {}) as Record<string, { misurate: string }>).sort((a, b) => sessioniDi(b[1]) - sessioniDi(a[1])).slice(0, 5)) })],
    ['policy weights: only the count', x => ({ ...x, politica: { ...(x.politica as object), pesi: `${((x.politica as { pesi?: unknown[] }).pesi ?? []).length} weights: see Settings` } })],
    ['limits omitted', x => ({ ...x, limiti: 'omitted: too many for the answer' })],
    ['policy omitted', x => ({ ...x, politica: 'omitted: too long' })],
  ]
  for (const [nome, passo] of passi) {
    if (JSON.stringify(d).length <= tetto) break
    d = passo(d)
    ridotti.push(nome)
  }
  if (ridotti.length) d = { ...d, nota: `answer reduced under ${tetto} characters: ${ridotti.join('; ')}` }
  const testo = JSON.stringify(d)
  return testo.length <= tetto ? testo : JSON.stringify({ nota: `answer over ${tetto} characters even when reduced`, chiavi: Object.keys(d) })
}
