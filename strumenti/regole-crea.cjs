'use strict'
// Creates a project's routing.json once, after the owner confirmed the exact path and text in the panel. Exclusive
// creation only (never overwrites), never inside .git, never through a link or junction from the repository root down.
// Input on stdin: { root, relativo, testo }. Exit: 0 created · 2 invalid input · 4 already exists · 6 unsafe path · 1 error.
const fs = require('node:fs')
const path = require('node:path')

const MAX_TESTO = 64 * 1024

/** `relativo` as the config allows it (logica.ts progettoDa): relative, no `..`; plus no `.git` component anywhere. */
function percorso(root, relativo) {
  if (typeof root !== 'string' || !path.isAbsolute(root) || typeof relativo !== 'string' || !relativo || relativo.length > 400) return null
  if (/^([a-z]:)?[\\/]/i.test(relativo) || /(^|[\\/])\.\.([\\/]|$)/.test(relativo)) return null
  const pezzi = relativo.split(/[\\/]+/).filter(Boolean)
  const tutti = [...path.resolve(root).split(/[\\/]+/), ...pezzi]
  if (!pezzi.length || tutti.some(p => p.toLowerCase() === '.git')) return null
  return pezzi
}

/** 0 created, 4 exists, 6 unsafe; throws on other I/O errors. `fsx` only for the tests. */
function crea(input, fsx = fs) {
  const { root, relativo, testo } = input ?? {}
  const pezzi = percorso(root, relativo)
  if (!pezzi || typeof testo !== 'string' || !testo || Buffer.byteLength(testo) > MAX_TESTO) return 2
  try {
    JSON.parse(testo)
  } catch {
    return 2
  }
  const base = path.resolve(root)
  const st = fsx.lstatSync(base)
  if (st.isSymbolicLink() || !st.isDirectory()) return 6
  let dir = base
  for (const p of pezzi.slice(0, -1)) {
    dir = path.join(dir, p)
    let s
    try {
      s = fsx.lstatSync(dir)
    } catch (e) {
      if (e.code !== 'ENOENT') throw e
      fsx.mkdirSync(dir)
      s = fsx.lstatSync(dir)
    }
    if (s.isSymbolicLink() || !s.isDirectory()) return 6
  }
  const file = path.join(dir, pezzi.at(-1))
  // An existing name, link included, is never replaced: lstat sees a dangling link that `wx` alone would report as EEXIST too.
  try {
    fsx.lstatSync(file)
    return 4
  } catch (e) {
    if (e.code !== 'ENOENT') throw e
  }
  let fd
  try {
    fd = fsx.openSync(file, 'wx', 0o644)
  } catch (e) {
    if (e.code === 'EEXIST') return 4
    throw e
  }
  try {
    fsx.writeSync(fd, testo)
    fsx.fsyncSync(fd)
  } finally {
    fsx.closeSync(fd)
  }
  return 0
}

if (require.main === module) {
  let dati = ''
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', x => (dati += x))
  process.stdin.on('end', () => {
    try {
      process.exitCode = crea(JSON.parse(dati))
    } catch {
      process.exitCode = 1
    }
  })
}

module.exports = { crea, percorso }
