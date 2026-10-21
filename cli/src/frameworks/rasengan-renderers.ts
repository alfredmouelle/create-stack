import {
  fillTemplate,
  isSqlDatabase,
  readTemplate,
  renderTrpc,
} from '../javascript/reference-parts.ts'
import type { StackSelection } from '../reference-application.ts'

export function renderMain(selection: StackSelection): string {
  const clerk = selection.auth === 'clerk'
  const convex = selection.database === 'convex'
  const imports = [
    ...(clerk ? ["import { ClerkProvider } from '@clerk/react'\n"] : []),
    ...(convex ? ["import { ConvexClientProvider } from '~/components/convex-provider'\n"] : []),
    ...(selection.trpc ? ["import { TRPCReactProvider } from '~/trpc/react'\n"] : []),
    ...(clerk ? ["import * as v from 'valibot'\n"] : []),
  ].join('')
  let children = '<Component>{children}</Component>'
  if (convex) children = `<ConvexClientProvider>${children}</ConvexClientProvider>`
  if (selection.trpc)
    children = `<TRPCReactProvider>\n        ${children}\n      </TRPCReactProvider>`
  if (clerk)
    children = `<ClerkProvider publishableKey={v.parse(v.string(), import.meta.env.RASENGAN_CLERK_PUBLISHABLE_KEY)}>${children}</ClerkProvider>`
  return fillTemplate('rasengan/assembly/main.txt', { IMPORTS: imports, CHILDREN: children })
}

export function renderRasenganTrpc(selection: StackSelection): string {
  if (selection.auth !== 'clerk') return renderTrpc('~/server/clerk')(selection)
  const sql = isSqlDatabase(selection)
  return fillTemplate('javascript/trpc.txt', {
    TRPC_EXPORTS: 'initTRPC, TRPCError',
    CLERK_IMPORT: "import { auth } from '~/server/clerk'\n",
    BETTER_AUTH_IMPORT: '',
    DATABASE_IMPORT: sql ? "import { db } from '~/server/db'\n" : '',
    CONTEXT: `  return { ${sql ? 'db, ' : ''}auth: await auth(opts.headers), ...opts }`,
    CONTEXT_TYPE: [
      ...(sql ? ['readonly db: typeof db'] : []),
      'readonly auth: Awaited<ReturnType<typeof auth>>',
      'readonly headers: Headers',
    ].join('\n  '),
    PROTECTED_PROCEDURE: `\n${readTemplate('javascript/protected-clerk.txt')}`,
  })
}
