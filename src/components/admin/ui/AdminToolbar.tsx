import React from 'react';

interface AdminToolbarProps {
  children: React.ReactNode;
  className?: string;
}

export const AdminToolbar: React.FC<AdminToolbarProps> = ({ children, className = '' }) => (
  <div className={`rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] p-3 ${className}`}>
    {children}
  </div>
);
