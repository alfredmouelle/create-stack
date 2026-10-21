export const FRAMEWORKS = ['tanstack', 'next'] as const
export type Framework = (typeof FRAMEWORKS)[number]

export const DATABASES = ['drizzle', 'prisma', 'convex', 'none'] as const
export type Database = (typeof DATABASES)[number]

export const AUTHS = ['better-auth', 'clerk', 'none'] as const
export type Auth = (typeof AUTHS)[number]

export const MAILERS = ['resend', 'brevo', 'ses', 'none'] as const
export type Mailer = (typeof MAILERS)[number]

export const FORMATTERS = ['biome', 'prettier'] as const
export type Formatter = (typeof FORMATTERS)[number]

export const LINTERS = ['biome', 'oxlint'] as const
export type Linter = (typeof LINTERS)[number]

export const QUALITY_TOOL_LABELS = {
  biome: 'Biome',
  prettier: 'Prettier',
  oxlint: 'Oxlint',
} as const satisfies Readonly<Record<Formatter | Linter, string>>

export type StackAxis =
  | 'framework'
  | 'database'
  | 'auth'
  | 'trpc'
  | 'mailer'
  | 'formatter'
  | 'linter'

export type FrameworkMaturity = 'stable' | 'preview'

export type FrameworkSupport = {
  readonly label: string
  readonly maturity: FrameworkMaturity
  readonly supports: {
    readonly database: readonly Database[]
    readonly auth: readonly Auth[]
    readonly trpc: readonly boolean[]
    readonly mailer: readonly Mailer[]
    readonly formatter: readonly Formatter[]
    readonly linter: readonly Linter[]
  }
  readonly recommendations: {
    readonly database: readonly Database[]
    readonly auth: readonly Auth[]
    readonly trpc: boolean
    readonly mailer: readonly Mailer[]
    readonly formatter: Formatter
    readonly linter: Linter
  }
}

export type FrameworkSupportCatalog = Readonly<Record<Framework, FrameworkSupport>>

const FULL_STACK_SUPPORT = {
  supports: {
    database: DATABASES,
    auth: AUTHS,
    trpc: [true, false],
    mailer: MAILERS,
    formatter: FORMATTERS,
    linter: LINTERS,
  },
  recommendations: {
    database: ['drizzle'],
    auth: ['better-auth', 'clerk'],
    trpc: true,
    mailer: ['resend'],
    formatter: 'biome',
    linter: 'biome',
  },
} satisfies Pick<FrameworkSupport, 'supports' | 'recommendations'>

export const FRAMEWORK_SUPPORT: FrameworkSupportCatalog = {
  tanstack: { label: 'TanStack Start', maturity: 'stable', ...FULL_STACK_SUPPORT },
  next: { label: 'Next.js', maturity: 'stable', ...FULL_STACK_SUPPORT },
}

export const RECOMMENDED_FRAMEWORK: Framework = 'tanstack'

export function frameworkTitle(framework: Framework): string {
  const { label, maturity } = FRAMEWORK_SUPPORT[framework]
  return maturity === 'preview' ? `${label} (preview)` : label
}

export type ResolutionReasonKind = 'explicit' | 'recommended' | 'dependency' | 'minimal'

export type StackChoiceValue = Framework | Database | Auth | Mailer | Formatter | Linter | boolean

export interface StackConfigurationInput {
  framework?: Framework
  database?: Database
  auth?: Auth
  trpc?: boolean
  mailer?: Mailer
  formatter?: Formatter
  linter?: Linter
  minimal?: boolean
}

