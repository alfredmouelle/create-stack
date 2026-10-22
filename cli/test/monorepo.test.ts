import { accessSync, constants } from 'node:fs'
import type { Framework } from '@alfredmouelle/stack-config'
import { afterAll, describe, expect, test } from 'vitest'
import type { Monorepo } from '../src/framework-module.ts'
import { build, cleanup, exists, REPO_ROOT, read } from './helpers.ts'
import { readField, readJson } from './json.ts'

afterAll(cleanup)

const OUTPUT_TOKEN = {
  remix: '',
  next: '.next/**',
  tanstack: '.output/**',
  rasengan: 'dist/**',
} satisfies Record<Framework, string>

type ToolConfig = Record<string, unknown>
type Tool = Exclude<Monorepo, false>
type ToolSpec = {
  config: string
  dep: string
  cacheDir: string
  script: (task: string) => string
  outputs: (cfg: ToolConfig) => unknown[]
  typecheckDeps: (cfg: ToolConfig) => unknown
  assertCheckWriteUncached: (cfg: ToolConfig) => void
}

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])

const section = (cfg: ToolConfig, ...path: string[]): unknown => {
  let current: unknown = cfg
  for (const key of path) {
    if (typeof current !== 'object' || current === null) return undefined
    current = Reflect.get(current, key)
  }
  return current
}

const TOOLS = {
  turborepo: {
    config: 'turbo.json',
    dep: 'turbo',
    cacheDir: '.turbo',
    script: (t: string) => `turbo run ${t}`,
    outputs: (cfg: ToolConfig) => asArray(section(cfg, 'tasks', 'build', 'outputs')),
    typecheckDeps: (cfg: ToolConfig) => section(cfg, 'tasks', 'typecheck', 'dependsOn'),
    assertCheckWriteUncached: (cfg: ToolConfig) =>
      expect(section(cfg, 'tasks', 'check:write', 'cache')).toBe(false),
  },
  nx: {
    config: 'nx.json',
    dep: 'nx',
    cacheDir: '.nx',
    script: (t: string) => (t === 'dev' ? 'nx run web:dev' : `nx run-many -t ${t}`),
    outputs: (cfg: ToolConfig) => asArray(section(cfg, 'targetDefaults', 'build', 'outputs')),
    typecheckDeps: (cfg: ToolConfig) => section(cfg, 'targetDefaults', 'typecheck', 'dependsOn'),
    assertCheckWriteUncached: (cfg: ToolConfig) =>
      expect(section(cfg, 'targetDefaults', 'check:write')).toBeUndefined(),
  },
} satisfies Record<Tool, ToolSpec>

