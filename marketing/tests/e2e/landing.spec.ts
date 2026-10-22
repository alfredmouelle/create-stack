import { devices, expect, test } from '@playwright/test'
import { openPage } from './navigation'

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
    await openPage(page, '/')

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
    await openPage(page, '/')

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
    await openPage(page, '/')

    const terminal = page.getByRole('region', { name: 'Example Create Stack terminal session' })
    await terminal.scrollIntoViewIfNeeded()
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
    await expect(terminal).toContainText('pnpm dlx @alfredmouelle/create-stack@latest my-app --yes')
  })

  test('marks each gate step as the transcript reaches it', async ({ page }) => {
    await openPage(page, '/')

    const terminal = page.getByRole('region', { name: 'Example Create Stack terminal session' })
    await terminal.scrollIntoViewIfNeeded()
    const gate = terminal.getByRole('list', { name: 'Verification gate' })
    await expect(gate.getByRole('listitem')).toHaveCount(5)
    await expect(gate.getByRole('listitem').last()).toHaveAttribute('data-status', 'passed', {
      timeout: 15_000,
    })
    await expect(terminal).toContainText('Created my-app')
  })

  test('shows the final verification result without motion when requested', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openPage(page, '/')

    const terminal = page.getByRole('region', { name: 'Example Create Stack terminal session' })
    await terminal.scrollIntoViewIfNeeded()
    await expect(terminal).toContainText('typecheck + selected quality tools clean')
    await expect(terminal.locator('.gate-step[data-status="passed"]')).toHaveCount(5)
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
    await openPage(page, '/')

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
    await terminal.scrollIntoViewIfNeeded()
    const pause = page.getByRole('button', { name: 'Pause sequence' })
    await expect(pause).toBeVisible()
    await pause.focus()
    await expect(pause).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('button', { name: 'Resume sequence' })).toBeVisible()
    await expect(terminal).toContainText('pnpm dlx @alfredmouelle/create-stack@latest my-app --yes')

    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeHidden()
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'auto' }))
    await page.getByLabel('Open menu').click()
    const navigation = page.getByRole('navigation', { name: 'Mobile navigation' })
    await expect(navigation.getByRole('link', { name: 'Build', exact: true })).toBeVisible()
    await expect(navigation.getByRole('link', { name: 'Changelog', exact: true })).toBeVisible()
    await expect(navigation.getByRole('link', { name: /GitHub/ })).toBeVisible()
  })
})

