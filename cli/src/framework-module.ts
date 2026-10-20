import type { Auth, Database, Framework, Mailer } from '../../packages/stack-config/src/index.ts'

export type FrameworkMaturity = 'stable' | 'preview'

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
  readonly manualSteps: readonly string[]
}

export type AdditionWiring = {
  readonly componentRoot: string
}

export type QualityProfileException = {
  readonly option: string
  readonly reason: string
}

export type FrameworkModule = {
  readonly id: Framework
  readonly label: string
  readonly maturity: FrameworkMaturity
  readonly detect: (applicationDir: string) => boolean
  readonly assemble: (request: AssemblyRequest) => Promise<AssemblyResult>
  readonly additions: AdditionWiring
  readonly gate: (packageManager: PackageManager) => VerificationGate
  readonly monorepoOutputs: readonly string[]
  readonly packagedAssets: readonly string[]
  readonly qualityProfileExceptions: readonly QualityProfileException[]
}
