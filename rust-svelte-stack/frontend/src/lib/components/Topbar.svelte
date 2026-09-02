<script lang="ts">
  // Topbar — global search (modules / sub-modules / functionality),
  // alerts + messages icons (dummy), profile menu. Mirrors React Layout topbar.
  import { goto } from '$app/navigation';
  import ProfileMenu from './ProfileMenu.svelte';
  import { session } from '$lib/stores/session';

  let { onMenu = () => {} } = $props();

  const SEARCH_INDEX = [
    { label: 'Home', hint: 'Module', path: '/home', keys: 'home dashboard start' },
    { label: 'Org · Dashboard · Summary', hint: 'Sub-module', path: '/organization/dashboard/summary', keys: 'org summary hires exits birthdays pending' },
    { label: 'Org · Dashboard · Analytics', hint: 'Sub-module', path: '/organization/dashboard/analytics', keys: 'analytics headcount demographics growth retention attrition' },
    { label: 'Org · Dashboard · Employee Reports', hint: 'Sub-module', path: '/organization/dashboard/reports', keys: 'reports custom master exits probation' },
    { label: 'Org · Dashboard · Audit Logs', hint: 'Sub-module', path: '/organization/dashboard/audit', keys: 'audit logs events trail' },
    { label: 'Org Structure · Legal Entities', hint: 'Sub-module', path: '/organization/structure/legal-entities', keys: 'legal entity cin signatories bank payroll' },
    { label: 'Org Structure · Business Units', hint: 'Sub-module', path: '/organization/structure/business-units', keys: 'business unit bulk assign' },
    { label: 'Org Structure · Locations', hint: 'Sub-module', path: '/organization/structure/locations', keys: 'location office timezone map import' },
    { label: 'Org Structure · Departments', hint: 'Sub-module', path: '/organization/structure/departments', keys: 'department tree wall settings' },
    { label: 'Org Structure · Cost Centers', hint: 'Sub-module', path: '/organization/structure/cost-centers', keys: 'cost center code budget' },
    { label: 'Org Structure · Pay Grades', hint: 'Sub-module', path: '/organization/structure/pay-grades', keys: 'pay grade compensation' },
    { label: 'Org Structure · Bands', hint: 'Sub-module', path: '/organization/structure/bands', keys: 'band level career' },
    { label: 'Components · Playground', hint: 'Module', path: '/playground', keys: 'components datatable pickers charts kanban' },
  ];

  let q = $state('');
  let openSearch = $state(false);
  let sel = $state(0);
  let box: HTMLDivElement | undefined = $state();

  const results = $derived.by(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return SEARCH_INDEX
      .map((e) => {
        const hay = (e.label + ' ' + e.keys).toLowerCase();
        const score = hay.startsWith(t) ? 3 : e.label.toLowerCase().includes(t) ? 2 : hay.includes(t) ? 1 : 0;
        return { e, score };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 7)
      .map((r) => r.e);
  });

  function go(path: string) { openSearch = false; q = ''; goto(path); }
</script>

<svelte:window onmousedown={(e) => { if (openSearch && box && !box.contains(e.target as Node)) openSearch = false; }} />

<header>
  <button class="tk-btn-ghost burger" onclick={onMenu}>☰</button>
  <div class="right">
    <div class="search" bind:this={box}>
      <div class="tk-inset sfield">
        <span>⌕</span>
        <input bind:value={q} placeholder="Search anything…"
          onfocus={() => (openSearch = true)}
          oninput={() => { openSearch = true; sel = 0; }}
          onkeydown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(results.length - 1, sel + 1); }
            if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); }
            if (e.key === 'Enter' && results[sel]) go(results[sel].path);
            if (e.key === 'Escape') openSearch = false;
          }} />
      </div>
      {#if openSearch && results.length}
        <div class="tk-pop drop">
          {#each results as r, i (r.label)}
            <button class="res" class:on={i === sel} onmouseenter={() => (sel = i)} onclick={() => go(r.path)}>
              <span class="lbl">{r.label}</span>
              <span class="tk-chip hint">{r.hint}</span>
            </button>
          {/each}
        </div>
      {/if}
    </div>
    <button class="tk-btn-ghost icon" data-tip="Alerts — coming soon">⚑<i class="dot red"></i></button>
    <button class="tk-btn-ghost icon" data-tip="Messages — coming soon">✉<i class="dot gold"></i></button>
    <ProfileMenu profile={$session.user ? { full_name: $session.user.full_name || '', email: $session.user.email, role: $session.user.role } : null}
      onLogout={() => { session.logout(); goto('/login'); }} />
  </div>
</header>

<style>
  header { display: flex; align-items: center; height: 64px; padding: 0 20px; gap: 10px; }
  .burger { display: none; padding: 8px 12px; border-radius: 12px; }
  @media (max-width: 1023px) { .burger { display: block; } }
  .right { display: flex; align-items: center; gap: 10px; margin-left: auto; }
  .search { position: relative; width: min(280px, 44vw); }
  .sfield { display: flex; align-items: center; gap: 8px; padding: 8px 14px; border-radius: 999px; }
  .sfield span { color: var(--t-muted); font-size: 13px; }
  .sfield input { flex: 1; background: none; border: 0; outline: none;
    font: 500 12.5px var(--t-font-body); color: var(--t-ink); min-width: 0; }
  .drop { position: absolute; left: 0; right: 0; top: calc(100% + 8px); z-index: 50;
    min-width: 270px; padding: 6px; }
  .res { display: flex; justify-content: space-between; align-items: center; gap: 10px;
    width: 100%; padding: 8px 12px; border-radius: 10px; text-align: left; }
  .res.on { background: color-mix(in srgb, var(--t-accent) 10%, transparent); }
  .lbl { font: 700 12.5px var(--t-font-body); color: var(--t-ink);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .hint { flex-shrink: 0; padding: 2px 8px; font: 700 9.5px var(--t-font-body); color: var(--t-muted); }
  .icon { position: relative; width: 38px; height: 38px; border-radius: 999px;
    display: inline-flex; align-items: center; justify-content: center; font-size: 14px; }
  .dot { position: absolute; top: 7px; right: 7px; width: 7px; height: 7px; border-radius: 999px; }
  .dot.red { background: #e11d48; }
  .dot.gold { background: var(--t-gold); }
</style>
