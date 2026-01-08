import React from 'react';
import { Loader2, X } from 'lucide-react';

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
      {label && <label className="text-xs font-semibold text-subtle uppercase tracking-wider">{label}</label>}
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
      {label && <label className="text-xs font-semibold text-subtle uppercase tracking-wider">{label}</label>}
      <textarea 
        className={`w-full px-3 py-2 bg-white border border-border rounded-lg text-ink placeholder:text-stone-300 focus:outline-none focus:border-ink focus:ring-4 focus:ring-stone-100 transition-all min-h-[100px] resize-y ${className}`}
        {...props}
      />
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
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/20 backdrop-blur-sm p-4 animate-in fade-in duration-200">
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
    </div>
  );
};

export const PageLoader: React.FC = () => (
  <div className="flex h-screen w-full items-center justify-center bg-stone-50 text-subtle gap-3">
    <Loader2 className="w-6 h-6 animate-spin text-ink" />
    <span className="text-sm font-medium tracking-wide">加载数据中...</span>
  </div>
);

export const Rating: React.FC<{ value: number }> = ({ value }) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map((star) => (
      <span key={star} className={`text-xs ${star <= value ? 'text-amber-400' : 'text-stone-200'}`}>
        ★
      </span>
    ))}
  </div>
);