import React from 'react';
import { Loader2 } from 'lucide-react';

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success' }> = ({ 
  children, variant = 'primary', className = '', ...props 
}) => {
  const base = "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2";
  const variants = {
    primary: "bg-ink text-white hover:bg-black shadow-md hover:shadow-lg",
    secondary: "bg-white border border-border text-ink hover:bg-paper",
    danger: "bg-red-50 text-red-600 hover:bg-red-100 border border-red-100",
    ghost: "text-subtle hover:text-ink hover:bg-paper",
    success: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-md"
  };

  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label?: string }> = ({ 
  label, className = '', ...props 
}) => {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && <label className="text-xs font-semibold text-subtle uppercase tracking-wider">{label}</label>}
      <input 
        className={`w-full px-3 py-2 bg-white border border-border rounded-lg text-ink focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink transition-all ${className}`}
        {...props}
      />
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
        className={`w-full px-3 py-2 bg-white border border-border rounded-lg text-ink focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink transition-all min-h-[100px] ${className}`}
        {...props}
      />
    </div>
  );
};

export const ImagePreview: React.FC<{ src: string, alt: string, className?: string }> = ({ src, alt, className }) => {
  const [error, setError] = React.useState(false);
  
  return (
    <div className={`relative overflow-hidden bg-paper ${className}`}>
      {src && !error ? (
        <img 
          src={src} 
          alt={alt} 
          className="w-full h-full object-cover"
          onError={() => setError(true)}
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-subtle text-[10px] bg-stone-100 p-2 text-center">
          无图片
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-white/50 animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-border flex justify-between items-center sticky top-0 bg-white z-10">
          <h3 className="font-semibold text-ink">{title}</h3>
          <button onClick={onClose} className="text-subtle hover:text-ink text-2xl leading-none">&times;</button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

export const PageLoader: React.FC = () => (
  <div className="flex h-screen w-full items-center justify-center bg-stone-50 text-subtle gap-2">
    <Loader2 className="w-5 h-5 animate-spin" />
    <span className="text-sm font-medium">同步中...</span>
  </div>
);

export const Rating: React.FC<{ value: number }> = ({ value }) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map((star) => (
      <span key={star} className={`text-xs ${star <= value ? 'text-yellow-500' : 'text-stone-300'}`}>
        ★
      </span>
    ))}
  </div>
);