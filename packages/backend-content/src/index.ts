import { createBackend } from '@backstage/backend-defaults';
import { multiBackendDiscovery } from 'backend-common';

const backend = createBackend();

backend.add(multiBackendDiscovery);

// scaffolder
backend.add(import('@backstage/plugin-scaffolder-backend'));
backend.add(import('@backstage/plugin-scaffolder-backend-module-github'));
backend.add(
  import('@backstage/plugin-scaffolder-backend-module-notifications'),
);

// techdocs
backend.add(import('@backstage/plugin-techdocs-backend'));

backend.start();
