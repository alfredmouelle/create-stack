import { join } from 'node:path'
import { CONVEX_VERSION } from '#lib/database.mjs'
import { STACK_ROOT, TEMPLATES } from '#lib/paths.mjs'
import {
  drizzleAuthSchema,
  javascriptReference,
  mailerParts,
  prismaAuthSchema,
  readTemplate,
  rendered,
  renderTrpc,
  skeletonPart,
  sqlDatabaseParts,
  testingPart,
  variantFiles,
} from '../javascript/reference-parts.ts'
import type { ApplicationPart, ReferenceApplication } from '../reference-application.ts'
import { renderLayout } from './next-renderers.ts'

const reference = javascriptReference(join(STACK_ROOT, 'apps/next-base'))

const sql = sqlDatabaseParts(reference)

const featureParts: readonly ApplicationPart[] = [
  sql.database,
  {
    id: 'auth:better-auth',
    selected: (selection) => selection.auth === 'better-auth',
    dependencies: reference.pick('dependencies', ['better-auth']),
    envKeys: [
      'BETTER_AUTH_URL',
      'BETTER_AUTH_SECRET',
      'BETTER_AUTH_GOOGLE_CLIENT_ID',
      'BETTER_AUTH_GOOGLE_CLIENT_SECRET',
    ],
    requiredEnvKeys: ['BETTER_AUTH_URL', 'BETTER_AUTH_SECRET'],
    files: [
      ...reference.files([
        'src/app/api/auth/[...all]/route.ts',
        'src/app/auth/_components/forgot-password-form.tsx',
        'src/app/auth/_components/reset-password-form.tsx',
        'src/app/auth/_components/sign-in-form.tsx',
        'src/app/auth/_components/sign-up-form.tsx',
        'src/app/auth/_components/verify-email-actions.tsx',
        'src/app/auth/forgot-password/page.tsx',
        'src/app/auth/layout.tsx',
        'src/app/auth/page.tsx',
        'src/app/auth/reset-password/page.tsx',
        'src/app/auth/sign-in/page.tsx',
        'src/app/auth/sign-up/page.tsx',
        'src/app/auth/verify-email/page.tsx',
        'src/app/dashboard/page.tsx',
        'src/features/auth/auth-brand.tsx',
        'src/features/auth/auth-card.tsx',
        'src/features/auth/form-alert.tsx',
        'src/features/auth/google-button.tsx',
        'src/features/auth/schemas.ts',
        'src/server/auth/guards.ts',
        'src/server/better-auth/client.ts',
        'src/server/better-auth/emails.tsx',
        'src/server/better-auth/index.ts',
        'src/server/better-auth/server.ts',
      ]),
      drizzleAuthSchema(reference),
      rendered('src/server/better-auth/config.ts', (selection) =>
        selection.database === 'prisma'
          ? readTemplate('next/assembly/better-auth.prisma.txt')
          : reference.read('src/server/better-auth/config.ts'),
      ),
      prismaAuthSchema,
    ],
  },
  {
    id: 'auth:clerk',
    selected: (selection) => selection.auth === 'clerk',
    dependencies: { '@clerk/nextjs': '7.9.14' },
    envLines: [
      'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_change_me',
      'CLERK_SECRET_KEY=sk_test_change_me',
    ],
    files: variantFiles('next/auth/clerk', [
      'src/app/dashboard/page.tsx',
      'src/app/sign-in/[[...sign-in]]/page.tsx',
      'src/app/sign-up/[[...sign-up]]/page.tsx',
      'src/middleware.ts',
    ]),
  },
  sql.drizzle,
  sql.prisma,
  {
    id: 'database:convex',
    selected: (selection) => selection.database === 'convex',
    dependencies: { convex: CONVEX_VERSION },
    scripts: { convex: 'convex dev' },
    envLines: ['CONVEX_DEPLOYMENT=', 'NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud'],
    files: [
      ...variantFiles('database/convex/backend', [
        'convex/_generated/api.js',
        'convex/_generated/server.js',
        'convex/_generated/server.d.ts',
        'convex/_generated/api.d.ts',
        'convex/_generated/dataModel.d.ts',
        'convex/tsconfig.json',
        'convex/messages.ts',
        'convex/schema.ts',
      ]),
      ...variantFiles('next/database/convex', ['src/app/convex-demo/page.tsx']),
      {
        path: 'src/app/convex-provider.tsx',
        source: (selection) =>
          readTemplate(
            `next/database/convex/src/app/convex-provider.${selection.auth === 'clerk' ? 'clerk' : 'plain'}.tsx`,
          ),
      },
    ],
  },
  {
    id: 'trpc',
    selected: (selection) => selection.trpc,
    dependencies: reference.pick('dependencies', [
      '@tanstack/react-query',
      '@trpc/client',
      '@trpc/react-query',
      '@trpc/server',
      'superjson',
    ]),
    files: [
      ...reference.files([
        'src/app/api/trpc/[trpc]/route.ts',
        'src/server/api/root.ts',
        'src/server/api/routers/health.router.ts',
        'src/trpc/query-client.ts',
        'src/trpc/react.tsx',
        'src/trpc/server.ts',
      ]),
      rendered('src/server/api/trpc.ts', renderTrpc('@clerk/nextjs/server')),
    ],
  },
  ...mailerParts(reference),
  testingPart(reference, ['vitest']),
]

const skeleton = skeletonPart(
  reference,
  [
    ...reference.files([
      '.dockerignore',
      '.nvmrc',
      'Dockerfile',
      'README.md',
      'components.json',
      'next.config.ts',
      'postcss.config.mjs',
      'public/favicon.ico',
      'public/favicon.svg',
      'public/logo192.png',
      'public/logo512.png',
      'public/manifest.json',
      'src/app/globals.css',
      'src/app/page.tsx',
      'src/components/theme-provider.tsx',
      'src/components/theme-toggle.tsx',
      'src/components/ui/button.tsx',
      'src/components/ui/card.tsx',
      'src/components/ui/dropdown-menu.tsx',
      'src/components/ui/form.tsx',
      'src/components/ui/input-group.tsx',
      'src/components/ui/input.tsx',
      'src/components/ui/label.tsx',
      'src/components/ui/skeleton.tsx',
      'src/components/ui/spinner.tsx',
      'src/components/ui/table.tsx',
      'src/lib/site-config.ts',
      'src/lib/utils.ts',
      'src/reset.d.ts',
      'tsconfig.json',
    ]),
    { path: '.gitignore', referencePath: '.gitignore', source: null },
    { path: '.gitignore', source: join(TEMPLATES, 'next/gitignore') },
    rendered('src/app/layout.tsx', renderLayout),
  ],
  { name: '@alfredmouelle/next-base', version: '0.1.0', private: true },
  featureParts,
)

export const nextReference: ReferenceApplication = {
  root: reference.root,
  parts: [skeleton, ...featureParts],
}
