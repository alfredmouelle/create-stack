import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const packageRoot = fileURLToPath(new URL('..', import.meta.url))
const mode = process.env.MARKETING_BUILD_MODE ?? 'validation'
const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'

if (!['public', 'validation'].includes(mode)) {
  console.error(`Unsupported MARKETING_BUILD_MODE: ${mode}. Use "public" or "validation".`)
  process.exit(1)
}

function run(label, args) {
  process.stdout.write(`[marketing] ${label}\n`)
  const result = spawnSync(pnpmCommand, args, {
    cwd: packageRoot,
    env: process.env,
    stdio: 'inherit',
  })

  if (result.error) {
    console.error(`[marketing] ${label} could not start: ${result.error.message}`)
    process.exit(1)
  }

  if (result.status !== 0) {
    console.error(`[marketing] ${label} failed with exit code ${result.status ?? 'unknown'}`)
    process.exit(result.status ?? 1)
  }
}

run(`building ${mode} site`, ['run', `build:${mode}`])
run('running local HTTP smoke test', ['run', 'smoke'])
run('deploying with the workspace Wrangler', [
  'exec',
  'wrangler',
  'deploy',
  '--config',
  'wrangler.jsonc',
])
