---
status: accepted
---

# Assemble projects from framework modules and reference applications

Create Stack must grow from two React frameworks to frameworks with different UI runtimes (Remix 3), without a server (Vue SPA), or without UI (NestJS), and later to other languages. Copying a complete base app and deleting unselected features spread `next`-versus-TanStack branches across generation, auth, data, capabilities, components, monorepo output, and packaging, and it cannot describe a framework that has no "complete" app to strip. We replace it with a generation engine and one framework module per framework.

The engine owns user intent, configuration resolution, choice conflicts, the plan, the execution sequence, and the final result. A framework module owns everything Create Stack knows about its framework: its generated files, integration wiring, framework support, application detection, and verification commands. No framework identifier appears outside its module and the registry. Framework support and per-framework recommendations are data in `stack-config`, so the CLI and the marketing configurator report the same unsupported choices before any file is written.

Each framework module assembles projects from a reference application: a runnable, tested app containing every stack part the framework supports in its recommended form. Every file of the reference application belongs to exactly one part; generation copies the parts the configuration selects and never deletes. The few files that depend on several parts are rendered by the module, and the rendering of the recommended configuration must equal the reference application's file. Provider changes during an addition remove the files owned by the former provider's part.

## Considered Options

- **Fork and strip (previous model)**: kept the reference app runnable, but stripping grows with every framework and provider, and relies on regex edits that fail silently.
- **Fragment directories without a runnable app**: localizes parts, but quality is only observable after generating and installing a project, which needs the network and builds.
- **Delegating to upstream scaffolders** (`create-next-app`, `nest new`, `create-rasengan`): rejected because their templates move, some fetch unpinned branches, and some create their own first commit.

## Consequences

- The engine contract does not mandate how a module produces files; the reference-application assembly is the shared toolkit every current module uses.
- Adding a framework means one module, one reference application, and one registry entry. Bundling, the CI smoke matrix, `add` detection, help, and prompts derive from the registry.
- The engine never reads a JavaScript manifest itself, so a future framework need not have a `package.json`. No language or toolchain abstraction is introduced before a non-JavaScript framework requires one.
- ADR-0001 described `--minimal` as frontend-only. A minimal project is now the framework's smallest runnable configuration; it remains frontend-only for UI frameworks.
