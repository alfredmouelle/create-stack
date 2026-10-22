import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { COMPONENTS } from '@alfredmouelle/stack-config'
import { expect, test } from 'vitest'
import { combinations, generate, linkDependencies, repositoryRoot } from './quality-tools.ts'

test.each(combinations)(
  'native additions pass $formatter/$linter with a custom alias',
  async ({ formatter, linter }) => {
    const project = await generate(formatter, linter, 'remix', false, '@')
    linkDependencies(join(project, 'node_modules'), join(repositoryRoot, 'node_modules'))
    linkDependencies(
      join(project, 'node_modules'),
      join(repositoryRoot, 'apps/remix-base/node_modules'),
    )
    const added = spawnSync(
      process.execPath,
      [
        join(repositoryRoot, 'cli/index.mjs'),
        'add',
        ...COMPONENTS.flatMap((name) => ['--with', `component=${name}`]),
        '--no-install',
      ],
      { cwd: project, encoding: 'utf8' },
    )
    expect(added.status, added.stdout + added.stderr).toBe(0)
    for (const script of ['check:write', 'typecheck', 'check']) {
      const result = spawnSync('npm', ['run', script], {
        cwd: project,
        encoding: 'utf8',
        maxBuffer: 4 * 1024 * 1024,
        timeout: 30_000,
      })
      expect(result.status, result.stdout + result.stderr).toBe(0)
    }
  },
  60_000,
)
