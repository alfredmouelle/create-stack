import type { ScriptEntry } from 'remix/assets'
import type { Handle, RemixNode } from 'remix/component'
import { ImportMap } from 'remix/component/server'
import { siteConfig } from '../lib/site-config.ts'

export function Document(
  handle: Handle<{
    title: string
    children: RemixNode
    entry: ScriptEntry
    stylesheet: string
    fontStyles: readonly string[]
  }>,
) {
  return () => {
    const { title, children, entry, stylesheet, fontStyles } = handle.props
    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta content="width=device-width, initial-scale=1" name="viewport" />
          <meta content={siteConfig.description} name="description" />
          <meta content="light dark" name="color-scheme" />
          <title>
            {title} · {siteConfig.name}
          </title>
          <link href="/favicon.svg" rel="icon" type="image/svg+xml" />
          <link href="/manifest.json" rel="manifest" />
          <script>
            {
              "try{let t=localStorage.getItem('theme')||'system';document.documentElement.classList.toggle('dark',t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches))}catch{}"
            }
          </script>
          {fontStyles.map((href) => (
            <link href={href} key={href} rel="stylesheet" />
          ))}
          <link href={stylesheet} rel="stylesheet" />
          <ImportMap value={entry.importMap} />
          {entry.preloads.map((href) => (
            <link href={href} key={href} rel="modulepreload" />
          ))}
          <script src={entry.href} type="module" />
        </head>
        <body>{children}</body>
      </html>
    )
  }
}
