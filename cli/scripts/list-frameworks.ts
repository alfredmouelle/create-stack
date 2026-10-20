import { frameworkModules } from '../src/framework-registry.ts'

process.stdout.write(`${JSON.stringify(frameworkModules.map(({ id }) => id))}\n`)
