---
status: accepted
---

# Write the engine and framework modules in TypeScript

The framework module contract is the interface future integrators implement, so it is written in TypeScript together with the engine and the framework modules. Node runs that source directly in the repository and tests, but it refuses to strip types under `node_modules`, so the published CLI ships JavaScript compiled at pack time, following the existing bundled-or-source loading of `stack-config`. The supporting modules under `cli/src/lib/` are TypeScript too and compile into the same bundle; only the command line entry (`cli/index.mjs`) and the loader that picks the bundle or the source (`cli/engine.mjs`) stay JavaScript.

## Considered Options

- **Plain JavaScript validated at runtime**: no compilation step, but integrators would discover contract errors only when generating.
- **A native language such as Rust or Go**: the work is file I/O and text rendering, `stack-config` is shared with the browser-based marketing configurator, the CLI depends on the JavaScript `shadcn` package, users already run Node through `npx`, and native binaries would require per-platform npm packages. Reconsider only if distribution without Node becomes a demonstrated need.
