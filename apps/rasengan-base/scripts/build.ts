import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { createBuilder } from 'vite'

const require = createRequire(import.meta.url)
const configFile = join(dirname(require.resolve('rasengan/package.json')), 'vite.config.ts')
const builder = await createBuilder({ configFile })
await builder.buildApp()
