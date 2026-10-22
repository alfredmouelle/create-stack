import { join } from 'node:path'
import { CONVEX_VERSION } from '#lib/database.ts'
import { STACK_ROOT } from '#lib/paths.ts'
import {
  drizzleAuthSchema,
  javascriptReference,
  mailerParts,
  prismaAuthSchema,
  readTemplate,
  rendered,
  skeletonPart,
  sqlDatabaseParts,
  variantFiles,
} from '../javascript/reference-parts.ts'
import type { ApplicationPart, ReferenceApplication } from '../reference-application.ts'
import { renderRemixAssets, renderRemixRouter, renderRemixTrpc } from './remix-renderers.ts'

const reference = javascriptReference(join(STACK_ROOT, 'apps/remix-base'))
const sql = sqlDatabaseParts(reference)
const mail = mailerParts(reference).map(
  (part): ApplicationPart =>
    part.id === 'mailer'
      ? {
          ...part,
          dependencies: {
            ...part.dependencies,
            ...reference.pick('dependencies', ['react', 'react-dom']),
          },
          devDependencies: {
            ...part.devDependencies,
            ...reference.pick('devDependencies', ['@types/react', '@types/react-dom']),
          },
        }
      : part,
)

const featureParts: readonly ApplicationPart[] = [
  sql.database,
  sql.drizzle,
  sql.prisma,
  {
    id: 'auth-layout',
    selected: (selection) => selection.auth !== 'none',
    files: reference.files(['src/components/auth-brand.tsx', 'src/components/auth-layout.tsx']),
  },
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
        'src/client/auth-form.tsx',
        'src/server/better-auth/index.ts',
        'src/server/better-auth/emails.ts',
        'src/server/better-auth/pages.tsx',
        'src/server/better-auth/routes.tsx',
      ]),
      rendered('src/server/better-auth/config.ts', (selection) =>
        selection.database === 'prisma'
          ? readTemplate('remix/assembly/better-auth.prisma.txt')
          : reference.read('src/server/better-auth/config.ts'),
      ),
      drizzleAuthSchema(reference),
      prismaAuthSchema,
    ],
  },
  {
    id: 'auth:clerk',
    selected: (selection) => selection.auth === 'clerk',
    dependencies: { '@clerk/clerk-js': '6.40.0', '@clerk/backend': '3.26.0' },
    nativeBuilds: ['browser-tabs-lock', 'core-js'],
    envLines: [
      'REMIX_CLERK_PUBLISHABLE_KEY=pk_test_change_me',
      'CLERK_SECRET_KEY=sk_test_change_me',
      'CLERK_JWT_KEY=',
      'CLERK_AUTHORIZED_PARTIES=http://localhost:3000',
    ],
    files: variantFiles('remix/auth/clerk', [
      'src/client/clerk.tsx',
      'src/server/clerk/auth.ts',
      'src/server/clerk/routes.tsx',
    ]),
  },
  {
    id: 'database:convex',
    selected: (selection) => selection.database === 'convex',
    dependencies: { convex: CONVEX_VERSION },
    scripts: { convex: 'convex dev' },
    envLines: ['CONVEX_DEPLOYMENT=', 'CONVEX_URL=https://example.convex.cloud'],
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
      {
        path: 'convex/auth.config.ts',
        source: (selection) =>
          selection.auth === 'clerk'
            ? readTemplate('remix/database/convex/convex/auth.config.ts')
            : null,
      },
      ...variantFiles('remix/database/convex', [
        'src/client/convex-api.ts',
        'src/client/convex.tsx',
      ]),
      {
        path: 'src/server/convex.tsx',
        source: (selection) =>
          readTemplate('remix/database/convex/src/server/convex.tsx').replace(
            '__TOKEN_ENDPOINT__',
            selection.auth === 'clerk' ? "'/api/convex-token'" : 'null',
          ),
      },
    ],
  },
  {
    id: 'trpc',
    selected: (selection) => selection.trpc,
    dependencies: reference.pick('dependencies', ['@trpc/client', '@trpc/server', 'superjson']),
    files: [
      ...reference.files([
        'src/server/api/root.ts',
        'src/server/api/routes.ts',
        'src/server/api/routers/health.router.ts',
        'src/client/api-demo.tsx',
      ]),
      rendered('src/server/api/trpc.ts', renderRemixTrpc),
    ],
  },
  ...mail,
  {
    id: 'testing',
    selected: () => true,
    devDependencies: reference.pick('devDependencies', ['vitest']),
    scripts: reference.pick('scripts', ['test']),
    files: [
      rendered('.env.test', () => null),
      ...reference.files(['src/router.test.ts']),
      rendered('vitest.config.mts', (selection) =>
        selection.database === 'drizzle' || selection.database === 'prisma'
          ? reference.read('vitest.config.mts')
          : readTemplate('testing/vitest.config.mts'),
      ),
      ...['src/test/global-setup.ts', 'src/test/setup.ts'].map((path) =>
        rendered(path, (selection) =>
          selection.database === 'drizzle'
            ? reference.read(path)
            : selection.database === 'prisma'
              ? readTemplate(`database/prisma/${path}`)
              : null,
        ),
      ),
      rendered('src/server/better-auth/routes.test.ts', (selection) =>
        selection.auth === 'better-auth'
          ? reference.read('src/server/better-auth/routes.test.ts')
          : null,
      ),
      rendered('src/test/fakes.ts', (selection) =>
        selection.auth === 'better-auth' ? reference.read('src/test/fakes.ts') : null,
      ),
      rendered('src/server/api/routes.test.ts', (selection) =>
        selection.trpc ? reference.read('src/server/api/routes.test.ts') : null,
      ),
    ],
  },
]

const skeleton = skeletonPart(
  reference,
  [
    ...reference.files([
      'scripts/aliases.ts',
      'src/components/document.tsx',
      'src/components/brand-mark.tsx',
      'src/components/server-address.tsx',
      'src/components/theme-toggle.tsx',
      'src/lib/site-config.ts',
      'src/lib/utils.ts',
      'src/pages/home.tsx',
      'src/client/entry.ts',
      'src/client/observability.ts',
      'src/client/server-address.tsx',
      'src/client/theme.tsx',
      'src/client/ui-styles.ts',
      'src/server/observability.ts',
      'src/server.ts',
      'src/stylesheet.ts',
      'src/public-files.ts',
      'src/render.tsx',
      'src/routes.ts',
      'src/styles.css',
      'tsconfig.json',
      'README.md',
      '.nvmrc',
      'public/favicon.ico',
      'public/favicon.svg',
      'public/logo192.png',
      'public/logo512.png',
      'public/manifest.json',
    ]),
    rendered('src/router.tsx', renderRemixRouter),
    rendered('src/assets.ts', renderRemixAssets),
    { path: '.gitignore', referencePath: '.gitignore', source: null },
    { path: 'turbo.json', referencePath: 'turbo.json', source: null },
    { path: '.gitignore', source: () => readTemplate('remix/gitignore') },
  ],
  { name: '@alfredmouelle/remix-base', version: '0.1.0', private: true, type: 'module' },
  featureParts,
)

export const remixReference: ReferenceApplication = {
  root: reference.root,
  parts: [skeleton, ...featureParts],
}
