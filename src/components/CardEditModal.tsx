
import React, { useState, useEffect, useRef } from 'react';
import { Loader2, PlayCircle, ThumbsUp, Upload, Trash2, Eye, Star } from 'lucide-react';
import { createPortal } from 'react-dom';
import { CardData, Tag } from '../types';
import { Modal, Input, Select, TextArea, Button, ImagePreview } from './Common';
import { DateField } from './card/DateField';
import { getCardCoverUrl } from '../utils/cardCover';

const COVER_TEXT_SHADOW = '[text-shadow:0_0_2px_rgba(0,0,0,1),0_0_6px_rgba(0,0,0,0.65)]';

interface CardEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  initialCard: Partial<CardData>;
  tags: Tag[];
  onSave: (card: Partial<CardData>) => Promise<void>;
}

export const CardEditModal: React.FC<CardEditModalProps> = ({
  isOpen, onClose, title, initialCard, tags, onSave
}) => {
  const [card, setCard] = useState<Partial<CardData>>(initialCard);
  const [saving, setSaving] = useState(false);
  const [isCoverPreviewOpen, setIsCoverPreviewOpen] = useState(false);
  const localCoverInputRef = useRef<HTMLInputElement | null>(null);

  // 当外部传入的 initialCard 变化或模态框打开时，重置内部状态
  useEffect(() => {
    if (isOpen) {
      setCard(initialCard);
      setIsCoverPreviewOpen(false);
    }
  }, [isOpen, initialCard]);

  const handleSaveClick = async () => {
    setSaving(true);
    await onSave(card);
    setSaving(false);
  };

  const handleLocalCoverChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result) return;
      setCard((prev) => ({ ...prev, coverLocalData: result }));
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const coverPreviewSrc = getCardCoverUrl(card, 'card');
  const previewTagNames = (card.tagIds || [])
    .map((tid) => tags.find((t) => t.id === tid)?.name)
    .filter((name): name is string => !!name);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} className="max-w-7xl w-full">
      <div className="flex flex-col md:flex-row gap-4 md:gap-5">
        {/* 左侧：主要信息 */}
        <div className="flex-1 space-y-4 glass-panel rounded-2xl p-4 md:p-5">
          <Input
            label="标题"
            value={card.title || ''}
            onChange={e => setCard({...card, title: e.target.value})}
            className="h-11 text-base"
          />

          <div className="flex items-end gap-4">
            <div className="flex-1">
               <Select
                 label="分类"
                 options={tags}
                 value={card.tagIds?.[0] || ''}
                 onChange={val => setCard({...card, tagIds: val ? [val] : []})}
                 placeholder="选择分类..."
               />
            </div>

            {/* 状态开关组 */}
            <div className="flex items-end gap-2 self-end">
              <button
                type="button"
                onClick={() => setCard({...card, isRecommended: !card.isRecommended})}
                className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border transition-all shrink-0 ${card.isRecommended ? 'bg-amber-500/20 border-amber-400/60 text-amber-700 dark:text-amber-300' : 'bg-[color:var(--surface)] border-[color:var(--line)] text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]'}`}
                title="推荐"
              >
                <ThumbsUp size={16} />
              </button>
              <button
                type="button"
                onClick={() => setCard({...card, isWatching: !card.isWatching})}
                className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border transition-all shrink-0 ${card.isWatching ? 'bg-sky-500/20 border-sky-400/60 text-sky-700 dark:text-sky-300' : 'bg-[color:var(--surface)] border-[color:var(--line)] text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]'}`}
                title="观看中"
              >
                <PlayCircle size={16} />
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <Input
              label="封面链接 (URL)"
              value={card.coverUrl || ''}
              onChange={e => setCard({...card, coverUrl: e.target.value})}
              className="h-11"
            />
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-bold text-[color:var(--text-secondary)] uppercase">本地封面</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => localCoverInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[color:var(--line)] text-xs font-semibold text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] hover:border-[color:var(--accent)] transition-colors"
                  >
                    <Upload size={13} />
                    上传图片
                  </button>
                  {card.coverLocalData && (
                    <button
                      type="button"
                      onClick={() => setCard((prev) => ({ ...prev, coverLocalData: '' }))}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[color:var(--line)] text-xs font-semibold text-[color:var(--text-secondary)] hover:text-red-600 hover:border-red-300 transition-colors"
                    >
                      <Trash2 size={13} />
                      清除
                    </button>
                  )}
                </div>
              </div>
              <input
                ref={localCoverInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLocalCoverChange}
              />
              <button
                type="button"
                aria-label="预览卡片封面"
                className="relative w-full h-28 md:h-20 rounded-xl border border-[color:var(--line)] overflow-hidden bg-[color:var(--surface-muted)] cursor-zoom-in"
                onClick={() => setIsCoverPreviewOpen(true)}
              >
                <ImagePreview src={coverPreviewSrc} alt={card.title || '封面预览'} className="w-full h-full" />
                <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/45 via-transparent to-transparent" />
                <div className="absolute right-2 bottom-2 pointer-events-none inline-flex items-center gap-1 rounded-md bg-black/55 text-white px-2 py-1 text-[10px] font-semibold">
                  <Eye size={11} />
                  预览卡片
                </div>
              </button>
            </div>
            <div className="flex items-center justify-between gap-4">
              <label className="text-xs font-bold text-[color:var(--text-secondary)] uppercase">评分</label>
              <div className="relative flex-1 h-8 flex items-center">
                <div className="absolute inset-x-0 h-2 rounded-full bg-[color:var(--surface)] border border-[color:var(--line)] overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-amber-400 to-amber-500" style={{ width: `${((card.rating || 0) / 5) * 100}%` }} />
                </div>
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="0.1"
                  className="relative w-full h-2 appearance-none bg-transparent cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-amber-500 [&::-webkit-slider-thumb]:shadow [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-amber-500"
                  value={card.rating || 0}
                  onChange={e => setCard({...card, rating: parseFloat(parseFloat(e.target.value).toFixed(1))})}
                />
              </div>
              <span className="text-sm font-bold text-[color:var(--text-primary)] w-8 text-right">
                {(card.rating || 0).toFixed(1)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <DateField
              label="开始日期"
              value={card.startDate || ''}
              onChange={(val) => setCard({ ...card, startDate: val })}
            />
            <DateField
              label="结束日期"
              value={card.endDate || ''}
              onChange={(val) => setCard({ ...card, endDate: val })}
            />
          </div>
        </div>

        {/* 右侧：观后感 + 保存按钮 */}
        <div className="flex-1 flex flex-col gap-4 glass-panel rounded-2xl p-4 md:p-5">
          <div className="flex-1 flex flex-col h-full">
            <TextArea
              label="观后感"
              value={card.description || ''}
              onChange={e => setCard({...card, description: e.target.value})}
              className="flex-1 min-h-[260px] md:min-h-[320px] text-base !resize-none"
              style={{ height: '100%' }}
              wrapperClassName="flex-1 flex flex-col h-full"
            />
          </div>
          <Button onClick={handleSaveClick} className="w-full h-14 rounded-2xl text-base shrink-0" disabled={saving}>
            {saving ? <Loader2 className="animate-spin" /> : '保存内容'}
          </Button>
        </div>
      </div>

      {isCoverPreviewOpen && createPortal(
        <div className="fixed inset-0 z-[2300] bg-black/65 backdrop-blur-sm p-4 flex items-center justify-center">
          <button type="button" aria-label="关闭卡片预览" className="absolute inset-0" onClick={() => setIsCoverPreviewOpen(false)} />
          <div className="relative w-full max-w-md">
            <div className="mb-3 flex items-center justify-between text-white">
              <p className="text-xs tracking-[0.18em] uppercase">卡片效果预览</p>
              <button
                type="button"
                onClick={() => setIsCoverPreviewOpen(false)}
                className="px-2.5 py-1.5 rounded-md bg-white/15 hover:bg-white/25 text-xs font-semibold"
              >
                关闭
              </button>
            </div>
            <div className={`group relative rounded-2xl aspect-video overflow-hidden ${
              card.isWatching
                ? 'border border-sky-300/80 dark:border-sky-400/30 shadow-[0_10px_30px_rgba(56,189,248,0.18)]'
                : card.isRecommended
                  ? 'border border-amber-300/90 dark:border-amber-400/35 shadow-[0_12px_32px_rgba(217,140,38,0.24)]'
                  : 'border border-[color:var(--line)] bg-black/5 dark:bg-white/5 shadow-sm'
            }`}>
              <div className="absolute inset-0 rounded-2xl overflow-hidden isolate" style={{ WebkitMaskImage: '-webkit-radial-gradient(white, black)' }}>
                <ImagePreview src={coverPreviewSrc} alt={card.title || '封面预览'} className="w-full h-full" />
              </div>

              <div className="absolute bottom-0 left-0 right-0 text-white flex flex-col justify-end pt-4 pr-4 pb-3 pl-3 z-10">
                <div className="flex items-center gap-1.5 overflow-hidden whitespace-nowrap">
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/40 border border-white/15 backdrop-blur-sm text-[10px] font-semibold leading-none flex-shrink-0">
                    <Star size={10} className="text-amber-300 fill-amber-300" />
                    {(card.rating || 0).toFixed(1)}
                  </span>
                  {previewTagNames.map((name) => (
                    <span key={name} className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-black/40 border border-white/15 backdrop-blur-sm text-[10px] font-semibold leading-none flex-shrink-0">
                      {name}
                    </span>
                  ))}
                </div>
                <h3 className={`mt-1 -mx-2 px-2 font-display text-xl leading-tight line-clamp-1 ${COVER_TEXT_SHADOW}`}>{card.title || '未命名作品'}</h3>
                <p className={`-mx-2 px-2 pt-1.5 truncate font-medium text-[11px] ${COVER_TEXT_SHADOW}`}>{card.description || '这里会显示卡片描述内容。'}</p>
              </div>

              {card.isRecommended && (
                <div className="absolute top-0 left-0 bg-amber-500 text-white p-2.5 rounded-br-2xl shadow-lg z-20 pointer-events-none">
                  <ThumbsUp size={16} />
                </div>
              )}
              {card.isWatching && !card.isRecommended && (
                <div className="absolute top-0 left-0 bg-sky-500 text-white p-2.5 rounded-br-2xl shadow-lg z-20 pointer-events-none">
                  <PlayCircle size={16} />
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </Modal>
  );
};
