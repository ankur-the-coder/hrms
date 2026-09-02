import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import OrgSummary from './OrgSummary';
import OrgAnalytics from './OrgAnalytics';
import OrgReports from './OrgReports';
import OrgAudit from './OrgAudit';

/* Organization → Dashboard: Summary · Analytics · Employee Reports · Audit Logs */
const TABS = [
  { key: 'summary', label: 'Summary' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'reports', label: 'Employee Reports' },
  { key: 'audit', label: 'Audit Logs' },
];

export default function OrgPage() {
  const { tab } = useParams();
  const navigate = useNavigate();
  const active = TABS.some((t) => t.key === tab) ? (tab as string) : 'summary';

  return (
    <div>
      <div className="tk-card sticky top-16 z-20 mb-5 px-2">
        <div className="flex gap-0.5 overflow-x-auto">
          {TABS.map(({ key, label }) => (
            <button key={key} onClick={() => navigate(`/organization/dashboard/${key}`)}
              className={`relative shrink-0 whitespace-nowrap px-3.5 py-3 font-body text-[12px] font-bold uppercase tracking-[0.08em] transition ${
                active === key ? 'text-primary' : 'text-muted hover:text-ink'
              }`}>
              {label}
              {active === key && (
                <motion.span layoutId="orgdash-tab" className="absolute inset-x-2.5 bottom-0 h-[2.5px] rounded-t-full bg-primary"
                  transition={{ type: 'spring', damping: 30, stiffness: 400 }} />
              )}
            </button>
          ))}
        </div>
      </div>

      {active === 'summary' && <OrgSummary />}
      {active === 'analytics' && <OrgAnalytics />}
      {active === 'reports' && <OrgReports />}
      {active === 'audit' && <OrgAudit />}
    </div>
  );
}