for (const framework of ['tanstack', 'next', 'rasengan', 'remix'] as const) {
  for (const tool of ['turborepo', 'nx'] as const) {
    const spec: ToolSpec = TOOLS[tool]
    for (const pm of ['pnpm', 'npm']) {
      describe(`${tool} · ${framework} · ${pm}`, () => {
        test('wraps the app in a monorepo', async () => {
          const { dir, result } = await build({ name: 'acme', framework, pm, monorepo: tool })
          const app = `${dir}/apps/web`

          expect(result.monorepo).toBe(tool)

          expect(exists(`${app}/src`), 'app src').toBe(true)
          const appPkg = readJson(`${app}/package.json`)
          expect(appPkg.name, 'app name').toBe('web')
          expect(appPkg.private, 'app private').toBe(true)

          expect(exists(`${app}/.env`), 'app .env').toBe(true)
          expect(exists(`${dir}/.env`), 'no root .env').toBe(false)

          const rootPkg = readJson(`${dir}/package.json`)
          const rootScripts = readField(`${dir}/package.json`, 'scripts')
          const rootDevDependencies = readField(`${dir}/package.json`, 'devDependencies')
          const rootMetadata = readField(`${dir}/package.json`, 'createStackMetadata')
          expect(rootPkg.name, 'root name').toBe('acme')
          expect(rootPkg.private, 'root private').toBe(true)
          expect(rootPkg.createStackMetadata, 'root scaffold metadata').toMatchObject({
            initVersion: readJson(`${REPO_ROOT}/cli/package.json`).version,
          })
          expect(appPkg.createStackMetadata, 'app scaffold metadata').toMatchObject({
            initVersion: rootMetadata.initVersion,
          })
          for (const s of ['dev', 'build', 'typecheck', 'check', 'check:write']) {
            expect(rootScripts[s], `root ${s}`).toBe(spec.script(s))
          }
          expect(rootDevDependencies[spec.dep], `${spec.dep} devDep`).toBeTruthy()

          const cfg = readJson(`${dir}/${spec.config}`)
          if (framework === 'remix') expect(spec.outputs(cfg)).toEqual([])
          else
            expect(spec.outputs(cfg).join(' '), 'framework build outputs').toContain(
              OUTPUT_TOKEN[framework],
            )
          spec.assertCheckWriteUncached(cfg)
          expect(spec.typecheckDeps(cfg), 'typecheck dependsOn ^build').toEqual(['^build'])

          expect(exists(`${dir}/biome.jsonc`), 'root biome').toBe(true)
          expect(exists(`${app}/biome.jsonc`), 'no app biome').toBe(false)
          expect(rootDevDependencies['@biomejs/biome'], 'biome in root devDeps').toBeTruthy()

          expect(read(`${dir}/.gitignore`), 'cache dir ignored').toContain(spec.cacheDir)

          expect(exists(`${app}/.githooks`), 'no app hooks').toBe(false)

          expect(exists(`${dir}/README.md`), 'root README').toBe(true)
          expect(exists(`${app}/README.md`), 'no app README').toBe(false)
          expect(read(`${dir}/README.md`), 'next steps documentation').toContain(
            "## What's next? How do I make an app with this?",
          )
          expect(read(`${dir}/README.md`), 'workspace env path').toContain('apps/web/.env')
          expect(read(`${dir}/README.md`), 'workspace structure').toContain('apps/web')
          expect(exists(`${dir}/packages/.gitkeep`), 'packages placeholder').toBe(true)

          expect(exists(`${dir}/start-database.sh`), 'root database script').toBe(true)
          expect(read(`${dir}/start-database.sh`)).toContain(
            `ENV_FILE="\${1:-\${SCRIPT_DIR}/apps/web/.env}"`,
          )
          expect(() => accessSync(`${dir}/start-database.sh`, constants.X_OK)).not.toThrow()
          expect(rootScripts['db:push'], 'root db:push delegation').toBe(
            pm === 'npm' ? 'npm --prefix apps/web run db:push' : `${pm} --dir apps/web run db:push`,
          )
          expect(read(`${dir}/README.md`), 'database instructions').toContain('./start-database.sh')

          const ci = read(`${dir}/.github/workflows/ci.yml`)
          expect(ci).toContain(`${pm} run typecheck`)
          expect(ci).toContain(`${pm} run check`)
          expect(ci).toContain(`${pm} run test`)
          expect(ci).toContain('node-version-file: apps/web/.nvmrc')
          expect(rootScripts.test, 'root test delegation').toBeDefined()

          if (pm === 'pnpm') {
            expect(exists(`${dir}/pnpm-workspace.yaml`), 'root pnpm-workspace').toBe(true)
            const ws = read(`${dir}/pnpm-workspace.yaml`)
            expect(ws, 'workspace globs').toContain('apps/*')
            expect(ws, 'native-build allowlist').toContain('esbuild: true')
            expect(exists(`${app}/pnpm-workspace.yaml`), 'no app pnpm-workspace').toBe(false)
            expect(rootPkg.workspaces, 'no workspaces field for pnpm').toBeUndefined()
          } else {
            expect(rootPkg.workspaces, 'workspaces field').toEqual(['apps/*', 'packages/*'])
            expect(exists(`${dir}/pnpm-workspace.yaml`), 'no pnpm-workspace for npm').toBe(false)
          }
        })
      })
    }
  }
}

test('the root pins a packageManager, which turbo requires to resolve the workspace', async () => {
  const { dir } = await build({
    framework: 'next',
    trpc: false,
    mailer: 'none',
    monorepo: 'turborepo',
  })
  const root = readJson(`${dir}/package.json`)
  expect(root.packageManager).toMatch(/^(pnpm|npm|yarn|bun)@\d+\.\d+\.\d+$/)
})
