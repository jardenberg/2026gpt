# 2026GPT

**What software development in 2026 should look like.**

2026GPT is a proof-of-concept enterprise AI chat platform built on [LibreChat](https://github.com/danny-avila/LibreChat), deployed on Azure. It demonstrates what is possible when you combine modern open-source tools, AI-assisted development, and a willingness to ship fast.

## Why This Exists

Large organizations have solved the hard problems: governance, compliance, model access, infrastructure. What they haven't solved is the user experience. The gap between what employees use at home (ChatGPT, Claude, Gemini) and what they get at work is growing every month.

2026GPT exists to make that gap visible and to show it can be closed, fast. Not by building from scratch, but by standing on the shoulders of a mature open-source platform that already delivers a ChatGPT-class experience.

The point is not model access. Enterprise platforms like Volvo's GenAI Hub already provide a solid model selector with current models. The point is everything the user actually touches: the interface, the features, the workflow, the speed. That's where the gap lives.

## What We're Matching

The goal is full ChatGPT feature parity. LibreChat delivers most of this out of the box:

- **File uploads + analysis**: Drag and drop PDFs, spreadsheets, code files. The AI reads and reasons over them with RAG.
- **Code interpreter**: Execute Python, Node.js, Go, Java and more directly in the chat. Data analysis, visualization, automation.
- **AI Agents with web search**: Autonomous agents that browse the web, use tools, and act on your behalf. The enterprise equivalent of ChatGPT's "GPTs."
- **Artifacts**: Generate and preview live React components, HTML pages, Mermaid diagrams inline.
- **Conversation search**: Typo-tolerant, instant full-text search across all your conversations.
- **Conversation sharing**: Share any conversation via link with colleagues.
- **Image generation**: Create images directly in the chat.
- **Multi-model switching**: Switch between models mid-conversation (GPT-4.1-mini, GPT-5-mini, etc.)
- **Streaming responses**: Real-time token streaming with resume capability.
- **Modern, responsive UI**: Feels like ChatGPT, not like an internal IT portal from 2019.

Each of these is either missing or significantly worse in typical enterprise chat platforms.

## The Stack

- **Foundation**: [LibreChat](https://github.com/danny-avila/LibreChat) (MIT licensed, 35k+ stars, used by Daimler Trucks and others)
- **Models**: OpenAI GPT-4.1-mini (default), GPT-4.1-nano (fast/cheap), Azure OpenAI GPT-5-mini
- **Auth**: LibreChat built-in OAuth2 (Google, Apple, GitHub, Facebook, Discord) + email/password
- **Deployment**: Azure Container Apps
- **Database**: MongoDB Atlas
- **Search**: MeiliSearch
- **Built with**: [Claude Cowork](https://claude.ai) as the development environment

## Authentication

2026GPT uses LibreChat's native OAuth2/OIDC layer (built on Passport.js) for universal login. No external auth service needed.

Supported login methods: Google, Apple, GitHub, Facebook, Discord, and email/password.

Enterprise deployments typically use MS Entra ID, which locks access to a single tenant. 2026GPT needs to be open to anyone with a link, so we use social logins that work for everyone. LibreChat handles this natively: OAuth2 flows, session management, JWT tokens, user registration. Zero additional services required.

For enterprise SSO, LibreChat also supports generic OpenID Connect (Keycloak, Auth0, Azure AD, AWS Cognito). Same config pattern, just different env vars.

## Models

We use cheap models by default since proving output quality isn't the point of this demo. The architecture supports any model:

**Day one (OpenAI direct API, no approval needed):** GPT-4.1-mini (primary, $0.40/$1.60 per M tokens) and GPT-4.1-nano (fast, $0.10/$0.40 per M tokens).

**Day two+ (Azure OpenAI):** GPT-5-mini and GPT-5-nano, available on Azure without registration in Sweden Central.

LibreChat supports switching between providers and models natively. Adding a new model is a config change, not a project.

## Getting Started

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for setup instructions.

## Development Approach

This entire project was built using Claude Cowork, a conversational AI development environment. No traditional IDE. No dedicated dev team. The process is documented in the commit history and project notes.

The barrier to building quality software has fundamentally shifted. The tools exist. The models exist. The open-source ecosystem exists. The limiting factor is mindset and speed of execution.

---

*Built as a demonstration project. Not affiliated with any employer or commercial product.*
