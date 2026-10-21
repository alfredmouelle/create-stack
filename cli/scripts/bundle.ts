import { execFileSync } from 'node:child_process'
import { cpSync, mkdirSync, rmSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(process.env.CREATE_STACK_BUNDLE_ROOT || resolve(here, '..', '..'))
const OUT = resolve(process.env.CREATE_STACK_BUNDLE_OUT || resolve(here, '..', '_stack'))
const { frameworkAssetExcludes, frameworkModules }: typeof import('../src/framework-registry.ts') =
  await import(pathToFileURL(join(ROOT, 'cli/src/framework-registry.ts')).href)
const { generateRegistry }: typeof import('../src/lib/registry.ts') = await import(
  pathToFileURL(join(ROOT, 'cli/src/lib/registry.ts')).href
)

const APP_EXCLUDES = new Set([
  'node_modules',
  'dist',
  '.turbo',
  'turbo.json',
  'start-database.sh',
  ...frameworkModules.flatMap(frameworkAssetExcludes),
])
const isEnvFile = (name: string): boolean => name === '.env' || name.startsWith('.env.')

const copyApp = (from: string, to: string): void =>
  cpSync(from, to, {
    recursive: true,
    filter: (src) => {
      const base = basename(src)
      return !APP_EXCLUDES.has(base) && !base.endsWith('.tsbuildinfo') && !isEnvFile(base)
    },
  })

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

execFileSync(
  'pnpm',
  ['--filter', '@alfredmouelle/create-stack', 'exec', 'tsdown', '--out-dir', join(OUT, 'engine')],
  { cwd: ROOT, stdio: 'inherit' },
)

for (const asset of new Set(frameworkModules.flatMap(({ packagedAssets }) => packagedAssets))) {
  copyApp(join(ROOT, asset), join(OUT, asset))
}

cpSync(join(ROOT, 'packages/mailer/capability.json'), join(OUT, 'packages/mailer/capability.json'))
cpSync(join(ROOT, 'packages/mailer/package.json'), join(OUT, 'packages/mailer/package.json'))
cpSync(join(ROOT, 'packages/mailer/src/adapters'), join(OUT, 'packages/mailer/src/adapters'), {
  recursive: true,
})

for (const cap of ['storage', 'cache', 'logger', 'analytics', 'error-tracking', 'jobs']) {
  cpSync(
    join(ROOT, 'packages', cap, 'capability.json'),
    join(OUT, 'packages', cap, 'capability.json'),
  )
  cpSync(join(ROOT, 'packages', cap, 'package.json'), join(OUT, 'packages', cap, 'package.json'))
  cpSync(join(ROOT, 'packages', cap, 'src'), join(OUT, 'packages', cap, 'src'), { recursive: true })
}

for (const pkg of ['http', 'email-ui']) {
  cpSync(
    join(ROOT, 'packages', pkg, 'capability.json'),
    join(OUT, 'packages', pkg, 'capability.json'),
  )
  cpSync(join(ROOT, 'packages', pkg, 'package.json'), join(OUT, 'packages', pkg, 'package.json'))
  cpSync(join(ROOT, 'packages', pkg, 'src'), join(OUT, 'packages', pkg, 'src'), { recursive: true })
}

generateRegistry({ rootDir: ROOT, outputDir: join(OUT, 'registry') })

// biome-ignore lint/suspicious/noConsole: build script output
console.log(`bundled stack assets → ${OUT}`)
