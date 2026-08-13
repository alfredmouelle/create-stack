---
status: accepted
---

# Unify the CLI language

The next major version will replace the historical `foundations` model and the separate `component` command with a strict, unified command language. We accept a breaking change because retaining the old grammar would preserve ambiguous terms, inconsistent defaults, and different interaction rules for equivalent operations.

## Consequences

- `create-stack <project>` is interactive only when no option is supplied. `-y` accepts the full recommended stack, while any other option starts non-interactive creation.
- Stack axes use concise canonical options with readable aliases. tRPC is selected directly with `--trpc` or `--no-trpc`; `--foundations` is removed.
- `--minimal` provides a composable frontend-only starting point. Omitted choices use applicable recommendations, required dependencies are completed, and conflicting explicit choices fail before generation.
- A bare provider selector chooses its recommended provider. Upstash is recommended for cache and R2 for storage. Unknown, repeated, contradictory, or inapplicable inputs are errors.
- `create-stack add` becomes the only enrichment command. It adds capabilities or UI components, supports validated batches through repeated `--with`, detects the application target when unique, and otherwise requires `--app <relative-path>` in non-interactive use.
- The former `component` command is removed. UI components use `add component <name>`; `datatable` becomes `data-table`, and the CLI target and published package `email-kit` become `email-ui`.
- Non-interactive operations print their resolved plan and relevant recommendation or dependency reasons, then execute without confirmation. Removed syntax fails with a targeted migration message rather than running through a compatibility layer.
