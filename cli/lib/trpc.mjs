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

export function trpcDeps(framework) {
  return [...COMMON_DEPS, ...(FRAMEWORK_DEPS[framework] ?? [])]
}
