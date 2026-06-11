import { useEffect, useState } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Box from '@material-ui/core/Box';
import Chip from '@material-ui/core/Chip';
import IconButton from '@material-ui/core/IconButton';
import Tooltip from '@material-ui/core/Tooltip';
import Typography from '@material-ui/core/Typography';
import StarIcon from '@material-ui/icons/Star';
import { EmptyState, InfoCard, Progress } from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef, useStarredEntities } from '@backstage/plugin-catalog-react';
import type { Entity } from '@backstage/catalog-model';

// ─── Kind colours ────────────────────────────────────────────────────────────

const KIND_META: Record<string, { color: string; bg: string; label: string }> = {
  component: { color: '#1565c0', bg: '#e3f2fd', label: 'Componente' },
  api:       { color: '#6a1b9a', bg: '#f3e5f5', label: 'API'        },
  system:    { color: '#2e7d32', bg: '#e8f5e9', label: 'Sistema'    },
  domain:    { color: '#e65100', bg: '#fff3e0', label: 'Domínio'    },
  template:  { color: '#00695c', bg: '#e0f2f1', label: 'Template'   },
  group:     { color: '#558b2f', bg: '#f1f8e9', label: 'Grupo'      },
  user:      { color: '#4527a0', bg: '#ede7f6', label: 'Usuário'    },
};
const DEFAULT_KIND = { color: '#546e7a', bg: '#eceff1', label: 'Entidade' };

function kindMeta(kind: string) {
  return KIND_META[kind.toLowerCase()] ?? DEFAULT_KIND;
}

function entityUrl(entity: Entity): string {
  const ns = entity.metadata.namespace ?? 'default';
  return `/catalog/${ns}/${entity.kind.toLowerCase()}/${entity.metadata.name}`;
}

function toRef(entity: Entity): string {
  const ns = entity.metadata.namespace ?? 'default';
  return `${entity.kind.toLowerCase()}:${ns}/${entity.metadata.name}`;
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const useStyles = makeStyles(theme => ({
  cardContent: {
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  list: {
    flex: '1 1 0%',
    minHeight: 0,
    padding: theme.spacing(1, 2, 2),
    overflowY: 'auto',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    padding: theme.spacing(1.25, 0.75, 1.25, 0),
    borderBottom: `1px solid ${theme.palette.divider}`,
    textDecoration: 'none',
    color: 'inherit',
    borderRadius: theme.shape.borderRadius * 1.5,
    transition: 'background-color 0.15s',
    '&:last-child': { borderBottom: 'none' },
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
      '& $unstarBtn': { opacity: 1 },
    },
  },
  accent: {
    width: 4,
    minWidth: 4,
    alignSelf: 'stretch',
    minHeight: 42,
    borderRadius: 4,
    flexShrink: 0,
    marginLeft: theme.spacing(0.5),
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    marginBottom: 2,
  },
  name: {
    fontWeight: 700,
    fontSize: '0.875rem',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: '0 1 auto',
    minWidth: 0,
  },
  chip: {
    height: 18,
    fontSize: '0.62rem',
    fontWeight: 700,
    flexShrink: 0,
  },
  desc: {
    fontSize: '0.75rem',
    color: theme.palette.text.secondary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  namespace: {
    fontSize: '0.68rem',
    color: theme.palette.text.disabled,
    marginTop: 1,
  },
  unstarBtn: {
    opacity: 0,
    transition: 'opacity 0.15s',
    padding: 4,
    flexShrink: 0,
  },
}));

// ─── Component ───────────────────────────────────────────────────────────────

export const StarredEntitiesWidget = () => {
  const classes = useStyles();
  const catalogApi = useApi(catalogApiRef);
  const { starredEntities, toggleStarredEntity } = useStarredEntities();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    if (starredEntities.size === 0) {
      setEntities([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all(
      [...starredEntities].map(ref =>
        catalogApi.getEntityByRef(ref).catch(() => undefined),
      ),
    )
      .then(results => {
        setEntities(results.filter((e): e is Entity => !!e));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [starredEntities, catalogApi]);

  const count = entities.length;

  return (
    <InfoCard
      noPadding
      variant="fullHeight"
      cardClassName={classes.cardContent}
      title="Suas Entidades Favoritas"
      subheader={
        loading
          ? 'Carregando...'
          : `${count} ${count === 1 ? 'entidade favoritada' : 'entidades favoritadas'}`
      }
    >
      {loading ? (
        <Progress />
      ) : entities.length === 0 ? (
        <EmptyState
          missing="data"
          title="Nenhum favorito ainda"
          description="Favorite entidades no catálogo clicando na estrela ao lado do nome da entidade."
        />
      ) : (
        <Box className={classes.list}>
          {entities.map(entity => {
            const km   = kindMeta(entity.kind);
            const url  = entityUrl(entity);
            const name = entity.metadata.title ?? entity.metadata.name;
            const desc = entity.metadata.description;
            const ns   = (entity.metadata.namespace && entity.metadata.namespace !== 'default')
              ? entity.metadata.namespace
              : undefined;
            const type = (entity.spec as any)?.type as string | undefined;
            return (
              <a key={toRef(entity)} className={classes.item} href={url}>
                <Box className={classes.accent} style={{ backgroundColor: km.color }} />
                <Box className={classes.info}>
                  <Box className={classes.nameRow}>
                    <Typography className={classes.name} title={name}>{name}</Typography>
                    <Chip
                      label={km.label}
                      size="small"
                      className={classes.chip}
                      style={{ color: km.color, backgroundColor: km.bg }}
                    />
                    {type && (
                      <Chip
                        label={type}
                        size="small"
                        className={classes.chip}
                        style={{ color: '#546e7a', backgroundColor: '#eceff1' }}
                      />
                    )}
                  </Box>
                  {desc && (
                    <Typography className={classes.desc} title={desc}>{desc}</Typography>
                  )}
                  {ns && (
                    <Typography className={classes.namespace}>{ns}</Typography>
                  )}
                </Box>
                <Tooltip title="Remover dos favoritos" arrow>
                  <IconButton
                    size="small"
                    className={classes.unstarBtn}
                    onClick={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleStarredEntity(toRef(entity));
                    }}
                    aria-label="remover dos favoritos"
                  >
                    <StarIcon style={{ fontSize: 16, color: '#f57f17' }} />
                  </IconButton>
                </Tooltip>
              </a>
            );
          })}
        </Box>
      )}
    </InfoCard>
  );
};
