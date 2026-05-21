# Docker — Guia de Operação e Funcionamento

Este documento cobre **como operar** o projeto via Docker Compose e **como o Dockerfile funciona** internamente — decisões tomadas e por quê.

---

## Operação Rápida

### Pré-requisitos

- Docker Desktop 4.x+ com BuildKit habilitado
- Arquivo `.env` configurado (ver abaixo)

### Variáveis de ambiente

```bash
cp .env.example .env
# edite .env e preencha AUTH_GITHUB_CLIENT_ID e AUTH_GITHUB_CLIENT_SECRET
```

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `POSTGRES_USER` | `backstage` | Usuário do banco PostgreSQL |
| `POSTGRES_PASSWORD` | `backstage` | Senha do banco PostgreSQL |
| `YARN_ENABLE_STRICT_SSL` | `true` | Defina `false` em redes com certificado auto-assinado |
| `AUTH_GITHUB_CLIENT_ID` | — | Client ID do GitHub OAuth App |
| `AUTH_GITHUB_CLIENT_SECRET` | — | Client Secret do GitHub OAuth App |

### GitHub OAuth App

Crie em **GitHub → Settings → Developer settings → OAuth Apps → New OAuth App**:

| Campo | Valor |
|-------|-------|
| Homepage URL | `http://localhost:7007` |
| Authorization callback URL | `http://localhost:7007/api/auth/github/handler/frame` |

> **Por que 7007 e não 7008?** O callback deve passar pelo proxy (7007), não diretamente para o backend-auth (7008). Se apontasse para 7008, o cookie de sessão seria definido numa origem diferente do frontend, quebrando a autenticação.

### Modos de execução

**Tudo no Docker** (recomendado para demo/staging):
```bash
docker compose --profile full up --build
# acesse http://localhost:7007
```

**Híbrido** (backends no Docker, frontend local):
```bash
# Terminal 1
docker compose up --build
# Terminal 2
yarn start:frontend      # proxy :7007 + webpack :3000
# acesse http://localhost:3000
```

### Comandos do dia a dia

```bash
# Subir tudo com rebuild
docker compose --profile full up --build

# Rebuild de um serviço específico
docker compose --profile full up --build backstage-auth

# Aplicar mudança de YAML sem rebuild (config é volume-mounted)
docker compose --profile full restart backstage-auth

# Ver logs em tempo real
docker compose logs -f backstage-auth

# Parar tudo
docker compose --profile full down

# Parar e apagar banco de dados
docker compose --profile full down -v

# Build sem cache (quando a cache do Docker está estranha)
docker compose build --no-cache
```

### Troubleshooting

| Erro | Causa | Solução |
|------|-------|---------|
| `pull access denied for backstage/auth` | Imagem local não buildada | `docker compose --profile full up --build` |
| `yarn install --immutable` falha | `yarn.lock` inconsistente | `yarn install` localmente, commitar o lockfile atualizado |
| `The redirect_uri is not associated` | Callback URL errado no GitHub OAuth App | Confirmar `http://localhost:7007/api/auth/github/handler/frame` no GitHub |
| `Missing session cookie` | Fluxo OAuth não completou (erro acima) | Resolver o redirect_uri primeiro |
| `GitHub provider not configured to support sign-in` | Falta `signIn.resolvers` no config | Adicionar resolver em `app-config.yaml` (ver ARCHITECTURE.md § 11) |
| `Skipping initialization` no PostgreSQL | Normal — volume com dados de execução anterior | Não é erro |

---

## Visão geral do Dockerfile

O projeto tem cinco processos Node.js independentes que precisam existir em produção:

| Serviço | Porta | Responsabilidade |
|---|---|---|
| `backend-auth` | 7008 | Autenticação (guest, GitHub OAuth) |
| `backend-core` | 7009 | Catálogo, Permissões, Busca |
| `backend-content` | 7010 | Scaffolder, TechDocs |
| `backend-aux` | 7011 | Kubernetes, Notificações, Signals, MCP |
| `backend-proxy` | 7007 | Gateway de API + host do React SPA |

O objetivo do Dockerfile é construir **uma imagem separada para cada um desses processos** a partir de uma única fonte de verdade — sem duplicar as etapas de instalação e compilação.

