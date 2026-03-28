# 2026GPT Deployment Guide

## Two paths to running

**Fast path (hours):** OpenAI direct API. Get an API key at platform.openai.com, configure, run. No approval process, no Azure subscription needed. This is how we get a live demo running on day one.

**Full path (days):** Azure OpenAI + Azure Container Apps. Same models, enterprise-grade, runs on the same infra as Volvo GPT. Takes longer because Azure OpenAI access requires approval (up to 10 business days for GPT-5 full; GPT-5-mini and GPT-5-nano are available without registration).

Both paths use the same LibreChat instance. Switching between them is a config change, not a rewrite.

## Prerequisites

- Docker and Docker Compose installed locally
- An OpenAI API key (fast path) and/or Azure subscription (full path)

---

## Local Development (Fast Path)

### 1. Clone the repositories

```bash
# Clone 2026GPT (our config)
git clone https://github.com/jardenberg/2026gpt.git
cd 2026gpt

# Clone LibreChat (the platform)
git clone https://github.com/danny-avila/LibreChat.git librechat
```

### 2. Configure environment

```bash
# Copy our config into LibreChat
cp .env.example librechat/.env
cp config/librechat.yaml librechat/librechat.yaml
cp docker-compose.override.yml librechat/docker-compose.override.yml

# Edit .env with your actual credentials
nano librechat/.env
```

At minimum, set:
- `OPENAI_API_KEY` (from https://platform.openai.com/api-keys)
- `MONGO_URI` (or leave default to use the Docker MongoDB container)

### 3. Generate secrets

```bash
# Generate the required secret keys
echo "CREDS_KEY=$(openssl rand -hex 16)"
echo "CREDS_IV=$(openssl rand -hex 8)"
echo "JWT_SECRET=$(openssl rand -hex 32)"
echo "JWT_REFRESH_SECRET=$(openssl rand -hex 32)"
echo "MEILI_MASTER_KEY=$(openssl rand -hex 16)"
```

Copy these values into your `.env` file.

### 4. Start LibreChat

```bash
cd librechat
docker compose up -d
```

### 5. Access

Open http://localhost:3080 in your browser. Create an account and start chatting.

You should see GPT-4.1-mini and GPT-4.1-nano available as model options.

---

## Switching to Azure OpenAI

Once your Azure subscription and OpenAI resource are provisioned:

1. In `.env`, uncomment and fill in `AZURE_OPENAI_API_KEY`
2. In `config/librechat.yaml`, set `azureOpenAI.enabled: true`
3. Update the Azure instance name and deployment names to match your Azure resource
4. Restart: `docker compose restart`

GPT-5-mini and GPT-5-nano are available in Azure OpenAI (Sweden Central) without a separate registration request. For GPT-5 full, submit a registration at the Azure AI Foundry portal.

---

## Azure Deployment (Full Path)

### 1. Build and push Docker image

```bash
# Login to Azure Container Registry
az acr login --name 2026gptregistry

# Build from LibreChat directory
cd librechat
docker build -t 2026gptregistry.azurecr.io/librechat:latest .
docker push 2026gptregistry.azurecr.io/librechat:latest
```

### 2. Deploy to Azure Container Apps

```bash
# Create the container app
az containerapp create \
  --name 2026gpt-app \
  --resource-group 2026gpt-rg \
  --environment 2026gpt-env \
  --image 2026gptregistry.azurecr.io/librechat:latest \
  --target-port 3080 \
  --ingress external \
  --min-replicas 0 \
  --max-replicas 2 \
  --cpu 1.0 \
  --memory 2.0Gi \
  --env-vars \
    MONGO_URI=secretref:mongo-uri \
    OPENAI_API_KEY=secretref:openai-key \
    MEILI_MASTER_KEY=secretref:meili-key \
    APP_TITLE=2026GPT
```

### 3. Verify

Your app will be available at:
`https://2026gpt-app.<region>.azurecontainerapps.io`

---

## Updating

To deploy updates:

```bash
# Pull latest LibreChat
cd librechat
git pull

# Rebuild and push
docker build -t 2026gptregistry.azurecr.io/librechat:latest .
docker push 2026gptregistry.azurecr.io/librechat:latest

# Restart the container app
az containerapp revision restart \
  --name 2026gpt-app \
  --resource-group 2026gpt-rg
```

## Current Model Pricing (March 2026)

| Model | Input (per M tokens) | Output (per M tokens) | Best for |
|-------|---------------------|-----------------------|----------|
| GPT-4.1-nano | $0.10 | $0.40 | Quick tasks, high volume |
| GPT-4.1-mini | $0.40 | $1.60 | Default, good balance |
| GPT-4.1 | $2.00 | $8.00 | Complex reasoning |
| GPT-5-mini (Azure) | TBD | TBD | Azure-native, no registration |
| GPT-5-nano (Azure) | TBD | TBD | Azure-native, cheapest |
