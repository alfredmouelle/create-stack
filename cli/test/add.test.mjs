// `create-stack add` engine: vendor a capability into an existing project and merge its
// deps + env incrementally, without disturbing what's already there. Structural + fast;
// the typecheck proof that the merged env.ts compiles lives in smoke.test.mjs.

import { afterAll, describe, expect, test } from 'vitest'
import { addCapability, build, cleanup, exists, read, readJSON } from './helpers.mjs'

afterAll(cleanup)

const envText = (dir) => read(`${dir}/.env.example`)
const serverHas = (dir, key) => new RegExp(`\\n {4}${key}:`).test(read(`${dir}/src/env.ts`))

describe('add', () => {
  test('vendors a capability + merges deps/env', () => {
    const { dir } = build({ framework: 'tanstack', foundations: ['drizzle'], mailer: 'none' })

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
    const { dir } = build({ framework: 'next', foundations: ['drizzle'], mailer: 'none' })
    expect(addCapability({ projectDir: dir, cap: 'cache', adapter: 'redis' }).framework).toBe(
      'next',
    )
    expect(serverHas(dir, 'REDIS_URL')).toBe(true)
  })

  test('a second capability coexists with the first', () => {
    const { dir } = build({ framework: 'tanstack', foundations: ['drizzle'], mailer: 'resend' })
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
    const { dir } = build({ framework: 'tanstack', foundations: ['drizzle'], mailer: 'none' })
    expect(() => addCapability({ projectDir: dir, cap: 'storage', adapter: 'nope' })).toThrow()
  })
})
