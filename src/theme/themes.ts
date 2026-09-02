export type ThemeKey = 'soft' | 'basic' | 'brutal' | 'glass' | 'anime' | 'custom';
export type Mode = 'light' | 'dark';

export interface CustomTokens {
  bg: string; surface: string; surface2?: string; ink: string; muted?: string;
  accent: string; accentDeep?: string; glow?: string; gold?: string; goldDeep?: string;
  border?: string; radius?: string; radiusLg?: string;
  shadowCard?: string; shadowPop?: string; inset?: string;
  fontDisplay?: string; fontBody?: string;
}
export interface CustomTheme {
  name: string;
  tokens: CustomTokens;
  darkTokens?: CustomTokens;
}

export const THEME_LIST: { key: ThemeKey; name: string; desc: string; swatch: string[] }[] = [
  { key: 'soft', name: 'Soft UI', desc: 'Neumorphic — the Aviary signature', swatch: ['#e4e7e0', '#0d7a54', '#d9f96a', '#c9932b'] },
  { key: 'basic', name: 'Basic UI', desc: 'Clean, flat and quick', swatch: ['#f6f5f0', '#ffffff', '#0d7a54', '#101914'] },
  { key: 'brutal', name: 'Neo-Brutalism', desc: 'Hard borders, loud shadows', swatch: ['#fdf3d8', '#ffd900', '#1f6feb', '#111111'] },
  { key: 'glass', name: 'Glassmorphism', desc: 'Frosted panels over color fields', swatch: ['#dfe9ef', '#ffffffaa', '#0d7a54', '#3898c7'] },
  { key: 'anime', name: 'Anime', desc: 'Painted skies — meadow, teal & sunlight', swatch: ['#eaf2e8', '#3a8fb7', '#ffd166', '#e08e3c'] },
];

/* ============================================================
   FONT LIBRARY — Google Fonts (open source, 1,700+ families).
   A curated 120-family catalog across every category, loaded
   on demand via the CSS2 API. Search + heading/body targeting
   live in the ProfileMenu font panel.
   ============================================================ */
export type FontCategory = 'serif' | 'sans-serif' | 'display' | 'handwriting' | 'monospace';

