import { useEffect, useState } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Box from '@material-ui/core/Box';
import Chip from '@material-ui/core/Chip';
import Typography from '@material-ui/core/Typography';
import AccessTimeIcon from '@material-ui/icons/AccessTime';
import { EmptyState, InfoCard, Progress } from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import { visitsApiRef, type Visit } from '@backstage/plugin-home';

// ─── Kind colours (from the blog: entity-type aware theming) ─────────────────

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
  // /catalog/default/<kind>/<name>
  const kind = parts[2]?.toLowerCase();
  return KIND_META[kind] ?? DEFAULT_KIND;
}

function relativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const m = Math.floor(diff / 60_000);
  const h = Math.floor(diff / 3_600_000);
  const d = Math.floor(diff / 86_400_000);
  if (m < 1)  return 'Agora';
  if (m < 60) return `há ${m}m`;
  if (h < 24) return `há ${h}h`;
  if (d === 1) return 'Ontem';
  return `há ${d}d`;
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const useStyles = makeStyles(theme => ({
  list: {
    padding: theme.spacing(1, 2.5, 2),
    overflowY: 'auto',
  },
  item: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing(1.5),
    paddingTop: theme.spacing(1.25),
    paddingBottom: theme.spacing(1.25),
    borderBottom: `1px solid ${theme.palette.divider}`,
    textDecoration: 'none',
    color: 'inherit',
    borderRadius: theme.shape.borderRadius,
    paddingLeft: theme.spacing(0.5),
    paddingRight: theme.spacing(0.5),
    transition: 'background-color 0.15s',
    '&:last-child': {
      borderBottom: 'none',
    },
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    marginTop: 5,
    flexShrink: 0,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: '0.85rem',
    fontWeight: 500,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  meta: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    marginTop: theme.spacing(0.25),
  },
  time: {
    fontSize: '0.72rem',
    color: theme.palette.text.disabled,
    display: 'flex',
    alignItems: 'center',
    gap: 3,
  },
  chip: {
    height: 18,
    fontSize: '0.65rem',
    fontWeight: 600,
  },
}));

// ─── Component ────────────────────────────────────────────────────────────────

export const RecentlyVisitedTimeline = () => {
  const classes = useStyles();
  const visitsApi = useApi(visitsApiRef);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    visitsApi
      .list({ orderBy: [{ field: 'timestamp', direction: 'desc' }], limit: 8 })
      .then(data => { setVisits(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [visitsApi]);

  return (
    <InfoCard title="Visitados Recentemente" subheader="Seu histórico de navegação recente">
      {loading ? (
        <Progress />
      ) : visits.length === 0 ? (
        <EmptyState
          missing="data"
          title="Nenhuma visita ainda"
          description="Comece a navegar para acompanhar suas páginas recentes."
        />
      ) : (
        <Box className={classes.list}>
          {visits.map(visit => {
            const kind = kindFromPathname(visit.pathname);
            return (
              <a
                key={visit.id}
                className={classes.item}
                href={visit.pathname}
              >
                <Box
                  className={classes.dot}
                  style={{ backgroundColor: kind.color }}
                />
                <Box className={classes.content}>
                  <Typography className={classes.name}>{visit.name}</Typography>
                  <Box className={classes.meta}>
                    <Chip
                      label={kind.label}
                      size="small"
                      className={classes.chip}
                      style={{ color: kind.color, backgroundColor: kind.bg }}
                    />
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
  );
};
