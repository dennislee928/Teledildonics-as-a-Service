# Hugging Face Spaces Deployment Runbook

This runbook deploys the current TaaS browser demo and Go API to a Docker Space.

Verified against Hugging Face docs on **March 14, 2026**.

## What gets deployed

The Space runs the repository as a Docker app and serves:

- `/`
- `/healthz`
- `/demo/hosted-control/`
- `/demo/creator-console/`
- `/v1/*`

The Space is a **demo host**, not the primary control-plane host.

## Why this works

Hugging Face Docker Spaces support arbitrary Dockerfiles, and the Space port can be declared in the repository `README.md` metadata using `app_port`.

For this repository, the cleanest path is:

- keep the application listening on `8080`
- create a dedicated Space repo
- push a minimal staged copy of this repo to that Space

## Configuration sources

The repository now supports shared deployment defaults through `.env.deploy`.

Priority order for the Space deploy script:

1. explicit environment variables
2. `.env.deploy`
3. script defaults

## Prerequisites

1. Create a Hugging Face account.
2. Create a write-scoped token from:

https://huggingface.co/settings/tokens

3. Install the `hf` CLI:

```bash
curl -LsSf https://hf.co/cli/install.sh | bash
```

4. Authenticate:

```bash
hf auth login --token "$HF_TOKEN" --add-to-git-credential
```

Or export `HF_TOKEN` before running the deploy script.

## First deployment

From the repository root:

```bash
cp .env.deploy.example .env.deploy
```

Then set at minimum:

```bash
HF_SPACE_ID=<namespace>/<space-name>
```

Deploy with:

```bash
HF_SPACE_ID=<namespace>/<space-name> \
scripts/deploy-hf-space.sh
```

Example:

```bash
HF_SPACE_ID=your-user/taas-demo \
scripts/deploy-hf-space.sh
```

The script will:

1. create the Space if it does not exist
2. stage only the files needed for the Docker Space
3. generate a Space-specific `README.md` with:
   - `sdk: docker`
   - `app_port: 8080`
4. force-push the staged repo to the Space repository

Safety note:

- local `.env` files, `.github/`, docs, and deployment-only helpers are excluded from the staged Space push

## Useful environment overrides

```bash
HF_SPACE_ID=<namespace>/<space-name>
HF_SPACE_BRANCH=main
HF_SPACE_TITLE=TaaS Demo
HF_SPACE_EMOJI=🛰️
HF_SPACE_COLOR_FROM=red
HF_SPACE_COLOR_TO=orange
HF_SPACE_PRIVATE=false
HF_SPACE_STAGE_DIR=.tmp-deploy/hf-space
HF_USERNAME=<your-hf-username-if-needed-for-authenticated-git-push>
HF_TOKEN=<write-token>
```

Notes:

- `HF_SPACE_ID` is required.
- `HF_USERNAME` is only needed when the script cannot derive your username from `hf auth whoami` and you are using token-based git push.

## GitHub Actions auto-deploy

The repository includes:

- [deploy-hf-space.yml](/Users/dennis_leedennis_lee/Documents/GitHub/Teledildonics-as-a-Service/.github/workflows/deploy-hf-space.yml)

Set these in GitHub before enabling it:

- Repository secret:
  - `HF_TOKEN`
- Repository variables:
  - `HF_SPACE_ID`
  - optionally `HF_SPACE_BRANCH`
  - optionally `HF_SPACE_TITLE`
  - optionally `HF_SPACE_EMOJI`
  - optionally `HF_SPACE_COLOR_FROM`
  - optionally `HF_SPACE_COLOR_TO`
  - optionally `HF_SPACE_PRIVATE`
  - optionally `HF_USERNAME`

The workflow runs on pushes to `main` that touch deploy-relevant files, and also supports manual dispatch.

## Control-panel path

If you prefer the web UI:

1. Go to `https://huggingface.co/new-space`.
2. Choose a Space name.
3. Select `Docker` as the SDK.
4. Create the Space.
5. Push repository contents to the Space repo.
6. Make sure the Space root `README.md` includes:

```md
---
title: TaaS Demo
emoji: "🛰️"
colorFrom: red
colorTo: orange
sdk: docker
app_port: 8080
---
```

## Post-deploy verification

Once the Space finishes building, verify:

- `https://<namespace>-<space-name>.hf.space/`
- `https://<namespace>-<space-name>.hf.space/healthz`
- `https://<namespace>-<space-name>.hf.space/demo/hosted-control/`
- `https://<namespace>-<space-name>.hf.space/demo/creator-console/`

## Important limitations

- Free CPU Spaces sleep when idle.
- Free disk is not persistent by default.
- A Docker Space rebuilds on each push.
- This is fine for demos, but not a strong choice for reliable webhook ingestion or always-on realtime relay paths.

## Common issues

### Space builds but does not answer traffic

Confirm the generated or committed `README.md` sets:

```yaml
sdk: docker
app_port: 8080
```

### Push authentication fails

Either:

- run `hf auth login --add-to-git-credential`, or
- export both `HF_TOKEN` and `HF_USERNAME`

### A stale file remains in the Space repo

The deploy script uses a staged git repo and `--force` push specifically to make the Space mirror deterministic.

## References

- Spaces overview: https://huggingface.co/docs/hub/en/spaces-overview
- Docker Spaces: https://huggingface.co/docs/hub/main/en/spaces-sdks-docker
- Spaces config reference: https://huggingface.co/docs/hub/en/spaces-config-reference
- Managing Spaces with GitHub Actions: https://huggingface.co/docs/hub/en/spaces-github-actions
- HF CLI guide: https://huggingface.co/docs/huggingface_hub/guides/cli
- Upload files to the Hub: https://huggingface.co/docs/huggingface_hub/guides/upload
- Manage your Space: https://huggingface.co/docs/huggingface_hub/guides/manage-spaces
