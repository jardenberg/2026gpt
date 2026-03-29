# 2026GPT — Big Truck Co branded LibreChat
# Extends the official LibreChat image with custom branding assets
# Brand Kit v2.1: Scandinavian-Industrial, Lifesaver Orange, Forge Black

FROM ghcr.io/danny-avila/librechat:v0.8.4

# Copy brand assets over the defaults
COPY assets/logo.svg /app/client/dist/assets/logo.svg
COPY assets/favicon-16x16.png /app/client/dist/assets/favicon-16x16.png
COPY assets/favicon-32x32.png /app/client/dist/assets/favicon-32x32.png
COPY assets/apple-touch-icon-180x180.png /app/client/dist/assets/apple-touch-icon-180x180.png
COPY assets/favicon.ico /app/client/dist/assets/favicon.ico
COPY assets/custom.css /app/client/dist/assets/custom.css

# Inject custom CSS into the main HTML file
RUN sed -i 's|</head>|<link rel="stylesheet" href="/assets/custom.css" /></head>|' /app/client/dist/index.html
