# Ações Rápidas

**Arquivo:** `packages/app/src/components/home/HomePage.tsx`  
**Componentes:** `ActionIcon`, `GroupFolder`, `GroupDialog`, `CreateGroupDialog`, `ToolDialog`

---

## O que faz

Seção de atalhos estilo "ícones de app mobile" com:
- Ícones 64×64px com cor de fundo e rótulo abaixo
- Tooltip ao hover com título e descrição de cada ação
- **Drag & drop** para reordenar e para criar grupos
- **Grupos (pastas)**: agrupa até 4 ações em um folder com preview 2×2
- **Modo de edição** estilo iOS: animação de wiggle, badge × vermelho para remover
- **Personalização** via dialog (habilitar/desabilitar itens do registro)
- **Botão "Novo Grupo"** inline como um ícone com borda tracejada
- Persistência completa em `localStorage`

---

## Dependências

| Pacote | Uso |
|---|---|
| `@material-ui/core` | `Box`, `Typography`, `Tooltip`, `Dialog`, `IconButton`, `Button`, `TextField`, `Divider` |
| `@material-ui/icons` | `FolderIcon`, `AddIcon`, `CloseIcon`, `EditIcon`, `TuneIcon` e todos os ícones das ferramentas |

Sem dependências de plugins do Backstage nesta seção.

---

## Tipos

### `ToolId`

```ts
type ToolId =
  | 'docs-external' | 'catalog' | 'templates' | 'plugins-external'
  | 'techdocs' | 'search' | 'apis' | 'org' | 'kubernetes'
  | 'notifications' | 'settings';
```

### `ToolDef`

```ts
type ToolDef = ItemDef & {
  id: ToolId;
  url: string;
  external?: boolean;  // true = abre em nova aba
};
```

### `ToolGroup`

```ts
type ToolGroup = {
  id: string;   // gerado: `grp_${Date.now()}_${random}`
  name: string;
  items: ToolId[];  // máximo 4 itens
};
```

### `ToolLayout`

```ts
type ToolLayout = {
  ungrouped: ToolId[];   // ferramentas fora de grupos
  groups: ToolGroup[];   // grupos/pastas
};
```

---

## Registro de ferramentas (`TOOL_REGISTRY`)

Cada ferramenta define: id, título, descrição, URL, ícone MUI, cor do ícone e cor de fundo.  
Todos os ícones são declarados com `fontSize="large"` para tamanho correto na grade principal.

```ts
const TOOL_REGISTRY: ToolDef[] = [
  { id: 'docs-external', title: 'Documentação', description: '...', url: 'https://backstage.io/docs',
    icon: <MenuBookIcon fontSize="large" />, iconColor: '#1565c0', bgColor: '#e3f2fd', external: true },
  { id: 'catalog',    title: 'Catálogo',    url: '/catalog',       icon: <CategoryIcon fontSize="large" />,    iconColor: '#2e7d32', bgColor: '#e8f5e9' },
  { id: 'templates',  title: 'Templates',   url: '/create',        icon: <BuildIcon fontSize="large" />,       iconColor: '#e65100', bgColor: '#fff3e0' },
  { id: 'plugins-external', title: 'Plugins', url: 'https://backstage.io/plugins',
    icon: <ExtensionIcon fontSize="large" />, iconColor: '#6a1b9a', bgColor: '#f3e5f5', external: true },
  { id: 'techdocs',   title: 'TechDocs',    url: '/docs',          icon: <DescriptionIcon fontSize="large" />, iconColor: '#00695c', bgColor: '#e0f2f1' },
  { id: 'search',     title: 'Busca',       url: '/search',        icon: <SearchIcon fontSize="large" />,      iconColor: '#37474f', bgColor: '#eceff1' },
  { id: 'apis',       title: 'APIs',        url: '/catalog?filters%5Bkind%5D=api',
    icon: <CodeIcon fontSize="large" />, iconColor: '#4527a0', bgColor: '#ede7f6' },
  { id: 'org',        title: 'Organograma', url: '/org',           icon: <GroupIcon fontSize="large" />,       iconColor: '#558b2f', bgColor: '#f1f8e9' },
  { id: 'kubernetes', title: 'Kubernetes',  url: '/kubernetes',    icon: <CloudIcon fontSize="large" />,       iconColor: '#0277bd', bgColor: '#e1f5fe' },
  { id: 'notifications', title: 'Notificações', url: '/notifications',
    icon: <NotificationsIcon fontSize="large" />, iconColor: '#c62828', bgColor: '#ffebee' },
  { id: 'settings',   title: 'Configurações', url: '/settings',    icon: <SettingsIcon fontSize="large" />,    iconColor: '#546e7a', bgColor: '#eceff1' },
];

const DEFAULT_TOOLS: ToolId[] = ['docs-external', 'catalog', 'templates', 'plugins-external'];
```

