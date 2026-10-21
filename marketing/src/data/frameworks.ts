import {
  FRAMEWORK_SUPPORT,
  FRAMEWORKS,
  type Framework,
  type FrameworkSupport,
  RECOMMENDED_FRAMEWORK,
} from '@alfredmouelle/stack-config'

export const IMPLEMENTER_GUIDE_URL =
  'https://github.com/alfredmouelle/create-stack/blob/main/docs/adding-a-framework.md'

export type TreeEntry = {
  path: string
  depth: number
  owner?: string
}

export type RegisteredFramework = {
  maturity: FrameworkSupport['maturity']
  id: Framework
  label: string
  summary: string
  recommended: boolean
  support: FrameworkSupport
  modulePath: string
  referenceApplication: string
  monorepoOutputs: readonly string[]
  tree: readonly TreeEntry[]
}

export type PlannedFramework = {
  maturity: 'planned'
  id: string
  label: string
  summary: string
  roadmapPosition: number
}

export type RegistryEntry = RegisteredFramework | PlannedFramework

type RegisteredDetails = Pick<RegisteredFramework, 'summary' | 'monorepoOutputs' | 'tree'>

const PROFILE_TREE: readonly TreeEntry[] = [
  { path: '.githooks/pre-commit', depth: 0, owner: 'quality profile' },
  { path: '.githooks/pre-push', depth: 0, owner: 'quality profile' },
  { path: '.vscode/settings.json', depth: 0, owner: 'quality profile' },
  { path: '.zed/settings.json', depth: 0, owner: 'quality profile' },
]

const PROJECT_FILES: readonly TreeEntry[] = [
  { path: 'biome.jsonc', depth: 0, owner: 'biome' },
  { path: 'start-database.sh', depth: 0, owner: 'database · drizzle' },
  { path: 'tsconfig.json', depth: 0, owner: 'quality profile' },
]

const DETAILS = {
  tanstack: {
    summary:
      'SSR and file-based routing. Supports every database, auth, API, mailer, formatter and linter option.',
    monorepoOutputs: ['.output/**', '.nitro/**', 'dist/**'],
    tree: [
      ...PROFILE_TREE,
      { path: 'src/', depth: 0 },
      { path: 'emails/verify-email.tsx', depth: 1, owner: 'auth · better-auth' },
      { path: 'routes/__root.tsx', depth: 1 },
      { path: 'routes/api.trpc.$.tsx', depth: 1, owner: 'api · trpc' },
      { path: 'routes/auth/sign-in.tsx', depth: 1, owner: 'auth · better-auth' },
      { path: 'server/api/routers/health.router.ts', depth: 1, owner: 'api · trpc' },
      { path: 'server/better-auth/client.ts', depth: 1, owner: 'auth · better-auth' },
      { path: 'env.ts', depth: 1 },
      { path: 'router.tsx', depth: 1 },
      ...PROJECT_FILES,
    ],
  },
  rasengan: {
    summary:
      'Preview on Node with SSR, file-based routes, the shared quality profile, and an application-owned production server.',
    monorepoOutputs: ['dist/**', '.rasengan/**'],
    tree: [
      ...PROFILE_TREE,
      { path: 'src/', depth: 0 },
      { path: 'app/_routes/index.page.tsx', depth: 1 },
      { path: 'app/_api/auth/[action].route.ts', depth: 1, owner: 'auth · better-auth' },
      { path: 'main.tsx', depth: 1 },
      { path: 'template.tsx', depth: 1 },
      { path: 'scripts/start.ts', depth: 0 },
      { path: 'rasengan.config.js', depth: 0 },
      ...PROJECT_FILES,
    ],
  },
  next: {
    summary:
      'App Router with SSR and routing. Supports every database, auth, API, mailer, formatter and linter option.',
    monorepoOutputs: ['.next/**', '!.next/cache/**'],
    tree: [
      ...PROFILE_TREE,
      { path: 'src/app/', depth: 0 },
      { path: 'layout.tsx', depth: 1 },
      { path: 'page.tsx', depth: 1 },
      { path: 'api/auth/[...all]/route.ts', depth: 1, owner: 'auth · better-auth' },
      { path: 'api/trpc/[trpc]/route.ts', depth: 1, owner: 'api · trpc' },
      { path: 'auth/sign-in/page.tsx', depth: 1, owner: 'auth · better-auth' },
      { path: 'dashboard/page.tsx', depth: 1 },
      { path: 'src/features/auth/auth-card.tsx', depth: 0, owner: 'auth · better-auth' },
      { path: 'src/env.ts', depth: 0 },
      ...PROJECT_FILES,
    ],
  },
} as const satisfies Record<Framework, RegisteredDetails>

const PLANNED: readonly PlannedFramework[] = [
  {
    maturity: 'planned',
    id: 'remix',
    label: 'Remix',
    summary: 'Needs a framework module.',
    roadmapPosition: 1,
  },
  {
    maturity: 'planned',
    id: 'vue',
    label: 'Vue',
    summary: 'Needs a framework module.',
    roadmapPosition: 3,
  },
  {
    maturity: 'planned',
    id: 'nestjs',
    label: 'NestJS',
    summary: 'Needs a framework module.',
    roadmapPosition: 4,
  },
  {
    maturity: 'planned',
    id: 'php',
    label: 'PHP frameworks',
    summary: 'Needs an owner and a framework module.',
    roadmapPosition: 5,
  },
]

const REGISTERED: readonly RegisteredFramework[] = FRAMEWORKS.map((id) => {
  const support = FRAMEWORK_SUPPORT[id]
  return {
    ...DETAILS[id],
    maturity: support.maturity,
    id,
    label: support.label,
    recommended: id === RECOMMENDED_FRAMEWORK,
    support,
    modulePath: `cli/src/frameworks/${id}.ts`,
    referenceApplication: `apps/${id}-base`,
  }
}).toSorted((a, b) => Number(b.recommended) - Number(a.recommended))

export const REGISTRY: readonly RegistryEntry[] = [...REGISTERED, ...PLANNED]

export const PLANNED_FRAMEWORKS = PLANNED

export const REGISTERED_FRAMEWORKS = REGISTERED

export function isRegistered(entry: RegistryEntry): entry is RegisteredFramework {
  return entry.maturity !== 'planned'
}

export function maturityCounts(entries: readonly RegistryEntry[] = REGISTRY) {
  return {
    stable: entries.filter((entry) => entry.maturity === 'stable').length,
    preview: entries.filter((entry) => entry.maturity === 'preview').length,
    planned: entries.filter((entry) => entry.maturity === 'planned').length,
  }
}

export function frameworkCommand(id: Framework): string {
  const flag = id === RECOMMENDED_FRAMEWORK ? '' : ` --framework ${id}`
  return `pnpm dlx @alfredmouelle/create-stack@latest my-app${flag}`
}
