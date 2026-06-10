import { createApp } from '@backstage/frontend-defaults';
import catalogPlugin from '@backstage/plugin-catalog/alpha';
import homePlugin from '@backstage/plugin-home/alpha';
import { navModule } from './modules/nav';
import { homeModule } from './modules/home';
import { createFrontendModule } from '@backstage/frontend-plugin-api';
import { signInPage } from './modules/sign-in/GithubSignIn';

export default createApp({
  features: [
    catalogPlugin,
    homePlugin,
    homeModule,
    navModule,
    createFrontendModule({
      pluginId: 'app',
      extensions: [signInPage],
    }),
  ],
});
