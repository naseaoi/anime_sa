import React, { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { PublicData } from '../../../types';
import { buildAdminNavItems, getAdminRouteTitle } from './adminNavigation';
import { AdminSidebar } from './AdminSidebar';
import { AdminTopbar } from './AdminTopbar';

interface AdminShellProps {
  data: PublicData;
  hasChanges: boolean;
  syncing: boolean;
  storageType: 'sqlite' | 'webdav';
  onSave: () => void;
  onLogout: () => void;
  children: React.ReactNode;
}

export const AdminShell: React.FC<AdminShellProps> = ({
  data,
  hasChanges,
  syncing,
  storageType,
  onSave,
  onLogout,
  children
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navItems = useMemo(() => buildAdminNavItems(data), [data]);
  const title = getAdminRouteTitle(navItems, location.pathname);

  return (
    <div className="flex h-screen overflow-hidden bg-[color:var(--bg-soft)] text-[color:var(--text-primary)]">
      <AdminSidebar
        items={navItems}
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        onLogout={onLogout}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopbar
          title={title}
          hasChanges={hasChanges}
          syncing={syncing}
          storageType={storageType}
          onMenuClick={() => setMobileMenuOpen(true)}
          onSave={onSave}
        />
        <main className="flex-1 overflow-y-auto px-4 py-5 md:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1180px]">{children}</div>
        </main>
      </div>
    </div>
  );
};