---

## Multi-stage build: o conceito central

Um Dockerfile tradicional produz uma imagem só. O multi-stage build (`FROM ... AS nome`) permite definir **múltiplos estágios dentro do mesmo arquivo**, onde cada estágio pode copiar arquivos de outro estágio anterior.

O resultado prático: o Docker compila tudo uma vez, depois "recorta" apenas o que cada imagem final precisa. As imagens finais **não carregam** compiladores, ferramentas de build, devDependencies nem código-fonte TypeScript — apenas os binários compilados e as dependências de produção.

---

## Grafo de estágios

```
node:24-trixie-slim
        │
        ▼
     [base]  ──────────────────────────────────────────┐
    apt packages                                        │
        │                                               │
        ├──────────────────┐                            │
        ▼                  ▼                            ▼
   [deps-dev]          [prod-deps]               (runtime stages)
  yarn install         yarn install
  (dev + prod)         (prod only)
        │                  │
        ▼                  │
    [builder]              │
   tsc + build             │
   todos os             ───┘
   backends                │
        │                  │
        └────────┬──────────┘
                 ▼
     ┌───────────┬───────────┬───────────┬───────────┐
     │           │           │           │           │
[backend-  [backend-  [backend-  [backend-  [backend-
  auth]      core]     content]    aux]      proxy]
 porta      porta      porta      porta      porta
  7008       7009       7010       7011       7007
```

Cada imagem final herda de `base` (sistema operacional + pacotes nativos) e recebe conteúdo copiado de `prod-deps` (node_modules de produção) e de `builder` (código compilado).

---

## Estágio `base` — sistema operacional

```dockerfile
FROM node:24-trixie-slim AS base

ENV PYTHON=/usr/bin/python3

RUN apt-get install -y python3 g++ build-essential libsqlite3-dev
```

**Por que esses pacotes?**

- `python3 + g++ + build-essential`: o plugin `plugin-scaffolder-backend` depende do pacote `isolate-vm`, que precisa ser compilado a partir do código C++ nativo durante o `yarn install`. Sem esses compiladores, a instalação falha.
- `libsqlite3-dev`: o pacote `better-sqlite3` (banco de dados local para desenvolvimento) também é um addon nativo que requer os headers do SQLite.

**`--mount=type=cache`**: o apt tem seu próprio cache de pacotes (`.deb`) que normalmente é descartado ao final de cada `RUN`. Com o mount de cache do BuildKit, esses arquivos são preservados entre builds, acelerando reconstruções.

**Por que `trixie-slim`?** É a versão Debian Trixie (13) "slim" — mínima em tamanho, com suporte a `glibc` moderno necessário para os binários Node.js 24.

---

## Estágio `deps-dev` — instalação completa de dependências

```dockerfile
FROM base AS deps-dev

ARG YARN_ENABLE_STRICT_SSL=true
ENV YARN_ENABLE_STRICT_SSL=${YARN_ENABLE_STRICT_SSL}

USER node
WORKDIR /app

COPY --chown=node:node .yarn ./.yarn
COPY --chown=node:node .yarnrc.yml yarn.lock backstage.json package.json ./

COPY --chown=node:node packages/backend-auth/package.json ./packages/backend-auth/
# ... demais package.json ...

RUN yarn install --immutable
```

### Por que `USER node` antes de `WORKDIR /app`?

O Docker cria o diretório `/app` com as permissões do usuário **ativo no momento** da instrução `WORKDIR`. Ao definir `USER node` primeiro, o diretório `/app` é criado como propriedade do usuário `node` (UID 1000). Se a ordem fosse invertida, `/app` seria criado como root e o usuário `node` não conseguiria escrever nele, causando falhas no `yarn install`.

### Por que copiar só os `package.json` antes do código-fonte?

Esta é a técnica do **skeleton de dependências**. O Docker armazena cada instrução `RUN`/`COPY` como uma camada imutável. Uma camada só é reconstruída se ela ou alguma camada anterior mudar.

