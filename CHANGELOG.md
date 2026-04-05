# 2026GPT Changelog

All notable changes to the 2026GPT project are documented here.
Format: date, what changed, status, and any issues encountered.

---

## 2026-04-05

### Policy Analyst auth bootstrap fix
- Bumped application version to `v0.8.14`
- Fixed the Policy Analyst client to use the same refresh-token bootstrap and bearer-header pattern as the public roadmap interactions
- Root cause:
  - the Policy Analyst route was calling authenticated endpoints with `credentials: include` only
  - the backend answered `401`, and the UI incorrectly collapsed that into the same state as “workflow disabled”
- Added explicit config/auth error handling so auth failures no longer masquerade as a disabled environment
- Result:
  - staging should now be able to discover, upload, refresh, and query against the authenticated Policy Analyst API using the existing session

### Policy Analyst sidebar crash fix
- Bumped application version to `v0.8.13`
- Fixed a client-side regression in `ExpandedPanel.tsx` that caused the staging app to crash with `description is not defined`
- Root cause:
  - a tooltip/label helper line was accidentally inserted into `NewChatButton`, where `link` does not exist
  - `NavIconButton` then referenced `description` without defining it locally
- Result:
  - the `Policy Analyst` sidebar entry can render without taking down the app shell
  - rollback remains isolated to the new workflow branch and staging deploy

### Policy Analyst staging MVP
- Bumped application version to `v0.8.12`
- Added a thin authenticated PageIndex adapter at `/api/policy-analyst` for:
  - runtime feature/config check
  - PDF upload proxying
  - document outline/status fetch
  - grounded question answering with citations
- Added a dedicated authenticated `/policy-analyst` workflow route
- Added a new `Policy Analyst` sidebar entry that opens a workflow panel and workspace
- Kept the current chat/file-search/RAG path untouched so rollback is isolated to the new workflow surface
- MVP scope is intentionally narrow:
  - one policy document at a time
  - PDF only
  - current-session browser persistence only
  - staging-first until the workflow quality is proven
- Local verification completed with:
  - `node --check` on the new backend files
  - `npm run frontend:ci`

### Runtime-configurable staging placeholder mode for public surfaces
- Bumped application version to `v0.8.11`
- Moved the `/dash` and `/roadmap` placeholder switch from build-time Vite env to a runtime public API config endpoint
- Result: staging and production can now differ reliably for public-surface behavior without depending on Railway build-time env injection

### Staging placeholder mode for public surfaces
- Bumped application version to `v0.8.10`
- Added env-driven placeholder mode for `/dash` and `/roadmap` with separate switches for each page
- Added a shared production target setting so staging can point users back to the live public surface
- Staging can now default to placeholder mode while production keeps showing live public metrics and roadmap data
- Result: stage no longer needs to drift publicly on `/dash` and `/roadmap` except when we intentionally flip those surfaces into live test mode

### Unified search and results
- Bumped application version to `v0.8.9`
- Sidebar/history search now returns conversations matched either by conversation metadata or by message content
- Search results now show matching conversations as well as matching message snippets so title-only hits are still visible in the main pane
- Validation completed with `npm run frontend:ci` and `npm run build:data-schemas`; the focused `packages/data-schemas` Jest run is currently blocked by an existing package-resolution issue (`Cannot find module 'librechat-data-provider'`)

### Warning and logging cleanup
- Bumped application version to `v0.8.8`
- Removed both path-level and schema-level duplicate roadmap `slug` index declarations so only the intended unique partial index remains
- Removed the deprecated `CHECK_BALANCE` Railway variable from staging and production
- Lowered LiteLLM log verbosity from `DEBUG` to `INFO` in staging and production so deploy/runtime logs are easier to interpret

## 2026-04-04

### Footer now shows version, contact, and environment
- Bumped application version to `v0.8.6`
- Updated the main chat footer to:
  - `Big Truck Co – Enterprise AI`
  - current app version
  - `joakim@jardenberg.com`
  - current environment label: `PROD` or `STAGING`
