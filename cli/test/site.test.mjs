// The site's command builder is hand-maintained; this proves the flags it emits
// are still the flags the CLI accepts.
import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import {
  CAPABILITIES,
  canonicalCapabilityName,
  hasAdapters,
  resolveCreationProvider,
} from '../lib/capabilities.mjs'

const html = readFileSync(new URL('../../site/index.html', import.meta.url), 'utf8')
const CAPS = [
  ...html.matchAll(
    /\{ key: '\w+', flag: '([\w-]+)',.*?adapters: \[([^\]]*)\], def: '([\w-]+)' \}/g,
  ),
]
const internalName = (flag) =>
  CAPABILITIES.find((capability) => canonicalCapabilityName(capability) === flag)

test('the site advertises capabilities the CLI knows', () => {
  expect(CAPS.length).toBe(6)
  for (const [, flag, list, def] of CAPS) {
    const capability = internalName(flag)
    expect(capability, `--${flag}`).toBeTruthy()
    const adapters = [...list.matchAll(/'([\w-]+)'/g)].map((m) => m[1])
    // the default emits a bare flag
    expect(resolveCreationProvider(capability, true), `--${flag}`).toBe(def)
    for (const a of adapters) {
      if (a === def) continue
      expect(() => resolveCreationProvider(capability, a), `--${flag} ${a}`).not.toThrow()
    }
  }
})

test('the site offers no adapter for a single-provider capability', () => {
  for (const [, flag, list] of CAPS) {
    const capability = internalName(flag)
    const adapters = [...list.matchAll(/'([\w-]+)'/g)].map((m) => m[1])
    if (!hasAdapters(capability)) {
      expect(adapters.length, `${flag} must offer exactly one chip`).toBe(1)
    }
  }
})