---

## Persistência em localStorage

```ts
const LAYOUT_KEY      = 'backstage-home-layout-v2';
const LEGACY_TOOL_KEY = 'backstage-home-tools';       // chave antiga (migração)
const TOOL_VALID      = new Set<string>(TOOL_REGISTRY.map(t => t.id));

function loadLayout(): ToolLayout {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ToolLayout;
      if (Array.isArray(parsed.ungrouped) && Array.isArray(parsed.groups)) return parsed;
    }
    // migração: chave antiga armazenava apenas array flat de ToolId
    const legacy = localStorage.getItem(LEGACY_TOOL_KEY);
    if (legacy) {
      const ids = (JSON.parse(legacy) as string[]).filter(id => TOOL_VALID.has(id)) as ToolId[];
      return { ungrouped: ids.length ? ids : DEFAULT_TOOLS, groups: [] };
    }
  } catch { /* */ }
  return DEFAULT_LAYOUT;
}

function saveLayout(layout: ToolLayout) {
  localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
}

function generateGroupId(): string {
  return `grp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}
```

> **`LAYOUT_KEY = 'backstage-home-layout-v2'`**: a versão `v2` foi introduzida quando o formato passou de `ToolId[]` para `ToolLayout`. A migração lê a chave legada e converte automaticamente.

---

## Estado no componente `HomePage`

```ts
const [layout, setLayout]         = useState<ToolLayout>(loadLayout);
const [isEditMode, setIsEditMode] = useState(false);
const [createGroupOpen, setCreateGroupOpen] = useState(false);
const [openGroupId, setOpenGroupId]         = useState<string | null>(null);
const [toolDialogOpen, setToolDialogOpen]   = useState(false);
const [dragId, setDragId]         = useState<string | null>(null);   // ToolId ou 'group:<id>'
const [dragOverId, setDragOverId] = useState<string | null>(null);
```

---

## Funções de mutação do layout

```ts
const updateLayout = (next: ToolLayout) => { setLayout(next); saveLayout(next); };

// Adiciona/remove uma ferramenta do layout (toggle)
const toggleTool = (id: ToolId) => {
  setLayout(prev => {
    const all = allLayoutTools(prev);
    let next: ToolLayout;
    if (all.includes(id)) {
      // remove de ungrouped e de todos os grupos
      next = {
        ungrouped: prev.ungrouped.filter(t => t !== id),
        groups: prev.groups.map(g => ({ ...g, items: g.items.filter(t => t !== id) })),
      };
    } else {
      next = { ...prev, ungrouped: [...prev.ungrouped, id] };
    }
    saveLayout(next);
    return next;
  });
};

// Cria um grupo vazio com nome
const createGroup = (name: string) => {
  const next: ToolLayout = {
    ...layout,
    groups: [...layout.groups, { id: generateGroupId(), name, items: [] }],
  };
  updateLayout(next);
  setCreateGroupOpen(false);
};

// Salva alterações de um grupo (nome ou itens reordenados)
const saveGroup = (updated: ToolGroup) => {
  const next: ToolLayout = {
    ...layout,
    groups: layout.groups.map(g => g.id === updated.id ? updated : g),
  };
  updateLayout(next);
};

// Exclui um grupo e devolve seus itens ao ungrouped
const deleteGroup = (groupId: string) => {
  const group = layout.groups.find(g => g.id === groupId);
  const next: ToolLayout = {
    ungrouped: [...layout.ungrouped, ...(group?.items ?? [])],
    groups: layout.groups.filter(g => g.id !== groupId),
  };
  updateLayout(next);
  setOpenGroupId(null);
};

