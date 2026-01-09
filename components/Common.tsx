
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X, Check, ChevronDown, AlertTriangle, Info, Star, StarHalf, Menu, Camera } from 'lucide-react';

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
            toast.type === 'success' ? 'bg-white border-emerald-100 text-emerald-800' :
            toast.type === 'error' ? 'bg-white border-red-100 text-red-800' :
            'bg-white border-stone-200 text-ink'
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

// --- Primitives ---

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success' | 'outline', size?: 'sm' | 'md' }> = ({ 
  children, variant = 'primary', size = 'md', className = '', ...props 
}) => {
  const sizeClasses = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm';
  const base = `${sizeClasses} rounded-lg font-medium transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-offset-1`;
  
  const variants = {
    primary: "bg-ink text-white hover:bg-stone-800 shadow-sm focus:ring-ink/20",
    secondary: "bg-stone-100 text-ink hover:bg-stone-200 focus:ring-stone-300",
    outline: "bg-white border border-border text-ink hover:bg-stone-50 focus:ring-stone-200",
    danger: "bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 focus:ring-red-200",
    ghost: "text-subtle hover:text-ink hover:bg-stone-100 focus:ring-stone-200",
    success: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm focus:ring-emerald-200"
  };

  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label?: string, error?: string }> = ({ 
  label, error, className = '', ...props 
}) => {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && <label className="text-xs font-bold text-subtle uppercase tracking-wider">{label}</label>}
      <input 
        className={`w-full px-3 py-2 bg-white border ${error ? 'border-red-300 focus:border-red-500' : 'border-border focus:border-ink'} rounded-lg text-ink placeholder:text-stone-300 focus:outline-none focus:ring-4 focus:ring-stone-100 transition-all ${className}`}
        {...props}
      />
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
};

export const TextArea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }> = ({ 
  label, className = '', ...props 
}) => {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && <label className="text-xs font-bold text-subtle uppercase tracking-wider">{label}</label>}
      <textarea 
        className={`w-full px-3 py-2 bg-white border border-border rounded-lg text-ink placeholder:text-stone-300 focus:outline-none focus:border-ink focus:ring-4 focus:ring-stone-100 transition-all min-h-[100px] resize-y ${className}`}
        {...props}
      />
    </div>
  );
};

export const MultiSelect: React.FC<{ 
  label?: string; 
  options: { id: string; name: string }[]; 
  value: string[]; 
  onChange: (value: string[]) => void;
  placeholder?: string;
}> = ({ label, options, value, onChange, placeholder = "Select..." }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (id: string) => {
    if (value.includes(id)) {
      onChange(value.filter(v => v !== id));
    } else {
      onChange([...value, id]);
    }
  };

  return (
    <div className="flex flex-col gap-1.5 w-full relative" ref={containerRef}>
      {label && <label className="text-xs font-bold text-subtle uppercase tracking-wider whitespace-nowrap">{label}</label>}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-3 py-2 bg-white border border-border rounded-lg text-ink cursor-pointer flex items-center justify-between hover:border-stone-400 transition-colors ${isOpen ? 'ring-4 ring-stone-100 border-ink' : ''}`}
      >
        <div className="flex flex-wrap gap-1">
          {value.length === 0 ? (
            <span className="text-stone-400 text-sm">{placeholder}</span>
          ) : (
            value.map(id => {
              const opt = options.find(o => o.id === id);
              return opt ? (
                <span key={id} className="text-[10px] bg-stone-100 text-ink px-1.5 py-0.5 rounded border border-stone-200">
                  {opt.name}
                </span>
              ) : null;
            })
          )}
        </div>
        <ChevronDown size={16} className={`text-stone-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-border rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto p-1">
          {options.length === 0 ? (
            <div className="p-2 text-xs text-stone-400 text-center">暂无选项</div>
          ) : (
            options.map(option => {
              const isSelected = value.includes(option.id);
              return (
                <div 
                  key={option.id} 
                  onClick={() => toggleOption(option.id)}
                  className={`px-3 py-2 text-sm rounded cursor-pointer flex items-center justify-between transition-colors ${isSelected ? 'bg-ink/5 text-ink font-medium' : 'text-subtle hover:bg-stone-50'}`}
                >
                  <span>{option.name}</span>
                  {isSelected && <Check size={14} className="text-ink" />}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

// --- Admin Components ---

export const AdminCard: React.FC<{ title?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }> = ({ title, action, children, className = '' }) => (
  <div className={`bg-white rounded-xl border border-border shadow-sm overflow-hidden ${className}`}>
    {(title || action) && (
      <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-stone-50/50">
        {title && <h3 className="font-semibold text-ink">{title}</h3>}
        {action && <div>{action}</div>}
      </div>
    )}
    <div className="p-6">{children}</div>
  </div>
);

export const ConfirmModal: React.FC<{ 
  isOpen: boolean; 
  onClose: () => void; 
  onConfirm: () => void; 
  title: string; 
  message: string; 
  confirmText?: string;
  type?: 'danger' | 'info';
}> = ({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', type = 'info' }) => {
  if (!isOpen) return null;
  return createPortal(
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-ink/20 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full border border-white/50 animate-in zoom-in-95 duration-200 p-6">
        <h3 className="text-lg font-bold text-ink mb-2">{title}</h3>
        <p className="text-subtle text-sm mb-6 leading-relaxed">{message}</p>
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

// --- Visual Components ---

export const ImagePreview: React.FC<{ src: string, alt: string, className?: string }> = ({ src, alt, className }) => {
  const [error, setError] = React.useState(false);
  
  return (
    <div className={`relative overflow-hidden bg-stone-100 flex items-center justify-center ${className}`}>
      {src && !error ? (
        <img 
          src={src} 
          alt={alt} 
          className="w-full h-full object-cover"
          onError={() => setError(true)}
          loading="lazy"
        />
      ) : (
        <div className="text-stone-300">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
        </div>
      )}
    </div>
  );
}

export const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }> = ({ 
  isOpen, onClose, title, children 
}) => {
  if (!isOpen) return null;
  return createPortal(
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-ink/20 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-white/50 animate-in zoom-in-95 slide-in-from-bottom-2 duration-200 flex flex-col">
        <div className="px-6 py-4 border-b border-border flex justify-between items-center sticky top-0 bg-white/95 backdrop-blur z-10">
          <h3 className="font-semibold text-ink">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-stone-100 rounded-full text-subtle hover:text-ink transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

export const PageLoader: React.FC = () => (
  <div className="flex h-screen w-full flex-col items-center justify-center bg-stone-50 text-subtle gap-4">
    <div className="animate-bounce">
      <Camera className="w-12 h-12 text-ink" />
    </div>
    <span className="text-sm font-bold tracking-widest uppercase text-stone-400">全力加载中</span>
  </div>
);

export const Rating: React.FC<{ value: number }> = ({ value }) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map((star) => {
       const filled = value >= star;
       const half = value >= star - 0.5 && value < star;
       return (
         <span key={star} className={`text-xs ${filled || half ? 'text-amber-400' : 'text-stone-200'}`}>
           {filled ? <Star size={12} fill="currentColor" /> : half ? <StarHalf size={12} fill="currentColor" /> : <Star size={12} fill="none" stroke="currentColor" />}
         </span>
       );
    })}
  </div>
);
