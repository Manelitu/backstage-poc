# Guia do Manifesto Kubernetes — Backstage POC

Este documento explica cada seção do `deployment.yaml`, o que cada campo significa e por que foi estruturado dessa forma.

---

## Visão Geral da Arquitetura

O Backstage foi dividido em **5 backends independentes**, cada um com seu próprio banco de dados PostgreSQL dedicado. Essa separação espelha o padrão de microsserviços e permite escalar, atualizar ou reiniciar cada parte sem afetar as demais.

```
┌─────────────────────────────────────────────┐
│              NAMESPACE: backstage            │
│                                             │
│  [postgres-auth]   ←→  [backstage-auth]  7008  Auth
│  [postgres-core]   ←→  [backstage-core]  7009  Catalog / Permission / Search
│  [postgres-content]←→  [backstage-content]7010  Scaffolder / TechDocs
│  [postgres-aux]    ←→  [backstage-aux]   7011  Kubernetes / Notifications / MCP
│  [postgres-proxy]  ←→  [backstage-proxy] 7007  ← entrypoint público
└─────────────────────────────────────────────┘
```

---

## Seção 1 — Namespace

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: backstage
  labels:
    app.kubernetes.io/name: backstage
```

### O que é

Um **Namespace** é um espaço de nomes isolado dentro do cluster Kubernetes. Todos os recursos criados depois (Pods, Services, Secrets, etc.) pertencem a esse namespace.

### Por que foi usado assim

- **Isolamento**: separa todos os recursos do Backstage dos demais workloads do cluster. Nenhum recurso de outro namespace interfere aqui.
- **Controle de acesso (RBAC)**: permissões podem ser aplicadas por namespace, facilitando restringir quem pode ver ou modificar os recursos do Backstage.
- **Organização**: facilita listar, monitorar e deletar tudo de uma vez (`kubectl delete namespace backstage`).
- O `label` `app.kubernetes.io/name` segue a convenção oficial da CNCF para identificação de workloads.

---

## Seção 2 — Secret

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: backstage-credentials
  namespace: backstage
type: Opaque
stringData:
  POSTGRES_USER: "backstage"
  POSTGRES_PASSWORD: "changeme"
  AUTH_GITHUB_CLIENT_ID: ""
  AUTH_GITHUB_CLIENT_SECRET: ""
  GITHUB_TOKEN: ""
```

### O que é

Um **Secret** armazena informações sensíveis de forma separada do código da aplicação. O tipo `Opaque` é o genérico para dados arbitrários em formato chave-valor.

### O que cada campo guarda

| Campo | Uso |
|-------|-----|
| `POSTGRES_USER` | Usuário de acesso a todos os bancos PostgreSQL |
| `POSTGRES_PASSWORD` | Senha de todos os bancos PostgreSQL |
| `AUTH_GITHUB_CLIENT_ID` | ID do OAuth App do GitHub para autenticação |
| `AUTH_GITHUB_CLIENT_SECRET` | Segredo do OAuth App do GitHub |
| `GITHUB_TOKEN` | Token de acesso para integração com repositórios GitHub (catalog, scaffolder) |

### Por que foi usado assim

- **Segurança**: credenciais nunca ficam escritas diretamente nos `Deployments`. Os containers referenciam o Secret via `secretKeyRef`, e o Kubernetes injeta os valores em tempo de execução.
- **`stringData` vs `data`**: usamos `stringData` para facilitar a edição — o Kubernetes converte automaticamente para Base64 internamente. Em `data`, os valores já precisariam estar em Base64.
- **Um Secret centralizado**: todos os 5 backends usam o mesmo Secret, evitando duplicação e simplificando a rotação de credenciais (muda em um lugar, reflete em todos).

> **Importante para produção**: substitua os valores padrão pelo comando `kubectl create secret` (comentado no arquivo) ou use um gerenciador de secrets como HashiCorp Vault ou AWS Secrets Manager.

---

## Seção 3 — ConfigMap Compartilhado

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config-shared
  namespace: backstage
data:
  app-config.yaml: |
    ...
  app-config.production.yaml: |
    ...
