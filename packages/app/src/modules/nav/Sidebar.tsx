import {
  Sidebar,
  SidebarDivider,
  SidebarGroup,
  SidebarItem,
  SidebarScrollWrapper,
  SidebarSpace,
} from '@backstage/core-components';
import { NavContentBlueprint } from '@backstage/plugin-app-react';
import { SidebarLogo } from './SidebarLogo';
import MenuIcon from '@material-ui/icons/Menu';
import SearchIcon from '@material-ui/icons/Search';
import { SidebarSearchModal } from '@backstage/plugin-search';
import { UserSettingsSignInAvatar } from '@backstage/plugin-user-settings';
import { NotificationsSidebarItem } from '@backstage/plugin-notifications';

const NAV_LABELS: Record<string, string> = {
  'page:home':           'Início',
  'page:catalog':        'Catálogo',
  'page:scaffolder':     'Criar Serviço',
  'page:catalog-graph':  'Grafo do Catálogo',
  'page:user-settings':  'Configurações',
  'page:app-visualizer': 'Visualizador',
  'page:kubernetes':     'Kubernetes',
  'page:notifications':  'Notificações',
  'page:search':         'Buscar',
  'page:techdocs':       'Documentação',
  'page:tech-radar':     'Tech Radar',
};

export const SidebarContent = NavContentBlueprint.make({
  params: {
    component: ({ navItems }) => {
      const nav = navItems.withComponent(item => (
        <SidebarItem
          icon={() => item.icon}
          to={item.href}
          text={NAV_LABELS[item.id] ?? item.title}
        />
      ));

      nav.take('page:search'); // using search modal instead

      return (
        <Sidebar>
          <SidebarLogo />
          <SidebarGroup label="Buscar" icon={<SearchIcon />} to="/search">
            <SidebarSearchModal />
          </SidebarGroup>
          <SidebarDivider />
          <SidebarGroup label="Menu" icon={<MenuIcon />}>
            {nav.take('page:home')}
            {nav.take('page:catalog')}
            {nav.take('page:scaffolder')}
            <SidebarDivider />
            <SidebarScrollWrapper>
              {nav.rest({ sortBy: 'title' })}
            </SidebarScrollWrapper>
          </SidebarGroup>
          <SidebarSpace />
          <SidebarDivider />
          <NotificationsSidebarItem />
          <SidebarDivider />
          <SidebarGroup
            label="Configurações"
            icon={<UserSettingsSignInAvatar />}
            to="/settings"
          >
            {nav.take('page:app-visualizer')}
            {nav.take('page:user-settings')}
          </SidebarGroup>
        </Sidebar>
      );
    },
  },
});
