import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { join } from 'node:path'
import { setTimeout } from 'node:timers/promises'
import { expect } from 'vitest'

async function availablePort(): Promise<number> {
  for (let port = 3080; port <= 3100; port++) {
    const probe = createServer()
    try {
      probe.listen(port, '127.0.0.1')
      await once(probe, 'listening')
      await new Promise<void>((resolve, reject) =>
        probe.close((error) => (error ? reject(error) : resolve())),
      )
      return port
    } catch {
      probe.close()
    }
  }
  throw new Error('No isolated web port available between 3080 and 3100')
}

async function verifyFont(html: string, origin: string, output: string): Promise<void> {
  const fontTag = [...html.matchAll(/<link\b[^>]+>/gu)].find(
    ([tag]) => tag.includes('commit-mono') && tag.includes('stylesheet'),
  )?.[0]
  const fontHref = fontTag?.match(/href="([^"]+)"/u)?.[1]
  if (fontHref === undefined) throw new Error('Missing fingerprinted font stylesheet')
  const font = await fetch(new URL(fontHref, origin))
  expect(font.status, output).toBe(200)
}

function installBoundaryProbe(projectDir: string): () => void {
  const routerPath = join(projectDir, 'src/router.tsx')
  const router = readFileSync(routerPath, 'utf8')
  const clientPath = join(projectDir, 'src/client/private-import-regression.ts')
  writeFileSync(clientPath, "export { router } from '../router.tsx'\n")
  const probe = `router.get('/__test/private-import', async () => { await assets.getScriptEntry(${JSON.stringify(clientPath)}); return new Response('Unexpected server import') })`
  writeFileSync(
    routerPath,
    router.replace('const router = createRouter()', `const router = createRouter()\n  ${probe}`),
  )
  return () => {
    writeFileSync(routerPath, router)
    rmSync(clientPath)
  }
}

export async function verifyRemixProduction(projectDir: string, command = 'pnpm'): Promise<void> {
  const port = await availablePort()
  const removeProbe = installBoundaryProbe(projectDir)
  const origin = `http://127.0.0.1:${port}`
  const child = spawn(command, ['run', 'start'], {
    cwd: projectDir,
    detached: true,
    env: { ...process.env, NODE_ENV: 'production', PORT: String(port), HOST: '127.0.0.1' },
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
    let ready = false
    for (let attempt = 0; attempt < 100; attempt++) {
      if (child.exitCode !== null || child.signalCode !== null)
        throw new Error(`Production server exited: ${output}`)
      try {
        const response = await fetch(`${origin}/api/health`)
        if (response.ok) {
          ready = true
          break
        }
      } catch {}
      await setTimeout(100)
    }
    expect(ready, output).toBe(true)
    const response = await fetch(origin)
    expect(response.status, output).toBe(200)
    const html = await response.text()
    expect(html).toContain('A clear place to start.')
    expect(html).toContain('type="importmap"')
    const script = [...html.matchAll(/<script\b[^>]+>/gu)].find(([tag]) =>
      tag.includes('type="module"'),
    )?.[0]
    const href = script?.match(/src="([^"]+)"/u)?.[1]
    if (href === undefined) throw new Error('Missing native browser entry')
    expect(href).toContain('.@')
    const asset = await fetch(new URL(href, origin))
    expect(asset.status).toBe(200)
    expect(asset.headers.get('cache-control')).toContain('immutable')
    expect(await asset.text()).not.toContain('sourceMappingURL')
    const styles = await fetch(`${origin}/styles.css`)
    expect(styles.status).toBe(200)
    expect(await styles.text()).toContain('--primary:')
    await verifyFont(html, origin, output)
    const boundary = await fetch(`${origin}/__test/private-import`)
    expect(boundary.status).toBe(500)
    expect(await boundary.text()).toBe('An unexpected error occurred. Please try again.')
    const privatePaths = [
      '/assets/app/server.ts',
      '/assets/app/env.ts',
      '/assets/app/server/db/index.ts',
      '/assets/npm/pg/lib/index.js',
      '/assets/npm/react-email/dist/index.js',
      '/.env',
      '/.env.local',
    ]
    const denied = await Promise.all(privatePaths.map((path) => fetch(`${origin}${path}`)))
    expect(denied.map(({ status }) => status)).toEqual([404, 404, 404, 404, 404, 404, 404])
  } finally {
    removeProbe()
    if (child.pid !== undefined && child.exitCode === null && child.signalCode === null) {
      process.kill(-child.pid, 'SIGTERM')
      await Promise.race([once(child, 'exit'), setTimeout(5000)])
      if (child.exitCode === null && child.signalCode === null) process.kill(-child.pid, 'SIGKILL')
    }
  }
}
