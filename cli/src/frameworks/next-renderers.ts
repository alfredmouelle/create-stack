import { fillTemplate } from '../javascript/reference-parts.ts'
import type { StackSelection } from '../reference-application.ts'

export function renderLayout(selection: StackSelection): string {
  const clerk = selection.auth === 'clerk'
  const convex = selection.database === 'convex'
  const convexChildren = convex
    ? '<ConvexClientProvider>{children}</ConvexClientProvider>'
    : '{children}'
  const children = selection.trpc
    ? `<TRPCReactProvider>${convexChildren}</TRPCReactProvider>`
    : convexChildren
  const html = [
    '<html lang="en" suppressHydrationWarning>',
    '  <body>',
    '    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>',
    `      ${children}`,
    '    </ThemeProvider>',
    '  </body>',
    '</html>',
  ]
  const document = clerk
    ? ['<ClerkProvider>', ...html.map((line) => `  ${line}`), '</ClerkProvider>']
    : html
  return fillTemplate('next/assembly/layout.txt', {
    CLERK_IMPORT: clerk ? "import { ClerkProvider } from '@clerk/nextjs'\n" : '',
    CONVEX_IMPORT: convex ? "import { ConvexClientProvider } from '~/app/convex-provider'\n" : '',
    TRPC_IMPORT: selection.trpc ? "import { TRPCReactProvider } from '~/trpc/react'\n" : '',
    DOCUMENT: document.map((line) => `    ${line}`).join('\n'),
  })
}
