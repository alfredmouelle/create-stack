import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('create-stack.analytics-consent', 'v1:rejected')
  })
})

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

  test('keeps the complete command horizontally inspectable', async ({ page }) => {
    await page.goto('/build')

    const command = page.getByRole('textbox', { name: 'Generated Create Stack command' })
    await expect(command).toHaveValue('pnpm dlx @alfredmouelle/create-stack@latest my-app')
    await expect(command).toHaveAttribute(
      'title',
      'Scroll horizontally to inspect the full command',
    )
    await expect(page.locator('.build-command-display')).toHaveAttribute('data-overflowing', 'true')
    await expect(page.locator('.build-command-scroll-cue')).toBeVisible()
  })

  test('keeps capability card geometry stable when toggling a provider', async ({ page }) => {
    await page.goto('/build')

    const capability = page.locator('.build-capability').first()
    const before = await capability.boundingBox()
    await page.getByRole('checkbox', { name: /Object storage/ }).check()
    await expect(page.getByRole('combobox', { name: 'Object storage provider' })).toBeVisible()
    const selected = await capability.boundingBox()
    await page.getByRole('checkbox', { name: /Object storage/ }).uncheck()
    const after = await capability.boundingBox()

    expect(before).not.toBeNull()
    expect(selected).not.toBeNull()
    expect(after).not.toBeNull()
    expect(selected?.height).toBe(before?.height)
    expect(after?.height).toBe(before?.height)
  })

  test('uses the branded checkbox treatment for capabilities', async ({ page }) => {
    await page.goto('/build')

    const checkbox = page.getByRole('checkbox', { name: /Analytics/ })
    await expect(checkbox).toHaveCSS('border-radius', '0px')
    await expect(checkbox).toHaveCSS('background-color', 'rgb(249, 251, 249)')

    await checkbox.check()

    await expect(checkbox).toHaveCSS('background-color', 'rgb(24, 88, 209)')
    await expect(checkbox).toHaveCSS('border-color', 'rgb(24, 88, 209)')
    await expect
      .poll(() => checkbox.evaluate((element) => getComputedStyle(element, '::before').content))
      .toBe('none')
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
    await page.getByRole('combobox', { name: 'Object storage provider' }).click()
    await page.getByRole('option', { name: 'r2' }).click()
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

  test('offers a back-to-top control after scrolling', async ({ page }) => {
    await page.goto('/build')

    await page.evaluate(() =>
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'auto' }),
    )
    const backToTop = page.getByRole('button', { name: 'Back to top' })
    await expect(backToTop).toBeVisible()
    await backToTop.click()
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(10)
    await expect(backToTop).not.toBeVisible()
  })
})

test('uses pointer cursors for interactive controls', async ({ page }) => {
  await page.goto('/build')

  await expect(page.locator('.build-choice').first()).toHaveCSS('cursor', 'pointer')
  await expect(page.locator('.build-capability-toggle').first()).toHaveCSS('cursor', 'pointer')
  await expect(page.locator('.build-additional > summary')).toHaveCSS('cursor', 'pointer')
  await page.getByRole('checkbox').first().check()
  await expect(page.getByRole('combobox').first()).toHaveCSS('cursor', 'pointer')
  await expect(page.getByRole('button', { name: 'Copy command' })).toHaveCSS('cursor', 'pointer')

  await page.goto('/')
  await expect(page.locator('a').first()).toHaveCSS('cursor', 'pointer')
  await expect(page.getByRole('button', { name: 'Copy command' })).toHaveCSS('cursor', 'pointer')
})
