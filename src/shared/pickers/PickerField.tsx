import { type ReactNode } from 'react';
import { useFlip, Popover } from '../primitives';

/** Shared inline picker shell: trigger field + flip-aware popover / mobile sheet. */
export default function PickerField({ display, placeholder, icon, open, setOpen, children, width = 320, label, className = '' }: {
  display: string; placeholder: string; icon: ReactNode;
  open: boolean; setOpen: (o: boolean) => void;
  children: ReactNode; width?: number; label?: string; className?: string;
}) {
  const { anchorRef, dir, measure } = useFlip(380);
  return (
    <div ref={anchorRef} className={`relative ${className}`}>
      <button type="button" onClick={() => { measure(); setOpen(!open); }}
        className={`tk-input flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left font-body text-sm ${display ? 'text-ink' : 'text-muted'}`}>
        <span className="truncate tabular-nums">{display || placeholder}</span>
        <span className="shrink-0 text-muted">{icon}</span>
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={anchorRef} dir={dir} width={width} sheetTitle={label || placeholder}>
        {children}
      </Popover>
    </div>
  );
}
