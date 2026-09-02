import { useState, useMemo, useRef, useEffect, useCallback, Fragment, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, X, ChevronUp, ChevronDown, ChevronRight, ChevronLeft, MoreHorizontal,
  Columns3, LayoutList, Kanban, Image as ImageIcon, CalendarDays, GanttChartSquare,
  BarChart3, CheckSquare, Inbox, RotateCw, Download, SlidersHorizontal,
} from 'lucide-react';
import { MiniDrop, downloadBlob } from './Charts';
import { useFlip, Popover, EmptyState, Badge, NeuLoader } from './primitives';
import Select from './Select';

/* ============================================================
   Shared DataTable — list / kanban / gallery / calendar /
   timeline / chart views, pagination or infinite scroll,
   search, sort, filters, bulk + row actions, expandable rows,
   column manager, tooltips, flip-aware action menus.
   ============================================================ */

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (row: T) => ReactNode;
  accessor?: (row: T) => string | number;
  tooltip?: (row: T) => string;
  filterOptions?: string[];
  defaultHidden?: boolean;
}
export interface RowAction<T> { label: string; icon?: ReactNode; tone?: 'default' | 'danger'; onClick: (row: T) => void }
export interface BulkAction<T> { label: string; icon?: ReactNode; tone?: 'default' | 'danger'; onClick: (rows: T[]) => void }
export type ViewKind = 'list' | 'kanban' | 'gallery' | 'calendar' | 'timeline' | 'chart';

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  rowKey: (r: T) => string | number;
  views?: ViewKind[];
  searchKeys?: string[];
  pageSize?: number;
  rowActions?: RowAction<T>[];
  bulkActions?: BulkAction<T>[];
  expandable?: (row: T) => ReactNode;
  groupField?: string;                       // kanban columns + chart grouping
  dateField?: string;                        // calendar + timeline
  card?: { title: (r: T) => string; subtitle?: (r: T) => string; badge?: (r: T) => string };
  onRowClick?: (row: T) => void;
  loading?: boolean;
  onReload?: () => void;
  /** Kanban drag & drop — called when a card is dropped on another column. */
  onKanbanMove?: (row: T, group: string) => void;
  /** File name base for exports. */
  exportName?: string;
  /** Structured detail data per row — enables hyperlinked detail sheets in Excel. */
  exportDetail?: (row: T) => Record<string, string | number>;
}

const VIEW_META: Record<ViewKind, { label: string; icon: typeof LayoutList }> = {
  list: { label: 'List', icon: LayoutList },
  kanban: { label: 'Kanban', icon: Kanban },
  gallery: { label: 'Gallery', icon: ImageIcon },
  calendar: { label: 'Calendar', icon: CalendarDays },
  timeline: { label: 'Timeline', icon: GanttChartSquare },
  chart: { label: 'Chart', icon: BarChart3 },
};

const get = (row: unknown, key: string): unknown => (row as Record<string, unknown>)[key];
const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));
/** Robust date parsing — handles both 'YYYY-MM-DD' and full ISO timestamps. */
const parseDate = (s: string): Date | null => {
  if (!s) return null;
  const d = new Date(s.includes('T') ? s : s + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
};

/* ---- CDN loaders for export libraries (node_modules is immutable) ---- */
const scriptCache = new Map<string, Promise<void>>();
function loadScript(src: string): Promise<void> {
  if (!scriptCache.has(src)) {
    scriptCache.set(src, new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => resolve();
      s.onerror = () => { scriptCache.delete(src); reject(new Error('Failed to load ' + src)); };
      document.head.appendChild(s);
    }));
  }
  return scriptCache.get(src)!;
}
async function loadPdfMake(): Promise<any> {
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.12/pdfmake.min.js');
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.12/vfs_fonts.js');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window as any).pdfMake;
}
async function loadExcelJS(): Promise<any> {
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window as any).ExcelJS;
}

/* ============================================================
   FilterHub — one compact button hosting ALL table filters.
   Scales from 5 to 20+ filters without crowding the toolbar:
   filter list on the left, searchable value panel on the right,
   live counts, per-filter and global clear.
   ============================================================ */
