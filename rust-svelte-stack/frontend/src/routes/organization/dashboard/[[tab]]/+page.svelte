<script lang="ts">
  // Organization → Dashboard: Summary · Analytics · Employee Reports · Audit Logs
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { api, fmtDate } from '$lib/api';
  import DataTable from '$lib/components/DataTable.svelte';
  import Chart from '$lib/components/Chart.svelte';
  import StackedColumns from '$lib/components/StackedColumns.svelte';
  import NeuDonut from '$lib/components/NeuDonut.svelte';
  import NeuLoader from '$lib/components/NeuLoader.svelte';
  import Select from '$lib/components/Select.svelte';
  import DateRangePicker from '$lib/components/pickers/DateRangePicker.svelte';

  interface Person {
    id: number; full_name: string; email: string | null; gender: string | null; dept: string | null;
    role: string | null; status: string; location: string | null; employment_type: string | null;
    worker_type: string | null; nationality: string | null; business_unit: string | null;
    cost_center: string | null; legal_entity: string | null; joined: string;
    exit_date: string | null; exit_reason: string | null; exit_type: string | null;
    dob: string | null; salary: number;
  }
  interface AuditRow {
    id: number; actor: string; category: string; sub_category: string | null;
    attribute: string | null; event: string; detail: string | null; created_at: string;
  }

  const TABS = [
    { key: 'summary', label: 'Summary' },
    { key: 'analytics', label: 'Analytics' },
    { key: 'reports', label: 'Employee Reports' },
    { key: 'audit', label: 'Audit Logs' },
  ];
  const tab = $derived(TABS.some((t) => t.key === page.params.tab) ? page.params.tab! : 'summary');

  let people: Person[] = $state([]);
  let audit: AuditRow[] = $state([]);
  let loading = $state(true);
  let auditLoading = $state(false);
  let err = $state('');

  // analytics sub-tab + shared filters
  const SUBS = ['Headcount by Demographics', 'Growth & Retention', 'Attrition Analysis'];
  let sub = $state(SUBS[0]);
  let fBu: string | null = $state(null);
  let fDept: string | null = $state(null);
  let fLoc: string | null = $state(null);
  let fCc: string | null = $state(null);
  let fLe: string | null = $state(null);
  let fWt: string | null = $state(null);
  let fRange = $state({ start: '', end: '' });
  let fExit: string | null = $state(null);

  // audit filters: Date Range · Category · Employee · Sub Category · Attribute · Event · Reset
  let aRange = $state({ start: '', end: '' });
  let aCat: string | null = $state(null);
  let aActor: string | null = $state(null);
  let aSub: string | null = $state(null);
  let aAttr: string | null = $state(null);
  let aEvent: string | null = $state(null);

  // reports
  let report: { name: string; filter?: (p: Person) => boolean } | null = $state(null);
  const REPORTS = [
    { name: 'All Employees' },
    { name: 'Employee Master Details' },
    { name: 'Recent Joins · 90 days', filter: (p: Person) => p.joined >= new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10) },
    { name: 'Exited Employees', filter: (p: Person) => p.status === 'Exited' },
    { name: 'Employees in Probation', filter: (p: Person) => p.status === 'Probation' },
    { name: 'Employees Onboarding', filter: (p: Person) => p.status === 'Onboarding' },
  ];

  async function loadPeople() {
    loading = true;
    try { people = await api<Person[]>('org/people?limit=600'); err = ''; }
    catch (e) { err = e instanceof Error ? e.message : 'Failed'; }
    finally { loading = false; }
  }
  async function loadAudit() {
    auditLoading = true;
    const params = new URLSearchParams({ limit: '400' });
    if (aRange.start) params.set('from', aRange.start);
    if (aRange.end) params.set('to', aRange.end);
    if (aCat) params.set('category', aCat);
    if (aActor) params.set('actor', aActor);
    if (aSub) params.set('sub_category', aSub);
    if (aAttr) params.set('attribute', aAttr);
    if (aEvent) params.set('event', aEvent);
    try { audit = await api<AuditRow[]>(`org/audit?${params}`); }
    catch (e) { err = e instanceof Error ? e.message : 'Failed'; }
    finally { auditLoading = false; }
  }
  onMount(() => { loadPeople(); loadAudit(); });
  $effect(() => { void aRange; void aCat; void aActor; void aSub; void aAttr; void aEvent; loadAudit(); });

  /* ---------- helpers ---------- */
  const countBy = <T,>(rows: T[], fn: (r: T) => string) => {
    const m = new Map<string, number>();
    rows.forEach((r) => { const k = fn(r) || 'Not Specified'; m.set(k, (m.get(k) || 0) + 1); });
    return [...m.entries()].map(([label, value]) => ({ label, value }));
  };
  const distinct = <T,>(rows: T[], fn: (r: T) => string) => [...new Set(rows.map(fn).filter(Boolean))].sort();
  const ageOf = (dob: string | null) => dob ? Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 864e5)) : null;
  const tenureY = (p: Person) => ((p.exit_date ? new Date(p.exit_date).getTime() : Date.now()) - new Date(p.joined).getTime()) / (365.25 * 864e5);

  const filtered = $derived(people.filter((p) =>
    (!fBu || p.business_unit === fBu) && (!fDept || p.dept === fDept) &&
    (!fLoc || p.location === fLoc) && (!fCc || p.cost_center === fCc) &&
    (!fLe || p.legal_entity === fLe) && (!fWt || p.worker_type === fWt) &&
    (!fRange.start || p.joined >= fRange.start) && (!fRange.end || p.joined <= fRange.end)
  ));
  const active = $derived(filtered.filter((p) => p.status !== 'Exited'));
  const exited = $derived(filtered.filter((p) => p.status === 'Exited' && (!fExit || p.exit_type === fExit)));
  const depts = $derived(distinct(active, (p) => p.dept || ''));

  const GENDERS = ['Female', 'Male', 'Non-binary', 'Prefer not to respond', 'Transgender', 'Not Specified'];
  const AGE_B = ['<18', '18–25', '26–30', '31–40', '41–55', '55+'];
  const TEN_B = ['0–4', '4–8', '8–12', '12–16', '16–20', '20–24', '24–28'];
  const ageBracket = (p: Person) => {
    const a = ageOf(p.dob); if (a === null || a < 18) return '<18';
    if (a <= 25) return '18–25'; if (a <= 30) return '26–30';
    if (a <= 40) return '31–40'; if (a <= 55) return '41–55'; return '55+';
  };
  const tenBracket = (p: Person) => {
    const t = tenureY(p);
    if (t < 4) return '0–4'; if (t < 8) return '4–8'; if (t < 12) return '8–12';
    if (t < 16) return '12–16'; if (t < 20) return '16–20'; if (t < 24) return '20–24'; return '24–28';
  };
  const stacks = (rows: Person[], cats: string[], catOf: (p: Person) => string, names: string[], of: (p: Person) => string) =>
    names.map((name) => ({ name, values: cats.map((c) => rows.filter((p) => catOf(p) === c && (of(p) || 'Not Specified') === name).length) }));

  const growth = $derived.by(() => {
    const out: { label: string; value: number }[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0).toISOString().slice(0, 10);
      out.push({ label: d.toLocaleDateString('en', { month: 'short' }), value: filtered.filter((p) => p.joined <= end && (!p.exit_date || p.exit_date > end)).length });
    }
    return out;
  });

  const avg = (arr: number[]) => arr.length ? (arr.reduce((s, a) => s + a, 0) / arr.length).toFixed(1) : '—';
  const ages = $derived(active.map((p) => ageOf(p.dob)).filter((a): a is number => a !== null));
  const agesM = $derived(active.filter((p) => p.gender === 'Male').map((p) => ageOf(p.dob)).filter((a): a is number => a !== null));
  const agesF = $derived(active.filter((p) => p.gender === 'Female').map((p) => ageOf(p.dob)).filter((a): a is number => a !== null));
  const tens = $derived(active.map(tenureY));

  function resetFilters() {
    fBu = fDept = fLoc = fCc = fLe = fWt = fExit = null;
    fRange = { start: '', end: '' };
  }

  const now = new Date();
  const d30 = new Date(now.getTime() - 30 * 864e5).toISOString().slice(0, 10);
