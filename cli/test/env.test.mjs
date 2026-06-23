import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, test } from 'vitest'
import { appendEnv, writeEnv } from '../lib/env.mjs'

const tmps = []
afterAll(() => {
  for (const d of tmps) rmSync(d, { recursive: true, force: true })
})

// A throwaway project skeleton with the empty env.ts blocks writeEnv/appendEnv edit.
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'cs-env-'))
  tmps.push(dir)
  mkdirSync(join(dir, 'src'), { recursive: true })
  writeFileSync(
    join(dir, 'src/env.ts'),
    `export const env = createEnv({
  server: {
  },
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
  },
})
`,
  )
  return dir
}
const envTs = (dir) => readFileSync(join(dir, 'src/env.ts'), 'utf8')
const envExample = (dir) => readFileSync(join(dir, '.env.example'), 'utf8')
const count = (s, re) => (s.match(re) || []).length

describe('writeEnv', () => {
  test('required keys skip v.optional; optional keys wrap it', () => {
    const dir = fixture()
    writeEnv(dir, ['DATABASE_URL', 'RESEND_API_KEY'], ['DATABASE_URL'])
    const ts = envTs(dir)
    expect(ts).toContain('DATABASE_URL: v.pipe(v.string(), v.url()),')
    expect(ts).toContain('RESEND_API_KEY: v.optional(')
    expect(ts).toContain('DATABASE_URL: process.env.DATABASE_URL,')
    expect(envExample(dir)).toContain('DATABASE_URL=postgres://')
    expect(envExample(dir)).toContain('RESEND_API_KEY=re_change_me')
  })
})

describe('appendEnv', () => {
  test('adds keys without disturbing existing ones', () => {
    const dir = fixture()
    writeEnv(dir, ['DATABASE_URL'], ['DATABASE_URL'])
    appendEnv(dir, ['REDIS_URL'], [])
    const ts = envTs(dir)
    expect(ts).toContain('DATABASE_URL: v.pipe(v.string(), v.url()),') // untouched
    expect(ts).toContain('REDIS_URL: v.optional(v.pipe(v.string(), v.url())),')
    expect(ts).toContain('REDIS_URL: process.env.REDIS_URL,')
    expect(envExample(dir)).toContain('REDIS_URL=')
  })

  test('required appended key is narrowed', () => {
    const dir = fixture()
    writeEnv(dir, ['DATABASE_URL'], ['DATABASE_URL'])
    appendEnv(dir, ['S3_BUCKET'], ['S3_BUCKET'])
    expect(envTs(dir)).toContain('S3_BUCKET: v.pipe(v.string(), v.minLength(1)),')
  })

  test('is idempotent — re-appending does not duplicate', () => {
    const dir = fixture()
    writeEnv(dir, ['DATABASE_URL'], ['DATABASE_URL'])
    appendEnv(dir, ['REDIS_URL'], [])
    appendEnv(dir, ['REDIS_URL'], [])
    expect(count(envTs(dir), /\n {4}REDIS_URL:/g)).toBe(2) // one in server, one in runtimeEnv
    expect(count(envExample(dir), /^REDIS_URL=/gm)).toBe(1)
  })
})
