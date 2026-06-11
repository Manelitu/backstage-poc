# Sistema de Widgets

**Arquivo:** `packages/app/src/components/home/HomePage.tsx`  
**Componentes:** `WidgetDialog`, `SelectableCard`, `CustomizeBar`, `ToolDialog`

---

## O que faz

Permite ao usuário personalizar quais widgets e quais ações rápidas aparecem na home page. As preferências são salvas em `localStorage` e restauradas automaticamente. Uma barra de resumo ("customize bar") mostra o estado atual e abre os dialogs de personalização.

---

## Dependências

| Pacote | Uso |
|---|---|
| `@material-ui/core` | `Dialog`, `DialogTitle`, `DialogContent`, `DialogActions`, `Grid`, `Card`, `Checkbox`, `Button`, `Typography`, `Box` |
| `@material-ui/icons/Add` | Ícone no botão "Adicionar widget" |
| `@material-ui/icons/Tune` | Ícone no botão "Personalizar ações" |

Sem dependências externas de plugins — o sistema é 100% local.

---

## Tipos e registros

### `WidgetId`

```ts
type WidgetId =
  | 'starred-entities'
  | 'catalog-stats'
  | 'random-joke'
  | 'top-visited'
  | 'recently-visited';
```

Union type estrita: só IDs válidos podem ser usados.

### `ItemDef`

```ts
type ItemDef = {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  iconColor: string;
  bgColor: string;
};
```

Tipo base compartilhado por widgets e ferramentas de ação rápida.

### `WIDGET_REGISTRY`

Array de `ItemDef` com todos os widgets disponíveis:

```ts
const WIDGET_REGISTRY: ItemDef[] = [
  { id: 'starred-entities', title: 'Favoritos',              description: '...', icon: <StarIcon />,          iconColor: '#f57f17', bgColor: '#fff8e1' },
  { id: 'top-visited',      title: 'Mais Visitados',         description: '...', icon: <TrendingUpIcon />,    iconColor: '#2e7d32', bgColor: '#e8f5e9' },
  { id: 'recently-visited', title: 'Visitados Recentemente', description: '...', icon: <HistoryIcon />,       iconColor: '#6a1b9a', bgColor: '#f3e5f5' },
  { id: 'catalog-stats',    title: 'Visão do Catálogo',      description: '...', icon: <AppsIcon />,          iconColor: '#0277bd', bgColor: '#e1f5fe' },
  { id: 'random-joke',      title: 'Piada Aleatória',        description: '...', icon: <EmojiEmotionsIcon />, iconColor: '#558b2f', bgColor: '#f1f8e9' },
];
```

### `DEFAULT_WIDGETS`

```ts
const DEFAULT_WIDGETS: WidgetId[] = ['starred-entities', 'top-visited', 'recently-visited'];
```

Widgets ativos por padrão (sem configuração prévia do usuário).

---

## Persistência em localStorage

```ts
const WIDGET_KEY = 'backstage-home-widgets';
const WIDGET_VALID = new Set<string>(WIDGET_REGISTRY.map(w => w.id));

function loadWidgets(): WidgetId[] {
  try {
    const saved = localStorage.getItem(WIDGET_KEY);
    if (!saved) return DEFAULT_WIDGETS;
    const parsed: string[] = JSON.parse(saved);
    // filtra IDs obsoletos que podem ter sido removidos do registro
    const filtered = parsed.filter(id => WIDGET_VALID.has(id)) as WidgetId[];
    return filtered.length > 0 ? filtered : DEFAULT_WIDGETS;
  } catch {
    return DEFAULT_WIDGETS;
  }
}

function saveWidgets(ids: WidgetId[]) {
  localStorage.setItem(WIDGET_KEY, JSON.stringify(ids));
}
```

> **`WIDGET_VALID`**: set para validação O(1). Qualquer ID salvo anteriormente que não exista mais no registro é silenciosamente removido ao carregar.

---

## Estado no componente `HomePage`

```ts
const [enabledWidgets, setEnabledWidgets] = useState<WidgetId[]>(loadWidgets);
const [widgetDialogOpen, setWidgetDialogOpen] = useState(false);
```

`loadWidgets` é passado como **função inicializadora** do `useState` (não chamada: `useState(loadWidgets)` e não `useState(loadWidgets())`), garantindo que o `localStorage` seja lido só na montagem.

---

## Funções de controle

```ts
const toggleWidget = (id: WidgetId) => {
  setEnabledWidgets(prev => {
    const next = prev.includes(id)
      ? prev.filter(w => w !== id)   // remove se já está ativo
      : [...prev, id];               // adiciona se estava inativo
    saveWidgets(next);
    return next;
  });
};

const resetWidgets = () => {
  setEnabledWidgets(DEFAULT_WIDGETS);
  saveWidgets(DEFAULT_WIDGETS);
};
```

---

## Barra de personalização (CustomizeBar)

Exibida sempre no topo das seções, resume o estado atual e abre os dialogs:

