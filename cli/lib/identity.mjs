// Stamp project identity: title/meta + README ending with the `# Author` footer verbatim.

import { TEMPLATES } from './paths.mjs'
import { editFile, join, read, write } from './util.mjs'

const titleFiles = {
  next: ['src/app/layout.tsx'],
  tanstack: ['src/routes/__root.tsx'],
}

export function stampIdentity(projectDir, projectName, framework) {
  // swap placeholder title 'App' in root document/metadata
  for (const rel of titleFiles[framework === 'next' ? 'next' : 'tanstack']) {
    editFile(join(projectDir, rel), (c) => c.replaceAll("title: 'App'", `title: '${projectName}'`))
  }

  const footer = read(join(TEMPLATES, 'README-author.md'))
  const readme = `# ${projectName}

Bootstrapped from the personal reference stack.

## Getting started

\`\`\`bash
pnpm install
cp .env.example .env   # fill in the values
pnpm dev
\`\`\`

${footer}`
  write(join(projectDir, 'README.md'), readme)
}