- Made the environment label derive from the active app domain/title so staging and production stay aligned without separate footer strings
- Corrected the shared app version constant so the displayed version matches the actual release

### Chat timestamps and advanced date filtering added
- Bumped application version to `v0.8.5`
- Added full, non-obfuscated timestamps beside every `You` and `2026GPT` message in chat and message-search views
- Added full conversation timestamps on hover in the left-hand history list
- Kept the sidebar search simple while adding an `Advanced` entry point for date-range filtering
- Added `startDate` / `endDate` filtering support for:
  - conversation history queries using conversation `updatedAt`
  - message search queries using message `createdAt`
- Added shared timestamp/date utilities in the client to keep rendering and range handling consistent
- Completed the rollout across legacy message renderers and shared-message views so timestamps show consistently for assistant responses as well as user prompts
- Added a follow-up formatter fix so timestamps render as `2026-04-04 19:34 CEST`
- Fixed the advanced search route so the filter panel still renders while search results are loading
- Redesigned search refinement UX so advanced filters now behave like result refinements instead of a separate blank destination
- Hid the sidebar `Advanced` entry point until there is an active search or date filter
- Added a results toolbar with query context, result counts, quick date presets, and inline date-picker inputs
- Removed build-time Vite compression from the client bundle for staging/performance testing, relying on Cloudflare edge compression instead
- Initial local result: client CI build step dropped from about `28.45s` to `22.99s`
- Implementation note:
  - this release intentionally uses Mongo timestamp filtering without a Meilisearch schema migration, to keep rollout risk low while still enabling precise date-based narrowing

## 2026-03-31

### Public dashboard Railway infra cost coverage expanded
- Added live Railway billing integration to the public dashboard using Railway GraphQL
- Added current infrastructure usage, billing-period context, current bill snapshot, and plan/credit data
- Added projected month-end infrastructure usage from Railway `estimatedUsage`
- Added current and projected Railway resource breakdowns for memory, CPU, egress, and volume
- Result: the dashboard no longer treats Railway infrastructure spend as a blind spot

### Public dashboard and public roadmap alpha added (CODE COMPLETE, NOT YET DEPLOYED)
- Added a new public API namespace:
  - `/api/public/dashboard`
  - `/api/public/roadmap`
- Added two new public pages in the client:
  - `/dash`
  - `/roadmap`
- Implemented a Mongo-backed public roadmap collection with:
  - seeded team roadmap items
  - authenticated idea submission
  - authenticated voting
  - authenticated commenting
  - admin-only item updates via API
- Implemented a public dashboard service that aggregates:
  - live MongoDB usage totals
  - live LiteLLM daily activity analytics for LLM spend, requests, tokens, and model mix
  - production/staging health checks
  - explicit cost-coverage reporting for still-uninstrumented spend categories
- Updated `noIndex` behavior so `/dash` and `/roadmap` can be publicly indexable even while the rest of the app remains noindexed
- Result: the first public-facing transparency layer now exists in code, with live LLM and app-usage data paths and a real community roadmap surface
- Remaining gap before calling the dashboard “cost of everything”:
  - search/crawl/rerank spend still needs dedicated instrumentation
  - Railway/infrastructure billing still needs dedicated instrumentation
- Verification note:
  - backend files passed `node --check`
  - frontend build passed locally via `npm run frontend:ci`
  - local dependency install required a one-off `npx npm@11.10.0 install` workaround because the machine's default npm hit an Arborist override error
  - `client` typecheck still has unrelated pre-existing upstream failures and was not used as the acceptance gate for this feature

### Public roadmap sign-in flow hardened and public banners enabled
- Replaced the public roadmap's JS-only login buttons with shared `buildLoginRedirectUrl(...)` login links
- Public sign-in prompts now use real `href` navigation for better reliability
- Reused the existing app-wide `Banner` component in the public layout so emergency/public notices can also appear on `/dash` and `/roadmap`

