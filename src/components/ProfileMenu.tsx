import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';
import { Palette, Languages, Image as ImageIcon, LogOut, Sun, Moon, ChevronRight, Check, Copy, Upload, Sparkles, Type, Search } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { THEME_LIST, WALLPAPERS, GOOGLE_FONTS, fontStack, loadGoogleFont, CUSTOM_THEME_PROMPT, parseCustomTheme, type FontCategory } from '../theme/themes';
import { Avatar, Modal, btnPrimary, btnGhost, inputCls, labelCls } from '../shared/primitives';

/* ============================================================
   FontLibrary — searchable Google Fonts browser (120 curated
   open-source families, loaded on demand). Separate Heading /
   Body targets with live previews.
   ============================================================ */
const FONT_CATS: { key: FontCategory | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'sans-serif', label: 'Sans' },
  { key: 'serif', label: 'Serif' },
  { key: 'display', label: 'Display' },
  { key: 'handwriting', label: 'Script' },
  { key: 'monospace', label: 'Mono' },
];
const FONT_PAGE = 10;

function FontLibrary() {
  const theme = useTheme();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<FontCategory | 'all'>('all');
  const [target, setTarget] = useState<'display' | 'body' | 'both'>('both');
  const [page, setPage] = useState(0);

  const filtered = GOOGLE_FONTS.filter((f) =>
    (cat === 'all' || f.cat === cat) &&
    (!q.trim() || f.name.toLowerCase().includes(q.trim().toLowerCase()))
  );
  const pages = Math.max(1, Math.ceil(filtered.length / FONT_PAGE));
  const shown = filtered.slice(page * FONT_PAGE, (page + 1) * FONT_PAGE);

  // load previews only for the visible page (bounded network cost)
  useEffect(() => { shown.forEach((f) => loadGoogleFont(f.name)); }, [shown]);
  useEffect(() => { setPage(0); }, [q, cat]);

  const apply = (family: string) => {
    if (target === 'display') theme.set({ fontDisplay: family });
    else if (target === 'body') theme.set({ fontBody: family });
    else theme.set({ fontDisplay: family, fontBody: family });
  };

  return (
    <div>
      {/* current selection */}
      <div className="tk-inset mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 rounded-xl px-4 py-2.5">
        <p className="font-body text-[11px] font-bold uppercase tracking-wider text-muted">Current</p>
        <p className="font-body text-[12.5px] text-ink/75">Headings: <b>{theme.fontDisplay || 'Theme default'}</b></p>
        <p className="font-body text-[12.5px] text-ink/75">Body: <b>{theme.fontBody || 'Theme default'}</b></p>
        {(theme.fontDisplay || theme.fontBody) && (
          <button onClick={() => theme.set({ fontDisplay: '', fontBody: '' })}
            className="ml-auto font-body text-[11.5px] font-bold text-rose-500 hover:underline">Reset to theme</button>
        )}
      </div>

      {/* search + category + target */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="tk-inset flex min-w-[160px] flex-1 items-center gap-2 rounded-xl px-3 py-2">
          <Search size={13} className="shrink-0 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search 120+ fonts…"
            className="w-full bg-transparent font-body text-[12.5px] text-ink outline-none placeholder:text-muted" />
        </div>
        <div className="tk-inset flex gap-0.5 p-1">
          {FONT_CATS.map((c) => (
            <button key={c.key} onClick={() => setCat(c.key)}
              className={`rounded-lg px-2.5 py-1 font-body text-[11px] font-bold transition ${cat === c.key ? 'tk-raise-sm text-primary' : 'text-muted hover:text-ink'}`}>
              {c.label}
            </button>
          ))}
        </div>
      </div>
      <div className="tk-inset mb-3 flex w-fit gap-0.5 p-1">
        {([['both', 'Apply to both'], ['display', 'Headings only'], ['body', 'Body only']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTarget(k)}
            className={`rounded-lg px-3 py-1.5 font-body text-[11.5px] font-bold transition ${target === k ? 'tk-raise-sm text-primary' : 'text-muted hover:text-ink'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* font list */}
      <div className="space-y-2">
        {shown.length === 0 && <p className="py-6 text-center font-body text-[12.5px] text-muted">No fonts match your search.</p>}
        {shown.map((f) => {
          const isH = theme.fontDisplay === f.name;
          const isB = theme.fontBody === f.name;
          return (
            <button key={f.name} onClick={() => apply(f.name)}
              className={`tk-card flex w-full items-center gap-3 p-3 text-left transition hover:-translate-y-0.5 ${isH || isB ? 'ring-2 ring-(--t-accent)' : ''}`}>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2">
                  <span className="font-body text-[12px] font-bold text-ink">{f.name}</span>
                  <span className="tk-chip px-2 py-0.5 font-body text-[9px] font-bold uppercase text-muted">{f.cat}</span>
                  {isH && <Badge>H</Badge>}
                  {isB && <Badge>B</Badge>}
                </p>
                <p className="mt-0.5 truncate text-[17px] leading-snug text-ink/85" style={{ fontFamily: fontStack(f.name) }}>
                  Aviary makes HR effortless · 0123456789
                </p>
              </div>
              {(isH || isB) && <Check size={15} className="shrink-0 text-primary" />}
            </button>
          );
        })}
      </div>

      {/* pagination */}
      {pages > 1 && (
        <div className="mt-3 flex items-center justify-between">
          <p className="font-body text-[11.5px] text-muted">{filtered.length} fonts · page {page + 1} of {pages}</p>
          <div className="flex gap-1.5">
            <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className={btnGhost + ' !px-3 !py-1.5 text-[12px] disabled:opacity-40'}>‹ Prev</button>
            <button disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)} className={btnGhost + ' !px-3 !py-1.5 text-[12px] disabled:opacity-40'}>Next ›</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-(--t-accent) px-1 font-body text-[9.5px] font-bold text-white">{children}</span>;
}

export default function ProfileMenu() {
  const { profile, signOut } = useAuth();
  const theme = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [fontOpen, setFontOpen] = useState(false);
  const [wallOpen, setWallOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

  // Global search deep-links into appearance settings
  useEffect(() => {
    const onPref = (e: Event) => {
      const which = (e as CustomEvent).detail;
      if (which === 'theme') setThemeOpen(true);
      else if (which === 'font') setFontOpen(true);
      else if (which === 'wallpaper') setWallOpen(true);
      else if (which === 'mode') theme.set({ mode: theme.mode === 'light' ? 'dark' : 'light' });
    };
    window.addEventListener('aviary:open-pref', onPref);
    return () => window.removeEventListener('aviary:open-pref', onPref);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme.mode]);
  const [customText, setCustomText] = useState('');
  const [customErr, setCustomErr] = useState('');
  const [copied, setCopied] = useState(false);
  const [wallUrl, setWallUrl] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const applyCustom = (text: string) => {
    setCustomErr('');
    try {
      const parsed = parseCustomTheme(text);
      theme.set({ theme: 'custom', custom: parsed });
    } catch (e) {
      setCustomErr(e instanceof Error ? `Invalid theme: ${e.message}` : 'Could not parse theme JSON');
    }
  };

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(CUSTOM_THEME_PROMPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard denied */ }
  };

  const row = 'flex w-full items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 font-body text-[13.5px] font-semibold text-ink/80 transition hover:bg-primary/8';

  return (
    <div ref={wrapRef} className="relative">
      <button onClick={() => setOpen((o) => !o)} className="rounded-full transition active:scale-95">
        <Avatar src={profile?.avatar_url} name={profile?.full_name || 'You'} size={38} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div initial={{ opacity: 0, y: 8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }} transition={{ duration: 0.16 }}
              className="tk-pop absolute right-0 top-[calc(100%+10px)] z-50 w-72 p-3">
              {/* identity */}
              <div className="mb-2 flex items-center gap-3 border-b tk-divider px-1.5 pb-3">
                <Avatar src={profile?.avatar_url} name={profile?.full_name || 'You'} size={42} />
                <div className="min-w-0">
                  <p className="truncate font-body text-[14px] font-bold text-ink">{profile?.full_name || '—'}</p>
                  <p className="truncate font-body text-[11.5px] text-muted">{profile?.email} · {profile?.role}</p>
                </div>
              </div>

              <button className={row} onClick={() => { setThemeOpen(true); setOpen(false); }}>
                <span className="flex items-center gap-2.5"><Palette size={15} className="text-primary" /> Theme</span>
                <span className="flex items-center gap-1 font-body text-[11.5px] font-bold text-muted">
                  {theme.theme === 'custom' ? theme.custom?.name || 'Custom' : THEME_LIST.find((t) => t.key === theme.theme)?.name}
                  <ChevronRight size={13} />
                </span>
              </button>
              <button className={row} onClick={() => { setFontOpen(true); setOpen(false); }}>
                <span className="flex items-center gap-2.5"><Type size={15} className="text-primary" /> Font style</span>
                <span className="flex items-center gap-1 font-body text-[11.5px] font-bold text-muted">
                  {theme.fontDisplay || theme.fontBody ? `${theme.fontDisplay || 'Theme'} / ${theme.fontBody || 'Theme'}` : 'Theme default'}
                  <ChevronRight size={13} />
                </span>
              </button>
              <button className={row} onClick={() => setLangOpen((v) => !v)}>
                <span className="flex items-center gap-2.5"><Languages size={15} className="text-primary" /> Language</span>
                <span className="flex items-center gap-1 font-body text-[11.5px] font-bold text-muted">English <ChevronRight size={13} className={langOpen ? 'rotate-90 transition-transform' : 'transition-transform'} /></span>
              </button>
              {langOpen && (
                <div className="tk-inset mx-2 mb-1 p-1.5">
                  <button className="flex w-full items-center justify-between rounded-lg px-3 py-2 font-body text-[13px] font-bold text-primary">
                    English <Check size={14} />
                  </button>
                  <p className="px-3 pb-1 font-body text-[10.5px] text-muted">More languages coming soon.</p>
                </div>
              )}
              <button className={row} onClick={() => { setWallOpen(true); setOpen(false); }}>
                <span className="flex items-center gap-2.5"><ImageIcon size={15} className="text-primary" /> Wallpaper</span>
                <span className="flex items-center gap-1 font-body text-[11.5px] font-bold text-muted">
                  {theme.wallpaper === 'none' ? 'None' : theme.wallpaper.startsWith('url:') ? 'Custom' : WALLPAPERS.find((w) => w.key === theme.wallpaper)?.name}
                  <ChevronRight size={13} />
                </span>
              </button>

              <div className="my-2 border-t tk-divider" />
              <button className={`${row} !text-rose-500`} onClick={async () => { setOpen(false); await signOut(); navigate('/login'); }}>
                <span className="flex items-center gap-2.5"><LogOut size={15} /> Log out</span>
              </button>

              {/* light/dark toggle */}
              <div className="mt-2 border-t tk-divider pt-2.5">
                <div className="tk-inset flex gap-1 p-1">
                  {(['light', 'dark'] as const).map((m) => (
                    <button key={m} onClick={() => theme.set({ mode: m })}
                      className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 font-body text-[12px] font-bold transition ${theme.mode === m ? 'tk-raise-sm text-primary' : 'text-muted hover:text-ink'}`}>
                      {m === 'light' ? <Sun size={13} /> : <Moon size={13} />} {m === 'light' ? 'Light' : 'Dark'}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ================= Theme modal ================= */}
      <Modal open={themeOpen} onClose={() => setThemeOpen(false)} title="Choose your theme" wide>
        <div className="grid gap-3 sm:grid-cols-2">
          {THEME_LIST.map((t) => (
            <button key={t.key} onClick={() => theme.set({ theme: t.key })}
              className={`tk-card p-4 text-left transition hover:-translate-y-0.5 ${theme.theme === t.key ? 'ring-2 ring-(--t-accent)' : ''}`}>
              <div className="mb-2.5 flex gap-1.5">
                {t.swatch.map((c, i) => <span key={i} className="h-6 w-6 rounded-full border border-black/10" style={{ background: c }} />)}
              </div>
              <p className="flex items-center gap-2 font-display text-[15px] font-semibold text-ink">
                {t.name} {theme.theme === t.key && <Check size={14} className="text-primary" />}
              </p>
              <p className="font-body text-[12px] text-muted">{t.desc}</p>
            </button>
          ))}

          {/* custom import */}
          <div className={`tk-card p-4 sm:col-span-2 ${theme.theme === 'custom' ? 'ring-2 ring-(--t-accent)' : ''}`}>
            <p className="flex items-center gap-2 font-display text-[15px] font-semibold text-ink">
              <Sparkles size={15} className="text-gold" /> Custom theme (AI-generated)
              {theme.theme === 'custom' && <Check size={14} className="text-primary" />}
            </p>
            <p className="mt-1 font-body text-[12px] leading-relaxed text-muted">
              1. Copy the ready-made prompt · 2. Paste it into any AI with a description of the design you want · 3. Paste the AI’s JSON reply below (or upload it as a .txt file) and apply.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={copyPrompt} className={btnGhost + ' !py-2 text-[12.5px]'}>
                <Copy size={13} /> {copied ? 'Copied!' : 'Copy AI prompt'}
              </button>
              <button onClick={() => fileRef.current?.click()} className={btnGhost + ' !py-2 text-[12.5px]'}>
                <Upload size={13} /> Upload .txt
              </button>
              <input ref={fileRef} type="file" accept=".txt,.json" className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const r = new FileReader();
                  r.onload = () => { setCustomText(String(r.result || '')); applyCustom(String(r.result || '')); };
                  r.readAsText(f);
                  e.target.value = '';
                }} />
            </div>
            <textarea rows={4} value={customText} onChange={(e) => setCustomText(e.target.value)}
              placeholder='Paste the AI\u2019s JSON here — {"name":"...", "tokens":{...}}'
              className={inputCls + ' mt-3 font-mono !text-[11.5px]'} />
            {customErr && <p className="mt-2 rounded-xl bg-rose-500/8 px-3 py-2 font-body text-[12px] text-rose-500">{customErr}</p>}
            <div className="mt-3 flex justify-end">
              <button onClick={() => applyCustom(customText)} disabled={!customText.trim()} className={btnPrimary + ' !py-2 text-[12.5px]'}>
                <Sparkles size={13} /> Apply custom theme
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* ================= Font modal — Google Fonts library ================= */}
      <Modal open={fontOpen} onClose={() => setFontOpen(false)} title="Font style · Google Fonts" wide>
        <FontLibrary />
      </Modal>

      {/* ================= Wallpaper modal ================= */}
      <Modal open={wallOpen} onClose={() => setWallOpen(false)} title="Wallpaper">
        <div className="grid grid-cols-3 gap-2.5">
          {WALLPAPERS.map((w) => (
            <button key={w.key} onClick={() => theme.set({ wallpaper: w.key })}
              className={`overflow-hidden rounded-xl border-2 transition ${theme.wallpaper === w.key ? 'border-(--t-accent)' : 'border-transparent'}`}>
              <div className="flex h-16 items-center justify-center" style={{ background: w.css || 'var(--t-surface2)' }}>
                {w.key === 'none' && <span className="font-body text-[11px] font-bold text-muted">None</span>}
              </div>
              <p className="bg-surface py-1 text-center font-body text-[10.5px] font-bold text-ink/70">{w.name}</p>
            </button>
          ))}
        </div>
        <div className="mt-4">
          <label className={labelCls}>Custom image URL</label>
          <div className="flex gap-2">
            <input value={wallUrl} onChange={(e) => setWallUrl(e.target.value)} placeholder="https://…/image.jpg" className={inputCls} />
            <button onClick={() => { if (wallUrl.startsWith('http')) theme.set({ wallpaper: `url:${wallUrl}` }); }}
              disabled={!wallUrl.startsWith('http')} className={btnPrimary + ' shrink-0 !py-2'}>Apply</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
