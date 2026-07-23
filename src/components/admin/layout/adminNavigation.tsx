import React from 'react';
import { Grid, RefreshCw, Settings, Tags } from 'lucide-react';

export interface AdminNavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
}

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  {
    to: '/tat/cards',
    label: '卡片管理',
    icon: <Grid size={18} />
  },
  {
    to: '/tat/tags',
    label: '标签管理',
    icon: <Tags size={18} />
  },
  {
    to: '/tat/sync',
    label: '数据同步',
    icon: <RefreshCw size={18} />
  },
  {
    to: '/tat/settings',
    label: '网站设置',
    icon: <Settings size={18} />
  }
];