test('publishes the changelog route', async ({ page }) => {
  await openPage(page, '/changelog')

  await expect(page.getByRole('heading', { level: 1, name: 'Changelog' })).toBeVisible()
  await expect(page.locator('#v-0-12-0').getByText('0.12.0', { exact: true })).toBeVisible()
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

test('uses the prompt mark in the wordmark and favicon', async ({ page }) => {
  await openPage(page, '/')

  const wordmark = page.getByRole('link', { name: 'Create Stack home' })
  await expect(wordmark.locator('svg.mark')).toBeVisible()
  await expect(wordmark.locator('.mark-cursor')).toHaveCount(1)
  await expect(page.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveAttribute(
    'href',
    '/favicon.svg',
  )
})

test('follows the system theme and remembers an explicit choice', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await openPage(page, '/')

  const background = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  await expect.poll(background).toBe('rgb(11, 13, 12)')

  await page.getByRole('button', { name: 'Switch theme' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await expect.poll(background).toBe('rgb(246, 247, 246)')

  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
})

test('copies static commands from the page', async ({ context, page, baseURL }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
    origin: new URL(baseURL ?? 'http://127.0.0.1:4321').origin,
  })
  await openPage(page, '/')

  const closing = page.locator('section', {
    has: page.getByRole('heading', { name: 'Start green.' }),
  })
  const copy = closing.getByRole('button', { name: 'Copy install command' })
  await copy.click()
  await expect(copy).toHaveText('Copied ✓')
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe(canonicalPnpmCommand)
})

test('shows Remix preview as installable', async ({ page }) => {
  await openPage(page, '/frameworks/remix')

  await expect(page.getByRole('heading', { level: 1, name: 'Remix' })).toBeVisible()
  await expect(page.getByText('Not installable yet', { exact: false })).toHaveCount(0)
  await expect(page.locator('.badge.is-preview').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Copy the Remix command' })).toBeEnabled()
  await expect(page.locator('main')).toContainText('--framework remix')
})

test('numbers the remaining planned frameworks consecutively', async ({ page }) => {
  await openPage(page, '/frameworks')

  const rows = page.locator('.framework-row.is-planned')
  const total = await rows.count()
  expect(total).toBeGreaterThan(0)
  await expect(rows.locator('.framework-id')).toHaveText(
    Array.from({ length: total }, (_, index) => `roadmap ${index + 1} of ${total}`),
  )
})

test('shows the hero tagline, grouped frameworks and preview roadmap status', async ({ page }) => {
  await openPage(page, '/')
  await expect(page).toHaveTitle('create-stack. Your most useful day one commit')
  const heading = page.getByRole('heading', { level: 1 })
  const hero = page.locator('.hero-label')
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(heading).toHaveText('Your most useful day one commit')
    expect(await heading.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true,
    )
    await expect(hero.getByText('stable', { exact: true })).toHaveCount(1)
    await expect(hero.getByText('preview', { exact: true })).toHaveCount(1)
    const stable = hero.locator(':scope > span').filter({ hasText: 'stable' })
    const preview = hero.locator(':scope > span').filter({ hasText: 'preview' })
    await expect(stable).toContainText('TanStack Start · Next.js')
    await expect(preview).toContainText('RasenganJS · Remix')
    expect(await hero.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
  }

  await openPage(page, '/frameworks/vue')
  const roadmap = page.locator('.roadmap .is-done').filter({ hasText: 'RasenganJS' })
  await expect(roadmap.getByText('preview', { exact: true })).toBeVisible()
  await expect(roadmap.getByText('stable', { exact: true })).toHaveCount(0)
})

test('makes a long install command horizontally inspectable', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await openPage(page, '/')

  const command = page.getByRole('textbox', { name: 'Create Stack install command' })
  await expect(command).toHaveAttribute('title', 'Scroll horizontally to inspect the full command')
  const line = page.locator('.install .cmd-line')
  await expect(line).toHaveAttribute('data-overflowing', 'true')
  await expect(line.locator('.cmd-scroll-cue')).toBeVisible()
  await expect(command).toHaveValue(canonicalPnpmCommand)
})

test('opens every external link in a new tab', async ({ page }) => {
  for (const path of [
    '/',
    '/build',
    '/docs',
    '/frameworks/next',
    '/frameworks/remix',
    '/contribute',
    '/changelog',
    '/privacy',
  ]) {
    await openPage(page, path)
    const external = page.locator('a[href^="http"]')
    expect(await external.count()).toBeGreaterThan(0)
    for (const link of await external.all()) {
      await expect(link).toHaveAttribute('target', '_blank')
      await expect(link).toHaveAttribute('rel', 'noreferrer')
    }
  }
})

test('highlights the release currently in view in the changelog index', async ({ page }) => {
  await openPage(page, '/changelog')

  const index = page.getByRole('navigation', { name: 'Versions' })
  await expect(index.locator('[aria-current="true"]')).toContainText('Unreleased')

  await page.locator('#v-0-12-0').evaluate((release) => {
    window.scrollTo({ top: release.getBoundingClientRect().top + window.scrollY - 150 })
  })
  await expect(index.locator('[aria-current="true"]')).toContainText('0.12.0')
  await expect(index.locator('[aria-current="true"]')).toHaveCount(1)
})

test.describe('mobile changelog', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })

  test('keeps the version bar under the header and lands anchors below it', async ({ page }) => {
    await openPage(page, '/changelog')

    const index = page.getByRole('navigation', { name: 'Versions' })
    await page.evaluate(() => window.scrollTo({ top: 3000 }))
    await expect.poll(async () => (await index.boundingBox())?.y).toBe(60)

    await index.getByRole('link', { name: /0\.6\.0/ }).click()
    await expect(index.locator('[aria-current="true"]')).toContainText('0.6.0')
    const bar = await index.boundingBox()
    const release = await page.locator('#v-0-6-0').boundingBox()
    expect(release?.y).toBeGreaterThanOrEqual((bar?.y ?? 0) + (bar?.height ?? 0))
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
  })
})

test('offers light, dark and system themes from a right-click menu', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await openPage(page, '/')

  const toggle = page.getByRole('button', { name: 'Switch theme' })
  await toggle.hover()
  await expect(page.getByRole('tooltip')).toContainText('Right-click for light, dark or system')

  await toggle.click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')

  await toggle.click({ button: 'right' })
  const menu = page.getByRole('menu', { name: 'Theme' })
  await expect(menu).toBeVisible()
  await expect(menu.getByRole('menuitemradio', { name: 'Light' })).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await expect(menu.getByRole('menuitemradio', { name: 'Light' })).toBeFocused()

  await menu.getByRole('menuitemradio', { name: 'System' }).click()
  await expect(menu).toBeHidden()
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/)
  expect(await page.evaluate(() => localStorage.getItem('create-stack.theme'))).toBeNull()

  await toggle.click({ button: 'right' })
  await page.keyboard.press('Escape')
  await expect(menu).toBeHidden()
  await expect(toggle).toBeFocused()
})

test.describe('mobile theme choice', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })

  test('chooses the theme from the mobile menu', async ({ page }) => {
    await openPage(page, '/')

    await page.getByLabel('Open menu').click()
    const themes = page.getByRole('group', { name: 'Theme' })
    await expect(themes.getByRole('button', { name: 'System' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await themes.getByRole('button', { name: 'Dark' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect(themes.getByRole('button', { name: 'Dark' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })
})
