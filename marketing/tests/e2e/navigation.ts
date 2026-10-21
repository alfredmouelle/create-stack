import { expect, type Page } from '@playwright/test'

export async function openPage(page: Page, path: string): Promise<void> {
  await page.goto(path)
  await expect(page.locator('astro-island[client="load"][ssr]')).toHaveCount(0)
}
