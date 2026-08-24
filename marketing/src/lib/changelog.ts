import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export interface ChangelogSection {
  heading: string
  items: string[]
}

export interface ChangelogRelease {
  date?: string
  sections: ChangelogSection[]
  version: string
}

const CHANGELOG_SOURCE = readFileSync(resolve(process.cwd(), '..', 'cli', 'CHANGELOG.md'), 'utf8')

export function parseChangelog(source: string): ChangelogRelease[] {
  const releases: ChangelogRelease[] = []
  let release: ChangelogRelease | undefined
  let section: ChangelogSection | undefined

  for (const line of source.split(/\r?\n/)) {
    const releaseMatch = line.match(/^## \[([^\]]+)\](?:\s+-\s+(.+))?$/)
    if (releaseMatch) {
      release = {
        date: releaseMatch[2],
        sections: [],
        version: releaseMatch[1],
      }
      releases.push(release)
      section = undefined
      continue
    }

    const sectionMatch = line.match(/^### (.+)$/)
    if (sectionMatch && release) {
      section = { heading: sectionMatch[1], items: [] }
      release.sections.push(section)
      continue
    }

    const itemMatch = line.match(/^- (.+)$/)
    if (itemMatch && section) {
      section.items.push(itemMatch[1])
      continue
    }

    if (line.startsWith('  ') && section?.items.length) {
      section.items[section.items.length - 1] += ` ${line.trim()}`
    }
  }

  return releases
}

export function renderInline(markdown: string): string {
  const escaped = markdown
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

  return escaped
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
      '<a href="$2" rel="noreferrer" target="_blank">$1</a>',
    )
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/_([^_]+)_/g, '<em>$1</em>')
}

export const CHANGELOG_RELEASES = parseChangelog(CHANGELOG_SOURCE)
