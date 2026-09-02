import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { UserCheck, UserX, Trash2, Pencil, MapPin } from 'lucide-react';
import { api, inr, fmtDate } from '../lib/api';
import DataTable, { type Column } from '../shared/DataTable';
import Select from '../shared/Select';
import DatePicker from '../shared/pickers/DatePicker';
import DateRangePicker, { type DateRange } from '../shared/pickers/DateRangePicker';
import { MonthPicker, MonthRangePicker, type MonthRange } from '../shared/pickers/MonthPicker';
import TimePicker from '../shared/pickers/TimePicker';
import { Badge, labelCls } from '../shared/primitives';
import Chart, { NeuBars, NeuDonut } from '../shared/Charts';

interface Person {
  id: number; full_name: string; dept: string; role: string; status: string;
  city: string; joined: string; salary: number;
}

const statusTone = (s: string): 'green' | 'amber' | 'blue' | 'red' =>
  s === 'Active' ? 'green' : s === 'On Leave' ? 'amber' : s === 'Contract' ? 'blue' : 'red';

export default function Playground() {
  const [people, setPeople] = useState<Person[] | null>(null);
  const [err, setErr] = useState('');
  const [toast, setToast] = useState('');

  // picker demo state
  const [date, setDate] = useState('');
  const [range, setRange] = useState<DateRange>({ start: '', end: '' });
  const [month, setMonth] = useState('');
  const [mRange, setMRange] = useState<MonthRange>({ start: '', end: '' });
  const [time, setTime] = useState('09:30');
  const [single, setSingle] = useState<string | null>(null);
  const [multi, setMulti] = useState<string[]>([]);

  const [tableLoading, setTableLoading] = useState(true);
  const load = useCallback(() => {
    setTableLoading(true);
    api<Person[]>('demo-data')
      .then((d) => setPeople(d))
      .catch((e) => setErr(e.message))
      .finally(() => setTableLoading(false));
  }, []);
  useEffect(load, [load]);

  const notify = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500); };

  const setStatus = async (ids: number[], status: string) => {
    try {
      await api('demo-data', { method: 'PUT', body: JSON.stringify({ ids, patch: { status } }) });
      notify(`${ids.length} record${ids.length > 1 ? 's' : ''} → ${status}`);
      load();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); }
  };
  const remove = async (ids: number[]) => {
    try {
      await api('demo-data', { method: 'DELETE', body: JSON.stringify({ ids }) });
      notify(`Deleted ${ids.length} record${ids.length > 1 ? 's' : ''}`);
      load();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); }
  };

  const columns: Column<Person>[] = [
    { key: 'full_name', label: 'Name', render: (r) => <span className="font-bold text-ink">{r.full_name}</span>, tooltip: (r) => `${r.full_name} · ${r.role}` },
    { key: 'dept', label: 'Department', filterOptions: ['Design', 'Engineering', 'Sales', 'Human Resources', 'Finance', 'Marketing'] },
    { key: 'role', label: 'Role', defaultHidden: false },
    { key: 'status', label: 'Status', filterOptions: ['Active', 'On Leave', 'Contract', 'Inactive'], render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> },
    { key: 'city', label: 'City', defaultHidden: true, render: (r) => <span className="flex items-center gap-1 text-muted"><MapPin size={11} /> {r.city}</span> },
    { key: 'joined', label: 'Joined', accessor: (r) => r.joined, render: (r) => <span className="tabular-nums text-muted">{fmtDate(r.joined)}</span> },
    { key: 'salary', label: 'Salary (p.a.)', accessor: (r) => r.salary, render: (r) => <span className="font-semibold tabular-nums">{inr(r.salary)}</span> },
  ];

  const deptOptions = ['Design', 'Engineering', 'Sales', 'Human Resources', 'Finance', 'Marketing'].map((d) => ({ value: d, label: d }));

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <p className="font-body text-[12px] font-bold uppercase tracking-[0.18em] text-primary">Shared component kit</p>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-ink">Design system playground</h1>
        <p className="mt-1 font-body text-[13px] text-muted">Live against the database — every action below persists. Switch themes from your avatar to test all skins.</p>
      </motion.div>

      {err && <div className="rounded-xl bg-rose-500/8 px-4 py-2.5 font-body text-[13px] text-rose-500">{err} <button onClick={() => { setErr(''); load(); }} className="font-bold underline">retry</button></div>}
      {toast && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="fixed left-1/2 top-20 z-[80] -translate-x-1/2 rounded-full bg-ink px-5 py-2.5 font-body text-[13px] font-bold text-paper shadow-xl">
          {toast}
        </motion.div>
      )}

      {/* ================= DataTable ================= */}
      <section>
        <h2 className="mb-3 font-display text-lg font-semibold text-ink">DataTable · 6 views</h2>
        <DataTable<Person>
            data={people || []}
            loading={tableLoading}
            onReload={load}
            columns={columns}
            rowKey={(r) => r.id}
            views={['list', 'kanban', 'gallery', 'calendar', 'timeline', 'chart']}
            searchKeys={['full_name', 'dept', 'role', 'city']}
            pageSize={8}
            groupField="dept"
            dateField="joined"
            exportName="employee-directory"
            exportDetail={(r) => ({ Name: r.full_name, Department: r.dept, Role: r.role, Status: r.status, City: r.city, Joined: r.joined, 'Salary (p.a.)': r.salary })}
            onKanbanMove={async (row, group) => {
              try {
                await api('demo-data', { method: 'PUT', body: JSON.stringify({ ids: [row.id], patch: { dept: group } }) });
                notify(`${row.full_name} → ${group}`);
                load();
              } catch (e) { setErr(e instanceof Error ? e.message : 'Move failed'); }
            }}
            card={{ title: (r) => r.full_name, subtitle: (r) => `${r.role} · ${r.city}`, badge: (r) => r.status }}
            expandable={(r) => (
              <div className="grid gap-2 font-body text-[12.5px] text-ink/75 sm:grid-cols-3">
                <span>Role: <b>{r.role}</b></span>
                <span>City: <b>{r.city}</b></span>
                <span>Salary: <b>{inr(r.salary)}</b></span>
              </div>
            )}
            rowActions={[
              { label: 'Mark Active', icon: <UserCheck size={14} />, onClick: (r) => setStatus([r.id], 'Active') },
              { label: 'Mark On Leave', icon: <Pencil size={14} />, onClick: (r) => setStatus([r.id], 'On Leave') },
              { label: 'Deactivate', icon: <UserX size={14} />, onClick: (r) => setStatus([r.id], 'Inactive') },
              { label: 'Delete', icon: <Trash2 size={14} />, tone: 'danger', onClick: (r) => remove([r.id]) },
            ]}
            bulkActions={[
              { label: 'Mark Active', icon: <UserCheck size={13} />, onClick: (rows) => setStatus(rows.map((r) => r.id), 'Active') },
              { label: 'Deactivate', icon: <UserX size={13} />, onClick: (rows) => setStatus(rows.map((r) => r.id), 'Inactive') },
              { label: 'Delete', icon: <Trash2 size={13} />, tone: 'danger', onClick: (rows) => remove(rows.map((r) => r.id)) },
            ]}
          />
      </section>

      {/* ================= Pickers ================= */}
      <section>
        <h2 className="mb-3 font-display text-lg font-semibold text-ink">Pickers · inline, flip-aware, mobile sheets</h2>
        <div className="tk-card grid gap-5 p-5 sm:grid-cols-2 lg:grid-cols-3">
          <div><label className={labelCls}>Date</label><DatePicker value={date} onChange={setDate} /></div>
          <div><label className={labelCls}>Date range</label><DateRangePicker value={range} onChange={setRange} /></div>
          <div><label className={labelCls}>Time (clock / wheel / sliders)</label><TimePicker value={time} onChange={setTime} /></div>
          <div><label className={labelCls}>Month</label><MonthPicker value={month} onChange={setMonth} /></div>
          <div><label className={labelCls}>Month range</label><MonthRangePicker value={mRange} onChange={setMRange} /></div>
        </div>
      </section>

      {/* ================= Selects ================= */}
      <section>
        <h2 className="mb-3 font-display text-lg font-semibold text-ink">Select · single & multi</h2>
        <div className="tk-card grid gap-5 p-5 sm:grid-cols-2">
          <div><label className={labelCls}>Single select (searchable)</label>
            <Select options={deptOptions} value={single} onChange={setSingle} placeholder="Choose a department…" /></div>
          <div><label className={labelCls}>Multi select (chips)</label>
            <Select multi options={deptOptions} values={multi} onChange={setMulti} placeholder="Choose departments…" /></div>
        </div>
      </section>

      {/* ================= Charts ================= */}
      <section className="pb-10">
        <h2 className="mb-3 font-display text-lg font-semibold text-ink">Chart QA gallery · every kind, live</h2>
        {(() => {
          const qa = [
            { label: 'North Region', value: 42 },
            { label: 'South Region', value: 28 },
            { label: 'East Region', value: 19 },
            { label: 'West Region', value: 33 },
            { label: 'Central Hub', value: 12 },
          ];
          return (
            <div className="mb-6 grid gap-5 lg:grid-cols-3">
              <Chart title="QA · Polar (2D)" data={qa} defaultKind="polar" height={240} />
              <Chart title="QA · Radar (2D)" data={qa} defaultKind="radar" height={240} />
              <Chart title="QA · Pie (starts 3D)" data={qa} defaultKind="pie" defaultDim="3d" height={240} />
              <Chart title="QA · Donut (starts 3D)" data={qa} defaultKind="donut" defaultDim="3d" height={240} />
              <Chart title="QA · Area (starts 3D)" defaultKind="area" defaultDim="3d" height={240}
                categories={['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']}
                series={[
                  { name: 'Product & Tech', values: [12, 18, 15, 22, 26, 24] },
                  { name: 'Go-To-Market', values: [8, 10, 14, 12, 17, 19] },
                  { name: 'Corporate', values: [5, 6, 8, 7, 9, 11] },
                ]} />
              <Chart title="QA · Line (3D disabled)" data={qa} defaultKind="line" height={240} />
            </div>
          );
        })()}
        <h2 className="mb-3 font-display text-lg font-semibold text-ink">Shared charts · 2D / 3D toggle · export</h2>
        {(() => {
          const byDept = new Map<string, number>();
          const byStatus = new Map<string, number>();
          (people || []).forEach((p) => {
            byDept.set(p.dept, (byDept.get(p.dept) || 0) + 1);
            byStatus.set(p.status, (byStatus.get(p.status) || 0) + 1);
          });
          const deptData = [...byDept.entries()].map(([label, value]) => ({ label, value }));
          const statusData = [...byStatus.entries()].map(([label, value]) => ({ label, value }));
          return (
            <div className="space-y-5">
              <div className="grid gap-5 lg:grid-cols-2">
                <Chart title="Headcount by department" data={deptData} defaultKind="bar" loading={tableLoading} />
                <Chart title="Workforce status" data={statusData} defaultKind="donut" loading={tableLoading} />
              </div>
              <div className="grid gap-5 lg:grid-cols-2">
                <Chart title="Hiring pipeline (funnel / pyramid)" defaultKind="funnel" extraKinds={['funnel', 'pyramid']} loading={tableLoading}
                  data={[
                    { label: 'Applications', value: 480 },
                    { label: 'Screened', value: 260 },
                    { label: 'Interviewed', value: 120 },
                    { label: 'Offers', value: 38 },
                    { label: 'Hired', value: 24 },
                  ]} />
                <Chart title="Status by department (stacked · merged)" defaultKind="bar" loading={tableLoading}
                  categories={deptData.map((d) => d.label)}
                  series={statusData.map((s) => ({
                    name: s.label,
                    values: deptData.map((d) => (people || []).filter((p) => p.dept === d.label && p.status === s.label).length),
                  }))} />
              </div>
              <p className="font-body text-[12px] font-bold uppercase tracking-wider text-muted">Neumorphic chart family (switchable — donut / pie / bars / columns / line / area)</p>
              <div className="grid gap-5 lg:grid-cols-2">
                <NeuBars title="Department distribution" data={deptData} />
                <NeuDonut title="Status split" data={statusData} />
              </div>
            </div>
          );
        })()}
      </section>
    </div>
  );
}
