import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

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

function readBuildFile(buildPath: string, fileName: string) {
  return readFileSync(join(buildPath, fileName), 'utf8')
}

function buildMarketingSite() {
  const outputPath = join(buildRoot, 'public')
  const buildEnvironment: typeof process.env = {
    ...process.env,
    ASTRO_TELEMETRY_DISABLED: '1',
    NODE_ENV: 'production',
    npm_config_node_env: 'production',
  }
  delete buildEnvironment.VITEST
  delete buildEnvironment.VITEST_POOL_ID
  delete buildEnvironment.npm_lifecycle_event
  delete buildEnvironment.npm_lifecycle_script
  execFileSync(
    join(process.cwd(), 'node_modules/.bin/astro'),
    ['build', '--mode', 'public', '--outDir', relative(process.cwd(), outputPath)],
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
    publicBuild = buildMarketingSite()
  }, 120_000)

  afterAll(() => {
    rmSync(buildRoot, { force: true, recursive: true })
  })

  it('publishes the production metadata contract and local assets', () => {
    const html = readBuildFile(publicBuild, 'index.html')
    const robots = readBuildFile(publicBuild, 'robots.txt')
    const sitemap = readBuildFile(publicBuild, 'sitemap.xml')
    const llms = readBuildFile(publicBuild, 'llms.txt')

    expect(html).toContain('<meta name="robots" content="index, follow">')
    expect(html).not.toContain('noindex')
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
    expect(robots).not.toContain('Disallow: /')
    expect(robots).toContain(`Sitemap: ${publicOrigin}/sitemap.xml`)
    expect(sitemap).toContain(`<loc>${publicOrigin}/</loc>`)
    expect(llms).toContain('pnpm dlx @alfredmouelle/create-stack@latest my-app')
    expect(llms).toContain(`Website: ${publicOrigin}/`)
    expect(llms).not.toContain('Inspired by')

    for (const asset of requiredPublicAssets) {
      expect(existsSync(join(publicBuild, asset))).toBe(true)
    }
  })

  it('keeps trackers out of the document shell and uses local font metadata', () => {
    const html = readBuildFile(publicBuild, 'index.html')

    expect(html).not.toMatch(/posthog\.init|fonts\.googleapis|fonts\.gstatic|googletagmanager/i)
  })

  it('publishes the professional privacy contact and readable provider links', () => {
    const html = readBuildFile(publicBuild, 'index.html')
    const privacy = readBuildFile(publicBuild, 'privacy/index.html')

    expect(html).toContain('<meta name="author" content="Alfred Mouelle">')
    expect(privacy).toContain(
      '<a href="https://posthog.com/privacy" rel="noreferrer" target="_blank">privacy policy</a> and <a href="https://trust.posthog.com/"',
    )
    expect(privacy).toContain('mailto:contact@alfredmouelle.com')
    expect(privacy).not.toContain('@gmail.com')
  })
})