</script>

<div class="tk-card tabs">
  {#each TABS as t (t.key)}
    <button class:on={tab === t.key} onclick={() => goto(`/organization/dashboard/${t.key}`)}>{t.label}</button>
  {/each}
</div>

{#if err}<p class="err">{err}</p>{/if}

{#if loading}
  <div class="tk-card"><NeuLoader label="Loading organization…" /></div>

{:else if tab === 'summary'}
  {@const newJoins = people.filter((p) => p.joined >= d30 && p.status !== 'Exited')}
  {@const exits30 = people.filter((p) => p.exit_date && p.exit_date >= d30)}
  {@const month = now.getMonth()}
  {@const bdays = people.filter((p) => p.status !== 'Exited' && p.dob && new Date(p.dob).getMonth() === month)}
  <div class="tiles">
    {#each [
      ['Total employees', people.filter((p) => p.status !== 'Exited').length],
      ['New joins · 30d', newJoins.length],
      ['Exits · 30d', exits30.length],
      ['Onboarding', people.filter((p) => p.status === 'Onboarding').length],
      ['In probation', people.filter((p) => p.status === 'Probation').length],
    ] as [label, value] (label)}
      <div class="tk-card tile"><b>{value}</b><small>{label}</small></div>
    {/each}
  </div>
  <div class="twocol">
    <div class="tk-card list">
      <p class="lt">New hires</p>
      {#each newJoins.slice(0, 5) as p (p.id)}
        <div class="prow"><b>{p.full_name}</b><span>{p.role} · {fmtDate(p.joined, { day: 'numeric', month: 'short' })}</span></div>
      {:else}<p class="empty">No recent hires.</p>{/each}
    </div>
    <div class="tk-card list">
      <p class="lt">Exits</p>
      {#each exits30.slice(0, 5) as p (p.id)}
        <div class="prow"><b>{p.full_name}</b><span>{p.exit_reason} · {fmtDate(p.exit_date, { day: 'numeric', month: 'short' })}</span></div>
      {:else}<p class="empty">No exits in the last 30 days.</p>{/each}
    </div>
    <div class="tk-card list">
      <p class="lt">Birthdays this month</p>
      {#each bdays.slice(0, 5) as p (p.id)}
        <div class="prow"><b>{p.full_name}</b><span>{fmtDate(p.dob, { day: 'numeric', month: 'short' })}</span></div>
      {:else}<p class="empty">No birthdays this month.</p>{/each}
    </div>
    <div class="tk-card list">
      <p class="lt">Quick links</p>
      {#each ['All employees', 'Employees on notice', 'Incomplete profiles', 'Add employees in bulk', 'Bulk invite employees'] as l (l)}
        <button class="qlink" data-tip="Coming soon">{l}</button>
      {/each}
    </div>
  </div>

{:else if tab === 'analytics'}
  <div class="tk-card subrow">
    <div class="tk-inset seg">
      {#each SUBS as s (s)}<button class:on={sub === s} onclick={() => (sub = s)}>{s}</button>{/each}
    </div>
  </div>
  <div class="tk-card filters">
    <Select options={distinct(people, (p) => p.business_unit || '').map((v) => ({ value: v, label: v }))} bind:value={fBu} placeholder="Business Unit" searchable={false} />
    <Select options={distinct(people, (p) => p.dept || '').map((v) => ({ value: v, label: v }))} bind:value={fDept} placeholder="Department" searchable={false} />
    <Select options={distinct(people, (p) => p.location || '').map((v) => ({ value: v, label: v }))} bind:value={fLoc} placeholder="Location" searchable={false} />
    <Select options={distinct(people, (p) => p.cost_center || '').map((v) => ({ value: v, label: v }))} bind:value={fCc} placeholder="Cost Center" searchable={false} />
    <Select options={distinct(people, (p) => p.legal_entity || '').map((v) => ({ value: v, label: v }))} bind:value={fLe} placeholder="Legal Entity" searchable={false} />
    <DateRangePicker bind:value={fRange} placeholder="Date Range" />
    <Select options={['Permanent', 'Contingent'].map((v) => ({ value: v, label: v }))} bind:value={fWt} placeholder="Worker Type" searchable={false} />
    {#if sub === SUBS[2]}
      <Select options={distinct(people.filter((p) => p.exit_type), (p) => p.exit_type || '').map((v) => ({ value: v, label: v }))} bind:value={fExit} placeholder="Exit Types" searchable={false} />
    {/if}
    <button class="tk-btn-ghost reset" onclick={resetFilters}>Reset</button>
  </div>

  {#if sub === SUBS[0]}
    <div class="donuts">
      <NeuDonut title="Gender Distribution" centerLabel="headcount" data={countBy(active, (p) => p.gender || '')} />
      <NeuDonut title="Employment Type" centerLabel="headcount" data={countBy(active, (p) => p.employment_type || '')} />
      <NeuDonut title="Worker Type" centerLabel="headcount" data={countBy(active, (p) => p.worker_type || '')} />
      <NeuDonut title="Nationality Distribution" centerLabel="headcount" data={countBy(active, (p) => p.nationality || '')} />
    </div>
    <div class="pair">
      <div>
        <StackedColumns title="Age of Employees (in Years)" height={260} categories={AGE_B}
          series={stacks(active, AGE_B, ageBracket, GENDERS, (p) => p.gender || '')} />
        <div class="kpis">
          <div class="tk-inset kpi"><b>{avg(ages)}</b><small>Average Age (Overall)</small></div>
          <div class="tk-inset kpi"><b>{avg(agesM)}</b><small>Average Age (Man)</small></div>
          <div class="tk-inset kpi"><b>{avg(agesF)}</b><small>Average Age (Woman)</small></div>
        </div>
      </div>
      <div>
        <StackedColumns title="Years in Organisation" height={260} categories={TEN_B}
          series={[{ name: 'Experience', values: TEN_B.map((b) => active.filter((p) => tenBracket(p) === b).length) }]} />
        <div class="kpis">
          <div class="tk-inset kpi"><b>{tens.length ? Math.max(...tens).toFixed(1) : '—'} yr</b><small>Max Experience</small></div>
          <div class="tk-inset kpi"><b>{tens.length ? Math.min(...tens).toFixed(1) : '—'} yr</b><small>Min Experience</small></div>
          <div class="tk-inset kpi"><b>{avg(tens)} yr</b><small>Avg Years at Org</small></div>
        </div>
      </div>
    </div>
    <StackedColumns title="Headcount by Gender Across Department" categories={depts}
      series={stacks(active, depts, (p) => p.dept || '', GENDERS, (p) => p.gender || '')} />
    <StackedColumns title="Headcount by Employment Type Across Department" categories={depts}
      series={stacks(active, depts, (p) => p.dept || '', ['Full Time', 'Part Time', 'None'], (p) => p.employment_type || '')} />
    <StackedColumns title="Headcount by Nationality Across Department" categories={depts}
      series={stacks(active, depts, (p) => p.dept || '', ['Armenia', 'Aruba', 'India', 'United Kingdom', 'Not Specified'], (p) => p.nationality || '')} />
    <StackedColumns title="Headcount by Worker Type Across Department" categories={depts}
      series={stacks(active, depts, (p) => p.dept || '', ['Permanent', 'Contingent'], (p) => p.worker_type || '')} />

  {:else if sub === SUBS[1]}
    {@const hc0 = growth[0]?.value || 1}
    {@const hcN = growth[growth.length - 1]?.value || 0}
    {@const exits12 = filtered.filter((p) => p.exit_date && new Date(p.exit_date) > new Date(Date.now() - 365 * 864e5)).length}
    {@const avgHc = growth.reduce((s, g) => s + g.value, 0) / (growth.length || 1)}
    {@const attr = (exits12 / Math.max(1, avgHc)) * 100}
    <div class="kpis three">
      <div class="tk-card kpi big"><b>{(((hcN - hc0) / hc0) * 100).toFixed(1)}%</b><small>Growth rate · 12m</small></div>
      <div class="tk-card kpi big"><b>{(100 - attr).toFixed(1)}%</b><small>Retention rate</small></div>
      <div class="tk-card kpi big"><b>{attr.toFixed(1)}%</b><small>Attrition rate</small></div>
    </div>
    <Chart title="Headcount growth · last 12 months" data={growth} defaultKind="bar" height={280} />

  {:else}
    <div class="donuts three">
      <NeuDonut title="Attrition by Exit Type" centerLabel="exits" data={countBy(exited, (p) => p.exit_type || 'Unknown')} />
      <Chart title="Attrition by department" data={countBy(exited, (p) => p.dept || '')} defaultKind="donut" height={230} />
      <Chart title="Attrition by exit reason" data={countBy(exited, (p) => p.exit_reason || 'Unknown')} defaultKind="pie" height={230} />
    </div>
    <DataTable data={exited} rowKey={(r: Person) => r.id} pageSize={8} exportName="attrition-report"
      columns={[
        { key: 'full_name', label: 'Employee' },
        { key: 'dept', label: 'Department' },
        { key: 'exit_type', label: 'Exit type' },
        { key: 'exit_date', label: 'Exit date' },
        { key: 'exit_reason', label: 'Reason' },
      ]}
      views={['list', 'timeline']} dateField="exit_date" cardTitle={(r: Person) => r.full_name} />
  {/if}

{:else if tab === 'reports'}
  {#if report}
    <button class="back" onclick={() => (report = null)}>← All reports</button>
    <DataTable data={people.filter(report.filter || (() => true))} rowKey={(r: Person) => r.id} pageSize={10}
      exportName={report.name.toLowerCase().replace(/\s+/g, '-')}
      columns={[
        { key: 'full_name', label: 'Name' },
        { key: 'dept', label: 'Department' },
        { key: 'role', label: 'Role' },
        { key: 'status', label: 'Status' },
        { key: 'location', label: 'Location' },
        { key: 'joined', label: 'Joined' },
      ]}
      views={['list', 'gallery', 'chart']} groupField="dept" cardTitle={(r: Person) => r.full_name} />
  {:else}
    <div class="reports">
      {#each REPORTS as r (r.name)}
        <button class="tk-card report" onclick={() => (report = r)}>
          <b>{r.name}</b>
          <em>{people.filter(r.filter || (() => true)).length} records →</em>
        </button>
      {/each}
    </div>
  {/if}

{:else if tab === 'audit'}
  <div class="tk-card filters">
    <DateRangePicker bind:value={aRange} placeholder="Date Range" />
    <Select options={distinct(audit, (r) => r.category).map((v) => ({ value: v, label: v }))} bind:value={aCat} placeholder="Category" searchable={false} />
    <Select options={distinct(audit, (r) => r.actor).map((v) => ({ value: v, label: v }))} bind:value={aActor} placeholder="Employee" searchable={false} />
    <Select options={distinct(audit, (r) => r.sub_category || '').map((v) => ({ value: v, label: v }))} bind:value={aSub} placeholder="Sub Category" searchable={false} />
    <Select options={distinct(audit, (r) => r.attribute || '').map((v) => ({ value: v, label: v }))} bind:value={aAttr} placeholder="Attribute" searchable={false} />
    <Select options={distinct(audit, (r) => r.event).map((v) => ({ value: v, label: v }))} bind:value={aEvent} placeholder="Event" searchable={false} />
    <button class="tk-btn-ghost reset" onclick={() => { aRange = { start: '', end: '' }; aCat = aActor = aSub = aAttr = aEvent = null; }}>Reset</button>
  </div>
  <DataTable data={audit} loading={auditLoading} onReload={loadAudit} rowKey={(r: AuditRow) => r.id}
    pageSize={10} exportName="audit-logs"
    columns={[
      { key: 'created_at', label: 'When' },
      { key: 'actor', label: 'Employee' },
      { key: 'category', label: 'Category' },
      { key: 'sub_category', label: 'Sub category' },
      { key: 'attribute', label: 'Attribute' },
      { key: 'event', label: 'Event' },
      { key: 'detail', label: 'Detail' },
    ]}
    views={['list', 'timeline', 'chart']} groupField="category" dateField="created_at"
    cardTitle={(r: AuditRow) => `${r.event} · ${r.attribute || ''}`} />
{/if}

<style>
  .tabs { display: flex; gap: 2px; overflow-x: auto; padding: 0 8px; margin-bottom: 18px;
    position: sticky; top: 64px; z-index: 20; }
  .tabs button { padding: 13px 14px; font: 700 12px var(--t-font-body); text-transform: uppercase;
    letter-spacing: 0.08em; color: var(--t-muted); white-space: nowrap; position: relative; }
  .tabs button.on { color: var(--t-accent); }
  .tabs button.on::after { content: ''; position: absolute; left: 10px; right: 10px; bottom: 0;
    height: 2.5px; border-radius: 3px 3px 0 0; background: var(--t-accent); }
  .err { padding: 10px 14px; border-radius: 12px; background: rgba(225,29,72,0.1);
    font: 500 13px var(--t-font-body); color: #e11d48; }
  .tiles { display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); margin-bottom: 18px; }
  .tile { padding: 16px; }
  .tile b { display: block; font: 600 22px var(--t-font-display); color: var(--t-ink); }
  .tile small { font: 700 10px var(--t-font-body); text-transform: uppercase; letter-spacing: 0.08em; color: var(--t-muted); }
  .twocol { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
  .list { padding: 16px; }
  .lt { margin: 0 0 10px; font: 600 14px var(--t-font-display); color: var(--t-ink); }
  .prow { padding: 6px 0; border-bottom: 1px solid color-mix(in srgb, var(--t-ink) 6%, transparent); }
  .prow b { display: block; font: 700 12.5px var(--t-font-body); color: var(--t-ink); }
  .prow span { font: 500 11px var(--t-font-body); color: var(--t-muted); }
  .empty { font: 500 12px var(--t-font-body); color: var(--t-muted); }
  .qlink { display: block; width: 100%; text-align: left; padding: 7px 8px; border-radius: 10px;
    font: 500 12.5px var(--t-font-body); color: color-mix(in srgb, var(--t-ink) 70%, transparent); }
  .qlink:hover { background: color-mix(in srgb, var(--t-accent) 8%, transparent); color: var(--t-accent); }
  .subrow { padding: 12px; margin-bottom: 12px; }
  .seg { display: inline-flex; gap: 2px; padding: 4px; border-radius: 12px; }
  .seg button { padding: 6px 12px; border-radius: 8px; font: 700 11.5px var(--t-font-body); color: var(--t-muted); }
  .seg button.on { background: var(--t-surface); box-shadow: var(--t-shadow-card); color: var(--t-accent); }
  .filters { display: flex; flex-wrap: wrap; gap: 8px; padding: 12px; margin-bottom: 16px; }
  .filters :global(> *) { min-width: 150px; flex: 1; }
  .reset { flex: 0 !important; min-width: 0 !important; padding: 8px 16px; font: 700 12px var(--t-font-body); border-radius: 12px; }
  .donuts { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); margin-bottom: 18px; }
  .donuts.three { grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); }
  .pair { display: grid; gap: 18px; grid-template-columns: repeat(auto-fit, minmax(380px, 1fr)); margin-bottom: 18px; }
  .kpis { display: flex; gap: 10px; margin-top: 10px; }
  .kpis.three { margin: 0 0 16px; }
  .kpi { flex: 1; padding: 10px; border-radius: 12px; text-align: center; }
  .kpi b { display: block; font: 700 17px var(--t-font-display); color: var(--t-ink); }
  .kpi.big b { font-size: 20px; }
  .kpi small { font: 700 9.5px var(--t-font-body); text-transform: uppercase; letter-spacing: 0.05em; color: var(--t-muted); }
  .reports { display: grid; gap: 14px; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); }
  .report { padding: 18px; text-align: left; transition: transform 0.2s; }
  .report:hover { transform: translateY(-2px); }
  .report b { display: block; font: 600 14.5px var(--t-font-display); color: var(--t-ink); margin-bottom: 8px; }
  .report em { font: 700 11px var(--t-font-body); font-style: normal; color: var(--t-accent); }
  .back { font: 700 13px var(--t-font-body); color: var(--t-accent); margin-bottom: 12px; }
  :global(.pair > div > .tk-card), :global(.donuts > *) { margin-bottom: 0; }
</style>
