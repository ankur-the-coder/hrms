import { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Scale, Boxes, MapPin, GitBranch, Coins, BadgeDollarSign, Layers,
  Plus, Pencil, Trash2, Users, Upload, Landmark, PenLine, Mail, Phone, Globe,
  ChevronRight, ChevronDown, CheckCircle2, Circle, Banknote, ShieldCheck,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useOrgPeople, type OrgPerson } from './orgData';
import DataTable, { type Column } from '../../shared/DataTable';
import ImportWizard, { type WizardField } from '../../shared/ImportWizard';
import Select from '../../shared/Select';
import DatePicker from '../../shared/pickers/DatePicker';
import { Modal, Drawer, NeuLoader, Badge, btnPrimary, btnGhost, inputCls, labelCls } from '../../shared/primitives';

/* ============================================================
   Organization → Org Structure
   Legal Entities · Business Units · Locations · Departments ·
   Cost Centers · Pay Grades · Bands
   ============================================================ */

interface Signatory { first_name: string; middle_name: string; last_name: string; designation: string; email: string }
interface BankAccount { verification: string; account_type: string; bank_name: string; routing_number: string; account_number: string }
interface PayrollTask { task: string; done: boolean }
interface LegalEntity {
  id: number; name: string; legal_name: string; cin: string; incorporation_date: string;
  business_type: string; sector: string; nature: string; phone: string; email: string; website: string;
  address1: string; address2: string; city: string; state: string; zip: string; country: string;
  signatories: Signatory[]; bank_accounts: BankAccount[]; payroll_tasks: PayrollTask[];
}
interface BusinessUnit { id: number; name: string; head: string; parent: string; description: string }
interface OrgLocation {
  id: number; name: string; group_email: string; timezone: string; country: string; state: string;
  address1: string; address2: string; city: string; zip: string; description: string;
}
interface Department {
  id: number; name: string; display_name: string; parent_id: number | null; head: string; description: string;
  wall_posts: boolean; wall_announcements: boolean; wall_polls: boolean;
}
interface CostCenter { id: number; name: string; code: string; head: string; description: string }
interface SimpleRow { id: number; name: string; description: string }

interface Bootstrap {
  legal_entities: LegalEntity[]; business_units: BusinessUnit[]; locations: OrgLocation[];
  departments: Department[]; cost_centers: CostCenter[]; pay_grades: SimpleRow[]; bands: SimpleRow[];
}

const SECTIONS = [
  { key: 'legal-entities', label: 'Legal Entities', icon: Scale },
  { key: 'business-units', label: 'Business Units', icon: Boxes },
  { key: 'locations', label: 'Locations', icon: MapPin },
  { key: 'departments', label: 'Departments', icon: GitBranch },
  { key: 'cost-centers', label: 'Cost Centers', icon: Coins },
  { key: 'pay-grades', label: 'Pay Grades', icon: BadgeDollarSign },
  { key: 'bands', label: 'Bands', icon: Layers },
];

const EMP_FIELDS: WizardField[] = [
  { key: 'email', label: 'Employee Email', required: true },
  { key: 'name', label: 'Employee Name' },
];

/* ---------- tiny shared pieces ---------- */
const F = ({ label, children }: { label: string; children: ReactNode }) => (
  <div><label className={labelCls}>{label}</label>{children}</div>
);
const Info = ({ label, value }: { label: string; value?: string | null }) => (
  <div>
    <p className="font-body text-[10px] font-bold uppercase tracking-wider text-muted">{label}</p>
    <p className="mt-0.5 font-body text-[13px] font-semibold text-ink">{value || '—'}</p>
  </div>
);
const CardTitle = ({ icon, children, action }: { icon?: ReactNode; children: ReactNode; action?: ReactNode }) => (
  <div className="mb-3 flex items-center justify-between">
    <p className="flex items-center gap-2 font-display text-[14.5px] font-semibold text-ink">{icon}{children}</p>
    {action}
  </div>
);

function NavList<T extends { id: number }>({ items, selected, onSelect, label, meta }: {
  items: T[]; selected: number | null; onSelect: (id: number) => void;
  label: (t: T) => string; meta?: (t: T) => string;
}) {
  return (
    <div className="space-y-1">
      {items.map((it) => (
        <button key={it.id} onClick={() => onSelect(it.id)}
          className={`flex w-full items-center justify-between gap-2 rounded-xl px-3.5 py-2.5 text-left transition ${selected === it.id ? 'tk-inset text-primary' : 'text-ink/75 hover:text-ink'}`}>
          <span className="min-w-0">
            <span className="block truncate font-body text-[13px] font-bold">{label(it)}</span>
            {meta && <span className="block truncate font-body text-[10.5px] text-muted">{meta(it)}</span>}
          </span>
          <ChevronRight size={13} className="shrink-0 text-muted" />
        </button>
      ))}
    </div>
  );
}

function EmployeesTable({ people, deptHeads, exportName }: { people: OrgPerson[]; deptHeads: Map<string, string>; exportName: string }) {
  const cols: Column<OrgPerson>[] = [
    { key: 'empno', label: 'Employee Number', accessor: (r) => r.id, render: (r) => <span className="tabular-nums text-muted">AV-{1000 + r.id}</span> },
    { key: 'full_name', label: 'Employee Name', render: (r) => <span className="font-bold text-ink">{r.full_name}</span> },
    { key: 'role', label: 'Job Title' },
    { key: 'reporting', label: 'Reporting To', accessor: (r) => deptHeads.get(r.dept) || '', render: (r) => <span className="text-muted">{deptHeads.get(r.dept) || '—'}</span> },
  ];
  return (
    <DataTable<OrgPerson> data={people} columns={cols} rowKey={(r) => r.id} views={['list', 'gallery']}
      pageSize={8} exportName={exportName} searchKeys={['full_name', 'role', 'email']}
      card={{ title: (r) => r.full_name, subtitle: (r) => r.role }} />
  );
}

const SubTabs = ({ tabs, active, onChange }: { tabs: string[]; active: string; onChange: (t: string) => void }) => (
  <div className="tk-inset mb-4 flex w-fit gap-0.5 p-1">
    {tabs.map((t) => (
      <button key={t} onClick={() => onChange(t)}
        className={`rounded-lg px-3.5 py-1.5 font-body text-[11.5px] font-bold transition ${active === t ? 'tk-raise-sm text-primary' : 'text-muted hover:text-ink'}`}>
        {t}
      </button>
    ))}
  </div>
);

/* ============================================================ */

