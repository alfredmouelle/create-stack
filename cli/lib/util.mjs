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

export const remove = (p) => {
  if (existsSync(p)) rmSync(p, { recursive: true, force: true })
}

export const copy = (from, to) => {
  mkdirSync(dirname(to), { recursive: true })
  cpSync(from, to, { recursive: true })
}

export const editFile = (p, fn) => {
  if (!existsSync(p)) return false
  const next = fn(read(p))
  if (next != null) write(p, next)
  return true
}

export const isDirEmpty = (p) => {
  if (!existsSync(p)) return true
  return readdirSync(p).length === 0
}

export const run = (cmd, args, opts = {}) => {
  const res = spawnSync(cmd, args, { stdio: 'inherit', ...opts })
  return res.status === 0
}

export { join }

export const pkgRemoveDeps = (pkg, names) => {
  for (const field of ['dependencies', 'devDependencies']) {
    if (!pkg[field]) continue
    for (const name of names) delete pkg[field][name]
  }
}

export const pkgAddDeps = (pkg, deps, field = 'dependencies') => {
  pkg[field] = pkg[field] || {}
  for (const [name, range] of Object.entries(deps)) pkg[field][name] = range
}
