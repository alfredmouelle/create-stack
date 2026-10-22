import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { RemixNode } from 'remix/component'
import { renderToStream } from 'remix/component/server'
import { applicationRoot, assets } from './assets.ts'
import { Document } from './components/document.tsx'
import { captureServerError } from './server/observability.ts'

export async function renderPage(
  request: Request,
  title: string,
  children: RemixNode,
  status = 200,
): Promise<Response> {
  const entry = await assets.getScriptEntry(join(applicationRoot, 'src/client/entry.ts'))
  const fontStyles = await Promise.all(
    [
      '@fontsource/commit-mono/400.css',
      '@fontsource/commit-mono/700.css',
      '@fontsource-variable/instrument-sans/wdth.css',
    ].map((specifier) => assets.getHref(import.meta.resolve(specifier))),
  )
  const stylesheet = '/styles.css'
  const stream = renderToStream(
    <Document entry={entry} fontStyles={fontStyles} stylesheet={stylesheet} title={title}>
      {children}
    </Document>,
    {
      frameSrc: request.url,
      signal: request.signal,
      onError: captureServerError,
      async resolveClientEntry(entryId, component) {
        const client = await assets.getScriptEntry(fileURLToPath(entryId))
        return { ...client, exportName: component.name }
      },
    },
  )
  return new Response(stream, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'strict-origin-when-cross-origin',
    },
  })
}
