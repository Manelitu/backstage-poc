import { useEffect, useState } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Card from '@material-ui/core/Card';
import Checkbox from '@material-ui/core/Checkbox';
import Tooltip from '@material-ui/core/Tooltip';
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

const TOOL_KEY = 'backstage-home-tools';
const TOOL_VALID = new Set<string>(TOOL_REGISTRY.map(t => t.id));

function loadTools(): ToolId[] {
  try {
    const saved = localStorage.getItem(TOOL_KEY);
    if (!saved) return DEFAULT_TOOLS;
    const parsed: string[] = JSON.parse(saved);
    const filtered = parsed.filter(id => TOOL_VALID.has(id)) as ToolId[];
    return filtered.length > 0 ? filtered : DEFAULT_TOOLS;
  } catch {
    return DEFAULT_TOOLS;
  }
}

function saveTools(ids: ToolId[]) {
  localStorage.setItem(TOOL_KEY, JSON.stringify(ids));
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
  actionsGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1.5),
    padding: theme.spacing(0.5, 0, 1),
  },
  actionItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    textDecoration: 'none',
    color: 'inherit',
    width: 76,
    padding: theme.spacing(1, 0.5),
    borderRadius: theme.shape.borderRadius * 2,
    transition: 'background-color 0.15s, transform 0.15s',
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
      transform: 'translateY(-3px)',
    },
  },
  actionIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 14,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
    transition: 'box-shadow 0.15s',
    '& .MuiSvgIcon-root': { fontSize: '1.4rem' },
    '$actionItem:hover &': { boxShadow: '0 4px 14px rgba(0,0,0,0.18)' },
  },
  actionLabel: {
    fontSize: '0.7rem',
    fontWeight: 600,
    textAlign: 'center',
    lineHeight: 1.25,
    maxWidth: 70,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
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

const ActionIcon = ({ tool }: { tool: ToolDef }) => {
  const classes = useStyles();
  return (
    <Tooltip
      title={
        <Box>
          <Typography style={{ fontWeight: 700, fontSize: '0.8rem' }}>
            {tool.title}
          </Typography>
          <Typography style={{ fontSize: '0.73rem', opacity: 0.88, marginTop: 2 }}>
            {tool.description}
          </Typography>
        </Box>
      }
      placement="top"
      arrow
    >
      <a
        className={classes.actionItem}
        href={tool.url}
        target={tool.external ? '_blank' : '_self'}
        rel={tool.external ? 'noopener noreferrer' : undefined}
      >
        <Box
          className={classes.actionIconWrap}
          style={{ backgroundColor: tool.bgColor }}
        >
          <Box style={{ color: tool.iconColor, display: 'flex' }}>
            {tool.icon}
          </Box>
        </Box>
        <Typography className={classes.actionLabel}>{tool.title}</Typography>
      </a>
    </Tooltip>
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
  const [enabledWidgets, setEnabledWidgets] = useState<WidgetId[]>(loadWidgets);
  const [enabledTools, setEnabledTools] = useState<ToolId[]>(loadTools);

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

  const toggleTool = (id: ToolId) => {
    setEnabledTools(prev => {
      const next = prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id];
      saveTools(next);
      return next;
    });
  };

  const resetTools = () => {
    setEnabledTools(DEFAULT_TOOLS);
    saveTools(DEFAULT_TOOLS);
  };

  const on = (id: WidgetId) => enabledWidgets.includes(id);

  const activeTools = TOOL_REGISTRY.filter(t => enabledTools.includes(t.id));
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
            {enabledTools.length}/{TOOL_REGISTRY.length} ações ativas
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
          enabled={enabledTools}
          onToggle={toggleTool}
          onReset={resetTools}
        />

        {/* Ações Rápidas */}
        <SectionHeader
          title="Ações Rápidas"
          action={
            <IconButton
              size="small"
              onClick={() => setToolDialogOpen(true)}
              title="Personalizar ações rápidas"
            >
              <TuneIcon fontSize="small" />
            </IconButton>
          }
        />
        <Box className={classes.actionsGrid}>
          {activeTools.map(tool => (
            <ActionIcon key={tool.id} tool={tool} />
          ))}
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
