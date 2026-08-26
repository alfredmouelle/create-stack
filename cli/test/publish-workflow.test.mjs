import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'

const workflowPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../.github/workflows/publish-cli.yml',
)
const workflow = readFileSync(workflowPath, 'utf8')
const publishJob = workflow.split('\n  publish:\n')[1]

test('publish workflow supports manual dispatch', () => {
  expect(workflow).toContain('workflow_dispatch:')
})

test('publish job installs workspace dependencies before npm publish', () => {
  expect(publishJob).toBeDefined()

  const install = publishJob.indexOf('pnpm install --frozen-lockfile')
  const publish = publishJob.indexOf('run: npm publish --access public')

  expect(install).toBeGreaterThanOrEqual(0)
  expect(publish).toBeGreaterThan(install)
})
