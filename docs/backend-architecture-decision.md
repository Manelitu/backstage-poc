# Decisão de Arquitetura — Divisão do Backend por Funcionalidade

> Backstage POC · Decisão registrada em: 2026-05-13

---

## Por que este documento existe

Este documento registra a decisão de dividir o backend do Backstage de um único processo monolítico em múltiplos backends independentes, um por funcionalidade. O objetivo é que qualquer pessoa do time consiga entender **o que mudou**, **por que mudou** e **quais são os trade-offs** dessa decisão.

---

## O problema que motivou a mudança

O Backstage foi implantado inicialmente como um **monolito**: um único container Docker carregando o frontend React e todos os plugins de backend num mesmo processo Node.js.

```
ANTES — Container único
┌──────────────────────────────────────────────────────┐
│  Frontend (React)                                    │
│  Backend Node.js                                     │
│    └── catalog + auth + search + scaffolder          │
│        + techdocs + kubernetes + notifications       │
│        + signals + permissions + mcp-actions         │
└──────────────────────────────────────────────────────┘
```

Isso causou três problemas concretos:

| # | Problema | Consequência |
|---|----------|--------------|
| 1 | Build monolítico consome +2 GB de RAM | Pipeline de CI estoura memória e falha |
| 2 | Pod único com todos os plugins | Alto consumo de memória por réplica (~1.5–2 GB) |
| 3 | Escala horizontal replica tudo | Cada nova réplica sobe todos os plugins, mesmo os menos usados — desperdício de recursos no cluster |

---

## A solução adotada

Dividir o backend em **7 processos independentes**, um por domínio funcional, seguindo o modelo suportado nativamente pelo Backstage:

> *"You can have all features in a single one, or split things out into multiple smaller deployments, depending on your need to scale and isolate individual features."*
> — Backstage Architecture Overview

```
DEPOIS — 7 containers independentes
┌──────────────┐  ┌───────────────┐  ┌────────────────┐
│   backend    │  │backend-catalog│  │ backend-search │
│  (frontend   │  │  catalog      │  │   search       │
│   + proxy)   │  │  auth         │  │   collators    │
│   porta 7007 │  │  permissions  │  │   porta 7009   │
└──────────────┘  │   porta 7008  │  └────────────────┘
                  └───────────────┘
┌──────────────────┐  ┌───────────────┐  ┌──────────────────┐  ┌──────────────────────┐
│backend-scaffolder│  │backend-techdocs│  │backend-kubernetes│  │backend-notifications │
│  scaffolder      │  │   techdocs     │  │   kubernetes     │  │  notifications       │
│  github module   │  │   porta 7011   │  │   porta 7012     │  │  signals             │
│  porta 7010      │  └───────────────┘  └──────────────────┘  │  mcp-actions         │
└──────────────────┘                                             │  porta 7013          │
                                                                 └──────────────────────┘
```

---

## Descrição de cada backend

### `backend` — Core / Gateway
**Porta:** 7007 · **Imagem:** `backstage`

Responsável por servir o frontend React e expor endpoints de proxy para serviços externos. É o ponto de entrada da aplicação para o navegador.

| Plugin | Função |
|--------|--------|
| `plugin-app-backend` | Serve o bundle React do frontend |
| `plugin-proxy-backend` | Proxy HTTPS/CORS para serviços externos |

---

### `backend-catalog` — Catálogo, Autenticação e Permissões
**Porta:** 7008 · **Imagem:** `backstage-catalog`

Núcleo do portal. Gerencia todas as entidades do catálogo de software, cuida do login dos usuários e controla quem pode fazer o quê.

| Plugin | Função |
|--------|--------|
| `plugin-catalog-backend` | Motor do catálogo de software |
| `plugin-catalog-backend-module-scaffolder-entity-model` | Suporte a entidades do tipo Template |
| `plugin-catalog-backend-module-logs` | Log de erros de processamento do catálogo |
| `plugin-auth-backend` | Autenticação de usuários |
| `plugin-auth-backend-module-guest-provider` | Login sem credenciais (dev/POC) |
| `plugin-auth-backend-module-github-provider` | Login via GitHub OAuth |
| `plugin-permission-backend` | Framework de permissões |
| `plugin-permission-backend-module-allow-all-policy` | Política permissiva (dev/POC) |

---

### `backend-search` — Busca
**Porta:** 7009 · **Imagem:** `backstage-search`

Indexa e serve resultados de busca global do portal. Os coletores (collators) buscam dados do catálogo e do TechDocs via chamadas HTTP para os backends correspondentes.

| Plugin | Função |
|--------|--------|
| `plugin-search-backend` | Motor de busca |
| `plugin-search-backend-module-pg` | Engine PostgreSQL para indexação |
| `plugin-search-backend-module-catalog` | Indexa entidades do catálogo |
| `plugin-search-backend-module-techdocs` | Indexa documentação técnica |

---

### `backend-scaffolder` — Templates e Criação de Serviços
**Porta:** 7010 · **Imagem:** `backstage-scaffolder`

Executa os templates de scaffolding: lê parâmetros do formulário, cria repositórios no GitHub, registra novas entidades no catálogo e dispara notificações.

| Plugin | Função |
|--------|--------|
| `plugin-scaffolder-backend` | Motor de execução de templates |
| `plugin-scaffolder-backend-module-github` | Ações GitHub (criar repo, abrir PR) |
| `plugin-scaffolder-backend-module-notifications` | Notifica ao concluir template |

---

