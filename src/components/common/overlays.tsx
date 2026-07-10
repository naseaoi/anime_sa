import React, { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useDialogAccessibility } from '../../hooks/useDialogAccessibility';
import { Button } from './primitives';

// --- 模态层：Modal / ConfirmModal ---

export const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode; className?: string }> = ({
  isOpen, onClose, title, children, className = ''
}) => {
  const titleId = useId();
  const dialogRef = useDialogAccessibility(isOpen, onClose);

  useEffect(() => {
    if (!isOpen) return;
    const scrollY = window.scrollY;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalBodyOverflow = document.body.style.overflow;
    const originalBodyPosition = document.body.style.position;
    const originalBodyTop = document.body.style.top;
    const originalBodyWidth = document.body.style.width;
    const originalBodyTouchAction = document.body.style.touchAction;

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    document.body.style.touchAction = 'none';

    return () => {
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.body.style.overflow = originalBodyOverflow;
      document.body.style.position = originalBodyPosition;
      document.body.style.top = originalBodyTop;
      document.body.style.width = originalBodyWidth;
      document.body.style.touchAction = originalBodyTouchAction;
      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);

  if (!isOpen) return null;
  return createPortal(
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/35 backdrop-blur-sm p-4 animate-in fade-in duration-200" role="presentation">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`bg-[color:var(--surface)] rounded-xl shadow-2xl w-full max-h-[92vh] overflow-hidden border border-[color:var(--line)] animate-in zoom-in-95 slide-in-from-bottom-2 duration-200 flex flex-col ${className || 'max-w-lg'}`}
      >
        <div className="px-6 py-4 border-b border-[color:var(--line)] flex justify-between items-center sticky top-0 bg-[color:var(--surface)]/95 backdrop-blur z-10 shrink-0">
          <h3 id={titleId} className="font-semibold text-[color:var(--text-primary)]">{title}</h3>
          <button type="button" aria-label="关闭" onClick={onClose} className="p-1 hover:bg-[color:var(--accent-soft)] rounded-full text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-5 md:p-6 flex-1 flex flex-col overflow-y-auto modal-scroll">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

export const ConfirmModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  type?: 'danger' | 'info';
}> = ({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', type = 'info' }) => {
  const titleId = useId();
  const messageId = useId();
  const dialogRef = useDialogAccessibility(isOpen, onClose);

  if (!isOpen) return null;
  return createPortal(
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-ink/20 dark:bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200" role="presentation">
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        tabIndex={-1}
        className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl max-w-sm w-full border border-white/50 dark:border-zinc-800 animate-in zoom-in-95 duration-200 p-6"
      >
        <h3 id={titleId} className="text-lg font-bold text-ink dark:text-white mb-2">{title}</h3>
        <p id={messageId} className="text-subtle dark:text-zinc-400 text-sm mb-6 leading-relaxed">{message}</p>
        <div className="flex gap-3 justify-end">
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button
            variant={type === 'danger' ? 'danger' : 'primary'}
            onClick={() => { onConfirm(); onClose(); }}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};
