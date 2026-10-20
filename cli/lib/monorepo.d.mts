import type { Database, Framework } from '../../packages/stack-config/src/index.ts'
import type { Monorepo, PackageManager } from '../src/framework-module.ts'
import type { creationMetadata } from './identity.mjs'

export function wrapMonorepo(options: {
  rootDir: string
  appDir: string
  projectName: string
  framework: Framework
  pm: PackageManager
  tool: Exclude<Monorepo, false>
  database: Database
  metadata: ReturnType<typeof creationMetadata>
  hasDatabase?: boolean
  hasDatabaseSchema?: boolean
  appNativeBuilds?: readonly string[]
}): void
