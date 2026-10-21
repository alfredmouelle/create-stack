import { resolve } from 'node:path'
import * as p from '@clack/prompts'
import type { ParsedArgs } from '#lib/args.ts'
import {
  detectPackageManager,
  detectProjectPackageManager,
  resolveExplicitPackageManager,
} from '#lib/package-manager.ts'
import {
  findCompatibleApplications,
  relativeApplicationPath,
  resolveApplicationPath,
} from '#lib/project-target.ts'
import { COMPONENT_CATALOG, COMPONENT_NAMES } from '#lib/registry.ts'
import {
  type ComponentResult,
  installRegistryComponents,
  preflightRegistryComponents,
  type RegistryPreflight,
} from '#lib/shadcn.ts'
import { validateAdditions } from '../additions.ts'
import { runVerificationGate } from '../engine.ts'
import { requireFrameworkModule } from '../framework-registry.ts'
import {
  ADDABLE,
  adapterChoicesFor,
  addableChoices,
  addCapability,
  currentTargetAdapter,
  resolveAdditionKind,
  resolveTargetAdapter,
  targetDir,
} from '../javascript/add-command.ts'
import {
  cancelled,
  flagChoices,
  helpLine,
  MODULE_CAPABILITIES,
  PORT_CAPABILITIES,
} from './shared.ts'

type ComponentAddition = { readonly type: 'component'; readonly name: string }

type CapabilityAddition = {
  readonly type: 'capability'
  readonly cap: string
  readonly name: string
  readonly adapter: string | null
}

type Addition = ComponentAddition | CapabilityAddition

type AddedComponent = ComponentAddition & ComponentResult

type AddedCapability = CapabilityAddition & ReturnType<typeof addCapability>

type Added = AddedComponent | AddedCapability

export const ADDITION_HELP = `create-stack add: enrich an existing application.

Usage:
  create-stack add <capability> [provider] [flags]
  create-stack add component <name> [flags]
  create-stack add --with <kind>[=<provider>] [--with ...] [flags]

Run with no addition for an interactive picker. An explicit addition prints its
resolved plan and runs without confirmation. Provider changes remove former
provider files by default; --keep-files retains them.

Swappable behind a port: ${[...PORT_CAPABILITIES.map(({ flag }) => flag), 'mail'].join(', ')}.
Single provider: ${MODULE_CAPABILITIES.map(({ flag, providers }) => `${flag} (${providers.join(', ')})`).join(', ')}.
No provider at all: email-ui, http.
Components: ${COMPONENT_NAMES.join(', ')}.

Flags:
  --with <kind>[=<provider>]        Add one item to a validated addition batch (repeatable)
  --keep-files                     Keep former provider files when changing provider
  --force                          Replace existing files for a selected component
  --app <relative-path>            Application target (required when ambiguous)
${helpLine(`  --pm <${flagChoices('pm')}>`, 'Override package manager detected from lockfile')}
  --package-manager <name>         Alias for --pm
  --no-install                     Skip install + verification
  -h, --help                       Show this help`

function resolveComponentAddition(name: string): ComponentAddition {
  if (name === 'datatable') {
    throw new Error(
      "'datatable' was renamed to 'data-table'; run create-stack add component data-table",
    )
  }
  if (!COMPONENT_NAMES.includes(name)) {
    throw new Error(`Unknown component: ${name}. Pick one of ${COMPONENT_NAMES.join(', ')}`)
  }
  return { type: 'component', name }
}

function resolveCapabilityAddition(
  requestedKind: string | undefined,
  requestedProvider: string | undefined,
): CapabilityAddition {
  const resolved = requestedKind === undefined ? null : resolveAdditionKind(requestedKind)
  if (!resolved) {
    const formerEmailUiName = ['email', 'kit'].join('-')
    if (requestedKind === formerEmailUiName) {
      throw new Error(
        `'${formerEmailUiName}' was renamed to 'email-ui'; run create-stack add email-ui`,
      )
    }
    throw new Error(
      `Unknown addition: ${requestedKind}. Pick one of ${ADDABLE.join(', ')}, component`,
    )
  }
  return {
    type: 'capability',
    ...resolved,
    adapter: resolveTargetAdapter(resolved.cap, requestedProvider),
  }
}

function resolveExplicitAddition(args: ParsedArgs): Addition {
  const requestedKind = args._[1]
  if (requestedKind === 'component') {
    const name = args._[2]
    if (!name) throw new Error('component requires a name')
    if (args._[3]) throw new Error(`Unexpected positional argument: ${args._[3]}`)
    return resolveComponentAddition(name)
  }

  if (args._[3]) throw new Error(`Unexpected positional argument: ${args._[3]}`)
  return resolveCapabilityAddition(requestedKind, args._[2])
}

