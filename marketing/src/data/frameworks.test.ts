import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { REGISTERED_FRAMEWORKS, type TreeEntry } from './frameworks'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

const GENERATED_FILE_SOURCES = ['cli/templates/quality-profile', 'cli/templates']

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
  it('lists only paths its reference application or the CLI templates provide', () => {
    const missing = treePaths(framework.tree).filter(
      (path) =>
        ![framework.referenceApplication, ...GENERATED_FILE_SOURCES].some((source) =>
          existsSync(join(repositoryRoot, source, path)),
        ),
    )

    expect(missing).toEqual([])
  })
})
