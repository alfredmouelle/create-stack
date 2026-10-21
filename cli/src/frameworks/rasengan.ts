import { appendFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { FRAMEWORK_SUPPORT } from '@alfredmouelle/stack-config'
import type { FrameworkModule } from '../framework-module.ts'
import { readJsonObject, writeJsonObject } from '../javascript/json.ts'
import { declaresDependency } from '../javascript/package-manifest.ts'
import { assembleProject } from '../javascript/project-assembly.ts'
import { applyJavaScriptQualityProfile } from '../javascript/quality-profile.ts'
import { packageScriptGate } from '../javascript/verification-gate.ts'
import { appendRawEnvLines } from '../lib/env.ts'
import { PM_VERSIONS } from '../lib/package-manager.ts'
import { rasenganAdditions } from './rasengan-additions.ts'
import { rasenganReference } from './rasengan-parts.ts'

const { label, maturity, monorepoOutputs } = FRAMEWORK_SUPPORT.rasengan

export const rasenganModule: FrameworkModule = {
  id: 'rasengan',
  label,
  maturity,
  detect: (applicationDir) =>
    declaresDependency(applicationDir, ['rasengan']) &&
    !declaresDependency(applicationDir, [
      'next',
      '@tanstack/react-start',
      '@tanstack/react-router',
    ]),
  assemble: async (request) => {
    const result = await assembleProject(request, {
      reference: rasenganReference,
      additions: rasenganAdditions,
      monorepoOutputs,
    })
    if ('error-tracking' in request.capabilities)
      appendRawEnvLines(result.applicationDir, ['RASENGAN_SENTRY_DSN='])
    if (request.packageManager.name === 'yarn') {
      writeFileSync(join(request.projectDir, '.yarnrc.yml'), 'nodeLinker: node-modules\n')
      const manifestPath = join(request.projectDir, 'package.json')
      writeJsonObject(manifestPath, {
        ...readJsonObject(manifestPath),
        packageManager: `yarn@${PM_VERSIONS.yarn}`,
      })
    }
    appendFileSync(
      join(request.projectDir, 'README.md'),
      '\n## RasenganJS preview\n\nThis framework uses pinned beta packages on Node. Build with the package.json build script, then run its start script. Deploy dist, public, scripts/start.ts, package.json, and installed production dependencies together. Set PORT and HOST on the host. The application-owned server publishes only browser and public assets. Keep private modules in API routes; page loaders fetch session data over HTTP. Hosted integrations require provider credentials.\n',
    )
    return result
  },
  additions: rasenganAdditions,
  gate: packageScriptGate,
  monorepoOutputs,
  packagedAssets: ['apps/rasengan-base'],
  assetExcludes: ['.rasengan', '.data'],
  qualityProfileExceptions: [],
  applyQualityProfile: applyJavaScriptQualityProfile,
  referenceApplication: rasenganReference,
}
