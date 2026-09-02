<script lang="ts">
  import type { Snippet } from 'svelte';
  let { open = $bindable(false), title = '', wide = false, children }: {
    open?: boolean; title?: string; wide?: boolean; children: Snippet;
  } = $props();

  function onKey(e: KeyboardEvent) { if (e.key === 'Escape') open = false; }
</script>

<svelte:window onkeydown={open ? onKey : undefined} />

{#if open}
  <div class="backdrop" role="presentation" onmousedown={(e) => { if (e.target === e.currentTarget) open = false; }}>
    <div class="tk-pop panel" class:wide>
      <div class="head">
        <h2>{title}</h2>
        <button onclick={() => (open = false)}>×</button>
      </div>
      <div class="body">{@render children()}</div>
    </div>
  </div>
{/if}

<style>
  .backdrop { position: fixed; inset: 0; z-index: 50; display: flex; align-items: center;
    justify-content: center; background: rgba(0,0,0,0.4); backdrop-filter: blur(3px); padding: 20px; }
  .panel { width: 100%; max-width: 480px; max-height: 92vh; overflow-y: auto;
    animation: tk-pop-in 0.2s cubic-bezier(0.22,1,0.36,1) both; }
  .panel.wide { max-width: 660px; }
  .head { position: sticky; top: 0; z-index: 5; display: flex; justify-content: space-between;
    align-items: center; padding: 16px 22px; background: color-mix(in srgb, var(--t-surface) 95%, transparent);
    backdrop-filter: blur(6px); border-bottom: 1px solid color-mix(in srgb, var(--t-ink) 8%, transparent); }
  .head h2 { margin: 0; font: 600 17px var(--t-font-display); color: var(--t-ink); }
  .head button { font-size: 20px; color: var(--t-muted); line-height: 1; padding: 4px 8px; border-radius: 999px; }
  .head button:hover { color: var(--t-ink); }
  .body { padding: 18px 22px; }
</style>
