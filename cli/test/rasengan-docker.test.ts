import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'

const timeout = 10 * 60 * 1000

function run(command: string, args: readonly string[], cwd: string): void {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    timeout,
    env: {
      ...process.env,
      CREATE_STACK_STACK_ROOT: fileURLToPath(new URL('../../', import.meta.url)),
    },
  })
  expect(result.status, `${command} ${args.join(' ')}`).toBe(0)
}

test.skipIf(process.env.RUN_RASENGAN_DOCKER !== '1').each([false, true])(
  'the generated Docker image serves safely with error tracking enabled=%s',
  async (errors) => {
    const root = mkdtempSync(join(tmpdir(), 'create-stack-rasengan-docker-'))
    const project = join(root, 'storefront')
    const name = `create-stack-rasengan-${crypto.randomUUID()}`
    const image = `${name}:verification`
    const entry = fileURLToPath(new URL('../index.mjs', import.meta.url))
    try {
      run(
        process.execPath,
        [
          entry,
          'storefront',
          '--framework',
          'rasengan',
          '--minimal',
          '--pm',
          'pnpm',
          '--no-git',
          '--no-install',
          ...(errors ? ['--errors'] : []),
        ],
        root,
      )
      if (errors)
        writeFileSync(
          join(project, 'src/app/_api/instrumentation.route.ts'),
          "import { getClient } from '@sentry/node'\nexport function GET(): Response { return Response.json({ instrumented: getClient() !== undefined }) }\n",
        )
      run('pnpm', ['install'], project)
      run('docker', ['build', '--tag', image, '.'], project)
      run(
        'docker',
        ['run', '--detach', '--rm', '--name', name, '--publish', '127.0.0.1:3044:3000', image],
        project,
      )
      await expect
        .poll(
          async () => {
            try {
              return (await fetch('http://127.0.0.1:3044/api/health')).status
            } catch {
              return 0
            }
          },
          { timeout: 15_000 },
        )
        .toBe(200)
      expect((await fetch('http://127.0.0.1:3044/')).status).toBe(200)
      expect((await fetch('http://127.0.0.1:3044/server/environment.js')).status).toBe(404)
      if (errors)
        expect(await (await fetch('http://127.0.0.1:3044/api/instrumentation')).json()).toEqual({
          instrumented: true,
        })
    } finally {
      spawnSync('docker', ['stop', '--time', '10', name], { stdio: 'ignore' })
      spawnSync('docker', ['image', 'rm', image], { stdio: 'ignore' })
      rmSync(root, { recursive: true, force: true })
    }
  },
  timeout,
)
