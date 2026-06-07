import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AdminNavItem } from './adminNavigation';

interface AdminTopNavProps {
  items: AdminNavItem[];
}

export const AdminTopNav: React.FC<AdminTopNavProps> = ({ items }) => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="hidden items-center gap-1 md:flex">
      {items.map((item) => {
        const active = location.pathname.startsWith(item.to);
        return (
          <button
            key={item.to}
            type="button"
            onClick={() => navigate(item.to)}
            className={`relative flex h-16 items-center gap-2 px-3 text-sm font-medium transition-colors ${active ? 'text-[color:var(--text-primary)]' : 'text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]'}`}
          >
            <span className="flex h-4 w-4 items-center justify-center">{item.icon}</span>
            <span>{item.label}</span>
            {active && <span className="absolute inset-x-2 bottom-0 h-0.5 bg-[color:var(--accent)]" />}
          </button>
        );
      })}
    </nav>
  );
};

interface AdminMobileNavProps {
  items: AdminNavItem[];
  open: boolean;
  onClose: () => void;
}

export const AdminMobileNav: React.FC<AdminMobileNavProps> = ({ items, open, onClose }) => {
  const location = useLocation();
  const navigate = useNavigate();

  if (!open) return null;

  const go = (to: string) => {
    navigate(to);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 top-16 z-30 bg-black/30 md:hidden" onClick={onClose} />
      <div className="absolute inset-x-0 top-16 z-40 border-b border-[color:var(--line)] bg-[color:var(--surface)] p-3 md:hidden">
        <div className="space-y-1">
          {items.map((item) => {
            const active = location.pathname.startsWith(item.to);
            return (
              <button
                key={item.to}
                type="button"
                onClick={() => go(item.to)}
                className={`flex h-10 w-full items-center gap-3 rounded-[6px] px-3 text-sm font-medium transition-colors ${active ? 'bg-[color:var(--bg-soft)] text-[color:var(--text-primary)]' : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-soft)] hover:text-[color:var(--text-primary)]'}`}
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center">{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
};
