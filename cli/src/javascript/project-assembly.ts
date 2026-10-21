import { randomBytes } from 'node:crypto'
import { join } from 'node:path'
import { writeCiWorkflow } from '#lib/ci.ts'
import {
  isSqlDatabase,
  localDatabaseUrl,
  localTestDatabaseUrl,
  writeDatabaseScript,
} from '#lib/database.ts'
import { appendRawEnvLines, writeEnv } from '#lib/env.ts'
import { creationMetadata, packageName, stampIdentity } from '#lib/identity.ts'
import { pkgAddDeps } from '#lib/util.ts'
import type {
  AdditionWiring,
  AssemblyRequest,
  AssemblyResult,
  CapabilitySelection,
  FrameworkModule,
} from '../framework-module.ts'
import type { ReferenceApplication } from '../reference-application.ts'
import { rewriteAlias } from './import-alias.ts'
import { readJsonObject, writeJsonObject } from './json.ts'
import { wrapMonorepo } from './monorepo.ts'
import { assembleReferenceParts } from './project-parts.ts'

export type JavaScriptProject = Pick<FrameworkModule, 'additions' | 'monorepoOutputs'> & {
  readonly reference: ReferenceApplication
}

type CapabilityWiring = {
  readonly addDeps: Record<string, string>
  readonly envKeys: string[]
  readonly requiredEnvKeys: string[]
  readonly manualSteps: string[]
}

function wireCapabilities(
  capabilities: CapabilitySelection,
  additions: AdditionWiring,
  applicationDir: string,
  projectName: string,
): CapabilityWiring {
  const wiring: CapabilityWiring = {
    addDeps: {},
    envKeys: [],
    requiredEnvKeys: [],
    manualSteps: [],
  }
  for (const [cap, adapter] of Object.entries(capabilities)) {
    const capability = additions.capabilities[cap]
    if (!capability) throw new Error(`Unsupported capability: ${cap}`)
    const result = capability.apply({
      projectDir: applicationDir,
      projectName,
      adapter,
      keep: false,
    })
    Object.assign(wiring.addDeps, result.addDeps)
    wiring.envKeys.push(...result.envKeys)
    wiring.requiredEnvKeys.push(...result.requiredEnvKeys)
    wiring.manualSteps.push(...result.manualSteps.map((step) => `${cap}: ${step}`))
  }
  return wiring
}

function localEnvironment(request: AssemblyRequest, projectName: string) {
  const hasDatabase = isSqlDatabase(request.database)
  return {
    local: {
      ...(hasDatabase ? { DATABASE_URL: localDatabaseUrl(projectName) } : {}),
      ...(request.auth === 'better-auth'
        ? { BETTER_AUTH_SECRET: randomBytes(32).toString('base64url') }
        : {}),
    },
    test: hasDatabase ? { DATABASE_URL: localTestDatabaseUrl(projectName) } : null,
  }
}

function describeApplication(
  applicationDir: string,
  projectName: string,
  addDeps: Record<string, string>,
) {
  const path = join(applicationDir, 'package.json')
  const manifest = readJsonObject(path)
  manifest.description = `${projectName}: a fully-wired app scaffolded with create-stack.`
  pkgAddDeps(manifest, addDeps)
  writeJsonObject(path, manifest)
}

export function assembleProject(
  request: AssemblyRequest,
  { reference, additions, monorepoOutputs }: JavaScriptProject,
): Promise<AssemblyResult> {
  const { projectDir, database, auth, capabilities, alias, monorepo, packageManager: pm } = request
  const projectName = packageName(projectDir)
  const hasDatabase = isSqlDatabase(database)
  const hasDatabaseSchema =
    database === 'prisma' || (database === 'drizzle' && auth === 'better-auth')
  const appDir = monorepo ? join(projectDir, 'apps', 'web') : projectDir

  const initialized = assembleReferenceParts(reference, {
    applicationDir: appDir,
    projectName: monorepo ? 'web' : projectName,
    database,
    auth,
    trpc: request.trpc,
    mailer: request.mailer,
    monorepo,
    packageManager: pm,
  })
  const wired = wireCapabilities(capabilities, additions, appDir, projectName)
  describeApplication(appDir, projectName, wired.addDeps)

  const environment = localEnvironment(request, projectName)
  writeEnv(
    appDir,
    [...initialized.envKeys, ...wired.envKeys],
    [...initialized.requiredEnvKeys, ...wired.requiredEnvKeys],
    environment.local,
    environment.test,
  )
  if (initialized.envLines.length) appendRawEnvLines(appDir, initialized.envLines)

  const metadata = creationMetadata()
  const identity = { hasDatabase, hasDatabaseSchema, database, metadata }
  stampIdentity(appDir, projectName, pm, identity)
  writeCiWorkflow(projectDir, pm, monorepo ? 'apps/web/.nvmrc' : '.nvmrc')
  rewriteAlias(appDir, alias)

  if (monorepo)
    wrapMonorepo({
      rootDir: projectDir,
      appDir,
      projectName,
      outputs: monorepoOutputs,
      pm,
      tool: monorepo,
      database,
      hasDatabase,
      hasDatabaseSchema,
      metadata,
      appNativeBuilds: initialized.nativeBuilds,
    })

  if (hasDatabase) writeDatabaseScript({ projectDir, envPath: monorepo ? 'apps/web/.env' : '.env' })

  return Promise.resolve({ applicationDir: appDir, manualSteps: wired.manualSteps })
}