export const GOOGLE_FONTS: { name: string; cat: FontCategory }[] = [
  // ---- sans-serif ----
  { name: 'Inter', cat: 'sans-serif' }, { name: 'Roboto', cat: 'sans-serif' },
  { name: 'Open Sans', cat: 'sans-serif' }, { name: 'Lato', cat: 'sans-serif' },
  { name: 'Montserrat', cat: 'sans-serif' }, { name: 'Poppins', cat: 'sans-serif' },
  { name: 'Outfit', cat: 'sans-serif' }, { name: 'Manrope', cat: 'sans-serif' },
  { name: 'Sora', cat: 'sans-serif' }, { name: 'Nunito', cat: 'sans-serif' },
  { name: 'Nunito Sans', cat: 'sans-serif' }, { name: 'Work Sans', cat: 'sans-serif' },
  { name: 'Raleway', cat: 'sans-serif' }, { name: 'Rubik', cat: 'sans-serif' },
  { name: 'Karla', cat: 'sans-serif' }, { name: 'Mulish', cat: 'sans-serif' },
  { name: 'Urbanist', cat: 'sans-serif' }, { name: 'Figtree', cat: 'sans-serif' },
  { name: 'Plus Jakarta Sans', cat: 'sans-serif' }, { name: 'DM Sans', cat: 'sans-serif' },
  { name: 'Space Grotesk', cat: 'sans-serif' }, { name: 'Lexend', cat: 'sans-serif' },
  { name: 'Albert Sans', cat: 'sans-serif' }, { name: 'Onest', cat: 'sans-serif' },
  { name: 'Schibsted Grotesk', cat: 'sans-serif' }, { name: 'Hanken Grotesk', cat: 'sans-serif' },
  { name: 'IBM Plex Sans', cat: 'sans-serif' }, { name: 'Source Sans 3', cat: 'sans-serif' },
  { name: 'Noto Sans', cat: 'sans-serif' }, { name: 'PT Sans', cat: 'sans-serif' },
  { name: 'Quicksand', cat: 'sans-serif' }, { name: 'Josefin Sans', cat: 'sans-serif' },
  { name: 'Exo 2', cat: 'sans-serif' }, { name: 'Barlow', cat: 'sans-serif' },
  { name: 'Cabin', cat: 'sans-serif' }, { name: 'Assistant', cat: 'sans-serif' },
  { name: 'Jost', cat: 'sans-serif' }, { name: 'Overpass', cat: 'sans-serif' },
  { name: 'Red Hat Display', cat: 'sans-serif' }, { name: 'Archivo', cat: 'sans-serif' },
  { name: 'Be Vietnam Pro', cat: 'sans-serif' }, { name: 'Public Sans', cat: 'sans-serif' },
  { name: 'Wix Madefor Display', cat: 'sans-serif' }, { name: 'Instrument Sans', cat: 'sans-serif' },
  { name: 'Bricolage Grotesque', cat: 'sans-serif' }, { name: 'Gabarito', cat: 'sans-serif' },
  // ---- serif ----
  { name: 'Fraunces', cat: 'serif' }, { name: 'Playfair Display', cat: 'serif' },
  { name: 'Lora', cat: 'serif' }, { name: 'Merriweather', cat: 'serif' },
  { name: 'Libre Baskerville', cat: 'serif' }, { name: 'Cormorant Garamond', cat: 'serif' },
  { name: 'EB Garamond', cat: 'serif' }, { name: 'Crimson Pro', cat: 'serif' },
  { name: 'Source Serif 4', cat: 'serif' }, { name: 'IBM Plex Serif', cat: 'serif' },
  { name: 'Spectral', cat: 'serif' }, { name: 'Bitter', cat: 'serif' },
  { name: 'Domine', cat: 'serif' }, { name: 'Zilla Slab', cat: 'serif' },
  { name: 'Cardo', cat: 'serif' }, { name: 'Vollkorn', cat: 'serif' },
  { name: 'Literata', cat: 'serif' }, { name: 'Newsreader', cat: 'serif' },
  { name: 'Bodoni Moda', cat: 'serif' }, { name: 'DM Serif Display', cat: 'serif' },
  { name: 'Libre Caslon Text', cat: 'serif' }, { name: 'Frank Ruhl Libre', cat: 'serif' },
  { name: 'Noto Serif', cat: 'serif' }, { name: 'PT Serif', cat: 'serif' },
  { name: 'Roboto Slab', cat: 'serif' }, { name: 'Arvo', cat: 'serif' },
  { name: 'Instrument Serif', cat: 'serif' }, { name: 'Gloock', cat: 'serif' },
  // ---- display ----
  { name: 'Archivo Black', cat: 'display' }, { name: 'Bebas Neue', cat: 'display' },
  { name: 'Righteous', cat: 'display' }, { name: 'Alfa Slab One', cat: 'display' },
  { name: 'Abril Fatface', cat: 'display' }, { name: 'Lobster', cat: 'display' },
  { name: 'Comfortaa', cat: 'display' }, { name: 'Fredoka', cat: 'display' },
  { name: 'Baloo 2', cat: 'display' }, { name: 'Chewy', cat: 'display' },
  { name: 'Bungee', cat: 'display' }, { name: 'Titan One', cat: 'display' },
  { name: 'Concert One', cat: 'display' }, { name: 'Passion One', cat: 'display' },
  { name: 'Secular One', cat: 'display' }, { name: 'Unbounded', cat: 'display' },
  { name: 'Clash Display', cat: 'display' }, { name: 'Anton', cat: 'display' },
  { name: 'Oswald', cat: 'display' }, { name: 'Staatliches', cat: 'display' },
  { name: 'Big Shoulders Display', cat: 'display' }, { name: 'Rowdies', cat: 'display' },
  // ---- handwriting ----
  { name: 'Caveat', cat: 'handwriting' }, { name: 'Dancing Script', cat: 'handwriting' },
  { name: 'Pacifico', cat: 'handwriting' }, { name: 'Satisfy', cat: 'handwriting' },
  { name: 'Great Vibes', cat: 'handwriting' }, { name: 'Kalam', cat: 'handwriting' },
  { name: 'Shadows Into Light', cat: 'handwriting' }, { name: 'Indie Flower', cat: 'handwriting' },
  { name: 'Patrick Hand', cat: 'handwriting' }, { name: 'Amatic SC', cat: 'handwriting' },
  { name: 'Gochi Hand', cat: 'handwriting' }, { name: 'Sacramento', cat: 'handwriting' },
  // ---- monospace ----
  { name: 'JetBrains Mono', cat: 'monospace' }, { name: 'Fira Code', cat: 'monospace' },
  { name: 'Space Mono', cat: 'monospace' }, { name: 'IBM Plex Mono', cat: 'monospace' },
  { name: 'Source Code Pro', cat: 'monospace' }, { name: 'Roboto Mono', cat: 'monospace' },
  { name: 'Inconsolata', cat: 'monospace' }, { name: 'Ubuntu Mono', cat: 'monospace' },
  { name: 'Courier Prime', cat: 'monospace' }, { name: 'DM Mono', cat: 'monospace' },
];