function allLayoutTools(layout: ToolLayout): ToolId[] {
  return [...layout.ungrouped, ...layout.groups.flatMap(g => g.items)];
}
```

---

## Drag & Drop (HTML5 nativo)

Usa a API nativa do HTML5 (`draggable`, `onDragStart`, `onDragOver`, `onDrop`, `onDragEnd`). Sem bibliotecas externas.

IDs de drag são strings: `ToolId` para ferramentas soltas, `'group:<id>'` para grupos/pastas.

### `handleDragStart`

```ts
const handleDragStart = (e: React.DragEvent, id: string) => {
  e.dataTransfer.setData('text/plain', id);
  e.dataTransfer.effectAllowed = 'move';
  setDragId(id);
};
```

### `handleDragOver`

```ts
const handleDragOver = (e: React.DragEvent, id: string) => {
  e.preventDefault();  // obrigatório para permitir drop
  // impede highlight em grupo cheio (4 itens)
  const isFullGroup = id.startsWith('group:') &&
    layout.groups.find(g => g.id === id.slice(6))?.items.length === 4;
  if (isFullGroup) {
    e.dataTransfer.dropEffect = 'none';
    setDragOverId(null);
    return;
  }
  e.dataTransfer.dropEffect = 'move';
  if (id !== dragId) setDragOverId(id);
};
```

### `handleDrop` — 4 casos

```ts
const handleDrop = (e: React.DragEvent, targetId: string) => {
  e.preventDefault();
  const srcId = dragId;
  if (!srcId || srcId === targetId) { setDragId(null); setDragOverId(null); return; }

  const dragIsGroup   = srcId.startsWith('group:');
  const targetIsGroup = targetId.startsWith('group:');
  let newGroupToOpen: string | null = null;

  setLayout(prev => {
    const next: ToolLayout = {
      ungrouped: [...prev.ungrouped],
      groups: prev.groups.map(g => ({ ...g, items: [...g.items] })),
    };

    if (!dragIsGroup && targetIsGroup) {
      // CASO 1: ferramenta → pasta (adiciona ao grupo, máx 4)
      const gId = targetId.slice(6);
      const targetGroup = next.groups.find(g => g.id === gId);
      if (!targetGroup || targetGroup.items.length >= 4) return prev;
      next.ungrouped = next.ungrouped.filter(t => t !== srcId);
      next.groups = next.groups.map(g =>
        g.id === gId && !g.items.includes(srcId as ToolId)
          ? { ...g, items: [...g.items, srcId as ToolId] }
          : g,
      );

    } else if (!dragIsGroup && !targetIsGroup && isEditMode) {
      // CASO 2: ferramenta → ferramenta NO MODO EDIÇÃO → cria grupo com ambas
      const gId = generateGroupId();
      newGroupToOpen = gId;
      next.ungrouped = next.ungrouped.filter(t => t !== srcId && t !== targetId);
      next.groups = [...next.groups, {
        id: gId, name: 'Novo Grupo',
        items: [srcId as ToolId, targetId as ToolId],
      }];

    } else if (!dragIsGroup && !targetIsGroup) {
      // CASO 3: ferramenta → ferramenta MODO NORMAL → reordena
      const from = next.ungrouped.indexOf(srcId as ToolId);
      const to   = next.ungrouped.indexOf(targetId as ToolId);
      if (from !== -1 && to !== -1) {
        next.ungrouped.splice(from, 1);
        next.ungrouped.splice(to, 0, srcId as ToolId);
      }

    } else if (dragIsGroup && targetIsGroup) {
      // CASO 4: grupo → grupo → reordena grupos
      const from = next.groups.findIndex(g => g.id === srcId.slice(6));
      const to   = next.groups.findIndex(g => g.id === targetId.slice(6));
      if (from !== -1 && to !== -1) {
        const [moved] = next.groups.splice(from, 1);
        next.groups.splice(to, 0, moved);
      }
    }

    saveLayout(next);
    return next;
  });

  if (newGroupToOpen) setOpenGroupId(newGroupToOpen);
  setDragId(null);
  setDragOverId(null);
};
```

> **Por que `setLayout` com função?** Garante acesso ao estado mais recente em closures assíncronas — o `dragId` lido de fora pode ser stale, mas o `prev` dentro do setter é sempre fresco.

---

## Modo de edição (iOS-style)

### Animação de wiggle

```ts
'@keyframes iconWiggle': {
  '0%, 100%': { transform: 'rotate(-2.5deg)' },
  '50%':      { transform: 'rotate(2.5deg)'  },
},
iconCell: {
  position: 'relative',
  display: 'inline-flex',
},
iconCellWiggle: {
  animation: '$iconWiggle 0.18s ease-in-out infinite',
  transformOrigin: '50% 28%',  // rotação ao redor do topo (igual iOS)
},
```

O `animationDelay` é escalonado por índice para evitar sincronismo robótico:

```tsx
<div className={cellCls} style={{ animationDelay: `${editDelay}s` }}>
// editDelay = idx * 0.04  (40ms de diferença entre ícones)
```

### Badge de remoção (×)

```ts
editBadge: {
  position: 'absolute',
  top: 2, right: 2,
  width: 20, height: 20,
  borderRadius: '50%',
  backgroundColor: theme.palette.error.main,
  color: '#fff',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer',
  zIndex: 20,
  border: `2.5px solid ${theme.palette.background.paper}`,
  transition: 'transform 0.1s',
  '&:hover': { transform: 'scale(1.2)' },
  '& svg': { fontSize: '0.6rem' },
  // sem boxShadow
},
```

### Header em modo de edição

```tsx
// Normal:
<Box style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
  <Tooltip title="Personalizar ações" arrow>
    <IconButton size="small" onClick={() => setToolDialogOpen(true)}>
      <TuneIcon fontSize="small" />
    </IconButton>
  </Tooltip>
  <Tooltip title="Editar ações" arrow>
    <IconButton size="small" onClick={() => setIsEditMode(true)}>
      <EditIcon fontSize="small" />
    </IconButton>
  </Tooltip>
