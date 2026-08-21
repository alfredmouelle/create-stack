import { detectFramework } from './add.mjs'
import { detectAlias, rewriteAlias } from './alias.mjs'
import { STACK_ROOT } from './paths.mjs'
import { COMPONENT_CATALOG } from './registry.mjs'
import { copy, exists, join, pkgAddDeps, read, readJSON, write, writeJSON } from './util.mjs'

export const COMPONENTS = {
  'date-picker': {
    label: 'Date picker',
    hint: 'single + range, calendar, popover',
    files: [
      ...COMPONENT_CATALOG['date-picker'].files.map(({ destination }) => destination),
      ...COMPONENT_CATALOG['date-picker'].legacyFiles,
    ],
    deps: COMPONENT_CATALOG['date-picker'].legacyDependencies,
  },
  'data-table': {
    label: 'Data table',
    hint: 'sortable + infinite TanStack tables + useDataTable',
    files: COMPONENT_CATALOG['data-table'].files.map(({ destination }) => destination),
    deps: COMPONENT_CATALOG['data-table'].legacyDependencies,
  },
  confirm: {
    label: 'Confirm',
    hint: 'await a yes/no confirmation',
    files: ['src/components/ui/confirm.tsx', 'src/components/ui/alert-dialog.tsx'],
    deps: ['react-call'],
    root: { name: 'Confirm', module: 'components/ui/confirm' },
  },
  alert: {
    label: 'Alert',
    hint: 'await an acknowledgement',
    files: ['src/components/ui/alert.tsx', 'src/components/ui/alert-dialog.tsx'],
    deps: ['react-call'],
    root: { name: 'Alert', module: 'components/ui/alert' },
  },
  prompt: {
    label: 'Prompt',
    hint: 'await a text input',
    files: ['src/components/ui/prompt.tsx', 'src/components/ui/dialog.tsx'],
    deps: ['react-call'],
    root: { name: 'Prompt', module: 'components/ui/prompt' },
  },
  choice: {
    label: 'Choice',
    hint: 'await a pick from a list',
    files: ['src/components/ui/choice.tsx', 'src/components/ui/dialog.tsx'],
    deps: ['react-call'],
    root: { name: 'Choice', module: 'components/ui/choice' },
  },
  'confirm-passphrase': {
    label: 'Confirm (passphrase)',
    hint: 'type an exact phrase to confirm',
    files: ['src/components/ui/confirm-passphrase.tsx', 'src/components/ui/dialog.tsx'],
    deps: ['react-call'],
    root: { name: 'ConfirmPassphrase', module: 'components/ui/confirm-passphrase' },
  },
  'confirm-otp': {
    label: 'Confirm (OTP)',
    hint: 'verify an OTP code to confirm',
    files: [
      'src/components/ui/confirm-otp.tsx',
      'src/components/ui/dialog.tsx',
      'src/components/ui/input-otp.tsx',
    ],
    deps: ['react-call', 'input-otp'],
    root: { name: 'ConfirmOtp', module: 'components/ui/confirm-otp' },
  },
}

export const COMPONENT_NAMES = Object.keys(COMPONENTS)

export const allComponentFiles = () => COMPONENT_NAMES.flatMap((n) => COMPONENTS[n].files)

export const allComponentDeps = () => [
  ...new Set(COMPONENT_NAMES.flatMap((n) => COMPONENTS[n].deps)),
]

const baseDir = (framework) =>
  join(STACK_ROOT, 'apps', framework === 'next' ? 'next-base' : 'tanstack-base')

const ROOT_FILE = {
  next: 'src/app/layout.tsx',
  tanstack: 'src/routes/__root.tsx',
}

function mountRoot(projectDir, framework, root) {
  const path = join(projectDir, ROOT_FILE[framework] ?? '')
  if (!exists(path)) return false

  const lines = read(path).split('\n')
  if (lines.some((l) => l.includes(`<${root.name} />`))) return true

  const bodyClose = lines.findIndex((l) => l.includes('</body>'))
  let lastImport = -1
  for (let i = 0; i < lines.length; i++) if (/^import\b/.test(lines[i])) lastImport = i
  if (bodyClose === -1 || lastImport === -1) return false

  lines.splice(bodyClose, 0, `        <${root.name} />`)
  lines.splice(lastImport + 1, 0, `import { ${root.name} } from '~/${root.module}'`)
  write(path, lines.join('\n'))
  return true
}

function resolveDeps(framework, names) {
  const pkg = readJSON(join(baseDir(framework), 'package.json'))
  const all = { ...pkg.dependencies, ...pkg.devDependencies }
  const out = {}
  for (const n of names) out[n] = all[n] ?? 'latest'
  return out
}

export function vendorComponent({ projectDir, name, force = false }) {
  const comp = COMPONENTS[name]
  if (!comp) throw new Error(`Unknown component: ${name} (have ${COMPONENT_NAMES.join(', ')})`)
  if (COMPONENT_CATALOG[name]) {
    throw new Error(`Component ${name} is registry-backed and must be installed through shadcn`)
  }

  const pkgPath = join(projectDir, 'package.json')
  const pkg = readJSON(pkgPath)
  const framework = detectFramework(pkg)
  const alias = detectAlias(projectDir)
  const base = baseDir(framework)

  const copied = []
  const skipped = []
  for (const rel of comp.files) {
    const dest = join(projectDir, rel)
    if (exists(dest) && !force) {
      skipped.push(rel)
      continue
    }
    copy(join(base, rel), dest)
    copied.push(rel)
  }

  const addDeps = resolveDeps(framework, comp.deps)
  pkgAddDeps(pkg, addDeps)
  writeJSON(pkgPath, pkg)

  const mounted = comp.root ? mountRoot(projectDir, framework, comp.root) : null

  rewriteAlias(projectDir, alias)
  return { framework, copied, skipped, addDeps, mounted, rootName: comp.root?.name ?? null }
}
