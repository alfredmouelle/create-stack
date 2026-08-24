import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'
import { assertMarketingResponse } from './http-checks.mjs'

const packageRoot = fileURLToPath(new URL('..', import.meta.url))
const port = process.env.MARKETING_SMOKE_PORT ?? '4321'
const localUrl = `http://127.0.0.1:${port}/`
const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

async function waitForPreview(url, child) {
  const deadline = Date.now() + 30_000

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Astro preview exited before becoming ready (code ${child.exitCode})`)
    }

    try {
      const response = await fetch(url)
      if (response.status >= 200 && response.status < 500) return
    } catch {
      // The preview server is still starting.
    }

    await sleep(250)
  }

  throw new Error(`Astro preview did not become ready at ${url}`)
}

async function stopPreview(child) {
  if (child.exitCode !== null) return

  child.kill('SIGTERM')
  await Promise.race([once(child, 'close'), sleep(5_000)])

  if (child.exitCode === null) child.kill('SIGKILL')
}

const preview = spawn(
  pnpmCommand,
  ['exec', 'astro', 'preview', '--host', '127.0.0.1', '--port', port],
  {
    cwd: packageRoot,
    env: { ...process.env, ASTRO_PREVIEW_BACKGROUND: 'false' },
    stdio: 'inherit',
  },
)

try {
  await waitForPreview(localUrl, preview)
  const result = await assertMarketingResponse(localUrl)
  process.stdout.write(`[marketing] local HTTP smoke passed for public build (${result.url})\n`)
} catch (error) {
  console.error(
    `[marketing] local HTTP smoke failed: ${error instanceof Error ? error.message : error}`,
  )
  process.exitCode = 1
} finally {
  await stopPreview(preview)
}
