import { coreServices, createServiceFactory } from '@backstage/backend-plugin-api';

export const multiBackendDiscovery = createServiceFactory({
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
