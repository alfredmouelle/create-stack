// `create-stack component` — opt-in UI components vendored on demand from the matching
// base app. Their source of truth lives in apps/<framework>-base; every scaffold strips
// them (see build.mjs) so they never weigh on the default bundle, and this re-vendors them
// when the user opts in. Idempotent: files that already exist are left untouched so local
// edits survive a re-run. Dep ranges are resolved from the base app's package.json to stay
// in lockstep with it.

import { detectFramework } from './add.mjs'
import { detectAlias, rewriteAlias } from './alias.mjs'
import { STACK_ROOT } from './paths.mjs'
import { copy, exists, join, pkgAddDeps, read, readJSON, write, writeJSON } from './util.mjs'

// name → vendored files (relative to project root) + the npm deps it pulls. Primitives a
// component needs (calendar/popover for the date pickers, dialog/alert-dialog/input-otp for
// the callables) are listed inline per component. Shared primitives (e.g. dialog across the
// callables) may appear under several components: the strip pass removes each once and the
// vendor pass skips files already present, so overlap is harmless. A `root` marks a callable
// whose Root must be mounted once in the app's root document (see mountRoot).
export const COMPONENTS = {
  'date-picker': {
    label: 'Date picker',
    hint: 'single + range, calendar, popover',
    files: [
      'src/components/ui/date-picker.tsx',
      'src/components/ui/date-range-picker.tsx',
      'src/components/ui/calendar.tsx',
      'src/components/ui/popover.tsx',
      'src/lib/date.ts',
    ],
    deps: ['react-day-picker', 'date-fns'],
  },
  datatable: {
    label: 'Data table',
    hint: 'sortable + infinite TanStack tables + useDataTable',
    files: [
      'src/components/data-table.tsx',
      'src/components/infinite-data-table.tsx',
      'src/components/sortable-header.tsx',
      'src/hooks/use-data-table.tsx',
    ],
    deps: ['@tanstack/react-table'],
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

/** Every file the opt-in components own — stripped from every scaffold. */
export const allComponentFiles = () => COMPONENT_NAMES.flatMap((n) => COMPONENTS[n].files)

/** Every npm dep the opt-in components pull — removed from every scaffold's package.json. */
export const allComponentDeps = () => [
  ...new Set(COMPONENT_NAMES.flatMap((n) => COMPONENTS[n].deps)),
]

/** Options for the interactive `component` multi-select. */
export const componentChoices = () =>
  COMPONENT_NAMES.map((value) => ({
    value,
    label: COMPONENTS[value].label,
    hint: COMPONENTS[value].hint,
  }))

const baseDir = (framework) =>
  join(STACK_ROOT, 'apps', framework === 'next' ? 'next-base' : 'tanstack-base')

const ROOT_FILE = {
  next: 'src/app/layout.tsx',
  tanstack: 'src/routes/__root.tsx',
}

/**
 * Mount a callable's Root once in the app's root document so `.call()` works out of the box.
 * Injects `import { Name } from '~/<module>'` after the last import and `<Name />` before
 * </body>. The '~/' is normalized to the project's alias by the later rewriteAlias pass.
 * Idempotent: a Root already present is untouched. Returns false when the root file or its
 * anchors can't be found (the caller then prints a manual mount hint).
 */
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

// Resolve each dep's range from the base app's package.json so versions stay in lockstep.
function resolveDeps(framework, names) {
  const pkg = readJSON(join(baseDir(framework), 'package.json'))
  const all = { ...pkg.dependencies, ...pkg.devDependencies }
  const out = {}
  for (const n of names) out[n] = all[n] ?? 'latest'
  return out
}

/**
 * Vendor `name` into the project: copy its files from the base app, merge its deps.
 * Existing files are left untouched unless `force` is set (then they're overwritten).
 * @returns {{ framework, copied: string[], skipped: string[], addDeps: Record<string,string> }}
 */
export function vendorComponent({ projectDir, name, force = false }) {
  const comp = COMPONENTS[name]
  if (!comp) throw new Error(`Unknown component: ${name} (have ${COMPONENT_NAMES.join(', ')})`)

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
      skipped.push(rel) // already there — never clobber a local edit (override with --force)
      continue
    }
    copy(join(base, rel), dest)
    copied.push(rel)
  }

  const addDeps = resolveDeps(framework, comp.deps)
  pkgAddDeps(pkg, addDeps)
  writeJSON(pkgPath, pkg)

  // callables must have their Root mounted once in the app shell to work out of the box.
  const mounted = comp.root ? mountRoot(projectDir, framework, comp.root) : null

  // vendored files (+ any injected import) ship with '~/'; align to this project's alias.
  rewriteAlias(projectDir, alias)
  return { framework, copied, skipped, addDeps, mounted, rootName: comp.root?.name ?? null }
}
