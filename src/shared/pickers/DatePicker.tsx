import { useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import PickerField from './PickerField';
import { MONTHS_SHORT } from '../../lib/api';

export const dstr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const pretty = (v: string) => v ? new Date(v + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

/**
 * Calendar month grid — trench-range styling, perfect-circle hover via a
 * fixed-size inner disc. Always renders 6 weeks (42 cells) so the popover
 * height never changes between months.
 */
export function CalendarGrid({ month, isStart, isEnd, isInRange, onPick, onHover, minDate, maxDate }: {
  month: Date;
  isStart: (v: string) => boolean;
  isEnd: (v: string) => boolean;
  isInRange: (v: string) => boolean;
  onPick: (v: string) => void;
  onHover?: (v: string | null) => void;
  minDate?: string; maxDate?: string;
}) {
  const y = month.getFullYear(), m = month.getMonth();
  const firstDow = new Date(y, m, 1).getDay();
  const days = new Date(y, m + 1, 0).getDate();
  const today = dstr(new Date());

  return (
    <div>
      <div className="mb-1 grid grid-cols-7">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
          <span key={d} className="pb-1 text-center font-body text-[10px] font-bold uppercase text-muted">{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1" onMouseLeave={() => onHover?.(null)}>
        {Array.from({ length: 42 }, (_, i) => {
          const dayNum = i - firstDow + 1;
          if (dayNum < 1 || dayNum > days) return <span key={i} className="cal-day muted">·</span>;
          const v = dstr(new Date(y, m, dayNum));
          const start = isStart(v), end = isEnd(v), inR = isInRange(v);
          const dis = !!((minDate && v < minDate) || (maxDate && v > maxDate));
          const trench = inR || start || end;
          return (
            <button key={i} disabled={dis}
              onClick={() => onPick(v)}
              onMouseEnter={() => onHover?.(v)}
              className={[
                'cal-day interactive',
                trench ? 'in-trench' : '',
                start ? 'trench-l' : '',
                end ? 'trench-r' : '',
                (start || end) ? 'has-badge' : '',
                dis ? 'dim' : '',
              ].join(' ')}>
              {(start || end) ? (
                <span className="cal-badge text-[12px]">{dayNum}</span>
              ) : (
                <span className="cal-inner">
                  <span className={v === today && !trench ? 'font-bold text-primary underline underline-offset-2' : ''}>{dayNum}</span>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Month header with quick month + year dropdowns and round nav buttons. */
export function MonthNav({ month, onMonth, side = 'both' }: { month: Date; onMonth: (d: Date) => void; side?: 'left' | 'right' | 'both' }) {
  const y = month.getFullYear(), m = month.getMonth();
  const yearBase = new Date().getFullYear();
  return (
    <div className="mb-2.5 flex h-9 items-center justify-between gap-1.5">
      {side !== 'right' ? (
        <button onClick={() => onMonth(new Date(y, m - 1, 1))} className="cal-nav shrink-0"><ChevronLeft size={15} /></button>
      ) : <span className="w-[34px] shrink-0" />}
      <div className="flex items-center gap-1.5">
        <select value={m} onChange={(e) => onMonth(new Date(y, +e.target.value, 1))}
          className="tk-input rounded-lg px-2 py-1.5 font-body text-[12px] font-bold">
          {MONTHS_SHORT.map((mo, i) => <option key={mo} value={i}>{mo}</option>)}
        </select>
        <select value={y} onChange={(e) => onMonth(new Date(+e.target.value, m, 1))}
          className="tk-input rounded-lg px-2 py-1.5 font-body text-[12px] font-bold">
          {Array.from({ length: 14 }, (_, i) => yearBase - 10 + i).map((yy) => <option key={yy}>{yy}</option>)}
        </select>
      </div>
      {side !== 'left' ? (
        <button onClick={() => onMonth(new Date(y, m + 1, 1))} className="cal-nav shrink-0"><ChevronRight size={15} /></button>
      ) : <span className="w-[34px] shrink-0" />}
    </div>
  );
}

export default function DatePicker({ value, onChange, placeholder = 'Pick a date', minDate, maxDate, className = '' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; minDate?: string; maxDate?: string; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => value ? new Date(value + 'T00:00:00') : new Date());

  return (
    <PickerField display={pretty(value)} placeholder={placeholder} icon={<CalendarDays size={15} />}
      open={open} setOpen={(o) => { setOpen(o); if (o && value) setMonth(new Date(value + 'T00:00:00')); }}
      width={292} className={className}>
      <MonthNav month={month} onMonth={setMonth} />
      <CalendarGrid month={month}
        isStart={(v) => v === value} isEnd={(v) => v === value} isInRange={() => false}
        onPick={(v) => { onChange(v); setOpen(false); }}
        minDate={minDate} maxDate={maxDate} />
      <div className="mt-2.5 flex justify-end gap-2 border-t tk-divider pt-2.5">
        <button onClick={() => { onChange(''); setOpen(false); }} className="cal-clear !px-3.5 !py-1.5 text-[12px]">Clear</button>
        <button onClick={() => { onChange(dstr(new Date())); setOpen(false); }} className="cal-submit !px-4 !py-1.5 text-[12px]">Today</button>
      </div>
    </PickerField>
  );
}
