import { basename } from 'node:path'
import { TEMPLATES } from './paths.mjs'
import { editFile, join, read, readJSON, write, writeJSON } from './util.mjs'
import { CLI_VERSION } from './version.mjs'

export const packageName = (target) =>
  basename(target.replace(/[/\\]+$/, ''))
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[._-]+|-+$/g, '') || 'app'

const packageCommand = (pm, script) =>
  pm?.name === 'npm' ? `npm run ${script}` : `${pm?.name ?? 'npm'} ${script}`

export function creationMetadata() {
  return { initVersion: CLI_VERSION }
}

function nextSection(appPath = '') {
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
}) {
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
\`\`\``
}

function learnMoreSection() {
  return `## Learn more

- [create-stack documentation](https://create-stack.alfredmouelle.com)
- [create-stack CLI reference](https://github.com/alfredmouelle/create-stack/blob/main/cli/README.md)
- [create-stack GitHub repository](https://github.com/alfredmouelle/create-stack)`
}

function deploymentSection() {
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
}) {
  const footer = read(join(TEMPLATES, 'README-author.md'))
  const installCmd = `${pm?.name ?? 'npm'} install`
  const devCmd = pm?.devCmd ?? 'npm run dev'
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
      hasDatabase,
      hasDatabaseSchema,
      database,
      monorepo,
      appPath,
    }),
  )
}
