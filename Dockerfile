# Multi-platform Dockerfile for MCP servers
# Usage:
# For Server 1 (Smithery): docker build --build-arg VARIANT=smithery .
# For Server 2 (Glama): docker build --build-arg VARIANT=glama .

# First declaration – so it’s available for the *first* FROM that needs it
ARG VARIANT=smithery           

FROM node:lts-alpine        AS smithery-base
FROM debian:bullseye-slim   AS glama-base

# <— scope of the first ARG ends here

# Second declaration – makes VARIANT visible again
ARG VARIANT                 

FROM ${VARIANT}-base AS base


# Common environment setup
ENV DEBIAN_FRONTEND=noninteractive
WORKDIR /app

# Conditional setup based on variant
RUN if [ "$VARIANT" = "glama" ]; then \
      # Glama-specific setup (without Python)
      groupadd -r service-user && \
      useradd -u 1987 -r -m -g service-user service-user && \
      mkdir -p /home/service-user/.local/bin /app && \
      chown -R service-user:service-user /home/service-user /app && \
      apt-get update && \
      apt-get install -y --no-install-recommends \
        build-essential curl wget software-properties-common \
        libssl-dev zlib1g-dev git && \
      curl -fsSL https://deb.nodesource.com/setup_21.x | bash - && \
      apt-get install -y nodejs && \
      npm install -g mcp-proxy@3.0.3 pnpm@9.15.5 bun@1.1.42 && \
      apt-get clean && \
      rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*; \
    fi

# Switch to service user for Glama
USER ${VARIANT:+service-user}

# Code setup - conditional based on variant
COPY package.json package-lock.json ./

RUN if [ "$VARIANT" = "glama" ]; then \
      # Glama: Clone from git
      rm -rf * && \
      git clone https://github.com/effieklimi/ensembl-mcp-server . && \
      git checkout 602823d08b21cb4d78eaac1c57522f00716078f8 && \
      npm install --production; \
    else \
      # Smithery: Use local files
      npm install --production; \
    fi

# Copy source code (only for Smithery)
RUN if [ "$VARIANT" = "smithery" ]; then \
      # This will be handled by COPY instruction below
      echo "Source will be copied"; \
    fi

# Copy source for Smithery
COPY --chown=${VARIANT:+service-user:service-user} . .

# Build step
RUN if [ "$VARIANT" = "smithery" ]; then \
      npm install esbuild --no-save && \
      mkdir -p dist && \
      npx esbuild src/index.ts \
        --bundle --platform=node --format=esm \
        --external:@modelcontextprotocol/sdk/server/index.js \
        --external:@modelcontextprotocol/sdk/server/stdio.js \
        --external:@modelcontextprotocol/sdk/types.js \
        --outfile=dist/index.js; \
    else \
      # Glama might need different build process
      if [ -f "package.json" ] && grep -q "\"build\"" package.json; then \
        npm run build 2>/dev/null || echo "No build script found"; \
      fi; \
    fi

# Conditional CMD based on variant
CMD if [ "$VARIANT" = "glama" ]; then \
      exec mcp-proxy node dist/index.js; \
    else \
      exec node dist/index.js; \
    fi
