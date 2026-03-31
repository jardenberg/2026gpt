# 2026GPT Operations Runbook

This is the working runbook for safe changes, verification, and rollback.

The goal is simple:

- low friction
- low drama
- obvious rollback

## Core Rules

1. Work on a branch, not on `main`
2. Push the branch early so there is always a remote checkpoint
3. Change one deployment surface at a time
4. Verify after each change before stacking another one
5. Never paste secrets into repo files
6. Treat Railway variables as the only source of truth for secrets

## Verified Working Context

Verified on March 30, 2026:

- GitHub CLI authenticated
- Railway CLI authenticated
- Railway project: `abundant-unity`
- Railway environment: `production`
- Live services visible from CLI

Verified later on March 30, 2026:

- Railway staging environment exists and is isolated from production
- Branch-backed staging LibreChat URL: `https://librechat-branch-staging.up.railway.app`
- Inherited image-backed staging LibreChat URL: `https://librechat-staging-0f57.up.railway.app`

Verified on March 31, 2026:

- Production `LibreChat` accepts normal repo-root Railway CLI deploys again
- Production `LibreChat` service instance root is normalized to `.`
- Staging `2026GPT Staging` service instance root is normalized to `.`
- Production verification deploy `35e03030-aff0-4b74-b260-5cf4c1d688f9` built from the real repo root and completed successfully
- Production and staging now serve the same app-shell favicon/PWA asset set
- Production `LibreChat` is reconnected to GitHub repo `jardenberg/2026gpt`
- Staging `2026GPT Staging` is reconnected to GitHub repo `jardenberg/2026gpt`
- Both Railway LibreChat services are intended to track branch `main` when idle
- Staging `CONFIG_PATH` is back on the `main` baseline

Current working repo path:

- `/Users/joakimjardenberg/Library/Mobile Documents/com~apple~CloudDocs/Cowork/2026GPT/repo`

## Branch Workflow

Recommended workflow for every change:

```bash
git switch -c codex/<short-task-name>
git push -u origin codex/<short-task-name>
```

That gives us:

- isolated work
- remote backup
- easy PR creation
- clean rollback path

## Railway Basics

Link the project:

```bash
railway project link -p abundant-unity
```

Link a service when focusing on it:

```bash
railway service link LibreChat
railway service link LiteLLM
```

Check current context:

```bash
railway status
railway service status --all
```

Operator shortcuts in this repo:

```bash
npm run ops:status
npm run ops:parity
```

- `ops:status` prints the live service snapshot for production and staging
- `ops:parity` fails if prod/stage drift outside the intentional differences

## Safe Inspection Commands

List service names and statuses:

```bash
railway service status --all
```

Show recent deploy logs:

```bash
railway service logs --service LibreChat --lines 50
railway service logs --service LiteLLM --lines 50
```

Show build logs:

```bash
railway service logs --service LiteLLM --build --lines 50
```

Show recent HTTP errors:

```bash
railway service logs --service LibreChat --http --status '>=400' --lines 50
```

List environment variable **names only**:

```bash
railway run --service LibreChat env | cut -d= -f1 | sort
```

Generate the live operator snapshot:

```bash
npm run ops:status
```

Run the parity check:

```bash
npm run ops:parity
```

## Deploy Surface Map

### Surface A: `config/librechat.yaml`

Use this for:

- interface settings
- model list
- prompt prefixes
- web search
- memory
- agent capabilities

How it reaches production:

1. Merge to `main`
2. Restart `LibreChat`

Rollback:

1. Revert the commit on `main`
2. Restart `LibreChat`

### Surface B: `litellm/config.yaml`

Use this for:

- router tiers
- model routing
- LiteLLM behavior

How it reaches production:

1. Merge to `main`
2. Railway rebuilds/redeploys `LiteLLM`

Rollback:

1. Revert the commit on `main`
2. Let Railway rebuild `LiteLLM`

### Surface C: Railway variables

Use this for:

- secrets
- OAuth config
- service URLs
- runtime flags

How it reaches production:

- edit in Railway
- expect restart/redeploy behavior for the affected service

Rollback:

- restore the previous value immediately

### Surface D: general LibreChat app code

Current reality:

- repo-root LibreChat deploys work in both production and staging
- production `LibreChat` and staging `2026GPT Staging` are both normalized to `rootDirectory=.`
- both services are reconnected to GitHub repo `jardenberg/2026gpt`
- both services should point to branch `main` when not actively testing a feature branch
- repo-backed LibreChat testing should still go to `2026GPT Staging` first

Before changing app code for production intent, decide whether we are:

- changing staging only
- or promoting the same repo-root app change to production

Default steady state:

