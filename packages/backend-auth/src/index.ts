import { createBackend } from '@backstage/backend-defaults';
import { multiBackendDiscovery } from 'backend-common';

const backend = createBackend();

backend.add(multiBackendDiscovery);

backend.add(import('@backstage/plugin-auth-backend'));
backend.add(import('@backstage/plugin-auth-backend-module-guest-provider'));
backend.add(import('@backstage/plugin-auth-backend-module-github-provider'));

backend.start();
