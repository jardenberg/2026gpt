# 2026GPT

**What software development in 2026 should look like.**

2026GPT is a proof-of-concept enterprise AI chat platform built on top of [LibreChat](https://github.com/danny-avila/LibreChat). It exists to demonstrate what a modern internal AI assistant should feel like when the team optimizes for product quality, speed, and leverage instead of rebuilding commodity chat infrastructure from scratch.

The point is not "we found access to the same models." The point is that product execution still matters: interface quality, document handling, web search, tool use, memory, cost control, and the overall feeling of competence.

## Current Status

- Live production URL: [https://2026gpt.jardenberg.se](https://2026gpt.jardenberg.se)
- Current deployment: Railway + Cloudflare
- Current state: working MVP in active development
- Current visible product layer: LibreChat + LiteLLM complexity routing + RAG + Code Interpreter + web search + memory

## Why This Exists

Large organizations have already solved the hard platform prerequisites: governance, compliance, model procurement, identity, hosting, and procurement. What they often have not solved is the actual product experience.

2026GPT is an argument that the gap between consumer AI tools and internal enterprise AI tools is now mostly a product problem, not a raw capability problem. The PoC uses "Big Truck Co" as a fictional heavy-industry brand to make the point without borrowing real corporate branding.

## Current Production Architecture

- `LibreChat` is the main web app and API surface.
- `LiteLLM` sits in front of OpenAI and handles the `Auto` complexity-based routing model.
- `RAG API` and `VectorDB` handle file ingestion and document retrieval.
- `code-interpreter` provides sandboxed execution for agent/code workflows.
- `MongoDB` stores users, conversations, memory, and config state.
- `Meilisearch` powers conversation search.
- `Cloudflare` fronts the public domain and proxying.
- `Railway` hosts the running services.

## What Is Customized Here

This repository is a LibreChat fork plus a thin product/configuration layer for the PoC.

The most important project-owned files are:

- `config/librechat.yaml`: main LibreChat runtime behavior loaded by production via `CONFIG_PATH`
- `litellm/config.yaml`: model routing and LiteLLM proxy configuration
- `branding/assets/*`: brand assets and experimental theme layer
- `CHANGELOG.md`: project-level deployment and debugging history
- `docs/OPERATIONS.md`: production workflow, rollback, and CLI runbook

## What Production Actually Uses

The production setup is intentionally hybrid:

- The live `LibreChat` service currently uses the official LibreChat image plus runtime configuration from `config/librechat.yaml`.
- The live `LiteLLM` service is built from this repository's `litellm/` directory on Railway.
- Secrets and runtime settings live in Railway environment variables.

That means not every commit in this repo changes production in the same way:

- Changes to `config/librechat.yaml` affect production after merge to `main` and a `LibreChat` restart.
- Changes to `litellm/config.yaml` affect production after merge to `main` and Railway redeploys `LiteLLM`.
- Changes to general LibreChat app code in this repo do **not** affect the current production `LibreChat` service until that service is switched from the official image to a repo-backed or custom image workflow.

## Capabilities Demonstrated

- Complexity-based model routing with `Auto`
- Curated model selector
- File upload and document Q&A
- AI agents with tools
- Sandboxed code execution
- Web search with search + scrape + rerank
- Cross-conversation memory
- Social login
- Modern chat UX on top of an open source base

## Current Model Strategy

The current user-facing model strategy is intentionally simple:

- `Auto`: default route via LiteLLM complexity router
- `GPT-5.4 Nano`: fastest and cheapest
- `GPT-5.4 Mini`: middle tier
- `GPT-5.4`: full reasoning tier

The router defaults to `gpt-5.4-nano` for cheap/simple work and escalates only when needed.

## Local Development

This repo is already the working codebase. You do not need a second LibreChat checkout.

Typical local workflow:

```bash
npm install
npm run build
```

For production-oriented operations and rollback procedures, use the docs below instead of relying on old setup notes.

## Documentation

- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): current Railway deployment model and release paths
- [docs/OPERATIONS.md](docs/OPERATIONS.md): branch workflow, verification, rollback, and Railway CLI usage
- [CHANGELOG.md](CHANGELOG.md): historical project changes and incidents

## Azure

Azure remains a possible future enterprise path. It is not the current production deployment path for this PoC.

## Security Note

This is a demonstration project, not a hardened enterprise product. The goal is to prove the product and workflow thesis quickly, then harden the parts worth keeping.

That does not change the basic rule: secrets belong in Railway environment variables, never in repo files.
