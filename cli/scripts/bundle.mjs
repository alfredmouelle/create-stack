import { execFileSync } from 'node:child_process'
import { cpSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateRegistry } from '../lib/registry.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(process.env.CREATE_STACK_BUNDLE_ROOT || resolve(here, '..', '..'))
const OUT = resolve(process.env.CREATE_STACK_BUNDLE_OUT || resolve(here, '..', '_stack'))

const APP_EXCLUDES = new Set([
  'node_modules',
  '.next',
  '.output',
  '.nitro',
  '.tanstack',
  'dist',
  'routeTree.gen.ts',
])
const isEnvFile = (name) => name === '.env' || name.startsWith('.env.')

const copyApp = (from, to) =>
  cpSync(from, to, {
    recursive: true,
    filter: (src) => {
      const base = src.split('/').pop()
      return !APP_EXCLUDES.has(base) && !isEnvFile(base)
    },
  })

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

execFileSync('pnpm', ['--dir', ROOT, '--filter', '@alfredmouelle/stack-config', 'build'], {
  stdio: 'inherit',
})
cpSync(join(ROOT, 'packages/stack-config/dist/index.mjs'), join(OUT, 'stack-config/index.mjs'), {
  recursive: true,
})

for (const base of ['next-base', 'tanstack-base']) {
  copyApp(join(ROOT, 'apps', base), join(OUT, 'apps', base))
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
