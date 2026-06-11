# Visitados Recentemente (`RecentlyVisitedTimeline`)

**Arquivo:** `packages/app/src/components/home/RecentlyVisitedTimeline.tsx`  
**Exibido em:** seção "Atividade Recente" quando o widget `recently-visited` está ativo

---

## O que faz

Exibe um histórico cronológico das páginas visitadas recentemente pelo usuário:
- Até 8 visitas mais recentes, ordenadas da mais recente para a mais antiga
- Indicador colorido de "tipo" (Component, API, Sistema, etc.) para páginas do catálogo
- Tempo relativo em PT-BR ("há 2m", "há 3h", "Ontem", "há 5d")
- Chip colorido com o tipo de entidade (inferido da URL)
- Tradução de nomes de páginas do inglês para PT-BR
- Scroll interno (não expande o card)

---

## Dependências

| Pacote | Uso |
|---|---|
| `@backstage/plugin-home` | `visitsApiRef`, `Visit` |
| `@backstage/core-plugin-api` | `useApi` |
| `@backstage/core-components` | `InfoCard`, `Progress`, `EmptyState` |
| `@material-ui/core` | `Box`, `Typography`, `Chip`, `makeStyles` |
| `@material-ui/icons/AccessTime` | Ícone de relógio no tempo relativo |

---

## Pré-requisito: habilitar rastreamento de visitas

Idêntico ao `TopVisitedChart` — em `app-config.yaml`:

```yaml
app:
  extensions:
    - api:home/visits: true
    - app-root-element:home/visit-listener: true
```

---

## Tradução de nomes (`VISIT_NAME_MAP`)

Mesma lógica do `TopVisitedChart`. O mapa é definido localmente em cada arquivo (não compartilhado):

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
  return VISIT_NAME_MAP[key] ?? name;
}
```

---

## Inferência do tipo de entidade pela URL

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
const DEFAULT_KIND = { color: '#546e7a', bg: '#eceff1', label: 'Página' };

function kindFromPathname(pathname: string) {
  const parts = pathname.split('/').filter(Boolean);
  // URL do catálogo: /catalog/default/<kind>/<name>
  const kind = parts[2]?.toLowerCase();
  return KIND_META[kind] ?? DEFAULT_KIND;
}
```

Para URLs como `/catalog/default/component/my-service`, o segmento `parts[2]` é `"component"`.  
Para URLs não-catálogo (ex.: `/search`, `/kubernetes`), retorna `DEFAULT_KIND` com label "Página".

---

## Tempo relativo em PT-BR

```ts
function relativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const m = Math.floor(diff / 60_000);
  const h = Math.floor(diff / 3_600_000);
  const d = Math.floor(diff / 86_400_000);
  if (m < 1)   return 'Agora';
  if (m < 60)  return `há ${m}m`;
  if (h < 24)  return `há ${h}h`;
  if (d === 1) return 'Ontem';
  return `há ${d}d`;
}
```

`timestamp` é um Unix timestamp em milissegundos (campo `Visit.timestamp`).

---

## Busca de dados

```ts
visitsApi
  .list({ orderBy: [{ field: 'timestamp', direction: 'desc' }], limit: 8 })
  .then(data => { setVisits(data); setLoading(false); })
  .catch(() => setLoading(false));
```

Diferente do `TopVisitedChart` que ordena por `hits`, aqui ordena por `timestamp` descendente (mais recente primeiro).

---

## JSX

```tsx
<InfoCard noPadding variant="fullHeight" cardClassName={classes.cardContent}
          title="Visitados Recentemente" subheader="Seu histórico de navegação recente">
  {loading ? <Progress /> : visits.length === 0 ? (
    <EmptyState missing="data" title="Nenhuma visita ainda"
      description="Comece a navegar para acompanhar suas páginas recentes." />
  ) : (
    <Box className={classes.list}>
      {visits.map(visit => {
        const kind = kindFromPathname(visit.pathname);
        return (
          <a key={visit.id} className={classes.item} href={visit.pathname}>
            <Box className={classes.dot} style={{ backgroundColor: kind.color }} />
            <Box className={classes.content}>
              <Typography className={classes.name}>
                {translateVisitName(visit.name)}
              </Typography>
              <Box className={classes.meta}>
                <Chip label={kind.label} size="small" className={classes.chip}
                      style={{ color: kind.color, backgroundColor: kind.bg }} />
                <Typography className={classes.time}>
                  <AccessTimeIcon style={{ fontSize: 11 }} />
                  {relativeTime(visit.timestamp)}
                </Typography>
              </Box>
            </Box>
          </a>
        );
      })}
    </Box>
  )}
</InfoCard>
```

---

## Estilos e scroll

Mesma estratégia do `TopVisitedChart` — `noPadding variant="fullHeight"` cria a cadeia flex:

```ts
cardContent: {
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
},
list: {
  flex: '1 1 0%',
  minHeight: 0,           // CRÍTICO para ativar scroll
  padding: theme.spacing(1, 2.5, 2),
  overflowY: 'auto',
},
item: {
  display: 'flex', alignItems: 'flex-start', gap: theme.spacing(1.5),
  paddingTop: theme.spacing(1.25), paddingBottom: theme.spacing(1.25),
  borderBottom: `1px solid ${theme.palette.divider}`,
  textDecoration: 'none', color: 'inherit',
  borderRadius: theme.shape.borderRadius,
  paddingLeft: theme.spacing(0.5), paddingRight: theme.spacing(0.5),
  transition: 'background-color 0.15s',
  '&:last-child': { borderBottom: 'none' },
  '&:hover': { backgroundColor: theme.palette.action.hover },
},
dot: {
  width: 10, height: 10,
  borderRadius: '50%',
  marginTop: 5,
  flexShrink: 0,
},
content:  { flex: 1, minWidth: 0 },
name:     { fontSize: '0.85rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
meta:     { display: 'flex', alignItems: 'center', gap: theme.spacing(0.75), marginTop: theme.spacing(0.25) },
time:     { fontSize: '0.72rem', color: theme.palette.text.disabled, display: 'flex', alignItems: 'center', gap: 3 },
chip:     { height: 18, fontSize: '0.65rem', fontWeight: 600 },
```

> **`minWidth: 0` no `content`**: sem isso, o flex item não encurta para o texto truncar com `textOverflow: ellipsis` — o flex item cresce para acomodar o conteúdo por padrão.

---

## Como registrar na home page

Em `HomePage.tsx`:

```tsx
import { RecentlyVisitedTimeline } from './RecentlyVisitedTimeline';

{on('recently-visited') && (
  <Grid item xs={12} md={activityActive === 1 ? 12 : 6} style={{ display: 'flex' }}>
    <Box className={classes.cardWrap} style={{ height: 460 }}>
      <RecentlyVisitedTimeline />
    </Box>
  </Grid>
)}
```

O widget `recently-visited` deve estar em `WIDGET_REGISTRY`:

```ts
{ id: 'recently-visited', title: 'Visitados Recentemente', description: 'Seu histórico de navegação',
  icon: <HistoryIcon />, iconColor: '#6a1b9a', bgColor: '#f3e5f5' }
```
