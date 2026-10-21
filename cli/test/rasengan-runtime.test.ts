import { spawn, spawnSync } from 'node:child_process'
import { once } from 'node:events'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { parseEnv } from 'node:util'
import { expect, test } from 'vitest'

type RuntimeRequest = (path: string, body?: unknown) => Promise<Response>

async function assertAuthentication(
  request: RuntimeRequest,
  emailLink: (prefix: string) => URL,
): Promise<void> {
  const home = await request('/')
  expect(home.status).toBe(200)
  const document = await home.text()
  expect(document).toContain('A clear place to start.')
  expect(document).toContain('<title>App</title>')
  expect(document).not.toContain('<title>undefined</title>')
  expect(await (await request('/auth/sign-in')).text()).toContain('name="email"')
  expect((await request('/dashboard')).status).toBe(302)
  const credentials = {
    name: 'Emma Laurent',
    email: `emma.laurent.${crypto.randomUUID()}@example.com`,
    password: 'Cedar-River-47!',
  }
  expect((await request('/api/auth/sign-up/email', credentials)).status).toBe(200)
  expect((await request('/api/auth/sign-in/email', credentials)).status).toBe(403)
  const verification = emailLink('/api/auth/verify-email')
  expect((await request(verification.pathname + verification.search)).status).toBe(302)
  const dashboard = await request('/dashboard')
  expect(dashboard.status).toBe(200)
  expect(await dashboard.text()).toContain('Emma Laurent')
  expect((await request('/api/auth/sign-out', {})).status).toBe(200)
  expect((await request('/dashboard')).status).toBe(302)
  expect(
    (
      await request('/api/auth/request-password-reset', {
        email: credentials.email,
        redirectTo: '/auth/reset-password',
      })
    ).status,
  ).toBe(200)
  const reset = emailLink('/api/auth/reset-password/')
  const token = reset.pathname.split('/').at(-1)
  expect(
    (await request('/api/auth/reset-password', { token, newPassword: 'Maple-River-58!' })).status,
  ).toBe(200)
  expect((await request('/api/auth/sign-in/email', credentials)).status).toBe(401)
  expect(
    (await request('/api/auth/sign-in/email', { ...credentials, password: 'Maple-River-58!' }))
      .status,
  ).toBe(200)
}

async function assertPrivateFiles(
  application: string,
  configuration: Readonly<Record<string, string | undefined>>,
  request: RuntimeRequest,
): Promise<void> {
  const serverFiles = readdirSync(join(application, 'dist/server'), { recursive: true }).filter(
    (file) => typeof file === 'string' && file.endsWith('.js'),
  )
  for (const file of serverFiles) expect((await request(`/server/${file}`)).status).toBe(404)
  for (const file of readdirSync(join(application, 'dist/client/assets'))) {
    if (!file.endsWith('.js')) continue
    const contents = readFileSync(join(application, 'dist/client/assets', file), 'utf8')
    for (const secret of [configuration.DATABASE_URL, configuration.BETTER_AUTH_SECRET])
      if (secret) expect(contents).not.toContain(secret)
    expect(contents).not.toMatch(/drizzle-orm|node-postgres|createAuth\(/)
  }
}

test.skipIf(process.env.RUN_RASENGAN_RUNTIME !== '1')(
  'the production application verifies accounts, protects SSR, resets passwords, and keeps server code private',
  async () => {
    const application = fileURLToPath(new URL('../../apps/rasengan-base/', import.meta.url))
    const root = mkdtempSync(join(tmpdir(), 'create-stack-rasengan-runtime-'))
    const outbox = join(root, 'message.html')
    const interceptor = join(root, 'mail-provider.mjs')
    writeFileSync(
      interceptor,
      `import { writeFileSync } from 'node:fs'
const original = globalThis.fetch
globalThis.fetch = async (input, options) => {
  const url = input instanceof Request ? input.url : String(input)
  if (url.startsWith('https://api.resend.com/emails')) {
    const body = JSON.parse(String(options.body))
    if (typeof body.html !== 'string') throw new Error('Missing email HTML')
    writeFileSync(${JSON.stringify(outbox)}, body.html)
    return Response.json({ id: crypto.randomUUID() })
  }
  return original(input, options)
}
`,
    )
    const envFile = existsSync(join(application, '.env.test.local'))
      ? '.env.test.local'
      : '.env.test'
    const configuration = parseEnv(readFileSync(join(application, envFile), 'utf8'))
    expect(configuration.DATABASE_URL).toMatch(/\/(?:[a-z0-9_]+)_test$/)
    const invalid = spawnSync(process.execPath, ['scripts/start.ts'], {
      cwd: application,
      env: { ...process.env, ...configuration, DATABASE_URL: 'invalid-database-address' },
      encoding: 'utf8',
      timeout: 5000,
    })
    expect(invalid.status).not.toBe(0)
    expect(invalid.stderr).toContain('Invalid environment variables')
    const port = configuration.PORT ?? '3097'
    const origin = `http://127.0.0.1:${port}`
    const child = spawn(process.execPath, ['--import', interceptor, 'scripts/start.ts'], {
      cwd: application,
      env: {
        ...process.env,
        ...configuration,
        PORT: port,
        HOST: '127.0.0.1',
        BETTER_AUTH_URL: origin,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let output = ''
    for (const stream of [child.stdout, child.stderr])
      stream.on('data', (chunk: Buffer) => {
        output += chunk.toString()
      })
    const cookies = new Map<string, string>()
    async function request(path: string, body?: unknown): Promise<Response> {
      const response = await fetch(new URL(path, origin), {
        ...(body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }),
        headers: {
          origin,
          'content-type': 'application/json',
          cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join('; '),
        },
        redirect: 'manual',
      })
      for (const cookie of response.headers.getSetCookie()) {
        const pair = cookie.split(';')[0] ?? ''
        const separator = pair.indexOf('=')
        cookies.set(pair.slice(0, separator), pair.slice(separator + 1))
      }
      return response
    }
    function emailLink(prefix: string): URL {
      const html = readFileSync(outbox, 'utf8')
      expect(html).toContain('Instrument Sans')
      const match = [...html.matchAll(/href="(http[^"]+)"/g)]
        .flatMap((value) => (value[1] ? [new URL(value[1].replaceAll('&amp;', '&'))] : []))
        .find((url) => url.pathname.startsWith(prefix))
      if (!match) throw new Error(`Missing ${prefix} link`)
      return match
    }
    try {
      for (let attempt = 0; attempt < 100; attempt++) {
        if (child.exitCode !== null) throw new Error(output)
        if (output.includes(origin)) break
        await delay(50)
      }
      await assertAuthentication(request, emailLink)
      await assertPrivateFiles(application, configuration, request)
    } finally {
      if (child.exitCode === null) {
        child.kill('SIGTERM')
        await once(child, 'exit')
      }
      rmSync(root, { recursive: true, force: true })
    }
  },
  30_000,
)
