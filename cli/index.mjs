#!/usr/bin/env node

import * as p from '@clack/prompts'
import {
  ADDITION_HELP,
  CLI_VERSION,
  CREATION_HELP,
  parseArgs,
  runAddition,
  runCreation,
} from './engine.mjs'

async function main() {
  const args = parseArgs(process.argv.slice(2))

  const help = args.flags.help || args.flags.h

  if (args.flags.version || args.flags.v) {
    process.stdout.write(`${CLI_VERSION}\n`)
    return
  }

  if (args._[0] === 'add') {
    if (help) return void process.stdout.write(`${ADDITION_HELP}\n`)
    await runAddition(args)
    return
  }

  if (args._[0] === 'component') {
    throw new Error('The component command was removed; run create-stack add component <name>')
  }

  if (help) {
    process.stdout.write(`${CREATION_HELP}\n`)
    return
  }

  await runCreation(args)
}

main().catch((err) => {
  p.log.error(String(err?.message || err))
  process.exit(1)
})