```tsx
<Box className={classes.customizeBar}>
  <Typography variant="caption" color="textSecondary">
    {enabledWidgets.length}/{WIDGET_REGISTRY.length} widgets &nbsp;·&nbsp;
    {allEnabled.length}/{TOOL_REGISTRY.length} ações &nbsp;·&nbsp;
    {layout.groups.length} {layout.groups.length === 1 ? 'grupo' : 'grupos'}
  </Typography>
  <Button
    size="small"
    startIcon={<AddIcon />}
    variant="outlined"
    onClick={() => setWidgetDialogOpen(true)}
  >
    Adicionar widget
  </Button>
</Box>
```

`allEnabled` é derivado de `allLayoutTools(layout)` que une ferramentas soltas e ferramentas dentro de grupos.

---

## Componente `SelectableCard`

Card reutilizado tanto pelo `WidgetDialog` quanto pelo `ToolDialog`. Exibe ícone, título, descrição e checkbox:

```tsx
const SelectableCard = ({ item, active, onToggle }: {
  item: ItemDef;
  active: boolean;
  onToggle: () => void;
}) => (
  <Card
    className={active ? classes.selectCardActive : classes.selectCard}
    elevation={0}
    onClick={onToggle}
  >
    <Box className={classes.selectCardBody}>
      <Box className={classes.selectCardHeader}>
        <Box className={classes.selectIconCircle} style={{ backgroundColor: item.bgColor }}>
          <Box style={{ color: item.iconColor, display: 'flex', fontSize: 20 }}>
            {item.icon}
          </Box>
        </Box>
        <Checkbox checked={active} color="primary" size="small"
          onClick={e => e.stopPropagation()} onChange={onToggle} />
      </Box>
      <Typography variant="subtitle2" style={{ fontWeight: 700 }}>{item.title}</Typography>
      <Typography variant="caption" color="textSecondary">{item.description}</Typography>
    </Box>
  </Card>
);
```

> **`e.stopPropagation()` no Checkbox**: sem isso, o click no checkbox dispararia o click do Card também, causando duplo toggle.

---

## Estilos dos cards selecionáveis

```ts
selectCard: {
  border: `2px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius * 2,
  cursor: 'pointer',
  transition: 'border-color 0.15s, box-shadow 0.15s',
  '&:hover': { boxShadow: theme.shadows[3] },
},
selectCardActive: {
  border: `2px solid ${theme.palette.primary.main}`,
  borderRadius: theme.shape.borderRadius * 2,
  cursor: 'pointer',
  background: `${theme.palette.primary.main}08`,  // 8/255 ≈ 3% opacidade
  transition: 'border-color 0.15s, box-shadow 0.15s',
  '&:hover': { boxShadow: theme.shadows[3] },
},
selectIconCircle: {
  width: 40, height: 40,
  borderRadius: '50%',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
},
```

---

## `WidgetDialog`

```tsx
const WidgetDialog = ({ open, onClose, enabled, onToggle, onReset }) => (
  <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
    <DialogTitle>Personalizar widgets</DialogTitle>
    <DialogContent dividers>
      <Typography variant="body2" color="textSecondary" style={{ marginBottom: 16 }}>
        Escolha quais widgets aparecem na sua homepage. As alterações são salvas automaticamente.
      </Typography>
      <Grid container spacing={2}>
        {WIDGET_REGISTRY.map(widget => (
          <Grid item xs={6} key={widget.id}>
            <SelectableCard
              item={widget}
              active={enabled.includes(widget.id as WidgetId)}
              onToggle={() => onToggle(widget.id as WidgetId)}
            />
          </Grid>
        ))}
      </Grid>
    </DialogContent>
    <DialogActions>
      <Button onClick={onReset} size="small">Restaurar padrões</Button>
      <Box flex={1} />
      <Button onClick={onClose} variant="contained" color="primary">Concluir</Button>
    </DialogActions>
  </Dialog>
);
```

---

## `ToolDialog` (Personalizar ações rápidas)

Idêntico ao `WidgetDialog` em estrutura, mas itera sobre `TOOL_REGISTRY` e usa `ToolId`:

```tsx
const ToolDialog = ({ open, onClose, enabled, onToggle, onReset }) => (
  <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
    <DialogTitle>Personalizar ações rápidas</DialogTitle>
    <DialogContent dividers>
      <Grid container spacing={2}>
        {TOOL_REGISTRY.map(tool => (
          <Grid item xs={6} key={tool.id}>
            <SelectableCard
              item={tool}
              active={enabled.includes(tool.id)}
              onToggle={() => onToggle(tool.id)}
            />
          </Grid>
        ))}
      </Grid>
    </DialogContent>
    <DialogActions>
      <Button onClick={onReset} size="small">Restaurar padrões</Button>
      <Box flex={1} />
      <Button onClick={onClose} variant="contained" color="primary">Concluir</Button>
    </DialogActions>
  </Dialog>
);
```

---

## Condicional de renderização dos widgets

Na `HomePage`, cada seção é renderizada condicionalmente:

```ts
const on = (id: WidgetId) => enabledWidgets.includes(id);

const hasWorkspace = on('starred-entities') || on('random-joke') || on('catalog-stats');
const activityActive = [on('top-visited'), on('recently-visited')].filter(Boolean).length;
```

- `hasWorkspace`: controla se a seção "Meu Espaço" aparece
- `activityActive`: conta quantos widgets de atividade estão ativos para ajustar o layout responsivo (12 colunas se apenas 1, 6+6 se ambos)
