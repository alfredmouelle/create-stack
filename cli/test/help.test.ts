import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, expect, test } from 'vitest'
import {
  optionSpelling,
  SCAFFOLD_FLAGS,
  scaffoldFlagSpellings,
} from '../../packages/stack-config/src/index.ts'

const cliEntry = resolve(dirname(fileURLToPath(import.meta.url)), '../index.mjs')

function help(args: readonly string[]): string {
  const result = spawnSync(process.execPath, [cliEntry, ...args], {
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' },
  })
  expect(result.status).toBe(0)
  return result.stdout
}

test.each([
  { args: ['--help'], fixture: 'scaffold.txt' },
  { args: ['add', '--help'], fixture: 'add.txt' },
])('prints the $fixture help', async ({ args, fixture }) => {
  await expect(help(args)).toMatchFileSnapshot(`fixtures/help/${fixture}`)
})

let scaffoldHelp = ''

beforeAll(() => {
  scaffoldHelp = help(['--help'])
})

test.each(SCAFFOLD_FLAGS.flatMap(scaffoldFlagSpellings).map(optionSpelling))(
  'documents %s in the scaffold help',
  (spelling) => {
    expect(scaffoldHelp).toMatch(new RegExp(`(^|[\\s,/])${spelling}([\\s,\\[<]|$)`, 'm'))
  },
)
