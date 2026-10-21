import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { REGISTERED_FRAMEWORKS, type TreeEntry } from './frameworks'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

const QUALITY_PROFILE_OUTPUTS = new Set([
  '.githooks/pre-commit',
  '.githooks/pre-push',
  '.vscode/settings.json',
  '.zed/settings.json',
  'biome.jsonc',
])

function treePaths(tree: readonly TreeEntry[]): string[] {
  let directory = ''
  return tree.flatMap((entry) => {
    if (entry.depth === 0) {
      directory = entry.path.endsWith('/') ? entry.path : ''
      return [entry.path]
    }
    return [`${directory}${entry.path}`]
  })
}

describe.each(REGISTERED_FRAMEWORKS)('$label', (framework) => {
  it('lists only paths that exist in its reference application', () => {
    const missing = treePaths(framework.tree)
      .filter((path) => !QUALITY_PROFILE_OUTPUTS.has(path))
      .filter((path) => !existsSync(join(repositoryRoot, framework.referenceApplication, path)))

    expect(missing).toEqual([])
  })
})
