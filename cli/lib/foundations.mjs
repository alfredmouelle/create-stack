// Foundations the CLI can strip + the npm footprint each adds (deps/devDeps/scripts only).
// File deletes, env keys, code seams live in strip.mjs/build.mjs (need framework-specific surgery).

export const FOUNDATIONS = ['drizzle', 'trpc', 'better-auth', 'data-table']

const DATA = {
  drizzle: {
    deps: ['drizzle-orm', 'pg'],
    devDeps: ['drizzle-kit', 'dotenv', 'tsx', '@types/pg', '@faker-js/faker'],
    scripts: ['db:generate', 'db:migrate', 'db:push', 'db:studio', 'db:seed'],
  },
  trpc: {
    deps: ['@trpc/server', '@trpc/client', '@tanstack/react-query', 'superjson', 'valibot'],
    // React Query bridge differs per framework
    perFramework: { tanstack: ['@trpc/tanstack-react-query'], next: ['@trpc/react-query'] },
  },
  'better-auth': {
    deps: ['better-auth'],
  },
  'data-table': {
    deps: ['@tanstack/react-table'],
  },
}

/** Every npm dep (prod + dev) a foundation contributes, for `framework`. */
export function foundationDeps(name, framework) {
  const d = DATA[name]
  if (!d) return []
  return [...(d.deps ?? []), ...(d.devDeps ?? []), ...(d.perFramework?.[framework] ?? [])]
}

/** package.json script names a foundation adds. */
export function foundationScripts(name) {
  return DATA[name]?.scripts ?? []
}
