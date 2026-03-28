# 2026GPT Deployment Guide

## Prerequisites

1. Azure subscription with Azure OpenAI access (see AZURE_SETUP_GUIDE.md)
2. Docker and Docker Compose installed locally
3. Azure CLI installed (`az` command)

## Local Development (Quick Start)

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

## Azure Deployment

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
    AZURE_OPENAI_API_KEY=secretref:azure-openai-key \
    MEILI_MASTER_KEY=secretref:meili-key \
    APP_TITLE=2026GPT
```

### 3. Verify

Your app will be available at:
`https://2026gpt-app.<region>.azurecontainerapps.io`

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
