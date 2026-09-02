import { useState, useMemo, useRef, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Feather, Home, Boxes, Building2, Bell, MessageSquare, Search, Menu, X,
  LayoutDashboard, Network, ChevronDown,
} from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';
import ProfileMenu from './ProfileMenu';
import { TooltipLayer } from '../shared/primitives';

/* Global search registry — modules, sub-modules and functionality. */
const SEARCH_INDEX: { label: string; hint: string; path: string; keys: string }[] = [
  { label: 'Home', hint: 'Module', path: '/home', keys: 'home dashboard start' },
  { label: 'Org · Dashboard · Summary', hint: 'Sub-module', path: '/organization/dashboard/summary', keys: 'org summary dashboard hires exits birthdays anniversaries pending' },
  { label: 'Org · Dashboard · Analytics', hint: 'Sub-module', path: '/organization/dashboard/analytics', keys: 'analytics headcount demographics growth retention attrition charts gender nationality worker' },
  { label: 'Org · Dashboard · Employee Reports', hint: 'Sub-module', path: '/organization/dashboard/reports', keys: 'reports custom report employee master exits probation onboarding' },
  { label: 'Org · Dashboard · Audit Logs', hint: 'Sub-module', path: '/organization/dashboard/audit', keys: 'audit logs events trail history login security' },
  { label: 'Org Structure · Legal Entities', hint: 'Sub-module', path: '/organization/structure/legal-entities', keys: 'legal entity cin incorporation signatories bank account payroll configuration' },
  { label: 'Org Structure · Business Units', hint: 'Sub-module', path: '/organization/structure/business-units', keys: 'business unit divisions bulk assign employees' },
  { label: 'Org Structure · Locations', hint: 'Sub-module', path: '/organization/structure/locations', keys: 'location office timezone map import bulk assign' },
  { label: 'Org Structure · Departments', hint: 'Sub-module', path: '/organization/structure/departments', keys: 'department hierarchy tree wall settings sub-department' },
  { label: 'Org Structure · Cost Centers', hint: 'Sub-module', path: '/organization/structure/cost-centers', keys: 'cost center budget accounting code' },
  { label: 'Org Structure · Pay Grades', hint: 'Sub-module', path: '/organization/structure/pay-grades', keys: 'pay grade compensation tier salary' },
  { label: 'Org Structure · Bands', hint: 'Sub-module', path: '/organization/structure/bands', keys: 'band job level career ladder' },
  { label: 'Bulk import (file / Google Sheets / link)', hint: 'Functionality', path: '/organization/structure/business-units', keys: 'bulk import upload excel csv google sheets outlook onedrive link wizard map columns' },
  { label: 'Components · Playground', hint: 'Module', path: '/playground', keys: 'components playground datatable table pickers date time select charts kanban' },
  { label: 'Theme settings', hint: 'Appearance', path: '@theme', keys: 'theme soft basic brutalism glass anime custom skin appearance' },
  { label: 'Font style', hint: 'Appearance', path: '@font', keys: 'font typography typeface fraunces playfair sora lora' },
  { label: 'Wallpaper', hint: 'Appearance', path: '@wallpaper', keys: 'wallpaper background image' },
  { label: 'Light / Dark mode', hint: 'Appearance', path: '@mode', keys: 'dark light mode night day toggle' },
  { label: 'Create custom report', hint: 'Functionality', path: '/organization/reports', keys: 'custom report builder fields export' },
  { label: 'Export data (PDF / Excel / CSV / Print)', hint: 'Functionality', path: '/playground', keys: 'export pdf excel csv print download' },
];

const NAV: { to?: string; label: string; icon: typeof Home; defaultTo?: string; children?: { to: string; label: string; icon: typeof Home; match: string }[] }[] = [
  { to: '/home', label: 'Home', icon: Home },
  {
    label: 'Organization', icon: Building2, defaultTo: '/organization/dashboard/summary',
    children: [
      { to: '/organization/dashboard/summary', label: 'Dashboard', icon: LayoutDashboard, match: '/organization/dashboard' },
      { to: '/organization/structure/legal-entities', label: 'Org Structure', icon: Network, match: '/organization/structure' },
    ],
  },
  { to: '/playground', label: 'Components', icon: Boxes },
];

