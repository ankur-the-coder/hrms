<script lang="ts">
  // Mirror of React src/shared/Select.tsx — single & multi with search,
  // chips, clear, flip-aware panel.
  export interface Option { value: string; label: string }
  let {
    options = [] as Option[],
    multi = false,
    value = $bindable(null as string | null),
    values = $bindable([] as string[]),
    placeholder = 'Select…',
  } = $props();

  let open = $state(false);
  let q = $state('');
  let openUp = $state(false);
  let root: HTMLDivElement;

  const filtered = $derived(options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase())));
  const selected = $derived(multi ? values : value ? [value] : []);

  function toggleOpen() {
    const r = root.getBoundingClientRect();
    openUp = window.innerHeight - r.bottom < 300 && r.top > 300;
    open = !open;
    q = '';
  }
  function pick(v: string) {
    if (multi) values = values.includes(v) ? values.filter((x) => x !== v) : [...values, v];
    else { value = value === v ? null : v; open = false; }
  }
</script>

<svelte:window onmousedown={(e) => { if (open && root && !root.contains(e.target as Node)) open = false; }} />

<div class="root" bind:this={root}>
  <button class="tk-input field" onclick={toggleOpen}>
    {#if selected.length === 0}<span class="ph">{placeholder}</span>
    {:else if multi}
      {#each selected as v}
        <span class="tk-chip chip">{options.find((o) => o.value === v)?.label ?? v}
          <button onclick={(e) => { e.stopPropagation(); pick(v); }}>×</button></span>
      {/each}
    {:else}{options.find((o) => o.value === selected[0])?.label}{/if}
    <span class="caret" class:up={open}>▾</span>
  </button>

  {#if open}
    <div class="tk-pop panel" class:openUp>
      <input class="tk-input" placeholder="Search…" bind:value={q} />
      <div class="list">
        {#each filtered as o}
          <button class="opt" class:on={selected.includes(o.value)} onclick={() => pick(o.value)}>
            {o.label}{selected.includes(o.value) ? ' ✓' : ''}
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .root { position: relative; }
  .field { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; width: 100%;
    padding: 9px 14px; font: 500 14px var(--t-font-body); color: var(--t-ink); text-align: left; }
  .ph { color: var(--t-muted); }
  .chip { padding: 2px 8px; font: 700 11.5px var(--t-font-body); }
  .caret { margin-left: auto; color: var(--t-muted); transition: transform 0.15s; }
  .caret.up { transform: rotate(180deg); }
  .panel { position: absolute; left: 0; top: calc(100% + 6px); width: 260px; padding: 10px; z-index: 60; }
  .panel.openUp { top: auto; bottom: calc(100% + 6px); }
  .panel input { width: 100%; padding: 7px 10px; margin-bottom: 8px; font-size: 13px; }
  .list { max-height: 220px; overflow-y: auto; }
  .opt { display: block; width: 100%; text-align: left; padding: 8px 10px; border-radius: 8px;
    font: 500 13px var(--t-font-body); color: var(--t-ink); }
  .opt:hover { background: color-mix(in srgb, var(--t-accent) 8%, transparent); }
  .opt.on { color: var(--t-accent); font-weight: 700; }
</style>