function FilterHub<T>({ columns, filters, setFilters }: {
  columns: Column<T>[];
  filters: Record<string, string[]>;
  setFilters: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
}) {
  const [open, setOpen] = useState(false);
  const [activeKey, setActiveKey] = useState(columns[0]?.key || '');
  const [vq, setVq] = useState('');
  const { anchorRef, dir, measure } = useFlip(400);
  const activeCount = Object.values(filters).reduce((s, v) => s + v.length, 0);
  const activeCol = columns.find((c) => c.key === activeKey) || columns[0];
  const values = (activeCol?.filterOptions || []).filter((o) => !vq.trim() || o.toLowerCase().includes(vq.toLowerCase()));

  const toggleVal = (key: string, val: string) => {
    setFilters((f) => {
      const cur = f[key] || [];
      return { ...f, [key]: cur.includes(val) ? cur.filter((x) => x !== val) : [...cur, val] };
    });
  };

  return (
    <div ref={anchorRef} className="relative">
      <button onClick={() => { measure(); setOpen(!open); setVq(''); }}
        className={`tk-btn-ghost flex items-center gap-1.5 rounded-xl px-3 py-2 font-body text-[12px] font-bold ${activeCount ? 'text-primary' : ''}`}>
        <SlidersHorizontal size={13} /> Filters
        {activeCount > 0 && (
          <span className="flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-(--t-accent) px-1 font-body text-[10px] font-bold text-white">
            {activeCount}
          </span>
        )}
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={anchorRef} dir={dir} width={430} sheetTitle="Filters">
        <div className="flex" style={{ maxHeight: 340 }}>
          {/* left: filter list */}
          <div className="hide-scrollbar w-[150px] shrink-0 overflow-y-auto border-r tk-divider pr-1.5">
            {columns.map((c) => {
              const n = (filters[c.key] || []).length;
              return (
                <button key={c.key} onClick={() => { setActiveKey(c.key); setVq(''); }}
                  className={`flex w-full items-center justify-between gap-1 rounded-lg px-2.5 py-2 text-left font-body text-[12px] font-bold transition ${
                    activeKey === c.key ? 'tk-inset text-primary' : 'text-ink/70 hover:text-ink'
                  }`}>
                  <span className="truncate">{c.label}</span>
                  {n > 0 && <span className="shrink-0 rounded-full bg-(--t-accent) px-1.5 font-body text-[9.5px] font-bold text-white">{n}</span>}
                </button>
              );
            })}
          </div>
          {/* right: values with search */}
          <div className="flex min-w-0 flex-1 flex-col pl-2.5">
            <div className="tk-inset mb-2 flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-1.5">
              <Search size={12} className="shrink-0 text-muted" />
              <input value={vq} onChange={(e) => setVq(e.target.value)} placeholder={`Search ${activeCol?.label || ''}…`}
                className="w-full bg-transparent font-body text-[12px] text-ink outline-none placeholder:text-muted" />
            </div>
            <div className="hide-scrollbar flex-1 overflow-y-auto">
              {values.length === 0 && <p className="px-2 py-4 text-center font-body text-[11.5px] text-muted">No matching values</p>}
              {values.map((v) => {
                const on = (filters[activeCol.key] || []).includes(v);
                return (
                  <label key={v} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 font-body text-[12.5px] font-semibold text-ink/80 transition hover:bg-primary/8">
                    <input type="checkbox" className="tk-check" checked={on} onChange={() => toggleVal(activeCol.key, v)} />
                    <span className="truncate">{v}</span>
                  </label>
                );
              })}
            </div>
            <div className="flex shrink-0 items-center justify-between border-t tk-divider pt-2">
              <button onClick={() => setFilters((f) => ({ ...f, [activeCol.key]: [] }))}
                className="font-body text-[11.5px] font-bold text-muted transition hover:text-ink">Clear this filter</button>
              <button onClick={() => setFilters({})}
                className="font-body text-[11.5px] font-bold text-rose-500 transition hover:underline">Clear all</button>
            </div>
          </div>
        </div>
      </Popover>
    </div>
  );
}

