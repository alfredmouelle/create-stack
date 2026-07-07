// Foundations the CLI can strip + the npm footprint each adds (deps/devDeps/scripts only).
// File deletes, env keys, code seams live in strip.mjs/build.mjs (need framework-specific surgery).

// The ORM is its own axis (lib/database.mjs) — foundations are what sits on top.
export const FOUNDATIONS = ['trpc', 'better-auth']

const DATA = {
  trpc: {
    deps: ['@trpc/server', '@trpc/client', '@tanstack/react-query', 'superjson', 'valibot'],
    // React Query bridge differs per framework
    perFramework: { tanstack: ['@trpc/tanstack-react-query'], next: ['@trpc/react-query'] },
  },
  'better-auth': {
    deps: ['better-auth'],
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
