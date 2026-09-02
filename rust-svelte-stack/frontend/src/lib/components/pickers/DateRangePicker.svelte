<script lang="ts">
  // Mirror of React src/shared/pickers/DateRangePicker.tsx — recessed display
  // slot, preset tabs, dual fixed-height (42-cell) calendars, trench range
  // with hover preview, raised start/end badges, Clear + Submit commit flow.
  export interface DateRange { start: string; end: string }
  let { value = $bindable({ start: '', end: '' } as DateRange) } = $props();

  let open = $state(false);
  let month = $state(value.start ? new Date(value.start) : new Date());
  let draft = $state({ ...value });
  let hover: string | null = $state(null);

  const dstr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const PRESETS = [7, 15, 30, 45];

  const eff = $derived.by((): DateRange => {
    if (draft.start && draft.end) return draft;
    if (draft.start && hover) return hover < draft.start ? { start: hover, end: draft.start } : { start: draft.start, end: hover };
    return draft;
  });

  function pick(v: string) {
    if (!draft.start || (draft.start && draft.end)) draft = { start: v, end: '' };
    else if (v < draft.start) draft = { start: v, end: draft.start };
    else draft = { start: draft.start, end: v };
    hover = null;
  }
  function preset(days: number) {
    draft = { start: dstr(new Date(Date.now() - (days - 1) * 864e5)), end: dstr(new Date()) };
    month = new Date(draft.start);
  }
  function cells(base: Date) {
    const y = base.getFullYear(), m = base.getMonth();
    const firstDow = new Date(y, m, 1).getDay();
    const days = new Date(y, m + 1, 0).getDate();
    return Array.from({ length: 42 }, (_, i) => {
      const d = i - firstDow + 1;
      return d >= 1 && d <= days ? { d, v: dstr(new Date(y, m, d)) } : null;
    });
  }
  const month2 = $derived(new Date(month.getFullYear(), month.getMonth() + 1, 1));
</script>