### Public dashboard search/crawl cost coverage expanded
- Added search/crawl metrics to the public dashboard using stored `web_search` artifacts from MongoDB
- Added estimated Serper and Jina spend based on recent app activity plus current public pricing assumptions
- Added live Firecrawl billing-period credit usage from the Firecrawl team usage API
- Left Railway infrastructure billing explicitly marked as pending rather than faking an invoice-level total

### Public roadmap shipped lane backfilled
- Marked the live public dashboard and public roadmap surfaces as `shipped`
- Added shipped roadmap items for social login, memory, document upload/RAG, agents/code interpreter, web search, and auto model routing
- Kept votes and comments intact while syncing the two already-live public surfaces into the shipped lane
- Fixed a Mongo update conflict in the shipped-roadmap sync path by excluding `slug` from `$set`

### Parity check and observability baseline added (VERIFIED)
- Added repo operator scripts:
  - `scripts/ops/status-snapshot.sh`
  - `scripts/ops/parity-check.sh`
- Added npm shortcuts:
  - `npm run ops:status`
  - `npm run ops:parity`
- Updated the runbook with the new operator workflow
- Verified `ops:status` against the live Railway production and staging environments
- Verified `ops:parity` passes cleanly against the live production and staging environments
- Result: there is now a repeatable baseline check for service health, source/root drift, config drift, and served shell asset drift

### Railway source-of-truth cleanup completed (VERIFIED)
- User disconnected both LibreChat services from their stale image sources in Railway and reconnected them to GitHub repo `jardenberg/2026gpt`
- Verified production `LibreChat` now reports:
  - `source.repo: jardenberg/2026gpt`
  - `source.image: null`
  - `rootDirectory: "."`
- Verified staging `2026GPT Staging` now reports:
  - `source.repo: jardenberg/2026gpt`
  - `source.image: null`
  - `rootDirectory: "."`
- Verified the reconnect rollouts completed successfully:
  - production deployment `0c6acbc9-bce6-4a79-90d5-27b19e834ac1`
  - staging deployment `11586228-946f-4069-9f9c-b9640989559f`
- Result: the old ghost image-source state is gone from Railway and the service metadata now matches reality

### Staging restored to production-twin config baseline (VERIFIED)
- Updated staging `CONFIG_PATH` from the bootstrap branch URL back to the production baseline:
  - `https://raw.githubusercontent.com/jardenberg/2026GPT/main/config/librechat.yaml`
- Verified staging redeploy `e1b6fcf7-164a-4705-abe7-769ed0068c03` reached `SUCCESS`
- Verified staging health remained `200`
- Result: staging now tracks the same LibreChat YAML baseline as production by default

### Production LibreChat deployment path converged with staging (VERIFIED)
- Normalized the production `LibreChat` service instance root from `"/branding"` to `"."` through Railway's GraphQL API using the environment-scoped project token
- Verified the saved production service instance now reports:
  - `rootDirectory: "."`
  - `dockerfilePath: null`
  - `builder: RAILPACK`
- Triggered a fresh production deploy directly from the real repo root:
  - deployment `35e03030-aff0-4b74-b260-5cf4c1d688f9`
- Verified Railway detected the top-level app `Dockerfile` and built the full LibreChat app from repo root without any directory shim
- Verified production health stayed `200` throughout the verification deploy
- Verified the production service reached `SUCCESS` after the repo-root rollout
- Practical result: production and staging now share the same working repo-root deployment path for manual Railway CLI deploys

### Production and staging visual parity restored on the served app shell (VERIFIED)
- Verified both production and staging now serve the same app-shell asset references:
  - `assets/favicon.ico`
  - `assets/favicon-32x32.png`
  - `assets/favicon-16x16.png`
  - `assets/apple-touch-icon-180x180.png`
  - `manifest.webmanifest`
  - `registerSW.js`
