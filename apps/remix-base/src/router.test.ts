import { join } from 'node:path'
import { afterAll, expect, test } from 'vitest'
import { applicationRoot, assets } from './assets.ts'
import { router } from './router.tsx'

afterAll(() => assets.close())

test('renders native server HTML with identity, navigation, styles, and a browser entry', async () => {
  const response = await router.fetch('http://localhost:3074/')
  const html = await response.text()

  expect(response.status).toBe(200)
  expect(html).toContain('App')
  expect(html).toContain('A clear place to start.')
  expect(html).toContain('type="module"')
  expect(html).toContain('type="importmap"')
  expect(html).toContain('stylesheet')
  expect(html).not.toContain('postgres://')
  expect(response.headers.get('cache-control')).toBe('no-store')
})

test('serves native browser source and refuses private modules and environment files', async () => {
  const entry = await assets.getScriptEntry(join(applicationRoot, 'src/client/entry.ts'))
  const response = await router.fetch(new URL(entry.href, 'http://localhost:3074'))
  expect(response.status).toBe(200)
  expect(await response.text()).toContain('loadModule')

  await Promise.all(
    [
      '/assets/app/server.ts',
      '/assets/app/env.ts',
      '/assets/app/server/db/index.ts',
      '/assets/app/.env.local',
      '/.env.local',
    ].map(async (path) => {
      const denied = await router.fetch(`http://localhost:3074${path}`)
      expect(denied.status).toBe(404)
      expect(await denied.text()).not.toContain('postgres://')
    }),
  )
})