function resolveBatchAddition(value: string | true): Addition {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('--with requires <kind>[=<provider>]')
  }
  const separator = value.indexOf('=')
  const requestedKind = separator === -1 ? value : value.slice(0, separator)
  const requestedProvider = separator === -1 ? undefined : value.slice(separator + 1)
  if (!requestedKind || requestedProvider === '') {
    throw new Error(`Invalid --with addition: ${value}`)
  }
  if (requestedKind === 'component') {
    if (!requestedProvider) throw new Error('--with component requires a component name')
    return resolveComponentAddition(requestedProvider)
  }
  return resolveCapabilityAddition(requestedKind, requestedProvider)
}

function resolveAdditionBatch(args: ParsedArgs): Addition[] | null {
  const values = args.options.filter(({ name }) => name === 'with').map(({ value }) => value)
  if (values.length === 0) return null
  if (args._[1]) throw new Error('Positional additions cannot be mixed with --with additions')
  const selections = values.map(resolveBatchAddition)
  const seen = new Set<string>()
  for (const selection of selections) {
    const key = `${selection.type}:${selection.name}`
    if (seen.has(key)) throw new Error(`Duplicate addition: ${selection.name}`)
    seen.add(key)
  }
  return selections
}

async function resolveAddSelections(args: ParsedArgs): Promise<Addition[]> {
  const batch = resolveAdditionBatch(args)
  if (batch) return batch
  if (args._[1]) return [resolveExplicitAddition(args)]

  const additions = cancelled(
    await p.groupMultiselect({
      message: 'Additions to add (space to toggle)',
      required: true,
      selectableGroups: false,
      options: {
        Capabilities: addableChoices(),
        Components: Object.entries(COMPONENT_CATALOG).map(([name, { label, hint }]) => ({
          value: `component=${name}`,
          label,
          hint,
        })),
      },
    }),
  )
  const selections: Addition[] = []
  for (const addition of additions) {
    if (addition.startsWith('component=')) {
      selections.push({ type: 'component', name: addition.slice('component='.length) })
      continue
    }
    const cap = addition
    const choices = adapterChoicesFor(cap)
    const adapter = choices
      ? cancelled(
          await p.select({
            message: `${cap} adapter`,
            options: [...choices.options],
            initialValue: choices.defaultAdapter,
          }),
        )
      : null
    const resolved = resolveAdditionKind(cap)
    if (!resolved) throw new Error(`Unknown addition: ${cap}`)
    selections.push({ type: 'capability', ...resolved, adapter })
  }
  return selections
}

const addedLine = (a: AddedCapability): string => {
  const parts = [a.adapter ? `${a.cap} (${a.adapter})` : a.cap]
  if (a.swappedFrom) parts.push(`[swapped from ${a.swappedFrom}]`)
  parts.push(`→ ${targetDir(a.cap)}/`)
  if (a.envKeys.length) parts.push(`env: ${a.envKeys.join(', ')}`)
  return parts.join('  ')
}

const componentLine = (c: AddedComponent): string => {
  const parts = [c.name]
  if (c.copied.length) parts.push(`+${c.copied.length} file${c.copied.length > 1 ? 's' : ''}`)
  if (c.skipped.length) parts.push(`(${c.skipped.length} kept)`)
  const deps = Object.keys(c.addDeps)
  if (deps.length) parts.push(`deps: ${deps.join(', ')}`)
  if (c.mounted) parts.push(`mounted <${c.rootName} />`)
  else if (c.rootName) parts.push(`add <${c.rootName} /> to your root layout`)
  return parts.join('  ')
}

function validateAdditionInvocation(args: ParsedArgs): void {
  const known = new Set([
    'with',
    'app',
    'pm',
    'package-manager',
    'keep-files',
    'force',
    'no-install',
    'help',
    'h',
  ])
  for (const { name, value } of args.options) {
    if (!known.has(name)) throw new Error(`Unknown option for add: --${name}`)
    if (['keep-files', 'force', 'no-install'].includes(name) && value !== true) {
      throw new Error(`--${name} does not accept a value`)
    }
    if (['app', 'pm', 'package-manager'].includes(name) && value === true) {
      throw new Error(`--${name} requires a value`)
    }
    if (name === 'with' && value === true) throw new Error('--with requires a value')
  }
}

function addSelection({
  selection,
  projectDir,
  keepFiles,
  registryResults,
}: {
  readonly selection: Addition
  readonly projectDir: string
  readonly keepFiles: boolean
  readonly registryResults: ReadonlyMap<string, ComponentResult>
}): Added {
  if (selection.type === 'component') {
    const result = registryResults.get(selection.name)
    if (!result) throw new Error(`Missing registry result for component: ${selection.name}`)
    return { ...selection, ...result }
  }

  return {
    ...selection,
    ...addCapability({
      projectDir,
      cap: selection.cap,
      adapter: selection.adapter,
      keep: keepFiles,
    }),
  }
}

