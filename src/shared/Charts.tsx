import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Download, Box, Square, Eye, X, Check } from 'lucide-react';
import { useFlip, Popover, NeuLoader } from './primitives';

/* ============================================================
   Shared Charts v4
   - Single or multi-series (categories + series ⇒ stacked/grouped)
   - Kinds: bar · line · area · pie · donut · radar · polar
     (+ funnel · pyramid opt-in), 3D for bar/area/pie/donut/funnel/pyramid
     (3D line intentionally disabled)
   - Animated 2D⇄3D morph transition (no fake loading)
   - Curved, attached leader arrows (canvas + SVG identical)
   - True-vector SVG export for EVERY kind via a Canvas→SVG recorder
     (axes, labels, colors preserved)
   - Exports: PNG(white bg) / PDF / Print / SVG / Excel / CSV / JSON
   - Smart label fitting (ellipsis at word boundaries)
   ============================================================ */

export interface ChartDatum { label: string; value: number; color?: string }
export interface StackedSeries { name: string; color?: string; values: number[] }
export type ChartKind = 'bar' | 'line' | 'area' | 'pie' | 'donut' | 'radar' | 'polar' | 'funnel' | 'pyramid';

export const PALETTE = ['#0d7a54', '#c9932b', '#0ea5e9', '#a855f7', '#e11d63', '#f97316', '#14b8a6', '#6366f1', '#84cc16', '#f43f5e'];

const TILT = 0.42;
const K = Math.sin(TILT);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const shade = (hex: string, f: number) => {
  const m = /^#([0-9a-f]{6})/i.exec(hex);
  const n = m ? parseInt(m[1], 16) : 0x888888;
  const c = (v: number) => Math.min(255, Math.max(0, Math.round(v * f)));
  return `rgb(${c((n >> 16) & 255)},${c((n >> 8) & 255)},${c(n & 255)})`;
};
const withAlpha = (hex: string, a: string) => (/^#[0-9a-f]{6}$/i.test(hex) ? hex + a : hex);

interface Theme { ink: string; axis: string; grid: string }
function themeColors(forExport = false): Theme {
  if (forExport) return { ink: '#1c2620', axis: '#39443d', grid: 'rgba(60,70,64,0.18)' };
  const ink = getComputedStyle(document.documentElement).getPropertyValue('--t-ink').trim() || '#101914';
  return { ink, axis: ink, grid: 'rgba(128,128,128,0.18)' };
}

/** Smart label fitting — ellipsis, prefers word boundaries. Deterministic (no ctx). */
export function fitText(s: string, maxW: number, fs = 10.5): string {
  const cw = fs * 0.58;
  const maxC = Math.max(2, Math.floor(maxW / cw));
  if (s.length <= maxC) return s;
  let cut = s.slice(0, maxC - 1);
  const sp = cut.lastIndexOf(' ');
  if (sp > maxC * 0.5) cut = cut.slice(0, sp);
  return cut.trimEnd() + '…';
}

/* ================= CDN loaders ================= */
const scriptCache = new Map<string, Promise<void>>();
function loadScript(src: string): Promise<void> {
  if (!scriptCache.has(src)) {
    scriptCache.set(src, new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => resolve();
      s.onerror = () => { scriptCache.delete(src); reject(new Error('Failed to load ' + src)); };
      document.head.appendChild(s);
    }));
  }
  return scriptCache.get(src)!;
}
/* eslint-disable @typescript-eslint/no-explicit-any */
export async function loadPdfMake(): Promise<any> {
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.12/pdfmake.min.js');
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.12/vfs_fonts.js');
  return (window as any).pdfMake;
}
export async function loadExcelJS(): Promise<any> {
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js');
  return (window as any).ExcelJS;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function downloadBlob(name: string, blob: Blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function jpegToPdf(jpegBytes: Uint8Array, wPx: number, hPx: number): Blob {
  const wPt = (wPx * 0.75) / 3, hPt = (hPx * 0.75) / 3;
  const enc = new TextEncoder();
  const chunks: (Uint8Array | string)[] = [];
  const offsets: number[] = [];
  let len = 0;
  const push = (s: Uint8Array | string) => { chunks.push(s); len += typeof s === 'string' ? enc.encode(s).length : s.length; };
  const obj = (body: string) => { offsets.push(len); push(body); };
  push('%PDF-1.4\n');
  obj('1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n');
  obj('2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n');
  obj(`3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 ${wPt.toFixed(1)} ${hPt.toFixed(1)}]/Resources<</XObject<</Im0 4 0 R>>>>/Contents 5 0 R>>endobj\n`);
  offsets.push(len);
  push(`4 0 obj<</Type/XObject/Subtype/Image/Width ${wPx}/Height ${hPx}/ColorSpace/DeviceRGB/BitsPerComponent 8/Filter/DCTDecode/Length ${jpegBytes.length}>>stream\n`);
  push(jpegBytes);
  push('\nendstream endobj\n');
  const content = `q ${wPt.toFixed(1)} 0 0 ${hPt.toFixed(1)} 0 0 cm /Im0 Do Q`;
  obj(`5 0 obj<</Length ${content.length}>>stream\n${content}\nendstream endobj\n`);
  const xrefAt = len;
  push(`xref\n0 6\n0000000000 65535 f \n${offsets.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('')}`);
  push(`trailer<</Size 6/Root 1 0 R>>\nstartxref\n${xrefAt}\n%%EOF`);
  return new Blob(chunks.map((c) => (typeof c === 'string' ? enc.encode(c) : c)) as BlobPart[], { type: 'application/pdf' });
}

export function printCanvas(title: string, cv: HTMLCanvasElement) {
  const url = cv.toDataURL('image/png');
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:200vw;bottom:200vh;width:980px;height:720px;border:0;';
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow!.document;
  doc.open();
  doc.write(`<html><head><title>${title}</title><style>@page{margin:12mm;}body{margin:0;display:grid;place-items:center;background:#fff;}img{max-width:100%;}</style></head><body><img src="${url}"/></body></html>`);
  doc.close();
  const cleanup = () => { try { iframe.remove(); } catch { /* noop */ } };
  iframe.contentWindow!.onafterprint = cleanup;
  const img = doc.querySelector('img')!;
  const go = () => setTimeout(() => {
    try { iframe.contentWindow!.focus(); iframe.contentWindow!.print(); } catch { cleanup(); }
    setTimeout(cleanup, 60000);
  }, 150);
  if ((img as HTMLImageElement).complete) go(); else img.addEventListener('load', go);
}

/** Rasterize an SVG string to a canvas (white background). */
export function svgToCanvas(svg: string, w: number, h: number, scale = 3): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    img.onload = () => {
      const cv = document.createElement('canvas');
      cv.width = w * scale; cv.height = h * scale;
      const ctx = cv.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      resolve(cv);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('SVG rasterize failed')); };
    img.src = url;
  });
}

/* ============================================================
   Canvas → SVG recorder. Implements the 2D-context subset used
   by the painters, emitting true vector SVG — so EVERY chart
   (2D and 3D) exports as vector with axes/labels/colors intact.
   ============================================================ */
class SvgCtx {
  els: string[] = [];
  defs: string[] = [];
  fillStyle: string | { __grad: string } = '#000';
  strokeStyle: string | { __grad: string } = '#000';
  lineWidth = 1;
  lineJoin = 'miter';
  lineCap = 'butt';
  font = '10px sans-serif';
  textAlign: 'left' | 'center' | 'right' | 'start' | 'end' = 'left';
  private d = '';
  private tx = 0; private ty = 0; private rot = 0;
  private stack: { tx: number; ty: number; rot: number }[] = [];
  private gradN = 0;
  private meas: CanvasRenderingContext2D;
  constructor(public W: number, public H: number) {
    this.meas = document.createElement('canvas').getContext('2d')!;
  }
  /* transforms */
  setTransform() { /* dpr no-op */ }
  clearRect() { /* no-op */ }
  save() { this.stack.push({ tx: this.tx, ty: this.ty, rot: this.rot }); }
  restore() { const s = this.stack.pop(); if (s) { this.tx = s.tx; this.ty = s.ty; this.rot = s.rot; } }
  translate(x: number, y: number) { this.tx += x; this.ty += y; }
  rotate(a: number) { this.rot += a; }
  clip() { /* progress clip is full-frame at export */ }
  rect(x: number, y: number, w: number, h: number) { this.d += `M ${this.px(x, y)} h ${r2(w)} v ${r2(h)} h ${r2(-w)} Z `; }
  /* path building */
  private px(x: number, y: number) { return `${r2(x + this.tx)} ${r2(y + this.ty)}`; }
  beginPath() { this.d = ''; }
  moveTo(x: number, y: number) { this.d += `M ${this.px(x, y)} `; }
  lineTo(x: number, y: number) { this.d += `L ${this.px(x, y)} `; }
  closePath() { this.d += 'Z '; }
  bezierCurveTo(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number) {
    this.d += `C ${this.px(c1x, c1y)} ${this.px(c2x, c2y)} ${this.px(x, y)} `;
  }
  quadraticCurveTo(cx: number, cy: number, x: number, y: number) {
    this.d += `Q ${this.px(cx, cy)} ${this.px(x, y)} `;
  }
  arc(x: number, y: number, r: number, a0: number, a1: number, ccw = false) {
    this.ellipse(x, y, r, r, 0, a0, a1, ccw);
  }
  ellipse(x: number, y: number, rx: number, ry: number, _rot: number, a0: number, a1: number, ccw = false) {
    rx = Math.max(0.01, rx); ry = Math.max(0.01, ry);
    let d = a1 - a0;
    if (ccw && d > 0) d -= Math.PI * 2;
    if (!ccw && d < 0) d += Math.PI * 2;
    const full = Math.abs(d) >= Math.PI * 2 - 1e-4;
    const seg = full ? (d > 0 ? Math.PI : -Math.PI) : d;
    const steps = full ? 2 : 1;
    const sx = x + Math.cos(a0) * rx, sy = y + Math.sin(a0) * ry;
    if (this.d === '' || this.d.endsWith('Z ')) this.d += `M ${this.px(sx, sy)} `;
    else this.d += `L ${this.px(sx, sy)} `;
    let cur = a0;
    for (let i = 0; i < steps; i++) {
      const next = full ? cur + seg : a1;
      const ex = x + Math.cos(next) * rx, ey = y + Math.sin(next) * ry;
      const large = Math.abs(next - cur) > Math.PI ? 1 : 0;
      const sweep = next > cur ? 1 : 0;
      this.d += `A ${r2(rx)} ${r2(ry)} 0 ${large} ${sweep} ${this.px(ex, ey)} `;
      cur = next;
    }
  }
  roundRect(x: number, y: number, w: number, h: number, r: number | number[]) {
    const rr = Array.isArray(r) ? r : [r, r, r, r];
    const [tl, tr, br, bl] = [rr[0] ?? 0, rr[1] ?? rr[0] ?? 0, rr[2] ?? rr[0] ?? 0, rr[3] ?? rr[1] ?? rr[0] ?? 0];
    this.d += `M ${this.px(x + tl, y)} H ${r2(x + w - tr + this.tx)} `;
    if (tr) this.d += `A ${r2(tr)} ${r2(tr)} 0 0 1 ${this.px(x + w, y + tr)} `;
    this.d += `V ${r2(y + h - br + this.ty)} `;
    if (br) this.d += `A ${r2(br)} ${r2(br)} 0 0 1 ${this.px(x + w - br, y + h)} `;
    this.d += `H ${r2(x + bl + this.tx)} `;
    if (bl) this.d += `A ${r2(bl)} ${r2(bl)} 0 0 1 ${this.px(x, y + h - bl)} `;
    this.d += `V ${r2(y + tl + this.ty)} `;
    if (tl) this.d += `A ${r2(tl)} ${r2(tl)} 0 0 1 ${this.px(x + tl, y)} `;
    this.d += 'Z ';
  }
  /* paint */
  private resolve(style: string | { __grad: string }): string {
    return typeof style === 'string' ? style : `url(#${style.__grad})`;
  }
  fill() { if (this.d) this.els.push(`<path d="${this.d.trim()}" fill="${this.resolve(this.fillStyle)}"/>`); }
  stroke() {
    if (this.d) this.els.push(`<path d="${this.d.trim()}" fill="none" stroke="${this.resolve(this.strokeStyle)}" stroke-width="${r2(this.lineWidth)}" stroke-linejoin="${this.lineJoin === 'round' ? 'round' : 'miter'}" stroke-linecap="${this.lineCap === 'round' ? 'round' : 'butt'}"/>`);
  }
  fillRect(x: number, y: number, w: number, h: number) {
    this.els.push(`<rect x="${r2(x + this.tx)}" y="${r2(y + this.ty)}" width="${r2(w)}" height="${r2(h)}" fill="${this.resolve(this.fillStyle)}"/>`);
  }
  fillText(text: string, x: number, y: number) {
    const fm = /(\d+(?:\.\d+)?)px\s+(.+)$/.exec(this.font);
    const size = fm ? +fm[1] : 10;
    const fam = fm ? fm[2] : 'sans-serif';
    const wm = /^(\d{3}|bold)\s/.exec(this.font);
    const weight = wm ? (wm[1] === 'bold' ? '700' : wm[1]) : '400';
    const anchor = this.textAlign === 'center' ? 'middle' : this.textAlign === 'right' || this.textAlign === 'end' ? 'end' : 'start';
    const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const gx = r2(x + this.tx), gy = r2(y + this.ty);
    const tf = this.rot !== 0 ? ` transform="rotate(${r2((this.rot * 180) / Math.PI)} ${gx} ${gy})"` : '';
    this.els.push(`<text x="${gx}" y="${gy}" font-family="${fam.replace(/"/g, "'")}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" fill="${this.resolve(this.fillStyle)}"${tf}>${esc}</text>`);
  }
  measureText(t: string) { this.meas.font = this.font; return this.meas.measureText(t); }
  createLinearGradient(x0: number, y0: number, x1: number, y1: number) {
    const id = `g${++this.gradN}`;
    const stops: string[] = [];
    this.defs.push(''); // placeholder index
    const idx = this.defs.length - 1;
    const self = this;
    return {
      __grad: id,
      addColorStop(off: number, col: string) {
        stops.push(`<stop offset="${r2(off * 100)}%" stop-color="${col.length === 9 && col.startsWith('#') ? col.slice(0, 7) : col}" stop-opacity="${col.length === 9 && col.startsWith('#') ? (parseInt(col.slice(7), 16) / 255).toFixed(2) : 1}"/>`);
        self.defs[idx] = `<linearGradient id="${id}" x1="${r2(x0)}" y1="${r2(y0)}" x2="${r2(x1)}" y2="${r2(y1)}" gradientUnits="userSpaceOnUse">${stops.join('')}</linearGradient>`;
      },
    };
  }
  toString(): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${this.W}" height="${this.H}" viewBox="0 0 ${this.W} ${this.H}"><defs>${this.defs.join('')}</defs><rect width="${this.W}" height="${this.H}" fill="#ffffff"/>${this.els.join('')}</svg>`;
  }
}
const r2 = (n: number) => Math.round(n * 100) / 100;
type Ctx = CanvasRenderingContext2D;

