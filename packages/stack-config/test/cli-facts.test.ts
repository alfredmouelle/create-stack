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
  SCAFFOLD_FLAGS,
  scaffoldFlagSpellings,
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

describe('scaffold flags', () => {
  test('declares every creation option the CLI accepts, grouped by section', () => {
    expect(
      SCAFFOLD_FLAGS.map((flag) => ({
        section: flag.section,
        spellings: scaffoldFlagSpellings(flag),
      })),
    ).toEqual([
      { section: 'stack', spellings: ['framework', 'f'] },
      { section: 'stack', spellings: ['database', 'db', 'no-db'] },
      { section: 'stack', spellings: ['auth', 'no-auth'] },
      { section: 'stack', spellings: ['trpc', 'no-trpc'] },
      { section: 'stack', spellings: ['mailer', 'mail', 'no-mail'] },
      { section: 'stack', spellings: ['formatter'] },
      { section: 'stack', spellings: ['linter'] },
      { section: 'stack', spellings: ['minimal'] },
      { section: 'capability', spellings: ['storage'] },
      { section: 'capability', spellings: ['cache'] },
      { section: 'capability', spellings: ['logger'] },
      { section: 'capability', spellings: ['analytics'] },
      { section: 'capability', spellings: ['jobs'] },
      { section: 'capability', spellings: ['errors', 'error-tracking'] },
      { section: 'project', spellings: ['monorepo', 'mono'] },
      { section: 'project', spellings: ['pm', 'package-manager'] },
      { section: 'project', spellings: ['alias'] },
      { section: 'project', spellings: ['no-install'] },
      { section: 'project', spellings: ['no-git'] },
      { section: 'project', spellings: ['yes', 'y'] },
    ])
  })

  test('takes accepted values from the shared stack facts', () => {
    const values = Object.fromEntries(SCAFFOLD_FLAGS.map(({ name, value }) => [name, value]))
    expect(values).toMatchObject({
      framework: { kind: 'choice', choices: ['tanstack', 'next', 'rasengan', 'remix'] },
      monorepo: { kind: 'choice', choices: ['turbo', 'nx'] },
      pm: { kind: 'choice', choices: ['pnpm', 'npm', 'yarn', 'bun'] },
      storage: { kind: 'choice', choices: ['s3', 'r2', 'gcs', 'local'] },
      alias: { kind: 'text', placeholder: 'prefix' },
      trpc: { kind: 'none' },
      yes: { kind: 'none' },
    })
  })
})
