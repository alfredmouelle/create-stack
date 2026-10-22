import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { type CliRelease, parseCliRelease } from '@alfredmouelle/stack-config/release'

export type PublishedRelease = { integrity: string; manifest: CliRelease }

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function metadata(value: unknown): { version: string; tarball: string; integrity: string } {
  if (
    !isObject(value) ||
    value.name !== '@alfredmouelle/create-stack' ||
    typeof value.version !== 'string' ||
    !/^\d+\.\d+\.\d+$/.test(value.version) ||
    !isObject(value.dist) ||
    typeof value.dist.tarball !== 'string' ||
    typeof value.dist.integrity !== 'string' ||
    !/^sha512-[A-Za-z0-9+/]+={0,2}$/.test(value.dist.integrity)
  )
    throw new Error('Invalid npm release metadata')
  const tarball = new URL(value.dist.tarball)
  if (tarball.protocol !== 'https:' || tarball.hostname !== 'registry.npmjs.org') {
    throw new Error('The published CLI tarball must come from the npm registry')
  }
  return { version: value.version, tarball: tarball.href, integrity: value.dist.integrity }
}

function tar(artifact: Buffer, args: string[]): string {
  return execFileSync('tar', args, {
    input: artifact,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  })
}

export async function fetchPublishedRelease({
  fetchImpl = globalThis.fetch,
  snapshot,
  expectedVersion,
}: {
  fetchImpl?: typeof fetch
  snapshot: PublishedRelease
  expectedVersion?: string | undefined
}): Promise<PublishedRelease> {
  const response = await fetchImpl(
    'https://registry.npmjs.org/@alfredmouelle%2fcreate-stack/latest',
    {
      signal: AbortSignal.timeout(10_000),
    },
  )
  if (!response.ok) throw new Error(`npm metadata returned HTTP ${response.status}`)
  const release = metadata(await response.json())
  if (expectedVersion !== undefined && release.version !== expectedVersion) {
    throw new Error(`Expected published CLI ${expectedVersion}, received ${release.version}`)
  }
  const download = await fetchImpl(release.tarball, { signal: AbortSignal.timeout(10_000) })
  if (!download.ok) throw new Error(`npm tarball returned HTTP ${download.status}`)
  const artifact = Buffer.from(await download.arrayBuffer())
  const integrity = `sha512-${createHash('sha512').update(artifact).digest('base64')}`
  if (integrity !== release.integrity) throw new Error('Published CLI integrity check failed')
  const packageValue: unknown = JSON.parse(tar(artifact, ['-xOzf', '-', 'package/package.json']))
  if (
    !isObject(packageValue) ||
    packageValue.name !== '@alfredmouelle/create-stack' ||
    packageValue.version !== release.version
  ) {
    throw new Error('Published package identity does not match npm metadata')
  }
  const files = tar(artifact, ['-tzf', '-']).trim().split('\n')
  let manifest: CliRelease
  if (files.includes('package/_stack/release.json')) {
    const value: unknown = JSON.parse(tar(artifact, ['-xOzf', '-', 'package/_stack/release.json']))
    manifest = parseCliRelease(value)
  } else if (snapshot.integrity === integrity && snapshot.manifest.version === release.version) {
    manifest = parseCliRelease(snapshot.manifest)
  } else {
    throw new Error(`CLI ${release.version} has no release manifest or verified snapshot`)
  }
  if (manifest.version !== release.version)
    throw new Error('CLI manifest version does not match its package')
  return { integrity, manifest }
}
