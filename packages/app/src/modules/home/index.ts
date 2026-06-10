import { createElement } from 'react';
import { createFrontendModule, PageBlueprint } from '@backstage/frontend-plugin-api';

const customHomePage = PageBlueprint.make({
  params: {
    path: '/',
    noHeader: true,
    loader: async () => {
      const { HomePage } = await import('../../components/home/HomePage');
      return createElement(HomePage);
    },
  },
});

export const homeModule = createFrontendModule({
  pluginId: 'home',
  extensions: [customHomePage],
});
