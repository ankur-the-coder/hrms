<script lang="ts" generics="T extends Record<string, unknown>">
  // Shared DataTable — mirrors React src/shared/DataTable.tsx:
  // list / kanban (drag & drop) / gallery / calendar / timeline / chart views,
  // search, per-column filters, sort, select-all (full filtered set),
  // bulk + row actions, smooth in-table row expansion, column manager,
  // pages-only pagination, loading state that keeps table height, reload,
  // exports: PDF (pdfMake) · Excel (ExcelJS, hyperlinked detail sheets) ·
  // CSV · Print (hidden hi-res iframe).
  import { loadPdfMake, loadExcelJS, downloadBlob, printHtml } from '$lib/api';
  import NeuLoader from './NeuLoader.svelte';

  export interface Column { key: string; label: string; sortable?: boolean; filterOptions?: string[]; defaultHidden?: boolean }
  export interface RowAction { label: string; danger?: boolean; onClick: (row: T) => void }
  export type ViewKind = 'list' | 'kanban' | 'gallery' | 'calendar' | 'timeline' | 'chart';

  let {
    data = [] as T[],
    columns = [] as Column[],
    rowKey = (r: T) => JSON.stringify(r),
    views = ['list'] as ViewKind[],
    pageSize = 10,
    groupField = '',
    dateField = '',
    cardTitle = (r: T) => String(r[columns[0]?.key] ?? ''),
    loading = false,
    onReload = null as null | (() => void),
    onKanbanMove = null as null | ((row: T, group: string) => void),
    bulkActions = [] as string[],
    onBulk = (_a: string, _rows: T[]) => {},
    rowActions = [] as RowAction[],
    exportName = 'data',
    exportDetail = null as null | ((row: T) => Record<string, string | number>),
    expandable = null as null | ((row: T) => string),
  } = $props();

  let view: ViewKind = $state(views[0]);
  let q = $state('');
  let sortKey = $state('');
  let sortDir = $state(1);
  let page = $state(0);
  let selected = $state(new Set<string>());
  let expanded = $state(new Set<string>());
  let hidden = $state(new Set(columns.filter((c) => c.defaultHidden).map((c) => c.key)));
  let filters: Record<string, string> = $state({});
  let calMonth = $state(new Date());
  let dragKey: string | null = $state(null);
  let dragOverCol: string | null = $state(null);
  let exporting = $state(false);
  let menuFor: string | null = $state(null);
  let exportOpen = $state(false);
  let colsOpen = $state(false);

  const get = (r: T, k: string) => String(r[k] ?? '');
  const parseDate = (s: string): Date | null => {
    if (!s) return null;
    const d = new Date(s.includes('T') ? s : s + 'T00:00:00');
    return isNaN(d.getTime()) ? null : d;
  };

  const processed = $derived.by(() => {
    let rows = data;
    const t = q.trim().toLowerCase();
    if (t) rows = rows.filter((r) => columns.some((c) => get(r, c.key).toLowerCase().includes(t)));
    for (const [k, v] of Object.entries(filters)) if (v) rows = rows.filter((r) => get(r, k) === v);
    if (sortKey) rows = [...rows].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * sortDir;
      return get(a, sortKey).localeCompare(get(b, sortKey)) * sortDir;
    });
    return rows;
  });
  const totalPages = $derived(Math.max(1, Math.ceil(processed.length / pageSize)));
  const pageRows = $derived(processed.slice(page * pageSize, (page + 1) * pageSize));
  const shownCols = $derived(columns.filter((c) => !hidden.has(c.key)));
  // select-all covers the ENTIRE filtered result, not just the visible page
  const allSelected = $derived(processed.length > 0 && processed.every((r) => selected.has(String(rowKey(r)))));

  $effect(() => { void q; void filters; void sortKey; void view; page = 0; });

  function cycleSort(k: string) {
    if (sortKey !== k) { sortKey = k; sortDir = 1; }
    else if (sortDir === 1) sortDir = -1;
    else sortKey = '';
  }
  function toggleSel(k: string) {
    const n = new Set(selected);
    n.has(k) ? n.delete(k) : n.add(k);
    selected = n;
  }
  function toggleAll() {
    selected = allSelected ? new Set() : new Set(processed.map((r) => String(rowKey(r))));
  }
  function toggleExpand(k: string) {
    const n = new Set(expanded);
    n.has(k) ? n.delete(k) : n.add(k);
    expanded = n;
  }

  const groups = $derived.by(() => {
    const m = new Map<string, T[]>();
    if (groupField) for (const r of processed) {
      const g = get(r, groupField) || '—';
      if (!m.has(g)) m.set(g, []);
      m.get(g)!.push(r);
    }
    return [...m.entries()];
  });

  const calCells = $derived.by(() => {
    if (view !== 'calendar' || !dateField) return [];
    const y = calMonth.getFullYear(), m = calMonth.getMonth();
    const firstDow = new Date(y, m, 1).getDay();
    const days = new Date(y, m + 1, 0).getDate();
    const byDay = new Map<number, T[]>();
    processed.forEach((r) => {
      const d = parseDate(get(r, dateField));
      if (d && d.getFullYear() === y && d.getMonth() === m) {
        if (!byDay.has(d.getDate())) byDay.set(d.getDate(), []);
        byDay.get(d.getDate())!.push(r);
      }
    });
    return [
      ...Array.from({ length: firstDow }, () => null),
      ...Array.from({ length: days }, (_, i) => ({ day: i + 1, items: byDay.get(i + 1) || [] })),
    ];
  });

  const timelineGroups = $derived.by(() => {
    if (view !== 'timeline' || !dateField) return [];
    const sorted = [...processed].sort((a, b) => get(b, dateField).localeCompare(get(a, dateField)));
    const m = new Map<string, T[]>();
    sorted.forEach((r) => {
      const d = parseDate(get(r, dateField));
      if (!d) return;
      const key = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(r);
    });
    return [...m.entries()];
  });

  /* ---------------- exports ---------------- */
  async function doExport(fmt: string) {
    exportOpen = false;
    const cols = shownCols;
    const rows = processed;
    const stamp = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    exporting = true;
    try {
      if (fmt === 'csv') {
        const head = cols.map((c) => `"${c.label}"`).join(',');
        const lines = rows.map((r) => cols.map((c) => `"${get(r, c.key).replace(/"/g, '""')}"`).join(','));
        downloadBlob(`${exportName}.csv`, new Blob([head + '\n' + lines.join('\n')], { type: 'text/csv' }));
      } else if (fmt === 'pdf') {
        const pdfMake = await loadPdfMake();
        const body = [
          cols.map((c) => ({ text: c.label, style: 'th' })),
          ...rows.map((r) => cols.map((c) => ({ text: get(r, c.key), style: 'td' }))),
        ];
        pdfMake.createPdf({
          pageOrientation: cols.length > 5 ? 'landscape' : 'portrait',
          pageMargins: [28, 64, 28, 44],
          header: {
            margin: [28, 20, 28, 0],
            columns: [
              { text: 'AVIARY · PEOPLE OS', color: '#0d7a54', bold: true, fontSize: 9, characterSpacing: 1 },
              { text: stamp, alignment: 'right', color: '#8a938d', fontSize: 9 },
            ],
          },
          footer: (p: number, t: number) => ({
            margin: [28, 8, 28, 0],
            columns: [
              { text: `${rows.length} records`, color: '#8a938d', fontSize: 8 },
              { text: `Page ${p} of ${t}`, alignment: 'right', color: '#8a938d', fontSize: 8 },
            ],
          }),
          content: [
            { text: exportName.replace(/-/g, ' ').toUpperCase(), fontSize: 15, bold: true, color: '#1c2620', margin: [0, 0, 0, 12] },
            {
              table: { headerRows: 1, widths: cols.map(() => '*'), body },
              layout: {
                fillColor: (i: number) => (i === 0 ? '#0d7a54' : i % 2 === 0 ? '#f2f4f0' : null),
                hLineColor: () => '#dde2dd', vLineColor: () => '#dde2dd',
                hLineWidth: () => 0.5, vLineWidth: () => 0.5,
                paddingTop: () => 5, paddingBottom: () => 5, paddingLeft: () => 6, paddingRight: () => 6,
              },
            },
          ],
          styles: { th: { color: '#ffffff', bold: true, fontSize: 8.5 }, td: { color: '#2c352f', fontSize: 8.5 } },
        }).download(`${exportName}.pdf`);
      } else if (fmt === 'excel') {
        const ExcelJS = await loadExcelJS();
        const wb = new ExcelJS.Workbook();
        wb.creator = 'Aviary People OS';
        const ws = wb.addWorksheet('Data', { views: [{ state: 'frozen', ySplit: 2 }] });
        ws.mergeCells(1, 1, 1, cols.length);
        const title = ws.getCell(1, 1);
        title.value = exportName.replace(/-/g, ' ').toUpperCase() + '  ·  ' + stamp;
        title.font = { bold: true, size: 13, color: { argb: 'FF0D7A54' } };
        ws.getRow(1).height = 24;
        const headRow = ws.addRow(cols.map((c) => c.label));
        headRow.eachCell((cell: { font: unknown; fill: unknown }) => {
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D7A54' } };
        });
        rows.forEach((r, ri) => {
          const row = ws.addRow(cols.map((c) => {
            const raw = r[c.key];
            return typeof raw === 'number' ? raw : get(r, c.key);
          }));
          if (ri % 2 === 1) row.eachCell((cell: { fill: unknown }) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F4F0' } };
          });
          if (exportDetail) {
            const detail = exportDetail(r);
            if (detail && Object.keys(detail).length) {
              const sheetName = `Row ${ri + 2}`;
              const ds = wb.addWorksheet(sheetName);
              ds.getCell('A1').value = { text: '← Back to Data', hyperlink: `#'Data'!A${ri + 3}` };
              ds.getCell('A1').font = { color: { argb: 'FF0D7A54' }, underline: true, bold: true };
              ds.addRow([]);
              const dh = ds.addRow(['Field', 'Value']);
              dh.eachCell((cell: { font: unknown; fill: unknown }) => {
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D7A54' } };
              });
              Object.entries(detail).forEach(([k, v]) => ds.addRow([k, v]));
              ds.getColumn(1).width = 26;
              ds.getColumn(2).width = 44;
              const first = row.getCell(1);
              first.value = { text: String(first.value ?? ''), hyperlink: `#'${sheetName}'!A1` };
              first.font = { color: { argb: 'FF0D7A54' }, underline: true };
            }
          }
        });
        cols.forEach((c, i) => {
          const maxLen = Math.max(c.label.length, ...rows.slice(0, 200).map((r) => get(r, c.key).length));
          ws.getColumn(i + 1).width = Math.min(38, Math.max(11, maxLen + 3));
        });
        const buf = await wb.xlsx.writeBuffer();
        downloadBlob(`${exportName}.xlsx`, new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      } else if (fmt === 'print') {
        printHtml(`<!doctype html><html><head><title>${exportName}</title><style>
          @page { margin: 14mm; }
          body { font-family: 'Segoe UI', system-ui, sans-serif; color: #1c2620; margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .brand { color: #0d7a54; font-weight: 800; font-size: 11px; letter-spacing: 2px; }
          h1 { font-size: 19px; margin: 4px 0 2px; text-transform: capitalize; }
          .meta { color: #79837c; font-size: 11px; margin-bottom: 14px; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th { background: #0d7a54; color: #fff; text-align: left; padding: 7px 8px; font-size: 10px; }
          td { padding: 6px 8px; border-bottom: 0.5px solid #dde2dd; }
          tr:nth-child(even) td { background: #f4f6f2; }
          thead { display: table-header-group; }
        </style></head><body>
          <div class="brand">AVIARY · PEOPLE OS</div>
          <h1>${exportName.replace(/-/g, ' ')}</h1>
          <div class="meta">${stamp} · ${rows.length} records</div>
          <table><thead><tr>${cols.map((c) => `<th>${c.label}</th>`).join('')}</tr></thead>
          <tbody>${rows.map((r) => `<tr>${cols.map((c) => `<td>${get(r, c.key)}</td>`).join('')}</tr>`).join('')}</tbody></table>
        </body></html>`);
      }
    } finally { exporting = false; }
  }
