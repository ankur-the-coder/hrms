<script lang="ts">
  let { label = '', size = 64 } = $props();
</script>

<div class="wrap">
  <div class="tk-neuloader" style="width:{size}px;height:{size}px"></div>
  {#if label}<p>{label}</p>{/if}
</div>

<style>
  .wrap { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; padding: 56px 0; }
  p { font: 500 14px var(--t-font-body); color: var(--t-muted); margin: 0; }
</style>