function RowMenu<T>({ row, actions }: { row: T; actions: RowAction<T>[] }) {
  const [open, setOpen] = useState(false);
  const { anchorRef, dir, measure } = useFlip(actions.length * 40 + 20);
  return (
    <div ref={anchorRef} className="relative inline-block">
      <button onClick={(e) => { e.stopPropagation(); measure(); setOpen(!open); }}
        className="rounded-lg p-1.5 text-muted transition hover:bg-primary/8 hover:text-ink">
        <MoreHorizontal size={16} />
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={anchorRef} dir={dir} width={176} sheetTitle="Actions">
        {actions.map((a) => (
          <button key={a.label} onClick={(e) => { e.stopPropagation(); setOpen(false); a.onClick(row); }}
            className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left font-body text-[13px] font-semibold transition hover:bg-primary/8 ${a.tone === 'danger' ? 'text-rose-500' : 'text-ink/80'}`}>
            {a.icon} {a.label}
          </button>
        ))}
      </Popover>
    </div>
  );
}

export default function DataTable<T>({
  data, columns, rowKey, views = ['list'], searchKeys, pageSize = 10,
  rowActions = [], bulkActions = [], expandable, groupField, dateField, card, onRowClick,
  loading = false, onReload, onKanbanMove, exportName = 'data', exportDetail,
}: DataTableProps<T>) {
  const [view, setView] = useState<ViewKind>(views[0]);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [filters, setFilters] = useState<Record<string, string[]>>({});
  const [selected, setSelected] = useState<Set<string | number>>(new Set());
  const [expanded, setExpanded] = useState<Set<string | number>>(new Set());
  const [hidden, setHidden] = useState<Set<string>>(() => new Set(columns.filter((c) => c.defaultHidden).map((c) => c.key)));
  const [page, setPage] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [calMonth, setCalMonth] = useState(() => new Date());
  const [colMgrOpen, setColMgrOpen] = useState(false);
  const colMgr = useFlip(280);
  const [dragKey, setDragKey] = useState<string | number | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  /* ---- pipeline: search → filter → sort ---- */
  const processed = useMemo(() => {
    let rows = data;
    const t = q.trim().toLowerCase();
    if (t) {
      const keys = searchKeys || columns.map((c) => c.key);
      rows = rows.filter((r) => keys.some((k) => str(get(r, k)).toLowerCase().includes(t)));
    }
    for (const [k, vals] of Object.entries(filters)) {
      if (vals.length) rows = rows.filter((r) => vals.includes(str(get(r, k))));
    }
    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      rows = [...rows].sort((a, b) => {
        const av = col?.accessor ? col.accessor(a) : get(a, sort.key);
        const bv = col?.accessor ? col.accessor(b) : get(b, sort.key);
        if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * sort.dir;
        return str(av).localeCompare(str(bv)) * sort.dir;
      });
    }
    return rows;
  }, [data, q, filters, sort, columns, searchKeys]);

  useEffect(() => { setPage(0); }, [q, filters, sort, view, pageSize]);

  const pageRows = processed.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.max(1, Math.ceil(processed.length / pageSize));
  const shownCols = columns.filter((c) => !hidden.has(c.key));
  const filterCols = columns.filter((c) => c.filterOptions?.length);

  /* ---------------- EXPORTS: PDF (pdfMake) / Excel (ExcelJS) / CSV / Print ---------------- */
  const cellText = useCallback((row: T, col: Column<T>): string => {
    if (col.accessor) return str(col.accessor(row));
    return str(get(row, col.key));
  }, []);

  const doExport = async (fmt: string) => {
    const cols = columns.filter((c) => !hidden.has(c.key));
    const rows = processed; // full filtered + sorted result, not just the visible page
    const stamp = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    setExporting(true);
    try {
      if (fmt === 'csv') {
        const head = cols.map((c) => `"${c.label}"`).join(',');
        const lines = rows.map((r) => cols.map((c) => `"${cellText(r, c).replace(/"/g, '""')}"`).join(','));
        downloadBlob(`${exportName}.csv`, new Blob([head + '\n' + lines.join('\n')], { type: 'text/csv' }));
        return;
      }

      if (fmt === 'pdf') {
        const pdfMake = await loadPdfMake();
        const body = [
          cols.map((c) => ({ text: c.label, style: 'th' })),
          ...rows.map((r) => cols.map((c) => ({ text: cellText(r, c), style: 'td' }))),
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
          footer: (page: number, total: number) => ({
            margin: [28, 8, 28, 0],
            columns: [
              { text: `${rows.length} records`, color: '#8a938d', fontSize: 8 },
              { text: `Page ${page} of ${total}`, alignment: 'right', color: '#8a938d', fontSize: 8 },
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
          styles: {
            th: { color: '#ffffff', bold: true, fontSize: 8.5 },
            td: { color: '#2c352f', fontSize: 8.5 },
          },
        }).download(`${exportName}.pdf`);
        return;
      }

      if (fmt === 'excel') {
        const ExcelJS = await loadExcelJS();
        const wb = new ExcelJS.Workbook();
        wb.creator = 'Aviary People OS';
        const ws = wb.addWorksheet('Data', { views: [{ state: 'frozen', ySplit: 2 }] });
        // title row
        ws.mergeCells(1, 1, 1, cols.length);
        const titleCell = ws.getCell(1, 1);
        titleCell.value = exportName.replace(/-/g, ' ').toUpperCase() + '  ·  ' + stamp;
        titleCell.font = { bold: true, size: 13, color: { argb: 'FF0D7A54' } };
        ws.getRow(1).height = 24;
        // header
        const headRow = ws.addRow(cols.map((c) => c.label));
        headRow.eachCell((cell: { font: unknown; fill: unknown; alignment: unknown; border: unknown }) => {
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D7A54' } };
          cell.alignment = { vertical: 'middle' };
          cell.border = { bottom: { style: 'thin', color: { argb: 'FF0A5C40' } } };
        });
        ws.getRow(2).height = 20;
        rows.forEach((r, ri) => {
          const row = ws.addRow(cols.map((c) => {
            const raw = c.accessor ? c.accessor(r) : get(r, c.key);
            return typeof raw === 'number' ? raw : str(raw);
          }));
          if (ri % 2 === 1) row.eachCell((cell: { fill: unknown }) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F4F0' } };
          });
          // hyperlinked detail sheet for rows with expandable data
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
              first.value = { text: str(first.value), hyperlink: `#'${sheetName}'!A1` };
              first.font = { color: { argb: 'FF0D7A54' }, underline: true };
            }
          }
        });
        cols.forEach((c, i) => {
          const maxLen = Math.max(c.label.length, ...rows.slice(0, 200).map((r) => cellText(r, c).length));
          ws.getColumn(i + 1).width = Math.min(38, Math.max(11, maxLen + 3));
        });
        const buf = await wb.xlsx.writeBuffer();
        downloadBlob(`${exportName}.xlsx`, new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
        return;
      }

      if (fmt === 'print') {
        // re-render a clean high-resolution page in a hidden iframe (never
        // blocked by popup rules), then trigger print from it
        const html = `<!doctype html><html><head><title>${exportName}</title><style>
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
          <tbody>${rows.map((r) => `<tr>${cols.map((c) => `<td>${cellText(r, c)}</td>`).join('')}</tr>`).join('')}</tbody></table>
        </body></html>`;
        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;right:200vw;bottom:200vh;width:1080px;height:760px;border:0;';
        document.body.appendChild(iframe);
        const doc = iframe.contentWindow!.document;
        doc.open(); doc.write(html); doc.close();
        const cleanup = () => { try { iframe.remove(); } catch { /* noop */ } };
        iframe.contentWindow!.onafterprint = cleanup;
        setTimeout(() => {
          try { iframe.contentWindow!.focus(); iframe.contentWindow!.print(); } catch { cleanup(); }
          setTimeout(cleanup, 60000);
        }, 350);
        return;
      }
    } finally {
      setExporting(false);
    }
  };

  const toggleSel = (k: string | number) => setSelected((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  // Select-all covers EVERY record in the current search/filter result — not just the visible page.
  const allSelected = processed.length > 0 && processed.every((r) => selected.has(rowKey(r)));
  const toggleAll = () => setSelected(() => allSelected ? new Set() : new Set(processed.map((r) => rowKey(r))));
  const selectedRows = useMemo(() => data.filter((r) => selected.has(rowKey(r))), [data, selected, rowKey]);

  const cycleSort = (key: string) => setSort((s) => (!s || s.key !== key) ? { key, dir: 1 } : s.dir === 1 ? { key, dir: -1 } : null);

  const groups = useMemo(() => {
    if (!groupField) return [];
    const m = new Map<string, T[]>();
    processed.forEach((r) => {
      const g = str(get(r, groupField)) || '—';
      if (!m.has(g)) m.set(g, []);
      m.get(g)!.push(r);
    });
    return Array.from(m.entries());
  }, [processed, groupField]);

  const cardTitle = useCallback((r: T) => card?.title(r) ?? str(get(r, columns[0].key)), [card, columns]);
  const cardSub = useCallback((r: T) => card?.subtitle?.(r) ?? (columns[1] ? str(get(r, columns[1].key)) : ''), [card, columns]);

  /* ============================ render ============================ */
  return (
    <div className="tk-card overflow-visible">
      {/* ---- toolbar (visible but disabled while loading) ---- */}
      <div className={`flex flex-wrap items-center gap-2.5 border-b tk-divider px-4 py-3 ${loading ? 'pointer-events-none opacity-55' : ''}`}>
        <div className="tk-inset flex min-w-[170px] flex-1 items-center gap-2 px-3 py-2 sm:max-w-xs">
          <Search size={13} className="shrink-0 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…"
            className="w-full bg-transparent font-body text-[13px] text-ink outline-none placeholder:text-muted" />
          {q && <button onClick={() => setQ('')} className="text-muted hover:text-ink"><X size={13} /></button>}
        </div>

        {/* FilterHub — one button hosts ALL filters (scales to 20+ without crowding) */}
        {filterCols.length > 0 && <FilterHub columns={filterCols} filters={filters} setFilters={setFilters} />}

        <div className="ml-auto flex items-center gap-2">
          <MiniDrop label={exporting ? 'Exporting…' : 'Export'} icon={<Download size={12} />}
            items={[
              { key: 'pdf', label: 'PDF document' },
              { key: 'excel', label: 'Excel workbook' },
              { key: 'csv', label: 'CSV data' },
              { key: 'print', label: 'Print…' },
            ]}
            onPick={doExport} />
          {/* column manager */}
          {view === 'list' && (
            <div ref={colMgr.anchorRef} className="relative">
              <button onClick={() => { colMgr.measure(); setColMgrOpen(!colMgrOpen); }} data-tip="Show / hide columns"
                className="tk-btn-ghost rounded-xl p-2"><Columns3 size={15} /></button>
              <Popover open={colMgrOpen} onClose={() => setColMgrOpen(false)} anchorRef={colMgr.anchorRef} dir={colMgr.dir} width={210} sheetTitle="Columns">
                {columns.map((c) => (
                  <label key={c.key} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 font-body text-[13px] font-semibold text-ink/80 transition hover:bg-primary/8">
                    <input type="checkbox" checked={!hidden.has(c.key)}
                      onChange={() => setHidden((h) => { const n = new Set(h); if (n.has(c.key)) n.delete(c.key); else n.add(c.key); return n; })}
                      className="tk-check" />
                    {c.label}
                  </label>
                ))}
              </Popover>
            </div>
          )}
          {/* view switcher */}
          {views.length > 1 && (
            <div className="tk-inset flex gap-0.5 p-1">
              {views.map((v) => {
                const Icon = VIEW_META[v].icon;
                return (
                  <button key={v} onClick={() => setView(v)} data-tip={VIEW_META[v].label}
                    className={`rounded-lg p-1.5 transition ${view === v ? 'tk-raise-sm text-primary' : 'text-muted hover:text-ink'}`}>
                    <Icon size={15} />
                  </button>
                );
              })}
            </div>
          )}
          {/* reload sits AFTER the view switcher */}
          {onReload && (
            <button onClick={onReload} data-tip="Reload data" disabled={loading}
              className="tk-btn-ghost rounded-xl p-2">
              <RotateCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
          )}
        </div>
      </div>

      {/* active filter chips */}
      {Object.entries(filters).some(([, v]) => v.length > 0) && (
        <div className="flex flex-wrap items-center gap-1.5 border-b tk-divider px-4 py-2">
          {Object.entries(filters).flatMap(([k, vals]) =>
            vals.map((v) => (
              <span key={k + v} className="tk-chip flex items-center gap-1.5 px-2.5 py-1 font-body text-[11px] font-bold text-ink/75">
                <span className="text-muted">{columns.find((c) => c.key === k)?.label}:</span> {v}
                <button onClick={() => setFilters((f) => ({ ...f, [k]: (f[k] || []).filter((x) => x !== v) }))}
                  className="text-muted transition hover:text-rose-500"><X size={11} /></button>
              </span>
            ))
          )}
          <button onClick={() => setFilters({})} className="ml-1 font-body text-[11px] font-bold text-muted transition hover:text-ink">Clear all</button>
        </div>
      )}

      {/* ---- bulk bar ---- */}
      <AnimatePresence>
        {selected.size > 0 && bulkActions.length > 0 && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b tk-divider">
            <div className="flex flex-wrap items-center gap-2.5 bg-primary/6 px-4 py-2.5">
              <span className="flex items-center gap-1.5 font-body text-[12.5px] font-bold text-primary"><CheckSquare size={13} /> {selected.size} selected</span>
              {bulkActions.map((a) => (
                <button key={a.label} onClick={() => { a.onClick(selectedRows); setSelected(new Set()); }}
                  className={`tk-btn-ghost rounded-lg px-3 py-1.5 font-body text-[12px] font-bold ${a.tone === 'danger' ? '!text-rose-500' : ''}`}>
                  {a.icon} {a.label}
                </button>
              ))}
              <button onClick={() => setSelected(new Set())} className="ml-auto font-body text-[12px] font-bold text-muted hover:text-ink">Clear</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        /* table keeps its height; body swaps to the circular loader */
        <div style={{ minHeight: Math.max(280, pageSize * 46) }} className="flex items-center justify-center">
          <NeuLoader label="Loading records…" />
        </div>
      ) : processed.length === 0 ? (
        <EmptyState icon={<Inbox size={22} />} title="No records" subtitle="Try adjusting your search or filters." />
      ) : (
        <>
          {/* ================= LIST ================= */}
          {view === 'list' && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="border-b tk-divider">
                    <th className="w-10 px-4 py-3" data-tip={allSelected ? 'Deselect all' : `Select all ${processed.length}`}>
                      <input type="checkbox" checked={allSelected} onChange={toggleAll} className="tk-check" />
                    </th>
                    {expandable && <th className="w-8" />}
                    {shownCols.map((c) => (
                      <th key={c.key} onClick={() => c.sortable !== false && cycleSort(c.key)}
                        className={`px-4 py-3 text-left font-body text-[10.5px] font-bold uppercase tracking-wider text-muted ${c.sortable !== false ? 'cursor-pointer select-none hover:text-ink' : ''}`}>
                        <span className="inline-flex items-center gap-1">
                          {c.label}
                          {sort?.key === c.key && (sort.dir === 1 ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                        </span>
                      </th>
                    ))}
                    {rowActions.length > 0 && <th className="w-12" />}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((r) => {
                    const k = rowKey(r);
                    const isExp = expanded.has(k);
                    const colCount = 1 + (expandable ? 1 : 0) + shownCols.length + (rowActions.length > 0 ? 1 : 0);
                    return (
                      <Fragment key={String(k)}>
                        <tr onClick={() => onRowClick?.(r)}
                          className={`border-b tk-divider transition hover:bg-primary/4 ${onRowClick ? 'cursor-pointer' : ''}`}>
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <input type="checkbox" checked={selected.has(k)} onChange={() => toggleSel(k)} className="tk-check" />
                          </td>
                          {expandable && (
                            <td className="py-3" onClick={(e) => e.stopPropagation()}>
                              <button onClick={() => setExpanded((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; })}
                                className="rounded p-1 text-muted transition hover:text-primary">
                                <ChevronRight size={14} className={`transition-transform ${isExp ? 'rotate-90' : ''}`} />
                              </button>
                            </td>
                          )}
                          {shownCols.map((c) => (
                            <td key={c.key} className="px-4 py-3 font-body text-[13px] text-ink/80"
                              {...(c.tooltip ? { 'data-tip': c.tooltip(r) } : {})}>
                              {c.render ? c.render(r) : str(get(r, c.key))}
                            </td>
                          ))}
                          {rowActions.length > 0 && (
                            <td className="px-2 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                              <RowMenu row={r} actions={rowActions} />
                            </td>
                          )}
                        </tr>
                        {/* expansion renders INSIDE the table — pure height open/close */}
                        {expandable && (
                          <tr className={isExp ? 'border-b tk-divider' : ''}>
                            <td colSpan={colCount} className="p-0">
                              <div className={`tk-expand ${isExp ? 'open' : ''}`}>
                                <div>
                                  <div className="tk-inset mx-4 mb-3 mt-1 px-4 py-3">
                                    <p className="mb-1 font-body text-[10.5px] font-bold uppercase tracking-wider text-muted">Details · {cardTitle(r)}</p>
                                    {expandable(r)}
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>

            </div>
          )}

          {/* ================= KANBAN (drag & drop) ================= */}
          {view === 'kanban' && groupField && (
            <div className="hide-scrollbar flex gap-4 overflow-x-auto p-4">
              {groups.map(([g, rows]) => (
                <div key={g} className="w-64 shrink-0">
                  <div className="mb-2 flex items-center justify-between px-1">
                    <p className="font-body text-[12px] font-bold uppercase tracking-wider text-ink/70">{g}</p>
                    <Badge>{rows.length}</Badge>
                  </div>
                  <div
                    className={`tk-inset kanban-col min-h-[120px] space-y-2 rounded-xl p-2 ${dragOverCol === g ? 'drag-over' : ''}`}
                    onDragOver={(e) => { if (onKanbanMove) { e.preventDefault(); setDragOverCol(g); } }}
                    onDragLeave={() => setDragOverCol((c) => (c === g ? null : c))}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOverCol(null);
                      if (!onKanbanMove || dragKey === null) return;
                      const row = data.find((r) => rowKey(r) === dragKey);
                      if (row && str(get(row, groupField)) !== g) onKanbanMove(row, g);
                      setDragKey(null);
                    }}>
                    {rows.map((r) => {
                      const k = rowKey(r);
                      return (
                        <div key={String(k)}
                          draggable={!!onKanbanMove}
                          onDragStart={(e) => { setDragKey(k); e.dataTransfer.effectAllowed = 'move'; }}
                          onDragEnd={() => { setDragKey(null); setDragOverCol(null); }}
                          onClick={() => onRowClick?.(r)}
                          className={`tk-raise-sm kanban-card block w-full rounded-xl p-3 text-left transition hover:-translate-y-0.5 ${dragKey === k ? 'dragging' : ''}`}>
                          <p className="font-body text-[13px] font-bold text-ink">{cardTitle(r)}</p>
                          <p className="font-body text-[11.5px] text-muted">{cardSub(r)}</p>
                          {card?.badge && <div className="mt-1.5"><Badge tone="green">{card.badge(r)}</Badge></div>}
                        </div>
                      );
                    })}
                    {rows.length === 0 && <p className="py-4 text-center font-body text-[11px] text-muted">Drop here</p>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ================= GALLERY ================= */}
          {view === 'gallery' && (
            <div className="grid gap-3.5 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {pageRows.map((r) => {
                const k = rowKey(r);
                return (
                  <div key={String(k)} className="tk-raise-sm relative rounded-2xl p-4 transition hover:-translate-y-0.5">
                    <input type="checkbox" checked={selected.has(k)} onChange={() => toggleSel(k)}
                      className="tk-check absolute right-3 top-3" />
                    <button onClick={() => onRowClick?.(r)} className="block w-full text-left">
                      <div className="tk-inset mb-2.5 flex h-11 w-11 items-center justify-center rounded-full font-display text-[15px] font-bold text-primary">
                        {cardTitle(r).split(' ').map((w) => w[0]).slice(0, 2).join('')}
                      </div>
                      <p className="font-body text-[13.5px] font-bold text-ink">{cardTitle(r)}</p>
                      <p className="font-body text-[12px] text-muted">{cardSub(r)}</p>
                      {card?.badge && <div className="mt-2"><Badge tone="green">{card.badge(r)}</Badge></div>}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* ================= CALENDAR ================= */}
          {view === 'calendar' && dateField && (() => {
            const y = calMonth.getFullYear(), m = calMonth.getMonth();
            const firstDow = new Date(y, m, 1).getDay();
            const days = new Date(y, m + 1, 0).getDate();
            const byDay = new Map<number, T[]>();
            processed.forEach((r) => {
              const d = parseDate(str(get(r, dateField)));
              if (d && d.getFullYear() === y && d.getMonth() === m) {
                if (!byDay.has(d.getDate())) byDay.set(d.getDate(), []);
                byDay.get(d.getDate())!.push(r);
              }
            });
            return (
              <div className="p-4">
                <div className="mb-3 flex items-center justify-between">
                  <button onClick={() => setCalMonth(new Date(y, m - 1, 1))} className="tk-btn-ghost rounded-lg p-1.5"><ChevronLeft size={15} /></button>
                  <p className="font-display text-[15px] font-semibold text-ink">{calMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</p>
                  <button onClick={() => setCalMonth(new Date(y, m + 1, 1))} className="tk-btn-ghost rounded-lg p-1.5"><ChevronRight size={15} /></button>
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                    <span key={d} className="pb-1 text-center font-body text-[10px] font-bold uppercase text-muted">{d}</span>
                  ))}
                  {Array.from({ length: firstDow }).map((_, i) => <span key={`e${i}`} />)}
                  {Array.from({ length: days }, (_, i) => {
                    const items = byDay.get(i + 1) || [];
                    return (
                      <div key={i} className="tk-inset min-h-[70px] rounded-xl p-1.5">
                        <p className="font-body text-[11px] font-bold text-ink/60">{i + 1}</p>
                        {items.slice(0, 2).map((r) => (
                          <button key={String(rowKey(r))} onClick={() => onRowClick?.(r)} title={cardTitle(r)}
                            className="mt-0.5 block w-full truncate rounded bg-primary/12 px-1 py-0.5 text-left font-body text-[10px] font-bold text-primary">
                            {cardTitle(r)}
                          </button>
                        ))}
                        {items.length > 2 && <p className="mt-0.5 font-body text-[9.5px] font-bold text-muted">+{items.length - 2} more</p>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* ================= TIMELINE ================= */}
          {view === 'timeline' && dateField && (
            <div className="p-5">
              {(() => {
                const sorted = [...processed].sort((a, b) => str(get(b, dateField)).localeCompare(str(get(a, dateField))));
                const byMonth = new Map<string, T[]>();
                sorted.forEach((r) => {
                  const d = parseDate(str(get(r, dateField)));
                  if (!d) return;
                  const key = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
                  if (!byMonth.has(key)) byMonth.set(key, []);
                  byMonth.get(key)!.push(r);
                });
                return Array.from(byMonth.entries()).map(([mo, rows]) => (
                  <div key={mo} className="relative border-l-2 border-primary/25 pb-5 pl-5">
                    <span className="absolute -left-[7px] top-0 h-3 w-3 rounded-full bg-primary" />
                    <p className="mb-2 font-display text-[14px] font-semibold text-ink">{mo}</p>
                    <div className="space-y-1.5">
                      {rows.map((r) => (
                        <button key={String(rowKey(r))} onClick={() => onRowClick?.(r)}
                          className="tk-raise-sm flex w-full items-center justify-between gap-3 rounded-xl px-3.5 py-2 text-left transition hover:-translate-y-0.5">
                          <span className="min-w-0">
                            <span className="block truncate font-body text-[13px] font-bold text-ink">{cardTitle(r)}</span>
                            <span className="block truncate font-body text-[11.5px] text-muted">{cardSub(r)}</span>
                          </span>
                          <span className="shrink-0 font-body text-[11px] font-semibold tabular-nums text-muted">
                            {parseDate(str(get(r, dateField)))?.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) || '—'}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}

          {/* ================= CHART ================= */}
          {view === 'chart' && groupField && (
            <div className="space-y-3.5 p-5">
              <p className="font-body text-[11px] font-bold uppercase tracking-wider text-muted">Records by {columns.find((c) => c.key === groupField)?.label || groupField}</p>
              {(() => {
                const max = Math.max(...groups.map(([, r]) => r.length), 1);
                return groups.map(([g, rows], i) => (
                  <div key={g}>
                    <div className="mb-1 flex justify-between font-body text-[12px]">
                      <span className="font-semibold text-ink/75">{g}</span>
                      <span className="font-bold tabular-nums text-ink">{rows.length}</span>
                    </div>
                    <div className="tk-inset h-3.5 overflow-hidden rounded-full">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${(rows.length / max) * 100}%` }} transition={{ duration: 0.7, delay: i * 0.05 }}
                        className="h-full rounded-full" style={{ background: `color-mix(in srgb, var(--t-accent) ${100 - i * 9}%, var(--t-gold))` }} />
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}

          {/* ---- footer ---- */}
          {(view === 'list' || view === 'gallery') && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t tk-divider px-4 py-3">
              <p className="font-body text-[12px] text-muted">
                Page {page + 1} of {totalPages} · {processed.length} records
              </p>
              <div className="flex items-center gap-1">
                <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="tk-btn-ghost rounded-lg p-1.5 disabled:opacity-40"><ChevronLeft size={14} /></button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const p = totalPages <= 5 ? i : Math.max(0, Math.min(page - 2, totalPages - 5)) + i;
                  return (
                    <button key={p} onClick={() => setPage(p)}
                      className={`h-7 w-7 rounded-lg font-body text-[12px] font-bold transition ${p === page ? 'tk-btn-primary !p-0' : 'text-muted hover:text-ink'}`}>
                      {p + 1}
                    </button>
                  );
                })}
                <button disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)} className="tk-btn-ghost rounded-lg p-1.5 disabled:opacity-40"><ChevronRight size={14} /></button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
