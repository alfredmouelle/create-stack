import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { isSqlDatabase as isSqlDatabaseName, PRISMA_VERSION } from '#lib/database.ts'
import { renderEnvironment } from '#lib/env.ts'
import { STACK_ROOT, TEMPLATES } from '#lib/paths.ts'
import type {
  ApplicationPart,
  PartFile,
  StackSelection,
  StringMap,
} from '../reference-application.ts'
import { MAILER_PROVIDERS, renderMailerIndex } from './mailer.ts'

type ManifestField = 'dependencies' | 'devDependencies' | 'scripts'
type Manifest = Readonly<Record<ManifestField, StringMap>>

export type JavaScriptReference = {
  readonly root: string
  readonly manifest: Manifest
  readonly read: (path: string) => string
  readonly files: (paths: readonly string[]) => PartFile[]
  readonly pick: (field: ManifestField, names: readonly string[]) => StringMap
}

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

function readManifest(path: string): Manifest {
  const value: unknown = JSON.parse(readFileSync(path, 'utf8'))
  if (typeof value !== 'object' || value === null) throw new Error('Invalid reference manifest')
  return {
    dependencies: stringMap('dependencies' in value ? value.dependencies : {}),
    devDependencies: stringMap('devDependencies' in value ? value.devDependencies : {}),
    scripts: stringMap('scripts' in value ? value.scripts : {}),
  }
}

function pick(source: StringMap, names: readonly string[]): StringMap {
  return Object.fromEntries(
    names.map((name) => {
      const value = source[name]
      if (!value) throw new Error(`Missing reference manifest entry: ${name}`)
      return [name, value]
    }),
  )
}

export function javascriptReference(root: string): JavaScriptReference {
  const manifest = readManifest(join(root, 'package.json'))
  return {
    root,
    manifest,
    read: (path) => readFileSync(join(root, path), 'utf8'),
    files: (paths) =>
      paths.map((path) => ({ path, referencePath: path, source: join(root, path) })),
    pick: (field, names) => pick(manifest[field], names),
  }
}

export const isSqlDatabase = (selection: StackSelection): boolean =>
  isSqlDatabaseName(selection.database)

export const readTemplate = (path: string): string => readFileSync(join(TEMPLATES, path), 'utf8')

export function fillTemplate(path: string, fields: Readonly<Record<string, string>>): string {
  let content = readTemplate(path)
  for (const [key, value] of Object.entries(fields))
    content = content.replaceAll(`__${key}__`, value)
  if (/__[A-Z_]+__/.test(content)) throw new Error(`Unfilled template: ${path}`)
  return content
}

export const variantFiles = (directory: string, paths: readonly string[]): PartFile[] =>
  paths.map((path) => ({ path, source: join(TEMPLATES, directory, path) }))

export const rendered = (
  path: string,
  source: NonNullable<Exclude<PartFile['source'], string>>,
): PartFile => ({ path, referencePath: path, source })

function ordered(source: StringMap, values: StringMap): StringMap {
  const keys = [...Object.keys(source), ...Object.keys(values).filter((key) => !(key in source))]
  return Object.fromEntries(
    keys.flatMap((key) => {
      const value = values[key]
      return value === undefined ? [] : [[key, value]]
    }),
  )
}

export function skeletonPart(
  reference: JavaScriptReference,
  files: readonly PartFile[],
  identity: Readonly<Record<string, unknown>>,
  parts: readonly ApplicationPart[],
): ApplicationPart {
  const unowned = (field: ManifestField): StringMap => {
    const owned = new Set(parts.flatMap((part) => Object.keys(part[field] ?? {})))
    return Object.fromEntries(
      Object.entries(reference.manifest[field]).filter(([name]) => !owned.has(name)),
    )
  }
  const fields = (selected: readonly ApplicationPart[], field: ManifestField) =>
    ordered(
      reference.manifest[field],
      Object.fromEntries(selected.flatMap((part) => Object.entries(part[field] ?? {}))),
    )
  return {
    id: 'skeleton',
    selected: () => true,
    dependencies: unowned('dependencies'),
    devDependencies: unowned('devDependencies'),
    scripts: unowned('scripts'),
    files: [
      ...files,
      rendered('src/env.ts', (_selection, selected) =>
        renderEnvironment(
          selected.flatMap((part) => part.envKeys ?? []),
          selected.flatMap((part) => part.requiredEnvKeys ?? []),
        ),
      ),
      rendered(
        'package.json',
        (_selection, selected) =>
          `${JSON.stringify(
            {
              ...identity,
              scripts: fields(selected, 'scripts'),
              dependencies: fields(selected, 'dependencies'),
              devDependencies: fields(selected, 'devDependencies'),
            },
            null,
            2,
          )}\n`,
      ),
    ],
  }
}

