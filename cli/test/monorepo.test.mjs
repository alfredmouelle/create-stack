import { accessSync, constants } from 'node:fs'
import { afterAll, describe, expect, test } from 'vitest'
import { build, cleanup, exists, REPO_ROOT, read, readJSON } from './helpers.mjs'

afterAll(cleanup)

const OUTPUT_TOKEN = { next: '.next/**', tanstack: '.output/**' }

const TOOLS = {
  turborepo: {
    config: 'turbo.json',
    dep: 'turbo',
    cacheDir: '.turbo',
    script: (t) => `turbo run ${t}`,
    outputs: (cfg) => cfg.tasks.build.outputs,
    typecheckDeps: (cfg) => cfg.tasks.typecheck.dependsOn,
    assertCheckWriteUncached: (cfg) => expect(cfg.tasks['check:write'].cache).toBe(false),
  },
  nx: {
    config: 'nx.json',
    dep: 'nx',
    cacheDir: '.nx',
    script: (t) => (t === 'dev' ? 'nx run web:dev' : `nx run-many -t ${t}`),
    outputs: (cfg) => cfg.targetDefaults.build.outputs,
    typecheckDeps: (cfg) => cfg.targetDefaults.typecheck.dependsOn,
    assertCheckWriteUncached: (cfg) => expect(cfg.targetDefaults['check:write']).toBeUndefined(),
  },
}

for (const framework of ['tanstack', 'next']) {
  for (const [tool, spec] of Object.entries(TOOLS)) {
    for (const pm of ['pnpm', 'npm']) {
      describe(`${tool} · ${framework} · ${pm}`, () => {
        test('wraps the app in a monorepo', () => {
          const { dir, result } = build({ name: 'acme', framework, pm, monorepo: tool })
          const app = `${dir}/apps/web`

          expect(result.monorepo).toBe(tool)

          expect(exists(`${app}/src`), 'app src').toBe(true)
          const appPkg = readJSON(`${app}/package.json`)
          expect(appPkg.name, 'app name').toBe('web')
          expect(appPkg.private, 'app private').toBe(true)

          expect(exists(`${app}/.env`), 'app .env').toBe(true)
          expect(exists(`${dir}/.env`), 'no root .env').toBe(false)

          const rootPkg = readJSON(`${dir}/package.json`)
          expect(rootPkg.name, 'root name').toBe('acme')
          expect(rootPkg.private, 'root private').toBe(true)
          expect(rootPkg.createStackMetadata, 'root scaffold metadata').toMatchObject({
            initVersion: readJSON(`${REPO_ROOT}/cli/package.json`).version,
          })
          expect(appPkg.createStackMetadata, 'app scaffold metadata').toMatchObject({
            initVersion: rootPkg.createStackMetadata.initVersion,
          })
          for (const s of ['dev', 'build', 'typecheck', 'check', 'check:write']) {
            expect(rootPkg.scripts[s], `root ${s}`).toBe(spec.script(s))
          }
          expect(rootPkg.devDependencies[spec.dep], `${spec.dep} devDep`).toBeTruthy()
          expect(rootPkg.scripts.prepare, 'root prepare hook wiring').toContain('core.hooksPath')

          const cfg = readJSON(`${dir}/${spec.config}`)
          expect(spec.outputs(cfg).join(' '), 'framework build outputs').toContain(
            OUTPUT_TOKEN[framework],
          )
          spec.assertCheckWriteUncached(cfg)
          expect(spec.typecheckDeps(cfg), 'typecheck dependsOn ^build').toEqual(['^build'])

          expect(exists(`${dir}/biome.jsonc`), 'root biome').toBe(true)
          expect(exists(`${app}/biome.jsonc`), 'no app biome').toBe(false)
          expect(rootPkg.devDependencies['@biomejs/biome'], 'biome in root devDeps').toBeTruthy()

          expect(read(`${dir}/.gitignore`), 'cache dir ignored').toContain(spec.cacheDir)

          expect(exists(`${dir}/.githooks/pre-commit`), 'root hooks').toBe(true)
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
            `ENV_FILE="\${SCRIPT_DIR}/apps/web/.env"`,
          )
          expect(() => accessSync(`${dir}/start-database.sh`, constants.X_OK)).not.toThrow()
          expect(rootPkg.scripts['db:push'], 'root db:push delegation').toBe(
            pm === 'npm' ? 'npm --prefix apps/web run db:push' : `${pm} --dir apps/web run db:push`,
          )
          expect(read(`${dir}/README.md`), 'database instructions').toContain('./start-database.sh')

          const ci = read(`${dir}/.github/workflows/ci.yml`)
          expect(ci).toContain(`${pm} run typecheck`)
          expect(ci).toContain(`${pm} run check`)

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

test('the root pins a packageManager, which turbo requires to resolve the workspace', () => {
  const { dir } = build({
    framework: 'next',
    trpc: false,
    mailer: 'none',
    monorepo: 'turborepo',
  })
  const root = readJSON(`${dir}/package.json`)
  expect(root.packageManager).toMatch(/^(pnpm|npm|yarn|bun)@\d+\.\d+\.\d+$/)
})
