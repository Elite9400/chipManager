'use strict'
// F6.2 — l'`apiKeyHelper` della mod per `claude -p`: stampa il file-chiave del tentativo se esiste e registra l'istante
// della consegna. Non verifica chi lo chiama (PIANO-F6 §12): durante l'esecuzione la chiave è accessibile all'agente
// come qualunque chiave data a un agente; dopo l'uscita il file non c'è più e qui non c'è niente da stampare.
const fs = require('fs')
const [chiave, consegna] = process.argv.slice(2)
try {
  const testo = fs.readFileSync(chiave, 'utf8').trim()
  if (!testo) throw new Error('vuoto')
  const tmp = `${consegna}.${process.pid}.tmp`
  fs.writeFileSync(tmp, new Date().toISOString())
  fs.renameSync(tmp, consegna)
  process.stdout.write(testo)
} catch {
  process.exitCode = 1
}
