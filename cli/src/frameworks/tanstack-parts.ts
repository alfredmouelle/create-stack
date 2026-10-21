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
import { renderDevtools, renderRoot, renderRouter } from './tanstack-renderers.ts'

const reference = javascriptReference(join(STACK_ROOT, 'apps/tanstack-base'))

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
        'src/features/auth/auth-brand.tsx',
        'src/features/auth/auth-card.tsx',
        'src/features/auth/form-alert.tsx',
        'src/features/auth/google-button.tsx',
        'src/features/auth/schemas.ts',
        'src/routes/_authed.tsx',
        'src/routes/_authed/dashboard.tsx',
        'src/routes/api/auth/$.ts',
        'src/routes/auth.tsx',
        'src/routes/auth/forgot-password.tsx',
        'src/routes/auth/index.tsx',
        'src/routes/auth/reset-password.tsx',
        'src/routes/auth/sign-in.tsx',
        'src/routes/auth/sign-up.tsx',
        'src/routes/auth/verify-email.tsx',
        'src/server/better-auth/client.ts',
        'src/server/better-auth/emails.tsx',
        'src/server/better-auth/index.ts',
        'src/server/better-auth/session.ts',
      ]),
      drizzleAuthSchema(reference),
      rendered('src/server/better-auth/config.ts', (selection) =>
        selection.database === 'prisma'
          ? readTemplate('tanstack/assembly/better-auth.prisma.txt')
          : reference.read('src/server/better-auth/config.ts'),
      ),
      prismaAuthSchema,
    ],
  },
  {
    id: 'auth:clerk',
    selected: (selection) => selection.auth === 'clerk',
    dependencies: { '@clerk/tanstack-react-start': '1.7.1' },
    envLines: [
      'VITE_CLERK_PUBLISHABLE_KEY=pk_test_change_me',
      'CLERK_SECRET_KEY=sk_test_change_me',
    ],
    files: variantFiles('tanstack/auth/clerk', [
      'src/routes/sign-in.$.tsx',
      'src/routes/sign-up.$.tsx',
      'src/routes/dashboard.tsx',
      'src/start.ts',
    ]),
  },
  sql.drizzle,
  sql.prisma,
  {
    id: 'database:convex',
    selected: (selection) => selection.database === 'convex',
    dependencies: { convex: CONVEX_VERSION },
    scripts: { convex: 'convex dev' },
    envLines: ['CONVEX_DEPLOYMENT=', 'VITE_CONVEX_URL=https://example.convex.cloud'],
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
      ...variantFiles('tanstack/database/convex', [
        'src/routes/convex-demo.tsx',
        'src/convex-env.d.ts',
      ]),
    ],
  },
  {
    id: 'trpc',
    selected: (selection) => selection.trpc,
    dependencies: reference.pick('dependencies', [
      '@tanstack/query-core',
      '@tanstack/react-query',
      '@tanstack/react-query-devtools',
      '@tanstack/react-router-ssr-query',
      '@trpc/client',
      '@trpc/server',
      '@trpc/tanstack-react-query',
      'superjson',
    ]),
    files: [
      ...reference.files([
        'src/routes/api.trpc.$.tsx',
        'src/server/api/root.ts',
        'src/server/api/routers/health.router.ts',
        'src/trpc/devtools.tsx',
        'src/trpc/query-client.ts',
        'src/trpc/react.tsx',
        'src/trpc/server.ts',
      ]),
      rendered('src/server/api/trpc.ts', renderTrpc('@clerk/tanstack-react-start/server')),
    ],
  },
  ...mailerParts(reference),
  testingPart(reference, ['vitest', '@testing-library/dom', '@testing-library/react', 'jsdom']),
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
      'public/favicon.ico',
      'public/favicon.svg',
      'public/logo192.png',
      'public/logo512.png',
      'public/manifest.json',
      'public/robots.txt',
      'src/components/form/field-error.tsx',
      'src/components/form/text-field.tsx',
      'src/components/theme-provider.tsx',
      'src/components/theme-toggle.tsx',
      'src/components/ui/button.tsx',
      'src/components/ui/card.tsx',
      'src/components/ui/dropdown-menu.tsx',
      'src/components/ui/input-group.tsx',
      'src/components/ui/input.tsx',
      'src/components/ui/label.tsx',
      'src/components/ui/skeleton.tsx',
      'src/components/ui/spinner.tsx',
      'src/components/ui/table.tsx',
      'src/lib/site-config.ts',
      'src/lib/utils.ts',
      'src/reset.d.ts',
      'src/routes/index.tsx',
      'src/styles.css',
      'tsconfig.json',
      'tsr.config.json',
      'vite.config.ts',
    ]),
    { path: '.gitignore', referencePath: '.gitignore', source: null },
    { path: '.gitignore', source: join(TEMPLATES, 'tanstack/gitignore') },
    { path: 'src/routeTree.gen.ts', referencePath: 'src/routeTree.gen.ts', source: null },
    rendered('src/routes/__root.tsx', renderRoot),
    rendered('src/router.tsx', renderRouter),
    rendered('src/components/devtools.tsx', renderDevtools),
  ],
  { name: '@alfredmouelle/tanstack-base', private: true, type: 'module' },
  featureParts,
)

export const tanstackReference: ReferenceApplication = {
  root: reference.root,
  parts: [skeleton, ...featureParts],
}
