import { useState, useRef, useCallback, useEffect } from 'react';
import { Clock3 } from 'lucide-react';
import PickerField from './PickerField';

/*
 * TimePicker — three formats: Clock Dial (default desktop), iOS Wheel
 * (default mobile/touch), Sliders. Inline popover / mobile sheet.
 * Value contract: "HH:MM" 24-hour string.
 */

type TMode = 'clock' | 'wheel' | 'slider';
const isTouch = () => typeof window !== 'undefined' && (window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 640);
const defaultMode = (): TMode => {
  const s = localStorage.getItem('aviary-timepicker-mode') as TMode | null;
  if (s === 'clock' || s === 'wheel' || s === 'slider') return s;
  return isTouch() ? 'wheel' : 'clock';
};
const parse = (v: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v || '');
  if (!m) return { h24: 9, min: 30 };
  return { h24: Math.min(23, +m[1]), min: Math.min(59, +m[2]) };
};
const to12 = (h: number) => ({ h12: h % 12 === 0 ? 12 : h % 12, pm: h >= 12 });
const to24 = (h12: number, pm: boolean) => (pm ? (h12 % 12) + 12 : h12 % 12);
const fmt = (h: number, m: number) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
const display = (v: string) => {
  if (!v) return '';
  const { h24, min } = parse(v);
  const { h12, pm } = to12(h24);
  return `${h12}:${String(min).padStart(2, '0')} ${pm ? 'PM' : 'AM'}`;
};

/* ---- clock dial ---- */
function Dial({ h12, min, phase, onHour, onMinute, advance }: {
  h12: number; min: number; phase: 'hour' | 'minute';
  onHour: (h: number) => void; onMinute: (m: number) => void; advance: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef(false);
  const SIZE = 212, C = SIZE / 2, R = 64;

  const angle = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    let d = (Math.atan2(e.clientY - r.top - C, e.clientX - r.left - C) * 180) / Math.PI + 90;
    if (d < 0) d += 360;
    return d;
  };
  const apply = useCallback((deg: number, commit: boolean) => {
    if (phase === 'hour') {
      let h = Math.round(deg / 30) % 12; if (h === 0) h = 12;
      onHour(h);
      if (commit) advance();
    } else onMinute(Math.round(deg / 6) % 60);
  }, [phase, onHour, onMinute, advance]);

  const deg = phase === 'hour' ? (h12 % 12) * 30 : min * 6;
  const bx = Math.sin((deg * Math.PI) / 180) * R;
  const by = -Math.cos((deg * Math.PI) / 180) * R;
  const anim = drag.current ? 'none' : 'all 0.18s cubic-bezier(0.4,0,0.2,1)';

  return (
    <div ref={ref}
      onPointerDown={(e) => { drag.current = true; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); apply(angle(e), false); }}
      onPointerMove={(e) => { if (drag.current) apply(angle(e), false); }}
      onPointerUp={(e) => { if (drag.current) { drag.current = false; apply(angle(e), true); } }}
      className="tk-raise-sm relative mx-auto cursor-pointer touch-none select-none rounded-full"
      style={{ width: SIZE, height: SIZE }}>
      <div className="pointer-events-none absolute left-1/2 top-1/2">
        <div className="absolute rounded-full bg-primary" style={{ width: 2, height: R - 16, left: -1, top: -(R - 16), transform: `rotate(${deg}deg)`, transformOrigin: `50% ${R - 16}px`, transition: anim }} />
        <div className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-primary" />
        <div className="absolute flex h-9 w-9 items-center justify-center rounded-full border-2 border-primary bg-surface font-body text-[13.5px] font-bold text-primary"
          style={{ left: bx - 18, top: by - 18, transition: anim }}>
          {phase === 'hour' ? h12 : String(min).padStart(2, '0')}
        </div>
      </div>
      {Array.from({ length: 12 }, (_, i) => {
        const n = phase === 'hour' ? i + 1 : i * 5;
        const a = phase === 'hour' ? ((i + 1) * 30 * Math.PI) / 180 : (i * 5 * 6 * Math.PI) / 180;
        const covered = phase === 'hour' ? h12 === n : Math.abs(min - n) < 3 || (n === 0 && min >= 58);
        return (
          <span key={i} className={`pointer-events-none absolute flex h-7 w-7 items-center justify-center font-body text-[12.5px] font-semibold ${covered ? 'text-transparent' : 'text-ink/65'}`}
            style={{ left: C + Math.sin(a) * R - 14, top: C - Math.cos(a) * R - 14 }}>
            {phase === 'hour' ? n : String(n).padStart(2, '0')}
          </span>
        );
      })}
    </div>
  );
}

