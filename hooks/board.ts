// Board di progetto: un file HTML statico generato SENZA modello da una funzione pura. Niente `$`.
import type { Azione, Regole, Traguardi, Vita } from '../types'
import {
  attive,
  aspettaTe,
  barreEffort,
  corsiaDi,
  effortDi,
  FASI,
  modelloDi,
  nomeModello,
  percentuale,
  revisoreConcreto,
  violazioni,
  mandato,
} from './logica'
import type { Strumenti } from './logica'
import { giorno, letto, ora, traduttore } from './lingua'
import type { Lingua, T } from './lingua'

export type Commit = { sha: string; data: string; oggetto: string }
export type Piano = { testo: string; troncato?: boolean } | { errore: string }

export type DatiBoard = {
  progetto: string
  versione: string
  /** Istante di generazione (ISO): si mostra, ma non entra nell'impronta. */
  generata: string
  /** Tutte le azioni del progetto, anche chiuse. */
  azioni: readonly Azione[]
  vive: Record<string, Vita>
  regole: Regole
  strumenti?: Strumenti
  piani: Record<string, Piano>
  commit: readonly Commit[]
  traguardi: Traguardi | null
  /** impronta del testo della chip → riassunto; vuoto se i riassunti sono spenti. */
  riassunti: Record<string, string>
  percorso: string
  impronta?: string
  /** La lingua dell'utente: testi, date e attributo `lang` della pagina. */
  lingua: Lingua
}

/** L'unica funzione di escape: ogni testo che viene da chip, piani, git, riassunti e regole passa da qui. */
export const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

/** Impronta non crittografica (due FNV-1a a 32 bit): basta a riconoscere un ingresso cambiato. */
export function hash(s: string) {
  let a = 0x811c9dc5
  let b = 0x01000193 ^ s.length
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    a = Math.imul(a ^ c, 0x01000193) >>> 0
    b = Math.imul(b ^ c, 0x5bd1e995) >>> 0
  }
  return a.toString(36) + b.toString(36)
}

/**
 * Oscura i gettoni sull'HTML FINALE: prima ogni gettone noto, letterale (anche annidato in altro testo), poi
 * la forma di `gettone()` (10 caratteri dopo `az-`) senza confine di parola.
 */
export function oscura(html: string, gettoni: readonly (string | undefined)[]) {
  let h = html
  for (const g of gettoni) if (g) h = h.split(g).join('az-•••')
  return h.replace(/az-[a-z0-9]{10}/gi, 'az-•••')
}

/** Il testo di una chip che i riassunti possono vedere: titolo, mandato, titoli delle dipendenze; 2.000 caratteri. */
export function testoRiassunto(a: Azione, lista: readonly Azione[]) {
  const dip = a.dipende.map(id => lista.find(x => x.id === id)?.titolo).filter(Boolean)
  return `${a.titolo}\n${a.brief}${dip.length ? `\nDepends on: ${dip.join('; ')}` : ''}`.slice(0, 2000)
}

/** La chiave di un riassunto: il testo della chip e la lingua (cambiare lingua chiede un riassunto nuovo). */
export const chiaveRiassunto = (a: Azione, lista: readonly Azione[], lingua: Lingua) => hash(`${lingua}\n${testoRiassunto(a, lista)}`)

export type IngressiBoard = {
  azioni: readonly Azione[]
  vive: Record<string, Vita>
  regole: Regole
  /** id della chip → dimensione e data di modifica del piano (null: non si legge). */
  piani: Record<string, { size: number; mtimeMs: number } | null>
  registro: number | null
  commit: readonly Commit[]
  traguardi: Traguardi | null
  riassunti: Record<string, string>
  oggi: string
  modo: string
  versione: string
  /** Cambiare lingua rigenera la board: entra nell'impronta come ogni altro ingresso. */
  lingua: Lingua
}

/** Impronta degli ingressi: cambia solo se cambia ciò che la board mostra (mai per `aggiornata` o per l'ora). */
export function improntaBoard(i: IngressiBoard) {
  const azioni = i.azioni.map(({ aggiornata: _a, ...resto }) => resto)
  const vive = Object.fromEntries(
    Object.entries(i.vive).map(([k, v]) => [k, { ...v, ultimaAttivita: v.ultimaAttivita?.slice(0, 16) }]),
  )
  // L'oggetto Regole intero (lette e fonte comprese): niente elenchi di campi da tenere allineati.
  return hash(JSON.stringify({ ...i, azioni, vive, traguardi: i.traguardi && { lista: i.traguardi.lista, milestoneDi: i.traguardi.milestoneDi } }))
}

