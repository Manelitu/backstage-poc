# Entidades Favoritas (`StarredEntitiesWidget`)

**Arquivo:** `packages/app/src/components/home/StarredEntitiesWidget.tsx`  
**Exibido em:** seção "Meu Espaço" quando o widget `starred-entities` está ativo

---

## Por que componente customizado?

O `HomePageStarredEntities` do `@backstage/plugin-home` oferece apenas a lista básica sem customização visual. O `StarredEntitiesWidget` substitui esse componente com:

- Accent bar colorida à esquerda de cada item (cor por `kind`)
- Chips de `kind` (PT-BR) e `type` da entidade
- Descrição truncada com tooltip nativo do browser
- Namespace exibido quando diferente de `default`
- Botão de desfavoritar (⭐) que aparece só no hover (opacity 0→1)
- Scroll interno sem expandir o card
- Estado de loading (`Progress`) e estado vazio (`EmptyState`)

---

## Dependências

| Pacote | Uso |
|---|---|
| `@backstage/plugin-catalog-react` | `catalogApiRef`, `useStarredEntities` |
| `@backstage/catalog-model` | `Entity` — tipagem das entidades |
| `@backstage/core-plugin-api` | `useApi` |
| `@backstage/core-components` | `InfoCard`, `Progress`, `EmptyState` |
| `@material-ui/core` | `Box`, `Chip`, `IconButton`, `Tooltip`, `Typography`, `makeStyles` |
| `@material-ui/icons/Star` | Ícone do botão de desfavoritar |

---

## Hook `useStarredEntities`

```ts
import { useStarredEntities } from '@backstage/plugin-catalog-react';

const { starredEntities, toggleStarredEntity } = useStarredEntities();
// starredEntities: Set<string>  — conjunto de refs (ex.: "component:default/my-service")
// toggleStarredEntity(ref): void — adiciona ou remove dos favoritos
```

`starredEntities` é um `Set<string>` onde cada entrada é uma ref no formato `kind:namespace/name`.

---

## Busca das entidades

```ts
useEffect(() => {
  if (starredEntities.size === 0) {
    setEntities([]);
    setLoading(false);
    return;
  }
  setLoading(true);
  Promise.all(
    [...starredEntities].map(ref =>
      catalogApi.getEntityByRef(ref).catch(() => undefined),
    ),
  )
    .then(results => {
      setEntities(results.filter((e): e is Entity => !!e));
      setLoading(false);
    })
    .catch(() => setLoading(false));
}, [starredEntities, catalogApi]);
```

- `catalogApi.getEntityByRef(ref)` aceita a string de ref diretamente
- O `.catch(() => undefined)` por chamada garante que uma entidade removida do catálogo não quebra o Promise.all inteiro
- O filtro `(e): e is Entity => !!e` elimina os `undefined` com type guard

---

## Cores por `kind` (`KIND_META`)

```ts
const KIND_META: Record<string, { color: string; bg: string; label: string }> = {
  component: { color: '#1565c0', bg: '#e3f2fd', label: 'Componente' },
  api:       { color: '#6a1b9a', bg: '#f3e5f5', label: 'API'        },
  system:    { color: '#2e7d32', bg: '#e8f5e9', label: 'Sistema'    },
  domain:    { color: '#e65100', bg: '#fff3e0', label: 'Domínio'    },
  template:  { color: '#00695c', bg: '#e0f2f1', label: 'Template'   },
  group:     { color: '#558b2f', bg: '#f1f8e9', label: 'Grupo'      },
  user:      { color: '#4527a0', bg: '#ede7f6', label: 'Usuário'    },
};
const DEFAULT_KIND = { color: '#546e7a', bg: '#eceff1', label: 'Entidade' };

function kindMeta(kind: string) {
  return KIND_META[kind.toLowerCase()] ?? DEFAULT_KIND;
}
```

A lookup usa `kind.toLowerCase()` para ser case-insensitive (o catálogo do Backstage pode retornar `Component` ou `component`).

---

## Helpers de URL e ref

```ts
function entityUrl(entity: Entity): string {
  const ns = entity.metadata.namespace ?? 'default';
  return `/catalog/${ns}/${entity.kind.toLowerCase()}/${entity.metadata.name}`;
}

function toRef(entity: Entity): string {
  const ns = entity.metadata.namespace ?? 'default';
  return `${entity.kind.toLowerCase()}:${ns}/${entity.metadata.name}`;
}
```

`toRef` reconstrói a ref para passar ao `toggleStarredEntity` ao desfavoritar.

---

## JSX

