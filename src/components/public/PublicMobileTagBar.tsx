import React from 'react';
import { LayoutGrid, ThumbsUp, PlayCircle } from 'lucide-react';
import type { Tag } from '../../types';

interface PublicMobileTagBarProps {
  iconUrl: string;
  title: string;
  tags: Tag[];
  activeTag: string;
  onTagChange: (tagId: string) => void;
}

// 移动端顶部：logo + 横向分类滚动条
export const PublicMobileTagBar: React.FC<PublicMobileTagBarProps> = ({
  iconUrl, title, tags, activeTag, onTagChange
}) => (
  <div className="lg:hidden fade-up flex flex-col gap-4 mb-6">
    <div className="flex items-center gap-3" onClick={() => window.location.href = '/'}>
      <img src={iconUrl} alt="Logo" className="w-9 h-9 object-contain" />
      <div>
        <p className="font-display text-xl text-[color:var(--text-primary)] leading-tight">{title}</p>
        <p className="text-[11px] tracking-[0.22em] uppercase text-[color:var(--text-secondary)]">Cinema Archive</p>
      </div>
    </div>
    <div className="flex overflow-x-auto gap-2 no-scrollbar pb-2 mask-linear-fade">
      <button onClick={() => onTagChange('all')} className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold transition-all flex-shrink-0 flex items-center gap-2 border ${activeTag === 'all' ? 'bg-[color:var(--surface)]/85 border-[color:var(--line)] text-[color:var(--text-primary)]' : 'bg-[color:var(--surface)]/60 border-[color:var(--line)] text-[color:var(--text-secondary)]'}`} title="全部展示"><LayoutGrid size={18} /></button>

      <button onClick={() => onTagChange('recommended')} className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold transition-all flex-shrink-0 flex items-center gap-2 ${activeTag === 'recommended' ? 'bg-amber-500 text-white shadow-md' : 'bg-[color:var(--surface)]/60 border border-[color:var(--line)] text-amber-700 dark:text-amber-400'}`} title="推荐"><ThumbsUp size={18} /></button>

      <button onClick={() => onTagChange('watching')} className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold transition-all flex-shrink-0 flex items-center gap-2 ${activeTag === 'watching' ? 'bg-sky-500 text-white shadow-md' : 'bg-[color:var(--surface)]/60 border border-[color:var(--line)] text-sky-700 dark:text-sky-400'}`} title="观看中"><PlayCircle size={18} /></button>

      {tags.map(tag => (
        <button key={tag.id} onClick={() => onTagChange(tag.id)} className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold transition-all flex-shrink-0 border ${activeTag === tag.id ? 'bg-[color:var(--surface)]/85 border-[color:var(--line)] text-[color:var(--text-primary)]' : 'bg-[color:var(--surface)]/60 border-[color:var(--line)] text-[color:var(--text-secondary)]'}`}>{tag.name}</button>
      ))}
    </div>
  </div>
);
