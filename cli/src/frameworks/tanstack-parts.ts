import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CLERK } from '#lib/auth.mjs'
import { CONVEX_VERSION, PRISMA_VERSION } from '#lib/database.mjs'
import { renderEnvironment } from '#lib/env.mjs'
import { STACK_ROOT, TEMPLATES } from '#lib/paths.mjs'
import type {
  ApplicationPart,
  PartFile,
  ReferenceApplication,
  StackSelection,
  StringMap,
} from '../reference-application.ts'
import { renderMailer, renderRoot, renderTrpc } from './tanstack-renderers.ts'

const root = join(STACK_ROOT, 'apps/tanstack-base')
const read = (path: string): string => readFileSync(join(root, path), 'utf8')
const sql = (selection: StackSelection): boolean =>
  selection.database === 'drizzle' || selection.database === 'prisma'

function stringMap(value: unknown): Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error('Invalid reference manifest map')
  const result: Record<string, string> = {}
  for (const [name, entry] of Object.entries(value)) {
    if (typeof entry !== 'string') throw new Error(`Invalid reference manifest entry: ${name}`)
    result[name] = entry
  }
  return result
}

function manifest(path: string): {
  scripts: StringMap
  dependencies: StringMap
  devDependencies: StringMap
} {
  const value: unknown = JSON.parse(readFileSync(path, 'utf8'))
  if (typeof value !== 'object' || value === null) throw new Error('Invalid reference manifest')
  return {
    scripts: stringMap('scripts' in value ? value.scripts : {}),
    dependencies: stringMap('dependencies' in value ? value.dependencies : {}),
    devDependencies: stringMap('devDependencies' in value ? value.devDependencies : {}),
  }
}

const base = manifest(join(root, 'package.json'))
const mailer = manifest(join(STACK_ROOT, 'packages/mailer/package.json'))
const pick = (source: StringMap, names: readonly string[]): StringMap =>
  Object.fromEntries(
    names.map((name) => {
      const value = source[name]
      if (!value) throw new Error(`Missing reference manifest entry: ${name}`)
      return [name, value]
    }),
  )
const referenceFiles = (paths: readonly string[]): PartFile[] =>
  paths.map((path) => ({ path, referencePath: path, source: join(root, path) }))
const variantFiles = (directory: string, paths: readonly string[]): PartFile[] =>
  paths.map((path) => ({ path, source: join(TEMPLATES, directory, path) }))
const rendered = (
  path: string,
  source: NonNullable<Exclude<PartFile['source'], string>>,
): PartFile => ({
  path,
  referencePath: path,
  source,
})

const sqlDependencies = ['pg']
const sqlDevDependencies = ['@faker-js/faker', '@types/pg', 'dotenv', 'tsx']
const trpcDependencies = [
  '@tanstack/query-core',
  '@tanstack/react-query',
  '@tanstack/react-query-devtools',
  '@tanstack/react-router-ssr-query',
  '@trpc/client',
  '@trpc/server',
  '@trpc/tanstack-react-query',
  'superjson',
]
const mailerDependencies = ['react-email']
const databaseScripts = ['db:generate', 'db:migrate', 'db:push', 'db:studio', 'db:seed']
const ownedDependencies = new Set([
  ...sqlDependencies,
  ...trpcDependencies,
  ...mailerDependencies,
  'better-auth',
  'drizzle-orm',
  'resend',
])
const ownedDevDependencies = new Set([
  ...sqlDevDependencies,
  'drizzle-kit',
  '@react-email/ui',
  'vitest',
  '@testing-library/dom',
  '@testing-library/react',
  'jsdom',
])
const ownedScripts = new Set([...databaseScripts, 'email:dev', 'test'])
const except = (source: StringMap, names: ReadonlySet<string>): StringMap =>
  Object.fromEntries(Object.entries(source).filter(([name]) => !names.has(name)))
const fields = (
  parts: readonly ApplicationPart[],
  key: 'dependencies' | 'devDependencies' | 'scripts',
): Record<string, string> =>
  Object.fromEntries(parts.flatMap((part) => Object.entries(part[key] ?? {})))
function ordered(source: StringMap, values: StringMap): StringMap {
  const keys = [...Object.keys(source), ...Object.keys(values).filter((key) => !(key in source))]
  return Object.fromEntries(
    keys.flatMap((key) => {
      const value = values[key]
      return value === undefined ? [] : [[key, value]]
    }),
  )
}

