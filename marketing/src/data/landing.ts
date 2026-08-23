export const features = [
  {
    label: 'A working app',
    title: 'Start with the first screen already connected.',
    text: 'Next.js App Router and TanStack Start come with routing, styles, environment wiring, and a first screen.',
  },
  {
    label: 'Changeable providers',
    title: 'Swap services when the project grows.',
    text: 'Database, auth, email, and other capabilities use small interfaces, so changing a provider does not mean rewriting the app.',
  },
  {
    label: 'A clean handoff',
    title: 'Take over a project you can read.',
    text: 'Create Stack keeps the choices you made, removes the rest, and runs TypeScript and Biome before it finishes.',
  },
] as const

export const terminalTranscript = {
  version: 1,
  lines: [
    { kind: 'command', text: 'pnpm dlx @alfredmouelle/create-stack@latest orbit' },
    { kind: 'muted', text: 'create-stack — fork a base app, strip it to your selection' },
    { kind: 'output', text: 'Target: orbit' },
    { kind: 'output', text: 'Framework: TanStack Start' },
    { kind: 'output', text: 'Database: drizzle' },
    { kind: 'output', text: 'Auth: better-auth' },
    { kind: 'output', text: 'tRPC: yes' },
    { kind: 'output', text: 'Mailer: resend' },
    { kind: 'muted', text: 'Forking + stripping the base app' },
    { kind: 'success', text: '✓ Project scaffolded' },
    { kind: 'muted', text: 'pnpm install' },
    { kind: 'muted', text: 'Verifying (typecheck + biome)' },
    { kind: 'success', text: '✓ typecheck + biome clean' },
  ],
} as const

export const terminalLines = terminalTranscript.lines
