# Plano de Implementação — Plugin Home Page

> Backstage POC · Planejado em: 2026-06-10

---

## Objetivo

Adicionar uma página inicial personalizada ao Backstage usando o plugin `@backstage/plugin-home`, substituindo o redirecionamento padrão para o catálogo por um dashboard com widgets úteis para o time.

---

## Pacote

```
@backstage/plugin-home
```

Sem dependência de backend. Todo o estado é armazenado no navegador ou via `storageApi`.

---

## Etapas de Implementação

### 1. Instalar o pacote

```bash
cd packages/app
yarn add @backstage/plugin-home
```

---

### 2. Criar o componente `HomePage`

**Arquivo:** `packages/app/src/components/home/HomePage.tsx`

Criar um Grid responsivo com os cards desejados. Exemplo inicial:

```tsx
import React from 'react';
import Grid from '@material-ui/core/Grid';
import {
  HomePageStarredEntities,
  HomePageRecentlyVisited,
  HomePageTopVisited,
  HomePageRandomJoke,
} from '@backstage/plugin-home';

export const HomePage = () => (
  <Grid container spacing={3}>
    <Grid item xs={12} md={6}>
      <HomePageStarredEntities />
    </Grid>
    <Grid item xs={12} md={6}>
      <HomePageRecentlyVisited />
    </Grid>
    <Grid item xs={12} md={6}>
      <HomePageTopVisited />
    </Grid>
    <Grid item xs={12} md={6}>
      <HomePageRandomJoke />
    </Grid>
  </Grid>
);
```

---

### 3. Registrar a API de Visitas

**Arquivo:** `packages/app/src/apis.ts`

Adicionar uma das duas opções de persistência:

**Opção A — vinculada ao usuário autenticado (recomendada):**
```ts
import { VisitsStorageApi, visitsApiRef } from '@backstage/plugin-home';
import { storageApiRef } from '@backstage/core-plugin-api';

createApiFactory({
  api: visitsApiRef,
  deps: { storageApi: storageApiRef },
  factory: ({ storageApi }) => VisitsStorageApi.create({ storageApi }),
}),
```

**Opção B — localStorage do navegador:**
```ts
import { VisitsWebStorageApi, visitsApiRef } from '@backstage/plugin-home';

createApiFactory({
  api: visitsApiRef,
  deps: {},
  factory: () => VisitsWebStorageApi.create(),
}),
```

---

### 4. Configurar a rota raiz em `App.tsx`

**Arquivo:** `packages/app/src/App.tsx`

```tsx
import { HomepageCompositionRoot, VisitListener } from '@backstage/plugin-home';
import { HomePage } from './components/home/HomePage';

// Dentro de <AppRouter>, adicionar o VisitListener:
<VisitListener />

// Substituir a rota raiz:
<Route path="/" element={<HomepageCompositionRoot />}>
  <HomePage />
</Route>
```

---

### 5. (Opcional) Grid personalizável pelo usuário

Substituir o Grid estático pelo `CustomHomepageGrid`, que permite ao usuário adicionar, mover e remover widgets:

```tsx
import { CustomHomepageGrid } from '@backstage/plugin-home';

export const HomePage = () => (
  <CustomHomepageGrid
    config={[
      {
        component: HomePageStarredEntities,
        x: 0, y: 0, width: 6, height: 4,
      },
      {
        component: HomePageRecentlyVisited,
        x: 6, y: 0, width: 6, height: 4,
      },
    ]}
  />
);
```

---

### 6. (Opcional) Filtros de visitas

**Arquivo:** `app-config.yaml`

```yaml
home:
  recentVisits:
    filterBy:
      - field: name
        operator: contains
        value: service
```

---

## Componentes disponíveis

| Componente | Descrição |
|---|---|
| `HomePageStarredEntities` | Entidades marcadas como favoritas |
| `HomePageRecentlyVisited` | Páginas visitadas recentemente |
| `HomePageTopVisited` | Páginas mais visitadas |
| `HomePageRandomJoke` | Piada aleatória (útil para demo/onboarding) |
| `QuickStartCard` | Card personalizável para onboarding |

---

## Ordem de execução

1. [ ] Instalar `@backstage/plugin-home`
2. [ ] Criar `packages/app/src/components/home/HomePage.tsx`
3. [ ] Registrar API de visitas em `apis.ts`
4. [ ] Configurar rota raiz e `VisitListener` em `App.tsx`
5. [ ] Validar localmente com `yarn dev`
6. [ ] (Opcional) Migrar para `CustomHomepageGrid`
7. [ ] (Opcional) Adicionar filtros em `app-config.yaml`

---

## Referências

- [Roadie — Backstage Home Page Plugin](https://roadie.io/backstage/plugins/home-page/)
- [Backstage Docs — @backstage/plugin-home](https://backstage.io/docs/plugins/home-page)
