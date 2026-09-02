import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

/* ---------- Avatar ---------- */
export function Avatar({ src, name, size = 40 }: { src?: string | null; name: string; size?: number }) {
  const initials = (name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  if (src) return <img src={src} alt={name} style={{ width: size, height: size }} className="tk-raise-sm shrink-0 rounded-full object-cover" />;
  return (
    <div style={{ width: size, height: size, fontSize: size * 0.36 }}
      className="tk-raise-sm flex shrink-0 items-center justify-center rounded-full font-body font-semibold text-primary">
      {initials}
    </div>
  );
}

/* ---------- Buttons ---------- */
export const btnPrimary = 'tk-btn-primary inline-flex items-center justify-center gap-2 px-4 py-2.5 font-body text-sm font-semibold';
export const btnGhost = 'tk-btn-ghost inline-flex items-center justify-center gap-2 px-4 py-2.5 font-body text-sm font-semibold';
export const inputCls = 'tk-input w-full px-3.5 py-2.5 font-body text-sm placeholder:text-muted';
export const labelCls = 'mb-1.5 block font-body text-[11px] font-bold uppercase tracking-[0.12em] text-muted';

/* ---------- Badge ---------- */
export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'green' | 'amber' | 'red' | 'blue' | 'gold' }) {
  const tones: Record<string, string> = {
    neutral: 'text-muted', green: 'text-primary', amber: 'text-amber-600',
    red: 'text-rose-500', blue: 'text-sky-600', gold: 'text-gold-deep',
  };
  return (
    <span className={`tk-chip inline-flex items-center gap-1 px-2.5 py-0.5 font-body text-[11px] font-bold ${tones[tone]}`}>
      {children}
    </span>
  );
}

/* ---------- Loading ---------- */
export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-14">
      <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" />
      {label && <p className="font-body text-sm text-muted">{label}</p>}
    </div>
  );
}
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`tk-skeleton ${className}`} />;
}
export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2.5 p-5">
      <Skeleton className="h-9 w-2/5" />
      {Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-11 w-full" style-none="" />)}
    </div>
  );
}

/* ---------- Empty ---------- */
export function EmptyState({ icon, title, subtitle }: { icon: ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <div className="tk-inset mb-1 flex h-12 w-12 items-center justify-center rounded-2xl text-muted">{icon}</div>
      <p className="font-display text-[15px] font-semibold text-ink/80">{title}</p>
      {subtitle && <p className="max-w-xs font-body text-[13px] text-muted">{subtitle}</p>}
    </div>
  );
}

/* ---------- Modal ---------- */
export function Modal({ open, onClose, title, children, wide = false }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-[3px] sm:items-center sm:p-6"
          onMouseDown={(e: React.MouseEvent) => { if (e.target === e.currentTarget) onClose(); }}>
          <motion.div initial={{ y: 40, opacity: 0, scale: 0.98 }} animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 30, opacity: 0, scale: 0.98 }} transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            className={`tk-pop max-h-[92vh] w-full overflow-y-auto rounded-t-3xl sm:rounded-3xl ${wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'}`}>
            <div className="sticky top-0 z-10 flex items-center justify-between border-b tk-divider bg-surface/95 px-6 py-4 backdrop-blur">
              <h2 className="font-display text-lg font-semibold tracking-tight text-ink">{title}</h2>
              <button onClick={onClose} className="rounded-full p-1.5 text-muted transition hover:text-ink"><X size={18} /></button>
            </div>
            <div className="px-6 py-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

/* ---------- Smart flip popover ----------
   Measures available space and opens up when the bottom can't fit. */
export function useFlip(estHeight = 320) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [dir, setDir] = useState<'down' | 'up'>('down');
  const measure = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
    setDir(below < estHeight && r.top > below ? 'up' : 'down');
  }, [estHeight]);
  return { anchorRef, dir, measure };
}

