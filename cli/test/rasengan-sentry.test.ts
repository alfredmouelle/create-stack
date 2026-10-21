import { spawn, spawnSync } from 'node:child_process'
import { once } from 'node:events'
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'

function assertBuildOutput(project: string): string[] {
  const files = readdirSync(join(project, 'dist'), { recursive: true, encoding: 'utf8' })
  for (const output of ['client', 'server']) {
    const scripts = files.filter((file) => file.startsWith(`${output}/`) && file.endsWith('.js'))
    expect(
      scripts.some((file) =>
        readFileSync(join(project, 'dist', file), 'utf8').includes('_sentryDebugIds'),
      ),
      `${output} debug IDs`,
    ).toBe(true)
  }
  expect(
    files.filter((file) => file.endsWith('.map')),
    'deleted source maps',
  ).toEqual([])
  return files
}

test.skipIf(process.env.RUN_SMOKE !== '1')(
  'generated Rasengan Sentry captures caught API and SSR errors with private source maps',
  async () => {
    const root = mkdtempSync(join(tmpdir(), 'create-stack-rasengan-sentry-'))
    const project = join(root, 'storefront')
    const entry = fileURLToPath(new URL('../index.mjs', import.meta.url))
    const envelopes: string[] = []
    const collector = createServer(async (request, response) => {
      const chunks: Buffer[] = []
      for await (const chunk of request) chunks.push(Buffer.from(chunk))
      envelopes.push(Buffer.concat(chunks).toString())
      response.writeHead(200, { 'content-type': 'application/json' }).end('{}')
    })
    collector.listen(0, '127.0.0.1')
    await once(collector, 'listening')
    const address = collector.address()
    if (address === null || typeof address === 'string') throw new Error('Missing collector port')
    const env = {
      ...process.env,
      NODE_ENV: 'production',
      CREATE_STACK_STACK_ROOT: fileURLToPath(new URL('../../', import.meta.url)),
      SENTRY_DSN: `http://public@127.0.0.1:${address.port}/1`,
      SENTRY_AUTH_TOKEN: '',
      SENTRY_ORG: '',
      SENTRY_PROJECT: '',
      PORT: '3048',
      HOST: '127.0.0.1',
    }
    let server: ReturnType<typeof spawn> | undefined
    try {
      const created = spawnSync(
        process.execPath,
        [entry, 'storefront', '--framework', 'rasengan', '--minimal', '--errors', '--no-git'],
        { cwd: root, env, stdio: 'inherit', timeout: 120_000 },
      )
      expect(created.status, 'installed Sentry scaffold').toBe(0)
      writeFileSync(
        join(project, 'src/app/_api/order-export.route.ts'),
        "export function GET(): Response { throw new Error('Order export unavailable') }\n",
      )
      writeFileSync(
        join(project, 'src/app/_routes/order-summary.page.tsx'),
        "export default function OrderSummary() { throw new Error('Order summary unavailable') }\n",
      )
      for (const script of ['typecheck', 'build']) {
        const result = spawnSync('pnpm', ['run', script], {
          cwd: project,
          env,
          stdio: 'inherit',
          timeout: 120_000,
        })
        expect(result.status, script).toBe(0)
      }
      const outputFiles = assertBuildOutput(project)
      server = spawn(
        process.execPath,
        ['--import', './instrument.server.mjs', 'scripts/start.ts'],
        {
          cwd: project,
          env,
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      )
      let output = ''
      server.stdout?.on('data', (chunk: Buffer) => {
        output += chunk.toString()
      })
      server.stderr?.on('data', (chunk: Buffer) => {
        output += chunk.toString()
      })
      await expect.poll(() => output, { timeout: 10_000 }).toContain('http://127.0.0.1:3048')
      expect((await fetch('http://127.0.0.1:3048/api/order-export')).status).toBe(500)
      expect((await fetch('http://127.0.0.1:3048/order-summary')).status).toBe(500)
      for (const message of ['Order export unavailable', 'Order summary unavailable'])
        await expect
          .poll(() => envelopes.find((envelope) => envelope.includes(message)), { timeout: 10_000 })
          .toContain('"debug_id":')
      const browserScript = outputFiles.find(
        (file) => file.startsWith('client/') && file.endsWith('.js'),
      )
      if (!browserScript) throw new Error('Missing browser script')
      expect(
        (await fetch(`http://127.0.0.1:3048/${browserScript.slice('client/'.length)}.map`)).status,
      ).toBe(404)
    } finally {
      if (server && server.exitCode === null) {
        server.kill('SIGTERM')
        await once(server, 'exit')
      }
      await new Promise<void>((resolve, reject) =>
        collector.close((error) => (error ? reject(error) : resolve())),
      )
      rmSync(root, { recursive: true, force: true })
    }
  },
  5 * 60 * 1000,
)
