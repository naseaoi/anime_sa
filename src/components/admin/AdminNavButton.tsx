import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

interface AdminNavButtonProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  count?: number;
  collapsed?: boolean;
}

export const AdminNavButton: React.FC<AdminNavButtonProps> = ({ to, icon, label, count, collapsed }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const isActive = location.pathname.includes(to) && to !== '/';

  return (
    <button
      onClick={() => navigate(to)}
      className={`group relative flex items-center justify-between px-3 py-3 w-full text-base font-bold rounded-xl border transition-all overflow-hidden ${isActive ? 'bg-[color:var(--surface)]/85 border-[color:var(--line)] text-[color:var(--text-primary)] shadow-sm' : 'border-transparent text-[color:var(--text-secondary)] hover:bg-[color:var(--surface)]/78 hover:border-[color:var(--line)] hover:text-[color:var(--text-primary)]'}`}
      title={collapsed ? label : undefined}
    >
      <span className={`absolute left-1 top-2 bottom-2 w-0.5 rounded-full bg-[color:var(--accent)] transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-70'}`} />
      <div className="flex items-center gap-3 min-w-0">
        <span className="w-5 h-5 shrink-0 flex items-center justify-center">{icon}</span>
        <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${collapsed ? 'max-w-0 opacity-0 -translate-x-1' : 'max-w-[140px] opacity-100 translate-x-0'}`}>{label}</span>
      </div>
      {count !== undefined && (
        <span className={`text-xs px-2 py-0.5 rounded transition-all duration-300 ${isActive ? 'bg-[color:var(--accent-soft)] text-[color:var(--text-primary)]' : 'bg-[color:var(--surface)]/60 text-[color:var(--text-secondary)]'} ${collapsed ? 'max-w-0 opacity-0 px-0 py-0 ml-0' : 'max-w-14 opacity-100 ml-2'}`}>
          {count}
        </span>
      )}
    </button>
  );
};
