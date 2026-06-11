import { useEffect, useState } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Card from '@material-ui/core/Card';
import Checkbox from '@material-ui/core/Checkbox';
import TextField from '@material-ui/core/TextField';
import Tooltip from '@material-ui/core/Tooltip';
import FolderIcon from '@material-ui/icons/Folder';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import Divider from '@material-ui/core/Divider';
import Grid from '@material-ui/core/Grid';
import IconButton from '@material-ui/core/IconButton';
import InputAdornment from '@material-ui/core/InputAdornment';
import Typography from '@material-ui/core/Typography';
import AddIcon from '@material-ui/icons/Add';
import AppsIcon from '@material-ui/icons/Apps';
import BuildIcon from '@material-ui/icons/Build';
import CategoryIcon from '@material-ui/icons/Category';
import CloseIcon from '@material-ui/icons/Close';
import CloudIcon from '@material-ui/icons/Cloud';
import CodeIcon from '@material-ui/icons/Code';
import DescriptionIcon from '@material-ui/icons/Description';
import EmojiEmotionsIcon from '@material-ui/icons/EmojiEmotions';
import ExtensionIcon from '@material-ui/icons/Extension';
import GroupIcon from '@material-ui/icons/Group';
import HistoryIcon from '@material-ui/icons/History';
import MenuBookIcon from '@material-ui/icons/MenuBook';
import NotificationsIcon from '@material-ui/icons/Notifications';
import SearchIcon from '@material-ui/icons/Search';
import SettingsIcon from '@material-ui/icons/Settings';
import StarIcon from '@material-ui/icons/Star';
import TrendingUpIcon from '@material-ui/icons/TrendingUp';
import TuneIcon from '@material-ui/icons/Tune';
import { Content, Page } from '@backstage/core-components';
import { identityApiRef, useApi } from '@backstage/core-plugin-api';
import { SearchBarBase } from '@backstage/plugin-search-react';
import {
  HomePageRandomJoke,
  HomePageStarredEntities,
} from '@backstage/plugin-home';
import { TopVisitedChart } from './TopVisitedChart';
import { RecentlyVisitedTimeline } from './RecentlyVisitedTimeline';
import { CatalogStatsWidget } from './CatalogStatsWidget';

// --- Registro de widgets ---

type WidgetId =
  | 'starred-entities'
  | 'catalog-stats'
  | 'random-joke'
  | 'top-visited'
  | 'recently-visited';

type ItemDef = {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  iconColor: string;
  bgColor: string;
};

const WIDGET_REGISTRY: ItemDef[] = [
  {
    id: 'starred-entities',
    title: 'Favoritos',
    description: 'Seus itens favoritos do catálogo',
    icon: <StarIcon />,
    iconColor: '#f57f17',
    bgColor: '#fff8e1',
  },
  {
    id: 'top-visited',
    title: 'Mais Visitados',
    description: 'Páginas mais acessadas por você',
    icon: <TrendingUpIcon />,
    iconColor: '#2e7d32',
    bgColor: '#e8f5e9',
  },
  {
    id: 'recently-visited',
    title: 'Visitados Recentemente',
    description: 'Seu histórico de navegação',
    icon: <HistoryIcon />,
    iconColor: '#6a1b9a',
    bgColor: '#f3e5f5',
  },
  {
    id: 'catalog-stats',
    title: 'Visão do Catálogo',
    description: 'Contagem de entidades por tipo',
    icon: <AppsIcon />,
    iconColor: '#0277bd',
    bgColor: '#e1f5fe',
  },
  {
    id: 'random-joke',
    title: 'Piada Aleatória',
    description: 'Uma piada divertida de programação',
    icon: <EmojiEmotionsIcon />,
    iconColor: '#558b2f',
    bgColor: '#f1f8e9',
  },
];

const DEFAULT_WIDGETS: WidgetId[] = [
  'starred-entities',
  'top-visited',
  'recently-visited',
];

const WIDGET_KEY = 'backstage-home-widgets';
const WIDGET_VALID = new Set<string>(WIDGET_REGISTRY.map(w => w.id));

function loadWidgets(): WidgetId[] {
  try {
    const saved = localStorage.getItem(WIDGET_KEY);
    if (!saved) return DEFAULT_WIDGETS;
    const parsed: string[] = JSON.parse(saved);
    const filtered = parsed.filter(id => WIDGET_VALID.has(id)) as WidgetId[];
    return filtered.length > 0 ? filtered : DEFAULT_WIDGETS;
  } catch {
    return DEFAULT_WIDGETS;
  }
}

function saveWidgets(ids: WidgetId[]) {
  localStorage.setItem(WIDGET_KEY, JSON.stringify(ids));
}

// --- Registro de ações rápidas ---

type ToolId =
  | 'docs-external'
  | 'catalog'
  | 'templates'
  | 'plugins-external'
  | 'techdocs'
  | 'search'
  | 'apis'
  | 'org'
  | 'kubernetes'
  | 'notifications'
  | 'settings';

type ToolDef = ItemDef & {
  id: ToolId;
  url: string;
  external?: boolean;
};

