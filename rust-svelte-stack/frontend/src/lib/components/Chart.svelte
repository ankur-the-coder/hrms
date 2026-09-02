<script lang="ts">
  // Shared chart — mirrors React src/shared/Charts.tsx:
  // 2D/3D toggle, type dropdown (bar/line/area/pie/donut/radar/polar),
  // export (PNG/PDF/Print/CSV/JSON, white bg + title + legend), fullscreen
  // eye, entrance animation only on data/type change, leader-line labels
  // with collision avoidance, 3D donut tilt 0.52 (no auto-rotation),
  // solid radial cut faces, straight line vs free-hand area.
  import { downloadBlob, printHtml } from '$lib/api';
  import NeuLoader from './NeuLoader.svelte';

  export interface Datum { label: string; value: number; color?: string }
  type Kind = 'bar' | 'line' | 'area' | 'pie' | 'donut' | 'radar' | 'polar';

  let { data = [] as Datum[], title = '', defaultKind = 'bar' as Kind, height = 300, loading = false } = $props();

  const PALETTE = ['#0d7a54', '#c9932b', '#0ea5e9', '#a855f7', '#e11d63', '#f97316', '#14b8a6', '#6366f1', '#84cc16', '#f43f5e'];
  const KINDS: { key: Kind; label: string; has3d: boolean }[] = [
    { key: 'bar', label: 'Bar', has3d: true }, { key: 'line', label: 'Line', has3d: false },
    { key: 'area', label: 'Area', has3d: false }, { key: 'pie', label: 'Pie', has3d: true },
    { key: 'donut', label: 'Donut', has3d: true }, { key: 'radar', label: 'Radar', has3d: false },
    { key: 'polar', label: 'Polar', has3d: false },
  ];
  const TILT = 0.52, K = Math.sin(TILT);
  const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
  const shade = (hex: string, f: number) => {
    const n = parseInt(hex.slice(1), 16);
    const c = (v: number) => Math.min(255, Math.max(0, Math.round(v * f)));
    return `rgb(${c((n >> 16) & 255)},${c((n >> 8) & 255)},${c(n & 255)})`;
  };

  let kind: Kind = $state(defaultKind);
  let dim: '2d' | '3d' = $state('2d');
  let hover: number | null = $state(null);
  let tip: { x: number; y: number; text: string } | null = $state(null);
  let full = $state(false);
  let kindOpen = $state(false);
  let exportOpen = $state(false);
  let canvas: HTMLCanvasElement | undefined = $state();
  let prog = 0, raf = 0;

  const colors = $derived(data.map((d, i) => d.color || PALETTE[i % PALETTE.length]));
  const meta = $derived(KINDS.find((k) => k.key === kind)!);
  const effDim = $derived(meta.has3d ? dim : '2d');
  const sig = $derived(JSON.stringify(data.map((d) => [d.label, d.value])));

  function themeColors(forExport = false) {
    if (forExport) return { ink: '#1c2620', axis: '#39443d', grid: 'rgba(60,70,64,0.18)' };
    const ink = getComputedStyle(document.documentElement).getPropertyValue('--t-ink').trim() || '#101914';
    return { ink, axis: ink, grid: 'rgba(128,128,128,0.18)' };
  }

  /* ---- leader labels with collision avoidance ---- */
  function drawLeaders(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, squash: number, total: number, t: { ink: string }, W: number, H: number, equalAngles = false) {
    ctx.font = '600 10.5px Outfit, sans-serif';
    const n = data.length;
    interface E { i: number; mid: number; right: boolean; y: number }
    let a = -Math.PI / 2;
    const entries: E[] = data.map((d, i) => {
      const mid = equalAngles
        ? -Math.PI / 2 + ((i + 0.5) * Math.PI * 2) / n
        : (() => { const a2 = a + (d.value / total) * Math.PI * 2; const m = (a + a2) / 2; a = a2; return m; })();
      return { i, mid, right: Math.cos(mid) >= 0, y: cy + Math.sin(mid) * (R + 16) * squash };
    });
    const place = (list: E[]) => {
      list.sort((p, q2) => p.y - q2.y);
      let prev = -Infinity;
      list.forEach((e) => { e.y = Math.max(e.y, prev + 13); prev = e.y; });
      list.forEach((e) => { e.y = Math.max(10, Math.min(H - 6, e.y)); });
    };
    place(entries.filter((e) => e.right));
    place(entries.filter((e) => !e.right));
    entries.forEach((e) => {
      const d = data[e.i];
      const sx = cx + Math.cos(e.mid) * (R + 2);
      const sy = cy + Math.sin(e.mid) * (R + 2) * squash;
      const ex = cx + (e.right ? R + 14 : -(R + 14));
      const tx = cx + (e.right ? R + 24 : -(R + 24));
      ctx.strokeStyle = colors[e.i]; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, e.y); ctx.lineTo(tx, e.y); ctx.stroke();
      const ang = Math.atan2(sy - e.y, sx - ex);
      ctx.fillStyle = colors[e.i];
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx - Math.cos(ang - 0.42) * 6, sy - Math.sin(ang - 0.42) * 6);
      ctx.lineTo(sx - Math.cos(ang + 0.42) * 6, sy - Math.sin(ang + 0.42) * 6);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = t.ink;
      ctx.textAlign = e.right ? 'left' : 'right';
      ctx.fillText(`${d.label} · ${Math.round((d.value / total) * 100)}%`, Math.max(3, Math.min(W - 3, tx + (e.right ? 3 : -3))), e.y + 3.5);
    });
    ctx.textAlign = 'left';
  }

  function paint(ctx: CanvasRenderingContext2D, W: number, H: number, p: number, hov: number | null, forExport = false) {
    const t = themeColors(forExport);
    ctx.clearRect(0, 0, W, H);
    if (!data.length) return;
    const max = Math.max(...data.map((d) => d.value), 1);
    const total = data.reduce((s, d) => s + d.value, 0) || 1;

    if (kind === 'bar' || kind === 'line' || kind === 'area') {
      const pad = { l: 46, r: effDim === '3d' ? 34 : 16, t: 18, b: 34 };
      const cw = W - pad.l - pad.r, ch = H - pad.t - pad.b;
      const step = cw / data.length;
      ctx.font = '600 10.5px Outfit, sans-serif';
      const ox = effDim === '3d' && kind === 'bar' ? 13 : 0, oy = effDim === '3d' && kind === 'bar' ? 9 : 0;
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
      ctx.textAlign = 'center';
      data.forEach((d, i) => {
        ctx.fillStyle = t.axis;
        ctx.fillText(d.label.slice(0, 9), pad.l + step * i + step / 2, H - 12);
      });

      if (kind === 'bar') {
        data.forEach((d, i) => {
          const bw = Math.min(44, step * 0.52);
          const x = pad.l + step * i + (step - bw) / 2;
          const h = (d.value / max) * ch * p;
          const yTop = pad.t + ch - h;
          const col = hov === i ? shade(colors[i], 1.15) : colors[i];
          if (ox) {
            ctx.fillStyle = shade(colors[i], 0.7);
            ctx.beginPath(); ctx.moveTo(x + bw, yTop); ctx.lineTo(x + bw + ox, yTop - oy);
            ctx.lineTo(x + bw + ox, yTop - oy + h); ctx.lineTo(x + bw, yTop + h); ctx.closePath(); ctx.fill();
            ctx.fillStyle = shade(colors[i], 1.22);
            ctx.beginPath(); ctx.moveTo(x, yTop); ctx.lineTo(x + ox, yTop - oy);
            ctx.lineTo(x + bw + ox, yTop - oy); ctx.lineTo(x + bw, yTop); ctx.closePath(); ctx.fill();
          }
          ctx.fillStyle = col;
          ctx.beginPath(); ctx.roundRect(x, yTop, bw, h, ox ? 0 : [6, 6, 0, 0]); ctx.fill();
        });
        ctx.textAlign = 'left';
        return;
      }

      const pts = data.map((d, i) => ({ x: pad.l + step * i + step / 2, y: pad.t + ch - (d.value / max) * ch }));
      ctx.save();
      ctx.beginPath(); ctx.rect(pad.l, 0, cw * p + 2, H); ctx.clip();
      if (kind === 'area') {
        // free-hand curve for AREA only
        const curve = () => {
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 0; i < pts.length - 1; i++) {
            const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
            ctx.bezierCurveTo(
              p1.x + (p2.x - p0.x) / 6, p1.y + (p2.y - p0.y) / 6,
              p2.x - (p3.x - p1.x) / 6, p2.y - (p3.y - p1.y) / 6, p2.x, p2.y);
          }
        };
        ctx.beginPath(); curve();
        ctx.lineTo(pts[pts.length - 1].x, pad.t + ch); ctx.lineTo(pts[0].x, pad.t + ch); ctx.closePath();
        const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + ch);
        grad.addColorStop(0, colors[0] + '59'); grad.addColorStop(1, colors[0] + '08');
        ctx.fillStyle = grad; ctx.fill();
        ctx.strokeStyle = colors[0]; ctx.lineWidth = 2.5;
        ctx.beginPath(); curve(); ctx.stroke();
      } else {
        // LINE = straight segments
        ctx.strokeStyle = colors[0]; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
        ctx.beginPath();
        pts.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
        ctx.stroke();
      }
      pts.forEach((pt, i) => {
        ctx.fillStyle = hov === i ? shade(colors[0], 1.2) : colors[0];
        ctx.beginPath(); ctx.arc(pt.x, pt.y, hov === i ? 6 : 4, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
      });
      ctx.restore();
      ctx.textAlign = 'left';
      return;
    }

    if (kind === 'radar') {
      const cx = W / 2, cy = H / 2 + 6, R = Math.min(W, H) / 2 - 44;
      const n = data.length;
      const ang = (i: number) => -Math.PI / 2 + (i * Math.PI * 2) / n;
      for (let ring = 1; ring <= 3; ring++) {
        ctx.strokeStyle = t.grid;
        ctx.beginPath();
        for (let i = 0; i <= n; i++) {
          const aa = ang(i % n);
          const x = cx + Math.cos(aa) * R * (ring / 3), y = cy + Math.sin(aa) * R * (ring / 3);
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.font = '600 10.5px Outfit, sans-serif';
      for (let i = 0; i < n; i++) {
        const aa = ang(i);
        ctx.strokeStyle = t.grid;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(aa) * R, cy + Math.sin(aa) * R); ctx.stroke();
        ctx.fillStyle = t.axis;
        ctx.textAlign = Math.abs(Math.cos(aa)) < 0.3 ? 'center' : Math.cos(aa) > 0 ? 'left' : 'right';
        ctx.fillText(data[i].label.slice(0, 10), cx + Math.cos(aa) * (R + 12), cy + Math.sin(aa) * (R + 12) + 3);
      }
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const aa = ang(i % n), v = (data[i % n].value / max) * R * p;
        i === 0 ? ctx.moveTo(cx + Math.cos(aa) * v, cy + Math.sin(aa) * v) : ctx.lineTo(cx + Math.cos(aa) * v, cy + Math.sin(aa) * v);
      }
      ctx.closePath();
      ctx.fillStyle = colors[0] + '40'; ctx.fill();
      ctx.strokeStyle = colors[0]; ctx.lineWidth = 2; ctx.stroke();
      for (let i = 0; i < n; i++) {
        const aa = ang(i), v = (data[i].value / max) * R * p;
        ctx.fillStyle = hov === i ? shade(colors[0], 1.25) : colors[0];
        ctx.beginPath(); ctx.arc(cx + Math.cos(aa) * v, cy + Math.sin(aa) * v, hov === i ? 6 : 4, 0, Math.PI * 2); ctx.fill();
      }
      ctx.textAlign = 'left';
      return;
    }

    if (kind === 'polar') {
      const cx = W / 2, cy = H / 2 + 4, R = Math.min(W, H) / 2 - 58;
      for (let ring = 1; ring <= 3; ring++) {
        ctx.strokeStyle = t.grid;
        ctx.beginPath(); ctx.arc(cx, cy, R * (ring / 3), 0, Math.PI * 2); ctx.stroke();
      }
      const n = data.length;
      data.forEach((d, i) => {
        const a0 = -Math.PI / 2 + (i * Math.PI * 2) / n;
        const r = (d.value / max) * R * p;
        ctx.fillStyle = (hov === i ? shade(colors[i], 1.12) : colors[i]) + 'cc';
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, a0, a0 + (Math.PI * 2) / n); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();
      });
      if (p > 0.95) drawLeaders(ctx, cx, cy, R, 1, total, t, W, H, true);
      return;
    }

    /* pie / donut */
    const is3d = effDim === '3d';
    const cx = W / 2, cy = is3d ? H / 2 - 8 : H / 2 + 4;
    const R = Math.min(W, H) / 2 - (is3d ? 60 : 58);
    const rIn = kind === 'donut' ? R * 0.55 : 0;
    const squash = is3d ? K : 1;
    const depth = is3d ? 26 : 0;

    if (is3d) {
      ctx.strokeStyle = t.grid;
      for (let g = 0; g < 5; g++) {
        const y = H * 0.58 + g * 15;
        ctx.beginPath(); ctx.moveTo(W * 0.14 - g * 8, y); ctx.lineTo(W * 0.86 + g * 8, y); ctx.stroke();
      }
    }

    interface Seg { a0: number; a1: number; i: number }
    let a = -Math.PI / 2;
    const segs: Seg[] = data.map((d, i) => {
      const a1 = a + (d.value / total) * Math.PI * 2 * p;
      const s = { a0: a, a1, i };
      a = a1;
      return s;
    });
    const px = (ang: number, r: number) => cx + Math.cos(ang) * r;
    const py = (ang: number, r: number) => cy + Math.sin(ang) * r * squash;
    const liftOf = (s: Seg) => {
      if (hov !== s.i) return { x: 0, y: 0 };
      const mid = (s.a0 + s.a1) / 2;
      const l = depth ? 13 : 9;
      return { x: Math.cos(mid) * l, y: Math.sin(mid) * l * squash };
    };

    if (depth > 0) {
      const faces: { y: number; draw: () => void }[] = [];
      segs.forEach((s) => {
        const lift = liftOf(s);
        const col = colors[s.i];
        const steps = Math.max(3, Math.ceil(((s.a1 - s.a0) / Math.PI) * 32));
        for (let k2 = 0; k2 < steps; k2++) {
          const b0 = s.a0 + ((s.a1 - s.a0) * k2) / steps;
          const b1 = s.a0 + ((s.a1 - s.a0) * (k2 + 1)) / steps;
          const midS = (b0 + b1) / 2;
          if (Math.sin(midS) <= 0) continue;
          faces.push({
            y: py(midS, R) + lift.y,
            draw: () => {
              ctx.fillStyle = shade(col, (0.6 + 0.22 * Math.cos(midS)) * (hov === s.i ? 1.08 : 1));
              ctx.beginPath();
              ctx.moveTo(px(b0, R) + lift.x, py(b0, R) + lift.y);
              ctx.lineTo(px(b1, R) + lift.x, py(b1, R) + lift.y);
              ctx.lineTo(px(b1, R) + lift.x, py(b1, R) + lift.y + depth);
              ctx.lineTo(px(b0, R) + lift.x, py(b0, R) + lift.y + depth);
              ctx.closePath(); ctx.fill();
            },
          });
        }
        if (rIn > 0) {
          for (let k2 = 0; k2 < 24; k2++) {
            const b0 = s.a0 + ((s.a1 - s.a0) * k2) / 24;
            const b1 = s.a0 + ((s.a1 - s.a0) * (k2 + 1)) / 24;
            const midS = (b0 + b1) / 2;
            const back = Math.sin(midS) < 0;
            faces.push({
              y: back ? py(midS, rIn) + lift.y - 900 : py(midS, rIn) + lift.y - 0.5,
              draw: () => {
                ctx.fillStyle = shade(col, back ? 0.52 : 0.44);
                ctx.beginPath();
                ctx.moveTo(px(b0, rIn) + lift.x, py(b0, rIn) + lift.y);
                ctx.lineTo(px(b1, rIn) + lift.x, py(b1, rIn) + lift.y);
                ctx.lineTo(px(b1, rIn) + lift.x, py(b1, rIn) + lift.y + depth);
                ctx.lineTo(px(b0, rIn) + lift.x, py(b0, rIn) + lift.y + depth);
                ctx.closePath(); ctx.fill();
              },
            });
          }
        }
        // solid radial cut faces at slice edges
        ([s.a0, s.a1] as const).forEach((edge) => {
          faces.push({
            y: py(edge, (R + rIn) / 2) + lift.y - 0.25,
            draw: () => {
              ctx.fillStyle = shade(col, 0.72);
              ctx.beginPath();
              if (rIn > 0) {
                ctx.moveTo(px(edge, rIn) + lift.x, py(edge, rIn) + lift.y);
                ctx.lineTo(px(edge, R) + lift.x, py(edge, R) + lift.y);
                ctx.lineTo(px(edge, R) + lift.x, py(edge, R) + lift.y + depth);
                ctx.lineTo(px(edge, rIn) + lift.x, py(edge, rIn) + lift.y + depth);
              } else {
                ctx.moveTo(cx + lift.x, cy + lift.y);
                ctx.lineTo(px(edge, R) + lift.x, py(edge, R) + lift.y);
                ctx.lineTo(px(edge, R) + lift.x, py(edge, R) + lift.y + depth);
                ctx.lineTo(cx + lift.x, cy + lift.y + depth);
              }
              ctx.closePath(); ctx.fill();
            },
          });
        });
      });
      faces.sort((f1, f2) => f1.y - f2.y).forEach((f) => f.draw());
    }

    segs.forEach((s) => {
      const lift = liftOf(s);
      ctx.fillStyle = hov === s.i ? shade(colors[s.i], 1.14) : colors[s.i];
      ctx.beginPath();
      const steps = Math.max(4, Math.ceil(((s.a1 - s.a0) / Math.PI) * 40));
      for (let k2 = 0; k2 <= steps; k2++) {
        const b = s.a0 + ((s.a1 - s.a0) * k2) / steps;
        const x = px(b, R) + lift.x, y = py(b, R) + lift.y;
        k2 === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      if (rIn > 0) for (let k2 = steps; k2 >= 0; k2--) {
        const b = s.a0 + ((s.a1 - s.a0) * k2) / steps;
        ctx.lineTo(px(b, rIn) + lift.x, py(b, rIn) + lift.y);
      } else ctx.lineTo(cx + lift.x, cy + lift.y);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 0.75; ctx.stroke();
    });

    if (p > 0.95) drawLeaders(ctx, cx, cy, R, squash, total, t, W, H);
    if (kind === 'donut' && !is3d) {
      ctx.fillStyle = t.ink;
      ctx.font = '700 16px Fraunces, serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(total), cx, cy + 5);
      ctx.textAlign = 'left';
    }
  }

  function render(hov: number | null) {
    if (!canvas) return;
    const dpr = devicePixelRatio || 1;
    const W = canvas.clientWidth, H = canvas.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paint(ctx, W, H, easeOut(prog), hov);
  }

  // entrance animation — only on data/kind/dim change, never on hover
  $effect(() => {
    void sig; void kind; void effDim; void loading;
    if (loading) return;
    cancelAnimationFrame(raf);
    prog = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      prog = Math.min(1, (now - t0) / 750);
      render(null);
      if (prog < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  });
  $effect(() => { if (prog >= 1) render(hover); });

  function hit(e: MouseEvent) {
    if (!canvas || !data.length) return;
    const r = canvas.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    const W = r.width, H = r.height;
    const total = data.reduce((s, d) => s + d.value, 0) || 1;
    const max = Math.max(...data.map((d) => d.value), 1);
    let idx: number | null = null;

    if (kind === 'pie' || kind === 'donut' || kind === 'polar') {
      const is3d = effDim === '3d' && kind !== 'polar';
      const cx = W / 2, cy = is3d ? H / 2 - 8 : H / 2 + 4;
      const R = Math.min(W, H) / 2 - (is3d ? 60 : 58);
      const rIn = kind === 'donut' ? R * 0.55 : 0;
      const ex = mx - cx, ey = (my - cy) / (is3d ? K : 1);
      const rad = Math.hypot(ex, ey);
      if (rad <= R + 10 && rad >= Math.max(0, rIn - 8)) {
        let ang = Math.atan2(ey, ex) + Math.PI / 2;
        ang = ((ang % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        if (kind === 'polar') {
          idx = Math.min(data.length - 1, Math.floor((ang / (Math.PI * 2)) * data.length));
          if ((data[idx].value / max) * R < rad - 8) idx = null;
        } else {
          let acc = 0;
          for (let i = 0; i < data.length; i++) {
            acc += (data[i].value / total) * Math.PI * 2;
            if (ang <= acc) { idx = i; break; }
          }
        }
      }
    } else if (kind === 'radar') {
      const cx = W / 2, cy = H / 2 + 6, R = Math.min(W, H) / 2 - 44;
      let best = 12;
      data.forEach((d, i) => {
        const aa = -Math.PI / 2 + (i * Math.PI * 2) / data.length;
        const v = (d.value / max) * R;
        const dd = Math.hypot(mx - (cx + Math.cos(aa) * v), my - (cy + Math.sin(aa) * v));
        if (dd < best) { best = dd; idx = i; }
      });
    } else {
      const pad = { l: 46, r: effDim === '3d' ? 34 : 16 };
      const step = (W - pad.l - pad.r) / data.length;
      const i = Math.floor((mx - pad.l) / step);
      if (i >= 0 && i < data.length && mx >= pad.l) idx = i;
    }
    hover = idx;
    tip = idx !== null ? { x: mx, y: my, text: `${data[idx].label}: ${data[idx].value}` } : null;
  }

  /* ---- exports: white bg + title + legend ---- */
  function composeExport(): HTMLCanvasElement {
    const scale = 3;
    const W = canvas!.clientWidth, H = canvas!.clientHeight;
    const legendRows = Math.ceil(data.length / 4);
    const headH = title ? 34 : 10;
    const legH = data.length ? legendRows * 18 + 12 : 8;
    const out = document.createElement('canvas');
    out.width = W * scale; out.height = (headH + H + legH) * scale;
    const ctx = out.getContext('2d')!;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, headH + H + legH);
    if (title) {
      ctx.fillStyle = '#1c2620';
      ctx.font = '700 15px Fraunces, Georgia, serif';
      ctx.fillText(title, 12, 22);
    }
    ctx.save(); ctx.translate(0, headH);
    paint(ctx, W, H, 1, null, true);
    ctx.restore();
    ctx.font = '600 10.5px Outfit, sans-serif';
    data.forEach((d, i) => {
      const col = i % 4, row = Math.floor(i / 4);
      const x = 14 + col * (W / 4), y = headH + H + 14 + row * 18;
      ctx.fillStyle = colors[i];
      ctx.beginPath(); ctx.arc(x, y - 3, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#39443d';
      ctx.fillText(d.label.slice(0, 22), x + 9, y);
    });
    return out;
  }

  function jpegToPdf(jpegBytes: Uint8Array, wPx: number, hPx: number): Blob {
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

  function doExport(fmt: string) {
    exportOpen = false;
    const base = (title || 'chart').toLowerCase().replace(/\s+/g, '-');
    if (fmt === 'csv') {
      downloadBlob(`${base}.csv`, new Blob(['label,value\n' + data.map((d) => `"${d.label}",${d.value}`).join('\n')], { type: 'text/csv' }));
      return;
    }
    if (fmt === 'json') {
      downloadBlob(`${base}.json`, new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      return;
    }
    const out = composeExport();
    if (fmt === 'png') out.toBlob((b) => b && downloadBlob(`${base}.png`, b), 'image/png');
    else if (fmt === 'pdf') {
      const dataUrl = out.toDataURL('image/jpeg', 0.94);
      const bytes = Uint8Array.from(atob(dataUrl.split(',')[1]), (c) => c.charCodeAt(0));
      downloadBlob(`${base}.pdf`, jpegToPdf(bytes, out.width, out.height));
    } else if (fmt === 'print') {
      printHtml(`<html><head><title>${title}</title><style>@page{margin:12mm;}body{margin:0;display:grid;place-items:center;background:#fff;}img{max-width:100%;}</style></head><body><img src="${out.toDataURL('image/png')}"/></body></html>`);
    }
  }
</script>

<svelte:window onmousedown={() => { kindOpen = false; exportOpen = false; }} />

<div class="tk-card wrap">
  <div class="bar">
    {#if title}<b class="title">{title}</b>{/if}
    <div class="tk-inset seg">
      <button class:on={effDim === '2d'} disabled={loading} onclick={() => (dim = '2d')}>2D</button>
      <button class:on={effDim === '3d'} disabled={loading || !meta.has3d} onclick={() => (dim = '3d')}>3D</button>
    </div>
    <div class="menuwrap" role="presentation" onmousedown={(e) => e.stopPropagation()}>
      <button class="tk-btn-ghost mb" onclick={() => (kindOpen = !kindOpen)}>{meta.label} ▾</button>
      {#if kindOpen}
        <div class="tk-pop menu">
          {#each KINDS as k (k.key)}
            <button onclick={() => { kind = k.key; hover = null; tip = null; kindOpen = false; }}>{k.label}</button>
          {/each}
        </div>
      {/if}
    </div>
    <div class="menuwrap" role="presentation" onmousedown={(e) => e.stopPropagation()}>
      <button class="tk-btn-ghost mb" onclick={() => (exportOpen = !exportOpen)}>⤓ Export ▾</button>
      {#if exportOpen}
        <div class="tk-pop menu">
          {#each [['png', 'PNG image'], ['pdf', 'PDF document'], ['print', 'Print…'], ['csv', 'CSV data'], ['json', 'JSON data']] as [k, l] (k)}
            <button onclick={() => doExport(k)}>{l}</button>
          {/each}
        </div>
      {/if}
    </div>
    <button class="tk-btn-ghost mb eye" data-tip="View fullscreen" onclick={() => (full = true)}>👁</button>
  </div>

  <div class="stage" style="height:{height}px">
    {#if loading}
      <div class="loader"><NeuLoader size={54} /></div>
    {:else}
      <canvas bind:this={canvas} class:chart-lift={effDim === '2d'}
        onmousemove={hit} onmouseleave={() => { hover = null; tip = null; }}></canvas>
      {#if tip}
        <div class="tk-pop tipbox" style="left:{Math.min(tip.x + 12, (canvas?.clientWidth || 300) - 110)}px; top:{Math.max(0, tip.y - 34)}px">{tip.text}</div>
      {/if}
    {/if}
  </div>

  <div class="legend">
    {#each data as d, i (d.label)}
      <button class:hl={hover === i} onmouseenter={() => (hover = i)} onmouseleave={() => (hover = null)}>
        <i style="background:{colors[i]}"></i>{d.label}
      </button>
    {/each}
  </div>
</div>

{#if full}
  <div class="fs" role="presentation" onmousedown={(e) => { if (e.target === e.currentTarget) full = false; }}>
    <div class="fsin">
      <button class="tk-btn-ghost fsx" onclick={() => (full = false)}>×</button>
      <svelte:self {data} {title} defaultKind={kind} height={Math.min(560, window.innerHeight - 220)} />
    </div>
  </div>
{/if}

<style>
  .wrap { padding: 16px; }
  .bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 10px; }
  .title { margin-right: auto; font: 600 15px var(--t-font-display); color: var(--t-ink); }
  .seg { display: flex; gap: 2px; padding: 4px; border-radius: 12px; }
  .seg button { padding: 4px 10px; border-radius: 8px; font: 700 11px var(--t-font-body); color: var(--t-muted); }
  .seg button.on { background: var(--t-surface); box-shadow: var(--t-shadow-card); color: var(--t-accent); }
  .seg button:disabled { opacity: 0.3; }
  .menuwrap { position: relative; }
  .mb { padding: 6px 12px; border-radius: 12px; font: 700 12px var(--t-font-body); }
  .mb.eye { font-size: 13px; }
  .menu { position: absolute; right: 0; top: calc(100% + 6px); z-index: 50; min-width: 140px; padding: 6px; }
  .menu button { display: block; width: 100%; text-align: left; padding: 7px 12px; border-radius: 8px;
    font: 600 12.5px var(--t-font-body); color: color-mix(in srgb, var(--t-ink) 80%, transparent); }
  .menu button:hover { background: color-mix(in srgb, var(--t-accent) 8%, transparent); }
  .stage { position: relative; }
  .loader { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
  canvas { width: 100%; height: 100%; }
  .tipbox { position: absolute; z-index: 10; padding: 4px 10px; font: 700 11px var(--t-font-body);
    color: var(--t-ink); pointer-events: none; }
  .legend { display: flex; flex-wrap: wrap; gap: 4px 16px; margin-top: 8px; }
  .legend button { display: inline-flex; align-items: center; gap: 6px;
    font: 600 11px var(--t-font-body); color: var(--t-muted); }
  .legend button.hl { color: var(--t-ink); }
  .legend i { width: 10px; height: 10px; border-radius: 999px; }
  .fs { position: fixed; inset: 0; z-index: 90; display: flex; align-items: center; justify-content: center;
    background: rgba(0,0,0,0.5); backdrop-filter: blur(3px); padding: 16px; }
  .fsin { width: min(1000px, 100%); }
  .fsx { display: block; margin: 0 0 8px auto; width: 34px; height: 34px; border-radius: 999px; font-size: 17px; }
</style>
