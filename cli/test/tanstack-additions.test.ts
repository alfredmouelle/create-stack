import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { afterAll, expect, test } from 'vitest'
import { isJsonObject, type JsonObject } from '../src/javascript/json.ts'
import { cleanupAcceptanceFixtures, createAcceptanceFixture, runCli } from './acceptance.ts'
import { readField, readJson } from './json.ts'

type Contract = {
  files: Record<string, string>
  dependencies: JsonObject
  environment: JsonObject
  manualSteps: string[]
}

const objectOf = (value: unknown): JsonObject => (isJsonObject(value) ? value : {})
const stringRecord = (value: unknown): Record<string, string> =>
  Object.fromEntries(
    Object.entries(objectOf(value)).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  )
const stringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
const toContract = (value: unknown): Contract => {
  const raw = objectOf(value)
  return {
    files: stringRecord(raw.files),
    dependencies: objectOf(raw.dependencies),
    environment: objectOf(raw.environment),
    manualSteps: stringList(raw.manualSteps),
  }
}

const baselineFixture = readJson(
  fileURLToPath(new URL('./fixtures/tanstack-additions-v0.15.0.json', import.meta.url)),
)
const baseline = {
  release: baselineFixture.release,
  legacyProject: stringRecord(baselineFixture.legacyProject),
  additions: Object.entries(objectOf(baselineFixture.additions)).map(
    ([selection, contract]): [string, Contract] => [selection, toContract(contract)],
  ),
}

const mailFilesChangedSinceBaseline: Record<string, string> = {
  'src/server/email/adapters/resend.ts':
    '6ae02bd2a254df846a48c507e1278edd42362baf0c8a912ba7b6b28629c47d9e',
  'src/server/email/address.ts': 'ba8403a8555b8efd0f955c375f6df8c537e6a791ee8cf3b53df67844dbbace55',
  'src/server/email/factory.ts': '826965785264085fad8b5a442bcc7a15adbf6eed4bc40647b1e2795ad197b8bf',
  'src/server/email/port.ts': 'a05d0a2124bdd78fa598652c8b83a5d8864b21ffa87591906af8e0ac3ce4e0a5',
}
const mailIndexesChangedSinceBaseline: Record<string, string> = {
  'mail=resend': 'f36f918c11fa1987500b78c6f0d90f9d18ce1390bebadac57ea95902137aaa63',
  'mail=brevo': 'a053fafae24bd6c7781b02acede6ad5485d8bd3864d2dedd9b2f6b4701007e51',
  'mail=ses': 'b5c4d28352fe24acfe437378bb26c9777a511d92ac9417a8460de178ae03854e',
}
const expectedDigest = (selection: string, path: string, digest: string): string =>
  (path === 'src/server/email/index.ts'
    ? mailIndexesChangedSinceBaseline[selection]
    : mailFilesChangedSinceBaseline[path]) ?? digest
const hash = (path: string): string => {
  const content = readFileSync(path)
  const normalized = path.endsWith(join('src', 'env.ts'))
    ? content
        .toString('utf8')
        .replace('Boolean(process.env.SKIP_ENV_VALIDATION)', '!!process.env.SKIP_ENV_VALIDATION')
    : content
  return createHash('sha256').update(normalized).digest('hex')
}

afterAll(cleanupAcceptanceFixtures)

