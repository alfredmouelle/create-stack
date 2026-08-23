export const FRAMEWORKS = ['tanstack', 'next'] as const
export type Framework = (typeof FRAMEWORKS)[number]

export const DATABASES = ['drizzle', 'prisma', 'convex', 'none'] as const
export type Database = (typeof DATABASES)[number]

export const AUTHS = ['better-auth', 'clerk', 'none'] as const
export type Auth = (typeof AUTHS)[number]

export const MAILERS = ['resend', 'brevo', 'ses', 'none'] as const
export type Mailer = (typeof MAILERS)[number]

export type StackAxis = 'framework' | 'database' | 'auth' | 'trpc' | 'mailer'

export type ResolutionReasonKind = 'explicit' | 'recommended' | 'dependency' | 'minimal'

export type StackChoiceValue = Framework | Database | Auth | Mailer | boolean

export interface StackConfigurationInput {
  framework?: Framework
  database?: Database
  auth?: Auth
  trpc?: boolean
  mailer?: Mailer
  minimal?: boolean
}

export interface StackConfiguration {
  framework: Framework
  database: Database
  auth: Auth
  trpc: boolean
  mailer: Mailer
  minimal: boolean
}

export interface ResolutionReason {
  axis: StackAxis
  kind: ResolutionReasonKind
  message: string
  value: StackChoiceValue
}

export interface ChoiceConflict {
  axes: readonly StackAxis[]
  message: string
}

export interface StackConfigurationResult {
  configuration: StackConfiguration
  reasons: readonly ResolutionReason[]
  conflicts: readonly ChoiceConflict[]
  cliArgs: readonly string[]
}

const DEFAULT_FRAMEWORK: Framework = 'tanstack'
const DEFAULT_DATABASE: Database = 'drizzle'
const DEFAULT_AUTH: Auth = 'better-auth'
const DEFAULT_MAILER: Mailer = 'resend'

function assertChoice(
  value: unknown,
  name: string,
  choices: readonly string[],
): string | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'string' || !choices.includes(value)) {
    throw new Error(`Invalid ${name}: ${JSON.stringify(value)} (expected ${choices.join(', ')})`)
  }
  return value
}

function validateBoolean(value: boolean | undefined, name: string): void {
  if (value !== undefined && typeof value !== 'boolean') {
    throw new Error(`Invalid ${name}: expected true or false`)
  }
}

function explicitChoices(input: StackConfigurationInput) {
  return {
    framework: assertChoice(input.framework, 'framework', FRAMEWORKS) as Framework | undefined,
    database: assertChoice(input.database, 'database', DATABASES) as Database | undefined,
    auth: assertChoice(input.auth, 'auth', AUTHS) as Auth | undefined,
    trpc: input.trpc,
    mailer: assertChoice(input.mailer, 'mailer', MAILERS) as Mailer | undefined,
  }
}

function findConflicts(choices: ReturnType<typeof explicitChoices>): readonly ChoiceConflict[] {
  const conflicts: ChoiceConflict[] = []

  if (choices.database === 'convex' && choices.auth === 'better-auth') {
    conflicts.push({
      axes: ['database', 'auth'],
      message: 'Better Auth cannot be used with Convex',
    })
  }
  if (choices.database === 'convex' && choices.trpc === true) {
    conflicts.push({
      axes: ['database', 'trpc'],
      message: 'Convex cannot be combined with tRPC',
    })
  }
  if (choices.auth === 'better-auth' && choices.database === 'none') {
    conflicts.push({
      axes: ['auth', 'database'],
      message: 'Better Auth requires a database; remove --no-db or choose another auth',
    })
  }
  if (choices.auth === 'better-auth' && choices.mailer === 'none') {
    conflicts.push({
      axes: ['auth', 'mailer'],
      message: 'Better Auth requires mail; remove --no-mail or choose another auth',
    })
  }

  return conflicts
}

function resolveDatabase(choices: ReturnType<typeof explicitChoices>, minimal: boolean): Database {
  if (choices.database === undefined && minimal && choices.auth === 'better-auth') {
    return DEFAULT_DATABASE
  }
  return choices.database ?? (minimal ? 'none' : DEFAULT_DATABASE)
}

function resolveAuth(
  choices: ReturnType<typeof explicitChoices>,
  database: Database,
  minimal: boolean,
): Auth {
  if (choices.auth !== undefined) return choices.auth
  if (minimal) return 'none'
  if (database === 'convex' || database === 'none' || choices.mailer === 'none') return 'clerk'
  return DEFAULT_AUTH
}

function resolveTrpc(
  choices: ReturnType<typeof explicitChoices>,
  database: Database,
  minimal: boolean,
): boolean {
  return choices.trpc ?? (minimal ? false : database !== 'convex')
}