function SideNav({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set(['Organization']));
  return (
    <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
      {NAV.map((item) => {
        if (!item.children) {
          const Icon = item.icon;
          return (
            <NavLink key={item.to} to={item.to!} onClick={onNavigate}
              className={({ isActive }: { isActive: boolean }) => `flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 font-body text-[13px] font-bold transition ${isActive ? 'tk-inset text-primary' : 'text-muted hover:text-ink'}`}>
              <Icon size={15} /> {item.label}
            </NavLink>
          );
        }
        const open = openGroups.has(item.label);
        const groupActive = location.pathname.startsWith('/organization');
        const Icon = item.icon;
        return (
          <div key={item.label}>
            {/* clicking the group opens its default (Dashboard · Summary) */}
            <button onClick={() => {
              setOpenGroups((s) => { const n = new Set(s); n.add(item.label); return n; });
              if (item.defaultTo) { navigate(item.defaultTo); onNavigate?.(); }
            }}
              className={`flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 font-body text-[13px] font-bold transition ${groupActive ? 'text-primary' : 'text-muted hover:text-ink'}`}>
              <Icon size={15} /> {item.label}
              <span role="button" tabIndex={0}
                onClick={(e) => { e.stopPropagation(); setOpenGroups((s) => { const n = new Set(s); n.has(item.label) ? n.delete(item.label) : n.add(item.label); return n; }); }}
                className="ml-auto rounded p-0.5 hover:text-ink">
                <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
              </span>
            </button>
            <AnimatePresence initial={false}>
              {open && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22 }} className="overflow-hidden">
                  <div className="ml-4 space-y-0.5 border-l tk-divider py-1 pl-3">
                    {item.children.map((c) => {
                      const CIcon = c.icon;
                      const active = location.pathname.startsWith(c.match);
                      return (
                        <button key={c.to} onClick={() => { navigate(c.to); onNavigate?.(); }}
                          className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 font-body text-[12.5px] font-semibold transition ${active ? 'tk-inset text-primary' : 'text-muted hover:text-ink'}`}>
                          <CIcon size={13} /> {c.label}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </nav>
  );
}

function GlobalSearch() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return SEARCH_INDEX
      .map((e) => {
        const hay = (e.label + ' ' + e.keys).toLowerCase();
        const score = hay.startsWith(t) ? 3 : e.label.toLowerCase().includes(t) ? 2 : hay.includes(t) ? 1 : 0;
        return { e, score };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 7)
      .map((r) => r.e);
  }, [q]);

  useEffect(() => { setSel(0); }, [q]);
  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const go = (path: string) => {
    setOpen(false); setQ('');
    if (path.startsWith('@')) {
      window.dispatchEvent(new CustomEvent('aviary:open-pref', { detail: path.slice(1) }));
    } else navigate(path);
  };

  return (
    <div ref={boxRef} className="relative w-full max-w-[150px] sm:max-w-xs">
      <div className="tk-inset flex items-center gap-2 rounded-full px-3.5 py-2">
        <Search size={13} className="shrink-0 text-muted" />
        <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(results.length - 1, s + 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
            if (e.key === 'Enter' && results[sel]) go(results[sel].path);
            if (e.key === 'Escape') setOpen(false);
          }}
          placeholder="Search anything…"
          className="w-full bg-transparent font-body text-[12.5px] text-ink outline-none placeholder:text-muted" />
      </div>
      <AnimatePresence>
        {open && results.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
            className="tk-pop absolute left-0 right-0 top-[calc(100%+8px)] z-50 min-w-[270px] p-1.5">
            {results.map((r, i) => (
              <button key={r.label} onMouseEnter={() => setSel(i)} onClick={() => go(r.path)}
                className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition ${i === sel ? 'bg-primary/10' : ''}`}>
                <span className="truncate font-body text-[12.5px] font-bold text-ink">{r.label}</span>
                <span className="tk-chip shrink-0 px-2 py-0.5 font-body text-[9.5px] font-bold text-muted">{r.hint}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { wallpaperCss } = useTheme();
  const navigate = useNavigate();
  const [mobileNav, setMobileNav] = useState(false);

  const logo = (
    <button onClick={() => navigate('/home')} className="flex items-center gap-2.5 px-4 py-4">
      <span className="tk-raise-sm flex h-9 w-9 items-center justify-center rounded-xl">
        <Feather size={17} className="text-primary" />
      </span>
      <span className="text-left">
        <span className="block font-display text-[16px] font-bold leading-none tracking-tight text-ink">Aviary</span>
        <span className="block font-body text-[9px] font-bold uppercase tracking-[0.2em] text-muted">People OS · v2</span>
      </span>
    </button>
  );

  return (
    <div className="min-h-screen">
      {wallpaperCss && <div className="tk-wallpaper" style={{ background: wallpaperCss, backgroundSize: 'cover' }} />}
      <TooltipLayer />

      {/* ---- Sidebar (desktop) ---- */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r tk-divider bg-surface/85 backdrop-blur-md lg:flex">
        {logo}
        <SideNav />
        <p className="border-t tk-divider px-4 py-3 font-body text-[10px] font-semibold text-muted">© 2026 Aviary Technologies</p>
      </aside>

      {/* ---- Mobile drawer ---- */}
      <AnimatePresence>
        {mobileNav && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setMobileNav(false)} />
            <motion.aside initial={{ x: -260 }} animate={{ x: 0 }} exit={{ x: -260 }} transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed inset-y-0 left-0 z-50 flex w-60 flex-col bg-surface lg:hidden">
              <div className="flex items-center justify-between pr-3">{logo}
                <button onClick={() => setMobileNav(false)} className="tk-btn-ghost rounded-lg p-1.5"><X size={15} /></button>
              </div>
              <SideNav onNavigate={() => setMobileNav(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ---- Topbar ---- */}
      <header className="sticky top-0 z-30 border-b tk-divider bg-paper/80 backdrop-blur-md lg:pl-60">
        <div className="flex h-16 items-center gap-2.5 px-4 sm:px-6">
          <button onClick={() => setMobileNav(true)} className="tk-btn-ghost rounded-xl p-2 lg:hidden"><Menu size={16} /></button>
          <div className="ml-auto flex items-center gap-2.5">
            <GlobalSearch />
            <button data-tip="Alerts — coming soon" className="tk-btn-ghost relative rounded-full p-2.5">
              <Bell size={15} />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-500" />
            </button>
            <button data-tip="Messages — coming soon" className="tk-btn-ghost relative rounded-full p-2.5">
              <MessageSquare size={15} />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-gold" />
            </button>
            <ProfileMenu />
          </div>
        </div>
      </header>

      <main className="px-4 py-6 sm:px-6 lg:pl-[264px] lg:pr-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
