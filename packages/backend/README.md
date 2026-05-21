# packages/backend — Proxy / API Gateway

Ponto de entrada único do Backstage. Recebe **todo o tráfego do browser** na porta 7007, roteia chamadas de API para os feature backends e serve o React SPA em produção.

---

## Responsabilidades

| Responsabilidade | Como |
|-----------------|------|
| API Gateway | Reverse proxy via `http-proxy-middleware`, lê rotas do config |
| Serve o SPA | `plugin-app-backend` entrega o build estático do frontend |
| Proxy de integrações externas | `plugin-proxy-backend` expõe endpoints externos ao frontend |

Este backend **não executa nenhum plugin de negócio** (catalog, auth, scaffolder, etc.). É intencionalmente leve e stateless.

---

## Porta

| Ambiente | URL |
|----------|-----|
| Dev local | http://localhost:7007 |
| Docker full | http://localhost:7007 |

---

## Plugins registrados

```typescript
// src/index.ts
backend.add(featureBackendProxy);                    // gateway reverso (customizado)
backend.add(import('@backstage/plugin-app-backend')); // serve o React SPA
backend.add(import('@backstage/plugin-proxy-backend')); // proxy para APIs externas
```

### `featureBackendProxy` — como funciona

Lê `backend.discovery.endpoints` do `app-config.yaml` e registra um middleware de proxy para cada plugin:

```
/api/auth/*        → http://localhost:7008  (ou backstage-auth:7008 no Docker)
/api/catalog/*     → http://localhost:7009
/api/permission/*  → http://localhost:7009
/api/search/*      → http://localhost:7009
/api/scaffolder/*  → http://localhost:7010
/api/techdocs/*    → http://localhost:7010
/api/kubernetes/*  → http://localhost:7011
/api/notifications/*→ http://localhost:7011
/api/signals/*     → http://localhost:7011
/api/mcp-actions/* → http://localhost:7011
```

O `pathRewrite` restaura o prefixo `/api/<pluginId>` que o Express remove ao fazer match da rota, para que o backend de destino receba a URL completa.

---

## Como rodar

### Dev local

```bash
yarn start:proxy
```

Requer que os feature backends (7008–7011) já estejam rodando.

### Docker

```bash
docker compose --profile full up backstage-proxy
```

---

## Configuração

Este backend herda a config base (`app-config.yaml`) e os overrides de produção (`app-config.production.yaml`). Não tem `app-config.yaml` próprio porque usa a porta 7007 definida na base.

A chave `backend.discovery.endpoints` no `app-config.yaml` controla para onde cada plugin é roteado:

```yaml
backend:
  discovery:
    endpoints:
      - target: 'http://localhost:7008/api/{{pluginId}}'
        plugins: [auth]
      - target: 'http://localhost:7009/api/{{pluginId}}'
        plugins: [catalog, permission, search]
      # ...
```

Em Docker, os `target` usam os nomes DNS internos (`backstage-auth:7008`, etc.) injetados via variáveis de ambiente no `app-config.production.yaml`.

---

## Leitura relacionada

- [ARCHITECTURE.md](../../ARCHITECTURE.md) — arquitetura completa e fluxos de requisição
- [Docker.md](../../Docker.md) — como buildar e operar via Docker Compose
