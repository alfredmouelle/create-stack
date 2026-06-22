# Skills

Claude Code skills that automate working with this reference stack. They live
here (versioned with the stack) and are **symlinked** into the user-level skills
directory so editing them here updates what Claude uses — no copy step.

- **bootstrap** — turn a freshly scaffolded project into one that follows the
  stack: detect the opt-in packages (trpc, better-auth, drizzle, …), strip the
  CLI's example boilerplate, vendor the matching `patterns/` + baseline (strict
  Biome, tsconfig, typed env, `~/*` alias), then freshen deps + stamp author info.
- **add-capability** — add a capability (mailer, storage, jobs, cache, logger,
  analytics, error-tracking, email-kit, http) into a project behind a port, with
  a chosen provider. Vendors server-only capabilities into `src/server/<cap>/`,
  pure utils (http) into `src/lib/`, templates into `src/emails/`.

## Install / update the symlinks

```bash
pnpm link:skills            # → Claude  (~/.claude/skills/<name>/, dir symlink)
pnpm link:skills:codex      # → Codex   (~/.codex/prompts/<name>.md, file symlink)
pnpm unlink:skills          # remove the Claude symlinks
pnpm unlink:skills:codex    # remove the Codex symlinks
```

Or call the script directly with a target flag:

```bash
./scripts/link-skills.sh --claude          # default
./scripts/link-skills.sh --codex
./scripts/link-skills.sh --codex --unlink
```

Each target gets the format it expects: **Claude** consumes skill *directories*
(`SKILL.md` inside), so it symlinks the folder; **Codex** consumes flat markdown
prompts, so it symlinks each `SKILL.md` as `<name>.md`. Override destinations
with `$CLAUDE_SKILLS_DIR` / `$CODEX_PROMPTS_DIR`.

The script is idempotent: it refreshes existing links and backs up any real
file/dir it would overwrite. Run it once per machine (or after adding a new
skill folder); after that, edits here are live immediately — the agent reads
through the symlink.
