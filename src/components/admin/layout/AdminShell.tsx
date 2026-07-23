import React from 'react';
import { StorageMode } from '../../../domain/storage';
import { ADMIN_NAV_ITEMS } from './adminNavigation';
import { AdminTopbar } from './AdminTopbar';

interface AdminShellProps {
  hasChanges: boolean;
  syncing: boolean;
  storageType: StorageMode;
  onPersist: () => void;
  onLogout: () => void;
  children: React.ReactNode;
}

export const AdminShell: React.FC<AdminShellProps> = ({
  hasChanges,
  syncing,
  storageType,
  onPersist,
  onLogout,
  children
}) => (
  <div className="flex h-screen flex-col overflow-hidden bg-[color:var(--bg-soft)] text-[color:var(--text-primary)]">
    <AdminTopbar
      items={ADMIN_NAV_ITEMS}
      hasChanges={hasChanges}
      syncing={syncing}
      storageType={storageType}
      onPersist={onPersist}
      onLogout={onLogout}
    />
    <main className="flex-1 overflow-y-auto px-4 py-5 md:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1180px]">{children}</div>
    </main>
  </div>
);
