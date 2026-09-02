import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, UserCheck, RotateCcw } from 'lucide-react';
import { useOrgPeople, countBy, ageOf, tenureYears, distinct, type OrgPerson } from './orgData';
import Chart, { StackedColumns, NeuDonut, PALETTE, type StackedSeries } from '../../shared/Charts';
import Select from '../../shared/Select';
import DataTable, { type Column } from '../../shared/DataTable';
import DateRangePicker, { type DateRange } from '../../shared/pickers/DateRangePicker';
import { NeuLoader, Badge } from '../../shared/primitives';
import { fmtDate } from '../../lib/api';

const SUBS = ['Headcount by Demographics', 'Growth & Retention', 'Attrition Analysis'];

const GENDER_SERIES = ['Female', 'Male', 'Non-binary', 'Prefer not to respond', 'Transgender', 'Not Specified'];
const EMP_SERIES = ['Full Time', 'Part Time', 'None'];
const NATION_SERIES = ['Armenia', 'Aruba', 'India', 'United Kingdom', 'Not Specified'];
const WORKER_SERIES = ['Permanent', 'Contingent'];
const AGE_BRACKETS = ['<18', '18–25', '26–30', '31–40', '41–55', '55+'];
const TENURE_BRACKETS = ['0–4', '4–8', '8–12', '12–16', '16–20', '20–24', '24–28'];

const ageBracket = (p: OrgPerson): string => {
  const a = ageOf(p.dob);
  if (a === null) return '<18';
  if (a < 18) return '<18';
  if (a <= 25) return '18–25';
  if (a <= 30) return '26–30';
  if (a <= 40) return '31–40';
  if (a <= 55) return '41–55';
  return '55+';
};
const tenureBracket = (p: OrgPerson): string => {
  const t = tenureYears(p);
  if (t < 4) return '0–4';
  if (t < 8) return '4–8';
  if (t < 12) return '8–12';
  if (t < 16) return '12–16';
  if (t < 20) return '16–20';
  if (t < 24) return '20–24';
  return '24–28';
};

/** Build stacked series: for each seriesName count rows per category. */
function buildStacks(rows: OrgPerson[], categories: string[], catOf: (p: OrgPerson) => string, seriesNames: string[], seriesOf: (p: OrgPerson) => string): StackedSeries[] {
  return seriesNames.map((name, i) => ({
    name,
    color: PALETTE[i % PALETTE.length],
    values: categories.map((c) => rows.filter((p) => catOf(p) === c && (seriesOf(p) || 'Not Specified') === name).length),
  }));
}

/** Insight lines: dept with most / least of the top series. */
function insightsFor(rows: OrgPerson[], categories: string[], seriesNames: string[], seriesOf: (p: OrgPerson) => string): string[] {
  const out: string[] = [];
  seriesNames.slice(0, 2).forEach((name) => {
    const counts = categories.map((c) => ({ c, n: rows.filter((p) => p.dept === c && (seriesOf(p) || 'Not Specified') === name).length }));
    const present = counts.filter((x) => x.n > 0);
    if (!present.length) return;
    const most = present.reduce((a, b) => (b.n > a.n ? b : a));
    const least = present.reduce((a, b) => (b.n < a.n ? b : a));
    out.push(`Most ${name}: ${most.c} (${most.n}) · Least: ${least.c} (${least.n})`);
  });
  return out;
}

const KpiCard = ({ label, value }: { label: string; value: string }) => (
  <div className="tk-inset flex-1 rounded-xl px-3 py-2.5 text-center">
    <p className="font-display text-[17px] font-bold leading-none text-ink">{value}</p>
    <p className="mt-1 font-body text-[9.5px] font-bold uppercase tracking-wide text-muted">{label}</p>
  </div>
);

