# packages/backend-aux — Kubernetes · Notifications · Signals · MCP

Backend auxiliar. Agrupa plugins de baixo tráfego e sem necessidade de escala independente, evitando a proliferação de processos sem justificativa.

---

## Porta

| Ambiente | URL |
|----------|-----|
| Dev local | http://localhost:7011 |
| Docker interno | http://backstage-aux:7011 |

---

## Plugins registrados

| Plugin | Responsabilidade |
|--------|-----------------|
| `plugin-kubernetes-backend` | Agrega dados de clusters Kubernetes e associa a entidades do catálogo |
| `plugin-notifications-backend` | Persistência e entrega de notificações para usuários |
| `plugin-signals-backend` | Push em tempo real via WebSocket/SSE (usado pelo notifications) |
| `plugin-mcp-actions-backend` | Expõe ações do Scaffolder via Model Context Protocol (integração AI) |

---

## Como rodar

### Dev local

```bash
yarn start:aux
```

Requer `backend-auth` (7008) e `backend-core` (7009) rodando.

### Docker

```bash
docker compose up backstage-aux
```

### Build da imagem

```bash
docker build --target backend-aux -t backstage/aux:local .
```

---

## Configuração

```yaml
# packages/backend-aux/app-config.yaml
backend:
  baseUrl: http://localhost:7011
  listen:
    port: 7011
  cors:
    origin: http://localhost:3000
    methods: [GET, HEAD, PATCH, POST, PUT, DELETE]
    credentials: true
```

### Kubernetes

Requer um kubeconfig válido para funcionar. O aviso nos logs `Failed to initialize kubernetes backend: valid kubernetes config is missing` é esperado no POC local sem cluster configurado.

Para conectar a um cluster, adicione em `app-config.local.yaml`:

```yaml
kubernetes:
  serviceLocatorMethod:
    type: multiTenant
  clusterLocatorMethods:
    - type: config
      clusters:
        - url: https://seu-cluster.example.com
          name: meu-cluster
          authProvider: serviceAccount
          serviceAccountToken: ${K8S_TOKEN}
```

### Signals e Notifications

O plugin `signals` estabelece conexões persistentes (SSE/WebSocket) com o frontend para entregar notificações em tempo real. Se o backend de eventos (`/api/events`) não estiver disponível, o signals opera em modo local (apenas notificações geradas no mesmo processo).

O aviso `Event subscribe request failed with status 404` nos logs é esperado — indica que o backend de eventos não está configurado, mas o sistema funciona normalmente em modo degradado.

### MCP Actions

Expõe as actions do Scaffolder como ferramentas MCP para integração com assistentes de IA. Documentação: [Backstage MCP Actions](https://backstage.io/docs/ai/mcp-actions).

---

## Leitura relacionada

- [ARCHITECTURE.md § 3](../../ARCHITECTURE.md) — responsabilidades do backend-aux
