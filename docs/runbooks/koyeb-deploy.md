# Koyeb Deployment Runbook

This runbook deploys the current TaaS demo as a single Koyeb web service using the repository root `Dockerfile`.

Verified against Koyeb docs on **March 14, 2026**.

## What gets deployed

One Koyeb web service serves:

- `/`
- `/healthz`
- `/demo/hosted-control/`
- `/demo/creator-console/`
- `/v1/*`

The service is built from Git using the repository `Dockerfile`.

## Configuration sources

The repository now supports three layers of configuration, applied in this order:

1. explicit environment variables
2. `.env.deploy`
3. `koyeb.yaml`
4. script defaults

`koyeb.yaml` is a repository-local manifest consumed by `scripts/deploy-koyeb.sh`. It is not an official Koyeb-native manifest format.

## Prerequisites

1. Push this repository to GitHub.
2. Create or verify a Koyeb account.
3. Install the Koyeb CLI:

```bash
brew install koyeb/tap/koyeb
```

Or:

```bash
curl -fsSL https://raw.githubusercontent.com/koyeb/koyeb-cli/master/install.sh | sh
export PATH="$HOME/.koyeb/bin:$PATH"
```

4. Log in:

```bash
koyeb login
```

5. Make sure your local repo has a GitHub `origin` remote, or set `KOYEB_GIT_REPO` manually.

## First deployment

Use the helper script from the repository root:

```bash
scripts/deploy-koyeb.sh
```

If you want shared defaults for both Koyeb and Hugging Face, first copy:

```bash
cp .env.deploy.example .env.deploy
```

Then edit `.env.deploy` and, if desired, `koyeb.yaml`.

Default assumptions:

- app name: `taas-demo`
- service name: same as app name
- branch: current checked-out branch
- port: `8080`

The script will:

1. derive the GitHub repository from `origin` unless `KOYEB_GIT_REPO` is set
2. create the Koyeb app and service if they do not exist
3. configure Dockerfile-based Git deployment
4. set:
   - `PORT=8080`
   - `STATIC_ROOT=/srv/taas`
5. print follow-up log commands and app details

## Useful environment overrides

```bash
KOYEB_APP_NAME=taas-prod-demo
KOYEB_SERVICE_NAME=control-api
KOYEB_GIT_REPO=github.com/your-user/Teledildonics-as-a-Service
KOYEB_GIT_BRANCH=main
KOYEB_APP_PORT=8080
KOYEB_STATIC_ROOT=/srv/taas
KOYEB_WAIT_TIMEOUT=10m
KOYEB_ORGANIZATION=<optional-org-id>
KOYEB_TOKEN=<optional-api-token>
```

Example:

```bash
KOYEB_APP_NAME=taas-main \
KOYEB_GIT_BRANCH=main \
scripts/deploy-koyeb.sh
```

## Manifest file

The repository-local manifest lives at the root:

```yaml
app_name: taas-demo
service_name: taas-demo
git_branch: main
app_port: 8080
static_root: /srv/taas
wait_timeout: 10m
```

You can keep repo-wide defaults there and override them per machine using `.env.deploy` or per command with exported environment variables.

## What the script does under the hood

For a first deploy it uses the same shape Koyeb documents for `koyeb app init`, but with the repo Dockerfile:

```bash
koyeb app init taas-demo \
  --git github.com/your-user/Teledildonics-as-a-Service \
  --git-branch main \
  --git-builder docker \
  --ports 8080:http \
  --routes /:8080 \
  --env PORT=8080 \
  --env STATIC_ROOT=/srv/taas
```

For later deploys, Koyeb automatically rebuilds when you push to the tracked branch. If you want an immediate manual rebuild without code changes, rerun the script and it will call `koyeb services redeploy`.

## Control-panel path

If you prefer the web UI:

1. In Koyeb, click `Create Web Service`.
2. Choose `GitHub`.
3. Pick this repository and branch.
4. Choose `Dockerfile` as the builder.
5. Set a service name and deploy.
6. In environment variables, ensure:
   - `PORT=8080`
   - `STATIC_ROOT=/srv/taas`

## Verification checklist

After deployment, verify:

```bash
curl -I https://<your-app>.koyeb.app/healthz
curl -I https://<your-app>.koyeb.app/demo/hosted-control/
curl -I https://<your-app>.koyeb.app/demo/creator-console/
```

Expected:

- `/healthz` returns `200`
- both demo routes return `200`

## Common issues

### Koyeb account validation blocks deployment

Current Koyeb pricing FAQ states that free users still get a free instance, but account validation may require a payment method.

### The script cannot derive the GitHub repo

Set:

```bash
KOYEB_GIT_REPO=github.com/<user-or-org>/<repo>
```

### The service exists but does not update

Push to the tracked branch or rerun:

```bash
scripts/deploy-koyeb.sh
```

### The app boots but demos do not load

Confirm `STATIC_ROOT=/srv/taas` is present in the service environment.

## References

- Koyeb docs home: https://www.koyeb.com/docs/
- Koyeb pricing FAQ: https://www.koyeb.com/docs/faqs/pricing
- Koyeb build from Git: https://www.koyeb.com/docs/build-and-deploy/build-from-git
- Koyeb CLI install: https://www.koyeb.com/docs/build-and-deploy/cli/installation
- Koyeb CLI reference: https://www.koyeb.com/docs/build-and-deploy/cli/reference
- Koyeb deploy examples: https://www.koyeb.com/docs/deploy/express
