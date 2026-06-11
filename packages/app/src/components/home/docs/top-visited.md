# Mais Visitados (`TopVisitedChart`)

**Arquivo:** `packages/app/src/components/home/TopVisitedChart.tsx`  
**Exibido em:** seção "Atividade Recente" quando o widget `top-visited` está ativo

---

## O que faz

Exibe um ranking das páginas mais visitadas pelo usuário autenticado:
- Listagem em ordem decrescente de hits (máximo 6 itens)
- Barra de progresso proporcional para cada item (visualização de frequência relativa)
- Gradiente de azul escuro → azul claro conforme posição no ranking
- Tradução de nomes de páginas do inglês para PT-BR
- Truncamento de nomes longos (> 22 caracteres)
- Footer com total de visualizações e número de páginas distintas
- Clicar em qualquer linha navega para a URL da página

---

## Dependências

| Pacote | Uso |
|---|---|
| `@backstage/plugin-home` | `visitsApiRef`, `Visit` — API de rastreamento de visitas |
| `@backstage/core-plugin-api` | `useApi` |
| `@backstage/core-components` | `InfoCard`, `Progress`, `EmptyState` |
| `@material-ui/core` | `Box`, `Typography`, `Tooltip`, `makeStyles`, `useTheme` |
| `@material-ui/icons/TrendingUp` | Ícone no footer |

---

## Pré-requisito: habilitar rastreamento de visitas

Em `app-config.yaml`:

```yaml
app:
  extensions:
    - api:home/visits: true
    - app-root-element:home/visit-listener: true
```

Sem estas linhas, `visitsApiRef` não resolve e o componente não exibe dados.

---

## Tradução de nomes (`VISIT_NAME_MAP`)

```ts
const VISIT_NAME_MAP: Record<string, string> = {
  'catalog':            'Catálogo',
  'search':             'Buscar',
  'settings':           'Configurações',
  'catalog-graph':      'Grafo do Catálogo',
  'scaffolder':         'Criar Serviço',
  'home':               'Início',
  'kubernetes':         'Kubernetes',
  'techdocs':           'Documentação',
  'notifications':      'Notificações',
  'bradesco seguros developer portal': 'Portal do Desenvolvedor',
};

function translateVisitName(name: string): string {
  const key = name.toLowerCase().trim();
  return VISIT_NAME_MAP[key] ?? name;  // retorna o original se não encontrar
}
```

O mapa usa chaves em minúsculo — `name.toLowerCase().trim()` normaliza antes da busca.  
Nomes de entidades do catálogo (ex.: `"my-service"`) não estão no mapa e são exibidos como-estão.

---

## Truncamento de nomes longos

```ts
function shortName(name: string): string {
  return name.length > 22 ? `${name.slice(0, 20)}…` : name;
}
```

Usado na renderização: `shortName(translateVisitName(visit.name))`.

---

## Busca de dados

```ts
const visitsApi = useApi(visitsApiRef);
const [visits, setVisits] = useState<Visit[]>([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  visitsApi
    .list({ orderBy: [{ field: 'hits', direction: 'desc' }], limit: 6 })
    .then(data => { setVisits(data); setLoading(false); })
    .catch(() => setLoading(false));
}, [visitsApi]);
```

`Visit` tem os campos: `id`, `pathname`, `name`, `hits`, `timestamp`.

---

## Cores das barras

```ts
const BAR_COLORS = [
  '#1565c0',  // 1º lugar — azul mais escuro
  '#1976d2',
  '#1e88e5',
  '#42a5f5',
  '#90caf9',
  '#bbdefb',  // 6º lugar — azul mais claro
];
```

Fallback para `theme.palette.primary.light` em caso de mais de 6 itens.

---

## Cálculo das barras

```ts
const maxHits = Math.max(...visits.map(v => v.hits), 1);  // mínimo 1 para evitar divisão por zero
// Para cada visita:
const pct = Math.max((visit.hits / maxHits) * 100, 4);   // mínimo 4% para visibilidade
```

O item com mais hits ocupa 100% da barra; os demais são proporcionais.

---

## JSX

