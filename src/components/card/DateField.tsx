import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DayPicker } from 'react-day-picker';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { CalendarDays, ChevronDown } from 'lucide-react';

interface DateFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

// 触发按钮上方弹出的日期选择器，带年/月下拉与"回到今天/清除"快捷键
export const DateField: React.FC<DateFieldProps> = ({ label, value, onChange }) => {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [displayMonth, setDisplayMonth] = useState<Date>(new Date());
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const selected = value ? new Date(`${value}T00:00:00`) : undefined;

  const CALENDAR_WIDTH = 286;
  const CALENDAR_HEIGHT = 350;

  const openCalendar = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const left = Math.min(window.innerWidth - CALENDAR_WIDTH - 8, Math.max(8, rect.left));
    const top = Math.max(8, rect.top - CALENDAR_HEIGHT - 10);
    setPosition({ top, left });
    setDisplayMonth(selected || new Date());
    setOpen(true);
  };

  const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  const yearOptions = Array.from({ length: 120 }, (_, i) => 1990 + i);

  useEffect(() => {
    if (!open) return;

    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);

    return () => {
      document.removeEventListener('mousedown', onMouseDown);
    };
  }, [open]);

  return (
    <div className="flex flex-col gap-1.5 w-full relative">
      <label className="text-xs font-bold text-subtle dark:text-zinc-400 uppercase tracking-wider">{label}</label>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openCalendar())}
        className="w-full h-11 px-3 bg-[color:var(--surface-muted)] border border-[color:var(--line)] rounded-lg text-[color:var(--text-primary)] flex items-center justify-between hover:border-[color:var(--accent)] focus:outline-none focus:ring-4 focus:ring-[color:var(--accent-soft)] transition-all"
      >
        <span className={value ? 'text-[color:var(--text-primary)]' : 'text-[color:var(--text-secondary)]/70'}>
          {value || '选择日期'}
        </span>
        <CalendarDays size={16} className="text-[color:var(--text-secondary)]" />
      </button>

      {open && createPortal(
        <div
          ref={popoverRef}
          style={{ top: position.top, left: position.left }}
          className="fixed z-[2200] w-[286px] bg-[color:var(--surface)] border border-[color:var(--line)] rounded-xl p-3 shadow-2xl"
        >
          <div className="flex items-center gap-2 mb-1.5">
            <div className="relative flex-1">
              <select
                value={displayMonth.getMonth()}
                onChange={(e) => setDisplayMonth(new Date(displayMonth.getFullYear(), Number(e.target.value), 1))}
                className="w-full h-9 appearance-none rounded-md border border-[color:var(--line)] bg-[color:var(--surface-muted)] px-3 pr-8 text-sm text-[color:var(--text-primary)]"
              >
                {monthNames.map((name, index) => (
                  <option key={name} value={index}>{name}</option>
                ))}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[color:var(--text-secondary)]" />
            </div>
            <div className="relative flex-1">
              <select
                value={displayMonth.getFullYear()}
                onChange={(e) => setDisplayMonth(new Date(Number(e.target.value), displayMonth.getMonth(), 1))}
                className="w-full h-9 appearance-none rounded-md border border-[color:var(--line)] bg-[color:var(--surface-muted)] px-3 pr-8 text-sm text-[color:var(--text-primary)]"
              >
                {yearOptions.map((year) => (
                  <option key={year} value={year}>{year}年</option>
                ))}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[color:var(--text-secondary)]" />
            </div>
          </div>
          <DayPicker
            mode="single"
            selected={selected}
            locale={zhCN}
            month={displayMonth}
            onMonthChange={setDisplayMonth}
            hideNavigation
            onSelect={(date) => {
              if (!date) return;
              onChange(format(date, 'yyyy-MM-dd'));
              setOpen(false);
            }}
            className="text-[color:var(--text-primary)]"
            classNames={{
              months: 'flex gap-0',
              month: 'flex flex-col gap-1',
              caption: 'hidden',
              caption_label: 'hidden',
              month_grid: 'mt-0 w-full border-collapse table-fixed',
              weekdays: 'grid grid-cols-7 mb-1',
              weekday: 'h-8 text-center text-[11px] text-[color:var(--text-secondary)] font-semibold flex items-center justify-center',
              weeks: 'flex flex-col gap-0.5',
              week: 'grid grid-cols-7',
              day: 'h-9 w-9 p-0 mx-auto',
              day_button: 'h-8 w-8 rounded-md text-sm hover:bg-[color:var(--accent-soft)] transition-colors flex items-center justify-center'
            }}
            modifiersClassNames={{
              selected: 'rounded-md bg-[color:var(--accent)] text-white hover:bg-[color:var(--accent)]',
              today: 'calendar-today-dot text-[color:var(--accent)] font-bold',
              outside: 'text-[color:var(--text-secondary)]/40'
            }}
          />
          <div className="flex items-center justify-center gap-4 pt-2">
            <button
              type="button"
              onClick={() => {
                const today = new Date();
                setDisplayMonth(today);
                onChange(format(today, 'yyyy-MM-dd'));
                setOpen(false);
              }}
              className="text-xs font-semibold text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]"
            >
              回到今天
            </button>
            <button
              type="button"
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
              className="text-xs font-semibold text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]"
            >
              清除日期
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
