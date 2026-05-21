# packages/backend-common — Biblioteca Compartilhada

Biblioteca interna usada por todos os feature backends. Exporta o `multiBackendDiscovery` — o `ServiceFactory` que substitui o `DiscoveryService` padrão do Backstage para funcionar corretamente no modelo multi-backend.

---

## Por que isso existe

O `DiscoveryService` padrão do Backstage resolve qualquer `pluginId` para o `backend.baseUrl` do próprio processo. No monólito, isso funciona porque todos os plugins estão no mesmo endereço.

No multi-backend, o `backend-core` (7009) que precisa encontrar o `auth` (7008) receberia como resposta a sua própria URL (`localhost:7009`) — gerando 404. O `multiBackendDiscovery` resolve isso lendo o mapa de endpoints do config.

---

## API exportada

```typescript
export const multiBackendDiscovery: ServiceFactory
```

Registrado em todos os feature backends como:

```typescript
import { multiBackendDiscovery } from 'backend-common';

const backend = createBackend();
backend.add(multiBackendDiscovery);  // substitui o DiscoveryService padrão
```

---

## Como funciona

Lê `backend.discovery.endpoints` do `app-config.yaml` e mantém dois Maps:

| Método | Map usado | Uso |
|--------|-----------|-----|
| `getBaseUrl(pluginId)` | `internalUrls` | Chamadas backend-to-backend, assinatura de tokens |
| `getExternalBaseUrl(pluginId)` | `externalUrls` | URLs para o browser (links, redirects) |

Em dev local, `externalTarget` não é definido — ambos os Maps apontam para `localhost`. Em produção com K8s:

```yaml
backend:
  discovery:
    endpoints:
      - target: 'http://backstage-auth-svc:7008/api/{{pluginId}}'    # DNS interno K8s
        externalTarget: 'https://backstage.empresa.com/api/{{pluginId}}' # ingress público
        plugins: [auth]
```

---

## Nota sobre compilação

Este pacote declara `"main": "src/index.ts"` — aponta diretamente para TypeScript, sem bundle próprio. O Backstage CLI (esbuild) inline o código TypeScript deste pacote dentro de cada backend que o importa durante o `yarn build:backends`.

Não execute `yarn build` neste pacote separadamente — ele não tem script de build e não produz artefato próprio.

---

## Leitura relacionada

- [ARCHITECTURE.md § 4](../../ARCHITECTURE.md) — explicação completa do `multiBackendDiscovery`
- [MULTI_BACKEND.md § 8](../../MULTI_BACKEND.md) — DiscoveryService no contexto da arquitetura
