/* Global tooltip layer — event-delegated [data-tip], viewport-clamped,
   rendered on <body> so table overflow can never clip it.
   Call initTooltips() once from the root layout. */
let el: HTMLDivElement | null = null;
let inited = false;

export function initTooltips() {
  if (inited || typeof document === 'undefined') return;
  inited = true;
  el = document.createElement('div');
  el.className = 'tk-tooltip';
  el.style.display = 'none';
  document.body.appendChild(el);

  let current: HTMLElement | null = null;
  const hide = () => { current = null; if (el) el.style.display = 'none'; };

  document.addEventListener('mouseover', (e) => {
    const t = (e.target as HTMLElement)?.closest?.('[data-tip]') as HTMLElement | null;
    if (!t || t === current || !el) return;
    current = t;
    const text = t.getAttribute('data-tip') || '';
    if (!text) return;
    el.textContent = text;
    el.style.display = 'block';
    const r = t.getBoundingClientRect();
    const w = Math.min(320, el.offsetWidth);
    const left = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - 8));
    el.style.left = left + 'px';
    if (r.top > 44) { el.style.top = ''; el.style.bottom = window.innerHeight - r.top + 8 + 'px'; }
    else { el.style.bottom = ''; el.style.top = r.bottom + 8 + 'px'; }
  });
  document.addEventListener('mouseout', (e) => {
    if (current && !current.contains(e.relatedTarget as Node)) hide();
  });
  document.addEventListener('scroll', hide, true);
  document.addEventListener('mousedown', hide);
}
