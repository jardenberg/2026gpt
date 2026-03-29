# 2026GPT Changelog

All notable changes to the 2026GPT project are documented here.
Format: date, what changed, status, and any issues encountered.

---

## 2026-03-29
### Fixed
- Deleted broken CLAUDE.md symlink that was blocking ALL Railway deploys (LiteLLM, LibreChat)
  - Previous session overwrote the git symlink with 6KB of content, exceeding filesystem path length limit
  - git clone failed with "file name too long" on every deploy attempt
- Fixed web search: added `webSearch: true` to all 4 model specs (shows the Search toggle)
- Fixed web search: added `web_search` to agents capabilities list (makes search actually fire)
  - Per LibreChat discussion #7581, web_search must be in endpoints.agents.capabilities
- Web search now working end-to-end with Serper (search) + Firecrawl (scraping) + Jina (reranking)

### Fix Firecrawl/Jina scraping - env var references (VERIFIED WORKING)
- Root cause: LibreChat's `extractWebSearchEnvVars()` uses regex to extract env var names from config
- Literal values like `'https://api.firecrawl.dev'` fail the regex and return null
- `loadWebSearchAuth()` silently skips services when auth fields can't be resolved
- Changed `firecrawlApiUrl`, `firecrawlVersion`, `jinaApiUrl` from literal values to \${ENV_VAR} references
- Added 3 new Railway env vars: FIRECRAWL_API_URL, FIRECRAWL_VERSION, JINA_API_URL
- Removed `firecrawlOptions` block (timeout, onlyMainContent, blockAds, formats) to reduce variables
- Startup logs no longer show "Web search configuration error" warnings
- Tested: "Go to jardenberg.se and summarize homepage" returns scraped content with citations

### Fix agents endpoint - modelSpecs enforce:false (VERIFIED WORKING)
- Root cause: `modelSpecs.enforce: true` blocks agents endpoint from initializing saved agents
- Changed to `enforce: false` while keeping `prioritize: true` (curated model list still shows first)
- Fix documented in LibreChat GitHub discussion #10060
- Agents now fully operational: saved agents respond, code execution works

### Code Interpreter service added (VERIFIED WORKING)
- Deployed `ghcr.io/thehapyone/code-interpreter:latest` on Railway (port 8000)
- Connected via LIBRECHAT_CODE_BASEURL and LIBRECHAT_CODE_API_KEY env vars
- Agents config added to librechat.yaml with capabilities: execute_code, file_search, actions, tools
- First /exec call may timeout (cold start), but agent retries successfully
- Tested: "Code Runner v2" agent runs Python code and returns formatted output

### Web search fully working (Serper + Firecrawl + Jina)
- Added `webSearch:` block to librechat.yaml with explicit provider selection
- Added `firecrawlApiUrl`, `jinaApiUrl`, `firecrawlVersion` - without these, LibreChat tried to resolve missing env vars and silently failed
- All three components verified working: Serper (search), Firecrawl (page scraping), Jina (reranking)

### System prompt fix (promptPrefix)
- `preset.instructions` does NOT work for custom endpoints (assistants-only field)
- Changed to `preset.promptPrefix` in all four model specs - this is the correct field for custom (OpenAI-compatible) endpoints
- Commit: c00f21eec
- Pending: JJ to restart LibreChat and verify in a new conversation

### Rollback complete (VERIFIED WORKING)
- Rolled back LibreChat to Docker image `ghcr.io/danny-avila/librechat-dev:latest`
- PORT restored to 8080 (Cloudflare expects this)
- Fixed RAG_API_URL: changed from variable reference to explicit `http://rag-api.railway.internal`
- All services verified working: model router, RAG, LiteLLM dashboard, custom domain, model selector, footer branding
- Added `CONFIG_BYPASS_VALIDATION=true` as safety net (kept)

### Branding deployment (FAILED - ROLLED BACK)
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

### Fix web search - add webSearch: true to model specs (PENDING VERIFICATION)
- Web search stopped working after the enforce:false change + redeploy
- Root cause: LibreChat v0.8.3+ scopes tool badges by model spec context (PR #11796)
- Without `webSearch: true` on each spec, the search tool is not passed to the LLM at execution time
- The UI toggle appeared but the model responded "I can't do live web search"
- Fix: Added `webSearch: true` to all 4 model specs (auto, gpt-5.4-nano, gpt-5.4-mini, gpt-5.4)

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
| LITELLM_MASTER_KEY | (set on Railway - never commit secrets to git) |
| RAG_API_URL | `http://rag-api.railway.internal` |
| APP_TITLE | 2026GPT |
| CUSTOM_FOOTER | Big Truck Co - Enterprise AI |
| ENDPOINTS | openAI,custom,agents |
| CONFIG_BYPASS_VALIDATION | true |
| FIRECRAWL_API_URL | https://api.firecrawl.dev |
| FIRECRAWL_VERSION | v1 |
| JINA_API_URL | https://api.jina.ai/v1/rerank |

## Domain
- `2026gpt.jardenberg.se` via Cloudflare, proxied to Railway LibreChat service on port 8080
