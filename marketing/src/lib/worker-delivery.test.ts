import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const marketingRoot = process.cwd()
const repositoryRoot = resolve(marketingRoot, '..')
const packageJson = JSON.parse(readFileSync(resolve(marketingRoot, 'package.json'), 'utf8')) as {
  scripts: Record<string, string>
  devDependencies: Record<string, string>
}
const workerConfig = JSON.parse(
  readFileSync(resolve(marketingRoot, 'wrangler.jsonc'), 'utf8').replace(/^\s*\/\/.*$/gm, ''),
) as Record<string, unknown>
const workflow = readFileSync(
  resolve(repositoryRoot, '.github/workflows/deploy-marketing.yml'),
  'utf8',
)
const runbook = readFileSync(resolve(repositoryRoot, 'docs/runbooks/marketing-worker.md'), 'utf8')

describe('marketing Worker delivery contract', () => {
  it('keeps the Worker configuration isolated from the legacy root config', () => {
    expect(workerConfig).toMatchObject({
      assets: { directory: './dist' },
      name: 'create-stack-marketing',
      workers_dev: true,
    })
    expect(existsSync(resolve(repositoryRoot, 'wrangler.jsonc'))).toBe(true)
  })

  it('uses one package deployment script and a pinned local Wrangler', () => {
    expect(packageJson.scripts.deploy).toBe('node scripts/deploy.mjs')
    expect(packageJson.scripts.smoke).toBe('node scripts/smoke.mjs')
    expect(packageJson.scripts['verify:deployment']).toBe('node scripts/verify-deployment.mjs')
    expect(packageJson.devDependencies.wrangler).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('keeps CI deployment dormant, serialized, and secret-backed', () => {
    expect(workflow).toContain('workflow_dispatch:')
    expect(workflow).not.toMatch(/^\s+(push|pull_request):/m)
    expect(workflow).toContain('group: deploy-marketing')
    expect(workflow).toContain('cancel-in-progress: true')
    expect(workflow).toContain('secrets.CLOUDFLARE_API_TOKEN')
    expect(workflow).toContain('secrets.CLOUDFLARE_ACCOUNT_ID')
    expect(workflow).toContain('pnpm --filter @alfredmouelle/marketing run deploy')
    expect(workflow).toContain('pnpm --filter @alfredmouelle/marketing verify:deployment')
    expect(workflow).not.toContain('publish.yml')
  })

  it('documents the human-controlled migration and rollback steps', () => {
    for (const requiredSection of [
      'scoped API token',
      'First local deployment',
      'GitHub secret setup',
      'Worker validation',
      'filtered deployment from `main`',
      'Public indexability',
      'custom domain',
      'post-deployment validation',
      'Worker rollback',
      'Pages fallback',
      'workers.dev',
      '30-day rollback period',
      'legacy retirement',
    ]) {
      expect(runbook).toContain(requiredSection)
    }

    expect(runbook).not.toMatch(/\/Users\/|[A-Za-z]:\\/)
    expect(runbook).not.toMatch(/CLOUDFLARE_(API_TOKEN|ACCOUNT_ID)\s*:\s*[^$\s`]+/)
  })
})
