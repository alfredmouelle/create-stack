import { type SpawnSyncOptions, spawnSync } from 'node:child_process'
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
import { isJsonObject, type JsonObject } from '../javascript/json.ts'

export const read = (p: string): string => readFileSync(p, 'utf8')
export const write = (p: string, c: string): void => {
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, c)
}
export const exists = (p: string): boolean => existsSync(p)
export const readJSON = (p: string): unknown => JSON.parse(read(p))
export const writeJSON = (p: string, obj: unknown): void =>
  write(p, `${JSON.stringify(obj, null, 2)}\n`)

export const remove = (p: string): void => {
  if (existsSync(p)) rmSync(p, { recursive: true, force: true })
}

export const copy = (from: string, to: string): void => {
  mkdirSync(dirname(to), { recursive: true })
  cpSync(from, to, { recursive: true })
}

export const editFile = (
  p: string,
  fn: (content: string) => string | null | undefined,
): boolean => {
  if (!existsSync(p)) return false
  const next = fn(read(p))
  if (next != null) write(p, next)
  return true
}

export const isDirEmpty = (p: string): boolean => {
  if (!existsSync(p)) return true
  return readdirSync(p).length === 0
}

export const run = (cmd: string, args: readonly string[], opts: SpawnSyncOptions = {}): boolean => {
  const res = spawnSync(cmd, args, { stdio: 'inherit', ...opts })
  return res.status === 0
}

export { join }

export const pkgRemoveDeps = (pkg: JsonObject, names: readonly string[]): void => {
  for (const field of ['dependencies', 'devDependencies']) {
    const deps = pkg[field]
    if (!isJsonObject(deps)) continue
    for (const name of names) delete deps[name]
  }
}

export const pkgAddDeps = (
  pkg: JsonObject,
  deps: Readonly<Record<string, string>>,
  field = 'dependencies',
): void => {
  const current = pkg[field]
  const target = isJsonObject(current) ? current : {}
  pkg[field] = target
  for (const [name, range] of Object.entries(deps)) target[name] = range
}