### `backend-techdocs` — Documentação Técnica
**Porta:** 7011 · **Imagem:** `backstage-techdocs`

Gera e hospeda documentação técnica integrada ao catálogo de software (MkDocs/Markdown).

| Plugin | Função |
|--------|--------|
| `plugin-techdocs-backend` | Geração e hospedagem de docs |

---

### `backend-kubernetes` — Integração com Clusters
**Porta:** 7012 · **Imagem:** `backstage-kubernetes`

Conecta o portal aos clusters Kubernetes, exibindo workloads, pods, deployments e status dos serviços diretamente no catálogo.

| Plugin | Função |
|--------|--------|
| `plugin-kubernetes-backend` | Integração com clusters Kubernetes |

---

### `backend-notifications` — Notificações, Sinais e MCP
**Porta:** 7013 · **Imagem:** `backstage-notifications`

Gerencia notificações em tempo real, eventos via WebSocket/SSE e ações via Model Context Protocol (IA).

| Plugin | Função |
|--------|--------|
| `plugin-notifications-backend` | Centro de notificações |
| `plugin-signals-backend` | WebSocket / Server-Sent Events |
| `plugin-mcp-actions-backend` | Actions via IA (MCP) |

---

## Mapa de portas (desenvolvimento local)

| Backend | Porta | Comando para iniciar |
|---------|-------|----------------------|
| backend (core) | 7007 | `yarn start` |
| backend-catalog | 7008 | `yarn start:catalog` |
| backend-search | 7009 | `yarn start:search` |
| backend-scaffolder | 7010 | `yarn start:scaffolder` |
| backend-techdocs | 7011 | `yarn start:techdocs` |
| backend-kubernetes | 7012 | `yarn start:kubernetes` |
| backend-notifications | 7013 | `yarn start:notifications` |

---

## Como os backends se comunicam

Cada backend roda de forma isolada. Quando um precisa chamar outro (ex: o search precisa indexar dados do catalog), faz isso via **chamada HTTP** usando o `DiscoveryService`.

O Backstage resolve automaticamente para qual URL enviar cada chamada com base na configuração `backend.discovery.endpoints` no `app-config.yaml`:

```
backend-search ──HTTP──► backend-catalog  (para indexar entidades)
backend-search ──HTTP──► backend-techdocs (para indexar docs)
backend-scaffolder ──HTTP──► backend-catalog (para registrar novas entidades)
```

Em produção, cada backend é um `Service` no Kubernetes. A variável de ambiente define o endereço interno:

```
BACKSTAGE_CATALOG_URL       → http://backstage-catalog:7007
BACKSTAGE_SEARCH_URL        → http://backstage-search:7007
BACKSTAGE_SCAFFOLDER_URL    → http://backstage-scaffolder:7007
BACKSTAGE_TECHDOCS_URL      → http://backstage-techdocs:7007
BACKSTAGE_KUBERNETES_URL    → http://backstage-kubernetes:7007
BACKSTAGE_NOTIFICATIONS_URL → http://backstage-notifications:7007
```

---

## Prós e contras

### ✅ Prós

| Benefício | Detalhe |
|-----------|---------|
| **Build mais leve** | Cada imagem Docker compila apenas os plugins do seu domínio — sem estouro de memória na pipeline |
| **Pod menor** | Cada container usa apenas a memória dos seus plugins. O catalog ficou com ~512 MB vs ~1.5 GB do monolito |
| **Escala granular** | É possível ter 4 réplicas do catalog e 1 do TechDocs — paga só pelo que escala |
| **Isolamento de falhas** | Um bug no Kubernetes plugin não derruba o catálogo |
| **Deploy independente** | Atualizar o TechDocs não exige reiniciar o catalog |
| **Ownership claro** | Times diferentes podem ser donos de backends diferentes |

### ⚠️ Contras / Pontos de atenção

| Limitação | Detalhe |
|-----------|---------|
| **Mais processos para subir** | Em desenvolvimento, são 7 terminais para ter tudo funcionando |
| **Configuração de discovery obrigatória** | Sem a configuração correta de `backend.discovery.endpoints`, os backends não se encontram |
| **Reverse proxy necessário em produção** | O frontend faz chamadas para um único host; um Ingress ou Nginx precisa rotear `/api/<plugin>` para o backend certo |
| **`BACKEND_SECRET` deve ser compartilhado** | Todos os backends precisam da mesma chave para validar tokens JWT entre si |
| **Debugging mais complexo** | Um fluxo como "criar serviço via template" passa por scaffolder → catalog → notifications — rastrear um erro exige olhar logs de múltiplos pods |

---

## Resumo da decisão

```
┌──────────────────────────────────────────────────────────────────┐
│  PROBLEMA         Monolito com +2 GB de RAM no build e pods      │
│                   pesados escalando tudo ou nada                 │
├──────────────────────────────────────────────────────────────────┤
│  SOLUÇÃO          7 backends independentes, um por domínio       │
├──────────────────────────────────────────────────────────────────┤
│  GANHO IMEDIATO   Builds sem estouro + pods menores              │
├──────────────────────────────────────────────────────────────────┤
│  CUSTO            Mais complexidade operacional e de config      │
├──────────────────────────────────────────────────────────────────┤
│  SUPORTADO PELO   Sim — é o modelo recomendado para produção     │
│  BACKSTAGE?       pelo próprio framework                         │
└──────────────────────────────────────────────────────────────────┘
```

---

*Documento criado em 2026-05-13 · Projeto: backstage-poc*
