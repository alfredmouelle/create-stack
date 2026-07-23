import { createRootRoute, HeadContent, Scripts } from '@tanstack/react-router'
import { lazy, Suspense } from 'react'

import appCss from '../styles.css?url'

// Dev-only: devtools are code-split out of the production bundle.
const Devtools = import.meta.env.DEV
  ? lazy(() => import('~/components/devtools'))
  : () => null

// Runs before hydration to set the theme class and avoid a flash of wrong theme.
const themeScript = `(function(){try{var t=localStorage.getItem('theme')||'system';var m=window.matchMedia('(prefers-color-scheme:dark)').matches;document.documentElement.classList.toggle('dark',t==='dark'||(t==='system'&&m));}catch(e){}})();`

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        name: 'author',
        content: 'Alfred MOUELLE',
      },
      {
        title: 'App',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
      {
        rel: 'icon',
        href: '/favicon.ico',
        sizes: '32x32',
      },
      {
        rel: 'icon',
        href: '/favicon.svg',
        type: 'image/svg+xml',
      },
      {
        rel: 'manifest',
        href: '/manifest.json',
      },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/** biome-ignore lint/security/noDangerouslySetInnerHtml: anti-FOUC theme script */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Suspense fallback={null}>
          <Devtools />
        </Suspense>
        <Scripts />
      </body>
    </html>
  )
}
