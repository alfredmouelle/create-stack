import type { Auth, Database, Framework, Mailer } from '../../packages/stack-config/src/index.ts'
import type { CapabilitySelection, Monorepo, PackageManager } from '../src/framework-module.ts'

export type BuildProjectOptions = {
  projectDir: string
  projectName: string
  framework: Framework
  trpc: boolean
  database?: Database
  auth?: Auth
  mailerProvider: Mailer
  capabilities?: CapabilitySelection
  alias?: string
  monorepo?: Monorepo
  pm?: PackageManager
}

export function buildProject(options: BuildProjectOptions): { manualSteps: string[] }
