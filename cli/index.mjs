#!/usr/bin/env node
// create-stack — fork a base app, strip to selection, stamp identity, verify.
// Interactive by default; non-interactive when any selection flag (or --yes) is passed:
//   create-stack my-app --framework next --foundations drizzle,trpc --mailer ses --no-install

import { resolve } from 'node:path'
import * as p from '@clack/prompts'
import { buildProject } from './lib/build.mjs'
import {
  adapterChoices,
  CAPABILITIES,
  capabilityChoices,
  resolveAdapter,
} from './lib/capabilities.mjs'
import { isDirEmpty, run } from './lib/util.mjs'

const ALL_FOUNDATIONS = ['drizzle', 'trpc', 'better-auth', 'data-table']

const cancelled = (v) => {
  if (p.isCancel(v)) {
    p.cancel('Aborted.')
    process.exit(0)
  }
  return v
}

/** Minimal flag parser: positional dir + --key value / --flag. */
function parseArgs(argv) {
  const out = { _: [], flags: {} }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const key = a.slice(2)
      const next = argv[i + 1]
      if (next && !next.startsWith('--')) {
        out.flags[key] = next
        i++
      } else {
        out.flags[key] = true
      }
    } else {
      out._.push(a)
    }
  }
  return out
}

const csv = (v) =>
  typeof v === 'string'
    ? v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : []

/** Resolve hard deps + mailer's better-auth requirement. */
function normalize(picked, mailer) {
  const kept = new Set(picked.filter((f) => ALL_FOUNDATIONS.includes(f)))
  if (kept.has('trpc') || kept.has('better-auth')) kept.add('drizzle')
  let mailerProvider = mailer ?? 'resend'
  if (kept.has('better-auth') && mailerProvider === 'none') mailerProvider = 'resend'
  return { kept, mailerProvider }
}

/** Read --<capability> flags into { capability: adapter } (default adapter if bare). */
function collectCapabilityFlags(flags) {
  const out = {}
  for (const cap of CAPABILITIES) {
    if (cap in flags) out[cap] = resolveAdapter(cap, flags[cap])
  }
  return out
}

function collectFromFlags(args) {
  const argDir = args._[0]
  if (!argDir) throw new Error('Project name is required (positional) in non-interactive mode')
  const framework = args.flags.framework === 'next' ? 'next' : 'tanstack'
  const picked = args.flags.foundations ? csv(args.flags.foundations) : [...ALL_FOUNDATIONS]
  const { kept, mailerProvider } = normalize(picked, args.flags.mailer)
  const capabilities = collectCapabilityFlags(args.flags)
  const doInstall = !args.flags['no-install']
  return { argDir, projectName: argDir, framework, kept, mailerProvider, capabilities, doInstall }
}

async function collectFromPrompts(argDir) {
  p.intro('create-stack — fork a base app, strip it to your selection')

  const name = cancelled(
    await p.text({
      message: 'Project name',
      placeholder: 'my-app',
      initialValue: argDir ?? '',
      validate: (v) => (v?.trim() ? undefined : 'Required'),
    }),
  )
  const projectName = name.trim()

  const framework = cancelled(
    await p.select({
      message: 'Framework',
      options: [
        { value: 'tanstack', label: 'TanStack Start' },
        { value: 'next', label: 'Next.js (App Router)' },
      ],
    }),
  )

  const picked = cancelled(
    await p.multiselect({
      message: 'Foundations (space to toggle)',
      required: false,
      initialValues: [...ALL_FOUNDATIONS],
      options: [
        { value: 'drizzle', label: 'Drizzle ORM', hint: 'Postgres + seed' },
        { value: 'trpc', label: 'tRPC', hint: 'needs Drizzle' },
        { value: 'better-auth', label: 'better-auth', hint: 'needs Drizzle + mailer' },
        { value: 'data-table', label: 'Data tables', hint: 'TanStack Table' },
      ],
    }),
  )
  const authKept = new Set(picked).has('better-auth')

  const mailerOpts = [
    { value: 'resend', label: 'Resend' },
    { value: 'brevo', label: 'Brevo' },
    { value: 'ses', label: 'Amazon SES' },
  ]
  if (!authKept) mailerOpts.push({ value: 'none', label: 'None' })
  const mailer = cancelled(
    await p.select({
      message: authKept ? 'Mailer provider (required by better-auth)' : 'Mailer provider',
      options: mailerOpts,
      initialValue: 'resend',
    }),
  )

  const capPicked = cancelled(
    await p.multiselect({
      message: 'Capabilities (space to toggle, swappable behind a port)',
      required: false,
      initialValues: [],
      options: capabilityChoices(),
    }),
  )

  const capabilities = {}
  for (const cap of capPicked) {
    const { defaultAdapter, options } = adapterChoices(cap)
    capabilities[cap] = cancelled(
      await p.select({
        message: `${cap} adapter`,
        options,
        initialValue: defaultAdapter,
      }),
    )
  }

  const doInstall = cancelled(
    await p.confirm({ message: 'Install dependencies and verify now?', initialValue: true }),
  )

  const { kept, mailerProvider } = normalize(picked, mailer)
  return { argDir, projectName, framework, kept, mailerProvider, capabilities, doInstall }
}

