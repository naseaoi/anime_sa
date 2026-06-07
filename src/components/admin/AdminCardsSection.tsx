import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Edit2, Image as ImageIcon, Plus, Search, ThumbsUp, Trash2, X } from 'lucide-react';
import { CardData, PublicData } from '../../types';
import { Button, ConfirmModal, Rating, useToast } from '../Common';
import { CardEditModal } from '../CardEditModal';
import { persistCardCover } from '../../services/coverAssetService';
import { getCardCoverUrl } from '../../utils/cardCover';
import { AdminBadge, AdminIconButton, AdminPanel, AdminToolbar } from './ui';

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

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const filtered = useMemo(
    () => data.cards
      .filter((c) => c.title.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
    [data.cards, search]
  );

  const tagNameMap = useMemo(() => {
    const map = new Map<string, string>();
    data.tags.forEach((tag) => map.set(tag.id, tag.name));
    return map;
  }, [data.tags]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const paginatedCards = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const firstResult = filtered.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const lastResult = Math.min(currentPage * itemsPerPage, filtered.length);
  const formatDate = (ts?: number) => (ts ? new Date(ts).toLocaleDateString() : '-');

  const openCreateModal = () => {
    setEditingCard({ tagIds: [], rating: 0, description: '', startDate: '', endDate: '', isRecommended: false, isWatching: false });
    setIsModalOpen(true);
  };

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
    <div className="space-y-4">
      <AdminToolbar>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--text-secondary)]" size={17} />
            <input
              placeholder="搜索卡片标题"
              className="h-10 w-full rounded-[6px] border border-[color:var(--line)] bg-[color:var(--surface)] pl-10 pr-9 text-sm text-[color:var(--text-primary)] outline-none transition-all placeholder:text-[color:var(--text-secondary)]/60 focus:border-[color:var(--accent)] focus:ring-4 focus:ring-[color:var(--accent-soft)]"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-[6px] text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-soft)] hover:text-[color:var(--text-primary)]"
                aria-label="清空搜索"
                title="清空搜索"
              >
                <X size={15} />
              </button>
            )}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:justify-end">
            <span className="text-sm text-[color:var(--text-secondary)]">
              {filtered.length > 0 ? `${firstResult}-${lastResult} / ${filtered.length}` : '0 条结果'}
            </span>
            <Button onClick={openCreateModal} size="md" className="h-10 rounded-[6px] px-4">
              <Plus size={17} /> 新建卡片
            </Button>
          </div>
        </div>
      </AdminToolbar>

      <AdminPanel bodyClassName="p-0">
        <div className="hidden grid-cols-[minmax(0,1fr)_120px_108px_92px_112px_86px] gap-3 border-b border-[color:var(--line)] px-4 py-3 text-xs font-semibold uppercase text-[color:var(--text-secondary)] lg:grid">
          <div>卡片</div>
          <div>分类</div>
          <div>评分</div>
          <div>状态</div>
          <div>创建时间</div>
          <div className="text-right">操作</div>
        </div>

        <div className="divide-y divide-[color:var(--line)]">
          {paginatedCards.length === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center gap-2 px-4 py-10 text-center">
              <Search size={24} className="text-[color:var(--text-secondary)]/70" />
              <div className="text-sm font-medium text-[color:var(--text-primary)]">没有匹配的卡片</div>
              <div className="text-xs text-[color:var(--text-secondary)]">调整搜索词或新建一条记录</div>
            </div>
          ) : paginatedCards.map((card) => {
            const coverUrl = getCardCoverUrl(card, 'thumb');
            const primaryTagName = tagNameMap.get(card.tagIds[0]) || '未分类';
            return (
              <div
                key={card.id}
                className={`grid gap-3 px-4 py-3 transition-colors hover:bg-[color:var(--bg-soft)] lg:grid-cols-[minmax(0,1fr)_120px_108px_92px_112px_86px] lg:items-center ${card.isRecommended ? 'bg-amber-50/45 dark:bg-amber-950/10' : ''}`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[6px] border border-[color:var(--line)] bg-[color:var(--bg-soft)]">
                    {coverUrl ? (
                      <ImageIcon size={18} className="text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <ImageIcon size={18} className="text-[color:var(--text-secondary)]/55" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h4 className="truncate text-sm font-semibold text-[color:var(--text-primary)]">{card.title || '未命名卡片'}</h4>
                    <div className="mt-1 flex flex-wrap items-center gap-2 lg:hidden">
                      <AdminBadge>{primaryTagName}</AdminBadge>
                      <span className="text-xs text-[color:var(--text-secondary)]">{formatDate(card.createdAt)}</span>
                    </div>
                  </div>
                </div>

                <div className="hidden min-w-0 lg:block">
                  <AdminBadge className="max-w-full truncate">{primaryTagName}</AdminBadge>
                </div>

                <div className="hidden items-center lg:flex">
                  <Rating value={card.rating} />
                </div>

                <div className="flex flex-wrap items-center gap-2 lg:gap-1">
                  {card.isRecommended && <AdminBadge tone="warning"><ThumbsUp size={12} className="mr-1" />推荐</AdminBadge>}
                  {card.isWatching && <AdminBadge tone="success">在看</AdminBadge>}
                  {!card.isRecommended && !card.isWatching && <AdminBadge>普通</AdminBadge>}
                </div>

                <div className="hidden text-sm text-[color:var(--text-secondary)] lg:block">{formatDate(card.createdAt)}</div>

                <div className="flex items-center justify-end gap-1">
                  <AdminIconButton
                    label="编辑"
                    tone="accent"
                    onClick={() => {
                      setEditingCard(card);
                      setIsModalOpen(true);
                    }}
                  >
                    <Edit2 size={15} />
                  </AdminIconButton>
                  <AdminIconButton label="删除" tone="danger" onClick={() => setDeleteId(card.id)}>
                    <Trash2 size={15} />
                  </AdminIconButton>
                </div>
              </div>
            );
          })}
        </div>
      </AdminPanel>

      {filtered.length > itemsPerPage && (
        <div className="flex items-center justify-between rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] px-3 py-2">
          <span className="text-sm text-[color:var(--text-secondary)]">第 {currentPage} / {totalPages} 页</span>
          <div className="flex items-center gap-2">
            <Button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} variant="secondary" size="sm" className="h-8 rounded-[6px] px-2">
              <ChevronLeft size={16} />
            </Button>
            <Button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} variant="secondary" size="sm" className="h-8 rounded-[6px] px-2">
              <ChevronRight size={16} />
            </Button>
          </div>
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
