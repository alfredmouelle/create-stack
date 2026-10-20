import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, expect, test } from 'vitest'
import { runVerificationGate } from '../src/engine.ts'
import type { Command, VerificationGate } from '../src/framework-module.ts'

const roots: string[] = []

afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true })
})

type Step = keyof VerificationGate

function recordingGate(failing?: Step) {
  const cwd = mkdtempSync(join(tmpdir(), 'create-stack-gate-'))
  roots.push(cwd)
  const log = join(cwd, 'gate.log')
  writeFileSync(log, '')
  const step = (name: Step): Command => ({
    command: process.execPath,
    args: [
      '-e',
      `require('node:fs').appendFileSync(${JSON.stringify(log)}, '${name}\\n'); process.exit(${name === failing ? 1 : 0})`,
    ],
  })
  const gate: VerificationGate = {
    install: step('install'),
    format: step('format'),
    typecheck: step('typecheck'),
    lint: step('lint'),
  }
  return { gate, cwd, steps: () => readFileSync(log, 'utf8').trim().split('\n') }
}

const packageManager = { name: 'npm' }

test('runs the gate commands in order: install, format with fixes, typecheck, lint', () => {
  const { gate, cwd, steps } = recordingGate()

  runVerificationGate(gate, { cwd, packageManager, requireSuccess: true })

  expect(steps()).toEqual(['install', 'format', 'typecheck', 'lint'])
})

test('a failed installation stops the required gate before verification', () => {
  const { gate, cwd, steps } = recordingGate('install')

  expect(() => runVerificationGate(gate, { cwd, packageManager, requireSuccess: true })).toThrow(
    'npm install failed; verification and the initial commit were skipped',
  )
  expect(steps()).toEqual(['install'])
})

test('a failed format stops the required gate before typechecking', () => {
  const { gate, cwd, steps } = recordingGate('format')

  expect(() => runVerificationGate(gate, { cwd, packageManager, requireSuccess: true })).toThrow(
    'Verification failed; the initial commit was skipped',
  )
  expect(steps()).toEqual(['install', 'format'])
})

test.each<Step>(['typecheck', 'lint'])('a failed %s fails the required gate', (failing) => {
  const { gate, cwd, steps } = recordingGate(failing)

  expect(() => runVerificationGate(gate, { cwd, packageManager, requireSuccess: true })).toThrow(
    'Verification failed; the initial commit was skipped',
  )
  expect(steps()).toEqual(['install', 'format', 'typecheck', 'lint'])
})

test('an optional gate reports failures without stopping', () => {
  const { gate, cwd, steps } = recordingGate('install')

  expect(() =>
    runVerificationGate(gate, { cwd, packageManager, requireSuccess: false }),
  ).not.toThrow()
  expect(steps()).toEqual(['install', 'format', 'typecheck', 'lint'])
})