</Box>

// Em modo edição:
<Box style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
  <Tooltip title="Personalizar ações" arrow>
    <IconButton size="small" onClick={() => setToolDialogOpen(true)}>
      <TuneIcon fontSize="small" />
    </IconButton>
  </Tooltip>
  <Button size="small" variant="contained" color="primary"
    onClick={() => setIsEditMode(false)} style={{ fontWeight: 700, minWidth: 0 }}>
    Concluído
  </Button>
</Box>
```

---

## Componente `ActionIcon`

Renderiza um ícone de ação rápida individual com suporte a drag, edit mode e tooltip.

```tsx
const ActionIcon = ({
  tool, isDragging, isDragOver,
  isEditMode = false, editDelay = 0, onRemove,
  onDragStart, onDragOver, onDrop, onDragEnd,
}: { ... }) => {
  const cls = [
    classes.actionItem,
    isDragging  ? classes.actionItemDragging  : '',
    isDragOver  ? classes.actionItemDragOver  : '',
  ].filter(Boolean).join(' ');

  const cellCls = [
    classes.iconCell,
    isEditMode && !isDragging ? classes.iconCellWiggle : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={cellCls} style={{ animationDelay: `${editDelay}s` }}>
      <Tooltip
        title={isEditMode ? '' : <Box>...</Box>}
        disableHoverListener={isDragging || isEditMode}
        placement="top" arrow
      >
        <a
          className={cls}
          href={tool.url}
          target={tool.external ? '_blank' : '_self'}
          rel={tool.external ? 'noopener noreferrer' : undefined}
          draggable
          onDragStart={onDragStart} onDragOver={onDragOver}
          onDrop={onDrop} onDragEnd={onDragEnd}
        >
          <Box className={classes.actionIconWrap} style={{ backgroundColor: tool.bgColor }}>
            <Box style={{ color: tool.iconColor, display: 'flex' }}>{tool.icon}</Box>
          </Box>
          <Typography className={classes.actionLabel}>{tool.title}</Typography>
        </a>
      </Tooltip>
      {isEditMode && (
        <div className={classes.editBadge} role="button"
          onClick={e => { e.preventDefault(); e.stopPropagation(); onRemove?.(); }}>
          <CloseIcon />
        </div>
      )}
    </div>
  );
};
```

---

## Estilos das ações rápidas

```ts
actionsGrid: {
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.spacing(1.5),
  padding: theme.spacing(0.5, 0, 1),
},
actionItem: {
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  gap: theme.spacing(0.75),
  textDecoration: 'none', color: 'inherit',
  width: 90,
  padding: theme.spacing(1, 0.5),
  borderRadius: theme.shape.borderRadius * 2,
  transition: 'background-color 0.15s, opacity 0.15s',
  cursor: 'grab', userSelect: 'none',
  '&:hover': { backgroundColor: theme.palette.action.hover },
  '&:active': { cursor: 'grabbing' },
},
actionItemDragging: { opacity: 0.35, transform: 'scale(0.95)', cursor: 'grabbing' },
actionItemDragOver: {
  backgroundColor: `${theme.palette.primary.main}18`,
  outline: `2px dashed ${theme.palette.primary.main}`,
  outlineOffset: 3,
  borderRadius: theme.shape.borderRadius * 2,
  transform: 'scale(1.06)',
},
actionIconWrap: {
  width: 64, height: 64,
  borderRadius: 16,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  '& .MuiSvgIcon-root': { fontSize: '1.6rem' },
  // sem boxShadow — sombra padronizada globalmente via cardWrap
},
actionLabel: {
  fontSize: '0.72rem', fontWeight: 600,
  textAlign: 'center', lineHeight: 1.25,
  maxWidth: 84,
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
},
```

---

## Componente `GroupFolder`

Renderiza uma pasta com preview 2×2 dos primeiros 4 itens do grupo.

```tsx
const GroupFolder = ({ group, isDragOver, isEditMode, editDelay, onRemove,
                       onDragStart, onDragOver, onDrop, onDragEnd, onClick }) => {
  const preview = group.items
    .slice(0, 4)
    .map(id => TOOL_REGISTRY.find(t => t.id === id))
    .filter((t): t is ToolDef => !!t);

  return (
    <div className={cellCls} style={{ animationDelay: `${editDelay}s` }}>
      <Tooltip title={/* nome + lista de ações */} placement="top" arrow>
        <div className={`${classes.actionItem} ...`} draggable onClick={onClick} ...>
          <Box className={classes.folderIconWrap}>
            {preview.length === 0 ? (
              <FolderIcon style={{ gridColumn: '1 / span 2', gridRow: '1 / span 2', ... }} />
            ) : (
              Array.from({ length: 4 }).map((_, i) => {
                const t = preview[i];
                return (
                  <Box key={i} className={classes.folderMiniIcon}
                    style={{ backgroundColor: t ? t.bgColor : 'rgba(255,255,255,0.12)' }}>
                    {t && <Box style={{ color: t.iconColor, display: 'flex', lineHeight: 0 }}>{t.icon}</Box>}
                  </Box>
                );
              })
            )}
          </Box>
          <Typography className={classes.actionLabel}>{group.name}</Typography>
        </div>
      </Tooltip>
      {/* badge × idêntico ao ActionIcon */}
    </div>
  );
};
```

### Estilos do folder

```ts
folderIconWrap: {
  width: 64, height: 64,
  borderRadius: 16,
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gridTemplateRows: '1fr 1fr',
  padding: 7,
  gap: 3,
  backgroundColor: theme.palette.action.selected,
  // sem boxShadow
},
folderMiniIcon: {
  borderRadius: 5,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  overflow: 'hidden',
  '& svg': { width: 13, height: 13, flexShrink: 0 },
  // 'width: 13' em px sobrepõe o fontSize="large" dos ícones do registro
},
```

> **Por que `& svg` e não `& .MuiSvgIcon-root`?** Os ícones no `TOOL_REGISTRY` são declarados com `fontSize="large"`, que injeta a classe `MuiSvgIcon-fontSizeLarge` com `font-size: 2.1875rem`. A classe `.MuiSvgIcon-root` tem mesma especificidade e pode perder a disputa de cascata. Selecionar `svg` diretamente com `width`/`height` em pixels sempre vence.

### Tooltip do grupo

O tooltip mostra nome do grupo + lista dos itens com bullet colorido:

```tsx
title={isEditMode ? '' : (
  <Box>
    <Typography style={{ fontWeight: 700, fontSize: '0.8rem' }}>{group.name}</Typography>
    {preview.map(t => (
      <Typography key={t.id} style={{ fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: 4 }}>
        <Box style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: t.bgColor }} />
        {t.title}
      </Typography>
    ))}
    {group.items.length > 4 && (
      <Typography style={{ fontSize: '0.72rem', opacity: 0.7 }}>+{group.items.length - 4} mais</Typography>
    )}
  </Box>
)}
```

---

## `GroupDialog` — Dialog de detalhes do grupo

Abre ao clicar em um grupo (fora do modo edição). Permite:
- Renomear o grupo (campo inline no título)
- Reordenar itens dentro do grupo (drag & drop local)
- Remover itens individuais (botão ×)
- Excluir o grupo inteiro (itens devolvidos ao ungrouped)

```tsx
const GroupDialog = ({ group, open, onClose, onSave, onDelete }) => {
  const [name, setName]   = useState(group.name);
  const [items, setItems] = useState<ToolId[]>(group.items);

  // Sincroniza quando o grupo muda externamente
  useEffect(() => { setName(group.name); setItems(group.items); }, [group]);

  const commit = () => onSave({ ...group, name: name.trim() || group.name, items });
  // onClose sempre faz commit automático

  // drag & drop local (apenas reordenação, sem criar grupos)
  const lDrop = (e, targetId) => {
    setItems(prev => {
      const from = prev.indexOf(localDragId);
      const to   = prev.indexOf(targetId);
      const next = [...prev];
      next.splice(from, 1);
      next.splice(to, 0, localDragId);
      return next;
    });
  };
};
```

---

## `CreateGroupDialog` — Criar grupo

```tsx
const CreateGroupDialog = ({ open, onClose, onCreate }) => {
  const [name, setName] = useState('');
  const submit = () => {
    if (name.trim()) {
      onCreate(name.trim());
      setName('');
      onClose();  // fecha explicitamente após criar
    }
  };
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Criar grupo</DialogTitle>
      <DialogContent>
        <TextField autoFocus label="Nome do grupo" value={name}
          onChange={e => setName(e.target.value)} fullWidth variant="outlined" size="small"
          onKeyDown={e => { if (e.key === 'Enter') submit(); }} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button onClick={submit} variant="contained" color="primary" disabled={!name.trim()}>
          Criar
        </Button>
      </DialogActions>
    </Dialog>
  );
};
```

---

## Botão "Novo Grupo" inline

Aparece sempre ao final da grade como um ícone com borda tracejada:

```tsx
<Tooltip title="Criar novo grupo" arrow placement="top">
  <button className={classes.addGroupCell} onClick={() => setCreateGroupOpen(true)}>
    <Box className={classes.addGroupIcon}>
      <AddIcon />
    </Box>
    <Typography className={classes.addGroupLabel}>Novo Grupo</Typography>
  </button>
