import { defineRouter, flatRoutes, type PageComponent, RouterComponent } from 'rasengan'

const Router = flatRoutes(() =>
  import.meta.glob<{ readonly default: PageComponent }>([
    '/src/app/_routes/**/layout.{js,ts,jsx,tsx}',
    '/src/app/_routes/**/*.page.{md,mdx,js,ts,jsx,tsx}',
  ]),
)

class AppRouter extends RouterComponent {}

export default defineRouter({ imports: [Router] })(AppRouter)
