import { cpSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { TEMPLATES } from '#lib/paths.ts'
import type { Formatter, Linter } from '../../../packages/stack-config/src/index.ts'
import type { QualityProfileRequest } from '../framework-module.ts'
import { isJsonObject, type JsonObject, readJsonObject, writeJsonObject } from './json.ts'

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

const flag = (fix: boolean, value: string): string => (fix ? ` ${value}` : '')

function formatCommand(
  formatter: Formatter,
  fix: boolean,
  { projectDir, applicationDir }: QualityToolsTarget,
): string {
  if (formatter === 'biome') return `biome check${flag(fix, '--write')} .`
  const ignorePath =
    applicationDir === projectDir
      ? ''
      : ` --ignore-path ${relative(applicationDir, projectDir)}/.prettierignore`
  return `prettier --${fix ? 'write' : 'check'} .${ignorePath}`
}

const lintCommand = (linter: Linter, fix: boolean): string =>
  linter === 'oxlint'
    ? `oxlint --type-aware${flag(fix, '--fix')} .`
    : `biome lint${flag(fix, '--write')} .`

function qualityCommand(
  { formatter, linter }: QualityTools,
  fix: boolean,
  target: QualityToolsTarget,
): string {
  const format = formatCommand(formatter, fix, target)
  if (formatter === 'biome' && linter === 'biome') return format
  return `${format} && ${lintCommand(linter, fix)}`
}

function enableBiomeRoles(section: unknown, enabled: Readonly<Record<string, boolean>>): void {
  if (!isJsonObject(section)) return
  for (const [role, value] of Object.entries(enabled)) {
    const settings = section[role]
    if (isJsonObject(settings)) settings.enabled = value
  }
}

function disableSortedClasses(config: JsonObject): void {
  const rules = isJsonObject(config.linter) ? config.linter.rules : undefined
  if (isJsonObject(rules) && isJsonObject(rules.nursery)) rules.nursery.useSortedClasses = 'off'
}

function configureBiome(projectDir: string, { formatter, linter }: QualityTools): void {
  const config = readJsonObject(join(TEMPLATES, 'biome.jsonc'))
  const enabled = {
    formatter: formatter === 'biome',
    linter: linter === 'biome',
    assist: formatter === 'biome',
  }
  for (const section of [config, config.html, config.javascript, config.css])
    enableBiomeRoles(section, enabled)
  if (formatter === 'prettier') disableSortedClasses(config)
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

function configureVscode(projectDir: string): void {
  const path = join(projectDir, '.vscode/settings.json')
  const vscode = readJsonObject(path)
  for (const section of Object.values(vscode)) {
    if (isJsonObject(section) && section['editor.defaultFormatter'] === 'biomejs.biome')
      section['editor.defaultFormatter'] = 'esbenp.prettier-vscode'
  }
  vscode['editor.codeActionsOnSave'] = {}
  writeJsonObject(path, vscode)
}

function formatZedLanguageWithPrettier(language: JsonObject, linter: Linter): void {
  language.formatter = {
    external: {
      command: 'npx',
      arguments: ['--no-install', 'prettier', '--stdin-filepath', '{buffer_path}'],
    },
  }
  const actions = language.code_actions_on_format
  if (linter === 'biome' && isJsonObject(actions)) delete actions['source.organizeImports.biome']
  else delete language.code_actions_on_format
}

function configureZed(projectDir: string, linter: Linter): void {
  const path = join(projectDir, '.zed/settings.json')
  const zed = readJsonObject(path)
  if (linter !== 'biome') delete zed.lsp
  const languages = isJsonObject(zed.languages) ? Object.values(zed.languages) : []
  for (const language of languages.filter(isJsonObject))
    formatZedLanguageWithPrettier(language, linter)
  writeJsonObject(path, zed)
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
    configureVscode(projectDir)
    configureZed(projectDir, tools.linter)
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
