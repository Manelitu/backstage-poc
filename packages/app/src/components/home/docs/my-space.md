# Meu Espaço

**Arquivo:** `packages/app/src/components/home/HomePage.tsx`  
**Seção:** `{hasWorkspace && (...)}`

---

## O que faz

Agrupa widgets do tipo "espaço pessoal" em uma seção com layout responsivo:
- **Favoritos** (`StarredEntitiesWidget`): lista customizada de entidades favoritadas com accent bar colorida, chips de kind/type e botão de desfavoritar
- **Visão do Catálogo** (`CatalogStatsWidget`): contagem de entidades por tipo com links
- **Piada Aleatória** (`HomePageRandomJoke`): piada de programação aleatória

Cada widget é opcional e controlado pelo sistema de widgets. A seção inteira some se nenhum dos três estiver ativo.

> **`HomePageStarredEntities` foi substituído** pelo `StarredEntitiesWidget` customizado (arquivo `StarredEntitiesWidget.tsx`). O componente do `@backstage/plugin-home` foi descartado pois não permitia o nível de customização visual necessário. Ver detalhes em [starred-entities.md](./starred-entities.md).

---

## Dependências

| Pacote | Uso |
|---|---|
| `@backstage/plugin-home` | `HomePageRandomJoke` |
| `./StarredEntitiesWidget` | Widget customizado de entidades favoritas (substitui `HomePageStarredEntities`) |
| `./CatalogStatsWidget` | Widget customizado de estatísticas do catálogo |
| `@material-ui/core` | `Grid`, `Box` |

---

## Condicional de exibição

```ts
const on = (id: WidgetId) => enabledWidgets.includes(id);
const hasWorkspace = on('starred-entities') || on('random-joke') || on('catalog-stats');
```

Se `hasWorkspace === false`, a seção inteira (incluindo o `SectionHeader`) não é renderizada.

---

## JSX completo

```tsx
{hasWorkspace && (
  <>
    <SectionHeader title="Meu Espaço" />
    <Grid container spacing={3} alignItems="stretch">

      {/* Favoritos — ocupa linha inteira */}
      {on('starred-entities') && (
        <Grid item xs={12} style={{ display: 'flex' }}>
          <Box className={classes.cardWrap} style={{ minHeight: 300 }}>
            <StarredEntitiesWidget />
          </Box>
        </Grid>
      )}

      {/* Piada — 6 colunas se catalog-stats ativo, 12 se sozinho */}
      {on('random-joke') && (
        <Grid item xs={12} md={on('catalog-stats') ? 6 : 12} style={{ display: 'flex' }}>
          <Box className={classes.cardWrap} style={{ minHeight: 260 }}>
            <HomePageRandomJoke />
          </Box>
        </Grid>
      )}

      {/* Visão do Catálogo — 6 colunas se random-joke ativo, 12 se sozinho */}
      {on('catalog-stats') && (
        <Grid item xs={12} md={on('random-joke') ? 6 : 12} style={{ display: 'flex' }}>
          <Box className={classes.cardWrap} style={{ minHeight: 260 }}>
            <CatalogStatsWidget />
          </Box>
        </Grid>
      )}

    </Grid>
  </>
)}
```

---

## Layout responsivo

| Widgets ativos | Layout |
|---|---|
| Só `starred-entities` | 1 linha, largura total |
| Só `random-joke` | 1 linha, largura total |
| Só `catalog-stats` | 1 linha, largura total |
| `random-joke` + `catalog-stats` | 2 colunas 50/50 em md+ |
| Todos os 3 | Favoritos em linha, depois Piada + Catálogo em 50/50 |

---

## Wrapper `cardWrap`

Todos os widgets são envoltos em `<Box className={classes.cardWrap}>` para normalizar a altura:

```ts
cardWrap: {
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  '& .MuiCard-root, & .MuiPaper-root': {
    flex: '1 1 0%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: theme.shadows[1],  // sombra leve uniforme em todos os cards
  },
  '& .MuiCardContent-root': {
    flex: '1 1 0%',
    minHeight: 0,
    overflowY: 'auto',
  },
},
```

Este wrapper força o card a preencher a altura disponível no Grid (`alignItems="stretch"`), garantindo que cards lado a lado tenham a mesma altura.

---

## `StarredEntitiesWidget`

Componente **customizado** em `packages/app/src/components/home/StarredEntitiesWidget.tsx`. Substitui o `HomePageStarredEntities` do plugin-home por uma implementação própria com maior controle visual.

```tsx
import { StarredEntitiesWidget } from './StarredEntitiesWidget';
// Sem props — título e lógica são internos ao componente
<StarredEntitiesWidget />
```

Documentação completa em [starred-entities.md](./starred-entities.md).

---

## `HomePageRandomJoke`

Componente do `@backstage/plugin-home`. Busca uma piada aleatória de programação via API pública e exibe no card. Sem props customizadas.

---

## `CatalogStatsWidget`

Widget customizado. Documentado em detalhe em [catalog-stats.md](./catalog-stats.md).

---

## `SectionHeader`

Sub-componente reutilizado em todas as seções da home page:

```tsx
const SectionHeader = ({ title, action }: { title: string; action?: React.ReactNode }) => (
  <Box className={classes.sectionRow}>
    <Typography variant="overline" className={classes.sectionLabel}>
      {title}
    </Typography>
    <Divider className={classes.sectionDivider} />
    {action}
  </Box>
);
```

```ts
sectionRow: {
  display: 'flex', alignItems: 'center',
  gap: theme.spacing(1.5),
  marginBottom: theme.spacing(2),
  marginTop: theme.spacing(3),
},
sectionLabel: {
  fontWeight: 700, letterSpacing: '0.1em',
  color: theme.palette.text.secondary,
  whiteSpace: 'nowrap',
},
sectionDivider: { flex: 1 },
```

O `Divider` com `flex: 1` preenche automaticamente o espaço entre o título e qualquer action opcional (botão, ícone, etc.).

---

## Localização no arquivo

`HomePage.tsx` → função `HomePage` → bloco `{hasWorkspace && (...)}`, após a seção "Ações Rápidas".