function registryPlanLines(preflight: RegistryPreflight | null): string[] {
  return preflight ? [`shadcn: ${preflight.registryDependencies.join(', ')}`] : []
}

function installRegistryResults(
  preflight: RegistryPreflight | null,
): ReadonlyMap<string, ComponentResult> {
  return preflight ? installRegistryComponents(preflight) : new Map()
}

async function selectApplication(
  projectRoot: string,
  applications: readonly string[],
  requestedApplication: string | true | undefined,
): Promise<string> {
  if (requestedApplication) return resolveApplicationPath(projectRoot, requestedApplication)
  const [onlyApplication] = applications
  if (applications.length === 1 && onlyApplication) return onlyApplication
  return cancelled(
    await p.select({
      message: 'Application to enrich',
      options: applications.map((application) => {
        const path = relativeApplicationPath(projectRoot, application)
        return { value: application, label: path }
      }),
    }),
  )
}

export async function runAddition(args: ParsedArgs): Promise<void> {
  validateAdditionInvocation(args)
  const projectRoot = resolve(process.cwd())
  const applications = findCompatibleApplications(projectRoot)
  if (applications.length === 0) {
    p.cancel('No compatible application found in this project.')
    process.exit(1)
  }
  const requestedApplication = args.flags.app
  const explicitAddition = !!args._[1] || args.options.some(({ name }) => name === 'with')
  if (!requestedApplication && explicitAddition && applications.length > 1) {
    p.cancel(
      `Multiple compatible applications found: ${applications
        .map((application) => relativeApplicationPath(projectRoot, application))
        .join(', ')}. Pass --app <relative-path>.`,
    )
    process.exit(1)
  }
  const projectDir = await selectApplication(projectRoot, applications, requestedApplication)
  const applicationPath = relativeApplicationPath(projectRoot, projectDir)
  const packageManagerFlags = args.options
    .filter(({ name }) => name === 'pm' || name === 'package-manager')
    .map(({ value }) => value)
  if (packageManagerFlags.length > 1) {
    throw new Error(
      'Ambiguous package manager overrides: pass only one of --pm or --package-manager',
    )
  }
  const packageManagerFlag = packageManagerFlags[0]
  const pm = packageManagerFlag
    ? resolveExplicitPackageManager(packageManagerFlag)
    : detectProjectPackageManager(projectRoot, detectPackageManager())

  const selections = await resolveAddSelections(args)
  const module = requireFrameworkModule(projectDir)
  validateAdditions(module, selections)
  const keepFiles = !!args.flags['keep-files']
  const force = !!args.flags.force
  const components = selections.filter((selection) => selection.type === 'component')
  const capabilities = selections.filter((selection) => selection.type === 'capability')
  const providerChanges = capabilities
    .map((selection) => ({
      ...selection,
      from: currentTargetAdapter(projectDir, selection.cap),
    }))
    .filter(({ from, adapter }) => from && from !== adapter)
  if (force && components.length === 0) throw new Error('--force only applies to components')
  if (keepFiles && providerChanges.length === 0) {
    throw new Error('--keep-files only applies to provider changes')
  }

  const registryPreflight = preflightRegistryComponents({
    projectDir,
    pm,
    components,
    noInstall: !!args.flags['no-install'],
    force,
  })

  p.intro('create-stack add')
  const plan = [
    `Application: ${applicationPath}`,
    `Package manager: ${pm.name}`,
    ...selections.map((selection) =>
      selection.type === 'component'
        ? `Addition: component ${selection.name}`
        : `Addition: ${selection.name}${selection.adapter ? ` (${selection.adapter})` : ''}`,
    ),
    ...providerChanges.map(
      ({ name, from, adapter }) =>
        `Provider change: ${name} (${from} → ${adapter}${keepFiles ? ', keeping files' : ''})`,
    ),
    ...registryPlanLines(registryPreflight),
  ]
  p.note(plan.join('\n'), 'Addition plan')

  const registryResults = installRegistryResults(registryPreflight)
  const added = selections.map((selection) =>
    addSelection({ selection, projectDir, keepFiles, registryResults }),
  )
  if (!args.flags['no-install']) {
    runVerificationGate(module.gate(pm), {
      cwd: projectDir,
      packageManager: pm,
      requireSuccess: false,
    })
  }

  p.note(
    added
      .map((addition) =>
        addition.type === 'component' ? componentLine(addition) : addedLine(addition),
      )
      .join('\n'),
    'Added',
  )

  const steps = added.flatMap((a) => a.manualSteps.map((s) => `${a.name}: ${s}`))
  if (steps.length) p.note(steps.join('\n'), 'Finish by hand')

  p.outro(
    `Added ${added.map((a) => (a.type === 'component' ? `component ${a.name}` : a.name)).join(', ')}`,
  )
}
