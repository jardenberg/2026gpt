# 2026GPT - LiteLLM Proxy
# PINNED to v1.82.6 - versions 1.82.7 and 1.82.8 were compromised
# See: https://docs.litellm.ai/blog/security-update-march-2026

FROM ghcr.io/berriai/litellm:main-stable

COPY config.yaml /app/config.yaml

# Railway sets PORT via env var, default to 4000
ENV PORT=4000

CMD ["--config", "/app/config.yaml", "--port", "4000"]
