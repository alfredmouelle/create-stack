import { readdirSync } from 'node:fs'
import { editFile, exists, join, read } from '#lib/util.ts'
import { frameworkAssetExcludes, frameworkModules } from '../framework-registry.ts'

const REWRITE_EXTS = new Set([
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
])
const skippedDirectories = (): ReadonlySet<string> =>
  new Set(['node_modules', '.git', 'dist', ...frameworkModules.flatMap(frameworkAssetExcludes)])

const ALIAS_SPECIFIER = /(['"`])~\//g

const ext = (name: string): string => {
  const i = name.lastIndexOf('.')
  return i < 0 ? '' : name.slice(i)
}

function* walk(dir: string, skipped: ReadonlySet<string>): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!skipped.has(entry.name)) yield* walk(join(dir, entry.name), skipped)
    } else if (REWRITE_EXTS.has(ext(entry.name))) {
      yield join(dir, entry.name)
    }
  }
}

export function rewriteAlias(dir: string, alias: string): number {
  if (!alias || alias === '~') return 0
  let changed = 0
  for (const file of walk(dir, skippedDirectories())) {
    editFile(file, (src: string) => {
      const next = src.replace(ALIAS_SPECIFIER, (_, q) => `${q}${alias}/`)
      if (next === src) return null
      changed++
      return next
    })
  }
  return changed
}

const PATHS_KEY = /["'](.+?)\/\*["']\s*:\s*\[/

export function detectAlias(projectDir: string): string {
  const tsconfig = join(projectDir, 'tsconfig.json')
  if (exists(tsconfig)) {
    const m = read(tsconfig).match(PATHS_KEY)
    if (m?.[1]) return m[1]
  }
  return '~'
}
