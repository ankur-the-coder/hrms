<script lang="ts">
  // Shared component playground — live against /api/v1/demo-people.
  import { onMount } from 'svelte';
  import { api } from '$lib/api';
  import DataTable from '$lib/components/DataTable.svelte';
  import Chart from '$lib/components/Chart.svelte';
  import StackedColumns from '$lib/components/StackedColumns.svelte';
  import NeuDonut from '$lib/components/NeuDonut.svelte';
  import Select from '$lib/components/Select.svelte';
  import DatePicker from '$lib/components/pickers/DatePicker.svelte';
  import DateRangePicker from '$lib/components/pickers/DateRangePicker.svelte';
  import MonthPicker from '$lib/components/pickers/MonthPicker.svelte';
  import TimePicker from '$lib/components/pickers/TimePicker.svelte';

  interface Person { id: number; full_name: string; dept: string; role: string; status: string; city: string; joined: string; salary: number }

  let people: Person[] = $state([]);
  let loading = $state(true);
  let err = $state('');

  // picker demos
  let date = $state('');
  let range = $state({ start: '', end: '' });
  let month = $state('');
  let mrange = $state({ start: '', end: '' });
  let time = $state('09:30');
  let single: string | null = $state(null);
  let multi: string[] = $state([]);

  async function load() {
    loading = true;
    try { people = await api<Person[]>('demo-people'); err = ''; }
    catch (e) { err = e instanceof Error ? e.message : 'Failed'; }
    finally { loading = false; }
  }
  onMount(load);

  const deptData = $derived.by(() => {
    const m = new Map<string, number>();
    people.forEach((p) => m.set(p.dept, (m.get(p.dept) || 0) + 1));
    return [...m.entries()].map(([label, value]) => ({ label, value }));
  });
  const statusData = $derived.by(() => {
    const m = new Map<string, number>();
    people.forEach((p) => m.set(p.status, (m.get(p.status) || 0) + 1));
    return [...m.entries()].map(([label, value]) => ({ label, value }));
  });
  const deptOptions = ['Design', 'Engineering', 'Sales', 'HR', 'Finance', 'Marketing'].map((d) => ({ value: d, label: d }));
</script>

<h1>Design system playground</h1>
{#if err}<p class="err">{err} <button onclick={load}>retry</button></p>{/if}

<section>
  <h2>DataTable</h2>
  <DataTable
    data={people} {loading} onReload={load}
    columns={[
      { key: 'full_name', label: 'Name' },
      { key: 'dept', label: 'Department', filterOptions: ['Design', 'Engineering', 'Sales', 'HR', 'Finance', 'Marketing'] },
      { key: 'role', label: 'Role' },
      { key: 'status', label: 'Status', filterOptions: ['Active', 'On Leave', 'Contract', 'Inactive'] },
      { key: 'joined', label: 'Joined' },
    ]}
    rowKey={(r: Person) => r.id}
    views={['list', 'kanban', 'gallery', 'calendar', 'timeline', 'chart']}
    groupField="dept" dateField="joined" pageSize={8}
    exportName="employee-directory"
    cardTitle={(r: Person) => r.full_name}
    onBulk={async (action, rows) => {
      if (action === 'Deactivate') {
        await api('demo-people/bulk', { method: 'PUT', body: JSON.stringify({ ids: rows.map((r: Person) => r.id), status: 'Inactive' }) });
        load();
      }
    }}
    bulkActions={['Deactivate']}
  />
</section>

<section>
  <h2>Pickers</h2>
  <div class="tk-card padgrid">
    <div><label>Date</label><DatePicker bind:value={date} /></div>
    <div><label>Date range</label><DateRangePicker bind:value={range} /></div>
    <div><label>Time</label><TimePicker bind:value={time} /></div>
    <div><label>Month</label><MonthPicker bind:value={month} /></div>
    <div><label>Month range</label><MonthPicker range bind:rangeValue={mrange} placeholder="Pick month range" /></div>
  </div>
</section>

<section>
  <h2>Selects</h2>
  <div class="tk-card padgrid two">
    <div><label>Single</label><Select options={deptOptions} bind:value={single} placeholder="Choose a department…" /></div>
    <div><label>Multi</label><Select multi options={deptOptions} bind:values={multi} placeholder="Choose departments…" /></div>
  </div>
</section>

<section>
  <h2>Charts</h2>
  <div class="charts">
    <Chart title="Headcount by department" data={deptData} defaultKind="bar" />
    <Chart title="Workforce status" data={statusData} defaultKind="donut" />
    <NeuDonut title="Status split (native soft UI)" data={statusData} />
    <StackedColumns title="Status by department"
      categories={deptData.map((d) => d.label)}
      series={statusData.map((s) => ({
        name: s.label,
        values: deptData.map((d) => people.filter((p) => p.dept === d.label && p.status === s.label).length),
      }))} />
  </div>
</section>

<style>
  h1 { font: 600 24px var(--t-font-display); color: var(--t-ink); margin: 0 0 18px; }
  h2 { font: 600 17px var(--t-font-display); color: var(--t-ink); margin: 26px 0 12px; }
  .err { padding: 10px 14px; border-radius: 12px; background: rgba(225,29,72,0.1);
    font: 500 13px var(--t-font-body); color: #e11d48; }
  .err button { font-weight: 700; text-decoration: underline; }
  .padgrid { padding: 18px; display: grid; gap: 18px; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); }
  .padgrid.two { grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }
  label { display: block; margin-bottom: 6px; font: 700 11px var(--t-font-body);
    text-transform: uppercase; letter-spacing: 0.12em; color: var(--t-muted); }
  .charts { display: grid; gap: 18px; grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); }
</style>
