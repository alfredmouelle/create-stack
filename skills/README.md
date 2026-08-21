# Skills

Agent skills for working with this reference stack. The repository versions them
here, then the link script exposes them in the user-level configuration. Edit the
files in this directory and the linked skill changes with them.

- **create-stack**: create a project with the published
  `@alfredmouelle/create-stack` CLI: pick a framework (Next.js / TanStack Start),
  an optional monorepo (Turborepo / Nx), database, authentication, tRPC, mailer,
  and capabilities; it forks a base app, strips it to the selection,
  installs, verifies, and initializes Git. The skill gathers the choices and runs
  the CLI with flags.
- **publish**: decide whether the changes since the published npm version justify
  a new package version, then prepare the changelog, version bump, release commit,
  and tag. It asks before pushing anything.
- **add-capability**: add a capability (mailer, storage, jobs, cache, logger,
  analytics, error-tracking, email-ui, http) into a project behind a port, with
  a chosen provider. Vendors server-only capabilities into `src/server/<cap>/`,
  pure utils (http) into `src/lib/`, templates into `src/emails/`.

## Install / update the symlinks

```bash
pnpm link:skills            # Claude  (~/.claude/skills/<name>/, directory symlink)
pnpm link:skills:codex      # Codex   (~/.codex/prompts/<name>.md, file symlink)
pnpm unlink:skills          # remove the Claude symlinks
pnpm unlink:skills:codex    # remove the Codex symlinks
```

Or call the script directly with a target flag:

```bash
./scripts/link-skills.sh --claude          # default
./scripts/link-skills.sh --codex
./scripts/link-skills.sh --codex --unlink
```

Each target gets the format it expects. **Claude** consumes skill *directories*
with `SKILL.md` inside, so the script symlinks the folder. **Codex** consumes flat
markdown prompts, so the script symlinks each `SKILL.md` as `<name>.md`.
Override destinations with `$CLAUDE_SKILLS_DIR` and `$CODEX_PROMPTS_DIR`.

The script is idempotent. It refreshes existing links and backs up any real
file or directory it would overwrite. Run it once per machine and again after
adding a skill folder. Later edits are available through the link immediately.