```tsx
<InfoCard
  noPadding
  variant="fullHeight"
  cardClassName={classes.cardContent}
  title="Suas Entidades Favoritas"
  subheader={
    loading
      ? 'Carregando...'
      : `${count} ${count === 1 ? 'entidade favoritada' : 'entidades favoritadas'}`
  }
>
  {loading ? (
    <Progress />
  ) : entities.length === 0 ? (
    <EmptyState
      missing="data"
      title="Nenhum favorito ainda"
      description="Favorite entidades no catálogo clicando na estrela ao lado do nome da entidade."
    />
  ) : (
    <Box className={classes.list}>
      {entities.map(entity => {
        const km   = kindMeta(entity.kind);
        const url  = entityUrl(entity);
        const name = entity.metadata.title ?? entity.metadata.name;
        const desc = entity.metadata.description;
        const ns   = (entity.metadata.namespace && entity.metadata.namespace !== 'default')
          ? entity.metadata.namespace
          : undefined;
        const type = (entity.spec as any)?.type as string | undefined;
        return (
          <a key={toRef(entity)} className={classes.item} href={url}>
            <Box className={classes.accent} style={{ backgroundColor: km.color }} />
            <Box className={classes.info}>
              <Box className={classes.nameRow}>
                <Typography className={classes.name} title={name}>{name}</Typography>
                <Chip label={km.label} size="small" className={classes.chip}
                      style={{ color: km.color, backgroundColor: km.bg }} />
                {type && (
                  <Chip label={type} size="small" className={classes.chip}
                        style={{ color: '#546e7a', backgroundColor: '#eceff1' }} />
                )}
              </Box>
              {desc && (
                <Typography className={classes.desc} title={desc}>{desc}</Typography>
              )}
              {ns && (
                <Typography className={classes.namespace}>{ns}</Typography>
              )}
            </Box>
            <Tooltip title="Remover dos favoritos" arrow>
              <IconButton
                size="small"
                className={classes.unstarBtn}
                onClick={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleStarredEntity(toRef(entity));
                }}
                aria-label="remover dos favoritos"
              >
                <StarIcon style={{ fontSize: 16, color: '#f57f17' }} />
              </IconButton>
            </Tooltip>
          </a>
        );
      })}
    </Box>
  )}
</InfoCard>
```

> **`e.preventDefault()` + `e.stopPropagation()` no botão de desfavoritar**: o item é um `<a>`, então o click no botão navegaria para a entidade sem isso.

---

## Estilos (makeStyles)

```ts
cardContent: {
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
},
list: {
  flex: '1 1 0%',
  minHeight: 0,           // CRÍTICO para ativar scroll interno
  padding: theme.spacing(1, 2, 2),
  overflowY: 'auto',
},
item: {
  display: 'flex', alignItems: 'center', gap: theme.spacing(1.5),
  padding: theme.spacing(1.25, 0.75, 1.25, 0),
  borderBottom: `1px solid ${theme.palette.divider}`,
  textDecoration: 'none', color: 'inherit',
  borderRadius: theme.shape.borderRadius * 1.5,
  transition: 'background-color 0.15s',
  '&:last-child': { borderBottom: 'none' },
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
    '& $unstarBtn': { opacity: 1 },  // botão aparece ao hover no item
  },
},
accent: {
  width: 4, minWidth: 4,
  alignSelf: 'stretch', minHeight: 42,
  borderRadius: 4, flexShrink: 0,
  marginLeft: theme.spacing(0.5),
},
info:    { flex: 1, minWidth: 0 },
nameRow: { display: 'flex', alignItems: 'center', gap: theme.spacing(0.75), marginBottom: 2 },
name: {
  fontWeight: 700, fontSize: '0.875rem',
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  flex: '0 1 auto', minWidth: 0,
},
chip:      { height: 18, fontSize: '0.62rem', fontWeight: 700, flexShrink: 0 },
desc:      { fontSize: '0.75rem', color: theme.palette.text.secondary,
             overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
namespace: { fontSize: '0.68rem', color: theme.palette.text.disabled, marginTop: 1 },
unstarBtn: { opacity: 0, transition: 'opacity 0.15s', padding: 4, flexShrink: 0 },
```

### Padrão de scroll (mesmo do `TopVisitedChart`)

`noPadding variant="fullHeight"` no `InfoCard` cria a cadeia flex:
1. Card (`MuiCard-root`) → `height: 100%`, `flex: 1 1 0%`
2. CardContent → `flex: 1 1 0%`
3. `cardContent` → `display: flex; flex-direction: column; overflow: hidden`
4. `list` → `flex: 1 1 0%; min-height: 0; overflow-y: auto`

`min-height: 0` no `list` é crítico: sem ele, o flex item nunca encurta abaixo do seu tamanho natural e o scroll não ativa.

---

## Como registrar na home page

Em `HomePage.tsx`:

```tsx
import { StarredEntitiesWidget } from './StarredEntitiesWidget';

{on('starred-entities') && (
  <Grid item xs={12} style={{ display: 'flex' }}>
    <Box className={classes.cardWrap} style={{ minHeight: 300 }}>
      <StarredEntitiesWidget />
    </Box>
  </Grid>
)}
```

O widget `starred-entities` deve estar em `WIDGET_REGISTRY`:

```ts
{ id: 'starred-entities', title: 'Favoritos', description: 'Suas entidades favoritadas no catálogo',
  icon: <StarIcon />, iconColor: '#f57f17', bgColor: '#fff8e1' }
```
