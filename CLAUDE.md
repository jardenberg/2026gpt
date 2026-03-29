# Memory

## Me
JJ (Joakim Jardenberg), joakim@jardenberg.com. Building 2026GPT proof-of-concept to demonstrate what Volvo Group's internal AI chat ("Volvo GPT") should look like. Uses "Big Truck Co" as fictional brand standing in for Volvo Group.

## Working Style & Preferences
- **Verify before proposing.** ALL config keys, API options, Docker tags, CLI flags must be checked against current docs/source before suggesting. No guessing. No inventing keys that might not exist.
- **Give me troubleshooting instructions.** JJ is hands-on and wants to help debug, but needs clear step-by-step guidance (e.g., "go to Deploy logs, filter last 5 minutes, paste the text here"). Don't just say "check the logs" - say exactly where and what to look for.
- Treat as knowledgeable peer. Skip basics.
- Pragmatic, solution-oriented, Scandinavian directness.
- Frustrated by half-baked solutions and trial-and-error. Research first, propose second.
- Reply in same language as prompt (default English).
- No em dashes; use hyphens, commas, parentheses, colons instead.

## Critical Rules
| Rule | Why |
|------|-----|
| **Verify config keys against docs/source** | `customWelcome` crash-loop incident - invented a YAML key that didn't exist in LibreChat's schema |
| **Verify Docker image tags exist** | `main-v1.82.6` tag didn't exist on GHCR |
| **Check feature availability in specific versions** | Complexity router wasn't in `main-stable` (v1.82.3) |
| **Give explicit troubleshooting steps** | JJ wants to help but needs "go here, click this, paste that" instructions |
| **Research before proposing** | Don't propose things that don't work or are half-baked |
| **Check existing config before changing ports/networking** | Changing PORT to 3080 broke Cloudflare routing (was 8080). Always ask what's currently set before changing. |
| **After context compaction, verify actual state** | Don't trust the summary blindly. Check what's actually deployed and running before making claims. |
| **Keep CLAUDE.md updated with all deployed services** | RAG was forgotten because it wasn't in memory. Every service and its status must be tracked here. |
| **Maintain CHANGELOG.md in repo** | Persistent changelog at repo root. Update after every deployment, config change, or service change. No excuses. |
| **Update ALL memory files after every change** | Web search was set up but not recorded anywhere, causing false claims it wasn't done. After any config change, service setup, or deployment: update CLAUDE.md, TASKS.md, CHANGELOG.md, and relevant memory files. |
| **Use `promptPrefix` not `instructions` for custom endpoints** | `instructions` is for assistants endpoints only. Custom endpoints (like "2026GPT") use `promptPrefix` for system prompts. |
| **NEVER commit secrets to git** | LITELLM_MASTER_KEY was committed to CHANGELOG.md. Secrets belong in Railway env vars only, never in repo files. Use placeholders like "(set on Railway)" in docs. |
| **Check repo visibility before any push** | Repo is PUBLIC. Treat every commit as world-readable. Never include API keys, secrets, or credentials in any file, even "documentation". |
| **modelSpecs.enforce must be false** | `enforce: true` blocks agents endpoint from initializing saved agents, causing "Job not found for streamId: undefined". Keep `enforce: false` + `prioritize: true`. See LibreChat discussion #10060. |

## Projects
| Name | What |
|------|------|
| **2026GPT** | LibreChat v0.8.4 PoC on Railway, Big Truck Co branding, LiteLLM complexity routing |

## Tech Stack
| Component | Detail |
|-----------|--------|
| LibreChat | v0.8.4, `ghcr.io/danny-avila/librechat-dev:latest`, Railway |
| LiteLLM | v1.82.6.rc.2, complexity router for auto model selection |
| RAG API | Set up and working with VectorDB (Postgres/pgvector), OpenAI embeddings |
| VectorDB | PostgreSQL with pgvector, backs both LiteLLM dashboard and RAG |
| Web Search | Paid accounts: Serper, Firecrawl, Jina. API keys configured on Railway (set 2026-03-28). |
| Code Interpreter | `thehapyone/code-interpreter` on Railway, connected via LIBRECHAT_CODE_BASEURL |
| Railway | Hosting platform, GitHub auto-deploy |
| Domain | 2026gpt.jardenberg.se (Cloudflare, expects PORT=8080) |
| Config | Fetched from GitHub raw URL via CONFIG_PATH |
| System Prompt | `promptPrefix` field in modelSpecs presets (NOT `instructions`, which is assistants-only) |
| Branding | Big Truck Co - Forge Black (#0C1117), Lifesaver Orange (#FB5604), Inter + JetBrains Mono |

## Railway Services (current production state, 2026-03-29)
| Service | Source | Port | Status |
|---------|--------|------|--------|
| LibreChat | Docker image `ghcr.io/danny-avila/librechat-dev:latest` | 8080 | Working |
| LiteLLM | GitHub repo `/litellm/` dir | 4000 | Working |
| Code Interpreter | `thehapyone/code-interpreter` Docker image | 8000 | Working (cold-start on first request, agent retries OK) |
| RAG API | Railway template | 8000 | Working |
| VectorDB | PostgreSQL with pgvector | 5432 | Working |
| MongoDB | Railway template | 27017 | Working |
| Meilisearch | Railway template | 7700 | Working (search index) |

## Key URLs
| URL | What |
|-----|------|
| https://2026gpt.jardenberg.se | Production LibreChat (Cloudflare) |
| https://litellm-production-716a.up.railway.app/ui | LiteLLM dashboard |
| https://railway.com/project/643635e6-f0ca-44aa-9845-fbb095a0d93a | Railway project |

## Key Files
| File | Location | Purpose |
|------|----------|---------|
| librechat.yaml | `config/librechat.yaml` in GitHub repo | Main LibreChat config (fetched via CONFIG_PATH) |
| LiteLLM config | `litellm/config.yaml` in GitHub repo | LiteLLM proxy + complexity router config |
| CHANGELOG.md | Repo root | Persistent changelog - update after every change |
| Branding assets | `branding/assets/` in repo | Logo SVG, favicons, custom CSS (NOT deployed) |

## Terms
| Term | Meaning |
|------|---------|
| Volvo GPT | Volvo Group's actual internal AI chat (the thing we're competing with) |
| Big Truck Co | Fictional brand standing in for Volvo Group in the PoC |
| Forge Black | #0C1117, primary background color |
| Lifesaver Orange | #FB5604, primary accent color |
| Auto / complexity router | LiteLLM feature that routes prompts to cheap/expensive models based on complexity |
