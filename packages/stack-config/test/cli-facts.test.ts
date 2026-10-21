import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import cliPackage from '../../../cli/package.json' with { type: 'json' }
import mailerManifest from '../../mailer/capability.json' with { type: 'json' }
import {
  CAPABILITY_CATALOG,
  isValidImportAlias,
  MAILERS,
  MINIMUM_NODE_VERSION,
  normalizeImportAlias,
} from '../src/index.js'

const packagesRoot = join(dirname(fileURLToPath(import.meta.url)), '../..')

describe('CLI facts', () => {
  test('reads the minimum Node version from the CLI package engines', () => {
    expect(`>=${MINIMUM_NODE_VERSION}`).toBe(cliPackage.engines.node)
  })

  test('declares the capability flags the CLI accepts', () => {
    expect(
      CAPABILITY_CATALOG.map(({ name, kind, flag, aliases }) => ({ name, kind, flag, aliases })),
    ).toEqual([
      { name: 'storage', kind: 'port', flag: 'storage', aliases: [] },
      { name: 'cache', kind: 'port', flag: 'cache', aliases: [] },
      { name: 'logger', kind: 'port', flag: 'logger', aliases: [] },
      { name: 'analytics', kind: 'port', flag: 'analytics', aliases: [] },
      { name: 'jobs', kind: 'module', flag: 'jobs', aliases: [] },
      { name: 'error-tracking', kind: 'module', flag: 'errors', aliases: ['error-tracking'] },
    ])
  })

  test.each(CAPABILITY_CATALOG)('reads $name providers from its manifest', (capability) => {
    const manifest = JSON.parse(
      readFileSync(join(packagesRoot, capability.name, 'capability.json'), 'utf8'),
    )
    if (capability.kind === 'module') {
      expect(capability.providers).toEqual([manifest.provider])
      expect(capability.recommendedProvider).toBe(manifest.provider)
      return
    }
    expect(capability.providers).toEqual(Object.keys(manifest.adapters))
    expect(capability.recommendedProvider).toBe(
      manifest.creationRecommendedProvider ?? manifest.defaultAdapter,
    )
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
})
