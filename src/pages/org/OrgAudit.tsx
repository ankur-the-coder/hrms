import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ScrollText, RotateCcw } from 'lucide-react';
import { api, fmtDate } from '../../lib/api';
import { type AuditRow, distinct } from './orgData';
import DataTable, { type Column } from '../../shared/DataTable';
import DateRangePicker, { type DateRange } from '../../shared/pickers/DateRangePicker';
import Select from '../../shared/Select';
import { Badge } from '../../shared/primitives';
import { dstr } from '../../shared/pickers/DatePicker';

const catTone = (c: string): 'green' | 'blue' | 'gold' | 'amber' | 'neutral' =>
  c === 'Employee' ? 'green' : c === 'Auth' ? 'blue' : c === 'Payroll' ? 'gold' : c === 'Org' ? 'amber' : 'neutral';

const DEFAULT_RANGE = (): DateRange => ({ start: dstr(new Date(Date.now() - 44 * 864e5)), end: dstr(new Date()) });

export default function OrgAudit() {
  const [all, setAll] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // filters: Date Range · Category · Employee · Sub Category · Attribute · Event · Reset
  const [range, setRange] = useState<DateRange>(DEFAULT_RANGE);
  const [cat, setCat] = useState<string | null>(null);
  const [actor, setActor] = useState<string | null>(null);
  const [subCat, setSubCat] = useState<string | null>(null);
  const [attr, setAttr] = useState<string | null>(null);
  const [event, setEvent] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ resource: 'audit' });
    if (range.start) params.set('from', range.start);
    if (range.end) params.set('to', range.end);
    api<AuditRow[]>(`organization?${params}`)
      .then(setAll)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [range]);

  useEffect(load, [load]);

  const rows = useMemo(() => all.filter((r) =>
    (!cat || r.category === cat) &&
    (!actor || r.actor === actor) &&
    (!subCat || r.sub_category === subCat) &&
    (!attr || r.attribute === attr) &&
    (!event || r.event === event)
  ), [all, cat, actor, subCat, attr, event]);

  const reset = () => { setRange(DEFAULT_RANGE()); setCat(null); setActor(null); setSubCat(null); setAttr(null); setEvent(null); };

  const cols: Column<AuditRow>[] = [
    {
      key: 'created_at', label: 'When', accessor: (r) => r.created_at,
      render: (r) => <span className="tabular-nums text-muted">{fmtDate(r.created_at, { day: 'numeric', month: 'short' })} · {new Date(r.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>,
    },
    { key: 'actor', label: 'Employee', render: (r) => <span className="font-bold text-ink">{r.actor}</span> },
    { key: 'category', label: 'Category', render: (r) => <Badge tone={catTone(r.category)}>{r.category}</Badge> },
    { key: 'sub_category', label: 'Sub category' },
    { key: 'attribute', label: 'Attribute', render: (r) => <span className="text-muted">{r.attribute}</span> },
    { key: 'event', label: 'Event', render: (r) => <Badge>{r.event}</Badge> },
    { key: 'detail', label: 'Detail', tooltip: (r) => r.detail, render: (r) => <span className="block max-w-[220px] truncate text-muted">{r.detail}</span> },
  ];

  const sel = (label: string, value: string | null, onChange: (v: string | null) => void, options: string[], w = 'w-36') => (
    <Select options={options.map((o) => ({ value: o, label: o }))} value={value} onChange={onChange} placeholder={label} searchable={false} className={w} />
  );

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      {error && <div className="tk-card px-4 py-2.5 font-body text-[13px] text-rose-500">{error}</div>}

      <div className="tk-card flex flex-wrap items-center gap-2 p-3.5">
        <span className="tk-inset flex h-9 w-9 items-center justify-center rounded-xl text-primary"><ScrollText size={15} /></span>
        <div className="mr-2">
          <p className="font-display text-[14.5px] font-semibold text-ink">Audit logs</p>
          <p className="font-body text-[11.5px] text-muted">Track and review user actions across the system</p>
        </div>
        <DateRangePicker value={range} onChange={setRange} placeholder="Date Range" className="w-48" />
        {sel('Category', cat, setCat, distinct(all, (r) => r.category), 'w-32')}
        {sel('Employee', actor, setActor, distinct(all, (r) => r.actor), 'w-38')}
        {sel('Sub Category', subCat, setSubCat, distinct(all, (r) => r.sub_category), 'w-36')}
        {sel('Attribute', attr, setAttr, distinct(all, (r) => r.attribute), 'w-36')}
        {sel('Event', event, setEvent, distinct(all, (r) => r.event), 'w-30')}
        <button onClick={reset} className="tk-btn-ghost ml-auto flex items-center gap-1.5 rounded-xl px-3 py-2 font-body text-[12px] font-bold">
          <RotateCcw size={12} /> Reset
        </button>
      </div>

      <DataTable<AuditRow>
        data={rows}
        loading={loading}
        onReload={load}
        columns={cols}
        rowKey={(r) => r.id}
        views={['list', 'timeline', 'chart']}
        groupField="category"
        dateField="created_at"
        pageSize={10}
        exportName="audit-logs"
        searchKeys={['actor', 'event', 'detail', 'category', 'sub_category', 'attribute']}
        card={{ title: (r) => `${r.event} · ${r.attribute}`, subtitle: (r) => `${r.actor} · ${r.detail}` }}
        exportDetail={(r) => ({
          Employee: r.actor, Category: r.category, 'Sub category': r.sub_category,
          Attribute: r.attribute, Event: r.event, Detail: r.detail,
          Timestamp: new Date(r.created_at).toLocaleString('en-IN'),
        })}
        expandable={(r) => (
          <div className="grid gap-1.5 font-body text-[12.5px] text-ink/75 sm:grid-cols-2">
            <span>Employee: <b>{r.actor}</b></span>
            <span>Category: <b>{r.category} / {r.sub_category}</b></span>
            <span>Attribute: <b>{r.attribute}</b></span>
            <span>Event: <b>{r.event}</b></span>
            <span className="sm:col-span-2">Detail: {r.detail}</span>
            <span>Timestamp: <b>{new Date(r.created_at).toLocaleString('en-IN')}</b></span>
          </div>
        )}
      />
    </motion.div>
  );
}
