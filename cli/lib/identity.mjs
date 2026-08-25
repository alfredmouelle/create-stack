import { basename } from 'node:path'
import { TEMPLATES } from './paths.mjs'
import { editFile, join, read, write } from './util.mjs'

export const packageName = (target) =>
  basename(target.replace(/[/\\]+$/, ''))
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[._-]+|-+$/g, '') || 'app'

export function stampIdentity(
  projectDir,
  projectName,
  pm,
  { hasDatabase = false, hasDatabaseSchema = false } = {},
) {
  const installCmd = `${pm?.name ?? 'npm'} install`
  const devCmd = pm?.devCmd ?? 'npm run dev'
  const dbPushCmd = pm?.name === 'npm' ? 'npm run db:push' : `${pm?.name ?? 'npm'} db:push`
  editFile(join(projectDir, 'src/lib/site-config.ts'), (c) =>
    c.replaceAll("name: 'App'", `name: '${projectName}'`),
  )
  editFile(join(projectDir, 'public/manifest.json'), (c) =>
    c.replaceAll('"App"', `"${projectName}"`),
  )

  const footer = read(join(TEMPLATES, 'README-author.md'))
  const readme = `# ${projectName}

Bootstrapped with [create-stack](https://create-stack.alfredmouelle.com).

## Getting started

\`\`\`bash
${installCmd}
# .env is generated with local defaults; update it for external services.
${devCmd}
\`\`\`

${
  hasDatabase
    ? `## Local database

\`\`\`bash
./start-database.sh
${hasDatabaseSchema ? dbPushCmd : ''}
\`\`\`
`
    : ''
}

${footer}`
  write(join(projectDir, 'README.md'), readme)
}
