import { expect, test } from '@playwright/test'

const consentKey = 'create-stack.analytics-consent'

test.describe('analytics consent', () => {
  test('does not flash the banner when consent was already chosen', async ({ page }) => {
    await page.addInitScript((key) => {
      window.localStorage.setItem(key, 'v1:rejected')

      const state = window as Window & { __consentDialogMounts?: number }
      state.__consentDialogMounts = 0
      const includesDialog = (node: Node) =>
        node instanceof Element &&
        (node.getAttribute('role') === 'dialog' || node.querySelector('[role="dialog"]') !== null)

      new MutationObserver((mutations) => {
        if (mutations.some((mutation) => [...mutation.addedNodes].some(includesDialog))) {
          state.__consentDialogMounts = (state.__consentDialogMounts ?? 0) + 1
        }
      }).observe(document, { childList: true, subtree: true })
    }, consentKey)

    await page.goto('/', { waitUntil: 'domcontentloaded' })

    await expect(page.getByRole('dialog', { name: 'Analytics, on your terms.' })).not.toBeVisible()
    await page.waitForLoadState('load')
    await expect(page.getByRole('button', { name: 'Open privacy settings' })).toBeVisible()
    expect(
      await page.evaluate(
        () => (window as Window & { __consentDialogMounts?: number }).__consentDialogMounts,
      ),
    ).toBe(0)
  })

  test('keeps analytics off until the visitor makes a choice', async ({ page }) => {
    await page.goto('/')

    const dialog = page.getByRole('dialog', { name: 'Analytics, on your terms.' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Refuse' })).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Accept analytics' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Open privacy settings' })).not.toBeVisible()

    await dialog.getByRole('button', { name: 'Refuse' }).click()
    await expect(page.getByRole('button', { name: 'Open privacy settings' })).toBeVisible()
    expect(await page.evaluate((key) => localStorage.getItem(key), consentKey)).toBe('v1:rejected')
  })

  test('can accept analytics and change the choice later', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('button', { name: 'Accept analytics' }).click()
    await expect(page.getByRole('button', { name: 'Open privacy settings' })).toBeVisible()
    expect(await page.evaluate((key) => localStorage.getItem(key), consentKey)).toBe('v1:accepted')

    await page.getByRole('button', { name: 'Open privacy settings' }).click()
    await expect(page.getByRole('dialog', { name: 'Analytics, on your terms.' })).toBeVisible()
    await page.getByRole('button', { name: 'Refuse' }).click()
    expect(await page.evaluate((key) => localStorage.getItem(key), consentKey)).toBe('v1:rejected')
  })

  test('links the consent choice to the privacy page', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'Read the privacy page ↗' }).click()

    await expect(page).toHaveURL(/\/privacy$/)
    await expect(
      page.getByRole('heading', { name: 'Analytics with a clear boundary.' }),
    ).toBeVisible()
    await expect(page.getByText('Analytics is off by default')).toBeVisible()
  })

  test('keeps privacy settings clear of the footer at the bottom of the page', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Refuse' }).click()
    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = 'auto'
      window.scrollTo(0, document.documentElement.scrollHeight)
    })

    const trigger = page.getByRole('button', { name: 'Open privacy settings' })
    await expect(trigger).toBeVisible()

    const triggerBox = await trigger.boundingBox()
    const footerBox = await page.locator('.footer-inner').boundingBox()

    expect(triggerBox).not.toBeNull()
    expect(footerBox).not.toBeNull()
    if (!triggerBox || !footerBox) throw new Error('Expected privacy settings and footer bounds')
    expect(triggerBox.y).toBeGreaterThanOrEqual(footerBox.y + footerBox.height)
  })
})
