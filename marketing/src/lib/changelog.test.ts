import { describe, expect, it } from 'vitest'
import { CHANGELOG_RELEASES, parseChangelog, renderInline } from './changelog'

describe('marketing changelog', () => {
  it('reads the published releases from the CLI changelog', () => {
    expect(CHANGELOG_RELEASES[0]).toMatchObject({ version: 'Unreleased' })
    expect(CHANGELOG_RELEASES).toContainEqual(
      expect.objectContaining({ date: '2026-08-21', version: '0.12.0' }),
    )
  })

  it('joins wrapped release notes into one item', () => {
    expect(
      parseChangelog('## [1.0.0] - 2026-01-01\n### Fixed\n- First line\n  continuation').at(0)
        ?.sections[0]?.items[0],
    ).toBe('First line continuation')
  })

  it('renders safe inline changelog markup', () => {
    expect(renderInline('**Fixed** `<script>` [docs](https://example.com)')).toBe(
      '<strong>Fixed</strong> <code>&lt;script&gt;</code> <a href="https://example.com" rel="noreferrer" target="_blank">docs</a>',
    )
  })
})
