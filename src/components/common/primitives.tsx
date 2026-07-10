import React, { useState, useEffect, useRef } from 'react';
import { Check, ChevronDown } from 'lucide-react';

// --- 表单 Primitives ---

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success' | 'outline', size?: 'sm' | 'md' }> = ({
  children, variant = 'primary', size = 'md', className = '', type = 'button', ...props
}) => {
  const sizeClasses = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm';
  const base = `${sizeClasses} rounded-lg font-medium transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-offset-1 dark:focus:ring-offset-zinc-900`;

  const variants = {
    primary: "bg-ink text-white hover:bg-stone-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 shadow-sm focus:ring-ink/20 dark:focus:ring-white/20",
    secondary: "bg-stone-100 text-ink hover:bg-stone-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700 focus:ring-stone-300 dark:focus:ring-zinc-600",
    outline: "bg-white border border-border text-ink hover:bg-stone-50 dark:bg-transparent dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800 focus:ring-stone-200 dark:focus:ring-zinc-700",
    danger: "bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/30 focus:ring-red-200",
    ghost: "text-subtle hover:text-ink hover:bg-stone-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800 focus:ring-stone-200",
    success: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm focus:ring-emerald-200 dark:bg-emerald-600 dark:hover:bg-emerald-500"
  };

  return (
    <button type={type} className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label?: string, error?: string }> = ({
  label, error, className = '', ...props
}) => {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && <label className="text-xs font-bold text-subtle dark:text-zinc-400 uppercase tracking-wider">{label}</label>}
      <input
        className={`w-full px-3 py-2 bg-[color:var(--surface-muted)] border ${error ? 'border-red-300 focus:border-red-500 dark:border-red-800' : 'border-[color:var(--line)] focus:border-[color:var(--accent)]'} rounded-lg text-[color:var(--text-primary)] placeholder:text-[color:var(--text-secondary)]/60 focus:outline-none focus:ring-4 focus:ring-[color:var(--accent-soft)] dark:[color-scheme:dark] transition-all ${className}`}
        {...props}
      />
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
};

export const Select: React.FC<{
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: { id: string; name: string }[];
  placeholder?: string;
  disabled?: boolean;
}> = ({ label, value, onChange, options, placeholder = "请选择...", disabled = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(o => o.id === value);

  return (
    <div className="flex flex-col gap-1.5 w-full relative" ref={containerRef}>
      {label && <label className="text-xs font-bold text-subtle dark:text-zinc-400 uppercase tracking-wider">{label}</label>}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full px-3 py-2 bg-[color:var(--surface-muted)] border border-[color:var(--line)] rounded-lg text-[color:var(--text-primary)] flex items-center justify-between hover:border-[color:var(--accent)] focus:outline-none focus:ring-4 focus:ring-[color:var(--accent-soft)] transition-all ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'} ${isOpen ? 'border-[color:var(--accent)] ring-4 ring-[color:var(--accent-soft)]' : ''}`}
      >
        <span className={selectedOption ? 'text-[color:var(--text-primary)]' : 'text-[color:var(--text-secondary)]/70'}>
          {selectedOption ? selectedOption.name : placeholder}
        </span>
        <ChevronDown size={16} className={`text-[color:var(--text-secondary)] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-[color:var(--surface)] border border-[color:var(--line)] rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto p-1 animate-in fade-in zoom-in-95 duration-100">
          {options.length === 0 ? (
            <div className="p-3 text-xs text-stone-400 text-center">暂无选项</div>
          ) : (
            options.map(option => (
              <button
                type="button"
                key={option.id}
                onClick={() => { onChange(option.id); setIsOpen(false); }}
                className={`w-full px-3 py-2.5 text-left text-sm rounded-md cursor-pointer flex items-center justify-between transition-colors ${option.id === value ? 'bg-[color:var(--accent-soft)] text-[color:var(--text-primary)] font-bold' : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--accent-soft)]/60 hover:text-[color:var(--text-primary)]'}`}
              >
                <span>{option.name}</span>
                {option.id === value && <Check size={14} className="text-[color:var(--text-primary)]" />}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export const TextArea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; wrapperClassName?: string }> = ({
  label, className = '', wrapperClassName = '', ...props
}) => {
  return (
    <div className={`flex flex-col gap-1.5 w-full ${wrapperClassName}`}>
      {label && <label className="text-xs font-bold text-subtle dark:text-zinc-400 uppercase tracking-wider">{label}</label>}
      <textarea
        className={`w-full px-3 py-2 bg-[color:var(--surface-muted)] border border-[color:var(--line)] rounded-lg text-[color:var(--text-primary)] placeholder:text-[color:var(--text-secondary)]/60 focus:outline-none focus:border-[color:var(--accent)] focus:ring-4 focus:ring-[color:var(--accent-soft)] transition-all min-h-[100px] resize-y ${className}`}
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
      {label && <label className="text-xs font-bold text-subtle dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap">{label}</label>}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-border dark:border-zinc-800 rounded-lg text-ink dark:text-zinc-100 cursor-pointer flex items-center justify-between hover:border-stone-400 dark:hover:border-zinc-600 transition-colors ${isOpen ? 'ring-4 ring-stone-100 dark:ring-zinc-800 border-ink dark:border-zinc-400' : ''}`}
      >
        <span className="flex flex-wrap gap-1">
          {value.length === 0 ? (
            <span className="text-stone-400 dark:text-zinc-600 text-sm">{placeholder}</span>
          ) : (
            value.map(id => {
              const opt = options.find(o => o.id === id);
              return opt ? (
                <span key={id} className="text-[10px] bg-stone-100 dark:bg-zinc-800 text-ink dark:text-zinc-200 px-1.5 py-0.5 rounded border border-stone-200 dark:border-zinc-700">
                  {opt.name}
                </span>
              ) : null;
            })
          )}
        </span>
        <ChevronDown size={16} className={`text-stone-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-white dark:bg-zinc-900 border border-border dark:border-zinc-800 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto p-1">
          {options.length === 0 ? (
            <div className="p-2 text-xs text-stone-400 text-center">暂无选项</div>
          ) : (
            options.map(option => {
              const isSelected = value.includes(option.id);
              return (
                <button
                  type="button"
                  key={option.id}
                  onClick={() => toggleOption(option.id)}
                  className={`w-full px-3 py-2 text-left text-sm rounded cursor-pointer flex items-center justify-between transition-colors ${isSelected ? 'bg-ink/5 dark:bg-white/10 text-ink dark:text-white font-medium' : 'text-subtle dark:text-zinc-400 hover:bg-stone-50 dark:hover:bg-zinc-800'}`}
                >
                  <span>{option.name}</span>
                  {isSelected && <Check size={14} className="text-ink dark:text-white" />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
