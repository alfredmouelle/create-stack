// Monorepo wrap: the app lands in apps/web (standalone output intact), wrapped in a Turborepo or
// Nx root whose scripts delegate to the orchestrator. Root-vs-app placement of biome/workspace/
// hooks/env is asserted here; the per-selection strip/vendor matrix lives in build.test.mjs.

import { afterAll, describe, expect, test } from 'vitest'
import { build, cleanup, exists, read, readJSON } from './helpers.mjs'

afterAll(cleanup)

// framework → a build-output token the tool's config must reference (basename, tool-agnostic)
const OUTPUT_TOKEN = { next: '.next/**', tanstack: '.output/**' }

// per-tool config assertions (config file, root-script shape, caching rules)
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
    // dev is a single continuous task; the rest fan out via run-many
    script: (t) => (t === 'dev' ? 'nx run web:dev' : `nx run-many -t ${t}`),
    outputs: (cfg) => cfg.targetDefaults.build.outputs,
    typecheckDeps: (cfg) => cfg.targetDefaults.typecheck.dependsOn,
    // uncached by default (absent from targetDefaults) since it mutates source
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

          // app forked under apps/web, standalone output intact
          expect(exists(`${app}/src`), 'app src').toBe(true)
          const appPkg = readJSON(`${app}/package.json`)
          expect(appPkg.name, 'app name').toBe('web')
          expect(appPkg.private, 'app private').toBe(true)

          // env stays in the app (Next/Vite load it from the app cwd)
          expect(exists(`${app}/.env`), 'app .env').toBe(true)
          expect(exists(`${dir}/.env`), 'no root .env').toBe(false)

          // root package.json: private, name = projectName, scripts delegate to the orchestrator
          const rootPkg = readJSON(`${dir}/package.json`)
          expect(rootPkg.name, 'root name').toBe('acme')
          expect(rootPkg.private, 'root private').toBe(true)
          for (const s of ['dev', 'build', 'typecheck', 'check', 'check:write']) {
            expect(rootPkg.scripts[s], `root ${s}`).toBe(spec.script(s))
          }
          expect(rootPkg.devDependencies[spec.dep], `${spec.dep} devDep`).toBeTruthy()
          expect(rootPkg.scripts.prepare, 'root prepare hook wiring').toContain('core.hooksPath')

          // tool config: build outputs scoped to the framework, check:write never cached,
          // typecheck ordered after upstream builds
          const cfg = readJSON(`${dir}/${spec.config}`)
          expect(spec.outputs(cfg).join(' '), 'framework build outputs').toContain(
            OUTPUT_TOKEN[framework],
          )
          spec.assertCheckWriteUncached(cfg)
          expect(spec.typecheckDeps(cfg), 'typecheck dependsOn ^build').toEqual(['^build'])

          // biome lives at the root; the app inherits it. biome is also a root devDep so the
          // hoisted git hooks can resolve `biome` from the repo root (pnpm/bun do not hoist it).
          expect(exists(`${dir}/biome.jsonc`), 'root biome').toBe(true)
          expect(exists(`${app}/biome.jsonc`), 'no app biome').toBe(false)
          expect(rootPkg.devDependencies['@biomejs/biome'], 'biome in root devDeps').toBeTruthy()

          // the tool's cache dir is gitignored at the root
          expect(read(`${dir}/.gitignore`), 'cache dir ignored').toContain(spec.cacheDir)

          // git hooks hoisted to the git root
          expect(exists(`${dir}/.githooks/pre-commit`), 'root hooks').toBe(true)
          expect(exists(`${app}/.githooks`), 'no app hooks').toBe(false)

          // scaffolding: one canonical root README (the app-level one is dropped), empty packages/
          expect(exists(`${dir}/README.md`), 'root README').toBe(true)
          expect(exists(`${app}/README.md`), 'no app README').toBe(false)
          expect(exists(`${dir}/packages/.gitkeep`), 'packages placeholder').toBe(true)

          // CI lives at the root and drives the (delegating) root scripts
          const ci = read(`${dir}/.github/workflows/ci.yml`)
          expect(ci).toContain(`${pm} run typecheck`)
          expect(ci).toContain(`${pm} run check`)

          // workspace wiring differs by pm: pnpm-workspace.yaml (pnpm) vs package.json workspaces
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
    foundations: [],
    mailer: 'none',
    monorepo: 'turborepo',
  })
  const root = readJSON(`${dir}/package.json`)
  expect(root.packageManager).toMatch(/^(pnpm|npm|yarn|bun)@\d+\.\d+\.\d+$/)
})