Se copiássemos o código-fonte antes de instalar dependências, **qualquer alteração em qualquer arquivo `.ts` invalidaria o cache do `yarn install`**, forçando uma reinstalação completa a cada build — o que pode levar vários minutos. Copiando apenas os `package.json` primeiro, o `yarn install` só é reexecutado quando as dependências de fato mudam.

### `--chown=node:node`

Garante que os arquivos copiados pertençam ao usuário `node` dentro do container. Sem isso, arquivos copiados como root podem gerar erros de permissão em tempo de execução.

### `yarn install --immutable`

O flag `--immutable` impede que o `yarn.lock` seja modificado durante a instalação. Se o `yarn.lock` estiver desatualizado em relação ao `package.json`, o comando falha com erro claro — comportamento correto para builds reprodutíveis.

### `YARN_ENABLE_STRICT_SSL`

Build argument que controla a verificação SSL do Yarn. O valor padrão é `true` (seguro). Em redes corporativas com certificado auto-assinado (como a Bradesco Seguros), passar `--build-arg YARN_ENABLE_STRICT_SSL=false` permite que o Yarn baixe pacotes sem rejeitar o certificado da cadeia corporativa.

---

## Estágio `builder` — compilação

```dockerfile
FROM deps-dev AS builder

COPY --chown=node:node . .

RUN yarn tsc
RUN yarn build:backends
RUN yarn workspace app build
```

Este estágio herda as dependências já instaladas de `deps-dev` e adiciona o código-fonte completo.

### Por que `COPY . .` é a última cópia?

Porque qualquer alteração em qualquer arquivo do projeto invalida esta camada. Ao manter as dependências instaladas em camadas anteriores, o `COPY . .` invalida apenas a compilação — que é rápida — e não a instalação de pacotes — que é lenta.

### As três etapas de build

1. **`yarn tsc`**: gera os arquivos de declaração TypeScript (`.d.ts`) em `dist-types/`. Necessário para que os pacotes do monorepo se enxerguem com tipagem correta durante a compilação.

2. **`yarn build:backends`**: executa `backstage-cli package build` em todos os backends (auth, core, content, aux, proxy) em paralelo via `yarn workspaces foreach`. Cada backend é compilado com esbuild, gerando um bundle CommonJS em `packages/<nome>/dist/index.cjs.js`. O `backend-common` (biblioteca compartilhada) **não é compilado separadamente** — seu código TypeScript é inlined pelo bundler dentro de cada backend que o importa.

3. **`yarn workspace app build`**: compila o React SPA com webpack, gerando arquivos estáticos em `packages/app/dist/`. Esses arquivos são copiados para o `backend-proxy`, que os serve via `plugin-app-backend`.

---

## Estágio `prod-deps` — dependências só de produção

```dockerfile
FROM base AS prod-deps

# ... copia package.json skeletons ...

RUN yarn workspaces focus --all --production
```

Este estágio é paralelo ao `builder` — não depende dele. Enquanto o `builder` compila TypeScript, o `prod-deps` instala as dependências de produção.

### Por que separar de `deps-dev`?

As `devDependencies` (TypeScript, Jest, Backstage CLI, etc.) podem somar centenas de MB. Incluí-las nas imagens de produção aumentaria o tamanho desnecessariamente e ampliaria a superfície de ataque. O `prod-deps` garante que apenas o que é necessário em runtime entre nas imagens finais.

### `yarn workspaces focus --all --production`

Instala as dependências de todos os workspaces, mas somente as declaradas em `dependencies` (não `devDependencies`). O Yarn também instala os addons nativos (melhor-sqlite3, pg) compilando-os neste estágio com os compiladores do `base`.

---

## Estágios de runtime — as imagens finais

Todos os cinco estágios de runtime seguem o mesmo padrão:

