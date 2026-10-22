import { DATABASES, FRAMEWORKS } from '@alfredmouelle/stack-config'
import { expect, test } from '@playwright/test'
import { RELEASED_FRAMEWORKS } from '../../src/lib/cli-release'
import { openPage } from './navigation'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('create-stack.analytics-consent', 'v1:rejected')
  })
})

test('documents every CLI section under a stable anchor', async ({ page }) => {
  await openPage(page, '/docs')

  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(
    page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Docs' }),
  ).toHaveAttribute('aria-current', 'page')

  const contents = page.getByRole('navigation', { name: 'On this page' })
  for (const [id, title] of [
    ['quick-start', 'Quick start'],
    ['flags', 'Scaffold flags'],
    ['add', 'Add to a project'],
    ['components', 'Components'],
    ['after-creation', 'After creating a project'],
  ]) {
    await expect(contents.getByRole('link', { name: title })).toHaveAttribute('href', `#${id}`)
    await expect(page.locator(`#${id}`)).toHaveText(title)
  }
})

test('lists the stack values the CLI accepts', async ({ page }) => {
  await openPage(page, '/docs')

  const flags = page.getByRole('table', { name: 'Stack flags' })
  const database = flags.getByRole('row', { name: /--database/ })
  for (const value of DATABASES) await expect(database).toContainText(value)
  const framework = flags.getByRole('row', { name: /--framework/ })
  for (const value of FRAMEWORKS) {
    if (RELEASED_FRAMEWORKS.includes(value)) await expect(framework).toContainText(value)
    else await expect(framework).not.toContainText(value)
  }
})
