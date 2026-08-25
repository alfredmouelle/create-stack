import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { cleanupAcceptanceFixtures, createAcceptanceFixture, runCli } from './acceptance.mjs'

const SURFACES = {
  next: {
    authLayout: 'src/app/auth/layout.tsx',
    authCard: 'src/features/auth/auth-card.tsx',
    formAlert: 'src/features/auth/form-alert.tsx',
    screens: [
      'src/app/auth/sign-in/page.tsx',
      'src/app/auth/sign-up/page.tsx',
      'src/app/auth/forgot-password/page.tsx',
      'src/app/auth/reset-password/page.tsx',
      'src/app/auth/verify-email/page.tsx',
    ],
    emailTheme: 'src/emails/components/theme.ts',
    emailComponents: 'src/emails/components/components.tsx',
    emails: ['src/emails/reset-password.tsx', 'src/emails/verify-email.tsx'],
  },
  tanstack: {
    authLayout: 'src/routes/auth.tsx',
    authCard: 'src/features/auth/auth-card.tsx',
    formAlert: 'src/features/auth/form-alert.tsx',
    screens: [
      'src/routes/auth/sign-in.tsx',
      'src/routes/auth/sign-up.tsx',
      'src/routes/auth/forgot-password.tsx',
      'src/routes/auth/reset-password.tsx',
      'src/routes/auth/verify-email.tsx',
    ],
    emailTheme: 'src/emails/components/theme.ts',
    emailComponents: 'src/emails/components/components.tsx',
    emails: ['src/emails/reset-password.tsx', 'src/emails/verify-email.tsx'],
  },
}

const read = (root, relativePath) => readFileSync(join(root, relativePath), 'utf8')

test.afterAll(cleanupAcceptanceFixtures)

test.each(Object.keys(SURFACES))(
  'generates branded auth and transactional email surfaces for %s',
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
        'drizzle',
        '--auth',
        'better-auth',
        '--no-trpc',
        '--mailer',
        'resend',
        '--no-install',
      ],
    })
    const surface = SURFACES[framework]

    expect(result.exitStatus).toBe(0)
    expect(existsSync(join(fixture.app, surface.authLayout))).toBe(true)
    expect(read(fixture.app, surface.authLayout)).toContain('create-stack')
    expect(read(fixture.app, surface.authCard)).toContain('font-heading')
    expect(read(fixture.app, surface.formAlert)).toContain('bg-accent/60')

    for (const screen of surface.screens) {
      expect(read(fixture.app, screen)).toContain('text-primary')
    }

    const emailTheme = read(fixture.app, surface.emailTheme)
    expect(emailTheme).toContain("name: 'create-stack'")
    expect(emailTheme).toContain("pageBg: '#edf2ef'")
    expect(emailTheme).toContain("primary: '#1858d1'")

    expect(read(fixture.app, surface.emailComponents)).toContain('colors.primary')
    for (const email of surface.emails) expect(read(fixture.app, email)).toContain('EmailFallback')
  },
)
