import React from 'react';

type AdminIconButtonTone = 'neutral' | 'danger' | 'accent' | 'success';

const toneClassMap: Record<AdminIconButtonTone, string> = {
  neutral: 'text-[color:var(--text-secondary)] hover:border-[color:var(--line)] hover:bg-[color:var(--bg-soft)] hover:text-[color:var(--text-primary)]',
  danger: 'text-[color:var(--text-secondary)] hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:hover:border-red-900/50 dark:hover:bg-red-950/25',
  accent: 'text-[color:var(--text-secondary)] hover:border-[color:var(--accent)]/35 hover:bg-[color:var(--accent-soft)] hover:text-[color:var(--text-primary)]',
  success: 'text-[color:var(--text-secondary)] hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:border-emerald-900/50 dark:hover:bg-emerald-950/25'
};

interface AdminIconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  tone?: AdminIconButtonTone;
}

export const AdminIconButton: React.FC<AdminIconButtonProps> = ({
  label,
  tone = 'neutral',
  children,
  className = '',
  ...props
}) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] border border-transparent transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${toneClassMap[tone]} ${className}`}
    {...props}
  >
    {children}
  </button>
);