export default function OrgStructure() {
  const { section } = useParams();
  const navigate = useNavigate();
  const active = SECTIONS.some((s) => s.key === section) ? (section as string) : 'legal-entities';

  const [data, setData] = useState<Bootstrap | null>(null);
  const [err, setErr] = useState('');
  const [toast, setToast] = useState('');
  const { people, reload: reloadPeople } = useOrgPeople();

  const load = useCallback(() => {
    api<Bootstrap>('orgstructure').then(setData).catch((e) => setErr(e.message));
  }, []);
  useEffect(load, [load]);

  const notify = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2600); };
  const crud = async (resource: string, action: string, payload: Record<string, unknown>, id?: number) => {
    await api('orgstructure', { method: 'POST', body: JSON.stringify({ resource, action, data: payload, id }) });
    load();
  };
  const bulkAssign = async (field: string, value: string, rows: Record<string, string>[]): Promise<string> => {
    const res = await api<{ assigned: number; missed: number }>('orgstructure', {
      method: 'POST', body: JSON.stringify({ resource: 'bulk_assign', field, value, emails: rows.map((r) => r.email) }),
    });
    reloadPeople();
    return `${res.assigned} employees assigned to ${value}${res.missed ? ` · ${res.missed} emails not found` : ''}`;
  };

  const deptHeads = useMemo(() => new Map((data?.departments || []).map((d) => [d.name, d.head])), [data]);
  const activePeople = useMemo(() => people.filter((p) => p.status !== 'Exited'), [people]);

  if (!data) return <div className="tk-card"><NeuLoader label="Loading org structure…" /></div>;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      {toast && (
        <div className="fixed left-1/2 top-20 z-[80] -translate-x-1/2 rounded-full bg-ink px-5 py-2.5 font-body text-[13px] font-bold text-paper shadow-xl">{toast}</div>
      )}
      {err && <div className="tk-card mb-4 px-4 py-2.5 font-body text-[13px] text-rose-500">{err} <button onClick={() => { setErr(''); load(); }} className="font-bold underline">retry</button></div>}

      {/* section switcher */}
      <div className="tk-card sticky top-16 z-20 mb-5 px-2">
        <div className="flex gap-0.5 overflow-x-auto">
          {SECTIONS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => navigate(`/organization/structure/${key}`)}
              className={`relative flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3.5 py-3 font-body text-[12px] font-bold transition ${active === key ? 'text-primary' : 'text-muted hover:text-ink'}`}>
              <Icon size={13} /> {label}
              {active === key && (
                <motion.span layoutId="struct-tab" className="absolute inset-x-2.5 bottom-0 h-[2.5px] rounded-t-full bg-primary"
                  transition={{ type: 'spring', damping: 30, stiffness: 400 }} />
              )}
            </button>
          ))}
        </div>
      </div>

      {active === 'legal-entities' && <LegalEntities data={data.legal_entities} crud={crud} notify={notify} />}
      {active === 'business-units' && (
        <GroupSection<BusinessUnit>
          resource="business_units" title="Business Unit" items={data.business_units}
          people={activePeople} peopleField="business_unit" matchBy={(bu) => bu.name}
          deptHeads={deptHeads} crud={crud} notify={notify} bulkAssign={bulkAssign}
          summary={(bu, count) => (
            <div className="grid gap-4 sm:grid-cols-2">
              <Info label="Unit Name" value={bu.name} />
              <Info label="Unit Head" value={bu.head} />
              <Info label="Parent Unit" value={bu.parent || '—'} />
              <Info label="Total Employees" value={String(count)} />
              <div className="sm:col-span-2"><Info label="Description" value={bu.description} /></div>
            </div>
          )}
          formFields={(f, set) => (
            <>
              <F label="Unit Name *"><input value={String(f.name || '')} onChange={(e) => set('name', e.target.value)} className={inputCls} /></F>
              <F label="Unit Head"><input value={String(f.head || '')} onChange={(e) => set('head', e.target.value)} className={inputCls} /></F>
              <F label="Parent Unit">
                <Select options={data.business_units.map((b) => ({ value: b.name, label: b.name }))}
                  value={(f.parent as string) || null} onChange={(v) => set('parent', v || '')} placeholder="— None —" searchable={false} />
              </F>
              <F label="Description"><textarea rows={3} value={String(f.description || '')} onChange={(e) => set('description', e.target.value)} className={inputCls} /></F>
            </>
          )}
        />
      )}
      {active === 'locations' && <Locations data={data.locations} people={activePeople} deptHeads={deptHeads} crud={crud} notify={notify} bulkAssign={bulkAssign} />}
      {active === 'departments' && <Departments data={data.departments} people={activePeople} deptHeads={deptHeads} crud={crud} notify={notify} bulkAssign={bulkAssign} />}
      {active === 'cost-centers' && (
        <GroupSection<CostCenter>
          resource="cost_centers" title="Cost Center" items={data.cost_centers}
          people={activePeople} peopleField="cost_center" matchBy={(cc) => cc.code}
          deptHeads={deptHeads} crud={crud} notify={notify} bulkAssign={bulkAssign} navMeta={(cc) => cc.code}
          summary={(cc, count) => (
            <div className="grid gap-4 sm:grid-cols-2">
              <Info label="Cost Center Name" value={cc.name} />
              <Info label="Code" value={cc.code} />
              <Info label="Cost Center Head" value={cc.head} />
              <Info label="Total Employees" value={String(count)} />
              <div className="sm:col-span-2"><Info label="Description" value={cc.description} /></div>
            </div>
          )}
          formFields={(f, set) => (
            <>
              <F label="Name *"><input value={String(f.name || '')} onChange={(e) => set('name', e.target.value)} className={inputCls} /></F>
              <F label="Code *"><input value={String(f.code || '')} onChange={(e) => set('code', e.target.value)} className={inputCls} placeholder="CC-600" /></F>
              <F label="Cost Center Head"><input value={String(f.head || '')} onChange={(e) => set('head', e.target.value)} className={inputCls} /></F>
              <F label="Description"><textarea rows={3} value={String(f.description || '')} onChange={(e) => set('description', e.target.value)} className={inputCls} /></F>
            </>
          )}
        />
      )}
      {active === 'pay-grades' && <SimpleTable resource="pay_grades" title="Pay Grade" rows={data.pay_grades} crud={crud} notify={notify} />}
      {active === 'bands' && <SimpleTable resource="bands" title="Band" rows={data.bands} crud={crud} notify={notify} />}
    </motion.div>
  );
}

/* ============================================================
   1 · LEGAL ENTITIES
   ============================================================ */
