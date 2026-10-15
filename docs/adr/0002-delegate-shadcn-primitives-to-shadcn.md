---
status: accepted
---

# Delegate shadcn primitives to shadcn

Create Stack components may compose shadcn primitives, but Create Stack does not vendor those primitives from its base applications. It delegates their installation to an exact, tested version of the shadcn CLI so the target application's valid `components.json` determines their style and aliases; an absent or invalid configuration stops the addition before any change.

Each Create Stack component explicitly declares the shadcn primitives it imports. An addition batch installs their deduplicated union in one invocation, preserves existing shadcn files even under Create Stack's `--force` option, and reserves that option for files designed by Create Stack.

The aliases resolved from `components.json` also determine the destinations and imports of Create Stack's interface files. Shadcn owns the package dependencies of its primitives, while Create Stack declares only the dependencies used directly by its own files. Public component names remain scoped to the Create Stack catalog, so the callable `alert` keeps its name even though shadcn has a different primitive with that name.

Every configuration accepted by the pinned shadcn CLI is eligible; Create Stack does not impose its own style whitelist. The addition validates all predictable conditions before writing and stops on shadcn failure without promising rollback of partial changes made by that external command. Failure to mount a callable component automatically is non-blocking but is reported as a required manual action with the exact import and JSX.

Because shadcn cannot add components without installing their dependencies, such additions reject Create Stack's `--no-install` option before making changes. The preflight also resolves both Create Stack's and shadcn's effective package managers and rejects a divergence rather than allowing one addition to mutate competing lockfiles.

Create Stack packages its own interface components as local shadcn registry items rather than copying files from its base applications. The pinned shadcn CLI installs both those local items and their official registry dependencies, making it the sole interpreter of `components.json`; no hosted Create Stack registry is required.

Create Stack never passes shadcn's global `--overwrite` flag. When the user passes `--force`, Create Stack removes only the existing destinations owned by its selected local items and restores them if shadcn fails. Existing shadcn primitive files remain untouched.

The local registry is the sole source for optional interface files; the base applications no longer carry duplicate copies. One transformable item supports both Next.js and TanStack Start. Shadcn keeps or removes the leading `'use client'` directive according to the target's `rsc` setting.

The CLI package declares an exact shadcn runtime dependency and executes that local binary. The migration preserves the existing public contents of each addition, including the date range picker bundled with `date-picker` and every data table variant bundled with `data-table`.

Old files installed by Create Stack remain eligible for replacement. The default preserves them; `--force` replaces only the files owned by the selected Create Stack items. Integration tests cover both supported frameworks, Radix and Base UI styles, non-standard aliases, different icon libraries, customized existing files, shared dependencies in a batch, invalid configuration, package-manager conflicts, and restoration after shadcn failure. Each successful fixture installs and typechecks.

Authors edit ordinary TSX sources. The CLI build generates and validates the local registry JSON, including file references and shadcn dependencies, then packages the generated items. One catalog entry per public addition supplies both the registry item and the metadata used for preflight, replacement, and Root mounting.

The addition plan lists the requested Create Stack components first and the shadcn primitives they require on a separate line. When `components.json` is absent or invalid, the error prints the exact `shadcn init` command for the detected package manager and pinned version.

If a legacy Create Stack file exists at the historical fixed path while `components.json` resolves a different destination, `--force` stops before writing and reports both paths. Create Stack does not move that file or rewrite project imports. The user resolves the migration and retries.

Adding shadcn primitives requires access to the official registry. Create Stack does not package a fallback copy; a registry failure stops the addition before Create Stack files are written and restores any files staged for `--force`. Create Stack upgrades the exact shadcn version only through an explicit change that regenerates the local catalog and passes the full integration matrix.
