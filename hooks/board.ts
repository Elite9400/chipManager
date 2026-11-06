// Board di progetto: un file HTML statico generato SENZA modello da una funzione pura. Niente `$`.
import type { Azione, Chiamante, Regole, Traguardi, Vita } from '../types'
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
  violazioniAvvio,
  mandato,
} from './logica'
import type { Strumenti } from './logica'
import { testo } from './lingua'

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
  chi: Chiamante | null
  strumenti?: Strumenti
  piani: Record<string, Piano>
  commit: readonly Commit[]
  traguardi: Traguardi | null
  /** impronta del testo della chip → riassunto; vuoto se i riassunti sono spenti. */
  riassunti: Record<string, string>
  percorso: string
  impronta?: string
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
  return `${a.titolo}\n${a.brief}${dip.length ? `\nDipende da: ${dip.join('; ')}` : ''}`.slice(0, 2000)
}

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
  /** La sessione che genera: i blocchi di avvio mostrati dipendono da lei. */
  chi?: Chiamante | null
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
const data = (iso: string | undefined) => {
  if (!iso || !Number.isFinite(Date.parse(iso))) return 'ignoto'
  const d = new Date(iso)
  const due = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())} ${due(d.getHours())}:${due(d.getMinutes())}`
}
const motore = (m: string) => ({ claude: 'Claude', codex: 'Codex', freellmapi: 'FreeLLMAPI', nessuno: 'Nessuno' })[m] ?? m
const voce = (k: string, v: string) => `<dt>${esc(k)}</dt><dd>${v}</dd>`

const SEGNI = {
  attesa: ['▲', 'aspetta te'],
  corso: ['▶', 'in corso'],
  prossimo: ['○', 'prossimo'],
  fatto: ['✓', 'fatto'],
  fallita: ['✕', 'fallita'],
} as const

function scheda(a: Azione, d: DatiBoard, lista: readonly Azione[], segno: keyof typeof SEGNI) {
  const r = d.regole
  const vita = d.vive[a.id]
  const [s, parola] = a.stato === 'fallita' ? SEGNI.fallita : SEGNI[segno]
  const rev = revisoreConcreto(a, r)
  const revisore = a.revisore === 'nessuno' ? 'senza revisione' : `${motore(a.revisore)}${rev && rev !== 'motore:codex' ? ` (${nomeModello(rev)})` : ''}`
  const piano = a.piano ? d.piani[a.id] : undefined
  const pianoHtml = !a.piano
    ? '<p class="tenue">Nessun piano collegato.</p>'
    : !piano
      ? `<p class="tenue">${esc(a.piano)}: non letto.</p>`
      : 'errore' in piano
        ? `<p class="tenue">${esc(a.piano)}: ${esc(piano.errore)}</p>`
        : `<p class="tenue">${esc(a.piano)}${piano.troncato ? ' · troncato a 200 KB' : ''}</p><pre>${esc(piano.testo)}</pre>`
  const fase = vita?.fase
  const passi = FASI.map(f => (f === fase ? `<strong>● ${esc(f)}</strong>` : esc(f))).join(' › ')
  // La revisione vale solo per il tentativo corrente.
  const esito = a.revisione && a.revisione.tentativo === a.tentativo ? a.revisione : undefined
  const dip = a.dipende.map(id => lista.find(x => x.id === id)?.titolo ?? id)
  const sblocca = attive(lista).filter(x => x.dipende.includes(a.id)).map(x => x.titolo)
  const riassunto = d.riassunti[hash(testoRiassunto(a, lista))]
  const blocchi = ['proposta', 'accodata'].includes(a.stato) ? violazioniAvvio(a, r, d.azioni, d.chi) : []
  const m = mandato(a, r, d.strumenti)
  return `<details id="t-${esc(a.id)}"><summary><span class="segno">${s}</span> ${esc(a.titolo)} <span class="tenue">· ${esc(parola)} · ${esc(motore(a.esecutore))} ${esc(nomeModello(modelloDi(a, r)))}</span></summary>
