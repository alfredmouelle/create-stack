# Marketing Worker delivery runbook

This runbook covers the deliberate delivery of the marketing site from the isolated `create-stack-marketing` static-assets Worker. The `marketing/` package is the source of truth for the public site and always emits indexable metadata.

Merging code does not deploy it, this workflow does not attach a public domain, and the legacy `site/` directory and root `wrangler.jsonc` are outside its scope. Do not delete or modify the legacy Cloudflare resources as part of this runbook.

## Scoped API token

Create a dedicated, scoped API token for this Worker rather than using a personal global token:

1. In Cloudflare, open **My Profile → API Tokens → Create Token**.
2. Use a custom token scoped to the account that owns the Worker.
3. Start from Cloudflare's **Edit Cloudflare Workers** token template and restrict it to the account that owns this Worker. Grant only the account-level Workers Scripts edit permission needed to upload and manage Worker versions. Do not grant unrelated DNS, billing, Pages, or user permissions.
4. Record the token only in the password manager and GitHub secret store. Never put it in `marketing/`, a shell history, an issue, or a workflow file.
5. Obtain the account identifier from the Cloudflare dashboard and treat it as secret configuration too, even though it is not a credential.

The deployment commands read `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` from the environment. The repository contains neither value.

## First local deployment

The isolated configuration is [marketing/wrangler.jsonc](../../marketing/wrangler.jsonc). It names `create-stack-marketing`, serves `marketing/dist`, and keeps `workers_dev` enabled while the public hostname is checked. The root [wrangler.jsonc](../../wrangler.jsonc) is the legacy configuration and must remain untouched.

From the repository root, install and check the package:

```sh
pnpm install --frozen-lockfile
pnpm --filter @alfredmouelle/marketing typecheck
pnpm --filter @alfredmouelle/marketing test
```

With Cloudflare credentials available in the current shell, deploy the public build:

```sh
export CLOUDFLARE_API_TOKEN
export CLOUDFLARE_ACCOUNT_ID
pnpm --filter @alfredmouelle/marketing run deploy
```

The single package `deploy` script runs the public Astro build, starts a local preview, checks it over HTTP, and invokes the pinned workspace Wrangler only if those checks pass. It does not perform a post-deployment check because a local command cannot know which Worker URL should be considered authoritative; run the verification command below with the deployed URL.

## GitHub secret setup

In the repository, add the two Actions secrets without putting their values in command history or source files. The `gh` commands read each value from standard input:

```sh
gh secret set CLOUDFLARE_API_TOKEN
gh secret set CLOUDFLARE_ACCOUNT_ID
```

The workflow is [.github/workflows/deploy-marketing.yml](../../.github/workflows/deploy-marketing.yml). It has only a manual `workflow_dispatch` trigger, uses one cancelling concurrency group, and calls the same `@alfredmouelle/marketing` package script used locally. The Worker URL is a required dispatch input so an operator chooses the exact endpoint to verify; it is not stored as a credential.

## Public Worker deployment

The workflow is manual and always builds the public site. In GitHub Actions, run **Deploy marketing Worker** from `main` and enter the full URL of the endpoint to verify, for example:

```sh
MARKETING_DEPLOYMENT_URL='https://<worker-subdomain>.workers.dev' \
pnpm --filter @alfredmouelle/marketing verify:deployment
```

The check expects HTTP 200, the Create Stack page title, `robots.txt` with `Allow: /`, a sitemap, and the public canonical metadata. Also inspect the Worker in the Cloudflare dashboard and confirm the deployment is serving `marketing/dist`.

## Future filtered deployment from `main`

The workflow is manual today. If automatic delivery is separately authorized later, keep the workflow independent from npm publication and filter the `main` trigger to the marketing delivery surface, for example:

```yaml
on:
  push:
    branches: [main]
    paths:
      - marketing/**
      - marketing/wrangler.jsonc
      - packages/stack-config/**
      - .github/workflows/deploy-marketing.yml
      - package.json
      - pnpm-workspace.yaml
      - pnpm-lock.yaml
```

That change requires its own review and a protected production environment. Retain the manual `workflow_dispatch` trigger after enabling `main` so an operator can redeploy a selected commit. Do not enable this trigger while completing the current migration.

## Public metadata

Every build is public and emits the production canonical URL, indexable robots instructions, sitemap, social metadata, and local assets:

```sh
pnpm --filter @alfredmouelle/marketing run deploy
```

Confirm the final hostname serves the expected title, canonical URL, `robots.txt` with `Allow: /`, a sitemap containing the public origin, and the expected `llms.txt` content.

## Custom domain

Attach the custom domain in Cloudflare to `create-stack-marketing` through the Workers & Pages dashboard. Confirm DNS, TLS, the root page, `/build`, `/robots.txt`, `/sitemap.xml`, and `/llms.txt`.

The public domain is not attached by this ticket or its workflow. Keep `workers_dev` enabled until the custom domain is serving correctly. Once the custom domain is the only intended endpoint and the migration owner has approved it, make the isolated follow-up change in `marketing/wrangler.jsonc` to set `workers_dev` to `false`, deploy deliberately, and verify both the custom hostname and the absence of the unwanted `workers.dev` endpoint. Never make this change in the root configuration.

## Post-deployment checks

Every manual run requires a Worker URL and runs the package verification command after Wrangler succeeds:

These post-deployment checks are required for every deliberate deployment.

```sh
MARKETING_DEPLOYMENT_URL='https://<public-hostname>' \
pnpm --filter @alfredmouelle/marketing verify:deployment
```

The check performs an HTTP request to `/` and `/robots.txt`. It fails on a non-200 response, a non-HTML homepage, a missing expected title, or a missing public indexing policy. On failure it prints the manual rollback guidance below and exits non-zero; do not dismiss that failure as a transient CI result without checking the Worker.

## Worker rollback

Rollback is a human decision. From `marketing/`, list the recent versions, identify the last known-good version, and roll it back:

```sh
pnpm exec wrangler deployments list --config wrangler.jsonc
pnpm exec wrangler rollback <VERSION_ID> --config wrangler.jsonc --message "Restore known-good marketing deployment"
```

Re-run `verify:deployment` against the affected hostname. Keep the prior known-good version available for the full **30-day rollback period** after public cutover. Record the version ID and deployment result in the migration change log before considering the incident closed.

## Pages fallback

If the Worker cannot serve the site and a separate Pages project has been approved as the temporary fallback, build the selected static output and deploy that directory to the authorized Pages project:

```sh
pnpm --filter @alfredmouelle/marketing build:public
cd marketing
pnpm exec wrangler pages deploy dist --project-name <AUTHORIZED_PAGES_PROJECT>
```

Pages fallback is not configured by the Worker workflow and must not silently replace the Worker or attach a domain. Validate the fallback hostname, metadata, and indexing policy before changing DNS.

## Separately authorized legacy retirement

Retire the legacy site and its Cloudflare resource only in a separate, explicitly authorized change after the public Worker has passed all checks and the 30-day rollback period has ended. That change must identify the resource, owner, backups, DNS impact, and recovery plan. This ticket does not delete Cloudflare resources, remove `site/`, or edit the root `wrangler.jsonc`.
