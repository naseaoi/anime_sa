import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutGrid, ThumbsUp, PlayCircle, Search, X, Plus,
  ArrowUpDown, Sun, Moon, Monitor, Library, Check
} from 'lucide-react';
import type { Tag } from '../../types';
import { resolveNavigationIconUrl } from '../../domain/publicData';
import type { CardStats } from '../../utils/cardStats';
import { getTagIcon } from '../../utils/tagIcons';
import type { SortKey, SortOrder } from '../../utils/browserState';

export type { SortKey, SortOrder } from '../../utils/browserState';

const SORT_LABELS: Record<SortKey, string> = {
  createdAt: '创建时间',
  rating: '评分',
  updatedAt: '更新时间'
};

interface PublicTopNavProps {
  iconUrl: string;
  title: string;
  tags: Tag[];
  activeTag: string;
  totalCards: number;
  cardStats: CardStats;
  onTagChange: (tagId: string) => void;
  searchTerm: string;
  onSearchChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onClearSearch: () => void;
  sortKey: SortKey;
  sortOrder: SortOrder;
  onSortChange: (key: SortKey) => void;
  isAdmin: boolean;
  onCreateClick: () => void;
  theme: 'light' | 'dark' | 'system';
  toggleTheme: () => void;
  overlay?: boolean;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  count: number;
}