<div class="corpo">
${riassunto ? `<h4>Riassunto</h4><p>${esc(riassunto)}</p>` : ''}
${a.stato === 'fallita' && a.errore ? `<h4>Errore</h4><p class="errore">✕ ${esc(a.errore)}</p>` : ''}
${blocchi.length ? `<h4>Blocchi</h4><ul>${blocchi.map(b => `<li>▲ ${esc(testo('it', b))}</li>`).join('')}</ul>` : ''}
${a.motivoCoda ? `<p>In coda: ${esc(a.motivoCoda)}</p>` : ''}
<h4>Piano</h4>${pianoHtml}
<h4>Processo</h4><dl>${voce('Corsia', esc(corsiaDi(a, r) ?? 'nessuna'))}${voce('Passi', `esecuzione (${esc(motore(a.esecutore))}) → revisione (${esc(revisore)}) → fusione`)}${voce('Fase del registro', fase ? passi : 'nessuna')}</dl>
<h4>Chi</h4><dl>${voce('Esecutore', esc(motore(a.esecutore)))}${voce('Modello', esc(nomeModello(modelloDi(a, r))))}${voce('Effort', `${esc(effortDi(a, r))} ${barreEffort(effortDi(a, r))}`)}${voce('Permessi', esc(a.permessi ?? 'come chi avvia'))}${voce('Contesto', esc(a.contesto ?? 'fresh'))}${voce('Worktree', a.worktree === false ? 'cartella condivisa' : `proprio${a.ramo ? ` · ramo ${esc(a.ramo)}` : ''}${a.ramoSessione ? ` · ${esc(a.ramoSessione)}` : ''}`)}${voce('Destinazione', esc(a.destinazione ?? 'local'))}</dl>
<h4>Revisione</h4><dl>${voce('Revisore previsto', esc(revisore))}${esito ? `${voce('Esito', esc(esito.esito))}${voce('Riferita da', esc(esito.riferitaDa))}${voce('Quando', esc(data(esito.quando)))}${esito.nota ? voce('Nota', esc(esito.nota)) : ''}` : voce('Esito', 'non riferito')}</dl>
<h4>Tempi</h4><dl>${voce('Creata', esc(data(a.creata)))}${voce('Avviata', esc(data(a.avviataIl)))}${voce('Consegnata', esc(data(a.consegnataIl)))}${voce('Completata', esc(data(a.completataIl)))}</dl>
<h4>Legami</h4><dl>${voce('Issue', a.issue ? `#${a.issue}` : 'nessuna')}${voce('Dipende da', dip.length ? esc(dip.join('; ')) : 'nulla')}${voce('Sblocca', sblocca.length ? esc(sblocca.join('; ')) : 'nulla')}${voce('Sessione', esc(a.sessione ?? 'nessuna'))}</dl>
<h4>Mandato (ricostruito con le regole attuali)</h4><pre>${esc(m.prompt)}</pre>
<h4>Brief originale</h4><pre>${esc(a.brief)}</pre>
${a.background ? `<h4>Background originale</h4><pre>${esc(a.background)}</pre>` : ''}
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
  const tutte = [...d.azioni]
  const lista = attive(tutte)
  const adesso = Date.parse(d.generata)
  const io = d.chi?.io
  const attesa = lista.filter(a => aspettaTe(a, d.vive, io, adesso))
  const inCorso = lista.filter(a => ['in-avvio', 'avviata', 'consegnata'].includes(a.stato) && !attesa.includes(a))
  const prossimi = lista.filter(a => a.stato === 'proposta' || a.stato === 'accodata')
  const chiuse = tutte.filter(a => a.stato === 'completata').sort((x, y) => (y.completataIl ?? y.aggiornata).localeCompare(x.completataIl ?? x.aggiornata))
  const recenti = chiuse.filter(a => adesso - Date.parse(a.completataIl ?? a.aggiornata) <= 30 * GIORNO)
  const vecchie = chiuse.length - recenti.length
  const gruppo = (titolo: string, k: keyof typeof SEGNI, voci: Azione[], vuoto: string) =>
    `<section><h2><span class="segno">${SEGNI[k][0]}</span> ${titolo} (${voci.length})</h2>${voci.length ? voci.map(a => scheda(a, d, tutte, k)).join('\n') : `<p class="tenue">${vuoto}</p>`}</section>`
  const traguardi =
    d.regole.risorse.milestoneGithub && d.traguardi?.lista.length
      ? `<section><h2>Milestone</h2><ul>${d.traguardi.lista
          .map(t => `<li>${esc(t.titolo)} <span class="barra" role="img" aria-label="${percentuale(t)}%"><span style="width:${percentuale(t)}%"></span></span> ${percentuale(t)}% · ${t.chiuse} chiuse su ${t.chiuse + t.aperte}</li>`)
          .join('')}</ul></section>`
      : ''
  const commit = d.commit.length
    ? `<h3>Ramo base</h3><ul>${d.commit.map(c => `<li><code>${esc(c.sha)}</code> ${esc(data(c.data))} · ${esc(c.oggetto)}</li>`).join('')}</ul>`
    : ''
  const html = `<!doctype html>
<html lang="it"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
<meta name="viewport" content="width=device-width,initial-scale=1">
${d.impronta ? `<meta name="chipmanager-impronta" content="${esc(d.impronta)}">` : ''}
<title>Board · ${esc(d.progetto)}</title><style>${CSS}</style></head><body>
<header><h1>${esc(d.progetto)}</h1>
<p class="tenue">Generata il ${esc(data(d.generata))} · chipManager ${esc(d.versione)} · regole da ${esc(d.regole.fonte || 'non lette')}</p>
<p>${inCorso.filter(a => a.stato === 'avviata').length} al lavoro · ${attesa.length} ${attesa.length === 1 ? 'aspetta' : 'aspettano'} te · ${lista.filter(a => a.stato === 'proposta').length} da avviare</p></header>
<main>
${gruppo('Aspettano te', 'attesa', attesa, 'Niente aspetta te.')}
${gruppo('In corso', 'corso', inCorso, 'Nessun lavoro in corso.')}
${gruppo('Prossimi', 'prossimo', prossimi, 'Niente in programma.')}
<section><h2><span class="segno">✓</span> Fatto (${recenti.length})</h2>${recenti.map(a => scheda(a, d, tutte, 'fatto')).join('\n')}${vecchie ? `<p class="tenue">${vecchie} completate da più di 30 giorni.</p>` : ''}${commit}${!recenti.length && !commit ? '<p class="tenue">Ancora niente.</p>' : ''}</section>
${traguardi}
</main>
<footer><p>Legenda: ${Object.values(SEGNI).map(([s, p]) => `${s} ${p}`).join(' · ')}. La revisione è l'esito riferito dalla sessione indicata.</p><p>File: ${esc(d.percorso)}</p></footer>
</body></html>
`
  return oscura(html, tutte.map(a => a.tentativo))
}
