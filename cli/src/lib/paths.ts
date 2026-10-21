import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const CLI_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const bundled = resolve(CLI_ROOT, '_stack')

export const STACK_ROOT = process.env.CREATE_STACK_STACK_ROOT
  ? resolve(process.env.CREATE_STACK_STACK_ROOT)
  : existsSync(bundled)
    ? bundled
    : resolve(CLI_ROOT, '..')

export const TEMPLATES = resolve(CLI_ROOT, 'templates')
