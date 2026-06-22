#!/usr/bin/env node
// create-stack — deterministic installer for the personal reference stack.
// The non-LLM counterpart of the bootstrap skill's CREATE mode: fork a base
// app, strip it to the selection, stamp identity, verify.
//
// Interactive by default. Non-interactive when any selection flag (or --yes) is
// passed — useful for scripts/CI and for headless end-to-end testing:
//   create-stack my-app --framework next --foundations drizzle,trpc --mailer ses --no-install

import { resolve } from 'node:path'
import * as p from '@clack/prompts'
import { buildProject } from './lib/build.mjs'
import { loadCapabilities, loadPatterns } from './lib/manifests.mjs'
import { isDirEmpty, run } from './lib/util.mjs'

// Capabilities baked into the base apps vs. the ones add-capability supplies.
const BAKED_CAPS = new Set(['mailer', 'email-kit'])
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

/** Resolve hard deps + the mailer's better-auth requirement. */
function normalize(picked, mailer) {
  const kept = new Set(picked.filter((f) => ALL_FOUNDATIONS.includes(f)))
  if (kept.has('trpc') || kept.has('better-auth')) kept.add('drizzle')
  let mailerProvider = mailer ?? 'resend'
  if (kept.has('better-auth') && mailerProvider === 'none') mailerProvider = 'resend'
  return { kept, mailerProvider }
}

function collectFromFlags(args, capabilities) {
  const argDir = args._[0]
  if (!argDir) throw new Error('Project name is required (positional) in non-interactive mode')
  const framework = args.flags.framework === 'next' ? 'next' : 'tanstack'
  const picked = args.flags.foundations ? csv(args.flags.foundations) : [...ALL_FOUNDATIONS]
  const { kept, mailerProvider } = normalize(picked, args.flags.mailer)
  const validCaps = new Set(Object.keys(capabilities).filter((c) => !BAKED_CAPS.has(c)))
  const extraCaps = csv(args.flags.caps).filter((c) => validCaps.has(c))
  const doInstall = !args.flags['no-install']
  return { argDir, projectName: argDir, framework, kept, mailerProvider, extraCaps, doInstall }
}

async function collectFromPrompts(argDir, capabilities) {
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

  const extraCaps = cancelled(
    await p.multiselect({
      message: 'Extra capabilities (optional — added via add-capability)',
      required: false,
      initialValues: [],
      options: Object.keys(capabilities)
        .filter((c) => !BAKED_CAPS.has(c))
        .map((c) => ({ value: c, label: c, hint: capabilities[c].description?.slice(0, 40) })),
    }),
  )

  const doInstall = cancelled(
    await p.confirm({ message: 'Install dependencies and verify now?', initialValue: true }),
  )

  const { kept, mailerProvider } = normalize(picked, mailer)
  return { argDir, projectName, framework, kept, mailerProvider, extraCaps, doInstall }
}

function execute(a, patterns) {
  const projectDir = resolve(process.cwd(), a.argDir ?? a.projectName)
  if (!isDirEmpty(projectDir)) {
    p.cancel(`Target directory is not empty: ${projectDir}`)
    process.exit(1)
  }

  const s = p.spinner()
  s.start('Forking + stripping the base app')
  buildProject({ ...a, projectDir, patterns })
  s.stop('Project scaffolded')

  if (a.doInstall) {
    p.log.step('pnpm install')
    run('pnpm', ['install'], { cwd: projectDir })
    p.log.step('Verifying (typecheck + biome)')
    const tc = run('pnpm', ['--config.verify-deps-before-run=false', 'run', 'typecheck'], {
      cwd: projectDir,
    })
    const lint = run('pnpm', ['--config.verify-deps-before-run=false', 'run', 'check'], {
      cwd: projectDir,
    })
    p.log[tc && lint ? 'success' : 'warn'](
      tc && lint ? 'typecheck + biome clean' : 'verify reported issues (see output above)',
    )
  }

  const keptMailer = a.mailerProvider !== 'none'
  const lines = [
    `Framework: ${a.framework === 'next' ? 'Next.js' : 'TanStack Start'}`,
    `Foundations: ${[...a.kept].sort().join(', ') || '(none)'}`,
    `Mailer: ${keptMailer ? a.mailerProvider : '(none)'}`,
  ]
  if (a.extraCaps.length) {
    lines.push(
      '',
      'Add the extra capabilities with the add-capability skill:',
      ...a.extraCaps.map((c) => `  • ${c}`),
    )
  }
  lines.push('', 'Next:', `  cd ${a.argDir ?? a.projectName}`)
  if (!a.doInstall) lines.push('  pnpm install')
  lines.push('  cp .env.example .env   # fill in the values', '  pnpm dev')
  p.note(lines.join('\n'), 'Done')
  p.outro(`Created ${a.projectName}`)
}

async function main() {
  const patterns = loadPatterns()
  const capabilities = loadCapabilities()
  const args = parseArgs(process.argv.slice(2))

  const nonInteractive =
    args.flags.yes ||
    args.flags.y ||
    ['framework', 'foundations', 'mailer', 'caps', 'no-install'].some((k) => k in args.flags)

  const answers = nonInteractive
    ? collectFromFlags(args, capabilities)
    : await collectFromPrompts(args._[0], capabilities)

  execute(answers, patterns)
}

main().catch((err) => {
  p.log.error(String(err?.stack || err))
  process.exit(1)
})
