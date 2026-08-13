import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { lstatSync, mkdtempSync, readdirSync, readFileSync, readlinkSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const acceptanceTestDirectory = dirname(fileURLToPath(import.meta.url))
const cliRoot = resolve(acceptanceTestDirectory, '..')
const repoRoot = resolve(cliRoot, '..')
const packageJson = JSON.parse(readFileSync(join(cliRoot, 'package.json'), 'utf8'))
const cliEntry = resolve(cliRoot, packageJson.bin['create-stack'])
const fixtureRoots = []

const hash = (path) => createHash('sha256').update(readFileSync(path)).digest('hex')

function snapshot(path) {
  const entries = []

  function visit(current, relative) {
    let stat
    try {
      stat = lstatSync(current)
    } catch (error) {
      if (error?.code === 'ENOENT') return
      throw error
    }

    if (stat.isSymbolicLink()) {
      entries.push(`link:${relative}:${readlinkSync(current)}`)
      return
    }
    if (stat.isDirectory()) {
      entries.push(`dir:${relative}`)
      for (const name of readdirSync(current).sort())
        visit(join(current, name), join(relative, name))
      return
    }
    entries.push(`file:${relative}:${stat.mode}:${stat.size}:${hash(current)}`)
  }

  visit(path, '.')
  return entries.join('\n')
}

export function createAcceptanceFixture(shape) {
  if (shape !== 'standalone' && shape !== 'monorepo') throw new Error(`Unknown shape: ${shape}`)
  const root = mkdtempSync(join(tmpdir(), `create-stack-acceptance-${shape}-`))
  fixtureRoots.push(root)
  const project = join(root, 'project')
  return {
    shape,
    root,
    project,
    app: shape === 'monorepo' ? join(project, 'apps', 'web') : project,
  }
}

export function cleanupAcceptanceFixtures() {
  for (const root of fixtureRoots.splice(0)) rmSync(root, { recursive: true, force: true })
}

export function runCli({ args = [], cwd, input, target, timeout = 10_000 }) {
  const before = snapshot(target)
  const result = spawnSync(process.execPath, [cliEntry, ...args], {
    cwd,
    encoding: 'utf8',
    input,
    timeout,
    env: {
      ...process.env,
      CREATE_STACK_STACK_ROOT: repoRoot,
      GIT_AUTHOR_EMAIL: 'acceptance@example.test',
      GIT_AUTHOR_NAME: 'Create Stack acceptance',
      GIT_COMMITTER_EMAIL: 'acceptance@example.test',
      GIT_COMMITTER_NAME: 'Create Stack acceptance',
      NO_COLOR: '1',
      npm_config_user_agent: 'pnpm/11.1.3',
    },
  })
  const stdout = result.stdout ?? ''

  return {
    exitStatus: result.status,
    stdout,
    stderr: result.stderr ?? '',
    requestedInput: /^◆ {2}/m.test(stdout),
    targetMutated: before !== snapshot(target),
    signal: result.signal,
  }
}