```

### O que é

Um **ConfigMap** armazena configurações não-sensíveis. Este ConfigMap específico contém dois arquivos de configuração do Backstage que são montados dentro de todos os containers como arquivos em disco.

### Os dois arquivos dentro do ConfigMap

#### `app-config.yaml` — configuração base

Contém as definições globais da aplicação:

| Seção | O que configura |
|-------|----------------|
| `app.title` / `app.baseUrl` | Nome e URL do frontend |
| `app.extensions` | Ativa/desativa itens de navegação da UI |
| `organization.name` | Nome da organização exibido no portal |
| `backend.discovery.endpoints` | Mapeia cada plugin para o backend responsável (ex: `auth` → porta 7008) |
| `integrations.github` | Token de acesso para leitura de repositórios |
| `auth.providers` | Configura autenticação via GitHub OAuth e modo guest |
| `catalog.locations` | Lista de arquivos e URLs com entidades do catálogo |
| `permission.enabled` | Ativa o sistema de permissões do Backstage |
| `mcpActions` | Configuração do servidor MCP (Model Context Protocol) |

#### `app-config.production.yaml` — sobrescritas de produção

Este arquivo **sobrescreve** configurações do `app-config.yaml` quando `NODE_ENV=production`. Contém:

| Seção | O que muda em produção |
|-------|------------------------|
| `backend.listen.host` | Define `0.0.0.0` para aceitar conexões externas (em dev seria `localhost`) |
| `backend.database` | Troca SQLite em memória por PostgreSQL real (usando variáveis de ambiente) |
| `backend.discovery` | Usa as variáveis `BACKSTAGE_*_URL` para apontar para os outros backends no cluster |
| `catalog.locations` | Usa caminhos relativos dentro do container (`./examples/`) em vez de `../../examples/` |

### Por que foi estruturado assim

- **DRY (Don't Repeat Yourself)**: um único ConfigMap é montado em todos os 5 backends, evitando duplicar 200 linhas de YAML.
- **Separação base/produção**: o Backstage tem suporte nativo a múltiplos arquivos de config que se mesclam em ordem. O `app-config.production.yaml` sobrescreve apenas o necessário, mantendo a config base limpa.
- **`discovery.endpoints`**: é o mecanismo central que permite ao backend-proxy (porta 7007) saber que o plugin `auth` mora no `backstage-auth:7008`, `catalog` no `backstage-core:7009`, etc. Sem isso, cada backend não saberia onde encontrar os demais.

---

## Seção 4 — ConfigMaps por Componente

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config-auth   # (ou core, content, aux)
data:
  app-config.yaml: |
    backend:
      listen:
        port: 7008
      cors:
        origin: http://localhost:3000
        methods: [GET, HEAD, PATCH, POST, PUT, DELETE]
        credentials: true
```

### O que é

Cada backend tem seu próprio ConfigMap que define **sua porta específica e política de CORS**. Este arquivo é montado no caminho `packages/backend-<nome>/app-config.yaml` dentro do container.

### Por que foi usado assim

- **Cada backend escuta em uma porta diferente**: auth=7008, core=7009, content=7010, aux=7011, proxy=7007. Sem esse ConfigMap individual, todos tentariam subir na porta padrão 7007 e conflitariam.
- **CORS separado**: o Backstage mescla os arquivos de config em ordem (base → production → componente). O ConfigMap do componente é o último a ser lido, garantindo que a porta correta sempre prevaleça.
- **Separação de responsabilidade**: configurações globais ficam no ConfigMap compartilhado; configurações específicas de cada serviço ficam no ConfigMap do componente.

---

## Seção 5 — StatefulSets e Services do PostgreSQL

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres-auth
spec:
  serviceName: postgres-auth
  replicas: 1
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: 5Gi
```

### Por que StatefulSet e não Deployment?

Bancos de dados precisam de **identidade estável e armazenamento persistente**. O StatefulSet garante:

| Característica | StatefulSet | Deployment |
|----------------|-------------|------------|
| Nome do Pod | Sempre `postgres-auth-0` | Hash aleatório |
| Volume associado | Permanece ao reiniciar | Pode ser perdido |
| DNS estável | `postgres-auth-0.postgres-auth` | Não garantido |
| Ordem de inicialização | Garantida | Aleatória |

Para o banco de dados, o nome fixo é essencial: o backend precisa conectar em `postgres-auth` e esse endereço nunca muda.

### `volumeClaimTemplates`

```yaml
volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 5Gi
```

- **`volumeClaimTemplates`**: provisiona automaticamente um PersistentVolume de 5Gi para cada réplica do banco. Os dados sobrevivem a reinicializações do Pod.
- **`ReadWriteOnce`**: o volume só pode ser montado por um nó por vez — adequado para um banco de dados single-node.
- **5Gi por banco**: sizing conservador para POC. Em produção, ajuste de acordo com o volume de dados esperado.

### Probes do PostgreSQL

```yaml
readinessProbe:
  exec:
    command: ["pg_isready", "-U", "$(POSTGRES_USER)"]
  initialDelaySeconds: 5
  periodSeconds: 10
livenessProbe:
  exec:
    command: ["pg_isready", "-U", "$(POSTGRES_USER)"]
  initialDelaySeconds: 15
  periodSeconds: 20
