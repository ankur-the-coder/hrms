<script lang="ts">
  // Organization → Org Structure: Legal Entities · Business Units · Locations ·
  // Departments · Cost Centers · Pay Grades · Bands. Mirrors React OrgStructure.
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { api } from '$lib/api';
  import DataTable from '$lib/components/DataTable.svelte';
  import ImportWizard from '$lib/components/ImportWizard.svelte';
  import NeuLoader from '$lib/components/NeuLoader.svelte';
  import Drawer from '$lib/components/Drawer.svelte';
  import Modal from '$lib/components/Modal.svelte';

  const SECTIONS = [
    { key: 'legal-entities', label: 'Legal Entities' },
    { key: 'business-units', label: 'Business Units' },
    { key: 'locations', label: 'Locations' },
    { key: 'departments', label: 'Departments' },
    { key: 'cost-centers', label: 'Cost Centers' },
    { key: 'pay-grades', label: 'Pay Grades' },
    { key: 'bands', label: 'Bands' },
  ];
  const section = $derived(SECTIONS.some((s) => s.key === page.params.section) ? page.params.section! : 'legal-entities');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any = $state(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let people: any[] = $state([]);
  let err = $state('');
  let toast = $state('');
  let selId: number | null = $state(null);
  let subTab = $state('Summary');
  let drawerOpen = $state(false);
  let drawerMode: 'add' | 'edit' = $state('add');
  let wizardOpen = $state(false);
  let importLocsOpen = $state(false);
  let simpleModal = $state(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let form: Record<string, any> = $state({});
  let ferr = $state('');

  const RESOURCE: Record<string, string> = {
    'legal-entities': 'legal_entities', 'business-units': 'business_units',
    locations: 'locations', departments: 'departments', 'cost-centers': 'cost_centers',
    'pay-grades': 'pay_grades', bands: 'bands',
  };
  const ASSIGN_FIELD: Record<string, string> = {
    'business-units': 'business_unit', locations: 'location', departments: 'dept', 'cost-centers': 'cost_center',
  };
  const EMP_FIELDS = [{ key: 'email', label: 'Employee Email', required: true }, { key: 'name', label: 'Employee Name' }];

  async function load() {
    try {
      data = await api('org/structure');
      people = await api('org/people?limit=600');
      err = '';
    } catch (e) { err = e instanceof Error ? e.message : 'Failed'; }
  }
  onMount(load);

  const items = $derived.by(() => {
    if (!data) return [];
    return data[RESOURCE[section]] || [];
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sel = $derived(items.find((i: any) => i.id === selId) || items[0] || null);
  $effect(() => { void section; selId = null; subTab = 'Summary'; });

  const matchValue = $derived.by(() => {
    if (!sel) return '';
    return section === 'cost-centers' ? sel.code : sel.name;
  });
  const members = $derived(people.filter((p) =>
    sel && ASSIGN_FIELD[section] && p[ASSIGN_FIELD[section]] === matchValue && p.status !== 'Exited'));

  function notify(m: string) { toast = m; setTimeout(() => (toast = ''), 2600); }

  async function crud(action: string, payload: Record<string, unknown>, id?: number) {
    await api(`org/structure/${RESOURCE[section]}`, {
      method: 'POST', body: JSON.stringify({ action, data: payload, id }),
    });
    await load();
  }

  async function saveForm() {
    ferr = '';
    if (!String(form.name || '').trim()) { ferr = 'Name is required.'; return; }
    if (drawerMode === 'add') { await crud('create', form); notify('Created'); }
    else if (sel) { await crud('update', form, sel.id); notify('Updated'); }
    drawerOpen = false; simpleModal = false; form = {};
  }

  async function bulkAssign(rows: Record<string, string>[]): Promise<string> {
    const res = await api<{ assigned: number; missed: number }>('org/structure/bulk-assign', {
      method: 'POST',
      body: JSON.stringify({ field: ASSIGN_FIELD[section], value: matchValue, emails: rows.map((r) => r.email) }),
    });
    await load();
    return `${res.assigned} employees assigned to ${matchValue}${res.missed ? ` · ${res.missed} emails not found` : ''}`;
  }

  const FORM_FIELDS: Record<string, { key: string; label: string; required?: boolean; textarea?: boolean }[]> = {
    'legal-entities': [
      { key: 'country', label: 'Country' }, { key: 'name', label: 'Entity Name', required: true },
      { key: 'legal_name', label: 'Legal Name of Company', required: true }, { key: 'cin', label: 'Company Identification Number' },
      { key: 'incorporation_date', label: 'Date of Incorporation' }, { key: 'business_type', label: 'Type of Business' },
      { key: 'sector', label: 'Sector' }, { key: 'nature', label: 'Nature of Business' },
      { key: 'address1', label: 'Address Line 1' }, { key: 'address2', label: 'Address Line 2' },
      { key: 'city', label: 'City' }, { key: 'state', label: 'State' }, { key: 'zip', label: 'Zip Code' },
      { key: 'phone', label: 'Phone' }, { key: 'website', label: 'Website' },
    ],
    'business-units': [
      { key: 'name', label: 'Unit Name', required: true }, { key: 'head', label: 'Unit Head' },
      { key: 'parent', label: 'Parent Unit' }, { key: 'description', label: 'Description', textarea: true },
    ],
    locations: [
      { key: 'name', label: 'Name', required: true }, { key: 'group_email', label: 'Group Email' },
      { key: 'timezone', label: 'Timezone' }, { key: 'country', label: 'Country' }, { key: 'state', label: 'State' },
      { key: 'address1', label: 'Address Line 1' }, { key: 'address2', label: 'Address Line 2' },
      { key: 'city', label: 'City' }, { key: 'zip', label: 'Zip Code' },
      { key: 'description', label: 'Description', textarea: true },
    ],
    departments: [
      { key: 'name', label: 'Name', required: true }, { key: 'display_name', label: 'Display Name' },
      { key: 'head', label: 'Department Head' }, { key: 'description', label: 'Description', textarea: true },
    ],
    'cost-centers': [
      { key: 'name', label: 'Name', required: true }, { key: 'code', label: 'Code', required: true },
      { key: 'head', label: 'Cost Center Head' }, { key: 'description', label: 'Description', textarea: true },
    ],
    'pay-grades': [{ key: 'name', label: 'Name', required: true }, { key: 'description', label: 'Description', textarea: true }],
    bands: [{ key: 'name', label: 'Name', required: true }, { key: 'description', label: 'Description', textarea: true }],
  };

  const isSimple = $derived(section === 'pay-grades' || section === 'bands');
  const hasEmployees = $derived(!!ASSIGN_FIELD[section]);

  function openAdd() { form = {}; ferr = ''; drawerMode = 'add'; isSimple ? (simpleModal = true) : (drawerOpen = true); }
  function openEdit() { if (!sel) return; form = { ...sel }; ferr = ''; drawerMode = 'edit'; isSimple ? (simpleModal = true) : (drawerOpen = true); }

  const SUMMARY_FIELDS: Record<string, [string, string][]> = {
    'legal-entities': [['Legal Name', 'legal_name'], ['CIN', 'cin'], ['Incorporated', 'incorporation_date'], ['Type', 'business_type'], ['Sector', 'sector'], ['Phone', 'phone'], ['Email', 'email'], ['Website', 'website'], ['City', 'city'], ['Country', 'country']],
    'business-units': [['Unit Head', 'head'], ['Parent Unit', 'parent'], ['Description', 'description']],
    locations: [['Timezone', 'timezone'], ['Group Email', 'group_email'], ['City', 'city'], ['State', 'state'], ['Country', 'country'], ['Description', 'description']],
    departments: [['Department Head', 'head'], ['Description', 'description']],
    'cost-centers': [['Code', 'code'], ['Cost Center Head', 'head'], ['Description', 'description']],
  };

  async function toggleWall(key: string) {
    if (!sel) return;
    await crud('update', { [key]: !sel[key] }, sel.id);
  }
</script>

{#if toast}<div class="toast">{toast}</div>{/if}

<div class="tk-card tabs">
  {#each SECTIONS as s (s.key)}
    <button class:on={section === s.key} onclick={() => goto(`/organization/structure/${s.key}`)}>{s.label}</button>
  {/each}
</div>

{#if err}<p class="err">{err} <button onclick={load}>retry</button></p>{/if}

{#if !data}
  <div class="tk-card"><NeuLoader label="Loading org structure…" /></div>

{:else if isSimple}
  <div class="head">
    <h2>{SECTIONS.find((s) => s.key === section)?.label}</h2>
    <button class="tk-btn-primary act" onclick={openAdd}>+ Add</button>
  </div>
  <DataTable data={items} rowKey={(r: { id: number }) => r.id} pageSize={8}
    exportName={section}
    columns={[{ key: 'name', label: 'Name' }, { key: 'description', label: 'Description' }]}
    views={['list']}
    cardTitle={(r: { name: string }) => r.name}
    rowActions={[
      { label: 'Edit', onClick: (r: Record<string, unknown>) => { selId = r.id as number; form = { ...r }; ferr = ''; drawerMode = 'edit'; simpleModal = true; } },
      { label: 'Delete', danger: true, onClick: async (r: Record<string, unknown>) => { await crud('delete', {}, r.id as number); notify('Deleted'); } },
    ]} />

{:else}
  <div class="split">
    <div class="tk-card navpane">
      <div class="navhead">
        <small>{SECTIONS.find((s) => s.key === section)?.label}</small>
        <button class="tk-btn-primary addbtn" onclick={openAdd}>+</button>
      </div>
      {#each items as it (it.id)}
        <button class="navitem" class:on={sel?.id === it.id} onclick={() => { selId = it.id; subTab = 'Summary'; }}>
          {it.display_name || it.name}
          {#if it.code}<small>{it.code}</small>{/if}
        </button>
      {/each}
      {#if section === 'locations'}
        <button class="tk-btn-ghost act imp" onclick={() => (importLocsOpen = true)}>⤴ Import Locations</button>
      {/if}
    </div>

    {#if sel}
      <div class="detail">
        <div class="detailbar">
          <div class="tk-inset seg">
            {#each (section === 'departments' ? ['Summary', 'Employees', 'Settings'] : hasEmployees ? ['Summary', 'Employees'] : ['Summary']) as t (t)}
              <button class:on={subTab === t} onclick={() => (subTab = t)}>{t}</button>
            {/each}
          </div>
          <div class="detailacts">
            <button class="tk-btn-ghost act" onclick={openEdit}>✎ Edit</button>
            {#if hasEmployees}
              <button class="tk-btn-primary act" onclick={() => (wizardOpen = true)}>⤴ Bulk Assign Employees</button>
            {/if}
          </div>
        </div>

        {#if subTab === 'Summary'}
          <div class="tk-card summary">
            <div class="sgrid">
              <div class="sfield"><small>Name</small><b>{sel.display_name || sel.name}</b></div>
              {#each SUMMARY_FIELDS[section] || [] as [label, key] ([label, key])}
                <div class="sfield"><small>{label}</small><b>{sel[key] || '—'}</b></div>
              {/each}
              {#if hasEmployees}
                <div class="sfield"><small>Total Employees</small><b>{members.length}</b></div>
              {/if}
            </div>
            {#if section === 'locations'}
              <iframe title="map" width="100%" height="240" style="border:0;border-radius:var(--t-radius);margin-top:14px"
                loading="lazy"
                src={`https://maps.google.com/maps?q=${encodeURIComponent([sel.address1, sel.city, sel.country].filter(Boolean).join(', ') || sel.name)}&z=13&output=embed`}></iframe>
            {/if}
            {#if section === 'legal-entities'}
              <div class="lesub">
                <p class="lst">Authorized Signatories</p>
                {#each sel.signatories || [] as s (s.email)}
                  <div class="tk-inset chiprow">{[s.first_name, s.last_name].filter(Boolean).join(' ')} · {s.designation} · {s.email}</div>
                {:else}<p class="empty">None yet.</p>{/each}
                <p class="lst">Bank Accounts</p>
                {#each sel.bank_accounts || [] as b (b.account_number)}
                  <div class="tk-inset chiprow">{b.bank_name} · {b.account_type} · {b.account_number}</div>
                {:else}<p class="empty">None linked.</p>{/each}
                <p class="lst">Payroll Configuration · {(sel.payroll_tasks || []).filter((t: { done: boolean }) => t.done).length}/{(sel.payroll_tasks || []).length} complete</p>
                {#each sel.payroll_tasks || [] as t, i (t.task)}
                  <button class="taskrow" onclick={async () => {
                    const tasks = sel.payroll_tasks.map((x: { task: string; done: boolean }, j: number) => j === i ? { ...x, done: !x.done } : x);
                    await crud('update', { payroll_tasks: tasks }, sel.id);
                  }}>
                    <i class:doneI={t.done}>{t.done ? '✓' : '○'}</i>
                    <span class:doneT={t.done}>{t.task}</span>
                  </button>
                {/each}
              </div>
            {/if}
          </div>

        {:else if subTab === 'Employees'}
          <DataTable data={members} rowKey={(r: { id: number }) => r.id} pageSize={8}
            exportName={`${section}-${(sel.name || '').toLowerCase()}-employees`}
            columns={[
              { key: 'full_name', label: 'Employee Name' },
              { key: 'role', label: 'Job Title' },
              { key: 'email', label: 'Email' },
            ]}
            views={['list', 'gallery']}
            cardTitle={(r: { full_name: string }) => r.full_name} />

        {:else if subTab === 'Settings'}
          <div class="tk-card summary">
            <p class="lst">Wall Settings</p>
            {#each [
              ['Employees can post in this department', 'wall_posts'],
              ['Employees can post announcements in this department', 'wall_announcements'],
              ['Employees can post polls in this department', 'wall_polls'],
            ] as [label, key] ([label, key])}
              <button class="togglerow" onclick={() => toggleWall(key)}>
                <span>{label}</span>
                <i class="knobtrack" class:onK={sel[key]}><em></em></i>
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </div>
{/if}

<!-- Add/Edit drawer for entity-style sections -->
<Drawer bind:open={drawerOpen} title={drawerMode === 'add' ? 'Add' : 'Edit'} width={460}>
  <div class="formgrid">
    {#each FORM_FIELDS[section] || [] as f (f.key)}
      <div class="ffield" class:full={f.textarea}>
        <label for="f-{f.key}">{f.label}{#if f.required} *{/if}</label>
        {#if f.textarea}
          <textarea id="f-{f.key}" class="tk-input" rows="3" bind:value={form[f.key]}></textarea>
        {:else}
          <input id="f-{f.key}" class="tk-input" bind:value={form[f.key]} />
        {/if}
      </div>
    {/each}
  </div>
  {#if ferr}<p class="err">{ferr}</p>{/if}
  <div class="formbtns">
    <button class="tk-btn-ghost act" onclick={() => (drawerOpen = false)}>Cancel</button>
    <button class="tk-btn-primary act" onclick={saveForm}>Save</button>
  </div>
</Drawer>

<!-- Add/Edit modal for pay grades & bands -->
<Modal bind:open={simpleModal} title={drawerMode === 'add' ? 'Add' : 'Edit'}>
  <div class="formgrid one">
    {#each FORM_FIELDS[section] || [] as f (f.key)}
      <div class="ffield full">
        <label for="m-{f.key}">{f.label}{#if f.required} *{/if}</label>
        {#if f.textarea}
          <textarea id="m-{f.key}" class="tk-input" rows="3" bind:value={form[f.key]}></textarea>
        {:else}
          <input id="m-{f.key}" class="tk-input" bind:value={form[f.key]} />
        {/if}
      </div>
    {/each}
  </div>
  {#if ferr}<p class="err">{ferr}</p>{/if}
  <div class="formbtns">
    <button class="tk-btn-ghost act" onclick={() => (simpleModal = false)}>Cancel</button>
    <button class="tk-btn-primary act" onclick={saveForm}>Save</button>
  </div>
</Modal>

<!-- Bulk assign employees -->
{#if sel && hasEmployees}
  <ImportWizard bind:open={wizardOpen}
    title={`Bulk Assign Employees → ${sel.name}`}
    fields={EMP_FIELDS}
    templateRows={[['ananya@aviary.io', 'Ananya Rao']]}
    onImport={bulkAssign} />
{/if}

<!-- Import locations -->
<ImportWizard bind:open={importLocsOpen}
  title="Import Locations"
  fields={[
    { key: 'name', label: 'Name', required: true },
    { key: 'timezone', label: 'Timezone' },
    { key: 'country', label: 'Country' },
    { key: 'city', label: 'City' },
    { key: 'address1', label: 'Address Line 1' },
  ]}
  templateRows={[['Chennai', 'Asia/Kolkata', 'India', 'Chennai', 'Tidel Park']]}
  onImport={async (rows) => {
    for (const r of rows) {
      await api('org/structure/locations', { method: 'POST', body: JSON.stringify({ action: 'create', data: r }) });
    }
    await load();
    return `${rows.length} locations imported successfully`;
  }} />

<style>
  .toast { position: fixed; left: 50%; top: 80px; transform: translateX(-50%); z-index: 80;
    background: var(--t-ink); color: var(--t-bg); padding: 10px 20px; border-radius: 999px;
    font: 700 13px var(--t-font-body); box-shadow: var(--t-shadow-pop); }
  .tabs { display: flex; gap: 2px; overflow-x: auto; padding: 0 8px; margin-bottom: 18px;
    position: sticky; top: 64px; z-index: 20; }
  .tabs button { padding: 13px 12px; font: 700 12px var(--t-font-body); color: var(--t-muted);
    white-space: nowrap; position: relative; }
  .tabs button.on { color: var(--t-accent); }
  .tabs button.on::after { content: ''; position: absolute; left: 10px; right: 10px; bottom: 0;
    height: 2.5px; border-radius: 3px 3px 0 0; background: var(--t-accent); }
  .err { padding: 10px 14px; border-radius: 12px; background: rgba(225,29,72,0.1);
    font: 500 13px var(--t-font-body); color: #e11d48; }
  .err button { font-weight: 700; text-decoration: underline; }
  .head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
  .head h2 { margin: 0; font: 600 18px var(--t-font-display); color: var(--t-ink); }
  .split { display: grid; gap: 18px; grid-template-columns: 230px 1fr; }
  @media (max-width: 860px) { .split { grid-template-columns: 1fr; } }
  .navpane { padding: 12px; height: fit-content; }
  .navhead { display: flex; justify-content: space-between; align-items: center; padding: 0 6px 8px; }
  .navhead small { font: 700 10.5px var(--t-font-body); text-transform: uppercase;
    letter-spacing: 0.1em; color: var(--t-muted); }
  .addbtn { width: 26px; height: 26px; border-radius: 8px; font-size: 14px; }
  .navitem { display: block; width: 100%; text-align: left; padding: 10px 14px; border-radius: 12px;
    font: 700 13px var(--t-font-body); color: color-mix(in srgb, var(--t-ink) 75%, transparent); }
  .navitem small { display: block; font: 500 10.5px var(--t-font-body); color: var(--t-muted); }
  .navitem.on { background: var(--t-surface); box-shadow: var(--t-inset); color: var(--t-accent); }
  .imp { width: 100%; margin-top: 10px; }
  .detail { min-width: 0; }
  .detailbar { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 10px; margin-bottom: 14px; }
  .seg { display: inline-flex; gap: 2px; padding: 4px; border-radius: 12px; }
  .seg button { padding: 6px 14px; border-radius: 8px; font: 700 11.5px var(--t-font-body); color: var(--t-muted); }
  .seg button.on { background: var(--t-surface); box-shadow: var(--t-shadow-card); color: var(--t-accent); }
  .detailacts { display: flex; gap: 8px; }
  .act { padding: 8px 14px; font: 600 12px var(--t-font-body); border-radius: 12px; }
  .summary { padding: 18px; }
  .sgrid { display: grid; gap: 14px; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); }
  .sfield small { display: block; font: 700 10px var(--t-font-body); text-transform: uppercase;
    letter-spacing: 0.08em; color: var(--t-muted); }
  .sfield b { font: 600 13px var(--t-font-body); color: var(--t-ink); }
  .lesub { margin-top: 16px; }
  .lst { margin: 14px 0 8px; font: 600 13.5px var(--t-font-display); color: var(--t-ink); }
  .chiprow { padding: 8px 14px; border-radius: 12px; margin-bottom: 6px;
    font: 600 12px var(--t-font-body); color: color-mix(in srgb, var(--t-ink) 80%, transparent); }
  .empty { font: 500 12px var(--t-font-body); color: var(--t-muted); }
  .taskrow { display: flex; align-items: center; gap: 10px; width: 100%; padding: 8px 10px;
    border-radius: 10px; text-align: left; }
  .taskrow:hover { background: color-mix(in srgb, var(--t-accent) 6%, transparent); }
  .taskrow i { font-style: normal; color: var(--t-muted); }
  .taskrow i.doneI { color: var(--t-accent); }
  .taskrow span { font: 600 13px var(--t-font-body); color: var(--t-ink); }
  .taskrow span.doneT { color: var(--t-muted); text-decoration: line-through; }
  .togglerow { display: flex; justify-content: space-between; align-items: center; gap: 12px;
    width: 100%; padding: 12px 6px; text-align: left;
    border-bottom: 1px solid color-mix(in srgb, var(--t-ink) 6%, transparent); }
  .togglerow span { font: 600 13px var(--t-font-body); color: var(--t-ink); }
  .knobtrack { position: relative; width: 36px; height: 20px; border-radius: 999px;
    box-shadow: var(--t-inset); background: var(--t-surface); flex-shrink: 0; }
  .knobtrack.onK { background: var(--t-accent); box-shadow: none; }
  .knobtrack em { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px;
    border-radius: 999px; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.3);
    transition: left 0.18s; }
  .knobtrack.onK em { left: 18px; }
  .formgrid { display: grid; gap: 12px; grid-template-columns: repeat(2, 1fr); }
  .formgrid.one { grid-template-columns: 1fr; }
  .ffield.full { grid-column: 1 / -1; }
  .ffield label { display: block; margin-bottom: 5px; font: 700 10.5px var(--t-font-body);
    text-transform: uppercase; letter-spacing: 0.1em; color: var(--t-muted); }
  .ffield input, .ffield textarea { width: 100%; padding: 9px 12px; font: 500 13px var(--t-font-body); }
  .formbtns { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
</style>
