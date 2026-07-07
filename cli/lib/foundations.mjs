// Foundations the CLI can strip + the npm footprint each adds (deps/devDeps/scripts only).
// File deletes, env keys, code seams live in strip.mjs/build.mjs (need framework-specific surgery).

// The ORM (lib/database.mjs) and auth (lib/auth.mjs) are their own axes — trpc is the
// only remaining strippable foundation.
export const FOUNDATIONS = ['trpc']

const DATA = {
  trpc: {
    deps: ['@trpc/server', '@trpc/client', '@tanstack/react-query', 'superjson', 'valibot'],
    // React Query bridge differs per framework
    perFramework: { tanstack: ['@trpc/tanstack-react-query'], next: ['@trpc/react-query'] },
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