</Tooltip>
```

```ts
addGroupCell: {
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  gap: theme.spacing(0.75),
  cursor: 'pointer', width: 90,
  padding: theme.spacing(1, 0.5),
  borderRadius: theme.shape.borderRadius * 2,
  background: 'none', border: 'none',
  userSelect: 'none',
  '&:hover': { backgroundColor: theme.palette.action.hover },
  '&:hover $addGroupIcon': { borderColor: theme.palette.primary.main,
    '& .MuiSvgIcon-root': { color: theme.palette.primary.main } },
},
addGroupIcon: {
  width: 64, height: 64, borderRadius: 16,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  border: `2px dashed ${theme.palette.divider}`,
  transition: 'border-color 0.15s',
  '& .MuiSvgIcon-root': { fontSize: '1.6rem', color: theme.palette.text.disabled, transition: 'color 0.15s' },
},
```

---

## Localização no arquivo

`HomePage.tsx`:
1. Tipos e constantes: linhas 138–314
2. `useStyles` (CSS das ações): linhas 438–608
3. `getGreeting()`: linha 645
4. `ActionIcon`: linhas 673–755
5. `GroupFolder`: linhas 759–875
6. `GroupDialog`: linhas 879–995
7. `CreateGroupDialog`: linhas 999–1033
8. `ToolDialog`: linhas 1123–1164
9. Estado e handlers no `HomePage`: linhas 1168–1336
10. JSX da seção "Ações Rápidas": linhas 1446–1529
