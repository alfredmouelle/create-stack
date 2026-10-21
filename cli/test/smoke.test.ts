import { spawnSync } from 'node:child_process'
import type { Dirent } from 'node:fs'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, test } from 'vitest'
import type { Framework } from '../../packages/stack-config/src/index.ts'
import { frameworkModules, getFrameworkModule } from '../src/framework-registry.ts'
import { assertBrandedSurface, customizeTheme } from './branded-surface.ts'
import { readJson } from './json.ts'

const testDirectory = dirname(fileURLToPath(import.meta.url))
const cliRoot = resolve(testDirectory, '..')
const repoRoot = resolve(cliRoot, '..')
const cliEntry = resolve(cliRoot, 'index.mjs')
const roots: string[] = []

afterAll(
  () => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
  },
  2 * 60 * 1000,
)

function smokeFrameworks(): Framework[] {
  const selected = process.env.SMOKE_FRAMEWORK
  if (!selected) return frameworkModules.map(({ id }) => id)
  const module = frameworkModules.find(({ id }) => id === selected)
  if (!module) throw new Error(`Unknown SMOKE_FRAMEWORK: ${selected}`)
  return [module.id]
}

const FRAMEWORKS = smokeFrameworks()
const TIMEOUT = 15 * 60 * 1000

function run(command: string, args: readonly string[], cwd: string): number | null {
  return spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    timeout: TIMEOUT,
    env: {
      ...process.env,
      CREATE_STACK_STACK_ROOT: repoRoot,
      NO_COLOR: '1',
      npm_config_user_agent: 'pnpm/11.1.3',
    },
  }).status
}

function runCli(args: readonly string[], cwd: string): void {
  expect(run(process.execPath, [cliEntry, ...args], cwd), `create-stack ${args.join(' ')}`).toBe(0)
}

function verify(projectDir: string, { build = false }: { build?: boolean } = {}): void {
  expect(run('pnpm', ['run', 'typecheck'], projectDir), 'installed project typecheck').toBe(0)
  expect(run('pnpm', ['run', 'check'], projectDir), 'installed project format check').toBe(0)
  if (build) expect(run('pnpm', ['run', 'build'], projectDir), 'installed project build').toBe(0)
}

function visitFiles(root: string, visit: (path: string, entry: Dirent) => void): void {
  if (!existsSync(root)) return
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name)
    if (entry.isDirectory()) visitFiles(path, visit)
    else visit(path, entry)
  }
}

