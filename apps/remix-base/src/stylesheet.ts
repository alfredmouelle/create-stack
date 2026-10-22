import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { compile } from '@tailwindcss/node'
import { Scanner } from '@tailwindcss/oxide'
import { applicationRoot } from './assets.ts'

async function compileStyles(): Promise<string> {
  const source = await readFile(join(applicationRoot, 'src/styles.css'), 'utf8')
  const compiler = await compile(source, {
    base: applicationRoot,
    onDependency() {},
  })
  const scanner = new Scanner({
    sources: [{ base: applicationRoot, pattern: 'src/**/*.{ts,tsx}', negated: false }],
  })
  return compiler.build(scanner.scan())
}

let productionStyles: Promise<string> | undefined

export async function serveStyles(): Promise<Response> {
  if (process.env.NODE_ENV === 'production' && !productionStyles) productionStyles = compileStyles()
  const styles = process.env.NODE_ENV === 'production' ? productionStyles : compileStyles()
  return new Response(await styles, {
    headers: { 'content-type': 'text/css; charset=utf-8', 'cache-control': 'no-cache' },
  })
}
