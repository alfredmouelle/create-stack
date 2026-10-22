import { optionSpelling, scaffoldFlagSpellings } from '@alfredmouelle/stack-config'
import { describe, expect, it } from 'vitest'
import { RELEASE_FLAGS as SCAFFOLD_FLAGS } from './cli-release'
import { FLAG_TABLES } from './docs-flags'

const rows = FLAG_TABLES.flatMap((table) => table.rows)

describe('docs flag tables', () => {
  it.each(SCAFFOLD_FLAGS.flatMap(scaffoldFlagSpellings).map(optionSpelling))(
    'documents %s',
    (spelling) => {
      expect(rows.some((row) => row.flags.includes(spelling))).toBe(true)
    },
  )

  it.each(SCAFFOLD_FLAGS.filter((flag) => flag.value.kind === 'choice'))(
    'lists every --$name value',
    (flag) => {
      const row = rows.find((candidate) => candidate.flags[0] === `--${flag.name}`)
      expect(row?.values).toEqual(flag.value.kind === 'choice' ? flag.value.choices : [])
    },
  )

  it('groups flags into stack, capability, and project tables', () => {
    expect(FLAG_TABLES.map((table) => table.caption)).toEqual([
      'Stack flags',
      'Capability flags',
      'Project flags',
    ])
    expect(FLAG_TABLES[0]?.rows.at(-1)?.flags).toEqual(['--no-db', '--no-auth', '--no-mail'])
  })
})
