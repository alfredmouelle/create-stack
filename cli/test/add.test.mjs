// add engine: vendor into an existing project, merge deps + env without disturbing
// existing keys. The typecheck proof of the merged env.ts lives in smoke.test.mjs.

import { afterAll, describe, expect, test } from 'vitest'
import { addCapability, build, cleanup, exists, read, readJSON } from './helpers.mjs'

afterAll(cleanup)

const envText = (dir) => read(`${dir}/.env.example`)
const serverHas = (dir, key) => new RegExp(`\\n {4}${key}:`).test(read(`${dir}/src/env.ts`))

describe('add', () => {
  test('vendors a capability + merges deps/env', () => {
    const { dir } = build({ framework: 'tanstack', foundations: [], mailer: 'none' })

    const res = addCapability({ projectDir: dir, cap: 'storage', adapter: 's3' })
    expect(res.framework).toBe('tanstack')

    expect(exists(`${dir}/src/server/storage/index.ts`)).toBe(true)
    expect('@aws-sdk/client-s3' in readJSON(`${dir}/package.json`).dependencies).toBe(true)
    // required key narrowed (no v.optional), present in both env.ts blocks + .env
    expect(serverHas(dir, 'S3_BUCKET')).toBe(true)
    expect(read(`${dir}/src/env.ts`)).toContain('S3_BUCKET: process.env.S3_BUCKET,')
    expect(envText(dir)).toContain('S3_BUCKET=')
  })

  test('detects next from deps', () => {
    const { dir } = build({ framework: 'next', foundations: [], mailer: 'none' })
    expect(addCapability({ projectDir: dir, cap: 'cache', adapter: 'redis' }).framework).toBe(
      'next',
    )
    expect(serverHas(dir, 'REDIS_URL')).toBe(true)
  })

  test('a second capability coexists with the first', () => {
    const { dir } = build({ framework: 'tanstack', foundations: [], mailer: 'resend' })
    addCapability({ projectDir: dir, cap: 'storage', adapter: 's3' })
    addCapability({ projectDir: dir, cap: 'cache', adapter: 'redis' })

    // both vendored, and the first one's env survived the second append
    expect(exists(`${dir}/src/server/storage`)).toBe(true)
    expect(exists(`${dir}/src/server/cache`)).toBe(true)
    expect(serverHas(dir, 'S3_BUCKET')).toBe(true)
    expect(serverHas(dir, 'REDIS_URL')).toBe(true)
    expect(serverHas(dir, 'RESEND_API_KEY')).toBe(true) // pre-existing mailer key untouched
  })

  test('rejects an unknown adapter', () => {
    const { dir } = build({ framework: 'tanstack', foundations: [], mailer: 'none' })
    expect(() => addCapability({ projectDir: dir, cap: 'storage', adapter: 'nope' })).toThrow()
  })
})

const deps = (dir) => readJSON(`${dir}/package.json`).dependencies

describe('swap', () => {
  test('re-adding a capability swaps its adapter and drops the old deps', () => {
    const { dir } = build({
      framework: 'next',
      foundations: [],
      mailer: 'none',
      capabilities: { cache: 'redis' },
    })
    const res = addCapability({ projectDir: dir, cap: 'cache', adapter: 'upstash' })

    expect(res.swappedFrom).toBe('redis')
    expect(exists(`${dir}/src/server/cache/adapters/upstash`)).toBe(true)
    expect(exists(`${dir}/src/server/cache/adapters/redis`)).toBe(false) // clean swap
    expect('ioredis' in deps(dir)).toBe(false) // old adapter dep removed
    expect('@upstash/redis' in deps(dir)).toBe(true)
  })

  test('--keep retains the previous adapter and its deps', () => {
    const { dir } = build({
      framework: 'next',
      foundations: [],
      mailer: 'none',
      capabilities: { cache: 'redis' },
    })
    addCapability({ projectDir: dir, cap: 'cache', adapter: 'upstash', keep: true })

    expect(exists(`${dir}/src/server/cache/adapters/redis`)).toBe(true)
    expect(exists(`${dir}/src/server/cache/adapters/upstash`)).toBe(true)
    expect('ioredis' in deps(dir)).toBe(true)
    expect('@upstash/redis' in deps(dir)).toBe(true)
  })

  test('jobs swap drops the inngest serve route + shim', () => {
    const { dir } = build({
      framework: 'next',
      foundations: [],
      mailer: 'none',
      capabilities: { jobs: 'inngest' },
    })
    expect(exists(`${dir}/src/app/api/inngest/route.ts`)).toBe(true)

    addCapability({ projectDir: dir, cap: 'jobs', adapter: 'memory' })
    expect(exists(`${dir}/src/server/jobs/serve.ts`)).toBe(false)
    expect(exists(`${dir}/src/app/api/inngest/route.ts`)).toBe(false)
    expect(read(`${dir}/src/server/jobs/index.ts`)).toContain('memoryAdapter')
  })
})

describe('mailer / lib targets', () => {
  test('mailer swaps the adapter behind the same port', () => {
    const { dir } = build({ framework: 'next', foundations: [], mailer: 'resend' })
    const res = addCapability({ projectDir: dir, cap: 'mailer', adapter: 'brevo' })

    expect(res.swappedFrom).toBe('resend')
    expect(exists(`${dir}/src/server/email/adapters/brevo`)).toBe(true)
    expect(exists(`${dir}/src/server/email/adapters/resend`)).toBe(false)
    expect('@getbrevo/brevo' in deps(dir)).toBe(true)
    expect('resend' in deps(dir)).toBe(false)
    expect(serverHas(dir, 'BREVO_API_KEY')).toBe(true)
  })

  test('mailer can be re-added after being stripped', () => {
    const { dir } = build({ framework: 'next', auth: 'none', foundations: [], mailer: 'none' })
    expect(exists(`${dir}/src/server/email`)).toBe(false)

    addCapability({ projectDir: dir, cap: 'mailer', adapter: 'ses' })
    expect(exists(`${dir}/src/server/email/index.ts`)).toBe(true)
    expect('@aws-sdk/client-sesv2' in deps(dir)).toBe(true)
    expect(serverHas(dir, 'AWS_REGION')).toBe(true)
  })

  test('http vendors the helpers, no deps/env', () => {
    const { dir } = build({ framework: 'tanstack', foundations: [], mailer: 'none' })
    const res = addCapability({ projectDir: dir, cap: 'http', adapter: null })
    expect(exists(`${dir}/src/lib/http/index.ts`)).toBe(true)
    expect(res.envKeys).toEqual([])
  })

  test('email-kit vendors the React Email primitives', () => {
    const { dir } = build({ framework: 'next', foundations: [], mailer: 'resend' })
    addCapability({ projectDir: dir, cap: 'email-kit', adapter: null })
    expect(exists(`${dir}/src/emails/components/index.ts`)).toBe(true)
  })
})
