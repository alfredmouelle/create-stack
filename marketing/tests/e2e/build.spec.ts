import { expect, test } from '@playwright/test'

test.describe('stack configurator', () => {
  test('starts with the recommended stack and exposes its resolution reasons', async ({ page }) => {
    await page.goto('/build')

    await expect(page).toHaveURL(/\/build\?v=1&name=my-app&pm=pnpm$/)
    await expect(page.getByRole('textbox', { name: 'Generated Create Stack command' })).toHaveValue(
      'pnpm dlx @alfredmouelle/create-stack@latest my-app',
    )
    await expect(page.getByText('Recommended: recommended stack').first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Copy command' })).toBeEnabled()
  })

  test('renders a valid explicit selection and updates the shareable URL', async ({
    context,
    page,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
      origin: 'http://127.0.0.1:4321',
    })
    await page.goto('/build')

    await page.getByLabel('Project name').fill('orbit')
    await page.getByRole('radio', { name: /Next\.js App Router/ }).check()
    await page.getByRole('radio', { name: /Convex realtime database/ }).check()
    await page.getByRole('radio', { name: /Clerk hosted authentication/ }).check()
    await page.getByRole('radio', { name: 'No tRPC' }).check()
    await page.getByRole('radio', { name: 'None no transactional mail' }).check()
    await page.getByRole('radio', { name: /Nx app in apps\/web/ }).check()
    await page.getByRole('checkbox', { name: /Object storage/ }).check()
    await page.getByRole('combobox', { name: 'Object storage provider' }).selectOption('r2')
    await page.getByRole('button', { name: 'npm', exact: true }).click()

    await expect(page.getByRole('textbox', { name: 'Generated Create Stack command' })).toHaveValue(
      'npx @alfredmouelle/create-stack@latest orbit --framework next --database convex --monorepo nx --storage r2',
    )
    await expect(page).toHaveURL(
      /\/build\?v=1&name=orbit&pm=npm&framework=next&database=convex&mono=nx&cap=storage%3Dr2$/,
    )
    await page.getByRole('button', { name: 'Copy command' }).click()
    await expect(page.getByRole('status').first()).toHaveText('Command copied to your clipboard.')
  })

  test('blocks generation and explains explicit conflicts', async ({ page }) => {
    await page.goto('/build')

    await page.getByRole('radio', { name: /Convex realtime database/ }).check()
    await page.getByRole('radio', { name: /Better Auth email \+ password/ }).check()
    await page.getByRole('radio', { name: 'Include tRPC' }).check()
    await page.getByRole('radio', { name: 'None no transactional mail' }).check()

    const conflicts = page
      .getByRole('alert')
      .filter({ hasText: 'These choices cannot ship together.' })
    await expect(conflicts).toContainText('Better Auth cannot be used with Convex')
    await expect(conflicts).toContainText('Convex cannot be combined with tRPC')
    await expect(conflicts).toContainText('Better Auth requires mail')
    await expect(page.getByRole('button', { name: 'Copy command' })).toBeDisabled()
  })

  test('restores a shared selection after reload and copies its link', async ({
    context,
    page,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
      origin: 'http://127.0.0.1:4321',
    })
    await page.goto('/build')
    await page.getByLabel('Project name').fill('shared-app')
    await page.getByRole('radio', { name: /Next\.js App Router/ }).check()
    await page.getByRole('button', { name: 'bun', exact: true }).click()
    await page.getByRole('button', { name: 'Copy share link' }).click()

    await expect(page.getByRole('status').last()).toHaveText(
      'Anyone with this link can restore this configuration.',
    )
    const sharedUrl = page.url()
    await page.reload()

    await expect(page.getByLabel('Project name')).toHaveValue('shared-app')
    await expect(page.getByRole('radio', { name: /Next\.js App Router/ })).toBeChecked()
    await expect(page.getByRole('button', { name: 'bun', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(page).toHaveURL(sharedUrl)
  })

  test('offers a safe recovery for an unsupported schema version', async ({ page }) => {
    await page.goto('/build?v=99&name=legacy')

    const recovery = page.getByRole('alert')
    await expect(recovery).toContainText('Version 99 is not understood')
    await expect(
      recovery.getByRole('button', { name: 'Use the current recommended stack' }),
    ).toBeVisible()
    await recovery.getByRole('button', { name: 'Use the current recommended stack' }).click()

    await expect(page.getByLabel('Project name')).toHaveValue('my-app')
    await expect(page).toHaveURL(/\/build\?v=1&name=my-app&pm=pnpm$/)
  })

  test('lets keyboard users change a stack choice', async ({ page }) => {
    await page.goto('/build')

    const framework = page.getByRole('radio', { name: /Next\.js App Router/ })
    await framework.focus()
    await page.keyboard.press('Space')

    await expect(framework).toBeChecked()
    await expect(page.getByRole('textbox', { name: 'Generated Create Stack command' })).toHaveValue(
      'pnpm dlx @alfredmouelle/create-stack@latest my-app --framework next',
    )
  })
})

test.describe('stack configurator mobile layout', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })

  test('keeps the command and primary controls usable on a narrow viewport', async ({ page }) => {
    await page.goto('/build')

    await expect(
      page.getByRole('heading', { name: 'Choose the shape of your first useful commit.' }),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Copy command' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
  })
})
