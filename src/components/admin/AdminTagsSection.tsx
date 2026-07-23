import React, { useMemo, useState } from 'react';
import { Check, Edit2, Plus, Trash2, X } from 'lucide-react';
import { PublicData } from '../../types';
import { Button, Input, Modal, useToast } from '../Common';
import { getTagSlug, normalizeTagSlug } from '../../utils/routeUtils';
import { TAG_ICON_OPTIONS, getTagIcon } from '../../utils/tagIcons';
import { AdminBadge, AdminIconButton, AdminPanel } from './ui';

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

  const usageMap = useMemo(() => {
    const map = new Map<string, number>();
    data.cards.forEach((card) => {
      card.tagIds.forEach((tagId) => map.set(tagId, (map.get(tagId) || 0) + 1));
    });
    return map;
  }, [data.cards]);

  const currentIconValue = iconPickerTarget === 'edit' ? editIcon : newTagIcon;
  const setCurrentIconValue = (next: string) => {
    if (iconPickerTarget === 'edit') {
      setEditIcon(next);
      return;
    }
    setNewTagIcon(next);
  };

  const handleAdd = () => {
    const name = newTagName.trim();
    if (!name) return;

    const newId = Date.now().toString();
    const slug = normalizeTagSlug(newTagSlug.trim(), name);
    if (data.tags.some((tag) => getTagSlug(tag) === getTagSlug({ id: newId, name, slug }))) {
      showToast('标签路径已存在，请换一个标识', 'error');
      return;
    }
    const newTags = [
      ...data.tags,
      {
        id: newId,
        name,
         slug,
        icon: newTagIcon || undefined
      }
    ];

    onUpdate({ ...data, tags: newTags });
    setNewTagName('');
    setNewTagSlug('');
    setNewTagIcon('');
    showToast('标签添加成功', 'success');
  };

  const handleUpdate = (id: string) => {
    const name = editName.trim();
    if (!name) return;

    const slug = normalizeTagSlug(editSlug.trim(), name);
    if (data.tags.some((tag) => tag.id !== id && getTagSlug(tag) === getTagSlug({ id, name, slug }))) {
      showToast('标签路径已存在，请换一个标识', 'error');
      return;
    }
    const newTags = data.tags.map((tag) => (
      tag.id === id
        ? { ...tag, name, slug, icon: editIcon || undefined }
        : tag
    ));

    onUpdate({ ...data, tags: newTags });
    setEditingId(null);
    showToast('标签更新成功', 'success');
  };

  const handleDelete = (id: string) => {
    const isUsed = data.cards.some((card) => card.tagIds.includes(id));
    if (isUsed) {
      showToast('无法删除：该标签下还有关联的记录', 'error');
      return;
    }

    onUpdate({ ...data, tags: data.tags.filter((tag) => tag.id !== id) });
    showToast('标签已移除', 'success');
  };

  const startEdit = (tag: (typeof data.tags)[number]) => {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditSlug(tag.slug || '');
    setEditIcon(tag.icon || '');
  };

  return (
    <div className="space-y-4">
      <AdminPanel title="新增标签">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-subtle dark:text-zinc-400">图标</span>
            <button
              type="button"
              onClick={() => setIconPickerTarget('new')}
              className="inline-flex h-10 w-10 items-center justify-center rounded-[6px] border border-[color:var(--line)] bg-[color:var(--surface)] text-[color:var(--text-secondary)] transition-colors hover:border-[color:var(--accent)] hover:text-[color:var(--text-primary)]"
              title="选择标签图标"
              aria-label="选择标签图标"
            >
              {getTagIcon(newTagIcon, 'w-4 h-4') || <span className="text-xs font-semibold">字</span>}
            </button>
          </div>
          <Input
            label="标签名称"
            placeholder="例如：番剧"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            className="h-10 rounded-[6px] text-sm"
          />
          <Input
            label="英文标识"
            placeholder="例如：anime"
            value={newTagSlug}
            onChange={(e) => setNewTagSlug(e.target.value)}
            className="h-10 rounded-[6px] text-sm"
          />
          <Button onClick={handleAdd} disabled={!newTagName.trim()} className="h-10 rounded-[6px] px-4">
            <Plus size={17} /> 添加
          </Button>
        </div>
      </AdminPanel>

      <AdminPanel title="标签列表" bodyClassName="p-0">
        <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1fr)_96px_86px] gap-3 border-b border-[color:var(--line)] px-4 py-3 text-xs font-semibold uppercase text-[color:var(--text-secondary)] md:grid">
          <div>标签</div>
          <div>路径</div>
          <div>关联</div>
          <div className="text-right">操作</div>
        </div>

        <div className="divide-y divide-[color:var(--line)]">
          {data.tags.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-[color:var(--text-secondary)]">暂无标签</div>
          ) : data.tags.map((tag) => {
            const usage = usageMap.get(tag.id) || 0;
            const slug = normalizeTagSlug(tag.slug, tag.name);
            const isEditing = editingId === tag.id;

            return (
              <div key={tag.id} className="grid gap-3 px-4 py-3 transition-colors hover:bg-[color:var(--bg-soft)] md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_96px_86px] md:items-center">
                {isEditing ? (
                  <>
                    <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-end gap-2">
                      <button
                        type="button"
                        onClick={() => setIconPickerTarget('edit')}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-[6px] border border-[color:var(--line)] bg-[color:var(--surface)] text-[color:var(--text-secondary)] transition-colors hover:border-[color:var(--accent)] hover:text-[color:var(--text-primary)]"
                        title="选择标签图标"
                        aria-label="选择标签图标"
                      >
                        {getTagIcon(editIcon, 'w-4 h-4') || <span className="text-xs font-semibold">字</span>}
                      </button>
                      <input
                        autoFocus
                        className="h-10 w-full rounded-[6px] border border-[color:var(--line)] bg-[color:var(--surface)] px-3 text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent)] focus:ring-4 focus:ring-[color:var(--accent-soft)]"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleUpdate(tag.id);
                        }}
                        placeholder="标签名称"
                      />
                    </div>
                    <input
                      className="h-10 w-full rounded-[6px] border border-[color:var(--line)] bg-[color:var(--surface)] px-3 text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent)] focus:ring-4 focus:ring-[color:var(--accent-soft)]"
                      value={editSlug}
                      onChange={(e) => setEditSlug(e.target.value)}
                      placeholder="英文标识"
                    />
                    <AdminBadge>{usage} 张</AdminBadge>
                    <div className="flex items-center justify-end gap-1">
                      <AdminIconButton label="保存" tone="success" onClick={() => handleUpdate(tag.id)}>
                        <Check size={15} />
                      </AdminIconButton>
                      <AdminIconButton label="取消" onClick={() => setEditingId(null)}>
                        <X size={15} />
                      </AdminIconButton>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[6px] border border-[color:var(--line)] bg-[color:var(--bg-soft)] text-[color:var(--text-secondary)]">
                        {getTagIcon(tag.icon, 'w-4 h-4') || <span className="text-sm font-semibold">{tag.name.slice(0, 1)}</span>}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-[color:var(--text-primary)]">{tag.name}</div>
                        <div className="mt-1 text-xs text-[color:var(--text-secondary)] md:hidden">/{slug}</div>
                      </div>
                    </div>
                    <div className="hidden min-w-0 font-mono text-sm text-[color:var(--text-secondary)] md:block">/{slug}</div>
                    <AdminBadge tone={usage > 0 ? 'accent' : 'neutral'}>{usage} 张</AdminBadge>
                    <div className="flex items-center justify-end gap-1">
                      <AdminIconButton label="编辑" tone="accent" onClick={() => startEdit(tag)}>
                        <Edit2 size={15} />
                      </AdminIconButton>
                      <AdminIconButton label="删除" tone="danger" onClick={() => handleDelete(tag.id)}>
                        <Trash2 size={15} />
                      </AdminIconButton>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </AdminPanel>

      <Modal
        isOpen={iconPickerTarget !== null}
        onClose={() => setIconPickerTarget(null)}
        title="选择标签图标"
        className="max-w-3xl w-full"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--text-secondary)]">选择图标</p>
            <button
              type="button"
              onClick={() => {
                setCurrentIconValue('');
                setIconPickerTarget(null);
              }}
              className={`rounded-[6px] border px-3 py-1.5 text-xs font-semibold transition-colors ${!currentIconValue ? 'border-[color:var(--accent)] bg-[color:var(--accent-soft)] text-[color:var(--text-primary)]' : 'border-[color:var(--line)] text-[color:var(--text-secondary)] hover:border-[color:var(--accent)] hover:text-[color:var(--text-primary)]'}`}
            >
              不使用图标
            </button>
          </div>

          <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 md:grid-cols-10">
            {TAG_ICON_OPTIONS.filter((item) => item.value).map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => {
                  setCurrentIconValue(item.value);
                  setIconPickerTarget(null);
                }}
                className={`inline-flex h-10 items-center justify-center rounded-[6px] border transition-colors ${currentIconValue === item.value ? 'border-[color:var(--accent)] bg-[color:var(--accent-soft)] text-[color:var(--text-primary)]' : 'border-[color:var(--line)] text-[color:var(--text-secondary)] hover:border-[color:var(--accent)] hover:text-[color:var(--text-primary)]'}`}
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