// 顶部导航：logo（三连击进后台）+ 分区 + 搜索 + 排序 + 分区总览 + 主题
export const PublicTopNav: React.FC<PublicTopNavProps> = ({
  iconUrl, title, tags, activeTag, totalCards, cardStats, onTagChange,
  searchTerm, onSearchChange, onClearSearch,
  sortKey, sortOrder, onSortChange,
  isAdmin, onCreateClick, theme, toggleTheme, overlay = false
}) => {
  const [openMenu, setOpenMenu] = useState<'sort' | 'overview' | null>(null);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(() => searchTerm.length > 0);
  const [scrolled, setScrolled] = useState(false);
  const menuAreaRef = useRef<HTMLDivElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);
  const logoSrc = resolveNavigationIconUrl(iconUrl);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const ThemeIcon = useMemo(() => {
    if (theme === 'light') return Sun;
    if (theme === 'dark') return Moon;
    return Monitor;
  }, [theme]);

  // 三连击 logo 进后台：单击延时 400ms 跳首页，期间累计满 3 次改跳 /tat
  const tripleClickTimerRef = useRef<number | null>(null);
  const tripleClickCountRef = useRef(0);

  useEffect(() => () => {
    if (tripleClickTimerRef.current !== null) {
      window.clearTimeout(tripleClickTimerRef.current);
    }
  }, []);

  const handleLogoClick = () => {
    tripleClickCountRef.current += 1;
    if (tripleClickTimerRef.current !== null) {
      window.clearTimeout(tripleClickTimerRef.current);
      tripleClickTimerRef.current = null;
    }
    if (tripleClickCountRef.current >= 3) {
      tripleClickCountRef.current = 0;
      window.location.href = '/tat';
      return;
    }
    tripleClickTimerRef.current = window.setTimeout(() => {
      tripleClickCountRef.current = 0;
      tripleClickTimerRef.current = null;
      window.location.href = '/';
    }, 400);
  };

  useEffect(() => {
    if (!openMenu) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target;
      if (target instanceof Node && menuAreaRef.current?.contains(target)) return;
      setOpenMenu(null);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [openMenu]);

  useEffect(() => {
    if (mobileSearchOpen) mobileSearchInputRef.current?.focus();
  }, [mobileSearchOpen]);

  const navItems = useMemo<NavItem[]>(() => [
    { id: 'all', label: '全部', icon: <LayoutGrid size={14} />, count: totalCards },
    { id: 'recommended', label: '推荐', icon: <ThumbsUp size={14} className="text-amber-500" />, count: cardStats.recommendedCount },
    { id: 'watching', label: '在看', icon: <PlayCircle size={14} className="text-sky-500" />, count: cardStats.watchingCount },
    ...tags.map((tag) => ({
      id: tag.id,
      label: tag.name,
      icon: getTagIcon(tag.icon, 'w-3.5 h-3.5'),
      count: cardStats.tagCountMap.get(tag.id) || 0
    }))
  ], [tags, totalCards, cardStats]);

  const handleNavClick = (tagId: string) => {
    setOpenMenu(null);
    onTagChange(tagId);
  };

  const iconButtonClass = 'w-9 h-9 inline-flex items-center justify-center rounded-xl border border-transparent text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] hover:border-[color:var(--line)] hover:bg-[color:color-mix(in_srgb,var(--surface)_70%,transparent)] transition-all';
  const dropdownPanelClass = 'bg-[color:color-mix(in_srgb,var(--surface)_94%,transparent)] border border-[color:var(--line)] backdrop-blur-2xl shadow-[var(--shadow-lg)]';

  const renderSearchInput = (inputRef?: React.RefObject<HTMLInputElement>) => (
    <div className="relative w-full group">
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--text-secondary)] group-focus-within:text-[color:var(--text-primary)] transition-colors" size={14} />
      <input
        ref={inputRef}
        type="text"
        placeholder="搜索标题或简介"
        value={searchTerm}
        onChange={onSearchChange}
        className="w-full bg-[color:color-mix(in_srgb,var(--surface)_70%,transparent)] border border-[color:var(--line)] rounded-xl py-2 pl-9 pr-8 text-sm font-medium text-[color:var(--text-primary)] placeholder:text-[color:color-mix(in_srgb,var(--text-secondary)_70%,transparent)] focus:outline-none focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent-soft)] transition-all"
      />
      {searchTerm && (
        <button onClick={onClearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]">
          <X size={14} />
        </button>
      )}
    </div>
  );

  return (
    <header className={`sticky top-0 z-40 border-b transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300 ${overlay ? 'lg:-mb-16' : ''} ${scrolled ? 'backdrop-blur-2xl border-[color:color-mix(in_srgb,var(--line)_60%,transparent)] bg-[color:color-mix(in_srgb,var(--surface)_30%,transparent)] shadow-[0_10px_36px_rgba(0,0,0,0.10)]' : 'backdrop-blur-0 bg-transparent border-transparent shadow-none'}`}>
      <div className="relative z-10 px-[var(--page-x)]">
        <div className="h-14 lg:h-16 flex items-center gap-4 lg:gap-6">
          <button type="button" className="flex items-center gap-3 shrink-0 cursor-pointer select-none text-left" onClick={handleLogoClick}>
            <img src={logoSrc} alt="Logo" width={32} height={32} decoding="async" className="w-8 h-8 object-contain" />
            <div className="hidden sm:block">
              <p className="font-display text-lg leading-tight text-[color:var(--text-primary)] whitespace-nowrap">{title}</p>
              <p className="text-[9px] tracking-[0.24em] uppercase text-[color:var(--text-secondary)] whitespace-nowrap leading-none">Cinema Archive</p>
            </div>
          </button>

          <nav className="hidden lg:flex items-center gap-1 flex-1 min-w-0 overflow-x-auto no-scrollbar mask-linear-fade h-full">
            {navItems.map((item) => {
              const active = activeTag === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`relative h-full px-3 inline-flex items-center gap-1.5 text-sm font-semibold whitespace-nowrap transition-colors ${active ? 'text-[color:var(--text-primary)]' : 'text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]'}`}
                >
                  {item.icon && <span className="inline-flex items-center justify-center">{item.icon}</span>}
                  {item.label}
                  <span className={`absolute left-3 right-3 bottom-0 h-0.5 rounded-full bg-[color:var(--accent)] transition-opacity ${active ? 'opacity-100' : 'opacity-0'}`} />
                </button>
              );
            })}
          </nav>

          <div ref={menuAreaRef} className="flex items-center gap-1.5 ml-auto shrink-0">
            <div className="hidden md:block w-44 focus-within:w-64 transition-[width] duration-300">
              {renderSearchInput()}
            </div>
            <button
              onClick={() => setMobileSearchOpen((prev) => !prev)}
              className={`md:hidden ${iconButtonClass} ${mobileSearchOpen ? 'text-[color:var(--text-primary)]' : ''}`}
              title="搜索"
            >
              <Search size={16} />
            </button>

            <div className="relative">
              <button
                onClick={() => setOpenMenu((prev) => (prev === 'sort' ? null : 'sort'))}
                className={`${iconButtonClass} ${openMenu === 'sort' ? 'text-[color:var(--text-primary)] border-[color:var(--line)] bg-[color:color-mix(in_srgb,var(--surface)_70%,transparent)]' : ''}`}
                title={`排序：${SORT_LABELS[sortKey]}（${sortOrder === 'desc' ? '降序' : '升序'}）`}
              >
                <ArrowUpDown size={16} className={`transition-transform duration-300 ${sortOrder === 'asc' ? 'rotate-180' : ''}`} />
              </button>
              {openMenu === 'sort' && (
                <div className={`absolute right-0 top-full mt-2 w-44 ${dropdownPanelClass} rounded-xl p-1.5 z-50`}>
                  {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => {
                    const active = sortKey === key;
                    return (
                      <button
                        key={key}
                        onClick={() => onSortChange(key)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${active ? 'bg-[color:var(--accent-soft)] text-[color:var(--text-primary)]' : 'text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] hover:bg-[color:color-mix(in_srgb,var(--surface)_80%,transparent)]'}`}
                      >
                        <span>{SORT_LABELS[key]}</span>
                        {active && <span className="text-[10px] font-mono opacity-80">{sortOrder === 'desc' ? '降序' : '升序'}</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => setOpenMenu((prev) => (prev === 'overview' ? null : 'overview'))}
                className={`${iconButtonClass} ${openMenu === 'overview' ? 'text-[color:var(--text-primary)] border-[color:var(--line)] bg-[color:color-mix(in_srgb,var(--surface)_70%,transparent)]' : ''}`}
                title="分区总览"
              >
                <Library size={16} />
              </button>
              {openMenu === 'overview' && (
                <div className={`absolute right-0 top-full mt-2 w-56 max-h-[62vh] overflow-y-auto scrollbar-thinest ${dropdownPanelClass} rounded-xl p-1.5 z-50`}>
                  {navItems.map((item, index) => {
                    const active = activeTag === item.id;
                    return (
                      <React.Fragment key={item.id}>
                        {index === 3 && <div className="h-px bg-[color:color-mix(in_srgb,var(--line)_70%,transparent)] my-1.5 mx-2" />}
                        <button
                          onClick={() => handleNavClick(item.id)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${active ? 'bg-[color:var(--accent-soft)] text-[color:var(--text-primary)]' : 'text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] hover:bg-[color:color-mix(in_srgb,var(--surface)_80%,transparent)]'}`}
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <span className="w-4 inline-flex justify-center shrink-0">{item.icon || <Check size={12} className="opacity-0" />}</span>
                            <span className="truncate">{item.label}</span>
                          </span>
                          <span className="text-[10px] font-mono opacity-70 ml-2 shrink-0">{item.count}</span>
                        </button>
                      </React.Fragment>
                    );
                  })}
                </div>
              )}
            </div>

            <button onClick={toggleTheme} className={iconButtonClass} title="主题">
              <ThemeIcon size={16} />
            </button>

            {isAdmin && (
              <button onClick={onCreateClick} className={iconButtonClass} title="快速添加">
                <Plus size={18} />
              </button>
            )}
          </div>
        </div>

        {mobileSearchOpen && (
          <div className="md:hidden pb-3">
            {renderSearchInput(mobileSearchInputRef)}
          </div>
        )}

        <nav className="lg:hidden flex items-center gap-1.5 overflow-x-auto no-scrollbar mask-linear-fade pb-2.5 -mt-0.5">
          {navItems.map((item) => {
            const active = activeTag === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold whitespace-nowrap transition-all ${active ? 'border-[color:color-mix(in_srgb,var(--accent)_60%,transparent)] bg-[color:var(--accent-soft)] text-[color:var(--text-primary)]' : 'border-[color:var(--line)] bg-[color:color-mix(in_srgb,var(--surface)_60%,transparent)] text-[color:var(--text-secondary)]'}`}
              >
                {item.icon && <span className="inline-flex items-center justify-center">{item.icon}</span>}
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