export function sqlDatabaseParts(reference: JavaScriptReference): {
  readonly database: ApplicationPart
  readonly drizzle: ApplicationPart
  readonly prisma: ApplicationPart
} {
  return {
    database: {
      id: 'database',
      selected: isSqlDatabase,
      dependencies: reference.pick('dependencies', ['pg']),
      devDependencies: reference.pick('devDependencies', [
        '@faker-js/faker',
        '@types/pg',
        'dotenv',
        'tsx',
      ]),
      scripts: reference.pick('scripts', [
        'db:generate',
        'db:migrate',
        'db:push',
        'db:studio',
        'db:seed',
      ]),
      envKeys: ['DATABASE_URL'],
      requiredEnvKeys: ['DATABASE_URL'],
      files: [rendered('start-database.sh', () => null)],
    },
    drizzle: {
      id: 'database:drizzle',
      selected: (selection) => selection.database === 'drizzle',
      dependencies: reference.pick('dependencies', ['drizzle-orm']),
      devDependencies: reference.pick('devDependencies', ['drizzle-kit']),
      files: [
        ...reference.files([
          'drizzle.config.ts',
          'src/server/db/index.ts',
          'src/server/db/keyset.ts',
          'src/server/db/seed.ts',
        ]),
        rendered('src/server/db/schemas/index.ts', (selection) =>
          selection.auth === 'better-auth'
            ? reference.read('src/server/db/schemas/index.ts')
            : 'export {}\n',
        ),
      ],
    },
    prisma: {
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
  }
}

export const drizzleAuthSchema = (reference: JavaScriptReference): PartFile =>
  rendered('src/server/db/schemas/auth.schema.ts', (selection) =>
    selection.database === 'drizzle'
      ? reference.read('src/server/db/schemas/auth.schema.ts')
      : null,
  )

export const prismaAuthSchema: PartFile = {
  path: 'prisma/schema/auth.prisma',
  source: (selection) =>
    selection.database === 'prisma'
      ? readTemplate('database/prisma/prisma/schema/auth.prisma')
      : null,
}

export function mailerParts(reference: JavaScriptReference): readonly ApplicationPart[] {
  const mailerPackage = readManifest(join(STACK_ROOT, 'packages/mailer/package.json'))
  return [
    {
      id: 'mailer',
      selected: (selection) => selection.mailer !== 'none',
      dependencies: reference.pick('dependencies', ['react-email']),
      devDependencies: reference.pick('devDependencies', ['@react-email/ui']),
      scripts: reference.pick('scripts', ['email:dev']),
      envKeys: ['EMAIL_FROM'],
      files: [
        ...reference.files([
          'src/emails/components/components.tsx',
          'src/emails/components/context.tsx',
          'src/emails/components/index.ts',
          'src/emails/components/theme.ts',
          'src/emails/reset-password.tsx',
          'src/emails/verify-email.tsx',
          'src/server/email/address.ts',
          'src/server/email/factory.ts',
          'src/server/email/port.ts',
        ]),
        rendered('src/server/email/index.ts', (selection) =>
          selection.mailer === 'none' ? null : renderMailerIndex(selection.mailer),
        ),
      ],
    },
    {
      id: 'mailer:resend',
      selected: (selection) => selection.mailer === 'resend',
      dependencies: reference.pick('dependencies', [MAILER_PROVIDERS.resend.dependency]),
      envKeys: MAILER_PROVIDERS.resend.envKeys,
      requiredEnvKeys: MAILER_PROVIDERS.resend.requiredEnvKeys,
      files: reference.files(['src/server/email/adapters/resend.ts']),
    },
    ...(['brevo', 'ses'] as const).map((provider): ApplicationPart => {
      const { dependency, envKeys, requiredEnvKeys } = MAILER_PROVIDERS[provider]
      return {
        id: `mailer:${provider}`,
        selected: (selection) => selection.mailer === provider,
        dependencies: pick(mailerPackage.dependencies, [dependency]),
        envKeys,
        requiredEnvKeys,
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
  ]
}

export function testingPart(
  reference: JavaScriptReference,
  devDependencies: readonly string[],
): ApplicationPart {
  const betterAuthSql = (selection: StackSelection) =>
    isSqlDatabase(selection) && selection.auth === 'better-auth'
  const test = (path: string, selected: (selection: StackSelection) => boolean) =>
    rendered(path, (selection) => (selected(selection) ? reference.read(path) : null))
  const databaseSetup = (path: string) =>
    rendered(path, (selection) =>
      isSqlDatabase(selection)
        ? selection.database === 'prisma'
          ? readTemplate(join('database/prisma', path))
          : reference.read(path)
        : null,
    )
  return {
    id: 'testing',
    selected: () => true,
    devDependencies: reference.pick('devDependencies', devDependencies),
    scripts: reference.pick('scripts', ['test']),
    files: [
      rendered('.env.test', () => null),
      rendered('vitest.config.mts', (selection) =>
        isSqlDatabase(selection)
          ? reference.read('vitest.config.mts')
          : readTemplate('testing/vitest.config.mts'),
      ),
      test('src/server/api/trpc.test.ts', (selection) =>
        betterAuthSql(selection) && selection.trpc),
      test('src/server/better-auth/config.test.ts', betterAuthSql),
      test('src/test/app.ts', (selection) => betterAuthSql(selection) && selection.trpc),
      test('src/test/fakes.ts', betterAuthSql),
      databaseSetup('src/test/global-setup.ts'),
      databaseSetup('src/test/setup.ts'),
    ],
  }
}

export const renderTrpc =
  (clerkServer: string) =>
  (selection: StackSelection): string => {
    const sql = isSqlDatabase(selection)
    const auth = {
      'better-auth': {
        clerkImport: '',
        betterAuthImport: "import { auth } from '~/server/better-auth'\n",
        session: '  const session = await auth.api.getSession({ headers: opts.headers })\n',
        context: ['session'],
        contextType: ['readonly session: Awaited<ReturnType<typeof auth.api.getSession>>'],
        procedure: 'javascript/protected-better-auth.txt',
      },
      clerk: {
        clerkImport: `import { auth } from '${clerkServer}'\n`,
        betterAuthImport: '',
        session: '',
        context: ['auth: await auth()'],
        contextType: ['readonly auth: Awaited<ReturnType<typeof auth>>'],
        procedure: 'javascript/protected-clerk.txt',
      },
      none: {
        clerkImport: '',
        betterAuthImport: '',
        session: '',
        context: [],
        contextType: [],
        procedure: null,
      },
    }[selection.auth]
    const context = [...(sql ? ['db'] : []), ...auth.context, '...opts']
    return fillTemplate('javascript/trpc.txt', {
      TRPC_EXPORTS: auth.procedure ? 'initTRPC, TRPCError' : 'initTRPC',
      CLERK_IMPORT: auth.clerkImport,
      BETTER_AUTH_IMPORT: auth.betterAuthImport,
      DATABASE_IMPORT: sql ? "import { db } from '~/server/db'\n" : '',
      CONTEXT: `${auth.session}  return { ${context.join(', ')} }`,
      CONTEXT_TYPE: [
        ...(sql ? ['readonly db: typeof db'] : []),
        ...auth.contextType,
        'readonly headers: Headers',
      ].join('\n  '),
      PROTECTED_PROCEDURE: auth.procedure ? `\n${readTemplate(auth.procedure)}` : '',
    })
  }
