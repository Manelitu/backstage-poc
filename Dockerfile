# syntax=docker/dockerfile:1.7
# =============================================================================
# Backstage Multi-Backend — unified multi-stage Dockerfile
#
# Produz cinco imagens independentes, uma por backend, usando --target:
#   docker build --target backend-auth    -t backstage/auth    .
#   docker build --target backend-core    -t backstage/core    .
#   docker build --target backend-content -t backstage/content .
#   docker build --target backend-aux     -t backstage/aux     .
#   docker build --target backend-proxy   -t backstage/proxy   .
#
# Ou sobe tudo de uma vez:
#   docker compose build && docker compose up
#
# Rede corporativa com certificado auto-assinado:
#   docker compose build --build-arg YARN_ENABLE_STRICT_SSL=false
# =============================================================================

ARG NODE_VERSION=24

# ─────────────────────────────────────────────────────────────────────────────
# base — imagem slim com toolchain nativa para addons Node.js
# ─────────────────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-trixie-slim AS base

ENV PYTHON=/usr/bin/python3

# python3 + g++ + build-essential → isolate-vm (plugin-scaffolder-backend)
# libsqlite3-dev                  → better-sqlite3 (banco de dados local/dev)
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && \
    apt-get install -y --no-install-recommends \
        python3 g++ build-essential libsqlite3-dev && \
    rm -rf /var/lib/apt/lists/*

# ─────────────────────────────────────────────────────────────────────────────
# deps-dev — instalação completa (dev + prod) para compilar TypeScript
# ─────────────────────────────────────────────────────────────────────────────
FROM base AS deps-dev

# Desabilitar verificação SSL em redes corporativas com cert auto-assinado.
# Alternativa mais segura: montar o CA corporativo via --secret.
ARG YARN_ENABLE_STRICT_SSL=true
ENV YARN_ENABLE_STRICT_SSL=${YARN_ENABLE_STRICT_SSL}

USER node
WORKDIR /app

# Arquivos do Yarn — camada separada para cache máximo
COPY --chown=node:node .yarn       ./.yarn
COPY --chown=node:node .yarnrc.yml yarn.lock backstage.json package.json ./

# Skeletons: apenas package.json de cada workspace.
# Mudanças no código-fonte não invalidam o cache de dependências.
COPY --chown=node:node packages/backend-common/package.json   ./packages/backend-common/
COPY --chown=node:node packages/backend/package.json          ./packages/backend/
COPY --chown=node:node packages/backend-auth/package.json     ./packages/backend-auth/
COPY --chown=node:node packages/backend-core/package.json     ./packages/backend-core/
COPY --chown=node:node packages/backend-content/package.json  ./packages/backend-content/
COPY --chown=node:node packages/backend-aux/package.json      ./packages/backend-aux/
COPY --chown=node:node packages/app/package.json              ./packages/app/

RUN --mount=type=cache,target=/home/node/.cache/yarn,sharing=locked,uid=1000,gid=1000 \
    yarn install --immutable

# ─────────────────────────────────────────────────────────────────────────────
# builder — compila TypeScript + todos os backends + SPA frontend
# ─────────────────────────────────────────────────────────────────────────────
FROM deps-dev AS builder

# Código-fonte completo — invalidação de cache só quando o código muda
COPY --chown=node:node . .

# 1. Declaration files TypeScript em todo o monorepo
RUN yarn tsc

# 2. Compila os quatro feature-backends + proxy gateway em paralelo
RUN yarn build:backends

# 3. Bundle do React SPA — consumido pelo proxy via plugin-app-backend
RUN yarn workspace app build

# ─────────────────────────────────────────────────────────────────────────────
# prod-deps — node_modules só com dependências de produção
#             compartilhado entre todos os runtime stages
# ─────────────────────────────────────────────────────────────────────────────
FROM base AS prod-deps

ARG YARN_ENABLE_STRICT_SSL=true
ENV YARN_ENABLE_STRICT_SSL=${YARN_ENABLE_STRICT_SSL}

USER node
WORKDIR /app

COPY --chown=node:node .yarn       ./.yarn
COPY --chown=node:node .yarnrc.yml yarn.lock backstage.json package.json ./
COPY --chown=node:node packages/backend-common/package.json   ./packages/backend-common/
COPY --chown=node:node packages/backend/package.json          ./packages/backend/
COPY --chown=node:node packages/backend-auth/package.json     ./packages/backend-auth/
COPY --chown=node:node packages/backend-core/package.json     ./packages/backend-core/
COPY --chown=node:node packages/backend-content/package.json  ./packages/backend-content/
COPY --chown=node:node packages/backend-aux/package.json      ./packages/backend-aux/
COPY --chown=node:node packages/app/package.json              ./packages/app/

RUN --mount=type=cache,target=/home/node/.cache/yarn,sharing=locked,uid=1000,gid=1000 \
    yarn workspaces focus --all --production

# =============================================================================
# RUNTIME STAGES
# Cada stage é uma imagem enxuta com apenas o necessário para um backend.
# Herdam: base (system packages) + prod-deps (node_modules) + builder (dist/).
# =============================================================================

# ─────────────────────────────────────────────────────────────────────────────
# backend-auth — Autenticação  (porta 7008)
#   Discovery key: auth
# ─────────────────────────────────────────────────────────────────────────────
FROM base AS backend-auth

ENV NODE_ENV=production \
    NODE_OPTIONS="--no-node-snapshot"

USER node
WORKDIR /app

COPY --chown=node:node --from=prod-deps /app/node_modules ./node_modules
COPY --chown=node:node --from=prod-deps /app/package.json ./package.json

# backend-common é bundled pelo CLI; copiamos a fonte como fallback de resolução
COPY --chown=node:node --from=builder /app/packages/backend-common/package.json ./packages/backend-common/
COPY --chown=node:node --from=builder /app/packages/backend-common/src           ./packages/backend-common/src

COPY --chown=node:node --from=builder /app/packages/backend-auth/package.json ./packages/backend-auth/
COPY --chown=node:node --from=builder /app/packages/backend-auth/dist          ./packages/backend-auth/dist

# Config em camadas: base → overrides de produção → porta/CORS específicos do backend
COPY --chown=node:node app-config.yaml app-config.production.yaml ./
COPY --chown=node:node packages/backend-auth/app-config.yaml ./packages/backend-auth/

EXPOSE 7008

CMD ["node", "packages/backend-auth", \
     "--config", "app-config.yaml", \
     "--config", "app-config.production.yaml", \
     "--config", "packages/backend-auth/app-config.yaml"]

# ─────────────────────────────────────────────────────────────────────────────
# backend-core — Catalog + Permission + Search  (porta 7009)
#   Discovery keys: catalog, permission, search
# ─────────────────────────────────────────────────────────────────────────────
FROM base AS backend-core

ENV NODE_ENV=production \
    NODE_OPTIONS="--no-node-snapshot"

USER node
WORKDIR /app

COPY --chown=node:node --from=prod-deps /app/node_modules ./node_modules
COPY --chown=node:node --from=prod-deps /app/package.json ./package.json

COPY --chown=node:node --from=builder /app/packages/backend-common/package.json ./packages/backend-common/
COPY --chown=node:node --from=builder /app/packages/backend-common/src           ./packages/backend-common/src

COPY --chown=node:node --from=builder /app/packages/backend-core/package.json ./packages/backend-core/
COPY --chown=node:node --from=builder /app/packages/backend-core/dist          ./packages/backend-core/dist

COPY --chown=node:node app-config.yaml app-config.production.yaml ./
COPY --chown=node:node packages/backend-core/app-config.yaml ./packages/backend-core/

# Catálogo precisa dos exemplos de entidades para ingestão inicial
COPY --chown=node:node examples ./examples

EXPOSE 7009

CMD ["node", "packages/backend-core", \
     "--config", "app-config.yaml", \
     "--config", "app-config.production.yaml", \
     "--config", "packages/backend-core/app-config.yaml"]

# ─────────────────────────────────────────────────────────────────────────────
# backend-content — Scaffolder + TechDocs  (porta 7010)
#   Discovery keys: scaffolder, techdocs
# ─────────────────────────────────────────────────────────────────────────────
FROM base AS backend-content

ENV NODE_ENV=production \
    NODE_OPTIONS="--no-node-snapshot"

USER node
WORKDIR /app

COPY --chown=node:node --from=prod-deps /app/node_modules ./node_modules
COPY --chown=node:node --from=prod-deps /app/package.json ./package.json

COPY --chown=node:node --from=builder /app/packages/backend-common/package.json ./packages/backend-common/
COPY --chown=node:node --from=builder /app/packages/backend-common/src           ./packages/backend-common/src

COPY --chown=node:node --from=builder /app/packages/backend-content/package.json ./packages/backend-content/
COPY --chown=node:node --from=builder /app/packages/backend-content/dist          ./packages/backend-content/dist

COPY --chown=node:node app-config.yaml app-config.production.yaml ./
COPY --chown=node:node packages/backend-content/app-config.yaml ./packages/backend-content/

# Templates do Scaffolder são lidos em runtime pelo backend
COPY --chown=node:node examples ./examples

EXPOSE 7010

CMD ["node", "packages/backend-content", \
     "--config", "app-config.yaml", \
     "--config", "app-config.production.yaml", \
     "--config", "packages/backend-content/app-config.yaml"]

# ─────────────────────────────────────────────────────────────────────────────
# backend-aux — Kubernetes + Notifications + Signals + MCP Actions  (porta 7011)
#   Discovery keys: kubernetes, notifications, signals, mcp-actions
# ─────────────────────────────────────────────────────────────────────────────
FROM base AS backend-aux

ENV NODE_ENV=production \
    NODE_OPTIONS="--no-node-snapshot"

USER node
WORKDIR /app

COPY --chown=node:node --from=prod-deps /app/node_modules ./node_modules
COPY --chown=node:node --from=prod-deps /app/package.json ./package.json

COPY --chown=node:node --from=builder /app/packages/backend-common/package.json ./packages/backend-common/
COPY --chown=node:node --from=builder /app/packages/backend-common/src           ./packages/backend-common/src

COPY --chown=node:node --from=builder /app/packages/backend-aux/package.json ./packages/backend-aux/
COPY --chown=node:node --from=builder /app/packages/backend-aux/dist          ./packages/backend-aux/dist

COPY --chown=node:node app-config.yaml app-config.production.yaml ./
COPY --chown=node:node packages/backend-aux/app-config.yaml ./packages/backend-aux/

EXPOSE 7011

CMD ["node", "packages/backend-aux", \
     "--config", "app-config.yaml", \
     "--config", "app-config.production.yaml", \
     "--config", "packages/backend-aux/app-config.yaml"]

# ─────────────────────────────────────────────────────────────────────────────
# backend-proxy — API Gateway + host do React SPA  (porta 7007)
#   Plugins: app-backend, proxy-backend
#   Roteia tráfego do browser para os feature-backends via discovery config
# ─────────────────────────────────────────────────────────────────────────────
FROM base AS backend-proxy

ENV NODE_ENV=production \
    NODE_OPTIONS="--no-node-snapshot"

USER node
WORKDIR /app

COPY --chown=node:node --from=prod-deps /app/node_modules ./node_modules
COPY --chown=node:node --from=prod-deps /app/package.json ./package.json

COPY --chown=node:node --from=builder /app/packages/backend-common/package.json ./packages/backend-common/
COPY --chown=node:node --from=builder /app/packages/backend-common/src           ./packages/backend-common/src

COPY --chown=node:node --from=builder /app/packages/backend/package.json ./packages/backend/
COPY --chown=node:node --from=builder /app/packages/backend/dist          ./packages/backend/dist

# SPA estático pré-compilado — servido pelo plugin-app-backend
COPY --chown=node:node --from=builder /app/packages/app/package.json ./packages/app/
COPY --chown=node:node --from=builder /app/packages/app/dist         ./packages/app/dist

COPY --chown=node:node app-config.yaml app-config.production.yaml ./

EXPOSE 7007

CMD ["node", "packages/backend", \
     "--config", "app-config.yaml", \
     "--config", "app-config.production.yaml"]