```

- **`readinessProbe`**: o Kubernetes só envia tráfego para o Pod quando ele responde `OK` ao `pg_isready`. Evita conexões antes do banco estar pronto.
- **`livenessProbe`**: reinicia o container automaticamente se o banco parar de responder.
- **`initialDelaySeconds` diferente**: o liveness começa mais tarde (15s) para evitar reinícios prematuros durante a inicialização fria do Postgres.

### Service headless do PostgreSQL

```yaml
apiVersion: v1
kind: Service
metadata:
  name: postgres-auth
spec:
  clusterIP: None   # ← headless
  selector:
    app: postgres-auth
  ports:
    - port: 5432
```

- **`clusterIP: None`** torna o Service "headless": em vez de um IP virtual, o DNS resolve diretamente para o IP do Pod.
- Isso é necessário para StatefulSets — permite que o backend conecte em `postgres-auth` e alcance sempre o mesmo Pod (`postgres-auth-0`).

### Resources (requests e limits)

```yaml
resources:
  requests:
    memory: "128Mi"
    cpu: "50m"
  limits:
    memory: "512Mi"
    cpu: "500m"
```

- **`requests`**: quantidade mínima garantida pelo scheduler ao alocar o Pod em um nó.
- **`limits`**: teto máximo. Se ultrapassar a memória, o container é terminado (OOMKill). Se ultrapassar CPU, é throttled.
- PostgreSQL foi dimensionado menor (128Mi) que os backends Node.js (256Mi) pois, nesta arquitetura, cada banco serve apenas um backend.

---

## Seção 6 — Deployments dos Backends

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backstage-auth
spec:
  replicas: 1
  selector:
    matchLabels:
      app: backstage-auth
  template:
    spec:
      initContainers: [...]
      containers: [...]
      volumes: [...]
```

### Por que Deployment (e não StatefulSet) para os backends?

Os backends Node.js são **stateless** — não guardam estado em disco. O Deployment é ideal para workloads stateless pois:
- Permite escalar horizontalmente (`replicas: N`) sem preocupação com identidade de Pod.
- Gerencia rolling updates automaticamente.
- Pods podem ser criados em qualquer nó disponível.

### `initContainers` — aguardar o PostgreSQL

```yaml
initContainers:
  - name: wait-for-postgres
    image: postgres:16-alpine
    command:
      - sh
      - -c
      - until pg_isready -h postgres-auth -U $(POSTGRES_USER); do echo "aguardando..."; sleep 2; done
```

- **O problema**: Kubernetes sobe Pods em paralelo. O backend pode tentar conectar ao banco antes dele estar pronto, falhando com erro de conexão.
- **A solução**: o `initContainer` roda **antes** do container principal. Fica em loop verificando `pg_isready` até o banco responder. Só então o backend Node.js é iniciado.
- **Por que usar a imagem `postgres:16-alpine`**: ela já tem o binário `pg_isready` instalado, sem precisar de uma imagem customizada.

### Variáveis de ambiente dos backends

```yaml
env:
  - name: NODE_ENV
    value: production
  - name: NODE_OPTIONS
    value: "--no-node-snapshot"
  - name: POSTGRES_HOST
    value: postgres-auth
  - name: POSTGRES_USER
    valueFrom:
      secretKeyRef:
        name: backstage-credentials
        key: POSTGRES_USER
  - name: BACKSTAGE_AUTH_URL
    value: http://backstage-auth:7008
```

| Variável | Motivo |
|----------|--------|
| `NODE_ENV=production` | Ativa o carregamento do `app-config.production.yaml` pelo Backstage |
| `NODE_OPTIONS=--no-node-snapshot` | Desativa otimização de snapshot do V8 que causa problemas com alguns plugins do Backstage |
| `POSTGRES_HOST` | Nome DNS do Service do PostgreSQL dentro do cluster |
| `POSTGRES_USER/PASSWORD` | Injetados do Secret — nunca hardcoded |
| `BACKSTAGE_*_URL` | URLs internas para descoberta de serviços. Usadas no `app-config.production.yaml` como `${BACKSTAGE_AUTH_URL}` |
| `AUTH_GITHUB_CLIENT_ID/SECRET` | Apenas nos backends `auth` e `proxy` — os únicos que lidam com OAuth |
| `GITHUB_TOKEN` | Em todos os backends — necessário para integração com o GitHub (catalog, scaffolder) |

### `volumeMounts` — montagem dos arquivos de config

```yaml
volumeMounts:
  - name: app-config-shared
    mountPath: /app/app-config.yaml
    subPath: app-config.yaml
  - name: app-config-shared
    mountPath: /app/app-config.production.yaml
    subPath: app-config.production.yaml
  - name: app-config-auth
    mountPath: /app/packages/backend-auth/app-config.yaml
    subPath: app-config.yaml
```

