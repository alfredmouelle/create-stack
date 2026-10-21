import { spawnSync } from 'node:child_process'
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { FRAMEWORKS } from '@alfredmouelle/stack-config'
import { afterAll, expect, test } from 'vitest'
import { cleanupAcceptanceFixtures, createAcceptanceFixture, runCli } from './acceptance.ts'

afterAll(cleanupAcceptanceFixtures)

const combinations = [
  { formatter: 'biome', linter: 'biome', commands: ['biome check --write .', 'biome check .'] },
  {
    formatter: 'biome',
    linter: 'oxlint',
    commands: [
      'biome check --write .',
      'oxlint --type-aware --fix .',
      'biome check .',
      'oxlint --type-aware .',
    ],
  },
  {
    formatter: 'prettier',
    linter: 'biome',
    commands: ['prettier --write .', 'biome lint --write .', 'prettier --check .', 'biome lint .'],
  },
  {
    formatter: 'prettier',
    linter: 'oxlint',
    commands: [
      'prettier --write .',
      'oxlint --type-aware --fix .',
      'prettier --check .',
      'oxlint --type-aware .',
    ],
  },
] as const

test.each(
  combinations.flatMap((tools) =>
    FRAMEWORKS.flatMap((framework) =>
      ['', 'install', 'format', 'typecheck', 'lint'].map((failure) => ({
        ...tools,
        framework,
        failure,
      })),
    ),
  ),
)(
  'executable $framework gate runs $formatter/$linter and commits only on success, failure=$failure',
  ({ framework, formatter, linter, commands, failure }) => {
    const fixture = createAcceptanceFixture('standalone')
    const bin = join(fixture.root, 'bin')
    const log = join(fixture.root, 'commands.log')
    mkdirSync(bin)
    const packageManager = `#!/usr/bin/env node
const { appendFileSync, readFileSync } = require('node:fs')
const { spawnSync } = require('node:child_process')
const [operation, script] = process.argv.slice(2)
appendFileSync(process.env.QUALITY_LOG, (operation === 'install' ? 'install' : script) + '\\n')
const step = operation === 'install' ? 'install' : script === 'check:write' ? 'format' : script === 'check' ? 'lint' : 'typecheck'
if (process.env.QUALITY_FAIL === step && (step === 'install' || step === 'typecheck')) process.exit(1)
if (operation === 'install' || script === 'typecheck') process.exit(0)
const manifest = JSON.parse(readFileSync('package.json', 'utf8'))
process.exit(spawnSync('sh', ['-c', manifest.scripts[script]], { stdio: 'inherit', env: { ...process.env, QUALITY_STAGE: step } }).status ?? 1)
`
    writeFileSync(join(bin, 'npm'), packageManager)
    chmodSync(join(bin, 'npm'), 0o755)
    for (const tool of ['biome', 'prettier', 'oxlint']) {
      writeFileSync(
        join(bin, tool),
        `#!/usr/bin/env node\nrequire('node:fs').appendFileSync(process.env.QUALITY_LOG, ${JSON.stringify(tool)} + ' ' + process.argv.slice(2).join(' ') + '\\n')\nif (process.env.QUALITY_FAIL === process.env.QUALITY_STAGE) process.exit(1)\n`,
      )
      chmodSync(join(bin, tool), 0o755)
    }

    const result = runCli({
      cwd: fixture.root,
      target: fixture.project,
      args: [
        'project',
        '--minimal',
        '--framework',
        framework,
        '--pm',
        'npm',
        `--formatter=${formatter}`,
        `--linter=${linter}`,
      ],
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        QUALITY_LOG: log,
        QUALITY_FAIL: failure,
      },
    })
    const committed =
      spawnSync('git', ['rev-parse', '--verify', 'HEAD'], { cwd: fixture.project }).status === 0

    expect(result.exitStatus, result.stdout + result.stderr).toBe(failure ? 1 : 0)
    expect(committed).toBe(failure === '')
    if (!failure) {
      const format = commands.length === 2 ? commands.slice(0, 1) : commands.slice(0, 2)
      const lint = commands.length === 2 ? commands.slice(1) : commands.slice(2)
      expect(readFileSync(log, 'utf8').trim().split('\n')).toEqual([
        'install',
        'check:write',
        ...format,
        'typecheck',
        'check',
        ...lint,
      ])
    }
  },
  15_000,
)
