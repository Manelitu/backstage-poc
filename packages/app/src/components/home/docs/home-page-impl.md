# Home Page — Implementação Completa

> Documento central de referência. Cada seção abaixo referencia um `.md` detalhado com a implementação completa de cada funcionalidade. Se você precisar recriar esta home page do zero em um projeto Backstage novo, siga esta ordem.

---

## Pré-requisitos — Plugins necessários

Todos os plugins abaixo devem estar instalados e configurados antes de implementar qualquer componente da home page.

```bash
yarn --cwd packages/app add \
  @backstage/plugin-home \
  @backstage/plugin-search-react \
  @backstage/plugin-catalog-react
```

Habilitar rastreamento de visitas no `app-config.yaml`:

```yaml
app:
  extensions:
    - api:home/visits: true
    - app-root-element:home/visit-listener: true
    - page:home:
        config:
          path: /
```

---

## Estrutura de arquivos

```
packages/app/src/components/home/
├── HomePage.tsx                  ← componente principal (saudação, busca, ações rápidas, meu espaço, atividade)
├── StarredEntitiesWidget.tsx     ← widget customizado "Suas Entidades Favoritas"
├── TopVisitedChart.tsx           ← widget "Mais Visitados"
├── RecentlyVisitedTimeline.tsx   ← widget "Visitados Recentemente"
├── CatalogStatsWidget.tsx        ← widget "Visão do Catálogo"
└── docs/
    ├── home-page-impl.md         ← este arquivo
    ├── hero-greeting.md
    ├── search-bar.md
    ├── widget-system.md
    ├── quick-actions.md
    ├── my-space.md
    ├── starred-entities.md
    ├── catalog-stats.md
    ├── top-visited.md
    └── recently-visited.md
```

---

## Funcionalidades implementadas

| Funcionalidade | Arquivo de detalhe | Componente / arquivo fonte |
|---|---|---|
| Saudação (hero card) | [hero-greeting.md](./hero-greeting.md) | `HomePage.tsx` — seção `<Box className={classes.hero}>` |
| Barra de busca | [search-bar.md](./search-bar.md) | `HomePage.tsx` — `<SearchBarBase>` |
| Sistema de widgets | [widget-system.md](./widget-system.md) | `HomePage.tsx` — `WidgetDialog`, `CustomizeBar` |
| Ações Rápidas | [quick-actions.md](./quick-actions.md) | `HomePage.tsx` — `ActionIcon`, `GroupFolder`, dialogs |
| Meu Espaço | [my-space.md](./my-space.md) | `HomePage.tsx` — seção `hasWorkspace` |
| Entidades Favoritas | [starred-entities.md](./starred-entities.md) | `StarredEntitiesWidget.tsx` |
| Visão do Catálogo | [catalog-stats.md](./catalog-stats.md) | `CatalogStatsWidget.tsx` |
| Mais Visitados | [top-visited.md](./top-visited.md) | `TopVisitedChart.tsx` |
| Visitados Recentemente | [recently-visited.md](./recently-visited.md) | `RecentlyVisitedTimeline.tsx` |

---

## Registro da home page no app

Em `packages/app/src/App.tsx` (ou equivalente), a página é registrada via `PageBlueprint`:

```tsx
import { HomePage } from './components/home/HomePage';
// O PageBlueprint do plugin-home registra a rota /
```

Em `app-config.yaml`:

```yaml
app:
  extensions:
    - page:home:
        config:
          path: /
```

---

## Decisões de design transversais

### Sombras (`boxShadow`)

Todas as superfícies elevadas usam sombra padronizada via `theme.shadows`:

| Elemento | Sombra |
|---|---|
| Hero card (saudação) | `theme.shadows[2]` — levemente mais pronunciado por ser o elemento principal |
| Barra de busca em repouso | `theme.shadows[1]` |
| Barra de busca com foco | `theme.shadows[3]` + `borderColor` primário |
| Todos os InfoCards (via `cardWrap`) | `theme.shadows[1]` |
| Barra de status (customizeBar) | **sem sombra** — flutuante, sem card |

A padronização acontece no `cardWrap` com o seletor `'& .MuiCard-root, & .MuiPaper-root': { boxShadow: theme.shadows[1] }`, que aplica a todos os widgets filhos sem precisar editar cada componente individualmente.

### Barra de status (customizeBar)

Não tem card/fundo. Os pills coloridos (widgets / ações / grupos) são os únicos elementos visuais. O ícone `WidgetsIcon` à direita abre o dialog de personalização de widgets.

---

## Ordem de implementação recomendada

1. Instalar plugins (seção acima)
2. Criar `StarredEntitiesWidget.tsx`
3. Criar `CatalogStatsWidget.tsx`
4. Criar `TopVisitedChart.tsx`
5. Criar `RecentlyVisitedTimeline.tsx`
6. Criar `HomePage.tsx` com todas as seções
7. Registrar a rota no `app-config.yaml`