function configureShadcn(
  projectDir: string,
  configuration: ShadcnConfiguration & { aliases: Record<string, string> },
): void {
  const path = join(projectDir, 'components.json')
  const config = readJson(path)
  Object.assign(config, {
    style: configuration.style,
    rsc: configuration.rsc,
    iconLibrary: configuration.iconLibrary,
    aliases: configuration.aliases,
  })
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`)

  const utility = join(projectDir, 'src/shared/utils.ts')
  mkdirSync(dirname(utility), { recursive: true })
  copyFileSync(join(projectDir, 'src/lib/utils.ts'), utility)
  relocateConfiguredSources(projectDir)
  expect(
    run(
      'pnpm',
      ['add', ...configuration.iconDependencies, ...configuration.styleDependencies],
      projectDir,
    ),
    'configured shadcn dependencies',
  ).toBe(0)
}

function relocateConfiguredSources(projectDir: string): void {
  const sourceRoot = join(projectDir, 'src')
  const componentsRoot = join(sourceRoot, 'components')
  const uiRoot = join(componentsRoot, 'ui')
  const configuredUiRoot = join(sourceRoot, 'design/primitives')
  mkdirSync(dirname(configuredUiRoot), { recursive: true })
  renameSync(uiRoot, configuredUiRoot)
  const biomePath = join(projectDir, 'biome.jsonc')
  writeFileSync(
    biomePath,
    readFileSync(biomePath, 'utf8').replace('!**/components/ui', '!**/design/primitives'),
  )

  visitFiles(sourceRoot, (path, entry) => {
    if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.tsx')) return
    const source = readFileSync(path, 'utf8')
    const rewritten = source
      .replaceAll('~/components/ui/', '~/design/primitives/')
      .replaceAll('~/lib/utils', '~/shared/utils')
    if (rewritten !== source) writeFileSync(path, rewritten)
  })
}

function filesNamed(root: string, name: string): string[] {
  const found: string[] = []
  visitFiles(root, (path, entry) => {
    if (entry.name === name) found.push(path)
  })
  return found
}

function scaffold(
  framework: Framework,
  workflow: string,
  options: readonly string[],
): { root: string; projectDir: string } {
  const root = mkdtempSync(join(tmpdir(), `create-stack-smoke-${framework}-${workflow}-`))
  roots.push(root)
  runCli(['app', '--framework', framework, '--no-git', ...options], root)
  return { root, projectDir: join(root, 'app') }
}

const CREATION_WORKFLOWS = [
  { name: 'recommended', options: [] },
  { name: 'minimal', options: ['--minimal'] },
  {
    name: 'independent-trpc',
    options: ['--minimal', '--trpc'],
  },
  {
    name: 'convex',
    options: ['--database', 'convex', '--auth', 'clerk'],
  },
]

type ShadcnConfiguration = {
  style: string
  rsc: boolean
  iconLibrary: string
  iconDependencies: string[]
  styleDependencies: string[]
  iconImport: string
  primitiveImport: string
}

const SHADCN_CONFIGURATIONS: Record<Framework, ShadcnConfiguration> = {
  next: {
    style: 'radix-luma',
    rsc: true,
    iconLibrary: 'tabler',
    iconDependencies: ['@tabler/icons-react'],
    styleDependencies: [],
    iconImport: '@tabler/icons-react',
    primitiveImport: 'radix-ui',
  },
  tanstack: {
    style: 'base-nova',
    rsc: false,
    iconLibrary: 'hugeicons',
    iconDependencies: ['@hugeicons/core-free-icons', '@hugeicons/react'],
    styleDependencies: ['@base-ui/react'],
    iconImport: '@hugeicons/react',
    primitiveImport: '@base-ui/react',
  },
}

const CUSTOM_ALIASES = {
  components: '~/features',
  ui: '~/design/primitives',
  hooks: '~/state',
  lib: '~/shared',
  utils: '~/shared/utils',
}

describe.skipIf(process.env.RUN_SMOKE !== '1')('installed CLI smoke matrix', () => {
  for (const framework of FRAMEWORKS) {
    for (const workflow of CREATION_WORKFLOWS) {
      test(
        `${framework}/${workflow.name}`,
        () => {
          const { projectDir } = scaffold(framework, workflow.name, workflow.options)
          if (workflow.name === 'minimal') assertBrandedSurface(projectDir, framework, expect)
          verify(projectDir, { build: workflow.name === 'minimal' })
        },
        TIMEOUT,
      )
    }

    test(
      `${framework}/provider-change`,
      () => {
        const { projectDir } = scaffold(framework, 'provider-change', [
          '--minimal',
          '--cache',
          'redis',
        ])
        runCli(['add', 'cache', 'upstash'], projectDir)
        verify(projectDir)
      },
      TIMEOUT,
    )

    test(
      `${framework}/mixed-addition`,
      () => {
        const { projectDir } = scaffold(framework, 'mixed-addition', ['--minimal'])
        runCli(['add', '--with', 'jobs', '--with', 'component=alert'], projectDir)
        verify(projectDir)
      },
      TIMEOUT,
    )

    test(
      `${framework}/dialog-callables`,
      () => {
        const { projectDir } = scaffold(framework, 'dialog-callables', ['--minimal'])
        runCli(
          [
            'add',
            '--with',
            'component=prompt',
            '--with',
            'component=choice',
            '--with',
            'component=confirm-passphrase',
            '--with',
            'component=confirm-otp',
          ],
          projectDir,
        )
        const rootFile = getFrameworkModule(framework).additions.componentRoot
        if (rootFile === null) throw new Error(`No component root for ${framework}`)
        const root = readFileSync(join(projectDir, rootFile), 'utf8')
        for (const name of ['Prompt', 'Choice', 'ConfirmPassphrase', 'ConfirmOtp']) {
          expect(root).toContain(`<${name} />`)
        }
        const prompt = readFileSync(`${projectDir}/src/components/ui/prompt.tsx`, 'utf8')
        expect(prompt.includes("'use client'") || prompt.includes('"use client"')).toBe(
          SHADCN_CONFIGURATIONS[framework].rsc,
        )
        verify(projectDir)
      },
      TIMEOUT,
    )

    test(
      `${framework}/shadcn-compatibility`,
      () => {
        const { projectDir } = scaffold(framework, 'shadcn-compatibility', ['--minimal'])
        const configuration = SHADCN_CONFIGURATIONS[framework]
        configureShadcn(projectDir, { ...configuration, aliases: CUSTOM_ALIASES })
        const buttonPath = join(projectDir, 'src/design/primitives/button.tsx')
        const buttonBeforeThemeChange = readFileSync(buttonPath, 'utf8')
        customizeTheme(projectDir, framework, expect)
        expect(readFileSync(buttonPath, 'utf8')).toBe(buttonBeforeThemeChange)

        runCli(
          ['add', '--with', 'component=date-picker', '--with', 'component=data-table'],
          projectDir,
        )

        for (const file of [
          'src/features/data-table.tsx',
          'src/features/infinite-data-table.tsx',
          'src/features/sortable-header.tsx',
          'src/state/use-data-table.tsx',
          'src/design/primitives/date-picker.tsx',
          'src/design/primitives/date-range-picker.tsx',
          'src/shared/date.ts',
        ]) {
          expect(existsSync(join(projectDir, file)), file).toBe(true)
        }

        const datePicker = readFileSync(
          join(projectDir, 'src/design/primitives/date-picker.tsx'),
          'utf8',
        )
        const calendar = readFileSync(
          join(projectDir, 'src/design/primitives/calendar.tsx'),
          'utf8',
        )
        const popover = readFileSync(join(projectDir, 'src/design/primitives/popover.tsx'), 'utf8')
        expect(datePicker).toContain("from '~/design/primitives/button'")
        expect(datePicker).toContain("from '~/shared/date'")
        expect(datePicker).toContain("from '~/shared/utils'")
        expect(datePicker).toContain('text-muted-foreground')
        expect(calendar).toContain(configuration.iconImport)
        expect(calendar).not.toContain('lucide-react')
        expect(popover).toContain(configuration.primitiveImport)
        expect(datePicker.includes("'use client'") || datePicker.includes('"use client"')).toBe(
          configuration.rsc,
        )

        expect(filesNamed(join(projectDir, 'src'), 'button.tsx')).toHaveLength(1)
        expect(filesNamed(join(projectDir, 'src'), 'calendar.tsx')).toHaveLength(1)
        expect(filesNamed(join(projectDir, 'src'), 'popover.tsx')).toHaveLength(1)
        expect(readFileSync(buttonPath, 'utf8')).toBe(buttonBeforeThemeChange)
        expect(readFileSync(buttonPath, 'utf8')).toContain('bg-primary')
        expect(readFileSync(buttonPath, 'utf8')).toContain('rounded-4xl')
        verify(projectDir)
      },
      TIMEOUT,
    )
  }
})
