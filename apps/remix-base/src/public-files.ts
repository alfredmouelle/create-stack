import { readFile } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import { applicationRoot } from './assets.ts'

const contentTypes: Readonly<Record<string, string>> = {
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
}

export async function servePublicFile(request: Request): Promise<Response> {
  try {
    const publicRoot = resolve(applicationRoot, 'public')
    const pathname = decodeURIComponent(new URL(request.url).pathname)
    const path = resolve(publicRoot, `.${pathname}`)
    const type = contentTypes[extname(path)]
    if (
      type === undefined ||
      !path.startsWith(`${publicRoot}${sep}`) ||
      pathname.split('/').some((part) => part.startsWith('.'))
    )
      return new Response('Not found', { status: 404 })
    return new Response(await readFile(path), {
      headers: { 'content-type': type, 'x-content-type-options': 'nosniff' },
    })
  } catch {
    return new Response('Not found', { status: 404 })
  }
}
