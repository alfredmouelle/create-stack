import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getBuildSiteMetadata } from './site-metadata'

const publicOrigin = 'https://create-stack.alfredmouelle.com'
const requiredPublicAssets = [
  'favicon.ico',
  'favicon.svg',
  'og-image.png',
  'robots.txt',
  'sitemap.xml',
  'llms.txt',
]

let buildRoot = ''
let publicBuild = ''
let validationBuild = ''

function readBuildFile(buildPath: string, fileName: string) {
  return readFileSync(join(buildPath, fileName), 'utf8')
}

function buildMarketingSite(mode: 'public' | 'validation') {
  const outputPath = join(buildRoot, mode)
  const buildEnvironment: typeof process.env = {
    ...process.env,
    ASTRO_TELEMETRY_DISABLED: '1',
    NODE_ENV: 'production',
    PUBLIC_MARKETING_BUILD_MODE: mode,
    npm_config_node_env: 'production',
  }
  delete buildEnvironment.VITEST
  delete buildEnvironment.VITEST_POOL_ID
  delete buildEnvironment.npm_lifecycle_event
  delete buildEnvironment.npm_lifecycle_script
  execFileSync(
    join(process.cwd(), 'node_modules/.bin/astro'),
    ['build', '--mode', mode, '--outDir', relative(process.cwd(), outputPath)],
    {
      cwd: process.cwd(),
      env: buildEnvironment,
      stdio: 'pipe',
    },
  )
  return outputPath
}

describe('marketing metadata builds', () => {
  beforeAll(() => {
    buildRoot = mkdtempSync(join(tmpdir(), 'create-stack-marketing-'))
    publicBuild = buildMarketingSite('public')
    validationBuild = buildMarketingSite('validation')
  }, 120_000)

  afterAll(() => {
    rmSync(buildRoot, { force: true, recursive: true })
  })

  it('does not let the test-only fallback override an explicit build mode', () => {
    expect(getBuildSiteMetadata('validation', 'public').indexable).toBe(false)
    expect(getBuildSiteMetadata('public', 'validation').indexable).toBe(true)
  })

  it('keeps validation builds out of search indexes', () => {
    const html = readBuildFile(validationBuild, 'index.html')
    const robots = readBuildFile(validationBuild, 'robots.txt')

    expect(html).toContain('<meta name="robots" content="noindex, nofollow">')
    expect(robots).toContain('User-agent: *\nDisallow: /')
    expect(robots).not.toContain('Allow: /')
    expect(robots).not.toContain('Sitemap:')
  })

  it('publishes the production metadata contract and local assets', () => {
    const html = readBuildFile(publicBuild, 'index.html')
    const robots = readBuildFile(publicBuild, 'robots.txt')
    const sitemap = readBuildFile(publicBuild, 'sitemap.xml')
    const llms = readBuildFile(publicBuild, 'llms.txt')

    expect(html).toContain('<meta name="robots" content="index, follow">')
    expect(html).toContain(
      '<meta name="description" content="Create Stack generates a working SaaS project from your choices. It wires the selected pieces together and removes the rest.">',
    )
    expect(html).toContain('<title>Create Stack. A real app wired around your choices</title>')
    expect(html).toContain('<link rel="canonical" href="https://create-stack.alfredmouelle.com/">')
    expect(html).toContain('<link rel="icon" href="/favicon.svg" type="image/svg+xml">')
    expect(html).toContain('<link rel="icon" href="/favicon.ico" sizes="48x48">')
    expect(html).toContain(
      '<meta property="og:title" content="Create Stack. A real app wired around your choices">',
    )
    expect(html).toContain(
      '<meta property="og:description" content="Create Stack generates a working SaaS project from your choices. It wires the selected pieces together and removes the rest.">',
    )
    expect(html).toContain(
      '<meta property="og:url" content="https://create-stack.alfredmouelle.com/">',
    )
    expect(html).toContain('<meta property="og:site_name" content="create-stack">')
    expect(html).toContain(
      '<meta property="og:image" content="https://create-stack.alfredmouelle.com/og-image.png">',
    )
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">')
    expect(html).toContain(
      '<meta name="twitter:title" content="Create Stack. A real app wired around your choices">',
    )
    expect(html).toContain(
      '<meta name="twitter:description" content="Create Stack generates a working SaaS project from your choices. It wires the selected pieces together and removes the rest.">',
    )
    expect(html).toContain(
      '<meta name="twitter:image" content="https://create-stack.alfredmouelle.com/og-image.png">',
    )
    expect(robots).toContain('User-agent: *\nAllow: /')
    expect(robots).toContain(`Sitemap: ${publicOrigin}/sitemap.xml`)
    expect(sitemap).toContain(`<loc>${publicOrigin}/</loc>`)
    expect(llms).toContain('pnpm dlx @alfredmouelle/create-stack@latest my-app')
    expect(llms).toContain(`Website: ${publicOrigin}/`)

    for (const asset of requiredPublicAssets) {
      expect(existsSync(join(publicBuild, asset))).toBe(true)
    }
  })

  it('does not carry legacy analytics or remote font metadata into the build', () => {
    const html = readBuildFile(publicBuild, 'index.html')

    expect(html).not.toMatch(/posthog|fonts\.googleapis|fonts\.gstatic|googletagmanager/i)
  })
})
