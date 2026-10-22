import { join, relative } from 'node:path'
import type { QualityProfileRequest } from '../framework-module.ts'
import { isJsonObject, readJsonObject, writeJsonObject } from '../javascript/json.ts'
import { applyJavaScriptQualityProfile } from '../javascript/quality-profile.ts'

export const nativeOxlintOverrides = [
  {
    rule: 'react/display-name',
    reason:
      'Remix component factories return render closures rather than React components with displayName.',
  },
  {
    rule: 'react/checked-requires-onchange-or-readonly',
    reason:
      'Remix controlled inputs register change handlers through mix and on, rather than the React onChange prop.',
  },
] as const

export function applyRemixQualityProfile(request: QualityProfileRequest): void {
  applyJavaScriptQualityProfile({ ...request, tailwindStylesheet: 'src/styles.css' })
  if (request.linter !== 'oxlint') return
  const path = join(request.projectDir, '.oxlintrc.json')
  const config = readJsonObject(path)
  if (!isJsonObject(config.rules)) throw new Error('Missing Oxlint rules')
  const rule = config.rules['typescript/prefer-readonly-parameter-types']
  const settings = Array.isArray(rule) ? rule[1] : undefined
  if (!isJsonObject(settings) || !Array.isArray(settings.allow))
    throw new Error('Missing readonly parameter configuration')
  settings.allow.push(
    {
      from: 'lib',
      name: ['Response', 'FormData', 'HTMLDialogElement', 'HTMLElement', 'KeyboardEvent'],
    },
    { from: 'package', package: 'remix', name: ['Handle', 'RemixNode', 'Router'] },
    { from: 'package', package: '@remix-run/component', name: ['Handle', 'RemixNode'] },
    { from: 'package', package: '@remix-run/fetch-router', name: 'Router' },
  )
  const prefix = relative(request.projectDir, request.applicationDir)
  config.overrides = [
    {
      files: [
        'src/client/**',
        'src/components/**',
        'src/pages/**',
        'src/server/better-auth/pages.tsx',
      ].map((file) => join(prefix, file)),
      rules: Object.fromEntries(nativeOxlintOverrides.map(({ rule }) => [rule, 'off'])),
    },
  ]
  writeJsonObject(path, config)
}
