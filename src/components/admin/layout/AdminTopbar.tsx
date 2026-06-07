import React from 'react';
import { CloudUpload, Database, Loader2, Menu, Save } from 'lucide-react';
import { Button } from '../../Common';
import { AdminBadge } from '../ui';

interface AdminTopbarProps {
  title: string;
  hasChanges: boolean;
  syncing: boolean;
  storageType: 'sqlite' | 'webdav';
  onMenuClick: () => void;
  onSave: () => void;
}

export const AdminTopbar: React.FC<AdminTopbarProps> = ({
  title,
  hasChanges,
  syncing,
  storageType,
  onMenuClick,
  onSave
}) => {
  const storageLabel = storageType === 'sqlite' ? 'SQLite' : 'WebDAV';
  const StorageIcon = storageType === 'sqlite' ? Database : CloudUpload;

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[color:var(--line)] bg-[color:var(--surface)]/95 px-4 backdrop-blur md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="inline-flex h-9 w-9 items-center justify-center rounded-[6px] text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-soft)] hover:text-[color:var(--text-primary)] md:hidden"
          aria-label="打开导航"
          title="打开导航"
        >
          <Menu size={20} />
        </button>
        <h1 className="truncate text-base font-semibold text-[color:var(--text-primary)]">{title}</h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <AdminBadge tone="neutral" className="hidden sm:inline-flex">
          <StorageIcon size={13} className="mr-1" />
          {storageLabel}
        </AdminBadge>
        {hasChanges && <AdminBadge tone="warning">未保存</AdminBadge>}
        <Button
          onClick={onSave}
          disabled={!hasChanges || syncing}
          variant="success"
          size="md"
          className="h-9 rounded-[6px] px-3 sm:px-4"
        >
          {syncing ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          <span className="hidden sm:inline">{syncing ? '保存中' : '保存'}</span>
        </Button>
      </div>
    </header>
  );
};
