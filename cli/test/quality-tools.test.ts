import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import type { Formatter, Linter } from '../../packages/stack-config/src/index.ts'
import { frameworkModules } from '../src/framework-registry.ts'
import { readField, readJson } from './json.ts'
import {
  combinations,
  generate,
  linkDependencies,
  repositoryRoot,
  shapes,
} from './quality-tools.ts'

test('generates the selected Prettier and Oxlint configurations and scripts', async () => {
  const projectDir = await generate('prettier', 'oxlint')

  expect(readJson(join(projectDir, '.prettierrc.json'))).toMatchObject({
    singleQuote: true,
    semi: false,
    printWidth: 100,
    plugins: ['@ianvs/prettier-plugin-sort-imports', 'prettier-plugin-tailwindcss'],
  })
  expect(readJson(join(projectDir, '.oxlintrc.json'))).toMatchObject({
    options: { typeAware: true },
    categories: { correctness: 'error', suspicious: 'error', pedantic: 'error', perf: 'error' },
  })
  expect(readJson(join(projectDir, 'package.json'))).toMatchObject({
    scripts: {
      'check:write': 'prettier --write . && oxlint --type-aware --fix .',
      check: 'prettier --check . && oxlint --type-aware .',
    },
    devDependencies: {
      prettier: '3.9.10',
      'prettier-plugin-tailwindcss': '0.8.1',
      '@ianvs/prettier-plugin-sort-imports': '4.7.1',
      oxlint: '1.89.0',
      'oxlint-tsgolint': '7.0.2004',
    },
  })
})

test.each(
  frameworkModules.flatMap((framework) =>
    ['#', '@storefront', 'customer'].map((alias) => ({ framework, alias })),
  ),
)(
  'Prettier groups the $alias application alias after packages in $framework.id',
  async ({ framework, alias }) => {
    const reference = framework.referenceApplication
    if (!reference) throw new Error('Missing reference application')
    const cwd = await generate('prettier', 'oxlint', framework.id, false, alias)
    linkDependencies(join(cwd, 'node_modules'), join(repositoryRoot, 'node_modules'))
    linkDependencies(join(cwd, 'node_modules'), join(reference.root, 'node_modules'))
    const path = 'src/invoice.ts'
    writeFileSync(
      join(cwd, path),
      `import { customer } from '${alias}/customer'\nimport { parse } from 'valibot'\nimport { payment } from '@storefront-payments/client'\nimport { invoice } from './invoice-data'\nexport { customer, parse, payment, invoice }\n`,
    )

    const result = spawnSync(
      join(repositoryRoot, 'node_modules/.bin/prettier'),
      ['--write', path],
      {
        cwd,
        encoding: 'utf8',
      },
    )

    expect(result.status, result.stdout + result.stderr).toBe(0)
    expect(readFileSync(join(cwd, path), 'utf8').match(/^import .*$/gm)).toEqual([
      "import { payment } from '@storefront-payments/client'",
      "import { parse } from 'valibot'",
      `import { customer } from '${alias}/customer'`,
      "import { invoice } from './invoice-data'",
    ])
  },
)

test.each(combinations)(
  '$formatter/$linter pre-commit preserves partially staged files and rejects the commit',
  async ({ formatter, linter }) => {
    const cwd = await generate(formatter, linter)
    const path = 'src/invoice total.ts'
    const staged = 'export const invoiceTotal = 1800\n'
    const working = `${staged}export const deliveryFee = 500\n`
    writeFileSync(join(cwd, path), staged)
    expect(spawnSync('git', ['init', '-q'], { cwd }).status).toBe(0)
    expect(spawnSync('git', ['add', '--', path], { cwd }).status).toBe(0)
    writeFileSync(join(cwd, path), working)

    const result = spawnSync('sh', ['.githooks/pre-commit'], { cwd, encoding: 'utf8' })

    expect(result.status, result.stdout + result.stderr).not.toBe(0)
    expect(result.stdout).toContain('unstaged changes')
    expect(readFileSync(join(cwd, path), 'utf8')).toBe(working)
    expect(spawnSync('git', ['show', `:${path}`], { cwd, encoding: 'utf8' }).stdout).toBe(staged)
  },
)

