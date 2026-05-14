# Arquitetura — Backstage POC

> Backstage v1.50+ · Node.js 22/24 · Yarn 4.4.1 · TypeScript 5.8 · Multi-backend

---

## Índice

1. [Visão Geral](#1-visão-geral)
2. [Estrutura de Pastas](#2-estrutura-de-pastas)
3. [Backends e Responsabilidades](#3-backends-e-responsabilidades)
4. [Como os Plugins Funcionam](#4-como-os-plugins-funcionam)
5. [Como os Backends se Conectam](#5-como-os-backends-se-conectam)
6. [Fluxo de uma Requisição](#6-fluxo-de-uma-requisição)
7. [Arquivos de Configuração](#7-arquivos-de-configuração)
8. [Frontend](#8-frontend-packagesapp)
9. [Catálogo de Software](#9-catálogo-de-software)
10. [Templates (Scaffolder)](#10-templates-scaffolder)
11. [Autenticação](#11-autenticação)
12. [Permissões](#12-permissões)
13. [Desenvolvimento](#13-desenvolvimento)
14. [Adicionando um Novo Backend](#14-adicionando-um-novo-backend)

---

## 1. Visão Geral

Este projeto implementa o Backstage em um modelo **multi-backend**: em vez de um único processo Node.js rodando todos os plugins, cada domínio funcional roda em seu próprio processo e porta. Isso permite escalar, deployar e monitorar cada parte da plataforma de forma independente.

```
Browser (3000)
    │
    ▼
Frontend App — webpack dev server (packages/app)
    │  todas as chamadas /api/* vão para 7007
    ▼
Proxy Backend (7007) — packages/backend
    │  lê backend.discovery.endpoints e roteia cada /api/<pluginId>
    │
    ├──► :7008  backend-catalog      catalog · auth · permission
    ├──► :7009  backend-search       search
    ├──► :7010  backend-scaffolder   scaffolder
    ├──► :7011  backend-techdocs     techdocs
    ├──► :7012  backend-kubernetes   kubernetes
    └──► :7013  backend-notifications  notifications · signals · mcp-actions
```

O frontend **nunca conhece** as portas dos feature backends — ele só sabe que existe um backend em `localhost:7007`. Todo o roteamento acontece no proxy de forma transparente.

---

## 2. Estrutura de Pastas

```
backstage-poc/
│
├── app-config.yaml              # Configuração base compartilhada por todos os backends
├── app-config.local.yaml        # Segredos e overrides locais (gitignored)
├── app-config.production.yaml   # Overrides para produção
│
├── packages/
│   │
│   ├── app/                     # Frontend React (porta 3000)
│   │   └── src/
│   │       ├── App.tsx          # Entry point — registra plugins e módulos
│   │       └── modules/
│   │           ├── nav/         # Sidebar e logo customizados
│   │           └── sign-in/     # Tela de login GitHub
│   │
│   ├── backend/                 # Proxy + servidor da SPA (porta 7007)
│   │   └── src/index.ts         # API gateway reverso + plugin-app-backend
│   │
│   ├── backend-common/          # Código compartilhado entre feature backends
│   │   └── src/index.ts         # Exporta multiBackendDiscovery
│   │
│   ├── backend-catalog/         # Catalog + Auth + Permissions (porta 7008)
│   │   ├── app-config.yaml      # Define porta 7008
│   │   └── src/index.ts
│   │
│   ├── backend-search/          # Search (porta 7009)
│   │   ├── app-config.yaml      # Define porta 7009
│   │   └── src/index.ts
│   │
│   ├── backend-scaffolder/      # Scaffolder / Templates (porta 7010)
│   │   ├── app-config.yaml      # Define porta 7010
│   │   └── src/index.ts
│   │
│   ├── backend-techdocs/        # TechDocs (porta 7011)
│   │   ├── app-config.yaml      # Define porta 7011
│   │   └── src/index.ts
│   │
│   ├── backend-kubernetes/      # Kubernetes (porta 7012)
│   │   ├── app-config.yaml      # Define porta 7012
│   │   └── src/index.ts
│   │
│   └── backend-notifications/   # Notifications + Signals + MCP Actions (porta 7013)
│       ├── app-config.yaml      # Define porta 7013
│       └── src/index.ts
│
├── plugins/                     # Plugins customizados locais (vazio, pronto para uso)
└── examples/                    # Entidades e templates de exemplo para o catálogo
```

---

## 3. Backends e Responsabilidades

### `packages/backend` — Proxy / API Gateway (porta 7007)

O único backend que o frontend conhece. Não executa nenhum plugin de negócio. Suas responsabilidades são:

1. **Servir a SPA** via `plugin-app-backend` (em produção, embute o build estático do frontend)
2. **Rotear chamadas de API** para o feature backend correto via reverse proxy

```typescript
// packages/backend/src/index.ts
const featureBackendProxy = createBackendPlugin({
  pluginId: 'feature-backend-proxy',
  register(env) {
    env.registerInit({
      deps: { config: coreServices.rootConfig, rootHttpRouter: coreServices.rootHttpRouter },
      async init({ config, rootHttpRouter }) {
        for (const ep of config.getOptionalConfigArray('backend.discovery.endpoints') ?? []) {
          const { origin } = new URL(ep.getString('target').replace('{{pluginId}}', 'x'));
          for (const pluginId of ep.getStringArray('plugins')) {
            const id = pluginId;
            rootHttpRouter.use(`/api/${id}`, createProxyMiddleware({
              target: origin,
              changeOrigin: true,
              pathRewrite: path => `/api/${id}${path}`, // restaura o prefixo stripado pelo Express
            }));
          }
        }
      },
    });
  },
});
```

> **Por que o `pathRewrite`?** O Express, ao fazer match de `/api/catalog`, strip o prefixo antes de passar para o middleware — `req.url` chega como `/entities` em vez de `/api/catalog/entities`. O `pathRewrite` restaura o caminho completo para que o backend de destino receba a URL correta.

---

### `packages/backend-catalog` — Catalog + Auth + Permissions (porta 7008)

Agrupa os três plugins co-dependentes:

| Plugin | Responsabilidade |
|--------|-----------------|
| `plugin-catalog-backend` | Indexa e serve entidades (Components, APIs, Systems...) |
| `plugin-catalog-backend-module-scaffolder-entity-model` | Habilita entidades do tipo `Template` no catálogo |
| `plugin-catalog-backend-module-logs` | Loga erros de processamento de entidades |
| `plugin-auth-backend` | Gerencia sessões e provedores de autenticação |
| `plugin-auth-backend-module-guest-provider` | Login sem credenciais (dev) |
| `plugin-auth-backend-module-github-provider` | OAuth via GitHub |
| `plugin-permission-backend` | Framework de autorização |
| `plugin-permission-backend-module-allow-all-policy` | Permite tudo (dev) |

Auth e Permissions ficam aqui porque dependem do catálogo para resolver identidades de usuários.

---

### `packages/backend-search` — Search (porta 7009)

Motor de busca full-text que indexa catálogo e documentação.

| Plugin | Responsabilidade |
|--------|-----------------|
| `plugin-search-backend` | API de busca |
| `plugin-search-backend-module-pg` | Usa PostgreSQL como índice |
| `plugin-search-backend-module-catalog` | Indexa entidades do catálogo |
| `plugin-search-backend-module-techdocs` | Indexa páginas de documentação |

---

### `packages/backend-scaffolder` — Scaffolder (porta 7010)

Engine de execução de templates de software.

| Plugin | Responsabilidade |
|--------|-----------------|
| `plugin-scaffolder-backend` | Engine de execução de templates |
| `plugin-scaffolder-backend-module-github` | Actions GitHub (criar repo, PR, etc.) |
| `plugin-scaffolder-backend-module-notifications` | Notifica usuários ao fim de um template |

---

### `packages/backend-techdocs` — TechDocs (porta 7011)

Geração e hospedagem de documentação técnica a partir de MkDocs.

---

### `packages/backend-kubernetes` — Kubernetes (porta 7012)

Agrega dados de clusters Kubernetes e os associa a entidades do catálogo.

---

### `packages/backend-notifications` — Notifications + Signals + MCP (porta 7013)

| Plugin | Responsabilidade |
|--------|-----------------|
| `plugin-notifications-backend` | Persistência e entrega de notificações |
| `plugin-signals-backend` | Push em tempo real via WebSocket/SSE |
| `plugin-mcp-actions-backend` | Exposição de ações via Model Context Protocol (AI) |

---

## 4. Como os Plugins Funcionam

O Backstage usa o **New Backend System** — cada plugin é um módulo independente registrado em um `Backend` via `backend.add()`.

### Anatomia de um feature backend

```typescript
// packages/backend-search/src/index.ts
import { createBackend } from '@backstage/backend-defaults';
import { multiBackendDiscovery } from 'backend-common';

const backend = createBackend();

// 1. Substitui o DiscoveryService padrão pelo multi-backend
backend.add(multiBackendDiscovery);

// 2. Registra os plugins deste backend
backend.add(import('@backstage/plugin-search-backend'));
backend.add(import('@backstage/plugin-search-backend-module-pg'));
backend.add(import('@backstage/plugin-search-backend-module-catalog'));
backend.add(import('@backstage/plugin-search-backend-module-techdocs'));

backend.start();
```

### O que `backend.add()` faz

- Registra o plugin no container de dependências interno do backend
- O plugin declara de quais serviços depende (`coreServices.database`, `coreServices.config`, `coreServices.httpRouter`, etc.)
- O framework injeta as dependências automaticamente durante a inicialização
- A ordem dos `backend.add()` não importa — o framework resolve as dependências

### `packages/backend-common` — Código compartilhado

Exporta o `multiBackendDiscovery`, que é um `ServiceFactory` customizado registrado em todos os feature backends:

```typescript
// packages/backend-common/src/index.ts
export const multiBackendDiscovery = createServiceFactory({
  service: coreServices.discovery,
  deps: { config: coreServices.rootConfig },
  async factory({ config }) {
    const baseUrl = config.getString('backend.baseUrl');
    const pluginUrls = new Map<string, string>();

    for (const ep of config.getOptionalConfigArray('backend.discovery.endpoints') ?? []) {
      const target = ep.getString('target');
      for (const pluginId of ep.getStringArray('plugins')) {
        pluginUrls.set(pluginId, target.replace(/\{\{pluginId\}\}/g, pluginId));
      }
    }

    return {
      getBaseUrl:         async (id) => pluginUrls.get(id) ?? `${baseUrl}/api/${id}`,
      getExternalBaseUrl: async (id) => pluginUrls.get(id) ?? `${baseUrl}/api/${id}`,
    };
  },
});
```

**Por que esse override é necessário?** O `DiscoveryService` padrão resolve todos os plugins para o `backend.baseUrl` do processo atual. Em multi-backend, o catalog (7008) precisa saber que o search está em 7009 para fazer chamadas internas. Sem o override, todos os backends tentariam chamar a si mesmos para qualquer plugin.

---

## 5. Como os Backends se Conectam

### Frontend → Proxy (comunicação externa)

O frontend sempre chama `http://localhost:7007`. O proxy lê `backend.discovery.endpoints` do `app-config.yaml` para montar as rotas:

```yaml
# app-config.yaml
backend:
  discovery:
    endpoints:
      - target: 'http://localhost:7008/api/{{pluginId}}'
        plugins: [catalog, auth, permission]
      - target: 'http://localhost:7009/api/{{pluginId}}'
        plugins: [search]
      - target: 'http://localhost:7010/api/{{pluginId}}'
        plugins: [scaffolder]
      - target: 'http://localhost:7011/api/{{pluginId}}'
        plugins: [techdocs]
      - target: 'http://localhost:7012/api/{{pluginId}}'
        plugins: [kubernetes]
      - target: 'http://localhost:7013/api/{{pluginId}}'
        plugins: [notifications, signals, mcp-actions]
```

### Backend → Backend (comunicação interna)

Quando o Scaffolder (7010) precisa notificar um usuário, ele usa o `DiscoveryService` para encontrar o backend de notificações:

```
backend-scaffolder (7010)
    │  DiscoveryService.getBaseUrl('notifications')
    │  → lê backend.discovery.endpoints do config
    │  → retorna 'http://localhost:7013/api/notifications'
    ▼
backend-notifications (7013) — recebe e persiste a notificação
```

Isso funciona porque **todos** os feature backends carregam o mesmo `app-config.yaml` base (que contém o mapa de endpoints) e registram o `multiBackendDiscovery`.

---

## 6. Fluxo de uma Requisição

### Exemplo: usuário pesquisa por "payment-service"

```
1. Browser faz  GET http://localhost:3000
   └─ webpack dev server serve a SPA React

2. SPA faz  GET http://localhost:7007/api/search/query?term=payment-service
   └─ Proxy (7007) recebe a requisição

3. Proxy lê discovery: search → 7009
   └─ Faz proxy para  GET http://localhost:7009/api/search/query?term=payment-service

4. backend-search (7009) processa a busca no PostgreSQL
   └─ Para indexar, chama internamente via DiscoveryService:
      GET http://localhost:7008/api/catalog/entities

5. backend-catalog (7008) retorna as entidades

6. backend-search retorna os resultados para o proxy (7007)

7. Proxy repassa a resposta ao browser
```

### Exemplo: usuário faz login com GitHub

```
1. SPA faz  GET http://localhost:7007/api/auth/github/start
   └─ Proxy roteia para  http://localhost:7008/api/auth/github/start

2. backend-catalog (7008) inicia o OAuth flow com GitHub

3. GitHub redireciona para  http://localhost:7008/api/auth/github/handler/frame

4. backend-catalog cria a sessão e retorna o token ao browser
```

> **Atenção:** o Callback URL do OAuth App no GitHub deve apontar para a porta do backend-catalog (7008), não para o proxy (7007), pois é o catalog que processa o retorno do OAuth.

---

## 7. Arquivos de Configuração

### Hierarquia de carregamento

Cada feature backend carrega **três camadas** em ordem crescente de prioridade:

```
app-config.yaml                      (base compartilhada — prioridade baixa)
    +
packages/<backend>/app-config.yaml   (específico do backend — porta, CORS)
    +
app-config.local.yaml                (segredos locais — prioridade alta)
```

Valores de camadas superiores sobrescrevem as inferiores. A camada intermediária (config do pacote) contém apenas o mínimo necessário para diferenciar os processos: porta e CORS.

### Por que `app-config.local.yaml` precisa ser explícito

O Backstage CLI auto-carrega `app-config.local.yaml` **apenas quando nenhum `--config` é passado**. Como os feature backends usam `--config` para carregar sua config específica, o arquivo local precisa ser listado explicitamente no script `start`:

```json
// packages/backend-catalog/package.json
"start": "backstage-cli package start
  --config ../../app-config.yaml
  --config app-config.yaml
  --config ../../app-config.local.yaml"
```

### `app-config.yaml` — Base compartilhada (commitado)

| Seção | Conteúdo |
|-------|----------|
| `app.baseUrl` | URL do frontend (`http://localhost:3000`) |
| `backend.baseUrl` | URL padrão do backend (sobrescrita por cada pacote) |
| `backend.discovery.endpoints` | Mapa de roteamento entre backends |
| `backend.database` | Padrão: SQLite in-memory (sobrescrito em `app-config.local.yaml`) |
| `integrations.github` | Token de leitura de repos (sobrescrito em `app-config.local.yaml`) |
| `auth.providers` | Provedores de auth habilitados |
| `catalog.locations` | Fontes de entidades do catálogo |
| `techdocs`, `scaffolder`, `kubernetes`, `permission` | Configurações de plugins |

### `packages/<backend>/app-config.yaml` — Específico do backend

```yaml
# Exemplo: packages/backend-catalog/app-config.yaml
backend:
  baseUrl: http://localhost:7008   # URL pública deste processo
  listen:
    port: 7008                     # Porta que este processo escuta
  cors:
    origin: http://localhost:3000  # Permite chamadas CORS do frontend
    methods: [GET, HEAD, PATCH, POST, PUT, DELETE]
    credentials: true
```

### `app-config.local.yaml` — Segredos locais (gitignored)

```yaml
auth:
  environment: development
  providers:
    github:
      development:
        clientId: <GITHUB_OAUTH_CLIENT_ID>
        clientSecret: <GITHUB_OAUTH_CLIENT_SECRET>
        signIn:
          resolvers:
            - resolver: usernameMatchingUserEntityName
              dangerouslyAllowSignInWithoutUserInCatalog: true

integrations:
  github:
    - host: github.com
      token: <GITHUB_PAT>

database:
  client: pg             # Sobrescreve o SQLite do app-config.yaml
  connection:
    host: 127.0.0.1
    port: 5432
    user: backstage
    password: backstage
    database: backstage
  knexConfig:
    pool: { min: 3, max: 12 }
```

### `app-config.production.yaml` — Produção (commitado)

Overrides para o ambiente de produção. Nunca deve conter segredos em plaintext — usar variáveis de ambiente (`${VAR}`).

---

## 8. Frontend (`packages/app`)

### Entry point

```tsx
// packages/app/src/App.tsx
export default createApp({
  features: [
    catalogPlugin,  // Catálogo de componentes
    navModule,      // Sidebar customizada
    // demais plugins descobertos automaticamente via app-config.yaml (packages: all)
  ],
});
```

O campo `app.packages: all` no `app-config.yaml` faz o Backstage descobrir e registrar automaticamente todos os plugins listados no `packages/app/package.json`.

### Plugins instalados no frontend

| Pacote | Função | Status |
|--------|--------|--------|
| `plugin-catalog` | Catálogo de componentes | Ativo |
| `plugin-scaffolder` | Templates de serviços | Ativo |
| `plugin-search` | Busca global (modal) | Ativo |
| `plugin-techdocs` | Documentação inline | Ativo |
| `plugin-notifications` | Centro de notificações | Ativo |
| `plugin-signals` | Atualizações em tempo real | Ativo |
| `plugin-user-settings` | Preferências do usuário | Ativo |
| `plugin-app-visualizer` | Visualizador da estrutura do app | Ativo |
| `plugin-api-docs` | Docs de APIs (OpenAPI, gRPC) | Instalado* |
| `plugin-catalog-graph` | Grafo de dependências | Instalado* |
| `plugin-catalog-import` | Importar entidades de repos | Instalado* |
| `plugin-kubernetes` | Clusters Kubernetes | Instalado* |
| `plugin-org` | Organograma / equipes | Instalado* |

> *Instalado = pacote presente mas não registrado como `feature` no `App.tsx`.

### Sidebar customizada

```
Sidebar (packages/app/src/modules/nav/Sidebar.tsx)
├── SidebarLogo                  ← editar LogoFull.tsx e LogoIcon.tsx
├── SidebarSearchModal           ← busca via modal
├── [Menu]
│   ├── Catalog  →  /
│   └── Scaffolder  →  /create
├── NotificationsSidebarItem
└── [Settings]
    ├── App Visualizer
    └── User Settings (avatar)
```

---

## 9. Catálogo de Software

O catálogo é o coração do Backstage. Cada serviço, API ou time é representado por um arquivo `catalog-info.yaml` no repositório correspondente.

### Tipos de entidades suportados

| Kind | Descrição |
|------|-----------|
| `Component` | Serviço, website, biblioteca, worker |
| `API` | Contrato de API (OpenAPI, gRPC, AsyncAPI, GraphQL) |
| `System` | Agrupamento lógico de componentes |
| `Resource` | Infraestrutura (banco, fila, bucket) |
| `Group` | Time ou área da empresa |
| `User` | Pessoa |
| `Location` | Ponteiro para outros arquivos de catálogo |
| `Template` | Template de scaffolding |

### Como cadastrar entidades

**Via URL (recomendado):**
```yaml
# app-config.yaml → catalog.locations
- type: url
  target: https://github.com/bradesco-seguros/meu-servico/blob/main/catalog-info.yaml
```

**Via arquivo local (apenas para exemplos/POC):**
```yaml
- type: file
  target: ../../examples/entities.yaml
```

**Via GitHub Discovery automático:**
```yaml
catalog:
  providers:
    github:
      bradesco:
        organization: bradesco-seguros
        catalogPath: '/catalog-info.yaml'
        schedule:
          frequency: { minutes: 30 }
          timeout: { minutes: 3 }
```

### Exemplo de `catalog-info.yaml`

```yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: meu-servico
  description: Serviço responsável por X
  annotations:
    github.com/project-slug: bradesco-seguros/meu-servico
    backstage.io/techdocs-ref: dir:.
spec:
  type: service
  lifecycle: production
  owner: group:squad-pagamentos
  system: sistema-pagamentos
  providesApis:
    - meu-servico-api
```

---

## 10. Templates (Scaffolder)

Templates permitem criar novos repositórios/serviços com estrutura padronizada a partir de um formulário no portal.

### Ações disponíveis por padrão

| Ação | Descrição |
|------|-----------|
| `fetch:template` | Copia e processa arquivos com Nunjucks |
| `fetch:plain` | Copia arquivos sem processamento |
| `publish:github` | Cria repositório no GitHub |
| `publish:github:pull-request` | Abre PR em repositório existente |
| `catalog:register` | Registra entidade no catálogo |
| `catalog:write` | Escreve arquivo `catalog-info.yaml` |
| `github:actions:dispatch` | Dispara GitHub Action |
| `notification:send` | Envia notificação no portal |

Para listar todas as ações disponíveis: `http://localhost:7007/api/scaffolder/v2/actions`

---

## 11. Autenticação

### Estado atual

Dois provedores estão configurados:

| Provedor | Uso |
|----------|-----|
| `guest` | Login automático sem credenciais (útil para POC) |
| `github` | OAuth via GitHub (requer credenciais em `app-config.local.yaml`) |

O provedor GitHub usa `usernameMatchingUserEntityName` como resolver — o username do GitHub é mapeado para uma entidade `User` no catálogo com o mesmo nome.

### Callback URL do OAuth App GitHub

O backend que processa o retorno do OAuth é o `backend-catalog` (porta 7008). Configurar no GitHub:

```
Homepage URL:  http://localhost:3000
Callback URL:  http://localhost:7008/api/auth/github/handler/frame
```

### Como adicionar um novo provedor

```typescript
// packages/backend-catalog/src/index.ts
backend.add(import('@backstage/plugin-auth-backend-module-gitlab-provider'));
```

```yaml
# app-config.local.yaml
auth:
  providers:
    gitlab:
      development:
        clientId: ${AUTH_GITLAB_CLIENT_ID}
        clientSecret: ${AUTH_GITLAB_CLIENT_SECRET}
```

---

## 12. Permissões

### Estado atual: allow-all

```typescript
// packages/backend-catalog/src/index.ts
backend.add(import('@backstage/plugin-permission-backend-module-allow-all-policy'));
```

Para produção, substituir por uma política customizada usando `createBackendModule` com `policyExtensionPoint`.

---

## 13. Desenvolvimento

### Iniciar tudo

```bash
yarn start:all
```

O comando usa `concurrently` com ordem de dependência entre os processos:

```
Fase 1 — iniciam simultaneamente (sem dependências):
  catalog (7008)  techdocs (7011)  kubernetes (7012)  notifications (7013)

Fase 2 — aguardam catalog (7008) estar pronto:
  search (7009)  scaffolder (7010)

Fase 3 — aguardam todos os feature backends (7008–7013):
  proxy (7007)  frontend (3000)
```

### Iniciar backends individualmente

```bash
yarn start:catalog        # backend-catalog  → :7008
yarn start:search         # backend-search   → :7009
yarn start:scaffolder     # backend-scaffolder → :7010
yarn start:techdocs       # backend-techdocs → :7011
yarn start:kubernetes     # backend-kubernetes → :7012
yarn start:notifications  # backend-notifications → :7013
yarn start:proxy          # proxy + SPA server → :7007
yarn start:app            # webpack dev server → :3000
```

### Build

```bash
yarn build:backends   # builda todos os feature backends
yarn build:all        # builda tudo (incluindo frontend)

# Build de um backend específico:
yarn build:backend-catalog
yarn build:backend-search
```

### Portas

| Processo | URL | Pacote |
|----------|-----|--------|
| Frontend | http://localhost:3000 | `packages/app` |
| Proxy / SPA server | http://localhost:7007 | `packages/backend` |
| Catalog · Auth · Permission | http://localhost:7008 | `packages/backend-catalog` |
| Search | http://localhost:7009 | `packages/backend-search` |
| Scaffolder | http://localhost:7010 | `packages/backend-scaffolder` |
| TechDocs | http://localhost:7011 | `packages/backend-techdocs` |
| Kubernetes | http://localhost:7012 | `packages/backend-kubernetes` |
| Notifications · Signals · MCP | http://localhost:7013 | `packages/backend-notifications` |

---

## 14. Adicionando um Novo Backend

Exemplo: plugin `analytics` na porta 7014.

**1. Criar o pacote**

```bash
yarn new  # selecionar "backend" e nomear "backend-analytics"
```

**2. Criar a config do pacote**

```yaml
# packages/backend-analytics/app-config.yaml
backend:
  baseUrl: http://localhost:7014
  listen:
    port: 7014
  cors:
    origin: http://localhost:3000
    methods: [GET, HEAD, PATCH, POST, PUT, DELETE]
    credentials: true
```

**3. Implementar `src/index.ts`**

```typescript
import { createBackend } from '@backstage/backend-defaults';
import { multiBackendDiscovery } from 'backend-common';

const backend = createBackend();
backend.add(multiBackendDiscovery);
backend.add(import('@backstage/plugin-analytics-backend'));
backend.start();
```

**4. Atualizar `package.json` do pacote**

```json
{
  "scripts": {
    "start": "backstage-cli package start --config ../../app-config.yaml --config app-config.yaml --config ../../app-config.local.yaml"
  },
  "dependencies": {
    "backend-common": "workspace:*"
  }
}
```

**5. Registrar no `app-config.yaml`**

```yaml
backend:
  discovery:
    endpoints:
      # ... endpoints existentes ...
      - target: 'http://localhost:7014/api/{{pluginId}}'
        plugins: [analytics]
```

**6. Adicionar scripts no `package.json` raiz**

```json
{
  "scripts": {
    "start:analytics": "yarn workspace backend-analytics start",
    "build:backend-analytics": "yarn workspace backend-analytics build"
  }
}
```

**7. Incluir no `start:all`**

Adicionar `"yarn start:analytics"` na fase 1 do `start:all` e incluir `tcp:7014` nas condições `wait-on` das fases 2 e 3 conforme necessário.

**8. Executar `yarn install`**

```bash
yarn install  # linka o novo pacote no workspace
```

---

## 15. Antes e Depois: Single-Backend vs. Multi-Backend

### Estrutura de pastas

**Antes (single-backend):**
```
backstage-poc/
├── app-config.yaml
├── app-config.local.yaml
├── app-config.production.yaml
└── packages/
    ├── app/                   # Frontend
    └── backend/               # UM único processo Node.js com todos os plugins
        └── src/index.ts
```

**Depois (multi-backend):**
```
backstage-poc/
├── app-config.yaml            # Base compartilhada (porta 7007, discovery map)
├── app-config.local.yaml      # Segredos locais
├── app-config.production.yaml
└── packages/
    ├── app/                   # Frontend (inalterado)
    ├── backend/               # Apenas proxy + SPA server (porta 7007)
    ├── backend-common/        # Código compartilhado (multiBackendDiscovery)
    ├── backend-catalog/       # catalog · auth · permission (porta 7008)
    │   └── app-config.yaml   ← config co-localizada com o pacote
    ├── backend-search/        # search (porta 7009)
    │   └── app-config.yaml
    ├── backend-scaffolder/    # scaffolder (porta 7010)
    │   └── app-config.yaml
    ├── backend-techdocs/      # techdocs (porta 7011)
    │   └── app-config.yaml
    ├── backend-kubernetes/    # kubernetes (porta 7012)
    │   └── app-config.yaml
    └── backend-notifications/ # notifications · signals · mcp-actions (porta 7013)
        └── app-config.yaml
```

---

### Registro de plugins no `index.ts`

**Antes — tudo em um único `packages/backend/src/index.ts`:**

```typescript
const backend = createBackend();

// todos os plugins num único processo
backend.add(import('@backstage/plugin-app-backend'));
backend.add(import('@backstage/plugin-proxy-backend'));
backend.add(import('@backstage/plugin-catalog-backend'));
backend.add(import('@backstage/plugin-catalog-backend-module-scaffolder-entity-model'));
backend.add(import('@backstage/plugin-catalog-backend-module-logs'));
backend.add(import('@backstage/plugin-auth-backend'));
backend.add(import('@backstage/plugin-auth-backend-module-guest-provider'));
backend.add(import('@backstage/plugin-auth-backend-module-github-provider'));
backend.add(import('@backstage/plugin-permission-backend'));
backend.add(import('@backstage/plugin-permission-backend-module-allow-all-policy'));
backend.add(import('@backstage/plugin-search-backend'));
backend.add(import('@backstage/plugin-search-backend-module-pg'));
backend.add(import('@backstage/plugin-search-backend-module-catalog'));
backend.add(import('@backstage/plugin-search-backend-module-techdocs'));
backend.add(import('@backstage/plugin-scaffolder-backend'));
backend.add(import('@backstage/plugin-scaffolder-backend-module-github'));
backend.add(import('@backstage/plugin-scaffolder-backend-module-notifications'));
backend.add(import('@backstage/plugin-techdocs-backend'));
backend.add(import('@backstage/plugin-kubernetes-backend'));
backend.add(import('@backstage/plugin-notifications-backend'));
backend.add(import('@backstage/plugin-signals-backend'));
backend.add(import('@backstage/plugin-mcp-actions-backend'));

backend.start();
```

**Depois — cada backend registra apenas seus próprios plugins:**

```typescript
// packages/backend/src/index.ts (proxy)
const backend = createBackend();
backend.add(featureBackendProxy); // gateway reverso
backend.add(import('@backstage/plugin-app-backend'));
backend.add(import('@backstage/plugin-proxy-backend'));
backend.start();

// packages/backend-catalog/src/index.ts
const backend = createBackend();
backend.add(multiBackendDiscovery);
backend.add(import('@backstage/plugin-catalog-backend'));
backend.add(import('@backstage/plugin-auth-backend'));
backend.add(import('@backstage/plugin-permission-backend'));
// ...
backend.start();

// packages/backend-search/src/index.ts
const backend = createBackend();
backend.add(multiBackendDiscovery);
backend.add(import('@backstage/plugin-search-backend'));
// ...
backend.start();
```

---

### `DiscoveryService` antes e depois

**Antes:** o Backstage usava o `DiscoveryService` padrão, que resolvia qualquer `pluginId` para a mesma URL (`backend.baseUrl`). Funcionava porque todos os plugins rodavam no mesmo processo.

**Depois:** o `DiscoveryService` padrão quebra — o catalog (7008) tentaria chamar a si mesmo para encontrar o search. A solução foi o `multiBackendDiscovery` em `packages/backend-common`, que lê `backend.discovery.endpoints` do config e devolve a URL certa para cada plugin:

```
getBaseUrl('search')       → http://localhost:7009/api/search
getBaseUrl('scaffolder')   → http://localhost:7010/api/scaffolder
getBaseUrl('notifications')→ http://localhost:7013/api/notifications
```

---

### Configuração antes e depois

| | Single-backend | Multi-backend |
|--|----------------|---------------|
| Arquivos de config | `app-config.yaml` + `app-config.local.yaml` | Idem + um `app-config.yaml` por pacote |
| Porta | Uma porta (7007) para tudo | Uma porta por processo (7007–7013) |
| Config carregada | `app-config.yaml` + auto-load de `local.yaml` | `--config` explícito para os três arquivos |
| Discovery map | Não existe | Obrigatório em `backend.discovery.endpoints` |

---

## 16. Multi-Backend: Pontos Positivos e Negativos

### Pontos positivos

**Escalabilidade independente**
Cada backend pode ser escalado horizontalmente de forma isolada. Se o search sofre picos de carga, aumenta-se apenas as réplicas do `backend-search` sem tocar nos outros.

**Deploy independente**
É possível fazer deploy do `backend-catalog` sem reiniciar o `backend-search`. Isso reduz o blast radius de uma atualização e permite deploys com zero downtime por domínio.

**Isolamento de falhas**
Uma exceção não capturada ou um memory leak no `backend-kubernetes` não derruba o catalog nem o auth. O processo falha isolado e pode ser reiniciado pelo orquestrador (Kubernetes, PM2, etc.).

**Modularização por domínio**
Cada pacote tem responsabilidade única e bem definida. Times diferentes podem ser donos de backends diferentes sem interferência.

**Times paralelos e autônomos**
O time de catalog pode evoluir seu backend sem coordenar com o time de search. Cada time gerencia suas próprias dependências, seu próprio ciclo de release e sua própria política de rollback.

**Boundaries claros para versionamento**
Como cada backend é um pacote separado no monorepo, é fácil rastrear `git log` ou `git blame` por domínio. Pull requests ficam focados no domínio alterado, facilitando code review.

**Banco de dados por domínio**
É possível (e recomendado em produção) que cada backend use seu próprio banco ou schema de banco, seguindo o padrão de Database-per-Service. Isso evita acoplamento de esquema entre domínios.

---

### Pontos negativos

**Complexidade operacional**
Em vez de um processo para monitorar, são 7. Logs estão distribuídos entre processos. Para debugging, é preciso correlacionar traces entre múltiplos backends. Uma stack de observabilidade (tracing distribuído, log aggregation) torna-se obrigatória em produção.

**Overhead de infraestrutura**
Cada backend precisa de sua própria configuração de container, health check, ingress rule, recurso de CPU/memória no cluster. O número de objetos Kubernetes (Deployments, Services, ConfigMaps) cresce linearmente com o número de backends.

**Latência adicional em chamadas inter-backend**
No single-backend, o call entre catalog e search é uma chamada de função in-process. No multi-backend, é uma chamada HTTP real. Em fluxos que encadeiam múltiplos backends, a latência acumula.

**Inicialização em desenvolvimento é mais lenta**
`yarn start:all` precisa subir 8 processos com dependências entre eles. O tempo de boot do ambiente de desenvolvimento é consideravelmente maior que com um único processo.

**`app-config.local.yaml` precisa ser carregado explicitamente**
Comportamento contra-intuitivo do Backstage CLI: o auto-load do arquivo local só funciona sem `--config`. Com múltiplos configs explícitos, o arquivo de segredos precisa ser listado manualmente no script de start de cada backend.

**Coordenação de versões de dependências**
Cada `package.json` de backend lista suas próprias dependências. Manter as versões de `@backstage/*` sincronizadas entre todos os pacotes exige disciplina ou automação (ex: `yarn backstage-cli versions:bump`).

**Complexidade de merge em times grandes**
Com múltiplos times trabalhando no mesmo monorepo, conflitos em `app-config.yaml` (que é compartilhado) e no `package.json` raiz (scripts `start:all`, `build:backends`) são mais frequentes. Requer processo de revisão e ownership claro sobre esses arquivos.

**Teste de integração mais complexo**
Testar um fluxo ponta a ponta (ex: criar template → notificar usuário → aparecer no catálogo) exige que todos os backends relevantes estejam rodando e saudáveis simultaneamente.

---

### Resumo: quando usar cada abordagem

| Critério | Single-Backend | Multi-Backend |
|----------|---------------|---------------|
| Time pequeno (< 5 devs) | Recomendado | Overhead desnecessário |
| POC / validação rápida | Recomendado | Complexidade prematura |
| Produção com múltiplos times | Inviável a longo prazo | Recomendado |
| Escala independente por domínio | Impossível | Essencial |
| Budget de infra limitado | Melhor opção | Custo maior |
| Requisito de alta disponibilidade por domínio | Difícil | Nativo |
| Equipes organizadas por domínio (catalog, search...) | Conflitos frequentes | Boundaries naturais |
