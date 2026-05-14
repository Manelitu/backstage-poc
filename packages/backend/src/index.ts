import { createBackend } from '@backstage/backend-defaults';
import { coreServices, createBackendPlugin } from '@backstage/backend-plugin-api';
import { createProxyMiddleware } from 'http-proxy-middleware';

/**
 * Reads backend.discovery.endpoints from config and registers a reverse-proxy
 * middleware on the root HTTP router so every plugin's /api/<id>/* path is
 * forwarded to the correct feature backend.  This is required because the
 * frontend always talks to the single baseUrl (port 7007) regardless of which
 * backend actually hosts a given plugin.
 */
const featureBackendProxy = createBackendPlugin({
  pluginId: 'feature-backend-proxy',
  register(env) {
    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
        rootHttpRouter: coreServices.rootHttpRouter,
      },
      async init({ config, rootHttpRouter }) {
        for (const ep of config.getOptionalConfigArray('backend.discovery.endpoints') ?? []) {
          const rawTarget = ep.getString('target');
          const { origin } = new URL(rawTarget.replace('{{pluginId}}', 'placeholder'));

          for (const pluginId of ep.getStringArray('plugins')) {
            const id = pluginId;
            rootHttpRouter.use(
              `/api/${id}`,
              createProxyMiddleware({
                target: origin,
                changeOrigin: true,
                pathRewrite: path => `/api/${id}${path}`,
              }),
            );
          }
        }
      },
    });
  },
});

const backend = createBackend();

backend.add(featureBackendProxy);
backend.add(import('@backstage/plugin-app-backend'));
backend.add(import('@backstage/plugin-proxy-backend'));

backend.start();
