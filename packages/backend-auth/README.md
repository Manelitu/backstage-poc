# packages/backend-auth — Auth

Backend de autenticação. Isolado dos demais por exigência do **trust model do Backstage**: plugins no mesmo processo têm acesso irrestrito entre si — auth em processo separado garante que sessões e tokens não são acessíveis ao catalog nem a nenhum outro backend.

---

## Porta

| Ambiente | URL |
|----------|-----|
| Dev local | http://localhost:7008 |
| Docker interno | http://backstage-auth:7008 |

O browser **nunca acessa esta porta diretamente** — todo tráfego passa pelo proxy em 7007.

---

## Plugins registrados

| Plugin | Responsabilidade |
|--------|-----------------|
| `plugin-auth-backend` | Gerencia sessões, tokens e provedores |
| `plugin-auth-backend-module-guest-provider` | Login sem credenciais (dev/POC) |
| `plugin-auth-backend-module-github-provider` | OAuth via GitHub |

---

## GitHub OAuth

### Callback URL

O OAuth callback passa pelo proxy (7007) antes de chegar a este backend:

```
GitHub → http://localhost:7007/api/auth/github/handler/frame
         ↓ proxy roteia para
         http://backstage-auth:7008/api/auth/github/handler/frame
```

Configure no GitHub OAuth App:
```
Authorization callback URL: http://localhost:7007/api/auth/github/handler/frame
```

### Sign-in resolver

O provedor GitHub usa `usernameMatchingUserEntityName` — o username do GitHub é mapeado para uma entidade `User` no catálogo com `metadata.name` igual (em minúsculas).

O usuário `manelitu` já existe em `examples/org.yaml`. Para adicionar outros usuários, crie entidades `User` no catálogo com `metadata.name` igual ao username do GitHub.

```yaml
# app-config.yaml
auth:
  providers:
    github:
      development:
        clientId: ${AUTH_GITHUB_CLIENT_ID}
        clientSecret: ${AUTH_GITHUB_CLIENT_SECRET}
        callbackUrl: http://localhost:7007/api/auth/github/handler/frame
        signIn:
          resolvers:
            - resolver: usernameMatchingUserEntityName
```

---

## Como rodar

### Dev local

```bash
yarn start:auth
```

Este backend deve ser o primeiro a subir — os demais dependem da validação de tokens do auth.

### Docker

```bash
docker compose up backstage-auth        # só auth + postgres
docker compose --profile full restart backstage-auth  # restart após mudança de config
```

### Build da imagem

```bash
docker build --target backend-auth -t backstage/auth:local .
```

---

## Configuração

Carrega três camadas em ordem crescente de prioridade:

```
app-config.yaml                    ← base: URLs, auth providers, discovery map
app-config.production.yaml         ← produção: PostgreSQL via env vars
packages/backend-auth/app-config.yaml  ← específico: porta 7008, CORS
```

```yaml
# packages/backend-auth/app-config.yaml
backend:
  listen:
    port: 7008
  cors:
    origin: http://localhost:3000
    methods: [GET, HEAD, PATCH, POST, PUT, DELETE]
    credentials: true
```

> **Nota:** `backend.baseUrl` não é sobrescrito aqui — este backend herda `http://localhost:7007` da config base para que o callback URL do OAuth seja construído corretamente apontando para o proxy.

---

## Adicionar um novo provedor de auth

```typescript
// src/index.ts
backend.add(import('@backstage/plugin-auth-backend-module-gitlab-provider'));
```

```yaml
# app-config.yaml
auth:
  providers:
    gitlab:
      development:
        clientId: ${AUTH_GITLAB_CLIENT_ID}
        clientSecret: ${AUTH_GITLAB_CLIENT_SECRET}
        signIn:
          resolvers:
            - resolver: usernameMatchingUserEntityName
```

---

## Leitura relacionada

- [ARCHITECTURE.md § 11](../../ARCHITECTURE.md) — configuração completa de autenticação
- [Docker.md](../../Docker.md) — setup do GitHub OAuth App e troubleshooting
