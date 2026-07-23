// Stamp project identity: title/meta + README ending with the `# Author` footer verbatim.

import { basename } from 'node:path'
import { TEMPLATES } from './paths.mjs'
import { editFile, join, read, write } from './util.mjs'

/**
 * Project name from the target path. The argument doubles as a directory, so it can be a
 * path (`./apps/api`) — only its last segment names the package, and npm rejects anything
 * but lowercase URL-safe characters.
 */
export const packageName = (target) =>
  basename(target.replace(/[/\\]+$/, ''))
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[._-]+|-+$/g, '') || 'app'

const titleFiles = {
  next: ['src/app/layout.tsx'],
  tanstack: ['src/routes/__root.tsx'],
}

export function stampIdentity(projectDir, projectName, framework, pm) {
  const installCmd = `${pm?.name ?? 'npm'} install`
  const devCmd = pm?.devCmd ?? 'npm run dev'
  // swap placeholder title 'App' in root document/metadata
  for (const rel of titleFiles[framework === 'next' ? 'next' : 'tanstack']) {
    editFile(join(projectDir, rel), (c) => c.replaceAll("title: 'App'", `title: '${projectName}'`))
  }

  const footer = read(join(TEMPLATES, 'README-author.md'))
  const readme = `# ${projectName}

Bootstrapped with [create-stack](https://create-stack.alfredmouelle.com).

## Getting started

\`\`\`bash
${installCmd}
cp .env.example .env   # fill in the values
${devCmd}
\`\`\`

${footer}`
  write(join(projectDir, 'README.md'), readme)
}
