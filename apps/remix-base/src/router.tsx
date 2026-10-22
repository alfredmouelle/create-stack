import { createRouter, type Router } from 'remix/router'
import { assets } from './assets.ts'
import { ApiDemo } from './client/api-demo.tsx'
import { Home } from './pages/home.tsx'
import { servePublicFile } from './public-files.ts'
import { renderPage } from './render.tsx'
import { routes } from './routes.ts'
import { installApiRoutes } from './server/api/routes.ts'
import { auth } from './server/better-auth/config.ts'
import type { Authentication } from './server/better-auth/routes.tsx'
import { installAuthRoutes } from './server/better-auth/routes.tsx'
import { serveStyles } from './stylesheet.ts'

export function createApplication(authentication: Authentication = auth): Router {
  const router = createRouter()
  installAuthRoutes(router, authentication)
  installApiRoutes(router)
  router.get('/api-demo', ({ request }) => renderPage(request, 'API connection', <ApiDemo />))
  router.get('/styles.css', serveStyles)

  router.get(routes.home, ({ request }) => renderPage(request, 'Welcome', <Home />))
  router.get(routes.health, () => Response.json({ status: 'ok' }))
  router.get(
    '/assets/*path',
    async ({ request }) =>
      (await assets.fetch(request)) ?? new Response('Not found', { status: 404 }),
  )
  router.get('/*path', ({ request }) => servePublicFile(request))

  return router
}

export const router = createApplication()