const GIORNO = 86_400_000
/** Giorno con l'anno e ora, nella lingua della board. */
const data = (T: T, iso: string | undefined) =>
  !iso || !Number.isFinite(Date.parse(iso)) ? T('board.ignoto') : `${giorno(T.lingua, iso)}, ${ora(T.lingua, iso)}`
const motore = (T: T, m: string) => (m === 'nessuno' ? T('motore.nessuno') : ({ claude: 'Claude', codex: 'Codex', freellmapi: 'FreeLLMAPI' } as Record<string, string>)[m] ?? m)
const voce = (k: string, v: string) => `<dt>${esc(k)}</dt><dd>${v}</dd>`

const SEGNI = {
  attesa: ['▲', 'board.segno.attesa'],
  corso: ['▶', 'board.segno.corso'],
  prossimo: ['○', 'board.segno.prossimo'],
  fatto: ['✓', 'board.segno.fatto'],
  fallita: ['✕', 'board.segno.fallita'],
} as const

function scheda(T: T, a: Azione, d: DatiBoard, lista: readonly Azione[], segno: keyof typeof SEGNI) {
  const r = d.regole
  const vita = d.vive[a.id]
  const [s, parola] = a.stato === 'fallita' ? SEGNI.fallita : SEGNI[segno]
  const rev = revisoreConcreto(a, r)
  const revisore = a.revisore === 'nessuno' ? T('info.senzaRevisione') : `${motore(T, a.revisore)}${rev && rev !== 'motore:codex' ? ` (${nomeModello(rev)})` : ''}`
  const piano = a.piano ? d.piani[a.id] : undefined
  const pianoHtml = !a.piano
    ? `<p class="tenue">${esc(T('board.nessunPiano'))}</p>`
    : !piano
      ? `<p class="tenue">${esc(T('board.pianoNonLetto', { piano: a.piano }))}</p>`
      : 'errore' in piano
        ? `<p class="tenue">${esc(a.piano)}: ${esc(T.k(piano.errore))}</p>`
        : `<p class="tenue">${esc(a.piano)}${piano.troncato ? ` · ${esc(T('board.troncato'))}` : ''}</p><pre>${esc(piano.testo)}</pre>`
  const fase = vita?.fase
  const passi = FASI.map(f => (f === fase ? `<strong>● ${esc(T(`fase.${f}`))}</strong>` : esc(T(`fase.${f}`)))).join(' › ')
  // La revisione vale solo per il tentativo corrente.
  const esito = a.revisione && a.revisione.tentativo === a.tentativo ? a.revisione : undefined
  const dip = a.dipende.map(id => lista.find(x => x.id === id)?.titolo ?? id)
  const sblocca = attive(lista).filter(x => x.dipende.includes(a.id)).map(x => x.titolo)
  const riassunto = d.riassunti[chiaveRiassunto(a, lista, d.lingua)]
  // R7: solo le regole di progetto, mai la sessione che genera: la board è la stessa per chiunque la scriva.
  const blocchi = ['proposta', 'accodata'].includes(a.stato) ? violazioni(a, r, d.azioni) : []
  const m = mandato(a, r, d.strumenti)
  return `<details id="t-${esc(a.id)}"><summary><span class="segno">${s}</span> ${esc(a.titolo)} <span class="tenue">· ${esc(T(parola))} · ${esc(motore(T, a.esecutore))} ${esc(nomeModello(modelloDi(a, r)))}</span></summary>
<div class="corpo">
${riassunto ? `<h4>${esc(T('board.riassunto'))}</h4><p>${esc(riassunto)}</p>` : ''}
${a.stato === 'fallita' && a.errore ? `<h4>${esc(T('board.errore'))}</h4><p class="errore">✕ ${esc(T.m(letto(a.erroreCodice, a.erroreParametri, a.errore)))}</p>` : ''}
${blocchi.length ? `<h4>${esc(T('board.blocchi'))}</h4><ul>${blocchi.map(b => `<li>▲ ${esc(T.m(b))}</li>`).join('')}</ul>` : ''}
${a.motivoCoda ? `<p>${esc(T('info.inCoda', { motivo: T.m(letto(a.motivoCodice, a.motivoParametri, a.motivoCoda)) }))}</p>` : ''}
<h4>${esc(T('ed.piano'))}</h4>${pianoHtml}
<h4>${esc(T('board.processo'))}</h4><dl>${voce(T('ed.corsia'), esc(corsiaDi(a, r) ?? T('board.nessuna')))}${voce(T('board.passi'), esc(T('board.passiValore', { esecutore: motore(T, a.esecutore), revisore })))}${voce(T('board.fase'), fase ? passi : esc(T('board.nessuna')))}</dl>
<h4>${esc(T('tab.chi'))}</h4><dl>${voce(T('ed.esecutore'), esc(motore(T, a.esecutore)))}${voce(T('ed.modello'), esc(nomeModello(modelloDi(a, r))))}${voce(T('ed.effort'), `${esc(effortDi(a, r))} ${barreEffort(effortDi(a, r))}`)}${voce(T('ed.permessi'), esc(a.permessi ?? T('board.comeChiAvvia')))}${voce(T('ed.contesto'), esc(a.contesto ?? 'fresh'))}${voce('Worktree', a.worktree === false ? esc(T('op.condivisa')) : `${esc(T('board.proprio'))}${a.ramo ? ` · ${esc(T('board.ramo', { ramo: a.ramo }))}` : ''}${a.ramoSessione ? ` · ${esc(a.ramoSessione)}` : ''}`)}${voce(T('board.destinazione'), esc(a.destinazione ?? 'local'))}</dl>
<h4>${esc(T('board.revisione'))}</h4><dl>${voce(T('board.revisorePrevisto'), esc(revisore))}${esito ? `${voce(T('board.esito'), esc(T(`esito.${esito.esito}`)))}${voce(T('board.riferitaDa'), esc(esito.riferitaDa))}${voce(T('board.quando'), esc(data(T, esito.quando)))}${esito.nota ? voce(T('board.nota'), esc(esito.nota)) : ''}` : voce(T('board.esito'), esc(T('board.nonRiferito')))}</dl>
<h4>${esc(T('board.tempi'))}</h4><dl>${voce(T('board.creata'), esc(data(T, a.creata)))}${voce(T('stato.avviata'), esc(data(T, a.avviataIl)))}${voce(T('board.consegnata'), esc(data(T, a.consegnataIl)))}${voce(T('board.completata'), esc(data(T, a.completataIl)))}</dl>
<h4>${esc(T('board.legami'))}</h4><dl>${voce('Issue', a.issue ? `#${a.issue}` : esc(T('board.nessuna')))}${voce(T('board.dipendeDa'), dip.length ? esc(dip.join('; ')) : esc(T('board.nulla')))}${voce(T('board.sblocca'), sblocca.length ? esc(sblocca.join('; ')) : esc(T('board.nulla')))}${voce(T('board.sessione'), esc(a.sessione ?? T('board.nessuna')))}</dl>
<h4>${esc(T('board.mandato'))}</h4><pre>${esc(m.prompt)}</pre>
<h4>${esc(T('board.brief'))}</h4><pre>${esc(a.brief)}</pre>
${a.background ? `<h4>${esc(T('board.background'))}</h4><pre>${esc(a.background)}</pre>` : ''}
</div></details>`
}

const CSS = `:root{color-scheme:light dark;--fondo:#fff;--testo:#111827;--tenue:#6b7280;--bordo:#e5e7eb;--accento:#00BFFF}
@media (prefers-color-scheme:dark){:root{--fondo:#0f1115;--testo:#e5e7eb;--tenue:#9ca3af;--bordo:#2a2f3a}}
body{background:var(--fondo);color:var(--testo);font:15px/1.5 system-ui,sans-serif;max-width:960px;margin:0 auto;padding:16px}
h1{margin:0 0 4px}h2{border-bottom:2px solid var(--accento);padding-bottom:4px;margin-top:32px}h4{margin:16px 0 4px}
details{border:1px solid var(--bordo);border-radius:6px;margin:8px 0;padding:8px 12px}summary{cursor:pointer;font-weight:600}
details:target{outline:2px solid var(--accento)}.segno{color:var(--accento)}.tenue{color:var(--tenue);font-weight:400}
.errore{color:#dc2626}pre{white-space:pre-wrap;word-break:break-word;background:rgba(127,127,127,.08);padding:8px;border-radius:4px;max-height:480px;overflow:auto}
dl{display:grid;grid-template-columns:max-content 1fr;gap:2px 12px;margin:0}dt{color:var(--tenue)}dd{margin:0}
.barra{display:inline-block;width:160px;height:8px;border:1px solid var(--bordo);vertical-align:middle}.barra>span{display:block;height:100%;background:var(--accento)}
footer{margin-top:40px;color:var(--tenue);font-size:13px;word-break:break-all}`

/** La board intera: HTML statico, nessuno script, nessun link costruito da dati, gettoni oscurati. */
export function board(d: DatiBoard): string {
  const T = traduttore(d.lingua)
  const tutte = [...d.azioni]
  const lista = attive(tutte)
  const adesso = Date.parse(d.generata)
  // Ferme e fallite aspettano il committente; un avvio annullabile lo decide solo chi l'ha chiesto, non la board.
  const attesa = lista.filter(a => aspettaTe(a, d.vive, undefined, adesso))
  const inCorso = lista.filter(a => ['in-avvio', 'avviata', 'consegnata'].includes(a.stato) && !attesa.includes(a))
  const prossimi = lista.filter(a => a.stato === 'proposta' || a.stato === 'accodata')
  const chiuse = tutte.filter(a => a.stato === 'completata').sort((x, y) => (y.completataIl ?? y.aggiornata).localeCompare(x.completataIl ?? x.aggiornata))
  const recenti = chiuse.filter(a => adesso - Date.parse(a.completataIl ?? a.aggiornata) <= 30 * GIORNO)
  const vecchie = chiuse.length - recenti.length
  const gruppo = (titolo: string, k: keyof typeof SEGNI, voci: Azione[], vuoto: string) =>
    `<section><h2><span class="segno">${SEGNI[k][0]}</span> ${esc(titolo)} (${voci.length})</h2>${voci.length ? voci.map(a => scheda(T, a, d, tutte, k)).join('\n') : `<p class="tenue">${esc(vuoto)}</p>`}</section>`
  const traguardi =
    d.regole.risorse.milestoneGithub && d.traguardi?.lista.length
      ? `<section><h2>Milestone</h2><ul>${d.traguardi.lista
          .map(t => `<li>${esc(t.titolo)} <span class="barra" role="img" aria-label="${percentuale(t)}%"><span style="width:${percentuale(t)}%"></span></span> ${percentuale(t)}% · ${esc(T('board.chiuseSu', { n: t.chiuse, totale: t.chiuse + t.aperte }))}</li>`)
          .join('')}</ul></section>`
      : ''
  const commit = d.commit.length
    ? `<h3>${esc(T('board.ramoBase'))}</h3><ul>${d.commit.map(c => `<li><code>${esc(c.sha)}</code> ${esc(data(T, c.data))} · ${esc(c.oggetto)}</li>`).join('')}</ul>`
    : ''
  const html = `<!doctype html>
<html lang="${d.lingua === 'pt' ? 'pt-BR' : d.lingua}"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
<meta name="viewport" content="width=device-width,initial-scale=1">
${d.impronta ? `<meta name="chipmanager-impronta" content="${esc(d.impronta)}">` : ''}
<title>Board · ${esc(d.progetto)}</title><style>${CSS}</style></head><body>
<header><h1>${esc(d.progetto)}</h1>
<p class="tenue">${esc(T('board.generata', { quando: data(T, d.generata), versione: d.versione, fonte: d.regole.lette ? d.regole.fonte : T('regole.nonLetteAncora') }))}</p>
<p>${esc([T('sintesi.alLavoro', { n: inCorso.filter(a => a.stato === 'avviata').length }), T('board.sintesiAttesa', { n: attesa.length }), T('sintesi.daAvviare', { n: lista.filter(a => a.stato === 'proposta').length })].join(' · '))}</p></header>
<main>
${gruppo(T('board.aspettaCommittente'), 'attesa', attesa, T('board.vuotoAttesa'))}
${gruppo(T('board.inCorso'), 'corso', inCorso, T('board.vuotoCorso'))}
${gruppo(T('board.prossimi'), 'prossimo', prossimi, T('board.vuotoProssimi'))}
<section><h2><span class="segno">✓</span> ${esc(T('board.fatto'))} (${recenti.length})</h2>${recenti.map(a => scheda(T, a, d, tutte, 'fatto')).join('\n')}${vecchie ? `<p class="tenue">${esc(T('board.vecchie', { n: vecchie }))}</p>` : ''}${commit}${!recenti.length && !commit ? `<p class="tenue">${esc(T('board.ancoraNiente'))}</p>` : ''}</section>
${traguardi}
</main>
<footer><p>${esc(T('board.legenda', { segni: Object.values(SEGNI).map(([s, p]) => `${s} ${T(p)}`).join(' · ') }))}</p><p>${esc(T('boa.file', { percorso: d.percorso }))}</p></footer>
</body></html>
`
  return oscura(html, tutte.map(a => a.tentativo))
}
