import { createBackendModule } from '@backstage/backend-plugin-api';
import { githubAuthenticator } from '@backstage/plugin-auth-backend-module-github-provider';
import {
  authProvidersExtensionPoint,
  createOAuthProviderFactory,
} from '@backstage/plugin-auth-node';
import { stringifyEntityRef } from '@backstage/catalog-model';

export const customAuth = createBackendModule({
  // This ID must be exactly "auth" because that's the plugin it targets
  pluginId: 'auth',
  // This ID must be unique, but can be anything
  moduleId: 'custom-auth-provider',
  register(reg) {
    reg.registerInit({
      deps: { providers: authProvidersExtensionPoint },
      async init({ providers }) {
        providers.registerProvider({
          // This ID must match the actual provider config, e.g. addressing
          // auth.providers.github means that this must be "github".
          providerId: 'github',
          // Use createProxyAuthProviderFactory instead if it's one of the proxy
          // based providers rather than an OAuth based one
          factory: createOAuthProviderFactory({
            authenticator: githubAuthenticator,
            async signInResolver(info, ctx) {
              const username = info.result.fullProfile.username;
              if (!username) {
                throw new Error('GitHub profile is missing a username');
              }
              const entityRef = stringifyEntityRef({
                kind: 'User',
                namespace: 'default',
                name: username.toLowerCase(),
              });
              try {
                return await ctx.signInWithCatalogUser({ entityRef });
              } catch {
                return ctx.issueToken({
                  claims: { sub: entityRef, ent: [entityRef] },
                });
              }
            },
          }),
        });
      },
    });
  },
});
