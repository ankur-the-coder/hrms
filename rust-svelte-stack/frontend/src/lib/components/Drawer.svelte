<script lang="ts">
  import type { Snippet } from 'svelte';
  let { open = $bindable(false), title = '', width = 440, children }: {
    open?: boolean; title?: string; width?: number; children: Snippet;
  } = $props();

  function onKey(e: KeyboardEvent) { if (e.key === 'Escape') open = false; }
</script>

<svelte:window onkeydown={open ? onKey : undefined} />

{#if open}
  <div class="backdrop" role="presentation" onmousedown={(e) => { if (e.target === e.currentTarget) open = false; }}>
    <div class="tk-pop panel" style="width:min({width}px, 94vw)">
      <div class="head">
        <h2>{title}</h2>
        <button onclick={() => (open = false)}>×</button>
      </div>
      <div class="body">{@render children()}</div>
    </div>
  </div>
{/if}

<style>
  .backdrop { position: fixed; inset: 0; z-index: 50; background: rgba(0,0,0,0.4); backdrop-filter: blur(2px); }
  .panel { position: absolute; top: 0; right: 0; bottom: 0; overflow-y: auto;
    border-radius: var(--t-radius-lg) 0 0 var(--t-radius-lg);
    animation: slide-in 0.3s cubic-bezier(0.22,1,0.36,1) both; }
  @keyframes slide-in { from { transform: translateX(100%); } }
  .head { position: sticky; top: 0; z-index: 5; display: flex; justify-content: space-between;
    align-items: center; padding: 16px 20px; background: color-mix(in srgb, var(--t-surface) 95%, transparent);
    backdrop-filter: blur(6px); border-bottom: 1px solid color-mix(in srgb, var(--t-ink) 8%, transparent); }
  .head h2 { margin: 0; font: 600 16px var(--t-font-display); color: var(--t-ink); }
  .head button { font-size: 20px; color: var(--t-muted); padding: 4px 8px; }
  .body { padding: 16px 20px; }
</style>
