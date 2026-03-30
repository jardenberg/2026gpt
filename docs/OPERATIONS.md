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

- repo code changes do not currently affect production `LibreChat`
- production `LibreChat` is image-backed and config-driven
- repo-backed LibreChat testing should go to `LibreChat Branch` in the `staging` environment first

Before changing app code for production intent, decide whether we are:

- staying config-first
- or moving `LibreChat` to a repo-backed/custom-image deployment model

## Staging Targets

Use the correct staging target for the kind of change:

- `LibreChat Branch`:
  `https://librechat-branch-staging.up.railway.app`
  Use this for repo-root LibreChat app changes, frontend work, backend work, and branch-based validation.

- `LibreChat` in staging:
  `https://librechat-staging-0f57.up.railway.app`
  This is the duplicated image-backed service and still tracks the inherited `/branding` build root. Use it only for image/branding-layer experiments unless we intentionally repurpose it.

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

## Current Known Risks

- Local planning docs and repo docs have drifted
- Production `LibreChat` is not yet repo-built, which can confuse expectations
- Historical secret-handling mistakes mean secret scrubbing should remain part of every cleanup pass
- `LITELLM_LOG=DEBUG` is still enabled in production

## Immediate Priorities

1. Keep docs synchronized with live Railway reality
2. Scrub any remaining plain-text secrets from local notes
3. Avoid mixing product work with deployment-model changes unless necessary
4. Build opinionated demo workflows only after the operating baseline is stable