export default function OrgAnalytics() {
  const { people, loading, error } = useOrgPeople();
  const [sub, setSub] = useState(SUBS[0]);

  // shared filters: Business Unit, Department, Location, Cost Center, Legal Entity, Date Range, Worker Type
  const [bu, setBu] = useState<string | null>(null);
  const [deptF, setDeptF] = useState<string | null>(null);
  const [locF, setLocF] = useState<string | null>(null);
  const [ccF, setCcF] = useState<string | null>(null);
  const [leF, setLeF] = useState<string | null>(null);
  const [wtF, setWtF] = useState<string | null>(null);
  const [range, setRange] = useState<DateRange>({ start: '', end: '' });
  const [exitTypeF, setExitTypeF] = useState<string | null>(null); // attrition only

  const reset = () => { setBu(null); setDeptF(null); setLocF(null); setCcF(null); setLeF(null); setWtF(null); setRange({ start: '', end: '' }); setExitTypeF(null); };

  const filtered = useMemo(() => people.filter((p) =>
    (!bu || p.business_unit === bu) &&
    (!deptF || p.dept === deptF) &&
    (!locF || p.location === locF) &&
    (!ccF || p.cost_center === ccF) &&
    (!leF || p.legal_entity === leF) &&
    (!wtF || p.worker_type === wtF) &&
    (!range.start || p.joined >= range.start) &&
    (!range.end || p.joined <= range.end)
  ), [people, bu, deptF, locF, ccF, leF, wtF, range]);

  const active = useMemo(() => filtered.filter((p) => p.status !== 'Exited'), [filtered]);
  const exited = useMemo(() => filtered.filter((p) => p.status === 'Exited' && (!exitTypeF || p.exit_type === exitTypeF)), [filtered, exitTypeF]);
  const depts = useMemo(() => distinct(active, (p) => p.dept), [active]);

  /* growth (12 months, uses full filtered set) */
  const growth = useMemo(() => {
    const out: { label: string; value: number }[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0).toISOString().slice(0, 10);
      const count = filtered.filter((p) => p.joined <= end && (!p.exit_date || p.exit_date > end)).length;
      out.push({ label: d.toLocaleDateString('en', { month: 'short' }), value: count });
    }
    return out;
  }, [filtered]);

  if (loading) return <div className="tk-card"><NeuLoader label="Computing analytics…" /></div>;

  const hc0 = growth[0]?.value || 1;
  const hcN = growth[growth.length - 1]?.value || 0;
  const growthRate = (((hcN - hc0) / hc0) * 100).toFixed(1);
  const exits12m = filtered.filter((p) => p.exit_date && new Date(p.exit_date) > new Date(Date.now() - 365 * 864e5)).length;
  const avgHc = growth.reduce((s, g) => s + g.value, 0) / (growth.length || 1);
  const attritionRate = ((exits12m / Math.max(1, avgHc)) * 100).toFixed(1);
  const retentionRate = (100 - +attritionRate).toFixed(1);

  /* age KPIs */
  const ages = active.map((p) => ageOf(p.dob)).filter((a): a is number => a !== null);
  const agesM = active.filter((p) => p.gender === 'Male').map((p) => ageOf(p.dob)).filter((a): a is number => a !== null);
  const agesF = active.filter((p) => p.gender === 'Female').map((p) => ageOf(p.dob)).filter((a): a is number => a !== null);
  const avg = (arr: number[]) => (arr.length ? (arr.reduce((s, a) => s + a, 0) / arr.length).toFixed(1) : '—');
  /* tenure KPIs */
  const tenures = active.map(tenureYears);
  const maxT = tenures.length ? Math.max(...tenures).toFixed(1) : '—';
  const minT = tenures.length ? Math.min(...tenures).toFixed(1) : '—';
  const avgT = tenures.length ? (tenures.reduce((s, t) => s + t, 0) / tenures.length).toFixed(1) : '—';

  const exitCols: Column<OrgPerson>[] = [
    { key: 'full_name', label: 'Employee', render: (r) => <span className="font-bold text-ink">{r.full_name}</span> },
    { key: 'dept', label: 'Department' },
    { key: 'location', label: 'Location', defaultHidden: true },
    { key: 'exit_type', label: 'Exit type', render: (r) => <Badge tone="blue">{r.exit_type || '—'}</Badge> },
    { key: 'exit_date', label: 'Exit date', accessor: (r) => r.exit_date || '', render: (r) => <span className="tabular-nums text-muted">{fmtDate(r.exit_date)}</span> },
    { key: 'exit_reason', label: 'Reason', render: (r) => <Badge tone="amber">{r.exit_reason || '—'}</Badge> },
    { key: 'tenure', label: 'Tenure', accessor: (r) => tenureYears(r), render: (r) => <span className="tabular-nums">{tenureYears(r).toFixed(1)} yr</span> },
  ];

  const filterSelect = (label: string, value: string | null, onChange: (v: string | null) => void, options: string[], w = 'w-36') => (
    <Select options={options.map((o) => ({ value: o, label: o }))} value={value} onChange={onChange} placeholder={label} searchable={false} className={w} />
  );

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      {error && <div className="tk-card px-4 py-2.5 font-body text-[13px] text-rose-500">{error}</div>}

      {/* sub-tabs */}
      <div className="tk-card flex flex-wrap items-center gap-2.5 p-3">
        <div className="tk-inset flex gap-0.5 p-1">
          {SUBS.map((s) => (
            <button key={s} onClick={() => setSub(s)}
              className={`rounded-lg px-3 py-1.5 font-body text-[11.5px] font-bold transition ${sub === s ? 'tk-raise-sm text-primary' : 'text-muted hover:text-ink'}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* filters */}
      <div className="tk-card flex flex-wrap items-center gap-2 p-3">
        {filterSelect('Business Unit', bu, setBu, distinct(people, (p) => p.business_unit), 'w-40')}
        {filterSelect('Department', deptF, setDeptF, distinct(people, (p) => p.dept))}
        {filterSelect('Location', locF, setLocF, distinct(people, (p) => p.location))}
        {filterSelect('Cost Center', ccF, setCcF, distinct(people, (p) => p.cost_center), 'w-32')}
        {filterSelect('Legal Entity', leF, setLeF, distinct(people, (p) => p.legal_entity), 'w-44')}
        <DateRangePicker value={range} onChange={setRange} placeholder="Date Range" className="w-48" />
        {filterSelect('Worker Type', wtF, setWtF, WORKER_SERIES, 'w-36')}
        {sub === SUBS[2] && filterSelect('Exit Types', exitTypeF, setExitTypeF, distinct(people.filter((p) => p.exit_type), (p) => p.exit_type || ''), 'w-36')}
        <button onClick={reset} className="tk-btn-ghost ml-auto flex items-center gap-1.5 rounded-xl px-3 py-2 font-body text-[12px] font-bold">
          <RotateCcw size={12} /> Reset
        </button>
        <Badge tone="green">{sub === SUBS[2] ? exited.length : active.length} in scope</Badge>
      </div>

      {/* ================= 1 · HEADCOUNT BY DEMOGRAPHICS (10 charts) ================= */}
      {sub === SUBS[0] && (
        <div className="space-y-5">
          {/* Section 1 — 4 donut summary */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <NeuDonut title="Gender Distribution" legendSide size={132} centerLabel="headcount"
              data={countBy(active, (p) => p.gender)} />
            <NeuDonut title="Employment Type" legendSide size={132} centerLabel="headcount"
              data={countBy(active, (p) => p.employment_type)} />
            <NeuDonut title="Worker Type" legendSide size={132} centerLabel="headcount"
              data={countBy(active, (p) => p.worker_type).map((d, i) => ({ ...d, color: ['#0d7a54', '#c9932b'][i] }))} />
            <NeuDonut title="Nationality Distribution" legendSide size={132} centerLabel="headcount"
              data={countBy(active, (p) => p.nationality)} />
          </div>

          {/* Section 2 — lifecycle & tenure */}
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-3">
              <StackedColumns title="Age of Employees (in Years)" height={260}
                categories={AGE_BRACKETS}
                series={buildStacks(active, AGE_BRACKETS, ageBracket, GENDER_SERIES, (p) => p.gender)} />
              <div className="flex gap-2.5">
                <KpiCard label="Average Age (Overall)" value={avg(ages)} />
                <KpiCard label="Average Age (Man)" value={avg(agesM)} />
                <KpiCard label="Average Age (Woman)" value={avg(agesF)} />
              </div>
            </div>
            <div className="space-y-3">
              <StackedColumns title="Years in Organisation" height={260}
                categories={TENURE_BRACKETS}
                series={[{ name: 'Experience', color: '#0d7a54', values: TENURE_BRACKETS.map((b) => active.filter((p) => tenureBracket(p) === b).length) }]} />
              <div className="flex gap-2.5">
                <KpiCard label="Max Experience" value={`${maxT} yr`} />
                <KpiCard label="Min Experience" value={`${minT} yr`} />
                <KpiCard label="Avg Years at Org" value={`${avgT} yr`} />
              </div>
            </div>
          </div>

          {/* Section 3 — department breakdowns (full width) */}
          <StackedColumns title="Headcount by Gender Across Department" height={300}
            categories={depts}
            series={buildStacks(active, depts, (p) => p.dept, GENDER_SERIES, (p) => p.gender)}
            insight={insightsFor(active, depts, ['Female', 'Male'], (p) => p.gender)} />
          <StackedColumns title="Headcount by Employment Type Across Department" height={300}
            categories={depts}
            series={buildStacks(active, depts, (p) => p.dept, EMP_SERIES, (p) => p.employment_type)}
            insight={insightsFor(active, depts, ['Full Time', 'Part Time'], (p) => p.employment_type)} />
          <StackedColumns title="Headcount by Nationality Across Department" height={300}
            categories={depts}
            series={buildStacks(active, depts, (p) => p.dept, NATION_SERIES, (p) => p.nationality)} />
          <StackedColumns title="Headcount by Worker Type Across Department" height={300}
            categories={depts}
            series={buildStacks(active, depts, (p) => p.dept, WORKER_SERIES, (p) => p.worker_type)}
            insight={insightsFor(active, depts, ['Permanent', 'Contingent'], (p) => p.worker_type)} />
        </div>
      )}

      {/* ================= 2 · GROWTH & RETENTION ================= */}
      {sub === SUBS[1] && (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-3.5">
            {[
              { icon: TrendingUp, label: 'Growth rate · 12m', value: `${growthRate}%`, tone: 'text-primary' },
              { icon: UserCheck, label: 'Retention rate', value: `${retentionRate}%`, tone: 'text-sky-600' },
              { icon: TrendingDown, label: 'Attrition rate', value: `${attritionRate}%`, tone: 'text-rose-500' },
            ].map(({ icon: Icon, label, value, tone }) => (
              <div key={label} className="tk-card p-4">
                <Icon size={16} className={`mb-1.5 ${tone}`} />
                <p className="font-display text-[20px] font-semibold text-ink">{value}</p>
                <p className="font-body text-[10px] font-bold uppercase tracking-wider text-muted">{label}</p>
              </div>
            ))}
          </div>
          <Chart title="Headcount growth · last 12 months" data={growth} defaultKind="bar" height={280} />
          <div className="grid gap-5 lg:grid-cols-2">
            <Chart title="Joins per month · last 12 months" data={(() => {
              const now = new Date();
              const out: { label: string; value: number }[] = [];
              for (let i = 11; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const key = d.toISOString().slice(0, 7);
                out.push({ label: d.toLocaleDateString('en', { month: 'short' }), value: filtered.filter((p) => p.joined.startsWith(key)).length });
              }
              return out;
            })()} defaultKind="area" height={240} />
            <Chart title="Exits per month · last 12 months" data={(() => {
              const now = new Date();
              const out: { label: string; value: number }[] = [];
              for (let i = 11; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const key = d.toISOString().slice(0, 7);
                out.push({ label: d.toLocaleDateString('en', { month: 'short' }), value: filtered.filter((p) => p.exit_date?.startsWith(key)).length });
              }
              return out;
            })()} defaultKind="line" height={240} />
          </div>
        </div>
      )}

      {/* ================= 3 · ATTRITION ANALYSIS ================= */}
      {sub === SUBS[2] && (
        <div className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-3">
            <NeuDonut title="Attrition by Exit Type" legendSide size={132} centerLabel="exits"
              data={countBy(exited, (p) => p.exit_type || 'Unknown')} />
            <Chart title="Attrition by department" data={countBy(exited, (p) => p.dept)} defaultKind="donut" height={230} />
            <Chart title="Attrition by exit reason" data={countBy(exited, (p) => p.exit_reason || 'Unknown')} defaultKind="pie" height={230} />
          </div>
          <DataTable<OrgPerson>
            data={exited}
            columns={exitCols}
            rowKey={(r) => r.id}
            views={['list', 'timeline']}
            dateField="exit_date"
            pageSize={8}
            exportName="attrition-report"
            searchKeys={['full_name', 'dept', 'role', 'exit_reason', 'exit_type']}
            card={{ title: (r) => r.full_name, subtitle: (r) => `${r.role} · ${r.exit_reason || ''}` }}
            exportDetail={(r) => ({
              Employee: r.full_name, Department: r.dept, Role: r.role, Location: r.location,
              'Exit type': r.exit_type || '', 'Exit reason': r.exit_reason || '',
              'Exit date': r.exit_date || '', 'Tenure (yr)': tenureYears(r).toFixed(1),
            })}
          />
        </div>
      )}
    </motion.div>
  );
}
