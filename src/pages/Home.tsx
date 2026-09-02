import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Boxes, Palette, ArrowRight, Building2, Rocket } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function Home() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const first = profile?.full_name?.split(' ')[0] || 'there';
  const h = new Date().getHours();
  const greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <p className="font-body text-[12px] font-bold uppercase tracking-[0.18em] text-primary">Aviary v2 · Enterprise rebuild</p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink">
          {greet}, <em className="text-primary">{first}</em>
        </h1>
        <p className="mt-1.5 max-w-xl font-body text-[13.5px] leading-relaxed text-muted">
          The multi-tenant foundation is live — theme engine, shared component kit and the new data architecture. Business modules land next.
        </p>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2">
        {[
          { icon: Boxes, title: 'Component kit', desc: 'DataTable with 6 views, inline pickers, smart selects — the shared building blocks every module will use.', cta: 'Open playground', go: () => navigate('/playground') },
          { icon: Palette, title: 'Theme engine', desc: 'Soft UI, Basic, Neo-Brutalism, Glassmorphism, Anime — plus AI-generated custom themes, wallpapers and dark mode. Open it from your avatar, top-right.', cta: null, go: null },
          { icon: Building2, title: 'Organization module', desc: 'Dashboard, analytics, employee reports, audit logs and full org structure — arriving in the next build.', cta: null, go: null },
          { icon: Rocket, title: 'Rust + Svelte mirror', desc: 'Every feature here ships with its Axum/SQLx + Svelte equivalent in /rust-svelte-stack, per the engineering guidelines.', cta: null, go: null },
        ].map(({ icon: Icon, title, desc, cta, go }, i) => (
          <motion.div key={title} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 + i * 0.07 }}
            className="tk-card p-5">
            <span className="tk-inset mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl text-primary"><Icon size={18} /></span>
            <h3 className="font-display text-[16px] font-semibold text-ink">{title}</h3>
            <p className="mt-1 font-body text-[12.5px] leading-relaxed text-muted">{desc}</p>
            {cta && go && (
              <button onClick={go} className="mt-3 flex items-center gap-1.5 font-body text-[13px] font-bold text-primary transition hover:gap-2.5">
                {cta} <ArrowRight size={14} />
              </button>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