/* ================= Mini dropdown (shows current selection) ================= */
export function MiniDrop({ label, items, onPick, icon, activeKey }: {
  label: string; items: { key: string; label: string; disabled?: boolean }[];
  onPick: (k: string) => void; icon?: React.ReactNode; activeKey?: string;
}) {
  const [open, setOpen] = useState(false);
  const { anchorRef, dir, measure } = useFlip(items.length * 38 + 20);
  return (
    <div ref={anchorRef} className="relative">
      <button onClick={() => { measure(); setOpen(!open); }}
        className="tk-btn-ghost flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-body text-[12px] font-bold">
        {icon} {label} <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={anchorRef} dir={dir} width={180} sheetTitle={label}>
        {items.map((it) => (
          <button key={it.key} disabled={it.disabled}
            onClick={() => { setOpen(false); onPick(it.key); }}
            className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left font-body text-[12.5px] font-semibold transition hover:bg-primary/8 disabled:opacity-35 ${activeKey === it.key ? 'text-primary' : 'text-ink/80'}`}>
            {it.label}
            {activeKey === it.key && <Check size={13} className="shrink-0" />}
          </button>
        ))}
      </Popover>
    </div>
  );
}

function useThemeTick() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const handler = () => { setTick((t) => t + 1); timer = setTimeout(() => setTick((t) => t + 1), 720); };
    window.addEventListener('aviary:prefs', handler);
    return () => { window.removeEventListener('aviary:prefs', handler); clearTimeout(timer); };
  }, []);
  return tick;
}

/* ================= geometry helpers ================= */
const approxW = (s: string, fs = 10.5) => s.length * fs * 0.58;

function circGeom(W: number, H: number, m: number, data: ChartDatum[]) {
  const total = data.reduce((s, x) => s + x.value, 0) || 1;
  const longest = Math.max(0, ...data.map((x) => approxW(`${x.label} · ${Math.round((x.value / total) * 100)}%`)));
  const labelSpace = Math.min(Math.max(60, longest) + 34, W * 0.32);
  const squash = lerp(1, K, m);
  let R = Math.min(W / 2 - labelSpace, (H - 44) / (2 * squash) - (m > 0 ? 20 : 0));
  R = Math.max(40, R);
  const depth = Math.max(22, Math.min(46, R * 0.38)) * m;
  const cy = (H - depth) / 2 + 4;
  return { cx: W / 2, cy, R, rInRatio: 0.55, depth, squash, total };
}

/* ================= leader labels — curved, attached arrows ================= */
function drawLeaders(ctx: Ctx, cx: number, cy: number, R: number, squash: number, data: ChartDatum[], colors: string[], total: number, t: Theme, W: number, H: number, equalAngles = false) {
  ctx.font = '600 10.5px Outfit, sans-serif';
  const n = data.length;
  let a = -Math.PI / 2;
  interface E { i: number; mid: number; right: boolean; y: number }
  const entries: E[] = data.map((d, i) => {
    let mid: number;
    if (equalAngles) mid = -Math.PI / 2 + ((i + 0.5) * Math.PI * 2) / n;
    else { const a2 = a + (d.value / total) * Math.PI * 2; mid = (a + a2) / 2; a = a2; }
    return { i, mid, right: Math.cos(mid) >= 0, y: cy + Math.sin(mid) * (R + 18) * squash };
  });
  const place = (list: E[]) => {
    list.sort((p, q) => p.y - q.y);
    let prev = -Infinity;
    list.forEach((e) => { e.y = Math.max(e.y, prev + 13); prev = e.y; });
    list.forEach((e) => { e.y = Math.max(10, Math.min(H - 6, e.y)); });
  };
  place(entries.filter((e) => e.right));
  place(entries.filter((e) => !e.right));

  entries.forEach((e) => {
    const d = data[e.i];
    // anchor on the rim
    const ax = cx + Math.cos(e.mid) * R;
    const ay = cy + Math.sin(e.mid) * R * squash;
    // radial point just outside the rim — sets the curve's entry tangent
    const qx = cx + Math.cos(e.mid) * (R + 16);
    const qy = cy + Math.sin(e.mid) * (R + 16) * squash;
    const ex = cx + (e.right ? R + 24 : -(R + 24));
    const tx = cx + (e.right ? R + 31 : -(R + 31));
    // one continuous S-curve: leaves the text ledge horizontally, twists,
    // and enters the slice radially (cubic with tangent-matched controls)
    const c1x = (ex + qx) / 2, c1y = e.y;   // horizontal exit tangent
    const c2x = qx, c2y = qy;               // radial entry tangent
    ctx.strokeStyle = colors[e.i];
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(tx, e.y);
    ctx.lineTo(ex, e.y);
    ctx.bezierCurveTo(c1x, c1y, c2x, c2y, ax, ay);
    ctx.stroke();
    // arrowhead fused to the path end — its base sits ON the curve and its
    // tip points INTO the slice along the curve's end tangent (anchor − c2)
    const dx = ax - c2x, dy = ay - c2y;
    const dl = Math.hypot(dx, dy) || 1;
    const ux = dx / dl, uy = dy / dl;
    const px2 = -uy, py2 = ux;
    ctx.fillStyle = colors[e.i];
    ctx.beginPath();
    ctx.moveTo(ax + ux * 6, ay + uy * 6);       // tip, 6px inside the slice
    ctx.lineTo(ax - ux * 3 + px2 * 3.6, ay - uy * 3 + py2 * 3.6);
    ctx.lineTo(ax - ux * 3 - px2 * 3.6, ay - uy * 3 - py2 * 3.6);
    ctx.closePath();
    ctx.fill();
    // label
    const avail = e.right ? W - tx - 6 : tx - 6;
    ctx.fillStyle = t.ink;
    ctx.textAlign = e.right ? 'left' : 'right';
    ctx.fillText(fitText(`${d.label} · ${Math.round((d.value / total) * 100)}%`, avail), tx + (e.right ? 3 : -3), e.y + 3.5);
  });
  ctx.textAlign = 'left';
}

/* ================= axes ================= */
function drawAxes(ctx: Ctx, W: number, H: number, pad: { l: number; r: number; t: number; b: number }, max: number, t: Theme, ox = 0, oy = 0) {
  const ch = H - pad.t - pad.b;
  ctx.font = '600 10.5px Outfit, sans-serif';
  for (let g = 0; g <= 4; g++) {
    const y = pad.t + ch - (ch * g) / 4;
    ctx.strokeStyle = t.grid;
    ctx.beginPath();
    if (ox) { ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + ox, y - oy); ctx.lineTo(W - pad.r + ox, y - oy); }
    else { ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); }
    ctx.stroke();
    ctx.fillStyle = t.axis; ctx.textAlign = 'right';
    ctx.fillText(String(Math.round((max * g) / 4)), pad.l - 7, y + 3.5);
  }
  ctx.strokeStyle = t.axis; ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.moveTo(pad.l, pad.t - 4); ctx.lineTo(pad.l, pad.t + ch); ctx.lineTo(W - pad.r, pad.t + ch); ctx.stroke();
  ctx.lineWidth = 1;
}

/* ================= hover model ================= */
interface Hover { idx: number | null; seg: { c: number; s: number } | null; amt: number }
const NO_HOVER: Hover = { idx: null, seg: null, amt: 0 };

export interface DrawCtx {
  W: number; H: number; t: Theme; p: number; m: number; hov: Hover;
  data: ChartDatum[]; colors: string[];
  multi: boolean; cats: string[]; series: StackedSeries[]; sColors: string[];
  yLabel?: string;
}

/* ================= unified painter (m = 3D morph 0..1) ================= */
export function paintChart(ctx: Ctx, kind: ChartKind, d: DrawCtx) {
  const { W, H, t, p, m, hov, data, colors, multi, cats, series, sColors } = d;
  ctx.clearRect(0, 0, W, H);
  if (!data.length && !(multi && cats.length)) return;
  const total = data.reduce((s, x) => s + x.value, 0) || 1;

  /* ============ BAR ============ */
  if (kind === 'bar') {
    const ox = 13 * m, oy = 9 * m;
    const pad = { l: 46, r: 16 + 20 * m, t: 18 + 12 * m, b: 34 };
    const cw = W - pad.l - pad.r, ch = H - pad.t - pad.b;
    const labels = multi ? cats : data.map((x) => x.label);
    const step = cw / Math.max(1, labels.length);
    const max = multi
      ? Math.max(...cats.map((_, c) => series.reduce((s, sr) => s + (sr.values[c] || 0), 0)), 1)
      : Math.max(...data.map((x) => x.value), 1);
    drawAxes(ctx, W, H, pad, max, t, ox, oy);
    if (d.yLabel) {
      ctx.save(); ctx.translate(11, pad.t + ch / 2); ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center'; ctx.fillStyle = t.axis; ctx.fillText(d.yLabel, 0, 0); ctx.restore();
    }
    ctx.textAlign = 'center';
    labels.forEach((l, i) => { ctx.fillStyle = t.axis; ctx.fillText(fitText(l, step - 4), pad.l + step * i + step / 2 + ox / 2, H - 12); });

    labels.forEach((_, ci) => {
      const bw = Math.min(44, step * 0.52);
      const x = pad.l + step * ci + (step - bw) / 2;
      const segs = multi
        ? series.map((sr, si) => ({ v: sr.values[ci] || 0, col: sColors[si], on: !!(hov.seg && (hov.seg.c === ci || hov.seg.c === -1) && hov.seg.s === si) }))
        : [{ v: data[ci].value, col: colors[ci], on: hov.idx === ci }];
      let acc = 0;
      segs.forEach((sg, si) => {
        if (sg.v <= 0) return;
        const h = (sg.v / max) * ch * p;
        const yTop = pad.t + ch - ((acc / max) * ch * p) - h;
        const col = sg.on ? shade(sg.col, 1 + 0.16 * hov.amt) : sg.col;
        if (m > 0.02) {
          ctx.fillStyle = shade(sg.col, 0.7 * (sg.on ? 1 + 0.1 * hov.amt : 1));
          ctx.beginPath(); ctx.moveTo(x + bw, yTop); ctx.lineTo(x + bw + ox, yTop - oy);
          ctx.lineTo(x + bw + ox, yTop - oy + h); ctx.lineTo(x + bw, yTop + h); ctx.closePath(); ctx.fill();
          const isTop = si === segs.length - 1 || segs.slice(si + 1).every((z) => z.v <= 0);
          if (isTop) {
            ctx.fillStyle = shade(sg.col, 1.22);
            ctx.beginPath(); ctx.moveTo(x, yTop); ctx.lineTo(x + ox, yTop - oy);
            ctx.lineTo(x + bw + ox, yTop - oy); ctx.lineTo(x + bw, yTop); ctx.closePath(); ctx.fill();
          }
          ctx.fillStyle = col;
          ctx.fillRect(x, yTop, bw, h);
        } else {
          ctx.fillStyle = col;
          ctx.beginPath(); ctx.roundRect(x, yTop, bw, Math.max(1, h - (multi ? 1 : 0)), multi ? 2 : [6, 6, 0, 0]); ctx.fill();
        }
        acc += sg.v;
      });
    });
    ctx.textAlign = 'left';
    return;
  }

  /* ============ LINE (2D only) & AREA (2D + Highcharts-style 3D slabs) ============ */
  if (kind === 'line' || kind === 'area') {
    const list: { name: string; color: string; values: number[] }[] = multi
      ? series.map((s, i) => ({ name: s.name, color: sColors[i], values: s.values }))
      : [{ name: '', color: colors[0], values: data.map((x) => x.value) }];
    const nD = list.length;
    const zx = 20 * m, zy = 13 * m;      // per-series z offset
    const dz = 14 * m, dzy = 9 * m;      // slab thickness
    const OX = zx * (nD - 1) + dz, OY = zy * (nD - 1) + dzy;
    const pad = { l: 46, r: 16 + OX, t: 18 + OY, b: 34 };
    const cw = W - pad.l - pad.r, ch = H - pad.t - pad.b;
    const labels = multi ? cats : data.map((x) => x.label);
    const step = cw / Math.max(1, labels.length);
    const max = multi ? Math.max(...series.flatMap((s) => s.values), 1) : Math.max(...data.map((x) => x.value), 1);
    drawAxes(ctx, W, H, pad, max, t, OX, OY);
    ctx.textAlign = 'center';
    labels.forEach((l, i) => { ctx.fillStyle = t.axis; ctx.fillText(fitText(l, step - 4), pad.l + step * i + step / 2, H - 12); });

    const isArea = kind === 'area';
    // deepest series first
    for (let si = nD - 1; si >= 0; si--) {
      const sr = list[si];
      const offX = zx * si, offY = zy * si;
      const baseY = pad.t + ch - offY;
      const pts = sr.values.map((v, i) => ({
        x: pad.l + step * i + step / 2 + offX,
        y: pad.t + ch - (v / max) * ch * p - offY,
      }));
      if (!pts.length) continue;

      if (isArea && m > 0.02) {
        // Highcharts-style 3D slab: back face, top ribbon, end wall, front face
        const back = pts.map((pt) => ({ x: pt.x + dz, y: pt.y - dzy }));
        // back face
        ctx.fillStyle = shade(sr.color, 0.72);
        ctx.beginPath();
        ctx.moveTo(back[0].x, baseY - dzy);
        back.forEach((pt) => ctx.lineTo(pt.x, pt.y));
        ctx.lineTo(back[back.length - 1].x, baseY - dzy);
        ctx.closePath(); ctx.fill();
        // top ribbon
        for (let i = 0; i < pts.length - 1; i++) {
          ctx.fillStyle = shade(sr.color, 0.95);
          ctx.beginPath();
          ctx.moveTo(pts[i].x, pts[i].y);
          ctx.lineTo(pts[i + 1].x, pts[i + 1].y);
          ctx.lineTo(back[i + 1].x, back[i + 1].y);
          ctx.lineTo(back[i].x, back[i].y);
          ctx.closePath(); ctx.fill();
        }
        // right end wall
        ctx.fillStyle = shade(sr.color, 0.6);
        ctx.beginPath();
        ctx.moveTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
        ctx.lineTo(back[back.length - 1].x, back[back.length - 1].y);
        ctx.lineTo(back[back.length - 1].x, baseY - dzy);
        ctx.lineTo(pts[pts.length - 1].x, baseY);
        ctx.closePath(); ctx.fill();
        // front face — near-solid like Highcharts
        ctx.fillStyle = withAlpha(sr.color, 'e6');
        ctx.beginPath();
        ctx.moveTo(pts[0].x, baseY);
        pts.forEach((pt) => ctx.lineTo(pt.x, pt.y));
        ctx.lineTo(pts[pts.length - 1].x, baseY);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = shade(sr.color, 1.15); ctx.lineWidth = 1.5;
        ctx.beginPath();
        pts.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
        ctx.stroke();
      } else {
        // 2D: line straight, area free-hand
        const curve = () => {
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 0; i < pts.length - 1; i++) {
            const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
            ctx.bezierCurveTo(
              p1.x + (p2.x - p0.x) / 6, p1.y + (p2.y - p0.y) / 6,
              p2.x - (p3.x - p1.x) / 6, p2.y - (p3.y - p1.y) / 6, p2.x, p2.y);
          }
        };
        if (isArea) {
          ctx.beginPath(); curve();
          ctx.lineTo(pts[pts.length - 1].x, baseY); ctx.lineTo(pts[0].x, baseY); ctx.closePath();
          const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + ch);
          grad.addColorStop(0, withAlpha(sr.color, multi ? '3d' : '59'));
          grad.addColorStop(1, withAlpha(sr.color, '08'));
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ctx.fillStyle = grad as any; ctx.fill();
          ctx.strokeStyle = sr.color; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
          ctx.beginPath(); curve(); ctx.stroke();
        } else {
          ctx.strokeStyle = sr.color; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
          ctx.beginPath();
          pts.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
          ctx.stroke();
        }
        pts.forEach((pt, i) => {
          const on = multi ? (hov.seg && (hov.seg.c === i || hov.seg.c === -1) && hov.seg.s === si) : hov.idx === i;
          ctx.fillStyle = on ? shade(sr.color, 1 + 0.2 * hov.amt) : sr.color;
          ctx.beginPath(); ctx.arc(pt.x, pt.y, 4 + (on ? 2.5 * hov.amt : 0), 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
        });
      }
    }
    ctx.textAlign = 'left';
    return;
  }

  /* ============ RADAR (2D) ============ */
  if (kind === 'radar') {
    const cx = W / 2, cy = H / 2 + 6, R = Math.min(W, H) / 2 - 44;
    const labels = multi ? cats : data.map((x) => x.label);
    const n = Math.max(1, labels.length);
    const max = multi ? Math.max(...series.flatMap((s) => s.values), 1) : Math.max(...data.map((x) => x.value), 1);
    const ang = (i: number) => -Math.PI / 2 + (i * Math.PI * 2) / n;
    for (let ring = 1; ring <= 3; ring++) {
      ctx.strokeStyle = t.grid;
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const aa = ang(i % n);
        i === 0 ? ctx.moveTo(cx + Math.cos(aa) * R * (ring / 3), cy + Math.sin(aa) * R * (ring / 3))
          : ctx.lineTo(cx + Math.cos(aa) * R * (ring / 3), cy + Math.sin(aa) * R * (ring / 3));
      }
      ctx.stroke();
    }
    ctx.font = '600 10.5px Outfit, sans-serif';
    labels.forEach((l, i) => {
      const aa = ang(i);
      ctx.strokeStyle = t.grid;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(aa) * R, cy + Math.sin(aa) * R); ctx.stroke();
      ctx.fillStyle = t.axis;
      ctx.textAlign = Math.abs(Math.cos(aa)) < 0.3 ? 'center' : Math.cos(aa) > 0 ? 'left' : 'right';
      const avail = Math.cos(aa) > 0 ? W - (cx + Math.cos(aa) * (R + 12)) - 4 : (cx + Math.cos(aa) * (R + 12)) - 4;
      ctx.fillText(fitText(l, Math.max(30, avail)), cx + Math.cos(aa) * (R + 12), cy + Math.sin(aa) * (R + 12) + 3);
    });
    const polys = multi
      ? series.map((s, i) => ({ color: sColors[i], values: s.values }))
      : [{ color: colors[0], values: data.map((x) => x.value) }];
    polys.forEach((poly) => {
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const aa = ang(i % n), v = ((poly.values[i % n] || 0) / max) * R * p;
        i === 0 ? ctx.moveTo(cx + Math.cos(aa) * v, cy + Math.sin(aa) * v) : ctx.lineTo(cx + Math.cos(aa) * v, cy + Math.sin(aa) * v);
      }
      ctx.closePath();
      ctx.fillStyle = withAlpha(poly.color, multi ? '2e' : '40'); ctx.fill();
      ctx.strokeStyle = poly.color; ctx.lineWidth = 2; ctx.stroke();
    });
    if (!multi) {
      data.forEach((x, i) => {
        const aa = ang(i), v = (x.value / max) * R * p;
        const on = hov.idx === i;
        ctx.fillStyle = on ? shade(colors[0], 1 + 0.25 * hov.amt) : colors[0];
        ctx.beginPath(); ctx.arc(cx + Math.cos(aa) * v, cy + Math.sin(aa) * v, 4 + (on ? 2 * hov.amt : 0), 0, Math.PI * 2); ctx.fill();
      });
    }
    ctx.textAlign = 'left';
    return;
  }

  /* ============ POLAR (2D) ============ */
  if (kind === 'polar') {
    const g = circGeom(W, H, 0, data);
    const cx = g.cx, cy = g.cy, R = g.R;
    const max = Math.max(...data.map((x) => x.value), 1);
    for (let ring = 1; ring <= 3; ring++) {
      ctx.strokeStyle = t.grid;
      ctx.beginPath(); ctx.arc(cx, cy, R * (ring / 3), 0, Math.PI * 2); ctx.stroke();
    }
    const n = Math.max(1, data.length);
    data.forEach((x, i) => {
      const a0 = -Math.PI / 2 + (i * Math.PI * 2) / n;
      const on = hov.idx === i;
      const r = Math.max(2, (x.value / max) * R * p + (on ? 6 * hov.amt : 0));
      ctx.fillStyle = withAlpha(on ? colors[i] : colors[i], 'cc');
      if (on) ctx.fillStyle = withAlpha(colors[i], 'ee');
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, a0, a0 + (Math.PI * 2) / n); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1; ctx.stroke();
    });
    if (p > 0.95) drawLeaders(ctx, cx, cy, R, 1, data, colors, total, t, W, H, true);
    return;
  }

  /* ============ FUNNEL / PYRAMID (2D + 3D) ============ */
  if (kind === 'funnel' || kind === 'pyramid') {
    const labelSpace = Math.min(160, W * 0.3);
    const padT = 16 + 10 * m, padB = 16 + 6 * m;
    // clamp content height so fullscreen keeps sane proportions
    const ch = Math.min(H - padT - padB, W * 0.62);
    const topY = padT + (H - padT - padB - ch) / 2;
    const cx = (W - labelSpace) / 2 + 10;
    const plotW = Math.min(W - labelSpace - 60, ch * 1.15);
    const sq = 0.16 * m; // ellipse squash for 3D funnel
    const heights = data.map((x) => (x.value / total) * ch * p);
    const sumH = heights.reduce((a, b) => a + b, 0);
    const widthAt = (y: number) => kind === 'funnel'
      ? plotW * (0.96 - 0.66 * (y / ch))
      : plotW * (0 + 0.96 * (y / ch)); // pyramid: true point at the top
    ctx.font = '600 10.5px Outfit, sans-serif';
    let y = topY + (ch - sumH);
    data.forEach((x, i) => {
      const h = heights[i];
      const relTop = y - topY - (ch - sumH) + (ch - sumH); // actual rel within ch
      const w0 = widthAt(y - topY), w1 = widthAt(y - topY + h);
      const on = hov.idx === i;
      const col = on ? shade(colors[i], 1 + 0.12 * hov.amt) : colors[i];
      void relTop;
      if (kind === 'funnel' && m > 0.02) {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(cx - w0 / 2, y);
        ctx.lineTo(cx - w1 / 2, y + h);
        ctx.ellipse(cx, y + h, Math.max(0.1, w1 / 2), Math.max(0.1, (w1 / 2) * sq), 0, Math.PI, 0, true);
        ctx.lineTo(cx + w0 / 2, y);
        ctx.ellipse(cx, y, Math.max(0.1, w0 / 2), Math.max(0.1, (w0 / 2) * sq), 0, 0, Math.PI, false);
        ctx.closePath(); ctx.fill();
        if (i === 0) {
          ctx.fillStyle = shade(colors[i], 1.22);
          ctx.beginPath(); ctx.ellipse(cx, y, w0 / 2, Math.max(0.1, (w0 / 2) * sq), 0, 0, Math.PI * 2); ctx.fill();
        }
      } else if (kind === 'pyramid' && m > 0.02) {
        const dxr = (w: number) => w * 0.2, dyr = (w: number) => w * 0.075;
        ctx.fillStyle = shade(colors[i], 0.72);
        ctx.beginPath();
        ctx.moveTo(cx + w0 / 2, y);
        ctx.lineTo(cx + w0 / 2 + dxr(w0), y - dyr(w0));
        ctx.lineTo(cx + w1 / 2 + dxr(w1), y + h - dyr(w1));
        ctx.lineTo(cx + w1 / 2, y + h);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(cx - w0 / 2, y);
        ctx.lineTo(cx + w0 / 2, y);
        ctx.lineTo(cx + w1 / 2, y + h);
        ctx.lineTo(cx - w1 / 2, y + h);
        ctx.closePath(); ctx.fill();
      } else {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(cx - w0 / 2, y);
        ctx.lineTo(cx + w0 / 2, y);
        ctx.lineTo(cx + w1 / 2, y + h);
        ctx.lineTo(cx - w1 / 2, y + h);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1; ctx.stroke();
      }
      // leader — attached at the segment's TRUE mid-width edge
      const midY = y + h / 2;
      const wMid = widthAt(y - topY + h / 2);
      const extra3d = kind === 'pyramid' && m > 0.02 ? wMid * 0.2 : 0;
      const edgeX = cx + wMid / 2 + extra3d + 2;
      const textX = cx + plotW / 2 + 26;
      ctx.strokeStyle = colors[i];
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(edgeX, midY);
      ctx.lineTo(textX - 6, midY);
      ctx.stroke();
      // attached arrowhead pointing into the segment
      ctx.fillStyle = colors[i];
      ctx.beginPath();
      ctx.moveTo(edgeX - 5, midY);
      ctx.lineTo(edgeX + 2, midY - 3.4);
      ctx.lineTo(edgeX + 2, midY + 3.4);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = t.ink;
      ctx.textAlign = 'left';
      ctx.fillText(fitText(`${x.label} · ${x.value} (${Math.round((x.value / total) * 100)}%)`, W - textX - 4), textX, midY + 3.5);
      y += h;
    });
    ctx.textAlign = 'left';
    return;
  }

  /* ============ PIE / DONUT (2D ⇄ 3D morph) ============ */
  const g = circGeom(W, H, m, data);
  const { cx, cy, R: R0, depth, squash } = g;
  const rIn = kind === 'donut' ? R0 * g.rInRatio : 0;

  interface Seg { a0: number; a1: number; i: number }
  let a = -Math.PI / 2;
  const segs: Seg[] = data.map((x, i) => {
    const a1 = a + (x.value / total) * Math.PI * 2 * p;
    const s = { a0: a, a1, i };
    a = a1;
    return s;
  });
  const expandOf = (s: Seg) => (hov.idx === s.i ? 10 * hov.amt : 0);
  const px = (ang: number, r: number) => cx + Math.cos(ang) * r;
  const py = (ang: number, r: number) => cy + Math.sin(ang) * r * squash;
  const OVER = 0.012; // angular overlap kills seam lines

  if (m > 0.02) {
    const faces: { y: number; draw: () => void }[] = [];
    segs.forEach((s) => {
      const Rx = R0 + expandOf(s);
      const col = hov.idx === s.i ? shade(colors[s.i], 1 + 0.08 * hov.amt) : colors[s.i];
      const steps = Math.max(3, Math.ceil(((s.a1 - s.a0) / Math.PI) * 36));
      for (let k = 0; k < steps; k++) {
        const b0 = s.a0 + ((s.a1 - s.a0) * k) / steps - OVER;
        const b1 = s.a0 + ((s.a1 - s.a0) * (k + 1)) / steps + OVER;
        const midS = (b0 + b1) / 2;
        if (Math.sin(midS) <= 0) continue;
        faces.push({
          y: py(midS, Rx),
          draw: () => {
            ctx.fillStyle = shade(col, 0.62 + 0.2 * Math.cos(midS));
            ctx.beginPath();
            ctx.moveTo(px(b0, Rx), py(b0, Rx));
            ctx.lineTo(px(b1, Rx), py(b1, Rx));
            ctx.lineTo(px(b1, Rx), py(b1, Rx) + depth);
            ctx.lineTo(px(b0, Rx), py(b0, Rx) + depth);
            ctx.closePath(); ctx.fill();
          },
        });
      }
      if (rIn > 0) {
        for (let k = 0; k < 24; k++) {
          const b0 = s.a0 + ((s.a1 - s.a0) * k) / 24 - OVER;
          const b1 = s.a0 + ((s.a1 - s.a0) * (k + 1)) / 24 + OVER;
          const midS = (b0 + b1) / 2;
          const back = Math.sin(midS) < 0;
          faces.push({
            y: back ? py(midS, rIn) - 900 : py(midS, rIn) - 0.5,
            draw: () => {
              ctx.fillStyle = shade(colors[s.i], back ? 0.52 : 0.44);
              ctx.beginPath();
              ctx.moveTo(px(b0, rIn), py(b0, rIn));
              ctx.lineTo(px(b1, rIn), py(b1, rIn));
              ctx.lineTo(px(b1, rIn), py(b1, rIn) + depth);
              ctx.lineTo(px(b0, rIn), py(b0, rIn) + depth);
              ctx.closePath(); ctx.fill();
            },
          });
        }
      }
      ([s.a0, s.a1] as const).forEach((edge) => {
        faces.push({
          y: py(edge, (Rx + rIn) / 2) - 0.25,
          draw: () => {
            ctx.fillStyle = shade(colors[s.i], 0.72);
            ctx.beginPath();
            if (rIn > 0) {
              ctx.moveTo(px(edge, rIn), py(edge, rIn));
              ctx.lineTo(px(edge, Rx), py(edge, Rx));
              ctx.lineTo(px(edge, Rx), py(edge, Rx) + depth);
              ctx.lineTo(px(edge, rIn), py(edge, rIn) + depth);
            } else {
              ctx.moveTo(cx, cy);
              ctx.lineTo(px(edge, Rx), py(edge, Rx));
              ctx.lineTo(px(edge, Rx), py(edge, Rx) + depth);
              ctx.lineTo(cx, cy + depth);
            }
            ctx.closePath(); ctx.fill();
          },
        });
      });
    });
    faces.sort((f1, f2) => f1.y - f2.y).forEach((f) => f.draw());
  }

  // top faces — no strokes in 3D (smooth surface); hairline separation in 2D
  segs.forEach((s) => {
    const Rx = R0 + expandOf(s);
    ctx.fillStyle = hov.idx === s.i ? shade(colors[s.i], 1 + 0.1 * hov.amt) : colors[s.i];
    ctx.beginPath();
    const steps = Math.max(4, Math.ceil(((s.a1 - s.a0) / Math.PI) * 44));
    const o = m > 0.02 ? OVER : 0;
    for (let k = 0; k <= steps; k++) {
      const b = s.a0 - o + ((s.a1 - s.a0 + o * 2) * k) / steps;
      k === 0 ? ctx.moveTo(px(b, Rx), py(b, Rx)) : ctx.lineTo(px(b, Rx), py(b, Rx));
    }
    if (rIn > 0) for (let k = steps; k >= 0; k--) {
      const b = s.a0 - o + ((s.a1 - s.a0 + o * 2) * k) / steps;
      ctx.lineTo(px(b, rIn), py(b, rIn));
    } else ctx.lineTo(cx, cy);
    ctx.closePath(); ctx.fill();
    if (m <= 0.02) {
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1; ctx.stroke();
    }
  });

  if (p > 0.95) drawLeaders(ctx, cx, cy, R0, squash, data, colors, total, t, W, H);
  if (kind === 'donut' && m <= 0.5) {
    ctx.fillStyle = t.ink;
    ctx.font = '700 16px Fraunces, serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(total), cx, cy + 5);
    ctx.textAlign = 'left';
  }
}

/* ================= export composition ================= */
export function composeExport(title: string, chartW: number, chartH: number, legend: { label: string; color: string }[], paintFn: (ctx: Ctx) => void): HTMLCanvasElement {
  const scale = 3;
  const legendRows = Math.ceil(legend.length / 4);
  const headH = title ? 34 : 10;
  const legH = legend.length ? legendRows * 18 + 12 : 8;
  const W = chartW, H = headH + chartH + legH;
  const cv = document.createElement('canvas');
  cv.width = W * scale; cv.height = H * scale;
  const ctx = cv.getContext('2d')!;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  if (title) {
    ctx.fillStyle = '#1c2620';
    ctx.font = '700 15px Fraunces, Georgia, serif';
    ctx.fillText(title, 12, 22);
  }
  ctx.save(); ctx.translate(0, headH);
  paintFn(ctx);
  ctx.restore();
  ctx.font = '600 10.5px Outfit, sans-serif';
  legend.forEach((l, i) => {
    const col = i % 4, row = Math.floor(i / 4);
    const x = 14 + col * (W / 4), y = headH + chartH + 14 + row * 18;
    ctx.fillStyle = l.color;
    ctx.beginPath(); ctx.arc(x, y - 3, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#39443d';
    ctx.fillText(fitText(l.label, W / 4 - 24), x + 9, y);
  });
  return cv;
}

function composeSvg(title: string, chartW: number, chartH: number, legend: { label: string; color: string }[], paintFn: (ctx: Ctx) => void): string {
  const legendRows = Math.ceil(legend.length / 4);
  const headH = title ? 34 : 10;
  const legH = legend.length ? legendRows * 18 + 12 : 8;
  const rec = new SvgCtx(chartW, headH + chartH + legH);
  const ctx = rec as unknown as Ctx;
  if (title) {
    ctx.fillStyle = '#1c2620';
    ctx.font = '700 15px Fraunces, Georgia, serif';
    ctx.fillText(title, 12, 22);
  }
  ctx.save(); ctx.translate(0, headH);
  paintFn(ctx);
  ctx.restore();
  ctx.font = '600 10.5px Outfit, sans-serif';
  legend.forEach((l, i) => {
    const col = i % 4, row = Math.floor(i / 4);
    const x = 14 + col * (chartW / 4), y = headH + chartH + 14 + row * 18;
    ctx.fillStyle = l.color;
    ctx.beginPath(); ctx.arc(x, y - 3, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#39443d';
    ctx.fillText(fitText(l.label, chartW / 4 - 24), x + 9, y);
  });
  return rec.toString();
}

/* ================= main Chart ================= */
const BASE_KINDS: { key: ChartKind; label: string; has3d: boolean }[] = [
  { key: 'bar', label: 'Bar', has3d: true },
  { key: 'line', label: 'Line', has3d: false }, // 3D line intentionally disabled
  { key: 'area', label: 'Area', has3d: true },
  { key: 'pie', label: 'Pie', has3d: true },
  { key: 'donut', label: 'Donut', has3d: true },
  { key: 'radar', label: 'Radar', has3d: false },
  { key: 'polar', label: 'Polar', has3d: false },
];
const EXTRA_KINDS: { key: ChartKind; label: string; has3d: boolean }[] = [
  { key: 'funnel', label: 'Funnel', has3d: true },
  { key: 'pyramid', label: 'Pyramid', has3d: true },
];

export interface ChartProps {
  data?: ChartDatum[];
  categories?: string[];
  series?: StackedSeries[];
  title?: string;
  defaultKind?: ChartKind;
  defaultDim?: '2d' | '3d';
  height?: number;
  loading?: boolean;
  extraKinds?: ('funnel' | 'pyramid')[];
  yLabel?: string;
  insight?: string[];
  isFullscreen?: boolean;
}

export default function Chart({
  data, categories, series, title, defaultKind = 'bar', defaultDim = '2d',
  height = 300, loading = false, extraKinds = [], yLabel, insight, isFullscreen = false,
}: ChartProps) {
  const multi = !!(series && series.length && categories && categories.length);
  const sColors = useMemo(() => (series || []).map((s, i) => s.color || PALETTE[i % PALETTE.length]), [series]);
  const singleData: ChartDatum[] = useMemo(() => multi
    ? series!.map((s, i) => ({ label: s.name, value: s.values.reduce((a, b) => a + b, 0), color: sColors[i] }))
    : (data || []),
  [multi, series, data, sColors]);
  const colors = useMemo(() => singleData.map((x, i) => x.color || PALETTE[i % PALETTE.length]), [singleData]);

  const KINDS = useMemo(() => [...BASE_KINDS, ...EXTRA_KINDS.filter((k) => extraKinds.includes(k.key as 'funnel' | 'pyramid'))], [extraKinds]);
  const [kind, setKind] = useState<ChartKind>(defaultKind);
  const [dim, setDim] = useState<'2d' | '3d'>(defaultDim);
  const meta = KINDS.find((k) => k.key === kind) || BASE_KINDS[0];
  const effDim = meta.has3d ? dim : '2d';

  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [hoverSeg, setHoverSeg] = useState<{ c: number; s: number } | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const [full, setFull] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const progRef = useRef(0);
  const dimRef = useRef(defaultDim === '3d' && meta.has3d ? 1 : 0);
  const rafRef = useRef(0);
  const dimRafRef = useRef(0);
  const hovRef = useRef<Hover>({ ...NO_HOVER });
  const hovRafRef = useRef(0);
  const aspectRef = useRef(height / 560);
  const themeTick = useThemeTick();

  const dataSig = useMemo(() => JSON.stringify({
    d: singleData.map((x) => [x.label, x.value]),
    s: (series || []).map((s) => s.values), c: categories,
  }), [singleData, series, categories]);

  const buildCtx = useCallback((W: number, H: number, p: number, m: number, hov: Hover, forExport = false): DrawCtx => ({
    W, H, t: themeColors(forExport), p, m, hov,
    data: singleData, colors, multi,
    cats: categories || [], series: series || [], sColors, yLabel,
  }), [singleData, colors, multi, categories, series, sColors, yLabel]);

  const paint = useCallback((ctx: Ctx, W: number, H: number, p: number, m: number, hov: Hover, forExport = false) => {
    paintChart(ctx, kind, buildCtx(W, H, p, m, hov, forExport));
  }, [buildCtx, kind]);

  const render = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    const W = cv.clientWidth, H = cv.clientHeight;
    // Canvas not laid out yet (0-size buffer would blank the chart while
    // exports — which build their own canvas — keep working). Retry next frame.
    if (W <= 0 || H <= 0) { requestAnimationFrame(() => render()); return; }
    aspectRef.current = H / W;
    const bw = Math.round(W * dpr), bh = Math.round(H * dpr);
    if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; }
    const ctx = cv.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paint(ctx, W, H, easeOut(progRef.current), dimRef.current, hovRef.current);
  }, [paint]);

  /* entrance animation — data/kind change only (NOT dim) */
  useEffect(() => {
    if (loading) return;
    cancelAnimationFrame(rafRef.current);
    progRef.current = 0;
    dimRef.current = effDim === '3d' ? 1 : 0; // snap dim on kind/data change
    const t0 = performance.now();
    const tick = (now: number) => {
      progRef.current = Math.min(1, (now - t0) / 750);
      render();
      if (progRef.current < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, dataSig, loading]);

  /* 2D ⇄ 3D morph transition */
  useEffect(() => {
    if (loading) return;
    const target = effDim === '3d' ? 1 : 0;
    if (Math.abs(dimRef.current - target) < 0.001) return;
    cancelAnimationFrame(dimRafRef.current);
    const from = dimRef.current;
    const t0 = performance.now();
    const DUR = 450;
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / DUR);
      dimRef.current = from + (target - from) * easeOut(t);
      render();
      if (t < 1) dimRafRef.current = requestAnimationFrame(tick);
    };
    dimRafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(dimRafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effDim, loading]);

  /* smooth hover animation */
  useEffect(() => {
    const target = hoverIdx !== null || hoverSeg !== null;
    const h = hovRef.current;
    if (hoverIdx !== h.idx || JSON.stringify(hoverSeg) !== JSON.stringify(h.seg)) {
      h.idx = hoverIdx; h.seg = hoverSeg;
      if (target) h.amt = Math.min(h.amt, 0.35);
    }
    cancelAnimationFrame(hovRafRef.current);
    const tick = () => {
      const goal = target ? 1 : 0;
      const diff = goal - h.amt;
      if (Math.abs(diff) < 0.02) {
        h.amt = goal;
        if (!target) { h.idx = null; h.seg = null; }
        if (progRef.current >= 1) render();
        return;
      }
      h.amt += diff * 0.22;
      if (progRef.current >= 1) render();
      hovRafRef.current = requestAnimationFrame(tick);
    };
    hovRafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(hovRafRef.current);
  }, [hoverIdx, hoverSeg, render]);

  useEffect(() => { if (progRef.current >= 1) render(); }, [themeTick, render]);
  /* Repaint on ANY size change of the canvas itself — window resizes,
     sidebar/filter reflows, fullscreen, scrollbar appearance, tab reveals. */
  useEffect(() => {
    const cv = canvasRef.current;
    const on = () => render();
    window.addEventListener('resize', on);
    let ro: ResizeObserver | null = null;
    if (cv && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => render());
      ro.observe(cv);
    }
    return () => { window.removeEventListener('resize', on); ro?.disconnect(); };
  }, [render, loading]);

  /* hit testing */
  const hit = (e: React.MouseEvent) => {
    const cv = canvasRef.current;
    if (!cv || !singleData.length) return;
    const r = cv.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    const W = r.width, H = r.height;
    const m = dimRef.current;
    const total = singleData.reduce((s, x) => s + x.value, 0) || 1;
    let idx: number | null = null;
    let seg: { c: number; s: number } | null = null;
    let text = '';

    if (kind === 'pie' || kind === 'donut' || kind === 'polar') {
      const g = circGeom(W, H, kind === 'polar' ? 0 : m, singleData);
      const rIn = kind === 'donut' ? g.R * g.rInRatio : 0;
      const ex = mx - g.cx, ey = (my - g.cy) / g.squash;
      const rad = Math.hypot(ex, ey);
      if (rad <= g.R + 12 && rad >= Math.max(0, rIn - 8)) {
        let ang = Math.atan2(ey, ex) + Math.PI / 2;
        ang = ((ang % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        if (kind === 'polar') {
          const max = Math.max(...singleData.map((x) => x.value), 1);
          const i = Math.min(singleData.length - 1, Math.floor((ang / (Math.PI * 2)) * singleData.length));
          if ((singleData[i].value / max) * g.R >= rad - 8) idx = i;
        } else {
          let acc = 0;
          for (let i = 0; i < singleData.length; i++) {
            acc += (singleData[i].value / total) * Math.PI * 2;
            if (ang <= acc) { idx = i; break; }
          }
        }
      }
      if (idx !== null) text = `${singleData[idx].label}: ${singleData[idx].value}`;
    } else if (kind === 'funnel' || kind === 'pyramid') {
      const padT = 16 + 10 * m, padB = 16 + 6 * m;
      const ch = Math.min(H - padT - padB, W * 0.62);
      const topY = padT + (H - padT - padB - ch) / 2;
      const heights = singleData.map((x) => (x.value / total) * ch);
      let y = topY;
      for (let i = 0; i < singleData.length; i++) {
        if (my >= y && my <= y + heights[i]) { idx = i; break; }
        y += heights[i];
      }
      if (idx !== null) text = `${singleData[idx].label}: ${singleData[idx].value}`;
    } else if (kind === 'radar') {
      const cy = H / 2 + 6, R = Math.min(W, H) / 2 - 44;
      const labels = multi ? categories! : singleData.map((x) => x.label);
      const max = multi ? Math.max(...series!.flatMap((s) => s.values), 1) : Math.max(...singleData.map((x) => x.value), 1);
      let best = 12;
      labels.forEach((_, i) => {
        const aa = -Math.PI / 2 + (i * Math.PI * 2) / labels.length;
        const v = multi ? Math.max(...series!.map((s) => s.values[i] || 0)) : singleData[i].value;
        const vr = (v / max) * R;
        const dd = Math.hypot(mx - (W / 2 + Math.cos(aa) * vr), my - (cy + Math.sin(aa) * vr));
        if (dd < best) { best = dd; idx = i; }
      });
      if (idx !== null) text = multi
        ? `${categories![idx]} · ${series!.map((s) => `${s.name}: ${s.values[idx!] || 0}`).join(' · ')}`
        : `${singleData[idx].label}: ${singleData[idx].value}`;
    } else {
      const isBar = kind === 'bar';
      const nD = multi ? series!.length : 1;
      const OX = isBar ? 13 * m : (20 * m) * (nD - 1) + 14 * m;
      const OY = isBar ? 9 * m : (13 * m) * (nD - 1) + 9 * m;
      const pad = { l: 46, r: 16 + (isBar ? 20 * m : OX), t: 18 + (isBar ? 12 * m : OY), b: 34 };
      const labels = multi ? categories! : singleData.map((x) => x.label);
      const step = (W - pad.l - pad.r) / Math.max(1, labels.length);
      const ci = Math.floor((mx - pad.l) / step);
      if (ci >= 0 && ci < labels.length && mx >= pad.l) {
        if (multi && isBar) {
          const ch = H - pad.t - pad.b;
          const totals = categories!.map((_, c) => series!.reduce((s, sr) => s + (sr.values[c] || 0), 0));
          const max = Math.max(...totals, 1);
          const yVal = ((pad.t + ch - my) / ch) * max;
          let acc = 0, si: number | null = null;
          for (let s = 0; s < series!.length; s++) {
            acc += series![s].values[ci] || 0;
            if (yVal <= acc) { si = s; break; }
          }
          if (si !== null && yVal <= totals[ci]) {
            seg = { c: ci, s: si };
            text = `${categories![ci]} · ${series![si].name}: ${series![si].values[ci] || 0} (total ${totals[ci]})`;
          }
        } else if (multi) {
          const ch = H - pad.t - pad.b;
          const max = Math.max(...series!.flatMap((s) => s.values), 1);
          let best = 20, bs: number | null = null;
          series!.forEach((s, si) => {
            const yy = pad.t + ch - ((s.values[ci] || 0) / max) * ch - (13 * m) * si;
            const dd = Math.abs(my - yy);
            if (dd < best) { best = dd; bs = si; }
          });
          if (bs !== null) {
            seg = { c: ci, s: bs };
            text = `${categories![ci]} · ${series![bs].name}: ${series![bs].values[ci] || 0}`;
          }
        } else {
          idx = ci;
          text = `${singleData[ci].label}: ${singleData[ci].value}`;
        }
      }
    }

    setHoverIdx(idx);
    setHoverSeg(seg);
    setTip(idx !== null || seg !== null ? { x: mx, y: my, text } : null);
  };

  /* exports */
  const doExport = async (fmt: string) => {
    const cv = canvasRef.current;
    if (!cv) return;
    const base = (title || 'chart').toLowerCase().replace(/\s+/g, '-');
    const W = cv.clientWidth, H = cv.clientHeight;
    const m = effDim === '3d' ? 1 : 0;
    const legendItems = multi
      ? series!.map((s, i) => ({ label: s.name, color: sColors[i] }))
      : singleData.map((x, i) => ({ label: x.label, color: colors[i] }));

    if (fmt === 'csv') {
      const csv = multi
        ? 'category,' + series!.map((s) => `"${s.name}"`).join(',') + '\n' +
          categories!.map((c, i) => `"${c}",` + series!.map((s) => s.values[i] || 0).join(',')).join('\n')
        : 'label,value\n' + singleData.map((x) => `"${x.label}",${x.value}`).join('\n');
      downloadBlob(`${base}.csv`, new Blob([csv], { type: 'text/csv' }));
      return;
    }
    if (fmt === 'json') {
      downloadBlob(`${base}.json`, new Blob([JSON.stringify(multi ? { categories, series } : singleData, null, 2)], { type: 'application/json' }));
      return;
    }
    if (fmt === 'excel') {
      const ExcelJS = await loadExcelJS();
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Chart Data');
      ws.mergeCells(1, 1, 1, multi ? series!.length + 1 : 2);
      const titleCell = ws.getCell(1, 1);
      titleCell.value = (title || 'Chart').toUpperCase();
      titleCell.font = { bold: true, size: 13, color: { argb: 'FF0D7A54' } };
      const head = ws.addRow(multi ? ['Category', ...series!.map((s) => s.name)] : ['Label', 'Value']);
      head.eachCell((cell: { font: unknown; fill: unknown }) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D7A54' } };
      });
      if (multi) categories!.forEach((c, i) => ws.addRow([c, ...series!.map((s) => s.values[i] || 0)]));
      else singleData.forEach((x) => ws.addRow([x.label, x.value]));
      ws.getColumn(1).width = 24;
      const buf = await wb.xlsx.writeBuffer();
      downloadBlob(`${base}.xlsx`, new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      return;
    }
    if (fmt === 'svg') {
      const svg = composeSvg(title || '', W, H, legendItems, (ctx) => paint(ctx, W, H, 1, m, NO_HOVER, true));
      downloadBlob(`${base}.svg`, new Blob([svg], { type: 'image/svg+xml' }));
      return;
    }
    const out = composeExport(title || '', W, H, legendItems, (ctx) => paint(ctx, W, H, 1, m, NO_HOVER, true));
    if (fmt === 'png') out.toBlob((b) => b && downloadBlob(`${base}.png`, b), 'image/png');
    else if (fmt === 'pdf') {
      const dataUrl = out.toDataURL('image/jpeg', 0.94);
      const bytes = Uint8Array.from(atob(dataUrl.split(',')[1]), (c) => c.charCodeAt(0));
      downloadBlob(`${base}.pdf`, jpegToPdf(bytes, out.width, out.height));
    } else if (fmt === 'print') printCanvas(title || 'Chart', out);
  };

  const legend = multi
    ? series!.map((s, i) => ({ label: s.name, color: sColors[i] }))
    : singleData.map((x, i) => ({ label: x.label, color: colors[i] }));

  const body = (
    <div className="tk-card p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {title && <p className="mr-auto font-display text-[15px] font-semibold text-ink">{title}</p>}
        <div className="tk-inset flex gap-0.5 p-1">
          {(['2d', '3d'] as const).map((dd) => (
            <button key={dd} onClick={() => setDim(dd)} disabled={loading || (dd === '3d' && !meta.has3d)}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1 font-body text-[11px] font-bold uppercase transition disabled:opacity-30 ${effDim === dd ? 'tk-raise-sm text-primary' : 'text-muted hover:text-ink'}`}>
              {dd === '2d' ? <Square size={11} /> : <Box size={11} />} {dd}
            </button>
          ))}
        </div>
        <MiniDrop label={meta.label} activeKey={kind}
          items={KINDS.map((k) => ({ key: k.key, label: k.label }))}
          onPick={(k) => { setKind(k as ChartKind); setHoverIdx(null); setHoverSeg(null); setTip(null); }} />
        <MiniDrop label="Export" icon={<Download size={12} />}
          items={[
            { key: 'png', label: 'PNG image' },
            { key: 'svg', label: 'SVG vector' },
            { key: 'pdf', label: 'PDF document' },
            { key: 'excel', label: 'Excel workbook' },
            { key: 'print', label: 'Print…' },
            { key: 'csv', label: 'CSV data' },
            { key: 'json', label: 'JSON data' },
          ]}
          onPick={doExport} />
        {!isFullscreen && (
          <button onClick={() => setFull(true)} data-tip="View fullscreen" className="tk-btn-ghost rounded-xl p-2">
            <Eye size={14} />
          </button>
        )}
      </div>

      <div className="relative" style={{ height }}>
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <NeuLoader size={54} />
          </div>
        ) : (
          <>
            <canvas ref={canvasRef} className={effDim === '2d' ? 'chart-lift' : ''} style={{ width: '100%', height: '100%' }}
              onMouseMove={hit} onMouseLeave={() => { setHoverIdx(null); setHoverSeg(null); setTip(null); }} />
            {tip && (
              <div className="tk-pop pointer-events-none absolute z-10 px-2.5 py-1 font-body text-[11px] font-bold text-ink"
                style={{ left: Math.min(tip.x + 12, (canvasRef.current?.clientWidth || 300) - 170), top: Math.max(0, tip.y - 34) }}>
                {tip.text}
              </div>
            )}
          </>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {legend.map((l, i) => (
          <button key={l.label + i}
            onMouseEnter={() => (multi ? setHoverSeg({ c: -1, s: i }) : setHoverIdx(i))}
            onMouseLeave={() => { setHoverIdx(null); setHoverSeg(null); }}
            className={`flex items-center gap-1.5 font-body text-[11px] font-semibold transition ${(multi ? hoverSeg?.s === i : hoverIdx === i) ? 'text-ink' : 'text-muted'}`}>
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: l.color }} /> {l.label}
          </button>
        ))}
      </div>

      {insight && insight.length > 0 && (
        <div className="tk-inset mt-3 space-y-1 rounded-xl px-3.5 py-2.5">
          {insight.map((line, i) => <p key={i} className="font-body text-[11.5px] text-ink/70">• {line}</p>)}
        </div>
      )}
    </div>
  );

  const fsSize = () => {
    const aspect = aspectRef.current || 0.55;
    const maxW = Math.min(1100, window.innerWidth - 48);
    const maxH = window.innerHeight - 190;
    let w = maxW, h = w * aspect;
    if (h > maxH) { h = maxH; w = h / aspect; }
    return { w, h };
  };

  return (
    <>
      {body}
      {full && createPortal(
        (() => {
          const { w, h } = fsSize();
          return (
            <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[3px]"
              onMouseDown={(e: React.MouseEvent) => { if (e.target === e.currentTarget) setFull(false); }}>
              <div style={{ width: w }}>
                <div className="mb-2 flex justify-end">
                  <button onClick={() => setFull(false)} className="tk-btn-ghost rounded-full p-2"><X size={16} /></button>
                </div>
                <Chart data={data} categories={categories} series={series} title={title}
                  defaultKind={kind} defaultDim={effDim} height={h} extraKinds={extraKinds}
                  yLabel={yLabel} insight={insight} isFullscreen />
              </div>
            </div>
          );
        })(),
        document.body
      )}
    </>
  );
}

