import { useEffect, useState } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Box from '@material-ui/core/Box';
import Card from '@material-ui/core/Card';
import CardActionArea from '@material-ui/core/CardActionArea';
import Divider from '@material-ui/core/Divider';
import Grid from '@material-ui/core/Grid';
import Typography from '@material-ui/core/Typography';
import BuildIcon from '@material-ui/icons/Build';
import CategoryIcon from '@material-ui/icons/Category';
import ExtensionIcon from '@material-ui/icons/Extension';
import MenuBookIcon from '@material-ui/icons/MenuBook';
import { Content, Page } from '@backstage/core-components';
import { identityApiRef, useApi } from '@backstage/core-plugin-api';
import { HomePageSearchBar } from '@backstage/plugin-search';
import {
  HomePageRandomJoke,
  HomePageRecentlyVisited,
  HomePageStarredEntities,
  HomePageTopVisited,
} from '@backstage/plugin-home';

// ─── Types ──────────────────────────────────────────────────────────────────

type ToolItem = {
  label: string;
  description: string;
  url: string;
  icon: React.ReactNode;
  iconColor: string;
  bgColor: string;
  external?: boolean;
};

// ─── Data ───────────────────────────────────────────────────────────────────

const tools: ToolItem[] = [
  {
    label: 'Documentação',
    description: 'Guias, tutoriais e referências da plataforma',
    url: 'https://backstage.io/docs',
    icon: <MenuBookIcon fontSize="large" />,
    iconColor: '#1565c0',
    bgColor: '#e3f2fd',
    external: true,
  },
  {
    label: 'Catálogo',
    description: 'Explore componentes, APIs e serviços',
    url: '/catalog',
    icon: <CategoryIcon fontSize="large" />,
    iconColor: '#2e7d32',
    bgColor: '#e8f5e9',
  },
  {
    label: 'Templates',
    description: 'Crie novos serviços a partir de templates',
    url: '/create',
    icon: <BuildIcon fontSize="large" />,
    iconColor: '#e65100',
    bgColor: '#fff3e0',
  },
  {
    label: 'Plugins',
    description: 'Descubra extensões para o seu portal',
    url: 'https://backstage.io/plugins',
    icon: <ExtensionIcon fontSize="large" />,
    iconColor: '#6a1b9a',
    bgColor: '#f3e5f5',
    external: true,
  },
];

// ─── Styles ──────────────────────────────────────────────────────────────────

const useStyles = makeStyles(theme => ({
  hero: {
    background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
    color: theme.palette.primary.contrastText,
    borderRadius: theme.shape.borderRadius * 3,
    padding: theme.spacing(5, 4, 4),
    marginBottom: theme.spacing(5),
  },
  heroGreeting: {
    fontWeight: 300,
    opacity: 0.85,
    marginBottom: theme.spacing(0.5),
  },
  heroName: {
    fontWeight: 700,
    lineHeight: 1.1,
  },
  searchSection: {
    display: 'flex',
    justifyContent: 'center',
    margin: theme.spacing(-3, 0, 2),
  },
  searchInner: {
    width: '100%',
    maxWidth: 640,
    background: theme.palette.background.paper,
    borderRadius: theme.shape.borderRadius * 6,
    boxShadow: theme.shadows[3],
    padding: theme.spacing(0.5, 1),
    transition: 'box-shadow 0.2s',
    '&:focus-within': {
      boxShadow: theme.shadows[8],
    },
    '& .MuiInputBase-root': {
      borderRadius: theme.shape.borderRadius * 6,
      padding: theme.spacing(0.5, 1),
      fontSize: '1rem',
    },
    '& .MuiOutlinedInput-notchedOutline, & fieldset': {
      border: 'none',
    },
  },
  sectionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    marginBottom: theme.spacing(2),
    marginTop: theme.spacing(5),
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
  toolCard: {
    height: '100%',
    borderRadius: theme.shape.borderRadius * 2,
    border: `1px solid ${theme.palette.divider}`,
    transition: 'box-shadow 0.2s, transform 0.2s',
    '&:hover': {
      boxShadow: theme.shadows[6],
      transform: 'translateY(-2px)',
    },
  },
  toolCardArea: {
    height: '100%',
    padding: theme.spacing(2.5),
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: theme.spacing(1),
  },
  toolIconCircle: {
    width: 52,
    height: 52,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing(0.5),
  },
  toolLabel: {
    fontWeight: 700,
    lineHeight: 1.3,
  },
  toolDescription: {
    color: theme.palette.text.secondary,
    lineHeight: 1.4,
  },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const SectionHeader = ({ title }: { title: string }) => {
  const classes = useStyles();
  return (
    <Box className={classes.sectionRow}>
      <Typography variant="overline" className={classes.sectionLabel}>
        {title}
      </Typography>
      <Divider className={classes.sectionDivider} />
    </Box>
  );
};

const ToolCard = ({ tool }: { tool: ToolItem }) => {
  const classes = useStyles();
  return (
    <Card className={classes.toolCard} elevation={0}>
      <CardActionArea
        className={classes.toolCardArea}
        component="a"
        href={tool.url}
        target={tool.external ? '_blank' : '_self'}
        rel={tool.external ? 'noopener noreferrer' : undefined}
      >
        <Box
          className={classes.toolIconCircle}
          style={{ backgroundColor: tool.bgColor }}
        >
          <Box style={{ color: tool.iconColor, display: 'flex' }}>
            {tool.icon}
          </Box>
        </Box>
        <Typography variant="subtitle1" className={classes.toolLabel}>
          {tool.label}
        </Typography>
        <Typography variant="body2" className={classes.toolDescription}>
          {tool.description}
        </Typography>
      </CardActionArea>
    </Card>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export const HomePage = () => {
  const classes = useStyles();
  const identityApi = useApi(identityApiRef);
  const [displayName, setDisplayName] = useState('');

  useEffect(() => {
    identityApi.getProfileInfo().then(({ displayName: name }) => {
      setDisplayName(name ?? '');
    });
  }, [identityApi]);

  return (
    <Page themeId="home">
      <Content>
        {/* ── Hero ── */}
        <Box className={classes.hero}>
          <Typography variant="h5" className={classes.heroGreeting}>
            {getGreeting()}
          </Typography>
          <Typography variant="h2" className={classes.heroName}>
            {displayName || 'Welcome back'}!
          </Typography>
        </Box>

        {/* ── Search ── */}
        <Box className={classes.searchSection}>
          <Box className={classes.searchInner}>
            <HomePageSearchBar placeholder="Search components, APIs, docs…" />
          </Box>
        </Box>

        {/* ── Quick Actions ── */}
        <SectionHeader title="Quick Actions" />
        <Grid container spacing={3}>
          {tools.map(tool => (
            <Grid key={tool.label} item xs={6} md={3}>
              <ToolCard tool={tool} />
            </Grid>
          ))}
        </Grid>

        {/* ── My Workspace ── */}
        <SectionHeader title="My Workspace" />
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <HomePageStarredEntities />
          </Grid>
          <Grid item xs={12} md={4}>
            <HomePageRandomJoke />
          </Grid>
        </Grid>

        {/* ── Recent Activity ── */}
        <SectionHeader title="Recent Activity" />
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <HomePageTopVisited />
          </Grid>
          <Grid item xs={12} md={6}>
            <HomePageRecentlyVisited />
          </Grid>
        </Grid>
      </Content>
    </Page>
  );
};
