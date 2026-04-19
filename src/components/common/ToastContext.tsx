import React, { createContext, useContext, useState, useCallback } from 'react';
import { Check, AlertTriangle, Info } from 'lucide-react';

// --- Toast System ---

type ToastType = 'success' | 'error' | 'info';
interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
}

const ToastContext = createContext<{ showToast: (msg: string, type?: ToastType) => void } | null>(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[1000] flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id} className={`pointer-events-auto min-w-[300px] max-w-sm p-4 rounded-xl shadow-lg border flex items-start gap-3 animate-in slide-in-from-right-full duration-300 ${
            toast.type === 'success' ? 'bg-white dark:bg-zinc-900 border-emerald-100 dark:border-emerald-900/30 text-emerald-800 dark:text-emerald-400' :
            toast.type === 'error' ? 'bg-white dark:bg-zinc-900 border-red-100 dark:border-red-900/30 text-red-800 dark:text-red-400' :
            'bg-white dark:bg-zinc-900 border-stone-200 dark:border-zinc-800 text-ink dark:text-zinc-100'
          }`}>
            <div className={`mt-0.5 ${
               toast.type === 'success' ? 'text-emerald-500' :
               toast.type === 'error' ? 'text-red-500' : 'text-blue-500'
            }`}>
              {toast.type === 'success' ? <Check size={18} /> : toast.type === 'error' ? <AlertTriangle size={18} /> : <Info size={18} />}
            </div>
            <p className="text-sm font-medium leading-tight pt-0.5">{toast.message}</p>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
