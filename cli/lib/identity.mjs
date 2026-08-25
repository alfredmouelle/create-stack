import { basename } from 'node:path'
import { TEMPLATES } from './paths.mjs'
import { editFile, join, read, readJSON, write, writeJSON } from './util.mjs'
import { CLI_VERSION } from './version.mjs'

export const packageName = (target) =>
  basename(target.replace(/[/\\]+$/, ''))
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[._-]+|-+$/g, '') || 'app'

const FRAMEWORK_LABELS = {
  next: 'Next.js App Router',
  tanstack: 'TanStack Start',
}

const DATABASE_LABELS = {
  drizzle: 'Drizzle + PostgreSQL',
  prisma: 'Prisma + PostgreSQL',
  convex: 'Convex',
  none: 'None',
}

const AUTH_LABELS = {
  'better-auth': 'better-auth',
  clerk: 'Clerk',
  none: 'None',
}

const MAILER_LABELS = {
  resend: 'Resend',
  brevo: 'Brevo',
  ses: 'Amazon SES',
  none: 'None',
}

const titleCase = (value) =>
  value
    .split('-')
    .map((part) => `${part[0].toUpperCase()}${part.slice(1)}`)
    .join(' ')

const packageCommand = (pm, script) =>
  pm?.name === 'npm' ? `npm run ${script}` : `${pm?.name ?? 'npm'} ${script}`

const commandRows = ({ pm, hasDatabaseSchema, database, monorepo = false, appPath = '' }) => [
  ['dev', pm?.devCmd ?? 'npm run dev', 'Start the development server.'],
  ['build', packageCommand(pm, 'build'), 'Build the application for production.'],
  ['typecheck', packageCommand(pm, 'typecheck'), 'Check TypeScript without emitting files.'],
  ['check', packageCommand(pm, 'check'), 'Run Biome checks.'],
  ['check:write', packageCommand(pm, 'check:write'), 'Format files and apply safe fixes.'],
  ...(hasDatabaseSchema
    ? [
        [
          'db:generate',
          packageCommand(pm, 'db:generate'),
          'Generate database client or migrations.',
        ],
        ['db:migrate', packageCommand(pm, 'db:migrate'), 'Apply database migrations.'],
        ['db:push', packageCommand(pm, 'db:push'), 'Apply the current schema directly.'],
        ['db:studio', packageCommand(pm, 'db:studio'), 'Open the database studio.'],
        ['db:seed', packageCommand(pm, 'db:seed'), 'Seed local data.'],
      ]
    : []),
  ...(database === 'convex'
    ? [
        [
          'convex',
          monorepo
            ? `cd ${appPath} && ${packageCommand(pm, 'convex')}`
            : packageCommand(pm, 'convex'),
          'Start the Convex development workflow.',
        ],
      ]
    : []),
]

const stackRows = ({
  framework,
  database,
  auth,
  trpc,
  mailerProvider,
  capabilities,
  monorepo,
  pm,
}) => {
  const capabilityText = Object.entries(capabilities ?? {})
    .map(([name, provider]) => `${titleCase(name)}${provider ? ` (${provider})` : ''}`)
    .join(', ')

  return [
    ['Framework', FRAMEWORK_LABELS[framework] ?? framework],
    ['Database', DATABASE_LABELS[database] ?? database],
    ['Auth', AUTH_LABELS[auth] ?? auth],
    ['tRPC', trpc ? 'Included' : 'Not included'],
    ['Mailer', MAILER_LABELS[mailerProvider] ?? mailerProvider],
    ['Capabilities', capabilityText || 'None'],
    ['Package manager', pm?.name ?? 'npm'],
    ['Workspace', monorepo ? titleCase(monorepo) : 'Standalone app'],
  ]
}

const markdownTable = (headers, rows) =>
  `${headers.join(' | ')}\n${headers.map(() => '---').join(' | ')}\n${rows
    .map((row) => row.join(' | '))
    .join('\n')}`

export function creationMetadata({
  framework,
  database,
  auth,
  trpc,
  mailerProvider,
  capabilities = {},
  monorepo = false,
  pm,
}) {
  return {
    schemaVersion: 1,
    initVersion: CLI_VERSION,
    framework,
    database,
    auth,
    trpc,
    mailer: mailerProvider,
    capabilities,
    monorepo: monorepo || false,
    packageManager: pm?.name ?? 'npm',
  }
}

function stackSection(metadata) {
  return `## Stack\n\n${markdownTable(
    ['Part', 'Selection'],
    stackRows({
      framework: metadata.framework,
      database: metadata.database,
      auth: metadata.auth,
      trpc: metadata.trpc,
      mailerProvider: metadata.mailer,
      capabilities: metadata.capabilities,
      monorepo: metadata.monorepo,
      pm: { name: metadata.packageManager },
    }),
  )}`
}

