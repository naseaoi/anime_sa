
import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { CardData, Tag } from '../types';
import { Modal, Input, Select, TextArea, Button } from './Common';

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

  // 当外部传入的 initialCard 变化或模态框打开时，重置内部状态
  useEffect(() => {
    if (isOpen) {
      setCard(initialCard);
    }
  }, [isOpen, initialCard]);

  const handleSaveClick = async () => {
    setSaving(true);
    await onSave(card);
    setSaving(false);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} className="max-w-7xl w-full">
      <div className="flex flex-col md:flex-row gap-8">
        {/* 左侧：主要信息 */}
        <div className="flex-1 space-y-6">
          <Input 
            label="标题" 
            value={card.title || ''} 
            onChange={e => setCard({...card, title: e.target.value})} 
            className="h-11 text-base" 
          />
          
          <div className="flex items-end gap-6">
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
            <div className="flex items-center gap-6 pb-1">
              <div className="flex flex-col items-center gap-2">
                <label className="text-xs font-bold text-stone-400 uppercase">推荐</label>
                <input 
                  type="checkbox" 
                  checked={!!card.isRecommended} 
                  onChange={e => setCard({...card, isRecommended: e.target.checked})} 
                  className="w-6 h-6 rounded border-stone-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-amber-500 focus:ring-amber-400 cursor-pointer" 
                />
              </div>
              <div className="flex flex-col items-center gap-2">
                <label className="text-xs font-bold text-stone-400 uppercase">观看中</label>
                <input 
                  type="checkbox" 
                  checked={!!card.isWatching} 
                  onChange={e => setCard({...card, isWatching: e.target.checked})} 
                  className="w-6 h-6 rounded border-stone-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-blue-500 focus:ring-blue-400 cursor-pointer" 
                />
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <Input 
              label="封面链接 (URL)" 
              value={card.coverUrl || ''} 
              onChange={e => setCard({...card, coverUrl: e.target.value})} 
              className="h-11" 
            />
            <div className="flex items-center justify-between gap-4">
              <label className="text-xs font-bold text-stone-400 uppercase">评分</label>
              <input 
                type="range" 
                min="0" 
                max="5" 
                step="0.1" 
                className="flex-1 accent-ink dark:accent-white h-2 bg-stone-100 dark:bg-zinc-800 rounded-lg appearance-none" 
                value={card.rating || 0} 
                onChange={e => setCard({...card, rating: parseFloat(parseFloat(e.target.value).toFixed(1))})} 
              />
              <span className="text-sm font-bold text-ink dark:text-zinc-100 w-8 text-right">
                {(card.rating || 0).toFixed(1)}
              </span>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-6">
            <Input 
              label="开始日期" 
              type="date" 
              max="9999-12-31" 
              value={card.startDate || ''} 
              onChange={e => { const val = e.target.value; if (val.split('-')[0].length <= 4) setCard({...card, startDate: val}); }} 
              className="h-11" 
            />
            <Input 
              label="结束日期" 
              type="date" 
              max="9999-12-31" 
              value={card.endDate || ''} 
              onChange={e => { const val = e.target.value; if (val.split('-')[0].length <= 4) setCard({...card, endDate: val}); }} 
              className="h-11" 
            />
          </div>
        </div>

        {/* 右侧：详细描述 + 保存按钮 */}
        <div className="flex-1 flex flex-col gap-6">
          <div className="flex-1 flex flex-col h-full">
            <TextArea 
              label="详细描述" 
              value={card.description || ''} 
              onChange={e => setCard({...card, description: e.target.value})} 
              className="flex-1 min-h-0 text-base resize-none" 
              style={{ height: '100%' }}
              wrapperClassName="flex-1 flex flex-col h-full"
            />
          </div>
          <Button onClick={handleSaveClick} className="w-full h-14 rounded-2xl text-base shrink-0" disabled={saving}>
            {saving ? <Loader2 className="animate-spin" /> : '保存内容'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
