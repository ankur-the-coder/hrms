import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Users, UserPlus, UserMinus, GraduationCap, Hourglass, Cake, PartyPopper,
  FileText, Upload, Link2, ClipboardList, BadgeCheck, KeyRound, Inbox,
} from 'lucide-react';
import { api, fmtDate } from '../../lib/api';
import { useOrgPeople, type OrgPerson } from './orgData';
import Chart from '../../shared/Charts';
import { Badge, NeuLoader } from '../../shared/primitives';

const Tile = ({ icon: Icon, label, value, tone }: { icon: typeof Users; label: string; value: number; tone: string }) => (
  <div className="tk-card flex items-center gap-3.5 p-4">
    <span className={`tk-inset flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}><Icon size={17} /></span>
    <div>
      <p className="font-display text-[22px] font-semibold leading-none text-ink">{value}</p>
      <p className="mt-1 font-body text-[10.5px] font-bold uppercase tracking-wider text-muted">{label}</p>
    </div>
  </div>
);

function PersonRow({ p, meta }: { p: OrgPerson; meta: string }) {
  return (
    <div className="flex items-center gap-2.5 py-2">
      <span className="tk-inset flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-body text-[11px] font-bold text-primary">
        {p.full_name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-body text-[12.5px] font-bold text-ink">{p.full_name}</p>
        <p className="truncate font-body text-[11px] text-muted">{p.role} · {p.dept}</p>
      </div>
      <span className="shrink-0 font-body text-[10.5px] font-semibold text-muted">{meta}</span>
    </div>
  );
}

function ListCard({ title, icon: Icon, items, empty }: { title: string; icon: typeof Users; items: { p: OrgPerson; meta: string }[]; empty: string }) {
  return (
    <div className="tk-card p-4">
      <p className="mb-1.5 flex items-center gap-2 font-display text-[14px] font-semibold text-ink">
        <Icon size={14} className="text-primary" /> {title} <Badge>{items.length}</Badge>
      </p>
      {items.length === 0 ? (
        <p className="py-3 font-body text-[12px] text-muted">{empty}</p>
      ) : (
        <div className="divide-y tk-divider">{items.slice(0, 4).map(({ p, meta }) => <PersonRow key={p.id} p={p} meta={meta} />)}</div>
      )}
      {items.length > 4 && <p className="pt-1.5 font-body text-[11px] font-bold text-primary">+{items.length - 4} more</p>}
    </div>
  );
}

const QUICK_LINKS: { group: string; links: string[] }[] = [
  { group: 'Quick Reports', links: ['All employees', 'Registered employees', 'Employees on notice', 'Employees in probation', 'Incomplete profiles', 'Employees in exit period'] },
  { group: 'Other Reports', links: ['Employee master details', 'Employee documents report', 'Attrition report', 'Employee pending policy revisions', 'Custom fields report'] },
  { group: 'Bulk Operations', links: ['Add employees in bulk', 'Update employees in bulk', 'Import employee job details', 'Import custom fields', 'Bulk invite employees', 'Bulk import documents'] },
];

const PENDING: { icon: typeof Users; label: string; count: number }[] = [
  { icon: BadgeCheck, label: 'Approvals', count: 6 },
  { icon: FileText, label: 'Documents', count: 52 },
  { icon: ClipboardList, label: 'Tasks', count: 19 },
  { icon: Hourglass, label: 'Probations', count: 3 },
  { icon: Inbox, label: 'Tickets', count: 84 },
  { icon: KeyRound, label: 'Invites', count: 2 },
];

export default function OrgSummary() {
  const { people, loading, error } = useOrgPeople();
  const [logins, setLogins] = useState<{ created_at: string }[] | null>(null);

  useEffect(() => {
    api<{ created_at: string }[]>('organization?resource=logins').then(setLogins).catch(() => setLogins([]));
  }, []);

  if (loading) return <div className="tk-card"><NeuLoader label="Loading organization…" /></div>;

  const now = new Date();
  const d30 = new Date(now.getTime() - 30 * 864e5).toISOString().slice(0, 10);
  const active = people.filter((p) => p.status !== 'Exited');
  const newJoins = people.filter((p) => p.joined >= d30 && p.status !== 'Exited');
  const exits30 = people.filter((p) => p.exit_date && p.exit_date >= d30);
  const onboarding = people.filter((p) => p.status === 'Onboarding');
  const probation = people.filter((p) => p.status === 'Probation');
  const month = now.getMonth();
  const birthdays = active.filter((p) => p.dob && new Date(p.dob).getMonth() === month);
  const anniversaries = active.filter((p) => {
    const j = new Date(p.joined);
    return j.getMonth() === month && j.getFullYear() < now.getFullYear();
  });

  // login chart: count per day, last 14 days
  const loginData = (() => {
    const m = new Map<string, number>();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 864e5);
      m.set(`${d.getDate()}/${d.getMonth() + 1}`, 0);
    }
    (logins || []).forEach((l) => {
      const d = new Date(l.created_at);
      const k = `${d.getDate()}/${d.getMonth() + 1}`;
      if (m.has(k)) m.set(k, (m.get(k) || 0) + 1);
    });
    return [...m.entries()].map(([label, value]) => ({ label, value }));
  })();

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      {error && <div className="tk-card px-4 py-2.5 font-body text-[13px] text-rose-500">{error}</div>}

      {/* stat tiles */}
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-5">
        <Tile icon={Users} label="Total employees" value={active.length} tone="text-primary" />
        <Tile icon={UserPlus} label="New joins · 30d" value={newJoins.length} tone="text-sky-600" />
        <Tile icon={UserMinus} label="Exits · 30d" value={exits30.length} tone="text-rose-500" />
        <Tile icon={GraduationCap} label="Onboarding" value={onboarding.length} tone="text-gold-deep" />
        <Tile icon={Hourglass} label="In probation" value={probation.length} tone="text-purple-500" />
      </div>

      {/* pending actions strip */}
      <div className="tk-card p-4">
        <p className="mb-3 font-display text-[14px] font-semibold text-ink">Pending actions</p>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {PENDING.map(({ icon: Icon, label, count }) => (
            <button key={label} data-tip="Coming soon" className="tk-inset flex flex-col items-center gap-1 rounded-xl px-2 py-3 transition hover:text-primary">
              <Icon size={16} className="text-primary" />
              <span className="font-display text-[17px] font-bold leading-none text-ink">{count}</span>
              <span className="font-body text-[10px] font-bold uppercase tracking-wide text-muted">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        {/* quick links rail (dummy until modules ship) */}
        <div className="space-y-4">
          {QUICK_LINKS.map(({ group, links }) => (
            <div key={group} className="tk-card p-4">
              <p className="mb-2 flex items-center gap-2 font-display text-[13.5px] font-semibold text-ink">
                {group === 'Bulk Operations' ? <Upload size={13} className="text-primary" /> : <Link2 size={13} className="text-primary" />} {group}
              </p>
              <div className="space-y-0.5">
                {links.map((l) => (
                  <button key={l} data-tip="Coming soon"
                    className="block w-full rounded-lg px-2 py-1.5 text-left font-body text-[12.5px] font-medium text-ink/70 transition hover:bg-primary/8 hover:text-primary">
                    {l}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* main column */}
        <div className="space-y-5">
          <Chart title="Employee login summary · last 14 days" data={loginData} defaultKind="area" height={230} loading={logins === null} />

          <div className="grid gap-4 sm:grid-cols-2">
            <ListCard title="New hires" icon={UserPlus} empty="No recent hires."
              items={newJoins.map((p) => ({ p, meta: fmtDate(p.joined, { day: 'numeric', month: 'short' }) }))} />
            <ListCard title="Exits" icon={UserMinus} empty="No exits in the last 30 days."
              items={exits30.map((p) => ({ p, meta: fmtDate(p.exit_date!, { day: 'numeric', month: 'short' }) }))} />
            <ListCard title="Onboarding" icon={GraduationCap} empty="Nobody is onboarding."
              items={onboarding.map((p) => ({ p, meta: fmtDate(p.joined, { day: 'numeric', month: 'short' }) }))} />
            <ListCard title="Probation" icon={Hourglass} empty="Nobody is in probation."
              items={probation.map((p) => ({ p, meta: `since ${fmtDate(p.joined, { day: 'numeric', month: 'short' })}` }))} />
            <ListCard title="Birthdays this month" icon={Cake} empty="No birthdays this month."
              items={birthdays.map((p) => ({ p, meta: fmtDate(p.dob!, { day: 'numeric', month: 'short' }) }))} />
            <ListCard title="Work anniversaries" icon={PartyPopper} empty="No anniversaries this month."
              items={anniversaries.map((p) => ({ p, meta: `${now.getFullYear() - new Date(p.joined).getFullYear()} yr` }))} />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
