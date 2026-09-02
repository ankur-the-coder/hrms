import { useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, ChevronRight, Plus, X } from 'lucide-react';
import { useOrgPeople, type OrgPerson } from './orgData';
import DataTable, { type Column } from '../../shared/DataTable';
import Select from '../../shared/Select';
import { NeuLoader, Modal, Badge, btnPrimary, btnGhost, inputCls, labelCls } from '../../shared/primitives';
import { fmtDate, inr } from '../../lib/api';

interface ReportDef { key: string; name: string; desc: string; filter?: (p: OrgPerson) => boolean; cols?: string[] }

const CATEGORIES: { name: string; reports: ReportDef[] }[] = [
  {
    name: 'Employee Info',
    reports: [
      { key: 'all', name: 'All Employees', desc: 'Everyone in your organization with core details.' },
      { key: 'master', name: 'Employee Master Details', desc: 'Complete information about all employees.', cols: ['full_name', 'email', 'gender', 'dept', 'role', 'location', 'employment_type', 'joined', 'salary'] },
      { key: 'job', name: 'Employee Job Details', desc: 'Employees with their job details.', cols: ['full_name', 'dept', 'role', 'employment_type', 'joined'] },
      { key: 'roles', name: 'Employee Roles', desc: 'Employees with their roles and titles.', cols: ['full_name', 'role', 'dept'] },
    ],
  },
  {
    name: 'Employee Demography',
    reports: [
      { key: 'demo', name: 'Demographics Report', desc: 'Gender, location and employment mix.', cols: ['full_name', 'gender', 'location', 'employment_type', 'dob'] },
    ],
  },
  {
    name: 'New Joins & Exits',
    reports: [
      { key: 'joins', name: 'Recent Joins · 90 days', desc: 'Employees who joined in the last quarter.', filter: (p) => p.joined >= new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10) },
      { key: 'exits', name: 'Retired / Exited Employees', desc: 'Employees who have left the organization.', filter: (p) => p.status === 'Exited', cols: ['full_name', 'dept', 'joined', 'exit_date', 'exit_reason'] },
      { key: 'probation', name: 'Employees in Probation', desc: 'Employees currently in their probation period.', filter: (p) => p.status === 'Probation' },
      { key: 'onboarding', name: 'Employees Onboarding', desc: 'Employees currently onboarding.', filter: (p) => p.status === 'Onboarding' },
    ],
  },
];

const ALL_FIELDS: { key: string; label: string }[] = [
  { key: 'full_name', label: 'Full name' }, { key: 'email', label: 'Email' },
  { key: 'gender', label: 'Gender' }, { key: 'dept', label: 'Department' },
  { key: 'role', label: 'Role' }, { key: 'status', label: 'Status' },
  { key: 'location', label: 'Location' }, { key: 'employment_type', label: 'Employment type' },
  { key: 'joined', label: 'Date joined' }, { key: 'exit_date', label: 'Exit date' },
  { key: 'dob', label: 'Date of birth' }, { key: 'salary', label: 'Annual salary' },
];

function buildCols(keys: string[]): Column<OrgPerson>[] {
  return keys.map((k) => {
    const f = ALL_FIELDS.find((x) => x.key === k);
    const col: Column<OrgPerson> = { key: k, label: f?.label || k };
    if (k === 'full_name') col.render = (r) => <span className="font-bold text-ink">{r.full_name}</span>;
    if (k === 'status') col.render = (r) => <Badge tone={r.status === 'Active' ? 'green' : r.status === 'Exited' ? 'red' : 'amber'}>{r.status}</Badge>;
    if (k === 'joined' || k === 'exit_date' || k === 'dob') col.render = (r) => <span className="tabular-nums text-muted">{fmtDate((r as unknown as Record<string, string>)[k])}</span>;
    if (k === 'salary') col.render = (r) => <span className="font-semibold tabular-nums">{inr(r.salary)}</span>;
    return col;
  });
}

const DEFAULT_COLS = ['full_name', 'dept', 'role', 'status', 'location', 'joined'];

