import {
  DEFAULT_IMPORT_ALIAS,
  optionSpelling,
  QUALITY_TOOL_LABELS,
  type ScaffoldFlag,
} from '@alfredmouelle/stack-config'
import { CAPABILITY_LABELS } from './build-config'
import {
  RELEASE_CAPABILITIES as CAPABILITY_CATALOG,
  CLI_RELEASE,
  RELEASE_FRAMEWORK_SUPPORT as FRAMEWORK_SUPPORT,
  RELEASE_FLAGS as SCAFFOLD_FLAGS,
} from './cli-release'

export type FlagRow = {
  readonly flags: readonly string[]
  readonly values: readonly string[]
  readonly defaultValue: string
  readonly notes: string
  readonly link?: { readonly href: string; readonly label: string }
}

type FlagDetails = Omit<FlagRow, 'flags' | 'values'>

const RECOMMENDED_FRAMEWORK = CLI_RELEASE.recommendedFramework
const recommended = FRAMEWORK_SUPPORT[RECOMMENDED_FRAMEWORK].recommendations

const FLAG_DETAILS: Readonly<Record<string, FlagDetails>> = {
  framework: {
    defaultValue: RECOMMENDED_FRAMEWORK,
    notes: 'Framework to generate. It decides the accepted stack options.',
    link: { href: '/frameworks', label: 'Support per framework' },
  },
  database: {
    defaultValue: recommended.database[0] ?? 'none',
    notes:
      'prisma selects Prisma 7. convex provides a realtime database and API, so use Clerk or no auth.',
  },
  auth: {
    defaultValue: recommended.auth[0] ?? 'none',
    notes: 'clerk is hosted and needs no database or mailer.',
  },
  trpc: {
    defaultValue: recommended.trpc ? 'on' : 'off',
    notes: 'Include or exclude the tRPC API.',
  },
  mailer: {
    defaultValue: recommended.mailer[0] ?? 'none',
    notes: 'Transactional email provider.',
  },
  formatter: {
    defaultValue: recommended.formatter,
    notes: `A bare flag selects ${QUALITY_TOOL_LABELS[recommended.formatter]}. --no-formatter and oxfmt are rejected.`,
  },
  linter: {
    defaultValue: recommended.linter,
    notes: `A bare flag selects ${QUALITY_TOOL_LABELS[recommended.linter]}. --no-linter and ESLint are rejected.`,
  },
  minimal: {
    defaultValue: 'off',
    notes: 'Smallest runnable, frontend-only project: no data, auth, tRPC, mail, or capabilities.',
  },
  monorepo: {
    defaultValue: 'standalone',
    notes: 'Put the app in apps/web inside a Turborepo or Nx monorepo. A bare flag selects turbo.',
  },
  pm: {
    defaultValue: 'detected',
    notes: 'Package manager for the generated project. Defaults to the one that ran the CLI.',
  },
  alias: {
    defaultValue: DEFAULT_IMPORT_ALIAS,
    notes: 'Import alias, such as @ or #. Imports matching <alias>/* resolve to src/*.',
  },
  'no-install': {
    defaultValue: 'off',
    notes: 'Skip dependency installation and verification. The project stays uncommitted.',
  },
  'no-git': { defaultValue: 'off', notes: 'Do not initialize Git.' },
  yes: { defaultValue: 'off', notes: 'Accept every default without a prompt.' },
}

const EXCLUSION_DETAILS: FlagDetails = {
  defaultValue: 'off',
  notes: 'Explicitly exclude the database, authentication, or transactional email.',
}

function flagDetails(flag: ScaffoldFlag): FlagDetails {
  const capability = CAPABILITY_CATALOG.find((candidate) => candidate.flag === flag.name)
  if (capability !== undefined) {
    return {
      defaultValue: capability.recommendedProvider,
      notes:
        capability.kind === 'port'
          ? 'Swappable provider behind a port.'
          : `${CAPABILITY_LABELS[capability.name]}.`,
    }
  }
  const details = FLAG_DETAILS[flag.name]
  if (details === undefined) throw new Error(`Missing docs for --${flag.name}`)
  return details
}

function displayedValues({ value }: ScaffoldFlag): readonly string[] {
  if (value.kind === 'choice') return value.choices
  if (value.kind === 'text') return [`<${value.placeholder}>`]
  return []
}

function flagRow(flag: ScaffoldFlag): FlagRow {
  const negation = flag.value.kind === 'none' && flag.negation !== undefined ? [flag.negation] : []
  return {
    flags: [flag.name, ...flag.aliases, ...negation].map(optionSpelling),
    values: displayedValues(flag),
    ...flagDetails(flag),
  }
}

function rowsFor(section: ScaffoldFlag['section']): FlagRow[] {
  return SCAFFOLD_FLAGS.filter((flag) => flag.section === section).map(flagRow)
}

const exclusions = SCAFFOLD_FLAGS.flatMap((flag) =>
  flag.value.kind !== 'none' && flag.negation !== undefined ? [optionSpelling(flag.negation)] : [],
)

export const FLAG_TABLES: readonly {
  readonly caption: string
  readonly rows: readonly FlagRow[]
}[] = [
  {
    caption: 'Stack flags',
    rows: [...rowsFor('stack'), { flags: exclusions, values: [], ...EXCLUSION_DETAILS }],
  },
  { caption: 'Capability flags', rows: rowsFor('capability') },
  { caption: 'Project flags', rows: rowsFor('project') },
]
