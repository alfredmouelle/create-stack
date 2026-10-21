import { readFile, realpath, stat } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { loadNodeEnvFiles, NodeProdAdapter } from '@rasenganjs/runtime/adapters/node'
import {
  createApiRouterMiddleware,
  createMatchRoutesGuard,
  createRequestHandler,
  Futon,
  resolveBuildOptions,
} from 'rasengan/server'

process.env.NODE_ENV = 'production'
await loadNodeEnvFiles(process.cwd(), 'production')

const buildDirectory = resolve(process.argv[2] ?? 'dist')
await import(pathToFileURL(resolve(buildDirectory, 'server/environment.js')).href)
const build = resolveBuildOptions({ buildDirectory })
const app = new Futon()
const types: Readonly<Record<string, string>> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
}

async function publicFile(directory: string, path: string): Promise<Response | null> {
  try {
    const root = await realpath(directory)
    const file = await realpath(resolve(root, `.${path}`))
    if (!file.startsWith(`${root}${sep}`) || !(await stat(file)).isFile()) return null
    return new Response(new Uint8Array(await readFile(file)), {
      headers: {
        'content-type': types[extname(file)] ?? 'application/octet-stream',
        'cache-control': 'public, max-age=3600',
        'x-content-type-options': 'nosniff',
      },
    })
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      (error.code === 'ENOENT' || error.code === 'ENOTDIR')
    )
      return null
    throw error
  }
}

app.use(async (context, next) => {
  let path: string
  try {
    path = decodeURIComponent(new URL(context.request.url).pathname)
  } catch {
    return new Response('Not Found', { status: 404 })
  }
  if (
    path.includes('\\') ||
    path.includes('\0') ||
    path.split('/').some((segment) => segment.startsWith('.')) ||
    /^\/(?:server|src|scripts|node_modules|dist)(?:\/|$)/u.test(path)
  )
    return new Response('Not Found', { status: 404 })
  if (context.request.method !== 'GET' && context.request.method !== 'HEAD') return next()
  const response =
    (await publicFile(resolve(buildDirectory, 'client'), path)) ??
    (await publicFile(resolve('public'), path))
  if (!response) return next()
  return context.request.method === 'HEAD'
    ? new Response(null, { status: response.status, headers: response.headers })
    : response
})
app.use(createApiRouterMiddleware({ build }))
app.fallback((context) =>
  createMatchRoutesGuard({ build })(context, () => createRequestHandler({ build })(context)),
)
app.onError((error) => {
  console.error(error)
  return Promise.resolve(new Response('Internal Server Error', { status: 500 }))
})

const port = Number(process.env.PORT ?? 3000)
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid PORT')
const adapter = new NodeProdAdapter({
  port,
  host: process.env.HOST ?? '0.0.0.0',
  rootDir: buildDirectory,
})
for (const signal of ['SIGTERM', 'SIGINT'])
  process.once(signal, () => {
    void adapter.close()
  })
await adapter.serve(app, {
  onListening: ({ host, port: listeningPort }) => {
    process.stdout.write(`Rasengan listening at http://${host}:${listeningPort}\n`)
  },
})
