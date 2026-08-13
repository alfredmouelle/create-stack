import { readdirSync, realpathSync } from 'node:fs'
import { isAbsolute, relative, resolve } from 'node:path'
import { detectFramework } from './add.mjs'
import { exists, join, readJSON } from './util.mjs'

const SKIPPED_DIRECTORIES = new Set(['.git', 'node_modules'])

const isCompatibleApplication = (directory) => {
  const manifest = join(directory, 'package.json')
  if (!exists(manifest)) return false
  try {
    detectFramework(readJSON(manifest))
    return true
  } catch {
    return false
  }
}

/** Find framework applications below a project root, including the root itself. */
export function findCompatibleApplications(projectRoot) {
  const applications = []

  function visit(directory) {
    if (isCompatibleApplication(directory)) applications.push(directory)
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isDirectory() || SKIPPED_DIRECTORIES.has(entry.name)) continue
      visit(join(directory, entry.name))
    }
  }

  visit(projectRoot)
  return applications.sort((a, b) => a.localeCompare(b))
}

export const relativeApplicationPath = (projectRoot, application) =>
  relative(projectRoot, application) || '.'

const isOutside = (root, target) => {
  const path = relative(root, target)
  return (
    path === '..' ||
    path.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) ||
    isAbsolute(path)
  )
}

/** Resolve and validate a user-visible application path relative to the project root. */
export function resolveApplicationPath(projectRoot, requestedPath) {
  if (typeof requestedPath !== 'string' || !requestedPath.trim()) {
    throw new Error('--app requires a relative application path')
  }
  if (isAbsolute(requestedPath)) throw new Error('--app must be relative to the project root')

  const candidate = resolve(projectRoot, requestedPath)
  if (isOutside(projectRoot, candidate)) {
    throw new Error('--app must stay within the project root')
  }

  let realRoot
  let realCandidate
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
