const COMMON_DEPS = [
  '@trpc/server',
  '@trpc/client',
  '@tanstack/react-query',
  'superjson',
  'valibot',
]

const FRAMEWORK_DEPS = {
  tanstack: ['@trpc/tanstack-react-query'],
  next: ['@trpc/react-query'],
}

/** Every production dependency contributed by tRPC for a framework. */
export function trpcDeps(framework) {
  return [...COMMON_DEPS, ...(FRAMEWORK_DEPS[framework] ?? [])]
}