const TOOL_REGISTRY: ToolDef[] = [
  {
    id: 'docs-external',
    title: 'Documentação',
    description: 'Guias, tutoriais e referências da plataforma',
    url: 'https://backstage.io/docs',
    icon: <MenuBookIcon fontSize="large" />,
    iconColor: '#1565c0',
    bgColor: '#e3f2fd',
    external: true,
  },
  {
    id: 'catalog',
    title: 'Catálogo',
    description: 'Explore componentes, APIs e serviços',
    url: '/catalog',
    icon: <CategoryIcon fontSize="large" />,
    iconColor: '#2e7d32',
    bgColor: '#e8f5e9',
  },
  {
    id: 'templates',
    title: 'Templates',
    description: 'Crie novos serviços a partir de templates',
    url: '/create',
    icon: <BuildIcon fontSize="large" />,
    iconColor: '#e65100',
    bgColor: '#fff3e0',
  },
  {
    id: 'plugins-external',
    title: 'Plugins',
    description: 'Descubra extensões para o seu portal',
    url: 'https://backstage.io/plugins',
    icon: <ExtensionIcon fontSize="large" />,
    iconColor: '#6a1b9a',
    bgColor: '#f3e5f5',
    external: true,
  },
  {
    id: 'techdocs',
    title: 'TechDocs',
    description: 'Documentação técnica dos seus serviços',
    url: '/docs',
    icon: <DescriptionIcon fontSize="large" />,
    iconColor: '#00695c',
    bgColor: '#e0f2f1',
  },
  {
    id: 'search',
    title: 'Busca',
    description: 'Busca avançada em todo o portal',
    url: '/search',
    icon: <SearchIcon fontSize="large" />,
    iconColor: '#37474f',
    bgColor: '#eceff1',
  },
  {
    id: 'apis',
    title: 'APIs',
    description: 'Explore as APIs disponíveis no catálogo',
    url: '/catalog?filters%5Bkind%5D=api',
    icon: <CodeIcon fontSize="large" />,
    iconColor: '#4527a0',
    bgColor: '#ede7f6',
  },
  {
    id: 'org',
    title: 'Organograma',
    description: 'Visualize a estrutura da organização',
    url: '/org',
    icon: <GroupIcon fontSize="large" />,
    iconColor: '#558b2f',
    bgColor: '#f1f8e9',
  },
  {
    id: 'kubernetes',
    title: 'Kubernetes',
    description: 'Monitore workloads no cluster',
    url: '/kubernetes',
    icon: <CloudIcon fontSize="large" />,
    iconColor: '#0277bd',
    bgColor: '#e1f5fe',
  },
  {
    id: 'notifications',
    title: 'Notificações',
    description: 'Alertas e notificações do sistema',
    url: '/notifications',
    icon: <NotificationsIcon fontSize="large" />,
    iconColor: '#c62828',
    bgColor: '#ffebee',
  },
  {
    id: 'settings',
    title: 'Configurações',
    description: 'Preferências da sua conta',
    url: '/settings',
    icon: <SettingsIcon fontSize="large" />,
    iconColor: '#546e7a',
    bgColor: '#eceff1',
  },
];

const DEFAULT_TOOLS: ToolId[] = [
  'docs-external',
  'catalog',
  'templates',
  'plugins-external',
];

const TOOL_VALID = new Set<string>(TOOL_REGISTRY.map(t => t.id));

// --- Group-aware layout ---

type ToolGroup = {
  id: string;
  name: string;
  items: ToolId[];
};

type ToolLayout = {
  ungrouped: ToolId[];
  groups: ToolGroup[];
};

const DEFAULT_LAYOUT: ToolLayout = { ungrouped: DEFAULT_TOOLS, groups: [] };
const LAYOUT_KEY = 'backstage-home-layout-v2';
const LEGACY_TOOL_KEY = 'backstage-home-tools';

function allLayoutTools(layout: ToolLayout): ToolId[] {
  return [...layout.ungrouped, ...layout.groups.flatMap(g => g.items)];
}

function loadLayout(): ToolLayout {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ToolLayout;
      if (Array.isArray(parsed.ungrouped) && Array.isArray(parsed.groups)) return parsed;
    }
    // migrate from legacy key
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

// --- Estilos ---

