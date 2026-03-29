# 2026GPT Changelog

All notable changes to the 2026GPT project are documented here.
Format: date, what changed, status, and any issues encountered.

---

## 2026-03-29

### Branding deployment (FAILED - ROLLING BACK)
- Created `branding/Dockerfile` extending `ghcr.io/danny-avila/librechat-dev:latest`
- Added brand assets: logo.svg (512x512 double-chevron), favicons (all sizes), custom.css
- Custom CSS: Forge Black backgrounds, Lifesaver Orange accent, Inter + JetBrains Mono fonts
- Injected CSS via `sed` on index.html
- **BROKE PRODUCTION**: `customWelcome` key in librechat.yaml was invalid (not in LibreChat schema), caused crash-loop
- **BROKE CLOUDFLARE**: Changed PORT from 8080 to 3080 without checking existing Cloudflare config
- **BROKE RAG**: Redeployment disrupted RAG API connectivity
- **BROKE LiteLLM dashboard**: Dashboard became inaccessible after redeployment
- Added `CONFIG_BYPASS_VALIDATION=true` env var as safety net
- CSS partially loaded but most selectors didn't match actual LibreChat DOM elements
- **Status**: Rolling back to Docker image source `ghcr.io/danny-avila/librechat-dev:latest` with PORT=8080

### Config changes
- Removed invalid `customWelcome` key from `config/librechat.yaml`
- Added `APP_TITLE=2026GPT` and `CUSTOM_FOOTER=Big Truck Co — Enterprise AI` as env vars (these work)

---

## 2026-03-28

### LiteLLM complexity router (WORKING)
- Deployed LiteLLM v1.82.6.rc.2 on Railway (GitHub repo, `/litellm/` dir)
- Configured complexity-based routing: SIMPLE->nano, MEDIUM->mini, COMPLEX->gpt-5.4, REASONING->gpt-5.4
- Default routes to nano (cost-optimized)
- Custom endpoint "2026GPT" in librechat.yaml pointing to LiteLLM proxy
- Model specs: Auto (default), GPT-5.4 Nano, GPT-5.4 Mini, GPT-5.4
- `modelSpecs.enforce: true` + `addedEndpoints: ["agents"]` to control model selector
- **Status**: Working, verified routing to all three tiers

### LiteLLM dashboard (WORKING)
- Added PostgreSQL (VectorDB) to Railway for LiteLLM dashboard + RAG
- Dashboard accessible at `https://litellm-production-716a.up.railway.app/ui`
- Fixed "Not connected to DB" error by adding DATABASE_URL
- **Status**: Working (before branding deploy broke it)

### RAG API (WORKING)
- RAG API deployed via Railway template
- Connected to VectorDB (Postgres/pgvector) for embeddings storage
- OpenAI embeddings provider configured
- `RAG_API_URL=http://rag-api.railway.internal` on LibreChat service
- JWT_SECRET shared between LibreChat and RAG API
- Tested with PDF upload - works
- **Status**: Working (before branding deploy broke it)

### Model selector cleanup (WORKING)
- Hid raw OpenAI endpoint from users via `modelSpecs.enforce: true`
- Removed Pro and Codex from selector to control costs
- Added `ENDPOINTS=openAI,custom,agents` env var
- **Status**: Working

---

## Railway Services (pre-branding, all working)

| Service | Source | Port | Notes |
|---------|--------|------|-------|
| LibreChat | Docker image `ghcr.io/danny-avila/librechat-dev:latest` | 8080 | Cloudflare expects 8080 |
| LiteLLM | GitHub repo `/litellm/` dir | 4000 | Internal: `http://LiteLLM.railway.internal:4000/v1` |
| RAG API | Railway template | 8000 | Internal: `http://rag-api.railway.internal` |
| VectorDB | PostgreSQL with pgvector | 5432 | Backs LiteLLM dashboard + RAG |
| MongoDB | Railway template | 27017 | LibreChat data store |

## Key Environment Variables (LibreChat)

| Variable | Value |
|----------|-------|
| PORT | 8080 (Cloudflare expects this) |
| CONFIG_PATH | `https://raw.githubusercontent.com/jardenberg/2026GPT/main/config/librechat.yaml` |
| LITELLM_BASE_URL | `http://LiteLLM.railway.internal:4000/v1` |
| LITELLM_MASTER_KEY | sk-litellm-2026gpt-x7Kp9mWqR3vLnJ2d |
| RAG_API_URL | `http://rag-api.railway.internal` |
| APP_TITLE | 2026GPT |
| CUSTOM_FOOTER | Big Truck Co — Enterprise AI |
| ENDPOINTS | openAI,custom,agents |
| CONFIG_BYPASS_VALIDATION | true |

## Domain
- `2026gpt.jardenberg.se` via Cloudflare, proxied to Railway LibreChat service on port 8080
