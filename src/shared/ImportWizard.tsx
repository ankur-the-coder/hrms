import { useState, useMemo } from 'react';
import { Upload, Link2, Download, ArrowRight, ArrowLeft, CheckCircle2, FileSpreadsheet, X } from 'lucide-react';
import { api } from '../lib/api';
import { Modal, btnPrimary, btnGhost, inputCls, labelCls, NeuLoader } from './primitives';
import { downloadBlob } from './Charts';

/* ============================================================
   3-step bulk import wizard used across Org Structure:
     Step 1 · Upload  — download template, upload CSV/Excel-CSV,
               OR paste a link (Google Sheets, OneDrive/Outlook,
               any public CSV URL — fetched server-side, no CORS)
     Step 2 · Map Columns — align sheet headers to system fields
     Step 3 · Review & Import — preview mapped rows, commit
   ============================================================ */

export interface WizardField { key: string; label: string; required?: boolean }

/* Minimal robust CSV parser (quotes, commas, CRLF). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else inQ = false;
      } else cell += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows;
}

const guessMatch = (header: string, field: WizardField) => {
  const h = header.toLowerCase().replace(/[^a-z0-9]/g, '');
  const f = (field.label + field.key).toLowerCase().replace(/[^a-z0-9]/g, '');
  return f.includes(h) || h.includes(field.key.toLowerCase().replace(/[^a-z0-9]/g, '')) || h.includes(field.label.toLowerCase().replace(/[^a-z0-9]/g, ''));
};

export default function ImportWizard({ open, onClose, title, fields, templateRows, onImport }: {
  open: boolean;
  onClose: () => void;
  title: string;
  fields: WizardField[];
  /** sample rows for the downloadable template (header auto-generated from fields) */
  templateRows?: string[][];
  onImport: (rows: Record<string, string>[]) => Promise<string>;
}) {
  const [step, setStep] = useState(1);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState('');
  const [sourceName, setSourceName] = useState('');

  const reset = () => { setStep(1); setHeaders([]); setRows([]); setMapping({}); setLink(''); setErr(''); setDone(''); setSourceName(''); };
  const close = () => { reset(); onClose(); };

  const ingest = (text: string, name: string) => {
    const parsed = parseCsv(text);
    if (parsed.length < 2) { setErr('The sheet needs a header row plus at least one data row.'); return; }
    const hdr = parsed[0].map((h) => h.trim());
    setHeaders(hdr);
    setRows(parsed.slice(1));
    setSourceName(name);
    // auto-guess mapping
    const m: Record<string, number> = {};
    fields.forEach((f) => {
      const idx = hdr.findIndex((h) => guessMatch(h, f));
      if (idx >= 0) m[f.key] = idx;
    });
    setMapping(m);
    setErr('');
    setStep(2);
  };

  const onFile = (file: File) => {
    if (file.size > 2_000_000) { setErr('File too large — max 2 MB.'); return; }
    const reader = new FileReader();
    reader.onload = () => ingest(String(reader.result || ''), file.name);
    reader.readAsText(file);
  };

  const onLink = async () => {
    if (!/^https?:\/\//.test(link.trim())) { setErr('Paste a valid http(s) link — Google Sheets, OneDrive/Outlook or a direct CSV URL.'); return; }
    setBusy(true); setErr('');
    try {
      const { csv } = await api<{ csv: string }>('orgstructure', {
        method: 'POST', body: JSON.stringify({ resource: 'fetch_link', url: link.trim() }),
      });
      ingest(csv, new URL(link.trim()).hostname);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not fetch the link');
    } finally { setBusy(false); }
  };

  const downloadTemplate = () => {
    const head = fields.map((f) => `"${f.label}"`).join(',');
    const body = (templateRows || []).map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    downloadBlob(`${title.toLowerCase().replace(/\s+/g, '-')}-template.csv`, new Blob([head + (body ? '\n' + body : '')], { type: 'text/csv' }));
  };

  const mappedRows = useMemo(() =>
    rows.map((r) => {
      const rec: Record<string, string> = {};
      fields.forEach((f) => {
        const idx = mapping[f.key];
        rec[f.key] = idx !== undefined && idx >= 0 ? (r[idx] || '').trim() : '';
      });
      return rec;
    }).filter((rec) => fields.some((f) => rec[f.key])),
  [rows, mapping, fields]);

  const requiredMissing = fields.filter((f) => f.required && mapping[f.key] === undefined);

  const commit = async () => {
    setBusy(true); setErr('');
    try {
      const msg = await onImport(mappedRows);
      setDone(msg);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Import failed');
    } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={close} title={title} wide>
      {/* stepper */}
      <div className="mb-5 flex items-center gap-2">
        {['Upload', 'Map Columns', 'Review & Import'].map((s, i) => (
          <div key={s} className="flex flex-1 items-center gap-2">
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-body text-[12px] font-bold ${step > i + 1 || done ? 'tk-btn-primary !p-0' : step === i + 1 ? 'tk-inset text-primary' : 'tk-chip text-muted'}`}>
              {step > i + 1 || done ? <CheckCircle2 size={14} /> : i + 1}
            </span>
            <span className={`font-body text-[11.5px] font-bold ${step === i + 1 ? 'text-ink' : 'text-muted'}`}>{s}</span>
            {i < 2 && <span className="h-px flex-1 bg-(--t-border) tk-divider border-t" />}
          </div>
        ))}
      </div>

      {done ? (
        <div className="py-8 text-center">
          <CheckCircle2 size={40} className="mx-auto mb-3 text-primary" />
          <p className="font-display text-[17px] font-semibold text-ink">Import complete</p>
          <p className="mt-1 font-body text-[13px] text-muted">{done}</p>
          <button onClick={close} className={btnPrimary + ' mt-5'}>Done</button>
        </div>
      ) : busy && step === 3 ? (
        <NeuLoader label="Importing…" />
      ) : (
        <>
          {/* ============ STEP 1 · UPLOAD ============ */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="tk-inset flex items-center justify-between gap-3 rounded-xl px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <FileSpreadsheet size={16} className="text-primary" />
                  <div>
                    <p className="font-body text-[13px] font-bold text-ink">Download the template</p>
                    <p className="font-body text-[11.5px] text-muted">Fill it in Excel / Google Sheets, then upload or share a link.</p>
                  </div>
                </div>
                <button onClick={downloadTemplate} className={btnGhost + ' !py-2 text-[12px]'}><Download size={13} /> Template</button>
              </div>

              <label className="tk-card block cursor-pointer border-2 border-dashed !border-(--t-border) p-6 text-center transition hover:-translate-y-0.5">
                <Upload size={22} className="mx-auto mb-2 text-primary" />
                <p className="font-body text-[13.5px] font-bold text-ink">Upload a file</p>
                <p className="font-body text-[11.5px] text-muted">CSV or Excel-exported CSV · max 2 MB</p>
                <input type="file" accept=".csv,text/csv,.txt" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
              </label>

              <div className="flex items-center gap-3">
                <span className="h-px flex-1 border-t tk-divider" />
                <span className="font-body text-[10px] font-bold uppercase tracking-wider text-muted">or import from a link</span>
                <span className="h-px flex-1 border-t tk-divider" />
              </div>

              <div>
                <label className={labelCls}>Paste a share link</label>
                <div className="flex gap-2">
                  <div className="tk-input flex flex-1 items-center gap-2 px-3">
                    <Link2 size={13} className="shrink-0 text-muted" />
                    <input value={link} onChange={(e) => setLink(e.target.value)}
                      placeholder="Google Sheets, OneDrive / Outlook or direct CSV link…"
                      className="w-full bg-transparent py-2.5 font-body text-[12.5px] text-ink outline-none placeholder:text-muted" />
                  </div>
                  <button onClick={onLink} disabled={busy} className={btnPrimary + ' shrink-0 !py-2 text-[12.5px]'}>
                    {busy ? 'Fetching…' : 'Fetch'}
                  </button>
                </div>
                <p className="mt-1.5 font-body text-[10.5px] text-muted">
                  Google Sheets: share as “Anyone with the link”. OneDrive/Outlook: use a download link. Fetched securely server-side.
                </p>
              </div>
              {err && <p className="rounded-xl bg-rose-500/10 px-3.5 py-2.5 font-body text-[12.5px] text-rose-500">{err}</p>}
            </div>
          )}

          {/* ============ STEP 2 · MAP COLUMNS ============ */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="font-body text-[12.5px] text-muted">
                <b className="text-ink">{sourceName}</b> · {rows.length} rows · match each system field to a column from your sheet.
              </p>
              <div className="space-y-2.5">
                {fields.map((f) => (
                  <div key={f.key} className="flex items-center gap-3">
                    <span className="w-40 shrink-0 font-body text-[12.5px] font-bold text-ink">
                      {f.label} {f.required && <span className="text-rose-500">*</span>}
                    </span>
                    <ArrowLeft size={13} className="shrink-0 text-muted" />
                    <select value={mapping[f.key] ?? -1}
                      onChange={(e) => setMapping((m) => ({ ...m, [f.key]: +e.target.value }))}
                      className={inputCls + ' !py-2 text-[12.5px]'}>
                      <option value={-1}>— Not mapped —</option>
                      {headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              {requiredMissing.length > 0 && (
                <p className="rounded-xl bg-amber-500/10 px-3.5 py-2.5 font-body text-[12px] font-semibold text-amber-600">
                  Map required fields: {requiredMissing.map((f) => f.label).join(', ')}
                </p>
              )}
              <div className="flex justify-between pt-1">
                <button onClick={() => setStep(1)} className={btnGhost}><ArrowLeft size={14} /> Back</button>
                <button onClick={() => setStep(3)} disabled={requiredMissing.length > 0} className={btnPrimary}>
                  Review <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* ============ STEP 3 · REVIEW & IMPORT ============ */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="font-body text-[12.5px] text-muted">
                Previewing <b className="text-ink">{Math.min(8, mappedRows.length)}</b> of <b className="text-ink">{mappedRows.length}</b> mapped rows.
              </p>
              <div className="tk-inset overflow-x-auto rounded-xl">
                <table className="w-full min-w-[480px]">
                  <thead>
                    <tr className="border-b tk-divider">
                      {fields.map((f) => (
                        <th key={f.key} className="px-3 py-2 text-left font-body text-[10px] font-bold uppercase tracking-wider text-muted">{f.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {mappedRows.slice(0, 8).map((r, i) => (
                      <tr key={i} className="border-b tk-divider">
                        {fields.map((f) => (
                          <td key={f.key} className="px-3 py-2 font-body text-[12px] text-ink/80">
                            {r[f.key] || <span className="text-muted">—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {err && <p className="rounded-xl bg-rose-500/10 px-3.5 py-2.5 font-body text-[12.5px] text-rose-500">{err}</p>}
              <div className="flex justify-between pt-1">
                <button onClick={() => setStep(2)} className={btnGhost}><ArrowLeft size={14} /> Back</button>
                <div className="flex gap-2">
                  <button onClick={close} className={btnGhost}><X size={14} /> Cancel</button>
                  <button onClick={commit} disabled={busy || mappedRows.length === 0} className={btnPrimary}>
                    <Upload size={14} /> Import {mappedRows.length} rows
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