```tsx
<InfoCard noPadding variant="fullHeight" cardClassName={classes.cardContent}
          title="Mais Visitados" subheader="Suas páginas mais acessadas">
  {loading ? <Progress /> : visits.length === 0 ? (
    <EmptyState missing="data" title="Nenhuma visita ainda"
      description="Comece a navegar para acompanhar suas páginas mais visitadas." />
  ) : (
    <Box className={classes.container}>
      {visits.map((visit, i) => {
        const pct   = Math.max((visit.hits / maxHits) * 100, 4);
        const color = BAR_COLORS[i] ?? theme.palette.primary.light;
        return (
          <Tooltip key={visit.id}
            title={`${visit.pathname} — ${visit.hits} visita${visit.hits !== 1 ? 's' : ''}`}
            placement="top">
            <a className={classes.row} href={visit.pathname}>
              <Typography className={classes.rank}>#{i + 1}</Typography>
              <Typography className={classes.label}>
                {shortName(translateVisitName(visit.name))}
              </Typography>
              <Box className={classes.barTrack}>
                <Box className={classes.barFill}
                     style={{ width: `${pct}%`, backgroundColor: color }} />
              </Box>
              <Typography className={classes.count}>{visit.hits}</Typography>
            </a>
          </Tooltip>
        );
      })}
      <Box className={classes.footer}>
        <TrendingUpIcon style={{ fontSize: 14 }} />
        <Typography variant="caption">
          {totalHits} visualizações em {visits.length} página{visits.length !== 1 ? 's' : ''}
        </Typography>
      </Box>
    </Box>
  )}
</InfoCard>
```

---

## Estilos e scroll

O `InfoCard` usa `noPadding variant="fullHeight"` para criar uma cadeia de flex que permite scroll interno:

```ts
cardContent: {
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
},
container: {
  flex: '1 1 0%',
  minHeight: 0,         // CRÍTICO: sem isso, flex não ativa scroll
  padding: theme.spacing(2, 2.5),
  overflowY: 'auto',
},
```

> **Por que `minHeight: 0`?** Por padrão, flex items têm `min-height: auto`, que impede a compressão abaixo do tamanho natural. `minHeight: 0` permite que o container seja comprimido e ative `overflowY: auto`.

> **Por que `variant="fullHeight"`?** Esta prop do `InfoCard` aplica via inline style `height: 100%` no Card e `flex: 1 1 0%` no CardContent — garantindo que o card preencha o container pai sem inline styles adicionais.

```ts
row: {
  display: 'flex', alignItems: 'center', gap: theme.spacing(1.5),
  marginBottom: theme.spacing(1.5),
  textDecoration: 'none', color: 'inherit',
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(0.5),
  transition: 'background-color 0.15s',
  '&:hover': { backgroundColor: theme.palette.action.hover,
    '& $barFill': { filter: 'brightness(1.1)' } },
},
rank:     { width: 20, fontWeight: 700, fontSize: '0.7rem', color: theme.palette.text.disabled, textAlign: 'center' },
label:    { width: 130, minWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.8rem', fontWeight: 500 },
barTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: theme.palette.action.selected, overflow: 'hidden' },
barFill:  { height: '100%', borderRadius: 5, transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)' },
count:    { width: 36, minWidth: 36, textAlign: 'right', fontSize: '0.75rem', fontWeight: 700, color: theme.palette.text.secondary },
footer:   { marginTop: theme.spacing(1), paddingTop: theme.spacing(1), borderTop: `1px solid ${theme.palette.divider}`,
            display: 'flex', alignItems: 'center', gap: theme.spacing(0.5), color: theme.palette.text.disabled },
```

---

## Como registrar na home page

Em `HomePage.tsx`:

```tsx
import { TopVisitedChart } from './TopVisitedChart';

{on('top-visited') && (
  <Grid item xs={12} md={activityActive === 1 ? 12 : 6} style={{ display: 'flex' }}>
    <Box className={classes.cardWrap} style={{ height: 460 }}>
      <TopVisitedChart />
    </Box>
  </Grid>
)}
```

`height: 460` (fixo) combinado com `variant="fullHeight"` dentro do componente garante que o card scrolle internamente sem expandir o layout.

O widget `top-visited` deve estar em `WIDGET_REGISTRY`:

```ts
{ id: 'top-visited', title: 'Mais Visitados', description: 'Páginas mais acessadas por você',
  icon: <TrendingUpIcon />, iconColor: '#2e7d32', bgColor: '#e8f5e9' }
```