export function useIsMobile() {
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && (window.innerWidth < 640 || window.matchMedia('(pointer: coarse)').matches));
  useEffect(() => {
    const on = () => setMobile(window.innerWidth < 640 || window.matchMedia('(pointer: coarse)').matches);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return mobile;
}

/** Side drawer — slides in from the right; used for entity create/edit forms. */
export function Drawer({ open, onClose, title, children, width = 440 }: { open: boolean; onClose: () => void; title: string; children: ReactNode; width?: number }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]"
          onMouseDown={(e: React.MouseEvent) => { if (e.target === e.currentTarget) onClose(); }}>
          <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            style={{ width: `min(${width}px, 94vw)` }}
            className="tk-pop absolute inset-y-0 right-0 !rounded-none !rounded-l-3xl overflow-y-auto">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b tk-divider bg-surface/95 px-5 py-4 backdrop-blur">
              <h2 className="font-display text-[16px] font-semibold tracking-tight text-ink">{title}</h2>
              <button onClick={onClose} className="rounded-full p-1.5 text-muted transition hover:text-ink"><X size={17} /></button>
            </div>
            <div className="px-5 py-4">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

/** Global tooltip layer — event-delegated [data-tip], fixed positioning, viewport-clamped.
 *  Mount once in Layout; tooltips can never be clipped by table overflow. */
export function TooltipLayer() {
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);
  useEffect(() => {
    let current: HTMLElement | null = null;
    const onOver = (e: MouseEvent) => {
      const el = (e.target as HTMLElement)?.closest?.('[data-tip]') as HTMLElement | null;
      if (!el || el === current) return;
      current = el;
      const text = el.getAttribute('data-tip') || '';
      if (!text) return;
      const r = el.getBoundingClientRect();
      setTip({ text, x: r.left + r.width / 2, y: r.top });
    };
    const onOut = (e: MouseEvent) => {
      if (current && !current.contains(e.relatedTarget as Node)) { current = null; setTip(null); }
    };
    const onHide = () => { current = null; setTip(null); };
    document.addEventListener('mouseover', onOver);
    document.addEventListener('mouseout', onOut);
    document.addEventListener('scroll', onHide, true);
    document.addEventListener('mousedown', onHide);
    return () => {
      document.removeEventListener('mouseover', onOver);
      document.removeEventListener('mouseout', onOut);
      document.removeEventListener('scroll', onHide, true);
      document.removeEventListener('mousedown', onHide);
    };
  }, []);
  if (!tip) return null;
  const w = Math.min(320, tip.text.length * 6.6 + 22);
  const left = Math.max(8, Math.min(tip.x - w / 2, window.innerWidth - w - 8));
  const above = tip.y > 44;
  return createPortal(
    <div className="tk-tooltip" style={{ left, top: above ? undefined : tip.y + 26, bottom: above ? window.innerHeight - tip.y + 8 : undefined }}>
      {tip.text}
    </div>,
    document.body
  );
}

/** Circular neumorphic loader. */
export function NeuLoader({ label, size = 64 }: { label?: string; size?: number }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-14">
      <div className="tk-neuloader" style={{ width: size, height: size }} />
      {label && <p className="font-body text-sm text-muted">{label}</p>}
    </div>
  );
}

/** Popover on desktop (portal + fixed positioning, viewport-clamped so it
 *  never gets clipped by overflow containers), bottom-sheet on mobile. */
export function Popover({ open, onClose, anchorRef, dir, children, width = 320, sheetTitle }: {
  open: boolean; onClose: () => void; anchorRef: React.RefObject<HTMLDivElement | null>;
  dir: 'down' | 'up'; children: ReactNode; width?: number; sheetTitle?: string;
}) {
  const mobile = useIsMobile();
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number; width: number } | null>(null);

  useEffect(() => {
    if (!open || mobile) return;
    const update = () => {
      const r = anchorRef.current?.getBoundingClientRect();
      if (!r) return;
      const vw = window.innerWidth;
      const effWidth = Math.min(width, vw - 16);
      const left = Math.min(Math.max(8, r.left), vw - effWidth - 8);
      setPos(dir === 'down'
        ? { left, top: r.bottom + 6, width: effWidth }
        : { left, bottom: window.innerHeight - r.top + 6, width: effWidth });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => { window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true); };
  }, [open, mobile, anchorRef, dir, width]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    const onDown = (e: MouseEvent) => {
      if (mobile) return;
      const t = e.target as Node;
      if (anchorRef.current?.contains(t)) return;
      if (popRef.current?.contains(t)) return;
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('mousedown', onDown);
    return () => { window.removeEventListener('keydown', onKey, true); window.removeEventListener('mousedown', onDown); };
  }, [open, onClose, anchorRef, mobile]);

  if (mobile) {
    return createPortal(
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] flex items-end bg-black/40 backdrop-blur-[2px]"
            onMouseDown={(e: React.MouseEvent) => { if (e.target === e.currentTarget) onClose(); }}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 320 }}
              className="tk-pop max-h-[85vh] w-full overflow-y-auto rounded-t-3xl p-4 pb-6">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-ink/15" />
              {sheetTitle && <p className="mb-2 text-center font-body text-[11px] font-bold uppercase tracking-wider text-muted">{sheetTitle}</p>}
              {children}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body
    );
  }

  return createPortal(
    <AnimatePresence>
      {open && pos && (
        <motion.div ref={popRef}
          initial={{ opacity: 0, y: dir === 'down' ? 6 : -6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: dir === 'down' ? 6 : -6, scale: 0.98 }}
          transition={{ duration: 0.16 }}
          style={{ position: 'fixed', left: pos.left, top: pos.top, bottom: pos.bottom, width: pos.width, zIndex: 150 }}
          className="tk-pop p-3">
          {children}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