```dockerfile
FROM base AS backend-auth          # herda só o SO + pacotes nativos

ENV NODE_ENV=production
ENV NODE_OPTIONS="--no-node-snapshot"

USER node
WORKDIR /app

# Dependências de produção (de prod-deps)
COPY --chown=node:node --from=prod-deps /app/node_modules ./node_modules
COPY --chown=node:node --from=prod-deps /app/package.json ./package.json

# Biblioteca compartilhada (de builder)
COPY --chown=node:node --from=builder /app/packages/backend-common/package.json ./packages/backend-common/
COPY --chown=node:node --from=builder /app/packages/backend-common/src           ./packages/backend-common/src

# Código compilado do backend específico (de builder)
COPY --chown=node:node --from=builder /app/packages/backend-auth/package.json ./packages/backend-auth/
COPY --chown=node:node --from=builder /app/packages/backend-auth/dist          ./packages/backend-auth/dist

# Configuração em camadas
COPY --chown=node:node app-config.yaml app-config.production.yaml ./
COPY --chown=node:node packages/backend-auth/app-config.yaml ./packages/backend-auth/

EXPOSE 7008

CMD ["node", "packages/backend-auth",
     "--config", "app-config.yaml",
     "--config", "app-config.production.yaml",
     "--config", "packages/backend-auth/app-config.yaml"]
```

### `NODE_ENV=production`

Ativa otimizações de runtime no Node.js e em bibliotecas como Express. Também é respeitado pelo Backstage para desativar ferramentas de desenvolvimento.

### `NODE_OPTIONS="--no-node-snapshot"`

O Node.js 20+ introduziu snapshots V8 para acelerar a inicialização. O Backstage usa `isolate-vm` para executar código de scaffolding em sandbox, e o mecanismo de snapshot é incompatível com essa biblioteca. O flag desabilita o snapshot para evitar falhas na inicialização.

### `--from=prod-deps` e `--from=builder`

A instrução `COPY --from=<stage>` copia arquivos de outro estágio sem carregar aquele estágio inteiro na imagem final. É assim que as imagens de runtime ficam pequenas: recebem apenas os artefatos necessários, não as ferramentas de build.

### `backend-common/src` nas imagens de runtime

O `backend-common` é a biblioteca interna compartilhada pelos cinco backends. Seu `package.json` declara `"main": "src/index.ts"` — aponta diretamente para TypeScript, sem compilação própria. O bundler do Backstage CLI inline esse código TypeScript dentro de cada backend durante o `yarn build:backends`. Porém, o `node_modules` de produção contém um symlink `backend-common → packages/backend-common`. Para que esse symlink não quebre em runtime (caso algum require não bundled tente resolvê-lo), a fonte do `backend-common` é copiada como fallback.

### Configuração em camadas

Cada backend carrega três arquivos de configuração, do mais genérico para o mais específico:

```
app-config.yaml                          # base: URLs, integrações, catálogo
app-config.production.yaml               # produção: banco PostgreSQL, URLs via env vars
packages/backend-auth/app-config.yaml    # específico: porta 7008, CORS
```

O Backstage faz merge profundo dos três arquivos em tempo de execução. O arquivo mais específico tem prioridade sobre o mais genérico. Dessa forma, todos os backends compartilham a mesma configuração base e só declaram o que é diferente (porta e CORS).

### `CMD` vs `ENTRYPOINT`

`CMD` pode ser sobrescrito ao rodar o container (`docker run ... node packages/backend-auth --config outro.yaml`). `ENTRYPOINT` não pode. Usamos `CMD` para facilitar debugging e testes locais sem precisar criar uma imagem nova.

---

## Por que `backend-proxy` copia o `packages/app/dist`?

```dockerfile
COPY --chown=node:node --from=builder /app/packages/app/dist ./packages/app/dist
```

O `plugin-app-backend` do Backstage serve o React SPA como arquivos estáticos. O proxy não é um servidor de arquivos separado — ele é o mesmo processo Node.js que responde às requisições de API e também entrega o `index.html` e os assets do frontend. Por isso a imagem do proxy precisa conter o build do frontend.

---

## `docker-compose.yml` — orquestração local

O compose file reproduz localmente o mesmo grafo de dependências do `start:all` do `package.json`.

### Rede interna

O Docker Compose cria uma rede virtual privada entre os serviços. Dentro dessa rede, cada serviço é acessível pelo seu nome (`backstage-auth`, `backstage-core`, etc.) como se fossem hostnames DNS. Por isso as variáveis de ambiente de discovery usam nomes de serviço:

