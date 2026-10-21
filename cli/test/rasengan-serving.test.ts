import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'

test('the production server serves public assets and APIs without exposing server files', async () => {
  const root = mkdtempSync(join(tmpdir(), 'create-stack-rasengan-serving-'))
  const script = new URL('../../apps/rasengan-base/scripts/start.ts', import.meta.url)
  for (const path of ['dist/client/assets', 'dist/server', 'public'])
    mkdirSync(join(root, path), { recursive: true })
  writeFileSync(join(root, 'dist/client/assets/application.js'), 'export const ready = true')
  writeFileSync(join(root, 'public/robots.txt'), 'User-agent: *\nAllow: /\n')
  writeFileSync(join(root, 'dist/server/private.js'), 'export const serverSecret = "private"')
  writeFileSync(join(root, 'dist/server/environment.js'), 'export {}')
  writeFileSync(join(root, '.env.local'), 'DATABASE_URL=postgres://localhost/private\n')
  writeFileSync(
    join(root, 'dist/server/api-router.js'),
    'export default { middleware: () => async () => new Response(JSON.stringify({ status: "ready" }), { headers: { "content-type": "application/json" } }) }',
  )
  const child = spawn(process.execPath, [fileURLToPath(script)], {
    cwd: root,
    env: { ...process.env, PORT: '0', HOST: '127.0.0.1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let output = ''
  child.stdout.on('data', (chunk: Buffer) => {
    output += chunk.toString()
  })
  child.stderr.on('data', (chunk: Buffer) => {
    output += chunk.toString()
  })
  try {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (child.exitCode !== null) throw new Error(output)
      if (/http:\/\/127\.0\.0\.1:\d+/.test(output)) break
      await delay(50)
    }
    const origin = output.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0]
    if (!origin) throw new Error(output)
    const asset = await fetch(`${origin}/assets/application.js`)
    expect(asset.status).toBe(200)
    expect(asset.headers.get('content-type')).toContain('javascript')
    expect(await asset.text()).toBe('export const ready = true')
    expect(await (await fetch(`${origin}/robots.txt`)).text()).toBe('User-agent: *\nAllow: /\n')
    expect(await (await fetch(`${origin}/api/health`)).json()).toEqual({ status: 'ready' })
    for (const path of [
      '/server/private.js',
      '/dist/server/private.js',
      '/.env.local',
      '/src/env.ts',
      '/assets/%2e%2e/%2e%2e/server/private.js',
      '/assets/%2e%2e%2f%2e%2e%2fserver/private.js',
    ]) {
      const response = await fetch(`${origin}${path}`)
      expect([403, 404], path).toContain(response.status)
      expect(await response.text()).not.toContain('serverSecret')
    }
  } finally {
    if (child.exitCode === null) {
      child.kill('SIGTERM')
      await once(child, 'exit')
    }
    rmSync(root, { recursive: true, force: true })
  }
})
