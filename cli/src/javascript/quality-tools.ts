import { cpSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { TEMPLATES } from '#lib/paths.mjs'
import type { Formatter, Linter } from '../../../packages/stack-config/src/index.ts'
import type { QualityProfileRequest } from '../framework-module.ts'
import { isJsonObject, readJsonObject, writeJsonObject } from './json.ts'

export type QualityTools = Pick<QualityProfileRequest, 'formatter' | 'linter' | 'alias'>

type QualityToolsTarget = Pick<QualityProfileRequest, 'projectDir' | 'applicationDir'>

const TOOL_PARTS = {
  biome: { '@biomejs/biome': '2.5.15' },
  prettier: {
    prettier: '3.9.10',
    'prettier-plugin-tailwindcss': '0.8.1',
    '@ianvs/prettier-plugin-sort-imports': '4.7.1',
  },
  oxlint: { oxlint: '1.89.0', 'oxlint-tsgolint': '7.0.2004' },
} as const satisfies Readonly<Record<Formatter | Linter, Readonly<Record<string, string>>>>

function configureManifest(
  directory: string,
  tools: QualityTools,
  { projectDir, applicationDir }: QualityToolsTarget,
): void {
  const path = join(directory, 'package.json')
  const manifest = readJsonObject(path)
  const dependencies = isJsonObject(manifest.devDependencies) ? manifest.devDependencies : {}
  for (const part of Object.values(TOOL_PARTS)) {
    for (const name of Object.keys(part)) delete dependencies[name]
  }
  if (directory === projectDir) {
    Object.assign(dependencies, TOOL_PARTS[tools.formatter], TOOL_PARTS[tools.linter])
  }
  const scripts = isJsonObject(manifest.scripts) ? manifest.scripts : {}
  if (directory === applicationDir) {
    scripts['check:write'] = qualityCommand(tools, true, { projectDir, applicationDir })
    scripts.check = qualityCommand(tools, false, { projectDir, applicationDir })
  }
  if (tools.formatter !== 'biome' || tools.linter !== 'biome') delete scripts['check:unsafe']
  writeJsonObject(path, { ...manifest, scripts, devDependencies: dependencies })
}

function qualityCommand(
  { formatter, linter }: QualityTools,
  fix: boolean,
  { projectDir, applicationDir }: QualityToolsTarget,
): string {
  if (formatter === 'biome' && linter === 'biome') return `biome check${fix ? ' --write' : ''} .`
  const format =
    formatter === 'prettier'
      ? `prettier --${fix ? 'write' : 'check'} .${applicationDir === projectDir ? '' : ` --ignore-path ${relative(applicationDir, projectDir)}/.prettierignore`}`
      : `biome check${fix ? ' --write' : ''} .`
  const lint =
    linter === 'oxlint'
      ? `oxlint --type-aware${fix ? ' --fix' : ''} .`
      : `biome lint${fix ? ' --write' : ''} .`
  return `${format} && ${lint}`
}

function configureBiome(projectDir: string, { formatter, linter }: QualityTools): void {
  const config = readJsonObject(join(TEMPLATES, 'biome.jsonc'))
  const enabled = { formatter: formatter === 'biome', linter: linter === 'biome' }
  for (const section of [config, config.html, config.javascript, config.css]) {
    if (!isJsonObject(section)) continue
    for (const role of ['formatter', 'linter', 'assist'] as const) {
      if (isJsonObject(section[role]))
        section[role].enabled = role === 'assist' ? enabled.formatter : enabled[role]
    }
  }
  if (formatter === 'prettier' && isJsonObject(config.linter)) {
    const rules = config.linter.rules
    if (isJsonObject(rules) && isJsonObject(rules.nursery)) rules.nursery.useSortedClasses = 'off'
  }
  writeJsonObject(join(projectDir, 'biome.jsonc'), config)
}

function configureHook(projectDir: string, { formatter, linter }: QualityTools): void {
  const commands = []
  if (formatter === 'biome' || linter === 'biome')
    commands.push('biome check --write --no-errors-on-unmatched')
  if (formatter === 'prettier') commands.unshift('prettier --write --ignore-unknown')
  if (linter === 'oxlint')
    commands.push('oxlint --type-aware --fix --no-error-on-unmatched-pattern')
  const script = readFileSync(join(TEMPLATES, 'quality-profile/.githooks/pre-commit'), 'utf8')
  const checks = commands
    .map(
      (command) =>
        `if ! git diff --cached --name-only --diff-filter=ACMR -z | xargs -0 npx --no-install ${command} --; then\n  status=1\nfi`,
    )
    .join('\n')
  writeFileSync(
    join(projectDir, '.githooks/pre-commit'),
    script.replace('__QUALITY_COMMANDS__', checks),
  )
}

function configureEditors(projectDir: string, linter: Linter): void {
  const vscodePath = join(projectDir, '.vscode/settings.json')
  const vscode = readJsonObject(vscodePath)
  for (const section of Object.values(vscode)) {
    if (isJsonObject(section) && section['editor.defaultFormatter'] === 'biomejs.biome')
      section['editor.defaultFormatter'] = 'esbenp.prettier-vscode'
  }
  vscode['editor.codeActionsOnSave'] = {}
  writeJsonObject(vscodePath, vscode)

  const zedPath = join(projectDir, '.zed/settings.json')
  const zed = readJsonObject(zedPath)
  if (linter !== 'biome') delete zed.lsp
  if (isJsonObject(zed.languages)) {
    for (const language of Object.values(zed.languages)) {
      if (!isJsonObject(language)) continue
      language.formatter = {
        external: {
          command: 'npx',
          arguments: ['--no-install', 'prettier', '--stdin-filepath', '{buffer_path}'],
        },
      }
      if (linter === 'biome' && isJsonObject(language.code_actions_on_format))
        delete language.code_actions_on_format['source.organizeImports.biome']
      else delete language.code_actions_on_format
    }
  }
  writeJsonObject(zedPath, zed)
}

export function applyQualityTools(
  { projectDir, applicationDir }: QualityToolsTarget,
  tools: QualityTools,
): void {
  const target = { projectDir, applicationDir }
  configureManifest(projectDir, tools, target)
  if (applicationDir !== projectDir) configureManifest(applicationDir, tools, target)
  configureHook(projectDir, tools)
  if (tools.formatter === 'prettier') {
    configureEditors(projectDir, tools.linter)
    const config = readJsonObject(join(TEMPLATES, 'quality-profile/.prettierrc.json'))
    const alias = tools.alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    config.importOrder = ['<BUILTIN_MODULES>', '<THIRD_PARTY_MODULES>', `^${alias}/`, '^[.]']
    const components = readJsonObject(join(applicationDir, 'components.json'))
    const stylesheet = isJsonObject(components.tailwind) ? components.tailwind.css : undefined
    if (typeof stylesheet === 'string')
      config.tailwindStylesheet = join(relative(projectDir, applicationDir), stylesheet)
    writeJsonObject(join(projectDir, '.prettierrc.json'), config)
    cpSync(join(TEMPLATES, 'quality-profile/.prettierignore'), join(projectDir, '.prettierignore'))
  }
  if (tools.linter === 'oxlint')
    cpSync(join(TEMPLATES, 'quality-profile/.oxlintrc.json'), join(projectDir, '.oxlintrc.json'))
  if (tools.formatter === 'biome' || tools.linter === 'biome') configureBiome(projectDir, tools)
  else rmSync(join(projectDir, 'biome.jsonc'), { force: true })
}
