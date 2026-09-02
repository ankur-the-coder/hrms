<script lang="ts">
  // Avatar dropdown — Theme / Font style / Language / Wallpaper / Logout /
  // Light-Dark toggle. Mirrors React src/components/ProfileMenu.tsx.
  import { theme, parseCustomTheme, FONT_LIST, CUSTOM_THEME_PROMPT, type ThemeKey } from '$lib/stores/theme';

  let { profile = null as null | { full_name: string; email: string; role: string; avatar_url?: string }, onLogout = () => {} } = $props();

  const THEMES: { key: ThemeKey; name: string; desc: string; swatch: string[] }[] = [
    { key: 'soft', name: 'Soft UI', desc: 'Neumorphic — the Aviary signature', swatch: ['#e4e7e0', '#0d7a54', '#d9f96a', '#c9932b'] },
    { key: 'basic', name: 'Basic UI', desc: 'Clean, flat and quick', swatch: ['#f6f5f0', '#ffffff', '#0d7a54', '#101914'] },
    { key: 'brutal', name: 'Neo-Brutalism', desc: 'Hard borders, loud shadows', swatch: ['#fdf3d8', '#ffd900', '#1f6feb', '#111111'] },
    { key: 'glass', name: 'Glassmorphism', desc: 'Frosted panels over color fields', swatch: ['#dfe9ef', '#ffffffaa', '#0d7a54', '#3898c7'] },
    { key: 'anime', name: 'Anime', desc: 'Painted skies — meadow, teal & sunlight', swatch: ['#eaf2e8', '#3a8fb7', '#ffd166', '#e08e3c'] },
  ];
  const WALLPAPERS = [
    { key: 'none', name: 'None' }, { key: 'emerald-mist', name: 'Emerald Mist' },
    { key: 'dawn', name: 'Dawn' }, { key: 'graphite', name: 'Graphite Weave' },
    { key: 'sakura', name: 'Sakura' }, { key: 'aurora', name: 'Aurora' },
  ];

  let open = $state(false);
  let panel: 'root' | 'theme' | 'font' | 'wallpaper' = $state('root');
  let customText = $state('');
  let customErr = $state('');
  let copied = $state(false);
  let root: HTMLDivElement | undefined = $state();

  function applyCustom() {
    customErr = '';
    try {
      theme.set({ theme: 'custom', custom: parseCustomTheme(customText) });
    } catch (e) {
      customErr = e instanceof Error ? e.message : 'Invalid JSON';
    }
  }
  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(CUSTOM_THEME_PROMPT);
      copied = true;
      setTimeout(() => (copied = false), 1800);
    } catch { /* denied */ }
  }
  const initials = $derived((profile?.full_name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase());
</script>

<svelte:window onmousedown={(e) => { if (open && root && !root.contains(e.target as Node)) open = false; }} />

<div class="rootm" bind:this={root}>
  <button class="tk-raise-sm avatar" onclick={() => { open = !open; panel = 'root'; }}>
    {#if profile?.avatar_url}<img src={profile.avatar_url} alt="" />{:else}{initials}{/if}
  </button>

  {#if open}
    <div class="tk-pop menu">
      {#if panel === 'root'}
        <div class="who">
          <b>{profile?.full_name || '—'}</b>
          <span>{profile?.email} · {profile?.role}</span>
        </div>
        <button class="rowb" onclick={() => (panel = 'theme')}>
          <span>◐ Theme</span><em>{$theme.theme === 'custom' ? $theme.custom?.name || 'Custom' : THEMES.find((t) => t.key === $theme.theme)?.name} ›</em>
        </button>
        <button class="rowb" onclick={() => (panel = 'font')}>
          <span>A Font style</span><em>{FONT_LIST.find((f) => f.key === $theme.font)?.name || 'Theme default'} ›</em>
        </button>
        <button class="rowb"><span>⚐ Language</span><em>English ›</em></button>
        <button class="rowb" onclick={() => (panel = 'wallpaper')}>
          <span>▤ Wallpaper</span><em>{WALLPAPERS.find((w) => w.key === $theme.wallpaper)?.name || 'Custom'} ›</em>
        </button>
        <div class="sep"></div>
        <button class="rowb danger" onclick={onLogout}><span>⎋ Log out</span></button>
        <div class="tk-inset modes">
          <button class:on={$theme.mode === 'light'} onclick={() => theme.set({ mode: 'light' })}>☀ Light</button>
          <button class:on={$theme.mode === 'dark'} onclick={() => theme.set({ mode: 'dark' })}>☾ Dark</button>
        </div>

      {:else if panel === 'theme'}
        <button class="back" onclick={() => (panel = 'root')}>← Back</button>
        {#each THEMES as t (t.key)}
          <button class="themecard tk-card" class:sel={$theme.theme === t.key} onclick={() => theme.set({ theme: t.key })}>
            <span class="sw">{#each t.swatch as c (c)}<i style="background:{c}"></i>{/each}</span>
            <b>{t.name}</b>
            <small>{t.desc}</small>
          </button>
        {/each}
        <div class="custom tk-card" class:sel={$theme.theme === 'custom'}>
          <b>✦ Custom theme (AI-generated)</b>
          <small>1 · Copy the prompt &nbsp;2 · Paste into any AI with your design brief &nbsp;3 · Paste the JSON reply below.</small>
          <button class="tk-btn-ghost sm" onclick={copyPrompt}>{copied ? 'Copied!' : 'Copy AI prompt'}</button>
          <textarea class="tk-input" rows="4" bind:value={customText} placeholder={'Paste the AI\u2019s JSON here'}></textarea>
          {#if customErr}<p class="err">{customErr}</p>{/if}
          <button class="tk-btn-primary sm" disabled={!customText.trim()} onclick={applyCustom}>Apply custom theme</button>
        </div>

      {:else if panel === 'font'}
        <button class="back" onclick={() => (panel = 'root')}>← Back</button>
        {#each FONT_LIST as f (f.key)}
          <button class="themecard tk-card" class:sel={$theme.font === f.key} onclick={() => theme.set({ font: f.key })}>
            <b>{f.name}</b>
            {#if f.key === 'theme'}
              <small>Follows whichever theme is active.</small>
            {:else}
              <small style="font-family:{f.display};font-size:14px;color:var(--t-ink)">Aviary makes HR effortless — <span style="font-family:{f.body};font-size:11.5px;color:var(--t-muted)">body sample 0123</span></small>
            {/if}
          </button>
        {/each}

      {:else}
        <button class="back" onclick={() => (panel = 'root')}>← Back</button>
        {#each WALLPAPERS as w (w.key)}
          <button class="rowb" class:acc={$theme.wallpaper === w.key} onclick={() => theme.set({ wallpaper: w.key })}>
            <span>{w.name}</span>{#if $theme.wallpaper === w.key}<em>✓</em>{/if}
          </button>
        {/each}
      {/if}
    </div>
  {/if}
</div>

<style>
  .rootm { position: relative; }
  .avatar { width: 38px; height: 38px; border-radius: 999px; overflow: hidden;
    display: inline-flex; align-items: center; justify-content: center;
    font: 700 13px var(--t-font-body); color: var(--t-accent); }
  .avatar img { width: 100%; height: 100%; object-fit: cover; }
  .menu { position: absolute; right: 0; top: calc(100% + 10px); width: 290px;
    max-height: min(70vh, 560px); overflow-y: auto; padding: 10px; z-index: 60; }
  .who { padding: 6px 10px 10px; margin-bottom: 6px;
    border-bottom: 1px solid color-mix(in srgb, var(--t-ink) 8%, transparent); }
  .who b { display: block; font: 700 14px var(--t-font-body); color: var(--t-ink); }
  .who span { font: 500 11px var(--t-font-body); color: var(--t-muted); }
  .rowb { display: flex; justify-content: space-between; align-items: center; gap: 8px;
    width: 100%; padding: 9px 12px; border-radius: 10px; text-align: left; }
  .rowb span { font: 600 13.5px var(--t-font-body); color: var(--t-ink); }
  .rowb em { font: 700 11px var(--t-font-body); font-style: normal; color: var(--t-muted); }
  .rowb:hover { background: color-mix(in srgb, var(--t-accent) 8%, transparent); }
  .rowb.danger span { color: #e11d48; }
  .rowb.acc span { color: var(--t-accent); }
  .sep { height: 1px; margin: 6px 0; background: color-mix(in srgb, var(--t-ink) 8%, transparent); }
  .modes { display: flex; gap: 4px; padding: 4px; margin-top: 8px; border-radius: 12px; }
  .modes button { flex: 1; padding: 7px; border-radius: 8px; font: 700 12px var(--t-font-body); color: var(--t-muted); }
  .modes button.on { background: var(--t-surface); box-shadow: var(--t-shadow-card); color: var(--t-accent); }
  .back { font: 700 12px var(--t-font-body); color: var(--t-accent); padding: 4px 8px 8px; }
  .themecard { display: block; width: 100%; text-align: left; padding: 12px; margin-bottom: 8px; }
  .themecard.sel { outline: 2px solid var(--t-accent); }
  .themecard b { display: block; font: 600 13.5px var(--t-font-display); color: var(--t-ink); }
  .themecard small { display: block; margin-top: 2px; font: 500 11px var(--t-font-body); color: var(--t-muted); }
  .sw { display: flex; gap: 4px; margin-bottom: 6px; }
  .sw i { width: 18px; height: 18px; border-radius: 999px; border: 1px solid rgba(0,0,0,0.1); }
  .custom { padding: 12px; }
  .custom.sel { outline: 2px solid var(--t-accent); }
  .custom b { font: 600 13px var(--t-font-display); color: var(--t-ink); }
  .custom small { display: block; margin: 4px 0 8px; font: 500 10.5px var(--t-font-body);
    color: var(--t-muted); line-height: 1.5; }
  .custom textarea { width: 100%; margin: 8px 0; padding: 8px; font: 500 10.5px monospace; }
  .sm { padding: 7px 12px; font: 700 11.5px var(--t-font-body); border-radius: 10px; }
  .err { margin: 0 0 6px; font: 600 11px var(--t-font-body); color: #e11d48; }
</style>