</script>

<svelte:window onmousedown={() => { menuFor = null; exportOpen = false; colsOpen = false; }} />

<div class="tk-card">
  <!-- toolbar (visible but disabled while loading) -->
  <div class="toolbar" class:dim={loading}>
    <div class="tk-inset sbox">
      <span>⌕</span>
      <input bind:value={q} placeholder="Search…" disabled={loading} />
    </div>
    {#each columns.filter((c) => c.filterOptions?.length) as c (c.key)}
      <select class="tk-input fsel" bind:value={filters[c.key]} disabled={loading}>
        <option value="">{c.label}: all</option>
        {#each c.filterOptions ?? [] as o (o)}<option>{o}</option>{/each}
      </select>
    {/each}
    <div class="spacer"></div>
    {#if onReload}
      <button class="tk-btn-ghost ib" data-tip="Reload data" disabled={loading} onclick={onReload}>
        <span class:spin={loading}>⟳</span>
      </button>
    {/if}
    <div class="menuwrap" role="presentation" onmousedown={(e) => e.stopPropagation()}>
      <button class="tk-btn-ghost ib txt" disabled={loading} onclick={() => (exportOpen = !exportOpen)}>
        {exporting ? 'Exporting…' : '⤓ Export'}
      </button>
      {#if exportOpen}
        <div class="tk-pop menu">
          {#each [['pdf', 'PDF document'], ['excel', 'Excel workbook'], ['csv', 'CSV data'], ['print', 'Print…']] as [k, l] (k)}
            <button onclick={() => doExport(k)}>{l}</button>
          {/each}
        </div>
      {/if}
    </div>
    {#if view === 'list'}
      <div class="menuwrap" role="presentation" onmousedown={(e) => e.stopPropagation()}>
        <button class="tk-btn-ghost ib" data-tip="Show / hide columns" disabled={loading} onclick={() => (colsOpen = !colsOpen)}>▦</button>
        {#if colsOpen}
          <div class="tk-pop menu">
            {#each columns as c (c.key)}
              <label class="chk">
                <input type="checkbox" checked={!hidden.has(c.key)}
                  onchange={() => { const n = new Set(hidden); n.has(c.key) ? n.delete(c.key) : n.add(c.key); hidden = n; }} />
                {c.label}
              </label>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
    {#if views.length > 1}
      <div class="tk-inset seg">
        {#each views as v (v)}
          <button class:on={view === v} disabled={loading} onclick={() => (view = v)}>{v}</button>
        {/each}
      </div>
    {/if}
  </div>

  <!-- bulk bar -->
  {#if selected.size && bulkActions.length}
    <div class="bulk">
      <b>{selected.size} selected</b>
      {#each bulkActions as a (a)}
        <button class="tk-btn-ghost ba"
          onclick={() => { onBulk(a, data.filter((r) => selected.has(String(rowKey(r))))); selected = new Set(); }}>{a}</button>
      {/each}
      <button class="clear" onclick={() => (selected = new Set())}>Clear</button>
    </div>
  {/if}

  {#if loading}
    <div style="min-height:{Math.max(280, pageSize * 46)}px;display:flex;align-items:center;justify-content:center">
      <NeuLoader label="Loading records…" />
    </div>
  {:else if !processed.length}
    <div class="empty"><b>No records</b><span>Try adjusting your search or filters.</span></div>
  {:else if view === 'list'}
    <div class="scroll">
      <table>
        <thead><tr>
          <th class="w40" data-tip={allSelected ? 'Deselect all' : `Select all ${processed.length}`}>
            <input type="checkbox" checked={allSelected} onchange={toggleAll} />
          </th>
          {#if expandable}<th class="w40"></th>{/if}
          {#each shownCols as c (c.key)}
            <th class="sortable" onclick={() => c.sortable !== false && cycleSort(c.key)}>
              {c.label}{sortKey === c.key ? (sortDir === 1 ? ' ↑' : ' ↓') : ''}
            </th>
          {/each}
          {#if rowActions.length}<th class="w40"></th>{/if}
        </tr></thead>
        <tbody>
          {#each pageRows as r (rowKey(r))}
            {@const k = String(rowKey(r))}
            <tr>
              <td><input type="checkbox" checked={selected.has(k)} onchange={() => toggleSel(k)} /></td>
              {#if expandable}
                <td><button class="exp" class:open={expanded.has(k)} onclick={() => toggleExpand(k)}>›</button></td>
              {/if}
              {#each shownCols as c (c.key)}<td>{get(r, c.key)}</td>{/each}
              {#if rowActions.length}
                <td class="acts" role="presentation" onmousedown={(e) => e.stopPropagation()}>
                  <button class="dots" onclick={() => (menuFor = menuFor === k ? null : k)}>⋯</button>
                  {#if menuFor === k}
                    <div class="tk-pop menu ract">
                      {#each rowActions as a (a.label)}
                        <button class:danger={a.danger} onclick={() => { menuFor = null; a.onClick(r); }}>{a.label}</button>
                      {/each}
                    </div>
                  {/if}
                </td>
              {/if}
            </tr>
            {#if expandable}
              <tr class="exprow"><td colspan={2 + shownCols.length + (rowActions.length ? 1 : 0)}>
                <div class="tk-expand" class:open={expanded.has(k)}>
                  <div><div class="tk-inset expbody">{expandable(r)}</div></div>
                </div>
              </td></tr>
            {/if}
          {/each}
        </tbody>
      </table>
    </div>
    <div class="footer">
      <span>Page {page + 1} of {totalPages} · {processed.length} records</span>
      <div class="pager">
        <button class="tk-btn-ghost pg" disabled={page === 0} onclick={() => page--}>‹</button>
        {#each Array.from({ length: Math.min(5, totalPages) }, (_, i) => totalPages <= 5 ? i : Math.max(0, Math.min(page - 2, totalPages - 5)) + i) as p (p)}
          <button class="pnum" class:on={p === page} onclick={() => (page = p)}>{p + 1}</button>
        {/each}
        <button class="tk-btn-ghost pg" disabled={page >= totalPages - 1} onclick={() => page++}>›</button>
      </div>
    </div>
  {:else if view === 'kanban'}
    <div class="kanban hide-scrollbar">
      {#each groups as [g, rows] (g)}
        <div class="kcol">
          <p class="kh">{g} <i>{rows.length}</i></p>
          <div class="tk-inset kwell kanban-col" class:drag-over={dragOverCol === g}
            role="list"
            ondragover={(e) => { if (onKanbanMove) { e.preventDefault(); dragOverCol = g; } }}
            ondragleave={() => { if (dragOverCol === g) dragOverCol = null; }}
            ondrop={(e) => {
              e.preventDefault();
              dragOverCol = null;
              if (!onKanbanMove || dragKey === null) return;
              const row = data.find((r) => String(rowKey(r)) === dragKey);
              if (row && get(row, groupField) !== g) onKanbanMove(row, g);
              dragKey = null;
            }}>
            {#each rows as r (rowKey(r))}
              <div class="tk-raise-sm kcard kanban-card" class:dragging={dragKey === String(rowKey(r))}
                role="listitem" draggable={!!onKanbanMove}
                ondragstart={() => (dragKey = String(rowKey(r)))}
                ondragend={() => { dragKey = null; dragOverCol = null; }}>
                {cardTitle(r)}
              </div>
            {:else}
              <p class="kdrop">Drop here</p>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {:else if view === 'gallery'}
    <div class="gallery">
      {#each pageRows as r (rowKey(r))}
        <div class="tk-raise-sm gcard"><b>{cardTitle(r)}</b>{#if dateField}<small>{get(r, dateField)}</small>{/if}</div>
      {/each}
    </div>
  {:else if view === 'calendar'}
    <div class="calwrap">
      <div class="calnav">
        <button class="tk-btn-ghost pg" onclick={() => (calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() - 1))}>‹</button>
        <b>{calMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</b>
        <button class="tk-btn-ghost pg" onclick={() => (calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1))}>›</button>
      </div>
      <div class="calgrid">
        {#each ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as d (d)}<span class="dow">{d}</span>{/each}
        {#each calCells as cell, i (i)}
          {#if !cell}<span></span>
          {:else}
            <div class="tk-inset calcell">
              <small>{cell.day}</small>
              {#each cell.items.slice(0, 2) as r (rowKey(r))}<em title={cardTitle(r)}>{cardTitle(r)}</em>{/each}
              {#if cell.items.length > 2}<i>+{cell.items.length - 2} more</i>{/if}
            </div>
          {/if}
        {/each}
      </div>
    </div>
  {:else if view === 'timeline'}
    <div class="tl">
      {#each timelineGroups as [mo, rows] (mo)}
        <div class="tlg">
          <span class="tldot"></span>
          <b>{mo}</b>
          {#each rows as r (rowKey(r))}
            <div class="tk-raise-sm tlrow">
              <span>{cardTitle(r)}</span>
              <em>{parseDate(get(r, dateField))?.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) || '—'}</em>
            </div>
          {/each}
        </div>
      {/each}
    </div>
  {:else if view === 'chart'}
    <div class="chart">
      {#each groups as [g, rows], i (g)}
        <div class="brow">
          <span>{g}</span>
          <div class="tk-inset track"><div class="fill" style="width:{(rows.length / Math.max(...groups.map(([, r]) => r.length), 1)) * 100}%; transition-delay:{i * 50}ms"></div></div>
          <b>{rows.length}</b>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 12px 16px;
    border-bottom: 1px solid color-mix(in srgb, var(--t-ink) 8%, transparent); }
  .toolbar.dim { pointer-events: none; opacity: 0.55; }
  .sbox { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 12px;
    flex: 1; min-width: 160px; max-width: 260px; }
  .sbox span { color: var(--t-muted); }
  .sbox input { flex: 1; min-width: 0; background: none; border: 0; outline: none;
    font: 500 13px var(--t-font-body); color: var(--t-ink); }
  .fsel { padding: 8px 10px; font: 600 12px var(--t-font-body); }
  .spacer { flex: 1; }
  .ib { padding: 8px 10px; border-radius: 12px; font-size: 14px; }
  .ib.txt { font: 700 12px var(--t-font-body); }
  .spin { display: inline-block; animation: tk-spin 1s linear infinite; }
  .menuwrap { position: relative; }
  .menu { position: absolute; right: 0; top: calc(100% + 6px); z-index: 50; min-width: 160px; padding: 6px; }
  .menu button { display: block; width: 100%; text-align: left; padding: 8px 12px; border-radius: 8px;
    font: 600 12.5px var(--t-font-body); color: color-mix(in srgb, var(--t-ink) 80%, transparent); }
  .menu button:hover { background: color-mix(in srgb, var(--t-accent) 8%, transparent); }
  .menu button.danger { color: #e11d48; }
  .chk { display: flex; align-items: center; gap: 8px; padding: 7px 12px; border-radius: 8px;
    font: 600 13px var(--t-font-body); color: var(--t-ink); cursor: pointer; }
  .chk:hover { background: color-mix(in srgb, var(--t-accent) 8%, transparent); }
  .seg { display: flex; gap: 2px; padding: 4px; border-radius: 12px; }
  .seg button { padding: 5px 10px; border-radius: 8px; font: 700 11px var(--t-font-body);
    text-transform: capitalize; color: var(--t-muted); }
  .seg button.on { background: var(--t-surface); box-shadow: var(--t-shadow-card); color: var(--t-accent); }
  .bulk { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 10px 16px;
    background: color-mix(in srgb, var(--t-accent) 6%, transparent);
    border-bottom: 1px solid color-mix(in srgb, var(--t-ink) 6%, transparent); }
  .bulk b { font: 700 12.5px var(--t-font-body); color: var(--t-accent); }
  .ba { padding: 6px 12px; font: 700 12px var(--t-font-body); border-radius: 10px; }
  .clear { margin-left: auto; font: 700 12px var(--t-font-body); color: var(--t-muted); }
  .empty { text-align: center; padding: 44px 0; }
  .empty b { display: block; font: 600 15px var(--t-font-display); color: color-mix(in srgb, var(--t-ink) 80%, transparent); }
  .empty span { font: 500 13px var(--t-font-body); color: var(--t-muted); }
  .scroll { overflow-x: auto; }
  table { width: 100%; min-width: 640px; border-collapse: collapse; }
  th { text-align: left; padding: 10px 16px; font: 700 10.5px var(--t-font-body);
    text-transform: uppercase; letter-spacing: 0.08em; color: var(--t-muted);
    border-bottom: 1px solid color-mix(in srgb, var(--t-ink) 8%, transparent); }
  th.sortable { cursor: pointer; user-select: none; }
  th.sortable:hover { color: var(--t-ink); }
  .w40 { width: 40px; }
  td { padding: 10px 16px; font: 500 13px var(--t-font-body); color: color-mix(in srgb, var(--t-ink) 82%, transparent);
    border-top: 1px solid color-mix(in srgb, var(--t-ink) 6%, transparent); }
  tr.exprow td { padding: 0; border: 0; }
  .exp { color: var(--t-muted); font-size: 15px; transition: transform 0.2s; display: inline-block; padding: 2px 6px; }
  .exp.open { transform: rotate(90deg); color: var(--t-accent); }
  .expbody { margin: 4px 16px 12px; padding: 12px 16px; border-radius: 12px;
    font: 500 12.5px var(--t-font-body); color: color-mix(in srgb, var(--t-ink) 78%, transparent); white-space: pre-wrap; }
  .acts { position: relative; text-align: right; }
  .dots { font-size: 15px; color: var(--t-muted); padding: 2px 8px; border-radius: 8px; }
  .dots:hover { color: var(--t-ink); }
  .ract { min-width: 150px; }
  .footer { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center;
    gap: 10px; padding: 10px 16px; border-top: 1px solid color-mix(in srgb, var(--t-ink) 8%, transparent);
    font: 600 12px var(--t-font-body); color: var(--t-muted); }
  .pager { display: flex; align-items: center; gap: 4px; }
  .pg { padding: 4px 10px; border-radius: 10px; }
  .pg:disabled { opacity: 0.4; }
  .pnum { width: 28px; height: 28px; border-radius: 10px; font: 700 12px var(--t-font-body); color: var(--t-muted); }
  .pnum.on { background: linear-gradient(145deg, var(--t-accent), var(--t-accent-deep)); color: #fff;
    box-shadow: var(--t-shadow-card); }
  .kanban { display: flex; gap: 14px; padding: 16px; overflow-x: auto; }
  .kcol { min-width: 230px; }
  .kh { display: flex; justify-content: space-between; margin: 0 4px 8px;
    font: 700 12px var(--t-font-body); text-transform: uppercase; letter-spacing: 0.06em; color: color-mix(in srgb, var(--t-ink) 70%, transparent); }
  .kh i { font-style: normal; color: var(--t-muted); }
  .kwell { min-height: 120px; padding: 8px; border-radius: 12px; display: flex; flex-direction: column; gap: 8px; }
  .kcard { border-radius: 12px; padding: 10px 12px; font: 600 13px var(--t-font-body); color: var(--t-ink);
    transition: transform 0.15s; }
  .kcard:hover { transform: translateY(-2px); }
  .kdrop { text-align: center; font: 600 11px var(--t-font-body); color: var(--t-muted); padding: 14px 0; margin: 0; }
  .gallery { display: grid; gap: 12px; padding: 16px; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); }
  .gcard { border-radius: 14px; padding: 14px; }
  .gcard b { display: block; font: 700 13px var(--t-font-body); color: var(--t-ink); }
  .gcard small { font: 500 11px var(--t-font-body); color: var(--t-muted); }
  .calwrap { padding: 16px; }
  .calnav { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
  .calnav b { font: 600 15px var(--t-font-display); color: var(--t-ink); }
  .calgrid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
  .dow { text-align: center; font: 700 10px var(--t-font-body); text-transform: uppercase; color: var(--t-muted); padding-bottom: 4px; }
  .calcell { min-height: 70px; border-radius: 12px; padding: 6px; }
  .calcell small { font: 700 11px var(--t-font-body); color: color-mix(in srgb, var(--t-ink) 60%, transparent); }
  .calcell em { display: block; margin-top: 2px; padding: 1px 5px; border-radius: 5px;
    background: color-mix(in srgb, var(--t-accent) 12%, transparent);
    font: 700 10px var(--t-font-body); font-style: normal; color: var(--t-accent);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .calcell i { font: 700 9.5px var(--t-font-body); font-style: normal; color: var(--t-muted); }
  .tl { padding: 20px; }
  .tlg { position: relative; padding: 0 0 20px 20px; border-left: 2px solid color-mix(in srgb, var(--t-accent) 25%, transparent); }
  .tldot { position: absolute; left: -7px; top: 0; width: 12px; height: 12px; border-radius: 999px; background: var(--t-accent); }
  .tlg b { display: block; margin-bottom: 8px; font: 600 14px var(--t-font-display); color: var(--t-ink); }
  .tlrow { display: flex; justify-content: space-between; gap: 12px; padding: 8px 14px;
    border-radius: 12px; margin-bottom: 6px; font: 600 13px var(--t-font-body); color: var(--t-ink); }
  .tlrow em { font: 600 11px var(--t-font-body); font-style: normal; color: var(--t-muted); font-variant-numeric: tabular-nums; }
  .chart { padding: 18px; display: flex; flex-direction: column; gap: 12px; }
  .brow { display: grid; grid-template-columns: 130px 1fr 34px; gap: 10px; align-items: center;
    font: 600 12px var(--t-font-body); color: var(--t-ink); }
  .track { height: 14px; border-radius: 999px; overflow: hidden; }
  .fill { height: 100%; border-radius: 999px; background: var(--t-accent); transition: width 0.7s ease; }
</style>
