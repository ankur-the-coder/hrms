<script lang="ts">
  import { goto } from '$app/navigation';
  import { session } from '$lib/stores/session';

  const first = $derived($session.user?.full_name?.split(' ')[0] || 'there');
  const h = new Date().getHours();
  const greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';

  const cards = [
    { title: 'Organization · Dashboard', desc: 'Summary, analytics, employee reports and audit logs.', to: '/organization/dashboard/summary' },
    { title: 'Organization · Org Structure', desc: 'Legal entities, business units, locations, departments, cost centers, pay grades and bands.', to: '/organization/structure/legal-entities' },
    { title: 'Component kit', desc: 'DataTable, pickers, selects and charts — the shared building blocks.', to: '/playground' },
  ];
</script>

<p class="eyebrow">Aviary v2 · Enterprise</p>
<h1>{greet}, <em>{first}</em></h1>
<p class="sub">Multi-tenant HRMS — Rust + Svelte production stack.</p>

<div class="grid">
  {#each cards as c (c.to)}
    <button class="tk-card card" onclick={() => goto(c.to)}>
      <b>{c.title}</b>
      <span>{c.desc}</span>
      <em>Open →</em>
    </button>
  {/each}
</div>

<style>
  .eyebrow { margin: 0; font: 700 12px var(--t-font-body); text-transform: uppercase;
    letter-spacing: 0.18em; color: var(--t-accent); }
  h1 { margin: 4px 0 6px; font: 600 30px var(--t-font-display); color: var(--t-ink); }
  h1 em { color: var(--t-accent); }
  .sub { margin: 0 0 24px; font: 400 13.5px var(--t-font-body); color: var(--t-muted); }
  .grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }
  .card { padding: 20px; text-align: left; transition: transform 0.2s; }
  .card:hover { transform: translateY(-2px); }
  .card b { display: block; font: 600 16px var(--t-font-display); color: var(--t-ink); }
  .card span { display: block; margin: 6px 0 10px; font: 400 12.5px var(--t-font-body);
    color: var(--t-muted); line-height: 1.5; }
  .card em { font: 700 13px var(--t-font-body); font-style: normal; color: var(--t-accent); }
</style>
