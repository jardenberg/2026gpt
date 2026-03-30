# 2026GPT — Big Truck Co branded LibreChat
# Extends the official LibreChat image with custom branding assets
# Brand Kit v2.1: Scandinavian-Industrial, Lifesaver Orange, Forge Black

FROM ghcr.io/danny-avila/librechat-dev:latest

# Copy brand assets over the defaults.
# Keep this overlay limited to static assets so production can stay visually
# aligned with the repo-backed app instead of carrying a parallel CSS theme.
COPY assets/logo.svg /app/client/dist/assets/logo.svg
COPY assets/favicon-16x16.png /app/client/dist/assets/favicon-16x16.png
COPY assets/favicon-32x32.png /app/client/dist/assets/favicon-32x32.png
COPY assets/apple-touch-icon-180x180.png /app/client/dist/assets/apple-touch-icon-180x180.png
COPY assets/favicon.ico /app/client/dist/assets/favicon.ico
COPY assets/icon-192x192.png /app/client/dist/assets/icon-192x192.png
COPY assets/icon-512x512.png /app/client/dist/assets/icon-512x512.png

# Also update favicon.ico reference if it exists
RUN if [ -f /app/client/dist/favicon.ico ]; then \
      cp /app/client/dist/assets/favicon.ico /app/client/dist/favicon.ico; \
    fi

# Expose the port LibreChat listens on (Railway needs this)
EXPOSE 3080
ENV HOST=0.0.0.0

# Inherit the default start command from the base image
CMD ["npm", "run", "backend"]
