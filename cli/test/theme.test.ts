import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import { cleanupAcceptanceFixtures, createAcceptanceFixture, runCli } from './acceptance.ts'

const THEME_FILES = {
  next: 'src/app/globals.css',
  tanstack: 'src/styles.css',
}

const EXPECTED_TOKENS = {
  light: {
    background: '#f6f7f6',
    foreground: '#0b0d0c',
    card: '#ffffff',
    'card-foreground': '#0b0d0c',
    popover: '#ffffff',
    'popover-foreground': '#0b0d0c',
    primary: '#1a7f37',
    'primary-foreground': '#ffffff',
    secondary: '#eceeec',
    'secondary-foreground': '#0b0d0c',
    muted: '#eceeec',
    'muted-foreground': '#5c625e',
    accent: '#eceeec',
    'accent-foreground': '#0b0d0c',
    destructive: '#b3311a',
    'destructive-foreground': '#ffffff',
    border: '#dde0dd',
    input: '#dde0dd',
    ring: '#1a7f37',
    'chart-1': '#1a7f37',
    'chart-2': '#f2b33a',
    'chart-3': '#f2543a',
    'chart-4': '#5c625e',
    'chart-5': '#0b0d0c',
    radius: '0.375rem',
    sidebar: '#eceeec',
    'sidebar-foreground': '#0b0d0c',
    'sidebar-primary': '#1a7f37',
    'sidebar-primary-foreground': '#ffffff',
    'sidebar-accent': '#dde0dd',
    'sidebar-accent-foreground': '#0b0d0c',
    'sidebar-border': '#dde0dd',
    'sidebar-ring': '#1a7f37',
  },
  dark: {
    background: '#0b0d0c',
    foreground: '#f6f7f6',
    card: '#151816',
    'card-foreground': '#f6f7f6',
    popover: '#151816',
    'popover-foreground': '#f6f7f6',
    primary: '#3fb950',
    'primary-foreground': '#0b0d0c',
    secondary: '#1c201e',
    'secondary-foreground': '#f6f7f6',
    muted: '#1c201e',
    'muted-foreground': '#8a8f8b',
    accent: '#1c201e',
    'accent-foreground': '#f6f7f6',
    destructive: '#ff6a4d',
    'destructive-foreground': '#0b0d0c',
    border: '#2a302c',
    input: '#2a302c',
    ring: '#3fb950',
    'chart-1': '#3fb950',
    'chart-2': '#f2b33a',
    'chart-3': '#ff6a4d',
    'chart-4': '#8a8f8b',
    'chart-5': '#f6f7f6',
    sidebar: '#151816',
    'sidebar-foreground': '#f6f7f6',
    'sidebar-primary': '#3fb950',
    'sidebar-primary-foreground': '#0b0d0c',
    'sidebar-accent': '#1c201e',
    'sidebar-accent-foreground': '#f6f7f6',
    'sidebar-border': '#2a302c',
    'sidebar-ring': '#3fb950',
  },
}

const declarations = (block: string): Record<string, string> =>
  Object.fromEntries(
    [...block.matchAll(/^\s*--([\w-]+):\s*([^;]+);/gm)].map(([, name = '', value = '']) => [
      name,
      value.trim(),
    ]),
  )

function themeContract(css: string) {
  const light = css.match(/:root\s*{([\s\S]*?)\n}/)?.[1]
  const dark = css.match(/\.dark\s*{([\s\S]*?)\n}/)?.[1]
  const theme = css.match(/@theme inline\s*{([\s\S]*?)\n}/)?.[1]
  expect(light).toBeTruthy()
  expect(dark).toBeTruthy()
  expect(theme).toBeTruthy()
  if (light === undefined || dark === undefined || theme === undefined) {
    throw new Error('Expected :root, .dark and @theme inline blocks')
  }

  return {
    light: declarations(light),
    dark: declarations(dark),
    theme: declarations(theme),
  }
}

function expectTheme(css: string): void {
  const contract = themeContract(css)
  expect(contract.light).toMatchObject(EXPECTED_TOKENS.light)
  expect(contract.dark).toMatchObject(EXPECTED_TOKENS.dark)
  expect(contract.theme).toMatchObject({
    'font-sans':
      '"Instrument Sans Variable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
    'font-heading': 'var(--font-sans)',
    'font-mono': '"Commit Mono", ui-monospace, "SFMono-Regular", Menlo, monospace',
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

test.each(['next', 'tanstack'] as const)(
  'generates the branded theme contract for %s',
  (framework) => {
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
  },
)

test('keeps the branded theme contract identical between base apps', () => {
  const nextCss = readFileSync('../apps/next-base/src/app/globals.css', 'utf8')
  const tanstackCss = readFileSync('../apps/tanstack-base/src/styles.css', 'utf8')

  expect(themeContract(nextCss)).toEqual(themeContract(tanstackCss))
})
