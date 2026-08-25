import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const CLI_VERSION = JSON.parse(
  readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'),
).version