function LegalEntities({ data, crud, notify }: {
  data: LegalEntity[];
  crud: (r: string, a: string, d: Record<string, unknown>, id?: number) => Promise<void>;
  notify: (m: string) => void;
}) {
  const [selId, setSelId] = useState<number | null>(data[0]?.id ?? null);
  const [tab, setTab] = useState('Overview');
  const [addOpen, setAddOpen] = useState(false);
  const [sigOpen, setSigOpen] = useState(false);
  const [bankOpen, setBankOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [sig, setSig] = useState<Record<string, string>>({});
  const [bank, setBank] = useState<Record<string, string>>({ verification: 'Manual Verification', account_type: 'Current' });
  const [ferr, setFerr] = useState('');

  useEffect(() => { if (selId === null && data[0]) setSelId(data[0].id); }, [data, selId]);
  const ent = data.find((e) => e.id === selId) || null;
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const DEFAULT_TASKS: PayrollTask[] = [
    { task: 'Configure statutory components', done: false },
    { task: 'Map salary structures to pay grades', done: false },
    { task: 'Verify bank account for salary disbursal', done: false },
    { task: 'Set payroll calendar & cut-off dates', done: false },
    { task: 'Assign payroll admin & approver', done: false },
  ];

  const addEntity = async () => {
    setFerr('');
    if (!form.name?.trim() || !form.legal_name?.trim()) { setFerr('Entity Name and Legal Name are required.'); return; }
    await crud('legal_entities', 'create', { ...form, signatories: [], bank_accounts: [], payroll_tasks: DEFAULT_TASKS });
    setAddOpen(false); setForm({}); notify(`Legal entity "${form.name}" created`);
  };

  const addSignatory = async () => {
    if (!ent) return;
    setFerr('');
    if (!sig.first_name?.trim() || !sig.email?.trim()) { setFerr('First name and email are required.'); return; }
    await crud('legal_entities', 'update', { signatories: [...ent.signatories, sig as unknown as Signatory] }, ent.id);
    setSigOpen(false); setSig({}); notify('Signatory added');
  };

  const addBank = async () => {
    if (!ent) return;
    setFerr('');
    if (!bank.bank_name?.trim() || !bank.account_number?.trim()) { setFerr('Bank name and account number are required.'); return; }
    if (bank.verification === 'Manual Verification' && bank.account_number !== bank.confirm) { setFerr('Account numbers do not match.'); return; }
    const masked = '••••••' + bank.account_number.slice(-4);
    await crud('legal_entities', 'update', {
      bank_accounts: [...ent.bank_accounts, { verification: bank.verification, account_type: bank.account_type, bank_name: bank.bank_name, routing_number: bank.routing_number || '', account_number: masked }],
    }, ent.id);
    setBankOpen(false); setBank({ verification: 'Manual Verification', account_type: 'Current' }); notify('Bank account added');
  };

  const toggleTask = async (i: number) => {
    if (!ent) return;
    const tasks = ent.payroll_tasks.map((t, j) => (j === i ? { ...t, done: !t.done } : t));
    await crud('legal_entities', 'update', { payroll_tasks: tasks }, ent.id);
  };
  const completeNext = async () => {
    if (!ent) return;
    const i = ent.payroll_tasks.findIndex((t) => !t.done);
    if (i >= 0) { await toggleTask(i); notify(`"${ent.payroll_tasks[i].task}" completed`); }
  };

  const doneCount = ent?.payroll_tasks.filter((t) => t.done).length || 0;

  return (
    <div className="grid gap-5 lg:grid-cols-[230px_1fr]">
      {/* nav pane */}
      <div className="tk-card h-fit p-3">
        <div className="mb-2 flex items-center justify-between px-1.5">
          <p className="font-body text-[10.5px] font-bold uppercase tracking-wider text-muted">Entities</p>
          <button onClick={() => { setFerr(''); setAddOpen(true); }} className="tk-btn-primary rounded-lg p-1.5" data-tip="Add Legal Entity"><Plus size={13} /></button>
        </div>
        <NavList items={data} selected={selId} onSelect={setSelId} label={(e) => e.name} meta={(e) => e.country} />
      </div>

      {ent && (
        <div>
          <SubTabs tabs={['Overview', 'Payroll Configuration']} active={tab} onChange={setTab} />

          {tab === 'Overview' ? (
            <div className="space-y-4">
              <div className="tk-card p-5">
                <CardTitle icon={<Scale size={14} className="text-primary" />}>Entity Details</CardTitle>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Info label="Entity Name" value={ent.name} />
                  <Info label="Legal Name" value={ent.legal_name} />
                  <Info label="CIN" value={ent.cin} />
                  <Info label="Date of Incorporation" value={ent.incorporation_date} />
                  <Info label="Type of Business" value={ent.business_type} />
                  <Info label="Sector" value={ent.sector} />
                  <div className="sm:col-span-2 lg:col-span-3"><Info label="Nature of Business" value={ent.nature} /></div>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="tk-card p-5">
                  <CardTitle icon={<Phone size={14} className="text-primary" />}>Contact Details</CardTitle>
                  <div className="space-y-2.5 font-body text-[13px] text-ink/80">
                    <p className="flex items-center gap-2"><Phone size={12} className="text-muted" /> {ent.phone || '—'}</p>
                    <p className="flex items-center gap-2"><Mail size={12} className="text-muted" /> {ent.email || '—'}</p>
                    <p className="flex items-center gap-2"><Globe size={12} className="text-muted" /> {ent.website || '—'}</p>
                  </div>
                </div>
                <div className="tk-card p-5">
                  <CardTitle icon={<MapPin size={14} className="text-primary" />}>Registered Address</CardTitle>
                  <p className="font-body text-[13px] leading-relaxed text-ink/80">
                    {[ent.address1, ent.address2, ent.city, ent.state, ent.zip, ent.country].filter(Boolean).join(', ')}
                  </p>
                </div>
              </div>

              <div className="tk-card p-5">
                <CardTitle icon={<PenLine size={14} className="text-primary" />}
                  action={<button onClick={() => { setFerr(''); setSigOpen(true); }} className={btnGhost + ' !py-1.5 text-[12px]'}><Plus size={13} /> Add New Signatory</button>}>
                  Authorized Signatories
                </CardTitle>
                {ent.signatories.length === 0 ? <p className="font-body text-[12.5px] text-muted">No signatories added yet.</p> : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {ent.signatories.map((s, i) => (
                      <div key={i} className="tk-inset rounded-xl px-4 py-3">
                        <p className="font-body text-[13px] font-bold text-ink">{[s.first_name, s.middle_name, s.last_name].filter(Boolean).join(' ')}</p>
                        <p className="font-body text-[11.5px] text-muted">{s.designation} · {s.email}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="tk-card p-5">
                <CardTitle icon={<Landmark size={14} className="text-primary" />}
                  action={<button onClick={() => { setFerr(''); setBankOpen(true); }} className={btnGhost + ' !py-1.5 text-[12px]'}><Plus size={13} /> Add Bank Account</button>}>
                  Bank Accounts
                </CardTitle>
                {ent.bank_accounts.length === 0 ? <p className="font-body text-[12.5px] text-muted">No bank accounts linked yet.</p> : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {ent.bank_accounts.map((b, i) => (
                      <div key={i} className="tk-inset flex items-center gap-3 rounded-xl px-4 py-3">
                        <Banknote size={16} className="shrink-0 text-primary" />
                        <div className="min-w-0">
                          <p className="font-body text-[13px] font-bold text-ink">{b.bank_name} · {b.account_type}</p>
                          <p className="font-body text-[11.5px] tabular-nums text-muted">{b.account_number} · {b.routing_number}</p>
                        </div>
                        <Badge tone={b.verification.includes('Plaid') ? 'green' : 'amber'}>{b.verification.includes('Plaid') ? 'Plaid' : 'Manual'}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="tk-card p-5">
              <CardTitle icon={<ShieldCheck size={14} className="text-primary" />}
                action={<Badge tone={doneCount === ent.payroll_tasks.length ? 'green' : 'amber'}>{doneCount}/{ent.payroll_tasks.length} complete</Badge>}>
                Payroll setup · {ent.name}
              </CardTitle>
              <div className="tk-inset mb-4 h-3 overflow-hidden rounded-full">
                <div className="h-full rounded-full bg-(--t-accent) transition-all duration-500" style={{ width: `${(doneCount / Math.max(1, ent.payroll_tasks.length)) * 100}%` }} />
              </div>
              <div className="space-y-2">
                {ent.payroll_tasks.map((t, i) => (
                  <button key={i} onClick={() => toggleTask(i)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-primary/6">
                    {t.done ? <CheckCircle2 size={17} className="shrink-0 text-primary" /> : <Circle size={17} className="shrink-0 text-muted" />}
                    <span className={`font-body text-[13px] font-semibold ${t.done ? 'text-muted line-through' : 'text-ink'}`}>{t.task}</span>
                  </button>
                ))}
              </div>
              {doneCount < ent.payroll_tasks.length && (
                <button onClick={completeNext} className={btnPrimary + ' mt-4'}>Complete next setup task</button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Add Legal Entity drawer */}
      <Drawer open={addOpen} onClose={() => setAddOpen(false)} title="Add Legal Entity" width={480}>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <F label="Country *"><Select options={['India', 'United Kingdom', 'United States', 'Singapore', 'UAE'].map((c) => ({ value: c, label: c }))} value={form.country || null} onChange={(v) => set('country', v || '')} placeholder="Select…" searchable={false} /></F>
          <F label="Entity Name *"><input value={form.name || ''} onChange={(e) => set('name', e.target.value)} className={inputCls} /></F>
          <div className="sm:col-span-2"><F label="Legal Name of Company *"><input value={form.legal_name || ''} onChange={(e) => set('legal_name', e.target.value)} className={inputCls} /></F></div>
          <F label="Company Identification Number"><input value={form.cin || ''} onChange={(e) => set('cin', e.target.value)} className={inputCls} /></F>
          <F label="Date of Incorporation"><DatePicker value={form.incorporation_date || ''} onChange={(v) => set('incorporation_date', v)} /></F>
          <F label="Type of Business"><Select options={['Private Limited', 'Public Limited', 'LLP', 'Partnership', 'Sole Proprietorship'].map((c) => ({ value: c, label: c }))} value={form.business_type || null} onChange={(v) => set('business_type', v || '')} placeholder="Select…" searchable={false} /></F>
          <F label="Sector"><input value={form.sector || ''} onChange={(e) => set('sector', e.target.value)} className={inputCls} /></F>
          <div className="sm:col-span-2"><F label="Nature of Business"><input value={form.nature || ''} onChange={(e) => set('nature', e.target.value)} className={inputCls} /></F></div>
          <F label="Address Line 1"><input value={form.address1 || ''} onChange={(e) => set('address1', e.target.value)} className={inputCls} /></F>
          <F label="Address Line 2"><input value={form.address2 || ''} onChange={(e) => set('address2', e.target.value)} className={inputCls} /></F>
          <F label="City"><input value={form.city || ''} onChange={(e) => set('city', e.target.value)} className={inputCls} /></F>
          <F label="State"><input value={form.state || ''} onChange={(e) => set('state', e.target.value)} className={inputCls} /></F>
          <F label="Zip Code"><input value={form.zip || ''} onChange={(e) => set('zip', e.target.value)} className={inputCls} /></F>
          <F label="Phone"><input value={form.phone || ''} onChange={(e) => set('phone', e.target.value)} className={inputCls} /></F>
          <div className="sm:col-span-2"><F label="Website"><input value={form.website || ''} onChange={(e) => set('website', e.target.value)} className={inputCls} placeholder="https://" /></F></div>
        </div>
        {ferr && <p className="mt-3 rounded-xl bg-rose-500/10 px-3.5 py-2.5 font-body text-[12.5px] text-rose-500">{ferr}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => setAddOpen(false)} className={btnGhost}>Cancel</button>
          <button onClick={addEntity} className={btnPrimary}><Plus size={14} /> Create Entity</button>
        </div>
      </Drawer>

      {/* Add Signatory drawer */}
      <Drawer open={sigOpen} onClose={() => setSigOpen(false)} title="Add New Signatory" width={400}>
        <div className="space-y-3.5">
          <F label="First Name *"><input value={sig.first_name || ''} onChange={(e) => setSig((s) => ({ ...s, first_name: e.target.value }))} className={inputCls} /></F>
          <F label="Middle Name"><input value={sig.middle_name || ''} onChange={(e) => setSig((s) => ({ ...s, middle_name: e.target.value }))} className={inputCls} /></F>
          <F label="Last Name"><input value={sig.last_name || ''} onChange={(e) => setSig((s) => ({ ...s, last_name: e.target.value }))} className={inputCls} /></F>
          <F label="Designation"><input value={sig.designation || ''} onChange={(e) => setSig((s) => ({ ...s, designation: e.target.value }))} className={inputCls} /></F>
          <F label="Email *"><input type="email" value={sig.email || ''} onChange={(e) => setSig((s) => ({ ...s, email: e.target.value }))} className={inputCls} /></F>
          {ferr && <p className="rounded-xl bg-rose-500/10 px-3.5 py-2.5 font-body text-[12.5px] text-rose-500">{ferr}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={() => setSigOpen(false)} className={btnGhost}>Cancel</button>
            <button onClick={addSignatory} className={btnPrimary}><Plus size={14} /> Add Signatory</button>
          </div>
        </div>
      </Drawer>

      {/* Add Bank Account modal */}
      <Modal open={bankOpen} onClose={() => setBankOpen(false)} title="Add Bank Account">
        <div className="space-y-3.5">
          <F label="Verification Type">
            <div className="grid gap-2 sm:grid-cols-2">
              {['Connect and verify bank via Plaid', 'Manual Verification'].map((v) => (
                <button key={v} onClick={() => setBank((b) => ({ ...b, verification: v }))}
                  className={`tk-card p-3 text-left font-body text-[12px] font-bold transition ${bank.verification === v ? 'ring-2 ring-(--t-accent) text-primary' : 'text-ink/75'}`}>
                  {v}
                </button>
              ))}
            </div>
          </F>
          {bank.verification.includes('Plaid') ? (
            <div className="tk-inset rounded-xl px-4 py-6 text-center">
              <ShieldCheck size={22} className="mx-auto mb-2 text-primary" />
              <p className="font-body text-[13px] font-bold text-ink">Plaid connection</p>
              <p className="mt-1 font-body text-[11.5px] text-muted">Bank linking via Plaid will be enabled once credentials are configured. Use Manual Verification for now.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <F label="Account Type">
                  <Select options={['Current', 'Savings', 'Escrow'].map((c) => ({ value: c, label: c }))} value={bank.account_type || null} onChange={(v) => setBank((b) => ({ ...b, account_type: v || 'Current' }))} searchable={false} />
                </F>
                <F label="Bank Name *"><input value={bank.bank_name || ''} onChange={(e) => setBank((b) => ({ ...b, bank_name: e.target.value }))} className={inputCls} /></F>
              </div>
              <F label="Routing Number / IFSC"><input value={bank.routing_number || ''} onChange={(e) => setBank((b) => ({ ...b, routing_number: e.target.value }))} className={inputCls} /></F>
              <div className="grid grid-cols-2 gap-3">
                <F label="Account Number *"><input value={bank.account_number || ''} onChange={(e) => setBank((b) => ({ ...b, account_number: e.target.value }))} className={inputCls} /></F>
                <F label="Confirm Account Number *"><input value={bank.confirm || ''} onChange={(e) => setBank((b) => ({ ...b, confirm: e.target.value }))} className={inputCls} /></F>
              </div>
            </>
          )}
          {ferr && <p className="rounded-xl bg-rose-500/10 px-3.5 py-2.5 font-body text-[12.5px] text-rose-500">{ferr}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={() => setBankOpen(false)} className={btnGhost}>Cancel</button>
            <button onClick={addBank} disabled={bank.verification.includes('Plaid')} className={btnPrimary + ' disabled:opacity-50'}><Plus size={14} /> Add Account</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ============================================================
   Generic nav+summary+employees section (Business Units, Cost Centers)
   ============================================================ */
function GroupSection<T extends { id: number; name: string }>({ resource, title, items, people, peopleField, matchBy, deptHeads, crud, notify, bulkAssign, summary, formFields, navMeta }: {
  resource: string; title: string; items: T[];
  people: OrgPerson[]; peopleField: string; matchBy: (t: T) => string;
  deptHeads: Map<string, string>;
  crud: (r: string, a: string, d: Record<string, unknown>, id?: number) => Promise<void>;
  notify: (m: string) => void;
  bulkAssign: (field: string, value: string, rows: Record<string, string>[]) => Promise<string>;
  summary: (t: T, count: number) => ReactNode;
  formFields: (f: Record<string, unknown>, set: (k: string, v: string) => void) => ReactNode;
  navMeta?: (t: T) => string;
}) {
  const [selId, setSelId] = useState<number | null>(items[0]?.id ?? null);
  const [tab, setTab] = useState('Summary');
  const [drawer, setDrawer] = useState<'add' | 'edit' | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [ferr, setFerr] = useState('');

  useEffect(() => { if (selId === null && items[0]) setSelId(items[0].id); }, [items, selId]);
  const sel = items.find((i) => i.id === selId) || null;
  const members = useMemo(() => sel ? people.filter((p) => (p as unknown as Record<string, string>)[peopleField] === matchBy(sel)) : [], [people, sel, peopleField, matchBy]);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setFerr('');
    if (!String(form.name || '').trim()) { setFerr('Name is required.'); return; }
    if (drawer === 'add') { await crud(resource, 'create', form); notify(`${title} created`); }
    else if (sel) { await crud(resource, 'update', form, sel.id); notify(`${title} updated`); }
    setDrawer(null); setForm({});
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[230px_1fr]">
      <div className="tk-card h-fit p-3">
        <div className="mb-2 flex items-center justify-between px-1.5">
          <p className="font-body text-[10.5px] font-bold uppercase tracking-wider text-muted">{title}s</p>
          <button onClick={() => { setForm({}); setFerr(''); setDrawer('add'); }} className="tk-btn-primary rounded-lg p-1.5" data-tip={`Add ${title}`}><Plus size={13} /></button>
        </div>
        <NavList items={items} selected={selId} onSelect={setSelId} label={(i) => i.name} meta={navMeta} />
      </div>

      {sel && (
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <SubTabs tabs={['Summary', 'Employees']} active={tab} onChange={setTab} />
            <div className="flex gap-2">
              <button onClick={() => { setForm({ ...sel }); setFerr(''); setDrawer('edit'); }} className={btnGhost + ' !py-2 text-[12px]'}><Pencil size={13} /> Edit</button>
              <button onClick={() => setWizardOpen(true)} className={btnPrimary + ' !py-2 text-[12px]'}><Upload size={13} /> Bulk Assign Employees</button>
            </div>
          </div>

          {tab === 'Summary' ? (
            <div className="tk-card p-5">{summary(sel, members.length)}</div>
          ) : (
            <EmployeesTable people={members} deptHeads={deptHeads} exportName={`${resource}-${sel.name.toLowerCase().replace(/\s+/g, '-')}-employees`} />
          )}
        </div>
      )}

      <Drawer open={drawer !== null} onClose={() => setDrawer(null)} title={drawer === 'add' ? `Add ${title}` : `Edit ${title}`} width={420}>
        <div className="space-y-3.5">
          {formFields(form, set)}
          {ferr && <p className="rounded-xl bg-rose-500/10 px-3.5 py-2.5 font-body text-[12.5px] text-rose-500">{ferr}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={() => setDrawer(null)} className={btnGhost}>Cancel</button>
            <button onClick={save} className={btnPrimary}>{drawer === 'add' ? <Plus size={14} /> : <Pencil size={14} />} Save</button>
          </div>
        </div>
      </Drawer>

      {sel && (
        <ImportWizard open={wizardOpen} onClose={() => setWizardOpen(false)}
          title={`Bulk Assign Employees → ${sel.name}`}
          fields={EMP_FIELDS}
          templateRows={[['ananya@aviary.io', 'Ananya Rao'], ['vikram@aviary.io', 'Vikram Mehta']]}
          onImport={(rows) => bulkAssign(peopleField, matchBy(sel), rows)} />
      )}
    </div>
  );
}

/* ============================================================
   3 · LOCATIONS (map preview + import locations wizard)
   ============================================================ */
function Locations({ data, people, deptHeads, crud, notify, bulkAssign }: {
  data: OrgLocation[]; people: OrgPerson[]; deptHeads: Map<string, string>;
  crud: (r: string, a: string, d: Record<string, unknown>, id?: number) => Promise<void>;
  notify: (m: string) => void;
  bulkAssign: (field: string, value: string, rows: Record<string, string>[]) => Promise<string>;
}) {
  const [selId, setSelId] = useState<number | null>(data[0]?.id ?? null);
  const [tab, setTab] = useState('Summary');
  const [drawer, setDrawer] = useState<'add' | 'edit' | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [ferr, setFerr] = useState('');

  useEffect(() => { if (selId === null && data[0]) setSelId(data[0].id); }, [data, selId]);
  const sel = data.find((l) => l.id === selId) || null;
  const members = useMemo(() => sel ? people.filter((p) => p.location === sel.name) : [], [people, sel]);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setFerr('');
    if (!form.name?.trim()) { setFerr('Location name is required.'); return; }
    if (drawer === 'add') { await crud('locations', 'create', form); notify('Location added'); }
    else if (sel) { await crud('locations', 'update', form, sel.id); notify('Location updated'); }
    setDrawer(null); setForm({});
  };

  const LOC_FIELDS: WizardField[] = [
    { key: 'name', label: 'Name', required: true },
    { key: 'timezone', label: 'Timezone' },
    { key: 'country', label: 'Country' },
    { key: 'state', label: 'State' },
    { key: 'city', label: 'City' },
    { key: 'address1', label: 'Address Line 1' },
    { key: 'zip', label: 'Zip Code' },
  ];

  const mapQuery = sel ? encodeURIComponent([sel.address1, sel.city, sel.state, sel.country].filter((x) => x && x !== '—').join(', ') || sel.name) : '';

  return (
    <div className="grid gap-5 lg:grid-cols-[230px_1fr]">
      <div className="tk-card h-fit p-3">
        <div className="mb-2 flex items-center justify-between px-1.5">
          <p className="font-body text-[10.5px] font-bold uppercase tracking-wider text-muted">Locations</p>
          <button onClick={() => { setForm({}); setFerr(''); setDrawer('add'); }} className="tk-btn-primary rounded-lg p-1.5" data-tip="Add Location"><Plus size={13} /></button>
        </div>
        <NavList items={data} selected={selId} onSelect={setSelId} label={(l) => l.name} meta={(l) => l.city} />
        <button onClick={() => setImportOpen(true)} className={btnGhost + ' mt-3 w-full !py-2 text-[12px]'}><Upload size={13} /> Import Locations</button>
      </div>

      {sel && (
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <SubTabs tabs={['Summary', 'Employees']} active={tab} onChange={setTab} />
            <div className="flex gap-2">
              <button onClick={() => { setForm({ ...sel } as unknown as Record<string, string>); setFerr(''); setDrawer('edit'); }} className={btnGhost + ' !py-2 text-[12px]'}><Pencil size={13} /> Edit Location</button>
              <button onClick={() => setAssignOpen(true)} className={btnPrimary + ' !py-2 text-[12px]'}><Upload size={13} /> Bulk Assign Employees</button>
            </div>
          </div>

          {tab === 'Summary' ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="tk-card p-5">
                <CardTitle icon={<MapPin size={14} className="text-primary" />}>Location Details</CardTitle>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Info label="Name" value={sel.name} />
                  <Info label="Timezone" value={sel.timezone} />
                  <Info label="Group Email" value={sel.group_email} />
                  <Info label="Total Employees" value={String(members.length)} />
                  <div className="sm:col-span-2">
                    <Info label="Address" value={[sel.address1, sel.address2, sel.city, sel.state, sel.zip, sel.country].filter(Boolean).join(', ')} />
                  </div>
                  <div className="sm:col-span-2"><Info label="Description" value={sel.description} /></div>
                </div>
              </div>
              <div className="tk-card overflow-hidden p-2">
                <iframe title="map" width="100%" height="280" style={{ border: 0, borderRadius: 'var(--t-radius)' }}
                  loading="lazy" src={`https://maps.google.com/maps?q=${mapQuery}&z=13&output=embed`} />
              </div>
            </div>
          ) : (
            <EmployeesTable people={members} deptHeads={deptHeads} exportName={`location-${sel.name.toLowerCase()}-employees`} />
          )}
        </div>
      )}

      {/* Add / Edit Location drawer */}
      <Drawer open={drawer !== null} onClose={() => setDrawer(null)} title={drawer === 'add' ? 'Add Location' : 'Edit Location'} width={440}>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <F label="Name *"><input value={form.name || ''} onChange={(e) => set('name', e.target.value)} className={inputCls} /></F>
          <F label="Group Email"><input value={form.group_email || ''} onChange={(e) => set('group_email', e.target.value)} className={inputCls} /></F>
          <F label="Timezone">
            <Select options={['Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Europe/London', 'America/New_York', 'America/Los_Angeles'].map((t) => ({ value: t, label: t }))}
              value={form.timezone || null} onChange={(v) => set('timezone', v || '')} placeholder="Select…" searchable />
          </F>
          <F label="Search Location"><input value={form.search || ''} onChange={(e) => set('search', e.target.value)} className={inputCls} placeholder="Search address…" /></F>
          <F label="Country"><input value={form.country || ''} onChange={(e) => set('country', e.target.value)} className={inputCls} /></F>
          <F label="State"><input value={form.state || ''} onChange={(e) => set('state', e.target.value)} className={inputCls} /></F>
          <F label="Address Line 1"><input value={form.address1 || ''} onChange={(e) => set('address1', e.target.value)} className={inputCls} /></F>
          <F label="Address Line 2"><input value={form.address2 || ''} onChange={(e) => set('address2', e.target.value)} className={inputCls} /></F>
          <F label="City"><input value={form.city || ''} onChange={(e) => set('city', e.target.value)} className={inputCls} /></F>
          <F label="Zip Code"><input value={form.zip || ''} onChange={(e) => set('zip', e.target.value)} className={inputCls} /></F>
          <div className="sm:col-span-2"><F label="Description"><textarea rows={3} value={form.description || ''} onChange={(e) => set('description', e.target.value)} className={inputCls} /></F></div>
        </div>
        {ferr && <p className="mt-3 rounded-xl bg-rose-500/10 px-3.5 py-2.5 font-body text-[12.5px] text-rose-500">{ferr}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => setDrawer(null)} className={btnGhost}>Cancel</button>
          <button onClick={save} className={btnPrimary}>Save Location</button>
        </div>
      </Drawer>

      {/* Import Locations wizard */}
      <ImportWizard open={importOpen} onClose={() => setImportOpen(false)}
        title="Import Locations" fields={LOC_FIELDS}
        templateRows={[['Chennai', 'Asia/Kolkata', 'India', 'Tamil Nadu', 'Chennai', 'Tidel Park, Taramani', '600113']]}
        onImport={async (rows) => {
          await api('orgstructure', { method: 'POST', body: JSON.stringify({ resource: 'locations', action: 'bulk_create', data: rows }) });
          notify(`${rows.length} locations imported`);
          window.dispatchEvent(new Event('focus'));
          return `${rows.length} locations imported successfully`;
        }} />

      {/* Bulk assign wizard */}
      {sel && (
        <ImportWizard open={assignOpen} onClose={() => setAssignOpen(false)}
          title={`Bulk Assign Employees → ${sel.name}`} fields={EMP_FIELDS}
          templateRows={[['ananya@aviary.io', 'Ananya Rao']]}
          onImport={(rows) => bulkAssign('location', sel.name, rows)} />
      )}
    </div>
  );
}

/* ============================================================
   4 · DEPARTMENTS (tree nav + wall settings)
   ============================================================ */
function Departments({ data, people, deptHeads, crud, notify, bulkAssign }: {
  data: Department[]; people: OrgPerson[]; deptHeads: Map<string, string>;
  crud: (r: string, a: string, d: Record<string, unknown>, id?: number) => Promise<void>;
  notify: (m: string) => void;
  bulkAssign: (field: string, value: string, rows: Record<string, string>[]) => Promise<string>;
}) {
  const [selId, setSelId] = useState<number | null>(data[0]?.id ?? null);
  const [tab, setTab] = useState('Summary');
  const [drawer, setDrawer] = useState<'add' | 'edit' | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set(data.filter((d) => !d.parent_id).map((d) => d.id)));
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [ferr, setFerr] = useState('');

  useEffect(() => { if (selId === null && data[0]) setSelId(data[0].id); }, [data, selId]);
  const sel = data.find((d) => d.id === selId) || null;
  const members = useMemo(() => sel ? people.filter((p) => p.dept === sel.name) : [], [people, sel]);
  const roots = data.filter((d) => !d.parent_id);
  const childrenOf = (id: number) => data.filter((d) => d.parent_id === id);
  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setFerr('');
    if (!String(form.name || '').trim()) { setFerr('Name is required.'); return; }
    const payload = { name: form.name, display_name: form.display_name || form.name, parent_id: form.parent_id || null, head: form.head || '', description: form.description || '' };
    if (drawer === 'add') { await crud('departments', 'create', payload); notify('Department created'); }
    else if (sel) { await crud('departments', 'update', payload, sel.id); notify('Department updated'); }
    setDrawer(null); setForm({});
  };

  const toggleWall = async (key: 'wall_posts' | 'wall_announcements' | 'wall_polls') => {
    if (!sel) return;
    await crud('departments', 'update', { [key]: !sel[key] }, sel.id);
  };

  const TreeNode = ({ d, depth }: { d: Department; depth: number }) => {
    const kids = childrenOf(d.id);
    const open = expanded.has(d.id);
    return (
      <div>
        <div className={`flex items-center gap-1 rounded-xl transition ${selId === d.id ? 'tk-inset' : ''}`} style={{ paddingLeft: depth * 14 }}>
          {kids.length > 0 ? (
            <button onClick={() => setExpanded((s) => { const n = new Set(s); n.has(d.id) ? n.delete(d.id) : n.add(d.id); return n; })}
              className="p-1 text-muted hover:text-ink">
              <ChevronDown size={12} className={`transition-transform ${open ? '' : '-rotate-90'}`} />
            </button>
          ) : <span className="w-[22px]" />}
          <button onClick={() => setSelId(d.id)}
            className={`flex-1 truncate py-2 pr-2 text-left font-body text-[12.5px] font-bold ${selId === d.id ? 'text-primary' : 'text-ink/75 hover:text-ink'}`}>
            {d.display_name || d.name}
          </button>
        </div>
        {open && kids.map((k) => <TreeNode key={k.id} d={k} depth={depth + 1} />)}
      </div>
    );
  };

  const Toggle = ({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) => (
    <button onClick={onClick} className="flex w-full items-center justify-between rounded-xl px-3.5 py-3 transition hover:bg-primary/6">
      <span className="font-body text-[13px] font-semibold text-ink">{label}</span>
      <span className={`relative h-5 w-9 rounded-full transition ${on ? 'bg-(--t-accent)' : 'tk-inset'}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
    </button>
  );

  return (
    <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
      <div className="tk-card h-fit p-3">
        <div className="mb-2 flex items-center justify-between px-1.5">
          <p className="font-body text-[10.5px] font-bold uppercase tracking-wider text-muted">Departments</p>
          <button onClick={() => { setForm({}); setFerr(''); setDrawer('add'); }} className="tk-btn-primary rounded-lg p-1.5" data-tip="Add Department"><Plus size={13} /></button>
        </div>
        {roots.map((d) => <TreeNode key={d.id} d={d} depth={0} />)}
      </div>

      {sel && (
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <SubTabs tabs={['Summary', 'Employees', 'Settings']} active={tab} onChange={setTab} />
            <div className="flex gap-2">
              <button onClick={() => { setForm({ ...sel }); setFerr(''); setDrawer('edit'); }} className={btnGhost + ' !py-2 text-[12px]'}><Pencil size={13} /> Edit Department</button>
              <button onClick={() => setAssignOpen(true)} className={btnPrimary + ' !py-2 text-[12px]'}><Upload size={13} /> Bulk Assign Employees</button>
            </div>
          </div>

          {tab === 'Summary' && (
            <div className="tk-card p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Info label="Department Name" value={sel.display_name || sel.name} />
                <Info label="Department Head" value={sel.head} />
                <Info label="Parent Department" value={data.find((d) => d.id === sel.parent_id)?.display_name || '—'} />
                <Info label="Employee Count" value={String(members.length)} />
                <div className="sm:col-span-2"><Info label="Description" value={sel.description} /></div>
              </div>
              {childrenOf(sel.id).length > 0 && (
                <div className="mt-4 border-t tk-divider pt-3">
                  <p className="mb-2 font-body text-[10px] font-bold uppercase tracking-wider text-muted">Sub-departments</p>
                  <div className="flex flex-wrap gap-2">
                    {childrenOf(sel.id).map((k) => (
                      <button key={k.id} onClick={() => setSelId(k.id)} className="tk-chip px-3 py-1.5 font-body text-[12px] font-bold text-primary">{k.display_name}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'Employees' && (
            <EmployeesTable people={members} deptHeads={deptHeads} exportName={`department-${sel.name.toLowerCase().replace(/\s+/g, '-')}-employees`} />
          )}

          {tab === 'Settings' && (
            <div className="tk-card p-4">
              <CardTitle>Wall Settings</CardTitle>
              <div className="divide-y tk-divider">
                <Toggle label="Employees can post in this department" on={sel.wall_posts} onClick={() => toggleWall('wall_posts')} />
                <Toggle label="Employees can post announcements in this department" on={sel.wall_announcements} onClick={() => toggleWall('wall_announcements')} />
                <Toggle label="Employees can post polls in this department" on={sel.wall_polls} onClick={() => toggleWall('wall_polls')} />
              </div>
            </div>
          )}
        </div>
      )}

      <Drawer open={drawer !== null} onClose={() => setDrawer(null)} title={drawer === 'add' ? 'Add Department' : 'Edit Department'} width={420}>
        <div className="space-y-3.5">
          <F label="Name *"><input value={String(form.name || '')} onChange={(e) => set('name', e.target.value)} className={inputCls} /></F>
          <F label="Display Name"><input value={String(form.display_name || '')} onChange={(e) => set('display_name', e.target.value)} className={inputCls} /></F>
          <F label="Parent Department">
            <Select options={data.filter((d) => d.id !== sel?.id).map((d) => ({ value: String(d.id), label: d.display_name || d.name }))}
              value={form.parent_id ? String(form.parent_id) : null}
              onChange={(v) => set('parent_id', v ? +v : null)} placeholder="— Top level —" searchable={false} />
          </F>
          <F label="Department Head"><input value={String(form.head || '')} onChange={(e) => set('head', e.target.value)} className={inputCls} /></F>
          <F label="Description"><textarea rows={3} value={String(form.description || '')} onChange={(e) => set('description', e.target.value)} className={inputCls} /></F>
          {ferr && <p className="rounded-xl bg-rose-500/10 px-3.5 py-2.5 font-body text-[12.5px] text-rose-500">{ferr}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={() => setDrawer(null)} className={btnGhost}>Cancel</button>
            <button onClick={save} className={btnPrimary}>Save Department</button>
          </div>
        </div>
      </Drawer>

      {sel && (
        <ImportWizard open={assignOpen} onClose={() => setAssignOpen(false)}
          title={`Bulk Assign Employees → ${sel.display_name || sel.name}`} fields={EMP_FIELDS}
          templateRows={[['ananya@aviary.io', 'Ananya Rao']]}
          onImport={(rows) => bulkAssign('dept', sel.name, rows)} />
      )}
    </div>
  );
}

/* ============================================================
   6/7 · PAY GRADES & BANDS (data table + modal CRUD)
   ============================================================ */
function SimpleTable({ resource, title, rows, crud, notify }: {
  resource: string; title: string; rows: SimpleRow[];
  crud: (r: string, a: string, d: Record<string, unknown>, id?: number) => Promise<void>;
  notify: (m: string) => void;
}) {
  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [editing, setEditing] = useState<SimpleRow | null>(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [ferr, setFerr] = useState('');

  const cols: Column<SimpleRow>[] = [
    { key: 'name', label: 'Name', render: (r) => <span className="font-bold text-ink">{r.name}</span> },
    { key: 'description', label: 'Description', render: (r) => <span className="text-muted">{r.description}</span>, tooltip: (r) => r.description },
  ];

  const save = async () => {
    setFerr('');
    if (!form.name.trim()) { setFerr('Name is required.'); return; }
    if (modal === 'add') { await crud(resource, 'create', form); notify(`${title} created`); }
    else if (editing) { await crud(resource, 'update', form, editing.id); notify(`${title} updated`); }
    setModal(null); setForm({ name: '', description: '' });
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="font-display text-[16px] font-semibold text-ink">{title}s</p>
        <button onClick={() => { setForm({ name: '', description: '' }); setFerr(''); setModal('add'); }} className={btnPrimary}><Plus size={14} /> Add {title}</button>
      </div>
      <DataTable<SimpleRow>
        data={rows} columns={cols} rowKey={(r) => r.id} views={['list']} pageSize={8}
        exportName={resource.replace('_', '-')} searchKeys={['name', 'description']}
        rowActions={[
          { label: `Edit ${title}`, icon: <Pencil size={14} />, onClick: (r) => { setEditing(r); setForm({ name: r.name, description: r.description }); setFerr(''); setModal('edit'); } },
          { label: 'Delete', icon: <Trash2 size={14} />, tone: 'danger', onClick: async (r) => { await crud(resource, 'delete', {}, r.id); notify(`${title} deleted`); } },
        ]} />
      <Modal open={modal !== null} onClose={() => setModal(null)} title={modal === 'add' ? `Add ${title}` : `Edit ${title}`}>
        <div className="space-y-3.5">
          <F label="Name *"><input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} /></F>
          <F label="Description"><textarea rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className={inputCls} /></F>
          {ferr && <p className="rounded-xl bg-rose-500/10 px-3.5 py-2.5 font-body text-[12.5px] text-rose-500">{ferr}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={() => setModal(null)} className={btnGhost}>Cancel</button>
            <button onClick={save} className={btnPrimary}>Save</button>
          </div>
        </div>
      </Modal>
      {/* keep icon imports referenced */}
      <span className="hidden"><Users size={1} /></span>
    </div>
  );
}
