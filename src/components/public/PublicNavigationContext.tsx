import React, { createContext, useContext, useMemo, useState } from 'react';
import { isAdminRoutePath, useLocation, useNavigate, useSearchParams } from '../../router';
import type { PublicData } from '../../types';
import { useTheme } from '../Common';
import { buildCardStats } from '../../utils/cardStats';
import { buildSectionPath, resolveSectionTag } from '../../utils/routeUtils';
import { clearScrollPosition, getHomeScrollKey, readSortConfig, writeSortConfig } from '../../utils/browserState';
import { PublicTopNav, type SortKey, type SortOrder } from './PublicTopNav';

interface PublicNavigationContextValue {
  searchTerm: string;
  sortConfig: { key: SortKey; order: SortOrder };
  onTagChange: (tagId: string) => void;
  onSearchChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onClearSearch: () => void;
  onSortChange: (key: SortKey) => void;
  createRequestToken: number;
}

const PublicNavigationContext = createContext<PublicNavigationContextValue | null>(null);

export const PublicNavigationProvider: React.FC<{
  data: PublicData;
  isAdmin: boolean;
  children: React.ReactNode;
}> = ({ data, isAdmin, children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { theme, toggleTheme } = useTheme();
  const [sortConfig, setSortConfig] = useState(readSortConfig);
  const [createRequestToken, setCreateRequestToken] = useState(0);
  const cardStats = useMemo(() => buildCardStats(data.cards), [data.cards]);
  const searchTerm = searchParams.get('q') || '';
  const isAdminRoute = isAdminRoutePath(location.pathname);
  const isDetail = !isAdminRoute && location.pathname.split('/').filter(Boolean).length >= 2;

  const activeTag = useMemo(() => {
    const section = location.pathname.split('/').filter(Boolean)[0];
    return resolveSectionTag(section, data.tags) || 'all';
  }, [data.tags, location.pathname]);

  const onTagChange = (tagId: string) => {
    const path = buildSectionPath(tagId, data.tags);
    clearScrollPosition(getHomeScrollKey(path, location.search));
    navigate(`${path}${location.search}`);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const onSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    const searchReturnTo = (location.state as { searchReturnTo?: string } | null)?.searchReturnTo;
    if (!value && searchReturnTo) {
      navigate(-1);
      return;
    }
    const next = new URLSearchParams(searchParams);
    if (value) next.set('q', value);
    else next.delete('q');
    const target = isDetail ? '/' : location.pathname;
    navigate(`${target}${next.toString() ? `?${next.toString()}` : ''}`, {
      replace: true,
      state: isDetail ? { searchReturnTo: `${location.pathname}${location.search}` } : location.state
    });
  };

  const onClearSearch = () => {
    const searchReturnTo = (location.state as { searchReturnTo?: string } | null)?.searchReturnTo;
    if (searchReturnTo) {
      navigate(-1);
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.delete('q');
    setSearchParams(next);
  };

  const onSortChange = (key: SortKey) => {
    const next = {
      key,
      order: sortConfig.key === key && sortConfig.order === 'desc' ? 'asc' : 'desc'
    } as const;
    setSortConfig(next);
    writeSortConfig(next);
  };

  const contextValue = {
    searchTerm,
    sortConfig,
    onTagChange,
    onSearchChange,
    onClearSearch,
    onSortChange,
    createRequestToken
  };

  return (
    <PublicNavigationContext.Provider value={contextValue}>
      {!isAdminRoute && (
        <PublicTopNav
          iconUrl={data.settings.iconUrl}
          title={data.settings.title}
          tags={data.tags}
          activeTag={activeTag}
          totalCards={data.cards.length}
          cardStats={cardStats}
          onTagChange={onTagChange}
          searchTerm={searchTerm}
          onSearchChange={onSearchChange}
          onClearSearch={onClearSearch}
          sortKey={sortConfig.key}
          sortOrder={sortConfig.order}
          onSortChange={onSortChange}
          isAdmin={isAdmin}
          onCreateClick={() => setCreateRequestToken((value) => value + 1)}
          theme={theme}
          toggleTheme={toggleTheme}
          overlay={isDetail || location.pathname === '/'}
          narrow={isDetail}
        />
      )}
      {children}
    </PublicNavigationContext.Provider>
  );
};

export const usePublicNavigation = () => {
  const context = useContext(PublicNavigationContext);
  if (!context) throw new Error('usePublicNavigation must be used inside PublicNavigationProvider');
  return context;
};
