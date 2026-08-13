---
name: add-capability
description: >-
  Add or swap storage, cache, logger, analytics, mailer, jobs, error-tracking,
  email-ui, or HTTP in an existing project. Use for provider integrations such
  as "ajoute Resend". For a new project, use create-stack.
---

# Add a capability

Use the published create-stack CLI to vendor one capability into an existing
project.

## 1. Resolve the project and intent

Locate the app root whose `package.json` contains `next` or
`@tanstack/react-start`. In a generated monorepo this is normally `apps/web`,
not the workspace root. Read the existing dependencies and capability files,
record pre-existing working-tree changes, and determine whether the requested
result is an addition, a swap, or coexistence.

**Done when:** the working directory is the framework app root, existing work is
accounted for, and the intended add, swap, or coexist result is explicit.

## 2. Choose the supported path and resolve the CLI

Read [VENDOR.md](VENDOR.md) before running the CLI when the project has an
unsupported layout or framework, divergent env conventions, an incompatible
SDK major, or integration work that requires judgement. Follow that manual path
instead.

For a supported project, prefer `create-stack` on PATH. Otherwise resolve the
published npm version explicitly and use `pnpm dlx`; `@latest` can resolve from
stale cache.

```bash
cs() { if command -v create-stack >/dev/null 2>&1; then create-stack "$@";
       else pnpm dlx @alfredmouelle/create-stack@$(npm view @alfredmouelle/create-stack version) "$@"; fi; }
cs add --help
```

Define `cs` and invoke it in the same shell block each time. Treat
`cs add --help` as the source of truth for current capabilities and adapters.

**Done when:** the manual branch is selected with its reference loaded, or
`cs add --help` succeeds and the requested capability is supported.

## 3. Build the command

Ports take an adapter; modules do not. Re-adding a port swaps its adapter by
default. Pass `--keep` only when coexistence is the requested result.

```bash
cs add <capability> [adapter]
cs add <capability> <adapter> --keep
```

Repeat the `cs` definition from step 2 in the same shell block as the selected
invocation.

**Done when:** the command names a current capability, includes an adapter only
for a port, and its swap/coexistence behavior matches the explicit intent.

## 4. Run and account for edits

Run from the app root. Success requires exit 0 and a CLI summary naming the
requested capability and, for a port, adapter.

The CLI can vendor files before install or verification fails. On failure,
inspect the command output and working-tree diff against the recorded baseline,
then choose recovery based on the edits already made. Before entering the
manual path, account for every partial CLI edit so it is preserved, completed,
or deliberately replaced.

**Done when:** the successful CLI summary matches the request, or every partial
edit is accounted for and the selected recovery/manual path has been completed.

## 5. Finish and report

Apply every printed manual file edit that is in scope. Report the capability,
adapter or module, add/swap/coexist result, env vars requiring user values, and
each step handed to the user.

**Done when:** every printed step is completed or explicitly handed off and all
remaining env values are named.
