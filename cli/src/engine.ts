import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import * as p from '@clack/prompts'
import { canonicalCapabilityName } from '#lib/capabilities.mjs'
import {
  type Formatter,
  FRAMEWORK_SUPPORT,
  type Framework,
  type Linter,
  type StackAxis,
} from '../../packages/stack-config/src/index.ts'
import type {
  AssemblyRequest,
  CapabilitySelection,
  Command,
  FrameworkModule,
  PackageManager,
  VerificationGate,
} from './framework-module.ts'
import { getFrameworkModule } from './framework-registry.ts'
import { applyQualityProfile } from './quality-profile.ts'

export type CreationRequest = Omit<AssemblyRequest, 'projectDir'> & {
  readonly cwd: string
  readonly target: string
  readonly name: string
  readonly framework: Framework
  readonly formatter: Formatter
  readonly linter: Linter
  readonly selectionReasons: Readonly<Partial<Record<StackAxis, string>>>
  readonly install: boolean
  readonly git: boolean
}

type CreationPlan = AssemblyRequest &
  CreationRequest & {
    readonly module: FrameworkModule
  }

export type GateOptions = {
  readonly cwd: string
  readonly packageManager: Pick<PackageManager, 'name'>
  readonly requireSuccess: boolean
}

const VERIFICATION_FAILED = 'Verification failed; the initial commit was skipped'

const MONOREPO_LABELS = { turborepo: 'Turborepo', nx: 'Nx' } as const

const runCommand = (
  { command, args }: Command,
  cwd: string,
  stdio: 'inherit' | 'ignore',
): boolean => spawnSync(command, args, { cwd, stdio }).status === 0

const runGit = (args: readonly string[], stdio: 'inherit' | 'ignore' = 'inherit'): boolean =>
  spawnSync('git', args, { stdio }).status === 0

export function runVerificationGate(
  gate: VerificationGate,
  { cwd, packageManager, requireSuccess }: GateOptions,
): void {
  p.log.step(`${packageManager.name} install`)
  const installed = runCommand(gate.install, cwd, 'inherit')
  if (!installed && requireSuccess) {
    throw new Error(
      `${packageManager.name} install failed; verification and the initial commit were skipped`,
    )
  }
  const formatted = runCommand(gate.format, cwd, 'ignore')
  if (!formatted && requireSuccess) throw new Error(VERIFICATION_FAILED)
  p.log.step('Verifying (typecheck + biome)')
  const typechecked = runCommand(gate.typecheck, cwd, 'inherit')
  const linted = runCommand(gate.lint, cwd, 'inherit')
  const verified = typechecked && linted
  if (!verified && requireSuccess) throw new Error(VERIFICATION_FAILED)
  if (verified) p.log.success('typecheck + biome clean')
  else p.log.warn('verify reported issues (see output above)')
}

const isDirEmpty = (directory: string): boolean =>
  !existsSync(directory) || readdirSync(directory).length === 0

function resolveCreationPlan(request: CreationRequest): CreationPlan {
  const projectDir = resolve(request.cwd, request.target)
  if (!isDirEmpty(projectDir)) throw new Error(`Target directory is not empty: ${projectDir}`)
  return { ...request, projectDir, module: getFrameworkModule(request.framework) }
}

const orNone = (value: string): string => (value && value !== 'none' ? value : '(none)')

const capabilityLines = (capabilities: CapabilitySelection): string[] =>
  Object.entries(capabilities).map(([capability, provider]) =>
    provider
      ? `${canonicalCapabilityName(capability)} (${provider})`
      : canonicalCapabilityName(capability),
  )

function creationPlanLines(plan: CreationPlan): string[] {
  const capabilities = capabilityLines(plan.capabilities)
  const reason = (axis: StackAxis) =>
    plan.selectionReasons[axis] ? `, ${plan.selectionReasons[axis]}` : ''
  return [
    `Target: ${plan.target}`,
    `Framework: ${FRAMEWORK_SUPPORT[plan.framework].label}`,
    `Monorepo: ${plan.monorepo ? MONOREPO_LABELS[plan.monorepo] : '(none)'}`,
    `Package manager: ${plan.packageManager.name}`,
    `Import alias: ${plan.alias}/`,
    `Database: ${orNone(plan.database)}${reason('database')}`,
    `Auth: ${orNone(plan.auth)}${reason('auth')}`,
    `tRPC: ${plan.trpc ? 'yes' : 'no'}${reason('trpc')}`,
    `Mailer: ${orNone(plan.mailer)}${reason('mailer')}`,
    `Formatter: ${plan.formatter}${reason('formatter')}`,
    `Linter: ${plan.linter}${reason('linter')}`,
    `Capabilities: ${capabilities.join(', ') || '(none)'}${capabilities.length ? ', requested' : ''}`,
    `Install and verify: ${plan.install ? 'yes' : 'no'}`,
    `Initialize Git: ${plan.git ? 'yes (outside an existing repository)' : 'no'}`,
  ]
}

