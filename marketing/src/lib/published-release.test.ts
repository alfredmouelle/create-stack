import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createCliRelease, parseCliRelease } from '@alfredmouelle/stack-config/release'
import { describe, expect, it } from 'vitest'
import { fetchPublishedRelease } from '../../scripts/published-release.ts'
import snapshot from '../data/cli-release.json'

function publishedArtifact({
  version = '0.17.0',
  includeManifest = true,
  manifestVersion = version,
}: {
  version?: string
  includeManifest?: boolean
  manifestVersion?: string
} = {}) {
  const root = mkdtempSync(join(tmpdir(), 'create-stack-release-'))
  try {
    mkdirSync(join(root, 'package/_stack'), { recursive: true })
    writeFileSync(
      join(root, 'package/package.json'),
      JSON.stringify({ name: '@alfredmouelle/create-stack', version }),
    )
    if (includeManifest) {
      writeFileSync(
        join(root, 'package/_stack/release.json'),
        JSON.stringify(createCliRelease(manifestVersion)),
      )
    }
    const artifact = execFileSync('tar', ['-czf', '-', '-C', root, 'package'])
    const integrity = `sha512-${createHash('sha512').update(artifact).digest('base64')}`
    return { artifact, integrity, version }
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

function registry(
  fixture: ReturnType<typeof publishedArtifact>,
  integrity = fixture.integrity,
): typeof fetch {
  return async (input) =>
    String(input).endsWith('/latest')
      ? Response.json({
          name: '@alfredmouelle/create-stack',
          version: fixture.version,
          dist: {
            tarball: `https://registry.npmjs.org/@alfredmouelle/create-stack/-/create-stack-${fixture.version}.tgz`,
            integrity,
          },
        })
      : new Response(new Uint8Array(fixture.artifact))
}

const verifiedSnapshot = {
  integrity: snapshot.integrity,
  manifest: parseCliRelease(snapshot.manifest),
}

describe('published CLI availability', () => {
  it('activates a new framework from the downloaded npm artifact', async () => {
    const fixture = publishedArtifact()
    const release = await fetchPublishedRelease({
      snapshot: verifiedSnapshot,
      fetchImpl: registry(fixture),
    })

    expect(release.manifest.version).toBe('0.17.0')
    expect(Object.keys(release.manifest.frameworks)).toEqual([
      'tanstack',
      'next',
      'remix',
      'rasengan',
    ])
    expect(release.manifest.frameworks.remix?.supports.auth).toEqual([
      'better-auth',
      'clerk',
      'none',
    ])
    expect(release.integrity).toBe(fixture.integrity)
  })

  it('uses the verified snapshot only for the exact legacy npm artifact', async () => {
    const fixture = publishedArtifact({ version: '0.16.0', includeManifest: false })
    const release = await fetchPublishedRelease({
      snapshot: { ...verifiedSnapshot, integrity: fixture.integrity },
      fetchImpl: registry(fixture),
    })

    expect(release.manifest.frameworks.remix).toBeUndefined()
    expect(Object.keys(release.manifest.frameworks)).toEqual(['tanstack', 'next', 'rasengan'])
  })

  it('rejects an unrecognized artifact without a manifest', async () => {
    const fixture = publishedArtifact({ includeManifest: false })
    await expect(
      fetchPublishedRelease({ snapshot: verifiedSnapshot, fetchImpl: registry(fixture) }),
    ).rejects.toThrow('has no release manifest or verified snapshot')
  })

  it('rejects a package whose bytes do not match the npm integrity', async () => {
    const fixture = publishedArtifact()
    await expect(
      fetchPublishedRelease({
        snapshot: verifiedSnapshot,
        fetchImpl: registry(fixture, verifiedSnapshot.integrity),
      }),
    ).rejects.toThrow('integrity check failed')
  })

  it('rejects a publication that has not reached latest', async () => {
    const fixture = publishedArtifact({ version: '0.16.0' })
    await expect(
      fetchPublishedRelease({
        snapshot: verifiedSnapshot,
        fetchImpl: registry(fixture),
        expectedVersion: '0.17.0',
      }),
    ).rejects.toThrow('Expected published CLI 0.17.0, received 0.16.0')
  })

  it('rejects a manifest that describes a different package version', async () => {
    const fixture = publishedArtifact({ manifestVersion: '0.18.0' })
    await expect(
      fetchPublishedRelease({ snapshot: verifiedSnapshot, fetchImpl: registry(fixture) }),
    ).rejects.toThrow('manifest version does not match its package')
  })

  it('stops deployment verification when npm is unavailable', async () => {
    await expect(
      fetchPublishedRelease({
        snapshot: verifiedSnapshot,
        fetchImpl: async () => new Response('', { status: 503 }),
      }),
    ).rejects.toThrow('npm metadata returned HTTP 503')
  })
})
