import React from 'react';
import { Grid, RefreshCw, Settings, Tags } from 'lucide-react';
import { PublicData } from '../../../types';

export interface AdminNavItem {
  to: string;
  label: string;
  title: string;
  icon: React.ReactNode;
  count?: number;
}

export const buildAdminNavItems = (data: PublicData): AdminNavItem[] => [
  {
    to: '/tat/cards',
    label: '卡片管理',
    title: '卡片管理',
    icon: <Grid size={18} />,
    count: data.cards.length
  },
  {
    to: '/tat/tags',
    label: '分类管理',
    title: '分类管理',
    icon: <Tags size={18} />,
    count: data.tags.length
  },
  {
    to: '/tat/sync',
    label: '数据同步',
    title: '数据同步',
    icon: <RefreshCw size={18} />
  },
  {
    to: '/tat/settings',
    label: '网站设置',
    title: '网站设置',
    icon: <Settings size={18} />
  }
];

export const getAdminRouteTitle = (items: AdminNavItem[], pathname: string) => {
  const matched = items.find((item) => pathname.startsWith(item.to));
  return matched?.title || '后台管理';
};
