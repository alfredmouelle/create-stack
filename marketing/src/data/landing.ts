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
    text: 'Create Stack copies only the pieces you chose, then runs TypeScript and your formatter and linter before it finishes.',
  },
] as const

export const terminalTranscript = {
  version: 1,
  lines: [
    { kind: 'command', text: 'pnpm dlx @alfredmouelle/create-stack@latest orbit' },
    { kind: 'muted', text: 'create-stack: assemble your selected stack' },
    { kind: 'output', text: 'Target: orbit' },
    { kind: 'output', text: 'Framework: TanStack Start' },
    { kind: 'output', text: 'Database: drizzle' },
    { kind: 'output', text: 'Auth: better-auth' },
    { kind: 'output', text: 'tRPC: yes' },
    { kind: 'output', text: 'Mailer: resend' },
    { kind: 'output', text: 'Formatter: biome' },
    { kind: 'output', text: 'Linter: biome' },
    { kind: 'muted', text: 'Assembling the selected stack parts' },
    { kind: 'success', text: '✓ Project scaffolded' },
    { kind: 'muted', text: 'pnpm install' },
    { kind: 'muted', text: 'Verifying (typecheck + selected quality tools)' },
    { kind: 'success', text: '✓ typecheck + selected quality tools clean' },
  ],
} as const

export const terminalLines = terminalTranscript.lines
