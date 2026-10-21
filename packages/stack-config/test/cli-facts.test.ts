import { describe, expect, test } from 'vitest'
import cliPackage from '../../../cli/package.json' with { type: 'json' }
import mailerManifest from '../../mailer/capability.json' with { type: 'json' }
import {
  CAPABILITY_CATALOG,
  DEFAULT_IMPORT_ALIAS,
  isValidImportAlias,
  MAILERS,
  MINIMUM_NODE_VERSION,
  normalizeImportAlias,
} from '../src/index.js'

describe('CLI facts', () => {
  test('declares the minimum Node version the CLI package requires', () => {
    expect(cliPackage.engines.node).toBe(`>=${MINIMUM_NODE_VERSION}`)
  })

  test('reads capability providers and recommendations from the capability manifests', () => {
    expect(CAPABILITY_CATALOG).toEqual([
      {
        name: 'storage',
        kind: 'port',
        flags: ['storage'],
        providers: ['s3', 'r2', 'gcs', 'local'],
        recommendedProvider: 'r2',
      },
      {
        name: 'cache',
        kind: 'port',
        flags: ['cache'],
        providers: ['redis', 'upstash', 'memory'],
        recommendedProvider: 'upstash',
      },
      {
        name: 'logger',
        kind: 'port',
        flags: ['logger'],
        providers: ['pino', 'console'],
        recommendedProvider: 'pino',
      },
      {
        name: 'analytics',
        kind: 'port',
        flags: ['analytics'],
        providers: ['posthog', 'plausible', 'noop'],
        recommendedProvider: 'posthog',
      },
      {
        name: 'jobs',
        kind: 'module',
        flags: ['jobs'],
        providers: ['inngest'],
        recommendedProvider: 'inngest',
      },
      {
        name: 'error-tracking',
        kind: 'module',
        flags: ['errors', 'error-tracking'],
        providers: ['sentry'],
        recommendedProvider: 'sentry',
      },
    ])
  })

  test('declares the mailers the mailer manifest provides', () => {
    expect(Object.keys(mailerManifest.adapters)).toEqual(
      MAILERS.filter((mailer) => mailer !== 'none'),
    )
  })
})

describe('import alias', () => {
  test.each(['~', '@', '#', '@app', '~/', '#src//', 'my-alias'])('accepts %s', (alias) => {
    expect(isValidImportAlias(alias)).toBe(true)
  })

  test.each(['', ' ', '@/app', 'app.alias', 'src lib', '$'])('rejects %j', (alias) => {
    expect(isValidImportAlias(alias)).toBe(false)
  })

  test('trims whitespace and trailing slashes', () => {
    expect(normalizeImportAlias(' @app// ')).toBe('@app')
  })

  test('defaults to the tilde prefix', () => {
    expect(DEFAULT_IMPORT_ALIAS).toBe('~')
  })
})
