import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { detectPackageManager } from '../lib/package-manager.mjs'

describe('detectPackageManager', () => {
  let saved
  beforeEach(() => {
    saved = process.env.npm_config_user_agent
  })
  afterEach(() => {
    if (saved === undefined) delete process.env.npm_config_user_agent
    else process.env.npm_config_user_agent = saved
  })

  for (const [ua, name] of [
    ['pnpm/9.1.0 npm/? node/v22', 'pnpm'],
    ['yarn/1.22.0 npm/? node/v22', 'yarn'],
    ['bun/1.1.0 npm/? node/v22', 'bun'],
    ['npm/10.0.0 node/v22', 'npm'],
  ]) {
    test(`${ua.split('/')[0]} → ${name}`, () => {
      process.env.npm_config_user_agent = ua
      expect(detectPackageManager().name).toBe(name)
    })
  }

  test('unknown / unset → npm default', () => {
    process.env.npm_config_user_agent = 'deno/2'
    expect(detectPackageManager().name).toBe('npm')
    delete process.env.npm_config_user_agent
    expect(detectPackageManager().name).toBe('npm')
  })

  test('exposes a script runner + dev command', () => {
    process.env.npm_config_user_agent = 'pnpm/9'
    const pm = detectPackageManager()
    expect(pm.runArgs('typecheck')).toContain('typecheck')
    expect(pm.devCmd).toBe('pnpm dev')
  })
})
