import React, { useId, useState, useEffect, useRef } from 'react';
import { Check, ChevronDown, Eye, EyeOff } from 'lucide-react';

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
  label, error, className = '', type, ...props
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const generatedId = useId();
  const inputId = props.id || generatedId;
  const isPassword = type === 'password';

  const input = (
    <input
      type={isPassword && showPassword ? 'text' : type}
      id={inputId}
      className={`w-full px-3 py-2 bg-[color:var(--surface-muted)] border ${error ? 'border-red-300 focus:border-red-500 dark:border-red-800' : 'border-[color:var(--line)] focus:border-[color:var(--accent)]'} rounded-lg text-[color:var(--text-primary)] placeholder:text-[color:var(--text-secondary)]/60 focus:outline-none focus:ring-4 focus:ring-[color:var(--accent-soft)] dark:[color-scheme:dark] transition-all ${isPassword ? 'pr-10' : ''} ${className}`}
      {...props}
    />
  );

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && <label htmlFor={inputId} className="text-xs font-bold text-subtle dark:text-zinc-400 uppercase tracking-wider">{label}</label>}
      {isPassword ? (
        <div className="relative w-full">
          {input}
          <button
            type="button"
            aria-label={showPassword ? '隐藏密码' : '显示密码'}
            title={showPassword ? '隐藏密码' : '显示密码'}
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] transition-colors"
          >
            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
      ) : input}
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

  const selectedOptions = value
    .map((id) => options.find((option) => option.id === id))
    .filter((option): option is { id: string; name: string } => !!option);
  const selectedLabel = selectedOptions.length <= 2
    ? selectedOptions.map((option) => option.name).join('、')
    : `${selectedOptions.slice(0, 2).map((option) => option.name).join('、')} +${selectedOptions.length - 2}`;

  return (
    <div className="flex flex-col gap-1.5 w-full relative" ref={containerRef}>
      {label && <label className="text-xs font-bold text-subtle dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap">{label}</label>}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className={`flex h-11 w-full items-center justify-between gap-3 rounded-lg border bg-[color:var(--surface-muted)] px-3 text-[color:var(--text-primary)] transition-all hover:border-[color:var(--accent)] focus:outline-none focus:ring-4 focus:ring-[color:var(--accent-soft)] ${isOpen ? 'border-[color:var(--accent)] ring-4 ring-[color:var(--accent-soft)]' : 'border-[color:var(--line)]'}`}
      >
        <span className={`min-w-0 truncate text-sm ${selectedOptions.length > 0 ? '' : 'text-[color:var(--text-secondary)]/70'}`}>
          {selectedOptions.length > 0 ? selectedLabel : placeholder}
        </span>
        <ChevronDown size={16} className={`shrink-0 text-[color:var(--text-secondary)] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] p-1 shadow-xl">
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
                  className={`flex w-full cursor-pointer items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors ${isSelected ? 'bg-[color:var(--accent-soft)] font-medium text-[color:var(--text-primary)]' : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--accent-soft)]/60 hover:text-[color:var(--text-primary)]'}`}
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