/* ---- wheel ---- */
const IH = 38, WH = 190;
function WheelCol({ items, index, onChange }: { items: string[]; index: number; onChange: (i: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(null);
  const lock = useRef(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    lock.current = true;
    el.scrollTop = index * IH;
    const t = setTimeout(() => { lock.current = false; }, 80);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const settle = () => {
    if (lock.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const el = ref.current; if (!el) return;
      const i = Math.max(0, Math.min(items.length - 1, Math.round(el.scrollTop / IH)));
      lock.current = true;
      el.scrollTo({ top: i * IH, behavior: 'smooth' });
      setTimeout(() => { lock.current = false; }, 220);
      if (i !== index) onChange(i);
    }, 110);
  };
  return (
    <div ref={ref} onScroll={settle} className="hide-scrollbar h-full w-full snap-y snap-mandatory overflow-y-scroll overscroll-contain"
      style={{ paddingTop: (WH - IH) / 2, paddingBottom: (WH - IH) / 2 }}>
      {items.map((it, i) => (
        <button key={i} onClick={() => { const el = ref.current; if (el) { lock.current = true; el.scrollTo({ top: i * IH, behavior: 'smooth' }); setTimeout(() => { lock.current = false; }, 220); } onChange(i); }}
          className={`flex h-[38px] w-full snap-center items-center justify-center font-body tabular-nums transition-all ${i === index ? 'text-[18px] font-bold text-primary' : 'text-[14px] font-medium text-muted/60'}`}>
          {it}
        </button>
      ))}
    </div>
  );
}

export default function TimePicker({ value, onChange, placeholder = 'Pick a time', label, className = '' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; label?: string; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<TMode>(defaultMode);
  const [phase, setPhase] = useState<'hour' | 'minute'>('hour');
  const [draft, setDraft] = useState(() => parse(value));
  const opening = useRef(value);

  const { h24, min } = draft;
  const { h12, pm } = to12(h24);

  const setOpenWrap = (o: boolean) => {
    if (o) { opening.current = value; setDraft(parse(value)); setPhase('hour'); }
    setOpen(o);
  };
  const pickMode = (m: TMode) => { setMode(m); localStorage.setItem('aviary-timepicker-mode', m); };
  const setH = (h: number) => setDraft((d) => ({ ...d, h24: to24(h, d.h24 >= 12) }));
  const setM = (m: number) => setDraft((d) => ({ ...d, min: m }));
  const setPm = (p: boolean) => setDraft((d) => ({ ...d, h24: to24(to12(d.h24).h12, p) }));

  return (
    <PickerField display={display(value)} placeholder={placeholder} icon={<Clock3 size={15} />} open={open} setOpen={setOpenWrap} width={300} label={label || placeholder} className={className}>
      {/* readout */}
      <div className="tk-inset mb-3 flex items-center justify-between gap-3 px-4 py-2.5">
        <div className="flex items-baseline gap-1">
          <button onClick={() => { setPhase('hour'); pickMode('clock'); }} className={`font-display text-[28px] font-semibold tabular-nums leading-none text-primary ${mode === 'clock' && phase === 'hour' ? 'underline decoration-2 underline-offset-4' : ''}`}>{String(h12).padStart(2, '0')}</button>
          <span className="font-display text-[24px] font-semibold leading-none text-muted">:</span>
          <button onClick={() => { setPhase('minute'); pickMode('clock'); }} className={`font-display text-[28px] font-semibold tabular-nums leading-none text-ink ${mode === 'clock' && phase === 'minute' ? 'underline decoration-2 underline-offset-4' : ''}`}>{String(min).padStart(2, '0')}</button>
        </div>
        <div className="flex gap-0.5 rounded-full p-0.5">
          {(['AM', 'PM'] as const).map((p) => (
            <button key={p} onClick={() => setPm(p === 'PM')}
              className={`rounded-full px-2.5 py-1 font-body text-[11px] font-bold transition ${(p === 'PM') === pm ? 'tk-btn-primary !px-2.5 !py-1' : 'text-muted hover:text-ink'}`}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* mode rail */}
      <div className="tk-inset mb-3 grid grid-cols-3 gap-0.5 p-1">
        {([['clock', 'Clock'], ['wheel', 'Wheel'], ['slider', 'Sliders']] as const).map(([k, l]) => (
          <button key={k} onClick={() => pickMode(k)}
            className={`rounded-lg px-2 py-1.5 font-body text-[12px] font-bold transition ${mode === k ? 'tk-raise-sm text-primary' : 'text-muted hover:text-ink'}`}>
            {l}
          </button>
        ))}
      </div>

      <div className="min-h-[212px]">
        {mode === 'clock' && (
          <div className="space-y-2.5">
            <div className="flex justify-center gap-0.5">
              {(['hour', 'minute'] as const).map((p) => (
                <button key={p} onClick={() => setPhase(p)} className={`rounded-full px-3.5 py-1 font-body text-[11.5px] font-bold transition ${phase === p ? 'tk-raise-sm text-primary' : 'text-muted'}`}>{p === 'hour' ? 'Hours' : 'Minutes'}</button>
              ))}
            </div>
            <Dial h12={h12} min={min} phase={phase} onHour={setH} onMinute={setM} advance={() => setPhase('minute')} />
          </div>
        )}
        {mode === 'wheel' && (
          <div className="tk-inset relative overflow-hidden px-1" style={{ height: WH }}>
            <div className="tk-raise-sm pointer-events-none absolute left-2 right-2 top-1/2 h-[38px] -translate-y-1/2 rounded-xl" />
            <div className="relative z-[5] grid h-full grid-cols-3">
              <WheelCol items={Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'))} index={h12 - 1} onChange={(i) => setH(i + 1)} />
              <WheelCol items={Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))} index={min} onChange={setM} />
              <WheelCol items={['AM', 'PM']} index={pm ? 1 : 0} onChange={(i) => setPm(i === 1)} />
            </div>
          </div>
        )}
        {mode === 'slider' && (
          <div className="space-y-6 px-1 py-4">
            <div>
              <div className="mb-2 flex justify-between font-body text-[12.5px] font-semibold"><span className="text-ink/70">Hours</span><span className="font-bold tabular-nums text-primary">{String(h12).padStart(2, '0')}</span></div>
              <input type="range" min={1} max={12} value={h12} onChange={(e) => setH(+e.target.value)} className="tk-range w-full" />
            </div>
            <div>
              <div className="mb-2 flex justify-between font-body text-[12.5px] font-semibold"><span className="text-ink/70">Minutes</span><span className="font-bold tabular-nums text-primary">{String(min).padStart(2, '0')}</span></div>
              <input type="range" min={0} max={59} value={min} onChange={(e) => setM(+e.target.value)} className="tk-range w-full" />
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex justify-end gap-2 border-t tk-divider pt-2.5">
        <button onClick={() => setDraft(parse(opening.current))} className="tk-btn-ghost rounded-full px-4 py-1.5 font-body text-[12.5px] font-semibold">Reset</button>
        <button onClick={() => { onChange(fmt(h24, min)); setOpen(false); }} className="tk-btn-primary rounded-full px-5 py-1.5 font-body text-[12.5px] font-bold">Submit</button>
      </div>
    </PickerField>
  );
}
