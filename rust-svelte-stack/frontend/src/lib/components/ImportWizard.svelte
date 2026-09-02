<script lang="ts">
  // 3-step bulk import wizard — file upload OR link (Google Sheets /
  // OneDrive-Outlook / any public CSV, fetched via backend), column mapping,
  // review & commit. Mirrors React src/shared/ImportWizard.tsx.
  import { api, downloadBlob } from '$lib/api';
  import Modal from './Modal.svelte';
  import NeuLoader from './NeuLoader.svelte';

  export interface Field { key: string; label: string; required?: boolean }
  let {
    open = $bindable(false),
    title = 'Bulk Import',
    fields = [] as Field[],
    templateRows = [] as string[][],
    onImport = async (_rows: Record<string, string>[]): Promise<string> => '',
  } = $props();

  let step = $state(1);
  let headers: string[] = $state([]);
  let rows: string[][] = $state([]);
  let mapping: Record<string, number> = $state({});
  let link = $state('');
  let busy = $state(false);
  let err = $state('');
  let done = $state('');
  let sourceName = $state('');

  $effect(() => { if (!open) { step = 1; headers = []; rows = []; mapping = {}; link = ''; err = ''; done = ''; } });

  function parseCsv(text: string): string[][] {
    const out: string[][] = [];
    let row: string[] = [], cell = '', inQ = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQ) {
        if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else inQ = false; }
        else cell += ch;
      } else if (ch === '"') inQ = true;
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); cell = '';
        if (row.some((c) => c.trim())) out.push(row);
        row = [];
      } else cell += ch;
    }
    row.push(cell);
    if (row.some((c) => c.trim())) out.push(row);
    return out;
  }

  function ingest(text: string, name: string) {
    const parsed = parseCsv(text);
    if (parsed.length < 2) { err = 'The sheet needs a header row plus at least one data row.'; return; }
    headers = parsed[0].map((h) => h.trim());
    rows = parsed.slice(1);
    sourceName = name;
    const m: Record<string, number> = {};
    fields.forEach((f) => {
      const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
      const idx = headers.findIndex((h) => norm(h).includes(norm(f.key)) || norm(f.label).includes(norm(h)) || norm(h).includes(norm(f.label)));
      if (idx >= 0) m[f.key] = idx;
    });
    mapping = m;
    err = '';
    step = 2;
  }

  function onFile(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    if (f.size > 2_000_000) { err = 'File too large — max 2 MB.'; return; }
    const r = new FileReader();
    r.onload = () => ingest(String(r.result || ''), f.name);
    r.readAsText(f);
    (e.target as HTMLInputElement).value = '';
  }

  async function onLink() {
    if (!/^https?:\/\//.test(link.trim())) { err = 'Paste a valid http(s) link — Google Sheets, OneDrive/Outlook or a direct CSV URL.'; return; }
    busy = true; err = '';
    try {
      const { csv } = await api<{ csv: string }>('org/structure/fetch-link', {
        method: 'POST', body: JSON.stringify({ url: link.trim() }),
      });
      ingest(csv, new URL(link.trim()).hostname);
    } catch (e) {
      err = e instanceof Error ? e.message : 'Could not fetch the link';
    } finally { busy = false; }
  }

  function downloadTemplate() {
    const head = fields.map((f) => `"${f.label}"`).join(',');
    const body = templateRows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    downloadBlob(`${title.toLowerCase().replace(/\s+/g, '-')}-template.csv`, new Blob([head + (body ? '\n' + body : '')], { type: 'text/csv' }));
  }

  const mappedRows = $derived(rows.map((r) => {
    const rec: Record<string, string> = {};
    fields.forEach((f) => {
      const idx = mapping[f.key];
      rec[f.key] = idx !== undefined && idx >= 0 ? (r[idx] || '').trim() : '';
    });
    return rec;
  }).filter((rec) => fields.some((f) => rec[f.key])));
  const requiredMissing = $derived(fields.filter((f) => f.required && mapping[f.key] === undefined));

  async function commit() {
    busy = true; err = '';
    try { done = await onImport(mappedRows); }
    catch (e) { err = e instanceof Error ? e.message : 'Import failed'; }
    finally { busy = false; }
  }
</script>

<Modal bind:open {title} wide>
  <div class="stepper">
    {#each ['Upload', 'Map Columns', 'Review & Import'] as s, i (s)}
      <div class="step">
        <span class="num" class:on={step === i + 1} class:doneN={step > i + 1 || !!done}>{step > i + 1 || done ? '✓' : i + 1}</span>
        <b class:onT={step === i + 1}>{s}</b>
        {#if i < 2}<span class="rail"></span>{/if}
      </div>
    {/each}
  </div>

  {#if done}
    <div class="final">
      <p class="big">✓</p>
      <p class="t">Import complete</p>
      <p class="s">{done}</p>
      <button class="tk-btn-primary act" onclick={() => (open = false)}>Done</button>
    </div>
  {:else if busy && step === 3}
    <NeuLoader label="Importing…" />
  {:else if step === 1}
    <div class="col">
      <div class="tk-inset tmpl">
        <div>
          <b>Download the template</b>
          <small>Fill it in Excel / Google Sheets, then upload or share a link.</small>
        </div>
        <button class="tk-btn-ghost act sm" onclick={downloadTemplate}>Template</button>
      </div>
      <label class="tk-card drop">
        <b>Upload a file</b>
        <small>CSV or Excel-exported CSV · max 2 MB</small>
        <input type="file" accept=".csv,text/csv,.txt" onchange={onFile} />
      </label>
      <div class="or"><span></span><em>or import from a link</em><span></span></div>
      <div class="linkrow">
        <input class="tk-input" bind:value={link} placeholder="Google Sheets, OneDrive / Outlook or direct CSV link…" />
        <button class="tk-btn-primary act sm" disabled={busy} onclick={onLink}>{busy ? 'Fetching…' : 'Fetch'}</button>
      </div>
      <small class="hint">Google Sheets: share as “Anyone with the link”. OneDrive/Outlook: use a download link. Fetched server-side.</small>
      {#if err}<p class="err">{err}</p>{/if}
    </div>
  {:else if step === 2}
    <div class="col">
      <p class="meta"><b>{sourceName}</b> · {rows.length} rows · match each system field to a sheet column.</p>
      {#each fields as f (f.key)}
        <div class="maprow">
          <span class="fname">{f.label}{#if f.required}<i>*</i>{/if}</span>
          <select class="tk-input" value={mapping[f.key] ?? -1}
            onchange={(e) => (mapping = { ...mapping, [f.key]: +(e.target as HTMLSelectElement).value })}>
            <option value={-1}>— Not mapped —</option>
            {#each headers as h, i (i)}<option value={i}>{h || `Column ${i + 1}`}</option>{/each}
          </select>
        </div>
      {/each}
      {#if requiredMissing.length}
        <p class="warn">Map required fields: {requiredMissing.map((f) => f.label).join(', ')}</p>
      {/if}
      <div class="btns">
        <button class="tk-btn-ghost act" onclick={() => (step = 1)}>← Back</button>
        <button class="tk-btn-primary act" disabled={requiredMissing.length > 0} onclick={() => (step = 3)}>Review →</button>
      </div>
    </div>
  {:else}
    <div class="col">
      <p class="meta">Previewing <b>{Math.min(8, mappedRows.length)}</b> of <b>{mappedRows.length}</b> mapped rows.</p>
      <div class="tk-inset preview">
        <table>
          <thead><tr>{#each fields as f (f.key)}<th>{f.label}</th>{/each}</tr></thead>
          <tbody>
            {#each mappedRows.slice(0, 8) as r, i (i)}
              <tr>{#each fields as f (f.key)}<td>{r[f.key] || '—'}</td>{/each}</tr>
            {/each}
          </tbody>
        </table>
      </div>
      {#if err}<p class="err">{err}</p>{/if}
      <div class="btns">
        <button class="tk-btn-ghost act" onclick={() => (step = 2)}>← Back</button>
        <button class="tk-btn-primary act" disabled={busy || !mappedRows.length} onclick={commit}>Import {mappedRows.length} rows</button>
      </div>
    </div>
  {/if}
</Modal>

<style>
  .stepper { display: flex; gap: 8px; margin-bottom: 20px; }
  .step { display: flex; flex: 1; align-items: center; gap: 8px; }
  .num { width: 28px; height: 28px; border-radius: 999px; display: inline-flex; align-items: center;
    justify-content: center; font: 700 12px var(--t-font-body); background: var(--t-surface2);
    box-shadow: var(--t-inset); color: var(--t-muted); flex-shrink: 0; }
  .num.on { color: var(--t-accent); }
  .num.doneN { background: var(--t-accent); color: #fff; box-shadow: var(--t-shadow-card); }
  .step b { font: 700 11.5px var(--t-font-body); color: var(--t-muted); }
  .step b.onT { color: var(--t-ink); }
  .rail { flex: 1; height: 1px; background: color-mix(in srgb, var(--t-ink) 10%, transparent); }
  .col { display: flex; flex-direction: column; gap: 14px; }
  .tmpl { display: flex; justify-content: space-between; align-items: center; gap: 12px;
    padding: 12px 16px; border-radius: 12px; }
  .tmpl b { display: block; font: 700 13px var(--t-font-body); color: var(--t-ink); }
  .tmpl small { font: 500 11.5px var(--t-font-body); color: var(--t-muted); }
  .drop { display: block; text-align: center; padding: 26px; cursor: pointer;
    border: 2px dashed color-mix(in srgb, var(--t-ink) 14%, transparent) !important; }
  .drop b { display: block; font: 700 13.5px var(--t-font-body); color: var(--t-ink); }
  .drop small { font: 500 11.5px var(--t-font-body); color: var(--t-muted); }
  .drop input { display: none; }
  .or { display: flex; align-items: center; gap: 12px; }
  .or span { flex: 1; height: 1px; background: color-mix(in srgb, var(--t-ink) 10%, transparent); }
  .or em { font: 700 10px var(--t-font-body); text-transform: uppercase; letter-spacing: 0.1em;
    color: var(--t-muted); font-style: normal; }
  .linkrow { display: flex; gap: 8px; }
  .linkrow input { flex: 1; padding: 10px 14px; font-size: 12.5px; }
  .hint { font: 500 10.5px var(--t-font-body); color: var(--t-muted); }
  .err { margin: 0; padding: 10px 14px; border-radius: 12px; background: rgba(225, 29, 72, 0.1);
    font: 500 12.5px var(--t-font-body); color: #e11d48; }
  .warn { margin: 0; padding: 10px 14px; border-radius: 12px; background: rgba(217, 119, 6, 0.1);
    font: 600 12px var(--t-font-body); color: #d97706; }
  .meta { margin: 0; font: 500 12.5px var(--t-font-body); color: var(--t-muted); }
  .meta b { color: var(--t-ink); }
  .maprow { display: flex; align-items: center; gap: 12px; }
  .fname { width: 160px; flex-shrink: 0; font: 700 12.5px var(--t-font-body); color: var(--t-ink); }
  .fname i { color: #e11d48; font-style: normal; }
  .maprow select { flex: 1; padding: 8px 10px; font-size: 12.5px; }
  .preview { overflow-x: auto; border-radius: 12px; }
  .preview table { width: 100%; min-width: 480px; border-collapse: collapse; }
  .preview th { padding: 8px 12px; text-align: left; font: 700 10px var(--t-font-body);
    text-transform: uppercase; letter-spacing: 0.08em; color: var(--t-muted);
    border-bottom: 1px solid color-mix(in srgb, var(--t-ink) 8%, transparent); }
  .preview td { padding: 8px 12px; font: 500 12px var(--t-font-body); color: color-mix(in srgb, var(--t-ink) 80%, transparent);
    border-bottom: 1px solid color-mix(in srgb, var(--t-ink) 6%, transparent); }
  .btns { display: flex; justify-content: space-between; padding-top: 4px; }
  .act { padding: 10px 18px; font: 600 13px var(--t-font-body); }
  .act.sm { padding: 8px 14px; font-size: 12px; }
  .final { text-align: center; padding: 32px 0; }
  .final .big { font-size: 38px; color: var(--t-accent); margin: 0; }
  .final .t { font: 600 17px var(--t-font-display); color: var(--t-ink); margin: 8px 0 2px; }
  .final .s { font: 500 13px var(--t-font-body); color: var(--t-muted); margin: 0 0 18px; }
</style>
