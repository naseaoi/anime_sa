import React, { useMemo, useState } from 'react';
import { Search, X, Plus, ArrowUpDown, Sun, Moon, Monitor } from 'lucide-react';

export type SortKey = 'createdAt' | 'rating' | 'updatedAt';
export type SortOrder = 'desc' | 'asc';

interface PublicToolbarProps {
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
}

// 顶部工具栏：搜索 + 排序 + 移动端主题切换
export const PublicToolbar: React.FC<PublicToolbarProps> = ({
  searchTerm, onSearchChange, onClearSearch, sortKey, sortOrder, onSortChange,
  isAdmin, onCreateClick, theme, toggleTheme
}) => {
  const ThemeIcon = useMemo(() => {
    if (theme === 'light') return Sun;
    if (theme === 'dark') return Moon;
    return Monitor;
  }, [theme]);

  // 每次点击排序按钮累加，叠加到旋转角度上，保证连点同键也能持续触发旋转动画
  const [spinTick, setSpinTick] = useState(0);
  const handleSortClick = (key: SortKey) => {
    setSpinTick((t) => t + 1);
    onSortChange(key);
  };

  return (
    <div className="sticky top-3 z-30 mb-8 fade-up-delay-1">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-96 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[color:var(--text-secondary)] group-focus-within:text-[color:var(--text-primary)] transition-colors" size={16} />
            <input type="text" placeholder="搜索标题或简介" value={searchTerm} onChange={onSearchChange} className="w-full bg-[color:var(--surface)] border border-[color:var(--line)] rounded-2xl py-3 pl-12 pr-10 text-sm font-semibold text-[color:var(--text-primary)] placeholder:text-[color:var(--text-secondary)]/70 focus:outline-none focus:border-[color:var(--accent)] focus:ring-4 focus:ring-[color:var(--accent-soft)] transition-all" />
            {searchTerm && <button onClick={onClearSearch} className="absolute right-4 top-1/2 -translate-y-1/2 text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]"><X size={16} /></button>}
          </div>
          {isAdmin && (
            <button onClick={onCreateClick} className="bg-[color:var(--surface)] border border-[color:var(--line)] text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] hover:border-[color:var(--accent)] rounded-2xl w-12 flex items-center justify-center transition-all shadow-sm active:scale-95" title="快速添加">
              <Plus size={20} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex bg-[color:var(--surface)] border border-[color:var(--line)] p-1 rounded-xl">
            {(['createdAt', 'rating', 'updatedAt'] as SortKey[]).map((key) => {
              const active = sortKey === key;
              return (
                <button
                  key={key}
                  onClick={() => handleSortClick(key)}
                  className={`px-3.5 py-2 rounded-lg text-[11px] font-bold transition-all flex items-center ${active ? 'bg-[color:var(--accent-soft)] text-[color:var(--text-primary)]' : 'text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]'}`}
                >
                  <span>{key === 'createdAt' ? '创建' : key === 'rating' ? '评分' : '更新'}</span>
                  {/* 外层 span 控制显隐过渡，内层图标基于 spinTick 持续旋转，
                      保证点击同键切换升降 / 切换不同键都有旋转反馈 */}
                  <span
                    aria-hidden
                    className="inline-flex items-center overflow-hidden transition-[width,margin,opacity] duration-300 ease-out"
                    style={{
                      width: active ? 10 : 0,
                      marginLeft: active ? 8 : 0,
                      opacity: active ? 1 : 0,
                    }}
                  >
                    <ArrowUpDown
                      size={10}
                      className="shrink-0 transition-transform duration-300 ease-out"
                      style={{ transform: `rotate(${spinTick * 360 + (sortOrder === 'asc' ? 180 : 0)}deg)` }}
                    />
                  </span>
                </button>
              );
            })}
          </div>
          <button onClick={toggleTheme} className="lg:hidden p-3 bg-[color:var(--surface)] border border-[color:var(--line)] rounded-xl text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] transition-colors">
            <ThemeIcon size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};
