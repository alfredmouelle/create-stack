import type { PackageManager, VerificationGate } from '../framework-module.ts'

export const packageScriptGate = (packageManager: PackageManager): VerificationGate => {
  const script = (name: string) => ({
    command: packageManager.exec,
    args: packageManager.runArgs(name),
  })
  return {
    install: { command: packageManager.exec, args: packageManager.installArgs },
    format: script('check:write'),
    typecheck: script('typecheck'),
    lint: script('check'),
  }
}
