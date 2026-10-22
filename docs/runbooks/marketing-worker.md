# Marketing Worker delivery runbook

This runbook covers the deliberate delivery of the marketing site from the isolated `create-stack-marketing` static-assets Worker. The `marketing/` package is the source of truth for the public site and always emits indexable metadata.

The workflow deploys selected pushes to `main`, manual dispatches, and successful CLI publications. Every deployment verifies the npm release before building the site.

## Scoped API token

Create a dedicated, scoped API token for this Worker rather than using a personal global token:

1. In Cloudflare, open **My Profile → API Tokens → Create Token**.
2. Use a custom token scoped to the account that owns the Worker.
3. Start from Cloudflare's **Edit Cloudflare Workers** token template and restrict it to the account that owns this Worker. Grant only the account-level Workers Scripts edit permission needed to upload and manage Worker versions. Do not grant unrelated DNS, billing, Pages, or user permissions.
4. Record the token only in the password manager and GitHub secret store. Never put it in `marketing/`, a shell history, an issue, or a workflow file.
5. Obtain the account identifier from the Cloudflare dashboard and treat it as secret configuration too, even though it is not a credential.

The deployment commands read `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` from the environment. The repository contains neither value.

## First local deployment

The isolated configuration is [marketing/wrangler.jsonc](../../marketing/wrangler.jsonc). It names `create-stack-marketing`, serves `marketing/dist`, and keeps `workers_dev` enabled while the public hostname is checked.

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

The package `deploy` script refreshes the verified CLI release, runs the public Astro build, starts a local preview, checks it over HTTP, and invokes the pinned workspace Wrangler only if those checks pass. Run the verification command below afterward with the deployed URL.

## Published CLI availability

The CLI pack step generates `_stack/release.json` from the shared framework, option, capability, and recommendation declarations. The manifest includes the exact package version. Marketing uses `src/data/cli-release.json`, a snapshot of that published manifest and its npm artifact integrity.

Before deployment, `release:refresh` resolves npm's `latest` tag, downloads the exact tarball, verifies its SHA-512 integrity and package identity, and reads the manifest without executing package code. CLI 0.16.0 predates the manifest; its initial snapshot was checked against published commit `12f280fa83476270b34d8a912821ed2ca3f74122` and the published tarball. A package without a manifest can reuse a snapshot only when both its version and artifact integrity match exactly.

The site pins commands to the verified version. Its hero, builder, framework pages, docs, and `llms.txt` share that release's availability. Implemented frameworks absent from the release appear as coming soon, have no installation command, and cannot be selected through shared URLs. Maturity (`stable` or `preview`) is independent of publication.

Local development and ordinary builds use the checked-in snapshot. Refresh it explicitly when needed:

```sh
pnpm --filter @alfredmouelle/marketing release:refresh
```

After `npm publish`, the publication workflow verifies the expected release tag and calls the existing deployment workflow. `EXPECTED_CLI_VERSION` requires that exact version to be available on npm's `latest` tag, with bounded retries for registry propagation. Failed publication, unavailable npm metadata, integrity mismatch, or an unsupported manifest stops the process before Wrangler runs. The existing deployed site remains in place.

## GitHub secret setup

In the repository, add the two Actions secrets without putting their values in command history or source files. The `gh` commands read each value from standard input:

```sh
gh secret set CLOUDFLARE_API_TOKEN
gh secret set CLOUDFLARE_ACCOUNT_ID
```

The workflow is [.github/workflows/deploy-marketing.yml](../../.github/workflows/deploy-marketing.yml). It uses one cancelling concurrency group and calls the same package script used locally. The Worker URL is required for manual dispatch; publication calls verify the public hostname. Cloudflare secrets pass through the reusable workflow without entering the release manifest.

## Public Worker deployment

The workflow deploys the public site on filtered pushes to `main` and remains available manually. For a manual run, open **Deploy marketing site** from `main` and enter the full URL of the endpoint to verify, for example:

```sh
MARKETING_DEPLOYMENT_URL='https://<worker-subdomain>.workers.dev' \
pnpm --filter @alfredmouelle/marketing verify:deployment
```

The check expects HTTP 200, the Create Stack page title, `robots.txt` with `Allow: /`, a sitemap, and the public canonical metadata. Also inspect the Worker in the Cloudflare dashboard and confirm the deployment is serving `marketing/dist`.

## Push filtering

The workflow deploys on pushes to `main` when a marketing delivery input changes. It also accepts a `workflow_call` from the CLI publication workflow and keeps manual dispatch available:

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

The push deployment verifies `https://create-stack.alfredmouelle.com`. A manual run may provide a different endpoint through the `worker_url` input.

## Public metadata

Every build is public and emits the production canonical URL, indexable robots instructions, sitemap, social metadata, and local assets:

```sh
pnpm --filter @alfredmouelle/marketing run deploy
```

Confirm the final hostname serves the expected title, canonical URL, `robots.txt` with `Allow: /`, a sitemap containing the public origin, and the expected `llms.txt` content.

## Custom domain

Attach the custom domain in Cloudflare to `create-stack-marketing` through the Workers & Pages dashboard. Confirm DNS, TLS, the root page, `/build`, `/robots.txt`, `/sitemap.xml`, and `/llms.txt`.

The custom domain is managed in Cloudflare rather than by this workflow. Keep `workers_dev` enabled until the custom domain is serving correctly. Once the custom domain is the only intended endpoint and the migration owner has approved it, make the isolated follow-up change in `marketing/wrangler.jsonc` to set `workers_dev` to `false`, deploy deliberately, and verify both the custom hostname and the absence of the unwanted `workers.dev` endpoint.

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