const useStyles = makeStyles(theme => ({
  hero: {
    position: 'relative',
    overflow: 'hidden',
    background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
    color: theme.palette.primary.contrastText,
    borderRadius: theme.shape.borderRadius * 3,
    padding: theme.spacing(5, 4, 4),
    marginBottom: theme.spacing(3),
    boxShadow: theme.shadows[4],
    '&::before': {
      content: '""',
      position: 'absolute',
      top: -100,
      right: -60,
      width: 340,
      height: 340,
      borderRadius: '50%',
      background: 'radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 65%)',
      pointerEvents: 'none',
    },
    '&::after': {
      content: '""',
      position: 'absolute',
      bottom: -80,
      left: -50,
      width: 260,
      height: 260,
      borderRadius: '50%',
      background: 'radial-gradient(circle, rgba(255,255,255,0.07) 0%, transparent 65%)',
      pointerEvents: 'none',
    },
  },
  heroGreeting: {
    position: 'relative',
    zIndex: 1,
    fontWeight: 400,
    fontSize: '0.8rem',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    opacity: 0.6,
    marginBottom: theme.spacing(1),
  },
  heroName: {
    position: 'relative',
    zIndex: 1,
    fontWeight: 700,
    lineHeight: 1.1,
  },
  searchSection: {
    display: 'flex',
    justifyContent: 'center',
    padding: theme.spacing(3, 0, 4),
  },
  searchInner: {
    width: '100%',
    maxWidth: 820,
    background: theme.palette.background.paper,
    borderRadius: theme.shape.borderRadius * 6,
    boxShadow: theme.shadows[3],
    transition: 'box-shadow 0.2s',
    '&:focus-within': {
      boxShadow: theme.shadows[8],
    },
    '& .MuiInputBase-root': {
      borderRadius: theme.shape.borderRadius * 6,
      padding: theme.spacing(0, 1),
      fontSize: '0.95rem',
      height: 44,
    },
    '& .MuiOutlinedInput-notchedOutline, & fieldset': {
      border: 'none',
    },
    '& .MuiInputBase-input': {
      padding: theme.spacing(0, 0.5),
    },
  },
  customizeBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing(3),
    padding: theme.spacing(1.25, 2),
    borderRadius: theme.shape.borderRadius * 2,
    border: `1px dashed ${theme.palette.divider}`,
    background: theme.palette.background.paper,
  },
  sectionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    marginBottom: theme.spacing(2),
    marginTop: theme.spacing(3),
  },
  sectionLabel: {
    fontWeight: 700,
    letterSpacing: '0.1em',
    color: theme.palette.text.secondary,
    whiteSpace: 'nowrap',
  },
  sectionDivider: {
    flex: 1,
  },
  cardWrap: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    '& .MuiCard-root, & .MuiPaper-root': {
      flex: '1 1 0%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    },
    '& .MuiCardContent-root': {
      flex: '1 1 0%',
      minHeight: 0,
      overflowY: 'auto',
    },
  },
  // ── Edit mode ──────────────────────────────────────────────────────────
  '@keyframes iconWiggle': {
    '0%, 100%': { transform: 'rotate(-2.5deg)' },
    '50%':       { transform: 'rotate(2.5deg)'  },
  },
  iconCell: {
    position: 'relative' as const,
    display: 'inline-flex',
  },
  iconCellWiggle: {
    animation: '$iconWiggle 0.18s ease-in-out infinite',
    transformOrigin: '50% 28%',
  },
  editBadge: {
    position: 'absolute' as const,
    top: 2,
    right: 2,
    width: 20,
    height: 20,
    borderRadius: '50%',
    backgroundColor: theme.palette.error.main,
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    zIndex: 20,
    border: `2.5px solid ${theme.palette.background.paper}`,
    boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
    transition: 'transform 0.1s',
    '&:hover': { transform: 'scale(1.2)' },
    '& svg': { fontSize: '0.6rem' },
  },
  // ── Grid ───────────────────────────────────────────────────────────────
  actionsGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1.5),
    padding: theme.spacing(0.5, 0, 1),
  },
  addGroupCell: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    cursor: 'pointer',
    width: 90,
    padding: theme.spacing(1, 0.5),
    borderRadius: theme.shape.borderRadius * 2,
    transition: 'background-color 0.15s',
    userSelect: 'none',
    background: 'none',
    border: 'none',
    '&:hover': { backgroundColor: theme.palette.action.hover },
    '&:hover $addGroupIcon': {
      borderColor: theme.palette.primary.main,
      '& .MuiSvgIcon-root': { color: theme.palette.primary.main },
    },
  },
  addGroupIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: `2px dashed ${theme.palette.divider}`,
    transition: 'border-color 0.15s',
    '& .MuiSvgIcon-root': { fontSize: '1.6rem', color: theme.palette.text.disabled, transition: 'color 0.15s' },
  },
  addGroupLabel: {
    fontSize: '0.72rem',
    fontWeight: 600,
    textAlign: 'center',
    color: theme.palette.text.secondary,
    maxWidth: 84,
  },
  actionItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    textDecoration: 'none',
    color: 'inherit',
    width: 90,
    padding: theme.spacing(1, 0.5),
    borderRadius: theme.shape.borderRadius * 2,
    transition: 'background-color 0.15s, opacity 0.15s',
    cursor: 'grab',
    userSelect: 'none',
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
    '&:active': { cursor: 'grabbing' },
  },
  actionItemDragging: {
    opacity: 0.35,
    transform: 'scale(0.95)',
    cursor: 'grabbing',
  },
  actionItemDragOver: {
    backgroundColor: `${theme.palette.primary.main}18`,
    outline: `2px dashed ${theme.palette.primary.main}`,
    outlineOffset: 3,
    borderRadius: theme.shape.borderRadius * 2,
    transform: 'scale(1.06)',
  },
  actionIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 16,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
    transition: 'box-shadow 0.15s',
    '& .MuiSvgIcon-root': { fontSize: '1.6rem' },
    '$actionItem:hover &': { boxShadow: '0 4px 14px rgba(0,0,0,0.18)' },
  },
  actionLabel: {
    fontSize: '0.72rem',
    fontWeight: 600,
    textAlign: 'center',
    lineHeight: 1.25,
    maxWidth: 84,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  folderIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 16,
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gridTemplateRows: '1fr 1fr',
    padding: 7,
    gap: 3,
    backgroundColor: theme.palette.action.selected,
    boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
    transition: 'box-shadow 0.15s',
  },
  folderMiniIcon: {
    borderRadius: 5,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    '& svg': { width: 13, height: 13, flexShrink: 0 },
  },
  groupItemWrap: {
    position: 'relative' as const,
    display: 'inline-flex',
    '&:hover $groupRemoveBtn': { opacity: 1 },
  },
  groupRemoveBtn: {
    position: 'absolute' as const,
    top: -4,
    right: -2,
    width: 20,
    height: 20,
    minWidth: 0,
    padding: 0,
    borderRadius: '50%',
    backgroundColor: theme.palette.error.main,
    color: '#fff',
    opacity: 0,
    transition: 'opacity 0.15s',
    zIndex: 10,
    '&:hover': { backgroundColor: theme.palette.error.dark, opacity: 1 },
    '& .MuiSvgIcon-root': { fontSize: '0.72rem' },
  },
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
    background: `${theme.palette.primary.main}08`,
    transition: 'border-color 0.15s, box-shadow 0.15s',
    '&:hover': { boxShadow: theme.shadows[3] },
  },
  selectCardBody: {
    padding: theme.spacing(2),
  },
  selectCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing(1),
  },
  selectIconCircle: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
}));