function resolveMailer(
  choices: ReturnType<typeof explicitChoices>,
  auth: Auth,
  minimal: boolean,
): Mailer {
  if (choices.mailer === undefined && minimal && auth === 'better-auth') {
    return DEFAULT_MAILER
  }
  return choices.mailer ?? (minimal ? 'none' : auth === 'better-auth' ? DEFAULT_MAILER : 'none')
}

function resolveConfiguration(
  choices: ReturnType<typeof explicitChoices>,
  minimal: boolean,
): StackConfiguration {
  const database = resolveDatabase(choices, minimal)
  const auth = resolveAuth(choices, database, minimal)
  return {
    framework: choices.framework ?? DEFAULT_FRAMEWORK,
    database,
    auth,
    trpc: resolveTrpc(choices, database, minimal),
    mailer: resolveMailer(choices, auth, minimal),
    minimal,
  }
}

function reasonFor(
  axis: StackAxis,
  value: StackChoiceValue,
  kind: ResolutionReasonKind,
  message: string,
): ResolutionReason {
  return { axis, kind, message, value }
}

function isExclusion(value: StackChoiceValue): boolean {
  return value === false || value === 'none'
}

function addReason(
  reasons: ResolutionReason[],
  axis: StackAxis,
  explicit: StackChoiceValue | undefined,
  resolved: StackChoiceValue,
  minimal: boolean,
  recommendationMessage: string,
): void {
  if (explicit !== undefined) {
    reasons.push(
      reasonFor(
        axis,
        resolved,
        'explicit',
        isExclusion(explicit) ? 'requested exclusion' : 'requested',
      ),
    )
    return
  }
  reasons.push(
    reasonFor(
      axis,
      resolved,
      minimal ? 'minimal' : 'recommended',
      minimal ? 'minimal exclusion' : recommendationMessage,
    ),
  )
}

function createReasons(
  choices: ReturnType<typeof explicitChoices>,
  configuration: StackConfiguration,
  minimal: boolean,
  recommendationMessage: string,
): ResolutionReason[] {
  const reasons: ResolutionReason[] = []
  addReason(
    reasons,
    'framework',
    choices.framework,
    configuration.framework,
    false,
    recommendationMessage,
  )
  addReason(
    reasons,
    'database',
    choices.database,
    configuration.database,
    minimal,
    recommendationMessage,
  )
  addReason(reasons, 'auth', choices.auth, configuration.auth, minimal, recommendationMessage)
  addReason(reasons, 'trpc', choices.trpc, configuration.trpc, minimal, recommendationMessage)
  addReason(reasons, 'mailer', choices.mailer, configuration.mailer, minimal, recommendationMessage)
  return reasons
}

function replaceReason(
  reasons: ResolutionReason[],
  axis: StackAxis,
  value: StackChoiceValue,
): void {
  const index = reasons.findIndex((reason) => reason.axis === axis)
  if (index !== -1) {
    reasons[index] = reasonFor(axis, value, 'dependency', 'dependency completion for Better Auth')
  }
}

function completeDependencyReasons(
  choices: ReturnType<typeof explicitChoices>,
  configuration: StackConfiguration,
  reasons: ResolutionReason[],
): void {
  if (choices.auth !== 'better-auth') return
  if (choices.database === undefined) replaceReason(reasons, 'database', configuration.database)
  if (choices.mailer === undefined) replaceReason(reasons, 'mailer', configuration.mailer)
}

function cliArgsFor(input: StackConfigurationInput): readonly string[] {
  const args: string[] = []
  if (input.framework !== undefined) args.push('--framework', input.framework)
  if (input.minimal === true) args.push('--minimal')
  if (input.database !== undefined) args.push('--database', input.database)
  if (input.auth !== undefined) args.push('--auth', input.auth)
  if (input.trpc !== undefined) args.push(input.trpc ? '--trpc' : '--no-trpc')
  if (input.mailer !== undefined) args.push('--mailer', input.mailer)
  return args
}

export function resolveStackConfiguration(
  input: StackConfigurationInput = {},
): StackConfigurationResult {
  validateBoolean(input.trpc, 'trpc')
  validateBoolean(input.minimal, 'minimal')

  const choices = explicitChoices(input)
  const conflicts = findConflicts(choices)
  const minimal = input.minimal === true
  const hasExplicitChoice = Object.values(choices).some((value) => value !== undefined)
  const recommendationMessage =
    !minimal && !hasExplicitChoice ? 'recommended stack' : 'applicable recommendation'
  const configuration = resolveConfiguration(choices, minimal)
  const reasons = createReasons(choices, configuration, minimal, recommendationMessage)
  completeDependencyReasons(choices, configuration, reasons)

  return {
    configuration,
    reasons,
    conflicts,
    cliArgs: conflicts.length === 0 ? cliArgsFor(input) : [],
  }
}

export function stackConfigurationCliArgs(input: StackConfigurationInput = {}): readonly string[] {
  const result = resolveStackConfiguration(input)
  if (result.conflicts.length > 0) {
    throw new Error(result.conflicts.map((conflict) => conflict.message).join('; '))
  }
  return result.cliArgs
}
