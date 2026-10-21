# Stack configuration

`@alfredmouelle/stack-config` is the private, environment-neutral seam shared by
Create Stack consumers. It resolves explicit and omitted stack choices into the
recommended or applicable configuration, records why omitted choices changed,
reports explicit conflicts, and emits deterministic creation arguments.

```ts
import { resolveStackConfiguration } from '@alfredmouelle/stack-config'

const result = resolveStackConfiguration({ database: 'convex' })

// result.configuration.auth === 'clerk'
// result.configuration.trpc === false
// result.reasons contains the applicable recommendation reasons
// result.conflicts is empty
// result.cliArgs is ['--database', 'convex']
```

`FRAMEWORK_SUPPORT` declares each framework's label, maturity (`stable` or
`preview`), monorepo outputs, supported values per stack axis, and ordered
recommendations. The
resolver takes omitted choices from the selected framework's recommendations,
using the first one compatible with the other choices, and reports an explicit
choice the framework does not support as a choice conflict. The CLI and the
marketing configurator read the framework list from it.

It also holds the CLI facts the website shows: package managers, monorepo
orchestrators, components, and the import alias rule. `MINIMUM_NODE_VERSION`
reads the `engines.node` range of `cli/package.json`. `CAPABILITY_CATALOG` reads
capability providers and recommended providers from the
`packages/*/capability.json` manifests, so a new adapter reaches the CLI and the
website without other edits.

The module is pure TypeScript plus static JSON imports. It has no filesystem,
CLI, framework, React, or browser-global dependency. Explicit conflicts leave `cliArgs` empty so callers
must handle them before project generation.