function commandsSection({ pm, hasDatabaseSchema, database, monorepo = false, appPath = '' }) {
  return `## Common commands\n\n${markdownTable(
    ['Command', 'What it does'],
    commandRows({ pm, hasDatabaseSchema, database, monorepo, appPath }).map(
      ([, command, description]) => [`\`${command}\``, description],
    ),
  )}`
}

function environmentSection(appPath = '') {
  const envPath = appPath ? `${appPath}/.env` : '.env'
  const examplePath = appPath ? `${appPath}/.env.example` : '.env.example'
  return `## Environment\n\nThe CLI creates [\`${envPath}\`](./${envPath}) with local defaults and [\`${examplePath}\`](./${examplePath}) with placeholders. Fill in the provider credentials before using external services. Do not commit \`${envPath}\`.`
}

function databaseSection({
  pm,
  hasDatabase,
  hasDatabaseSchema,
  database,
  monorepo = false,
  appPath = '',
}) {
  if (database === 'convex') {
    return `## Convex\n\nStart the local Convex workflow with:\n\n\`\`\`bash\n${monorepo ? `cd ${appPath}\n` : ''}${packageCommand(pm, 'convex')}\n\`\`\``
  }
  if (!hasDatabase) return ''

  const scriptPath = monorepo
    ? 'start-database.sh'
    : appPath
      ? `${appPath}/start-database.sh`
      : 'start-database.sh'
  const dbPush = hasDatabaseSchema ? `\n${packageCommand(pm, 'db:push')}` : ''
  return `## Local database\n\nThe generated script starts PostgreSQL through Docker or Podman. Run:\n\n\`\`\`bash\n./${scriptPath}${dbPush}\n\`\`\``
}

function projectStructureSection({ monorepo, framework, appPath = '' }) {
  if (monorepo) {
    return `## Project structure\n\n- [\`${appPath}\`](./${appPath}): the ${FRAMEWORK_LABELS[framework] ?? framework} application.\n- [\`packages/\`](./packages): shared packages added to the workspace.\n- [\`.github/workflows/ci.yml\`](./.github/workflows/ci.yml): typecheck and Biome checks for the workspace.`
  }
  const routeDir = framework === 'next' ? 'src/app' : 'src/routes'
  return `## Project structure\n\n- [\`${routeDir}/\`](./${routeDir}): routes and layouts.\n- [\`src/server/\`](./src/server): database, auth, API, and capability adapters.\n- [\`src/lib/\`](./src/lib): shared configuration and utilities.\n- [\`public/\`](./public): static assets.`
}

function extensionSection() {
  return `## Add capabilities\n\nAdd an integration after creation with:\n\n\`\`\`bash\ncreate-stack add <capability> [provider]\n\`\`\`\n\nChanging a port provider replaces its generated adapter by default. Pass \`--keep-files\` when both implementations need to stay in the project.`
}

export function renderProjectReadme({
  projectName,
  pm,
  metadata,
  hasDatabase,
  hasDatabaseSchema,
  database,
  monorepo = false,
  appPath = '',
}) {
  const footer = read(join(TEMPLATES, 'README-author.md'))
  const installCmd = `${pm?.name ?? 'npm'} install`
  const devCmd = pm?.devCmd ?? 'npm run dev'
  const intro = monorepo
    ? `${titleCase(metadata.monorepo)} workspace scaffolded with [create-stack](https://create-stack.alfredmouelle.com). The application lives in [\`${appPath}\`](./${appPath}).`
    : 'Bootstrapped with [create-stack](https://create-stack.alfredmouelle.com).'
  const startPath = appPath && !monorepo ? `\ncd ${appPath}` : ''

  return `# ${projectName}

${intro}

## Getting started

\`\`\`bash
${installCmd}${startPath}
# .env is generated with local defaults; update it for external services.
${devCmd}
\`\`\`

${stackSection(metadata)}

${commandsSection({ pm, hasDatabaseSchema, database, monorepo, appPath })}

${environmentSection(appPath)}

${databaseSection({ pm, hasDatabase, hasDatabaseSchema, database, monorepo, appPath })}

${projectStructureSection({ framework: metadata.framework, monorepo, appPath })}

${extensionSection()}

${footer}`
}

export function stampIdentity(
  projectDir,
  projectName,
  pm,
  {
    hasDatabase = false,
    hasDatabaseSchema = false,
    database = 'none',
    metadata,
    monorepo = false,
    appPath = '',
  } = {},
) {
  editFile(join(projectDir, 'src/lib/site-config.ts'), (c) =>
    c.replaceAll("name: 'App'", `name: '${projectName}'`),
  )
  editFile(join(projectDir, 'public/manifest.json'), (c) =>
    c.replaceAll('"App"', `"${projectName}"`),
  )

  const pkgPath = join(projectDir, 'package.json')
  const pkg = readJSON(pkgPath)
  pkg.createStackMetadata = metadata
  writeJSON(pkgPath, pkg)
  write(
    join(projectDir, 'README.md'),
    renderProjectReadme({
      projectName,
      pm,
      metadata,
      hasDatabase,
      hasDatabaseSchema,
      database,
      monorepo,
      appPath,
    }),
  )
}