const parts: readonly ApplicationPart[] = [
  {
    id: 'skeleton',
    selected: () => true,
    dependencies: except(base.dependencies, ownedDependencies),
    devDependencies: except(base.devDependencies, ownedDevDependencies),
    scripts: except(base.scripts, ownedScripts),
    files: [
      ...referenceFiles(['.dockerignore']),
      { path: '.gitignore', referencePath: '.gitignore', source: null },
      ...referenceFiles(['.nvmrc']),
      ...referenceFiles(['Dockerfile']),
      ...referenceFiles(['README.md']),
      ...referenceFiles(['components.json']),
      ...referenceFiles(['public/favicon.ico']),
      ...referenceFiles(['public/favicon.svg']),
      ...referenceFiles(['public/logo192.png']),
      ...referenceFiles(['public/logo512.png']),
      ...referenceFiles(['public/manifest.json']),
      ...referenceFiles(['public/robots.txt']),
      ...referenceFiles(['src/components/form/field-error.tsx']),
      ...referenceFiles(['src/components/form/text-field.tsx']),
      ...referenceFiles(['src/components/theme-provider.tsx']),
      ...referenceFiles(['src/components/theme-toggle.tsx']),
      ...referenceFiles(['src/components/ui/button.tsx']),
      ...referenceFiles(['src/components/ui/card.tsx']),
      ...referenceFiles(['src/components/ui/dropdown-menu.tsx']),
      ...referenceFiles(['src/components/ui/input-group.tsx']),
      ...referenceFiles(['src/components/ui/input.tsx']),
      ...referenceFiles(['src/components/ui/label.tsx']),
      ...referenceFiles(['src/components/ui/skeleton.tsx']),
      ...referenceFiles(['src/components/ui/spinner.tsx']),
      ...referenceFiles(['src/components/ui/table.tsx']),
      ...referenceFiles(['src/lib/site-config.ts']),
      ...referenceFiles(['src/lib/utils.ts']),
      ...referenceFiles(['src/reset.d.ts']),
      ...referenceFiles(['src/routes/index.tsx']),
      ...referenceFiles(['src/styles.css']),
      ...referenceFiles(['tsconfig.json']),
      ...referenceFiles(['tsr.config.json']),
      ...referenceFiles(['vite.config.ts']),
      { path: 'src/routeTree.gen.ts', referencePath: 'src/routeTree.gen.ts', source: null },
      rendered('src/routes/__root.tsx', renderRoot),
      rendered('src/router.tsx', (selection) =>
        selection.trpc
          ? read('src/router.tsx')
          : readFileSync(join(TEMPLATES, 'tanstack/router.no-trpc.tsx'), 'utf8'),
      ),
      rendered('src/components/devtools.tsx', (selection) =>
        selection.trpc
          ? read('src/components/devtools.tsx')
          : readFileSync(join(TEMPLATES, 'tanstack/devtools.no-trpc.tsx'), 'utf8'),
      ),
      rendered('src/env.ts', (_selection, selected) =>
        renderEnvironment(
          selected.flatMap((part) => part.envKeys ?? []),
          selected.flatMap((part) => part.requiredEnvKeys ?? []),
        ),
      ),
      rendered(
        'package.json',
        (_selection, selected) =>
          `${JSON.stringify({ name: '@alfredmouelle/tanstack-base', private: true, type: 'module', scripts: ordered(base.scripts, fields(selected, 'scripts')), dependencies: ordered(base.dependencies, fields(selected, 'dependencies')), devDependencies: ordered(base.devDependencies, fields(selected, 'devDependencies')) }, null, 2)}\n`,
      ),
    ],
  },
  {
    id: 'database',
    selected: sql,
    dependencies: pick(base.dependencies, sqlDependencies),
    devDependencies: pick(base.devDependencies, sqlDevDependencies),
    scripts: pick(base.scripts, databaseScripts),
    envKeys: ['DATABASE_URL'],
    requiredEnvKeys: ['DATABASE_URL'],
    files: [rendered('start-database.sh', () => null)],
  },
  {
    id: 'auth:better-auth',
    selected: (selection) => selection.auth === 'better-auth',
    dependencies: pick(base.dependencies, ['better-auth']),
    envKeys: [
      'BETTER_AUTH_URL',
      'BETTER_AUTH_SECRET',
      'BETTER_AUTH_GOOGLE_CLIENT_ID',
      'BETTER_AUTH_GOOGLE_CLIENT_SECRET',
    ],
    requiredEnvKeys: ['BETTER_AUTH_URL', 'BETTER_AUTH_SECRET'],
    files: [
      ...referenceFiles(['src/features/auth/auth-brand.tsx']),
      ...referenceFiles(['src/features/auth/auth-card.tsx']),
      ...referenceFiles(['src/features/auth/form-alert.tsx']),
      ...referenceFiles(['src/features/auth/google-button.tsx']),
      ...referenceFiles(['src/features/auth/schemas.ts']),
      ...referenceFiles(['src/routes/_authed.tsx']),
      ...referenceFiles(['src/routes/_authed/dashboard.tsx']),
      ...referenceFiles(['src/routes/api/auth/$.ts']),
      ...referenceFiles(['src/routes/auth.tsx']),
      ...referenceFiles(['src/routes/auth/forgot-password.tsx']),
      ...referenceFiles(['src/routes/auth/index.tsx']),
      ...referenceFiles(['src/routes/auth/reset-password.tsx']),
      ...referenceFiles(['src/routes/auth/sign-in.tsx']),
      ...referenceFiles(['src/routes/auth/sign-up.tsx']),
      ...referenceFiles(['src/routes/auth/verify-email.tsx']),
      ...referenceFiles(['src/server/better-auth/client.ts']),
      ...referenceFiles(['src/server/better-auth/emails.tsx']),
      ...referenceFiles(['src/server/better-auth/index.ts']),
      ...referenceFiles(['src/server/better-auth/session.ts']),
      rendered('src/server/db/schemas/auth.schema.ts', (selection) =>
        selection.database === 'drizzle' ? read('src/server/db/schemas/auth.schema.ts') : null,
      ),
      rendered('src/server/better-auth/config.ts', (selection) =>
        selection.database === 'prisma'
          ? readFileSync(join(TEMPLATES, 'tanstack/assembly/better-auth.prisma.txt'), 'utf8')
          : read('src/server/better-auth/config.ts'),
      ),
      {
        path: 'prisma/schema/auth.prisma',
        source: (selection) =>
          selection.database === 'prisma'
            ? readFileSync(join(TEMPLATES, 'database/prisma/prisma/schema/auth.prisma'), 'utf8')
            : null,
      },
    ],
  },
  {
    id: 'auth:clerk',
    selected: (selection) => selection.auth === 'clerk',
    dependencies: { [CLERK.tanstack.pkg]: CLERK.tanstack.range },
    envLines: [
      'VITE_CLERK_PUBLISHABLE_KEY=pk_test_change_me',
      'CLERK_SECRET_KEY=sk_test_change_me',
    ],
    files: variantFiles('auth/clerk/tanstack', [
      'src/routes/sign-in.$.tsx',
      'src/routes/sign-up.$.tsx',
      'src/routes/dashboard.tsx',
      'src/start.ts',
    ]),
  },
  {
    id: 'database:drizzle',
    selected: (selection) => selection.database === 'drizzle',
    dependencies: pick(base.dependencies, ['drizzle-orm']),
    devDependencies: pick(base.devDependencies, ['drizzle-kit']),
    files: [
      ...referenceFiles(['drizzle.config.ts']),
      ...referenceFiles(['src/server/db/index.ts']),
      ...referenceFiles(['src/server/db/keyset.ts']),
      ...referenceFiles(['src/server/db/seed.ts']),
      rendered('src/server/db/schemas/index.ts', (selection) =>
        selection.auth === 'better-auth' ? read('src/server/db/schemas/index.ts') : 'export {}\n',
      ),
    ],
  },
  {
    id: 'database:prisma',
    selected: (selection) => selection.database === 'prisma',
    dependencies: { '@prisma/client': PRISMA_VERSION, '@prisma/adapter-pg': PRISMA_VERSION },
    devDependencies: { prisma: PRISMA_VERSION },
    scripts: {
      'db:generate': 'prisma generate',
      'db:migrate': 'prisma migrate dev',
      'db:push': 'prisma db push',
      'db:studio': 'prisma studio',
      'db:seed': 'tsx src/server/db/seed.ts',
      postinstall: 'prisma generate',
    },
    nativeBuilds: ['prisma', '@prisma/engines', '@prisma/client'],
    files: [
      { path: 'src/generated/prisma/client.ts', source: null },
      ...variantFiles('database/prisma', [
        'src/server/db/index.ts',
        'src/server/db/seed.ts',
        'src/server/db/keyset.ts',
        'prisma/schema/schema.prisma',
        'prisma.config.ts',
      ]),
    ],
  },
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
      ...variantFiles('database/convex/tanstack', [
        'src/routes/convex-demo.tsx',
        'src/convex-env.d.ts',
      ]),
    ],
  },
  {
    id: 'trpc',
    selected: (selection) => selection.trpc,
    dependencies: pick(base.dependencies, trpcDependencies),
    files: [
      ...referenceFiles(['src/routes/api.trpc.$.tsx']),
      ...referenceFiles(['src/server/api/root.ts']),
      ...referenceFiles(['src/server/api/routers/health.router.ts']),
      ...referenceFiles(['src/trpc/devtools.tsx']),
      ...referenceFiles(['src/trpc/query-client.ts']),
      ...referenceFiles(['src/trpc/react.tsx']),
      ...referenceFiles(['src/trpc/server.ts']),
      rendered('src/server/api/trpc.ts', renderTrpc),
    ],
  },
  {
    id: 'mailer',
    selected: (selection) => selection.mailer !== 'none',
    dependencies: pick(base.dependencies, mailerDependencies),
    devDependencies: pick(base.devDependencies, ['@react-email/ui']),
    scripts: pick(base.scripts, ['email:dev']),
    envKeys: ['EMAIL_FROM'],
    files: [
      ...referenceFiles(['src/emails/components/components.tsx']),
      ...referenceFiles(['src/emails/components/context.tsx']),
      ...referenceFiles(['src/emails/components/index.ts']),
      ...referenceFiles(['src/emails/components/theme.ts']),
      ...referenceFiles(['src/emails/reset-password.tsx']),
      ...referenceFiles(['src/emails/verify-email.tsx']),
      ...referenceFiles(['src/server/email/address.ts']),
      ...referenceFiles(['src/server/email/factory.ts']),
      ...referenceFiles(['src/server/email/port.ts']),
      rendered('src/server/email/index.ts', renderMailer),
    ],
  },
  {
    id: 'mailer:resend',
    selected: (selection) => selection.mailer === 'resend',
    dependencies: pick(base.dependencies, ['resend']),
    envKeys: ['RESEND_API_KEY'],
    requiredEnvKeys: ['RESEND_API_KEY'],
    files: referenceFiles(['src/server/email/adapters/resend.ts']),
  },
  ...(['brevo', 'ses'] as const).map((provider): ApplicationPart => {
    const name = provider === 'brevo' ? '@getbrevo/brevo' : '@aws-sdk/client-sesv2'
    return {
      id: `mailer:${provider}`,
      selected: (selection) => selection.mailer === provider,
      dependencies: pick(mailer.dependencies, [name]),
      envKeys:
        provider === 'brevo'
          ? ['BREVO_API_KEY']
          : ['AWS_REGION', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'],
      requiredEnvKeys: provider === 'brevo' ? ['BREVO_API_KEY'] : [],
      files: [
        {
          path: `src/server/email/adapters/${provider}.ts`,
          source: () =>
            readFileSync(
              join(STACK_ROOT, 'packages/mailer/src/adapters', `${provider}.ts`),
              'utf8',
            ).replace(/(from ['"][^'"]+)\.js(['"])/g, '$1$2'),
        },
      ],
    }
  }),
  {
    id: 'testing',
    selected: () => true,
    devDependencies: pick(base.devDependencies, [
      'vitest',
      '@testing-library/dom',
      '@testing-library/react',
      'jsdom',
    ]),
    scripts: pick(base.scripts, ['test']),
    files: [
      rendered('.env.test', () => null),
      rendered('vitest.config.mts', (selection) =>
        sql(selection)
          ? read('vitest.config.mts')
          : readFileSync(join(TEMPLATES, 'testing/vitest.config.mts'), 'utf8'),
      ),
      rendered('src/server/api/trpc.test.ts', (selection) =>
        sql(selection) && selection.auth === 'better-auth' && selection.trpc
          ? read('src/server/api/trpc.test.ts')
          : null,
      ),
      rendered('src/server/better-auth/config.test.ts', (selection) =>
        sql(selection) && selection.auth === 'better-auth'
          ? read('src/server/better-auth/config.test.ts')
          : null,
      ),
      rendered('src/test/app.ts', (selection) =>
        sql(selection) && selection.auth === 'better-auth' && selection.trpc
          ? read('src/test/app.ts')
          : null,
      ),
      rendered('src/test/fakes.ts', (selection) =>
        sql(selection) && selection.auth === 'better-auth' ? read('src/test/fakes.ts') : null,
      ),
      rendered('src/test/global-setup.ts', (selection) =>
        sql(selection)
          ? selection.database === 'prisma'
            ? readFileSync(join(TEMPLATES, 'database/prisma/src/test/global-setup.ts'), 'utf8')
            : read('src/test/global-setup.ts')
          : null,
      ),
      rendered('src/test/setup.ts', (selection) =>
        sql(selection)
          ? selection.database === 'prisma'
            ? readFileSync(join(TEMPLATES, 'database/prisma/src/test/setup.ts'), 'utf8')
            : read('src/test/setup.ts')
          : null,
      ),
    ],
  },
]

export const tanstackReference: ReferenceApplication = { root, parts }
