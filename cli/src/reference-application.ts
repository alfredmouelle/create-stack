import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { AssemblyRequest } from './framework-module.ts'

export type StackSelection = Pick<AssemblyRequest, 'database' | 'auth' | 'trpc' | 'mailer'>
export type StringMap = Readonly<Record<string, string>>

export type PartFile = {
  readonly path: string
  readonly referencePath?: string
  readonly source:
    | string
    | null
    | ((selection: StackSelection, parts: readonly ApplicationPart[]) => string | null)
}

export type ApplicationPart = {
  readonly id: string
  readonly selected: (selection: StackSelection) => boolean
  readonly files: readonly PartFile[]
  readonly dependencies?: StringMap
  readonly devDependencies?: StringMap
  readonly scripts?: StringMap
  readonly envKeys?: readonly string[]
  readonly requiredEnvKeys?: readonly string[]
  readonly envLines?: readonly string[]
  readonly nativeBuilds?: readonly string[]
}

export type ReferenceApplication = {
  readonly root: string
  readonly parts: readonly ApplicationPart[]
}

export function assembleReference(
  reference: ReferenceApplication,
  selection: StackSelection,
  destination: string,
): readonly ApplicationPart[] {
  const parts = reference.parts.filter((part) => part.selected(selection))
  const paths = new Set<string>()
  for (const file of parts.flatMap((part) => part.files)) {
    if (file.source === null) continue
    const content = typeof file.source === 'string' ? undefined : file.source(selection, parts)
    if (content === null) continue
    if (paths.has(file.path)) throw new Error(`Multiple selected parts own ${file.path}`)
    paths.add(file.path)
    const target = join(destination, file.path)
    mkdirSync(dirname(target), { recursive: true })
    if (typeof file.source === 'string') copyFileSync(file.source, target)
    else if (content !== undefined) writeFileSync(target, content)
  }
  return parts
}
