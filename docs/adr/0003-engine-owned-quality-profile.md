---
status: accepted
---

# Own the quality profile in the engine and choose quality tools per project

Strictness had drifted: the repository enabled `noUncheckedIndexedAccess` and `noImplicitOverride`, while each generated framework enabled a different subset, and Biome configuration and Git hooks were duplicated per base app. Rigor from the first generated commit now belongs to the engine rather than to each framework's promise.

Every generated project receives one quality profile: the strict TypeScript options (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`, `isolatedModules`, `noUncheckedSideEffectImports`), Git hooks, hook preparation, and editor settings. A framework or quality tool may tighten the profile, never relax it; an exception forced by an upstream framework is declared with its reason and covered by a test.

The automatic first commit keeps its verification gate: installation, then format, typecheck, and lint, each supplied by the framework and the selected quality tools, all required to pass. Tests and production builds stay outside the gate.

Formatter and linter become stack axes with Biome recommended for both. The formatter is `biome` or `prettier`; the linter is `biome` or `oxlint`, always type-aware. The Prettier part ships the Tailwind class-sorting and import-sorting plugins so every combination enforces the same guarantees as Biome. Each shipped tool configuration is strict, and the reference applications must pass every supported combination.

## Considered Options

- **ESLint**: excluded until `typescript-eslint` supports TypeScript 7. Its type-aware strict rules require TypeScript below 6.1, and the alternatives were pinning generated projects to TypeScript 6 or aliasing TypeScript 6 differently for each package manager.
- **oxfmt**: excluded until its 1.0 release.
- **Biome lint combined with Oxlint**: excluded because no official bridge removes their overlapping rules.
