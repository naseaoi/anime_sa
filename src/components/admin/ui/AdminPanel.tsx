import React from 'react';

interface AdminPanelProps {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  title,
  action,
  children,
  className = '',
  bodyClassName = ''
}) => (
  <section className={`overflow-hidden rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] ${className}`}>
    {(title || action) && (
      <div className="flex min-h-12 items-center justify-between gap-3 border-b border-[color:var(--line)] px-4 py-3">
        {title && <h3 className="text-sm font-semibold text-[color:var(--text-primary)]">{title}</h3>}
        {action && <div className="shrink-0">{action}</div>}
      </div>
    )}
    <div className={bodyClassName || 'p-4'}>{children}</div>
  </section>
);
