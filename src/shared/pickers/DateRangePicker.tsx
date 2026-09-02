import { useState } from 'react';
import { CalendarRange } from 'lucide-react';
import PickerField from './PickerField';
import { CalendarGrid, MonthNav, dstr } from './DatePicker';
import { useIsMobile } from '../primitives';

export interface DateRange { start: string; end: string }

const prettyY = (v: string) => v ? new Date(v + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : '';

const PRESETS: { label: string; days: number }[] = [
  { label: '7 Days', days: 7 },
  { label: '15 Days', days: 15 },
  { label: '30 Days', days: 30 },
  { label: '45 Days', days: 45 },
  { label: '90 Days', days: 90 },
];

export default function DateRangePicker({ value, onChange, placeholder = 'Pick a range', className = '' }: {
  value: DateRange; onChange: (v: DateRange) => void; placeholder?: string; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const mobile = useIsMobile();
  const [month, setMonth] = useState(() => value.start ? new Date(value.start + 'T00:00:00') : new Date());
  const [draft, setDraft] = useState<DateRange>(value);
  const [hover, setHover] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState<number | null>(null);

  // display always includes the year
  const display = value.start && value.end ? `${prettyY(value.start)} → ${prettyY(value.end)}` : '';

  const openPicker = (o: boolean) => {
    if (o) { setDraft(value); setHover(null); setActivePreset(null); if (value.start) setMonth(new Date(value.start + 'T00:00:00')); }
    setOpen(o);
  };

  const pick = (v: string) => {
    setActivePreset(null);
    if (!draft.start || (draft.start && draft.end)) { setDraft({ start: v, end: '' }); setHover(null); }
    else if (v < draft.start) { setDraft({ start: v, end: draft.start }); setHover(null); }
    else { setDraft({ start: draft.start, end: v }); setHover(null); }
  };

  const applyPreset = (i: number) => {
    const end = dstr(new Date());
    const start = dstr(new Date(Date.now() - (PRESETS[i].days - 1) * 864e5));
    setDraft({ start, end });
    setActivePreset(i);
    setMonth(new Date(start + 'T00:00:00'));
  };

  const eff: DateRange = (() => {
    if (draft.start && draft.end) return draft;
    if (draft.start && hover) return hover < draft.start ? { start: hover, end: draft.start } : { start: draft.start, end: hover };
    return draft;
  })();

  const isStart = (v: string) => !!eff.start && v === eff.start;
  const isEnd = (v: string) => !!eff.end && v === eff.end;
  const isInRange = (v: string) => !!(eff.start && eff.end && v > eff.start && v < eff.end);
  const month2 = new Date(month.getFullYear(), month.getMonth() + 1, 1);

  return (
    <PickerField display={display} placeholder={placeholder} icon={<CalendarRange size={15} />}
      open={open} setOpen={openPicker}
      width={mobile ? 330 : 600} label={placeholder} className={className}>

      <div className={mobile ? '' : 'flex gap-4'}>
        {/* presets — left rail on desktop, horizontal scroll on mobile */}
        <div className={mobile
          ? 'hide-scrollbar mb-3 flex gap-2 overflow-x-auto pb-1'
          : 'flex w-[92px] shrink-0 flex-col gap-2 border-r tk-divider pr-3'}>
          {PRESETS.map((p, i) => (
            <button key={p.label} onClick={() => applyPreset(i)}
              className={`cal-preset !flex-none !px-2.5 !py-2 text-[11.5px] ${activePreset === i ? 'active' : ''}`}>
              {p.label}
            </button>
          ))}
        </div>

        {/* calendars — fixed 6-week height */}
        <div className={mobile ? '' : 'flex flex-1 gap-4'}>
          <div className="min-w-0 flex-1">
            <MonthNav month={month} onMonth={setMonth} side={mobile ? 'both' : 'left'} />
            <CalendarGrid month={month} isStart={isStart} isEnd={isEnd} isInRange={isInRange} onPick={pick} onHover={setHover} />
          </div>
          {!mobile && (
            <div className="min-w-0 flex-1">
              <MonthNav month={month2} onMonth={(d) => setMonth(new Date(d.getFullYear(), d.getMonth() - 1, 1))} side="right" />
              <CalendarGrid month={month2} isStart={isStart} isEnd={isEnd} isInRange={isInRange} onPick={pick} onHover={setHover} />
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 border-t tk-divider pt-2.5">
        <p className="truncate font-body text-[11px] text-muted">
          {!draft.start ? 'Select start date' : !draft.end ? 'Hover to preview · pick end' : `${prettyY(draft.start)} → ${prettyY(draft.end)}`}
        </p>
        <div className="flex shrink-0 gap-2">
          <button onClick={() => { setDraft({ start: '', end: '' }); setHover(null); setActivePreset(null); }} className="cal-clear !px-3.5 !py-1.5 text-[12px]">Clear</button>
          <button onClick={() => { onChange(draft.end ? draft : { start: '', end: '' }); setOpen(false); }}
            disabled={!!draft.start && !draft.end}
            className="cal-submit !px-5 !py-1.5 text-[12px] disabled:opacity-50">Submit</button>
        </div>
      </div>
    </PickerField>
  );
}