/* ================= StackedColumns (compat wrapper) ================= */
export function StackedColumns({ title, categories, series, height = 300, yLabel = 'Employees', insight }: {
  title: string; categories: string[]; series: StackedSeries[]; height?: number; yLabel?: string; insight?: string[];
}) {
  return <Chart title={title} categories={categories} series={series} defaultKind="bar" height={height} yLabel={yLabel} insight={insight} />;
}

/* ============================================================
   Neumorphic chart family v2 — true soft-UI depth, switchable
   kinds, fullscreen, loading, and the full export set (SVG /
   PNG / PDF / Print / Excel / CSV / JSON).
   ============================================================ */
type NeuKind = 'donut' | 'pie' | 'bars' | 'columns' | 'line' | 'area';
const NEU_KINDS: { key: NeuKind; label: string }[] = [
  { key: 'donut', label: 'Donut' },
  { key: 'pie', label: 'Pie' },
  { key: 'bars', label: 'Bars' },
  { key: 'columns', label: 'Columns' },
  { key: 'line', label: 'Line' },
  { key: 'area', label: 'Area' },
];

function neuSurface(): { surface: string; ink: string; muted: string } {
  const cs = getComputedStyle(document.documentElement);
  return {
    surface: cs.getPropertyValue('--t-surface').trim() || '#e4e7e0',
    ink: cs.getPropertyValue('--t-ink').trim() || '#101914',
    muted: '#79837c',
  };
}

