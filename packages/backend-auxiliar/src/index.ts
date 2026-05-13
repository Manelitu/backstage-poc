import { createBackend } from '@backstage/backend-defaults';

const backend = createBackend();

// techdocs
backend.add(import('@backstage/plugin-techdocs-backend'));

// scaffolder
backend.add(import('@backstage/plugin-scaffolder-backend'));
backend.add(import('@backstage/plugin-scaffolder-backend-module-github'));
backend.add(
  import('@backstage/plugin-scaffolder-backend-module-notifications'),
);

// kubernetes
backend.add(import('@backstage/plugin-kubernetes-backend'));

// notifications and signals
backend.add(import('@backstage/plugin-notifications-backend'));
backend.add(import('@backstage/plugin-signals-backend'));

// mcp actions
backend.add(import('@backstage/plugin-mcp-actions-backend'));

backend.start();
