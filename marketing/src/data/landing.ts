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

export const terminalLines = [
  { kind: 'command', text: 'pnpm dlx @alfredmouelle/create-stack@latest orbit' },
  { kind: 'muted', text: 'create-stack 0.12 · resolving recommended stack' },
  { kind: 'output', text: '◆ framework    TanStack Start' },
  { kind: 'output', text: '◆ data         Drizzle + PostgreSQL' },
  { kind: 'output', text: '◆ auth         better-auth' },
  { kind: 'output', text: '◆ api          tRPC' },
  { kind: 'muted', text: 'writing project files...' },
  { kind: 'success', text: '✓ generated orbit in 8.4s' },
  { kind: 'success', text: '✓ typecheck passed · biome clean' },
  { kind: 'ready', text: '→ cd orbit && pnpm dev' },
] as const
