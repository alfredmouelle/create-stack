import {
  type Mailer,
  resolveStackConfiguration,
  type StackAxis,
  type StackConfiguration,
  type StackConfigurationInput,
} from '../../packages/stack-config/src/index.ts'

export type CreationConfiguration = StackConfiguration & {
  readonly mailerProvider: Mailer
  readonly selectionReasons: Readonly<Partial<Record<StackAxis, string>>>
}

export function resolveCreationConfiguration(
  input: StackConfigurationInput = {},
): CreationConfiguration {
  const result = resolveStackConfiguration(input)
  if (result.conflicts.length > 0) {
    throw new Error(result.conflicts.map((conflict) => conflict.message).join('; '))
  }
  return {
    ...result.configuration,
    mailerProvider: result.configuration.mailer,
    selectionReasons: Object.fromEntries(
      result.reasons.map((reason) => [reason.axis, reason.message]),
    ),
  }
}