const pnpmRun = (script, projectDir, opts = {}) =>
  run('pnpm', ['--config.verify-deps-before-run=false', 'run', script], {
    cwd: projectDir,
    ...opts,
  })

/** Install deps, normalize vendored imports, then report typecheck + biome status. */
function installAndVerify(projectDir, capabilities) {
  p.log.step('pnpm install')
  run('pnpm', ['install'], { cwd: projectDir })
  // vendored capabilities rewrite cross-package imports (~/lib/http); let biome
  // re-sort/normalize them so the initial commit is lint-clean.
  if (Object.keys(capabilities ?? {}).length) {
    pnpmRun('check:write', projectDir, { stdio: 'ignore' })
  }
  p.log.step('Verifying (typecheck + biome)')
  const tc = pnpmRun('typecheck', projectDir)
  const lint = pnpmRun('check', projectDir)
  p.log[tc && lint ? 'success' : 'warn'](
    tc && lint ? 'typecheck + biome clean' : 'verify reported issues (see output above)',
  )
}

function execute(a) {
  const projectDir = resolve(process.cwd(), a.argDir ?? a.projectName)
  if (!isDirEmpty(projectDir)) {
    p.cancel(`Target directory is not empty: ${projectDir}`)
    process.exit(1)
  }

  const s = p.spinner()
  s.start('Forking + stripping the base app')
  buildProject({ ...a, projectDir })
  s.stop('Project scaffolded')

  if (a.doInstall) installAndVerify(projectDir, a.capabilities)

  // fresh repo + initial commit (also satisfies Biome vcs.useIgnoreFile).
  // commit is best-effort: skipped if git identity unset, staged tree left in place.
  if (run('git', ['-C', projectDir, 'init', '-q'])) {
    run('git', ['-C', projectDir, 'add', '-A'])
    const committed = run(
      'git',
      ['-C', projectDir, 'commit', '-q', '-m', 'chore: initial commit from create-stack'],
      { stdio: 'ignore' },
    )
    p.log.step(
      committed
        ? 'git repository initialized (initial commit created)'
        : 'git repository initialized — set git user.name/email, then commit',
    )
  }

  const keptMailer = a.mailerProvider !== 'none'
  const capEntries = Object.entries(a.capabilities ?? {})
  const lines = [
    `Framework: ${a.framework === 'next' ? 'Next.js' : 'TanStack Start'}`,
    `Foundations: ${[...a.kept].sort().join(', ') || '(none)'}`,
    `Mailer: ${keptMailer ? a.mailerProvider : '(none)'}`,
    `Capabilities: ${capEntries.map(([c, ad]) => `${c} (${ad})`).join(', ') || '(none)'}`,
    '',
    'Add more tools later with the add-capability skill.',
    '',
    'Next:',
    `  cd ${a.argDir ?? a.projectName}`,
  ]
  if (!a.doInstall) lines.push('  pnpm install')
  lines.push('  cp .env.example .env   # fill in the values', '  pnpm dev')
  p.note(lines.join('\n'), 'Done')
  p.outro(`Created ${a.projectName}`)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  const nonInteractive =
    args.flags.yes ||
    args.flags.y ||
    ['framework', 'foundations', 'mailer', 'no-install', ...CAPABILITIES].some(
      (k) => k in args.flags,
    )

  const answers = nonInteractive ? collectFromFlags(args) : await collectFromPrompts(args._[0])

  execute(answers)
}

main().catch((err) => {
  p.log.error(String(err?.stack || err))
  process.exit(1)
})
