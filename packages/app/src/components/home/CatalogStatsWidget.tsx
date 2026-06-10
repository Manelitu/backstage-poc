import { useEffect, useState } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Box from '@material-ui/core/Box';
import Grid from '@material-ui/core/Grid';
import Typography from '@material-ui/core/Typography';
import { InfoCard, Progress } from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';

const KINDS = [
  { kind: 'Component', color: '#1565c0', bg: '#e3f2fd' },
  { kind: 'API',       color: '#6a1b9a', bg: '#f3e5f5' },
  { kind: 'System',    color: '#2e7d32', bg: '#e8f5e9' },
  { kind: 'Domain',    color: '#e65100', bg: '#fff3e0' },
  { kind: 'Template',  color: '#00695c', bg: '#e0f2f1' },
  { kind: 'Group',     color: '#558b2f', bg: '#f1f8e9' },
];

const useStyles = makeStyles(theme => ({
  inner: {
    padding: theme.spacing(2),
  },
  tile: {
    borderRadius: theme.shape.borderRadius * 2,
    padding: theme.spacing(1.5, 1),
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: theme.spacing(0.25),
    textDecoration: 'none',
    transition: 'opacity 0.15s',
    '&:hover': { opacity: 0.8 },
  },
  count: {
    fontWeight: 700,
    fontSize: '1.6rem',
    lineHeight: 1,
  },
  label: {
    fontSize: '0.68rem',
    fontWeight: 600,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  },
}));

export const CatalogStatsWidget = () => {
  const classes = useStyles();
  const catalogApi = useApi(catalogApiRef);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    catalogApi
      .getEntities({ fields: ['kind'] })
      .then(({ items }) => {
        const c: Record<string, number> = {};
        items.forEach(e => { c[e.kind] = (c[e.kind] ?? 0) + 1; });
        setCounts(c);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [catalogApi]);

  return (
    <InfoCard title="Catalog Overview" subheader="Entities by type">
      {loading ? (
        <Progress />
      ) : (
        <Box className={classes.inner}>
          <Grid container spacing={2}>
            {KINDS.map(({ kind, color, bg }) => (
              <Grid item xs={4} key={kind}>
                <a
                  className={classes.tile}
                  href={`/catalog?filters%5Bkind%5D=${kind.toLowerCase()}`}
                  style={{ backgroundColor: bg }}
                >
                  <Typography className={classes.count} style={{ color }}>
                    {counts[kind] ?? 0}
                  </Typography>
                  <Typography className={classes.label} style={{ color }}>
                    {kind}s
                  </Typography>
                </a>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}
    </InfoCard>
  );
};
