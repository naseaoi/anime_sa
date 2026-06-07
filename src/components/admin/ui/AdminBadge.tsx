import React from 'react';

type AdminBadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

const toneClassMap: Record<AdminBadgeTone, string> = {
  neutral: 'border-[color:var(--line)] bg-[color:var(--bg-soft)] text-[color:var(--text-secondary)]',
  accent: 'border-[color:var(--accent)]/35 bg-[color:var(--accent-soft)] text-[color:var(--text-primary)]',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/25 dark:text-emerald-300',
  warning: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/25 dark:text-amber-300',
  danger: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/25 dark:text-red-300'
};

interface AdminBadgeProps {
  children: React.ReactNode;
  tone?: AdminBadgeTone;
  className?: string;
}

export const AdminBadge: React.FC<AdminBadgeProps> = ({ children, tone = 'neutral', className = '' }) => (
  <span className={`inline-flex h-6 items-center rounded-[6px] border px-2 text-xs font-medium ${toneClassMap[tone]} ${className}`}>
    {children}
  </span>
);
