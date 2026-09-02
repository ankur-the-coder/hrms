import { useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import PickerField from './PickerField';
import { MONTHS_SHORT, MONTHS } from '../../lib/api';

const pretty = (v: string) => {
  if (!v) return '';
  const [y, m] = v.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
};
const prettyShort = (v: string) => {
  if (!v) return '';
  const [y, m] = v.split('-').map(Number);
  return `${MONTHS_SHORT[m - 1]} ${y}`;
};
const mval = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, '0')}`;

function YearGrid({ year, setYear, isStart, isEnd, isInRange, onPick, onHover }: {
  year: number; setYear: (y: number) => void;
  isStart: (v: string) => boolean; isEnd: (v: string) => boolean; isInRange: (v: string) => boolean;
  onPick: (v: string) => void; onHover?: (v: string | null) => void;
}) {
  const yearBase = new Date().getFullYear();
  return (
    <div>
      <div className="mb-2.5 flex h-9 items-center justify-between">
        <button onClick={() => setYear(year - 1)} className="cal-nav"><ChevronLeft size={15} /></button>
        <select value={year} onChange={(e) => setYear(+e.target.value)}
          className="tk-input rounded-lg px-2.5 py-1.5 font-body text-[12.5px] font-bold">
          {Array.from({ length: 14 }, (_, i) => yearBase - 10 + i).map((yy) => <option key={yy}>{yy}</option>)}
        </select>
        <button onClick={() => setYear(year + 1)} className="cal-nav"><ChevronRight size={15} /></button>
      </div>
      <div className="grid grid-cols-3 gap-y-1.5" onMouseLeave={() => onHover?.(null)}>
        {MONTHS_SHORT.map((mo, i) => {
          const v = mval(year, i);
          const start = isStart(v), end = isEnd(v), inR = isInRange(v);
          const trench = inR || start || end;
          const col = i % 3;
          const capL = start || (trench && col === 0);
          const capR = end || (trench && col === 2);
          return (
            <button key={mo} onClick={() => onPick(v)} onMouseEnter={() => onHover?.(v)}
              className={[
                'cal-day sq interactive !h-11',
                trench ? 'in-trench' : '',
                capL ? 'trench-l' : '',
                capR ? 'trench-r' : '',
                (start || end) ? 'has-badge' : '',
              ].join(' ')}>
              {(start || end)
                ? <span className="cal-badge !h-[34px] !w-[52px] !rounded-[10px] text-[12px]">{mo}</span>
                : <span className="cal-inner"><span className="font-body text-[12.5px] font-semibold">{mo}</span></span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function MonthPicker({ value, onChange, placeholder = 'Pick a month', className = '' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(() => value ? +value.split('-')[0] : new Date().getFullYear());
  return (
    <PickerField display={pretty(value)} placeholder={placeholder} icon={<Calendar size={15} />}
      open={open} setOpen={(o) => { setOpen(o); if (o && value) setYear(+value.split('-')[0]); }} width={252} className={className}>
      <YearGrid year={year} setYear={setYear}
        isStart={(v) => v === value} isEnd={(v) => v === value} isInRange={() => false}
        onPick={(v) => { onChange(v); setOpen(false); }} />
      <div className="mt-2.5 flex justify-end border-t tk-divider pt-2.5">
        <button onClick={() => { onChange(''); setOpen(false); }} className="cal-clear !px-3.5 !py-1.5 text-[12px]">Clear</button>
      </div>
    </PickerField>
  );
}

export interface MonthRange { start: string; end: string }

export function MonthRangePicker({ value, onChange, placeholder = 'Pick month range', className = '' }: {
  value: MonthRange; onChange: (v: MonthRange) => void; placeholder?: string; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(() => value.start ? +value.start.split('-')[0] : new Date().getFullYear());
  const [draft, setDraft] = useState<MonthRange>(value);
  const [hover, setHover] = useState<string | null>(null);

  const display = value.start && value.end ? `${prettyShort(value.start)} → ${prettyShort(value.end)}` : '';

  const pick = (v: string) => {
    if (!draft.start || (draft.start && draft.end)) setDraft({ start: v, end: '' });
    else if (v < draft.start) setDraft({ start: v, end: draft.start });
    else setDraft({ start: draft.start, end: v });
    setHover(null);
  };

  const eff: MonthRange = (() => {
    if (draft.start && draft.end) return draft;
    if (draft.start && hover) return hover < draft.start ? { start: hover, end: draft.start } : { start: draft.start, end: hover };
    return draft;
  })();

  return (
    <PickerField display={display} placeholder={placeholder} icon={<Calendar size={15} />}
      open={open} setOpen={(o) => { setOpen(o); if (o) { setDraft(value); setHover(null); if (value.start) setYear(+value.start.split('-')[0]); } }}
      width={252} className={className}>
      <YearGrid year={year} setYear={setYear}
        isStart={(v) => !!eff.start && v === eff.start}
        isEnd={(v) => !!eff.end && v === eff.end}
        isInRange={(v) => !!(eff.start && eff.end && v > eff.start && v < eff.end)}
        onPick={pick} onHover={setHover} />
      <div className="mt-2.5 flex items-center justify-between gap-2 border-t tk-divider pt-2.5">
        <p className="font-body text-[11px] text-muted">{!draft.start ? 'Pick start' : !draft.end ? 'Pick end' : `${prettyShort(draft.start)} → ${prettyShort(draft.end)}`}</p>
        <div className="flex gap-2">
          <button onClick={() => { setDraft({ start: '', end: '' }); setHover(null); }} className="cal-clear !px-3 !py-1.5 text-[12px]">Clear</button>
          <button onClick={() => { onChange(draft.end ? draft : { start: '', end: '' }); setOpen(false); }}
            disabled={!!draft.start && !draft.end}
            className="cal-submit !px-4 !py-1.5 text-[12px] disabled:opacity-50">Submit</button>
        </div>
      </div>
    </PickerField>
  );
}
