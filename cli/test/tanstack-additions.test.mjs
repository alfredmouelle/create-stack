import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterAll, expect, test } from 'vitest'
import { cleanupAcceptanceFixtures, createAcceptanceFixture, runCli } from './acceptance.ts'

const baseline = JSON.parse(
  readFileSync(new URL('./fixtures/tanstack-additions-v0.15.0.json', import.meta.url), 'utf8'),
)
const qualityProfileMailFiles = {
  'src/server/email/adapters/resend.ts':
    'b9a744f68e1c3a6cde02f71727a424c3f2afc78f5acff80adfa872038de9cda4',
  'src/server/email/address.ts': 'ba8403a8555b8efd0f955c375f6df8c537e6a791ee8cf3b53df67844dbbace55',
  'src/server/email/factory.ts': '826965785264085fad8b5a442bcc7a15adbf6eed4bc40647b1e2795ad197b8bf',
  'src/server/email/port.ts': 'a05d0a2124bdd78fa598652c8b83a5d8864b21ffa87591906af8e0ac3ce4e0a5',
}
const hash = (path) => {
  const content = readFileSync(path)
  const normalized = path.endsWith(join('src', 'env.ts'))
    ? content
        .toString('utf8')
        .replace('Boolean(process.env.SKIP_ENV_VALIDATION)', '!!process.env.SKIP_ENV_VALIDATION')
    : content
  return createHash('sha256').update(normalized).digest('hex')
}

afterAll(cleanupAcceptanceFixtures)

function files(directory, prefix = '') {
  return readdirSync(join(directory, prefix), { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? files(directory, join(prefix, entry.name)) : [join(prefix, entry.name)],
  )
}

function project(release) {
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
    Object.entries(baseline.additions).map(([selection, contract]) => [
      release,
      selection,
      contract,
    ]),
  ),
)('adds %s project %s with compatible files and wiring', (release, selection, contract) => {
  const fixture = project(release)
  const beforeFiles = new Set(files(fixture.app))
  const beforeDependencies = JSON.parse(
    readFileSync(join(fixture.app, 'package.json'), 'utf8'),
  ).dependencies

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
        qualityProfileMailFiles[path] ?? digest,
      ]),
    ),
  )
  const { dependencies } = JSON.parse(readFileSync(join(fixture.app, 'package.json'), 'utf8'))
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
  const add = (args) =>
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
  const { dependencies } = JSON.parse(readFileSync(join(fixture.app, 'package.json'), 'utf8'))
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
