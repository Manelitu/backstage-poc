import { createBackend } from '@backstage/backend-defaults';
import { multiBackendDiscovery } from 'backend-common';

const backend = createBackend();

backend.add(multiBackendDiscovery);

backend.add(import('@backstage/plugin-kubernetes-backend'));

backend.start();
