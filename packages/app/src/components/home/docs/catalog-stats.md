# Visão do Catálogo (`CatalogStatsWidget`)

**Arquivo:** `packages/app/src/components/home/CatalogStatsWidget.tsx`  
**Exibido em:** seção "Meu Espaço" da home page quando o widget `catalog-stats` está ativo

---

## O que faz

Exibe um grid de tiles coloridos com a contagem de entidades do catálogo por tipo:
- Componentes, APIs, Sistemas, Domínios, Templates, Grupos
- Cada tile tem fundo colorido, número grande em destaque, rótulo abaixo
- Clicar em um tile navega para o catálogo filtrado pelo tipo correspondente (`/catalog?filters[kind]=component`, etc.)

---

## Dependências

| Pacote | Uso |
|---|---|
| `@backstage/plugin-catalog-react` | `catalogApiRef` — para buscar entidades |
| `@backstage/core-plugin-api` | `useApi` — injeção de dependência da API |
| `@backstage/core-components` | `InfoCard`, `Progress` |
| `@material-ui/core` | `Box`, `Grid`, `Typography`, `makeStyles` |

---

## Configuração dos tipos

```ts
const KINDS = [
  { kind: 'Component', label: 'Componentes', color: '#1565c0', bg: '#e3f2fd' },
  { kind: 'API',       label: 'APIs',        color: '#6a1b9a', bg: '#f3e5f5' },
  { kind: 'System',    label: 'Sistemas',    color: '#2e7d32', bg: '#e8f5e9' },
  { kind: 'Domain',    label: 'Domínios',    color: '#e65100', bg: '#fff3e0' },
  { kind: 'Template',  label: 'Templates',   color: '#00695c', bg: '#e0f2f1' },
  { kind: 'Group',     label: 'Grupos',      color: '#558b2f', bg: '#f1f8e9' },
];
```

Para adicionar um novo tipo, basta inserir um novo objeto neste array.

---

## Lógica de busca

```ts
const catalogApi = useApi(catalogApiRef);
const [counts, setCounts] = useState<Record<string, number>>({});
const [loading, setLoading] = useState(true);

useEffect(() => {
  catalogApi
    .getEntities({ fields: ['kind'] })  // busca apenas o campo 'kind' (otimização)
    .then(({ items }) => {
      const c: Record<string, number> = {};
      items.forEach(e => { c[e.kind] = (c[e.kind] ?? 0) + 1; });
      setCounts(c);
      setLoading(false);
    })
    .catch(() => setLoading(false));
}, [catalogApi]);
```

> **`fields: ['kind']`**: reduz drasticamente o payload da resposta — sem este campo, o catálogo retornaria todos os metadados de cada entidade (spec, metadata, relations, etc.).

`counts` é um mapa `{ 'Component': 12, 'API': 5, ... }`. Para tipos sem entidades, `counts[kind] ?? 0` retorna `0`.

---

## JSX

```tsx
<InfoCard title="Visão do Catálogo" subheader="Entidades por tipo">
  {loading ? (
    <Progress />
  ) : (
    <Box className={classes.inner}>
      <Grid container spacing={2}>
        {KINDS.map(({ kind, label, color, bg }) => (
          <Grid item xs={4} key={kind}>
            <a
              className={classes.tile}
              href={`/catalog?filters%5Bkind%5D=${kind.toLowerCase()}`}
              style={{ backgroundColor: bg }}
            >
              <Typography className={classes.count} style={{ color }}>
                {counts[kind] ?? 0}
              </Typography>
              <Typography className={classes.label} style={{ color }}>
                {label}
              </Typography>
            </a>
          </Grid>
        ))}
      </Grid>
    </Box>
  )}
</InfoCard>
```

> **`%5Bkind%5D`**: `[` e `]` codificados em URL — equivale a `?filters[kind]=component`, que é o formato de query esperado pelo plugin de catálogo do Backstage.

---

## Estilos

```ts
inner: {
  padding: theme.spacing(2),
},
tile: {
  borderRadius: theme.shape.borderRadius * 2,
  padding: theme.spacing(1.5, 1),
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: theme.spacing(0.25),
  textDecoration: 'none',
  transition: 'opacity 0.15s',
  '&:hover': { opacity: 0.8 },
},
count: {
  fontWeight: 700,
  fontSize: '1.6rem',
  lineHeight: 1,
},
label: {
  fontSize: '0.68rem',
  fontWeight: 600,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
},
```

Grid usa `xs={4}` → 3 tiles por linha (3 × 4 = 12 colunas MUI). Com 6 tipos: 2 linhas de 3.

---

## Estados de carregamento

- `loading = true`: exibe `<Progress />` (spinner do Backstage)
- `loading = false, counts = {}`: exibe tiles com `0` em cada tipo
- `catalogApi.getEntities` falha: `setLoading(false)` silenciosamente, tiles mostram `0`

---

## Como registrar o widget na home page

Em `HomePage.tsx`, o widget é importado e condicionalmente renderizado:

```tsx
import { CatalogStatsWidget } from './CatalogStatsWidget';

// No JSX:
{on('catalog-stats') && (
  <Grid item xs={12} md={on('random-joke') ? 6 : 12} style={{ display: 'flex' }}>
    <Box className={classes.cardWrap} style={{ minHeight: 260 }}>
      <CatalogStatsWidget />
    </Box>
  </Grid>
)}
```

O widget `catalog-stats` deve estar registrado em `WIDGET_REGISTRY` em `HomePage.tsx`:

```ts
{ id: 'catalog-stats', title: 'Visão do Catálogo', description: 'Contagem de entidades por tipo',
  icon: <AppsIcon />, iconColor: '#0277bd', bgColor: '#e1f5fe' }
```
