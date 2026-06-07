import React from 'react';
import { Home, LayoutDashboard, LogOut, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AdminNavItem } from './adminNavigation';

interface AdminSidebarProps {
  items: AdminNavItem[];
  open: boolean;
  onClose: () => void;
  onLogout: () => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({ items, open, onClose, onLogout }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const go = (to: string) => {
    navigate(to);
    onClose();
  };

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/30 md:hidden" onClick={onClose} />}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-[color:var(--line)] bg-[color:var(--surface)] transition-transform duration-200 md:relative md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex h-16 items-center justify-between border-b border-[color:var(--line)] px-4">
          <button
            type="button"
            onClick={() => go('/tat/cards')}
            className="flex min-w-0 items-center gap-3 rounded-[6px] text-left text-[color:var(--text-primary)]"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] bg-[color:var(--text-primary)] text-[color:var(--surface)]">
              <LayoutDashboard size={17} />
            </span>
            <span className="truncate text-sm font-semibold">后台管理</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-[6px] text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-soft)] hover:text-[color:var(--text-primary)] md:hidden"
            aria-label="关闭导航"
            title="关闭导航"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {items.map((item) => {
            const active = location.pathname.startsWith(item.to);
            return (
              <button
                key={item.to}
                type="button"
                onClick={() => go(item.to)}
                className={`flex h-10 w-full items-center justify-between gap-3 rounded-[6px] border px-3 text-sm font-medium transition-colors ${active ? 'border-[color:var(--line)] bg-[color:var(--bg-soft)] text-[color:var(--text-primary)]' : 'border-transparent text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-soft)] hover:text-[color:var(--text-primary)]'}`}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center">{item.icon}</span>
                  <span className="truncate">{item.label}</span>
                </span>
                {item.count !== undefined && (
                  <span className={`rounded-[5px] px-1.5 py-0.5 text-[11px] ${active ? 'bg-[color:var(--surface)] text-[color:var(--text-primary)]' : 'bg-[color:var(--bg-soft)] text-[color:var(--text-secondary)]'}`}>
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="space-y-1 border-t border-[color:var(--line)] p-3">
          <button
            type="button"
            onClick={() => go('/')}
            className="flex h-10 w-full items-center gap-3 rounded-[6px] px-3 text-sm font-medium text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-soft)] hover:text-[color:var(--text-primary)]"
          >
            <Home size={18} />
            <span>返回首页</span>
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="flex h-10 w-full items-center gap-3 rounded-[6px] px-3 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/25"
          >
            <LogOut size={18} />
            <span>退出登录</span>
          </button>
        </div>
      </aside>
    </>
  );
};
