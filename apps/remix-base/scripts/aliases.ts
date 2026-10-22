import { existsSync, readFileSync, statSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const root = fileURLToPath(new URL('../', import.meta.url))
const config: unknown = JSON.parse(readFileSync(resolve(root, 'tsconfig.json'), 'utf8'))
if (!object(config) || !object(config.compilerOptions) || !object(config.compilerOptions.paths))
  throw new Error('Missing import aliases in tsconfig.json')
const aliases = Object.entries(config.compilerOptions.paths).flatMap(([pattern, targets]) =>
  Array.isArray(targets) && typeof targets[0] === 'string'
    ? [{ prefix: pattern.replace(/\*$/u, ''), target: targets[0].replace(/\*$/u, '') }]
    : [],
)
const extensions = ['', '.ts', '.tsx', '.mjs', '.js', '/index.ts', '/index.tsx']

registerHooks({
  resolve(specifier, context, nextResolve) {
    let candidate: string | undefined
    const alias = aliases.find(({ prefix }) => specifier.startsWith(prefix))
    if (alias) candidate = resolve(root, alias.target, specifier.slice(alias.prefix.length))
    if (
      candidate === undefined &&
      specifier.startsWith('.') &&
      context.parentURL?.startsWith('file:') === true
    ) {
      const parent = fileURLToPath(context.parentURL)
      if (parent.startsWith(resolve(root, 'src')))
        candidate = fileURLToPath(new URL(specifier, context.parentURL))
    }
    if (candidate !== undefined) {
      const target = extensions
        .map((extension) => `${candidate}${extension}`)
        .find((path) => existsSync(path) && statSync(path).isFile())
      if (target !== undefined) return nextResolve(pathToFileURL(target).href, context)
    }
    return nextResolve(specifier, context)
  },
})
