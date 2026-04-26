import React, { useMemo, useRef, useEffect } from 'react';
import { LayoutGrid, ThumbsUp, PlayCircle, Moon, Sun, Monitor, ChevronsLeft, ChevronsRight } from 'lucide-react';
import type { Tag } from '../../types';
import type { CardStats } from '../../utils/cardStats';
import { getTagIcon } from '../../utils/tagIcons';

interface PublicSidebarProps {
  iconUrl: string;
  title: string;
  tags: Tag[];
  activeTag: string;
  totalCards: number;
  cardStats: CardStats;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (updater: (prev: boolean) => boolean) => void;
  onTagChange: (tagId: string) => void;
  theme: 'light' | 'dark' | 'system';
  toggleTheme: () => void;
}

// 桌面端侧边栏：logo + 分类导航 + 主题/折叠
export const PublicSidebar: React.FC<PublicSidebarProps> = ({
  iconUrl, title, tags, activeTag, totalCards, cardStats,
  sidebarCollapsed, setSidebarCollapsed, onTagChange, theme, toggleTheme
}) => {
  const ThemeIcon = useMemo(() => {
    if (theme === 'light') return Sun;
    if (theme === 'dark') return Moon;
    return Monitor;
  }, [theme]);

  // 三连击 logo 进后台：单击延时 400ms 跳首页，期间累计满 3 次改跳 /tat
  // /tat 路由由 Admin 组件按需展示登录页或后台首页
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

  return (
    <aside className={`hidden lg:flex ${sidebarCollapsed ? 'lg:w-24' : 'lg:w-72'} lg:h-screen lg:sticky lg:top-0 p-5 lg:px-5 flex-col z-40 border-r border-[color:var(--line)] bg-[color:var(--surface-muted)] backdrop-blur-xl transition-all duration-300`}>
      <div className="fade-up mb-10 cursor-pointer" onClick={handleLogoClick}>
        <div className="relative h-9">
          <img
            src={iconUrl}
            alt="Logo"
            className={`absolute top-0 w-9 h-9 object-contain transition-[left,transform] ease-in-out ${sidebarCollapsed ? 'left-1/2 -translate-x-1/2' : 'left-0 translate-x-0'}`}
            style={{ transitionDuration: sidebarCollapsed ? '340ms' : '680ms' }}
          />
          <div className={`absolute left-12 top-1/2 -translate-y-1/2 overflow-hidden transition-all duration-500 ease-in-out ${sidebarCollapsed ? 'max-w-0 opacity-0 translate-x-1' : 'max-w-[180px] opacity-100 translate-x-0'}`}>
            <p className="font-display text-xl leading-tight text-[color:var(--text-primary)] whitespace-nowrap">{title}</p>
            <p className="text-[11px] tracking-[0.22em] uppercase text-[color:var(--text-secondary)] whitespace-nowrap">Cinema Archive</p>
          </div>
        </div>
      </div>

      <nav className="fade-up-delay-1 flex flex-col gap-1.5 overflow-y-auto no-scrollbar flex-1 pr-1">
        <button onClick={() => onTagChange('all')} className={`group relative flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all ${activeTag === 'all' ? 'bg-[color:var(--surface)]/85 border-[color:var(--line)] text-[color:var(--text-primary)] shadow-sm' : 'border-transparent text-[color:var(--text-secondary)] hover:bg-[color:var(--surface)]/78 hover:border-[color:var(--line)] hover:text-[color:var(--text-primary)]'}`}>
          <span className={`absolute left-1 top-2 bottom-2 w-0.5 rounded-full bg-[color:var(--accent)] transition-opacity ${activeTag === 'all' ? 'opacity-100' : 'opacity-0 group-hover:opacity-70'}`} />
          <div className="flex items-center gap-2 min-w-0">
            <span className={`transition-transform duration-300 ${sidebarCollapsed ? 'translate-x-1.5' : 'translate-x-0'}`}><LayoutGrid size={14} /></span>
            <span className={`text-sm font-semibold whitespace-nowrap overflow-hidden transition-all duration-300 ${sidebarCollapsed ? 'max-w-0 opacity-0 -translate-x-1' : 'max-w-[120px] opacity-100 translate-x-0'}`}>全部展示</span>
          </div>
          <span className={`text-[10px] font-mono opacity-70 overflow-hidden transition-all duration-300 ${sidebarCollapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-12 opacity-100 ml-2'}`}>{totalCards}</span>
        </button>

        <button onClick={() => onTagChange('recommended')} className={`group relative flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all ${activeTag === 'recommended' ? 'bg-[color:var(--surface)]/85 border-[color:var(--line)] text-[color:var(--text-primary)] shadow-sm' : 'border-transparent text-[color:var(--text-secondary)] hover:bg-[color:var(--surface)]/78 hover:border-[color:var(--line)] hover:text-[color:var(--text-primary)]'}`}>
          <span className={`absolute left-1 top-2 bottom-2 w-0.5 rounded-full bg-amber-500 transition-opacity ${activeTag === 'recommended' ? 'opacity-100' : 'opacity-0 group-hover:opacity-70'}`} />
          <div className="flex items-center gap-2 min-w-0">
            <span className={`transition-transform duration-300 ${sidebarCollapsed ? 'translate-x-1.5' : 'translate-x-0'}`}><ThumbsUp size={14} /></span>
            <span className={`text-sm font-semibold whitespace-nowrap overflow-hidden transition-all duration-300 ${sidebarCollapsed ? 'max-w-0 opacity-0 -translate-x-1' : 'max-w-[120px] opacity-100 translate-x-0'}`}>精选推荐</span>
          </div>
          <span className={`text-[10px] font-mono opacity-70 overflow-hidden transition-all duration-300 ${sidebarCollapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-12 opacity-100 ml-2'}`}>{cardStats.recommendedCount}</span>
        </button>

        <button onClick={() => onTagChange('watching')} className={`group relative flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all ${activeTag === 'watching' ? 'bg-[color:var(--surface)]/85 border-[color:var(--line)] text-[color:var(--text-primary)] shadow-sm' : 'border-transparent text-[color:var(--text-secondary)] hover:bg-[color:var(--surface)]/78 hover:border-[color:var(--line)] hover:text-[color:var(--text-primary)]'}`}>
          <span className={`absolute left-1 top-2 bottom-2 w-0.5 rounded-full bg-sky-500 transition-opacity ${activeTag === 'watching' ? 'opacity-100' : 'opacity-0 group-hover:opacity-70'}`} />
          <div className="flex items-center gap-2 min-w-0">
            <span className={`transition-transform duration-300 ${sidebarCollapsed ? 'translate-x-1.5' : 'translate-x-0'}`}><PlayCircle size={14} /></span>
            <span className={`text-sm font-semibold whitespace-nowrap overflow-hidden transition-all duration-300 ${sidebarCollapsed ? 'max-w-0 opacity-0 -translate-x-1' : 'max-w-[120px] opacity-100 translate-x-0'}`}>正在观看</span>
          </div>
          <span className={`text-[10px] font-mono opacity-70 overflow-hidden transition-all duration-300 ${sidebarCollapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-12 opacity-100 ml-2'}`}>{cardStats.watchingCount}</span>
        </button>

        <div className="h-px bg-[color:var(--line)]/70 my-4 mx-4" />
        {tags.map(tag => (
          <button key={tag.id} onClick={() => onTagChange(tag.id)} className={`group relative flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all ${activeTag === tag.id ? 'bg-[color:var(--surface)]/85 border-[color:var(--line)] text-[color:var(--text-primary)] shadow-sm' : 'border-transparent text-[color:var(--text-secondary)] hover:bg-[color:var(--surface)]/78 hover:border-[color:var(--line)] hover:text-[color:var(--text-primary)]'}`}>
            <span className={`absolute left-1 top-2 bottom-2 w-0.5 rounded-full bg-[color:var(--accent)] transition-opacity ${activeTag === tag.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-70'}`} />
            <div className="flex items-center gap-2 min-w-0">
              <span className={`w-4 h-4 flex items-center justify-center transition-transform duration-300 ${sidebarCollapsed ? 'translate-x-1.5' : 'translate-x-0'}`}>{getTagIcon(tag.icon, 'w-4 h-4') || <span className="text-[11px] font-bold">{tag.name.slice(0, 1)}</span>}</span>
              <span className={`text-sm font-semibold whitespace-nowrap overflow-hidden transition-all duration-300 ${sidebarCollapsed ? 'max-w-0 opacity-0 -translate-x-1' : 'max-w-[120px] opacity-100 translate-x-0'}`}>{tag.name}</span>
            </div>
            <span className={`text-[10px] font-mono opacity-70 overflow-hidden transition-all duration-300 ${sidebarCollapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-12 opacity-100 ml-2'}`}>{cardStats.tagCountMap.get(tag.id) || 0}</span>
          </button>
        ))}
      </nav>

      <div className="fade-up-delay-2 mt-auto pt-5 flex flex-col gap-1.5">
        <div className="h-px mb-1.5 bg-gradient-to-r from-transparent via-[color:var(--line)] to-transparent" />
        <button
          onClick={toggleTheme}
          className="group relative flex items-center px-3 py-2.5 rounded-xl border border-transparent text-[color:var(--text-secondary)] hover:bg-[color:var(--surface)]/78 hover:border-[color:var(--line)] hover:text-[color:var(--text-primary)] transition-all"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className={`transition-transform duration-300 ${sidebarCollapsed ? 'translate-x-1.5' : 'translate-x-0'}`}><ThemeIcon size={14} /></span>
            <span className={`text-sm font-semibold whitespace-nowrap overflow-hidden transition-all duration-300 ${sidebarCollapsed ? 'max-w-0 opacity-0 -translate-x-1' : 'max-w-[120px] opacity-100 translate-x-0'}`}>主题</span>
          </div>
        </button>

        <button
          onClick={() => setSidebarCollapsed((prev) => !prev)}
          className="group relative flex items-center px-3 py-2.5 rounded-xl border border-transparent text-[color:var(--text-secondary)] hover:bg-[color:var(--surface)]/78 hover:border-[color:var(--line)] hover:text-[color:var(--text-primary)] transition-all"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className={`relative w-3.5 h-3.5 transition-transform duration-300 ${sidebarCollapsed ? 'translate-x-1.5' : 'translate-x-0'}`}>
              <span className={`absolute inset-0 flex items-center justify-center transition-all duration-[460ms] ease-in-out ${sidebarCollapsed ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}><ChevronsLeft size={14} /></span>
              <span className={`absolute inset-0 flex items-center justify-center transition-all duration-[460ms] ease-in-out ${sidebarCollapsed ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}><ChevronsRight size={14} /></span>
            </span>
            <span className={`text-sm font-semibold whitespace-nowrap overflow-hidden transition-all duration-300 ${sidebarCollapsed ? 'max-w-0 opacity-0 -translate-x-1' : 'max-w-[120px] opacity-100 translate-x-0'}`}>{sidebarCollapsed ? '展开' : '折叠'}</span>
          </div>
        </button>
      </div>
    </aside>
  );
};
