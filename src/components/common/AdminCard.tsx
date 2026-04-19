import React from 'react';

// 后台用卡片容器：可选标题 + 右侧动作槽
export const AdminCard: React.FC<{ title?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }> = ({ title, action, children, className = '' }) => (
  <div className={`bg-[color:var(--surface-muted)] rounded-xl border border-[color:var(--line)] shadow-sm overflow-hidden ${className}`}>
    {(title || action) && (
      <div className="px-6 py-4 border-b border-[color:var(--line)] flex justify-between items-center bg-[color:var(--surface)]/55">
        {title && <h3 className="font-semibold text-[color:var(--text-primary)]">{title}</h3>}
        {action && <div>{action}</div>}
      </div>
    )}
    <div className="p-6">{children}</div>
  </div>
);
