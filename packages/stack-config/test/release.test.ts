import { describe, expect, it } from 'vitest'
import { createCliRelease, parseCliRelease } from '../src/release'

describe('CLI release manifest', () => {
  it('describes the frameworks, options and recommendations shipped by a package version', () => {
    const manifest = createCliRelease('0.17.0')
    expect(manifest.packageName).toBe('@alfredmouelle/create-stack')
    expect(manifest.version).toBe('0.17.0')
    expect(Object.keys(manifest.frameworks).sort()).toEqual([
      'next',
      'rasengan',
      'remix',
      'tanstack',
    ])
    expect(manifest.frameworks.remix?.recommendations.auth).toEqual(['better-auth', 'clerk'])
    expect(manifest.flags.find(({ name }) => name === 'framework')?.value).toEqual({
      kind: 'choice',
      choices: ['tanstack', 'next', 'rasengan', 'remix'],
    })
  })

  it('rejects a manifest whose accepted framework flag exceeds its shipped support', () => {
    const manifest = createCliRelease('0.17.0')
    delete manifest.frameworks.remix
    expect(() => parseCliRelease(manifest)).toThrow('framework choices do not match its manifest')
  })

  it('rejects unsupported schemas and invalid recommendations', () => {
    const manifest = createCliRelease('0.17.0')
    expect(() => parseCliRelease({ ...manifest, schemaVersion: 2 })).toThrow(
      'Unsupported CLI release manifest',
    )
    expect(() =>
      parseCliRelease({
        ...manifest,
        frameworks: {
          ...manifest.frameworks,
          next: {
            ...manifest.frameworks.next,
            recommendations: { ...manifest.frameworks.next?.recommendations, linter: 'eslint' },
          },
        },
      }),
    ).toThrow('Unsupported CLI release value: eslint')
  })
})
