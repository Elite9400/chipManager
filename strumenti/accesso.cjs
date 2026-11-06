// F6.7: tiene in vita il login dell'host (`claude auth login` o `gh auth login --web`) avviato da «Accedi».
// Uso: node accesso.cjs <claude|gh> <comando...>. Senza shell; l'output del login si legge solo in memoria (di gh solo il
// codice monouso) e non si scrive mai su disco. Su stdout, per chi l'ha avviato: «pronto», «errore» o «occupato», poi
// «codice XXXX-XXXX». Il mutex `accesso-vivo:<tipo>` resta tenuto finché il login vive: un secondo «Accedi» lo vede.
'use strict'
const { spawn } = require('child_process')
const d = require('./disco.cjs')

const [tipo, ...argv] = process.argv.slice(2)
process.stdout.on('error', () => {})
const dici = riga => {
  try {
    process.stdout.write(`${riga}\n`)
  } catch {
    // chi ha avviato non ascolta più
  }
}

d.conMutex(`accesso-vivo:${tipo}`, 0, () => new Promise(fine => {
  let figlio
  try {
    const [eseguibile, argomenti] = d.comandoReale(argv)
    figlio = spawn(eseguibile, argomenti, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
  } catch {
    dici('errore')
    return fine()
  }
  figlio.once('error', () => {
    dici('errore')
    fine()
  })
  figlio.once('spawn', () => dici('pronto'))
  // Solo una coda corta in memoria, letta per il codice e poi scartata; il resto si consuma senza tenerlo.
  let coda = ''
  let detto = tipo !== 'gh'
  const leggi = b => {
    if (detto) return
    coda = (coda + b.toString('utf8')).slice(-4096)
    const m = /\b([A-Z0-9]{4}-[A-Z0-9]{4})\b/.exec(coda)
    if (!m) return
    detto = true
    coda = ''
    dici(`codice ${m[1]}`)
  }
  figlio.stdout.on('data', leggi)
  figlio.stderr.on('data', leggi)
  figlio.once('close', () => fine())
})).then(r => {
  if (r.occupato) dici('occupato')
  process.exit(0)
}, () => {
  dici('errore')
  process.exit(1)
})
