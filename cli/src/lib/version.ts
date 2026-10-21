import { join } from 'node:path'
import { readJsonObject } from '../javascript/json.ts'
import { CLI_ROOT } from './paths.ts'

const { version } = readJsonObject(join(CLI_ROOT, 'package.json'))

if (typeof version !== 'string') throw new Error('The CLI package.json declares no version')

export const CLI_VERSION = version
