// Rewrite the import-path alias of a forked project. Base apps ship with '~/'; a
// single post-fork pass swaps it for the user's choice across source + tsconfig +
// components.json. Idempotent: only touches '~/' occurrences, so re-running on an
// already-rewritten tree (e.g. `add` on a '@/' project) is a no-op on existing files.

import { readdirSync } from 'node:fs'
import { editFile, exists, join, read } from './util.mjs'

const REWRITE_EXTS = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs', '.json'])
const SKIP_DIRS = new Set(['node_modules', '.git', '.next', '.output', '.nitro', '.tanstack', 'dist'])

// Match the alias only as a quoted module-specifier prefix (import 'X', "X", `X`) so
// stray '~/' in comments or prose is left alone.
const ALIAS_SPECIFIER = /(['"`])~\//g

const ext = (name) => {
  const i = name.lastIndexOf('.')
  return i < 0 ? '' : name.slice(i)
}

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) yield* walk(join(dir, entry.name))
    } else if (REWRITE_EXTS.has(ext(entry.name))) {
      yield join(dir, entry.name)
    }
  }
}

/**
 * Replace the '~/' import alias with `alias` across a tree. No-op when alias is '~'.
 * @param {string} dir   tree root (project dir or a freshly-vendored subtree)
 * @param {string} alias prefix without trailing slash (e.g. '@', '#', '@app')
 * @returns {number} files changed
 */
export function rewriteAlias(dir, alias) {
  if (!alias || alias === '~') return 0
  let changed = 0
  for (const file of walk(dir)) {
    editFile(file, (src) => {
      const next = src.replace(ALIAS_SPECIFIER, (_, q) => `${q}${alias}/`)
      if (next === src) return null
      changed++
      return next
    })
  }
  return changed
}

// tsconfig is JSONC (comments allowed), so scan raw text for the `"<alias>/*": [` mapping
// key rather than JSON.parse-ing it.
const PATHS_KEY = /["'](.+?)\/\*["']\s*:\s*\[/

/** Detect a project's alias from its tsconfig `paths` mapping. Defaults to '~'. */
export function detectAlias(projectDir) {
  const tsconfig = join(projectDir, 'tsconfig.json')
  if (exists(tsconfig)) {
    const m = read(tsconfig).match(PATHS_KEY)
    if (m) return m[1]
  }
  return '~'
}
