import { basename } from 'node:path'
import type { Database } from '../../../packages/stack-config/src/index.ts'
import type { PackageManager } from '../framework-module.ts'
import { readJsonObject, writeJsonObject } from '../javascript/json.ts'
import { TEMPLATES } from './paths.ts'
import { editFile, join, read, write } from './util.ts'
import { CLI_VERSION } from './version.ts'

export type CreationMetadata = { readonly initVersion: string }

export type ReadmeContext = {
  readonly pm: PackageManager
  readonly hasDatabase: boolean
  readonly hasDatabaseSchema: boolean
  readonly database: Database
  readonly monorepo?: boolean
  readonly appPath?: string
}

export type ReadmeRequest = ReadmeContext & { readonly projectName: string }

export const packageName = (target: string): string =>
  basename(target.replace(/[/\\]+$/, ''))
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[._-]+|-+$/g, '') || 'app'

const packageCommand = (pm: PackageManager, script: string): string =>
  pm.name === 'npm' ? `npm run ${script}` : `${pm.name} ${script}`

export function creationMetadata(): CreationMetadata {
  return { initVersion: CLI_VERSION }
}

function nextSection(appPath = ''): string {
  const envPath = appPath ? `${appPath}/.env` : '.env'
  const sourcePath = appPath ? `${appPath}/src/` : 'src/'
  const configPath = appPath ? `${appPath}/src/lib/site-config.ts` : 'src/lib/site-config.ts'

  return `## What's next? How do I make an app with this?

This project starts with the base selected during bootstrap. Keep the parts you need, replace the starter screen, and add integrations when the app needs them.

Start in [\`${sourcePath}\`](./${sourcePath}) and update [\`${configPath}\`](./${configPath}) with your application identity. The CLI creates [\`${envPath}\`](./${envPath}) with local defaults and [\`${envPath}.example\`](./${envPath}.example) with placeholders. Fill in provider credentials before using external services, and do not commit \`${envPath}\`.

Add an integration after creation with:

\`\`\`bash
create-stack add <capability> [provider]
\`\`\`

Changing a port provider replaces its generated adapter by default. Pass \`--keep-files\` when both implementations need to stay in the project.`
}

function databaseSection({
  pm,
  hasDatabase,
  hasDatabaseSchema,
  database,
  monorepo = false,
  appPath = '',
}: ReadmeContext): string {
  if (database === 'convex') {
    return `## Convex

Start the local Convex workflow with:

\`\`\`bash
${monorepo ? `cd ${appPath}\n` : ''}${packageCommand(pm, 'convex')}
\`\`\``
  }
  if (!hasDatabase) return ''

  const scriptPath = monorepo
    ? 'start-database.sh'
    : appPath
      ? `${appPath}/start-database.sh`
      : 'start-database.sh'
  const dbPush = hasDatabaseSchema ? `\n${packageCommand(pm, 'db:push')}` : ''
  return `## Local database

The generated script starts PostgreSQL through Docker or Podman. Run:

\`\`\`bash
./${scriptPath}${dbPush}
\`\`\`

\`${packageCommand(pm, 'test')}\` starts a separate test database from \`.env.test\`, applies the schema and empties every table before each test. Override its URL in \`.env.test.local\`.`
}

function learnMoreSection(): string {
  return `## Learn more

- [create-stack documentation](https://create-stack.alfredmouelle.com)
- [create-stack CLI reference](https://github.com/alfredmouelle/create-stack/blob/main/cli/README.md)
- [create-stack GitHub repository](https://github.com/alfredmouelle/create-stack)`
}

function deploymentSection(): string {
  return `## How do I deploy this?

The project includes a Dockerfile for container deployments. Set the production environment variables listed in \`.env.example\` on your host, then follow your hosting provider's Docker deployment guide.`
}

export function renderProjectReadme({
  projectName,
  pm,
  hasDatabase,
  hasDatabaseSchema,
  database,
  monorepo = false,
  appPath = '',
}: ReadmeRequest): string {
  const footer = read(join(TEMPLATES, 'README-author.md'))
  const installCmd = `${pm.name} install`
  const devCmd = pm.devCmd
  const intro = monorepo
    ? `A ${appPath === 'apps/web' ? 'monorepo' : 'workspace'} scaffolded with [create-stack](https://create-stack.alfredmouelle.com). The application lives in [\`${appPath}\`](./${appPath}).`
    : 'This project was bootstrapped with [create-stack](https://create-stack.alfredmouelle.com).'
  const databaseInstructions = databaseSection({
    pm,
    hasDatabase,
    hasDatabaseSchema,
    database,
    monorepo,
    appPath,
  })

  return `# ${projectName}

${intro}

## Getting started

\`\`\`bash
${installCmd}
# .env is generated with local defaults; update it for external services.
${devCmd}
\`\`\`

${nextSection(appPath)}

${databaseInstructions ? `\n${databaseInstructions}` : ''}

${learnMoreSection()}

${deploymentSection()}

${footer}`
}

export function stampIdentity(
  projectDir: string,
  projectName: string,
  pm: PackageManager,
  {
    hasDatabase = false,
    hasDatabaseSchema = false,
    database = 'none',
    metadata,
    monorepo = false,
    appPath = '',
  }: Partial<Omit<ReadmeContext, 'pm'>> & { readonly metadata?: CreationMetadata } = {},
): void {
  editFile(join(projectDir, 'src/lib/site-config.ts'), (c) =>
    c.replaceAll("name: 'App'", `name: '${projectName}'`),
  )
  editFile(join(projectDir, 'public/manifest.json'), (c) =>
    c.replaceAll('"App"', `"${projectName}"`),
  )

  const pkgPath = join(projectDir, 'package.json')
  const pkg = readJsonObject(pkgPath)
  pkg.createStackMetadata = metadata
  writeJsonObject(pkgPath, pkg)
  write(
    join(projectDir, 'README.md'),
    renderProjectReadme({
      projectName,
      pm,
      hasDatabase,
      hasDatabaseSchema,
      database,
      monorepo,
      appPath,
    }),
  )
}
