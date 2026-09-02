<script lang="ts">
  // Reference-style neumorphic donut — extruded puck, inset groove ring,
  // thick rounded arcs, on-slice % labels, raised center total, side legend.
  export interface Datum { label: string; value: number; color?: string }
  let { data = [] as Datum[], title = '', size = 132, centerLabel = 'total', legendSide = true } = $props();

  const PALETTE = ['#0d7a54', '#c9932b', '#0ea5e9', '#a855f7', '#e11d63', '#f97316', '#14b8a6', '#6366f1'];
  const total = $derived(data.reduce((s, d) => s + d.value, 0) || 1);
  const R = $derived(size / 2 - 17);
  const C = $derived(2 * Math.PI * R);
  const arcs = $derived.by(() => {
    let acc = 0;
    return data.map((d, i) => {
      const frac = d.value / total;
      const startAcc = acc;
      acc += frac;
      return { d, i, frac, offset: -C * startAcc, mid: (startAcc + frac / 2) * Math.PI * 2 - Math.PI / 2 };
    });
  });
  const colorOf = (d: Datum, i: number) => d.color || PALETTE[i % PALETTE.length];
</script>

<div class="tk-card wrap">
  {#if title}<p class="title">{title}</p>{/if}
  <div class="content" class:side={legendSide}>
    <div class="tk-raise-sm puck" style="width:{size + 20}px;height:{size + 20}px">
      <div class="tk-inset groove"></div>
      <svg width={size} height={size} style="transform:rotate(-90deg)">
        <circle cx={size / 2} cy={size / 2} r={R} fill="none" stroke-width="13"
          stroke="color-mix(in srgb, var(--t-ink) 7%, transparent)" />
        {#each arcs as a (a.d.label)}
          <circle cx={size / 2} cy={size / 2} r={R} fill="none" stroke-width="13"
            stroke={colorOf(a.d, a.i)}
            stroke-dasharray="{Math.max(0, C * a.frac - 2.5)} {C - C * a.frac + 2.5}"
            stroke-dashoffset={a.offset} stroke-linecap="round"
            style="transition: stroke-dasharray 0.8s cubic-bezier(0.4,0,0.2,1); filter: drop-shadow(0 1.5px 2px rgba(0,0,0,0.22))" />
        {/each}
      </svg>
      <div class="tk-raise-sm center" style="inset:{size * 0.26 + 10}px">
        <b>{total}</b>
        <small>{centerLabel}</small>
      </div>
      {#each arcs.filter((a) => a.frac >= 0.09) as a (a.d.label)}
        <span class="pct" style="left:{10 + size / 2 + Math.cos(a.mid) * R - 9}px; top:{10 + size / 2 + Math.sin(a.mid) * R - 5}px">
          {Math.round(a.frac * 100)}%
        </span>
      {/each}
    </div>
    <div class="legend" class:sideL={legendSide}>
      {#each data as d, i (d.label)}
        <div class="lrow">
          <span class="lname"><i style="background:{colorOf(d, i)}"></i><em>{d.label}</em></span>
          <span class="lval">{d.value} · {Math.round((d.value / total) * 100)}%</span>
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .wrap { padding: 16px; }
  .title { margin: 0 0 12px; font: 600 14px var(--t-font-display); color: var(--t-ink); }
  .content { display: flex; flex-direction: column; align-items: center; gap: 12px; }
  .content.side { flex-direction: row; align-items: center; gap: 16px; }
  .puck { position: relative; flex-shrink: 0; border-radius: 999px; padding: 10px; }
  .groove { position: absolute; inset: 10px; border-radius: 999px; }
  svg { position: relative; }
  .center { position: absolute; display: flex; flex-direction: column; align-items: center;
    justify-content: center; border-radius: 999px; }
  .center b { font: 700 19px var(--t-font-display); color: var(--t-ink); line-height: 1; }
  .center small { margin-top: 2px; font: 700 8.5px var(--t-font-body); text-transform: uppercase;
    letter-spacing: 0.08em; color: var(--t-muted); }
  .pct { position: absolute; pointer-events: none; font: 700 8.5px var(--t-font-body);
    color: #fff; text-shadow: 0 1px 1px rgba(0,0,0,0.4); }
  .legend { width: 100%; }
  .legend.sideL { flex: 1; min-width: 0; }
  .lrow { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 2.5px 0; }
  .lname { display: inline-flex; align-items: center; gap: 6px; min-width: 0; }
  .lname i { width: 8px; height: 8px; border-radius: 999px; flex-shrink: 0; }
  .lname em { font: 600 11px var(--t-font-body); font-style: normal; color: var(--t-muted);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .lval { font: 600 11px var(--t-font-body); color: color-mix(in srgb, var(--t-ink) 70%, transparent);
    font-variant-numeric: tabular-nums; flex-shrink: 0; }
</style>
