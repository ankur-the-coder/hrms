<script lang="ts">
  // Mirror of React src/shared/pickers/DatePicker.tsx — inline calendar
  // popover (desktop) / bottom sheet (mobile handled by shared CSS class).
  let { value = $bindable(''), placeholder = 'Pick a date' } = $props();
  let open = $state(false);
  let month = $state(value ? new Date(value) : new Date());

  const dstr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const days = $derived(new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate());
  const firstDow = $derived(new Date(month.getFullYear(), month.getMonth(), 1).getDay());
</script>

<div class="root">
  <button class="tk-input field" onclick={() => (open = !open)}>
    {value || placeholder} <span>📅</span>
  </button>
  {#if open}
    <div class="tk-pop panel">
      <div class="nav">
        <button onclick={() => (month = new Date(month.getFullYear(), month.getMonth() - 1))}>‹</button>
        <b>{month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</b>
        <button onclick={() => (month = new Date(month.getFullYear(), month.getMonth() + 1))}>›</button>
      </div>
      <div class="grid">
        {#each ['Su','Mo','Tu','We','Th','Fr','Sa'] as d}<span class="dow">{d}</span>{/each}
        {#each Array(firstDow) as _}<span></span>{/each}
        {#each Array(days) as _, i}
          {@const v = dstr(new Date(month.getFullYear(), month.getMonth(), i + 1))}
          <button class="day" class:sel={v === value} onclick={() => { value = v; open = false; }}>{i + 1}</button>
        {/each}
      </div>
      <div class="foot">
        <button onclick={() => { value = dstr(new Date()); open = false; }}>Today</button>
        <button onclick={() => { value = ''; open = false; }}>Clear</button>
      </div>
    </div>
  {/if}
</div>

<style>
  .root { position: relative; }
  .field { display: flex; justify-content: space-between; width: 100%; padding: 9px 14px;
    font: 500 14px var(--t-font-body); color: var(--t-ink); }
  .panel { position: absolute; top: calc(100% + 6px); width: 280px; padding: 12px; z-index: 60; }
  .nav { display: flex; justify-content: space-between; align-items: center;
    font: 700 14px var(--t-font-display); color: var(--t-ink); margin-bottom: 8px; }
  .grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
  .dow { font: 700 10px var(--t-font-body); text-transform: uppercase; color: var(--t-muted); text-align: center; }
  .day { height: 32px; border-radius: 8px; font: 500 12.5px var(--t-font-body); color: var(--t-ink); }
  .day:hover { background: color-mix(in srgb, var(--t-accent) 8%, transparent); }
  .day.sel { background: var(--t-accent); color: #fff; font-weight: 700; }
  .foot { display: flex; justify-content: space-between; margin-top: 8px;
    font: 700 12px var(--t-font-body); }
  .foot button:first-child { color: var(--t-accent); }
  .foot button:last-child { color: var(--t-muted); }
</style>
