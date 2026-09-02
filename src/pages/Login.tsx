import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowRight, AlertCircle, User, Feather } from 'lucide-react';
import supabase from '../lib/supabase';
import { signInWithGoogle } from '../lib/googleAuth';
import { useAuth } from '../contexts/AuthContext';

/*
 * Full-screen neumorphic auth. Token-driven (Soft UI by default; every
 * theme restyles it automatically). Keeps the signature flap-sweep:
 *  Phase 0  outgoing content lifts away as the sweep begins
 *  Phase 1  the flap expands (clip-path) to cover the screen
 *  Midpoint form column + flap resting side swap while hidden
 *  Phase 2  flap retracts to the opposite angled rest
 *  Phase 3  incoming content staggers upward into view
 */

const EXPAND_MS = 680;

function Field({ label, type, value, onChange, placeholder, icon }: {
  label: string; type: string; value: string; onChange: (v: string) => void;
  placeholder: string; icon: React.ReactNode;
}) {
  return (
    <label className="lx-stagger block">
      <span className="mb-1.5 block font-body text-[10.5px] font-bold uppercase tracking-[0.18em] text-muted">{label}</span>
      <span className="tk-input flex items-center gap-2.5 px-4 py-3">
        <span className="shrink-0 text-primary">{icon}</span>
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
          className="w-full bg-transparent font-body text-[14px] text-ink outline-none placeholder:text-muted" />
      </span>
    </label>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [side, setSide] = useState<'right' | 'left'>('right');
  const [covering, setCovering] = useState(false);
  const [phase, setPhase] = useState<'in' | 'out' | 'pre'>('pre');
  const animating = useRef(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('demo@example.com');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!loading && user) navigate('/home', { replace: true }); }, [user, loading, navigate]);
  useEffect(() => {
    const t = setTimeout(() => setPhase('in'), 60);
    return () => clearTimeout(t);
  }, []);

  const toggleForm = () => {
    if (animating.current) return;
    animating.current = true;
    setError('');
    setPhase('out');
    setCovering(true);
    setTimeout(() => {
      setMode((m) => (m === 'in' ? 'up' : 'in'));
      setSide((s) => (s === 'right' ? 'left' : 'right'));
      setPhase('pre');
      setCovering(false);
      requestAnimationFrame(() => requestAnimationFrame(() => setPhase('in')));
    }, EXPAND_MS);
    setTimeout(() => { animating.current = false; }, EXPAND_MS * 2);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password.trim()) { setError('Email and password are required.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setBusy(true);
    try {
      if (mode === 'up') {
        const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate('/home');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally { setBusy(false); }
  };

  const staggerCls = phase === 'in' ? 'lx-in' : phase === 'out' ? 'lx-out' : '';

  const googleBtn = (
    <button onClick={() => signInWithGoogle('Aviary HRMS')}
      className="lx-stagger tk-btn-ghost flex w-full items-center justify-center gap-3 rounded-full py-3 font-body text-[13px] font-semibold">
      <svg width="17" height="17" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
      Continue with Google
    </button>
  );

  const formCore = (
    <>
      <p className="lx-stagger mb-2 font-body text-[10.5px] font-bold uppercase tracking-[0.28em] text-primary">
        {mode === 'in' ? 'Member access' : 'New membership'}
      </p>
      <h1 className="lx-stagger font-display text-[32px] font-semibold leading-tight text-ink">
        {mode === 'in' ? <>Welcome <em className="text-primary">back.</em></> : <>Join the <em className="text-primary">house.</em></>}
      </h1>
      <p className="lx-stagger mt-1.5 font-body text-[13px] text-muted">
        {mode === 'in' ? 'Sign in to continue exactly where you left off.' : 'Create your account for your organization\u2019s workspace.'}
      </p>

      <form onSubmit={submit} className="mt-7 space-y-4">
        {mode === 'up' && <Field label="Full name" type="text" value={name} onChange={setName} placeholder="Asha Verma" icon={<User size={15} />} />}
        <Field label="Email address" type="email" value={email} onChange={setEmail} placeholder="you@company.com" icon={<Mail size={15} />} />
        <Field label="Password" type="password" value={password} onChange={setPassword} placeholder="••••••••••" icon={<Lock size={15} />} />
        {error && (
          <p className="flex items-center gap-2 rounded-xl bg-rose-500/10 px-3.5 py-2.5 font-body text-[12.5px] text-rose-500">
            <AlertCircle size={14} /> {error}
          </p>
        )}
        <button type="submit" disabled={busy}
          className="lx-stagger tk-btn-primary group flex w-full items-center justify-center gap-2.5 rounded-full py-3.5 font-body text-[13px] font-bold uppercase tracking-[0.16em]">
          {busy ? 'One moment…' : mode === 'in' ? 'Enter workspace' : 'Create account'}
          <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
        </button>
      </form>

      <div className="lx-stagger my-5 flex items-center gap-3">
        <span className="h-px flex-1 border-t tk-divider" />
        <span className="font-body text-[10px] font-bold uppercase tracking-[0.25em] text-muted">or</span>
        <span className="h-px flex-1 border-t tk-divider" />
      </div>
      {googleBtn}
      {mode === 'in' && (
        <p className="lx-stagger tk-chip mt-5 px-4 py-2 text-center font-body text-[11.5px] text-muted">
          <b className="text-gold-deep">Demo</b> — demo@example.com · password123
        </p>
      )}
    </>
  );

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-paper">
      {/* soft ambient shapes */}
      <div className="tk-raise-sm pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full opacity-60" />
      <div className="tk-inset pointer-events-none absolute -bottom-32 -right-20 h-96 w-96 rounded-full opacity-50" />

      {/* ===== Form column (desktop) — swaps sides with the flap ===== */}
      <div className={`absolute inset-y-0 hidden w-[50%] lg:block ${side === 'right' ? 'left-0' : 'right-0'}`}>
        <div className={`flex h-full flex-col justify-center overflow-y-auto px-12 py-8 xl:px-24 ${staggerCls}`}>
          <div className="mx-auto w-full max-w-md">{formCore}</div>
        </div>
      </div>

      {/* ===== Flap (accent panel, clip-path sweep) ===== */}
      <div className={`lx-flap hidden lg:block ${side === 'right' ? 'rest-right' : 'rest-left'} ${covering ? 'covering' : ''}`}>
        <div className={`absolute inset-y-0 flex w-[38%] flex-col justify-center ${side === 'right' ? 'right-0 pl-4 pr-14' : 'left-0 pl-14 pr-4'} ${staggerCls}`}>
          <div className="lx-stagger mb-4 flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 shadow-lg">
              <Feather size={18} className="text-lime-glow" />
            </span>
            <span>
              <span className="block font-display text-[17px] font-bold leading-none text-white">Aviary</span>
              <span className="block font-body text-[9px] font-bold uppercase tracking-[0.24em] text-white/50">People OS</span>
            </span>
          </div>
          <h2 className="lx-stagger font-display text-[30px] font-medium leading-[1.15] text-white">
            {mode === 'in'
              ? <>The quiet luxury of <em className="text-lime-glow">effortless HR.</em></>
              : <>Begin your <em className="text-lime-glow">membership.</em></>}
          </h2>
          <p className="lx-stagger mt-3.5 font-body text-[13px] leading-relaxed text-white/60">
            {mode === 'in'
              ? 'Attendance, payroll, people and structure — curated into one serene workspace.'
              : 'Early access, private onboarding and a workspace tailored to your organization.'}
          </p>
          <button onClick={toggleForm}
            className="lx-stagger mt-7 w-fit rounded-full border border-white/30 px-6 py-2.5 font-body text-[11.5px] font-bold uppercase tracking-[0.18em] text-white transition hover:bg-white/10 active:scale-[0.97]">
            {mode === 'in' ? 'Create an account' : 'Sign in instead'}
          </button>
        </div>
      </div>

      {/* ===== Mobile: single full-screen column ===== */}
      <div className={`flex h-full items-center overflow-y-auto px-6 py-8 lg:hidden ${staggerCls}`}>
        <div className="mx-auto w-full max-w-md">
          <div className="lx-stagger mb-6 flex items-center gap-2.5">
            <span className="tk-raise-sm flex h-10 w-10 items-center justify-center rounded-2xl">
              <Feather size={17} className="text-primary" />
            </span>
            <span>
              <span className="block font-display text-[16px] font-bold leading-none text-ink">Aviary</span>
              <span className="block font-body text-[9px] font-bold uppercase tracking-[0.22em] text-muted">People OS</span>
            </span>
          </div>
          {formCore}
          <p className="lx-stagger mt-5 text-center font-body text-[12.5px] text-muted">
            {mode === 'in' ? 'New to Aviary?' : 'Already a member?'}{' '}
            <button onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setError(''); }}
              className="font-bold text-primary underline underline-offset-4">
              {mode === 'in' ? 'Create an account' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
