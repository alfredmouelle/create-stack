// The site's command builder is hand-maintained; this proves the flags it emits
// are still the flags the CLI accepts.
import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import { resolveAdapter } from '../lib/capabilities.mjs'

const html = readFileSync(new URL('../../site/index.html', import.meta.url), 'utf8')
const CAPS = [
  ...html.matchAll(
    /\{ key: '\w+', flag: '([\w-]+)',.*?adapters: \[([^\]]*)\], def: '([\w-]+)' \}/g,
  ),
]

test('the site advertises capabilities the CLI knows', () => {
  expect(CAPS.length).toBe(6)
  for (const [, flag, list, def] of CAPS) {
    const adapters = [...list.matchAll(/'([\w-]+)'/g)].map((m) => m[1])
    // the default emits a bare flag
    expect(() => resolveAdapter(flag, true), `--${flag}`).not.toThrow()
    for (const a of adapters) {
      if (a === def) continue
      expect(() => resolveAdapter(flag, a), `--${flag} ${a}`).not.toThrow()
    }
  }
})

test('the site offers no adapter for a single-provider capability', () => {
  for (const [, flag, list] of CAPS) {
    const adapters = [...list.matchAll(/'([\w-]+)'/g)].map((m) => m[1])
    if (resolveAdapter(flag, true) === null) {
      expect(adapters.length, `${flag} must offer exactly one chip`).toBe(1)
    }
  }
})
