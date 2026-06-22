// fs / exec / package.json helpers shared by the CLI. No external deps.

import { spawnSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'

export const read = (p) => readFileSync(p, 'utf8')
export const write = (p, c) => {
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, c)
}
export const exists = (p) => existsSync(p)
export const readJSON = (p) => JSON.parse(read(p))
export const writeJSON = (p, obj) => write(p, `${JSON.stringify(obj, null, 2)}\n`)

/** Remove file/dir if present (recursive, never throws on absent). */
export const remove = (p) => {
  if (existsSync(p)) rmSync(p, { recursive: true, force: true })
}

/** Copy a file/dir tree. */
export const copy = (from, to) => {
  mkdirSync(dirname(to), { recursive: true })
  cpSync(from, to, { recursive: true })
}

/** Edit a file in place via (content) => content. No-op if absent. */
export const editFile = (p, fn) => {
  if (!existsSync(p)) return false
  const next = fn(read(p))
  if (next != null) write(p, next)
  return true
}

/** Dir empty (or absent)? Ignores noise files. */
export const isDirEmpty = (p) => {
  if (!existsSync(p)) return true
  const noise = new Set(['.git', '.DS_Store'])
  return readdirSync(p).every((f) => noise.has(f))
}

/** Run a command (inherits stdio). True on exit 0. */
export const run = (cmd, args, opts = {}) => {
  const res = spawnSync(cmd, args, { stdio: 'inherit', ...opts })
  return res.status === 0
}

/** Run a command, capturing trimmed stdout. '' on failure. */
export const runCapture = (cmd, args, opts = {}) => {
  const res = spawnSync(cmd, args, { encoding: 'utf8', ...opts })
  return res.status === 0 ? (res.stdout || '').trim() : ''
}

export { join }

// --- package.json helpers (mutate parsed object in place) ---

export const pkgRemoveDeps = (pkg, names) => {
  for (const field of ['dependencies', 'devDependencies']) {
    if (!pkg[field]) continue
    for (const name of names) delete pkg[field][name]
  }
}

export const pkgRemoveScripts = (pkg, names) => {
  if (!pkg.scripts) return
  for (const name of names) delete pkg.scripts[name]
}

export const pkgAddDeps = (pkg, deps, field = 'dependencies') => {
  pkg[field] = pkg[field] || {}
  for (const [name, range] of Object.entries(deps)) pkg[field][name] = range
}
