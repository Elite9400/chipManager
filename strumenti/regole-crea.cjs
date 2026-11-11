'use strict'
// Creates a project's routing.json once, after the owner confirmed the exact path and text in the panel. Exclusive
// creation only (never overwrites), never inside .git, never through a link or junction from the repository root down.
// Input on stdin: { root, relativo, testo }. Exit: 0 created · 2 invalid input · 4 already exists · 6 unsafe path · 1 error.
const fs = require('node:fs')
const path = require('node:path')

const MAX_TESTO = 64 * 1024

/**
 * `relativo` only in the normal form of normalizzaRouting (hooks/logica.ts), the one the panel reads and confirms:
 * this side never normalizes, it refuses anything else (parity test). Plus no `.git` component anywhere.
 */
function percorso(root, relativo) {
  if (typeof root !== 'string' || !path.isAbsolute(root) || typeof relativo !== 'string' || !relativo || relativo.length > 400) return null
  if (relativo.includes('\\') || relativo.startsWith('/')) return null
  const pezzi = relativo.split('/')
  // RC 2.2.0, point 2: no `~` (Windows 8.3 short names: GIT~1 is `.git`) and no segment ending in a dot or a space
  // (Windows drops them): the same rule as normalizzaRouting.
  if (pezzi.some(p => p === '' || p === '.' || p === '..' || p.includes(':') || p.includes('~') || /[. ]$/.test(p))) return null
  if ([...path.resolve(root).split(/[\\/]+/), ...pezzi].some(p => p.toLowerCase() === '.git')) return null
  return pezzi
}

/** The file written: the root as given (a POSIX root may hold a literal `\`), then the segments. Twin of fileRegole. */
const fileDi = (root, pezzi, p = path) => p.join(p.resolve(root), ...pezzi)

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
  // RC 2.2.0, point 2: a folder's real name (8.3 short names and trailing dots resolved by the system) is never `.git`.
  const reale = d => (fsx.realpathSync ?? fs.realpathSync).native(d)
  const eGit = d => path.basename(reale(d)).toLowerCase() === '.git'
  // RC 2.2.0, review C: the real root is fixed before every check (real path and dev+ino) and never computed again, so a
  // root swapped later cannot move the target.
  let radice
  let idRadice
  try {
    radice = reale(base)
    idRadice = (fsx.statSync ?? fs.statSync)(radice)
  } catch {
    return 6
  }
  // Links above the root are allowed (a repository reached through a junction): the file lands where the reader looks.
  const st = fsx.lstatSync(base)
  if (st.isSymbolicLink() || !st.isDirectory()) return 6
  if (radice.split(/[\\/]+/).some(p => p.toLowerCase() === '.git')) return 6
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
    if (s.isSymbolicLink() || !s.isDirectory() || eGit(dir)) return 6
  }
  const file = fileDi(root, pezzi)
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
  // RC 2.2.0, point 3 and review C: between the checks above and the open a folder (or the root) may have been swapped.
  // The open file must be the one at the name (same dev+ino), its real path under the root fixed at the start (still the
  // same dev+ino), and no folder between them named `.git` (any case); otherwise close it, remove it only if it is ours.
  let mio
  let ok = false
  try {
    mio = fsx.fstatSync(fd)
    const qui = fsx.lstatSync(file)
    const vero = reale(file)
    const ora = (fsx.statSync ?? fs.statSync)(radice)
    const sotto = vero.startsWith(radice + path.sep) ? vero.slice(radice.length + 1).split(/[\\/]+/).slice(0, -1) : null
    ok = qui.dev === mio.dev && qui.ino === mio.ino && ora.dev === idRadice.dev && ora.ino === idRadice.ino &&
      !!sotto && !sotto.some(p => p.toLowerCase() === '.git')
  } catch {
    /* the name is gone or unreadable: refused below */
  }
  if (!ok) {
    fsx.closeSync(fd)
    try {
      const qui = fsx.lstatSync(file)
      if (mio && qui.dev === mio.dev && qui.ino === mio.ino) fsx.unlinkSync(file)
    } catch {
      /* nothing of ours left at the name */
    }
    return 6
  }
  // writeFileSync on the descriptor writes every byte (writeSync may stop short); a failed write removes the file this
  // call created, and only that one (same dev+ino), so the next attempt does not find a truncated file «already there».
  let nostro
  try {
    nostro = fsx.fstatSync(fd)
    fsx.writeFileSync(fd, testo)
    fsx.fsyncSync(fd)
  } catch (e) {
    try {
      fsx.closeSync(fd)
    } catch {
      /* the cleanup below still runs */
    }
    fd = undefined
    try {
      const ora = fsx.lstatSync(file)
      if (nostro && ora.dev === nostro.dev && ora.ino === nostro.ino) fsx.unlinkSync(file)
    } catch {
      /* already gone: nothing to remove */
    }
    throw e
  } finally {
    if (fd !== undefined) fsx.closeSync(fd)
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

module.exports = { crea, percorso, fileDi }
