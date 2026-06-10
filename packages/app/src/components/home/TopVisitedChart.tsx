import { useEffect, useState } from 'react';
import { makeStyles, useTheme } from '@material-ui/core/styles';
import Box from '@material-ui/core/Box';
import Tooltip from '@material-ui/core/Tooltip';
import Typography from '@material-ui/core/Typography';
import TrendingUpIcon from '@material-ui/icons/TrendingUp';
import { EmptyState, InfoCard, Progress } from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import { visitsApiRef, type Visit } from '@backstage/plugin-home';

const BAR_COLORS = [
  '#1565c0',
  '#1976d2',
  '#1e88e5',
  '#42a5f5',
  '#90caf9',
  '#bbdefb',
];

const useStyles = makeStyles(theme => ({
  container: {
    padding: theme.spacing(2, 2.5),
    overflowY: 'auto',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    marginBottom: theme.spacing(1.5),
    textDecoration: 'none',
    color: 'inherit',
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(0.5),
    transition: 'background-color 0.15s',
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
      '& $barFill': {
        filter: 'brightness(1.1)',
      },
    },
  },
  rank: {
    width: 20,
    minWidth: 20,
    fontWeight: 700,
    fontSize: '0.7rem',
    color: theme.palette.text.disabled,
    textAlign: 'center',
  },
  label: {
    width: 130,
    minWidth: 130,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: '0.8rem',
    fontWeight: 500,
  },
  barTrack: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.palette.action.selected,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 5,
    transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  count: {
    width: 36,
    minWidth: 36,
    textAlign: 'right',
    fontSize: '0.75rem',
    fontWeight: 700,
    color: theme.palette.text.secondary,
  },
  footer: {
    marginTop: theme.spacing(1),
    paddingTop: theme.spacing(1),
    borderTop: `1px solid ${theme.palette.divider}`,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    color: theme.palette.text.disabled,
  },
}));

function shortName(name: string): string {
  return name.length > 22 ? `${name.slice(0, 20)}…` : name;
}

export const TopVisitedChart = () => {
  const classes = useStyles();
  const theme = useTheme();
  const visitsApi = useApi(visitsApiRef);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    visitsApi
      .list({ orderBy: [{ field: 'hits', direction: 'desc' }], limit: 6 })
      .then(data => { setVisits(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [visitsApi]);

  const maxHits = Math.max(...visits.map(v => v.hits), 1);
  const totalHits = visits.reduce((sum, v) => sum + v.hits, 0);

  return (
    <InfoCard title="Most Visited" subheader="Your top pages by view count">
      {loading ? (
        <Progress />
      ) : visits.length === 0 ? (
        <EmptyState
          missing="data"
          title="No visits yet"
          description="Start navigating to track your most visited pages."
        />
      ) : (
        <Box className={classes.container}>
          {visits.map((visit, i) => {
            const pct = Math.max((visit.hits / maxHits) * 100, 4);
            const color = BAR_COLORS[i] ?? theme.palette.primary.light;
            return (
              <Tooltip
                key={visit.id}
                title={`${visit.pathname} — ${visit.hits} visits`}
                placement="top"
              >
                <a
                  className={classes.row}
                  href={visit.pathname}
                >
                  <Typography className={classes.rank}>#{i + 1}</Typography>
                  <Typography className={classes.label}>
                    {shortName(visit.name)}
                  </Typography>
                  <Box className={classes.barTrack}>
                    <Box
                      className={classes.barFill}
                      style={{ width: `${pct}%`, backgroundColor: color }}
                    />
                  </Box>
                  <Typography className={classes.count}>
                    {visit.hits}
                  </Typography>
                </a>
              </Tooltip>
            );
          })}
          <Box className={classes.footer}>
            <TrendingUpIcon style={{ fontSize: 14 }} />
            <Typography variant="caption">
              {totalHits} total views across {visits.length} pages
            </Typography>
          </Box>
        </Box>
      )}
    </InfoCard>
  );
};
