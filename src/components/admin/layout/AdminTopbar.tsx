import React, { useState } from 'react';
import { CloudUpload, Database, Loader2, Menu, Save, X } from 'lucide-react';
import { Button } from '../../Common';
import { AdminNavItem } from './adminNavigation';
import { AdminTopNav, AdminMobileNav } from './AdminTopNav';
import { AdminOverflowMenu } from './AdminOverflowMenu';

interface AdminTopbarProps {
  items: AdminNavItem[];
  hasChanges: boolean;
  syncing: boolean;
  storageType: 'sqlite' | 'webdav';
  onSave: () => void;
  onLogout: () => void;
}

export const AdminTopbar: React.FC<AdminTopbarProps> = ({
  items,
  hasChanges,
  syncing,
  storageType,
  onSave,
  onLogout
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const storageLabel = storageType === 'sqlite' ? 'SQLite' : 'WebDAV';
  const StorageIcon = storageType === 'sqlite' ? Database : CloudUpload;

  return (
    <header className="sticky top-0 z-30 border-b border-[color:var(--line)] bg-[color:var(--surface)]">
      <div className="relative flex h-16 items-center px-4 md:px-6">
        <div className="absolute inset-x-0 hidden justify-center md:flex">
          <AdminTopNav items={items} />
        </div>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <Button
            variant="secondary"
            size="md"
            className="pointer-events-none hidden h-9 rounded-[6px] px-3 sm:inline-flex"
          >
            <StorageIcon size={15} />
            <span>{storageLabel}</span>
          </Button>
          {hasChanges && (
            <span className="inline-flex h-6 items-center rounded-[6px] border border-amber-200 bg-amber-50 px-2 text-xs font-medium text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/25 dark:text-amber-300">
              未保存
            </span>
          )}
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
          <AdminOverflowMenu onLogout={onLogout} />
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-[6px] text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-soft)] hover:text-[color:var(--text-primary)] md:hidden"
            aria-label="导航菜单"
            title="导航菜单"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      <AdminMobileNav items={items} open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </header>
  );
};
