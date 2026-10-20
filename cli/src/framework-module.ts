import type { Auth, Database, Framework, Mailer } from '../../packages/stack-config/src/index.ts'
import type { QualityProfileException } from './quality-profile.ts'
import type { ReferenceApplication } from './reference-application.ts'

export type PackageManager = {
  readonly name: string
  readonly exec: string
  readonly installArgs: readonly string[]
  readonly runArgs: (script: string) => readonly string[]
  readonly devCmd: string
}

export type Command = {
  readonly command: string
  readonly args: readonly string[]
}

export type VerificationGate = {
  readonly install: Command
  readonly format: Command
  readonly typecheck: Command
  readonly lint: Command
}

export type Monorepo = false | 'turborepo' | 'nx'

export type CapabilitySelection = Readonly<Record<string, string | null>>

export type AssemblyRequest = {
  readonly projectDir: string
  readonly database: Database
  readonly auth: Auth
  readonly trpc: boolean
  readonly mailer: Mailer
  readonly capabilities: CapabilitySelection
  readonly alias: string
  readonly monorepo: Monorepo
  readonly packageManager: PackageManager
}

export type AssemblyResult = {
  readonly applicationDir: string
  readonly manualSteps: readonly string[]
}

export type AdditionSelection =
  | { readonly type: 'capability'; readonly cap: string; readonly adapter: string | null }
  | { readonly type: 'component'; readonly name: string }

export type CapabilityAdditionRequest = {
  readonly projectDir: string
  readonly projectName: string
  readonly adapter: string | null
  readonly keep: boolean
}

export type CapabilityAdditionResult = {
  readonly addDeps: Readonly<Record<string, string>>
  readonly removeDeps: readonly string[]
  readonly envKeys: readonly string[]
  readonly requiredEnvKeys: readonly string[]
  readonly swappedFrom: string | null
  readonly manualSteps: readonly string[]
}

export type CapabilityAddition = {
  readonly providers: readonly (string | null)[]
  readonly apply: (request: CapabilityAdditionRequest) => CapabilityAdditionResult
}

export type AdditionWiring = {
  readonly componentRoot: string | null
  readonly capabilities: Readonly<Record<string, CapabilityAddition>>
}

export type FrameworkModule = {
  readonly id: Framework
  readonly detect: (applicationDir: string) => boolean
  readonly assemble: (request: AssemblyRequest) => Promise<AssemblyResult>
  readonly additions: AdditionWiring
  readonly gate: (packageManager: PackageManager) => VerificationGate
  readonly monorepoOutputs: readonly string[]
  readonly packagedAssets: readonly string[]
  readonly qualityProfileExceptions: readonly QualityProfileException[]
  readonly referenceApplication?: ReferenceApplication
}
