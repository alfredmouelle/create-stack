import type { StackConfiguration } from '@alfredmouelle/stack-config'
import { afterEach, describe, expect, it } from 'vitest'
import {
  ANALYTICS_CONSENT_STORAGE_KEY,
  commandCopiedProperties,
  getAnalyticsConsent,
  isProductionOrigin,
  setAnalyticsConsent,
} from './analytics'
import type { BuildState } from './build-config'

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')

function installWindow() {
  const values = new Map<string, string>()
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
  }

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage: storage } as unknown as Window,
  })
}

afterEach(() => {
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow)
  else Reflect.deleteProperty(globalThis, 'window')
})

describe('marketing analytics consent', () => {
  it('stores only versioned consent choices', () => {
    installWindow()

    expect(getAnalyticsConsent()).toBeNull()
    setAnalyticsConsent('accepted')
    expect(getAnalyticsConsent()).toBe('accepted')

    window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, 'legacy:accepted')
    expect(getAnalyticsConsent()).toBeNull()

    setAnalyticsConsent('rejected')
    expect(getAnalyticsConsent()).toBe('rejected')
  })

  it('only enables capture on the production hostname', () => {
    expect(isProductionOrigin({ hostname: 'create-stack.alfredmouelle.com' })).toBe(true)
    expect(isProductionOrigin({ hostname: 'localhost' })).toBe(false)
    expect(isProductionOrigin({ hostname: 'staging.create-stack.alfredmouelle.com' })).toBe(false)
  })
})

describe('command copied properties', () => {
  it('keeps useful stack dimensions without sending the project name or command', () => {
    const state: BuildState = {
      projectName: 'private-project-name',
      packageManager: 'pnpm',
      monorepo: 'turbo',
      capabilities: { analytics: 'posthog', storage: 'r2' },
    }
    const configuration: StackConfiguration = {
      framework: 'tanstack',
      database: 'drizzle',
      auth: 'better-auth',
      trpc: true,
      mailer: 'resend',
      minimal: false,
    }

    const properties = commandCopiedProperties({
      configuration,
      packageManager: state.packageManager,
      source: 'wizard',
      state,
    })

    expect(properties).toMatchObject({
      source: 'wizard',
      pm: 'pnpm',
      framework: 'tanstack',
      monorepo: 'turbo',
      capabilities: ['analytics:posthog', 'storage:r2'],
    })
    expect(properties).not.toHaveProperty('projectName')
    expect(properties).not.toHaveProperty('command')
    expect(properties.stack).toContain('storage:r2')
  })
})
