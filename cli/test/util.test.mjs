import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, test } from 'vitest'
import { copyTree, isDirEmpty, pkgAddDeps, pkgRemoveDeps, pkgRemoveScripts } from '../lib/util.mjs'

const tmps = []
const mkTmp = () => {
  const d = mkdtempSync(join(tmpdir(), 'cs-util-'))
  tmps.push(d)
  return d
}
afterAll(() => {
  for (const d of tmps) rmSync(d, { recursive: true, force: true })
})

describe('package.json helpers', () => {
  test('pkgAddDeps adds into dependencies', () => {
    const pkg = {}
    pkgAddDeps(pkg, { resend: '^4.0.0' })
    expect(pkg.dependencies).toEqual({ resend: '^4.0.0' })
  })
  test('pkgRemoveDeps strips from both dep fields', () => {
    const pkg = { dependencies: { a: '1', b: '2' }, devDependencies: { a: '1', c: '3' } }
    pkgRemoveDeps(pkg, ['a'])
    expect(pkg.dependencies).toEqual({ b: '2' })
    expect(pkg.devDependencies).toEqual({ c: '3' })
  })
  test('pkgRemoveScripts deletes named scripts', () => {
    const pkg = { scripts: { build: 'x', 'db:seed': 'y' } }
    pkgRemoveScripts(pkg, ['db:seed'])
    expect(pkg.scripts).toEqual({ build: 'x' })
  })
})

describe('isDirEmpty', () => {
  test('absent dir is empty', () => {
    expect(isDirEmpty(join(mkTmp(), 'nope'))).toBe(true)
  })
  test('ignores noise files', () => {
    const d = mkTmp()
    writeFileSync(join(d, '.DS_Store'), '')
    expect(isDirEmpty(d)).toBe(true)
  })
  test('real file makes it non-empty', () => {
    const d = mkTmp()
    writeFileSync(join(d, 'x.txt'), 'hi')
    expect(isDirEmpty(d)).toBe(false)
  })
})

describe('copyTree', () => {
  test('copies a tree but skips excluded basenames', () => {
    const src = mkTmp()
    writeFileSync(join(src, 'keep.ts'), '1')
    const nm = join(src, 'node_modules')
    mkdirSync(nm, { recursive: true })
    writeFileSync(join(nm, 'junk.js'), '2')

    const dest = join(mkTmp(), 'out')
    copyTree(src, dest, ['node_modules'])
    const top = readdirSync(dest)
    expect(top).toContain('keep.ts')
    expect(top).not.toContain('node_modules')
  })
})
