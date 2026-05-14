import { createBackend } from '@backstage/backend-defaults';
import { multiBackendDiscovery } from 'backend-common';

const backend = createBackend();

backend.add(multiBackendDiscovery);

backend.add(import('@backstage/plugin-search-backend'));
backend.add(import('@backstage/plugin-search-backend-module-pg'));
backend.add(import('@backstage/plugin-search-backend-module-catalog'));
backend.add(import('@backstage/plugin-search-backend-module-techdocs'));

backend.start();
