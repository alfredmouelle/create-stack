import { readdirSync, realpathSync } from 'node:fs'
import { isAbsolute, relative, resolve } from 'node:path'
import { detectFrameworkModule } from '../framework-registry.ts'
import { join } from './util.ts'

const SKIPPED_DIRECTORIES = new Set(['.git', 'node_modules'])

const isCompatibleApplication = (directory: string): boolean =>
  detectFrameworkModule(directory) !== undefined

export function findCompatibleApplications(projectRoot: string): string[] {
  const applications: string[] = []

  function visit(directory: string): void {
    if (isCompatibleApplication(directory)) applications.push(directory)
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isDirectory() || SKIPPED_DIRECTORIES.has(entry.name)) continue
      visit(join(directory, entry.name))
    }
  }

  visit(projectRoot)
  return applications.sort((a, b) => a.localeCompare(b))
}

export const relativeApplicationPath = (projectRoot: string, application: string): string =>
  relative(projectRoot, application) || '.'

const isOutside = (root: string, target: string): boolean => {
  const path = relative(root, target)
  return (
    path === '..' ||
    path.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) ||
    isAbsolute(path)
  )
}

export function resolveApplicationPath(projectRoot: string, requestedPath: unknown): string {
  if (typeof requestedPath !== 'string' || !requestedPath.trim()) {
    throw new Error('--app requires a relative application path')
  }
  if (isAbsolute(requestedPath)) throw new Error('--app must be relative to the project root')

  const candidate = resolve(projectRoot, requestedPath)
  if (isOutside(projectRoot, candidate)) {
    throw new Error('--app must stay within the project root')
  }

  let realRoot: string
  let realCandidate: string
  try {
    realRoot = realpathSync(projectRoot)
    realCandidate = realpathSync(candidate)
  } catch {
    throw new Error(`Invalid application target: ${requestedPath}`)
  }
  if (isOutside(realRoot, realCandidate)) {
    throw new Error('--app must stay within the project root')
  }
  if (!isCompatibleApplication(realCandidate)) {
    throw new Error(`Not a compatible application: ${requestedPath}`)
  }
  return realCandidate
}
