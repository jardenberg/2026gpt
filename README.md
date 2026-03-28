# 2026GPT

**What software development in 2026 should look like.**

2026GPT is a proof-of-concept enterprise AI chat platform built on [LibreChat](https://github.com/danny-avila/LibreChat), deployed on Azure with Azure OpenAI models. It demonstrates what is possible when you combine modern open-source tools, AI-assisted development, and a willingness to ship fast.

## Why This Exists

Enterprise AI tools don't have to be slow, feature-poor, or years behind what's commercially available. Using the same infrastructure, models, and governance constraints that large organizations already have in place, this project shows that a radically better user experience can be built in hours, not months.

## The Stack

- **Foundation**: [LibreChat](https://github.com/danny-avila/LibreChat) (MIT licensed, 35k+ stars)
- **Models**: Azure OpenAI (GPT-4o, GPT-4o-mini)
- **Deployment**: Azure Container Apps
- **Database**: MongoDB Atlas
- **Search**: MeiliSearch
- **Built with**: [Claude Cowork](https://claude.ai) as the development environment

## Features

- Multi-model switching (GPT-4o / GPT-4o-mini)
- File uploads with RAG (retrieval-augmented generation)
- Code interpreter (Python, Node.js, Go, Java, and more)
- AI Agents with web search and tool use
- Artifacts (live React, HTML, Mermaid rendering)
- Conversation search, bookmarks, tags, and sharing
- Enterprise authentication (OAuth2, LDAP, SAML)
- Image generation via DALL-E 3

## Getting Started

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for setup instructions.

## Development Approach

This entire project was built using Claude Cowork, a conversational AI development environment. No traditional IDE. No dedicated dev team. The process is documented in the commit history and project notes.

The point: the barrier to building quality software has fundamentally shifted. The tools exist. The models exist. The limiting factor is mindset and speed of execution.

---

*Built as a demonstration project. Not affiliated with any employer or commercial product.*
