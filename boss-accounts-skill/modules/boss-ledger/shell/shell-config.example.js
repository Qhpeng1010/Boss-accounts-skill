const shellConfig = {
  topbar: {
    left: '上次登录时间：2026-07-10 09:18:32　登录 IP：10.24.18.66',
    right: 'Boss Ledger　帮助中心　消息'
  },
  logoSrc: '../../modules/boss-ledger/assets/boss-logo.svg',
  primaryNav: [
    { key: 'home', label: '首页', route: '/home' },
    { key: 'reports', label: '数据报表', route: '/reports' },
    { key: 'fund', label: '资金管理', route: '/fund' }
  ],
  sideMenusByPrimary: {
    fund: [{
      key: 'settlement',
      label: '资金管理',
      icon: 'BankOutlined',
      children: [{ key: 'settlement-record', label: '结算记录查询', route: '/fund/settlement-record' }]
    }]
  },
  tabs: [
    { key: 'settlement-record', label: '结算记录查询', route: '/fund/settlement-record', closable: false }
  ],
  activePrimaryKey: 'fund',
  selectedMenuKey: 'settlement-record',
  openMenuKeys: ['settlement'],
  activeTabKey: 'settlement-record'
};
