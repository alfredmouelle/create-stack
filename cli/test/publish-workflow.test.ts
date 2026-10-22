import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'

const workflowPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../.github/workflows/publish.yml',
)
const workflow = readFileSync(workflowPath, 'utf8')
const publishJob = workflow.split('\n  publish:\n')[1]

test('publish workflow supports manual dispatch', () => {
  expect(workflow).toContain('workflow_dispatch:')
})

test('publish workflow only accepts release tags on main', () => {
  expect(workflow).toContain('fetch-depth: 0')
  expect(workflow).toContain('refs/tags/v*)')
  expect(workflow).toContain('git fetch origin main --no-tags')
  expect(workflow).toContain('git merge-base --is-ancestor "$GITHUB_SHA" origin/main')
})

test('publish job installs workspace dependencies before npm publish', () => {
  expect(publishJob).toBeDefined()

  const job = publishJob ?? ''
  const install = job.indexOf('pnpm install --frozen-lockfile')
  const publish = job.indexOf('run: npm publish --access public')

  expect(install).toBeGreaterThanOrEqual(0)
  expect(publish).toBeGreaterThan(install)
})

test('marketing deployment waits for publication and verification of the release tag', () => {
  const job = publishJob ?? ''
  const publish = job.indexOf('run: npm publish --access public')
  const verification = job.indexOf(
    'run: pnpm --filter @alfredmouelle/marketing run release:refresh',
  )
  expect(verification).toBeGreaterThan(publish)
  expect(job).toContain(`EXPECTED_CLI_VERSION: \${{ github.ref_name }}`)
  expect(workflow).toContain('needs: publish\n    uses: ./.github/workflows/deploy-marketing.yml')
  expect(workflow).toContain(`cli_version: \${{ github.ref_name }}`)
})
