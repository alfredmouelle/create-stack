import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, describe, expect, test } from 'vitest'
import { cleanupAcceptanceFixtures, createAcceptanceFixture, runCli } from './acceptance.mjs'

afterAll(cleanupAcceptanceFixtures)

const creationArgs = (framework) => [
  'project',
  '--framework',
  framework,
  '--database',
  'none',
  '--auth',
  'none',
  '--no-trpc',
  '--mailer',
  'none',
  '--no-install',
]

const read = (root, relativePath) => readFileSync(join(root, relativePath), 'utf8')

describe.each(['next', 'tanstack'])('branded generated %s app', (framework) => {
  test('keeps app identity local and gives the first screen a starter focus', () => {
    const fixture = createAcceptanceFixture('standalone')
    const result = runCli({
      cwd: fixture.root,
      target: fixture.project,
      args: creationArgs(framework),
    })

    expect(result.exitStatus).toBe(0)

    const shell = read(
      fixture.app,
      framework === 'next' ? 'src/app/layout.tsx' : 'src/routes/__root.tsx',
    )
    const home = read(
      fixture.app,
      framework === 'next' ? 'src/app/page.tsx' : 'src/routes/index.tsx',
    )
    const config = read(fixture.app, 'src/lib/site-config.ts')
    const favicon = read(fixture.app, 'public/favicon.svg')
    const manifest = JSON.parse(read(fixture.app, 'public/manifest.json'))

    expect(config).toContain("name: 'project'")
    expect(shell).toContain('siteConfig.name')
    expect(shell).toContain('siteConfig.description')
    expect(home).toContain('src="/logo192.png"')
    expect(home).toContain('siteConfig.name')
    expect(home).not.toContain('Everything&rsquo;s wired.')
    expect(home).not.toContain('create-stack my-app')
    expect(home).not.toContain('zsh')
    expect(favicon).toContain('<title>Create Stack icon</title>')

    expect(manifest).toMatchObject({
      short_name: 'project',
      name: 'project',
      description: 'A working application, wired around your choices.',
      theme_color: '#edf2ef',
      background_color: '#edf2ef',
    })
    for (const asset of ['favicon.svg', 'favicon.ico', 'logo192.png', 'logo512.png']) {
      expect(existsSync(join(fixture.app, 'public', asset))).toBe(true)
    }
  })
})