function localDatabaseSummaryLines(plan: CreationPlan): string[] {
  if (plan.database !== 'drizzle' && plan.database !== 'prisma') return []
  const lines = ['  ./start-database.sh  # start local PostgreSQL']
  if (plan.database === 'prisma' || plan.auth === 'better-auth') {
    const { name } = plan.packageManager
    lines.push(
      `  ${name === 'npm' ? 'npm run db:push' : `${name} db:push`}  # apply the database schema`,
    )
  }
  return lines
}

function summaryLines(plan: CreationPlan): string[] {
  const { packageManager } = plan
  const lines = [
    `Framework: ${FRAMEWORK_SUPPORT[plan.framework].label}`,
    `Monorepo: ${plan.monorepo ? `${MONOREPO_LABELS[plan.monorepo]} (app in apps/web)` : '(none)'}`,
    `Package manager: ${packageManager.name}`,
    `Import alias: ${plan.alias}/`,
    `Database: ${orNone(plan.database)}`,
    `Auth: ${orNone(plan.auth)}`,
    `tRPC: ${plan.trpc ? 'yes' : 'no'}`,
    `Mailer: ${orNone(plan.mailer)}`,
    `Formatter: ${plan.formatter}`,
    `Linter: ${plan.linter}`,
    `Capabilities: ${capabilityLines(plan.capabilities).join(', ') || '(none)'}`,
    '',
    'Add more tools later: create-stack add <capability>.',
    '',
    'Next:',
    `  cd ${plan.target}`,
  ]
  if (!plan.install) lines.push(`  ${packageManager.name} install`)
  if (plan.database === 'convex') {
    const prefix = plan.monorepo ? 'cd apps/web && ' : ''
    lines.push(
      `  ${prefix}${packageManager.name} run convex  # provisions a deployment + sets CONVEX_URL`,
    )
  }
  lines.push(...localDatabaseSummaryLines(plan))
  lines.push(
    `  # edit ${plan.monorepo ? 'apps/web/' : ''}.env (generated with local defaults)`,
    `  ${packageManager.devCmd}`,
  )
  return lines
}

function initGitRepository(projectDir: string): boolean {
  const insideRepository = spawnSync('git', ['-C', projectDir, 'rev-parse', '--show-toplevel'], {
    encoding: 'utf8',
  })
  if (insideRepository.status === 0 && insideRepository.stdout.trim()) {
    p.log.step('existing git repository detected (initialization skipped)')
    return false
  }
  if (!runGit(['-C', projectDir, 'init', '-q'])) return false
  runGit(['-C', projectDir, 'config', 'core.hooksPath', '.githooks'])
  p.log.step('git repository initialized')
  return true
}

function commitInitialBaseline(projectDir: string): void {
  runGit(['-C', projectDir, 'add', '-A'])
  const message = 'chore: initial commit from create-stack'
  const committed = runGit(
    ['-C', projectDir, 'commit', '--no-verify', '-q', '-m', message],
    'ignore',
  )
  p.log.step(
    committed
      ? 'initial commit created'
      : 'set git user.name/email, then commit the generated baseline',
  )
}

export async function createProject(request: CreationRequest): Promise<void> {
  const plan = resolveCreationPlan(request)

  p.note(creationPlanLines(plan).join('\n'), 'Creation plan')

  const spinner = p.spinner()
  spinner.start('Assembling the selected stack parts')
  const {
    cwd,
    target,
    name,
    framework,
    formatter,
    linter,
    selectionReasons,
    install,
    git,
    module,
    ...assembly
  } = plan
  const assembled = await module.assemble(assembly)
  applyQualityProfile(
    {
      label: FRAMEWORK_SUPPORT[framework].label,
      qualityProfileExceptions: module.qualityProfileExceptions,
    },
    { projectDir: assembly.projectDir, applicationDir: assembled.applicationDir },
  )
  spinner.stop('Project scaffolded')

  const initializedGit = git && initGitRepository(assembly.projectDir)

  if (install) {
    runVerificationGate(module.gate(assembly.packageManager), {
      cwd: assembly.projectDir,
      packageManager: assembly.packageManager,
      requireSuccess: true,
    })
    if (initializedGit) commitInitialBaseline(assembly.projectDir)
  } else {
    p.log.warn('Installation and verification skipped; no automatic commit was created')
  }

  p.note(summaryLines(plan).join('\n'), 'Done')
  if (assembled.manualSteps.length) p.note(assembled.manualSteps.join('\n'), 'Finish by hand')
  p.outro(`Created ${name}`)
}
