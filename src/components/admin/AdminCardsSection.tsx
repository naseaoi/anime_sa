import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Edit2, Image as ImageIcon, Plus, Search, ThumbsUp, Trash2, X } from 'lucide-react';
import { CardData, PublicData } from '../../types';
import { Button, ConfirmModal, Rating, useToast } from '../Common';
import { CardEditModal } from '../CardEditModal';
import { persistCardCover } from '../../services/coverAssetService';

interface AdminCardsSectionProps {
  data: PublicData;
  onUpdate: (d: PublicData) => void;
}

export const AdminCardsSection: React.FC<AdminCardsSectionProps> = ({ data, onUpdate }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<Partial<CardData>>({});
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const { showToast } = useToast();
  const itemsPerPage = 15;

  const filtered = useMemo(
    () => data.cards
      .filter((c) => c.title.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
    [data.cards, search]
  );
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedCards = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleSave = async (cardData: Partial<CardData>) => {
    try {
      const newCards = [...data.cards];
      const now = Date.now();
      if (cardData.id) {
        const idx = newCards.findIndex((c) => c.id === cardData.id);
        if (idx !== -1) {
          const mergedCard = { ...newCards[idx], ...cardData, id: newCards[idx].id, updatedAt: now } as CardData;
          newCards[idx] = await persistCardCover(mergedCard);
        }
      } else {
        const draftCard = {
          id: now.toString(),
          title: cardData.title || '',
          coverUrl: cardData.coverUrl || '',
          coverLocalData: cardData.coverLocalData || '',
          description: cardData.description || '',
          startDate: cardData.startDate || '',
          endDate: cardData.endDate || '',
          rating: cardData.rating || 0,
          tagIds: cardData.tagIds || [],
          isRecommended: !!cardData.isRecommended,
          isWatching: !!cardData.isWatching,
          createdAt: now,
          updatedAt: now
        } as CardData;
        newCards.push(await persistCardCover(draftCard));
      }
      onUpdate({ ...data, cards: newCards });
      setIsModalOpen(false);
    } catch (e: any) {
      showToast(`封面处理失败: ${e?.message || '未知错误'}`, 'error');
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="glass-panel rounded-2xl p-4 md:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[color:var(--text-secondary)]" size={18} />
          <input
            placeholder="搜索记录..."
            className="w-full pl-11 pr-10 py-3 bg-[color:var(--surface-muted)] border border-[color:var(--line)] rounded-xl text-sm font-bold text-[color:var(--text-primary)] focus:outline-none focus:border-[color:var(--accent)] focus:ring-4 focus:ring-[color:var(--accent-soft)] transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]">
              <X size={16} />
            </button>
          )}
        </div>
        <Button
          onClick={() => {
            setEditingCard({ tagIds: [], rating: 0, description: '', startDate: '', endDate: '', isRecommended: false, isWatching: false });
            setIsModalOpen(true);
          }}
          size="md"
          className="rounded-xl h-11 px-6"
        >
          <Plus size={18} /> 新建记录
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        {paginatedCards.map((card) => (
          <div key={card.id} className={`bg-[color:var(--surface-muted)] rounded-xl border flex items-center p-3 gap-4 group transition-all shadow-sm ${card.isRecommended ? 'border-amber-300/70 shadow-[0_10px_26px_rgba(217,140,38,0.14)]' : 'border-[color:var(--line)] hover:border-[color:var(--accent)]/45'}`}>
            <div className="w-12 h-12 shrink-0 flex items-center justify-center rounded-lg bg-[color:var(--surface)]/70 border border-[color:var(--line)]">
              {card.coverLocalData || card.coverUrl ? (
                <ImageIcon size={20} className="text-emerald-500 dark:text-emerald-400" />
              ) : (
                <ImageIcon size={20} className="text-[color:var(--text-secondary)]/45" />
              )}
            </div>

            <div className="flex-1 min-w-0 flex items-center gap-3">
              <div className="min-w-0">
                <h4 className="font-bold text-[color:var(--text-primary)] text-sm truncate">{card.title}</h4>
                <div className="text-xs text-[color:var(--text-secondary)] truncate mt-0.5">{new Date(card.createdAt).toLocaleDateString()}</div>
              </div>

              <div className="ml-auto flex items-center justify-end gap-2 sm:gap-3">
                <div className="hidden md:flex items-center">
                  <Rating value={card.rating} />
                </div>
                <div className="md:hidden text-xs font-bold text-[color:var(--text-secondary)] min-w-[30px] text-right">{(card.rating || 0).toFixed(1)}</div>

                <div className="hidden lg:flex items-center">
                <span className="bg-[color:var(--surface)]/70 text-[color:var(--text-secondary)] px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide truncate max-w-full border border-[color:var(--line)]">
                  {data.tags.find((t) => t.id === card.tagIds[0])?.name || '未分类'}
                </span>
                </div>

                <div className="hidden lg:flex justify-center w-5">
                  {card.isRecommended && <ThumbsUp size={14} className="text-amber-500" />}
                </div>

                <div className="flex items-center gap-1 sm:gap-2">
                  <button onClick={() => { setEditingCard(card); setIsModalOpen(true); }} className="p-2 text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] hover:bg-[color:var(--accent-soft)] rounded-lg transition-colors"><Edit2 size={16} /></button>
                  <button onClick={() => setDeleteId(card.id)} className="p-2 text-[color:var(--text-secondary)] hover:text-red-500 hover:bg-red-50/80 rounded-lg transition-colors"><Trash2 size={16} /></button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-8">
          <Button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} variant="secondary" size="sm" className="px-3"><ChevronLeft size={16} /></Button>
          <span className="text-sm font-bold text-stone-400">Page {currentPage} of {totalPages}</span>
          <Button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} variant="secondary" size="sm" className="px-3"><ChevronRight size={16} /></Button>
        </div>
      )}

      <CardEditModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCard.id ? '编辑记录' : '新建记录'}
        initialCard={editingCard}
        tags={data.tags}
        onSave={handleSave}
      />

      <ConfirmModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => onUpdate({ ...data, cards: data.cards.filter((c) => c.id !== deleteId) })}
        title="删除确认"
        message="确定要永久移除此记录吗？"
        confirmText="删除"
        type="danger"
      />
    </div>
  );
};
