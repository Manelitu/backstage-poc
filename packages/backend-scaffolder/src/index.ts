import { createBackend } from '@backstage/backend-defaults';
import { coreServices, createServiceFactory } from '@backstage/backend-plugin-api';

/**
 * Custom DiscoveryService that reads backend.discovery.endpoints from config.
 * Necessary because the default service resolves all unknown plugins to its own
 * backend.baseUrl, breaking cross-backend calls in a multi-backend setup.
 */
const multiBackendDiscovery = createServiceFactory({
  service: coreServices.discovery,
  deps: { config: coreServices.rootConfig },
  async factory({ config }) {
    const baseUrl = config.getString('backend.baseUrl');
    const pluginUrls = new Map<string, string>();

    for (const ep of config.getOptionalConfigArray('backend.discovery.endpoints') ?? []) {
      const target = ep.getString('target');
      for (const pluginId of ep.getStringArray('plugins')) {
        pluginUrls.set(pluginId, target.replace(/\{\{pluginId\}\}/g, pluginId));
      }
    }

    return {
      async getBaseUrl(pluginId: string): Promise<string> {
        return pluginUrls.get(pluginId) ?? `${baseUrl}/api/${pluginId}`;
      },
      async getExternalBaseUrl(pluginId: string): Promise<string> {
        return pluginUrls.get(pluginId) ?? `${baseUrl}/api/${pluginId}`;
      },
    };
  },
});

const backend = createBackend();

backend.add(multiBackendDiscovery());

backend.add(import('@backstage/plugin-scaffolder-backend'));
backend.add(import('@backstage/plugin-scaffolder-backend-module-github'));
backend.add(
  import('@backstage/plugin-scaffolder-backend-module-notifications'),
);

backend.start();
