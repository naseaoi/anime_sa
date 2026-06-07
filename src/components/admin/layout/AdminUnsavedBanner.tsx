import React from 'react';
import { AlertCircle, Loader2, Save } from 'lucide-react';

interface AdminUnsavedBannerProps {
  visible: boolean;
  syncing: boolean;
  onSave: () => void;
}

export const AdminUnsavedBanner: React.FC<AdminUnsavedBannerProps> = ({ visible, syncing, onSave }) => {
  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-20 z-40 md:right-6">
      <div className="pointer-events-auto flex items-center gap-3 rounded-[8px] border border-red-300/70 bg-[color:var(--surface)] px-4 py-2.5 shadow-[var(--shadow-lg)] dark:border-red-900/60">
        <AlertCircle size={16} className="shrink-0 text-red-500 dark:text-red-400" />
        <span className="text-sm font-medium text-[color:var(--text-primary)]">有未保存的更改</span>
        <button
          type="button"
          onClick={onSave}
          disabled={syncing}
          className="inline-flex h-8 items-center gap-1.5 rounded-[6px] bg-red-500 px-3 text-xs font-semibold text-white transition-colors hover:bg-red-600 disabled:opacity-60 dark:bg-red-600 dark:hover:bg-red-500"
        >
          {syncing ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          {syncing ? '保存中' : '立即保存'}
        </button>
      </div>
    </div>
  );
};