/** Build a standalone export SVG for a neu chart (white bg, soft shadows). */
function neuSvg(kind: NeuKind, data: ChartDatum[], title: string, W = 560, H = 380): string {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const max = Math.max(...data.map((d) => d.value), 1);
  const colorOf = (d: ChartDatum, i: number) => d.color || PALETTE[i % PALETTE.length];
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  let body = '';
  const defs = `<filter id="soft" x="-40%" y="-40%" width="180%" height="180%">
    <feDropShadow dx="4" dy="4" stdDeviation="5" flood-color="#b9c0b6" flood-opacity="0.8"/>
    <feDropShadow dx="-4" dy="-4" stdDeviation="5" flood-color="#ffffff" flood-opacity="0.95"/>
  </filter>`;
  const cx = W / 2, cy = H / 2 + 8;

  if (kind === 'donut' || kind === 'pie') {
    const R = Math.min(W, H) / 2 - 70;
    body += `<circle cx="${cx}" cy="${cy}" r="${R + 18}" fill="#eef0ec" filter="url(#soft)"/>`;
    let a = -Math.PI / 2;
    data.forEach((d, i) => {
      const a2 = a + (d.value / total) * Math.PI * 2;
      const large = a2 - a > Math.PI ? 1 : 0;
      const rIn = kind === 'donut' ? R * 0.58 : 0;
      const pt = (ang: number, r: number) => `${(cx + Math.cos(ang) * r).toFixed(1)} ${(cy + Math.sin(ang) * r).toFixed(1)}`;
      const dPath = rIn > 0
        ? `M ${pt(a, R)} A ${R} ${R} 0 ${large} 1 ${pt(a2, R)} L ${pt(a2, rIn)} A ${rIn} ${rIn} 0 ${large} 0 ${pt(a, rIn)} Z`
        : `M ${cx} ${cy} L ${pt(a, R)} A ${R} ${R} 0 ${large} 1 ${pt(a2, R)} Z`;
      body += `<path d="${dPath}" fill="${colorOf(d, i)}" stroke="#eef0ec" stroke-width="3" filter="url(#soft)"/>`;
      const mid = (a + a2) / 2;
      if ((d.value / total) >= 0.07) {
        const lr = rIn > 0 ? (R + rIn) / 2 : R * 0.62;
        body += `<text x="${cx + Math.cos(mid) * lr}" y="${cy + Math.sin(mid) * lr + 3}" text-anchor="middle" font-family="sans-serif" font-size="10" font-weight="700" fill="#fff">${Math.round((d.value / total) * 100)}%</text>`;
      }
      a = a2;
    });
    if (kind === 'donut') {
      body += `<circle cx="${cx}" cy="${cy}" r="${R * 0.44}" fill="#eef0ec" filter="url(#soft)"/>`;
      body += `<text x="${cx}" y="${cy + 5}" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="18" fill="#1c2620">${total}</text>`;
    }
  } else if (kind === 'bars') {
    const padL = 24, padR = 60, rowH = Math.min(44, (H - 90) / data.length);
    data.forEach((d, i) => {
      const y = 60 + i * rowH;
      body += `<text x="${padL}" y="${y + 10}" font-family="sans-serif" font-size="11" font-weight="600" fill="#39443d">${esc(fitText(d.label, 110, 11))}</text>`;
      body += `<rect x="${padL}" y="${y + 16}" width="${W - padL - padR}" height="14" rx="7" fill="#e3e6e0" filter="url(#soft)"/>`;
      body += `<rect x="${padL}" y="${y + 16}" width="${(d.value / max) * (W - padL - padR)}" height="14" rx="7" fill="${colorOf(d, i)}"/>`;
      body += `<text x="${W - padR + 8}" y="${y + 27}" font-family="sans-serif" font-size="11" font-weight="700" fill="#1c2620">${d.value}</text>`;
    });
  } else if (kind === 'columns') {
    const padB = 60, colW = Math.min(52, (W - 80) / data.length * 0.6);
    const step = (W - 80) / data.length;
    data.forEach((d, i) => {
      const x = 40 + step * i + (step - colW) / 2;
      const h = (d.value / max) * (H - 140);
      body += `<rect x="${x}" y="${60}" width="${colW}" height="${H - 140}" rx="10" fill="#e3e6e0" filter="url(#soft)"/>`;
      body += `<rect x="${x}" y="${60 + (H - 140) - h}" width="${colW}" height="${h}" rx="10" fill="${colorOf(d, i)}"/>`;
      body += `<text x="${x + colW / 2}" y="${H - padB + 16}" text-anchor="middle" font-family="sans-serif" font-size="10" font-weight="700" fill="#39443d">${esc(fitText(d.label, step - 4, 10))}</text>`;
      body += `<text x="${x + colW / 2}" y="${52}" text-anchor="middle" font-family="sans-serif" font-size="10.5" font-weight="700" fill="#1c2620">${d.value}</text>`;
    });
  } else {
    // line / area
    const padX = 46, padY = 66;
    const step = (W - padX * 2) / Math.max(1, data.length - 1);
    const pts = data.map((d, i) => ({ x: padX + step * i, y: padY + (H - padY * 2) * (1 - d.value / max) }));
    let path = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      path += ` C ${p1.x + (p2.x - p0.x) / 6} ${p1.y + (p2.y - p0.y) / 6}, ${p2.x - (p3.x - p1.x) / 6} ${p2.y - (p3.y - p1.y) / 6}, ${p2.x} ${p2.y}`;
    }
    const col = colorOf(data[0], 0);
    for (let gx = 0; gx < 6; gx++) for (let gy = 0; gy < 4; gy++) {
      body += `<circle cx="${padX + gx * (W - padX * 2) / 5}" cy="${padY + gy * (H - padY * 2) / 3}" r="1.5" fill="#c9cec6"/>`;
    }
    if (kind === 'area') {
      body += `<path d="${path} L ${pts[pts.length - 1].x} ${H - padY} L ${pts[0].x} ${H - padY} Z" fill="${col}30"/>`;
    }
    body += `<path d="${path}" fill="none" stroke="${col}" stroke-width="3.5" stroke-linecap="round" filter="url(#soft)"/>`;
    pts.forEach((pt, i) => {
      body += `<circle cx="${pt.x}" cy="${pt.y}" r="5.5" fill="#eef0ec" stroke="${col}" stroke-width="2.5" filter="url(#soft)"/>`;
      body += `<text x="${pt.x}" y="${H - padY + 18}" text-anchor="middle" font-family="sans-serif" font-size="9.5" font-weight="700" fill="#39443d">${esc(fitText(data[i].label, step - 4, 9.5))}</text>`;
    });
  }

  // legend
  let legend = '';
  data.forEach((d, i) => {
    const colN = i % 3, row = Math.floor(i / 3);
    const x = 30 + colN * ((W - 60) / 3), y = H - 26 + row * 0;
    if (row === 0) {
      legend += `<circle cx="${x}" cy="${y - 3}" r="4" fill="${colorOf(d, i)}"/>`;
      legend += `<text x="${x + 9}" y="${y}" font-family="sans-serif" font-size="10" font-weight="600" fill="#39443d">${esc(fitText(d.label, (W - 60) / 3 - 40, 10))} · ${d.value}</text>`;
    }
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${defs}</defs><rect width="${W}" height="${H}" fill="#ffffff"/><text x="16" y="26" font-family="Georgia,serif" font-weight="700" font-size="15" fill="#1c2620">${esc(title)}</text>${body}${legend}</svg>`;
}

export function NeuChart({ data, title, defaultKind = 'donut', size = 158, centerLabel = 'total', legendSide = false, loading = false, isFullscreen = false }: {
  data: ChartDatum[]; title?: string; defaultKind?: NeuKind; size?: number; centerLabel?: string; legendSide?: boolean; loading?: boolean; isFullscreen?: boolean;
}) {
  const [kind, setKind] = useState<NeuKind>(defaultKind);
  const [hover, setHover] = useState<number | null>(null);
  const [full, setFull] = useState(false);
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const max = Math.max(...data.map((d) => d.value), 1);
  const colorOf = (d: ChartDatum, i: number) => d.color || PALETTE[i % PALETTE.length];
  const ns = neuSurface();
  void ns;

  const doExport = async (fmt: string) => {
    const base = (title || 'chart').toLowerCase().replace(/\s+/g, '-');
    if (fmt === 'csv') {
      downloadBlob(`${base}.csv`, new Blob(['label,value\n' + data.map((d) => `"${d.label}",${d.value}`).join('\n')], { type: 'text/csv' }));
      return;
    }
    if (fmt === 'json') {
      downloadBlob(`${base}.json`, new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      return;
    }
    if (fmt === 'excel') {
      const ExcelJS = await loadExcelJS();
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Data');
      const head = ws.addRow(['Label', 'Value']);
      head.eachCell((cell: { font: unknown; fill: unknown }) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D7A54' } };
      });
      data.forEach((d) => ws.addRow([d.label, d.value]));
      ws.getColumn(1).width = 24;
      const buf = await wb.xlsx.writeBuffer();
      downloadBlob(`${base}.xlsx`, new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      return;
    }
    const svg = neuSvg(kind, data, title || 'Chart');
    if (fmt === 'svg') {
      downloadBlob(`${base}.svg`, new Blob([svg], { type: 'image/svg+xml' }));
      return;
    }
    const cv = await svgToCanvas(svg, 560, 380, 3);
    if (fmt === 'png') cv.toBlob((b) => b && downloadBlob(`${base}.png`, b), 'image/png');
    else if (fmt === 'pdf') {
      const dataUrl = cv.toDataURL('image/jpeg', 0.94);
      const bytes = Uint8Array.from(atob(dataUrl.split(',')[1]), (c) => c.charCodeAt(0));
      downloadBlob(`${base}.pdf`, jpegToPdf(bytes, cv.width, cv.height));
    } else if (fmt === 'print') printCanvas(title || 'Chart', cv);
  };

  /* ---- circular: soft base puck + gapped slices with per-slice depth ---- */
  const circular = (isDonut: boolean) => {
    const S = size + 36;
    const R = size / 2 - 4;
    const rIn = isDonut ? R * 0.58 : 0;
    let acc = 0;
    const arcs = data.map((d, i) => {
      const frac = d.value / total;
      const a0 = acc * Math.PI * 2 - Math.PI / 2;
      acc += frac;
      const a1 = acc * Math.PI * 2 - Math.PI / 2;
      return { d, i, frac, a0, a1, mid: (a0 + a1) / 2 };
    });
    const cx = S / 2, cyy = S / 2;
    const pt = (ang: number, r: number) => `${(cx + Math.cos(ang) * r).toFixed(2)} ${(cyy + Math.sin(ang) * r).toFixed(2)}`;
    return (
      <div className="relative shrink-0" style={{ width: S, height: S }}>
        {/* raised base puck */}
        <div className="tk-raise-sm absolute inset-0 rounded-full" />
        <div className="tk-inset absolute rounded-full" style={{ inset: 9 }} />
        <svg width={S} height={S} className="relative">
          {arcs.map(({ d, i, frac, a0, a1, mid }) => {
            const on = hover === i;
            const off = on ? 5 : 0;
            const ox = Math.cos(mid) * off, oy = Math.sin(mid) * off;
            const large = a1 - a0 > Math.PI ? 1 : 0;
            const path = rIn > 0
              ? `M ${pt(a0, R)} A ${R} ${R} 0 ${large} 1 ${pt(a1, R)} L ${pt(a1, rIn)} A ${rIn} ${rIn} 0 ${large} 0 ${pt(a0, rIn)} Z`
              : `M ${cx} ${cyy} L ${pt(a0, R)} A ${R} ${R} 0 ${large} 1 ${pt(a1, R)} Z`;
            return (
              <g key={d.label} transform={`translate(${ox} ${oy})`} style={{ transition: 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1)' }}>
                <path d={path} fill={colorOf(d, i)} stroke="var(--t-surface)" strokeWidth={3}
                  opacity={hover === null || on ? 1 : 0.5}
                  onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
                  style={{
                    cursor: 'pointer', transition: 'opacity 0.25s',
                    filter: 'drop-shadow(2.5px 2.5px 3.5px color-mix(in srgb, var(--t-ink) 30%, transparent)) drop-shadow(-1.5px -1.5px 2.5px rgba(255,255,255,0.55))',
                  }} />
                {frac >= 0.08 && (
                  <text x={cx + Math.cos(mid) * (rIn > 0 ? (R + rIn) / 2 : R * 0.62)}
                    y={cyy + Math.sin(mid) * (rIn > 0 ? (R + rIn) / 2 : R * 0.62) + 3.5}
                    textAnchor="middle" pointerEvents="none"
                    style={{ font: '700 10px Outfit, sans-serif', fill: '#fff', textShadow: '0 1px 1px rgba(0,0,0,0.4)' }}>
                    {Math.round(frac * 100)}%
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {isDonut && (
          <div className="tk-raise-sm absolute flex flex-col items-center justify-center rounded-full" style={{ inset: S / 2 - rIn + 7 }}>
            <p className="font-display text-[19px] font-bold leading-none text-ink">{hover !== null ? data[hover].value : total}</p>
            <p className="mt-0.5 font-body text-[8.5px] font-bold uppercase tracking-wider text-muted">{hover !== null ? fitText(data[hover].label, 60, 8.5) : centerLabel}</p>
          </div>
        )}
      </div>
    );
  };

  /* ---- horizontal soft bars ---- */
  const bars = (
    <div className="w-full space-y-3">
      {data.map((d, i) => (
        <div key={d.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
          <div className="mb-1 flex justify-between font-body text-[11.5px]">
            <span className="font-semibold text-ink/75">{d.label}</span>
            <span className="font-bold tabular-nums text-ink">{d.value}</span>
          </div>
          <div className="tk-inset h-4 overflow-hidden rounded-full">
            <div className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${(d.value / max) * 100}%`, transitionDelay: `${i * 60}ms`,
                background: `linear-gradient(145deg, ${colorOf(d, i)}, ${shade(colorOf(d, i), 0.8)})`,
                boxShadow: '1px 1px 3px rgba(0,0,0,0.25), inset 0 1px 1px rgba(255,255,255,0.4)',
                filter: hover === i ? 'brightness(1.12)' : undefined,
              }} />
          </div>
        </div>
      ))}
    </div>
  );

  /* ---- vertical soft columns ---- */
  const columns = (
    <div className="flex w-full items-end justify-around gap-2" style={{ height: size + 24 }}>
      {data.map((d, i) => (
        <div key={d.label} className="flex min-w-0 flex-1 flex-col items-center gap-1.5"
          onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
          <span className="font-body text-[10.5px] font-bold tabular-nums text-ink/70">{d.value}</span>
          <div className="tk-inset flex w-full max-w-[44px] items-end overflow-hidden rounded-xl" style={{ height: size - 10 }}>
            <div className="w-full rounded-xl transition-all duration-700"
              style={{
                height: `${(d.value / max) * 100}%`, transitionDelay: `${i * 60}ms`,
                background: `linear-gradient(145deg, ${colorOf(d, i)}, ${shade(colorOf(d, i), 0.8)})`,
                boxShadow: 'inset 0 2px 2px rgba(255,255,255,0.35), 0 -1px 3px rgba(0,0,0,0.15)',
                filter: hover === i ? 'brightness(1.12)' : undefined,
              }} />
          </div>
          <span className="w-full truncate text-center font-body text-[9.5px] font-bold uppercase tracking-wide text-muted">{fitText(d.label, 52, 9.5)}</span>
        </div>
      ))}
    </div>
  );

  /* ---- soft line / area with dotted grid ---- */
  const lineArea = (isArea: boolean) => {
    const W = 320, H = size + 16, padX = 18, padY = 20;
    const step = (W - padX * 2) / Math.max(1, data.length - 1);
    const pts = data.map((d, i) => ({ x: padX + step * i, y: padY + (H - padY * 2) * (1 - d.value / max) }));
    let path = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      path += ` C ${p1.x + (p2.x - p0.x) / 6} ${p1.y + (p2.y - p0.y) / 6}, ${p2.x - (p3.x - p1.x) / 6} ${p2.y - (p3.y - p1.y) / 6}, ${p2.x} ${p2.y}`;
    }
    const col = colorOf(data[0], 0);
    return (
      <div className="w-full">
        <div className="tk-inset rounded-2xl p-2">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
            {Array.from({ length: 6 }).flatMap((_, gx) => Array.from({ length: 4 }).map((__, gy) => (
              <circle key={`${gx}-${gy}`} cx={padX + (gx * (W - padX * 2)) / 5} cy={padY + (gy * (H - padY * 2)) / 3} r={1.4}
                fill="color-mix(in srgb, var(--t-ink) 16%, transparent)" />
            )))}
            {isArea && (
              <path d={`${path} L ${pts[pts.length - 1].x} ${H - padY} L ${pts[0].x} ${H - padY} Z`} fill={withAlpha(col, '30')} />
            )}
            <path d={path} fill="none" stroke={col} strokeWidth={3.5} strokeLinecap="round"
              style={{ filter: 'drop-shadow(2px 3px 3px color-mix(in srgb, var(--t-ink) 28%, transparent))' }} />
            {pts.map((pt, i) => (
              <circle key={i} cx={pt.x} cy={pt.y} r={hover === i ? 7 : 5.5}
                fill="var(--t-surface)" stroke={col} strokeWidth={2.5}
                onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
                style={{
                  transition: 'r 0.2s', cursor: 'pointer',
                  filter: 'drop-shadow(1.5px 1.5px 2px color-mix(in srgb, var(--t-ink) 25%, transparent))',
                }} />
            ))}
          </svg>
        </div>
        <div className="mt-1.5 flex justify-between px-2">
          {data.map((d, i) => (
            <span key={d.label} className={`font-body text-[9px] font-bold uppercase ${hover === i ? 'text-ink' : 'text-muted'}`}>{fitText(d.label, 46, 9)}</span>
          ))}
        </div>
      </div>
    );
  };

  const legendEl = (
    <div className={legendSide && (kind === 'donut' || kind === 'pie') ? 'min-w-0 flex-1 space-y-1.5' : 'mt-3 flex flex-wrap justify-center gap-x-3.5 gap-y-1'}>
      {data.map((d, i) => (
        <div key={d.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
          className={`flex cursor-pointer items-center gap-1.5 font-body text-[11px] font-semibold ${hover === i ? 'text-ink' : 'text-muted'} ${legendSide ? 'justify-between' : ''}`}>
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: colorOf(d, i) }} />
            <span className="truncate">{d.label}</span>
          </span>
          <span className="shrink-0 tabular-nums text-ink/70">{d.value} · {Math.round((d.value / total) * 100)}%</span>
        </div>
      ))}
    </div>
  );

  const body = (
    <div className="tk-card p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {title && <p className="mr-auto font-display text-[14px] font-semibold text-ink">{title}</p>}
        <MiniDrop label={NEU_KINDS.find((k) => k.key === kind)!.label} activeKey={kind}
          items={NEU_KINDS.map((k) => ({ key: k.key, label: k.label }))}
          onPick={(k) => { setKind(k as NeuKind); setHover(null); }} />
        <MiniDrop label="Export" icon={<Download size={12} />}
          items={[
            { key: 'png', label: 'PNG image' },
            { key: 'svg', label: 'SVG vector' },
            { key: 'pdf', label: 'PDF document' },
            { key: 'excel', label: 'Excel workbook' },
            { key: 'print', label: 'Print…' },
            { key: 'csv', label: 'CSV data' },
            { key: 'json', label: 'JSON data' },
          ]}
          onPick={doExport} />
        {!isFullscreen && (
          <button onClick={() => setFull(true)} data-tip="View fullscreen" className="tk-btn-ghost rounded-xl p-2">
            <Eye size={14} />
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center" style={{ minHeight: size + 40 }}>
          <NeuLoader size={54} />
        </div>
      ) : (
        <>
          {kind === 'donut' || kind === 'pie' ? (
            legendSide
              ? <div className="flex items-center gap-4">{circular(kind === 'donut')}{legendEl}</div>
              : <div className="flex flex-col items-center">{circular(kind === 'donut')}{legendEl}</div>
          ) : kind === 'bars' ? bars
            : kind === 'columns' ? columns
            : lineArea(kind === 'area')}
        </>
      )}
    </div>
  );

  return (
    <>
      {body}
      {full && createPortal(
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[3px]"
          onMouseDown={(e: React.MouseEvent) => { if (e.target === e.currentTarget) setFull(false); }}>
          <div style={{ width: Math.min(760, window.innerWidth - 48) }}>
            <div className="mb-2 flex justify-end">
              <button onClick={() => setFull(false)} className="tk-btn-ghost rounded-full p-2"><X size={16} /></button>
            </div>
            <NeuChart data={data} title={title} defaultKind={kind}
              size={Math.min(300, window.innerHeight - 420)} centerLabel={centerLabel} legendSide isFullscreen />
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

/* compat wrappers */
export function NeuDonut(props: { data: ChartDatum[]; title?: string; size?: number; centerLabel?: string; legendSide?: boolean; loading?: boolean }) {
  return <NeuChart {...props} defaultKind="donut" />;
}
export function NeuBars({ data, title, loading }: { data: ChartDatum[]; title?: string; loading?: boolean }) {
  return <NeuChart data={data} title={title} defaultKind="bars" loading={loading} />;
}
