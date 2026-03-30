# 2026GPT Deployment Guide

This document describes the **current** deployment model for 2026GPT as of March 30, 2026.

The important distinction is simple:

- Production runs on **Railway**
- DNS and public routing run through **Cloudflare**
- `LibreChat` production behavior is controlled by Railway env vars plus `config/librechat.yaml` from this repo
- `LiteLLM` is built from this repo and deployed on Railway
- Azure remains a possible future path, not the current one

## Production Topology

Public entrypoint:

- `https://2026gpt.jardenberg.se`

Railway project:

- Project: `abundant-unity`
- Environment: `production`

Current services:

| Service | Role | Current behavior |
| --- | --- | --- |
| `LibreChat` | Main app and API | Official image, runtime-configured via `CONFIG_PATH` |
| `LiteLLM` | Proxy and complexity router | Built from `litellm/` in this repo |
| `code-interpreter` | Sandboxed code execution | Separate service |
| `RAG API` | File ingestion and retrieval | Separate service |
| `VectorDB` | pgvector backing store | Separate service |
| `Postgres` | Postgres backing store | Separate service |
| `MongoDB` | Primary app database | Separate service |
| `Meilisearch` | Conversation search | Separate service |

## Configuration Split

Production config intentionally lives in two places:

### Railway variables

Use Railway variables for:

- secrets
- OAuth credentials
- service URLs
- runtime toggles
- deploy-time configuration

Examples:

- `OPENAI_API_KEY`
- `LITELLM_MASTER_KEY`
- `GITHUB_CLIENT_SECRET`
- `GOOGLE_CLIENT_SECRET`
- `JWT_SECRET`
- `PORT`
- `CONFIG_PATH`

### Repo-managed config

Use repo files for:

- product behavior
- model curation
- web search config
- agent capabilities
- LiteLLM router behavior
- documentation and operating instructions

Key files:

- `config/librechat.yaml`
- `litellm/config.yaml`
- `CHANGELOG.md`
- `docs/OPERATIONS.md`

## Current Live Values Verified

The following non-secret values were verified against Railway on March 30, 2026:

### LibreChat

- `APP_TITLE=2026GPT`
- `CUSTOM_FOOTER=Big Truck Co — Enterprise AI`
- `CONFIG_PATH=https://raw.githubusercontent.com/jardenberg/2026GPT/main/config/librechat.yaml`
- `PORT=8080`
- `ENDPOINTS=openAI,custom,agents`
- `LITELLM_BASE_URL=http://LiteLLM.railway.internal:4000/v1`
- `RAG_API_URL=http://rag-api.railway.internal`
- `LIBRECHAT_CODE_BASEURL=http://code-interpreter.railway.internal:8000`

### LiteLLM

- `PORT=4000`
- `LITELLM_LOG=DEBUG`
- `DATABASE_URL` present
- `OPENAI_API_KEY` present
- `LITELLM_MASTER_KEY` present

## Deployment Paths

Not every code change affects production the same way.

### 1. `config/librechat.yaml` changes

Use this path for:

- model selector changes
- web search changes
- agent capability changes
- memory settings
- interface behavior

Deployment behavior:

1. Commit and merge the config change to `main`
2. Restart the `LibreChat` service on Railway
3. Verify `/health`
4. Verify the affected UI/API behavior

Why a restart is needed:

- `LibreChat` reads the YAML from `CONFIG_PATH` on startup

### 2. `litellm/config.yaml` or `litellm/Dockerfile` changes

Use this path for:

- complexity router changes
- model routing changes
- LiteLLM image pinning

Deployment behavior:

1. Commit and merge the change to `main`
2. Railway rebuilds and redeploys the `LiteLLM` service from this repo
3. Verify LiteLLM logs and dashboard behavior

### 3. Railway variable changes

Use this path for:

- API keys
- OAuth values
- service URLs
- runtime flags

Deployment behavior:

1. Update variables in Railway
2. Expect a redeploy unless explicitly skipped
3. Verify the affected service after restart/redeploy

### 4. General LibreChat code changes in this repo

Important:

- These do **not** currently affect the live `LibreChat` service by default

Why:

- Production `LibreChat` is still running from the official image, not a repo-backed service build

If we want repo code changes to affect production, we need a separate decision:

- switch `LibreChat` to a repo-backed Railway build
- or publish and deploy a custom image

## Local Development

This repo is already the codebase.

Typical local setup:

```bash
npm install
npm run build
```

For Railway-backed local checks:

```bash
railway project link -p abundant-unity
railway service link LibreChat
railway status
```

To inspect environment names safely without printing values:

```bash
railway run --service LibreChat env | cut -d= -f1 | sort
```

## Verification Checklist

After any production change:

1. `curl https://2026gpt.jardenberg.se/health`
2. Check `railway service status --all`
3. Check relevant service logs
4. Verify the user-facing feature that changed
5. Record the change in `CHANGELOG.md`

## Rollback Summary

- `librechat.yaml` mistake: revert commit on `main`, restart `LibreChat`
- LiteLLM config mistake: revert commit on `main`, let Railway rebuild `LiteLLM`
- env var mistake: restore prior value in Railway, redeploy/restart affected service
- uncertain state: use `docs/OPERATIONS.md` and verify one service at a time instead of changing multiple surfaces together

## Azure

Azure is still a valid future enterprise deployment path. It should be treated as a future architecture option, not as the current operating model for this repository.