- production service source: `jardenberg/2026gpt` on `main`
- staging service source: `jardenberg/2026gpt` on `main`
- production `CONFIG_PATH`: `https://raw.githubusercontent.com/jardenberg/2026GPT/main/config/librechat.yaml`
- staging `CONFIG_PATH`: `https://raw.githubusercontent.com/jardenberg/2026GPT/main/config/librechat.yaml`
- intentional env differences:
  - `APP_TITLE`
  - `CUSTOM_FOOTER`
  - `DOMAIN_CLIENT`
  - `DOMAIN_SERVER`

Verified deploy commands:

```bash
source "$HOME/.config/codex-secrets/railway.env"
export RAILWAY_TOKEN="$RAILWAY_TOKEN_STAGING"
railway up -s '2026GPT Staging' -e staging -d

export RAILWAY_TOKEN="$RAILWAY_TOKEN_PRODUCTION"
railway up -s LibreChat -e production -d
```

If the saved service root ever drifts away from repo root, repair it before deploying:

```bash
source "$HOME/.config/codex-secrets/railway.env"

curl -sS 'https://backboard.railway.com/graphql/v2' \
  -H 'Content-Type: application/json' \
  -H "Project-Access-Token: $RAILWAY_TOKEN_PRODUCTION" \
  --data '{"query":"mutation($serviceId:String!,$environmentId:String!,$input:ServiceInstanceUpdateInput!){ serviceInstanceUpdate(serviceId:$serviceId, environmentId:$environmentId, input:$input) }","variables":{"serviceId":"89baa974-4804-44e0-b45f-0f586fb62077","environmentId":"555086f4-095c-4ba6-bcf7-b1935d6df21a","input":{"rootDirectory":"."}}}'
```

Re-check the saved service instance state:

```bash
source "$HOME/.config/codex-secrets/railway.env"

curl -sS 'https://backboard.railway.com/graphql/v2' \
  -H 'Content-Type: application/json' \
  -H "Project-Access-Token: $RAILWAY_TOKEN_PRODUCTION" \
  --data '{"query":"query($serviceId:String!,$environmentId:String!){ serviceInstance(environmentId:$environmentId, serviceId:$serviceId){ serviceName rootDirectory dockerfilePath builder source { image repo } } }","variables":{"serviceId":"89baa974-4804-44e0-b45f-0f586fb62077","environmentId":"555086f4-095c-4ba6-bcf7-b1935d6df21a"}}' | jq
```

## Staging Targets

Use the correct staging target for the kind of change:

- `2026GPT Staging`:
  `https://stage2026gpt.jardenberg.se`
  Canonical repo-backed staging app for frontend, backend, config, and branch-based validation.

- Railway fallback host for the same service:
  `https://librechat-branch-staging.up.railway.app`
  Use only as a fallback or for direct Railway verification.

## Change Procedure

For any non-trivial production change:

1. Identify the exact surface you are changing
2. Create or switch to a dedicated branch
3. Make the smallest viable change
4. Push branch
5. Review diff
6. Merge only when rollback is obvious
7. Apply the minimal live action needed
8. Verify immediately
9. Record the outcome in `CHANGELOG.md`

## Verification Procedure

Minimum verification:

```bash
curl https://2026gpt.jardenberg.se/health
railway service status --all
```

Feature verification should match the change:

- config change: check the affected UI/control/behavior
- routing change: inspect LiteLLM logs and a real request
- search change: verify search tool is visible and executes
- auth change: verify login flow
- file/RAG change: upload a file and ask a question about it

## Rollback Procedure

If a change causes uncertainty:

1. Stop changing other surfaces
2. Identify whether the issue is config, env var, or service build
3. Roll back only that surface
4. Re-run health check
5. Re-run the exact broken user flow

Practical examples:

- bad YAML config: revert `config/librechat.yaml`, restart `LibreChat`
- bad LiteLLM router config: revert `litellm/config.yaml`, redeploy `LiteLLM`
- bad env var: restore old value in Railway, redeploy affected service
- bad staging database credential wiring: prefer Railway reference vars like `${{Postgres.DATABASE_URL}}` over copied connection strings

## Current Known Risks

- Local planning docs and repo docs have drifted
- Historical secret-handling mistakes mean secret scrubbing should remain part of every cleanup pass
- `LITELLM_LOG=DEBUG` is still enabled in production
- Duplicated Railway environments can copy stale explicit credentials; validate any `DATABASE_URL`-style vars against the env-local service before trusting them
- Staging can drift again if we temporarily point its Railway source or `CONFIG_PATH` away from `main` and forget to restore it

## Immediate Priorities

1. Keep docs synchronized with live Railway reality
2. Scrub any remaining plain-text secrets from local notes
3. Avoid mixing product work with deployment-model changes unless necessary
4. Build opinionated demo workflows only after the operating baseline is stable
