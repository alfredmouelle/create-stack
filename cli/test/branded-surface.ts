import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ExpectStatic } from 'vitest'
import type { Framework } from '../../packages/stack-config/src/index.ts'

export function assertBrandedSurface(
  projectDir: string,
  framework: Framework,
  expect: ExpectStatic,
): void {
  const home = readFileSync(
    join(
      projectDir,
      {
        next: 'src/app/page.tsx',
        tanstack: 'src/routes/index.tsx',
        rasengan: 'src/app/_routes/index.page.tsx',
      }[framework],
    ),
    'utf8',
  )
  const toggle = readFileSync(join(projectDir, 'src/components/theme-toggle.tsx'), 'utf8')
  const provider = readFileSync(join(projectDir, 'src/components/theme-provider.tsx'), 'utf8')
  const shell = readFileSync(
    join(
      projectDir,
      {
        next: 'src/app/layout.tsx',
        tanstack: 'src/routes/__root.tsx',
        rasengan: 'src/template.tsx',
      }[framework],
    ),
    'utf8',
  )
  const theme = readFileSync(
    join(projectDir, framework === 'next' ? 'src/app/globals.css' : 'src/styles.css'),
    'utf8',
  )

  expect(home).toContain('<ThemeToggle />')
  expect(home).toContain('bg-background')
  expect(home).toContain('bg-card')
  expect(home).toContain('text-primary')
  expect(toggle).toContain("setTheme('light')")
  expect(toggle).toContain("setTheme('dark')")
  expect(toggle).toContain("setTheme('system')")
  expect(theme).toContain('--primary:')
  expect(theme).toContain('--radius:')
  if (framework === 'next') {
    expect(provider).toContain('NextThemesProvider')
    expect(shell).toContain('attribute="class"')
  } else {
    expect(provider).toContain('document.documentElement')
    expect(provider).toContain('localStorage')
    expect(shell).toContain('localStorage.getItem')
  }
}

export function customizeTheme(
  projectDir: string,
  framework: Framework,
  expect: ExpectStatic,
): void {
  const themePath = join(
    projectDir,
    framework === 'next' ? 'src/app/globals.css' : 'src/styles.css',
  )
  const source = readFileSync(themePath, 'utf8')
  const customized = source
    .replace('  --primary: #1a7f37;', '  --primary: #7c3aed;')
    .replace('  --radius: 0.375rem;', '  --radius: 1.25rem;')
  expect(customized).toContain('--primary: #7c3aed;')
  expect(customized).toContain('--radius: 1.25rem;')
  writeFileSync(themePath, customized)
}
