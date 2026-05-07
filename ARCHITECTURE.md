# Arquitetura — Backstage POC

> Backstage v1.50.0 · Node.js 22/24 · Yarn 4.4.1 · TypeScript 5.8

---

## Sumário

1. [O que é este projeto](#1-o-que-é-este-projeto)
2. [Estrutura de pastas](#2-estrutura-de-pastas)
3. [Frontend](#3-frontend-packageapp)
4. [Backend](#4-backend-packagebackend)
5. [Configuração](#5-configuração-app-configyaml)
6. [Catálogo de Software](#6-catálogo-de-software)
7. [Templates (Scaffolder)](#7-templates-scaffolder)
8. [Autenticação](#8-autenticação)
9. [Permissões](#9-permissões)
10. [Plugins disponíveis](#10-plugins-disponíveis)
11. [Guia de implementação](#11-guia-de-implementação)
12. [Fluxos de dados](#12-fluxos-de-dados)
13. [Comandos úteis](#13-comandos-úteis)

---

## 1. O que é este projeto

Este repositório é um **Developer Portal** construído sobre o framework [Backstage](https://backstage.io) (open-source, CNCF). O objetivo é centralizar:

- **Catálogo de serviços** — todos os sistemas, APIs e times da empresa em um único lugar
- **Scaffolding** — criação de novos serviços a partir de templates padronizados
- **Documentação técnica** — TechDocs integrado ao catálogo
- **Visibilidade operacional** — Kubernetes, Search, Notificações

O projeto está no estado de **POC** (Prova de Conceito): a infraestrutura está configurada e funcional, mas ainda sem entidades reais da empresa cadastradas.

---

## 2. Estrutura de pastas

```
backstage-poc/
│
├── packages/
│   ├── app/                        # Aplicação frontend (React 18)
│   │   └── src/
│   │       ├── App.tsx             # Entry point — registra plugins e módulos
│   │       └── modules/
│   │           └── nav/            # Sidebar customizada
│   │               ├── Sidebar.tsx
│   │               ├── SidebarLogo.tsx
│   │               ├── LogoFull.tsx
│   │               └── LogoIcon.tsx
│   │
│   └── backend/                    # Servidor Node.js
│       └── src/
│           └── index.ts            # Entry point — registra todos os plugins backend
│
├── plugins/                        # Plugins customizados (VAZIO — pronto para uso)
│
├── examples/                       # Entidades de exemplo para o catálogo
│   ├── entities.yaml               # System, Component, API de exemplo
│   ├── org.yaml                    # User e Group de exemplo
│   └── template/
│       ├── template.yaml           # Template Node.js de exemplo
│       └── content/                # Arquivos gerados pelo template
│
├── app-config.yaml                 # Configuração local (desenvolvimento)
├── app-config.production.yaml      # Configuração de produção
├── app-config.local.yaml           # Secrets locais (gitignored)
├── catalog-info.yaml               # Entidade deste próprio repositório
└── backstage.json                  # Versão do Backstage
```

---

## 3. Frontend (`packages/app`)

### Entry point

```ts
// packages/app/src/App.tsx
export default createApp({
  features: [
    catalogPlugin,   // Catálogo de software (ativo)
    navModule,       // Sidebar customizada (ativo)
    // demais plugins são descobertos automaticamente via app-config.yaml (packages: all)
  ],
});
```

O campo `packages: all` no `app-config.yaml` faz o Backstage descobrir e registrar automaticamente todos os plugins listados no `packages/app/package.json`. Para **desativar** um plugin específico, é necessário removê-lo do array `features` ou desabilitar via `extensions`.

### Sidebar customizada

Localizada em `packages/app/src/modules/nav/Sidebar.tsx`.

```
Sidebar
├── SidebarLogo            ← Logo da empresa (editar LogoFull.tsx e LogoIcon.tsx)
├── SidebarSearchModal     ← Busca via modal (não abre página separada)
├── [Menu]
│   ├── Catalog            ← Página raiz "/"
│   ├── Scaffolder         ← Templates de criação de serviços
│   └── [demais páginas — renderizadas automaticamente]
├── NotificationsSidebarItem
└── [Settings]
    ├── App Visualizer
    └── User Settings (avatar)
```

Para adicionar um item fixo à sidebar (ex: link para Kubernetes):

```tsx
// packages/app/src/modules/nav/Sidebar.tsx
import KubernetesIcon from '@material-ui/icons/Cloud';

// dentro do SidebarGroup "Menu":
<SidebarItem icon={KubernetesIcon} to="/kubernetes" text="Kubernetes" />
```

### Plugins instalados no frontend

| Pacote | Função | Status |
|--------|--------|--------|
| `plugin-catalog` | Catálogo de componentes | Ativo |
| `plugin-scaffolder` | Templates de serviços | Ativo |
| `plugin-search` | Busca global | Ativo (modal) |
| `plugin-techdocs` | Docs inline | Ativo |
| `plugin-notifications` | Centro de notificações | Ativo |
| `plugin-signals` | Atualizações em tempo real | Ativo |
| `plugin-user-settings` | Preferências do usuário | Ativo |
| `plugin-app-visualizer` | Visualizador da estrutura do app | Ativo |
| `plugin-api-docs` | Documentação de APIs (OpenAPI, gRPC) | Instalado |
| `plugin-catalog-graph` | Grafo de dependências | Instalado |
| `plugin-catalog-import` | Importar entidades de repos | Instalado |
| `plugin-kubernetes` | Clusters Kubernetes | Instalado |
| `plugin-org` | Organograma / equipes | Instalado |
| `plugin-auth` | UI de autenticação | Instalado |
| `plugin-techdocs-module-addons-contrib` | Extensões de TechDocs | Instalado |

> **Instalado** = pacote presente, mas não registrado como `feature` no `App.tsx`. Para ativar, importar e adicionar ao array `features`.

---

## 4. Backend (`packages/backend`)

### Entry point

```ts
// packages/backend/src/index.ts
const backend = createBackend();

backend.add(import('@backstage/plugin-catalog-backend'));
backend.add(import('@backstage/plugin-scaffolder-backend'));
// ... demais plugins
backend.start();
```

Cada linha `backend.add(...)` registra um módulo independente. A ordem não importa.

### Mapa de plugins backend

```
createBackend()
│
├── App & Roteamento
│   ├── plugin-app-backend              # Serve o frontend
│   └── plugin-proxy-backend            # Proxy CORS/HTTPS para serviços externos
│
├── Catálogo
│   ├── plugin-catalog-backend          # Core do catálogo
│   ├── plugin-catalog-backend-module-scaffolder-entity-model  # Entidades Template
│   └── plugin-catalog-backend-module-logs                     # Log de erros do catálogo
│
├── Scaffolder (Templates)
│   ├── plugin-scaffolder-backend                       # Engine de templates
│   ├── plugin-scaffolder-backend-module-github         # Ações GitHub (publish, PR, etc.)
│   └── plugin-scaffolder-backend-module-notifications  # Notificar ao concluir template
│
├── TechDocs
│   └── plugin-techdocs-backend         # Geração e hospedagem de documentação
│
├── Autenticação
│   ├── plugin-auth-backend             # Core de autenticação
│   └── plugin-auth-backend-module-guest-provider  # Login sem credenciais (dev)
│
├── Permissões
│   ├── plugin-permission-backend       # Framework de permissões
│   └── plugin-permission-backend-module-allow-all-policy  # Permite tudo (dev)
│
├── Busca
│   ├── plugin-search-backend           # Core de busca
│   ├── plugin-search-backend-module-pg # Engine PostgreSQL
│   ├── plugin-search-backend-module-catalog    # Indexa entidades do catálogo
│   └── plugin-search-backend-module-techdocs   # Indexa documentação
│
├── Kubernetes
│   └── plugin-kubernetes-backend       # Integração com clusters
│
├── Notificações
│   ├── plugin-notifications-backend    # Gerenciamento de notificações
│   └── plugin-signals-backend          # WebSocket / Server-Sent Events
│
└── MCP Actions (IA)
    └── plugin-mcp-actions-backend      # Actions via Model Context Protocol
```

### Banco de dados

| Ambiente | Driver | Conexão |
|----------|--------|---------|
| Desenvolvimento | `better-sqlite3` | `:memory:` (em RAM, reseta ao reiniciar) |
| Produção | `pg` (PostgreSQL) | Via variáveis de ambiente |

Para usar SQLite em arquivo (persistente no dev):
```yaml
# app-config.local.yaml
backend:
  database:
    client: better-sqlite3
    connection: './backstage-dev.db'
```

---

## 5. Configuração (`app-config.yaml`)

### Hierarquia de arquivos de config

```
app-config.yaml              ← Base (commitado)
app-config.production.yaml   ← Sobrescreve em produção (commitado)
app-config.local.yaml        ← Sobrescreve localmente / secrets (gitignored)
```

### Variáveis de ambiente relevantes

| Variável | Uso | Obrigatório |
|----------|-----|-------------|
| `GITHUB_TOKEN` | PAT para leitura/escrita de repos via integração GitHub | Sim (para Scaffolder) |
| `BACKEND_SECRET` | Chave compartilhada entre plugins do backend | Recomendado em produção |
| `POSTGRES_HOST` | Host do banco PostgreSQL | Produção |
| `POSTGRES_PORT` | Porta do PostgreSQL | Produção |
| `POSTGRES_USER` | Usuário do PostgreSQL | Produção |
| `POSTGRES_PASSWORD` | Senha do PostgreSQL | Produção |
| `AUTH_GITHUB_CLIENT_ID` | OAuth App ID do GitHub | Se ativar GitHub auth |
| `AUTH_GITHUB_CLIENT_SECRET` | OAuth App Secret do GitHub | Se ativar GitHub auth |

Crie um arquivo `app-config.local.yaml` (nunca commitado) para definir esses valores localmente:

```yaml
# app-config.local.yaml
integrations:
  github:
    - host: github.com
      token: ghp_SEU_TOKEN_AQUI
```

### Extensões de UI configuradas

```yaml
# app-config.yaml
app:
  extensions:
    - nav-item:search: false         # Desabilitado (usa modal no lugar)
    - nav-item:user-settings: false  # Desabilitado (renderizado manualmente na sidebar)
    - nav-item:catalog: false        # Desabilitado (renderizado manualmente na sidebar)
    - nav-item:scaffolder: false     # Desabilitado (renderizado manualmente na sidebar)
    - page:catalog:
        config:
          path: /                    # Catálogo como página raiz
```

---

## 6. Catálogo de Software

O catálogo é o coração do Backstage. Cada serviço, API, time ou sistema é representado por um arquivo `catalog-info.yaml` no repositório correspondente.

### Tipos de entidades suportados

| Kind | Descrição | Exemplo de uso |
|------|-----------|----------------|
| `Component` | Serviço, website, biblioteca, worker | API REST, frontend React |
| `API` | Contrato de API (OpenAPI, gRPC, AsyncAPI, GraphQL) | Swagger de um microserviço |
| `System` | Agrupamento lógico de componentes | "Sistema de Pagamentos" |
| `Resource` | Infraestrutura (banco, fila, bucket) | RDS, S3, Kafka topic |
| `Group` | Time ou área da empresa | Squads, tribos, capítulos |
| `User` | Pessoa | Desenvolvedor, PO |
| `Location` | Ponteiro para outros arquivos de catálogo | Importar catalogo de outro repo |
| `Template` | Template de scaffolding | Template para criar novo microserviço |

### Onde cadastrar entidades

**Opção A — Arquivo local (apenas POC/exemplos):**
```yaml
# app-config.yaml → catalog.locations
- type: file
  target: ../../examples/entities.yaml
```

**Opção B — Repositório remoto (recomendado para produção):**
```yaml
# app-config.yaml → catalog.locations
- type: url
  target: https://github.com/bradesco-seguros/meu-servico/blob/main/catalog-info.yaml
```

**Opção C — Importação automática via GitHub Discovery:**
```yaml
# app-config.yaml
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

### Exemplo de `catalog-info.yaml` para um microserviço

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
  lifecycle: production       # experimental | production | deprecated
  owner: group:squad-pagamentos
  system: sistema-pagamentos
  providesApis:
    - meu-servico-api
```

---

## 7. Templates (Scaffolder)

Templates permitem criar novos repositórios/serviços com estrutura padronizada a partir de um formulário no portal.

### Anatomia de um template

```yaml
# examples/template/template.yaml
apiVersion: scaffolder.backstage.io/v1beta3
kind: Template
metadata:
  name: exemplo-nodejs
  title: Serviço Node.js
spec:
  owner: group:plataforma
  type: service

  parameters:           # Formulário exibido ao usuário
    - title: Dados do serviço
      properties:
        name:
          title: Nome do componente
          type: string
        repoUrl:
          title: Repositório
          type: string
          ui:field: RepoUrlPicker

  steps:                # Ações executadas no backend
    - id: fetch-base
      action: fetch:template    # Copia arquivos de ./content/
      input:
        url: ./content
        values:
          name: ${{ parameters.name }}

    - id: publish
      action: publish:github    # Publica no GitHub
      input:
        repoUrl: ${{ parameters.repoUrl }}

    - id: register
      action: catalog:register  # Registra no catálogo
      input:
        repoContentsUrl: ${{ steps['publish'].output.repoContentsUrl }}
        catalogInfoPath: '/catalog-info.yaml'

  output:
    links:
      - title: Repositório
        url: ${{ steps['publish'].output.remoteUrl }}
```

### Ações disponíveis por padrão

| Ação | Descrição |
|------|-----------|
| `fetch:template` | Copia e processa arquivos de template (Nunjucks) |
| `fetch:plain` | Copia arquivos sem processamento |
| `publish:github` | Cria repositório e faz push no GitHub |
| `publish:github:pull-request` | Abre PR em repositório existente |
| `catalog:register` | Registra entidade no catálogo |
| `catalog:write` | Escreve arquivo `catalog-info.yaml` |
| `github:actions:dispatch` | Dispara GitHub Action |
| `notification:send` | Envia notificação no portal |

Para ver todas as ações disponíveis: `http://localhost:7007/api/scaffolder/v2/actions`

---

## 8. Autenticação

### Estado atual: Guest (sem login)

```yaml
# app-config.yaml
auth:
  providers:
    guest: {}
```

Qualquer pessoa acessa sem credenciais. Ideal para POC interno.

### Como ativar GitHub OAuth

**1. Criar OAuth App no GitHub** (Settings → Developer settings → OAuth Apps)
- Homepage URL: `http://localhost:3000`
- Callback URL: `http://localhost:7007/api/auth/github/handler/frame`

**2. Adicionar provider no backend:**
```ts
// packages/backend/src/index.ts
backend.add(import('@backstage/plugin-auth-backend-module-github-provider'));
```

**3. Configurar no app-config:**
```yaml
# app-config.local.yaml
auth:
  providers:
    github:
      development:
        clientId: ${AUTH_GITHUB_CLIENT_ID}
        clientSecret: ${AUTH_GITHUB_CLIENT_SECRET}
```

**4. Ativar plugin de auth no frontend:**
```ts
// packages/app/src/App.tsx
import authPlugin from '@backstage/plugin-auth/alpha';

createApp({
  features: [catalogPlugin, authPlugin, navModule],
});
```

---

## 9. Permissões

### Estado atual: allow-all (tudo liberado)

```ts
// packages/backend/src/index.ts
backend.add(import('@backstage/plugin-permission-backend-module-allow-all-policy'));
```

Para produção, substituir por uma política customizada:

```ts
// packages/backend/src/permissions.ts
import { createBackendModule } from '@backstage/backend-plugin-api';
import { PolicyDecision, isPermission } from '@backstage/plugin-permission-common';
import { policyExtensionPoint } from '@backstage/plugin-permission-node';

export const customPermissionPolicy = createBackendModule({
  pluginId: 'permission',
  moduleId: 'custom-policy',
  register(reg) {
    reg.registerInit({
      deps: { policy: policyExtensionPoint },
      async init({ policy }) {
        policy.setPolicy({
          async handle({ permission }, user) {
            // lógica de autorização aqui
            return { result: AuthorizeResult.ALLOW };
          },
        });
      },
    });
  },
});
```

---

## 10. Plugins disponíveis

### Resumo visual do que está ativo vs. disponível

```
ATIVO NO FRONTEND          INSTALADO (não ativado)       ATIVO NO BACKEND
─────────────────────      ──────────────────────────    ──────────────────────────
✅ Catalog                 ⬜ API Docs                   ✅ Catalog
✅ Scaffolder              ⬜ Catalog Graph              ✅ Scaffolder + GitHub
✅ Search (modal)          ⬜ Catalog Import             ✅ TechDocs
✅ TechDocs                ⬜ Kubernetes                 ✅ Auth (Guest)
✅ Notifications           ⬜ Org Chart                  ✅ Search (PostgreSQL)
✅ Signals                 ⬜ Auth UI                    ✅ Kubernetes
✅ User Settings           ⬜ TechDocs Addons            ✅ Notifications + Signals
✅ App Visualizer                                        ✅ Permissions (allow-all)
                                                         ✅ MCP Actions
```

---

## 11. Guia de implementação

### Criar um plugin customizado

```bash
# Na raiz do projeto:
yarn new
# Escolher: plugin → preencher nome e ID
```

Isso cria `plugins/meu-plugin/` com estrutura completa. O plugin aparece automaticamente no catálogo de workspaces.

**Estrutura gerada:**
```
plugins/meu-plugin/
├── src/
│   ├── plugin.ts          # Declaração do plugin (id, routes, extensões)
│   ├── components/
│   │   └── MeuPluginPage/ # Página principal
│   ├── index.ts           # Exports públicos
│   └── routes.ts          # Definição de rotas
├── package.json
└── README.md
```

**Registrar no frontend:**
```ts
// packages/app/src/App.tsx
import meuPlugin from '@internal/plugin-meu-plugin';

createApp({
  features: [catalogPlugin, meuPlugin, navModule],
});
```

### Adicionar proxy para sistema externo

```yaml
# app-config.yaml
proxy:
  endpoints:
    '/jira':
      target: 'https://bradesco.atlassian.net'
      changeOrigin: true
      headers:
        Authorization: Bearer ${JIRA_TOKEN}

    '/sonarqube':
      target: 'https://sonarqube.bradesco.com.br'
      changeOrigin: true
```

No frontend, acessar via: `fetch('/api/proxy/jira/rest/api/2/...')`

### Adicionar nova entidade ao catálogo

1. Criar `catalog-info.yaml` no repositório do serviço
2. Registrar no `app-config.yaml`:
   ```yaml
   catalog:
     locations:
       - type: url
         target: https://github.com/bradesco-seguros/REPO/blob/main/catalog-info.yaml
   ```
3. Ou usar **Catalog Import** em `/catalog-import` no portal

### Criar novo template de scaffolding

1. Criar pasta em `examples/` ou em um repositório dedicado
2. Escrever `template.yaml` com parâmetros e steps
3. Registrar no `app-config.yaml`:
   ```yaml
   catalog:
     locations:
       - type: file
         target: ../../meu-template/template.yaml
         rules:
           - allow: [Template]
   ```

### Ativar TechDocs para um serviço

1. Adicionar anotação no `catalog-info.yaml` do serviço:
   ```yaml
   metadata:
     annotations:
       backstage.io/techdocs-ref: dir:.
   ```
2. Criar `docs/index.md` e `mkdocs.yml` no repositório:
   ```yaml
   # mkdocs.yml
   site_name: Nome do Serviço
   nav:
     - Home: index.md
   plugins:
     - techdocs-core
   ```

---

## 12. Fluxos de dados

### Fluxo do Catálogo

```
app-config.yaml (locations)
        │
        ▼
catalog-backend  ──── processa YAML ──── armazena no banco
        │
        ▼
catalog-backend-module-logs  ──── loga erros de processamento
        │
        ▼
search-backend-module-catalog  ──── indexa para busca
        │
        ▼
Frontend: plugin-catalog  ──── exibe lista, filtros, detalhes
```

### Fluxo do Scaffolder

```
Usuário preenche formulário (frontend)
        │
        ▼
scaffolder-backend recebe parâmetros
        │
        ├── fetch:template  ──── processa arquivos com Nunjucks
        │
        ├── publish:github  ──── cria repo via GitHub API (requer GITHUB_TOKEN)
        │
        ├── catalog:register  ──── registra nova entidade no catálogo
        │
        └── notification:send  ──── envia notificação ao usuário
```

### Fluxo de Autenticação (Guest)

```
Usuário acessa o portal
        │
        ▼
Frontend detecta: nenhuma sessão ativa
        │
        ▼
auth-backend-module-guest-provider  ──── cria sessão automática como "guest"
        │
        ▼
Usuário autenticado como user:default/guest
```

---

## 13. Comandos úteis

```bash
# Iniciar toda a aplicação (frontend + backend)
yarn start

# Iniciar apenas o backend
yarn workspace backend start

# Iniciar apenas o frontend
yarn workspace app start

# Build do backend (para deploy)
yarn build:backend

# Build de tudo
yarn build:all

# Build da imagem Docker do backend
yarn build-image

# Criar novo plugin ou pacote
yarn new

# Rodar todos os testes
yarn test

# Rodar testes e2e (Playwright)
yarn test:e2e

# Lint (apenas arquivos modificados desde origin/master)
yarn lint

# Lint em todos os arquivos
yarn lint:all

# Checar formatação Prettier
yarn prettier:check

# Limpar artefatos de build
yarn clean
```

### Portas padrão

| Serviço | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend | http://localhost:7007 |
| API do Catálogo | http://localhost:7007/api/catalog |
| API do Scaffolder | http://localhost:7007/api/scaffolder/v2 |
| TechDocs API | http://localhost:7007/api/techdocs |
| Ações disponíveis | http://localhost:7007/api/scaffolder/v2/actions |

---

*Documento gerado a partir da análise do código-fonte. Manter atualizado conforme a aplicação evolui.*