const FALLBACK: Record<FontCategory, string> = {
  serif: 'Georgia, serif',
  'sans-serif': 'system-ui, sans-serif',
  display: 'system-ui, sans-serif',
  handwriting: 'cursive',
  monospace: 'ui-monospace, monospace',
};

export function fontStack(family: string): string {
  const cat = GOOGLE_FONTS.find((f) => f.name === family)?.cat || 'sans-serif';
  return `"${family}", ${FALLBACK[cat]}`;
}

const loadedFonts = new Set<string>();
/** Inject a Google Fonts stylesheet for a family (idempotent). */
export function loadGoogleFont(family: string) {
  if (loadedFonts.has(family) || typeof document === 'undefined') return;
  loadedFonts.add(family);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap`;
  document.head.appendChild(link);
}

export const WALLPAPERS: { key: string; name: string; css: string }[] = [
  { key: 'none', name: 'None', css: '' },
  { key: 'emerald-mist', name: 'Emerald Mist', css: 'radial-gradient(ellipse at 20% 15%, rgba(13,122,84,0.35), transparent 55%), radial-gradient(ellipse at 80% 85%, rgba(217,249,106,0.28), transparent 50%), linear-gradient(160deg, #eef3ec, #dce8df)' },
  { key: 'dawn', name: 'Dawn', css: 'linear-gradient(150deg, #ffdfc4 0%, #ffb8a0 30%, #b8a0d8 70%, #7a8ec9 100%)' },
  { key: 'graphite', name: 'Graphite Weave', css: 'repeating-linear-gradient(45deg, #23282c 0 14px, #272d31 14px 28px)' },
  { key: 'sakura', name: 'Sakura', css: 'radial-gradient(circle at 25% 20%, rgba(255,150,190,0.4), transparent 45%), radial-gradient(circle at 75% 70%, rgba(200,160,255,0.35), transparent 45%), linear-gradient(160deg, #fff0f5, #ffe4ef)' },
  { key: 'aurora', name: 'Aurora', css: 'linear-gradient(200deg, #071a14 10%, #0b3b2d 40%, #14755b 65%, #58c1a0 100%)' },
];

/** Ready-made prompt the user pastes into any AI along with their design brief. */
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
    "glow": "<highlight/accent-2 color>",
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

Rules: all values must be valid CSS. Ensure WCAG-readable contrast between ink and bg/surface. Shadows should express the style (e.g. hard offset for brutalism, soft dual shadows for neumorphism). Fonts must be common web-safe or Google fonts already loaded: Fraunces, Outfit, Archivo Black, Baloo 2, Georgia, system-ui.

MY DESIGN BRIEF: <describe the look you want here>`;

const VAR_MAP: Record<keyof CustomTokens, string> = {
  bg: '--t-bg', surface: '--t-surface', surface2: '--t-surface2', ink: '--t-ink',
  muted: '--t-muted', accent: '--t-accent', accentDeep: '--t-accent-deep',
  glow: '--t-glow', gold: '--t-gold', goldDeep: '--t-gold-deep', border: '--t-border',
  radius: '--t-radius', radiusLg: '--t-radius-lg', shadowCard: '--t-shadow-card',
  shadowPop: '--t-shadow-pop', inset: '--t-inset', fontDisplay: '--t-font-display',
  fontBody: '--t-font-body',
};

export function applyCustomTokens(theme: CustomTheme | null, mode: Mode) {
  const root = document.documentElement;
  Object.values(VAR_MAP).forEach((v) => root.style.removeProperty(v));
  if (!theme) return;
  const t = mode === 'dark' && theme.darkTokens ? { ...theme.tokens, ...theme.darkTokens } : theme.tokens;
  (Object.keys(VAR_MAP) as (keyof CustomTokens)[]).forEach((k) => {
    const val = t[k];
    if (val && String(val).length < 400) root.style.setProperty(VAR_MAP[k], String(val));
  });
}

export function parseCustomTheme(text: string): CustomTheme {
  let raw = text.trim();
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) raw = fence[1].trim();
  const obj = JSON.parse(raw);
  if (!obj || typeof obj !== 'object' || !obj.tokens) throw new Error('Missing "tokens" object');
  const req = ['bg', 'surface', 'ink', 'accent'];
  for (const k of req) {
    if (!obj.tokens[k]) throw new Error(`tokens.${k} is required`);
  }
  return { name: String(obj.name || 'Custom theme').slice(0, 48), tokens: obj.tokens, darkTokens: obj.darkTokens };
}
