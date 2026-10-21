import { join } from 'node:path'
import { CONVEX_VERSION } from '#lib/database.ts'
import { STACK_ROOT, TEMPLATES } from '#lib/paths.ts'
import {
  drizzleAuthSchema,
  javascriptReference,
  mailerParts,
  prismaAuthSchema,
  readTemplate,
  rendered,
  skeletonPart,
  sqlDatabaseParts,
  testingPart,
  variantFiles,
} from '../javascript/reference-parts.ts'
import type { ApplicationPart, ReferenceApplication } from '../reference-application.ts'
import { renderMain, renderRasenganTrpc } from './rasengan-renderers.ts'

const reference = javascriptReference(join(STACK_ROOT, 'apps/rasengan-base'))
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
        'src/features/auth/sign-in-form.tsx',
        'src/features/auth/form-alert.tsx',
        'src/features/auth/google-button.tsx',
        'src/features/auth/use-google-sign-in.ts',
        'src/features/auth/use-sign-in-form.ts',
        'src/features/auth/auth-card.tsx',
        'src/features/auth/use-sign-out.ts',
        'src/features/auth/reset-password-form.tsx',
        'src/features/auth/schemas.ts',
        'src/features/auth/use-forgot-password-form.ts',
        'src/features/auth/auth-brand.tsx',
        'src/features/auth/forgot-password-form.tsx',
        'src/features/auth/sign-up-form.tsx',
        'src/features/auth/use-sign-up-form.ts',
        'src/features/auth/verify-email-actions.tsx',
        'src/features/auth/use-reset-password-form.ts',
        'src/app/_routes/auth/reset-password.page.tsx',
        'src/app/_routes/auth/sign-in.page.tsx',
        'src/app/_routes/auth/layout.tsx',
        'src/app/_routes/auth/verify-email.page.tsx',
        'src/app/_routes/auth/forgot-password.page.tsx',
        'src/app/_routes/auth/index.page.tsx',
        'src/app/_routes/auth/sign-up.page.tsx',
        'src/app/_api/auth/[action].route.ts',
        'src/app/_api/auth/providers.route.ts',
        'src/app/_api/auth/[group]/[action].route.ts',
        'src/app/_routes/dashboard.page.tsx',
        'src/server/better-auth/client.ts',
        'src/server/better-auth/emails.tsx',
        'src/server/better-auth/index.ts',
      ]),
      drizzleAuthSchema(reference),
      prismaAuthSchema,
      rendered('src/server/better-auth/config.ts', (selection) =>
        selection.database === 'prisma'
          ? readTemplate('rasengan/assembly/better-auth.prisma.txt')
          : reference.read('src/server/better-auth/config.ts'),
      ),
    ],
  },
  {
    id: 'auth:clerk',
    selected: (selection) => selection.auth === 'clerk',
    dependencies: { '@clerk/react': '6.18.0', '@clerk/backend': '3.26.0' },
    envLines: [
      'RASENGAN_CLERK_PUBLISHABLE_KEY=pk_test_change_me',
      'CLERK_SECRET_KEY=sk_test_change_me',
      'CLERK_AUTHORIZED_PARTIES=http://localhost:3000',
    ],
    files: variantFiles('rasengan/auth/clerk', [
      'src/server/clerk.ts',
      'src/app/_api/session.route.ts',
      'src/app/_routes/sign-in.page.tsx',
      'src/app/_routes/sign-up.page.tsx',
      'src/app/_routes/dashboard.page.tsx',
    ]),
  },
  sql.drizzle,
  sql.prisma,
  {
    id: 'database:convex',
    selected: (selection) => selection.database === 'convex',
    dependencies: { convex: CONVEX_VERSION },
    scripts: { convex: 'convex dev' },
    envLines: ['CONVEX_DEPLOYMENT=', 'RASENGAN_CONVEX_URL=https://example.convex.cloud'],
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
      ...variantFiles('rasengan/database/convex', ['src/app/_routes/convex-demo.page.tsx']),
      {
        path: 'src/components/convex-provider.tsx',
        source: (selection) =>
          readTemplate(
            `rasengan/database/convex/src/components/convex-provider.${selection.auth === 'clerk' ? 'clerk' : 'plain'}.tsx`,
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
      '@trpc/server',
      '@trpc/react-query',
      'superjson',
    ]),
    files: [
      ...reference.files([
        'src/app/_api/trpc/[procedure].route.ts',
        'src/server/api/root.ts',
        'src/server/api/routers/health.router.ts',
        'src/trpc/query-client.ts',
        'src/trpc/react.tsx',
      ]),
      rendered('src/server/api/trpc.ts', renderRasenganTrpc),
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
      'public/favicon.ico',
      'public/favicon.svg',
      'public/logo192.png',
      'public/logo512.png',
      'public/manifest.json',
      'rasengan-env.d.ts',
      'rasengan.config.js',
      'scripts/build.ts',
      'scripts/start.ts',
      'src/app/_api/health.route.ts',
      'src/app/_routes/index.page.tsx',
      'src/app/_routes/layout.tsx',
      'src/app/app.router.ts',
      'src/components/brand-mark.tsx',
      'src/components/server-address.tsx',
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
      'src/index.ts',
      'src/lib/site-config.ts',
      'src/lib/utils.ts',
      'src/reset.d.ts',
      'src/styles.css',
      'src/template.tsx',
      'tsconfig.json',
    ]),
    { path: '.gitignore', referencePath: '.gitignore', source: null },
    { path: 'turbo.json', referencePath: 'turbo.json', source: null },
    { path: '.gitignore', source: join(TEMPLATES, 'rasengan/gitignore') },
    rendered('src/main.tsx', renderMain),
  ],
  { name: '@alfredmouelle/rasengan-base', version: '0.1.0', private: true, type: 'module' },
  featureParts,
)

export const rasenganReference: ReferenceApplication = {
  root: reference.root,
  parts: [skeleton, ...featureParts],
}
