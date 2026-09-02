<script lang="ts">
  // Month + Month-Range picker — trench selection, square hover cells,
  // hover range preview, Submit/Clear commit flow. `range` prop switches modes.
  import { MONTHS, MONTHS_SHORT } from '$lib/api';

  let {
    value = $bindable(''),                              // single: 'YYYY-MM'
    rangeValue = $bindable({ start: '', end: '' }),     // range mode
    range = false,
    placeholder = 'Pick a month',
  } = $props();

  let open = $state(false);
  let year = $state(new Date().getFullYear());
  let draft = $state({ start: '', end: '' });
  let hover: string | null = $state(null);

  const mval = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, '0')}`;
  const pretty = (v: string) => {
    if (!v) return '';
    const [y, m] = v.split('-').map(Number);
    return `${MONTHS_SHORT[m - 1]} ${y}`;
  };
  const display = $derived(range
    ? (rangeValue.start && rangeValue.end ? `${pretty(rangeValue.start)} → ${pretty(rangeValue.end)}` : '')
    : value ? `${MONTHS[+value.split('-')[1] - 1]} ${value.split('-')[0]}` : '');

  const eff = $derived.by(() => {
    if (!range) return { start: value, end: value };
    if (draft.start && draft.end) return draft;
    if (draft.start && hover) return hover < draft.start ? { start: hover, end: draft.start } : { start: draft.start, end: hover };
    return draft;
  });

  function toggle() {
    open = !open;
    if (open) {
      draft = { ...rangeValue };
      hover = null;
      const src = range ? rangeValue.start : value;
      if (src) year = +src.split('-')[0];
    }
  }
  function pick(v: string) {
    if (!range) { value = v; open = false; return; }
    if (!draft.start || (draft.start && draft.end)) draft = { start: v, end: '' };
    else if (v < draft.start) draft = { start: v, end: draft.start };
    else draft = { start: draft.start, end: v };
    hover = null;
  }
  function submit() {
    rangeValue = draft.end ? { ...draft } : { start: '', end: '' };
    open = false;
  }
</script>

<div class="root">
  <button class="tk-input field" onclick={toggle}>
    <span class:ph={!display}>{display || placeholder}</span><span class="ico">☷</span>
  </button>
  {#if open}
    <div class="tk-pop panel">
      <div class="nav">
        <button class="cal-nav" onclick={() => year--}>‹</button>
        <select class="tk-input ysel" bind:value={year}>
          {#each Array.from({ length: 14 }, (_, i) => new Date().getFullYear() - 10 + i) as y}<option value={y}>{y}</option>{/each}
        </select>
        <button class="cal-nav" onclick={() => year++}>›</button>
      </div>
      <div class="grid" role="grid" onmouseleave={() => (hover = null)}>
        {#each MONTHS_SHORT as mo, i (mo)}
          {@const v = mval(year, i)}
          {@const isStart = !!eff.start && v === eff.start}
          {@const isEnd = !!eff.end && v === eff.end}
          {@const inR = !!(eff.start && eff.end && v > eff.start && v < eff.end)}
          {@const col = i % 3}
          <button
            class="cal-day sq interactive"
            class:in-trench={inR || isStart || isEnd}
            class:trench-l={isStart || ((inR || isStart || isEnd) && col === 0)}
            class:trench-r={isEnd || ((inR || isStart || isEnd) && col === 2)}
            class:has-badge={isStart || isEnd}
            style="height:44px"
            onmouseenter={() => range && (hover = v)}
            onclick={() => pick(v)}>
            {#if isStart || isEnd}
              <span class="cal-badge sqb">{mo}</span>
            {:else}
              <span class="cal-inner"><span class="molbl">{mo}</span></span>
            {/if}
          </button>
        {/each}
      </div>
      <div class="foot">
        {#if range}
          <p class="hint">{!draft.start ? 'Pick start' : !draft.end ? 'Pick end' : `${pretty(draft.start)} → ${pretty(draft.end)}`}</p>
          <div class="btns">
            <button class="cal-clear sm" onclick={() => { draft = { start: '', end: '' }; hover = null; }}>Clear</button>
            <button class="cal-submit sm" disabled={!!draft.start && !draft.end} onclick={submit}>Submit</button>
          </div>
        {:else}
          <span></span>
          <button class="cal-clear sm" onclick={() => { value = ''; open = false; }}>Clear</button>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .root { position: relative; }
  .field { display: flex; justify-content: space-between; align-items: center; width: 100%;
    padding: 9px 14px; font: 500 13.5px var(--t-font-body); color: var(--t-ink); }
  .ph { color: var(--t-muted); }
  .ico { color: var(--t-muted); }
  .panel { position: absolute; top: calc(100% + 6px); left: 0; width: 252px; padding: 12px; z-index: 60; }
  .nav { display: flex; justify-content: space-between; align-items: center; height: 36px; margin-bottom: 10px; }
  .ysel { padding: 6px 10px; font: 700 12.5px var(--t-font-body); border-radius: 10px; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); row-gap: 6px; }
  .molbl { font: 600 12.5px var(--t-font-body); }
  .sqb { width: 52px !important; height: 34px !important; border-radius: 10px !important; font-size: 12px; }
  .foot { display: flex; justify-content: space-between; align-items: center; gap: 8px;
    margin-top: 10px; padding-top: 10px; border-top: 1px solid color-mix(in srgb, var(--t-ink) 8%, transparent); }
  .hint { margin: 0; font: 500 11px var(--t-font-body); color: var(--t-muted); }
  .btns { display: flex; gap: 8px; }
  .sm { padding: 6px 14px !important; font-size: 12px !important; }
</style>
