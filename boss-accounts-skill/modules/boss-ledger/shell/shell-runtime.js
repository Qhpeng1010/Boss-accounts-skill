(function installBossLedgerShell(global) {
  const React = global.React;
  const antd = global.antd;
  const icons = global.icons || global.antdIcons || global.AntDesignIcons || {};

  function normalizeMenuItems(items) {
    return (items || []).map((item) => ({
      ...item,
      icon: typeof item.icon === 'string' && icons[item.icon]
        ? React.createElement(icons[item.icon])
        : item.icon,
      children: item.children ? normalizeMenuItems(item.children) : undefined
    }));
  }

  function flattenRoutes(items, result = new Map()) {
    (items || []).forEach((item) => {
      if (item.route) result.set(item.key, item);
      if (item.children) flattenRoutes(item.children, result);
    });
    return result;
  }

  function BossLedgerShell({ config, renderContent }) {
    const { Menu, Tabs, Empty } = antd;
    const { MenuFoldOutlined, MenuUnfoldOutlined, ReloadOutlined } = icons;
    const [collapsed, setCollapsed] = React.useState(false);
    const [activePrimaryKey, setActivePrimaryKey] = React.useState(config.activePrimaryKey);
    const [selectedMenuKey, setSelectedMenuKey] = React.useState(config.selectedMenuKey);
    const [openMenuKeys, setOpenMenuKeys] = React.useState(config.openMenuKeys || []);
    const [activeTabKey, setActiveTabKey] = React.useState(config.activeTabKey);
    const [tabs, setTabs] = React.useState(config.tabs || []);

    const rawMenuItems = config.sideMenusByPrimary?.[activePrimaryKey] || [];
    const menuItems = normalizeMenuItems(rawMenuItems);
    const routeCatalog = React.useMemo(() => {
      const catalog = new Map();
      Object.values(config.sideMenusByPrimary || {}).forEach((items) => flattenRoutes(items, catalog));
      (config.tabs || []).forEach((tab) => catalog.set(tab.key, tab));
      return catalog;
    }, [config.sideMenusByPrimary, config.tabs]);

    const activateRoute = (key) => {
      const route = routeCatalog.get(key);
      setSelectedMenuKey(key);
      setActiveTabKey(key);
      setTabs((current) => current.some((tab) => tab.key === key)
        ? current
        : current.concat({ key, label: route?.label || key, route: route?.route, closable: route?.closable !== false }));
      config.onRouteChange?.(route || { key });
    };

    const openTab = (tab) => {
      if (!tab?.key) return;
      setTabs((current) => current.some((item) => item.key === tab.key)
        ? current
        : current.concat({ key: tab.key, label: tab.label || tab.key, route: tab.route, closable: tab.closable !== false }));
      setActiveTabKey(tab.key);
      config.onRouteChange?.(tab);
    };

    const closeTab = (targetKey) => {
      if (tabs.length <= 1) return;
      const targetIndex = tabs.findIndex((tab) => tab.key === targetKey);
      const nextTabs = tabs.filter((tab) => tab.key !== targetKey);
      setTabs(nextTabs);
      if (targetKey === activeTabKey) {
        const nextTab = nextTabs[Math.min(Math.max(targetIndex - 1, 0), nextTabs.length - 1)];
        setActiveTabKey(nextTab.key);
        setSelectedMenuKey(nextTab.key);
        config.onRouteChange?.(nextTab);
      }
    };

    const changePrimary = (key) => {
      setActivePrimaryKey(key);
      const nextItems = config.sideMenusByPrimary?.[key] || [];
      const firstGroup = nextItems[0];
      const firstRoute = firstGroup?.children?.[0] || firstGroup;
      setOpenMenuKeys(firstGroup?.children ? [firstGroup.key] : []);
      if (firstRoute?.key) activateRoute(firstRoute.key);
    };

    const tabItems = tabs.map((tab) => ({
      key: tab.key,
      closable: tab.closable !== false,
      label: React.createElement('span', { className: 'boss-shell-tab-label' },
        activeTabKey === tab.key
          ? React.createElement(ReloadOutlined, { 'data-boss-tab-static-icon': true, className: 'boss-shell-tab-icon' })
          : null,
        React.createElement('span', { className: 'boss-shell-tab-title' }, tab.label))
    }));
    const activeTab = tabs.find((tab) => tab.key === activeTabKey) || routeCatalog.get(activeTabKey);
    const content = renderContent?.({ activeTabKey, activeTab, activePrimaryKey, selectedMenuKey, tabs, openTab, closeTab });

    return React.createElement('div', { className: 'boss-shell', 'data-boss-shell-template-version': '1' },
      React.createElement('div', { className: 'boss-shell-topbar', 'data-boss-shell': 'topbar' },
        React.createElement('span', { className: 'boss-shell-topbar-left' }, config.topbar?.left),
        React.createElement('span', { className: 'boss-shell-topbar-right' }, config.topbar?.right)),
      React.createElement('header', { className: 'boss-shell-primary-nav', 'data-boss-shell': 'primary-nav' },
        React.createElement('div', { className: 'boss-shell-logo-zone' },
          React.createElement('img', {
            className: 'boss-shell-logo',
            src: config.logoSrc || './assets/boss-logo.svg',
            alt: 'Boss Ledger',
            'data-boss-logo-source': 'modules/boss-ledger/assets/boss-logo.svg'
          })),
        React.createElement('nav', { className: 'boss-shell-primary-items', 'aria-label': '一级导航' },
          (config.primaryNav || []).map((item) => React.createElement('div', {
            key: item.key,
            className: `boss-shell-primary-item ${item.key === activePrimaryKey ? 'active' : ''}`,
            onClick: () => changePrimary(item.key)
          }, item.label)))),
      React.createElement('div', { className: 'boss-shell-body' },
        React.createElement('aside', { className: `boss-shell-sider ${collapsed ? 'collapsed' : ''}`, 'data-boss-shell': 'sider' },
          React.createElement('div', { className: 'boss-shell-menu' }, React.createElement(Menu, {
            mode: 'inline',
            inlineCollapsed: collapsed,
            selectedKeys: [selectedMenuKey],
            openKeys: collapsed ? [] : openMenuKeys,
            onOpenChange: setOpenMenuKeys,
            items: menuItems,
            onClick: ({ key }) => activateRoute(key)
          })),
          React.createElement('div', {
            className: 'boss-shell-collapse',
            'data-boss-sider-collapse': true,
            style: { justifyContent: 'flex-start', textAlign: 'left' },
            onClick: () => setCollapsed((value) => !value),
            role: 'button',
            tabIndex: 0,
            'aria-label': collapsed ? '展开侧边栏' : '收起侧边栏'
          }, collapsed ? React.createElement(MenuUnfoldOutlined) : React.createElement(MenuFoldOutlined))),
        React.createElement('main', { className: 'boss-shell-workspace' },
          React.createElement('div', { className: 'boss-shell-tabs', 'data-boss-shell': 'tabs' }, React.createElement(Tabs, {
            type: 'editable-card',
            hideAdd: true,
            activeKey: activeTabKey,
            items: tabItems,
            onChange: activateRoute,
            onEdit: (key, action) => action === 'remove' && closeTab(key)
          })),
          React.createElement('section', { className: 'boss-shell-content', 'data-boss-shell': 'content' },
            React.createElement('div', { className: 'boss-shell-content-body' },
              content || React.createElement('div', { className: 'boss-shell-empty' }, React.createElement(Empty, { description: '当前标签暂无业务数据' }))),
            React.createElement('footer', { className: 'boss-shell-footer', 'data-boss-shell': 'footer' },
              config.footerText || '© 2026 易宝支付有限公司 版权所有'))))
    );
  }

  global.BossLedgerShell = BossLedgerShell;
})(window);