export interface StackConfiguration {
  framework: Framework
  database: Database
  auth: Auth
  trpc: boolean
  mailer: Mailer
  formatter: Formatter
  linter: Linter
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

const UNAVAILABLE_CHOICES: Partial<Record<StackAxis, Readonly<Record<string, string>>>> = {
  formatter: { oxfmt: 'oxfmt is not supported until its 1.0 release; choose biome or prettier' },
  linter: {
    eslint:
      'ESLint is not supported until typescript-eslint supports TypeScript 7; choose biome or oxlint',
  },
}

function assertChoice<Value extends string>(
  value: unknown,
  name: StackAxis,
  choices: readonly Value[],
): Value | undefined {
  if (value === undefined) return undefined
  const unavailable = typeof value === 'string' ? UNAVAILABLE_CHOICES[name]?.[value] : undefined
  if (unavailable !== undefined) throw new Error(unavailable)
  const choice = choices.find((choice) => choice === value)
  if (choice === undefined) {
    throw new Error(`Invalid ${name}: ${JSON.stringify(value)} (expected ${choices.join(', ')})`)
  }
  return choice
}

function validateBoolean(value: boolean | undefined, name: string): void {
  if (value !== undefined && typeof value !== 'boolean') {
    throw new Error(`Invalid ${name}: expected true or false`)
  }
}

type ExplicitChoices = {
  readonly [Axis in StackAxis]: StackConfiguration[Axis] | undefined
}

function explicitChoices(input: StackConfigurationInput): ExplicitChoices {
  return {
    framework: assertChoice(input.framework, 'framework', FRAMEWORKS),
    database: assertChoice(input.database, 'database', DATABASES),
    auth: assertChoice(input.auth, 'auth', AUTHS),
    trpc: input.trpc,
    mailer: assertChoice(input.mailer, 'mailer', MAILERS),
    formatter: assertChoice(input.formatter, 'formatter', FORMATTERS),
    linter: assertChoice(input.linter, 'linter', LINTERS),
  }
}

const listFormat = new Intl.ListFormat('en', { type: 'disjunction' })

function unsupportedChoiceMessage(
  framework: FrameworkSupport,
  axis: Exclude<StackAxis, 'framework'>,
  value: StackChoiceValue,
): string {
  if (axis === 'trpc') {
    return value
      ? `${framework.label} does not support tRPC; use --no-trpc`
      : `${framework.label} requires tRPC; remove --no-trpc`
  }
  const supported = framework.supports[axis]
  return `${framework.label} does not support ${axis} ${JSON.stringify(value)}; choose ${listFormat.format(supported)}`
}

function findUnsupportedChoices(
  choices: ReturnType<typeof explicitChoices>,
  framework: FrameworkSupport,
): ChoiceConflict[] {
  const axes = ['database', 'auth', 'trpc', 'mailer', 'formatter', 'linter'] as const
  return axes.flatMap((axis) => {
    const value = choices[axis]
    const supported: readonly StackChoiceValue[] = framework.supports[axis]
    if (value === undefined || supported.includes(value)) return []
    return [
      { axes: ['framework', axis], message: unsupportedChoiceMessage(framework, axis, value) },
    ]
  })
}

type CompatibilitySelection = {
  readonly [Axis in 'database' | 'auth' | 'trpc' | 'mailer']?: StackConfiguration[Axis] | undefined
}

type CompatibilityRule = {
  readonly axes: readonly [StackAxis, StackAxis]
  readonly message: string
  readonly violatedBy: (selection: CompatibilitySelection) => boolean
}

const COMPATIBILITY_RULES: readonly CompatibilityRule[] = [
  {
    axes: ['database', 'auth'],
    message: 'Better Auth cannot be used with Convex',
    violatedBy: ({ database, auth }) => database === 'convex' && auth === 'better-auth',
  },
  {
    axes: ['database', 'trpc'],
    message: 'Convex cannot be combined with tRPC',
    violatedBy: ({ database, trpc }) => database === 'convex' && trpc === true,
  },
  {
    axes: ['auth', 'database'],
    message: 'Better Auth requires a database; remove --no-db or choose another auth',
    violatedBy: ({ auth, database }) => auth === 'better-auth' && database === 'none',
  },
  {
    axes: ['auth', 'mailer'],
    message: 'Better Auth requires mail; remove --no-mail or choose another auth',
    violatedBy: ({ auth, mailer }) => auth === 'better-auth' && mailer === 'none',
  },
]

const fitsAxis = (axis: StackAxis, selection: CompatibilitySelection): boolean =>
  COMPATIBILITY_RULES.every((rule) => !rule.axes.includes(axis) || !rule.violatedBy(selection))

function findConflicts(
  choices: ReturnType<typeof explicitChoices>,
  framework: FrameworkSupport,
): readonly ChoiceConflict[] {
  return [
    ...findUnsupportedChoices(choices, framework),
    ...COMPATIBILITY_RULES.filter((rule) => rule.violatedBy(choices)).map(({ axes, message }) => ({
      axes,
      message,
    })),
  ]
}

function choose<Value>(
  preferences: readonly Value[],
  fallback: Value,
  preferFallback: boolean,
  fits: (value: Value) => boolean,
): Value {
  if (preferFallback && fits(fallback)) return fallback
  return preferences.find(fits) ?? fallback
}

function resolveConfiguration(
  choices: ReturnType<typeof explicitChoices>,
  framework: FrameworkSupport,
  minimal: boolean,
): StackConfiguration {
  const { recommendations } = framework
  const database =
    choices.database ??
    choose(recommendations.database, 'none', minimal, (database) =>
      fitsAxis('database', { ...choices, database }),
    )
  const auth =
    choices.auth ??
    choose(recommendations.auth, 'none', minimal, (auth) =>
      fitsAxis('auth', { ...choices, database, auth }),
    )
  const trpc =
    choices.trpc ??
    choose(recommendations.trpc ? [true] : [], false, minimal, (trpc) =>
      fitsAxis('trpc', { ...choices, database, auth, trpc }),
    )
  const mailer =
    choices.mailer ??
    choose(recommendations.mailer, 'none', true, (mailer) =>
      fitsAxis('mailer', { ...choices, database, auth, trpc, mailer }),
    )
  return {
    framework: choices.framework ?? RECOMMENDED_FRAMEWORK,
    database,
    auth,
    trpc,
    mailer,
    formatter: choices.formatter ?? recommendations.formatter,
    linter: choices.linter ?? recommendations.linter,
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
  addReason(
    reasons,
    'formatter',
    choices.formatter,
    configuration.formatter,
    false,
    recommendationMessage,
  )
  addReason(reasons, 'linter', choices.linter, configuration.linter, false, recommendationMessage)
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
  if (input.formatter !== undefined) args.push('--formatter', input.formatter)
  if (input.linter !== undefined) args.push('--linter', input.linter)
  return args
}

export function resolveStackConfiguration(
  input: StackConfigurationInput = {},
  frameworkSupport: FrameworkSupportCatalog = FRAMEWORK_SUPPORT,
): StackConfigurationResult {
  validateBoolean(input.trpc, 'trpc')
  validateBoolean(input.minimal, 'minimal')

  const choices = explicitChoices(input)
  const framework = frameworkSupport[choices.framework ?? RECOMMENDED_FRAMEWORK]
  const conflicts = findConflicts(choices, framework)
  const minimal = input.minimal === true
  const hasExplicitChoice = Object.values(choices).some((value) => value !== undefined)
  const recommendationMessage =
    !minimal && !hasExplicitChoice ? 'recommended stack' : 'applicable recommendation'
  const configuration = resolveConfiguration(choices, framework, minimal)
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
