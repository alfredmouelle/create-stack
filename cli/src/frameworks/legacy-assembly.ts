import { join } from 'node:path'
import type { Framework } from '../../../packages/stack-config/src/index.ts'
import type { AssemblyRequest, AssemblyResult } from '../framework-module.ts'

export const assembleWithLegacyBuild =
  (framework: Framework) =>
  async (request: AssemblyRequest): Promise<AssemblyResult> => {
    const [{ buildProject }, { packageName }] = await Promise.all([
      import('#lib/build.mjs'),
      import('#lib/identity.mjs'),
    ])
    const built = buildProject({
      projectDir: request.projectDir,
      projectName: packageName(request.projectDir),
      framework,
      trpc: request.trpc,
      database: request.database,
      auth: request.auth,
      mailerProvider: request.mailer,
      capabilities: request.capabilities,
      alias: request.alias,
      monorepo: request.monorepo,
      pm: request.packageManager,
    })
    return {
      applicationDir: request.monorepo
        ? join(request.projectDir, 'apps', 'web')
        : request.projectDir,
      manualSteps: built.manualSteps,
    }
  }
