// `create-stack component` — opt-in UI components vendored on demand from the matching
// base app. Their source of truth lives in apps/<framework>-base; every scaffold strips
// them (see build.mjs) so they never weigh on the default bundle, and this re-vendors them
// when the user opts in. Idempotent: files that already exist are left untouched so local
// edits survive a re-run. Dep ranges are resolved from the base app's package.json to stay
// in lockstep with it.

import { detectFramework } from './add.mjs'
import { detectAlias, rewriteAlias } from './alias.mjs'
import { STACK_ROOT } from './paths.mjs'
import { copy, exists, join, pkgAddDeps, readJSON, writeJSON } from './util.mjs'

// name → vendored files (relative to project root) + the npm deps it pulls. Primitives a
// component needs (calendar/popover for the date pickers) are listed inline rather than via
// a dependency graph: each is exclusive to its component, so a flat list is enough.
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

  // vendored files ship with '~/'; align to whatever alias this project already uses.
  rewriteAlias(projectDir, alias)
  return { framework, copied, skipped, addDeps }
}
