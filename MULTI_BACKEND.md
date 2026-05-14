# Do Monólito ao Multi-Backend no Backstage

> Como a dívida técnica do backend monolítico se manifesta, por que o Backstage foi projetado para ser dividido, e qual o caminho para resolver isso em produção.

---

## Índice

1. [O Problema: O Monólito que Cresceu Demais](#1-o-problema-o-monólito-que-cresceu-demais)
2. [Por que o Backstage Foi Projetado para Ser Dividido](#2-por-que-o-backstage-foi-projetado-para-ser-dividido)
3. [Anatomia do Problema na Pipeline de Build](#3-anatomia-do-problema-na-pipeline-de-build)
4. [Estratégias de Solução](#4-estratégias-de-solução)
5. [Como Agrupar os Plugins](#5-como-agrupar-os-plugins)
6. [Arquitetura de Produção com Multi-Backend](#6-arquitetura-de-produção-com-multi-backend)
7. [O Plugin Oficial de Gateway](#7-o-plugin-oficial-de-gateway)
8. [DiscoveryService: o Elo Entre os Backends](#8-discoveryservice-o-elo-entre-os-backends)
9. [Otimização das Imagens Docker](#9-otimização-das-imagens-docker)
10. [Configuração Kubernetes](#10-configuração-kubernetes)
11. [Roteiro de Migração](#11-roteiro-de-migração)
12. [Pontos de Atenção](#12-pontos-de-atenção)

---

## 1. O Problema: O Monólito que Cresceu Demais

O template padrão do Backstage entrega um único `packages/backend` com todos os plugins rodando em um só processo Node.js, empacotado em um único container Docker. Essa abordagem funciona bem para começar, mas cria uma dívida técnica que se materializa em três frentes conforme o portal cresce:

### Problema 1 — Build que estoura memória na pipeline

O `yarn build:backend` compila TypeScript, agrupa todos os módulos e gera artefatos para cada plugin instalado. Quanto mais plugins, mais memória o processo de build do Node.js consome. Em pipelines CI/CD com runners compartilhados ou com limite de RAM (ex: 4–8 GB), o processo é interrompido com erro `JavaScript heap out of memory` antes de terminar.

```
FATAL ERROR: Reached heap limit Allocation failed
- JavaScript heap out of memory
```

Aumentar `--max-old-space-size` resolve temporariamente, mas não ataca a causa raiz.

### Problema 2 — Pod com consumo de memória desproporcional

Com todos os plugins no mesmo processo, o consumo de RAM em runtime é a soma de todos:

| Plugin | Consumo estimado em runtime |
|--------|-----------------------------|
| Catalog (indexação contínua) | Alto — mantém entidades em cache |
| TechDocs (geração de docs) | Muito alto em picos — processa MkDocs |
| Search (indexação full-text) | Médio — mantém índice em memória |
| Scaffolder (execução de templates) | Pico alto durante execução |
| Kubernetes (polling de clusters) | Médio — polling periódico |
| Notifications + Signals | Baixo — mas mantém conexões abertas |

Com tudo junto, o pod exige `requests` e `limits` dimensionados para o pior caso de todos os plugins simultaneamente. Isso desperdiça recursos quando o sistema está em uso normal.

### Problema 3 — Escala ineficiente

Para garantir disponibilidade, o cluster cria réplicas do monólito. Cada réplica carrega todos os plugins, mesmo que apenas o catalog esteja sofrendo carga. O resultado: escala do TechDocs quando o problema é o Search. O custo de compute cresce linearmente com o número de réplicas sem proporcionalidade com a carga real por domínio.

```
3 réplicas do monólito:
  Pod 1: catalog + search + scaffolder + techdocs + k8s + notif  (1.8 GB RAM)
  Pod 2: catalog + search + scaffolder + techdocs + k8s + notif  (1.8 GB RAM)
  Pod 3: catalog + search + scaffolder + techdocs + k8s + notif  (1.8 GB RAM)
  Total: 5.4 GB apenas para garantir disponibilidade do catalog
```

---

## 2. Por que o Backstage Foi Projetado para Ser Dividido

Esse não é um problema que surgiu depois — o Backstage foi **arquitetado desde o início para suportar múltiplos backends**. Isso está documentado explicitamente:

> *"You can decide how many different backends you want to deploy, having all features in a single one or splitting things out into multiple smaller deployments, depending on your need to scale and isolate individual features."*
> — Backstage Backend System Architecture Docs

A razão é estrutural: **cada plugin é um microserviço**.

> *"Each plugin operates completely independently of all other plugins and they only communicate with each other through network calls. There can be no direct communication between plugins through code. Because of this constraint, each plugin can be considered to be its own microservice."*
> — Backstage Backend System Architecture Docs

Isso significa que a separação em múltiplos backends não é um hack — é o modelo de deployment avançado que o framework foi construído para suportar. O monólito é o ponto de partida, não o destino.

### O New Backend System (v1.0, setembro 2024)

O New Backend System, lançado em versão estável em setembro de 2024, foi o marco que tornou a divisão prática. Antes dele, a separação era possível mas complexa. Com ele:

- Cada backend é criado com `createBackend()` e aceita plugins via `backend.add()`
- Módulos estão fortemente acoplados ao plugin pai, mas desacoplados de outros plugins
- O `DiscoveryService` é a interface que resolve onde cada plugin está hospedado
- A configuração é lida de arquivos YAML por processo, não globalmente

---

## 3. Anatomia do Problema na Pipeline de Build

O build monolítico do Backstage funciona assim:

```
yarn build:backend
    │
    ├── TypeScript compilation (tsc) — todos os pacotes juntos
    │   └── Peak memory: O(n_plugins × tamanho_médio_do_tipo)
    │
    ├── Bundling (esbuild/webpack) — todos os módulos
    │   └── Peak memory: O(n_plugins × n_dependências)
    │
    └── Docker build — copia tudo para uma imagem
        └── Imagem final: única, grande, com todas as dependências
```

O pico de memória ocorre na fase de bundling, onde o grafo de dependências de todos os plugins é resolvido simultaneamente. Com 15–25 plugins, esse grafo pode consumir 6–10 GB de RAM em projetos maduros.

### Com multi-backend

Cada backend tem seu próprio `Dockerfile` e seu próprio ciclo de build:

```
yarn build:backend-catalog    # compila apenas plugins do catalog
    └── Peak memory: ~1.5 GB

yarn build:backend-search     # compila apenas plugins de search
    └── Peak memory: ~0.8 GB

yarn build:backend-techdocs   # compila apenas plugins de techdocs
    └── Peak memory: ~0.6 GB
```

Builds menores cabem em runners mais baratos, podem rodar em paralelo na pipeline e falham de forma isolada — um plugin problemático não bloqueia o build dos outros.

---

## 4. Estratégias de Solução

### Opção A — Escala horizontal do monólito *(paliativo)*

Manter o monólito e adicionar mais réplicas, com `PodDisruptionBudget` e `HorizontalPodAutoscaler`.

- **Vantagem:** sem mudança de arquitetura
- **Desvantagem:** não resolve o problema de build, não resolve a ineficiência de memória, e o custo cresce sem proporcionalidade

### Opção B — Aumentar recursos da pipeline *(paliativo)*

Aumentar o `--max-old-space-size` do Node.js e usar runners com mais RAM.

```dockerfile
ENV NODE_OPTIONS="--max-old-space-size=8192"
```

- **Vantagem:** implementação imediata
- **Desvantagem:** custo alto de infraestrutura, não resolve o problema em produção

### Opção C — Multi-backend *(solução estrutural)*

Separar os plugins em backends independentes, cada um com seu próprio container, Deployment e pipeline de build.

- **Vantagem:** resolve os três problemas simultaneamente — build, runtime e escala
- **Desvantagem:** aumento de complexidade operacional
- **Recomendado para:** ambientes de produção com múltiplos times e requisitos de disponibilidade

### Opção D — Monólito modular com namespace de banco *(meio-termo)*

Manter um único processo mas com plugins organizados em namespaces de banco de dados separados e com HPA agressivo.

- **Vantagem:** menor complexidade que o multi-backend
- **Desvantagem:** não resolve o problema de build nem o isolamento de falhas

---

## 5. Como Agrupar os Plugins

A divisão não precisa ser um backend por plugin — o objetivo é agrupar por **afinidade de carga** e **dependência funcional**.

### Critérios de agrupamento

| Critério | Descrição |
|----------|-----------|
| **Carga de CPU/RAM** | Plugins pesados ficam sozinhos para poder escalar independente |
| **Dependência funcional** | Plugins que se chamam frequentemente ficam juntos (reduz latência) |
| **Frequência de deploy** | Plugins que mudam juntos ficam no mesmo backend |
| **Ownership de time** | Cada time opera o backend que é dono |

### Agrupamento recomendado

```
┌─────────────────────────────────────────────────────────────────┐
│  backend-gateway (porta 7007)                                   │
│  Responsabilidade: roteamento + SPA                             │
│  Plugins: plugin-gateway-backend, plugin-app-backend            │
│  Escala: 2–3 réplicas (stateless, leve)                        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  backend-catalog (porta 7008)                                   │
│  Responsabilidade: identidade, acesso, entidades                │
│  Plugins: catalog, auth, permission                             │
│  Escala: 2–4 réplicas (carga alta e constante)                 │
│  RAM estimada por pod: 600–900 MB                               │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  backend-platform (porta 7009)                                  │
│  Responsabilidade: ferramentas de plataforma                    │
│  Plugins: techdocs, kubernetes, dynatrace, outros plugins leves │
│  Escala: 1–2 réplicas (carga baixa, esporádica)                │
│  RAM estimada por pod: 400–700 MB                               │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  backend-search (porta 7010)                                    │
│  Responsabilidade: indexação e busca full-text                  │
│  Plugins: search, módulos de indexação                          │
│  Escala: 1–3 réplicas (picos durante indexação)                │
│  RAM estimada por pod: 300–600 MB                               │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  backend-delivery (porta 7011)                                  │
│  Responsabilidade: criação e entrega de serviços                │
│  Plugins: scaffolder, notifications, signals                    │
│  Escala: 1–2 réplicas (picos durante execução de templates)    │
│  RAM estimada por pod: 300–500 MB                               │
└─────────────────────────────────────────────────────────────────┘
```

> **Princípio:** o catalog é o plugin mais requisitado de qualquer instalação Backstage. Ele deve estar em seu próprio backend com capacidade de escala independente. TechDocs tem picos altos mas esporádicos — pode compartilhar backend com plugins mais leves.

---

## 6. Arquitetura de Produção com Multi-Backend

```
                         Internet / Rede interna
                                  │
                         ┌────────▼────────┐
                         │  Load Balancer  │
                         └────────┬────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │   Ingress Controller       │
                    │   (nginx / Traefik / ALB)  │
                    │                            │
                    │  /api/catalog/*  ──────────┼──► backend-catalog  :7008
                    │  /api/auth/*     ──────────┼──► backend-catalog  :7008
                    │  /api/permission/* ────────┼──► backend-catalog  :7008
                    │  /api/search/*   ──────────┼──► backend-search   :7009
                    │  /api/scaffolder/* ────────┼──► backend-delivery :7010
                    │  /api/notifications/* ─────┼──► backend-delivery :7010
                    │  /api/techdocs/* ──────────┼──► backend-platform :7011
                    │  /api/kubernetes/* ────────┼──► backend-platform :7011
                    │  /*              ──────────┼──► backend-gateway  :7007
                    └───────────────────────────┘
                                  │
              ┌───────────────────┼───────────────────┐
              │                   │                   │
    ┌─────────▼──────┐  ┌────────▼───────┐  ┌────────▼───────┐
    │ backend-catalog │  │ backend-search │  │backend-platform│
    │  (2–4 pods)    │  │   (1–3 pods)   │  │  (1–2 pods)    │
    └────────┬───────┘  └────────┬───────┘  └────────┬───────┘
             │                   │                   │
             └───────────────────┼───────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │  PostgreSQL (compartilhado ou por schema) │
                    └─────────────────────────┘
```

### Comunicação interna (backend → backend)

Quando o scaffolder precisa chamar o catalog, ele usa o `DiscoveryService` para resolver o endereço interno (via Service do Kubernetes, não via Ingress):

```
backend-delivery  ──► K8s Service ──► backend-catalog
(namespace interno, sem passar pelo Ingress)
```

Isso é mais eficiente (sem TLS e autenticação de Ingress) e não expõe chamadas internas ao exterior.

---

## 7. O Plugin Oficial de Gateway

A Backstage lançou `@backstage/plugin-gateway-backend` para resolver o roteamento de frontend → múltiplos backends sem necessidade de configurar regras no Ingress manualmente para cada plugin.

### O que ele faz

O plugin age como um **reverse proxy inteligente** dentro do próprio backend gateway. Ele usa o `DiscoveryService` configurado para saber onde cada plugin está hospedado e roteia as requisições do frontend automaticamente:

```typescript
// packages/backend/src/index.ts
import { createBackend } from '@backstage/backend-defaults';

const backend = createBackend();
backend.add(import('@backstage/plugin-gateway-backend'));  // ← roteamento automático
backend.add(import('@backstage/plugin-app-backend'));      // ← serve a SPA
backend.start();
```

### Vantagem sobre implementação manual

| | Implementação manual (http-proxy-middleware) | plugin-gateway-backend |
|-|----------------------------------------------|------------------------|
| Configuração | Código TypeScript explícito por rota | Automático via DiscoveryService |
| Atualização de rotas | Requer redeploy do gateway | Relê a config sem alterar código |
| Priorização de plugins locais | Manual | Nativo |
| Manutenção | Time responsável pelo gateway | Backstage core team |

### Instalação

```bash
yarn workspace backend add @backstage/plugin-gateway-backend
```

```typescript
// packages/backend/src/index.ts
backend.add(import('@backstage/plugin-gateway-backend'));
```

O gateway usa o `DiscoveryService` registrado no processo para resolver para onde encaminhar cada `/api/<pluginId>`. Por isso, o backend gateway precisa ter o mesmo `multiBackendDiscovery` configurado com o mapa de endpoints.

---

## 8. DiscoveryService: o Elo Entre os Backends

O `DiscoveryService` é a peça central do multi-backend. Ele responde a uma pergunta simples: *"em qual URL está o plugin X?"*

### O comportamento padrão (quebra no multi-backend)

O `DiscoveryService` padrão resolve qualquer plugin para o `backend.baseUrl` do próprio processo. No monólito, isso funciona porque todos os plugins estão no mesmo endereço.

```
backend-catalog pergunta: "onde está o plugin 'notifications'?"
DiscoveryService padrão responde: "http://localhost:7008/api/notifications"
                                                    ↑
                                          (endereço do próprio catalog)
Resultado: chamada para si mesmo → 404
```

### A solução: DiscoveryService customizado

O `multiBackendDiscovery` (em `packages/backend-common`) lê `backend.discovery.endpoints` do config e devolve a URL correta por plugin:

```typescript
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
      getBaseUrl: async (id) => pluginUrls.get(id) ?? `${baseUrl}/api/${id}`,
      getExternalBaseUrl: async (id) => pluginUrls.get(id) ?? `${baseUrl}/api/${id}`,
    };
  },
});
```

```yaml
# app-config.yaml
backend:
  discovery:
    endpoints:
      - target: 'http://backend-catalog-svc:7008/api/{{pluginId}}'
        plugins: [catalog, auth, permission]
      - target: 'http://backend-search-svc:7009/api/{{pluginId}}'
        plugins: [search]
      - target: 'http://backend-delivery-svc:7010/api/{{pluginId}}'
        plugins: [scaffolder, notifications, signals]
      - target: 'http://backend-platform-svc:7011/api/{{pluginId}}'
        plugins: [techdocs, kubernetes]
```

Em produção, os targets usam os nomes dos **Kubernetes Services** (DNS interno do cluster), não `localhost`.

---

## 9. Otimização das Imagens Docker

### Problema: o Dockerfile monolítico

O `Dockerfile` padrão do Backstage copia o workspace inteiro, instala todas as dependências e compila tudo de uma vez. O resultado é uma imagem que carrega dependências de plugins que não serão usados naquele container.

### Estrutura do Dockerfile por backend

Cada backend deve ter seu próprio `Dockerfile` que usa o mecanismo de `yarn workspaces focus` para incluir apenas as dependências do seu pacote:

```dockerfile
# packages/backend-catalog/Dockerfile

# Estágio 1: skeleton (cache de package.json)
FROM node:22-bookworm-slim AS skeleton
WORKDIR /app
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn .yarn
COPY packages/backend-catalog/package.json packages/backend-catalog/
COPY packages/backend-common/package.json  packages/backend-common/
RUN find packages -name "package.json" | xargs tar cf skeleton.tar

# Estágio 2: build
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY --from=skeleton /app/skeleton.tar .
RUN tar xf skeleton.tar
COPY yarn.lock .yarnrc.yml .yarn ./
RUN yarn workspaces focus --all
COPY . .
RUN yarn tsc && yarn build:backend-catalog

# Estágio 3: produção (apenas o que é necessário)
FROM node:22-bookworm-slim
WORKDIR /app
COPY --from=build /app/packages/backend-catalog/dist ./
COPY --from=build /app/node_modules node_modules/
ENV NODE_ENV=production
CMD ["node", "index.js"]
```

### Comparação de tamanho esperada

| Abordagem | Tamanho estimado da imagem | Dependências incluídas |
|-----------|---------------------------|------------------------|
| Monólito (todos os plugins) | 1.2–2.0 GB | Todas |
| backend-catalog (3 plugins) | 350–500 MB | Apenas catalog + auth + permission |
| backend-search (4 plugins) | 250–400 MB | Apenas search e módulos |
| backend-platform (2–4 plugins) | 300–500 MB | Apenas techdocs + k8s + extras |

### Técnicas adicionais de redução

**Base image menor:** trocar `node:22-bookworm` por `node:22-alpine` ou `gcr.io/distroless/nodejs22` pode reduzir 200–400 MB da imagem base.

**Pruning de dependências:**
```bash
# Instalação apenas de dependências de produção
yarn workspaces focus --all --production
```

**`wolfi-base` (distroless para Backstage):** a comunidade reportou redução de 98.2% em vulnerabilidades e redução significativa no tamanho usando a imagem `wolfi-base` como base do stage final.

---

## 10. Configuração Kubernetes

### Deployments separados

Cada backend tem seu próprio `Deployment`, `Service` e `HorizontalPodAutoscaler`:

```yaml
# k8s/backend-catalog/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backstage-catalog
spec:
  replicas: 2
  selector:
    matchLabels:
      app: backstage-catalog
  template:
    spec:
      containers:
        - name: backend-catalog
          image: backstage-catalog:latest
          ports:
            - containerPort: 7008
          resources:
            requests:
              memory: "512Mi"
              cpu: "250m"
            limits:
              memory: "1Gi"
              cpu: "500m"
          env:
            - name: NODE_OPTIONS
              value: "--max-old-space-size=768"
---
apiVersion: v1
kind: Service
metadata:
  name: backend-catalog-svc
spec:
  selector:
    app: backstage-catalog
  ports:
    - port: 7008
      targetPort: 7008
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: backstage-catalog-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: backstage-catalog
  minReplicas: 2
  maxReplicas: 6
  metrics:
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 70
```

### Ingress com roteamento por path

```yaml
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: backstage-ingress
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /$2
spec:
  rules:
    - host: backstage.empresa.com.br
      http:
        paths:
          # Catalog, auth, permission → backend-catalog
          - path: /api/(catalog|auth|permission)(/|$)(.*)
            pathType: ImplementationSpecific
            backend:
              service:
                name: backend-catalog-svc
                port:
                  number: 7008

          # Search → backend-search
          - path: /api/search(/|$)(.*)
            pathType: ImplementationSpecific
            backend:
              service:
                name: backend-search-svc
                port:
                  number: 7009

          # Todo o restante → gateway
          - path: /
            pathType: Prefix
            backend:
              service:
                name: backend-gateway-svc
                port:
                  number: 7007
```

> **Alternativa sem Ingress complexo:** usar o `plugin-gateway-backend` no backend gateway e configurar o Ingress apenas para rotear tudo para o gateway (porta 7007). O gateway então roteia internamente usando o DiscoveryService. Mais simples de manter — troca de complexidade no Ingress por complexidade no gateway.

### Recursos por backend

| Backend | CPU request | CPU limit | RAM request | RAM limit | Min pods | Max pods |
|---------|-------------|-----------|-------------|-----------|----------|----------|
| gateway | 100m | 300m | 128Mi | 256Mi | 2 | 4 |
| catalog | 250m | 500m | 512Mi | 1Gi | 2 | 6 |
| search | 200m | 400m | 384Mi | 768Mi | 1 | 4 |
| platform | 150m | 300m | 256Mi | 512Mi | 1 | 3 |
| delivery | 150m | 400m | 256Mi | 512Mi | 1 | 3 |

---

## 11. Roteiro de Migração

### Fase 1 — Identificar e medir *(sem downtime)*

- Instrumentar o monólito com métricas de memória por plugin (usar `process.memoryUsage()` em health endpoints)
- Identificar os plugins com maior consumo em pico
- Medir o tempo de build atual e o pico de RAM da pipeline
- Estabelecer baselines de latência entre plugins

### Fase 2 — Extrair o plugin mais crítico *(risco baixo)*

Começar com o catalog, que é o mais demandado e o que mais contribui para o tamanho do processo:

1. Criar `packages/backend-catalog` com apenas `plugin-catalog-backend`, `plugin-auth-backend` e `plugin-permission-backend`
2. Configurar `DiscoveryService` customizado
3. Configurar o Ingress para rotear `/api/catalog`, `/api/auth` e `/api/permission` para o novo container
4. Remover esses plugins do monólito após validação
5. Medir redução de memória e tempo de build

### Fase 3 — Extrair plugins restantes *(iterativo)*

Seguir o mesmo processo para search, scaffolder, techdocs, etc., em iterações separadas. Cada extração é um ciclo de deploy independente.

### Fase 4 — Transformar o monólito em gateway *(finalização)*

Quando todos os plugins tiverem sido extraídos, o `packages/backend` original vira o gateway — apenas com `plugin-gateway-backend` e `plugin-app-backend`.

### Fase 5 — Otimizar pipelines de build *(ganho operacional)*

Com backends separados, configurar a pipeline para:
- Builds em paralelo por backend
- Build condicional por backend (se apenas `backend-search` mudou, rebuildar só ele)
- Imagens menores com dependências focadas

---

## 12. Pontos de Atenção

### Banco de dados compartilhado vs. por backend

O Backstage usa um banco PostgreSQL compartilhado com schemas separados por plugin (`backstage_plugin_catalog`, `backstage_plugin_auth`, etc.). Isso simplifica a operação inicial do multi-backend — cada backend acessa apenas seus próprios schemas, mas todos apontam para o mesmo servidor de banco.

Em cenários de alta maturidade, é possível separar os bancos por backend para isolamento total, mas isso requer gerenciamento de migrations separados.

### Módulos devem sempre ficar com seu plugin

> *"Each module may only use Extension Points that belong to a single plugin, and the module must be deployed together with that plugin in the same backend instance."*

`plugin-scaffolder-backend-module-github` deve estar no mesmo backend que `plugin-scaffolder-backend`. Módulos não podem ser separados do plugin pai.

### Comunicação interna não passa pelo Ingress

Chamadas backend → backend devem usar os DNS internos do Kubernetes (`backend-catalog-svc:7008`), não a URL pública. Isso evita latência de TLS e saída de rede desnecessária.

### Migração gradual é possível

O monólito e os backends separados podem coexistir durante a migração. O Ingress roteia as rotas já extraídas para o novo backend, e o resto segue no monólito. Não é necessário migrar tudo de uma vez.

---

## Referências

- [Scaling Backstage Deployments](https://backstage.io/docs/deployment/scaling/) — documentação oficial sobre escala e split de backends
- [Backend System Architecture](https://backstage.io/docs/backend-system/architecture/index/) — modelo de plugins como microserviços
- [Backend Instances](https://backstage.io/docs/backend-system/architecture/backends/) — múltiplos deployments e o papel do backend como unidade de deploy
- [Building a Docker Image](https://backstage.io/docs/deployment/docker/) — estrutura do Dockerfile e multi-stage builds
- [@backstage/plugin-gateway-backend](https://www.npmjs.com/package/@backstage/plugin-gateway-backend) — plugin oficial de gateway para roteamento entre backends
- [New Backend System](https://backstage.io/docs/backend-system/) — sistema de backend estável desde setembro de 2024
- [Backstage Wrapped 2024](https://backstage.io/blog/2024/12/18/backstage-wrapped-2024/) — lançamento do New Backend System v1.0
