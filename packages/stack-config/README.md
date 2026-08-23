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

The module is pure TypeScript. It has no filesystem, CLI, framework, React, or
browser-global dependency. Explicit conflicts leave `cliArgs` empty so callers
must handle them before project generation.
