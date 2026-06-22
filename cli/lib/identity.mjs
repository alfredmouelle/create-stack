// Step A4 — stamp the project identity: title/meta + a README that ends with
// the stack's `# Author` footer verbatim.

import { STACK_ROOT } from './manifests.mjs'
import { editFile, join, read, write } from './util.mjs'

const titleFiles = {
  next: ['src/app/layout.tsx'],
  tanstack: ['src/routes/__root.tsx'],
}

export function stampIdentity(projectDir, projectName, framework) {
  // Swap the placeholder title 'App' in the root document/metadata.
  for (const rel of titleFiles[framework === 'next' ? 'next' : 'tanstack']) {
    editFile(join(projectDir, rel), (c) => c.replaceAll("title: 'App'", `title: '${projectName}'`))
  }

  const footer = read(join(STACK_ROOT, 'patterns/_baseline/README-author.md'))
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
