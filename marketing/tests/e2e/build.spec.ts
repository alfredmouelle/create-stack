import { expect, type Page, test } from '@playwright/test'
import { openPage } from './navigation'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('create-stack.analytics-consent', 'v1:rejected')
  })
})

function axis(page: Page, name: string) {
  return page.getByRole('group', { name, exact: true })
}

function generatedCommand(page: Page) {
  return page.locator('#generated-command')
}

test.describe('stack configurator', () => {
  test('selects quality tools and restores them from the URL', async ({ page }) => {
    await openPage(page, '/build')

    const formatter = axis(page, 'Formatter')
    const linter = axis(page, 'Linter')
    await expect(formatter.getByRole('radio', { name: /^Biome/ })).toBeChecked()
    await expect(linter.getByRole('radio', { name: /^Biome/ })).toBeChecked()
    await formatter.getByRole('radio', { name: 'Prettier', exact: true }).check()
    await linter.getByRole('radio', { name: 'Oxlint', exact: true }).check()

    await expect(generatedCommand(page)).toHaveText(
      'pnpm dlx @alfredmouelle/create-stack@latest my-app --formatter prettier --linter oxlint',
    )
    await expect(page).toHaveURL(/&formatter=prettier&linter=oxlint$/)
    await page.reload()

    await expect(formatter.getByRole('radio', { name: 'Prettier', exact: true })).toBeChecked()
    await expect(linter.getByRole('radio', { name: 'Oxlint', exact: true })).toBeChecked()
    await page.getByRole('button', { name: 'Reset to recommended' }).click()

    await expect(formatter.getByRole('radio', { name: /^Biome/ })).toBeChecked()
    await expect(linter.getByRole('radio', { name: /^Biome/ })).toBeChecked()
    await expect(generatedCommand(page)).toHaveText(
      'pnpm dlx @alfredmouelle/create-stack@latest my-app',
    )
    await expect(page).toHaveURL(/\/build\?v=1&name=my-app&pm=pnpm$/)
  })

  test('starts with the recommended stack and exposes its resolution reasons', async ({ page }) => {
    await openPage(page, '/build')

    await expect(page).toHaveURL(/\/build\?v=1&name=my-app&pm=pnpm$/)
    await expect(generatedCommand(page)).toHaveText(
      'pnpm dlx @alfredmouelle/create-stack@latest my-app',
    )
    await expect(axis(page, 'Database')).toContainText('↳ recommended stack')
    await expect(page.getByRole('button', { name: 'Copy command' })).toBeEnabled()
  })

  test('prints the creation plan in the CLI format', async ({ page }) => {
    await openPage(page, '/build')

    const panel = page.getByRole('complementary', { name: 'Generated command and creation plan' })
    await expect(panel).toContainText('Framework: TanStack Start')
    await expect(panel).toContainText('Database: drizzle, recommended stack')
    await expect(panel).toContainText('Install and verify: yes')
  })

  test('lists unoffered choices without making them selectable', async ({ page }) => {
    await openPage(page, '/build')

    const framework = axis(page, 'Framework')
    await expect(framework.getByText('Remix · planned')).toHaveAttribute('aria-disabled', 'true')
    await expect(framework.getByRole('radio')).toHaveCount(2)
    await expect(axis(page, 'Formatter').getByText('oxfmt', { exact: true })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    await expect(axis(page, 'Linter').getByText('ESLint', { exact: true })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })

  test('toggles a capability by pressing one of its providers', async ({ page }) => {
    await openPage(page, '/build')

    const storage = page.getByRole('group', { name: 'Object storage', exact: true })
    const gcs = storage.getByRole('button', { name: 'gcs' })
    const r2 = storage.getByRole('button', { name: 'r2' })
    await expect(gcs).toHaveAttribute('aria-pressed', 'false')

    await gcs.click()
    await expect(gcs).toHaveAttribute('aria-pressed', 'true')
    await expect(generatedCommand(page)).toHaveText(
      'pnpm dlx @alfredmouelle/create-stack@latest my-app --storage gcs',
    )

    await r2.click()
    await expect(gcs).toHaveAttribute('aria-pressed', 'false')
    await expect(r2).toHaveAttribute('aria-pressed', 'true')

    await r2.click()
    await expect(r2).toHaveAttribute('aria-pressed', 'false')
    await expect(generatedCommand(page)).toHaveText(
      'pnpm dlx @alfredmouelle/create-stack@latest my-app',
    )
  })

  test('renders a valid explicit selection and updates the shareable URL', async ({
    context,
    page,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
      origin: 'http://127.0.0.1:4321',
    })
    await openPage(page, '/build')

    await page.getByLabel('Project name').fill('orbit')
    await axis(page, 'Framework')
      .getByRole('radio', { name: /^Next\.js/ })
      .check()
    await axis(page, 'Database')
      .getByRole('radio', { name: /^Convex/ })
      .check()
    await axis(page, 'Authentication')
      .getByRole('radio', { name: /^Clerk/ })
      .check()
    await axis(page, 'API')
      .getByRole('radio', { name: /^No tRPC/ })
      .check()
    await axis(page, 'Mailer').getByRole('radio', { name: /^none/ }).check()
    await axis(page, 'Monorepo').getByRole('radio', { name: 'Nx' }).check()
    await page
      .getByRole('group', { name: 'Object storage', exact: true })
      .getByRole('button', { name: 'r2' })
      .click()
    await axis(page, 'Package manager').getByRole('radio', { name: 'npm', exact: true }).check()

    await expect(generatedCommand(page)).toHaveText(
      'npx @alfredmouelle/create-stack@latest orbit --framework next --database convex --monorepo nx --storage r2',
    )
    await expect(page).toHaveURL(
      /\/build\?v=1&name=orbit&pm=npm&framework=next&database=convex&mono=nx&cap=storage%3Dr2$/,
    )
    await page.getByRole('button', { name: 'Copy command' }).click()
    await expect(page.getByRole('status').first()).toHaveText('Command copied to your clipboard.')
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe(
        'npx @alfredmouelle/create-stack@latest orbit --framework next --database convex --monorepo nx --storage r2',
      )
  })

  test('accepts a custom import alias and rejects an invalid one', async ({ page }) => {
    await openPage(page, '/build')

    const alias = page.getByLabel('Import alias')
    await expect(alias).toHaveValue('~')
    await alias.fill('@app')

    await expect(generatedCommand(page)).toHaveText(
      'pnpm dlx @alfredmouelle/create-stack@latest my-app --alias @app',
    )
    await expect(page).toHaveURL(/\/build\?v=1&name=my-app&pm=pnpm&alias=%40app$/)

    await alias.fill('app.lib')
    await expect(
      page.getByRole('alert').filter({ hasText: 'Use an optional @, ~ or #' }),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Copy command' })).toBeDisabled()
  })

  test('blocks generation and explains explicit conflicts', async ({ page }) => {
    await openPage(page, '/build')

    await axis(page, 'Database')
      .getByRole('radio', { name: /^Convex/ })
      .check()
    await axis(page, 'Authentication')
      .getByRole('radio', { name: /^Better Auth/ })
      .check()
    await axis(page, 'API').getByRole('radio', { name: /^tRPC/ }).check()
    await axis(page, 'Mailer').getByRole('radio', { name: /^none/ }).check()

    const conflicts = page
      .getByRole('alert')
      .filter({ hasText: 'These choices cannot ship together.' })
    await expect(conflicts).toContainText('Better Auth cannot be used with Convex')
    await expect(conflicts).toContainText('Convex cannot be combined with tRPC')
    await expect(conflicts).toContainText('Better Auth requires mail')
    await expect(axis(page, 'Database')).toContainText('Better Auth cannot be used with Convex')
    await expect(page.getByRole('button', { name: 'Copy command' })).toBeDisabled()
    await expect(
      page.getByText('Not resolved: the CLI stops here and writes no file.'),
    ).toBeVisible()
  })

  test('restores a shared selection after reload and copies its link', async ({
    context,
    page,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
      origin: 'http://127.0.0.1:4321',
    })
    await openPage(page, '/build')
    await page.getByLabel('Project name').fill('shared-app')
    await axis(page, 'Framework')
      .getByRole('radio', { name: /^Next\.js/ })
      .check()
    await axis(page, 'Package manager').getByRole('radio', { name: 'bun', exact: true }).check()
    await page.getByRole('button', { name: 'Copy share link' }).click()

    await expect(page.getByRole('status').filter({ hasText: 'Anyone with this link' })).toHaveText(
      'Anyone with this link can restore this configuration.',
    )
    const sharedUrl = page.url()
    await page.reload()

    await expect(page.getByLabel('Project name')).toHaveValue('shared-app')
    await expect(axis(page, 'Framework').getByRole('radio', { name: /^Next\.js/ })).toBeChecked()
    await expect(
      axis(page, 'Package manager').getByRole('radio', { name: 'bun', exact: true }),
    ).toBeChecked()
    await expect(page).toHaveURL(sharedUrl)
  })

  test('offers a safe recovery for an unsupported schema version', async ({ page }) => {
    await openPage(page, '/build?v=99&name=legacy')

    const recovery = page.getByRole('alert')
    await expect(recovery).toContainText('Version 99 is not understood')
    await recovery.getByRole('button', { name: 'Use the current recommended stack' }).click()

    await expect(page.getByLabel('Project name')).toHaveValue('my-app')
    await expect(page).toHaveURL(/\/build\?v=1&name=my-app&pm=pnpm$/)
  })

  test('lets keyboard users change a stack choice', async ({ page }) => {
    await openPage(page, '/build')

    const recommended = axis(page, 'Framework').getByRole('radio', { name: /^TanStack Start/ })
    await recommended.focus()
    await page.keyboard.press('ArrowRight')

    await expect(axis(page, 'Framework').getByRole('radio', { name: /^Next\.js/ })).toBeChecked()
    await expect(generatedCommand(page)).toHaveText(
      'pnpm dlx @alfredmouelle/create-stack@latest my-app --framework next',
    )
  })
})

test.describe('stack configurator mobile layout', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })

  test('keeps the command in a bottom sheet that expands into the plan', async ({ page }) => {
    await openPage(page, '/build')

    await expect(page.getByRole('heading', { level: 1, name: 'Build your stack' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Copy command' })).toBeVisible()
    await expect(page.getByText('✓ no conflicts')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Copy share link' })).toBeHidden()

    await page.getByRole('button', { name: 'Show plan ▴' }).click()
    await expect(page.getByRole('button', { name: 'Hide plan ▾' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    await expect(page.getByRole('button', { name: 'Copy share link' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
  })
})

test('uses pointer cursors for interactive controls', async ({ page }) => {
  await openPage(page, '/build')

  await expect(page.locator('.chip').first()).toHaveCSS('cursor', 'pointer')
  await expect(page.locator('.chip.is-toggle').first()).toHaveCSS('cursor', 'pointer')
  await expect(page.getByRole('button', { name: 'Copy command' })).toHaveCSS('cursor', 'pointer')

  await openPage(page, '/')
  await expect(page.locator('a').first()).toHaveCSS('cursor', 'pointer')
  await expect(page.getByRole('button', { name: 'Copy command' })).toHaveCSS('cursor', 'pointer')
})
