---
name: publish
description: >-
  Evaluate and prepare npm releases for @alfredmouelle/create-stack when the user asks
  to publish, release, ship, deploy, bump, or tag it, or asks whether it is ready to
  publish. Use the published npm version and the commit history as the baseline.
---

# Publish guard for `@alfredmouelle/create-stack`

A `vX.Y.Z` tag is the release boundary. The publish workflow reacts to that tag, so
tagging publishes the package after CI. Inspect `.github/workflows/publish.yml` if that
convention changes.

The user's scope controls the mode:

- **Assessment mode:** the user asks whether to publish, asks for a review, or says to
  wait or not to act. Inspect and report only. Do not edit files, commit, tag, or push.
- **Execution mode:** the user asks to publish, release, ship, deploy, bump, or tag and
  has not limited the request to an assessment. Decide from the commits, prepare the
  publication locally when justified, then ask for permission to push.

Questions about whether a publication is warranted stay in assessment mode. A qualifying
commit does not override an explicit hold.

## 1. Establish the mode and checkout

Read the request, then run:

```bash
git status --short --branch
git log -1 --oneline --decorate
git worktree list
```

Use the current checkout for publication preparation. Leave unrelated worktrees alone.

In execution mode, require all of the following before editing:

- the working tree is clean;
- the branch is the intended release branch;
- the checkout includes its upstream tip and is not behind or diverged;
- no unrelated publication commit or target tag is already in progress.

If any condition fails, report the exact condition and stop. Preserve the user's changes.
Assessment mode may inspect a dirty or stale checkout, but must identify those limits in
the report.

Completion criterion: the mode, checkout, branch state, and safety conditions are known.

## 2. Establish the published baseline

The npm-published version is the source of truth. The local `package.json` and local
tags can describe a publication that was prepared but never pushed.

Run:

```bash
published_version="$(npm view @alfredmouelle/create-stack version)"
git rev-parse --verify "v${published_version}^{commit}"
git log --oneline --no-merges "v${published_version}..HEAD"
```

If the published tag is missing locally:

- in assessment mode, report that the baseline cannot be proven locally and stop;
- in execution mode, fetch tags with `git fetch --tags origin`, then resolve the tag
  again. If it is still missing, stop rather than guessing the baseline.

Evaluate every commit in `v${published_version}..HEAD`. If the checkout is behind its
upstream, do not silently omit upstream commits from the candidate range.

Completion criterion: the published version, its commit, and the complete candidate
range are recorded.

## 3. Classify the candidate commits

Read each candidate diff, not only its subject line. Use `git show` and inspect the files
that affect the shipped package or generated project.

| Publish-worthy | Not publish-worthy by itself |
| --- | --- |
| New framework, foundation, capability, adapter, or provider | Tests only |
| A fix to generated output, templates, environment files, or generators | CI or workflow only |
| A wizard, flag, prompt, default, validation rule, or CLI behavior change | Comments, formatting, or lint-only changes |
| A dependency change that reaches generated projects | Documentation-only changes |
| A base-app change shipped to generated projects | Internal refactoring with identical output |

Judge the effect, not the conventional-commit prefix. A `feat` that changes only tests
does not qualify. A `refactor` that changes generated output can qualify. An ambiguous
commit does not justify a publication alone, but it rides along once another commit
clearly qualifies.

Completion criterion: every candidate commit has a publication-worthiness decision and
every qualifying user-facing effect has a short changelog description.

## 4. Decide from the classification

If no commit qualifies, stop with a plain report:

> No publication: every commit since `v<PUBLISHED>` is docs, test, CI, chore, or refactor
> work with no user-facing effect. It will ship with the next publication that adds value.

List the candidate commits. In both modes, leave the repository unchanged.

If at least one commit qualifies, choose the next version from the published version:

- a feature means a minor release, for example `0.11.0` to `0.12.0`;
- fixes only mean a patch release;
- a breaking CLI or generated-layout change means a minor release before `1.0.0`, and
  the breaking effect must be prominent in the changelog.

In assessment mode, report the verdict, target version, qualifying changes, and any
readiness blockers. Stop without running publication preparation.

Completion criterion: the verdict and target version are explicit, and assessment mode
has ended without changing repository state.

## 5. Verify the exact publication candidate

Run the checks on the clean `HEAD` that will receive the release commit and tag:

```bash
pnpm --filter @alfredmouelle/create-stack test
```

When any candidate touches generated output, templates, `cli/index.mjs`, `cli/lib/`,
registry files, base apps, package manifests, bundling code, or the lockfile, also run:

```bash
pnpm --filter @alfredmouelle/create-stack test:smoke
```

If a check fails, report the failing command and stop. Fixing code is a separate task.

Completion criterion: every required check passes on the exact candidate `HEAD`.

## 6. Prepare one release commit

Only execution mode reaches this step. The release commit must be the final commit before
the tag. Do not add unrelated work after it.

Before editing, verify that the target version is strictly greater than the npm-published
version. If the target version is already published, stop and report the conflict.

If the target version is already present in `cli/package.json`, the changelog already has
`## [x.y.z]`, and `vX.Y.Z` points at the current `HEAD`, treat the publication as already
prepared. Verify the clean tree and continue to Step 7 without editing or duplicating
the commit. A partial prepared state is a conflict. Report it and stop.

Update only these files:

1. `cli/CHANGELOG.md`
   - Move the relevant entries from `## [Unreleased]` into
     `## [x.y.z] - <YYYY-MM-DD>` using the current date.
   - Add a fresh, empty `## [Unreleased]` section above it.
   - Describe user-visible effects under `Added`, `Changed`, or `Fixed`.
   - Include every qualifying change once. Omit tests, CI, docs-only work, and internal
     refactors.
2. `cli/package.json`
   - Set `version` to the selected `x.y.z`.

Review the staged file list before committing. It must contain only those two files. Use
the exact commit message:

```text
chore(release): create-stack x.y.z
```

Then create the lightweight tag at the release commit:

```bash
git tag vx.y.z HEAD
```

If the target version, changelog section, or tag already exists, inspect it first. Treat
an existing tag that points elsewhere as a conflict. Do not force-move it automatically.

Completion criterion: the release commit is `HEAD`, it changes only the changelog and
`cli/package.json`, the tag points to that commit, and the working tree is clean.

## 7. Ask before pushing

Stop after local preparation. Nothing is published until the user explicitly confirms a
push. Show the exact commands:

```bash
git push origin main
git push origin vx.y.z
```

Explain that the first command publishes the release commit and the second pushes the tag
that starts the publish workflow. If the user declines, keep the local commit and tag and
do not push.

After explicit confirmation, push `main` first. Push the tag only if the branch push
succeeds. Report the workflow run to monitor.

Completion criterion: the user has either received the push commands, or the confirmed
push completed in branch-then-tag order.

## Hard rules

- The published npm version, not local `package.json`, defines the baseline.
- Every commit in the candidate range is classified from its diff.
- A publication needs user-facing package or CLI impact.
- Assessment mode is read-only.
- Execution mode requires a clean, current checkout and green required checks.
- The release commit changes only `cli/CHANGELOG.md` and `cli/package.json`.
- The release commit is the tip immediately before the lightweight `vX.Y.Z` tag.
- Never push without explicit confirmation.
