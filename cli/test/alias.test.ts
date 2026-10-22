import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, describe, expect, test } from 'vitest'
import { detectAlias, rewriteAlias } from '../src/index.ts'
import { addCapability, build, cleanup, read, srcFiles } from './helpers.ts'
import { readField } from './json.ts'

afterAll(cleanup)

const OLD_SPECIFIER = /['"`]~\//

for (const framework of ['tanstack', 'next'] as const) {
  describe(framework, () => {
    test('a custom alias rewrites source + configs, leaving no ~/', async () => {
      const { dir } = await build({ name: 'aliased', framework, alias: '@' })

      expect(detectAlias(dir)).toBe('@')
      for (const v of Object.values(readField(`${dir}/components.json`, 'aliases'))) {
        expect(typeof v === 'string' && v.startsWith('@/')).toBe(true)
      }

      const srcs = srcFiles(dir)
      const usingNew = srcs.filter((f) => read(`${dir}/${f}`).includes("'@/"))
      expect(usingNew.length).toBeGreaterThan(0)
      for (const rel of [...srcs, 'tsconfig.json', 'components.json']) {
        expect(OLD_SPECIFIER.test(read(`${dir}/${rel}`)), `stray ~/ in ${rel}`).toBe(false)
      }
    })

    test('a custom alias leaves declared build output untouched', async () => {
      const { dir } = await build({ name: 'built', framework })
      const outputs = { tanstack: '.output/server', next: '.next/server' }[framework]
      const chunk = join(dir, outputs, 'chunk.js')
      mkdirSync(join(dir, outputs), { recursive: true })
      writeFileSync(chunk, "import { env } from '~/env'\n")

      rewriteAlias(dir, '@')

      expect(read(chunk)).toBe("import { env } from '~/env'\n")
    })

    test('the default ~ alias is a no-op', async () => {
      const { dir } = await build({ name: 'plain', framework })
      expect(detectAlias(dir)).toBe('~')
      expect(rewriteAlias(dir, '~')).toBe(0)
    })

    test('add vendors against the project alias, not ~/', async () => {
      const { dir } = await build({
        name: 'add-aliased',
        framework,
        alias: '@',
        trpc: false,
        mailer: 'resend',
      })
      addCapability({ projectDir: dir, cap: 'storage', adapter: 's3', keep: false })

      const vendored = srcFiles(dir).filter((f) => f.startsWith('src/server/storage'))
      expect(vendored.length).toBeGreaterThan(0)
      expect(vendored.some((f) => read(`${dir}/${f}`).includes('@/env'))).toBe(true)
      for (const rel of srcFiles(dir)) {
        expect(OLD_SPECIFIER.test(read(`${dir}/${rel}`)), `stray ~/ in ${rel}`).toBe(false)
      }
    })
  })
}

test('adds capabilities without corrupting an inline tsconfig paths object', async () => {
  const { dir } = await build({ name: 'customer-portal', framework: 'next' })
  writeFileSync(join(dir, 'tsconfig.json'), '{"compilerOptions":{"paths":{"@/*":["./src/*"]}}}\n')
  expect(detectAlias(dir)).toBe('@')
  addCapability({ projectDir: dir, cap: 'logger', adapter: 'console', keep: false })
  expect(readField(join(dir, 'tsconfig.json'), 'compilerOptions')).toEqual({
    paths: { '@/*': ['./src/*'] },
  })
})
