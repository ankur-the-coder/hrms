/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { applyCustomTokens, WALLPAPERS, fontStack, loadGoogleFont, type ThemeKey, type Mode, type CustomTheme } from './themes';

export interface Prefs {
  theme: ThemeKey;
  mode: Mode;
  /** Google Fonts family names — empty string = theme default */
  fontDisplay: string;
  fontBody: string;
  language: string;
  wallpaper: string; // 'none' | preset key | 'url:<https url>'
  custom: CustomTheme | null;
}

const DEFAULTS: Prefs = { theme: 'soft', mode: 'light', fontDisplay: '', fontBody: '', language: 'en', wallpaper: 'none', custom: null };
const LS_KEY = 'aviary-prefs-v2';

interface Ctx extends Prefs {
  set: (patch: Partial<Prefs>) => void;
  hydrate: (server: Partial<Prefs> | null) => void;
  wallpaperCss: string;
}

const ThemeContext = createContext<Ctx>({ ...DEFAULTS, set: () => {}, hydrate: () => {}, wallpaperCss: '' });

function load(): Prefs {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return DEFAULTS;
}

function applyDom(p: Prefs) {
  const root = document.documentElement;
  root.setAttribute('data-theme', p.theme);
  root.setAttribute('data-mode', p.mode);
  applyCustomTokens(p.theme === 'custom' ? p.custom : null, p.mode);
  // font overrides win over theme / custom fonts (loaded on demand from Google Fonts)
  if (p.fontDisplay) {
    loadGoogleFont(p.fontDisplay);
    root.style.setProperty('--t-font-display', fontStack(p.fontDisplay));
  }
  if (p.fontBody) {
    loadGoogleFont(p.fontBody);
    root.style.setProperty('--t-font-body', fontStack(p.fontBody));
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(load);
  const prevMode = useRef(prefs.mode);

  useEffect(() => {
    // beautiful cross-fade when switching light <-> dark
    if (prevMode.current !== prefs.mode) {
      prevMode.current = prefs.mode;
      const root = document.documentElement;
      root.classList.add('mode-anim');
      window.setTimeout(() => root.classList.remove('mode-anim'), 700);
    }
    applyDom(prefs);
    localStorage.setItem(LS_KEY, JSON.stringify(prefs));
    window.dispatchEvent(new CustomEvent('aviary:prefs', { detail: prefs }));
  }, [prefs]);

  const set = useCallback((patch: Partial<Prefs>) => setPrefs((p) => ({ ...p, ...patch })), []);
  const hydrate = useCallback((server: Partial<Prefs> | null) => {
    if (server && Object.keys(server).length) setPrefs((p) => ({ ...p, ...server }));
  }, []);

  const wallpaperCss = prefs.wallpaper.startsWith('url:')
    ? `url("${prefs.wallpaper.slice(4)}")`
    : WALLPAPERS.find((w) => w.key === prefs.wallpaper)?.css || '';

  return <ThemeContext.Provider value={{ ...prefs, set, hydrate, wallpaperCss }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
