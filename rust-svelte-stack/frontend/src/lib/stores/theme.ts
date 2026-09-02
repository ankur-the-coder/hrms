// Theme store — mirror of React src/theme/ThemeContext.tsx.
// data-theme / data-mode attributes; custom themes set inline --t-* vars;
// font override; mode cross-fade animation; server persistence (debounced).
import { writable } from 'svelte/store';

export type ThemeKey = 'soft' | 'basic' | 'brutal' | 'glass' | 'anime' | 'custom';
export type Mode = 'light' | 'dark';

export interface CustomTheme { name: string; tokens: Record<string, string>; darkTokens?: Record<string, string> }
export interface Prefs { theme: ThemeKey; mode: Mode; font: string; language: string; wallpaper: string; custom: CustomTheme | null }

const DEFAULTS: Prefs = { theme: 'soft', mode: 'light', font: 'theme', language: 'en', wallpaper: 'none', custom: null };
const LS_KEY = 'aviary-prefs-v2';

export const FONT_LIST: { key: string; name: string; display: string; body: string }[] = [
  { key: 'theme', name: 'Theme default', display: '', body: '' },
  { key: 'fraunces', name: 'Fraunces & Outfit', display: '"Fraunces", Georgia, serif', body: '"Outfit", system-ui, sans-serif' },
  { key: 'playfair', name: 'Playfair & Inter', display: '"Playfair Display", Georgia, serif', body: '"Inter", system-ui, sans-serif' },
  { key: 'sora', name: 'Sora & Manrope', display: '"Sora", system-ui, sans-serif', body: '"Manrope", system-ui, sans-serif' },
  { key: 'lora', name: 'Lora & Nunito Sans', display: '"Lora", Georgia, serif', body: '"Nunito Sans", system-ui, sans-serif' },
  { key: 'plex', name: 'IBM Plex Serif & Sans', display: '"IBM Plex Serif", Georgia, serif', body: '"IBM Plex Sans", system-ui, sans-serif' },
  { key: 'baloo', name: 'Baloo 2 & Quicksand', display: '"Baloo 2", system-ui, sans-serif', body: '"Quicksand", system-ui, sans-serif' },
];

const VAR_MAP: Record<string, string> = {
  bg: '--t-bg', surface: '--t-surface', surface2: '--t-surface2', ink: '--t-ink',
  muted: '--t-muted', accent: '--t-accent', accentDeep: '--t-accent-deep',
  glow: '--t-glow', gold: '--t-gold', goldDeep: '--t-gold-deep', border: '--t-border',
  radius: '--t-radius', radiusLg: '--t-radius-lg', shadowCard: '--t-shadow-card',
  shadowPop: '--t-shadow-pop', inset: '--t-inset', fontDisplay: '--t-font-display',
  fontBody: '--t-font-body',
};

function applyDom(p: Prefs) {
  const root = document.documentElement;
  root.setAttribute('data-theme', p.theme);
  root.setAttribute('data-mode', p.mode);
  Object.values(VAR_MAP).forEach((v) => root.style.removeProperty(v));
  if (p.theme === 'custom' && p.custom) {
    const t = p.mode === 'dark' && p.custom.darkTokens ? { ...p.custom.tokens, ...p.custom.darkTokens } : p.custom.tokens;
    for (const [k, cssVar] of Object.entries(VAR_MAP)) {
      if (t[k]) root.style.setProperty(cssVar, t[k]);
    }
  }
  const f = FONT_LIST.find((x) => x.key === p.font);
  if (f && f.key !== 'theme') {
    root.style.setProperty('--t-font-display', f.display);
    root.style.setProperty('--t-font-body', f.body);
  }
}

function createTheme() {
  const initial: Prefs = typeof localStorage !== 'undefined'
    ? { ...DEFAULTS, ...JSON.parse(localStorage.getItem(LS_KEY) || '{}') }
    : DEFAULTS;
  const { subscribe, update } = writable<Prefs>(initial);

  let timer: ReturnType<typeof setTimeout>;
  let prevMode: Mode = initial.mode;
  subscribe((p) => {
    if (typeof document === 'undefined') return;
    // cross-fade on light <-> dark switches
    if (prevMode !== p.mode) {
      prevMode = p.mode;
      document.documentElement.classList.add('mode-anim');
      setTimeout(() => document.documentElement.classList.remove('mode-anim'), 700);
    }
    applyDom(p);
    localStorage.setItem(LS_KEY, JSON.stringify(p));
    // debounced server persistence
    clearTimeout(timer);
    timer = setTimeout(() => {
      const token = localStorage.getItem('aviary-jwt');
      if (token) {
        fetch('/api/v1/prefs', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(p),
        }).catch(() => {});
      }
    }, 700);
  });

  return {
    subscribe,
    set: (patch: Partial<Prefs>) => update((p) => ({ ...p, ...patch })),
    hydrate: (server: Partial<Prefs> | null) => { if (server) update((p) => ({ ...p, ...server })); },
  };
}

export const theme = createTheme();

export function parseCustomTheme(text: string): CustomTheme {
  let raw = text.trim();
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) raw = fence[1].trim();
  const obj = JSON.parse(raw);
  if (!obj?.tokens) throw new Error('Missing "tokens" object');
  for (const k of ['bg', 'surface', 'ink', 'accent']) {
    if (!obj.tokens[k]) throw new Error(`tokens.${k} is required`);
  }
  return { name: String(obj.name || 'Custom theme').slice(0, 48), tokens: obj.tokens, darkTokens: obj.darkTokens };
}

/** Ready-made prompt users paste into any AI along with their design brief. */
export const CUSTOM_THEME_PROMPT = `You are a UI theme generator. I will describe the design style I want below. Respond with ONLY a valid JSON object (no markdown, no commentary) matching exactly this schema:

{
  "name": "<short theme name>",
  "tokens": {
    "bg": "<page background css color>",
    "surface": "<card/panel background css color>",
    "surface2": "<secondary surface css color>",
    "ink": "<main text color>",
    "muted": "<secondary text color>",
    "accent": "<primary action color>",
    "accentDeep": "<darker accent for hover>",
    "glow": "<highlight color>",
    "gold": "<warm secondary accent>",
    "goldDeep": "<darker warm accent>",
    "border": "<border color, may be 'transparent'>",
    "radius": "<corner radius e.g. '14px'>",
    "radiusLg": "<large corner radius e.g. '20px'>",
    "shadowCard": "<css box-shadow for cards>",
    "shadowPop": "<stronger css box-shadow for popovers>",
    "inset": "<inset css box-shadow for inputs>",
    "fontDisplay": "<css font-family stack for headings>",
    "fontBody": "<css font-family stack for body>"
  },
  "darkTokens": { same keys as tokens, tuned for dark mode }
}

Rules: all values must be valid CSS. Ensure readable contrast between ink and bg/surface. Shadows should express the style. Fonts must be from: Fraunces, Outfit, Archivo Black, Baloo 2, Georgia, system-ui.

MY DESIGN BRIEF: <describe the look you want here>`;
