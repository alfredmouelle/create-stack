import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import { cleanupAcceptanceFixtures, createAcceptanceFixture, runCli } from './acceptance.mjs'

const THEME_FILES = {
  next: 'src/app/globals.css',
  tanstack: 'src/styles.css',
}

const EXPECTED_TOKENS = {
  light: {
    background: '#edf2ef',
    foreground: '#14211f',
    card: '#f9fbf9',
    'card-foreground': '#14211f',
    popover: '#f9fbf9',
    'popover-foreground': '#14211f',
    primary: '#1858d1',
    'primary-foreground': '#fff',
    secondary: '#dbe7ff',
    'secondary-foreground': '#14211f',
    muted: '#e2ebe7',
    'muted-foreground': '#53635e',
    accent: '#ffe2d1',
    'accent-foreground': '#7f3418',
    destructive: '#b42318',
    'destructive-foreground': '#fff',
    border: '#cbd8d3',
    input: '#cbd8d3',
    ring: '#e86d32',
    'chart-1': '#1858d1',
    'chart-2': '#2f8f75',
    'chart-3': '#e86d32',
    'chart-4': '#b8871f',
    'chart-5': '#9157c4',
    radius: '0.5rem',
    sidebar: '#f9fbf9',
    'sidebar-foreground': '#14211f',
    'sidebar-primary': '#1858d1',
    'sidebar-primary-foreground': '#fff',
    'sidebar-accent': '#ffe2d1',
    'sidebar-accent-foreground': '#7f3418',
    'sidebar-border': '#cbd8d3',
    'sidebar-ring': '#e86d32',
  },
  dark: {
    background: '#0e1a28',
    foreground: '#dce9f4',
    card: '#142436',
    'card-foreground': '#dce9f4',
    popover: '#142436',
    'popover-foreground': '#dce9f4',
    primary: '#66a2ff',
    'primary-foreground': '#0e1a28',
    secondary: '#1d3042',
    'secondary-foreground': '#dce9f4',
    muted: '#1d3042',
    'muted-foreground': '#8ea4b8',
    accent: '#4b2a1d',
    'accent-foreground': '#ffb185',
    destructive: '#f87171',
    'destructive-foreground': '#2b0d0a',
    border: '#2d455c',
    input: '#2d455c',
    ring: '#ffb185',
    'chart-1': '#66a2ff',
    'chart-2': '#69c3a4',
    'chart-3': '#ffb185',
    'chart-4': '#f2c66d',
    'chart-5': '#c29dff',
    sidebar: '#142436',
    'sidebar-foreground': '#dce9f4',
    'sidebar-primary': '#66a2ff',
    'sidebar-primary-foreground': '#0e1a28',
    'sidebar-accent': '#4b2a1d',
    'sidebar-accent-foreground': '#ffb185',
    'sidebar-border': '#2d455c',
    'sidebar-ring': '#ffb185',
  },
}

const declarations = (block) =>
  Object.fromEntries(
    [...block.matchAll(/^\s*--([\w-]+):\s*([^;]+);/gm)].map(([, name, value]) => [
      name,
      value.trim(),
    ]),
  )

function themeContract(css) {
  const light = css.match(/:root\s*{([\s\S]*?)\n}/)?.[1]
  const dark = css.match(/\.dark\s*{([\s\S]*?)\n}/)?.[1]
  const theme = css.match(/@theme inline\s*{([\s\S]*?)\n}/)?.[1]
  expect(light).toBeTruthy()
  expect(dark).toBeTruthy()
  expect(theme).toBeTruthy()

  return {
    light: declarations(light),
    dark: declarations(dark),
    theme: declarations(theme),
  }
}

function expectTheme(css) {
  const contract = themeContract(css)
  expect(contract.light).toMatchObject(EXPECTED_TOKENS.light)
  expect(contract.dark).toMatchObject(EXPECTED_TOKENS.dark)
  expect(contract.theme).toMatchObject({
    'font-sans': '"Geist Variable", Geist, sans-serif',
    'font-heading': '"Bricolage Grotesque Variable", "Bricolage Grotesque", var(--font-sans)',
    'color-background': 'var(--background)',
    'color-foreground': 'var(--foreground)',
    'color-primary': 'var(--primary)',
    'color-primary-foreground': 'var(--primary-foreground)',
    'color-muted-foreground': 'var(--muted-foreground)',
    'color-ring': 'var(--ring)',
    'radius-sm': 'calc(var(--radius) - 2px)',
    'radius-md': 'calc(var(--radius) - 1px)',
    'radius-lg': 'var(--radius)',
    'radius-xl': 'calc(var(--radius) + 1px)',
    'radius-2xl': 'calc(var(--radius) + 2px)',
    'radius-3xl': 'calc(var(--radius) + 3px)',
    'radius-4xl': 'calc(var(--radius) + 4px)',
  })
}

test.afterAll(cleanupAcceptanceFixtures)

test.each(['next', 'tanstack'])('generates the branded theme contract for %s', (framework) => {
  const fixture = createAcceptanceFixture('standalone')
  const result = runCli({
    cwd: fixture.root,
    target: fixture.project,
    args: [
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
    ],
  })

  expect(result.exitStatus).toBe(0)
  expectTheme(readFileSync(`${fixture.app}/${THEME_FILES[framework]}`, 'utf8'))
})

test('keeps the branded theme contract identical between base apps', () => {
  const nextCss = readFileSync('../apps/next-base/src/app/globals.css', 'utf8')
  const tanstackCss = readFileSync('../apps/tanstack-base/src/styles.css', 'utf8')

  expect(themeContract(nextCss)).toEqual(themeContract(tanstackCss))
})
