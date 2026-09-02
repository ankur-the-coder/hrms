import { useState, useMemo } from 'react';
import { ChevronDown, Check, X, Search } from 'lucide-react';
import { useFlip, Popover } from './primitives';

export interface Option { value: string; label: string; hint?: string }

interface BaseProps {
  options: Option[];
  placeholder?: string;
  searchable?: boolean;
  className?: string;
  disabled?: boolean;
  /** Max chips shown in the multi trigger before collapsing to "+N" (keeps the field one line tall). */
  maxChips?: number;
}
interface SingleProps extends BaseProps { multi?: false; value: string | null; onChange: (v: string | null) => void }
interface MultiProps extends BaseProps { multi: true; values: string[]; onChange: (v: string[]) => void }

export default function Select(props: SingleProps | MultiProps) {
  const { options, placeholder = 'Select…', searchable = true, className = '', disabled, maxChips = 2 } = props;
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const { anchorRef, dir, measure } = useFlip(300);

  const selected: string[] = props.multi ? props.values : props.value ? [props.value] : [];
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? options.filter((o) => o.label.toLowerCase().includes(t)) : options;
  }, [q, options]);

  const toggle = (v: string) => {
    if (props.multi) {
      props.onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
    } else {
      props.onChange(v === props.value ? null : v);
      setOpen(false);
    }
  };

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (props.multi) props.onChange([]); else props.onChange(null);
  };

  const labelFor = (v: string) => options.find((o) => o.value === v)?.label || v;

  return (
    <div ref={anchorRef} className={`relative ${className}`}>
      <button type="button" disabled={disabled}
        onClick={() => { measure(); setOpen((o) => !o); setQ(''); }}
        className="tk-input flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left font-body text-sm disabled:opacity-50">
        <span className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
          {selected.length === 0 && <span className="truncate text-muted">{placeholder}</span>}
          {props.multi
            ? <>
                {selected.slice(0, maxChips).map((v) => (
                  <span key={v} className="tk-chip flex shrink-0 items-center gap-1 px-2 py-0.5 text-[11.5px] font-bold text-ink/80">
                    <span className="max-w-[80px] truncate">{labelFor(v)}</span>
                    <span role="button" onClick={(e) => { e.stopPropagation(); toggle(v); }} className="cursor-pointer text-muted hover:text-rose-500"><X size={11} /></span>
                  </span>
                ))}
                {selected.length > maxChips && (
                  <span className="tk-chip shrink-0 px-2 py-0.5 text-[11.5px] font-bold text-primary" data-tip={selected.slice(maxChips).map(labelFor).join(', ')}>
                    +{selected.length - maxChips}
                  </span>
                )}
              </>
            : selected.length > 0 && <span className="truncate text-ink">{labelFor(selected[0])}</span>}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {selected.length > 0 && <span role="button" onClick={clear} className="cursor-pointer text-muted hover:text-rose-500"><X size={13} /></span>}
          <ChevronDown size={15} className={`text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>

      <Popover open={open} onClose={() => setOpen(false)} anchorRef={anchorRef} dir={dir} width={280} sheetTitle={placeholder}>
        {searchable && (
          <div className="tk-inset mb-2 flex items-center gap-2 px-3 py-2">
            <Search size={13} className="text-muted" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…"
              className="w-full bg-transparent font-body text-[13px] text-ink outline-none placeholder:text-muted" />
          </div>
        )}
        <div className="hide-scrollbar max-h-56 overflow-y-auto">
          {filtered.length === 0 && <p className="px-3 py-4 text-center font-body text-[12.5px] text-muted">No matches</p>}
          {filtered.map((o) => {
            const on = selected.includes(o.value);
            return (
              <button key={o.value} onClick={() => toggle(o.value)}
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left font-body text-[13px] transition hover:bg-primary/8 ${on ? 'font-bold text-primary' : 'text-ink/80'}`}>
                <span className="min-w-0">
                  <span className="block truncate">{o.label}</span>
                  {o.hint && <span className="block truncate text-[11px] text-muted">{o.hint}</span>}
                </span>
                {on && <Check size={14} className="shrink-0" />}
              </button>
            );
          })}
        </div>
        {props.multi && (
          <div className="mt-2 flex justify-between border-t tk-divider pt-2">
            <button onClick={() => props.onChange(filtered.map((o) => o.value))} className="font-body text-[12px] font-bold text-primary hover:underline">Select all</button>
            <button onClick={() => props.onChange([])} className="font-body text-[12px] font-bold text-muted hover:text-ink">Clear</button>
          </div>
        )}
      </Popover>
    </div>
  );
}
