# create-stack

Interactive, **deterministic** installer for the reference stack — the non-LLM
counterpart of the `bootstrap` skill's CREATE mode. It forks a base app
(`apps/tanstack-base` or `apps/next-base`) and strips it down to your selection.

## Usage

```bash
# from anywhere
node /path/to/stack/cli/index.mjs my-app

# from the stack repo
pnpm create-stack my-app
```

The wizard asks for:

- **Framework** — TanStack Start or Next.js (App Router)
- **Foundations** — Drizzle, tRPC, better-auth, data-table (hard deps resolved:
  tRPC/better-auth ⇒ Drizzle; better-auth ⇒ mailer)
- **Mailer provider** — Resend, Brevo, Amazon SES (or none, if no better-auth)
- **Extra capabilities** — storage, jobs, cache, … (added afterwards via the
  `add-capability` skill; not baked into the base)

Then it forks, strips unselected foundations, swaps the mailer adapter, stamps
identity, generates `.env(.example)`, and optionally installs + verifies
(typecheck + Biome).

## How it works

- **Single source of truth**: the base apps (`apps/*-base`) hold the real code;
  the `patterns/*/pattern.json` manifests drive deps/scripts/env/file lists.
- **Deterministic strip**: whole-directory deletes + dep/env/script diffs from the
  manifests, plus a few hardcoded code *seams* (tRPC↔auth context, root provider
  wiring) handled via shipped reduced variants in `templates/`.
- If you edit a seam file in a base app (`server/api/trpc.ts`, the root
  `router.tsx` / `__root.tsx` / `layout.tsx`, the schema barrel), update the
  matching transform in `lib/strip.mjs` or the `templates/` variant.

## Layout

```
cli/
  index.mjs          wizard (prompts) + install/verify + report
  lib/
    build.mjs        pure build phase (fork → strip → mailer → env → identity)
    manifests.mjs    load patterns + capabilities; logical→manifest mapping
    scaffold.mjs     fork base app, make it standalone
    strip.mjs        reverse-strip unselected foundations + code seams
    mailer.mjs       mailer provider swap
    env.mjs          rebuild src/env.ts blocks + generate .env files
    identity.mjs     title/meta + README with the # Author footer
    util.mjs         fs / exec / package.json helpers
  templates/         reduced "no-trpc" root-wiring variants
```
