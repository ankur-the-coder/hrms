<script lang="ts">
  // Multi-series stacked vertical columns — mirrors React StackedColumns.
  export interface Series { name: string; color?: string; values: number[] }
  let { title = '', categories = [] as string[], series = [] as Series[], height = 300, yLabel = 'Employees', insight = [] as string[] } = $props();

  const PALETTE = ['#0d7a54', '#c9932b', '#0ea5e9', '#a855f7', '#e11d63', '#f97316', '#14b8a6', '#6366f1'];
  let canvas: HTMLCanvasElement | undefined = $state();
  let hover: { c: number; s: number } | null = $state(null);
  let tip: { x: number; y: number; text: string } | null = $state(null);
  let prog = 0, raf = 0;

  const colors = $derived(series.map((s, i) => s.color || PALETTE[i % PALETTE.length]));
  const totals = $derived(categories.map((_, c) => series.reduce((s, sr) => s + (sr.values[c] || 0), 0)));
  const max = $derived(Math.max(...totals, 1));
  const sig = $derived(JSON.stringify(series.map((s) => s.values)) + categories.join());

  const shade = (hex: string, f: number) => {
    const n = parseInt(hex.slice(1), 16);
    const c = (v: number) => Math.min(255, Math.max(0, Math.round(v * f)));
    return `rgb(${c((n >> 16) & 255)},${c((n >> 8) & 255)},${c(n & 255)})`;
  };
  const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

  function ink() {
    return getComputedStyle(document.documentElement).getPropertyValue('--t-ink').trim() || '#101914';
  }

  function render(p: number, hov: { c: number; s: number } | null) {
    if (!canvas) return;
    const dpr = devicePixelRatio || 1;
    const W = canvas.clientWidth, H = canvas.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const axis = ink(), grid = 'rgba(128,128,128,0.18)';
    const pad = { l: 46, r: 14, t: 16, b: 34 };
    const cw = W - pad.l - pad.r, ch = H - pad.t - pad.b;
    ctx.font = '600 10.5px Outfit, sans-serif';
    for (let g = 0; g <= 4; g++) {
      const y = pad.t + ch - (ch * g) / 4;
      ctx.strokeStyle = grid;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
      ctx.fillStyle = axis; ctx.textAlign = 'right';
      ctx.fillText(String(Math.round((max * g) / 4)), pad.l - 7, y + 3.5);
    }
    ctx.strokeStyle = axis; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(pad.l, pad.t - 4); ctx.lineTo(pad.l, pad.t + ch); ctx.lineTo(W - pad.r, pad.t + ch); ctx.stroke();
    ctx.lineWidth = 1;
    ctx.save(); ctx.translate(11, pad.t + ch / 2); ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center'; ctx.fillStyle = axis; ctx.fillText(yLabel, 0, 0); ctx.restore();
    const step = cw / categories.length;
    ctx.textAlign = 'center';
    categories.forEach((c, i) => {
      ctx.fillStyle = axis;
      ctx.fillText(c.slice(0, 10), pad.l + step * i + step / 2, H - 12);
    });
    categories.forEach((_, ci) => {
      const bw = Math.min(44, step * 0.55);
      const x = pad.l + step * ci + (step - bw) / 2;
      let acc = 0;
      series.forEach((sr, si) => {
        const v = sr.values[ci] || 0;
        if (v <= 0) return;
        const h = (v / max) * ch * p;
        const yTop = pad.t + ch - ((acc / max) * ch * p) - h;
        const on = hov && hov.c === ci && hov.s === si;
        ctx.fillStyle = on ? shade(colors[si], 1.18) : colors[si];
        ctx.beginPath();
        ctx.roundRect(x, yTop, bw, Math.max(1, h - 1), 2);
        ctx.fill();
        acc += v;
      });
    });
  }

  $effect(() => {
    void sig;
    cancelAnimationFrame(raf);
    prog = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      prog = Math.min(1, (now - t0) / 750);
      render(easeOut(prog), null);
      if (prog < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  });
  $effect(() => { if (prog >= 1) render(1, hover); });

  function hit(e: MouseEvent) {
    if (!canvas) return;
    const r = canvas.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    const pad = { l: 46, r: 14, t: 16, b: 34 };
    const cw = r.width - pad.l - pad.r, ch = r.height - pad.t - pad.b;
    const step = cw / categories.length;
    const ci = Math.floor((mx - pad.l) / step);
    if (ci < 0 || ci >= categories.length || mx < pad.l) { hover = null; tip = null; return; }
    const yVal = ((pad.t + ch - my) / ch) * max;
    let acc = 0, si: number | null = null;
    for (let s = 0; s < series.length; s++) {
      acc += series[s].values[ci] || 0;
      if (yVal <= acc) { si = s; break; }
    }
    if (si === null || yVal > totals[ci]) { hover = null; tip = null; return; }
    hover = { c: ci, s: si };
    tip = { x: mx, y: my, text: `${categories[ci]} · ${series[si].name}: ${series[si].values[ci] || 0} (total ${totals[ci]})` };
  }
</script>

<div class="tk-card wrap">
  {#if title}<p class="title">{title}</p>{/if}
  <div class="stage" style="height:{height}px">
    <canvas bind:this={canvas} class="chart-lift"
      onmousemove={hit} onmouseleave={() => { hover = null; tip = null; }}></canvas>
    {#if tip}
      <div class="tk-pop tipbox" style="left:{Math.min(tip.x + 12, (canvas?.clientWidth || 300) - 170)}px; top:{Math.max(0, tip.y - 34)}px">{tip.text}</div>
    {/if}
  </div>
  <div class="legend">
    {#each series as s, i (s.name)}
      <span><i style="background:{colors[i]}"></i>{s.name}</span>
    {/each}
  </div>
  {#if insight.length}
    <div class="tk-inset insights">
      {#each insight as line}<p>• {line}</p>{/each}
    </div>
  {/if}
</div>

<style>
  .wrap { padding: 16px; }
  .title { margin: 0 0 12px; font: 600 15px var(--t-font-display); color: var(--t-ink); }
  .stage { position: relative; }
  canvas { width: 100%; height: 100%; }
  .tipbox { position: absolute; z-index: 10; padding: 4px 10px; font: 700 11px var(--t-font-body);
    color: var(--t-ink); pointer-events: none; }
  .legend { display: flex; flex-wrap: wrap; gap: 6px 16px; margin-top: 8px; }
  .legend span { display: inline-flex; align-items: center; gap: 6px;
    font: 600 11px var(--t-font-body); color: var(--t-muted); }
  .legend i { width: 10px; height: 10px; border-radius: 999px; }
  .insights { margin-top: 12px; padding: 10px 14px; border-radius: 12px; }
  .insights p { margin: 2px 0; font: 500 11.5px var(--t-font-body); color: color-mix(in srgb, var(--t-ink) 70%, transparent); }
</style>
