<script lang="ts">
  // App sidebar — logo + module navigation (Organization group with
  // Dashboard and Org Structure children). Mirrors React Layout sidebar.
  import { page } from '$app/state';
  import { goto } from '$app/navigation';

  let { onNavigate = () => {} } = $props();

  const NAV = [
    { to: '/home', label: 'Home', icon: '⌂' },
    {
      label: 'Organization', icon: '▦', defaultTo: '/organization/dashboard/summary',
      children: [
        { to: '/organization/dashboard/summary', label: 'Dashboard', match: '/organization/dashboard' },
        { to: '/organization/structure/legal-entities', label: 'Org Structure', match: '/organization/structure' },
      ],
    },
    { to: '/playground', label: 'Components', icon: '▣' },
  ];

  let openGroups = $state(new Set(['Organization']));
  const path = $derived(page.url.pathname);

  function go(to: string) { goto(to); onNavigate(); }
  function toggleGroup(label: string) {
    const n = new Set(openGroups);
    n.has(label) ? n.delete(label) : n.add(label);
    openGroups = n;
  }
</script>

<aside>
  <button class="logo" onclick={() => go('/home')}>
    <span class="tk-raise-sm mark">✿</span>
    <span class="words">
      <b>Aviary</b>
      <small>People OS · v2</small>
    </span>
  </button>

  <nav>
    {#each NAV as item (item.label)}
      {#if !item.children}
        <button class="item" class:active={path === item.to} onclick={() => go(item.to!)}>
          <i>{item.icon}</i> {item.label}
        </button>
      {:else}
        <button class="item" class:groupOn={path.startsWith('/organization')}
          onclick={() => { openGroups = new Set([...openGroups, item.label]); go(item.defaultTo!); }}>
          <i>{item.icon}</i> {item.label}
          <span class="chev" class:open={openGroups.has(item.label)} role="button" tabindex="0"
            onclick={(e) => { e.stopPropagation(); toggleGroup(item.label); }}
            onkeydown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); toggleGroup(item.label); } }}>▾</span>
        </button>
        {#if openGroups.has(item.label)}
          <div class="kids">
            {#each item.children as c (c.to)}
              <button class="kid" class:active={path.startsWith(c.match)} onclick={() => go(c.to)}>{c.label}</button>
            {/each}
          </div>
        {/if}
      {/if}
    {/each}
  </nav>

  <p class="foot">© 2026 Aviary Technologies</p>
</aside>

<style>
  aside { display: flex; flex-direction: column; height: 100%; }
  .logo { display: flex; align-items: center; gap: 10px; padding: 16px; text-align: left; }
  .mark { width: 36px; height: 36px; border-radius: 12px; display: inline-flex; align-items: center;
    justify-content: center; color: var(--t-accent); font-size: 17px; }
  .words b { display: block; font: 700 16px var(--t-font-display); color: var(--t-ink); line-height: 1; }
  .words small { display: block; font: 700 9px var(--t-font-body); text-transform: uppercase;
    letter-spacing: 0.2em; color: var(--t-muted); margin-top: 2px; }
  nav { flex: 1; overflow-y: auto; padding: 8px 12px; display: flex; flex-direction: column; gap: 4px; }
  .item { display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 14px;
    border-radius: 12px; font: 700 13px var(--t-font-body); color: var(--t-muted); text-align: left; }
  .item:hover { color: var(--t-ink); }
  .item.active { background: var(--t-surface); box-shadow: var(--t-inset); color: var(--t-accent); }
  .item.groupOn { color: var(--t-accent); }
  .item i { font-style: normal; width: 16px; text-align: center; }
  .chev { margin-left: auto; transition: transform 0.2s; padding: 2px 4px; }
  .chev.open { transform: rotate(180deg); }
  .kids { margin-left: 18px; padding-left: 12px; border-left: 1px solid color-mix(in srgb, var(--t-ink) 8%, transparent);
    display: flex; flex-direction: column; gap: 2px; }
  .kid { padding: 8px 12px; border-radius: 10px; font: 600 12.5px var(--t-font-body);
    color: var(--t-muted); text-align: left; }
  .kid:hover { color: var(--t-ink); }
  .kid.active { background: var(--t-surface); box-shadow: var(--t-inset); color: var(--t-accent); }
  .foot { padding: 12px 16px; margin: 0; font: 600 10px var(--t-font-body); color: var(--t-muted);
    border-top: 1px solid color-mix(in srgb, var(--t-ink) 8%, transparent); }
</style>
