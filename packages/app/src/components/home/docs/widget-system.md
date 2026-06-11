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

Exibida sempre entre a barra de busca e a seção "Ações Rápidas". Resume o estado atual com pills coloridos e abre o dialog de widgets via ícone. **Não possui fundo/card** — os elementos flutuam diretamente na página.

### Estilos

```ts
customizeBar: {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: theme.spacing(3),
  padding: theme.spacing(0, 0.5),
  // sem background, border ou boxShadow — sem card
},
statPill: {
  display: 'inline-flex',
  alignItems: 'baseline',
  gap: 5,
  borderRadius: 20,
  padding: '3px 10px',
  border: '1px solid transparent',
},
statNum:  { fontWeight: 800, fontSize: '0.8rem', lineHeight: 1.5 },
statUnit: { fontSize: '0.69rem', color: theme.palette.text.secondary, fontWeight: 500 },
statSep:  { color: theme.palette.divider, userSelect: 'none', fontSize: '1rem', lineHeight: 1, alignSelf: 'center' },
```

### JSX

```tsx
<Box className={classes.customizeBar}>
  <Box style={{ display: 'flex', alignItems: 'center', gap: 6 }}>

    {/* Pill azul: X/Y widgets ativos */}
    <Box className={classes.statPill}
      style={{ backgroundColor: 'rgba(2,119,189,0.07)', borderColor: 'rgba(2,119,189,0.18)' }}>
      <Typography className={classes.statNum} style={{ color: '#0277bd' }}>
        {enabledWidgets.length}/{WIDGET_REGISTRY.length}
      </Typography>
      <Typography className={classes.statUnit}>widgets</Typography>
    </Box>

    <Typography className={classes.statSep}>·</Typography>

    {/* Pill verde: X/Y ações ativas */}
    <Box className={classes.statPill}
      style={{ backgroundColor: 'rgba(46,125,50,0.07)', borderColor: 'rgba(46,125,50,0.18)' }}>
      <Typography className={classes.statNum} style={{ color: '#2e7d32' }}>
        {allEnabled.length}/{TOOL_REGISTRY.length}
      </Typography>
      <Typography className={classes.statUnit}>ações</Typography>
    </Box>

    {/* Pill teal: grupos (só aparece se existirem grupos) */}
    {layout.groups.length > 0 && (
      <>
        <Typography className={classes.statSep}>·</Typography>
        <Box className={classes.statPill}
          style={{ backgroundColor: 'rgba(0,105,92,0.07)', borderColor: 'rgba(0,105,92,0.18)' }}>
          <Typography className={classes.statNum} style={{ color: '#00695c' }}>
            {layout.groups.length}
          </Typography>
          <Typography className={classes.statUnit}>
            {layout.groups.length === 1 ? 'grupo' : 'grupos'}
          </Typography>
        </Box>
      </>
    )}
  </Box>

  {/* Ícone de widgets — abre WidgetDialog */}
  <Tooltip title="Gerenciar widgets" arrow>
    <IconButton size="small" onClick={() => setWidgetDialogOpen(true)}>
      <WidgetsIcon fontSize="small" />
    </IconButton>
  </Tooltip>
</Box>
```

`allEnabled` é derivado de `allLayoutTools(layout)` que une ferramentas soltas e ferramentas dentro de grupos.

> **Por que sem card?** A barra de resumo é informação secundária — um card com fundo e borda competia visualmente com os cards de widgets abaixo. Sem card, os pills coloridos destacam os dados sem peso visual extra.

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
  transition: 'border-color 0.15s',
  // sem boxShadow: o feedback de hover é dado apenas pela borda colorida
},
selectCardActive: {
  border: `2px solid ${theme.palette.primary.main}`,
  borderRadius: theme.shape.borderRadius * 2,
  cursor: 'pointer',
  background: `${theme.palette.primary.main}08`,  // 8/255 ≈ 3% opacidade
  transition: 'border-color 0.15s',
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
