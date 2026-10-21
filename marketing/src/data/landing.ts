export const GATE_STEPS = [
  { id: 'install', label: 'install', command: 'pnpm install' },
  { id: 'format', label: 'format', command: 'pnpm run check:write' },
  { id: 'typecheck', label: 'typecheck', command: 'pnpm run typecheck' },
  { id: 'lint', label: 'lint', command: 'pnpm run check' },
  { id: 'commit', label: 'commit', command: 'chore: initial commit from create-stack' },
] as const

export type GateStepId = (typeof GATE_STEPS)[number]['id']

type TranscriptLine = {
  kind: 'command' | 'heading' | 'output' | 'step' | 'success'
  text: string
  note?: string
  passes?: readonly GateStepId[]
}

export const terminalTranscript = {
  version: 2,
  lines: [
    { kind: 'command', text: 'pnpm dlx @alfredmouelle/create-stack@latest my-app --yes' },
    { kind: 'heading', text: 'Creation plan' },
    { kind: 'output', text: 'Framework: TanStack Start' },
    { kind: 'output', text: 'Database: drizzle', note: 'recommended stack' },
    { kind: 'output', text: 'Auth: better-auth', note: 'recommended stack' },
    { kind: 'output', text: 'tRPC: yes', note: 'recommended stack' },
    { kind: 'output', text: 'Mailer: resend', note: 'recommended stack' },
    { kind: 'output', text: 'Formatter: biome', note: 'recommended stack' },
    { kind: 'output', text: 'Linter: biome', note: 'recommended stack' },
    { kind: 'step', text: 'pnpm install' },
    {
      kind: 'step',
      text: 'Verifying (typecheck + selected quality tools)',
      passes: ['install', 'format'],
    },
    {
      kind: 'success',
      text: 'typecheck + selected quality tools clean',
      passes: ['typecheck', 'lint'],
    },
    { kind: 'step', text: 'git repository initialized' },
    { kind: 'success', text: 'initial commit created', passes: ['commit'] },
    { kind: 'success', text: 'Created my-app' },
  ],
} as const satisfies { version: number; lines: readonly TranscriptLine[] }

export const terminalLines: readonly TranscriptLine[] = terminalTranscript.lines

export const QUALITY_PROFILE_OPTIONS = [
  'strict',
  'noUncheckedIndexedAccess',
  'exactOptionalPropertyTypes',
  'noImplicitOverride',
  'noUnusedLocals',
  'noUnusedParameters',
  'noFallthroughCasesInSwitch',
  'verbatimModuleSyntax',
  'isolatedModules',
  'noUncheckedSideEffectImports',
] as const

export const REFERENCE_PARTS = [
  { axis: 'core', parts: [{ name: 'reference app', selected: true }] },
  {
    axis: 'database',
    parts: [
      { name: 'drizzle', selected: true },
      { name: 'prisma', selected: false },
      { name: 'convex', selected: false },
    ],
  },
  {
    axis: 'auth',
    parts: [
      { name: 'better-auth', selected: true },
      { name: 'clerk', selected: false },
    ],
  },
  { axis: 'api', parts: [{ name: 'trpc', selected: true }] },
  {
    axis: 'mailer',
    parts: [
      { name: 'resend', selected: true },
      { name: 'brevo', selected: false },
      { name: 'ses', selected: false },
    ],
  },
] as const

export const PORT_CAPABILITIES = [
  { name: 'storage', providers: ['s3', 'r2', 'gcs', 'local'], recommended: 'r2' },
  { name: 'cache', providers: ['redis', 'upstash', 'memory'], recommended: 'upstash' },
  { name: 'logger', providers: ['pino', 'console'], recommended: 'pino' },
  { name: 'analytics', providers: ['posthog', 'plausible', 'noop'], recommended: 'posthog' },
  { name: 'mailer', providers: ['resend', 'brevo', 'ses'], recommended: 'resend' },
] as const

export const SINGLE_PROVIDER_MODULES = [
  { name: 'jobs', provider: 'Inngest' },
  { name: 'error-tracking', provider: 'Sentry' },
  { name: 'email-ui', provider: 'React Email primitives' },
] as const