```yaml
BACKSTAGE_AUTH_URL: http://backstage-auth:7008
BACKSTAGE_CORE_URL: http://backstage-core:7009
```

Esses valores substituem os `${BACKSTAGE_*_URL}` definidos no `app-config.production.yaml`, fazendo com que o mecanismo de discovery do Backstage roteie chamadas entre containers corretamente.

### Ordem de inicialização

```
postgres ──healthcheck──► backstage-auth
                                │
                         ┌──────┴──────┐
                         ▼             ▼
                  backstage-core  backstage-content
                  backstage-aux
                         │
                         ▼
                  backstage-proxy
```

- `postgres` usa `healthcheck` com `pg_isready` — garante que o banco está aceitando conexões antes de qualquer backend tentar conectar.
- `backstage-auth` sobe primeiro entre os backends porque os demais dependem de sua validação de tokens.
- `backstage-proxy` sobe por último, quando todos os feature-backends já estão disponíveis para receber requisições roteadas.

### `service_healthy` vs `service_started`

- `condition: service_healthy`: espera o healthcheck passar (banco pronto).
- `condition: service_started`: espera o container ter iniciado (processo rodando, mas não necessariamente pronto). Usado nos backends porque eles não têm healthcheck configurado — o Backstage demora alguns segundos para inicializar, mas o proxy tem retry interno.

### PostgreSQL compartilhado

Todos os backends apontam para o mesmo PostgreSQL, mas o Backstage cria **schemas isolados por plugin** (`backstage_plugin_auth`, `backstage_plugin_catalog`, etc.). Não há conflito entre os backends compartilhando o mesmo servidor de banco.

---

## `.dockerignore` — o que é excluído do contexto

Quando você executa `docker build .`, o Docker envia todo o conteúdo do diretório para o daemon (o "build context"). O `.dockerignore` evita que arquivos desnecessários sejam enviados, acelerando o build e evitando que secrets locais entrem na imagem.

| Padrão excluído | Motivo |
|---|---|
| `.git` | Controle de versão não é necessário na imagem |
| `.yarn/cache` | Cache local do Yarn, pode ter centenas de MB |
| `node_modules` | Reinstalados dentro do container |
| `packages/*/dist` | Recompilados dentro do container |
| `dist-types` | Regenerado pelo `yarn tsc` |
| `*.local.yaml` | Arquivos de configuração com secrets locais |
| `.env`, `.env.*` | Variáveis de ambiente locais com credenciais |

---

## Fluxo completo de um build

```
docker compose build
        │
        ├─► [base]         apt-get install (compiladores, sqlite)
        │         │
        │    ┌────┴─────────────┐
        │    ▼                  ▼
        ├─► [deps-dev]     [prod-deps]
        │   yarn install   yarn install
        │   (tudo)         (prod only)
        │    │                  │
        │    ▼                  │
        ├─► [builder]           │
        │   yarn tsc            │
        │   build:backends      │
        │   app build           │
        │    │                  │
        │    └──────┬───────────┘
        │           ▼
        └─► [backend-auth]    ← copia de prod-deps + builder
            [backend-core]    ← copia de prod-deps + builder
            [backend-content] ← copia de prod-deps + builder
            [backend-aux]     ← copia de prod-deps + builder
            [backend-proxy]   ← copia de prod-deps + builder + app/dist
```

O Docker executa estágios independentes em **paralelo** quando possível. `deps-dev` e `prod-deps` rodam ao mesmo tempo (ambos dependem de `base`, mas não um do outro). Os cinco estágios de runtime também são construídos em paralelo após `builder` e `prod-deps` terminarem.

---

## Comandos de referência

```bash
# Construir todas as imagens
docker compose build

# Construir imagem específica
docker build --target backend-auth -t backstage/auth .

# Subir tudo
docker compose up

# Subir só o banco + auth para desenvolvimento
docker compose up postgres backstage-auth

# Rebuild forçado (ignorar cache)
docker compose build --no-cache

# Rede corporativa com certificado auto-assinado
docker compose build --build-arg YARN_ENABLE_STRICT_SSL=false

# Ver logs de um serviço
docker compose logs -f backstage-core

# Parar e remover containers + volume do banco
docker compose down -v
```