function files(directory: string, prefix = ''): string[] {
  return readdirSync(join(directory, prefix), { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? files(directory, join(prefix, entry.name)) : [join(prefix, entry.name)],
  )
}

function project(release: unknown) {
  const fixture = createAcceptanceFixture('standalone')
  if (release === baseline.release) {
    for (const [path, content] of Object.entries(baseline.legacyProject)) {
      const destination = join(fixture.app, path)
      mkdirSync(dirname(destination), { recursive: true })
      writeFileSync(destination, content)
    }
  } else {
    const created = runCli({
      cwd: fixture.root,
      target: fixture.app,
      args: ['project', '--framework', 'tanstack', '--minimal', '--no-install', '--no-git'],
    })
    expect(created.exitStatus, created.stderr || created.stdout).toBe(0)
  }
  return fixture
}

test.each(
  [baseline.release, 'current'].flatMap((release) =>
    baseline.additions.map(([selection, contract]) => [release, selection, contract] as const),
  ),
)('adds %s project %s with compatible files and wiring', (release, selection, contract) => {
  const fixture = project(release)
  const beforeFiles = new Set(files(fixture.app))
  const beforeDependencies = readField(join(fixture.app, 'package.json'), 'dependencies')

  const result = runCli({
    cwd: fixture.app,
    target: fixture.app,
    args: ['add', '--with', selection, '--no-install'],
  })

  expect(result.exitStatus, result.stderr || result.stdout).toBe(0)
  const added = files(fixture.app)
    .filter((path) => !beforeFiles.has(path))
    .sort()
  expect(Object.fromEntries(added.map((path) => [path, hash(join(fixture.app, path))]))).toEqual(
    Object.fromEntries(
      Object.entries(contract.files).map(([path, digest]) => [
        path,
        expectedDigest(selection, path, digest),
      ]),
    ),
  )
  const dependencies = readField(join(fixture.app, 'package.json'), 'dependencies')
  expect(
    Object.fromEntries(
      Object.entries(dependencies).filter(([name]) => !(name in beforeDependencies)),
    ),
  ).toEqual(contract.dependencies)
  expect(
    Object.fromEntries(
      ['src/env.ts', '.env.example', '.env', '.env.test']
        .filter((path) => existsSync(join(fixture.app, path)))
        .map((path) => [path, hash(join(fixture.app, path))]),
    ),
  ).toEqual(contract.environment)
  const output = result.stdout.replace(/\s+/g, ' ')
  for (const step of contract.manualSteps) expect(output).toContain(step)
})

test.each([false, true])('TanStack provider changes honor keep-files=%s', (keepFiles) => {
  const fixture = project('current')
  const add = (args: readonly string[]) =>
    runCli({ cwd: fixture.app, target: fixture.app, args: ['add', ...args, '--no-install'] })
  expect(add(['--with', 'storage=gcs', '--with', 'mail=brevo']).exitStatus).toBe(0)
  const customFile = join(fixture.app, 'src/server/email/invoice-subject.ts')
  const customContent = "export const invoiceSubject = 'Your monthly invoice'\n"
  writeFileSync(customFile, customContent)

  const result = add([
    '--with',
    'storage=r2',
    '--with',
    'mail=ses',
    ...(keepFiles ? ['--keep-files'] : []),
  ])

  expect(result.exitStatus, result.stderr || result.stdout).toBe(0)
  for (const path of ['src/server/storage/adapters/gcs.ts', 'src/server/email/adapters/brevo.ts'])
    expect(existsSync(join(fixture.app, path)), path).toBe(keepFiles)
  for (const path of ['src/server/storage/adapters/r2.ts', 'src/server/email/adapters/ses.ts'])
    expect(existsSync(join(fixture.app, path)), path).toBe(true)
  const dependencies = readField(join(fixture.app, 'package.json'), 'dependencies')
  for (const name of ['@google-cloud/storage', '@getbrevo/brevo'])
    expect(name in dependencies, name).toBe(keepFiles)
  for (const name of [
    '@aws-sdk/client-s3',
    '@aws-sdk/s3-request-presigner',
    '@aws-sdk/client-sesv2',
  ])
    expect(dependencies[name], name).toMatch(/^\d+\.\d+\.\d+$/)
  expect(readFileSync(customFile, 'utf8')).toBe(customContent)
})

test('rejects a batch before mutation when its framework does not support an addition', () => {
  const fixture = project('current')
  const preload = join(fixture.root, 'framework-support.mjs')
  const registry = new URL('../src/framework-registry.ts', import.meta.url).href
  writeFileSync(
    preload,
    `import { getFrameworkModule } from '${registry}'
const module = getFrameworkModule('tanstack')
Object.defineProperty(module, 'additions', {
  value: {
    ...module.additions,
    capabilities: Object.fromEntries(
      Object.entries(module.additions.capabilities).filter(([name]) => name !== 'http'),
    ),
  },
})
`,
  )

  const result = runCli({
    cwd: fixture.app,
    target: fixture.app,
    args: ['add', '--with', 'storage=r2', '--with', 'http', '--no-install'],
    env: {
      NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import=${pathToFileURL(preload).href}`,
    },
  })

  expect(result.exitStatus).toBe(1)
  expect(result.stdout).toContain('TanStack Start does not support addition http')
  expect(result.targetMutated).toBe(false)
})