- Verified neither environment serves the old `custom.css` overlay anymore
- Verified production and staging now serve the same favicon payload for `assets/favicon-32x32.png`
  - SHA-256: `505f691e2bf57a3ea7f7d163b51c619c404712b6d3ceee8c45c61eba96bac278`
- Verified the remaining differences are intentional only:
  - production title/footer/domain
  - staging title/footer/domain
  - staging branch config path

### Production branding cleanup deploy attempt blocked by service source mismatch (NO PRODUCTION CHANGES)
- Attempted to deploy the prepared `/branding` overlay cleanup to production `LibreChat`
- Production health remained `200` throughout; no live outage occurred
- Railway rejected both CLI deploy attempts before a build started
- Verified blocker from Railway deployment metadata:
  - service source currently reports `image: ghcr.io/danny-avila/librechat-dev:latest`
  - failed deployment metadata reports `configErrors: Could not find root directory: /branding`
- Conclusion at that time: production `LibreChat` was in a mixed image/root-directory state and could not accept the prepared branding overlay deploy through the CLI as-is
- This blocker was resolved later the same day by normalizing the service root and reconnecting both services to the GitHub repo

### Staging social login parity restored (VERIFIED, NO PRODUCTION CHANGES)
- Updated staging `2026GPT Staging` auth flags to match production:
  - `ALLOW_SOCIAL_LOGIN=true`
  - `ALLOW_SOCIAL_REGISTRATION=true`
- Triggered a fresh repo-root deploy of staging after applying the auth changes
- Verified live staging config now returns `socialLoginEnabled: true`
- Verified staging `/health` remains healthy during and after the rollout

### Production branding cleanup prepared in repo (NOT DEPLOYED)
- Removed `custom.css` injection from `branding/Dockerfile`
- The `/branding` overlay is now prepared to act as a static-asset layer only:
  - logo
  - favicon set
  - app icons
- This change is intentionally not deployed yet
- Purpose: bring production visually closer to staging and eliminate the lingering orange Claude-era CSS layer with a low-risk production deploy later

## 2026-03-30

### Staging LiteLLM database auth fix (VERIFIED, NO PRODUCTION CHANGES)
- Root cause found in staging `LiteLLM` logs: Prisma startup was failing with `P1000` because `DATABASE_URL` contained copied credentials that did not match the staging `Postgres` service password
- Backed up the pre-fix staging LiteLLM variable set locally before changing anything
- Replaced the explicit staging `LiteLLM` `DATABASE_URL` with a Railway reference variable:
  - `DATABASE_URL=${{Postgres.DATABASE_URL}}`
- Redeployed staging `LiteLLM`
- Verified staging `LiteLLM` deployment `d122cbaa-5009-4c24-a8f0-7f34d79fac6e` reached `SUCCESS`
- Verified Prisma migration completed, the query engine came up, and Uvicorn started on port `4000`
- Verified the prior auth failure and query-engine crash loop no longer appear in the latest staging logs

### Staging service cleanup completed (VERIFIED, NO PRODUCTION CHANGES)
- User renamed Railway service `LibreChat Branch` to `2026GPT Staging`
- User deleted the old duplicated staging `LibreChat` service
- Verified `https://stage2026gpt.jardenberg.se` still serves the correct repo-backed staging app
- Verified the staging app health check still returns `OK`

### Staging custom domain and topology cleanup (VERIFIED, NO PRODUCTION CHANGES)
- Verified `stage2026gpt.jardenberg.se` is now attached to the correct repo-backed staging service
- Updated staging `LibreChat Branch` runtime domain values:
  - `DOMAIN_CLIENT=https://stage2026gpt.jardenberg.se`
  - `DOMAIN_SERVER=https://stage2026gpt.jardenberg.se`