- **`subPath`**: permite montar um arquivo específico dentro de um ConfigMap em um caminho exato, sem sobrescrever o diretório inteiro.
- Os três arquivos são montados nas mesmas posições que o Backstage espera encontrá-los em desenvolvimento, mantendo compatibilidade.
- O terceiro mount (`app-config-auth`) sobrescreve a porta e CORS conforme o ConfigMap do componente.

### `volumes` — declaração das fontes

```yaml
volumes:
  - name: app-config-shared
    configMap:
      name: app-config-shared
  - name: app-config-auth
    configMap:
      name: app-config-auth
```

- Liga os nomes usados em `volumeMounts` aos ConfigMaps reais. O Kubernetes projeta o conteúdo dos ConfigMaps como arquivos dentro do container.

### Probes dos backends

```yaml
readinessProbe:
  tcpSocket:
    port: 7008
  initialDelaySeconds: 15
  periodSeconds: 10
livenessProbe:
  tcpSocket:
    port: 7008
  initialDelaySeconds: 30
  periodSeconds: 30
```

- **`tcpSocket`**: verifica se a porta está aceitando conexões TCP. Mais simples que um HTTP check e suficiente para garantir que o Node.js está ouvindo.
- **`initialDelaySeconds: 15`** no readiness: o backend leva alguns segundos para carregar plugins e conectar ao banco — sem esse delay, o Kubernetes marcaria o Pod como não-pronto prematuramente.
- **`initialDelaySeconds: 30`** no liveness: dá mais tempo antes de considerar reiniciar. Backends Node.js com muitos plugins podem demorar mais para inicializar.

---

## Seção 6.5 — Service dos Backends

### Services internos (ClusterIP padrão)

```yaml
apiVersion: v1
kind: Service
metadata:
  name: backstage-auth
spec:
  selector:
    app: backstage-auth
  ports:
    - port: 7008
      targetPort: 7008
```

- **`ClusterIP` (padrão)**: cria um IP virtual interno acessível apenas dentro do cluster. Nenhum tráfego externo chega diretamente nesses backends.
- O `selector` `app: backstage-auth` encontra automaticamente os Pods do Deployment correspondente.
- O nome `backstage-auth` vira DNS interno: `http://backstage-auth:7008` resolve para o IP do Service.

### Service do Proxy (entrypoint público)

```yaml
apiVersion: v1
kind: Service
metadata:
  name: backstage-proxy
spec:
  type: LoadBalancer
  selector:
    app: backstage-proxy
  ports:
    - port: 7007
      targetPort: 7007
```

- **`LoadBalancer`**: provisiona um IP externo (em cloud providers como GKE, EKS, AKS). É o único ponto de entrada público da aplicação.
- Apenas o `backstage-proxy` é exposto externamente. Os demais backends (auth, core, content, aux) ficam acessíveis somente dentro do cluster.
- Para ambientes on-prem sem cloud load balancer, substitua por `type: NodePort`.

---

## Fluxo Completo de uma Requisição

```
Usuário (browser)
    │
    ▼
[LoadBalancer :7007]
    │
    ▼
[backstage-proxy Pod]  ── app-config-shared (discovery map)
    │
    ├── /api/auth/*       → http://backstage-auth:7008
    ├── /api/catalog/*    → http://backstage-core:7009
    ├── /api/scaffolder/* → http://backstage-content:7010
    └── /api/kubernetes/* → http://backstage-aux:7011
```

O `backstage-proxy` age como **API gateway interno**: recebe todas as requisições na porta 7007 e as encaminha para o backend correto com base na rota, usando o mapa de descoberta definido em `backend.discovery.endpoints`.

---

## Checklist Antes de Aplicar em Produção

- [ ] Preencher o Secret com credenciais reais (usar `kubectl create secret` ou Vault)
- [ ] Substituir `IMAGE_REGISTRY` nos 5 Deployments pela URL do registry real
- [ ] Atualizar `app.baseUrl` e `backend.baseUrl` no ConfigMap compartilhado para a URL real do cluster
- [ ] Atualizar `callbackUrl` do GitHub OAuth para a URL pública real
- [ ] Avaliar o tamanho dos PersistentVolumes (5Gi por banco — ajustar conforme necessidade)
- [ ] Avaliar os `resources.limits` dos backends (1Gi RAM, 1 CPU) para o ambiente alvo
- [ ] Considerar adicionar `HorizontalPodAutoscaler` para os backends stateless
- [ ] Para on-prem: trocar `type: LoadBalancer` por `type: NodePort` ou adicionar um Ingress Controller