// --- Utilitários ---

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

// --- Sub-componentes ---

const SectionHeader = ({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) => {
  const classes = useStyles();
  return (
    <Box className={classes.sectionRow}>
      <Typography variant="overline" className={classes.sectionLabel}>
        {title}
      </Typography>
      <Divider className={classes.sectionDivider} />
      {action}
    </Box>
  );
};

const ActionIcon = ({
  tool,
  isDragging,
  isDragOver,
  isEditMode = false,
  editDelay = 0,
  onRemove,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  tool: ToolDef;
  isDragging: boolean;
  isDragOver: boolean;
  isEditMode?: boolean;
  editDelay?: number;
  onRemove?: () => void;
  onDragStart: (e: React.DragEvent<HTMLAnchorElement>) => void;
  onDragOver: (e: React.DragEvent<HTMLAnchorElement>) => void;
  onDrop: (e: React.DragEvent<HTMLAnchorElement>) => void;
  onDragEnd: () => void;
}) => {
  const classes = useStyles();
  const cls = [
    classes.actionItem,
    isDragging ? classes.actionItemDragging : '',
    isDragOver ? classes.actionItemDragOver : '',
  ].filter(Boolean).join(' ');

  const cellCls = [
    classes.iconCell,
    isEditMode && !isDragging ? classes.iconCellWiggle : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={cellCls} style={{ animationDelay: `${editDelay}s` }}>
      <Tooltip
        title={
          isEditMode ? '' : (
            <Box>
              <Typography style={{ fontWeight: 700, fontSize: '0.8rem' }}>{tool.title}</Typography>
              <Typography style={{ fontSize: '0.73rem', opacity: 0.88, marginTop: 2 }}>{tool.description}</Typography>
            </Box>
          )
        }
        placement="top"
        arrow
        disableFocusListener={isDragging || isEditMode}
        disableHoverListener={isDragging || isEditMode}
      >
        <a
          className={cls}
          href={tool.url}
          target={tool.external ? '_blank' : '_self'}
          rel={tool.external ? 'noopener noreferrer' : undefined}
          draggable
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onDragEnd={onDragEnd}
        >
          <Box className={classes.actionIconWrap} style={{ backgroundColor: tool.bgColor }}>
            <Box style={{ color: tool.iconColor, display: 'flex' }}>{tool.icon}</Box>
          </Box>
          <Typography className={classes.actionLabel}>{tool.title}</Typography>
        </a>
      </Tooltip>
      {isEditMode && (
        <div
          className={classes.editBadge}
          role="button"
          tabIndex={0}
          aria-label="remover"
          onClick={e => { e.preventDefault(); e.stopPropagation(); onRemove?.(); }}
          onKeyDown={e => { if (e.key === 'Enter') onRemove?.(); }}
        >
          <CloseIcon />
        </div>
      )}
    </div>
  );
};

// --- Group folder tile ---

const GroupFolder = ({
  group,
  isDragOver,
  isEditMode = false,
  editDelay = 0,
  onRemove,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onClick,
}: {
  group: ToolGroup;
  isDragOver: boolean;
  isEditMode?: boolean;
  editDelay?: number;
  onRemove?: () => void;
  onDragStart: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onClick: () => void;
}) => {
  const classes = useStyles();
  const preview = group.items
    .slice(0, 4)
    .map(id => TOOL_REGISTRY.find(t => t.id === id))
    .filter((t): t is ToolDef => !!t);

  const cellCls = [
    classes.iconCell,
    isEditMode ? classes.iconCellWiggle : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={cellCls} style={{ animationDelay: `${editDelay}s` }}>
      <Tooltip
        title={
          isEditMode ? '' : (
            <Box>
              <Typography style={{ fontWeight: 700, fontSize: '0.8rem' }}>{group.name}</Typography>
              <Typography style={{ fontSize: '0.73rem', opacity: 0.88, marginTop: 2 }}>
                {group.items.length} {group.items.length === 1 ? 'ação' : 'ações'}
              </Typography>
            </Box>
          )
        }
        placement="top"
        arrow
        disableHoverListener={isEditMode}
      >
        <div
          className={`${classes.actionItem} ${isDragOver ? classes.actionItemDragOver : ''}`}
          style={{ cursor: isEditMode ? 'grab' : 'pointer' }}
          draggable
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onDragEnd={onDragEnd}
          onClick={onClick}
          role="button"
          tabIndex={0}
          onKeyDown={e => { if (e.key === 'Enter') onClick(); }}
        >
          <Box className={classes.folderIconWrap}>
            {preview.length === 0 ? (
              <FolderIcon style={{ fontSize: 28, color: '#90a4ae', gridColumn: '1 / span 2', gridRow: '1 / span 2', alignSelf: 'center', justifySelf: 'center' }} />
            ) : (
              Array.from({ length: 4 }).map((_, i) => {
                const t = preview[i];
                return (
                  <Box
                    key={i}
                    className={classes.folderMiniIcon}
                    style={{ backgroundColor: t ? t.bgColor : 'rgba(255,255,255,0.12)' }}
                  >
                    {t && <Box style={{ color: t.iconColor, display: 'flex', lineHeight: 0 }}>{t.icon}</Box>}
                  </Box>
                );
              })
            )}
          </Box>
          <Typography className={classes.actionLabel}>{group.name}</Typography>
        </div>
      </Tooltip>
      {isEditMode && (
        <div
          className={classes.editBadge}
          role="button"
          tabIndex={0}
          aria-label="excluir grupo"
          onClick={e => { e.stopPropagation(); onRemove?.(); }}
          onKeyDown={e => { if (e.key === 'Enter') onRemove?.(); }}
        >
          <CloseIcon />
        </div>
      )}
    </div>
  );
};

// --- Group detail dialog ---

const GroupDialog = ({
  group,
  open,
  onClose,
  onSave,
  onDelete,
}: {
  group: ToolGroup;
  open: boolean;
  onClose: () => void;
  onSave: (updated: ToolGroup) => void;
  onDelete: () => void;
}) => {
  const classes = useStyles();
  const [name, setName] = useState(group.name);
  const [items, setItems] = useState<ToolId[]>(group.items);
  const [localDragId, setLocalDragId] = useState<ToolId | null>(null);
  const [localDragOverId, setLocalDragOverId] = useState<ToolId | null>(null);

  // sync when group prop changes (e.g. item added externally)
  useEffect(() => { setName(group.name); setItems(group.items); }, [group]);

  const commit = () => onSave({ ...group, name: name.trim() || group.name, items });

  const removeItem = (id: ToolId) => setItems(prev => prev.filter(t => t !== id));

  const lDragStart = (e: React.DragEvent, id: ToolId) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
    setLocalDragId(id);
  };
  const lDragOver = (e: React.DragEvent, id: ToolId) => {
    e.preventDefault();
    if (id !== localDragId) setLocalDragOverId(id);
  };
  const lDrop = (e: React.DragEvent, targetId: ToolId) => {
    e.preventDefault();
    if (!localDragId || localDragId === targetId) { setLocalDragId(null); setLocalDragOverId(null); return; }
    setItems(prev => {
      const from = prev.indexOf(localDragId);
      const to = prev.indexOf(targetId);
      if (from === -1 || to === -1) return prev;
      const next = [...prev];
      next.splice(from, 1);
      next.splice(to, 0, localDragId);
      return next;
    });
    setLocalDragId(null);
    setLocalDragOverId(null);
  };
  const lDragEnd = () => { setLocalDragId(null); setLocalDragOverId(null); };

  return (
    <Dialog open={open} onClose={() => { commit(); onClose(); }} maxWidth="xs" fullWidth>
      <DialogTitle>
        <Box style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FolderIcon color="action" fontSize="small" />
          <Box flex={1}>
            <TextField
              value={name}
              onChange={e => setName(e.target.value)}
              fullWidth
              variant="standard"
              InputProps={{ disableUnderline: false, style: { fontWeight: 700, fontSize: '1.1rem' } }}
              inputProps={{ 'aria-label': 'nome do grupo' }}
            />
          </Box>
          <IconButton size="small" onClick={() => { commit(); onClose(); }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        <Typography variant="caption" color="textSecondary" style={{ display: 'block', marginBottom: 12 }}>
          Arraste para reordenar · clique em × para remover do grupo
        </Typography>
        {items.length === 0 ? (
          <Typography variant="body2" color="textSecondary" align="center" style={{ padding: '24px 0' }}>
            Grupo vazio. Arraste ações rápidas para cá.
          </Typography>
        ) : (
          <Box className={classes.actionsGrid}>
            {items.map(id => {
              const tool = TOOL_REGISTRY.find(t => t.id === id);
              if (!tool) return null;
              return (
                <Box key={id} className={classes.groupItemWrap}>
                  <ActionIcon
                    tool={tool}
                    isDragging={localDragId === id}
                    isDragOver={localDragOverId === id}
                    onDragStart={e => lDragStart(e, id)}
                    onDragOver={e => lDragOver(e, id)}
                    onDrop={e => lDrop(e, id)}
                    onDragEnd={lDragEnd}
                  />
                  <IconButton className={classes.groupRemoveBtn} size="small" onClick={() => removeItem(id)}>
                    <CloseIcon />
                  </IconButton>
                </Box>
              );
            })}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button size="small" style={{ color: '#c62828' }} onClick={onDelete}>
          Excluir grupo
        </Button>
        <Box flex={1} />
        <Button size="small" onClick={() => { commit(); onClose(); }} variant="contained" color="primary">
          Salvar
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// --- Create group dialog ---

const CreateGroupDialog = ({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
}) => {
  const [name, setName] = useState('');
  const submit = () => { if (name.trim()) { onCreate(name.trim()); setName(''); onClose(); } };
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Criar grupo</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          label="Nome do grupo"
          value={name}
          onChange={e => setName(e.target.value)}
          fullWidth
          variant="outlined"
          size="small"
          onKeyDown={e => { if (e.key === 'Enter') submit(); }}
        />
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

const SelectableCard = ({
  item,
  active,
  onToggle,
}: {
  item: ItemDef;
  active: boolean;
  onToggle: () => void;
}) => {
  const classes = useStyles();
  return (
    <Card
      className={active ? classes.selectCardActive : classes.selectCard}
      elevation={0}
      onClick={onToggle}
    >
      <Box className={classes.selectCardBody}>
        <Box className={classes.selectCardHeader}>
          <Box
            className={classes.selectIconCircle}
            style={{ backgroundColor: item.bgColor }}
          >
            <Box style={{ color: item.iconColor, display: 'flex', fontSize: 20 }}>
              {item.icon}
            </Box>
          </Box>
          <Checkbox
            checked={active}
            color="primary"
            size="small"
            onClick={e => e.stopPropagation()}
            onChange={onToggle}
          />
        </Box>
        <Typography variant="subtitle2" style={{ fontWeight: 700 }}>
          {item.title}
        </Typography>
        <Typography variant="caption" color="textSecondary">
          {item.description}
        </Typography>
      </Box>
    </Card>
  );
};

const WidgetDialog = ({
  open,
  onClose,
  enabled,
  onToggle,
  onReset,
}: {
  open: boolean;
  onClose: () => void;
  enabled: WidgetId[];
  onToggle: (id: WidgetId) => void;
  onReset: () => void;
}) => (
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
      <Button onClick={onReset} size="small">
        Restaurar padrões
      </Button>
      <Box flex={1} />
      <Button onClick={onClose} variant="contained" color="primary">
        Concluir
      </Button>
    </DialogActions>
  </Dialog>
);

const ToolDialog = ({
  open,
  onClose,
  enabled,
  onToggle,
  onReset,
}: {
  open: boolean;
  onClose: () => void;
  enabled: ToolId[];
  onToggle: (id: ToolId) => void;
  onReset: () => void;
}) => (
  <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
    <DialogTitle>Personalizar ações rápidas</DialogTitle>
    <DialogContent dividers>
      <Typography variant="body2" color="textSecondary" style={{ marginBottom: 16 }}>
        Escolha quais atalhos aparecem em Ações Rápidas. As alterações são salvas automaticamente.
      </Typography>
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
      <Button onClick={onReset} size="small">
        Restaurar padrões
      </Button>
      <Box flex={1} />
      <Button onClick={onClose} variant="contained" color="primary">
        Concluir
      </Button>
    </DialogActions>
  </Dialog>
);

// --- Página principal ---

export const HomePage = () => {
  const classes = useStyles();
  const identityApi = useApi(identityApiRef);

  const [displayName, setDisplayName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [widgetDialogOpen, setWidgetDialogOpen] = useState(false);
  const [toolDialogOpen, setToolDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const [enabledWidgets, setEnabledWidgets] = useState<WidgetId[]>(loadWidgets);
  const [layout, setLayout] = useState<ToolLayout>(loadLayout);
  const [dragId, setDragId] = useState<string | null>(null);   // ToolId or 'group:<id>'
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  useEffect(() => {
    identityApi.getProfileInfo().then(({ displayName: name }) => {
      setDisplayName(name ?? '');
    });
  }, [identityApi]);

  const toggleWidget = (id: WidgetId) => {
    setEnabledWidgets(prev => {
      const next = prev.includes(id) ? prev.filter(w => w !== id) : [...prev, id];
      saveWidgets(next);
      return next;
    });
  };

  const resetWidgets = () => {
    setEnabledWidgets(DEFAULT_WIDGETS);
    saveWidgets(DEFAULT_WIDGETS);
  };

  const updateLayout = (next: ToolLayout) => { setLayout(next); saveLayout(next); };

  const toggleTool = (id: ToolId) => {
    setLayout(prev => {
      const all = allLayoutTools(prev);
      let next: ToolLayout;
      if (all.includes(id)) {
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

  const resetTools = () => updateLayout(DEFAULT_LAYOUT);

  const createGroup = (name: string) => {
    const next: ToolLayout = {
      ...layout,
      groups: [...layout.groups, { id: generateGroupId(), name, items: [] }],
    };
    updateLayout(next);
    setCreateGroupOpen(false);
  };

  const saveGroup = (updated: ToolGroup) => {
    const next: ToolLayout = {
      ...layout,
      groups: layout.groups.map(g => g.id === updated.id ? updated : g),
    };
    updateLayout(next);
  };

  const deleteGroup = (groupId: string) => {
    const group = layout.groups.find(g => g.id === groupId);
    const next: ToolLayout = {
      ungrouped: [...layout.ungrouped, ...(group?.items ?? [])],
      groups: layout.groups.filter(g => g.id !== groupId),
    };
    updateLayout(next);
    setOpenGroupId(null);
  };

  // Drag & drop ─────────────────────────────────────────────────────────────
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
    setDragId(id);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
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

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const srcId = dragId;
    if (!srcId || srcId === targetId) { setDragId(null); setDragOverId(null); return; }

    const dragIsGroup = srcId.startsWith('group:');
    const targetIsGroup = targetId.startsWith('group:');
    let newGroupToOpen: string | null = null;

    setLayout(prev => {
      const next: ToolLayout = {
        ungrouped: [...prev.ungrouped],
        groups: prev.groups.map(g => ({ ...g, items: [...g.items] })),
      };

      if (!dragIsGroup && targetIsGroup) {
        // Drag tool → folder: add to group (max 4 items)
        const gId = targetId.slice(6);
        const targetGroup = next.groups.find(g => g.id === gId);
        if (!targetGroup || targetGroup.items.length >= 4) return prev;
        next.ungrouped = next.ungrouped.filter(t => t !== srcId);
        next.groups = next.groups.map(g =>
          g.id === gId && !g.items.includes(srcId as ToolId)
            ? { ...g, items: [...g.items, srcId as ToolId] }
            : g,
        );
      } else if (!dragIsGroup && !targetIsGroup) {
        if (isEditMode) {
          // Edit mode: drag icon onto icon → create group with both
          const gId = generateGroupId();
          newGroupToOpen = gId;
          next.ungrouped = next.ungrouped.filter(t => t !== srcId && t !== targetId);
          next.groups = [...next.groups, {
            id: gId,
            name: 'Novo Grupo',
            items: [srcId as ToolId, targetId as ToolId],
          }];
        } else {
          // Normal mode: reorder ungrouped
          const from = next.ungrouped.indexOf(srcId as ToolId);
          const to   = next.ungrouped.indexOf(targetId as ToolId);
          if (from !== -1 && to !== -1) {
            next.ungrouped.splice(from, 1);
            next.ungrouped.splice(to, 0, srcId as ToolId);
          }
        }
      } else if (dragIsGroup && targetIsGroup) {
        // Reorder groups
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

  const handleDragEnd = () => { setDragId(null); setDragOverId(null); };

  const on = (id: WidgetId) => enabledWidgets.includes(id);

  const activeTools = layout.ungrouped
    .map(id => TOOL_REGISTRY.find(t => t.id === id))
    .filter((t): t is ToolDef => !!t);
  const allEnabled = allLayoutTools(layout);
  const activityActive = [on('top-visited'), on('recently-visited')].filter(Boolean).length;
  const hasWorkspace = on('starred-entities') || on('random-joke') || on('catalog-stats');

  return (
    <Page themeId="home">
      <Content>
        {/* Hero */}
        <Box className={classes.hero}>
          <Typography className={classes.heroGreeting}>
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </Typography>
          <Typography variant="h2" className={classes.heroName}>
            {getGreeting()}, {displayName?.split(' ')[0] || 'bem-vindo'}!
          </Typography>
        </Box>

        {/* Busca */}
        <Box className={classes.searchSection}>
          <Box className={classes.searchInner}>
            <SearchBarBase
              value={searchQuery}
              onChange={setSearchQuery}
              onSubmit={() => {
                if (searchQuery.trim())
                  window.location.href = `/search?query=${encodeURIComponent(searchQuery.trim())}`;
              }}
              clearButton={false}
              placeholder="Buscar componentes, APIs, documentação..."
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" color="action" />
                  </InputAdornment>
                ),
                endAdornment: searchQuery ? (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={() => setSearchQuery('')}
                      aria-label="limpar busca"
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : undefined,
              }}
            />
          </Box>
        </Box>

        {/* Barra de personalização */}
        <Box className={classes.customizeBar}>
          <Typography variant="caption" color="textSecondary">
            {enabledWidgets.length}/{WIDGET_REGISTRY.length} widgets &nbsp;·&nbsp;{' '}
            {allEnabled.length}/{TOOL_REGISTRY.length} ações &nbsp;·&nbsp;{' '}
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

        <WidgetDialog
          open={widgetDialogOpen}
          onClose={() => setWidgetDialogOpen(false)}
          enabled={enabledWidgets}
          onToggle={toggleWidget}
          onReset={resetWidgets}
        />

        <ToolDialog
          open={toolDialogOpen}
          onClose={() => setToolDialogOpen(false)}
          enabled={allEnabled}
          onToggle={toggleTool}
          onReset={resetTools}
        />

        <CreateGroupDialog
          open={createGroupOpen}
          onClose={() => setCreateGroupOpen(false)}
          onCreate={createGroup}
        />

        {openGroupId && (() => {
          const grp = layout.groups.find(g => g.id === openGroupId);
          return grp ? (
            <GroupDialog
              group={grp}
              open
              onClose={() => setOpenGroupId(null)}
              onSave={saveGroup}
              onDelete={() => deleteGroup(openGroupId)}
            />
          ) : null;
        })()}

        {/* Ações Rápidas */}
        <SectionHeader
          title="Ações Rápidas"
          action={
            isEditMode ? (
              <Box style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Tooltip title="Personalizar ações" arrow>
                  <IconButton size="small" onClick={() => setToolDialogOpen(true)}>
                    <TuneIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Button
                  size="small"
                  variant="contained"
                  color="primary"
                  onClick={() => setIsEditMode(false)}
                  style={{ fontWeight: 700, minWidth: 0 }}
                >
                  Concluído
                </Button>
              </Box>
            ) : (
              <Box style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Tooltip title="Personalizar ações" arrow>
                  <IconButton size="small" onClick={() => setToolDialogOpen(true)}>
                    <TuneIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Button size="small" onClick={() => setIsEditMode(true)}>
                  Editar
                </Button>
              </Box>
            )
          }
        />
        <Box
          className={classes.actionsGrid}
          onDragOver={e => e.preventDefault()}
          onDrop={() => { setDragId(null); setDragOverId(null); }}
        >
          {activeTools.map((tool, idx) => (
            <ActionIcon
              key={tool.id}
              tool={tool}
              isDragging={dragId === tool.id}
              isDragOver={dragOverId === tool.id}
              isEditMode={isEditMode}
              editDelay={idx * 0.04}
              onRemove={() => toggleTool(tool.id)}
              onDragStart={e => handleDragStart(e, tool.id)}
              onDragOver={e => handleDragOver(e, tool.id)}
              onDrop={e => handleDrop(e, tool.id)}
              onDragEnd={handleDragEnd}
            />
          ))}
          {layout.groups.map((group, idx) => (
            <GroupFolder
              key={group.id}
              group={group}
              isDragOver={dragOverId === `group:${group.id}`}
              isEditMode={isEditMode}
              editDelay={(activeTools.length + idx) * 0.04}
              onRemove={() => deleteGroup(group.id)}
              onDragStart={e => handleDragStart(e, `group:${group.id}`)}
              onDragOver={e => handleDragOver(e, `group:${group.id}`)}
              onDrop={e => handleDrop(e, `group:${group.id}`)}
              onDragEnd={handleDragEnd}
              onClick={() => setOpenGroupId(group.id)}
            />
          ))}
          <Tooltip title="Criar novo grupo" arrow placement="top">
            <button
              className={classes.addGroupCell}
              onClick={() => setCreateGroupOpen(true)}
            >
              <Box className={classes.addGroupIcon}>
                <AddIcon />
              </Box>
              <Typography className={classes.addGroupLabel}>Novo Grupo</Typography>
            </button>
          </Tooltip>
        </Box>

        {/* Meu Espaço */}
        {hasWorkspace && (
          <>
            <SectionHeader title="Meu Espaço" />
            <Grid container spacing={3} alignItems="stretch">
              {on('starred-entities') && (
                <Grid item xs={12} style={{ display: 'flex' }}>
                  <Box className={classes.cardWrap} style={{ minHeight: 300 }}>
                    <HomePageStarredEntities title="Suas Entidades Favoritas" />
                  </Box>
                </Grid>
              )}
              {on('random-joke') && (
                <Grid
                  item
                  xs={12}
                  md={on('catalog-stats') ? 6 : 12}
                  style={{ display: 'flex' }}
                >
                  <Box className={classes.cardWrap} style={{ minHeight: 260 }}>
                    <HomePageRandomJoke />
                  </Box>
                </Grid>
              )}
              {on('catalog-stats') && (
                <Grid
                  item
                  xs={12}
                  md={on('random-joke') ? 6 : 12}
                  style={{ display: 'flex' }}
                >
                  <Box className={classes.cardWrap} style={{ minHeight: 260 }}>
                    <CatalogStatsWidget />
                  </Box>
                </Grid>
              )}
            </Grid>
          </>
        )}

        {/* Atividade Recente */}
        {(on('top-visited') || on('recently-visited')) && (
          <>
            <SectionHeader title="Atividade Recente" />
            <Grid container spacing={3} alignItems="stretch">
              {on('top-visited') && (
                <Grid
                  item
                  xs={12}
                  md={activityActive === 1 ? 12 : 6}
                  style={{ display: 'flex' }}
                >
                  <Box className={classes.cardWrap} style={{ height: 460 }}>
                    <TopVisitedChart />
                  </Box>
                </Grid>
              )}
              {on('recently-visited') && (
                <Grid
                  item
                  xs={12}
                  md={activityActive === 1 ? 12 : 6}
                  style={{ display: 'flex' }}
                >
                  <Box className={classes.cardWrap} style={{ height: 460 }}>
                    <RecentlyVisitedTimeline />
                  </Box>
                </Grid>
              )}
            </Grid>
          </>
        )}
      </Content>
    </Page>
  );
};
