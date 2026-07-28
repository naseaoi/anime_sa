import { PublicData } from '../types';

export const DEFAULT_ICON_URL = '/icon.png';
export const DEFAULT_NAV_ICON_URL = '/icon-64.png';

export const resolveSiteIconUrl = (iconUrl?: string) => iconUrl?.trim() || DEFAULT_ICON_URL;

export const resolveNavigationIconUrl = (iconUrl?: string) => {
  const resolved = resolveSiteIconUrl(iconUrl);
  return resolved === DEFAULT_ICON_URL ? DEFAULT_NAV_ICON_URL : resolved;
};

export const DEFAULT_PUBLIC_DATA: PublicData = {
  version: 0,
  updatedAt: 0,
  revision: 'legacy:0',
  settings: {
    title: '我的收藏',
    iconUrl: DEFAULT_ICON_URL,
    themeColor: '#c78c2b',
    footerText: 'All rights reserved',
    footerLeft: '© 2026',
    footerRight: 'All rights reserved'
  },
  tags: [
    { id: '1', name: '番剧', icon: 'tv' },
    { id: '2', name: '游戏', icon: 'gamepad' }
  ],
  cards: []
};

export const applyDerivedPublicDataVersion = <T>(data: T, fallbackUpdatedAt = 0): T => {
  if (!data || typeof data !== 'object') return data;

  const value = data as T & { updatedAt?: number; cards?: Array<{ updatedAt?: number }> };
  if (!value.updatedAt && fallbackUpdatedAt > 0) value.updatedAt = fallbackUpdatedAt;
  if (!value.updatedAt && Array.isArray(value.cards)) {
    const latestCardUpdate = value.cards.reduce(
      (latest, card) => Math.max(latest, card.updatedAt || 0),
      0
    );
    if (latestCardUpdate > 0) value.updatedAt = latestCardUpdate;
  }
  return data;
};
