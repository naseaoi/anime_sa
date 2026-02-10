
import React, { useState, useEffect, useRef } from 'react';
import { Loader2, PlayCircle, ThumbsUp, CalendarDays, ChevronDown, Upload, Trash2, Eye } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { createPortal } from 'react-dom';
import { CardData, Tag } from '../types';
import { Modal, Input, Select, TextArea, Button, ImagePreview } from './Common';
import { getCardCoverUrl } from '../utils/cardCover';

interface CardEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  initialCard: Partial<CardData>;
  tags: Tag[];
  onSave: (card: Partial<CardData>) => Promise<void>;
}

interface DateFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

const DateField: React.FC<DateFieldProps> = ({ label, value, onChange }) => {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [displayMonth, setDisplayMonth] = useState<Date>(new Date());
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const selected = value ? new Date(`${value}T00:00:00`) : undefined;

  const CALENDAR_WIDTH = 286;
  const CALENDAR_HEIGHT = 350;

  const openCalendar = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const left = Math.min(window.innerWidth - CALENDAR_WIDTH - 8, Math.max(8, rect.left));
    const top = Math.max(8, rect.top - CALENDAR_HEIGHT - 10);
    setPosition({ top, left });
    setDisplayMonth(selected || new Date());
    setOpen(true);
  };

  const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  const yearOptions = Array.from({ length: 120 }, (_, i) => 1990 + i);

  useEffect(() => {
    if (!open) return;

    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);

    return () => {
      document.removeEventListener('mousedown', onMouseDown);
    };
  }, [open]);

  return (
    <div className="flex flex-col gap-1.5 w-full relative">
      <label className="text-xs font-bold text-subtle dark:text-zinc-400 uppercase tracking-wider">{label}</label>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openCalendar())}
        className="w-full h-11 px-3 bg-[color:var(--surface-muted)] border border-[color:var(--line)] rounded-lg text-[color:var(--text-primary)] flex items-center justify-between hover:border-[color:var(--accent)] focus:outline-none focus:ring-4 focus:ring-[color:var(--accent-soft)] transition-all"
      >
        <span className={value ? 'text-[color:var(--text-primary)]' : 'text-[color:var(--text-secondary)]/70'}>
          {value || '选择日期'}
        </span>
        <CalendarDays size={16} className="text-[color:var(--text-secondary)]" />
      </button>

      {open && createPortal(
        <div
          ref={popoverRef}
          style={{ top: position.top, left: position.left }}
          className="fixed z-[2200] w-[286px] bg-[color:var(--surface)] border border-[color:var(--line)] rounded-xl p-3 shadow-2xl"
        >
          <div className="flex items-center gap-2 mb-1.5">
            <div className="relative flex-1">
              <select
                value={displayMonth.getMonth()}
                onChange={(e) => setDisplayMonth(new Date(displayMonth.getFullYear(), Number(e.target.value), 1))}
                className="w-full h-9 appearance-none rounded-md border border-[color:var(--line)] bg-[color:var(--surface-muted)] px-3 pr-8 text-sm text-[color:var(--text-primary)]"
              >
                {monthNames.map((name, index) => (
                  <option key={name} value={index}>{name}</option>
                ))}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[color:var(--text-secondary)]" />
            </div>
            <div className="relative flex-1">
              <select
                value={displayMonth.getFullYear()}
                onChange={(e) => setDisplayMonth(new Date(Number(e.target.value), displayMonth.getMonth(), 1))}
                className="w-full h-9 appearance-none rounded-md border border-[color:var(--line)] bg-[color:var(--surface-muted)] px-3 pr-8 text-sm text-[color:var(--text-primary)]"
              >
                {yearOptions.map((year) => (
                  <option key={year} value={year}>{year}年</option>
                ))}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[color:var(--text-secondary)]" />
            </div>
          </div>
          <DayPicker
            mode="single"
            selected={selected}
            locale={zhCN}
            month={displayMonth}
            onMonthChange={setDisplayMonth}
            hideNavigation
            onSelect={(date) => {
              if (!date) return;
              onChange(format(date, 'yyyy-MM-dd'));
              setOpen(false);
            }}
            className="text-[color:var(--text-primary)]"
            classNames={{
              months: 'flex gap-0',
              month: 'flex flex-col gap-1',
              caption: 'hidden',
              caption_label: 'hidden',
              month_grid: 'mt-0 w-full border-collapse table-fixed',
              weekdays: 'grid grid-cols-7 mb-1',
              weekday: 'h-8 text-center text-[11px] text-[color:var(--text-secondary)] font-semibold flex items-center justify-center',
              weeks: 'flex flex-col gap-0.5',
              week: 'grid grid-cols-7',
              day: 'h-9 w-9 p-0 mx-auto',
              day_button: 'h-8 w-8 rounded-md text-sm hover:bg-[color:var(--accent-soft)] transition-colors flex items-center justify-center'
            }}
            modifiersClassNames={{
              selected: 'rounded-md bg-[color:var(--accent)] text-white hover:bg-[color:var(--accent)]',
              today: 'calendar-today-dot text-[color:var(--accent)] font-bold',
              outside: 'text-[color:var(--text-secondary)]/40'
            }}
          />
          <div className="flex items-center justify-center gap-4 pt-2">
            <button
              type="button"
              onClick={() => {
                const today = new Date();
                setDisplayMonth(today);
                onChange(format(today, 'yyyy-MM-dd'));
                setOpen(false);
              }}
              className="text-xs font-semibold text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]"
            >
              回到今天
            </button>
            <button
              type="button"
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
              className="text-xs font-semibold text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]"
            >
              清除日期
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

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
                <span className="text-xs font-bold text-[color:var(--text-secondary)] uppercase">本地封面（优先显示）</span>
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
              <div
                className="relative h-28 md:h-20 rounded-xl border border-[color:var(--line)] overflow-hidden bg-[color:var(--surface-muted)] cursor-zoom-in"
                onClick={() => setIsCoverPreviewOpen(true)}
              >
                <ImagePreview src={coverPreviewSrc} alt={card.title || '封面预览'} className="w-full h-full" />
                <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/45 via-transparent to-transparent" />
                <div className="absolute right-2 bottom-2 pointer-events-none inline-flex items-center gap-1 rounded-md bg-black/55 text-white px-2 py-1 text-[10px] font-semibold">
                  <Eye size={11} />
                  预览卡片
                </div>
              </div>
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

        {/* 右侧：详细描述 + 保存按钮 */}
        <div className="flex-1 flex flex-col gap-4 glass-panel rounded-2xl p-4 md:p-5">
          <div className="flex-1 flex flex-col h-full">
            <TextArea 
              label="详细描述" 
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
        <div className="fixed inset-0 z-[2300] bg-black/65 backdrop-blur-sm p-4 flex items-center justify-center" onClick={() => setIsCoverPreviewOpen(false)}>
          <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
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
            <div className="relative rounded-2xl aspect-video overflow-hidden border border-white/25 shadow-2xl">
              <ImagePreview src={coverPreviewSrc} alt={card.title || '封面预览'} className="w-full h-full" />
              <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(120%_95%_at_0%_100%,rgba(0,0,0,0.80)_0%,rgba(0,0,0,0.54)_35%,rgba(0,0,0,0.16)_64%,rgba(0,0,0,0)_100%)]" />
              <div className="absolute bottom-0 left-0 right-0 p-4 text-white drop-shadow-md">
                <h3 className="font-display text-2xl leading-tight line-clamp-1">{card.title || '未命名作品'}</h3>
                <p className="text-white/85 pt-2 line-clamp-2 font-medium text-[11px]">{card.description || '这里会显示卡片描述内容。'}</p>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </Modal>
  );
};
