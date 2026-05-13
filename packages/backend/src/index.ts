import { createBackend } from '@backstage/backend-defaults';

const backend = createBackend();

// Serves the frontend SPA and handles generic proxy endpoints.
// All feature plugins (catalog, auth, search, scaffolder, techdocs,
// kubernetes, notifications) run in their own backend packages.
backend.add(import('@backstage/plugin-app-backend'));
backend.add(import('@backstage/plugin-proxy-backend'));

backend.start();
