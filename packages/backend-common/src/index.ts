import { coreServices, createServiceFactory } from '@backstage/backend-plugin-api';

export const multiBackendDiscovery = createServiceFactory({
  service: coreServices.discovery,
  deps: { config: coreServices.rootConfig },
  async factory({ config }) {
    const baseUrl = config.getString('backend.baseUrl');
    const internalUrls = new Map<string, string>();
    const externalUrls = new Map<string, string>();

    for (const ep of config.getOptionalConfigArray('backend.discovery.endpoints') ?? []) {
      const target = ep.getString('target');
      // externalTarget is optional; falls back to target when not set (e.g. local dev)
      const externalTarget = ep.getOptionalString('externalTarget') ?? target;
      for (const pluginId of ep.getStringArray('plugins')) {
        internalUrls.set(pluginId, target.replace(/\{\{pluginId\}\}/g, pluginId));
        externalUrls.set(pluginId, externalTarget.replace(/\{\{pluginId\}\}/g, pluginId));
      }
    }

    return {
      async getBaseUrl(pluginId: string): Promise<string> {
        return internalUrls.get(pluginId) ?? `${baseUrl}/api/${pluginId}`;
      },
      async getExternalBaseUrl(pluginId: string): Promise<string> {
        return externalUrls.get(pluginId) ?? `${baseUrl}/api/${pluginId}`;
      },
    };
  },
});
