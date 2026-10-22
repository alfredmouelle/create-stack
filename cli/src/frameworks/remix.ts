import { appendFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { FRAMEWORK_SUPPORT } from '@alfredmouelle/stack-config'
import type { FrameworkModule } from '../framework-module.ts'
import { isJsonObject, readJsonObject, writeJsonObject } from '../javascript/json.ts'
import { declaresDependency } from '../javascript/package-manifest.ts'
import { assembleProject } from '../javascript/project-assembly.ts'
import { readTemplate } from '../javascript/reference-parts.ts'
import { packageScriptGate } from '../javascript/verification-gate.ts'
import { PM_VERSIONS } from '../lib/package-manager.ts'
import { remixAdditions } from './remix-additions.ts'
import { remixReference } from './remix-parts.ts'
import { applyRemixQualityProfile } from './remix-quality.ts'

const { label, maturity, monorepoOutputs } = FRAMEWORK_SUPPORT.remix

function detect(applicationDir: string): boolean {
  try {
    const manifest = readJsonObject(join(applicationDir, 'package.json'))
    const dependency = [manifest.dependencies, manifest.devDependencies].flatMap((field) =>
      isJsonObject(field) && typeof field.remix === 'string' ? [field.remix] : [],
    )
    return (
      dependency.some((version) => /^[~^]?3\.\d+\.\d+$/.test(version)) &&
      ![manifest.dependencies, manifest.devDependencies].some(
        (field) =>
          isJsonObject(field) &&
          Object.keys(field).some(
            (name) => name === 'react-router-dom' || name.startsWith('@react-router/'),
          ),
      ) &&
      !declaresDependency(applicationDir, [
        'next',
        '@tanstack/react-start',
        '@tanstack/react-router',
        'rasengan',
        '@remix-run/react',
        '@remix-run/node',
        '@remix-run/dev',
        '@remix-run/serve',
        '@remix-run/server-runtime',
        '@remix-run/css-bundle',
        'react-router',
        '@react-router/dev',
      ])
    )
  } catch {
    return false
  }
}

export const remixModule: FrameworkModule = {
  id: 'remix',
  label,
  maturity,
  detect,
  assemble: async (request) => {
    const result = await assembleProject(request, {
      reference: remixReference,
      additions: remixAdditions,
      monorepoOutputs,
    })
    if (request.packageManager.name === 'yarn') {
      writeFileSync(join(request.projectDir, '.yarnrc.yml'), 'nodeLinker: node-modules\n')
      const path = join(request.projectDir, 'package.json')
      writeJsonObject(path, { ...readJsonObject(path), packageManager: `yarn@${PM_VERSIONS.yarn}` })
    }
    const command = `${request.packageManager.exec} run`
    appendFileSync(
      join(request.projectDir, 'README.md'),
      `\n${readTemplate('remix/readme.md').replaceAll('__RUN__', command)}`,
    )
    return result
  },
  additions: remixAdditions,
  gate: packageScriptGate,
  monorepoOutputs,
  packagedAssets: ['apps/remix-base'],
  assetExcludes: ['.cache', '.data', '.remix', '.convex'],
  qualityProfileExceptions: [],
  applyQualityProfile: applyRemixQualityProfile,
  referenceApplication: remixReference,
}