export default function OrgReports() {
  const { people, loading, error, reload } = useOrgPeople();
  const [cat, setCat] = useState(CATEGORIES[0].name);
  const [open, setOpen] = useState<ReportDef | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customFields, setCustomFields] = useState<string[]>(['full_name', 'dept', 'role']);
  const [customErr, setCustomErr] = useState('');

  if (loading) return <div className="tk-card"><NeuLoader label="Loading reports…" /></div>;

  const activeCat = CATEGORIES.find((c) => c.name === cat)!;
  const rows = open ? people.filter(open.filter || (() => true)) : [];

  const runCustom = () => {
    setCustomErr('');
    if (!customName.trim()) { setCustomErr('Give the report a name.'); return; }
    if (customFields.length < 2) { setCustomErr('Pick at least 2 fields.'); return; }
    setCustomOpen(false);
    setOpen({ key: 'custom', name: customName, desc: 'Custom report', cols: customFields });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      {error && <div className="tk-card px-4 py-2.5 font-body text-[13px] text-rose-500">{error}</div>}

      {open ? (
        <>
          <div className="flex items-center justify-between">
            <button onClick={() => setOpen(null)} className="font-body text-[13px] font-bold text-primary hover:underline">← All reports</button>
            <p className="font-display text-[16px] font-semibold text-ink">{open.name}</p>
          </div>
          <DataTable<OrgPerson>
            data={rows}
            columns={buildCols(open.cols || DEFAULT_COLS)}
            rowKey={(r) => r.id}
            views={['list', 'gallery', 'chart']}
            groupField="dept"
            pageSize={10}
            onReload={reload}
            searchKeys={['full_name', 'dept', 'role', 'location']}
            card={{ title: (r) => r.full_name, subtitle: (r) => `${r.role} · ${r.dept}`, badge: (r) => r.status }}
          />
        </>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
          {/* categories rail */}
          <div className="tk-card h-fit p-3">
            <p className="mb-2 px-2 font-body text-[10.5px] font-bold uppercase tracking-wider text-muted">Categories</p>
            {CATEGORIES.map((c) => (
              <button key={c.name} onClick={() => setCat(c.name)}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left font-body text-[13px] font-bold transition ${
                  cat === c.name ? 'tk-inset text-primary' : 'text-ink/70 hover:text-ink'
                }`}>
                {c.name} <ChevronRight size={13} />
              </button>
            ))}
            <div className="mt-3 border-t tk-divider pt-3">
              <button onClick={() => { setCustomErr(''); setCustomOpen(true); }} className={btnPrimary + ' w-full !py-2.5 text-[12.5px]'}>
                <Plus size={14} /> Create Custom Report
              </button>
            </div>
          </div>

          {/* report cards */}
          <div className="grid h-fit gap-3.5 sm:grid-cols-2">
            {activeCat.reports.map((r) => (
              <button key={r.key} onClick={() => setOpen(r)}
                className="tk-card group p-4 text-left transition hover:-translate-y-0.5">
                <span className="tk-inset mb-2.5 inline-flex h-9 w-9 items-center justify-center rounded-xl text-primary"><FileText size={15} /></span>
                <p className="font-display text-[14.5px] font-semibold text-ink group-hover:text-primary">{r.name}</p>
                <p className="mt-0.5 font-body text-[12px] leading-relaxed text-muted">{r.desc}</p>
                <p className="mt-2 font-body text-[11px] font-bold text-primary">{people.filter(r.filter || (() => true)).length} records →</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* custom report builder */}
      <Modal open={customOpen} onClose={() => setCustomOpen(false)} title="Create custom report">
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Report name</label>
            <input value={customName} onChange={(e) => setCustomName(e.target.value)} className={inputCls} placeholder="e.g. Bengaluru engineering roster" />
          </div>
          <div>
            <label className={labelCls}>Fields to include</label>
            <Select multi options={ALL_FIELDS.map((f) => ({ value: f.key, label: f.label }))}
              values={customFields} onChange={setCustomFields} placeholder="Pick fields…" maxChips={3} />
          </div>
          {customErr && <p className="rounded-xl bg-rose-500/10 px-3.5 py-2.5 font-body text-[12.5px] text-rose-500">{customErr}</p>}
          <div className="flex justify-end gap-2.5">
            <button onClick={() => setCustomOpen(false)} className={btnGhost}><X size={14} /> Cancel</button>
            <button onClick={runCustom} className={btnPrimary}><FileText size={14} /> Run report</button>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
}
