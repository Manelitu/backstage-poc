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

# 2. Bundle do React SPA — deve vir antes dos backends porque o bundle.tar.gz
#    do proxy (backstage-cli) captura packages/app/dist/ no momento do build
RUN yarn workspace app build

# 3. Compila os backends; o proxy já encontra packages/app/dist/ pronto
RUN yarn build:backends

# ─────────────────────────────────────────────────────────────────────────────
# prod-deps — node_modules só com dependências de produção
#             Fornece addons nativos (better-sqlite3, pg-native) que não podem
#             ser bundlados pelo CLI e são externalizados no bundle.tar.gz.
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
#
# Cada backend é empacotado em bundle.tar.gz pelo backstage-cli.
# O arquivo contém: dist/index.cjs.js + package.json dos workspaces.
# Os addons nativos (better-sqlite3) vêm do stage prod-deps.
#
# Extração em /app:
#   tar xzf bundle.tar.gz  →  packages/<name>/dist/index.cjs.js
#                              packages/<name>/package.json
#                              package.json  (raiz)
#                              yarn.lock
# =============================================================================

# ─────────────────────────────────────────────────────────────────────────────
# backend-auth — Autenticação  (porta 7008)
# ─────────────────────────────────────────────────────────────────────────────
FROM base AS backend-auth

ENV NODE_ENV=production \
    NODE_OPTIONS="--no-node-snapshot"

USER node
WORKDIR /app

# Addons nativos
COPY --chown=node:node --from=prod-deps /app/node_modules ./node_modules

# Bundle compilado — contém dist/index.cjs.js + package.json dos workspaces
COPY --chown=node:node --from=builder /app/packages/backend-auth/dist/bundle.tar.gz ./
RUN tar xzf bundle.tar.gz && rm bundle.tar.gz

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
# ─────────────────────────────────────────────────────────────────────────────
FROM base AS backend-core

ENV NODE_ENV=production \
    NODE_OPTIONS="--no-node-snapshot"

USER node
WORKDIR /app

COPY --chown=node:node --from=prod-deps /app/node_modules ./node_modules

COPY --chown=node:node --from=builder /app/packages/backend-core/dist/bundle.tar.gz ./
RUN tar xzf bundle.tar.gz && rm bundle.tar.gz

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
# ─────────────────────────────────────────────────────────────────────────────
FROM base AS backend-content

ENV NODE_ENV=production \
    NODE_OPTIONS="--no-node-snapshot"

USER node
WORKDIR /app

COPY --chown=node:node --from=prod-deps /app/node_modules ./node_modules

COPY --chown=node:node --from=builder /app/packages/backend-content/dist/bundle.tar.gz ./
RUN tar xzf bundle.tar.gz && rm bundle.tar.gz

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
# ─────────────────────────────────────────────────────────────────────────────
FROM base AS backend-aux

ENV NODE_ENV=production \
    NODE_OPTIONS="--no-node-snapshot"

USER node
WORKDIR /app

COPY --chown=node:node --from=prod-deps /app/node_modules ./node_modules

COPY --chown=node:node --from=builder /app/packages/backend-aux/dist/bundle.tar.gz ./
RUN tar xzf bundle.tar.gz && rm bundle.tar.gz

COPY --chown=node:node app-config.yaml app-config.production.yaml ./
COPY --chown=node:node packages/backend-aux/app-config.yaml ./packages/backend-aux/

EXPOSE 7011

CMD ["node", "packages/backend-aux", \
     "--config", "app-config.yaml", \
     "--config", "app-config.production.yaml", \
     "--config", "packages/backend-aux/app-config.yaml"]

# ─────────────────────────────────────────────────────────────────────────────
# backend-proxy — API Gateway + host do React SPA  (porta 7007)
#   O bundle.tar.gz do backend já inclui packages/app/dist/ (SPA estático).
# ─────────────────────────────────────────────────────────────────────────────
FROM base AS backend-proxy

ENV NODE_ENV=production \
    NODE_OPTIONS="--no-node-snapshot"

USER node
WORKDIR /app

COPY --chown=node:node --from=prod-deps /app/node_modules ./node_modules

COPY --chown=node:node --from=builder /app/packages/backend/dist/bundle.tar.gz ./
RUN tar xzf bundle.tar.gz && rm bundle.tar.gz

COPY --chown=node:node app-config.yaml app-config.production.yaml ./

EXPOSE 7007

CMD ["node", "packages/backend", \
     "--config", "app-config.yaml", \
     "--config", "app-config.production.yaml"]
