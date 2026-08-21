import { spawnSync } from 'node:child_process'
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

const testDirectory = dirname(fileURLToPath(import.meta.url))
const cliRoot = resolve(testDirectory, '..')
const repoRoot = resolve(cliRoot, '..')
const cliEntry = resolve(cliRoot, 'index.mjs')
const roots = []

afterAll(
  () => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
  },
  2 * 60 * 1000,
)

const FRAMEWORKS = process.env.SMOKE_FRAMEWORK
  ? [process.env.SMOKE_FRAMEWORK]
  : ['tanstack', 'next']
const TIMEOUT = 15 * 60 * 1000

function run(command, args, cwd) {
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

function runCli(args, cwd) {
  expect(run(process.execPath, [cliEntry, ...args], cwd), `create-stack ${args.join(' ')}`).toBe(0)
}

function verify(projectDir) {
  expect(run('pnpm', ['run', 'typecheck'], projectDir), 'installed project typecheck').toBe(0)
  expect(run('pnpm', ['run', 'check'], projectDir), 'installed project format check').toBe(0)
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function configureShadcn(projectDir, configuration) {
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

function relocateConfiguredSources(projectDir) {
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

  const rewriteImports = (root) => {
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      const path = join(root, entry.name)
      if (entry.isDirectory()) {
        rewriteImports(path)
      } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
        const source = readFileSync(path, 'utf8')
        const rewritten = source
          .replaceAll('~/components/ui/', '~/design/primitives/')
          .replaceAll('~/lib/utils', '~/shared/utils')
        if (rewritten !== source) writeFileSync(path, rewritten)
      }
    }
  }
  rewriteImports(sourceRoot)
}

function filesNamed(root, name) {
  if (!existsSync(root)) return []
  const found = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name)
    if (entry.isDirectory()) found.push(...filesNamed(path, name))
    else if (entry.name === name) found.push(path)
  }
  return found
}

function scaffold(framework, workflow, options) {
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

const SHADCN_CONFIGURATIONS = {
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

describe.skipIf(!process.env.RUN_SMOKE)('installed CLI smoke matrix', () => {
  for (const framework of FRAMEWORKS) {
    for (const workflow of CREATION_WORKFLOWS) {
      test(
        `${framework}/${workflow.name}`,
        () => verify(scaffold(framework, workflow.name, workflow.options).projectDir),
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
        const rootFile = framework === 'next' ? 'src/app/layout.tsx' : 'src/routes/__root.tsx'
        const root = readFileSync(join(projectDir, rootFile), 'utf8')
        for (const name of ['Prompt', 'Choice', 'ConfirmPassphrase', 'ConfirmOtp']) {
          expect(root).toContain(`<${name} />`)
        }
        const prompt = readFileSync(`${projectDir}/src/components/ui/prompt.tsx`, 'utf8')
        expect(prompt.includes("'use client'") || prompt.includes('"use client"')).toBe(
          framework === 'next',
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
        expect(calendar).toContain(configuration.iconImport)
        expect(calendar).not.toContain('lucide-react')
        expect(popover).toContain(configuration.primitiveImport)
        expect(datePicker.includes("'use client'") || datePicker.includes('"use client"')).toBe(
          configuration.rsc,
        )

        expect(filesNamed(join(projectDir, 'src'), 'button.tsx')).toHaveLength(1)
        expect(filesNamed(join(projectDir, 'src'), 'calendar.tsx')).toHaveLength(1)
        expect(filesNamed(join(projectDir, 'src'), 'popover.tsx')).toHaveLength(1)
        verify(projectDir)
      },
      TIMEOUT,
    )
  }
})
