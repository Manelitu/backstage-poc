# Backstage POC — Multi-Backend

POC pessoal para estudo do [Backstage](https://backstage.io) em arquitetura **multi-backend**: cada domínio funcional roda em processo isolado, com deploy e escala independentes.

---

## Índice

- [Visão Geral](#visão-geral)
- [Pré-requisitos](#pré-requisitos)
- [Início Rápido — Docker](#início-rápido--docker)
- [Início Rápido — Desenvolvimento Local](#início-rápido--desenvolvimento-local)
- [Configuração do GitHub OAuth](#configuração-do-github-oauth)
- [Modos de Uso](#modos-de-uso)
- [Backends](#backends)
- [Documentação](#documentação)

---

## Visão Geral

```
Browser
  │
  ▼
:7007  packages/backend        ← Proxy / SPA host (único endpoint público)
  │
  ├──► :7008  backend-auth     ← Auth (GitHub OAuth, sessões)
  ├──► :7009  backend-core     ← Catalog · Permission · Search
  ├──► :7010  backend-content  ← Scaffolder · TechDocs
  └──► :7011  backend-aux      ← Kubernetes · Notifications · Signals · MCP
```

O frontend **nunca conhece** as portas dos feature backends — ele só fala com `:7007`. Todo o roteamento é transparente via reverse proxy.

---

## Pré-requisitos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) 4.x+
- Node.js 22 ou 24 (apenas para desenvolvimento local)
- Yarn 4.4.1 (gerenciado via `packageManager` no `package.json`)
- Conta GitHub com permissão para criar OAuth Apps

---

## Início Rápido — Docker

**1. Configure as variáveis de ambiente**

```bash
cp .env.example .env
# edite .env e preencha AUTH_GITHUB_CLIENT_ID e AUTH_GITHUB_CLIENT_SECRET
```

**2. Configure o GitHub OAuth App** (veja [seção abaixo](#configuração-do-github-oauth))

**3. Suba todos os serviços**

```bash
docker compose --profile full up --build
```

**4. Acesse**

```
http://localhost:7007
```

---

## Início Rápido — Desenvolvimento Local

**1. Instale as dependências**

```bash
yarn install
```

**2. Configure os segredos**

```bash
cp app-config.local.yaml.example app-config.local.yaml  # se existir
# ou crie app-config.local.yaml manualmente (veja ARCHITECTURE.md § 7)
```

**3. Suba tudo**

```bash
yarn start:all
```

O comando inicia os 5 backends e o webpack dev server com ordem de dependência correta.

**URLs de desenvolvimento:**

| Serviço | URL |
|---------|-----|
| Frontend (webpack) | http://localhost:3000 |
| Proxy / SPA | http://localhost:7007 |
| Auth | http://localhost:7008 |
| Catalog · Permission · Search | http://localhost:7009 |
| Scaffolder · TechDocs | http://localhost:7010 |
| Kubernetes · Notifications · Signals · MCP | http://localhost:7011 |

---

## Configuração do GitHub OAuth

Crie um OAuth App em **GitHub → Settings → Developer settings → OAuth Apps → New OAuth App**:

| Campo | Valor |
|-------|-------|
| Application name | `Backstage POC` (ou qualquer nome) |
| Homepage URL | `http://localhost:7007` |
| Authorization callback URL | `http://localhost:7007/api/auth/github/handler/frame` |

Copie o **Client ID** e o **Client Secret** para o `.env` (Docker) ou `app-config.local.yaml` (dev local):

```yaml
# app-config.local.yaml
auth:
  providers:
    github:
      development:
        clientId: <CLIENT_ID>
        clientSecret: <CLIENT_SECRET>
```

---

## Modos de Uso

### Tudo no Docker (recomendado para demo/staging)

```bash
docker compose --profile full up --build
# acesse http://localhost:7007
```

### Híbrido: backends no Docker, frontend local

```bash
# Terminal 1
docker compose up --build

# Terminal 2
yarn start:frontend   # proxy (7007) + webpack (3000)
# acesse http://localhost:3000
```

### Tudo local (sem Docker)

```bash
yarn start:all
# acesse http://localhost:3000
```

---

## Backends

| Pacote | Porta | Plugins | README |
|--------|-------|---------|--------|
| `packages/backend` | 7007 | Proxy + App | [README](packages/backend/README.md) |
| `packages/backend-auth` | 7008 | Auth (GitHub, Guest) | [README](packages/backend-auth/README.md) |
| `packages/backend-core` | 7009 | Catalog · Permission · Search | [README](packages/backend-core/README.md) |
| `packages/backend-content` | 7010 | Scaffolder · TechDocs | [README](packages/backend-content/README.md) |
| `packages/backend-aux` | 7011 | Kubernetes · Notifications · Signals · MCP | [README](packages/backend-aux/README.md) |
| `packages/backend-common` | — | `multiBackendDiscovery` (lib) | [README](packages/backend-common/README.md) |

---

## Documentação

| Documento | Conteúdo |
|-----------|----------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Arquitetura detalhada, fluxos, configuração, como adicionar backends |
| [Docker.md](Docker.md) | Guia completo de Docker: build, variáveis, troubleshooting |
| [MULTI_BACKEND.md](MULTI_BACKEND.md) | Decisão de arquitetura: do monólito ao multi-backend |
| [docs/](docs/) | Decisões de arquitetura e docs de referência |