test.each(combinations)(
  '$formatter/$linter pre-commit formats and restages only staged files, including spaces',
  async ({ formatter, linter }) => {
    const cwd = await generate(formatter, linter)
    linkDependencies(join(cwd, 'node_modules'), join(repositoryRoot, 'node_modules'))
    linkDependencies(join(cwd, 'node_modules'), join(repositoryRoot, 'apps/next-base/node_modules'))
    const staged = 'src/invoice total.ts'
    const unstaged = 'src/customer.ts'
    writeFileSync(join(cwd, staged), 'export const invoiceTotal=1800\n')
    writeFileSync(join(cwd, unstaged), 'export const customerName="Alex Morgan"\n')
    expect(spawnSync('git', ['init', '-q'], { cwd }).status).toBe(0)
    expect(spawnSync('git', ['add', '--', staged], { cwd }).status).toBe(0)

    const result = spawnSync('sh', ['.githooks/pre-commit'], {
      cwd,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${join(repositoryRoot, 'node_modules/.bin')}:${process.env.PATH}`,
      },
    })

    expect(result.status, result.stdout + result.stderr).toBe(0)
    expect(readFileSync(join(cwd, staged), 'utf8')).toBe('export const invoiceTotal = 1800\n')
    expect(spawnSync('git', ['show', `:${staged}`], { cwd, encoding: 'utf8' }).stdout).toBe(
      'export const invoiceTotal = 1800\n',
    )
    expect(readFileSync(join(cwd, unstaged), 'utf8')).toBe(
      'export const customerName="Alex Morgan"\n',
    )
    expect(
      spawnSync('git', ['diff', '--cached', '--name-only'], { cwd, encoding: 'utf8' }).stdout,
    ).toBe(`${staged}\n`)
    writeFileSync(join(cwd, staged), 'debugger\nexport const invoiceTotal = 1800\n')
    expect(spawnSync('git', ['add', '--', staged], { cwd }).status).toBe(0)
    const rejected = spawnSync('sh', ['.githooks/pre-commit'], {
      cwd,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${join(repositoryRoot, 'node_modules/.bin')}:${process.env.PATH}`,
      },
    })
    expect(rejected.status, rejected.stdout + rejected.stderr).not.toBe(0)
  },
)

function expectBiomeConfiguration(projectDir: string, formatter: Formatter, linter: Linter): void {
  const config = readJson(join(projectDir, 'biome.jsonc'))
  expect(config).toMatchObject({
    formatter: { enabled: formatter === 'biome' },
    linter: { enabled: linter === 'biome' },
    assist: { enabled: formatter === 'biome' },
  })
  if (formatter === 'prettier')
    expect(config).toHaveProperty('linter.rules.nursery.useSortedClasses', 'off')
  for (const language of ['javascript', 'css']) {
    expect(config[language]).toMatchObject({
      formatter: { enabled: formatter === 'biome' },
      linter: { enabled: linter === 'biome' },
    })
  }
}

function expectPrettierZedSettings(projectDir: string, linter: Linter): void {
  const zed = readJson(join(projectDir, '.zed/settings.json'))
  expect(zed).toHaveProperty('languages.TypeScript.formatter.external.command', 'npx')
  const languages = readField(join(projectDir, '.zed/settings.json'), 'languages')
  if (linter === 'biome') {
    expect(zed.lsp).toHaveProperty('biome')
    expect(languages.TypeScript).toHaveProperty('code_actions_on_format', {
      'source.fixAll.biome': true,
    })
  } else {
    expect(zed.lsp).toBeUndefined()
    expect(languages.TypeScript).not.toHaveProperty('code_actions_on_format')
  }
}

function expectNoApplicationTools(applicationDir: string): void {
  for (const path of ['biome.jsonc', '.prettierrc.json', '.oxlintrc.json'])
    expect(existsSync(join(applicationDir, path))).toBe(false)
  const application = readField(join(applicationDir, 'package.json'), 'devDependencies')
  for (const dependency of ['@biomejs/biome', 'prettier', 'oxlint'])
    expect(application[dependency]).toBeUndefined()
}

test.each(
  frameworkModules.flatMap(({ id: framework }) =>
    shapes.flatMap((monorepo) => combinations.map((tools) => ({ framework, monorepo, ...tools }))),
  ),
)(
  'places $formatter/$linter at the correct level for $framework, monorepo=$monorepo',
  async ({ formatter, linter, framework, monorepo }) => {
    const projectDir = await generate(formatter, linter, framework, monorepo)
    const applicationDir = monorepo ? join(projectDir, 'apps/web') : projectDir
    const biome = formatter === 'biome' || linter === 'biome'
    expect(existsSync(join(projectDir, 'biome.jsonc'))).toBe(biome)
    expect(existsSync(join(projectDir, '.prettierrc.json'))).toBe(formatter === 'prettier')
    expect(existsSync(join(projectDir, '.oxlintrc.json'))).toBe(linter === 'oxlint')
    if (biome) expectBiomeConfiguration(projectDir, formatter, linter)
    const dependencies = readField(join(projectDir, 'package.json'), 'devDependencies')
    expect(Boolean(dependencies['@biomejs/biome'])).toBe(biome)
    expect(Boolean(dependencies.prettier)).toBe(formatter === 'prettier')
    expect(Boolean(dependencies.oxlint)).toBe(linter === 'oxlint')
    const editor = readField(join(projectDir, '.vscode/settings.json'), '[typescript]')
    expect(editor['editor.defaultFormatter']).toBe(
      formatter === 'prettier' ? 'esbenp.prettier-vscode' : 'biomejs.biome',
    )
    if (formatter === 'prettier') expectPrettierZedSettings(projectDir, linter)
    if (monorepo) expectNoApplicationTools(applicationDir)
  },
)
