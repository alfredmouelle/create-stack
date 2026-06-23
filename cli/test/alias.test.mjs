// The import-alias rewrite: a custom alias reaches source imports, tsconfig paths and
// components.json, with no '~/' left behind; the default '~' is an untouched no-op.

import { afterAll, describe, expect, test } from 'vitest'
import { detectAlias, rewriteAlias } from '../lib/alias.mjs'
import { addCapability, build, cleanup, read, readJSON, srcFiles } from './helpers.mjs'

afterAll(cleanup)

const OLD_SPECIFIER = /['"`]~\//

for (const framework of ['tanstack', 'next']) {
  describe(framework, () => {
    test('a custom alias rewrites source + configs, leaving no ~/', () => {
      const { dir } = build({ name: 'aliased', framework, alias: '@' })

      // tsconfig path mapping + components.json aliases follow the choice
      expect(detectAlias(dir)).toBe('@')
      const components = readJSON(`${dir}/components.json`)
      for (const v of Object.values(components.aliases ?? {})) {
        expect(v.startsWith('@/')).toBe(true)
      }

      // at least one source file imports through the new alias, and none keep '~/'
      const srcs = srcFiles(dir)
      const usingNew = srcs.filter((f) => read(`${dir}/${f}`).includes("'@/"))
      expect(usingNew.length).toBeGreaterThan(0)
      for (const rel of [...srcs, 'tsconfig.json', 'components.json']) {
        expect(OLD_SPECIFIER.test(read(`${dir}/${rel}`)), `stray ~/ in ${rel}`).toBe(false)
      }
    })

    test('the default ~ alias is a no-op', () => {
      const { dir } = build({ name: 'plain', framework })
      expect(detectAlias(dir)).toBe('~')
      // sanity: rewriteAlias is a no-op when alias is '~'
      expect(rewriteAlias(dir, '~')).toBe(0)
    })

    test('add vendors against the project alias, not ~/', () => {
      const { dir } = build({
        name: 'add-aliased',
        framework,
        alias: '@',
        foundations: ['drizzle'],
        mailer: 'resend',
      })
      addCapability({ projectDir: dir, cap: 'storage', adapter: 's3' })

      const vendored = srcFiles(dir).filter((f) => f.startsWith('src/server/storage'))
      expect(vendored.length).toBeGreaterThan(0)
      // the freshly vendored composition root reaches env through the project's '@/' alias
      expect(vendored.some((f) => read(`${dir}/${f}`).includes('@/env'))).toBe(true)
      for (const rel of srcFiles(dir)) {
        expect(OLD_SPECIFIER.test(read(`${dir}/${rel}`)), `stray ~/ in ${rel}`).toBe(false)
      }
    })
  })
}
