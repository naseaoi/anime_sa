import React, { useEffect, useRef, useState } from 'react';
import { Home, LogOut, MoreVertical } from 'lucide-react';
import { useNavigate } from '../../../router';

interface AdminOverflowMenuProps {
  onLogout: () => void;
}

export const AdminOverflowMenu: React.FC<AdminOverflowMenuProps> = ({ onLogout }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-[6px] text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-soft)] hover:text-[color:var(--text-primary)]"
        aria-label="更多"
        title="更多"
      >
        <MoreVertical size={18} />
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-max min-w-[8rem] overflow-hidden rounded-[6px] border border-[color:var(--line)] bg-[color:var(--surface)] py-1 shadow-md">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              navigate('/');
            }}
            className="flex w-full items-center gap-3 whitespace-nowrap px-3 py-2 text-sm text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-soft)] hover:text-[color:var(--text-primary)]"
          >
            <Home size={16} />
            返回首页
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
            className="flex w-full items-center gap-3 whitespace-nowrap px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/25"
          >
            <LogOut size={16} />
            退出登录
          </button>
        </div>
      )}
    </div>
  );
};
