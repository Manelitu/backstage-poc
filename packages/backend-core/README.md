# packages/backend-core — Catalog · Permission · Search

Backend dos plugins co-dependentes de alta frequência. Catalog, permission e search ficam juntos porque se chamam constantemente — separá-los geraria chamadas HTTP internas de altíssima frequência.

---

## Porta

| Ambiente | URL |
|----------|-----|
| Dev local | http://localhost:7009 |
| Docker interno | http://backstage-core:7009 |

---

## Plugins registrados

| Plugin | Responsabilidade |
|--------|-----------------|
| `plugin-catalog-backend` | Indexa e serve entidades (Component, API, System, User, Group...) |
| `plugin-catalog-backend-module-scaffolder-entity-model` | Habilita entidades `Template` no catálogo |
| `plugin-catalog-backend-module-logs` | Loga erros de processamento de entidades |
| `plugin-permission-backend` | Framework de autorização — controla quem pode fazer o quê |
| `plugin-permission-backend-module-allow-all-policy` | Política permissiva (dev/POC) |
| `plugin-search-backend` | API de busca global |
| `plugin-search-backend-module-pg` | Usa PostgreSQL como índice de busca |
| `plugin-search-backend-module-catalog` | Indexa entidades do catálogo |
| `plugin-search-backend-module-techdocs` | Indexa páginas de documentação técnica |

### Por que juntos?

- **Permission + Catalog**: o framework de permissões resolve identidades e propriedades de entidades consultando o catalog. Em processo separado, cada verificação de permissão geraria uma chamada HTTP ao catalog.
- **Search + Catalog**: o search indexa o catalog periodicamente (`PT10M`). Em processo separado, cada ciclo de indexação envolveria chamadas HTTP para buscar as entidades.

---

## Como rodar

### Dev local

```bash
yarn start:core
```

Requer que o `backend-auth` (7008) já esteja rodando (validação de tokens de serviço).

### Docker

```bash
docker compose up backstage-core
```

### Build da imagem

```bash
docker build --target backend-core -t backstage/core:local .
```

---

## Configuração

```yaml
# packages/backend-core/app-config.yaml
backend:
  baseUrl: http://localhost:7009
  listen:
    port: 7009
  cors:
    origin: http://localhost:3000
    methods: [GET, HEAD, PATCH, POST, PUT, DELETE]
    credentials: true
```

### Permissões

O estado atual usa `allow-all-policy` — tudo é permitido. Para produção, substituir por uma política customizada:

```typescript
// src/index.ts — remover:
backend.add(import('@backstage/plugin-permission-backend-module-allow-all-policy'));

// adicionar módulo customizado com createBackendModule + policyExtensionPoint
```

### Catálogo — fontes de entidades

As fontes do catálogo são definidas em `app-config.yaml` (seção `catalog.locations`). Exemplos locais estão em `examples/` e fontes de produção são URLs do GitHub.

---

## Tarefas agendadas

| Tarefa | Cadência | Descrição |
|--------|----------|-----------|
| `catalog_orphan_cleanup` | 30s | Remove entidades órfãs do catálogo |
| `search_index_software_catalog` | 10min | Reindexar entidades no search |
| `search_index_techdocs` | 10min | Reindexar páginas de docs no search |

---

## Leitura relacionada

- [ARCHITECTURE.md §§ 3, 9, 12](../../ARCHITECTURE.md) — catalog, catálogo de entidades, permissões
- [docs/catalog-relations.md](../../docs/catalog-relations.md) — modelo de relações do catálogo