- Verified the custom staging domain works end-to-end for health, config, and local-auth login
- Confirmed there is no lingering `stage.2026gpt.jardenberg.se` DNS record in Cloudflare
- Restarted staging `LiteLLM`; service returned from `CRASHED` to `SUCCESS`
- Updated staging branch env to use `APP_TITLE=2026GPT Staging`
- Verified live config payload now returns `appTitle: 2026GPT Staging`
- Note: this cleanup was later completed by renaming the repo-backed app service and deleting the old duplicated staging LibreChat service

### Production favicon promotion (DEPLOYED, HEALTHY)
- Promoted the `/branding` Dockerfile overlay to production `LibreChat`
- Railway production deployment `25b60d29-78d1-4472-83a1-6e1d52fa9d00` completed successfully
- Verified `https://2026gpt.jardenberg.se/health` returns `200`
- Verified production `assets/favicon.ico` is updated to the brand-kit asset
- Verified production `assets/favicon-32x32.png` serves the new asset when cache-busted
- Observed stale edge-cache on the unchanged public PNG URL path; this is a CDN cache issue, not a failed deploy
- Attempted targeted Cloudflare purge for favicon assets, but the available token can read zones and DNS only and returned an auth error for cache purge
- Safe rollback path for this production deploy: `railway down -s LibreChat -e production`

### Staging-only footer marker and favicon test (VERIFIED, NO PRODUCTION CHANGES)
- Updated staging `LibreChat Branch` footer marker from `Big Truck Co — Enterprise AI (Staging Branch)` to `Big Truck Co — Enterprise AI | STAGING`
- Replaced staging branch favicon assets with the brand-kit versions:
  - `favicon.ico`
  - `favicon-16x16.png`
  - `favicon-32x32.png`
  - `apple-touch-icon-180x180.png`
  - `icon-192x192.png`
  - `icon-512x512.png`
- Added an explicit `.ico` favicon link to `client/index.html`
- Added the 512x512 icon to the PWA manifest in `client/vite.config.ts`
- Deployed only `LibreChat Branch` in Railway staging
- Verified live staging config payload now returns `customFooter: Big Truck Co — Enterprise AI | STAGING`
- Verified live staging favicon hashes changed to the brand-kit assets while production retained the previous favicon hash

### Staging environment created (NO PRODUCTION CHANGES)
- Created a dedicated `staging` environment in Railway by duplicating `production`
- Verified staging uses Railway-managed domains only, with no custom domain overlap
- Current branch-backed staging URL: `https://librechat-branch-staging.up.railway.app`
- Current inherited image-backed staging URL: `https://librechat-staging-0f57.up.railway.app`

### Branch-backed LibreChat staging service online
- Added a separate `LibreChat Branch` service in Railway staging
- Cloned the staging LibreChat variable set into the branch service
- Overrode staging-specific values:
  - `APP_TITLE=2026GPT Staging Branch`
  - `CUSTOM_FOOTER=Big Truck Co — Enterprise AI (Staging Branch)`
  - `DOMAIN_CLIENT` / `DOMAIN_SERVER` set to the branch staging URL
  - `CONFIG_PATH` set to the `codex/bootstrap-setup` branch raw YAML URL
  - social login disabled for staging
- Deployed repo root from branch `codex/bootstrap-setup` to the branch-backed staging service
- Verified `GET /health` returns `OK` on the branch staging URL

### Staging operational notes
- The duplicated staging `LibreChat` service is still tied to the inherited `/branding` build root and is useful only for image/branding-layer testing
- The new `LibreChat Branch` staging service is the correct target for future repo-backed LibreChat app work
- Restarted staging `LiteLLM` after the duplicated environment came up in a crashed state; service returned to `SUCCESS`

### Outcome
- We now have an isolated place to test repo-backed LibreChat changes without touching production
- Production URL `https://2026gpt.jardenberg.se` was not changed in this session

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
