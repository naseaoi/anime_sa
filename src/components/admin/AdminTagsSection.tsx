import React, { useState } from 'react';
import { Check, Edit2, Plus, Trash2, X } from 'lucide-react';
import { PublicData } from '../../types';
import { AdminCard, Button, Input, Modal, useToast } from '../Common';
import { normalizeTagSlug } from '../../utils/routeUtils';
import { TAG_ICON_OPTIONS, getTagIcon } from '../../utils/tagIcons';

interface AdminTagsSectionProps {
  data: PublicData;
  onUpdate: (d: PublicData) => void;
}

export const AdminTagsSection: React.FC<AdminTagsSectionProps> = ({ data, onUpdate }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [newTagSlug, setNewTagSlug] = useState('');
  const [newTagIcon, setNewTagIcon] = useState('');
  const [editIcon, setEditIcon] = useState('');
  const [iconPickerTarget, setIconPickerTarget] = useState<'new' | 'edit' | null>(null);
  const { showToast } = useToast();
  const iconChoices = TAG_ICON_OPTIONS;

  const currentIconValue = iconPickerTarget === 'edit' ? editIcon : newTagIcon;
  const setCurrentIconValue = (next: string) => {
    if (iconPickerTarget === 'edit') {
      setEditIcon(next);
      return;
    }
    setNewTagIcon(next);
  };

  const handleAdd = () => {
    if (!newTagName.trim()) return;
    const newId = Date.now().toString();
    const newTags = [...data.tags, { id: newId, name: newTagName.trim(), slug: normalizeTagSlug(newTagSlug.trim(), newTagName.trim()), icon: newTagIcon || undefined }];
    onUpdate({ ...data, tags: newTags });
    setNewTagName('');
    setNewTagSlug('');
    setNewTagIcon('');
    showToast('分类添加成功', 'success');
  };

  const handleUpdate = (id: string) => {
    if (!editName.trim()) return;
    const newTags = data.tags.map((t) => (t.id === id ? { ...t, name: editName.trim(), slug: normalizeTagSlug(editSlug.trim(), editName.trim()), icon: editIcon || undefined } : t));
    onUpdate({ ...data, tags: newTags });
    setEditingId(null);
    showToast('分类更新成功', 'success');
  };

  const handleDelete = (id: string) => {
    const isUsed = data.cards.some((c) => c.tagIds.includes(id));
    if (isUsed) {
      showToast('无法删除：该分类下还有关联的记录', 'error');
      return;
    }
    const newTags = data.tags.filter((t) => t.id !== id);
    onUpdate({ ...data, tags: newTags });
    showToast('分类已移除', 'success');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <AdminCard title="添加新分类">
        <div className="grid grid-cols-1 md:grid-cols-[auto_1fr_1fr_auto] gap-4 items-center">
          <button
            type="button"
            onClick={() => setIconPickerTarget('new')}
            className="h-12 px-3 rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-muted)] text-[color:var(--text-secondary)] hover:border-[color:var(--accent)] hover:text-[color:var(--text-primary)] transition-colors inline-flex items-center gap-2"
            title="选择分类图标"
          >
            <span className="w-5 h-5 flex items-center justify-center">{getTagIcon(newTagIcon, 'w-4 h-4') || <span className="text-xs font-bold">字</span>}</span>
          </button>
          <Input
            placeholder="输入分类名称..."
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            className="h-12 text-base"
          />
          <Input
            placeholder="英文标识（如 game）"
            value={newTagSlug}
            onChange={(e) => setNewTagSlug(e.target.value)}
            className="h-12 text-base"
          />
          <Button onClick={handleAdd} disabled={!newTagName.trim()} className="h-12 px-8 rounded-xl shrink-0">
            <Plus size={18} /> 添加
          </Button>
        </div>
      </AdminCard>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.tags.map((tag) => (
          <div key={tag.id} className="bg-[color:var(--surface-muted)] p-4 rounded-xl border border-[color:var(--line)] shadow-sm flex items-center justify-between group hover:border-[color:var(--accent)]/45 transition-colors">
            {editingId === tag.id ? (
                <div className="grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto_auto] items-center gap-2 w-full">
                  <button
                    type="button"
                    onClick={() => setIconPickerTarget('edit')}
                    className="w-8 h-8 rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] text-[color:var(--text-secondary)] hover:border-[color:var(--accent)] hover:text-[color:var(--text-primary)] transition-colors inline-flex items-center justify-center shrink-0"
                    title="选择分类图标"
                  >
                    <span className="w-4 h-4 flex items-center justify-center">{getTagIcon(editIcon, 'w-4 h-4') || <span className="text-[10px] font-bold">字</span>}</span>
                  </button>
                  <input
                    autoFocus
                    className="w-full px-2 py-1 bg-[color:var(--surface)] border border-[color:var(--line)] rounded text-sm focus:outline-none focus:border-[color:var(--accent)] text-[color:var(--text-primary)]"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleUpdate(tag.id); }}
                    placeholder="分类名"
                  />
                  <input
                    className="w-full px-2 py-1 bg-[color:var(--surface)] border border-[color:var(--line)] rounded text-sm focus:outline-none focus:border-[color:var(--accent)] text-[color:var(--text-secondary)]"
                    value={editSlug}
                    onChange={(e) => setEditSlug(e.target.value)}
                    placeholder="英文标识"
                  />
                <button onClick={() => handleUpdate(tag.id)} className="p-1.5 bg-emerald-100 text-emerald-600 rounded hover:bg-emerald-200"><Check size={14} /></button>
                <button onClick={() => setEditingId(null)} className="p-1.5 bg-[color:var(--surface)] text-[color:var(--text-secondary)] rounded hover:bg-[color:var(--accent-soft)]"><X size={14} /></button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-[color:var(--surface)] rounded-lg border border-[color:var(--line)] flex items-center justify-center text-[color:var(--text-secondary)] font-bold text-sm">
                    {getTagIcon(tag.icon, 'w-4 h-4') || tag.name.slice(0, 1)}
                  </div>
                  <div className="min-w-0 flex items-center gap-2">
                    <span className="font-bold text-[color:var(--text-primary)] truncate">{tag.name}</span>
                    <span className="text-[11px] text-[color:var(--text-secondary)]/80 font-mono truncate">/{normalizeTagSlug(tag.slug, tag.name)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => { setEditingId(tag.id); setEditName(tag.name); setEditSlug(tag.slug || ''); setEditIcon(tag.icon || ''); }} className="p-2 text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] hover:bg-[color:var(--accent-soft)] rounded-lg transition-colors"><Edit2 size={16} /></button>
                  <button onClick={() => handleDelete(tag.id)} className="p-2 text-[color:var(--text-secondary)] hover:text-red-500 hover:bg-red-50/80 rounded-lg transition-colors"><Trash2 size={16} /></button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      <Modal
        isOpen={iconPickerTarget !== null}
        onClose={() => setIconPickerTarget(null)}
        title="选择分类图标"
        className="max-w-3xl w-full"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-[color:var(--text-secondary)] uppercase tracking-[0.16em]">点击图标即可应用</p>
            <button
              type="button"
              onClick={() => {
                setCurrentIconValue('');
                setIconPickerTarget(null);
              }}
              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${!currentIconValue ? 'border-[color:var(--accent)] bg-[color:var(--accent-soft)] text-[color:var(--text-primary)]' : 'border-[color:var(--line)] text-[color:var(--text-secondary)] hover:border-[color:var(--accent)] hover:text-[color:var(--text-primary)]'}`}
            >
              不使用图标
            </button>
          </div>

          <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-2">
            {iconChoices.filter((item) => item.value).map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => {
                  setCurrentIconValue(item.value);
                  setIconPickerTarget(null);
                }}
                className={`h-10 rounded-lg border inline-flex items-center justify-center transition-colors ${currentIconValue === item.value ? 'border-[color:var(--accent)] bg-[color:var(--accent-soft)] text-[color:var(--text-primary)]' : 'border-[color:var(--line)] text-[color:var(--text-secondary)] hover:border-[color:var(--accent)] hover:text-[color:var(--text-primary)]'}`}
                title={item.label}
              >
                {getTagIcon(item.value, 'w-4 h-4')}
              </button>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
};
