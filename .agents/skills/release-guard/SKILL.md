---
name: release-guard
description: >-
  Decide whether @alfredmouelle/create-stack warrants a release, and if so prepare it
  (CHANGELOG + version bump + tag) — STRICTLY. Use whenever the user wants to release,
  publish, deploy, ship, cut a version, bump, or tag this CLI; or asks "should I
  release/tag this?", "push to npm", "is this release-worthy?". Triggers: "release",
  "publie", "déploie", "tag", "bump", "ship", "on release ?", "faut-il taguer ?",
  "push sur npm". The skill itself rules tag-or-not from the commits — it does NOT ask
  the user whether to tag; it only asks for confirmation before pushing. It refuses to
  tag changes that add no user-facing value, and keeps the CHANGELOG current on release.
---

# Release guard — @alfredmouelle/create-stack

You are the gate between work and a published version. Publishing is automatic: pushing a
`v*` tag triggers `.github/workflows/publish.yml`, which re-runs test + smoke and then
`npm publish`. So **a tag IS a release**. Treat tagging as irreversible-in-spirit and be
strict: never create a `v*` tag for changes that don't change what `npx create-stack`
produces or how the CLI behaves.

Do not ask the user "should I tag / bump?" — decide it from the commits using the rules
below. The **only** thing you ask the user is whether to `git push` (the tag), at the very
end. Everything before the push (analysis, CHANGELOG, bump, local tag) you do without
asking, then report.

## Step 1 — Find the baseline

```bash
npm view @alfredmouelle/create-stack version           # PUBLISHED version (source of truth)
git log --oneline --no-merges "v<PUBLISHED>..HEAD"      # candidate commits since it
```

The baseline is the **published** version, not the local `package.json` or local tags
(those may be a prepared-but-unpushed release — see Step 6). Evaluate every commit in
`v<PUBLISHED>..HEAD`.

## Step 2 — Classify each commit (read the diff, not just the message)

A change is **release-worthy** only if it changes the published artifact or CLI behaviour:

| Release-worthy ✅                                                        | Not release-worthy ❌ (blocks a release on its own) |
| ------------------------------------------------------------------------ | --------------------------------------------------- |
| New framework / foundation / capability / adapter                        | Internal refactor with identical output             |
| Fix to **generated output** (`_stack/`, `lib/` generators, env/scaffold) | Tests only (`test/`)                                |
| Wizard / flag / prompt / UX change in `index.mjs`                        | CI / workflow only (`.github/`)                     |
| New or changed CLI behaviour, error handling, defaults                   | Comment / style / lint-only                         |
| Dependency change that reaches generated projects                        | `chore:` housekeeping                               |
| Base-app change shipped in `_stack/` that users get                      | Docs only — README **or** CHANGELOG                 |

Judge by effect, not by the conventional-commit prefix. A `feat(base): …` that edits
`_stack/` is release-worthy; a `fix(cli): …` that only fixes a test is not. When a single
commit is genuinely ambiguous, it does **not** justify a release by itself — but it rides
along once something clearly release-worthy exists.

## Step 3 — The verdict (be strict, and say no when it's no)

- **No release-worthy commit** → STOP. Do not bump, do not tag. Tell the user plainly:
  "No release: every commit since v<PUBLISHED> is <docs/test/ci/chore/refactor>; it adds no
  user-facing value and will ship with the next release that does." List the commits. End.
- **At least one release-worthy commit** → proceed to prepare the release (Steps 4–7).

Never soften a "no" into a tag. A valueless tag burns a version number, triggers CI, and
publishes an identical-behaviour package — that is exactly what this guard exists to prevent.

## Step 4 — Pick the version (SemVer, pre-1.0)

- Any release-worthy **feature** in the range → **minor** (`0.MINOR.0`).
- Only **fixes** (no feature) → **patch** (`0.x.PATCH`).
- A breaking change to the CLI contract or generated layout → pre-1.0: bump **minor** and
  call it out loudly in the CHANGELOG; post-1.0: **major**.

Compute from `v<PUBLISHED>`, not from the local `package.json`.

## Step 5 — Verify green before tagging

The publish workflow will reject a broken scaffold, but never knowingly tag red:

```bash
pnpm --filter @alfredmouelle/create-stack test
# if any commit touches generated output (_stack/, lib generators, env/scaffold):
pnpm --filter @alfredmouelle/create-stack test:smoke
```

Both must pass. If red, stop and fix (or report) — do not tag.

## Step 6 — Prepare the release (one self-contained commit)

The release commit is the **last** commit; never add work after it. It bundles the
CHANGELOG finalisation and the version bump together.

1. **CHANGELOG** (`cli/CHANGELOG.md`) — keep it current:
   - Ensure every release-worthy change has a user-facing entry under `## [Unreleased]`
     (Added / Changed / Fixed). Generate missing entries from the commits — describe the
     effect on the user, not the implementation. Omit non-user-facing commits entirely.
   - Rename `## [Unreleased]` to `## [x.y.z] - <YYYY-MM-DD>` (use `date +%F`).
   - Insert a fresh empty `## [Unreleased]` above it for the next cycle.
2. **Version** — set `cli/package.json` `"version"` to `x.y.z`.
3. **Commit** — `chore(release): create-stack x.y.z` (only these two files).
4. **Tag** — lightweight, matching the repo convention: `git tag vx.y.z HEAD`.

**Already-prepared state:** if `v<PUBLISHED>..HEAD` is release-worthy but `package.json`
is already at the target `x.y.z`, the CHANGELOG already has its `[x.y.z]` section, and a
local `vx.y.z` tag already points at the right commit — the release is prepared. Do not
re-bump or duplicate. Just confirm the tag is on the intended HEAD (re-point with
`git tag -f` only if commits were added since) and go to Step 7.

## Step 7 — Confirm the push (the only question you ask)

Stop here and ask the user to confirm the push — nothing is published until they do:

```bash
git push origin main                 # ship the commits
git push origin vx.y.z               # the tag → triggers publish (test+smoke → npm)
```

Present the exact commands and what they trigger. Offer: branch+tag together, tag only, or
hold. Never push without an explicit yes. After they confirm, push, then point them at the
Actions run to watch the publish gate.

## Hard rules

- A `v*` tag is only ever created when Step 3 returned a release. No exceptions.
- You decide tag-or-not; you ask the user only about pushing.
- The release commit is always the tip — no commits land after `chore(release): …`.
- The CHANGELOG is finalised **in** the release commit; `[Unreleased]` is left empty after.
- Baseline is the npm-published version, never the local `package.json`.
- Tag a green tree only (Step 5).
- Pushing a tag whose version is already on npm fails (npm rejects republish) — so the
  version must always be strictly greater than `npm view … version`.
