import { devices, expect, test } from '@playwright/test'

const canonicalPnpmCommand = 'pnpm dlx @alfredmouelle/create-stack@latest my-app'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('create-stack.analytics-consent', 'v1:rejected')
  })
})

test.describe('install command', () => {
  test('selects each package manager and reports clipboard success', async ({
    context,
    page,
    baseURL,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
      origin: new URL(baseURL ?? 'http://127.0.0.1:4321').origin,
    })
    await page.goto('/')

    const command = page.getByRole('textbox', { name: 'Create Stack install command' })
    await expect(command).toHaveValue(canonicalPnpmCommand)

    for (const [manager, expected] of [
      ['npm', 'npx @alfredmouelle/create-stack@latest my-app'],
      ['yarn', 'yarn dlx @alfredmouelle/create-stack@latest my-app'],
      ['bun', 'bunx @alfredmouelle/create-stack@latest my-app'],
      ['pnpm', canonicalPnpmCommand],
    ]) {
      await page.getByRole('button', { name: manager, exact: true }).click()
      await expect(command).toHaveValue(expected)
    }

    await page.getByRole('button', { name: 'Copy command' }).click()
    await expect(page.getByRole('status')).toHaveText('Command copied to your clipboard.')
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe(canonicalPnpmCommand)
  })

  test('keeps the command selectable when clipboard access is refused', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, 'clipboard', {
        configurable: true,
        get: () => ({
          writeText: async () => {
            throw new DOMException('Clipboard access denied', 'NotAllowedError')
          },
        }),
      })
    })
    await page.goto('/')

    const command = page.getByRole('textbox', { name: 'Create Stack install command' })
    await page.getByRole('button', { name: 'Copy command' }).click()

    await expect(page.getByRole('status')).toHaveText(
      'Copy unavailable. Select the command, then press Ctrl+C or Cmd+C.',
    )
    await expect(command).toBeFocused()
    await expect(command).toHaveValue(canonicalPnpmCommand)
  })
})

test.describe('terminal playback', () => {
  test.setTimeout(30_000)

  test('pauses, resumes, and replays the public CLI sequence', async ({ page }) => {
    await page.goto('/')

    const terminal = page.getByRole('region', { name: 'Example Create Stack terminal session' })
    const transcript = terminal.locator('[aria-live="polite"]')
    const pause = page.getByRole('button', { name: 'Pause sequence' })
    await expect(pause).toBeVisible()

    await pause.click()
    await expect(page.getByRole('button', { name: 'Resume sequence' })).toBeVisible()
    const pausedTranscript = await transcript.innerText()
    await page.waitForTimeout(1_100)
    await expect(transcript).toHaveText(pausedTranscript)

    await page.getByRole('button', { name: 'Resume sequence' }).click()
    await expect.poll(() => transcript.innerText()).not.toBe(pausedTranscript)

    await expect(page.getByRole('button', { name: 'Replay sequence' })).toBeVisible({
      timeout: 15_000,
    })
    await page.getByRole('button', { name: 'Replay sequence' }).click()
    await expect(page.getByRole('button', { name: 'Pause sequence' })).toBeVisible()
    await expect(terminal).toContainText('pnpm dlx @alfredmouelle/create-stack@latest orbit')
  })

  test('shows the final verification result without motion when requested', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')

    const terminal = page.getByRole('region', { name: 'Example Create Stack terminal session' })
    await expect(terminal).toContainText('✓ typecheck + biome clean')
    await expect(page.getByRole('button', { name: 'Replay sequence' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Pause sequence' })).not.toBeVisible()
  })
})

test.describe('mobile keyboard experience', () => {
  test.use({
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
    userAgent: devices['Pixel 7'].userAgent,
  })

  test('supports keyboard navigation and stays usable on a narrow viewport', async ({ page }) => {
    await page.goto('/')

    const packageManager = page.getByRole('button', { name: 'pnpm', exact: true })
    await packageManager.focus()
    await expect(packageManager).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: 'npm', exact: true })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('textbox', { name: 'Create Stack install command' })).toHaveValue(
      'npx @alfredmouelle/create-stack@latest my-app',
    )

    const copy = page.getByRole('button', { name: 'Copy command' })
    await copy.focus()
    await expect(copy).toBeFocused()

    const terminal = page.getByRole('region', { name: 'Example Create Stack terminal session' })
    const pause = page.getByRole('button', { name: 'Pause sequence' })
    await expect(pause).toBeVisible()
    await pause.focus()
    await expect(pause).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('button', { name: 'Resume sequence' })).toBeVisible()
    await expect(terminal).toContainText('pnpm dlx @alfredmouelle/create-stack@latest orbit')

    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
    const navigation = page.getByRole('navigation', { name: 'Main navigation' })
    await expect(navigation.getByRole('link', { name: 'Build', exact: true })).toBeVisible()
    await expect(navigation.getByRole('link', { name: 'Changelog', exact: true })).toBeVisible()
    await expect(navigation.getByRole('link', { name: 'GitHub' })).toBeVisible()
    await expect(copy).toBeVisible()
  })
})

test('publishes the changelog route', async ({ page }) => {
  await page.goto('/changelog')

  await expect(page.getByRole('heading', { name: 'What changed in create-stack.' })).toBeVisible()
  await expect(page.getByText('0.12.0', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'View source ↗' })).toHaveAttribute(
    'href',
    'https://github.com/alfredmouelle/create-stack/blob/main/cli/CHANGELOG.md',
  )

  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'auto' }))
  const backToTop = page.getByRole('button', { name: 'Back to top' })
  await expect(backToTop).toBeVisible()
  await backToTop.click()
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(10)
})

test('uses the same branded mark in the wordmark and favicon', async ({ page }) => {
  await page.goto('/')

  await expect(page.locator('.wordmark-mark')).toHaveAttribute('src', '/favicon.svg')
  await expect(page.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveAttribute(
    'href',
    '/favicon.svg',
  )
})

test('keeps the install card controls on the left like a terminal window', async ({ page }) => {
  await page.goto('/')

  const commandBar = page.locator('.command-label')
  const windowControls = commandBar.locator('.terminal-window')
  const title = commandBar.locator('.command-label-title')

  await expect(windowControls).toBeVisible()
  await expect(windowControls.locator('i')).toHaveCount(3)
  await expect(title).toHaveText('create-stack / install')

  const controlsBox = await windowControls.boundingBox()
  const titleBox = await title.boundingBox()
  expect(controlsBox?.x).toBeLessThan(titleBox?.x ?? Number.POSITIVE_INFINITY)
})

test('makes a long install command horizontally inspectable', async ({ page }) => {
  await page.goto('/')

  const command = page.getByRole('textbox', { name: 'Create Stack install command' })
  await expect(command).toHaveAttribute('title', 'Scroll horizontally to inspect the full command')
  await expect(page.locator('.command-line')).toHaveAttribute('data-overflowing', 'true')
  await expect(page.locator('.command-scroll-cue')).toBeVisible()
  await expect(command).toHaveValue(canonicalPnpmCommand)
})