{#snippet pane(base: Date, side: 'left' | 'right')}
  <div class="pane">
    <div class="nav">
      {#if side === 'left'}<button class="cal-nav" onclick={() => (month = new Date(month.getFullYear(), month.getMonth() - 1))}>‹</button>{:else}<span class="sp"></span>{/if}
      <b class="title">{base.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</b>
      {#if side === 'right'}<button class="cal-nav" onclick={() => (month = new Date(month.getFullYear(), month.getMonth() + 1))}>›</button>{:else}<span class="sp"></span>{/if}
    </div>
    <div class="grid" onmouseleave={() => (hover = null)}>
      {#each ['Su','Mo','Tu','We','Th','Fr','Sa'] as d}<span class="dow">{d}</span>{/each}
      {#each cells(base) as c, i (i)}
        {#if !c}<span class="day muted"></span>
        {:else}
          {@const isStart = eff.start === c.v}
          {@const isEnd = eff.end === c.v}
          {@const inR = !!(eff.start && eff.end && c.v > eff.start && c.v < eff.end)}
          <button class="day" class:trench={inR || isStart || isEnd} class:capl={isStart} class:capr={isEnd}
            onmouseenter={() => (hover = c.v)} onclick={() => pick(c.v)}>
            {#if isStart || isEnd}<span class="badge">{c.d}</span>{:else}{c.d}{/if}
          </button>
        {/if}
      {/each}
    </div>
  </div>
{/snippet}

<div class="root">
  <button class="tk-input field" onclick={() => { draft = { ...value }; open = !open; }}>
    {value.start && value.end ? `${value.start} → ${value.end}` : 'Pick a range'} <span>⧉</span>
  </button>
  {#if open}
    <div class="tk-pop panel">
      <div class="tk-inset display">
        <span class:ph={!eff.start}>{eff.start || 'Start Date'}</span>
        <span class="arrow">→</span>
        <span class:ph={!eff.end}>{eff.end || 'End Date'}</span>
      </div>
      <div class="presets">
        {#each PRESETS as p}<button class="cal-preset" onclick={() => preset(p)}>Last {p} Days</button>{/each}
      </div>
      <div class="cals">
        {@render pane(month, 'left')}
        {@render pane(month2, 'right')}
      </div>
      <div class="actions">
        <button class="cal-clear" onclick={() => { draft = { start: '', end: '' }; hover = null; }}>Clear</button>
        <button class="cal-submit" disabled={!!draft.start && !draft.end}
          onclick={() => { value = draft.end ? draft : { start: '', end: '' }; open = false; }}>Submit</button>
      </div>
    </div>
  {/if}
</div>

<style>
  .root { position: relative; }
  .field { display: flex; justify-content: space-between; width: 100%; padding: 9px 14px;
    font: 500 14px var(--t-font-body); color: var(--t-ink); }
  .panel { position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%);
    width: min(700px, calc(100vw - 24px)); padding: 18px; z-index: 60; }
  .display { display: flex; justify-content: space-between; align-items: center;
    padding: 12px 18px; border-radius: 16px; margin-bottom: 12px;
    font: 600 13px var(--t-font-body); color: var(--t-ink); }
  .display .ph { opacity: 0.5; font-weight: 400; }
  .arrow { color: var(--t-accent); font-weight: 700; }
  .presets { display: flex; gap: 10px; margin-bottom: 14px; }
  .cal-preset { flex: 1; padding: 9px; border-radius: 13px; background: var(--t-surface);
    box-shadow: var(--t-shadow-card); font: 600 12px var(--t-font-body); color: var(--t-ink); }
  .cal-preset:active { box-shadow: var(--t-inset); color: var(--t-accent); }
  .cals { display: flex; gap: 26px; }
  .pane { flex: 1; }
  .nav { display: flex; justify-content: space-between; align-items: center; height: 36px; margin-bottom: 10px; }
  .title { min-width: 148px; text-align: center; font: 600 14px var(--t-font-body); color: var(--t-ink); }
  .sp { width: 34px; }
  .cal-nav { width: 34px; height: 34px; border-radius: 50%; background: var(--t-surface);
    box-shadow: var(--t-shadow-card); color: var(--t-accent); font-size: 16px; }
  .cal-nav:active { box-shadow: var(--t-inset); }
  .grid { display: grid; grid-template-columns: repeat(7, 1fr); row-gap: 6px; }
  .dow { text-align: center; font: 700 10px var(--t-font-body); text-transform: uppercase; color: var(--t-muted); padding-bottom: 4px; }
  .day { height: 38px; display: flex; align-items: center; justify-content: center;
    font: 500 12.5px var(--t-font-body); color: var(--t-ink); position: relative; }
  .day.muted { pointer-events: none; }
  .day:hover:not(.trench) { background: var(--t-surface); box-shadow: var(--t-shadow-card); border-radius: 50%; z-index: 2; }
  .day.trench { background: var(--t-surface);
    box-shadow: inset 0 4px 5px var(--neu-dark, rgba(0,0,0,0.14)), inset 0 -4px 5px var(--neu-light, rgba(255,255,255,0.75)); }
  .day.capl { border-radius: 20px 0 0 20px; }
  .day.capr { border-radius: 0 20px 20px 0; }
  .day.capl.capr { border-radius: 20px; }
  .badge { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
    background: var(--t-accent); color: #fff; font-weight: 600;
    box-shadow: 3px 3px 7px color-mix(in srgb, var(--t-accent-deep) 55%, transparent), -2px -2px 5px rgba(255,255,255,0.65); }
  .actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 16px; }
  .cal-clear { padding: 10px 22px; border-radius: 13px; background: var(--t-surface);
    box-shadow: var(--t-shadow-card); font: 600 13px var(--t-font-body); color: var(--t-ink); }
  .cal-submit { padding: 10px 26px; border-radius: 13px; background: var(--t-accent); color: #fff;
    font: 700 13px var(--t-font-body);
    box-shadow: 3px 3px 7px color-mix(in srgb, var(--t-accent-deep) 50%, transparent); }
  .cal-submit:disabled { opacity: 0.5; }
  @media (max-width: 720px) { .cals { flex-direction: column; } .pane:last-child { display: none; } }
</style>
