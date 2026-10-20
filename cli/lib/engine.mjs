import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = resolve(fileURLToPath(new URL('.', import.meta.url)))
const bundled = resolve(here, '../_stack/engine/index.mjs')
const source = resolve(here, '../src/index.ts')
const engine = await import(pathToFileURL(existsSync(bundled) ? bundled : source).href)

export const {
  createProject,
  detectFrameworkModule,
  frameworkModules,
  getFrameworkModule,
  runVerificationGate,
} = engine
