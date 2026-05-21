# packages/backend-content — Scaffolder · TechDocs

Backend de geração de conteúdo. Scaffolder e TechDocs ficam juntos porque têm padrão de carga similar: I/O intensivo em picos (execução de templates e geração de documentação MkDocs), com períodos ociosos entre os picos.

---

## Porta

| Ambiente | URL |
|----------|-----|
| Dev local | http://localhost:7010 |
| Docker interno | http://backstage-content:7010 |

---

## Plugins registrados

| Plugin | Responsabilidade |
|--------|-----------------|
| `plugin-scaffolder-backend` | Engine de execução de templates (Software Templates) |
| `plugin-scaffolder-backend-module-github` | Actions GitHub: criar repo, PR, webhook, branch protection, etc. |
| `plugin-scaffolder-backend-module-notifications` | Notifica usuários via `notifications` ao fim de um template |
| `plugin-techdocs-backend` | Geração e hospedagem de documentação técnica (MkDocs) |

### Actions disponíveis no Scaffolder

Para listar todas as actions disponíveis em runtime:
```
http://localhost:7007/api/scaffolder/v2/actions
```

Actions padrão disponíveis:

| Action | Descrição |
|--------|-----------|
| `fetch:template` | Copia e processa arquivos com Nunjucks |
| `fetch:plain` | Copia arquivos sem processamento |
| `publish:github` | Cria repositório no GitHub |
| `publish:github:pull-request` | Abre PR em repositório existente |
| `catalog:register` | Registra entidade no catálogo |
| `catalog:write` | Escreve arquivo `catalog-info.yaml` |
| `github:actions:dispatch` | Dispara GitHub Action |
| `github:repo:create` | Cria repositório |
| `github:webhook` | Cria webhook em repositório |
| `github:branch-protection:create` | Configura branch protection |
| `notification:send` | Envia notificação no portal |
| `debug:log` / `debug:wait` | Utilitários de debug em templates |

---

## Como rodar

### Dev local

```bash
yarn start:content
```

Requer `backend-auth` (7008) e `backend-core` (7009) rodando.

### Docker

```bash
docker compose up backstage-content
```

### Build da imagem

```bash
docker build --target backend-content -t backstage/content:local .
```

---

## Configuração

```yaml
# packages/backend-content/app-config.yaml
backend:
  baseUrl: http://localhost:7010
  listen:
    port: 7010
  cors:
    origin: http://localhost:3000
    methods: [GET, HEAD, PATCH, POST, PUT, DELETE]
    credentials: true
```

### TechDocs

Configurado em modo `local` (geração e armazenamento no próprio container):

```yaml
# app-config.yaml
techdocs:
  builder: local
  generator:
    runIn: docker
  publisher:
    type: local
```

Para produção, migrar para `publisher.type: googleGcs` ou `awsS3` com `builder: external` (CI/CD gera os docs, não o backend).

---

## Leitura relacionada

- [ARCHITECTURE.md §§ 3, 10](../../ARCHITECTURE.md) — scaffolder e templates
