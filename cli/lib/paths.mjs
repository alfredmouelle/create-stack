import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const bundled = resolve(here, '..', '_stack')

export const STACK_ROOT = process.env.CREATE_STACK_STACK_ROOT
  ? resolve(process.env.CREATE_STACK_STACK_ROOT)
  : existsSync(bundled)
    ? bundled
    : resolve(here, '..', '..')

export const TEMPLATES = resolve(here, '..', 'templates')
